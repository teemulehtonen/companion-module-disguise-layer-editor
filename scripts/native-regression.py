# Executed inside Designer by native-regression.cjs. Detached tracks only.
import math
import d3
import exceptions as errors
checks = []
real = guisystem.currentTransportManager
class PlayerStub:
    tCurrent = 0
class ManagerStub:
    player = PlayerStub()
    uid = real.uid
    def customFps(self): return real.customFps()
    def smpteClockType(self): return real.smpteClockType()
    def beatToTimecode(self, beat): return real.beatToTimecode(beat)
    def addCommand(self, command): raise RuntimeError('Test attempted a transport write')
test_manager = ManagerStub()
def call(test_payload):
# __NATIVE_COMMAND__

def check(name, good, detail=''):
    checks.append({'name': prefix + '/' + name, 'status': 'PASS' if good else 'FAIL', 'detail': detail})
def close(a,b): return abs(float(a)-float(b)) < 0.00001
def bounds(layer): return (float(t.beatToTime(layer.tStart)), float(t.beatToTime(layer.tEnd)))
def request(command, layer=None, **args):
    payload = {'command':command, 'keepPlayhead':True, 'time':0}
    if layer is not None: payload['layerUid'] = str(layer.uid)
    payload.update(args)
    payload['editTime'] = payload.get('time',0)
    return call(payload)
def field_keys(field):
    seq=field.sequence
    return [(float(t.beatToTime(seq.t(i))), str(seq.key(i).r.uid) if isinstance(seq,ResourceSequence) and seq.key(i).r else (None if isinstance(seq,ResourceSequence) else float(seq.key(i).v))) for i in range(seq.nKeys())]
def unchanged_rejection(name, payload, read):
    before=read()
    rejected=False
    try: call(payload)
    except: rejected=True
    check(name,rejected and read()==before)
def audit_field(name, layer, field, at):
    data=request('read_field',layer,field=field.name,time=at)['field']
    raw=field_keys(field)
    check(name+'/times',len(data['keys'])==len(raw) and all(close(k['time'],r[0]) for k,r in zip(data['keys'],raw)))
    if isinstance(field.sequence,FloatSequence):
        check(name+'/values',all(close(k['value'],r[1]) for k,r in zip(data['keys'],raw)))
    return data

