'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const source=browserScript.slice(browserScript.indexOf('let playheadNodes='),browserScript.indexOf('  function bounds('))
function fixture(count=1){
 let scans=0,writes=0,widthReads=0
 const text=()=>{let value='';return{get textContent(){return value},set textContent(v){writes++;value=v}}}
 const labels=Array.from({length:count},text),fields=labels.map((_,i)=>({name:'v'+i,value:i/1000}))
 const values=labels.map((label,i)=>({dataset:{parameterLayer:'1',parameterValue:'v'+i},querySelector:()=>label}))
 const button={dataset:{selectLayer:'1'}},head={id:'playhead',style:{}},header={id:'',style:{}},edit={id:'edithead',style:{}}
 const elements=new Map(), c={state:{layers:[{uid:'1',start:0,end:10,fields}],time:5,timecode:'00:00:05:00',fps:25,selectionEnabled:true,focusUid:'1',parameter:'v0',liveValue:0.5,editor:{linkTime:true},annotations:{tags:[{time:0,type:'CUE',value:1}],notes:[]},sections:[{start:0,end:10}]},follow:true,frame:0,displayedTime:null,presentation:{size:0},activeSeekPreview:()=>null,playbackClock:()=>c.state.time,
 sheet:{get clientWidth(){widthReads++;return 1240},querySelectorAll:s=>{scans++;return s==='[data-select-layer]'?[button]:s==='[data-parameter-value]'?values:s==='.header-playhead, #playhead'?[head,header]:[edit]}},
 $:id=>{if(!elements.has(id))elements.set(id,text());return elements.get(id)},x:t=>t*10,editClock:()=>c.state.editor.linkTime===false?c.state.editor.editTime:c.state.time}
 vm.createContext(c);vm.runInContext(browserScript.slice(browserScript.indexOf('  function editClock()'),browserScript.indexOf('  function previewTimecode(')),c);vm.runInContext(source,c)
 return{c,labels,button,head,header,edit,values,elements,stats:()=>({scans,writes,widthReads})}
}
test('600 follow frames avoid all parameter/text work and DOM rescans with 1000 parameters',()=>{
 const f=fixture(1000);f.c.updatePlayhead();const before=f.stats()
 Object.defineProperty(f.c.state,'layers',{get(){throw Error('Panning must not traverse layers')}})
 Object.defineProperty(f.c.state,'annotations',{get(){throw Error('Panning must not traverse annotations')}})
 for(let i=0;i<600;i++)f.c.updatePlayheadPosition(true)
 assert.equal(f.stats().scans,before.scans);assert.equal(f.stats().writes,before.writes);assert.equal(f.stats().widthReads-before.widthReads,600)
 assert.equal(f.head.style.transition,'none');assert.equal(parseFloat(f.head.style.left)-parseFloat(f.header.style.left),240)
 assert.match(browserScript.slice(browserScript.indexOf('function animate()'),browserScript.indexOf('function setFollow(')),/updatePlayheadPosition\(true\)/)
})
test('unchanged live values avoid text writes; replaced native fields and choices remain fresh',()=>{
 const f=fixture();f.c.updatePlayhead();const before=f.stats();f.c.updatePlayhead();assert.equal(f.stats().writes,before.writes);assert.equal(f.stats().scans,before.scans)
 f.c.state.layers=[{uid:'1',start:8,end:12,fields:[{name:'v0',value:1,choices:[{value:1,label:'SCREEN'}]}]}];f.c.state.liveValue=undefined;f.c.updatePlayhead();assert.equal(f.labels[0].textContent,'SCREEN');assert.equal(f.button.disabled,true)
 f.c.state.editor={linkTime:false,editTime:9,editTimecode:'00:00:09:00'};f.c.updatePlayhead();assert.equal(f.button.disabled,false);assert.equal(f.edit.hidden,false);assert.equal(f.edit.style.left,'1140px');assert.equal(f.head.style.left,'740px')
 f.c.state.selectionEnabled=false;f.c.updatePlayhead();assert.equal(f.button.disabled,true)
})
test('DOM cache rebuilds after redraw and reads the new parameter label',()=>{
 const f=fixture();f.c.updatePlayhead();let value='';const newLabel={get textContent(){return value},set textContent(v){value=v}};f.values[0].querySelector=()=>newLabel
 vm.runInContext('playheadNodes=null',f.c);f.c.updatePlayhead();assert.equal(value,'0.5');assert.equal(f.stats().scans,8)
 assert.match(browserScript,/playheadNodes=null\s+sheet.replaceChildren\(\)/)
})

test('redrawn playhead segments appear at their destination without animating from origin',()=>{
 const f=fixture();f.c.displayedTime=5;f.c.updatePlayhead();assert.equal(f.head.style.transition,'none');assert.equal(f.header.style.transition,'none')
 f.c.state.time=5.1;f.c.updatePlayhead();assert.equal(f.head.style.transition,'left 100ms linear')
 f.head.style.left='';f.header.style.left='';f.c.updatePlayhead();assert.equal(f.head.style.transition,'none');assert.equal(f.header.style.transition,'none')
})
test('explicit short seeks snap immediately but subsequent playback remains smooth',()=>{
 const f=fixture();f.c.updatePlayhead();f.c.state.time=4.9;f.c.displayedTime=null;f.c.updatePlayhead();assert.equal(f.head.style.transition,'none')
 f.c.state.time=5;f.c.updatePlayhead();assert.equal(f.head.style.transition,'left 100ms linear')
 assert.match(browserScript.slice(browserScript.indexOf('async function seekTimeline('),browserScript.indexOf('function seekTarget(')),/displayedTime=null\s+updatePlayhead\(\)/)
})


test('VIEW + FOLLOW hides the blue cursor and edit clock without editing native time',()=>{
 const f=fixture();f.c.state.viewOnly=true
 f.c.state.editor={linkTime:false,editTime:1,editTimecode:'00:00:01:00'}
 const original=JSON.stringify(f.c.state.editor)
 f.c.updatePlayhead()
 assert.equal(f.edit.hidden,true)
 assert.equal(f.elements.get('editClock').hidden,true)
 assert.equal(f.head.hidden,false)
 f.c.state.time=5.1;f.c.updatePlayhead()
 assert.equal(f.edit.hidden,true)
 f.c.follow=false;f.c.updatePlayhead()
 assert.equal(f.c.editClock(),1)
 assert.equal(f.edit.hidden,false)
 assert.equal(f.elements.get('editClock').hidden,false)
 f.c.follow=true;f.c.state.viewOnly=false;f.c.updatePlayhead()
 assert.equal(f.c.editClock(),1)
 assert.equal(f.edit.hidden,false)
 assert.equal(f.elements.get('editClock').hidden,false)
 assert.equal(JSON.stringify(f.c.state.editor),original)
})

test('VIEW + FOLLOW scrolls from playback rather than parked edit cursor',()=>{
 const f=fixture();Object.assign(f.c,{start:0,span:10,targetStart:0,mouseGesture:null,requestAnimationFrame:()=>1,animate:()=>{}})
 vm.runInContext(browserScript.slice(browserScript.indexOf('  function bounds('),browserScript.indexOf('  function animate(')),f.c)
 f.c.state.viewOnly=true;f.c.state.length=100;f.c.state.time=25;f.c.state.editor={linkTime:false,editTime:5}
 f.c.followClock()
 assert.equal(f.c.targetStart,18.5)
 assert.equal(f.c.frame,1)
 f.c.follow=false;f.c.frame=0;f.c.targetStart=0;f.c.followClock()
 assert.equal(f.c.targetStart,0)
 assert.equal(f.c.frame,0)
})
