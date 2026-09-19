# Raspberry Pi network audio

The module uses a direct SMB3 client. No SSH, OS packages or network-drive mounting are required.

- Set **SMB D3 PROJECTS SHARE** to `\\DESIGNER_HOST\d3 Projects`.
- Enter a share-authorized **SMB USERNAME**, **SMB PASSWORD**, and domain if needed. Store the password only in Companion's secret field.
- Use the Designer machine's LAN address, not `127.0.0.1`, which refers to the Pi.

Windows Explorer can reuse the Windows login; the Pi cannot. A share visible in Explorer is not evidence of anonymous access. Servers requiring SMB signing need authenticated access; do not weaken server policy to permit guest access.

The project subdirectory is resolved automatically. Media is read into a temporary file for waveform decoding and removed afterwards. No SMB write operations are used.

Validation: direct connection reaches authentication on the local Windows server. End-to-end Raspberry Pi waveform reading with valid credentials passed: a 60-second audio file was read from the Windows share and rendered. The client dependency is `smb3-client` 0.2.0, isolated in `src/smb-client.js`.
