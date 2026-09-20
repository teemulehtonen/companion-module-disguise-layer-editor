# Current release — beta.143

Drag labels use viewer_snapshot.dragTimecodes (segment starts, native TC seconds and a probe label to identify drop-frame numbering) and the shared browser timecode formatter. No native calls per pointer event. Labels are disposable and removed on pointer release/cancel, Escape or redraw. Duplicate marker highlighting uses all annotation tags, grouped by type; NOTES are excluded. Public helper viewer-marker-duplicates.js is embedded in the viewer and unit tested.

Supersedes track-relative marker popup times: annotation_time reads a native label via resolve_timecode(time); annotation targetLabel resolves within annotation_edit against current TC segments. Unchanged times keep exact seconds. Direct layer-bar drag selects point=in before entering layer edit, matching click semantics for inactive layers.

Marker popup track-relative time uses HH:MM:SS:FF (shared timecode formatter, fractional FPS conversion). Leaving the formatted field unchanged preserves the original subframe position. This is track-relative time, distinct from the TC marker's content.

Marker popup includes current track-relative seconds and DELETE. Changed time uses the existing guarded move command; unchanged time updates content. Native deletion verifies source text/time and removes only that tag type or note, preserving the cue/section and other tags. All four types passed add/move/delete on an isolated native track (seven assertions).

Explicit viewer OUT clicks seek to layer.end exactly, superseding the old OUT-minus-one-frame policy for that gesture. Active layer bounds include OUT so focus remains on the layer after feedback/refresh; covered in linked and independent clock tests. Previous/next key navigation retains its own last-visible-frame policy.

Refresh's preserve-selection branch requires an actual layer. Undefined previous/current layer and parameter IDs otherwise compare equal and crash on mediaFields before viewer seek. Regression covers empty tracks with both linked and independent clocks. Reproduced against Designer and verified fixed at the current native time.

Selection reveal includes visible parameter rows. viewer-selection-scroll.js is embedded into the browser bundle and tested as a pure geometry function: fit the entire layer block when possible, otherwise reveal the chosen parameter (fall back to the layer header). Reveal identity includes track, layer and parameter. Manual scroll remains unchanged until selection changes.

The normal first dial toggles LAYER/ZOOM while a browser has polled the viewer within three seconds. ViewerServer owns a cumulative zoom counter, consumed once per browser through the lightweight live channel; rotation never writes Designer data. Browser reload/visibility changes reset the cursor to prevent replay. Existing resource, layer-edit and selected-key modes keep their normal routing. Closing the viewer expires zoom mode. Zoom uses the existing active-playhead-centred browser function. After draw, a changed track/layer identity reveals its header vertically, accounting for sticky annotation/audio rows; routine redraws retain manual scroll.

XL uses larger 25% control text and 60% numeric keys. Timecode stays on one line at 17%. The keypad is an eight-digit shift register: explicit leading zeros are accepted, excess input replaces the oldest digit, BACK removes the newest, and pressing the time display clears input. Keep numeric input local; only JUMP refreshes Designer context.

Validation: 175 local tests and package checks passed; seven isolated native section checks preserved notes and layer timing. Native timecode resolution was verified without seeking. The XL page is installed on Companion page 5 using the existing connection. Numeric input is local and bypasses stale-selection refresh; JUMP refreshes and validates the original track before resolving time.

Maintain both generated Companion pages through scripts/build-page.cjs. The XL export shares preset definitions and Plus typography; never maintain a hand-exported page containing user settings. The builder must preserve feedback options (timing slot / playback operation) and both foreground/background overrides. test/xl-page.test.js guards these contracts. release.ps1 includes both pages in the install ZIP; GitHub releases must attach both page assets.

The rightmost three XL columns are a fixed numeric keypad. Editor.enterTime owns bounded input, track identity, inline validation and native timecode resolution. resolve_timecode is read-only: native TC parsing plus segment candidate validation against beatToTimecode; ambiguous repeated labels choose nearest edit time. Final seek uses existing linked/unlinked policy.

Section edits use native splitSectionAtBeat/mergeSectionAtBeat on the current guarded track, reject locks, and preserve tags/notes. Native isolated checks covered cut, merge, initial boundary no-op and note preservation. PLAY LOOP uses /api/session/transport/playloopsection. Successful play mode is shared by presets/viewer/Space and refreshed from guarded REST transport feedback.

# Previous release — beta.132

