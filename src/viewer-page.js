'use strict'
const brandLogo = require('./viewer-logo.json')
const { applyEditPatch } = require('./viewer-edit-model')
const { discreteSegments } = require('./viewer-discrete')

// Embedded at bundle time: the packaged module needs no external web runtime.
// All project strings reach the DOM through textContent, never HTML parsing.
function browserMain(applyEditPatch, discreteSegments) {
  const $ = (id) => document.getElementById(id)
  const viewport = $('viewport'),
    sheet = $('sheet')
  let state,
    start = 0,
    span = 60,
    follow = true,
    frame = 0,
    targetStart = 0,
    rendered = '',
    trackUid
  let trackWaveHeight = 64
  let trackBars = false
  const parameterModes = new Map()
  const expandedLayers = () => [...parameterModes].filter(([,mode]) => mode !== 'none').map(([uid]) => uid).slice(0,16)
  const waveformOpen = new Set(),
    waveformHeights = new Map()
  let lastFullRead = 0,
    lastView = ''
  let displayedTime = null
  let resizingWaveform = false
  let editPending = false
  let mouseGesture = null
  let suppressClickUntil = 0
  let renderedEditor = ''
  let resourceBranch = ''
  let resourceFolderContext = ''
  let interactionBusy = false
  let clickTimer
  let editRevision = 0
  let confirmedRevision = 0
  const snapOptions = {enabled:true,edges:true,keys:true,markers:true,sections:true,grid:true}
  let snapGuide
  function showSnap(time) {
    snapGuide?.remove(); snapGuide = null
    if (!Number.isFinite(time)) return
    snapGuide = el('i','snap-guide')
    snapGuide.style.left = 'calc(240px + (100% - 240px) * '+x(time)/100+')'
    sheet.append(snapGuide)
  }
  function snapPoints(excludeLayer, parameter, keyTime, annotation, options=snapOptions) {
    const points = []
    const keyTargets = new Set()
    for (const layer of state.layers || []) {
      if (layer.uid === excludeLayer && parameter === undefined) continue
      if (options.edges) points.push(layer.start,layer.end)
      if (options.keys) for (const field of [...(layer.fields || []),...(layer.resources || [])]) {
        if (!field.sequenced) continue
        for (const key of field.keys || []) {
          if (key.time < layer.start || key.time > layer.end) continue
          if (layer.uid === excludeLayer && field.name === parameter && Math.abs(key.time-keyTime) < 1e-6) continue
          points.push(key.time)
          keyTargets.add(key.time)
        }
      }
    }
    if (options.markers) for (const item of [...(state.annotations?.tags || []),...(state.annotations?.notes || [])]) {
      if (annotation && Math.abs(item.time-annotation.time) < 1e-6) continue
      points.push(item.time)
    }
    if (options.sections) for (const section of state.sections || []) points.push(section.start,section.end)
    const gridTargets = new Map()
    if (options.grid) for (const tick of state.grid || []) {
      if (tick.snapGrid && tick.time >= start && tick.time <= start+span) { points.push(tick.time); gridTargets.set(tick.time,tick.snapGrid) }
    }
    const targets = [...new Set(points.filter(t=>Number.isFinite(t) && t>=0 && t<=state.length))].sort((a,b)=>a-b)
    targets.gridTargets = gridTargets
    targets.keyTargets = [...keyTargets].sort((a,b)=>a-b)
    return targets
  }
  function updateDragGuides(gesture) {
    const e=state.editor
    for(const line of sheet.querySelectorAll('.alignment-guide')) line.remove()
    const points=gesture.keyMode ? [e.moveKey?.time] : [e.layerStart,e.layerEnd]
    for(const time of points) {
      if(!Number.isFinite(time))continue
      const matched=gesture.alignmentPoints.some(t=>Math.abs(t-time)<1e-6)
      if(gesture.keyMode && !matched)continue
      const line=el('i','alignment-guide'+(matched?' matched':''))
      line.style.left='calc(240px + (100% - 240px) * '+x(time)/100+')'
      sheet.append(line)
    }
  }
  function snappedTime(raw,points,bypass,width,offset=0) {
    let best = {time:raw,snap:false,snapOffset:0}, distance = Infinity, priority = Infinity
    if (snapOptions.enabled && !bypass) for (const anchor of offset ? [0,offset] : [0]) {
      const target = raw+anchor
      // Keyframes win over nearby grid lines; keep the search logarithmic even
      // when many collapsed layers contain thousands of keys.
      for (const [candidates,rank] of [[points.keyTargets || [],0],[points,1]]) {
      let low=0,high=points.length
      high=candidates.length
      while (low<high) { const mid=(low+high)>>1; if(candidates[mid]<target) low=mid+1; else high=mid }
      for (const index of [low-1,low]) {
        const time = candidates[index], pixels = Math.abs(time-target)*width/span
        if (pixels<=10 && (rank<priority || rank===priority && pixels<distance)) {
          distance=pixels;priority=rank
          best={time:time-anchor,snap:true,snapOffset:anchor,...(rank && points.gridTargets?.has(time) ? {snapGrid:points.gridTargets.get(time)} : {})}
        }
      }
      }
    }
    showSnap(best.snap ? best.time+best.snapOffset : null)
    return best
  }
  const snapButton = document.createElement('button')
  const linkTimeButton=document.createElement('button')
  linkTimeButton.textContent='LINK TIME';linkTimeButton.title='PLAYHEAD FOLLOWS MOUSE AND STREAM DECK EDITS'
  linkTimeButton.setAttribute('aria-pressed','true')
  linkTimeButton.onclick=()=>void interact(()=>sendEdit('link_time',{enabled:!state.editor.linkTime}))
  $('follow').after(linkTimeButton)
  const addLayers=document.createElement('div')
  addLayers.className='add-layers'
  addLayers.setAttribute('role','group');addLayers.setAttribute('aria-label','ADD LAYER')
  Object.assign(addLayers.style,{display:'flex',gap:'4px',paddingRight:'10px',marginRight:'3px',borderRight:'1px solid #34444d'})
  for(const kind of ['video','audio','bitmap']) {
    const b=document.createElement('button');b.textContent='+'+kind.toUpperCase();b.title='ADD '+kind.toUpperCase()+' AT PLAYHEAD'
    b.onclick=()=>void interact(async()=>{
      const trackUid=state.trackUid,targetTime=editClock()
      if(await releaseViewerMode()) await sendEdit('layer_manage',{operation:'create',trackUid,kind,targetTime})
    })
    addLayers.append(b)
  }
  $('fitTrack').before(addLayers)
  snapButton.textContent = 'SNAP ON ▾'
  snapButton.title = 'SNAP SETTINGS · ALT BYPASSES SNAP'
  $('fitLayer').after(snapButton)
  snapButton.onclick = event=>{
    event.preventDefault(); closeKeyMenu()
    const rect = snapButton.getBoundingClientRect()
    keyMenu = el('div','key-edit-menu')
    Object.assign(keyMenu.style,{left:Math.max(0,Math.min(rect.left,window.innerWidth-180))+'px',top:rect.bottom+4+'px'})
    for (const [key,label] of [['enabled','SNAP'],['edges','LAYER EDGES'],['keys','KEYFRAMES'],['markers','MARKERS'],['sections','SECTIONS'],['grid','TIME / BEAT GRID']]) {
      const row=el('label','snap-option'), input=el('input')
      input.type='checkbox'; input.checked=snapOptions[key]
      input.onchange=()=>{snapOptions[key]=input.checked; snapButton.textContent=(snapOptions.enabled ? 'SNAP ON' : 'SNAP OFF')+' ▾'}
      row.append(input,document.createTextNode(label)); keyMenu.append(row)
    }
    document.body.append(keyMenu)
  }
  const confirmationPanel = document.createElement('section')
  confirmationPanel.className = 'key-edit-menu'
  confirmationPanel.hidden = true
  document.body.append(confirmationPanel)
  const resourcePanel = document.createElement('section')
  resourcePanel.className = 'resource-picker'
  resourcePanel.hidden = true
  resourcePanel.setAttribute('aria-label','RESOURCE PICKER')
  document.body.append(resourcePanel)
  let renderedResources = ''
  let resourceListing = {key:'',items:[],total:0,loading:false,error:false}
  setInterval(async () => {
    if (document.hidden || !state?.editor?.mediaMode || editPending || resourceListing.loading) return
    try {
      // Refresh native library/version metadata without moving the shared preview.
      await fetch('/api/resource-list?offset=0',{signal:AbortSignal.timeout(10000)})
    } catch {}
  },3000)
  async function loadResourceFiles() {
    const list = resourceListing
    if (list.loading) return
    list.loading = true
    try {
      const response = await fetch('/api/resource-list?offset='+list.items.length,{signal:AbortSignal.timeout(10000)})
      if (!response.ok) throw new Error('Unavailable')
      const result = await response.json()
      if (list !== resourceListing || result.folder !== state.editor?.folder || result.source !== state.editor?.parameter) return
      list.items.push(...result.items)
      list.total = result.total
      list.error = false
    } catch { list.error = true }
    finally {
      list.loading = false
      renderedResources = ''
      if (list === resourceListing && state?.editor?.mediaMode) updateResourcePicker()
    }
  }
  let keyMenu
  let layerDeleteTarget=null
  let layerReorder
  const closeKeyMenu = () => { keyMenu?.remove(); keyMenu = null }
  document.addEventListener('pointerdown', event => { if (!keyMenu?.contains(event.target)) closeKeyMenu() })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && keyMenu) { event.preventDefault(); closeKeyMenu(); return }
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return
    if (event.key === 'Escape') {
      if(layerReorder){layerReorder.line?.remove();layerReorder=null;suppressClickUntil=performance.now()+500}
      closeKeyMenu(); mouseGesture = null; showSnap(null); rendered = ''
      if (state?.editEnabled && !editPending && !interactionBusy) void interact(async () => {
        if (state.editor.mediaMode) await sendEdit('time_step')
        else if (state.editor.moveKey) await sendEdit('key_move')
        else if (state.editor.layerEdit) await sendEdit('layer_edit')
      })
    }
    if (event.key === 'Delete' && !event.repeat && state?.editEnabled && state.editor?.moveKey) {
      event.preventDefault()
      void interact(async () => {
        if (state.editor.mediaMode && !await sendEdit('media')) return
        await sendEdit('key_delete')
      })
    } else if (event.key === 'Delete' && !event.repeat && state?.editEnabled && !keyMenu && !state.editor?.mediaMode && layerDeleteTarget === state.editor?.layerUid) {
      const layer=state.layers.find(l=>l.uid===layerDeleteTarget && !l.group)
      if(layer){event.preventDefault();void interact(()=>deleteLayer(layer))}
    }
  })
  async function interact(fn) {
    if (interactionBusy || editPending || mouseGesture) return false
    interactionBusy = true
    editRevision++
    try { return await fn() }
    catch { $('selectionMessage').textContent = 'ACTION NOT CONFIRMED — CHECK DESIGNER'; return false }
    finally { interactionBusy = false; rendered = ''; lastFullRead = 0; updateEditorControls() }
  }
  function adoptEditor(editor) {
    if (!editor) return
    state.editor = editor
    state.focusUid = editor.layerUid
    state.parameter = editor.parameter
    editRevision++
  }
  async function selectTarget(layer, parameter, point, keyTime) {
    const e = state?.editor
    if (e?.moveKey) {
      if (e.layerUid === layer.uid && e.parameter === parameter && point === 'key' && Math.abs(e.moveKey.time-keyTime) < 1e-6) return true
    }
    if (!await releaseViewerMode()) return false
    const response = await fetch('/api/select', {method:'POST',
      headers:{'Content-Type':'application/json','X-Viewer-Token':state.selectionToken},
      body:JSON.stringify({trackUid:state.trackUid,layerUid:layer.uid,...(parameter === undefined ? {} : {parameter}),...(point ? {point} : {}),...(keyTime === undefined ? {} : {keyTime})}),
      signal:AbortSignal.timeout(10000)})
    const result = await response.json()
    adoptEditor(result.editor)
    if(result.ok) layerDeleteTarget=parameter===undefined ? layer.uid : null
    $('selectionMessage').textContent = result.ok ? '' : result.reason || 'SELECTION UNAVAILABLE'
    return result.ok
  }
  async function chooseKey(layer, parameter, time) {
    if (!await selectTarget(layer,parameter,'key',time)) return false
    if (state.editEnabled && !state.editor.moveKey) return sendEdit('key_move',{keyTime:time})
    return true
  }
  async function releaseViewerMode() {
    if (!state?.editEnabled) return !state?.editor?.moveKey
    // Cancel menus; never confirm deletion. Every transition stays in the shared queue.
    for (let n=0;n<2 && (state.editor.clearPrompt || state.editor.clearMenu);n++)
      if (!await sendEdit('pad',{slot:7})) return false
    if (state.editor.mediaMode && !await sendEdit('media')) return false
    if (state.editor.moveKey && !await sendEdit('key_move')) return false
    if (state.editor.layerEdit && !await sendEdit('layer_edit')) return false
    return true
  }
  async function sendEdit(action, options = {}) {
    if (!state?.editEnabled || !state.editor || editPending) return false
    editPending = true
    updateEditorControls()
    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-Viewer-Token':state.selectionToken},
        body: JSON.stringify({action, token: state.editor.token,  ...options}),
        signal: AbortSignal.timeout(15000),
      })
      const result = await response.json()
      adoptEditor(result.editor)
      if (result.ok && Number.isFinite(result.editRevision)) confirmedRevision=Math.max(confirmedRevision,result.editRevision)
      applyEditPatch(state,result.patch)
      if (Number.isFinite(result.time) && state.editor?.linkTime !== false) { state.time=result.time;updatePlayhead() }
      if (result.curve && mouseGesture?.keyMode) {
        const node=mouseGesture.node, path=node.parentElement.querySelector('svg path')
        const lo=Number(node.dataset.curveMin),hi=Number(node.dataset.curveMax)
        if(path && hi>lo) {
          path.setAttribute('d',result.curve.map((s,i)=>(i?'L':'M')+x(s.time)*10+','+(48-(s.value-lo)/(hi-lo)*42)).join(' '))
          path.style.opacity=''
        }
      }
      if (result.annotation) state.lastAnnotationEdit = result.annotation
      $('selectionMessage').textContent = result.ok ? '' : result.reason || 'EDIT UNAVAILABLE'
      lastFullRead = 0
      rendered = ''
      return result.ok
    } catch {
      // A timeout does not prove that a write failed. Never replay a write.
      $('selectionMessage').textContent = 'EDIT NOT CONFIRMED — CHECK DESIGNER'
      return false
    } finally { editPending = false; updateEditorControls() }
  }
  function updateEditorControls() {
    linkTimeButton.setAttribute('aria-pressed',String(Boolean(state?.editor?.linkTime)))
    linkTimeButton.disabled=!state?.editEnabled || !state?.connected || editPending || interactionBusy || Boolean(mouseGesture || layerReorder)
    const enabled = state?.editEnabled && state.editor
    addLayers.hidden=!enabled
    addLayers.style.display=enabled?'flex':'none'
    for(const b of addLayers.querySelectorAll('button')) b.disabled=!enabled || !state.connected || editPending || interactionBusy
    resourcePanel.hidden = !enabled || !state.editor.mediaMode
    if (!resourcePanel.hidden) updateResourcePicker()
    else { resourceListing = {key:'',items:[],total:0,loading:false,error:false}; resourceFolderContext = '' }
    // A Deck-opened delete confirmation remains visible, without an edit toolbar.
    const e = state?.editor
    confirmationPanel.hidden = !enabled || (!e.clearPrompt && !e.clearMenu)
    if (confirmationPanel.hidden) return
    const signature = JSON.stringify([e,editPending])
    if (signature === renderedEditor) return
    renderedEditor = signature
    Object.assign(confirmationPanel.style,{right:'16px',top:'72px',maxWidth:'320px'})
    confirmationPanel.replaceChildren(el('strong','',e.clearLabel || 'DELETE KEYFRAMES'))
    const button = (label,action,options) => {
      const b = el('button','',label)
      b.disabled = editPending
      b.onclick = () => sendEdit(action,options)
      confirmationPanel.append(b)
    }
    if (e.clearPrompt) { button('CONFIRM','pad',{slot:5}); button('CANCEL','pad',{slot:7}); return }
    button('PARAMETER −','field',{direction:-1}); button('PARAMETER +','field',{direction:1})
    button('DELETE ALL','pad',{slot:5}); button('DELETE ALL + DEFAULT','pad',{slot:6})
    button('DEFAULT ALL PARAMETERS','pad',{slot:4}); button('BACK','pad',{slot:7})
  }
  function updateResourcePicker() {
    const e = state.editor
    const folderPath = value => value.split(/[\\/]+/).filter(Boolean).join('/')
    const folderContext = JSON.stringify([e.layerUid,e.parameter,e.folder,e.folders])
    if (resourceFolderContext !== folderContext) {
      resourceFolderContext = folderContext
      resourceBranch = folderPath(e.folder)
    }
    const listKey = JSON.stringify([e.layerUid,e.parameter,e.folder,e.resourceCount,e.resourceRevision])
    if (resourceListing.key !== listKey) {
      resourceListing = {key:listKey,items:[],total:e.resourceCount,loading:false,error:false}
      void loadResourceFiles()
    }
    const signature = JSON.stringify([e, resourceBranch, editPending, state.connected,resourceListing.items.length,resourceListing.loading,resourceListing.error])
    if (signature === renderedResources) return
    renderedResources = signature
    const scrollTop = resourcePanel.querySelector('.resource-file-grid')?.scrollTop || 0
    const folderScroll = [...resourcePanel.querySelectorAll('.resource-folder-row')].map(row=>[row.getAttribute('aria-label'),row.scrollLeft])
    resourcePanel.replaceChildren()
    const bar = el('div','resource-picker-bar')
    const control = (parent,label,action,options={},active=false) => {
      const b = el('button','',label)
      b.title = label
      b.disabled = editPending || !state.connected
      b.setAttribute('aria-pressed',String(active))
      b.onclick = () => sendEdit(action,options)
      parent.append(b)
      return b
    }
    bar.append(el('strong','', e.resourceSource.toUpperCase() || 'RESOURCES'))
    control(bar,'SOURCE −','layer',{direction:-1}).disabled ||= Boolean(e.moveKey)
    control(bar,'SOURCE +','layer',{direction:1}).disabled ||= Boolean(e.moveKey)
    control(bar,e.mediaKeyframe ? 'NEW KEYFRAME' : 'REPLACE','layer_press',{},e.mediaKeyframe)
    control(bar,'BACK','time_step')
    resourcePanel.append(bar)
    const body = el('div','resource-picker-body')
    body.style.display = 'block'
    const folders = el('nav','resource-folders')
    Object.assign(folders.style,{maxHeight:'180px',borderRight:'0',paddingBottom:'8px'})
    folders.setAttribute('aria-label','RESOURCE FOLDERS')
    // One horizontal row per depth, showing only children of the chosen branch.
    // Intermediate folders may have no files and therefore no server index.
    const root = {path:'',name:'ROOT',index:-1,children:new Map()}
    for (const [index,folder] of e.folders.entries()) {
      let node = root
      for (const name of folderPath(folder).split('/').filter(Boolean)) {
        if (!node.children.has(name)) node.children.set(name,{name,path:node.path ? node.path+'/'+name : name,index:-1,children:new Map()})
        node = node.children.get(name)
      }
      node.index = index
    }
    const folderButton = (row,node) => {
      const b = el('button','','▱ '+node.name)
      b.title = node.path || 'ROOT'
      b.disabled = editPending || !state.connected
      b.setAttribute('aria-pressed',String(resourceBranch === node.path || (node.path && resourceBranch.startsWith(node.path+'/'))))
      b.onclick = () => {
        resourceBranch = node.path
        if (node.index >= 0) void sendEdit('resource_folder',{index:node.index})
        updateResourcePicker()
      }
      row.append(b)
    }
    let parent = root, depth = 0
    const branch = resourceBranch.split('/').filter(Boolean)
    do {
      const row = el('div','resource-folder-row')
      row.setAttribute('aria-label',depth ? 'SUBFOLDERS · '+parent.path : 'ROOT FOLDERS')
      for (const node of parent.children.values()) folderButton(row,node)
      folders.append(row)
      parent = parent.children.get(branch[depth++])
    } while (parent?.children.size)
    const files = el('div','resource-files')
    const path = el('div','resource-path',resourceBranch || e.resourceSource)
    path.title = resourceBranch
    files.append(path)
    const grid = el('div','resource-file-grid')
    Object.assign(grid.style,{maxHeight:'300px',overflowY:'auto',alignContent:'start',gridTemplateColumns:'1fr'})
    grid.onscroll = () => {
      if (grid.scrollHeight-grid.scrollTop-grid.clientHeight < 50 && resourceListing.items.length < resourceListing.total && !resourceListing.error)
        void loadResourceFiles()
    }
    for (const resource of resourceListing.items) {
      const selected = e.resources.some(item=>item.uid === resource.uid && item.selected)
      const tile = control(grid,'','resource_choose',{index:resource.index,resourceUid:resource.uid},selected)
      tile.className = 'resource-file'
      tile.title = resource.name
      tile.setAttribute('aria-label','APPLY RESOURCE · ' + resource.name)
      Object.assign(tile.style,{display:'grid',gridTemplateColumns:'64px minmax(0,1fr)',textAlign:'left',gap:'9px'})
      const thumb = image(resource,true)
      Object.assign(thumb.style,{width:'64px',height:'40px'})
      const text = el('span','resource-file-text')
      const name = el('span','',resource.name)
      Object.assign(name.style,{display:'block',fontSize:'11px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'})
      const details = []
      if (typeof resource.audio === 'boolean') details.push(resource.audio ? 'AUDIO' : 'NO AUDIO')
      if (Number.isFinite(resource.duration)) {
        const seconds = Math.max(0,resource.duration)
        details.push(Math.floor(seconds/3600).toString().padStart(2,'0')+':'+Math.floor(seconds/60%60).toString().padStart(2,'0')+':'+(seconds%60).toFixed(2).padStart(5,'0'))
      }
      if (typeof resource.alpha === 'boolean') details.push(resource.alpha ? 'ALPHA' : 'NO ALPHA')
      if (Number.isFinite(resource.fps)) details.push('@ '+Number(resource.fps.toFixed(3)))
      if (resource.codec) details.push(resource.codec)
      const metadata = el('span','', details.join(' · ') || resource.resourceType || '')
      Object.assign(metadata.style,{display:'block',fontSize:'10px',color:'#8baab8',lineHeight:'1.4'})
      text.append(name,metadata)
      tile.append(thumb,text)
    }
    if (!resourceListing.items.length) grid.append(el('span','', resourceListing.loading ? 'LOADING…' : resourceListing.error ? 'FILES UNAVAILABLE' : 'NO FILES IN THIS FOLDER'))
    files.append(grid)
    const footer = el('div','resource-picker-bar')
    footer.append(el('span','', resourceListing.total + ' ITEMS'))
    if (resourceListing.items.length < resourceListing.total || resourceListing.error) {
      const more = el('button','',resourceListing.loading ? 'LOADING…' : 'LOAD MORE')
      more.disabled = resourceListing.loading
      more.onclick = () => { void loadResourceFiles() }
      footer.append(more)
    }
    files.append(footer)
    if (resourceBranch !== folderPath(e.folder)) {
      grid.replaceChildren(el('span','','SELECT A SUBFOLDER'))
      footer.hidden = true
    }
    body.append(folders,files)
    resourcePanel.append(body)
    grid.scrollTop = scrollTop
    for (const row of folders.children) row.scrollLeft = folderScroll.find(([label])=>label === row.getAttribute('aria-label'))?.[1] || 0
  }
  // Mouse distance is resolved by the same native timing operation as a dial.
  // Keep only the latest pointer position while a shared command is in flight.
  function mouseDial(node, layer, action, parameter, keyTime) {
    if (!node || layer.group) return
    function preview(g) {
      g.previewFrame=0
      if (mouseGesture!==g || !g.moved) return
      const target=snappedTime(g.originTime+(g.lastX-g.originX)*span/g.width,g.points,g.lastEvent?.altKey,g.width,!g.keyMode && action==='field' ? layer.end-layer.start : 0)
      const time=Math.max(layer.start,Math.min(layer.end,target.time))
      if (g.keyMode) {
        node.style.left=x(time)+'%'
        const lo=Number(node.dataset.curveMin),hi=Number(node.dataset.curveMax)
        if (hi>lo && Number.isFinite(g.originValue)) {
          const value=Math.max(lo,Math.min(hi,g.originValue+(g.originY-g.lastY)*(hi-lo)/42))
          node.style.top=(44-(value-lo)/(hi-lo)*42)+'px'
          const path=node.parentElement.querySelector('svg path')
          if(path && g.samples?.length) {
            // Transient deformation of native samples, never project data.
            // The confirmed Designer-evaluated curve replaces this preview.
            const before=g.neighbours[0],after=g.neighbours[1]
            const d=g.samples.map((s,i)=>{
              let t=s.time,v=s.value
              if(t>=before && t<=after) {
                const left=t<=g.originTime,edge=left?before:after
                const weight=Math.abs(g.originTime-edge)>1e-9 ? (t-edge)/(g.originTime-edge) : 1
                t=edge+(time-edge)*weight;v+=(value-g.originValue)*weight
              }
              return (i?'L':'M')+x(t)*10+','+(48-(v-lo)/(hi-lo)*42)
            }).join(' ')
            path.setAttribute('d',d);path.style.opacity='.65'
          }
        }
      } else {
        node.style.left=x(target.time)+'%'
      }
    }
    node.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !state?.editEnabled || editPending || interactionBusy || event.ctrlKey || event.shiftKey) return
      event.stopPropagation()
      clearTimeout(clickTimer)
      const currentKeyTime = parameter === undefined ? undefined : Number(node.dataset.keyTime)
      const field=[...(layer.fields || []),...(layer.resources || [])].find(f=>f.name===parameter)
      const keys=(field?.keys || []).filter(k=>k.time>=layer.start && k.time<=layer.end).sort((a,b)=>a.time-b.time)
      const selected=keys.find(k=>Math.abs(k.time-currentKeyTime)<1e-5)
      node.setPointerCapture(event.pointerId)
      mouseGesture = {node,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,originX:event.clientX,
        originY:event.clientY,
        originValue:selected?.value,samples:field?.samples?.map(s=>({...s})),
        neighbours:[keys.filter(k=>k.time<currentKeyTime).at(-1)?.time ?? layer.start,keys.find(k=>k.time>currentKeyTime)?.time ?? layer.end],
        originTime:parameter !== undefined ? currentKeyTime : action === 'value' ? layer.end : layer.start,
        width:node.parentElement.getBoundingClientRect().width,points:snapPoints(layer.uid,parameter,currentKeyTime),
        alignmentPoints:snapPoints(layer.uid,undefined,undefined,undefined,{edges:true,keys:true}),
        keyMode:parameter !== undefined,action,ready:false,preparing:false,moved:false,token:state.editor.token}
    })
    const move = async event => {
      const g = mouseGesture
      if (!g || g.node !== node) return
      g.lastEvent = event
      g.lastX = event.clientX; g.lastY = event.clientY
      if(Math.max(Math.abs(g.lastX-g.originX),Math.abs(g.lastY-g.originY))>=5) g.moved=true
      if(!g.previewFrame) g.previewFrame=requestAnimationFrame(()=>preview(g))
      if (g.preparing || editPending) return
      const dx = g.lastX-g.x, dy = g.y-g.lastY
      if (Math.max(Math.abs(dx),Math.abs(dy)) < (g.ready ? 2 : 5)) return
      g.moved = true
      if (!g.ready) {
        g.preparing = true
        try {
          const ok = g.keyMode ? await chooseKey(layer,parameter,g.originTime)
            : state.editor.layerUid === layer.uid && state.editor.layerEdit === 'edit' ? true
            : await selectTarget(layer,undefined,action === 'layer' ? 'in' : action === 'value' ? 'out' : undefined)
          if (!ok || mouseGesture !== g) { mouseGesture = null; return }
          if (g.keyMode && state.editor.mediaMode && !await sendEdit('media')) { mouseGesture = null; return }
          if (!g.keyMode && state.editor.layerEdit !== 'edit' && !await sendEdit('layer_edit')) { mouseGesture = null; return }
          g.token = state.editor.token; g.ready = true
          if (g.keyMode) g.originValue = state.editor.moveKey?.value
        } catch { $('selectionMessage').textContent = 'SELECTION UNAVAILABLE'; mouseGesture = null; return }
        finally { g.preparing = false }
      }
      if (mouseGesture !== g) return
      if (state.editor.token !== g.token) {
        mouseGesture = null
        $('selectionMessage').textContent = 'EDITOR CHANGED — DRAG CANCELLED'
        return
      }
      const field = [...(layer.fields || []),...(layer.resources || [])].find(f=>f.name === parameter)
      const resourceKey = g.keyMode && field && ('current' in field || field.resource || field.discrete || field.choices?.length || field.choiceError)
      const vertical = g.keyMode && !resourceKey && Math.abs(dy) > Math.abs(dx)
      if (resourceKey && Math.abs(dx)<2) {
        g.y=g.lastY
        if(g.released) end({type:'pointerup'})
        return
      }
      // One shared encoder action in flight. Never build a backlog of old drags.
      g.x = g.lastX; g.y = g.lastY
      const target = snappedTime(g.originTime+(g.lastX-g.originX)*span/g.width,g.points,event.altKey,g.width,!g.keyMode && action === 'field' ? layer.end-layer.start : 0)
      const numeric = g.keyMode && Number.isFinite(g.originValue) && node.dataset.curveMin !== undefined && !field?.choices?.length
      let ok
      g.preparing = true
      try {
        const lo=Number(node.dataset.curveMin), hi=Number(node.dataset.curveMax)
        const targetValue=numeric ? Math.max(lo,Math.min(hi,g.originValue+(g.originY-g.lastY)*(hi-lo)/42)) : undefined
        ok = numeric
          ? await sendEdit('drag_time',{mode:'key',targetTime:target.time,targetValue,snap:target.snap,snapGrid:target.snapGrid})
          : vertical
        ? await sendEdit('value',{direction:dy > 0 ? 1 : -1})
        : await sendEdit('drag_time',{mode:g.keyMode ? 'key' : action === 'layer' ? 'in' : action === 'value' ? 'out' : 'move',targetTime:target.time,snap:target.snap,snapGrid:target.snapGrid,...(target.snapOffset ? {snapOffset:target.snapOffset} : {})})
      } finally { g.preparing = false }
      if (!ok) mouseGesture = null
      else if (mouseGesture === g) {
        g.token = state.editor.token
        updateDragGuides(g)
        if (g.keyMode && state.editor.moveKey) {
          const oldTime=Number(node.dataset.keyTime), newTime=state.editor.moveKey.time
          for(const mark of sheet.querySelectorAll('[data-key-time]')) {
            if(mark.dataset.keyLayer===layer.uid && mark.dataset.keyParameter===parameter && Math.abs(Number(mark.dataset.keyTime)-oldTime)<1e-6) {
              mark.dataset.keyTime=String(newTime)
              mark.style.left=x(newTime)+'%'
            }
          }
          node.style.left = x(state.editor.moveKey.time)+'%'
          if (node.dataset.curveMin !== undefined) {
            const lo=Number(node.dataset.curveMin), hi=Number(node.dataset.curveMax)
            node.style.top=(44-(state.editor.moveKey.value-lo)/(hi-lo)*42)+'px'
          }
        }
        else if (!g.keyMode) {
          const e = state.editor
          node.style.left = x(action === 'value' ? e.layerEnd : e.layerStart)+'%'
          if (action === 'field') node.style.width = (x(e.layerEnd)-x(e.layerStart))+'%'
        }
      }
      if (mouseGesture === g && g.released) end({type:'pointerup'})
      else if(mouseGesture===g && g.lastEvent && Math.max(Math.abs(g.lastX-g.x),Math.abs(g.lastY-g.y))>=2) void move(g.lastEvent)
    }
    node.addEventListener('pointermove', event => { void move(event) })
    const end = event => {
      if (mouseGesture?.node !== node) return
      const g = mouseGesture
      if (event.type === 'pointerup' || g.released) {
        g.released = true
        if (g.preparing || editPending) return
        if (g.ready && g.lastEvent && Math.max(Math.abs(g.lastX-g.x),Math.abs(g.lastY-g.y)) >= 2) {
          void move(g.lastEvent)
          return
        }
      }
      if (mouseGesture.moved) suppressClickUntil = performance.now()+400
      if(g.previewFrame)cancelAnimationFrame(g.previewFrame)
      mouseGesture = null
      showSnap(null)
      rendered = ''; lastFullRead = 0; updateEditorControls()
      if(g.moved) draw()
    }
    node.addEventListener('pointerup',end)
    node.addEventListener('pointercancel',end)
    node.addEventListener('lostpointercapture',end)
  }
  document.addEventListener('pointerup', () => {
    resizingWaveform = false
  })
  const el = (tag, cls, text) => {
    const node = document.createElement(tag)
    if (cls) node.className = cls
    if (text !== undefined) node.textContent = text
    return node
  }
  const x = (time) => ((time - start) / span) * 100
  function image(resource, large = false) {
    const box = el('span', 'thumb' + (large ? ' large' : ''), '◇')
    box.title = resource?.name || 'NO THUMBNAIL'
    if (resource?.thumbnail) {
      const img = el('img')
      // Native image dragging would steal pointer capture from resource keys.
      img.draggable = false
      img.loading = 'lazy'
      img.src = '/api/thumbnail/' + encodeURIComponent(resource.uid) + '?version=' + encodeURIComponent(resource.version || '')
      img.alt = resource.name || 'Resource'
      let retries = 0
      img.onerror = () => {
        if (retries >= 3) { box.replaceChildren(document.createTextNode('◇')); return }
        retries++
        setTimeout(() => {
          if (img.isConnected) img.src = '/api/thumbnail/' + encodeURIComponent(resource.uid) + '?retry=' + retries
        }, retries * 3000)
      }
      box.replaceChildren(img)
    }
    return box
  }
  function row(label, cls = '') {
    const root = el('div', 'row ' + cls),
      side = el('div', 'label', label),
      lane = el('div', 'lane')
    root.append(side, lane)
    sheet.append(root)
    return { root, side, lane }
  }
  function editClock() { return state?.editor?.linkTime === false ? state.editor.editTime : state?.time }
  function selectionButton(layer, label, parameter) {
    const button = el('button', 'select-label', label)
    button.dataset.selectLayer = layer.uid
    button.disabled =
      !state.selectionEnabled || layer.group || editClock() < layer.start || editClock() >= layer.end
    button.title = button.disabled
      ? 'SELECTION UNAVAILABLE'
      : 'SELECT IN COMPANION'
    button.onclick = () => {
      if (performance.now() < suppressClickUntil) return
      void interact(async () => {
        try { await selectTarget(layer,parameter) }
        catch { $('selectionMessage').textContent = 'SELECTION UNAVAILABLE' }
      })
    }
    if(parameter===undefined) button.oncontextmenu=event=>layerMenu(layer,event)
    return button
  }
  async function deleteLayer(layer) {
    const target={operation:'delete',trackUid:state.trackUid,layerUid:layer.uid,expectedName:layer.name,expectedStart:layer.start,expectedEnd:layer.end}
    if(await releaseViewerMode()) {
      if(await sendEdit('layer_manage',target)) layerDeleteTarget=null
    }
  }
  function layerMenu(layer,event) {
    if(!state.editEnabled || layer.group) return
    event.preventDefault();event.stopPropagation();clearTimeout(clickTimer);closeKeyMenu()
    const trackUid=state.trackUid
    const expected={layerUid:layer.uid,expectedName:layer.name,expectedStart:layer.start,expectedEnd:layer.end}
    const panel=el('div','key-edit-menu value-edit-menu');keyMenu=panel
    Object.assign(panel.style,{left:Math.max(0,Math.min(event.clientX,window.innerWidth-180))+'px',top:Math.max(0,Math.min(event.clientY,window.innerHeight-160))+'px',width:'170px'})
    const run=(operation,name)=>void interact(async()=>{
      closeKeyMenu()
      if(await releaseViewerMode()) await sendEdit('layer_manage',{operation,trackUid,...expected,...(name===undefined?{}:{name})})
    })
    for(const [operation,label] of [['rename','RENAME'],['duplicate','DUPLICATE'],['delete','DELETE'],['fit','FIT TO CONTENT']]) {
      const b=el('button','',label)
      b.onclick=()=>{
        if(operation!=='rename') {run(operation);return}
        panel.replaceChildren()
        const input=el('input');input.value=layer.name;input.maxLength=128;input.setAttribute('aria-label','LAYER NAME');input.style.width='100%';input.style.boxSizing='border-box'
        const save=el('button','','SAVE'),cancel=el('button','','CANCEL')
        const commit=()=>{if(input.value.trim())run('rename',input.value.trim())}
        save.onclick=commit;cancel.onclick=closeKeyMenu
        input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit()}}
        panel.append(input,save,cancel);input.focus();input.select()
      }
      panel.append(b)
    }
    document.body.append(panel)
  }
  function reorderLabel(node,layer) {
    if(layer.group) {node.disabled=!state.editEnabled;node.onclick=()=>{};node.dataset.reorderGroup='true'}
    node.style.touchAction='none'
    node.title='SELECT LAYER · DRAG TO REORDER · RIGHT CLICK FOR OPTIONS'
    node.onpointerdown=event=>{
      if(event.button!==0 || !state.editEnabled || editPending || interactionBusy || mouseGesture) return
      node.setPointerCapture(event.pointerId)
      layerReorder={node,y:event.clientY,moved:false,trackUid:state.trackUid,expectedOrder:state.layers.filter(l=>(l.parent||null)===(layer.parent||null)).map(l=>l.uid)}
    }
    node.onpointermove=event=>{
      const g=layerReorder;if(!g || g.node!==node)return
      if(!g.moved && Math.abs(event.clientY-g.y)<6)return
      g.moved=true
      if(!g.line){g.line=el('div');Object.assign(g.line.style,{position:'fixed',left:'12px',right:'12px',height:'2px',background:'#63d4e7',boxShadow:'0 0 4px #63d4e7',zIndex:'60',pointerEvents:'none'});document.body.append(g.line)}
      const candidates=[...sheet.querySelectorAll('.layer[data-uid]')].filter(row=>row.dataset.uid!==layer.uid && g.expectedOrder.includes(row.dataset.uid))
      const row=candidates.sort((a,b)=>Math.abs((a.getBoundingClientRect().top+a.getBoundingClientRect().bottom)/2-event.clientY)-Math.abs((b.getBoundingClientRect().top+b.getBoundingClientRect().bottom)/2-event.clientY))[0]
      if(!row)return
      const r=row.getBoundingClientRect();g.targetUid=row.dataset.uid;g.after=event.clientY>(r.top+r.bottom)/2
      g.line.style.top=(g.after?r.bottom:r.top)+'px'
    }
    const finish=event=>{
      const g=layerReorder;if(!g || g.node!==node)return
      layerReorder=null;g.line?.remove()
      if(g.moved)suppressClickUntil=performance.now()+500
      if(event.type==='pointerup' && g.moved && g.targetUid)void interact(async()=>{
        if(await releaseViewerMode())await sendEdit('layer_reorder',{trackUid:g.trackUid,layerUid:layer.uid,targetUid:g.targetUid,after:g.after,expectedOrder:g.expectedOrder})
      })
    }
    node.onpointerup=finish;node.onpointercancel=finish;node.onlostpointercapture=finish
  }
  function pointClick(node, layer, point, parameter, keyTime) {
    if (!node || layer.group) return
    if (point === 'key') {
      node.dataset.keyTime=String(keyTime)
      node.dataset.keyLayer=layer.uid
      node.dataset.keyParameter=parameter
    }
    const currentTime = () => point === 'key' ? Number(node.dataset.keyTime) : keyTime
    node.classList.add('timeline-target')
    node.setAttribute('role','button')
    node.tabIndex = 0
    node.setAttribute('aria-label', (point === 'key' ? 'KEYFRAME ' + (parameter || '') : point.toUpperCase()) + ' · ' + layer.name)
    node.onclick = event => {
      event.stopPropagation()
      if (performance.now() < suppressClickUntil) return
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => void interact(async () => {
        try {
          if (point === 'key') {
            if (await chooseKey(layer,parameter,currentTime()) && resource && state.editEnabled && !state.editor.mediaMode) await sendEdit('media')
          }
          else await selectTarget(layer,parameter,point,currentTime())
        } catch { $('selectionMessage').textContent = 'SELECTION UNAVAILABLE' }
      }),220)
    }
    node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click() } }
    mouseDial(node,layer,point === 'in' ? 'layer' : point === 'out' ? 'value' : 'time',parameter,keyTime)
    if (point !== 'key') return
    const resource = layer.resources?.some(f=>f.name === parameter) || layer.fields?.some(f=>f.name === parameter && f.resource)
    node.ondblclick = event => {
      event.preventDefault(); event.stopPropagation(); clearTimeout(clickTimer)
      if (!state.editEnabled || !resource) return
      void interact(async () => {
        if (await chooseKey(layer,parameter,currentTime()) && !state.editor.mediaMode) await sendEdit('media')
      })
    }
    node.oncontextmenu = event => {
      if (!state.editEnabled) return
      event.preventDefault(); event.stopPropagation(); clearTimeout(clickTimer)
      const field = layer.fields?.find(f=>f.name===parameter)
      if (resource || !field) return
      valueMenu(layer,field,event,currentTime())
    }
  }
  function valueMenu(layer,field,event,keyTime) {
    if (!state.editEnabled || field.unsupported || field.resource || 'current' in field) return
    event.preventDefault();event.stopPropagation();clearTimeout(clickTimer)
    const px=event.clientX,py=event.clientY
    void interact(async()=>{
      if (field.sequenced) {
        const selected=state.editor.layerUid===layer.uid && state.editor.parameter===field.name ? state.editor.moveKey : null
        const key=keyTime !== undefined ? {time:keyTime} : selected || visibleKeys(field,layer).sort((a,b)=>Math.abs(a.time-editClock())-Math.abs(b.time-editClock())||b.time-a.time)[0]
        if (!key || !await chooseKey(layer,field.name,key.time)) return
      } else if (!await selectTarget(layer,field.name)) return
      closeKeyMenu()
      const token=state.editor.token
      const expectedValue=state.editor.moveKey?.value ?? field.value
      const panel=el('form','key-edit-menu value-edit-menu');keyMenu=panel
      Object.assign(panel.style,{left:Math.max(0,Math.min(px,window.innerWidth-240))+'px',top:Math.max(0,Math.min(py,window.innerHeight-310))+'px',width:'230px',maxHeight:'300px',overflowY:'auto',padding:'10px',fontSize:'11px'})
      panel.append(el('strong','',(field.label||field.name).toUpperCase()))
      const context=el('div','',state.editor.moveKey ? 'KEYFRAME · '+Number(state.editor.moveKey.time.toFixed(3))+' S' : 'CONSTANT')
      Object.assign(context.style,{color:'#849aa5',fontSize:'10px',margin:'4px 0 8px'})
      panel.append(context)
      const apply=async value=>{if(await sendEdit('value_set',{token,expectedValue,targetValue:value}))closeKeyMenu()}
      if(field.choices?.length) {
        for(const choice of field.choices) {
          const b=el('button','',choice.label.toUpperCase());b.type='button'
          Object.assign(b.style,{display:'block',width:'100%',textAlign:'left',fontSize:'11px',padding:'5px 7px',marginTop:'3px'})
          b.setAttribute('aria-pressed',String(choice.value===expectedValue))
          b.onclick=()=>void interact(()=>apply(choice.value));panel.append(b)
        }
      } else if(field.discrete || field.choiceError) panel.append(el('div','','OPTIONS UNAVAILABLE'))
      else {
        const input=el('input');input.type='number';input.step=field.integer?'1':'any';input.value=String(expectedValue)
        input.setAttribute('aria-label','VALUE')
        if(Number.isFinite(field.min))input.min=String(field.min)
        if(Number.isFinite(field.max))input.max=String(field.max)
        Object.assign(input.style,{width:'100%',boxSizing:'border-box',marginBottom:'7px'})
        const save=el('button','','APPLY');save.type='submit'
        panel.append(input,save)
        panel.onsubmit=e=>{e.preventDefault();if(input.value!==''&&input.checkValidity())void interact(()=>apply(Number(input.value)))}
        if(state.editor.moveKey) for(const [type,label] of ['HOLD','LINEAR','CUBIC'].entries()) {
          const b=el('button','',label);b.type='button'
          b.setAttribute('aria-pressed',String(state.editor.keyType===type))
          b.onclick=()=>{closeKeyMenu();void interact(()=>sendEdit('key_type',{token,type}))};panel.append(b)
        }
      }
      const cancel=el('button','','CANCEL');cancel.type='button';cancel.onclick=closeKeyMenu;panel.append(cancel)
      document.body.append(panel)
      panel.querySelector('input')?.focus()
    })
  }
  function addKeyAtPointer(lane,layer,field) {
    lane.ondblclick = event => {
      if (!state.editEnabled || field.unsupported || field.canAnimate === false || event.target.closest('.timeline-target')) return
      event.preventDefault(); event.stopPropagation(); clearTimeout(clickTimer)
      const rect = lane.getBoundingClientRect()
      const time = start + (event.clientX-rect.left)/rect.width*span
      if (time < layer.start || time > layer.end) return
      void interact(async () => {
        if (!await releaseViewerMode()) return
        await sendEdit('key_insert',{trackUid:state.trackUid,layerUid:layer.uid,parameter:field.name,targetTime:time})
      })
    }
  }
  function constantResourceTarget(node,layer,field) {
    if(!node || field.sequenced || !state.editEnabled) return
    node.classList.add('timeline-target')
    node.setAttribute('role','button');node.tabIndex=0
    node.title='CHOOSE RESOURCE'
    node.setAttribute('aria-label','CHOOSE RESOURCE · '+(field.label||field.name)+' · '+layer.name)
    const open=event=>{
      event.preventDefault();event.stopPropagation();clearTimeout(clickTimer)
      void interact(()=>selectTarget(layer,field.name))
    }
    node.onclick=open
    node.ondblclick=event=>{event.preventDefault();event.stopPropagation();clearTimeout(clickTimer)}
    node.onkeydown=event=>{if(event.key==='Enter'||event.key===' ')open(event)}
  }

  function marker(lane, time, text, cls = '') {
    if (time < start || time > start + span) return
    const node = el('span', 'marker ' + cls, text)
    node.style.left = x(time) + '%'
    node.title = text
    lane.append(node)
    return node
  }
  function annotationForm(kind,time,event,item) {
    if (!state?.editEnabled || interactionBusy || editPending || mouseGesture) return
    closeKeyMenu()
    const panel = el('form','key-edit-menu'), input = el('input')
    keyMenu = panel
    Object.assign(panel.style,{left:Math.max(0,Math.min(event.clientX,window.innerWidth-270))+'px',top:Math.max(0,Math.min(event.clientY,window.innerHeight-160))+'px',width:'250px',padding:'9px'})
    panel.append(el('strong','',(item ? 'EDIT ' : 'ADD ')+kind.toUpperCase()))
    input.type='text'; input.maxLength=kind==='notes' ? 2000 : 64
    input.value=item ? String(item.text ?? item.value ?? '') : ''
    input.placeholder=kind==='tc' ? 'HH:MM:SS:FF' : kind==='notes' ? 'NOTE' : kind==='midi' ? 'MIDI TAG' : 'CUE NUMBER'
    input.setAttribute('aria-label',kind.toUpperCase()+' VALUE')
    input.required=true
    Object.assign(input.style,{width:'100%',margin:'8px 0',fontSize:'12px'})
    panel.append(input)
    const save=el('button','','SAVE'),cancel=el('button','','CANCEL')
    save.type='submit'; cancel.type='button'; cancel.onclick=closeKeyMenu
    panel.append(save,cancel)
    panel.onsubmit=event=>{
      event.preventDefault()
      void interact(async()=>{
        const text=input.value.trim()
        if (!text) return
        if (!await releaseViewerMode()) return
        const ok=await sendEdit('annotation',{kind,mode:item ? 'update' : 'add',targetTime:time,text,
          ...(item ? {sourceTime:item.time,sourceText:String(item.text ?? item.value ?? '')} : {})})
        if (ok) closeKeyMenu()
      })
    }
    document.body.append(panel); input.focus()
  }
  function annotationMouse(lane,kind,node,item) {
    if (!node) {
      lane.ondblclick=event=>{
        if(event.target.closest('.timeline-target')) return
        const rect=lane.getBoundingClientRect()
        const raw=start+(event.clientX-rect.left)*span/rect.width
        if(raw<0 || raw>state.length) return
        annotationForm(kind,raw,event)
      }
      return
    }
    node.ondblclick=event=>{event.preventDefault();event.stopPropagation();annotationForm(kind,item.time,event,item)}
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0 || !state.editEnabled || interactionBusy || editPending || event.ctrlKey || event.shiftKey) return
      event.stopPropagation(); node.setPointerCapture(event.pointerId)
      mouseGesture={node,annotation:true,originX:event.clientX,originTime:item.time,width:lane.getBoundingClientRect().width,
        points:snapPoints(undefined,undefined,undefined,item),moved:false,target:{time:item.time,snap:false},token:state.editor.token}
    })
    node.addEventListener('pointermove',event=>{
      const g=mouseGesture
      if(!g?.annotation || g.node!==node) return
      if(Math.abs(event.clientX-g.originX)<4 && !g.moved) return
      g.moved=true
      const raw=Math.max(0,Math.min(state.length,g.originTime+(event.clientX-g.originX)*span/g.width))
      g.target=snappedTime(raw,g.points,event.altKey,g.width)
      node.style.left=x(g.target.time)+'%'
    })
    const end=async event=>{
      const g=mouseGesture
      if(!g?.annotation || g.node!==node) return
      mouseGesture=null; showSnap(null)
      if(g.moved && event.type==='pointerup') {
        suppressClickUntil=performance.now()+400
        if(state.editor.token!==g.token) { $('selectionMessage').textContent='EDITOR CHANGED — DRAG CANCELLED'; rendered=''; return }
        await interact(async()=>{
          if (!await releaseViewerMode()) return false
          return sendEdit('annotation',{kind,mode:'move',targetTime:g.target.time,snap:g.target.snap,snapGrid:g.target.snapGrid,
            sourceTime:item.time,sourceText:String(item.text ?? item.value ?? ''),text:String(item.text ?? item.value ?? '')})
        })
      }
      rendered='';lastFullRead=0
    }
    node.addEventListener('pointerup',end)
    node.addEventListener('pointercancel',end)
    node.addEventListener('lostpointercapture',end)
  }
  function grid() {
    const ruler = row('TIME', 'ruler')
    const enableSeek = (lane) => {
      if (!state.seekEnabled) return
      lane.style.cursor = 'crosshair'
      lane.title = 'SEEK TO TIME'
      lane.onclick = async (event) => {
        if (event.ctrlKey || event.shiftKey || event.altKey) return
        const rect = lane.getBoundingClientRect()
        const time = start + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * span
        try {
          const response = await fetch('/api/seek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
            body: JSON.stringify({ trackUid: state.trackUid, time }),
            signal: AbortSignal.timeout(10000),
          })
          const result = await response.json()
          $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Seek unavailable'
          rendered = ''
        } catch {
          $('selectionMessage').textContent = 'Seek unavailable; connection interrupted'
        }
      }
    }
    enableSeek(ruler.lane)
    for (const tick of state.grid || []) {
      if (tick.time < start || tick.time > start + span) continue
      const line = el('i', 'gridline' + (tick.major ? ' major' : ''))
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(tick.time) / 100 + ')'
      sheet.append(line)
      if (tick.major) marker(ruler.lane, tick.time, tick.label, 'tick')
    }
    // Native TC labels include track TC markers; seconds remain an explicit
    // relative grid until the native beat/TC grid samples arrive.
    const sections = ruler
    for (const section of state.sections || []) {
      const left = Math.max(start, section.start), right = Math.min(start + span, section.end)
      if (right <= left) continue
      const band = el('span', 'section-band section-' + (section.index % 2))
      band.style.left = x(left) + '%'
      band.style.width = ((right - left) / span * 100) + '%'
      band.title = 'SECTION ' + section.index
      sections.lane.append(band)
    }
  }
  const visibleKeys = (field, layer) => (field.keys || []).filter(key => key.time >= layer.start && key.time <= layer.end)
  function curve(lane, field, layer) {
    const segments = discreteSegments(field, layer)
    if (segments) {
      for (const segment of segments) {
        const left = Math.max(start,segment.start), right = Math.min(start+span,segment.end)
        if (right <= left) continue
        const band = el('span','choice-segment',segment.label.toUpperCase())
        Object.assign(band.style,{position:'absolute',left:x(left)+'%',width:((right-left)/span*100)+'%',top:'14px',height:'25px',padding:'4px 8px',boxSizing:'border-box',background:'#1b343d',borderLeft:'2px solid #63d4e7',color:'#bce8ef',fontSize:'10px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',pointerEvents:'none'})
        band.title = segment.label
        lane.append(band)
      }
      if (field.sequenced) for (const key of visibleKeys(field,layer)) {
        const point = marker(lane,key.time,'','key-point')
        pointClick(point,layer,'key',field.name,key.time)
      }
      return
    }
    if (!field.sequenced || !field.keys?.length) return
    const samples = (field.samples || []).filter((s) => Number.isFinite(s.value))
    if (!samples.length) return
    const values = samples.map((s) => s.value)
    values.push(
      ...(field.keys || [])
        .filter((k) => k.time >= layer.start && k.time <= layer.end && k.time >= start && k.time <= start + span && Number.isFinite(k.value))
        .map((k) => k.value),
    )
    if (Number.isFinite(field.min) && Number.isFinite(field.max) && field.max > field.min)
      values.push(field.min, field.max)
    let lo = Math.min(...values),
      hi = Math.max(...values)
    if (hi === lo) {
      lo -= 0.5
      hi += 0.5
    }
    const y = (value) => 48 - ((value - lo) / (hi - lo)) * 42
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1000 54')
    svg.setAttribute('preserveAspectRatio', 'none')
    const path = document.createElementNS(svg.namespaceURI, 'path')
    path.setAttribute(
      'd',
      samples.map((s, i) => (i ? 'L' : 'M') + x(s.time) * 10 + ',' + y(s.value)).join(' '),
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(path)
    lane.append(svg)
    if (field.sequenced)
      for (const key of visibleKeys(field, layer)) {
        if (!Number.isFinite(key.value)) continue
        const point = marker(lane, key.time, '', 'curve-key')
        if (!point) continue
        point.style.top = y(key.value) - 4 + 'px'
        point.dataset.curveMin=String(lo)
        point.dataset.curveMax=String(hi)
        point.style.width = '8px'
        point.style.height = '8px'
        point.style.marginLeft = '-4px'
        point.style.background = 'currentColor'
        point.style.border = '1px solid #101517'
        point.style.transform = 'translateX(var(--pan, 0px)) rotate(45deg)'
        point.title = (field.label || field.name) + ' · ' + key.value
        pointClick(point, layer, 'key', field.name, key.time)
      }
  }
  function seekTarget(node, time, label) {
    if (!node || !state.seekEnabled) return
        node.classList.add('timeline-target')
        node.setAttribute('role', 'button')
        node.tabIndex = 0
        node.setAttribute('aria-label', label.toUpperCase())
        node.title = label.toUpperCase()
        node.onclick = async event => {
          event.stopPropagation()
          if (performance.now() < suppressClickUntil) return
          try {
            const response = await fetch('/api/seek', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
              body: JSON.stringify({ trackUid: state.trackUid, time: time }),
              signal: AbortSignal.timeout(10000),
            })
            const result = await response.json()
            $('selectionMessage').textContent = result.ok ? '' : result.reason || 'Seek unavailable'
          } catch {
            $('selectionMessage').textContent = 'Seek unavailable; connection interrupted'
          }
        }
        node.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click() }
        }
  }
  function waveform(wave, label, uid, stickyTop) {
    const owner = uid && state.layers.find(layer => layer.uid === uid)
    const playback = owner?.playback
    const suffix = playback?.endpoint === 'Loop' ? 'LOOPED' : playback?.endpoint?.toUpperCase()
    const r = row(label + (suffix ? ' - ' + suffix : ''), 'waveform')
    if (stickyTop !== undefined) {
      r.root.classList.add('track-waveform')
      r.root.style.top = stickyTop + 'px'
      r.root.style.height = trackWaveHeight + 'px'
      r.side.style.position = 'relative'
      const controls = el('div', 'wave-controls')
      for (const [height, name] of [[64,'SMALL'],[112,'MEDIUM'],[176,'LARGE']]) {
        const button = el('button')
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        icon.setAttribute('viewBox', '0 0 22 20')
        icon.setAttribute('aria-hidden', 'true')
        const path = document.createElementNS(icon.namespaceURI, 'path')
        path.setAttribute('d', height === 64 ? 'M4 10h14' : height === 112 ? 'M4 7h14M4 13h14' : 'M4 4h14M4 10h14M4 16h14')
        icon.append(path)
        button.append(icon)
        button.title = 'WAVEFORM ' + name
        button.setAttribute('aria-label', button.title)
        button.setAttribute('aria-pressed', String(trackWaveHeight === height))
        button.onclick = () => { trackWaveHeight = height; draw() }
        controls.append(button)
      }
      const units = el('button')
      units.title = trackBars ? 'SHOW BEATS' : 'SHOW BARS (4/4)'
      units.setAttribute('aria-label', units.title)
      units.setAttribute('aria-pressed', String(trackBars))
      const unitIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      unitIcon.setAttribute('viewBox', '0 0 22 20')
      unitIcon.setAttribute('aria-hidden', 'true')
      const unitPath = document.createElementNS(unitIcon.namespaceURI, 'path')
      unitPath.setAttribute('d', trackBars ? 'M3 15V5h16v10M7 8v5M11 8v5M15 8v5' : 'M3 12h5l3-7 3 10 2-3h3')
      unitIcon.append(unitPath)
      units.append(unitIcon)
      units.onclick = () => { trackBars = !trackBars; draw() }
      controls.append(units)
      r.side.append(controls)
      for (const tick of state.beatGrid || []) {
        if (trackBars && Math.abs(tick.beat / 4 - Math.round(tick.beat / 4)) > 1e-6) continue
        if (tick.time < start || tick.time > start + span) continue
        const line = el('i', 'wave-beat-line' + (tick.major ? ' major' : ''))
        line.style.left = x(tick.time) + '%'
        r.lane.append(line)
        seekTarget(line, tick.time, 'GO TO BEAT ' + tick.beat)
        if ((tick.major || trackBars) && Number.isFinite(tick.beat)) seekTarget(marker(r.lane, tick.time, trackBars ? String(Math.round(tick.beat / 4)) : String(Number(tick.beat.toFixed(2))), 'tick beat-tick'), tick.time, 'GO TO BEAT ' + tick.beat)
      }
    }
    if (uid) {
      r.root.dataset.waveformUid = uid
      r.root.style.height = (waveformHeights.get(uid) || 64) + 'px'
      r.root.style.resize = 'vertical'
      r.root.style.overflow = 'hidden'
      r.root.style.minHeight = '48px'
      r.root.style.maxHeight = '420px'
      r.root.title = 'DRAG CORNER TO RESIZE'
      r.root.addEventListener('pointerdown', (event) => {
        if (event.clientY > r.root.getBoundingClientRect().bottom - 16) resizingWaveform = true
      })
    }
    // Source preview is explicitly separate until native playback mapping has
    // been verified (loops, offsets and quantized sections are not linear).
    if (wave?.status !== 'ready') {
      r.lane.append(
        el(
          'span',
          'wave-status',
          wave?.status === 'loading' ? 'BUILDING WAVEFORM…' : wave?.reason || 'WAVEFORM UNAVAILABLE',
        ),
      )
      return
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1000 54')
    const audioStart = owner ? owner.start : 0
    // Preserve seconds per sample; the layer bounds clip rather than stretch audio.
    const audioDuration = wave.duration
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) return
    const showWholeSource = ['Loop', 'Ping-pong'].includes(owner?.playback?.endpoint)
    const visibleDuration = owner && !showWholeSource ? Math.max(0, Math.min(audioDuration, owner.end - owner.start)) : audioDuration
    svg.style.clipPath = 'inset(0 ' + ((1 - visibleDuration / audioDuration) * 100) + '% 0 0)'
    svg.style.position = 'absolute'
    svg.style.left = x(audioStart) + '%'
    svg.style.width = (audioDuration / span * 100) + '%'
    svg.style.top = '0'
    svg.setAttribute('preserveAspectRatio', 'none')
    const path = document.createElementNS(svg.namespaceURI, 'path')
    const points = []
    const stride = Math.max(1, Math.ceil(wave.peaks.length / 1200))
    for (let i = 0; i < wave.peaks.length; i += stride) {
      const peak = Math.max(...wave.peaks.slice(i, i + stride)) * 23
      const at = (i / wave.peaks.length) * 1000
      points.push('M' + at + ',' + (27 - peak) + 'V' + (27 + peak))
    }
    path.setAttribute('d', points.join(' '))
    path.setAttribute('stroke', '#62acbe')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(path)
    r.lane.append(svg)

  }
  function draw() {
    if (mouseGesture || layerReorder || editPending || interactionBusy) return
    if (!state || resizingWaveform) return
    const top = viewport.scrollTop
    for (const node of sheet.querySelectorAll('[data-waveform-uid]'))
      waveformHeights.set(node.dataset.waveformUid, node.getBoundingClientRect().height)
    sheet.style.setProperty('--pan', '0px')
    sheet.replaceChildren()
    sheet.dataset.origin = start
    grid()
    for (const guide of state.alignmentGuides || []) {
      if (guide.time < start || guide.time > start + span) continue
      const line = el('i', 'alignment-guide' + (guide.subtle ? ' subtle' : '') + (guide.count > 0 ? ' matched' : ''))
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(guide.time) / 100 + ')'
      line.title = (guide.count > 0 ? 'ALIGNED\n' : '') + guide.labels.join('\n')
      sheet.append(line)
    }

    const annotations = state.annotations || {}
    for (const [title, kind] of [
      ['CUES', 'cue'],
      ['TIMECODE', 'tc'],
      ['MIDI', 'midi'],
      ['NOTES', 'notes'],
    ]) {
      const r = row(title, 'annotations')
      annotationMouse(r.lane,kind)
      const entries =
        kind === 'notes'
          ? annotations.notes || []
          : (annotations.tags || []).filter((t) => String(t.type).toLowerCase().includes(kind))
      for (const item of entries) {
        const node = marker(r.lane, item.time, String(item.text ?? item.value ?? ''), 'cue-marker ' + kind)
        if (!node || !state.seekEnabled) continue
        seekTarget(node, item.time, 'GO TO ' + title + ' ' + node.textContent)
        annotationMouse(r.lane,kind,node,item)
      }
    }
    let headerTop = 0
    for (const header of sheet.querySelectorAll('.ruler, .annotations')) {
      header.classList.add('timeline-header')
      header.style.top = headerTop + 'px'
      headerTop += header.offsetHeight
      header.querySelector('.lane').append(el('i', 'header-playhead'),el('i','header-edithead'))
    }
    if (state.trackAudio) waveform(state.trackWaveform, 'TRACK AUDIO', undefined, headerTop)
    const parents = new Set()
    let ancestor = state.layers.find((l) => l.uid === state.focusUid)
    while (ancestor?.parent && !parents.has(ancestor.parent)) {
      parents.add(ancestor.parent)
      ancestor = state.layers.find((l) => l.uid === ancestor.parent)
    }
    const hidden = new Set()
    for (const layer of state.layers) {
      if (hidden.has(layer.parent)) {
        hidden.add(layer.uid)
        continue
      }
      if (layer.group && !layer.expanded && !parents.has(layer.uid)) hidden.add(layer.uid)
      const focused = layer.uid === state.focusUid
      const r = row('', 'layer' + (focused ? ' focused' : ''))
      r.root.dataset.uid = layer.uid
      r.side.style.paddingLeft = 12 + Math.min(6, layer.depth || 0) * 12 + 'px'
      const mode = parameterModes.get(layer.uid) || (focused ? 'sequenced' : 'none')
      const controls = el('div', 'wave-controls')
      if (!layer.group) {
        for (const [kind, label, glyph] of [['sequenced','SEQUENCED PARAMETERS','◆'],['all','ALL PARAMETERS','≡'],['none','HIDE PARAMETERS','−']]) {
          const button = el('button', 'parameter-mode')
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          icon.setAttribute('viewBox', '0 0 22 20')
          icon.setAttribute('aria-hidden', 'true')
          const path = document.createElementNS(icon.namespaceURI, 'path')
          path.setAttribute('d', kind === 'sequenced' ? 'M11 3l7 7-7 7-7-7z' : kind === 'all' ? 'M4 4h14M4 10h14M4 16h14' : 'M4 10h14')
          icon.append(path)
          button.append(icon)
          button.title = label
          button.setAttribute('aria-label', label + ' · ' + layer.name)
          button.setAttribute('aria-pressed', String(mode === kind))
          button.onclick = () => {
            parameterModes.set(layer.uid, kind)
            rendered = ''
            lastFullRead = 0
            draw()
          }
          controls.append(button)
        }
        r.side.append(controls)
      }
      const audioResource = (layer.resources || []).find((field) => field.current?.audio)?.current
      if (audioResource) {
        const toggle = el(
          'button',
          'wave-toggle',
          '∿',
        )
        toggle.setAttribute('aria-label', 'WAVEFORM · ' + layer.name)
        toggle.setAttribute('aria-pressed', String(waveformOpen.has(layer.uid)))
        toggle.title = waveformOpen.has(layer.uid) ? 'HIDE WAVEFORM' : 'SHOW WAVEFORM'
        toggle.onclick = () => {
          if (waveformOpen.has(layer.uid)) waveformOpen.delete(layer.uid)
          else waveformOpen.add(layer.uid)
          rendered = ''
          draw()
        }
        const refresh = el('button', 'wave-refresh', '↻')
        refresh.title = 'REFRESH WAVEFORM'
        refresh.setAttribute('aria-label', 'REFRESH WAVEFORM · ' + layer.name)
        refresh.onclick = async () => {
          refresh.disabled = true
          try {
            const response = await fetch('/api/waveform/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': state.selectionToken },
              body: JSON.stringify({ trackUid: state.trackUid, layerUid: layer.uid }),
              signal: AbortSignal.timeout(10000),
            })
            if (!response.ok) throw new Error('Refresh failed')
            waveformOpen.add(layer.uid)
            layer.waveform = { status: 'loading' }
            lastFullRead = 0
            rendered = ''
            draw()
            $('selectionMessage').textContent = ''
          } catch {
            $('selectionMessage').textContent = 'Waveform refresh unavailable'
          } finally {
            refresh.disabled = false
          }
        }
        for (const [button, shape] of [[toggle, 'M2 10h3l2-6 3 12 3-12 3 12 2-6h2'], [refresh, 'M17 7a7 7 0 1 0 0 6 M17 2v5h-5']]) {
          button.textContent = ''
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          icon.setAttribute('viewBox', '0 0 22 20')
          icon.setAttribute('aria-hidden', 'true')
          const path = document.createElementNS(icon.namespaceURI, 'path')
          path.setAttribute('d', shape)
          icon.append(path)
          button.append(icon)
        }
        controls.append(toggle, refresh)
      }
      const currentResources = (layer.resources || []).map(f => f.current).filter(Boolean)
      const media = currentResources.find(r => Number.isFinite(r.duration))
        || (layer.resources || []).find(f => !['palette', 'mapping', 'output', 'cdl'].includes(f.name.toLowerCase()) && (f.current?.thumbnail || f.current?.audio))?.current
      const resource = media?.thumbnail ? media : currentResources.find(r => r.thumbnail)
      const info = el('small', 'layer-media-info')
      info.style.display = 'flex'
      info.style.flexDirection = 'column'
      info.style.alignItems = 'flex-end'
      info.style.lineHeight = '1.25'
      info.style.maxWidth = '112px'
      info.style.minWidth = '0'
      info.style.flexShrink = '0'
      const fullName = media?.name || layer.typeLabel
      const measure = document.createElement('canvas').getContext('2d')
      measure.font = '10px Segoe UI'
      let displayName = fullName
      if (measure.measureText(fullName.toUpperCase()).width > 110) {
        let prefix = Math.max(3, fullName.length - 12)
        const suffix = fullName.slice(-12)
        do { displayName = fullName.slice(0, prefix--) + '......' + suffix }
        while (prefix >= 3 && measure.measureText(displayName.toUpperCase()).width > 110)
      }
      const mediaName = el('span', '', displayName)
      mediaName.style.maxWidth = '100%'
      mediaName.style.overflow = 'hidden'
      mediaName.style.textOverflow = 'ellipsis'
      mediaName.style.whiteSpace = 'nowrap'
      mediaName.title = media?.name || layer.typeLabel
      info.append(mediaName)
      if (Number.isFinite(media?.duration)) {
        const rate = media.fps || state.fps || 25
        const nominal = Math.round(rate)
        const frames = Math.round(media.duration * rate)
        const seconds = Math.floor(frames / nominal)
        const label = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frames % nominal].map(n => String(n).padStart(2, '0')).join(':')
          + (media.fps ? ' @ ' + Number(media.fps.toFixed(3)) : '')
        const duration = el('span', '', label)
        duration.title = 'SOURCE DURATION' + (media.fps ? ' @ SOURCE FPS' : '')
        info.append(duration)
      }
      const layerLabel=selectionButton(layer,layer.name)
      reorderLabel(layerLabel,layer)
      r.side.append(image(resource), layerLabel, info)
      const left = Math.max(start, layer.start),
        right = Math.min(start + span, layer.end)
      if (right >= left) {
        const clip = selectionButton(layer, layer.name)
        clip.className = 'clip'
        const clipLabel = el('span', 'clip-label', layer.name)
        if (layer.playback?.mode) clipLabel.append(el('span', 'playback-mode', ' ' + layer.playback.mode.toUpperCase()))
        const endpoint = layer.playback?.endpoint
        const shapes = { Pause:'M7 4v12M13 4v12', Loop:'M17 7a7 7 0 1 0 0 6 M17 2v5h-5', 'Ping-pong':'M3 10h14M3 10l4-4M3 10l4 4M17 10l-4-4M17 10l-4 4' }
        if (shapes[endpoint]) {
          const badge = el('span','playback-icon')
          badge.title = 'AT END POINT: ' + endpoint.toUpperCase()
          badge.setAttribute('aria-label',badge.title)
          const icon = document.createElementNS('http://www.w3.org/2000/svg','svg')
          icon.setAttribute('viewBox','0 0 22 20')
          const shape = document.createElementNS(icon.namespaceURI,'path')
          shape.setAttribute('d',shapes[endpoint]); icon.append(shape); badge.append(icon); clipLabel.append(badge)
        }
        clip.replaceChildren(clipLabel)
        clip.setAttribute('aria-label', 'SELECT LAYER · ' + layer.name)
        clip.style.left = x(left) + '%'
        clip.style.width = Math.max(0, x(right) - x(left)) + '%'
        clip.title = 'IN ' + layer.start + ' S · OUT ' + layer.end + ' S'
        r.lane.append(clip)
        mouseDial(clip, layer, 'field')
        const thumb = image(resource)
        thumb.style.position = 'absolute'
        thumb.style.pointerEvents = 'none'
        thumb.style.left = x(left) + '%'
        r.lane.append(thumb)
      }
      for (const [kind, time] of [['in',layer.start],['out',layer.end]]) {
        const edge = marker(r.lane,time,'','layer-edge')
        if (edge) { edge.title = kind.toUpperCase() + ' · ' + layer.name; pointClick(edge,layer,kind) }
      }
      for (const field of [...layer.fields, ...layer.resources])
        if (field.sequenced) {
          for (const key of visibleKeys(field, layer)) {
            const m = marker(r.lane, key.time, '', 'key key-point')
            if (m) {
              m.title = field.label
              pointClick(m, layer, 'key', field.name, key.time)
            }
          }
        }
      if (waveformOpen.has(layer.uid))
        waveform(layer.waveform || { status: 'loading' }, 'AUDIO', layer.uid)
      if (mode !== 'none')
        for (const field of (layer.allParameters || layer.visibleParameters || []).filter(f => mode === 'all' || (f.sequenced && f.keys?.length))) {
          const p = row(
            field.label || field.name,
            'parameter' + (field.name === state.parameter ? ' selected' : ''),
          )
          addKeyAtPointer(p.lane,layer,field)
          p.side.replaceChildren(selectionButton(layer, field.label || field.name, field.name))
          p.side.dataset.parameterValue = field.name
          p.side.dataset.parameterLayer = layer.uid
          const choice = field.choices?.find((c) => c.value === field.value)
          const value = field.unsupported
            ? 'UNAVAILABLE'
            : (('current' in field ? field.current?.name || 'NONE' : undefined) ??
              choice?.label ??
              (Number.isFinite(field.value) ? Number(field.value.toFixed(5)).toString() : ''))
          const valueLabel=el('small','',value)
          if (!field.unsupported && !('current' in field)) {
            valueLabel.title='EDIT VALUE';valueLabel.style.cursor='pointer';valueLabel.tabIndex=0;valueLabel.setAttribute('role','button')
            valueLabel.onclick=event=>valueMenu(layer,field,event)
            valueLabel.oncontextmenu=event=>valueMenu(layer,field,event)
            valueLabel.onkeydown=event=>{if(event.key==='Enter'){const r=valueLabel.getBoundingClientRect();valueMenu(layer,field,{clientX:r.x,clientY:r.bottom,preventDefault:()=>event.preventDefault(),stopPropagation:()=>event.stopPropagation()})}}
          }
          p.side.append(valueLabel)
          if ('current' in field) {
            constantResourceTarget(valueLabel,layer,field)
            const current=marker(p.lane, layer.start, field.current?.name || 'NONE', 'resource')
            current?.prepend(image(field.current,true))
            constantResourceTarget(current,layer,field)
            if (field.sequenced)
              for (const key of visibleKeys(field, layer)) {
                const item = marker(p.lane, key.time, key.resource?.name || 'NONE', 'resource')
                item?.prepend(image(key.resource,true))
                pointClick(item,layer,'key',field.name,key.time)
              }
          } else curve(p.lane, field, layer)
        }
    }
    const visibleRow = (uid) => {
      const seen = new Set()
      while (uid && !seen.has(uid)) {
        seen.add(uid)
        const node = [...sheet.querySelectorAll('[data-uid]')].find((n) => n.dataset.uid === uid)
        if (node) return node
        uid = state.layers.find((layer) => layer.uid === uid)?.parent
      }
    }
    for (const arrow of state.arrows || []) {
      const source = visibleRow(arrow.source)
      const dest = visibleRow(arrow.destination)
      if (!source || !dest || arrow.time < start || arrow.time > start + span) continue
      if (source === dest) continue
      const line = el('div', 'relation ' + (source.offsetTop < dest.offsetTop ? 'down' : 'up'))
      line.title = 'DESIGNER CONNECTION'
      line.style.left = 'calc(240px + (100% - 240px) * ' + x(arrow.time) / 100 + ')'
      line.style.top = Math.min(source.offsetTop + source.offsetHeight / 2, dest.offsetTop + dest.offsetHeight / 2) + 'px'
      line.style.height = Math.max(1, Math.abs(source.offsetTop + source.offsetHeight / 2 - dest.offsetTop - dest.offsetHeight / 2)) + 'px'
      sheet.append(line)
    }
    const playhead = el('i', 'playhead')
    playhead.id = 'playhead'
    sheet.append(playhead)
    const edithead=el('i','edithead');edithead.id='edithead';sheet.append(edithead)
    for (const target of sheet.querySelectorAll('[title], [aria-label]')) {
      if (target.title) target.title = target.title.toUpperCase()
      if (target.hasAttribute('aria-label')) target.setAttribute('aria-label', target.getAttribute('aria-label').toUpperCase())
    }
    viewport.scrollTop = top
    updatePlayhead()
  }
  function updatePlayhead() {
    if (!state) return
    $('clock').textContent = state.timecode || '—'
    $('editClock').hidden = state.editor?.linkTime !== false
    $('editClock').textContent = state.editor?.editTimecode || '—'
    $('beat').textContent = state.quantized && Number.isFinite(state.beat) ? 'BEAT ' + Number(state.beat.toFixed(2)) : ''
    const annotations = state.annotations || {}
    const latest = items => items.filter(item => item.time <= state.time).reduce((a, b) => !a || b.time >= a.time ? b : a, null)
    const details = []
    for (const kind of ['CUE', 'MIDI']) {
      const item = latest((annotations.tags || []).filter(tag => String(tag.type).toUpperCase() === kind))
      if (item) details.push(kind + ' ' + item.value)
    }
    const note = latest(annotations.notes || [])
    if (note?.text) details.push(note.text)
    $('clockDetails').textContent = details.join(' · ')
    $('clockDetails').title = details.join(' · ')
    const section = (state.sections || []).find(item => state.time >= item.start && state.time < item.end)
    // Section OUT is exclusive; playback stops on the last frame inside it.
    const rate = Number.isFinite(state.fps) && state.fps > 0 ? state.fps : 25
    const lastFrame = section ? Math.max(section.start, (Math.ceil(section.end * rate - 1e-7) - 1) / rate) : 0
    const remaining = section ? Math.max(0, lastFrame - state.time - 1e-7) : null
    const whole = remaining === null ? 0 : Math.ceil(remaining)
    const duration = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(n => String(n).padStart(2, '0')).join(':')
    $('sectionRemaining').textContent = section ? duration : ''
    $('sectionRemaining').className = remaining !== null && remaining <= 10 ? 'ending' : ''
    for (const button of sheet.querySelectorAll('[data-select-layer]')) {
      const target = state.layers.find((layer) => layer.uid === button.dataset.selectLayer)
      button.title = 'SELECT IN COMPANION'
      button.disabled =
        !state.selectionEnabled ||
        !target ||
        (target.group && !(state.editEnabled && button.dataset.reorderGroup==='true')) ||
        (!target.group && (editClock()<target.start || editClock()>=target.end))
    }
    const layer = state.layers.find((layer) => layer.uid === state.focusUid)
    for (const node of sheet.querySelectorAll('[data-parameter-value]')) {
      const owner = state.layers.find(item => item.uid === node.dataset.parameterLayer)
      const field = owner?.fields.find((field) => field.name === node.dataset.parameterValue)
      if (!field) continue
      const value =
        owner?.uid === state.focusUid && field.name === state.parameter && Number.isFinite(state.liveValue) ? state.liveValue : field.value
      const label = node.querySelector('small')
      if (label && Number.isFinite(value))
        label.textContent =
          field.choices?.find((choice) => choice.value === value)?.label ??
          Number(value.toFixed(5)).toString()
    }
    // Every segment uses one pixel position and transition for the same paint.
    // Different easing on sticky headers and the body visibly tears the line.
    const fraction = x(state.time) / 100
    const position = fraction * Math.max(0, sheet.clientWidth - 240)
    const transition = !frame && displayedTime !== null && Math.abs(state.time - displayedTime) < 0.75
      ? 'left 100ms linear' : 'none'
    for (const node of sheet.querySelectorAll('.header-playhead, #playhead')) {
      node.style.transition = transition
      node.style.left = (position + (node.id === 'playhead' ? 240 : 0)) + 'px'
      node.hidden = fraction < 0 || fraction > 1
    }
    const editFraction=x(editClock())/100
    const editPosition=editFraction*Math.max(0,sheet.clientWidth-240)
    for(const node of sheet.querySelectorAll('.header-edithead, #edithead')) {
      node.style.left=(editPosition+(node.id==='edithead'?240:0))+'px'
      node.hidden=state.editor?.linkTime !== false || editFraction<0 || editFraction>1
    }
    displayedTime = state.time
  }
  function bounds(value) {
    return Math.max(0, Math.min(Math.max(0, (state?.length || span) - span), value))
  }
  function animate() {
    frame = 0
    const delta = targetStart - start
    if (Math.abs(delta) < span / 2000) {
      start = targetStart
      draw()
      return
    }
    start = bounds(start + delta * 0.16)
    const offset = ((Number(sheet.dataset.origin) - start) / span) * Math.max(1, sheet.clientWidth - 240)
    sheet.style.setProperty('--pan', offset + 'px')
    updatePlayhead()
    frame = requestAnimationFrame(animate)
  }
  function setFollow(value) {
    follow = value
    $('follow').setAttribute('aria-pressed', String(value))
  }
  function zoom(factor) {
    if (!state) return
    cancelAnimationFrame(frame)
    frame = 0
    const centre = Number.isFinite(editClock()) ? editClock() : start + span / 2
    span = Math.min(state.length || 1, Math.max(2 / (state.fps || 25), span * factor))
    start = bounds(centre - span / 2)
    draw()
    rendered = ''
  }
  $('zoomIn').onclick = () => zoom(0.5)
  $('zoomOut').onclick = () => zoom(2)
  $('fitTrack').onclick = () => {
    if (state) {
      span = state.length || 1
      start = 0
      draw()
      rendered = ''
    }
  }
  $('fitLayer').onclick = () => {
    const layer = state?.layers.find((l) => l.uid === state.focusUid)
    if (layer) {
      cancelAnimationFrame(frame)
      frame = 0
      setFollow(false)
      const duration = Math.max(2 / (state.fps || 25), layer.end - layer.start)
      span = duration / 0.92
      start = (layer.start + layer.end - span) / 2
      draw()
      rendered = ''
    }
  }
  $('follow').onclick = () => setFollow(!follow)
  viewport.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault()
        zoom(event.deltaY > 0 ? 1.2 : 1 / 1.2)
      } else if (event.shiftKey || Math.abs(event.deltaX) > 0) {
        event.preventDefault()
        setFollow(false)
        cancelAnimationFrame(frame)
        frame = 0
        start = bounds(
          start + ((event.deltaX || event.deltaY) * span) / Math.max(100, viewport.clientWidth - 240),
        )
        draw()
        rendered = ''
      }
    },
    { passive: false },
  )
  new ResizeObserver(() => draw()).observe(viewport)
  // Keep small live reads independent of expensive geometry/thumbnail snapshots.
  let latestLive = null
  async function pollLive() {
    try {
      if (!document.hidden && state) {
        const readRevision = editRevision
        const response = await fetch('/api/live', { signal: AbortSignal.timeout(3000) })
        if (!response.ok) throw new Error('Disconnected')
        const incoming = await response.json()
        if ((incoming.editRevision || 0) < confirmedRevision) return
        if (readRevision !== editRevision || interactionBusy) return
        latestLive = incoming
        if (incoming.trackUid !== state.trackUid || incoming.focusUid !== state.focusUid || incoming.contentRevision !== state.contentRevision || incoming.tempoKey !== state.tempoKey) {
          lastFullRead = 0
          rendered = ''
        }
        if (incoming.trackUid === state.trackUid) {
          const selectionChanged = incoming.focusUid !== state.focusUid || incoming.parameter !== state.parameter
          // Show confirmed selection immediately using cached rows. Native curves
          // arrive independently; no speculative edits are sent to Designer.
          const { contentRevision, tempoKey, ...live } = incoming
          const currentEditor = state.editor
          Object.assign(state, live)
          if (editPending || interactionBusy || mouseGesture) state.editor = currentEditor
          updateEditorControls()
          if (selectionChanged && !resizingWaveform) draw()
          else updatePlayhead()
          $('status').textContent = state.connected ? 'LIVE' : 'CONNECTION LOST'
          $('status').className = state.connected ? 'live' : 'error'
        }
      }
    } catch {
      $('status').textContent = 'CONNECTION LOST'
      $('status').className = 'error'
    } finally {
      setTimeout(pollLive, 75)
    }
  }
  async function poll() {
    try {
      if (!document.hidden && !mouseGesture && !editPending && !interactionBusy) {
        const view = JSON.stringify([start, span, viewport.clientWidth, [...waveformOpen], expandedLayers()])
        const full = !state || !rendered || view !== lastView || performance.now() - lastFullRead >= 1500
        if (!full) return
        const readRevision = editRevision
        const response = await fetch(
          full
            ? '/api/state?start=' +
                Math.max(0, start) +
                '&end=' +
                (start + span) +
                '&width=' +
                Math.max(320, viewport.clientWidth - 240) +
                '&waveforms=' +
                encodeURIComponent([...waveformOpen].join(',')) + '&expanded=' + encodeURIComponent(expandedLayers().join(','))
            : '/api/live',
          { signal: AbortSignal.timeout(8000) },
        )
        if (!response.ok) throw new Error('Disconnected')
        const incoming = await response.json()
        if ((incoming.editRevision || 0) < confirmedRevision) return
        if (readRevision !== editRevision || editPending || interactionBusy || mouseGesture) return
        if (full) {
          // A selection can change while a slow snapshot is in flight.
          if (latestLive && (latestLive.trackUid !== incoming.trackUid || latestLive.focusUid !== incoming.focusUid)) {
            lastFullRead = 0
            rendered = ''
            return
          }
          const currentEditor = state?.editor
          state = incoming
          if (editPending) state.editor = currentEditor
          if (latestLive?.trackUid === state.trackUid && latestLive?.focusUid === state.focusUid) {
            state.time = latestLive.time
            state.timecode = latestLive.timecode
            state.liveValue = latestLive.liveValue
          }
          lastFullRead = performance.now()
          lastView = view
        }
        if (trackUid !== state.trackUid) {
          trackUid = state.trackUid
          start = 0
          span = state.length || 60
        }
        $('track').textContent = String(state.trackName || '').replace(/\.apx$/i, '').toUpperCase()
        updateEditorControls()
        $('status').textContent = state.connected ? 'LIVE' : 'CONNECTION LOST'
        $('status').className = state.connected ? 'live' : 'error'
        $('warnings').textContent = (state.warnings || []).join(' · ')
        const signature = JSON.stringify([
          state.renderRevision,
          state.focusUid,
          state.parameter,
          state.alignmentGuides,
        ])
        if (signature !== rendered && !resizingWaveform) {
          rendered = signature
          draw()
        } else updatePlayhead()
        if (!mouseGesture && follow && (editClock() < start + span * 0.06 || editClock() > start + span * 0.94)) {
          targetStart = bounds(editClock() - span * (editClock() < start ? 0.2 : 0.7))
          if (!frame && Math.abs(targetStart - start) > span / 2000) frame = requestAnimationFrame(animate)
        }
      }
    } catch {
      $('status').textContent = 'CONNECTION LOST'
      $('status').className = 'error'
    } finally {
      setTimeout(poll, 100)
    }
  }
  void pollLive()
  void poll()
}

