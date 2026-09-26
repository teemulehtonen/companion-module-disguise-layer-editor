'use strict'
// Broad shared tests always run; groups add focused coverage, never replace it.
const groups = {
  layers: /layer|group|alignment|out-boundary|selection/,
  keyframes: /key|curve|wheel|insert|gesture|discrete|parameter/,
  timing: /clock|time|transport|seek|snap|zoom|pin-time|out-boundary/,
  resources: /resource|audio|waveform|thumbnail|discrete|parameter/,
  viewer: /viewer|view-mode/,
  companion: /cc1|definitions|presets|page|encoder|editor|connection|parameter-browser/,
}
const shared =
  /^(client|connection|editor|live-editor|definitions|view-mode|viewer-editor|viewer-server|viewer-edit-model|viewer-presentation|regression-plan)\.test\.js$/
function selectTests(files, requested = 'all') {
  const names = requested
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!names.length || names.some((n) => n !== 'all' && !groups[n]))
    throw Error('Unknown test group: ' + requested)
  const tests = files.filter((f) => f.endsWith('.test.js')).sort()
  return names.includes('all')
    ? tests
    : tests.filter((f) => shared.test(f) || names.some((n) => groups[n].test(f)))
}
module.exports = { groups, selectTests }
