(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function haptic(ms = 10) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  /* ---------- Jahr im Footer ---------- */
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Teilen ---------- */
  $('#share').addEventListener('click', async () => {
    const data = {
      title: 'PalBuddies',
      text: 'Check die PalBuddies auf Insta & TikTok 🤙',
      url: location.origin + location.pathname,
    };
    haptic();
    if (navigator.share) {
      try { await navigator.share(data); } catch (_) { /* abgebrochen */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(data.url);
      toast('Link kopiert ✓');
    } catch (_) {
      toast(data.url);
    }
  });
})();
