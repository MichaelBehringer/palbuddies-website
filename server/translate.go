package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// Zielsprachen, die DeepL kennt. Alles andere wird auf Englisch uebersetzt.
var deeplTargets = map[string]bool{
	"AR": true, "BG": true, "CS": true, "DA": true, "DE": true, "EL": true,
	"EN-GB": true, "EN-US": true, "ES": true, "ET": true, "FI": true, "FR": true,
	"HE": true, "HU": true, "ID": true, "IT": true, "JA": true, "KO": true,
	"LT": true, "LV": true, "NB": true, "NL": true, "PL": true, "PT-BR": true,
	"PT-PT": true, "RO": true, "RU": true, "SK": true, "SL": true, "SV": true,
	"TH": true, "TR": true, "UK": true, "VI": true, "ZH-HANS": true, "ZH-HANT": true,
}

// deeplTarget macht aus einer Browsersprache ("de-AT", "en-GB", "zh-TW" ...)
// einen DeepL-Zielsprachcode.
func deeplTarget(browserLang string) string {
	l := strings.ToLower(strings.TrimSpace(browserLang))
	l = strings.ReplaceAll(l, "_", "-")
	parts := strings.Split(l, "-")
	primary := parts[0]
	// has prueft die Unterangaben, z. B. "zh-Hant-TW" -> hant, tw
	has := func(tags ...string) bool {
		for _, p := range parts[1:] {
			for _, t := range tags {
				if p == t {
					return true
				}
			}
		}
		return false
	}
	switch primary {
	case "en":
		if has("gb", "ie", "au", "nz") {
			return "EN-GB"
		}
		return "EN-US"
	case "pt":
		if has("br") {
			return "PT-BR"
		}
		return "PT-PT"
	case "zh":
		if has("hant", "tw", "hk", "mo") {
			return "ZH-HANT"
		}
		return "ZH-HANS"
	case "no", "nn":
		return "NB"
	case "iw":
		return "HE"
	}
	code := strings.ToUpper(primary)
	if deeplTargets[code] {
		return code
	}
	return "EN-US"
}

type translator struct {
	key      string
	url      string
	client   *http.Client
	mu       sync.Mutex // nur eine Anfrage gleichzeitig, verhindert Doppeluebersetzungen
	dailyCap int
}

func newTranslator(key string) *translator {
	if key == "" {
		return nil
	}
	url := envOr("DEEPL_API_URL", "")
	if url == "" {
		// Free-/Developer-Schluessel enden auf ":fx" und laufen ueber api-free
		url = "https://api.deepl.com/v2/translate"
		if strings.HasSuffix(key, ":fx") {
			url = "https://api-free.deepl.com/v2/translate"
		}
	}
	dailyCap, err := strconv.Atoi(envOr("TRANSLATE_DAILY_CHARS", "50000"))
	if err != nil {
		dailyCap = 50000
	}
	return &translator{key: key, url: url, client: &http.Client{Timeout: 15 * time.Second}, dailyCap: dailyCap}
}

