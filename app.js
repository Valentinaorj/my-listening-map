// ============================================
//  my listening map — app.js
// ============================================

// ── STATE ──
var allTracks     = []
var mapFilter     = null   // { type: 'country', value: 'Colombia' }
var networkFilter = null   // { type: 'genre',   value: 'folk latino' }
var decadeMin     = null
var decadeMax     = null
var searchQuery   = ''
var currentSort   = { key: 'year', dir: -1 }
var DECADE_DECADES = []

// Map markers for dimming: array of { marker, country }
var mapMarkers = []

// ── NAVIGATION HISTORY ──
var navHistory = []   // array of { mapFilter, networkFilter }
var navIndex   = -1   // current position in history
var navPaused  = false // true while navigating so we don't push during restore

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
    now.getHours().toString().padStart(2,'0') + ':' +
    now.getMinutes().toString().padStart(2,'0')
}
updateClock()
setInterval(updateClock, 10000)

// ── STATUS ──
function setStatus(msg) {
  var el = document.getElementById('bottom-status')
  if (el) el.textContent = msg
}

// ── ESCAPE ──
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── SORT ──
function getSortValue(s, key) {
  if (key === 'year')    return parseInt(s['Release Date']) || 0
  if (key === 'title')   return (s['Track Name']     || '').toLowerCase()
  if (key === 'artist')  return (s['Artist Name(s)'] || '').toLowerCase()
  if (key === 'genre')   return (s['Main Genre']     || '').toLowerCase()
  if (key === 'country') return (s['Artist Country'] || '').toLowerCase()
  return ''
}

function sortTracks(tracks, key, dir) {
  return tracks.slice().sort(function(a, b) {
    var av = getSortValue(a, key)
    var bv = getSortValue(b, key)
    if (av < bv) return -1 * dir
    if (av > bv) return  1 * dir
    return 0
  })
}

function updateSortArrows() {
  document.querySelectorAll('.sort-arrows').forEach(function(el) {
    var key = el.getAttribute('data-sort')
    el.classList.remove('sort-active','sort-asc','sort-desc')
    if (key === currentSort.key) {
      el.classList.add('sort-active')
      el.classList.add(currentSort.dir === 1 ? 'sort-asc' : 'sort-desc')
      // swap symbols: filled = active direction
      var up = el.querySelector('.arr-up')
      var dn = el.querySelector('.arr-dn')
      if (currentSort.dir === 1) {
        if (up) up.textContent = '▲'
        if (dn) dn.textContent = '▽'
      } else {
        if (up) up.textContent = '△'
        if (dn) dn.textContent = '▼'
      }
    } else {
      var up = el.querySelector('.arr-up')
      var dn = el.querySelector('.arr-dn')
      if (up) up.textContent = '△'
      if (dn) dn.textContent = '▽'
    }
  })
}

function initSortArrows() {
  document.querySelectorAll('.sort-arrows').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation()
      var key = el.getAttribute('data-sort')
      if (currentSort.key === key) {
        currentSort.dir *= -1
      } else {
        currentSort.key = key
        currentSort.dir = key === 'year' ? -1 : 1
      }
      updateSortArrows()
      renderTable()
    })
  })
  // also make th-inner click work
  document.querySelectorAll('.th-inner').forEach(function(el) {
    el.addEventListener('click', function() {
      var arrows = el.querySelector('.sort-arrows')
      if (arrows) arrows.dispatchEvent(new Event('click'))
    })
  })
  updateSortArrows()
}

// ── TEXT SEARCH ──
function initSearchBox() {
  var input = document.getElementById('songs-search')
  if (!input) return
  var debounce = null
  input.addEventListener('input', function() {
    clearTimeout(debounce)
    debounce = setTimeout(function() {
      searchQuery = input.value.trim().toLowerCase()
      renderTable()
    }, 150)
  })
}

// ── GET TRACKS MATCHING CURRENT FILTERS ──
// Used for both the table AND for cross-filter dimming
function getFilteredTracks() {
  var tracks = allTracks.slice()

  // map filter (country)
  if (mapFilter) {
    var country = mapFilter.value
    tracks = tracks.filter(function(s) {
      if (!s['Artist Country']) return false
      return s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(country) !== -1
    })
  }

  // network filter (genre)
  if (networkFilter) {
    var genre = networkFilter.value
    tracks = tracks.filter(function(s) {
      return (s['Main Genre'] || '').trim().toLowerCase() === genre.toLowerCase()
    })
  }

  // decade range — skip if full range selected
  var allDecadeMin = DECADE_DECADES.length ? DECADE_DECADES[0] : null
  var allDecadeMax = DECADE_DECADES.length ? DECADE_DECADES[DECADE_DECADES.length - 1] : null
  var decadeIsFullRange = (decadeMin === allDecadeMin && decadeMax === allDecadeMax)
  if (!decadeIsFullRange && decadeMin !== null && decadeMax !== null) {
    tracks = tracks.filter(function(s) {
      var y = parseInt(s['Release Date'])
      if (isNaN(y)) return false
      var d = Math.floor(y / 10) * 10
      if (d < decadeMin) return false
      if (d > decadeMax) return false
      return true
    })
  }

  // text search
  if (searchQuery) {
    tracks = tracks.filter(function(s) {
      return (s['Track Name']     || '').toLowerCase().includes(searchQuery) ||
             (s['Artist Name(s)'] || '').toLowerCase().includes(searchQuery) ||
             (s['Main Genre']     || '').toLowerCase().includes(searchQuery)
    })
  }

  return tracks
}

