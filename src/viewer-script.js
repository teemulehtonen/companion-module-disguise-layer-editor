'use strict'

// Inserted inside makeScript's existing read-only helper scope. Never mutate
// native state here: the browser is an observer, not another control surface.
module.exports = `
if p['command'] == 'viewer_snapshot':
    seconds = float(track.beatToTime(manager.player.tCurrent))
    start = max(0.0, min(float(track.lengthInSec), float(p.get('viewStart', 0))))
    end = max(start, min(float(track.lengthInSec), float(p.get('viewEnd', track.lengthInSec))))
    result = {'trackUid': str(track.uid), 'trackName': str(track.path).replace('\\\\', '/').rsplit('/', 1)[-1],
              'length': float(track.lengthInSec), 'time': seconds, 'fps': fps(),
              'timecode': str(manager.beatToTimecode(track.timeToBeat(seconds))), 'layers': [], 'warnings': [], 'ticks': []}
    result['sections'] = []
    try:
        for index in range(track.nSections()):
            section = track.sectionInfo(index)
            result['sections'].append({'index': index + 1,
                'start': float(track.beatToTime(section.tStart)),
                'end': float(track.beatToTime(section.tEnd))})
    except pyerrors.Exception:
        result['warnings'].append('Section information unavailable')
    def viewer_resource(r, visual):
        if not r: return None
        has_audio = False
        try:
            has_audio = (isinstance(r, (AudioTrack, AudioFile)) and r.header.nChannels > 0 and r.header.nSamples > 0) or (isinstance(r, VideoClip) and bool(r.hasAudio))
        except pyerrors.Exception:
            pass
        info = resource_media_info(r)
        return {'duration': info.get('duration'), 'fps': info.get('fps'), 'version': info.get('version'), 'uid': str(r.uid), 'name': info.get('filename') or r.description or str(r.path).replace('\\\\', '/').rsplit('/', 1)[-1], 'thumbnail': visual,
                'audio': has_audio}
    result['quantized'] = bool(track.quant)
    result['beat'] = float(track.timeToBeat(seconds))
    result['trackAudio'] = viewer_resource(track.audioTrack(track.timeToBeat(seconds)), False)
    result['arrows'] = []
    ordered_layers = []
    def visit_layers(container, parent=None, depth=0):
        if depth > 32: return
        for arrow in container.arrows:
            result['arrows'].append({'source': str(arrow.srcUid), 'destination': str(arrow.destUid),
                                     'time': float(track.beatToTime(arrow.t))})
        for item in container.layers:
            ordered_layers.append((item, parent, depth))
            if isinstance(item, GroupLayer): visit_layers(item, str(item.uid), depth+1)
    visit_layers(track)
    for layer, parent, depth in ordered_layers:
        focused = str(layer.uid) == p.get('focusUid') or str(layer.uid) in p.get('expanded', [])
        if isinstance(layer, GroupLayer):
            result['layers'].append({'uid': str(layer.uid), 'name': layer.name, 'moduleType': 'Group',
                'group': True, 'parent': parent, 'depth': depth, 'expanded': bool(layer.expanded),
                'start': float(track.beatToTime(layer.tStart)), 'end': float(track.beatToTime(layer.tEnd)),
                'fields': [], 'resources': [], 'controlOrder': []})
            continue
        row = {'uid': str(layer.uid), 'name': layer.name, 'moduleType': layer.module._classInfo.name,
               'parent': parent, 'depth': depth,
               'start': float(track.beatToTime(layer.tStart)), 'end': float(track.beatToTime(layer.tEnd)), 'fields': [], 'resources': []}
        row['playback'] = {}
        for field in layer.fields:
            seq = field.sequence
            if field.name in ('mode', 'at end point') and isinstance(seq, FloatSequence):
                try:
                    value = float(field.eval(track.timeToBeat(seconds), 16))
                    choices = metadata(layer, field).get('choices', [])
                    label = next((c['label'] for c in choices if c['value'] == value), None)
                    if label: row['playback']['mode' if field.name == 'mode' else 'endpoint'] = label
                except pyerrors.Exception:
                    pass
            try:
                if isinstance(seq, ResourceSequence):
                    visual = field.typeName in ('VideoClip::RP', 'DxTexture::RP')
                    current = (seq.key(0).r if field.disableSequencing else seq.evalResource(track.timeToBeat(seconds))) if seq.nKeys() else None
                    row['resources'].append({'name': field.name, 'label': friendly_label(field), 'sequenced': not field.disableSequencing,
                        'current': viewer_resource(current, visual), 'keys': [{'time': float(track.beatToTime(seq.t(i))),
                        'resource': viewer_resource(seq.key(i).r, visual)} for i in range(seq.nKeys())]})
                elif isinstance(seq, FloatSequence):
                    f = {'name': field.name, 'label': friendly_label(field), 'sequenced': not field.disableSequencing,
                         'keys': [{'time': float(track.beatToTime(seq.t(i))), 'value': float(seq.key(i).v),
                                   'interpolation': int(seq.key(i).interpolation)} for i in range(seq.nKeys())]}
                    if focused:
                        f.update(metadata(layer, field))
                        f['value'] = float(field.eval(track.timeToBeat(seconds), 16))
                        lo = max(start, row['start'])
                        hi = min(end, row['end'])
                        f['samples'] = []
                        if hi >= lo:
                            # Fixed bound on sampling cost; include key times as well as uniform samples.
                            times = set([lo + (hi-lo)*i/95.0 for i in range(96)])
                            times.update(k['time'] for k in f['keys'] if lo <= k['time'] <= hi)
                            # Preserve HOLD discontinuities instead of drawing a
                            # diagonal ramp through a discrete value change.
                            times.update(k['time']-0.000001 for k in f['keys'] if lo < k['time'] <= hi)
                            for at in sorted(times):
                                value = float(field.eval(track.timeToBeat(at), 16))
                                if not math.isnan(value) and not math.isinf(value):
                                    f['samples'].append({'time': at, 'value': value})
                    row['fields'].append(f)
                elif focused:
                    row['fields'].append({'name': field.name, 'label': friendly_label(field), 'unsupported': True, 'keys': []})
            except pyerrors.Exception:
                row['fields'].append({'name': field.name, 'label': friendly_label(field), 'unsupported': True, 'keys': []})
                result['warnings'].append('Unavailable parameter: '+layer.name+' / '+field.name)
        row['controlOrder'] = [f.name for f in layer.fields]
        result['layers'].append(row)
    result['grid'] = []
    width = max(320, min(3840, float(p.get('width', 1200))))
    if result['quantized']:
        b0, b1 = track.timeToBeat(start), track.timeToBeat(end)
        choices = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
        step = next((s for s in choices if s*width/max(0.001,b1-b0) >= 18), choices[-1])
        major = max(1, int(math.ceil(110.0/(step*width/max(0.001,b1-b0)))))
        first = int(math.ceil(b0/step))
        for i in range(first, min(first+1000, int(math.floor(b1/step))+1)):
            at = float(track.beatToTime(i*step))
            result['grid'].append({'time': at, 'beat': i*step, 'major': i % major == 0,
                                  'label': str(manager.beatToTimecode(track.timeToBeat(at)))})
    else:
        choices = sorted(set([1.0/fps(), 2.0/fps(), 5.0/fps(), 10.0/fps(), 1,2,5,10,15,30,60,120,300,600,1800,3600]))
        step = next((s for s in choices if s*width/max(0.001,end-start) >= 18), choices[-1])
        major = max(1,int(math.ceil(110.0/(step*width/max(0.001,end-start)))))
        first = int(math.ceil(start/step))
        for i in range(first,min(first+1000,int(math.floor(end/step))+1)):
            at = i*step
            result['grid'].append({'time': at,'major': i % major == 0,
                                  'label': str(manager.beatToTimecode(track.timeToBeat(at)))})
    result['beatGrid'] = []
    if result['trackAudio']:
        b0, b1 = track.timeToBeat(start), track.timeToBeat(end)
        steps = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
        step = next((s for s in steps if s*width/max(0.001,b1-b0) >= 24), steps[-1])
        major = max(1, int(math.ceil(72.0/(step*width/max(0.001,b1-b0)))))
        first = int(math.ceil(b0/step))
        for i in range(first, min(first+1000, int(math.floor(b1/step))+1)):
            result['beatGrid'].append({'time': float(track.beatToTime(i*step)), 'beat': i*step, 'major': i % major == 0})
    for i in range(7):
        at = start + (end-start)*i/6.0
        result['ticks'].append({'time': at, 'label': str(manager.beatToTimecode(track.timeToBeat(at)))})
    return result
`
