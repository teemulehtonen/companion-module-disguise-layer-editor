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
    [0.25, 1, 2, 4, 8, 16, 32],
  )
  e.setTimeStep(3)
  assert.equal(e.beatStep, 4)
  e.layerEdit = 'edit'
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.value),
    [0.25, 1, 4, 8, 16, 32],
  )
  e.setTimeStep(5)
  assert.equal(e.layerBeatStep, 32)
  assert.equal(e.layerEdit, 'edit')
  e.layerEdit = ''
  e.moveKey = { time: 5, value: 1 }
  const key = e.moveKey
  assert.deepEqual(
    e.timeStepChoices.map((c) => c.value),
    [1 / 128, 1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 4, 8],
  )
  e.setTimeStep(2)
  assert.equal(e.keyBeatStep, 1 / 32)
  assert.equal(e.moveKey, key)
  assert.equal(e.time, time)
  assert.equal(e.timeStepChoices.filter((c) => c.selected).length, 1)
})
