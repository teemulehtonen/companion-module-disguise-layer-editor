'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')
async function ready() {
  const e = new Editor(new DemoClient())
  await e.refresh()
  return e
}

test('new keys default to smooth while replacing a key preserves its type', async () => {
  const e = await ready()
  await e.adjustLiveTime(1, 2)
  await e.pressValue()
  assert.equal(e.field.keys.find((k) => k.time === 2).interpolation, 2)
  await e.cycleKeyType()
  assert.equal(e.field.keys.find((k) => k.time === 2).interpolation, 0)
  await e.pressValue()
  assert.equal(e.field.keys.find((k) => k.time === 2).interpolation, 0)
})

test('DEFAULT ALL PARAMETERS confirms once and resets constants, animation and resources only on its layer', async () => {
  const e = await ready()
  const layer = e.client.data.layers[0]
  for (const f of layer.fields) {
    f.defaultValue = 0.25
    f.value = 0.8
    f.sequenced = false
    f.keys = [{ time: -20, value: 0.8 }]
  }
  layer.fields[1].keys.push({ time: 500, value: 0.9 })
  layer.fields.push({ name: 'empty', defaultValue: 0.25, value: 0.8, keys: [], sequenced: true })
  layer.mediaFields = [
    {
      name: 'palette',
      label: 'Palette',
      defaultValue: null,
      resourceUid: 'synthetic-resource',
      sequenced: true,
      keys: [
        { time: -10, resourceUid: 'synthetic-resource' },
        { time: 500, resourceUid: 'other' },
      ],
    },
  ]
  const before = structuredClone(e.client.data)
  await e.refresh()
  await e.padDown(5, 100)
  await e.padUp(5, 1200)
  assert.ok(e.clearKeysBrowser) // also reachable from the constant DEFAULT button
  await e.pressPad(4)
  assert.equal(e.clearKeysPrompt.allParameters, true)
  assert.deepEqual(e.client.data, before)
  await e.pressPad(6) // cancel
  assert.deepEqual(e.client.data, before)
  await e.pressPad(4)
  await e.pressPad(5)
  for (const f of layer.fields) {
    assert.equal(f.value, 0.25)
    assert.equal(f.sequenced, false)
    assert.equal(f.keys.length, 1)
    assert.equal(f.keys[0].time, layer.start)
  }
  assert.equal(layer.mediaFields[0].resourceUid, null)
  assert.equal(layer.mediaFields[0].keys.length, 1)
  assert.deepEqual(e.client.data.layers[1], before.layers[1])
  assert.equal(e.clearKeysBrowser, null)
})

test('all-parameter defaults reject missing confirmation and unavailable defaults before any write', async () => {
  const e = await ready()
  for (const f of e.client.data.layers[0].fields) {
    f.keys = [{ time: 0, value: 0.5 }]
    delete f.defaultValue
  }
  const before = structuredClone(e.client.data)
  await assert.rejects(e.client.execute('layer_default', { ...e.liveArgs() }), /confirm/)
  await assert.rejects(
    e.client.execute('layer_default', { ...e.liveArgs(), confirmed: true }),
    /Default value/,
  )
  assert.deepEqual(e.client.data, before)
})

test('playback releases an unlocked key selection but retains active SELECT KEY', async () => {
  const e = await ready()
  e.client.data.time = 4
  e.time = 4
  await e.toggleMoveKey()
  await e.toggleMoveKey()
  await e.togglePlayback()
  e.followTime(11)
  e.acceptLive({ field: { value: 0 } })
  e.loadValue()
  assert.equal(e.selectedKeyTime, null)
  assert.equal(e.selectedKey.time, 10)
  assert.equal(e.value, 0)
  e.client.data.time = 5
  e.time = 5
  await e.toggleMoveKey()
  await e.togglePlayback()
  e.followTime(11)
  e.loadValue()
  assert.equal(e.selectedKeyTime, 5)
  assert.equal(e.selectedKey.time, 5)
  assert.equal(e.value, 1)
})

test('external time changes release keys created without a navigation anchor', async () => {
  const e = await ready()
  e.client.data.time = 7
  e.time = 7
  await e.pressValue()
  assert.equal(e.selectedKeyTime, 7)
  assert.equal(e.navigationTime, null)
  e.followTime(11)
  e.loadValue()
  assert.equal(e.selectedKeyTime, null)
  assert.equal(e.selectedKey.time, 10)
})

