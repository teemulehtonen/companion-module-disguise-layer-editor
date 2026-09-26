import assert from 'node:assert/strict'
import ModuleClass, { UpgradeScripts } from '../pkg/disguise-layer-control/main.js'

// Exercise the actual bundled ESM export with the Companion v2 host context.
assert.equal(typeof ModuleClass, 'function', 'Companion requires a default constructor export')
assert.ok(Array.isArray(UpgradeScripts))
const values = {}
const oscMessages = []
let actions, presets, feedbacks, savedConfig
const context = {
  _isInstanceContext: true,
  id: 'package-test',
  label: 'package-test',
  upgradeScripts: [],
  sharedUdpSocketHandlers: new Map(),
  oscSend(...args) { oscMessages.push(args) },
  saveConfig(config) { savedConfig = {...config} },
  updateStatus() {},
  checkFeedbacks() {},
  setVariableDefinitions() {},
  setVariableValues(v) {
    Object.assign(values, v)
  },
  setActionDefinitions(a) {
    actions = a
  },
  setFeedbackDefinitions(definitions) { feedbacks = definitions },
  setPresetDefinitions(structure, definitions) {
    presets = { structure, definitions }
  },
}
const instance = new ModuleClass(context)
await instance.init({ demo: true, viewerEnabled: true, viewerLan: true, viewerEditEnabled: true })
assert.equal(instance.viewer, undefined)
assert.ok(!instance.getConfigFields().some(field => /^(viewer|resource)/.test(field.id)))
assert.equal(values.viewer_status, undefined)
assert.equal(values.navigation_mode, 'SECTION')
assert.equal(feedbacks.navigation_track.callback(), false)
await actions.navigation_toggle.callback({ options: {} })
assert.equal(values.navigation_mode, 'TRACK')
assert.equal(feedbacks.navigation_track.callback(), true)
assert.equal(savedConfig.trackNavigation, true)
await instance.configUpdated({...savedConfig})
assert.equal(values.navigation_mode, 'TRACK', 'Navigation mode survives configuration reload')
await actions.navigation_toggle.callback({ options: {} })
assert.equal(values.navigation_mode, 'SECTION')
assert.equal(feedbacks.navigation_track.callback(), false)
assert.equal(presets.definitions.navigation_next.steps[0].down[0].actionId, 'internal:logicIf')
assert.deepEqual(presets.definitions.navigation_next.steps[0].down[0].children.elseActions, [{actionId:'transport',options:{operation:'gotonextsection'}}])
await instance.configUpdated({...instance.config, oscHost:'127.0.0.1', oscPort:9000})
await actions.transport_master_select_slot.callback({options:{slot:9}})
await actions.transport_master_level.callback({options:{level:23.4}})
assert.deepEqual(oscMessages,[['127.0.0.1',9000,'/vehka/fader1',[{type:'f',value:0.234}]]])
await instance.configUpdated({...instance.config})
assert.equal(values.transport_master_level,23.4,'Motor target restores saved OSC value after reload')
assert.equal(values.osc_fader_1,0.234)
assert.equal(oscMessages.length,1,'Configuration reload must not send OSC')
assert.equal(savedConfig.oscFaderValues[0],0.234)
await actions.refresh.callback({ options: {} })
assert.equal(values.layer, 'Background')
await actions.layer_press.callback({options:{}})
assert.equal(values.ui_mode,'LAYER_LIST')
assert.equal(values.pad_0,'BACKGROUND')
await actions.layer_slot.callback({options:{slot:1}})
assert.equal(values.ui_mode,'PARAMS')
assert.equal(values.layer,'Background')
assert.equal(presets.structure[0].definitions.length, 4)
await actions.value.callback({ options: { direction: 1, step: 0.1 } })
await actions.key_set.callback({ options: {} })
assert.equal(values.value, 0.6)
assert.equal(values.dirty, false)
assert.equal(values.last_error, '')
assert.ok(presets.definitions.fader_mode || presets.fader_mode || presets.structure.some(group=>group.definitions.includes('fader_mode')))
await actions.fader_mode_toggle.callback({options:{}})
assert.equal(values.fader_mode,'PARAMETER')
assert.equal(feedbacks.fader_parameter.callback(),true)
assert.equal(feedbacks.fader_parameter.defaultStyle.bgcolor,0xc00000)
assert.deepEqual(presets.definitions.fader_mode.feedbacks,[{feedbackId:'fader_parameter',options:{},style:{bgcolor:0xc00000}}])
assert.equal(values.master_transport,'OSC FADER 1')
assert.equal(values.fader_value_label,'23.4%')
await actions.fader_mode_toggle.callback({options:{}})
assert.equal(values.fader_mode,'MASTER')
assert.equal(feedbacks.fader_parameter.callback(),false)
assert.equal(values.transport_master_level,23.4)

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
