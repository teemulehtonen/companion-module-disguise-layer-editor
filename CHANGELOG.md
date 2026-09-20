# Changelog

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
