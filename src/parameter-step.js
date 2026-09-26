'use strict'
function parameterStep(field, options = {}) {
  const divisor = options.precision === 'ultra' ? 100 : options.precision === 'fine' || options.fine ? 10 : 1
  const override = Number(options.step) || 0
  const span = typeof field.min === 'number' && typeof field.max === 'number' ? field.max - field.min : NaN
  let step
  if (override > 0) step = override / (field.integer ? 1 : divisor)
  else if (Number.isFinite(span) && span > 0) step = Number(span.toPrecision(7)) / (100 * divisor)
  else step = (field.integer ? field.step || 1 : 0.01) / (field.integer ? 1 : divisor)
  return field.integer ? Math.max(1, Math.floor(step + 0.5)) : step
}
function parameterDecimals(field, precision) {
  const base = {coarse:1,fine:2,ultra:3}[precision] ?? 1
  const step = parameterStep(field || {}, {precision})
  for (let places = base; places < 12; places++) {
    const scaled = step * 10 ** places
    if (Math.abs(scaled - Math.round(scaled)) < 1e-7) return places
  }
  return 12
}
const pythonParameterStep = `
def parameter_step(meta, options):
    divisor = 100 if options.get('precision') == 'ultra' else 10 if options.get('precision') == 'fine' or options.get('fine') else 1
    override = float(options.get('step') or 0)
    lower, upper = meta.get('min'), meta.get('max')
    span = float(upper) - float(lower) if lower is not None and upper is not None else float('nan')
    if override > 0:
        step = override / (1 if meta.get('integer') else divisor)
    elif not math.isnan(span) and not math.isinf(span) and span > 0:
        step = float('%.7g' % span) / (100 * divisor)
    else:
        step = float((meta.get('step') or 1) if meta.get('integer') else 0.01) / (1 if meta.get('integer') else divisor)
    return max(1, math.floor(step + 0.5)) if meta.get('integer') else step
`
module.exports = {parameterStep, parameterDecimals, pythonParameterStep}
