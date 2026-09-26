'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const {parameterStep,parameterDecimals,pythonParameterStep}=require('../src/parameter-step')
const {makeScript}=require('../src/designer-script')
const {Editor}=require('../src/editor')
const {DemoClient}=require('../src/demo')
const cases=[
 [{min:-180,max:180},[3.6,.36,.036]],
 [{min:0,max:1},[.01,.001,.0001]],
 [{min:0,max:100},[1,.1,.01]],
 [{min:100,max:200},[1,.1,.01]],
 [{min:-1,max:1},[.02,.002,.0002]],
 [{min:0,max:.01},[.0001,.00001,.000001]],
 [{min:0,max:1.000000047},[.01,.001,.0001]],
 [{},[.01,.001,.0001]],
 [{min:null,max:180},[.01,.001,.0001]],
 [{min:180,max:-180},[.01,.001,.0001]],
 [{min:1,max:1},[.01,.001,.0001]],
 [{min:0,max:100,integer:true},[1,1,1]],
 [{min:0,max:1,integer:true},[1,1,1]],
 [{integer:true,step:5},[5,5,5]],
]
const modes=['coarse','fine','ultra']
test('default parameter steps span full signed ranges and preserve integer resolution',()=>{
 for(const [field,steps] of cases)for(let i=0;i<3;i++)assert.equal(parameterStep(field,{precision:modes[i]}),steps[i],JSON.stringify([field,modes[i]]))
 assert.equal(parameterStep({min:-Infinity,max:Infinity},{}),.01)
 assert.equal(parameterStep({min:NaN,max:100},{}),.01)
 for(let i=0;i<3;i++)assert.equal(parameterStep({min:-180,max:180},{precision:modes[i],step:1}),[1,.1,.01][i])
 assert.equal(parameterStep({integer:true,min:0,max:100},{precision:'ultra',step:5}),5)
})
test('native Python and JavaScript use the same scaled parameter steps',()=>{
 const python=['python3','python'].find(p=>spawnSync(p,['--version'],{encoding:'utf8'}).status===0)
 assert.ok(python,'Python required for offline parameter-step fixture')
 const fixture='import math,json\n'+pythonParameterStep+'\ncases=json.loads('+JSON.stringify(JSON.stringify(cases))+')\nfor field, expected in cases:\n    for i, mode in enumerate(["coarse","fine","ultra"]):\n        actual=parameter_step(field,{"precision":mode})\n        assert abs(actual-expected[i]) < 1e-12, (field,mode,actual,expected[i])\nassert parameter_step({"min":-180,"max":180},{"step":1,"precision":"fine"})==0.1\n'
 const run=spawnSync(python,['-c',fixture],{encoding:'utf8',timeout:10000})
 assert.equal(run.status,0,run.stdout+run.stderr)
 const script=makeScript('adjust_value',{direction:1})
 assert.ok(script.includes('step = parameter_step(meta, p)'))
})
test('editor uses scaled steps for selected keys and constants and clamps both ends',async()=>{
 for(const sequenced of [true,false]) {
  for(let i=0;i<3;i++) {
   const client=new DemoClient(),f=client.data.layers[0].fields[0]
   Object.assign(f,{min:-180,max:180,sequenced,keys:sequenced?[{time:0,value:0},{time:5,value:15}]:[{time:0,value:0}]})
   const editor=new Editor(client);await editor.refresh();editor.precision=modes[i]
   await editor.adjustLiveValue(1)
   assert.equal(editor.value,[3.6,.36,.036][i])
   if(sequenced)assert.equal(f.keys[1].value,15,'other key must stay unchanged')
   await editor.adjustLiveValue(-1);assert.equal(editor.value,0)
   await editor.adjustLiveValue(10000);assert.equal(editor.value,180)
   await editor.adjustLiveValue(-10000);assert.equal(editor.value,-180)
  }
 }
})
test('small-range values remain visible at every precision and enums remain discrete',async()=>{
 assert.equal(parameterDecimals({min:0,max:.01},'ultra'),6)
 const client=new DemoClient(),f=client.data.layers[0].fields[0]
 Object.assign(f,{min:0,max:.01,keys:[{time:0,value:0}]})
 const editor=new Editor(client);await editor.refresh();editor.precision='ultra'
 await editor.adjustLiveValue(1);assert.equal(editor.valueLabel,'0.000001')
 f.choices=[{label:'A',value:0},{label:'B',value:50},{label:'C',value:90}]
 f.keys[0].value=0;await editor.refresh()
 await editor.adjustLiveValue(1);assert.equal(editor.value,50);assert.equal(editor.valueLabel,'B')
})
test('small-range encoder edits stay fine in all precision modes, including negative ranges',async()=>{
 for(const [min,max]of [[0,1],[0,.01],[-.005,.005]])for(let i=0;i<modes.length;i++){
  const client=new DemoClient(),f=client.data.layers[0].fields[0],start=(min+max)/2
  Object.assign(f,{min,max,sequenced:false,keys:[{time:0,value:start}]})
  const editor=new Editor(client);await editor.refresh();editor.precision=modes[i]
  await editor.adjustLiveValue(1)
  const expected=[.01,.001,.0001][i]*(max-min)
  assert.ok(Math.abs(editor.value-start-expected)<1e-12)
  assert.notEqual(editor.valueLabel,Number(start).toFixed(parameterDecimals(f,modes[i])))
  await editor.adjustLiveValue(-1);assert.ok(Math.abs(editor.value-start)<1e-12)
  assert.equal(f.keys.length,1)
 }
})
