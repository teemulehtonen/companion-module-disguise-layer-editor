'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const{validEditRequest,editFromViewer,describeEditor}=require('../src/viewer-editor')
const{Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
test('layer operations accept only explicit supported operations and guarded targets',()=>{
 const base={action:'layer_manage',token:'a'.repeat(64),trackUid:'1',operation:'create',kind:'video',targetTime:2}
 assert.equal(validEditRequest(base),true)
 for(const extra of [{kind:'python'},{targetTime:Infinity},{path:'/tmp'}])assert.equal(validEditRequest({...base,...extra}),false)
 const rename={action:'layer_manage',token:base.token,trackUid:'1',layerUid:'2',operation:'rename',name:'New',expectedName:'Old',expectedStart:0,expectedEnd:10}
 assert.equal(validEditRequest(rename),true)
 assert.equal(validEditRequest({...rename,name:'\n'}),false)
 assert.equal(validEditRequest({...rename,expectedEnd:undefined}),false)
})
test('creation uses the shared guarded command and selects the returned native layer',async()=>{
 const c=new DemoClient();c.data.trackUid='1';const execute=c.execute.bind(c);let payload
 c.execute=async(command,args)=>{if(command==='layer_manage'){payload=args;return{layerUid:c.data.layers[0].uid}}return execute(command,args)}
 const e=new Editor(c);await e.refresh()
 const r=await editFromViewer(e,{action:'layer_manage',token:describeEditor(e).token,trackUid:'1',operation:'create',kind:'audio',targetTime:2})
 assert.equal(r.ok,true);assert.equal(payload.kind,'audio');assert.equal(payload.targetTime,2)
})

test('reordering requires an exact sibling order and a distinct target',()=>{
 const r={action:'layer_reorder',token:'a'.repeat(64),trackUid:'1',layerUid:'2',targetUid:'3',after:true,expectedOrder:['2','3']}
 assert.equal(validEditRequest(r),true)
 assert.equal(validEditRequest({...r,targetUid:'2'}),false)
 assert.equal(validEditRequest({...r,expectedOrder:['bad']}),false)
 assert.equal(validEditRequest({...r,after:undefined}),false)
})

test('delete accepts guarded identity and clears pinned target without selecting removed layer',async()=>{
 const c=new DemoClient();c.data.trackUid='1';c.data.layers[0].uid='2';const execute=c.execute.bind(c)
 c.execute=async(command,args)=>{if(command==='layer_manage'){assert.equal(args.operation,'delete');c.data.layers=c.data.layers.filter(l=>l.uid!==args.layerUid);return{deletedLayerUid:args.layerUid}}return execute(command,args)}
 const e=new Editor(c);await e.refresh();e.viewerPinnedLayerUid='2';const l=e.layer
 const r=await editFromViewer(e,{action:'layer_manage',token:describeEditor(e).token,trackUid:'1',layerUid:'2',operation:'delete',expectedName:l.name,expectedStart:l.start,expectedEnd:l.end,keepPlayhead:true})
 assert.equal(r.ok,true);assert.equal(e.viewerPinnedLayerUid,null);assert.notEqual(e.layer?.uid,'2')
})
