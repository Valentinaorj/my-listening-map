// ============================================
//  my listening map — app.js
// ============================================

// ── STATE ──
var allTracks = []
var activeFilter = { type: null, value: null }

// continent colors matching neo-brutalist palette
var CONTINENT_COLORS = {
  'America':  '#e8614a',
  'Europe':   '#b8a0d4',
  'Africa':   '#e8c547',
  'Asia':     '#7dd4a8',
  'Oceania':  '#f4a24a',
  'Unknown':  '#aaaaaa'
}

// ── CLOCK ──
function updateClock() {
  var el = document.getElementById('clock')
  if (!el) return
  var now = new Date()
  el.textContent =
    now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0')
}
updateClock()
setInterval(updateClock, 10000)

// ── TABS ──
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-tab')
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active') })
      document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active') })
      btn.classList.add('active')
      var pane = document.getElementById('tab-' + target)
      if (pane) pane.classList.add('active')
      if (target === 'map' && window._leafletMap) {
        setTimeout(function() { window._leafletMap.invalidateSize() }, 50)
      }
    })
  })
}

// ── SONGS TABLE ──
// columns: title (fixed), artist, year, genre, country
// when filtering by a dimension, hide that column and show in title

var FILTER_LABELS = {
  country: 'pais',
  genre:   'genero',
  decade:  'decada',
  language:'idioma'
}

function getVisibleColumns(filterType) {
  // always show title (fixed), always show artist
  // hide the column that matches the current filter
  return {
    showArtist:  true,
    showYear:    filterType !== 'decade',
    showGenre:   true,
    showCountry: filterType !== 'country' && filterType !== 'language'
  }
}

