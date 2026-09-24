'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ViewerServer } = require('../src/viewer-server')

async function setup(t) {
  let calls = 0
  const context = { trackUid: '1', focusUid: '2', time: 3, connected: true }
  const client = {
    execute: async () => {
      calls++
      return {
        trackUid: '1',
        time: 0,
        warnings: [],
        layers: [
          {
            uid: '2',
            moduleType: 'VideoModule',
            fields: [],
            resources: [
              { name: 'media', sequenced: false, keys: [], current: { uid: '123', thumbnail: true } },
            ],
          },
        ],
      }
    },
    annotations: async () => ({ tags: [], notes: [] }),
    thumbnail: async () => Buffer.from('test-png').toString('base64'),
  }
  const server = new ViewerServer(client, () => context)
  t.after(() => server.close())
  const port = await server.start(0)
  return { server, client, context, url: `http://127.0.0.1:${port}`, calls: () => calls }
}

test('viewer serves read-only assets and coalesces live requests', async (t) => {
  const s = await setup(t)
  const result = await Promise.all(
    Array.from({ length: 6 }, () => fetch(s.url + '/api/state').then((r) => r.json())),
  )
  assert.equal(s.calls(), 1)
  for (let i = 0; i < 5; i++) assert.equal((await fetch(s.url + '/api/live')).status, 200)
  assert.equal(s.calls(), 1, 'Fast live feedback must not query Designer again')
  assert.equal(result[0].time, 3)
  assert.equal(result[0].focusUid, '2')
  for (const path of ['/', '/viewer.js', '/viewer.css']) assert.equal((await fetch(s.url + path)).status, 200)
  assert.equal((await fetch(s.url + '/api/state', { method: 'POST' })).status, 405)
  assert.equal(
    (await fetch(s.url + '/api/state', { headers: { Origin: 'https://example.com' } })).status,
    403,
  )
  assert.equal((await fetch(s.url + '/api/thumbnail/123')).status, 200)
  assert.equal((await fetch(s.url + '/api/thumbnail/999')).status, 404)
  assert.equal((await fetch(s.url + '/api/state?start=NaN')).status, 503)
})

test('stable playback keeps heavy geometry cached longer than stopped editing', async t => {
  const s=await setup(t)
  s.context.playing=true
  await s.server.state(new URLSearchParams())
  s.server.updated-=2000
  await s.server.state(new URLSearchParams())
  assert.equal(s.calls(),1,'Playback reuses geometry for five seconds')
  s.context.playing=false
  await s.server.state(new URLSearchParams())
  assert.equal(s.calls(),2,'Stopped editing retains the 1.5 second recovery refresh')
})

test('focus changes refresh data and track changes cannot retain the old focus', async (t) => {
  const s = await setup(t)
  await s.server.state(new URLSearchParams())
  s.context.focusUid = 'other'
  await s.server.state(new URLSearchParams())
  assert.equal(s.calls(), 2)
  s.context.trackUid = 'new'
  const data = await s.server.state(new URLSearchParams())
  assert.equal(data.synchronizing, true)
  assert.equal(data.layers, undefined)
})

test('unavailable Designer returns an explicit error without native details', async (t) => {
  const s = await setup(t)
  s.client.execute = async () => {
    throw new Error('private project path')
  }
  const response = await fetch(s.url + '/api/state')
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /private project/)
})

test('port conflict is isolated and shutdown releases the port', async (t) => {
  const s = await setup(t)
  const other = new ViewerServer(s.client, () => s.context)
  const port = s.server.server.address().port
  await assert.rejects(other.start(port), { code: 'EADDRINUSE' })
  await other.close()
  await s.server.close()
  const replacement = new ViewerServer(s.client, () => s.context)
  t.after(() => replacement.close())
  assert.equal(await replacement.start(port), port)
})