// ── RENDER TABLE ──
function renderTable() {
  var tracks     = sortTracks(getFilteredTracks(), currentSort.key, currentSort.dir)
  var filterType = networkFilter ? 'genre' : (mapFilter ? 'country' : null)

  // title label
  var parts = []
  if (mapFilter)     parts.push(mapFilter.value)
  if (networkFilter) parts.push(networkFilter.value)
  var dRange = formatDecadeRange()
  if (dRange && dRange !== 'all') parts.push(dRange)
  if (searchQuery)   parts.push('"' + searchQuery + '"')

  var titleEl = document.getElementById('songs-title')
  if (titleEl) titleEl.textContent = parts.length ? 'songs · ' + parts.join(' · ') : 'songs'

  // column visibility
  var showInfluence = filterType === 'genre' || filterType === 'influence'
  var showCountry   = filterType !== 'country'
  var theadRow = document.getElementById('songs-thead-row')
  if (theadRow) {
    var genreTh    = theadRow.querySelector('.col-genre')
    var influenceTh = theadRow.querySelector('.col-influence')
    var countryTh  = theadRow.querySelector('.col-country')
    if (genreTh)     genreTh.style.display     = showInfluence ? 'none' : ''
    if (influenceTh) influenceTh.style.display  = showInfluence ? '' : 'none'
    if (countryTh)   countryTh.style.display    = showCountry   ? '' : 'none'
  }

  var tbody  = document.getElementById('songs-tbody')
  var footer = document.getElementById('songs-footer')
  if (!tbody) return

  if (!tracks.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;opacity:0.5;font-size:14px;">no results</td></tr>'
    if (footer) footer.textContent = '0 songs'
    return
  }

  tbody.innerHTML = tracks.map(function(s) {
    var title     = esc(s['Track Name']     || '—')
    var artist    = esc(s['Artist Name(s)'] || '—')
    var year      = (s['Release Date'] || '').slice(0,4) || '—'
    var genre     = esc(s['Main Genre']     || '—')
    var influence = esc(s['Influence Genre']|| '—')
    var country   = esc((s['Artist Country']|| '—').split(';')[0].trim())
    var ytUrl     = s['YouTube URL'] ? s['YouTube URL'].trim() : ''
    var playBtn   = ytUrl
      ? '<a class="yt-play-btn" href="' + esc(ytUrl) + '" target="_blank" rel="noopener" title="open on YouTube">▶</a>'
      : ''
    return '<tr>' +
      '<td class="col-fixed col-title" title="' + title + '">' + title + playBtn + '</td>' +
      '<td class="col-artist" title="' + artist + '">' + artist + '</td>' +
      '<td class="col-year">' + year + '</td>' +
      (showInfluence
        ? '<td class="col-influence" title="' + influence + '">' + influence + '</td>'
        : '<td class="col-genre"    title="' + genre     + '">' + genre     + '</td>') +
      (showCountry ? '<td class="col-country" title="' + country + '">' + country + '</td>' : '') +
      '</tr>'
  }).join('')

  if (footer) footer.textContent = tracks.length + ' songs'
}

// ── CROSS-FILTER: dim map bubbles based on map selection + network filter ──
function applyMapDim() {
  if (!mapMarkers.length) return

  // base pool respects decade range
  var pool = decadeFilteredTracks()

  // countries active under network filter (within decade range)
  var networkActiveCountries = null
  if (networkFilter) {
    var nTracks = pool.filter(function(s) {
      return (s['Main Genre'] || '').trim().toLowerCase() === networkFilter.value.toLowerCase()
    })
    networkActiveCountries = {}
    nTracks.forEach(function(s) {
      if (!s['Artist Country']) return
      s['Artist Country'].split('; ').forEach(function(c) { networkActiveCountries[c.trim()] = true })
    })
  }

  // countries active under decade range alone (when no network filter)
  var decadeActiveCountries = null
  if ((decadeMin !== null || decadeMax !== null) && !networkFilter) {
    decadeActiveCountries = {}
    pool.forEach(function(s) {
      if (!s['Artist Country']) return
      s['Artist Country'].split('; ').forEach(function(c) { decadeActiveCountries[c.trim()] = true })
    })
  }

  var selectedCountry = mapFilter ? mapFilter.value : null
  var activeCountries = networkActiveCountries || decadeActiveCountries
  var hasAnyFilter    = !!(selectedCountry || activeCountries)

  mapMarkers.forEach(function(m) {
    var passesNetwork = !activeCountries || activeCountries[m.country]
    var isSelected    = selectedCountry && m.country === selectedCountry

    var fillOpacity, markerOpacity, stroke, strokeWidth
    if (!hasAnyFilter) {
      fillOpacity = 0.60; markerOpacity = 1; stroke = '#000000'; strokeWidth = 1
    } else if (isSelected) {
      fillOpacity = 0.85; markerOpacity = 1; stroke = '#ffffff'; strokeWidth = 2
    } else if (passesNetwork && !selectedCountry) {
      fillOpacity = 0.60; markerOpacity = 1; stroke = '#000000'; strokeWidth = 1
    } else {
      fillOpacity = 0.08; markerOpacity = 0.25; stroke = '#000000'; strokeWidth = 1
    }
    m.marker.setStyle({ fillOpacity: fillOpacity, opacity: markerOpacity, color: stroke, weight: strokeWidth })
  })
}

