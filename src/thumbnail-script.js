'use strict'

// Resolve thumbnail identity for the CC1 resource display; paths stay inside Designer.
module.exports = `
if p['command'] == 'thumbnail_identity':
    import os
    r = next((r for cls in (VideoClip, DxTexture) for r in resourceManager.allResources(cls) if str(r.uid) == p.get('uid')), None)
    if r is None:
        return {}
    try:
        files = [str(r.path)]
        if isinstance(r, VideoClip):
            fragments = [f for f in r.video_file.fragments if f.enabled and str(f.version) == str(r.enabledVersion)]
            files = [str(proxy.path) for fragment in fragments for proxy in fragment.proxies]
        if not files:
            return {}
        stamps = []
        for filename in files:
            full = os.path.abspath(filename)
            stat = os.stat(full)
            stamps.append([full, stat.st_size, stat.st_mtime])
        return {'revision': json.dumps([os.getcwd(), str(r.path), resource_media_info(r), stamps], sort_keys=True)}
    except pyerrors.Exception:
        return {}
`
