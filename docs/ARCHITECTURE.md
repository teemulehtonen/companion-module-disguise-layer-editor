# CC1 architecture

Yamaha CC1 surface → Companion saved actions → ordered module queue → Editor →
DesignerClient → Designer HTTP/Python API. Designer feedback returns through
Connection to Companion variables, LCDs and the motor-fader target.

The Yamaha serial surface driver is separate from the Disguise connection module.
Its bounded display queue and touch-aware motor input are documented in
[support/yamaha-cc1](../support/yamaha-cc1/README.md).

The module has no web listener, browser editor, waveform decoder or SMB client.
CC1 resource thumbnails come from Designer's thumbnail API. Thumbnail disk cache
contains validated PNG data only and uses cc1-thumbnails-v1; old waveform caches
are not read or removed. Network media is never downloaded by this module.

See [development rules](CC1-DEVELOPMENT.md) and [CC1 setup](YAMAHA-CC1.md).
