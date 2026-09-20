# GitHub development and release workflow

The project already has a repository. Do not initialize a second repository or replace its remote when continuing existing work.

## Work on your own copy

Anyone may fork and modify the project under its MIT license. Fork it on GitHub, clone the fork and create a feature branch. Configure your own Git author identity; a GitHub noreply email can keep your email address private. Never reuse another contributor's identity.

```sh
git clone <your-fork-url>
cd companion-module-disguise-layer-editor
git switch -c codex/my-change
npm ci
npm test
npm run package
```

Commit only intended source/documentation changes, push your branch and open a pull request against the upstream repository. Describe the change and validation. To receive later upstream changes, add the original repository as `upstream`, fetch it and merge or rebase its main branch into your work after preserving local changes. Never force-push shared history.

## Continue with another developer or coding assistant

Share the repository URL, branch and commit, not a configured Companion backup. Start with `AGENTS.md`, `docs/PROJECT-HANDOFF.md` and `docs/VIEWER-DEVELOPMENT.md`. The developer manual maps the code. Supply a sanitized reproduction and the affected Designer/Companion versions. Keep credentials and machine-specific configuration local. Historical test reports apply only to their named builds.

## Publish a release

1. Obtain repository publishing authorization. Review the diff, tests and privacy of all generated artifacts.
2. Set a new version in `package.json`, both lockfile version entries and `companion/manifest.json`. Update README download links, changelog and handoff. Keep the internal module ID unchanged.
3. Run the build/release commands in [BUILD](BUILD.md). The release script reads the package version; change the script only if the supported version series or artifact layout changes.
4. Commit and push the final source. Create a GitHub prerelease with tag `v<package-version>` targeting that commit. Do not reuse an existing published tag.
5. Attach the module TGZ, both clean page exports, Companion ZIP, source ZIP and `SHA256SUMS.txt` from `releases/0.2.beta/`.
6. Verify public downloads, checksums and version agreement. Import the TGZ into Companion and explicitly select the new version for the connection; importing alone does not activate it. Preserve custom pages and local connection settings.

The public source and source ZIP must contain everything needed for offline development. Private test probes, credentials, local projects and installed dependencies do not belong in either. Git history preserves committed source revisions; release assets preserve the matching installable builds. The repository owner's public GitHub identity remains visible.
