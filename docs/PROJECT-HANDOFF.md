# Project handoff — beta.88

Read this file, DEVELOPER-MANUAL.md and VIEWER-DEVELOPMENT.md when resuming. Public source and release packages contain no development machine settings.

## Current state

Designer 32.4.17, Companion 5.0.5, Node 22.22.0. Module ID remains disguise-layer-control. Viewer port defaults to 8765, loopback only; enable LAN access for viewing a Raspberry Pi remotely. Import a new version under Modules and select it on the connection.

Native player.tCurrent is BEATS. All module/viewer timestamps and TransportCommand.makeJumpToTime inputs are SECONDS. Convert at every native boundary. This distinction was verified with a 128 BPM track: beat 128 equals 60 seconds. Never infer units from tests at 60 BPM alone.

Keyframe move steps on beat tracks: 1/128 through 1/2, 1, 4, 8 beats. Layer steps: 1/4, 1, 4, 8, 16, 32. Non-beat tracks retain frame/second steps. SELECT KEYFRAME stays locked when the timing step changes.

Audio: local WAV, supported embedded PCM MOV, Windows UNC with the OS session, or direct authenticated SMB3 via smb-client.js. No SSH/mount path is required. Read RASPBERRY-PI-SMB.md. Temporary SMB files are removed after decoding. Credentials belong only in Companion configuration/secret storage.

Waveforms use source duration, never layer duration. Pause clips at OUT; Loop/Ping-pong show one complete source (no repeated or reversed cycles). Playback labels use native enum metadata: audio and video assign different numeric values. Sticky/body playheads share position and transition.

## Validation and limits

Latest local suite and package smoke checks run during release. Live checks covered fractional key moves at 85/120/128 BPM, non-beat frame/second moves, seek feedback, Raspberry Pi authenticated SMB read and rendering of a 60-second WAV, and waveform zoom/clipping. Temporary native test edits were restored. This was targeted regression, not a fresh audit of every layer/device or a physical Stream Deck certification.

See KNOWN-LIMITATIONS.md for source waveform limitations, unsupported field types and large-project performance limits. Beat/bar labels assume 4/4. Direct guest SMB and arbitrary server policies remain unverified.

## Workflow

Inspect git status/diff and preserve unrelated work. Use targeted local batches to save credits; npm test and npm run package before release. npm run release -- -Force creates an allowlisted source/archive set. Never commit private probes, media, paths, credentials, machine IDs or real connection exports. Use generated Companion pages. Publish only when requested. Keep README download links, release tag and package versions aligned. User continues manual tests after this release.