func (t *translator) translate(ctx context.Context, text, target string) (translation, error) {
	body, _ := json.Marshal(map[string]any{
		"text":                []string{text},
		"target_lang":         target,
		"preserve_formatting": true,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.url, bytes.NewReader(body))
	if err != nil {
		return translation{}, err
	}
	req.Header.Set("Authorization", "DeepL-Auth-Key "+t.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.client.Do(req)
	if err != nil {
		return translation{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return translation{}, fmt.Errorf("deepl: status %d", resp.StatusCode)
	}
	var out struct {
		Translations []struct {
			DetectedSourceLanguage string `json:"detected_source_language"`
			Text                   string `json:"text"`
		} `json:"translations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return translation{}, err
	}
	if len(out.Translations) == 0 {
		return translation{}, errors.New("deepl: leere Antwort")
	}
	return translation{Source: out.Translations[0].DetectedSourceLanguage, Text: out.Translations[0].Text}, nil
}

type translateResponse struct {
	Text   string `json:"text"`
	Source string `json:"source"` // erkannte Ausgangssprache, z. B. "EN"
	Target string `json:"target"`
	Same   bool   `json:"same"` // Text war schon in der Zielsprache
}

func sameLanguage(source, target string) bool {
	s, _, _ := strings.Cut(strings.ToUpper(source), "-")
	t, _, _ := strings.Cut(strings.ToUpper(target), "-")
	return s == t
}

func (s *server) handleTranslate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	var req struct {
		Lang string `json:"lang"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<10)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Lang == "" {
		writeError(w, http.StatusBadRequest, "invalid", "Ungültige Anfrage")
		return
	}
	target := deeplTarget(req.Lang)

	// 1) schon uebersetzt? Dann direkt aus der DB.
	if t, ok, err := s.store.translation(id, target); err != nil {
		log.Printf("translation: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	} else if ok {
		writeJSON(w, http.StatusOK, translateResponse{Text: t.Text, Source: t.Source, Target: target, Same: sameLanguage(t.Source, target)})
		return
	}

	msg, ok, err := s.store.message(id)
	if err != nil {
		log.Printf("message: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "Nicht gefunden")
		return
	}
	if s.translator == nil {
		writeError(w, http.StatusServiceUnavailable, "translate_unavailable", "Übersetzung gerade nicht verfügbar")
		return
	}

	// 2) Neue Uebersetzung: nur eine gleichzeitig, danach nochmal in der DB
	// nachsehen, falls eine parallele Anfrage sie gerade angelegt hat.
	s.translator.mu.Lock()
	defer s.translator.mu.Unlock()
	if t, ok, err := s.store.translation(id, target); err == nil && ok {
		writeJSON(w, http.StatusOK, translateResponse{Text: t.Text, Source: t.Source, Target: target, Same: sameLanguage(t.Source, target)})
		return
	}

	now := time.Now()
	if !s.allowTranslate(clientIP(r), now) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Bitte kurz warten")
		return
	}
	chars := utf8.RuneCountInString(msg)
	used, err := s.store.translatedCharsSince(now.Add(-24 * time.Hour).Unix())
	if err != nil {
		log.Printf("translatedCharsSince: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "Interner Fehler")
		return
	}
	if used+chars > s.translator.dailyCap {
		writeError(w, http.StatusTooManyRequests, "translate_daily", "Für heute sind keine Übersetzungen mehr frei")
		return
	}

	t, err := s.translator.translate(r.Context(), msg, target)
	if err != nil {
		log.Printf("deepl: %v", err)
		writeError(w, http.StatusBadGateway, "translate_failed", "Übersetzung fehlgeschlagen")
		return
	}
	if sameLanguage(t.Source, target) {
		t.Text = msg // schon in der Zielsprache: Original speichern
	}
	if err := s.store.saveTranslation(id, target, t, chars, now.Unix()); err != nil {
		log.Printf("saveTranslation: %v", err)
	}
	writeJSON(w, http.StatusOK, translateResponse{Text: t.Text, Source: t.Source, Target: target, Same: sameLanguage(t.Source, target)})
}

// allowTranslate: hoechstens translatePerHour neue (nicht gecachte)
// Uebersetzungen pro IP und Stunde.
func (s *server) allowTranslate(ip string, now time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := now.Add(-time.Hour)
	recent := s.translateLog[ip][:0]
	for _, t := range s.translateLog[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= translatePerHour {
		s.translateLog[ip] = recent
		return false
	}
	s.translateLog[ip] = append(recent, now)
	if len(s.translateLog) > 1000 {
		for k, ts := range s.translateLog {
			if len(ts) == 0 || ts[len(ts)-1].Before(cutoff) {
				delete(s.translateLog, k)
			}
		}
	}
	return true
}
