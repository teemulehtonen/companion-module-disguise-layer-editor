# Contributing

Start with the [code map](docs/CODE-MAP.md) for the request flow, state names and default-reset behaviour.

Use Node.js 22.22.0 and the committed lockfile. Run `npm ci`, `npm test`, `npm run format:check` and `npm run package`. The Windows launchers can install the local runtime and perform the same build. See [architecture](docs/ARCHITECTURE.md) before changing selection, queueing or time conversion.

Create a branch per change and submit a pull request describing the problem, resulting behaviour and relevant validation. Keep UI text English and preserve stable action IDs. Use synthetic fixtures; never commit real project UIDs, local network addresses, user paths, credentials, project backups or test media. Retain third-party license notices.

Offline tests must not connect to live Designer or Companion. Live tests require the operator's authorization and a project backup. Do not silently run live mutations from build scripts or CI. Document what was tested, what was restored and what remains unverified.

Increment the technical SemVer prerelease version for changed distributable builds. Update manifest, lockfile, release script and documented package filenames together. Do not overwrite published release tags. Keep known limitations accurate, including unresolved Designer-native faults.
