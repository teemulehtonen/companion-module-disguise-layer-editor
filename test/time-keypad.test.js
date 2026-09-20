'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {Editor}=require('../src/editor'),{DemoClient}=require('../src/demo')
test('time keypad inserts colons, validates input, preserves track guard and routes both clocks',async()=>{
 for(const linked of [true,false]){
  const c=new DemoClient(),e=new Editor(c);await e.refresh();e.setLinkTime(linked)
  const execute=c.execute.bind(c),calls=[]
  c.execute=async(command,args)=>{calls.push({command,args});if(command==='resolve_timecode')return {time:1.04};return execute(command,args)}
  for(const digit of '101')await e.enterTime(digit)
  assert.equal(e.timeEntryLabel,'00:00:01:01')
  await e.enterTime('go');assert.equal(e.time,1.04);assert.equal(e.timeEntryDigits,'')
  assert.equal(Boolean(calls.find(c=>c.command==='seek').args.keepPlayhead),!linked)
  await e.enterTime('9');await e.enterTime('9');const count=calls.length
  await e.enterTime('go');assert.equal(e.timeEntryError,'INVALID\nTIME');assert.ok(calls.slice(count).every(call=>!['resolve_timecode','seek'].includes(call.command)))
  await e.enterTime('back');assert.equal(e.timeEntryLabel,'00:00:00:09')
  await e.enterTime('clear');assert.equal(e.timeEntryDigits,'')
  await e.enterTime('1');e.timeEntryTrackUid='different';await e.enterTime('go');assert.equal(e.timeEntryError,'TRACK\nCHANGED')
 }
})

test('time keypad accepts repeated leading zeros and keeps accepting digits after eight places',async()=>{
 const e=new Editor(new DemoClient());await e.refresh()
 for(const digit of '00000101')await e.enterTime(digit)
 assert.equal(e.timeEntryLabel,'00:00:01:01')
 await e.enterTime('clear')
 for(const digit of '000000000101')await e.enterTime(digit)
 assert.equal(e.timeEntryLabel,'00:00:01:01')
 await e.enterTime('clear');await e.enterTime(0);await e.enterTime(0)
 assert.equal(e.timeEntryDigits,'00')
 assert.equal(e.timeEntryLabel,'00:00:00:00')
})
