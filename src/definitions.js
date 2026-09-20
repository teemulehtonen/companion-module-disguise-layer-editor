'use strict'
const theme = require('./theme')

const numeric = (id, label, value, min = -100000, max = 100000) => ({
  type: 'number',
  id,
  label,
  default: value,
  min,
  max,
  step: 0.001,
})
const direction = {
  type: 'dropdown',
  id: 'direction',
  label: 'Direction',
  default: 1,
  choices: [
    { id: -1, label: 'Previous / decrease' },
    { id: 1, label: 'Next / increase' },
  ],
}

function actions(instance) {
  // These IDs are persisted in Companion exports. Keep legacy actions available
  // even when the current page no longer shows their old GO/APPLY buttons.
  const action = (name, options, fn, queueOptions) => ({
    name,
    options,
    callback: (event) =>
      instance.perform((editor) => {
        if (editor.viewOnly) {
          const browsing = ['Time keypad','Select adaptive timing step','Read layers and values from Designer',
            'Select active layer','Select parameter / media folder','Scrub live / move selected key',
            'Cycle COARSE / FINE / ULTRA','Jump Designer playhead to staged time',
            'Layer timing step / resource write mode','Jump to previous / next keyframe',
            'Cycle time step / fit layer to content','Toggle resource browser']
          const preview = name === 'Adjust live value / preview media' && editor.mediaMode
          if (!browsing.includes(name) && !preview && !name.startsWith('Context button')) return
        }
        if (editor.clearKeysBrowser && !name.startsWith('Context button') && name !== 'Transport control') {
          const id = {
            'Select parameter / media folder': 'field',
            'Cycle COARSE / FINE / ULTRA': 'fine',
            'Add numeric keyframe / confirm media and return': 'value_press',
            'Cycle time step / fit layer to content': 'time_step',
            'Toggle resource browser': 'media',
            'Open layer timing editor / return': 'layer_edit',
          }[name]
          return editor.handleClearKeysAction(id, event.options)
        }
        // Leaving the confirmation through any dial/tool cancels it, never hides it.
        if (!name.startsWith('Context button')) editor.clearKeysPrompt = null
        return fn(editor, event.options)
      }, queueOptions),
  })
  return {
    time_keypad: action('Time keypad', [{type:'dropdown',id:'key',label:'Key',default:'go',choices:[...Array.from({length:10},(_,i)=>({id:String(i),label:String(i)})),{id:'back',label:'Backspace'},{id:'clear',label:'Clear'},{id:'go',label:'Jump'}]}], (e,o)=>e.enterTime(o.key), {synchronise:false}),
    time_step_set: action('Select adaptive timing step', [numeric('slot','Step slot (0–9)',0,0,9)], (e,o)=>e.setTimeStep(Number(o.slot))),
    transport: action('Transport control', [{type:'dropdown',id:'operation',label:'Operation',default:'play',choices:[{id:'play',label:'Play'},{id:'playsection',label:'Play to end of section'},{id:'playloopsection',label:'Play loop section'},{id:'stop',label:'Stop'},{id:'toggle',label:'Play / stop (last mode)'},{id:'gotoprevsection',label:'Previous section'},{id:'gotonextsection',label:'Next section'}]}], (e,o)=>e.controlTransport(o.operation)),
    section_edit: action('Cut / merge section at active edit time', [{type:'dropdown',id:'operation',label:'Operation',default:'cut',choices:[{id:'cut',label:'Cut section'},{id:'merge',label:'Merge with previous section'}]}], (e,o)=>e.editSection(o.operation)),
    refresh: action('Read layers and values from Designer', [], (e) => e.refresh()),
    link_time: action('Toggle playhead follow while editing', [], (e) => e.setLinkTime(!e.linkTime)),
    play_stop: action('Play to end of section / stop', [], (e) => e.togglePlayback()),
    layer: action('Select active layer', [direction], (e, o) =>
      e.layerEdit === 'edit'
        ? e.adjustLayerTiming('in', Number(o.direction))
        : e.mediaMode
          ? e.selectMediaField(Number(o.direction))
          : !e.moveKey && !e.layerEdit && instance.viewer?.rotateZoom(Number(o.direction))
            ? undefined
            : e.selectLive('layer', Number(o.direction)),
    ),
    field: action('Select parameter / media folder', [direction], (e, o) =>
      e.layerEdit === 'edit'
        ? e.adjustLayerTiming('move', Number(o.direction))
        : e.mediaMode
          ? e.selectMediaFolder(Number(o.direction))
          : e.selectLive('field', Number(o.direction)),
    ),
    value: action(
      'Adjust live value / preview media',
      [direction, numeric('step', 'Step override (0 = 0.1 / 0.01 / 0.001)', 0, 0)],
      (e, o) =>
        e.layerEdit === 'edit'
          ? e.adjustLayerTiming('out', Number(o.direction))
          : e.mediaMode
            ? e.browseMedia(Number(o.direction))
            : e.adjustLiveValue(Number(o.direction), Number(o.step)),
    ),
    time: action(
      'Scrub live / move selected key',
      [direction, numeric('step', 'Seconds override (0 = selected time step)', 0, 0)],
      (e, o) =>
        e.mediaMode || e.layerEdit === 'edit'
          ? undefined
          : e.adjustLiveTime(Number(o.direction), Number(o.step)),
      { scrub: true },
    ),
    fine: action('Cycle COARSE / FINE / ULTRA', [], (e) =>
      e.layerEdit === 'edit' ? e.cycleLayerStep() : e.mediaMode ? undefined : e.cyclePrecision(),
    ),
    seek: action('Jump Designer playhead to staged time', [], (e) => e.seek()),
    key_set: action('Add keyframe at playhead', [], (e) => e.writeLive('key_set')),
    value_press: action('Add numeric keyframe / confirm media and return', [], (e) => e.pressValue()),
    layer_edit: action('Open layer timing editor / return', [], (e) => e.toggleLayerEditor()),
    layer_press: action('Layer timing step / resource write mode', [], (e) =>
      e.layerEdit === 'edit' ? e.cycleLayerStep() : e.mediaMode ? e.toggleMediaKeyframe() : !e.moveKey && !e.layerEdit ? instance.viewer?.toggleZoom() : undefined,
    ),
    constant_set: action('Apply constant value (unsequenced parameter only)', [], (e) =>
      e.write('constant_set'),
    ),
    key_delete: action('Delete keyframe at playhead', [], (e) => e.writeLive('key_delete')),
    key: action('Jump to previous / next keyframe', [direction], (e, o) => e.keyLive(Number(o.direction))),
    time_step: action('Cycle time step / fit layer to content', [], (e) =>
      e.layerEdit === 'edit' ? e.fitLayerToContent() : e.mediaMode ? e.toggleMedia() : e.cycleTimeStep(),
    ),
    key_move: action('Select nearest keyframe / enable move mode', [], (e) => e.toggleMoveKey()),
    key_type: action('Cycle key interpolation', [], (e) => e.cycleKeyType()),
    media: action('Toggle resource browser', [], (e) => e.toggleMedia()),
    pad_down: action(
      'Context button press / hold DELETE KEY to clear all',
      [numeric('slot', 'Button position', 0, 0, 7)],
      (e, o) => e.padDown(Number(o.slot)),
    ),
    pad_up: action('Context button release', [numeric('slot', 'Button position', 0, 0, 7)], (e, o) =>
      e.padUp(Number(o.slot)),
    ),
    pad: action(
      'Context button: key tools / media thumbnails',
      [numeric('slot', 'Button position', 0, 0, 7)],
      (e, o) => e.pressPad(Number(o.slot)),
    ),
  }
}