test('rapid scrub accumulates every detent while Designer jump feedback is delayed', async () => {
  const e = await ready()
  e.timeStep = 'second'
  for (let i = 1; i <= 6; i++) {
    e.client.data.time = 0
    await e.adjustLiveTime(1)
    e.followTimeline({ trackUid: e.snapshot.trackUid, time: 0, layers: e.snapshot.layers })
    assert.equal(e.time, i)
    assert.equal(e.stale, false)
  }
  e.followTime(6)
  assert.equal(e.pendingJump, null)
  e.client.data.time = 20
  e.followTime(20)
  await e.adjustLiveTime(-1)
  assert.equal(e.time, 19)
})

test('rotation edits the selected key between keys without adding or moving any key', async () => {
  const e = await ready()
  await e.keyLive(1)
  e.client.data.time = 7
  e.followTime(7)
  await e.adjustLiveValue(-1, 0.1)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 5, 10],
  )
  assert.equal(e.field.keys[1].value, 0.9)
  assert.equal(e.field.keys[0].value, 0.5)
  await e.pressValue()
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 5, 7, 10],
  )
})
test('unsequenced and single-key fields never gain keys through rotation', async () => {
  const e = await ready()
  await e.selectLive('field', 1)
  e.client.data.time = 7
  e.followTime(7)
  await e.adjustLiveValue(1)
  assert.equal(e.field.sequenced, false)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0],
  )
  assert.equal(e.field.keys[0].value, 1.1)
  await e.pressValue()
  assert.equal(e.field.sequenced, true)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 7],
  )
})
test('enum choices use actual values and fine mode respects numeric bounds', async () => {
  const e = await ready()
  const f = e.client.data.layers[0].fields[0]
  f.choices = [
    { label: 'Over', value: 0.5 },
    { label: 'Add', value: 9 },
    { label: 'Multiply', value: 22 },
  ]
  await e.refresh()
  await e.adjustLiveValue(1)
  assert.equal(e.valueLabel, 'Add')
  assert.equal(e.value, 9)
  delete f.choices
  f.min = 0
  f.max = 1
  f.keys[0].value = 0.999
  f.step = 0.1
  await e.refresh()
  e.fine = true
  await e.adjustLiveValue(1)
  assert.equal(e.value, 1)
})
test('COARSE / FINE / ULTRA scale numeric steps, but enums remain discrete', async () => {
  const e = await ready()
  await e.adjustLiveValue(1, 1)
  assert.equal(e.value, 1.5)
  e.cyclePrecision()
  await e.adjustLiveValue(1, 1)
  assert.equal(e.value, 1.6)
  e.cyclePrecision()
  await e.adjustLiveValue(1, 1)
  assert.equal(e.value, 1.61)
  e.cyclePrecision()
  assert.equal(e.precision, 'coarse')
})
test('frame arithmetic supports 25, 30, 23.976 and 29.97 FPS without rounding FPS to an integer', async () => {
  for (const fps of [24, 25, 30, 50, 60, 120, 24000 / 1001, 30000 / 1001, 60000 / 1001]) {
    const e = await ready()
    e.client.data.fps = fps
    await e.refresh()
    for (let i = 0; i < 70; i++) await e.adjustLiveTime(1)
    assert.ok(Math.abs(e.time - 70 / fps) < 1e-10)
  }
})
test('frame time uses source FPS and moving keys preserves value and interpolation', async () => {
  const e = await ready()
  await e.adjustLiveTime(1)
  assert.equal(e.time, 0.04)
  await e.toggleMoveKey()
  await e.adjustLiveTime(1)
  assert.equal(e.field.keys[0].time, 0.04)
  assert.equal(e.field.keys[0].value, 0.5)
  assert.equal(e.field.keys[0].interpolation, 2)
  await e.adjustLiveTime(1, 4.96)
  assert.equal(e.time, 0.04)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0.04, 5, 10],
  )
  e.cycleTimeStep()
  assert.equal(e.timeStep, 'half')
  e.cycleTimeStep()
  assert.equal(e.timeStep, 'second')
  assert.equal(e.moveKey.time, 0.04)
  await e.adjustLiveTime(1)
  assert.equal(e.selectedKey.time, 1.04)
  for (const step of ['two', 'five', 'ten', 'thirty', 'minute', 'twoMinutes', 'fiveMinutes', 'frame']) {
    e.cycleTimeStep()
    assert.equal(e.timeStep, step)
    assert.equal(e.moveKey.time, 1.04)
  }
  await e.toggleMoveKey()
  assert.equal(e.moveKey, null)
})
test('layer move shifts all keys and playhead; trims clamp at one frame', async () => {
  const e = await ready()
  e.client.data.layers[0].end = 50
  await e.refresh()
  e.cycleLayerEdit()
  await e.adjustLiveTime(1, 5)
  assert.equal(e.layer.start, 5)
  assert.equal(e.layer.end, 55)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [5, 10, 15],
  )
  assert.equal(e.layer.uid, 'demo-1') // keep selected while moving out of the playhead
  e.cycleLayerEdit()
  await e.adjustLiveTime(1, 5)
  assert.equal(e.layer.start, 10)
  assert.equal(e.layer.end, 55)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [5, 10, 15],
  )
  e.cycleLayerEdit()
  await e.adjustLiveTime(-1, 5)
  assert.equal(e.layer.end, 50)
  await e.adjustLiveTime(-1, 50)
  assert.equal(e.layer.end, 10 + 1 / 25)
  assert.ok(e.time >= e.layer.start && e.time <= e.layer.end)
  e.cycleTimeStep()
  assert.equal(e.layerEdit, '')
  assert.equal(e.layer.uid, 'demo-1')
})
test('parameter browsing never opens media; MEDIA is explicit and PARAMS preserves selection', async () => {
  const e = await ready()
  e.layer.controlOrder = ['brightness', 'video', 'speed']
  const calls = []
  const original = e.client.execute.bind(e.client)
  e.client.execute = async (c, a) => {
    calls.push(c)
    if (c === 'media_list')
      return {
        media: [{ uid: '1', name: 'Clip A', path: 'objects/videoclip/show/clip.mov' }],
        selectedUid: '1',
      }
    return original(c, a)
  }
  await e.selectLive('field', 1)
  assert.equal(e.mediaMode, false)
  assert.equal(e.field.name, 'speed')
  assert.ok(!calls.includes('media_list'))
  await e.toggleMedia()
  assert.equal(e.mediaMode, true)
  assert.equal(e.mediaFolder, 'show')
  assert.equal(e.currentMedia.name, 'Clip A')
  assert.ok(!calls.includes('media_set'))
  await e.toggleMedia()
  assert.equal(e.field.name, 'brightness')
  assert.equal(e.mediaMode, false)
  await e.selectLive('field', 1)
  assert.equal(e.field.name, 'speed')
  e.layer.end = 1
  e.followTime(2)
  assert.equal(e.mediaAll.length, 0)
})
test('rapid NEXT/PREV uses selected key despite delayed or rounded playhead feedback', async () => {
  const e = await ready()
  await e.keyLive(1)
  assert.equal(e.selectedKeyTime, 5)
  e.followTime(0)
  assert.equal(e.time, 5)
  e.client.data.time = 0 // Designer has not yet executed the queued jump
  await e.keyLive(1)
  assert.equal(e.selectedKeyTime, 10)
  e.followTime(5)
  assert.equal(e.time, 10)
  e.client.data.time = 9.999
  await e.keyLive(-1)
  assert.equal(e.selectedKeyTime, 5)
  await e.keyLive(-1)
  assert.equal(e.selectedKeyTime, 0)
  await e.keyLive(-1)
  assert.equal(e.selectedKeyTime, 0) // boundary is a no-op
  await e.adjustLiveTime(1, 7)
  await e.keyLive(-1)
  assert.equal(e.selectedKeyTime, 5) // scrub resets navigation
})
test('key navigation ignores trimmed-out keys and visits layer bounds without creating keys', async () => {
  const e = await ready()
  e.client.data.layers[0].start = 2
  e.client.data.layers[0].end = 8
  e.client.data.time = 4
  await e.refresh()
  await e.keyLive(-1)
  e.followTime(0)
  assert.equal(e.layer.uid, 'demo-1')
  assert.equal(e.time, 2)
  assert.equal(e.selectedKeyTime, null)
  await e.keyLive(-1)
  assert.equal(e.time, 2)
  await e.keyLive(1)
  assert.equal(e.selectedKeyTime, 5)
  await e.keyLive(1)
  assert.equal(e.time, 8)
  assert.equal(e.selectedKeyTime, null)
  await e.keyLive(1)
  assert.equal(e.time, 8)
  await e.keyLive(-1)
  assert.equal(e.time, 5)
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 5, 10],
  )
})
test('an acknowledged jump followed by a Designer seek resets the navigation anchor', async () => {
  const e = await ready()
  await e.keyLive(1)
  e.followTime(5)
  e.client.data.time = 2
  e.followTime(2)
  assert.equal(e.navigationTime, null)
  await e.keyLive(1)
  assert.equal(e.selectedKeyTime, 5)
})

