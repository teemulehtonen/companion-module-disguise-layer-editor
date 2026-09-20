# Independent, read-only Designer state for installed-regression.cjs.
# Do not call production snapshot helpers: these assertions must have a separate oracle.
import json
import base64
request = json.loads(base64.b64decode('__REQUEST__').decode('utf-8'))
manager = guisystem.currentTransportManager
track = manager.track
if track is None or str(track.uid) != request['trackUid']:
    raise ValueError('Test track changed')
def walk(container, parent=None):
    for layer in container.layers:
        yield layer, parent
        if isinstance(layer, GroupLayer):
            for item in walk(layer, str(layer.uid)):
                yield item
layers=[]
for layer,parent in walk(track):
    uid=str(layer.uid)
    item={'uid':uid,'name':layer.name,'parent':parent,'group':isinstance(layer,GroupLayer),
          'start':float(track.beatToTime(layer.tStart)),'end':float(track.beatToTime(layer.tEnd))}
    item['fields']=[]
    for name in request.get('fields',{}).get(uid,[]):
        field=layer.findSequence(name)
        if field is None: continue
        seq=field.sequence
        resource=isinstance(seq,ResourceSequence)
        if not resource and not isinstance(seq,FloatSequence): continue
        keys=[]
        for i in range(seq.nKeys()):
            key=seq.key(i)
            data={'time':float(track.beatToTime(seq.t(i)))}
            if resource: data['resourceUid']=str(key.r.uid) if key.r else ''
            else: data.update({'value':float(key.v),'interpolation':int(key.interpolation)})
            keys.append(data)
        current=seq.evalResource(track.timeToBeat(request['time'])) if resource else float(field.eval(track.timeToBeat(request['time']),16))
        item['fields'].append({'name':name,'sequenced':not field.disableSequencing,'keys':keys,
          'resource':resource,'value':str(current.uid) if resource and current else '' if resource else current})
    layers.append(item)
return {'trackUid':str(track.uid),'time':float(track.beatToTime(manager.player.tCurrent)),
        'length':float(track.lengthInSec),'quantized':bool(track.quant),'layers':layers}
