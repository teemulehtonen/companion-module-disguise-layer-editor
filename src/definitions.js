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
const detentSensitivity = [
  { type: 'number', id: 'detent_divisor', label: 'Physical detents per step', default: 1, min: 1, max: 8, step: 1 },
  { type: 'number', id: 'detent_group', label: 'Physical encoder group', default: 0, min: 0, max: 64, step: 1 },
]

function scaleDialInput(instance, name, event) {
  const direction = Number(event.options.direction)
  if (direction !== -1 && direction !== 1) return null
  const divisor = Math.max(1, Math.min(8, Math.round(Number(event.options.detent_divisor) || 1)))
  if (divisor === 1) return direction
  const group = Math.max(0, Math.min(64, Math.round(Number(event.options.detent_group) || 0)))
  const identity = { ...event.options }
  delete identity.direction
  delete identity.detent_divisor
  delete identity.detent_group
  const key = `${name}:${group}:${JSON.stringify(identity)}`
  const remainders = instance.dialDetentRemainders || (instance.dialDetentRemainders = new Map())
  const total = (remainders.get(key) || 0) + direction
  const steps = total < 0 ? Math.ceil(total / divisor) : Math.floor(total / divisor)
  const remainder = total - steps * divisor
  if (remainder) remainders.set(key, remainder)
  else remainders.delete(key)
  return steps ? Math.sign(steps) : null
}