function renderSongsTable(label, songs, filterType) {
  var tbody    = document.getElementById('songs-tbody')
  var footer   = document.getElementById('songs-footer')
  var titleEl  = document.getElementById('songs-title')
  var theadRow = document.getElementById('songs-thead-row')
  var emptyEl  = document.getElementById('songs-empty')
  document.getElementById('songs-table').style.display = 'table'
  if (!tbody) return

  // always hide empty msg when rendering
  if (emptyEl) emptyEl.style.display = 'none'

  // update title
  if (titleEl) titleEl.textContent = label ? 'canciones · ' + label : 'canciones'

  // update column visibility
  var cols = getVisibleColumns(filterType)
  if (theadRow) {
    theadRow.querySelector('.col-artist').style.display  = ''
    theadRow.querySelector('.col-year').style.display    = cols.showYear    ? '' : 'none'
    theadRow.querySelector('.col-genre').style.display   = cols.showGenre   ? '' : 'none'
    theadRow.querySelector('.col-country').style.display = cols.showCountry ? '' : 'none'
  }

  if (!songs || songs.length === 0) {
    tbody.innerHTML = ''
    document.getElementById('songs-table').style.display = 'none'
    if (emptyEl) { emptyEl.textContent = 'sin resultados para "' + label + '"'; emptyEl.style.display = 'flex' }
    if (footer) footer.textContent = ''
    return
  }

  tbody.innerHTML = songs.map(function(s) {
    var title   = esc(s['Track Name']     || '—')
    var artist  = esc(s['Artist Name(s)'] || '—')
    var year    = (s['Release Date'] || '').slice(0, 4) || '—'
    var genre = esc((s['Genres'] || '').split(';').map(function(g) { return g.trim() }).filter(Boolean).join(', ') || '—')
    var country = esc((s['Artist Country'] || '—').split(';')[0].trim())

    return '<tr>' +
      '<td class="col-fixed col-title" title="' + title + '">'  + title  + '</td>' +
      '<td class="col-artist" title="' + artist + '">' + artist + '</td>' +
      (cols.showYear    ? '<td class="col-year">'    + year    + '</td>' : '') +
      (cols.showGenre   ? '<td class="col-genre" title="' + genre + '">'   + genre   + '</td>' : '') +
      (cols.showCountry ? '<td class="col-country" title="' + country + '">' + country + '</td>' : '') +
      '</tr>'
  }).join('')

  if (footer) footer.textContent = songs.length + ' canciones'
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clearSongs() {
  activeFilter = { type: null, value: null }
  var tbody    = document.getElementById('songs-tbody')
  var footer   = document.getElementById('songs-footer')
  var titleEl  = document.getElementById('songs-title')
  var theadRow = document.getElementById('songs-thead-row')
  var emptyEl  = document.getElementById('songs-empty')

  if (titleEl)  titleEl.textContent = 'canciones'
  if (footer)   footer.textContent = ''
  if (theadRow) theadRow.querySelectorAll('th').forEach(function(th) { th.style.display = '' })
  if (tbody)    tbody.innerHTML = ''
  if (emptyEl)  { emptyEl.textContent = 'haz clic en cualquier gráfico para filtrar'; emptyEl.style.display = 'flex' }

  document.getElementById('songs-table').style.display = 'none'
}

// ── GLOBAL FILTER (called by network.js and charts) ──
window.filterSongs = function(type, value) {
  if (!allTracks.length) return
  activeFilter = { type: type, value: value }
  var songs = []

  if (type === 'country') {
    songs = allTracks.filter(function(s) {
      if (!s['Artist Country']) return false
      return s['Artist Country'].split('; ').map(function(c) { return c.trim() }).indexOf(value) !== -1
    })
  }

  if (type === 'genre') {
    songs = allTracks.filter(function(s) {
      if (!s['Genres']) return false
      return s['Genres'].split(/[,;]/).map(function(g) { return g.trim().toLowerCase() })
        .indexOf(value.toLowerCase()) !== -1
    })
  }

  if (type === 'decade') {
    var dec = parseInt(value)
    songs = allTracks.filter(function(s) {
      var y = parseInt(s['Release Date'])
      return !isNaN(y) && Math.floor(y / 10) * 10 === dec
    })
  }

  if (type === 'language') {
    songs = allTracks.filter(function(s) {
      if (!s['Artist Country']) return false
      return s['Artist Country'].split('; ').some(function(c) {
        return countryLanguage[c.trim()] === value
      })
    })
  }

  renderSongsTable(value, songs, type)
}

// ── STATUS ──
function setStatus(msg) {
  var el = document.getElementById('bottom-status')
  if (el) el.textContent = msg
}

// ── CHART DEFAULTS ──
function initChartDefaults() {
  Chart.defaults.font.family = "'VT323', monospace"
  Chart.defaults.font.size = 14
  Chart.defaults.color = '#1a1a1a'
  Chart.register(ChartDataLabels)
}

// ── DECADES CHART ──
function buildDecadesChart(tracks) {
  var decades = {}
  tracks.forEach(function(s) {
    var y = parseInt(s['Release Date'])
    if (isNaN(y)) return
    var d = Math.floor(y / 10) * 10
    decades[d] = (decades[d] || 0) + 1
  })

  var sorted = Object.keys(decades).sort()
  var total  = tracks.length

  var ctx = document.getElementById('decades-chart')
  if (!ctx) return

  var decadeColors = {
    1950: '#404040', 1960: '#404040',
    1970: '#008080', 1980: '#800080',
    1990: '#000080', 2000: '#008000',
    2010: '#c17f3a', 2020: '#c00000'
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(function(d) { return d + 's' }),
      datasets: [{
        label: '% canciones',
        data: sorted.map(function(d) { return ((decades[d] / total) * 100).toFixed(1) }),
        backgroundColor: sorted.map(function(d) { return decadeColors[parseInt(d)] || '#666' }),
        borderWidth: 0,
        borderRadius: 0
      }]
    },
    options: {
      onClick: function(e, els) {
        if (!els.length) return
        var idx = els[0].index
        var dec = parseInt(sorted[idx])
        window.filterSongs('decade', dec)
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end', align: 'top',
          font: { size: 12, family: "'VT323', monospace" },
          formatter: function(v) { return v + '%' }
        },
        tooltip: { callbacks: { label: function(c) { return c.parsed.y + '%' } } }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#d8d0c0' },
          ticks: { callback: function(v) { return v + '%' }, font: { size: 13, family: "'VT323', monospace" } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 14, family: "'VT323', monospace" } }
        }
      },
      cursor: 'pointer'
    }
  })
}