test('empty-key NEXT reaches exact OUT and PREV returns to IN', async () => {
  for (const fps of [24, 25, 30, 50, 60, 120, 24000 / 1001, 30000 / 1001, 60000 / 1001]) {
    const e = await ready()
    e.client.data.fps = fps
    e.client.data.layers[0].start = 2
    e.client.data.layers[0].end = 8
    e.client.data.layers[0].fields[0].keys = []
    e.client.data.time = 4
    await e.refresh()
    await e.keyLive(1)
    assert.equal(e.time, 8)
    await e.keyLive(1)
    assert.equal(e.time, 8)
    await e.keyLive(-1)
    assert.equal(e.time, 2)
  }
})

test('default dial increments are tenths, hundredths and thousandths regardless of metadata step', async () => {
  const e = await ready()
  const f = e.client.data.layers[0].fields[0]
  f.step = 0.00001
  f.min = 0
  f.max = 1
  f.keys[0].value = 0
  await e.refresh()
  await e.adjustLiveValue(1)
  assert.equal(e.value, 0.1)
  e.cyclePrecision()
  await e.adjustLiveValue(1)
  assert.equal(e.value, 0.11)
  e.cyclePrecision()
  await e.adjustLiveValue(1)
  assert.equal(e.value, 0.111)
  await e.adjustLiveValue(-1)
  assert.equal(e.value, 0.11)
  e.cyclePrecision()
  for (let i = 0; i < 10; i++) await e.adjustLiveValue(1)
  assert.equal(e.value, 1)
  assert.equal(f.keys.length, 3)
  f.integer = true
  f.keys[0].value = 0
  await e.refresh()
  for (const precision of ['coarse', 'fine', 'ultra']) {
    e.precision = precision
    const before = e.value
    await e.adjustLiveValue(1)
    assert.equal(e.value, Math.min(1, before + 1))
  }
})

