# Repeatable CC1 regression tests

Run node scripts/regression.cjs from the repository root. The default run discovers
every test/*.test.js file and builds, smoke-tests and generates clean Companion pages.
Use --unit-only to skip packaging, --list to list groups, or
--group=layers,keyframes for focused coverage. Groups are layers, keyframes, timing,
resources and companion. Shared guards remain included in focused runs.

Every behavior change needs regression coverage. Logs and reports stay in ignored
.tools; failures and skipped cases must be reported. Tests make no AI/model calls.

## Current scope

Offline coverage exercises Companion actions, layer/parameter/key selection,
precision, time/beat conversion, LINK TIME, transport recovery, OSC memory and
payloads, motor-target feedback, twelve LCD slots, Designer zoom and thumbnail cache.
cc1-only.test.js checks that legacy web settings cannot start a listener and that
removed native commands cannot be sent. Python fixtures validate generated script
syntax, native key movement and parameter steps without contacting Designer.

Browser-only tests were removed with the web editor. Shared clock, transport,
LINK TIME, content-refresh and cache tests remain under CC1-oriented filenames.
The former web-based --installed runner is removed and fails explicitly if requested.
It is not a replacement for physical-device verification.

## Authorized native tests

Only with explicit operator authorization, run:

    node scripts/regression.cjs --native --host=127.0.0.1 --port=80

This creates detached temporary tracks in Designer and blocks transport writes.
The harness creates its own Video/Audio/Bitmap fixtures, then exercises retained
production CC1 commands at time/60/120/123 BPM: sections, numeric precision, keys,
interpolation, encoder moves, OUT boundaries, layer timing, defaults and resources.
It no longer tests removed web pointer/group/annotation/layer-management commands.
Missing resources remain explicit SKIP results; uncertain mutations are never retried.

For a separate read-only installed Companion variable probe:

    node scripts/regression.cjs --unit-only --companion=http://companion-host:8000 --label=d3layers

That reads variables; it does not press buttons or prove installed native writes.
Actual Yamaha buttons, encoders, LCD latency, motor travel, OSC receiver delivery
and show playback require separate operator checks. The serial driver has its own
regressions in support/yamaha-cc1/latest-paint.patch, independent of this module.

Layer-list coverage: layer-browser.test.js checks twelve slots in LIVE/VIEW, paging,
empty/inactive layers, unlinked time and exact OUT, label feedback, stale lists,
fresh-read races, context changes and preserved media/timing presses. These are
offline Companion actions and reads; no installed button or native mutation test.
