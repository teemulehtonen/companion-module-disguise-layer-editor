# Yamaha CC1 display queue correction

Local surface-driver build: **0.5.1-beta.2**, based on
[bitfocus/companion-surface-yamaha-cc1](https://github.com/bitfocus/companion-surface-yamaha-cc1)
commit `4270bc71a60f879ab2b769359eb5da19acd02620` (0.5.0).
This is a local patch, not an upstream release.

The original draw handler appended every image's serial tiles to an unbounded
promise chain. Two 25 fps clocks can produce images faster than the paced serial
writer sends them. Later page images, colours and motor/LED messages then wait
behind obsolete images.

The patch allows one in-flight LCD paint and one latest pending image per key.
Pending images keep fair key order. Aborted draws are discarded before painting.
Shutdown drops pending images. Status cards use the same bounded path. The
existing tile format, 4 ms pacing, backpressure, handshake and input mapping remain.
An already-started image finishes; a whole page still requires physical transfer.

## Rebuild and verify

In a checkout of the pinned upstream commit, apply `latest-paint.patch`, then:

```sh
corepack yarn install --immutable
corepack yarn build
corepack yarn test
corepack yarn check
corepack yarn package
```

The reusable upstream test command now includes the paint queue regressions:
1,000 pending updates replaced by a new 12-key page, one in-flight paint,
fairness, restarting after idle, close and recovery after a failed paint.
Protocol and existing surface/layout checks also run. The package includes
Linux ARM serial bindings for Raspberry Pi.

On Windows, module-tools 3.1.0's external-install-util.js uses execFile('yarn'),
which cannot launch the Yarn command shim in this environment. The local build
used process.execPath plus Corepack's JavaScript entrypoint and the same Yarn
arguments for that call. This build-tool adaptation is outside the shipped
surface runtime and is not included in the patch.

Install the resulting `yamaha-cc1-0.5.1-beta.2.tgz` as a surface module. Select it
on the existing Yamaha integration while disabled, then enable the integration.
Preserve the existing surface ID, page group and fader variable bindings. Keep
0.5.0 installed as the rollback version.

## Validation scope

TypeScript build, protocol checks, layout/lifecycle checks, queue regression,
manifest/license checks and package build passed. Installed read-only probes
previously confirmed version 0.5.1-beta.1, connected CC1, and unchanged surface and group
configuration. This does not measure physical end-to-end latency; operator
testing of page changes and colour changes remains required.

## Motor fader recall correction

The combined patch also includes MotorFader and its regression tests. Only
touched physical movement is published as faderPosition; automatic motor travel
is ignored. Motor targets received while held are retained and applied on release.
This separates channel-value recall from user input and preserves per-channel OSC
values. No surface IDs, page mappings or transfer-variable IDs change.

On Windows the package external-install call also uses direct Node/Corepack
execution to avoid PowerShell yarn.ps1 policy and quoted-executable parsing.
This local build-tool adaptation is not included in the shipped driver patch.

Installed beta.2 verification: Yamaha connected, existing surface settings and
page-group settings unchanged. Physical OSC-channel recall has not been tested.
