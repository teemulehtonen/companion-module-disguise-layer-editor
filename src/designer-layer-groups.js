'use strict'
// Use Designer's native hierarchy operations. Validate the current tree before
// mutation: a stale browser selection must never reparent unrelated layers.
module.exports = `
if p['command'] == 'group_move':
    def walk(container):
        for item in container.layers:
            yield item
            if isinstance(item, GroupLayer):
                for child in walk(item): yield child
    layer = next((item for item in walk(track) if str(item.uid)==p['layerUid']), None)
    if layer is None or not isinstance(layer, GroupLayer): raise ValueError('Group no longer available')
    members = [layer] + list(walk(layer))
    expected = p['members']
    if [str(item.uid) for item in members] != [item['uid'] for item in expected]: raise ValueError('Group contents changed')
    for item, old in zip(members, expected):
        if item.locked or getattr(item, 'anchored', False): raise ValueError('Group contains a locked or anchored layer')
        if abs(float(track.beatToTime(item.tStart))-old['start'])>0.00001 or abs(float(track.beatToTime(item.tEnd))-old['end'])>0.00001: raise ValueError('Group timing changed')
    def check_parents(container, locked=False):
        for item in container.layers:
            if item==layer and locked: raise ValueError('Parent group is locked')
            if isinstance(item, GroupLayer): check_parents(item, locked or item.locked)
    check_parents(track)
    origin = float(track.beatToTime(layer.tStart))
    target = pointer_time(origin)
    duration = layer.tEnd-layer.tStart
    limit = track.timeToBeat(float(track.lengthInSec))
    if duration>limit: raise ValueError('Group is longer than the track')
    new_start = max(0, min(limit-duration,track.timeToBeat(target)))
    shift = new_start-layer.tStart
    for item in members: markDirty(item)
    # Native group translation moves descendant bounds and sequence offsets once.
    # Do not run ordinary-layer key relocation afterwards: it would move keys twice.
    layer.setExtents(new_start,new_start+duration)
    return {'members':[{'uid':str(item.uid),'start':float(track.beatToTime(item.tStart)),'end':float(track.beatToTime(item.tEnd))} for item in members]}
if p['command'] == 'layer_group':
    operation = p.get('operation')
    if operation not in ('group', 'ungroup'): raise ValueError('Invalid group operation')
    selected = p.get('layers', [])
    ids = [item['uid'] for item in selected]
    if len(ids) != len(set(ids)) or not ids: raise ValueError('Invalid layer selection')
    def find_group_container(container, ancestors):
        if any(str(item.uid) == ids[0] for item in container.layers): return (container, ancestors)
        for item in container.layers:
            if isinstance(item, GroupLayer):
                found = find_group_container(item, ancestors + [item])
                if found is not None: return found
        return None
    found = find_group_container(track, [])
    if found is None: raise ValueError('Selected layers are no longer available')
    container, ancestors = found
    siblings = list(container.layers)
    if [str(item.uid) for item in siblings] != p.get('expectedOrder'):
        raise ValueError('Layer order changed; select the layers again')
    members = [item for item in siblings if str(item.uid) in ids]
    if len(members) != len(ids): raise ValueError('Select layers inside the same group')
    def check_unlocked(item):
        if item.locked: raise ValueError('A selected layer or group is locked')
        if isinstance(item, GroupLayer):
            for child in item.layers: check_unlocked(child)
    for ancestor in ancestors:
        if ancestor.locked: raise ValueError('Parent group is locked')
    for item in members:
        check_unlocked(item)
        expected = next(value for value in selected if value['uid'] == str(item.uid))
        if item.name != expected['name'] or abs(float(track.beatToTime(item.tStart))-expected['start']) > 0.00001 or abs(float(track.beatToTime(item.tEnd))-expected['end']) > 0.00001:
            raise ValueError('A selected layer changed; select the layers again')
    def refresh_hierarchy(item):
        # groupLayers/ungroupLayer update native data without rebuilding the
        # open Designer timeline in r32.4. A native no-op reorder notifies it.
        index = list(container.layers).index(item)
        if isinstance(container, GroupLayer): track.moveLayerToIndexInGroup(item, index)
        else: track.moveLayerToIndex(item, index)
    if operation == 'group':
        name = p.get('name', '').strip()
        if len(members) < 2 or not name or len(name) > 128 or any(ord(c)<32 for c in name):
            raise ValueError('Select at least two layers and enter a group name')
        old_ids = set(str(item.uid) for item in siblings)
        markDirty(track)
        for ancestor in ancestors: markDirty(ancestor)
        # Native order, not click order: the group replaces the highest member.
        track.groupLayers(members, name, False)
        created = next(item for item in container.layers if str(item.uid) not in old_ids)
        refresh_hierarchy(created)
        return {'groupUid': str(created.uid), 'memberUids': [str(item.uid) for item in created.layers]}
    if len(members) != 1 or not isinstance(members[0], GroupLayer):
        raise ValueError('Select one group to ungroup')
    group = members[0]
    children = [str(item.uid) for item in group.layers]
    if children != p.get('expectedChildren'): raise ValueError('Group contents changed; reopen the menu')
    markDirty(track)
    for ancestor in ancestors: markDirty(ancestor)
    track.ungroupLayer(group)
    if children:
        refresh_hierarchy(next(item for item in container.layers if str(item.uid) == children[0]))
    return {'ungroupedUid': str(group.uid), 'memberUids': children}
`
