# Disguise Layer Editor – 0.1.beta

This is a beta release, tested with Designer 32.4.17 and Companion 5.0.5.

- Numeric parameters, enumerations and typed resource references are supported. Free-text sequences are not: the default layer audit found 31 unsupported string fields.
- Selecting a layer in Designer follows into Companion. Selecting a layer with Companion's encoder does not select its native Designer GUI widget. The parameter opened with the Designer mouse cannot be followed automatically.
- Resource selection changes a reference (for example Mapping, Output, Palette or Video). It does not edit the referenced resource's internal configuration.
- Notch, RenderStream and Open expose content-dependent fields. After changing their content/configuration, reload metadata with the Read layers action or switch tracks and back.
- Production feedback uses a sequential 500 ms HTTP state poll. LiveUpdate subscriptions are disabled because Designer 32.4.17 repeatedly logged subscription errors during testing; HTTP + SYNC means polling feedback is available. This is not a frame-accurate automation scheduler.
- Designer's native ThumbnailSystem logged an ACCESS_VIOLATION during the final visual inspection. Designer remained running and Companion commands succeeded, but the native thumbnail fault is not resolved by this module. Do not treat this alpha as a fault-free production certification.
- Companion POSITION moves carry the playhead. Moving a layer directly in Designer follows Designer's own playhead behaviour; Companion reads the resulting bounds.
- All default layer types were audited through the API, but external devices, content-specific configurations and every rendering combination were not tested. Physical Stream Deck input and audio output audibility were not measured in the latest test.

Use the importable page on a chosen page number and link it to the existing module connection. Importing the page replaces the destination page. Export your configuration before replacing a page you want to retain.
