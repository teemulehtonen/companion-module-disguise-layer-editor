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

test('DELETE ALL clears keys before IN and after OUT, including disabled resource sequences', async () => {
  for (const resource of [false, true]) {
    const e = await ready()
    const layer = e.client.data.layers[0]
    layer.start = 10
    layer.end = 20
    e.client.data.time = 15
    const field = resource ? layer.mediaFields[0] : layer.fields[0]
    Object.assign(field, {
      sequenced: !resource,
      resourceUid: 'current-resource',
      keys: [-30, 0, 15, 21, 100].map((time) => ({ time, value: 0.5, resourceUid: 'current-resource' })),
    })
    await e.refresh()
    await e.openClearKeys()
    e.clearKeysBrowser.index = e.clearKeysBrowser.items.findIndex((item) => item.name === field.name)
    assert.equal(e.clearKeysBrowser.items[e.clearKeysBrowser.index].keyCount, 5)
    e.requestClearKeys()
    await e.confirmClearKeys()
    assert.equal(field.keys.length, 1)
    assert.equal(field.keys[0].time, 10)
    assert.equal(field.sequenced, false)
    if (resource) assert.equal(field.keys[0].resourceUid, 'current-resource')
  }
})

test('short DELETE press deletes one key only on release', async () => {
  const e = await ready()
  await e.padDown(5, 100)
  assert.equal(e.field.keys.length, 3)
  await e.padUp(5, 300)
  assert.equal(e.field.keys.length, 2)
  assert.equal(e.clearKeysPrompt, undefined)
})

test('held DELETE requires separate confirmation and preserves the current value', async () => {
  const e = await ready()
  const value = e.field.value
  await e.padDown(5, 100)
  await e.padUp(5, 1200)
  assert.equal(e.field.keys.length, 3)
  assert.ok(e.clearKeysBrowser)
  assert.equal(e.clearKeysPrompt, null)
  await e.pressPad(5)
  assert.ok(e.clearKeysPrompt)
  await e.padDown(5, 1400)
  await e.padUp(5, 1500)
  assert.equal(e.field.keys.length, 1)
  assert.equal(e.field.keys[0].value, value)
  assert.equal(e.field.sequenced, false)
  assert.equal(e.clearKeysPrompt, null)
})

test('CANCEL leaves every key untouched; changed layer cannot inherit confirmation', async () => {
  const e = await ready()
  await e.padDown(5, 0)
  await e.padUp(5, 1000)
  await e.pressPad(5)
  await e.pressPad(6)
  assert.equal(e.field.keys.length, 3)
  assert.equal(e.clearKeysPrompt, null)
  await e.padDown(5, 0)
  await e.padUp(5, 1000)
  e.requestClearKeys()
  e.select('layer', 1)
  await assert.rejects(e.confirmClearKeys(), /Selection changed/)
  assert.equal(e.snapshot.layers[0].fields[0].keys.length, 3)
})

test('clear browser includes resource animation, deletes only the chosen parameter and preserves other fields', async () => {
  const e = await ready()
  const resource = e.client.data.layers[0].mediaFields[0]
  Object.assign(resource, {
    sequenced: true,
    resourceUid: 'image-b',
    keys: [
      { time: 0, resourceUid: 'image-a' },
      { time: 5, resourceUid: 'image-b' },
    ],
  })
  await e.openClearKeys()
  assert.deepEqual(
    e.clearKeysBrowser.items.map((item) => item.name),
    ['brightness', 'video'],
  )
  e.browseClearKeys(1)
  e.requestClearKeys()
  assert.equal(e.clearKeysPrompt.label, 'Video')
  await e.confirmClearKeys()
  assert.equal(resource.sequenced, false)
  assert.equal(resource.keys.length, 1)
  assert.equal(resource.keys[0].resourceUid, 'image-b')
  assert.equal(e.field.keys.length, 3)
})

