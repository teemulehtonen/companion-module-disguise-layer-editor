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

test('a write invalidates cached feedback and delayed same-parameter polls', async () => {
  let resolvePoll
  const c = new Connection(
    {
      execute: () =>
        new Promise((resolve) => {
          resolvePoll = resolve
        }),
      probe: async () => [],
    },
    () => {},
  )
  c.connected = true
  c.transportUid = '1'
  c.targetKey = 'brightness'
  c.fieldValue = { value: 0, sequenced: false }
  const pending = c.poll()
  c.invalidateFeedback()
  resolvePoll({
    timeline: { time: 1, layers: [] },
    fieldValue: { value: 0, sequenced: false },
    clock: { fps: 25 },
  })
  try {
    await pending
    await c.check()
    assert.equal(c.fieldValue, undefined)
    assert.equal(c.timeline, undefined)
  } finally {
    c.close()
  }
})
test('transport master feedback publishes changed external values without waiting for health checks', async () => {
  let result = [{ uid: '1', name: 'Music', brightness: 0.2, volume: 0.2, engaged: true, playmode: 'Stop' }]
  let publishes = 0
  const c = new Connection({ listTransports: async () => result }, () => publishes++)
  c.connected = true
  c.scheduleMasterPoll = () => {}
  c.masterTransports = structuredClone(result)
  try {
    await c.pollMasters()
    assert.equal(publishes, 0)
    result = [{ ...result[0], brightness: 0.7, volume: 0.7 }]
    await c.pollMasters()
    assert.equal(publishes, 1)
    assert.equal(c.masterTransports[0].brightness, 0.7)

    let release
    c.client.listTransports = () => new Promise(resolve => { release = resolve })
    const pending = c.pollMasters()
    c.invalidateMasterFeedback()
    release([{ ...result[0], brightness: 0.1, volume: 0.1 }])
    await pending
    assert.equal(c.masterTransports[0].brightness, 0.7)
    assert.equal(publishes, 1)
  } finally {
    c.close()
  }
})
test('transport names and slots stay cached until explicit refresh while levels remain live', async () => {
  let result = [{ uid: '1', name: 'Music', brightness: 0.2, volume: 0.2 }]
  let reads = 0
  const updates = []
  const c = new Connection({ probe: async () => [], listTransports: async () => { reads++; return structuredClone(result) } }, (_, update) => updates.push(update))
  c.scheduleMasterPoll = () => {}
  try {
    await c.check()
    clearTimeout(c.timer)
    result = [{ uid: '2', name: 'New', brightness: 1, volume: 1 }, { uid: '1', name: 'Renamed', brightness: 0.7, volume: 0.7 }]
    await c.pollMasters()
    assert.deepEqual(c.masterTransports, [{ uid: '1', name: 'Music', brightness: 0.7, volume: 0.7 }])
    const before = reads
    await c.check()
    clearTimeout(c.timer)
    assert.equal(reads, before, 'health checks must not reread the inventory')
    await c.refreshMasterTransports()
    assert.deepEqual(c.masterTransports, result)
    assert.equal(updates.at(-1).names, true)
    c.client.listTransports = async () => { throw Error('offline') }
    await assert.rejects(c.refreshMasterTransports(), /offline/)
    assert.deepEqual(c.masterTransports, result, 'failed refresh retains the previous list')
  } finally { c.close() }
})
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
        { id: 0, propertyPath: 'object.track.beatToTime(object.player.tCurrent)' },
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
test('fast clock publishes at frame cadence without running the full state callback',async()=>{
 let full=0,fast=0
 const client={baseUrl:'http://localhost:80',probe:async()=>[]}
 const c=new Connection(client,()=>full++,{enableLiveUpdate:true,WebSocketImpl:Socket,onClock:()=>fast++})
 await c.start();full=0
 try{
  c.watch('123');const socket=c.socket;socket.dispatchEvent(new Event('open'))
  const subscription=socket.sent.find(item=>item.subscribe.configuration.updateFrequencyMs===40)
  assert.ok(subscription);assert.deepEqual(subscription.subscribe.properties,[c.fastClockProperty])
  socket.message({subscriptions:[{id:7,propertyPath:c.fastClockProperty}]})
  socket.message({valuesChanged:[{id:7,value:{time:12.04,timecodeSample:{seconds:12.04,label:'00:00:12.01'},playing:true,trackUid:'55'}}]})
  assert.equal(fast,1);assert.equal(full,0)
  assert.equal(c.time,12.04);assert.equal(c.trackUid,'55');assert.equal(c.fastClock.playing,true)
 }finally{c.close()}
})
test('timeline clock movement bypasses full state publication until UI geometry changes',async()=>{
 const updates=[],samples=[]
 const c=new Connection({baseUrl:'http://localhost',probe:async()=>[]},(_state,update)=>updates.push(update),{enableLiveUpdate:true,WebSocketImpl:Socket,onClock:(_state,sample)=>samples.push(sample)})
 await c.start();updates.length=0
 try{
  c.watch('123');const socket=c.socket;socket.dispatchEvent(new Event('open'))
  socket.message({subscriptions:[{id:8,propertyPath:c.timelineProperty}]})
  const base={trackUid:'55',time:1,playing:true,selectedLayerUids:['7'],layers:[{uid:'7',start:0,end:10}]}
  socket.message({valuesChanged:[{id:8,value:base}]})
  assert.equal(updates.length,1);assert.equal(samples.length,1)
  socket.message({valuesChanged:[{id:8,value:{...base,time:1.1}}]})
  assert.equal(updates.length,1);assert.equal(samples.length,2)
  c.fastClock={...base,time:1.15}
  socket.message({valuesChanged:[{id:8,value:{...base,time:1.16}}]})
  assert.equal(updates.length,1);assert.equal(samples.length,2)
  socket.message({valuesChanged:[{id:8,value:{...base,time:1.2,layers:[{uid:'7',start:0,end:11}]}}]})
  assert.equal(updates.length,2);assert.equal(samples.length,2)
 }finally{c.close()}
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
  assert.equal(c.fastClock, undefined)
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
test('HTTP fallback promotes the current native timecode sample to a live anchor',async()=>{
 const result={timeline:{time:12,layers:[],trackUid:'22',transportUid:'11',playing:true},timecodeSamples:[{seconds:0,label:'05:00:00.00'},{seconds:12,label:'05:00:12.00'}],clock:{fps:25,tcMode:'25',customFps:false,beatMode:false}}
 const c=new Connection({execute:async()=>result},()=>{})
 c.connected=true;c.transportUid='11';c.targetKey=JSON.stringify(null);c.schedulePoll=()=>{}
 try{
  await c.poll()
  assert.deepEqual(c.timeline.timecodeSample,{seconds:12,label:'05:00:12.00'})
  const e=new Editor(new DemoClient());await e.refresh();e.snapshot.trackUid='22';e.snapshot.transportUid='11'
  c.timeline.layers=e.snapshot.layers.map(layer=>({uid:layer.uid,start:0,end:20}))
  e.activeLayerSignature=e.snapshot.layers.map(layer=>layer.uid).sort().join(',')
  e.followTimeline(c.timeline)
  assert.deepEqual(e.liveTimecodeSample,{seconds:12,label:'05:00:12.00'})
 }finally{c.close()}
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

test('heartbeat pulses only after a successful response and clears on timeout, failure and close', async () => {
  let fail = false
  const c = new Connection(
    {
      probe: async () => {
        if (fail) throw Error('offline')
        return []
      },
    },
    () => {},
  )
  try {
    assert.ok(!c.heartbeat)
    await c.check()
    assert.equal(c.heartbeat, true)
    await new Promise((resolve) => setTimeout(resolve, 240))
    assert.equal(c.heartbeat, false)
    await c.check()
    assert.equal(c.heartbeat, true)
    fail = true
    await c.check()
    assert.equal(c.heartbeat, false)
    fail = false
    await c.check()
    c.close()
    assert.equal(c.heartbeat, false)
  } finally {
    c.close()
  }
})

test('new LiveUpdate feedback supersedes an in-flight HTTP poll', async () => {
  let resolve
  const c = new Connection(
    { baseUrl: 'http://localhost', execute: () => new Promise((r) => (resolve = r)) },
    () => {},
    { enableLiveUpdate: true, WebSocketImpl: Socket },
  )
  c.connected = true
  c.watch('123')
  const socket = c.socket
  socket.message({ subscriptions: [{ id: 1, propertyPath: c.timelineProperty }] })
  const pending = c.poll()
  socket.message({ valuesChanged: [{ id: 1, value: { time: 20, trackUid: '1', layers: [] } }] })
  resolve({ timeline: { time: 10, layers: [] }, clock: { fps: 25 } })
  await pending
  assert.equal(c.time, 20)
  c.invalidateFeedback()
  socket.message({ valuesChanged: [{ id: 1, value: { time: 5, trackUid: '1', layers: [] } }] })
  assert.equal(c.time, undefined)
  c.close()
})

test('read-only live polling retains time-to-beat mode transitions',async()=>{
 let beatMode=false
 const c=new Connection({execute:async()=>({timeline:{trackUid:'1',time:5,layers:[]},clock:{fps:25,beatMode}})},()=>{})
 c.connected=true;c.transportUid='2';c.schedulePoll=()=>{}
 try{
  for(const mode of [false,true,false]){beatMode=mode;await c.poll();assert.equal(c.clock.beatMode,mode)}
 }finally{c.close()}
})

test('transport-change polling beats obsolete LiveUpdate traffic and closes the old subscription',async()=>{
 let resolve
 const c=new Connection({baseUrl:'http://localhost',execute:()=>new Promise(r=>resolve=r)},()=>{}, {enableLiveUpdate:true,WebSocketImpl:Socket})
 c.connected=true;c.schedulePoll=()=>{};c.watch('11')
 try{
  const socket=c.socket
  socket.message({subscriptions:[{id:1,propertyPath:c.timelineProperty}]})
  const pending=c.poll()
  socket.message({valuesChanged:[{id:1,value:{trackUid:'22',time:1,layers:[]}}]})
  resolve({contextChanged:true,contextAvailable:true,transportUid:'33',trackUid:'44'})
  await pending
  assert.equal(c.contextChanged,true);assert.equal(c.connected,true)
  assert.equal(socket.wasClosed,true);assert.equal(c.socket,null);assert.equal(c.timeline,undefined)
  c.watch('33')
  assert.equal(c.contextChanged,false);assert.equal(c.transportUid,'33')
 }finally{c.close()}
})

test('late context-change errors from superseded requests cannot invalidate a new target',async()=>{
 let reject
 const c=new Connection({execute:()=>new Promise((_,r)=>reject=r)},()=>{throw Error('Obsolete error published')})
 c.connected=true;c.schedulePoll=()=>{};c.watch('11')
 try{
  const pending=c.poll();c.watch('33')
  reject(Object.assign(new Error('Selection changed'),{code:'CONTEXT_CHANGED'}))
  await pending
  assert.equal(c.contextChanged,false);assert.equal(c.transportUid,'33')
 }finally{c.close()}
})

test('startup without a selected transport keeps light polling until a track becomes available',async()=>{
 let available=false,notified=0
 const c=new Connection({execute:async(command,args)=>{
  assert.equal(command,'live_state');assert.equal(args.transportUid,undefined)
  return available?{timeline:{trackUid:'22',transportUid:'11',time:0,layers:[]},clock:{fps:25}}:{contextChanged:true,contextAvailable:false,trackUid:null,transportUid:null}
 }},()=>notified++)
 c.connected=true;c.contextChanged=true;c.contextAvailable=false;c.schedulePoll=()=>{}
 try{
  await c.poll();assert.equal(c.contextAvailable,false)
  available=true;await c.poll()
  assert.equal(c.contextAvailable,true);assert.equal(c.trackUid,'22');assert.equal(notified,2)
 }finally{c.close()}
})

test('manual transport refresh coalesces reads and protects newer fader levels and closed connections', async () => {
  let release, reads = 0, publishes = 0
  const c = new Connection({ listTransports: () => { reads++; return new Promise(resolve => { release = resolve }) } }, () => publishes++)
  c.masterTransports = [{ uid: '1', name: 'Old', brightness: 0.2, volume: 0.2 }]
  const first = c.refreshMasterTransports()
  assert.equal(c.refreshMasterTransports(), first)
  assert.equal(reads, 1)
  c.invalidateMasterFeedback()
  c.masterTransports[0].brightness = c.masterTransports[0].volume = 0.8
  release([{ uid: '1', name: 'New', brightness: 0.1, volume: 0.1 }])
  await first
  assert.deepEqual(c.masterTransports, [{ uid: '1', name: 'New', brightness: 0.8, volume: 0.8 }])
  const pending = c.refreshMasterTransports()
  c.close()
  release([])
  await pending
  assert.equal(c.masterTransports.length, 1)
  assert.equal(publishes, 1)
})
test('master inventory caches only the first eight Designer transports',async()=>{
 const c=new Connection({async listTransports(){return Array.from({length:12},(_,i)=>({uid:String(i+1),name:'T'+(i+1),brightness:1,volume:1}))}},()=>{})
 await c.refreshMasterTransports()
 assert.deepEqual(c.masterTransports.map(t=>t.uid),['1','2','3','4','5','6','7','8'])
 c.close()
})
