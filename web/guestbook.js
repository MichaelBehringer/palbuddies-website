(() => {
  'use strict';

  /* Gästebuch. Backend: server/ im Repo, erreichbar unter /api/guestbook.
     Admin-Modus (Löschen): Seite einmal mit #admin=<token> öffnen,
     mit #admin=off wieder abmelden. */

  const API = '/api/guestbook';
  const MAX_IMAGES = 3;
  const MAX_SIDE = 1600;
  const ADMIN_KEY = 'gb-admin';
  // Erlaubte Reaktionen, gleiche Liste wie reactionEmojis in server/reactions.go
  const REACTIONS = ['❤️', '😂', '🔥', '🍜'];

  const $ = (sel) => document.querySelector(sel);
  const { t } = window.I18N;
  const form = $('#gb-form');
  if (!form) return;
  const list = $('#gb-list');
  const fileInput = $('#gb-file');
  const photos = $('#gb-photos');
  const addTile = $('#gb-add');
  const hint = $('#gb-hint');
  const lightbox = $('#gb-lightbox');
  const submitBtn = form.querySelector('.gb-submit');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- Toast (gleiches Element wie script.js) ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- Admin-Modus ---------- */
  let adminToken = '';
  try { adminToken = localStorage.getItem(ADMIN_KEY) || ''; } catch (_) { /* kein Storage */ }

  // Beim Laden und wenn der Link in einen schon offenen Tab eingefügt wird
  function applyAdminHash() {
    const match = location.hash.match(/^#admin=(.+)$/);
    if (!match) return false;
    const value = decodeURIComponent(match[1]);
    adminToken = value === 'off' ? '' : value;
    try {
      if (adminToken) localStorage.setItem(ADMIN_KEY, adminToken);
      else localStorage.removeItem(ADMIN_KEY);
    } catch (_) { /* gilt dann nur bis zum Neuladen */ }
    // Token sofort aus der Adresszeile (und damit aus dem Verlauf) entfernen
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => toast(t(adminToken ? 'gb.adminOn' : 'gb.adminOff')), 300);
    return true;
  }
  applyAdminHash();
  window.addEventListener('hashchange', () => { if (applyAdminHash()) load(); });

  /* ---------- Bilder auswählen und im Browser verkleinern ---------- */
  let images = []; // { blob, url }

  async function loadImage(file) {
    try {
      // wendet die EXIF-Drehung an, kann in Safari auch HEIC
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try { await img.decode(); } finally { URL.revokeObjectURL(img.src); }
      return img;
    }
  }

  async function compress(file) {
    const src = await loadImage(file);
    const w0 = src.width, h0 = src.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // JPEG kennt keine Transparenz
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    if (src.close) src.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.8);
    });
  }

  // Statisches Icon, enthält keine Nutzerdaten
  const XMARK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function renderPreviews() {
    photos.querySelectorAll('.gb-preview').forEach((node) => node.remove());
    images.forEach((item, i) => {
      const wrap = el('div', 'gb-preview');
      const img = el('img');
      img.src = item.url;
      img.alt = t('gb.photoN', { n: i + 1 });
      const del = el('button');
      del.type = 'button';
      del.innerHTML = XMARK;
      del.setAttribute('aria-label', t('gb.removePhoto', { n: i + 1 }));
      del.addEventListener('click', () => {
        URL.revokeObjectURL(item.url);
        images.splice(i, 1);
        renderPreviews();
      });
      wrap.append(img, del);
      photos.insertBefore(wrap, addTile);
    });
    addTile.hidden = images.length >= MAX_IMAGES;
    hint.textContent = images.length
      ? t('gb.hintCount', { n: images.length, max: MAX_IMAGES })
      : t('gb.hint', { max: MAX_IMAGES });
  }

  function clearImages() {
    images.forEach((item) => URL.revokeObjectURL(item.url));
    images = [];
    renderPreviews();
  }

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = ''; // gleiche Datei erneut wählbar
    const free = MAX_IMAGES - images.length;
    if (files.length > free) toast(t('gb.maxPhotos', { max: MAX_IMAGES }));
    for (const file of files.slice(0, free)) {
      try {
        const blob = await compress(file);
        images.push({ blob, url: URL.createObjectURL(blob) });
      } catch (_) {
        toast(t('gb.badFormat'));
      }
    }
    renderPreviews();
  });

  /* ---------- Absenden ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const message = form.elements.message.value.trim();
    if (!name || !message) {
      toast(t('gb.fillIn'));
      return;
    }

    const data = new FormData();
    data.append('name', name);
    data.append('message', message);
    data.append('website', form.elements.website.value);
    images.forEach((item, i) => data.append('images', item.blob, `bild${i + 1}.jpg`));

    submitBtn.disabled = true;
    submitBtn.textContent = t(images.length ? 'gb.uploading' : 'gb.sending');
    try {
      const res = await fetch(API, { method: 'POST', body: data });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(errorText(body, res.status));
        return;
      }
      form.reset();
      clearImages();
      toast(t('gb.thanks'));
      load();
    } catch (_) {
      toast(t('gb.offline'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('gb.submit');
    }
  });

  /* ---------- Einträge anzeigen ----------
     Nutzertext nur über textContent, nie über innerHTML (Schutz vor XSS). */
  const dateFmt = () => new Intl.DateTimeFormat(window.I18N.locale, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const isImageURL = (u) => typeof u === 'string' && u.startsWith(API + '/img/');

  function renderEntry(entry) {
    const li = el('li', 'gb-entry');
    const initial = [...entry.name.trim()][0] || '?';
    const avatar = el('span', 'gb-avatar', initial.toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    const body = el('div', 'gb-body');
    li.append(avatar, body);

    const head = el('div', 'gb-head');
    const time = el('time', 'gb-date', dateFmt().format(entry.created * 1000));
    time.dateTime = new Date(entry.created * 1000).toISOString();
    head.append(el('strong', 'gb-name', entry.name), time);
    const msg = el('p', 'gb-msg', entry.message);
    body.append(head, msg);
    body.append(translateRow(entry, msg));
    body.append(reactRow(entry));

    const imgs = (entry.images || []).filter((im) => isImageURL(im.full) && isImageURL(im.thumb));
    if (imgs.length) {
      const grid = el('div', 'gb-images');
      imgs.forEach((im, i) => {
        const btn = el('button', 'gb-thumb');
        btn.type = 'button';
        btn.setAttribute('aria-label', t('gb.enlarge', { n: i + 1, name: entry.name }));
        const img = el('img');
        img.src = im.thumb;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.append(img);
        btn.addEventListener('click', () => openLightbox(im.full));
        grid.append(btn);
      });
      body.append(grid);
    }

    if (adminToken) {
      const del = el('button', 'gb-del');
      del.type = 'button';
      del.innerHTML = XMARK;
      del.setAttribute('aria-label', t('gb.delete', { name: entry.name }));
      del.addEventListener('click', () => removeEntry(entry, li));
      li.append(del);
    }
    return li;
  }

  let entries = null; // zuletzt geladene Einträge, zum Neuzeichnen beim Sprachwechsel

  function render() {
    if (!entries) {
      list.replaceChildren(el('li', 'gb-empty', t('gb.unavailable')));
    } else if (!entries.length) {
      list.replaceChildren(el('li', 'gb-empty', t('gb.empty')));
    } else {
      list.replaceChildren(...entries.map(renderEntry));
    }
  }

  async function load() {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      entries = await res.json();
    } catch (_) {
      entries = null;
    }
    render();
  }

  // Fehlermeldung vom Server in der Seitensprache (Server liefert einen Code)
  function errorText(body, status) {
    if (body && body.code) return t('err.' + body.code);
    return t(status === 413 ? 'err.too_large' : 'gb.failed');
  }

  /* ---------- Übersetzen ----------
     Übersetzt wird in die Sprache des Geräts/Browsers (nicht die der Seite).
     Der Server merkt sich jede Übersetzung, DeepL wird pro Eintrag und
     Sprache nur einmal gefragt. */
  const deviceLang = navigator.language || 'en';
  const translated = new Map(); // entry.id -> { text, source, showing }

  function languageName(code) {
    try {
      return new Intl.DisplayNames([window.I18N.locale], { type: 'language' }).of(code.toLowerCase());
    } catch (_) {
      return code;
    }
  }

  function translateRow(entry, msg) {
    const row = el('div', 'gb-tr');
    const btn = el('button', 'gb-tr-btn');
    btn.type = 'button';
    const note = el('span', 'gb-tr-note');

    function show() {
      const state = translated.get(entry.id);
      const showing = state && state.showing;
      msg.textContent = showing ? state.text : entry.message;
      msg.lang = showing ? deviceLang : '';
      note.textContent = showing
        ? (state.source ? t('gb.translatedFrom', { lang: languageName(state.source) }) : t('gb.translatedFromUnknown'))
        : '';
      btn.textContent = showing ? t('gb.showOriginal') : t('gb.translate');
    }

    btn.addEventListener('click', async () => {
      const state = translated.get(entry.id);
      if (state) { // schon übersetzt: nur umschalten
        state.showing = !state.showing;
        show();
        return;
      }
      btn.disabled = true;
      btn.textContent = t('gb.translating');
      try {
        const res = await fetch(`${API}/${entry.id}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: deviceLang }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(errorText(body, res.status));
        } else if (body.same) {
          toast(t('gb.alreadyYourLanguage'));
        } else {
          translated.set(entry.id, { text: body.text, source: body.source, showing: true });
        }
      } catch (_) {
        toast(t('gb.offline'));
      } finally {
        btn.disabled = false;
        show();
      }
    });

    show();
    row.append(btn, note);
    return row;
  }

  /* ---------- Reaktionen ----------
     Pro Gerät zählt jedes Emoji einmal. Das Gerät erkennt der Server an einer
     zufälligen ID, welche Knöpfe gedrückt sind, merkt sich der Browser. */
  const VOTER_KEY = 'gb-voter';
  const REACTED_KEY = 'gb-reacted';

  let voter = '';
  try { voter = localStorage.getItem(VOTER_KEY) || ''; } catch (_) { /* kein Storage */ }
  if (!/^[0-9a-f]{32}$/.test(voter)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    voter = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(VOTER_KEY, voter); } catch (_) { /* gilt dann nur bis zum Neuladen */ }
  }

  let reacted = new Set(); // "id:emoji"
  try { reacted = new Set(JSON.parse(localStorage.getItem(REACTED_KEY) || '[]')); } catch (_) { /* leer */ }
  function saveReacted() {
    try { localStorage.setItem(REACTED_KEY, JSON.stringify([...reacted])); } catch (_) { /* egal */ }
  }

  function reactRow(entry) {
    const row = el('div', 'gb-react');
    const refreshers = [];
    entry.reactions ||= {};
    for (const emoji of REACTIONS) {
      const btn = el('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', t('gb.react', { emoji }));
      const count = el('span', 'gb-react-n');
      btn.append(el('span', 'gb-react-emoji', emoji), count);
      const key = entry.id + ':' + emoji;

      function show() {
        const n = entry.reactions[emoji] || 0;
        count.textContent = n ? String(n) : '';
        btn.setAttribute('aria-pressed', String(reacted.has(key)));
      }

      btn.addEventListener('click', async () => {
        const on = !reacted.has(key);
        const before = entry.reactions[emoji] || 0;
        // sofort anzeigen, danach mit den Zahlen vom Server abgleichen
        if (on) reacted.add(key); else reacted.delete(key);
        entry.reactions[emoji] = Math.max(0, before + (on ? 1 : -1));
        show();
        btn.disabled = true;
        try {
          const res = await fetch(`${API}/${entry.id}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji, voter, on }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw Object.assign(body, { status: res.status });
          entry.reactions = body.reactions || {};
          saveReacted();
        } catch (err) {
          if (on) reacted.delete(key); else reacted.add(key);
          entry.reactions[emoji] = before;
          toast(err && err.status ? errorText(err, err.status) : t('gb.offline'));
        } finally {
          btn.disabled = false;
          // andere Knöpfe des Eintrags auch auffrischen (neue Zahlen vom Server)
          refreshers.forEach((f) => f());
        }
      });

      refreshers.push(show);
      show();
      row.append(btn);
    }
    return row;
  }

  async function removeEntry(entry, li) {
    if (!confirm(t('gb.confirmDelete', { name: entry.name }))) return;
    try {
      const res = await fetch(`${API}/${entry.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': adminToken },
      });
      if (res.status === 204 || res.status === 404) {
        entries = entries.filter((e) => e.id !== entry.id);
        li.remove();
        toast(t('gb.deleted'));
        if (!entries.length) render();
      } else if (res.status === 403) {
        toast(t('gb.adminInvalid'));
      } else {
        toast(t('gb.deleteFailed'));
      }
    } catch (_) {
      toast(t('gb.offline'));
    }
  }

  /* ---------- Lightbox ---------- */
  const lightboxImg = lightbox.querySelector('img');
  function openLightbox(src) {
    lightboxImg.src = src;
    if (lightbox.showModal) lightbox.showModal();
    else window.open(src, '_blank', 'noopener');
  }
  lightbox.addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('close', () => { lightboxImg.removeAttribute('src'); });

  window.addEventListener('langchange', () => {
    renderPreviews();
    if (entries) render();
  });

  renderPreviews();
  load();
})();
