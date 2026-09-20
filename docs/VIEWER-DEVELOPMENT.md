## Layer grouping and inspection

Shift-click layer headers/bars to toggle a selection, or Shift-drag across layer rows to select multiple siblings. Right-click a selected layer, enter a name and choose GROUP. Right-click a group and choose UNGROUP. The native Designer commands preserve layer UIDs, timings, keys and hierarchy; click order does not affect composition order. The group occupies the highest selected layer's position. Mixed parent selections, locked descendants and stale structure/bounds are rejected before mutation. Nested groups are supported. Group collapse/expand is local presentation and works in VIEW; grouping/ungrouping never does.

The browser sends bounded layer snapshots plus the exact sibling/child order through layer_group. designer-layer-groups.js owns native preflight and calls Track.groupLayers / Track.ungroupLayer; viewer-editor.js validates schema, current shared token and track. Hover readouts reuse the existing TC formatter for IN/OUT and key times; keys also show numeric values, choices or resource names. No write is sent for a tooltip.

Validation: 191 local tests; 11 isolated native grouping checks on a time track and 18 on a quantized track with 60/120/123 BPM. Browser fixture checks covered Shift selection, group/ungroup, local collapse/expand and VIEW. No exhaustive physical Deck test or large-track performance matrix was run.

Designer workflow reference: https://help.disguise.one/designer/layers/editing-layers/grouping-layers

## LIVE / VIEW safety mode

Click the connected LIVE/VIEW status to switch the entire module. VIEW forces LINK TIME off and keeps local time, layer/parameter browsing and zoom available. It blocks Designer edits, transport commands and real playhead changes from both browser and Companion. Returning to LIVE leaves LINK TIME off. Connection errors disable the mode switch.

The mode is saved in module configuration. DesignerClient uses a fail-closed native read allowlist and rechecks transport writes after asynchronous state reads. Only audited seek operations with keepPlayhead=true are allowed. Main invalidates the action queue, waits for the active action and clears editing state; an HTTP command already dispatched before locking cannot be recalled. The server enforces VIEW independently of browser controls. This protects this module, not other controllers or Designer itself.

Validation: targeted client, transport-race, Editor, Companion action and HTTP endpoint tests. No show-time guarantee or exhaustive physical Stream Deck test is implied.

# Viewer development guide

## Single-parameter key groups (0.2.0-beta.2)

Shift-marquee selects up to 4096 keys on one row. `moveKey.group` carries exact native key snapshots, and the top-level key is always the first key for Deck timing. Mouse `anchorTime` must identify a current member. All keys move by the same seconds delta, with anchor stepping converted through Designer beat/frame rules. Native `key_group` preflights every key and collision, preserves values/interpolation/resources and restores sequence contents if a mutation fails. Deleting every key leaves the evaluated value as a constant. Numeric/resource groups share this path; value and type controls are locked.

## Direct mouse editing (beta.103 candidate)

Beta.108 synchronization: viewer-edit-model.js merges confirmed layer patches without losing resource thumbnails. Update data-key-time on every representation of a moved key and read it at gesture/click time. Never capture a mutable key's timestamp permanently in a handler. main.js returns editRevision after its shared queue completes; stale browser live/geometry reads are discarded against the last confirmed revision. Suppress heavy snapshot requests while interacting, but keep the small live channel. Local requestAnimationFrame previews are disposable; only guarded native responses update canonical keys. drag_time optionally includes targetValue for one native time/value edit, rejecting resource/enum values before mutation. A single write is in flight and only the newest unsent pointer survives. Do not retry ambiguous writes.

Beta.105: resource folder navigation displays one horizontal row per hierarchy level, expanding only the current branch. Intermediate nodes without resources are browser-only navigation; actual folder changes still use server-owned indices. Explicit key clicks send a validated keyTime through key_move to Editor.toggleMoveKey(exactTime), then native select_key validates sourceTime. Never use delayed transport position to infer a clicked key. drag_value reuses the shared numeric adjustment operation with expected-key protection; resource and enum fields reject that command. The mouse can switch key targets by confirmed release followed by exact selection, while regular layer/parameter browsing retains the key-lock rules.

There is no top edit-tool strip. Viewer gestures choose the shared Editor target/mode, then invoke the same key/layer operations as Companion. `drag_time` adds an absolute pointer request to those native operations; it does not implement a second timeline engine. Native `pointer_time` quantizes to the selected step, validates a snap landmark when requested, and then uses the existing bounds/lock/collision checks. Never replay an uncertain write. During a pending write retain only the latest pointer position, not every pointer event.

