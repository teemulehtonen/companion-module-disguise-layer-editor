'use strict'
const brandLogo = require('./viewer-logo.json')

// Embedded at bundle time: the packaged module needs no external web runtime.
// All project strings reach the DOM through textContent, never HTML parsing.
function browserMain() {
  const $ = (id) => document.getElementById(id)
  const viewport = $('viewport'),
    sheet = $('sheet')
  let state,
    start = 0,
    span = 60,
    follow = true,
    frame = 0,
    targetStart = 0,
    rendered = '',
    trackUid
  const parameterModes = new Map()
  const expandedLayers = () => [...parameterModes].filter(([,mode]) => mode !== 'none').map(([uid]) => uid).slice(0,16)
  const waveformOpen = new Set(),
    waveformHeights = new Map()
  let lastFullRead = 0,
    lastView = ''
  let displayedTime = null
  let resizingWaveform = false
  document.addEventListener('pointerup', () => {
    resizingWaveform = false
  })
  const el = (tag, cls, text) => {
    const node = document.createElement(tag)
    if (cls) node.className = cls
    if (text !== undefined) node.textContent = text
    return node
  }
  const x = (time) => ((time - start) / span) * 100
  function image(resource, large = false) {
    const box = el('span', 'thumb' + (large ? ' large' : ''), '◇')
    box.title = resource?.name || 'No thumbnail'
    if (resource?.thumbnail) {
      const img = el('img')
      img.loading = 'lazy'
      img.src = '/api/thumbnail/' + encodeURIComponent(resource.uid)
      img.alt = resource.name || 'Resource'
      img.onerror = () => img.remove()
      box.replaceChildren(img)
    }
    return box
  }
  function row(label, cls = '') {
    const root = el('div', 'row ' + cls),
      side = el('div', 'label', label),
      lane = el('div', 'lane')
    root.append(side, lane)
    sheet.append(root)
    return { root, side, lane }
  }
  function selectionButton(layer, label, parameter) {
    const button = el('button', 'select-label', label)
    button.dataset.selectLayer = layer.uid
    button.disabled =
      !state.selectionEnabled || layer.group || state.time < layer.start || state.time >= layer.end
    button.title = button.disabled
      ? 'Selection requires a layer at the playhead and a connected Companion module'
      : 'Select in Companion'
    button.onclick = async () => {
      button.disabled = true
      try {
        const response = await fetch('/api/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
          body: JSON.stringify({
            trackUid: state.trackUid,
            layerUid: layer.uid,
            ...(parameter === undefined ? {} : { parameter }),
          }),
          signal: AbortSignal.timeout(10000),
        })
        const result = await response.json()
        $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Selection unavailable'
        rendered = ''
      } catch {
        $('selectionMessage').textContent = 'Selection unavailable; connection interrupted'
      } finally {
        button.disabled = false
      }
    }
    return button
  }
  function pointClick(node, layer, point, parameter, keyTime) {
    if (!node || layer.group) return
    node.classList.add('timeline-target')
    node.setAttribute('role','button')
    node.tabIndex = 0
    node.setAttribute('aria-label', (point === 'key' ? 'KEYFRAME ' + (parameter || '') : point.toUpperCase()) + ' · ' + layer.name)
    node.onclick = async event => {
      event.stopPropagation()
      try {
        const response = await fetch('/api/select', {method:'POST',
          headers:{'Content-Type':'application/json','X-Viewer-Token':state.selectionToken},
          body:JSON.stringify({trackUid:state.trackUid,layerUid:layer.uid,point,...(parameter === undefined ? {} : {parameter}),...(keyTime === undefined ? {} : {keyTime})}),
          signal:AbortSignal.timeout(10000)})
        const result = await response.json()
        $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Selection unavailable'
        rendered = ''
      } catch { $('selectionMessage').textContent = 'Selection unavailable; connection interrupted' }
    }
    node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click() } }
  }
  function marker(lane, time, text, cls = '') {
    if (time < start || time > start + span) return
    const node = el('span', 'marker ' + cls, text)
    node.style.left = x(time) + '%'
    node.title = text
    lane.append(node)
    return node
  }
  function grid() {
    const ruler = row('LAYERS / ' + state.layers.length, 'ruler')
    const enableSeek = (lane) => {
      if (!state.seekEnabled) return
      lane.style.cursor = 'crosshair'
      lane.title = 'Click to move the Designer playhead'
      lane.onclick = async (event) => {
        if (event.ctrlKey || event.shiftKey || event.altKey) return
        const rect = lane.getBoundingClientRect()
        const time = start + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * span
        try {
          const response = await fetch('/api/seek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
            body: JSON.stringify({ trackUid: state.trackUid, time }),
            signal: AbortSignal.timeout(10000),
          })
          const result = await response.json()
          $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Seek unavailable'
          rendered = ''
        } catch {
          $('selectionMessage').textContent = 'Seek unavailable; connection interrupted'
        }
      }
    }
    enableSeek(ruler.lane)
    for (const tick of state.grid || []) {
      if (tick.time < start || tick.time > start + span) continue
      const line = el('i', 'gridline' + (tick.major ? ' major' : ''))
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(tick.time) / 100 + ')'
      sheet.append(line)
      if (tick.major) marker(ruler.lane, tick.time, tick.label, 'tick')
    }
    // Native TC labels include track TC markers; seconds remain an explicit
    // relative grid until the native beat/TC grid samples arrive.
    const tc = row('TIMECODE', 'annotations')
    enableSeek(tc.lane)
    for (const tick of state.ticks || []) marker(tc.lane, tick.time, tick.label, 'tick')
  }
  function curve(lane, field, layer) {
    if (!field.sequenced || !field.keys?.length) return
    const samples = (field.samples || []).filter((s) => Number.isFinite(s.value))
    if (!samples.length) return
    const values = samples.map((s) => s.value)
    values.push(
      ...(field.keys || [])
        .filter((k) => k.time >= start && k.time <= start + span && Number.isFinite(k.value))
        .map((k) => k.value),
    )
    if (Number.isFinite(field.min) && Number.isFinite(field.max) && field.max > field.min)
      values.push(field.min, field.max)
    let lo = Math.min(...values),
      hi = Math.max(...values)
    if (hi === lo) {
      lo -= 0.5
      hi += 0.5
    }
    const y = (value) => 48 - ((value - lo) / (hi - lo)) * 42
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1000 54')
    svg.setAttribute('preserveAspectRatio', 'none')
    const path = document.createElementNS(svg.namespaceURI, 'path')
    path.setAttribute(
      'd',
      samples.map((s, i) => (i ? 'L' : 'M') + x(s.time) * 10 + ',' + y(s.value)).join(' '),
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(path)
    lane.append(svg)
    if (field.sequenced)
      for (const key of field.keys || []) {
        if (!Number.isFinite(key.value)) continue
        const point = marker(lane, key.time, '', 'curve-key')
        if (!point) continue
        point.style.top = y(key.value) - 4 + 'px'
        point.style.width = '8px'
        point.style.height = '8px'
        point.style.marginLeft = '-4px'
        point.style.background = 'currentColor'
        point.style.border = '1px solid #101517'
        point.style.transform = 'translateX(var(--pan, 0px)) rotate(45deg)'
        point.title = (field.label || field.name) + ' · ' + key.value
        pointClick(point, layer, 'key', field.name, key.time)
      }
  }
  function waveform(wave, label, uid) {
    const r = row(label, 'waveform')
    if (uid) {
      r.root.dataset.waveformUid = uid
      r.root.style.height = (waveformHeights.get(uid) || 64) + 'px'
      r.root.style.resize = 'vertical'
      r.root.style.overflow = 'hidden'
      r.root.style.minHeight = '48px'
      r.root.style.maxHeight = '420px'
      r.root.title = 'Drag the bottom-right corner to resize this waveform'
      r.root.addEventListener('pointerdown', (event) => {
        if (event.clientY > r.root.getBoundingClientRect().bottom - 16) resizingWaveform = true
      })
    }
    // Source preview is explicitly separate until native playback mapping has
    // been verified (loops, offsets and quantized sections are not linear).
    if (wave?.status !== 'ready') {
      r.lane.append(
        el(
          'span',
          'wave-status',
          wave?.status === 'loading' ? 'BUILDING WAVEFORM…' : wave?.reason || 'WAVEFORM UNAVAILABLE',
        ),
      )
      return
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1000 54')
    svg.setAttribute('preserveAspectRatio', 'none')
    const path = document.createElementNS(svg.namespaceURI, 'path')
    const points = []
    const stride = Math.max(1, Math.ceil(wave.peaks.length / 1200))
    for (let i = 0; i < wave.peaks.length; i += stride) {
      const peak = Math.max(...wave.peaks.slice(i, i + stride)) * 23
      const at = (i / wave.peaks.length) * 1000
      points.push('M' + at + ',' + (27 - peak) + 'V' + (27 + peak))
    }
    path.setAttribute('d', points.join(' '))
    path.setAttribute('stroke', '#62acbe')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(path)
    r.lane.append(svg)
    r.side.append(el('small', '', wave.duration.toFixed(1) + ' S'))
  }
  function draw() {
    if (!state || resizingWaveform) return
    const top = viewport.scrollTop
    for (const node of sheet.querySelectorAll('[data-waveform-uid]'))
      waveformHeights.set(node.dataset.waveformUid, node.getBoundingClientRect().height)
    sheet.style.setProperty('--pan', '0px')
    sheet.replaceChildren()
    sheet.dataset.origin = start
    grid()
    for (const guide of state.alignmentGuides || []) {
      if (guide.time < start || guide.time > start + span) continue
      const line = el('i', 'alignment-guide')
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(guide.time) / 100 + ')'
      line.title = guide.labels.join('\n')
      sheet.append(line)
    }
    if (state.quantized) waveform(state.trackWaveform, 'TRACK AUDIO · SOURCE PREVIEW')
    const annotations = state.annotations || {}
    for (const [title, kind] of [
      ['CUES', 'cue'],
      ['TC MARKERS', 'tc'],
      ['NOTES', 'notes'],
    ]) {
      const r = row(title, 'annotations')
      const entries =
        kind === 'notes'
          ? annotations.notes || []
          : (annotations.tags || []).filter((t) => String(t.type).toLowerCase().includes(kind))
      for (const item of entries) marker(r.lane, item.time, String(item.text ?? item.value ?? ''), kind)
    }
    const parents = new Set()
    let ancestor = state.layers.find((l) => l.uid === state.focusUid)
    while (ancestor?.parent && !parents.has(ancestor.parent)) {
      parents.add(ancestor.parent)
      ancestor = state.layers.find((l) => l.uid === ancestor.parent)
    }
    const hidden = new Set()
    for (const layer of state.layers) {
      if (hidden.has(layer.parent)) {
        hidden.add(layer.uid)
        continue
      }
      if (layer.group && !layer.expanded && !parents.has(layer.uid)) hidden.add(layer.uid)
      const focused = layer.uid === state.focusUid
      const r = row('', 'layer' + (focused ? ' focused' : ''))
      r.root.dataset.uid = layer.uid
      r.side.style.paddingLeft = 12 + Math.min(6, layer.depth || 0) * 12 + 'px'
      const mode = parameterModes.get(layer.uid) || (focused ? 'sequenced' : 'none')
      const controls = el('div', 'wave-controls')
      if (!layer.group) {
        for (const [kind, label, glyph] of [['sequenced','SEQUENCED PARAMETERS','◆'],['all','ALL PARAMETERS','≡'],['none','HIDE PARAMETERS','−']]) {
          const button = el('button', 'parameter-mode')
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          icon.setAttribute('viewBox', '0 0 22 20')
          icon.setAttribute('aria-hidden', 'true')
          const path = document.createElementNS(icon.namespaceURI, 'path')
          path.setAttribute('d', kind === 'sequenced' ? 'M11 3l7 7-7 7-7-7z' : kind === 'all' ? 'M4 4h14M4 10h14M4 16h14' : 'M4 10h14')
          icon.append(path)
          button.append(icon)
          button.title = label
          button.setAttribute('aria-label', label + ' for ' + layer.name)
          button.setAttribute('aria-pressed', String(mode === kind))
          button.onclick = () => {
            parameterModes.set(layer.uid, kind)
            rendered = ''
            lastFullRead = 0
            draw()
          }
          controls.append(button)
        }
        r.side.append(controls)
      }
      const audioResource = (layer.resources || []).find((field) => field.current?.audio)?.current
      if (audioResource) {
        const toggle = el(
          'button',
          'wave-toggle',
          '∿',
        )
        toggle.setAttribute('aria-label', 'Waveform for ' + layer.name)
        toggle.setAttribute('aria-pressed', String(waveformOpen.has(layer.uid)))
        toggle.title = waveformOpen.has(layer.uid) ? 'Hide waveform' : 'Show waveform'
        toggle.onclick = () => {
          if (waveformOpen.has(layer.uid)) waveformOpen.delete(layer.uid)
          else waveformOpen.add(layer.uid)
          rendered = ''
          draw()
        }
        const refresh = el('button', 'wave-refresh', '↻')
        refresh.title = 'REFRESH WAVEFORM'
        refresh.setAttribute('aria-label', 'Refresh waveform for ' + layer.name)
        refresh.onclick = async () => {
          refresh.disabled = true
          try {
            const response = await fetch('/api/waveform/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
              body: JSON.stringify({ trackUid: state.trackUid, layerUid: layer.uid }),
              signal: AbortSignal.timeout(10000),
            })
            if (!response.ok) throw new Error('Refresh failed')
            waveformOpen.add(layer.uid)
            layer.waveform = { status: 'loading' }
            lastFullRead = 0
            rendered = ''
            draw()
            $('selectionMessage').textContent = ''
          } catch {
            $('selectionMessage').textContent = 'Waveform refresh unavailable'
          } finally {
            refresh.disabled = false
          }
        }
        for (const [button, shape] of [[toggle, 'M2 10h3l2-6 3 12 3-12 3 12 2-6h2'], [refresh, 'M17 7a7 7 0 1 0 0 6 M17 2v5h-5']]) {
          button.textContent = ''
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          icon.setAttribute('viewBox', '0 0 22 20')
          icon.setAttribute('aria-hidden', 'true')
          const path = document.createElementNS(icon.namespaceURI, 'path')
          path.setAttribute('d', shape)
          icon.append(path)
          button.append(icon)
        }
        controls.append(toggle, refresh)
      }
      const resource = (layer.resources || []).find((f) => f.current?.thumbnail)?.current
      r.side.append(image(resource), selectionButton(layer, layer.name), el('small', '', layer.typeLabel))
      const left = Math.max(start, layer.start),
        right = Math.min(start + span, layer.end)
      if (right >= left) {
        const clip = el('div', 'clip', layer.name)
        clip.style.left = x(left) + '%'
        clip.style.width = Math.max(0, x(right) - x(left)) + '%'
        clip.title = 'IN ' + layer.start + ' S · OUT ' + layer.end + ' S'
        r.lane.append(clip)
        const thumb = image(resource)
        thumb.style.position = 'absolute'
        thumb.style.left = x(left) + '%'
        r.lane.append(thumb)
      }
      for (const [kind, time] of [['in',layer.start],['out',layer.end]]) {
        const edge = marker(r.lane,time,'','layer-edge')
        if (edge) { edge.title = kind.toUpperCase() + ' · ' + layer.name; pointClick(edge,layer,kind) }
      }
      for (const field of [...layer.fields, ...layer.resources])
        if (field.sequenced) {
          for (const key of field.keys) {
            const m = marker(r.lane, key.time, '', 'key key-point')
            if (m) {
              m.title = field.label
              pointClick(m, layer, 'key', field.name, key.time)
            }
          }
        }
      if (waveformOpen.has(layer.uid))
        waveform(layer.waveform || { status: 'loading' }, 'AUDIO · SOURCE PREVIEW', layer.uid)
      if (mode !== 'none')
        for (const field of (layer.allParameters || layer.visibleParameters || []).filter(f => mode === 'all' || (f.sequenced && f.keys?.length))) {
          const p = row(
            field.label || field.name,
            'parameter' + (field.name === state.parameter ? ' selected' : ''),
          )
          p.side.replaceChildren(selectionButton(layer, field.label || field.name, field.name))
          p.side.dataset.parameterValue = field.name
          p.side.dataset.parameterLayer = layer.uid
          const choice = field.choices?.find((c) => c.value === field.value)
          const value = field.unsupported
            ? 'UNAVAILABLE'
            : (field.current?.name ??
              choice?.label ??
              (Number.isFinite(field.value) ? Number(field.value.toFixed(5)).toString() : ''))
          p.side.append(el('small', '', value))
          if ('current' in field) {
            marker(p.lane, layer.start, field.current?.name || 'NONE', 'resource')?.prepend(
              image(field.current, true),
            )
            if (field.sequenced)
              for (const key of field.keys) {
                const item = marker(p.lane, key.time, key.resource?.name || 'NONE', 'resource')
                item?.prepend(image(key.resource,true))
                pointClick(item,layer,'key',field.name,key.time)
              }
          } else curve(p.lane, field, layer)
        }
    }
    const visibleRow = (uid) => {
      const seen = new Set()
      while (uid && !seen.has(uid)) {
        seen.add(uid)
        const node = [...sheet.querySelectorAll('[data-uid]')].find((n) => n.dataset.uid === uid)
        if (node) return node
        uid = state.layers.find((layer) => layer.uid === uid)?.parent
      }
    }
    for (const arrow of state.arrows || []) {
      const source = visibleRow(arrow.source)
      const dest = visibleRow(arrow.destination)
      if (!source || !dest || arrow.time < start || arrow.time > start + span) continue
      if (source === dest) continue
      const line = el('div', 'relation ' + (source.offsetTop < dest.offsetTop ? 'down' : 'up'))
      line.title = 'DESIGNER CONNECTION'
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(arrow.time) / 100 + ')'
      line.style.top = Math.min(source.offsetTop + source.offsetHeight / 2, dest.offsetTop + dest.offsetHeight / 2) + 'px'
      line.style.height = Math.max(1, Math.abs(source.offsetTop + source.offsetHeight / 2 - dest.offsetTop - dest.offsetHeight / 2)) + 'px'
      sheet.append(line)
    }
    const playhead = el('i', 'playhead')
    playhead.id = 'playhead'
    sheet.append(playhead)
    viewport.scrollTop = top
    updatePlayhead()
  }
  function updatePlayhead() {
    if (!state) return
    $('clock').textContent = state.timecode || '—'
    for (const button of sheet.querySelectorAll('[data-select-layer]')) {
      const target = state.layers.find((layer) => layer.uid === button.dataset.selectLayer)
      button.disabled =
        !state.selectionEnabled ||
        !target ||
        target.group ||
        state.time < target.start ||
        state.time >= target.end
    }
    const layer = state.layers.find((layer) => layer.uid === state.focusUid)
    for (const node of sheet.querySelectorAll('[data-parameter-value]')) {
      const owner = state.layers.find(item => item.uid === node.dataset.parameterLayer)
      const field = owner?.fields.find((field) => field.name === node.dataset.parameterValue)
      if (!field) continue
      const value =
        owner?.uid === state.focusUid && field.name === state.parameter && Number.isFinite(state.liveValue) ? state.liveValue : field.value
      const label = node.querySelector('small')
      if (label && Number.isFinite(value))
        label.textContent =
          field.choices?.find((choice) => choice.value === value)?.label ??
          Number(value.toFixed(5)).toString()
    }
    const node = $('playhead')
    if (node) {
      node.style.transition =
        !frame && displayedTime !== null && Math.abs(state.time - displayedTime) < 0.75
          ? 'left 100ms linear'
          : 'none'
      node.style.left = 'calc(240px + (100% - 240px) * ' + x(state.time) / 100 + ')'
      node.hidden = x(state.time) < 0 || x(state.time) > 100
    }
    displayedTime = state.time
  }
  function bounds(value) {
    return Math.max(0, Math.min(Math.max(0, (state?.length || span) - span), value))
  }
  function animate() {
    frame = 0
    const delta = targetStart - start
    if (Math.abs(delta) < span / 2000) {
      start = targetStart
      draw()
      return
    }
    start = bounds(start + delta * 0.16)
    const offset = ((Number(sheet.dataset.origin) - start) / span) * Math.max(1, sheet.clientWidth - 240)
    sheet.style.setProperty('--pan', offset + 'px')
    updatePlayhead()
    frame = requestAnimationFrame(animate)
  }
  function setFollow(value) {
    follow = value
    $('follow').setAttribute('aria-pressed', String(value))
  }
  function zoom(factor) {
    if (!state) return
    cancelAnimationFrame(frame)
    frame = 0
    const centre = start + span / 2
    span = Math.min(state.length || 1, Math.max(2 / (state.fps || 25), span * factor))
    start = bounds(centre - span / 2)
    draw()
    rendered = ''
  }
  $('zoomIn').onclick = () => zoom(0.5)
  $('zoomOut').onclick = () => zoom(2)
  $('fitTrack').onclick = () => {
    if (state) {
      span = state.length || 1
      start = 0
      draw()
      rendered = ''
    }
  }
  $('fitLayer').onclick = () => {
    const layer = state?.layers.find((l) => l.uid === state.focusUid)
    if (layer) {
      span = Math.max(1, layer.end - layer.start)
      start = bounds(layer.start)
      draw()
      rendered = ''
    }
  }
  $('follow').onclick = () => setFollow(!follow)
  viewport.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault()
        zoom(event.deltaY > 0 ? 1.2 : 1 / 1.2)
      } else if (event.shiftKey || Math.abs(event.deltaX) > 0) {
        event.preventDefault()
        setFollow(false)
        cancelAnimationFrame(frame)
        frame = 0
        start = bounds(
          start + ((event.deltaX || event.deltaY) * span) / Math.max(100, viewport.clientWidth - 240),
        )
        draw()
        rendered = ''
      }
    },
    { passive: false },
  )
  new ResizeObserver(() => draw()).observe(viewport)
  // Keep small live reads independent of expensive geometry/thumbnail snapshots.
  let latestLive = null
  async function pollLive() {
    try {
      if (!document.hidden && state) {
        const response = await fetch('/api/live', { signal: AbortSignal.timeout(3000) })
        if (!response.ok) throw new Error('Disconnected')
        const incoming = await response.json()
        latestLive = incoming
        if (incoming.trackUid !== state.trackUid || incoming.focusUid !== state.focusUid || incoming.contentRevision !== state.contentRevision) {
          lastFullRead = 0
          rendered = ''
        }
        if (incoming.trackUid === state.trackUid) {
          const selectionChanged = incoming.focusUid !== state.focusUid || incoming.parameter !== state.parameter
          // Show confirmed selection immediately using cached rows. Native curves
          // arrive independently; no speculative edits are sent to Designer.
          const { contentRevision, ...live } = incoming
          Object.assign(state, live)
          if (selectionChanged && !resizingWaveform) draw()
          else updatePlayhead()
          $('status').textContent = state.connected ? 'LIVE' : 'CONNECTION LOST'
          $('status').className = state.connected ? 'live' : 'error'
        }
      }
    } catch {
      $('status').textContent = 'CONNECTION LOST'
      $('status').className = 'error'
    } finally {
      setTimeout(pollLive, 75)
    }
  }
  async function poll() {
    try {
      if (!document.hidden) {
        const view = JSON.stringify([start, span, viewport.clientWidth, [...waveformOpen], expandedLayers()])
        const full = !state || !rendered || view !== lastView || performance.now() - lastFullRead >= 1500
        if (!full) return
        const response = await fetch(
          full
            ? '/api/state?start=' +
                start +
                '&end=' +
                (start + span) +
                '&width=' +
                Math.max(320, viewport.clientWidth - 240) +
                '&waveforms=' +
                encodeURIComponent([...waveformOpen].join(',')) + '&expanded=' + encodeURIComponent(expandedLayers().join(','))
            : '/api/live',
          { signal: AbortSignal.timeout(8000) },
        )
        if (!response.ok) throw new Error('Disconnected')
        const incoming = await response.json()
        if (full) {
          // A selection can change while a slow snapshot is in flight.
          if (latestLive && (latestLive.trackUid !== incoming.trackUid || latestLive.focusUid !== incoming.focusUid)) {
            lastFullRead = 0
            rendered = ''
            return
          }
          state = incoming
          if (latestLive?.trackUid === state.trackUid && latestLive?.focusUid === state.focusUid) {
            state.time = latestLive.time
            state.timecode = latestLive.timecode
            state.liveValue = latestLive.liveValue
          }
          lastFullRead = performance.now()
          lastView = view
        }
        if (trackUid !== state.trackUid) {
          trackUid = state.trackUid
          start = 0
          span = state.length || 60
        }
        $('track').textContent = String(state.trackName || '').replace(/\.apx$/i, '').toUpperCase()
        $('status').textContent = state.connected ? 'LIVE' : 'CONNECTION LOST'
        $('status').className = state.connected ? 'live' : 'error'
        $('warnings').textContent = (state.warnings || []).join(' · ')
        const signature = JSON.stringify([
          state.renderRevision,
          state.focusUid,
          state.parameter,
          state.alignmentGuides,
        ])
        if (signature !== rendered && !resizingWaveform) {
          rendered = signature
          draw()
        } else updatePlayhead()
        if (follow && (state.time < start + span * 0.06 || state.time > start + span * 0.94)) {
          targetStart = bounds(state.time - span * (state.time < start ? 0.2 : 0.7))
          if (!frame && Math.abs(targetStart - start) > span / 2000) frame = requestAnimationFrame(animate)
        }
      }
    } catch {
      $('status').textContent = 'CONNECTION LOST'
      $('status').className = 'error'
    } finally {
      setTimeout(poll, 100)
    }
  }
  void pollLive()
  void poll()
}

