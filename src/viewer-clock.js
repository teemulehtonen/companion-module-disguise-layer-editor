'use strict'

const { paths } = require('./designer-api')
const property =
  '[str(object.track.uid), object.player.tCurrent, str(object.beatToTimecode(object.track.timeToBeat(object.player.tCurrent)))]'

// A small, atomic LiveUpdate subscription for display only. Editing continues
// to use the coherent HTTP snapshot (time, layer bounds and selected field).
class ViewerClock {
  constructor(client, WebSocketImpl = WebSocket) {
    this.client = client
    this.WebSocket = WebSocketImpl
    this.retryAt = 0
  }
  read(context) {
    const uid = context.transportUid
    if (!this.closed && context.connected && /^\d+$/.test(uid || '')) {
      if (uid !== this.uid) {
        this.stop()
        this.uid = uid
        this.retryAt = 0
      }
      if (!this.socket && Date.now() >= this.retryAt) this.connect(uid)
    } else this.stop()
    // A stalled socket must never override fresh HTTP feedback indefinitely.
    return this.sample?.trackUid === context.trackUid && Date.now() - this.received < 2000
      ? { ...context, time: this.sample.time, timecode: this.sample.timecode }
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
              configuration: { updateFrequencyMs: 100 },
              properties: [property],
            },
          }),
        )
    })
    socket.addEventListener('message', (event) => {
      if (!current()) return
      try {
        const message = JSON.parse(String(event.data))
        if (message.error) return lost()
        if (message.subscriptions)
          this.id = message.subscriptions.find((s) => s.propertyPath === property)?.id
        for (const change of message.valuesChanged || []) {
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
            time: value[1],
            timecode: value[2].replace(/[.;](\d+)$/, ':$1'),
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
    clearTimeout(this.timer)
    socket?.close()
  }
  close() {
    this.closed = true
    this.stop()
  }
}
module.exports = { ViewerClock }