Resource fields have a `resource` discriminator, placeholder numeric value 0 for the legacy snapshot contract, and `resourceUid` on each key. Display `resourceName`; never treat 0 as the resource's value. Interpolation and numeric value adjustment are inapplicable. A resource picker opened from a selected key retains its expected identity and time. The catalog comes from that field's native ResourceSequence type for both filesystem and internal resources.

`annotation` requests pass a strict schema and the shared state token. Native source text/time checks and destination collision checks run before writes. Only the requested tag/note is removed from the source when moving; co-located tags and section boundaries remain. Tag formats are documented in the [Designer tag guide](https://help.disguise.one/designer/timeline-tracks-transports/tags). These commands are opt-in through ALLOW VIEWER EDIT and share the existing same-origin/token protections.

## Responsibilities

- main.js: Companion lifecycle, ordered command queue, viewer lifecycle and edit revision.
- editor.js: selection/seek invariants, parameters and keyframe editing.
- viewer-editor.js: opt-in mouse adapter; strict Companion action allowlist, shared-state fingerprint, resource folder/page selection and explicit native key type.
- connection.js / live-properties.js: read-only Designer LiveUpdate feedback and HTTP fallback.
- viewer-clock.js: independent transport clock subscription.
- viewer-server.js: shared geometry cache, /api/state, /api/live, validated selection/seek routes, waveform refresh and thumbnail allowlist.
- viewer-script.js: native Python snapshot, hierarchy, sections, metadata, curves and frame/beat grids; inserted in designer-script.js helper scope.
- viewer-page.js: bundled browser function plus HTML/CSS. The function is serialized: external lexical helpers are not automatically available in the browser.
- viewer-model.js: redraw hash, alignment and hierarchy helpers. Include new geometry in renderRevision.
- viewer-waveform.js / viewer-waveform-script.js: native resource lookup, bounded local WAV / PCM MOV decoding and cache ownership by layer UID.
- smb-audio.js / smb-client.js: direct read-only SMB3 byte-range access (no local media copies); passwords use Companion secret storage.
- scripts/build-page.cjs: clean generated Companion page, never a personal configuration export.

## Update model

Live reads run every 75 ms independently of heavy geometry snapshots. Geometry refreshes every 1.5 seconds or after selection/content/viewport invalidation. Companion edits advance viewerEditRevision. Confirmed selections update cached rows immediately; stale full responses must not restore old selections. Hidden tabs pause browser polling. Full DOM redraw is avoided for clock/value-only changes.

Native curves use FieldSequence.eval in beat time. Convert through track.timeToBeat/beatToTime; beats are not necessarily seconds. Preserve fractional FPS. Last valid frame is ceil(end * fps - epsilon) - 1. Sections use native sectionInfo. Cue/MIDI/TC/notes come from transport annotations.

All markers and curves use the same time-to-x transform. Sticky headers have separate playhead lines. FIT LAYER permits negative empty display space while native reads clamp to zero. Browser commands use the existing Companion queue; never build an independent edit-state machine.

## Security and verification

Use textContent for project strings. Same-origin/token checks protect commands, but LAN access has no user authentication; keep loopback as default. Never accept arbitrary Python, paths or resource IDs from the browser. Filesystem permission is necessary for local audio reads.

POST /api/edit exists only with ALLOW VIEWER EDIT. main.js executes it inside perform(), then viewer-editor.js checks the shared state token and invokes the same definitions.js actions. Do not nest the real queue. Resources use server-owned folder/file indices; the submitted UID must match that indexed entry and is never forwarded unchecked. File paths are never accepted. Queried resource batches extend a bounded thumbnail allowlist. Failed writes are not replayed. Live display polling does not own editing state; preserve the pending edit response against older poll responses. Mouse input is relative encoder detents, not a second beat/time conversion implementation.

Tests are in test/viewer-*.test.js, test/parameter-order.test.js and test/smb-audio.test.js. UI changes need focused inspection; protocol/timing changes need regression tests. Run npm test and package smoke checks before publication. Record limitations honestly. Private local scripts are not required to build.

## Timing and playback metadata

Native player.tCurrent is beats: convert it through track.beatToTime before publishing seconds. Float/resource field evaluation takes beats directly. TransportCommand.makeJumpToTime takes seconds. Keep HTTP, LiveUpdate and timecode samples consistent. Test tempo changes away from 60 BPM.

viewer-script.js resolves mode / at end point choices from metadata even for collapsed layers. Never share numeric enum mappings between audio and video. viewer-page.js uses a single pixel position and transition for all playhead segments. Waveform SVG width derives from source duration; clipping depends on endpoint mode.

The token-protected POST /api/resources/test endpoint tests authentication and connecting the configured share only; it accepts no target paths and never reads media. STATUS_SUCCESS on a failed protocol test is a known misleading diagnostic when the dependency reports status zero. Improve error classification before relying on this endpoint for user-facing troubleshooting.

## Beta.113 insertion and selection rules

Blank parameter-lane double-click sends key_insert with explicit track/layer/parameter/time. Editor.selectFromViewer(point: insert) seeks and pins that time. Numeric writeLive accepts the pinned time with live:false; resource insertion retains mediaKeyTime until confirmation and uses media_key_set. Never infer insertion time from delayed transport feedback or replace the previous resource key. Existing-key double-click remains replacement.

Inactive layer clicks seek to IN; active clicks preserve time. Both initial button rendering and live disabled-state updates permit inactive layers. Resolve activity against an outstanding confirmed seek before stale refresh feedback. Keep lock release in the mouse adapter, not in shared Deck selection rules. Resource thumbnails must set draggable=false: native image drag otherwise interrupts the pointer gesture. Resource key drags change time only and retain resource UID.

## Pinned mouse editing and deletion (beta.122)

PIN TIME is on by default. keepPlayhead is scoped to a viewer select/edit request, never a global transport override. Native edit results still return the target time for key identity; Editor must not adopt that target as transport time while pinned. Keep explicit /api/seek independent. Preserve the pinned selected layer across clock refreshes, and clear it on explicit seek/layer/track changes or deletion. Layer deletion uses the guarded layer_manage command; return after refresh instead of attempting to select the deleted UID. Keyboard deletion gives selected keys priority and requires an explicit layer selection for layer deletion.

## Shared LINK TIME (beta.123)

Supersedes the viewer-only PIN TIME policy. Editor.linkTime defaults true. The browser sends link_time with an explicit boolean through the existing token-protected command queue; describeEditor exposes it to all viewers. withEditTime scopes transport preservation for Deck timing/key selection and viewer requests use the same policy. withTransportTime explicitly overrides preservation for seeks, key navigation and normal time rotation. Keep native result target times separate from the actual transport time when unlinked. Do not make keepPlayhead a blanket transport lock.

## Separate editing clock (beta.125)

Supersedes beta.123 transport-navigation exception. Editor.time is edit time, transportTime is Designer time. receiveTransportTime updates edit time only when linked. Native edit_seconds resolves editTime only for the matching track; keepPlayhead prevents transport jumps. Use edit time for field/resource evaluation, nudge origins, layer timing and clear operations. Real transport remains the source for viewer green cursor, clock and section countdown. Unlinked edit time is blue and drives selection, FOLLOW and zoom. LINK TIME changes cancel stale edit modes and adopt transport time without seeking. Include unlinked edit time in command fingerprints; never include the continuously running linked clock. Native LiveUpdate evaluated values are not adopted for an unlinked edit target. Targeted read_field and content refresh evaluate at edit time.

## Transport controls (beta.128)

Viewer transport actions use controlTransport and DesignerClient.transport. Validate operation allowlists, reread playback state before toggling and never retry ambiguous writes. Keep the nested section-jump request shape separate from the flat playback shape. Shared lastPlaybackMode is session state; stopping does not reset it. Do not route explicit transport commands through the editing seek path or keepPlayhead. See the [native transport API](https://developer.disguise.one/api/session/transport/).

## Pending UI update: sizes and transport input

SMALL/MEDIUM/LARGE apply browser-local 100/105/110 percent CSS zoom. viewer-ui-scale.js normalizes pointer and DOMRect coordinates to layout pixels, including popup placement. Track metadata shows native FPS, duration and TC/BEAT mode. TC IN: is a separate raw TransportManager.timecode readout, hidden when no source is assigned. Designer 32.4 exposes TimecodeTransport.current; newer timecode is a fallback. ViewerClock subscribes separately from the timeline clock and expires samples after two seconds; full snapshots provide a guarded fallback. Never substitute the timeline's TC-marker time for incoming TC. statusString remains the readout tooltip, including No clock.

Verification: native read-only inspection confirmed no assigned source on the current transport and current as a Timecode on an isolated LTC object. Actual incoming LTC/MTC signal has not been tested. Unit coverage includes removal, stale input and independence from timeline TC.
