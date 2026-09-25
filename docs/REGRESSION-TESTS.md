# Repeatable local regression tests

These scripts make no AI/model requests. Running them directly requires no AI credits. AI-assisted script development, diagnosis or report review is separate. Node.js/npm and dependencies must be installed as described in BUILD.md.

From the repository root:

```sh
node scripts/regression.cjs
```

For subsequent changes, reuse the same runner instead of writing a new probe:

```sh
npm run test:regression -- --list
npm run test:regression -- --group=layers,keyframes --unit-only
npm run test:regression
```

Groups are `layers`, `keyframes`, `timing`, `resources`, `viewer`, and `companion`.
Shared state, command-validation and VIEW safeguards remain included in focused runs.
The default `all` discovers every `test/*.test.js`, including newly added files.
`--unit-only` skips packaging; it does not imply integration or release validation.
Logs are collected per stage; results are printed together at the end. Failing stages
return a nonzero exit code without hiding the other stages' results.

## Maintaining coverage

For every behavior change or bug fix:

1. Add or extend a regression case with an independent expected result. Reproduce
   the old failure before changing the assertion or implementation.
2. Use the existing feature's test file. If adding a file, ensure its name matches
   the appropriate group in `scripts/test-plan.cjs`; extend that map when necessary.
3. For native timing/resource changes, extend `scripts/native-regression.py`.
   Test non-60 BPM and time tracks; verify native objects rather than echoed responses.
4. For installed command/state changes, extend `scripts/installed-regression.cjs`.
   Register created UIDs immediately, protect original layers, and report unavailable
   resources as SKIP. Never retry an ambiguous mutation automatically.
5. Run the focused group first, then the full local suite and package checks before
   release. Run the relevant integrations when their environment is available.
6. Record actual results and remaining gaps in PROJECT-HANDOFF.md. A passing focused
   run does not certify untested features or hardware.

Future features are not tested automatically by name: their assertions must be added
as part of development. The reusable runner eliminates rebuilding the test procedure.

## Installed Companion integration (mutating)

```sh
node scripts/regression.cjs --installed --viewer=http://companion-host:8765 --designer=http://designer-host:80 --track=TESTI2
```

This explicitly authorizes a mutating integration run on the named, already active
test track. It stops playback and creates its own Video, Audio and Bitmap fixtures.
Use an expendable test track outside a show. Test layers remain for inspection.
Writes go through the installed Companion viewer/shared editor and verification
reads Designer objects independently. Source media is not copied or changed.
The runner rejects a different active track, does not retry uncertain mutations,
and checks that original layer names, bounds and parents remain unchanged.
It does not restore playback, every prior selection, or certify physical controls.
Results and the created UID journal are in `.tools/installed-report.json`.

This runs all offline unit tests and builds/tests the real packaged Companion module and clean pages. The package test invokes exported Companion actions with a synthetic host and demo data, including value changes, key creation, long-press deletion UI, timing and presets.

To additionally run native integration tests against your own Designer:

```sh
node scripts/regression.cjs --native --host=127.0.0.1 --port=80
```

Designer must be running with its HTTP/Python API enabled. Run only with operator authorization, preferably outside a show. Native tests create detached temporary tracks in Designer memory, never save a project file or switch the active track, and explicitly reject transport writes. They use the production `makeScript` command generator, with only its transport-manager binding replaced by a temporary-track adapter. Fixtures are removed afterwards.

The matrix covers VIDEO, BITMAP and AUDIO on time tracks and 60/120/123 BPM tracks: create, constant value, coarse/fine/ultra, numeric key creation/type/movement, exact OUT, boundary and stale-state rejection, layer movement, IN/OUT, native defaults, multi-key moves/deletes, last-key deletion, compatible resource assignment/key/move/delete, duplicate, rename and delete. Resource tests use existing project resources without copying media. Missing media is reported as SKIP. Native objects are read independently to verify command results. Native layer endpoint rounding is checked against an independent native reference layer, not assumed to match an ideal floating-point time.

For a read-only check of an installed Companion connection, append:

