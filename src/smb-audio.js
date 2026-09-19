'use strict'
const path = require('node:path')
const { DirectSmbClient: Client } = require('./smb-client')

function smbTarget(share, source, designerRoot) {
  const parts = String(share)
    .replace(/^smb:\/\//i, '')
    .replace(/^[\\/]+/, '')
    .split(/[\\/]/)
    .filter(Boolean)
  if (parts.length < 2 || parts.some((p) => p === '.' || p === '..' || /[:\x00-\x1f]/.test(p)))
    throw Error('Invalid SMB share')
  const root = designerRoot || path.win32.dirname(source.projectDirectory || '')
  if (!path.win32.isAbsolute(root) || !path.win32.isAbsolute(source.filename))
    throw Error('Designer project root unavailable')
  const relative = path.win32.relative(root, source.filename)
  if (
    !relative ||
    path.win32.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => p === '..' || p.includes(':'))
  )
    throw Error('Audio outside project root')
  return {
    host: parts[0],
    share: '\\\\' + parts[0] + '\\' + parts[1],
    file: [...parts.slice(2), relative].join('\\'),
  }
}

// Read only requested byte ranges into bounded memory. Never copy media to disk.
async function readSmbAudio(options, source, signal, decode, ClientImpl = Client, platform = process.platform) {
  const target = smbTarget(options.resourceShareRoot, source, options.resourceDesignerRoot)
  // With no explicit credentials, Windows can use its existing SMB session.
  // This also avoids copying the entire media file before reading its peaks.
  if (platform === 'win32' && !options.resourceUsername && !options.resourcePassword && !options.resourceDomain) {
    signal.throwIfAborted()
    return decode(target.share + '\\' + target.file, signal)
  }
  const client = new ClientImpl(target.host, { connectTimeout: 5000, requestTimeout: 5000 })
  client.on('error', () => {})
  let handle
  const cancel = () => {
    void client.close().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const session = await client.authenticate({
      domain: options.resourceDomain || '',
      username: options.resourceUsername || '',
      password: options.resourcePassword || '',
      forceNtlmVersion: 'v2',
    })
    signal.throwIfAborted()
    const tree = await session.connectTree(target.share)
    handle = await tree.openReadOnly(target.file)
    signal.throwIfAborted()
    return await decode(handle, signal)
  } catch (error) {
    if (error.code === 'MOV_PCM_UNSUPPORTED' || error.name === 'AbortError') throw error
    const failure = new Error('SMB audio unavailable')
    failure.code =
      (error?.status ?? error?.header?.status) === undefined
        ? 'SMB_READ_FAILED'
        : 'SMB_' + Number(error.status ?? error.header.status).toString(16).toUpperCase()
    throw failure
  } finally {
    signal.removeEventListener('abort', cancel)
    await handle?.close().catch(() => {})
    await client.close().catch(() => {})
  }
}
module.exports = { smbTarget, readSmbAudio }
