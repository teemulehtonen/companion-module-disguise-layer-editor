'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm')
const {browserScript}=require('../src/viewer-page'),{createPresentationQueue}=require('../src/viewer-presentation')
const source=browserScript.slice(browserScript.indexOf('function previewAction('),browserScript.indexOf('  async function sendEdit('))
function node(dataset={},children={}){const attrs=new Map();return {dataset,style:{},textContent:'ORIGINAL',querySelector:q=>children[q]||null,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)}}
test('layer rename previews both labels, never native state, and rolls back on rejection',()=>{
 const name=node(),clip=node(),row=node({uid:'a'},{'.select-label':name,'.clip-label':clip})
 const state={editor:{layerUid:'a',parameter:'v'},layers:[{uid:'a',name:'ORIGINAL'}]};const before=JSON.stringify(state)
 const c={state,presentation:createPresentationQueue(),sheet:{querySelectorAll:q=>q.includes('.layer')?[row]:[]}}
 vm.createContext(c);vm.runInContext(source,c);const finish=c.previewAction('layer_manage',{operation:'rename',layerUid:'a',name:'NEW'})
 assert.equal(name.textContent,'NEW');assert.equal(clip.textContent,'NEW');assert.equal(JSON.stringify(state),before)
 finish(false);assert.equal(name.textContent,'ORIGINAL');assert.equal(row.style.pointerEvents,undefined)
})
test('selected key deletion hides exactly the selected parameter keys and clears on snapshot',()=>{
 const a=node({keyLayer:'a',keyParameter:'v',keyTime:'1'}),b=node({keyLayer:'a',keyParameter:'v',keyTime:'2'}),other=node({keyLayer:'b',keyParameter:'v',keyTime:'1'})
 const c={state:{editor:{layerUid:'a',parameter:'v',moveKey:{time:1}},layers:[{uid:'a'}]},presentation:createPresentationQueue(),sheet:{querySelectorAll:q=>q==='[data-key-time]'?[a,b,other]:[]}}
 vm.createContext(c);vm.runInContext(source,c);c.previewAction('key_delete',{})(true)
 assert.equal(a.style.display,'none');assert.equal(b.style.display,undefined);assert.equal(other.style.display,undefined)
 c.presentation.clear();assert.equal(a.style.display,undefined)
})
