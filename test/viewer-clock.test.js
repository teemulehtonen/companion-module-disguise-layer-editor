const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { ViewerClock } = require('../src/viewer-clock')
class Socket extends EventTarget {
  constructor() {
    super()
    Socket.all.push(this)
  }
  send(v) {
    this.sent = JSON.parse(v)
  }
  close() {
    this.closed = true
    this.dispatchEvent(new Event('close'))
  }
  message(v) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(v) }))
  }
}
Socket.all = []
test('viewer clock uses one atomic subscription, native TC and HTTP fallback', () => {
  const c = new ViewerClock({ baseUrl: 'http://localhost' }, Socket),
    ctx = {
      transportUid: '18446744073709551614',
      trackUid: '1',
      time: 2,
      timecode: '00:00:02:00',
      connected: true,
    }
  try {
    assert.deepEqual(c.read(ctx), { ...ctx, externalTimecode: undefined })
    const ws = c.socket
    ws.dispatchEvent(new Event('open'))
    assert.equal(ws.sent.subscribe.object, 'getByUID(0xfffffffffffffffe)')
    assert.equal(ws.sent.subscribe.properties.length, 2)
    ws.message({ subscriptions: [{ id: 1, propertyPath: ws.sent.subscribe.properties[0] }] })
    ws.message({ valuesChanged: [{ id: 1, value: ['1', 3, '05:00:03.00'] }] })
    assert.equal(c.read(ctx).time, 3)
    assert.equal(c.read(ctx).timecode, '05:00:03:00')
    assert.equal(c.read({ ...ctx, trackUid: '2' }).time, 2, 'Never apply another track clock')
    c.received -= 2100
    assert.deepEqual(c.read(ctx), { ...ctx, externalTimecode: undefined }, 'Stale clock falls back')
    ws.message({ error: 'Unsupported' })
    assert.equal(ws.closed, true)
    assert.deepEqual(c.read(ctx), { ...ctx, externalTimecode: undefined })
    assert.equal(c.socket, null, 'Backoff prevents reconnect loops')
  } finally {
    c.close()
  }
  assert.deepEqual(c.read(ctx), { ...ctx, externalTimecode: undefined })
  assert.equal(c.socket, null)
})
test('transport changes and disconnect close subscriptions; late messages cannot win', () => {
  const c = new ViewerClock({ baseUrl: 'http://localhost' }, Socket),
    ctx = { transportUid: '1', trackUid: '1', time: 2, connected: true }
  c.read(ctx)
  const old = c.socket
  c.read({ ...ctx, transportUid: '2' })
  assert.equal(old.closed, true)
  assert.notEqual(c.socket, old)
  c.read({ ...ctx, connected: false })
  assert.equal(c.socket, null)
  assert.equal(c.sample, null)
  c.close()
})
test('external input TC is independent of timeline TC and disappears when unconfigured or stale', () => {
  const c = new ViewerClock({ baseUrl: 'http://localhost' }, Socket)
  const ctx = { transportUid:'1', trackUid:'1', connected:true, timecode:'12:00:00:00' }
  try {
    c.read(ctx)
    const ws=c.socket
    ws.dispatchEvent(new Event('open'))
    ws.message({subscriptions:ws.sent.subscribe.properties.map((propertyPath,id)=>({id,propertyPath}))})
    ws.message({valuesChanged:[{id:1,value:['01:02:03.04','No clock']}]})
    assert.deepEqual(c.read(ctx).externalTimecode,{value:'01:02:03:04',status:'No clock'})
    assert.equal(c.read(ctx).timecode,'12:00:00:00')
    ws.message({valuesChanged:[{id:1,value:null}]})
    assert.equal(c.read(ctx).externalTimecode,null)
    c.externalReceived-=2100
    assert.equal(c.read(ctx).externalTimecode,undefined)
  } finally { c.close() }
})
