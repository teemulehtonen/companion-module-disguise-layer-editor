# Changelog

## 0.2.0-beta.55

- Centre effect/precomp connection arrows on their visible source layer and separate overlapping paths by 8 pixels.
- Preserve collapsed-group routing and native Designer connections; display-only change.
- Validation: 286 offline tests and package checks passed; installed viewer script verified read-only.

## 0.2.0-beta.54

- Read TC IN from the selected transport monitor, including session-forwarded timecode when the local receiver reads zero.
- Follow transport selection, discard obsolete subscription values and show a dash when no timecode source is configured.
- Includes the audio placement, track-audio visibility, VIEW/FOLLOW, musical snap-grid and transport-switch fixes recorded below since the last published beta.43. Original peak-only waveform rendering is retained.
- Validation: 282 offline tests, package checks and read-only installed-Companion verification passed. No live Designer transport-switch or physical local timecode-input test was performed for this release.

## 0.2.0-beta.53

- Recover automatically when Designer GUI selection switches to another transport or temporarily has no track.
- Pin viewer reads to transport and track identity, discard late responses, and close obsolete clock subscriptions during resynchronisation.
- Show SYNCHRONISING during selection changes and back off failed snapshot reads instead of repeatedly querying Designer.
- Preserve native mutation guards; stale edit commands are discarded rather than replayed on the new transport.

## 0.2.0-beta.52

- Retain native beat-mode feedback when linked playback crosses time/BPM regions, so Companion timing choices update without a metadata refresh.

## 0.2.0-beta.51

- Increase timeline snap-grid contrast while retaining stronger major lines.
- All beat-mode timing buttons and encoder step selections now offer 1/96, 1/16, 1/12, 1/8, 1/6, 1/4, 1/3, 1/2, 1 and 4 beats.
- Default key timing is 1/96 beat. Snap grids support the same straight and triplet steps, with zoom selecting visible multiples; unsupported 1/128-beat snaps are rejected.

## 0.2.0-beta.50

- Build snap grid lines separately for native time and BPM regions, anchoring beat zero to each verified region origin.
- Follow the selected timing step and zoom, including fractional beats; drawing and snapping use the same grid.
- Revalidate native region, mode and beat/time mapping before accepting grid snaps. Unverified region mappings show a warning instead of guessed snap targets.

## 0.2.0-beta.49

- In VIEW mode with FOLLOW enabled, hide the blue edit cursor and its clock, and scroll the timeline with playback, without changing Designer time.

## 0.2.0-beta.48

- Replace the track audio visibility label with a compact waveform icon matching adjacent display buttons.

## 0.2.0-beta.47

- Add TRACK AUDIO as the first display-strip button to hide/show the complete track audio row without changing playback.

## 0.2.0-beta.46 (local Companion update)

- Revert beta.45 RMS calculation, additional waveform rendering and versioned energy cache at operator request due to loading delay.
- Reuse the original peak cache without clearing it. Preserve corrected audio placement and audio-local beat/bar markings.

## 0.2.0-beta.45 (local Companion update)

- Draw average audio energy (RMS) brightly inside subdued peak transients, preserving timing and source amplitude without artificial normalization.
- Start waveform beat/bar markings at the audio origin, leaving timed intros empty while preserving the main timeline ruler.
- Preserve more source samples when zoomed in. WAV and PCM MOV energy is computed during the existing streaming read without additional source-file passes.
- Version waveform summaries so cached peak-only previews are rebuilt once; thumbnails and source media are unchanged.

## 0.2.0-beta.44 (local Companion update)

- Place the current track-audio waveform at its native audio-local beat-zero origin instead of track time zero, preserving timed intros.
- Include track-audio placement and identity in redraw invalidation. Missing placement is shown explicitly instead of guessing zero.
- Layer waveform positioning and all Designer edit commands are unchanged.

## 0.2.0-beta.43

- Update viewer edits immediately while preserving guarded native writes and rejecting stale feedback. Improve seek ordering, wheel/drag curves, multi-key previews and whole-layer movement without transient geometry jumps.
- Keep header keyframe curves synchronized, preserve scroll during edits, add the wheel value popup and move help into the information popup. UI sizes are 100/120/140 percent.
- Fix creation/duplication outside the current unlinked edit time by selecting the new layer's IN through the shared clock policy.
- Add reusable installed-Companion integration tests with an independent Designer oracle, focused regression groups and contributor instructions. Extend native marker, section and whole-layer default checks.
- Validation: 251 local tests, package checks, 1,128 detached native assertions and 34 installed cases passed. Two FIT TO CONTENT cases skipped for durationless Video/Bitmap resources; Audio FIT passed. A single native ThumbnailSystem ACCESS_VIOLATION was reported after testing; its cause remains unresolved. See KNOWN-LIMITATIONS.md.

