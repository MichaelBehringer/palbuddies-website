package main

import (
	"database/sql"
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
`

type store struct{ db *sql.DB }

type imageJSON struct {
	Full  string `json:"full"`
	Thumb string `json:"thumb"`
	W     int    `json:"w"`
	H     int    `json:"h"`
}

type entryJSON struct {
	ID      int64       `json:"id"`
	Name    string      `json:"name"`
	Message string      `json:"message"`
	Created int64       `json:"created"`
	Images  []imageJSON `json:"images"`
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
		e := entryJSON{Images: []imageJSON{}}
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
	defer rows.Close()
	for rows.Next() {
		var id int64
		var file, thumb string
		var w, h int
		if err := rows.Scan(&id, &file, &thumb, &w, &h); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			entries[i].Images = append(entries[i].Images, imageJSON{
				Full: imgPrefix + file, Thumb: imgPrefix + thumb, W: w, H: h,
			})
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
