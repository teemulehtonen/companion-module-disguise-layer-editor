'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {applyEditPatch}=require('../src/viewer-edit-model')
test('confirmed edits replace old key times immediately and preserve resource identity',()=>{
 const clip={uid:'clip',name:'Clip'}
 const field={name:'brightness',keys:[{time:1,value:0.2}]}
 const resource={name:'video',current:clip,keys:[{time:1,resource:clip}]}
 const state={trackUid:'track',layers:[{uid:'layer',fields:[field],resources:[resource]}]}
 for(let time=2;time<40;time++) {
  assert.equal(applyEditPatch(state,{trackUid:'track',layer:{uid:'layer',start:0,end:60,fields:[
   {name:'brightness',keys:[{time,value:0.5}],samples:[{time,value:0.5}]},
   {name:'video',resource:true,sequenced:true,keys:[{time,resourceUid:'clip'}]},
  ]}}),true)
  assert.equal(field.keys[0].time,time)
  assert.equal(resource.keys[0].time,time)
  assert.equal(resource.keys[0].resource,clip)
 }
 assert.equal(applyEditPatch(state,{trackUid:'old-track',layer:{uid:'layer',start:99}}),false)
 assert.equal(state.layers[0].start,0)
})
