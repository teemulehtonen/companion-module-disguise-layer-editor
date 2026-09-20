'use strict'
const { curvePreviewDue } = require('./viewer-curve-preview')
const { createHash } = require('node:crypto')
const { actions } = require('./definitions')
const { absoluteTimecode } = require('./timecode')

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
  'key_delete',
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
    playing: Boolean(editor.playing),
    playbackMode: editor.lastPlaybackMode || 'playsection',
    linkTime: Boolean(editor.linkTime),
    editTime: editor.time,
    editTimecode: editor.linkTime ? '' : absoluteTimecode(editor.time,editor.snapshot?.fps || 25,false,editor.timecodeSamples,editor.liveTimecodeSample),
    trackUid: editor.snapshot?.trackUid,
    layerUid: editor.layer?.uid,
    layerStart: editor.layer?.start,
    layerEnd: editor.layer?.end,
    parameter: editor.mediaMode ? editor.mediaField?.name : editor.field?.name,
    layerEdit: editor.layerEdit || '',
    moveKey: editor.moveKey || null,
    selectedKeyTime: editor.selectedKeyTime,
    mediaMode: editor.mediaMode,
    mediaKeyframe: editor.mediaKeyframe,
    mediaKeyTime: editor.mediaKeyframe ? editor.mediaKeyTime : null,
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
        {...state,playing:undefined,editTime:editor.linkTime ? undefined : editor.time},
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

