# Contributing

Use Node.js 22.22.0. Run `npm ci`, `npm test`, `npm run format:check` and `npm run package`; Windows release archives use `npm run release`.

Create a branch and submit a pull request describing the change and validation. Keep UI text English and preserve action/variable IDs. See [architecture](docs/ARCHITECTURE.md).

Use synthetic fixtures. Never commit credentials, personal paths, real project IDs, backups or media. Offline tests and builds must not contact live systems; live testing needs operator authorization and backups.

Increment technical versions for changed published builds. Update the manifest, lockfile, release script and package filenames together. Do not overwrite release tags. Keep known limitations and third-party license notices intact.
