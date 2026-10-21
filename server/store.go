package main

import (
	"database/sql"
	"errors"
	"path/filepath"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS entries (
	id      INTEGER PRIMARY KEY,
	name    TEXT    NOT NULL,
	message TEXT    NOT NULL,
	created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
	id       INTEGER PRIMARY KEY,
	entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
	file     TEXT    NOT NULL,
	thumb    TEXT    NOT NULL,
	w        INTEGER NOT NULL,
	h        INTEGER NOT NULL,
	pos      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS images_entry ON images(entry_id);
-- Eine Uebersetzung pro Eintrag und Zielsprache; DeepL wird nur bei
-- fehlender Zeile gefragt.
CREATE TABLE IF NOT EXISTS translations (
	entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
	lang     TEXT    NOT NULL,
	source   TEXT    NOT NULL,
	text     TEXT    NOT NULL,
	chars    INTEGER NOT NULL,
	created  INTEGER NOT NULL,
	PRIMARY KEY (entry_id, lang)
);
-- Emoji-Reaktionen; voter ist eine zufaellige Geraete-ID aus dem Browser,
-- pro Geraet zaehlt jedes Emoji einmal.
CREATE TABLE IF NOT EXISTS reactions (
	entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
	emoji    TEXT    NOT NULL,
	voter    TEXT    NOT NULL,
	created  INTEGER NOT NULL,
	PRIMARY KEY (entry_id, emoji, voter)
);
-- Besucherzaehler: ein Geraet pro Tag (Europe/Berlin). visitor ist ein
-- SHA-256-Hash, country der Code von Cloudflare oder "".
CREATE TABLE IF NOT EXISTS visits (
	day     TEXT NOT NULL,
	visitor TEXT NOT NULL,
	country TEXT NOT NULL,
	PRIMARY KEY (day, visitor)
);
-- "Unterwegs": Fotos, die nur Admins hochladen. lat/lon und taken sind
-- optional (aus den EXIF-Daten des Originalfotos, im Browser ausgelesen).
CREATE TABLE IF NOT EXISTS moments (
	id      INTEGER PRIMARY KEY,
	caption TEXT    NOT NULL,
	place   TEXT    NOT NULL,
	station TEXT    NOT NULL,
	lat     REAL,
	lon     REAL,
	taken   INTEGER,
	created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS moment_images (
	id        INTEGER PRIMARY KEY,
	moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
	file      TEXT    NOT NULL,
	thumb     TEXT    NOT NULL,
	w         INTEGER NOT NULL,
	h         INTEGER NOT NULL,
	pos       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS moment_images_moment ON moment_images(moment_id);
`

type store struct{ db *sql.DB }

type imageJSON struct {
	Full  string `json:"full"`
	Thumb string `json:"thumb"`
	W     int    `json:"w"`
	H     int    `json:"h"`
}

type entryJSON struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	Message   string         `json:"message"`
	Created   int64          `json:"created"`
	Images    []imageJSON    `json:"images"`
	Reactions map[string]int `json:"reactions"`
}

func openStore(dataDir string) (*store, error) {
	dsn := "file:" + filepath.Join(dataDir, "guestbook.db") +
		"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &store{db: db}, nil
}

func (s *store) list(limit int) ([]entryJSON, error) {
	rows, err := s.db.Query(`SELECT id, name, message, created FROM entries ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	entries := []entryJSON{}
	index := map[int64]int{}
	for rows.Next() {
		e := entryJSON{Images: []imageJSON{}, Reactions: map[string]int{}}
		if err := rows.Scan(&e.ID, &e.Name, &e.Message, &e.Created); err != nil {
			rows.Close()
			return nil, err
		}
		index[e.ID] = len(entries)
		entries = append(entries, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(entries) == 0 {
		return entries, err
	}

	minID := entries[len(entries)-1].ID
	rows, err = s.db.Query(`SELECT entry_id, file, thumb, w, h FROM images WHERE entry_id >= ? ORDER BY entry_id, pos`, minID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var file, thumb string
		var w, h int
		if err := rows.Scan(&id, &file, &thumb, &w, &h); err != nil {
			rows.Close()
			return nil, err
		}
		if i, ok := index[id]; ok {
			entries[i].Images = append(entries[i].Images, imageJSON{
				Full: imgPrefix + file, Thumb: imgPrefix + thumb, W: w, H: h,
			})
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(`SELECT entry_id, emoji, COUNT(*) FROM reactions WHERE entry_id >= ? GROUP BY entry_id, emoji`, minID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var emoji string
		var n int
		if err := rows.Scan(&id, &emoji, &n); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			entries[i].Reactions[emoji] = n
		}
	}
	return entries, rows.Err()
}

func (s *store) insert(name, message string, created int64, imgs []savedImage) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`INSERT INTO entries (name, message, created) VALUES (?, ?, ?)`, name, message, created)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	for i, img := range imgs {
		if _, err := tx.Exec(`INSERT INTO images (entry_id, file, thumb, w, h, pos) VALUES (?, ?, ?, ?, ?, ?)`,
			id, img.File, img.Thumb, img.W, img.H, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// delete loescht einen Eintrag und gibt die zugehoerigen Bilddateien zurueck,
// damit der Aufrufer sie von der Platte entfernen kann.
func (s *store) delete(id int64) (found bool, imgs []savedImage, err error) {
	tx, err := s.db.Begin()
	if err != nil {
		return false, nil, err
	}
	defer tx.Rollback()
	rows, err := tx.Query(`SELECT file, thumb FROM images WHERE entry_id = ?`, id)
	if err != nil {
		return false, nil, err
	}
	for rows.Next() {
		var img savedImage
		if err := rows.Scan(&img.File, &img.Thumb); err != nil {
			rows.Close()
			return false, nil, err
		}
		imgs = append(imgs, img)
	}
	rows.Close()
	res, err := tx.Exec(`DELETE FROM entries WHERE id = ?`, id)
	if err != nil {
		return false, nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return false, nil, nil
	}
	return true, imgs, tx.Commit()
}

func (s *store) imagesSince(since int64) (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM images JOIN entries ON entries.id = images.entry_id WHERE entries.created >= ?`, since).Scan(&n)
	return n, err
}

type translation struct {
	Source string
	Text   string
}

func (s *store) translation(entryID int64, lang string) (translation, bool, error) {
	var t translation
	err := s.db.QueryRow(`SELECT source, text FROM translations WHERE entry_id = ? AND lang = ?`, entryID, lang).Scan(&t.Source, &t.Text)
	if errors.Is(err, sql.ErrNoRows) {
		return t, false, nil
	}
	return t, err == nil, err
}

func (s *store) message(entryID int64) (string, bool, error) {
	var msg string
	err := s.db.QueryRow(`SELECT message FROM entries WHERE id = ?`, entryID).Scan(&msg)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return msg, err == nil, err
}

func (s *store) saveTranslation(entryID int64, lang string, t translation, chars int, created int64) error {
	_, err := s.db.Exec(`INSERT OR REPLACE INTO translations (entry_id, lang, source, text, chars, created) VALUES (?, ?, ?, ?, ?, ?)`,
		entryID, lang, t.Source, t.Text, chars, created)
	return err
}

// translatedCharsSince zaehlt die an DeepL geschickten Zeichen, fuer das Tageslimit.
func (s *store) translatedCharsSince(since int64) (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COALESCE(SUM(chars), 0) FROM translations WHERE created >= ?`, since).Scan(&n)
	return n, err
}

// react setzt (on) oder entfernt eine Reaktion und gibt die neuen Zahlen des
// Eintrags zurueck. Doppeltes Setzen zaehlt nur einmal.
func (s *store) react(entryID int64, emoji, voter string, on bool, created int64) (counts map[string]int, found bool, err error) {
	if _, ok, err := s.message(entryID); !ok || err != nil {
		return nil, false, err
	}
	if on {
		_, err = s.db.Exec(`INSERT OR IGNORE INTO reactions (entry_id, emoji, voter, created) VALUES (?, ?, ?, ?)`,
			entryID, emoji, voter, created)
	} else {
		_, err = s.db.Exec(`DELETE FROM reactions WHERE entry_id = ? AND emoji = ? AND voter = ?`, entryID, emoji, voter)
	}
	if err != nil {
		return nil, true, err
	}
	rows, err := s.db.Query(`SELECT emoji, COUNT(*) FROM reactions WHERE entry_id = ? GROUP BY emoji`, entryID)
	if err != nil {
		return nil, true, err
	}
	defer rows.Close()
	counts = map[string]int{}
	for rows.Next() {
		var e string
		var n int
		if err := rows.Scan(&e, &n); err != nil {
			return nil, true, err
		}
		counts[e] = n
	}
	return counts, true, rows.Err()
}

// addVisit zaehlt ein Geraet fuer den Tag; added ist false, wenn es heute
// schon gezaehlt wurde.
func (s *store) addVisit(day, visitor, country string) (added bool, err error) {
	res, err := s.db.Exec(`INSERT OR IGNORE INTO visits (day, visitor, country) VALUES (?, ?, ?)`, day, visitor, country)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// stats: Geraete heute, verschiedene Geraete insgesamt und Geraete pro Land
// (die ersten topN einzeln, der Rest zusammen in Others).
func (s *store) stats(day string, topN int) (*statsJSON, error) {
	out := &statsJSON{Countries: []countryJSON{}}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM visits WHERE day = ?`, day).Scan(&out.Today); err != nil {
		return nil, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(DISTINCT visitor) FROM visits`).Scan(&out.Total); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`SELECT country, COUNT(DISTINCT visitor) AS n FROM visits GROUP BY country ORDER BY n DESC, country`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c countryJSON
		if err := rows.Scan(&c.Code, &c.N); err != nil {
			return nil, err
		}
		if c.Code != "" && len(out.Countries) < topN {
			out.Countries = append(out.Countries, c)
		} else {
			out.Others += c.N
		}
	}
	return out, rows.Err()
}

type momentJSON struct {
	ID      int64       `json:"id"`
	Caption string      `json:"caption"`
	Place   string      `json:"place"`
	Station string      `json:"station"`
	Lat     *float64    `json:"lat"`
	Lon     *float64    `json:"lon"`
	Taken   *int64      `json:"taken"`
	Created int64       `json:"created"`
	Images  []imageJSON `json:"images"`
}

func (s *store) listMoments(limit int) ([]momentJSON, error) {
	rows, err := s.db.Query(`SELECT id, caption, place, station, lat, lon, taken, created FROM moments
		ORDER BY COALESCE(taken, created) DESC, id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	moments := []momentJSON{}
	index := map[int64]int{}
	for rows.Next() {
		m := momentJSON{Images: []imageJSON{}}
		if err := rows.Scan(&m.ID, &m.Caption, &m.Place, &m.Station, &m.Lat, &m.Lon, &m.Taken, &m.Created); err != nil {
			rows.Close()
			return nil, err
		}
		index[m.ID] = len(moments)
		moments = append(moments, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(moments) == 0 {
		return moments, err
	}

	rows, err = s.db.Query(`SELECT moment_id, file, thumb, w, h FROM moment_images ORDER BY moment_id, pos`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var file, thumb string
		var w, h int
		if err := rows.Scan(&id, &file, &thumb, &w, &h); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			moments[i].Images = append(moments[i].Images, imageJSON{
				Full: imgPrefix + file, Thumb: imgPrefix + thumb, W: w, H: h,
			})
		}
	}
	return moments, rows.Err()
}

type newMoment struct {
	Caption, Place, Station string
	Lat, Lon                *float64
	Taken                   *int64
	Created                 int64
}

func (s *store) insertMoment(m newMoment, imgs []savedImage) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`INSERT INTO moments (caption, place, station, lat, lon, taken, created) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		m.Caption, m.Place, m.Station, m.Lat, m.Lon, m.Taken, m.Created)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	for i, img := range imgs {
		if _, err := tx.Exec(`INSERT INTO moment_images (moment_id, file, thumb, w, h, pos) VALUES (?, ?, ?, ?, ?, ?)`,
			id, img.File, img.Thumb, img.W, img.H, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// deleteMoment wie delete: gibt die Bilddateien zum Entfernen zurueck.
func (s *store) deleteMoment(id int64) (found bool, imgs []savedImage, err error) {
	tx, err := s.db.Begin()
	if err != nil {
		return false, nil, err
	}
	defer tx.Rollback()
	rows, err := tx.Query(`SELECT file, thumb FROM moment_images WHERE moment_id = ?`, id)
	if err != nil {
		return false, nil, err
	}
	for rows.Next() {
		var img savedImage
		if err := rows.Scan(&img.File, &img.Thumb); err != nil {
			rows.Close()
			return false, nil, err
		}
		imgs = append(imgs, img)
	}
	rows.Close()
	res, err := tx.Exec(`DELETE FROM moments WHERE id = ?`, id)
	if err != nil {
		return false, nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return false, nil, nil
	}
	return true, imgs, tx.Commit()
}
