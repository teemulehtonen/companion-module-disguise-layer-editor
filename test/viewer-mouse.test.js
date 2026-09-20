'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {Editor}=require('../src/editor')
const {DemoClient}=require('../src/demo')
const {describeEditor,editFromViewer,validEditRequest}=require('../src/viewer-editor')
const send=(e,request)=>editFromViewer(e,{token:describeEditor(e).token,...request})
test('time and value drag is one native operation with guarded resource rejection',async()=>{
 const c=new DemoClient(),e=new Editor(c);await e.refresh();await e.pressValue();await e.toggleMoveKey()
 const execute=c.execute.bind(c),calls=[]
 c.execute=async(command,args)=>{calls.push(command);return execute(command,args)}
 for(const time of [2,3,4]) {
  const response=await send(e,{action:'drag_time',mode:'key',targetTime:time,targetValue:0.7,snap:false})
  assert.equal(response.ok,true);assert.equal(e.moveKey.time,time);assert.equal(e.moveKey.value,0.7)
 }
 assert.deepEqual(calls,['key_move','key_move','key_move'])
 e.field.resource=true
 assert.equal((await send(e,{action:'drag_time',mode:'key',targetTime:5,targetValue:0.9,snap:false})).ok,false)
 assert.equal(calls.length,3)
})
test('mouse key selection uses the clicked time even before transport feedback catches up',async()=>{
 const client=new DemoClient();const e=new Editor(client);await e.refresh()
 const field=client.data.layers.find(l=>l.uid===e.layer.uid).fields.find(f=>f.name===e.field.name)
 field.sequenced=true
 field.keys=[{time:0,value:0.1,interpolation:2},{time:10,value:0.9,interpolation:2}]
 await e.refresh()
 e.time=0
 assert.equal((await send(e,{action:'key_move',keyTime:10})).ok,true)
 assert.equal(e.moveKey.time,10)
 assert.equal(e.moveKey.value,0.9)
})
test('pointer value edits retain the selected key and reject stale or resource targets',async()=>{
 const e=new Editor(new DemoClient());await e.refresh()
 assert.equal((await send(e,{action:'drag_value',targetValue:0.7})).ok,false)
 await e.pressValue();await e.toggleMoveKey()
 const time=e.moveKey.time
 assert.equal((await send(e,{action:'drag_value',targetValue:0.7})).ok,true)
 assert.ok(Math.abs(e.moveKey.value-0.7)<1e-8);assert.equal(e.moveKey.time,time)
 const stale={action:'drag_value',targetValue:0.8,token:describeEditor(e).token}
 e.cycleTimeStep()
 assert.equal((await editFromViewer(e,stale)).ok,false)
 assert.equal(validEditRequest({...stale,targetValue:NaN}),false)
})
test('pointer timing uses the shared layer/key editor, preserving lock and bounds',async()=>{
 const e=new Editor(new DemoClient());await e.refresh()
 assert.equal((await send(e,{action:'drag_time',mode:'move',targetTime:3,snap:false})).ok,false)
 await e.toggleLayerEditor()
 assert.equal((await send(e,{action:'drag_time',mode:'in',targetTime:-200,snap:false})).ok,true)
 assert.equal(e.layer.start,0)
 await send(e,{action:'drag_time',mode:'out',targetTime:1e6,snap:false})
 assert.equal(e.layer.end,e.snapshot.length)
 await e.toggleLayerEditor();await e.pressValue();await e.toggleMoveKey()
 const name=e.field.name, uid=e.layer.uid
 await send(e,{action:'drag_time',mode:'key',targetTime:3,snap:false})
 assert.equal(e.moveKey.time,3)
 assert.equal(e.layer.uid,uid);assert.equal(e.field.name,name)
 const stale={action:'drag_time',mode:'key',targetTime:4,snap:false,token:describeEditor(e).token}
 e.cycleTimeStep()
 assert.equal((await editFromViewer(e,stale)).ok,false)
 assert.equal(e.moveKey.time,3)
})
test('Delete is a selected-key action and cannot become default or a resource tile',async()=>{
 const e=new Editor(new DemoClient());await e.refresh()
 assert.equal((await send(e,{action:'key_delete'})).ok,false)
 await e.pressValue();await e.toggleMoveKey()
 e.mediaMode=true
 assert.equal((await send(e,{action:'key_delete'})).ok,false)
})
test('new mouse commands reject nonfinite times, arbitrary fields and unguarded marker moves',()=>{
 const token='a'.repeat(64)
 const marker={action:'annotation',token,mode:'add',kind:'cue',targetTime:2,text:'12'}
 assert.equal(validEditRequest(marker),true)
 assert.equal(validEditRequest({...marker,mode:'move'}),false)
 assert.equal(validEditRequest({...marker,mode:'move',sourceTime:1,sourceText:'12'}),true)
 for(const change of [{path:'x'},{kind:'python'},{targetTime:Infinity},{targetTime:-1},{text:''}])
   assert.equal(validEditRequest({...marker,...change}),false)
 const drag={action:'drag_time',token,mode:'key',targetTime:2,snap:false}
 assert.equal(validEditRequest(drag),true)
 assert.equal(validEditRequest({...drag,snap:true,snapGrid:{unit:'second',step:5,index:2}}),true)
 assert.equal(validEditRequest({...drag,snapGrid:{unit:'second',step:5,index:2}}),false)
 assert.equal(validEditRequest({...drag,snap:true,snapGrid:{unit:'beat',step:0,index:2}}),false)
 assert.equal(validEditRequest({...drag,snap:true,snapGrid:{unit:'beat',step:4,index:2.5}}),false)
 for(const change of [{targetTime:NaN},{mode:'delete'},{field:'wrong'},{snapOffset:1}])
   assert.equal(validEditRequest({...drag,...change}),false)
})

test('mouse Delete converts the final animation key into its current constant without confirmation',async()=>{
 const c=new DemoClient(),e=new Editor(c);await e.refresh()
 const f=c.data.layers[0].fields[0]
 f.keys=[{time:0,value:0.37,interpolation:2}];f.value=0.37;f.sequenced=true
 await e.refresh();await e.toggleMoveKey(0)
 assert.ok(e.moveKey)
 const result=await send(e,{action:'key_delete'})
 assert.equal(result.ok,true)
 assert.equal(e.field.sequenced,false)
 assert.equal(e.field.value,0.37)
 assert.equal(e.moveKey,null)
 assert.equal(e.clearKeysPrompt,null)
 assert.equal(e.field.keys.length,1)
})

test('value popup edits constants and exact choices through shared adjustment',async()=>{
 const c=new DemoClient(),e=new Editor(c);await e.refresh()
 const f=c.data.layers[0].fields[0];f.keys=[{time:0,value:0.4,interpolation:2}];f.value=0.4;f.sequenced=false
 await e.refresh()
 assert.equal((await send(e,{action:'value_set',expectedValue:0.4,targetValue:0.7})).ok,true)
 assert.equal(e.field.value,0.7);assert.equal(e.field.sequenced,false)
 f.choices=[{label:'ALPHA',value:2},{label:'ADD',value:7}];f.min=0;f.max=10;f.value=2;f.keys[0].value=2
 await e.refresh()
 assert.equal((await send(e,{action:'value_set',expectedValue:2,targetValue:7})).ok,true)
 assert.equal(e.field.value,7)
 await assert.rejects(send(e,{action:'value_set',expectedValue:7,targetValue:3}),/Option/)
 await assert.rejects(send(e,{action:'value_set',expectedValue:2,targetValue:7}),/Value changed/)
})
