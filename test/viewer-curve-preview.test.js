'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {curvePreviewDue}=require('../src/viewer-curve-preview')
test('curve sampling throttles only the same target and resumes at 100 ms',()=>{
 const editor={snapshot:{trackUid:'1'},layer:{uid:'2'},field:{name:'brightness'}}
 assert.equal(curvePreviewDue(editor,1000),true)
 assert.equal(curvePreviewDue(editor,1099),false)
 assert.equal(curvePreviewDue(editor,1100),true)
 editor.field.name='opacity'
 assert.equal(curvePreviewDue(editor,1101),true)
 assert.equal(curvePreviewDue(editor,900),true)
})
