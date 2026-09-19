# Timeline viewer (experimental beta)

The viewer can select layers and parameters and seek the Designer playhead. It cannot edit parameter values or keyframes.
Enable **ENABLE TIMELINE VIEWER**, choose **VIEWER PORT**
(default `8765`), and open `http://127.0.0.1:8765`. **ALLOW LAN ACCESS** exposes
the track, selection and seek controls to the local network without user authentication.
Leave it off for local use.
A port conflict disables the viewer without interrupting Companion controls.

Companion's selected layer expands. **SHOW ALL PARAMETERS** includes constants
and resource values; otherwise only sequenced parameters with keys appear.
Animated parameters come first, retaining Designer's order within each group.
Click an active layer or parameter name to select it in Companion. Layers outside
the playhead cannot be selected; selecting a name never changes time. Clicking the ruler or timecode row seeks instead. SELECT KEY locks
and open deletion menus prevent browser selection changes. Parameter values,
keyframes and layer timing cannot be edited in the browser.

Use **FIT TRACK**, **FIT LAYER**, the zoom buttons, or Ctrl+wheel to zoom.
Shift+wheel pans horizontally and suspends **FOLLOW**. Follow pans smoothly near
either visible edge without changing zoom. The grid becomes denser when zoomed
in, using frame divisions or native beat positions for quantized tracks.

## Implementation

- `viewer-server.js`: bounded, shared refresh, token-protected selection route, thumbnail
  allowlist, connection lifecycle and isolated errors.
- `viewer-script.js`: native track snapshot, hierarchy, arrows, parameter values,
  keyframes, sampled curves and frame/beat grid.
- `viewer-page.js`: bundled browser UI; no external scripts or dependencies.
- `viewer-model.js` / `parameter-order.js`: parameter visibility and ordering.
- `viewer-waveform.js`: bounded-memory local PCM/float WAV peak extraction and
  in-memory cache; resources are resolved by UID, never browser-provided paths.
- `viewer-waveform-script.js`: native audio resource lookup, internal to the server.

Full viewer snapshots are fetched while browsers request data. A hidden browser tab
does not poll. Companion feedback and the viewer clock subscription remain connected. The full snapshot is normally refreshed every 1.5 seconds; focus
and view-range changes invalidate it. Disconnects retain the last visible data
with an explicit stale indicator. All project strings are rendered as text.

## Current validation limits

Audio is
currently a labelled **source preview**, not a playback-aligned waveform.
Quantized audio sections, looping, speed, offsets and video embedded audio still
need verified native mappings and decoder support. Direct SMB support is experimental and has not passed live compatibility checks; remote thumbnails use Designer HTTP and do not need a shared folder.
The native waveform classes in the tested Designer API expose no sample access.
Unsupported waveforms are labelled unavailable, never drawn as invented audio.

## Cubic interpolation

Read-only probes of existing Designer 32.4.17 segments returned `0, 0.15625,
0.5, 0.84375, 1` at normalized times `0, 0.25, 0.5, 0.75, 1` for a 0→1 Cubic
segment, and their reverse for 1→0. These samples match:

`u = (beat - beat0) / (beat1 - beat0)`

`value = value0 + (value1 - value0) * (3*u*u - 2*u*u*u)`

This is observed behaviour for those segments, not a promise about every
Designer version or expression. The viewer samples `FieldSequence.eval` in
native beat time instead of reimplementing the interpolation. Tangent handles
were not exposed on the tested native key objects.

References: [native sequencing](https://developer.disguise.one/python-api/guides/track-and-sequencing/),
[track beat/time conversion](https://developer.disguise.one/python-api/docs/supertrack/),
[Designer waveform view](https://help.disguise.one/designer/audio/audio-waveform-view).

### Fast playhead feedback

The viewer uses one read-only Designer LiveUpdate subscription for an atomic track ID, playhead time and native timecode. It is independent of editing feedback and falls back to HTTP state when stale or disconnected. Local browser feedback is sampled every 75 ms independently of geometry requests; geometry still refreshes every 1.5 seconds. Subscription failures back off for 30 seconds and sockets close with the viewer. No LiveUpdate write commands are sent.

### Live feedback and transport seeking

Companion now opts into LiveUpdate for coherent time/layer bounds, playback, Designer layer selection, numeric field values and keyframes, and clock mode. A separate 500 ms fingerprint subscription invalidates numeric/resource keyframe data, names and layer timing in the viewer. HTTP remains a 1.5 s watchdog while live and a 500 ms fallback; annotations, groups and unsupported fields retain periodic refresh. Socket failures back off 30 s. Writes discard old subscriptions and resubscribe after a short quiet period to reject queued pre-write feedback.

Click the timeline ruler or timecode row to seek Designer. Requests are same-origin, token-protected, queued with Companion actions, checked against the current track, frame-snapped and clamped to track bounds. This is an explicit transport command and never moves a selected keyframe. The viewer is therefore no longer read-only. Curves use native parameter limits where available and leave only a six-pixel marker margin.

### Layer waveform controls

SHOW/HIDE WAVEFORM and the refresh arrow appear only for resources whose Designer metadata reports audio. Cache ownership uses the layer UID; changing its resource replaces the entry, and the next track snapshot removes entries for deleted layers. Refresh invalidates only that layer and rebuilds when requested. Track changes also release old layer entries. Video audio presence is detected, but embedded audio decoding is not yet supported. PCM/float WAV source previews still require local file access.

### Direct SMB (development)

RESOURCES: SMB D3 PROJECTS SHARE accepts a UNC or smb://server/share path. The active project folder is derived from Designer, not entered manually. Optional username/domain and a Companion secret-text password configure SMB authentication. Blank credentials request guest access, which the server must permit. The module only opens remote files for reading; temporary downloads are removed after decoding. This client currently supports SMB2 and NTLMv2; live compatibility with the local Windows share is still under investigation (STATUS_INVALID_PARAMETER). Leave the share blank to retain working local waveform reads. Do not distribute configured secrets.

### Responsive selection and timeline points

IN, OUT and keyframe markers highlight on hover. Clicking selects the target and seeks; OUT seeks to the last frame inside the layer. Selection locks remain enforced. Per-layer icons show sequenced parameters (default for the focused layer), all parameters or none.

Small live reads continue while geometry loads. Confirmed selections update cached rows immediately; stale snapshot selections are discarded. Companion edits invalidate geometry without waiting for the periodic refresh. This does not guarantee a fixed latency: native API and network response times still apply.

## Beta.52 UI

Timeline headers stay visible during vertical scrolling. Section bands alternate theme colours. CUE, TIMECODE, MIDI and NOTES flags seek when clicked; TC rows only show actual tags. Layer bars select only at the playhead. FIT LAYER centres with 4% margins and disables FOLLOW. The header shows current marker details and section time remaining, red in the final ten seconds. See PROJECT-HANDOFF.md for current limitations.
