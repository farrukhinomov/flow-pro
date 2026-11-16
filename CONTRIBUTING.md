# Contributing to FlowPro

Thank you for your interest in FlowPro. This guide covers how to propose a
change and what a pull request needs before it can be merged.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and feature ideas:** open an issue using one of the issue forms.
  For anything larger than a small fix, wait for a maintainer to respond before
  writing code, so nobody builds something that will not be merged.
- **Security issues:** do not open a public issue. Follow
  [SECURITY.md](SECURITY.md).

## Development setup

Follow [docs/contributing/getting-started.md](docs/contributing/getting-started.md) to run FlowPro
locally. The short version of the checks that CI runs:

```bash
cd apps/web
npm ci
npm run format:check
npm run check
npm run licenses
```

```bash
cd apps/api
dotnet tool restore
dotnet restore FlowPro.slnx
dotnet format FlowPro.slnx --verify-no-changes --no-restore
dotnet test FlowPro.slnx --configuration Release
```

## Pull requests

- Branch from the default branch and keep each pull request to one topic.
- The pull request title must be a
  [Conventional Commit](https://www.conventionalcommits.org/), for example
  `feat(attendance): add manual break edits`. Pull requests are squash-merged,
  so the title becomes the commit message and feeds the changelog.
- Add or update tests for the behaviour you change.
- Database migrations must be backward-compatible with the previous release:
  add first, remove in a later release.
- Fill in the pull request template, including how you verified the change.
- All CI checks must pass.

## Contributor licence agreement

FlowPro is licensed under the [AGPL-3.0](LICENSE). To keep the option of
offering it under other terms as well, every contributor signs the
[contributor licence agreement](CLA.md) once. A bot asks for it on your first
pull request; you sign by posting a comment. You keep the copyright in your
contributions.

## Dependency policy

FlowPro uses only free, open-source dependencies and services that do not
require a paid subscription.

- A new dependency must have a licence approved by the
  [Open Source Initiative](https://opensource.org/licenses) that is compatible
  with AGPL-3.0, such as MIT, Apache-2.0, BSD, ISC, MPL-2.0 or PostgreSQL.
- Source-available, "community edition" and revenue-limited licences are not
  accepted, even when they are free today.
- CI checks every npm and NuGet package, including transitive ones, against an
  allow-list: the `licenses` script in `apps/web/package.json` and
  `apps/api/allowed-licenses.json`. If your change needs a licence that is
  not on the list, explain why in the pull request instead of editing the list
  silently.
- Prefer the platform and existing dependencies over adding a new package.

## Secrets

Never commit credentials, tokens or private keys. Only `.env.example` files are
tracked. CI scans every pull request for secrets and fails if it finds one.
