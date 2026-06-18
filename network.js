// ============================================
//  network.js — D3 force-directed genre graph
//  features: collapsed group view, expand on click,
//            cluster filter, genre search,
//            node overlay, edge tooltip,
//            influence edge song list, legend
// ============================================

;(function() {

  var CLUSTER_COLORS = {
    'african':                '#fbbf24',
    'afroamerican':           '#e8c547',
    'latin':                  '#fb7185',
    'caribean':               '#ff6b35',
    'classical-experimental': '#c4b5fd',
    'pop and electronic':     '#22d3ee',
    'folk':                   '#86efac',
    'hip-hop':                '#94a3b8',
    'jazz':                   '#60a5fa',
    'rock':                   '#ef4444',
    'soul-rnb-funk':          '#f472b6',
  }

  var CLUSTER_LABELS = {
    'african':                'african',
    'afroamerican':           'afroamerican',
    'latin':                  'latin',
    'caribean':               'caribeña',
    'classical-experimental': 'classical / experimental',
    'pop and electronic':     'pop & electronic',
    'folk':                   'folk',
    'hip-hop':                'hip hop',
    'jazz':                   'jazz',
    'rock':                   'rock',
    'soul-rnb-funk':          'soul / r&b / funk',
  }

  // origin = solid line, influence = dotted
  // subgenre edges are excluded entirely
  var EDGE_STYLES = {
    'origin':    { color: 'rgba(255,255,255,0.55)', dash: null,  width: 1.5 },
    'influence': { color: 'rgba(255,255,255,0.25)', dash: '2,3', width: 1   },
  }

  // ── STATE ──
  var nodeById       = {}   // all fine-grained nodes
  var adjParents     = {}
  var adjChildren    = {}
  var overlayHistory = []
  var allNodes       = []   // fine-grained nodes from nodes.csv
  var allEdges       = []   // all edges from edges.csv
  var allTracks      = []
  var hiddenClusters  = new Set()
  var hiddenEdgeTypes = new Set()
  var activeSelection = null
  var adj             = {}  // adjacency list for fine-grained nodes

  // ── GROUP STATE ──
  var groupDefs      = {}   // { groupLabel: [childId, ...] }
  var childToGroup   = {}   // { childId: groupLabel }
  var groupNodes     = []   // synthetic group parent nodes for simulation
  var groupNodeById  = {}   // { groupLabel: groupNode }
  var expandedGroup  = null // label of currently expanded group, or null

  // collapsed view datasets (built after data loads)
  var collapsedNodes = []   // groupNodes only
  var collapsedEdges = []   // merged inter-group edges (no subgenre)

  // expanded view datasets for the currently expanded group
  var expandedChildNodes = []
  var expandedChildEdges = []

  // D3 selections
  var nodeSelection    = null
  var linkHitSelection = null
  var linkVisSelection = null
  var zoomBehavior     = null
  var svgSelection     = null
  var gSelection       = null  // the top-level <g> inside svg
  var networkContainer = null
  var updateNetworkStatus = null
  var simCollapsed     = null  // force simulation for collapsed view
  var simExpanded      = null  // force simulation for expanded group

  // ── PARSE CSV ──
  function parseCSV(text) {
    var lines   = text.trim().split('\n')
    var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/\r/g, '').replace(/^"|"$/g, '') })
    return lines.slice(1).map(function(line) {
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
  function getNodeCluster(d) {
    // for group nodes, use their assigned cluster
    return d.cluster
  }

  function isNodeVisible(d) {
    return !hiddenClusters.has(getNodeCluster(d))
  }

  function isEdgeVisible(e) {
    var srcCluster = e.source.cluster
    var tgtCluster = e.target.cluster
    var typeHidden = hiddenEdgeTypes.has(e.type)
    return !hiddenClusters.has(srcCluster) && !hiddenClusters.has(tgtCluster) && !typeHidden
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
    if (activeSelection) applyDim()
  }

  function recentreNetwork() {
    if (!svgSelection || !zoomBehavior) return
    svgSelection.transition().duration(500).call(
      zoomBehavior.transform,
      d3.zoomIdentity
    )
  }

  function applyDim() {
    if (!nodeSelection || !activeSelection) return

    if (activeSelection.type === 'group') {
      // dim everything except the expanded group's nodes
      var groupId = activeSelection.groupId
      nodeSelection.style('opacity', function(n) {
        return (n.id === groupId || n.groupParent === groupId) ? 1 : 0.08
      })
      linkVisSelection.style('opacity', function(l) {
        var srcIn = l.source.id === groupId || l.source.groupParent === groupId
        var tgtIn = l.target.id === groupId || l.target.groupParent === groupId
        return (srcIn || tgtIn) ? 1 : 0.03
      })
      return
    }

    if (activeSelection.type === 'node') {
      var id      = activeSelection.nodeId
      var conns   = adj[id] || []
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
        if (n.isGroupParent) {
          // group node is lit if any child has songs in this filter
          var children = groupDefs[n.id] || []
          return children.some(function(c) { return activeGenres[c] }) ? 1 : 0.08
        }
        return activeGenres[n.id] ? 1 : 0.08
      })
      linkVisSelection.style('opacity', function(l) {
        var srcLit = l.source.isGroupParent
          ? (groupDefs[l.source.id] || []).some(function(c) { return activeGenres[c] })
          : activeGenres[l.source.id]
        var tgtLit = l.target.isGroupParent
          ? (groupDefs[l.target.id] || []).some(function(c) { return activeGenres[c] })
          : activeGenres[l.target.id]
        return (srcLit && tgtLit) ? 1 : 0.03
      })
    }
  }

  function clearDim() {
    activeSelection = null
    if (!nodeSelection) return
    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
  }

  // ── BUILD GROUP DATA ──
  function buildGroupData(groupToCluster) {
    // Build group nodes: one per group entry in groupDefs
    // Cluster comes from groupToCluster map (group_clusters.json)
    groupNodes   = []
    groupNodeById = {}

    Object.keys(groupDefs).forEach(function(label) {
      var children = groupDefs[label]

      // Count songs across children
      var totalSongs = 0
      children.forEach(function(cid) {
        var n = nodeById[cid]
        if (n) totalSongs += n.song_count
      })

      // Cluster comes directly from group_clusters.json
      var cluster = (groupToCluster && groupToCluster[label]) || 'folk'
      var r = Math.max(6, Math.min(36, 6 + Math.sqrt(totalSongs) * 2.2))

      var gn = {
        id:            label,
        song_count:    totalSongs,
        cluster:       cluster,
        isAncestor:    false,
        isGroupParent: true,
        childCount:    children.length,
        color:         CLUSTER_COLORS[cluster] || '#475569',
        r:             r,
        x: 0, y: 0, vx: 0, vy: 0
      }

      groupNodes.push(gn)
      groupNodeById[label] = gn
    })
  }

  function buildCollapsedEdges() {
    // Take all fine-grained edges (excluding subgenre),
    // map each endpoint to its group, deduplicate,
    // keep origin over influence when both exist between same pair
    collapsedEdges = []
    var seen = {}  // key: "srcGroup|||tgtGroup" → best type

    allEdges.forEach(function(e) {
      if (e.type === 'subgenre') return
      var sg = childToGroup[e.source]
      var tg = childToGroup[e.target]
      if (!sg || !tg) return
      if (sg === tg) return  // internal — skip

      var key = sg + '|||' + tg
      var existing = seen[key]
      if (!existing) {
        seen[key] = e.type
      } else if (existing === 'influence' && e.type === 'origin') {
        seen[key] = 'origin'  // origin wins
      }
    })

    Object.keys(seen).forEach(function(key) {
      var parts = key.split('|||')
      var sg = groupNodeById[parts[0]]
      var tg = groupNodeById[parts[1]]
      if (!sg || !tg) return
      collapsedEdges.push({
        source: sg,
        target: tg,
        type:   seen[key],
        weight: 1
      })
    })
  }

  function buildExpandedEdgesForGroup(label) {
    // Returns the fine-grained edges (non-subgenre) between children of this group
    // plus edges from children to other group nodes (for context)
    var children = new Set(groupDefs[label] || [])
    expandedChildEdges = []
    var seen = {}

    allEdges.forEach(function(e) {
      if (e.type === 'subgenre') return
      var srcInGroup = children.has(e.source)
      var tgtInGroup = children.has(e.target)
      // only edges where at least one endpoint is a child of this group
      if (!srcInGroup && !tgtInGroup) return

      var key = e.source + '|||' + e.target
      if (seen[key]) return
      seen[key] = true

      // resolve endpoints: children are real nodes; outsiders are group parent nodes
      var srcNode = srcInGroup ? nodeById[e.source] : groupNodeById[childToGroup[e.source]]
      var tgtNode = tgtInGroup ? nodeById[e.target] : groupNodeById[childToGroup[e.target]]
      if (!srcNode || !tgtNode) return

      expandedChildEdges.push({
        source: srcNode,
        target: tgtNode,
        type:   e.type,
        weight: e.weight
      })
    })
  }

  // ── LEGEND ──
  function initLegend() {
    var clustersEl = document.getElementById('legend-clusters')
    if (!clustersEl) return

    var entries = Object.keys(CLUSTER_COLORS)
    clustersEl.innerHTML = ''

    var allHideRow = document.createElement('div')
    allHideRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;'

    var showAllBtn = document.createElement('button')
    showAllBtn.textContent = 'show all'
    showAllBtn.style.cssText = 'flex:1;font-family:\'VT323\',monospace;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:#e2e8f0;padding:2px 0;cursor:pointer;letter-spacing:0.05em;'

    var hideAllBtn = document.createElement('button')
    hideAllBtn.textContent = 'hide all'
    hideAllBtn.style.cssText = 'flex:1;font-family:\'VT323\',monospace;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:#e2e8f0;padding:2px 0;cursor:pointer;letter-spacing:0.05em;'

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
      if (e.altKey) {
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

    // ── Edge type filter ──
    var edgesEl = document.getElementById('legend-edges')
    if (!edgesEl) return

    var edgeTypes    = ['origin', 'influence']
    var edgeDragging = false
    var edgeDragTarget = true

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

        // Search both group labels AND individual child node IDs
        var matches = []
        var seen = {}

        // Group labels first
        groupNodes.forEach(function(gn) {
          if (gn.id.toLowerCase().includes(q) && !seen[gn.id]) {
            matches.push({ id: gn.id, color: gn.color, song_count: gn.song_count, isGroup: true })
            seen[gn.id] = true
          }
        })

        // Individual children
        allNodes.forEach(function(n) {
          if (n.id.toLowerCase().includes(q) && !n.isAncestor && !seen[n.id]) {
            matches.push({ id: n.id, color: n.color, song_count: n.song_count, isGroup: false })
            seen[n.id] = true
          }
        })

        matches = matches.slice(0, 12)

        if (!matches.length) {
          results.classList.remove('visible')
          return
        }

        results.innerHTML = matches.map(function(n) {
          var suffix = n.isGroup && groupDefs[n.id] && groupDefs[n.id].length > 1 ? ' ⊕' : ''
          return '<div class="genre-search-item" data-id="' + n.id + '" data-is-group="' + n.isGroup + '">' +
            '<div class="gsi-dot" style="background:' + n.color + '"></div>' +
            '<span>' + n.id + suffix + '</span>' +
            '<span class="gsi-count">' + (n.song_count > 0 ? n.song_count : '') + '</span>' +
            '</div>'
        }).join('')

        results.classList.add('visible')

        results.querySelectorAll('.genre-search-item').forEach(function(item) {
          item.addEventListener('mousedown', function(e) {
            e.preventDefault()
            var id = item.getAttribute('data-id')
            var isGroup = item.getAttribute('data-is-group') === 'true'
            input.value = id
            results.classList.remove('visible')
            if (isGroup) {
              selectGroupInGraph(id)
            } else {
              // find the parent group and expand it, then highlight child
              var parentGroup = childToGroup[id]
              if (parentGroup) {
                selectGroupInGraph(parentGroup, id)
              } else {
                selectGroupInGraph(id)
              }
            }
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

  function selectGroupInGraph(groupId, highlightChildId) {
    if (!nodeSelection) return
    var gn = groupNodeById[groupId]
    if (!gn) return

    var svg = d3.select('#network-svg')
    var W   = document.getElementById('network-container').offsetWidth  || 800
    var H   = document.getElementById('network-container').offsetHeight || 500
    svg.transition().duration(600).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(W / 2, H / 2).scale(1.8).translate(-gn.x, -gn.y)
    )

    expandGroup(groupId)

    if (highlightChildId) {
      setTimeout(function() {
        nodeSelection.style('opacity', function(d) {
          return d.id === highlightChildId ? 1 : 0.15
        })
      }, 400)
    }
  }

  // ── OVERLAY (only shown for child nodes in expanded view) ──
  function openOverlay(genreId) {
    var n = nodeById[genreId]
    if (!n) return

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

    // filter to only origin + influence
    parents  = parents.filter(function(c)  { return c.type !== 'subgenre' })
    children = children.filter(function(c) { return c.type !== 'subgenre' })

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
    if (updateNetworkStatus) updateNetworkStatus(genreId)
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
    var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
    if (activeCountry) {
      window.applyNetworkDimByCountry(activeCountry)
      if (typeof window.updateNetworkStatusForCountry === 'function') {
        window.updateNetworkStatusForCountry(activeCountry)
      }
    }
  }

  // ── EDGE TOOLTIP ──
  var pinnedEdgePanel = null

  function showEdgeTooltip(e, edge, container) {
    hideEdgeTooltip()
    closeOverlay()

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

    var existing = document.getElementById('influence-panel')
    if (existing) {
      _fillInfluencePanel(existing, srcId, tgtId, srcColor, tgtColor, songs)
      pinnedEdgePanel = existing
      return
    }

    var panel = document.createElement('div')
    panel.id = 'influence-panel'
    panel.style.cssText = [
      'position:absolute', 'bottom:0', 'left:0', 'right:0',
      'background:rgba(7,11,20,0.97)',
      'border-top:2px solid rgba(255,255,255,0.15)',
      'z-index:35', "font-family:'VT323',monospace",
      'max-height:50%', 'display:flex', 'flex-direction:column',
      'transform:translateY(100%)', 'transition:transform 0.3s ease'
    ].join(';')

    _fillInfluencePanel(panel, srcId, tgtId, srcColor, tgtColor, songs)
    container.appendChild(panel)
    pinnedEdgePanel = panel

    requestAnimationFrame(function() { panel.style.transform = 'translateY(0)' })
  }

  function _fillInfluencePanel(panel, srcId, tgtId, srcColor, tgtColor, songs) {
    panel.innerHTML = ''
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
    closeBtn.style.cssText = "background:transparent;border:1px solid rgba(255,255,255,0.2);color:#e2e8f0;font-family:'VT323',monospace;font-size:14px;padding:2px 8px;cursor:pointer;"
    closeBtn.addEventListener('click', function() { hideEdgeTooltip() })

    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    var body = document.createElement('div')
    body.style.cssText = 'flex:1;overflow-y:auto;padding:6px 14px 10px;'

    if (!songs.length) {
      body.innerHTML = '<div style="opacity:0.3;font-size:14px;padding:8px 0;font-style:italic;">no songs found for this connection</div>'
    } else {
      if (typeof window.filterSongsRaw === 'function') {
        window.filterSongsRaw(srcId + ' · ' + tgtId, songs, 'influence')
      }
      body.innerHTML = songs.map(function(s) {
        var t      = s['Track Name']     || '—'
        var artist = s['Artist Name(s)'] || '—'
        var year   = (s['Release Date']  || '').slice(0, 4) || '—'
        return '<div style="display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<span style="font-size:15px;color:#e2e8f0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + t + '">' + t + '</span>' +
          '<span style="font-size:13px;opacity:0.5;white-space:nowrap;">' + artist + '</span>' +
          '<span style="font-size:12px;opacity:0.35;white-space:nowrap;">' + year + '</span>' +
          '</div>'
      }).join('')
    }
    panel.appendChild(body)
  }

  // ── EXPAND / COLLAPSE GROUP ──
  function expandGroup(label) {
    if (!gSelection) return
    var gn = groupNodeById[label]
    if (!gn) return

    // already expanded — do nothing
    if (expandedGroup === label) return

    // collapse any previously expanded group first
    if (expandedGroup) collapseGroup(true)

    expandedGroup = label
    var children = groupDefs[label] || []
    var isSolo   = children.length <= 1

    if (isSolo) {
      // solo group: just filter songs, no visual expansion
      var childId = children[0] || label
      var cn      = nodeById[childId]
      if (cn && cn.song_count > 0 && typeof window.filterSongs === 'function') {
        window.filterSongs('genre', childId)
      }
      expandedGroup = null
      if (updateNetworkStatus) updateNetworkStatus(null)
      return
    }

    // multi-child: filter songs for all children combined
    if (typeof window.filterSongsGroup === 'function') {
      window.filterSongsGroup(label, children)
    }

    // build child nodes with positions radiating from group parent
    expandedChildNodes = children.map(function(cid, i) {
      var base = nodeById[cid]
      if (!base) return null
      var angle  = (i / children.length) * 2 * Math.PI
      var radius = gn.r * 2.5 + 40
      return Object.assign({}, base, {
        x:  gn.x + radius * Math.cos(angle),
        y:  gn.y + radius * Math.sin(angle),
        vx: 0, vy: 0,
        groupParent: label,
        isChildNode: true
      })
    }).filter(Boolean)

    buildExpandedEdgesForGroup(label)

    // Re-resolve edge endpoints to use expanded child node objects
    var expandedById = {}
    expandedChildNodes.forEach(function(n) { expandedById[n.id] = n })
    expandedChildEdges = expandedChildEdges.map(function(e) {
      var src = expandedById[e.source.id] || e.source
      var tgt = expandedById[e.target.id] || e.target
      return { source: src, target: tgt, type: e.type, weight: e.weight }
    })

    // Dim the group parent node
    nodeSelection.filter(function(d) { return d.id === label })
      .style('opacity', 0.2)
      .select('circle')
      .attr('r', function(d) { return d.r * 0.5 })

    // Add child nodes to the SVG
    var childG = gSelection.append('g').attr('class', 'expanded-children')

    var childSel = childG.selectAll('g')
      .data(expandedChildNodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', function(e, d) { if (simExpanded && !e.active) simExpanded.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  function(e, d) { d.fx = e.x; d.fy = e.y })
        .on('end',   function(e, d) { if (simExpanded && !e.active) simExpanded.alphaTarget(0); d.fx = null; d.fy = null })
      )

    childSel.append('circle')
      .attr('r', 0)  // start at 0 for animation
      .attr('fill',         function(d) { return d.color })
      .attr('fill-opacity', 0.85)
      .attr('stroke',       function(d) { return d.color })
      .attr('stroke-width', 0.5)
      .style('filter', function(d) { return d.song_count > 30 ? 'url(#net-glow)' : null })
      .transition().duration(300)
      .attr('r', function(d) { return d.r })

    childSel.append('text')
      .attr('dy', function(d) { return d.r + 11 })
      .attr('text-anchor', 'middle')
      .attr('font-size', function(d) { return d.song_count > 50 ? '12px' : '10px' })
      .attr('fill', 'rgba(226,232,240,0.75)')
      .attr('font-family', "'VT323', monospace")
      .text(function(d) { return d.song_count > 2 ? d.id : '' })
      .style('pointer-events', 'none')

    var hoverTooltip = document.getElementById('network-tooltip')

    childSel
      .on('mouseover', function(e, d) {
        if (hoverTooltip) {
          hoverTooltip.style.opacity = '1'
          hoverTooltip.innerHTML =
            '<strong style="color:' + d.color + '">' + d.id + '</strong>' +
            '<div style="opacity:0.5;font-size:11px;margin-top:2px">' + d.cluster + '</div>' +
            (d.song_count > 0
              ? '<div style="margin-top:4px">' + d.song_count + ' songs</div>'
              : '<div style="opacity:0.4;margin-top:4px">root node</div>')
        }
      })
      .on('mousemove', function(e) {
        if (!hoverTooltip) return
        var rect = networkContainer.getBoundingClientRect()
        hoverTooltip.style.left = (e.clientX - rect.left + 14) + 'px'
        hoverTooltip.style.top  = (e.clientY - rect.top  - 10) + 'px'
      })
      .on('mouseout', function() {
        if (hoverTooltip) hoverTooltip.style.opacity = '0'
      })
      .on('click', function(e, d) {
        e.stopPropagation()
        hideEdgeTooltip()
        overlayHistory = []
        openOverlay(d.id)

        activeSelection = { type: 'node', nodeId: d.id }
        // dim siblings
        childSel.style('opacity', function(n) { return n.id === d.id ? 1 : 0.3 })
      })

    // Add child edges + parent→child connector lines
    var edgeG = gSelection.insert('g', '.expanded-children').attr('class', 'expanded-edges')

    // Parent→child connector lines (visual only, not in simulation)
    var connectorLines = edgeG.selectAll('line.connector')
      .data(expandedChildNodes)
      .enter().append('line')
      .attr('class', 'connector')
      .attr('stroke', function(d) { return gn.color })
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-dasharray', '4,3')
      .style('pointer-events', 'none')
      .attr('x1', gn.x).attr('y1', gn.y)
      .attr('x2', function(d) { return d.x }).attr('y2', function(d) { return d.y })

    // Inter-child edges (origin/influence)
    edgeG.selectAll('line.child-edge')
      .data(expandedChildEdges)
      .enter().append('line')
      .attr('class', 'child-edge')
      .attr('stroke',           function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).color })
      .attr('stroke-width',     function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).width })
      .attr('stroke-dasharray', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).dash  })
      .style('pointer-events', 'none')
      .attr('x1', function(d) { return d.source.x }).attr('y1', function(d) { return d.source.y })
      .attr('x2', function(d) { return d.target.x }).attr('y2', function(d) { return d.target.y })

    // Run mini simulation for the expanded children
    simExpanded = d3.forceSimulation(expandedChildNodes)
      .alphaDecay(0.03)
      .velocityDecay(0.45)
      .force('link', d3.forceLink(expandedChildEdges)
        .id(function(d) { return d.id })
        .distance(70).strength(0.3)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(gn.x, gn.y))
      .force('collision', d3.forceCollide().radius(function(d) { return d.r + 8 }))
      .on('tick', function() {
        childSel.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')' })
        // update connector lines to follow parent and child positions
        connectorLines
          .attr('x1', gn.x).attr('y1', gn.y)
          .attr('x2', function(d) { return d.x }).attr('y2', function(d) { return d.y })
        edgeG.selectAll('line.child-edge')
          .attr('x1', function(d) { return d.source.x }).attr('y1', function(d) { return d.source.y })
          .attr('x2', function(d) { return d.target.x }).attr('y2', function(d) { return d.target.y })
      })

    activeSelection = { type: 'group', groupId: label }
    // Dim all other collapsed nodes
    nodeSelection.style('opacity', function(d) { return d.id === label ? 0.2 : 0.15 })
    linkVisSelection.style('opacity', 0.03)

    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  function collapseGroup(silent) {
    if (!expandedGroup) return
    var label = expandedGroup
    expandedGroup = null

    // Stop and kill expanded simulation
    if (simExpanded) { simExpanded.stop(); simExpanded = null }

    // Remove expanded DOM elements
    if (gSelection) {
      gSelection.selectAll('.expanded-children').remove()
      gSelection.selectAll('.expanded-edges').remove()
    }

    // Restore group parent node
    nodeSelection.filter(function(d) { return d.id === label })
      .style('opacity', null)
      .select('circle')
      .attr('r', function(d) { return d.r })

    if (!silent) {
      clearDim()
      closeOverlay()
      var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
      if (activeCountry) window.applyNetworkDimByCountry(activeCountry)
      else if (typeof window.applyNetworkDimByDecade === 'function') window.applyNetworkDimByDecade()
    }
  }

  // ── MAIN ──
  function initNetwork() {
    var statusEl  = document.getElementById('network-status')
    var container = document.getElementById('network-container')

    updateNetworkStatus = function(genreId) {
      if (!statusEl) return
      if (!genreId) {
        if (typeof window.getDecadeRange === 'function') {
          var dr = window.getDecadeRange()
          if (dr) {
            var activeGenres = typeof window.getActiveGenresForDim === 'function'
              ? window.getActiveGenresForDim() : null
            if (activeGenres) {
              var n = Object.keys(activeGenres).length
              statusEl.textContent = n + ' ' + (n === 1 ? 'genre' : 'genres') + ' with ' + dr + ' songs'
              return
            }
          }
        }
        statusEl.textContent = groupNodes.length + ' genres'
        return
      }
      var n = nodeById[genreId]
      if (!n) return
      var base = genreId + ' (' + (n.song_count > 0 ? n.song_count + ' songs' : 'root') + ')'
      var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
      var dr = typeof window.getDecadeRange === 'function' ? window.getDecadeRange() : null
      if (activeCountry) {
        var activeGenres = typeof window.getActiveGenresForDim === 'function'
          ? window.getActiveGenresForDim() : null
        var intersectionCount = activeGenres && activeGenres[genreId]
          ? allTracks.filter(function(s) {
              if (!s['Artist Country']) return false
              var inCountry = s['Artist Country'].split('; ').map(function(c){return c.trim()}).indexOf(activeCountry) !== -1
              var inGenre   = (s['Main Genre'] || '').trim().toLowerCase() === genreId.toLowerCase()
              return inCountry && inGenre
            }).length
          : 0
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

    window.updateNetworkStatusForCountry = function(country) {
      if (!statusEl) return
      var dr = typeof window.getDecadeRange === 'function' ? window.getDecadeRange() : null
      if (!country) {
        if (activeSelection && activeSelection.type === 'node') {
          updateNetworkStatus(activeSelection.nodeId)
          return
        }
        if (dr) {
          var activeGenres = typeof window.getActiveGenresForDim === 'function'
            ? window.getActiveGenresForDim() : null
          if (activeGenres) {
            var n = Object.keys(activeGenres).length
            statusEl.textContent = n + ' ' + (n === 1 ? 'genre' : 'genres') + ' with ' + dr + ' songs'
            return
          }
        }
        statusEl.textContent = groupNodes.length + ' genres'
        return
      }
      if (activeSelection && activeSelection.type === 'node') {
        updateNetworkStatus(activeSelection.nodeId)
        return
      }
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
    if (backBtn)  backBtn.addEventListener('click',  function() { if (overlayHistory.length > 0) openOverlay(overlayHistory.pop()) })
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay)

    Promise.all([
      fetch('data/nodes.csv').then(function(r) { if (!r.ok) throw new Error('nodes.csv not found'); return r.text() }),
      fetch('data/edges.csv').then(function(r) { if (!r.ok) throw new Error('edges.csv not found'); return r.text() }),
      fetch('data/master_playlist_enriched.csv').then(function(r) { if (!r.ok) throw new Error('master csv not found'); return r.text() }),
      fetch('data/genre_groups.json').then(function(r) { if (!r.ok) throw new Error('genre_groups.json not found'); return r.json() }),
      fetch('data/group_clusters.json').then(function(r) { if (!r.ok) throw new Error('group_clusters.json not found'); return r.json() })
    ]).then(function(files) {

      allNodes  = parseCSV(files[0])
      allEdges  = parseCSV(files[1])
      allTracks = parseCSV(files[2]).filter(function(r) { return r['Track Name'] && r['Track Name'].trim() })
      groupDefs = files[3]

      // Build group → cluster map from group_clusters.json
      // format: { clusterName: [groupLabel, ...] }
      var groupClusterDefs = files[4]
      var groupToCluster = {}
      Object.keys(groupClusterDefs).forEach(function(clusterName) {
        groupClusterDefs[clusterName].forEach(function(groupLabel) {
          groupToCluster[groupLabel] = clusterName
        })
      })

      // Build reverse map: child → group
      Object.keys(groupDefs).forEach(function(label) {
        groupDefs[label].forEach(function(cid) {
          childToGroup[cid] = label
        })
      })

      // Live song counts
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

      // Build adjacency for fine-grained nodes (origin + influence only)
      allEdges.forEach(function(e) {
        if (e.type === 'subgenre') return
        if (!adjChildren[e.source]) adjChildren[e.source] = []
        if (!adjParents[e.target])  adjParents[e.target]  = []
        adjChildren[e.source].push({ id: e.target, type: e.type, weight: e.weight })
        adjParents[e.target].push({  id: e.source, type: e.type, weight: e.weight })
      })

      // adj for dim lookups
      allEdges.forEach(function(e) {
        if (e.type === 'subgenre') return
        if (!adj[e.source]) adj[e.source] = []
        if (!adj[e.target]) adj[e.target] = []
        adj[e.source].push(e.target)
        adj[e.target].push(e.source)
      })

      // Build group nodes and collapsed edges
      buildGroupData(groupToCluster)
      buildCollapsedEdges()

      collapsedNodes = groupNodes

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
      gSelection       = g
      networkContainer = container

      var zoom = d3.zoom().scaleExtent([0.05, 8])
        .on('zoom', function(e) { g.attr('transform', e.transform) })
      zoomBehavior = zoom
      svg.call(zoom)

      svg.on('click', function(e) {
        if (e.target !== svg.node()) return
        // if a group is expanded, background click collapses it
        if (expandedGroup) {
          collapseGroup(false)
          return
        }
        var hasNetworkFilter = typeof window.getNetworkFilterActive === 'function'
          ? window.getNetworkFilterActive() : false
        if (hasNetworkFilter) return
        hideEdgeTooltip()
        closeOverlay()
      })

      // Cluster gravity centers — spread wider across the canvas
      var clusters = {}
      collapsedNodes.forEach(function(n) {
        if (!clusters[n.cluster]) clusters[n.cluster] = []
        clusters[n.cluster].push(n)
      })
      var clusterKeys    = Object.keys(clusters)
      var clusterCenters = {}
      clusterKeys.forEach(function(k, i) {
        var angle  = (i / clusterKeys.length) * 2 * Math.PI
        var radius = Math.min(W, H) * 0.42   // wider spread
        clusterCenters[k] = {
          x: W / 2 + radius * Math.cos(angle),
          y: H / 2 + radius * Math.sin(angle)
        }
      })

      // Structural degree for collapsed nodes
      var structuralDegree = {}
      collapsedEdges.forEach(function(e) {
        if (e.type === 'influence') return
        var sid = e.source.id || e.source
        var tid = e.target.id || e.target
        structuralDegree[sid] = (structuralDegree[sid] || 0) + 1
        structuralDegree[tid] = (structuralDegree[tid] || 0) + 1
      })
      collapsedNodes.forEach(function(n) { n.structuralDegree = structuralDegree[n.id] || 0 })

      var leafNeighborMap = {}
      collapsedEdges.forEach(function(e) {
        if (e.type === 'influence') return
        var sid = e.source.id || e.source
        var tid = e.target.id || e.target
        if (structuralDegree[sid] === 1) leafNeighborMap[sid] = tid
        if (structuralDegree[tid] === 1) leafNeighborMap[tid] = sid
      })
      collapsedNodes.forEach(function(n) { n.leafNeighbor = leafNeighborMap[n.id] || null })

      simCollapsed = d3.forceSimulation(collapsedNodes)
        .alphaDecay(0.015)          // slower decay = more time to settle
        .velocityDecay(0.4)
        .force('link', d3.forceLink(collapsedEdges)
          .id(function(d) { return d.id })
          .distance(function(d) { return d.type === 'origin' ? 160 : 200 })  // longer links = more air
          .strength(function(d) { return d.type === 'origin' ? 0.2 : 0.08 }) // weaker = clusters can breathe
        )
        .force('charge', d3.forceManyBody().strength(-400))  // stronger repulsion
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide().radius(function(d) { return d.r + 22 }))  // more padding
        .force('cluster', function(alpha) {
          collapsedNodes.forEach(function(n) {
            var center = clusterCenters[n.cluster]
            if (!center) return
            // stronger cluster pull so same-cluster nodes stay together
            n.vx += (center.x - n.x) * 0.15 * alpha
            n.vy += (center.y - n.y) * 0.15 * alpha
          })
        })
        .force('radial-leaves', function(alpha) {
          collapsedNodes.forEach(function(n) {
            var cx = W / 2
            var cy = H / 2
            if (n.structuralDegree === 0) {
              var center = clusterCenters[n.cluster]
              if (!center) return
              n.vx += (center.x - n.x) * 0.35 * alpha
              n.vy += (center.y - n.y) * 0.35 * alpha
              var dcx = n.x - cx
              var dcy = n.y - cy
              var dc  = Math.sqrt(dcx * dcx + dcy * dcy) || 1
              n.vx += (dcx / dc) * 2.0 * alpha
              n.vy += (dcy / dc) * 2.0 * alpha
              return
            }
            if (n.structuralDegree === 1) {
              var neighbor = groupNodeById[n.leafNeighbor]
              var dcx = n.x - cx
              var dcy = n.y - cy
              var dc  = Math.sqrt(dcx * dcx + dcy * dcy) || 1
              n.vx += (dcx / dc) * 3.0 * alpha
              n.vy += (dcy / dc) * 3.0 * alpha
              if (neighbor) {
                var dnx = n.x - neighbor.x
                var dny = n.y - neighbor.y
                var dn  = Math.sqrt(dnx * dnx + dny * dny) || 1
                n.vx += (dnx / dn) * 2.0 * alpha
                n.vy += (dny / dn) * 2.0 * alpha
              }
            }
          })
        })

      // ── EDGES (collapsed view) ──
      linkHitSelection = g.append('g').selectAll('line')
        .data(collapsedEdges).enter().append('line')
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
        .data(collapsedEdges).enter().append('line')
        .attr('stroke',           function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).color })
        .attr('stroke-width',     function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).width })
        .attr('stroke-dasharray', function(d) { return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).dash  })
        .style('pointer-events', 'none')

      // ── NODES (collapsed group nodes) ──
      nodeSelection = g.append('g').selectAll('g')
        .data(collapsedNodes).enter().append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', function(e, d) { if (!e.active) simCollapsed.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  function(e, d) { d.fx = e.x; d.fy = e.y })
          .on('end',   function(e, d) { if (!e.active) simCollapsed.alphaTarget(0); d.fx = null; d.fy = null })
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
            .attr('r', d.r)
            .attr('fill', d.color)
            .attr('fill-opacity', 0.85)
            .attr('stroke', d.color)
            .attr('stroke-width', 0.5)
            .style('filter', d.song_count > 60 ? 'url(#net-glow)' : null)
        }
        // expand indicator ring for multi-child groups
        if (!d.isAncestor && d.childCount > 1) {
          el.append('circle')
            .attr('r', d.r + 3)
            .attr('fill', 'none')
            .attr('stroke', d.color)
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-dasharray', '3,3')
        }
      })

      nodeSelection.append('text')
        .attr('dy', function(d) { return d.r + 11 })
        .attr('text-anchor', 'middle')
        .attr('font-size', function(d) { return d.song_count > 80 ? '13px' : '11px' })
        .attr('fill', function(d) { return d.isAncestor ? '#475569' : 'rgba(226,232,240,0.85)' })
        .attr('font-family', "'VT323', monospace")
        .text(function(d) { return d.isAncestor ? d.id : (d.song_count > 0 || d.childCount > 1 ? d.id : '') })
        .style('pointer-events', 'none')

      var hoverTooltip = document.getElementById('network-tooltip')

      nodeSelection
        .on('mouseover', function(e, d) {
          var children = groupDefs[d.id] || []
          if (hoverTooltip) {
            hoverTooltip.style.opacity = '1'
            hoverTooltip.innerHTML =
              '<strong style="color:' + d.color + '">' + d.id + '</strong>' +
              '<div style="opacity:0.5;font-size:11px;margin-top:2px">' + d.cluster + '</div>' +
              (d.song_count > 0
                ? '<div style="margin-top:4px">' + d.song_count + ' songs' +
                  (children.length > 1 ? ' · ' + children.length + ' subgenres' : '') + '</div>'
                : '<div style="opacity:0.4;margin-top:4px">root node</div>') +
              (children.length > 1 ? '<div style="opacity:0.5;font-size:11px;margin-top:2px">click to expand</div>' : '')
          }
          if (!expandedGroup) {
            var conns = []
            collapsedEdges.forEach(function(ce) {
              if (ce.source.id === d.id) conns.push(ce.target.id)
              if (ce.target.id === d.id) conns.push(ce.source.id)
            })
            var connIds = new Set([d.id].concat(conns))
            nodeSelection.style('opacity', function(n) { return connIds.has(n.id) ? 1 : 0.08 })
            linkVisSelection.style('opacity', function(l) {
              return (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.03
            })
          }
        })
        .on('mousemove', function(e) {
          if (!hoverTooltip) return
          var rect = container.getBoundingClientRect()
          hoverTooltip.style.left = (e.clientX - rect.left + 14) + 'px'
          hoverTooltip.style.top  = (e.clientY - rect.top  - 10) + 'px'
        })
        .on('mouseout', function() {
          if (hoverTooltip) hoverTooltip.style.opacity = '0'
          if (activeSelection) {
            applyDim()
          } else {
            nodeSelection.style('opacity', null)
            if (linkVisSelection) linkVisSelection.style('opacity', null)
            applyVisibility()
          }
        })
        .on('click', function(e, d) {
          e.stopPropagation()
          hideEdgeTooltip()
          overlayHistory = []
          expandGroup(d.id)
        })

      simCollapsed.on('tick', function() {
        linkHitSelection
          .attr('x1', function(d) { return d.source.x }).attr('y1', function(d) { return d.source.y })
          .attr('x2', function(d) { return d.target.x }).attr('y2', function(d) { return d.target.y })
        linkVisSelection
          .attr('x1', function(d) { return d.source.x }).attr('y1', function(d) { return d.source.y })
          .attr('x2', function(d) { return d.target.x }).attr('y2', function(d) { return d.target.y })
        nodeSelection.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')' })
      })

      if (statusEl) statusEl.textContent = collapsedNodes.length + ' genres'

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

  window.applyNetworkDimByCountry = function(country) {
    if (!nodeSelection) return
    if (activeSelection && activeSelection.type === 'node') return
    if (!country) {
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }
    var activeGenres = typeof window.getActiveGenresForDim === 'function'
      ? window.getActiveGenresForDim() : null
    if (!activeGenres) {
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }
    activeSelection = { type: 'country', country: country, activeGenres: activeGenres }
    applyDim()
    recentreNetwork()
  }

  window.clearNetworkDim = function() {
    activeSelection = null
    if (nodeSelection)    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  window.clearNetworkDimKeepOverlay = function() {
    activeSelection = null
    if (nodeSelection)    nodeSelection.style('opacity', null)
    if (linkVisSelection) linkVisSelection.style('opacity', null)
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  window.resetNetworkView = function() {
    collapseGroup(false)
    var overlay = document.getElementById('genre-overlay')
    if (overlay) overlay.classList.add('collapsed')
    overlayHistory = []
    var backBtn = document.getElementById('overlay-back-btn')
    if (backBtn) backBtn.disabled = true
    if (typeof hideEdgeTooltip === 'function') hideEdgeTooltip()
    if (updateNetworkStatus) updateNetworkStatus(null)
    recentreNetwork()
  }

  window.applyNetworkDimByDecade = function() {
    if (!nodeSelection) return
    if (activeSelection && activeSelection.type === 'node') return
    var activeGenres = typeof window.getActiveGenresForDim === 'function'
      ? window.getActiveGenresForDim() : null
    if (!activeGenres) {
      activeSelection = null
      nodeSelection.style('opacity', null)
      if (linkVisSelection) linkVisSelection.style('opacity', null)
      return
    }
    activeSelection = { type: 'decade', activeGenres: activeGenres }
    applyDim()
  }

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

  window.resetNetworkStatus = function() {
    if (updateNetworkStatus) updateNetworkStatus(null)
  }

  // ── GROUP SONG FILTER (called internally, exposed for app.js) ──
  window.filterSongsGroup = function(groupLabel, childIds) {
    if (typeof window.filterSongs !== 'function') return
    // Pass all child IDs as an array — app.js handles multi-genre filter
    window.filterSongsMulti('genre-group', groupLabel, childIds)
  }

})()
