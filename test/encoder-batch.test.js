'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const {actions}=require('../src/definitions')
const source=fs.readFileSync(require.resolve('../src/main'),'utf8')
const methods=source.slice(source.indexOf('  performDetents('),source.indexOf('  async performNow('))
function host(){const C=vm.runInNewContext('(class Host {'+methods+'})');const h=new C();h.editor={};h.queueGeneration=0;h.actionTail=Promise.resolve();h.performNow=fn=>fn(h.editor);return h}
test('encoder batching keeps one trailing command, cancels reversals and never builds a backlog',async()=>{
 const h=host(),seen=[];let release;h.perform(()=>new Promise(r=>release=r));await Promise.resolve()
 for(let i=0;i<80;i++)h.performDetents('value',1,(_,direction,n)=>seen.push(direction*n))
 for(let i=0;i<4;i++)h.performDetents('value',-1,(_,direction,n)=>seen.push(direction*n))
 h.perform(()=>seen.push('click'))
 for(let i=0;i<5;i++)h.performDetents('value',-1,(_,direction,n)=>seen.push(direction*n))
 release();await h.actionTail;assert.deepEqual(seen,[60,'click',-5])
})
test('context invalidation discards pending batched turns',async()=>{
 const h=host();let calls=0
 h.performDetents('time',1,()=>calls++);h.queueGeneration++;await h.actionTail;assert.equal(calls,0)
})
test('all normal dials collapse bursts and opposite turns into one trailing action',async()=>{
 const h=host(),calls=[];let release
 Object.assign(h.editor,{viewOnly:false,mediaMode:false,clearKeysBrowser:null,moveKey:null,layerEdit:'',
  selectLive:(kind,direction,detents)=>calls.push([kind,direction,detents]),
  adjustLiveTime:(direction,step,pointer)=>calls.push(['time',direction,pointer.detents]),
  adjustLiveValue:(direction)=>calls.push(['value',direction])})
 const a=actions(h)
 h.perform(()=>new Promise(r=>release=r));await Promise.resolve()
 for(let i=0;i<20;i++)a.layer.callback({options:{direction:1}})
 release();await h.actionTail
 assert.deepEqual(calls,[['layer',1,20]])
 calls.length=0
 let releaseTime
 h.perform(()=>new Promise(r=>releaseTime=r));await Promise.resolve()
 for(let i=0;i<10;i++)a.time.callback({options:{direction:1,step:0}})
 for(let i=0;i<3;i++)a.time.callback({options:{direction:-1,step:0}})
 releaseTime();await h.actionTail
 assert.deepEqual(calls,[['time',1,7]])
})
test('Yamaha encoder sensitivity turns two physical detents into one isolated editor step',async()=>{
 const h=host(),calls=[]
 Object.assign(h.editor,{viewOnly:false,mediaMode:false,clearKeysBrowser:null,moveKey:null,layerEdit:'',
  selectLive:(kind,direction,detents)=>calls.push([kind,direction,detents]),
  adjustLiveTime:(direction,step,pointer)=>calls.push(['time',direction,pointer.detents])})
 const a=actions(h),event=(direction,group)=>({options:{direction,detent_divisor:2,detent_group:group,step:0}})
 a.layer.callback(event(1,1));await h.actionTail;assert.deepEqual(calls,[])
 a.layer.callback(event(1,1));await h.actionTail;assert.deepEqual(calls,[['layer',1,1]])
 a.layer.callback(event(1,1));a.layer.callback(event(-1,1));await h.actionTail
 assert.deepEqual(calls,[['layer',1,1]],'Opposite half-steps cancel')
 a.time.callback(event(1,4));a.time.callback(event(1,6));await h.actionTail
 assert.equal(calls.length,1,'Separate Yamaha encoders do not share half-steps')
 a.time.callback(event(1,4));a.time.callback(event(1,6));await h.actionTail
 assert.deepEqual(calls.slice(1),[['time',1,1],['time',1,1]])
})
test('Yamaha zoom encoder uses the same half sensitivity',()=>{
 const seen=[],instance={zoomDesignerTimeline:value=>seen.push(value),publish(){}}
 const zoom=actions(instance).viewer_zoom
 const event={options:{direction:1,detent_divisor:2,detent_group:5}}
 zoom.callback(event);assert.deepEqual(seen,[])
 zoom.callback(event);assert.deepEqual(seen,[1])
})
