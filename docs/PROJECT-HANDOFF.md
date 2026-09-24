# Timeline event-filter icons - 0.2.0-beta.59

The TIME-row filters use the same compact outlined SVG treatment as the other
timeline display controls. C, T, M and N represent cue, timecode, MIDI and notes;
ALL uses a four-cell symbol. Visible text was removed while full title and ARIA
labels remain. Filtering behavior and browser-local state are unchanged.
Validation: 294 offline tests and package checks passed without skips. Beta.59
is installed on the Raspberry Pi with the existing connection settings preserved.
Read-only checks confirmed the served SVG paths, a connected and
non-synchronising viewer, and an empty last_error. Designer was not mutated.

# Timeline event-row filters - 0.2.0-beta.58

The TIME row now includes local CUE, TIMECODE, MIDI, NOTES and ALL display
controls. Individual controls omit their event row from the DOM; ALL restores
every row when any are hidden and clears every row when all are shown. Removing
rows reduces the sticky timeline header so the layer area receives the released
height. This is browser-local display state and does not write to Designer.
Validation: 294 offline tests and package checks passed without skips. New tests
cover individual/ALL transitions and layout omission. Beta.58 is installed on the
Raspberry Pi with the existing connection settings preserved. Read-only checks
confirmed the served filter code, a connected and non-synchronising viewer, and
an empty last_error. Designer was not mutated.

# Background content refresh - 0.2.0-beta.56

Separate editor.contextStale from general stale content. Only initial loading,
identity changes and reconnects synchronise the entire viewer and stop its clock.
Ordinary content/layer-set updates refresh through the guarded host queue without
clearing presentation or disabling the viewer. Pre-write refresh, target/token
validation and native mutation guards remain in place. Successful refresh clears
the retry cooldown; failed reads retain the existing backoff.
Validation: 289 offline tests and package checks passed without skips. New tests
cover pending content refresh with uninterrupted clock subscription, immediate
subsequent refresh, reconnect/track-change blocking and failed-read backoff.
Beta.56 installed on Raspberry Pi, preserving current EDIT settings. Read-only
verification confirmed connected, not synchronising and no last_error. No native
edit or transport switch was performed. Actual editing latency awaits user review.
GitHub remains beta.55 until publication is requested.

# Centred connection arrows - 0.2.0-beta.55

Effect/precomp connection arrows are drawn at the visible source layer's temporal
midpoint, rather than native arrow.t. Overlapping vertical paths are separated by
8 display pixels; collapsed children use the visible group midpoint. Connections
within one collapsed row and offscreen midpoints are omitted. Native arrow data
and Designer state remain unchanged.
Validation: 286 offline tests and package checks passed. Beta.55 installed on the
Raspberry Pi; read-only verification confirmed the new viewer script and healthy
connection in the operator's VIEW mode. Browser appearance awaits operator review.
Release target: v0.2.0-beta.55, including source and clean Companion installation assets.

# Transport TC monitor - 0.2.0-beta.54

TC IN now reads the selected transport monitorString and tcStatusString in both
LiveUpdate and HTTP snapshots. Local receiver current can stay zero on a Designer
following session TC. No source produces a dash; actual zero remains valid.
Existing transport identity guards and socket teardown prevent late old values.
Read-only native probes confirmed a moving monitor while local current was zero.
Offline coverage evaluates both native reads with remote/local/no-source fixtures,
and verifies transport switching, late messages, zero and placeholder rendering.
Validation: 282 offline tests and package checks passed with zero skips.
Beta.54 installed on Raspberry Pi Companion. Read-only live/state probes returned
advancing TC IN (02:00:04:07 -> 02:00:04:15) for the same transport, connected,
not synchronising, no warnings and empty last_error. Real transport switching and
physical local TC input were not exercised; these cases have offline coverage.
No Designer settings, transports or project data are changed by this update.

# Transport-switch recovery - 0.2.0-beta.53

The transport-switch recovery fix is now installed. Read-only live_state,
viewer_snapshot and refresh return a structured context-change signal before
heavy work if GUI transport/track identity differs or no track is selected.
Mutation guards remain strict, stale actions are not replayed, and expected
context rejection triggers queued resynchronisation without setting last_error.

Connection handles context changes before discarding feedback superseded by old
LiveUpdate traffic, drops old subscriptions, and suppresses obsolete reconnects
until refresh acknowledges the new target. No-track startup continues light
polling, while heavy refresh waits for an available track. Obsolete failures
cannot invalidate a newly selected target.

Viewer snapshots carry and verify both transport and track IDs. Cache identity
includes transport; late snapshots cannot replace the new context even with the
same track UID. The viewer clock closes during synchronisation. Browser shows
SYNCHRONISING and disables stale interaction; clock merges also compare transport.
Context mismatches wait 500 ms; other snapshot failures back off native reads
for 1500 ms instead of issuing Python reads on each browser retry.

Validation: 279 offline tests and package smoke/page generation passed, no skips.
New coverage includes the real host action queue with rapid/same-track switches,
temporary/no-track startup, late responses/errors, old LiveUpdate traffic,
clock teardown, snapshot coalescing/backoff and retained native mutation guards.
A READ-ONLY native live_state probe with a deliberately mismatched expected UID
returned the context signal successfully without selecting or changing anything.
Installed beta.53 verified: connected EDIT mode, not synchronising, snapshot/live
transport and track identities agree, sync UI served, no warnings/last_error,
configuration unchanged during verification. No actual Designer transport switch
or project mutation was performed; native GUI freezing is not proven eliminated
by a show-time reproduction. Previous investigation notes below are historical.

# Shared musical steps and grid contrast - 0.2.0-beta.52

All beat timing modes (time encoder, layer timing, key timing) now share ten slots:
1/96, 1/16, 1/12, 1/8, 1/6, 1/4, 1/3, 1/2, 1 and 4 beats.
Key default is 1/96. Existing normal and layer defaults are retained. Native grid
choices support straight/triplet divisions on the 96-part lattice and reject 1/128.
The zoom grid remains a visible multiple of the selected step and native region
origins are revalidated before snaps. Grid alpha changed from 0b/20 to 20/45.
Beat-mode polling feedback is preserved and updates linked, idle editor timing
mode for the same track. Unlinked editing does not adopt playback-position mode.

Validation: 268 offline tests and package checks passed, no skipped tests. Tests
cover every slot across the three modes, labels, cycling, grid fractions, zoom,
snap validation and linked time/BPM transitions without metadata refresh.
Beta.51 was installed first; beta.52 adds mode-feedback propagation. The operator
changed VIEW/EDIT settings during work; initial preflight checks stopped before
mutations and fresh settings were preserved for each completed install.
Beta.52 installed. A configuration hash check differed again during final verification; do not claim settings remained unchanged after the install. Only module-version/runtime verification is applicable. No native writes, physical encoder
moves or live key dragging were tested. Refresh open browser viewers for CSS.
The separate transport-switch disconnection issue remains investigated but UNFIXED.

# Region-aware snap grid - 0.2.0-beta.50

Vertical grid lines and grid snap targets now share native per-region beat/time
coordinates. Read-only grid_regions walks globalBeatToLocalBeat origins backwards
and verifies the audio_sections count; unavailable or ambiguous maps disable the
grid with a warning. Region mode uses track.quant or native audio beat markers,
not a guessed BPM threshold. This supports globally quantized silent tracks,
including 60 BPM. AudioSection has no exposed fields in this installed API, as
confirmed via ClassInfo; sectionInfo exposes cue boundaries but no BPM mode.
The shared grid_context helper revalidates unit, local origin and native timing
before accepting grid snaps. Existing write guards remain.

The selected editor timing step supplies the minimum interval; zoom coarsens to
visible multiples. Key-mode fractions extend to 1/128 beat. Time grids also retain
frame alignment at fractional FPS. Viewer cache signatures include numeric steps,
browser live updates invalidate changed settings, and gesture tokens include them.

Validation: 265 offline tests and package smoke/page generation passed, no skips.
Fixtures cover mixed regions, 0/13.3/16/32-second intros, 60/92/100/123 BPM,
multiple musical regions, subdivisions, zoom, setting/cache/token changes, stale
tempo/origin/mode rejection, silent quantized tracks and fractional FPS.
Installed beta.50 verified through read-only Companion state: unchanged settings,
connected VIEW mode, second-grid intro, first beat zero at actual 16-second origin,
no warnings or last_error. Separate native READ-ONLY helper execution confirmed
1/4 and 1/8-beat grids at zoomed ranges. No native key moves, transport changes,
Designer mutations, or live browser drag tests were performed.

# VIEW/FOLLOW cursor - 0.2.0-beta.49

