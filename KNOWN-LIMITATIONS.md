# Known limitations

- Experimental Companion integration, based on testing with Designer 32.4.17 and Companion 5.0.5.
- The CC1-only extraction has not been tested on physical Yamaha hardware or installed Companion.
- The separate Yamaha surface driver must be installed independently; the connection module does not include it.
- OSC is one-way UDP; displayed values are local commands, not receiver acknowledgements. Abrupt power loss can lose recently unsaved values.
- Native writes can fail after partial external effects; uncertain writes are never retried automatically.
- Supported numeric/resource parameters depend on Designer metadata. Large projects and every layer/resource type are not certified.
- Historical native thumbnail/GUI errors remain uninvestigated; offline tests do not establish their absence.
- Web editing, timeline rendering, mouse grouping/dragging, waveform decoding and SMB access are removed.
