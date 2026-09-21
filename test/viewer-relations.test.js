const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { browserScript } = require('../src/viewer-page')
function render(layers, arrows, {start=0,span=100,width=1000,hidden=[]}={}) {
  const nodes=layers.filter(l=>!hidden.includes(l.uid)).map((l,i)=>({dataset:{uid:l.uid},offsetTop:i*40,offsetHeight:40}))
  const lines=[]
  const context={state:{layers,arrows},start,span,x:t=>(t-start)/span*100,
    sheet:{clientWidth:width+240,querySelectorAll:()=>nodes,append:n=>lines.push(n)},
    el:(_tag,cls)=>({className:cls,style:{}})}
  const code=browserScript.slice(browserScript.indexOf('    const visibleRow ='),browserScript.indexOf("    const playhead = el('i', 'playhead')"))
  vm.runInNewContext(code,context)
  return lines
}
const layers=[{uid:'effect',start:20,end:60},{uid:'video',start:0,end:100},{uid:'precomp',start:20,end:60}]
test('connections use source layer centre even when native arrow time is outside view',()=>{
  const [line]=render(layers,[{source:'effect',destination:'video',time:-999}])
  assert.equal(line.style.left,'calc(240px + (100% - 240px) * 0.4 + 0px)')
  assert.equal(line.style.top,'20px');assert.equal(line.style.height,'40px')
  assert.equal(line.className,'relation down')
  const [up]=render(layers,[{source:'precomp',destination:'video',time:0}])
  assert.equal(up.className,'relation up')
})
test('overlapping effect/precomp arrows have fixed eight-pixel spacing across zoom levels',()=>{
  const arrows=[{source:'effect',destination:'video'},{source:'precomp',destination:'video'},{source:'effect',destination:'precomp'}]
  for(const width of [300,1000,2000]) {
    const lines=render(layers,arrows,{width})
    assert.equal(lines.length,3)
    assert.ok(lines[0].style.left.endsWith('+ 0px)'))
    assert.ok(lines[1].style.left.endsWith('+ -8px)'))
    assert.ok(lines[2].style.left.endsWith('+ 8px)'))
  }
})
test('collapsed groups use visible parent centre and internal connections stay hidden',()=>{
  const all=[{uid:'group',start:10,end:90},{uid:'child',start:20,end:30,parent:'group'},...layers]
  const lines=render(all,[{source:'child',destination:'video'},{source:'child',destination:'group'}],{hidden:['child']})
  assert.equal(lines.length,1)
  assert.ok(lines[0].style.left.includes('* 0.5 +'))
})
test('arrows outside the visible range and missing endpoints are omitted; edge collisions move inward',()=>{
  assert.equal(render(layers,[{source:'effect',destination:'missing'}]).length,0)
  assert.equal(render(layers,[{source:'effect',destination:'video'}],{start:50,span:10}).length,0)
  const lines=render(layers,[{source:'effect',destination:'video'},{source:'precomp',destination:'video'}],{start:40,span:60})
  assert.ok(lines[1].style.left.endsWith('+ 8px)'))
})
