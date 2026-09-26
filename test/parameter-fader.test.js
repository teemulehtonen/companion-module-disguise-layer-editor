'use strict'
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { spawnSync } = require('node:child_process')
const {
  parameterFaderValue,
  parameterFaderPercent,
  supportsParameterFader,
  pythonParameterFader,
} = require('../src/parameter-fader')
const { Editor } = require('../src/editor'),
  { DemoClient } = require('../src/demo'),
  { DisguiseLayerControl } = require('../src/main'),
  { actions, presets } = require('../src/definitions')
async function ready() {
  const client = new DemoClient()
  Object.assign(client.data.layers[0].fields[0], {
    min: -180,
    max: 180,
    value: 0,
    sequenced: false,
    keys: [{ time: 0, value: 0 }],
  })
  const editor = new Editor(client)
  await editor.refresh()
  return editor
}
function host(editor) {
  const h = Object.create(DisguiseLayerControl.prototype)
  Object.assign(h, {
    editor,
    client: editor.client,
    config: {},
    parameterFaderMode: true,
    faderModeGeneration: 0,
    queueGeneration: 0,
    actionTail: Promise.resolve(),
    masterTransports: [{ uid: 'm', name: 'LIVE', brightness: 0.25, volume: 0.25 }],
    masterTransportUid: 'm',
    saveConfig() {},
    publishMaster() {},
    performNow: async (fn) => fn(h.editor),
  })
  return h
}
test('parameter fader maps full signed, offset and fractional ranges in both directions', () => {
  for (const [min, max] of [
    [-180, 180],
    [100, 200],
    [0, 0.01],
    [-0.005, 0.005],
  ])
    for (const percent of [0, 25, 50, 100]) {
      const f = { min, max },
        value = parameterFaderValue(f, percent)
      assert.ok(Math.abs(value - (min + ((max - min) * percent) / 100)) < 1e-10)
      assert.ok(Math.abs(parameterFaderPercent(f, value) - percent) < 1e-8)
    }
  assert.equal(parameterFaderValue({ min: 0, max: 10, integer: true }, 26), 3)
  for (const f of [
    {},
    { min: 0, max: 0 },
    { min: null, max: 1 },
    { min: 0, max: Infinity },
    { min: 0, max: 1, resource: true },
    { min: 0, max: 1, choices: [{ value: 0 }] },
  ])
    assert.equal(supportsParameterFader(f), false)
  for (const p of [-1, 101, NaN, Infinity]) assert.throws(() => parameterFaderValue({ min: 0, max: 1 }, p))
})
test('native fader mapping validates changed bounds and discrete fields before writes', () => {
  const python = ['python3', 'python'].find(
    (p) => spawnSync(p, ['--version'], { encoding: 'utf8' }).status === 0,
  )
  assert.ok(python)
  const fixture =
    'import math\n' +
    pythonParameterFader +
    `
meta = {'min': -180, 'max': 180}
for percent, expected in [(0,-180),(50,0),(100,180)]:
    assert parameter_fader_value(meta,percent,[-180,180,False]) == expected
assert parameter_fader_value({'min':0,'max':10,'integer':True},26,[0,10,True]) == 3
for field, percent, expected_range in [(meta,50,[0,360,False]),(meta,float('nan'),[-180,180,False]),({'min':0,'max':1,'choices':[1]},50,[0,1,False])]:
    try:
        parameter_fader_value(field,percent,expected_range)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid fader request accepted')
`
  const run = spawnSync(python, ['-c', fixture], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr)
})
test('fader edits constants and only selected keys through the shared editor command', async () => {
  const e = await ready()
  await e.setFaderValue(100)
  assert.equal(e.value, 180)
  await e.setFaderValue(0)
  assert.equal(e.value, -180)
  const f = e.client.data.layers[0].fields[0]
  Object.assign(f, {
    sequenced: true,
    keys: [
      { time: 0, value: 0 },
      { time: 5, value: 30 },
    ],
  })
  await e.refresh()
  await e.setFaderValue(75)
  assert.equal(e.value, 90)
  assert.equal(f.keys[1].value, 30)
  const original = e.client.execute.bind(e.client)
  let args
  e.client.execute = async (c, a) => {
    if (c === 'adjust_value') args = a
    return original(c, a)
  }
  e.setLinkTime(false)
  await e.setFaderValue(50)
  assert.equal(args.keepPlayhead, true)
  assert.equal(args.live, false)
  e.client.viewOnly = true
  await e.setFaderValue(100)
  assert.equal(e.value, 0)
})
test('fader modes preserve the master target and publish normalized motor position while retaining the master display', async () => {
  const e = await ready(),
    h = host(e)
  let v = h.masterVariableValues()
  assert.equal(v.fader_mode, 'PARAMETER')
  assert.equal(v.transport_master_level, 50)
  assert.equal(v.fader_value_label, '25%')
  assert.equal(v.master_transport, 'LIVE')
  h.toggleParameterFader()
  v = h.masterVariableValues()
  assert.equal(v.fader_mode, 'MASTER')
  assert.equal(v.master_transport, 'LIVE')
  assert.equal(v.transport_master_level, 25)
  assert.equal(v.fader_value_label, '25%')
  assert.equal(h.masterTransportUid, 'm')
  assert.equal(h.config.parameterFaderMode, false)
  h.toggleParameterFader()
  await h.setTransportMasterLevel(75)
  assert.equal(e.value, 90)
})
test('rapid fader movement coalesces to the latest trailing value', async () => {
  const e = await ready(),
    h = host(e),
    seen = []
  let release
  h.perform(() => new Promise((r) => (release = r)))
  await Promise.resolve()
  e.setFaderValue = async (p) => seen.push(p)
  const pending = h.setTransportMasterLevel(1)
  for (let p = 2; p <= 100; p++) h.setTransportMasterLevel(p)
  release()
  await pending
  assert.deepEqual(seen, [1, 100])
})
test('queued fader writes cannot jump to another parameter, mode, edit time or track', async () => {
  for (const change of [
    (h) => (h.editor.fieldIndex = 1),
    (h) => h.toggleParameterFader(),
    (h) => h.editor.setLinkTime(false),
    (h) => (h.editor.snapshot.trackUid = 'other'),
    (h) => (h.editor.parameterBrowser = {}),
    (h) => (h.editor.client.viewOnly = true),
  ]) {
    const e = await ready(),
      h = host(e)
    let calls = 0,
      release
    e.setFaderValue = async () => calls++
    h.perform(() => new Promise((r) => (release = r)))
    await Promise.resolve()
    const p = h.setTransportMasterLevel(99)
    change(h)
    release()
    await p
    assert.equal(calls, 0)
  }
})
test('fader preset is additive and invokes only the new mode toggle', () => {
  let toggles = 0
  actions({ toggleParameterFader: () => toggles++ }).fader_mode_toggle.callback()
  assert.equal(toggles, 1)
  const [, p] = presets()
  assert.equal(p.fader_mode.steps[0].down[0].actionId, 'fader_mode_toggle')
  assert.match(p.fader_mode.style.text, /fader_mode/)
  assert.deepEqual(p.fader_mode.feedbacks, [
    { feedbackId: 'fader_parameter', options: {}, style: { bgcolor: 0xc00000 } },
  ])
})
