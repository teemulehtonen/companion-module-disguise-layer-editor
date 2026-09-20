const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
test('wheel edits use shared value action, bound pending events, and respect zoom modifiers',async()=>{
 const source=browserScript.slice(browserScript.indexOf('  let wheelEdit=null'),browserScript.indexOf('  function pointClick('))
 const state={trackUid:'t',editEnabled:true,connected:true,editor:{layerUid:'l',parameter:'x',moveKey:{time:1,value:0},precision:'fine'} ,layers:[{uid:'l',fields:[{name:'x',min:0,max:10}]}]}
 let release,done;const writes=[]
 const context={visibleCurveSamples:(_uid,field)=>field.samples,retainFieldCurve(){},cancelCurveAnimation(){},clientX:()=>10,clientY:()=>10,showWheelValue(){},clearWheelValue(){},document:{addEventListener(){}},sheet:{addEventListener(){},querySelectorAll(){return []}},state,mouseGesture:null,editPending:false,interactionBusy:false,interact:fn=>(done=fn()),sendEdit:async(a,o)=>{writes.push([a,o]);if(writes.length===1)await new Promise(r=>release=r);return true}}
 vm.createContext(context);vm.runInContext(source,context)
 const layer={uid:'l',fields:[{name:'x'}]},node={dataset:{keyTime:'1'}}
 const event={target:{closest(){return null}},deltaY:-1,preventDefault(){},stopPropagation(){}}
 context.keyWheel({...event,ctrlKey:true},node,layer,'x');assert.equal(writes.length,0)
 context.keyWheel(event,node,layer,'x')
 for(let i=0;i<100;i++)context.keyWheel(event,node,layer,'x')
 assert.equal(writes.length,1);release();await done;assert.equal(writes.length,2)
 assert.equal(writes[0][0],'drag_value');assert.equal(writes[0][1].targetValue,0.01);assert.equal(writes[1][1].targetValue,1.01)
})