Validation: 169 local tests and packaged lifecycle checks passed. This release consolidates timing catalogs and labels; no broad native layer or playback matrix was run.

Plain layer name/bar clicks explicitly select point=in, including inactive layers. Parameter labels remain restricted to active edit time. The existing shared seek path routes to Designer while linked or blue edit time while unlinked; drag preparation remains unchanged.

# Beta.131 — clearer LCD labels

Companion headings use 90% of the text element height; primary values use 78%. Value title shows only precision, and time title only step plus FPS, including selected-key mode. The larger keyframe dot sits next to PARAMETER in normal mode. Existing installed pages need the corresponding style update or a clean page import; module updates alone only change variable text. Ten time steps from beta.130 are included.

# Beta.130 — ten time steps

Time presets and dial cycling use ten ordered entries: frame, 0.5/1/2/5/10/30 seconds and 1/2/5 minutes. TIME_STEP_LABELS centralizes labels. Persisted preset slot IDs remain unchanged; labels/actions adapt to the new order. Beat-mode catalogs are unchanged.

# Beta.129 — adaptive presets

Editor.timeStepChoices is the shared ordered step catalog; setTimeStep selects a slot without seeking or releasing the key/layer mode. definitions.js exposes ten adaptive presets and transport/link controls, while main.js publishes timing_step_0–9 and selection/availability/transport feedback on every publish. Unused slots are no-ops. Transport controls bypass delete-menu dial routing so STOP remains available. Presets use connection-scoped variables and can be placed on other decks without changing the generated page.

Validation: 168 local tests and packaged lifecycle checks passed. Installed beta.129 on Companion; both preset groups were visible. Viewer transport and add-layer buttons all measure 24 px high, with no browser errors. No broad native playback matrix was run for this update.

# Beta.128 — compact transport controls

Viewer transport controls use the shared queue and guarded native transport identity, with HTTP paths isolated in designer-api.js. PLAY/PLAYSECTION/STOP use the flat transport reference envelope; section jumps use the nested reference envelope. State is read immediately before toggle. Last successful PLAY or PLAYSECTION mode is shared in Editor and retained through stop; initial mode is PLAYSECTION. These controls always affect real Designer transport, leaving unlinked edit time intact. Space is handled only within the viewer document, excluding input/contenteditable fields, popups, modifiers and repeat.

Targeted client/editor tests passed; Designer live playback was not exercised as part of this small UI update.

# Historical release — beta.127

Authorized for GitHub publication. Installed on Raspberry Pi: beta.127. Uses separate editing/transport clocks, green Designer time and smaller blue edit time. Stale unlinked refresh no longer calls a write-context guard; background timecode samples retain the edit-time label. 165 local tests pass, including updated expectations for LINK TIME and active-time layer selection. Source/package publication excludes private probes, credentials and local media. Final browser check verified a Deck time step at blue 00:00:00:01 independently of the real transport, idle guides absent, browser errors empty and Companion last_error empty. LINK TIME restored ON after verification. Read the beta.125 notes below as the current timing specification; beta.122–124 policies are superseded.

# Beta.125 — separate editing clock

Supersedes beta.123/124 timing policy. Editor.time is the active editing clock; Editor.transportTime is actual Designer feedback. LINK TIME defaults ON. Unlinked mouse seeks, marker clicks, key navigation and Deck time rotation move only edit time; native editTime/keepPlayhead keep parameter evaluation and writes at that time without transport commands. Layer selection is filtered at edit time. Switching LINK TIME clears key/layer/resource/delete modes, adopts actual transport time and never seeks Designer. Track changes reset the editing cursor to the new track time. Stale tokens include unlinked edit time.

Viewer shows a blue edit cursor and a smaller blue clock below the green transport clock while unlinked. FOLLOW/zoom use the active editing clock. Extra alignment guides appear only during mouse movement or briefly after Deck adjustment. Ordinary time grid stays visible.

DUPLICATE reapplies identical native extents to trigger the same update path as layer timing edits; isolated verification confirms extents and key times remain unchanged. Immediate appearance in the external Designer UI still requires user acceptance.

Validation: 15 focused local tests, package smoke checks and a bounded isolated native batch covering numeric/resource insertion away from transport, movement and duplicate timing preservation passed. No broad live matrix; no Git publication.

# Beta.124 — shared LINK TIME

