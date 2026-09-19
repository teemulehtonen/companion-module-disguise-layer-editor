'use strict'

// Resolve only a known resource. The HTTP viewer never receives this local path.
module.exports = `
if p['command'] == 'viewer_audio_source':
    import os
    resource = next((r for cls in (AudioTrack, AudioFile) for r in resourceManager.allResources(cls) if str(r.uid) == p.get('uid')), None)
    container = 'wav'
    if isinstance(resource, AudioFile):
        filename = os.path.abspath(str(resource.path))
    elif resource is not None and resource.audioFile is not None:
        filename = os.path.abspath(str(resource.audioFile.path))
    else:
        video = next((r for r in resourceManager.allResources(VideoClip) if str(r.uid) == p.get('uid')), None)
        if video is None or not video.hasAudio:
            return {'status': 'unavailable'}
        fragments = [f for f in video.video_file.fragments if f.enabled]
        if len(fragments) != 1 or len(fragments[0].proxies) != 1:
            return {'status': 'unavailable', 'reason': 'Multi-fragment video audio is not supported'}
        filename = os.path.abspath(str(fragments[0].proxies[0].path))
        container = 'mov'

    try:
        stat = os.stat(filename)
        return {'status': 'ready', 'container': container, 'filename': filename, 'projectDirectory': os.getcwd(), 'revision': str(stat.st_size)+':'+str(stat.st_mtime)}
    except pyerrors.Exception:
        return {'status': 'unavailable'}
`