// ── MAP ──
function buildMap(tracks) {
  var countries = {}
  var countryContinents = {}

  tracks.forEach(function(s) {
    if (!s['Artist Country']) return
    var cList = s['Artist Country'].split('; ')
    var contList = (s['Artist Continent'] || '').split('; ')
    cList.forEach(function(c, i) {
      c = c.trim()
      if (!c || c === 'Unknown') return
      countries[c] = (countries[c] || 0) + 1
      if (!countryContinents[c]) {
        var cont = (contList[i] || '').trim()
        countryContinents[c] = cont || 'Unknown'
      }
    })
  })

  console.log('countries:', Object.keys(countries).length)
  console.log('sample:', Object.keys(countries).slice(0,3).map(function(c) {
    return c + ' -> ' + countryContinents[c]
  }))

  var map = L.map('map').setView([20, 0], 2)
  window._leafletMap = map

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd'
  }).addTo(map)

  var maxCount = Math.max.apply(null, Object.values(countries))

  Object.keys(countries).forEach(function(country) {
    if (country === 'Unknown' || !countryCoordinates[country]) return
    var count = countries[country]
    var radius = Math.sqrt(count / maxCount) * 40
    var continent = countryContinents[country] || 'Unknown'
    var color = CONTINENT_COLORS[continent] || CONTINENT_COLORS['Unknown']

    L.circleMarker(countryCoordinates[country], {
      radius: radius,
      fillColor: color,
      color: '#000000',
      weight: 1,
      fillOpacity: 0.60
    })
    .on('click', function() { window.filterSongs('country', country) })
    .bindPopup('<strong>' + country + '</strong><br>' + count + ' canciones<br><em>' + continent + '</em>')
    .addTo(map)
  })
}

// ── AUDIO RADAR ──
function buildAudioChart(tracks) {
  var features = ['Danceability','Energy','Valence','Acousticness','Instrumentalness','Speechiness']
  var avgs = {}
  features.forEach(function(f) {
    var sum = 0, n = 0
    tracks.forEach(function(s) {
      var v = parseFloat(s[f])
      if (!isNaN(v)) { sum += v; n++ }
    })
    avgs[f] = n ? sum / n : 0
  })

  var ctx = document.getElementById('audio-chart')
  if (!ctx) return

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: features,
      datasets: [{
        label: 'perfil sonico',
        data: features.map(function(f) { return avgs[f].toFixed(2) }),
        fill: true,
        backgroundColor: 'rgba(125,212,168,0.25)',
        borderColor: '#1a1a1a',
        pointBackgroundColor: '#1a1a1a',
        pointBorderColor: '#f6eee0',
        pointRadius: 4
      }]
    },
    options: {
      scales: {
        r: {
          min: 0, max: 0.8,
          ticks: { stepSize: 0.2, backdropColor: 'transparent', font: { size: 11, family: "'VT323', monospace" } },
          grid: { color: '#c8c0b0' },
          pointLabels: { font: { size: 14, family: "'VT323', monospace" } }
        }
      },
      plugins: { datalabels: { display: false }, legend: { display: false } }
    }
  })
}