Supersedes beta.122 PIN TIME. LINK TIME defaults ON in the shared Editor. Both mouse and Stream Deck key/layer editing follow transport while enabled. When disabled, scoped edit commands preserve transport and retain the edited layer even outside the playhead. Explicit seeks, PREV/NEXT KEYFRAME navigation and the normal time dial still move transport. The browser toggles server-owned state through a validated token-protected link_time command; every viewer observes that same state. The setting is session state and resets ON at module startup.

Validation: 16 focused local tests passed, covering both modes, switching modes during key selection, Deck key/value/layer controls, explicit seek, normal time rotation and deletion regressions. The normal context pad 3 now toggles LINK TIME instead of playback, with active color following the shared setting. Resource and clear-menu pad behavior is unchanged; the explicit play_stop action remains available. Native timing commands are unchanged from beta.122. No broad live test or Git publication.

# Beta.122 — pinned editing and layer deletion

PIN TIME beside FOLLOW defaults on. Viewer selection and edits pass a request-scoped keepPlayhead flag; native selection/key/layer commands retain the real transport position. Explicit timeline/marker seeks still seek. Turning PIN TIME off retains the previous seek/follow editing behavior. Edited inactive layers remain selected until an explicit seek, layer change or track change; transport feedback remains authoritative.

Layer context menu adds DELETE after DUPLICATE. Delete removes a selected key first; a directly selected layer can otherwise be deleted with Delete. Parameter-only selections, text inputs, open menus and resource browsing do not fall through to layer deletion. Native deletion validates track, UID, name, extents and lock state, then uses track.removeLayer. Removed targets are not reselected.

Validation: 162 local tests and package smoke checks passed. An isolated native batch checked both PIN TIME states for numeric and Video/Mapping/Palette resource key movement, layer move/IN/OUT, and guarded deletion of Video/Audio/Bitmap. This is targeted regression, not every-layer certification. Installed locally on Raspberry Pi; Git publication remains paused.

# Beta.121 — clickable constant resources

Unsequenced resource values, including NONE, open the parameter-specific picker when clicked in the value column or resource card. They use existing selection in REPLACE mode, without inserting keys. Carrier cards absorb double-clicks to avoid accidental insertion. Verified in the live browser with Video NONE and resource controls for Mapping/Palette/Output/CDL; no browser errors. Local Raspberry Pi update, no Git publication.

Layer name drag reorders vertically, with a drop line; clip drag still edits time. Reorder validates exact sibling UID order and remains within the same parent. Native root and grouped-leaf ordering were tested without changing extents or group membership. Whole groups also reorder among their siblings, preserving all children.

# Beta.120 — layer creation, context menu and group-safe ordering

An edit-only +VIDEO/+AUDIO/+BITMAP group sits before FIT TRACK. New layers start at the clicked playhead time, last 10 seconds or 4 beats on beat tracks (quarter-beat start), and clamp to track end. Right-click a layer label/bar for RENAME, DUPLICATE or FIT TO CONTENT. Native duplicateLayer preserves Designer-owned layer data. Rename/duplicate/fit validate track, UID, name and bounds; locked layers reject edits. Empty-resource FIT returns unchanged rather than calling unsafe native resourceDuration. New/copied layers are selected through the shared Editor. 159 local tests plus isolated Video/Audio/Bitmap operation and stale-target checks passed. No Git publication.

# Beta.117 — compact value popup

Click a parameter value or right-click a numeric/list key to open its compact value editor. Numeric values use an input and APPLY; enums use native option buttons. The selected key is edited, or the closest visible key when opening an animated parameter value without a current selection. Constants stay constant. There is no new toolbar. value_set reuses adjustLiveValue / native adjust_value with an absolute target, metadata validation, expected key and expected scalar value checks. Popup tokens are captured on open to reject later Deck selection changes. Native and 156 local tests passed; publication remains paused.

# Beta.116 — categorical parameter lanes

Native options and booleans are marked discrete. Viewer renders named state intervals and time-only key handles instead of curves; interpolation menus and numeric vertical dragging are disabled for those handles. Designer writes/interpolation are otherwise unchanged. Curve sampling is skipped for discrete fields. Unknown enum mappings remain explicitly UNKNOWN. Native metadata audit covered 93 classes and 155 list fields with no errors; three unmapped fields belong to RenderStreamModuleBase. 155 local tests passed. This is metadata coverage, not playback certification. Git publication remains paused.

# Beta.115 — project-relative resource folders

