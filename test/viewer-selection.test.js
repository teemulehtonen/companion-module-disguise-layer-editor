'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')
const { ViewerServer } = require('../src/viewer-server')

test('browser selection preserves time and cannot select inactive layers or bypass a key lock', async () => {
  const client = new DemoClient(),
    editor = new Editor(client)
  await editor.refresh()
  const layer = editor.layer,
    time = editor.time,
    field = layer.fields.at(-1)
  const target = { trackUid: editor.snapshot.trackUid, layerUid: layer.uid, parameter: field.name }
  assert.equal((await editor.selectFromViewer(target)).ok, true)
  assert.equal(editor.field.name, field.name)
  assert.equal(editor.time, time)
  editor.moveKey = { time: 0 }
  assert.equal((await editor.selectFromViewer(target)).ok, false)
  editor.moveKey = null
  client.data.layers.find((l) => l.uid === layer.uid).start = time + 10
  assert.equal((await editor.selectFromViewer(target)).ok, false)
  assert.equal(editor.time, time)
})

test('selection route accepts only authenticated selection data, never a value or seek', async (t) => {
  let selected
  const server = new ViewerServer({}, () => ({}), {
    select: async (value) => {
      selected = value
      return { ok: true }
    },
  })
  t.after(() => server.close())
  const port = await server.start(0),
    url = `http://127.0.0.1:${port}/api/select`
  const request = (value) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': server.selectionToken },
    body: JSON.stringify(value),
  })
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 403)
  assert.equal((await fetch(url, request({ trackUid: '1', layerUid: '2', value: 1 }))).status, 400)
  assert.equal(selected, undefined)
  assert.equal(
    (await fetch(url, request({ trackUid: '1', layerUid: '2', parameter: 'brightness' }))).status,
    200,
  )
  assert.deepEqual(selected, { trackUid: '1', layerUid: '2', parameter: 'brightness' })
})

test('viewer seek clamps and frame-snaps without moving selected keys', async () => {
  const client = new DemoClient(),
    editor = new Editor(client)
  await editor.refresh()
  const trackUid = editor.snapshot.trackUid,
    keys = JSON.stringify(client.data.layers)
  editor.moveKey = { time: 5 }
  assert.equal((await editor.seekFromViewer({ trackUid, time: 2.021 })).time, 2.04)
  assert.equal((await editor.seekFromViewer({ trackUid, time: -10 })).time, 0)
  assert.equal((await editor.seekFromViewer({ trackUid, time: 999 })).time, 120)
  assert.equal((await editor.seekFromViewer({ trackUid: 'wrong', time: 5 })).ok, false)
  assert.equal((await editor.seekFromViewer({ trackUid, time: NaN })).ok, false)
  assert.equal(JSON.stringify(client.data.layers), keys)
})
test('seek route checks token, origin and exact payload', async (t) => {
  let calls = 0
  const server = new ViewerServer({}, () => ({}), {
    seek: async () => {
      calls++
      return { ok: true }
    },
  })
  t.after(() => server.close())
  const port = await server.start(0),
    url = 'http://127.0.0.1:' + port + '/api/seek'
  const request = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': server.selectionToken },
    body: JSON.stringify(body),
  })
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 403)
  assert.equal((await fetch(url, request({ trackUid: '1', time: 2, value: 5 }))).status, 400)
  const foreign = request({ trackUid: '1', time: 2 })
  foreign.headers.Origin = 'http://foreign'
  assert.equal((await fetch(url, foreign)).status, 403)
  assert.equal((await fetch(url, request({ trackUid: '1', time: 2 }))).status, 200)
  assert.equal(calls, 1)
})

test('timeline points seek and select the intended layer/parameter without modifying keys', async () => {
  const client = new DemoClient(), editor = new Editor(client)
  await editor.refresh()
  const layer = editor.layer, trackUid = editor.snapshot.trackUid
  const original = JSON.stringify(client.data.layers)
  const target = {trackUid,layerUid:layer.uid}
  assert.equal((await editor.selectFromViewer({...target,point:'out'})).ok,true)
  assert.equal(editor.time,layer.end-1/editor.snapshot.fps)
  assert.equal((await editor.selectFromViewer({...target,point:'key',parameter:layer.fields[0].name,keyTime:5})).ok,true)
  assert.equal(editor.time,5)
  assert.equal(editor.field.name,layer.fields[0].name)
  assert.equal((await editor.selectFromViewer({...target,point:'key',parameter:layer.fields[0].name,keyTime:999})).ok,false)
  assert.equal(JSON.stringify(client.data.layers),original)
})
