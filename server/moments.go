package main

import (
	"errors"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// "Unterwegs": Fotos von unterwegs, hochladen und loeschen nur mit Admin-Token.
// Die Bilder laufen durch dieselbe Verarbeitung wie im Gaestebuch
// (processImage) und liegen im selben Ordner.

const (
	momentsLimit    = 50
	maxMomentImages = 6
	maxCaption      = 300
	maxPlace        = 60
	maxStation      = 60
)

func (s *server) handleMoments(w http.ResponseWriter, r *http.Request) {
	moments, err := s.store.listMoments(momentsLimit)
	if err != nil {
		log.Printf("listMoments: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	writeJSON(w, http.StatusOK, moments)
}

func (s *server) handleCreateMoment(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeError(w, http.StatusForbidden, "forbidden", "Nicht erlaubt")
		return
	}
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

	m := newMoment{
		Caption: strings.TrimSpace(r.FormValue("caption")),
		Place:   strings.TrimSpace(r.FormValue("place")),
		Station: strings.TrimSpace(r.FormValue("station")),
		Created: time.Now().Unix(),
	}
	if !validText(m.Caption, maxCaption) ||
		(m.Place != "" && !validText(m.Place, maxPlace)) ||
		(m.Station != "" && !validText(m.Station, maxStation)) {
		writeError(w, http.StatusBadRequest, "moment_text", "Bildunterschrift (max. 300 Zeichen) ausfüllen")
		return
	}
	lat, lon, ok := parseCoords(r.FormValue("lat"), r.FormValue("lon"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid", "Ungültige Position")
		return
	}
	m.Lat, m.Lon = lat, lon
	if v := r.FormValue("taken"); v != "" {
		// Aufnahmezeit aus EXIF; Unsinn (Kamera-Uhr falsch) wird ignoriert
		if t, err := strconv.ParseInt(v, 10, 64); err == nil && t > 946684800 && t < m.Created+86400 {
			m.Taken = &t
		}
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 || len(files) > maxMomentImages {
		writeError(w, http.StatusBadRequest, "moment_images", "1 bis 6 Fotos")
		return
	}
	saved, ok := s.saveUploads(w, files)
	if !ok {
		return
	}
	if err := s.store.insertMoment(m, saved); err != nil {
		removeImages(s.imageDir, saved)
		log.Printf("insertMoment: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

// parseCoords: beide leer = keine Position; sonst muessen beide gueltig sein.
// Gerundet auf 4 Nachkommastellen (gut 10 m).
func parseCoords(la, lo string) (lat, lon *float64, ok bool) {
	if la == "" && lo == "" {
		return nil, nil, true
	}
	a, err1 := strconv.ParseFloat(la, 64)
	b, err2 := strconv.ParseFloat(lo, 64)
	if err1 != nil || err2 != nil || math.IsNaN(a) || math.IsNaN(b) ||
		a < -90 || a > 90 || b < -180 || b > 180 {
		return nil, nil, false
	}
	a = math.Round(a*1e4) / 1e4
	b = math.Round(b*1e4) / 1e4
	return &a, &b, true
}

func (s *server) handleDeleteMoment(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeError(w, http.StatusForbidden, "forbidden", "Nicht erlaubt")
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	found, imgs, err := s.store.deleteMoment(id)
	if err != nil {
		log.Printf("deleteMoment: %v", err)
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
