package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	_ "time/tzdata" // distroless hat keine Zeitzonen-Datenbank
)

// Besucherzaehler. Der Browser meldet jeden Seitenaufruf an /visit, gezaehlt
// wird jedes Geraet einmal pro Tag (Europe/Berlin). Gespeichert wird nur ein
// Hash der Geraete-ID und das Land von Cloudflare (CF-IPCountry), keine IP.

const (
	visitsPerHour  = 30 // Meldungen pro IP und Stunde
	statsTTL       = 60 * time.Second
	statsCountries = 10 // Laender einzeln, der Rest als "weitere"
)

var (
	countryCode = regexp.MustCompile(`^[A-Z]{2}$`)
	botUA       = regexp.MustCompile(`(?i)bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse`)
	berlin      = mustLoadLocation("Europe/Berlin")
)

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		log.Fatal(err)
	}
	return loc
}

type countryJSON struct {
	Code string `json:"code"` // "" = unbekannt
	N    int    `json:"n"`
}

type statsJSON struct {
	Today     int           `json:"today"`
	Total     int           `json:"total"`
	Countries []countryJSON `json:"countries"`
	Others    int           `json:"others"` // Besucher aus Laendern ausserhalb der Top-Liste
}

type statsCache struct {
	mu      sync.Mutex
	data    *statsJSON
	day     string
	fetched time.Time
}

func (s *server) handleVisit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Voter string `json:"voter"`
	}
	// Ohne gueltige ID wird trotzdem gezaehlt (Fallback unten)
	json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&req)

	ua := r.UserAgent()
	ip := clientIP(r)
	now := time.Now()
	if ua == "" || botUA.MatchString(ua) || s.isAdmin(r) || !s.allowN(s.visitLog, ip, now, visitsPerHour) {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	day := now.In(berlin).Format("2006-01-02")
	var key string
	if voterID.MatchString(req.Voter) {
		key = "v:" + req.Voter
	} else {
		// kein localStorage: IP und Browser, nur fuer diesen Tag gueltig
		key = "i:" + ip + "|" + ua + "|" + day
	}
	sum := sha256.Sum256([]byte(key))

	added, err := s.store.addVisit(day, hex.EncodeToString(sum[:]), country(r))
	if err != nil {
		log.Printf("addVisit: %v", err)
	} else if added {
		s.stats.invalidate()
	}
	w.WriteHeader(http.StatusNoContent)
}

// country liefert den Laendercode von Cloudflare, "" wenn unbekannt
// (XX = unbekannt, T1 = Tor).
func country(r *http.Request) string {
	c := strings.ToUpper(strings.TrimSpace(r.Header.Get("CF-IPCountry")))
	if !countryCode.MatchString(c) || c == "XX" || c == "T1" {
		return ""
	}
	return c
}

func (s *server) handleStats(w http.ResponseWriter, r *http.Request) {
	data, err := s.stats.get(s.store, time.Now())
	if err != nil {
		log.Printf("stats: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (c *statsCache) invalidate() {
	c.mu.Lock()
	c.data = nil
	c.mu.Unlock()
}

func (c *statsCache) get(st *store, now time.Time) (*statsJSON, error) {
	day := now.In(berlin).Format("2006-01-02")
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.data != nil && c.day == day && now.Sub(c.fetched) < statsTTL {
		return c.data, nil
	}
	data, err := st.stats(day, statsCountries)
	if err != nil {
		return nil, err
	}
	c.data, c.day, c.fetched = data, day, now
	return data, nil
}
