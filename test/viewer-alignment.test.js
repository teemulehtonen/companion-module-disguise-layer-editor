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
    [0, 10],
  )
  assert.deepEqual(
    alignmentGuides(data, { ...context, moveKey: true }).map((g) => g.time),
    [5],
  )
  assert.deepEqual(alignmentGuides(data, { ...context, moveKey: true, keyTime: null }), [])
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
