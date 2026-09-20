'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
const seekSource=browserScript.slice(browserScript.indexOf('let pendingSeek='),browserScript.indexOf('  function seekTarget('))
function harness(){
 const calls=[],message={textContent:''},timers=[]
 const c={state:{seekEnabled:true,trackUid:'t',selectionToken:'token',time:9,editor:{linkTime:true,moveKey:{time:9}}},
 mouseGesture:null,editPending:false,interactionBusy:false,performance:{now:()=>0},AbortSignal,
 setTimeout:fn=>timers.push(fn),$:()=>message,
 fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return{json:async()=>({ok:true,time:body.time,editor:{linkTime:c.state.editor.linkTime,editTime:body.time,moveKey:null}})}},
 interact:async fn=>{c.interactionBusy=true;try{return await fn()}finally{c.interactionBusy=false}},
 adoptEditor:e=>{c.state.editor=e},updatePlayhead:()=>{}}
 vm.createContext(c);vm.runInContext(seekSource,c);return{c,calls,timers,message}
}
test('one seek click clears key selection and moves the active clock',async()=>{
 for(const linked of [true,false]){const {c,calls}=harness();c.state.editor.linkTime=linked;await c.seekTimeline(2);assert.equal(calls.length,1);assert.equal(c.state.editor.moveKey,null);assert.equal(c.state.editor.editTime,2);assert.equal(c.state.time,linked?2:9)}
})
test('seek waits for the final edit, retains the click and coalesces later clicks',async()=>{
 const {c,calls,timers}=harness();c.editPending=true;c.mouseGesture={released:true};const first=c.seekTimeline(2);await c.seekTimeline(3);assert.equal(calls.length,0);c.editPending=false;c.mouseGesture=null;timers.shift()();await first;assert.equal(calls.length,1);assert.equal(calls[0].time,3)
})
test('queued seek is discarded after track, token or permission changes',async()=>{
 for(const change of [c=>c.state.trackUid='other',c=>c.state.selectionToken='other',c=>c.state.seekEnabled=false]){const {c,calls,timers}=harness();c.editPending=true;const p=c.seekTimeline(2);change(c);c.editPending=false;timers.shift()();await p;assert.equal(calls.length,0)}
})
test('time ruler bypasses deselect-only capture while empty space still deselects',()=>{
 let capture;const c={sheet:{addEventListener:(type,fn)=>capture=fn},state:{editor:{moveKey:{time:1}},editEnabled:true},editPending:false,interactionBusy:false,mouseGesture:null,suppressClickUntil:0,performance:{now:()=>100},interact:()=>{c.releases++},releases:0}
 const block=browserScript.slice(browserScript.indexOf("sheet.addEventListener('click',event=>{"),browserScript.indexOf('  function pointClick('))
 vm.runInNewContext(block,c)
 let stopped=0;const event={button:0,target:{closest:()=>true},preventDefault:()=>stopped++,stopPropagation:()=>stopped++};capture(event);assert.equal(stopped,0);assert.equal(c.releases,0)
 event.target.closest=()=>false;capture(event);assert.equal(stopped,2);assert.equal(c.releases,1)
 assert.match(browserScript.slice(browserScript.indexOf('const enableSeek'),browserScript.indexOf('enableSeek(ruler.lane)')),/lane.classList.add\('timeline-target'\)/)
})
test('fresh seeks skip full refresh; stale seeks refresh before seeking',async()=>{
 const client=new DemoClient(),editor=new Editor(client);await editor.refresh();const commands=[],execute=client.execute.bind(client);client.execute=async(name,args)=>{commands.push(name);return execute(name,args)}
 await editor.seekFromViewer({trackUid:editor.snapshot.trackUid,time:2});assert.deepEqual(commands,['seek']);commands.length=0;editor.stale=true;await editor.seekFromViewer({trackUid:editor.snapshot.trackUid,time:3});assert.ok(commands.indexOf('refresh')<commands.indexOf('seek'));assert.ok(commands.includes('refresh'))
})
test('selection highlighting reuses its index, clears deselection and rebuilds after drawing',()=>{
 let scans=0;const active=new Set(),mark={dataset:{keyLayer:'l',keyParameter:'p',keyTime:'2'},classList:{add:v=>active.add(v),remove:v=>active.delete(v)}}
 const c={state:{editor:{layerUid:'l',parameter:'p',moveKey:{time:2}}},sheet:{querySelectorAll:()=>{scans++;return[mark]}}};vm.createContext(c)
 vm.runInContext(browserScript.slice(browserScript.indexOf('let keySelectionIndex='),browserScript.indexOf('  function updateEditorControls()')),c)
 for(let i=0;i<100;i++)c.updateKeySelection();assert.equal(scans,1);assert.ok(active.has('selected-keyframe'));c.state.editor.moveKey=null;c.updateKeySelection();assert.equal(active.size,0)
 vm.runInContext("keySelectionIndex=null;keySelectionSignature='';highlightedKeys=[]",c);c.updateKeySelection();assert.equal(scans,2)
})

