// ============================================
//  network.js — D3 force-directed genre graph
//  features: cluster filter, genre search,
//            node overlay, edge tooltip, legend
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

  var EDGE_STYLES = {
    'origin':    { color: 'rgba(255,255,255,0.5)',  dash: null,  width: 1.5 },
    'subgenre':  { color: 'rgba(255,255,255,0.25)', dash: '5,4', width: 1   },
    'fusion':    { color: 'rgba(255,255,255,0.35)', dash: '2,5', width: 1   },
    'influence': { color: 'rgba(255,255,255,0.35)', dash: '2,5', width: 1   },
  }

  // ── STATE ──
  var nodeById    = {}
  var adjParents  = {}
  var adjChildren = {}
  var overlayHistory = []
  var allNodes    = []
  var allEdges    = []
  var hiddenClusters = new Set()

  // D3 selections — needed for filter updates
  var nodeSelection     = null
  var linkHitSelection  = null
  var linkVisSelection  = null

  function parseCSV(text) {
    var lines = text.trim().split('\n')
    var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/\r/g,'') })
    return lines.slice(1).map(function(line) {
      var vals = line.split(',').map(function(v) { return v.trim().replace(/\r/g,'') })
      var obj = {}
      headers.forEach(function(h,i) { obj[h] = vals[i] || '' })
      return obj
    })
  }

  // ── CLUSTER VISIBILITY ──
  function isNodeVisible(d) {
    return !hiddenClusters.has(d.cluster)
  }

  function isEdgeVisible(e) {
    var srcHidden = hiddenClusters.has(e.source.cluster || (nodeById[e.source] && nodeById[e.source].cluster))
    var tgtHidden = hiddenClusters.has(e.target.cluster || (nodeById[e.target] && nodeById[e.target].cluster))
    return !srcHidden && !tgtHidden
  }

  function isEdgeGhost(e) {
    // one side hidden, one visible = ghost
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
        if (isEdgeVisible(d)) return null
        if (isEdgeGhost(d))   return null
        return 'none'
      })
      .attr('stroke-opacity', function(d) {
        return isEdgeGhost(d) ? '0.08' : null
      })

    linkHitSelection.style('display', function(d) {
      return (isEdgeVisible(d) || isEdgeGhost(d)) ? null : 'none'
    })
  }

  // ── LEGEND with custom checkboxes + drag-to-toggle ──
  function initLegend() {
    var clustersEl = document.getElementById('legend-clusters')
    if (!clustersEl) return

    var entries = Object.keys(CLUSTER_COLORS).filter(function(k) { return k !== 'ancestor' })
    clustersEl.innerHTML = ''

    var isDragging    = false
    var dragTargetState = true  // what state we're setting during drag

    entries.forEach(function(k) {
      var item = document.createElement('div')
      item.className = 'legend-cluster-item'
      item.dataset.cluster = k

      // custom checkbox
      var cb = document.createElement('div')
      cb.className = 'cluster-checkbox checked'
      cb.dataset.cluster = k

      var dot = document.createElement('div')
      dot.className = 'legend-cluster-dot'
      dot.style.background = CLUSTER_COLORS[k]

      var label = document.createElement('span')
      label.textContent = CLUSTER_LABELS[k] || k

      item.appendChild(cb)
      item.appendChild(dot)
      item.appendChild(label)
      clustersEl.appendChild(item)
    })

    function setCluster(k, checked) {
      var cb   = clustersEl.querySelector('[data-cluster="' + k + '"]')
      var item = cb ? cb.closest('.legend-cluster-item') : null
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
      return !isChecked  // return new state
    }

    // mousedown on item = start drag, toggle that cluster
    clustersEl.addEventListener('mousedown', function(e) {
      var item = e.target.closest('.legend-cluster-item')
      if (!item) return
      e.preventDefault()
      var k = item.dataset.cluster
      isDragging = true
      dragTargetState = toggleCluster(k)
    })

    // mouseover during drag = apply same state to hovered clusters
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

    // dim everything else, highlight this node
    nodeSelection.style('opacity', function(d) { return d.id === id ? 1 : 0.1 })
    linkVisSelection.style('opacity', function(l) {
      return (l.source.id === id || l.target.id === id) ? 1 : 0.03
    })

    // zoom to node
    var svg  = d3.select('#network-svg')
    var W    = document.getElementById('network-container').offsetWidth  || 800
    var H    = document.getElementById('network-container').offsetHeight || 500
    var zoom = d3.zoom().scaleExtent([0.05, 8])
    svg.transition().duration(600).call(
      zoom.transform,
      d3.zoomIdentity.translate(W/2, H/2).scale(2).translate(-n.x, -n.y)
    )

    // open overlay
    overlayHistory = []
    openOverlay(id)

    // restore after delay if no further interaction
    setTimeout(function() {
      nodeSelection.style('opacity', null)
      linkVisSelection.style('opacity', null)
    }, 3000)
  }

  // ── OVERLAY ──
  function openOverlay(genreId) {
    var n = nodeById[genreId]
    if (!n) return

    var overlay = document.getElementById('genre-overlay')
    var dot     = document.getElementById('genre-overlay-dot')
    var nameEl  = document.getElementById('genre-overlay-name')
    var metaEl  = document.getElementById('genre-overlay-meta')
    var backBtn = document.getElementById('overlay-back-btn')

    dot.style.background = n.color
    nameEl.textContent = n.id
    metaEl.textContent = n.cluster + ' · ' + (n.song_count > 0 ? n.song_count + ' songs' : 'root node')
    backBtn.disabled = overlayHistory.length === 0

    var parents  = adjParents[genreId]  || []
    var children = adjChildren[genreId] || []

    document.getElementById('overlay-parents-title').textContent  = 'comes from (' + parents.length + ')'
    document.getElementById('overlay-children-title').textContent = 'leads to ('   + children.length + ')'

    renderOverlayCards('overlay-parents',  parents)
    renderOverlayCards('overlay-children', children)

    overlay.classList.remove('collapsed')

    if (typeof window.filterSongs === 'function' && n.song_count > 0) {
      window.filterSongs('genre', n.id)
    }
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
  }

  // ── EDGE TOOLTIP ──
  function showEdgeTooltip(e, edge, container) {
    var tooltip = document.getElementById('edge-tooltip')
    if (!tooltip) return
    var rect = container.getBoundingClientRect()
    tooltip.innerHTML = edge.source.id + ' → ' + edge.target.id +
      ' <span style="opacity:0.5;margin-left:6px">· ' + edge.type + '</span>'
    tooltip.style.left    = (e.clientX - rect.left + 10) + 'px'
    tooltip.style.top     = (e.clientY - rect.top  - 34) + 'px'
    tooltip.style.opacity = '1'
  }

  function hideEdgeTooltip() {
    var t = document.getElementById('edge-tooltip')
    if (t) t.style.opacity = '0'
  }

  // ── MAIN ──
  function initNetwork() {
    var statusEl  = document.getElementById('network-status')
    var container = document.getElementById('network-container')
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

      allNodes = parseCSV(files[0])
      allEdges = parseCSV(files[1])

      // live song counts
      var trackRows = parseCSV(files[2])
      var liveCounts = {}
      trackRows.forEach(function(row) {
        ;(row['Genres'] || '').split(';').forEach(function(g) {
          g = g.trim()
          if (g) liveCounts[g] = (liveCounts[g] || 0) + 1
        })
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

      var validEdges = allEdges.filter(function(e) {
        return nodeById[e.source] && nodeById[e.target]
      })

      var adj = {}
      validEdges.forEach(function(e) {
        if (!adj[e.source]) adj[e.source] = []
        if (!adj[e.target]) adj[e.target] = []
        adj[e.source].push(e.target)
        adj[e.target].push(e.source)
      })

      var W = container.offsetWidth  || 800
      var H = container.offsetHeight || 500

      var svg   = d3.select('#network-svg')
      var defs  = svg.append('defs')
      var filt  = defs.append('filter').attr('id', 'net-glow')
      filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
      var merge = filt.append('feMerge')
      merge.append('feMergeNode').attr('in', 'blur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')

      var g = svg.append('g')

      var zoom = d3.zoom().scaleExtent([0.05, 8])
        .on('zoom', function(e) { g.attr('transform', e.transform) })
      svg.call(zoom)
      svg.on('click', function(e) {
        if (e.target === svg.node()) hideEdgeTooltip()
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
            if (d.type === 'origin')   return 80
            if (d.type === 'subgenre') return 65
            return 120
          })
          .strength(function(d) {
            if (d.type === 'origin')   return 0.4
            if (d.type === 'subgenre') return 0.3
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
          .attr('stroke', function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).color })
          .attr('stroke-width', function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).width })
          .attr('stroke-dasharray', function(l) { return (EDGE_STYLES[l.type] || EDGE_STYLES.influence).dash })
        })

      linkVisSelection = g.append('g').selectAll('line')
        .data(validEdges).enter().append('line')
        .attr('stroke', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).color })
        .attr('stroke-width', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).width })
        .attr('stroke-dasharray', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).dash })
        .style('pointer-events', 'none')

      var link = linkVisSelection

      // ── NODES ──
      nodeSelection = g.append('g').selectAll('g')
        .data(allNodes).enter().append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', function(e, d) { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y })
          .on('drag',  function(e, d) { d.fx=e.x; d.fy=e.y })
          .on('end',   function(e, d) { if (!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null })
        )

      nodeSelection.each(function(d) {
        var el = d3.select(this)
        if (d.isAncestor) {
          var s = d.r * 1.4
          el.append('polygon')
            .attr('points', '0,'+(-s)+' '+s+',0 0,'+s+' '+(-s)+',0')
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
              (d.song_count > 0 ? '<div style="margin-top:4px">' + d.song_count + ' canciones</div>'
                                : '<div style="opacity:0.4;margin-top:4px">nodo raíz</div>')
          }
          nodeSelection.style('opacity', function(n) { return connIds.has(n.id) ? 1 : 0.12 })
          link.style('opacity', function(l) { return (l.source.id===d.id || l.target.id===d.id) ? 1 : 0.04 })
        })
        .on('mousemove', function(e) {
          if (!hoverTooltip) return
          var rect = container.getBoundingClientRect()
          hoverTooltip.style.left = (e.clientX - rect.left + 14) + 'px'
          hoverTooltip.style.top  = (e.clientY - rect.top  - 10) + 'px'
        })
        .on('mouseout', function() {
          if (hoverTooltip) hoverTooltip.style.opacity = '0'
          nodeSelection.style('opacity', null)
          link.style('opacity', null)
          applyVisibility()
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

      if (statusEl) statusEl.textContent = allNodes.length + ' géneros · ' + validEdges.length + ' conexiones'

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

})()
