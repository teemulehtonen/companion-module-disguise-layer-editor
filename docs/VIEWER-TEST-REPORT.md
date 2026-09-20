# Beta.127 targeted release checks

165 local tests and the packaged Companion lifecycle smoke check passed. Isolated native checks covered linked/unlinked numeric and resource key moves, edit-time numeric/Video/Mapping/Palette insertion away from the real playhead, layer IN/OUT/move and unchanged duplicate extents/key times. Browser and actual Companion HTTP rotary checks verified independent blue edit time, shared LINK TIME, green transport display and no idle extra guides. Browser errors and Companion last_error were empty after the final check. No exhaustive live layer or external-system test was performed. Immediate duplicate display in the Designer GUI remains subject to user acceptance.

# Local viewer verification

Development verification against Designer 32.4.17. The initial results below describe the earlier development batch. Subsequent installed-build verification is recorded at the end.

## Passed

- 111 local automated tests, including fractional-frame alignment, selection
  locks, inactive-layer rejection, hierarchy summaries, source WAV decoding,
  request validation, port conflict, shutdown and read failure handling.
- Live current-track read: 14 layers, 346 numeric parameters, no snapshot
  warnings. Track, playhead, playback and selection were unchanged by this run.
- Live Track 6 read: 76 layer instances, 1,034 parameter records, no snapshot
  warnings. 31 records were explicitly marked unsupported (not silently omitted).
  Track 6 was read without switching the active Designer transport.
- Maximum measured snapshot request: 215 ms in this local test environment.
  This is an observation, not a guaranteed performance limit.
- Browser checks: live rendering, FIT LAYER, zoom/grid density, waveform open
  and close, real resource thumbnails.
- Package build and existing bundled-module smoke checks.
- Bundled viewer selection through HTTP updated the module's Companion host
  variables for layer UID and parameter. The test used a local test host, not
  the installed Companion. Recorded native calls contained no seek/write command.

## Not yet validated or complete

- Physical Stream Deck feedback with the new module installed.
- Real nested-group and precomp fixtures: existing project tracks had no groups.
  Hierarchy aggregation has fixture tests; that is not native end-to-end coverage.
- Native quantized audio timeline alignment, playback offsets, loops and video
  embedded audio. Current WAV rendering is labelled a source preview.
- The 31 unsupported parameter records do not yet expose editable-style values.
- Waveform mouse-drag resizing needs a complete browser interaction test; live
  height retention is implemented but is not claimed as verified by click tests.

The test batch passed within its stated scope. The viewer is distributed as an experimental beta with the limitations above.

## Beta.37 focused verification

Ten viewer-server and selection tests passed, including live feedback during a pending geometry read and point selection. The final minimal rerun passed all five server tests. The installed viewer returned HTTP 200 with 14 layers and an active connection. Packaging smoke checks passed. Existing Companion functional tests were not repeated. Direct SMB and embedded video audio remain unverified/unsupported as documented in the viewer guide.

## Beta.52 validation

122 offline tests passed. Package smoke checks passed. Synthetic browser fixture: 20 layers, 1,000 keys each (20,000 total), one expanded layer. Initial JavaScript draw took approximately 189 ms; redraw hashing about 24 ms; fixture payload about 2.9 MB. These are single local observations, not paint/animation frame timings or native Designer performance guarantees. The UI remained LIVE. Dense full redraws are not 60-fps smooth; virtualization/canvas remains a development priority. Existing real-project tests do not cover native transport with 20,000 keys.

Zoomed fixture draw: approximately 92 ms with 10,020 visible collapsed-row markers. Timing measures synchronous JavaScript DOM construction, not complete browser paint.
