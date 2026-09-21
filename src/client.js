'use strict'
const { makeScript } = require('./designer-script')
const { orderLayerParameters } = require('./parameter-order')
const { paths, requireSuccess, decodeExecution } = require('./designer-api')
const { WaveformDiskCache } = require('./waveform-disk-cache')

/** HTTP boundary: validate responses and enforce the shared VIEW write lock.
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
    this.mediaDisk = new WaveformDiskCache()
    this.thumbnailTasks = new Set()
  }
  close() {
    this.controller.abort()
  }
  async thumbnail(uid) {
    const task = this.loadThumbnail(uid)
    this.thumbnailTasks.add(task)
    try { return await task }
    finally { this.thumbnailTasks.delete(task) }
  }
  async loadThumbnail(uid) {
    if (!/^[0-9]+$/.test(uid)) return ''
    let diskKey
    try {
      const identity = await this.execute('thumbnail_identity', { uid })
      if (identity?.revision) {
        diskKey = this.mediaDisk.key(['thumbnail-v1', this.baseUrl, uid, identity.revision])
        const saved = await this.mediaDisk.read(diskKey)
        this.controller.signal.throwIfAborted()
        if (saved?.kind === 'thumbnail') return saved.png
      }
    } catch {
      this.controller.signal.throwIfAborted()
      // Unknown/internal resource types still use the native thumbnail endpoint.
    }
    const response = await this.fetch(this.baseUrl + paths.thumbnail(uid), {
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return ''
    this.controller.signal.throwIfAborted()
    const png = bytes.toString('base64')
    if (diskKey) await this.mediaDisk.write(diskKey, { kind: 'thumbnail', png })
    return png
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
  assertWritable() {
    if (this.viewOnly) {
      const error = new Error('VIEW ONLY')
      error.code = 'VIEW_ONLY'
      throw error
    }
  }
  async execute(command, args = {}) {
    // Fail closed: new native operations must explicitly be audited as reads.
    const reads = ['refresh','resolve_timecode','live_state','playback_state','read_field',
      'media_list','key_clear_list','viewer_snapshot','viewer_audio_source','thumbnail_identity']
    const localSeek = ['seek','nudge_time','jump_key'].includes(command) && args.keepPlayhead === true
    if (!reads.includes(command) && !localSeek) this.assertWritable()
    // makeScript merges args into its command payload; never allow an override.
    if (Object.hasOwn(args, 'command')) throw new Error('Invalid command arguments')
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
      const error = new Error(`Designer HTTP ${response.status}${details ? ': ' + details.slice(0, 1500) : ''}`)
      if (/Transport changed\. Refresh before editing\.|Track changed\. Refresh before editing\./.test(details))
        error.code = 'CONTEXT_CHANGED'
      throw error
    }
    const body = await response.json()
    let result
    try { result = decodeExecution(body) }
    catch (error) {
      if (/Transport changed\. Refresh before editing\.|Track changed\. Refresh before editing\./.test(error.message))
        error.code = 'CONTEXT_CHANGED'
      throw error
    }
    if (result?.contextChanged && command !== 'live_state') {
      const error = new Error('Designer selection changed; synchronising')
      error.code = 'CONTEXT_CHANGED'
      error.context = result
      throw error
    }
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
    this.assertWritable()
    const state = await this.execute('playback_state', context)
    this.assertWritable()
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
    this.assertWritable()
    const state = await this.execute('playback_state', context)
    this.assertWritable()
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
