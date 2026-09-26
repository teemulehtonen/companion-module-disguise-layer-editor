'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
const {actions}=require('../src/definitions'),{DisguiseLayerControl}=require('../src/main')
async function setup(count=25){
 const client=new DemoClient(),base=client.data.layers[0].fields[0]
 client.data.layers[0].fields=Array.from({length:count},(_,i)=>({...structuredClone(base),name:'param'+i,label:'Parameter '+i,uid:'field'+i}))
 const e=new Editor(client);await e.refresh()
 const calls=[],execute=client.execute.bind(client)
 client.execute=async(op,args)=>{calls.push(op);return execute(op,args)}
 const host=Object.create(DisguiseLayerControl.prototype)
 Object.assign(host,{editor:e,config:{},variables:{},setVariableValues(v){Object.assign(this.variables,v)},checkFeedbacks(){},loadThumbnails(){},perform(fn){return fn(e)}})
 return {e,calls,host,a:actions(host)}
}
test('parameter list pages contain twelve fields, clamp at ends and open on current field',async()=>{
 const {e,a,calls}=await setup();e.fieldIndex=14
 await a.parameter_press.callback({options:{}});assert.equal(e.parameterBrowser.page,1)
 await a.field.callback({options:{direction:1}});assert.equal(e.parameterBrowser.page,2)
 await a.field.callback({options:{direction:1}});assert.equal(e.parameterBrowser.page,2)
 await a.field.callback({options:{direction:-1}});assert.equal(e.parameterBrowser.page,1)
 e.pageParameters(-1);e.pageParameters(-1);assert.equal(e.parameterBrowser.page,0)
 assert.deepEqual(calls,[],'Opening and paging are local only')
})
test('all twelve display buttons select their own parameter, including VIEW mode',async()=>{
 for(const viewOnly of [false,true])for(let slot=0;slot<12;slot++){
  const {e,a,calls}=await setup();e.client.viewOnly=viewOnly;e.toggleParameterBrowser();e.pageParameters(1)
  if(slot<8){await a.pad_down.callback({options:{slot}});await a.pad_up.callback({options:{slot}})}
  else await a[['layer_press','parameter_press','value_press','time_step'][slot-8]].callback({options:{}})
  assert.equal(e.fieldIndex,12+slot);assert.equal(e.parameterBrowser,null);assert.equal(e.deletePress,null)
  assert.deepEqual(calls,['read_field'],'Selection must not edit a field or run old pad behavior')
 }
})
test('empty slots stay inert and list displays survive field and clock feedback',async()=>{
 const {e,host,a,calls}=await setup();e.toggleParameterBrowser();host.publish()
 for(let i=0;i<8;i++)assert.equal(host.variables['pad_'+i],'PARAMETER '+i)
 for(let i=0;i<4;i++)assert.equal(host.variables['dial_value_'+i],'PARAMETER '+(i+8))
 assert.equal(host.variables.ui_mode,'PARAMETER_LIST');assert.equal(host.variables.delete_hint,'')
 host.publishField();host.publishClock();assert.equal(host.variables.dial_value_2,'PARAMETER 10');assert.equal(host.variables.dial_value_3,'PARAMETER 11')
 e.pageParameters(1);e.pageParameters(1);host.publish()
 assert.equal(host.variables.pad_0,'PARAMETER 24');assert.equal(host.variables.pad_1,'');assert.equal(host.variables.dial_value_3,'')
 await a.pad_down.callback({options:{slot:5}});await a.pad_up.callback({options:{slot:5}})
 await a.time_step.callback({options:{}});assert.equal(e.parameterBrowser.page,2);assert.deepEqual(calls,[])
 await a.pad_down.callback({options:{slot:0}});host.publish();assert.equal(host.variables.ui_mode,'PARAMS')
})
test('stale layer, track and field lists cannot redirect a pending parameter selection',async()=>{
 for(const change of [e=>e.layer.uid='other',e=>e.snapshot.trackUid='other',e=>e.layer.fields.reverse()]){
  const {e,calls}=await setup();e.toggleParameterBrowser();change(e);await e.selectParameterSlot(5)
  assert.equal(e.parameterBrowser,null);assert.deepEqual(calls,[])
 }
 const {e}=await setup();e.layer.fields=[];e.toggleParameterBrowser();assert.ok(!e.parameterBrowser)
})
test('value press cycles precision without adding keys; custom slot action is inert outside list',async()=>{
 const {e,a,calls}=await setup();e.precision='coarse'
 for(const expected of ['fine','ultra','coarse']){await a.value_press.callback({options:{}});assert.equal(e.precision,expected)}
 await a.parameter_slot.callback({options:{slot:4}});assert.deepEqual(calls,[])
 e.toggleParameterBrowser();await a.parameter_slot.callback({options:{slot:4}});assert.equal(e.fieldIndex,3);assert.deepEqual(calls,['read_field'])
 e.layerEdit='edit';const step=e.timeStep;await a.value_press.callback({options:{}});assert.notEqual(e.timeStep,step)
})
test('other encoder turns cannot modify values, time or layer while selecting parameters',async()=>{
 const {e,a,calls}=await setup();e.toggleParameterBrowser();const before=[e.layerIndex,e.time,e.value]
 for(const name of ['layer','value','time'])await a[name].callback({options:{direction:1,step:1}})
 assert.deepEqual([e.layerIndex,e.time,e.value],before);assert.deepEqual(calls,[])
})

test('third physical encoder adds a key while the value display only changes precision',async()=>{
 const {e,a,calls}=await setup();const precision=e.precision
 await a.key_set.callback({options:{}})
 assert.ok(calls.includes('key_set'));assert.equal(e.precision,precision)
 const count=calls.length;await a.value_press.callback({options:{}})
 assert.notEqual(e.precision,precision);assert.equal(calls.length,count)
 e.client.viewOnly=true;await a.key_set.callback({options:{}})
 assert.equal(calls.length,count,'VIEW must block physical key insertion')
})
