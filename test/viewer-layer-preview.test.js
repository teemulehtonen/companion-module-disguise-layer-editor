'use strict'
const {test}=require('node:test'), assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const source=browserScript.slice(browserScript.indexOf('function previewLayer('),browserScript.indexOf("    node.addEventListener('pointerdown'",browserScript.indexOf('function previewLayer(')))
test('layer previews move the complete visible content while trims retain key times',()=>{
 for(const action of ['field','layer','value']) {
  const parts=['clip','in','out','content'].map(kind=>({kind,node:{style:{}}}))
  const lane={style:{}}
  const g={layerStart:10,layerEnd:20,width:1000,layerParts:parts,layerLanes:[lane]}
  vm.runInNewContext(source+';previewLayer(g,15)',{g,action,state:{fps:25,length:100},start:0,span:100,x:t=>t})
  assert.equal(parts[1].node.style.left,action==='value'?'10%':'15%')
  assert.equal(parts[2].node.style.left,action==='field'?'25%':action==='value'?'15%':'20%')
  assert.equal(parts[3].node.style.translate,action==='field'?'50px 0':'0px 0')
  assert.ok(lane.style.clipPath.startsWith('inset('))
  assert.equal(g.layerStart,10)
 }
})
test('group preview translates every visible descendant lane without stretching content',()=>{
 const lanes=[{style:{}},{style:{}},{style:{}}]
 const g={layerGroup:true,layerStart:10,width:1000,layerLanes:lanes}
 vm.runInNewContext(source+';previewLayer(g,15)',{g,span:100})
 assert.ok(lanes.every(l=>l.style.translate==='50px 0'))
})
