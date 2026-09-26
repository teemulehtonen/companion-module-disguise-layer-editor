'use strict'
function supportsParameterFader(field) {
  return Boolean(
    field &&
    !field.resource &&
    !field.choices?.length &&
    !field.choiceError &&
    Number.isFinite(field.min) &&
    Number.isFinite(field.max) &&
    field.max > field.min &&
    Number.isFinite(field.max - field.min),
  )
}
function parameterFaderValue(field, percent) {
  if (!supportsParameterFader(field))
    throw Error('Fader requires a numeric parameter with finite minimum and maximum')
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw Error('Fader level must be 0–100')
  let value = field.min + (field.max - field.min) * (percent / 100)
  if (field.integer) value = Math.floor(value + 0.5)
  return Math.max(field.min, Math.min(field.max, value))
}
function parameterFaderPercent(field, value) {
  if (!supportsParameterFader(field) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
}
const pythonParameterFader = `
def parameter_fader_value(meta, percent, expected_range):
    lower, upper = meta.get('min'), meta.get('max')
    if meta.get('resource') or meta.get('choices') or meta.get('choiceError') or lower is None or upper is None:
        raise ValueError('Fader requires a numeric parameter with finite minimum and maximum')
    span = float(upper) - float(lower)
    if math.isnan(span) or math.isinf(span) or span <= 0:
        raise ValueError('Fader requires a numeric parameter with finite minimum and maximum')
    if expected_range != [lower, upper, bool(meta.get('integer'))]:
        raise ValueError('Parameter range changed; refresh before moving the fader')
    percent = float(percent)
    if math.isnan(percent) or math.isinf(percent) or percent < 0 or percent > 100:
        raise ValueError('Fader level must be 0-100')
    value = float(lower) + span * (percent / 100)
    if meta.get('integer'):
        value = math.floor(value + 0.5)
    return max(lower, min(upper, value))
`
module.exports = { supportsParameterFader, parameterFaderValue, parameterFaderPercent, pythonParameterFader }
