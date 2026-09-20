'use strict'

// Apply only confirmed editor state. Kept independent of the DOM for race tests.
function applyEditPatch(state, patch) {
  if (!state || !patch || state.trackUid !== patch.trackUid) return false
  const layer = state.layers.find(item => item.uid === patch.layer.uid)
  if (!layer) return false
  layer.start = patch.layer.start
  layer.end = patch.layer.end
  for (const incoming of patch.layer.fields || []) {
    const field = layer.fields?.find(item => item.name === incoming.name)
    if (field) Object.assign(field, incoming)
    const resource = layer.resources?.find(item => item.name === incoming.name)
    if (resource && incoming.resource) {
      const known = new Map([resource.current, ...resource.keys.map(k => k.resource)].filter(Boolean).map(r => [r.uid,r]))
      resource.sequenced = incoming.sequenced
      resource.keys = incoming.keys.map(key => ({time:key.time,resource:known.get(key.resourceUid) || null}))
    }
  }
  return true
}

module.exports = { applyEditPatch }
