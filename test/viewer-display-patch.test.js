const {test}=require('node:test')
const assert=require('node:assert/strict')
const {applyEditPatch}=require('../src/viewer-edit-model')
test('confirmed keys reach independently serialized parameter display lists',()=>{
 const original={name:'brightness',value:0,keys:[{time:1,value:0}]}
 const clip={uid:'clip',name:'Clip'}
 const resource={name:'video',current:clip,keys:[{time:1,resource:clip}]}
 const layer={uid:'layer',fields:[structuredClone(original)],resources:[structuredClone(resource)],visibleParameters:[structuredClone(original),structuredClone(resource)],allParameters:[structuredClone(original),structuredClone(resource)]}
 const state={trackUid:'track',layers:[layer]}
 applyEditPatch(state,{trackUid:'track',layer:{uid:'layer',start:2,end:9,fields:[{name:'brightness',value:0.75,keys:[{time:3,value:0.75}]},{name:'video',resource:true,sequenced:true,keys:[{time:4,resourceUid:'clip'}]}]}})
 for(const list of [layer.fields,layer.visibleParameters,layer.allParameters]) {
  assert.equal(list[0].value,0.75)
  assert.equal(list[0].keys[0].time,3)
 }
 for(const field of [layer.resources[0],layer.visibleParameters[1],layer.allParameters[1]]) {
  assert.equal(field.keys[0].time,4)
  assert.equal(field.keys[0].resource.name,'Clip')
 }
})
