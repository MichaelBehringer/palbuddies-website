(() => {
  'use strict';

  /* Gästebuch. Backend: server/ im Repo, erreichbar unter /api/guestbook.
     Admin-Modus (Löschen): Seite einmal mit #admin=<token> öffnen,
     mit #admin=off wieder abmelden. */

  const API = '/api/guestbook';
  const MAX_IMAGES = 3;
  const MAX_SIDE = 1600;
  const ADMIN_KEY = 'gb-admin';

  const $ = (sel) => document.querySelector(sel);
  const form = $('#gb-form');
  if (!form) return;
  const list = $('#gb-list');
  const fileInput = $('#gb-file');
  const fileLabel = $('#gb-file-label');
  const previews = $('#gb-previews');
  const lightbox = $('#gb-lightbox');
  const submitBtn = form.querySelector('.gb-submit');

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
    setTimeout(() => toast(adminToken ? 'Admin-Modus an' : 'Admin-Modus aus'), 300);
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

  function renderPreviews() {
    previews.replaceChildren(...images.map((item, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'gb-preview';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = `Bild ${i + 1}`;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';
      del.setAttribute('aria-label', `Bild ${i + 1} entfernen`);
      del.addEventListener('click', () => {
        URL.revokeObjectURL(item.url);
        images.splice(i, 1);
        renderPreviews();
      });
      wrap.append(img, del);
      return wrap;
    }));
    const left = MAX_IMAGES - images.length;
    fileLabel.textContent = images.length ? `${images.length}/${MAX_IMAGES} Bilder` : 'Bilder';
    fileInput.parentElement.classList.toggle('is-full', left === 0);
    fileInput.disabled = left === 0;
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
    if (files.length > free) toast(`Maximal ${MAX_IMAGES} Bilder`);
    for (const file of files.slice(0, free)) {
      try {
        const blob = await compress(file);
        images.push({ blob, url: URL.createObjectURL(blob) });
      } catch (_) {
        toast('Bildformat nicht unterstützt');
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
      toast('Bitte Name und Nachricht ausfüllen');
      return;
    }

    const data = new FormData();
    data.append('name', name);
    data.append('message', message);
    data.append('website', form.elements.website.value);
    images.forEach((item, i) => data.append('images', item.blob, `bild${i + 1}.jpg`));

    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = images.length ? 'Wird hochgeladen …' : 'Wird gesendet …';
    try {
      const res = await fetch(API, { method: 'POST', body: data });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body.error || (res.status === 413 ? 'Zu groß – maximal 12 MB' : 'Hat leider nicht geklappt'));
        return;
      }
      form.reset();
      clearImages();
      toast('Danke für deinen Eintrag ✓');
      load();
    } catch (_) {
      toast('Keine Verbindung – bitte nochmal versuchen');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  /* ---------- Einträge anzeigen ----------
     Nutzertext nur über textContent, nie über innerHTML (Schutz vor XSS). */
  const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  const isImageURL = (u) => typeof u === 'string' && u.startsWith(API + '/img/');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderEntry(entry) {
    const li = el('li', 'gb-entry');

    const head = el('div', 'gb-head');
    const time = el('time', 'gb-date', dateFmt.format(entry.created * 1000));
    time.dateTime = new Date(entry.created * 1000).toISOString();
    head.append(el('strong', 'gb-name', entry.name), time);
    li.append(head, el('p', 'gb-msg', entry.message));

    const imgs = (entry.images || []).filter((im) => isImageURL(im.full) && isImageURL(im.thumb));
    if (imgs.length) {
      const grid = el('div', 'gb-images');
      imgs.forEach((im, i) => {
        const btn = el('button', 'gb-thumb');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Bild ${i + 1} von ${entry.name} vergrößern`);
        const img = el('img');
        img.src = im.thumb;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.append(img);
        btn.addEventListener('click', () => openLightbox(im.full));
        grid.append(btn);
      });
      li.append(grid);
    }

    if (adminToken) {
      const del = el('button', 'gb-del', '✕');
      del.type = 'button';
      del.setAttribute('aria-label', `Eintrag von ${entry.name} löschen`);
      del.addEventListener('click', () => removeEntry(entry, li));
      li.append(del);
    }
    return li;
  }

  async function load() {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const entries = await res.json();
      if (!entries.length) {
        list.replaceChildren(el('li', 'gb-empty', 'Noch keine Einträge – schreib den ersten!'));
        return;
      }
      list.replaceChildren(...entries.map(renderEntry));
    } catch (_) {
      list.replaceChildren(el('li', 'gb-empty', 'Gästebuch gerade nicht erreichbar'));
    }
  }

  async function removeEntry(entry, li) {
    if (!confirm(`Eintrag von „${entry.name}“ wirklich löschen?`)) return;
    try {
      const res = await fetch(`${API}/${entry.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': adminToken },
      });
      if (res.status === 204 || res.status === 404) {
        li.remove();
        toast('Gelöscht ✓');
        if (!list.children.length) load();
      } else if (res.status === 403) {
        toast('Admin-Token ungültig');
      } else {
        toast('Löschen hat nicht geklappt');
      }
    } catch (_) {
      toast('Keine Verbindung');
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

  load();
})();
