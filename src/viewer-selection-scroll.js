'use strict'

// Prefer the complete expanded layer; long lists follow the selected parameter.
// Return the existing offset when already visible so refreshes never recenter it.
function selectionScroll(top, height, headers, block, parameter) {
  const available = Math.max(1, height - headers - 16)
  const target = block.end - block.start <= available ? block : parameter || block
  const upper = target.start - headers - 8
  const lower = target.end + 8 - height
  if (target.end - target.start > available || top > upper) return Math.max(0, upper)
  if (top < lower) return Math.max(0, lower)
  return top
}
module.exports = { selectionScroll }
