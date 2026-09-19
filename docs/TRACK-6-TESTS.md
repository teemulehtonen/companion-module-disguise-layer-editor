# Track 6 compatibility test

Tested on 19 September 2026 with Designer 32.4.17 and Companion 5.0.5. Final module build: **0.1.0-beta.14** (product version **0.1.beta**).

## Method and results

A disposable track contained all 76 layer types exposed by Designer's Add Layer menu, each in its own time segment. Rendering was disabled to isolate editing from external outputs. Companion's button and encoder HTTP endpoints performed edits; Designer's native API independently read the resulting values and sequences. This does not certify rendering, physical devices or audible output.

| Check | Result |
| --- | --- |
| Numeric and enum value changes, labels, bounds and restoration | 1,003 parameters passed |
| Typed resource lists and selection | 181 fields inspected; 149 assignments passed; 32 had no available resource |
| Key creation/deletion and constant-only no-op controls | 136 cases passed, sampling numeric and enum sequences on each applicable layer type |
| Layer IN, POSITION with playhead, and OUT changes/restoration | All 76 types passed |
| Confirmed DEFAULT ALL PARAMETERS | All 76 types passed; 1,184 supported fields verified against native defaults |
| Focused regressions | 9 passed |
| Automated source tests | 91 passed |
| Packaged module smoke test | Passed |

Focused regressions covered constant navigation to OUT minus one frame, native interpolated values, nearest-key tie selection, target locking with precision/type changes, key movement bounds, confirmed reset, track switching, direct Designer trimming, and live heartbeat/connection status.

The numeric/resource tests ran before the final two fixes; keyframe tests were rerun after the feedback fix, and all layer-reset tests and focused regressions after the empty-layer fix. Results above describe the latest successful attempt, not a claim that no fault occurred during development.

## Fixes found during testing

- Old feedback could overwrite a just-created keyframe's state and make DELETE briefly behave as DEFAULT. Control actions now invalidate cached and in-flight feedback; a regression test covers delayed responses for the same parameter.
- A confirmed reset on a layer without supported parameters raised an error. It now succeeds without changing anything.

## Coverage limits

The field inventory found 31 unsupported string settings. Dynamic Notch, RenderStream and Open fields depend on loaded content; absent resources and external device configurations were not manufactured for this test. Resource checks validate typed references, not every possible resource or its internal settings. Mapping, palette and audio-output references were included. See [known limitations](../KNOWN-LIMITATIONS.md) and the earlier [Track 1 tests](TRACK-1-TESTS.md) for separate resource-paging and overlap coverage.

Local project files, raw logs, identifiers, media, screenshots and machine/network information are excluded from the published source and packages.

## Follow-up: 0.1.0-beta.16

A focused live check through Companion verified that new numeric keys use SMOOTH and rewriting an existing key preserves its selected interpolation. The temporary numeric test key was removed afterwards.

Resource KEYFRAME mode was tested for Video/video, Audio/track, Video/palette, Video/mapping and Audio/output. Each case set an initial resource through REPLACE, inserted a different resource at a later time through KEYFRAME, and independently checked both native evaluation and resource reads before and after the switch. All five cases passed. Test resource sequences were reset afterwards and the original track/playhead restored.

The update passed 95 offline tests and the packaged-module smoke test. This focused follow-up does not repeat or extend the rendering/hardware coverage of the original matrix.
