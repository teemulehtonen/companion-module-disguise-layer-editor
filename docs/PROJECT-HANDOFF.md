# Project handoff — beta.52

Read this file, DEVELOPER-MANUAL.md and VIEWER-DEVELOPMENT.md when resuming development. The Git repository is the source of truth; no previous conversation or private machine path is required.

## Current state

Node 22.22.0, Companion 5.0.5, Designer 32.4.17. Module ID: disguise-layer-control. Enable the integrated viewer in module settings; default port 8765, loopback only. Each imported build needs a new version in package.json, package-lock.json and companion/manifest.json.

Viewer features: native curves, resource thumbnails, groups/arrows, fixed timeline headers, section shading, clickable CUE/TC/MIDI/NOTES markers, layer selection, explicit timeline target seeking, waveform source previews, pan/zoom/follow. FIT LAYER leaves 4% margins and disables FOLLOW. Layer bars/names select only at the playhead. Explicit keyframe/IN/OUT targets may seek. OUT and section countdown use the last frame inside the exclusive end boundary. Header details show the latest preceding cue/MIDI/note. Countdown displays whole seconds and turns red at ten seconds.

## Remaining work

- Direct SMB remains experimental: live compatibility failed with STATUS_INVALID_PARAMETER. Leave its share blank for local WAV reading. Do not weaken OS authentication.
- Embedded video audio, native quantized waveform alignment, loops, speed and offsets are unfinished. Waveforms are source previews.
- Native nested groups/precomp fixtures require further validation. Some parameter types remain unsupported.
- Dense keyframes create many DOM nodes; see the stress measurements in VIEWER-TEST-REPORT.md. Consider viewport virtualization or canvas with indexed hit-testing before promising smooth operation on very large projects.
- Narrow screen layouts and overlapping annotation labels merit further refinement.

## Development workflow

Inspect git status/diff first and preserve unrelated changes. Use npm ci, targeted tests during edits, npm test before release and npm run package for clean module/page outputs. Run local batches with concise output to save credits. Use proportionate browser tests; do not repeat hardware tests for text styling.

Never commit credentials, private host addresses, local project/media files or .tools probes. Obtain test configuration locally. Installations must preserve user connections/pages. Designer project mutations need explicit authorization. Publish only when requested; update README links only when matching release assets exist. Do not equate a Git push with a published binary release.

Latest validation: 122 offline tests passed; package smoke checks passed. Installed module beta.52 was checked locally. This is not an exhaustive native or physical Stream Deck regression. Repository documentation must distinguish fixture coverage, native reads and live writes.
