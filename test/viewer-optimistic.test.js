'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const source=browserScript.slice(browserScript.indexOf('function sameEditContext('),browserScript.indexOf('  function previewAction('))+browserScript.slice(browserScript.indexOf('async function sendEdit('),browserScript.indexOf('  let viewModePending'))
function setup(){
 let answer;const waiting=new Promise(r=>answer=r),events=[],message={}
 const c={state:{trackUid:'t',selectionToken:'s',editEnabled:true,editor:{token:'e'}},editPending:false,confirmedRevision:4,mouseGesture:null,
 presentation:{paint(){}},previewAction:()=>()=>{},previewValueSet:()=>{events.push('preview');return()=>events.push('restore')},updateEditorControls(){},draw:()=>events.push('draw'),
 fetch:async()=>({json:()=>waiting}),AbortSignal,adoptEditor:()=>events.push('adopt'),applyEditPatch:()=>events.push('patch'),$:()=>message,updatePlayhead(){},groupOpen:new Map()}
 vm.createContext(c);vm.runInContext(source,c);return{c,events,message,answer}
}
test('edit response commits only after confirmation and immediately redraws confirmed state',async()=>{
 const {c,events,answer}=setup();const p=c.sendEdit('value_set',{targetValue:1});assert.deepEqual(events,['preview']);answer({ok:true,editRevision:5});assert.equal(await p,true);assert.deepEqual(events,['preview','adopt','patch','restore','draw']);assert.equal(c.confirmedRevision,5)
})
test('rejected edit removes preview without applying an unconfirmed patch',async()=>{
 const {c,events,answer}=setup();const p=c.sendEdit('key_delete');answer({ok:false,patch:{},reason:'CHANGED'});assert.equal(await p,false);assert.deepEqual(events,['preview','restore','draw'])
})
test('late edit responses never overwrite another track, session, view mode or newer revision',async()=>{
 for(const change of [c=>c.state.trackUid='other',c=>c.state.selectionToken='other',c=>c.state.editEnabled=false,c=>c.confirmedRevision=9]){
 const {c,events,answer}=setup();const p=c.sendEdit('drag_time');change(c);answer({ok:true,editRevision:5});assert.equal(await p,false);assert.deepEqual(events,['preview','restore','draw'])
 }
})
