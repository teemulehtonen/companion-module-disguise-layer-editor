# GitHub setup

1. Create a private repository named `companion-module-disguise-layer-editor`; leave README, license and .gitignore initialization off.
2. In the local source folder, initialize Git if needed. Configure a non-personal author name and your GitHub noreply email before committing.
3. Review `git status`, commit the source, add the repository as `origin`, then run `git push -u origin main`.
4. Invite developers through **Settings → Collaborators**. Use branches and pull requests for changes.
5. Build with `npm ci` and, on Windows, `npm run release`. Attach the generated Companion ZIP to a prerelease tagged `v0.1.0-beta.1`.

Do not force-add ignored files. Local media, project backups, logs and build outputs are excluded. The repository owner's GitHub account remains identifiable even when source and commit metadata contain no personal details.

For an existing repository, skip creation/initialization and use its configured remote.

[Import code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) · [Commit email](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address) · [Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
