# Timeline viewer

Enable **ENABLE TIMELINE VIEWER** and open `http://127.0.0.1:8765` (configurable port). Enable **ALLOW VIEWER EDIT** for editing. **ALLOW LAN ACCESS** exposes the viewer and enabled controls to the trusted LAN without per-user authentication.

## Time and selection

- Green cursor/clock: actual Designer transport.
- **LINK TIME**, on by default: editing follows Designer. The viewer and Stream Deck button share this setting.
- Unlinked: blue cursor and smaller blue clock show independent edit time. Timeline/marker clicks, PREV/NEXT KEYFRAME and the time dial move edit time without seeking Designer. Layer/key timing edits follow that same clock.
- Relinking adopts Designer time and clears key/layer/resource/delete edit modes; it never seeks playback to edit time.
- Clicking a layer name or bar selects it and moves the active clock to its IN, including inactive layers. Parameter selection remains limited to active edit time. Clicking an explicit IN/OUT/key point moves that active clock. Designer playback cannot steal the unlinked edit target.
- FOLLOW and zoom use the active clock. CTRL+wheel zooms; SHIFT+wheel pans. FIT LAYER leaves 4% space at the edges.

## Transport

The icon group before +VIDEO contains PREVIOUS SECTION, PLAY, PLAY TO END OF SECTION, STOP and NEXT SECTION. Hover for labels. Space toggles play/stop using the last successful PLAY or PLAY TO END choice (initially section end). Typing, open popups and held-key repeats do not trigger it. These controls always command Designer transport, even when LINK TIME is off; the blue editing cursor stays independent.

## Mouse editing

- Drag a layer bar to move it; drag its edges for IN/OUT. Native timing limits and frame/beat steps apply.
- Drag a keyframe in time and, for numeric parameters, value. Resource and list keys move horizontally. Double-click a lane to add a key. Delete removes the selected key; deleting the last key preserves its value as a constant.
- Click a value for a compact numeric input or option list. Right-click numeric keys for HOLD / LINEAR / CUBIC.
- Click a resource key or constant value (including NONE) for its parameter-specific picker. Double-click an existing resource key to replace it. Folders start at PROJECT and expand by depth; files scroll below. Internal Mapping/Output/Palette resources use the same workflow.
- +VIDEO / +AUDIO / +BITMAP create layers. Right-click a layer for RENAME, DUPLICATE, DELETE or FIT TO CONTENT. Delete also removes a directly selected layer, unless a key is selected. Drag layer names vertically to reorder within their parent group; whole groups reorder with siblings.
- CUE / TC / MIDI / NOTES markers support creation, movement and editing. SNAP offers layer edges, keys, markers, sections and visible time/beat grid; ALT bypasses snapping. Extra alignment guides appear only while adjusting.

The browser uses the shared Companion queue and guarded native commands. Changed targets, locks, track changes and key collisions can reject a write. Failed writes are not replayed. Preview curves update locally, then reconcile with Designer samples.

## Resources and audio

Resource rows show thumbnails and available duration/FPS/codec/alpha/audio metadata. Designer owns resource versions and clip trims; the picker does not choose old filesystem versions independently. Resource references switch discretely, without crossfades.

Waveform buttons show or refresh available audio. Waveforms are previews, not a full playback simulation: looping, ping-pong, speed changes and nonlinear audio warping are not fully rendered. Network reads use configured SMB credentials, with bounded range reads and no full media copy to the Raspberry Pi. See [SMB setup](RASPBERRY-PI-SMB.md).

Experimental beta: tested with Designer 32.4.17 and Companion 5.0.5. External systems, every native parameter and every playback mode are not certified. See [known limitations](../KNOWN-LIMITATIONS.md) and [developer handoff](PROJECT-HANDOFF.md).
