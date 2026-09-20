# Repeatable local regression tests

These scripts make no AI/model requests. Running them directly requires no AI credits. AI-assisted script development, diagnosis or report review is separate. Node.js/npm and dependencies must be installed as described in BUILD.md.

From the repository root:

```sh
node scripts/regression.cjs
```

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
