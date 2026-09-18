# Architecture and editing invariants

## Boundaries

| File | Responsibility |
| --- | --- |
| `src/main.js` | Companion lifecycle, serial action queue, feedback and display variables |
| `src/definitions.js` | Stable action IDs and reusable button presets |
| `src/editor.js` | Selection, key locks, precision, resource browsing and editing modes |
| `src/client.js` | HTTP transport, cancellation, response validation and playback endpoints |
| `src/connection.js` | Health, LiveUpdate and sequential polling fallback |
| `src/designer-script.js` | Python executed inside Designer: metadata, time conversions and guarded mutations |
| `src/timecode.js` | Frame labels, including drop-frame numbering |
| `src/demo.js` | Offline test/demo client; never contacts Designer |
| `src/theme.js` | Shared Disguise Layer Editor colours and typography |

## Why the safeguards exist

**Identity is not order.** Designer UIDs are strings, never JavaScript numbers. Reordering layers updates the display order while retaining the selected UID and field name. An index is only a position in the current list.

**Seconds are not beats.** Companion works in track-relative seconds. Designer converts through its track API for every write. Frame steps use the transport's current FPS, including fractional/custom rates; display rounding does not change stored values.

**One encoder event is one ordered action.** The host queue preserves detents. On an error, its generation changes so already queued actions cannot silently target a different layer/track. HTTP writes are not automatically retried.

**Feedback can be late.** Pending jumps briefly reject inconsistent timeline feedback. Poll responses are discarded if their transport/field target changed during the request. Polling is scheduled after completion to prevent overlapping requests.

**Track changes invalidate modes.** A selection may survive a same-track metadata reload only if its identity and key still match. Cross-track changes close the resource browser and clear key locks. Mutations also check the active transport/track inside Designer.

**A key is an edit target.** Rotating VALUE updates the selected key (or the single constant key); pressing VALUE inserts a key at the playhead. SELECT KEY chooses the nearest in-range key, preferring the following one on a tie. Its lock prevents changing layer/parameter while TIME moves that key. Playback releases an unlocked selection; an explicit key lock survives only while its layer remains active. A second SELECT KEY press unlocks without seeking.

**Timing stays bounded.** Layer extents are absolute IN/OUT times. POSITION moves layer, keys and playhead by the actual clamped delta. IN/OUT/FIT respect track limits and a one-frame minimum. PREV/NEXT ignore keys outside the layer and terminate at IN or OUT minus one actual frame. Designer highlighting does not retain an inactive layer after a time change.

**Preview is not commit.** Resource browsing changes only local preview state. Encoder press applies the resource and returns to parameters; BACK cancels. Thumbnail press applies while leaving the browser open. Lists are restricted by the resource field's native type.

## Compatibility and release scope

Action and variable IDs are part of saved Companion configurations. Old GO/APPLY actions remain as compatibility entry points even though the current page does not show them. Do not remove them without a migration.

The distributable excludes machine-specific probes, local project UIDs, generated test media, old packages and test evidence. Development evidence remains in the working project. `scripts/release.ps1` builds from an explicit source allowlist; the Companion builder emits third-party license notices automatically.

Run `npm test` for offline regression tests, `npm run package` for the bundled-runtime smoke check and page generation, and `npm run release` for the complete distribution. These commands do not mutate a Designer project. Development scripts that create or alter tracks are intentionally absent from the source distribution.