test('resource-only layers can open clear selection and an empty selection cannot delete', async () => {
  const e = await ready()
  e.client.data.layers[0].fields = []
  Object.assign(e.client.data.layers[0].mediaFields[0], {
    sequenced: true,
    resourceUid: null,
    keys: [
      { time: 0, resourceUid: null },
      { time: 1, resourceUid: 'a' },
    ],
  })
  await e.refresh()
  await e.padDown(5, 0)
  await e.padUp(5, 1200)
  assert.equal(e.clearKeysBrowser.items.length, 1)
  e.requestClearKeys()
  await e.confirmClearKeys()
  assert.equal(e.client.data.layers[0].mediaFields[0].keys[0].resourceUid, null)
})

test('a changed animation cancels deletion without affecting other parameters', async () => {
  const e = await ready()
  const speed = e.client.data.layers[0].fields[1]
  speed.sequenced = true
  await e.openClearKeys()
  e.browseClearKeys(1)
  e.requestClearKeys()
  speed.sequenced = false
  await assert.rejects(e.confirmClearKeys(), /animation changed/)
  assert.equal(e.client.data.layers[0].fields[0].keys.length, 3)
})

test('clear browser ignores dial presses and value edits until DELETE is pressed', async () => {
  const e = await ready()
  const { actions } = require('../src/definitions')
  const definitions = actions({ perform: (fn) => fn(e) })
  await e.openClearKeys()
  await definitions.fine.callback({ options: {} })
  assert.equal(e.clearKeysPrompt, null)
  await definitions.value.callback({ options: { direction: 1, step: 0 } })
  assert.equal(e.field.value, 0.5)
  await definitions.time_step.callback({ options: {} })
  assert.equal(e.clearKeysBrowser, null)
})

test('changed selection while holding DELETE cancels the gesture', async () => {
  const e = await ready()
  await e.padDown(5, 0)
  e.select('field', 1)
  await assert.rejects(e.padUp(5, 1100), /Selection changed/)
  assert.equal(e.clearKeysPrompt, undefined)
})

test('empty animation list cannot open a delete confirmation', async () => {
  const e = await ready()
  for (const field of e.client.data.layers[0].fields) {
    field.sequenced = false
    field.keys = field.keys.slice(0, 1)
  }
  await e.openClearKeys()
  await e.pressPad(5)
  assert.equal(e.clearKeysPrompt, null)
})

test('browsing another parameter cancels the pending single-parameter confirmation', async () => {
  const e = await ready()
  e.client.data.layers[0].fields[1].sequenced = true
  await e.openClearKeys()
  e.requestClearKeys()
  assert.deepEqual(e.clearKeysPrompt.fields, ['brightness'])
  e.browseClearKeys(1)
  assert.equal(e.clearKeysPrompt, null)
  e.requestClearKeys()
  assert.deepEqual(e.clearKeysPrompt.fields, ['speed'])
})

