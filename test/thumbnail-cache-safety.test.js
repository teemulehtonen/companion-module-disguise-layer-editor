'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { ThumbnailDiskCache } = require('../src/thumbnail-disk-cache')
const wave = { kind: 'thumbnail', png: Buffer.from('89504e470d0a1a0a', 'hex').toString('base64') }
async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wave-disk-test-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return dir
}
test('disk thumbnails survive recreation; identity changes miss and corruption is ignored', async (t) => {
  const dir = await directory(t),
    cache = new ThumbnailDiskCache(dir)
  const key = cache.key(['project', 'resource', 'file', 'revision'])
  await cache.write(key, wave)
  assert.deepEqual(await new ThumbnailDiskCache(dir).read(key), wave)
  assert.equal(await cache.read(cache.key(['other project'])), null)
  await fs.writeFile(cache.filename(key), '{broken')
  assert.equal(await cache.read(key), null)
  await cache.write(key, { ...wave, png: 'invalid' })
  assert.equal(await cache.read(key), null)
})
test('disk quota evicts old thumbnails; foreign files are untouched and failed writes are harmless', async (t) => {
  const dir = await directory(t),
    cache = new ThumbnailDiskCache(dir, 130)
  await fs.writeFile(path.join(dir, 'leave-me.txt'), 'user data')
  for (let i = 0; i < 6; i++) await cache.write(cache.key([i]), wave)
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.json'))
  const sizes = await Promise.all(names.map(async (n) => (await fs.stat(path.join(dir, n))).size))
  assert.ok(sizes.reduce((a, b) => a + b, 0) <= 130)
  assert.deepEqual(await cache.read(cache.key([5])), wave)
  assert.equal(await fs.readFile(path.join(dir, 'leave-me.txt'), 'utf8'), 'user data')
  await new ThumbnailDiskCache(path.join(dir, 'leave-me.txt')).write(cache.key(['bad']), wave)
})
test('explicit flush waits for writes, deletes only owned files and respects another writer', async (t) => {
  const dir = await directory(t),
    cache = new ThumbnailDiskCache(dir)
  await fs.writeFile(path.join(dir, 'keep.txt'), 'untouched')
  const write = cache.write(cache.key(['entry']), wave)
  await cache.clear()
  await write
  assert.equal(await cache.read(cache.key(['entry'])), null)
  assert.deepEqual(await fs.readdir(dir), ['keep.txt'])
  await fs.writeFile(path.join(dir, '.write-lock'), '')
  await assert.rejects(cache.clear(), { code: 'EEXIST' })
  assert.equal(await fs.readFile(path.join(dir, 'keep.txt'), 'utf8'), 'untouched')
})
