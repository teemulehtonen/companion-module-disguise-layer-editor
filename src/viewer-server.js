'use strict'

const http = require('node:http')
const { ViewerClock } = require('./viewer-clock')
const { isIP } = require('node:net')
const { hostname } = require('node:os')
const { randomBytes } = require('node:crypto')
const { page, browserScript, stylesheet } = require('./viewer-page')
const { visibleParameters, alignmentGuides, summariseGroups, renderRevision } = require('./viewer-model')
const { layerTypeLabel } = require('./layer-types')
const { WaveformCache } = require('./viewer-waveform')

// Data reads and a narrowly validated selection route. No route accepts value
// edits, seeks, paths, Python, or arbitrary resource IDs. Browsers share refreshes.
class ViewerServer {
  constructor(client, context, options = {}) {
    this.client = client
    this.clock = new ViewerClock(client)
    this.context = () => this.clock.read(context())
    this.options = options
    this.cache = null
    this.pending = null
    this.updated = 0
    this.thumbnails = new Map()
    this.allowedThumbnails = new Set()
    this.waveforms = new WaveformCache(client, options)
    this.selectionToken = randomBytes(24).toString('hex')
  }
  async start(port = 8765, lan = false) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid viewer port')
    this.server = http.createServer((req, res) => void this.handle(req, res))
    this.server.requestTimeout = 10000
    this.server.headersTimeout = 10000
    await new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', resolve)
    })
    return this.server.address().port
  }
  async close() {
    this.closed = true
    this.clock.close()
    this.waveforms.close()
    this.server?.closeAllConnections()
    if (this.server?.listening) await new Promise((resolve) => this.server.close(resolve))
    this.thumbnails.clear()
  }
  async state(query) {
    const context = this.context()
    const start = Number(query.get('start') || 0)
    const end = query.has('end') ? Number(query.get('end')) : undefined
    if (
      !Number.isFinite(start) ||
      start < 0 ||
      (end !== undefined && (!Number.isFinite(end) || end <= start))
    )
      throw new Error('Invalid view range')
    const width = Math.max(320, Math.min(3840, Number(query.get('width')) || 1200))
    const waveformLayers = new Set(
      (query.get('waveforms') || '')
        .split(',')
        .filter((uid) => /^\d+$/.test(uid))
        .slice(0, 32),
    )
    const expanded = (query.get('expanded') || '').split(',').filter(uid => /^\d+$/.test(uid)).slice(0,16)
    const signature = JSON.stringify([
      expanded,
      context.trackUid,
      context.focusUid,
      context.contentRevision,
      context.tempoKey,
      start,
      end,
      width,
      [...waveformLayers],
    ])
    if (!this.cache || signature !== this.signature || Date.now() - this.updated >= 1500) {
      if (this.pending) await this.pending
      if (!this.cache || signature !== this.signature || Date.now() - this.updated >= 1500) {
        this.pending = (async () => {
          const data = await this.client.execute('viewer_snapshot', {
            focusUid: context.focusUid,
            expanded,
            width,
            viewStart: start,
            ...(end === undefined ? {} : { viewEnd: end }),
          })
          try {
            data.annotations = await this.client.annotations(data.trackUid)
          } catch {
            data.annotations = {}
            data.warnings.push('Track annotations unavailable')
          }
          data.focusUid = context.trackUid === data.trackUid ? context.focusUid : null
          this.waveforms.retain(
            new Set([
              ...data.layers.filter((l) => l.resources?.some((f) => f.current?.audio)).map((l) => l.uid),
              ...(data.trackAudio ? ['track:' + data.trackUid] : []),
            ]),
          )
          summariseGroups(data.layers)
          for (const layer of data.layers) {
            layer.typeLabel = layerTypeLabel(layer.moduleType)
            layer.visibleParameters = visibleParameters(layer, this.options.showAll === true)
            layer.allParameters = visibleParameters(layer, true)
            if (waveformLayers.has(layer.uid)) {
              const audio = layer.resources.find((field) => field.current?.audio)?.current
              if (audio)
                layer.waveform = { ...(await this.waveforms.get(audio.uid, layer.uid)), name: audio.name }
            }
          }
          if (data.trackAudio)
            data.trackWaveform = await this.waveforms.get(data.trackAudio.uid, 'track:' + data.trackUid)
          const allowed = new Set()
          for (const layer of data.layers)
            for (const field of layer.resources || []) {
              for (const resource of [field.current, ...field.keys.map((key) => key.resource)])
                if (resource?.thumbnail) allowed.add(resource.uid)
            }
          this.allowedThumbnails = allowed
          this.cache = data
          data.renderRevision = renderRevision(data)
          this.signature = signature
          this.updated = Date.now()
        })().finally(() => {
          this.pending = null
        })
        await this.pending
      }
    }
    const current = this.context()
    return {
      ...this.cache,
      contentRevision: context.contentRevision,
      tempoKey: context.tempoKey,
      showAllParameters: this.options.showAll === true,
      seekEnabled: typeof this.options.seek === 'function',
      selectionEnabled: typeof this.options.select === 'function',
      selectionToken: this.selectionToken,
      parameter: current.parameter,
      liveValue: current.liveValue,
      alignmentGuides: current.trackUid === this.cache.trackUid ? alignmentGuides(this.cache, current) : [],
      updated: this.updated,
      connected: current.connected !== false,
      time:
        current.trackUid === this.cache.trackUid && Number.isFinite(current.time)
          ? current.time
          : this.cache.time,
      timecode:
        current.trackUid === this.cache.trackUid && current.timecode ? current.timecode : this.cache.timecode,
    }
  }
  async handle(req, res) {
    const send = (status, type, body) => {
      res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    const host = (req.headers.host || '').split(':')[0].toLowerCase()
    if (!isIP(host) && host !== 'localhost' && host !== hostname().toLowerCase())
      return send(403, 'text/plain', 'Invalid viewer host')
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
    )
      return send(403, 'text/plain', 'Same-origin requests only')
    try {
      const url = new URL(req.url, 'http://localhost')
      if (['GET', 'HEAD'].includes(req.method) && url.pathname === '/api/live') {
        const current = this.context()
        return send(
          200,
          'application/json',
          JSON.stringify({
            ...current,
            alignmentGuides:
              this.cache?.trackUid === current.trackUid ? alignmentGuides(this.cache, current) : [],
          }),
        )
      }
      // Diagnostic uses saved connection settings only: no arbitrary host or path.
      if (req.method === 'POST' && url.pathname === '/api/resources/test') {
        if (req.headers['x-viewer-token'] !== this.selectionToken) return send(403, 'text/plain', 'Invalid request')
        if (this.resourceTestPending) return send(409, 'text/plain', 'Test already running')
        this.resourceTestPending = true
        const { DirectSmbClient } = require('./smb-client')
        const { smbTarget } = require('./smb-audio')
        let client, stage = 'configuration'
        try {
          const target = smbTarget(this.options.resourceShareRoot, {projectDirectory:'C:\\projects\\show',filename:'C:\\projects\\show\\probe'})
          client = new DirectSmbClient(target.host,{connectTimeout:5000,requestTimeout:5000})
          stage = 'authentication'
          const session = await client.authenticate({username:this.options.resourceUsername || '',password:this.options.resourcePassword || '',domain:this.options.resourceDomain || ''})
          stage = 'share'
          await session.connectTree(target.share)
          return send(200,'application/json',JSON.stringify({ok:true,stage:'share',fileRead:false}))
        } catch(error) {
          return send(200,'application/json',JSON.stringify({ok:false,stage,code:error.statusName || error.code || error.name,fileRead:false}))
        } finally {
          await client?.close().catch(()=>{})
          this.resourceTestPending = false
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/waveform/refresh') {
        if (
          req.headers['x-viewer-token'] !== this.selectionToken ||
          req.headers['content-type'] !== 'application/json'
        )
          return send(403, 'text/plain', 'Invalid request')
        let body = ''
        for await (const chunk of req) {
          body += chunk
          if (body.length > 1024) return send(413, 'text/plain', 'Request too large')
        }
        const value = JSON.parse(body)
        if (
          !value ||
          typeof value.trackUid !== 'string' ||
          typeof value.layerUid !== 'string' ||
          Object.keys(value).some((k) => !['trackUid', 'layerUid'].includes(k))
        )
          return send(400, 'text/plain', 'Invalid waveform target')
        const current = this.context()
        if (
          value.trackUid !== current.trackUid ||
          this.cache?.trackUid !== value.trackUid ||
          !this.cache.layers.some(
            (l) => l.uid === value.layerUid && l.resources?.some((f) => f.current?.audio),
          )
        )
          return send(
            409,
            'application/json',
            JSON.stringify({ ok: false, reason: 'Audio layer changed; retry' }),
          )
        this.waveforms.invalidate(value.layerUid)
        this.updated = 0
        return send(200, 'application/json', JSON.stringify({ ok: true }))
      }
      if (
        req.method === 'POST' &&
        ((url.pathname === '/api/select' && this.options.select) ||
          (url.pathname === '/api/seek' && this.options.seek))
      ) {
        if (
          req.headers['x-viewer-token'] !== this.selectionToken ||
          req.headers['content-type'] !== 'application/json'
        )
          return send(
            403,
            'application/json',
            JSON.stringify({ ok: false, reason: 'Invalid selection request' }),
          )
        let body = ''
        for await (const chunk of req) {
          body += chunk
          if (body.length > 1024) return send(413, 'text/plain', 'Selection too large')
        }
        const value = JSON.parse(body)
        if (url.pathname === '/api/seek') {
          if (
            !value ||
            typeof value.trackUid !== 'string' ||
            !/^\d+$/.test(value.trackUid) ||
            !Number.isFinite(value.time) ||
            Object.keys(value).some((k) => !['trackUid', 'time'].includes(k))
          )
            return send(400, 'application/json', JSON.stringify({ ok: false, reason: 'Invalid seek' }))
          const result = await this.options.seek(value)
          this.updated = 0
          return send(result.ok ? 200 : 409, 'application/json', JSON.stringify(result))
        }
        if (
          !value ||
          typeof value.trackUid !== 'string' ||
          typeof value.layerUid !== 'string' ||
          !/^\d+$/.test(value.trackUid) ||
          !/^\d+$/.test(value.layerUid) ||
          (value.point !== undefined && !['in','out','key'].includes(value.point)) ||
          (value.point === 'key' && (!Number.isFinite(value.keyTime) || typeof value.parameter !== 'string')) ||
          (value.keyTime !== undefined && value.point !== 'key') ||
          (value.parameter !== undefined &&
            (typeof value.parameter !== 'string' || value.parameter.length > 200)) ||
          Object.keys(value).some((key) => !['trackUid', 'layerUid', 'parameter', 'point', 'keyTime'].includes(key))
        )
          return send(400, 'application/json', JSON.stringify({ ok: false, reason: 'Invalid selection' }))
        const result = await this.options.select(value)
        this.updated = 0
        return send(result.ok ? 200 : 409, 'application/json', JSON.stringify(result))
      }
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'text/plain', 'Selection only')
      if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', page)
      if (url.pathname === '/viewer.js') return send(200, 'text/javascript; charset=utf-8', browserScript)
      if (url.pathname === '/viewer.css') return send(200, 'text/css; charset=utf-8', stylesheet)
      if (url.pathname === '/api/state')
        return send(200, 'application/json', JSON.stringify(await this.state(url.searchParams)))
      const match = /^\/api\/thumbnail\/(\d+)$/.exec(url.pathname)
      if (match && this.allowedThumbnails.has(match[1])) {
        const uid = match[1]
        if (!this.thumbnails.has(uid)) {
          if (this.thumbnails.size >= 128) this.thumbnails.delete(this.thumbnails.keys().next().value)
          this.thumbnails.set(
            uid,
            this.client
              .thumbnail(uid)
              .then((value) => Buffer.from(value, 'base64'))
              .catch(() => Buffer.alloc(0)),
          )
        }
        const bytes = await this.thumbnails.get(uid)
        return send(bytes.length ? 200 : 404, 'image/png', bytes)
      }
      send(404, 'text/plain', 'Not found')
    } catch {
      // Do not expose native stack traces, project paths or connection details.
      send(503, 'application/json', JSON.stringify({ error: 'Designer data unavailable. Retrying…' }))
    }
  }
}

module.exports = { ViewerServer }
