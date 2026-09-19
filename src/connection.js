'use strict'
const { paths } = require('./designer-api')
const { contentProperty } = require('./live-properties')

// REST health checks never execute Python. A successful probe identifies Designer,
// rather than treating any open TCP port as a valid connection.
class Connection {
  constructor(
    client,
    onState,
    { interval = 5000, WebSocketImpl = WebSocket, enableLiveUpdate = false, onHeartbeat = () => {} } = {},
  ) {
    this.client = client
    this.onState = onState
    this.onHeartbeat = onHeartbeat
    this.interval = interval
    this.WebSocket = WebSocketImpl
    // LiveUpdate supplies fast feedback; sequential HTTP remains the recovery path.
    this.enableLiveUpdate = enableLiveUpdate
    this.closed = false
    this.connected = false
    this.live = false
    this.time = undefined
    this.ids = new Map()
    this.feedbackRevision = 0
    this.liveRevision = 0
    this.retryAt = 0
  }
  // A control action supersedes both cached feedback and an in-flight poll.
  // Otherwise a later health probe can replay the pre-write parameter state.
  invalidateFeedback() {
    this.feedbackRevision++
    if (this.enableLiveUpdate) {
      this.dropSocket()
      clearTimeout(this.resumeTimer)
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = null
        this.watch(this.transportUid, this.fieldTarget)
      }, 120)
      this.resumeTimer.unref?.()
    }
    this.timeline = undefined
    this.time = undefined
    this.fieldValue = undefined
    this.trackUid = undefined
    this.clock = undefined
  }
  start() {
    if (typeof this.client.execute === 'function') this.schedulePoll()
    return this.check()
  }
  // The timer only ends a pulse. Only a validated Designer response starts one.
  pulseHeartbeat() {
    clearTimeout(this.heartbeatTimer)
    this.heartbeat = true
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeat = false
      // Extinguishing a visual pulse must not replay old timeline/value data.
      if (!this.closed) this.onHeartbeat()
    }, 200)
    this.heartbeatTimer.unref?.()
  }
  schedulePoll() {
    // Schedule after completion, rather than setInterval, so a slow Designer
    // cannot accumulate overlapping Python requests. LiveUpdate is advisory:
    // some Designer builds acknowledge subscriptions without publishing values.
    if (this.closed) return
    this.pollTimer = setTimeout(() => this.poll(), this.live ? 1500 : 500)
    this.pollTimer.unref?.()
  }
  async poll() {
    const transport = this.transportUid,
      targetKey = this.targetKey,
      fieldTarget = this.fieldTarget,
      revision = this.feedbackRevision,
      liveRevision = this.liveRevision
    try {
      if (this.connected && transport && !this.closed) {
        const result = await this.client.execute('live_state', { transportUid: transport, fieldTarget })
        // A response can arrive after an encoder selection or configuration change.
        // Never publish the old parameter's keys into the new selection.
        if (
          this.closed ||
          this.transportUid !== transport ||
          this.targetKey !== targetKey ||
          this.feedbackRevision !== revision ||
          this.liveRevision !== liveRevision
        )
          return
        if (!Number.isFinite(result.timeline?.time) || !Array.isArray(result.timeline.layers))
          throw new Error('Invalid live state')
        this.timeline = {
          ...result.timeline,
          ...(result.timecodeSamples ? { timecodeSamples: result.timecodeSamples } : {}),
        }
        this.time = result.timeline.time
        this.trackUid = result.timeline.trackUid
        this.fieldValue = result.fieldValue
        this.clock = { fps: result.clock.fps, mode: result.clock.tcMode, custom: result.clock.customFps }
        this.polling = true
        this.pulseHeartbeat()
        this.onState(this)
      }
    } catch (error) {
      if (!this.closed) {
        this.polling = false
        this.pollError = error.message
      }
    } finally {
      this.schedulePoll()
    }
  }
  async check() {
    if (this.closed) return
    try {
      const transports = await this.client.probe()
      if (this.closed) return
      this.connected = true
      this.pulseHeartbeat()
      this.error = ''
      this.transports = transports
      this.probeRevision = (this.probeRevision || 0) + 1
      if (this.transportUid && !this.socket) this.watch(this.transportUid, this.fieldTarget)
    } catch (error) {
      if (this.closed) return
      this.connected = false
      this.heartbeat = false
      clearTimeout(this.heartbeatTimer)
      this.error = error.message
      this.dropSocket()
    }
    if (!this.closed) {
      this.onState(this)
      if (this.closed) return
      this.timer = setTimeout(() => this.check(), this.interval)
      this.timer.unref?.()
    }
  }
  watch(transportUid, fieldTarget = null) {
    if (!this.connected || this.closed) return
    if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(transportUid)) return
    const targetKey = JSON.stringify(fieldTarget)
    if (
      (this.socket || !this.enableLiveUpdate || this.resumeTimer || Date.now() < this.retryAt) &&
      this.transportUid === transportUid &&
      this.targetKey === targetKey
    )
      return
    this.dropSocket()
    this.transportUid = transportUid
    this.fieldTarget = fieldTarget
    this.targetKey = targetKey
    if (!this.enableLiveUpdate || Date.now() < this.retryAt || this.resumeTimer) return
    const fieldPath = fieldTarget
      ? `[l for l in object.track.getLeafLayers(Module) if str(l.uid) == ${JSON.stringify(fieldTarget.layerUid)}][0].findSequence(${JSON.stringify(fieldTarget.name)})`
      : null
    this.valueProperty = fieldPath
      ? `{'sequenced': not ${fieldPath}.disableSequencing, 'value': ${fieldPath}.eval(object.player.tCurrent, 16), 'keys': [{'time': object.track.beatToTime(${fieldPath}.sequence.t(i)), 'value': ${fieldPath}.sequence.key(i).v, 'interpolation': ${fieldPath}.sequence.key(i).interpolation} for i in range(${fieldPath}.sequence.nKeys())]}`
      : null
    // Read time and extents together: a seek must not use bounds cached before a Designer trim/move.
    this.timelineProperty =
      "{'time': object.track.beatToTime(object.player.tCurrent), 'timecodeSample': {'seconds': object.track.beatToTime(object.player.tCurrent), 'label': str(object.beatToTimecode(object.player.tCurrent))}, 'playing': bool(object.player.playing), 'trackUid': str(object.track.uid), 'selectedLayerUids': [str(l.uid) for l in guisystem.selectedLayers if isinstance(l, Layer)], 'layers': [{'uid': str(l.uid), 'start': object.track.beatToTime(l.tStart), 'end': object.track.beatToTime(l.tEnd)} for l in object.track.getLeafLayers(Module)]}"
    this.clockProperty =
      "{'fps': object.customFps().value_or(object.beatToTimecode(0).fps()), 'mode': {Timecode.SMPTE23976:'23.976', Timecode.SMPTE24:'24', Timecode.SMPTE25:'25', Timecode.SMPTE2997:'29.97 NDF', Timecode.SMPTE2997DF:'29.97 DF', Timecode.SMPTE30:'30'}.get(object.smpteClockType(), 'Other'), 'custom': object.customFps().value_or(0) > 0}"
    const socket = (this.socket = new this.WebSocket(
      this.client.baseUrl.replace(/^http/, 'ws') + paths.liveUpdate,
    ))
    const current = () => !this.closed && this.socket === socket
    this.socketTimer = setTimeout(() => {
      if (current() && !this.live) {
        this.retryAt = Date.now() + 30000
        this.dropSocket()
        this.liveError = 'LiveUpdate subscription timed out'
        this.onState(this)
      }
    }, 8000)
    this.socketTimer.unref?.()
    socket.addEventListener('open', () => {
      if (!current()) return
      socket.send(
        JSON.stringify({
          subscribe: {
            object: `getByUID(0x${BigInt(transportUid).toString(16)})`,
            configuration: { updateFrequencyMs: 100 },
            properties: [
              this.timelineProperty,
              this.clockProperty,
              ...(this.valueProperty ? [this.valueProperty] : []),
            ],
          },
        }),
      )
    })
    socket.addEventListener('open', () => {
      if (current())
        socket.send(
          JSON.stringify({
            subscribe: {
              object: `getByUID(0x${BigInt(transportUid).toString(16)})`,
              configuration: { updateFrequencyMs: 500 },
              properties: [contentProperty],
            },
          }),
        )
    })
    socket.addEventListener('message', (event) => {
      if (!current()) return
      try {
        const data = JSON.parse(String(event.data))
        if (data.error) throw new Error(String(data.error))
        if (Array.isArray(data.subscriptions))
          this.ids = new Map(data.subscriptions.map((s) => [s.id, s.propertyPath]))
        if (data.valuesChanged?.length) {
          this.liveRevision++
          this.pulseHeartbeat()
        }
        for (const change of data.valuesChanged || []) {
          const property = this.ids.get(change.id)
          if (property === contentProperty && typeof change.value === 'string')
            this.contentRevision = change.value
          if (
            property === this.timelineProperty &&
            Number.isFinite(change.value?.time) &&
            Array.isArray(change.value.layers)
          ) {
            this.timeline = change.value
            this.time = change.value.time
            this.trackUid = change.value.trackUid
            this.live = true
            this.liveError = ''
            clearTimeout(this.socketTimer)
          }
          if (property === 'object.track.beatToTime(object.player.tCurrent)' && Number.isFinite(change.value)) {
            this.time = change.value
            this.live = true
            this.liveError = ''
            clearTimeout(this.socketTimer)
          }
          if (property === 'str(object.track.uid)' && typeof change.value === 'string')
            this.trackUid = change.value
          if (property === this.valueProperty && Number.isFinite(change.value?.value))
            this.fieldValue = change.value
          if (property === this.clockProperty && Number.isFinite(change.value?.fps)) this.clock = change.value
        }
        this.onState(this)
      } catch (error) {
        this.liveError = error.message
        this.retryAt = Date.now() + 30000
        this.dropSocket()
        this.onState(this)
      }
    })
    const lost = () => {
      if (!current()) return
      this.retryAt = Date.now() + 30000
      this.dropSocket()
      this.liveError = 'LiveUpdate disconnected; retrying on next health check'
      this.onState(this)
    }
    socket.addEventListener('close', lost)
    socket.addEventListener('error', lost)
  }
  dropSocket() {
    const socket = this.socket
    this.socket = null
    this.live = false
    this.time = undefined
    this.timeline = undefined
    this.trackUid = undefined
    this.fieldValue = undefined
    this.clock = undefined
    this.ids.clear()
    clearTimeout(this.socketTimer)
    if (socket) socket.close()
  }
  close() {
    this.closed = true
    clearTimeout(this.timer)
    clearTimeout(this.resumeTimer)
    clearTimeout(this.pollTimer)
    clearTimeout(this.heartbeatTimer)
    this.heartbeat = false
    this.dropSocket()
  }
}
module.exports = { Connection }