function presets(label = 'd3layers') {
  const white = theme.text,
    blue = theme.surface
  const entry = (actionId, options = {}) => ({ actionId, options })
  const button = (name, text, down, rotate_left = [], rotate_right = []) => ({
    type: 'simple',
    name,
    // `this` is the button namespace in Companion 5, not this connection.
    style: { text: text.replaceAll('$(this:', `$(${label}:`), size: 'auto', color: white, bgcolor: blue },
    steps: [{ down, up: [], rotate_left, rotate_right }],
    feedbacks: [],
  })
  const p = {
    dial_layer: button(
      'Dial 1: layer (automatic sync)',
      'LAYER\n$(this:layer)',
      [entry('layer_press')],
      [entry('layer', { direction: -1 })],
      [entry('layer', { direction: 1 })],
    ),
    dial_field: button(
      'Dial 2: parameter / press for fine mode',
      'PARAM\n$(this:parameter)',
      [entry('fine')],
      [entry('field', { direction: -1 })],
      [entry('field', { direction: 1 })],
    ),
    dial_value: button(
      'Dial 3: edit selected key / press to add key',
      'VALUE\n$(this:value_label)',
      [entry('value_press')],
      [entry('value', { direction: -1, step: 0 })],
      [entry('value', { direction: 1, step: 0 })],
    ),
    dial_time: button(
      'Dial 4: live time / press for step',
      '$(this:time_step)\n$(this:timecode)',
      [entry('time_step')],
      [entry('time', { direction: -1, step: 0 })],
      [entry('time', { direction: 1, step: 0 })],
    ),
    key_set: button('Save keyframe', 'SAVE\nKEYFRAME', [entry('key_set')]),
    play_stop: button('Play to end of section / stop', '$(this:playback_label)', [entry('play_stop')]),
    constant_set: button('Apply constant parameter', 'APPLY\nCONSTANT', [entry('constant_set')]),
    key_delete: button('Delete selected keyframe', 'DELETE\nKEYFRAME', [entry('key_delete')]),
    key_prev: button('Previous keyframe', 'PREV\nKEYFRAME', [entry('key', { direction: -1 })]),
    key_next: button('Next keyframe', 'NEXT\nKEYFRAME', [entry('key', { direction: 1 })]),
    fine: button('Toggle fine mode', '$(this:step_mode)', [entry('fine')]),
    seek: button('Seek to cursor', 'GO TO\n$(this:timecode)', [entry('seek')]),
    connection: button(
      'Designer connection and live playhead',
      '$(this:connection_status)\n$(this:live_timecode)',
      [],
    ),
    brand: button('Disguise Layer Editor', 'DISGUISE\nLAYER\nEDITOR', []),
    key_move: button('Select / move keyframe', 'SELECT\nKEYFRAME', [entry('key_move')]),
    key_type: button('Keyframe interpolation', 'KEYFRAME TYPE\n$(this:key_type)', [entry('key_type')]),
    media: button('Resources and media', 'RESOURCES', [entry('media')]),
    layer_edit: button('Layer move / in / out', 'LAYER\nEDIT', [entry('layer_edit')]),
  }
  for (const [group, names] of Object.entries({
    navigation: ['key_prev', 'key_next'],
    keyEdit: ['key_move', 'key_delete', 'key_type', 'key_set'],
    layer: ['layer_edit'],
    playback: ['play_stop'],
    resources: ['media'],
  })) {
    for (const name of names) p[name].style.bgcolor = theme.groups[group]
  }
  for(let i=0;i<10;i++) {
    p['timing_'+i]=button('Adaptive timing step '+(i+1),'$(this:timing_step_'+i+')',[entry('time_step_set',{slot:i})])
    p['timing_'+i].feedbacks=[{feedbackId:'timing_step_selected',options:{slot:i},style:{bgcolor:theme.active}},{feedbackId:'timing_step_unavailable',options:{slot:i},style:{bgcolor:0,color:theme.secondary}}]
  }
  for(const [operation,text] of [['play','PLAY'],['playsection','PLAY\nTO END'],['playloopsection','PLAY\nLOOP'],['stop','STOP'],['toggle','PLAY /\nSTOP'],['gotoprevsection','PREV\nSECTION'],['gotonextsection','NEXT\nSECTION']]) {
    p['transport_'+operation]=button(text,text,[entry('transport',{operation})])
    p['transport_'+operation].style.bgcolor=theme.groups.playback
    if(['play','playsection','playloopsection','stop'].includes(operation)) p['transport_'+operation].feedbacks=[{feedbackId:'transport_state',options:{operation},style:{bgcolor:theme.active}}]
  }
  for (const operation of ['cut','merge']) p['section_'+operation]=button(operation+' section',operation.toUpperCase()+'\nSECTION',[entry('section_edit',{operation})])
  p.link_time=button('Link editing time to Designer','LINK\nTIME',[entry('link_time')])
  p.link_time.feedbacks=[{feedbackId:'link_time',options:{},style:{bgcolor:theme.active}}]
  p.connection.feedbacks = [{ feedbackId: 'connected', options: {}, style: { bgcolor: theme.active } }]
  p.fine.feedbacks = [{ feedbackId: 'fine', options: {}, style: { bgcolor: theme.active } }]
  p.dial_value.feedbacks = [{ feedbackId: 'dirty', options: {}, style: { bgcolor: theme.active } }]
  for (let slot = 0; slot < 8; slot++) {
    p[`pad_${slot}`] = button(`Live tool / media slot ${slot + 1}`, `$(this:pad_${slot})`, [
      entry('pad_down', { slot }),
    ])
    p[`pad_${slot}`].steps[0].up = [entry('pad_up', { slot })]
  }
  return [
    [
      {
        id: 'dials',
        name: 'Stream Deck + dials (left to right)',
        definitions: ['dial_layer', 'dial_field', 'dial_value', 'dial_time'],
      },
      {
        id: 'buttons',
        name: 'Live programming tools',
        definitions: [
          'key_prev',
          'key_next',
          'layer_edit',
          'play_stop',
          'key_move',
          'key_type',
          'key_delete',
          'media',
        ],
      },
      {
        id: 'context',
        name: 'Context buttons (left to right)',
        definitions: Array.from({ length: 8 }, (_, i) => `pad_${i}`),
      },
      {
        id: 'timing', name: 'Adaptive timing steps', definitions:Array.from({length:10},(_,i)=>'timing_'+i),
      },
      {
        id: 'transport', name:'Transport and time linking', definitions:['transport_gotoprevsection','transport_play','transport_playsection','transport_playloopsection','transport_stop','transport_gotonextsection','transport_toggle','link_time','section_cut','section_merge'],
      },
      {
        id: 'additional',
        name: 'Additional controls and status',
        definitions: ['key_set', 'constant_set', 'fine', 'seek', 'connection', 'brand'],
      },
    ],
    p,
  ]
}

module.exports = { actions, presets }
