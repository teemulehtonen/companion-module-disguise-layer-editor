const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Connection } = require('../src/connection')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')

class Socket extends EventTarget {
  static instances = []
  constructor(url) {
    super()
    this.url = url
    this.sent = []
    Socket.instances.push(this)
  }
  send(value) {
    this.sent.push(JSON.parse(value))
  }
  close() {
    this.wasClosed = true
    this.dispatchEvent(new Event('close'))
  }
  message(value) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }))
  }
}
test('production feedback never opens faulting LiveUpdate subscriptions and retains polling targets', async () => {
  const c = new Connection({ probe: async () => [] }, () => {}, {
    WebSocketImpl: class {
      constructor() {
        throw Error('Unexpected LiveUpdate connection')
      }
    },
  })
  try {
    await c.start()
    c.watch('123', { layerUid: '456', name: 'brightness' })
    c.time = 12
    await c.check()
    assert.equal(c.time, 12)
    assert.deepEqual(c.fieldTarget, { layerUid: '456', name: 'brightness' })
    assert.equal(c.socket, null)
    c.watch('123', { layerUid: '789', name: 'volume' })
    assert.deepEqual(c.fieldTarget, { layerUid: '789', name: 'volume' })
    assert.equal(c.time, undefined)
  } finally {
    c.close()
  }
})
test('LiveUpdate subscribes with lossless hex UID, receives time and closes cleanly', async () => {
  const client = { baseUrl: 'http://localhost:80', probe: async () => [] }
  const c = new Connection(client, () => {}, { enableLiveUpdate: true, WebSocketImpl: Socket })
  await c.start()
  try {
    c.watch('18446744073709551614')
    const socket = c.socket
    socket.dispatchEvent(new Event('open'))
    assert.equal(
      socket.sent[0].subscribe.object,
      `getByUID(0x${BigInt('18446744073709551614').toString(16)})`,
    )
    assert.equal(socket.sent[0].subscribe.configuration.updateFrequencyMs, 100)
    socket.message({
      subscriptions: [
        { id: 0, propertyPath: 'object.player.tCurrent' },
        { id: 1, propertyPath: 'str(object.track.uid)' },
      ],
    })
    socket.message({
      valuesChanged: [
        { id: 0, value: 17 },
        { id: 1, value: '9007199254740993' },
      ],
    })
    assert.equal(c.live, true)
    assert.equal(c.time, 17)
    assert.equal(c.trackUid, '9007199254740993')
    c.watch('18446744073709551614')
    assert.equal(c.socket, socket)
    c.close()
    assert.equal(socket.wasClosed, true)
    assert.equal(c.live, false)
  } finally {
    c.close()
  }
})
test('HTTP failure disconnects and subsequent health check recovers without Python calls', async () => {
  let failing = true
  const c = new Connection(
    {
      probe: async () => {
        if (failing) throw new Error('offline')
        return []
      },
    },
    () => {},
  )
  await c.start()
  assert.equal(c.connected, false)
  assert.equal(c.error, 'offline')
  clearTimeout(c.timer)
  failing = false
  await c.check()
  assert.equal(c.connected, true)
  c.close()
})
test('socket error clears feedback and late messages cannot restore old values', async () => {
  const c = new Connection({ baseUrl: 'http://localhost', probe: async () => [] }, () => {}, {
    enableLiveUpdate: true,
    WebSocketImpl: Socket,
  })
  await c.start()
  c.watch('123')
  const socket = c.socket
  socket.dispatchEvent(new Event('error'))
  assert.equal(c.live, false)
  assert.equal(c.socket, null)
  socket.message({ valuesChanged: [{ id: 0, value: 500 }] })
  assert.equal(c.time, undefined)
  c.close()
})
test('stale snapshots prevent edits until explicit refresh', async () => {
  const e = new Editor(new DemoClient())
  await e.refresh()
  e.stale = true
  await assert.rejects(e.seek(), /Refresh/)
  await assert.rejects(e.write('key_set'), /Refresh/)
  await e.refresh()
  assert.equal(e.stale, false)
})

test('Designer trims update layer bounds before following time, preserving the chosen parameter', async () => {
  const e = new Editor(new DemoClient())
  await e.refresh()
  await e.selectLive('field', 1)
  const name = e.field.name,
    uid = e.layer.uid
  e.layer.start = 20
  e.layer.end = 30 // stale bounds before a trim in Designer
  const layers = e.snapshot.layers.map((l) => ({
    uid: l.uid,
    start: l.uid === uid ? 0 : l.start,
    end: l.uid === uid ? 54 : l.end,
  }))
  e.followTimeline({ trackUid: e.snapshot.trackUid, time: 9.25, layers })
  assert.equal(e.layer.uid, uid)
  assert.equal(e.field.name, name)
  assert.equal(e.time, 9.25)
  assert.equal(e.layer.start, 0)
  assert.equal(e.layer.end, 54)
})

