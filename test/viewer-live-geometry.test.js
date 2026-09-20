'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const source=browserScript.slice(browserScript.indexOf('function paintLiveGeometry('),browserScript.indexOf('  async function pollLive()'))
test('live geometry updates existing key and edge nodes without rebuilding the timeline',()=>{
 const clip={style:{}},edge={dataset:{layerEdge:'out'},style:{}},key={dataset:{keyLayer:'1',keyParameter:'v',keyTime:'2',curveMin:'0',curveMax:'1'},style:{}}
 const root={querySelector:()=>clip,querySelectorAll:()=>[edge]}
 const sheet={querySelector:()=>root,querySelectorAll:s=>s==='[data-key-time]'?[key]:[]}
 const previous={start:0,end:10,fields:[{name:'v',keys:[{time:2,value:0.2}]}]}
 const layer={uid:'1',start:0,end:11,fields:[{name:'v',keys:[{time:3,value:0.8}]}]}
 const state={editor:{layerUid:'1',parameter:'v',moveKey:{time:3}}}
 vm.runInNewContext(source+';paintLiveGeometry(layer,previous,{moveKey:{time:2}})',{pendingGroupGeometry:new Set(),sheet,state,layer,previous,start:0,span:20,x:t=>t*5})
 assert.equal(edge.style.left,'55%');assert.equal(clip.style.width,'55%')
 assert.equal(key.style.left,'15%');assert.equal(key.dataset.keyTime,'3');assert.ok(key.style.transition.includes('65ms'))
 assert.ok(Math.abs(parseFloat(key.style.top)-10.4)<1e-6)
})

test('pending group translation is never painted again as absolute live geometry',()=>{
 let reads=0
 vm.runInNewContext(source+';paintLiveGeometry({uid:"g"},{},{})',{pendingGroupGeometry:new Set(['g']),sheet:{querySelector(){reads++;throw Error('must wait for full snapshot')}}})
 assert.equal(reads,0)
})
