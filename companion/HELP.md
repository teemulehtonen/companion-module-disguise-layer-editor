# Disguise CC1 control

Configure the Designer host and HTTP API port, then use your existing Yamaha CC1
bindings. No web server or web-editor settings are included.

PARAMETER opens a 12-button list; turn its encoder to page. VALUE display cycles
COARSE/FINE/ULTRA; physical encoder 3 press adds a keyframe. Default increments
are 1%/0.1%/0.01% of the parameter span. RC5 zooms Designer; RC6 controls time.
LINK TIME off keeps the edit clock independent of Designer playback.

For the motor fader, set surface input to custom variable cc1_fader, motor target
to $(d3layers:transport_master_level), and a variable-change trigger to the
Set selected fader target action using $(custom:cc1_fader).

Eight transport slots and eight OSC slots retain per-target levels. OSC display
names do not change /vehka/fader1–8 addresses or 0–1 float output. VIEW ONLY in
connection settings blocks Designer/OSC writes. CLEAR THUMBNAIL CACHE clears
cached CC1 resource images only. Preserve your existing pages and other bindings.

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

## Parameter fader

Drag **Toggle fader: master / selected parameter** from the CC1 fader preset
group to an empty button. MASTER controls the previous transport/OSC target.
PARAMETER maps the selected numeric parameter's minimum and maximum to the full
fader travel and follows its value with the motor. The existing fader display
continues showing the master/OSC name and value; red means the fader is controlling
a parameter instead. Resource and option-list parameters are not supported.
Animated parameters use the selected key, just like the VALUE encoder.

The FADER toggle preset includes **Fader controls selected parameter** feedback.
It turns red in PARAMETER mode and restores its normal style in MASTER mode.
For a previously placed button, add this feedback under Feedbacks; imported
preset instances do not automatically inherit later preset changes.
