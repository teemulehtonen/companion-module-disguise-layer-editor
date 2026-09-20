'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {createPresentationQueue}=require('../src/viewer-presentation')
test('pending presentation composes in order and rolls back only rejected writes',()=>{
 const queue=createPresentationQueue();let label='native'
 const apply=value=>()=>{const old=label;label=value;return()=>{label=old}}
 const first=queue.begin(apply('first'));first(true)
 const second=queue.begin(apply('second'));assert.equal(label,'second')
 second(false);assert.equal(label,'first');assert.equal(queue.size,1)
 queue.paint();assert.equal(label,'first')
 queue.clear();assert.equal(label,'native');assert.equal(queue.size,0)
})
test('a refreshed DOM retains acknowledged presentation until the native snapshot arrives',()=>{
 const queue=createPresentationQueue();let node={text:'old'}
 const finish=queue.begin(()=>{const captured=node,old=captured.text;captured.text='preview';return()=>{captured.text=old}})
 finish(true);const previous=node;node={text:'old'};queue.paint()
 assert.equal(previous.text,'old');assert.equal(node.text,'preview')
 queue.clear();node.text='confirmed';queue.paint();assert.equal(node.text,'confirmed')
})
test('late completion after context reset cannot reintroduce a cleared preview',()=>{
 const queue=createPresentationQueue();let value=0
 const finish=queue.begin(()=>{value=1;return()=>{value=0}})
 queue.clear();finish(true);queue.paint();assert.equal(value,0);assert.equal(queue.size,0)
})
