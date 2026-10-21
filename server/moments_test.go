package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func momentMux(s *server) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/guestbook/moments", s.handleMoments)
	mux.HandleFunc("POST /api/guestbook/moments", s.handleCreateMoment)
	mux.HandleFunc("DELETE /api/guestbook/moments/{id}", s.handleDeleteMoment)
	return mux
}

func momentForm(t *testing.T, fields map[string]string, images int) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		mw.WriteField(k, v)
	}
	for i := 0; i < images; i++ {
		fw, _ := mw.CreateFormFile("images", "bild.png")
		png.Encode(fw, image.NewRGBA(image.Rect(0, 0, 20, 10)))
	}
	mw.Close()
	return &buf, mw.FormDataContentType()
}

func postMoment(t *testing.T, s *server, token string, fields map[string]string, images int) int {
	t.Helper()
	body, ct := momentForm(t, fields, images)
	req := httptest.NewRequest("POST", "/api/guestbook/moments", body)
	req.Header.Set("Content-Type", ct)
	if token != "" {
		req.Header.Set("X-Admin-Token", token)
	}
	rec := httptest.NewRecorder()
	momentMux(s).ServeHTTP(rec, req)
	return rec.Code
}

func listMoments(t *testing.T, s *server) []momentJSON {
	t.Helper()
	rec := httptest.NewRecorder()
	momentMux(s).ServeHTTP(rec, httptest.NewRequest("GET", "/api/guestbook/moments", nil))
	var out []momentJSON
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func countFiles(t *testing.T, dir string) int {
	t.Helper()
	files, _ := filepath.Glob(filepath.Join(dir, "*.jpg"))
	return len(files)
}

func TestMomentCreateListDelete(t *testing.T) {
	s := newTestServer(t, "")
	s.imageDir = t.TempDir()

	fields := map[string]string{
		"caption": "Fushimi Inari bei Sonnenaufgang", "station": "Kyoto", "place": "Fushimi Inari",
		"lat": "34.967146", "lon": "135.772673", "taken": "1792000000",
	}
	if code := postMoment(t, s, "", fields, 1); code != http.StatusForbidden {
		t.Fatalf("ohne Token: code %d", code)
	}
	if code := postMoment(t, s, "falsch", fields, 1); code != http.StatusForbidden {
		t.Fatalf("falsches Token: code %d", code)
	}
	if code := postMoment(t, s, testAdminToken, fields, 2); code != http.StatusCreated {
		t.Fatalf("anlegen: code %d", code)
	}

	ms := listMoments(t, s)
	if len(ms) != 1 || len(ms[0].Images) != 2 {
		t.Fatalf("list: %+v", ms)
	}
	m := ms[0]
	if m.Lat == nil || *m.Lat != 34.9671 || *m.Lon != 135.7727 || m.Taken == nil || m.Station != "Kyoto" {
		t.Errorf("Felder: %+v", m)
	}
	if n := countFiles(t, s.imageDir); n != 4 {
		t.Errorf("%d Dateien, want 4 (2 Bilder + 2 Vorschauen)", n)
	}

	del := func(token string) int {
		req := httptest.NewRequest("DELETE", "/api/guestbook/moments/1", nil)
		req.Header.Set("X-Admin-Token", token)
		rec := httptest.NewRecorder()
		momentMux(s).ServeHTTP(rec, req)
		return rec.Code
	}
	if code := del("falsch"); code != http.StatusForbidden {
		t.Errorf("loeschen ohne Token: code %d", code)
	}
	if code := del(testAdminToken); code != http.StatusNoContent {
		t.Fatalf("loeschen: code %d", code)
	}
	if code := del(testAdminToken); code != http.StatusNotFound {
		t.Errorf("nochmal loeschen: code %d", code)
	}
	if n := countFiles(t, s.imageDir); n != 0 {
		t.Errorf("nach dem Loeschen noch %d Dateien", n)
	}
}

func TestMomentRejectsBadInput(t *testing.T) {
	s := newTestServer(t, "")
	s.imageDir = t.TempDir()
	ok := map[string]string{"caption": "Hallo", "station": "Osaka"}
	with := func(k, v string) map[string]string {
		f := map[string]string{}
		for a, b := range ok {
			f[a] = b
		}
		f[k] = v
		return f
	}
	cases := map[string]struct {
		fields map[string]string
		images int
	}{
		"ohne Bild":         {ok, 0},
		"zu viele Bilder":   {ok, maxMomentImages + 1},
		"ohne Unterschrift": {with("caption", " "), 1},
		"lat ausserhalb":    {with("lat", "91"), 1},
		"nur lat":           {with("lat", "34.1"), 1},
		"lon keine Zahl":    {map[string]string{"caption": "x", "lat": "1", "lon": "NaN"}, 1},
	}
	for name, c := range cases {
		if code := postMoment(t, s, testAdminToken, c.fields, c.images); code != http.StatusBadRequest {
			t.Errorf("%s: code %d, want 400", name, code)
		}
	}
	if n := countFiles(t, s.imageDir); n != 0 {
		t.Errorf("%d Dateien liegen geblieben", n)
	}
	// Unsinnige Aufnahmezeit wird ignoriert, nicht abgelehnt
	if code := postMoment(t, s, testAdminToken, with("taken", "42"), 1); code != http.StatusCreated {
		t.Fatalf("taken=42: code %d", code)
	}
	if ms := listMoments(t, s); ms[0].Taken != nil {
		t.Errorf("taken = %v, want nil", *ms[0].Taken)
	}
	os.RemoveAll(s.imageDir)
}
