'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const theme = require('../src/theme')
test('XL export preserves timing slots, transport mode feedback and shared Plus typography', () => {
  const root = path.resolve(__dirname, '..')
  execFileSync(process.execPath, [path.join(root, 'scripts/build-page.cjs')], { cwd: root })
  const page = JSON.parse(fs.readFileSync(path.join(root, 'D3-Stream-Deck-XL.companionconfig'), 'utf8'))
  assert.deepEqual(page.page.gridSize, {minColumn:0,maxColumn:7,minRow:0,maxRow:3})
  const controls = page.page.controls
  for (let slot=0;slot<10;slot++) {
    const b=controls[Math.floor(slot/5)][slot%5]
    assert.equal(b.steps[0].action_sets.down[0].options.slot.value,slot)
    for(const feedback of b.feedbacks) assert.equal(feedback.options.slot.value,slot)
    const text=b.style.layers.find(l=>l.type==='text')
    assert.equal(text.fontsize.value,25)
    assert.equal(text.font.value,'companion-sans')
  }
  for(const [column,mode] of ['play','playsection','playloopsection','stop'].entries()) {
    const b=controls[3][column]
    assert.equal(b.steps[0].action_sets.down[0].options.operation.value,mode)
    if(!mode.startsWith('goto')) assert.equal(b.feedbacks[0].options.operation.value,mode)
  }
  assert.equal(controls[2][2].steps[0].action_sets.down[0].options.operation.value,'cut')
  assert.equal(controls[2][3].steps[0].action_sets.down[0].options.operation.value,'merge')
  assert.equal(controls[3][4].feedbacks[0].definitionId,'link_time')
  assert.equal(controls[3][6].steps[0].action_sets.down[0].options.key.value,'0')
  assert.equal(controls[3][6].style.layers.find(l=>l.type==='text').fontsize.value,60)
  assert.equal(controls[3][7].steps[0].action_sets.down[0].options.key.value,'go')
  assert.equal(controls[0][5].steps[0].action_sets.down[0].options.key.value,'7')
  assert.equal(controls[2][4].steps[0].action_sets.down[0].options.key.value,'clear')
  assert.equal(page.instances['d3-layer-control'].config.host,'127.0.0.1')
})
