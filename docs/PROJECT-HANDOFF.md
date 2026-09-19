# Project handoff — beta.102

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
