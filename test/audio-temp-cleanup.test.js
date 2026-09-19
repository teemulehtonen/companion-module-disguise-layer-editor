const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path')
const {cleanupLegacyAudioTemp}=require('../src/audio-temp-cleanup')
test('Legacy cleanup only deletes module temporary source files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cleanup-test-'))
  try {
    for(const name of ['d3-wave-ABC123','other']) await fs.mkdir(path.join(root,name))
    await fs.writeFile(path.join(root,'d3-wave-ABC123','source.wav'),'old media')
    await fs.writeFile(path.join(root,'d3-wave-ABC123','keep.txt'),'keep')
    await fs.writeFile(path.join(root,'other','source.wav'),'keep')
    assert.deepEqual(await cleanupLegacyAudioTemp(root),{files:1,bytes:9})
    assert.equal(await fs.readFile(path.join(root,'d3-wave-ABC123','keep.txt'),'utf8'),'keep')
    assert.equal(await fs.readFile(path.join(root,'other','source.wav'),'utf8'),'keep')
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