// ── DECADE-FILTERED TRACK SUBSET ──
// Returns tracks passing the decade range only (ignores map/network filters)
// Used by dim functions to know which nodes/countries are active in the current decade
function decadeFilteredTracks() {
  var allDecadeMin = DECADE_DECADES.length ? DECADE_DECADES[0] : null
  var allDecadeMax = DECADE_DECADES.length ? DECADE_DECADES[DECADE_DECADES.length - 1] : null
  var isFullRange  = (decadeMin === allDecadeMin && decadeMax === allDecadeMax)
  if (isFullRange || decadeMin === null || decadeMax === null) return allTracks
  return allTracks.filter(function(s) {
    var y = parseInt(s['Release Date'])
    if (isNaN(y)) return false
    var d = Math.floor(y / 10) * 10
    return d >= decadeMin && d <= decadeMax
  })
}

// ── APPLY ALL DIMS ──
// Single call that refreshes both map and network dims together
function applyAllDims() {
  applyMapDim()
  if (mapFilter && typeof window.applyNetworkDimByCountry === 'function') {
    window.applyNetworkDimByCountry(mapFilter.value)
  } else if (!mapFilter && typeof window.applyNetworkDimByDecade === 'function') {
    window.applyNetworkDimByDecade()
  }
  // update both titlebars whenever dims are recomputed
  updateMapStatus()
  var activeCountry = mapFilter ? mapFilter.value : null
  updateNetworkStatusForCountry(activeCountry)
}

// ── RELEASE MAP FILTER (background click) ──
function releaseMapFilter() {
  if (!mapFilter) return
  mapFilter = null
  applyMapDim()
  if (typeof window.applyNetworkDimByCountry === 'function') {
    window.applyNetworkDimByCountry(null)
  }
  renderTable()
  updateMapStatus()
  updateNetworkStatusForCountry(null)
  navPush()
}

function updateNetworkStatusForCountry(country) {
  if (typeof window.updateNetworkStatusForCountry === 'function') {
    window.updateNetworkStatusForCountry(country)
  }
}

function updateMapStatus() {
  var el = document.getElementById('map-status')
  if (!el) return

  var dRange     = formatDecadeRange()
  var hasDecade  = dRange !== 'all'
  var hasCountry = !!mapFilter
  var hasGenre   = !!(networkFilter && networkFilter.type === 'genre')

  // helper: count countries active in a given track pool
  function countActiveCountries(pool) {
    var seen = {}
    pool.forEach(function(s) {
      if (!s['Artist Country']) return
      s['Artist Country'].split('; ').forEach(function(c) { if (c.trim()) seen[c.trim()] = true })
    })
    return Object.keys(seen).length
  }

  if (hasCountry) {
    var country = mapFilter.value
    var rawCount = allTracks.filter(function(s) {
      if (!s['Artist Country']) return false
      return s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(country) !== -1
    }).length
    var base = country + ' (' + rawCount + ' songs)'

    if (hasGenre) {
      var genre = networkFilter.value
      // triple intersection: country + genre + decade
      var pool = decadeFilteredTracks()
      var n = pool.filter(function(s) {
        if (!s['Artist Country']) return false
        var inCountry = s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(country) !== -1
        var inGenre   = (s['Main Genre'] || '').trim().toLowerCase() === genre.toLowerCase()
        return inCountry && inGenre
      }).length
      el.textContent = hasDecade
        ? base + ' · ' + n + ' with ' + genre + ' from ' + dRange
        : base + ' · ' + n + ' with ' + genre
    } else if (hasDecade) {
      // country + decade: count songs from that country in that decade
      var pool = decadeFilteredTracks()
      var n = pool.filter(function(s) {
        if (!s['Artist Country']) return false
        return s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(country) !== -1
      }).length
      el.textContent = base + ' · ' + n + ' from ' + dRange
    } else {
      el.textContent = base
    }

  } else if (hasGenre) {
    var genre = networkFilter.value
    var pool  = decadeFilteredTracks()
    var activeCountries = {}
    pool.forEach(function(s) {
      if ((s['Main Genre'] || '').trim().toLowerCase() !== genre.toLowerCase()) return
      if (!s['Artist Country']) return
      s['Artist Country'].split('; ').forEach(function(c) { if (c.trim()) activeCountries[c.trim()] = true })
    })
    var n = Object.keys(activeCountries).length
    el.textContent = hasDecade
      ? n + ' ' + (n === 1 ? 'country' : 'countries') + ' with ' + genre + ' from ' + dRange
      : n + ' ' + (n === 1 ? 'country' : 'countries') + ' with ' + genre + ' songs'

  } else if (hasDecade) {
    // decade only: count countries with at least one song in this range
    var pool = decadeFilteredTracks()
    var seen = {}
    pool.forEach(function(s) {
      if (!s['Artist Country']) return
      s['Artist Country'].split('; ').forEach(function(c) { if (c.trim()) seen[c.trim()] = true })
    })
    var nc = Object.keys(seen).length
    el.textContent = nc + ' ' + (nc === 1 ? 'country' : 'countries') + ' with ' + dRange + ' songs'

  } else {
    var seen = {}
    mapMarkers.forEach(function(m) { seen[m.country] = true })
    el.textContent = Object.keys(seen).length + ' countries'
  }
}

