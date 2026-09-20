'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const c={};vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('function keyCurveTarget('),browserScript.indexOf('  function previewKeySamples(')),c)
test('a header diamond resolves the curve through its matching parameter diamond',()=>{
 const path={},header={dataset:{}},mark={dataset:{curveMin:'0',curveMax:'1'},parentElement:{querySelector:()=>path}}
 const target=c.keyCurveTarget([header,mark],{name:'brightness'})
 assert.equal(target.mark,mark);assert.equal(target.path,path);assert.equal(target.lo,0);assert.equal(target.hi,1)
 assert.equal(c.keyCurveTarget([header],{name:'brightness'}),null)
})
test('resource and choice markers never resolve a numeric curve',()=>{
 const mark={dataset:{curveMin:'0',curveMax:'1'},parentElement:{querySelector:()=>({})}}
 for(const field of [{resource:true},{current:null},{discrete:true},{choices:[{value:1}]}])assert.equal(c.keyCurveTarget([mark],field),null)
})
