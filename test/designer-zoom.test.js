'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const {makeScript}=require('../src/designer-script')
const {DisguiseLayerControl}=require('../src/main')
const {DesignerClient}=require('../src/client')
const {actions}=require('../src/definitions')

test('native zoom script uses enabled steps in the correct direction and clamps at endpoints',()=>{
 const python=['python3','python'].find(p=>spawnSync(p,['--version'],{encoding:'utf8'}).status===0)
 assert.ok(python,'Python is required for offline zoom fixture')
 const scripts=Object.fromEntries([1,-1,8,-8].map(n=>[String(n),makeScript('timeline_zoom',{steps:n})]))
 const fixture=`import json\nscripts=json.loads(${JSON.stringify(JSON.stringify(scripts))})\nclass PrivateState:\n    @staticmethod\n    def privateState(): return ps\nclass State: pass\nps=State()\nps.enabledZoomLevels=[7,0,4,5,6,5]\nfor start,steps,expected in [(6,1,5),(6,-1,7),(6,8,0),(6,-8,7),(0,1,0),(7,-1,7),(3,1,0),(3,-1,4)]:\n    ps.guiTimeStep=start\n    exec('def zoom():\\n'+''.join('    '+line+'\\n' for line in scripts[str(steps)].splitlines()))\n    assert zoom()['zoomLevel']==expected\nps.enabledZoomLevels=[]\ntry:\n    zoom()\n    raise AssertionError('Empty levels accepted')\nexcept ValueError: pass\n`
 const result=spawnSync(python,['-c',fixture],{encoding:'utf8',timeout:10000})
 assert.equal(result.status,0,result.stdout+result.stderr)
 for(const steps of [0,9,-9,1.5,NaN,'1'])assert.throws(()=>makeScript('timeline_zoom',{steps}))
})
test('existing zoom action keeps its saved action ID and sends scaled detents to Designer',async()=>{
 const viewer=[],native=[]
 const item={viewer:{rotateZoomDirect:n=>viewer.push(n)},zoomDesignerTimeline:n=>native.push(n),publish(){}}
 const zoom=actions(item).viewer_zoom
 const event={options:{direction:1,detent_divisor:2,detent_group:5}}
 await zoom.callback(event);assert.deepEqual(native,[])
 await zoom.callback(event);assert.deepEqual(native,[1]);assert.deepEqual(viewer,[])
 await zoom.callback({options:{direction:-1}})
 assert.deepEqual(native,[1,-1]);assert.deepEqual(viewer,[])
})
function instance(client){return Object.assign(Object.create(DisguiseLayerControl.prototype),{client,config:{},log(){},setVariableValues(){}})}
test('Designer zoom batches bursts behind one in-flight command',async()=>{
 let release;const gate=new Promise(r=>{release=r}),calls=[]
 const item=instance({async execute(command,args){calls.push([command,args]);if(calls.length===1)await gate}})
 const first=item.zoomDesignerTimeline(1)
 await new Promise(r=>setImmediate(r))
 for(let n=0;n<30;n++)item.zoomDesignerTimeline(1)
 assert.deepEqual(calls,[['timeline_zoom',{steps:1}]])
 release();await first
 assert.deepEqual(calls,[['timeline_zoom',{steps:1}],['timeline_zoom',{steps:8}]])
 assert.equal(item.designerZoomQueue,null)
})
test('zoom drops queued work after disconnect and does not retry errors',async()=>{
 let release;const gate=new Promise(r=>{release=r}),calls=[]
 const item=instance({async execute(c,a){calls.push(a);await gate}})
 const pending=item.zoomDesignerTimeline(1);await new Promise(r=>setImmediate(r))
 item.zoomDesignerTimeline(1);item.client=null;release();await pending
 assert.equal(calls.length,1)
 let errors=0
 item.client={async execute(){errors++;throw Error('Uncertain response')}}
 await item.zoomDesignerTimeline(1)
 assert.equal(errors,1);assert.equal(item.lastError,'Uncertain response')
})
test('Designer zoom keeps VIEW and demo isolated from native writes',async()=>{
 let calls=0;const item=instance({viewOnly:true,async execute(){calls++}})
 await item.zoomDesignerTimeline(1)
 item.client.viewOnly=false;item.config.demo=true;await item.zoomDesignerTimeline(1)
 assert.equal(calls,0)
 const client=new DesignerClient('localhost',80,async()=>{calls++;throw Error('unexpected fetch')})
 client.viewOnly=true
 await assert.rejects(client.execute('timeline_zoom',{steps:1}),/VIEW ONLY/)
 client.close();assert.equal(calls,0)
})