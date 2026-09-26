# Disguise CC1 control

Disguise Designer layer, keyframe, resource and transport control for Yamaha CC1
through Bitfocus Companion. This checkout contains the CC1-only version 0.2.0-beta.84, based on
0.2.0-beta.80. It has no web editor, HTTP viewer, waveform decoder or SMB client.
Beta.84 is installed locally in Companion and includes the parameter-fader toggle preset with red mode feedback.
Not published to GitHub.

## Setup

Build with Node.js 22 and npm using [BUILD.md](docs/BUILD.md). Import the resulting
module into Companion and use the existing Disguise Layer Editor connection.
Its module ID and action IDs remain compatible with your existing CC1 bindings.
Enter the Designer host and HTTP API port. Preserve your own pages and settings.
Optional clean CC1 page exports are provided; importing a page replaces that page.

See [Yamaha CC1 setup](docs/YAMAHA-CC1.md) for motor-fader variables and triggers,
the eight transport targets and eight independently remembered OSC channels.
The surface-driver patch in [support](support/yamaha-cc1/README.md) is separate.

## Controls

- Layer display opens the active-layer list on 12 buttons; its encoder changes pages.
- Parameter display opens the 12-button parameter list; its encoder changes pages.
- Value display cycles COARSE / FINE / ULTRA. The third physical encoder press adds a keyframe.
- Numeric steps are 1% / 0.1% / 0.01% of the parameter range; integers use at least one.
- RC5 zooms the Designer timeline. RC6 controls time; JOG LOCK blocks time rotation.
- LINK TIME switches between Designer playback time and independent edit time.
- Resource selection and thumbnails remain on CC1. No SMB settings are required.
- VIEW ONLY in connection settings blocks Designer and OSC output while retaining browsing.
- OSC names are optional; addresses remain /vehka/fader1–8 with one 0–1 float.

Use [the regression runner](docs/REGRESSION-TESTS.md) for local validation.
Physical Yamaha behavior, native Designer edits and actual OSC delivery require
separate operator testing. See [limitations](KNOWN-LIMITATIONS.md),
[security](SECURITY.md) and [disclaimer](DISCLAIMER.md).