test('SELECT KEY chooses the nearest key; equal distances select the following key', async () => {
  for (const [time, expected] of [
    [1, 0],
    [4, 5],
    [2.5, 5],
    [7.5, 10],
    [14, 10],
  ]) {
    const e = await ready()
    e.client.data.time = time
    e.time = time
    await e.toggleMoveKey()
    assert.equal(e.moveKey.time, expected)
    assert.equal(e.selectedKeyTime, expected)
    assert.equal(e.selectedKey.time, expected)
    assert.equal(e.time, expected)
  }
})

test('a second SELECT KEY press unlocks without a seek or new selection', async () => {
  const e = await ready()
  e.time = 4
  e.client.data.time = 4
  await e.toggleMoveKey()
  assert.equal(e.time, 5)
  e.client.execute = () => {
    throw new Error('Unexpected Designer command')
  }
  await e.toggleMoveKey()
  assert.equal(e.moveKey, null)
  assert.equal(e.selectedKeyTime, null)
  assert.equal(e.time, 5)
  e.select('field', 1)
  assert.equal(e.field.name, 'speed')
})

test('key movement clamps at its own current IN and OUT for every supported frame rate', async () => {
  for (const fps of [24, 25, 30, 50, 60, 120, 24000 / 1001, 30000 / 1001, 60000 / 1001]) {
    const e = await ready()
    e.client.data.fps = fps
    const layer = e.client.data.layers[0]
    Object.assign(layer, { start: 2, end: 8 })
    layer.fields[0].keys = [{ time: 5, value: 0.5, interpolation: 2 }]
    e.client.data.time = 5
    await e.refresh()
    await e.toggleMoveKey()
    await e.adjustLiveTime(1, 60)
    assert.equal(e.time, 8)
    await e.adjustLiveTime(1)
    assert.equal(e.time, 8)
    await e.adjustLiveTime(-1, 60)
    assert.equal(e.time, 2)
    await e.adjustLiveTime(-1)
    assert.equal(e.time, 2)
    assert.equal(layer.fields[0].keys.length, 1)
    // Designer trims after selection: the next move uses the updated bounds.
    layer.start = 3
    layer.end = 7
    await e.adjustLiveTime(1, 60)
    assert.equal(e.time, 7)
    await e.adjustLiveTime(-1, 60)
    assert.equal(e.time, 3)
    assert.equal(e.layer.uid, layer.uid)
  }
})