Resource catalogs use PROJECT as their common display root. Only the native parameter-compatible catalog is included. Project paths are made relative to Designer's project directory; external resources are grouped under PROJECT/External without exposing drive/share/machine hierarchy. Native resource paths and UIDs remain unchanged. 153 tests and native Video/Mapping/Palette catalog checks passed. Local update only.

# Beta.114 — final-key deletion

Deleting the final animation key now uses Designer's constant-carrier representation, disables sequencing and preserves the evaluated value/resource instead of rejecting deletion or restoring defaults. Expected-key and layer-lock guards still apply; no confirmation is required for a single selected key. Numeric and Video/Mapping/Palette resource cases passed isolated native checks; 153 automated tests passed. Local Raspberry Pi update only; Git publication remains paused.

# Project handoff — beta.113 local candidate

Beta.113 is installed on the Raspberry Pi; Git publication remains paused for acceptance. Blank-lane double-click uses one guarded key_insert request. It pins the clicked time across delayed native transport feedback, creates the first numeric key, or opens the parameter-specific resource picker in insertion mode. Existing resource-key replacement remains separate. Clicking an inactive layer now seeks to its IN and selects it; active-layer clicks preserve time. Selection accounts for a pending seek rather than stale native time. All resource thumbnails disable browser-native image dragging so resource keys can move from either their image or label.

Validation: 152 automated tests and package smoke checks passed. Live insertion produced numeric and resource keys at requested times while preserving existing resource keys. Inactive selection and resource time movement were independently checked against Designer. Actual browser resource drags from the label and thumbnail preserved the resource identity; final native readback matched, browser error log and Companion last_error were empty. These are targeted regressions, not an exhaustive layer certification. Private probes and test media are excluded from publication.
# Project handoff — beta.108 local candidate

Beta.108 is installed on the Raspberry Pi for local acceptance; no Git publication. Confirmed edits patch the browser's layer model immediately. Key handles read mutable data-key-time identities, including header/resource markers, rather than captured render-time timestamps. Completed drags redraw from confirmed state. Server edit revisions reject older live/geometry responses, and heavy geometry polling pauses during gestures/writes. Missing keys and out-of-bounds keys have distinct messages; do not select an arbitrary nearby key to hide stale state.

Mouse gestures preview locally with requestAnimationFrame and coalesce to one in-flight write plus the latest pointer. Numeric time/value updates use one guarded native key_move; resources accept time only. Preview curves temporarily deform native samples and are replaced by bounded Designer-evaluated samples on confirmation. This is a preview, not an independent cubic interpolation implementation. Companion encoder commands do not incur preview sampling. Resource folder rows have arbitrary depth and no synthetic ROOT button.

Validation: 149 automated tests, packaged smoke checks and native combined/grid/resource checks passed. A live Raspberry Pi batch exercised 14 moves with immediate re-selection, numeric Video/Audio fields, resource identity preservation and actual Companion VALUE endpoints. All final results matched direct Designer reads. Measured command round-trip median 74 ms, maximum 204 ms in that batch (not a general performance guarantee). Actual browser numeric time/value and resource-time drags were also checked; marker rows matched and browser errors were empty. UI frame rate was not benchmarked. QA RESPONSIVE test layers remain for manual testing. Private probes/results stay outside publication.

Beta.107: explicit viewer selections cancel prior edit/menu modes using guarded shared commands (never confirm deletion); normal Deck lock rules remain. Drag responses include bounded Designer-evaluated curve samples, updating only the active SVG path without waiting for the full geometry poll. All sequenced numeric/resource key targets are collected including collapsed layers; keyframes within 10 px take priority over grid lines. Same-sequence collisions remain non-destructive and do not overwrite another key. 147 tests, package smoke checks and isolated native snap/marker/resource checks passed.

Beta.106 adds TIME / BEAT GRID to SNAP (enabled by default). Only visible native grid ticks participate; grid density follows zoom. Native writes verify the grid step, track quantization mode and beat-to-time mapping before accepting the snap. This applies to keys, layer edges/moves and annotation drags, with Alt bypass. Validation: 147 tests, package smoke checks and isolated native time-grid/stale-grid checks passed.

Beta.105 is installed locally for acceptance; Git publication remains paused. Resource folders are horizontal, non-wrapping rows by depth; only the selected branch's children appear below it. Virtual parent folders navigate without changing the server resource selection or showing unrelated files. Folder navigation was checked in a browser fixture.

