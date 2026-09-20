const fs = require('node:fs')
const path = require('node:path')
const { presets } = require('../src/definitions')
const { version } = require('../package.json')
const theme = require('../src/theme')
const root = path.resolve(__dirname, '..')
const template = require('../templates/button-style.json')
const [, definitions] = presets('d3layers')
const connectionId = 'd3-layer-control'
let nextId = 0
const id = () => `d3-page-${++nextId}`
const literal = (value) => ({ value, isExpression: false })
function control(preset, notes = '') {
  const style = structuredClone(template)
  style.layers.find((l) => l.type === 'canvas').decoration = literal('none')
  const text = style.layers.find((l) => l.type === 'text')
  text.text = literal(preset.style.text)
  text.fontsize = literal(theme.type.button)
  style.layers.find((l) => l.type === 'box').color = literal(preset.style.bgcolor)
  const action_sets = Object.fromEntries(
    ['down', 'up', 'rotate_left', 'rotate_right'].map((event) => [
      event,
      (preset.steps[0][event] || []).map((a) => ({
        type: 'action',
        id: id(),
        connectionId,
        definitionId: a.actionId,
        options: Object.fromEntries(Object.entries(a.options).map(([k, v]) => [k, literal(v)])),
        upgradeIndex: -1,
      })),
    ]),
  )
  return {
    type: 'button-layered',
    style,
    options: {
      stepProgression: 'auto',
      stepExpression: '',
      rotaryActions: true,
      canModifyStyleInApis: false,
      notes,
    },
    steps: { 0: { action_sets, options: { runWhileHeld: [] } } },
    localVariables: [],
    feedbacks: preset.feedbacks.map((f) => ({
      type: 'feedback',
      id: id(),
      connectionId,
      definitionId: f.feedbackId,
      options: Object.fromEntries(Object.entries(f.options || {}).map(([key, value]) => [key, literal(value)])),
      isInverted: literal(false),
      upgradeIndex: -1,
      styleOverrides: [
        ...(f.style.bgcolor === undefined ? [] : [{ overrideId: id(), elementId: 'box0', elementProperty: 'color', override: literal(f.style.bgcolor) }]),
        ...(f.style.color === undefined ? [] : [{ overrideId: id(), elementId: text.id, elementProperty: 'color', override: literal(f.style.color) }]),
      ],
    })),
  }
}
const expression = (value) => ({ value, isExpression: true })
const variable = (name) => `$(d3layers:${name})`
const controls = { 0: {}, 1: {}, 2: {}, 3: {} }
for (let i = 0; i < 8; i++) {
  const c = control(
    definitions[`pad_${i}`],
    'Media: eight thumbnails. Dials: SOURCE / FOLDER / MEDIA (press to apply) / BACK (press to cancel).',
  )
  const bg = c.style.layers.find((l) => l.type === 'box')
  bg.color = expression(variable(`pad_color_${i}`))
  const text = c.style.layers.find((l) => l.type === 'text')
  text.fontsize = literal(theme.type.tool)
  text.color = literal(theme.text)
  text.y = literal(10)
  text.height = literal(80)
  const accent = structuredClone(bg)
  accent.id = 'brand-accent'
  accent.name = 'Editor accent'
  accent.height = literal(2)
  accent.color = literal(theme.accent)
  c.style.layers.push(accent)
  if (i < 8) {
    const isMedia = `${variable('ui_mode')} == 'MEDIA'`
    const img = c.style.layers.find((l) => l.type === 'image')
    img.base64Image = expression(variable(`pad_image_${i}`))
    img.enabled = expression(isMedia)
    img.y = literal(3)
    img.height = literal(36)
    text.y = expression(`${isMedia} ? 40 : 10`)
    text.height = expression(`${isMedia} ? 59 : 80`)
    text.fontsize = expression(`${isMedia} ? ${theme.type.mediaFile} : ${theme.type.tool}`)
    const folder = structuredClone(text)
    folder.id = 'folder'
    folder.name = 'Media folder'
    folder.enabled = expression(isMedia)
    folder.text = literal(variable(`pad_folder_${i}`))
    folder.y = literal(2)
    folder.height = literal(30)
    folder.fontsize = literal(theme.type.mediaFolder)
    folder.color = literal(theme.accent)
    const kind = structuredClone(folder)
    kind.id = 'resource-kind'
    kind.name = 'Resource type without thumbnail'
    kind.text = literal(variable(`pad_kind_${i}`))
    kind.y = literal(6)
    kind.height = literal(30)
    kind.fontsize = literal(56)
    kind.color = literal(theme.secondary)
    c.style.layers.push(kind)
  }
  if (i === 3) {
    const showClock = variable('playing') + ' && ' + variable('ui_mode') + " == 'PARAMS'"
    text.y = expression(variable('ui_mode') + " == 'MEDIA' ? 40 : (" + showClock + ' ? 6 : 10)')
    text.height = expression(variable('ui_mode') + " == 'MEDIA' ? 59 : (" + showClock + ' ? 56 : 80)')
    text.fontsize = expression(
      variable('ui_mode') +
        " == 'MEDIA' ? " +
        theme.type.mediaFile +
        ' : (' +
        showClock +
        ' ? 28 : ' +
        theme.type.tool +
        ')',
    )
    const clock = structuredClone(text)
    clock.id = 'play-clock'
    clock.name = 'Playback timecode'
    clock.enabled = expression(showClock)
    clock.text = literal(variable('timecode'))
    clock.y = literal(66)
    clock.height = literal(26)
    clock.fontsize = literal(48)
    clock.color = literal(theme.text)
    c.style.layers.push(clock)
    const heartbeat = structuredClone(clock)
    heartbeat.id = 'designer-heartbeat'
    heartbeat.name = 'Designer response heartbeat'
    heartbeat.enabled = expression(`${variable('ui_mode')} == 'PARAMS' && ${variable('heartbeat')}`)
    heartbeat.text = literal('●')
    heartbeat.x = literal(85)
    heartbeat.y = literal(3)
    heartbeat.width = literal(12)
    heartbeat.height = literal(14)
    heartbeat.fontsize = literal(80)
    heartbeat.color = literal(theme.keyframe)
    c.style.layers.push(heartbeat)
  }
  if (i === 5) {
    const showHint = `${variable('ui_mode')} == 'PARAMS' && ${variable('delete_hint')} != ''`
    text.height = expression(`${variable('ui_mode')} == 'MEDIA' ? 34 : (${showHint} ? 60 : 80)`)
    text.fontsize = expression(`${variable('ui_mode')} == 'MEDIA' ? ${theme.type.mediaFile} : (${showHint} ? ${theme.type.tool * 80 / 60} : ${theme.type.tool})`)
    const hint = structuredClone(text)
    hint.id = 'delete-hold-hint'
    hint.name = 'Hold one second to open delete all'
    hint.enabled = expression(showHint)
    hint.text = literal(variable('delete_hint'))
    hint.y = literal(70)
    hint.height = literal(25)
    hint.fontsize = literal(48)
    hint.color = expression(`${variable('delete_ready')} ? ${0xff6262} : ${theme.secondary}`)
    const ready = structuredClone(bg)
    ready.id = 'delete-ready'
    ready.name = 'Hold complete'
    ready.enabled = expression(`${showHint} && ${variable('delete_ready')}`)
    ready.y = literal(97)
    ready.height = literal(3)
    ready.color = literal(0xff6262)
    c.style.layers.push(hint, ready)
  }
  controls[Math.floor(i / 4)][i % 4] = c
}
;['dial_layer', 'dial_field', 'dial_value', 'dial_time'].forEach((name, column) => {
  const c = control(
    definitions[name],
    'LAYER EDIT: IN / POSITION (centre) / OUT / FIT (length). PARAMS: LAYER / PARAMETER / VALUE / TIME. MEDIA: SOURCE / FOLDER / MEDIA (rotate to preview, press to apply) / BACK (press to cancel).',
  )
  c.style.layers = c.style.layers.filter((l) => l.type !== 'image')
  c.style.layers.find((l) => l.type === 'box').color = literal(theme.background)
  const body = c.style.layers.find((l) => l.type === 'text')
  body.text = literal(variable(`dial_value_${column}`))
  body.y = literal(19)
  body.height = literal(40)
  body.fontsize = literal(theme.type.value)
  body.color = literal(theme.text)
  const title = structuredClone(body)
  title.id = 'title'
  title.name = 'Heading'
  title.y = literal(0)
  title.height = literal(18)
  title.fontsize = literal(column === 3 ? theme.type.timeTitle : theme.type.title)
  title.color = literal(theme.accent)
  title.text = literal(variable(`dial_title_${column}`))
  const detail = structuredClone(title)
  detail.id = 'detail'
  detail.name = 'Timing and limits'
  detail.y = literal(61)
  detail.height = literal(38)
  detail.fontsize = literal(theme.type.detail)
  detail.color = literal(theme.secondary)
  detail.text = literal(variable(`dial_info_${column}`))
  c.style.layers.push(title, detail)
  if (column === 0) {
    const showType = `${variable('ui_mode')} == 'PARAMS' && ${variable('layer_edit')} == 'SCRUB'`
    body.height = expression(`${showType} ? 24 : 40`)
    const type = structuredClone(title)
    type.id = 'layer-type'
    type.name = 'Friendly layer type'
    type.enabled = expression(showType)
    type.text = literal(variable('layer_type'))
    type.y = literal(43)
    type.height = literal(18)
    type.fontsize = literal(theme.type.title)
    type.color = literal(theme.accent)
    c.style.layers.push(type)
  }
  if (column === 1) {
    // Keep the PARAMETER heading and adjacent indicator centred on the LCD.
    const showKeyDot = `${variable('parameter_animated')} && ${variable('ui_mode')} == 'PARAMS' && ${variable('layer_edit')} == 'SCRUB'`
    title.x = expression(`${showKeyDot} ? 5 : 0`)
    title.width = expression(`${showKeyDot} ? 80 : 100`)
    const dot = structuredClone(title)
    dot.id = 'animated'
    dot.name = 'Parameter has keyframes'
    dot.text = literal('●')
    dot.x = literal(68)
    dot.width = literal(10)
    dot.fontsize = literal(theme.type.indicator)
    dot.color = literal(theme.keyframe)
    dot.enabled = expression(showKeyDot)
    c.style.layers.push(dot)
  }
  controls[2][column] = c
  controls[3][column] = control(
    definitions[name],
    'Physical encoder. Matching touchscreen display is on row 2.',
  )
})
controls[0][4] = control(
  definitions.connection,
  'Additional status display outside the four-column Stream Deck + area.',
)
const brand = control(definitions.brand, 'Disguise Layer Editor title. No control action.')
brand.style.layers.find((l) => l.type === 'box').color = literal(theme.black)
controls[0][5] = brand
const page = {
  version: 12,
  type: 'page',
  companionBuild: '5.0.5+9736-stable-0293f0d1ee',
  oldPageNumber: 2,
  page: {
    id: 'd3-streamdeck-plus-page',
    name: 'Disguise Layer Editor',
    controls,
    gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
  },
  instances: {
    [connectionId]: {
      moduleInstanceType: 'connection',
      moduleId: 'disguise-layer-control',
      moduleVersionId: version,
      updatePolicy: 'manual',
      sortOrder: 0,
      label: 'd3layers',
      isFirstInit: true,
      config: { host: '127.0.0.1', port: 80, demo: false },
      lastUpgradeIndex: -1,
      enabled: true,
    },
  },
  connectionCollections: [],
  imageLibrary: [],
  imageLibraryCollections: [],
}
const output = path.join(root, 'D3-Stream-Deck-Plus.companionconfig')
fs.writeFileSync(output, JSON.stringify(page, null, 2) + '\n')
console.log(`Companion page: ${output}`)

