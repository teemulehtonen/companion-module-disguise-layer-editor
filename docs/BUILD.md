# Build

Requires Node.js 22.22.0 and npm. Use the committed lockfile.

```sh
npm ci
npm run format:check
npm test
npm run package
```

Outputs:

- `disguise-layer-control-<package-version>.tgz` — import under Companion → Modules.
- `D3-Stream-Deck-Plus.companionconfig` — import as a page and map its connection.
- `D3-Stream-Deck-XL.companionconfig` — optional XL page using the same connection.
- `D3-Yamaha-CC1.companionconfig` — clean operator layout for Yamaha CC1 page 8.
- `D3-Yamaha-CC1-Transports.companionconfig` — Yamaha CC1 transport selector for page 9.
- `pkg/` — intermediate module bundle.

`package` builds the module, smoke-tests the bundled export and generates the page. Unit tests run separately. Builds do not require or contact Designer.

## Release archives (Windows / PowerShell)

```sh
npm run release
# Replace an existing local release directory:
npm run release -- -Force
```

This reruns tests and packaging, then creates source/Companion ZIPs and SHA-256 checksums in `releases/0.2.beta/`. The Companion ZIP contains the module and all four clean page exports. The source archive uses an explicit allowlist in `scripts/release.ps1`; update it when adding distributable files. Node/npm must be on PATH.

For a new published version, update `package.json`, lockfile, `companion/manifest.json`, README links and release documentation together; the release script reads the package version. Keep the module ID stable. Do not replace published tags. Generated outputs are ignored by Git.