Explicit mouse key selection sends the clicked source time, rather than selecting nearest to asynchronous transport feedback. Selecting another key releases the previous shared lock through the guarded commands. Numeric curve dragging updates time and value with one in-flight operation and coalesced pointer positions; value changes reuse Editor.adjustLiveValue and native expected-key/bounds checks. Encoder behavior remains unchanged.

Validation: 147 automated tests and packaged smoke checks passed. Live Video/Brightness, Audio/Volume and Blur/Radius tests used mouse key selection/dragging and actual Companion VALUE rotation endpoints. All final key times/values were independently read from Designer and matched viewer state; Companion last_error and browser JavaScript errors were empty. Three QA MOUSE test layers were left in the user-authorized track for manual acceptance. This is targeted regression, not exhaustive layer or device certification.

Beta.103 is a local candidate for user acceptance; do not publish until approved. The top editing toolbar is removed. Direct left-button selection/dragging uses the shared Editor timing/key operations, Delete removes the selected key, double-click adds a key, and a key's right-click menu contains HOLD/LINEAR/CUBIC. Escape releases the edit. Resource-key clicks open the native parameter-specific catalog, including internal resources; existing-key replacement uses an expected-key guard and retains its time. Resource sequences now participate in shared key selection/movement/deletion.

SNAP ON beside FIT LAYER opens category choices (layer edges, keyframes, markers, sections). Alt bypasses snapping. Pointer timing uses the existing native edit operation with an absolute requested position: native beat/frame steps apply unless snapping to a verified existing landmark. Native layer/key bounds and expected-target checks still apply. Mouse drags coalesce to the latest pointer position with one write in flight. Alignment guides also update during mouse edits.

CUE/TC/MIDI/NOTES rows support double-click creation/editing and dragging. Writes use main.perform and native setTagAtBeat/setNoteAtBeat; moving one tag never removes the entire cue or its other tags/section. Source text/time guards reject stale moves and same-type destination collisions. No automatic retries.

Validation completed: 145 automated tests passed; packaged smoke checks passed; isolated Designer checks for all four marker types, numeric/resource key moves, stale marker/collision rejection and native snapping. Resource metadata inspection covered 93 native module classes and 215 resource fields without errors (not a functional certification of every layer). Browser fixture exercised direct key drag, interpolation menu, Delete, double-click insertion, note creation and snapping a note to a cue. No user track contents were changed by those native checks. Beta.103 is installed and selected on the Raspberry Pi Companion connection; viewer LIVE state and preserved editing permission were checked, with no browser JavaScript errors or Companion last_error. Git publication is paused for user acceptance.

Read this file, DEVELOPER-MANUAL.md and VIEWER-DEVELOPMENT.md when resuming. Public source and release packages contain no development machine settings.

## Current state

Designer 32.4.17, Companion 5.0.5, Node 22.22.0. Module ID remains disguise-layer-control. Viewer port defaults to 8765, loopback only; enable LAN access for viewing a Raspberry Pi remotely. Import a new version under Modules and select it on the connection.

Native player.tCurrent is BEATS. All module/viewer timestamps and TransportCommand.makeJumpToTime inputs are SECONDS. Convert at every native boundary. This distinction was verified with a 128 BPM track: beat 128 equals 60 seconds. Never infer units from tests at 60 BPM alone.

Keyframe move steps on beat tracks: 1/128 through 1/2, 1, 4, 8 beats. Layer steps: 1/4, 1, 4, 8, 16, 32. Non-beat tracks retain frame/second steps. SELECT KEYFRAME stays locked when the timing step changes.

Audio: local WAV, supported embedded PCM MOV, Windows UNC with the OS session, or direct authenticated SMB3 via smb-client.js. No SSH/mount path is required. Read RASPBERRY-PI-SMB.md. SMB WAV/MOV readers seek directly in the remote file and never write media to local disk. Credentials belong only in Companion configuration/secret storage.

Waveforms use source duration, never layer duration. Pause clips at OUT; Loop/Ping-pong show one complete source (no repeated or reversed cycles). Playback labels use native enum metadata: audio and video assign different numeric values. Sticky/body playheads share position and transition.

## Validation and limits

Latest local suite and package smoke checks run during release. Live checks covered fractional key moves at 85/120/128 BPM, non-beat frame/second moves, seek feedback, Raspberry Pi authenticated SMB read and rendering of a 60-second WAV, and waveform zoom/clipping. Temporary native test edits were restored. This was targeted regression, not a fresh audit of every layer/device or a physical Stream Deck certification.