With VIEW and FOLLOW enabled, hide the blue edit cursor and edit clock and use
playback time for following. FOLLOW off restores the independent edit cursor.
This changes browser presentation only; native edit time/link/playback are untouched.
All 261 offline tests and package checks passed with no skips. Installed beta.49:
served cursor/clock guards verified, unchanged config, connected VIEW, no last error.
No live browser interaction or native mutation testing performed.

## Transport-switch investigation (not fixed or deployed)

Read-only checks found the current connection healthy. Code inspection shows:
- designer-script.js chooses guisystem.currentTransportManager for every command.
- Connection subscriptions remain bound to the snapshot transport UID.
- live_state sends that old UID; a GUI switch triggers the context guard.
- Connection.poll catches this as pollError without notifying onState.
- main.js tests whether the OLD transport still has its OLD track, not whether
  GUI transport selection changed; the old transport can remain perfectly valid.
- viewer_snapshot omits transport identity and reads the new GUI selection.
  The browser rejects full snapshots incompatible with the old live track,
  invalidates its full-read timer, and can repeatedly request snapshots.
- Browser CONNECTION LOST also covers snapshot exceptions/timeouts and therefore
  does not prove the transport HTTP connection itself failed.

Local simulations of production Connection.poll and the production main callback
confirmed zero state notifications after the guard error and no stale/sync request
when the old transport/track remain valid. First callback extraction attempt failed
on CRLF boundaries; normalized-source rerun passed. No transport switches were
performed on Designer. Designer UI freezing remains unverified: concurrent Python
read paths and HTTP abort not proving native cancellation are risks, not a confirmed
native deadlock. A fix should establish one explicit transport identity across
snapshot/live/clock reads, recover expected context changes, and prevent repeated
incompatible snapshot reads. Preserve all mutation context guards.

# Track audio icon - 0.2.0-beta.48

Replaced the track audio display-strip text with a five-bar SVG waveform icon.
It inherits the same button dimensions, stroke and active styling as its neighbors.
Accessible label and show/hide tooltip remain. Visibility behavior is unchanged.
All 259 offline tests and package checks passed. Beta.48 installed on the Raspberry
Pi; read-only verification confirmed the served icon and unchanged connection
settings. No Designer mutations or live browser interaction tests performed.

# Track audio visibility - 0.2.0-beta.47

The first button on the shared display strip toggles the complete track audio row,
including its waveform and beat labels. The button remains visible while hidden.
This browser-local preference survives redraws and track changes, resets on page
reload, and works in VIEW mode without sending commands or changing audio playback.
The original peak waveform and corrected audio-local beat positions are retained.
Validation: 259 offline tests and package smoke/page generation passed, with no skipped tests. Beta.47 is installed and read-only verified: the served script contains the toggle, connection settings are unchanged, connected in VIEW mode, peak waveform ready, beat zero aligned with audio at 32 seconds, and last_error empty. No Designer mutations or live browser interaction tests were performed.

# Local waveform rollback retaining beat alignment - 0.2.0-beta.46

The operator rejected beta.45 waveform loading time and requested reverting only
waveform changes, explicitly preserving corrected beat markings. WAV/MOV decoding,
disk cache identity/format and single peak-envelope rendering are restored to the
pre-RMS implementation. Existing peak caches can be reused without rereading media
when source identity is unchanged. Audio-origin metadata and the audio-local beat
overlay remain, as do their regression tests. No Designer mutation is authorized.
Validation: all 258 offline tests and package smoke/page generation passed. Beta.46 installed and read-only verified: unchanged connection settings, VIEW mode, waveform ready without RMS, audio and beat zero both at 32 seconds, no last error. No Designer mutations.

# Local Companion waveform detail update - 0.2.0-beta.45

WAV and PCM MOV decoders now retain channel-averaged RMS alongside unchanged
peak envelopes. Channels are squared independently (no antiphase cancellation);
the last bin uses its actual sample count. RMS is rounded to six decimals and
validated in the disk cache. A versioned waveform key triggers one source reread
without clearing thumbnails or touching media. Browser overview aggregation uses
weighted squared RMS, not max RMS, and raises its sample budget when zoomed in.
Bright average energy sits inside faint transient peaks without normalization.
The waveform beat/bar overlay now uses the same audio-local origin and omits
markers before the audio starts. The main timeline grid and snap targets remain
global; Designer edit commands and audio playback are unchanged.

Validation: all 260 offline tests and package smoke/page generation passed.
Coverage includes sparse vs sustained equal-peak audio, stereo antiphase energy,
partial bins, MOV RMS, cache validation and waveform-only beat-grid alignment
across timed intros and multiple tempos. Beta.45 is installed on the existing
Companion connection; beta.44 remains available for rollback. Installed read-only
checks confirmed connected/VIEW, unchanged configuration, no errors/warnings,
8187 peak/RMS bins, and matching audio/first beat origins at 16 seconds on the
then-current track. No Designer project, selection or playback mutation occurred.

# Local Companion track-audio placement fix - 0.2.0-beta.44

The viewer snapshot resolves the current audio origin with
`track.beatToTime(globalBeat - track.globalBeatToLocalBeat(globalBeat))`.
This reads native timing only; it does not move the playhead, change selection,
modify audio markers or write project data. Placement is rounded to nanoseconds
so harmless floating-point noise does not force redraws. Unknown placement shows
an explicit unavailable message. Track-audio identity/placement participates in
renderRevision; Audio-layer clipping and positioning are unchanged.

This remains a source waveform for the audio at the current playhead, not an
all-section waveform or nonlinear audio-warp renderer. The audio-free intro has
no current track audio, as before. Do not infer support for edited source beat
markers, loops or every audio-section configuration from this offset fix.

Validation: the regression first failed on the original zero-origin renderer.
256 offline unit tests passed, including 38 isolated Python timing/error cases
and rendered SVG placement/clipping checks. Bounded read-only Designer queries
confirmed an audio-free intro followed by audio-local beat zero at 16 seconds.
No native or installed mutation suite was run. Package constructor/action smoke
checks and clean page generation passed. Beta.44 was imported into Companion and
selected on the existing connection; beta.43 remains installed for rollback.
The connection configuration hash and VIEW mode were unchanged. After Designer
was started by the operator, installed read-only verification returned connected,
no errors/warnings, a ready waveform and a 32-second track-audio origin on the
then-current track. No playhead/selection/project mutation was performed.

Build environment note: full npm ci failed because the locked @pkgr/core 0.3.8
tarball returned 404. Runtime dependencies were installed with npm ci --omit=dev;
only the necessary build dependencies were then extracted from the exact locked
tarballs after integrity checks. Dependency versions/integrities were unchanged.
The standard npm run package command completed with those build dependencies.
GitHub publication is not authorized for this update.

# Current release - 0.2.0-beta.43

## Deferred Designer diagnostics (operator decision, 2026-09-20)

The operator requested postponing investigation/fixes for both issues below. Their
severity and root causes are not established; do not assume they are minor or fixed.

- Native ThumbnailSystem / ImageIO::copy ACCESS_VIOLATION (null read): initially
  reported once, then associated by the operator with an intermittently flickering
  VIDEO layer. The exact layer was not identified. Two VIDEO layers referenced the
  same PNG test pattern; metadata confirmed the file existed, not that thumbnail
  decoding was healthy. No layer/media was changed during diagnosis.
- Native duplicateLayer triggered TrackWidget.refresh with "Access to object of
  type 'Widget' is not allowed" during the installed integration run. Independent
  data readback passed despite this native GUI callback error. Do not bypass Widget
  access restrictions or claim duplication is free of native UI errors.

When investigation resumes, separate thumbnail generation from resource rendering
and inspect native GUI diagnostics alongside data assertions. Reproduce only in an
authorized disposable test environment. Numeric suite success cannot certify absence
of asynchronous Designer renderer/GUI errors. No corrective build was made for these
reports; beta.43 remains the installed/published version.

Supersedes the local-only publication status in older entries below. The user
authorized Companion installation and GitHub publication after testing.

Installed testing exposed successful native creation followed by rejected selection
when the unlinked edit clock was outside the new layer. Create/duplicate now select
IN through the shared clock policy. An oracle error was also fixed: group display
fields aggregate children and are not native fields on GroupLayer.

Validation: 251 unit tests, package smoke checks, 1,128 detached native assertions,
34 installed cases passed. Video/Bitmap FIT skipped for durationless resources;
Audio FIT passed. Original layer bounds/names/parents remained unchanged. Test
fixtures remain in the authorized track. Reports and UID journals stay in .tools.
No physical Deck, browser FPS or exhaustive native layer/resource certification.

After the installed run, the operator reported one native ThumbnailSystem
ACCESS_VIOLATION. Designer remained responsive and the error did not recur at that
time. The cause/resource is unconfirmed; retain the existing known limitation and
do not label the release crash-free. Do not stress-reproduce on a live show.

Read REGRESSION-TESTS.md before further testing. Maintain public assertions with
each behavior change. Installed runs mutate the named active test track; native
runs use detached fixtures. CONTRIBUTING.md explains branch/PR collaboration.

