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

test('separate display subscription cannot replace a confirmed seek with cached or delayed old time',()=>{
 const c=new ViewerClock({baseUrl:'http://localhost'},Socket)
 const ctx={transportUid:'1',trackUid:'1',connected:true,time:2,editRevision:1}
 try {
 c.read(ctx);const ws=c.socket;ws.dispatchEvent(new Event('open'));ws.message({subscriptions:[{id:1,propertyPath:ws.sent.subscribe.properties[0]}]})
 const sample=time=>ws.message({valuesChanged:[{id:1,value:['1',time,'00:00:00.00']}]})
 sample(9);assert.equal(c.read(ctx).time,9)
 const next={...ctx,editRevision:2,clockSeek:{time:2,until:Date.now()+1500},clockFps:25}
 assert.equal(c.read(next).time,2);sample(9);assert.equal(c.read(next).time,2)
 sample(2);assert.equal(c.read(next).time,2)
 sample(9);assert.equal(c.read(next).time,2)
 assert.equal(c.read({...next,clockSeek:{time:2,until:0}}).time,9,'expired fence follows native clock')
 sample(3);assert.equal(c.read({...ctx,editRevision:2}).time,3,'normal playback resumes without a pending seek')
 }finally{c.close()}
})

test('synchronising closes the old clock and resumes on the acknowledged transport',()=>{
 const c=new ViewerClock({baseUrl:'http://localhost'},Socket)
 const ctx={transportUid:'11',trackUid:'22',connected:true,time:1}
 try{
  c.read(ctx);const old=c.socket
  c.read({...ctx,synchronizing:true})
  assert.equal(old.closed,true);assert.equal(c.socket,null)
  c.read({...ctx,transportUid:'33',synchronizing:false})
  assert.ok(c.socket);assert.notEqual(c.socket,old)
 }finally{c.close()}
})

test('TC monitor follows transport switches and ignores late old values', () => {
  const c = new ViewerClock({ baseUrl: 'http://localhost' }, Socket)
  const ctx = { transportUid: '1', trackUid: '1', connected: true }
  const open = () => {
    const ws = c.socket
    ws.dispatchEvent(new Event('open'))
    ws.message({ subscriptions: ws.sent.subscribe.properties.map((propertyPath,id)=>({id,propertyPath})) })
    return ws
  }
  try {
    c.read(ctx)
    const old = open()
    old.message({ valuesChanged: [{ id: 1, value: ['13:03:25.15','stopped'] }] })
    assert.equal(c.read(ctx).externalTimecode.value, '13:03:25:15')
    const next = { ...ctx, transportUid: '2' }
    assert.equal(c.read(next).externalTimecode, undefined)
    const current = open()
    old.message({ valuesChanged: [{ id: 1, value: ['23:59:59.24','playing'] }] })
    assert.equal(c.read(next).externalTimecode, undefined)
    current.message({ valuesChanged: [{ id: 1, value: null }] })
    assert.equal(c.read(next).externalTimecode, null)
    current.message({ valuesChanged: [{ id: 1, value: ['00:00:00.00','playing'] }] })
    assert.equal(c.read(next).externalTimecode.value, '00:00:00:00', 'Zero is a valid monitor value')
  } finally { c.close() }
})

test('native snapshot and live TC use transport monitor for remote and local input', () => {
  const { spawnSync } = require('node:child_process')
  const c = new ViewerClock({ baseUrl: 'http://localhost' }, Socket)
  let expression
  try {
    c.read({ transportUid:'1', connected:true })
    c.socket.dispatchEvent(new Event('open'))
    expression = c.socket.sent.subscribe.properties[1]
  } finally { c.close() }
  const source = require('../src/viewer-script')
  const block = source.slice(source.indexOf("    result['externalTimecode'] = None"),source.indexOf("    result['sections'] = []"))
  const fixture = [
    'import re', 'class Obj: pass', 'manager=Obj()', 'object=manager', 'source=Obj()',
    "source.current='00:00:00.00'", "source.statusString='local input absent'", 'manager.timecode=source',
    "manager.tcStatusString='stopped'", 'def snapshot():', '    result={}', block, "    return result['externalTimecode']",
    "for monitor in ['13:03:25.15','00:00:00.00']:",
    '    manager.monitorString=monitor',
    '    live=eval('+JSON.stringify(expression)+')',
    "    assert live == [monitor, 'stopped']",
    "    assert snapshot() == {'value':monitor.replace('.',':'), 'status':'stopped'}",
    "source.current='10:02:03.04'", 'manager.monitorString=source.current',
    "assert snapshot()['value']=='10:02:03:04'",
    'manager.timecode=None', 'assert snapshot() is None',
    'assert eval('+JSON.stringify(expression)+') is None',
  ].join(String.fromCharCode(10))
  const python = ['python3','python'].find(p=>spawnSync(p,['--version'],{encoding:'utf8'}).status===0)
  assert.ok(python, 'Python required for offline TC fixture')
  const run = spawnSync(python,['-c',fixture],{encoding:'utf8',timeout:10000})
  assert.equal(run.status,0,run.stderr || run.error?.message)
})

test('TC IN shows a dash when the selected transport has no source', () => {
  const fs = require('node:fs')
  const source = fs.readFileSync(require.resolve('../src/viewer-page'),'utf8')
  const start = source.indexOf("    $('externalTc').hidden =")
  const end = source.indexOf('    const preview=',start)
  const render = new Function('external','$','setText',source.slice(start,end))
  const node = {}
  for (const [external,expected] of [[null,' · TC IN: —'],[undefined,' · TC IN: —'],[{value:'00:00:00:00'},' · TC IN: 00:00:00:00']]) {
    render(external,()=>node,(el,text)=>el.textContent=text)
    assert.equal(node.hidden,false)
    assert.equal(node.textContent,expected)
  }
})