// ── LANGUAGES DONUT ──
function buildLanguagesChart(tracks) {
  var countries = {}
  tracks.forEach(function(s) {
    if (!s['Artist Country']) return
    s['Artist Country'].split('; ').forEach(function(c) {
      c = c.trim()
      if (c) countries[c] = (countries[c] || 0) + 1
    })
  })

  var languages = {}
  Object.keys(countries).forEach(function(c) {
    if (c === 'Unknown') return
    var lang = countryLanguage[c]
    if (!lang) return
    languages[lang] = (languages[lang] || 0) + countries[c]
  })

  var sorted = Object.entries(languages).sort(function(a, b) { return b[1] - a[1] })

  var ctx = document.getElementById('languages-chart')
  if (!ctx) return

  var langColors = [
    '#e8614a','#b8a0d4','#e8c547','#7dd4a8',
    '#f4a24a','#f4a0b8','#6090c8','#a0c870',
    '#c87060','#80a8d4','#d4a060','#a060d4',
    '#60d4b8','#d46080','#90b840','#7080c8'
  ]

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(function(l) { return l[0] }),
      datasets: [{
        data: sorted.map(function(l) { return l[1] }),
        backgroundColor: langColors,
        borderColor: '#1a1a1a',
        borderWidth: 2
      }]
    },
    options: {
      onClick: function(e, els) {
        if (!els.length) return
        var lang = sorted[els[0].index][0]
        window.filterSongs('language', lang)
      },
      plugins: {
        datalabels: { display: false },
        legend: {
          position: 'right',
          labels: { font: { size: 13, family: "'VT323', monospace" }, boxWidth: 14, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var total = ctx.dataset.data.reduce(function(a, b) { return a + b }, 0)
              return ctx.label + ': ' + ((ctx.raw / total) * 100).toFixed(1) + '%'
            }
          }
        }
      }
    }
  })
}

// ── MAIN ──
document.addEventListener('DOMContentLoaded', function() {

  initTabs()

  // clear filter button
  var clearBtn = document.getElementById('songs-clear')
  if (clearBtn) clearBtn.addEventListener('click', clearSongs)

  // fake progress
  setTimeout(function() {
    var fill = document.getElementById('progress-fill')
    if (fill) fill.style.width = '50%'
  }, 100)

  initChartDefaults()
  setStatus('cargando datos...')

  Papa.parse('data/master_playlist_enriched.csv', {
    header: true,
    download: true,
    error: function(err) {
      setStatus('error cargando CSV: ' + err.message)
      console.error('CSV error:', err)
    },
    complete: function(results) {
      allTracks = results.data.filter(function(r) { return r['Track Name'] && r['Track Name'].trim() })

      var fill = document.getElementById('progress-fill')
      if (fill) fill.style.width = '100%'
      var lbl = document.getElementById('load-label')
      if (lbl) lbl.textContent = allTracks.length + ' tracks'

      setStatus(allTracks.length + ' canciones cargadas · exportacion spotify')

      buildDecadesChart(allTracks)
      buildAudioChart(allTracks)
      buildLanguagesChart(allTracks)

      // map is default tab — init immediately
      var mapBuilt = false
      function maybeInitMap() {
        if (!mapBuilt) {
          mapBuilt = true
          buildMap(allTracks)
        }
      }
      setTimeout(maybeInitMap, 100)

      // also init on tab click in case it wasn't ready
      document.querySelectorAll('.tab-btn[data-tab="map"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          setTimeout(maybeInitMap, 60)
        })
      })
    }
  })
})

