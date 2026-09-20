'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { WaveformDiskCache } = require('../src/waveform-disk-cache')
const { WaveformCache } = require('../src/viewer-waveform')
const wave = { peaks: [0, 0.5, 1], duration: 1, step: 1 / 3 }
async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wave-disk-test-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return dir
}
test('disk peaks survive recreation; identity changes miss and corruption is ignored', async t => {
  const dir = await directory(t), cache = new WaveformDiskCache(dir)
  const key = cache.key(['project', 'resource', 'file', 'revision'])
  await cache.write(key, wave)
  assert.deepEqual(await new WaveformDiskCache(dir).read(key), wave)
  assert.equal(await cache.read(cache.key(['other project'])), null)
  await fs.writeFile(cache.filename(key), '{broken')
  assert.equal(await cache.read(key), null)
  await cache.write(key, { ...wave, peaks: [NaN] })
  assert.equal(await cache.read(key), null)
})
test('disk quota evicts old peaks; foreign files are untouched and failed writes are harmless', async t => {
  const dir = await directory(t), cache = new WaveformDiskCache(dir, 130)
  await fs.writeFile(path.join(dir, 'leave-me.txt'), 'user data')
  for (let i = 0; i < 6; i++) await cache.write(cache.key([i]), wave)
  const names = (await fs.readdir(dir)).filter(n => n.endsWith('.json'))
  const sizes = await Promise.all(names.map(async n => (await fs.stat(path.join(dir, n))).size))
  assert.ok(sizes.reduce((a,b) => a+b,0) <= 130)
  assert.deepEqual(await cache.read(cache.key([5])), wave)
  assert.equal(await fs.readFile(path.join(dir, 'leave-me.txt'), 'utf8'), 'user data')
  await new WaveformDiskCache(path.join(dir, 'leave-me.txt')).write(cache.key(['bad']), wave)
})
test('viewer uses persisted peaks without opening media; REFRESH forces decoding', async t => {
  const dir = await directory(t)
  const source = { status: 'ready', projectDirectory: 'synthetic', filename: path.join(dir, 'missing.wav'), revision: '100:1', container: 'wav' }
  const client = { baseUrl: 'http://127.0.0.1:80', execute: async () => source }
  const cache = new WaveformCache(client, { waveformCacheDirectory: dir })
  t.after(() => cache.close())
  await cache.disk.write(cache.disk.key([client.baseUrl, source.projectDirectory, source.filename, 'uid', source.revision, source.container]), wave)
  await cache.get('uid', 'layer')
  await cache.tail
  assert.equal((await cache.get('uid', 'layer')).status, 'ready')
  cache.invalidate('layer', true)
  await cache.get('uid', 'layer')
  await cache.tail
  assert.equal((await cache.get('uid', 'layer')).status, 'unavailable')
})