test('timeline subscription delivers coherent bounds/time and clears them on disconnect', async () => {
  const c = new Connection({ baseUrl: 'http://localhost', probe: async () => [] }, () => {}, {
    enableLiveUpdate: true,
    WebSocketImpl: Socket,
  })
  await c.start()
  c.watch('123')
  const socket = c.socket
  socket.dispatchEvent(new Event('open'))
  assert.ok(socket.sent[0].subscribe.properties.includes(c.timelineProperty))
  socket.message({ subscriptions: [{ id: 0, propertyPath: c.timelineProperty }] })
  const timeline = { trackUid: '456', time: 9.25, layers: [{ uid: '789', start: 0, end: 54 }] }
  socket.message({ valuesChanged: [{ id: 0, value: timeline }] })
  assert.deepEqual(c.timeline, timeline)
  assert.equal(c.time, 9.25)
  assert.equal(c.trackUid, '456')
  assert.equal(c.live, true)
  c.close()
  assert.equal(c.timeline, undefined)
})

test('only active layer membership changes request metadata reload; time and inactive additions do not', async () => {
  const e = new Editor(new DemoClient())
  await e.refresh()
  const layers = e.snapshot.layers.map((l) => ({ uid: l.uid, start: l.start ?? 0, end: l.end ?? 120 }))
  e.followTimeline({ trackUid: e.snapshot.trackUid, time: 1, layers })
  assert.equal(e.stale, false)
  assert.equal(e.time, 1)
  layers.push({ uid: 'future', start: 20, end: 30 })
  e.followTimeline({ trackUid: e.snapshot.trackUid, time: 2, layers })
  assert.equal(e.stale, false)
  e.followTimeline({ trackUid: e.snapshot.trackUid, time: 20, layers })
  assert.equal(e.stale, true)
})

test('polling supplies timeline and parameter feedback when LiveUpdate is silent', async () => {
  const result = {
    timeline: {
      trackUid: '456',
      time: 12,
      layers: [{ uid: '789', start: 10, end: 30 }],
      selectedLayerUids: ['789'],
    },
    clock: { fps: 25, tcMode: '25', customFps: false },
    fieldValue: { value: 0.4, keys: [] },
  }
  const calls = []
  const c = new Connection(
    {
      execute: async (command, args) => {
        calls.push([command, args])
        return result
      },
    },
    () => {},
  )
  c.connected = true
  c.transportUid = '123'
  c.fieldTarget = { layerUid: '789', name: 'brightness' }
  c.targetKey = JSON.stringify(c.fieldTarget)
  try {
    await c.poll()
    assert.equal(c.live, false)
    assert.equal(c.polling, true)
    assert.equal(c.time, 12)
    assert.deepEqual(c.timeline, result.timeline)
    assert.deepEqual(c.fieldValue, result.fieldValue)
    assert.equal(c.clock.fps, 25)
    assert.deepEqual(calls, [['live_state', { transportUid: '123', fieldTarget: c.fieldTarget }]])
  } finally {
    c.close()
  }
})

test('Designer layer reorder updates dial order without metadata reload or changing the edit target', async () => {
  const e = new Editor(new DemoClient())
  await e.refresh()
  await e.selectLive('field', 1)
  const uid = e.layer.uid,
    name = e.field.name
  const layers = e.snapshot.layers
    .map((l) => ({ uid: l.uid, start: l.start ?? 0, end: l.end ?? 120 }))
    .reverse()
  e.followTimeline({ trackUid: e.snapshot.trackUid, time: 0, layers })
  assert.equal(e.stale, false)
  assert.equal(e.layer.uid, uid)
  assert.equal(e.field.name, name)
  assert.deepEqual(
    e.activeLayers.map((l) => l.uid),
    layers.map((l) => l.uid),
  )
})

test('polling discards a response for an old parameter or closed connection', async () => {
  let resolve
  const c = new Connection(
    {
      execute: () =>
        new Promise((r) => {
          resolve = r
        }),
    },
    () => {
      throw Error('stale feedback published')
    },
  )
  c.connected = true
  c.transportUid = '123'
  c.targetKey = 'first'
  const result = { timeline: { trackUid: '456', time: 12, layers: [] }, clock: { fps: 25 } }
  try {
    const first = c.poll()
    c.targetKey = 'second'
    resolve(result)
    await first
    assert.equal(c.time, undefined)
    clearTimeout(c.pollTimer)
    const second = c.poll()
    c.close()
    resolve(result)
    await second
    assert.equal(c.time, undefined)
  } finally {
    c.close()
  }
})
