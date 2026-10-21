/* Besucherzähler: meldet den Aufruf an /api/guestbook/visit und zeigt dann
   Besucher heute, gesamt und nach Land. Gezählt wird jedes Gerät einmal pro
   Tag (zufällige Geräte-ID aus guestbook.js), Admins zählen nicht mit. */
(() => {
  'use strict';

  const GB = window.GB;
  const box = document.getElementById('stats');
  if (!GB || !box) return;
  const { t } = window.I18N;
  const counts = document.getElementById('st-counts');
  const list = document.getElementById('st-countries');

  let stats = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // "JP" -> 🇯🇵 (zwei Regional-Indicator-Zeichen)
  const flag = (code) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

  function countryName(code) {
    try {
      return new Intl.DisplayNames([window.I18N.locale], { type: 'region' }).of(code);
    } catch (_) {
      return code;
    }
  }

  function render() {
    if (!stats) return;
    const nf = new Intl.NumberFormat(window.I18N.locale);
    const num = (n) => el('strong', null, nf.format(n));
    counts.replaceChildren(
      '👀 ', t('st.today'), ' ', num(stats.today),
      el('span', 'st-sep', ' · '),
      t('st.total'), ' ', num(stats.total),
    );

    const items = (stats.countries || [])
      .filter((c) => /^[A-Z]{2}$/.test(c.code))
      .map((c) => {
        const li = el('li');
        const name = countryName(c.code);
        li.title = name;
        li.setAttribute('aria-label', t('st.country', { name, n: c.n }));
        li.append(el('span', 'st-flag', flag(c.code)), el('span', 'st-n', nf.format(c.n)));
        return li;
      });
    if (stats.others > 0) {
      const li = el('li');
      li.title = t('st.others');
      li.setAttribute('aria-label', t('st.country', { name: t('st.others'), n: stats.others }));
      li.append(el('span', 'st-flag', '🌍'), el('span', 'st-n', nf.format(stats.others)));
      items.push(li);
    }
    list.replaceChildren(...items);
    list.hidden = !items.length;
    box.hidden = false;
  }

  async function load() {
    try {
      const res = await fetch(GB.API + '/stats', { cache: 'no-store' });
      if (!res.ok) return;
      stats = await res.json();
      render();
    } catch (_) { /* ohne Zahlen bleibt der Bereich ausgeblendet */ }
  }

  async function start() {
    const headers = { 'Content-Type': 'application/json' };
    if (GB.adminToken) headers['X-Admin-Token'] = GB.adminToken;
    try {
      await fetch(GB.API + '/visit', {
        method: 'POST', headers, body: JSON.stringify({ voter: GB.voter }), keepalive: true,
      });
    } catch (_) { /* Zahlen trotzdem zeigen */ }
    load();
  }

  window.addEventListener('langchange', render);
  start();
})();
