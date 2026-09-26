# Disguise Layer Editor — 0.2.beta

Disguise layer, keyframe and resource control for Bitfocus Companion and Stream Deck +.

**Experimental beta, provided as-is without warranty.** Back up projects and test before live use. See [disclaimer](DISCLAIMER.md), [limitations](KNOWN-LIMITATIONS.md) and [security](SECURITY.md). Independent integration; not endorsed by Disguise, Bitfocus or Elgato.

## Install

**Downloads (0.2.0-beta.69):** [Companion module](../../releases/download/v0.2.0-beta.69/disguise-layer-control-0.2.0-beta.69.tgz) · [Stream Deck + page](../../releases/download/v0.2.0-beta.69/D3-Stream-Deck-Plus.companionconfig) · [Stream Deck XL page](../../releases/download/v0.2.0-beta.69/D3-Stream-Deck-XL.companionconfig) · [Yamaha CC1 page 8](../../releases/download/v0.2.0-beta.69/D3-Yamaha-CC1.companionconfig) · [Yamaha CC1 transport page 9](../../releases/download/v0.2.0-beta.69/D3-Yamaha-CC1-Transports.companionconfig)

Tested with Designer 32.4.17 and Companion 5.0.5.

1. Enable Designer's HTTP/Python API on a trusted network.
2. In Companion, import `disguise-layer-control-<version>.tgz` under **Modules**. Add **Disguise Layer Editor** and enter the Designer host and port (default 80).
3. Import `D3-Stream-Deck-Plus.companionconfig`, choose a destination page and link the connection. Import replaces that page; export it first if needed.
4. Assign Stream Deck + to that page. **HTTP + SYNC** indicates automatic feedback.

With the viewer open, press the first dial in normal mode to switch **LAYER / ZOOM**. Zoom follows the active editing playhead. Selecting another layer scrolls it into view; closing or hiding the viewer expires zoom mode after three seconds.

## Stream Deck XL

Import **D3-Stream-Deck-XL.companionconfig** into one chosen page and map it to the existing d3layers connection. The 8 × 4 layout shares the Plus font/theme: ten adaptive time/beat steps on the left, a permanent 7–9 / 4–6 / 1–3 keypad on the right, and BACK / 0 / JUMP on its bottom row. The entered time is zero-padded with automatic colons; press its display to clear. JUMP uses Designer timecode mapping and LINK TIME selects the real or independent edit clock. Invalid entries do not seek.

PLAY, PLAY TO END, PLAY LOOP and STOP highlight their active state; PREV/NEXT SECTION and CUT/MERGE SECTION are above them. CUT splits at active edit time; MERGE removes the current section boundary, preserving tags and notes. LINK TIME has its own highlight. Unavailable beat slots are dark and inert.

All page exports are generated and tested on every release. Importing a page replaces that destination page only; preserve any custom layout first.

## Yamaha CC1

Import **D3-Yamaha-CC1.companionconfig** to Companion page 8 and map it to the existing d3layers connection. This clean 8 × 7 export reproduces the operator layout from the reference Companion: eight context keys, Stream Deck + displays, RC1–RC4 controls, RC5 viewer zoom, RC6 timeline time, previous/next track and section controls, jog lock and playback. Its page button opens the page 9 transport selector.

The motor fader follows the selected Disguise transport and writes its brightness and volume together. See [Yamaha CC1 setup](docs/YAMAHA-CC1.md) for the custom-variable, trigger and motor-target settings.

## Additional Stream Deck presets

In Companion **Presets**, select this connection and drag buttons from **Adaptive timing steps** or **Transport and time linking** onto any page or Stream Deck. Timing slots automatically follow the current track and editing mode: frame/seconds on time tracks, beats in BPM regions. All beat modes share 1/96, 1/16, 1/12, 1/8, 1/6, 1/4, 1/3, 1/2, 1 and 4 beats. The selected step is highlighted; unused slots display a dash and do nothing. Selecting a step keeps the selected key/layer editing mode.

Transport presets provide PLAY, PLAY TO END, PLAY LOOP, STOP, PLAY / STOP (last play mode), PREVIOUS/NEXT SECTION, PREVIOUS/NEXT TRACK and LINK TIME. Track navigation affects the transport currently open in the editor, independently of the CC1 master-fader target.

## Controls

| Encoder | Turn | Press |
| --- | --- | --- |
| LAYER | Select an active layer | — |
| PARAMETER | Select a parameter / page through the list | Open the parameter list |
| VALUE | Edit the selected key or constant | Cycle COARSE / FINE / ULTRA |
| TIME | Seek, or move the locked key | Frame / 0.5 / 1 / 2 / 5 / 10 / 30 seconds / 1 / 2 / 5 minutes |

