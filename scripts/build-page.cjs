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
      options: {},
      isInverted: literal(false),
      upgradeIndex: -1,
      styleOverrides: [
        { overrideId: id(), elementId: 'box0', elementProperty: 'color', override: literal(f.style.bgcolor) },
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
    img.y = literal(33)
    img.height = literal(31)
    text.y = expression(`${isMedia} ? 65 : 10`)
    text.height = expression(`${isMedia} ? 34 : 80`)
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
    c.style.layers.push(folder)
    const kind = structuredClone(folder)
    kind.id = 'resource-kind'
    kind.name = 'Resource type without thumbnail'
    kind.text = literal(variable(`pad_kind_${i}`))
    kind.y = literal(35)
    kind.height = literal(27)
    kind.fontsize = literal(56)
    kind.color = literal(theme.secondary)
    c.style.layers.push(kind)
  }
  if (i === 3) {
    const showClock = variable('playing') + ' && ' + variable('ui_mode') + " == 'PARAMS'"
    text.y = expression(variable('ui_mode') + " == 'MEDIA' ? 65 : (" + showClock + ' ? 6 : 10)')
    text.height = expression(variable('ui_mode') + " == 'MEDIA' ? 34 : (" + showClock + ' ? 56 : 80)')
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
  title.fontsize = literal(theme.type.title)
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
  if (column === 1) {
    title.width = literal(86)
    const dot = structuredClone(title)
    dot.id = 'animated'
    dot.name = 'Parameter has keyframes'
    dot.text = literal('●')
    dot.x = literal(88)
    dot.width = literal(10)
    dot.fontsize = literal(theme.type.indicator)
    dot.color = literal(theme.keyframe)
    dot.enabled = expression(`${variable('parameter_animated')} && ${variable('ui_mode')} != 'MEDIA'`)
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