function validGrid(grid) {
  return grid === undefined || Boolean(grid && ['beat','second'].includes(grid.unit) &&
    Number.isFinite(grid.step) && grid.step > 0 && grid.step <= 3600 &&
    Number.isSafeInteger(grid.index) && grid.index >= 0 && grid.index <= 1e12 &&
    Object.keys(grid).every(key=>['unit','step','index'].includes(key)))
}
function validEditRequest(value) {
  if (value?.action === 'transport') return /^[a-f0-9]{64}$/.test(value.token || '') && ['play','playsection','playloopsection','stop','toggle','gotonextsection','gotoprevsection'].includes(value.operation) && Object.keys(value).every(k=>['action','token','operation'].includes(k))
  if (value?.action === 'link_time') return typeof value.enabled === 'boolean' && /^[a-f0-9]{64}$/.test(value.token || '') && Object.keys(value).every(k => ['action','token','enabled'].includes(k))
  if(value && Object.hasOwn(value,'keepPlayhead')) {
    const {keepPlayhead,...command}=value
    return typeof keepPlayhead==='boolean' && validEditRequest(command)
  }
  if (value?.action === 'layer_reorder') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') && /^\d+$/.test(value.trackUid || '') && /^\d+$/.test(value.layerUid || '') &&
    /^\d+$/.test(value.targetUid || '') && value.targetUid!==value.layerUid && typeof value.after==='boolean' &&
    Array.isArray(value.expectedOrder) && value.expectedOrder.length<=10000 && value.expectedOrder.every(uid=>typeof uid==='string' && /^\d+$/.test(uid)) &&
    Object.keys(value).every(k=>['action','token','trackUid','layerUid','targetUid','after','expectedOrder'].includes(k)))
  if (value?.action === 'layer_manage') {
    const base = /^[a-f0-9]{64}$/.test(value.token || '') && /^\d+$/.test(value.trackUid || '')
    if (value.operation === 'create') return Boolean(base && ['video','audio','bitmap'].includes(value.kind) &&
      Number.isFinite(value.targetTime) && value.targetTime>=0 && value.targetTime<=1e8 &&
      Object.keys(value).every(k=>['action','token','trackUid','operation','kind','targetTime'].includes(k)))
    return Boolean(base && ['rename','duplicate','delete','fit'].includes(value.operation) && /^\d+$/.test(value.layerUid || '') &&
      typeof value.expectedName==='string' && Number.isFinite(value.expectedStart) && Number.isFinite(value.expectedEnd) &&
      (value.operation==='rename' ? typeof value.name==='string' && value.name.trim().length>0 && value.name.length<=128 && !/[\x00-\x1f]/.test(value.name) : value.name===undefined) &&
      Object.keys(value).every(k=>['action','token','trackUid','layerUid','operation','name','expectedName','expectedStart','expectedEnd'].includes(k)))
  }
  if (value?.action === 'value_set') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') && Number.isFinite(value.targetValue) &&
    Math.abs(value.targetValue)<=1e12 && Number.isFinite(value.expectedValue) &&
    Object.keys(value).every(key=>['action','token','targetValue','expectedValue'].includes(key)))
  if (value?.action === 'key_insert') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') && /^\d+$/.test(value.trackUid || '') && /^\d+$/.test(value.layerUid || '') &&
    typeof value.parameter === 'string' && value.parameter.length>0 && value.parameter.length<=256 &&
    Number.isFinite(value.targetTime) && value.targetTime>=0 && value.targetTime<=1e8 &&
    Object.keys(value).every(key=>['action','token','trackUid','layerUid','parameter','targetTime'].includes(key)))
  if (value?.action === 'drag_value') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') && Number.isFinite(value.targetValue) &&
    Math.abs(value.targetValue) <= 1e12 && Object.keys(value).every(key=>['action','token','targetValue'].includes(key)))
  if (value?.action === 'drag_time') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') &&
    ['in','move','out','key'].includes(value.mode) && Number.isFinite(value.targetTime) &&
    Math.abs(value.targetTime) <= 1e8 && typeof value.snap === 'boolean' &&
    (value.snapOffset === undefined || (value.mode === 'move' && Number.isFinite(value.snapOffset) && value.snapOffset >= 0 && value.snapOffset <= 1e8)) &&
    (value.targetValue === undefined || (value.mode === 'key' && Number.isFinite(value.targetValue) && Math.abs(value.targetValue)<=1e12)) &&
    validGrid(value.snapGrid) && (value.snapGrid === undefined || value.snap) &&
    Object.keys(value).every(key=>['action','token','mode','targetTime','targetValue','snap','snapOffset','snapGrid'].includes(key)))
  if (value?.action === 'parameter_sequence') return Boolean(/^[a-f0-9]{64}$/.test(value.token || '') && ['enable','clear','reset'].includes(value.mode) && typeof value.expectedSequenced==='boolean' && typeof value.confirmed==='boolean' && (value.mode==='enable' || value.confirmed) && typeof value.parameter==='string' && value.parameter.length>0 && value.parameter.length<256 && Object.keys(value).every(k=>['action','token','mode','parameter','expectedSequenced','confirmed'].includes(k)))
  if (value?.action === 'annotation_time') return Boolean(/^[a-f0-9]{64}$/.test(value.token || '') && Number.isFinite(value.time) && value.time>=0 && value.time<=1e8 && Object.keys(value).every(k=>['action','token','time'].includes(k)))
  if (value?.action === 'annotation') return Boolean(
    /^[a-f0-9]{64}$/.test(value.token || '') && ['add','move','update','delete'].includes(value.mode) &&
    ['cue','tc','midi','notes'].includes(value.kind) && Number.isFinite(value.targetTime) &&
    value.targetTime >= 0 && value.targetTime <= 1e8 && typeof value.text === 'string' && value.text.length > 0 && value.text.length <= 2000 &&
    (value.snap === undefined || typeof value.snap === 'boolean') &&
    (value.mode === 'add' ? value.sourceTime === undefined && value.sourceText === undefined :
      Number.isFinite(value.sourceTime) && typeof value.sourceText === 'string' && value.sourceText.length <= 2000) &&
    validGrid(value.snapGrid) && (value.snapGrid === undefined || value.snap) &&
    (value.targetLabel===undefined || /^\d{2}:\d{2}:\d{2}:\d{2}$/.test(value.targetLabel)) &&
    Object.keys(value).every(key=>['action','token','mode','kind','targetTime','targetLabel','text','sourceTime','sourceText','snap','snapGrid'].includes(key)))
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    commands.has(value.action) &&
    typeof value.token === 'string' &&
    /^[a-f0-9]{64}$/.test(value.token) &&
    Object.keys(value).every((key) =>
      ['action', 'token', 'direction', 'slot', 'type', 'index', 'resourceUid', 'keyTime'].includes(key),
    ) &&
    (value.keyTime === undefined || (value.action === 'key_move' && Number.isFinite(value.keyTime) && value.keyTime >= 0 && value.keyTime <= 1e8)) &&
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
  if(!validEditRequest(request)) return {ok:false,reason:'INVALID EDIT REQUEST'}
  const {keepPlayhead,...command}=request
  const previous=editor.viewerKeepPlayhead
  editor.viewerKeepPlayhead=keepPlayhead ?? !editor.linkTime
  if(keepPlayhead===false)editor.viewerPinnedLayerUid=null
  try {return await editFromViewerCommand(editor,command)}
  finally {editor.viewerKeepPlayhead=previous}
}
async function editFromViewerCommand(editor, request) {
  if (!validEditRequest(request)) return { ok: false, reason: 'INVALID EDIT REQUEST' }
  if (request.token !== describeEditor(editor).token)
    return { ok: false, reason: 'SELECTION OR VALUE CHANGED — TRY AGAIN' }
  // The caller owns the real Companion queue. This adapter executes exactly one
  // normal action, including its menu, locking, precision and beat/frame policy.
  if (request.action === 'transport') {
    await editor.controlTransport(request.operation)
    return {ok:true,editor:describeEditor(editor)}
  }
  if (request.action === 'link_time') {
    editor.setLinkTime(request.enabled)
    return {ok:true,editor:describeEditor(editor)}
  }
  const sharedActions = actions({ perform: (fn) => fn(editor) })
  if (request.action === 'layer_manage' || request.action === 'layer_reorder') {
    if (editor.moveKey || editor.mediaMode || editor.clearKeysBrowser || editor.layerEdit) return {ok:false,reason:'RELEASE THE CURRENT EDIT FIRST'}
    if (editor.snapshot?.trackUid !== request.trackUid) return {ok:false,reason:'TRACK CHANGED'}
    const {action,token,...args}=request
    const result=await editor.remote(()=>editor.client.execute(action,{...editor.context(),...args}))
    if(result.deletedLayerUid === editor.viewerPinnedLayerUid) editor.viewerPinnedLayerUid=null
    await editor.refresh({preserve:true})
    if(result.deletedLayerUid) return {ok:true,editor:describeEditor(editor)}
    if(result.group) return {ok:true,editor:describeEditor(editor)}
    const layerUid=result.layerUid || result.layer?.uid || request.layerUid
    const selected=await editor.selectFromViewer({trackUid:request.trackUid,layerUid})
    return {...selected,editor:describeEditor(editor)}
  }
  if (request.action === 'value_set') {
    if (!editor.field || editor.field.resource || editor.mediaMode || editor.clearKeysBrowser || editor.layerEdit ||
        (editor.field.sequenced && !editor.moveKey)) return {ok:false,reason:'SELECT A VALUE OR KEYFRAME FIRST'}
    await editor.adjustLiveValue(1,0,{targetValue:request.targetValue,expectedValue:request.expectedValue,previewCurve:true})
    return {ok:true,editor:describeEditor(editor)}
  }
  if (request.action === 'key_insert') {
    const result=await editor.selectFromViewer({trackUid:request.trackUid,layerUid:request.layerUid,parameter:request.parameter,point:'insert',keyTime:request.targetTime})
    return {...result,editor:describeEditor(editor)}
  }
  if (request.action === 'key_move' && request.keyTime !== undefined) {
    if (editor.moveKey || editor.mediaMode || editor.clearKeysBrowser) return {ok:false,reason:'RELEASE THE CURRENT EDIT FIRST'}
    await editor.toggleMoveKey(request.keyTime)
    return {ok:Boolean(editor.moveKey) && Math.abs(editor.moveKey.time-request.keyTime)<1e-6,editor:describeEditor(editor)}
  }
  if (request.action === 'drag_value') {
    if (!editor.moveKey || editor.mediaMode || editor.clearKeysBrowser || editor.field?.resource || editor.field?.choices?.length)
      return {ok:false,reason:'SELECT A NUMERIC KEYFRAME FIRST'}
    const delta = request.targetValue - editor.moveKey.value
    if (!Number.isFinite(delta)) return {ok:false,reason:'KEYFRAME VALUE UNAVAILABLE'}
    // Reuse native bounds, integer rounding and expected-key validation. Compensate
    // encoder precision because this delta already represents the pointer position.
    const previewCurve=curvePreviewDue(editor)
    if (Math.abs(delta) > 1e-9) await editor.adjustLiveValue(Math.sign(delta),Math.abs(delta)*(editor.field.integer ? 1 : editor.precision === 'ultra' ? 100 : editor.fine ? 10 : 1),{previewCurve})
    return {ok:true,editor:describeEditor(editor),curve:previewCurve ? editor.field?.samples : undefined}
  }
  if (request.action === 'drag_time') {
    if (editor.mediaMode || editor.clearKeysBrowser) return {ok:false,reason:'CLOSE THE RESOURCE OR DELETE MENU FIRST'}
    const previewCurve=request.mode==='key' && curvePreviewDue(editor)
    const pointer = {targetTime:request.targetTime,targetValue:request.targetValue,snap:request.snap,snapOffset:request.snapOffset || 0,snapGrid:request.snapGrid,previewCurve}
    if (request.mode === 'key') {
      if (!editor.moveKey) return {ok:false,reason:'SELECT A KEYFRAME FIRST'}
      if (request.targetValue !== undefined && (editor.field?.resource || editor.field?.choices?.length))
        return {ok:false,reason:'THIS KEYFRAME ONLY SUPPORTS TIME EDITING'}
      await editor.adjustLiveTime(1,0,pointer)
    } else {
      if (editor.layerEdit !== 'edit') return {ok:false,reason:'SELECT LAYER EDIT FIRST'}
      await editor.adjustLayerTiming(request.mode,1,pointer)
    }
    return {ok:true,editor:describeEditor(editor),curve:previewCurve ? editor.field?.samples : undefined}
  }
  if (request.action === 'parameter_sequence') {
    if (!editor.layer || editor.moveKey || editor.layerEdit || editor.clearKeysBrowser) return {ok:false,reason:'RELEASE THE CURRENT EDIT FIRST'}
    const target=editor.mediaMode ? editor.mediaField : editor.field
    if(target?.name!==request.parameter) return {ok:false,reason:'PARAMETER CHANGED'}
    await editor.remote(()=>editor.client.execute('parameter_sequence',{...editor.context(),layerUid:editor.layer.uid,field:request.parameter,mode:request.mode,confirmed:request.confirmed,expectedSequenced:request.expectedSequenced}))
    editor.mediaMode=false
    await editor.refresh({preserve:true})
    return {ok:true,editor:describeEditor(editor)}
  }
  if (request.action === 'annotation_time') {
    const annotation=await editor.remote(()=>editor.client.execute('resolve_timecode',{...editor.context(),time:request.time}))
    return {ok:true,annotation,editor:describeEditor(editor)}
  }
  if (request.action === 'annotation') {
    if (editor.moveKey || editor.mediaMode || editor.clearKeysBrowser) return {ok:false,reason:'PRESS ESC TO RELEASE THE CURRENT EDIT'}
    const {action,token,...annotation} = request
    const result = await editor.remote(()=>editor.client.execute('annotation_edit',{...editor.context(),...annotation}))
    return {ok:true,annotation:result,editor:describeEditor(editor)}
  }
  // Delete means exactly the selected key, never DEFAULT or a resource tile.
  if (request.action === 'key_delete' && (!editor.moveKey || editor.mediaMode || editor.clearKeysBrowser))
    return { ok: false, reason: 'SELECT A KEYFRAME FIRST' }
  if (request.action === 'resource_choose') {
    const item = editor.mediaItems[request.index]
    if (!editor.mediaMode || !item || item.uid !== request.resourceUid)
      return { ok: false, reason: 'RESOURCE LIST CHANGED — REOPEN RESOURCES' }
    editor.mediaIndex = request.index
    await editor.pressValue()
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
