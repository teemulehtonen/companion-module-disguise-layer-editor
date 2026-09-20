'use strict'

// Geometry is previewed locally every animation frame; native validation still
// runs for every write. Limit only the extra authoritative curve sampling.
function curvePreviewDue(editor, now = Date.now()) {
  const target = JSON.stringify([editor.snapshot?.trackUid, editor.layer?.uid, editor.field?.name])
  const previous = editor.curvePreviewRequest
  if (previous?.target === target && now >= previous.time && now - previous.time < 100) return false
  editor.curvePreviewRequest = { target, time: now }
  return true
}
module.exports = { curvePreviewDue }
