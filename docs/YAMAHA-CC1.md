# Yamaha CC1

The generated `D3-Yamaha-CC1.companionconfig` page targets Companion page 8 and reproduces the clean 8 x 7 operator layout captured from the reference Companion.

- The first twelve cells are the CC1 LCD keys.
- RC1-RC4 match the Stream Deck + encoders.
- RC5 controls timeline viewer zoom.
- RC6 controls timeline time.
- The lower panel contains keyframe, media, transport-master and time-link controls.
- Transport selection stops at the first and last available Disguise transport.

The generated `D3-Yamaha-CC1-Transports.companionconfig` targets page 9. It contains 42 live transport slots in the CC1 6 x 7 layout. Populated buttons show the transport name, select that transport for the motor fader and highlight the selected target. Empty slots do nothing.

The `JOG ACTIVE / LOCKED` preset can be placed on any button. Its state is saved in the Companion connection. While locked, timeline dial rotation is ignored; key navigation and the remaining controls stay available.

The motor fader uses a Companion custom variable and one trigger:

1. Create the custom variable `cc1_fader` with a default value from 0 to 100.
2. In the Yamaha CC1 surface settings, set **Fader position** to `cc1_fader`.
3. Set **Motor fader target** to `$(d3layers:transport_master_level)`.
4. Create a trigger for changes to `$(custom:cc1_fader)`. Its action is **Set selected transport brightness + volume**, with **Level** set to the expression `$(custom:cc1_fader)`.

The module writes the selected transport brightness and volume together. Rapid fader updates are collapsed to the newest absolute position while a request is in flight. Selecting another transport updates the motor target from that transport. If its brightness and volume differ, the motor uses the lower value so selecting it cannot imply a louder or brighter state than either actual output.
