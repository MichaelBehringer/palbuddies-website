/* Sprache DE/EN für die ganze Seite.
   - Erster Besuch: Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch.
   - Umschalter oben rechts, die Wahl wird gemerkt.
   - Feste Texte stehen unten in TEXTE, Reiseplan-Texte in reise.js
     (Feld mit _en, z. B. was_en).
   - Andere Skripte: I18N.t('schluessel', { n: 3 }), I18N.pick(objekt, 'was'),
     I18N.locale, und Event 'langchange' auf window zum Neuzeichnen. */
window.I18N = (() => {
  'use strict';

  const KEY = 'lang';

  const TEXTE = {
    de: {
      'lang.label': 'Sprache',
      'meta.description': 'PalBuddies – Berry, DjDave, Wokky & Tim_TMTM. Folg uns auf Instagram und TikTok: @palbuddies',
      'route.title': 'Unsere Route',
      'crew.title': 'Die Crew',
      'crew.on': '{name} auf Instagram ({handle})',
      'share.button': 'Seite teilen',
      'share.text': 'Check die PalBuddies auf Insta & TikTok 🤙',
      'share.copied': 'Link kopiert ✓',

      'trip.eyebrow': 'Unsere Reise',
      'trip.departure': 'Abflug in',
      'trip.day': 'Tag',
      'trip.days': 'Tage',
      'trip.hours': 'Std',
      'trip.minutes': 'Min',
      'trip.seconds': 'Sek',
      'trip.fromFrankfurt': '{day} · {time} ab Frankfurt ✈️ {place}',
      'trip.home': 'Wieder daheim 🏠',
      'trip.summary': '{days} Tage · {cities} Städte · {countries} Länder. Danke fürs Mitfiebern!',
      'trip.dayOf': 'Tag {n} von {total}',
      'trip.currentlyIn': '📍 Gerade in {place} · {time} Uhr Ortszeit',
      'trip.currentlyInShort': '📍 Gerade in {place}',
      'trip.travelDay': '🧳 Reisetag: {from} → {to}',
      'trip.onTheWayTo': '✈️ Unterwegs nach {place}',
      'trip.onTheWay': '✈️ Unterwegs',
      'trip.today': 'Heute geplant',
      'trip.now': 'Jetzt',
      'trip.night': 'Nacht',
      'trip.nights': 'Nächte',
      'trip.tbd': 'Programm folgt … 🤫',
      'trip.map': 'Karte',
      'trip.weatherIn': '{icon} In {place} gerade {temp} °C\n{sky} · {time} Uhr',
      'wx.clear': 'Klar',
      'wx.mostlyClear': 'Überwiegend klar',
      'wx.partlyCloudy': 'Teils bewölkt',
      'wx.cloudy': 'Bewölkt',
      'wx.fog': 'Nebel',
      'wx.drizzle': 'Nieselregen',
      'wx.rain': 'Regen',
      'wx.snow': 'Schnee',
      'wx.showers': 'Schauer',
      'wx.thunder': 'Gewitter',

      'gb.title': 'Gästebuch',
      'gb.name': 'Dein Name',
      'gb.message': 'Lass uns einen Gruß da 🤙',
      'gb.messageLabel': 'Nachricht',
      'gb.nameLabel': 'Name',
      'gb.photo': 'Foto',
      'gb.addPhotos': 'Fotos hinzufügen',
      'gb.hint': 'Bis zu {max} Fotos',
      'gb.hintCount': '{n} von {max} Fotos',
      'gb.submit': 'Eintragen',
      'gb.uploading': 'Wird hochgeladen …',
      'gb.sending': 'Wird gesendet …',
      'gb.thanks': 'Danke für deinen Eintrag ✓',
      'gb.fillIn': 'Bitte Name und Nachricht ausfüllen',
      'gb.maxPhotos': 'Maximal {max} Fotos',
      'gb.badFormat': 'Bildformat nicht unterstützt',
      'gb.offline': 'Keine Verbindung – bitte nochmal versuchen',
      'gb.failed': 'Hat leider nicht geklappt',
      'gb.empty': 'Noch keine Einträge – schreib den ersten!',
      'gb.unavailable': 'Gästebuch gerade nicht erreichbar',
      'gb.photoN': 'Foto {n}',
      'gb.removePhoto': 'Foto {n} entfernen',
      'gb.enlarge': 'Bild {n} von {name} vergrößern',
      'gb.delete': 'Eintrag von {name} löschen',
      'gb.confirmDelete': 'Eintrag von „{name}“ wirklich löschen?',
      'gb.deleted': 'Gelöscht ✓',
      'gb.deleteFailed': 'Löschen hat nicht geklappt',
      'gb.adminOn': 'Admin-Modus an',
      'gb.adminOff': 'Admin-Modus aus',
      'gb.adminInvalid': 'Admin-Token ungültig',
      'gb.translate': 'Übersetzen',
      'gb.translating': 'Wird übersetzt …',
      'gb.showOriginal': 'Original anzeigen',
      'gb.translatedFrom': 'Übersetzt aus: {lang}',
      'gb.translatedFromUnknown': 'Übersetzt',
      'gb.alreadyYourLanguage': 'Der Eintrag ist schon in deiner Sprache',
      'gb.image': 'Bild',
      'gb.react': 'Mit {emoji} reagieren',

      'mo.title': 'Unterwegs',
      'mo.caption': 'Was machen wir gerade?',
      'mo.captionLabel': 'Bildunterschrift',
      'mo.station': 'Station',
      'mo.noStation': 'Keine Station',
      'mo.place': 'Ort genauer (optional), z. B. Fushimi Inari',
      'mo.placeLabel': 'Ort',
      'mo.submit': 'Posten',
      'mo.posted': 'Gepostet ✓',
      'mo.needPhoto': 'Bitte mindestens ein Foto auswählen',
      'mo.needCaption': 'Bitte eine Bildunterschrift schreiben',
      'mo.gpsFound': '📍 Position aus dem Foto übernommen ({lat}, {lon})',
      'mo.gpsRemove': 'Entfernen',
      'mo.localTime': '{time} Ortszeit',
      'mo.onMap': 'Auf der Karte zeigen',
      'mo.enlarge': 'Foto {n} vergrößern',
      'mo.delete': 'Foto-Post löschen',
      'mo.confirmDelete': 'Diesen Foto-Post wirklich löschen?',
      'mo.empty': 'Noch keine Fotos – poste das erste!',
      'mo.new': 'Neu',
      'mo.photo1': '1 Foto',
      'mo.photos': '{n} Fotos',
      'mo.lastIn': 'zuletzt {place}, {ago}',
      'mo.justNow': 'gerade eben',

      'st.title': 'Besucher',
      'st.today': 'Heute',
      'st.total': 'Gesamt',
      'st.country': '{name}: {n}',
      'st.others': 'Andere Länder',

      'err.too_large': 'Zu groß – maximal 12 MB',
      'err.invalid': 'Ungültige Anfrage',
      'err.text': 'Name (max. 40) und Nachricht (max. 500 Zeichen) ausfüllen',
      'err.too_many_images': 'Maximal 3 Fotos',
      'err.rate_limited': 'Bitte kurz warten und nochmal versuchen',
      'err.daily_images': 'Heute wurden schon sehr viele Fotos hochgeladen – probier es morgen nochmal',
      'err.bad_image': 'Bildformat nicht unterstützt (JPEG, PNG oder WebP)',
      'err.not_found': 'Eintrag nicht gefunden',
      'err.translate_unavailable': 'Übersetzung gerade nicht verfügbar',
      'err.translate_daily': 'Für heute sind keine Übersetzungen mehr frei',
      'err.translate_failed': 'Übersetzung hat nicht geklappt',
      'err.internal': 'Da ist etwas schiefgegangen',
      'err.moment_text': 'Bildunterschrift (max. 300 Zeichen) ausfüllen',
      'err.moment_images': '1 bis 6 Fotos',
    },

    en: {
      'lang.label': 'Language',
      'meta.description': 'PalBuddies – Berry, DjDave, Wokky & Tim_TMTM. Follow us on Instagram and TikTok: @palbuddies',
      'route.title': 'Our Route',
      'crew.title': 'The Crew',
      'crew.on': '{name} on Instagram ({handle})',
      'share.button': 'Share page',
      'share.text': 'Check out the PalBuddies on Insta & TikTok 🤙',
      'share.copied': 'Link copied ✓',

      'trip.eyebrow': 'Our Trip',
      'trip.departure': 'Take-off in',
      'trip.day': 'Day',
      'trip.days': 'Days',
      'trip.hours': 'Hrs',
      'trip.minutes': 'Min',
      'trip.seconds': 'Sec',
      'trip.fromFrankfurt': '{day} · {time} from Frankfurt ✈️ {place}',
      'trip.home': 'Back home 🏠',
      'trip.summary': '{days} days · {cities} cities · {countries} countries. Thanks for following along!',
      'trip.dayOf': 'Day {n} of {total}',
      'trip.currentlyIn': '📍 Currently in {place} · {time} local time',
      'trip.currentlyInShort': '📍 Currently in {place}',
      'trip.travelDay': '🧳 Travel day: {from} → {to}',
      'trip.onTheWayTo': '✈️ On our way to {place}',
      'trip.onTheWay': '✈️ On the move',
      'trip.today': 'Today’s plan',
      'trip.now': 'Now',
      'trip.night': 'night',
      'trip.nights': 'nights',
      'trip.tbd': 'Plans coming soon … 🤫',
      'trip.map': 'Map',
      'trip.weatherIn': '{icon} {temp} °C in {place} right now\n{sky} · {time}',
      'wx.clear': 'Clear',
      'wx.mostlyClear': 'Mostly clear',
      'wx.partlyCloudy': 'Partly cloudy',
      'wx.cloudy': 'Cloudy',
      'wx.fog': 'Fog',
      'wx.drizzle': 'Drizzle',
      'wx.rain': 'Rain',
      'wx.snow': 'Snow',
      'wx.showers': 'Showers',
      'wx.thunder': 'Thunderstorm',

      'gb.title': 'Guestbook',
      'gb.name': 'Your name',
      'gb.message': 'Leave us a message 🤙',
      'gb.messageLabel': 'Message',
      'gb.nameLabel': 'Name',
      'gb.photo': 'Photo',
      'gb.addPhotos': 'Add photos',
      'gb.hint': 'Up to {max} photos',
      'gb.hintCount': '{n} of {max} photos',
      'gb.submit': 'Post',
      'gb.uploading': 'Uploading …',
      'gb.sending': 'Sending …',
      'gb.thanks': 'Thanks for your message ✓',
      'gb.fillIn': 'Please enter your name and a message',
      'gb.maxPhotos': 'Up to {max} photos',
      'gb.badFormat': 'Image format not supported',
      'gb.offline': 'No connection – please try again',
      'gb.failed': 'Something went wrong',
      'gb.empty': 'No messages yet – be the first!',
      'gb.unavailable': 'Guestbook currently unavailable',
      'gb.photoN': 'Photo {n}',
      'gb.removePhoto': 'Remove photo {n}',
      'gb.enlarge': 'Enlarge image {n} from {name}',
      'gb.delete': 'Delete message from {name}',
      'gb.confirmDelete': 'Really delete the message from “{name}”?',
      'gb.deleted': 'Deleted ✓',
      'gb.deleteFailed': 'Couldn’t delete',
      'gb.adminOn': 'Admin mode on',
      'gb.adminOff': 'Admin mode off',
      'gb.adminInvalid': 'Invalid admin token',
      'gb.translate': 'Translate',
      'gb.translating': 'Translating …',
      'gb.showOriginal': 'Show original',
      'gb.translatedFrom': 'Translated from {lang}',
      'gb.translatedFromUnknown': 'Translated',
      'gb.alreadyYourLanguage': 'This message is already in your language',
      'gb.image': 'Image',
      'gb.react': 'React with {emoji}',

      'mo.title': 'On the road',
      'mo.caption': 'What are we up to?',
      'mo.captionLabel': 'Caption',
      'mo.station': 'Stop',
      'mo.noStation': 'No stop',
      'mo.place': 'Exact place (optional), e.g. Fushimi Inari',
      'mo.placeLabel': 'Place',
      'mo.submit': 'Post',
      'mo.posted': 'Posted ✓',
      'mo.needPhoto': 'Please pick at least one photo',
      'mo.needCaption': 'Please write a caption',
      'mo.gpsFound': '📍 Location taken from the photo ({lat}, {lon})',
      'mo.gpsRemove': 'Remove',
      'mo.localTime': '{time} local time',
      'mo.onMap': 'Show on map',
      'mo.enlarge': 'Enlarge photo {n}',
      'mo.delete': 'Delete photo post',
      'mo.confirmDelete': 'Really delete this photo post?',
      'mo.empty': 'No photos yet – post the first one!',
      'mo.new': 'New',
      'mo.photo1': '1 photo',
      'mo.photos': '{n} photos',
      'mo.lastIn': 'latest: {place}, {ago}',
      'mo.justNow': 'just now',

      'st.title': 'Visitors',
      'st.today': 'Today',
      'st.total': 'Total',
      'st.country': '{name}: {n}',
      'st.others': 'Other countries',

      'err.too_large': 'Too large – 12 MB max',
      'err.invalid': 'Invalid request',
      'err.text': 'Please enter a name (max. 40) and a message (max. 500 characters)',
      'err.too_many_images': 'Up to 3 photos',
      'err.rate_limited': 'Please wait a moment and try again',
      'err.daily_images': 'Lots of photos were uploaded today already – please try again tomorrow',
      'err.bad_image': 'Image format not supported (JPEG, PNG or WebP)',
      'err.not_found': 'Message not found',
      'err.translate_unavailable': 'Translation currently unavailable',
      'err.translate_daily': 'No more translations available today',
      'err.translate_failed': 'Translation failed',
      'err.internal': 'Something went wrong',
      'err.moment_text': 'Please add a caption (max. 300 characters)',
      'err.moment_images': '1 to 6 photos',
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'de' || saved === 'en') return saved;
    } catch (_) { /* kein Storage */ }
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return first.toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  let lang = detect();

  const api = {
    get lang() { return lang; },
    // Zahlen-/Datumsformat passend zur Sprache (Englisch mit 24-h-Uhr)
    get locale() { return lang === 'de' ? 'de-DE' : 'en-GB'; },

    t(key, vars) {
      let s = TEXTE[lang][key] ?? TEXTE.de[key] ?? key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
      return s;
    },

    // Feld aus reise.js in der aktuellen Sprache, z. B. pick(p, 'was') -> p.was_en
    pick(obj, field) {
      if (!obj) return '';
      if (lang === 'en' && obj[field + '_en'] != null) return obj[field + '_en'];
      return obj[field];
    },

    set(next) {
      if (next === lang || !TEXTE[next]) return;
      lang = next;
      try { localStorage.setItem(KEY, lang); } catch (_) { /* gilt dann nur für diesen Besuch */ }
      apply();
      window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    },
  };

  // Feste Texte im HTML: data-i18n="schluessel" (Text),
  // data-i18n-attr="placeholder:schluessel;aria-label:schluessel2"
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = api.t(node.dataset.i18n, node.dataset.i18nVars ? JSON.parse(node.dataset.i18nVars) : null);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
      for (const pair of node.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        node.setAttribute(attr.trim(), api.t(key.trim(), node.dataset.i18nVars ? JSON.parse(node.dataset.i18nVars) : null));
      }
    });
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = api.t('meta.description');
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  function init() {
    apply();
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.addEventListener('click', () => api.set(b.dataset.lang));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return api;
})();
