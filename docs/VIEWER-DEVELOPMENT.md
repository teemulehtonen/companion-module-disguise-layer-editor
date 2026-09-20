## Local presentation transactions (Companion beta.37)

`viewer-presentation.js` owns reversible DOM previews, never native/editor data. `previewAction` captures command identity before sending and supplies immediate presentation for marker edits, key/layer deletion, rename/reorder, resource/value selection and transport/link controls. Creation uses a non-interactive placeholder without an invented UID or duration. Group/fit/sequence/type operations show pending feedback where Designer must determine the result. Existing key/layer/marker drags retain their geometry previews; multiple selected numeric keys now deform native curve samples between key anchors. Discrete resources are never rendered as numeric curves.

An accepted preview persists until a revision-checked full snapshot replaces it. Unpaint before replacing the DOM (particularly for reorder previews), then repaint if awaiting a snapshot. Reject/timeout rolls back presentation without retrying native writes; mode changes, disconnection and fresh snapshots clear previews. Do not replay previews per animation frame. Read-only mode and all native validation remain authoritative. Exact cubic resampling, tempo-aware typed marker times, fit durations and new hierarchy identifiers still come from Designer. Tests cover queue composition/rollback, redraw/context reset, group curve anchoring and stale command acknowledgements.

## Rendering optimization (Companion build 0.2.0-beta.28)

FOLLOW animation updates only playhead geometry. Metadata, parameter values and availability update on live data, not on each animation frame. DOM references are cached for a single draw and discarded before replacing the sheet. Native layer/field objects are indexed afresh on every data update, so incoming replacements and in-place patches cannot leave stale values. Text content is only assigned when changed. Both playhead segments share one width measurement and disable transition easing during follow panning.

Tests in viewer-fluid.test.js exercise 1,000 parameters over 600 presentation frames, cache invalidation, refreshed choice labels, linked/unlinked clocks and selection permissions. These measure work counts using a simulated DOM, not real browser FPS or CPU usage. No command ordering, mutation guards, frame/beat rules or native write paths changed. Companion deployment was approved; GitHub publication remains pending.

## Clear media cache

In module settings, select **CLEAR MEDIA CACHE** and save. This one-shot setting resets itself. The connection restarts its viewer and thumbnail/waveform memory caches, waits for cancelled waveform tasks, then clears owned waveform and thumbnail files from the shared host cache. Reload open viewers to replace already displayed thumbnails. No media or Designer data is deleted. Other module instances retain their memory data and can repopulate the shared disk cache; an active disk writer prevents clearing and logs a warning instead of bypassing its lock.

Thumbnails are held in bounded Maps (96 Companion / 128 viewer entries) and persisted as validated PNG/base64 records in the same disk cache. Native thumbnail identity resolves project, UID, file size/modification time, enabled video version and available media metadata before reuse. Unsupported identities bypass persistence rather than reusing potentially stale images. Viewer HTTP responses use `Cache-Control: no-store`. This operation does not clear Companion's own application storage or unrelated browser data.

## Persistent waveform cache

Waveform summaries and thumbnails are cached on the machine running Companion, not on Designer or in the project share. Only peak amplitudes, duration, sampling step and thumbnail PNGs are stored; source audio/video is never copied. The cache is shared by local module instances and limited to 100 MiB combined (oldest-written entries are evicted); waveform entries are limited to 256 KiB and thumbnail JSON entries to 1400 KiB (PNG at most 1 MiB). The memory cache still holds at most 32 owners.

Keys hash the Designer endpoint, project directory, media path, resource UID, source size/modification-time revision and container. Filenames and credentials are not written into cache records. Designer metadata is checked before reuse, so offline sources are not silently replaced by stale cached data. Replacing content while preserving both size and modification time requires REFRESH. REFRESH invalidates the disk record and decodes again. Removing a layer releases its memory entry; reusable disk summaries remain until quota eviction.

Cache location belongs to the OS account running Companion:
- Windows: `%LOCALAPPDATA%/disguise-layer-editor/waveforms-v1`
- Linux/Raspberry Pi: `$XDG_CACHE_HOME/disguise-layer-editor/waveforms-v1`, or `~/.cache/disguise-layer-editor/waveforms-v1`
- macOS: `~/Library/Caches/disguise-layer-editor/waveforms-v1`

A container needs a persistent writable cache directory to retain data across container replacement. Read-only/full disks and invalid cache records fall back to normal waveform decoding. Writes are serialized and use an exclusive cross-process lock plus atomic rename. An interrupted process may leave `.write-lock`; this conservatively disables disk writes until the cache directory is cleared with Companion stopped. Existing readable peaks remain usable. OS/account changes or module removal do not necessarily delete this cache; it can be removed safely while Companion is stopped.

The shared disk implementation is `src/waveform-disk-cache.js`; thumbnail loading uses `src/client.js` and native `thumbnail_identity`; tests use temporary directories. This is an expendable cache, not a backup or a source of Designer state.

## OUT boundary semantics

Treat layer playback as ending at OUT: the last displayed frame begins one frame earlier. Editing bounds include exact OUT for numeric, choice and resource keys, and layer/parameter focus must survive an exact OUT seek. NEXT falls back to exact OUT, never OUT minus one frame; otherwise repeated NEXT at an OUT key can move backwards. LINK TIME can move the native playhead to OUT, where ended playback is expected. Do not extend layer duration or alter key time to hide this distinction.

