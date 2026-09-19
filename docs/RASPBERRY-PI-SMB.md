# Raspberry Pi network audio

The module uses a direct SMB3 client. No SSH, OS packages or network-drive mounting are required.

- Set **SMB D3 PROJECTS SHARE** to `\\DESIGNER_HOST\d3 Projects`.
- Enter a share-authorized **SMB USERNAME**, **SMB PASSWORD**, and domain if needed. Store the password only in Companion's secret field.
- Use the Designer machine's LAN address, not `127.0.0.1`, which refers to the Pi.

Windows Explorer can reuse the Windows login; the Pi cannot. A share visible in Explorer is not evidence of anonymous access. Servers requiring SMB signing need authenticated access; do not weaken server policy to permit guest access.

The project subdirectory is resolved automatically. Only required byte ranges are read into bounded memory; media is never copied to local disk. Legacy d3-wave temporary source files from beta.88 and earlier are removed at startup. No SMB write operations are used.

Validation: direct connection reaches authentication on the local Windows server. End-to-end Raspberry Pi waveform reading with valid credentials passed: a 60-second audio file was read from the Windows share and rendered. The client dependency is `smb3-client` 0.2.0, isolated in `src/smb-client.js`.

Beta.90 validation: a 1.46 GB HAP/PCM video waveform completed on Raspberry Pi in approximately 2.4 seconds without a local media copy. All five available AudioFile sources decoded locally. A read-only audit covered 76 existing layer types. Tennis event sounds are source previews, not predicted event playback; a layer with several audio resources currently previews its first audio resource.
