'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ViewerServer } = require('../src/viewer-server')
const { actions } = require('../src/definitions')

test('first dial zoom requires a live viewer and preserves editing-mode routing', async () => {
  const viewer = new ViewerServer({}, () => ({}))
  const calls = []
  const editor = {
    selectLive: async () => calls.push('layer'),
    adjustLayerTiming: async () => calls.push('in'),
    cycleLayerStep: () => calls.push('step'),
    selectMediaField: async () => calls.push('resource'),
    toggleMediaKeyframe: () => calls.push('resource-mode'),
  }
  const a = actions({ viewer, perform: fn => fn(editor) })
  const press = () => a.layer_press.callback({ options: {} })
  const turn = () => a.layer.callback({ options: { direction: 1 } })
  await press(); assert.equal(viewer.zoomMode, false)
  viewer.lastViewerRead = Date.now()
  await press(); await turn()
  assert.equal(viewer.zoomSteps, 1); assert.deepEqual(calls, [])
  viewer.rotateZoom(12)
  assert.equal(viewer.zoomSteps, 13)
  viewer.rotateZoom(-100)
  assert.equal(viewer.zoomSteps, -51)
  await press(); await turn(); assert.deepEqual(calls, ['layer'])
  await press(); editor.layerEdit = 'edit'; await press(); await turn()
  assert.deepEqual(calls.slice(-2), ['step', 'in'])
  editor.layerEdit = null; editor.mediaMode = true; await press(); await turn()
  assert.deepEqual(calls.slice(-2), ['resource-mode', 'resource'])
  editor.mediaMode = false; editor.moveKey = {}; await press(); await turn()
  assert.equal(viewer.zoomSteps, -51)
  editor.moveKey = null; viewer.lastViewerRead = Date.now() - 4000
  await turn(); assert.equal(viewer.zoomMode, false); assert.equal(calls.at(-1), 'layer')
  viewer.closed = true; viewer.lastViewerRead = Date.now()
  await press(); assert.equal(viewer.zoomMode, false)
})

test('dedicated CC1 zoom dial works without changing first-dial routing mode', async()=>{
 const viewer=new ViewerServer({},()=>({}))
 const instance={viewer,publish(){},perform(){throw Error('Designer queue must not be used')}}
 const zoom=actions(instance).viewer_zoom
 await zoom.callback({options:{direction:1}})
 assert.equal(viewer.zoomSteps,0)
 viewer.lastViewerRead=Date.now()
 await zoom.callback({options:{direction:1}})
 await zoom.callback({options:{direction:-1}})
 assert.equal(viewer.zoomSteps,0)
 assert.equal(viewer.zoomMode,false)
})
