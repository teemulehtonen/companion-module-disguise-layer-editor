# Viewer development guide

## Responsibilities

- main.js: Companion lifecycle, ordered command queue, viewer lifecycle and edit revision.
- editor.js: selection/seek invariants, parameters and keyframe editing.
- connection.js / live-properties.js: read-only Designer LiveUpdate feedback and HTTP fallback.
- viewer-clock.js: independent transport clock subscription.
- viewer-server.js: shared geometry cache, /api/state, /api/live, validated selection/seek routes, waveform refresh and thumbnail allowlist.
- viewer-script.js: native Python snapshot, hierarchy, sections, metadata, curves and frame/beat grids; inserted in designer-script.js helper scope.
- viewer-page.js: bundled browser function plus HTML/CSS. The function is serialized: external lexical helpers are not automatically available in the browser.
- viewer-model.js: redraw hash, alignment and hierarchy helpers. Include new geometry in renderRevision.
- viewer-waveform.js / viewer-waveform-script.js: native resource lookup, bounded local WAV decoding and cache ownership by layer UID.
- smb-audio.js: experimental read-only SMB downloads and temporary-file cleanup; passwords use Companion secret storage.
- scripts/build-page.cjs: clean generated Companion page, never a personal configuration export.

## Update model

Live reads run every 75 ms independently of heavy geometry snapshots. Geometry refreshes every 1.5 seconds or after selection/content/viewport invalidation. Companion edits advance viewerEditRevision. Confirmed selections update cached rows immediately; stale full responses must not restore old selections. Hidden tabs pause browser polling. Full DOM redraw is avoided for clock/value-only changes.

Native curves use FieldSequence.eval in beat time. Convert through track.timeToBeat/beatToTime; beats are not necessarily seconds. Preserve fractional FPS. Last valid frame is ceil(end * fps - epsilon) - 1. Sections use native sectionInfo. Cue/MIDI/TC/notes come from transport annotations.

All markers and curves use the same time-to-x transform. Sticky headers have separate playhead lines. FIT LAYER permits negative empty display space while native reads clamp to zero. Browser commands use the existing Companion queue; never build an independent edit-state machine.

## Security and verification

Use textContent for project strings. Same-origin/token checks protect commands, but LAN access has no user authentication; keep loopback as default. Never accept arbitrary Python, paths or resource IDs from the browser. Filesystem permission is necessary for local audio reads.

Tests are in test/viewer-*.test.js, test/parameter-order.test.js and test/smb-audio.test.js. UI changes need focused inspection; protocol/timing changes need regression tests. Run npm test and package smoke checks before publication. Record limitations honestly. Private local scripts are not required to build.
