'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { orderLayerParameters } = require('../src/parameter-order')

test('animated numeric and resource parameters precede constants in native order', () => {
  const field = (name, sequenced) => ({ name, sequenced, keys: [{ time: 0 }] })
  const layer = {
    controlOrder: ['brightness', 'media', 'position', 'volume'],
    fields: [field('brightness', false), field('position', true), field('volume', true)],
    mediaFields: [field('media', true)],
  }
  orderLayerParameters(layer)
  assert.deepEqual(
    layer.fields.map((f) => f.name),
    ['position', 'volume', 'brightness'],
  )
  assert.deepEqual(layer.parameterOrder, ['media', 'position', 'volume', 'brightness'])
  layer.fields.forEach((f) => {
    f.sequenced = false
  })
  layer.mediaFields[0].sequenced = false
  orderLayerParameters(layer)
  assert.deepEqual(layer.parameterOrder, layer.controlOrder)
})

test('refresh preserves selected parameter identity when keyframe ordering changes', async () => {
  const { Editor } = require('../src/editor')
  const fields = [
    { name: 'a', value: 0, sequenced: false, keys: [{ time: 0, value: 0 }] },
    { name: 'b', value: 0, sequenced: false, keys: [{ time: 0, value: 0 }] },
  ]
  const snapshot = {
    trackUid: '1',
    transportUid: '2',
    time: 0,
    fps: 25,
    length: 10,
    layers: [{ uid: '3', name: 'Layer', start: 0, end: 10, fields, mediaFields: [] }],
  }
  const editor = new Editor({ execute: async () => structuredClone(snapshot) })
  await editor.refresh()
  assert.equal(editor.field.name, 'a')
  fields[1].sequenced = true
  await editor.refresh({ preserve: true })
  assert.equal(editor.field.name, 'a')
  assert.equal(editor.fieldIndex, 1)
})
