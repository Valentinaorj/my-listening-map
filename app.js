// ============================================
//   my music world — app.js
// ============================================

// ── CLOCK ──
function updateClock() {
  const clock = document.getElementById("clock")
  if (!clock) return
  const now = new Date()
  const h = now.getHours().toString().padStart(2, "0")
  const m = now.getMinutes().toString().padStart(2, "0")
  clock.textContent = h + ":" + m
}
updateClock()
setInterval(updateClock, 10000)

// ── PROGRESS BAR (fake loading effect) ──
setTimeout(function() {
  const fill = document.getElementById("progress-fill")
  if (fill) fill.style.width = "100%"
}, 200)

// ── COUNTRY → LANGUAGE MAP ──
const countryLanguage = {
  "United States": "English",
  "United Kingdom": "English",
  "Canada": "English",
  "Australia": "English",
  "Ireland": "English",
  "New Zealand": "English",
  "Nigeria": "English",
  "Ghana": "English",
  "South Africa": "English",
  "Jamaica": "English",
  "Colombia": "Spanish",
  "Argentina": "Spanish",
  "Mexico": "Spanish",
  "Spain": "Spanish",
  "Chile": "Spanish",
  "Peru": "Spanish",
  "Cuba": "Spanish",
  "Venezuela": "Spanish",
  "Uruguay": "Spanish",
  "Ecuador": "Spanish",
  "Bolivia": "Spanish",
  "Puerto Rico": "Spanish",
  "Brazil": "Portuguese",
  "Portugal": "Portuguese",
  "France": "French",
  "Belgium": "French",
  "Senegal": "French",
  "Mali": "French",
  "Algeria": "French",
  "Germany": "German",
  "Austria": "German",
  "Switzerland": "German",
  "Italy": "Italian",
  "Japan": "Japanese",
  "South Korea": "Korean",
  "Sweden": "Swedish",
  "Norway": "Norwegian",
  "Denmark": "Danish",
  "Netherlands": "Dutch",
  "Poland": "Polish",
  "Russia": "Russian",
  "Morocco": "Arabic",
  "Egypt": "Arabic",
  "Lebanon": "Arabic",
  "India": "Hindi",
  "Turkey": "Turkish",
  "Greece": "Greek",
  "Israel": "Hebrew"
}

// ── COUNTRY COORDINATES ──
const countryCoordinates = {
  "United States": [37.09, -95.71],
  "United Kingdom": [55.38, -3.44],
  "Colombia": [4.57, -74.29],
  "Argentina": [-38.42, -63.62],
  "France": [46.23, 2.21],
  "Spain": [40.46, -3.75],
  "Germany": [51.17, 10.45],
  "Mexico": [23.63, -102.55],
  "Italy": [41.87, 12.57],
  "Canada": [56.13, -106.35],
  "Uruguay": [-32.52, -55.77],
  "Japan": [36.20, 138.25],
  "Chile": [-35.67, -71.54],
  "Brazil": [-14.24, -51.93],
  "Cuba": [21.52, -77.78],
  "Jamaica": [18.11, -77.30],
  "Australia": [-25.27, 133.77],
  "Nigeria": [9.08, 8.67],
  "South Africa": [-30.56, 22.94],
  "Sweden": [60.13, 18.64],
  "Norway": [60.47, 8.47],
  "Ireland": [53.41, -8.24],
  "Portugal": [39.40, -8.22],
  "Netherlands": [52.13, 5.29],
  "Belgium": [50.50, 4.47],
  "Denmark": [56.26, 9.50],
  "Greece": [39.07, 21.82],
  "Russia": [61.52, 105.32],
  "India": [20.59, 78.96],
  "Senegal": [14.50, -14.45],
  "Mali": [17.57, -3.99],
  "Ghana": [7.95, -1.02],
  "Ethiopia": [9.15, 40.49],
  "Kenya": [-0.02, 37.91],
  "Peru": [-9.19, -75.02],
  "Venezuela": [6.42, -66.59],
  "Ecuador": [-1.83, -78.18],
  "Bolivia": [-16.29, -63.59],
  "Puerto Rico": [18.22, -66.59],
  "New Zealand": [-40.90, 174.89],
  "Austria": [47.52, 14.55],
  "Switzerland": [46.82, 8.23],
  "Poland": [51.92, 19.15],
  "Czech Republic": [49.82, 15.47],
  "Hungary": [47.16, 19.50],
  "Romania": [45.94, 24.97],
  "Turkey": [38.96, 35.24],
  "Israel": [31.05, 34.85],
  "Lebanon": [33.85, 35.86],
  "Egypt": [26.82, 30.80],
  "Morocco": [31.79, -7.09],
  "Algeria": [28.03, 1.66],
  "South Korea": [35.91, 127.77],
  "Jamaica": [18.11, -77.30],
  "Cuba": [21.52, -77.78]
}

