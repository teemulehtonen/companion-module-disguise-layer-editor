'use strict'
const fs = require('node:fs/promises')
const { readMovWaveform } = require('./viewer-mov-waveform')
const { readSmbAudio } = require('./smb-audio')

// Streaming, bounded-memory WAV peak extraction. Disk reads yield between
// chunks so decoding cannot stall Companion's event loop or Designer's UI.
async function readWaveform(filename, signal) {
  const file = typeof filename === 'object' ? filename : await fs.open(filename, 'r')
  try {
    const stat = await file.stat()
    const head = Buffer.alloc(12)
    await file.read(head, 0, 12, 0)
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE')
      throw new Error('Unsupported audio container')
    let format, data
    for (let offset = 12, count = 0; offset + 8 <= stat.size && count < 10000; count++) {
      const header = Buffer.alloc(8)
      await file.read(header, 0, 8, offset)
      const size = header.readUInt32LE(4),
        id = header.toString('ascii', 0, 4)
      if (offset + 8 + size > stat.size) throw new Error('Truncated WAV')
      if (id === 'fmt ') {
        if (size < 16 || size > 4096) throw new Error('Invalid WAV format')
        const fmt = Buffer.alloc(size)
        await file.read(fmt, 0, size, offset + 8)
        const code = fmt.readUInt16LE(0)
        format = {
          code: code === 65534 && size >= 40 ? fmt.readUInt16LE(24) : code,
          channels: fmt.readUInt16LE(2),
          rate: fmt.readUInt32LE(4),
          align: fmt.readUInt16LE(12),
          bits: fmt.readUInt16LE(14),
        }
      }
      if (id === 'data') data = { offset: offset + 8, size }
      offset += 8 + size + (size % 2)
      if (format && data) break
    }
    if (
      !format ||
      !data ||
      ![1, 3].includes(format.code) ||
      ![8, 16, 24, 32, 64].includes(format.bits) ||
      !format.channels ||
      !format.rate ||
      format.align !== (format.channels * format.bits) / 8 ||
      (format.code === 1 && format.bits > 32) ||
      (format.code === 3 && ![32, 64].includes(format.bits))
    )
      throw new Error('Unsupported WAV format')
    const frames = Math.floor(data.size / format.align),
      bins = Math.min(8192, frames)
    if (!frames) return { peaks: [], duration: 0, step: 0 }
    const perBin = Math.ceil(frames / bins),
      peaks = Array(Math.ceil(frames / perBin)).fill(0)
    const bytes = Buffer.alloc(Math.max(format.align, Math.floor(262144 / format.align) * format.align))
    const width = format.bits / 8
    let frame = 0
    while (frame < frames) {
      signal?.throwIfAborted()
      const count = Math.min(bytes.length, (frames - frame) * format.align)
      const { bytesRead } = await file.read(bytes, 0, count, data.offset + frame * format.align)
      if (bytesRead !== count) throw new Error('Audio changed while reading')
      for (let i = 0; i < count; i += format.align, frame++) {
        let peak = 0
        for (let channel = 0; channel < format.channels; channel++) {
          const at = i + channel * width
          const value =
            format.code === 3
              ? width === 4
                ? bytes.readFloatLE(at)
                : bytes.readDoubleLE(at)
              : width === 1
                ? (bytes[at] - 128) / 128
                : bytes.readIntLE(at, width) / 2 ** (format.bits - 1)
          if (Number.isFinite(value)) peak = Math.max(peak, Math.abs(value))
        }
        const bin = Math.floor(frame / perBin)
        peaks[bin] = Math.max(peaks[bin], Math.min(1, peak))
      }
      await new Promise((resolve) => setImmediate(resolve))
    }
    return { peaks, duration: frames / format.rate, step: perBin / format.rate }
  } finally {
    await file.close()
  }
}

class WaveformCache {
  constructor(client, options = {}) {
    this.options = options
    this.client = client
    this.entries = new Map()
    this.tail = Promise.resolve()
    this.controller = new AbortController()
  }
  close() {
    this.controller.abort()
    for (const entry of this.entries.values()) entry.controller.abort()
    this.entries.clear()
  }
  invalidate(owner) {
    this.entries.get(owner)?.controller.abort()
    this.entries.delete(owner)
  }
  retain(owners) {
    for (const owner of this.entries.keys()) if (!owners.has(owner)) this.invalidate(owner)
  }
  async get(uid, owner = uid) {
    // A remote path must never accidentally resolve to an unrelated local file.
    if (
      !this.options.resourceShareRoot &&
      !/^http:\/\/(127\.0\.0\.1|localhost):/.test(this.client.baseUrl || '')
    )
      return { status: 'unavailable', reason: 'Audio source requires local file access' }
    const source = await this.client.execute('viewer_audio_source', { uid })
    if (source.status !== 'ready') return { status: 'unavailable', reason: source.reason || 'Audio source unavailable' }
    let entry = this.entries.get(owner)
    if (!entry || entry.uid !== uid || entry.revision !== source.revision) {
      this.invalidate(owner)
      if (this.entries.size >= 32) this.invalidate(this.entries.keys().next().value)
      entry = { uid, controller: new AbortController(), revision: source.revision, status: 'loading' }
      this.entries.set(owner, entry)
      entry.pending = this.tail
        .then(async () => {
          this.controller.signal.throwIfAborted()
          const signal = entry.controller.signal
          signal.throwIfAborted()
          const decode = source.container === 'mov' ? readMovWaveform : readWaveform
          if (/^http:\/\/(127\.0\.0\.1|localhost):/.test(this.client.baseUrl || '')) {
            try { return await decode(source.filename, signal) }
            catch (error) {
              if (!this.options.resourceShareRoot || !['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error
            }
          }
          return readSmbAudio(this.options, source, signal, decode)
        })
        .then((data) => Object.assign(entry, data, { status: 'ready' }))
        .catch((error) =>
          Object.assign(entry, {
            status: 'unavailable',
            reason: 'Waveform unavailable (' + (error.code || error.name || 'decode') + ')',
          }),
        )
      this.tail = entry.pending
    }
    const { pending, revision, controller, uid: resourceUid, ...publicData } = entry
    return publicData
  }
}

module.exports = { readWaveform, WaveformCache }
