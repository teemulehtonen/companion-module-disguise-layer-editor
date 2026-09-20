'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {discreteSegments}=require('../src/viewer-discrete')
const layer={start:10,end:30},choices=[{value:2,label:'ALPHA'},{value:7,label:'ADD'}]
test('enumerated values render named intervals, clipped to layer bounds',()=>{
 assert.deepEqual(discreteSegments({choices,sequenced:true,keys:[{time:0,value:2},{time:20,value:7},{time:40,value:2}]},layer),[{start:10,end:20,label:'ALPHA'},{start:20,end:30,label:'ADD'}])
})
test('constants, unavailable enum labels and continuous fields stay distinct',()=>{
 assert.deepEqual(discreteSegments({choices,value:7},layer),[{start:10,end:30,label:'ADD'}])
 assert.equal(discreteSegments({value:0.5},layer),null)
 assert.equal(discreteSegments({discrete:true,value:99},layer)[0].label,'UNKNOWN (99)')
})
