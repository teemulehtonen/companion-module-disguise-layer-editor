# Security and deployment

This beta has not undergone an independent security audit. There is no guaranteed security support period or response time.

Use the module on a trusted control network. The module sends powerful Python commands through Designer's HTTP interface. Do not expose that interface directly to the public internet. Limit access using network controls appropriate to your installation; the module does not add authentication or encryption to Designer's HTTP endpoint.

Never commit credentials, local addresses, project backups, media, or raw session logs. Sanitize issue attachments. Report suspected security vulnerabilities through an agreed private channel with the repository maintainer; do not include credentials or exploitable installation details in public issues. Once a repository owner is established, enable GitHub private vulnerability reporting where available and document its reporting link here.

Offline builds and tests must not contact live show-control systems. Live tests require operator authorization and project backups. See [CONTRIBUTING.md](CONTRIBUTING.md) and [DISCLAIMER.md](DISCLAIMER.md).
