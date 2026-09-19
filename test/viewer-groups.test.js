'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { summariseGroups } = require('../src/viewer-model')

test('collapsed nested groups retain child keyframe and resource markers without duplication', () => {
  const field = { name: 'value', sequenced: true, keys: [{ time: 3 }] }
  const media = { name: 'media', current: { uid: '9', thumbnail: true }, keys: [] }
  const layers = [
    { uid: '1', group: true },
    { uid: '2', group: true, parent: '1' },
    { uid: '3', parent: '2', fields: [field], resources: [media] },
  ]
  summariseGroups(layers)
  summariseGroups(layers)
  for (const group of layers.slice(0, 2)) {
    assert.deepEqual(group.fields, [field])
    assert.deepEqual(group.resources, [media])
  }
})

test('malformed parent cycles cannot hang group summaries', () => {
  const layers = [
    { uid: '1', group: true, parent: '2' },
    { uid: '2', group: true, parent: '1' },
    { uid: '3', parent: '2', fields: [], resources: [] },
  ]
  assert.equal(summariseGroups(layers).length, 3)
})

test('group markers retain last interior frame and exact OUT, but not later keys', () => {
  for (const fps of [25,30,60000/1001]) {
    const end=75, times=[end-1/fps,end,end+1/fps]
    const layers=[{uid:'g',group:true},{uid:'l',parent:'g',start:0,end,fields:[{keys:times.map(time=>({time}))}],resources:[]}]
    summariseGroups(layers)
    assert.deepEqual(layers[0].fields[0].keys.map(k=>k.time),times.slice(0,2))
  }
})
