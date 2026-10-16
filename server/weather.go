package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

const (
	weatherTTL      = 30 * time.Minute
	weatherMaxCache = 50
)

type weatherJSON struct {
	Temp float64 `json:"temp"`
	Code int     `json:"code"` // WMO-Wettercode
	Day  bool    `json:"day"`
}

type weatherEntry struct {
	data    weatherJSON
	fetched time.Time
}

// weatherCache fragt Open-Meteo (ohne API-Key) ueber den Server statt aus dem
// Browser: die IPs der Besucher gehen so nicht an Dritte, und pro Ort gibt es
// hoechstens eine Anfrage je weatherTTL.
type weatherCache struct {
	url    string
	client *http.Client
	mu     sync.Mutex // eine Anfrage gleichzeitig, sonst fragen viele Besucher parallel
	cache  map[string]weatherEntry
}

func newWeatherCache() *weatherCache {
	return &weatherCache{
		url:    envOr("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast"),
		client: &http.Client{Timeout: 5 * time.Second},
		cache:  map[string]weatherEntry{},
	}
}

func (c *weatherCache) get(ctx context.Context, lat, lon float64, now time.Time) (weatherJSON, error) {
	// auf 2 Nachkommastellen (gut 1 km) gerundet, das ist auch der Cache-Schluessel
	la, lo := fmt.Sprintf("%.2f", lat), fmt.Sprintf("%.2f", lon)
	key := la + "," + lo
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.cache[key]; ok && now.Sub(e.fetched) < weatherTTL {
		return e.data, nil
	}
	data, err := c.fetch(ctx, la, lo)
	if err != nil {
		return weatherJSON{}, err
	}
	if len(c.cache) >= weatherMaxCache {
		var oldest string
		for k, e := range c.cache {
			if oldest == "" || e.fetched.Before(c.cache[oldest].fetched) {
				oldest = k
			}
		}
		delete(c.cache, oldest)
	}
	c.cache[key] = weatherEntry{data: data, fetched: now}
	return data, nil
}

func (c *weatherCache) fetch(ctx context.Context, lat, lon string) (weatherJSON, error) {
	q := url.Values{
		"latitude":  {lat},
		"longitude": {lon},
		"current":   {"temperature_2m,weather_code,is_day"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"?"+q.Encode(), nil)
	if err != nil {
		return weatherJSON{}, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return weatherJSON{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return weatherJSON{}, fmt.Errorf("open-meteo: status %d", resp.StatusCode)
	}
	var out struct {
		Current *struct {
			Temp  float64 `json:"temperature_2m"`
			Code  int     `json:"weather_code"`
			IsDay int     `json:"is_day"`
		} `json:"current"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return weatherJSON{}, err
	}
	if out.Current == nil {
		return weatherJSON{}, fmt.Errorf("open-meteo: keine Daten")
	}
	return weatherJSON{Temp: out.Current.Temp, Code: out.Current.Code, Day: out.Current.IsDay == 1}, nil
}

func parseCoord(s string, limit float64) (float64, bool) {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsNaN(v) || math.Abs(v) > limit {
		return 0, false
	}
	return v, true
}

func (s *server) handleWeather(w http.ResponseWriter, r *http.Request) {
	lat, ok1 := parseCoord(r.URL.Query().Get("lat"), 90)
	lon, ok2 := parseCoord(r.URL.Query().Get("lon"), 180)
	if !ok1 || !ok2 {
		writeError(w, http.StatusBadRequest, "invalid", "Ungültige Anfrage")
		return
	}
	data, err := s.weather.get(r.Context(), lat, lon, time.Now())
	if err != nil {
		log.Printf("weather: %v", err)
		writeError(w, http.StatusBadGateway, "weather_unavailable", "Wetter gerade nicht verfügbar")
		return
	}
	writeJSON(w, http.StatusOK, data)
}
