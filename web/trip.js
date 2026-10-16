/* Countdown, Karte und Zeitplan – Daten kommen aus reise.js */
(() => {
  'use strict';

  const R = window.REISE;
  if (!R || !Array.isArray(R.stationen)) return;
  const { t, pick } = window.I18N;

  const stops = R.stationen;
  const START = new Date(R.abflug);
  const END = new Date(R.rueckkehr);
  const HOME_TZ = 'Europe/Berlin';

  /* ---------- Zeit (mit ?datum=… simulierbar) ---------- */
  const sim = new URLSearchParams(location.search).get('datum');
  const simDate = sim ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(sim) ? sim + 'T12:00:00+09:00' : sim) : null;
  const now = () => (simDate && !isNaN(simDate) ? simDate : new Date());

  const ymdFmt = {};
  function ymd(date, tz) {
    ymdFmt[tz] ||= new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return ymdFmt[tz].format(date);
  }
  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const dayDiff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);

  // Datumsformate je Sprache (I18N.locale), einmal angelegt und gemerkt
  const fmtCache = {};
  function fmt(name, opts) {
    const key = window.I18N.locale + name;
    return (fmtCache[key] ||= new Intl.DateTimeFormat(window.I18N.locale, opts));
  }
  const dayLabel = (s) => fmt('day', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toUTC(s)).replace('.', '');
  const weekdayLabel = (s) => fmt('weekday', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toUTC(s));
  const localTime = (tz, d) => fmt('time' + tz, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  const place = (s) => `${pick(s, 'ort')} ${s.flagge || ''}`.trim();

  /* ---------- Status pro Station ---------- */
  function stateOf(stop, d) {
    const t = ymd(d, stop.zeitzone || HOME_TZ);
    if (t > stop.bis) return 'past';
    if (t < stop.von) return 'future';
    // Eintägige Station (z. B. Tagesausflug) hat an ihrem Tag Vorrang
    if (stops.includes(stop) && stop.von !== stop.bis && stops.some((o) => o.von === t && o.bis === t)) {
      return t === stop.bis ? 'past' : 'future';
    }
    return 'now';
  }

  function phase(d) {
    if (d < START) return 'before';
    if (d >= END) return 'after';
    return 'during';
  }

  /* ---------- kleine DOM-Helfer ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  const firstStop = stops[0];
  // Karte: Stationen mit "lage" (außer karte: false) + zusätzliche Kartenpunkte
  const mapStops = stops.filter((s) => Array.isArray(s.lage) && s.karte !== false)
    .concat((R.kartenpunkte || []).filter((p) => Array.isArray(p.lage)));
  const awayStops = stops.filter((s) => s.zeitzone !== HOME_TZ);
  const cities = new Set(awayStops.map((s) => s.ort));
  const countries = new Set(awayStops.map((s) => s.land));
  const homeStart = ymd(START, HOME_TZ);
  const homeEnd = ymd(END, HOME_TZ);
  const totalDays = dayDiff(homeStart, homeEnd) + 1;

  /* ==========================================================
     1) Countdown / Live-Status
     ========================================================== */
  const countdownEl = document.getElementById('countdown');

  function unit(value, label) {
    const box = el('div', 'cd-unit');
    box.append(el('span', 'cd-num', String(value).padStart(2, '0')), el('span', 'cd-label', label));
    return box;
  }

  function todaysPlan(d, current) {
    const items = [];
    for (const s of current) {
      const t = ymd(d, s.zeitzone || HOME_TZ);
      for (const p of s.plan || []) if (p.tag === t) items.push(p);
    }
    return items; // Reihenfolge wie in reise.js
  }

  /* ---------- Wetter am Aufenthaltsort ----------
     Über /api/guestbook/weather (der Server fragt Open-Meteo und merkt sich
     das Ergebnis 30 min). Ohne Antwort gibt es einfach keine Wetterzeile. */
  const WEATHER_EVERY = 30 * 60 * 1000;
  let weather = { key: '', data: null, fetched: 0 };

  // WMO-Wettercode -> [Icon am Tag, Icon nachts, Textschlüssel]
  function sky(code) {
    if (code === 0) return ['☀️', '🌙', 'clear'];
    if (code === 1) return ['🌤️', '🌙', 'mostlyClear'];
    if (code === 2) return ['⛅', '☁️', 'partlyCloudy'];
    if (code === 3) return ['☁️', '☁️', 'cloudy'];
    if (code === 45 || code === 48) return ['🌫️', '🌫️', 'fog'];
    if (code >= 51 && code <= 57) return ['🌦️', '🌧️', 'drizzle'];
    if (code >= 61 && code <= 67) return ['🌧️', '🌧️', 'rain'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['🌨️', '🌨️', 'snow'];
    if (code >= 80 && code <= 82) return ['🌦️', '🌧️', 'showers'];
    if (code >= 95) return ['⛈️', '⛈️', 'thunder'];
    return null;
  }

  // Vor der Reise die erste Station, unterwegs die aktuelle (am Reisetag das Ziel)
  function weatherStop(d) {
    const ph = phase(d);
    if (ph === 'before') return stops.find((s) => Array.isArray(s.lage)) || null;
    if (ph === 'after') return null;
    const current = stops.filter((s) => stateOf(s, d) === 'now' && Array.isArray(s.lage));
    return current[current.length - 1] || null;
  }

  // Läuft jede Sekunde mit, fragt aber nur bei neuem Ort oder nach 30 min
  async function updateWeather() {
    const s = weatherStop(now());
    const key = s ? s.lage.join(',') : '';
    if (key === weather.key && Date.now() - weather.fetched < WEATHER_EVERY) return;
    weather = { key, data: key === weather.key ? weather.data : null, fetched: Date.now() };
    if (!s) return;
    try {
      const res = await fetch(`/api/guestbook/weather?lat=${s.lage[0]}&lon=${s.lage[1]}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (weather.key === key) weather.data = data;
    } catch (_) { /* keine Wetterzeile */ }
    renderCountdown();
  }

  function weatherLine(d) {
    const s = weatherStop(d);
    const w = weather.data;
    const look = w && sky(w.code);
    if (!s || !look || weather.key !== s.lage.join(',')) return null;
    return el('p', 'cd-weather', t('trip.weatherIn', {
      icon: w.day ? look[0] : look[1], place: place(s), temp: Math.round(w.temp), sky: t('wx.' + look[2]),
      time: localTime(s.zeitzone || HOME_TZ, d),
    }));
  }

  function renderCountdown() {
    const d = now();
    const ph = phase(d);
    countdownEl.replaceChildren();
    countdownEl.dataset.phase = ph;

    const titel = pick(R, 'titel');
    const eyebrow = el('p', 'eyebrow', titel ? `${titel} ${START.getFullYear()}` : t('trip.eyebrow'));
    countdownEl.append(eyebrow);

    if (ph === 'before') {
      let s = Math.max(0, Math.floor((START - d) / 1000));
      const days = Math.floor(s / 86400); s %= 86400;
      const hrs = Math.floor(s / 3600); s %= 3600;
      const min = Math.floor(s / 60); const sec = s % 60;

      countdownEl.append(el('h2', 'cd-title', t('trip.departure')));
      const row = el('div', 'cd-row');
      row.append(unit(days, t(days === 1 ? 'trip.day' : 'trip.days')), unit(hrs, t('trip.hours')),
        unit(min, t('trip.minutes')), unit(sec, t('trip.seconds')));
      countdownEl.append(row);
      countdownEl.append(el('p', 'cd-sub', t('trip.fromFrankfurt',
        { day: weekdayLabel(homeStart), time: localTime(HOME_TZ, START), place: place(firstStop) })));
      const wx = weatherLine(d);
      if (wx) countdownEl.append(wx);
      return;
    }

    if (ph === 'after') {
      countdownEl.append(el('h2', 'cd-title', t('trip.home')));
      countdownEl.append(el('p', 'cd-sub',
        t('trip.summary', { days: totalDays, cities: cities.size, countries: countries.size })));
      return;
    }

    // during
    const current = stops.filter((s) => stateOf(s, d) === 'now');
    const tz = current[0]?.zeitzone || HOME_TZ;
    const dayNo = Math.min(totalDays, dayDiff(homeStart, ymd(d, tz)) + 1);
    const progress = Math.min(1, Math.max(0, (d - START) / (END - START)));

    countdownEl.append(el('h2', 'cd-title', t('trip.dayOf', { n: dayNo, total: totalDays })));

    const bar = el('div', 'progress');
    const fill = el('span', 'progress-fill');
    fill.style.width = (progress * 100).toFixed(1) + '%';
    bar.append(fill);
    countdownEl.append(bar);

    // Steht das Wetter (mit Uhrzeit) darunter, hier ohne Uhrzeit
    const wx = weatherLine(d);
    let where;
    if (current.length === 1) {
      const c = current[0];
      where = wx ? t('trip.currentlyInShort', { place: place(c) })
        : t('trip.currentlyIn', { place: place(c), time: localTime(c.zeitzone, d) });
    } else if (current.length > 1) {
      where = t('trip.travelDay', { from: place(current[0]), to: place(current[current.length - 1]) });
    } else {
      const next = stops.find((s) => stateOf(s, d) === 'future');
      where = next ? t('trip.onTheWayTo', { place: place(next) }) : t('trip.onTheWay');
    }
    countdownEl.append(el('p', 'cd-where', where));
    if (wx) countdownEl.append(wx);

    const plan = todaysPlan(d, current);
    if (plan.length) {
      const box = el('div', 'today');
      box.append(el('p', 'today-title', t('trip.today')));
      const ul = el('ul', 'plan-list');
      for (const p of plan) {
        const li = el('li');
        if (p.zeit) li.append(el('span', 'plan-time', pick(p, 'zeit')));
        li.append(el('span', 'plan-what', pick(p, 'was')));
        ul.append(li);
      }
      box.append(ul);
      countdownEl.append(box);
    }
  }

  /* ==========================================================
     2a) Karte
     ========================================================== */
  // Ländernamen auf der Karte: [Name, Breite, Länge, Ausrichtung]
  const LAND_LABELS = [
    ['CHINA', 34.4, 118.4, 'start'],
    ['TAIWAN', 25.4, 122.9, 'start'],
    ['KOREA', 36.2, 127.9, 'middle'],
    ['JAPAN', 31.6, 137.8, 'middle'],
  ];

  function renderMap() {
    const host = document.getElementById('route-map');
    if (!host || mapStops.length < 2) return;
    const d = now();

    const W = 360, H = 270, padL = 56, padR = 56, padY = 34;
    const lats = mapStops.map((s) => s.lage[0]);
    const lons = mapStops.map((s) => s.lage[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const scale = Math.min((W - padL - padR) / ((maxLon - minLon) * k || 1), (H - 2 * padY) / ((maxLat - minLat) || 1));
    const offX = padL + (W - padL - padR - (maxLon - minLon) * k * scale) / 2;
    const offY = (H - (maxLat - minLat) * scale) / 2;
    const proj = ([lat, lon]) => [offX + (lon - minLon) * k * scale, offY + (maxLat - lat) * scale];

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('trip.map') + ': ' + [...new Set(mapStops.map((s) => pick(s, 'ort')))].join(', ') });

    const defs = svg('defs', {});
    const pat = svg('pattern', { id: 'dots', width: '14', height: '14', patternUnits: 'userSpaceOnUse' });
    pat.append(svg('circle', { cx: '2', cy: '2', r: '1.2', fill: 'rgba(73,39,126,.18)' }));
    defs.append(pat);
    const clip = svg('clipPath', { id: 'map-clip' });
    clip.append(svg('rect', { x: 0, y: 0, width: W, height: H, rx: 16 }));
    defs.append(clip);
    root.append(defs,
      svg('rect', { x: 0, y: 0, width: W, height: H, rx: 16, class: 'sea' }),
      svg('rect', { x: 0, y: 0, width: W, height: H, rx: 16, fill: 'url(#dots)' }));

    // Länder im Hintergrund (Daten aus karte-land.js)
    if (Array.isArray(window.KARTE_LAND)) {
      const land = svg('g', { class: 'land', 'clip-path': 'url(#map-clip)', 'aria-hidden': 'true' });
      for (const c of window.KARTE_LAND) {
        const dPath = c.rings.map((r) => 'M' + r.map(([lon, lat]) => proj([lat, lon]).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('');
        land.append(svg('path', { d: dPath, class: countries.has(c.name) ? 'country visited' : 'country' }));
      }
      for (const [name, lat, lon, anchor] of LAND_LABELS) {
        const [x, y] = proj([lat, lon]);
        if (x < 10 || x > W - 10 || y < 12 || y > H - 6) continue;
        land.append(svg('text', { x, y, 'text-anchor': anchor, class: 'country-label' }, name));
      }
      root.append(land);
    }

    // Orte (doppelte nur einmal zeichnen)
    const seen = new Map();
    mapStops.forEach((s) => {
      const st = s.von ? stateOf(s, d) : 'future';
      const prev = seen.get(s.ort);
      const rank = { now: 3, past: 2, future: 1 };
      if (!prev || rank[st] > rank[prev.st]) seen.set(s.ort, { s, st });
    });
    const cy0 = H / 2;
    for (const { s, st } of seen.values()) {
      const [x, y] = proj(s.lage);
      const g = svg('g', { class: 'pin ' + st });
      if (st === 'now') g.append(svg('circle', { cx: x, cy: y, r: 9, class: 'pin-pulse' }));
      g.append(svg('circle', { cx: x, cy: y, r: 7, class: 'pin-dot' }));

      let pos = s.beschriftung;
      if (!pos) pos = y < cy0 ? 'oben' : 'unten';
      const o = { links: [-13, 5, 'end'], rechts: [13, 5, 'start'], oben: [0, -14, 'middle'], unten: [0, 24, 'middle'] }[pos] || [13, 5, 'start'];
      g.append(svg('text', { x: x + o[0], y: y + o[1], 'text-anchor': o[2], class: 'pin-label' }, `${s.flagge || ''} ${pick(s, 'ort')}${s.zusatz ? ` (${pick(s, 'zusatz')})` : ''}`.trim()));
      root.append(g);
    }

    host.replaceChildren(root);
  }

  /* ==========================================================
     2b) Zeitplan
     ========================================================== */
  function renderTimeline() {
    const list = document.getElementById('timeline');
    if (!list) return;
    const d = now();
    list.replaceChildren();

    // Nach Ländern gruppieren (Reihenfolge = erstes Auftauchen)
    const groups = new Map();
    for (const s of stops) {
      if (!groups.has(s.land)) groups.set(s.land, []);
      groups.get(s.land).push(s);
    }

    for (const [land, gStops] of groups) {
      const states = gStops.map((s) => stateOf(s, d));
      const gState = states.includes('now') ? 'now' : states.every((x) => x === 'past') ? 'past' : 'future';

      // Zeiträume: aufeinanderfolgende Stationen zusammenfassen
      const ranges = [];
      for (const s of gStops) {
        const last = ranges[ranges.length - 1];
        if (last && last.bis === s.von) last.bis = s.bis;
        else ranges.push({ von: s.von, bis: s.bis });
      }
      const rangeText = ranges.map((r) => (r.von === r.bis ? dayLabel(r.von) : `${dayLabel(r.von)} – ${dayLabel(r.bis)}`)).join(' · ');

      const gLi = el('li', 'country-group ' + gState);
      const gDet = el('details');
      const gSum = el('summary');
      gSum.append(el('span', 'group-flag', gStops[0].flagge || '📍'));
      const gHead = el('span', 'stop-head');
      gHead.append(el('span', 'group-name', pick(gStops[0], 'land')));
      const cityNames = [...new Set(gStops.map((s) => pick(s, 'ort')))].join(', ');
      gHead.append(el('span', 'stop-dates', rangeText));
      gHead.append(el('span', 'group-cities', cityNames));
      gSum.append(gHead);
      if (gState === 'now') gSum.append(el('span', 'badge now', t('trip.now')));
      else if (gState === 'past') gSum.append(el('span', 'badge past', '✓'));
      gSum.append(el('span', 'stop-chev'));
      gDet.append(gSum);

      const inner = el('ol', 'timeline-inner');
      gStops.forEach((s) => addStop(s, inner));
      gDet.append(inner);
      gLi.append(gDet);
      list.append(gLi);
    }

    function addStop(s, target) {
      const st = stateOf(s, d);
      const li = el('li', 'stop ' + st);
      const det = el('details');
      if (st === 'now') det.open = true;

      const sum = el('summary');
      sum.append(el('span', 'stop-flag', s.flagge || '📍'));
      const head = el('span', 'stop-head');
      head.append(el('span', 'stop-name', pick(s, 'ort')));
      const nights = dayDiff(s.von, s.bis);
      const dates = s.von === s.bis ? weekdayLabel(s.von)
        : `${dayLabel(s.von)} – ${dayLabel(s.bis)} · ${nights} ${t(nights === 1 ? 'trip.night' : 'trip.nights')}`;
      head.append(el('span', 'stop-dates', dates));
      sum.append(head);
      if (st === 'now') sum.append(el('span', 'badge now', t('trip.now')));
      else if (st === 'past') sum.append(el('span', 'badge past', '✓'));
      sum.append(el('span', 'stop-chev'));
      det.append(sum);

      const body = el('div', 'stop-body');
      if (s.anreise) body.append(el('p', 'stop-travel', pick(s, 'anreise')));

      const plan = (s.plan || []).slice().sort((a, b) => a.tag.localeCompare(b.tag));
      if (plan.length) {
        const ul = el('ul', 'plan-list');
        let lastDay = null;
        for (const p of plan) {
          if (p.tag !== lastDay) {
            ul.append(el('li', 'plan-day', weekdayLabel(p.tag)));
            lastDay = p.tag;
          }
          const item = el('li', ymd(d, s.zeitzone || HOME_TZ) > p.tag ? 'plan-item done' : 'plan-item');
          if (p.zeit) item.append(el('span', 'plan-time', pick(p, 'zeit')));
          item.append(el('span', 'plan-what', pick(p, 'was')));
          ul.append(item);
        }
        body.append(ul);
      } else {
        body.append(el('p', 'plan-empty', t('trip.tbd')));
      }
      det.append(body);
      li.append(det);
      target.append(li);
    }
  }

  /* ---------- Start & Aktualisierung ---------- */
  renderCountdown();
  renderMap();
  renderTimeline();
  updateWeather();

  // Karte & Liste nur neu zeichnen, wenn sich ein Status ändert (sonst klappen offene Einträge zu)
  const signature = () => phase(now()) + stops.map((s) => stateOf(s, now())).join();
  let lastSig = signature();
  // Sprache umgeschaltet: alles neu zeichnen, offene Länder/Stationen bleiben offen
  window.addEventListener('langchange', () => {
    const open = [...document.querySelectorAll('#timeline details')].map((x) => x.open);
    renderCountdown(); renderMap(); renderTimeline();
    document.querySelectorAll('#timeline details').forEach((x, i) => { if (open[i] != null) x.open = open[i]; });
  });

  setInterval(() => {
    renderCountdown();
    updateWeather();
    const sig = signature();
    if (sig !== lastSig) { lastSig = sig; renderMap(); renderTimeline(); }
  }, 1000);
})();