// ── GLOBAL FILTER (called by network.js on node/edge click) ──
window.filterSongs = function(type, value) {
  if (!allTracks.length) return
  if (type === 'genre') {
    networkFilter = { type: 'genre', value: value }
  } else if (type === 'country') {
    mapFilter = { type: 'country', value: value }
  } else {
    networkFilter = { type: type, value: value }
  }
  applyMapDim()
  renderTable()
  updateMapStatus()
  navPush()
}

// ── RAW FILTER (for influence edge panel in network.js) ──
window.filterSongsRaw = function(label, songs, filterType) {
  networkFilter = { type: filterType || 'influence', value: label }
  // leave mapFilter untouched — influence edge replaces network filter only
  var titleEl = document.getElementById('songs-title')
  if (titleEl) titleEl.textContent = 'songs · ' + label

  var theadRow = document.getElementById('songs-thead-row')
  if (theadRow) {
    var g = theadRow.querySelector('.col-genre')
    var i = theadRow.querySelector('.col-influence')
    var c = theadRow.querySelector('.col-country')
    if (g) g.style.display = 'none'
    if (i) i.style.display = ''
    if (c) c.style.display = ''
  }

  var sorted = sortTracks(songs, currentSort.key, currentSort.dir)
  var tbody  = document.getElementById('songs-tbody')
  var footer = document.getElementById('songs-footer')
  if (!tbody) return

  tbody.innerHTML = sorted.map(function(s) {
    var title     = esc(s['Track Name']     || '—')
    var artist    = esc(s['Artist Name(s)'] || '—')
    var year      = (s['Release Date'] || '').slice(0,4) || '—'
    var influence = esc(s['Influence Genre']|| '—')
    var country   = esc((s['Artist Country']|| '—').split(';')[0].trim())
    var ytUrl     = s['YouTube URL'] ? s['YouTube URL'].trim() : ''
    var playBtn   = ytUrl
      ? '<a class="yt-play-btn" href="' + esc(ytUrl) + '" target="_blank" rel="noopener" title="open on YouTube">▶</a>'
      : ''
    return '<tr>' +
      '<td class="col-fixed col-title" title="' + title + '">' + title + playBtn + '</td>' +
      '<td class="col-artist" title="' + artist + '">' + artist + '</td>' +
      '<td class="col-year">' + year + '</td>' +
      '<td class="col-influence" title="' + influence + '">' + influence + '</td>' +
      '<td class="col-country"  title="' + country   + '">' + country   + '</td>' +
      '</tr>'
  }).join('')
  if (footer) footer.textContent = sorted.length + ' songs'
  applyMapDim()
  navPush()
}

// ── NAVIGATION HISTORY ──

function navStateLabel(state) {
  var parts = []
  if (state.mapFilter)     parts.push(state.mapFilter.value)
  if (state.networkFilter) parts.push(state.networkFilter.value)
  if (state.decadeMin !== null && state.decadeMax !== null) {
    var allMin = DECADE_DECADES.length ? DECADE_DECADES[0] : null
    var allMax = DECADE_DECADES.length ? DECADE_DECADES[DECADE_DECADES.length - 1] : null
    if (state.decadeMin !== allMin || state.decadeMax !== allMax) {
      parts.push(state.decadeMin + 's–' + state.decadeMax + 's')
    }
  }
  return parts.length ? parts.join(' · ') : 'all songs'
}

function navCurrentState() {
  return {
    mapFilter:     mapFilter     ? Object.assign({}, mapFilter)     : null,
    networkFilter: networkFilter ? Object.assign({}, networkFilter) : null,
    decadeMin:     decadeMin,
    decadeMax:     decadeMax
  }
}

function navStatesEqual(a, b) {
  var mA = a.mapFilter     ? a.mapFilter.value     : null
  var mB = b.mapFilter     ? b.mapFilter.value     : null
  var nA = a.networkFilter ? a.networkFilter.value : null
  var nB = b.networkFilter ? b.networkFilter.value : null
  return mA === mB && nA === nB && a.decadeMin === b.decadeMin && a.decadeMax === b.decadeMax
}