const stylesheet = `
.parameter .label .select-label{font-size:13px}.parameter .label small{font-size:12px;font-variant-numeric:tabular-nums;max-width:110px}.parameter .label small[role=button]:hover{color:#63d4e7}
.resource-folder-row{display:flex;flex-wrap:nowrap;gap:4px;flex-shrink:0;overflow-x:auto;padding:3px 0;border-bottom:1px solid #29363d;scrollbar-width:thin}.resource-folder-row button{flex:0 0 auto;max-width:240px}.resource-folder-row button:hover{color:#63d4e7;background:#10343d}
.resource-folder-parent{color:#729db4;font-size:10px;padding:5px 0}.resource-file>span:last-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.resource-picker[hidden]{display:none}.resource-picker{position:fixed;z-index:40;right:20px;top:160px;width:min(680px,calc(100vw - 40px));max-height:calc(100vh - 180px);overflow:auto;background:#151e23;border:1px solid #237484;border-radius:9px;box-shadow:0 12px 40px #000a;padding:10px}.resource-picker-bar{display:flex;align-items:center;gap:7px;padding:4px 0}.resource-picker-bar strong{flex:1}.resource-picker button{font-size:10px;padding:4px 7px}.resource-picker-body{display:grid;grid-template-columns:180px 1fr;gap:12px;margin-top:8px}.resource-folders{display:flex;flex-direction:column;gap:3px;max-height:340px;overflow:auto;border-right:1px solid #29363d;padding-right:8px}.resource-folders button{text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-color:transparent;background:transparent}.resource-folders button[aria-pressed=true]{background:#10343d;border-color:#237484}.resource-files{min-width:0}.resource-path{color:#8bcbd6;font-size:11px;overflow-wrap:anywhere;padding-bottom:8px}.resource-file-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;min-height:150px}.resource-file{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}.resource-file>span:last-child{max-width:100%;overflow-wrap:anywhere;line-height:1.3}.resource-file .thumb{width:100%;height:52px}.resource-picker .resource-picker-bar:last-child{justify-content:flex-end}
.key-edit-menu{position:fixed;z-index:50;display:grid;gap:3px;padding:5px;width:165px;background:#151e23;border:1px solid #0699b2;border-radius:5px;box-shadow:0 4px 16px #0009}.key-edit-menu button{padding:3px 7px;font-size:10px;text-align:left}.value-edit-menu button{font-size:11px;padding:5px 7px;min-height:27px;width:100%;box-sizing:border-box}
.timeline-target,.clip{touch-action:none}.key-edit-menu[hidden]{display:none}.snap-option{display:flex;align-items:center;gap:7px;padding:6px 8px;font-size:10px;white-space:nowrap;cursor:pointer}.snap-guide{position:absolute;top:0;bottom:0;width:2px;background:#ffc580;box-shadow:0 0 5px #ffc58088;z-index:8;pointer-events:none}.key-edit-menu input{background:#101a20;color:#eef4f6;border:1px solid #44616f;border-radius:3px;padding:5px}.key-edit-menu strong{font-size:11px}
:root{color-scheme:dark;font:12px 'Segoe UI',Arial,sans-serif;background:#101517;color:#eef4f6}*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}header,.toolbar{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid #29363d}header{height:82px;min-height:82px;padding:5px 16px;position:relative}#status{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.08em}#status:before{content:'';width:8px;height:8px;border-radius:50%;background:#849aa5}#status.live:before{background:#43e68c;animation:live-pulse 1.4s ease-in-out infinite}#status.error:before{background:#ffc580}@keyframes live-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #43e68c44}50%{opacity:.45;box-shadow:0 0 0 4px #43e68c00}}@media(prefers-reduced-motion:reduce){#status.live:before{animation:none}}h1{font-size:15px;letter-spacing:.08em;margin:0}.brand-logo{position:relative;width:72px;height:41px;overflow:hidden;flex-shrink:0;align-self:center}.brand-logo img{position:absolute;top:-19px;left:-4px;width:80px;height:80px}header small{display:block;color:#849aa5;margin-top:5px;letter-spacing:.15em}.spacer{flex:1}#clockBlock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;max-width:40%;line-height:1.2}#editClock{font:14px Consolas,monospace;color:#4aaaff;line-height:16px}#clock{color:#43e68c;font:24px Consolas,monospace;white-space:nowrap}#beat{font:12px Consolas,monospace;color:#8bcbd6;margin-left:10px}#clockDetails{font-size:12px;color:#9eb6c2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:15px}#sectionRemaining{font:14px Consolas,monospace;color:#8bcbd6;min-height:17px}#sectionRemaining.ending{color:#ff6268}.live{color:#43e68c}.error{color:#ffc580}.toolbar{padding:4px 16px;gap:7px;flex-wrap:wrap;min-height:32px}.toolbar button{padding:3px 7px;font-size:10px;line-height:16px;border-radius:4px}.toolbar #track{font-size:11px}button{background:#1b272d;border:1px solid #34444d;border-radius:5px;color:#d4e2e8;padding:7px 10px;cursor:pointer}button[aria-pressed=true]{border-color:#0699b2;color:#63d4e7}button:focus-visible{outline:2px solid #43e68c}#viewport{flex:1;overflow:auto;margin:7px 12px;border:1px solid #29363d;border-radius:6px;min-height:0}#sheet{position:relative;min-width:760px;overflow:clip;min-height:100%}.row{display:grid;grid-template-columns:240px 1fr;position:relative;min-height:54px;border-bottom:1px solid #26343b}.label{background:#151e23;padding:10px 12px;display:flex;gap:9px;align-items:center;z-index:3;border-right:1px solid #29363d;min-width:0;overflow:hidden}.layer{height:52px;min-height:52px}.layer>.label{position:relative;padding-top:14px;padding-bottom:4px}.layer>.lane>.clip{top:11px;height:30px;padding-top:6px;padding-bottom:6px}.layer>.lane>.key-point{top:22px}.layer>.lane>.thumb{top:14px}.label .name{overflow:hidden;text-overflow:ellipsis}.label small{margin-left:auto;color:#729db4;font-size:10px;max-width:85px;overflow:hidden;text-overflow:ellipsis}.lane{position:relative;min-width:0;overflow:hidden}.timeline-header{position:sticky;z-index:6;background:#101517;height:30px;min-height:30px}.timeline-header>.label{padding-top:5px;padding-bottom:5px}.header-edithead,.edithead{position:absolute;top:0;bottom:0;width:2px;background:#4aaaff;box-shadow:0 0 5px #4aaaff66;pointer-events:none;z-index:5;transform:none!important}.header-playhead{position:absolute;top:0;bottom:0;width:1px;background:#43e68c;pointer-events:none;z-index:4;transform:none!important}.section-band{position:absolute;top:0;bottom:0;border-left:1px solid #4b8792;pointer-events:none;background:#16414b}.section-0{background:#293b4d;border-color:#6b8caa}.ruler{min-height:30px}.ruler>.label{font-size:10px}.annotations{min-height:30px;font-size:10px}.focused{background:#10343d}.focused .label{background:#10343d}.parameter .label{padding-left:30px;color:#91afbd}.parameter.selected{color:#43e68c}.parameter.selected .label{color:#43e68c}.parameter .lane{color:#729db4}.selected .lane{color:#43e68c}.lane svg{width:100%;height:54px}.clip{position:absolute;top:8px;height:36px;background:#1d3e49;border:1px solid #2b626f;border-radius:4px;padding:9px 42px;overflow:hidden;white-space:nowrap;color:#a9d8e3}.clip:disabled{cursor:default}.clip:not(:disabled):hover{border-color:#63d4e7;background:#26515e}.clip{min-width:0;padding:0!important;text-align:left}.playback-mode{font-size:10px;color:#8bcbd6;margin-left:5px}.playback-icon{display:inline-flex;vertical-align:middle;margin-left:5px;color:#8bcbd6}.lane .playback-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.clip-label{display:block;padding:6px 42px;white-space:nowrap}.marker{position:absolute;top:7px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;z-index:2;font-size:10px}.key{color:#72d5e8;top:20px;font-size:10px}.lane>.key-point{width:8px;height:8px;margin-left:-4px;top:23px;background:currentColor;border:1px solid #101517;transform:translateX(var(--pan,0px)) rotate(45deg)}.timeline-target{cursor:pointer}.timeline-target:focus-visible{outline:2px solid #43e68c}.layer-edge{top:11px;width:7px;height:30px;margin-left:-3px;border:1px solid #63d4e7;border-radius:2px;background:#0699b255;z-index:3}.timeline-target:hover{filter:brightness(1.6);color:#63d4e7;box-shadow:0 0 7px #63d4e7;outline:1px solid #63d4e7}.tick{color:#849aa5;font:10px Consolas,monospace}.ruler .tick{font-size:12px;color:#bdd0da}.cue-marker{top:3px;overflow:visible;max-width:220px;padding:3px 7px 3px 13px;height:22px;line-height:16px;border:0;border-radius:0;clip-path:polygon(0 50%,9px 0,100% 0,100% 100%,9px 100%);background:#29414e;font-size:10px;white-space:nowrap}.cue-marker:before{content:"";position:absolute;left:0;top:0;width:9px;height:22px;background:currentColor;clip-path:polygon(0 50%,100% 0,100% 100%)}.cue-marker.notes{max-width:260px}.cue-marker.midi{color:#b7a0dc}.cue-marker.tc{color:#74c6d8}.cue{color:#e1bf77}.notes{color:#acbfc8}.resource{display:flex;align-items:center;gap:5px;top:3px}.thumb{display:inline-flex;width:34px;height:24px;align-items:center;justify-content:center;background:#263b44;border-radius:3px;overflow:hidden;flex-shrink:0;color:#729db4}.thumb.large{width:60px;height:38px}.thumb img{width:100%;height:100%;object-fit:cover}.gridline{position:absolute;top:30px;bottom:0;width:1px;background:#88a9bb0b;pointer-events:none;z-index:1}.gridline.major{background:#88a9bb20}.playhead{position:absolute;top:0;bottom:0;width:1px;background:#43e68c;box-shadow:0 0 5px #43e68c66;z-index:4;pointer-events:none}.lane>*{transform:translateX(var(--pan,0px))}.alignment-guide.subtle{opacity:.3;pointer-events:none}.alignment-guide.matched{border-left:2px solid #ffe0a0;box-shadow:0 0 5px #e7ba6370}.alignment-guide.subtle.matched{opacity:.65}.alignment-guide{pointer-events:none;position:absolute;top:0;bottom:0;border-left:1px dashed #e7ba63;z-index:3;transform:translateX(var(--pan,0px))}.gridline,.relation{transform:translateX(var(--pan,0px))}.select-label{border:0;padding:0;background:transparent;color:inherit;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select-label:disabled{cursor:default}.select-label:not(:disabled):hover{color:#63d4e7}#selectionMessage{color:#e1bf77;margin-left:12px}.wave-controls{position:absolute;right:4px;top:4px;display:flex;gap:2px;z-index:5}.wave-controls button{width:16px;height:12px;padding:0;background:#151e23;border:1px solid #34444d;border-radius:4px;color:#849aa5;display:grid;place-items:center}.wave-controls svg{width:12px;height:10px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.wave-controls button:hover,.wave-controls button[aria-pressed=true]{color:#63d4e7;border-color:#0699b2}.wave-controls .parameter-mode{font-size:10px;line-height:10px}.wave-controls button:disabled{opacity:.45}.wave-beat-line{position:absolute;top:0;bottom:0;width:1px;background:#accdd526;z-index:2;pointer-events:none}.wave-beat-line.timeline-target{pointer-events:auto;cursor:pointer}.wave-beat-line.timeline-target:before{content:"";position:absolute;left:-4px;top:0;bottom:0;width:9px}.wave-beat-line.major{background:#accdd55c}.beat-tick{background:#101517bb;padding:1px 3px;z-index:3}.track-waveform{position:sticky;z-index:6;background:#101517}.waveform .lane svg{height:100%}.waveform .label{font-size:10px}.wave-status{display:block;padding:14px;color:#849aa5}.relation{position:absolute;width:3px;margin-left:-1px;background:#bd9be0;border-radius:3px;z-index:2;pointer-events:none;box-shadow:0 0 0 1px #10151799}.relation:after{content:"";position:absolute;width:13px;height:10px;left:-5px;background:#d4b8ef;clip-path:polygon(0 0,100% 0,50% 100%)}.relation.down:after{bottom:-1px}.relation.up:after{top:-1px;transform:rotate(180deg)}.relation:before{content:"";position:absolute;left:-2px;width:7px;height:7px;background:#d4b8ef;border-radius:50%}.relation.down:before{top:-2px}.relation.up:before{bottom:-2px}footer{min-height:27px;padding:4px 22px;color:#849aa5;font-size:10px}#warnings{color:#d5b97b;margin-left:12px}
`
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Disguise Layer Editor · Timeline</title><link rel="stylesheet" href="/viewer.css"><script src="/viewer.js" defer></script></head><body><header><span class="brand-logo"><img src="${brandLogo}" alt="VEHKA AV"></span><div><h1>DISGUISE LAYER EDITOR</h1><small>TIMELINE VIEWER</small></div><div class="spacer"></div><div id="clockBlock"><span id="clock">—</span><span id="beat"></span><div id="editClock" hidden></div><div id="clockDetails"></div><div id="sectionRemaining" aria-live="off"></div></div><span id="status" role="status">CONNECTING</span></header><div class="toolbar"><strong id="track">TRACK</strong><div class="spacer"></div><button id="fitTrack" title="FIT TRACK">FIT TRACK</button><button id="fitLayer" title="CENTRE SELECTED LAYER">FIT LAYER</button><button id="follow" title="FOLLOW PLAYHEAD" aria-pressed="true">FOLLOW</button><button id="zoomOut" aria-label="ZOOM OUT" title="ZOOM OUT">−</button><button id="zoomIn" aria-label="ZOOM IN" title="ZOOM IN">+</button></div><main id="viewport" aria-label="Designer timeline"><div id="sheet"></div></main><footer>CTRL + WHEEL: ZOOM · SHIFT + WHEEL: PAN<span id="selectionMessage" role="status"></span><span id="warnings"></span></footer></body></html>`

module.exports = { page, stylesheet, browserScript: '(' + browserMain.toString() + ')(' + applyEditPatch.toString() + ',' + discreteSegments.toString() + ')' }
