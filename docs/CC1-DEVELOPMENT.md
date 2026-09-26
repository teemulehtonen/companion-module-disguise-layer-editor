# Yamaha CC1 development

This checkout is the CC1-only Companion module. The web timeline, HTTP server,
mouse adapter, waveform decoding and SMB client have been removed. Legacy viewer
settings are ignored. The persisted action ID viewer_zoom remains for existing
CC1 bindings and controls Designer timeline zoom only.

## Responsibilities

- main.js: Companion lifecycle, bounded action queue, variables, OSC and motor targets.
- editor.js: shared layer/parameter selection, numeric/resource keys, timing and LINK TIME.
- definitions.js: saved Companion action IDs, feedback and presets. Preserve user bindings.
- connection.js and live-properties.js: Designer feedback and context recovery.
- client.js and designer-script.js: guarded native reads/writes; no automatic write retries.
- playback-clock.js: CC1 display interpolation; confirmed edit time stays authoritative.
- thumbnail-script.js and thumbnail-disk-cache.js: CC1 resource images, without source-media access.
- support/yamaha-cc1: separate serial surface-driver patch and its tests.

Native player.tCurrent is beats; module time and transport seek arguments are seconds.
Use Designer timeToBeat/beatToTime at every boundary. Exact layer OUT is a valid
edit position. Numeric precision uses 1%, 0.1%, 0.01% of the parameter range.

LINK TIME off preserves playback and uses an independent edit clock. VIEW ONLY
is a connection setting and blocks Designer and OSC writes while allowing browsing.
Context changes invalidate queued detents. Expected-key, bounds and lock checks
must remain at the native boundary. Uncertain writes must never be replayed.

Run the reusable regression runner after changes; see REGRESSION-TESTS.md.
Offline Companion actions, detached native mutations and installed read-only
probes are separate scopes. Native runs need explicit operator authorization.
Never publish or install without authorization. Keep reports and settings private.

## Active layer selection

layerBrowser stores a page and ordered active-layer identity/name signature with
transport/track identity. All twelve LCD slots select layers; the layer encoder
pages without detent batching. Fresh live_state must preserve the list before
read_field. Follow Designer selection only after a later highlight change, matching
rotary selection. publishField/publishClock must not replace list labels.
Layer timing and resource modes keep their existing layer_press functions.
Test coverage is in layer-browser.test.js, the CC1 page test and package smoke.

## Designer selection synchronization investigation

Requested behavior: CC1 layer choices should also select the Designer layer only
while LINK TIME is enabled. This is not implemented in beta.82.
The official GuiSystem reference declares selectedLayers read-only. Read-only
inspection of the installed Designer found no layer-selection setter on GuiSystem,
Layer or LocalState. PrivateState stage selection concerns stage Objects, not layers.
Installed GuiSystem exposes makeEditor/makeListEditor, but their runtime docstrings
are empty and they are absent from the downloaded public method signatures.
Their effect on layer selection has not been verified; do not assume opening an
editor selects its layer. No native selection mutation or widget call was tested.
A supported selection method or a separately authorized native investigation is
required before implementing the LINK TIME condition. Existing behavior is unchanged.
Reference: https://developer.disguise.one/python-api/docs/guisystem/


Further read-only inspection resolved the installed signatures:
GuiSystem.makeEditor(Resource) -> Widget and makeListEditor(type, vector<Resource_RP>) -> Widget.
Both methods report isRestricted() false, but the Widget return type reports true.
This does not establish whether invoking makeEditor selects a layer or whether
a return-value restriction occurs after opening the editor. No call was executed.
Local installed HTTP session schema provided no layer GUI-selection endpoint.
Any native experiment must call makeEditor only once against a validated layer,
record selection before/after and any error, and never retry an uncertain result.


Operator-authorized one-shot installed test (2026-09-26): makeEditor was invoked
once for the CC1-selected layer after transport, track and selection guards.
Designer returned HTTP execution status 5000 with TypeError: Access to object
of type 'ParamAction<InputMap>' is not allowed. The request is recorded as
uncertain because partial GUI effects cannot be excluded. No retry was made.
Immediate readback showed an empty layer selection both before and after, the
same track/transport, and playback still running. This is a failed installed
GUI-selection experiment, not an offline regression or a successful feature test.
No production behavior or installed module was changed. Private receipt:
.tools/layer-editor-once-private.json. LINK TIME gating cannot resolve this
Designer access restriction.


## Parameter fader (beta.83)

The additive FADER mode preset toggles between the saved master/OSC target and
the selected numeric parameter. Finite min/max map to 0-100% physical travel;
integers round, resources and enumeration fields are unavailable. The native
adjust_value command retains all existing context, layer-lock and key guards.
Animated parameters edit the selected key; constants edit their existing value.
A single trailing absolute request replaces intermediate positions. Context or
mode changes discard old pending input. VIEW ONLY blocks writes. Mode persists.
transport_master_level remains the physical motor target. master_transport and
fader_value_label retain the selected master/OSC name and value even in PARAMETER
mode. The normal fourth LCD is red in PARAMETER mode, while chooser/media content
keeps its normal colors. No existing button is assigned to the new toggle.
