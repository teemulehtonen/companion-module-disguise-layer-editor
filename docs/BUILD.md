# Build

Requires Node.js 22.22.0 and npm. Use the committed lockfile.

```sh
npm ci
npm run format:check
npm test
npm run package
```

Outputs:

- `disguise-layer-control-0.1.0-beta.14.tgz` — import under Companion → Modules.
- `D3-Stream-Deck-Plus.companionconfig` — import as a page and map its connection.
- `pkg/` — intermediate module bundle.

`package` builds the module, smoke-tests the bundled export and generates the page. Unit tests run separately. Builds do not require or contact Designer.

## Release archives (Windows / PowerShell)

```sh
npm run release
# Replace an existing local release directory:
npm run release -- -Force
```

This reruns tests and packaging, then creates source/Companion ZIPs and SHA-256 checksums in `releases/0.1.beta/`. The source archive uses an explicit allowlist in `scripts/release.ps1`; update it when adding distributable files. Node/npm must be on PATH.

For a new published version, update `package.json`, lockfile, `companion/manifest.json`, the release script and documented filenames together. Keep the module ID stable. Do not replace published tags. Generated outputs are ignored by Git.