## 0.2.0-beta.26

- Add repeatable offline, native Designer and read-only installed Companion regression stages with local JSON reports and no AI requests.
- Fix exact layer-boundary beat conversion roundoff affecting parameter edits at tempos such as 123 BPM.
- Validation: 209 unit tests, packaged Companion checks and 516 detached native assertions; see docs/REGRESSION-TESTS.md for scope.

## 0.2.0-beta.25

- Add one-shot CLEAR MEDIA CACHE setting for local waveform disk data and connection thumbnail/waveform memory. Select and save, then reload viewers. Does not delete source media or Designer data.
- Persist thumbnails with native identity revalidation under the same 100 MiB quota as waveform summaries. Unknown identities are fetched directly.
- Validation: 209 local tests and two native thumbnail identity checks.

## 0.2.0-beta.24

- Persist waveform summaries on the Companion host with a 100 MiB quota, revision-aware identity, corruption fallback and explicit refresh invalidation. No source media is copied.
- Validation: 207 local tests; physical Pi restart not tested.

## 0.2.0-beta.23

- NEXT reaches exact OUT and never steps backward from an OUT key. Key and layer selection remain valid at this editing boundary, where playback has ended.
- Refresh contributor, GitHub, build and developer guidance for independent development. Earlier 0.2 beta changes and their validation are recorded in docs/PROJECT-HANDOFF.md.
- Validation: 204 local tests, packaged module checks and an isolated native Designer OUT navigation check.

## 0.2.0-beta.2

- Shift-drag selects keys on one parameter row with a turquoise marquee. Move/delete groups through the shared editor. Mouse uses the grabbed member as anchor; Stream Deck uses the first key. Group value/type changes are disabled. Native group writes validate bounds, identity and collisions before modification.

## 0.2.0-beta.1

- Start the 0.2 beta series from 0.1.0-beta.159. No runtime behavior changes.
- Includes shared mouse/Stream Deck editing, numeric wheel edits and curve previews, snap targeting, keyboard shortcuts, earlier FOLLOW scrolling and hover timecodes.
- Publish the module, clean Plus/XL pages, install/source bundles and checksums.

## 0.1.0-beta.151

- Split SNAP toggle from its target-only dropdown. Add S/F/T/L/Shift+L keyboard shortcuts (ignored in text inputs and with modifiers) and footer hint.

## 0.1.0-beta.148

- Remove passive alignment guides. Show snap guides only for object/section targets, not time or beat grid targets. Objects sharing a grid time retain their guide.

## 0.1.0-beta.147

- Keep the final drag preview until fresh geometry arrives and update every parameter display copy after confirmed edits.
- Move layer edges, keys, curves and visible waveforms together during whole-layer previews. IN/OUT trims preserve key times and update clipping.

## 0.1.0-beta.146

- Increase drag timecode labels from 11 px to 13 px.

## 0.1.0-beta.145

- Throttle extra native drag-curve sampling to 10 Hz per parameter while retaining validation on every write and local animation-frame previews. Reapply the newest pointer preview after delayed acknowledgements to avoid visual rollback.

## 0.1.0-beta.144

- Add parameter gear and reset controls. Enable sequencing at the active edit time using the native current value; confirmed disable clears every key and preserves the evaluated value. Confirmed reset clears keys and restores Designer's default. Numeric, enum and resource sequences use the same guarded native path.

## 0.1.0-beta.143

- Show compact destination timecodes while dragging keys, resource keys, markers and layer bounds; whole-layer moves show IN and OUT. Native TC anchors keep preview updates local.
- Highlight duplicate CUE, MIDI and TC values in red across the track. Compare within each type, normalize numeric padding and TC separators, and allow repeated NOTES.

## 0.1.0-beta.142

- Start direct layer-bar drags through explicit IN selection, including layers outside the current editing time.
- Marker popup positions now use Designer-native timecode mapping, including TC offsets. Entered destinations resolve inside the guarded native edit, using the original marker as the reference for repeated timecode labels.

## 0.1.0-beta.141