// ── DATA: COUNTRY → LANGUAGE ──
var countryLanguage = {
  "United States":"English","United Kingdom":"English","Canada":"English",
  "Australia":"English","Ireland":"English","New Zealand":"English",
  "Jamaica":"English","Trinidad and Tobago":"English","Barbados":"English",
  "Bahamas":"English","Belize":"English","Guyana":"English",
  "Nigeria":"English","Ghana":"English","South Africa":"English",
  "Kenya":"English","Uganda":"English","Tanzania":"English",
  "Rwanda":"English","Zimbabwe":"English","Zambia":"English",
  "Malawi":"English","Botswana":"English","Namibia":"English",
  "Lesotho":"English","Eswatini":"English","Sierra Leone":"English",
  "Liberia":"English","Gambia":"English","Papua New Guinea":"English",
  "Fiji":"English","Singapore":"English","Philippines":"English","Hong Kong":"English",
  "Colombia":"Spanish","Argentina":"Spanish","Mexico":"Spanish","Spain":"Spanish",
  "Chile":"Spanish","Peru":"Spanish","Cuba":"Spanish","Venezuela":"Spanish",
  "Uruguay":"Spanish","Ecuador":"Spanish","Bolivia":"Spanish","Puerto Rico":"Spanish",
  "Dominican Republic":"Spanish","Panama":"Spanish","Costa Rica":"Spanish",
  "Guatemala":"Spanish","Honduras":"Spanish","El Salvador":"Spanish",
  "Nicaragua":"Spanish","Paraguay":"Spanish",
  "Brazil":"Portuguese","Portugal":"Portuguese","Angola":"Portuguese",
  "Mozambique":"Portuguese","Cape Verde":"Portuguese","Guinea-Bissau":"Portuguese",
  "São Tomé and Príncipe":"Portuguese",
  "France":"French","Belgium":"French","Switzerland":"French","Senegal":"French",
  "Mali":"French","Algeria":"French","Morocco":"French","Tunisia":"French",
  "Ivory Coast":"French","Burkina Faso":"French","Guinea":"French",
  "Niger":"French","Cameroon":"French","Congo":"French",
  "Democratic Republic of the Congo":"French","Madagascar":"French",
  "Benin":"French","Togo":"French","Djibouti":"French","Gabon":"French",
  "Equatorial Guinea":"French","Martinique":"French","Guadeloupe":"French",
  "Haiti":"French","Luxembourg":"French","Mauritius":"French",
  "Germany":"German","Austria":"German",
  "Italy":"Italian",
  "Egypt":"Arabic","Libya":"Arabic","Sudan":"Arabic","Saudi Arabia":"Arabic",
  "Yemen":"Arabic","Oman":"Arabic","United Arab Emirates":"Arabic",
  "Qatar":"Arabic","Kuwait":"Arabic","Bahrain":"Arabic","Iraq":"Arabic",
  "Syria":"Arabic","Jordan":"Arabic","Lebanon":"Arabic","Palestine":"Arabic",
  "Japan":"Japanese","South Korea":"Korean",
  "Sweden":"Swedish","Norway":"Norwegian","Denmark":"Danish",
  "Netherlands":"Dutch","Suriname":"Dutch","Poland":"Polish",
  "Russia":"Russian","Belarus":"Russian","Kazakhstan":"Russian",
  "Israel":"Hebrew","Turkey":"Turkish","Cyprus":"Turkish","Greece":"Greek",
  "India":"Hindi","China":"Chinese","Taiwan":"Chinese",
  "Vietnam":"Vietnamese","Thailand":"Thai","Indonesia":"Indonesian",
  "Malaysia":"Malay","Cambodia":"Khmer","Myanmar":"Burmese",
  "Laos":"Lao","Mongolia":"Mongolian","Bangladesh":"Bengali",
  "Pakistan":"Urdu","Sri Lanka":"Sinhala","Nepal":"Nepali","Afghanistan":"Dari",
  "Uzbekistan":"Uzbek","Turkmenistan":"Turkmen","Kyrgyzstan":"Kyrgyz",
  "Tajikistan":"Tajik","Azerbaijan":"Azerbaijani","Georgia":"Georgian","Armenia":"Armenian",
  "Ukraine":"Ukrainian","Czech Republic":"Czech","Slovakia":"Slovak",
  "Hungary":"Hungarian","Romania":"Romanian","Bulgaria":"Bulgarian",
  "Croatia":"Croatian","Serbia":"Serbian","Bosnia and Herzegovina":"Bosnian",
  "Slovenia":"Slovenian","North Macedonia":"Macedonian","Albania":"Albanian",
  "Montenegro":"Montenegrin","Kosovo":"Albanian","Moldova":"Romanian",
  "Lithuania":"Lithuanian","Latvia":"Latvian","Estonia":"Estonian",
  "Finland":"Finnish","Iceland":"Icelandic",
  "Iran":"Persian","Ethiopia":"Amharic","Somalia":"Somali",
  "Eritrea":"Tigrinya","Malta":"Maltese"
}

