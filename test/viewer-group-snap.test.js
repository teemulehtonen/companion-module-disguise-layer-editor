'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const source=browserScript.slice(browserScript.indexOf('function snapPoints('),browserScript.indexOf('function snappedTime('))
test('child layer snaps exclude all ancestor bounds but retain siblings and unrelated groups',()=>{
 const state={length:100,layers:[{uid:'g',start:10,end:50},{uid:'nested',parent:'g',start:11,end:40},{uid:'a',parent:'nested',start:11,end:30},{uid:'b',parent:'nested',start:20,end:40},{uid:'other',group:true,start:60,end:80}]}
 const ctx={state,snapOptions:{edges:true},start:0,span:100};vm.createContext(ctx);vm.runInContext(source,ctx)
 assert.deepEqual(Array.from(vm.runInContext("snapPoints('a')",ctx)),[20,40,60,80])
 // Key movement does not alter its parent bounds; they remain valid targets.
 assert.deepEqual(Array.from(vm.runInContext("snapPoints('a','brightness',12)",ctx)),[10,11,20,30,40,50,60,80])
})
