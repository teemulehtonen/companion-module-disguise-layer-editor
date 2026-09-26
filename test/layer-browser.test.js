'use strict'
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { Editor } = require('../src/editor'),
  { DemoClient } = require('../src/demo')
const { actions } = require('../src/definitions'),
  { DisguiseLayerControl } = require('../src/main')
async function setup(count = 25) {
  const client = new DemoClient(),
    base = client.data.layers[0]
  client.data.layers = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(base),
    uid: 'layer' + i,
    name: 'Layer ' + i,
    start: 0,
    end: 100,
  }))
  const e = new Editor(client)
  await e.refresh()
  const calls = [],
    execute = client.execute.bind(client)
  client.execute = async (op, args) => {
    calls.push(op)
    const result = await execute(op, args)
    // Native read_field evaluates at the independent edit time when unlinked.
    // DemoClient's generic result reports playback time; match the native contract.
    if (op === 'read_field' && args.live === false) result.time = args.time
    return result
  }
  const host = Object.create(DisguiseLayerControl.prototype)
  Object.assign(host, {
    editor: e,
    config: {},
    variables: {},
    setVariableValues(v) {
      Object.assign(this.variables, v)
    },
    checkFeedbacks() {},
    loadThumbnails() {},
    perform(fn) {
      return fn(e)
    },
  })
  return { e, client, calls, host, a: actions(host), execute }
}
test('layer display opens twelve active layers on the selected page; layer dial pages without batching', async () => {
  const { e, a, calls, host } = await setup()
  e.layerIndex = 14
  host.performDetents = () => assert.fail('List paging must not batch as layer edits')
  await a.layer_press.callback({ options: {} })
  assert.equal(e.layerBrowser.page, 1)
  await a.layer.callback({ options: { direction: 1 } })
  assert.equal(e.layerBrowser.page, 2)
  await a.layer.callback({ options: { direction: 1 } })
  assert.equal(e.layerBrowser.page, 2)
  for (let i = 0; i < 4; i++) await a.layer.callback({ options: { direction: -1 } })
  assert.equal(e.layerBrowser.page, 0)
  assert.deepEqual(calls, [])
  e.toggleLayerBrowser()
  assert.equal(e.layerBrowser, null)
})
test('all twelve buttons choose the displayed layer in LIVE and VIEW without writing or seeking', async () => {
  for (const viewOnly of [false, true])
    for (let slot = 0; slot < 12; slot++) {
      const { e, a, calls } = await setup()
      e.client.viewOnly = viewOnly
      if (viewOnly) e.setLinkTime(false)
      e.toggleLayerBrowser()
      e.pageLayers(1)
      if (slot < 8) {
        await a.pad_down.callback({ options: { slot } })
        await a.pad_up.callback({ options: { slot } })
      } else
        await a[['layer_press', 'parameter_press', 'value_press', 'time_step'][slot - 8]].callback({
          options: {},
        })
      assert.equal(e.layer.uid, 'layer' + (12 + slot))
      assert.equal(e.layerBrowser, null)
      assert.equal(e.deletePress, null)
      assert.deepEqual(calls, ['live_state', 'read_field'])
      assert.equal(e.time, 0)
      assert.equal(e.client.data.time, 0)
    }
})
test('layer list labels survive field/clock feedback, highlight selection and leave empty slots inert', async () => {
  const { e, host, a, calls } = await setup()
  e.toggleLayerBrowser()
  host.publish()
  for (let i = 0; i < 8; i++) assert.equal(host.variables['pad_' + i], 'LAYER ' + i)
  for (let i = 0; i < 4; i++) assert.equal(host.variables['dial_value_' + i], 'LAYER ' + (i + 8))
  assert.equal(host.variables.ui_mode, 'LAYER_LIST')
  assert.equal(host.variables.parameter_animated, false)
  assert.notEqual(host.variables.pad_color_0, host.variables.pad_color_1)
  host.publishField()
  host.publishClock()
  assert.equal(host.variables.dial_value_2, 'LAYER 10')
  assert.equal(host.variables.dial_value_3, 'LAYER 11')
  e.pageLayers(1)
  e.pageLayers(1)
  host.publish()
  assert.equal(host.variables.pad_0, 'LAYER 24')
  assert.equal(host.variables.pad_1, '')
  assert.equal(host.variables.dial_value_3, '')
  assert.equal(host.variables.dial_title_0, 'LAYERS 3/3')
  await a.pad_down.callback({ options: { slot: 5 } })
  await a.pad_up.callback({ options: { slot: 5 } })
  await a.time_step.callback({ options: {} })
  assert.equal(e.layerBrowser.page, 2)
  assert.deepEqual(calls, [])
  await a.pad_down.callback({ options: { slot: 0 } })
  host.publish()
  assert.equal(host.variables.ui_mode, 'PARAMS')
  assert.equal(e.layer.uid, 'layer24')
})
test('list excludes inactive layers, honors unlinked edit time and preserves exact OUT', async () => {
  const { e, client, calls } = await setup(3)
  client.data.layers[0].start = 10
  client.data.layers[0].end = 20
  client.data.layers[1].end = 0
  await e.refresh()
  e.toggleLayerBrowser()
  assert.deepEqual(
    e.activeLayers.map((l) => l.uid),
    ['layer1', 'layer2'],
  )
  await e.selectLayerSlot(0)
  assert.equal(e.layer.uid, 'layer1')
  e.setLinkTime(false)
  e.time = 20
  await e.refresh({ preserve: true })
  e.receiveTransportTime(70)
  e.toggleLayerBrowser()
  assert.deepEqual(
    e.activeLayers.map((l) => l.uid),
    ['layer0', 'layer2'],
  )
  await e.selectLayerSlot(0)
  assert.equal(e.layer.uid, 'layer0')
  assert.equal(e.time, 20)
  assert.ok(calls.every((c) => ['refresh', 'live_state', 'read_field'].includes(c)))
})
test('changed track, transport, layer order or active membership cancels a stale slot', async () => {
  for (const change of [
    (e) => (e.snapshot.trackUid = 'other'),
    (e) => (e.snapshot.transportUid = 'other'),
    (e) => e.snapshot.layers.reverse(),
    (e) => (e.snapshot.layers[1].start = 10),
    (e) => (e.stale = true),
  ]) {
    const { e, calls } = await setup()
    e.toggleLayerBrowser()
    change(e)
    await e.selectLayerSlot(5)
    assert.equal(e.layerBrowser, null)
    assert.deepEqual(calls, [])
  }
  const { e } = await setup(0)
  e.toggleLayerBrowser()
  assert.ok(!e.layerBrowser)
})
test('fresh feedback rejects a reordered or disappearing list before reading a chosen field', async () => {
  for (const change of [
    (c) => c.data.layers.reverse(),
    (c) => c.data.layers.splice(5, 1),
    (c) => (c.data.layers[5].start = 10),
  ]) {
    const { e, client, calls } = await setup()
    e.toggleLayerBrowser()
    change(client)
    await e.selectLayerSlot(5)
    assert.equal(e.layerBrowser, null)
    assert.deepEqual(calls, ['live_state'])
    assert.notEqual(e.layer?.uid, 'layer5')
  }
})
test('context change during the fresh read never selects an old slot', async () => {
  const { e, client, calls } = await setup()
  e.toggleLayerBrowser()
  client.execute = async (op) => {
    calls.push(op)
    return { contextChanged: true, contextAvailable: true, transportUid: 'other', trackUid: 'other' }
  }
  await e.selectLayerSlot(5)
  assert.equal(e.layerBrowser, null)
  assert.equal(e.contextStale, true)
  assert.deepEqual(calls, ['live_state'])
  assert.notEqual(e.layer.uid, 'layer5')
})
test('list blocks unrelated edits and preserves media/timing presses outside the list', async () => {
  const { e, a, calls } = await setup()
  e.toggleLayerBrowser()
  const before = [e.time, e.value, e.precision, e.layer.uid]
  for (const id of [
    'field',
    'value',
    'time',
    'key_set',
    'key_delete',
    'fine',
    'media',
    'layer_edit',
    'viewer_zoom',
  ])
    await a[id].callback({ options: { direction: 1, step: 1 } })
  assert.deepEqual([e.time, e.value, e.precision, e.layer.uid], before)
  assert.deepEqual(calls, [])
  e.toggleLayerBrowser()
  e.layerEdit = 'edit'
  const step = e.timeStep
  await a.layer_press.callback({ options: {} })
  assert.notEqual(e.timeStep, step)
  assert.ok(!e.layerBrowser)
  e.layerEdit = ''
  e.mediaMode = true
  let toggled = 0
  e.toggleMediaKeyframe = () => toggled++
  await a.layer_press.callback({ options: {} })
  assert.equal(toggled, 1)
  assert.ok(!e.layerBrowser)
  e.mediaMode = false
  e.toggleLayerBrowser()
  e.toggleParameterBrowser()
  assert.equal(e.layerBrowser, null)
  assert.ok(e.parameterBrowser)
})
test('custom layer slot action is inert outside list, uses one-based slots and restores parameter selection', async () => {
  const { e, a, calls } = await setup()
  await a.layer_slot.callback({ options: { slot: 3 } })
  assert.deepEqual(calls, [])
  e.toggleLayerBrowser()
  await a.layer_slot.callback({ options: { slot: 3 } })
  assert.equal(e.layer.uid, 'layer2')
  assert.equal(e.fieldIndex, 0)
  await a.parameter_press.callback({ options: {} })
  assert.ok(e.parameterBrowser)
})
