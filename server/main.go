// Gaestebuch-Backend fuer palbuddies.behringer.dev.
//
// Der edge-nginx reicht /api/guestbook hierher durch. Eintraege und Bilder
// liegen unter DATA_DIR (im Container /data, auf dem Host
// /srv/palbuddies-data), ausserhalb des Repos und ausserhalb von /srv/www.
package main

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	imgPrefix     = "/api/guestbook/img/"
	maxBody       = 12 << 20
	maxImages     = 3
	maxName       = 40
	maxMessage    = 500
	listLimit     = 100
	postInterval  = 60 * time.Second
	dailyImageCap = 200
	// neue (nicht gecachte) Uebersetzungen pro IP und Stunde
	translatePerHour = 30
	maxMemoryParts   = maxBody
)

var imgName = regexp.MustCompile(`^[0-9a-f]{32}(_t)?\.jpg$`)

type server struct {
	store      *store
	imageDir   string
	adminToken []byte

	translator *translator // nil, wenn kein DEEPL_API_KEY gesetzt ist

	mu           sync.Mutex
	lastPost     map[string]time.Time
	translateLog map[string][]time.Time
}

func main() {
	dataDir := envOr("DATA_DIR", "/data")
	token := os.Getenv("ADMIN_TOKEN")
	if len(token) < 16 {
		log.Fatal("ADMIN_TOKEN fehlt oder ist zu kurz (mind. 16 Zeichen)")
	}

	imageDir := filepath.Join(dataDir, "images")
	if err := os.MkdirAll(imageDir, 0o755); err != nil {
		log.Fatal(err)
	}
	st, err := openStore(dataDir)
	if err != nil {
		log.Fatal(err)
	}

	s := &server{
		store: st, imageDir: imageDir, adminToken: []byte(token),
		translator: newTranslator(os.Getenv("DEEPL_API_KEY")),
		lastPost:   map[string]time.Time{}, translateLog: map[string][]time.Time{},
	}
	if s.translator == nil {
		log.Print("DEEPL_API_KEY nicht gesetzt: Uebersetzen ist abgeschaltet")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/guestbook", s.handleList)
	mux.HandleFunc("POST /api/guestbook", s.handleCreate)
	mux.HandleFunc("DELETE /api/guestbook/{id}", s.handleDelete)
	mux.HandleFunc("POST /api/guestbook/{id}/translate", s.handleTranslate)
	mux.HandleFunc("GET /api/guestbook/img/{name}", s.handleImage)

	srv := &http.Server{
		Addr:              envOr("ADDR", ":8000"),
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second, // Uploads ueber langsames Mobilfunknetz
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	log.Printf("lausche auf %s, Daten in %s", srv.Addr, dataDir)
	log.Fatal(srv.ListenAndServe())
}

func (s *server) handleList(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.list(listLimit)
	if err != nil {
		log.Printf("list: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *server) handleCreate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	if err := r.ParseMultipartForm(maxMemoryParts); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "Zu groß – maximal 12 MB insgesamt")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid", "Ungültige Anfrage")
		return
	}
	defer r.MultipartForm.RemoveAll()

	// Honeypot: Menschen sehen das Feld nicht, Bots fuellen es aus.
	if r.FormValue("website") != "" {
		writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	message := strings.TrimSpace(r.FormValue("message"))
	if !validText(name, maxName) || !validText(message, maxMessage) {
		writeError(w, http.StatusBadRequest, "text", "Name (max. 40) und Nachricht (max. 500 Zeichen) ausfüllen")
		return
	}
	files := r.MultipartForm.File["images"]
	if len(files) > maxImages {
		writeError(w, http.StatusBadRequest, "too_many_images", "Maximal 3 Bilder")
		return
	}

	now := time.Now()
	if !s.allowPost(clientIP(r), now) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Bitte kurz warten, bevor du noch einen Eintrag schreibst")
		return
	}
	if len(files) > 0 {
		n, err := s.store.imagesSince(now.Add(-24 * time.Hour).Unix())
		if err != nil {
			log.Printf("imagesSince: %v", err)
			writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
			return
		}
		if n+len(files) > dailyImageCap {
			writeError(w, http.StatusTooManyRequests, "daily_images", "Heute wurden schon sehr viele Bilder hochgeladen – probier es morgen nochmal")
			return
		}
	}

	var saved []savedImage
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			removeImages(s.imageDir, saved)
			writeError(w, http.StatusBadRequest, "bad_image", "Bild konnte nicht gelesen werden")
			return
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			removeImages(s.imageDir, saved)
			writeError(w, http.StatusBadRequest, "bad_image", "Bild konnte nicht gelesen werden")
			return
		}
		img, err := processImage(data, s.imageDir)
		if err != nil {
			removeImages(s.imageDir, saved)
			if errors.Is(err, errBadImage) {
				writeError(w, http.StatusBadRequest, "bad_image", "Bildformat nicht unterstützt (JPEG, PNG oder WebP)")
			} else {
				log.Printf("processImage: %v", err)
				writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
			}
			return
		}
		saved = append(saved, img)
	}

	if err := s.store.insert(name, message, now.Unix(), saved); err != nil {
		removeImages(s.imageDir, saved)
		log.Printf("insert: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (s *server) handleDelete(w http.ResponseWriter, r *http.Request) {
	token := []byte(r.Header.Get("X-Admin-Token"))
	if subtle.ConstantTimeCompare(token, s.adminToken) != 1 {
		writeError(w, http.StatusForbidden, "forbidden", "Nicht erlaubt")
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	found, imgs, err := s.store.delete(id)
	if err != nil {
		log.Printf("delete: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	removeImages(s.imageDir, imgs)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleImage(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if !imgName.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(s.imageDir, name)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}

// allowPost erlaubt pro IP einen Eintrag je postInterval.
func (s *server) allowPost(ip string, now time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.lastPost) > 1000 {
		for k, t := range s.lastPost {
			if now.Sub(t) > postInterval {
				delete(s.lastPost, k)
			}
		}
	}
	if t, ok := s.lastPost[ip]; ok && now.Sub(t) < postInterval {
		return false
	}
	s.lastPost[ip] = now
	return true
}

// clientIP: palbuddies.behringer.dev laeuft ueber den Cloudflare-Proxy, der
// edge-nginx reicht dessen CF-Connecting-IP durch.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func validText(s string, maxLen int) bool {
	return s != "" && utf8.ValidString(s) && utf8.RuneCountInString(s) <= maxLen
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError: code ist fuer das Frontend (uebersetzbar), error die deutsche
// Klartextmeldung.
func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]string{"error": msg, "code": code})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
