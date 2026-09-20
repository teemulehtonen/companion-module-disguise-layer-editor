'use strict'
const { makeScript } = require('./designer-script')
const { orderLayerParameters } = require('./parameter-order')
const { paths, requireSuccess, decodeExecution } = require('./designer-api')

/** HTTP boundary: validate responses here; editing policy belongs to Editor.
 * A shared abort signal cancels in-flight work when Companion replaces the
 * connection. Writes are never retried automatically (a retry could add a key).
 */
class DesignerClient {
  constructor(host, port, fetchImpl = fetch) {
    if (!/^[a-zA-Z0-9.-]+$/.test(host || '')) throw new Error('Enter a Designer IP address or hostname')
    if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)
      throw new Error('Invalid HTTP port')
    this.baseUrl = `http://${host}:${Number(port)}`
    this.url = this.baseUrl + paths.execute
    this.fetch = fetchImpl
    this.controller = new AbortController()
  }
  close() {
    this.controller.abort()
  }
  async thumbnail(uid) {
    if (!/^[0-9]+$/.test(uid)) return ''
    const response = await this.fetch(this.baseUrl + paths.thumbnail(uid), {
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return ''
    return bytes.toString('base64')
  }
  async probe() {
    const response = await this.fetch(this.baseUrl + paths.transports, {
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) throw new Error(`Designer HTTP ${response.status} (transport API)`)
    const body = await response.json()
    if (body.status?.code !== 0 || !Array.isArray(body.result))
      throw new Error(body.status?.message || 'Invalid Designer transport response')
    return body.result
  }
  async execute(command, args) {
    const response = await this.fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: makeScript(command, args) }),
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) {
      let details = ''
      try {
        const error = await response.json()
        details = error.status?.message || error.message || JSON.stringify(error)
      } catch {}
      throw new Error(`Designer HTTP ${response.status}${details ? ': ' + details.slice(0, 1500) : ''}`)
    }
    const body = await response.json()
    const result = decodeExecution(body)
    if (command === 'viewer_snapshot') result.layers.forEach(orderLayerParameters)
    return result
  }
  async annotations(uid) {
    const response = await this.fetch(this.baseUrl + paths.annotations(uid), {
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) throw new Error('Annotations unavailable')
    const body = requireSuccess(await response.json())
    if (String(body.result?.uid) !== uid) throw new Error('Annotation track mismatch')
    return body.result.annotations
  }
  async transport(context, operation, lastMode = 'playsection') {
    if (!['play','playsection','playloopsection','stop','toggle','gotonextsection','gotoprevsection'].includes(operation)) throw new Error('Invalid transport operation')
    const state = await this.execute('playback_state', context)
    const command = operation === 'toggle' ? (state.playing ? 'stop' : lastMode) : operation
    const section = command === 'gotonextsection' || command === 'gotoprevsection'
    const response = await this.fetch(this.baseUrl + paths.transport(command), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({transports:[section ? {transport:{uid:context.transportUid}} : {uid:context.transportUid}]}),
      signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(5000)]),
    })
    if (!response.ok) throw new Error('Designer HTTP '+response.status+' ('+command+')')
    requireSuccess(await response.json(),'Transport command failed')
    return {playing:section ? state.playing : command !== 'stop',command}
  }
  async togglePlayback(context) {
    const state = await this.execute('playback_state', context)
    const endpoint = state.playing ? 'stop' : 'playsection'
    const response = await this.fetch(this.baseUrl + paths.playback(state.playing), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transports: [{ uid: context.transportUid }] }),
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) throw new Error(`Designer HTTP ${response.status} (${endpoint})`)
    const result = await response.json()
    requireSuccess(result, 'Playback command failed')
    return { playing: !state.playing }
  }
}
module.exports = { DesignerClient }
