'use strict'
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { cleanContextStyle } = require('../scripts/cc1-context-button.cjs')
const template = require('../templates/yamaha-cc1-page8.json')
test('parameter mode paints only the normal fader display red and keeps the master readout', () => {
  const style = cleanContextStyle(template.controls[0][2].style),
    box = style.layers.find((l) => l.id === 'box0')
  const evaluate = (vars) =>
    Function(
      'return ' + box.color.value.replace(/\$\(d3layers:([^)]*)\)/g, (_, key) => JSON.stringify(vars[key])),
    )()
  for (const mode of ['MASTER', 'PARAMETER'])
    for (const ui of ['PARAMS', 'LAYER_LIST', 'PARAMETER_LIST', 'MEDIA']) {
      const vars = { fader_mode: mode, ui_mode: ui, pad_3: 'LINK\nTIME', pad_color_3: 1234 }
      assert.equal(evaluate(vars), mode === 'PARAMETER' && ui === 'PARAMS' ? 0xc00000 : 1234)
    }
  assert.equal(
    evaluate({ fader_mode: 'PARAMETER', ui_mode: 'PARAMS', pad_3: 'Some other action', pad_color_3: 42 }),
    42,
  )
  assert.equal(
    style.layers.find((l) => l.id === 'fader-display').text.value,
    '$(d3layers:master_transport)\n$(d3layers:fader_value_label)',
  )
  assert.equal(style.layers.find((l) => l.id === 'lock-time-label').fontsize.value, 66)
})
