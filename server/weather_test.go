package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func fakeOpenMeteo(t *testing.T, calls *atomic.Int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if got := r.URL.Query().Get("latitude"); got != "34.69" {
			t.Errorf("latitude = %q", got)
		}
		w.Write([]byte(`{"current":{"temperature_2m":18.4,"weather_code":3,"is_day":1}}`))
	}))
}

func weatherReq(t *testing.T, s *server, query string) (int, weatherJSON) {
	t.Helper()
	rec := httptest.NewRecorder()
	s.handleWeather(rec, httptest.NewRequest("GET", "/api/guestbook/weather?"+query, nil))
	var out weatherJSON
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestWeatherCaches(t *testing.T) {
	var calls atomic.Int32
	fake := fakeOpenMeteo(t, &calls)
	defer fake.Close()
	t.Setenv("WEATHER_API_URL", fake.URL)
	s := newTestServer(t, "")

	for i := 0; i < 3; i++ {
		code, w := weatherReq(t, s, "lat=34.6912&lon=135.50")
		if code != http.StatusOK || w != (weatherJSON{Temp: 18.4, Code: 3, Day: true}) {
			t.Fatalf("code %d, %+v", code, w)
		}
	}
	if calls.Load() != 1 {
		t.Errorf("Open-Meteo %d-mal gefragt, want 1", calls.Load())
	}
}

func TestWeatherRejectsBadCoords(t *testing.T) {
	s := newTestServer(t, "")
	for _, q := range []string{"", "lat=91&lon=0", "lat=0&lon=181", "lat=abc&lon=1", "lat=NaN&lon=1"} {
		if code, _ := weatherReq(t, s, q); code != http.StatusBadRequest {
			t.Errorf("%q: code %d, want 400", q, code)
		}
	}
}

func TestWeatherUpstreamError(t *testing.T) {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "kaputt", http.StatusInternalServerError)
	}))
	defer fake.Close()
	t.Setenv("WEATHER_API_URL", fake.URL)
	s := newTestServer(t, "")
	if code, _ := weatherReq(t, s, "lat=34.69&lon=135.5"); code != http.StatusBadGateway {
		t.Errorf("code %d, want 502", code)
	}
}