for bpm in (None,60.0,120.0,123.0):
    tracks=[]
    prefix='TIME' if bpm is None else 'BEAT-'+str(bpm)
    try:
        for kind in ('video','bitmap','audio'):
            # Native leaf-list caches may live for a render tick. Separate tracks
            # prevent a synchronous batch from testing a stale fixture hierarchy.
            t=Track()
            tracks.append(t)
            test_manager.track=t
            if bpm is not None:
                t.quant=True
                t.bpm=bpm
            prefix=('TIME' if bpm is None else 'BEAT-'+str(bpm))+'/'+kind
            try:
                # Fixture creation belongs to the harness, not the CC1 command surface.
                cls={'video':VariableVideoModule,'audio':AudioModule,'bitmap':BitmapModule}[kind]
                first=t.timeToBeat(10)
                last=first+4 if bpm else t.timeToBeat(20)
                layer=t.addNewLayer(cls,first,last-first,'CC1 REGRESSION')
                layer.setExtents(first,last)
                uid=str(layer.uid)
                start,end=bounds(layer)
                check('create',end>start and len(t.layers)>0)
                request('section_edit',operation='cut',time=5)
                check('section-cut',t.beatToSection(t.timeToBeat(5.1))>t.beatToSection(t.timeToBeat(4.9)))
                request('section_edit',operation='merge',time=5.1)
                check('section-merge',t.beatToSection(t.timeToBeat(5.1))==t.beatToSection(t.timeToBeat(4.9)))
                # All mutations below pass through the actual production native command generator.
                field=layer.findSequence('volume' if kind=='audio' else 'brightness')
                if field is None: raise RuntimeError('Primary parameter unavailable')
                request('keys_clear',layer,fields=[field.name],confirmed=True,resetDefault=True,time=start)
                request('constant_set',layer,field=field.name,value=0.3,time=start)
                check('constant',field.disableSequencing and close(field.sequence.key(0).v,0.3))
                expected_value=0.3
                for precision,step in (('coarse',0.1),('fine',0.01),('ultra',0.001)):
                    request('adjust_value',layer,field=field.name,time=start,direction=1,precision=precision,fine=precision=='fine',step=0.1)
                    expected_value+=step
                    check('precision-'+precision,close(field.sequence.key(0).v,expected_value))
                keytimes=[start+(end-start)*f for f in (0.25,0.5,0.75)]
                for at,value in zip(keytimes,(0.2,0.5,0.8)):
                    request('key_set',layer,field=field.name,time=at,value=value)
                current_value=float(field.eval(t.timeToBeat(keytimes[1]),16))
                request('key_set',layer,field=field.name,time=keytimes[1],value=-99,evaluateCurrent=True)
                check('atomic-key-value',any(close(at,keytimes[1]) and close(value,current_value) for at,value in field_keys(field)))
                audit_field('keys-created',layer,field,keytimes[0])
                check('sequencing-enabled',not field.disableSequencing)
                for keytype in (0,1,2):
                    request('key_type',layer,field=field.name,time=keytimes[1],sourceTime=keytimes[1],type=keytype)
                    key=next(field.sequence.key(i) for i in range(field.sequence.nKeys()) if close(t.beatToTime(field.sequence.t(i)),keytimes[1]))
                    check('interpolation-'+str(keytype),key.interpolation==[Key.select,Key.linear,Key.cubic][keytype])
                r=request('key_move',layer,field=field.name,time=keytimes[1],sourceTime=keytimes[1],delta=1.0/128 if bpm else 1,beats=bpm is not None,frames=bpm is None)
                audit_field('key-encoder',layer,field,r['time'])
                # OUT is a legal key position and repeated NEXT may not move backwards.
                request('key_set',layer,field=field.name,time=end,value=0.9)
                for attempt in range(2):
                    r=request('jump_key',layer,field=field.name,time=end,navigationTime=end,direction=1)
                    check('out-next-'+str(attempt),close(r['time'],end) and close(r['keyTime'],end))
                before=field_keys(field)
                unchanged_rejection('outside-key-rejected',{'command':'key_set','layerUid':uid,'field':field.name,'time':end+1,'value':0.4,'keepPlayhead':True},lambda:field_keys(field))
                r=request('layer_edit',layer,mode='move',expectedStart=start,expectedEnd=end,delta=2,time=start,cursor=start)
                newstart,newend=bounds(layer)
                check('layer-move',close(newstart,start+2) and close(newend,end+2))
                check('layer-move-keys',all(close(a[0]+2,b[0]) and a[1]==b[1] for a,b in zip(before,field_keys(field))))
                check('returned-layer-bounds',close(r['layer']['start'],newstart) and close(r['layer']['end'],newend))
                unchanged_rejection('stale-layer-rejected',{'command':'layer_edit','layerUid':uid,'mode':'move','expectedStart':start,'expectedEnd':end,'delta':1,'keepPlayhead':True},lambda:bounds(layer))
                for mode,delta in (('in',0.25 if bpm else 0.2),('out',-0.25 if bpm else -0.2)):
                    oldstart,oldend=bounds(layer); oldkeys=field_keys(field)
                    origin=oldstart if mode=='in' else oldend
                    expected=float(t.beatToTime(t.timeToBeat(origin)+delta)) if bpm else origin+delta
                    # Designer itself rounds some layer endpoints to its native
                    # grid. Obtain an independent native oracle, not our response.
                    oracle=Track()
                    if bpm:
                        oracle.quant=True
                        oracle.bpm=bpm
                    reference=oracle.addNewLayer({'video':VariableVideoModule,'audio':AudioModule,'bitmap':BitmapModule}[kind],layer.tStart,layer.tEnd-layer.tStart,'ORACLE')
                    reference.setExtents(t.timeToBeat(expected if mode=='in' else oldstart),t.timeToBeat(expected if mode=='out' else oldend))
                    expected_bounds=(float(oracle.beatToTime(reference.tStart)),float(oracle.beatToTime(reference.tEnd)))
                    oracle.removeLayer(reference)
                    request('layer_edit',layer,mode=mode,expectedStart=oldstart,expectedEnd=oldend,delta=delta,beats=bpm is not None,time=oldstart,cursor=oldstart)
                    nowstart,nowend=bounds(layer)
                    check('trim-'+mode,close(nowstart,expected_bounds[0]) and close(nowend,expected_bounds[1]))
                    check('trim-preserves-keys-'+mode,all(close(a[0],b[0]) and a[1]==b[1] for a,b in zip(oldkeys,field_keys(field))))
                start,end=bounds(layer)
                request('key_clear',layer,field=field.name,time=(start+end)/2,confirmed=True)
                check('clear-including-outside',field.disableSequencing and field.sequence.nKeys()==1)
                request('parameter_default',layer,field=field.name,time=start,confirmed=True)
                check('native-default',field.disableSequencing and close(field.sequence.key(0).v,field.defaultValue))
                request('key_delete',layer,field=field.name,time=start,keyTime=field_keys(field)[0][0])
                check('last-key-delete-keeps-constant',field.disableSequencing and field.sequence.nKeys()==1)
                # Only real resources advertised for this parameter are used; no media is copied.
                resource_fields=[f for f in layer.fields if isinstance(f.sequence,ResourceSequence) and not f.notSequencable and f.typeName.endswith('::RP')]
                tested=0
                for rf in resource_fields:
                    cls=getattr(d3,rf.typeName[:-4],None)
                    if cls is None: continue
                    candidates=[]
                    for resource in resourceManager.allResources(cls):
                        try:
                            if str(resource.path) and not str(resource.path).lower().startswith('internal/thumbnails/'):
                                candidates.append(resource)
                        except: pass
                        if len(candidates)>=2: break
                    if not candidates: continue
                    at=start+(end-start)/2
                    request('media_set',layer,field=rf.name,time=start,mediaUid=str(candidates[0].uid))
                    request('media_key_set',layer,field=rf.name,time=at,targetTime=at,mediaUid=str(candidates[-1].uid))
                    check('resource-key-'+str(tested),str(rf.sequence.evalResource(t.timeToBeat(at)).uid)==str(candidates[-1].uid))
                    result=request('key_move',layer,field=rf.name,time=at,sourceTime=at,delta=0.01)
                    check('resource-move-'+str(tested),any(close(k[0],result['time']) and k[1]==str(candidates[-1].uid) for k in field_keys(rf)))
                    request('key_delete',layer,field=rf.name,time=result['time'],keyTime=result['time'])
                    check('resource-delete-'+str(tested),not any(close(k[0],result['time']) for k in field_keys(rf)))
                    tested+=1
                if not tested: checks.append({'name':prefix+'/resource-tests','status':'SKIP','detail':'No usable resource fields/media in this project'})
                start,end=bounds(layer)
                supported=[f for f in layer.fields if isinstance(f.sequence,(FloatSequence,ResourceSequence))]
                unchanged_rejection('default-all-needs-confirmation',{'command':'layer_default','layerUid':uid,'time':start,'editTime':start,'keepPlayhead':True},lambda:[field_keys(f) for f in supported])
                request('layer_default',layer,time=start,confirmed=True)
                for f in supported:
                    constant=f.disableSequencing and f.sequence.nKeys()==1
                    if isinstance(f.sequence,ResourceSequence):
                        value=f.sequence.key(0).r
                        default=f.defaultValue
                        correct=(str(value.uid) if value else '')==(str(default.uid) if default else '')
                    else: correct=close(f.sequence.key(0).v,f.defaultValue)
                    check('default-all-'+f.name,constant and correct)
            except errors.Exception as error:
                # Native exception text can contain project paths; retain a sanitized failure.
                checks.append({'name':prefix+'/execution','status':'FAIL','detail':str(type(error).__name__) + ': ' + str(error).split('\n')[0][:150]})
    finally:
        for fixture in tracks:
            for item in list(fixture.layers): fixture.removeLayer(item)
return {'checks':checks,'scope':'Production native commands on detached Designer tracks; no transport writes, UI gestures or physical device latency measured'}
