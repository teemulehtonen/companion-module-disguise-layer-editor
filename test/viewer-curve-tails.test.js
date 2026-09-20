'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const c={};vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('function previewKeySamples('),browserScript.indexOf('  function retainFieldCurve(')),c)
test('last key raises its entire tail immediately instead of pinning OUT to the old value',()=>{
 const source=[{time:0,value:0},{time:2,value:.5},{time:5,value:.5},{time:10,value:.5}]
 const result=c.previewKeySamples(source,2,.5,4,.9,0,undefined,0,10)
 assert.deepEqual(Array.from(result,s=>s.value),[0,.9,.9,.9]);assert.equal(result[1].time,4);assert.equal(result.at(-1).time,10);assert.equal(source.at(-1).value,.5)
})
test('first key raises the whole leading plateau but preserves its next neighbour',()=>{
 const source=[{time:0,value:.5},{time:2,value:.5},{time:6,value:0},{time:10,value:0}]
 const result=c.previewKeySamples(source,2,.5,3,.8,undefined,6,0,10)
 assert.deepEqual(Array.from(result,s=>s.value),[.8,.8,0,0]);assert.equal(result[0].time,0);assert.equal(result[2].time,6)
})
test('one key changes the whole constant curve; middle keys keep both neighbours fixed',()=>{
 const source=[0,2,5,10].map(time=>({time,value:.5}))
 assert.deepEqual(Array.from(c.previewKeySamples(source,2,.5,2,1,undefined,undefined,0,10),s=>s.value),[1,1,1,1])
 const result=c.previewKeySamples(source,2,.5,2,1,0,5,0,10)
 assert.deepEqual(Array.from(result,s=>s.value),[.5,1,.5,.5])
})