## Ordinary VALUE fast feedback

Ordinary VALUE encoder edits now emit the same confirmed geometry patches as SELECT KEY and LAYER EDIT. This path was previously missing when moveKey was null, leaving key/curve updates waiting for a full snapshot. Sequenced VALUE edits request throttled native curve samples, and pending same-direction VALUE turns can batch without an explicit key-selection mode. Mouse preview behavior is unchanged.

Validation: 203 local tests, including the regression that a plain VALUE change emits a geometry patch with neither key nor layer edit active.

## Incremental viewer geometry

Confirmed encoder patches now update existing layer bars, IN/OUT markers, key markers and curve paths instead of reconstructing the entire timeline. Geometry uses a short 65 ms visual interpolation; native destinations remain authoritative. Heavy state requests wait until 400 ms after the last applied patch; stale in-flight reads cannot replace a newer patch. Cached curve sample times translate with ordinary layer moves and remain absolute when trimming.

Validation: 202 local tests including node-preserving geometry and shared curve-reference regression tests. A read-only LAN measurement before this change observed 1–2 ms warm live requests versus 232 ms for an uncached 537 KB full state; these numbers are environment-specific, not a latency guarantee.

## Encoder responsiveness

Companion encoder edits coalesce adjacent identical pending detents (maximum 64) behind an in-flight command. Clicks, reversals, different options and generation changes are barriers; keyframe multi-selection remains unbatched. Native key moves simulate intermediate detents to preserve collision and boundary behavior. Layer edit returns only the edited layer instead of re-reading every layer.

Confirmed edited-field/layer patches are available on the fast viewer channel for 500 ms and carry revision checks. Numeric key curve previews are sampled at most once per 100 ms. No speculative writes or automatic retries were added.

Validation: 200 local tests, native grouped-child move/IN/OUT checks, and native batched-key collision check. The controlled queue test combines 20 pending turns into one call; no measured physical Stream Deck latency claim is made.

## Group context menu

Parameter selection includes exact layer OUT (with floating-point tolerance) in both linked and independent edit clocks. Times beyond OUT remain invalid.

A single group context menu offers UNGROUP, DELETE and CANCEL. DELETE removes the group and its contents through native Track.removeLayer after existing hierarchy, timing and descendant lock checks. UNGROUP retains the children. VIEW blocks both writes. Validation: local suite and 11 isolated native grouping/deletion checks.

## Group presentation

Group rows and bars use their distinct color without an icon or thumbnail. Timing behavior is unchanged.

## Group translation

Group bars can be dragged in time; group IN/OUT handles remain read-only. The guarded group_move command uses native GroupLayer.setExtents for translation only, moving nested children and sequence offsets once. Payloads validate the complete ordered subtree and current bounds; locked/anchored descendants and locked ancestors reject before writing. VIEW blocks the operation. Snapping excludes the entire moving subtree and its ancestors. Native beat translation preserves internal beat spacing, including key positions.

Groups use a muted violet tint and a folder/group icon instead of media thumbnails.

Validation: 197 local tests, isolated native time and 123 BPM nested-group translation and stale-bound rejection (8 checks total). Group lock checks are implemented but were not exercised against native locked layers in this batch.

## Group-child snap correction

Moving a child layer no longer offers its own ancestor groups as snap targets: their bounds can follow the same child. Unrelated group edges are validated natively alongside ordinary layer edges. This prevents a reproducible snap rejection during group-child drags without bypassing stale-target checks.

Validation: 195 local tests; isolated native child move/IN/OUT checks and snapping to a group-only boundary. No exhaustive physical Stream Deck or show-time test was run.

## Group synchronization correction

Grouping now triggers Designer timeline hierarchy refresh through a native no-op sibling reorder after group/ungroup. Data-only grouping previously left the open native timeline stale. First Shift layer selection includes the ordinary active sibling; the group popup shows selected count.

Validation: 194 local tests, 11 isolated native time-track grouping checks, 18 quantized checks; browser fixture active-selection extension and group confirmation. Existing native GROUP became visible after the notification without timing/order changes.

Group timing inspection on isolated native layers: moving group [10,30] to [15,35] shifts child bounds and keys +5. IN [15,30] shifts child starts +5 while ends and keys remain; OUT [10,25] shifts child ends -5 while starts and keys remain. Group bounds are still read-only in the viewer; do not apply ordinary layer edit math to groups. These findings are for native setExtents in Designer 32.4, not an exhaustive GUI modifier-mode test.

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

SMALL/MEDIUM/LARGE apply browser-local 100/120/140 percent CSS zoom. viewer-ui-scale.js normalizes pointer and DOMRect coordinates to layout pixels, including popup placement. Track metadata always shows @ native FPS, then duration. TC IN: is a separate raw TransportManager.timecode readout, hidden when no source is assigned. Designer 32.4 exposes TimecodeTransport.current; newer timecode is a fallback. ViewerClock subscribes separately from the timeline clock and expires samples after two seconds; full snapshots provide a guarded fallback. Never substitute the timeline's TC-marker time for incoming TC. statusString remains the readout tooltip, including No clock.

Verification: native read-only inspection confirmed no assigned source on the current transport and current as a Timecode on an isolated LTC object. Actual incoming LTC/MTC signal has not been tested. Unit coverage includes removal, stale input and independence from timeline TC.