function actions(instance) {
  // These IDs are persisted in Companion exports. Keep legacy actions available
  // even when the current page no longer shows their old GO/APPLY buttons.
  const action = (name, options, fn, queueOptions) => ({
    name,
    options,
    callback: (event) => {
      const dial=['Select active layer','Select parameter / media folder','Adjust live value / preview media','Scrub live / move selected key'].includes(name)
      const e=instance.editor
      const dialDirection = dial ? scaleDialInput(instance, name, event) : null
      if (dial && dialDirection === null) return
      const batch=dial && !e?.parameterBrowser && !e?.layerBrowser && !e?.mediaMode && !e?.clearKeysBrowser && instance.performDetents
      const dispatch=(editor,o) => {
        if (editor.layerBrowser) {
          const slot = {'Open layer list / timing step / resource write mode':8,'Open parameter list / select parameter':9,
            'Value press: precision / context':10,'Cycle time step / fit layer to content':11}[name]
          if (slot !== undefined) return editor.selectLayerSlot(slot)
          if (name === 'Select active layer') return editor.pageLayers(dialDirection)
          if (name === 'Select layer list slot') return editor.selectLayerSlot(Number(o.slot)-1)
          if (name.startsWith('Context button')) return fn(editor,o)
          // All twelve displays are selectors. Other editing controls are inert
          // until a layer is chosen; transport controls remain available.
          if (name !== 'Transport control') return
        }
        if (editor.parameterBrowser) {
          const slot = {'Open layer list / timing step / resource write mode':8,'Open parameter list / select parameter':9,
            'Value press: precision / context':10,'Cycle time step / fit layer to content':11}[name]
          if (slot !== undefined) return editor.selectParameterSlot(slot)
          if (name === 'Select parameter / media folder') return editor.pageParameters(dialDirection)
          if (dial) return
        }
        if (editor.viewOnly) {
          const browsing = ['Time keypad','Select adaptive timing step','Read layers and values from Designer',
            'Select active layer','Select parameter / media folder','Scrub live / move selected key',
            'Cycle COARSE / FINE / ULTRA','Open parameter list / select parameter','Select parameter list slot','Value press: precision / context','Jump Designer playhead to staged time',
            'Open layer list / timing step / resource write mode','Jump to previous / next keyframe',
            'Cycle time step / fit layer to content','Toggle resource browser']
          const preview = name === 'Adjust live value / preview media' && editor.mediaMode
          if (!browsing.includes(name) && !preview && !name.startsWith('Context button')) return
        }
        if (editor.clearKeysBrowser && !name.startsWith('Context button') && name !== 'Transport control') {
          const id = {
            'Select parameter / media folder': 'field',
            'Cycle COARSE / FINE / ULTRA': 'fine',
            'Open parameter list / select parameter': 'fine',
            'Value press: precision / context': 'value_press',
            'Add numeric keyframe / confirm media and return': 'value_press',
            'Cycle time step / fit layer to content': 'time_step',
            'Toggle resource browser': 'media',
            'Open layer timing editor / return': 'layer_edit',
          }[name]
          return editor.handleClearKeysAction(id, event.options)
        }
        // Leaving the confirmation through any dial/tool cancels it, never hides it.
        if (!name.startsWith('Context button')) editor.clearKeysPrompt = null
        return fn(editor,o)
      }
      if(batch) {
        const identity={...event.options};delete identity.direction
        return instance.performDetents(name+JSON.stringify(identity),dialDirection,
          (editor,direction,detents)=>dispatch(editor,{...event.options,direction,detents}),queueOptions)
      }
      return instance.perform(editor=>dispatch(editor,{...event.options,detents:1}),queueOptions)
    },
  })
  return {
    // Keep this persisted ID for existing CC1 pages; no web viewer is included.
    viewer_zoom: {
      name: 'Zoom Designer timeline',
      options: [direction, ...detentSensitivity],
      callback: (event) => {
        if (instance.editor?.layerBrowser) return
        const direction = scaleDialInput(instance, 'Zoom Designer timeline', event)
        if (direction === null) return
        instance.publish?.()
        return instance.zoomDesignerTimeline?.(direction * Math.max(1, Math.round(Number(event.options.detents) || 1)))
      },
    },
    navigation_toggle: {
      name: 'Toggle track / section navigation', options: [],
      callback: () => instance.toggleTrackNavigation(),
    },
    transport_master_refresh: {
      name: 'Refresh transport list and variables',
      options: [],
      callback: () => instance.refreshMasterTransports(),
    },
    transport_master_select: {
      name: 'Select transport / OSC target for master fader',
      options: [direction],
      callback: (event) => instance.selectMasterTransport?.(Number(event.options.direction)),
    },
    transport_master_select_slot: {
      name: 'Select transport / OSC slot for master fader',
      options: [numeric('slot', 'Target slot (1–16)', 1, 1, 16)],
      callback: (event) => instance.selectMasterTransportSlot?.(Number(event.options.slot) - 1),
    },
    fader_mode_toggle: {
      name: 'Toggle fader: master / selected parameter', options: [],
      callback: () => instance.toggleParameterFader?.(),
    },
    transport_master_level: {
      name: 'Set selected fader target (transport / OSC / parameter)',
      options: [{type:'number',id:'level',label:'Master level (0–100)',default:100,min:0,max:100,step:0.1,useVariables:true}],
      callback: (event) => instance.setTransportMasterLevel?.(event.options.level),
    },
    time_keypad: action('Time keypad', [{type:'dropdown',id:'key',label:'Key',default:'go',choices:[...Array.from({length:10},(_,i)=>({id:String(i),label:String(i)})),{id:'back',label:'Backspace'},{id:'clear',label:'Clear'},{id:'go',label:'Jump'}]}], (e,o)=>e.enterTime(o.key), {synchronise:false}),
    time_step_set: action('Select adaptive timing step', [numeric('slot','Step slot (0–9)',0,0,9)], (e,o)=>e.setTimeStep(Number(o.slot))),
    transport: action('Transport control', [{type:'dropdown',id:'operation',label:'Operation',default:'play',choices:[{id:'play',label:'Play'},{id:'playsection',label:'Play to end of section'},{id:'playloopsection',label:'Play loop section'},{id:'stop',label:'Stop'},{id:'toggle',label:'Play / stop (last mode)'},{id:'gotoprevsection',label:'Previous section'},{id:'gotonextsection',label:'Next section'},{id:'gotoprevtrack',label:'Previous track'},{id:'gotonexttrack',label:'Next track'}]}], (e,o)=>e.controlTransport(o.operation)),
    section_edit: action('Cut / merge section at active edit time', [{type:'dropdown',id:'operation',label:'Operation',default:'cut',choices:[{id:'cut',label:'Cut section'},{id:'merge',label:'Merge with previous section'}]}], (e,o)=>e.editSection(o.operation)),
    refresh: action('Read layers and values from Designer', [], (e) => e.refresh()),
    link_time: action('Toggle playhead follow while editing', [], (e) => e.setLinkTime(!e.linkTime)),
    jog_lock: {
      name: 'Toggle jog wheel lock',
      options: [],
      callback: () => instance.toggleJogLock?.(),
    },
    play_stop: action('Play to end of section / stop', [], (e) => e.togglePlayback()),
    layer: action('Select active layer', [direction, ...detentSensitivity], (e, o) =>
      e.layerEdit === 'edit'
        ? e.adjustLayerTiming('in', Number(o.direction),{detents:o.detents})
        : e.mediaMode
          ? e.selectMediaField(Number(o.direction))
            : e.selectLive('layer', Number(o.direction), o.detents),
    ),
    field: action('Select parameter / media folder', [direction, ...detentSensitivity], (e, o) =>
      e.layerEdit === 'edit'
        ? e.adjustLayerTiming('move', Number(o.direction),{detents:o.detents})
        : e.mediaMode
          ? e.selectMediaFolder(Number(o.direction))
          : e.selectLive('field', Number(o.direction), o.detents),
    ),
    value: action(
      'Adjust live value / preview media',
      [direction, ...detentSensitivity, numeric('step', 'Step override (0 = 1% / 0.1% / 0.01% of range)', 0, 0)],
      (e, o) =>
        e.layerEdit === 'edit'
          ? e.adjustLayerTiming('out', Number(o.direction),{detents:o.detents})
          : e.mediaMode
            ? e.browseMedia(Number(o.direction))
            : e.adjustLiveValue(Number(o.direction)*(o.detents || 1), Number(o.step)),
    ),
    time: action(
      'Scrub live / move selected key',
      [direction, ...detentSensitivity, numeric('step', 'Seconds override (0 = selected time step)', 0, 0)],
      (e, o) =>
        instance.jogLocked || e.mediaMode || e.layerEdit === 'edit'
          ? undefined
          : e.adjustLiveTime(Number(o.direction), Number(o.step),{detents:o.detents}),
      { scrub: true },
    ),
    fine: action('Cycle COARSE / FINE / ULTRA', [], (e) =>
      e.layerEdit === 'edit' ? e.cycleLayerStep() : e.mediaMode ? undefined : e.cyclePrecision(),
    ),
    seek: action('Jump Designer playhead to staged time', [], (e) => e.seek()),
    key_set: action('Add keyframe at playhead', [], (e) => e.writeLive('key_set')),
    layer_slot: action('Select layer list slot', [numeric('slot','Layer slot (1–12)',1,1,12)], (e,o) => e.layerBrowser ? e.selectLayerSlot(Number(o.slot)-1) : undefined),
    parameter_slot: action('Select parameter list slot', [numeric('slot','Parameter slot (1–12)',1,1,12)], (e,o) => e.parameterBrowser ? e.selectParameterSlot(Number(o.slot)-1) : undefined),
    parameter_press: action('Open parameter list / select parameter', [], (e) =>
      e.layerEdit === 'edit' ? e.cycleLayerStep() : e.toggleParameterBrowser()),
    value_press: action('Value press: precision / context', [], (e) =>
      e.viewOnly && e.mediaMode ? undefined : e.layerEdit || e.mediaMode || e.field?.resource ? e.pressValue() : e.cyclePrecision()),
    layer_edit: action('Open layer timing editor / return', [], (e) => e.toggleLayerEditor()),
    layer_press: action('Open layer list / timing step / resource write mode', [], (e) =>
      e.layerEdit === 'edit' ? e.cycleLayerStep() : e.mediaMode ? e.toggleMediaKeyframe() : e.toggleLayerBrowser(),
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
  const dialEntry = (actionId, direction, options = {}) => entry(actionId, { direction, detent_divisor: 1, detent_group: 0, ...options })
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
      [dialEntry('layer', -1)],
      [dialEntry('layer', 1)],
    ),
    dial_field: button(
      'Dial 2: parameter / press for parameter list',
      'PARAM\n$(this:parameter)',
      [entry('parameter_press')],
      [dialEntry('field', -1)],
      [dialEntry('field', 1)],
    ),
    dial_value: button(
      'Dial 3: edit selected key / press for precision',
      'VALUE\n$(this:value_label)',
      [entry('value_press')],
      [dialEntry('value', -1, { step: 0 })],
      [dialEntry('value', 1, { step: 0 })],
    ),
    dial_time: button(
      'Dial 4: live time / press for step',
      '$(this:time_step)\n$(this:timecode)',
      [entry('time_step')],
      [dialEntry('time', -1, { step: 0 })],
      [dialEntry('time', 1, { step: 0 })],
    ),
    dial_zoom: button(
      'Dial 5: Designer timeline zoom',
      'ZOOM\nVIEWER',
      [],
      [dialEntry('viewer_zoom', -1)],
      [dialEntry('viewer_zoom', 1)],
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
    master_refresh: button('Refresh transport list and variables', 'REFRESH\nTRANSPORTS', [entry('transport_master_refresh')]),
    master_prev: button('Previous master-fader target', 'MASTER ◀\n$(this:master_transport)', [entry('transport_master_select',{direction:-1})]),
    master_next: button('Next master-fader target', 'MASTER ▶\n$(this:master_transport)', [entry('transport_master_select',{direction:1})]),
    master_zero: button('Set selected transport master to zero', 'MASTER\n0%', [entry('transport_master_level',{level:0})]),
    master_full: button('Set selected transport master to full', 'MASTER\n100%', [entry('transport_master_level',{level:100})]),
    fader_mode: button('Toggle fader: master / selected parameter', 'FADER\n$(this:fader_mode)', [entry('fader_mode_toggle')]),
    master_status: button('Selected master-fader target', '$(this:master_transport)\n$(this:fader_value_label)', []),
    jog_lock: button('Lock or unlock jog wheel', 'JOG\n$(this:jog_lock_label)', [entry('jog_lock')]),
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
  for(const [operation,text] of [['play','PLAY'],['playsection','PLAY\nTO END'],['playloopsection','PLAY\nLOOP'],['stop','STOP'],['toggle','PLAY /\nSTOP'],['gotoprevsection','PREV\nSECTION'],['gotonextsection','NEXT\nSECTION'],['gotoprevtrack','PREV\nTRACK'],['gotonexttrack','NEXT\nTRACK']]) {
    p['transport_'+operation]=button(text,text,[entry('transport',{operation})])
    p['transport_'+operation].style.bgcolor=theme.groups.playback
    if(['play','playsection','playloopsection','stop'].includes(operation)) p['transport_'+operation].feedbacks=[{feedbackId:'transport_state',options:{operation},style:{bgcolor:theme.active}}]
  }
  for (const operation of ['cut','merge']) p['section_'+operation]=button(operation+' section',operation.toUpperCase()+'\nSECTION',[entry('section_edit',{operation})])
  p.link_time=button('Link editing time to Designer','LINK\nTIME',[entry('link_time')])
  p.link_time.feedbacks=[{feedbackId:'link_time',options:{},style:{bgcolor:theme.active}}]
  p.jog_lock.feedbacks=[{feedbackId:'jog_locked',options:{},style:{bgcolor:theme.danger}}]
  for(let slot=1;slot<=16;slot++) {
    p['master_transport_'+slot]=button(slot <= 8 ? 'Select transport '+slot : 'Select OSC fader '+(slot-8),'$(this:master_transport_'+slot+')',[entry('transport_master_select_slot',{slot})])
    p['master_transport_'+slot].feedbacks=[{feedbackId:'transport_master_selected',options:{slot},style:{bgcolor:theme.active}}]
  }
  p.navigation_toggle = button('Toggle TRACK / SECTION navigation', 'NAV\n$(this:navigation_mode)', [entry('navigation_toggle')])
  p.fader_mode.feedbacks = [{feedbackId:'fader_parameter',options:{},style:{bgcolor:0xc00000}}]
  p.navigation_toggle.feedbacks = [{feedbackId:'navigation_track',options:{},style:{bgcolor:theme.active}}]
  for (const [name, operation, text] of [
    ['previous', 'gotoprevtrack', 'PREV'], ['next', 'gotonexttrack', 'NEXT'],
  ]) {
    p['navigation_' + name] = button(text + ' track / section', text + '\n$(this:navigation_mode)', [{
      actionId: 'internal:logicIf', options: {},
      headline: 'TRACK enabled: change track. Otherwise: change section.',
      children: {
        condition: [{feedbackId: 'navigation_track', options: {}}],
        actions: [entry('transport', {operation})],
        elseActions: [entry('transport', {operation: operation === 'gotoprevtrack' ? 'gotoprevsection' : 'gotonextsection'})],
      },
    }])
  }
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
        id: 'navigation', name:'Track / section navigation', definitions:['navigation_toggle','navigation_previous','navigation_next'],
      },
      {
        id: 'transport', name:'Transport and time linking', definitions:['transport_gotoprevtrack','transport_gotoprevsection','transport_play','transport_playsection','transport_playloopsection','transport_stop','transport_gotonextsection','transport_gotonexttrack','transport_toggle','link_time','section_cut','section_merge'],
      },
      {
        id: 'additional',
        name: 'Additional controls and status',
        definitions: ['key_set', 'constant_set', 'fine', 'seek', 'connection', 'brand', 'dial_zoom'],
      },
      {
        id: 'master',
        name: 'CC1 fader: transports / OSC / parameter',
        definitions: ['fader_mode','master_refresh','master_prev','master_next','master_zero','master_full','master_status',...Array.from({length:16},(_,i)=>'master_transport_'+(i+1))],
      },
      {
        id: 'safety',
        name: 'Safety locks',
        definitions: ['jog_lock'],
      },
    ],
    p,
  ]
}

module.exports = { actions, presets }
