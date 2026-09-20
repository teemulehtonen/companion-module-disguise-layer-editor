'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Editor } = require('../src/editor')
const { DemoClient } = require('../src/demo')

test('NEXT reaches exact OUT and repeated navigation never steps back one frame', async () => {
  for (const fps of [25, 30, 30000 / 1001, 60000 / 1001]) {
    for (const withKeys of [false, true]) {
      const client = new DemoClient(), editor = new Editor(client)
      client.data.fps = fps
      const layer = client.data.layers[0], field = layer.fields[0]
      field.sequenced = withKeys
      field.keys = withKeys ? [{ time: layer.end, value: 1, type: 'linear' }] : []
      await editor.refresh()
      const target = { ...editor.liveArgs(), direction: 1 }
      for (let n = 0; n < 3; n++) {
        const result = await client.execute('jump_key', target)
        assert.equal(result.time, layer.end)
        assert.equal(result.keyTime, withKeys ? layer.end : null)
        target.navigationTime = result.time
      }
      editor.time = layer.end
      editor.key(1)
      assert.equal(editor.time, layer.end)
      assert.equal(editor.layer.uid, layer.uid)
    }
  }
})
