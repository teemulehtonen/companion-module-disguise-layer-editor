'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')
const { actions } = require('../src/definitions')
const { describeEditor, editFromViewer, validEditRequest, resourceList } = require('../src/viewer-editor')
const { ViewerServer } = require('../src/viewer-server')
async function ready() {
  const editor = new Editor(new DemoClient())
  await editor.refresh()
  return editor
}
const send = (e, action, options = {}) =>
  editFromViewer(e, { action, token: describeEditor(e).token, ...options })

test('mouse and Companion actions share layer edits, locks, steps, values and interpolation', async () => {
  const mouse = await ready(),
    deck = await ready()
  const controls = actions({ perform: (fn) => fn(deck) })
  for (const [action, options] of [
    ['layer_edit', {}],
    ['layer', { direction: 1 }],
    ['field', { direction: 1 }],
    ['value', { direction: -1 }],
    ['fine', {}],
    ['layer_edit', {}],
    ['value_press', {}],
    ['key_move', {}],
    ['time_step', {}],
    ['time', { direction: 1 }],
    ['value', { direction: -1 }],
    ['field', { direction: 1 }],
    ['layer', { direction: 1 }],
    ['key_type', {}],
    ['key_move', {}],
  ]) {
    assert.equal((await send(mouse, action, options)).ok, true, action)
    await controls[action].callback({ options: { step: 0, ...options } })
    assert.deepEqual(mouse.client.data, deck.client.data, action)
    assert.deepEqual(describeEditor(mouse), describeEditor(deck), action)
  }
})

test('stale mouse gestures cannot write into a new Deck selection or step', async () => {
  const e = await ready()
  const request = { action: 'value', direction: 1, token: describeEditor(e).token }
  e.cyclePrecision()
  const before = structuredClone(e.client.data)
  assert.equal((await editFromViewer(e, request)).ok, false)
  assert.deepEqual(e.client.data, before)
})

test('explicit interpolation uses native type while keeping selected key locked', async () => {
  const e = await ready()
  await e.pressValue()
  await send(e, 'key_move')
  for (const type of [0, 2, 1]) {
    assert.equal((await send(e, 'key_type', { type })).ok, true)
    assert.equal(e.selectedKey.interpolation, type)
    assert.equal(e.moveKey.interpolation, type)
  }
})

test('edit route is absent by default and enforces token and exact action schema', async (t) => {
  const closed = new ViewerServer({}, () => ({})),
    open = new ViewerServer({}, () => ({}), {
      edit: async () => ({ ok: true }),
    })
  t.after(async () => {
    await closed.close()
    await open.close()
  })
  const closedPort = await closed.start(0),
    port = await open.start(0)
  const request = (value) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': open.selectionToken },
    body: JSON.stringify(value),
  })
  const value = { action: 'value', direction: 1, token: 'a'.repeat(64) }
  assert.equal((await fetch(`http://127.0.0.1:${closedPort}/api/edit`, request(value))).status, 405)
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/edit`, { method: 'POST', body: '{}' })).status, 403)
  for (const invalid of [
    { ...value, path: 'x' },
    { ...value, action: 'execute' },
    { ...value, direction: 100 },
    { ...value, type: 2 },
  ]) {
    assert.equal(validEditRequest(invalid), false)
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/edit`, request(invalid))).status, 400)
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/edit`, request(value))).status, 200)
})

test('resource folders, pages and apply share Companion selection without accepting paths', async () => {
  const e = await ready()
  e.mediaMode = true
  e.mediaFolder = 'Images'
  e.mediaIndex = -1
  e.mediaAll = Array.from({ length: 130 }, (_, i) => ({
    uid: String(100 + i),
    name: `Image ${i}`,
    folder: 'Images',
  }))
  e.mediaAll.push({ uid: '300', name: 'Sound', folder: 'Audio/Effects' })
  assert.equal(resourceList(e, 0).items.length, 64)
  assert.equal(resourceList(e, 128).items.length, 2)
  assert.equal(resourceList(e, 128).items[0].index, 128)
  await send(e, 'resource_folder', { index: e.mediaFolders.indexOf('Audio/Effects') })
  assert.equal(e.mediaFolder, 'Audio/Effects')
  assert.equal(e.mediaIndex, -1)
  const calls = []
  e.client.execute = async (command, args) => {
    calls.push({ command, args })
    return {}
  }
  assert.equal((await send(e, 'resource_choose', { index: 0, resourceUid: 'wrong' })).ok, false)
  assert.equal(calls.length, 0)
  await send(e, 'resource_choose', { index: 0, resourceUid: '300' })
  assert.equal(calls[0].command, 'media_set')
  assert.equal(calls[0].args.mediaUid, '300')
  assert.equal(e.currentMedia.uid, '300')
  assert.equal(
    validEditRequest({
      action: 'resource_folder',
      token: describeEditor(e).token,
      index: 0,
      path: 'private',
    }),
    false,
  )
  assert.equal((await send(e, 'resource_folder', { index: 999 })).ok, false)
})

test('bulk deletion shares the confirmation menu and cannot skip confirmation', async () => {
  const e = await ready()
  const before = structuredClone(e.field.keys)
  await send(e, 'clear_menu')
  await send(e, 'pad', { slot: 5 })
  assert.equal(describeEditor(e).clearPrompt, true)
  assert.deepEqual(e.field.keys, before)
  await send(e, 'pad', { slot: 7 })
  assert.deepEqual(e.field.keys, before)
  await send(e, 'pad', { slot: 5 })
  await send(e, 'pad', { slot: 5 })
  assert.equal(e.field.sequenced, false)
  assert.equal(describeEditor(e).clearMenu, false)
})

test('resource metadata batches preserve native clip duration and allow only listed thumbnails', async (t) => {
  const e = await ready()
  e.mediaMode = true
  e.mediaFolder = 'Internal/Mapping'
  e.mediaAll = [
    {
      uid: '71',
      name: 'Current version.mov',
      folder: e.mediaFolder,
      thumbnail: true,
      duration: 2.5,
      fps: 50,
      alpha: true,
      audio: false,
      codec: 'HAP',
      version: '2',
      path: 'private/path',
    },
  ]
  const server = new ViewerServer(
    { thumbnail: async () => Buffer.from('image').toString('base64') },
    () => ({}),
    {
      edit: async () => ({ ok: true }),
      resources: (offset) => resourceList(e, offset),
    },
  )
  t.after(() => server.close())
  const port = await server.start(0),
    base = `http://127.0.0.1:${port}`
  assert.equal((await fetch(base + '/api/thumbnail/71')).status, 404)
  const list = await fetch(base + '/api/resource-list').then((r) => r.json())
  assert.equal(list.items[0].duration, 2.5)
  assert.equal(list.items[0].version, '2')
  assert.equal(list.items[0].path, undefined)
  assert.equal((await fetch(base + '/api/thumbnail/71')).status, 200)
  assert.equal((await fetch(base + '/api/thumbnail/72')).status, 404)
  assert.equal((await fetch(base + '/api/resource-list?offset=-1')).status, 400)
})