# Companion-only header key curve fix - 0.2.0-beta.42

Resolve numeric curve targets through the matching parameter diamond by layer/parameter/time, independently of the dragged header diamond. Single-key header time drags now preview the same curve and receive native curve acknowledgements in the parameter lane. Header time drags retain the value instead of interpreting pointer Y as an absolute curve value. Resource/discrete markers remain excluded.

# Companion-only curve tail fix - 0.2.0-beta.41

Use a shared numeric preview sampler for pointer and wheel editing. Missing previous/next keys mean the leading/trailing plateau follows the edited value fully; layer IN/OUT are temporal bounds, not fixed-value neighbours. Retain the final single-key preview through acknowledgement until the next native snapshot. No native edit commands changed.

# Companion-only layer handoff fix - 0.2.0-beta.40

On ordinary layer move/trim completion, redraw from the confirmed patch atomically to discard temporary CSS translations before live geometry paints absolute key positions. Disable inherited geometry transitions and cancel native curve animation when starting a drag. Group previews remain until a full snapshot; suppress partial live geometry over their translated lanes. Resource keys now consume mediaFields in confirmed editor patches. Retained wheel curves follow confirmed whole-layer translation.

Validation: local tests and package checks; live viewer readiness only, no user-track mutations. GitHub unchanged.

# Companion-only gesture fix - 0.2.0-beta.39

Selection/mode commands no longer create a blocking pending parameter-row overlay. Shift marquee disables text selection, clears native browser selection, and cleans up lost pointer capture. Multi-key replies update native identities without repainting an older pointer position. Group moves support the existing throttled native curve sampling. Wheel/drag previews cancel outstanding live curve animations and CSS position transitions; confirmed final local curves remain until a fresh snapshot, including across consecutive wheel bursts.

Preserve vertical scroll on the first redraw after a pointer edit of the same layer, and disable browser scroll anchoring in the timeline. Explicit later layer/parameter selections still reveal normally.

Validation: local regression batch and focused gesture tests; no live project mutations for this fix. GitHub unchanged.

# Companion-only presentation update - 0.2.0-beta.37

Extend DOM-only optimistic feedback to marker/resource/value/layer operations and transport/link controls. Pending placeholders do not invent native UIDs, hierarchy or timing results. Acknowledged previews survive until a fresh revision-checked snapshot; failures roll back without retry. Multi-key drags preview numeric curves. See VIEWER-DEVELOPMENT.md for limitations and the reusable presentation queue. Validation: 238-test local batch plus two targeted DOM-preview tests passed; package checks passed. Installed beta.37 viewer reports LIVE with no visible error. No destructive live edits or sustained frame-rate benchmark were run for this update. GitHub unchanged.

# Companion-only update - 0.2.0-beta.37

Multi-key mouse drags preview numeric curves from captured native samples, warping sample times between selected and stationary key anchors. Values and authoritative snapshots remain unchanged. Supports dragging either header or parameter diamonds; discrete/resource rows do not become curves. Native samples replace the transient preview after confirmation.

# Companion-only update - 0.2.0-beta.36

Move viewer shortcut instructions into a native dismissible HELP popover (info icon before interface size controls). The footer takes no space while messages and warnings are empty; operational warnings remain visible. No editor or native command logic changed. GitHub unchanged.

# Companion-only update - 0.2.0-beta.35

Local seek preview overlays the clock/position without changing authoritative state; queued newer seeks keep their own preview until acknowledged, failures restore confirmed time. Numeric key insertion shows a non-interactive pending diamond; confirmed keys can render before curve samples arrive. Existing pointer/wheel curve and layer geometry previews remain. Value-entry labels preview locally, edit responses reject stale track/session/revision contexts, and confirmed patches redraw immediately. Destructive/hierarchy/resource operations still require native confirmation rather than inventing IDs or metadata. Wheel editing shows a small three-decimal value popup near the pointer for 900 ms. UI sizes remain 100/120/140.

Validation: 233 local tests and package checks passed, covering failed/late acknowledgements, newer previews, independent clocks and wheel popup formatting. Installed Companion reports LIVE. No claim of guaranteed browser FPS or complete optimistic coverage of all operations. GitHub unchanged.

# Companion-only optimization - 0.2.0-beta.33

Numeric viewer insertion reduces native requests from refresh/seek/read_field/key_set/select_key to refresh/seek/key_set. evaluateCurrent reads the native value atomically during key_set; select the inserted key from the write response. Resource picker flow and ordinary encoder writes remain unchanged. Validation: 226 local tests, package checks and 528 detached native checks across time and 60/120/123 BPM, including atomic current-value preservation. No measured end-to-end browser latency claim. GitHub unchanged.

# Companion-only fix - 0.2.0-beta.32

Measured remaining rollback in the independent ViewerClock subscription: it overwrote confirmed editor time with cached socket samples despite matching edit revisions. ViewerClock now discards samples after an edit revision changes and respects the bounded pending-seek target before overriding the shared clock. Linked viewer time follows editor time; unlinked keeps native transport separate.

Validation: 225 local tests and package checks passed. On installed Companion, eight alternating seeks with 128 live/full readbacks reproduced rollback before the clock fix and reported zero mismatches afterwards; initial time restored. No sustained playback or browser frame-by-frame guarantee. GitHub not updated.

# Companion-only fix - 0.2.0-beta.30

Explicit viewer seeks reset playback interpolation. Newly created playhead DOM segments never animate from their default position; subsequent continuous playback still uses the existing transition. 223 local tests and package verification passed. No GitHub publication.

# Companion-only fix - 0.2.0-beta.29

Full viewer snapshots must not inherit time/timecode/value or focus rejection from cached live feedback whose edit revision predates the snapshot or the latest confirmed edit. See mergeLiveClock and viewer-seek-queue.test.js. 221 local tests and package checks passed. GitHub remains unchanged.

# Installed build - 0.2.0-beta.28

Companion-only build: protect confirmed seek transport time from delayed feedback and same-track refreshes, return the seek revision, and apply the confirmed timecode with the position. FOLLOW geometry no longer updates parameter controls per animation frame; cache DOM references per draw and avoid unchanged text writes. 220 local tests and package checks passed, including delayed feedback, rapid seek ordering, unlinked clock isolation and a simulated 1,000-parameter/600-frame workload. No GitHub publication authorized for this build.

# Installed build - 0.2.0-beta.27

Fix ruler clicks being consumed by the key-selection release handler. A deliberate seek waits for the final mouse write, coalesces pending clicks and drops requests after track/token/permission changes. Fresh seeks skip the full refresh; native Designer validates the track and frame-snaps against current timing. Existing write serialization and VIEW/LINK TIME rules remain.

Avoid sampling constant curves; reuse drag labels and cache key-marker selection lookup, invalidating it on every draw. Validation: 215 local tests, package callback checks, 516 detached native checks and read-only installed Companion checks passed. This does not certify sustained browser frame rate or physical encoders. Package installed locally; no GitHub release made for this build yet.

# Previous release - 0.2.0-beta.26

Add reusable regression scripts and REGRESSION-TESTS.md. Run offline tests and packaged Companion actions with node scripts/regression.cjs. Native tests are opt-in; keep private reports under .tools. Preserve this runner for future development.

Native testing found exact IN/OUT seconds-to-beat roundoff at 123 BPM. Layer-bound parameter, default, numeric/resource key operations now preserve exact native endpoints within 1e-7 seconds. No frame-size clamping was introduced.

Validation: 209 local tests, package checks, 516 detached native checks across VIDEO/BITMAP/AUDIO and time/60/120/123 BPM tracks, plus three read-only installed Companion variable checks. Native mutations did not pass through the installed Raspberry Pi; packaged Companion callbacks and native commands were tested separately. No physical Stream Deck, browser gestures, show playback or reboot certification.

# Previous release - 0.2.0-beta.25

CLEAR MEDIA CACHE is a one-shot connection setting: select and save to clear waveform disk data and restart this connection's memory caches. Thumbnails now persist alongside waveform summaries under a shared 100 MiB cap. Native resource/file identity is revalidated before reuse; unsupported identities use the native endpoint. Reload viewers afterwards. Clearing respects other processes' writer lock and never recursively deletes folders. Validation: 209 local tests including pending-write ordering, foreign-file preservation, active-writer rejection and thumbnail reuse across client recreation. Native identity resolution passed for two current video resources. A physical Pi reboot was not tested.

# Previous release - 0.2.0-beta.24

Add a 100 MiB persistent waveform-summary cache on the Companion host. Identity includes resource, project/file path and source revision; only peaks are stored. REFRESH bypasses and replaces disk data. Cache failures fall back to decoding. See VIEWER-DEVELOPMENT for paths, eviction, crash-lock cleanup and deployment limitations.

