import math
class Audio:
    markers = [0,1]
class Track:
    def __init__(self, specs, quant=False):
        self.quant=quant
        self.regions=[]
        seconds,beat=0.0,0.0
        for duration,bpm,musical in specs:
            self.regions.append((seconds,beat,duration,bpm/60.0,musical))
            seconds+=duration
            beat+=duration*bpm/60.0
        self.lengthInSec,self.lengthInBeats=seconds,beat
        self.audio_sections=list(self.regions)
    def region_s(self,s): return next((r for r in reversed(self.regions) if s>=r[0]-1e-10),self.regions[0])
    def region_b(self,b): return next((r for r in reversed(self.regions) if b>=r[1]-1e-10),self.regions[0])
    def timeToBeat(self,s):
        r=self.region_s(s)
        return r[1]+(s-r[0])*r[3]
    def beatToTime(self,b):
        r=self.region_b(b)
        return r[0]+(b-r[1])/r[3]
    def globalBeatToLocalBeat(self,b): return b-self.region_b(b)[1]
    def audioTrack(self,b): return Audio() if self.region_b(b)[4] else None
class Manager:
    def beatToTimecode(self,b): return str(b)
manager=Manager()
def fps(): return 25.0
def checked(tick):
    global p
    p={'snapGrid':tick['snapGrid']}
    return checked_snap(tick['time'])
def reject(tick):
    try: checked(tick)
    except ValueError: return
    raise AssertionError('stale grid accepted')
for intro in [0.0,13.3,16.0,32.0]:
    for bpm in [60.0,92.0,100.0,123.0]:
        specs=([(intro,60,False)] if intro else [])+[(20,bpm,True),(7.7,60,False),(20,115,True)]
        track=Track(specs)
        ticks=timeline_grid(0,track.lengthInSec,1200,{'beat':0.25,'second':0.04})
        musical=[x for x in ticks if x['snapGrid']['unit']=='beat']
        assert abs(musical[0]['time']-intro)<1e-8
        assert musical[0]['beat']==0
        assert len(set(round(x['time'],8) for x in ticks))==len(ticks)
        for x in ticks:
            r=track.region_s(x['time'])
            assert (x['snapGrid']['unit']=='beat')==r[4]
            assert abs(checked(x)-x['time'])<1e-8
        second_origin=intro+27.7
        assert any(abs(x['time']-second_origin)<1e-8 and x.get('beat')==0 for x in ticks)
track=Track([(13.3,60,False),(40,120,True)])
def steps(lo,hi,minimum):
    return [x['snapGrid']['step'] for x in timeline_grid(lo,hi,1200,{'beat':minimum,'second':0.04}) if x['snapGrid']['unit']=='beat']
assert set(steps(13.3,15.3,0.25))=={0.25}
assert set(steps(13.3,13.5,1.0/96))=={1.0/96}
assert min(steps(0,50,0.25))>0.25
assert set(steps(13.3,15.3,1))=={1}
ticks=timeline_grid(13.3,16,1200,{'beat':0.25,'second':0.04})
tick=next(x for x in ticks if x['snapGrid']['index']==4)
assert abs(checked(tick)-13.8)<1e-8
track=Track([(13.3,60,False),(40,100,True)])
reject(tick)
track=Track([(12,60,False),(40,120,True)])
reject(tick)
track=Track([(13.3,60,False),(40,60,False)])
reject(tick)
track=Track([(20,60,False)],quant=True)
assert all(x['snapGrid']['unit']=='beat' for x in timeline_grid(0,10,1200,{'beat':0.25}))
track=Track([(20,60,False)])
assert all(x['snapGrid']['unit']=='second' for x in timeline_grid(0,10,1200,{}))
track.audio_sections.append(None)
try: grid_regions()
except ValueError: pass
else: raise AssertionError('unverified region count accepted')
print('mixed-region, local-origin, zoom, setting and stale-snap cases passed')

track=Track([(7200,60,False)])
def fps(): return 30000.0/1001
ticks=timeline_grid(0,6000,1200,{'second':1.0/fps()})
assert ticks and len(ticks)<100
assert all(abs(x['time']*fps()-round(x['time']*fps()))<1e-6 for x in ticks)
for x in ticks: checked(x)

# Every selected musical step is drawable and natively verifiable.
track=Track([(13.3,60,False),(40,120,True)])
for selected in [1.0/96,1.0/16,1.0/12,1.0/8,1.0/6,1.0/4,1.0/3,1.0/2,1,4]:
    ticks=timeline_grid(13.3,13.3+selected*1.5,1200,{'beat':selected})
    assert len(ticks)==4, (selected,ticks)
    assert all(abs(x['snapGrid']['step']-selected)<1e-10 for x in ticks)
    for x in ticks:
        assert abs(x['beat']*96-round(x['beat']*96))<1e-8
        checked(x)
    wide=timeline_grid(13.3,53,320,{'beat':selected})
    assert all(x['snapGrid']['step']>=selected for x in wide)
    assert all(abs(x['snapGrid']['step']/selected-round(x['snapGrid']['step']/selected))<1e-8 for x in wide)
    for x in wide: checked(x)
try: timeline_grid(13.3,14,1200,{'beat':1.0/128})
except ValueError: pass
else: raise AssertionError('Unsupported 1/128 beat grid accepted')
reject({'time':13.3,'snapGrid':{'unit':'beat','step':1.0/128,'index':0,'origin':13.3}})