test('editing requires an explicit snapshot', () => {
  const e = new Editor(new DemoClient())
  assert.throws(() => e.adjustValue(1), /Refresh/)
})
test('encoder bursts accumulate without floating point drift or network calls', async () => {
  const e = await ready()
  e.client.execute = () => {
    throw new Error('Unexpected network write')
  }
  for (let i = 0; i < 100; i++) e.adjustValue(0.01)
  assert.equal(e.value, 1.5)
  assert.equal(e.dirty, true)
})
test('layer selection wraps but parameter selection stops at each end', async () => {
  const e = await ready()
  e.adjustValue(3)
  e.select('layer', -1)
  assert.equal(e.layer.name, 'Foreground')
  assert.equal(e.value, 1)
  assert.equal(e.dirty, false)
  e.select('layer', 1)
  e.select('field', -1)
  assert.equal(e.fieldIndex, 0)
  e.select('field', 1)
  assert.equal(e.field.name, 'speed')
  e.select('field', 1)
  assert.equal(e.field.name, 'speed')
  e.select('field', -1)
  assert.equal(e.fieldIndex, 0)
})
test('key navigation selects exact time and value, without moving Designer', async () => {
  const e = await ready()
  e.key(1)
  assert.equal(e.time, 5)
  assert.equal(e.value, 1)
  assert.equal(e.client.data.time, 0)
  await e.seek()
  assert.equal(e.client.data.time, 5)
  e.key(-1)
  assert.equal(e.time, 0)
  e.key(-1)
  assert.equal(e.time, 0)
})
test('key save updates at the same time rather than duplicating keys', async () => {
  const e = await ready()
  e.adjustValue(0.2)
  await e.write('key_set')
  assert.equal(e.field.keys.length, 3)
  assert.equal(e.field.keys[0].value, 0.7)
  e.adjustTime(2)
  await e.write('key_set')
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 2, 5, 10],
  )
})
test('constants cannot silently disable an animated sequence', async () => {
  const e = await ready()
  await assert.rejects(e.write('constant_set'), /Animated/)
  e.select('field', 1)
  e.adjustValue(1)
  await e.write('constant_set')
  assert.equal(e.field.keys[0].value, 2)
  assert.equal(e.field.sequenced, false)
})
test('deletion requires exact key and preserves the final value as a constant', async () => {
  const e = await ready()
  e.adjustTime(1)
  await assert.rejects(e.write('key_delete'), /exact keyframe/)
  e.key(1)
  await e.write('key_delete')
  assert.deepEqual(
    e.field.keys.map((k) => k.time),
    [0, 10],
  )
  e.select('layer', 1)
  e.time = 0
  const value = e.field.value
  await e.write('key_delete')
  assert.equal(e.field.sequenced, false)
  assert.equal(e.field.keys.length, 1)
  assert.equal(e.field.keys[0].value, value)
})
test('rejects non-finite input and clamps negative time', async () => {
  const e = await ready()
  assert.throws(() => e.adjustValue(NaN), /finite/)
  assert.throws(() => e.adjustTime(Infinity), /finite/)
  e.adjustTime(-50)
  assert.equal(e.time, 0)
})
test('failed writes retain staged edits and release busy state', async () => {
  const e = await ready()
  e.adjustValue(0.2)
  e.client.execute = async () => {
    throw new Error('Timeout')
  }
  await assert.rejects(e.write('key_set'), /Timeout/)
  assert.equal(e.value, 0.7)
  assert.equal(e.dirty, true)
  assert.equal(e.busy, false)
  assert.equal(e.field.keys[0].value, 0.5)
})
test('pending remote request cannot write into a different local selection', async () => {
  const e = await ready()
  let finish
  e.client.execute = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const pending = e.write('key_set')
  assert.throws(() => e.select('layer', 1), /in progress/)
  assert.throws(() => e.adjustValue(1), /in progress/)
  await assert.rejects(e.seek(), /in progress/)
  finish({ keys: [{ time: 0, value: 0.5 }], sequenced: true })
  await pending
  assert.equal(e.layer.name, 'Background')
})
test('malformed refresh does not discard the last valid snapshot', async () => {
  const e = await ready()
  e.client.execute = async () => ({})
  await assert.rejects(e.refresh(), /Invalid Designer snapshot/)
  assert.equal(e.layer.name, 'Background')
})

test('DELETE ALL + DEFAULT restores numeric and resource defaults only after confirmation', async () => {
  for (const value of [0, 1, null, 'default-mapping']) {
    const e = await ready()
    const resource = typeof value !== 'number'
    const layer = e.client.data.layers[0]
    const f = resource ? layer.mediaFields[0] : layer.fields[0]
    Object.assign(f, {
      sequenced: true,
      defaultValue: value,
      resourceUid: 'old-resource',
      keys: [
        { time: -10, value: 0.7 },
        { time: 200, value: 0.7 },
      ],
    })
    await e.refresh()
    await e.openClearKeys()
    e.clearKeysBrowser.index = e.clearKeysBrowser.items.findIndex((item) => item.name === f.name)
    await e.pressPad(6)
    assert.equal(e.clearKeysPrompt.resetDefault, true)
    assert.equal(f.keys.length, 2)
    await e.pressPad(6)
    assert.equal(f.keys.length, 2)
    await e.pressPad(6)
    await e.pressPad(5)
    assert.equal(f.sequenced, false)
    assert.equal(f.keys.length, 1)
    assert.equal(f.keys[0].time, layer.start)
    assert.equal(resource ? f.keys[0].resourceUid : f.keys[0].value, value)
  }
})

