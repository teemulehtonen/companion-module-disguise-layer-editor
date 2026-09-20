'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
test('wheel value popup reuses one node, rounds to three decimals and stays inside viewport',()=>{
 const nodes=[],timers=[];let removed=0
 const c={el:()=>({style:{},offsetWidth:60,remove:()=>removed++}),document:{body:{append:n=>nodes.push(n)}},uiWidth:()=>400,uiHeight:()=>300,clearTimeout:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length}}
 vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('let wheelValueNode='),browserScript.indexOf('  let wheelEdit=null')),c)
 c.showWheelValue(0.123456,{x:399,y:2});assert.equal(nodes[0].textContent,'0.123');assert.equal(nodes[0].style.left,'336px');assert.equal(nodes[0].style.top,'4px')
 c.showWheelValue(1,{x:20,y:200});assert.equal(nodes.length,1);assert.equal(nodes[0].textContent,'1');timers.at(-1)();assert.equal(removed,1)
})