function navPush() {
  if (navPaused) return
  var state = navCurrentState()
  // deduplicate — don't push if current state matches top of stack
  if (navIndex >= 0 && navStatesEqual(navHistory[navIndex], state)) return
  // trim forward history
  navHistory = navHistory.slice(0, navIndex + 1)
  navHistory.push(state)
  navIndex = navHistory.length - 1
  updateNavButtons()
  updateNavDropdown()
}

function navRestore(state) {
  navPaused = true
  mapFilter     = state.mapFilter     ? Object.assign({}, state.mapFilter)     : null
  networkFilter = state.networkFilter ? Object.assign({}, state.networkFilter) : null
  decadeMin     = state.decadeMin
  decadeMax     = state.decadeMax

  // re-apply all visual state
  if (typeof window.clearNetworkDim === 'function') window.clearNetworkDim()

  if (networkFilter && networkFilter.type === 'genre') {
    // restore genre node dim
    if (typeof window.applyNetworkDimByGenre === 'function') {
      window.applyNetworkDimByGenre(networkFilter.value)
    }
  }

  // apply map + decade dims (handles all combinations)
  applyAllDims()

  // update decade slider UI
  if (_updateDecadeUI) _updateDecadeUI()

  renderTable()
  updateNavButtons()
  updateNavDropdown()
  navPaused = false
}

function navBack() {
  if (navIndex <= 0) return
  navIndex--
  navRestore(navHistory[navIndex])
}

function navForward() {
  if (navIndex >= navHistory.length - 1) return
  navIndex++
  navRestore(navHistory[navIndex])
}

function updateNavButtons() {
  var back    = document.getElementById('nav-back')
  var forward = document.getElementById('nav-forward')
  var hist    = document.getElementById('nav-history-btn')
  if (back)    back.disabled    = navIndex <= 0
  if (forward) forward.disabled = navIndex >= navHistory.length - 1
  if (hist)    hist.disabled    = navHistory.length <= 1
}

function updateNavDropdown() {
  var dropdown = document.getElementById('nav-history-dropdown')
  if (!dropdown) return
  dropdown.innerHTML = ''
  // deduplicated view of the stack: each state appears once,
  // at the position of its most recent occurrence.
  // the underlying navHistory keeps the full visit sequence —
  // back/forward still walk every step.
  var current = navIndex >= 0 ? navHistory[navIndex] : null
  var seen = []
  for (var i = navHistory.length - 1; i >= 0; i--) {
    var state = navHistory[i]
    var alreadyShown = false
    for (var j = 0; j < seen.length; j++) {
      if (navStatesEqual(seen[j], state)) { alreadyShown = true; break }
    }
    if (alreadyShown) continue
    seen.push(state)
    var item  = document.createElement('div')
    var isCurrent = current && navStatesEqual(state, current)
    item.className = 'nav-history-item' + (isCurrent ? ' current' : '')
    item.setAttribute('data-idx', i)
    var label = document.createElement('span')
    label.textContent = navStateLabel(state)
    item.appendChild(label)
    dropdown.appendChild(item)
  }

  dropdown.querySelectorAll('.nav-history-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var idx = parseInt(item.getAttribute('data-idx'))
      navIndex = idx
      navRestore(navHistory[idx])
      closeNavDropdown()
    })
  })
}

function closeNavDropdown() {
  var d = document.getElementById('nav-history-dropdown')
  if (d) d.classList.remove('open')
}

// ── EXPOSE: network.js checks whether a network filter is active ──
window.getNetworkFilterActive = function() {
  return !!networkFilter
}

window.getMapFilter = function() {
  return mapFilter ? mapFilter.value : null
}

window.getDecadeRange = function() {
  var r = formatDecadeRange()
  return r === 'all' ? null : r
}

window.getDecadeFilteredTracksForStatus = function() {
  return decadeFilteredTracks()
}

window.clearNetworkFilter = function() {
  if (!networkFilter) return
  networkFilter = null
  renderTable()
  updateMapStatus()
  navPush()
}

// ── EXPOSE: network.js calls this to get genres active in the current map filter ──
// Returns a Set of genre ids that have songs in the currently filtered track set,
// or null if no map filter is active (= no dimming needed)
window.getActiveGenresForDim = function() {
  // base pool always respects decade range
  var pool = decadeFilteredTracks()

  if (mapFilter) {
    // genres present in the selected country within the decade range
    var country = mapFilter.value
    var tracks = pool.filter(function(s) {
      if (!s['Artist Country']) return false
      return s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(country) !== -1
    })
    var genres = {}
    tracks.forEach(function(s) {
      var g = (s['Main Genre'] || '').trim()
      if (g) genres[g] = true
    })
    return genres
  }

  // no map filter — but decade filter active: return all genres in that decade range
  if (decadeMin !== null || decadeMax !== null) {
    var genres = {}
    pool.forEach(function(s) {
      var g = (s['Main Genre'] || '').trim()
      if (g) genres[g] = true
    })
    return genres
  }

  return null  // no spatial or temporal filter
}

