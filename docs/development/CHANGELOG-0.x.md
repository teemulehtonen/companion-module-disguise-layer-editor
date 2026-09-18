# 0.3.35

- Designer layer reordering updates the encoder list without a metadata reload. The chosen layer, parameter and key remain selected by identity.

# 0.3.34

- Playback and external time changes release an unlocked key selection, including keys created without a navigation anchor. Active SELECT KEY remains locked.
- Track 5 live testing resumed with user approval. See TRACK-5-TESTS.md for tested workflows and remaining limitations.

# 0.3.33

- Lightweight 500 ms state reads supplement LiveUpdate to recover stalled timeline/selection feedback. New HTTP health samples are reconciled once, avoiding stale health-cache rollback.

# 0.3.32

- Explicit 100 ms LiveUpdate update frequency requested. Complex subscriptions can still stall in Designer 32.4.17; 0.3.33 adds a polling fallback.

# 0.3.31

- Track mismatch from HTTP health always triggers a resync, even when an old LiveUpdate subscription still reports live.

# 0.3.30

- Companion layer POSITION moves carry the playhead by the actual clamped movement, preserving its offset inside the layer.
- IN/OUT/FIT keep the playhead within the resulting layer bounds. Queued dial updates retain their pending playhead position until Designer feedback catches up.
- Reverse GUI layer-selection sync remains unsupported: selectedLayers is read-only and GUI widgets are restricted by the Python API. No selection writer was installed.
- Functional tests remain paused at user request.

# 0.3.29

- Playhead feedback retains the explicitly selected key while SELECT KEY is active. Includes the selection lock and value/type continuity from 0.3.28.

# 0.3.28

- Active SELECT KEY locks layer and parameter encoder selection and defers Designer layer selection. TIME, VALUE and TYPE remain editable.
- Value/type edits retain key selection and update the expected key data for subsequent moves. Other buttons remain available; press TIME to leave key mode.
- Tests remain paused at user request.

# 0.3.27

- Every SELECT KEY press selects the nearest key of the selected numeric/enum parameter. Ties prefer the following key; sequenced keys outside layer bounds are excluded. Constants retain their initial key.
- Selection seeks the playhead to the selected key and can be made from outside a Designer-selected layer. The TIME dial moves the selected key; pressing TIME exits move mode.
- SELECT KEY retains its label while active and uses the existing active highlight. Functional tests remain paused.

# 0.3.26

- Resources browser dial 4 displays only BACK in the main text area.

# 0.3.25

- Subtle functional button groups: blue key navigation, violet key editing, teal layer editing, green playback and warm brown resources.
- Active modes retain the Editor turquoise highlight. DELETE KEY shares the key-edit group colour. Individual presets match page buttons.
- Tests remain paused at user request.

# 0.3.24

- Follow Designer selectedLayers through LiveUpdate and initial snapshots. A changed selection chooses the layer and its default Brightness/Volume parameter.
- Encoder layer selection remains local and is not overwritten by unchanged Designer selection or subscription reconnects.
- Designer-selected layers outside the playhead remain visible without seeking. Layer rotation returns to the active-layer list. Multiselection follows the last newly added supported layer.
- Layer selection is supported; Designer parameter selection is unchanged. Functional tests remain paused at user request.

# 0.3.23

- Layer editor dial 4 is FIT / LENGTH. Press fits to content using Designer defaultResourceSequence/resourceDuration, preserving IN and limiting OUT to the track. Return through LAYER EDIT. Unsupported/static content reports no finite duration.
- IN, OUT, POSITION and FIT clamp at track boundaries and preserve a one-frame minimum. Key moves clamp to layer/track bounds; occupied key times still report conflicts.
- All UI font roles reduced, including file/folder names, LCD text, resource badges and playback clock.
- Compilation only; functional/automated tests remain paused at user request.

# 0.3.22

- Layer display IN/OUT now show absolute layer start/end timecodes using the track FPS, independent of playhead position.
- Tests remain paused at user request.

# 0.3.21

- RESOURCES label and smaller, consistent UI typography. Small timing/limit details retain their existing size for readability.
- Button text 28 to 24; LCD headings 95 to 88, values 100 to 92; file/folder names 95 to 88.
- Tests remain paused at user request.

# 0.3.20

