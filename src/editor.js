'use strict'
const { orderLayerParameters } = require('./parameter-order')

// Shared order for the time encoder and layer timing controls. Frame uses the
// current transport FPS; the remaining steps are expressed in seconds.
const TIME_STEPS = [
  'frame',
  'half',
  'second',
  'two',
  'five',
  'ten',
  'thirty',
  'minute',
  'twoMinutes',
  'fiveMinutes',
]
const TIME_STEP_SECONDS = {
  frame: 1,
  half: 0.5,
  second: 1,
  two: 2,
  five: 5,
  ten: 10,
  thirty: 30,
  minute: 60,
  twoMinutes: 120,
  fiveMinutes: 300,
}
const TIME_STEP_LABELS = {
  frame: '1 FRAME',
  half: '0.5 SEC',
  second: '1 SEC',
  two: '2 SEC',
  five: '5 SEC',
  ten: '10 SEC',
  thirty: '30 SEC',
  minute: '1 MIN',
  twoMinutes: '2 MIN',
  fiveMinutes: '5 MIN',
}
const BEAT_STEPS = [0.25, 1, 2, 4, 8, 16, 32]
const LAYER_BEAT_STEPS = [0.25, 1, 4, 8, 16, 32]
const KEY_BEAT_STEPS = [1 / 128, 1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 4, 8]
const beatStepLabel = (value) =>
  (value < 1 ? '1/' + Math.round(1 / value) : String(value)) + (value > 1 ? ' BEATS' : ' BEAT')
const CLEAR_MENU = { resetLayer: 4, clearParameter: 5, resetParameter: 6, back: 7 }

