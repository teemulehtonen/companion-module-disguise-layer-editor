'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm')
const {DisguiseLayerControl}=require('../src/main')
const {Editor}=require('../src/editor')
const {DemoClient}=require('../src/demo')
const {Connection}=require('../src/connection')
const {ViewerClock}=require('../src/viewer-clock')
async function setup() {
 const client=new DemoClient(),editor=new Editor(client)
 await editor.refresh()
 const host=Object.create(DisguiseLayerControl.prototype)
 Object.assign(host,{editor,lastError:'',queueGeneration:0,actionTail:Promise.resolve(),syncPending:false,nextSyncAttempt:0,lastContentRevision:'a',publish(){},connectionStatus(){},log(){},updateStatus(){}})
 const connection=new Connection(client,()=>{})
 connection.connected=true;connection.enableLiveUpdate=false;host.connection=connection
 const src=fs.readFileSync(require.resolve('../src/main'),'utf8').replaceAll('\r','')
 const from=src.indexOf('          (state, update) => {',src.indexOf('const connection = new Connection('))
 const end=src.indexOf('\n          },\n          {',from)
 connection.onState=vm.runInNewContext('(function(){return '+src.slice(from,end)+'}}).call(host)',{host,connection})
 return {host,editor,connection,client}
}
test('ordinary content updates preserve viewer and clock while guarded refresh is pending',async()=>{
 const {host,editor,connection,client}=await setup()
 let release
 const execute=client.execute.bind(client)
 client.execute=async(...args)=>{await new Promise(resolve=>release=resolve);return execute(...args)}
 class Socket extends EventTarget {close(){this.closed=true}send(){}}
 const clock=new ViewerClock({baseUrl:'http://localhost'},Socket)
 try {
  const context=()=>({connected:true,transportUid:'11',trackUid:editor.snapshot.trackUid,synchronizing:host.viewerSynchronizing()})
  clock.read(context());const socket=clock.socket
  connection.contentRevision='b';connection.onState(connection)
  assert.equal(editor.stale,true)
  assert.equal(host.viewerSynchronizing(),false)
  clock.read(context());assert.equal(clock.socket,socket);assert.ok(!socket.closed)
  await new Promise(resolve=>setImmediate(resolve))
  assert.ok(editor.busy)
  assert.equal(host.viewerSynchronizing(),false)
  release();await host.actionTail;await new Promise(resolve=>setImmediate(resolve))
  assert.equal(editor.stale,false)
  assert.equal(host.nextSyncAttempt,0)
  client.execute=execute
  connection.contentRevision='c';connection.onState(connection)
  assert.equal(host.syncPending,true,'Next content change starts immediately, without a one-second cooldown')
  await host.actionTail
 }finally{clock.close();connection.close()}
})
test('track changes and disconnects still block the viewer until a successful refresh',async()=>{
 const {host,editor,connection}=await setup()
 host.requestSync=()=>{}
 try {
  connection.trackUid='different-track';connection.onState(connection)
  assert.equal(host.viewerSynchronizing(),true)
  await editor.refresh({preserve:true});connection.trackUid=editor.snapshot.trackUid
  assert.equal(host.viewerSynchronizing(),false)
  connection.connected=false;connection.onState(connection)
  assert.equal(host.viewerSynchronizing(),true)
  connection.connected=true;assert.equal(host.viewerSynchronizing(),true)
  await editor.refresh({preserve:true});assert.equal(host.viewerSynchronizing(),false)
  connection.contextChanged=true;assert.equal(host.viewerSynchronizing(),true)
 }finally{connection.close()}
})
test('failed background refresh retains retry backoff',async()=>{
 const {host,editor,connection,client}=await setup()
 try {
  editor.stale=true
  client.execute=async()=>{throw Error('Read unavailable')}
  host.requestSync();await host.actionTail;await new Promise(resolve=>setImmediate(resolve))
  assert.equal(editor.stale,true)
  assert.ok(host.nextSyncAttempt>Date.now())
  assert.equal(host.lastError,'Read unavailable')
 }finally{connection.close()}
})
