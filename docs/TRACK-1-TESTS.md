# Track 1 live test report — 19 September 2026

## Environment and result

Designer 32.4.17, Companion 5.0.5, Windows, module **0.1.beta** (technical version **1.0.0-alpha.28**). The live track uses 25 fps and a five-hour native timecode offset.

All **154 distinct live test cases** passed on their latest attempt. This includes **112 resource assignments** through Companion. The release build passed **83 offline tests** and the packaged-module smoke test. This is an alpha acceptance test, not a guarantee against every rendering or device failure.

Live commands used Companion page 2's documented HTTP button and encoder-event endpoints. Designer's Python API prepared fixtures and independently checked the results. Designer and Companion were also inspected visually. Physical Stream Deck input and audible output were not measured.

## Saved program

Track 1 contains its two original layers plus these twelve QA layers. Original layer count and IN/OUT values were checked and retained. Times below are seconds relative to the track start; absolute UI times use Designer's native TC conversion.

| Layer | IN–OUT | Content / purpose |
| --- | --- | --- |
| QA 01 Constant | 240–280 | Colour; constant brightness with an internal carrier key |
| QA 02 Animated Video | 260–340 | Existing HAP video, brightness and palette animation |
| QA 03 Overlap Video | 280–360 | Existing HAP video, brightness and mapping animation |
| QA 04 Bitmap | 300–380 | Existing image; source for Pixelate |
| QA 05 Audio | 320–400 | Existing WAV, volume automation, project audio output |
| QA 06 Gradient | 340–420 | Generative content and brightness automation |
| QA 07 Test Pattern | 360–440 | Generative test image |
| QA 08 Colour | 380–460 | Colour, brightness and enum editing |
| QA 09 Blur | 300–380 | Animated effect; arrow from QA 02 |
| QA 10 Pixelate | 340–420 | Animated effect; arrow from QA 04 |
| QA 11 Bitmap Scroll | 400–480 | Image from the 32-file browsing fixture |
| QA 12 Audio B | 420–500 | Second WAV layer and volume automation |

The program uses the existing screen mappings, two library palettes and two effect arrows. Mapping animation routes video between screens. Numeric curves use linear interpolation. The saved final position is 325 seconds / 05:05:25:00, stopped.

## Coverage

- All eight mappings exposed by this project were assigned on the relevant QA layers, and both library palettes on palette-capable QA layers. The project's one available audio output was selected and read back. This verifies references, not the internal configuration or physical outputs of those resources.
- Media, bitmap, source/mask textures and audio references were exercised. All four pages of the 32-file folder were browsed; empty slots did nothing. Generated internal thumbnail-cache resources are excluded from choices.
- Interpolated values matched Designer between keys. Coarse/fine/ultra, enum labels, constant DEFAULT, nearest-key selection, tie-to-next, second-press unlock, selected-key locks, single delete, one-second hold indication and confirmation/cancel were checked.
- DELETE ALL and DELETE ALL + DEFAULT were tested for numeric and resource parameters, including keys outside layer bounds. Native parameter defaults and constant resource preservation were read back independently.
- NEXT/PREV used the selected parameter's keys, stayed with overlapping layers and used IN / OUT minus one frame when appropriate. Internal constant carrier keys did not become editable animation.
- Key movement respected IN/OUT and did nothing at an occupied key destination. Layer timing respected track bounds. POSITION carried the playhead; FIT used HAP duration and did nothing for content without a duration.
- Empty-time actions, rapid 40-detent seeking, direct Designer API trims, layer addition/removal, stale Designer highlights, automatic active-layer refresh and Track 1 → Track 5 → Track 1 were exercised.
- PLAY SECTION advanced the clock and STOP stopped it. Fractional frame rates are covered by offline tests; this live session was 25 fps.

## Fixes and final retest

The test exposed and fixed ordinary-operation errors from FIT on generators, controls with no active layer, occupied key destinations and stale queued gestures. Real connection failures still report errors. Initial harness assertion mistakes were corrected separately; raw results retain all attempts.

Final log inspection found continuous native `Error updating subscription object` messages. Disabling the module connection stopped them. Version alpha.27 disables production LiveUpdate subscriptions and retains sequential HTTP polling. Audio, effects, playback, track switching and key editing were retested after this change. The final Companion connection was OK with an empty `last_error`.

Designer also logged an `ACCESS_VIOLATION` in its native `Outputting ThumbnailSystem` during visual inspection (00:28:54–00:28:59 local). Designer stayed running, but this native fault remains unresolved. Older Unsupported file type, VirtualLineup and Not Implemented notifications were also visible. Passing Companion controls must not be interpreted as clearing all Designer-native problems.

## Evidence and limits

Raw test evidence, project backups and media are retained privately and excluded from Git and release archives. This report contains only the generic test scenario and results.

The QA program exercises eight layer classes; it is not a rendering test of every Designer layer class. External cameras, RenderStream/Notch content, device outputs, server propagation, audio audibility and every combination of effects are not certified. See `KNOWN-LIMITATIONS.md` for unsupported text fields and native GUI-selection limitations.