const stylesheet = `
:root{color-scheme:dark;font:12px 'Segoe UI',Arial,sans-serif;background:#101517;color:#eef4f6}*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}header,.toolbar{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid #29363d}header{height:72px;position:relative}#status{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.08em}#status:before{content:'';width:8px;height:8px;border-radius:50%;background:#849aa5}#status.live:before{background:#43e68c;animation:live-pulse 1.4s ease-in-out infinite}#status.error:before{background:#ffc580}@keyframes live-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #43e68c44}50%{opacity:.45;box-shadow:0 0 0 4px #43e68c00}}@media(prefers-reduced-motion:reduce){#status.live:before{animation:none}}h1{font-size:15px;letter-spacing:.08em;margin:0}.brand-logo{position:relative;width:72px;height:41px;overflow:hidden;flex-shrink:0;align-self:center}.brand-logo img{position:absolute;top:-19px;left:-4px;width:80px;height:80px}header small{display:block;color:#849aa5;margin-top:5px;letter-spacing:.15em}.spacer{flex:1}#clock{font:24px Consolas,monospace;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);white-space:nowrap}.live{color:#43e68c}.error{color:#ffc580}.toolbar{padding:10px 22px;flex-wrap:wrap}button{background:#1b272d;border:1px solid #34444d;border-radius:5px;color:#d4e2e8;padding:7px 10px;cursor:pointer}button[aria-pressed=true]{border-color:#0699b2;color:#63d4e7}button:focus-visible{outline:2px solid #43e68c}#viewport{flex:1;overflow:auto;margin:12px 16px;border:1px solid #29363d;border-radius:6px;min-height:0}#sheet{position:relative;min-width:760px;overflow:hidden;min-height:100%}.row{display:grid;grid-template-columns:240px 1fr;position:relative;min-height:54px;border-bottom:1px solid #26343b}.label{background:#151e23;padding:10px 12px;display:flex;gap:9px;align-items:center;z-index:3;border-right:1px solid #29363d;min-width:0;overflow:hidden}.layer{height:44px;min-height:44px}.layer>.label{position:relative;padding-top:4px;padding-bottom:4px}.layer>.lane>.clip{top:7px;height:30px;padding-top:6px;padding-bottom:6px}.layer>.lane>.key-point{top:18px}.layer>.lane>.thumb{top:10px}.label .name{overflow:hidden;text-overflow:ellipsis}.label small{margin-left:auto;color:#729db4;font-size:10px;max-width:85px;overflow:hidden;text-overflow:ellipsis}.lane{position:relative;min-width:0;overflow:hidden}.ruler{min-height:30px}.annotations{min-height:30px;font-size:10px}.focused{background:#10343d}.focused .label{background:#10343d}.parameter .label{padding-left:30px;color:#91afbd}.parameter.selected{color:#43e68c}.parameter.selected .label{color:#43e68c}.parameter .lane{color:#729db4}.selected .lane{color:#43e68c}.lane svg{width:100%;height:54px}.clip{position:absolute;top:8px;height:36px;background:#1d3e49;border:1px solid #2b626f;border-radius:4px;padding:9px 42px;overflow:hidden;white-space:nowrap;color:#a9d8e3}.marker{position:absolute;top:7px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;z-index:2;font-size:10px}.key{color:#72d5e8;top:20px;font-size:10px}.lane>.key-point{width:8px;height:8px;margin-left:-4px;top:23px;background:currentColor;border:1px solid #101517;transform:translateX(var(--pan,0px)) rotate(45deg)}.timeline-target{cursor:pointer}.timeline-target:focus-visible{outline:2px solid #43e68c}.layer-edge{top:7px;width:7px;height:30px;margin-left:-3px;border:1px solid #63d4e7;border-radius:2px;background:#0699b255;z-index:3}.timeline-target:hover{filter:brightness(1.6);color:#63d4e7;box-shadow:0 0 7px #63d4e7;outline:1px solid #63d4e7}.tick{color:#849aa5;font:10px Consolas,monospace}.cue{color:#e1bf77}.notes{color:#acbfc8}.resource{display:flex;align-items:center;gap:5px;top:3px}.thumb{display:inline-flex;width:34px;height:24px;align-items:center;justify-content:center;background:#263b44;border-radius:3px;overflow:hidden;flex-shrink:0;color:#729db4}.thumb.large{width:60px;height:38px}.thumb img{width:100%;height:100%;object-fit:cover}.gridline{position:absolute;top:30px;bottom:0;width:1px;background:#88a9bb0b;pointer-events:none;z-index:1}.gridline.major{background:#88a9bb20}.playhead{position:absolute;top:0;bottom:0;width:1px;background:#43e68c;box-shadow:0 0 5px #43e68c66;z-index:4;pointer-events:none}.lane>*{transform:translateX(var(--pan,0px))}.alignment-guide{position:absolute;top:0;bottom:0;border-left:1px dashed #e7ba63;z-index:3;transform:translateX(var(--pan,0px))}.gridline,.relation{transform:translateX(var(--pan,0px))}.select-label{border:0;padding:0;background:transparent;color:inherit;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select-label:disabled{cursor:default}.select-label:not(:disabled):hover{color:#63d4e7}#selectionMessage{color:#e1bf77;margin-left:12px}.wave-controls{position:absolute;right:4px;top:1px;display:flex;gap:2px;z-index:5}.wave-controls button{width:16px;height:12px;padding:0;background:#151e23;border:1px solid #34444d;border-radius:4px;color:#849aa5;display:grid;place-items:center}.wave-controls svg{width:12px;height:10px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.wave-controls button:hover,.wave-controls button[aria-pressed=true]{color:#63d4e7;border-color:#0699b2}.wave-controls .parameter-mode{font-size:10px;line-height:10px}.wave-controls button:disabled{opacity:.45}.waveform .lane svg{height:100%}.waveform .label{font-size:10px}.wave-status{display:block;padding:14px;color:#849aa5}.relation{position:absolute;width:3px;margin-left:-1px;background:#bd9be0;border-radius:3px;z-index:2;pointer-events:none;box-shadow:0 0 0 1px #10151799}.relation:after{content:"";position:absolute;width:13px;height:10px;left:-5px;background:#d4b8ef;clip-path:polygon(0 0,100% 0,50% 100%)}.relation.down:after{bottom:-1px}.relation.up:after{top:-1px;transform:rotate(180deg)}.relation:before{content:"";position:absolute;left:-2px;width:7px;height:7px;background:#d4b8ef;border-radius:50%}.relation.down:before{top:-2px}.relation.up:before{bottom:-2px}footer{min-height:27px;padding:4px 22px;color:#849aa5;font-size:10px}#warnings{color:#d5b97b;margin-left:12px}
`
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Disguise Layer Editor · Timeline</title><link rel="stylesheet" href="/viewer.css"><script src="/viewer.js" defer></script></head><body><header><span class="brand-logo"><img src="${brandLogo}" alt="VEHKA AV"></span><div><h1>DISGUISE LAYER EDITOR</h1><small>TIMELINE VIEWER</small></div><div class="spacer"></div><span id="clock">—</span><span id="status" role="status">CONNECTING</span></header><div class="toolbar"><strong id="track">TRACK</strong><div class="spacer"></div><button id="fitTrack">FIT TRACK</button><button id="fitLayer">FIT LAYER</button><button id="follow" aria-pressed="true">FOLLOW</button><button id="zoomOut" aria-label="Zoom out">−</button><button id="zoomIn" aria-label="Zoom in">+</button></div><main id="viewport" aria-label="Designer timeline"><div id="sheet"></div></main><footer>CTRL + WHEEL: ZOOM · SHIFT + WHEEL: PAN<span id="selectionMessage" role="status"></span><span id="warnings"></span></footer></body></html>`

module.exports = { page, stylesheet, browserScript: '(' + browserMain.toString() + ')()' }
