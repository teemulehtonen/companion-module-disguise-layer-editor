'use strict'

// Read-only native mapping shared by drawing and immediate pre-write snap checks.
module.exports = `
def grid_context(seconds):
    beat = float(track.timeToBeat(seconds))
    origin = beat - float(track.globalBeatToLocalBeat(beat))
    audio = track.audioTrack(beat)
    musical = bool(track.quant) or bool(audio and len(audio.markers) >= 2)
    return {'unit': 'beat' if musical else 'second', 'originBeat': origin,
            'originTime': float(track.beatToTime(origin))}

def grid_choices(unit):
    if unit == 'beat':
        return [1.0/96,1.0/48,1.0/32,1.0/24,1.0/16,1.0/12,1.0/8,1.0/6,1.0/4,1.0/3,1.0/2,1,2,4,8,16,32,64,128,256,512,1024]
    seconds = [0.5,1,2,5,10,15,30,60,120,300,600,1800,3600]
    # Frame-selected grids must stay frame-aligned even at fractional FPS.
    return sorted(set([1.0/fps(),2.0/fps(),5.0/fps(),10.0/fps()]+seconds+
                      [max(1,math.floor(s*fps()))/fps() for s in seconds]))

def grid_regions():
    # AudioSection fields are not exposed in this Designer API. Walk native
    # local-beat origins backwards, then verify the complete section count.
    # Ambiguous mapping produces no grid, rather than a guessed snap origin.
    count = len(track.audio_sections)
    if count > 128: raise ValueError('Too many timeline regions')
    finish = float(track.lengthInBeats)
    regions = []
    for unused in range(max(1, count)):
        if finish <= 0: break
        probe = finish - min(0.0000001, finish/2)
        origin = probe - float(track.globalBeatToLocalBeat(probe))
        if math.isnan(origin) or math.isinf(origin) or origin < -0.0000001 or origin >= finish:
            raise ValueError('Timeline region origin unavailable')
        origin = max(0.0, origin)
        begin_seconds, end_seconds = float(track.beatToTime(origin)), float(track.beatToTime(finish))
        context = grid_context(float(track.beatToTime(probe)))
        if abs(context['originBeat']-origin)>0.000001 or end_seconds<=begin_seconds:
            raise ValueError('Timeline region mapping unavailable')
        context.update({'start':begin_seconds,'end':end_seconds})
        regions.append(context)
        finish = origin
    if finish > 0.000001 or (count and len(regions) != count):
        raise ValueError('Timeline region boundaries unavailable')
    return list(reversed(regions))

def timeline_grid(start, end, width, settings):
    result = []
    span = max(0.000001, end-start)
    for region in grid_regions():
        lo, hi = max(start,region['start']), min(end,region['end'])
        if hi < lo: continue
        unit = region['unit']
        origin = region['originBeat'] if unit == 'beat' else region['originTime']
        first_value = float(track.timeToBeat(lo))-origin if unit == 'beat' else lo-origin
        last_value = float(track.timeToBeat(hi))-origin if unit == 'beat' else hi-origin
        pixels = width*max(0.000001,hi-lo)/span
        scale = pixels/max(0.000001,last_value-first_value)
        minimum = float(settings.get(unit,1 if unit=='beat' else 1.0/fps()))
        choices = grid_choices(unit)
        if not any(abs(minimum-s)<0.000000001 for s in choices):
            raise ValueError('Invalid timeline step')
        choices = [s for s in choices if s>=minimum-0.000000001 and abs(s/minimum-round(s/minimum))<0.000001]
        step = next((s for s in choices if s*scale>=18), choices[-1])
        major = next((n for n in [1,2,4,8,16,32,64,128] if n*step*scale>=110),128)
        first = max(0,int(math.ceil(first_value/step-0.00000001)))
        for i in range(first,min(first+1000,int(math.floor(last_value/step+0.00000001))+1)):
            value = origin+i*step
            at = float(track.beatToTime(value)) if unit=='beat' else value
            # The region on the right owns its boundary; never emit two grids.
            if at < lo-0.00000001 or at > hi+0.00000001 or (at>=region['end']-0.00000001 and region['end']<float(track.lengthInSec)-0.00000001):
                continue
            tick = {'time':at,'snapGrid':{'unit':unit,'step':step,'index':i,'origin':origin},
                    'major':i%major==0,'label':str(manager.beatToTimecode(track.timeToBeat(at)))}
            if unit=='beat': tick['beat']=i*step
            result.append(tick)
            if len(result)>2000: raise ValueError('Timeline grid too dense')
    return result
`
