'use strict'
// PrivateState zoom IDs run from OneFrame (0) to FifteenSeconds (7).
// Positive encoder motion zooms in: move towards smaller enabled time steps.
function makeZoomScript(steps) {
  if (!Number.isInteger(steps) || steps === 0 || Math.abs(steps) > 8)
    throw new Error('Zoom steps must be an integer from -8 to 8, excluding zero')
  return `ps = PrivateState.privateState()
if not hasattr(ps, 'guiTimeStep') or not hasattr(ps, 'enabledZoomLevels'):
    raise ValueError('Designer timeline zoom is unavailable in this version')
levels = sorted(set(int(level) for level in ps.enabledZoomLevels))
if not levels:
    raise ValueError('No Designer timeline zoom levels are enabled')
current = int(ps.guiTimeStep)
steps = ${steps}
for unused in range(abs(steps)):
    candidates = [level for level in levels if level < current] if steps > 0 else [level for level in levels if level > current]
    if not candidates:
        break
    current = max(candidates) if steps > 0 else min(candidates)
if int(ps.guiTimeStep) != current:
    ps.guiTimeStep = current
return {'zoomLevel': int(ps.guiTimeStep)}
`
}
module.exports = {makeZoomScript}
