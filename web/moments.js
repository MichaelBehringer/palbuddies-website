/* „Unterwegs“: Fotos von uns während der Reise. Backend: /api/guestbook/moments
   (server/moments.go). Anschauen kann jeder, hochladen und löschen nur im
   Admin-Modus (gleiches Token wie im Gästebuch, siehe guestbook.js).

   Ort: Station aus reise.js (vorausgewählt ist die aktuelle) und, wenn das
   Foto GPS-Daten hat, der genaue Punkt. Die GPS-Daten werden hier aus dem
   Originalfoto gelesen, weil das Verkleinern im Browser (und der Server)
   alle Metadaten entfernt. */
(() => {
  'use strict';

  const GB = window.GB;
  const R = window.REISE;
  const section = document.getElementById('moments');
  if (!GB || !R || !section) return;
  const { t, pick } = window.I18N;
  const API = GB.API + '/moments';
  const MAX_IMAGES = 6;
  const HOME_TZ = 'Europe/Berlin';
  const NEAR_KM = 100; // so nah muss eine Station sein, um sie per GPS vorzuwählen

  const $ = (sel) => document.querySelector(sel);
  const form = $('#mo-form');
  const list = $('#mo-list');
  const fileInput = $('#mo-file');
  const photos = $('#mo-photos');
  const addTile = $('#mo-add');
  const gpsNote = $('#mo-gps');
  const select = form.elements.station;
  const submitBtn = form.querySelector('.gb-submit');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- Stationen aus reise.js ---------- */
  const stations = [];
  for (const s of [...(R.stationen || []), ...(R.kartenpunkte || [])]) {
    if (s.ort && !stations.some((o) => o.ort === s.ort)) stations.push(s);
  }
  const stationByName = (name) => stations.find((s) => s.ort === name) || null;
  const stationLabel = (s) => `${pick(s, 'ort')} ${s.flagge || ''}`.trim();

  function fillSelect() {
    const current = select.value;
    const none = el('option', null, t('mo.noStation'));
    none.value = '';
    select.replaceChildren(none, ...stations.map((s) => {
      const o = el('option', null, stationLabel(s));
      o.value = s.ort;
      return o;
    }));
    select.value = current;
  }

  function selectCurrentStation() {
    const s = window.TRIP && window.TRIP.currentStop();
    select.value = s && stationByName(s.ort) ? s.ort : '';
  }

  function distanceKm([lat1, lon1], [lat2, lon2]) {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  function nearestStation(lat, lon) {
    let best = null, bestKm = NEAR_KM;
    for (const s of stations) {
      if (!Array.isArray(s.lage)) continue;
      const km = distanceKm([lat, lon], s.lage);
      if (km < bestKm) { best = s; bestKm = km; }
    }
    return best;
  }

  /* ---------- EXIF (nur JPEG): GPS und Aufnahmezeit ---------- */
  async function readExif(file) {
    try {
      const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
      if (v.getUint16(0) !== 0xffd8) return null;
      let p = 2;
      while (p + 10 <= v.byteLength) {
        const marker = v.getUint16(p);
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
        if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return parseTiff(v, p + 10);
        p += 2 + v.getUint16(p + 2);
      }
    } catch (_) { /* kaputt oder abgeschnitten: dann eben ohne */ }
    return null;
  }

  function parseTiff(v, start) {
    const le = v.getUint16(start) === 0x4949;
    const u16 = (o) => v.getUint16(start + o, le);
    const u32 = (o) => v.getUint32(start + o, le);
    if (u16(2) !== 42) return null;

    function ifd(off) {
      const tags = {};
      const n = u16(off);
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        tags[u16(e)] = { count: u32(e + 4), at: e + 8 };
      }
      return tags;
    }
    function ascii(tag) {
      if (!tag) return '';
      const at = tag.count <= 4 ? tag.at : u32(tag.at);
      let s = '';
      for (let i = 0; i < tag.count; i++) {
        const c = v.getUint8(start + at + i);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
    // Grad, Minuten, Sekunden als drei RATIONAL-Werte
    function degrees(tag) {
      if (!tag || tag.count < 3) return NaN;
      const base = u32(tag.at);
      const [d, m, s] = [0, 1, 2].map((i) => u32(base + i * 8) / u32(base + i * 8 + 4));
      return d + m / 60 + s / 3600;
    }

    const out = {};
    const ifd0 = ifd(u32(4));
    if (ifd0[0x8825]) {
      const g = ifd(u32(ifd0[0x8825].at));
      let lat = degrees(g[2]);
      let lon = degrees(g[4]);
      if (ascii(g[1]) === 'S') lat = -lat;
      if (ascii(g[3]) === 'W') lon = -lon;
      // 0/0 schreiben manche Kameras, wenn sie keinen Empfang hatten
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) &&
          Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        out.lat = lat;
        out.lon = lon;
      }
    }
    if (ifd0[0x8769]) {
      const e = ifd(u32(ifd0[0x8769].at));
      const m = ascii(e[0x9003]).match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
      if (m) {
        out.wall = m.slice(1).map(Number); // Ortszeit der Kamera
        const off = ascii(e[0x9011]).match(/^([+-])(\d\d):(\d\d)$/);
        if (off) out.offsetMin = (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
      }
    }
    return out;
  }

  // Abstand einer Zeitzone zu UTC in Minuten, zum Zeitpunkt date
  function tzOffsetMin(tz, date) {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).forEach((x) => { parts[x.type] = Number(x.value); });
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  }

  // EXIF-Zeit -> Unix-Sekunden. Ohne Zeitzone im Foto gilt die der Station.
  function takenUnix(exif, tz) {
    if (!exif || !exif.wall) return '';
    const [y, mo, d, h, mi, s] = exif.wall;
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    const off = exif.offsetMin != null ? exif.offsetMin : tzOffsetMin(tz, new Date(guess));
    const unix = Math.round((guess - off * 60000) / 1000);
    return Number.isFinite(unix) ? String(unix) : '';
  }

  /* ---------- Fotos auswählen ---------- */
  let images = []; // { blob, url }
  let exif = null; // vom ersten Foto mit GPS bzw. Aufnahmezeit
  let gps = null; // { lat, lon } oder null (auch wenn entfernt)

  function renderGps() {
    gpsNote.replaceChildren();
    gpsNote.hidden = !gps;
    if (!gps) return;
    const remove = el('button', 'gb-tr-btn', t('mo.gpsRemove'));
    remove.type = 'button';
    remove.addEventListener('click', () => { gps = null; renderGps(); });
    gpsNote.append(t('mo.gpsFound', { lat: gps.lat.toFixed(4), lon: gps.lon.toFixed(4) }), ' ', remove);
  }

  function renderPreviews() {
    photos.querySelectorAll('.gb-preview').forEach((node) => node.remove());
    images.forEach((item, i) => {
      const wrap = el('div', 'gb-preview');
      const img = el('img');
      img.src = item.url;
      img.alt = t('gb.photoN', { n: i + 1 });
      const del = el('button');
      del.type = 'button';
      del.innerHTML = GB.XMARK;
      del.setAttribute('aria-label', t('gb.removePhoto', { n: i + 1 }));
      del.addEventListener('click', () => {
        URL.revokeObjectURL(item.url);
        images.splice(i, 1);
        if (!images.length) { exif = null; gps = null; renderGps(); }
        renderPreviews();
      });
      wrap.append(img, del);
      photos.insertBefore(wrap, addTile);
    });
    addTile.hidden = images.length >= MAX_IMAGES;
  }

  function clearForm() {
    form.reset();
    images.forEach((item) => URL.revokeObjectURL(item.url));
    images = [];
    exif = null;
    gps = null;
    renderPreviews();
    renderGps();
    selectCurrentStation();
  }

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    const free = MAX_IMAGES - images.length;
    if (files.length > free) GB.toast(t('gb.maxPhotos', { max: MAX_IMAGES }));
    for (const file of files.slice(0, free)) {
      const info = await readExif(file);
      if (info && !exif && (info.wall || info.lat != null)) exif = info;
      if (info && info.lat != null && !gps) {
        gps = { lat: info.lat, lon: info.lon };
        const near = nearestStation(info.lat, info.lon);
        if (near) select.value = near.ort;
      }
      try {
        const blob = await GB.compress(file);
        images.push({ blob, url: URL.createObjectURL(blob) });
      } catch (_) {
        GB.toast(t('gb.badFormat'));
      }
    }
    renderPreviews();
    renderGps();
  });

  /* ---------- Posten ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caption = form.elements.caption.value.trim();
    if (!images.length) { GB.toast(t('mo.needPhoto')); return; }
    if (!caption) { GB.toast(t('mo.needCaption')); return; }

    const station = stationByName(select.value);
    const data = new FormData();
    data.append('caption', caption);
    data.append('station', select.value);
    data.append('place', form.elements.place.value.trim());
    if (gps) {
      data.append('lat', gps.lat.toFixed(6));
      data.append('lon', gps.lon.toFixed(6));
    }
    data.append('taken', takenUnix(exif, (station && station.zeitzone) || HOME_TZ));
    images.forEach((item, i) => data.append('images', item.blob, `foto${i + 1}.jpg`));

    submitBtn.disabled = true;
    submitBtn.textContent = t('gb.uploading');
    try {
      const res = await fetch(API, { method: 'POST', body: data, headers: { 'X-Admin-Token': GB.adminToken } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        GB.toast(res.status === 403 ? t('gb.adminInvalid') : GB.errorText(body, res.status));
        return;
      }
      clearForm();
      GB.toast(t('mo.posted'));
      load();
    } catch (_) {
      GB.toast(t('gb.offline'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('mo.submit');
    }
  });

  /* ---------- Anzeigen ----------
     Zugeklappt: eine Zeile mit Anzahl, letztem Ort und Vorschau. Aufgeklappt:
     nach Tag und Station gruppiert, der neueste Tag offen, ältere zu.
     Text nur über textContent (Schutz vor XSS). */
  const wrap = $('#mo-wrap');
  const sub = $('#mo-sub');
  const stack = $('#mo-stack');
  const newBadge = $('#mo-new');
  const SEEN_KEY = 'mo-seen';
  const NEW_WITHOUT_SEEN = 2 * 86400; // Erstbesuch: so lange gilt ein Post als neu

  const isImageURL = (u) => typeof u === 'string' && u.startsWith(GB.API + '/img/');
  const momentTime = (m) => m.taken || m.created;
  const momentTz = (m) => { const s = stationByName(m.station); return (s && s.zeitzone) || HOME_TZ; };
  const imagesOf = (m) => (m.images || []).filter((im) => isImageURL(im.full) && isImageURL(im.thumb));

  const fmtCache = {};
  function fmt(name, tz, opts) {
    const key = window.I18N.locale + name + tz;
    return (fmtCache[key] ||= new Intl.DateTimeFormat(window.I18N.locale, { ...opts, timeZone: tz }));
  }
  const ymd = (unix, tz) => fmt('ymd', tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(unix * 1000).reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
  const ymdKey = (unix, tz) => { const p = ymd(unix, tz); return `${p.year}-${p.month}-${p.day}`; };
  const toUTC = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const dayDiff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);

  function timeOnly(unix, tz) {
    const text = fmt('time', tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(unix * 1000);
    return tz === HOME_TZ ? text : t('mo.localTime', { time: text });
  }

  // "Heute" / "Gestern" / "Do., 30. Okt."
  function dayLabel(key, tz) {
    const diff = dayDiff(key, ymdKey(Date.now() / 1000, tz));
    if (diff === 0 || diff === 1) {
      const s = new Intl.RelativeTimeFormat(window.I18N.locale, { numeric: 'auto' }).format(-diff, 'day');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return fmt('day', 'UTC', { weekday: 'short', day: 'numeric', month: 'short' }).format(toUTC(key));
  }

  // "Tag 4 von 25", nur während der Reise
  const tripStart = ymdKey(new Date(R.abflug).getTime() / 1000, HOME_TZ);
  const tripEnd = ymdKey(new Date(R.rueckkehr).getTime() / 1000, HOME_TZ);
  function tripDay(key) {
    const n = dayDiff(tripStart, key) + 1;
    const total = dayDiff(tripStart, tripEnd) + 1;
    return n >= 1 && n <= total ? t('trip.dayOf', { n, total }) : '';
  }

  function ago(unix) {
    const sec = Math.round(unix - Date.now() / 1000);
    const rtf = new Intl.RelativeTimeFormat(window.I18N.locale, { numeric: 'auto', style: 'short' });
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(sec) >= size) return rtf.format(Math.round(sec / size), unit);
    }
    return t('mo.justNow');
  }

  function thumbStack(imgs, max) {
    return imgs.slice(0, max).map((im) => {
      const img = el('img');
      img.src = im.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      return img;
    });
  }

  // Aufeinanderfolgende Posts vom selben Tag und Ort gehören zusammen
  function groupMoments() {
    const groups = [];
    for (const m of moments) {
      const tz = momentTz(m);
      const key = ymdKey(momentTime(m), tz) + '|' + m.station;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(m);
      else groups.push({ key, day: key.split('|')[0], tz, station: m.station, items: [m] });
    }
    return groups;
  }

  /* ---------- „Neu“-Badge ---------- */
  let seen = 0;
  try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (_) { /* kein Storage */ }
  const newest = () => moments.reduce((max, m) => Math.max(max, m.created), 0);
  function renderBadge() {
    const n = newest();
    newBadge.hidden = !n || (seen ? n <= seen : Date.now() / 1000 - n > NEW_WITHOUT_SEEN);
  }
  wrap.addEventListener('toggle', () => {
    if (!wrap.open || !moments.length) return;
    seen = newest();
    try { localStorage.setItem(SEEN_KEY, String(seen)); } catch (_) { /* egal */ }
    renderBadge();
  });

  function renderSummary() {
    if (!moments.length) {
      sub.textContent = GB.adminToken ? t('mo.empty') : '';
      stack.replaceChildren();
      return;
    }
    const photos = moments.reduce((n, m) => n + imagesOf(m).length, 0);
    const last = moments[0];
    const station = stationByName(last.station);
    const where = last.place || (station ? stationLabel(station) : last.station);
    const parts = [t(photos === 1 ? 'mo.photo1' : 'mo.photos', { n: photos })];
    parts.push(where ? t('mo.lastIn', { place: where, ago: ago(momentTime(last)) }) : ago(momentTime(last)));
    sub.textContent = parts.join(' · ');
    stack.replaceChildren(...thumbStack(moments.flatMap(imagesOf), 3));
  }

  function renderMoment(m) {
    const li = el('li', 'mo-item');
    const imgs = imagesOf(m);
    if (imgs.length) {
      const grid = el('div', 'mo-images');
      grid.dataset.n = String(Math.min(imgs.length, 3));
      imgs.forEach((im, i) => {
        const btn = el('button', 'gb-thumb');
        btn.type = 'button';
        btn.setAttribute('aria-label', t('mo.enlarge', { n: i + 1 }));
        const img = el('img');
        // Ein Bild allein wird groß gezeigt, dafür reicht die Vorschau nicht
        img.src = imgs.length === 1 ? im.full : im.thumb;
        if (imgs.length === 1 && im.w && im.h) btn.style.aspectRatio = `${im.w} / ${im.h}`;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.append(img);
        btn.addEventListener('click', () => GB.openLightbox(im.full));
        grid.append(btn);
      });
      li.append(grid);
    }

    li.append(el('p', 'mo-caption', m.caption));

    const meta = el('div', 'mo-meta');
    // Station steht schon in der Gruppe, hier nur der genaue Ort
    if (m.place || typeof m.lat === 'number') {
      const hasGps = typeof m.lat === 'number' && typeof m.lon === 'number';
      const loc = el(hasGps ? 'a' : 'span', 'mo-where', '📍 ' + (m.place || t('mo.onMap')));
      if (hasGps) {
        loc.href = `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lon}#map=16/${m.lat}/${m.lon}`;
        loc.target = '_blank';
        loc.rel = 'noopener';
        loc.title = t('mo.onMap');
      }
      meta.append(loc);
    }
    const unix = momentTime(m);
    const time = el('time', 'mo-time', timeOnly(unix, momentTz(m)));
    time.dateTime = new Date(unix * 1000).toISOString();
    meta.append(time);
    li.append(meta);

    if (GB.adminToken) {
      const del = el('button', 'gb-del mo-del');
      del.type = 'button';
      del.innerHTML = GB.XMARK;
      del.setAttribute('aria-label', t('mo.delete'));
      del.addEventListener('click', () => removeMoment(m));
      li.append(del);
    }
    return li;
  }

  const groupOpen = new Map(); // key -> offen? (vom Besucher umgeschaltet)

  function renderGroup(g, i) {
    const li = el('li', 'mo-group');
    const det = el('details');
    det.open = groupOpen.has(g.key) ? groupOpen.get(g.key) : i === 0;
    det.addEventListener('toggle', () => groupOpen.set(g.key, det.open));

    const sum = el('summary');
    const head = el('span', 'stop-head');
    head.append(el('span', 'stop-name', dayLabel(g.day, g.tz)));
    const station = stationByName(g.station);
    const info = [station ? stationLabel(station) : g.station, tripDay(g.day)].filter(Boolean).join(' · ');
    if (info) head.append(el('span', 'stop-dates', info));
    const imgs = g.items.flatMap(imagesOf);
    const preview = el('span', 'mo-stack mo-stack-sm');
    preview.setAttribute('aria-hidden', 'true');
    preview.append(...thumbStack(imgs, 3));
    const count = el('span', 'mo-count', '📷 ' + imgs.length);
    count.setAttribute('aria-label', t(imgs.length === 1 ? 'mo.photo1' : 'mo.photos', { n: imgs.length }));
    sum.append(head, preview, count, el('span', 'stop-chev'));

    const ol = el('ol', 'mo-list');
    ol.append(...g.items.map(renderMoment));
    det.append(sum, ol);
    li.append(det);
    return li;
  }

  let moments = [];

  function render() {
    const admin = !!GB.adminToken;
    form.hidden = !admin;
    list.replaceChildren(...groupMoments().map(renderGroup));
    renderSummary();
    renderBadge();
    section.hidden = !admin && !moments.length;
  }

  async function load() {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      moments = await res.json();
    } catch (_) {
      moments = [];
    }
    render();
  }

  async function removeMoment(m) {
    if (!confirm(t('mo.confirmDelete'))) return;
    try {
      const res = await fetch(`${API}/${m.id}`, { method: 'DELETE', headers: { 'X-Admin-Token': GB.adminToken } });
      if (res.status === 204 || res.status === 404) {
        moments = moments.filter((x) => x.id !== m.id);
        GB.toast(t('gb.deleted'));
        render(); // Gruppe und Zusammenfassung neu
      } else if (res.status === 403) {
        GB.toast(t('gb.adminInvalid'));
      } else {
        GB.toast(t('gb.deleteFailed'));
      }
    } catch (_) {
      GB.toast(t('gb.offline'));
    }
  }

  window.addEventListener('langchange', () => {
    fillSelect();
    renderPreviews();
    renderGps();
    render();
  });
  window.addEventListener('adminchange', render);

  fillSelect();
  selectCurrentStation();
  renderPreviews();
  load();
})();