// ── RESET ALL ──
function resetAll() {
  mapFilter     = null
  networkFilter = null
  searchQuery   = ''
  var input = document.getElementById('songs-search')
  if (input) input.value = ''

  // reset decade slider to full range
  if (DECADE_DECADES.length) {
    decadeMin = DECADE_DECADES[0]
    decadeMax = DECADE_DECADES[DECADE_DECADES.length - 1]
    updateDecadeUI()
  }

  // clear map dim + close any open popup + recenter
  mapMarkers.forEach(function(m) {
    m.marker.setStyle({ fillOpacity: 0.60, opacity: 1 })
  })
  if (window._leafletMap) {
    window._leafletMap.closePopup()
    window._leafletMap.setView([20, 0], 2, { animate: true })
  }

  // clear network dim + close overlays + recenter
  if (typeof window.clearNetworkDim  === 'function') window.clearNetworkDim()
  if (typeof window.resetNetworkView === 'function') window.resetNetworkView()

  applyAllDims()
  renderTable()

  // push clean state to history (don't clear history)
  navPush()
  updateNavDropdown()
}

// ── DECADE SLIDER ──
var _updateDecadeUI = null  // set by initDecadeSlider

function formatDecadeRange() {
  if (!DECADE_DECADES.length) return 'all'
  var allMin = DECADE_DECADES[0]
  var allMax = DECADE_DECADES[DECADE_DECADES.length - 1]
  var dMin   = decadeMin !== null ? decadeMin : allMin
  var dMax   = decadeMax !== null ? decadeMax : allMax
  if (dMin === allMin && dMax === allMax) return 'all'
  return dMin + 's – ' + dMax + 's'
}

function updateDecadeUI() {
  if (_updateDecadeUI) _updateDecadeUI()
}

function initDecadeSlider(decades) {
  DECADE_DECADES = decades.slice().sort(function(a,b){return a-b})
  if (!DECADE_DECADES.length) return

  decadeMin = DECADE_DECADES[0]
  decadeMax = DECADE_DECADES[DECADE_DECADES.length - 1]

  var track    = document.getElementById('decade-track')
  var fill     = document.getElementById('decade-fill')
  var thumbMin = document.getElementById('thumb-min')
  var thumbMax = document.getElementById('thumb-max')
  var label    = document.getElementById('decade-range-label')
  var ticks    = document.getElementById('decade-ticks')
  var resetBtn = document.getElementById('decade-reset')

  if (!track || !fill || !thumbMin || !thumbMax) return

  // build ticks
  ticks.innerHTML = ''
  DECADE_DECADES.forEach(function(d) {
    var tick = document.createElement('div')
    tick.className = 'decade-tick'
    tick.textContent = d + 's'
    ticks.appendChild(tick)
  })

  function idxOf(decade) {
    return DECADE_DECADES.indexOf(decade)
  }

  function pctOf(decade) {
    var range = DECADE_DECADES[DECADE_DECADES.length-1] - DECADE_DECADES[0]
    if (!range) return 0
    return (decade - DECADE_DECADES[0]) / range
  }

  function snapToDecade(pct) {
    var idx = Math.round(pct * (DECADE_DECADES.length - 1))
    idx = Math.max(0, Math.min(DECADE_DECADES.length - 1, idx))
    return DECADE_DECADES[idx]
  }

  function pctFromEvent(e) {
    var rect = track.getBoundingClientRect()
    var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function doUpdateUI() {
    // guard: if elements got detached somehow, do nothing
    if (!document.getElementById('decade-track')) return
    var pMin = pctOf(decadeMin)
    var pMax = pctOf(decadeMax)
    fill.style.left   = (pMin * 100) + '%'
    fill.style.width  = ((pMax - pMin) * 100) + '%'
    thumbMin.style.left = (pMin * 100) + '%'
    thumbMax.style.left = (pMax * 100) + '%'
    label.textContent = formatDecadeRange()
  }
  _updateDecadeUI = doUpdateUI

  // ── drag state ──
  // mode: 'min' | 'max' | 'range'
  var dragMode      = null
  var dragStartPct  = null   // cursor pct when drag started
  var dragStartMin  = null   // decadeMin index when drag started
  var dragStartMax  = null   // decadeMax index when drag started

  function clientX(e) {
    return (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX
  }

  function startDrag(e, mode) {
    e.preventDefault()
    e.stopPropagation()
    dragMode     = mode
    dragStartPct = pctFromEvent(e)
    dragStartMin = idxOf(decadeMin)
    dragStartMax = idxOf(decadeMax)
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup',   endDrag)
    document.addEventListener('touchmove', onDrag, { passive: false })
    document.addEventListener('touchend',  endDrag)
  }

  function onDrag(e) {
    if (!dragMode) return
    if (e.cancelable) e.preventDefault()

    var pct = pctFromEvent(e)

    if (dragMode === 'min') {
      decadeMin = Math.min(snapToDecade(pct), decadeMax)

    } else if (dragMode === 'max') {
      decadeMax = Math.max(snapToDecade(pct), decadeMin)

    } else if (dragMode === 'range') {
      // shift the whole range by however many steps the cursor moved
      var deltaPct  = pct - dragStartPct
      var totalSteps = DECADE_DECADES.length - 1
      var deltaSteps = Math.round(deltaPct * totalSteps)
      var rangeLen   = dragStartMax - dragStartMin

      var newMinIdx = dragStartMin + deltaSteps
      var newMaxIdx = dragStartMax + deltaSteps

      // clamp so range doesn't go out of bounds
      if (newMinIdx < 0) { newMinIdx = 0; newMaxIdx = rangeLen }
      if (newMaxIdx > totalSteps) { newMaxIdx = totalSteps; newMinIdx = totalSteps - rangeLen }

      decadeMin = DECADE_DECADES[newMinIdx]
      decadeMax = DECADE_DECADES[newMaxIdx]
    }

    doUpdateUI()
    applyAllDims()
    renderTable()
  }

  function endDrag() {
    dragMode = null
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup',   endDrag)
    document.removeEventListener('touchmove', onDrag)
    document.removeEventListener('touchend',  endDrag)
    navPush()
  }

  // thumb events
  thumbMin.addEventListener('mousedown',  function(e) { startDrag(e, 'min') })
  thumbMax.addEventListener('mousedown',  function(e) { startDrag(e, 'max') })
  thumbMin.addEventListener('touchstart', function(e) { startDrag(e, 'min') }, { passive: false })
  thumbMax.addEventListener('touchstart', function(e) { startDrag(e, 'max') }, { passive: false })

  // fill drag — moves the whole range
  fill.addEventListener('mousedown',  function(e) { startDrag(e, 'range') })
  fill.addEventListener('touchstart', function(e) { startDrag(e, 'range') }, { passive: false })
  fill.style.cursor = 'grab'

  // click on empty track area — snap nearest thumb
  track.addEventListener('mousedown', function(e) {
    if (e.target === thumbMin || e.target === thumbMax || e.target === fill) return
    var pct     = pctFromEvent(e)
    var d       = snapToDecade(pct)
    var distMin = Math.abs(pctOf(decadeMin) - pct)
    var distMax = Math.abs(pctOf(decadeMax) - pct)
    if (distMin <= distMax) decadeMin = Math.min(d, decadeMax)
    else                    decadeMax = Math.max(d, decadeMin)
    doUpdateUI()
    applyAllDims()
    renderTable()
    navPush()
  })

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      decadeMin = DECADE_DECADES[0]
      decadeMax = DECADE_DECADES[DECADE_DECADES.length - 1]
      doUpdateUI()
      applyAllDims()
      renderTable()
      navPush()
    })
  }

  doUpdateUI()
}

