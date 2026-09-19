const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { smbTarget, readSmbAudio } = require('../src/smb-audio')
test('SMB project mapping is automatic and confines files to the configured share', () => {
  const source = {
    projectDirectory: 'D:\\d3 Projects\\example_project',
    filename: 'D:\\d3 Projects\\example_project\\objects\\audio.wav',
  }
  assert.deepEqual(smbTarget('\\\\host\\d3 Projects', source), {
    host: 'host',
    share: '\\\\host\\d3 Projects',
    file: 'example_project\\objects\\audio.wav',
  })
  assert.equal(smbTarget('smb://host/d3 Projects', source).file, 'example_project\\objects\\audio.wav')
  assert.throws(() => smbTarget('\\\\host\\share', { ...source, filename: 'C:\\private\\x.wav' }))
  assert.throws(() => smbTarget('\\\\host\\share\\..', source))
})
test('Windows without explicit credentials reads the validated UNC path using its OS session', async () => {
  const source = { projectDirectory: 'D:\\projects\\show', filename: 'D:\\projects\\show\\audio.wav' }
  class NoClient { constructor() { throw Error('Must use Windows session') } }
  let actual
  await readSmbAudio({ resourceShareRoot: '\\\\host\\projects' }, source,
    new AbortController().signal, async file => { actual = file }, NoClient, 'win32')
  assert.equal(actual, '\\\\host\\projects\\show\\audio.wav')
  const controller = new AbortController(); controller.abort()
  await assert.rejects(readSmbAudio({ resourceShareRoot: '\\\\host\\projects' }, source,
    controller.signal, async () => { throw Error('Must not read after cancellation') }, NoClient, 'win32'), {name:'AbortError'})
})

test('Embedded MOV over SMB uses seekable reads without downloading video', async () => {
  let closed = false
  const handle = {close:async()=>{closed=true}}
  class Fake {
    on() {}
    async authenticate() {return {connectTree:async()=>({
      openReadOnly:async()=>handle,
      createFileReadStream:async()=>{throw Error('Full download must not occur')},
    })}}
    async close() {}
  }
  const source={container:'mov',projectDirectory:'D:\\projects\\show',filename:'D:\\projects\\show\\video.mov'}
  const result=await readSmbAudio({resourceShareRoot:'\\\\host\\projects'}, source,
    new AbortController().signal,async file=>{assert.equal(file,handle);return {duration:20}},Fake,'linux')
  assert.equal(result.duration,20)
  assert.equal(closed,true)
  await assert.rejects(readSmbAudio({resourceShareRoot:'\\\\host\\projects'},source,
    new AbortController().signal,async()=>{throw Object.assign(Error('Codec'),{code:'MOV_PCM_UNSUPPORTED'})},Fake,'linux'),{code:'MOV_PCM_UNSUPPORTED'})
})

test('WAV decoding accepts a seekable memory reader without a local media file',async()=>{
 const {readWaveform}=require('../src/viewer-waveform')
 const data=Buffer.alloc(48);data.write('RIFF');data.writeUInt32LE(40,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(4,40);data.writeInt16LE(-32768,44)
 let closed=false
 const result=await readWaveform({stat:async()=>({size:data.length}),read:async(b,o,n,p)=>({bytesRead:data.copy(b,o,p,p+n)}),close:async()=>{closed=true}})
 assert.deepEqual(result.peaks,[1,0]);assert.equal(closed,true)
})
