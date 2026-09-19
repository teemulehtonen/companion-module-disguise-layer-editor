const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { smbTarget, readSmbAudio } = require('../src/smb-audio')
const { Readable } = require('node:stream'),
  fs = require('node:fs/promises')
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
test('SMB only reads, uses credentials and removes temporary audio after decoding', async () => {
  let auth,
    fileName,
    tmp,
    closed = false
  class Fake {
    on() {}
    async authenticate(o) {
      auth = o
      return {
        connectTree: async () => ({
          createFileReadStream: async (name) => {
            fileName = name
            return Readable.from([Buffer.from('audio')])
          },
        }),
      }
    }
    async close() {
      closed = true
    }
  }
  const source = { projectDirectory: 'D:\\projects\\show', filename: 'D:\\projects\\show\\audio.wav' }
  const result = await readSmbAudio(
    { resourceShareRoot: '\\\\host\\projects', resourceUsername: 'user', resourcePassword: 'secret' },
    source,
    new AbortController().signal,
    async (file) => {
      tmp = file
      assert.equal(await fs.readFile(file, 'utf8'), 'audio')
      return { peaks: [1] }
    },
    Fake,
  )
  assert.deepEqual(result, { peaks: [1] })
  assert.equal(auth.forceNtlmVersion, 'v2')
  assert.equal(auth.password, 'secret')
  assert.equal(fileName, 'show\\audio.wav')
  assert.equal(closed, true)
  await assert.rejects(fs.stat(tmp))
})