// ── CHART DEFAULTS ──
function initChartDefaults() {
  Chart.defaults.font.family = "'VT323', monospace"
  Chart.defaults.font.size = 14
  Chart.defaults.color = '#1a1a1a'
  Chart.register(ChartDataLabels)
}

// ── MAP ──
function buildMap(tracks) {
  var countries = {}
  var countryContinents = {}

  tracks.forEach(function(s) {
    if (!s['Artist Country']) return
    var cList    = s['Artist Country'].split('; ')
    var contList = (s['Artist Continent'] || '').split('; ')
    cList.forEach(function(c, i) {
      c = c.trim()
      if (!c || c === 'Unknown') return
      countries[c] = (countries[c] || 0) + 1
      if (!countryContinents[c]) {
        countryContinents[c] = (contList[i] || '').trim() || 'Unknown'
      }
    })
  })

  var map = L.map('map').setView([20, 0], 2)
  window._leafletMap = map

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd'
  }).addTo(map)

  var maxCount = Math.max.apply(null, Object.values(countries))

  Object.keys(countries).forEach(function(country) {
    if (country === 'Unknown' || !countryCoordinates[country]) return
    var count     = countries[country]
    var radius    = Math.sqrt(count / maxCount) * 40
    var continent = countryContinents[country] || 'Unknown'
    var color     = CONTINENT_COLORS[continent] || CONTINENT_COLORS['Unknown']

    var marker = L.circleMarker(countryCoordinates[country], {
      radius: radius,
      fillColor: color,
      color: '#000000',
      weight: 1,
      fillOpacity: 0.60
    })
    .on('mouseover', function(e) {
      // show tooltip
      var mapEl   = document.getElementById('map')
      var tooltip = document.getElementById('map-tooltip')
      if (tooltip && mapEl) {
        tooltip.innerHTML = '<strong style="color:#e2e8f0">' + country + '</strong>' +
          '<div style="margin-top:4px;opacity:0.7">' + count + ' songs</div>'
        tooltip.style.opacity = '1'
        var rect = mapEl.getBoundingClientRect()
        tooltip.style.left = (e.originalEvent.clientX - rect.left + 14) + 'px'
        tooltip.style.top  = (e.originalEvent.clientY - rect.top  - 10) + 'px'
      }
      // hover dim — only if no permanent filter is active for this country
      if (!mapFilter || mapFilter.value !== country) {
        mapMarkers.forEach(function(m) {
          if (m.country !== country) {
            m.marker.setStyle({ fillOpacity: 0.08, opacity: 0.25 })
          } else {
            m.marker.setStyle({ fillOpacity: 0.85, color: '#ffffff', weight: 2 })
          }
        })
      }
    })
    .on('mousemove', function(e) {
      var mapEl   = document.getElementById('map')
      var tooltip = document.getElementById('map-tooltip')
      if (tooltip && mapEl) {
        var rect = mapEl.getBoundingClientRect()
        tooltip.style.left = (e.originalEvent.clientX - rect.left + 14) + 'px'
        tooltip.style.top  = (e.originalEvent.clientY - rect.top  - 10) + 'px'
      }
    })
    .on('mouseout', function() {
      // hide tooltip
      var tooltip = document.getElementById('map-tooltip')
      if (tooltip) tooltip.style.opacity = '0'
      // restore dim state — if filter active, reapply it; otherwise restore all
      applyMapDim()
    })
    .on('click', function(e) {
      L.DomEvent.stopPropagation(e)
      mapFilter = { type: 'country', value: country }
      renderTable()
      applyMapDim()
      if (typeof window.applyNetworkDimByCountry === 'function') {
        window.applyNetworkDimByCountry(country)
      }
      navPush()
      updateMapStatus()
      updateNetworkStatusForCountry(country)
    })
    .addTo(map)

    mapMarkers.push({ marker: marker, country: country })
  })

  // update map status meta with country count
  var mapStatusEl = document.getElementById('map-status')
  if (mapStatusEl) mapStatusEl.textContent = Object.keys(countries).length + ' countries'

  // background click releases map filter
  map.on('click', function() {
    releaseMapFilter()
  })

  setTimeout(function() { map.invalidateSize() }, 100)
}