// XL is generated from the same action presets, font and feedback definitions.
// Keep controls in five-column groups; the right-hand status column stays separate.
const xl = structuredClone(page)
xl.page.id = 'd3-streamdeck-xl-page'
xl.page.name = 'Disguise Layer Editor XL'
xl.oldPageNumber = 5
xl.page.controls = { 0: {}, 1: {}, 2: {}, 3: {} }
function xlButton(preset, notes, fontSize = 25) {
  const button = control(preset, notes)
  button.style.layers = button.style.layers.filter(layer => layer.type !== 'image')
  const text = button.style.layers.find(layer => layer.type === 'text')
  text.y = literal(10)
  text.height = literal(80)
  text.fontsize = literal(fontSize)
  const accent = structuredClone(button.style.layers.find(layer => layer.type === 'box'))
  accent.id = 'xl-accent'
  accent.name = 'Editor accent'
  accent.height = literal(2)
  accent.color = literal(theme.accent)
  button.style.layers.push(accent)
  return button
}
for (let slot = 0; slot < 10; slot++) {
  xl.page.controls[Math.floor(slot / 5)][slot % 5] = xlButton(
    definitions['timing_' + slot], 'Select the shared time/beat step. Highlight = selected. Dash = unavailable.',
  )
}

// A conventional keypad occupies the rightmost three columns.
const keypad = [ ['7','8','9'], ['4','5','6'], ['1','2','3'], ['back','0','go'] ]
for (let row=0;row<4;row++) for(let col=0;col<3;col++) {
  const key=keypad[row][col]
  const text=key==='back' ? 'BACK' : key==='go' ? 'JUMP' : key
  const preset={style:{text,bgcolor:key==='go'?theme.active:theme.background},steps:[{down:[{actionId:'time_keypad',options:{key}}],up:[],rotate_left:[],rotate_right:[]}],feedbacks:[]}
  xl.page.controls[row][col+5]=xlButton(preset,'Enter HH:MM:SS:FF; colons and leading zeros are automatic. JUMP moves the active clock. BACK removes one digit.', /^\d$/.test(key) ? 60 : 25)
}
for(const [column,operation] of ['gotoprevsection','gotonextsection'].entries())
  xl.page.controls[2][column]=xlButton(definitions['transport_'+operation],'Go to previous/next section in Designer.')