Validation: 207 local tests, including persistence, identity misses, corruption, quota eviction, failed writes and forced refresh. No physical Pi restart or SMB throughput test was run for this change.

# Previous release - 0.2.0-beta.23

OUT is the end of the final displayed frame, not its start. Editing and key selection include exact OUT; playback visibility does not. NEXT with no later key now targets exact OUT in native and local navigation, preventing a backward one-frame jump after an OUT key. Do not move OUT keys earlier to compensate for black playback at that boundary. Existing OUT focus retention remains in effect.

Validation: 11 focused local tests (including 25, 30, 29.97 and 59.94 navigation cases) and an isolated native Designer OUT-key navigation check. No user track was modified. The full local suite passes (204 tests).

# Previous release - 0.2.0-beta.22

Ordinary VALUE encoder edits now emit the same confirmed geometry patches as SELECT KEY and LAYER EDIT. This path was previously missing when moveKey was null, leaving key/curve updates waiting for a full snapshot. Sequenced VALUE edits request throttled native curve samples, and pending same-direction VALUE turns can batch without an explicit key-selection mode. Mouse preview behavior is unchanged.

Validation: 203 local tests, including the regression that a plain VALUE change emits a geometry patch with neither key nor layer edit active.

# Previous release - 0.2.0-beta.21

Confirmed encoder patches now update existing layer bars, IN/OUT markers, key markers and curve paths instead of reconstructing the entire timeline. Geometry uses a short 65 ms visual interpolation; native destinations remain authoritative. Heavy state requests wait until 400 ms after the last applied patch; stale in-flight reads cannot replace a newer patch. Cached curve sample times translate with ordinary layer moves and remain absolute when trimming.

Validation: 202 local tests including node-preserving geometry and shared curve-reference regression tests. A read-only LAN measurement before this change observed 1–2 ms warm live requests versus 232 ms for an uncached 537 KB full state; these numbers are environment-specific, not a latency guarantee.

# Previous release - 0.2.0-beta.20

Companion encoder edits coalesce adjacent identical pending detents (maximum 64) behind an in-flight command. Clicks, reversals, different options and generation changes are barriers; keyframe multi-selection remains unbatched. Native key moves simulate intermediate detents to preserve collision and boundary behavior. Layer edit returns only the edited layer instead of re-reading every layer.

Confirmed edited-field/layer patches are available on the fast viewer channel for 500 ms and carry revision checks. Numeric key curve previews are sampled at most once per 100 ms. No speculative writes or automatic retries were added.

Validation: 200 local tests, native grouped-child move/IN/OUT checks, and native batched-key collision check. The controlled queue test combines 20 pending turns into one call; no measured physical Stream Deck latency claim is made.

# Previous release - 0.2.0-beta.19

Parameter selection includes exact layer OUT (with floating-point tolerance) in both linked and independent edit clocks. Times beyond OUT remain invalid.

A single group context menu offers UNGROUP, DELETE and CANCEL. DELETE removes the group and its contents through native Track.removeLayer after existing hierarchy, timing and descendant lock checks. UNGROUP retains the children. VIEW blocks both writes. Validation: local suite and 11 isolated native grouping/deletion checks.

# Previous release - 0.2.0-beta.17

Group rows and bars use their distinct color without an icon or thumbnail. Timing behavior is unchanged.

# Previous release - 0.2.0-beta.16

Group bars can be dragged in time; group IN/OUT handles remain read-only. The guarded group_move command uses native GroupLayer.setExtents for translation only, moving nested children and sequence offsets once. Payloads validate the complete ordered subtree and current bounds; locked/anchored descendants and locked ancestors reject before writing. VIEW blocks the operation. Snapping excludes the entire moving subtree and its ancestors. Native beat translation preserves internal beat spacing, including key positions.

Groups use a muted violet tint and a folder/group icon instead of media thumbnails.

Validation: 197 local tests, isolated native time and 123 BPM nested-group translation and stale-bound rejection (8 checks total). Group lock checks are implemented but were not exercised against native locked layers in this batch.

# Previous release - 0.2.0-beta.15

Moving a child layer no longer offers its own ancestor groups as snap targets: their bounds can follow the same child. Unrelated group edges are validated natively alongside ordinary layer edges. This prevents a reproducible snap rejection during group-child drags without bypassing stale-target checks.

Validation: 195 local tests; isolated native child move/IN/OUT checks and snapping to a group-only boundary. No exhaustive physical Stream Deck or show-time test was run.

# Previous release - 0.2.0-beta.14

Grouping now triggers Designer timeline hierarchy refresh through a native no-op sibling reorder after group/ungroup. Data-only grouping previously left the open native timeline stale. First Shift layer selection includes the ordinary active sibling; the group popup shows selected count.

Validation: 194 local tests, 11 isolated native time-track grouping checks, 18 quantized checks; browser fixture active-selection extension and group confirmation. Existing native GROUP became visible after the notification without timing/order changes.

Group timing inspection on isolated native layers: moving group [10,30] to [15,35] shifts child bounds and keys +5. IN [15,30] shifts child starts +5 while ends and keys remain; OUT [10,25] shifts child ends -5 while starts and keys remain. Group bounds are still read-only in the viewer; do not apply ordinary layer edit math to groups. These findings are for native setExtents in Designer 32.4, not an exhaustive GUI modifier-mode test.

# Previous release - 0.2.0-beta.13

Numeric keyframe hover time/value labels show at most three decimals, trimming trailing zeroes. Display formatting only: stored values and edit precision remain unchanged; choice/resource labels remain text.

# Previous release - 0.2.0-beta.12

Interface sizes are SMALL 100%, MEDIUM 110%, LARGE 120%. Geometry tests cover all three factors; saved size names automatically use the new factors.

# Previous release - 0.2.0-beta.11

Interface size buttons use the waveform height controls' one/two/three-line icons. SMALL/MEDIUM/LARGE remain accessible names and hover hints.

# Previous release - 0.2.0-beta.10

Track header: NAME @ FPS, duration, then optional TC IN: and incoming timecode. No redundant TC mode suffix. Typography remains shared.

# Previous release — 0.2.0-beta.9

Incoming timecode label shortened to IN:. Both track metadata and input timecode use 11px text and share UI scaling.

# Previous release — 0.2.0-beta.8

Browser-local SMALL/MEDIUM/LARGE sizing (100/105/110%) covers controls, popups and pointer geometry. Track heading includes native FPS, duration and TC/BEAT mode. Optional TC IN: reads raw transport input, hidden if no source is configured. See VIEWER-DEVELOPMENT.md for normalization and source API details. 194 local tests passed. Real incoming LTC/MTC signal remains untested; installed viewer displays configured LTC input at 00:00:00:00. Browser checks confirmed 105/110% sizing, saved size after reload, VIEW preservation and no console errors.

# Previous release — 0.2.0-beta.7

## Layer grouping and inspection

Shift-click layer headers/bars to toggle a selection, or Shift-drag across layer rows to select multiple siblings. Right-click a selected layer, enter a name and choose GROUP. Right-click a group and choose UNGROUP. The native Designer commands preserve layer UIDs, timings, keys and hierarchy; click order does not affect composition order. The group occupies the highest selected layer's position. Mixed parent selections, locked descendants and stale structure/bounds are rejected before mutation. Nested groups are supported. Group collapse/expand is local presentation and works in VIEW; grouping/ungrouping never does.

The browser sends bounded layer snapshots plus the exact sibling/child order through layer_group. designer-layer-groups.js owns native preflight and calls Track.groupLayers / Track.ungroupLayer; viewer-editor.js validates schema, current shared token and track. Hover readouts reuse the existing TC formatter for IN/OUT and key times; keys also show numeric values, choices or resource names. No write is sent for a tooltip.

Validation: 191 local tests; 11 isolated native grouping checks on a time track and 18 on a quantized track with 60/120/123 BPM. Browser fixture checks covered Shift selection, group/ungroup, local collapse/expand and VIEW. No exhaustive physical Deck test or large-track performance matrix was run.

Designer workflow reference: https://help.disguise.one/designer/layers/editing-layers/grouping-layers

# Previous release — 0.2.0-beta.5

Sticky 22px LAYERS divider below NOTES controls sequenced/all/hidden parameter rows for all layers, using the existing icons. Display only, available in VIEW. Bulk expansion requests allDetails so native metadata/curves are not limited to the ordinary 16 explicitly expanded rows. Track waveform stays sticky below the divider.

# Previous release — 0.2.0-beta.4

VIEW hides LINK TIME and the entire SNAP control group. LIVE restores them without changing snap preferences. The S shortcut is inactive in VIEW.

# Previous release — 0.2.0-beta.3

## LIVE / VIEW safety mode

Click the connected LIVE/VIEW status to switch the entire module. VIEW forces LINK TIME off and keeps local time, layer/parameter browsing and zoom available. It blocks Designer edits, transport commands and real playhead changes from both browser and Companion. Returning to LIVE leaves LINK TIME off. Connection errors disable the mode switch.

