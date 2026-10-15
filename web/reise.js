/* ==========================================================
   REISEPLAN – nur diese Datei bearbeiten!
   ----------------------------------------------------------
   - Datum immer so schreiben: "JJJJ-MM-TT"  (z. B. "2026-11-04")
   - Stationen in der richtigen Reihenfolge lassen.
   - Station nicht auf der Karte zeigen:  karte: false
   - Zusätzliche Punkte nur für die Karte: unten bei "kartenpunkte"
   - Programmpunkt hinzufügen: in "plan" eine Zeile ergänzen:
         { tag: "2026-10-30", was: "Dotonbori Streetfood" },
     (Komma am Ende nicht vergessen)
   - Optional mit Uhrzeit:
         { tag: "2026-10-30", zeit: "19:00", was: "Karaoke" },
   - Beschriftung auf der Karte verschieben (optional):
         beschriftung: "oben" | "unten" | "links" | "rechts"
   - Englisch: neben jedes Feld dieselbe Angabe mit _en schreiben,
     z. B.  was: "Abends Karaoke", was_en: "Karaoke in the evening"
     (geht auch für ort, land, anreise, zeit, zusatz, titel).
     Fehlt _en, wird auf Englisch der deutsche Text gezeigt.
   - Zum Testen, wie die Seite an einem anderen Tag aussieht:
         https://palbuddies.behringer.dev/?datum=2026-11-05
   ========================================================== */

