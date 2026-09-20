'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
const {editFromViewer,describeEditor,validEditRequest}=require('../src/viewer-editor')
test('group selection uses first Deck anchor, preserves mouse anchor, blocks value/type, and deletes as a group',async()=>{
 const client=new DemoClient(),editor=new Editor(client);await editor.refresh()
 const keys=[1,2,3].map(time=>({time,value:time/10,interpolation:2}))
 editor.field.keys=keys;editor.field.sequenced=true
 const calls=[];const original=client.execute.bind(client)
 client.execute=async(command,args)=>{
  if(command!=='key_group')return original(command,args)
  calls.push(args)
  const selectedKeys=args.operation==='delete'?[]:args.expectedKeys
  return {field:{...editor.field,keys:args.expectedKeys},time:selectedKeys[0]?.time || 1,selectedKeys}
 }
 await editor.selectKeyGroup([1,2,3]);assert.equal(editor.moveKey.group.length,3)
 await editor.adjustLiveValue(1);await editor.cycleKeyType(1);await editor.pressValue();assert.equal(calls.length,1)
 await editor.adjustLiveTime(1,1);assert.equal(calls.at(-1).operation,'move');assert.equal(calls.at(-1).anchorTime,undefined)
 const result=await editFromViewer(editor,{token:describeEditor(editor).token,action:'drag_time',mode:'key',targetTime:4,anchorTime:2,snap:false})
 assert.equal(result.ok,true);assert.equal(calls.at(-1).anchorTime,2)
 assert.equal((await editFromViewer(editor,{token:describeEditor(editor).token,action:'drag_value',targetValue:0.5})).ok,false)
 await editor.writeLive('key_delete');assert.equal(calls.at(-1).operation,'delete');assert.equal(editor.moveKey,null)
})
test('group selection schema rejects duplicates, missing guards and invalid times',()=>{
 const request={action:'key_group_select',token:'a'.repeat(64),times:[1,2]}
 assert.equal(validEditRequest(request),true)
 for(const times of [[1],[1,1],[1,NaN],[-1,2]])assert.equal(validEditRequest({...request,times}),false)
 assert.equal(validEditRequest({...request,token:''}),false)
 assert.equal(validEditRequest({...request,extra:true}),false)
})
