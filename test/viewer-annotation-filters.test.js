'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const vm=require('node:vm')
const {browserScript}=require('../src/viewer-page')

function node(){return {dataset:{},attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},append(...items){this.children.push(...items)}}}

function controls(annotationKinds){
 const start=browserScript.indexOf("    const filters = el('div', 'wave-controls annotation-filters')")
 const line="    ruler.side.append(filters)"
 const end=browserScript.indexOf(line,start)+line.length
 const context={annotationKinds,ruler:{side:node()},draws:0,draw:()=>context.draws++,document:{createElementNS:()=>node()},el:(tag,cls,text)=>Object.assign(node(),{tag,cls,text})}
 vm.runInNewContext(browserScript.slice(start,end),context)
 return {context,buttons:context.ruler.side.children[0].children}
}

test('TIME row event filters toggle each row and ALL selects or clears every row',()=>{
 const selected=new Set(['cue','tc','midi','notes'])
 let view=controls(selected)
 assert.deepEqual(Array.from(view.buttons,b=>b.text),[undefined,undefined,undefined,undefined,undefined])
 assert.deepEqual(Array.from(view.buttons,b=>b.children[0].attrs.viewBox),['0 0 22 20','0 0 22 20','0 0 22 20','0 0 22 20','0 0 22 20'])
 assert.deepEqual(Array.from(view.buttons,b=>b.children[0].attrs['aria-hidden']),['true','true','true','true','true'])
 assert.deepEqual(Array.from(view.buttons,b=>b.attrs['aria-label']),['HIDE CUE ROW','HIDE TIMECODE ROW','HIDE MIDI ROW','HIDE NOTES ROW','HIDE ALL EVENT ROWS'])
 assert.ok(Array.from(view.buttons,b=>b.children[0].children[0].attrs.d).every(Boolean))
 assert.deepEqual(Array.from(view.buttons,b=>b.attrs['aria-pressed']),['true','true','true','true','true'])
 view.buttons[0].onclick()
 assert.deepEqual([...selected],['tc','midi','notes'])
 assert.equal(view.context.draws,1)
 view=controls(selected)
 assert.equal(view.buttons[0].attrs['aria-pressed'],'false')
 assert.equal(view.buttons[4].attrs['aria-pressed'],'false')
 view.buttons[4].onclick()
 assert.deepEqual([...selected],['tc','midi','notes','cue'])
 view=controls(selected)
 view.buttons[4].onclick()
 assert.deepEqual([...selected],[])
})

test('hidden event rows are omitted from the timeline layout',()=>{
 const drawStart=browserScript.indexOf('  function draw()')
 const start=browserScript.indexOf('    const annotations = state.annotations || {}',drawStart)
 const end=browserScript.indexOf('    let headerTop = 0',start)
 function rendered(selected){
  const titles=[]
  const context={
   annotationKinds:new Set(selected),state:{annotations:{}},duplicateMarkerKeys:()=>[],
   row(title){titles.push(title);return {lane:{dataset:{}}}},annotationMouse(){},marker(){},seekTarget(){},Set,
  }
  vm.runInNewContext('{'+browserScript.slice(start,end)+'}',context)
  return titles
 }
 assert.deepEqual(rendered(['cue','notes']),['CUES','NOTES'])
 assert.deepEqual(rendered([]),[])
})
