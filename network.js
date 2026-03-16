// ============================================
//  network.js — D3 force-directed genre graph
//  isolated module, communicates via
//  window.filterSongs(label, songs)
// ============================================

;(function() {

  const CLUSTER_COLORS = {
    'caribe':                  '#ff6b35',
    'afro-sudamericano':       '#e8c547',
    'andina':                  '#c084fc',
    'cancion':                 '#fb7185',
    'brasileira':              '#34d399',
    'rock-latino':             '#f97316',
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

  const EDGE_STYLES = {
    'origin':    { color: 'rgba(255,255,255,0.5)',  dash: null,  width: 1.5 },
    'subgenre':  { color: 'rgba(255,255,255,0.25)', dash: '5,4', width: 1   },
    'fusion':    { color: 'rgba(255,255,255,0.15)', dash: '2,5', width: 1   },
    'influence': { color: 'rgba(255,255,255,0.12)', dash: '2,5', width: 1   },
  }

  function parseCSV(text) {
    var lines = text.trim().split('\n')
    var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/\r/g, '') })
    return lines.slice(1).map(function(line) {
      var vals = line.split(',').map(function(v) { return v.trim().replace(/\r/g, '') })
      var obj = {}
      headers.forEach(function(h, i) { obj[h] = vals[i] || '' })
      return obj
    })
  }

  function initNetwork() {
    var statusEl = document.getElementById('network-status')
    var container = document.getElementById('network-container')
    if (!container) return

    Promise.all([
      fetch('data/nodes.csv').then(function(r) {
        if (!r.ok) throw new Error('nodes.csv not found')
        return r.text()
      }),
      fetch('data/edges.csv').then(function(r) {
        if (!r.ok) throw new Error('edges.csv not found')
        return r.text()
      })
    ]).then(function(files) {

      var nodes = parseCSV(files[0])
      var edges = parseCSV(files[1])

      // enrich nodes
      nodes.forEach(function(n) {
        n.song_count = +n.song_count || 0
        n.isAncestor = n.cluster === 'ancestor'
        n.color = CLUSTER_COLORS[n.cluster] || '#475569'
        n.r = n.isAncestor ? 5 : Math.max(4, Math.min(22, 4 + Math.sqrt(n.song_count) * 1.8))
      })

      // index nodes
      var nodeById = {}
      nodes.forEach(function(n) { nodeById[n.id] = n })

      // filter valid edges
      var validEdges = edges.filter(function(e) {
        return nodeById[e.source] && nodeById[e.target]
      })

      // build adjacency list
      var adj = {}
      validEdges.forEach(function(e) {
        if (!adj[e.source]) adj[e.source] = []
        if (!adj[e.target]) adj[e.target] = []
        adj[e.source].push(e.target)
        adj[e.target].push(e.source)
      })

      var W = container.offsetWidth || 800
      var H = container.offsetHeight || 500

      // set up SVG
      var svg = d3.select('#network-svg')

      // glow filter
      var defs = svg.append('defs')
      var filter = defs.append('filter').attr('id', 'net-glow')
      filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
      var merge = filter.append('feMerge')
      merge.append('feMergeNode').attr('in', 'blur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')

      var g = svg.append('g')

      // zoom
      var zoom = d3.zoom()
        .scaleExtent([0.05, 8])
        .on('zoom', function(e) { g.attr('transform', e.transform) })
      svg.call(zoom)

      // simulation — reduced alpha for performance
      var sim = d3.forceSimulation(nodes)
        .alphaDecay(0.03)
        .velocityDecay(0.4)
        .force('link', d3.forceLink(validEdges)
          .id(function(d) { return d.id })
          .distance(function(d) {
            if (d.type === 'origin')   return 55
            if (d.type === 'subgenre') return 45
            return 85
          })
          .strength(function(d) {
            if (d.type === 'origin')   return 0.6
            if (d.type === 'subgenre') return 0.5
            return 0.2
          })
        )
        .force('charge', d3.forceManyBody().strength(function(d) {
          return d.isAncestor ? -50 : -90
        }))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide().radius(function(d) { return d.r + 4 }))

      // draw edges
      var link = g.append('g').selectAll('line')
        .data(validEdges).enter().append('line')
        .attr('stroke', function(d) {
          return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).color
        })
        .attr('stroke-width', function(d) {
          return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).width
        })
        .attr('stroke-dasharray', function(d) {
          return (EDGE_STYLES[d.type] || EDGE_STYLES.influence).dash
        })

      // draw nodes
      var node = g.append('g').selectAll('g')
        .data(nodes).enter().append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', function(e, d) {
            if (!e.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', function(e, d) { d.fx = e.x; d.fy = e.y })
          .on('end',  function(e, d) {
            if (!e.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
        )

      // shapes: diamond for ancestors, circle for genres
      node.each(function(d) {
        var el = d3.select(this)
        if (d.isAncestor) {
          var s = d.r * 1.4
          el.append('polygon')
            .attr('points', '0,' + (-s) + ' ' + s + ',0 0,' + s + ' ' + (-s) + ',0')
            .attr('fill', d.color)
            .attr('stroke', '#475569')
            .attr('stroke-width', 1)
            .attr('opacity', 0.4)
        } else {
          el.append('circle')
            .attr('r', d.r)
            .attr('fill', d.color)
            .attr('fill-opacity', 0.85)
            .attr('stroke', d.color)
            .attr('stroke-width', 0.5)
            .style('filter', d.song_count > 30 ? 'url(#net-glow)' : null)
        }
      })

      // labels — only for notable nodes
      node.append('text')
        .attr('dy', function(d) { return d.r + 9 })
        .attr('text-anchor', 'middle')
        .attr('font-size', function(d) { return d.song_count > 50 ? '10px' : '8px' })
        .attr('fill', function(d) {
          return d.isAncestor ? '#475569' : 'rgba(226,232,240,0.75)'
        })
        .attr('font-family', "'VT323', monospace")
        .text(function(d) {
          return d.isAncestor ? d.id : (d.song_count > 2 ? d.id : '')
        })
        .style('pointer-events', 'none')

      // tooltip
      var tooltip = document.getElementById('network-tooltip')

      node
        .on('mouseover', function(e, d) {
          var conns = adj[d.id] || []
          var connIds = new Set([d.id].concat(conns))
          tooltip.style.opacity = '1'
          tooltip.innerHTML =
            '<strong style="color:' + d.color + '">' + d.id + '</strong>' +
            '<div style="opacity:0.5;font-size:11px;margin-top:2px">' + d.cluster + '</div>' +
            (d.song_count > 0
              ? '<div style="margin-top:4px">' + d.song_count + ' canciones</div>'
              : '<div style="opacity:0.4;margin-top:4px">nodo raíz</div>')
          node.style('opacity', function(n) { return connIds.has(n.id) ? 1 : 0.12 })
          link.style('opacity', function(l) {
            return (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.04
          })
        })
        .on('mousemove', function(e) {
          var rect = container.getBoundingClientRect()
          tooltip.style.left = (e.clientX - rect.left + 14) + 'px'
          tooltip.style.top  = (e.clientY - rect.top  - 10) + 'px'
        })
        .on('mouseout', function() {
          tooltip.style.opacity = '0'
          node.style('opacity', 1)
          link.style('opacity', 1)
        })
        .on('click', function(e, d) {
          if (d.isAncestor) return
          // communicate with app.js via global callback
          if (typeof window.filterSongs === 'function') {
            window.filterSongs('genre', d.id)
          }
        })

      // tick
      sim.on('tick', function() {
        link
          .attr('x1', function(d) { return d.source.x })
          .attr('y1', function(d) { return d.source.y })
          .attr('x2', function(d) { return d.target.x })
          .attr('y2', function(d) { return d.target.y })
        node.attr('transform', function(d) {
          return 'translate(' + d.x + ',' + d.y + ')'
        })
      })

      if (statusEl) {
        statusEl.textContent = nodes.length + ' géneros · ' + validEdges.length + ' conexiones'
      }

    }).catch(function(err) {
      console.error('Network error:', err)
      if (statusEl) statusEl.textContent = '⚠ error cargando red: ' + err.message
    })
  }

  // init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNetwork)
  } else {
    initNetwork()
  }

})()