- **SELECT KEYFRAME** locks the nearest in-range key; press again to unlock. TIME step changes keep it locked. **PREV/NEXT KEYFRAME** follow the selected parameter and stop at exact IN / OUT. OUT is the end of the final displayed frame; a key may remain selected there although playback has ended.
- **DELETE KEYFRAME** removes one key. With a constant, **DEFAULT** restores its native default. Hold either for one second to open the delete menu; red indicates ready. Bulk operations require confirmation. **DEFAULT ALL PARAMETERS** resets all supported parameters on the selected layer, including animation outside IN/OUT.
- On beat-based tracks, SELECT KEYFRAME timing steps are 1/128, 1/64, 1/32, 1/16, 1/8, 1/4, 1/2, 1, 4 and 8 beats. Layer-edit steps are 1/4, 1, 4, 8, 16 and 32 beats. Displays remain timecode.
- **LAYER EDIT** assigns IN / POSITION (centre) / OUT / FIT to the encoders. Press LAYER EDIT again to return.
- **RESOURCES** assigns SOURCE / FOLDER / RESOURCE / BACK. Press SOURCE to switch **REPLACE / KEYFRAME** for animatable resources. REPLACE edits the current resource; KEYFRAME schedules the preview at the playhead, preserving the earlier value. Press RESOURCE to apply and return; thumbnails apply directly in the selected mode. Reopening starts in REPLACE. BACK cancels browsing.
- New numeric keyframes default to **SMOOTH**; existing key types are preserved. Resource keyframes are discrete switches, not crossfades.
- **LINK TIME** (on by default) links editing to Designer playback time. Turn it off to use the independent blue editing cursor from either the viewer or Stream Deck. Turning it on adopts Designer time and clears edit locks without seeking playback. The standalone playback action remains available. Float increments are 0.1 / 0.01 / 0.001. Absolute times use Designer's native timecode.

## Timeline viewer

The transport icon group before +VIDEO provides previous section, PLAY, PLAY TO END OF SECTION, STOP and next section. Space toggles playback using the last selected play mode while the viewer has focus; typing and open popups are excluded. Transport controls always affect Designer, independently of LINK TIME.

Enable **ENABLE TIMELINE VIEWER** in module settings and open `http://127.0.0.1:8765`. Select layers/parameters, seek from timeline points, and inspect native curves and resource thumbnails. Optional **ALLOW VIEWER EDIT** enables shared Companion editing and a compact resource picker; it defaults to off. [Viewer guide and limitations](docs/TIMELINE-VIEWER.md).

For network audio on Raspberry Pi, enter the SMB share and credentials in module settings. No SSH or OS mount is needed. [Network audio setup](docs/RASPBERRY-PI-SMB.md).

## Latest beta

`0.2.0-beta.69` adds previous/next-track presets for the transport open in the editor and packages the operator's clean Yamaha CC1 page 8 together with the page 9 transport selector. It also includes faster interpolated playback timecode, bounded dial input, jog locking, transport-master motor feedback and the timeline improvements from beta.56–68.

Validation: 316 offline tests and package checks passed with the clean page 8 export included. The Raspberry Pi runs beta.69; Designer track navigation was not triggered during verification.

## Build

Use Node.js 22.22.0:

```sh
npm ci
npm test
npm run package
```

Windows: `npm run release` creates archives in `releases/0.2.beta`. To replace a local build, use `npm run release -- -Force`. Module and page files are generated outputs, excluded from Git.

[Build details](docs/BUILD.md) · [Developer manual](docs/DEVELOPER-MANUAL.md) · [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Test report](docs/TRACK-6-TESTS.md)

Anyone may fork, modify and redistribute this project under the MIT license; contributions are welcome through pull requests. Start with [Contributing](CONTRIBUTING.md) for a complete development entry point. The internal module ID remains `disguise-layer-control` for compatibility.

[Resume development](docs/PROJECT-HANDOFF.md) · [Viewer architecture](docs/VIEWER-DEVELOPMENT.md)

[Repeatable local and native regression tests](docs/REGRESSION-TESTS.md): run `node scripts/regression.cjs` without AI calls; native tests are opt-in.

### Yamaha parameter list (beta.78)

Press the parameter-name display to replace all three LCD rows with 12 parameters. Turn the parameter encoder to move one page at a time; press a parameter to select it and restore the normal controls. Empty slots do nothing. The current parameter is highlighted. The list uses cached fields; the normal stale-context check still refreshes when necessary. The value display now cycles COARSE / FINE / ULTRA; use the explicit Add keyframe action to insert a key. Resource and layer-timing contexts retain their existing press functions. Existing PARAMETER buttons must use the new Open parameter list / select parameter action.

On Yamaha CC1, pressing the third physical encoder adds a keyframe at the playhead. The value LCD button separately cycles COARSE / FINE / ULTRA (or selects a parameter while the list is open).

Set **OSC fader 1–8 display name** in the module connection settings to name each OSC target. Blank names retain OSC FADER 1–8. Names appear on selector buttons and the selected fader display; addresses /vehka/fader1–8 and remembered values do not change.

Numeric encoder sensitivity (beta.80): COARSE / FINE / ULTRA use 1% / 0.1% / 0.01% of the parameter range per effective step. On 0–1 these are 0.01 / 0.001 / 0.0001. Unbounded floating-point parameters use the same fallback steps. Explicit step overrides remain unchanged; integer parameters still move by at least one.
