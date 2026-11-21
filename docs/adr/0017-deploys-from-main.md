# ADR 0017: Deploys from `main`; `dev` only for development

- **Status:** accepted (owner, 2026-11-21); replaces ADR 0006's "deploys from `dev` until v1.0"
- **Date:** 2026-11-21

## Context
ADR 0006 deployed every merge into `dev` and planned to move deploys to `main` only at v1.0. The
owner moved that up: `dev` is for development, `main` is what runs in production, starting now.

## Decision
- **`main` is production.** A merge into `main` pushes the images to GHCR and starts the deploy job
  (which still waits for the owner's approval, GitHub environment `production`). A merge into `dev`
  only runs the checks and builds the images, without pushing them.
- **A release is a pull request from `dev` into `main`.** Step branches still start from `dev` and
  merge into `dev`; nothing is committed to `main` directly.
- **The deploy key can deploy only commits on `main`.** `scripts/deploy.sh` checks that the commit
  is part of `origin/main`'s history (the newest or an older one, for a rollback). An unreleased
  commit on `dev` is refused (`deploy/deploy-script.test.ts`).
- **GitHub's default branch stays `dev`**, so new pull requests target `dev` by default. The daily
  monitor runs from it, which is fine because it only checks the live site from outside.

## The switch (once)
The server runs phase 1 of its *current* `deploy.sh`, and that copy still accepts only commits on
`dev`. A merge commit made on `main` is not on `dev`, so that copy would refuse it. Therefore the
first release is a **fast-forward**: `main` (an ancestor of `dev`) is moved to `dev`'s newest
commit, which is on both branches. The old script accepts it and checks it out, and from then on the
server has the new script, which accepts `main`. After that, releases are ordinary pull requests.
Before the switch, the owner changes the `production` environment's allowed branch from `dev` to
`main` (`docs/deploy.md`), otherwise GitHub refuses the deploy job.

## Alternatives considered
- **Keep deploying from `dev` until v1.0 (ADR 0006):** fewer steps per deploy, but every merged
  step went live at once; the owner wants a separate, deliberate release step.
- **Deploy from tags (`v1.2.3`):** another thing to name and push for each release, for one
  developer, with no gain over a merge into `main`.

## Consequences
- Each release adds a merge commit on `main` that `dev` doesn't have. That is harmless: the next
  pull request from `dev` into `main` merges cleanly, because `dev` never takes commits from `main`.
- Work merged into `dev` isn't live until it is released. `docs/deploy.md` has the compare link
  for the release pull request.
