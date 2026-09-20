'use strict'

function duplicateMarkerKeys(tags) {
  const counts = new Map(), keys = []
  for (const tag of tags || []) {
    const type = String(tag.type || '').toLowerCase()
    const kind = type.includes('midi') ? 'midi' : type.includes('cue') ? 'cue' : type.includes('tc') || type.includes('timecode') ? 'tc' : ''
    let value = String(tag.value ?? tag.text ?? '').trim()
    if (kind === 'tc') value = value.replace(/[.;]/g, ':')
    // Numeric labels with padding still denote the same cue/channel/timecode.
    if (/^\d+(?:[.:]\d+)*$/.test(value)) value = value.split(/([.:])/).map(p => /^\d+$/.test(p) ? String(Number(p)) : p).join('')
    const key = kind && value ? kind + ':' + value : null
    keys.push(key)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  return keys.map(key => Boolean(key && counts.get(key) > 1))
}
module.exports = { duplicateMarkerKeys }
