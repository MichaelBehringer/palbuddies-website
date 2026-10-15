package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDeeplTarget(t *testing.T) {
	cases := map[string]string{
		"de-DE": "DE", "de-AT": "DE", "de": "DE",
		"en-US": "EN-US", "en-GB": "EN-GB", "en": "EN-US",
		"pt-BR": "PT-BR", "pt-PT": "PT-PT",
		"zh-CN": "ZH-HANS", "zh-TW": "ZH-HANT", "zh-Hant-TW": "ZH-HANT",
		"ja-JP": "JA", "fr": "FR", "nb-NO": "NB",
		"xx-YY": "EN-US", "": "EN-US",
	}
	for in, want := range cases {
		if got := deeplTarget(in); got != want {
			t.Errorf("deeplTarget(%q) = %q, want %q", in, got, want)
		}
	}
}

// fakeDeepL antwortet wie DeepL und zaehlt die Aufrufe.
func fakeDeepL(t *testing.T, calls *atomic.Int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Header.Get("Authorization") != "DeepL-Auth-Key test-key" {
			t.Errorf("Auth-Header fehlt: %q", r.Header.Get("Authorization"))
		}
		var req struct {
			Text   []string `json:"text"`
			Target string   `json:"target_lang"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		json.NewEncoder(w).Encode(map[string]any{"translations": []map[string]string{
			{"detected_source_language": "DE", "text": "[" + req.Target + "] " + req.Text[0]},
		}})
	}))
}

func newTestServer(t *testing.T, deeplURL string) *server {
	st, err := openStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("DEEPL_API_URL", deeplURL)
	return &server{
		store: st, translator: newTranslator("test-key"),
		lastPost: map[string]time.Time{}, translateLog: map[string][]time.Time{},
	}
}

func translateReq(t *testing.T, s *server, id, lang string) (int, translateResponse) {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/guestbook/{id}/translate", s.handleTranslate)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/guestbook/"+id+"/translate", strings.NewReader(`{"lang":"`+lang+`"}`))
	mux.ServeHTTP(rec, req)
	var out translateResponse
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestTranslateCachesPerLanguage(t *testing.T) {
	var calls atomic.Int32
	deepl := fakeDeepL(t, &calls)
	defer deepl.Close()
	s := newTestServer(t, deepl.URL)
	if err := s.store.insert("Berry", "Hallo zusammen", time.Now().Unix(), nil); err != nil {
		t.Fatal(err)
	}

	code, out := translateReq(t, s, "1", "en-US")
	if code != 200 || out.Text != "[EN-US] Hallo zusammen" || out.Source != "DE" || out.Same {
		t.Fatalf("erste Uebersetzung: %d %+v", code, out)
	}
	// gleiche Sprache (auch andere Schreibweise) -> aus der DB, kein DeepL-Aufruf
	translateReq(t, s, "1", "en-US")
	translateReq(t, s, "1", "en")
	if n := calls.Load(); n != 1 {
		t.Fatalf("DeepL %d-mal gefragt, erwartet 1", n)
	}
	// neue Sprache -> neuer Aufruf, DB wird erweitert
	if _, out := translateReq(t, s, "1", "ja-JP"); out.Text != "[JA] Hallo zusammen" {
		t.Fatalf("japanisch: %+v", out)
	}
	if n := calls.Load(); n != 2 {
		t.Fatalf("DeepL %d-mal gefragt, erwartet 2", n)
	}
	// Ausgangssprache = Zielsprache -> Original, als "same" markiert, gecacht
	if _, out := translateReq(t, s, "1", "de-DE"); !out.Same || out.Text != "Hallo zusammen" {
		t.Fatalf("deutsch: %+v", out)
	}
	translateReq(t, s, "1", "de-AT")
	if n := calls.Load(); n != 3 {
		t.Fatalf("DeepL %d-mal gefragt, erwartet 3", n)
	}

	// Loeschen entfernt auch die Uebersetzungen
	if found, _, err := s.store.delete(1); err != nil || !found {
		t.Fatal("delete", err)
	}
	var n int
	s.store.db.QueryRow(`SELECT COUNT(*) FROM translations`).Scan(&n)
	if n != 0 {
		t.Fatalf("%d Uebersetzungen nach dem Loeschen uebrig", n)
	}
	if code, _ := translateReq(t, s, "1", "en"); code != 404 {
		t.Fatalf("geloeschter Eintrag: %d, erwartet 404", code)
	}
}

func TestTranslateDailyCap(t *testing.T) {
	var calls atomic.Int32
	deepl := fakeDeepL(t, &calls)
	defer deepl.Close()
	t.Setenv("TRANSLATE_DAILY_CHARS", "20")
	s := newTestServer(t, deepl.URL)
	s.store.insert("A", "zehn Zeich", time.Now().Unix(), nil) // 10 Zeichen
	if code, _ := translateReq(t, s, "1", "en"); code != 200 {
		t.Fatalf("1. Uebersetzung: %d", code)
	}
	if code, _ := translateReq(t, s, "1", "fr"); code != 200 {
		t.Fatalf("2. Uebersetzung: %d", code)
	}
	if code, _ := translateReq(t, s, "1", "es"); code != 429 {
		t.Fatalf("3. Uebersetzung ueber Tageslimit: %d, erwartet 429", code)
	}
	// Gecachtes geht trotz Limit weiter
	if code, _ := translateReq(t, s, "1", "en"); code != 200 {
		t.Fatalf("gecacht trotz Limit: %d", code)
	}
}

func TestTranslateWithoutKey(t *testing.T) {
	st, _ := openStore(t.TempDir())
	s := &server{store: st, lastPost: map[string]time.Time{}, translateLog: map[string][]time.Time{}}
	s.store.insert("A", "Hallo", time.Now().Unix(), nil)
	if code, _ := translateReq(t, s, "1", "en"); code != 503 {
		t.Fatalf("ohne Schluessel: %d, erwartet 503", code)
	}
}
