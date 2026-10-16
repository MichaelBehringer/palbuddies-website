package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const testVoter = "0123456789abcdef0123456789abcdef"

func reactReq(t *testing.T, s *server, id, body string) (int, map[string]int) {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/guestbook/{id}/react", s.handleReact)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("POST", "/api/guestbook/"+id+"/react", strings.NewReader(body)))
	var out struct {
		Reactions map[string]int `json:"reactions"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out.Reactions
}

func react(emoji, voter string, on bool) string {
	b, _ := json.Marshal(map[string]any{"emoji": emoji, "voter": voter, "on": on})
	return string(b)
}

func TestReactCountsOncePerVoter(t *testing.T) {
	s := newTestServer(t, "")
	if err := s.store.insert("Berry", "Hallo", time.Now().Unix(), nil); err != nil {
		t.Fatal(err)
	}
	other := strings.Repeat("f", 32)

	for _, step := range []struct {
		body string
		want int
	}{
		{react("🔥", testVoter, true), 1},
		{react("🔥", testVoter, true), 1}, // doppelt zaehlt nicht
		{react("🔥", other, true), 2},
		{react("🔥", testVoter, false), 1},
	} {
		code, counts := reactReq(t, s, "1", step.body)
		if code != http.StatusOK || counts["🔥"] != step.want {
			t.Fatalf("%s: code %d, counts %v, want 🔥=%d", step.body, code, counts, step.want)
		}
	}

	entries, err := s.store.list(10)
	if err != nil {
		t.Fatal(err)
	}
	if entries[0].Reactions["🔥"] != 1 {
		t.Errorf("list: Reactions = %v", entries[0].Reactions)
	}

	// Loeschen des Eintrags nimmt die Reaktionen mit
	if _, _, err := s.store.delete(1); err != nil {
		t.Fatal(err)
	}
	var n int
	s.store.db.QueryRow(`SELECT COUNT(*) FROM reactions`).Scan(&n)
	if n != 0 {
		t.Errorf("nach dem Loeschen noch %d Reaktionen", n)
	}
}

func TestReactRejectsBadInput(t *testing.T) {
	s := newTestServer(t, "")
	s.store.insert("Berry", "Hallo", time.Now().Unix(), nil)
	cases := map[string]struct {
		id, body string
		want     int
	}{
		"fremdes Emoji": {"1", react("💩", testVoter, true), http.StatusBadRequest},
		"falsche voter": {"1", react("🔥", "abc", true), http.StatusBadRequest},
		"kein JSON":     {"1", "nix", http.StatusBadRequest},
		"unbekannte ID": {"99", react("🔥", testVoter, true), http.StatusNotFound},
		"ID keine Zahl": {"x", react("🔥", testVoter, true), http.StatusNotFound},
	}
	for name, c := range cases {
		if code, _ := reactReq(t, s, c.id, c.body); code != c.want {
			t.Errorf("%s: code %d, want %d", name, code, c.want)
		}
	}
}

func TestReactRateLimit(t *testing.T) {
	s := newTestServer(t, "")
	s.store.insert("Berry", "Hallo", time.Now().Unix(), nil)
	for i := 0; i < reactPerHour; i++ {
		if code, _ := reactReq(t, s, "1", react("❤️", testVoter, i%2 == 0)); code != http.StatusOK {
			t.Fatalf("Klick %d: code %d", i, code)
		}
	}
	if code, _ := reactReq(t, s, "1", react("❤️", testVoter, true)); code != http.StatusTooManyRequests {
		t.Errorf("ueber dem Limit: code %d, want 429", code)
	}
}
