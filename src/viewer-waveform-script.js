'use strict'

// Resolve only a known resource. The HTTP viewer never receives this local path.
module.exports = `
if p['command'] == 'viewer_audio_source':
    import os
    resource = next((r for r in resourceManager.allResources(AudioTrack) if str(r.uid) == p.get('uid')), None)
    if resource is None or resource.audioFile is None:
        return {'status': 'unavailable'}
    filename = os.path.abspath(str(resource.audioFile.path))
    try:
        stat = os.stat(filename)
        return {'status': 'ready', 'filename': filename, 'projectDirectory': os.getcwd(), 'revision': str(stat.st_size)+':'+str(stat.st_mtime)}
    except pyerrors.Exception:
        return {'status': 'unavailable'}
`
