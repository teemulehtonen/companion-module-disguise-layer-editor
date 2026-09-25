'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {DisguiseLayerControl}=require('../src/main')

function instance(){
 const item=Object.create(DisguiseLayerControl.prototype)
 Object.assign(item,{config:{},masterTransportUid:'1',masterTransports:[
  {uid:'1',name:'Music',brightness:0.25,volume:0.75},
  {uid:'2',name:'Imag',brightness:0.6,volume:0.6},
 ],lastError:'',log(){},connectionStatus(){},publish(){this.fullPublishes=(this.fullPublishes||0)+1},publishMaster(){this.publishes=(this.publishes||0)+1},saveConfig(config){this.saved={...config}}})
 return item
}

test('master selection spans transports and OSC targets and clamps at the ends and defers a lightweight publication',async()=>{
 const item=instance();item.masterLevelPending={uid:'1',percent:25}
 item.selectMasterTransport(-1)
 assert.equal(item.masterTransportUid,'1')
 item.selectMasterTransport(1)
 assert.equal(item.masterTransportUid,'2')
 assert.equal(item.masterLevelPending,null)
 assert.equal(item.saved.masterTransportUid,'2')
 assert.equal(item.publishes,undefined)
 await new Promise(resolve=>setTimeout(resolve,5))
 assert.equal(item.publishes,1)
 assert.equal(item.fullPublishes,undefined)
 item.selectMasterTransport(1)
 assert.equal(item.masterTransportUid,'osc:fader1')
 item.selectMasterTransportSlot(15)
 item.selectMasterTransport(1)
 assert.equal(item.masterTransportUid,'osc:fader8')
 await new Promise(resolve=>setTimeout(resolve,5))
 assert.equal(item.publishes,2)
})

test('master transport page selects an exact slot and ignores empty slots',async()=>{
 const item=instance();item.masterLevelPending={uid:'1',percent:25}
 item.selectMasterTransportSlot(1)
 assert.equal(item.masterTransportUid,'2')
 assert.equal(item.masterLevelPending,null)
 assert.equal(item.saved.masterTransportUid,'2')
 await new Promise(resolve=>setTimeout(resolve,5))
 item.selectMasterTransportSlot(41)
 assert.equal(item.masterTransportUid,'2')
})

test('rapid absolute fader values keep one in-flight write and only the newest pending value',async()=>{
 const item=instance();let release
 const gate=new Promise(resolve=>{release=resolve}),calls=[]
 item.client={viewOnly:false,async setTransportMaster(uid,value){calls.push([uid,value]);if(calls.length===1)await gate}}
 const first=item.setTransportMasterLevel(10)
 const second=item.setTransportMasterLevel(20)
 const third=item.setTransportMasterLevel(30)
 assert.equal(first,second);assert.equal(second,third)
 await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(calls,[['1',0.1]])
 release();await first
 assert.deepEqual(calls,[['1',0.1],['1',0.3]])
 assert.equal(item.masterTransports[0].brightness,0.3)
 assert.equal(item.masterTransports[0].volume,0.3)
})

test('published motor target uses the lower level when brightness and volume differ',()=>{
 const item=instance(),values={}
 Object.assign(item,{editor:null,setVariableValues(v){Object.assign(values,v)},checkFeedbacks(){},loadThumbnails(){}})
 item.publish=DisguiseLayerControl.prototype.publish
 item.publish()
 assert.equal(values.master_transport,'Music')
 assert.equal(values.master_transport_position,'1/10')
 assert.equal(values.transport_master_level,25)
 assert.equal(values.transport_master_brightness,25)
 assert.equal(values.transport_master_volume,75)
 assert.equal(values.transport_master_mismatch,true)
})

test('transport refresh preset rereads the list without editor synchronisation', async()=>{
 const {actions,presets}=require('../src/definitions')
 const item=instance();let reads=0
 item.connection={async refreshMasterTransports(){reads++}}
 const [groups,definitions]=presets()
 assert.ok(groups.find(group=>group.id==='master').definitions.includes('master_refresh'))
 const action=definitions.master_refresh.steps[0].down[0]
 assert.equal(action.actionId,'transport_master_refresh')
 await actions(item)[action.actionId].callback({options:{}})
 assert.equal(reads,1)
 assert.equal(item.fullPublishes,undefined)
})