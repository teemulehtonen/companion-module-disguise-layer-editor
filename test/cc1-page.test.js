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
 assert.deepEqual(cc1.page,JSON.parse(fs.readFileSync(path.join(root,'templates/yamaha-cc1-page8.json'),'utf8')))
 assert.deepEqual(cc1.page.gridSize,{minColumn:0,maxColumn:7,minRow:0,maxRow:6})
 const action=(button,event='down')=>button.steps[0].action_sets[event]?.[0]?.definitionId
 for(let row=0;row<2;row++)for(let column=0;column<4;column++) assert.equal(action(cc1.page.controls[row][column]),'pad_down')
 assert.deepEqual(Array.from({length:6},(_,column)=>action(cc1.page.controls[3][column],'rotate_right')),
  ['layer','field','value','time','viewer_zoom','time'])
 for(let column=0;column<6;column++) for(const event of ['rotate_left','rotate_right']) {
  const encoderAction=cc1.page.controls[3][column].steps[0].action_sets[event][0]
  assert.equal(encoderAction.options.detent_divisor.value,column===4?1:2)
  assert.equal(encoderAction.options.detent_group.value,column===4?0:column+1)
 }
 assert.equal(cc1.page.controls[4][0],undefined)
 assert.equal(cc1.page.controls[4][1],undefined)
 assert.equal(action(cc1.page.controls[4][2]),'fader_mode_toggle')
 assert.equal(cc1.page.controls[4][2].feedbacks[0].definitionId,'fader_parameter')
 assert.equal(action(cc1.page.controls[5][3]),'navigation_toggle')
 for(const [column,track,section]of [[4,'gotoprevtrack','gotoprevsection'],[5,'gotonexttrack','gotonextsection']]){
  const a=cc1.page.controls[5][column].steps[0].action_sets.down[0]
  assert.equal(a.connectionId,'internal');assert.equal(a.definitionId,'logic_if')
  assert.equal(a.children.condition[0].definitionId,'navigation_track')
  assert.equal(a.children.condition[0].connectionId,'d3-layer-control')
  assert.equal(a.children.actions[0].options.operation.value,track)
  assert.equal(a.children.else_actions[0].options.operation.value,section)
  assert.equal(a.children.actions[0].connectionId,'d3-layer-control')
  assert.equal(a.children.else_actions[0].connectionId,'d3-layer-control')
 }
 assert.equal(action(cc1.page.controls[4][4]),'jog_lock')
 assert.equal(action(cc1.page.controls[5][0]),'section_edit')
 assert.equal(action(cc1.page.controls[5][1]),'section_edit')
 assert.deepEqual(cc1.page.controls[5][2].steps[0].action_sets.up,[])
 assert.equal(cc1.page.controls[5][2].steps[0].action_sets.down.length,1)
 const pageLink=cc1.page.controls[5][2].steps[0].action_sets.down[0]
 assert.equal(pageLink.connectionId,'internal');assert.equal(pageLink.definitionId,'set_page')
 assert.equal(pageLink.options.surfaceId.value,'self')
 const fourth=cc1.page.controls[0][3]
 assert.equal(fourth.steps[0].action_sets.down[0].options.slot.value,3)
 assert.equal(action(fourth,'up'),'pad_up')
 assert.equal(fourth.style.layers.find(l=>l.id==='image0').base64Image.value,'$(d3layers:pad_image_3)')
 assert.match(fourth.style.layers.find(l=>l.id==='fader-display').text.value,/master_transport/)
 assert.match(fourth.style.layers.find(l=>l.id==='fader-display').text.value,/fader_value_label/)
 assert.deepEqual(fourth.style.layers.filter(l=>!['fader-display','lock-time-label'].includes(l.id)).map(l=>l.id),cc1.page.controls[0][2].style.layers.map(l=>l.id))
 const hint=fourth.style.layers.find(l=>l.id==='lock-time-label')
 const fader=fourth.style.layers.find(l=>l.id==='fader-display')
 assert.equal(hint.text.value,'LOCK TIME')
 assert.equal(hint.fontsize.value,66)
 assert.deepEqual(hint.enabled,fader.enabled)
 assert.match(hint.enabled.value,/PARAMS/)
 assert.equal(fader.y.value+fader.height.value/2,50)
 assert.equal(fader.height.value,80)
 assert.equal(hint.y.value+hint.height.value,100)
 assert.equal(action(cc1.page.controls[2][0]),'layer_press')
 assert.equal(action(cc1.page.controls[3][0]),'layer_press')
 assert.equal(action(cc1.page.controls[2][1]),'parameter_press')
 assert.equal(action(cc1.page.controls[3][1]),'parameter_press')
 assert.equal(action(cc1.page.controls[2][2]),'value_press')
 assert.equal(action(cc1.page.controls[3][2]),'key_set')
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
