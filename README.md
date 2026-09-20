# Disguise Layer Editor — 0.1.beta

Disguise layer, keyframe and resource control for Bitfocus Companion and Stream Deck +.

**Experimental beta, provided as-is without warranty.** Back up projects and test before live use. See [disclaimer](DISCLAIMER.md), [limitations](KNOWN-LIMITATIONS.md) and [security](SECURITY.md). Independent integration; not endorsed by Disguise, Bitfocus or Elgato.

## Install

**Downloads (beta.159):** [Companion module](../../releases/download/v0.1.0-beta.159/disguise-layer-control-0.1.0-beta.159.tgz) · [Stream Deck XL page](../../releases/download/v0.1.0-beta.159/D3-Stream-Deck-XL.companionconfig) · [Companion page](../../releases/download/v0.1.0-beta.159/D3-Stream-Deck-Plus.companionconfig)

Tested with Designer 32.4.17 and Companion 5.0.5.

1. Enable Designer's HTTP/Python API on a trusted network.
2. In Companion, import `disguise-layer-control-<version>.tgz` under **Modules**. Add **Disguise Layer Editor** and enter the Designer host and port (default 80).
3. Import `D3-Stream-Deck-Plus.companionconfig`, choose a destination page and link the connection. Import replaces that page; export it first if needed.
4. Assign Stream Deck + to that page. **HTTP + SYNC** indicates automatic feedback.

With the viewer open, press the first dial in normal mode to switch **LAYER / ZOOM**. Zoom follows the active editing playhead. Selecting another layer scrolls it into view; closing or hiding the viewer expires zoom mode after three seconds.

## Stream Deck XL

Import **D3-Stream-Deck-XL.companionconfig** into one chosen page and map it to the existing d3layers connection. The 8 × 4 layout shares the Plus font/theme: ten adaptive time/beat steps on the left, a permanent 7–9 / 4–6 / 1–3 keypad on the right, and BACK / 0 / JUMP on its bottom row. The entered time is zero-padded with automatic colons; press its display to clear. JUMP uses Designer timecode mapping and LINK TIME selects the real or independent edit clock. Invalid entries do not seek.

PLAY, PLAY TO END, PLAY LOOP and STOP highlight their active state; PREV/NEXT SECTION and CUT/MERGE SECTION are above them. CUT splits at active edit time; MERGE removes the current section boundary, preserving tags and notes. LINK TIME has its own highlight. Unavailable beat slots are dark and inert.

Both pages are generated and tested on every release. Importing a page replaces that destination page only; preserve any custom layout first.

## Additional Stream Deck presets

In Companion **Presets**, select this connection and drag buttons from **Adaptive timing steps** or **Transport and time linking** onto any page or Stream Deck. Timing slots automatically follow the current track and editing mode: frame/seconds on time tracks, beats on quantized tracks, with finer fractions while moving keys. The selected step is highlighted; unused slots display a dash and do nothing. Selecting a step keeps the selected key/layer editing mode.

Transport presets provide PLAY, PLAY TO END, PLAY LOOP, STOP, PLAY / STOP (last play mode), PREVIOUS/NEXT SECTION and LINK TIME. They share state with the viewer.

## Controls

| Encoder | Turn | Press |
| --- | --- | --- |
| LAYER | Select an active layer | — |
| PARAMETER | Select a parameter | Coarse / fine / ultra |
| VALUE | Edit the selected key or constant | Add a key at the playhead |
| TIME | Seek, or move the locked key | Frame / 0.5 / 1 / 2 / 5 / 10 / 30 seconds / 1 / 2 / 5 minutes |

- **SELECT KEYFRAME** locks the nearest in-range key; press again to unlock. TIME step changes keep it locked. **PREV/NEXT KEYFRAME** follow the selected parameter and stop at IN / OUT minus one frame.
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

## Build

Use Node.js 22.22.0:

```sh
npm ci
npm test
npm run package
```

Windows: `npm run release` creates archives in `releases/0.1.beta`. To replace a local build, use `npm run release -- -Force`. Module and page files are generated outputs, excluded from Git.

[Build details](docs/BUILD.md) · [Developer manual](docs/DEVELOPER-MANUAL.md) · [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Test report](docs/TRACK-6-TESTS.md)

MIT licensed. The internal module ID remains `disguise-layer-control` for compatibility.

[Resume development](docs/PROJECT-HANDOFF.md) · [Viewer architecture](docs/VIEWER-DEVELOPMENT.md)
