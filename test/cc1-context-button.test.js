'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {contextButtonRepair}=require('../scripts/cc1-context-button.cjs')
test('custom fourth CC1 display keeps fader only in normal mode and restores resource image and list text',()=>{
 const config={style:{layers:[{id:'box0',type:'box'},{id:'image0',type:'image'},
  {id:'fader',type:'text',text:{value:'$(custom:fader)'}},{id:'level',type:'text',text:{value:'$(d3layers:transport_master_level)%'}},
  {id:'overlay',type:'text',text:{value:'$(d3layers:pad_3)'}}]}}
 const before=structuredClone(config),plan=contextButtonRepair(config)
 assert.deepEqual(config,before)
 const setting=(id,key)=>plan.changes.filter(c=>c.elementId===id&&c.key===key).at(-1).value
 const evaluate=(expression,mode,pad)=>Function('return '+expression.replaceAll('$(d3layers:ui_mode)',JSON.stringify(mode)).replaceAll('$(d3layers:pad_3)',JSON.stringify(pad)))()
 for(const [mode,pad,normal]of [['PARAMS','LINK\nTIME',true],['MEDIA','Clip',false],['PARAMETER_LIST','Brightness',false],['CLEAR_KEYS','',false],['PARAMS','',false]]){
  assert.equal(evaluate(setting('fader','enabled').value,mode,pad),normal)
  assert.equal(evaluate(setting('overlay','enabled').value,mode,pad),!normal)
 }
 assert.equal(setting('image0','base64Image').value,'$(d3layers:pad_image_3)')
 assert.equal(setting('overlay','text').value,'$(d3layers:pad_3)')
 assert.equal(setting('box0','color').value,'$(d3layers:pad_color_3)')
 assert.equal(setting('fader','text').value,'$(d3layers:master_transport)')
 assert.equal(setting('level','text').value,'$(d3layers:transport_master_level)%')
 assert.equal(plan.kind.text.value,'$(d3layers:pad_kind_3)')
})

test('plain LINK TIME button gains fader name and value as well as full context layers',()=>{
 const plan=contextButtonRepair({style:{layers:[{id:'box0',type:'box'},{id:'image0',type:'image'},{id:'text0',type:'text',text:{value:'LINK\nTIME'}}]}})
 assert.deepEqual(plan.additions.map(l=>l.id),['resource-kind','fader-name','fader-level'])
 assert.equal(plan.additions[1].text.value,'$(d3layers:master_transport)')
 assert.equal(plan.additions[2].text.value,'$(d3layers:transport_master_level)%')
 assert.equal(plan.changes.find(c=>c.elementId==='text0'&&c.key==='text').value.value,'$(d3layers:pad_3)')
})

test('clean fourth button preserves typography and uses literal variable text instead of numeric addition',()=>{
 const {cleanContextStyle}=require('../scripts/cc1-context-button.cjs')
 const reference=require('../templates/yamaha-cc1-page8.json').controls[0][2].style
 const before=structuredClone(reference),actual=cleanContextStyle(reference)
 assert.deepEqual(reference,before)
 assert.deepEqual(actual.layers.slice(0,-1).map(l=>l.id),reference.layers.map(l=>l.id))
 for(let i=0;i<reference.layers.length;i++){
  const expected=JSON.parse(JSON.stringify(reference.layers[i]).replace(/:pad(_(?:color|image|kind|folder))?_2\)/g,':pad$1_3)'))
  if(expected.id==='text0')expected.enabled=actual.layers[i].enabled
  assert.deepEqual(actual.layers[i],expected)
 }
 const text=actual.layers.find(l=>l.id==='text0'),fader=actual.layers.at(-1)
 for(const k of ['fontsize','font','x','y','width','height','color','halign','valign'])assert.deepEqual(fader[k],text[k])
 assert.equal(fader.text.isExpression,false);assert.equal(text.text.isExpression,false)
 assert.equal(fader.text.value,'$(d3layers:master_transport)\n$(d3layers:transport_master_level)%')
 for(const [mode,pad,expected]of [['PARAMS','LINK\nTIME','Smoke\n37.5%'],['MEDIA','Clip','Clip'],['PARAMETER_LIST','Opacity','Opacity'],['CLEAR_KEYS','','']]){
  const vars={ui_mode:mode,pad_3:pad,master_transport:'Smoke',transport_master_level:37.5}
  const visible=[text,fader].filter(l=>Function('return '+l.enabled.value.replace(/\$\(d3layers:([^)]*)\)/g,(_,k)=>JSON.stringify(vars[k])))())
  assert.equal(visible.length,1)
  assert.equal(visible[0].text.value.replace(/\$\(d3layers:([^)]*)\)/g,(_,k)=>String(vars[k])),expected)
 }
})
