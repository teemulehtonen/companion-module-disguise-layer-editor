'use strict'
// Repair a customised fourth CC1 LCD without replacing its normal fader display.
function contextButtonRepair(config, label = 'd3layers') {
 const variable = name => '$(' + label + ':' + name + ')'
 const normal = variable('ui_mode') + " == 'PARAMS' && " + variable('pad_3') + " == 'LINK\\nTIME'"
 const layers = config.style.layers
 const overlay = layers.find(l => l.type === 'text' && l.text?.value === variable('pad_3')) || layers.find(l => l.id === 'text0' && l.type === 'text')
 const image = layers.find(l => l.type === 'image')
 const background = layers.find(l => l.id === 'box0')
 if (!overlay || !image || !background) throw Error('Expected customised CC1 display layers')
 const changes = []
 const set = (elementId, key, value, isExpression = true) => changes.push({elementId,key,value:{value,isExpression}})
 for (const layer of layers.filter(l => l.type === 'text' && l.id !== overlay.id)) set(layer.id,'enabled',normal)
 for (const layer of layers.filter(l => l.type === 'text' && l.id !== overlay.id)) {
  const level=layer.text?.value?.includes('transport_master_level')
  set(layer.id,'text',level ? variable('transport_master_level')+'%' : variable('master_transport'),false)
  set(layer.id,'fontsizeAllowShrink',true,false)
 }
 const template = JSON.parse(JSON.stringify(require('../templates/yamaha-cc1-page8.json').controls[0][2].style.layers).replace(/:pad(_(?:color|image|kind|folder))?_2\)/g,':pad$1_3)'))
 for (const [target,source] of [[overlay,template.find(l=>l.id==='text0')],[image,template.find(l=>l.id==='image0')]]) {
  for (const [key,value] of Object.entries(source)) if (!['id','name','type','usage'].includes(key))
   changes.push({elementId:target.id,key,value:JSON.parse(JSON.stringify(value).replaceAll('d3layers:',label+':'))})
 }
 set(overlay.id,'enabled','!('+normal+')')
 set(background.id,'color',variable('pad_color_3'))
 const kind=structuredClone(template.find(l=>l.id==='resource-kind'))
 for(const [key,value]of Object.entries(kind))if(typeof value==='object')kind[key]=JSON.parse(JSON.stringify(value).replaceAll('d3layers:',label+':'))
 const additions=[kind]
 if (!layers.some(l=>l.type==='text' && l.id!==overlay.id)) {
  for(const [id,text,y,height,fontsize] of [['fader-name',variable('master_transport'),0,70,35],['fader-level',variable('transport_master_level')+'%',70,30,70]]) {
   const layer=structuredClone(template.find(l=>l.id==='text0'))
   Object.assign(layer,{id,text:{value:text,isExpression:false},enabled:{value:normal,isExpression:true}})
   for(const [key,value]of Object.entries({y,height,fontsize,fontsizeAllowShrink:true}))layer[key]={value,isExpression:false}
   additions.push(layer)
  }
 }
 return {changes,kind,normal,additions}
}
module.exports={contextButtonRepair}

function cleanContextStyle(referenceStyle, label = 'd3layers') {
 const style=JSON.parse(JSON.stringify(referenceStyle).replace(/:pad(_(?:color|image|kind|folder))?_2\)/g,':pad$1_3)'))
 const text=style.layers.find(l=>l.id==='text0')
 if(!text)throw Error('Reference context button has no text layer')
 const v=name=>'$('+label+':'+name+')'
 const normal=v('ui_mode')+" == 'PARAMS' && "+v('pad_3')+" == 'LINK\\nTIME'"
 text.text={isExpression:false,value:v('pad_3')}
 text.enabled={isExpression:true,value:'!('+normal+')'}
 const background=style.layers.find(l=>l.id==='box0')
 if(background)background.color={isExpression:true,value:'('+normal+') && '+v('fader_mode')+" == 'PARAMETER' ? 12582912 : "+v('pad_color_3')}
 const fader=structuredClone(text)
 fader.id='fader-display'
 fader.name='Selected fader'
 fader.enabled={isExpression:true,value:normal}
 fader.text={isExpression:false,value:v('master_transport')+'\n'+v('fader_value_label')}
 fader.y={value:10,isExpression:false}
 fader.height={value:80,isExpression:false}
 const hint=structuredClone(fader)
 hint.id='lock-time-label'
 hint.name='Lock time hint'
 hint.text={value:'LOCK TIME',isExpression:false}
 hint.y={value:70,isExpression:false}
 hint.height={value:30,isExpression:false}
 hint.fontsize={value:66,isExpression:false}
 style.layers.push(fader,hint)
 return style
}
module.exports.cleanContextStyle=cleanContextStyle
