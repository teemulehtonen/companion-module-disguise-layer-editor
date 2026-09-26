'use strict'
const {test} = require('node:test')
const assert = require('node:assert/strict')
const {DesignerClient} = require('../src/client')
const {Editor} = require('../src/editor')
const {actions} = require('../src/definitions')

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
  for(const command of ['refresh','read_field','media_list','live_state','playback_state','resolve_timecode','key_clear_list']) await c.execute(command,{})
  for(const command of ['seek','nudge_time','jump_key']) await c.execute(command,{keepPlayhead:true})
  assert.equal(requests.length,10)
  await assert.rejects(c.execute('refresh',{command:'key_delete'}),/Invalid command/)
  assert.equal(requests.length,10)
  c.viewOnly=false;await c.execute('key_set',{})
  assert.equal(requests.length,11)
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
  e.setLinkTime(true);e.scopedKeepPlayhead=false
  assert.equal(e.linkTime,false);assert.equal(e.keepEditPlayhead,true)
  c.viewOnly=false;assert.equal(e.linkTime,false)
})
test('VIEW Deck actions keep time/layer/parameter browsing and ignore writes',async()=>{
  const calls=[]
  const e={viewOnly:true,selectLive:async kind=>calls.push(kind),adjustLiveTime:async()=>calls.push('time'),
    setTimeStep:()=>calls.push('step'),toggleLayerBrowser:()=>calls.push('layers'),adjustLiveValue:()=>assert.fail('write'),controlTransport:()=>assert.fail('transport')}
  const defs=actions({perform:fn=>fn(e),viewer:{rotateZoom:()=>false,toggleZoom:()=>calls.push('zoom')}})
  for(const id of ['layer','field','time','time_step_set','layer_press','value','transport','key_set','key_move','layer_edit','link_time'])
    await defs[id].callback({options:{direction:1,slot:0,operation:'play'}})
  assert.deepEqual(calls,['layer','field','time','step','layers'])
})
