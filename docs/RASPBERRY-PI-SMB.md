## Persistent waveform cache

Waveform summaries are cached on the machine running Companion, not on Designer or in the project share. Only peak amplitudes, duration and sampling step are stored; source audio/video is never copied. The cache is shared by local module instances and limited to 100 MiB of peak files (oldest-written entries are evicted); each entry is limited to 256 KiB. The memory cache still holds at most 32 owners.

Keys hash the Designer endpoint, project directory, media path, resource UID, source size/modification-time revision and container. Filenames and credentials are not written into cache records. Designer metadata is checked before reuse, so offline sources are not silently replaced by stale cached data. Replacing content while preserving both size and modification time requires REFRESH. REFRESH invalidates the disk record and decodes again. Removing a layer releases its memory entry; reusable disk summaries remain until quota eviction.

Cache location belongs to the OS account running Companion:
- Windows: `%LOCALAPPDATA%/disguise-layer-editor/waveforms-v1`
- Linux/Raspberry Pi: `$XDG_CACHE_HOME/disguise-layer-editor/waveforms-v1`, or `~/.cache/disguise-layer-editor/waveforms-v1`
- macOS: `~/Library/Caches/disguise-layer-editor/waveforms-v1`

A container needs a persistent writable cache directory to retain data across container replacement. Read-only/full disks and invalid cache records fall back to normal waveform decoding. Writes are serialized and use an exclusive cross-process lock plus atomic rename. An interrupted process may leave `.write-lock`; this conservatively disables disk writes until the cache directory is cleared with Companion stopped. Existing readable peaks remain usable. OS/account changes or module removal do not necessarily delete this cache; it can be removed safely while Companion is stopped.

The implementation is `src/waveform-disk-cache.js`; tests use temporary directories. This is an expendable cache, not a backup or a source of Designer state.

# Raspberry Pi network audio

The module uses a direct SMB3 client. No SSH, OS packages or network-drive mounting are required.

- Set **SMB D3 PROJECTS SHARE** to `\\DESIGNER_HOST\d3 Projects`.
- Enter a share-authorized **SMB USERNAME**, **SMB PASSWORD**, and domain if needed. Store the password only in Companion's secret field.
- Use the Designer machine's LAN address, not `127.0.0.1`, which refers to the Pi.

Windows Explorer can reuse the Windows login; the Pi cannot. A share visible in Explorer is not evidence of anonymous access. Servers requiring SMB signing need authenticated access; do not weaken server policy to permit guest access.

The project subdirectory is resolved automatically. Only required byte ranges are read into bounded memory; media is never copied to local disk. Legacy d3-wave temporary source files from beta.88 and earlier are removed at startup. No SMB write operations are used.

Validation: direct connection reaches authentication on the local Windows server. End-to-end Raspberry Pi waveform reading with valid credentials passed: a 60-second audio file was read from the Windows share and rendered. The client dependency is `smb3-client` 0.2.0, isolated in `src/smb-client.js`.

Beta.90 validation: a 1.46 GB HAP/PCM video waveform completed on Raspberry Pi in approximately 2.4 seconds without a local media copy. All five available AudioFile sources decoded locally. A read-only audit covered 76 existing layer types. Tennis event sounds are source previews, not predicted event playback; a layer with several audio resources currently previews its first audio resource.