test('NEXT reads a Designer layer change before the next poll and discards the old jump anchor', async () => {
  const e = await ready()
  const other = e.client.data.layers[1]
  other.start = 0
  other.end = 120
  other.fields[0].sequenced = true
  other.fields[0].keys = [
    { time: 0, value: 1 },
    { time: 7, value: 0 },
    { time: 9, value: 1 },
  ]
  await e.keyLive(1)
  assert.equal(e.time, 5)
  // Mouse change happens before any selection feedback has reached Companion.
  e.client.data.selectedLayerUids = [other.uid]
  e.client.data.time = 1
  await e.keyLive(1)
  assert.equal(e.layer.uid, other.uid)
  assert.equal(e.time, 7)
  await e.keyLive(-1)
  assert.equal(e.time, 0)
})

test('unchanged Designer selection does not override a layer chosen using the encoder', async () => {
  const e = await ready()
  e.client.data.selectedLayerUids = ['demo-1']
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: ['demo-1'] })
  await e.selectLive('layer', 1)
  assert.equal(e.layer.uid, 'demo-2')
  await e.keyLive(1)
  assert.equal(e.layer.uid, 'demo-2')
})

test('encoder selection wins even before the first Designer selection poll arrives', async () => {
  const e = await ready()
  e.client.data.selectedLayerUids = ['demo-1']
  // Do not deliver followDesignerSelection first: this was the missing race.
  await e.selectLive('layer', 1)
  assert.equal(e.layer.uid, 'demo-2')
  await e.keyLive(-1)
  await e.keyLive(-1)
  assert.equal(e.layer.uid, 'demo-2')
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: ['demo-1'] })
  assert.equal(e.layer.uid, 'demo-2')
  // A genuinely new mouse selection is still followed.
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: [] })
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: ['demo-1'] })
  assert.equal(e.layer.uid, 'demo-1')
})

test('deselecting and reselecting the same Designer layer resets a stale navigation cursor', async () => {
  const e = await ready()
  e.client.data.selectedLayerUids = ['demo-1']
  await e.keyLive(1)
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: [] })
  e.client.data.time = 1
  await e.keyLive(1)
  assert.equal(e.time, 5)
})

test('Designer-highlighted layer leaves the editor when the playhead leaves its range', async () => {
  const e = await ready()
  e.client.data.layers[0].end = 30
  Object.assign(e.client.data.layers[1], { start: 0, end: 10 })
  e.client.data.selectedLayerUids = ['demo-2']
  await e.refresh({ preserve: true })
  assert.equal(e.layer.uid, 'demo-2')
  e.client.data.time = 15
  await e.refresh({ preserve: true })
  assert.equal(e.layer.uid, 'demo-1')
  assert.equal(e.activeLayers.length, 1)
  e.client.data.time = 40
  await e.refresh({ preserve: true })
  assert.equal(e.layer, undefined)
  assert.equal(e.field, undefined)
  assert.equal(e.activeLayers.length, 0)
  // Returning to an overlap does not manufacture another mouse click.
  e.client.data.time = 5
  await e.refresh({ preserve: true })
  assert.equal(e.layer.uid, 'demo-1')
})

