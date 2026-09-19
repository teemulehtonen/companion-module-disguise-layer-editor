'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { readWaveform, WaveformCache } = require('../src/viewer-waveform')

async function fixture(t, samples) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'viewer-wave-test-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'audio.wav'),
    data = Buffer.alloc(44 + samples.length * 2)
  data.write('RIFF')
  data.writeUInt32LE(data.length - 8, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(2, 22)
  data.writeUInt32LE(48000, 24)
  data.writeUInt32LE(192000, 28)
  data.writeUInt16LE(4, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((sample, i) => data.writeInt16LE(sample, 44 + i * 2))
  await fs.writeFile(file, data)
  return file
}

test('WAV peaks preserve antiphase channels and source duration', async (t) => {
  const file = await fixture(t, [16384, -16384, 0, 0, -32768, 32767])
  const wave = await readWaveform(file)
  assert.deepEqual(wave.peaks, [0.5, 0, 1])
  assert.equal(wave.duration, 3 / 48000)
})

test('malformed audio fails cleanly and remote paths are never opened locally', async (t) => {
  const file = await fixture(t, [0, 0])
  await fs.truncate(file, 30)
  await assert.rejects(readWaveform(file), /Truncated/)
  const cache = new WaveformCache({
    baseUrl: 'http://designer.example:80',
    execute() {
      throw Error('Must not run')
    },
  })
  assert.equal((await cache.get('1')).status, 'unavailable')
  cache.close()
})

test('waveform cache reuses a decoded resource and strips internal metadata', async (t) => {
  const file = await fixture(t, [1200, 1200])
  const cache = new WaveformCache({
    baseUrl: 'http://127.0.0.1:80',
    execute: async () => ({ status: 'ready', filename: file, revision: '1' }),
  })
  t.after(() => cache.close())
  assert.equal((await cache.get('1')).status, 'loading')
  await cache.entries.get('1').pending
  const ready = await cache.get('1')
  assert.equal(ready.status, 'ready')
  assert.equal(ready.filename, undefined)
  assert.equal(ready.revision, undefined)
  assert.equal(ready.pending, undefined)
})

test('layer-owned waveforms refresh independently and removed layers release their data', async t => {
  const file = await fixture(t, [1200,1200])
  const cache = new WaveformCache({baseUrl:'http://127.0.0.1:80',execute:async()=>({status:'ready',filename:file,revision:'1'})})
  t.after(()=>cache.close())
  await cache.get('audio-1','layer-1')
  await cache.get('audio-1','layer-2')
  await cache.tail
  const second = cache.entries.get('layer-2')
  cache.invalidate('layer-1')
  assert.equal(cache.entries.has('layer-1'),false)
  assert.equal(cache.entries.get('layer-2'),second)
  await cache.get('audio-2','layer-2')
  assert.notEqual(cache.entries.get('layer-2'),second)
  cache.retain(new Set())
  assert.equal(cache.entries.size,0)
  await cache.tail
  assert.equal(cache.entries.size,0,'Cancelled decode must not resurrect a deleted layer')
})
