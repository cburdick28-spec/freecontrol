import type { World, WorldEvent } from "./types";
import { generate } from "./worldgen";
import { step } from "./step";

const LEAD = 9; // ticks between Year 0 and the first species able to wake up
const awake = (w: World) => w.species.some((s) => s.died === undefined && s.habitat === "land" && s.smarts >= 7 && s.total >= 500);

/**
 * Make a world and fast-forward through deep time. Year 0 (the Watching) is set a
 * few centuries before the first species is ready to become a civilization, so the
 * opening days are wild nature and the first nation shows up soon after.
 *
 * The sim is deterministic, so we run once to find that moment, then replay to just before it.
 */
export function genesis(seed: number, epoch: string): { world: World; events: WorldEvent[] } {
  // Some seeds never evolve a thinking species. Walk forward to the first seed that does.
  let wakeAt = 0;
  for (let attempt = 0; attempt < 25 && !wakeAt; attempt++, seed++) {
    const probe = generate(seed);
    for (let n = 0; n < 6000 && !wakeAt; n++) {
      step(probe, [], { noCivs: true });
      if (probe.tick > 150 + LEAD && awake(probe)) wakeAt = probe.tick;
    }
    if (wakeAt) break;
  }
  const world = generate(seed);
  const events: WorldEvent[] = [];
  const stopAt = wakeAt ? wakeAt - LEAD : 1500;
  while (world.tick < stopAt) events.push(...step(world, [], { noCivs: true }));
  world.dawn = world.tick;
  world.year = 0;
  world.epoch = epoch;
  for (const e of events) e.y = (e.t - world.dawn) * 100;
  return { world, events };
}
