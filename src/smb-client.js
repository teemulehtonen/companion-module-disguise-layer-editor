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
      await this.client.treeFor(name)
      return { createFileReadStream: async file => this.client.createReadStream(name + '/' + file.replace(/\\/g,'/')) }
    } }
  }
  async close() { this.closed = true; await this.client?.close() }
}
module.exports = { DirectSmbClient }
