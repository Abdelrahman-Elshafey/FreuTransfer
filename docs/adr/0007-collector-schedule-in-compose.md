# ADR 0007: The collector runs as a Compose service, not a systemd timer

- **Status:** accepted (owner, 2026-11-12; built in stage 4)
- **Date:** 2026-11-12
- **Supersedes:** the "Collectors" point of ADR 0002 (systemd timer)

## Context
ADR 0002 planned a systemd timer on the server to start the collectors once a day at a fixed
Zurich time. Since then, everything else FreuTransfer runs on the server lives in
`compose.prod.yml` and arrives with a normal deploy (ADR 0006), including two scheduled jobs: the
`backup` and `offsite` services, which loop and sleep. A systemd timer would be the only part
installed by hand with `sudo`, outside git, which a deploy can't update and the repository doesn't
show.

## Decision
- A `collect` service in `compose.prod.yml` runs the Frankfurter collector **every hour**, in the
  same loop-and-sleep pattern as `backup` and `offsite`.
- Each run fetches the **last 10 days** for the pairs the corridors need, with the source pinned
  (ECB for EUR; ADR 0003). Storing is idempotent: days already stored are skipped, so a missed
  hour or a server outage of up to 10 days repairs itself on the next run.
- Every run is recorded in `collector_runs`, and every response is stored in `raw_observations`
  before it is parsed (stage 4a).

## Alternatives considered
- **systemd timer at a fixed time (ADR 0002):** exact timing and a standard Linux tool, but
  installed by hand with root rights, outside git and deploys, and one more step to remember when
  rebuilding the server.
- **GitHub Actions schedule:** would need the database reachable from GitHub, which ADR 0004 rules
  out (nothing is exposed).
- **Once a day in the loop:** fewer requests, but a run that fails or falls just before the ECB
  publishes would leave the site a day behind.

## Consequences
- The new ECB rate (published around 16:00 Zurich time) reaches the site within about an hour.
- About 24 small requests a day to Frankfurter, which is free, has no quotas and allows all
  automated access in its `robots.txt` (checked 2026-11-12).
- No host setup: the schedule, its code and its changes go through PRs, CI and the approved deploy
  like everything else.
