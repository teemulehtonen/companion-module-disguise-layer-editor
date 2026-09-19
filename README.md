# Disguise Layer Editor — 0.1.beta

Disguise layer, keyframe and resource control for Bitfocus Companion and Stream Deck +.

**Experimental beta, provided as-is without warranty.** Back up projects and test before live use. See [disclaimer](DISCLAIMER.md), [limitations](KNOWN-LIMITATIONS.md) and [security](SECURITY.md). Independent integration; not endorsed by Disguise, Bitfocus or Elgato.

## Install

**Downloads (beta.52):** [Companion module](../../releases/download/v0.1.0-beta.52/disguise-layer-control-0.1.0-beta.52.tgz) · [Companion page](../../releases/download/v0.1.0-beta.52/D3-Stream-Deck-Plus.companionconfig)

Tested with Designer 32.4.17 and Companion 5.0.5.

1. Enable Designer's HTTP/Python API on a trusted network.
2. In Companion, import `disguise-layer-control-<version>.tgz` under **Modules**. Add **Disguise Layer Editor** and enter the Designer host and port (default 80).
3. Import `D3-Stream-Deck-Plus.companionconfig`, choose a destination page and link the connection. Import replaces that page; export it first if needed.
4. Assign Stream Deck + to that page. **HTTP + SYNC** indicates automatic feedback.

## Controls

| Encoder | Turn | Press |
| --- | --- | --- |
| LAYER | Select an active layer | — |
| PARAMETER | Select a parameter | Coarse / fine / ultra |
| VALUE | Edit the selected key or constant | Add a key at the playhead |
| TIME | Seek, or move the locked key | Frame / 1 / 2 / 5 / 10 seconds / minute |

- **SELECT KEYFRAME** locks the nearest in-range key; press again to unlock. TIME step changes keep it locked. **PREV/NEXT KEYFRAME** follow the selected parameter and stop at IN / OUT minus one frame.
- **DELETE KEYFRAME** removes one key. With a constant, **DEFAULT** restores its native default. Hold either for one second to open the delete menu; red indicates ready. Bulk operations require confirmation. **DEFAULT ALL PARAMETERS** resets all supported parameters on the selected layer, including animation outside IN/OUT.
- **LAYER EDIT** assigns IN / POSITION (centre) / OUT / FIT to the encoders. Press LAYER EDIT again to return.
- **RESOURCES** assigns SOURCE / FOLDER / RESOURCE / BACK. Press SOURCE to switch **REPLACE / KEYFRAME** for animatable resources. REPLACE edits the current resource; KEYFRAME schedules the preview at the playhead, preserving the earlier value. Press RESOURCE to apply and return; thumbnails apply directly in the selected mode. Reopening starts in REPLACE. BACK cancels browsing.
- New numeric keyframes default to **SMOOTH**; existing key types are preserved. Resource keyframes are discrete switches, not crossfades.
- **PLAY SECTION / STOP** controls playback. Float increments are 0.1 / 0.01 / 0.001. Absolute times use Designer's native timecode.

## Timeline viewer

Enable **ENABLE TIMELINE VIEWER** in module settings and open `http://127.0.0.1:8765`. Select layers/parameters, seek from timeline points, and inspect native curves and resource thumbnails. [Viewer guide and limitations](docs/TIMELINE-VIEWER.md).

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
