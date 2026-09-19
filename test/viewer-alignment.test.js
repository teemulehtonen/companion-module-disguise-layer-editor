'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { alignmentGuides } = require('../src/viewer-model')

function snapshot(fps = 25) {
  return {
    fps,
    layers: [
      {
        uid: 'a',
        name: 'A',
        start: 0,
        end: 10,
        fields: [{ name: 'value', sequenced: true, keys: [{ time: 5 }] }],
      },
      {
        uid: 'b',
        name: 'B',
        start: 5,
        end: 10,
        fields: [{ name: 'default', sequenced: false, keys: [{ time: 0 }] }],
      },
    ],
  }
}
test('guides are restricted to active timing/key edit modes and ignore carrier keys', () => {
  const data = snapshot(),
    context = { focusUid: 'a', parameter: 'value', keyTime: 5 }
  assert.deepEqual(alignmentGuides(data, context), [])
  assert.deepEqual(
    alignmentGuides(data, { ...context, layerEdit: true }).map((g) => g.time),
    [0, 5, 10],
  )
  assert.deepEqual(
    alignmentGuides(data, { ...context, moveKey: true }).map((g) => g.time),
    [5],
  )
  assert.equal(alignmentGuides(data, { ...context, moveKey: true, keyTime: null })[0].subtle, true)
})
test('guides use fractional FPS without matching adjacent frames', () => {
  const fps = 60000 / 1001,
    data = snapshot(fps)
  data.layers[0].fields[0].keys[0].time = 100 / fps + 1e-10
  data.layers[1].start = 100 / fps
  const context = { focusUid: 'a', parameter: 'value', moveKey: true, keyTime: 100 / fps }
  assert.equal(alignmentGuides(data, context).length, 1)
  data.layers[1].start = 101 / fps
  assert.equal(alignmentGuides(data, context).length, 0)
})

test('layer edit shows exact moving bounds for audio and video without matches', () => {
  for (const moduleType of ['AudioModule', 'VariableVideoModule', 'ColourModule']) {
    const layer = {uid:'selected',name:'Layer',moduleType,start:1.001,end:1.009,fields:[],resources:[]}
    const data = {fps:25,layers:[layer]}
    const context = {focusUid:layer.uid,layerEdit:true}
    assert.deepEqual(alignmentGuides(data,context).map(g=>g.time),[1.001,1.009])
    layer.start+=2; layer.end+=3
    assert.deepEqual(alignmentGuides(data,context).map(g=>g.time),[3.001,4.009])
    assert.deepEqual(alignmentGuides(data,{...context,layerEdit:false}),[])
  }
})

test('subtle guides match selected-layer keys and exclude out-of-range and subframe near misses', () => {
  const data=snapshot()
  data.layers[0].fields[0].keys.push({time:12},{time:5.001})
  data.layers[1].fields=[{name:'other',sequenced:true,keys:[{time:12}]}]
  const guides=alignmentGuides(data,{focusUid:'a',parameter:'value',layerEdit:true})
  assert.deepEqual(guides.map(g=>g.time),[0,5,10])
  assert.equal(guides.find(g=>g.time===5).subtle,true)
  assert.deepEqual(alignmentGuides(data,{focusUid:'a'}),[])
})

test('key guides compare only the selected parameter against other layers', () => {
  const data=snapshot()
  data.layers[0].fields.push({name:'another',sequenced:true,keys:[{time:5},{time:7}]})
  data.layers[0].fields[0].keys.push({time:7})
  const context={focusUid:'a',parameter:'value',layerEdit:true}
  assert.deepEqual(alignmentGuides(data,context).filter(g=>g.subtle).map(g=>g.time),[5])
  data.layers[1].start=6
  data.layers[0].fields[1].keys.push({time:6})
  assert.deepEqual(alignmentGuides(data,context).filter(g=>g.subtle),[])
  assert.deepEqual(alignmentGuides(data,{...context,layerEdit:false,moveKey:true,keyTime:7}),[])
  assert.deepEqual(alignmentGuides(data,{...context,parameter:'another'}).filter(g=>g.subtle).map(g=>g.time),[6])
})
