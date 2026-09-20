'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
const {editFromViewer,describeEditor}=require('../src/viewer-editor')
function client(){const c=new DemoClient();c.data.trackUid='1';c.data.layers[0].uid='2';const execute=c.execute.bind(c);c.execute=async(cmd,args)=>{const time=c.data.time;const r=await execute(cmd,args);if(args?.keepPlayhead)c.data.time=time;if(cmd==='read_field' && args.live===false)r.time=args.time;return r};return c}
const send=(e,r)=>editFromViewer(e,{token:describeEditor(e).token,...r})

test('two clocks: unlinked Deck edits and seeking move edit time, not transport',async()=>{
 const c=client(),e=new Editor(c);await e.refresh();assert.equal(e.linkTime,true)
 await send(e,{action:'link_time',enabled:false})
 const key=e.field.keys[1];await e.toggleMoveKey(key.time)
 assert.equal(e.time,key.time);assert.equal(e.transportTime,0);assert.equal(c.data.time,0)
 await e.adjustLiveTime(1,1);assert.equal(e.time,key.time+1);assert.equal(e.moveKey.time,e.time);assert.equal(c.data.time,0)
 e.receiveTransportTime(3);assert.equal(e.time,key.time+1);assert.equal(e.transportTime,3)
 await e.seekFromViewer({trackUid:'1',time:2});assert.equal(e.time,2);assert.equal(c.data.time,0);assert.equal(e.moveKey,null)
 await e.adjustLiveTime(1,1);assert.equal(e.time,3);assert.equal(c.data.time,0)
 await e.refresh({preserve:true});assert.equal(e.time,3)
})

test('layer selection uses edit time and relinking clears stale edit locks without native seek',async()=>{
 const c=client(),e=new Editor(c);c.data.layers[0].start=10;c.data.layers[0].end=20;await e.refresh()
 await send(e,{action:'link_time',enabled:false})
 assert.equal((await e.selectFromViewer({trackUid:'1',layerUid:'2'})).ok,false)
 await e.seekFromViewer({trackUid:'1',time:12});assert.ok(e.activeLayers.some(l=>l.uid==='2'));assert.equal(c.data.time,0)
 assert.equal((await e.selectFromViewer({trackUid:'1',layerUid:'2'})).ok,true)
 e.layerEdit='edit';e.mediaMode=true;e.receiveTransportTime(2)
 await send(e,{action:'link_time',enabled:true})
 assert.equal(e.time,2);assert.equal(c.data.time,0);assert.equal(e.moveKey,null);assert.equal(e.layerEdit,'');assert.equal(e.mediaMode,false);assert.notEqual(e.layer?.uid,'2')
})

test('unlinked layer movement carries edit cursor and retains active layer',async()=>{
 const c=client(),e=new Editor(c);c.data.layers[0].end=20;await e.refresh();await send(e,{action:'link_time',enabled:false})
 await e.adjustLayerTiming('move',1);assert.ok(e.time>0);assert.equal(c.data.time,0);e.followTime(e.time);assert.equal(e.layer.uid,'2')
 e.receiveTransportTime(50);assert.equal(e.layer.uid,'2');assert.ok(e.time<1)
})

test('Deck LINK TIME and viewer share state; default linked edits follow Designer',async()=>{
 const c=client(),e=new Editor(c);await e.refresh();await e.pressPad(3);assert.equal(describeEditor(e).linkTime,false)
 await send(e,{action:'link_time',enabled:true});assert.equal(e.linkTime,true)
 await e.toggleMoveKey(e.field.keys[1].time);await e.adjustLiveTime(1,1);assert.equal(e.time,c.data.time)
 await e.pressPad(3);assert.equal(e.linkTime,false);assert.equal(e.moveKey,null)
})


test('unlinked refresh can recover stale state without using write context',async()=>{
 const c=client(),e=new Editor(c);await e.refresh();e.setLinkTime(false);e.time=5;e.stale=true
 await e.refresh({preserve:true});assert.equal(e.stale,false);assert.equal(e.time,5);assert.equal(e.transportTime,0)
})
