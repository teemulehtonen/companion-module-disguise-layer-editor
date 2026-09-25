'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const {spawnSync}=require('node:child_process')
const {Connection}=require('../src/connection')
const {Editor}=require('../src/editor')
const {DemoClient}=require('../src/demo')
const {DisguiseLayerControl}=require('../src/main')
const {makeScript}=require('../src/designer-script')
const {DesignerClient}=require('../src/client')
const {browserScript}=require('../src/viewer-page')

test('GUI transport switches resynchronise through the real host queue without native writes',async()=>{
 const data=new DemoClient().data
 data.transportUid='11';data.trackUid='22'
 let available=true,refreshes=0
 const client={execute:async(command,args)=>{
  if(command==='refresh'){refreshes++;return structuredClone(data)}
  assert.equal(command,'live_state','Only read commands are permitted')
  if(!available || args.transportUid!==data.transportUid)return {contextChanged:true,contextAvailable:available,transportUid:data.transportUid,trackUid:available?data.trackUid:null}
  return {timeline:{transportUid:data.transportUid,trackUid:data.trackUid,time:data.time,layers:[]},clock:{fps:25}}
 }}
 const editor=new Editor(client);await editor.refresh()
 const host=Object.create(DisguiseLayerControl.prototype)
 Object.assign(host,{editor,lastError:'',queueGeneration:0,actionTail:Promise.resolve(),syncPending:false,nextSyncAttempt:0,config:{},publish(){},connectionStatus(){},log(){},updateStatus(){}})
 const connection=new Connection(client,()=>{})
 host.connection=connection;connection.connected=true;connection.schedulePoll=()=>{};connection.watch('11')
 const src=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8').replaceAll(String.fromCharCode(13),'')
 const from=src.indexOf('          (state, update) => {',src.indexOf('const connection = new Connection('))
 const end=src.indexOf(String.fromCharCode(10)+'          },'+String.fromCharCode(10)+'          {',from)
 assert.ok(from>=0 && end>from)
 connection.onState=vm.runInNewContext('(function(){return '+src.slice(from,end)+'}}).call(host)',{host,connection})
 try{
  for(const [transport,track] of [['33','22'],['11','44'],['33','22']]){
   data.transportUid=transport;data.trackUid=track;host.nextSyncAttempt=0
   await connection.poll();await host.actionTail
   assert.equal(editor.snapshot.transportUid,transport)
   assert.equal(editor.snapshot.trackUid,track)
   assert.equal(connection.transportUid,transport)
   assert.equal(editor.stale,false)
   assert.equal(connection.contextChanged,false)
   assert.equal(host.lastError,'')
  }
  available=false;host.nextSyncAttempt=0
  const before=refreshes
  await connection.poll();await host.actionTail
  assert.equal(refreshes,before,'No heavy refresh while no track is selected')
  assert.equal(editor.stale,true)
  available=true;data.transportUid='55';host.nextSyncAttempt=0
  await connection.poll();await host.actionTail
  assert.equal(editor.snapshot.transportUid,'55')
  assert.equal(editor.stale,false)
 }finally{connection.close()}
})

test('native read guards signal context changes while mutation guards still reject stale targets',t=>{
 const python=['python3','python'].find(c=>spawnSync(c,['--version'],{encoding:'utf8'}).status===0)
 if(!python)return t.skip('Python required for isolated native context fixture')
 const script=makeScript('live_state')
 const block=script.slice(script.indexOf('    manager = guisystem.currentTransportManager'),script.indexOf('    def edit_seconds'))
 const fixture="class Obj: pass\nguisystem=Obj()\nm=Obj(); m.uid=33; m.track=Obj(); m.track.uid=22\nguisystem.currentTransportManager=m\ndef guard(p):\n"+block+"\nfor command in ['live_state','viewer_snapshot','refresh']:\n    result=guard({'command':command,'transportUid':'11','trackUid':'22'})\n    assert result['contextChanged'] and result['transportUid']=='33'\nassert guard({'command':'viewer_snapshot','transportUid':'33','trackUid':'22'}) is None\ntry: guard({'command':'key_move','transportUid':'11','trackUid':'22'})\nexcept ValueError as e: assert 'Transport changed' in str(e)\nelse: raise AssertionError('Mutation guard bypassed')\nm.track=None\nassert guard({'command':'live_state'})['contextAvailable'] is False\nguisystem.currentTransportManager=None\nassert guard({'command':'viewer_snapshot'})['transportUid'] is None\n"
 const run=spawnSync(python,['-c',fixture],{encoding:'utf8',timeout:10000})
 assert.equal(run.status,0,run.stderr||run.error?.message)
})

test('client classifies selection changes without retrying a command',async()=>{
 let calls=0
 const context={contextChanged:true,contextAvailable:true,transportUid:'33',trackUid:'22'}
 const c=new DesignerClient('localhost',80,async()=>{calls++;return {ok:true,json:async()=>({status:{code:0},returnValue:context})}})
 assert.deepEqual(await c.execute('live_state'),context)
 await assert.rejects(c.execute('viewer_snapshot'),{code:'CONTEXT_CHANGED'})
 await assert.rejects(c.execute('refresh'),{code:'CONTEXT_CHANGED'})
 assert.equal(calls,3)
 const rejected=new DesignerClient('localhost',80,async()=>({ok:false,status:500,json:async()=>({status:{message:'Transport changed. Refresh before editing.'}})}))
 await assert.rejects(rejected.execute('key_move'),{code:'CONTEXT_CHANGED'})
})

test('browser synchronising state disables stale interaction and keeps transport clocks isolated',()=>{
 const nodes={},state={editEnabled:true,seekEnabled:true,selectionEnabled:true}
 const c={state,latestLive:{},rendered:'old',lastFullRead:100,presentation:{clear(){}},updateEditorControls(){},$:id=>nodes[id]||(nodes[id]={})}
 vm.createContext(c)
 vm.runInContext(browserScript.slice(browserScript.indexOf('  function showSynchronizing('),browserScript.indexOf('  async function pollLive(')),c)
 assert.equal(c.showSynchronizing({connected:true,synchronizing:true}),true)
 assert.equal(nodes.status.textContent,'SYNCHRONISING')
 assert.equal(state.editEnabled,false);assert.equal(state.seekEnabled,false)
 assert.equal(c.latestLive,null)
 vm.runInContext(browserScript.slice(browserScript.indexOf('  function mergeLiveClock('),browserScript.indexOf('  async function poll()')),c)
 const snapshot={transportUid:'1',trackUid:'same',time:1}
 c.mergeLiveClock(snapshot,{transportUid:'2',trackUid:'same',time:99},0)
 assert.equal(snapshot.time,1)
})