test('live values remain available while a geometry refresh is pending', async (t) => {
  const s = await setup(t)
  await s.server.state(new URLSearchParams())
  let release
  const original = s.client.execute
  s.client.execute = async (...args) => { await new Promise(resolve => { release = resolve }); return original(...args) }
  s.context.contentRevision = 'edited'
  s.context.liveValue = 0.75
  const pending = s.server.state(new URLSearchParams())
  const live = await fetch(s.url + '/api/live').then(r => r.json())
  assert.equal(live.liveValue, 0.75)
  assert.equal(live.contentRevision, 'edited')
  release()
  const snapshot = await pending
  assert.equal(snapshot.liveValue, 0.75)
})

test('thumbnail failure is retried and successful bytes are cached', async t => {
  const s = await setup(t)
  await s.server.state(new URLSearchParams())
  let calls = 0
  s.client.thumbnail = async () => ++calls === 1 ? '' : Buffer.from('recovered').toString('base64')
  assert.equal((await fetch(s.url + '/api/thumbnail/123')).status,404)
  assert.equal(await (await fetch(s.url + '/api/thumbnail/123?retry=1')).text(),'recovered')
  assert.equal((await fetch(s.url + '/api/thumbnail/123')).status,200)
  assert.equal(calls,2)
})

test('timing setting changes bypass the old grid cache and reach native reads',async t=>{
 const s=await setup(t)
 s.context.editor={gridSteps:{beat:1,second:0.04}}
 const original=s.client.execute
 let args
 s.client.execute=async (command,input)=>{args=input;return original(command,input)}
 await s.server.state(new URLSearchParams())
 assert.deepEqual(args.gridSteps,{beat:1,second:0.04})
 s.context.editor.gridSteps={beat:0.25,second:0.5}
 await s.server.state(new URLSearchParams())
 assert.equal(s.calls(),2)
 assert.deepEqual(args.gridSteps,{beat:0.25,second:0.5})
})

test('viewer pins transport identity, coalesces switch notifications and resumes the acknowledged context',async t=>{
 const s=await setup(t)
 s.context.transportUid='11'
 let notices=0,reads=0,args
 const original=s.client.execute
 s.client.execute=async(command,input)=>{reads++;args=input;return {...await original(),transportUid:'33'}}
 s.server.options.contextChanged=(expected,next)=>{
  notices++;assert.equal(expected.transportUid,'11');assert.equal(next.transportUid,'33')
  s.context.synchronizing=true
 }
 const first=await s.server.state(new URLSearchParams())
 assert.equal(first.synchronizing,true);assert.equal(first.connected,true)
 assert.equal(args.transportUid,'11');assert.equal(args.trackUid,'1')
 for(let i=0;i<20;i++)assert.equal((await s.server.state(new URLSearchParams())).synchronizing,true)
 assert.equal(reads,1);assert.equal(notices,1)
 s.context.transportUid='33';s.context.synchronizing=false;s.server.syncUntil=0
 const ready=await s.server.state(new URLSearchParams())
 assert.equal(ready.transportUid,'33');assert.equal(ready.trackUid,'1')
 assert.equal(ready.synchronizing,undefined);assert.equal(reads,2)
})

test('late full snapshots cannot overwrite a new transport with the same track UID',async t=>{
 const s=await setup(t)
 s.context.transportUid='11'
 const original=s.client.execute
 let release
 s.client.execute=async()=>{await new Promise(r=>release=r);return {...await original(),transportUid:'11'}}
 const pending=s.server.state(new URLSearchParams())
 s.context.transportUid='33';release()
 const result=await pending
 assert.equal(result.synchronizing,true)
 assert.equal(s.server.cache,null)
 s.client.execute=async()=>({...await original(),transportUid:'33'})
 assert.equal((await s.server.state(new URLSearchParams())).transportUid,'33')
})

test('failed snapshot reads back off instead of retrying Python on each browser poll',async t=>{
 const s=await setup(t)
 let calls=0
 const original=s.client.execute
 s.client.execute=async()=>{calls++;throw Error('Temporary failure')}
 for(let i=0;i<20;i++)await assert.rejects(s.server.state(new URLSearchParams()),/Temporary failure/)
 assert.equal(calls,1)
 s.server.retryAt=0;s.client.execute=original
 assert.equal((await s.server.state(new URLSearchParams())).trackUid,'1')
 assert.equal(s.server.readFailure,null)
})
