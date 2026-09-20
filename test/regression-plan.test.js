'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {selectTests}=require('../scripts/test-plan.cjs')
test('regression groups retain shared safeguards and deduplicate overlaps',()=>{
 const files=['viewer-layer-group.test.js','viewer-wheel.test.js','view-mode.test.js','client.test.js','README.md']
 assert.deepEqual(selectTests(files,'layers'),['client.test.js','view-mode.test.js','viewer-layer-group.test.js'])
 assert.deepEqual(selectTests(files,'layers,keyframes'),selectTests(files,'all'))
 assert.throws(()=>selectTests(files,'typo'),/Unknown/)
})
