# Contributing

Anyone can develop, fork and redistribute this project under the [MIT license](LICENSE), including modified versions. Preserve the license and copyright notice. Contributions are welcome; repository maintainers review pull requests before merging. A fork does not need permission or access to the original author's machine.

## Start here

1. Fork this repository on GitHub and clone your fork, or clone the original for local work.
2. Install Node.js 22.22.0 and run `npm ci`.
3. Read [Developer manual](docs/DEVELOPER-MANUAL.md), [current handoff](docs/PROJECT-HANDOFF.md) and [viewer development](docs/VIEWER-DEVELOPMENT.md). `AGENTS.md` also applies to coding assistants.
4. Create a branch such as `codex/fix-out-navigation`, implement a focused change and add regression coverage where appropriate.
5. Run `npm test` and `npm run package`. Run `npm run format:check`; avoid unrelated repository-wide formatting changes and report pre-existing failures separately.
6. Submit a pull request describing the problem, behavior change, tests actually run and known limitations. Screenshots help for UI changes.

## Compatibility rules

Keep UI and public documentation in English. Preserve the internal module ID, action/variable IDs and existing saved configurations. Designer calls belong behind the client/native-script boundary; Companion SDK access belongs behind its adapter. Browser and Stream Deck edits must share validation, ordering, selection and clock rules.

VIEW must never mutate Designer. Keep expected-state checks, lock checks, request authentication and stale-response protection. OUT is a valid editing boundary even though playback has ended there. Quantized tracks require Designer time/beat conversion rather than a single assumed BPM. See the development guides for group, resource, waveform and concurrency details.

## Testing and privacy

Use `npm run test:regression -- --group=layers,keyframes --unit-only` for a focused
change and the full runner before release. Every changed behavior or fixed bug
must add/update its regression case. See [repeatable tests](docs/REGRESSION-TESTS.md)
for groups, native/installed integration, reports and current coverage gaps.

## Working with another developer or coding assistant

Work on separate branches or forks and use pull requests. Agree on file ownership
before parallel work; avoid two people editing the same working copy or test track.
Include the base commit, intended behavior, tests actually run and remaining issues
in each pull request. The next developer/assistant should fetch the latest changes,
read the handoff, review the diff, and rerun relevant tests before merging. GitHub
does not automatically synchronize separate local checkouts or running Companion
installations. Never share Companion passwords or project media in issues or PRs.

Maintainers can grant repository collaborator access; a fork and pull request also
work without write access. Preserve feature branches until their work is reviewed.

## Test environment privacy

Use synthetic fixtures. Offline tests and builds require no Designer or Companion installation. Live integration tests require your own licensed software, disposable project and operator authorization; they are not implied by a passing unit suite. Private probes from earlier development are intentionally not distributed. Never commit credentials, personal paths, real project identifiers, local settings, backups, logs or media. Use generated clean page exports, not exports from a configured live connection.

## Releases and handoff

See [Build](docs/BUILD.md) and [GitHub workflow](docs/GITHUB-SETUP.md). Update the handoff, user documentation and changelog when behavior changes. Include unresolved issues and actual test scope so another developer or coding assistant can continue without private conversation history. Publish a new version for changed builds; never overwrite published tags or binaries. Only authorized maintainers publish releases in this repository; fork owners can publish their own.
