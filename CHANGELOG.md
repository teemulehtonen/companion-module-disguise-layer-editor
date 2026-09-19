## 0.1.0-beta.88

## 0.1.0-beta.91

- Show source-media duration and video FPS below the layer type; remove seconds labels from waveform rows.

- Recognize direct AudioFile resources used by Tennis, alongside AudioTrack and VideoClip resources.
- Read WAV and embedded MOV audio directly over SMB without copying media to Raspberry Pi storage.
- Remove known legacy waveform temporary media; preserve unrelated files.
- Verified a 1.46 GB HAP video waveform on Raspberry Pi in about 2.4 seconds.


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
