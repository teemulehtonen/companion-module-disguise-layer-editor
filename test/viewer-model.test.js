'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { visibleParameters } = require('../src/viewer-model')
const { renderRevision } = require('../src/viewer-model')

test('live value changes do not redraw geometry but keyframe edits do', () => {
  const field = { name: 'value', value: 0, keys: [{ time: 0, value: 0 }] }
  const data = { layers: [{ fields: [field] }] }
  const first = renderRevision(data)
  field.value = 0.7
  assert.equal(renderRevision(data), first)
  field.keys[0].value = 0.7
  assert.notEqual(renderRevision(data), first)
})

test('show all includes constants and resources without changing sequencing or native data', () => {
  const layer = {
    controlOrder: ['brightness', 'media', 'volume'],
    fields: [
      { name: 'brightness', value: 0.7, sequenced: false, keys: [{ time: 0 }] },
      { name: 'volume', value: 0.5, sequenced: true, keys: [{ time: 0 }, { time: 2 }] },
    ],
    resources: [{ name: 'media', sequenced: false, current: { name: 'Clip' }, keys: [] }],
  }
  const before = structuredClone(layer)
  assert.deepEqual(
    visibleParameters(layer).map((f) => f.name),
    ['volume'],
  )
  assert.deepEqual(
    visibleParameters(layer, true).map((f) => f.name),
    ['volume', 'brightness', 'media'],
  )
  assert.equal(visibleParameters(layer, true)[1].value, 0.7)
  assert.deepEqual(layer, before)
})
