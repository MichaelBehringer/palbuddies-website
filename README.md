# PalBuddies

Website von palbuddies.behringer.dev mit Gästebuch.

```
web/      statische Website, wird vom edge-nginx (/root/edge) ausgeliefert
server/   Gästebuch-Backend in Go (Docker-Dienst "palbuddies-gb")
```

## Wie es zusammenhängt

- Der edge-nginx hängt `web/` read-only nach `/srv/www/palbuddies` ein
  (`/root/edge/docker-compose.yml`). Änderungen an `web/` sind sofort live,
  ohne Neustart.
- `/api/guestbook` reicht der edge-nginx an `palbuddies-gb:8000` im
  Docker-Netz `edge` durch (`/root/edge/conf.d/40-palbuddies.conf`).
- Daten liegen außerhalb des Repos in `/srv/palbuddies-data`:
  `guestbook.db` (SQLite) und `images/`.

## Backend bauen und starten

```sh
cd /root/palbuddies
docker compose up -d --build
docker compose logs -f
```

`.env` (nicht im Git, Rechte 600) enthält `ADMIN_TOKEN`, siehe `.env.example`.
Neues Token: `openssl rand -hex 16`, danach `docker compose up -d`.

Go muss auf dem Host nicht installiert sein. Abhängigkeiten aktualisieren:

```sh
docker run --rm -v "$PWD/server":/src -w /src golang:1.26-alpine go mod tidy
```

## Einträge löschen (Admin-Modus)

Die Seite einmal mit dem geheimen Link öffnen:

    https://palbuddies.behringer.dev/#admin=<ADMIN_TOKEN>

Das Token wird im Browser gespeichert und sofort aus der Adresszeile
entfernt; danach hat jeder Eintrag ein ✕. Abmelden mit `#admin=off`.

## Bilder

Bis zu 3 Bilder pro Eintrag. Der Browser verkleinert sie vor dem Upload auf
max. 1600 px (JPEG), der Server dekodiert jedes Bild neu und speichert es als
JPEG (1600 px) plus Vorschau (400 px). Dabei fallen alle Metadaten weg, auch
GPS-Daten. Limits: 12 MB pro Anfrage, 1 Eintrag pro Minute und IP, 200 Bilder
pro Tag insgesamt.

## Sprache (DE/EN)

- Erster Besuch: Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch.
  Umschalter oben rechts, die Wahl merkt sich der Browser.
- Feste Texte stehen in `web/i18n.js` (`TEXTE.de` / `TEXTE.en`).
- Reiseplan: in `web/reise.js` neben jedes Feld die englische Fassung mit
  `_en` schreiben (`was_en`, `anreise_en`, `ort_en`, `zeit_en` …). Fehlt sie,
  wird auf Englisch der deutsche Text gezeigt.
- Nach Änderungen an CSS/JS die `?v=` in `web/index.html` hochzählen.

## Gästebuch übersetzen (DeepL)

Jeder Eintrag hat einen „Übersetzen“-Button; übersetzt wird in die Sprache
des Geräts. Jede Übersetzung landet in der Tabelle `translations` (pro
Eintrag und Zielsprache eine Zeile) – DeepL wird nur gefragt, wenn es die
Kombination noch nicht gibt. Beim Löschen eines Eintrags fallen seine
Übersetzungen mit weg.

- `DEEPL_API_KEY` in `.env` (leer = Button meldet „nicht verfügbar“).
  Schlüssel mit `:fx` laufen über api-free.deepl.com.
- Schutz des Kontingents: höchstens `TRANSLATE_DAILY_CHARS` (Standard 50.000)
  neu übersetzte Zeichen pro 24 h und 30 neue Übersetzungen pro IP und Stunde.
  Bereits gespeicherte Übersetzungen gehen immer.

## Backup

Es reicht, `/srv/palbuddies-data` zu sichern. Für eine konsistente Kopie der
Datenbank im laufenden Betrieb:

```sh
docker run --rm -v /srv/palbuddies-data:/data alpine:3.22 \
  sh -c 'apk add -q sqlite && sqlite3 /data/guestbook.db ".backup /data/backup.db"'
```
