'use strict'

// Designer keeps a carrier key even for a constant value. Only enabled
// sequences count as animation; never promote a default carrier key.
function hasKeyframes(field) {
  return field.sequenced === true && field.keys?.length > 0
}

function orderLayerParameters(layer) {
  const parameters = [...new Map([...(layer.fields || []), ...(layer.resources || layer.mediaFields || [])].map(field => [field.name, field])).values()]
  const nativeOrder = layer.controlOrder || parameters.map((field) => field.name)
  const index = new Map(nativeOrder.map((name, i) => [name, i]))
  const compare = (a, b) =>
    Number(hasKeyframes(b)) - Number(hasKeyframes(a)) ||
    (index.get(a.name) ?? Infinity) - (index.get(b.name) ?? Infinity)
  for (const list of [layer.fields, layer.resources, layer.mediaFields]) list?.sort(compare)
  // Keep native order separately so deleting the last key restores its place.
  layer.controlOrder = nativeOrder
  layer.parameterOrder = parameters.sort(compare).map((field) => field.name)
  return layer
}

module.exports = { hasKeyframes, orderLayerParameters }
