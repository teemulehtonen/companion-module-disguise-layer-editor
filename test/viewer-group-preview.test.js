'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const c={};vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('function previewGroupSamples('),browserScript.indexOf('  // Mouse distance')),c)
test('multiple keys warp native curve samples together without changing values or source data',()=>{
 const samples=[0,1,2,3,4,5,6].map(time=>({time,value:time/6}))
 const anchors=[{time:0,selected:false},{time:2,selected:true},{time:4,selected:true},{time:6,selected:false}]
 const result=c.previewGroupSamples(samples,anchors,1)
 assert.deepEqual(Array.from(result,s=>s.time),[0,1.5,3,4,5,5.5,6])
 assert.deepEqual(Array.from(result,s=>s.value),samples.map(s=>s.value))
 assert.deepEqual(samples.map(s=>s.time),[0,1,2,3,4,5,6])
 assert.deepEqual(Array.from(c.previewGroupSamples(samples,anchors,-1),s=>s.time),[0,.5,1,2,3,4.5,6])
})
test('unselected intervening key stays fixed and boundary keys can move',()=>{
 const anchors=[{time:0,selected:true},{time:2,selected:false},{time:4,selected:true}]
 assert.deepEqual(Array.from(c.previewGroupSamples(anchors,anchors,.25),s=>s.time),[.25,2,4.25])
})
