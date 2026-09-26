'use strict'
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { DesignerClient } = require('../src/client'),
  { Editor } = require('../src/editor'),
  { DemoClient } = require('../src/demo')
test('transport API uses guarded target and proper section envelope; toggle retains requested mode', async () => {
  const requests = []
  let playing = false
  const c = new DesignerClient('localhost', 80, async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return {
      ok: true,
      json: async () =>
        url.endsWith('/execute')
          ? { status: { code: 0 }, returnValue: JSON.stringify({ playing }) }
          : { status: { code: 0 } },
    }
  })
  const context = { trackUid: '1', transportUid: '2' }
  for (const operation of [
    'play',
    'playsection',
    'playloopsection',
    'stop',
    'gotoprevsection',
    'gotonextsection',
    'gotoprevtrack',
    'gotonexttrack',
  ]) {
    await c.transport(context, operation)
    const r = requests.at(-1)
    assert.ok(r.url.endsWith('/' + operation))
    assert.deepEqual(r.body, {
      transports: [operation.startsWith('goto') ? { transport: { uid: '2' } } : { uid: '2' }],
    })
  }
  await c.transport(context, 'toggle', 'play')
  assert.ok(requests.at(-1).url.endsWith('/play'))
  playing = true
  await c.transport(context, 'toggle', 'playsection')
  assert.ok(requests.at(-1).url.endsWith('/stop'))
  await assert.rejects(() => c.transport(context, 'delete'), /Invalid/)
  c.close()
})
test('track navigation invalidates the editor context and clears track-bound modes', async () => {
  const calls = []
  const e = new Editor({
    transport: async (context, operation) => {
      calls.push({ context, operation })
      return { command: operation, playing: true }
    },
  })
  e.snapshot = { trackUid: 'track-1', transportUid: 'transport-1' }
  e.moveKey = { time: 1 }
  e.selectedKeyTime = 1
  e.layerEdit = 'edit'
  e.mediaMode = true
  e.mediaAll = [{}]
  await e.controlTransport('gotonexttrack')
  assert.deepEqual(calls, [
    { context: { trackUid: 'track-1', transportUid: 'transport-1' }, operation: 'gotonexttrack' },
  ])
  assert.equal(e.stale, true)
  assert.equal(e.contextStale, true)
  assert.equal(e.moveKey, null)
  assert.equal(e.selectedKeyTime, null)
  assert.equal(e.layerEdit, '')
  assert.equal(e.mediaMode, false)
  assert.deepEqual(e.mediaAll, [])
})
test('CC1 playback remembers mode and never changes unlinked edit time', async () => {
  const c = new DemoClient(),
    e = new Editor(c)
  await e.refresh()
  e.setLinkTime(false)
  e.time = 10
  const send = (operation) => e.controlTransport(operation)
  await send('play')
  assert.equal(e.playing, true)
  assert.equal(e.lastPlaybackMode, 'play')
  await send('toggle')
  assert.equal(e.playing, false)
  await send('toggle')
  assert.equal(e.lastPlaybackMode, 'play')
  assert.equal(e.playing, true)
  await send('playsection')
  await send('stop')
  await send('toggle')
  assert.equal(e.lastPlaybackMode, 'playsection')
  assert.equal(e.time, 10)
  assert.equal(e.transportTime, 0)
})
