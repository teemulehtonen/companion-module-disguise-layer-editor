import assert from 'node:assert/strict'
import ModuleClass, { UpgradeScripts } from '../pkg/disguise-layer-control/main.js'

// Exercise the actual bundled ESM export with the Companion v2 host context.
assert.equal(typeof ModuleClass, 'function', 'Companion requires a default constructor export')
assert.ok(Array.isArray(UpgradeScripts))
const values = {}
let actions, presets
const context = {
  _isInstanceContext: true,
  id: 'package-test',
  label: 'package-test',
  upgradeScripts: [],
  sharedUdpSocketHandlers: new Map(),
  saveConfig() {},
  updateStatus() {},
  checkFeedbacks() {},
  setVariableDefinitions() {},
  setVariableValues(v) {
    Object.assign(values, v)
  },
  setActionDefinitions(a) {
    actions = a
  },
  setFeedbackDefinitions() {},
  setPresetDefinitions(structure, definitions) {
    presets = { structure, definitions }
  },
}
const instance = new ModuleClass(context)
await instance.init({ demo: true })
await actions.refresh.callback({ options: {} })
assert.equal(values.layer, 'Background')
assert.equal(presets.structure[0].definitions.length, 4)
await actions.value.callback({ options: { direction: 1, step: 0.1 } })
await actions.key_set.callback({ options: {} })
assert.equal(values.value, 0.6)
assert.equal(values.dirty, false)
assert.equal(values.last_error, '')
await actions.pad_down.callback({ options: { slot: 5 } })
assert.equal(values.delete_hint, 'LONG PRESS\nDELETE ALL')
assert.equal(values.delete_ready, false)
await new Promise(resolve => setTimeout(resolve, 1050))
assert.equal(values.delete_hint, 'LONG PRESS\nDELETE ALL')
assert.equal(values.delete_ready, true)
assert.equal(values.pad_color_5, 0xb02028)
assert.equal(instance.editor.field.keys.length, 3, 'Hold indicator must not delete keys')
await actions.pad_up.callback({ options: { slot: 5 } })
assert.equal(values.delete_ready, false)
assert.equal(values.pad_color_7, 0, 'Delete browser BACK is black')
instance.editor.closeClearKeys()
await instance.perform(e => e.openClearKeys())
assert.equal(values.ui_mode, 'CLEAR_KEYS')
assert.match(values.dial_title_1, /PARAMETER/)
await actions.fine.callback({ options: {} })
assert.equal(values.dial_value_2, '3')
assert.equal(values.pad_4, 'DEFAULT ALL\nPARAMETERS')
assert.equal(values.pad_5, 'DELETE\nALL')
assert.equal(values.pad_6, 'DELETE ALL\n+ DEFAULT')
await actions.pad.callback({ options: { slot: 5 } })
assert.equal(values.pad_0, 'ARE YOU\nSURE?')
await actions.pad.callback({ options: { slot: 6 } })
assert.equal(values.ui_mode, 'CLEAR_KEYS')
await actions.time_step.callback({ options: {} })
assert.equal(values.ui_mode, 'PARAMS')
instance.editor.timecodeSamples = [
  {seconds: 0, label: '05:00:00.00'},
  {seconds: 60, label: '05:01:00.00'},
  {seconds: 120, label: '05:02:00.00'},
]
instance.publish()
assert.equal(values.timecode, '05:00:00:00')
assert.equal(values.dial_info_0, 'IN 05:00:00:00\nOUT 05:02:00:00')
instance.editor.layerEdit = 'edit'
instance.publish()
assert.equal(values.dial_value_1, '05:01:00:00')
assert.equal(values.dial_value_3, '00:02:00:00') // FIT length remains a duration.
await instance.destroy()
console.log('Packaged module: constructor, presets, keyframe write and clear-selection UI OK.')
