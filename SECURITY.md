# Security

This CC1 module connects to Designer's HTTP/Python API and optionally sends OSC
UDP messages. It opens no web server. Use a trusted control network and protect
Companion and Designer access using their own administration controls.

VIEW ONLY blocks module writes, including transport and OSC. It does not protect
against other controllers or recall an already dispatched command. Native writes
validate current context, key identity, locks and bounds and are never retried
automatically after uncertain results.

Only validated PNG thumbnails are cached locally. The module does not read SMB
shares or copy source media. Do not commit credentials, local configuration,
private probes or test reports. Report security issues privately to the maintainer.