- Show and edit marker track positions as HH:MM:SS:FF using track FPS. Unchanged displayed time preserves the original exact position; invalid frame/minute/second fields are rejected.

## 0.1.0-beta.140

- Right-click or double-click cue, TC, MIDI and notes markers to edit their content and track-relative time in seconds, or delete the selected marker. Native source checks and locks remain enforced; unrelated co-located markers are preserved.

## 0.1.0-beta.139

- Clicking a layer OUT point now seeks to its exact end time. Keyframe navigation retains its last-visible-frame boundary policy.

## 0.1.0-beta.138

- Fix timeline seek when no layer is selected: preserving two absent selections must not enter the existing-layer resource refresh branch. Covers linked and independent editing clocks.

## 0.1.0-beta.137

- Include visible parameter rows when revealing the selected layer. If the expanded layer exceeds the viewport, follow the selected parameter instead; account for sticky timeline/audio headers and preserve manual scrolling between selection changes.

## 0.1.0-beta.136

- Press the first dial in normal mode to toggle LAYER/ZOOM while a viewer is active. Rotate to zoom around the editing playhead; other editing modes retain their controls.
- Reveal the selected layer vertically when selection changes, without overriding manual scrolling on routine refreshes.

## 0.1.0-beta.135

- Add a maintained Stream Deck XL page: adaptive steps, playback-state highlights, section controls and a permanent timecode keypad with automatic separators.
- Add PLAY LOOP to presets and viewer; add guarded CUT/MERGE SECTION at active edit time.
- JUMP validates Designer-native timecodes and respects linked/unlinked editing.
- Include both pages in every install bundle and preserve all preset feedback options in generated exports.

## 0.1.0-beta.132

- Consolidate beat-step catalogs and labels, tidy timing code/tests and update developer handoff. 169 local tests and packaged lifecycle checks pass.

- Clicking a layer name or timeline bar selects it and seeks to IN. LINK TIME moves Designer transport; unlinked mode moves only the editing cursor. Parameter selection and drag gestures retain their existing behavior.

## 0.1.0-beta.131

- Enlarge Companion display headings and primary values. Remove VALUE /, TIME / and MOVE KEYFRAME / prefixes to leave room for precision and timing steps.

## 0.1.0-beta.130

- Expand time-based steps to ten: frame, 0.5/1/2/5/10/30 seconds and 1/2/5 minutes. Presets and dial cycling share the same order; beat choices are unchanged.

## 0.1.0-beta.129

- Add ten adaptive timing-step preset slots with live labels, selected-state feedback and inactive unused slots. Time/beat choices follow track and key/layer editing mode.
- Add standalone play, play to section end, stop, toggle, previous/next section and LINK TIME presets for additional decks.
- Include the beta.128 viewer transport controls.

## 0.1.0-beta.128

- Add a compact transport icon group before layer creation: previous section, play, play to section end, stop and next section.
- Space toggles playback using the last successful play mode. Ignore typing, open popups, modifiers and key repeat.
- Transport commands remain independent of the unlinked editing clock.

## 0.1.0-beta.127

- Add shared LINK TIME and an independent blue editing cursor/clock; mouse and Stream Deck use the same active edit time.
- Improve direct keyframe, value and resource editing, stale-target guards, insertion, deletion and categorical parameter display.
- Add layer creation, rename, duplicate, delete and group-safe reordering.
- Replace the default PLAY SECTION context pad with LINK TIME; keep the standalone playback action.
- Show snap/alignment guides only during adjustments; refresh duplicate extents without changing timing.
- Update user/developer handoff documentation. 165 local tests and package checks pass; live verification is targeted, not exhaustive.

## 0.1.0-beta.102

- Add optional mouse editing through the same Companion command queue, selection, locks and timing steps. Disabled by default.
- Add a compact folder/file picker for media and internal resources, with native metadata and refreshed Designer version/trim information.
- Add shared keyframe interpolation, resource write mode and bulk-delete confirmation controls.

## 0.1.0-beta.101

- Highlight true timeline alignments with a brighter solid line; never snap or alter times.
- Require exact time coincidence for every guide and include group boundaries. Verify 96 pair/FPS combinations.

## 0.1.0-beta.100

- Centre zoom buttons and Ctrl+wheel on the playhead, within track view bounds.

## 0.1.0-beta.99

- Keep keyframes at the exact native layer OUT visible in curves, resource rows and group summaries. Keys after OUT remain hidden.

