'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const gridScript=require('../src/viewer-grid-script')
const {makeScript}=require('../src/designer-script')
const {browserScript}=require('../src/viewer-page')
const {Editor}=require('../src/editor')
const {describeEditor,validEditRequest}=require('../src/viewer-editor')

test('native grid maps each region origin, zoom subdivisions and validates snaps without native writes',t=>{
 const python=['python3','python'].find(command=>spawnSync(command,['--version'],{encoding:'utf8'}).status===0)
 if(!python)return t.skip('Python required for isolated timing fixture')
 const script=makeScript('viewer_snapshot')
 const check=script.slice(script.indexOf('    def checked_snap('),script.indexOf('    def pointer_time(')).split('\n').map(line=>line.startsWith('    ')?line.slice(4):line).join('\n')
 const fixture=gridScript+'\n'+check+'\n'+fs.readFileSync(path.join(__dirname,'fixtures/tempo-grid.py'),'utf8')
 const run=spawnSync(python,['-c',fixture],{encoding:'utf8',timeout:10000})
 assert.equal(run.status,0,run.stderr||run.error?.message)
})

test('selected timing steps reach viewer state and invalidate gesture tokens',()=>{
 const e=new Editor({})
 e.snapshot={fps:25,beatMode:true,layers:[]}
 assert.deepEqual(e.gridSteps,{beat:1,second:0.04})
 e.moveKey={time:0}
 assert.equal(e.gridSteps.beat,1/96)
 const before=describeEditor(e).token
 e.keyBeatStep=0.25
 assert.equal(describeEditor(e).gridSteps.beat,0.25)
 assert.notEqual(describeEditor(e).token,before)
 e.layerEdit='in';e.layerBeatStep=4;e.timeStep='half'
 assert.deepEqual(e.gridSteps,{beat:4,second:0.5})
})

test('beat region identity travels through browser snapping, with grid switch and Alt bypass',()=>{
 const tick={time:13.8,snapGrid:{unit:'beat',step:0.25,index:4,origin:13.3}}
 const c={state:{length:100,layers:[],grid:[tick]},snapOptions:{enabled:true,grid:true},start:10,span:10,showSnap(){}}
 vm.createContext(c)
 vm.runInContext(browserScript.slice(browserScript.indexOf('  function snapPoints('),browserScript.indexOf('  const snapButton')),c)
 const points=c.snapPoints()
 assert.deepEqual(c.snappedTime(13.79,points,false,1000).snapGrid,tick.snapGrid)
 assert.equal(c.snappedTime(13.79,points,true,1000).snap,false)
 c.snapOptions.grid=false;assert.equal(c.snapPoints().length,0)
 const request={action:'drag_time',token:'a'.repeat(64),mode:'key',targetTime:13.8,snap:true,snapGrid:tick.snapGrid}
 assert.equal(validEditRequest(request),true)
 for(const origin of [NaN,Infinity,-1,'13.3'])assert.equal(validEditRequest({...request,snapGrid:{...tick.snapGrid,origin}}),false)
})
