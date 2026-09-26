'use strict'
const { makeZoomScript } = require('./designer-zoom')
const { pythonParameterFader } = require('./parameter-fader')
const { pythonParameterStep } = require('./parameter-step')
const thumbnailScript = require('./thumbnail-script')

// ASCII-only transport prevents Python 2 source-encoding and quoting problems.
// The payload is data, never interpolated Python source. Context guards and
// bounds checks execute in Designer immediately before mutation, because a
// cached Companion snapshot cannot detect every concurrent GUI edit.
// Keep conversions through track.timeToBeat/beatToTime: tempo makes a fixed
// seconds-to-beats ratio incorrect. Native player.tCurrent is in beats,
// while all Companion timestamps and makeJumpToTime inputs are seconds. Do not write native GUI selection widgets.
const commands = new Set([
  'timeline_zoom',
  'refresh',
  'live_state',
  'playback_state',
  'resolve_timecode',
  'section_edit',
  'seek',
  'nudge_time',
  'thumbnail_identity',
  'key_clear_list',
  'keys_clear',
  'parameter_default',
  'layer_default',
  'layer_edit',
  'media_list',
  'media_set',
  'media_key_set',
  'read_field',
  'jump_key',
  'select_key',
  'key_type',
  'key_move',
  'adjust_value',
  'key_set',
  'constant_set',
  'key_clear',
  'key_delete',
])
function makeScript(command, args = {}) {
  if (!commands.has(command)) throw new Error('Unsupported CC1 command: ' + command)
  if (Object.hasOwn(args, 'command')) throw new Error('Invalid command arguments')
  if (command === 'timeline_zoom') return makeZoomScript(args.steps)
  const payload = Buffer.from(JSON.stringify({ command, ...args }), 'utf8').toString('base64')
  const body = `import json
import base64
import math
import re
import exceptions as pyerrors
import d3
p = json.loads(base64.b64decode('${payload}').decode('utf-8'))
manager = guisystem.currentTransportManager
track = manager.track if manager is not None else None
if p['command'] in ('live_state','refresh') and (track is None or
        (p.get('transportUid') and str(manager.uid) != p['transportUid']) or
        (p.get('trackUid') and str(track.uid) != p['trackUid'])):
    return {'contextChanged':True,'contextAvailable':track is not None,
            'transportUid':str(manager.uid) if manager is not None else None,
            'trackUid':str(track.uid) if track is not None else None}
if track is None:
    raise ValueError('No track selected in Designer')
if p.get('trackUid') and str(track.uid) != p['trackUid']:
    raise ValueError('Track changed. Refresh before editing.')
if p.get('transportUid') and str(manager.uid) != p['transportUid']:
    raise ValueError('Transport changed. Refresh before editing.')

def edit_seconds():
    seconds = float(p.get('editTime', track.beatToTime(manager.player.tCurrent))) if p.get('editTrackUid',str(track.uid)) == str(track.uid) else float(track.beatToTime(manager.player.tCurrent))
    if math.isnan(seconds) or math.isinf(seconds): raise ValueError('Invalid edit time')
    return max(0, min(float(track.lengthInSec), seconds))

def all_layers():
    return track.getLeafLayers(Module)

def reset_sequence_to_constant(field, value, start_beat):
    # Designer represents a constant with one carrier key. Removing every key
    # would not mean "constant"; retain one at IN and disable sequencing instead.
    sequence = field.sequence
    is_resource = isinstance(sequence, ResourceSequence)
    markDirty(field)
    markDirty(sequence)
    if sequence.nKeys() == 0:
        if is_resource:
            sequence.setResource(start_beat, value)
        else:
            sequence.setFloat(start_beat, value)
    if sequence.nKeys() > 1:
        sequence.remove(1, sequence.nKeys() - 1)
    local_offset = sequence.t(0) - sequence.key(0).localT
    sequence.key(0).localT = start_beat - local_offset
    if is_resource:
        sequence.key(0).r = value
    else:
        sequence.key(0).v = value
    field.disableSequencing = True
    field.notifyEdit()

def fps():
    custom = float(manager.customFps().value_or(0))
    return custom if custom > 0 else float(manager.beatToTimecode(0).fps())

def clock_info():
    mode = manager.smpteClockType()
    names = {Timecode.SMPTE23976: '23.976', Timecode.SMPTE24: '24', Timecode.SMPTE25: '25',
             Timecode.SMPTE2997: '29.97 NDF', Timecode.SMPTE2997DF: '29.97 DF', Timecode.SMPTE30: '30'}
    audio = track.audioTrack(track.timeToBeat(float(track.beatToTime(manager.player.tCurrent))))
    beat_mode = bool(track.quant) or bool(audio and len(audio.markers) >= 2)
    return {'beatMode': beat_mode, 'fps': fps(), 'tcMode': names.get(mode, str(mode)), 'customFps': float(manager.customFps().value_or(0)) > 0}

def media_type(field):
    if not isinstance(field.sequence, ResourceSequence) or not field.typeName.endswith('::RP'):
        return None
    cls = getattr(d3, field.typeName[:-4], None)
    return cls if cls is not None and hasattr(cls, '_classInfo') else None

def accessible_resources(field):
    for r in resourceManager.allResources(media_type(field)):
        try:
            # The generic Resource type also includes protected GUI/runtime objects.
            if str(r.path) and str(r.uid):
                yield r
        except pyerrors.Exception:
            continue

def resource_media_info(r):
    # Read native headers only. Never open/copy media or infer alpha/audio from
    # a filename. Missing properties remain unknown, especially internal objects.
    info = {}
    try:
        if isinstance(r, VideoClip):
            info['audio'] = bool(r.hasAudio)
            if r.video_file:
                info['codec'] = str(r.video_file.codec)
                info['alpha'] = bool(r.video_file.hasAlpha)
                enabled = [fragment for fragment in r.video_file.fragments if fragment.enabled and str(fragment.version) == str(r.enabledVersion)]
                info['version'] = str(r.enabledVersion)
                if len(enabled) == 1 and len(enabled[0].proxies) == 1:
                    info['filename'] = str(enabled[0].proxies[0].path).replace('\\\\', '/').rsplit('/', 1)[-1]
            if not info.get('codec', '').startswith('still_image:') and float(r.fps) > 0:
                info['fps'] = float(r.fps)
                duration = float(r.transportDuration.t)
                if not math.isnan(duration) and not math.isinf(duration):
                    info['duration'] = max(0, duration)
        elif isinstance(r, (AudioTrack, AudioFile)):
            info['audio'] = r.header.nChannels > 0 and r.header.nSamples > 0
            info['codec'] = str(r.header.codecName)
            if float(r.header.sampleRate) > 0:
                info['duration'] = float(r.header.nSamples) / float(r.header.sampleRate)
            audio_file = r.audioFile if isinstance(r, AudioTrack) else r
            if audio_file:
                info['filename'] = str(audio_file.path).replace('\\\\', '/').rsplit('/', 1)[-1]
    except pyerrors.Exception:
        pass
    return info

def resource_items(field):
    import os
    result = []
    for r in accessible_resources(field):
        path = str(r.path).replace('\\\\', '/')
        # Unnamed runtime render targets are not library entries.
        if not path or path.lower().startswith('internal/thumbnails/'):
            continue
        parts = [part for part in path.split('/') if part]
        visual = field.typeName in ('VideoClip::RP', 'DxTexture::RP')
        # Folder labels are project-relative, never drive letters or UNC hosts.
        # Keep the native path/UID untouched for resolving the resource itself.
        root = os.getcwd().replace(chr(92), '/').rstrip('/')
        if path.lower().startswith(root.lower() + '/'):
            parts = path[len(root)+1:].split('/')
        elif os.path.isabs(path) or (len(path) > 1 and path[1] == ':'):
            parts = ['External', parts[-1]]
        if parts[0].lower() == 'objects':
            folder = '/'.join(['PROJECT'] + parts[2:-1]) if field.typeName in ('VideoClip::RP', 'DxTexture::RP', 'AudioTrack::RP', 'AudioFile::RP') else '/'.join(['PROJECT'] + parts[1:-1])
        elif parts[0].lower() == 'internal':
            folder = '/'.join(['PROJECT'] + parts[1:-1])
        else:
            folder = '/'.join(['PROJECT'] + parts[:-1])
        item = {'uid': str(r.uid), 'name': r.description or parts[-1], 'path': path, 'folder': folder,
                'thumbnail': visual, 'resourceType': field.typeName[:-4]}
        item.update(resource_media_info(r))
        if item.get('filename'):
            item['name'] = item['filename']
        result.append(item)
    return sorted(result, key=lambda r: (r['folder'].lower(), r['name'].lower(), r['uid']))

def friendly_label(field):
    label = field.userName
    if not label:
        try:
            label = MetaField.get(field.containerClass, field.name).displayName
        except pyerrors.Exception:
            pass
    label = label or field.name
    label = re.sub(r'([a-z0-9])([A-Z])', r'\\1 \\2', label).replace('_', ' ')
    if '.' in field.name:
        component = field.name.rsplit('.', 1)[1]
        label = label.rsplit('.', 1)[0]
        label += ' ' + {'r':'Red','g':'Green','b':'Blue','a':'Alpha','x':'X','y':'Y','z':'Z','w':'W'}.get(component, component.title())
    label = ' '.join(label.split())
    return label[:1].upper() + label[1:]

def media_snapshot(layer, field):
    resource_type = media_type(field)
    if resource_type is None or not isinstance(field.sequence, ResourceSequence):
        raise ValueError('Selected field is not a supported media field')
    seq = field.sequence
    resource = (seq.key(0).r if field.disableSequencing else seq.evalResource(track.timeToBeat(edit_seconds()))) if seq.nKeys() else None
    resources = resource_items(field)
    return {'media': resources, 'selectedUid': str(resource.uid) if resource else '', 'field': field.name,
            'canAnimate': not field.notSequencable, 'sequenced': not field.disableSequencing}

${pythonParameterStep}
${pythonParameterFader}
def metadata(layer, field):
    result = {'name': field.name, 'uid': str(field.uid), 'label': friendly_label(field),
              'min': None, 'max': None, 'step': None, 'choices': [],
              'integer': field.typeName in ('int', 'uint', 'bool'),
              'canAnimate': not field.notSequencable}
    try:
        meta = MetaField.get(field.containerClass, field.name)
        if meta.max > meta.min:
            result['min'], result['max'] = float(meta.min), float(meta.max)
        if meta.step > 0:
            result['step'] = float(meta.step)
    except pyerrors.Exception:
        pass
    labels = list(field.options())
    result['discrete'] = bool(labels) or field.typeName == 'bool'
    if field.typeName == 'bool' and not labels:
        result['choices'] = [{'label': 'OFF', 'value': 0}, {'label': 'ON', 'value': 1}]
    if labels:
        values = None
        try:
            def find_info(ci, name, depth=0):
                if ci is None or depth > 6:
                    return None
                info = ci.field(name)
                if info is not None:
                    return info
                for candidate in ci.fields:
                    if name in (candidate.name, candidate.cppName, candidate.undecoratedName):
                        return candidate
                inherited = find_info(ci.base, name, depth + 1)
                if inherited is not None:
                    return inherited
                for candidate in ci.fields:
                    if hasattr(candidate.type, '_classInfo'):
                        nested = find_info(candidate.type._classInfo, name, depth + 1)
                        if nested is not None:
                            return nested
                return None
            info = find_info(layer.module._classInfo, field.name)
            for attr in info.attrs if info is not None else []:
                if isinstance(attr, FieldEditorAttribute) and len(attr.optionsValues) == len(labels):
                    values = list(attr.optionsValues)
        except pyerrors.Exception:
            pass
        if values is not None:
            result['choices'] = [{'label': label, 'value': float(value)} for label, value in zip(labels, values)]
        else:
            result['choiceError'] = 'Option values are not available from Designer'
    return result

def field_snapshot(layer, field, seconds):
    seq = field.sequence
    if isinstance(seq, ResourceSequence):
        resource = (seq.key(0).r if field.disableSequencing else seq.evalResource(track.timeToBeat(seconds))) if seq.nKeys() else None
        return {'name': field.name, 'label': friendly_label(field), 'resource': True,
                'value': 0, 'resourceName': (resource.description or str(resource.path).rsplit('/', 1)[-1]) if resource else 'NONE', 'choices': [],
                'canAnimate': not field.notSequencable, 'sequenced': not field.disableSequencing,
                'keys': [{'time': float(track.beatToTime(seq.t(i))), 'value': 0, 'interpolation': 0,
                          'resourceUid': str(seq.key(i).r.uid) if seq.key(i).r else ''} for i in range(seq.nKeys())]}
    result = metadata(layer, field)
    result.update({'value': float(field.eval(track.timeToBeat(seconds), 16)),
                   'sequenced': not field.disableSequencing,
                   'keys': [{'time': float(track.beatToTime(seq.t(i))), 'value': float(seq.key(i).v), 'interpolation': int(seq.key(i).interpolation)} for i in range(seq.nKeys())]})
    return result

def snapshot(only_layer=None):
    seconds = edit_seconds()
    beat = track.timeToBeat(seconds)
    layers = []
    skipped = []
    for layer in ([only_layer] if only_layer is not None else all_layers()):
        fields = []
        media_fields = []
        for field in layer.fields:
            seq = field.sequence
            if isinstance(seq, ResourceSequence) and media_type(field) is not None:
                resource_field = field_snapshot(layer, field, seconds)
                media_fields.append(resource_field)
                fields.append(resource_field)
            if not isinstance(seq, FloatSequence) or seq.nKeys() == 0:
                continue
            value = float(field.eval(beat, 16))
            if math.isnan(value) or math.isinf(value):
                continue
            keys = [{'time': float(track.beatToTime(seq.t(i))), 'value': float(seq.key(i).v)} for i in range(seq.nKeys())]
            fields.append(field_snapshot(layer, field, seconds))
        layers.append({'uid': str(layer.uid), 'name': layer.name, 'moduleType': layer.module._classInfo.name,
                       'start': float(track.beatToTime(layer.tStart)), 'end': float(track.beatToTime(layer.tEnd)), 'fields': fields, 'mediaFields': media_fields,
                       'controlOrder': [f.name for f in layer.fields if any(x['name'] == f.name for x in fields + media_fields)]})
    result = {'trackUid': str(track.uid), 'transportUid': str(manager.uid), 'trackName': str(track.path), 'editTime':seconds, 'time': float(track.beatToTime(manager.player.tCurrent)), 'length': float(track.lengthInSec), 'layers': layers,
              'selectedLayerUids': [str(l.uid) for l in guisystem.selectedLayers if isinstance(l, Layer)]}
    result.update(clock_info())
    return result

${thumbnailScript}
if p['command'] == 'refresh':
    return snapshot()
def resolve_marker_time(label, near):
    if not re.match(r'^\\d{2}:\\d{2}:\\d{2}:\\d{2}$', label):
        raise ValueError('Invalid timecode')
    requested = Timecode.fromStringWithFps(label, manager.smpteClockType(), manager.customFps())
    # Each TC marker starts a new mapping. Verify a candidate against Designer's
    # own display so invalid drop-frame labels and discontinuities never seek.
    starts = [0.0]
    for i in range(track.cues.n()):
        cue = track.cues.getV(i)
        if any(tag.type == Tag.TC for tag in cue.getTags()):
            starts.append(float(track.beatToTime(track.cues.getT(i))))
    starts = sorted(set(starts))
    matches = []
    for i, start in enumerate(starts):
        end = starts[i+1] if i+1 < len(starts) else float(track.lengthInSec)
        origin = manager.beatToTimecode(track.timeToBeat(start))
        candidate = round((start + requested.t - origin.t) * fps()) / fps()
        if candidate < start or candidate > end or (i+1 < len(starts) and candidate >= end):
            continue
        actual = str(manager.beatToTimecode(track.timeToBeat(candidate)))
        if re.sub(r'[.;]', ':', actual) == label:
            matches.append(candidate)
    return {'time': min(matches, key=lambda value: abs(value-near)) if matches else None}
if p['command'] == 'resolve_timecode':
    if 'time' in p:
        seconds = float(p['time'])
        if math.isnan(seconds) or math.isinf(seconds) or seconds < 0 or seconds > float(track.lengthInSec):
            raise ValueError('Time is outside the track')
        return {'label': re.sub(r'[.;]', ':', str(manager.beatToTimecode(track.timeToBeat(seconds))))}
    return resolve_marker_time(p.get('label', ''), edit_seconds())
if p['command'] == 'section_edit':
    operation = p.get('operation')
    if operation not in ('cut', 'merge'):
        raise ValueError('Invalid section operation')
    if track.locked:
        raise ValueError('Track is locked')
    seconds = float(p['time'])
    if math.isnan(seconds) or math.isinf(seconds) or seconds < 0 or seconds > float(track.lengthInSec):
        raise ValueError('Section time is outside the track')
    beat = track.timeToBeat(seconds)
    if operation == 'cut':
        if seconds <= 0 or seconds >= float(track.lengthInSec):
            return {'changed': False}
        track.splitSectionAtBeat(beat)
    else:
        if track.beatToSection(beat) <= 0:
            return {'changed': False}
        track.mergeSectionAtBeat(beat)
    return {'changed': True}
if p['command'] == 'live_state':
    seconds = float(track.beatToTime(manager.player.tCurrent))
    layers = all_layers()
    result = {'timeline': {'time': seconds, 'playing': bool(manager.player.playing), 'transportUid': str(manager.uid), 'trackUid': str(track.uid),
              'selectedLayerUids': [str(l.uid) for l in guisystem.selectedLayers if isinstance(l, Layer)],
              'layers': [{'uid': str(l.uid), 'start': float(track.beatToTime(l.tStart)), 'end': float(track.beatToTime(l.tEnd))} for l in layers]},
              'clock': clock_info()}
    target = p.get('fieldTarget')
    if target:
        chosen = next((l for l in layers if str(l.uid) == target['layerUid']), None)
        f = chosen.findSequence(target['name']) if chosen else None
        if f is not None and isinstance(f.sequence, (FloatSequence, ResourceSequence)):
            result['fieldValue'] = field_snapshot(chosen, f, edit_seconds())
    return result
if p['command'] == 'playback_state':
    return {'playing': bool(manager.player.playing)}
if p['command'] in ('seek', 'nudge_time'):
    seconds = float(p['time'])
    if p.get('frameSnap') and not math.isnan(seconds) and not math.isinf(seconds):
        seconds = max(0, min(float(track.lengthInSec), round(seconds * fps()) / fps()))
    if p['command'] == 'nudge_time':
        current = float(p['cursor']) if p.get('cursor') is not None else edit_seconds()
        if p.get('beats'):
            seconds = float(track.beatToTime(track.timeToBeat(current) + float(p['delta'])))
        elif p.get('frames'):
            seconds = (round(current * fps()) + float(p['delta'])) / fps()
        else:
            seconds = current + float(p['delta'])
        seconds = max(0, min(float(track.lengthInSec), seconds))
    if seconds < 0 or math.isnan(seconds) or math.isinf(seconds):
        raise ValueError('Invalid time')
    if not p.get('keepPlayhead'): manager.addCommand(TransportCommand.makeJumpToTime(state, manager, seconds))
    result = {'time': seconds}
    result.update(clock_info())
    return result

matches = [layer for layer in all_layers() if str(layer.uid) == p['layerUid']]
if len(matches) != 1:
    raise ValueError('Layer missing. Refresh before editing.')
layer = matches[0]
def layer_edit_beat(seconds):
    # Native seconds/beat round trips can land just outside an exact IN/OUT
    # (for example at 123 BPM). Preserve the boundary without accepting a frame
    # outside it or quantizing legitimate sub-frame key positions.
    if abs(seconds-float(track.beatToTime(layer.tStart))) <= 0.0000001:
        return layer.tStart
    if abs(seconds-float(track.beatToTime(layer.tEnd))) <= 0.0000001:
        return layer.tEnd
    return track.timeToBeat(seconds)
if p['command'] in ('key_clear_list', 'keys_clear', 'parameter_default', 'layer_default'):
    reset_constant = p['command'] == 'parameter_default'
    if reset_constant:
        p['fields'] = [p['field']]
        p['resetDefault'] = True
        p['confirmed'] = True
    # Discover sequences directly, including resource fields omitted by numeric controls.
    supported = [f for f in layer.fields if isinstance(f.sequence, (FloatSequence, ResourceSequence))]
    if p['command'] == 'layer_default':
        # Resolve all numeric/enum and resource fields in Designer, including constants.
        # Keep the caller's explicit confirmation and the layer identity checks above.
        p['fields'] = [f.name for f in supported]
        p['resetDefault'] = True
    if p['command'] == 'key_clear_list':
        return {'items': [{'name': f.name, 'label': friendly_label(f),
                          'kind': 'RESOURCE' if isinstance(f.sequence, ResourceSequence) else 'VALUE',
                          'keyCount': f.sequence.nKeys()}
                         for f in supported if f.sequence.nKeys() > 1 or (not f.disableSequencing and f.sequence.nKeys() > 0)]}
    # Some layer types expose only unsupported string settings. A confirmed
    # whole-layer reset then has nothing to change; it is not an API failure.
    if p['command'] == 'layer_default' and p.get('confirmed') is True and not supported:
        return {'cleared': []}
    if p.get('confirmed') is not True or not p.get('fields'):
        raise ValueError('Select parameters and confirm before clearing')
    seconds = edit_seconds()
    beat = layer_edit_beat(seconds)
    if beat < layer.tStart or beat > layer.tEnd:
        raise ValueError('Selected layer is not active at the playhead')
    if layer.locked:
        raise ValueError('Layer is locked in Designer')
    edits = []
    # Resolve and evaluate every target before the first write; never partially
    # clear a selection because a later parameter disappeared or changed type.
    for name in p['fields']:
        found = [f for f in supported if f.name == name]
        if len(found) != 1 or (found[0].sequence.nKeys() == 0 and not p.get('resetDefault')):
            raise ValueError('Parameter animation changed; reopen CLEAR KEYS')
        f = found[0]
        if reset_constant and (not f.disableSequencing or f.sequence.nKeys() > 1):
            raise ValueError('Parameter is now animated; use DELETE ALL + DEFAULT and confirm')
        if not reset_constant and f.disableSequencing and f.sequence.nKeys() == 1 and not p.get('resetDefault'):
            raise ValueError('Parameter animation changed; reopen CLEAR KEYS')
        resource = isinstance(f.sequence, ResourceSequence)
        # Read Designer's native default, including resource references and null;
        # never guess defaults from ranges, the first key or the current value.
        if p.get('resetDefault') is True:
            value = f.defaultValue if resource else float(f.defaultValue)
        elif not resource:
            value = float(f.eval(beat, 16))
        elif f.disableSequencing:
            value = f.sequence.key(0).r
        else:
            value = f.sequence.evalResource(beat)
        if not resource and (math.isnan(value) or math.isinf(value)):
            raise ValueError('Invalid current parameter value')
        edits.append((f, value))
    for field, value in edits:
        reset_sequence_to_constant(field, value, layer.tStart)
    return {'cleared': list(p['fields'])}
if p['command'] == 'layer_edit':
    start = float(track.beatToTime(layer.tStart))
    end = float(track.beatToTime(layer.tEnd))
    if getattr(layer, 'anchored', False) or layer.locked:
        raise ValueError('Layer is anchored or locked in Designer')
    if abs(start - p['expectedStart']) > 0.00001 or abs(end - p['expectedEnd']) > 0.00001:
        raise ValueError('Layer timing changed in Designer; refresh before editing')
    mode = p['mode']
    if mode not in ('move', 'in', 'out', 'fit'):
        raise ValueError('Invalid layer edit mode')
    limit, minimum = float(track.lengthInSec), 1.0 / fps()
    if limit < minimum:
        raise ValueError('Track is shorter than one frame')
    if mode == 'fit':
        resource_sequence = layer.module.defaultResourceSequence()
        if not resource_sequence:
            return {'layer': next(l for l in snapshot(layer)['layers'] if l['uid'] == p['layerUid']), 'time': edit_seconds()}
        content_field = layer.findSequence(resource_sequence)
        if content_field is None or not isinstance(content_field.sequence, ResourceSequence) or content_field.sequence.nKeys() == 0:
            return {'layerUid': str(layer.uid)} if p.get('operation') == 'fit' else {'layer': next(l for l in snapshot(layer)['layers'] if l['uid'] == p['layerUid']), 'time': edit_seconds()}
        content_resource = content_field.sequence.key(0).r if content_field.disableSequencing else content_field.sequence.evalResource(track.timeToBeat(edit_seconds()))
        if content_resource is None:
            return {'layer': next(l for l in snapshot(layer)['layers'] if l['uid'] == p['layerUid']), 'time': edit_seconds()}
        content_duration = float(layer.module.resourceDuration(resource_sequence))
        if content_duration <= 0 or math.isnan(content_duration) or math.isinf(content_duration):
            return {'layer': next(l for l in snapshot(layer)['layers'] if l['uid'] == p['layerUid']), 'time': edit_seconds()}
        target = float(track.beatToTime(layer.tStart + content_duration))
    else:
        origin = end if mode == 'out' else start
        target = float(track.beatToTime(track.timeToBeat(origin) + float(p['delta']))) if p.get('beats') else ((round(origin * fps()) + float(p['delta'])) / fps() if p.get('frames') else origin + float(p['delta']))
    if math.isnan(target) or math.isinf(target):
        raise ValueError('Invalid layer time')
    delta = 0
    if mode == 'move':
        length = min(limit, max(minimum, end - start))
        new_start = max(0, min(limit - length, target))
        new_end = new_start + length
        delta = new_start - start
    elif mode == 'in':
        new_end = max(minimum, min(limit, end))
        new_start = max(0, min(new_end - minimum, target))
    else:
        new_start = max(0, min(limit - minimum, start))
        new_end = max(new_start + minimum, min(limit, target))
    old_keys = [(f, [(float(track.beatToTime(f.sequence.t(i))), float(f.sequence.key(i).localT)) for i in range(f.sequence.nKeys())]) for f in layer.fields]
    markDirty(layer)
    layer.setExtents(track.timeToBeat(max(0, new_start)), track.timeToBeat(new_end))
    for f, keys in old_keys:
        seq = f.sequence
        markDirty(seq)
        for i, (key_seconds, local_t) in enumerate(keys):
            # setExtents may adjust the sequence offset. Derive its current offset
            # instead of assuming that key.localT is an absolute track beat.
            offset = seq.t(i) - seq.key(i).localT
            desired = track.timeToBeat(key_seconds + (delta if mode == 'move' else 0))
            seq.key(i).localT = desired - offset
        f.notifyEdit()
    cursor = float(p['cursor']) if p.get('cursor') is not None else edit_seconds()
    playhead = max(new_start, min(new_end, cursor + (delta if mode == 'move' else 0)))
    if abs(playhead - float(track.beatToTime(manager.player.tCurrent))) > 0.000001:
        if not p.get('keepPlayhead'): manager.addCommand(TransportCommand.makeJumpToTime(state, manager, playhead))
    result = snapshot(layer)
    updated = next(l for l in result['layers'] if l['uid'] == p['layerUid'])
    return {'layer': updated, 'time': playhead}
if (p.get('live') or p.get('editTime') is not None) and p['command'] in ('adjust_value', 'key_set', 'key_delete', 'key_clear', 'constant_set', 'key_type'):
    now_beat = layer_edit_beat(edit_seconds())
    if now_beat < layer.tStart or now_beat > layer.tEnd:
        raise ValueError('Selected layer is not active at the playhead')
field = layer.findSequence(p['field'])
if p['command'] in ('media_list', 'media_set', 'media_key_set'):
    if field is None or media_type(field) is None:
        raise ValueError('Media field is missing; refresh the layer')
    if p['command'] in ('media_set', 'media_key_set'):
        beat = layer_edit_beat(edit_seconds())
        if p.get('targetTime') is not None and p['command'] == 'media_key_set':
            target_time = float(p['targetTime'])
            if math.isnan(target_time) or math.isinf(target_time):
                raise ValueError('Invalid resource key time')
            beat = layer_edit_beat(target_time)
        if beat < layer.tStart or beat > layer.tEnd:
            raise ValueError('Layer is not active at the playhead')
        seq = field.sequence
        if not isinstance(seq, ResourceSequence):
            raise ValueError('Media field is not a ResourceSequence')
        if layer.locked:
            raise ValueError('Layer is locked')
        if p.get('expectedKey'):
            expected = p['expectedKey']
            current = next((k for k in field_snapshot(layer, field, float(track.beatToTime(beat)))['keys'] if abs(k['time'] - expected['time']) < 0.00001), None)
            if current != expected:
                raise ValueError('Resource keyframe changed in Designer')
            beat = track.timeToBeat(expected['time'])
        resource = None
        if p.get('mediaUid') is not None:
            matches = [r for r in accessible_resources(field) if str(r.uid) == p['mediaUid']]
            if len(matches) != 1:
                raise ValueError('Media is no longer available')
            resource = matches[0]
        if p['command'] == 'media_key_set':
            if field.notSequencable:
                raise ValueError('This media field cannot be keyframed')
            if p.get('mediaUid') is None:
                resource = seq.key(0).r if field.disableSequencing and seq.nKeys() else seq.evalResource(beat)
            markDirty(field)
            markDirty(seq)
            if field.disableSequencing and seq.nKeys():
                # Retain the old constant from IN until the new resource key.
                seq.key(0).localT = layer.tStart - (seq.t(0) - seq.key(0).localT)
            field.disableSequencing = False
            seq.setResource(beat, resource)
        else:
            if p.get('mediaUid') is None:
                raise ValueError('Media is no longer available')
            if not seq.nKeys():
                raise ValueError('Media sequence has no initial key')
            markDirty(seq)
            indices = [i for i in range(seq.nKeys()) if seq.t(i) <= beat + Key.tEpsilon]
            index = 0 if field.disableSequencing or not indices else indices[-1]
            seq.key(index).r = resource
        field.notifyEdit()
    return media_snapshot(layer, field)
if field is None or not isinstance(field.sequence, (FloatSequence, ResourceSequence)):
    raise ValueError('Parameter is not an editable sequence')
seq = field.sequence
is_resource = isinstance(seq, ResourceSequence)
if seq.nKeys() == 0:
    raise ValueError('Parameter has no keys')
seconds = float(track.beatToTime(manager.player.tCurrent)) if p.get('live') else float(p['time'])
if seconds < 0 or math.isnan(seconds) or math.isinf(seconds):
    raise ValueError('Invalid time')
beat = layer_edit_beat(seconds)
command = p['command']
if command not in ('read_field', 'jump_key', 'select_key') and layer.locked:
    raise ValueError('Layer is locked in Designer')
if is_resource and command not in ('read_field', 'jump_key', 'select_key', 'key_move', 'key_delete'):
    raise ValueError('Use the resource picker to change this parameter')
if p.get('expectedKey') and command in ('key_delete', 'adjust_value'):
    expected = p['expectedKey']
    current = next((k for k in field_snapshot(layer, field, seconds)['keys'] if abs(k['time'] - expected['time']) < 0.00001), None)
    if current != expected:
        raise ValueError('Selected keyframe changed in Designer')
if command == 'read_field':
    return {'field': field_snapshot(layer, field, seconds), 'time': seconds}
if command == 'jump_key':
    start, end = float(track.beatToTime(layer.tStart)), float(track.beatToTime(layer.tEnd))
    # OUT ends the last displayed frame; it is still a valid editing boundary.
    # A disabled sequence still stores its constant in a key, possibly mid-layer.
    # That carrier is not an animation key and must not attract NEXT/PREV.
    times = [] if field.disableSequencing else sorted(float(track.beatToTime(seq.t(i))) for i in range(seq.nKeys()) if layer.tStart <= seq.t(i) <= layer.tEnd)
    cursor = p.get('navigationTime')
    if cursor is not None and not any(abs(t - cursor) < 0.00001 for t in times + [start, end]):
        cursor = None
    cursor = seconds if cursor is None else float(cursor)
    candidates = [t for t in times if t < cursor - 0.00001] if p['direction'] < 0 else [t for t in times if t > cursor + 0.00001]
    target = (max(candidates) if p['direction'] < 0 else min(candidates)) if candidates else (start if p['direction'] < 0 else end)
    seconds = max(start, min(end, target))
    if not p.get('keepPlayhead'): manager.addCommand(TransportCommand.makeJumpToTime(state, manager, seconds))
    key_time = next((t for t in times if abs(t - seconds) < 0.00001), None)
    return {'field': field_snapshot(layer, field, seconds), 'time': seconds, 'keyTime': key_time, 'atBoundary': key_time is None}
if command in ('select_key', 'key_type', 'key_move'):
    if command == 'key_move' and field.disableSequencing:
        raise ValueError('A constant parameter has no keyframe to move')
    source = float(p.get('sourceTime', seconds))
    if command == 'select_key':
        key_times = [] if field.disableSequencing else [float(track.beatToTime(seq.t(i))) for i in range(seq.nKeys()) if layer.tStart <= seq.t(i) <= layer.tEnd]
        if not key_times:
            return {'selectedKey': None, 'field': field_snapshot(layer, field, seconds), 'time': seconds}
        if p.get('sourceTime') is not None:
            source = float(p['sourceTime'])
            if not any(abs(t - source) < 0.000001 for t in key_times):
                raise ValueError('Clicked keyframe changed; select it again')
        else:
            source = min(key_times, key=lambda t: (round(abs(t - seconds), 9), -t))
    indices = [i for i in range(seq.nKeys()) if abs(float(track.beatToTime(seq.t(i))) - source) < 0.00001]
    if len(indices) != 1:
        raise ValueError('Move to an exact keyframe with PREV / NEXT KEY first')
    index = indices[0]
    key = seq.key(index)
    selected = next(k for k in field_snapshot(layer, field, seconds)['keys'] if abs(k['time'] - source) < 0.00001)
    if command == 'select_key':
        seconds = max(0, min(float(track.lengthInSec), source))
        if not p.get('keepPlayhead'): manager.addCommand(TransportCommand.makeJumpToTime(state, manager, seconds))
        return {'selectedKey': selected, 'field': field_snapshot(layer, field, seconds), 'time': seconds}
    if p.get('expectedKey') and p['expectedKey'] != selected:
        raise ValueError('Selected keyframe changed in Designer; select it again')
    if command == 'key_type':
        types = [Key.select, Key.linear, Key.cubic]
        next_type = types[(types.index(key.interpolation) + 1) % len(types)]
        if 'type' in p:
            if p['type'] not in (0, 1, 2):
                raise ValueError('Invalid keyframe type')
            next_type = types[p['type']]
        markDirty(seq)
        key.interpolation = next_type
    else:
        target = float(track.beatToTime(track.timeToBeat(source) + float(p['delta']))) if p.get('beats') else (((round(source * fps()) + float(p['delta'])) / fps()) if p.get('frames') else source + float(p['delta']))
        # Read current Designer bounds on every detent, including GUI trims
        # made since the key was selected. Clamp again after beat conversion so
        # floating-point conversion cannot put a key beyond either layer edge.
        start = max(0, float(track.beatToTime(layer.tStart)))
        end = min(float(track.lengthInSec), float(track.beatToTime(layer.tEnd)))
        if end < start:
            raise ValueError('Layer has no valid range inside the track')
        target = max(start, min(end, target))
        # Batched encoder turns retain each intermediate collision/clamp rule.
        # A key must not skip over a destination blocked on an earlier detent.
        count = max(1,min(64,int(p.get('detents') or 1)))
        if count>1:
            current = source
            for unused in range(count):
                candidate = float(track.beatToTime(track.timeToBeat(current)+float(p['delta']))) if p.get('beats') else ((round(current*fps())+float(p['delta']))/fps() if p.get('frames') else current+float(p['delta']))
                candidate = max(start,min(end,candidate))
                candidate_beat = max(layer.tStart,min(layer.tEnd,track.timeToBeat(candidate)))
                if any(i!=index and abs(seq.t(i)-candidate_beat)<=Key.tEpsilon for i in range(seq.nKeys())): break
                current=candidate
            target=current
        target_beat = max(layer.tStart, min(layer.tEnd, track.timeToBeat(target)))
        if any(i != index and abs(seq.t(i) - target_beat) <= Key.tEpsilon for i in range(seq.nKeys())):
            return {'field': field_snapshot(layer, field, source), 'time': source}
        if abs(target_beat - seq.t(index)) > Key.tEpsilon:
            markDirty(seq)
            if is_resource:
                seq.setResource(target_beat, key.r)
            else:
                seq.setFloat(target_beat, key.v)
            target_index = next(i for i in range(seq.nKeys()) if abs(seq.t(i) - target_beat) <= Key.tEpsilon)
            if not is_resource:
                seq.key(target_index).interpolation = selected['interpolation']
            source_index = next(i for i in range(seq.nKeys()) if abs(float(track.beatToTime(seq.t(i))) - source) < 0.00001)
            seq.remove(source_index, 1)
        seconds = target
        if not p.get('keepPlayhead'): manager.addCommand(TransportCommand.makeJumpToTime(state, manager, seconds))
    field.notifyEdit()
    return {'field': field_snapshot(layer, field, seconds), 'time': seconds}
if command == 'adjust_value':
    meta = metadata(layer, field)
    if meta.get('choiceError'):
        raise ValueError(meta['choiceError'])
    if field.disableSequencing or seq.nKeys() == 1:
        edit_index = 0
    else:
        selected_time = p.get('keyTime')
        indices = [i for i in range(seq.nKeys()) if selected_time is not None and abs(float(track.beatToTime(seq.t(i))) - selected_time) < 0.00001]
        if len(indices) != 1:
            raise ValueError('Selected keyframe is missing; select it with PREV / NEXT KEY')
        edit_index = indices[0]
    value = float(seq.key(edit_index).v)
    choices = meta['choices']
    if 'faderPercent' in p:
        value = parameter_fader_value(meta, p['faderPercent'], p.get('expectedRange'))
    elif choices:
        values = [c['value'] for c in choices]
        if value not in values:
            raise ValueError('Current option is unknown; refresh before changing it')
        value = values[max(0, min(len(values)-1, values.index(value) + int(p['direction'])))]
    else:
        step = parameter_step(meta, p)
        value += step * float(p['direction'])
        if meta['min'] is not None:
            value = max(meta['min'], value)
        if meta['max'] is not None:
            value = min(meta['max'], value)
        if meta['integer']:
            value = round(value)
    markDirty(seq)
    seq.key(edit_index).v = value
    field.notifyEdit()
    return {'field': field_snapshot(layer, field, seconds), 'time': seconds}
if command in ('key_set', 'constant_set'):
    value = float(field.eval(beat, 16)) if command == 'key_set' and p.get('evaluateCurrent') else float(p['value'])
    if math.isnan(value) or math.isinf(value):
        raise ValueError('Invalid value')
    if command == 'constant_set':
        if not field.disableSequencing:
            raise ValueError('Animated parameter: use Save keyframe instead')
        markDirty(seq)
        seq.key(0).v = value
    else:
        if field.notSequencable:
            raise ValueError('This parameter cannot be keyframed')
        if beat < layer.tStart or beat > layer.tEnd:
            raise ValueError('Keyframe time is outside the layer')
        markDirty(field)
        markDirty(seq)
        # New numeric keys use SMOOTH explicitly instead of inheriting the
        # native sequence default. Rewriting an existing key keeps its type.
        interpolation = next((seq.key(i).interpolation for i in range(seq.nKeys())
                              if abs(track.beatToTime(seq.t(i)) - seconds) < 0.00001), Key.cubic)
        field.disableSequencing = False
        seq.setFloat(beat, value)
        for i in range(seq.nKeys()):
            if abs(track.beatToTime(seq.t(i)) - seconds) < 0.00001:
                seq.key(i).interpolation = interpolation
                break
elif command == 'key_clear':
    if p.get('confirmed') is not True:
        raise ValueError('Clear all keyframes requires confirmation')
    # Preserve the evaluated value at the playhead as Designer's single constant.
    value = field_snapshot(layer, field, seconds)['value']
    markDirty(field)
    markDirty(seq)
    if seq.nKeys() > 1:
        seq.remove(1, seq.nKeys() - 1)
    seq.key(0).localT = layer.tStart - (seq.t(0) - seq.key(0).localT)
    seq.key(0).v = value
    field.disableSequencing = True
elif command == 'key_delete':
    selected_time = float(p.get('keyTime', seconds))
    indices = [i for i in range(seq.nKeys()) if abs(track.beatToTime(seq.t(i)) - selected_time) < 0.00001]
    if len(indices) != 1:
        raise ValueError('Select an exact keyframe using Previous/Next key')
    if seq.nKeys() <= 1:
        # Delete animation, not its current value. Designer needs one carrier
        # key for a constant, including resources; do not restore the default.
        value = seq.evalResource(beat) if is_resource else field_snapshot(layer, field, seconds)['value']
        reset_sequence_to_constant(field, value, layer.tStart)
    else:
        markDirty(seq)
        seq.remove(indices[0], 1)
else:
    raise ValueError('Unknown command')
field.notifyEdit()
result = field_snapshot(layer, field, seconds)
return {'keys': result['keys'], 'sequenced': result['sequenced'], 'field': result, 'time': seconds}
`
  // Let Designer resolve TC markers for every displayed absolute position.
  // Returning labels avoids guessing offsets across multiple TC-marker regions.
  return `def companion_command():
${body
  .split('\n')
  .map((line) => '    ' + line)
  .join('\n')}
result = companion_command()
if isinstance(result, dict) and not result.get('contextChanged'):
    positions = set()
    def collect_positions(value):
        if isinstance(value, dict):
            for name, item in value.items():
                if name in ('time', 'start', 'end', 'editTime') and isinstance(item, (int, long, float)):
                    positions.add(float(item))
                else:
                    collect_positions(item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                collect_positions(item)
    collect_positions(result)
    tm = guisystem.currentTransportManager
    tr = tm.track
    if tr is not None:
        positions.add(float(tm.track.beatToTime(tm.player.tCurrent)))
        for layer in tr.getLeafLayers(Module):
            start, end = float(tr.beatToTime(layer.tStart)), float(tr.beatToTime(layer.tEnd))
            positions.update((start, end, (start + end) / 2.0))
        result['timecodeSamples'] = [{'seconds': seconds, 'label': str(tm.beatToTimecode(tr.timeToBeat(seconds)))} for seconds in sorted(positions)]
return result
`
}

module.exports = { makeScript }
