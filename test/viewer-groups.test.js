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