test('PREV at own IN never jumps into another overlapping Designer-highlighted layer', async () => {
  const e = await ready()
  const [first, second] = e.client.data.layers
  Object.assign(first, { start: 0, end: 10 })
  first.fields[0].keys = [0, 3, 7].map((time) => ({ time, value: 1 }))
  Object.assign(second, { start: 5, end: 20 })
  second.fields[0].sequenced = true
  second.fields[0].keys = [8, 12, 18].map((time) => ({ time, value: 1 }))
  e.client.data.time = 15
  e.client.data.selectedLayerUids = [first.uid]
  await e.refresh({ preserve: true })
  assert.equal(e.layer.uid, second.uid)
  for (const target of [12, 8, 5, 5]) {
    await e.keyLive(-1)
    assert.equal(e.layer.uid, second.uid)
    assert.equal(e.time, target)
  }
  for (const target of [8, 12, 18, 20]) {
    await e.keyLive(1)
    assert.equal(e.layer.uid, second.uid)
    assert.equal(e.time, target)
  }
})

test('a direct Designer seek out of a locked layer releases the key lock', async () => {
  const e = await ready()
  e.client.data.layers[0].end = 10
  e.client.data.layers[1].start = 0
  e.client.data.layers[1].end = 120
  await e.refresh({ preserve: true })
  await e.toggleMoveKey()
  e.followTime(e.time) // Acknowledge the selected-key jump.
  e.followTime(20)
  assert.equal(e.moveKey, null)
  assert.equal(e.layer.uid, 'demo-2')
})

test('selected key locks selectors and retains edits for a subsequent move', async () => {
  const e = await ready()
  e.client.data.time = 4
  e.time = 4
  await e.toggleMoveKey()
  const uid = e.layer.uid,
    name = e.field.name
  await e.selectLive('layer', 1)
  await e.selectLive('field', 1)
  assert.equal(e.layer.uid, uid)
  assert.equal(e.field.name, name)
  e.followDesignerSelection({ trackUid: e.snapshot.trackUid, selectedLayerUids: ['demo-2'] })
  assert.equal(e.layer.uid, uid)
  await e.adjustLiveValue(1)
  await e.cycleKeyType()
  const value = e.value,
    interpolation = e.selectedKey.interpolation
  await e.adjustLiveTime(1)
  assert.equal(e.selectedKey.time, 5.04)
  assert.equal(e.selectedKey.value, value)
  assert.equal(e.selectedKey.interpolation, interpolation)
  e.followTime(5.04)
  assert.equal(e.selectedKeyTime, 5.04)
  e.cycleTimeStep()
  await e.selectLive('field', 1)
  assert.equal(e.field.name, name)
  await e.toggleMoveKey()
  await e.selectLive('field', 1)
  assert.notEqual(e.field.name, name)
})

test('automatic snapshot updates preserve field identity and key move while layers change', async () => {
  const e = await ready()
  await e.keyLive(1)
  await e.toggleMoveKey()
  const uid = e.layer.uid,
    field = e.field.name,
    selected = e.selectedKeyTime
  e.client.data.layers.unshift({ ...structuredClone(e.client.data.layers[0]), uid: 'new-layer' })
  await e.refresh({ preserve: true })
  assert.equal(e.layer.uid, uid)
  assert.equal(e.field.name, field)
  assert.equal(e.selectedKeyTime, selected)
  assert.equal(e.moveKey.time, selected)
  e.client.data.layers.find((l) => l.uid === uid).fields.reverse()
  await e.refresh({ preserve: true })
  assert.equal(e.field.name, field)
  e.client.data.layers = e.client.data.layers.filter((l) => l.uid !== uid)
  await e.refresh({ preserve: true })
  assert.notEqual(e.layer.uid, uid)
  assert.equal(e.moveKey, null)
})