// ── WIN98 CHART DEFAULTS ──
Chart.defaults.font.family = "'Tahoma', Arial, sans-serif"
Chart.defaults.font.size = 10
Chart.defaults.color = "#404040"

// ── LOAD DATA ──
console.log("all canvases:", document.querySelectorAll("canvas"))

Papa.parse("data/master_playlist_enriched.csv", {
  header: true,
  download: true,
  complete: function(results) {

    // ══════════════════════════════
    //  DECADES
    // ══════════════════════════════
    let decades = {}

    results.data.forEach(function(song) {
      let year = parseInt(song["Release Date"])
      let decade = Math.floor(year / 10) * 10
      if (decades[decade]) {
        decades[decade] = decades[decade] + 1
      } else {
        decades[decade] = 1
      }
    })

    console.log(decades)
    delete decades[NaN]

    let sortedDecades = Object.keys(decades).sort()
    let decadeLabels = sortedDecades.map(function(d) { return d + "s" })
    let total = results.data.length
    let decadeCounts = sortedDecades.map(function(d) {
      return ((decades[d] / total) * 100).toFixed(1)
    })

    Chart.register(ChartDataLabels)
    let ctxDecades = document.getElementById("decades-chart")
    new Chart(ctxDecades, {
      type: "bar",
      data: {
        labels: decadeLabels,
        datasets: [{
          label: "% of songs",
          data: decadeCounts,
          backgroundColor: sortedDecades.map(function(d) {
            const decade = parseInt(d)
            if (decade < 1970) return "#404040"
            if (decade < 1980) return "#008080"
            if (decade < 1990) return "#800080"
            if (decade < 2000) return "#000080"
            if (decade < 2010) return "#008000"
            if (decade < 2020) return "#c17f3a"
            return "#c00000"
          }),
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "top",
            font: { size: 9, family: "Tahoma, Arial, sans-serif" },
            formatter: function(value) { return value + "%" }
          },
          tooltip: {
            callbacks: {
              label: function(context) { return context.parsed.y + "%" }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#e0e0e0" },
            ticks: { callback: function(v) { return v + "%" } }
          },
          x: { grid: { display: false } }
        }
      }
    })

    // ══════════════════════════════
    //  COUNTRIES + MAP
    // ══════════════════════════════
    let countries = {}

    results.data.forEach(function(song) {
      if (!song["Artist Country"]) return
      let countryList = song["Artist Country"].split("; ")
      countryList.forEach(function(country) {
        if (countries[country]) {
          countries[country] = countries[country] + 1
        } else {
          countries[country] = 1
        }
      })
    })

    console.log(countries)

    // initialize map with dark tiles
    let map = L.map("map").setView([20, 0], 2)

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap © CARTO",
    subdomains: "abcd"
    }).addTo(map)

    let maxCount = Math.max(...Object.values(countries))

    Object.keys(countries).forEach(function(country) {
      if (country === "Unknown") return
      if (!countryCoordinates[country]) return

      let count = countries[country]
      let radius = Math.sqrt(count / maxCount) * 40

      L.circleMarker(countryCoordinates[country], {
        radius: radius,
        fillColor: "#63AEE0",
        color: "#63AEE0",
        weight: 1,
        fillOpacity: 0.6
      })
      .bindPopup(
        "<b>" + country + "</b><br>" + count + " songs"
      )
      .addTo(map)
    })

    // ══════════════════════════════
    //  GENRES TREEMAP
    // ══════════════════════════════
    let genres = {}

    results.data.forEach(function(song) {
      if (!song["Genres"]) return
      let genreList = song["Genres"].split(",")
      genreList.forEach(function(genre) {
        genre = genre.trim()
        if (!genre) return
        if (genres[genre]) {
          genres[genre] = genres[genre] + 1
        } else {
          genres[genre] = 1
        }
      })
    })

    console.log(genres)

    let sortedGenres = Object.keys(genres)
      .sort(function(a, b) { return genres[b] - genres[a] })
      .slice(0, 30)

    let genreData = sortedGenres.map(function(g) {
      return { g: g, v: genres[g] }
    })

    let ctxGenres = document.getElementById("genres-chart")
    new Chart(ctxGenres, {
      type: "treemap",
      data: {
        datasets: [{
          label: "Genres",
          tree: genreData,
          key: "v",
          labels: {
            display: true,
            formatter: function(ctx) {
              return ctx.raw._data.g
            },
            font: { size: 10, family: "Tahoma, Arial, sans-serif" },
            color: "white"
          },
          backgroundColor: function(ctx) {
            if (!ctx.raw) return "rgba(0,128,128,0.5)"
            const val = ctx.raw.v
            const max = genres[sortedGenres[0]]
            const alpha = 0.3 + (val / max) * 0.7
            // alternate between teal and blue families
            const hues = [180, 200, 160, 220, 140]
            const hue = hues[Math.floor(Math.random() * hues.length)]
            return `hsla(${hue}, 60%, 35%, ${alpha})`
          },
          borderColor: "#c0c0c0",
          borderWidth: 1
        }]
      },
      options: {
        plugins: {
          datalabels: { display: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(items) { return items[0].raw._data.g },
              label: function(item) { return item.raw.v + " songs" }
            }
          }
        }
      }
    })

    // ══════════════════════════════
    //  AUDIO PROFILE (RADAR)
    // ══════════════════════════════
    let audioFeatures = ["Danceability", "Energy", "Valence",
                         "Acousticness", "Instrumentalness", "Speechiness"]
    let audioAverages = {}

    audioFeatures.forEach(function(feature) {
      let sum = 0
      results.data.forEach(function(song) {
        let value = parseFloat(song[feature])
        if (!isNaN(value)) {
          sum = sum + value
        }
      })
      audioAverages[feature] = sum / results.data.length
    })

    console.log(audioAverages)

    let ctxAudio = document.getElementById("audio-chart")
    Chart.register(ChartDataLabels)
    new Chart(ctxAudio, {
      type: "radar",
      data: {
        labels: audioFeatures,
        datasets: [{
          label: "my sonic profile",
          data: audioFeatures.map(function(f) {
            return audioAverages[f].toFixed(2)
          }),
          fill: true,
          backgroundColor: "rgba(0, 128, 128, 0.2)",
          borderColor: "rgba(0, 128, 128, 1)",
          pointBackgroundColor: "rgba(0, 128, 128, 1)",
          pointBorderColor: "#fff",
          pointRadius: 4
        }]
      },
      options: {
        scales: {
          r: {
            min: 0,
            max: 0.8,
            ticks: {
              stepSize: 0.2,
              font: { size: 9 },
              backdropColor: "transparent"
            },
            grid: { color: "#d0d0d0" },
            pointLabels: { font: { size: 10, family: "Tahoma, Arial, sans-serif" } }
          }
        },
        plugins: {
          datalabels: { display: false },
          legend: { display: false }
        }
      }
    })

    // ══════════════════════════════
    //  LANGUAGES (DONUT)
    // ══════════════════════════════
    let languages = {}

    Object.keys(countries).forEach(function(country) {
      if (country === "Unknown") return
      let language = countryLanguage[country]
      if (!language) return
      if (languages[language]) {
        languages[language] = languages[language] + countries[country]
      } else {
        languages[language] = countries[country]
      }
    })

    console.log(languages)

    let sortedLanguages = Object.entries(languages)
      .sort(function(a, b) { return b[1] - a[1] })

    let languageLabels = sortedLanguages.map(function(l) { return l[0] })
    let languageCounts = sortedLanguages.map(function(l) { return l[1] })

    let ctxLanguages = document.getElementById("languages-chart")
    new Chart(ctxLanguages, {
      type: "doughnut",
      data: {
        labels: languageLabels,
        datasets: [{
          data: languageCounts,
          backgroundColor: [
            "#008080", "#000080", "#800080", "#008000",
            "#c17f3a", "#c00000", "#006060", "#404080",
            "#604060", "#406040", "#806030", "#800040",
            "#004040", "#000060", "#400040", "#004000"
          ],
          borderColor: "#c0c0c0",
          borderWidth: 2
        }]
      },
      options: {
        plugins: {
          datalabels: { display: false },
          legend: {
            position: "right",
            labels: {
              font: { size: 10, family: "Tahoma, Arial, sans-serif" },
              boxWidth: 12,
              padding: 8
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce(function(a, b) { return a + b }, 0)
                const pct = ((context.raw / total) * 100).toFixed(1)
                return context.label + ": " + context.raw + " songs (" + pct + "%)"
              }
            }
          }
        }
      }
    })

  } // end complete
}) // end Papa.parse
