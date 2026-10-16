package main

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

// Erlaubte Reaktionen. Neue Emojis auch in web/guestbook.js (REACTIONS) eintragen.
var reactionEmojis = map[string]bool{"❤️": true, "😂": true, "🔥": true, "🍜": true}

var voterID = regexp.MustCompile(`^[0-9a-f]{32}$`)

// Klicks (an oder aus) pro IP und Stunde
const reactPerHour = 120

func (s *server) handleReact(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	var req struct {
		Emoji string `json:"emoji"`
		Voter string `json:"voter"`
		On    bool   `json:"on"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&req); err != nil ||
		!reactionEmojis[req.Emoji] || !voterID.MatchString(req.Voter) {
		writeError(w, http.StatusBadRequest, "invalid", "Ungültige Anfrage")
		return
	}
	now := time.Now()
	if !s.allowN(s.reactLog, clientIP(r), now, reactPerHour) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Bitte kurz warten und nochmal versuchen")
		return
	}
	counts, found, err := s.store.react(id, req.Emoji, req.Voter, req.On, now.Unix())
	if err != nil {
		log.Printf("react: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reactions": counts})
}
