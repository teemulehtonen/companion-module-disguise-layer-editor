'use strict'

function acceptPlaybackSample(previous, incoming, now) {
  if (!Number.isFinite(incoming?.time)) return previous
  const next = {
    trackUid: String(incoming.trackUid || ''),
    time: Number(incoming.time),
    playing: incoming.playing === true,
    received: Number(now),
  }
  if (
    previous &&
    previous.trackUid === next.trackUid &&
    previous.time === next.time &&
    previous.playing === next.playing
  )
    return previous
  return next
}

function extrapolatedPlayback(sample, state, now, maxAge = 500) {
  const fallback = Number(state?.time)
  if (
    !sample ||
    !Number.isFinite(fallback) ||
    sample.trackUid !== String(state.trackUid || '') ||
    !sample.playing ||
    state.playing !== true ||
    state.connected === false
  )
    return fallback
  const age = Number(now) - sample.received
  if (!Number.isFinite(age) || age < 0 || age > maxAge) return fallback
  const value = sample.time + age / 1000
  return Number.isFinite(state.length) ? Math.min(state.length, value) : value
}

module.exports = { acceptPlaybackSample, extrapolatedPlayback }
