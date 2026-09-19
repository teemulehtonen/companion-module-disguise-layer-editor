# Architecture

For a walkthrough of the files, state model and editing flows, see the [developer manual](DEVELOPER-MANUAL.md).

## Request flow

`definitions.js` maps controls to `editor.js`. `main.js` serializes actions and publishes displays. `client.js` sends HTTP requests; `designer-script.js` supplies Python that checks live state before writing inside Designer. `connection.js` polls feedback sequentially.

`timecode.js` handles frame labels, `theme.js` holds styling and `demo.js` supplies offline fixtures. Edit `scripts/build-page.cjs` to change the generated Companion page.

## Invariants

- UIDs stay strings; never use array order or JavaScript numbers as identity.
- Public times are seconds. Designer converts to/from beats; frame steps use actual FPS.
- `snapshot` is cached metadata. Recheck track, layer and bounds before writes; discard stale feedback and queued gestures.
- `selectedKeyTime` identifies an edit target. `moveKey` is the explicit SELECT KEY lock; displayed values still reflect the playhead.
- `clearKeysBrowser` and `clearKeysPrompt` retain the original layer identity. Confirmation must never redirect to another layer.
- Preflight defaults before bulk writes. `reset_sequence_to_constant` retains one carrier at IN and disables sequencing. This is not a rollback transaction if Designer fails mid-write.
- Resource browsing previews locally; applying changes only the typed reference, not the referenced object's settings.
- Layer/key timing stays within live bounds. POSITION carries the playhead. Navigation ends at IN or OUT minus one frame.

Action/variable IDs and the internal module ID `disguise-layer-control` remain stable for existing pages. Production feedback uses HTTP polling; LiveUpdate is retained only as an opt-in protocol test path.

## Updating integrations

The tested baseline is Designer 32.4.17, Companion 5.0.5 and Companion SDK 2.1.3. A future API version is not automatically compatible.

| Upstream change | Integration boundary | Validation |
| --- | --- | --- |
| Designer REST paths or response envelopes | `src/designer-api.js`, `src/client.js` | `test/client.test.js` |
| Designer native classes, metadata, sequences or time conversion | `src/designer-script.js` | Offline script assertions and live tests on a disposable track |
| Designer feedback / subscriptions | `src/connection.js` | `test/connection.test.js` and live selection tests |
| Companion SDK or instance lifecycle | `src/companion-api.js`, `src/main.js`, package and manifest SDK versions | `scripts/verify-package.mjs` exercises the bundled module with a host context |
| Companion actions, feedback or variable schemas | `src/definitions.js`, `src/main.js` | Definition tests and importing into the target Companion version |
| Companion page export format | `scripts/build-page.cjs`, `templates/button-style.json` | Import the generated page and test its controls |

Keep the Editor's seconds-based data model and stable action IDs unchanged when adapting a boundary. Update captured response fixtures and tests first, then test against the actual target applications. Do not silently retry writes or guess renamed native methods. Missing metadata or unsupported field types must remain visible in compatibility reports.

The heartbeat variable is a short pulse triggered by a validated Designer response. Its timer only extinguishes the pulse; it cannot fabricate connectivity.

Release packaging uses an explicit source allowlist and excludes local evidence. See [contribution checks](../CONTRIBUTING.md).