The mode is saved in module configuration. DesignerClient uses a fail-closed native read allowlist and rechecks transport writes after asynchronous state reads. Only audited seek operations with keepPlayhead=true are allowed. Main invalidates the action queue, waits for the active action and clears editing state; an HTTP command already dispatched before locking cannot be recalled. The server enforces VIEW independently of browser controls. This protects this module, not other controllers or Designer itself.

Validation: 189 local tests and package lifecycle checks passed. Installed on Companion and checked LIVE/VIEW in the browser. A VIEW OUT click changed only local inspection time; Designer time and stopped transport remained unchanged. Returning to LIVE kept LINK TIME off; browser error log was empty. No exhaustive physical Stream Deck test was run.

# Previous release — 0.2.0-beta.2

Multi-key selection is scoped to one parameter and stored as moveKey.group, with the first key as the Deck anchor. Mouse drag passes anchorTime for the actual grabbed member. Native key_group validates all keys and destinations before mutating one sequence; collision is a no-op, failures restore saved sequence contents. Group value/type/resource changes are disabled. Shift-marquee is viewer-local until a guarded selection is confirmed.

The 0.2 series consolidates 0.1.0-beta.159 without runtime changes. Release bundles now live in releases/0.2.beta. Historical test reports retain their original versions.

0.2.0-beta.2 consolidates 0.1.0-beta.159 without runtime changes. See the developer manual continuation checklist. Build outputs are under releases/0.2.beta. Validation: 182 local tests plus package lifecycle checks; historical live reports retain their original scope.

curvePreviewDue limits additional native curve sampling to 100 ms per track/layer/field, not writes or validation. Skipped requests must not return stale samples as authoritative curves. Browser re-applies latest local preview after older acknowledgements; normal post-release geometry restores the complete native curve. Isolated 200-key native benchmark measured ~1.2 ms field snapshot versus ~3.2 ms including 490 curve samples; this excludes network/Companion/UI latency and is not an end-to-end speed claim.

Parameter gear/reset use parameter_sequence, strict request schema and current selection token. Native code validates locks, active edit time and expected sequencing before evaluating current/default values. Clear/reset reuse reset_sequence_to_constant and cover keys outside layer bounds. Enable writes native current resource/float at edit time (numeric SMOOTH). Confirmation binds to the selected parameter token. Eight isolated native assertions passed for FloatSequence and ResourceSequence.

Drag labels use viewer_snapshot.dragTimecodes (segment starts, native TC seconds and a probe label to identify drop-frame numbering) and the shared browser timecode formatter. No native calls per pointer event. Labels are disposable and removed on pointer release/cancel, Escape or redraw. Duplicate marker highlighting uses all annotation tags, grouped by type; NOTES are excluded. Public helper viewer-marker-duplicates.js is embedded in the viewer and unit tested.

Supersedes track-relative marker popup times: annotation_time reads a native label via resolve_timecode(time); annotation targetLabel resolves within annotation_edit against current TC segments. Unchanged times keep exact seconds. Direct layer-bar drag selects point=in before entering layer edit, matching click semantics for inactive layers.

Marker popup track-relative time uses HH:MM:SS:FF (shared timecode formatter, fractional FPS conversion). Leaving the formatted field unchanged preserves the original subframe position. This is track-relative time, distinct from the TC marker's content.

Marker popup includes current track-relative seconds and DELETE. Changed time uses the existing guarded move command; unchanged time updates content. Native deletion verifies source text/time and removes only that tag type or note, preserving the cue/section and other tags. All four types passed add/move/delete on an isolated native track (seven assertions).

Explicit viewer OUT clicks seek to layer.end exactly, superseding the old OUT-minus-one-frame policy for that gesture. Active layer bounds include OUT so focus remains on the layer after feedback/refresh; covered in linked and independent clock tests. Previous/next key navigation retains its own last-visible-frame policy.

Refresh's preserve-selection branch requires an actual layer. Undefined previous/current layer and parameter IDs otherwise compare equal and crash on mediaFields before viewer seek. Regression covers empty tracks with both linked and independent clocks. Reproduced against Designer and verified fixed at the current native time.

Selection reveal includes visible parameter rows. viewer-selection-scroll.js is embedded into the browser bundle and tested as a pure geometry function: fit the entire layer block when possible, otherwise reveal the chosen parameter (fall back to the layer header). Reveal identity includes track, layer and parameter. Manual scroll remains unchanged until selection changes.

The normal first dial toggles LAYER/ZOOM while a browser has polled the viewer within three seconds. ViewerServer owns a cumulative zoom counter, consumed once per browser through the lightweight live channel; rotation never writes Designer data. Browser reload/visibility changes reset the cursor to prevent replay. Existing resource, layer-edit and selected-key modes keep their normal routing. Closing the viewer expires zoom mode. Zoom uses the existing active-playhead-centred browser function. After draw, a changed track/layer identity reveals its header vertically, accounting for sticky annotation/audio rows; routine redraws retain manual scroll.

XL uses larger 25% control text and 60% numeric keys. Timecode stays on one line at 17%. The keypad is an eight-digit shift register: explicit leading zeros are accepted, excess input replaces the oldest digit, BACK removes the newest, and pressing the time display clears input. Keep numeric input local; only JUMP refreshes Designer context.

Validation: 175 local tests and package checks passed; seven isolated native section checks preserved notes and layer timing. Native timecode resolution was verified without seeking. The XL page is installed on Companion page 5 using the existing connection. Numeric input is local and bypasses stale-selection refresh; JUMP refreshes and validates the original track before resolving time.

Maintain both generated Companion pages through scripts/build-page.cjs. The XL export shares preset definitions and Plus typography; never maintain a hand-exported page containing user settings. The builder must preserve feedback options (timing slot / playback operation) and both foreground/background overrides. test/xl-page.test.js guards these contracts. release.ps1 includes both pages in the install ZIP; GitHub releases must attach both page assets.

The rightmost three XL columns are a fixed numeric keypad. Editor.enterTime owns bounded input, track identity, inline validation and native timecode resolution. resolve_timecode is read-only: native TC parsing plus segment candidate validation against beatToTimecode; ambiguous repeated labels choose nearest edit time. Final seek uses existing linked/unlinked policy.

Section edits use native splitSectionAtBeat/mergeSectionAtBeat on the current guarded track, reject locks, and preserve tags/notes. Native isolated checks covered cut, merge, initial boundary no-op and note preservation. PLAY LOOP uses /api/session/transport/playloopsection. Successful play mode is shared by presets/viewer/Space and refreshed from guarded REST transport feedback.

# Previous release — beta.132

Validation: 169 local tests and packaged lifecycle checks passed. This release consolidates timing catalogs and labels; no broad native layer or playback matrix was run.

Plain layer name/bar clicks explicitly select point=in, including inactive layers. Parameter labels remain restricted to active edit time. The existing shared seek path routes to Designer while linked or blue edit time while unlinked; drag preparation remains unchanged.

# Beta.131 — clearer LCD labels

Companion headings use 90% of the text element height; primary values use 78%. Value title shows only precision, and time title only step plus FPS, including selected-key mode. The larger keyframe dot sits next to PARAMETER in normal mode. Existing installed pages need the corresponding style update or a clean page import; module updates alone only change variable text. Ten time steps from beta.130 are included.

# Beta.130 — ten time steps

Time presets and dial cycling use ten ordered entries: frame, 0.5/1/2/5/10/30 seconds and 1/2/5 minutes. TIME_STEP_LABELS centralizes labels. Persisted preset slot IDs remain unchanged; labels/actions adapt to the new order. Beat-mode catalogs are unchanged.

# Beta.129 — adaptive presets

Editor.timeStepChoices is the shared ordered step catalog; setTimeStep selects a slot without seeking or releasing the key/layer mode. definitions.js exposes ten adaptive presets and transport/link controls, while main.js publishes timing_step_0–9 and selection/availability/transport feedback on every publish. Unused slots are no-ops. Transport controls bypass delete-menu dial routing so STOP remains available. Presets use connection-scoped variables and can be placed on other decks without changing the generated page.

Validation: 168 local tests and packaged lifecycle checks passed. Installed beta.129 on Companion; both preset groups were visible. Viewer transport and add-layer buttons all measure 24 px high, with no browser errors. No broad native playback matrix was run for this update.

# Beta.128 — compact transport controls

Viewer transport controls use the shared queue and guarded native transport identity, with HTTP paths isolated in designer-api.js. PLAY/PLAYSECTION/STOP use the flat transport reference envelope; section jumps use the nested reference envelope. State is read immediately before toggle. Last successful PLAY or PLAYSECTION mode is shared in Editor and retained through stop; initial mode is PLAYSECTION. These controls always affect real Designer transport, leaving unlinked edit time intact. Space is handled only within the viewer document, excluding input/contenteditable fields, popups, modifiers and repeat.