test('confirmed seek rejects delayed transport and refresh samples, then resumes native time',async()=>{
 const client=new DemoClient(),editor=new Editor(client);await editor.refresh();const uid=editor.snapshot.trackUid
 await editor.seekFromViewer({trackUid:uid,time:7});assert.equal(editor.transportTime,7)
 editor.receiveTransportTime(1);assert.equal(editor.transportTime,7);assert.equal(editor.time,7)
 client.data.time=1;await editor.refresh({preserve:true});assert.equal(editor.transportTime,7);assert.equal(editor.time,7)
 editor.receiveTransportTime(7);editor.receiveTransportTime(8);assert.equal(editor.transportTime,8);assert.equal(editor.time,8)
 await editor.seekFromViewer({trackUid:uid,time:3});editor.pendingJump.until=0;editor.receiveTransportTime(4);assert.equal(editor.transportTime,4)
})
test('rapid seeks protect only the newest target, unlinked seek leaves transport untouched',async()=>{
 const client=new DemoClient(),editor=new Editor(client);await editor.refresh();const uid=editor.snapshot.trackUid
 await editor.seekFromViewer({trackUid:uid,time:7});await editor.seekFromViewer({trackUid:uid,time:2});editor.receiveTransportTime(7);assert.equal(editor.transportTime,2)
 editor.receiveTransportTime(2);editor.setLinkTime(false);await editor.seekFromViewer({trackUid:uid,time:9});assert.equal(editor.transportTime,2);assert.equal(editor.time,9)
 editor.receiveTransportTime(3);assert.equal(editor.transportTime,3);assert.equal(editor.time,9)
})

test('full snapshot never rolls a confirmed seek back to cached older live time',()=>{
 const code=browserScript.slice(browserScript.indexOf('function mergeLiveClock('),browserScript.indexOf('  async function poll()'))
 const c={};vm.createContext(c);vm.runInContext(code,c)
 const snapshot={trackUid:'t',focusUid:'l',editRevision:12,time:2,timecode:'00:00:02:00',liveValue:0.3}
 const stale={trackUid:'t',focusUid:'l',editRevision:11,time:9,timecode:'00:00:09:00',liveValue:1}
 c.mergeLiveClock(snapshot,stale,12);assert.equal(snapshot.time,2);assert.equal(snapshot.timecode,'00:00:02:00');assert.equal(snapshot.liveValue,0.3)
 c.mergeLiveClock(snapshot,{...stale,editRevision:12,time:3},12);assert.equal(snapshot.time,3)
 c.mergeLiveClock(snapshot,{...stale,editRevision:13,trackUid:'other'},12);assert.equal(snapshot.time,3)
 c.mergeLiveClock(snapshot,{...stale,editRevision:13,focusUid:'other'},12);assert.equal(snapshot.time,3)
 c.mergeLiveClock(snapshot,{...stale,editRevision:13},14);assert.equal(snapshot.time,3)
})

test('linked viewer shares the confirmed editor clock; unlinked viewer retains native transport',async()=>{
 const e=new Editor(new DemoClient());await e.refresh();e.time=2;e.transportTime=9;assert.equal(e.viewerTransportTime,2)
 e.setLinkTime(false);assert.equal(e.viewerTransportTime,9);e.time=3;assert.equal(e.viewerTransportTime,9)
})

test('seek preview is immediate, presentation-only, and rolls back after rejection',async()=>{
 const {c,calls}=harness();let finish;const response=new Promise(resolve=>finish=resolve);c.fetch=async()=>{await response;return{json:async()=>({ok:false,reason:'REJECTED'})}}
 const pending=c.seekTimeline(4);assert.equal(c.seekPreview.time,4);assert.equal(c.state.time,9);finish();await pending;assert.equal(c.seekPreview,null);assert.equal(c.state.time,9)
})
test('a newer preview remains visible while an older seek is acknowledged',async()=>{
 const {c}=harness();const completions=[];c.fetch=async(url,options)=>{const body=JSON.parse(options.body);await new Promise(resolve=>completions.push(resolve));return{json:async()=>({ok:true,time:body.time,editor:{linkTime:true,editTime:body.time}})}}
 const first=c.seekTimeline(2);await c.seekTimeline(4);assert.equal(c.seekPreview.time,4);completions.shift()();await new Promise(resolve=>setImmediate(resolve));assert.equal(c.seekPreview.time,4);assert.equal(c.state.time,2);completions.shift()();await first;assert.equal(c.seekPreview,null);assert.equal(c.state.time,4)
})
test('preview clock follows link mode and never crosses track or permission context',()=>{
 const code=browserScript.slice(browserScript.indexOf('function activeSeekPreview('),browserScript.indexOf('  function previewTimecode('));const c={state:{trackUid:'a',selectionToken:'token',connected:true,time:8,editor:{linkTime:true}},seekPreview:{trackUid:'a',token:'token',linked:true,time:2}};vm.createContext(c);vm.runInContext(code,c)
 assert.equal(c.playbackClock(),2);assert.equal(c.editClock(),2);assert.equal(c.state.time,8)
 c.state.editor={linkTime:false,editTime:7};assert.equal(c.playbackClock(),8);assert.equal(c.editClock(),7)
 c.seekPreview.linked=false;assert.equal(c.playbackClock(),8);assert.equal(c.editClock(),2)
 c.state.trackUid='b';assert.equal(c.editClock(),7);c.state.trackUid='a';c.state.connected=false;assert.equal(c.editClock(),7)
})