window.REISE = {
  titel: "Japan & Taiwan",

  // Abflug Frankfurt und Landung zurück in Frankfurt (deutsche Zeit, +01:00 = Winterzeit)
  abflug:    "2026-10-27T18:40:00+01:00",
  rueckkehr: "2026-11-20T16:35:00+01:00",

  // Punkte, die nur auf der Karte erscheinen (nicht im Zeitplan).
  // von/bis = wann der Punkt als "Jetzt" / "vorbei" markiert wird.
  kartenpunkte: [
    {
      ort: "Taichung", zusatz: "Tim", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [24.15, 120.67],
      von: "2026-11-05", bis: "2026-11-10",
    },
  ],

  stationen: [
    /* ---------- Anreise ---------- */
    {
      ort: "Shanghai", land: "China", flagge: "🇨🇳",
      zeitzone: "Asia/Shanghai", lage: [31.23, 121.47],
      von: "2026-10-28", bis: "2026-10-29",
      anreise: "✈️ FRA 18:40 → PVG 12:40 (+1 Tag)",
      anreise_en: "✈️ FRA 18:40 → PVG 12:40 (+1 day)",
      plan: [
      ],
    },

    /* ---------- Block 1: Kansai ---------- */
    {
      ort: "Osaka", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.69, 135.50],
      von: "2026-10-29", bis: "2026-11-02",
      anreise: "✈️ PVG 11:30 → KIX 15:00 · 🚆 Nankai nach Namba",
      anreise_en: "✈️ PVG 11:30 → KIX 15:00 · 🚆 Nankai line to Namba",
      plan: [
        { tag: "2026-10-29", zeit: "15:00", was: "Landung in Kansai, mit der Nankai nach Namba", was_en: "Land at Kansai, take the Nankai line to Namba" },
        { tag: "2026-10-29", was: "Dotonbori, Glico-Schild, Takoyaki & erstes Bier 🍻", was_en: "Dotonbori, the Glico sign, takoyaki & first beer 🍻" },

        { tag: "2026-10-30", was: "Osaka Castle & Park" },
        { tag: "2026-10-30", was: "Kuromon-Ichiba-Markt – einmal durchessen", was_en: "Kuromon Ichiba Market – eat our way through" },
        { tag: "2026-10-30", was: "Shinsekai & Tsutenkaku mit Kushikatsu", was_en: "Shinsekai & Tsutenkaku with kushikatsu" },
        { tag: "2026-10-30", was: "Sonnenuntergang im Umeda Sky Building", was_en: "Sunset at the Umeda Sky Building" },
        { tag: "2026-10-30", was: "Abends Namba & Amerikamura", was_en: "Evening in Namba & Amerikamura" },

        { tag: "2026-10-31", was: "Nara: Todai-ji mit Riesen-Buddha, Hirsche, Kasuga-Taisha 🦌", was_en: "Nara: Todai-ji with the Great Buddha, deer, Kasuga-Taisha 🦌" },
        { tag: "2026-10-31", was: "Halloween-Straßenparty in Amerikamura & Shinsaibashi 🎃", was_en: "Halloween street party in Amerikamura & Shinsaibashi 🎃" },

        { tag: "2026-11-01", was: "Himeji-Burg + Kobe-Beef in Sannomiya – oder Chill-Tag", was_en: "Himeji Castle + Kobe beef in Sannomiya – or a chill day" },
        { tag: "2026-11-01", was: "Früh ins Bett, Rucksack packen", was_en: "Early night, pack the backpacks" },
      ],
    },
    {
      ort: "Koyasan", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.21, 135.59],
      von: "2026-11-02", bis: "2026-11-03",
      anreise: "🥾 Chōishi-michi (24 km Pilgerweg)",
      anreise_en: "🥾 Chōishi-michi (24 km pilgrimage trail)",
      karte: false,
      plan: [
        { tag: "2026-11-02", was: "Wanderung auf dem Chōishi-michi hoch nach Koyasan", was_en: "Hike the Chōishi-michi up to Koyasan" },
        { tag: "2026-11-02", was: "Übernachtung im Tempel ⛩️", was_en: "Overnight stay at a temple ⛩️" },
        { tag: "2026-11-03", was: "Morgens Okunoin-Friedhof", was_en: "Morning at Okunoin cemetery" },
        { tag: "2026-11-03", was: "Mittags zurück nach Osaka", was_en: "Back to Osaka around noon" },
      ],
    },
    {
      ort: "Osaka", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.69, 135.50],
      von: "2026-11-03", bis: "2026-11-05",
      anreise: "🚆 Koyasan → Osaka",
      plan: [
        { tag: "2026-11-04", was: "Puffertag: Universal Studios, Kobe, teamLab, Spa World – oder nichts", was_en: "Buffer day: Universal Studios, Kobe, teamLab, Spa World – or nothing at all" },
        { tag: "2026-11-04", was: "Falls Hanshin im Koshien spielt: sofort hin ⚾", was_en: "If the Hanshin Tigers play at Koshien: straight there ⚾" },
        { tag: "2026-11-05", was: "Vormittag frei, nachmittags Flug nach Taipeh", was_en: "Free morning, afternoon flight to Taipei" },
      ],
    },

    /* ---------- Block 2: Taiwan ---------- */
    {
      ort: "Taipeh", ort_en: "Taipei", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [25.03, 121.56],
      von: "2026-11-05", bis: "2026-11-08",
      anreise: "✈️ KIX → TPE · 🚇 Airport-MRT ins Zentrum",
      anreise_en: "✈️ KIX → TPE · 🚇 Airport MRT to the city centre",
      karte: false,                      // auf der Karte steht nur Taichung (Tim)
      plan: [
        { tag: "2026-11-05", was: "Ankunft, mit der Airport-MRT ins Zentrum", was_en: "Arrival, Airport MRT to the city centre" },
        { tag: "2026-11-05", was: "Abends Ximending oder Ningxia-Nachtmarkt", was_en: "Evening in Ximending or at Ningxia Night Market" },

        { tag: "2026-11-06", was: "Longshan-Tempel & Bopiliao", was_en: "Longshan Temple & Bopiliao" },
        { tag: "2026-11-06", was: "Chiang-Kai-shek-Gedenkhalle", was_en: "Chiang Kai-shek Memorial Hall" },
        { tag: "2026-11-06", was: "Taipei 101 & Sonnenuntergang auf dem Elephant Mountain", was_en: "Taipei 101 & sunset on Elephant Mountain" },
        { tag: "2026-11-06", was: "Raohe-Nachtmarkt", was_en: "Raohe Night Market" },

        { tag: "2026-11-07", was: "Beitou: heiße Quellen im Thermal Valley ♨️", was_en: "Beitou: hot springs at Thermal Valley ♨️" },
        { tag: "2026-11-07", was: "Wandern im Yangmingshan-Nationalpark (Qixing-Gipfel)", was_en: "Hiking in Yangmingshan National Park (Qixing peak)" },
        { tag: "2026-11-07", was: "Shilin-Nachtmarkt", was_en: "Shilin Night Market" },
      ],
    },
    {
      ort: "Tianzhong", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [23.86, 120.59],
      von: "2026-11-08", bis: "2026-11-08",
      anreise: "🚄 Taipeh → Tianzhong",
      anreise_en: "🚄 Taipei → Tianzhong",
      karte: false,
      plan: [
        { tag: "2026-11-08", was: "Tianzhong 2026 Halbmarathon 🏃‍♂️🏅", was_en: "Tianzhong 2026 Half Marathon 🏃‍♂️🏅" },
      ],
    },
    {
      ort: "Taipeh", ort_en: "Taipei", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [25.03, 121.56],
      von: "2026-11-08", bis: "2026-11-10",
      anreise: "🚄 Tianzhong → Taipeh",
      anreise_en: "🚄 Tianzhong → Taipei",
      karte: false,
      plan: [
        { tag: "2026-11-09", was: "Tagestour Jiufen, Shifen & Yehliu an der Nordostküste", was_en: "Day trip to Jiufen, Shifen & Yehliu on the northeast coast" },
        { tag: "2026-11-10", was: "Frühstück & Souvenirs, nachmittags Flug nach Tokio", was_en: "Breakfast & souvenirs, afternoon flight to Tokyo" },
      ],
    },

    /* ---------- Block 3: Tokio → Nagoya → Kyoto ---------- */
    {
      ort: "Tokio", ort_en: "Tokyo", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.68, 139.69],
      von: "2026-11-10", bis: "2026-11-15",
      anreise: "✈️ TPE → Tokio",
      anreise_en: "✈️ TPE → Tokyo",
      plan: [
        { tag: "2026-11-10", was: "Ankunft am Abend", was_en: "Arrival in the evening" },

        { tag: "2026-11-11", was: "Shibuya, Harajuku & Takeshita-dori" },
        { tag: "2026-11-11", was: "Meiji-Schrein", was_en: "Meiji Shrine" },
        { tag: "2026-11-11", was: "Abends Golden Gai in Shinjuku", was_en: "Evening at Golden Gai in Shinjuku" },

        { tag: "2026-11-12", was: "Ghibli Museum Mitaka, durch den Inokashira-Park", was_en: "Ghibli Museum Mitaka, through Inokashira Park" },
        { tag: "2026-11-12", was: "Kichijoji & Harmonica Yokocho 🍶" },

        { tag: "2026-11-13", was: "Asakusa & Senso-ji" },
        { tag: "2026-11-13", was: "Akihabara & Ueno" },
        { tag: "2026-11-13", was: "Abends Shimokitazawa oder Ebisu", was_en: "Evening in Shimokitazawa or Ebisu" },

        { tag: "2026-11-14", was: "Tagesausflug Nikko (Toshogu & Herbstlaub 🍁) – oder Kamakura & Enoshima", was_en: "Day trip to Nikko (Toshogu & autumn leaves 🍁) – or Kamakura & Enoshima" },
      ],
    },
    {
      ort: "Nagoya", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.18, 136.91],
      von: "2026-11-15", bis: "2026-11-16",
      anreise: "🚄 Shinkansen Tokio → Nagoya (1 h 40)",
      anreise_en: "🚄 Shinkansen Tokyo → Nagoya (1 h 40)",
      karte: false,
      plan: [
        { tag: "2026-11-15", was: "Osu-Shopping-District & Nagoya Castle", was_en: "Osu shopping district & Nagoya Castle" },
        { tag: "2026-11-15", was: "Abends Sakae – Miso-Katsu & Hitsumabushi", was_en: "Evening in Sakae – miso katsu & hitsumabushi" },

        { tag: "2026-11-16", was: "Ghibli Park – den ganzen Tag 🌳", was_en: "Ghibli Park – all day 🌳" },
        { tag: "2026-11-16", was: "Abends Shinkansen nach Kyoto", was_en: "Evening Shinkansen to Kyoto" },
      ],
    },
    {
      ort: "Kyoto", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.01, 135.77],
      von: "2026-11-16", bis: "2026-11-19",
      anreise: "🚄 Shinkansen Nagoya → Kyoto (35 Min)",
      anreise_en: "🚄 Shinkansen Nagoya → Kyoto (35 min)",
      karte: false,
      plan: [
        { tag: "2026-11-17", zeit: "früh", zeit_en: "early", was: "Fushimi Inari vor dem großen Andrang ⛩️", was_en: "Fushimi Inari before the crowds ⛩️" },
        { tag: "2026-11-17", was: "Kiyomizu-dera & Higashiyama-Gassen", was_en: "Kiyomizu-dera & the lanes of Higashiyama" },
        { tag: "2026-11-17", was: "Gion, abends Pontocho", was_en: "Gion, Pontocho in the evening" },

        { tag: "2026-11-18", zeit: "früh", zeit_en: "early", was: "Arashiyama-Bambuswald bei Sonnenaufgang 🎋", was_en: "Arashiyama Bamboo Grove at sunrise 🎋" },
        { tag: "2026-11-18", was: "Tenryu-ji, Kinkaku-ji & Nijo" },
        { tag: "2026-11-18", was: "Optional: Halbtag Ohara (Sanzen-in) fürs Herbstlaub 🍁", was_en: "Optional: half day in Ohara (Sanzen-in) for the autumn leaves 🍁" },

        { tag: "2026-11-19", zeit: "11:30", was: "Haruka ab Kyoto Hbf zum Flughafen KIX", was_en: "Haruka from Kyoto Station to KIX airport" },
      ],
    },

    /* ---------- Heimreise ---------- */
    {
      ort: "Shanghai", land: "China", flagge: "🇨🇳",
      zeitzone: "Asia/Shanghai", lage: [31.23, 121.47],
      von: "2026-11-19", bis: "2026-11-20",
      anreise: "✈️ KIX 16:30 → PVG 18:20",
      plan: [
        { tag: "2026-11-20", zeit: "11:05", was: "Rückflug nach Frankfurt (Landung 16:35) ✈️", was_en: "Flight back to Frankfurt (landing 16:35) ✈️" },
      ],
    },
  ],
};
