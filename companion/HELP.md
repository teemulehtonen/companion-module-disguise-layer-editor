# Disguise Layer Editor — 0.2.beta

Disguise layer, keyframe and resource control for Bitfocus Companion and Stream Deck +.

**Experimental beta, provided as-is without warranty.** Back up projects and test before live use. See [disclaimer](DISCLAIMER.md), [limitations](KNOWN-LIMITATIONS.md) and [security](SECURITY.md). Independent integration; not endorsed by Disguise, Bitfocus or Elgato.

## Install

Tested with Designer 32.4.17 and Companion 5.0.5.

1. Enable Designer's HTTP/Python API on a trusted network.
2. In Companion, import `disguise-layer-control-0.1.0-beta.16.tgz` under **Modules**. Add **Disguise Layer Editor** and enter the Designer host and port (default 80).
3. Import `D3-Stream-Deck-Plus.companionconfig`, choose a destination page and link the connection. Import replaces that page; export it first if needed.
4. Assign Stream Deck + to that page. **HTTP + SYNC** indicates automatic feedback.

## Controls

| Encoder | Turn | Press |
| --- | --- | --- |
| LAYER | Select an active layer | — |
| PARAMETER | Select a parameter / page through the list | Open the parameter list |
| VALUE | Edit the selected key or constant | Cycle COARSE / FINE / ULTRA |
| TIME | Seek, or move the locked key | Frame / 1 / 2 / 5 / 10 seconds / minute |

- **SELECT KEYFRAME** locks the nearest in-range key; press again to unlock. TIME step changes keep it locked. **PREV/NEXT KEYFRAME** follow the selected parameter and stop at IN / OUT minus one frame.
- **DELETE KEYFRAME** removes one key. With a constant, **DEFAULT** restores its native default. Hold either for one second to open the delete menu; red indicates ready. Bulk operations require confirmation. **DEFAULT ALL PARAMETERS** resets all supported parameters on the selected layer, including animation outside IN/OUT.
- **LAYER EDIT** assigns IN / POSITION (centre) / OUT / FIT to the encoders. Press LAYER EDIT again to return.
- **RESOURCES** assigns SOURCE / FOLDER / RESOURCE / BACK. Press SOURCE to switch **REPLACE / KEYFRAME** for animatable resources. REPLACE edits the current resource; KEYFRAME schedules the preview at the playhead, preserving the earlier value. Press RESOURCE to apply and return; thumbnails apply directly in the selected mode. Reopening starts in REPLACE. BACK cancels browsing.
- New numeric keyframes default to **SMOOTH**; existing key types are preserved. Resource keyframes are discrete switches, not crossfades.
- **PLAY SECTION / STOP** controls playback. Float increments are 0.1 / 0.01 / 0.001. Absolute times use Designer's native timecode.

## Build

Use Node.js 22.22.0:

```sh
npm ci
npm test
npm run package
```

Windows: `npm run release` creates archives in `releases/0.2.beta`. To replace a local build, use `npm run release -- -Force`. Module and page files are generated outputs, excluded from Git.

[Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Test report](docs/TRACK-1-TESTS.md) · [GitHub setup](docs/GITHUB-SETUP.md)

MIT licensed. The internal module ID remains `disguise-layer-control` for compatibility.

## LIVE / VIEW

Click the connected viewer status to switch the module to VIEW. VIEW disables all Designer writes and transport controls, forces LINK TIME off, and keeps local time, layer/parameter browsing and zoom. Returning to LIVE leaves LINK TIME off. Connection errors disable this switch. VIEW applies to this module only; already dispatched commands cannot be recalled.

## Group layers

In LIVE, Shift-click or Shift-drag layer rows to select siblings. Right-click the selection, enter a name and choose GROUP. Right-click a group for UNGROUP. Groups occupy the highest selected row; layer order and timing are preserved. Collapse/expand and hover time/value readouts are also available in VIEW.

Viewer size: SMALL 100%, MEDIUM 110%, LARGE 120%, saved per browser. Track heading always shows @ FPS, then duration. TC IN: appears only when a transport timecode source is configured; hover for source status.

### Yamaha parameter list (beta.78)

Press the parameter-name display to replace all three LCD rows with 12 parameters. Turn the parameter encoder to move one page at a time; press a parameter to select it and restore the normal controls. Empty slots do nothing. The current parameter is highlighted. The list uses cached fields; the normal stale-context check still refreshes when necessary. The value display now cycles COARSE / FINE / ULTRA; use the explicit Add keyframe action to insert a key. Resource and layer-timing contexts retain their existing press functions. Existing PARAMETER buttons must use the new Open parameter list / select parameter action.

On Yamaha CC1, pressing the third physical encoder adds a keyframe at the playhead. The value LCD button separately cycles COARSE / FINE / ULTRA (or selects a parameter while the list is open).

Set **OSC fader 1–8 display name** in the module connection settings to name each OSC target. Blank names retain OSC FADER 1–8. Names appear on selector buttons and the selected fader display; addresses /vehka/fader1–8 and remembered values do not change.

Numeric encoder sensitivity (beta.80): COARSE / FINE / ULTRA use 1% / 0.1% / 0.01% of the parameter range per effective step. On 0–1 these are 0.01 / 0.001 / 0.0001. Unbounded floating-point parameters use the same fallback steps. Explicit step overrides remain unchanged; integer parameters still move by at least one.
