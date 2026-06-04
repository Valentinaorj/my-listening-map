// ============================================
//  network.js — D3 force-directed genre graph
//  features: cluster filter, genre search,
//            node overlay, edge tooltip,
//            influence edge song list, legend
// ============================================

;(function() {

  var CLUSTER_COLORS = {
    'caribe':                  '#ff6b35',
    'afro-sudamericano':       '#e8c547',
    'andina':                  '#c084fc',
    'cancion':                 '#fb7185',
    'brasileira':              '#34d399',
    'rock-latino-espanol':     '#f97316',
    'hip-hop-latino':          '#a78bfa',
    'jazz':                    '#60a5fa',
    'soul-rnb-funk':           '#f472b6',
    'hip-hop':                 '#94a3b8',
    'rock':                    '#ef4444',
    'electronic':              '#22d3ee',
    'african-global-roots':    '#fbbf24',
    'folk-singer-songwriter':  '#86efac',
    'classical-experimental':  '#c4b5fd',
    'pop-indie':               '#fdba74',
    'ancestor':                '#1e293b',
  }

  var CLUSTER_LABELS = {
    'caribe':                  'caribe',
    'afro-sudamericano':       'afro-sudamericano',
    'andina':                  'andina',
    'cancion':                 'canción',
    'brasileira':              'brasileira',
    'rock-latino-espanol':     'rock latino y español',
    'hip-hop-latino':          'hip hop latino',
    'jazz':                    'jazz',
    'soul-rnb-funk':           'soul / r&b / funk',
    'hip-hop':                 'hip hop',
    'rock':                    'rock',
    'electronic':              'electronic',
    'african-global-roots':    'african & global roots',
    'folk-singer-songwriter':  'folk / singer-songwriter',
    'classical-experimental':  'classical / experimental',
    'pop-indie':               'pop / indie',
    'ancestor':                'root / ancestor',
  }

  // origin  = solid line
  // subgenre = dashed
  // influence = dotted
  var EDGE_STYLES = {
    'origin':    { color: 'rgba(255,255,255,0.55)', dash: null,    width: 1.5 },
    'subgenre':  { color: 'rgba(255,255,255,0.30)', dash: '6,4',   width: 1   },
    'influence': { color: 'rgba(255,255,255,0.25)', dash: '2,3',   width: 1   },
  }

  // ── STATE ──
  var nodeById       = {}
  var adjParents     = {}
  var adjChildren    = {}
  var overlayHistory = []
  var allNodes       = []
  var allEdges       = []
  var allTracks      = []
  var validEdges     = []   // hoisted so updateNetworkStatus can access it
  var hiddenClusters  = new Set()
  var hiddenEdgeTypes = new Set()
  var activeSelection = null  // { type: 'node'|'edge', nodeId?, srcId?, tgtId? }
  var adj             = {}    // adjacency list — populated after data loads

  // D3 selections — needed for filter updates
  var nodeSelection    = null
  var linkHitSelection = null
  var linkVisSelection = null
  var zoomBehavior     = null
  var svgSelection     = null
  var networkContainer = null
  var updateNetworkStatus = null  // assigned in initNetwork, called from openOverlay/closeOverlay

  function parseCSV(text) {
    var lines   = text.trim().split('\n')
    var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/\r/g, '').replace(/^"|"$/g, '') })
    return lines.slice(1).map(function(line) {
      // handle quoted fields
      var vals = []
      var cur  = ''
      var inQ  = false
      for (var i = 0; i < line.length; i++) {
        var ch = line[i]
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { vals.push(cur.trim().replace(/\r/g, '')); cur = '' }
        else { cur += ch }
      }
      vals.push(cur.trim().replace(/\r/g, ''))
      var obj = {}
      headers.forEach(function(h, i) { obj[h] = vals[i] || '' })
      return obj
    })
  }

  // ── CLUSTER VISIBILITY ──
  function isNodeVisible(d) {
    return !hiddenClusters.has(d.cluster)
  }

  function isEdgeVisible(e) {
    var srcHidden  = hiddenClusters.has(e.source.cluster || (nodeById[e.source] && nodeById[e.source].cluster))
    var tgtHidden  = hiddenClusters.has(e.target.cluster || (nodeById[e.target] && nodeById[e.target].cluster))
    var typeHidden = hiddenEdgeTypes.has(e.type)
    return !srcHidden && !tgtHidden && !typeHidden
  }

  function isEdgeGhost(e) {
    if (hiddenEdgeTypes.has(e.type)) return false
    var srcHidden = hiddenClusters.has(e.source.cluster)
    var tgtHidden = hiddenClusters.has(e.target.cluster)
    return srcHidden !== tgtHidden
  }

  function applyVisibility() {
    if (!nodeSelection) return

    nodeSelection.style('display', function(d) {
      return isNodeVisible(d) ? null : 'none'
    })

    linkVisSelection
      .style('display', function(d) {
        if (hiddenEdgeTypes.has(d.type)) return 'none'
        if (isEdgeVisible(d)) return null
        if (isEdgeGhost(d))   return null
        return 'none'
      })
      .attr('stroke-opacity', function(d) {
        return isEdgeGhost(d) ? '0.08' : null
      })

    linkHitSelection.style('display', function(d) {
      if (hiddenEdgeTypes.has(d.type)) return 'none'
      return (isEdgeVisible(d) || isEdgeGhost(d)) ? null : 'none'
    })

    // re-apply dim if something is selected
    if (activeSelection) applyDim()
  }

  function recentreNetwork() {
    if (!svgSelection || !zoomBehavior || !networkContainer) return
    svgSelection.transition().duration(500).call(
      zoomBehavior.transform,
      d3.zoomIdentity
    )
  }

  function applyDim() {
    if (!nodeSelection || !activeSelection) return

    if (activeSelection.type === 'node') {
      var id      = activeSelection.nodeId
      var conns   = (typeof adj !== 'undefined' && adj[id]) ? adj[id] : []
      var connIds = new Set([id].concat(conns))
      nodeSelection.style('opacity', function(n) { return connIds.has(n.id) ? 1 : 0.08 })
      linkVisSelection.style('opacity', function(l) {
        return (l.source.id === id || l.target.id === id) ? 1 : 0.03
      })
    }

    if (activeSelection.type === 'edge') {
      var src = activeSelection.srcId
      var tgt = activeSelection.tgtId
      nodeSelection.style('opacity', function(n) {
        return (n.id === src || n.id === tgt) ? 1 : 0.08
      })
      linkVisSelection.style('opacity', function(l) {
        return (l.source.id === src && l.target.id === tgt) ? 1 : 0.03
      })
    }

    if (activeSelection.type === 'country' || activeSelection.type === 'decade') {
      var activeGenres = activeSelection.activeGenres || {}
      nodeSelection.style('opacity', function(n) {
        return activeGenres[n.id] ? 1 : 0.08
      })
      linkVisSelection.style('opacity', function(l) {
        return (activeGenres[l.source.id] && activeGenres[l.target.id]) ? 1 : 0.03
      })
    }
  }

  function clearDim() {
    activeSelection = null
    if (!nodeSelection) return
    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
  }

  // ── LEGEND ──
  function initLegend() {
    var clustersEl = document.getElementById('legend-clusters')
    if (!clustersEl) return

    // ancestor included — filtered out previously, now we want it
    var entries = Object.keys(CLUSTER_COLORS)
    clustersEl.innerHTML = ''

    // ── show all / hide all controls ──
    var allHideRow = document.createElement('div')
    allHideRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;'

    var showAllBtn = document.createElement('button')
    showAllBtn.textContent = 'show all'
    showAllBtn.style.cssText = 'flex:1;font-family:\'VT323\',monospace;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:#e2e8f0;padding:2px 0;cursor:pointer;letter-spacing:0.05em;'
    showAllBtn.title = 'show all clusters'

    var hideAllBtn = document.createElement('button')
    hideAllBtn.textContent = 'hide all'
    hideAllBtn.style.cssText = 'flex:1;font-family:\'VT323\',monospace;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:#e2e8f0;padding:2px 0;cursor:pointer;letter-spacing:0.05em;'
    hideAllBtn.title = 'hide all clusters'

    allHideRow.appendChild(showAllBtn)
    allHideRow.appendChild(hideAllBtn)
    clustersEl.appendChild(allHideRow)

    var isDragging      = false
    var dragTargetState = true

    entries.forEach(function(k) {
      var item = document.createElement('div')
      item.className = 'legend-cluster-item'
      item.dataset.cluster = k

      var cb = document.createElement('div')
      cb.className = 'cluster-checkbox checked'
      cb.dataset.cluster = k

      var dot = document.createElement('div')
      dot.className = 'legend-cluster-dot'
      // ancestor gets a diamond shape via CSS trick — use a small rotated square
      if (k === 'ancestor') {
        dot.style.cssText = 'width:8px;height:8px;flex-shrink:0;background:' + CLUSTER_COLORS[k] + ';transform:rotate(45deg);border:1px solid #475569;border-radius:0;'
      } else {
        dot.style.background = CLUSTER_COLORS[k]
      }

      var label = document.createElement('span')
      label.textContent = CLUSTER_LABELS[k] || k

      item.appendChild(cb)
      item.appendChild(dot)
      item.appendChild(label)
      clustersEl.appendChild(item)
    })

    function setCluster(k, checked) {
      var item = clustersEl.querySelector('.legend-cluster-item[data-cluster="' + k + '"]')
      var cb   = item ? item.querySelector('.cluster-checkbox') : null
      if (!cb || !item) return
      if (checked) {
        cb.classList.add('checked')
        item.classList.remove('dimmed')
        hiddenClusters.delete(k)
      } else {
        cb.classList.remove('checked')
        item.classList.add('dimmed')
        hiddenClusters.add(k)
      }
    }

    function toggleCluster(k) {
      var isChecked = !hiddenClusters.has(k)
      setCluster(k, !isChecked)
      applyVisibility()
      return !isChecked
    }

    // solo mode: hide everything except k
    function soloCluster(k) {
      entries.forEach(function(c) { setCluster(c, c === k) })
      applyVisibility()
    }

    showAllBtn.addEventListener('click', function() {
      entries.forEach(function(k) { setCluster(k, true) })
      applyVisibility()
    })

    hideAllBtn.addEventListener('click', function() {
      entries.forEach(function(k) { setCluster(k, false) })
      applyVisibility()
    })

    clustersEl.addEventListener('mousedown', function(e) {
      var item = e.target.closest('.legend-cluster-item')
      if (!item) return
      e.preventDefault()
      var k = item.dataset.cluster

      // alt+click = solo this cluster
      if (e.altKey) {
        // if already soloed (only this one visible), restore all
        var allOthersHidden = entries.filter(function(c) { return c !== k }).every(function(c) { return hiddenClusters.has(c) })
        if (allOthersHidden && !hiddenClusters.has(k)) {
          entries.forEach(function(c) { setCluster(c, true) })
        } else {
          soloCluster(k)
        }
        applyVisibility()
        return
      }

      isDragging = true
      dragTargetState = toggleCluster(k)
    })

    clustersEl.addEventListener('mouseover', function(e) {
      if (!isDragging) return
      var item = e.target.closest('.legend-cluster-item')
      if (!item) return
      var k = item.dataset.cluster
      var isChecked = !hiddenClusters.has(k)
      if (isChecked !== dragTargetState) {
        setCluster(k, dragTargetState)
        applyVisibility()
      }
    })

    document.addEventListener('mouseup', function() { isDragging = false })

    var body      = document.getElementById('network-legend-body')
    var toggleBtn = document.getElementById('legend-toggle')
    if (!body || !toggleBtn) return

    var collapsed = false
    toggleBtn.addEventListener('click', function() {
      collapsed = !collapsed
      body.classList.toggle('hidden', collapsed)
      toggleBtn.textContent = collapsed ? '+' : '−'
    })

    // ── Edge type filter (drag-to-toggle, same mechanic as clusters) ──
    var edgesEl = document.getElementById('legend-edges')
    if (!edgesEl) return

    var edgeTypes = ['origin', 'subgenre', 'influence']
    var edgeDragging      = false
    var edgeDragTarget    = true

    edgesEl.addEventListener('mousedown', function(e) {
      var item = e.target.closest('.legend-edge-item')
      if (!item) return
      e.preventDefault()
      var t = item.dataset.edgeType
      if (!t) return
      edgeDragging = true
      edgeDragTarget = toggleEdgeType(t)
    })

    edgesEl.addEventListener('mouseover', function(e) {
      if (!edgeDragging) return
      var item = e.target.closest('.legend-edge-item')
      if (!item) return
      var t = item.dataset.edgeType
      if (!t) return
      var isChecked = !hiddenEdgeTypes.has(t)
      if (isChecked !== edgeDragTarget) {
        setEdgeType(t, edgeDragTarget)
        applyVisibility()
      }
    })

    document.addEventListener('mouseup', function() { edgeDragging = false })

    function setEdgeType(t, checked) {
      var item = edgesEl.querySelector('[data-edge-type="' + t + '"]')
      if (!item) return
      var cb = item.querySelector('.edge-checkbox')
      if (checked) {
        hiddenEdgeTypes.delete(t)
        if (cb) cb.classList.add('checked')
        item.classList.remove('dimmed')
      } else {
        hiddenEdgeTypes.add(t)
        if (cb) cb.classList.remove('checked')
        item.classList.add('dimmed')
      }
    }

    function toggleEdgeType(t) {
      var isChecked = !hiddenEdgeTypes.has(t)
      setEdgeType(t, !isChecked)
      applyVisibility()
      return !isChecked
    }

    // Add checkboxes to existing edge legend items
    edgeTypes.forEach(function(t) {
      var item = edgesEl.querySelector('[data-edge-type="' + t + '"]')
      if (!item) return
      item.style.cursor = 'pointer'
      item.style.userSelect = 'none'
      var cb = document.createElement('div')
      cb.className = 'edge-checkbox checked'
      item.insertBefore(cb, item.firstChild)
    })
  }

  // ── GENRE SEARCH ──
  function initSearch() {
    var input   = document.getElementById('genre-search-input')
    var results = document.getElementById('genre-search-results')
    if (!input || !results) return

    var debounce = null

    input.addEventListener('input', function() {
      clearTimeout(debounce)
      debounce = setTimeout(function() {
        var q = input.value.trim().toLowerCase()
        if (!q || q.length < 2) {
          results.classList.remove('visible')
          results.innerHTML = ''
          return
        }

        var matches = allNodes.filter(function(n) {
          return n.id.toLowerCase().includes(q) && !n.isAncestor
        }).slice(0, 12)

        if (!matches.length) {
          results.classList.remove('visible')
          return
        }

        results.innerHTML = matches.map(function(n) {
          return '<div class="genre-search-item" data-id="' + n.id + '">' +
            '<div class="gsi-dot" style="background:' + n.color + '"></div>' +
            '<span>' + n.id + '</span>' +
            '<span class="gsi-count">' + (n.song_count > 0 ? n.song_count : '') + '</span>' +
            '</div>'
        }).join('')

        results.classList.add('visible')

        results.querySelectorAll('.genre-search-item').forEach(function(item) {
          item.addEventListener('mousedown', function(e) {
            e.preventDefault()
            var id = item.getAttribute('data-id')
            input.value = id
            results.classList.remove('visible')
            selectGenreInGraph(id)
          })
        })
      }, 150)
    })

    input.addEventListener('blur', function() {
      setTimeout(function() { results.classList.remove('visible') }, 200)
    })

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        results.classList.remove('visible')
        input.blur()
      }
    })
  }

  function selectGenreInGraph(id) {
    if (!nodeSelection) return
    var n = nodeById[id]
    if (!n) return

    nodeSelection.style('opacity', function(d) { return d.id === id ? 1 : 0.1 })
    linkVisSelection.style('opacity', function(l) {
      return (l.source.id === id || l.target.id === id) ? 1 : 0.03
    })

    var svg  = d3.select('#network-svg')
    var W    = document.getElementById('network-container').offsetWidth  || 800
    var H    = document.getElementById('network-container').offsetHeight || 500
    var zoom = d3.zoom().scaleExtent([0.05, 8])
    svg.transition().duration(600).call(
      zoom.transform,
      d3.zoomIdentity.translate(W / 2, H / 2).scale(2).translate(-n.x, -n.y)
    )

    overlayHistory = []
    openOverlay(id)

    setTimeout(function() {
      nodeSelection.style('opacity', null)
      linkVisSelection.style('opacity', null)
    }, 3000)
  }

  // ── OVERLAY ──
  function openOverlay(genreId) {
    var n = nodeById[genreId]
    if (!n) return

    // close edge panel if open
    hideEdgeTooltip()

    var overlay = document.getElementById('genre-overlay')
    var dot     = document.getElementById('genre-overlay-dot')
    var nameEl  = document.getElementById('genre-overlay-name')
    var metaEl  = document.getElementById('genre-overlay-meta')
    var backBtn = document.getElementById('overlay-back-btn')

    dot.style.background = n.color
    nameEl.textContent   = n.id
    metaEl.textContent   = n.cluster + ' · ' + (n.song_count > 0 ? n.song_count + ' songs' : 'root node')
    backBtn.disabled     = overlayHistory.length === 0

    var parents  = adjParents[genreId]  || []
    var children = adjChildren[genreId] || []

    document.getElementById('overlay-parents-title').textContent  = 'comes from (' + parents.length + ')'
    document.getElementById('overlay-children-title').textContent = 'leads to ('   + children.length + ')'

    renderOverlayCards('overlay-parents',  parents)
    renderOverlayCards('overlay-children', children)

    overlay.classList.remove('collapsed')

    activeSelection = { type: 'node', nodeId: genreId }
    applyDim()

    if (typeof window.filterSongs === 'function' && n.song_count > 0) {
      window.filterSongs('genre', n.id)
    }
    updateNetworkStatus(genreId)
  }

  function renderOverlayCards(containerId, connections) {
    var el = document.getElementById(containerId)
    if (!connections.length) {
      el.innerHTML = '<div class="overlay-empty">none</div>'
      return
    }
    el.innerHTML = connections.map(function(c) {
      var n     = nodeById[c.id]
      var color = n ? n.color : '#475569'
      var count = n && n.song_count > 0 ? n.song_count + ' songs' : 'root'
      return '<div class="overlay-card" data-id="' + c.id + '">' +
        '<div class="overlay-card-dot" style="background:' + color + '"></div>' +
        '<span class="overlay-card-name">' + c.id + '</span>' +
        '<span class="overlay-card-count">' + count + '</span>' +
        '<span class="overlay-card-type">' + c.type + '</span>' +
        '</div>'
    }).join('')

    el.querySelectorAll('.overlay-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var currentName = document.getElementById('genre-overlay-name').textContent
        overlayHistory.push(currentName)
        openOverlay(card.getAttribute('data-id'))
      })
    })
  }

  function closeOverlay() {
    document.getElementById('genre-overlay').classList.add('collapsed')
    overlayHistory = []
    var backBtn = document.getElementById('overlay-back-btn')
    if (backBtn) backBtn.disabled = true
    clearDim()
    if (updateNetworkStatus) updateNetworkStatus(null)
    if (typeof window.clearNetworkFilter === 'function') window.clearNetworkFilter()
    // re-apply country dim synchronously after everything else is done
    var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
    if (activeCountry) {
      window.applyNetworkDimByCountry(activeCountry)
      if (typeof window.updateNetworkStatusForCountry === 'function') {
        window.updateNetworkStatusForCountry(activeCountry)
      }
    }
  }

  // ── EDGE TOOLTIP ──
  // For origin/subgenre: small floating label
  // For influence: pinned panel with song list
  var pinnedEdgePanel = null

  function showEdgeTooltip(e, edge, container) {
    hideEdgeTooltip()
    // close node overlay if open
    closeOverlay()

    // set edge selection and dim
    activeSelection = { type: 'edge', srcId: edge.source.id, tgtId: edge.target.id }
    applyDim()

    if (edge.type === 'influence') {
      showInfluencePanel(edge, container)
      return
    }

    var tooltip = document.getElementById('edge-tooltip')
    if (!tooltip) return
    var rect = container.getBoundingClientRect()
    tooltip.innerHTML =
      '<span style="opacity:0.7">' + edge.source.id + '</span>' +
      ' <span style="opacity:0.35">→</span> ' +
      '<span style="opacity:0.7">' + edge.target.id + '</span>' +
      ' <span style="opacity:0.4;margin-left:6px">· ' + edge.type + '</span>'
    tooltip.style.left    = (e.clientX - rect.left + 10) + 'px'
    tooltip.style.top     = (e.clientY - rect.top  - 34) + 'px'
    tooltip.style.opacity = '1'
  }

  function hideEdgeTooltip() {
    var t = document.getElementById('edge-tooltip')
    if (t) t.style.opacity = '0'
    if (pinnedEdgePanel) {
      var p = pinnedEdgePanel
      pinnedEdgePanel = null
      p.style.transform = 'translateY(100%)'
      setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p) }, 300)
    }
    clearDim()
    // re-apply country dim synchronously — no flash
    var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
    if (activeCountry) window.applyNetworkDimByCountry(activeCountry)
  }

  function showInfluencePanel(edge, container) {
    var srcId = edge.source.id
    var tgtId = edge.target.id

    var songs = allTracks.filter(function(t) {
      return (t['Main Genre'] || '').trim().toLowerCase() === srcId.toLowerCase() &&
             (t['Influence Genre'] || '').trim().toLowerCase() === tgtId.toLowerCase()
    })

    var srcNode  = nodeById[srcId]
    var tgtNode  = nodeById[tgtId]
    var srcColor = srcNode ? srcNode.color : '#e2e8f0'
    var tgtColor = tgtNode ? tgtNode.color : '#e2e8f0'

    // If panel already in DOM — update content in place, no animation
    var existing = document.getElementById('influence-panel')
    if (existing) {
      _fillInfluencePanel(existing, srcId, tgtId, srcColor, tgtColor, songs)
      pinnedEdgePanel = existing
      return
    }

    // First open — build panel and animate slide-in from bottom
    var panel = document.createElement('div')
    panel.id = 'influence-panel'
    panel.style.cssText = [
      'position:absolute',
      'bottom:0', 'left:0', 'right:0',
      'background:rgba(7,11,20,0.97)',
      'border-top:2px solid rgba(255,255,255,0.15)',
      'z-index:35',
      'font-family:\'VT323\',monospace',
      'max-height:50%',
      'display:flex',
      'flex-direction:column',
      'transform:translateY(100%)',
      'transition:transform 0.3s ease'
    ].join(';')

    _fillInfluencePanel(panel, srcId, tgtId, srcColor, tgtColor, songs)
    container.appendChild(panel)
    pinnedEdgePanel = panel

    // trigger slide-in on next frame
    requestAnimationFrame(function() {
      panel.style.transform = 'translateY(0)'
    })
  }

  function _fillInfluencePanel(panel, srcId, tgtId, srcColor, tgtColor, songs) {
    panel.innerHTML = ''

    // header
    var header = document.createElement('div')
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;'

    var titleEl = document.createElement('div')
    titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;'
    titleEl.innerHTML =
      '<span style="color:' + srcColor + ';font-size:18px">' + srcId + '</span>' +
      '<span style="opacity:0.35;font-size:14px">influences</span>' +
      '<span style="color:' + tgtColor + ';font-size:18px">' + tgtId + '</span>' +
      '<span style="opacity:0.4;font-size:13px;margin-left:6px">· ' + songs.length + ' ' + (songs.length === 1 ? 'song' : 'songs') + '</span>'

    var closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.2);color:#e2e8f0;font-family:\'VT323\',monospace;font-size:14px;padding:2px 8px;cursor:pointer;'
    closeBtn.addEventListener('click', function() { hideEdgeTooltip() })

    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    // song list
    var body = document.createElement('div')
    body.style.cssText = 'flex:1;overflow-y:auto;padding:6px 14px 10px;'

    if (!songs.length) {
      body.innerHTML = '<div style="opacity:0.3;font-size:14px;padding:8px 0;font-style:italic;">no songs found for this connection</div>'
    } else {
      if (typeof window.filterSongsRaw === 'function') {
        window.filterSongsRaw(srcId + ' · ' + tgtId, songs, 'influence')
      }
      body.innerHTML = songs.map(function(s) {
        var t      = s['Track Name']      || '—'
        var artist = s['Artist Name(s)']  || '—'
        var year   = (s['Release Date']   || '').slice(0, 4) || '—'
        return '<div style="display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<span style="font-size:15px;color:#e2e8f0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + t + '">' + t + '</span>' +
          '<span style="font-size:13px;opacity:0.5;white-space:nowrap;">' + artist + '</span>' +
          '<span style="font-size:12px;opacity:0.35;white-space:nowrap;">' + year + '</span>' +
          '</div>'
      }).join('')
    }

    panel.appendChild(body)
  }

  // ── MAIN ──
  function initNetwork() {
    var statusEl  = document.getElementById('network-status')
    var container = document.getElementById('network-container')

    updateNetworkStatus = function(genreId) {
      if (!statusEl) return
      if (!genreId) {
        // check for decade-only state via app.js
        if (typeof window.getDecadeRange === 'function') {
          var dr = window.getDecadeRange()
          if (dr) {
            // count genre nodes with songs in this decade range
            var activeGenres = typeof window.getActiveGenresForDim === 'function'
              ? window.getActiveGenresForDim() : null
            if (activeGenres) {
              var n = Object.keys(activeGenres).length
              statusEl.textContent = n + ' ' + (n === 1 ? 'genre' : 'genres') + ' with ' + dr + ' songs'
              return
            }
          }
        }
        statusEl.textContent = allNodes.length + ' genres'
        return
      }
      var n = nodeById[genreId]
      if (!n) return
      var conns = (adj[genreId] || []).length
      var base = genreId + ' (' + (n.song_count > 0 ? n.song_count + ' songs' : 'root') + ')'
      var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
      var dr = typeof window.getDecadeRange === 'function' ? window.getDecadeRange() : null
      if (activeCountry) {
        // use decade-aware pool for intersection
        var activeGenres = typeof window.getActiveGenresForDim === 'function'
          ? window.getActiveGenresForDim() : null
        var intersectionCount = activeGenres && activeGenres[genreId]
          ? allTracks.filter(function(s) {
              if (!s['Artist Country']) return false
              var inCountry = s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(activeCountry) !== -1
              var inGenre   = (s['Main Genre'] || '').trim().toLowerCase() === genreId.toLowerCase()
              if (!inCountry || !inGenre) return false
              if (dr) {
                var y = parseInt(s['Release Date'])
                if (isNaN(y)) return false
                // decade range check delegated to pool — just count songs in pool
              }
              return inCountry && inGenre
            }).length
          : 0
        // if decade active, refine intersection through decade pool
        if (dr && activeGenres && activeGenres[genreId]) {
          intersectionCount = (typeof window.getDecadeFilteredTracksForStatus === 'function'
            ? window.getDecadeFilteredTracksForStatus() : allTracks
          ).filter(function(s) {
            if (!s['Artist Country']) return false
            var inCountry = s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(activeCountry) !== -1
            var inGenre   = (s['Main Genre'] || '').trim().toLowerCase() === genreId.toLowerCase()
            return inCountry && inGenre
          }).length
        }
        statusEl.textContent = dr
          ? base + ' · ' + intersectionCount + ' in ' + activeCountry + ' from ' + dr
          : base + ' · ' + intersectionCount + ' in ' + activeCountry
      } else if (dr) {
        // genre + decade only: count songs in this genre within decade range
        var pool = typeof window.getDecadeFilteredTracksForStatus === 'function'
          ? window.getDecadeFilteredTracksForStatus() : allTracks
        var decadeCount = pool.filter(function(s) {
          return (s['Main Genre'] || '').trim().toLowerCase() === genreId.toLowerCase()
        }).length
        statusEl.textContent = base + ' · ' + decadeCount + ' from ' + dr
      } else {
        statusEl.textContent = base
      }
    }

    // called by app.js when map filter changes and no genre is selected
    window.updateNetworkStatusForCountry = function(country) {
      if (!statusEl) return
      var dr = typeof window.getDecadeRange === 'function' ? window.getDecadeRange() : null

      if (!country) {
        if (!activeSelection || activeSelection.type !== 'node') {
          // check decade-only
          if (dr) {
            var activeGenres = typeof window.getActiveGenresForDim === 'function'
              ? window.getActiveGenresForDim() : null
            if (activeGenres) {
              var n = Object.keys(activeGenres).length
              statusEl.textContent = n + ' ' + (n === 1 ? 'genre' : 'genres') + ' with ' + dr + ' songs'
              return
            }
          }
          statusEl.textContent = allNodes.length + ' genres'
        }
        return
      }
      // if a genre node is selected, delegate to updateNetworkStatus
      if (activeSelection && activeSelection.type === 'node') {
        updateNetworkStatus(activeSelection.nodeId)
        return
      }
      // country (+ optional decade): count genre nodes active in this context
      var activeGenres = typeof window.getActiveGenresForDim === 'function'
        ? window.getActiveGenresForDim() : null
      if (!activeGenres) return
      var n = Object.keys(activeGenres).length
      statusEl.textContent = dr
        ? n + ' ' + (n === 1 ? 'genre' : 'genres') + ' in ' + country + ' from ' + dr
        : n + ' ' + (n === 1 ? 'genre' : 'genres') + ' in ' + country
    }
    if (!container) return

    initLegend()
    initSearch()

    var backBtn  = document.getElementById('overlay-back-btn')
    var closeBtn = document.getElementById('overlay-close-btn')
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        if (overlayHistory.length > 0) openOverlay(overlayHistory.pop())
      })
    }
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay)

    Promise.all([
      fetch('data/nodes.csv').then(function(r) { if (!r.ok) throw new Error('nodes.csv not found'); return r.text() }),
      fetch('data/edges.csv').then(function(r) { if (!r.ok) throw new Error('edges.csv not found'); return r.text() }),
      fetch('data/master_playlist_enriched.csv').then(function(r) { if (!r.ok) throw new Error('master csv not found'); return r.text() })
    ]).then(function(files) {

      allNodes  = parseCSV(files[0])
      allEdges  = parseCSV(files[1])
      allTracks = parseCSV(files[2]).filter(function(r) { return r['Track Name'] && r['Track Name'].trim() })

      // live song counts from Main Genre column
      var liveCounts = {}
      allTracks.forEach(function(row) {
        var g = (row['Main Genre'] || row['Genres'] || '').trim()
        if (g) liveCounts[g] = (liveCounts[g] || 0) + 1
      })

      allNodes.forEach(function(n) {
        n.song_count = liveCounts[n.id] || 0
        n.isAncestor = n.cluster === 'ancestor'
        n.color = CLUSTER_COLORS[n.cluster] || '#475569'
        n.r = n.isAncestor ? 5 : Math.max(4, Math.min(22, 4 + Math.sqrt(n.song_count) * 1.8))
        nodeById[n.id] = n
      })

      allEdges.forEach(function(e) {
        if (!adjChildren[e.source]) adjChildren[e.source] = []
        if (!adjParents[e.target])  adjParents[e.target]  = []
        adjChildren[e.source].push({ id: e.target, type: e.type, weight: e.weight })
        adjParents[e.target].push({  id: e.source, type: e.type, weight: e.weight })
      })

      validEdges = allEdges.filter(function(e) {
        return nodeById[e.source] && nodeById[e.target]
      })

      validEdges.forEach(function(e) {
        if (!adj[e.source]) adj[e.source] = []
        if (!adj[e.target]) adj[e.target] = []
        adj[e.source].push(e.target)
        adj[e.target].push(e.source)
      })

      // structural degree = origin + subgenre only (influence does not shape layout)
      var structuralDegree = {}
      validEdges.forEach(function(e) {
        if (e.type === 'influence') return
        structuralDegree[e.source] = (structuralDegree[e.source] || 0) + 1
        structuralDegree[e.target] = (structuralDegree[e.target] || 0) + 1
      })
      allNodes.forEach(function(n) {
        n.structuralDegree = structuralDegree[n.id] || 0
      })

      // for each degree-1 node, record its single structural neighbor
      // so the radial-leaves force can push directly away from it
      var leafNeighborMap = {}
      validEdges.forEach(function(e) {
        if (e.type === 'influence') return
        if (structuralDegree[e.source] === 1) leafNeighborMap[e.source] = e.target
        if (structuralDegree[e.target] === 1) leafNeighborMap[e.target] = e.source
      })
      allNodes.forEach(function(n) {
        n.leafNeighbor = leafNeighborMap[n.id] || null
      })

      var W = container.offsetWidth  || 800
      var H = container.offsetHeight || 500

      var svg  = d3.select('#network-svg')
      var defs = svg.append('defs')
      var filt = defs.append('filter').attr('id', 'net-glow')
      filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
      var merge = filt.append('feMerge')
      merge.append('feMergeNode').attr('in', 'blur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')

      var g = svg.append('g')
      svgSelection     = svg
      networkContainer = container

      var zoom = d3.zoom().scaleExtent([0.05, 8])
        .on('zoom', function(e) { g.attr('transform', e.transform) })
      zoomBehavior = zoom
      svg.call(zoom)
      svg.on('click', function(e) {
        if (e.target === svg.node()) {
          // if a network filter is active, background click does nothing —
          // only the reset button can clear it
          var hasNetworkFilter = typeof window.filterSongs === 'function' &&
            (function() {
              // check app.js state via a dedicated getter
              return typeof window.getNetworkFilterActive === 'function'
                ? window.getNetworkFilterActive()
                : false
            })()
          if (hasNetworkFilter) return
          hideEdgeTooltip()
          closeOverlay()
        }
      })

      // cluster gravity
      var clusters = {}
      allNodes.forEach(function(n) {
        if (!clusters[n.cluster]) clusters[n.cluster] = []
        clusters[n.cluster].push(n)
      })
      var clusterKeys = Object.keys(clusters)
      var clusterCenters = {}
      clusterKeys.forEach(function(k, i) {
        var angle  = (i / clusterKeys.length) * 2 * Math.PI
        var radius = Math.min(W, H) * 0.32
        clusterCenters[k] = {
          x: W / 2 + radius * Math.cos(angle),
          y: H / 2 + radius * Math.sin(angle)
        }
      })

      var sim = d3.forceSimulation(allNodes)
        .alphaDecay(0.02)
        .velocityDecay(0.5)
        .force('link', d3.forceLink(validEdges)
          .id(function(d) { return d.id })
          .distance(function(d) {
            if (d.type === 'origin')    return 80
            if (d.type === 'subgenre')  return 65
            if (d.type === 'influence') return 90
            return 100
          })
          .strength(function(d) {
            if (d.type === 'origin')    return 0.4
            if (d.type === 'subgenre')  return 0.3
            if (d.type === 'influence') return 0.2
            return 0.15
          })
        )
        .force('charge', d3.forceManyBody().strength(function(d) {
          return d.isAncestor ? -80 : -160
        }))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide().radius(function(d) { return d.r + 10 }))
        .force('cluster', function(alpha) {
          allNodes.forEach(function(n) {
            var center = clusterCenters[n.cluster]
            if (!center) return
            var strength = n.isAncestor ? 0.02 : 0.06
            n.vx += (center.x - n.x) * strength * alpha
            n.vy += (center.y - n.y) * strength * alpha
          })
        })
        .force('radial-leaves', function(alpha) {
          allNodes.forEach(function(n) {
            var cx = W / 2
            var cy = H / 2

            if (n.structuralDegree === 0) {
              // no structural edges at all — only influence edges (or nothing) hold them
              // pull strongly toward cluster center so they stay in the right neighbourhood
              var center = clusterCenters[n.cluster]
              if (!center) return
              n.vx += (center.x - n.x) * 0.25 * alpha
              n.vy += (center.y - n.y) * 0.25 * alpha
              // also push away from canvas center so they sit on the outer edge of their cluster
              var dcx = n.x - cx
              var dcy = n.y - cy
              var dc = Math.sqrt(dcx * dcx + dcy * dcy) || 1
              n.vx += (dcx / dc) * 1.5 * alpha
              n.vy += (dcy / dc) * 1.5 * alpha
              return
            }

            if (n.structuralDegree === 1) {
              // one structural edge — push away from canvas center and away from
              // single neighbor so leaf sits on the outside of it
              var neighbor = nodeById[n.leafNeighbor]
              var dcx = n.x - cx
              var dcy = n.y - cy
              var dc = Math.sqrt(dcx * dcx + dcy * dcy) || 1
              n.vx += (dcx / dc) * 2.5 * alpha
              n.vy += (dcy / dc) * 2.5 * alpha
              if (neighbor) {
                var dnx = n.x - neighbor.x
                var dny = n.y - neighbor.y
                var dn = Math.sqrt(dnx * dnx + dny * dny) || 1
                n.vx += (dnx / dn) * 1.5 * alpha
                n.vy += (dny / dn) * 1.5 * alpha
              }
            }
          })
        })

      // ── EDGES ──
      linkHitSelection = g.append('g').selectAll('line')
        .data(validEdges).enter().append('line')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .style('cursor', 'pointer')
        .on('click', function(e, d) { e.stopPropagation(); showEdgeTooltip(e, d, container) })
        .on('mouseover', function(e, d) {
          linkVisSelection.filter(function(l) {
            return l.source.id === d.source.id && l.target.id === d.target.id
          }).attr('stroke', 'rgba(255,255,255,0.8)').attr('stroke-width', 3).attr('stroke-dasharray', null)
        })
        .on('mouseout', function(e, d) {
          linkVisSelection.filter(function(l) {
            return l.source.id === d.source.id && l.target.id === d.target.id
          })
          .attr('stroke',           function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).color })
          .attr('stroke-width',     function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).width })
          .attr('stroke-dasharray', function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).dash  })
          if (activeSelection) applyDim()
        })

      linkVisSelection = g.append('g').selectAll('line')
        .data(validEdges).enter().append('line')
        .attr('stroke',           function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).color })
        .attr('stroke-width',     function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).width })
        .attr('stroke-dasharray', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).dash  })
        .style('pointer-events', 'none')

      var link = linkVisSelection

      // ── NODES ──
      nodeSelection = g.append('g').selectAll('g')
        .data(allNodes).enter().append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', function(e, d) { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  function(e, d) { d.fx = e.x; d.fy = e.y })
          .on('end',   function(e, d) { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
        )

      nodeSelection.each(function(d) {
        var el = d3.select(this)
        if (d.isAncestor) {
          var s = d.r * 1.4
          el.append('polygon')
            .attr('points', '0,' + (-s) + ' ' + s + ',0 0,' + s + ' ' + (-s) + ',0')
            .attr('fill', d.color).attr('stroke', '#475569').attr('stroke-width', 1).attr('opacity', 0.4)
        } else {
          el.append('circle')
            .attr('r', d.r).attr('fill', d.color).attr('fill-opacity', 0.85)
            .attr('stroke', d.color).attr('stroke-width', 0.5)
            .style('filter', d.song_count > 30 ? 'url(#net-glow)' : null)
        }
      })

      nodeSelection.append('text')
        .attr('dy', function(d) { return d.r + 11 })
        .attr('text-anchor', 'middle')
        .attr('font-size', function(d) { return d.song_count > 50 ? '12px' : '10px' })
        .attr('fill', function(d) { return d.isAncestor ? '#475569' : 'rgba(226,232,240,0.75)' })
        .attr('font-family', "'VT323', monospace")
        .text(function(d) { return d.isAncestor ? d.id : (d.song_count > 2 ? d.id : '') })
        .style('pointer-events', 'none')

      var hoverTooltip = document.getElementById('network-tooltip')

      nodeSelection
        .on('mouseover', function(e, d) {
          var conns   = adj[d.id] || []
          var connIds = new Set([d.id].concat(conns))
          if (hoverTooltip) {
            hoverTooltip.style.opacity = '1'
            hoverTooltip.innerHTML =
              '<strong style="color:' + d.color + '">' + d.id + '</strong>' +
              '<div style="opacity:0.5;font-size:11px;margin-top:2px">' + d.cluster + '</div>' +
              (d.song_count > 0
                ? '<div style="margin-top:4px">' + d.song_count + ' songs</div>'
                : '<div style="opacity:0.4;margin-top:4px">root node</div>')
          }
          // hover always shows immediate neighbourhood regardless of selection state
          nodeSelection.style('opacity', function(n) { return connIds.has(n.id) ? 1 : 0.08 })
          link.style('opacity', function(l) { return (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.03 })
        })
        .on('mousemove', function(e) {
          if (!hoverTooltip) return
          var rect = container.getBoundingClientRect()
          hoverTooltip.style.left = (e.clientX - rect.left + 14) + 'px'
          hoverTooltip.style.top  = (e.clientY - rect.top  - 10) + 'px'
        })
        .on('mouseout', function() {
          if (hoverTooltip) hoverTooltip.style.opacity = '0'
          // restore selection dim if active, otherwise clear entirely
          if (activeSelection) {
            applyDim()
          } else {
            nodeSelection.style('opacity', null)
            link.style('opacity', null)
            applyVisibility()
          }
        })
        .on('click', function(e, d) {
          e.stopPropagation()
          hideEdgeTooltip()
          overlayHistory = []
          openOverlay(d.id)
        })

      function positionLine(sel) {
        sel.attr('x1', function(d) { return d.source.x })
           .attr('y1', function(d) { return d.source.y })
           .attr('x2', function(d) { return d.target.x })
           .attr('y2', function(d) { return d.target.y })
      }

      sim.on('tick', function() {
        positionLine(linkHitSelection)
        positionLine(linkVisSelection)
        nodeSelection.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')' })
      })

      if (statusEl) statusEl.textContent = allNodes.length + ' genres'

    }).catch(function(err) {
      console.error('Network error:', err)
      if (statusEl) statusEl.textContent = '⚠ error: ' + err.message
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNetwork)
  } else {
    initNetwork()
  }

  // ── EXTERNAL CROSS-FILTER API ──

  // Called by app.js when a country is clicked on the map.
  // Pass null to release the dim. Dims genre nodes with zero songs from that country.
  window.applyNetworkDimByCountry = function(country) {
    if (!nodeSelection) return

    // if a genre node is already selected, don't touch the network dim
    if (activeSelection && activeSelection.type === 'node') return

    // null = release
    if (!country) {
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }

    var activeGenres = typeof window.getActiveGenresForDim === 'function'
      ? window.getActiveGenresForDim()
      : null

    if (!activeGenres) {
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }

    // store on activeSelection so applyDim() can restore after hover
    activeSelection = { type: 'country', country: country, activeGenres: activeGenres }

    nodeSelection.style('opacity', function(n) {
      return activeGenres[n.id] ? 1 : 0.08
    })
    if (linkVisSelection) {
      linkVisSelection.style('opacity', function(l) {
        return (activeGenres[l.source.id] && activeGenres[l.target.id]) ? 1 : 0.03
      })
    }

    // recenter the network to show active nodes
    recentreNetwork()
  }

  // Called by app.js resetAll to clear any external dim
  window.clearNetworkDim = function() {
    activeSelection = null
    if (nodeSelection)    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  // Called by map bubble click — clears dim but leaves overlay open
  window.clearNetworkDimKeepOverlay = function() {
    activeSelection = null
    if (nodeSelection)    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  // Called by app.js resetAll to close overlays and recenter
  window.resetNetworkView = function() {
    // close genre overlay
    var overlay = document.getElementById('genre-overlay')
    if (overlay) overlay.classList.add('collapsed')
    overlayHistory = []
    var backBtn = document.getElementById('overlay-back-btn')
    if (backBtn) backBtn.disabled = true

    // close influence panel if open
    if (typeof hideEdgeTooltip === 'function') hideEdgeTooltip()

    // reset status text
    if (updateNetworkStatus) updateNetworkStatus(null)

    // recenter zoom
    recentreNetwork()
  }

  // Called when decade range changes — dims genres with no songs in that range
  // Uses getActiveGenresForDim which already respects the decade range
  window.applyNetworkDimByDecade = function() {
    if (!nodeSelection) return

    // if a genre node is already selected, don't overwrite it
    if (activeSelection && activeSelection.type === 'node') return

    var activeGenres = typeof window.getActiveGenresForDim === 'function'
      ? window.getActiveGenresForDim()
      : null

    if (!activeGenres) {
      // no filter active — restore full opacity
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }

    activeSelection = { type: 'decade', activeGenres: activeGenres }

    nodeSelection.style('opacity', function(n) {
      return activeGenres[n.id] ? 1 : 0.08
    })
    if (linkVisSelection) {
      linkVisSelection.style('opacity', function(l) {
        return (activeGenres[l.source.id] && activeGenres[l.target.id]) ? 1 : 0.03
      })
    }
  }

  // Called by navRestore to re-apply a genre node selection dim
  window.applyNetworkDimByGenre = function(genreId) {
    if (!nodeSelection || !genreId) return
    var n = nodeById[genreId]
    if (!n) return
    var conns   = adj[genreId] || []
    var connIds = new Set([genreId].concat(conns))
    activeSelection = { type: 'node', nodeId: genreId }
    nodeSelection.style('opacity', function(d) {
      return connIds.has(d.id) ? 1 : 0.08
    })
    if (linkVisSelection) {
      linkVisSelection.style('opacity', function(l) {
        return (l.source.id === genreId || l.target.id === genreId) ? 1 : 0.03
      })
    }
    if (updateNetworkStatus) updateNetworkStatus(genreId)
  }

  // Exposed so app.js can force a status reset
  window.resetNetworkStatus = function() {
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

})()
