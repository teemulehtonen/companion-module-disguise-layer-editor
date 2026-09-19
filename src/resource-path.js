'use strict'
const path = require('node:path')

// Map only files inside the explicitly configured Designer root. SMB mounting
// and credentials belong to the OS; they never enter viewer responses.
function resourcePath(filename, sourceRoot, shareRoot, targetPath = path) {
  if (!path.win32.isAbsolute(sourceRoot || '') || !targetPath.isAbsolute(shareRoot || ''))
    throw new Error('Configure absolute Designer and shared project roots')
  const relative = path.win32.relative(sourceRoot, filename)
  if (!relative || path.win32.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..' || p.includes(':')))
    throw new Error('Audio is outside the configured project root')
  return targetPath.resolve(shareRoot, ...relative.split(/[\\/]/))
}
module.exports = { resourcePath }