See KNOWN-LIMITATIONS.md for source waveform limitations, unsupported field types and large-project performance limits. Beat/bar labels assume 4/4. Direct guest SMB and arbitrary server policies remain unverified.

## Workflow

Inspect git status/diff and preserve unrelated work. Use targeted local batches to save credits; npm test and npm run package before release. npm run release -- -Force creates an allowlisted source/archive set. Never commit private probes, media, paths, credentials, machine IDs or real connection exports. Use generated Companion pages. Publish only when requested. Keep README download links, release tag and package versions aligned. User continues manual tests after this release.

## Latest beta.95 details

- Network audio must never be copied to local storage. Both WAV and PCM MOV decode from seekable read-only handles; only waveform peaks are cached in bounded memory. smb-client.js uses pinned smb3-client 0.2.0 internals for byte-range reads. Recheck that adapter when upgrading the dependency.
- audio-temp-cleanup.js removes only legacy source.wav files inside matching d3-wave temporary directories; it does not recursively delete other content.
- The viewer displays the currently evaluated media resource name, source duration and source video FPS. Long names retain both ends. Resource selection is evaluated at the playhead; do not substitute the first resource key.
- Layer rows are 52 px; shared corner controls use a 4 px top inset. Thumbnail failures are evicted from the server cache and browser images retry up to three times.
- Generated Resources buttons omit folder labels and allocate more space to filenames. Import the generated page into the existing editor page and link the existing connection; never assume the destination page number.
- Final automated validation: 130 tests plus packaged-module smoke checks. Live Raspberry Pi checks confirmed both WAV and embedded PCM MOV waveforms. A read-only inventory covered 76 layer types; five AudioFile resources decoded locally. These checks do not certify every resource/playback mode.
- The latest user continues manual testing. Keep future changes targeted and avoid repeating broad live tests without a relevant change.

Beta.96: Layer Edit always displays selected-layer IN/OUT guides, at exact source times (including subframe beat boundaries). Other modes retain their previous match-only keyframe guides. Regression: test/viewer-alignment.test.js.

Beta.97 adds subtle match-only guides for all sequenced keys in the selected layer during Layer Edit/Select Keyframe. Source keys outside layer bounds are excluded; subtle matches require coincident time, not merely the same frame bucket.

Beta.98: keyframe alignment targets only context.parameter in the selected layer. Compare against other layers only; never count the selected layer’s own keys or boundaries.

Beta.99: native keyframes may sit exactly at layer OUT. Viewer key visibility is inclusive of IN and OUT; keys strictly outside remain hidden. This does not change transport playback’s exclusive OUT behavior.

Beta.100: zoom buttons and Ctrl+wheel centre on state.time (playhead), clamped to track view bounds. FIT LAYER remains layer-centred.

Beta.101: alignment counts only coincidences within 1 microsecond across different layers, including group IN/OUT. Matched guides are solid and brighter; unmatched Layer Edit boundaries remain dashed. No snapping. test/viewer-alignment.test.js covers 96 boundary/key/resource/group/FPS pairs plus subframe near misses and nonmutation.

Beta.102: ALLOW VIEWER EDIT is opt-in. viewer-editor.js validates a shared-state fingerprint and delegates to existing definitions.js actions inside main.perform(). Browser drags are relative encoder steps (12 px per step); never implement separate beat/frame math. Resource picker uses native resource_items for every supported resource parameter, server-owned indices, and UID equality checks. /api/resource-list batches 64 items; metadata refreshes at most once per 2.5 seconds while a picker is open. Native VideoClip.transportDuration supplies trimmed clip duration; enabledVersion selects the current version filename where unambiguous. Source files are never modified. Browser selection, file lists and native interpolation were tested; continuous physical mouse drags and all layer/device combinations were not certified.

Beta.102 final verification: 142 automated tests and packaged-module smoke checks passed. Browser fixture covered a 130-item library, folder changes and selecting item 99. Native read checks covered audio, output, mapping, palette, video and CDL lists. An inactive native test layer verified HOLD/LINEAR/CUBIC; a temporary clip verified trim duration changes without modifying source frame count. Installed Companion integration verified browser-to-Companion and Companion-to-browser precision changes, native audio/output listing, and an empty last_error. No broad live playback or physical Stream Deck certification was performed.