Targeted client/editor tests passed; Designer live playback was not exercised as part of this small UI update.

# Historical release — beta.127

Authorized for GitHub publication. Installed on Raspberry Pi: beta.127. Uses separate editing/transport clocks, green Designer time and smaller blue edit time. Stale unlinked refresh no longer calls a write-context guard; background timecode samples retain the edit-time label. 165 local tests pass, including updated expectations for LINK TIME and active-time layer selection. Source/package publication excludes private probes, credentials and local media. Final browser check verified a Deck time step at blue 00:00:00:01 independently of the real transport, idle guides absent, browser errors empty and Companion last_error empty. LINK TIME restored ON after verification. Read the beta.125 notes below as the current timing specification; beta.122–124 policies are superseded.

# Beta.125 — separate editing clock

Supersedes beta.123/124 timing policy. Editor.time is the active editing clock; Editor.transportTime is actual Designer feedback. LINK TIME defaults ON. Unlinked mouse seeks, marker clicks, key navigation and Deck time rotation move only edit time; native editTime/keepPlayhead keep parameter evaluation and writes at that time without transport commands. Layer selection is filtered at edit time. Switching LINK TIME clears key/layer/resource/delete modes, adopts actual transport time and never seeks Designer. Track changes reset the editing cursor to the new track time. Stale tokens include unlinked edit time.

Viewer shows a blue edit cursor and a smaller blue clock below the green transport clock while unlinked. FOLLOW/zoom use the active editing clock. Extra alignment guides appear only during mouse movement or briefly after Deck adjustment. Ordinary time grid stays visible.

DUPLICATE reapplies identical native extents to trigger the same update path as layer timing edits; isolated verification confirms extents and key times remain unchanged. Immediate appearance in the external Designer UI still requires user acceptance.

Validation: 15 focused local tests, package smoke checks and a bounded isolated native batch covering numeric/resource insertion away from transport, movement and duplicate timing preservation passed. No broad live matrix; no Git publication.

# Beta.124 — shared LINK TIME

Supersedes beta.122 PIN TIME. LINK TIME defaults ON in the shared Editor. Both mouse and Stream Deck key/layer editing follow transport while enabled. When disabled, scoped edit commands preserve transport and retain the edited layer even outside the playhead. Explicit seeks, PREV/NEXT KEYFRAME navigation and the normal time dial still move transport. The browser toggles server-owned state through a validated token-protected link_time command; every viewer observes that same state. The setting is session state and resets ON at module startup.

Validation: 16 focused local tests passed, covering both modes, switching modes during key selection, Deck key/value/layer controls, explicit seek, normal time rotation and deletion regressions. The normal context pad 3 now toggles LINK TIME instead of playback, with active color following the shared setting. Resource and clear-menu pad behavior is unchanged; the explicit play_stop action remains available. Native timing commands are unchanged from beta.122. No broad live test or Git publication.

# Beta.122 — pinned editing and layer deletion

PIN TIME beside FOLLOW defaults on. Viewer selection and edits pass a request-scoped keepPlayhead flag; native selection/key/layer commands retain the real transport position. Explicit timeline/marker seeks still seek. Turning PIN TIME off retains the previous seek/follow editing behavior. Edited inactive layers remain selected until an explicit seek, layer change or track change; transport feedback remains authoritative.

Layer context menu adds DELETE after DUPLICATE. Delete removes a selected key first; a directly selected layer can otherwise be deleted with Delete. Parameter-only selections, text inputs, open menus and resource browsing do not fall through to layer deletion. Native deletion validates track, UID, name, extents and lock state, then uses track.removeLayer. Removed targets are not reselected.

Validation: 162 local tests and package smoke checks passed. An isolated native batch checked both PIN TIME states for numeric and Video/Mapping/Palette resource key movement, layer move/IN/OUT, and guarded deletion of Video/Audio/Bitmap. This is targeted regression, not every-layer certification. Installed locally on Raspberry Pi; Git publication remains paused.

# Beta.121 — clickable constant resources

Unsequenced resource values, including NONE, open the parameter-specific picker when clicked in the value column or resource card. They use existing selection in REPLACE mode, without inserting keys. Carrier cards absorb double-clicks to avoid accidental insertion. Verified in the live browser with Video NONE and resource controls for Mapping/Palette/Output/CDL; no browser errors. Local Raspberry Pi update, no Git publication.

Layer name drag reorders vertically, with a drop line; clip drag still edits time. Reorder validates exact sibling UID order and remains within the same parent. Native root and grouped-leaf ordering were tested without changing extents or group membership. Whole groups also reorder among their siblings, preserving all children.

# Beta.120 — layer creation, context menu and group-safe ordering

An edit-only +VIDEO/+AUDIO/+BITMAP group sits before FIT TRACK. New layers start at the clicked playhead time, last 10 seconds or 4 beats on beat tracks (quarter-beat start), and clamp to track end. Right-click a layer label/bar for RENAME, DUPLICATE or FIT TO CONTENT. Native duplicateLayer preserves Designer-owned layer data. Rename/duplicate/fit validate track, UID, name and bounds; locked layers reject edits. Empty-resource FIT returns unchanged rather than calling unsafe native resourceDuration. New/copied layers are selected through the shared Editor. 159 local tests plus isolated Video/Audio/Bitmap operation and stale-target checks passed. No Git publication.

# Beta.117 — compact value popup

Click a parameter value or right-click a numeric/list key to open its compact value editor. Numeric values use an input and APPLY; enums use native option buttons. The selected key is edited, or the closest visible key when opening an animated parameter value without a current selection. Constants stay constant. There is no new toolbar. value_set reuses adjustLiveValue / native adjust_value with an absolute target, metadata validation, expected key and expected scalar value checks. Popup tokens are captured on open to reject later Deck selection changes. Native and 156 local tests passed; publication remains paused.

# Beta.116 — categorical parameter lanes

Native options and booleans are marked discrete. Viewer renders named state intervals and time-only key handles instead of curves; interpolation menus and numeric vertical dragging are disabled for those handles. Designer writes/interpolation are otherwise unchanged. Curve sampling is skipped for discrete fields. Unknown enum mappings remain explicitly UNKNOWN. Native metadata audit covered 93 classes and 155 list fields with no errors; three unmapped fields belong to RenderStreamModuleBase. 155 local tests passed. This is metadata coverage, not playback certification. Git publication remains paused.

# Beta.115 — project-relative resource folders

Resource catalogs use PROJECT as their common display root. Only the native parameter-compatible catalog is included. Project paths are made relative to Designer's project directory; external resources are grouped under PROJECT/External without exposing drive/share/machine hierarchy. Native resource paths and UIDs remain unchanged. 153 tests and native Video/Mapping/Palette catalog checks passed. Local update only.

# Beta.114 — final-key deletion

Deleting the final animation key now uses Designer's constant-carrier representation, disables sequencing and preserves the evaluated value/resource instead of rejecting deletion or restoring defaults. Expected-key and layer-lock guards still apply; no confirmation is required for a single selected key. Numeric and Video/Mapping/Palette resource cases passed isolated native checks; 153 automated tests passed. Local Raspberry Pi update only; Git publication remains paused.

# Project handoff — beta.113 local candidate

Beta.113 is installed on the Raspberry Pi; Git publication remains paused for acceptance. Blank-lane double-click uses one guarded key_insert request. It pins the clicked time across delayed native transport feedback, creates the first numeric key, or opens the parameter-specific resource picker in insertion mode. Existing resource-key replacement remains separate. Clicking an inactive layer now seeks to its IN and selects it; active-layer clicks preserve time. Selection accounts for a pending seek rather than stale native time. All resource thumbnails disable browser-native image dragging so resource keys can move from either their image or label.

Validation: 152 automated tests and package smoke checks passed. Live insertion produced numeric and resource keys at requested times while preserving existing resource keys. Inactive selection and resource time movement were independently checked against Designer. Actual browser resource drags from the label and thumbnail preserved the resource identity; final native readback matched, browser error log and Companion last_error were empty. These are targeted regressions, not an exhaustive layer certification. Private probes and test media are excluded from publication.
# Project handoff — beta.108 local candidate

Beta.108 is installed on the Raspberry Pi for local acceptance; no Git publication. Confirmed edits patch the browser's layer model immediately. Key handles read mutable data-key-time identities, including header/resource markers, rather than captured render-time timestamps. Completed drags redraw from confirmed state. Server edit revisions reject older live/geometry responses, and heavy geometry polling pauses during gestures/writes. Missing keys and out-of-bounds keys have distinct messages; do not select an arbitrary nearby key to hide stale state.

