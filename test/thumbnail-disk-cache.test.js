'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { DesignerClient } = require('../src/client')
const { WaveformDiskCache } = require('../src/waveform-disk-cache')

test('thumbnail persists across clients, revalidates revision and flush forces re-download', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-disk-test-'))
  t.after(() => fs.rm(dir, {recursive:true,force:true}))
  let revision = 'project:resource:file:1', downloads = 0
  const png = Buffer.from('89504e470d0a1a0a', 'hex')
  const make = () => {
    const client = new DesignerClient('localhost',80,async()=>{
      downloads++
      return {ok:true,arrayBuffer:async()=>png}
    })
    client.mediaDisk = new WaveformDiskCache(dir)
    client.execute = async()=>({revision})
    t.after(()=>client.close())
    return client
  }
  assert.equal(await make().thumbnail('123'), png.toString('base64'))
  const second = make()
  assert.equal(await second.thumbnail('123'), png.toString('base64'))
  assert.equal(downloads,1)
  revision = 'project:resource:file:2'
  await second.thumbnail('123')
  assert.equal(downloads,2)
  await second.mediaDisk.clear()
  assert.deepEqual(await fs.readdir(dir),[])
  await second.thumbnail('123')
  assert.equal(downloads,3)
  revision = undefined
  await second.thumbnail('123')
  await second.thumbnail('123')
  assert.equal(downloads,5,'Unknown revision must not reuse a persistent thumbnail')
})