// ── DATA: COUNTRY COORDINATES ──
var countryCoordinates = {
  "United States":[37.09,-95.71],"Canada":[56.13,-106.35],"Mexico":[23.63,-102.55],
  "Colombia":[4.57,-74.29],"Argentina":[-38.42,-63.62],"Brazil":[-14.24,-51.93],
  "Chile":[-35.67,-71.54],"Peru":[-9.19,-75.02],"Venezuela":[6.42,-66.59],
  "Ecuador":[-1.83,-78.18],"Bolivia":[-16.29,-63.59],"Uruguay":[-32.52,-55.77],
  "Paraguay":[-23.44,-58.44],"Cuba":[21.52,-77.78],"Puerto Rico":[18.22,-66.59],
  "Jamaica":[18.11,-77.30],"Haiti":[18.97,-72.29],"Dominican Republic":[18.74,-70.16],
  "Trinidad and Tobago":[10.69,-61.22],"Panama":[8.54,-80.78],"Costa Rica":[9.75,-83.75],
  "Guatemala":[15.78,-90.23],"Honduras":[15.20,-86.24],"El Salvador":[13.79,-88.90],
  "Nicaragua":[12.87,-85.21],"Belize":[17.19,-88.49],"Guyana":[4.86,-58.93],
  "Suriname":[3.92,-56.03],"Barbados":[13.19,-59.54],"Bahamas":[25.03,-77.40],
  "Martinique":[14.64,-61.02],"Guadeloupe":[16.26,-61.55],
  "United Kingdom":[55.38,-3.44],"France":[46.23,2.21],"Germany":[51.17,10.45],
  "Spain":[40.46,-3.75],"Italy":[41.87,12.57],"Portugal":[39.40,-8.22],
  "Netherlands":[52.13,5.29],"Belgium":[50.50,4.47],"Sweden":[60.13,18.64],
  "Norway":[60.47,8.47],"Denmark":[56.26,9.50],"Finland":[61.92,25.75],
  "Ireland":[53.41,-8.24],"Austria":[47.52,14.55],"Switzerland":[46.82,8.23],
  "Poland":[51.92,19.15],"Czech Republic":[49.82,15.47],"Slovakia":[48.67,19.70],
  "Hungary":[47.16,19.50],"Romania":[45.94,24.97],"Bulgaria":[42.73,25.49],
  "Greece":[39.07,21.82],"Croatia":[45.10,15.20],"Serbia":[44.02,21.01],
  "Bosnia and Herzegovina":[43.92,17.68],"Slovenia":[46.15,14.99],
  "North Macedonia":[41.61,21.75],"Albania":[41.15,20.17],"Montenegro":[42.71,19.37],
  "Kosovo":[42.60,20.90],"Russia":[61.52,105.32],"Ukraine":[48.38,31.17],
  "Belarus":[53.71,27.95],"Lithuania":[55.17,23.88],"Latvia":[56.88,24.60],
  "Estonia":[58.60,25.01],"Iceland":[64.96,-19.02],"Luxembourg":[49.82,6.13],
  "Malta":[35.94,14.38],"Cyprus":[35.13,33.43],"Moldova":[47.41,28.37],
  "Georgia":[42.32,43.36],"Armenia":[40.07,45.04],"Azerbaijan":[40.14,47.58],
  "Turkey":[38.96,35.24],"Israel":[31.05,34.85],"Palestine":[31.95,35.20],
  "Lebanon":[33.85,35.86],"Syria":[34.80,38.99],"Jordan":[30.59,36.24],
  "Iraq":[33.22,43.68],"Iran":[32.43,53.69],"Saudi Arabia":[23.89,45.08],
  "Yemen":[15.55,48.52],"Oman":[21.51,55.92],"United Arab Emirates":[23.42,53.85],
  "Qatar":[25.35,51.18],"Kuwait":[29.31,47.48],"Bahrain":[26.03,50.55],
  "Egypt":[26.82,30.80],"Morocco":[31.79,-7.09],"Algeria":[28.03,1.66],
  "Tunisia":[33.89,9.54],"Libya":[26.34,17.23],"Sudan":[12.86,30.22],
  "Nigeria":[9.08,8.67],"South Africa":[-30.56,22.94],"Senegal":[14.50,-14.45],
  "Mali":[17.57,-3.99],"Ghana":[7.95,-1.02],"Ethiopia":[9.15,40.49],
  "Kenya":[-0.02,37.91],"Tanzania":[-6.37,34.89],"Uganda":[1.37,32.29],
  "Rwanda":[-1.94,29.87],"Cameroon":[3.85,11.50],"Ivory Coast":[7.54,-5.55],
  "Guinea":[11.74,-15.73],"Burkina Faso":[12.36,-1.56],"Niger":[17.61,8.08],
  "Congo":[-0.23,15.83],"Democratic Republic of the Congo":[-4.04,21.76],
  "Angola":[-11.20,17.87],"Mozambique":[-18.67,35.53],"Zimbabwe":[-19.02,29.15],
  "Zambia":[-13.13,27.85],"Madagascar":[-18.77,46.87],"Mauritius":[-20.35,57.55],
  "Cape Verde":[16.54,-23.04],"São Tomé and Príncipe":[0.19,6.61],
  "Somalia":[5.15,46.20],"Eritrea":[15.18,39.78],"Djibouti":[11.83,42.59],
  "Benin":[9.31,2.32],"Togo":[8.62,0.82],"Liberia":[6.43,-9.43],
  "Sierra Leone":[8.46,-11.78],"Guinea-Bissau":[11.80,-15.18],"Gambia":[13.44,-15.31],
  "Gabon":[-0.80,11.61],"Equatorial Guinea":[1.65,10.27],"Malawi":[-13.25,34.30],
  "Botswana":[-22.33,24.68],"Namibia":[-22.96,18.49],"Lesotho":[-29.61,28.23],
  "Eswatini":[-26.52,31.47],
  "Japan":[36.20,138.25],"South Korea":[35.91,127.77],"China":[35.86,104.20],
  "India":[20.59,78.96],"Pakistan":[30.38,69.35],"Bangladesh":[23.68,90.36],
  "Sri Lanka":[7.87,80.77],"Nepal":[28.39,84.12],"Afghanistan":[33.94,67.71],
  "Indonesia":[-0.79,113.92],"Malaysia":[4.21,108.96],"Philippines":[12.88,121.77],
  "Thailand":[15.87,100.99],"Vietnam":[14.06,108.28],"Cambodia":[12.57,104.99],
  "Myanmar":[21.92,95.96],"Laos":[19.86,102.50],"Singapore":[1.35,103.82],
  "Taiwan":[23.70,120.96],"Hong Kong":[22.32,114.17],"Mongolia":[46.86,103.85],
  "Kazakhstan":[48.02,66.92],"Uzbekistan":[41.38,64.59],"Turkmenistan":[38.97,59.56],
  "Kyrgyzstan":[41.20,74.77],"Tajikistan":[38.86,71.28],
  "Australia":[-25.27,133.77],"New Zealand":[-40.90,174.89],
  "Papua New Guinea":[-6.31,143.96],"Fiji":[-16.58,179.41]
}
