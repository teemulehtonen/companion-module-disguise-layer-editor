# Yamaha CC1

The generated `D3-Yamaha-CC1.companionconfig` page targets Companion page 8 and reproduces the clean 8 x 7 operator layout captured from the reference Companion.

- The first twelve cells are the CC1 LCD keys.
- RC1-RC4 match the Stream Deck + encoders.
- RC5 controls Designer timeline zoom (saved action ID viewer_zoom).
- RC6 controls timeline time.
- The lower panel contains keyframe, media, transport-master and time-link controls.
- Fader target selection spans up to eight Designer transports, followed by eight OSC channels.

The generated `D3-Yamaha-CC1-Transports.companionconfig` targets page 9. It retains the legacy 42-cell CC1 6 x 7 layout; only slots 1–16 are active in beta.75. Build your own selector page from the presets for the current 8-transport/8-OSC arrangement. Populated buttons show the transport name, select that transport for the motor fader and highlight the selected target. Empty slots do nothing.

The `JOG ACTIVE / LOCKED` preset can be placed on any button. Its state is saved in the Companion connection. While locked, timeline dial rotation is ignored; key navigation and the remaining controls stay available.

The motor fader uses a Companion custom variable and one trigger:

1. Create the custom variable `cc1_fader` with a default value from 0 to 100.
2. In the Yamaha CC1 surface settings, set **Fader position** to `cc1_fader`.
3. Set **Motor fader target** to `$(d3layers:transport_master_level)`.
4. Create a trigger for changes to `$(custom:cc1_fader)`. Its action is **Set selected fader target (transport / OSC)**, with **Level** set to the expression `$(custom:cc1_fader)`.

The module writes the selected transport brightness and volume together. Rapid fader updates are collapsed to the newest absolute position while a request is in flight. Selecting another transport updates the motor target from that transport. If its brightness and volume differ, the motor uses the lower value so selecting it cannot imply a louder or brighter state than either actual output.

Display latency: the local Yamaha surface-driver 0.5.1-beta.1 replaces obsolete
queued LCD images with the newest image per key. This prevents fast timecode
updates from leaving page/colour changes behind a long serial queue. See
[driver patch and validation](../support/yamaha-cc1/README.md). The Disguise module
version alone does not contain this surface-driver fix.
## Track / section navigation presets (beta.74)

The **Track / section navigation** group provides a shared TRACK/SECTION toggle
and Previous / Next presets. TRACK uses the existing previous/next track actions;
SECTION uses the existing previous/next section actions. Both native IF/ELSE
branches are complete. The toggle persists in module settings and is shared by
all copies. SECTION is the default when track navigation is not enabled.

For colours, set the normal button background for SECTION and the
**Track navigation enabled** feedback background for TRACK.

Replace previously placed beta.73 PREV/NEXT buttons with these updated presets:
ordinary placed copies retain their previous ELSE actions. Existing button
placements are not automatically changed. The existing mode-toggle action and
feedback IDs remain compatible, including saved colours and mode state.

Use separate normal Companion page-change buttons (for example buttons 1 and 2).
These are independent of TRACK/SECTION mode. No TCP or OSC setup is needed.

## OSC fader presets (beta.75)

The **CC1 master fader: transports / OSC** preset group offers transport selectors
1–8 followed by OSC FADER 1–8 (target slots 9–16). Unused transport slots stay empty;
OSC slots never shift when transport count changes. REFRESH TRANSPORTS updates
the first eight transport names without replacing OSC values or selection.
No installed page layout is changed: place the presets yourself.

In module settings, enter **OSC destination IP / hostname** and **OSC destination
UDP port** (default 9000). An empty destination disables output. The existing
fader action and motor-target variable work for both transport and OSC targets.
OSC channels send one float argument from 0 to 1 to /vehka/fader1 through
/vehka/fader8. Module VIEW mode blocks both transport and OSC output.

Each OSC value starts at 0 and is remembered independently. Values are saved in
module configuration in batches of up to 250 ms and flushed on clean shutdown or
configuration reload. Abrupt power loss can lose the latest unsaved movement.
Selection recalls the stored motor target without sending OSC. Startup likewise
does not transmit stored values: move the fader to send to the receiver. OSC is
one-way UDP; displayed values are locally stored commands, not receiver feedback.
Variables osc_fader_1 through osc_fader_8 expose stored normalized values.

The accompanying Yamaha surface 0.5.1-beta.2 ignores untouched motor travel as
input. It remembers motor updates while the fader is held and applies the newest
target on release. This prevents a channel recall from overwriting its saved value.
Physical recall and the operator's OSC receiver must still be checked on hardware.

## Active layer list (beta.82)

Press the LAYER display to show active layers on all twelve LCD buttons. Turn the
LAYER encoder to page in groups of twelve, then press a layer to select it and
return to normal controls. Active layers follow the edit clock, including exact
OUT and independent LINK TIME-off editing. Empty slots do nothing. Other editing
encoders and key actions are inert while choosing; transport controls remain available.

The current layer is highlighted. Selection checks fresh Designer feedback and
cancels if the displayed list or track changes. Opening/paging are local; choosing
reads the layer's default parameter without seeking or editing Designer. Existing
layer_press bindings work unchanged. Resource and layer-timing press behavior is
preserved. Custom buttons can use Select layer list slot (1–12).

## Import into an empty Companion

The page file is not a full Companion backup. Install the Disguise module and the
Yamaha CC1 surface driver separately (the local 0.5.1-beta.2 includes motor-input
suppression and display queue fixes). Import the CC1 page at page 8 and the target
selector page at page 9, keeping the connection label d3layers. Configure the
Designer address and any OSC destination/names for the new system.
Create cc1_fader, the change trigger and the surface motor bindings described above;
page exports do not carry custom variables, triggers or surface configuration.
Choose the CC1 surface's starting page/group. The page 8 navigation action uses
self, so it follows the surface that pressed it instead of a specific device ID.
The parameter-mode preset is included with beta.83; place it manually in an empty
button. Its existing fader trigger action now reads Set selected fader target
(transport / OSC / parameter). A fresh-install hardware test is still required.

## Default page layout

The default page is the operator-approved Companion page 8 captured on 2026-09-26.
Preserve its layout when generating future exports. It includes the FADER toggle
with red parameter-mode feedback and the NAV toggle with conditional PREV/NEXT.
The source of truth is templates/yamaha-cc1-page8.json; the build script copies it
into D3-Yamaha-CC1.companionconfig with clean connection settings.
