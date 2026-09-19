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
  let trackWaveHeight = 64
  let trackBars = false
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
    box.title = resource?.name || 'NO THUMBNAIL'
    if (resource?.thumbnail) {
      const img = el('img')
      img.loading = 'lazy'
      img.src = '/api/thumbnail/' + encodeURIComponent(resource.uid)
      img.alt = resource.name || 'Resource'
      let retries = 0
      img.onerror = () => {
        if (retries >= 3) { box.replaceChildren(document.createTextNode('◇')); return }
        retries++
        setTimeout(() => {
          if (img.isConnected) img.src = '/api/thumbnail/' + encodeURIComponent(resource.uid) + '?retry=' + retries
        }, retries * 3000)
      }
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
      ? 'SELECTION UNAVAILABLE'
      : 'SELECT IN COMPANION'
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
    const ruler = row('TIME', 'ruler')
    const enableSeek = (lane) => {
      if (!state.seekEnabled) return
      lane.style.cursor = 'crosshair'
      lane.title = 'SEEK TO TIME'
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
    const sections = ruler
    for (const section of state.sections || []) {
      const left = Math.max(start, section.start), right = Math.min(start + span, section.end)
      if (right <= left) continue
      const band = el('span', 'section-band section-' + (section.index % 2))
      band.style.left = x(left) + '%'
      band.style.width = ((right - left) / span * 100) + '%'
      band.title = 'SECTION ' + section.index
      sections.lane.append(band)
    }
  }
  const visibleKeys = (field, layer) => (field.keys || []).filter(key => key.time >= layer.start && key.time < layer.end)
  function curve(lane, field, layer) {
    if (!field.sequenced || !field.keys?.length) return
    const samples = (field.samples || []).filter((s) => Number.isFinite(s.value))
    if (!samples.length) return
    const values = samples.map((s) => s.value)
    values.push(
      ...(field.keys || [])
        .filter((k) => k.time >= layer.start && k.time < layer.end && k.time >= start && k.time <= start + span && Number.isFinite(k.value))
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
      for (const key of visibleKeys(field, layer)) {
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
  function seekTarget(node, time, label) {
    if (!node || !state.seekEnabled) return
        node.classList.add('timeline-target')
        node.setAttribute('role', 'button')
        node.tabIndex = 0
        node.setAttribute('aria-label', label.toUpperCase())
        node.title = label.toUpperCase()
        node.onclick = async event => {
          event.stopPropagation()
          try {
            const response = await fetch('/api/seek', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
              body: JSON.stringify({ trackUid: state.trackUid, time: time }),
              signal: AbortSignal.timeout(10000),
            })
            const result = await response.json()
            $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Seek unavailable'
          } catch {
            $('selectionMessage').textContent = 'Seek unavailable; connection interrupted'
          }
        }
        node.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click() }
        }
  }
  function waveform(wave, label, uid, stickyTop) {
    const owner = uid && state.layers.find(layer => layer.uid === uid)
    const playback = owner?.playback
    const suffix = playback?.endpoint === 'Loop' ? 'LOOPED' : playback?.endpoint?.toUpperCase()
    const r = row(label + (suffix ? ' - ' + suffix : ''), 'waveform')
    if (stickyTop !== undefined) {
      r.root.classList.add('track-waveform')
      r.root.style.top = stickyTop + 'px'
      r.root.style.height = trackWaveHeight + 'px'
      r.side.style.position = 'relative'
      const controls = el('div', 'wave-controls')
      for (const [height, name] of [[64,'SMALL'],[112,'MEDIUM'],[176,'LARGE']]) {
        const button = el('button')
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        icon.setAttribute('viewBox', '0 0 22 20')
        icon.setAttribute('aria-hidden', 'true')
        const path = document.createElementNS(icon.namespaceURI, 'path')
        path.setAttribute('d', height === 64 ? 'M4 10h14' : height === 112 ? 'M4 7h14M4 13h14' : 'M4 4h14M4 10h14M4 16h14')
        icon.append(path)
        button.append(icon)
        button.title = 'WAVEFORM ' + name
        button.setAttribute('aria-label', button.title)
        button.setAttribute('aria-pressed', String(trackWaveHeight === height))
        button.onclick = () => { trackWaveHeight = height; draw() }
        controls.append(button)
      }
      const units = el('button')
      units.title = trackBars ? 'SHOW BEATS' : 'SHOW BARS (4/4)'
      units.setAttribute('aria-label', units.title)
      units.setAttribute('aria-pressed', String(trackBars))
      const unitIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      unitIcon.setAttribute('viewBox', '0 0 22 20')
      unitIcon.setAttribute('aria-hidden', 'true')
      const unitPath = document.createElementNS(unitIcon.namespaceURI, 'path')
      unitPath.setAttribute('d', trackBars ? 'M3 15V5h16v10M7 8v5M11 8v5M15 8v5' : 'M3 12h5l3-7 3 10 2-3h3')
      unitIcon.append(unitPath)
      units.append(unitIcon)
      units.onclick = () => { trackBars = !trackBars; draw() }
      controls.append(units)
      r.side.append(controls)
      for (const tick of state.beatGrid || []) {
        if (trackBars && Math.abs(tick.beat / 4 - Math.round(tick.beat / 4)) > 1e-6) continue
        if (tick.time < start || tick.time > start + span) continue
        const line = el('i', 'wave-beat-line' + (tick.major ? ' major' : ''))
        line.style.left = x(tick.time) + '%'
        r.lane.append(line)
        seekTarget(line, tick.time, 'GO TO BEAT ' + tick.beat)
        if ((tick.major || trackBars) && Number.isFinite(tick.beat)) seekTarget(marker(r.lane, tick.time, trackBars ? String(Math.round(tick.beat / 4)) : String(Number(tick.beat.toFixed(2))), 'tick beat-tick'), tick.time, 'GO TO BEAT ' + tick.beat)
      }
    }
    if (uid) {
      r.root.dataset.waveformUid = uid
      r.root.style.height = (waveformHeights.get(uid) || 64) + 'px'
      r.root.style.resize = 'vertical'
      r.root.style.overflow = 'hidden'
      r.root.style.minHeight = '48px'
      r.root.style.maxHeight = '420px'
      r.root.title = 'DRAG CORNER TO RESIZE'
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
    const audioStart = owner ? owner.start : 0
    // Preserve seconds per sample; the layer bounds clip rather than stretch audio.
    const audioDuration = wave.duration
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) return
    const showWholeSource = ['Loop', 'Ping-pong'].includes(owner?.playback?.endpoint)
    const visibleDuration = owner && !showWholeSource ? Math.max(0, Math.min(audioDuration, owner.end - owner.start)) : audioDuration
    svg.style.clipPath = 'inset(0 ' + ((1 - visibleDuration / audioDuration) * 100) + '% 0 0)'
    svg.style.position = 'absolute'
    svg.style.left = x(audioStart) + '%'
    svg.style.width = (audioDuration / span * 100) + '%'
    svg.style.top = '0'
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

    const annotations = state.annotations || {}
    for (const [title, kind] of [
      ['CUES', 'cue'],
      ['TIMECODE', 'tc'],
      ['MIDI', 'midi'],
      ['NOTES', 'notes'],
    ]) {
      const r = row(title, 'annotations')
      const entries =
        kind === 'notes'
          ? annotations.notes || []
          : (annotations.tags || []).filter((t) => String(t.type).toLowerCase().includes(kind))
      for (const item of entries) {
        const node = marker(r.lane, item.time, String(item.text ?? item.value ?? ''), 'cue-marker ' + kind)
        if (!node || !state.seekEnabled) continue
        seekTarget(node, item.time, 'GO TO ' + title + ' ' + node.textContent)
      }
    }
    let headerTop = 0
    for (const header of sheet.querySelectorAll('.ruler, .annotations')) {
      header.classList.add('timeline-header')
      header.style.top = headerTop + 'px'
      headerTop += header.offsetHeight
      header.querySelector('.lane').append(el('i', 'header-playhead'))
    }
    if (state.trackAudio) waveform(state.trackWaveform, 'TRACK AUDIO', undefined, headerTop)
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
          button.setAttribute('aria-label', label + ' · ' + layer.name)
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
        toggle.setAttribute('aria-label', 'WAVEFORM · ' + layer.name)
        toggle.setAttribute('aria-pressed', String(waveformOpen.has(layer.uid)))
        toggle.title = waveformOpen.has(layer.uid) ? 'HIDE WAVEFORM' : 'SHOW WAVEFORM'
        toggle.onclick = () => {
          if (waveformOpen.has(layer.uid)) waveformOpen.delete(layer.uid)
          else waveformOpen.add(layer.uid)
          rendered = ''
          draw()
        }
        const refresh = el('button', 'wave-refresh', '↻')
        refresh.title = 'REFRESH WAVEFORM'
        refresh.setAttribute('aria-label', 'REFRESH WAVEFORM · ' + layer.name)
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
      const currentResources = (layer.resources || []).map(f => f.current).filter(Boolean)
      const media = currentResources.find(r => Number.isFinite(r.duration))
        || (layer.resources || []).find(f => !['palette', 'mapping', 'output', 'cdl'].includes(f.name.toLowerCase()) && (f.current?.thumbnail || f.current?.audio))?.current
      const resource = media?.thumbnail ? media : currentResources.find(r => r.thumbnail)
      const info = el('small', 'layer-media-info')
      info.style.display = 'flex'
      info.style.flexDirection = 'column'
      info.style.alignItems = 'flex-end'
      info.style.lineHeight = '1.25'
      info.style.maxWidth = '112px'
      info.style.minWidth = '0'
      info.style.flexShrink = '0'
      const fullName = media?.name || layer.typeLabel
      const measure = document.createElement('canvas').getContext('2d')
      measure.font = '10px Segoe UI'
      let displayName = fullName
      if (measure.measureText(fullName.toUpperCase()).width > 110) {
        let prefix = Math.max(3, fullName.length - 12)
        const suffix = fullName.slice(-12)
        do { displayName = fullName.slice(0, prefix--) + '......' + suffix }
        while (prefix >= 3 && measure.measureText(displayName.toUpperCase()).width > 110)
      }
      const mediaName = el('span', '', displayName)
      mediaName.style.maxWidth = '100%'
      mediaName.style.overflow = 'hidden'
      mediaName.style.textOverflow = 'ellipsis'
      mediaName.style.whiteSpace = 'nowrap'
      mediaName.title = media?.name || layer.typeLabel
      info.append(mediaName)
      if (Number.isFinite(media?.duration)) {
        const rate = media.fps || state.fps || 25
        const nominal = Math.round(rate)
        const frames = Math.round(media.duration * rate)
        const seconds = Math.floor(frames / nominal)
        const label = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frames % nominal].map(n => String(n).padStart(2, '0')).join(':')
          + (media.fps ? ' @ ' + Number(media.fps.toFixed(3)) : '')
        const duration = el('span', '', label)
        duration.title = 'SOURCE DURATION' + (media.fps ? ' @ SOURCE FPS' : '')
        info.append(duration)
      }
      r.side.append(image(resource), selectionButton(layer, layer.name), info)
      const left = Math.max(start, layer.start),
        right = Math.min(start + span, layer.end)
      if (right >= left) {
        const clip = selectionButton(layer, layer.name)
        clip.className = 'clip'
        const clipLabel = el('span', 'clip-label', layer.name)
        if (layer.playback?.mode) clipLabel.append(el('span', 'playback-mode', ' ' + layer.playback.mode.toUpperCase()))
        const endpoint = layer.playback?.endpoint
        const shapes = { Pause:'M7 4v12M13 4v12', Loop:'M17 7a7 7 0 1 0 0 6 M17 2v5h-5', 'Ping-pong':'M3 10h14M3 10l4-4M3 10l4 4M17 10l-4-4M17 10l-4 4' }
        if (shapes[endpoint]) {
          const badge = el('span','playback-icon')
          badge.title = 'AT END POINT: ' + endpoint.toUpperCase()
          badge.setAttribute('aria-label',badge.title)
          const icon = document.createElementNS('http://www.w3.org/2000/svg','svg')
          icon.setAttribute('viewBox','0 0 22 20')
          const shape = document.createElementNS(icon.namespaceURI,'path')
          shape.setAttribute('d',shapes[endpoint]); icon.append(shape); badge.append(icon); clipLabel.append(badge)
        }
        clip.replaceChildren(clipLabel)
        clip.setAttribute('aria-label', 'SELECT LAYER · ' + layer.name)
        clip.style.left = x(left) + '%'
        clip.style.width = Math.max(0, x(right) - x(left)) + '%'
        clip.title = 'IN ' + layer.start + ' S · OUT ' + layer.end + ' S'
        r.lane.append(clip)
        const thumb = image(resource)
        thumb.style.position = 'absolute'
        thumb.style.pointerEvents = 'none'
        thumb.style.left = x(left) + '%'
        r.lane.append(thumb)
      }
      for (const [kind, time] of [['in',layer.start],['out',layer.end]]) {
        const edge = marker(r.lane,time,'','layer-edge')
        if (edge) { edge.title = kind.toUpperCase() + ' · ' + layer.name; pointClick(edge,layer,kind) }
      }
      for (const field of [...layer.fields, ...layer.resources])
        if (field.sequenced) {
          for (const key of visibleKeys(field, layer)) {
            const m = marker(r.lane, key.time, '', 'key key-point')
            if (m) {
              m.title = field.label
              pointClick(m, layer, 'key', field.name, key.time)
            }
          }
        }
      if (waveformOpen.has(layer.uid))
        waveform(layer.waveform || { status: 'loading' }, 'AUDIO', layer.uid)
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
              for (const key of visibleKeys(field, layer)) {
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
    for (const target of sheet.querySelectorAll('[title], [aria-label]')) {
      if (target.title) target.title = target.title.toUpperCase()
      if (target.hasAttribute('aria-label')) target.setAttribute('aria-label', target.getAttribute('aria-label').toUpperCase())
    }
    viewport.scrollTop = top
    updatePlayhead()
  }
  function updatePlayhead() {
    if (!state) return
    $('clock').textContent = state.timecode || '—'
    $('beat').textContent = state.quantized && Number.isFinite(state.beat) ? 'BEAT ' + Number(state.beat.toFixed(2)) : ''
    const annotations = state.annotations || {}
    const latest = items => items.filter(item => item.time <= state.time).reduce((a, b) => !a || b.time >= a.time ? b : a, null)
    const details = []
    for (const kind of ['CUE', 'MIDI']) {
      const item = latest((annotations.tags || []).filter(tag => String(tag.type).toUpperCase() === kind))
      if (item) details.push(kind + ' ' + item.value)
    }
    const note = latest(annotations.notes || [])
    if (note?.text) details.push(note.text)
    $('clockDetails').textContent = details.join(' · ')
    $('clockDetails').title = details.join(' · ')
    const section = (state.sections || []).find(item => state.time >= item.start && state.time < item.end)
    // Section OUT is exclusive; playback stops on the last frame inside it.
    const rate = Number.isFinite(state.fps) && state.fps > 0 ? state.fps : 25
    const lastFrame = section ? Math.max(section.start, (Math.ceil(section.end * rate - 1e-7) - 1) / rate) : 0
    const remaining = section ? Math.max(0, lastFrame - state.time - 1e-7) : null
    const whole = remaining === null ? 0 : Math.ceil(remaining)
    const duration = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(n => String(n).padStart(2, '0')).join(':')
    $('sectionRemaining').textContent = section ? duration : ''
    $('sectionRemaining').className = remaining !== null && remaining <= 10 ? 'ending' : ''
    for (const button of sheet.querySelectorAll('[data-select-layer]')) {
      const target = state.layers.find((layer) => layer.uid === button.dataset.selectLayer)
      button.title = 'SELECT IN COMPANION'
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
    // Every segment uses one pixel position and transition for the same paint.
    // Different easing on sticky headers and the body visibly tears the line.
    const fraction = x(state.time) / 100
    const position = fraction * Math.max(0, sheet.clientWidth - 240)
    const transition = !frame && displayedTime !== null && Math.abs(state.time - displayedTime) < 0.75
      ? 'left 100ms linear' : 'none'
    for (const node of sheet.querySelectorAll('.header-playhead, #playhead')) {
      node.style.transition = transition
      node.style.left = (position + (node.id === 'playhead' ? 240 : 0)) + 'px'
      node.hidden = fraction < 0 || fraction > 1
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
      cancelAnimationFrame(frame)
      frame = 0
      setFollow(false)
      const duration = Math.max(2 / (state.fps || 25), layer.end - layer.start)
      span = duration / 0.92
      start = (layer.start + layer.end - span) / 2
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
        if (incoming.trackUid !== state.trackUid || incoming.focusUid !== state.focusUid || incoming.contentRevision !== state.contentRevision || incoming.tempoKey !== state.tempoKey) {
          lastFullRead = 0
          rendered = ''
        }
        if (incoming.trackUid === state.trackUid) {
          const selectionChanged = incoming.focusUid !== state.focusUid || incoming.parameter !== state.parameter
          // Show confirmed selection immediately using cached rows. Native curves
          // arrive independently; no speculative edits are sent to Designer.
          const { contentRevision, tempoKey, ...live } = incoming
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
                Math.max(0, start) +
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
:root{color-scheme:dark;font:12px 'Segoe UI',Arial,sans-serif;background:#101517;color:#eef4f6}*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}header,.toolbar{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid #29363d}header{height:68px;min-height:68px;padding:5px 16px;position:relative}#status{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.08em}#status:before{content:'';width:8px;height:8px;border-radius:50%;background:#849aa5}#status.live:before{background:#43e68c;animation:live-pulse 1.4s ease-in-out infinite}#status.error:before{background:#ffc580}@keyframes live-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #43e68c44}50%{opacity:.45;box-shadow:0 0 0 4px #43e68c00}}@media(prefers-reduced-motion:reduce){#status.live:before{animation:none}}h1{font-size:15px;letter-spacing:.08em;margin:0}.brand-logo{position:relative;width:72px;height:41px;overflow:hidden;flex-shrink:0;align-self:center}.brand-logo img{position:absolute;top:-19px;left:-4px;width:80px;height:80px}header small{display:block;color:#849aa5;margin-top:5px;letter-spacing:.15em}.spacer{flex:1}#clockBlock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;max-width:40%;line-height:1.2}#clock{font:24px Consolas,monospace;white-space:nowrap}#beat{font:12px Consolas,monospace;color:#8bcbd6;margin-left:10px}#clockDetails{font-size:12px;color:#9eb6c2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:15px}#sectionRemaining{font:14px Consolas,monospace;color:#8bcbd6;min-height:17px}#sectionRemaining.ending{color:#ff6268}.live{color:#43e68c}.error{color:#ffc580}.toolbar{padding:4px 16px;gap:7px;flex-wrap:wrap;min-height:32px}.toolbar button{padding:3px 7px;font-size:10px;line-height:16px;border-radius:4px}.toolbar #track{font-size:11px}button{background:#1b272d;border:1px solid #34444d;border-radius:5px;color:#d4e2e8;padding:7px 10px;cursor:pointer}button[aria-pressed=true]{border-color:#0699b2;color:#63d4e7}button:focus-visible{outline:2px solid #43e68c}#viewport{flex:1;overflow:auto;margin:7px 12px;border:1px solid #29363d;border-radius:6px;min-height:0}#sheet{position:relative;min-width:760px;overflow:clip;min-height:100%}.row{display:grid;grid-template-columns:240px 1fr;position:relative;min-height:54px;border-bottom:1px solid #26343b}.label{background:#151e23;padding:10px 12px;display:flex;gap:9px;align-items:center;z-index:3;border-right:1px solid #29363d;min-width:0;overflow:hidden}.layer{height:52px;min-height:52px}.layer>.label{position:relative;padding-top:14px;padding-bottom:4px}.layer>.lane>.clip{top:11px;height:30px;padding-top:6px;padding-bottom:6px}.layer>.lane>.key-point{top:22px}.layer>.lane>.thumb{top:14px}.label .name{overflow:hidden;text-overflow:ellipsis}.label small{margin-left:auto;color:#729db4;font-size:10px;max-width:85px;overflow:hidden;text-overflow:ellipsis}.lane{position:relative;min-width:0;overflow:hidden}.timeline-header{position:sticky;z-index:6;background:#101517;height:30px;min-height:30px}.timeline-header>.label{padding-top:5px;padding-bottom:5px}.header-playhead{position:absolute;top:0;bottom:0;width:1px;background:#43e68c;pointer-events:none;z-index:4;transform:none!important}.section-band{position:absolute;top:0;bottom:0;border-left:1px solid #4b8792;pointer-events:none;background:#16414b}.section-0{background:#293b4d;border-color:#6b8caa}.ruler{min-height:30px}.ruler>.label{font-size:10px}.annotations{min-height:30px;font-size:10px}.focused{background:#10343d}.focused .label{background:#10343d}.parameter .label{padding-left:30px;color:#91afbd}.parameter.selected{color:#43e68c}.parameter.selected .label{color:#43e68c}.parameter .lane{color:#729db4}.selected .lane{color:#43e68c}.lane svg{width:100%;height:54px}.clip{position:absolute;top:8px;height:36px;background:#1d3e49;border:1px solid #2b626f;border-radius:4px;padding:9px 42px;overflow:hidden;white-space:nowrap;color:#a9d8e3}.clip:disabled{cursor:default}.clip:not(:disabled):hover{border-color:#63d4e7;background:#26515e}.clip{min-width:0;padding:0!important;text-align:left}.playback-mode{font-size:10px;color:#8bcbd6;margin-left:5px}.playback-icon{display:inline-flex;vertical-align:middle;margin-left:5px;color:#8bcbd6}.lane .playback-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.clip-label{display:block;padding:6px 42px;white-space:nowrap}.marker{position:absolute;top:7px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;z-index:2;font-size:10px}.key{color:#72d5e8;top:20px;font-size:10px}.lane>.key-point{width:8px;height:8px;margin-left:-4px;top:23px;background:currentColor;border:1px solid #101517;transform:translateX(var(--pan,0px)) rotate(45deg)}.timeline-target{cursor:pointer}.timeline-target:focus-visible{outline:2px solid #43e68c}.layer-edge{top:11px;width:7px;height:30px;margin-left:-3px;border:1px solid #63d4e7;border-radius:2px;background:#0699b255;z-index:3}.timeline-target:hover{filter:brightness(1.6);color:#63d4e7;box-shadow:0 0 7px #63d4e7;outline:1px solid #63d4e7}.tick{color:#849aa5;font:10px Consolas,monospace}.ruler .tick{font-size:12px;color:#bdd0da}.cue-marker{top:3px;overflow:visible;max-width:220px;padding:3px 7px 3px 13px;height:22px;line-height:16px;border:0;border-radius:0;clip-path:polygon(0 50%,9px 0,100% 0,100% 100%,9px 100%);background:#29414e;font-size:10px;white-space:nowrap}.cue-marker:before{content:"";position:absolute;left:0;top:0;width:9px;height:22px;background:currentColor;clip-path:polygon(0 50%,100% 0,100% 100%)}.cue-marker.notes{max-width:260px}.cue-marker.midi{color:#b7a0dc}.cue-marker.tc{color:#74c6d8}.cue{color:#e1bf77}.notes{color:#acbfc8}.resource{display:flex;align-items:center;gap:5px;top:3px}.thumb{display:inline-flex;width:34px;height:24px;align-items:center;justify-content:center;background:#263b44;border-radius:3px;overflow:hidden;flex-shrink:0;color:#729db4}.thumb.large{width:60px;height:38px}.thumb img{width:100%;height:100%;object-fit:cover}.gridline{position:absolute;top:30px;bottom:0;width:1px;background:#88a9bb0b;pointer-events:none;z-index:1}.gridline.major{background:#88a9bb20}.playhead{position:absolute;top:0;bottom:0;width:1px;background:#43e68c;box-shadow:0 0 5px #43e68c66;z-index:4;pointer-events:none}.lane>*{transform:translateX(var(--pan,0px))}.alignment-guide{position:absolute;top:0;bottom:0;border-left:1px dashed #e7ba63;z-index:3;transform:translateX(var(--pan,0px))}.gridline,.relation{transform:translateX(var(--pan,0px))}.select-label{border:0;padding:0;background:transparent;color:inherit;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select-label:disabled{cursor:default}.select-label:not(:disabled):hover{color:#63d4e7}#selectionMessage{color:#e1bf77;margin-left:12px}.wave-controls{position:absolute;right:4px;top:4px;display:flex;gap:2px;z-index:5}.wave-controls button{width:16px;height:12px;padding:0;background:#151e23;border:1px solid #34444d;border-radius:4px;color:#849aa5;display:grid;place-items:center}.wave-controls svg{width:12px;height:10px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.wave-controls button:hover,.wave-controls button[aria-pressed=true]{color:#63d4e7;border-color:#0699b2}.wave-controls .parameter-mode{font-size:10px;line-height:10px}.wave-controls button:disabled{opacity:.45}.wave-beat-line{position:absolute;top:0;bottom:0;width:1px;background:#accdd526;z-index:2;pointer-events:none}.wave-beat-line.timeline-target{pointer-events:auto;cursor:pointer}.wave-beat-line.timeline-target:before{content:"";position:absolute;left:-4px;top:0;bottom:0;width:9px}.wave-beat-line.major{background:#accdd55c}.beat-tick{background:#101517bb;padding:1px 3px;z-index:3}.track-waveform{position:sticky;z-index:6;background:#101517}.waveform .lane svg{height:100%}.waveform .label{font-size:10px}.wave-status{display:block;padding:14px;color:#849aa5}.relation{position:absolute;width:3px;margin-left:-1px;background:#bd9be0;border-radius:3px;z-index:2;pointer-events:none;box-shadow:0 0 0 1px #10151799}.relation:after{content:"";position:absolute;width:13px;height:10px;left:-5px;background:#d4b8ef;clip-path:polygon(0 0,100% 0,50% 100%)}.relation.down:after{bottom:-1px}.relation.up:after{top:-1px;transform:rotate(180deg)}.relation:before{content:"";position:absolute;left:-2px;width:7px;height:7px;background:#d4b8ef;border-radius:50%}.relation.down:before{top:-2px}.relation.up:before{bottom:-2px}footer{min-height:27px;padding:4px 22px;color:#849aa5;font-size:10px}#warnings{color:#d5b97b;margin-left:12px}
`
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Disguise Layer Editor · Timeline</title><link rel="stylesheet" href="/viewer.css"><script src="/viewer.js" defer></script></head><body><header><span class="brand-logo"><img src="${brandLogo}" alt="VEHKA AV"></span><div><h1>DISGUISE LAYER EDITOR</h1><small>TIMELINE VIEWER</small></div><div class="spacer"></div><div id="clockBlock"><span id="clock">—</span><span id="beat"></span><div id="clockDetails"></div><div id="sectionRemaining" aria-live="off"></div></div><span id="status" role="status">CONNECTING</span></header><div class="toolbar"><strong id="track">TRACK</strong><div class="spacer"></div><button id="fitTrack" title="FIT TRACK">FIT TRACK</button><button id="fitLayer" title="CENTRE SELECTED LAYER">FIT LAYER</button><button id="follow" title="FOLLOW PLAYHEAD" aria-pressed="true">FOLLOW</button><button id="zoomOut" aria-label="ZOOM OUT" title="ZOOM OUT">−</button><button id="zoomIn" aria-label="ZOOM IN" title="ZOOM IN">+</button></div><main id="viewport" aria-label="Designer timeline"><div id="sheet"></div></main><footer>CTRL + WHEEL: ZOOM · SHIFT + WHEEL: PAN<span id="selectionMessage" role="status"></span><span id="warnings"></span></footer></body></html>`

module.exports = { page, stylesheet, browserScript: '(' + browserMain.toString() + ')()' }
