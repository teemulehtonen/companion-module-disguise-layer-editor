'use strict'

function timecode(seconds, fps, dropFrame = false) {
  if (!Number.isFinite(seconds) || !Number.isFinite(fps) || fps <= 0) return '--:--:--:--'
  const nominal = Math.round(fps)
  if (nominal < 1) return '--:--:--:--'
  let frames = Math.round(Math.abs(seconds) * fps)
  // SMPTE drop-frame changes labels, never the underlying frame duration.
  if (dropFrame && (nominal === 30 || nominal === 60)) {
    const dropped = nominal === 60 ? 4 : 2
    const perMinute = nominal * 60 - dropped
    const perTenMinutes = nominal * 600 - dropped * 9
    const blocks = Math.floor(frames / perTenMinutes)
    const remainder = frames % perTenMinutes
    frames += dropped * 9 * blocks + dropped * Math.max(0, Math.floor((remainder - dropped) / perMinute))
  }
  const parts = [
    Math.floor(frames / (nominal * 3600)),
    Math.floor(frames / (nominal * 60)) % 60,
    Math.floor(frames / nominal) % 60,
    frames % nominal,
  ]
  return (seconds < 0 && frames ? '-' : '') + parts.map((v) => String(v).padStart(2, '0')).join(':')
}
function absoluteTimecode(seconds, fps, dropFrame, samples, liveSample) {
  if (!Number.isFinite(seconds)) return '--:--:--:--'
  const match =
    liveSample && Math.abs(liveSample.seconds - seconds) < 1e-7
      ? liveSample
      : samples?.find((sample) => Math.abs(sample.seconds - seconds) < 1e-7)
  if (match) return match.label.replace(/[.;](\d+)$/, ':$1')
  // Demo/older peers have no native mapping. With a mapping, avoid briefly
  // displaying track-relative time while waiting for a newly observed key.
  return samples?.length ? '--:--:--:--' : timecode(seconds, fps, dropFrame)
}
module.exports = { timecode, absoluteTimecode }
