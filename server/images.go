package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	fullSide  = 1600
	thumbSide = 400
	// Schutz gegen Dekompressionsbomben: 25 MP entsprechen ~100 MB RGBA im
	// Speicher. Der Browser verkleinert ohnehin vorher auf 1600 px.
	maxPixels = 25_000_000
)

var errBadImage = errors.New("bild ungueltig")

// Nur ein Bild gleichzeitig verarbeiten, damit parallele Uploads den
// Speicher nicht sprengen.
var imageSem = make(chan struct{}, 1)

type savedImage struct {
	File  string
	Thumb string
	W, H  int
}

// processImage prueft ein hochgeladenes Bild, verkleinert es und speichert
// Vollbild und Vorschau als frisch kodiertes JPEG. Dadurch fallen alle
// Metadaten (EXIF, GPS ...) weg und ausgeliefert wird nur, was der Server
// selbst erzeugt hat.
func processImage(data []byte, dir string) (savedImage, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return savedImage{}, errBadImage
	}
	switch format {
	case "jpeg", "png", "webp":
	default:
		return savedImage{}, errBadImage
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxPixels {
		return savedImage{}, errBadImage
	}

	imageSem <- struct{}{}
	defer func() { <-imageSem }()

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return savedImage{}, errBadImage
	}

	name, err := randomName()
	if err != nil {
		return savedImage{}, err
	}
	img := savedImage{File: name + ".jpg", Thumb: name + "_t.jpg"}

	full := scale(src, fullSide)
	img.W, img.H = full.Bounds().Dx(), full.Bounds().Dy()
	if err := writeJPEG(filepath.Join(dir, img.File), full, 80); err != nil {
		return savedImage{}, err
	}
	if err := writeJPEG(filepath.Join(dir, img.Thumb), scale(full, thumbSide), 75); err != nil {
		os.Remove(filepath.Join(dir, img.File))
		return savedImage{}, err
	}
	return img, nil
}

// scale verkleinert auf hoechstens maxSide Pixel an der laengeren Seite und
// legt das Bild auf weissen Hintergrund (Transparenz gibt es in JPEG nicht).
func scale(src image.Image, maxSide int) *image.RGBA {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > maxSide || h > maxSide {
		if w >= h {
			h = max(1, h*maxSide/w)
			w = maxSide
		} else {
			w = max(1, w*maxSide/h)
			h = maxSide
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

func writeJPEG(path string, img image.Image, quality int) error {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func randomName() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func removeImages(dir string, imgs []savedImage) {
	for _, img := range imgs {
		os.Remove(filepath.Join(dir, img.File))
		os.Remove(filepath.Join(dir, img.Thumb))
	}
}
