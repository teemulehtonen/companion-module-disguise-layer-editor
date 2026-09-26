'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'),
  path = require('node:path'),
  net = require('node:net')
const { spawnSync } = require('node:child_process')
const { DisguiseLayerControl } = require('../src/main')
const { DesignerClient } = require('../src/client')
const { makeScript } = require('../src/designer-script')
const { actions } = require('../src/definitions')

test('legacy web settings cannot start a server and CC1 LCD/keyframe actions still work', async () => {
  const host = Object.create(DisguiseLayerControl.prototype),
    values = {}
  Object.defineProperty(host, 'label', { value: 'cc1-test' })
  Object.assign(host, {
    log() {},
    updateStatus() {},
    checkFeedbacks() {},
    setPresetDefinitions() {},
    saveConfig() {},
    setVariableValues(v) {
      Object.assign(values, v)
    },
  })
  const listen = net.Server.prototype.listen
  net.Server.prototype.listen = function () {
    assert.fail('CC1 must not open a listener')
  }
  try {
    await host.configUpdated({
      demo: true,
      viewerEnabled: true,
      viewerLan: true,
      viewerPort: 8765,
      viewerEditEnabled: true,
      resourceShareRoot: 'smb://unused/share',
      resourceUsername: 'unused',
    })
    assert.equal(host.lastError, '')
    assert.equal(host.viewer, undefined)
    assert.equal(values.viewer_status, undefined)
    assert.ok(!host.getConfigFields().some((f) => /^(viewer|resource)/.test(f.id)))
    assert.ok(host.getConfigFields().some((f) => f.id === 'viewOnly'))
    const a = actions(host)
    await a.parameter_press.callback({ options: {} })
    assert.equal(values.ui_mode, 'PARAMETER_LIST')
    await a.pad_down.callback({ options: { slot: 0 } })
    assert.equal(values.ui_mode, 'PARAMS')
    await host.editor.seekToTime({ trackUid: host.editor.snapshot.trackUid, time: 1 })
    const before = host.editor.field.keys.length
    await a.key_set.callback({ options: {} })
    assert.equal(host.lastError, '')
    assert.equal(host.editor.field.keys.length, before + 1)
    await host.configUpdated({ demo: true, viewOnly: true })
    assert.equal(host.editor.linkTime, false)
    assert.equal(host.client.viewOnly, true)
    await host.configUpdated({ demo: true, viewOnly: false })
    assert.equal(host.client.viewOnly, false)
  } finally {
    net.Server.prototype.listen = listen
    await host.destroy()
  }
})

test('removed web commands are rejected before any Designer request', async () => {
  let calls = 0
  const client = new DesignerClient('localhost', 80, async () => {
    calls++
    throw Error('Unexpected request')
  })
  try {
    for (const command of [
      'viewer_snapshot',
      'viewer_audio_source',
      'annotation_edit',
      'group_move',
      'layer_group',
      'layer_reorder',
      'layer_manage',
      'parameter_sequence',
      'key_group',
    ]) {
      assert.throws(() => makeScript(command), /Unsupported CC1 command/)
      await assert.rejects(client.execute(command), /Unsupported CC1 command/)
    }
    assert.equal(calls, 0)
    assert.throws(() => makeScript('refresh', { command: 'key_delete' }), /Invalid command/)
  } finally {
    client.close()
  }
})

test('CC1 native script compiles and encoder key movement preserves values without web helpers', () => {
  const python = ['python3', 'python'].find(
    (p) => spawnSync(p, ['--version'], { encoding: 'utf8' }).status === 0,
  )
  assert.ok(python, 'Python is required for offline native validation')
  const script = makeScript('refresh')
  assert.doesNotMatch(
    script,
    /viewer_snapshot|viewer_audio_source|pointer_time|checked_snap|previewCurve|targetValue/,
  )
  const compile = spawnSync(python, ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: script,
    encoding: 'utf8',
  })
  assert.equal(compile.status, 0, compile.stderr)
  const start = script.indexOf("    if command in ('select_key', 'key_type', 'key_move'):")
  const end = script.indexOf("    if command == 'adjust_value':", start)
  assert.ok(start >= 0 && end > start)
  const fixture = `from types import SimpleNamespace as O
class Seq:
    def __init__(self): self.keys=[O(v=0.4,interpolation=1)]; self.times=[2.0]
    def nKeys(self): return len(self.keys)
    def key(self,i): return self.keys[i]
    def t(self,i): return self.times[i]
    def setFloat(self,t,v): self.times.append(t); self.keys.append(O(v=v,interpolation=1))
    def remove(self,i,n): del self.times[i:i+n]; del self.keys[i:i+n]
seq=Seq()
field=O(disableSequencing=False,notifyEdit=lambda:None)
layer=O(tStart=0,tEnd=10)
track=O(timeToBeat=lambda t:t,beatToTime=lambda t:t,lengthInSec=10)
Key=O(tEpsilon=0.000001,select=0,linear=1,cubic=2)
is_resource=False
def markDirty(x): pass
def fps(): return 25
def field_snapshot(layer,field,t): return {'keys':[{'time':seq.t(i),'value':seq.key(i).v,'interpolation':seq.key(i).interpolation} for i in range(seq.nKeys())]}
command='key_move'
p={'sourceTime':2,'delta':1,'keepPlayhead':True,'expectedKey':{'time':2,'value':0.4,'interpolation':1}}
def run():
    seconds=2
${script.slice(start, end)}
result=run()
assert result['time']==3, result
assert seq.times==[3] and seq.key(0).v==0.4 and seq.key(0).interpolation==1
`
  const result = spawnSync(python, ['-c', fixture], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('runtime and dependencies contain no web server, SMB or waveform implementation', () => {
  const files = fs.readdirSync(path.join(__dirname, '../src'))
  assert.ok(!files.some((f) => /^(viewer-|smb-|waveform-|audio-temp)/.test(f)))
  assert.equal(require('../package.json').dependencies['smb3-client'], undefined)
  assert.equal(require('../package-lock.json').packages['node_modules/smb3-client'], undefined)
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8')
  assert.doesNotMatch(main, /createServer|ViewerServer|viewerLivePatch|previewCurve/)
})
