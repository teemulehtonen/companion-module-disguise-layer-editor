'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {validEditRequest,editFromViewer,describeEditor}=require('../src/viewer-editor')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
const request=()=>({action:'layer_group',token:'a'.repeat(64),trackUid:'1',operation:'group',name:'GROUP',
 layers:[{uid:'2',name:'A',start:0,end:10},{uid:'3',name:'B',start:1,end:12}],expectedOrder:['3','2']})
test('group requests require bounded unique layer identities and snapshots, not arbitrary native arguments',()=>{
 const r=request();assert.equal(validEditRequest(r),true)
 for(const extra of [{layers:[r.layers[0]]},{layers:[r.layers[0],r.layers[0]]},{operation:'delete'},{name:'\n'},
   {expectedOrder:['bad']},{script:'python'},{layers:[{...r.layers[0],start:NaN},r.layers[1]]}])
   assert.equal(validEditRequest({...r,...extra}),false)
 const u={...r,operation:'ungroup',layers:[r.layers[0]],expectedChildren:['4','5']};delete u.name
 assert.equal(validEditRequest(u),true)
 assert.equal(validEditRequest({...u,expectedChildren:undefined}),false)
 assert.equal(validEditRequest({...u,layers:r.layers}),false)
})
test('group adapter preserves native member order and refuses VIEW, stale selection and changed tracks',async()=>{
 const c=new DemoClient();c.data.trackUid='1';const old=c.execute.bind(c);let calls=0
 c.execute=async(command,args)=>{if(command==='layer_group'){calls++;assert.equal(args.layers[0].uid,'2');return {groupUid:'9',memberUids:['3','2']}}return old(command,args)}
 const e=new Editor(c);await e.refresh();let r={...request(),token:describeEditor(e).token}
 c.viewOnly=true;assert.equal((await editFromViewer(e,r)).ok,false);assert.equal(calls,0)
 c.viewOnly=false;assert.equal((await editFromViewer(e,{...r,trackUid:'7'})).ok,false)
 assert.equal((await editFromViewer(e,{...r,token:'b'.repeat(64)})).ok,false)
 assert.equal(calls,0)
 const result=await editFromViewer(e,r)
 assert.equal(result.ok,true);assert.deepEqual(result.hierarchy.memberUids,['3','2']);assert.equal(calls,1)
})
test('group translation only accepts movement, blocks VIEW and preserves native group identity',async()=>{
 const c=new DemoClient();c.data.trackUid="1";const e=new Editor(c);await e.refresh();let calls=0
 const r={action:'group_move',token:describeEditor(e).token,trackUid:e.snapshot.trackUid,layerUid:'9',targetTime:12,snap:false,members:[{uid:'9',start:0,end:20},{uid:'2',start:0,end:20}]}
 assert.equal(validEditRequest(r),true)
 assert.equal(validEditRequest({...r,mode:'in'}),false)
 assert.equal(validEditRequest({...r,targetTime:NaN}),false)
 const old=c.execute.bind(c);c.execute=async(command,args)=>{if(command==='group_move'){calls++;assert.equal(args.layerUid,'9');return {members:r.members}}return old(command,args)}
 c.viewOnly=true;assert.equal((await editFromViewer(e,r)).ok,false);assert.equal(calls,0)
 c.viewOnly=false;assert.equal((await editFromViewer(e,r)).ok,true);assert.equal(calls,1)
})
