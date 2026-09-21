'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { spawnSync } = require('node:child_process')
const { browserScript } = require('../src/viewer-page')
const { renderRevision } = require('../src/viewer-model')
const nativeScript = require('../src/viewer-script')

function render(trackAudio, owner, wave = { status: 'ready', duration: 50, peaks: [0, 1, 0.5] }) {
  const node = () => ({ style: {}, dataset: {}, children: [], attrs: {}, setAttribute(key, value) { this.attrs[key] = value }, addEventListener() {}, append(...items) { this.children.push(...items) } })
  const lane = node()
  const context = {
    state: { trackAudio, layers: owner ? [owner] : [] },
    row: () => ({ root: node(), side: node(), lane }),
    el: (tag, cls, text) => ({ tag, cls, text }),
    document: { createElementNS: node },
    waveformHeights: new Map(), start: 10, span: 100, x: time => time - 10,
  }
  const source = browserScript.slice(browserScript.indexOf('  function waveform('), browserScript.indexOf('  let revealedLayer'))
  vm.runInNewContext(source, context)
  context.waveform(wave, 'AUDIO', owner?.uid)
  return lane.children
}

test('track audio leaves the timed intro empty and keeps source duration at a panned viewport', () => {
  const [svg] = render({ uid: 'audio', start: 16 })
  assert.equal(svg.style.left, '6%')
  assert.equal(svg.style.width, '50%')
  assert.equal(render({ uid: 'audio', start: 0 })[0].style.left, '-10%')
})

test('missing track audio placement is explicit rather than guessed as zero', () => {
  for (const start of [undefined, null, NaN, Infinity]) {
    const [message] = render({ uid: 'audio', start })
    assert.equal(message.text, 'TRACK AUDIO POSITION UNAVAILABLE')
  }
})

test('audio layers retain their own start and endpoint clipping', () => {
  const [svg] = render({ start: 16 }, { uid: 'layer', start: 25, end: 50 })
  assert.equal(svg.style.left, '15%')
  assert.equal(svg.style.clipPath, 'inset(0 50% 0 0)')
})

test('moving or replacing track audio invalidates the drawing revision', () => {
  const data = { layers: [], trackAudio: { uid: '1', start: 16 } }
  const before = renderRevision(data)
  data.trackAudio.start = 32
  assert.notEqual(renderRevision(data), before)
  const moved = renderRevision(data)
  data.trackAudio.uid = '2'
  assert.notEqual(renderRevision(data), moved)
})

test('native placement uses local beats across non-60 BPM intros without writes', t => {
  const python = ['python3', 'python'].find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0)
  if (!python) return t.skip('Python is required for the isolated native timing fixture')
  const block = nativeScript.slice(nativeScript.indexOf("    result['trackAudio'] ="), nativeScript.indexOf("    result['arrows'] ="))
  const source = block.split('\n').map(line => line.startsWith('    ') ? line.slice(4) : line).join('\n')
  const fixture = `import math, json
class Track:
    def __init__(self, intro, rate, at): self.intro, self.rate, self.at = intro, rate, at
    def __setattr__(self, key, value):
        if key not in ('intro', 'rate', 'at'): raise AssertionError('Unexpected native write')
        object.__setattr__(self, key, value)
    def timeToBeat(self, time): return time if time < self.intro else self.intro + (time-self.intro)*self.rate
    def beatToTime(self, beat): return beat if beat < self.intro else self.intro + (beat-self.intro)/self.rate
    def globalBeatToLocalBeat(self, beat): return beat-self.intro
    def audioTrack(self, beat): return None if self.at < self.intro else 'audio'
def viewer_resource(audio, visual): return {'uid': audio} if audio else None
class Errors: Exception = Exception
pyerrors = Errors()
code = compile(${JSON.stringify(source)}, '<production-track-audio>', 'exec')
for intro in [0, 16, 23.75]:
    for bpm in [60, 115, 123, 136]:
        for elapsed in [0, 14, 60]:
            seconds = intro + elapsed
            track = Track(intro, bpm/60.0, seconds)
            result = {'warnings': []}
            exec(code)
            assert abs(result['trackAudio']['start']-intro) < 1e-8, result
track = Track(16, 2, 0)
seconds = 0
result = {'warnings': []}
exec(code)
assert result['trackAudio'] is None
class BrokenTrack(Track):
    def globalBeatToLocalBeat(self, beat): raise RuntimeError('Optional mapping unavailable')
track = BrokenTrack(16, 2, 30)
seconds = 30
result = {'warnings': []}
exec(code)
assert result['trackAudio']['start'] is None
assert result['warnings'] == ['Track audio position unavailable']
print('38 isolated timing cases passed')
`
  const run = spawnSync(python, ['-c', fixture], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr || run.error?.message)
})


