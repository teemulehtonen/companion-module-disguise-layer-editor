'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {Editor}=require('../src/editor')
const {DemoClient}=require('../src/demo')
const {editFromViewer,describeEditor}=require('../src/viewer-editor')
function setup(){const c=new DemoClient();c.data.trackUid='1';c.data.layers[0].uid='2';return c}
test('first numeric key uses clicked time despite delayed transport feedback',async()=>{
 const c=setup(),execute=c.execute.bind(c)
 c.execute=async(command,args)=>{if(command==='seek')return{time:args.time};return execute(command,args)}
 const e=new Editor(c);await e.refresh()
 const result=await editFromViewer(e,{action:'key_insert',token:describeEditor(e).token,trackUid:'1',layerUid:'2',parameter:'speed',targetTime:7.23})
 assert.equal(result.ok,true)
 const field=c.data.layers[0].fields.find(f=>f.name==='speed')
 assert.equal(field.sequenced,true)
 assert.ok(field.keys.some(k=>k.time===7.24))
 assert.equal(field.keys[0].time,0)
 assert.equal(e.moveKey.time,7.24)
})
test('resource insertion pins clicked time until file confirmation and uses media_key_set',async()=>{
 const c=setup(),execute=c.execute.bind(c),writes=[]
 c.execute=async(command,args)=>{
  if(command==='seek')return{time:args.time}
  if(command==='media_list')return{canAnimate:true,selectedUid:'10',media:[{uid:'10',name:'Clip',folder:'Video',path:'objects/video/Clip'}]}
  if(command==='media_key_set'||command==='media_set'){writes.push({command,...args});return{}}
  return execute(command,args)
 }
 const e=new Editor(c);await e.refresh()
 const result=await editFromViewer(e,{action:'key_insert',token:describeEditor(e).token,trackUid:'1',layerUid:'2',parameter:'video',targetTime:8})
 assert.equal(result.ok,true);assert.equal(e.mediaKeyframe,true);assert.equal(e.mediaKeyTime,8)
 e.time=2
 await e.pressValue()
 assert.equal(writes.length,1);assert.equal(writes[0].command,'media_key_set');assert.equal(writes[0].targetTime,8)
})
