'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { acceptPlaybackSample, extrapolatedPlayback } = require('../src/playback-clock')

test('playing clock advances smoothly between native samples and corrects on the next sample', () => {
  let sample = acceptPlaybackSample(null, { trackUid: '1', time: 10, playing: true }, 1000)
  const state = { trackUid: '1', time: 10, playing: true, connected: true, length: 20 }
  assert.equal(extrapolatedPlayback(sample, state, 1040), 10.04)
  const unchanged = acceptPlaybackSample(sample, { ...state, time: 10 }, 1075)
  assert.equal(unchanged, sample, 'Repeated HTTP reads do not postpone stale-sample protection')
  sample = acceptPlaybackSample(sample, { ...state, time: 10.04 }, 1080)
  assert.ok(Math.abs(extrapolatedPlayback(sample, state, 1120) - 10.08) < 1e-9)
})

test('clock freezes on stop, wrong track, disconnect or a stale native sample', () => {
  const sample = acceptPlaybackSample(null, { trackUid: '1', time: 10, playing: true }, 1000)
  const state = { trackUid: '1', time: 10, playing: true, connected: true, length: 20 }
  assert.equal(extrapolatedPlayback(sample, state, 1600), 10)
  assert.equal(extrapolatedPlayback(sample, { ...state, playing: false }, 1040), 10)
  assert.equal(extrapolatedPlayback(sample, { ...state, trackUid: '2' }, 1040), 10)
  assert.equal(extrapolatedPlayback(sample, { ...state, connected: false }, 1040), 10)
  assert.equal(extrapolatedPlayback(sample, { ...state, length: 10.02 }, 1040), 10.02)
})
