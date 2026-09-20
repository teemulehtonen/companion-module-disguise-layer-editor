'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript,page}=require('../src/viewer-page')
test('snap toggle changes enabled state independently of target categories',()=>{
 const start=browserScript.indexOf('function toggleSnap()')
 const end=browserScript.indexOf("  snapButton.textContent='SNAP ON'",start)
 const snapOptions={enabled:true,keys:true,grid:true},snapButton={setAttribute(k,v){this[k]=v}}
 const ctx={snapOptions,snapButton,showSnap:t=>assert.equal(t,null)}
 vm.runInNewContext(browserScript.slice(start,end)+';toggleSnap()',ctx)
 assert.equal(snapOptions.enabled,false);assert.equal(snapButton['aria-pressed'],'false')
 vm.runInNewContext('toggleSnap()',ctx)
 assert.equal(snapOptions.enabled,true);assert.equal(snapOptions.keys,true);assert.equal(snapOptions.grid,true)
 assert.ok(page.includes('S: SNAP ON/OFF'))
})