// ── MAIN ──
document.addEventListener('DOMContentLoaded', function() {
  updateClock()
  initChartDefaults()
  setStatus('loading...')
  initSearchBox()

  var resetAllBtn = document.getElementById('reset-all-btn')
  if (resetAllBtn) resetAllBtn.addEventListener('click', resetAll)

  var navBackBtn = document.getElementById('nav-back')
  if (navBackBtn) navBackBtn.addEventListener('click', navBack)

  var navFwdBtn = document.getElementById('nav-forward')
  if (navFwdBtn) navFwdBtn.addEventListener('click', navForward)

  var navHistBtn = document.getElementById('nav-history-btn')
  if (navHistBtn) navHistBtn.addEventListener('click', function(e) {
    e.stopPropagation()
    var d = document.getElementById('nav-history-dropdown')
    if (d) d.classList.toggle('open')
  })

  // close dropdown when clicking outside
  document.addEventListener('click', function() { closeNavDropdown() })

  var networkResetBtn = document.getElementById('network-reset-btn')
  if (networkResetBtn) networkResetBtn.addEventListener('click', function() {
    networkFilter = null
    if (typeof window.clearNetworkDim  === 'function') window.clearNetworkDim()
    if (typeof window.resetNetworkView === 'function') window.resetNetworkView()
    applyAllDims()
    renderTable()
    navPush()
  })

  var mapResetBtn = document.getElementById('map-reset-btn')
  if (mapResetBtn) mapResetBtn.addEventListener('click', function() {
    releaseMapFilter()
  })

  Papa.parse('data/master_playlist_enriched.csv', {
    header: true,
    download: true,
    error: function(err) {
      setStatus('error loading CSV: ' + err.message)
      console.error('CSV error:', err)
    },
    complete: function(results) {
      allTracks = results.data.filter(function(r) { return r['Track Name'] && r['Track Name'].trim() })
      setStatus(allTracks.length + ' tracks loaded')

      var decadeSet = {}
      allTracks.forEach(function(s) {
        var y = parseInt(s['Release Date'])
        if (!isNaN(y)) decadeSet[Math.floor(y/10)*10] = true
      })
      var dataDecades = Object.keys(decadeSet).map(Number).sort()

      // Option C: fill every decade between earliest and latest
      var decades = []
      if (dataDecades.length) {
        var dMin = dataDecades[0]
        var dMax = dataDecades[dataDecades.length - 1]
        for (var d = dMin; d <= dMax; d += 10) decades.push(d)
      }

      // set CSS var for grid line divisions
      var trackEl = document.getElementById('decade-track')
      if (trackEl && decades.length > 1) {
        trackEl.style.setProperty('--decade-count', decades.length - 1)
      }

      initDecadeSlider(decades)
      // decadeMin/Max are set to full range by initDecadeSlider — leave them as-is

      initSortArrows()
      renderTable()
      buildMap(allTracks)

      // push initial clean state so back button can always return to zero
      navPush()
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
  "Germany":"German","Austria":"German","Italy":"Italian",
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
