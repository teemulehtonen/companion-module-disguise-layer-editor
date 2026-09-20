'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { createHash } = require('node:crypto')
const LIMIT = 100 * 1024 * 1024
const MAX_ENTRY = 256 * 1024
let writes = Promise.resolve()

function cacheDirectory() {
  const root = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches')
      : process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
  return path.join(root, 'disguise-layer-editor', 'waveforms-v1')
}

function valid(data) {
  return data && Array.isArray(data.peaks) && data.peaks.length <= 8192 &&
    data.peaks.every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
    Number.isFinite(data.duration) && data.duration >= 0 &&
    Number.isFinite(data.step) && data.step >= 0
}

class WaveformDiskCache {
  constructor(directory = cacheDirectory(), limit = LIMIT) {
    this.directory = directory
    this.limit = limit
  }
  key(identity) {
    // Store no filenames, hostnames, credentials or project paths in the cache.
    return createHash('sha256').update(JSON.stringify(identity)).digest('hex')
  }
  filename(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid waveform cache key')
    return path.join(this.directory, key + '.json')
  }
  async read(key) {
    try {
      const filename = this.filename(key)
      if ((await fs.stat(filename)).size > MAX_ENTRY) return null
      const data = JSON.parse(await fs.readFile(filename, 'utf8'))
      return valid(data) ? data : null
    } catch { return null }
  }
  async remove(key) {
    await fs.unlink(this.filename(key)).catch(() => {})
  }
  write(key, wave) {
    const run = async () => {
      if (!valid(wave)) return
      const data = JSON.stringify({ peaks: wave.peaks, duration: wave.duration, step: wave.step })
      const size = Buffer.byteLength(data)
      if (size > MAX_ENTRY || size > this.limit) return
      let lock
      const lockPath = path.join(this.directory, '.write-lock')
      const pending = path.join(this.directory, '.pending')
      try {
        await fs.mkdir(this.directory, { recursive: true })
        // Other module processes may share this directory. If busy, skip caching.
        lock = await fs.open(lockPath, 'wx')
        await fs.rm(pending, { force: true })
        const filename = this.filename(key)
        await fs.rm(filename, { force: true })
        const files = []
        for (const name of await fs.readdir(this.directory)) {
          if (!/^[a-f0-9]{64}\.json$/.test(name)) continue
          const file = path.join(this.directory, name), stat = await fs.stat(file)
          files.push({ file, size: stat.size, time: stat.mtimeMs })
        }
        let total = files.reduce((n, f) => n + f.size, 0)
        for (const file of files.sort((a, b) => a.time - b.time)) {
          if (total + size <= this.limit) break
          await fs.unlink(file.file)
          total -= file.size
        }
        await fs.writeFile(pending, data, { flag: 'wx' })
        await fs.rename(pending, filename)
      } catch {
        // Read-only/full disks must never prevent waveform display or editing.
      } finally {
        if (lock) {
          await fs.rm(pending, { force: true }).catch(() => {})
          await lock.close().catch(() => {})
          await fs.unlink(lockPath).catch(() => {})
        }
      }
    }
    writes = writes.then(run, run)
    return writes
  }
}
module.exports = { WaveformDiskCache, cacheDirectory }