function number(value, label = 'Value') {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number`)
  return value
}
function validateSnapshot(s) {
  if (!s || typeof s.trackUid !== 'string' || typeof s.transportUid !== 'string' || !Array.isArray(s.layers))
    throw new Error('Invalid Designer snapshot')
  number(s.time, 'Time')
  for (const layer of s.layers) {
    if (typeof layer.uid !== 'string' || typeof layer.name !== 'string' || !Array.isArray(layer.fields))
      throw new Error('Invalid layer data')
    for (const field of layer.fields) {
      if (typeof field.name !== 'string' || !Array.isArray(field.keys))
        throw new Error('Invalid parameter data')
      number(field.value)
      for (const key of field.keys) {
        number(key.time)
        number(key.value)
      }
    }
  }
  return s
}

/**
 * Connection-independent editing state shared by the real client and demo.
 * Public times are track-relative seconds; only the Designer script converts
 * to beats. UIDs stay strings because Designer IDs exceed JS integer precision.
 * A selected key is an edit target, not the interpolated value at the playhead.
 */
class Editor {
  constructor(client) {
    this.client = client
    this.linkTime = true
    this.lastPlaybackMode = 'playsection'
    this.snapshot = null
    this.layerIndex = 0
    this.fieldIndex = 0
    this.time = 0
    this.transportTime = 0
    this.value = 0
    this.dirty = false
    this.precision = 'coarse'
    this.busy = false
    this.timeStep = 'frame'
    this.beatStep = 1
    this.layerBeatStep = 0.25
    this.moveKey = null
    this.layerEdit = ''
    this.selectedKeyTime = null
    this.navigationTime = null
    this.pendingJump = null
    this.mediaMode = false
    this.mediaKeyframe = false
    this.mediaCanAnimate = false
    this.mediaFieldIndex = 0
    this.mediaAll = []
    this.mediaFolder = ''
    this.mediaIndex = 0
    this.mediaPage = 0
    this.playing = false
    this.designerSelectionKey = null
    this.designerSelectionIds = []
    this.designerLayerUid = null
  }
  get layer() {
    return this.snapshot?.layers[this.layerIndex]
  }
  get field() {
    return this.layer?.fields[this.fieldIndex]
  }
  selectDefaultParameter() {
    const fields = this.layer?.fields || []
    let index = fields.findIndex((f) => /^brightness$/i.test(f.label || '') || /^brightness$/i.test(f.name))
    if (index < 0)
      index = fields.findIndex((f) => /^volume$/i.test(f.label || '') || /^volume$/i.test(f.name))
    this.fieldIndex = Math.max(0, index)
    this.selectedKeyTime = null
    this.moveKey = null
    this.navigationTime = null
    this.pendingJump = null
    this.loadValue()
  }
  get fine() {
    return this.precision !== 'coarse'
  }
  set fine(enabled) {
    this.precision = enabled ? 'fine' : 'coarse'
  }
  cyclePrecision() {
    this.local()
    const modes = ['coarse', 'fine', 'ultra']
    this.precision = modes[(modes.indexOf(this.precision) + 1) % modes.length]
  }
  get activeLayers() {
    return (
      this.snapshot?.layers.filter(
        (l) => (l.start ?? 0) <= this.time + 1e-7 && (l.end ?? Infinity) >= this.time - 1e-7,
      ) ?? []
    )
  }
  followTimeline(timeline) {
    // Delayed feedback must not undo a queued seek. Apply coherent bounds/time
    // only after it catches up, or after the bounded grace period expires.
    if (!timeline || !this.snapshot || this.busy || this.stale) return
    if (timeline.trackUid !== this.snapshot.trackUid) {
      this.stale = true
      return
    }
    // A mouse selection supersedes a pending jump even while old time feedback
    // is being suppressed. Otherwise NEXT can still target the previous layer.
    this.followDesignerSelection(timeline)
    if (
      this.pendingJump &&
      Date.now() < this.pendingJump.until &&
      Math.abs(timeline.time - this.pendingJump.time) > 0.51 / (this.snapshot.fps || 25)
    )
      return
    const bounds = new Map(timeline.layers.map((l) => [l.uid, l]))
    const selectedUid = this.layer?.uid
    // Indexes are presentation order, never identity. Reordering the stack must
    // not redirect a pending encoder edit to a different layer.
    const order = new Map(timeline.layers.map((l, i) => [l.uid, i]))
    this.snapshot.layers.sort((a, b) => (order.get(a.uid) ?? Infinity) - (order.get(b.uid) ?? Infinity))
    this.layerIndex = this.snapshot.layers.findIndex((l) => l.uid === selectedUid)
    this.transportTime = timeline.time
    const activeTime = this.linkTime ? timeline.time : this.time
    const active = timeline.layers.filter(
      (l) => (l.start ?? 0) <= activeTime + 1e-7 && (l.end ?? Infinity) >= activeTime - 1e-7,
    )
    const signature = active
      .map((l) => l.uid)
      .sort()
      .join(',')
    for (const layer of this.snapshot.layers) {
      const next = bounds.get(layer.uid)
      if (next && Number.isFinite(next.start) && Number.isFinite(next.end))
        Object.assign(layer, { start: next.start, end: next.end })
    }
    if (
      signature !== this.activeLayerSignature ||
      (this.layer && !bounds.has(this.layer.uid)) ||
      timeline.selectedLayerUids?.some(
        (uid) => bounds.has(uid) && !this.snapshot.layers.some((l) => l.uid === uid),
      )
    ) {
      this.receiveTransportTime(timeline.time)
      this.stale = true
      return // Reload only when layers at the playhead change (or the selected layer is deleted).
    }
    this.receiveTransportTime(timeline.time)
    if (timeline.timecodeSamples) this.acceptTimecodes(timeline)
    if (timeline.timecodeSample) this.liveTimecodeSample = timeline.timecodeSample
    this.followDesignerSelection(timeline)
  }
  followDesignerSelection(state) {
    // Follow selection changes, not the same selection on every poll: otherwise
    // Designer would immediately override a layer chosen with the encoder.
    if (!this.linkTime || this.moveKey) return
    if (
      !this.snapshot ||
      !Array.isArray(state?.selectedLayerUids) ||
      state.trackUid !== this.snapshot.trackUid
    )
      return
    const cursor = Number.isFinite(state.time) ? state.time : this.time
    const bounds = state.layers || this.snapshot.layers
    // Compare actual mouse selection, not its time-filtered subset. Entering an
    // overlap must not look like a fresh click and steal the navigation target.
    const ids = state.selectedLayerUids
    const key = JSON.stringify([state.trackUid, ids])
    if (key === this.designerSelectionKey) return
    const previous = this.designerSelectionIds
    this.designerSelectionKey = key
    this.designerSelectionIds = ids
    this.navigationTime = null
    this.pendingJump = null
    this.selectedKeyTime = null
    const eligible = ids.filter(
      (uid) =>
        this.snapshot.layers.some((l) => l.uid === uid) &&
        bounds.some(
          (l) => l.uid === uid && (l.start ?? 0) <= cursor + 1e-7 && (l.end ?? Infinity) >= cursor - 1e-7,
        ),
    )
    const uid = eligible.filter((id) => !previous.includes(id)).at(-1) || eligible.at(-1)
    this.designerLayerUid = uid || null
    if (!uid || uid === this.layer?.uid) return
    this.viewerPinnedLayerUid = null
    this.layerIndex = this.snapshot.layers.findIndex((l) => l.uid === uid)
    this.layerEdit = ''
    this.mediaMode = false
    this.mediaAll = []
    this.mediaFieldIndex = 0
    this.selectDefaultParameter()
  }
  receiveTransportTime(seconds, force = false) {
    if (!Number.isFinite(seconds)) return
    this.transportTime = seconds
    if (this.linkTime) this.followTime(seconds, force)
  }
  followTime(seconds, force = false) {
    if (!Number.isFinite(seconds) || (this.busy && !force)) return
    if (!force && this.pendingJump) {
      const tolerance = 0.51 / (this.snapshot?.fps || 25)
      if (Math.abs(seconds - this.pendingJump.time) > tolerance && Date.now() < this.pendingJump.until) return
      this.pendingJump = null
    }
    if (
      !force &&
      !this.moveKey &&
      !this.pendingJump &&
      Math.abs(seconds - (this.navigationTime ?? this.time)) > 0.51 / (this.snapshot?.fps || 25)
    ) {
      // Playback or a seek made in Designer starts a new navigation context.
      this.navigationTime = null
      this.selectedKeyTime = null
    }
    this.time = seconds
    if (!this.activeLayers.includes(this.layer)) {
      // Once a real playhead change is accepted, inactive layers must leave the
      // editor even if Designer still highlights them or a key was locked.
      this.layerEdit = ''
      this.navigationTime = null
      this.layerIndex = this.snapshot?.layers.indexOf(this.activeLayers[0]) ?? -1
      this.fieldIndex = 0
      this.moveKey = null
      this.selectedKeyTime = null
      this.mediaMode = false
      this.mediaAll = []
      this.selectDefaultParameter()
    }
  }
  requireReady() {
    if (!this.snapshot) throw new Error('Refresh from Designer first')
  }
  requireField() {
    this.requireReady()
    if (!this.field) throw new Error('Select a numeric parameter')
  }
  local() {
    if (this.busy) throw new Error('Designer request in progress; try again')
  }
  async remote(fn) {
    // Serialisation belongs to the host queue; this guard also protects direct
    // callers and suppresses feedback updates during a write/read transaction.
    this.local()
    this.busy = true
    try {
      return await fn()
    } finally {
      this.busy = false
    }
  }
  async refresh({ preserve = false } = {}) {
    // Preserve targets only within the same transport and track. A track switch
    // invalidates key locks and resource previews even if array indexes match.
    return this.remote(async () => {
      const layerUid = this.layer?.uid,
        fieldName = this.field?.name
      const trackUid = this.snapshot?.trackUid,
        transportUid = this.snapshot?.transportUid
      const mediaName = this.mediaField?.name
      const next = validateSnapshot(await this.client.execute('refresh', this.snapshot && !this.linkTime ? {time:this.time,editTime:this.time,editTrackUid:this.snapshot.trackUid,keepPlayhead:true} : {}))
      next.layers.forEach(orderLayerParameters)
      const keep = preserve && next.trackUid === trackUid && next.transportUid === transportUid
      this.snapshot = next
      this.transportTime = next.time
      if (!keep || this.linkTime) this.time = next.time
      this.timecodeSamples = next.timecodeSamples
      this.liveTimecodeSample = null
      if (!keep) {
        this.viewerPinnedLayerUid = null
        this.designerSelectionKey = null
        this.designerSelectionIds = []
        this.designerLayerUid = null
      }
      this.stale = false
      this.activeLayerSignature = next.layers
        .filter((l) => (l.start ?? 0) <= this.time + 1e-7 && (l.end ?? Infinity) >= this.time - 1e-7)
        .map((l) => l.uid)
        .sort()
        .join(',')
      this.layerIndex = Math.max(
        0,
        next.layers.findIndex((l) => l.uid === layerUid),
      )
      this.fieldIndex = Math.max(
        0,
        (this.layer?.fields || []).findIndex((f) => f.name === fieldName),
      )
      if (keep && this.layer && this.layer.uid === layerUid && this.field?.name === fieldName) {
        const keys = this.field?.keys || []
        if(this.moveKey?.group?.some(selected=>!keys.some(k=>Math.abs(k.time-selected.time)<1e-6 && k.value===selected.value && k.resourceUid===selected.resourceUid && k.interpolation===selected.interpolation)))this.moveKey=null
        if (
          this.selectedKeyTime !== null &&
          !keys.some((k) => Math.abs(k.time - this.selectedKeyTime) < 1e-5)
        ) {
          this.selectedKeyTime = null
          this.navigationTime = null
          this.pendingJump = null
          this.moveKey = null
        }
        if (
          this.moveKey &&
          !keys.some(
            (k) =>
              Math.abs(k.time - this.moveKey.time) < 1e-5 &&
              k.value === this.moveKey.value &&
              k.resourceUid === this.moveKey.resourceUid &&
              k.interpolation === this.moveKey.interpolation,
          )
        )
          this.moveKey = null
        this.mediaFieldIndex = Math.max(
          0,
          this.layer.mediaFields?.findIndex((f) => f.name === mediaName) ?? 0,
        )
        if (!this.layer.mediaFields?.length) {
          this.mediaMode = false
          this.mediaAll = []
        }
        this.followTime(this.time, true)
        if (!this.linkTime && this.field) this.acceptLive(await this.client.execute('read_field',this.liveArgs()))
        this.loadValue()
        this.followDesignerSelection(next)
        return
      }
      this.moveKey = null
      this.navigationTime = null
      this.pendingJump = null
      this.layerEdit = ''
      this.selectedKeyTime = null
      this.mediaMode = false
      this.mediaAll = []
      this.followTime(this.time, true)
      if (!keep) this.selectDefaultParameter()
      this.loadValue()
      this.followDesignerSelection(next)
    })
  }
  get selectedKey() {
    const keys = this.field?.keys || []
    if (!this.field?.sequenced || keys.length === 1) return keys[0]
    if (this.selectedKeyTime !== null) return keys.find((k) => Math.abs(k.time - this.selectedKeyTime) < 1e-5)
    return (
      keys
        .filter((k) => k.time <= this.time + 1e-5)
        .sort((a, b) => a.time - b.time)
        .at(-1) || keys[0]
    )
  }
  loadValue() {
    // Designer evaluates interpolation, expressions and other live inputs.
    // The preceding key is an edit target, not the value at the playhead.
    this.value = this.field?.value ?? 0
    this.dirty = false
  }
  get valueLabel() {
    if (this.field?.resource) return this.field.resourceName || 'NONE'
    const choice = this.field?.choices?.find((c) => c.value === this.value)
    if (choice) return choice.label
    if (this.field?.integer) return String(Math.round(this.value))
    const decimals = { coarse: 1, fine: 2, ultra: 3 }[this.precision] ?? 1
    return Number(this.value.toFixed(decimals)).toFixed(decimals)
  }
  get beatMode() {
    return this.snapshot?.beatMode === true
  }
  get usesBeatSteps() {
    return this.beatMode
  }
  get timeStepAmount() {
    return this.usesBeatSteps
      ? this.layerEdit
        ? this.layerBeatStep
        : this.moveKey
          ? (this.keyBeatStep ?? 1 / 128)
          : this.beatStep
      : TIME_STEP_SECONDS[this.timeStep]
  }
  get timeStepChoices() {
    const values = this.beatMode
      ? this.layerEdit
        ? LAYER_BEAT_STEPS
        : this.moveKey
          ? KEY_BEAT_STEPS
          : BEAT_STEPS
      : TIME_STEPS
    const selected = this.beatMode ? this.timeStepAmount : this.timeStep
    return values.map((value) => ({
      value,
      selected: value === selected,
      label: this.beatMode ? beatStepLabel(value) : TIME_STEP_LABELS[value],
    }))
  }
  setTimeStep(index) {
    this.local()
    if (!Number.isInteger(index) || index < 0 || index >= 10)
      throw new Error('Invalid timing step slot')
    if (this.mediaMode || this.clearKeysBrowser || this.clearKeysPrompt) return
    const choice = this.timeStepChoices[index]
    if (!choice) return
    if (!this.beatMode) this.timeStep = choice.value
    else if (this.layerEdit) this.layerBeatStep = choice.value
    else if (this.moveKey) this.keyBeatStep = choice.value
    else this.beatStep = choice.value
  }
  get timeStepLabel() {
    if (this.usesBeatSteps) return beatStepLabel(this.timeStepAmount)
    return TIME_STEP_LABELS[this.timeStep]
  }
  cycleTimeStep() {
    if (this.layerEdit) {
      this.layerEdit = ''
      this.followTime(this.time)
      return
    }
    if (this.usesBeatSteps && this.moveKey) {
      const steps = KEY_BEAT_STEPS
      this.keyBeatStep = steps[(steps.indexOf(this.keyBeatStep ?? 1 / 128) + 1) % steps.length]
      return
    }
    if (this.usesBeatSteps) {
      const steps = BEAT_STEPS
      this.beatStep = steps[(steps.indexOf(this.beatStep) + 1) % steps.length]
      return
    }
    const steps = TIME_STEPS
    this.timeStep = steps[(steps.indexOf(this.timeStep) + 1) % steps.length]
  }
  liveArgs() {
    return {
      ...this.context(),
      layerUid: this.layer?.uid,
      field: this.field?.name,
      keyTime: this.selectedKey?.time,
      live: this.linkTime,
    }
  }
  acceptLive(result) {
    this.acceptTimecodes(result)
    if (Number.isFinite(result.fps) && this.snapshot)
      Object.assign(this.snapshot, { fps: result.fps, tcMode: result.tcMode, customFps: result.customFps })
    if (Number.isFinite(result.time)) this.time = result.time
    if (result.field) {
      number(result.field.value)
      Object.assign(this.field, result.field)
      if (!this.field.sequenced && this.moveKey) {
        this.moveKey = null
        this.selectedKeyTime = null
        this.navigationTime = null
        this.pendingJump = null
      }
      this.loadValue()
    }
  }
  acceptTimecodes(result) {
    if (Array.isArray(result.timecodeSamples)) {
      const editSample = !this.linkTime && this.timecodeSamples?.find(sample => Math.abs(sample.seconds-this.time)<1e-7)
      this.timecodeSamples = result.timecodeSamples
      if (editSample && !this.timecodeSamples.some(sample => Math.abs(sample.seconds-this.time)<1e-7)) this.timecodeSamples = [...this.timecodeSamples,editSample]
      this.liveTimecodeSample = null
    }
  }
  async selectLive(kind, direction) {
    this.local()
    this.requireReady()
    if (this.moveKey && (kind === 'layer' || kind === 'field')) return
    if (direction !== -1 && direction !== 1) throw new Error('Direction must be -1 or 1')
    if (kind === 'layer') {
      // An encoder choice overrides Designer's existing highlight, including a
      // highlight not yet delivered by polling. Only a subsequent mouse change
      // may take selection ownership back.
      const state = await this.remote(() => this.client.execute('live_state', this.context()))
      if (Array.isArray(state.timeline?.selectedLayerUids)) {
        this.designerSelectionIds = state.timeline.selectedLayerUids
        this.designerSelectionKey = JSON.stringify([state.timeline.trackUid, this.designerSelectionIds])
      }
      this.followTimeline(state.timeline)
      if (this.stale) await this.refresh({ preserve: true })
    }
    this.layerEdit = ''
    this.selectedKeyTime = null
    this.navigationTime = null
    this.pendingJump = null
    // Media browsing opens explicitly and keeps the numeric parameter selection.
    this.select(kind, direction)
    this.moveKey = null
    if (this.field)
      await this.remote(async () => this.acceptLive(await this.client.execute('read_field', this.liveArgs())))
    if (this.mediaMode) await this.loadMedia()
  }
  async seekFromViewer(target) {
    return this.withEditTime(() => this.seekFromViewerTarget(target))
  }
  async seekFromViewerTarget({ trackUid, time }) {
    this.viewerPinnedLayerUid = null
    this.local()
    if (!Number.isFinite(time)) return { ok: false, reason: 'Invalid time' }
    await this.refresh({ preserve: true })
    if (this.snapshot.trackUid !== trackUid) return { ok: false, reason: 'Track changed; try again' }
    const fps = this.snapshot.fps || 25
    const target = Math.max(0, Math.min(this.snapshot.length, Math.round(time * fps) / fps))
    // Move the active clock, never the selected key. Native transport stays put when unlinked.
    const result = await this.remote(() => this.client.execute('seek', { ...this.context(), time: target }))
    this.moveKey = null
    this.selectedKeyTime = null
    this.layerEdit = ''
    this.mediaMode = false
    this.mediaAll = []
    this.navigationTime = null
    this.time = result.time
    this.followTime(this.time, true)
    if (!this.linkTime && this.field) await this.remote(async () => this.acceptLive(await this.client.execute('read_field',this.liveArgs())))
    this.loadValue()
    this.acceptTimecodes(result)
    this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
    return { ok: true, time: result.time }
  }
  async selectFromViewer(target) {
    const previous=this.viewerKeepPlayhead
    this.viewerKeepPlayhead=target.keepPlayhead ?? previous ?? !this.linkTime
    try {return await this.selectFromViewerTarget(target)}
    finally {this.viewerKeepPlayhead=previous}
  }
  async selectFromViewerTarget({ trackUid, layerUid, parameter, point, keyTime }) {
    this.local()
    if (this.moveKey) return { ok: false, reason: 'Exit SELECT KEY before changing selection' }
    if (this.clearKeysBrowser) return { ok: false, reason: 'Close the DELETE menu before changing selection' }
    // Refresh before accepting a browser click: the layer may have moved or
    // disappeared since rendering. Layer clicks explicitly request their IN point.
    this.viewerPinnedLayerUid=this.keepEditPlayhead ? layerUid : null
    const pendingTime = this.pendingJump && Date.now() < this.pendingJump.until ? this.pendingJump.time : this.time
    await this.refresh({ preserve: true })
    if (this.snapshot.trackUid !== trackUid) return { ok: false, reason: 'Track changed; select again' }
    const layer = this.snapshot.layers.find((item) => item.uid === layerUid)
    if (!layer) return { ok: false, reason: 'Layer is no longer available' }
    const selectionTime = pendingTime ?? this.time
    if (!point && (selectionTime < layer.start-1e-7 || selectionTime > layer.end+1e-7)) return {ok:false,reason:'LAYER IS OUTSIDE THE EDIT TIME'}
    const numeric = parameter === undefined ? -1 : layer.fields.findIndex((field) => field.name === parameter)
    const resource =
      parameter === undefined ? -1 : (layer.mediaFields || []).findIndex((field) => field.name === parameter)
    if (parameter !== undefined && numeric < 0 && resource < 0)
      return { ok: false, reason: 'Parameter is no longer available' }
    let insertTime
    if (point) {
      const fps = this.snapshot.fps || 25
      let target
      if (point === 'in') target = layer.start
      else if (point === 'out') target = layer.end
      else if (point === 'key') {
        const field = numeric >= 0 ? layer.fields[numeric] : layer.mediaFields?.[resource]
        const key = field?.sequenced && field.keys?.find(k => Math.abs(k.time-keyTime) < 1e-5)
        if (!key) return {ok:false,reason:'KEYFRAME CHANGED — VIEW REFRESHING'}
        if (key.time < layer.start-1e-7 || key.time > layer.end+1e-7) return {ok:false,reason:'KEYFRAME IS OUTSIDE LAYER BOUNDS'}
        target = key.time
      } else if (point === 'insert') {
        const insertField = numeric >= 0 ? layer.fields[numeric] : layer.mediaFields[resource]
        if (!insertField || insertField.canAnimate === false)
          return {ok:false,reason:'THIS PARAMETER CANNOT BE KEYFRAMED'}
        target = Math.round(keyTime*fps)/fps
        if (!Number.isFinite(target) || target < layer.start || target > layer.end)
          return {ok:false,reason:'CHOOSE A TIME INSIDE THE LAYER'}
        insertTime = target
      } else return {ok:false,reason:'Invalid timeline point'}
      if (!Number.isFinite(target) || target < 0 || target > this.snapshot.length) return {ok:false,reason:'Layer is outside the track'}
      const result = await this.remote(() => this.client.execute('seek', {...this.context(),time:target}))
      this.time = result.time
      this.pendingJump = this.keepEditPlayhead ? null : {time:result.time,until:Date.now()+1500}
      this.activeLayerSignature = this.activeLayers.map(l => l.uid).sort().join(',')
    }
    this.layerIndex = this.snapshot.layers.indexOf(layer)
    // Suppress only the already-observed Designer selection; a new mouse
    // selection in Designer can still take ownership on the next update.
    this.designerSelectionIds = this.snapshot.selectedLayerUids || []
    this.designerSelectionKey = JSON.stringify([trackUid, this.designerSelectionIds])
    this.designerLayerUid = null
    this.layerEdit = ''
    this.mediaMode = false
    this.mediaAll = []
    this.mediaKeyframe = false
    this.mediaFieldIndex = 0
    this.selectDefaultParameter()
    if (numeric >= 0) {
      this.selectedKeyTime = point === 'key' ? keyTime : null
      this.fieldIndex = numeric
      this.loadValue()
    }
    if (resource >= 0 && point !== 'key') {
      this.mediaFieldIndex = resource
      this.mediaMode = true
      await this.loadMedia()
      if (point === 'insert') {
        if (!this.mediaCanAnimate) return {ok:false,reason:'THIS RESOURCE CANNOT BE KEYFRAMED'}
        // Pin the clicked time after catalog reads. Delayed transport feedback
        // must never turn insertion into replacement of the previous key.
        this.mediaKeyframe = true
        this.mediaKeyTime = insertTime
        this.time = insertTime
        this.pendingJump = this.keepEditPlayhead ? null : {time:insertTime,until:Date.now()+1500}
      }
    }
    if (point === 'insert' && resource < 0) {
      await this.writeLive('key_set',insertTime)
      await this.toggleMoveKey(insertTime)
    }
    return { ok: true, ...(point === 'insert' && this.linkTime ? {time:insertTime} : {}) }
  }
  async selectKeyGroup(times) {
    this.requireField()
    const keys=times.map(time=>this.field.keys.find(k=>Math.abs(k.time-time)<1e-6))
    if(keys.some(k=>!k) || new Set(times).size!==times.length)throw new Error('Keyframes changed; select again')
    const result=await this.remote(()=>this.client.execute('key_group',{...this.liveArgs(),operation:'select',expectedKeys:keys}))
    this.acceptLive(result)
    this.moveKey={...result.selectedKeys[0],group:result.selectedKeys}
    this.selectedKeyTime=this.moveKey.time
  }
  async editKeyGroup(operation, options={}) {
    const keys=this.moveKey?.group
    if(!keys)return
    const result=await this.remote(()=>this.client.execute('key_group',{...this.liveArgs(),operation,expectedKeys:keys,...options}))
    this.acceptLive(result)
    this.moveKey=result.selectedKeys?.length ? {...result.selectedKeys[0],group:result.selectedKeys} : null
    this.selectedKeyTime=this.moveKey?.time ?? null
  }
  async adjustLiveValue(direction, step = 0, pointer = {}) {
    if(this.moveKey?.group)return
    if (this.moveKey && !Number.isFinite(pointer.targetValue)) this.guidesUntil = Date.now()+650
    if (!this.field) return
    if (this.field.resource) return
    this.requireField()
    await this.remote(async () =>
      this.acceptLive(
        await this.client.execute('adjust_value', {
          ...this.liveArgs(),
          expectedKey: this.moveKey || undefined,
          direction,
          step,
          fine: this.fine,
          precision: this.precision,
          previewCurve: pointer.previewCurve === true,
          ...(Number.isFinite(pointer.targetValue) ? {targetValue:pointer.targetValue,expectedValue:pointer.expectedValue} : {}),
        }),
      ),
    )
    if (this.moveKey && this.selectedKey) this.moveKey = { ...this.selectedKey }
  }
  get viewOnly() { return this.client.viewOnly === true }
  clearViewEditing() {
    this.moveKey = null
    this.selectedKeyTime = null
    this.layerEdit = ''
    this.clearKeysBrowser = null
    this.clearKeysPrompt = null
    this.deletePress = null
    this.pendingJump = null
    this.guidesUntil = 0
  }
  setLinkTime(enabled) {
    if (this.viewOnly) enabled = false
    this.local()
    const changed = this.linkTime !== Boolean(enabled)
    this.linkTime = Boolean(enabled)
    this.viewerPinnedLayerUid = null
    this.pendingJump = null
    if (changed) {
      this.moveKey = null
      this.selectedKeyTime = null
      this.navigationTime = null
      this.layerEdit = ''
      this.mediaMode = false
      this.mediaAll = []
      this.clearKeysBrowser = null
      this.clearKeysPrompt = null
      this.deletePress = null
      this.followTime(this.transportTime, true)
      this.loadValue()
    }
  }
  get keepEditPlayhead() {
    return this.viewOnly || (this.viewerKeepPlayhead ?? !this.linkTime)
  }
  async withEditTime(fn) {
    const previous = this.viewerKeepPlayhead
    this.viewerKeepPlayhead = previous ?? !this.linkTime
    if (this.viewerKeepPlayhead && this.layer) this.viewerPinnedLayerUid = this.layer.uid
    try { return await fn() }
    finally { this.viewerKeepPlayhead = previous }
  }
  async adjustLiveTime(direction, stepOverride, pointer = {}) {
    if ((this.moveKey || this.layerEdit) && !Number.isFinite(pointer.targetTime)) this.guidesUntil = Date.now()+650
    if (this.moveKey || this.layerEdit) return this.withEditTime(() => this.adjustLiveTimeTarget(direction, stepOverride, pointer))
    return this.withEditTime(() => this.adjustLiveTimeTarget(direction, stepOverride, pointer))
  }
  async adjustLiveTimeTarget(direction, stepOverride, pointer = {}) {
    this.requireReady()
    const cursor = this.pendingJump && Date.now() < this.pendingJump.until ? this.pendingJump.time : this.time
    this.navigationTime = null
    this.pendingJump = null
    const beats = !stepOverride && this.usesBeatSteps
    const frames = !beats && !stepOverride && this.timeStep === 'frame'
    const delta = number(direction) * (stepOverride || this.timeStepAmount)
    if(this.moveKey?.group)return this.editKeyGroup('move',{delta,frames,beats,...pointer})
    if (this.layerEdit) {
      await this.remote(async () => {
        const result = await this.client.execute('layer_edit', {
          ...this.liveArgs(),
          delta,
          frames,
          beats,
          cursor,
          mode: this.layerEdit,
          expectedStart: this.layer.start,
          expectedEnd: this.layer.end,
        })
        Object.assign(this.layer, result.layer)
        this.selectedKeyTime = null
        this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
        this.acceptLive(result)
      })
      return
    }
    await this.remote(async () => {
      const result = await this.client.execute(this.moveKey ? 'key_move' : 'nudge_time', {
        ...this.liveArgs(),
        delta,
        frames,
        beats,
        cursor,
        sourceTime: this.moveKey?.time,
        expectedKey: this.moveKey,
        ...pointer,
      })
      this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
      if (this.moveKey) {
        this.moveKey = { ...this.field.keys.find((k) => Math.abs(k.time - result.time) < 1e-5) }
        this.selectedKeyTime = this.moveKey.time
      } else {
        this.selectedKeyTime = null
        this.followTime(this.time, true)
        this.loadValue()
      }
    })
  }
  async keyLive(direction) {
    return this.withEditTime(() => this.keyLiveTarget(direction))
  }
  async keyLiveTarget(direction) {
    // Read selection immediately before navigation; a button press can arrive
    // before the 500 ms background poll has observed a Designer mouse click.
    this.requireReady()
    const state = await this.remote(() => this.client.execute('live_state', this.context()))
    this.followTimeline(state.timeline)
    if (this.stale) await this.refresh({ preserve: true })
    if (!this.field) return
    this.requireField()
    this.moveKey = null
    this.layerEdit = ''
    await this.remote(async () => {
      const result = await this.client.execute('jump_key', {
        ...this.liveArgs(),
        direction,
        navigationTime: this.navigationTime,
      })
      if (Number.isFinite(result.time)) {
        this.selectedKeyTime = Number.isFinite(result.keyTime) ? result.keyTime : null
        this.navigationTime = result.time
        this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
      }
      this.acceptLive(result)
    })
    this.loadValue()
  }
  async toggleMoveKey(exactTime) {
    if (this.viewOnly) return
    return this.withEditTime(() => this.toggleMoveKeyTarget(exactTime))
  }
  async toggleMoveKeyTarget(exactTime) {
    if (!this.field) return
    this.requireField()
    if (this.moveKey) {
      this.moveKey = null
      this.selectedKeyTime = null
      this.navigationTime = null
      this.pendingJump = null
      this.loadValue()
      return
    }
    if (!this.canSelectKey) return
    this.layerEdit = ''
    this.navigationTime = null
    this.pendingJump = null
    await this.remote(async () => {
      const result = await this.client.execute('select_key', {...this.liveArgs(),...(Number.isFinite(exactTime) ? {sourceTime:exactTime} : {})})
      if (!result.selectedKey) {
        this.acceptLive(result)
        return
      }
      this.selectedKeyTime = result.selectedKey.time
      this.moveKey = result.selectedKey
      this.navigationTime = result.time
      this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
    })
  }
  async cycleKeyType(type) {
    if(this.moveKey?.group)return
    if (this.field?.resource) return // Resource sequences are discrete HOLD keys.
    if (type !== undefined && ![0, 1, 2].includes(type)) throw new Error('Invalid keyframe type')
    if (!this.canSelectKey) return
    this.requireField()
    await this.remote(async () =>
      this.acceptLive(
        await this.client.execute('key_type', { ...this.liveArgs(), sourceTime: this.selectedKey?.time,
          expectedKey: this.moveKey || undefined, ...(type === undefined ? {} : {type}) }),
      ),
    )
    if (this.moveKey && this.selectedKey) this.moveKey = { ...this.selectedKey }
  }
  async writeLive(command, targetTime) {
    if(this.moveKey?.group) {if(command==='key_delete')await this.editKeyGroup('delete');return}
    this.requireField()
    // Some Designer settings (for example Web dimensions) are constants by
    // design. Pressing the value dial must not send an impossible key write.
    if (command === 'key_set' && this.field.canAnimate === false) return
    const expectedKey = this.moveKey ? { ...this.moveKey } : undefined
    this.navigationTime = null
    this.pendingJump = null
    await this.remote(async () => {
      const pinned = Number.isFinite(targetTime) ? {live:false,time:targetTime} : {}
      this.acceptLive(await this.client.execute('read_field', {...this.liveArgs(),...pinned}))
      const result = await this.client.execute(command, { ...this.liveArgs(), ...pinned, value: this.field.value, expectedKey })
      this.moveKey = null
      this.selectedKeyTime = command === 'key_set' ? result.time : null
      this.acceptLive(result)
    })
  }
  cycleLayerEdit() {
    this.local()
    this.requireReady()
    if (!this.layer) throw new Error('Select an active layer first')
    const modes = ['', 'move', 'in', 'out']
    this.layerEdit = modes[(modes.indexOf(this.layerEdit) + 1) % modes.length]
    this.navigationTime = null
    this.pendingJump = null
    this.moveKey = null
    this.mediaMode = false
    if (!this.layerEdit) this.followTime(this.time)
  }
  async pressValue() {
    if(this.moveKey?.group)return
    if (this.layerEdit === 'edit') return this.cycleLayerStep()
    if (this.mediaMode) {
      if (!this.currentMedia) return
      await this.setMedia(this.mediaIndex)
      this.mediaMode = false
      if (!this.field?.resource) this.selectDefaultParameter()
      return
    }
    if (this.field?.resource) {
      await this.toggleMedia()
      this.mediaKeyframe = this.mediaCanAnimate
      this.mediaKeyTime = this.time
      return
    }
    if (this.field) return this.writeLive('key_set')
  }
  get mediaField() {
    return this.layer?.mediaFields?.[this.mediaFieldIndex]
  }
  toggleLayerEditor() {
    if (this.viewOnly) return
    this.local()
    this.requireReady()
    if (!this.layer) return
    const closing = this.layerEdit === 'edit'
    this.layerEdit = closing ? '' : 'edit'
    this.mediaMode = false
    this.moveKey = null
    this.navigationTime = null
    this.pendingJump = null
    this.selectedKeyTime = null
    if (closing) {
      this.followTime(this.time)
      this.selectDefaultParameter()
    }
  }
  cycleLayerStep() {
    if (this.beatMode) {
      const steps = LAYER_BEAT_STEPS
      this.layerBeatStep = steps[(steps.indexOf(this.layerBeatStep) + 1) % steps.length]
      return
    }
    const steps = TIME_STEPS
    this.timeStep = steps[(steps.indexOf(this.timeStep) + 1) % steps.length]
  }
  async adjustLayerTiming(mode, direction, pointer = {}) {
    if (!Number.isFinite(pointer.targetTime)) this.guidesUntil = Date.now()+650
    return this.withEditTime(() => this.adjustLayerTimingTarget(mode, direction, pointer))
  }
  async adjustLayerTimingTarget(mode, direction, pointer = {}) {
    this.requireReady()
    if (!['in', 'move', 'out'].includes(mode) || !this.layer) throw new Error('Select a layer timing control')
    if (direction !== -1 && direction !== 1) throw new Error('Direction must be -1 or 1')
    await this.remote(async () => {
      const cursor =
        this.pendingJump && Date.now() < this.pendingJump.until ? this.pendingJump.time : undefined
      const result = await this.client.execute('layer_edit', {
        ...this.liveArgs(),
        mode,
        cursor,
        delta: direction * (pointer.detents || 1) * (this.beatMode ? this.layerBeatStep : TIME_STEP_SECONDS[this.timeStep]),
        beats: this.beatMode,
        frames: !this.beatMode && this.timeStep === 'frame',
        expectedStart: this.layer.start,
        expectedEnd: this.layer.end,
        ...pointer,
      })
      Object.assign(this.layer, result.layer)
      this.selectedKeyTime = null
      this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
    })
  }
  async fitLayerToContent() {
    return this.withEditTime(() => this.fitLayerToContentTarget())
  }
  async fitLayerToContentTarget() {
    this.requireReady()
    if (!this.layer) throw new Error('Select a layer first')
    await this.remote(async () => {
      const cursor =
        this.pendingJump && Date.now() < this.pendingJump.until ? this.pendingJump.time : undefined
      const result = await this.client.execute('layer_edit', {
        ...this.liveArgs(),
        mode: 'fit',
        cursor,
        expectedStart: this.layer.start,
        expectedEnd: this.layer.end,
      })
      Object.assign(this.layer, result.layer)
      this.selectedKeyTime = null
      this.navigationTime = null
      this.pendingJump = this.keepEditPlayhead ? null : { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
    })
  }
  get mediaFolders() {
    return [...new Set(this.mediaAll.map((m) => m.folder))].sort()
  }
  get mediaItems() {
    return this.mediaAll.filter((m) => m.folder === this.mediaFolder)
  }
  get currentMedia() {
    return this.mediaItems[this.mediaIndex]
  }
  async toggleMedia() {
    this.layerEdit = ''
    if (!this.mediaMode && !this.layer?.mediaFields?.length) return
    this.mediaMode = !this.mediaMode
    this.mediaKeyframe = false
    if (this.mediaMode && this.field?.resource) {
      this.mediaFieldIndex = Math.max(0, this.layer.mediaFields.findIndex(f => f.name === this.field.name))
    } else if (!this.field?.resource) this.moveKey = null
    if (this.mediaMode) await this.loadMedia()
    else if (!this.field?.resource) this.selectDefaultParameter()
  }
  async loadMedia({ preserve = false, preservePreview = false } = {}) {
    const previousFolder = this.mediaFolder,
      previousUid = this.currentMedia?.uid
    if (!this.mediaField) this.mediaFieldIndex = 0
    if (!this.mediaField) return
    await this.remote(async () => {
      const result = await this.client.execute('media_list', {
        ...this.liveArgs(),
        field: this.mediaField.name,
      })
      const signature = JSON.stringify(result.media)
      if (signature !== this.mediaLibrarySignature) {
        this.mediaLibrarySignature = signature
        this.mediaLibraryRevision = (this.mediaLibraryRevision || 0) + 1
      }
      this.mediaCanAnimate = result.canAnimate === true
      if (!this.mediaCanAnimate) this.mediaKeyframe = false
      this.mediaAll = result.media.map((m) => ({
        ...m,
        folder: m.folder || m.path.split('/').slice(2, -1).join('/') || '/',
      }))
      this.mediaFolder =
        preserve && this.mediaFolders.includes(previousFolder)
          ? previousFolder
          : (this.mediaAll.find((m) => m.uid === result.selectedUid)?.folder ?? this.mediaFolders[0] ?? '')
      this.mediaIndex = this.mediaItems.findIndex((m) => m.uid === result.selectedUid)
      if (preservePreview && previousUid) {
        const previous = this.mediaItems.findIndex(m => m.uid === previousUid)
        if (previous >= 0) this.mediaIndex = previous
      }
      if (preserve && this.mediaIndex < 0)
        this.mediaIndex = this.mediaItems.findIndex((m) => m.uid === previousUid)
      this.mediaPage = Math.floor(Math.max(0, this.mediaIndex) / 8)
    })
  }
  async selectMediaField(direction) {
    if (this.moveKey) return
    this.mediaKeyframe = false
    const count = this.layer?.mediaFields?.length || 0
    this.mediaFieldIndex = count ? (this.mediaFieldIndex + direction + count) % count : 0
    await this.loadMedia()
  }
  selectMediaFolder(direction) {
    const folders = this.mediaFolders
    if (!folders.length) return
    this.mediaFolder =
      folders[(folders.indexOf(this.mediaFolder) + direction + folders.length) % folders.length]
    this.mediaIndex = -1
    this.mediaPage = 0
  }
  async setMedia(index) {
    const item = this.mediaItems[index]
    if (!item || !this.mediaField) return
    await this.remote(async () => {
      await this.client.execute(this.mediaKeyframe ? 'media_key_set' : 'media_set', {
        ...this.liveArgs(),
        field: this.mediaField.name,
        mediaUid: item.uid,
        expectedKey: this.moveKey || undefined,
        targetTime: this.mediaKeyframe ? this.mediaKeyTime : undefined,
      })
      this.mediaIndex = index
      this.mediaPage = Math.floor(index / 8)
      if (this.field?.name === this.mediaField.name) {
        this.acceptLive(await this.client.execute('read_field', this.liveArgs()))
        if (this.moveKey && this.selectedKey) this.moveKey = { ...this.selectedKey }
      }
    })
  }
  async browseMedia(direction) {
    if (!this.mediaItems.length) return
    this.mediaIndex = Math.max(0, Math.min(this.mediaItems.length - 1, this.mediaIndex + direction))
    this.mediaPage = Math.floor(this.mediaIndex / 8)
  }
  toggleMediaKeyframe() {
    this.local()
    if (this.moveKey) return // Replacing an explicitly selected key never creates another.
    if (this.mediaMode && this.mediaCanAnimate) {
      this.mediaKeyframe = !this.mediaKeyframe
      this.mediaKeyTime = this.mediaKeyframe ? this.time : undefined
    }
  }
  async pressPad(slot) {
    if (this.viewOnly && (this.mediaMode || ![0,1,7].includes(slot))) return
    if (!Number.isInteger(slot) || slot < 0 || slot > 7) throw new Error('Invalid button')
    if (this.clearKeysPrompt) {
      if (slot === 5) return this.confirmClearKeys()
      this.clearKeysPrompt = null
      return
    }
    if (this.clearKeysBrowser) {
      if (slot === CLEAR_MENU.resetLayer) return this.requestLayerDefaults()
      if (slot === CLEAR_MENU.clearParameter) return this.requestClearKeys()
      if (slot === CLEAR_MENU.resetParameter) return this.requestClearKeys(true)
      if (slot === CLEAR_MENU.back) this.closeClearKeys()
      return
    }
    if (this.mediaMode) return this.setMedia(this.mediaPage * 8 + slot)
    if (!this.layer && slot !== 3) return
    if (slot === 7) return this.toggleMedia()
    return [
      () => this.keyLive(-1),
      () => this.keyLive(1),
      () => this.toggleLayerEditor(),
      () => this.setLinkTime(!this.linkTime),
      () => this.toggleMoveKey(),
      () => (this.canResetDefault ? this.resetDefault() : this.writeLive('key_delete')),
      () => this.cycleKeyType(),
    ][slot]()
  }
  deletionTarget() {
    this.requireReady()
    if (!this.layer) throw new Error('Select a layer')
    const { trackUid, transportUid } = this.context()
    return { trackUid, transportUid, layerUid: this.layer.uid, field: this.field?.name }
  }
  get canResetDefault() {
    return Boolean(this.field && !this.field.sequenced && (this.field.keys?.length || 0) <= 1)
  }
  get canSelectKey() {
    return Boolean(
      this.field?.sequenced &&
      this.field.keys?.some(
        (k) => k.time >= (this.layer?.start ?? 0) && k.time <= (this.layer?.end ?? Infinity),
      ),
    )
  }
  async resetDefault() {
    this.requireField()
    await this.remote(() => this.client.execute('parameter_default', this.liveArgs()))
    await this.refresh({ preserve: true })
  }
  async padDown(slot, now = Date.now()) {
    if (this.viewOnly && ![0,1,7].includes(slot)) return
    if (slot === 5 && !this.layer) return
    if (slot !== 5 || this.mediaMode || this.clearKeysPrompt || this.clearKeysBrowser)
      return this.pressPad(slot)
    // Defer single deletion until release so a hold never deletes a key first.
    this.deletePress = { time: now, target: this.deletionTarget(), resetDefault: this.canResetDefault }
  }
  async padUp(slot, now = Date.now()) {
    if (this.viewOnly && ![0,1,7].includes(slot)) return
    if (slot !== 5 || !this.deletePress) return
    const press = this.deletePress
    this.deletePress = null
    if (this.mediaMode || JSON.stringify(press.target) !== JSON.stringify(this.deletionTarget()))
      throw new Error('Selection changed; deletion cancelled')
    if (now - press.time >= 1000) {
      if(this.moveKey?.group)return this.writeLive('key_delete')
      return this.openClearKeys()
    }
    if (press.resetDefault) return this.resetDefault()
    return this.writeLive('key_delete')
  }
  async confirmClearKeys() {
    const prompt = this.clearKeysPrompt
    this.clearKeysPrompt = null
    // A Designer selection/track change must never redirect this confirmation.
    if (!prompt || !this.clearKeysTargetValid()) throw new Error('Selection changed; deletion cancelled')
    await this.remote(async () => {
      await this.client.execute(prompt.allParameters ? 'layer_default' : 'keys_clear', {
        ...this.context(),
        ...prompt.target,
        fields: prompt.fields,
        resetDefault: prompt.resetDefault,
        confirmed: true,
      })
      this.moveKey = null
      this.selectedKeyTime = null
      this.navigationTime = null
      this.pendingJump = null
    })
    this.closeClearKeys()
    await this.refresh({ preserve: true })
  }
  // A layer-wide reset is deliberately a separate choice from resetting one
  // parameter. Both use the same confirmation and immutable target identity.
  requestLayerDefaults() {
    return this.requestClearKeys(true, true)
  }
  closeClearKeys() {
    this.clearKeysBrowser = null
    this.clearKeysPrompt = null
    this.deletePress = null
  }
  clearKeysTargetValid() {
    const target = this.clearKeysBrowser?.target
    return Boolean(
      target &&
      !this.stale &&
      target.trackUid === this.snapshot?.trackUid &&
      target.transportUid === this.snapshot?.transportUid &&
      target.layerUid === this.layer?.uid,
    )
  }
  async openClearKeys() {
    const { field, ...target } = this.deletionTarget()
    const result = await this.remote(() =>
      this.client.execute('key_clear_list', { ...this.context(), ...target }),
    )
    this.mediaMode = false
    this.layerEdit = ''
    this.moveKey = null
    this.clearKeysPrompt = null
    this.clearKeysBrowser = {
      target,
      layerName: this.layer.name,
      items: result.items,
      index: Math.max(
        0,
        result.items.findIndex((item) => item.name === field),
      ),
    }
  }
  browseClearKeys(direction) {
    const browser = this.clearKeysBrowser
    if (!this.clearKeysTargetValid()) {
      this.closeClearKeys()
      throw new Error('Selection changed; deletion cancelled')
    }
    this.clearKeysPrompt = null
    browser.index = Math.max(0, Math.min(browser.items.length - 1, browser.index + direction))
  }
  requestClearKeys(resetDefault = false, allParameters = false) {
    if (!this.clearKeysTargetValid()) {
      this.closeClearKeys()
      throw new Error('Selection changed; deletion cancelled')
    }
    const browser = this.clearKeysBrowser
    const item = browser.items[browser.index]
    if (!item && !allParameters) return
    this.clearKeysPrompt = {
      target: browser.target,
      fields: allParameters ? [] : [item.name],
      label: allParameters ? browser.layerName : item.label,
      allParameters,
      resetDefault,
    }
  }
  handleClearKeysAction(id, options) {
    if (id === 'time_step' || id === 'media' || id === 'layer_edit') return this.closeClearKeys()
    if (id === 'field') return this.browseClearKeys(Number(options.direction))
    // Other dials are intentionally inert while choosing deletion targets.
  }
  acceptPlaybackMode(mode) {
    const command = { play: 'play', 'play to end of section': 'playsection', 'loop section': 'playloopsection' }[String(mode).toLowerCase()]
    if (command) this.lastPlaybackMode = command
  }
  get timeEntryLabel() {
    if (this.timeEntryError) return this.timeEntryError
    return (this.timeEntryDigits || '').padStart(8, '0').match(/.{2}/g).join(':')
  }
  async enterTime(key) {
    key = String(key)
    this.local()
    if (key === 'clear') {
      this.timeEntryDigits = ''
      this.timeEntryError = ''
      this.timeEntryTrackUid = null
      return
    }
    if (key === 'back') {
      this.timeEntryDigits = (this.timeEntryDigits || '').slice(0, -1)
      this.timeEntryError = ''
      return
    }
    if (/^\d$/.test(key)) {
      this.requireReady()
      if (this.timeEntryTrackUid !== this.snapshot.trackUid) this.timeEntryDigits = ''
      this.timeEntryTrackUid = this.snapshot.trackUid
      // Shift a bounded timecode register, including explicit leading zeros.
      // Never freeze input after eight digits: further keys replace the oldest.
      this.timeEntryDigits = ((this.timeEntryDigits || '') + key).slice(-8)
      this.timeEntryError = ''
      return
    }
    if (key !== 'go') throw new Error('Invalid time keypad key')
    if (!this.timeEntryDigits) return
    this.requireReady()
    await this.refresh({ preserve: true })
    if (this.timeEntryTrackUid !== this.snapshot.trackUid) {
      this.timeEntryError = 'TRACK\nCHANGED'
      return
    }
    this.timeEntryError = ''
    const label = this.timeEntryLabel
    const [, minutes, seconds, frames] = label.split(':').map(Number)
    if (minutes > 59 || seconds > 59 || frames >= Math.round(this.snapshot.fps || 25)) {
      this.timeEntryError = 'INVALID\nTIME'
      return
    }
    const trackUid = this.snapshot.trackUid
    const result = await this.remote(() => this.client.execute('resolve_timecode', { ...this.context(), label }))
    if (!Number.isFinite(result.time)) {
      this.timeEntryError = 'TIME NOT\nON TRACK'
      return
    }
    const jump = await this.seekFromViewer({ trackUid, time: result.time })
    if (jump.ok) this.timeEntryDigits = ''
    else this.timeEntryError = 'TRACK\nCHANGED'
  }
  async editSection(operation) {
    this.requireReady()
    if (!['cut', 'merge'].includes(operation)) throw new Error('Invalid section operation')
    const result = await this.remote(() => this.client.execute('section_edit', {
      ...this.context(), operation, time: this.time,
    }))
    this.stale = true
    await this.refresh({ preserve: true })
    return result
  }
  async controlTransport(operation) {
    this.requireReady()
    const context = {trackUid:this.snapshot.trackUid,transportUid:this.snapshot.transportUid}
    const result = await this.remote(() => this.client.transport(context,operation,this.lastPlaybackMode))
    if (['play','playsection','playloopsection'].includes(result.command)) this.lastPlaybackMode=result.command
    this.playing=result.playing
    this.pendingJump=null
    this.navigationTime=null
    if (this.linkTime && ['gotonextsection','gotoprevsection'].includes(operation)) {
      this.moveKey=null;this.selectedKeyTime=null;this.layerEdit=''
      this.mediaMode=false;this.mediaAll=[]
    }
  }
  async togglePlayback() {
    this.requireReady()
    this.navigationTime = null
    this.pendingJump = null
    if (!this.moveKey) this.selectedKeyTime = null
    await this.remote(async () => {
      this.playing = (await this.client.togglePlayback(this.context())).playing
      if (this.playing) this.lastPlaybackMode = 'playsection'
    })
  }
  select(kind, direction) {
    this.local()
    this.requireReady()
    if (this.moveKey && (kind === 'layer' || kind === 'field')) return
    if (direction !== -1 && direction !== 1) throw new Error('Direction must be -1 or 1')
    if (kind === 'layer') {
      this.viewerPinnedLayerUid = null
      const list = this.activeLayers
      const current = list.indexOf(this.layer)
      this.designerLayerUid = null
      const index =
        current < 0
          ? direction > 0
            ? 0
            : list.length - 1
          : (current + direction + list.length) % list.length
      this.layerIndex = list.length ? this.snapshot.layers.indexOf(list[index]) : -1
      this.selectDefaultParameter()
      this.mediaAll = []
      this.mediaFieldIndex = 0
      this.lastMediaField = null
    } else if (kind === 'field') {
      const count = this.layer?.fields.length ?? 0
      this.fieldIndex = count ? Math.max(0, Math.min(count - 1, this.fieldIndex + direction)) : 0
    } else throw new Error('Unknown selector')
    this.loadValue()
  }
  adjustValue(delta) {
    this.local()
    this.requireField()
    this.value = number(Number((this.value + number(delta)).toPrecision(12)))
    this.dirty = true
  }
  adjustTime(delta) {
    this.local()
    this.requireReady()
    this.time = Math.max(0, number(this.time + number(delta)))
  }
  key(direction) {
    this.local()
    this.requireField()
    const start = this.layer.start ?? 0,
      end = this.layer.end ?? this.snapshot.length
    const keys = this.field.keys
      .filter((k) => k.time >= start && k.time <= end)
      .sort((a, b) => a.time - b.time)
    const key =
      direction < 0
        ? keys.filter((k) => k.time < this.time - 1e-5).at(-1)
        : keys.find((k) => k.time > this.time + 1e-5)
    const lastVisible = Math.max(start, end - 1 / this.snapshot.fps)
    this.time = Math.max(start, Math.min(end, key?.time ?? (direction < 0 ? start : lastVisible)))
    this.selectedKeyTime = key?.time ?? null
    this.loadValue()
    if (key) this.value = key.value // Local preview only; live navigation reads Designer.
  }
  context() {
    this.requireReady()
    if (this.stale) throw new Error('Connection or track changed. Refresh before sending edits.')
    return { trackUid: this.snapshot.trackUid, transportUid: this.snapshot.transportUid, time: this.time, ...(!this.linkTime ? {editTime:this.time,editTrackUid:this.snapshot.trackUid} : {}), ...(this.keepEditPlayhead ? {keepPlayhead:true} : {}) }
  }
  async seek() {
    return this.remote(() => this.client.execute('seek', this.context()))
  }
  async write(command) {
    this.requireField()
    if (!['key_set', 'constant_set', 'key_delete'].includes(command)) throw new Error('Unknown write command')
    const args = { ...this.context(), layerUid: this.layer.uid, field: this.field.name, value: this.value }
    return this.remote(async () => {
      const result = await this.client.execute(command, args)
      if (!result || !Array.isArray(result.keys))
        throw new Error('Invalid write response; refresh before retrying')
      for (const key of result.keys) {
        number(key.time)
        number(key.value)
      }
      this.field.keys = result.keys
      this.field.sequenced = result.sequenced
      if (command !== 'key_delete') this.field.value = this.value
      this.dirty = false
    })
  }
}
module.exports = { Editor, number, validateSnapshot }
