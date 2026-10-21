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

## Wetter

Der Countdown zeigt das aktuelle Wetter: vor der Reise an der ersten Station,
unterwegs am aktuellen Ort (Koordinaten aus `lage` in `web/reise.js`), nach
der Reise keins. Der Browser fragt `/api/guestbook/weather?lat=..&lon=..`, der
Go-Server holt die Daten bei Open-Meteo (kein API-Key) und merkt sich jeden
Ort 30 min. Die IPs der Besucher gehen so nicht an Dritte. Klappt die Abfrage
nicht, fehlt die Wetterzeile einfach.

## Reaktionen

Unter jedem Eintrag: ❤️ 😂 🔥 🍜. Pro Gerät zählt jedes Emoji einmal (zufällige
Geräte-ID im Browser), höchstens 120 Klicks pro IP und Stunde. Beim Löschen
eines Eintrags fallen seine Reaktionen mit weg. Andere Emojis: Liste in
`server/reactions.go` (`reactionEmojis`) und `web/guestbook.js` (`REACTIONS`)
gleich halten, danach Backend neu bauen.

## Besucherzähler

Unten auf der Seite: Besucher heute, gesamt und nach Land (öffentlich). Der
Browser meldet jeden Aufruf an `POST /api/guestbook/visit`, die Zahlen kommen
von `GET /api/guestbook/stats` (Code: `server/visits.go`, `web/stats.js`).

- Gezählt wird jedes Gerät einmal pro Tag (Europe/Berlin), erkannt an der
  zufälligen Geräte-ID im Browser (dieselbe wie bei den Reaktionen). Gesamt =
  verschiedene Geräte seit Start. Ohne localStorage zählt IP + Browser für
  diesen einen Tag.
- Gespeichert wird nur ein SHA-256-Hash und das Land, **keine IP**
  (Tabelle `visits`).
- Land kommt von Cloudflare (`CF-IPCountry`), dafür ist nichts einzustellen.
- Nicht gezählt: Admins (Admin-Modus an), Bots (User-Agent), mehr als 30
  Meldungen pro IP und Stunde.
- Zähler zurücksetzen: `DELETE FROM visits;` (siehe Backup-Befehl unten,
  statt `.backup` die SQL-Zeile).

## Unterwegs (Fotos von uns)

Im Admin-Modus erscheint unter der Route der Bereich „Unterwegs“ mit einem
Formular: 1–6 Fotos, Bildunterschrift, Station (vorausgewählt die aktuelle
aus `web/reise.js`) und optional ein genauerer Ort („Fushimi Inari“). Ohne
Admin-Modus sieht man nur die Posts, ganz ohne Posts ist der Bereich weg.

- Hat das Foto GPS-Daten, liest der Browser sie vor dem Verkleinern aus,
  wählt die nächste Station (bis 100 km) vor und der Ort im Post wird ein
  Link zu OpenStreetMap. Gespeichert auf ~10 m gerundet; „Entfernen“ im
  Formular postet ohne Position.
- **iPhone:** Den Standort gibt iOS nur mit, wenn man in der Fotoauswahl
  oben auf „Optionen“ tippt und „Standort“ einschaltet.
- Angezeigt wird die Aufnahmezeit aus dem Foto (sonst die Upload-Zeit) in
  der Ortszeit der Station.
- Löschen: ✕ am Post. Die Bilder liegen wie im Gästebuch in
  `/srv/palbuddies-data/images`, ohne Metadaten.

## Backup

Es reicht, `/srv/palbuddies-data` zu sichern. Für eine konsistente Kopie der
Datenbank im laufenden Betrieb:

```sh
docker run --rm -v /srv/palbuddies-data:/data alpine:3.22 \
  sh -c 'apk add -q sqlite && sqlite3 /data/guestbook.db ".backup /data/backup.db"'
```
