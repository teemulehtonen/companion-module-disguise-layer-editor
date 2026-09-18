# Architecture

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

Release packaging uses an explicit source allowlist and excludes local evidence. See [contribution checks](../CONTRIBUTING.md).
