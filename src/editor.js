'use strict'

// Shared order for the time encoder and layer timing controls. Frame uses the
// current transport FPS; the remaining steps are expressed in seconds.
const TIME_STEPS = ['frame', 'second', 'two', 'five', 'ten', 'minute']
const TIME_STEP_SECONDS = { frame: 1, second: 1, two: 2, five: 5, ten: 10, minute: 60 }
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
    this.snapshot = null
    this.layerIndex = 0
    this.fieldIndex = 0
    this.time = 0
    this.value = 0
    this.dirty = false
    this.precision = 'coarse'
    this.busy = false
    this.timeStep = 'frame'
    this.moveKey = null
    this.layerEdit = ''
    this.selectedKeyTime = null
    this.navigationTime = null
    this.pendingJump = null
    this.mediaMode = false
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
    const active = timeline.layers.filter(
      (l) => (l.start ?? 0) <= timeline.time + 1e-7 && (l.end ?? Infinity) >= timeline.time - 1e-7,
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
      this.stale = true
      return // Reload only when layers at the playhead change (or the selected layer is deleted).
    }
    this.followTime(timeline.time)
    if (timeline.timecodeSamples) this.acceptTimecodes(timeline)
    if (timeline.timecodeSample) this.liveTimecodeSample = timeline.timecodeSample
    this.followDesignerSelection(timeline)
  }
  followDesignerSelection(state) {
    // Follow selection changes, not the same selection on every poll: otherwise
    // Designer would immediately override a layer chosen with the encoder.
    if (this.moveKey) return
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
    this.layerIndex = this.snapshot.layers.findIndex((l) => l.uid === uid)
    this.layerEdit = ''
    this.mediaMode = false
    this.mediaAll = []
    this.mediaFieldIndex = 0
    this.selectDefaultParameter()
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
      const next = validateSnapshot(await this.client.execute('refresh'))
      const keep = preserve && next.trackUid === trackUid && next.transportUid === transportUid
      this.snapshot = next
      this.timecodeSamples = next.timecodeSamples
      this.liveTimecodeSample = null
      if (!keep) {
        this.designerSelectionKey = null
        this.designerSelectionIds = []
        this.designerLayerUid = null
      }
      this.stale = false
      this.activeLayerSignature = next.layers
        .filter((l) => (l.start ?? 0) <= next.time + 1e-7 && (l.end ?? Infinity) >= next.time - 1e-7)
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
      this.time = next.time
      if (keep && this.layer?.uid === layerUid && this.field?.name === fieldName) {
        const keys = this.field?.keys || []
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
        this.followTime(next.time, true)
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
      this.followTime(next.time, true)
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
    const choice = this.field?.choices?.find((c) => c.value === this.value)
    if (choice) return choice.label
    if (this.field?.integer) return String(Math.round(this.value))
    const decimals = { coarse: 1, fine: 2, ultra: 3 }[this.precision] ?? 1
    return Number(this.value.toFixed(decimals)).toFixed(decimals)
  }
  get timeStepLabel() {
    return { frame: '1 FRAME', second: '1 SEC', two: '2 SEC', five: '5 SEC', ten: '10 SEC', minute: '1 MIN' }[
      this.timeStep
    ]
  }
  cycleTimeStep() {
    if (this.layerEdit) {
      this.layerEdit = ''
      this.followTime(this.time)
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
      live: true,
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
      this.timecodeSamples = result.timecodeSamples
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
  async adjustLiveValue(direction, step = 0) {
    if (!this.field) return
    this.requireField()
    await this.remote(async () =>
      this.acceptLive(
        await this.client.execute('adjust_value', {
          ...this.liveArgs(),
          direction,
          step,
          fine: this.fine,
          precision: this.precision,
        }),
      ),
    )
    if (this.moveKey && this.selectedKey) this.moveKey = { ...this.selectedKey }
  }
  async adjustLiveTime(direction, stepOverride) {
    this.requireReady()
    const cursor = this.pendingJump && Date.now() < this.pendingJump.until ? this.pendingJump.time : undefined
    this.navigationTime = null
    this.pendingJump = null
    const frames = !stepOverride && this.timeStep === 'frame'
    const delta = number(direction) * (stepOverride || TIME_STEP_SECONDS[this.timeStep])
    if (this.layerEdit) {
      await this.remote(async () => {
        const result = await this.client.execute('layer_edit', {
          ...this.liveArgs(),
          delta,
          frames,
          cursor,
          mode: this.layerEdit,
          expectedStart: this.layer.start,
          expectedEnd: this.layer.end,
        })
        Object.assign(this.layer, result.layer)
        this.selectedKeyTime = null
        this.pendingJump = { time: result.time, until: Date.now() + 1500 }
        this.acceptLive(result)
      })
      return
    }
    await this.remote(async () => {
      const result = await this.client.execute(this.moveKey ? 'key_move' : 'nudge_time', {
        ...this.liveArgs(),
        delta,
        frames,
        cursor,
        sourceTime: this.moveKey?.time,
        expectedKey: this.moveKey,
      })
      this.pendingJump = { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
      if (this.moveKey) {
        this.moveKey = { ...this.field.keys.find((k) => Math.abs(k.time - this.time) < 1e-5) }
        this.selectedKeyTime = this.moveKey.time
      } else {
        this.selectedKeyTime = null
        this.followTime(this.time, true)
        this.loadValue()
      }
    })
  }
  async keyLive(direction) {
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
        this.pendingJump = { time: result.time, until: Date.now() + 1500 }
      }
      this.acceptLive(result)
    })
    this.loadValue()
  }
  async toggleMoveKey() {
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
      const result = await this.client.execute('select_key', this.liveArgs())
      if (!result.selectedKey) {
        this.acceptLive(result)
        return
      }
      this.selectedKeyTime = result.selectedKey.time
      this.moveKey = result.selectedKey
      this.navigationTime = result.time
      this.pendingJump = { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
    })
  }
  async cycleKeyType() {
    if (!this.canSelectKey) return
    this.requireField()
    await this.remote(async () =>
      this.acceptLive(
        await this.client.execute('key_type', { ...this.liveArgs(), sourceTime: this.selectedKey?.time }),
      ),
    )
    if (this.moveKey && this.selectedKey) this.moveKey = { ...this.selectedKey }
  }
  async writeLive(command) {
    this.requireField()
    // Some Designer settings (for example Web dimensions) are constants by
    // design. Pressing the value dial must not send an impossible key write.
    if (command === 'key_set' && this.field.canAnimate === false) return
    this.moveKey = null
    this.navigationTime = null
    this.pendingJump = null
    await this.remote(async () => {
      this.acceptLive(await this.client.execute('read_field', this.liveArgs()))
      const result = await this.client.execute(command, { ...this.liveArgs(), value: this.field.value })
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
    if (this.layerEdit === 'edit') return this.cycleLayerStep()
    if (this.mediaMode) {
      if (!this.currentMedia) return
      await this.setMedia(this.mediaIndex)
      this.mediaMode = false
      this.selectDefaultParameter()
      return
    }
    if (this.field) return this.writeLive('key_set')
  }
  get mediaField() {
    return this.layer?.mediaFields?.[this.mediaFieldIndex]
  }
  toggleLayerEditor() {
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
    const steps = TIME_STEPS
    this.timeStep = steps[(steps.indexOf(this.timeStep) + 1) % steps.length]
  }
  async adjustLayerTiming(mode, direction) {
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
        delta: direction * TIME_STEP_SECONDS[this.timeStep],
        frames: this.timeStep === 'frame',
        expectedStart: this.layer.start,
        expectedEnd: this.layer.end,
      })
      Object.assign(this.layer, result.layer)
      this.selectedKeyTime = null
      this.pendingJump = { time: result.time, until: Date.now() + 1500 }
      this.acceptLive(result)
    })
  }
  async fitLayerToContent() {
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
      this.pendingJump = { time: result.time, until: Date.now() + 1500 }
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
    this.moveKey = null
    if (this.mediaMode) await this.loadMedia()
    else this.selectDefaultParameter()
  }
  async loadMedia({ preserve = false } = {}) {
    const previousFolder = this.mediaFolder,
      previousUid = this.currentMedia?.uid
    if (!this.mediaField) this.mediaFieldIndex = 0
    if (!this.mediaField) return
    await this.remote(async () => {
      const result = await this.client.execute('media_list', {
        ...this.liveArgs(),
        field: this.mediaField.name,
      })
      this.mediaAll = result.media.map((m) => ({
        ...m,
        folder: m.folder || m.path.split('/').slice(2, -1).join('/') || '/',
      }))
      this.mediaFolder =
        preserve && this.mediaFolders.includes(previousFolder)
          ? previousFolder
          : (this.mediaAll.find((m) => m.uid === result.selectedUid)?.folder ?? this.mediaFolders[0] ?? '')
      this.mediaIndex = this.mediaItems.findIndex((m) => m.uid === result.selectedUid)
      if (preserve && this.mediaIndex < 0)
        this.mediaIndex = this.mediaItems.findIndex((m) => m.uid === previousUid)
      this.mediaPage = Math.floor(Math.max(0, this.mediaIndex) / 8)
    })
  }
  async selectMediaField(direction) {
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
      await this.client.execute('media_set', {
        ...this.liveArgs(),
        field: this.mediaField.name,
        mediaUid: item.uid,
      })
      this.mediaIndex = index
      this.mediaPage = Math.floor(index / 8)
    })
  }
  async browseMedia(direction) {
    if (!this.mediaItems.length) return
    this.mediaIndex = Math.max(0, Math.min(this.mediaItems.length - 1, this.mediaIndex + direction))
    this.mediaPage = Math.floor(this.mediaIndex / 8)
  }
  async pressPad(slot) {
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
      () => this.togglePlayback(),
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
    if (slot === 5 && !this.layer) return
    if (slot !== 5 || this.mediaMode || this.clearKeysPrompt || this.clearKeysBrowser)
      return this.pressPad(slot)
    // Defer single deletion until release so a hold never deletes a key first.
    this.deletePress = { time: now, target: this.deletionTarget(), resetDefault: this.canResetDefault }
  }
  async padUp(slot, now = Date.now()) {
    if (slot !== 5 || !this.deletePress) return
    const press = this.deletePress
    this.deletePress = null
    if (this.mediaMode || JSON.stringify(press.target) !== JSON.stringify(this.deletionTarget()))
      throw new Error('Selection changed; deletion cancelled')
    if (now - press.time >= 1000) {
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
  async togglePlayback() {
    this.requireReady()
    this.navigationTime = null
    this.pendingJump = null
    if (!this.moveKey) this.selectedKeyTime = null
    await this.remote(async () => {
      this.playing = (await this.client.togglePlayback(this.context())).playing
    })
  }
  select(kind, direction) {
    this.local()
    this.requireReady()
    if (this.moveKey && (kind === 'layer' || kind === 'field')) return
    if (direction !== -1 && direction !== 1) throw new Error('Direction must be -1 or 1')
    if (kind === 'layer') {
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
    return { trackUid: this.snapshot.trackUid, transportUid: this.snapshot.transportUid, time: this.time }
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
