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
test('layer translation shifts cached curve times once and trims preserve absolute sample times',()=>{
 const f={name:'brightness',samples:[{time:1,value:0.4}]}
 const layer={uid:'a',start:0,end:10,fields:[f],visibleParameters:[f],allParameters:[f]}
 const state={trackUid:'t',layers:[layer]}
 applyEditPatch(state,{trackUid:'t',layer:{uid:'a',start:2,end:12,fields:[{name:'brightness',keys:[]}]}})
 assert.equal(f.samples[0].time,3)
 applyEditPatch(state,{trackUid:'t',layer:{uid:'a',start:3,end:12,fields:[{name:'brightness',keys:[]}]}})
 assert.equal(f.samples[0].time,3)
})

test('layer move updates resource keys from the editor media list on every display copy',()=>{
 const clip={uid:'c',name:'CLIP'}
 const resource=()=>({name:'video',sequenced:true,current:clip,keys:[{time:1,resource:clip}]})
 const a=resource(),b=resource(),c=resource()
 const layer={uid:'a',start:0,end:10,fields:[],resources:[a],visibleParameters:[b],allParameters:[c]}
 const state={trackUid:'t',layers:[layer]}
 const patch={trackUid:'t',layer:{uid:'a',start:4,end:14,fields:[],mediaFields:[{name:'video',resource:true,sequenced:true,keys:[{time:5,resourceUid:'c'}]}]}}
 applyEditPatch(state,patch);applyEditPatch(state,patch)
 for(const item of [a,b,c]){assert.equal(item.keys[0].time,5);assert.equal(item.keys[0].resource,clip)}
})
