'use strict'

// Apply only confirmed editor state. Kept independent of the DOM for race tests.
function applyEditPatch(state, patch) {
  if (!state || !patch || state.trackUid !== patch.trackUid) return false
  const layer = state.layers.find(item => item.uid === patch.layer.uid)
  if (!layer) return false
  const delta=patch.layer.start-layer.start
  const translated=delta!==0 && Math.abs((patch.layer.end-patch.layer.start)-(layer.end-layer.start))<1e-7
  layer.start = patch.layer.start
  layer.end = patch.layer.end
  const incomingFields=new Map([...(patch.layer.fields || []),...(patch.layer.mediaFields || [])].map(field=>[field.name,field]))
  for (const incoming of incomingFields.values()) {
    // JSON snapshots contain separate copies for each display list.
    // Patch every copy so redraw cannot resurrect the pre-edit key/value.
    const numeric=new Set([...(layer.fields || []),...(layer.visibleParameters || []),...(layer.allParameters || [])])
    for(const field of numeric) if(field.name===incoming.name && !('current' in field)) {
        if(translated && !incoming.samples && field.samples)field.samples=field.samples.map(sample=>({...sample,time:sample.time+delta}))
        Object.assign(field,incoming)
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