test('media dial previews across pages; press applies exactly once and returns; PARAMS cancels', async () => {
  const e = await ready()
  const calls = []
  const original = e.client.execute.bind(e.client)
  e.client.execute = async (c, a) => {
    calls.push([c, a])
    if (c === 'media_list')
      return {
        media: Array.from({ length: 14 }, (_, i) => ({
          uid: String(i),
          name: 'File ' + i,
          path: 'objects/VideoClip/show/file' + i,
        })),
        selectedUid: '0',
      }
    if (c === 'media_set') return {}
    return original(c, a)
  }
  await e.toggleMedia()
  for (let i = 0; i < 8; i++) await e.browseMedia(1)
  assert.equal(e.mediaPage, 1)
  assert.equal(e.currentMedia.uid, '8')
  assert.equal(calls.filter(([c]) => c === 'media_set').length, 0)
  await e.pressValue()
  assert.equal(e.mediaMode, false)
  assert.equal(e.field.name, 'brightness')
  const writes = calls.filter(([c]) => c === 'media_set')
  assert.equal(writes.length, 1)
  assert.equal(writes[0][1].mediaUid, '8')
  assert.equal(writes[0][1].field, 'video')
  assert.ok(!calls.some(([c]) => c === 'media_key_set'))
  await e.toggleMedia()
  await e.browseMedia(1)
  await e.toggleMedia()
  assert.equal(calls.filter(([c]) => c === 'media_set').length, 1)
})

test('resource keyframe mode writes the preview at the playhead and resets on reopen', async () => {
  const e = await ready()
  const calls = []
  e.client.execute = async (command, args) => {
    calls.push([command, args])
    return {
      canAnimate: true,
      media: [{ uid: '101', name: 'Clip', folder: 'Clips', path: 'objects/VideoClip/Clips/clip' }],
      selectedUid: '101',
    }
  }
  await e.toggleMedia()
  e.toggleMediaKeyframe()
  assert.equal(e.mediaKeyframe, true)
  assert.equal(calls.filter(([c]) => c === 'media_key_set').length, 0)
  await e.pressValue()
  const writes = calls.filter(([c]) => c === 'media_key_set')
  assert.equal(writes.length, 1)
  assert.equal(writes[0][1].mediaUid, '101')
  assert.equal(writes[0][1].field, 'video')
  assert.equal(e.mediaMode, false)
  await e.toggleMedia()
  assert.equal(e.mediaKeyframe, false)
})

test('resource thumbnail honours keyframe mode and unsupported sources cannot enable it', async () => {
  const e = await ready()
  const writes = []
  let canAnimate = true
  e.client.execute = async (command, args) => {
    if (command !== 'media_list') writes.push([command, args])
    return {
      canAnimate,
      media: [{ uid: '101', name: 'Resource', folder: 'Internal', path: 'objects/resource/item' }],
      selectedUid: '101',
    }
  }
  await e.toggleMedia()
  e.toggleMediaKeyframe()
  await e.pressPad(0)
  assert.equal(writes[0][0], 'media_key_set')
  canAnimate = false
  await e.selectMediaField(1)
  e.toggleMediaKeyframe()
  assert.equal(e.mediaKeyframe, false)
  await e.pressValue()
  assert.equal(writes[1][0], 'media_set')
})

test('failed resource keyframe apply retains browser and preview', async () => {
  const e = await ready()
  e.client.execute = async (command) => {
    if (command === 'media_key_set') throw new Error('Resource changed')
    return {
      canAnimate: true,
      media: [{ uid: '101', name: 'Resource', folder: '/', path: 'objects/resource/item' }],
      selectedUid: '101',
    }
  }
  await e.toggleMedia()
  e.toggleMediaKeyframe()
  await assert.rejects(e.pressValue(), /Resource changed/)
  assert.equal(e.mediaMode, true)
  assert.equal(e.mediaKeyframe, true)
  assert.equal(e.currentMedia.uid, '101')
})

test('SOURCE and folders browse without writing; failed apply keeps browser open', async () => {
  const e = await ready()
  e.layer.mediaFields.push({ name: 'palette', label: 'Palette' })
  const calls = []
  e.client.execute = async (c, a) => {
    calls.push([c, a])
    if (c === 'media_set') throw new Error('Designer unavailable')
    return {
      media: [
        { uid: '1', name: 'One', path: 'objects/DxTexture/a/one' },
        { uid: '2', name: 'Two', path: 'objects/DxTexture/b/two' },
      ],
      selectedUid: '1',
    }
  }
  await e.toggleMedia()
  await e.selectMediaField(1)
  assert.equal(e.mediaField.name, 'palette')
  e.selectMediaFolder(1)
  assert.equal(e.mediaFolder, 'b')
  assert.equal(e.currentMedia, undefined)
  await e.pressValue()
  assert.equal(e.mediaMode, true)
  await e.browseMedia(1)
  assert.ok(calls.every(([c]) => c === 'media_list'))
  await assert.rejects(e.pressValue(), /Designer unavailable/)
  assert.equal(e.mediaMode, true)
  assert.equal(e.currentMedia.uid, '2')
})

