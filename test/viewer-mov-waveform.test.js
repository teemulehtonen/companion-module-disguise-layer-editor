'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path')
const {readMovWaveform}=require('../src/viewer-mov-waveform')
const ints=(...v)=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32BE(n,i*4));return b}
const atom=(name,...parts)=>{const b=Buffer.concat(parts);return Buffer.concat([ints(b.length+8),Buffer.from(name),b])}
function movie(codec='sowt'){
 const pcm=Buffer.alloc(16);[32767,-32768,0,0,16384,-16384,8192,-8192].forEach((v,i)=>pcm.writeInt16LE(v,i*2))
 const desc=Buffer.alloc(28);desc.writeUInt16BE(1,6);desc.writeUInt16BE(2,16);desc.writeUInt16BE(16,18);desc.writeUInt32BE(48000*65536,24)
 const handler=Buffer.alloc(12);handler.write('soun',8)
 const table=atom('stbl',atom('stsd',ints(0,1),atom(codec,desc)),atom('stsz',ints(0,4,4)),atom('stsc',ints(0,1,1,2,1)),atom('stco',ints(0,2,8,16)))
 return Buffer.concat([atom('mdat',pcm),atom('moov',atom('trak',atom('mdia',atom('hdlr',handler),atom('minf',table))))])
}
test('MOV PCM reads interleaved audio chunks with stereo peak preservation',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mov-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'test.mov');await fs.writeFile(file,movie());const w=await readMovWaveform(file);assert.equal(w.duration,4/48000);assert.deepEqual(w.peaks,[1,0,.5,.25]);
 await fs.writeFile(file,movie('mp4a'));await assert.rejects(readMovWaveform(file),{code:'MOV_PCM_UNSUPPORTED'});
 await fs.writeFile(file,Buffer.from('truncated'));await assert.rejects(readMovWaveform(file));
 const c=new AbortController();c.abort();await assert.rejects(readMovWaveform(file,c.signal));
})
