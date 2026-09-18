# 0.1.beta (0.1.0-beta.1)

First beta release under the Disguise Layer Editor name. Version numbering restarts at 0.1.0-beta.1. Earlier entries below describe development history, not published beta tags.

- Realtime numeric, enum and resource editing with Stream Deck + controls.
- Selected-key editing, nearest-key selection, bounded navigation and layer timing controls.
- Designer selection feedback, layer ordering and automatic timeline synchronisation.
- Automatic sequential HTTP polling for Designer 32.4.17. Production LiveUpdate subscriptions are disabled after isolating repeated native subscription errors to that connection; feedback remains automatic.
- Clean source distribution, documented editing invariants, locked build dependencies and SHA-256 checksums.
- Stable action IDs retained for existing Companion configurations.
- NEXT KEY without a following key stops at OUT minus one frame using the actual track FPS, keeping the layer visible.
- DELETE KEY: short press deletes one key; hold for one second and release opens DELETE ALL KEYS. Rotate PARAMETER to choose one animated value or resource parameter, then DELETE and confirm DELETE / CANCEL. No multi-selection or review step. Current values and resource references remain as constants.
- Press SELECT KEY again to release the selection lock without moving the playhead.
- Designer highlighting no longer keeps an inactive layer selected after a playhead change. Key locks are released when leaving the layer; no active layers means an empty selection.
- NEXT/PREV reads the Designer selection immediately before navigation and discards obsolete jump anchors after a mouse selection change.
- Entering an overlap no longer treats an unchanged Designer highlight as a new selection; repeated PREV at IN stays on the same layer.
- Encoder layer selection snapshots the existing Designer highlight so delayed initial feedback cannot override the user's encoder choice.
- Key movement uses current IN/OUT bounds and clamps again after seconds-to-beats conversion; frame-rate and post-selection trim regressions are covered.
- Absolute display times use Designer's native TC-marker conversion, including playhead, layer bounds, midpoint and key positions. Durations retain relative time.

Known limitations are documented in KNOWN-LIMITATIONS.md. The alpha is based on the tested 0.3.35 behaviour, with confirmed parameter animation clearing added in this update.
- DELETE ALL KEYS uses a black BACK button background.
- DELETE KEY displays LONG PRESS DELETE ALL; after one second a red indicator signals that releasing opens the menu.
- Timeline and layer timing step cycle: 1 frame, 1 s, 2 s, 5 s, 10 s, 1 min.
- Removed Demo mode from the connection settings UI.
- DELETE ALL includes keys outside IN/OUT and disabled sequences with stored animation; the remaining constant is anchored at IN.
- Delete menu offers DELETE ALL (keep current value) and DELETE ALL + DEFAULT (restore native Designer default), each with separate confirmation.
- Completed one-second DELETE hold turns the main button background red as well as its small indicator.
- NEXT/PREV and key-distance displays ignore constant carrier keys when sequencing is disabled, even when their stored time is inside the layer.
- VALUE displays the evaluated Designer value, including between keyframes, instead of replacing it with the preceding key value.
- Constant parameters show DEFAULT instead of DELETE KEY; release restores the native default, with a live guard against unconfirmed animation deletion.
- SELECT KEY is inactive with its normal group colour without sequenced keys inside the layer; constant carriers cannot move the playhead.
- Unified muted functional group colours, clearer teal active state and consistent tool-label sizing. DEFAULT centres itself when no hold hint is needed.
- Constant parameters cannot be moved as keys; live removal of sequencing releases key selection.
- Track 1 regression testing: empty timeline/media actions and unsupported FIT are harmless; resource browsers exclude generated thumbnail cache entries.
- Occupied keyframe destinations are no-ops; stale gestures after a Designer selection change are discarded without button error status.
- Alpha.28 removes personal maintainer/copyright names and live test identifiers from distributable sources; private evidence and local scripts are excluded from Git. Adds GitHub setup and contribution instructions.
- Alpha.29: TIME press cycles all time steps while SELECT KEY remains locked; press SELECT KEY again to unlock.
- Alpha.30: DEFAULT ALL PARAMETERS in the clear menu resets every numeric/enum/resource parameter on the selected layer, including constants and keys outside IN/OUT. Explicit confirmation is required; long-press DEFAULT also opens the menu.
- Alpha.31 adds prominent no-warranty alpha notices and deployment/security documentation; the standard MIT License is retained unchanged.
