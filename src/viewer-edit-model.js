'use strict'

// Apply only confirmed editor state. Kept independent of the DOM for race tests.
function applyEditPatch(state, patch) {
  if (!state || !patch || state.trackUid !== patch.trackUid) return false
  const layer = state.layers.find(item => item.uid === patch.layer.uid)
  if (!layer) return false
  layer.start = patch.layer.start
  layer.end = patch.layer.end
  for (const incoming of patch.layer.fields || []) {
    // JSON snapshots contain separate copies for each display list.
    // Patch every copy so redraw cannot resurrect the pre-edit key/value.
    for (const list of [layer.fields,layer.visibleParameters,layer.allParameters]) {
      for(const field of list || []) if(field.name===incoming.name && !('current' in field)) Object.assign(field,incoming)
    }
    const resources=new Set([...(layer.resources || []),...(layer.visibleParameters || []),...(layer.allParameters || [])].filter(item=>item.name===incoming.name && 'current' in item))
    for (const resource of resources) if (incoming.resource) {
      const known = new Map([resource.current, ...resource.keys.map(k => k.resource)].filter(Boolean).map(r => [r.uid,r]))
      resource.sequenced = incoming.sequenced
      resource.keys = incoming.keys.map(key => ({time:key.time,resource:known.get(key.resourceUid) || null}))
    }
  }
  return true
}

module.exports = { applyEditPatch }