Mouse gestures preview locally with requestAnimationFrame and coalesce to one in-flight write plus the latest pointer. Numeric time/value updates use one guarded native key_move; resources accept time only. Preview curves temporarily deform native samples and are replaced by bounded Designer-evaluated samples on confirmation. This is a preview, not an independent cubic interpolation implementation. Companion encoder commands do not incur preview sampling. Resource folder rows have arbitrary depth and no synthetic ROOT button.

Validation: 149 automated tests, packaged smoke checks and native combined/grid/resource checks passed. A live Raspberry Pi batch exercised 14 moves with immediate re-selection, numeric Video/Audio fields, resource identity preservation and actual Companion VALUE endpoints. All final results matched direct Designer reads. Measured command round-trip median 74 ms, maximum 204 ms in that batch (not a general performance guarantee). Actual browser numeric time/value and resource-time drags were also checked; marker rows matched and browser errors were empty. UI frame rate was not benchmarked. QA RESPONSIVE test layers remain for manual testing. Private probes/results stay outside publication.

Beta.107: explicit viewer selections cancel prior edit/menu modes using guarded shared commands (never confirm deletion); normal Deck lock rules remain. Drag responses include bounded Designer-evaluated curve samples, updating only the active SVG path without waiting for the full geometry poll. All sequenced numeric/resource key targets are collected including collapsed layers; keyframes within 10 px take priority over grid lines. Same-sequence collisions remain non-destructive and do not overwrite another key. 147 tests, package smoke checks and isolated native snap/marker/resource checks passed.

Beta.106 adds TIME / BEAT GRID to SNAP (enabled by default). Only visible native grid ticks participate; grid density follows zoom. Native writes verify the grid step, track quantization mode and beat-to-time mapping before accepting the snap. This applies to keys, layer edges/moves and annotation drags, with Alt bypass. Validation: 147 tests, package smoke checks and isolated native time-grid/stale-grid checks passed.

Beta.105 is installed locally for acceptance; Git publication remains paused. Resource folders are horizontal, non-wrapping rows by depth; only the selected branch's children appear below it. Virtual parent folders navigate without changing the server resource selection or showing unrelated files. Folder navigation was checked in a browser fixture.

Explicit mouse key selection sends the clicked source time, rather than selecting nearest to asynchronous transport feedback. Selecting another key releases the previous shared lock through the guarded commands. Numeric curve dragging updates time and value with one in-flight operation and coalesced pointer positions; value changes reuse Editor.adjustLiveValue and native expected-key/bounds checks. Encoder behavior remains unchanged.

Validation: 147 automated tests and packaged smoke checks passed. Live Video/Brightness, Audio/Volume and Blur/Radius tests used mouse key selection/dragging and actual Companion VALUE rotation endpoints. All final key times/values were independently read from Designer and matched viewer state; Companion last_error and browser JavaScript errors were empty. Three QA MOUSE test layers were left in the user-authorized track for manual acceptance. This is targeted regression, not exhaustive layer or device certification.

Beta.103 is a local candidate for user acceptance; do not publish until approved. The top editing toolbar is removed. Direct left-button selection/dragging uses the shared Editor timing/key operations, Delete removes the selected key, double-click adds a key, and a key's right-click menu contains HOLD/LINEAR/CUBIC. Escape releases the edit. Resource-key clicks open the native parameter-specific catalog, including internal resources; existing-key replacement uses an expected-key guard and retains its time. Resource sequences now participate in shared key selection/movement/deletion.

SNAP ON beside FIT LAYER opens category choices (layer edges, keyframes, markers, sections). Alt bypasses snapping. Pointer timing uses the existing native edit operation with an absolute requested position: native beat/frame steps apply unless snapping to a verified existing landmark. Native layer/key bounds and expected-target checks still apply. Mouse drags coalesce to the latest pointer position with one write in flight. Alignment guides also update during mouse edits.

CUE/TC/MIDI/NOTES rows support double-click creation/editing and dragging. Writes use main.perform and native setTagAtBeat/setNoteAtBeat; moving one tag never removes the entire cue or its other tags/section. Source text/time guards reject stale moves and same-type destination collisions. No automatic retries.

Validation completed: 145 automated tests passed; packaged smoke checks passed; isolated Designer checks for all four marker types, numeric/resource key moves, stale marker/collision rejection and native snapping. Resource metadata inspection covered 93 native module classes and 215 resource fields without errors (not a functional certification of every layer). Browser fixture exercised direct key drag, interpolation menu, Delete, double-click insertion, note creation and snapping a note to a cue. No user track contents were changed by those native checks. Beta.103 is installed and selected on the Raspberry Pi Companion connection; viewer LIVE state and preserved editing permission were checked, with no browser JavaScript errors or Companion last_error. Git publication is paused for user acceptance.

Read this file, DEVELOPER-MANUAL.md and VIEWER-DEVELOPMENT.md when resuming. Public source and release packages contain no development machine settings.

## Current state

Designer 32.4.17, Companion 5.0.5, Node 22.22.0. Module ID remains disguise-layer-control. Viewer port defaults to 8765, loopback only; enable LAN access for viewing a Raspberry Pi remotely. Import a new version under Modules and select it on the connection.

Native player.tCurrent is BEATS. All module/viewer timestamps and TransportCommand.makeJumpToTime inputs are SECONDS. Convert at every native boundary. This distinction was verified with a 128 BPM track: beat 128 equals 60 seconds. Never infer units from tests at 60 BPM alone.

Keyframe move steps on beat tracks: 1/128 through 1/2, 1, 4, 8 beats. Layer steps: 1/4, 1, 4, 8, 16, 32. Non-beat tracks retain frame/second steps. SELECT KEYFRAME stays locked when the timing step changes.

Audio: local WAV, supported embedded PCM MOV, Windows UNC with the OS session, or direct authenticated SMB3 via smb-client.js. No SSH/mount path is required. Read RASPBERRY-PI-SMB.md. SMB WAV/MOV readers seek directly in the remote file and never write media to local disk. Credentials belong only in Companion configuration/secret storage.

Waveforms use source duration, never layer duration. Pause clips at OUT; Loop/Ping-pong show one complete source (no repeated or reversed cycles). Playback labels use native enum metadata: audio and video assign different numeric values. Sticky/body playheads share position and transition.

## Validation and limits

Latest local suite and package smoke checks run during release. Live checks covered fractional key moves at 85/120/128 BPM, non-beat frame/second moves, seek feedback, Raspberry Pi authenticated SMB read and rendering of a 60-second WAV, and waveform zoom/clipping. Temporary native test edits were restored. This was targeted regression, not a fresh audit of every layer/device or a physical Stream Deck certification.

See KNOWN-LIMITATIONS.md for source waveform limitations, unsupported field types and large-project performance limits. Beat/bar labels assume 4/4. Direct guest SMB and arbitrary server policies remain unverified.

## Workflow

Regression maintenance: use `npm run test:regression -- --group=layers,keyframes --unit-only`
for focused changes and `npm run test:regression` before release. Read
REGRESSION-TESTS.md for installed/native runs. Every new behavior or bug fix must
extend the existing test suite and relevant native/installed scenario; do not rebuild
one-off private test scripts. Full runs discover new test files automatically.
The runner contains no model calls. Script development/report analysis is separate.

Inspect git status/diff and preserve unrelated work. Use targeted local batches to save credits; npm test and npm run package before release. npm run release -- -Force creates an allowlisted source/archive set. Never commit private probes, media, paths, credentials, machine IDs or real connection exports. Use generated Companion pages. Publish only when requested. Keep README download links, release tag and package versions aligned. User continues manual tests after this release.

## Latest beta.95 details

- Network audio must never be copied to local storage. Both WAV and PCM MOV decode from seekable read-only handles; only waveform peaks are cached in bounded memory. smb-client.js uses pinned smb3-client 0.2.0 internals for byte-range reads. Recheck that adapter when upgrading the dependency.
- audio-temp-cleanup.js removes only legacy source.wav files inside matching d3-wave temporary directories; it does not recursively delete other content.
- The viewer displays the currently evaluated media resource name, source duration and source video FPS. Long names retain both ends. Resource selection is evaluated at the playhead; do not substitute the first resource key.
- Layer rows are 52 px; shared corner controls use a 4 px top inset. Thumbnail failures are evicted from the server cache and browser images retry up to three times.
- Generated Resources buttons omit folder labels and allocate more space to filenames. Import the generated page into the existing editor page and link the existing connection; never assume the destination page number.
- Final automated validation: 130 tests plus packaged-module smoke checks. Live Raspberry Pi checks confirmed both WAV and embedded PCM MOV waveforms. A read-only inventory covered 76 layer types; five AudioFile resources decoded locally. These checks do not certify every resource/playback mode.
- The latest user continues manual testing. Keep future changes targeted and avoid repeating broad live tests without a relevant change.

