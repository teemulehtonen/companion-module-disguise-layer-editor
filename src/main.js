'use strict'
const { InstanceBase, InstanceStatus, combineRgb } = require('./companion-api')
const { DesignerClient } = require('./client')
const { DemoClient } = require('./demo')
const { Editor } = require('./editor')
const { Connection } = require('./connection')
const { actions, presets } = require('./definitions')
const { timecode, absoluteTimecode, anchoredTimecode } = require('./timecode')
const theme = require('./theme')
const { layerTypeLabel } = require('./layer-types')
const { ViewerServer } = require('./viewer-server')
const { WaveformDiskCache } = require('./waveform-disk-cache')
const { describeEditor, editFromViewer, resourceList } = require('./viewer-editor')
const { acceptPlaybackSample, extrapolatedPlayback } = require('./viewer-playback-clock')

class DisguiseLayerControl extends InstanceBase {
  async init(config, isFirstInit, secrets = {}) {
    try {
      const cleaned = await require('./audio-temp-cleanup').cleanupLegacyAudioTemp()
      this.log('info', 'Legacy waveform cleanup: ' + cleaned.files + ' files, ' + cleaned.bytes + ' bytes removed')
    } catch { this.log('warn', 'Legacy waveform temporary-file cleanup failed') }
    this.setVariableDefinitions(
      Object.fromEntries(
        Object.entries({
          track: 'Snapshot track',
          layer_uid: 'Selected layer UID',
          viewer_status: 'Timeline viewer status',
          layer: 'Selected layer',
          layer_type: 'Friendly layer type',
          parameter: 'Selected numeric parameter',
          playing: 'Designer is playing',
          time_entry: 'Keypad time entry or validation message',
          time_entry_active: 'Keypad has a pending time',
          playback_label: 'Play section / stop button label',
          parameter_animated: 'Selected parameter has multiple sequenced keys',
          value: 'Current numeric value',
          value_label: 'Value or option name',
          time: 'Live time in seconds',
          step_mode: 'Adjustment mode',
          time_step: 'Time step',
          ...Object.fromEntries(Array.from({length:10},(_,i)=>['timing_step_'+i,'Adaptive timing step '+(i+1)])),
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
          heartbeat: 'Pulse after a successful Designer response',
          live_connected: 'LiveUpdate time feedback',
          live_time: 'Designer playhead seconds (live)',
          connection_status: 'Connection status',
          timecode: 'Playhead HH:MM:SS:FR',
          live_timecode: 'Live playhead HH:MM:SS:FR',
          ...Object.fromEntries(Array.from({length:8},(_,i)=>['osc_fader_'+(i+1), 'Stored OSC fader '+(i+1)+' value (0–1)'])),
          master_transport: 'Selected transport or OSC channel for the CC1 master fader',
          master_transport_position: 'Selected master transport position',
          ...Object.fromEntries(Array.from({ length: 42 }, (_, i) => [`master_transport_${i + 1}`, `Master transport slot ${i + 1}`])),
          transport_master_level: 'Selected transport master level, 0–100',
          transport_master_brightness: 'Selected transport brightness, 0–100',
          transport_master_volume: 'Selected transport volume, 0–100',
          transport_master_detail: 'Selected transport brightness and volume',
          transport_master_mismatch: 'Brightness and volume differ',
          navigation_mode: 'Track / section navigation mode',
          jog_locked: 'Jog wheel locked',
          jog_lock_label: 'Jog wheel lock label',
        }).map(([id, name]) => [id, { name }]),
      ),
    )
    this.setActionDefinitions(actions(this))
    this.setFeedbackDefinitions({
      navigation_track: {type:'boolean',name:'Track navigation enabled',options:[],defaultStyle:{bgcolor:theme.active},callback:()=>Boolean(this.trackNavigation)},
      link_time:{type:'boolean',name:'Time linked',options:[],defaultStyle:{bgcolor:theme.active},callback:()=>Boolean(this.editor?.linkTime)},
      jog_locked:{type:'boolean',name:'Jog wheel locked',options:[],defaultStyle:{bgcolor:theme.active},callback:()=>Boolean(this.jogLocked)},
      transport_master_selected:{type:'boolean',name:'Master transport slot selected',options:[{type:'number',id:'slot',label:'Transport slot (1–42)',default:1,min:1,max:42}],defaultStyle:{bgcolor:theme.active},callback:f=>Boolean(this.masterTargetSlots()[Number(f.options.slot)-1]?.uid) && this.masterTargetSlots()[Number(f.options.slot)-1]?.uid===this.masterTransportUid},
      timing_step_selected:{type:'boolean',name:'Timing step selected',options:[{type:'number',id:'slot',label:'Slot',default:0,min:0,max:9}],defaultStyle:{bgcolor:theme.active},callback:f=>Boolean(this.editor?.timeStepChoices[Number(f.options.slot)]?.selected)},
      timing_step_unavailable:{type:'boolean',name:'Timing step unavailable',options:[{type:'number',id:'slot',label:'Slot',default:0,min:0,max:9}],defaultStyle:{bgcolor:0,color:theme.secondary},callback:f=>!this.editor?.timeStepChoices[Number(f.options.slot)]},
      transport_state:{type:'boolean',name:'Transport mode',options:[{type:'dropdown',id:'operation',label:'Mode',default:'play',choices:[{id:'play',label:'Play'},{id:'playsection',label:'Play to section end'},{id:'playloopsection',label:'Play loop section'},{id:'stop',label:'Stop'}]}],defaultStyle:{bgcolor:theme.active},callback:f=>f.options.operation==='stop' ? !this.editor?.playing : Boolean(this.editor?.playing && this.editor.lastPlaybackMode===f.options.operation)},
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
    await this.configUpdated(config, secrets)
  }
  getConfigFields() {
    return [
      {
        type: 'checkbox', id: 'clearMediaCache', label: 'CLEAR MEDIA CACHE', width: 12, default: false,
        tooltip: 'Select and save once to clear this connection\'s waveform/thumbnail memory and the shared local media disk cache. Media and Designer projects are unchanged. Reload open viewers afterwards.',
      },
      {
        type: 'static-text',
        id: 'info',
        label: 'Designer 32.4.17 / Companion 5.0.5',
        value:
          'VALUE rotation edits the selected key or constant; press VALUE to cycle COARSE / FINE / ULTRA. Press PARAMETER to open the 12-slot list, then turn PARAMETER to page and press a displayed parameter to select it. Use Add keyframe to insert a key. LAYER EDIT opens IN / POSITION (centre time) / OUT / FIT (length). Press a timing dial to change its step. Time presses cycle 1 frame / 0.5 / 1 / 2 / 5 / 10 / 30 seconds / 1 / 2 / 5 minutes, including while SELECT KEY is active. Press SELECT KEY again to unlock. Layers at the playhead update automatically. Numeric steps: 10% / 1% / 0.1% of the parameter range; integers use at least one.',
      },
      {type:'textinput',id:'oscHost',label:'OSC destination IP / hostname',width:8,default:'',tooltip:'Empty disables OSC output. Faders send float values 0–1 to /vehka/fader1 through /vehka/fader8.'},
      {type:'number',id:'oscPort',label:'OSC destination UDP port',width:4,default:9000,min:1,max:65535},
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
      {
        type: 'checkbox',
        id: 'viewerEnabled',
        label: 'ENABLE TIMELINE VIEWER',
        width: 8,
        default: false,
      },
      {
        type: 'checkbox',
        id: 'viewerLan',
        label: 'ALLOW LAN ACCESS',
        tooltip:
          'Allow devices on the local network to view this track without authentication. Keep disabled for this computer only.',
        width: 8,
        default: false,
      },
      {
        type: 'checkbox',
        id: 'viewerEditEnabled',
        label: 'ALLOW VIEWER EDIT',
        tooltip: 'Allow browser controls to use the shared Companion editor. LAN viewers can also edit when LAN access is enabled.',
        width: 8,
        default: false,
      },
      {
        type: 'number',
        id: 'viewerPort',
        label: 'VIEWER PORT',
        width: 4,
        default: 8765,
        min: 1024,
        max: 65535,
      },
      {
        type: 'checkbox',
        id: 'viewerShowAllParameters',
        label: 'SHOW ALL PARAMETERS',
        tooltip: 'Show constant parameters as well as animated parameters in the focused viewer layer.',
        width: 8,
        default: false,
      },
      {
        type: 'textinput',
        id: 'resourceShareRoot',
        label: 'RESOURCES: SMB D3 PROJECTS SHARE',
        width: 12,
        default: '',
        tooltip: 'UNC or smb://server/share path to D3 Projects. Empty uses local audio files.',
      },
      {
        type: 'textinput',
        id: 'resourceUsername',
        label: 'RESOURCES: SMB USERNAME',
        width: 6,
        default: '',
        tooltip: 'Leave empty only when the share permits guest access.',
      },
      { type: 'secret-text', id: 'resourcePassword', label: 'RESOURCES: SMB PASSWORD', width: 6 },
      {
        type: 'textinput',
        id: 'resourceDomain',
        label: 'RESOURCES: SMB DOMAIN (OPTIONAL)',
        width: 6,
        default: '',
      },
    ]
  }
  async configUpdated(config, secrets = {}) {
    if (this.oscValuesDirty) {
      this.flushOscFaderValues()
      config = {...config, oscFaderValues: [...this.oscFaderValues]}
    }
    clearTimeout(this.oscSaveTimer)
    clearTimeout(this.masterPublishTimer)
    this.client?.close()
    await Promise.allSettled([...(this.client?.thumbnailTasks || [])])
    const oldWaveforms = this.viewer?.waveforms
    await this.viewer?.close()
    // Finish cancelled reads/writes before clearing, so they cannot restore old peaks.
    await oldWaveforms?.tail?.catch(() => {})
    if (config.clearMediaCache) {
      config = { ...config, clearMediaCache: false }
      this.saveConfig(config)
      try {
        await new WaveformDiskCache().clear()
        this.log('info', 'Media cache cleared. Reload open viewers to refresh displayed thumbnails.')
      } catch {
        this.log('warn', 'Media disk cache could not be cleared (busy or inaccessible). Memory caches were reset; retry after other instances finish.')
      }
    }
    this.viewer = null
    this.viewerStatus = 'DISABLED'
    clearInterval(this.autoSyncTimer)
    clearInterval(this.clockDisplayTimer)
    this.clockDisplayTimer = null
    this.clockPresentation = null
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
    this.masterTransportUid = String(config.masterTransportUid || '')
    this.masterTransports = []
    this.oscFaderValues = Array.from({length:8},(_,i)=> {
      const value = config.oscFaderValues?.[i]
      return typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0
    })
    this.oscValuesDirty = false
    this.trackNavigation = config.trackNavigation === true
    this.jogLocked = config.jogLocked === true
    this.masterLevelPending = null
    this.masterLevelPromise = null
    try {
      this.client = config.demo
        ? new DemoClient()
        : new DesignerClient(config.host || '127.0.0.1', config.port ?? 80)
      this.client.viewOnly = config.viewOnly === true
      this.editor = new Editor(this.client)
      if (this.client.viewOnly) this.editor.setLinkTime(false)
      this.updateStatus(InstanceStatus.Connecting, config.demo ? 'Demo ready' : 'Connecting to Designer')
      if (!config.demo) {
        const connection = new Connection(
          this.client,
          (state, update) => {
            if (this.connection !== connection) return
            if (update?.master && update.full === false) {
              this.acceptMasterTransports(state.masterTransports)
              this.publishMaster({ names: update.names === true })
              return
            }
            if (state.contextChanged && this.editor) this.editor.stale = this.editor.contextStale = true
            if (!state.connected && this.editor?.snapshot) this.editor.stale = this.editor.contextStale = true
            if (state.trackUid && this.editor?.snapshot && state.trackUid !== this.editor.snapshot.trackUid)
              this.editor.stale = this.editor.contextStale = true
            const active = state.transports?.find(
              (t) => String(t.uid) === this.editor?.snapshot?.transportUid,
            )
            if (state.masterTransports) this.acceptMasterTransports(state.masterTransports)
            if (state.probeRevision !== this.lastProbeRevision) {
              this.lastProbeRevision = state.probeRevision
              if (active && state.probeFeedbackRevision === state.feedbackRevision && !this.editor?.busy)
                this.editor?.acceptPlaybackMode(active.playmode)
              if (
                state.connected &&
                this.editor?.snapshot &&
                (!active || String(active.currentTrack?.uid) !== this.editor.snapshot.trackUid)
              )
                this.editor.stale = this.editor.contextStale = true
            }
            if (this.editor?.snapshot && !this.editor.stale) {
              if (state.timeline) this.editor.followTimeline(state.timeline)
              else this.editor.receiveTransportTime(state.time)
            }
            const e = this.editor
            if (state.contentRevision && state.contentRevision !== this.lastContentRevision) {
              if (this.lastContentRevision && e?.snapshot && !e.busy) e.stale = true
              this.lastContentRevision = state.contentRevision
            }
            if (e && typeof state.timeline?.playing === 'boolean') e.playing = state.timeline.playing
            if (e?.snapshot && state.clock) {
              if (e.linkTime && !e.busy && state.trackUid === e.snapshot.trackUid && typeof state.clock.beatMode === 'boolean')
                e.snapshot.beatMode = state.clock.beatMode
              e.snapshot.fps = state.clock.fps
              e.snapshot.customFps = state.clock.custom
              e.snapshot.tcMode = String(state.clock.mode)
            }
            if(e?.snapshot)this.acceptClockPresentation({
              trackUid:e.snapshot.trackUid,
              time:state.fastClock?.time ?? state.timeline?.time ?? state.time ?? e.viewerTransportTime,
              playing:Boolean(state.connected && !state.contextChanged && !e.stale && e.playing),
            })
            if (
              e?.field &&
              !e.busy &&
              !e.stale &&
              state.fieldTarget?.layerUid === e.layer.uid &&
              state.fieldTarget?.name === e.field.name &&
              state.fieldValue && e.linkTime
            ) {
              e.acceptLive({ field: state.fieldValue })
            }
            if (e?.snapshot && state.connected && !e.stale)
              connection.watch(
                e.snapshot.transportUid,
                e.field ? { layerUid: e.layer.uid, name: e.field.name } : null,
              )
            this.connectionStatus()
            if (update?.full === false && update.field) this.publishField()
            else this.publish()
            if (state.connected && (!this.editor?.snapshot || this.editor.stale)) this.requestSync()
          },
          {
            enableLiveUpdate: true,
            onHeartbeat: () => {
              if (this.connection === connection) this.publish()
            },
            onClock: (state, clockSample) => {
              const e=this.editor, sample=clockSample || state.fastClock
              if(this.connection!==connection || !e?.snapshot || e.stale || sample?.trackUid!==e.snapshot.trackUid)return
              e.receiveTransportTime(sample.time)
              e.playing=sample.playing===true
              if(sample.timecodeSample)e.liveTimecodeSample=sample.timecodeSample
              this.acceptClockPresentation(sample)
              this.publishClock()
            },
          },
        )
        this.connection = connection
        void connection.start()
        this.autoSyncTimer = setInterval(() => this.requestSync(), 2000)
        this.autoSyncTimer.unref?.()
      } else await this.editor.refresh()
    } catch (error) {
      this.lastError = error.message
      this.updateStatus(InstanceStatus.BadConfig, error.message)
    }
    if (config.viewerEnabled && this.editor) {
      try {
        this.viewer = new ViewerServer(
          this.client,
          () => ({
            trackUid: this.editor?.snapshot?.trackUid,
            transportUid: this.editor?.snapshot?.transportUid,
            contentRevision: String(this.connection?.contentRevision || '') + ':' + (this.viewerEditRevision || 0),
            editRevision: this.viewerEditRevision || 0,
            focusUid: this.editor?.layer?.uid,
            parameter: this.editor?.mediaMode ? this.editor?.mediaField?.name : this.editor?.field?.name,
            layerEdit: Boolean(this.editor?.layerEdit) && Date.now() < (this.editor?.guidesUntil || 0),
            moveKey: Boolean(this.editor?.moveKey) && Date.now() < (this.editor?.guidesUntil || 0),
            keyTime: this.editor?.moveKey?.time ?? this.editor?.selectedKeyTime,
            liveValue: this.editor?.value,
            editPatch: Date.now()-(this.viewerLivePatchAt || 0)<500 ? this.viewerLivePatch : undefined,
            clockSeek: this.editor?.pendingJump,
            clockFps: this.editor?.snapshot?.fps || 25,
            time: this.editor?.viewerTransportTime,
            timecode: absoluteTimecode(
              this.editor?.viewerTransportTime,
              this.editor?.snapshot?.fps || 25,
              false,
              this.editor?.timecodeSamples,
              this.editor?.liveTimecodeSample,
            ),
            playing: Boolean(this.editor?.playing),
            connected: Boolean(this.connection?.connected) && !this.lastError,
            synchronizing: this.viewerSynchronizing(),
            viewOnly: this.client.viewOnly === true,
            editEnabled: config.viewerEditEnabled === true && !this.client.viewOnly && !this.viewerSynchronizing(),
            editor: describeEditor(this.editor),
          }),
          {
            contextChanged: (expected, next) => {
              if (this.editor?.snapshot?.transportUid !== expected.transportUid || this.editor?.snapshot?.trackUid !== expected.trackUid) return
              this.connection?.noteContextChange(next)
            },
            viewMode: async enabled => {
              if (!this.connection?.connected || this.lastError) return {ok:false,reason:'CONNECTION UNAVAILABLE'}
              // Lock synchronously before waiting for an existing action. Commands
              // already sent cannot be recalled; queued actions are discarded.
              if (enabled) this.client.viewOnly = true
              this.queueGeneration++
              await this.actionTail
              this.client.viewOnly = enabled
              if (enabled) { this.editor.setLinkTime(false); this.editor.clearViewEditing() }
              this.config.viewOnly = enabled
              this.saveConfig(this.config)
              this.viewerEditRevision = (this.viewerEditRevision || 0) + 1
              this.publish()
              return {ok:true,viewOnly:enabled,editor:describeEditor(this.editor)}
            },
            showAll: config.viewerShowAllParameters === true,
            resources: config.viewerEditEnabled === true ? async offset => {
              if (this.editor?.mediaMode && Date.now() - (this.lastViewerResourceRead || 0) > 2500) {
                this.lastViewerResourceRead = Date.now()
                let failed = false
                await this.perform(async editor => {
                  if (!editor.mediaMode) return
                  try { await editor.loadMedia({preserve:true,preservePreview:true}) }
                  catch { failed = true }
                })
                if (failed) throw new Error('Resource listing unavailable')
              }
              return resourceList(this.editor, offset)
            } : undefined,
            edit: config.viewerEditEnabled === true ? async (target) => {
              if (this.client.viewOnly) return {ok:false,reason:'VIEW ONLY'}
              let result = { ok: false, reason: 'EDITOR CHANGED — TRY AGAIN' }
              await this.perform(async editor => {
                if (!this.connection?.connected) {
                  result = { ok: false, reason: 'DESIGNER IS NOT CONNECTED' }
                  return
                }
                try {
                  if (this.client.viewOnly) { result = {ok:false,reason:'VIEW ONLY'}; return }
                  result = await editFromViewer(editor, target)
                  if (result.ok && editor.layer) result.patch = {trackUid:editor.snapshot.trackUid,layer:structuredClone(editor.layer)}
                }
                catch {
                  editor.stale = true
                  result = { ok: false, reason: 'EDIT NOT CONFIRMED — REFRESHING DESIGNER STATE' }
                }
              })
              result.editRevision = this.viewerEditRevision || 0
              return result
            } : undefined,
            resourceDesignerRoot: config.resourceDesignerRoot || '',
            resourceShareRoot: config.resourceShareRoot || '',
            resourceUsername: config.resourceUsername || '',
            resourceDomain: config.resourceDomain || '',
            resourcePassword: secrets.resourcePassword || '',
            seek: async (target) => {
              let result = { ok: false, reason: 'Seek unavailable' }
              await this.perform(
                async (editor) => {
                  try {
                    result = await editor.seekFromViewer(target)
                    if (result.ok) result.editor = describeEditor(editor)
                  } catch {
                    result = { ok: false, reason: 'Designer seek could not be completed' }
                  }
                },
                { synchronise: false },
              )
              if (result.ok) result.editRevision = this.viewerEditRevision || 0
              return result
            },
            select: async (target) => {
              let result = { ok: false, reason: 'Selection is unavailable; retry after synchronisation' }
              await this.perform(
                async (editor) => {
                  try {
                    result = await editor.selectFromViewer(target)
                    if (result.ok && config.viewerEditEnabled === true) result.editor = describeEditor(editor)
                  } catch {
                    result = { ok: false, reason: 'Designer selection could not be refreshed' }
                  }
                },
                { synchronise: false },
              )
              return result
            },
          },
        )
        const port = await this.viewer.start(Number(config.viewerPort ?? 8765), config.viewerLan === true)
        this.viewerStatus = `LISTENING ON ${port}`
      } catch (error) {
        await this.viewer?.close()
        this.viewer = null
        this.viewerStatus = error.code === 'EADDRINUSE' ? 'VIEWER PORT IN USE' : 'VIEWER UNAVAILABLE'
        this.log('warn', this.viewerStatus)
      }
    }
    this.publish()
  }
  viewerSynchronizing() {
    // Content refreshes keep the same transport usable. Only identity changes,
    // reconnects and initial loading invalidate the entire viewer and its clock.
    return !this.editor?.snapshot || Boolean(this.editor.contextStale || this.connection?.contextChanged)
  }
  requestSync() {
    if (
      !this.connection?.connected ||
      this.connection?.contextAvailable === false ||
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
      if (this.editor === editor) {
        this.syncPending = false
        // The one-second delay is failure backoff, not a pause after every edit.
        if (!editor.stale) this.nextSyncAttempt = 0
      }
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
  performDetents(key, direction, fn, options = {}) {
    if (direction !== -1 && direction !== 1) return Promise.reject(new Error('Direction must be -1 or 1'))
    const pending=this.pendingDetents
    if(pending && !pending.started && pending.key===key && pending.editor===this.editor && pending.generation===this.queueGeneration) {
      // Keep one trailing command. Reversals cancel unsent movement and a fast
      // spin saturates instead of creating a long queue that runs after release.
      pending.detents=Math.max(-64,Math.min(64,pending.detents+direction))
      return pending.promise
    }
    const batch={key,detents:direction,editor:this.editor,generation:this.queueGeneration,started:false}
    const run=this.actionTail.then(async()=>{
      if(batch.editor!==this.editor || batch.generation!==this.queueGeneration)return
      batch.started=true
      if(this.pendingDetents===batch)this.pendingDetents=null
      const detents=batch.detents
      if(detents)await this.performNow(editor=>fn(editor,Math.sign(detents),Math.abs(detents)),options)
    })
    batch.promise=run
    this.actionTail=run.catch(()=>{})
    this.pendingDetents=batch
    return run
  }
  zoomDesignerTimeline(steps) {
    if (!Number.isInteger(steps) || !steps || this.config?.demo || this.client?.viewOnly || this.config?.viewOnly || !this.client)
      return Promise.resolve()
    const client = this.client
    let queue = this.designerZoomQueue
    if (queue?.client === client) {
      queue.steps = Math.max(-8, Math.min(8, queue.steps + steps))
      return queue.promise
    }
    queue = {client, steps: Math.max(-8, Math.min(8, steps))}
    this.designerZoomQueue = queue
    queue.promise = Promise.resolve().then(async () => {
      try {
        while (queue.steps && this.client === client) {
          const steps = queue.steps
          queue.steps = 0
          await client.execute('timeline_zoom', {steps})
        }
      } catch (error) {
        // Relative UI commands must not be retried after an uncertain response.
        queue.steps = 0
        if (this.client === client) {
          this.lastError = error.message
          this.log('warn', error.message)
          this.setVariableValues({last_error: error.message})
        }
      } finally {
        if (this.designerZoomQueue === queue) this.designerZoomQueue = null
      }
    })
    return queue.promise
  }
  acceptMasterTransports(transports) {
    this.masterTransports = (transports || []).slice(0,8).map((transport) => ({ ...transport }))
    if (!this.masterTargetSlots().some((transport) => transport?.uid === this.masterTransportUid)) {
      const activeUid = String(this.editor?.snapshot?.transportUid || '')
      this.masterTransportUid =
        this.masterTransports.find((transport) => transport.uid === activeUid)?.uid ||
        this.masterTransports[0]?.uid ||
        ''
    }
  }
  masterTargetSlots() {
    return [
      ...Array.from({length:8},(_,i)=>this.masterTransports?.[i]),
      ...Array.from({length:8},(_,i)=>({uid:'osc:fader'+(i+1),name:'OSC FADER '+(i+1),oscIndex:i,
        brightness:this.oscFaderValues?.[i] ?? 0,volume:this.oscFaderValues?.[i] ?? 0})),
    ]
  }
  masterTransport() {
    return this.masterTargetSlots().find(target => target?.uid === this.masterTransportUid)
  }
  flushOscFaderValues() {
    clearTimeout(this.oscSaveTimer)
    this.oscSaveTimer = null
    if (!this.oscValuesDirty) return
    this.config.oscFaderValues = [...this.oscFaderValues]
    this.oscValuesDirty = false
    this.saveConfig(this.config)
  }
  setOscFaderLevel(index, percent) {
    const host = String(this.config.oscHost || '').trim()
    const port = Number(this.config.oscPort ?? 9000)
    if (!host || /[\s/]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
      this.lastError = 'Configure a valid OSC destination and UDP port in module settings'
      this.log('warn', this.lastError)
      this.setVariableValues({last_error:this.lastError})
      return Promise.resolve()
    }
    const value = Math.round(percent * 10) / 1000
    try {
      this.oscSend(host, port, '/vehka/fader'+(index+1), [{type:'f',value}])
      this.oscFaderValues ||= Array(8).fill(0)
      this.oscFaderValues[index] = value
      this.oscValuesDirty = true
      if (!this.oscSaveTimer) {
        this.oscSaveTimer = setTimeout(()=>this.flushOscFaderValues(),250)
        this.oscSaveTimer.unref?.()
      }
      this.publishMaster()
    } catch(error) {
      this.lastError = error.message
      this.log('warn', error.message)
      this.setVariableValues({last_error:this.lastError})
    }
    return Promise.resolve()
  }
  masterVariableValues(names = false) {
    const master = this.masterTransport()
    const targets = this.masterTargetSlots().filter(Boolean)
    const index = targets.findIndex(target => target.uid === master?.uid)
    const brightness = Number(master?.brightness), volume = Number(master?.volume)
    const brightnessPercent = Number.isFinite(brightness) ? Math.round(brightness * 1000) / 10 : ''
    const volumePercent = Number.isFinite(volume) ? Math.round(volume * 1000) / 10 : ''
    const level = Number.isFinite(brightness) && Number.isFinite(volume)
      ? Math.round(Math.min(brightness, volume) * 1000) / 10
      : Number.isFinite(brightness) ? brightnessPercent : volumePercent
    return {
      ...(names ? Object.fromEntries(Array.from({length:42},(_,i)=>['master_transport_'+(i+1),this.masterTargetSlots()[i]?.name || ''])) : {}),
      ...Object.fromEntries(Array.from({length:8},(_,i)=>['osc_fader_'+(i+1),this.oscFaderValues?.[i] ?? 0])),
      master_transport: master?.name || 'NO TRANSPORT',
      master_transport_position: master ? `${index + 1}/${targets.length}` : '0/0',
      transport_master_level: level,
      transport_master_brightness: brightnessPercent,
      transport_master_volume: volumePercent,
      transport_master_detail: master?.oscIndex !== undefined ? '/vehka/fader'+(master.oscIndex+1)+' = '+(this.oscFaderValues?.[master.oscIndex] ?? 0) : master ? `B ${brightnessPercent}% / V ${volumePercent}%` : 'NO TRANSPORT',
      transport_master_mismatch: Number.isFinite(brightness) && Number.isFinite(volume) && Math.abs(brightness-volume)>0.0005,
    }
  }
  publishMaster({ names = false } = {}) {
    this.setVariableValues(this.masterVariableValues(names))
    this.checkFeedbacks('transport_master_selected')
  }
  scheduleMasterPublish() {
    clearTimeout(this.masterPublishTimer)
    this.masterPublishTimer=setTimeout(()=>{this.masterPublishTimer=null;this.publishMaster()},0)
    this.masterPublishTimer.unref?.()
  }
  publishField() {
    const e=this.editor
    if(!e?.field)return
    this.setVariableValues({value:e.value,value_label:e.valueLabel,dirty:Boolean(e.dirty),...(!e.parameterBrowser ? {dial_value_2:String(e.valueLabel).toUpperCase()} : {})})
    this.checkFeedbacks('dirty')
  }
  selectMasterTransport(direction) {
    const transports = this.masterTargetSlots().filter(Boolean)
    if (!transports.length || (direction !== -1 && direction !== 1)) return
    const current = Math.max(0, transports.findIndex((transport) => transport.uid === this.masterTransportUid))
    const index = Math.max(0, Math.min(transports.length - 1, current + direction))
    if (transports[index].uid === this.masterTransportUid) return
    this.masterTransportUid = transports[index].uid
    // A pending physical value belongs to the transport selected when it was
    // received. Never replay it onto a newly selected transport.
    this.masterLevelPending = null
    this.config.masterTransportUid = this.masterTransportUid
    this.saveConfig(this.config)
    this.scheduleMasterPublish()
  }
  selectMasterTransportSlot(index) {
    const transport = Number.isInteger(index) ? this.masterTargetSlots()[index] : undefined
    if (!transport) return
    if (transport.uid === this.masterTransportUid) return
    this.masterTransportUid = transport.uid
    this.masterLevelPending = null
    this.config.masterTransportUid = this.masterTransportUid
    this.saveConfig(this.config)
    this.scheduleMasterPublish()
  }
  toggleTrackNavigation() {
    this.trackNavigation = !this.trackNavigation
    this.config.trackNavigation = this.trackNavigation
    this.saveConfig(this.config)
    this.setVariableValues({ navigation_mode: this.trackNavigation ? 'TRACK' : 'SECTION' })
    this.checkFeedbacks('navigation_track')
  }
  toggleJogLock() {
    this.jogLocked = !this.jogLocked
    this.pendingDetents = null
    this.config.jogLocked = this.jogLocked
    this.saveConfig(this.config)
    this.publish()
  }
  async refreshMasterTransports() {
    try {
      await this.connection?.refreshMasterTransports()
    } catch (error) {
      this.lastError = error.message
      this.log('warn', error.message)
      this.connectionStatus()
      this.setVariableValues({ last_error: this.lastError })
    }
  }
  setTransportMasterLevel(percent) {
    percent = Number(percent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100)
      return Promise.reject(new Error('Master level must be 0–100'))
    if (this.client?.viewOnly || this.config?.viewOnly) return Promise.resolve()
    const target = this.masterTransport()
    if (target?.oscIndex !== undefined) return this.setOscFaderLevel(target.oscIndex, percent)
    const uid = this.masterTransportUid
    if (!this.masterTransports?.some((transport) => transport.uid === uid))
      return Promise.reject(new Error('Select a transport for the master fader'))
    // Keep at most one in-flight write and the newest absolute fader value.
    // Intermediate positions are disposable; the final physical position is not.
    this.masterLevelPending = { uid, percent: Math.round(percent * 10) / 10 }
    if (this.masterLevelPromise) return this.masterLevelPromise
    const drain = async () => {
      try {
        while (this.masterLevelPending) {
          const request = this.masterLevelPending
          this.masterLevelPending = null
          this.connection?.invalidateMasterFeedback?.()
          await this.client.setTransportMaster(request.uid, request.percent / 100)
          this.connection?.invalidateMasterFeedback?.()
          const transport = this.masterTransports.find((item) => item.uid === request.uid)
          if (transport) transport.brightness = transport.volume = request.percent / 100
          const cached = this.connection?.masterTransports?.find((item) => item.uid === request.uid)
          if (cached) cached.brightness = cached.volume = request.percent / 100
          this.lastError = ''
          this.connectionStatus()
          this.publishMaster()
        }
      } catch (error) {
        this.masterLevelPending = null
        this.lastError = error.message
        this.log('warn', error.message)
        this.connectionStatus()
        this.publish()
      } finally {
        this.masterLevelPromise = null
        if (this.masterLevelPending) void this.setTransportMasterLevel(this.masterLevelPending.percent)
      }
    }
    this.masterLevelPromise = drain()
    return this.masterLevelPromise
  }
  perform(fn, options = {}) {
    // Any nonmatching action is a barrier: never combine turns across a click,
    // a reversal, a precision change or another controller's edit.
    this.pendingDetents=null
    // Buttons remain strict barriers around the single trailing dial command.
    // A failed action invalidates queued work from that generation.
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
    const connection = this.connection
    connection?.invalidateFeedback?.()
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
          connection?.watch(editor.snapshot.transportUid, editor.field ? {layerUid:editor.layer.uid,name:editor.field.name} : null)
          this.connectionStatus()
          this.publish()
          return
        }
      }
      const valueEditBefore=editor.valueEditRevision || 0
      await fn(editor)
      if (!scrub || editor.moveKey || editor.layerEdit) this.viewerEditRevision = (this.viewerEditRevision || 0) + 1
      if (editor !== this.editor) return
      if(editor.layer && (editor.moveKey || editor.layerEdit || (editor.valueEditRevision || 0)!==valueEditBefore)) {
        this.viewerLivePatchAt=Date.now()
        this.viewerLivePatch={revision:this.viewerEditRevision,trackUid:editor.snapshot.trackUid,layer:structuredClone({uid:editor.layer.uid,start:editor.layer.start,end:editor.layer.end,fields:editor.layerEdit ? editor.layer.fields : editor.field ? [editor.field] : []})}
      }
      this.lastError = ''
      if (editor.snapshot && this.connection?.connected)
        this.connection.watch(
          editor.snapshot.transportUid,
          editor.field ? { layerUid: editor.layer.uid, name: editor.field.name } : null,
        )
      this.connectionStatus()
    } catch (error) {
      if (editor !== this.editor) return
      if (error.code === 'CONTEXT_CHANGED') {
        editor.stale = editor.contextStale = true
        this.lastError = ''
        this.queueGeneration++
        connection?.noteContextChange(error.context)
        this.connectionStatus()
        this.publish()
        return
      }
      if (error.code === 'VIEW_ONLY') {
        editor.clearViewEditing(); this.lastError = ''; this.connectionStatus(); this.publish(); return
      }
      this.lastError = error.message
      this.queueGeneration++
      this.log('warn', error.message)
      this.updateStatus(InstanceStatus.UnknownError, error.message)
    } finally {
      connection?.invalidateFeedback?.()
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
      // A metadata refresh is normal while changing tracks/layers. The HTTP
      // connection is still healthy; Connecting flashes warnings on every key.
      this.updateStatus(
        this.editor.snapshot ? InstanceStatus.Ok : InstanceStatus.Connecting,
        'Synchronising Designer changes',
      )
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
    const bound = (value) => (Number.isFinite(value) ? String(Number(value.toPrecision(7))) : '—')
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
    const presented=this.presentationTimes()
    const clockTc=value=>e?.playing && e?.liveTimecodeSample ? anchoredTimecode(value,rate,drop,e.liveTimecodeSample) : tc(value)
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
    const masterVars=this.masterVariableValues(true)
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
      'PREV\nKEYFRAME',
      'NEXT\nKEYFRAME',
      layerMode || 'LAYER\nEDIT',
      'LINK\nTIME',
      'SELECT\nKEYFRAME',
      e?.canResetDefault ? 'DEFAULT' : 'DELETE\nKEYFRAME',
      'TYPE\n' + keyType,
      'RESOURCES',
    ]
    const padColors = [
      theme.groups.navigation,
      theme.groups.navigation,
      layerMode ? theme.active : theme.groups.layer,
      e?.linkTime ? theme.active : theme.groups.playback,
      e?.moveKey ? theme.active : theme.groups.keyEdit,
      theme.groups.keyEdit,
      theme.groups.keyEdit,
      theme.groups.resources,
    ]
    // Use the primary button background as well as the small page indicator,
    // so the completed hold is visible on existing pages and physical surfaces.
    if (deleteReady) padColors[5] = 0xb02028
    if (e?.clearKeysBrowser && !e.clearKeysTargetValid()) e.closeClearKeys()
    if (e?.parameterBrowser && !e.validParameterBrowser()) e.parameterBrowser = null
    const parameterBrowser = e?.parameterBrowser
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
    if (parameterBrowser) {
      for (let i=0;i<8;i++) {
        const index=parameterBrowser.page*12+i, field=e.layer.fields[index]
        padLabels[i]=field?.label || field?.name || ''
        padColors[i]=field ? index===e.fieldIndex ? theme.active : theme.surface : theme.background
      }
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
      padVars[`pad_folder_${i}`] = ''
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
      mediaMode ? 'FILE / PREVIEW' : (e?.precision || 'coarse').toUpperCase(),
      e?.timeStepLabel || '',
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
          : bound(e?.field?.min) + '–' + bound(e?.field?.max),
      mediaMode
        ? `${e.mediaIndex + 1} / ${e.mediaItems.length}   PAGE ${e.mediaPage + 1}/${Math.max(1, Math.ceil(e.mediaItems.length / 8))}`
        : e?.field?.sequenced
          ? 'SELECTED KEYFRAME'
          : 'LIVE CONSTANT',
      'KF ◀ ' + (prev ? fmt(e.time - prev.time) : '—') + ' / KF ▶ ' + (next ? fmt(next.time - e.time) : '—'),
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
    padVars.dial_value_3 = clockTc(presented.edit)
    padVars.dial_info_0 = e?.layer ? 'IN ' + tc(e.layer.start) + '\nOUT ' + tc(e.layer.end) : 'AUTO SYNC'
    padVars.dial_info_2 = mediaMode
      ? `${e.mediaIndex + 1}/${e.mediaItems.length}  PAGE ${e.mediaPage + 1}/${Math.max(1, Math.ceil(e.mediaItems.length / 8))}`
      : e?.field?.sequenced
        ? 'KF ' + tc(here?.time)
        : 'CONSTANT'
    padVars.dial_info_3 =
      'KF ◀ ' +
      duration(prev ? e.time - prev.time : undefined) +
      '\nKF ▶ ' +
      duration(next ? next.time - e.time : undefined)
    if (mediaMode) {
      padVars.dial_title_0 = 'SOURCE ' + (e.mediaFieldIndex + 1) + '/' + (e.layer?.mediaFields?.length || 0)
      padVars.dial_value_0 = readable(e.mediaField?.label || 'No resources')
      padVars.dial_info_0 = e.mediaKeyframe
        ? 'MODE: KEYFRAME'
        : e.mediaCanAnimate
          ? 'MODE: REPLACE'
          : 'CONSTANT ONLY'
      padVars.dial_title_2 = e.mediaKeyframe ? 'KEYFRAME' : 'RESOURCES'
      padVars.dial_value_2 = readable(
        e.currentMedia?.name || (e.mediaItems.length ? 'Select resource' : 'No resources'),
        true,
      )
      padVars.dial_title_3 = ''
      padVars.dial_value_3 = 'BACK'
      padVars.dial_info_3 = e.mediaKeyframe ? tc(e.time) : ''
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
      padVars.dial_title_0 = 'DELETE ALL KEYFRAMES'
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
    if (this.viewer?.zoomAvailable() && this.viewer.zoomMode && !mediaMode && !e?.layerEdit && !e?.moveKey && !clearBrowser) {
      padVars.dial_title_0 = 'ZOOM'
      padVars.dial_value_0 = 'VIEWER'
      padVars.dial_info_0 = '− / +'
    }
    if (parameterBrowser) {
      const pages=Math.max(1,Math.ceil(e.layer.fields.length/12))
      padVars.delete_hint=''
      padVars.delete_ready=false
      for(let i=0;i<4;i++) {
        const field=e.layer.fields[parameterBrowser.page*12+8+i]
        padVars['dial_title_'+i]='PARAMETERS '+(parameterBrowser.page+1)+'/'+pages
        padVars['dial_value_'+i]=field?.label || field?.name || ''
        padVars['dial_info_'+i]=field && field.name===e.field?.name ? 'SELECTED' : ''
      }
    }
    if(e?.moveKey?.group){padVars.dial_value_2=e.moveKey.group.length+' KEYFRAMES';padVars.dial_info_2='MOVE / DELETE';padVars.dial_title_2='GROUP'}
    // Capitalise display text only. Resource paths, parameter IDs, image data
    // and public raw-value variables must retain their original case.
    for (const name of Object.keys(padVars)) {
      if (/^(pad_\d+|pad_(folder|kind)_\d+|dial_(title|value|info)_\d+)$/.test(name))
        padVars[name] = String(padVars[name]).toUpperCase()
    }
    this.setVariableValues({
      ...padVars,
      ...masterVars,
      ui_mode: parameterBrowser ? 'PARAMETER_LIST' : clearBrowser ? 'CLEAR_KEYS' : mediaMode ? 'MEDIA' : 'PARAMS',
      folder: e?.mediaFolder || '',
      media_name: e?.currentMedia?.name || '',
      media_field: e?.mediaField?.label || '',
      media_position: `${(e?.mediaIndex ?? -1) + 1}/${e?.mediaItems.length || 0}`,
      playing: Boolean(e?.playing),
      time_entry: e?.timeEntryDigits ? e.timeEntryLabel : clockTc(presented.edit),
      time_entry_active: Boolean(e?.timeEntryDigits),
      playback_label: playbackLabel,
      parameter_animated: Boolean(!parameterBrowser && !clearBrowser && !e?.layerEdit && e?.field?.sequenced && keys.length > 1),
      track: e?.snapshot?.trackName || '',
      layer: e?.layer?.name || 'No active layer',
      layer_type: layerTypeLabel(e?.layer?.moduleType).toUpperCase(),
      parameter: e?.field?.label || e?.field?.name || '',
      parameter_id: e?.field?.name || '',
      parameter_min: e?.field?.min ?? '-',
      parameter_max: e?.field?.max ?? '-',
      parameter_step: e?.field?.step ?? '-',
      value_label: e?.valueLabel ?? '',
      time_step: e?.timeStepLabel ?? '',
      ...Object.fromEntries(Array.from({length:10},(_,i)=>['timing_step_'+i,e?.timeStepChoices[i]?.label || '—'])),
      fps: e?.snapshot?.fps ?? '',
      layer_edit: layerMode || 'SCRUB',
      selected_key_time: here?.time ?? '',
      tc_mode: (e?.snapshot?.customFps ? 'CUSTOM ' : '') + (e?.snapshot?.tcMode || ''),
      move_key: e?.moveKey ? 'MOVE KEY' : 'SCRUB',
      key_type: here ? { 0: 'HOLD', 1: 'LINEAR', 2: 'SMOOTH' }[here.interpolation] || '-' : '-',
      active_layers: e?.activeLayers.length ?? 0,
      layer_position: e ? e.activeLayers.indexOf(e.layer) + 1 : 0,
      layer_elapsed: e?.layer ? fmt(presented.edit - (e.layer.start ?? 0)) : '-',
      layer_remaining: e?.layer ? fmt(e.layer.end - presented.edit) : '-',
      layer_uid: e?.layer?.uid || '',
      viewer_status: this.viewerStatus || 'DISABLED',
      key_previous_distance: prev ? fmt(e.time - prev.time) : '-',
      key_next_distance: next ? fmt(next.time - e.time) : '-',
      value: e?.value ?? 0,
      time: presented.edit ?? 0,
      step_mode: (e?.precision || 'coarse').toUpperCase(),
      key_count: e?.field?.keys.length ?? 0,
      dirty: Boolean(e?.dirty),
      mode: this.config?.demo ? 'DEMO' : 'DESIGNER',
      last_error: this.lastError || '',
      connected: Boolean(this.connection?.connected),
      heartbeat: Boolean(this.connection?.heartbeat),
      live_connected: Boolean(this.connection?.live),
      live_time: Number.isFinite(presented.live) ? presented.live : '',
      timecode: clockTc(presented.edit),
      live_timecode: clockTc(Number.isFinite(presented.live) ? presented.live : presented.edit),
      connection_status: this.config?.demo
        ? 'DEMO'
        : this.connection?.connected
          ? this.connection.live
            ? 'HTTP + LIVE'
            : this.connection.polling
              ? 'HTTP + SYNC'
              : 'HTTP'
          : 'DISCONNECTED',
      navigation_mode: this.trackNavigation ? 'TRACK' : 'SECTION',
      jog_locked: Boolean(this.jogLocked),
      jog_lock_label: this.jogLocked ? 'LOCKED' : 'ACTIVE',
    })
    this.checkFeedbacks('navigation_track', 'fine', 'dirty', 'connected', 'link_time', 'jog_locked', 'transport_master_selected', 'timing_step_selected', 'timing_step_unavailable', 'transport_state')
    void this.loadThumbnails()
  }
  publishClock() {
    const e=this.editor
    if(!e?.snapshot)return
    const rate=e.snapshot.fps
    const drop=!e.snapshot.customFps && /(?:^|\s)DF$/.test(e.snapshot.tcMode || '')
    const tc=value=>absoluteTimecode(value,rate,drop,e.timecodeSamples,e.liveTimecodeSample)
    const {live,edit}=this.presentationTimes()
    const clockTc=value=>e.playing && e.liveTimecodeSample ? anchoredTimecode(value,rate,drop,e.liveTimecodeSample) : tc(value)
    const values={
      playing:Boolean(e.playing),
      playback_label:e.playing ? 'STOP' : 'PLAY\nSECTION',
      time:edit ?? 0,
      live_time:Number.isFinite(live) ? live : '',
      timecode:clockTc(edit),
      live_timecode:clockTc(Number.isFinite(live) ? live : edit),
      layer_elapsed:e.layer && Number.isFinite(edit) ? String(Number((edit-e.layer.start).toFixed(3))) : '-',
      layer_remaining:e.layer && Number.isFinite(edit) ? String(Number((e.layer.end-edit).toFixed(3))) : '-',
    }
    if(!e.timeEntryDigits)values.time_entry=values.timecode
    if(!e.parameterBrowser && !e.mediaMode && !e.layerEdit && !e.clearKeysBrowser)values.dial_value_3=values.timecode.toUpperCase()
    this.setVariableValues(values)
    this.checkFeedbacks('transport_state')
  }
  presentationTimes() {
    const e=this.editor,confirmed=this.connection?.time
    if(!e?.snapshot)return {live:confirmed,edit:e?.time}
    const live=extrapolatedPlayback(this.clockPresentation,{
      trackUid:e.snapshot.trackUid,time:Number.isFinite(confirmed)?confirmed:e.viewerTransportTime,
      playing:Boolean(e.playing),connected:Boolean(this.connection?.connected),length:e.snapshot.length,
    },Date.now(),750)
    return {live,edit:e.linkTime && Number.isFinite(live) ? live : e.time}
  }
  acceptClockPresentation(sample) {
    this.clockPresentation=acceptPlaybackSample(this.clockPresentation,sample,Date.now())
    if(sample?.playing===true && !this.clockDisplayTimer) {
      this.clockDisplayTimer=setInterval(()=>this.publishClock(),40)
      this.clockDisplayTimer.unref?.()
    } else if(sample?.playing!==true && this.clockDisplayTimer) {
      clearInterval(this.clockDisplayTimer)
      this.clockDisplayTimer=null
    }
  }
  async destroy() {
    this.flushOscFaderValues()
    await this.viewer?.close()
    clearTimeout(this.deleteHoldTimer)
    clearInterval(this.autoSyncTimer)
    clearInterval(this.clockDisplayTimer)
    clearTimeout(this.masterPublishTimer)
    this.connection?.close()
    this.connection = null
    this.client?.close()
    this.editor = null
  }
}

module.exports = { DisguiseLayerControl }
