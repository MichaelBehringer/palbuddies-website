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
      plan: [
      ],
    },

    /* ---------- Block 1: Kansai ---------- */
    {
      ort: "Osaka", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.69, 135.50],
      von: "2026-10-29", bis: "2026-11-02",
      anreise: "✈️ PVG 11:30 → KIX 15:00 · 🚆 Nankai nach Namba",
      plan: [
        { tag: "2026-10-29", zeit: "15:00", was: "Landung in Kansai, mit der Nankai nach Namba" },
        { tag: "2026-10-29", was: "Dotonbori, Glico-Schild, Takoyaki & erstes Bier 🍻" },

        { tag: "2026-10-30", was: "Osaka Castle & Park" },
        { tag: "2026-10-30", was: "Kuromon-Ichiba-Markt – einmal durchessen" },
        { tag: "2026-10-30", was: "Shinsekai & Tsutenkaku mit Kushikatsu" },
        { tag: "2026-10-30", was: "Sonnenuntergang im Umeda Sky Building" },
        { tag: "2026-10-30", was: "Abends Namba & Amerikamura" },

        { tag: "2026-10-31", was: "Nara: Todai-ji mit Riesen-Buddha, Hirsche, Kasuga-Taisha 🦌" },
        { tag: "2026-10-31", was: "Halloween-Straßenparty in Amerikamura & Shinsaibashi 🎃" },

        { tag: "2026-11-01", was: "Himeji-Burg + Kobe-Beef in Sannomiya – oder Chill-Tag" },
        { tag: "2026-11-01", was: "Früh ins Bett, Rucksack packen" },
      ],
    },
    {
      ort: "Koyasan", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.21, 135.59],
      von: "2026-11-02", bis: "2026-11-03",
      anreise: "🥾 Chōishi-michi (24 km Pilgerweg)",
      karte: false,
      plan: [
        { tag: "2026-11-02", was: "Wanderung auf dem Chōishi-michi hoch nach Koyasan" },
        { tag: "2026-11-02", was: "Übernachtung im Tempel ⛩️" },
        { tag: "2026-11-03", was: "Morgens Okunoin-Friedhof" },
        { tag: "2026-11-03", was: "Mittags zurück nach Osaka" },
      ],
    },
    {
      ort: "Osaka", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [34.69, 135.50],
      von: "2026-11-03", bis: "2026-11-05",
      anreise: "🚆 Koyasan → Osaka",
      plan: [
        { tag: "2026-11-04", was: "Puffertag: Universal Studios, Kobe, teamLab, Spa World – oder nichts" },
        { tag: "2026-11-04", was: "Falls Hanshin im Koshien spielt: sofort hin ⚾" },
        { tag: "2026-11-05", was: "Vormittag frei, nachmittags Flug nach Taipeh" },
      ],
    },

    /* ---------- Block 2: Taiwan ---------- */
    {
      ort: "Taipeh", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [25.03, 121.56],
      von: "2026-11-05", bis: "2026-11-08",
      anreise: "✈️ KIX → TPE · 🚇 Airport-MRT ins Zentrum",
      karte: false,                      // auf der Karte steht nur Taichung (Tim)
      plan: [
        { tag: "2026-11-05", was: "Ankunft, mit der Airport-MRT ins Zentrum" },
        { tag: "2026-11-05", was: "Abends Ximending oder Ningxia-Nachtmarkt" },

        { tag: "2026-11-06", was: "Longshan-Tempel & Bopiliao" },
        { tag: "2026-11-06", was: "Chiang-Kai-shek-Gedenkhalle" },
        { tag: "2026-11-06", was: "Taipei 101 & Sonnenuntergang auf dem Elephant Mountain" },
        { tag: "2026-11-06", was: "Raohe-Nachtmarkt" },

        { tag: "2026-11-07", was: "Beitou: heiße Quellen im Thermal Valley ♨️" },
        { tag: "2026-11-07", was: "Wandern im Yangmingshan-Nationalpark (Qixing-Gipfel)" },
        { tag: "2026-11-07", was: "Shilin-Nachtmarkt" },
      ],
    },
    {
      ort: "Tianzhong", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [23.86, 120.59],
      von: "2026-11-08", bis: "2026-11-08",
      anreise: "🚄 Taipeh → Tianzhong",
      karte: false,
      plan: [
        { tag: "2026-11-08", was: "Tianzhong 2026 Halbmarathon 🏃‍♂️🏅" },
      ],
    },
    {
      ort: "Taipeh", land: "Taiwan", flagge: "🇹🇼",
      zeitzone: "Asia/Taipei", lage: [25.03, 121.56],
      von: "2026-11-08", bis: "2026-11-10",
      anreise: "🚄 Tianzhong → Taipeh",
      karte: false,
      plan: [
        { tag: "2026-11-09", was: "Tagestour Jiufen, Shifen & Yehliu an der Nordostküste" },
        { tag: "2026-11-10", was: "Frühstück & Souvenirs, nachmittags Flug nach Tokio" },
      ],
    },

    /* ---------- Block 3: Tokio → Nagoya → Kyoto ---------- */
    {
      ort: "Tokio", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.68, 139.69],
      von: "2026-11-10", bis: "2026-11-15",
      anreise: "✈️ TPE → Tokio",
      plan: [
        { tag: "2026-11-10", was: "Ankunft am Abend" },

        { tag: "2026-11-11", was: "Shibuya, Harajuku & Takeshita-dori" },
        { tag: "2026-11-11", was: "Meiji-Schrein" },
        { tag: "2026-11-11", was: "Abends Golden Gai in Shinjuku" },

        { tag: "2026-11-12", was: "Ghibli Museum Mitaka, durch den Inokashira-Park" },
        { tag: "2026-11-12", was: "Kichijoji & Harmonica Yokocho 🍶" },

        { tag: "2026-11-13", was: "Asakusa & Senso-ji" },
        { tag: "2026-11-13", was: "Akihabara & Ueno" },
        { tag: "2026-11-13", was: "Abends Shimokitazawa oder Ebisu" },

        { tag: "2026-11-14", was: "Tagesausflug Nikko (Toshogu & Herbstlaub 🍁) – oder Kamakura & Enoshima" },
      ],
    },
    {
      ort: "Nagoya", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.18, 136.91],
      von: "2026-11-15", bis: "2026-11-16",
      anreise: "🚄 Shinkansen Tokio → Nagoya (1 h 40)",
      karte: false,
      plan: [
        { tag: "2026-11-15", was: "Osu-Shopping-District & Nagoya Castle" },
        { tag: "2026-11-15", was: "Abends Sakae – Miso-Katsu & Hitsumabushi" },

        { tag: "2026-11-16", was: "Ghibli Park – den ganzen Tag 🌳" },
        { tag: "2026-11-16", was: "Abends Shinkansen nach Kyoto" },
      ],
    },
    {
      ort: "Kyoto", land: "Japan", flagge: "🇯🇵",
      zeitzone: "Asia/Tokyo", lage: [35.01, 135.77],
      von: "2026-11-16", bis: "2026-11-19",
      anreise: "🚄 Shinkansen Nagoya → Kyoto (35 Min)",
      karte: false,
      plan: [
        { tag: "2026-11-17", zeit: "früh", was: "Fushimi Inari vor dem großen Andrang ⛩️" },
        { tag: "2026-11-17", was: "Kiyomizu-dera & Higashiyama-Gassen" },
        { tag: "2026-11-17", was: "Gion, abends Pontocho" },

        { tag: "2026-11-18", zeit: "früh", was: "Arashiyama-Bambuswald bei Sonnenaufgang 🎋" },
        { tag: "2026-11-18", was: "Tenryu-ji, Kinkaku-ji & Nijo" },
        { tag: "2026-11-18", was: "Optional: Halbtag Ohara (Sanzen-in) fürs Herbstlaub 🍁" },

        { tag: "2026-11-19", zeit: "11:30", was: "Haruka ab Kyoto Hbf zum Flughafen KIX" },
      ],
    },

    /* ---------- Heimreise ---------- */
    {
      ort: "Shanghai", land: "China", flagge: "🇨🇳",
      zeitzone: "Asia/Shanghai", lage: [31.23, 121.47],
      von: "2026-11-19", bis: "2026-11-20",
      anreise: "✈️ KIX 16:30 → PVG 18:20",
      plan: [
        { tag: "2026-11-20", zeit: "11:05", was: "Rückflug nach Frankfurt (Landung 16:35) ✈️" },
      ],
    },
  ],
};
