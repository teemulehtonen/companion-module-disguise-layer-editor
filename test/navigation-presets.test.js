'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {actions,presets}=require('../src/definitions')
const {DisguiseLayerControl}=require('../src/main')

test('navigation presets use native IF/ELSE with matching track and section directions',()=>{
 const [groups,p]=presets('custom')
 assert.deepEqual(groups.find(g=>g.id==='navigation').definitions,['navigation_toggle','navigation_previous','navigation_next'])
 assert.match(p.navigation_toggle.style.text,/\$\(custom:navigation_mode\)/)
 assert.equal(p.navigation_toggle.feedbacks[0].feedbackId,'navigation_track')
 for(const [name,operation] of [['previous','gotoprevtrack'],['next','gotonexttrack']]) {
  const down=p['navigation_'+name].steps[0].down
  assert.equal(down.length,1)
  assert.equal(down[0].actionId,'internal:logicIf')
  assert.deepEqual(down[0].children.condition,[{feedbackId:'navigation_track',options:{}}])
  assert.deepEqual(down[0].children.actions,[{actionId:'transport',options:{operation}}])
  assert.deepEqual(down[0].children.elseActions,[{actionId:'transport',options:{operation:name==='previous'?'gotoprevsection':'gotonextsection'}}])
  assert.ok(p['navigation_'+name].name.includes('track / section'))
  assert.deepEqual(p['navigation_'+name].steps[0].up,[])
 }
 assert.deepEqual(p.transport_gotoprevtrack.steps[0].down,[{actionId:'transport',options:{operation:'gotoprevtrack'}}])
 assert.deepEqual(p.transport_gotonexttrack.steps[0].down,[{actionId:'transport',options:{operation:'gotonexttrack'}}])
})
test('mode toggle persists shared state without Designer or full publication',()=>{
 const item=Object.create(DisguiseLayerControl.prototype)
 Object.assign(item,{config:{},saveConfig(c){this.saved={...c}},setVariableValues(v){this.values=v},checkFeedbacks(id){this.feedback=id}})
 const first=actions(item),second=actions(item)
 first.navigation_toggle.callback()
 assert.equal(item.trackNavigation,true)
 assert.equal(item.saved.trackNavigation,true)
 assert.equal(item.values.navigation_mode,'TRACK')
 second.navigation_toggle.callback()
 assert.equal(item.saved.trackNavigation,false)
 assert.equal(item.values.navigation_mode,'SECTION')
 assert.equal(item.feedback,'navigation_track')
})
test('both navigation branches use the existing VIEW and transport dispatch guards',async()=>{
 const tracks=[]
 const editor={controlTransport(op){tracks.push(op)}}
 const item={editor,perform:fn=>fn(editor)}
 const a=actions(item),[,p]=presets()
 for (const key of ['navigation_previous','navigation_next']) {
  const entry=p[key].steps[0].down[0].children.actions[0]
  await a[entry.actionId].callback({options:entry.options})
 }
 assert.deepEqual(tracks,['gotoprevtrack','gotonexttrack'])
 editor.viewOnly=true
 for (const key of ['navigation_previous','navigation_next']) {
  for (const branch of ['actions','elseActions']) {
   const entry=p[key].steps[0].down[0].children[branch][0]
   await a[entry.actionId].callback({options:entry.options})
  }
 }
 assert.equal(tracks.length,2)
 editor.viewOnly=false
 for (const key of ['navigation_previous','navigation_next']) {
  const entry=p[key].steps[0].down[0].children.elseActions[0]
  await a[entry.actionId].callback({options:entry.options})
 }
 assert.deepEqual(tracks,['gotoprevtrack','gotonexttrack','gotoprevsection','gotonextsection'])
})