```sh
node scripts/regression.cjs --native --companion=http://companion-host:8000 --label=d3layers
```

Replace the address and label with your own. This reads the installed connection's error, time and layer variables. It does **not** press hardware buttons or prove that mutations traveled through that installed Companion instance. Native mutation checks and packaged Companion action checks are separate test stages. UI pointer gestures, live playback, actual media output, SMB throughput, physical reboots and device latency still require separate tests.

Reports and full logs go to ignored `.tools/`. Nonzero process exit means failure. Native details are in `native-regression-report.json`; stage summaries are in `regression-report.json`. Reports may contain native error details: inspect/sanitize before sharing. A timeout does not retry mutations. Test results certify only the cases run, the source revision and available environment.

Keep this test matrix updated when changing behavior. Do not weaken assertions to hide discrepancies. New native APIs may require an adapter change in the harness; script generation fails if its expected manager-binding hook is missing.

## Feature coverage map

| Area | Repeatable coverage | Remaining environment checks |
| --- | --- | --- |
| Layer create/rename/duplicate/delete, IN/OUT/move | Native matrix and installed Video/Audio/Bitmap scenarios | Other native layer classes |
| Group/reorder/ungroup | Installed scenarios and group unit tests | Large/nested project hierarchies |
| Numeric/resource keys, multi-selection, types, clear/default | Native matrix, installed scenarios, key/sequence unit tests | Every project-specific resource class |
| Time/beat, tempo conversion, OUT, steps, keypad | Native matrix, timecode/keypad/preset tests | Actual external TC input |
| Markers, sections, snap | Native marker/section matrix; viewer snap/marker tests | Pointer gestures and show-specific tempo maps |
| Transport modes and LINK TIME | Transport/client/pin-time tests; installed unlinked edits | Live show playback and physical Deck controls |
| Resources and thumbnails | Installed assignment, disk-cache and server tests | Availability of each project's media |
| Waveform, embedded PCM, SMB, disk cache | Audio/waveform/cache unit tests | Real server permissions and network throughput |
| Viewer curves, optimistic edits, selection, scroll, scaling | Viewer presentation/gesture/curve/scale tests | Browser FPS, GPU and physical screen inspection |
| VIEW protection, stale targets and network errors | Shared safeguards, installed rejection cases | Third-party API changes |
| Module and Plus/XL page artifacts | Package smoke tests and page/preset tests | Custom imported user layouts |

This is a coverage index, not a claim that every combination is proven. Keep missing
resources visible as SKIP and preserve failure reports when fixing a defect.

## Yamaha surface-driver display queue

The locally installed Yamaha surface 0.5.1-beta.1 fixes display backlog independently
of this module. See [the patch and repeatable driver tests](../support/yamaha-cc1/README.md).
Run the driver's existing yarn test command after queue changes; it covers the
protocol, layout/lifecycle and bounded latest-image queue. The root module's offline
suite does not test the separate Yamaha serial driver. Hardware page/colour latency
was accepted by the operator after installation; no numeric latency was measured.
Navigation presets: test/navigation-presets.test.js covers shared persistent mode,
native IF/ELSE structure in both directions, matching section actions in ELSE branches,
VIEW transport guards and unchanged original presets. These are offline tests;
they do not navigate installed hardware or Designer.

OSC faders: osc-fader-presets.test.js checks eight fixed transport slots plus eight
OSC slots, exact typed float SDK arguments, channel value isolation, motor-target
publication, batched persistence, invalid input and VIEW guards, and switching
while a transport write is pending. Package smoke reloads saved OSC configuration
without network sends. connection.test.js checks the eight-transport cache cap.
Yamaha motor-fader.test.ts checks untouched motor echo suppression and deferred
recall on release; the source/tests are preserved in support/yamaha-cc1/latest-paint.patch.
These are offline tests with a mocked Companion OSC sender, not receiver or
physical motor verification.

Designer zoom: designer-zoom.test.js runs the generated Python UI command against
an offline PrivateState fixture and tests the encoder/queue/VIEW contract. A
separate installed read-only capability probe confirmed the API exists; this is
not a physical encoder test or native Designer zoom mutation test.