## 0.1.0-beta.98

- Restrict keyframe guides to the selected parameter and comparisons against other layers only.

## 0.1.0-beta.97

- Add faint selected-layer keyframe alignment guides during Layer Edit and Select Keyframe. Exclude hidden out-of-layer keys and subframe near misses.

## 0.1.0-beta.96

- Always show exact IN/OUT guides for the selected layer in Layer Edit, for all layer types. Keep keyframe-edit guides match-only.

## 0.1.0-beta.95

- Show the currently evaluated media name, duration and FPS; resource keyframe changes follow the playhead. Prefer video thumbnails over palettes.
- Show source-media duration and video FPS below the layer type; remove seconds labels from waveform rows.

- Recognize direct AudioFile resources used by Tennis, alongside AudioTrack and VideoClip resources.
- Read WAV and embedded MOV audio directly over SMB without copying media to Raspberry Pi storage.
- Remove known legacy waveform temporary media; preserve unrelated files.
- Verified a 1.46 GB HAP video waveform on Raspberry Pi in about 2.4 seconds.


## 0.1.0-beta.88

- Correct native beat/second conversion in Companion, live feedback and viewer timing.
- Add fractional beat keyframe movement down to 1/128 beat and separate layer-edit steps.
- Add direct SMB3 network waveform reads on Raspberry Pi and Windows session-based UNC reads.
- Decode supported PCM audio embedded in single-fragment MOV media.
- Keep waveform source duration during zoom. Pause clips to layer OUT; Loop and Ping-pong show the full source.
- Show native NORMAL/LOCKED labels and endpoint icons on timeline layers; simplify AUDIO mode labels.
- Synchronize playhead animation across fixed header rows and layers.
- Add beat/bar waveform grids, compact waveform height controls and zero-based beat labels.
- Hide keyframe markers outside layer extents and correct short-layer edge placement.

## 0.1.0-beta.52

- Fixed timeline headers, section shading and clickable annotation markers.
- Current cue/MIDI/note details and frame-aware section countdown.
- Timeline layer selection and centred FIT LAYER with 4% margins.
- Developer handoff and large-keyframe stress observations.

## 0.1.0-beta.37

- Add an experimental timeline viewer with native curves, resource thumbnails, groups and relationship arrows.
- Add browser selection, timeline seeking and per-layer visibility controls.
- Keep live values and selection responsive while geometry refreshes.
- Add cached local WAV source previews; direct SMB remains experimental and embedded video audio decoding is not supported.

# 0.1.beta — 0.1.0-beta.16

- New numeric keyframes explicitly default to SMOOTH. Updating an existing keyframe preserves its interpolation type.
- Resource browser SOURCE press switches REPLACE / KEYFRAME. Confirming a preview or pressing a thumbnail in KEYFRAME mode creates a timed resource change while preserving the preceding constant.
- Added the developer manual covering implementation, data flow and maintenance.

# 0.1.beta — 0.1.0-beta.14

- Uppercase control displays, larger LCD headings and a centred PARAMETER heading.
- Friendly layer-type labels share the LAYER heading's font size and colour. Keyframe buttons use the full word; timing hints use KF followed by direction arrows.
- Larger keyframe indicator, compact parameter bounds and a Designer-response heartbeat on PLAY SECTION.
- Parameter navigation stops at the first and last entry.
- Healthy metadata synchronisation no longer changes the connection to Connecting.
- Constant-only Designer fields ignore keyframe creation instead of sending an invalid command.
- Centralised REST and Companion SDK integration boundaries, with an upgrade guide in the architecture document.
- All shipped presets are included in the preset groups.
- Prevent cached or delayed polling feedback from reverting the state after a control action.
- Confirmed layer defaults are harmless when there are no supported parameters.
- Live compatibility coverage for all 76 Add Layer types; see [Track 6 report](docs/TRACK-6-TESTS.md).

# 0.1.beta — 0.1.0-beta.1

- Initial Disguise Layer Editor beta; anonymous source and commit metadata.
- Live numeric, enum and typed-resource editing; automatic HTTP feedback.
- Key selection, movement, deletion and confirmed parameter/layer default resets.
- Layer timing, native timecode, resource browsing and section playback.
- Git source contains only development files and documentation; installers, shortcuts, obsolete fixtures and generated pages are excluded.
- Concise English instructions and documented limitations. See [test report](docs/TRACK-1-TESTS.md).
