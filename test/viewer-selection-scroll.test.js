'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selectionScroll } = require('../src/viewer-selection-scroll')

test('selection scrolling reveals short layer blocks and follows parameters in long lists', () => {
  assert.equal(selectionScroll(0, 600, 180, {start:300,end:650}), 58)
  assert.equal(selectionScroll(58, 600, 180, {start:300,end:650}), 58)
  assert.equal(selectionScroll(500, 600, 180, {start:300,end:650}), 112)
  const long = {start:300,end:1900}
  assert.equal(selectionScroll(0, 600, 180, long, {start:1600,end:1650}), 1058)
  assert.equal(selectionScroll(1058, 600, 180, long, {start:400,end:450}), 212)
  assert.equal(selectionScroll(0, 600, 180, long, {start:300,end:352}), 0)
})
