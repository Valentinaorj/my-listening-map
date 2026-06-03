// ============================================
//  artists.js — My Listening Map
//  Artists tab: cards with Wikipedia images
// ============================================

;(function() {

  var CONTINENT_COLORS = {
    'America':  '#e8614a',
    'Europe':   '#b8a0d4',
    'Africa':   '#e8c547',
    'Asia':     '#7dd4a8',
    'Oceania':  '#f4a24a',
    'Unknown':  '#aaaaaa'
  }

  var allArtists = []
  var filteredArtists = []
  var currentSort = 'songs'
  var currentSearch = ''
  var currentContinent = 'all'
  var slugCache = {}  // slug → image URL or null
  var observerSet = new Set()

  // ── WIKIPEDIA IMAGE URL ──
  // Fetch only the summary JSON to get the image URL,
  // then set it as img.src directly (avoids ORB blocking)
  function loadWikipediaImage(slug, imgEl) {
    if (!slug) return

    if (slugCache[slug] !== undefined) {
      if (slugCache[slug]) { imgEl.src = slugCache[slug]; imgEl.style.opacity = '1' }
      return
    }

    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug)
    fetch(url, { mode: 'cors' })
      .then(function(r) { return r.ok ? r.json() : null })
      .then(function(data) {
        var imgUrl = (data && data.thumbnail && data.thumbnail.source) ? data.thumbnail.source : null
        if (imgUrl) imgUrl = imgUrl.replace(/\/\d+px-/, '/240px-')
        slugCache[slug] = imgUrl || null
        if (imgUrl) {
          imgEl.src = imgUrl
          imgEl.style.opacity = '1'
        }
      })
      .catch(function() { slugCache[slug] = null })
  }

  // ── INITIALS AVATAR ──
  function getInitials(name) {
    var parts = name.trim().split(/\s+/)
    if (parts.length === 1) return name.slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  function getAvatarColor(name) {
    var colors = [
      '#e8614a','#b8a0d4','#e8c547','#7dd4a8',
      '#f4a24a','#f4a0b8','#6090c8','#a0c870'
    ]
    var hash = 0
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
    return colors[Math.abs(hash) % colors.length]
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── RENDER CARDS ──
  function renderCards(artists) {
    var grid = document.getElementById('artists-grid')
    var count = document.getElementById('artists-count')
    if (!grid) return

    if (count) count.textContent = artists.length + ' artistas'

    if (!artists.length) {
      grid.innerHTML = '<div class="artists-empty">sin resultados</div>'
      return
    }

    grid.innerHTML = artists.map(function(a) {
      var initials    = getInitials(a.name)
      var avatarColor = getAvatarColor(a.name)
      var contColor   = CONTINENT_COLORS[a.continent] || CONTINENT_COLORS['Unknown']
      var genres      = (a.main_genres || []).slice(0, 2).join(', ') || '—'
      var albumCount  = (a.albums || []).length
      var slug        = a.wikipedia_slug || ''

      return [
        '<div class="artist-card" data-slug="' + encodeURIComponent(slug) + '" data-name="' + encodeURIComponent(a.name) + '">',
          '<div class="artist-card-photo">',
            '<div class="artist-avatar" style="background:' + avatarColor + '">',
              initials,
            '</div>',
            slug ? '<img class="artist-photo" referrerpolicy="no-referrer" data-slug="' + encodeURIComponent(slug) + '" alt="">' : '',
          '</div>',
          '<div class="artist-card-body">',
            '<div class="artist-name" title="' + escHtml(a.name) + '">' + escHtml(a.name) + '</div>',
            '<div class="artist-meta">',
              '<span class="artist-country" style="border-color:' + contColor + '">' + escHtml(a.country || '?') + '</span>',
            '</div>',
            '<div class="artist-genre">' + escHtml(genres) + '</div>',
            '<div class="artist-stats">',
              '<span class="artist-stat"><span class="artist-stat-n">' + a.song_count + '</span> canciones</span>',
              '<span class="artist-stat"><span class="artist-stat-n">' + albumCount + '</span> álbumes</span>',
            '</div>',
          '</div>',
        '</div>'
      ].join('')
    }).join('')

    // lazy-load images via IntersectionObserver
    var imgs = grid.querySelectorAll('img.artist-photo')
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return
          var img = entry.target
          var slug = decodeURIComponent(img.getAttribute('data-slug'))
          if (observerSet.has(slug)) return
          observerSet.add(slug)
          observer.unobserve(img)
          loadWikipediaImage(slug, img)
        })
      }, { rootMargin: '9999px' })
      imgs.forEach(function(img) { observer.observe(img) })
    } else {
      imgs.forEach(function(img) {
        var slug = decodeURIComponent(img.getAttribute('data-slug'))
        loadWikipediaImage(slug, img)
      })
    }

    // click card → filter songs in left panel
    grid.querySelectorAll('.artist-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var name = decodeURIComponent(card.getAttribute('data-name'))
        if (typeof window.filterSongs === 'function') {
          window.filterSongs('artist', name)
        }
      })
    })
  }

  // ── FILTER + SORT ──
  function applyFilters() {
    var result = allArtists.slice()

    if (currentSearch) {
      var q = currentSearch.toLowerCase()
      result = result.filter(function(a) {
        return a.name.toLowerCase().includes(q) ||
               (a.country || '').toLowerCase().includes(q) ||
               (a.main_genres || []).some(function(g) { return g.toLowerCase().includes(q) })
      })
    }

    if (currentContinent !== 'all') {
      result = result.filter(function(a) { return a.continent === currentContinent })
    }

    if (currentSort === 'songs') {
      result.sort(function(a, b) { return b.song_count - a.song_count })
    } else if (currentSort === 'name') {
      result.sort(function(a, b) { return a.name.localeCompare(b.name) })
    } else if (currentSort === 'country') {
      result.sort(function(a, b) { return (a.country || '').localeCompare(b.country || '') })
    }

    filteredArtists = result
    renderCards(result)
  }

  // ── CONTINENT PILLS ──
  function buildContinentFilter(artists) {
    var wrap = document.getElementById('artists-continent-filter')
    if (!wrap) return

    var counts = {}
    artists.forEach(function(a) {
      var c = a.continent || 'Unknown'
      counts[c] = (counts[c] || 0) + 1
    })

    var continents = ['all'].concat(Object.keys(counts).sort())

    wrap.innerHTML = continents.map(function(c) {
      var label = c === 'all' ? 'todos' : c.toLowerCase()
      var style = c === 'all' ? '' : 'border-color:' + (CONTINENT_COLORS[c] || '#aaa')
      return '<button class="continent-pill' + (c === 'all' ? ' active' : '') + '" data-continent="' + c + '" style="' + style + '">' +
        label + (c !== 'all' ? ' <span class="pill-count">(' + counts[c] + ')</span>' : '') +
        '</button>'
    }).join('')

    wrap.addEventListener('click', function(e) {
      var btn = e.target.closest('.continent-pill')
      if (!btn) return
      wrap.querySelectorAll('.continent-pill').forEach(function(b) { b.classList.remove('active') })
      btn.classList.add('active')
      currentContinent = btn.getAttribute('data-continent')
      applyFilters()
    })
  }

  // ── INIT ──
  function initArtists() {
    fetch('data/artists.json')
      .then(function(r) { return r.ok ? r.json() : [] })
      .then(function(data) {
        allArtists = data
        buildContinentFilter(allArtists)
        applyFilters()

        var searchInput = document.getElementById('artists-search')
        if (searchInput) {
          var debounce = null
          searchInput.addEventListener('input', function() {
            clearTimeout(debounce)
            debounce = setTimeout(function() {
              currentSearch = searchInput.value.trim()
              applyFilters()
            }, 200)
          })
        }

        var sortSelect = document.getElementById('artists-sort')
        if (sortSelect) {
          sortSelect.addEventListener('change', function() {
            currentSort = sortSelect.value
            applyFilters()
          })
        }
      })
      .catch(function(err) {
        console.error('artists.json load error:', err)
        var grid = document.getElementById('artists-grid')
        if (grid) grid.innerHTML = '<div class="artists-empty">error cargando artistas</div>'
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArtists)
  } else {
    initArtists()
  }

})()
