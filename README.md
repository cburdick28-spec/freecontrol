# freecontrol

**A world that runs without you.**

Somewhere on GitHub's servers there is a small planet. Every hour, a century passes on it. Species evolve, spread, and die out. A few get smart enough to build nations, and those nations trade, go to war, split apart, and collapse. Nobody plays it. It just keeps going.

You get **one move a day**. Drop a meteor, start a plague, bless a species, hand one of them fire, or call down an ice age. Then you watch what the world does with it.

**Live site:** LIVE_URL

**The world's history, as git commits:** https://github.com/cburdick28-spec/freecontrol/commits/world

## What you can do on the site

| | |
| --- | --- |
| **The map** | Switch between nations, wildlife, and raw terrain. Hover any tile to inspect it. |
| **The Paper** | A newspaper of everything that happened since your last visit. |
| **Time machine** | Drag the slider to load the world exactly as it was at any past century. |
| **Nations and Life** | Every living nation and species, plus the fallen and the extinct. |
| **Your Move** | One god power every 24 hours. It lands on the next tick and is written into history. |

## How it works

```
        every hour                      on every visit
┌──────────────────────┐          ┌──────────────────────┐
│   GitHub Actions     │          │   Vercel (Next.js)   │
│   runs the sim for   │          │   reads the save     │
│   one century        │          │   files and draws    │
└──────────┬───────────┘          └──────────┬───────────┘
           │ commits                         │ reads / writes your move
           ▼                                 ▼
      ┌─────────────────────────────────────────────┐
      │  `world` branch: state.json, chronicle.json,│
      │  history.json, move.json                    │
      └─────────────────────────────────────────────┘
```

- **GitHub is the database and the clock.** A scheduled workflow (`.github/workflows/tick.yml`) runs the simulation once an hour and commits the new world to the `world` branch. One commit is one century, and the commit message is that century's headline.
- **Git history is the time machine.** The site never stores old states. When you scrub the timeline, it asks GitHub for `state.json` at the commit for that century.
- **Vercel is only the window.** The Next.js site reads the save files through small API routes. The one thing it writes is `move.json`, your daily move.
- **The sim is deterministic.** Same seed and same moves give the same world, every time. That is what makes it testable.

Why not run the clock on Vercel? The free Vercel plan only fires scheduled jobs once a day. GitHub Actions can do hourly for free on a public repo.

## The simulation in one minute

- **Planet:** a 56 x 32 tile map that wraps east to west. Oceans, ice, tundra, mountains, desert, grassland, forest, jungle. The climate drifts between warm ages and ice ages, and the biomes move with it.
- **Life:** each species has a size, speed, diet, preferred temperature, and smarts. Populations grow, compete for food, get hunted, and spread tile by tile. Species branch into new ones with mutated traits. The ones that can't keep up fade out.
- **Nations:** when a land species reaches 7 smarts, it founds a nation. Nations grow, claim land, sail to new shores, climb from the Stone Age to the Space Age, sign trade pacts, and declare wars. Empires that overreach break apart in civil wars or collapse into ruins. Starfaring nations eventually leave the planet, and the cycle starts again.
- **Year 0** is "the Watching", the moment the world went live. Before that the sim fast-forwards through deep time until a species is close to waking up. Dates before it are marked BW.

## Project layout

```
sim/                  the world engine: pure TypeScript, no dependencies
  worldgen.ts         makes the planet and the first life
  step.ts             one century: climate, ecology, nations, disasters, your moves
  genesis.ts          deep time before Year 0
scripts/tick.ts       runs due ticks and commits each one (used by the workflow)
scripts/preview.ts    dev tool: fast-forward a world in your terminal
app/                  the Next.js site and its API routes
components/           map, newspaper, timeline, lists, move panel
lib/github.ts         reads and writes the world branch
tests/sim.test.ts     engine tests
.github/workflows/    the hourly tick
```

## Setup

The site needs two environment variables in Vercel (Project Settings, Environment Variables):

| Name | What it is |
| --- | --- |
| `GITHUB_TOKEN` | A fine-grained GitHub token limited to this repo with **Contents: Read and write**. Lets the site read history and save your move. |
| `MOVE_PASSWORD` | Any password you choose. You type it to cast your daily move, so strangers can't spend it. |

Never commit either one. After changing them, redeploy.

The tick workflow needs no setup. It uses the token GitHub gives every workflow run.

## Running it yourself

```bash
npm install
npm test                         # engine tests
npm run preview -- 99 400        # watch 400 centuries of seed 99 in the terminal

# run the site against a local world instead of GitHub
npm run tick -- --dir /tmp/world --no-git --ticks 200
WORLD_LOCAL_DIR=/tmp/world npm run dev
```

## Controls

- **Skip ahead:** on GitHub, open Actions, pick "Tick the world", press "Run workflow", and enter how many centuries to force.
- **Start a new world:** delete the `world` branch. The next tick creates a fresh planet. To choose the seed, add a repository variable named `WORLD_SEED` (Settings, Secrets and variables, Actions, Variables) first.
- **Pause:** disable the workflow in the Actions tab. The world freezes until you turn it back on, then catches up (at most 48 centuries per run).

## Good to know

- GitHub runs scheduled jobs late when it is busy, and sometimes skips one. The tick script checks the real clock and catches up, so the world never loses time.
- GitHub turns off scheduled workflows in a repo with no activity for 60 days. If the world ever stops, re-enable the workflow in the Actions tab.
- The move password is the only thing guarding the daily move. Pick something that isn't easy to guess.