test('constant DEFAULT resets without confirmation but refuses newly animated fields', async () => {
  const e = await ready()
  const f = e.client.data.layers[0].fields[0]
  Object.assign(f, { sequenced: false, defaultValue: 1, value: 0.3, keys: [{ time: 30, value: 0.3 }] })
  await e.refresh()
  assert.equal(e.canResetDefault, true)
  await e.padDown(5, 0)
  await e.padUp(5, 100)
  assert.equal(f.value, 1)
  assert.equal(f.keys.length, 1)
  assert.equal(e.clearKeysPrompt, undefined)
  await e.padDown(5, 200)
  f.sequenced = true
  f.keys.push({ time: 50, value: 0 })
  await assert.rejects(e.padUp(5, 400), /animated/)
  assert.equal(f.keys.length, 2)
})

test('adding a key to a native constant-only parameter is an inert action', async () => {
  const e = await ready()
  e.field.canAnimate = false
  const before = structuredClone(e.field)
  e.client.execute = async () => {
    throw Error('Unexpected native request')
  }
  await e.pressValue()
  await e.writeLive('key_set')
  assert.deepEqual(e.field, before)
})

test('beat timing steps replace frame/second units and send beat deltas', async () => {
  const e = await ready()
  e.snapshot.beatMode = true
  const labels = []
  for (let i=0;i<10;i++) { labels.push(e.timeStepLabel); e.cycleTimeStep() }
  assert.deepEqual(labels,['1 BEAT','4 BEATS','1/96 BEAT','1/16 BEAT','1/12 BEAT','1/8 BEAT','1/6 BEAT','1/4 BEAT','1/3 BEAT','1/2 BEAT'])
  let request
  const original=e.client.execute.bind(e.client)
  e.client.execute=async (command,args)=>{ if(command==='nudge_time'){request=args;return {time:e.time}}return original(command,args) }
  await e.adjustLiveTime(1)
  assert.equal(request.beats,true)
  assert.equal(request.frames,false)
  assert.equal(request.delta,1)
  e.snapshot.beatMode=false
  assert.equal(e.timeStepLabel,'1 FRAME')
})

test('keyframe movement cycles fractional beats without unlocking selection', async () => {
  const e = await ready()
  e.snapshot.beatMode = true
  e.beatStep = 0.25
  assert.equal(e.timeStepLabel, '1/4 BEAT')
  e.moveKey = {time: 0, value: 0}
  assert.equal(e.usesBeatSteps, true)
  const labels = []
  for (let i=0; i<10; i++) { labels.push(e.timeStepLabel); e.cycleTimeStep() }
  assert.deepEqual(labels, ['1/96 BEAT','1/16 BEAT','1/12 BEAT','1/8 BEAT','1/6 BEAT','1/4 BEAT','1/3 BEAT','1/2 BEAT','1 BEAT','4 BEATS'])
  assert.ok(e.moveKey)
  assert.equal(e.timeStepAmount, 1/96)
  e.moveKey = null
  e.layerEdit = 'in'
  assert.equal(e.timeStepLabel, '1/4 BEAT')
  assert.equal(e.timeStepAmount, 0.25)
})

test('layer encoder presses cycle only the requested beat steps', async () => {
 const e=await ready();e.snapshot.beatMode=true;e.layerEdit='edit';const seen=[];
 for(let i=0;i<10;i++){seen.push(e.timeStepLabel);e.cycleLayerStep()}
 assert.deepEqual(seen,['1/4 BEAT','1/3 BEAT','1/2 BEAT','1 BEAT','4 BEATS','1/96 BEAT','1/16 BEAT','1/12 BEAT','1/8 BEAT','1/6 BEAT']);assert.equal(e.timeStepLabel,'1/4 BEAT');
})
