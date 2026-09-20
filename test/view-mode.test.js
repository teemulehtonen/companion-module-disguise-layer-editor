'use strict'
const {test} = require('node:test')
const assert = require('node:assert/strict')
const {DesignerClient} = require('../src/client')
const {Editor} = require('../src/editor')
const {actions} = require('../src/definitions')
const {ViewerServer} = require('../src/viewer-server')

function client() {
  const requests=[]
  const c=new DesignerClient('localhost',80,async (url,options)=>{
    requests.push({url,options})
    return {ok:true,json:async()=>({status:{code:0},returnValue:JSON.stringify({time:3,playing:false,layers:[]})})}
  })
  return {c,requests}
}
test('VIEW fails closed for every write and unknown native operations, allowing only audited reads and local seeks',async()=>{
  const {c,requests}=client();c.viewOnly=true
  for(const command of ['key_set','key_move','key_delete','key_group','constant_set','adjust_value','key_type','keys_clear',
    'parameter_default','parameter_sequence','layer_default','layer_edit','layer_manage','layer_reorder','layer_group','media_set','media_key_set',
    'section_edit','annotation_edit','select_key','future_operation','seek','nudge_time','jump_key']) {
    await assert.rejects(c.execute(command,{}),{code:'VIEW_ONLY'})
  }
  await assert.rejects(c.transport({},'play'),{code:'VIEW_ONLY'})
  await assert.rejects(c.togglePlayback({}),{code:'VIEW_ONLY'})
  assert.equal(requests.length,0)
  for(const command of ['refresh','read_field','media_list','live_state','playback_state','resolve_timecode','viewer_snapshot','viewer_audio_source','key_clear_list']) await c.execute(command,{})
  for(const command of ['seek','nudge_time','jump_key']) await c.execute(command,{keepPlayhead:true})
  assert.equal(requests.length,12)
  await assert.rejects(c.execute('refresh',{command:'key_delete'}),/Invalid command/)
  assert.equal(requests.length,12)
  c.viewOnly=false;await c.execute('key_set',{})
  assert.equal(requests.length,13)
})
test('VIEW entered during transport state read blocks the subsequent transport POST',async()=>{
  for(const method of ['transport','togglePlayback']) {
    const {c,requests}=client()
    c.execute=async()=>{c.viewOnly=true;return {playing:false}}
    await assert.rejects(c[method]({},'play'),{code:'VIEW_ONLY'})
    assert.equal(requests.length,0)
  }
})
test('VIEW forces independent time and clears editing state; returning LIVE does not re-link',()=>{
  const {c}=client();const e=new Editor(c)
  e.moveKey={time:1};e.layerEdit='edit';e.clearKeysPrompt={};e.deletePress={}
  c.viewOnly=true;e.setLinkTime(false);e.clearViewEditing()
  assert.equal(e.linkTime,false);assert.equal(e.moveKey,null);assert.equal(e.layerEdit,'')
  e.setLinkTime(true);e.viewerKeepPlayhead=false
  assert.equal(e.linkTime,false);assert.equal(e.keepEditPlayhead,true)
  c.viewOnly=false;assert.equal(e.linkTime,false)
})
test('VIEW Deck actions keep time/layer/parameter/zoom browsing and ignore writes',async()=>{
  const calls=[]
  const e={viewOnly:true,selectLive:async kind=>calls.push(kind),adjustLiveTime:async()=>calls.push('time'),
    setTimeStep:()=>calls.push('step'),adjustLiveValue:()=>assert.fail('write'),controlTransport:()=>assert.fail('transport')}
  const defs=actions({perform:fn=>fn(e),viewer:{rotateZoom:()=>false,toggleZoom:()=>calls.push('zoom')}})
  for(const id of ['layer','field','time','time_step_set','layer_press','value','transport','key_set','key_move','layer_edit','link_time'])
    await defs[id].callback({options:{direction:1,slot:0,operation:'play'}})
  assert.deepEqual(calls,['layer','field','time','step','zoom'])
})
test('VIEW mode endpoint requires token, connection and a boolean; edit requests are blocked server-side',async t=>{
  let modeCalls=0,editCalls=0
  const context={connected:true,viewOnly:false}
  const server=new ViewerServer({},()=>context,{viewMode:async enabled=>{modeCalls++;context.viewOnly=enabled;return {ok:true,viewOnly:enabled}},edit:async()=>{editCalls++;return {ok:true}}})
  t.after(()=>server.close())
  const port=await server.start(0),url='http://127.0.0.1:'+port
  const post=(path,body,token=server.selectionToken)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json','X-Viewer-Token':token},body:JSON.stringify(body)})
  assert.equal((await post('/api/view-mode',{viewOnly:true},'wrong')).status,403)
  assert.equal((await post('/api/view-mode',{viewOnly:'yes'})).status,400)
  assert.equal((await post('/api/view-mode',{viewOnly:true})).status,200)
  assert.equal(modeCalls,1)
  assert.equal((await post('/api/edit',{})).status,409);assert.equal(editCalls,0)
  context.connected=false
  assert.equal((await post('/api/view-mode',{viewOnly:false})).status,409)
  assert.equal(context.viewOnly,true)
  context.connected=true
  assert.equal((await post('/api/view-mode',{viewOnly:false})).status,200)
})
