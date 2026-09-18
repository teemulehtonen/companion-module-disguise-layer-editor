'use strict'
const { makeScript } = require('./designer-script')

/** HTTP boundary: validate responses here; editing policy belongs to Editor.
 * A shared abort signal cancels in-flight work when Companion replaces the
 * connection. Writes are never retried automatically (a retry could add a key).
 */
class DesignerClient {
  constructor(host, port, fetchImpl = fetch) {
    if (!/^[a-zA-Z0-9.-]+$/.test(host || '')) throw new Error('Enter a Designer IP address or hostname')
    if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)
      throw new Error('Invalid HTTP port')
    this.url = `http://${host}:${Number(port)}/api/session/python/execute`
    this.baseUrl = `http://${host}:${Number(port)}`
    this.fetch = fetchImpl
    this.controller = new AbortController()
  }
  close() {
    this.controller.abort()
  }
  async thumbnail(uid) {
    if (!/^[0-9]+$/.test(uid)) return ''
    const response = await this.fetch(`${this.baseUrl}/api/v1/thumbnail/${uid}?width=160&height=90`, {
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return ''
    return bytes.toString('base64')
  }
  async probe() {
    const response = await this.fetch(`${this.baseUrl}/api/session/transport/activetransport`, {
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
    if (!body.status || body.status.code !== 0)
      throw new Error(body.status?.message || 'Invalid Designer API response')
    try {
      return typeof body.returnValue === 'string' ? JSON.parse(body.returnValue) : body.returnValue
    } catch {
      throw new Error('Designer returned invalid JSON')
    }
  }
  async togglePlayback(context) {
    const state = await this.execute('playback_state', context)
    const endpoint = state.playing ? 'stop' : 'playsection'
    const response = await this.fetch(`${this.baseUrl}/api/session/transport/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transports: [{ uid: context.transportUid }] }),
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) throw new Error(`Designer HTTP ${response.status} (${endpoint})`)
    const result = await response.json()
    if (result.status?.code !== 0) throw new Error(result.status?.message || 'Playback command failed')
    return { playing: !state.playing }
  }
}
module.exports = { DesignerClient }
