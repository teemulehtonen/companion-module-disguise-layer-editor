# Disguise Layer Editor – 0.1.beta

This is a beta release, tested with Designer 32.4.17 and Companion 5.0.5.

- Numeric parameters, enumerations and typed resource references are supported. Free-text sequences are not: the default layer audit found 31 unsupported string fields.
- Selecting a layer in Designer follows into Companion. Selecting a layer with Companion's encoder does not select its native Designer GUI widget. The parameter opened with the Designer mouse cannot be followed automatically.
- Resource selection changes a reference (for example Mapping, Output, Palette or Video). It does not edit the referenced resource's internal configuration.
- Notch, RenderStream and Open expose content-dependent fields. After changing their content/configuration, reload metadata with the Read layers action or switch tracks and back.
- Feedback uses LiveUpdate with HTTP fallback. Unsupported subscriptions back off. This is not a frame-accurate automation scheduler.
- Designer's native ThumbnailSystem logged an ACCESS_VIOLATION during the final visual inspection. Designer remained running and Companion commands succeeded, but the native thumbnail fault is not resolved by this module. Do not treat this beta as a fault-free production certification.
- Companion POSITION moves carry the active editing cursor; Designer playback follows only with LINK TIME on. Moving a layer directly in Designer follows Designer's own playhead behaviour; Companion reads the resulting bounds.
- All default layer types were audited through the API, but external devices, content-specific configurations and every rendering combination were not tested. Physical Stream Deck input and audio output audibility were not measured in the latest test.

Use the importable page on a chosen page number and link it to the existing module connection. Importing the page replaces the destination page. Export your configuration before replacing a page you want to retain.

- Waveforms are source visualizations, not a complete simulation of playback: repeated loops, reverse ping-pong cycles, speed/offset changes, resource changes and nonlinear audio warping are not rendered. Loop/Ping-pong display one full source; Pause clips the source at layer OUT.
- MOV waveform decoding supports tested PCM streams; compressed codecs and multi-fragment media are not supported.
- Direct SMB uses the alpha smb3-client dependency. Authenticated access worked on the tested Raspberry Pi / Windows setup; guest access, all server policies and all network failure modes are not certified.
- Beat/bar display currently assumes four beats per bar.

- Immediate native Designer timeline display after DUPLICATE uses the native extent-update path. Timing preservation was tested; visual acceptance across Designer versions is still required.