test('parameter defaults prefer Brightness, then Volume, then Designer field order', async () => {
  const e = await ready()
  for (const [names, expected] of [
    [['speed', 'brightness'], 'brightness'],
    [['mode', 'volume'], 'volume'],
    [['width', 'height'], 'width'],
  ]) {
    e.client.data.layers[0].fields = names.map((name) => ({
      name,
      label: name,
      value: 1,
      keys: [{ time: 0, value: 1 }],
    }))
    await e.refresh()
    e.selectDefaultParameter()
    assert.equal(e.field.name, expected)
    e.fieldIndex = 1
    e.mediaMode = true
    await e.toggleMedia()
    assert.equal(e.field.name, expected)
  }
})

test('constant carriers inside a layer never attract NEXT/PREV, including stale anchors', async () => {
  for (const fps of [25, 30000 / 1001, 60000 / 1001]) {
    const e = await ready()
    e.client.data.fps = fps
    const layer = e.client.data.layers[0]
    layer.start = 74
    layer.end = 128
    layer.fields[0].sequenced = false
    layer.fields[0].keys = [{ time: 92, value: 0.6 }]
    e.client.data.time = 80
    await e.refresh()
    e.navigationTime = 92
    await e.keyLive(1)
    assert.equal(e.time, 128)
    assert.equal(e.selectedKeyTime, null)
    await e.keyLive(-1)
    assert.equal(e.time, 74)
    await e.keyLive(-1)
    assert.equal(e.time, 74)
    await e.keyLive(1)
    assert.equal(e.time, 128)
    assert.deepEqual(layer.fields[0].keys, [{ time: 92, value: 0.6 }])
  }
})

test('live evaluated values between keys are displayed without changing the edit target', async () => {
  const e = await ready()
  e.time = 2.5
  e.acceptLive({ field: { value: 0.75 } })
  assert.equal(e.value, 0.75)
  assert.equal(e.selectedKey.time, 0)
  e.acceptLive({ field: { value: 0.6875 } })
  assert.equal(e.value, 0.6875)
  e.precision = 'ultra'
  assert.equal(e.valueLabel, '0.688')
  assert.equal(e.field.keys[0].value, 0.5)
})

test('SELECT KEY ignores constant carriers and empty or out-of-range animation', async () => {
  for (const [sequenced, keys] of [
    [false, [{ time: 5, value: 1 }]],
    [true, []],
    [true, [{ time: 500, value: 1 }]],
  ]) {
    const e = await ready()
    Object.assign(e.field, { sequenced, keys })
    const before = e.time
    assert.equal(e.canSelectKey, false)
    await e.toggleMoveKey()
    assert.equal(e.time, before)
    assert.equal(e.moveKey, null)
  }
})

test('removing animation releases a selected key and blocks stale movement', async () => {
  const e = await ready()
  await e.toggleMoveKey()
  assert.ok(e.moveKey)
  const args = { ...e.liveArgs(), sourceTime: e.moveKey.time, expectedKey: e.moveKey, delta: 1 }
  e.acceptLive({ field: { sequenced: false, value: 0.5 } })
  assert.equal(e.moveKey, null)
  assert.equal(e.selectedKeyTime, null)
  e.client.data.layers[0].fields[0].sequenced = false
  await assert.rejects(e.client.execute('key_move', args), /constant parameter/)
})

test('empty timeline and empty media controls are harmless', async () => {
  const e = await ready()
  e.client.data.layers = []
  await e.refresh()
  for (const slot of [0, 1, 2, 4, 5, 6, 7]) {
    await e.padDown(slot)
    await e.padUp(slot)
  }
  await e.adjustLiveValue(1)
  await e.pressValue()
  await e.toggleMoveKey()
  await e.cycleKeyType()
  e.mediaMode = true
  e.mediaAll = []
  await e.browseMedia(1)
  await e.setMedia(7)
  await e.pressValue()
  assert.equal(e.moveKey, null)
})
