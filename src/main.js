'use strict'
const { InstanceBase, InstanceStatus, combineRgb } = require('@companion-module/base')
const { DesignerClient } = require('./client')
const { DemoClient } = require('./demo')
const { Editor } = require('./editor')
const { Connection } = require('./connection')
const { actions, presets } = require('./definitions')
const { timecode, absoluteTimecode } = require('./timecode')
const theme = require('./theme')

class DisguiseLayerControl extends InstanceBase {
  async init(config) {
    this.setVariableDefinitions(
      Object.fromEntries(
        Object.entries({
          track: 'Snapshot track',
          layer: 'Selected layer',
          parameter: 'Selected numeric parameter',
          playing: 'Designer is playing',
          playback_label: 'Play section / stop button label',
          parameter_animated: 'Selected parameter has multiple sequenced keys',
          value: 'Current numeric value',
          value_label: 'Value or option name',
          time: 'Live time in seconds',
          step_mode: 'Adjustment mode',
          time_step: 'Time step',
          fps: 'Timeline FPS',
          tc_mode: 'Designer timecode mode',
          move_key: 'Key move mode',
          key_type: 'Selected key interpolation',
          layer_edit: 'Layer edit mode',
          selected_key_time: 'Selected key time',
          parameter_id: 'Parameter internal name',
          parameter_min: 'Parameter minimum',
          parameter_max: 'Parameter maximum',
          parameter_step: 'Designer parameter step',
          active_layers: 'Layer count at playhead',
          layer_position: 'Selected layer number at playhead',
          layer_elapsed: 'Seconds from layer start',
          layer_remaining: 'Seconds to layer end',
          key_previous_distance: 'Seconds from previous key',
          key_next_distance: 'Seconds to next key',
          ui_mode: 'PARAMS or MEDIA',
          delete_hint: 'Delete hold instruction / release indicator',
          delete_ready: 'Delete held for one second',
          folder: 'Media folder',
          media_name: 'Selected media',
          media_field: 'Media field',
          media_position: 'File position',
          ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`pad_${i}`, `Context button ${i + 1}`])),
          ...Object.fromEntries(
            Array.from({ length: 8 }, (_, i) => [`pad_image_${i}`, `Media thumbnail ${i + 1}`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 8 }, (_, i) => [`pad_folder_${i}`, `Media folder ${i + 1}`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 8 }, (_, i) => [`pad_kind_${i}`, `Resource kind ${i + 1}`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 8 }, (_, i) => [`pad_color_${i}`, `Context button colour ${i + 1}`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 4 }, (_, i) => [`dial_title_${i}`, `Display ${i + 1} title`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 4 }, (_, i) => [`dial_value_${i}`, `Display ${i + 1} value`]),
          ),
          ...Object.fromEntries(
            Array.from({ length: 4 }, (_, i) => [`dial_info_${i}`, `Display ${i + 1} detail`]),
          ),
          key_count: 'Keyframe count from last read/write',
          dirty: 'Value has local edits',
          mode: 'DEMO or DESIGNER',
          last_error: 'Last error',
          connected: 'Designer HTTP connection',
          live_connected: 'LiveUpdate time feedback',
          live_time: 'Designer playhead seconds (live)',
          connection_status: 'Connection status',
          timecode: 'Playhead HH:MM:SS:FR',
          live_timecode: 'Live playhead HH:MM:SS:FR',
        }).map(([id, name]) => [id, { name }]),
      ),
    )
    this.setActionDefinitions(actions(this))
    this.setFeedbackDefinitions({
      fine: {
        type: 'boolean',
        name: 'Fine mode',
        options: [],
        defaultStyle: { bgcolor: combineRgb(0, 110, 80) },
        callback: () => Boolean(this.editor?.fine),
      },
      dirty: {
        type: 'boolean',
        name: 'Unsent value changes',
        options: [],
        defaultStyle: { bgcolor: combineRgb(140, 80, 0) },
        callback: () => Boolean(this.editor?.dirty),
      },
      connected: {
        type: 'boolean',
        name: 'Designer connected',
        options: [],
        defaultStyle: { bgcolor: combineRgb(0, 110, 80) },
        callback: () => Boolean(this.connection?.connected),
      },
    })
    await this.configUpdated(config)
  }
  getConfigFields() {
    return [
      {
        type: 'static-text',
        id: 'info',
        label: 'Designer 32.4.17 / Companion 5.0.5',
        value:
          'VALUE rotation edits the selected key or constant; press VALUE to add a key at the playhead. LAYER EDIT opens IN / POSITION (centre time) / OUT / FIT (length). Press a timing dial to change its step. Time presses cycle 1 frame / 1 s / 2 s / 5 s / 10 s / 1 min, including while SELECT KEY is active. Press SELECT KEY again to unlock. Layers at the playhead update automatically. Float steps: 0.1 / 0.01 / 0.001.',
      },
      { type: 'textinput', id: 'host', label: 'Designer IP / hostname', width: 8, default: '127.0.0.1' },
      {
        type: 'number',
        id: 'port',
        label: 'Designer HTTP API port',
        width: 4,
        default: 80,
        min: 1,
        max: 65535,
      },
    ]
  }
  async configUpdated(config) {
    clearInterval(this.autoSyncTimer)
    this.syncPending = false
    this.nextSyncAttempt = 0
    this.setPresetDefinitions(...presets(this.label))
    this.connection?.close()
    this.connection = null
    this.client?.close()
    this.config = config
    this.editor = null
    this.lastError = ''
    this.initialReadStarted = false
    this.actionTail = Promise.resolve()
    this.queueGeneration = 0
    this.thumbnailCache = new Map()
    this.thumbnailBatch = ''
    this.lastProbeRevision = undefined
    try {
      this.client = config.demo
        ? new DemoClient()
        : new DesignerClient(config.host || '127.0.0.1', config.port ?? 80)
      this.editor = new Editor(this.client)
      this.updateStatus(InstanceStatus.Connecting, config.demo ? 'Demo ready' : 'Connecting to Designer')
      if (!config.demo) {
        const connection = new Connection(this.client, (state) => {
          if (this.connection !== connection) return
          if (!state.connected && this.editor?.snapshot) this.editor.stale = true
          if (state.trackUid && this.editor?.snapshot && state.trackUid !== this.editor.snapshot.trackUid)
            this.editor.stale = true
          const active = state.transports?.find((t) => String(t.uid) === this.editor?.snapshot?.transportUid)
          if (state.probeRevision !== this.lastProbeRevision) {
            this.lastProbeRevision = state.probeRevision
            if (
              state.connected &&
              this.editor?.snapshot &&
              (!active || String(active.currentTrack?.uid) !== this.editor.snapshot.trackUid)
            )
              this.editor.stale = true
          }
          if (this.editor?.snapshot && !this.editor.stale) {
            if (state.timeline) this.editor.followTimeline(state.timeline)
            else this.editor.followTime(state.time)
          }
          const e = this.editor
          if (e && typeof state.timeline?.playing === 'boolean') e.playing = state.timeline.playing
          if (e?.snapshot && state.clock) {
            e.snapshot.fps = state.clock.fps
            e.snapshot.customFps = state.clock.custom
            e.snapshot.tcMode = String(state.clock.mode)
          }
          if (
            e?.field &&
            !e.busy &&
            !e.stale &&
            state.fieldTarget?.layerUid === e.layer.uid &&
            state.fieldTarget?.name === e.field.name &&
            state.fieldValue
          ) {
            e.acceptLive({ field: state.fieldValue })
          }
          if (e?.snapshot && state.connected && !e.stale)
            connection.watch(
              e.snapshot.transportUid,
              e.field ? { layerUid: e.layer.uid, name: e.field.name } : null,
            )
          this.connectionStatus()
          this.publish()
          if (state.connected && (!this.editor?.snapshot || this.editor.stale)) this.requestSync()
        })
        this.connection = connection
        void connection.start()
        this.autoSyncTimer = setInterval(() => this.requestSync(), 2000)
        this.autoSyncTimer.unref?.()
      } else await this.editor.refresh()
    } catch (error) {
      this.lastError = error.message
      this.updateStatus(InstanceStatus.BadConfig, error.message)
    }
    this.publish()
  }
  requestSync() {
    if (
      !this.connection?.connected ||
      this.syncPending ||
      (this.editor?.snapshot && !this.editor.stale) ||
      Date.now() < this.nextSyncAttempt
    )
      return
    const editor = this.editor
    this.syncPending = true
    this.nextSyncAttempt = Date.now() + 1000
    void this.perform(
      async (e) => {
        if (e.snapshot && !e.stale) return
        await e.refresh({ preserve: true })
        if (e.mediaMode) await e.loadMedia({ preserve: true })
      },
      { synchronise: false },
    ).finally(() => {
      if (this.editor === editor) this.syncPending = false
    })
  }
  async loadThumbnails() {
    const e = this.editor
    const items = e?.mediaMode ? e.mediaItems.slice(e.mediaPage * 8, e.mediaPage * 8 + 8) : []
    const batch = items.map((m) => m.uid).join(',')
    if (batch === this.thumbnailBatch) return
    this.thumbnailBatch = batch
    await Promise.all(
      items.map(async (item) => {
        if (this.thumbnailCache.has(item.uid)) return
        let png = ''
        if (item.thumbnail !== false) {
          try {
            png = await this.client.thumbnail(item.uid)
          } catch {}
        }
        if (e !== this.editor) return
        this.thumbnailCache.set(item.uid, png)
        if (this.thumbnailCache.size > 96) this.thumbnailCache.delete(this.thumbnailCache.keys().next().value)
      }),
    )
    if (e === this.editor && batch === this.thumbnailBatch) this.publish()
  }
  perform(fn, options = {}) {
    // Preserve every encoder detent in order. A failed action invalidates queued
    // actions from that generation, preventing writes to a changed context.
    const editor = this.editor,
      generation = this.queueGeneration
    const run = this.actionTail.then(async () => {
      if (editor !== this.editor || generation !== this.queueGeneration) return
      await this.performNow(fn, options)
    })
    this.actionTail = run.catch(() => {})
    return run
  }
  async performNow(fn, { synchronise = true, scrub = false } = {}) {
    const editor = this.editor
    if (!editor) return
    try {
      if (synchronise && editor.stale && this.connection?.connected) {
        const track = editor.snapshot?.trackUid,
          transport = editor.snapshot?.transportUid
        const layer = editor.layer?.uid,
          field = editor.field?.name
        const moving = editor.moveKey || editor.layerEdit
        await editor.refresh({ preserve: true })
        if (editor.mediaMode) await editor.loadMedia({ preserve: true })
        if (
          track !== editor.snapshot?.trackUid ||
          transport !== editor.snapshot?.transportUid ||
          ((!scrub || moving) && (layer !== editor.layer?.uid || field !== editor.field?.name))
        ) {
          // Discard the stale gesture and its queued detents. A routine GUI
          // selection change is not a failed connection or a button error.
          this.queueGeneration++
          this.lastError = ''
          this.connectionStatus()
          this.publish()
          return
        }
      }
      await fn(editor)
      if (editor !== this.editor) return
      this.lastError = ''
      if (editor.snapshot && this.connection?.connected)
        this.connection.watch(
          editor.snapshot.transportUid,
          editor.field ? { layerUid: editor.layer.uid, name: editor.field.name } : null,
        )
      this.connectionStatus()
    } catch (error) {
      if (editor !== this.editor) return
      this.lastError = error.message
      this.queueGeneration++
      this.log('warn', error.message)
      this.updateStatus(InstanceStatus.UnknownError, error.message)
    }
    this.publish()
  }
  connectionStatus() {
    if (this.config?.demo) {
      this.updateStatus(InstanceStatus.Ok, 'DEMO - local simulation')
      return
    }
    const c = this.connection
    if (!c?.connected)
      this.updateStatus(InstanceStatus.ConnectionFailure, c?.error || 'Connecting to Designer')
    else if (this.lastError) this.updateStatus(InstanceStatus.UnknownError, this.lastError)
    else if (this.editor?.stale)
      this.updateStatus(InstanceStatus.Connecting, 'Synchronising Designer changes')
    else
      this.updateStatus(
        InstanceStatus.Ok,
        c.live
          ? 'Designer connected + live playhead'
          : c.polling
            ? 'Designer connected + polled feedback'
            : `Designer connected (HTTP)${c.liveError ? ' - ' + c.liveError : ''}`,
      )
  }
  publish() {
    const e = this.editor
    const fmt = (value) => (Number.isFinite(value) ? String(Number(value.toFixed(3))) : '-')
    const readable = (value, filename = false) => {
      let text = String(value || '')
      if (filename) text = text.replace(/\.(mov|mp4|png|jpe?g|wav|aiff?)$/i, '')
      text = text.replace(/[_-]/g, ' ')
      if (text.length <= 18 || !text.includes(' ')) return text
      const spaces = [...text.matchAll(/ /g)].map((m) => m.index)
      const split = spaces.sort((a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2))[0]
      return text.slice(0, split) + '\n' + text.slice(split + 1)
    }
    const rate = e?.snapshot?.fps
    const drop = !e?.snapshot?.customFps && /(?:^|\s)DF$/.test(e?.snapshot?.tcMode || '')
    const tc = (value) => absoluteTimecode(value, rate, drop, e?.timecodeSamples, e?.liveTimecodeSample)
    const duration = (value) => timecode(value, rate)
    const keys = e?.field?.sequenced ? e.field.keys || [] : []
    const visibleKeys = keys.filter(
      (k) => k.time >= (e?.layer?.start ?? 0) && k.time <= (e?.layer?.end ?? Infinity),
    )
    const prev = visibleKeys
      .filter((k) => k.time < e.time - 1e-5)
      .sort((a, b) => a.time - b.time)
      .at(-1)
    const next = visibleKeys.filter((k) => k.time > e.time + 1e-5).sort((a, b) => a.time - b.time)[0]
    const here = e?.selectedKey
    const mediaMode = Boolean(e?.mediaMode)
    const keyType = here ? { 0: 'HOLD', 1: 'LINEAR', 2: 'SMOOTH' }[here.interpolation] || '-' : '-'
    const layerMode =
      { edit: 'LAYER EDIT', move: 'MOVE LAYER', in: 'IN POINT', out: 'OUT POINT' }[e?.layerEdit] || ''
    const playbackLabel = e?.playing ? 'STOP' : 'PLAY\nSECTION'
    clearTimeout(this.deleteHoldTimer)
    const deletePress = !mediaMode && !e?.clearKeysBrowser && e?.deletePress
    const deleteReady = Boolean(deletePress && Date.now() - deletePress.time >= 1000)
    // Publish at the hold threshold even when Designer is idle; never execute a deletion here.
    if (deletePress && !deleteReady)
      this.deleteHoldTimer = setTimeout(
        () => this.publish(),
        Math.max(1, 1000 - (Date.now() - deletePress.time)),
      )
    const padLabels = [
      'PREV\nKEY',
      'NEXT\nKEY',
      layerMode || 'LAYER\nEDIT',
      playbackLabel,
      'SELECT\nKEY',
      e?.canResetDefault ? 'DEFAULT' : 'DELETE\nKEY',
      'TYPE\n' + keyType,
      'RESOURCES',
    ]
    const padColors = [
      theme.groups.navigation,
      theme.groups.navigation,
      layerMode ? theme.active : theme.groups.layer,
      e?.playing ? theme.active : theme.groups.playback,
      e?.moveKey ? theme.active : theme.groups.keyEdit,
      theme.groups.keyEdit,
      theme.groups.keyEdit,
      theme.groups.resources,
    ]
    // Use the primary button background as well as the small page indicator,
    // so the completed hold is visible on existing pages and physical surfaces.
    if (deleteReady) padColors[5] = 0xb02028
    if (e?.clearKeysBrowser && !e.clearKeysTargetValid()) e.closeClearKeys()
    const clearBrowser = e?.clearKeysBrowser
    const clearItem = clearBrowser?.items[clearBrowser.index]
    if (clearBrowser) {
      padLabels.fill('')
      padColors.fill(theme.surface)
      padLabels[4] = 'DEFAULT ALL\nPARAMETERS'
      padColors[4] = theme.groups.keyEdit
      padLabels[5] = clearItem ? 'DELETE\nALL' : ''
      padLabels[6] = clearItem ? 'DELETE ALL\n+ DEFAULT' : ''
      padLabels[7] = 'BACK'
      padColors[5] = theme.groups.keyEdit
      padColors[6] = theme.groups.keyEdit
      padColors[7] = 0x000000
    }
    const padVars = {}
    padVars.delete_hint = 'LONG PRESS\nDELETE ALL'
    padVars.delete_ready = deleteReady
    if (e?.clearKeysPrompt) {
      padLabels.fill('')
      padLabels[0] = 'ARE YOU\nSURE?'
      padLabels[1] = e.clearKeysPrompt.label
      padLabels[5] = e.clearKeysPrompt.allParameters
        ? 'DEFAULT ALL\nPARAMETERS'
        : e.clearKeysPrompt.resetDefault
          ? 'DELETE ALL\n+ DEFAULT'
          : 'DELETE\nALL'
      padLabels[6] = 'CANCEL'
      padColors[5] = theme.active
    }
    for (let i = 0; i < 8; i++) {
      const item = mediaMode ? e.mediaItems[e.mediaPage * 8 + i] : null
      padVars[`pad_${i}`] = mediaMode ? item?.name || '' : padLabels[i]
      padVars[`pad_image_${i}`] = item ? this.thumbnailCache?.get(item.uid) || '' : ''
      padVars[`pad_kind_${i}`] = item && !padVars[`pad_image_${i}`] ? e.mediaField?.label || 'Resource' : ''
      padVars[`pad_folder_${i}`] = item
        ? (item.folder.split('/').filter(Boolean).at(-1) || 'Root').replace(/[-_]/g, ' ')
        : ''
      const folderWords = padVars[`pad_folder_${i}`].split(' ')
      if (padVars[`pad_folder_${i}`].length > 12 && folderWords.length > 1) {
        const split = Math.max(1, Math.floor(folderWords.length / 2))
        padVars[`pad_folder_${i}`] =
          folderWords.slice(0, split).join(' ') + '\n' + folderWords.slice(split).join(' ')
      }
      if (item)
        padVars[`pad_${i}`] = item.name
          .replace(/\.(mov|mp4|png|jpg|jpeg|wav|aif|aiff)$/i, '')
          .replace(/[-_]/g, ' ')
      padVars[`pad_color_${i}`] = mediaMode
        ? item && item.uid === e.currentMedia?.uid
          ? theme.active
          : theme.media
        : padColors[i]
    }
    const titles = [
      e?.layer && !e.activeLayers.includes(e.layer)
        ? 'LAYER / DESIGNER'
        : 'LAYER ' + (e ? e.activeLayers.indexOf(e.layer) + 1 : 0) + '/' + (e?.activeLayers.length || 0),
      mediaMode ? 'FOLDER' : 'PARAMETER',
      mediaMode ? 'FILE / PREVIEW' : 'VALUE / ' + (e?.precision || 'coarse').toUpperCase(),
      (layerMode || (e?.moveKey ? 'MOVE KEY' : 'TIME')) + ' / ' + (e?.timeStepLabel || ''),
    ]
    const values = [
      e?.layer?.name || 'No active layer',
      mediaMode ? e.mediaFolder || 'No folders' : e?.field?.label || e?.field?.name || '—',
      mediaMode ? e.currentMedia?.name || 'Select a file' : e?.valueLabel || '—',
      fmt(e?.time) + ' s',
    ]
    const info = [
      e?.layer
        ? '+' + fmt(e.time - (e.layer.start ?? 0)) + 's / -' + fmt(e.layer.end - e.time) + 's'
        : 'AUTO SYNC',
      mediaMode
        ? e.mediaField?.label || 'No media field'
        : e?.field?.choices?.length
          ? e.field.choices.length + ' options'
          : (e?.field?.min ?? '—') + ' … ' + (e?.field?.max ?? '—'),
      mediaMode
        ? `${e.mediaIndex + 1} / ${e.mediaItems.length}   PAGE ${e.mediaPage + 1}/${Math.max(1, Math.ceil(e.mediaItems.length / 8))}`
        : e?.field?.sequenced
          ? 'SELECTED KEY'
          : 'LIVE CONSTANT',
      'K- ' + (prev ? fmt(e.time - prev.time) : '—') + ' / K+ ' + (next ? fmt(next.time - e.time) : '—'),
    ]
    for (let i = 0; i < 4; i++) {
      padVars[`dial_title_${i}`] = titles[i]
      padVars[`dial_value_${i}`] = values[i]
      padVars[`dial_info_${i}`] = info[i]
    }
    padVars.dial_value_1 = readable(padVars.dial_value_1)
    padVars.dial_title_3 += ' @ ' + fmt(e?.snapshot?.fps)
    if (mediaMode) {
      padVars.dial_title_1 = `FOLDER ${e.mediaFolders.indexOf(e.mediaFolder) + 1}/${e.mediaFolders.length}`
      padVars.dial_value_1 = readable(e.mediaFolder.split('/').filter(Boolean).at(-1) || 'Root')
      padVars.dial_info_1 = [
        e.mediaFolder.includes('/') ? e.mediaFolder.split('/').slice(0, -1).join(' / ') : '',
        e.mediaField?.label,
      ]
        .filter(Boolean)
        .join('\n')
    }
    padVars.dial_value_3 = tc(e?.time)
    padVars.dial_info_0 = e?.layer ? 'IN ' + tc(e.layer.start) + '\nOUT ' + tc(e.layer.end) : 'AUTO SYNC'
    padVars.dial_info_2 = mediaMode
      ? `${e.mediaIndex + 1}/${e.mediaItems.length}  PAGE ${e.mediaPage + 1}/${Math.max(1, Math.ceil(e.mediaItems.length / 8))}`
      : e?.field?.sequenced
        ? 'KEY ' + tc(here?.time)
        : 'CONSTANT'
    padVars.dial_info_3 =
      'K- ' +
      duration(prev ? e.time - prev.time : undefined) +
      '\nK+ ' +
      duration(next ? next.time - e.time : undefined)
    if (mediaMode) {
      padVars.dial_title_0 = 'SOURCE ' + (e.mediaFieldIndex + 1) + '/' + (e.layer?.mediaFields?.length || 0)
      padVars.dial_value_0 = readable(e.mediaField?.label || 'No resources')
      padVars.dial_info_0 = e.layer?.name || ''
      padVars.dial_title_2 = 'RESOURCES'
      padVars.dial_value_2 = readable(
        e.currentMedia?.name || (e.mediaItems.length ? 'Select resource' : 'No resources'),
        true,
      )
      padVars.dial_title_3 = ''
      padVars.dial_value_3 = 'BACK'
      padVars.dial_info_3 = ''
    }
    if (layerMode && e.layerEdit !== 'edit') {
      padVars.dial_value_3 = tc(e.layerEdit === 'out' ? e.layer.end : e.layer.start)
      padVars.dial_info_3 = 'IN ' + tc(e.layer.start) + '\nOUT ' + tc(e.layer.end)
    }
    if (e?.layerEdit === 'edit' && e.layer) {
      const start = e.layer.start,
        end = e.layer.end
      for (let i = 0; i < 4; i++) padVars['dial_info_' + i] = ''
      padVars.dial_title_0 = 'IN / ' + e.timeStepLabel
      padVars.dial_title_1 = 'POSITION / ' + e.timeStepLabel
      padVars.dial_title_2 = 'OUT / ' + e.timeStepLabel
      padVars.dial_title_3 = 'FIT / LENGTH'
      padVars.dial_value_0 = tc(start)
      padVars.dial_value_1 = tc((start + end) / 2)
      padVars.dial_value_2 = tc(end)
      padVars.dial_value_3 = duration(end - start)
      padVars.dial_info_1 = readable(e.layer.name)
    }
    if (clearBrowser) {
      for (let i = 0; i < 4; i++) padVars['dial_info_' + i] = ''
      padVars.dial_title_0 = 'DELETE ALL KEYS'
      padVars.dial_value_0 = readable(clearBrowser.layerName)
      padVars.dial_title_1 =
        'PARAMETER ' + (clearItem ? clearBrowser.index + 1 : 0) + '/' + clearBrowser.items.length
      padVars.dial_value_1 = readable(clearItem?.label || 'No animation')
      padVars.dial_info_1 = clearItem?.kind || ''
      padVars.dial_title_2 = 'KEYFRAMES'
      padVars.dial_value_2 = String(clearItem?.keyCount || 0)
      padVars.dial_title_3 = ''
      padVars.dial_value_3 = 'BACK'
    }
    this.setVariableValues({
      ...padVars,
      ui_mode: clearBrowser ? 'CLEAR_KEYS' : mediaMode ? 'MEDIA' : 'PARAMS',
      folder: e?.mediaFolder || '',
      media_name: e?.currentMedia?.name || '',
      media_field: e?.mediaField?.label || '',
      media_position: `${(e?.mediaIndex ?? -1) + 1}/${e?.mediaItems.length || 0}`,
      playing: Boolean(e?.playing),
      playback_label: playbackLabel,
      parameter_animated: Boolean(!clearBrowser && !e?.layerEdit && e?.field?.sequenced && keys.length > 1),
      track: e?.snapshot?.trackName || '',
      layer: e?.layer?.name || 'No active layer',
      parameter: e?.field?.label || e?.field?.name || '',
      parameter_id: e?.field?.name || '',
      parameter_min: e?.field?.min ?? '-',
      parameter_max: e?.field?.max ?? '-',
      parameter_step: e?.field?.step ?? '-',
      value_label: e?.valueLabel ?? '',
      time_step: e?.timeStepLabel ?? '',
      fps: e?.snapshot?.fps ?? '',
      layer_edit: layerMode || 'SCRUB',
      selected_key_time: here?.time ?? '',
      tc_mode: (e?.snapshot?.customFps ? 'CUSTOM ' : '') + (e?.snapshot?.tcMode || ''),
      move_key: e?.moveKey ? 'MOVE KEY' : 'SCRUB',
      key_type: here ? { 0: 'HOLD', 1: 'LINEAR', 2: 'SMOOTH' }[here.interpolation] || '-' : '-',
      active_layers: e?.activeLayers.length ?? 0,
      layer_position: e ? e.activeLayers.indexOf(e.layer) + 1 : 0,
      layer_elapsed: e?.layer ? fmt(e.time - (e.layer.start ?? 0)) : '-',
      layer_remaining: e?.layer ? fmt(e.layer.end - e.time) : '-',
      key_previous_distance: prev ? fmt(e.time - prev.time) : '-',
      key_next_distance: next ? fmt(next.time - e.time) : '-',
      value: e?.value ?? 0,
      time: e?.time ?? 0,
      step_mode: (e?.precision || 'coarse').toUpperCase(),
      key_count: e?.field?.keys.length ?? 0,
      dirty: Boolean(e?.dirty),
      mode: this.config?.demo ? 'DEMO' : 'DESIGNER',
      last_error: this.lastError || '',
      connected: Boolean(this.connection?.connected),
      live_connected: Boolean(this.connection?.live),
      live_time: this.connection?.time ?? '',
      timecode: tc(e?.time),
      live_timecode: tc(this.connection?.time ?? e?.time),
      connection_status: this.config?.demo
        ? 'DEMO'
        : this.connection?.connected
          ? this.connection.live
            ? 'HTTP + LIVE'
            : this.connection.polling
              ? 'HTTP + SYNC'
              : 'HTTP'
          : 'DISCONNECTED',
    })
    this.checkFeedbacks('fine', 'dirty', 'connected')
    void this.loadThumbnails()
  }
  async destroy() {
    clearTimeout(this.deleteHoldTimer)
    clearInterval(this.autoSyncTimer)
    this.connection?.close()
    this.connection = null
    this.client?.close()
    this.editor = null
  }
}

module.exports = { DisguiseLayerControl }
