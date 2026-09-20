'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {duplicateMarkerKeys}=require('../src/viewer-marker-duplicates')
test('duplicate markers compare all tags by kind and exclude notes',()=>{
 const tags=[{type:'CUE',value:'001'},{type:'CUE',value:'1'},
 {type:'MIDI',value:'1'},{type:'MIDI',value:'60'}, {type:'MIDI',value:'060'},
 {type:'TC',value:'12:00:02.00'},{type:'TC',value:'12:00:02:00'},
 {type:'NOTES',value:'same'},{type:'NOTES',value:'same'}, {type:'CUE',value:'2'}]
 assert.deepEqual(duplicateMarkerKeys(tags),[true,true,false,true,true,true,true,false,false,false])
 assert.deepEqual(duplicateMarkerKeys([]),[])
})
