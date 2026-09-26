'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'),
  vm = require('node:vm')
const { DisguiseLayerControl } = require('../src/main')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')
const { Connection } = require('../src/connection')
async function setup() {
  const client = new DemoClient(),
    editor = new Editor(client)
  await editor.refresh()
  const host = Object.create(DisguiseLayerControl.prototype)
  Object.assign(host, {
    editor,
    lastError: '',
    queueGeneration: 0,
    actionTail: Promise.resolve(),
    syncPending: false,
    nextSyncAttempt: 0,
    lastContentRevision: 'a',
    publish() {},
    connectionStatus() {},
    log() {},
    updateStatus() {},
  })
  const connection = new Connection(client, () => {})
  connection.connected = true
  connection.enableLiveUpdate = false
  host.connection = connection
  const src = fs.readFileSync(require.resolve('../src/main'), 'utf8').replaceAll('\r', '')
  const from = src.indexOf(
    '          (state, update) => {',
    src.indexOf('const connection = new Connection('),
  )
  const end = src.indexOf('\n          },\n          {', from)
  connection.onState = vm.runInNewContext('(function(){return ' + src.slice(from, end) + '}}).call(host)', {
    host,
    connection,
  })
  return { host, editor, connection, client }
}
test('ordinary content updates retain the CC1 context and restart refresh immediately', async () => {
  const { host, editor, connection, client } = await setup()
  let release
  const execute = client.execute.bind(client)
  client.execute = async (...args) => {
    await new Promise((resolve) => (release = resolve))
    return execute(...args)
  }
  try {
    connection.contentRevision = 'b'
    connection.onState(connection)
    assert.equal(editor.stale, true)
    await new Promise((resolve) => setImmediate(resolve))
    assert.ok(editor.busy)
    release()
    await host.actionTail
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(editor.stale, false)
    assert.equal(host.nextSyncAttempt, 0)
    client.execute = execute
    connection.contentRevision = 'c'
    connection.onState(connection)
    assert.equal(
      host.syncPending,
      true,
      'Next content change starts immediately, without a one-second cooldown',
    )
    await host.actionTail
  } finally {
    connection.close()
  }
})
test('track changes and disconnects mark the CC1 context stale until refresh', async () => {
  const { host, editor, connection } = await setup()
  host.requestSync = () => {}
  try {
    connection.trackUid = 'different-track'
    connection.onState(connection)
    assert.equal(editor.contextStale, true)
    await editor.refresh({ preserve: true })
    connection.trackUid = editor.snapshot.trackUid
    connection.connected = false
    connection.onState(connection)
    assert.equal(editor.contextStale, true)
  } finally {
    connection.close()
  }
})
test('failed background refresh retains retry backoff', async () => {
  const { host, editor, connection, client } = await setup()
  try {
    editor.stale = true
    client.execute = async () => {
      throw Error('Read unavailable')
    }
    host.requestSync()
    await host.actionTail
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(editor.stale, true)
    assert.ok(host.nextSyncAttempt > Date.now())
    assert.equal(host.lastError, 'Read unavailable')
  } finally {
    connection.close()
  }
})
