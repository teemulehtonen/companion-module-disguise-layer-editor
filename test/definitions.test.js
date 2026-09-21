'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { actions, presets } = require('../src/definitions')
const { DisguiseLayerControl } = require('../src/main')
const { validateManifest } = require('@companion-module/base/manifest')

test('every button/dial preset references an implemented action and required options', () => {
  const definitions = actions({ perform() {} })
  const [sections, p] = presets()
  assert.equal(sections[0].definitions.length, 4)
  for (const preset of Object.values(p)) {
    assert.equal(preset.type, 'simple')
    for (const step of preset.steps) {
      for (const entries of Object.values(step)) {
        for (const entry of entries) {
          const action = definitions[entry.actionId]
          assert.ok(action, entry.actionId)
          for (const option of action.options) assert.notEqual(entry.options[option.id], undefined)
        }
      }
    }
  }
})
test('Companion lifecycle supports demo load, action execution and shutdown', async () => {
  const instance = Object.create(DisguiseLayerControl.prototype)
  Object.defineProperty(instance, 'label', { value: 'designer-test' })
  const state = {}
  for (const method of [
    'setVariableDefinitions',
    'setFeedbackDefinitions',
    'setPresetDefinitions',
    'updateStatus',
    'checkFeedbacks',
    'log',
  ])
    instance[method] = () => {}
  instance.setVariableValues = (values) => Object.assign(state, values)
  instance.setActionDefinitions = (definitions) => {
    instance.actions = definitions
  }
  await instance.init({ demo: true })
  await instance.actions.refresh.callback({ options: {} })
  assert.equal(state.layer, 'Background')
  assert.equal(state.dial_value_0, 'BACKGROUND')
  assert.equal(state.dial_value_1, state.parameter.toUpperCase())
  assert.equal(state.parameter_animated, true)
  assert.equal(state.timing_step_0, '1 FRAME')
  assert.equal(state.timing_step_9, '5 MIN')
  await instance.actions.time_step_set.callback({ options: { slot: 3 } })
  assert.equal(instance.editor.timeStep, 'two')
  instance.editor.snapshot.beatMode = true
  instance.publish()
  assert.equal(state.timing_step_0, '1/96 BEAT')
  assert.equal(state.timing_step_9, '4 BEATS')
  await instance.actions.time_step_set.callback({ options: { slot: 3 } })
  assert.equal(instance.editor.beatStep, 1 / 8)
  instance.editor.snapshot.beatMode = false
  Object.assign(instance.editor.field, { min: 0, max: 1.000000047 })
  instance.publish()
  assert.equal(state.dial_info_1, '0–1')
  assert.match(state.dial_info_0, /^IN /)
  assert.equal(state.pad_5, 'DELETE\nKEYFRAME')
  await instance.actions.pad.callback({ options: { slot: 3 } })
  assert.equal(instance.editor.linkTime, false)
  assert.equal(state.pad_3, 'LINK\nTIME')
  await instance.actions.pad.callback({ options: { slot: 3 } })
  assert.equal(instance.editor.linkTime, true)
  assert.equal(state.pad_3, 'LINK\nTIME')
  await instance.actions.value.callback({ options: { direction: 1, step: 0.1 } })
  assert.equal(state.value, 0.6)
  await instance.actions.key_set.callback({ options: {} })
  assert.equal(state.dirty, false)
  instance.connection = { connected: true, watch() {}, close() {} }
  instance.editor.client.data.layers[0].end = 2
  instance.editor.client.data.time = 3
  instance.editor.stale = true
  await instance.actions.time.callback({ options: { direction: 1, step: 1 } })
  assert.equal(state.time, 4)
  assert.equal(state.last_error, '')
  instance.editor.client.data.layers = []
  instance.editor.stale = true
  await instance.actions.value.callback({ options: { direction: 1, step: 0.1 } })
  assert.equal(state.last_error, '')
  assert.equal(instance.editor.layer, undefined)
  await instance.destroy()
  assert.equal(instance.editor, null)
})
test('manifest is accepted by Companion module API', () => {
  validateManifest(require('../companion/manifest.json'))
})

test('display presets use the connection label and resolve live values', () => {
  const [, definitions] = presets('designer-local')
  const values = {
    layer: 'Video 2',
    parameter: 'brightness',
    value: 0.75,
    value_label: '0.75',
    time: 17,
    step_mode: 'FINE',
    connection_status: 'HTTP + LIVE',
    live_time: 18,
    live_timecode: '00:00:18:00',
  }
  const render = (text) => text.replace(/\$\(designer-local:([^)]*)\)/g, (_, id) => String(values[id]))
  assert.equal(render(definitions.dial_layer.style.text), 'LAYER\nVideo 2')
  assert.equal(render(definitions.dial_value.style.text), 'VALUE\n0.75')
  assert.equal(render(definitions.connection.style.text), 'HTTP + LIVE\n00:00:18:00')
  for (const preset of Object.values(definitions)) assert.ok(!preset.style.text.includes('$(this:'))
  assert.equal(presets('renamed')[1].fine.style.text, '$(renamed:step_mode)')
})

test('metadata refresh keeps a healthy connection OK without hiding real faults', () => {
  const { InstanceStatus } = require('../src/companion-api')
  const instance = Object.create(DisguiseLayerControl.prototype)
  instance.config = {}
  instance.connection = { connected: true }
  instance.editor = { stale: true, snapshot: { trackUid: '1' } }
  let actual
  instance.updateStatus = (status) => {
    actual = status
  }
  instance.connectionStatus()
  assert.equal(actual, InstanceStatus.Ok)
  instance.lastError = 'Native write failed'
  instance.connectionStatus()
  assert.equal(actual, InstanceStatus.UnknownError)
  instance.lastError = ''
  instance.connection.connected = false
  instance.connectionStatus()
  assert.equal(actual, InstanceStatus.ConnectionFailure)
})

test('all shipped presets are reachable from a preset group', () => {
  const [groups, definitions] = presets()
  const ids = new Set(groups.flatMap((group) => group.definitions))
  assert.deepEqual([...ids].sort(), Object.keys(definitions).sort())
})

test('friendly layer types use Add Layer names and keep unknown types readable', () => {
  const { layerTypeLabel } = require('../src/layer-types')
  assert.equal(layerTypeLabel('VariableVideoModule'), 'Video')
  assert.equal(layerTypeLabel('VideoModule'), 'Legacy Video')
  assert.equal(layerTypeLabel('TwoPoint5DModule'), '2.5D')
  assert.equal(layerTypeLabel('ColourAdjustModule'), 'Colour Adjust')
  assert.equal(layerTypeLabel('FutureEffectModule'), 'Future Effect')
  assert.equal(layerTypeLabel(), '')
})
