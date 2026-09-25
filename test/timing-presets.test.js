'use strict'
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { Editor } = require('../src/editor'),
  { DemoClient } = require('../src/demo')
test('adaptive step slots expose correct time, beat, layer and key choices without releasing selection', async () => {
  const e = new Editor(new DemoClient())
  await e.refresh()
  const time = e.time
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.label),
    [
      '1 FRAME',
      '0.5 SEC',
      '1 SEC',
      '2 SEC',
      '5 SEC',
      '10 SEC',
      '30 SEC',
      '1 MIN',
      '2 MIN',
      '5 MIN',
    ],
  )
  for (const [slot, seconds] of [
    [1, 0.5],
    [6, 30],
    [8, 120],
    [9, 300],
  ]) {
    e.setTimeStep(slot)
    assert.equal(e.timeStepAmount, seconds)
    assert.equal(e.timeStepLabel, e.timeStepChoices[slot].label)
  }
  e.snapshot.beatMode = true
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.value),
    [1 / 96, 1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 4],
  )
  e.setTimeStep(3)
  assert.equal(e.beatStep, 1 / 8)
  e.layerEdit = 'edit'
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.value),
    [1 / 96, 1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 4],
  )
  e.setTimeStep(5)
  assert.equal(e.layerBeatStep, 1 / 4)
  assert.equal(e.layerEdit, 'edit')
  e.layerEdit = ''
  e.moveKey = { time: 5, value: 1 }
  const key = e.moveKey
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.value),
    [1 / 96, 1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 4],
  )
  e.setTimeStep(2)
  assert.equal(e.keyBeatStep, 1 / 12)
  assert.equal(e.moveKey, key)
  assert.equal(e.time, time)
  assert.equal(e.timeStepChoices.filter((c) => c.selected).length, 1)
})

test('all ten musical timing buttons share steps across time, layer and key modes',async()=>{
 const e=new Editor(new DemoClient());await e.refresh()
 e.snapshot.beatMode=true;e.moveKey={time:5,value:1}
 const key=e.moveKey
 const steps=[1/96,1/16,1/12,1/8,1/6,1/4,1/3,1/2,1,4]
 for(const mode of ['time','layer','key']){
 e.moveKey=mode==='key'?key:null;e.layerEdit=mode==='layer'?'in':''
 for(const [slot,amount] of steps.entries()){
  e.setTimeStep(slot)
  assert.equal(e.timeStepAmount,amount)
  assert.equal(e.gridSteps.beat,amount)
  assert.equal(e.timeStepChoices[slot].selected,true)
  assert.equal(e.timeStepChoices.filter(x=>x.selected).length,1)
  assert.equal(e.moveKey,mode==='key'?key:null)
  assert.equal(e.timeStepLabel,e.timeStepChoices[slot].label)
 }
 }
})

test('linked playback crossing BPM regions updates Companion timing choices without a refresh',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path')
 const source=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8').replaceAll(String.fromCharCode(13),'')
 const from=source.indexOf('          (state, update) => {',source.indexOf('const connection = new Connection('))
 const end=source.indexOf(String.fromCharCode(10)+'          },'+String.fromCharCode(10)+'          {',from)
 assert.ok(from>=0 && end>from)
 const e=new Editor(new DemoClient());await e.refresh()
 e.followTimeline=()=>{};e.acceptPlaybackMode=()=>{}
 const state={connected:true,trackUid:e.snapshot.trackUid,probeRevision:1,clock:{fps:25,mode:'25',custom:false,beatMode:false},watch(){}}
 const host={connection:state,editor:e,lastProbeRevision:1,connectionStatus(){},publish(){},acceptClockPresentation(){},requestSync(){throw Error('Unexpected refresh')}}
 const callback=vm.runInNewContext('(function(){return '+source.slice(from,end)+'}}).call(host)',{host,connection:state})
 for(const mode of [false,true,false]){
  state.clock.beatMode=mode;callback(state)
  assert.equal(e.beatMode,mode)
  assert.equal(e.timeStepChoices[0].label,mode?'1/96 BEAT':'1 FRAME')
  assert.equal(e.timeStepChoices[9].label,mode?'4 BEATS':'5 MIN')
 }
 e.linkTime=false;state.clock.beatMode=true;callback(state)
 assert.equal(e.beatMode,false,'Unlinked editing must not inherit another playback position')
})
