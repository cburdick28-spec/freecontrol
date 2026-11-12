# freecontrol: design

Date: 2026-11-12

## Goal

A world sim that runs with nobody playing it. It advances on a schedule, saves itself to git, and a website shows what happened. The owner gets one intervention per day.

## Decisions (agreed in chat)

- New repo, new game. Not bolted onto an existing project.
- World type: a wild planet where species evolve, and the smart ones become rival nations.
- Player role: one god move every 24 hours, behind a password.
- Stack: Next.js + Tailwind on Vercel, GitHub for storage and scheduling.

## Architecture

- `sim/`: pure, deterministic TypeScript. `step(world, moves)` advances one century and returns that century's events. All randomness comes from a seeded generator whose state is stored in the world, so saving and loading never changes the future.
- Clock: GitHub Actions, hourly. Vercel's free plan only allows daily scheduled jobs, so the tick cannot live there.
- Storage: an orphan `world` branch holding `state.json`, `chronicle.json`, `history.json`, and `move.json`. One commit per tick. Saves stay off `main` so Vercel does not rebuild every hour (`vercel.json` disables deployments for that branch).
- Catch-up: the tick script compares real time to the world's epoch and runs every tick that is due, capped at 48 per run.
- Site: a static shell plus four API routes. `/api/world` (current state), `/api/timeline` (per-tick summary rows), `/api/state?t=` (state at a past tick, read from the matching commit), `/api/move` (cast the daily move).
- Moves: the site writes `move.json`. The tick reads it and applies any move whose id it has not applied yet. The site and the tick never write the same file, so pushes cannot conflict.

## Error handling

- Missing token or password: `/api/move` answers 503 with setup instructions. Reading still works without a token on a public repo.
- GitHub errors surface as 502 with a plain message. The page keeps showing the last good data.
- Invalid move targets are rejected by the API and ignored by the sim.
- Push races between the tick and a move commit are retried with a rebase.

## Testing

`tests/sim.test.ts` covers determinism, save/load stability, an 800-tick health run (no bad numbers, no stale ownership, nations rise and fall), and every god move including junk input.

## Not in v1

Multiple players, accounts, AI-written stories, sound, 3D.
