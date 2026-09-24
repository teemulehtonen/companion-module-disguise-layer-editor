const { test } = require('node:test')
const assert = require('node:assert/strict')
const { timecode } = require('../src/timecode')
const { absoluteTimecode } = require('../src/timecode')
const { anchoredTimecode } = require('../src/timecode')

test('absolute labels use Designer TC markers, including discontinuous marker regions', () => {
  const samples = [
    { seconds: 0, label: '05:00:00.00' },
    { seconds: 18, label: '05:00:18.00' },
    { seconds: 32, label: '06:00:00.00' },
    { seconds: 33, label: '06:00:01.00' },
  ]
  assert.equal(absoluteTimecode(18, 25, false, samples), '05:00:18:00')
  assert.equal(absoluteTimecode(32, 25, false, samples), '06:00:00:00')
  assert.equal(absoluteTimecode(33, 25, false, samples), '06:00:01:00')
  assert.equal(timecode(32 - 18, 25), '00:00:14:00') // A duration never receives a marker offset.
  assert.equal(
    absoluteTimecode(33.04, 25, false, samples, { seconds: 33.04, label: '06:00:01.01' }),
    '06:00:01:01',
  )
  assert.equal(absoluteTimecode(34, 25, false, samples), '--:--:--:--')
  assert.equal(absoluteTimecode(18, 25, false), '00:00:18:00')
})
test('timecode rolls frames, seconds, minutes and hours using the selected FPS', () => {
  assert.equal(timecode(0, 25), '00:00:00:00')
  assert.equal(timecode(59.96, 25), '00:00:59:24')
  assert.equal(timecode(60, 25), '00:01:00:00')
  assert.equal(timecode(3661.48, 25), '01:01:01:12')
  assert.equal(timecode(29 / 30, 30), '00:00:00:29')
  assert.equal(timecode(-1.04, 25), '-00:00:01:01')
  assert.equal(timecode(undefined, 25), '--:--:--:--')
})
test('fractional NDF and DF labels retain the actual frame rate', () => {
  const fps = 30000 / 1001
  assert.equal(timecode(1800 / fps, fps), '00:01:00:00')
  assert.equal(timecode(1800 / fps, fps, true), '00:01:00:02')
  assert.equal(timecode(17982 / fps, fps, true), '00:10:00:00')
  assert.equal(timecode(107892 / fps, fps, true), '01:00:00:00')
  assert.equal(timecode(24 / (24000 / 1001), 24000 / 1001), '00:00:01:00')
})
test('native timecode anchors advance continuously between confirmed samples',()=>{
 assert.equal(anchoredTimecode(10.04,25,false,{seconds:10,label:'05:00:10.00'}),'05:00:10:01')
 assert.equal(anchoredTimecode(11,25,false,{seconds:10,label:'05:00:10.00'}),'05:00:11:00')
 const fps=30000/1001
 assert.equal(anchoredTimecode(60/fps,fps,true,{seconds:0,label:'00:00:00.00'}),'00:00:02:00')
 assert.equal(anchoredTimecode(0.04,25,false,null),'00:00:00:01')
})