test('track beat grid starts at audio-local zero after timed intros at different tempos', t => {
  const python = ['python3', 'python'].find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0)
  if (!python) return t.skip('Python is required for the isolated beat-grid fixture')
  const block = nativeScript.slice(nativeScript.indexOf("    result['beatGrid'] = []"), nativeScript.indexOf('    for i in range(7):'))
  const source = block.split('\n').map(line => line.startsWith('    ') ? line.slice(4) : line).join('\n')
  const fixture = `import math
class Track:
    def __init__(self, intro, rate): self.intro, self.rate = intro, rate
    def timeToBeat(self, time): return time if time < self.intro else self.intro + (time-self.intro)*self.rate
    def beatToTime(self, beat): return beat if beat < self.intro else self.intro + (beat-self.intro)/self.rate
code = compile(${JSON.stringify(source)}, '<production-beat-grid>', 'exec')
for intro in [0,16,32]:
    for bpm in [100,115,136]:
        track = Track(intro,bpm/60.0)
        audio_origin_beat = intro
        start, end, width = 0, intro+16, 3840
        result = {'trackAudio': {'start': intro}}
        exec(code)
        ticks = result['beatGrid']
        assert ticks[0]['time'] == intro, ticks
        assert ticks[0]['beat'] == 0, ticks
        assert abs(ticks[1]['time']-(intro+60.0/bpm)) < 1e-8, ticks
        assert all(tick['time'] >= intro for tick in ticks)
        start = intro + 3.1
        exec(code)
        assert all(tick['time'] >= start for tick in result['beatGrid'])
result = {'trackAudio': {'start': None}}
exec(code)
assert result['beatGrid'] == []
print('Audio-local beat grid passed')
`
  const run = spawnSync(python, ['-c', fixture], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr || run.error?.message)
})


test('waveform remains the original single peak envelope even if RMS data is supplied', () => {
  const [svg] = render({ start: 16 }, undefined, { status: 'ready', duration: 50, peaks: [1, 1], rms: [0.2, 0.7] })
  assert.equal(svg.children.length, 1)
  assert.equal(svg.children[0].attrs.d, 'M0,4V50 M500,4V50')
  assert.equal(svg.style.left, '6%')
})


test('track audio display button hides the entire row and stays available to restore it in VIEW mode', () => {
  const source = browserScript.slice(browserScript.indexOf("    const displayControls ="), browserScript.indexOf("    const parents = new Set()"))
  const context = {
    trackAudioVisible: true, headerTop: 120, allLayerDetails: false, parameterModes: new Map(),
    state: {viewOnly:true, layers:[], trackAudio:{start:32}, trackWaveform:{status:'ready'}},
    document: {createElementNS: () => node()},
    el: (tag, cls, text) => Object.assign(node(), {tag, cls, text}),
    waveform: () => { context.waveRows++ },
    draw: () => render(),
  }
  function node() { return {style:{}, attrs:{}, children:[], setAttribute(k,v){this.attrs[k]=v}, append(...items){this.children.push(...items)}} }
  function render() {
    context.displayRow={root:{offsetHeight:22},side:node()}
    context.waveRows=0
    vm.runInNewContext('{'+source+'}', context)
    return context.displayRow.side.children[0].children[0]
  }
  let button=render()
  assert.equal(button.text,undefined)
  assert.equal(button.attrs['aria-label'],'TRACK AUDIO')
  assert.equal(button.children[0].attrs['aria-hidden'],'true')
  assert.equal(button.children[0].attrs.viewBox,'0 0 22 20')
  assert.ok(button.children[0].children[0].attrs.d)
  assert.deepEqual(button.style,{})
  assert.equal(button.attrs['aria-pressed'],'true')
  assert.equal(context.waveRows,1)
  button.onclick()
  button=context.displayRow.side.children[0].children[0]
  assert.equal(button.title,'SHOW TRACK AUDIO')
  assert.equal(button.attrs['aria-pressed'],'false')
  assert.equal(context.waveRows,0)
  context.state.trackAudio={start:16}
  button=render()
  assert.equal(context.waveRows,0)
  button.onclick()
  assert.equal(context.waveRows,1)
  assert.equal(context.displayRow.side.children[0].children[0].attrs['aria-pressed'],'true')
  context.state.trackAudio=null
  render()
  assert.equal(context.waveRows,0)
})
