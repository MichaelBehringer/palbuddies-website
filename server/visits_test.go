package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const (
	testAdminToken = "test-admin-token-123456"
	testUA         = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
)

func visitReq(t *testing.T, s *server, voter, country, ua string, header http.Header) {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"voter": voter})
	req := httptest.NewRequest("POST", "/api/guestbook/visit", strings.NewReader(string(body)))
	req.Header.Set("User-Agent", ua)
	req.Header.Set("CF-IPCountry", country)
	for k, v := range header {
		req.Header[k] = v
	}
	rec := httptest.NewRecorder()
	s.handleVisit(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("visit: code %d", rec.Code)
	}
}

func getStats(t *testing.T, s *server) statsJSON {
	t.Helper()
	rec := httptest.NewRecorder()
	s.handleStats(rec, httptest.NewRequest("GET", "/api/guestbook/stats", nil))
	var out statsJSON
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("stats: %v (%s)", err, rec.Body)
	}
	return out
}

func TestVisitsCountOncePerDevice(t *testing.T) {
	s := newTestServer(t, "")
	other := strings.Repeat("f", 32)

	visitReq(t, s, testVoter, "DE", testUA, nil)
	visitReq(t, s, testVoter, "DE", testUA, nil) // Reload zaehlt nicht
	visitReq(t, s, other, "JP", testUA, nil)
	visitReq(t, s, "kaputt", "XX", testUA, nil) // ohne gueltige ID: Fallback, Land unbekannt

	st := getStats(t, s)
	if st.Today != 3 || st.Total != 3 {
		t.Fatalf("today %d, total %d, want 3/3", st.Today, st.Total)
	}
	if len(st.Countries) != 2 || st.Others != 1 {
		t.Fatalf("countries %v, others %d", st.Countries, st.Others)
	}

	// Gestern schon da gewesen: zaehlt gesamt nur einmal
	hash := func() string {
		var h string
		s.store.db.QueryRow(`SELECT visitor FROM visits WHERE country = 'DE'`).Scan(&h)
		return h
	}()
	yesterday := time.Now().In(berlin).AddDate(0, 0, -1).Format("2006-01-02")
	if _, err := s.store.addVisit(yesterday, hash, "DE"); err != nil {
		t.Fatal(err)
	}
	s.stats.invalidate()
	if st := getStats(t, s); st.Today != 3 || st.Total != 3 || st.Countries[0] != (countryJSON{"DE", 1}) {
		t.Errorf("mit gestern: %+v", st)
	}
}

func TestVisitsSkipBotsAndAdmins(t *testing.T) {
	s := newTestServer(t, "")
	visitReq(t, s, testVoter, "DE", "Googlebot/2.1 (+http://www.google.com/bot.html)", nil)
	visitReq(t, s, testVoter, "DE", "", nil)
	visitReq(t, s, testVoter, "DE", testUA, http.Header{"X-Admin-Token": {testAdminToken}})
	if st := getStats(t, s); st.Today != 0 {
		t.Errorf("today = %d, want 0", st.Today)
	}
}

func TestCountryHeader(t *testing.T) {
	for in, want := range map[string]string{"DE": "DE", "jp": "JP", "XX": "", "T1": "", "": "", "DEU": "", "<b>": ""} {
		r := httptest.NewRequest("GET", "/", nil)
		r.Header.Set("CF-IPCountry", in)
		if got := country(r); got != want {
			t.Errorf("country(%q) = %q, want %q", in, got, want)
		}
	}
}
