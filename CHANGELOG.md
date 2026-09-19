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