Beta.96: Layer Edit always displays selected-layer IN/OUT guides, at exact source times (including subframe beat boundaries). Other modes retain their previous match-only keyframe guides. Regression: test/viewer-alignment.test.js.

Beta.97 adds subtle match-only guides for all sequenced keys in the selected layer during Layer Edit/Select Keyframe. Source keys outside layer bounds are excluded; subtle matches require coincident time, not merely the same frame bucket.

Beta.98: keyframe alignment targets only context.parameter in the selected layer. Compare against other layers only; never count the selected layer’s own keys or boundaries.

Beta.99: native keyframes may sit exactly at layer OUT. Viewer key visibility is inclusive of IN and OUT; keys strictly outside remain hidden. This does not change transport playback’s exclusive OUT behavior.

Beta.100: zoom buttons and Ctrl+wheel centre on state.time (playhead), clamped to track view bounds. FIT LAYER remains layer-centred.

Beta.101: alignment counts only coincidences within 1 microsecond across different layers, including group IN/OUT. Matched guides are solid and brighter; unmatched Layer Edit boundaries remain dashed. No snapping. test/viewer-alignment.test.js covers 96 boundary/key/resource/group/FPS pairs plus subframe near misses and nonmutation.

Beta.102: ALLOW VIEWER EDIT is opt-in. viewer-editor.js validates a shared-state fingerprint and delegates to existing definitions.js actions inside main.perform(). Browser drags are relative encoder steps (12 px per step); never implement separate beat/frame math. Resource picker uses native resource_items for every supported resource parameter, server-owned indices, and UID equality checks. /api/resource-list batches 64 items; metadata refreshes at most once per 2.5 seconds while a picker is open. Native VideoClip.transportDuration supplies trimmed clip duration; enabledVersion selects the current version filename where unambiguous. Source files are never modified. Browser selection, file lists and native interpolation were tested; continuous physical mouse drags and all layer/device combinations were not certified.

Beta.102 final verification: 142 automated tests and packaged-module smoke checks passed. Browser fixture covered a 130-item library, folder changes and selecting item 99. Native read checks covered audio, output, mapping, palette, video and CDL lists. An inactive native test layer verified HOLD/LINEAR/CUBIC; a temporary clip verified trim duration changes without modifying source frame count. Installed Companion integration verified browser-to-Companion and Companion-to-browser precision changes, native audio/output listing, and an empty last_error. No broad live playback or physical Stream Deck certification was performed.
# Bounded dial coalescing - 0.2.0-beta.57

All four normal Companion dials now share a bounded latest-intent queue. At most
one native action is running and one trailing dial action is pending. Same-direction
turns combine up to 64 detents; reversals cancel unsent detents instead of adding
opposite work behind them. Layer/field selection, normal time nudging, values,
key/layer timing and viewer zoom consume the combined distance in one update.
Buttons and mode changes remain ordering barriers, and context invalidation still
discards pending work.

Layer selection is clamped at the first and last active layer. Turning farther at
an endpoint is inert and preserves staged state; it never wraps to the other end.
Parameter selection retains its existing clamped behavior.

Validation: 292 offline tests and package checks passed with zero skips. Coverage
includes burst saturation, reversal cancellation, action barriers, normal dial
routing, combined native time delta, layer endpoints, one-read batched selection
and zoom distance. Beta.57 installed on Raspberry Pi while preserving current
settings; read-only verification found connected, not synchronising and no
last_error. No physical dial burst or native edit was performed in verification,
so final feel and latency await operator testing. GitHub remains beta.55.
# Fast CC1 motor feedback - 0.2.0-beta.61

External Designer brightness/volume changes now return to the Yamaha CC1 motor
through a dedicated 400 ms REST poll. The poll runs sequentially, publishes only
changed master data and does not invoke Python or editor synchronisation. Local
fader writes invalidate overlapping reads so stale values cannot pull the motor
backwards after a write.

Beta.61 is installed on the Raspberry Pi. All 301 offline tests and package
checks pass without skips. Read-only verification confirmed the connection,
page 8, surface input/output settings and enabled trigger. No Designer mutation
was used for verification.

# Yamaha CC1 transport master - 0.2.0-beta.60

The generated Yamaha CC1 layout targets Companion page 8. Its twelve LCD keys
and RC1-RC4 follow the Stream Deck + page, RC5 zooms the timeline viewer and RC6
moves timeline time. Panel buttons cover keyframe editing, media, transport
selection, master 0/100 and time linking.

The module reads every Designer transport through the official transport API.
Transport selection clamps at the list ends. The motor fader writes brightness
and volume together; while a request is active, intermediate input is discarded
and only the newest absolute position remains pending. The confirmed selected
transport level drives the motor. A brightness/volume mismatch uses the lower
value and is visible through dedicated Companion variables.

Beta.60 is installed on the Raspberry Pi. Companion page 8, the `cc1_fader`
custom variable, Yamaha surface input/output settings and the enabled
variable-change trigger were verified from a full configuration export. The
existing page 8 and the full pre-trigger configuration are backed up privately
under `.tools`. All 300 offline tests and package checks pass without skips. No
Designer mutation was used for deployment verification.
## Jog safety and transport selector - 0.2.0-beta.62

The `JOG ACTIVE / LOCKED` preset persists its state and suppresses time-dial rotation while locked; key navigation and other controls remain available. `D3-Yamaha-CC1-Transports.companionconfig` targets page 9 with 42 live transport slots. Each populated button shows the Designer transport name, selects that transport for the shared brightness and volume fader, and highlights the selected target. Empty slots are inert. The generated page and module use Designer's read-only transport inventory; selection itself does not alter a Designer project.

## Jog lock colour - 0.2.0-beta.63

The jog lock preset uses the theme danger red while locked and returns to its normal surface colour while active. This is a preset feedback change; existing buttons created from the preset retain the feedback when moved in Companion.

## Smooth playback presentation - 0.2.0-beta.64

ViewerClock now samples its small atomic time/playback payload every 40 ms. The browser interpolates the displayed timecode and playhead with requestAnimationFrame, corrects to every native sample and stops extrapolating after 500 ms without fresh data. Playback-state propagation is part of the same guarded transport/track sample. Heavy viewer snapshots remain immediately invalidated by content, selection, viewport and edit changes, but their periodic recovery interval is five seconds while playing and 1.5 seconds while stopped. This reduces native Python work during playback without delaying edits.

## Companion fast clock - 0.2.0-beta.65

The installed Companion path now uses its own guarded 40 ms LiveUpdate property for time, native timecode anchor, playing and track identity. It updates only playback-facing variables and transport feedback, avoiding the full preset/thumbnail publication cost at frame cadence. The existing coherent 100 ms timeline, layer bounds and selected-value subscription remains authoritative for editing. Fast samples are cleared on writes, transport changes and disconnects, and track identity prevents an old transport clock from reaching the UI.

## Companion fallback interpolation - 0.2.0-beta.66

Playback-facing Companion variables now interpolate locally every 40 ms between confirmed clock samples. This also smooths the sequential 500 ms HTTP recovery path when LiveUpdate is silent, without increasing native request frequency. Presentation stops within 750 ms without a fresh sample and immediately when confirmed playback stops, the connection drops, context changes or track identity differs. Confirmed editor time remains separate from disposable display interpolation.

## Unified Companion clock presentation - 0.2.0-beta.67

Full and fast Companion publications now resolve time, live time, dial timecode and layer elapsed/remaining from the same presentation clock, preventing alternating confirmed/interpolated values. Interpolated absolute timecode advances from the latest native label anchor rather than passing through the exact-sample-only formatter, which previously produced alternating labels and dashes during playback. The anchored formatter includes 29.97/59.94 drop-frame frame-count conversion.

## HTTP timecode anchor - 0.2.0-beta.68

The sequential `live_state` fallback already returned a native label for the current transport position inside `timecodeSamples`, but Connection passed no `timecodeSample` to Editor. `Editor.acceptTimecodes` therefore cleared the running anchor on every poll and interpolated frames rendered as dashes. Connection now promotes the exact current sample into the timeline payload before Editor consumes it. No Designer script or project mutation is involved.
## 0.2.0-beta.69

Companion exposes PREV TRACK and NEXT TRACK presets for the transport in the editor snapshot. They call the documented `/api/session/transport/gotoprevtrack` and `gotonexttrack` endpoints with the nested transport locator, independently of the CC1 master-fader target. A successful track navigation immediately invalidates track-bound selection and editing modes so normal context synchronisation must identify the new track before another edit. The presets are available in the Transport and time linking group and are not placed on generated pages.

The Yamaha CC1 page 8 download is generated from `templates/yamaha-cc1-page8.json`, a sanitised copy of the operator's current 8 x 7 Companion layout. It retains controls and page-9 navigation while replacing the live connection ID with the standard import placeholder. The generated wrapper supplies only the neutral localhost configuration and current module version. Release archives include page 8 and the page 9 transport selector.
