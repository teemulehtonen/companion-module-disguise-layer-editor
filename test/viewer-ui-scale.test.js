'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {createUiGeometry}=require('../src/viewer-ui-scale')
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)
test('all UI sizes preserve pointer times, drag distances, value positions and overlay coordinates',()=>{
 for(const scale of [1,1.05,1.1]) {
  const geo=createUiGeometry(()=>scale,{innerWidth:1280,innerHeight:800})
  const rect={x:240,y:160,left:240,top:160,right:1040,bottom:212,width:800,height:52}
  const node={getBoundingClientRect:()=>Object.fromEntries(Object.entries(rect).map(([k,v])=>[k,v*scale]))}
  const r=geo.rect(node),event={clientX:640*scale,clientY:186*scale}
  close((geo.x(event)-r.left)/r.width*120,60)
  close((geo.y(event)-r.top)/r.height,0.5)
  close((geo.x({clientX:720*scale})-geo.x(event))/r.width*120,12)
  close(geo.x(event)*scale,event.clientX)
  close(geo.y(event)*scale,event.clientY)
  close(geo.width()*scale,1280);close(geo.height()*scale,800)
  // Fixed popup clamping and scroll geometry use the same logical pixels.
  const left=Math.min(geo.x({clientX:1270}),geo.width()-250)
  assert.ok((left+250)*scale<=1280+1e-9)
  close(r.height,52)
 }
})
test('geometry reads the current scale after a size change',()=>{
 let scale=1;const geo=createUiGeometry(()=>scale,{innerWidth:1100,innerHeight:880})
 close(geo.x({clientX:550}),550)
 scale=1.1;close(geo.x({clientX:550}),500);close(geo.height(),800)
})
