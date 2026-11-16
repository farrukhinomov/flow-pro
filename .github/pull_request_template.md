<!--
PR title must be a Conventional Commit, e.g. `feat(attendance): add manual break edits`.
It becomes the squash-merge commit and drives the changelog.
-->

## Summary

<!-- What changes and why. -->

Closes #

## How it was verified

- [ ] `npm run check` (apps/web)
- [ ] `dotnet test FlowPro.slnx` (apps/api)
- [ ] e2e / manual check:

## Deployment notes

- [ ] No database migration
- [ ] Migration is backward-compatible with the currently deployed frontend and API (expand/contract)
- [ ] Needs a manual step on the Demo environment (describe below)
