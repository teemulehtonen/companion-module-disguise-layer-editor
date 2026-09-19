'use strict'

const { hasKeyframes, orderLayerParameters } = require('./parameter-order')
const { createHash } = require('node:crypto')

// Playback values change frequently; they update existing labels, not the whole
// timeline. Key values and curve samples still participate in this revision.
function renderRevision(data) {
  const content = JSON.stringify(
    [data.layers, data.sections, data.annotations, data.grid, data.beatGrid, data.arrows, data.trackWaveform],
    function (key, value) {
      return key === 'value' && typeof this.name === 'string' && Array.isArray(this.keys) ? undefined : value
    },
  )
  return createHash('sha256').update(content).digest('hex').slice(0, 20)
}

// Presentation only: keep the complete snapshot intact for thumbnails and
// collapsed-layer markers. Changing this option must never enable sequencing.
function visibleParameters(layer, showAll = false) {
  const ordered = orderLayerParameters({
    ...layer,
    fields: [...(layer.fields || [])],
    resources: [...(layer.resources || [])],
  })
  const byName = new Map([...ordered.fields, ...ordered.resources].map((field) => [field.name, field]))
  return ordered.parameterOrder
    .map((name) => byName.get(name))
    .filter((field) => field && (showAll || hasKeyframes(field)))
}

// Frame buckets avoid equality errors caused by beat/second conversions and
// keep fractional frame rates intact. Default carrier keys are not landmarks.
function alignmentGuides(snapshot, context) {
  if (!context.layerEdit && !context.moveKey) return []
  const fps = snapshot.fps
  if (!Number.isFinite(fps) || fps <= 0) return []
  const landmarks = []
  for (const layer of snapshot.layers || []) {
    if (layer.group) continue
    for (const edge of ['start', 'end'])
      if (Number.isFinite(layer[edge]))
        landmarks.push({
          layer: layer.uid,
          kind: edge,
          time: layer[edge],
          label: layer.name + (edge === 'start' ? ' · IN' : ' · OUT'),
        })
    for (const field of [...(layer.fields || []), ...(layer.resources || [])])
      if (hasKeyframes(field))
        field.keys.forEach((key, index) => {
          if (Number.isFinite(key.time))
            landmarks.push({
              layer: layer.uid,
              kind: 'key',
              field: field.name,
              index,
              time: key.time,
              label: layer.name + ' · ' + (field.label || field.name) + ' · KF',
            })
        })
  }
  const targets = landmarks.filter(
    (item) =>
      item.layer === context.focusUid &&
      (context.layerEdit
        ? item.kind !== 'key'
        : Number.isFinite(context.keyTime) &&
          item.kind === 'key' &&
          item.field === context.parameter &&
          Math.abs(item.time - context.keyTime) < 0.51 / fps),
  )
  const buckets = new Map()
  for (const item of landmarks) {
    const frame = Math.round(item.time * fps)
    if (!buckets.has(frame)) buckets.set(frame, [])
    buckets.get(frame).push(item)
  }
  const guides = new Map()
  for (const target of targets) {
    const frame = Math.round(target.time * fps)
    const matches = buckets.get(frame).filter((item) => item !== target)
    // Layer editing always shows exact IN/OUT, including subframe beat edges.
    // Keyframe editing retains its match-only alignment guides.
    if (context.layerEdit || matches.length)
      guides.set(context.layerEdit ? target.kind : frame, {
        time: context.layerEdit ? target.time : frame / fps,
        labels: [target.label, ...matches.map((item) => item.label)].slice(0, 8),
        count: matches.length,
      })
  }
  return [...guides.values()].sort((a, b) => a.time - b.time)
}

function summariseGroups(layers) {
  const byUid = new Map(layers.map((layer) => [layer.uid, layer]))
  for (const group of layers.filter((layer) => layer.group)) {
    group.fields = []
    group.resources = []
    for (const child of layers.filter((layer) => !layer.group)) {
      let parent = child.parent
      const seen = new Set()
      while (parent && !seen.has(parent)) {
        seen.add(parent)
        if (parent === group.uid) {
          group.fields.push(...(child.fields || []).map(field => ({ ...field, keys: (field.keys || []).filter(key => key.time >= (child.start ?? -Infinity) && key.time < (child.end ?? Infinity)) })))
          group.resources.push(...(child.resources || []).map(field => ({ ...field, keys: (field.keys || []).filter(key => key.time >= (child.start ?? -Infinity) && key.time < (child.end ?? Infinity)) })))
          break
        }
        parent = byUid.get(parent)?.parent
      }
    }
  }
  return layers
}

module.exports = { visibleParameters, alignmentGuides, summariseGroups, renderRevision }
