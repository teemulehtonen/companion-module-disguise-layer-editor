'use strict'

// Keep the SMB implementation behind this small read-only adapter. The client
// negotiates signing/encryption and NTLMv2 itself; no OS mount or shell is used.
class DirectSmbClient {
  constructor(host, options) { this.host = host; this.options = options }
  on() {}
  async authenticate(credentials) {
    const { Client } = await import('smb3-client')
    if (this.closed) throw Object.assign(new Error('Cancelled'), {code:'ABORT_ERR'})
    this.client = new Client({ host:this.host, ...this.options,
      username:credentials.username, password:credentials.password, domain:credentials.domain,
      signing:'if-offered', encryption:'if-offered' })
    await this.client.connect()
    return { connectTree: async share => {
      const name = share.split('\\').filter(Boolean)[1]
      const tree = await this.client.treeFor(name)
      return {
        createFileReadStream: async file => this.client.createReadStream(name + '/' + file.replace(/\\/g,'/')),
        openReadOnly: async file => {
          // Pinned smb3-client 0.2.0 internals: public streams cannot seek.
          // Bundle these helpers so Raspberry Pi requires no extra installation.
          const { Open } = await import('../node_modules/smb3-client/dist/open/open.js')
          const { readAt } = await import('../node_modules/smb3-client/dist/open/read.js')
          const handle = await Open.create(tree, {filename:file, desiredAccess:0x81,
            shareAccess:7, createDisposition:1, createOptions:0x40, fileAttributes:0})
          return {
            stat: async () => ({size:Number(handle.meta.endOfFile)}),
            read: async (buffer, offset, length, position) => {
              let bytesRead = 0
              while (bytesRead < length) {
                const data = await readAt(handle, BigInt(position + bytesRead), Math.min(65536, length - bytesRead))
                if (!data.length) break
                data.copy(buffer, offset + bytesRead)
                bytesRead += data.length
              }
              return {bytesRead}
            },
            close: () => handle.close(),
          }
        },
      }
    } }
  }
  async close() { this.closed = true; await this.client?.close() }
}
module.exports = { DirectSmbClient }
