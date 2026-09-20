'use strict'

// Categorical values have names, not a meaningful vertical numeric scale.
function discreteSegments(field, layer) {
  if (!(field.discrete || field.choices?.length || field.choiceError)) return null
  const label = value => field.choices?.find(c => c.value === value)?.label ?? `UNKNOWN (${value})`
  if (!field.sequenced) return [{start:layer.start,end:layer.end,label:label(field.value)}]
  const keys = [...(field.keys || [])].sort((a,b)=>a.time-b.time)
  return keys.map((key,index)=>({
    start:Math.max(layer.start,index === 0 ? layer.start : key.time),
    end:Math.min(layer.end,keys[index+1]?.time ?? layer.end),
    label:label(key.value),
  })).filter(segment=>segment.end>segment.start)
}
module.exports = { discreteSegments }
