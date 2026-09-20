'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
test('Shift marquee starts with an existing key selected and cancels browser text selection',()=>{
 const handlers=new Map(),lane={style:{},addEventListener:(k,fn)=>handlers.set(k,fn),removeEventListener:k=>handlers.delete(k),append(){},setPointerCapture(){}}
 let prevented=0,cleared=0
 const c={state:{editEnabled:true,editor:{moveKey:{time:1}}},editPending:false,interactionBusy:false,mouseGesture:null,clickTimer:null,clearTimeout(){},window:{getSelection:()=>({removeAllRanges:()=>cleared++})},uiRect:()=>({left:0,width:100}),clientX:e=>e.clientX,el:()=>({style:{},remove(){}}),performance,start:0,span:10}
 vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('function marqueeKeys('),browserScript.indexOf('  function pendingKeyMarker(')),c)
 c.marqueeKeys(lane,{start:0,end:10},{keys:[]})
 handlers.get('pointerdown')({button:0,shiftKey:true,clientX:10,pointerId:1,preventDefault:()=>prevented++,stopPropagation(){}})
 assert.equal(prevented,1);assert.equal(cleared,1);assert.equal(lane.style.userSelect,'none');assert.equal(c.mouseGesture.marquee,true)
 handlers.get('lostpointercapture')({type:'lostpointercapture'});assert.equal(c.mouseGesture,null);assert.equal(handlers.has('pointermove'),false)
})
test('local curve painting cancels an earlier live animation before it can overwrite the preview',()=>{
 const cancelled=[],c={cancelAnimationFrame:id=>cancelled.push(id)};vm.createContext(c)
 vm.runInContext(browserScript.slice(browserScript.indexOf('function cancelCurveAnimation('),browserScript.indexOf('  function retainFieldCurve(')),c)
 const path={_liveFrame:42};c.cancelCurveAnimation(path);assert.deepEqual(cancelled,[42]);assert.equal(path._liveFrame,null);c.cancelCurveAnimation(path);assert.equal(cancelled.length,1)
})