- RESOURCE browser resolves each ResourceSequence field type, including Mapping, audio Output, fonts and LUTs. Named internal resources are included. Protected/unnamed runtime objects are excluded.
- Library / Project / Internal folders distinguish origins. Resource cards without thumbnails show the field label.
- Read-only coverage audit: 76 existing layer types, 1003 numeric/enum fields, 181 resource fields, 31 unsupported free-text fields. This is metadata coverage, not a functional test.
- Added 32 HD-image browsing fixtures to both DxTexture and VideoFile libraries.
- Functional and automated tests remain paused at user request.

# 0.3.19

- PREV/NEXT KEY navigate only keys within the selected layer. Beyond the first/last key they visit IN/OUT; repeated presses stay at the boundary.
- Layer boundary navigation does not create keyframes. K-/K+ distances omit trimmed-out keys.
- Regression cases updated but not run: testing awaits user approval.

# 0.3.18

- Numeric display precision follows COARSE / FINE / ULTRA: 1 / 2 / 3 decimals; enum labels and integers are retained. Underlying parameter values are not rounded by this display change.
- Dedicated layer timing view: IN / POSITION (centre time) / OUT / BACK (duration).
- Timing dial press cycles frame / second / five seconds / minute.
- SELECT KEY label, swapped DELETE KEY and TYPE buttons.
- Compact separate playback clock, spaced FPS label, no redundant screen instructions.
- Functional testing of this final layout is pending user approval.

# 0.3.11

- Eight media thumbnails with SOURCE / FOLDER / MEDIA / BACK dials.
- Media rotation previews only; press applies and returns to parameters. BACK cancels preview.
- Default parameter: Brightness, then Volume, then first in Designer order.
- Unified Disguise Layer Editor tool colours, including Delete Key.

# 0.3.4

- Automatically refresh when layers at the playhead change; preserve valid parameter/key/move selections. Remove REFRESH from page and dial presses.
- SELECT MOVE KEY chooses the nearest key, preferring the next on equal distance.

- Default float encoder increments: COARSE 0.1, FINE 0.01, ULTRA 0.001, independent of Designer mouse-editor metadata steps. Explicit step overrides, numeric limits and discrete integer/enum controls are preserved.

# 0.3.3

- Read live layer bounds and playhead together so Designer trims/moves cannot silently discard the selected parameter using stale bounds.
- Verified actual Companion NEXT/PREV transport jumps against the live Brightness sequence.

# 0.3.2

- Key navigation uses the selected key as its cursor, survives delayed playhead feedback and stops at boundaries.
- MEDIA opens explicitly; numeric parameter browsing never changes mode. PARAMS restores the previous parameter.

# 0.3.1

- HH:MM:SS:FR display with source FPS and drop-frame labels.
- Correct element-relative LCD font scaling and readable two-line timing details.

# 0.3.0

- Realtime time/value edits; VALUE rotation edits existing keys, press adds a key.
- Designer metadata labels, enum values, ranges, COARSE/FINE/ULTRA.
- Automatic media mode with project folders and Designer thumbnails.
- Selected key move/type and layer move/IN/OUT trimming.
- Active layers at playhead, timing distances, source TC/FPS via LiveUpdate.
- Page 2 with contextual buttons and no number decorations.
- Created all 76 screenshot layer types; verified 1003 parameter edits, 998 animatable fields and 122 enums in Designer 32.4.17.

# 0.2.1

- Resolve preset variables with the actual connection label instead of the button-only `this` namespace.
- Generate an importable Companion 5 page with eight buttons, four LCD regions and four encoders.
- Display values on Stream Deck + row 2 while handling physical encoders on row 3.

# 0.2.0

- Automatically connect to Designer and read the initial layer snapshot.
- Check HTTP transport health every five seconds and reconnect LiveUpdate.
- Display real playhead time, HTTP status and LiveUpdate status in variables and a preset.
- Block edits from stale snapshots after a disconnection or track change.
- Fix Designer 32.4.17 layer enumeration (`layer.fields`).
- Encode 64-bit resource UIDs as exact hexadecimal LiveUpdate object references.
- Tested read-only against local Designer 32.4.17: two Video layers, 48 numeric parameters each, live playhead feedback.

# 0.1.0

- Initial staged parameter, cursor and keyframe editing, demo mode and Windows build environment.
