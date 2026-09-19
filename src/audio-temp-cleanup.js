'use strict'
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

// Migration for beta.88 and earlier: remove only the known temporary media
// filename in module-owned temp directories. Never recurse or follow symlinks.
async function cleanupLegacyAudioTemp(root = os.tmpdir()) {
  let files = 0, bytes = 0
  for (const entry of await fs.readdir(root, {withFileTypes:true})) {
    if (!entry.isDirectory() || !/^d3-wave-[A-Za-z0-9]{6}$/.test(entry.name)) continue
    const directory = path.join(root, entry.name)
    const filename = path.join(directory, 'source.wav')
    try {
      const stat = await fs.lstat(filename)
      if (!stat.isFile() || stat.isSymbolicLink()) continue
      await fs.unlink(filename)
      files++; bytes += stat.size
      await fs.rmdir(directory).catch(() => {}) // Only succeeds when empty.
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return {files, bytes}
}
module.exports = {cleanupLegacyAudioTemp}