xl.page.controls[2][2]=xlButton(definitions.section_cut,'Cut section at active edit time; layer content stays intact.')
xl.page.controls[2][3]=xlButton(definitions.section_merge,'Merge current section with previous; preserve notes and tags.')
const timeEntry={style:{text:'$(d3layers:time_entry)',bgcolor:theme.background},steps:[{down:[{actionId:'time_keypad',options:{key:'clear'}}],up:[],rotate_left:[],rotate_right:[]}],feedbacks:[]}
const entryButton=xlButton(timeEntry,'Entered time, or current edit time when empty. Press to clear the entry. LINK TIME chooses the real or blue editing clock.')
entryButton.style.layers.find(l=>l.type==='text').fontsize=literal(17)
entryButton.style.layers.find(l=>l.type==='box').color=expression(variable('time_entry_active')+' ? '+theme.active+' : '+theme.background)
xl.page.controls[2][4]=entryButton
for(const [column,operation] of ['play','playsection','playloopsection','stop'].entries())
  xl.page.controls[3][column]=xlButton(definitions['transport_'+operation],'Designer transport. Highlight = active play mode or stopped.')
xl.page.controls[3][4]=xlButton(definitions.link_time,'Link editing to Designer time. Highlight = linked.')
const xlOutput = path.join(root, 'D3-Stream-Deck-XL.companionconfig')
fs.writeFileSync(xlOutput, JSON.stringify(xl, null, 2) + '\n')
console.log(`Companion XL page: ${xlOutput}`)
