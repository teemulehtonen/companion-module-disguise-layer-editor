'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const source=fs.readFileSync(require.resolve('../src/main'),'utf8')
const methods=source.slice(source.indexOf('  performDetents('),source.indexOf('  async performNow('))
function host(){const C=vm.runInNewContext('(class Host {'+methods+'})');const h=new C();h.editor={};h.queueGeneration=0;h.actionTail=Promise.resolve();h.performNow=fn=>fn(h.editor);return h}
test('encoder batching preserves detents and action/reversal barriers without a backlog',async()=>{
 const h=host(),seen=[];let release;h.perform(()=>new Promise(r=>release=r));await Promise.resolve()
 for(let i=0;i<20;i++)h.performDetents('value+',(_,n)=>seen.push(n))
 h.perform(()=>seen.push('click'))
 for(let i=0;i<5;i++)h.performDetents('value-',(_,n)=>seen.push(-n))
 release();await h.actionTail;assert.deepEqual(seen,[20,'click',-5])
})
test('context invalidation discards pending batched turns',async()=>{
 const h=host();let calls=0
 h.performDetents('time+',()=>calls++);h.queueGeneration++;await h.actionTail;assert.equal(calls,0)
})
