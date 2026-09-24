'use strict'

const { paths } = require('./designer-api')
// Use the selected transport monitor, including session-forwarded TC.
// A local receiver may read zero on actors/editors following the director.
const externalProperty = "[str(object.monitorString), str(object.tcStatusString)] if object.timecode is not None else None"
const property =
  '[str(object.track.uid), object.track.beatToTime(object.player.tCurrent), str(object.beatToTimecode(object.player.tCurrent)), object.player.tCurrent, bool(object.track.quant), [object.track.bpmAt(object.player.tCurrent), object.track.beatToTime(1), object.track.beatToTime(16), object.track.lengthInBeats, object.track.lengthInSec], bool(object.player.playing)]'

// A small, atomic LiveUpdate subscription for display only. Editing continues
// to use the coherent HTTP snapshot (time, layer bounds and selected field).
class ViewerClock {
  constructor(client, WebSocketImpl = WebSocket) {
    this.client = client
    this.WebSocket = WebSocketImpl
    this.retryAt = 0
  }
  read(context) {
    const {clockSeek,clockFps=25,...visible}=context
    context=visible
    // This display subscription is independent of the editor subscription.
    // Discard cached pre-command samples and fence delayed ones until the seek
    // reaches Designer (or the bounded editor timeout releases the fence).
    const revision=context.editRevision || 0
    if(revision!==this.editRevision){this.sample=null;this.editRevision=revision}

    const uid = context.transportUid
    if (!this.closed && context.connected && !context.synchronizing && /^\d+$/.test(uid || '')) {
      if (uid !== this.uid) {
        this.stop()
        this.uid = uid
        this.retryAt = 0
      }
      if (!this.socket && Date.now() >= this.retryAt) this.connect(uid)
    } else this.stop()
    // A stalled socket must never override fresh HTTP feedback indefinitely.
    context = { ...context, externalTimecode: Date.now() - this.externalReceived < 2000 ? this.externalTimecode : undefined }
    const waiting=clockSeek && Date.now()<clockSeek.until && (!this.sample || Math.abs(this.sample.time-clockSeek.time)>0.51/clockFps)
    return !waiting && this.sample?.trackUid === context.trackUid && Date.now() - this.received < 2000
      ? { ...context, time: this.sample.time, timecode: this.sample.timecode, ...(typeof this.sample.playing === 'boolean' ? {playing:this.sample.playing} : {}), ...(Number.isFinite(this.sample.beat) ? { beat: this.sample.beat, quantized: this.sample.quantized, tempoKey: this.sample.tempoKey } : {}) }
      : context
  }
  connect(uid) {
    this.retryAt = Date.now() + 30000
    let socket
    try {
      socket = this.socket = new this.WebSocket(this.client.baseUrl.replace(/^http/, 'ws') + paths.liveUpdate)
    } catch {
      return
    }
    const current = () => !this.closed && this.socket === socket
    const lost = () => {
      if (current()) this.stop()
    }
    this.timer = setTimeout(lost, 5000)
    this.timer.unref?.()
    socket.addEventListener('open', () => {
      if (current())
        socket.send(
          JSON.stringify({
            subscribe: {
              object: `getByUID(0x${BigInt(uid).toString(16)})`,
              configuration: { updateFrequencyMs: 40 },
              properties: [property, externalProperty],
            },
          }),
        )
    })
    socket.addEventListener('message', (event) => {
      if (!current()) return
      try {
        const message = JSON.parse(String(event.data))
        if (message.error) return lost()
        if (message.subscriptions) {
          this.id = message.subscriptions.find((s) => s.propertyPath === property)?.id
          this.externalId = message.subscriptions.find((s) => s.propertyPath === externalProperty)?.id
        }
        for (const change of message.valuesChanged || []) {
          if (this.externalId !== undefined && change.id === this.externalId) {
            const value = change.value
            this.externalTimecode = Array.isArray(value) && typeof value[0] === 'string'
              ? { value: value[0].replace(/[.;](\d+)$/, ':$1'), status: String(value[1] || '') } : null
            this.externalReceived = Date.now()
            continue
          }
          if (this.id === undefined || change.id !== this.id) continue
          const value = change.value
          if (
            !Array.isArray(value) ||
            !/^\d+$/.test(value[0]) ||
            !Number.isFinite(value[1]) ||
            typeof value[2] !== 'string'
          )
            return lost()
          this.sample = {
            trackUid: value[0],
            beat: value[3],
            tempoKey: JSON.stringify(value[5] || null),
            quantized: value[4] === true,
            time: value[1],
            timecode: value[2].replace(/[.;](\d+)$/, ':$1'),
            ...(typeof value[6] === 'boolean' ? { playing: value[6] } : {}),
          }
          this.received = Date.now()
          clearTimeout(this.timer)
        }
      } catch {
        lost()
      }
    })
    socket.addEventListener('error', lost)
    socket.addEventListener('close', lost)
  }
  stop() {
    const socket = this.socket
    this.socket = null
    this.sample = null
    this.id = undefined
    this.externalId = undefined
    this.externalTimecode = undefined
    this.externalReceived = 0
    clearTimeout(this.timer)
    socket?.close()
  }
  close() {
    this.closed = true
    this.stop()
  }
}
module.exports = { ViewerClock }
