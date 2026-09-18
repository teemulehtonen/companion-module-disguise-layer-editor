# Reading and changing the code

Start with `src/editor.js`: it holds the selected track, layer, parameter, key and UI mode. It does not know about Companion APIs. `src/definitions.js` maps Companion actions onto its methods; `src/main.js` owns the Companion lifecycle, ordered action queue and display variables.

## Follow one action

1. A button or encoder invokes an action from `definitions.js`.
2. `main.js` serializes it so detents and writes stay in order.
3. `editor.js` resolves the current selection and chooses an operation.
4. `client.js` sends a validated HTTP request. `designer-script.js` builds the Python executed inside Designer.
5. The Python checks track/layer identity and live bounds immediately before modifying the project. Returned state updates the editor and button variables.

`connection.js` polls feedback sequentially, without overlapping requests. Production LiveUpdate subscriptions are disabled for the tested Designer version. The optional protocol path remains for isolated tests.

## Important names

- `snapshot`: the latest full track/parameter metadata received from Designer.
- `selectedKeyTime`: the current key edit target, which is not necessarily the interpolated playhead value.
- `moveKey`: the explicit SELECT KEY lock. TIME rotation moves it; TIME press changes the step; SELECT KEY again unlocks.
- `clearKeysBrowser`: the layer-bound delete menu and its selected parameter.
- `clearKeysPrompt`: a pending confirmation with the original target identity. Cancellation does not write anything.
- `mediaMode`: the typed resource browser, including Mapping, Palette and Output references.

## Default and delete operations

Single-parameter clear and layer-wide defaults share preflight validation. The server discovers supported fields, resolves defaults/current values before writing, then calls `reset_sequence_to_constant` for each field. Designer retains one carrier key at IN with sequencing disabled. This removes animation, including keys outside trimmed bounds, without leaving an invalid empty sequence.

Preflight prevents known validation errors from producing a partial reset; it is not a transaction or rollback guarantee if Designer itself fails during a write. Text sequences and the internal settings of referenced resources are outside the supported reset scope.

## Other modules

`timecode.js` contains frame-rate and timecode formatting; `theme.js` contains colours and font sizes. `demo.js` is the isolated fake Designer used in offline tests. `scripts/build-page.cjs` generates the importable Companion page; edit the generator rather than the generated JSON.

Keep operation IDs and the internal module ID stable for existing Companion pages. The product name is Disguise Layer Editor; the compatibility identifier remains `disguise-layer-control`.

Read [architecture and invariants](ARCHITECTURE.md), run the tests described in [CONTRIBUTING.md](../CONTRIBUTING.md), and add a regression test for behaviour changes. Builds never operate a live Designer project.
