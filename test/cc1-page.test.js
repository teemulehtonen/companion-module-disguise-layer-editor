'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {execFileSync}=require('node:child_process')

test('CC1 export reproduces the clean operator page 8 layout',()=>{
 const root=path.resolve(__dirname,'..')
 execFileSync(process.execPath,[path.join(root,'scripts/build-page.cjs')],{cwd:root})
 const cc1=JSON.parse(fs.readFileSync(path.join(root,'D3-Yamaha-CC1.companionconfig'),'utf8'))
 assert.equal(cc1.oldPageNumber,8)
 assert.deepEqual(cc1.page.gridSize,{minColumn:0,maxColumn:7,minRow:0,maxRow:6})
 const action=(button,event='down')=>button.steps[0].action_sets[event]?.[0]?.definitionId
 for(let row=0;row<2;row++)for(let column=0;column<4;column++) assert.equal(action(cc1.page.controls[row][column]),'pad_down')
 assert.deepEqual(Array.from({length:6},(_,column)=>action(cc1.page.controls[3][column],'rotate_right')),
  ['layer','field','value','time','viewer_zoom','time'])
 for(const [column,operation] of [[0,'gotoprevtrack'],[1,'gotonexttrack']]) {
  const item=cc1.page.controls[4][column].steps[0].action_sets.down[0]
  assert.equal(item.definitionId,'transport');assert.equal(item.options.operation.value,operation)
 }
 assert.equal(action(cc1.page.controls[4][4]),'jog_lock')
 assert.equal(action(cc1.page.controls[5][0]),'section_edit')
 assert.equal(action(cc1.page.controls[5][1]),'section_edit')
 assert.equal(action(cc1.page.controls[5][4]),'transport')
 assert.equal(action(cc1.page.controls[5][5]),'transport')
 const pageLink=cc1.page.controls[5][2].steps[0].action_sets.up[0]
 assert.equal(pageLink.connectionId,'internal');assert.equal(pageLink.definitionId,'set_page')
 assert.equal(cc1.instances['d3-layer-control'].config.host,'127.0.0.1')
 const serialized=JSON.stringify(cc1)
 assert.doesNotMatch(serialized,/10\.12\.61\.|Bgg4tTxHnReQQ-wiHU7ka|resourcePassword|masterTransportUid/)
})

test('CC1 page 9 lists 42 live transport selector buttons',()=>{
 const root=path.resolve(__dirname,'..')
 execFileSync(process.execPath,[path.join(root,'scripts/build-page.cjs')],{cwd:root})
 const page=JSON.parse(fs.readFileSync(path.join(root,'D3-Yamaha-CC1-Transports.companionconfig'),'utf8'))
 assert.equal(page.oldPageNumber,9)
 assert.deepEqual(page.page.gridSize,{minColumn:0,maxColumn:5,minRow:0,maxRow:6})
 const buttons=Object.values(page.page.controls).flatMap(row=>Object.values(row))
 assert.equal(buttons.length,42)
 for(let i=0;i<buttons.length;i++) {
  const action=buttons[i].steps[0].action_sets.down[0]
  assert.equal(action.definitionId,'transport_master_select_slot')
  assert.equal(action.options.slot.value,i+1)
  assert.match(buttons[i].style.layers.find(layer=>layer.type==='text').text.value,new RegExp(`master_transport_${i+1}`))
  assert.equal(buttons[i].feedbacks[0].definitionId,'transport_master_selected')
 }
})
