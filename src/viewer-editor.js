'use strict'
const { createHash } = require('node:crypto')
const { actions } = require('./definitions')

// The browser is another controller for Editor, never a second editor. Only
// persisted Companion action IDs below are exposed; no native command is accepted.
const commands = new Set([
  'layer',
  'field',
  'value',
  'time',
  'fine',
  'value_press',
  'layer_edit',
  'layer_press',
  'time_step',
  'key_move',
  'key_type',
  'media',
  'key',
  'pad',
  'clear_menu',
  'resource_folder',
  'resource_choose',
])
const directional = new Set(['layer', 'field', 'value', 'time', 'key'])

function describeEditor(editor) {
  const items = editor.mediaMode ? editor.mediaItems : []
  const currentMedia = items[editor.mediaIndex]
  const state = {
    trackUid: editor.snapshot?.trackUid,
    layerUid: editor.layer?.uid,
    parameter: editor.mediaMode ? editor.mediaField?.name : editor.field?.name,
    layerEdit: editor.layerEdit || '',
    moveKey: editor.moveKey || null,
    selectedKeyTime: editor.selectedKeyTime,
    mediaMode: editor.mediaMode,
    mediaKeyframe: editor.mediaKeyframe,
    timeStep: editor.timeStepLabel,
    precision: editor.precision,
    canSelectKey: editor.canSelectKey,
    canResetDefault: editor.canResetDefault,
    keyType: editor.selectedKey?.interpolation ?? null,
    folder: editor.mediaFolder,
    folders: editor.mediaMode ? editor.mediaFolders : [],
    resource: currentMedia?.name || '',
    resourceSource: editor.mediaField?.label || editor.mediaField?.name || '',
    resourcePage: editor.mediaPage,
    resourcePages: Math.ceil(items.length / 8),
    resourceCount: items.length,
    resourceRevision: editor.mediaLibraryRevision || 0,
    resources: editor.mediaMode
      ? items
          .slice(editor.mediaPage * 8, editor.mediaPage * 8 + 8)
          .map((item, slot) => ({
            slot,
            uid: item.uid,
            name: item.name,
            thumbnail: item.thumbnail !== false,
            selected: item.uid === currentMedia?.uid,
          }))
      : [],
    clearMenu: Boolean(editor.clearKeysBrowser),
    clearPrompt: Boolean(editor.clearKeysPrompt),
    clearLabel:
      editor.clearKeysPrompt?.label ||
      editor.clearKeysBrowser?.items[editor.clearKeysBrowser.index]?.label ||
      '',
  }
  // Include edit targets and step settings, but not the continuously moving
  // playhead. A newer Deck command or native geometry/value invalidates a gesture.
  state.token = createHash('sha256')
    .update(
      JSON.stringify([
        state,
        editor.layer?.start,
        editor.layer?.end,
        editor.field?.sequenced,
        editor.field?.keys?.length,
        editor.selectedKey,
        editor.field?.sequenced ? undefined : editor.field?.value,
        editor.mediaIndex,
        editor.mediaPage,
        editor.clearKeysPrompt,
        editor.clearKeysBrowser?.index,
      ]),
    )
    .digest('hex')
  return state
}

function validEditRequest(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    commands.has(value.action) &&
    typeof value.token === 'string' &&
    /^[a-f0-9]{64}$/.test(value.token) &&
    Object.keys(value).every((key) =>
      ['action', 'token', 'direction', 'slot', 'type', 'index', 'resourceUid'].includes(key),
    ) &&
    (value.action === 'resource_choose'
      ? typeof value.resourceUid === 'string' && value.resourceUid.length <= 80
      : value.resourceUid === undefined) &&
    (['resource_folder', 'resource_choose'].includes(value.action)
      ? Number.isInteger(value.index) && value.index >= 0 && value.index <= 100000
      : value.index === undefined) &&
    (value.type === undefined || (value.action === 'key_type' && [0, 1, 2].includes(value.type))) &&
    (directional.has(value.action) ? [1, -1].includes(value.direction) : value.direction === undefined) &&
    (value.action === 'pad'
      ? Number.isInteger(value.slot) && value.slot >= 0 && value.slot <= 7
      : value.slot === undefined),
  )
}

async function editFromViewer(editor, request) {
  if (!validEditRequest(request)) return { ok: false, reason: 'INVALID EDIT REQUEST' }
  if (request.token !== describeEditor(editor).token)
    return { ok: false, reason: 'SELECTION OR VALUE CHANGED — TRY AGAIN' }
  // The caller owns the real Companion queue. This adapter executes exactly one
  // normal action, including its menu, locking, precision and beat/frame policy.
  const sharedActions = actions({ perform: (fn) => fn(editor) })
  if (request.action === 'resource_choose') {
    const item = editor.mediaItems[request.index]
    if (!editor.mediaMode || !item || item.uid !== request.resourceUid)
      return { ok: false, reason: 'RESOURCE LIST CHANGED — REOPEN RESOURCES' }
    await editor.setMedia(request.index)
    return { ok: true, editor: describeEditor(editor) }
  }
  if (request.action === 'resource_folder') {
    const folders = editor.mediaFolders
    if (!editor.mediaMode || request.index >= folders.length)
      return { ok: false, reason: 'FOLDER IS NO LONGER AVAILABLE' }
    // Browse the same in-memory folder list as the second Companion encoder.
    // No client-supplied filesystem path is accepted or opened.
    while (editor.mediaFolder !== folders[request.index]) editor.selectMediaFolder(1)
    return { ok: true, editor: describeEditor(editor) }
  }
  if (request.action === 'clear_menu') {
    await editor.openClearKeys()
    return { ok: true, editor: describeEditor(editor) }
  }
  if (request.action === 'key_type' && request.type !== undefined) {
    if (editor.clearKeysBrowser || editor.mediaMode)
      return { ok: false, reason: 'CLOSE THE RESOURCE OR DELETE MENU FIRST' }
    await editor.cycleKeyType(request.type)
    return { ok: true, editor: describeEditor(editor) }
  }
  await sharedActions[request.action].callback({
    options: {
      direction: request.direction,
      slot: request.slot,
      step: 0,
    },
  })
  return { ok: true, editor: describeEditor(editor) }
}

function resourceList(editor, offset = 0) {
  if (!editor.mediaMode) return { items: [], total: 0 }
  const items = editor.mediaItems
  return {
    source: editor.mediaField?.name,
    folder: editor.mediaFolder,
    total: items.length,
    revision: editor.mediaLibraryRevision || 0,
    items: items
      .slice(offset, offset + 64)
      .map((item, i) => ({
        index: offset + i,
        uid: item.uid,
        name: item.name,
        thumbnail: item.thumbnail !== false,
        duration: item.duration,
        fps: item.fps,
        audio: item.audio,
        alpha: item.alpha,
        codec: item.codec,
        version: item.version,
        resourceType: item.resourceType,
      })),
  }
}

module.exports = { describeEditor, validEditRequest, editFromViewer, resourceList }
