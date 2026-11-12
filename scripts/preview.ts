// Dev tool: run a world for a while and print what happens. `npx tsx scripts/preview.ts [seed] [ticks]`
import { genesis, step, headline, yearLabel, ERAS } from "../sim";

const seed = Number(process.argv[2] ?? 7), ticks = Number(process.argv[3] ?? 400);
const t0 = Date.now();
const { world, events } = genesis(seed, new Date(0).toISOString());
const land = world.elev.filter((e) => e >= 60).length;
console.log(`world ${world.name}: dawn at tick ${world.dawn}, ${events.length} prehistory events, land ${land}/${world.elev.length}, ${Date.now() - t0}ms`);
const kinds: Record<string, number> = {};
let big = 0;
for (let n = 0; n < ticks; n++) {
  const ev = step(world);
  for (const e of ev) { kinds[e.k] = (kinds[e.k] ?? 0) + 1; if (e.w === 3) { big++; if (big < 60) console.log(`  ${yearLabel(e.y)}: ${e.s}`); } }
  if (n % 50 === 49) {
    const sp = world.species.filter((s) => s.died === undefined), cv = world.civs.filter((c) => c.fell === undefined);
    console.log(`[${yearLabel(world.year)}] species ${sp.length} (land ${sp.filter((s) => s.habitat === "land").length}) landSmarts ${Math.max(0, ...sp.filter((s) => s.habitat === "land").map((s) => s.smarts))} | civs ${cv.map((c) => `${c.name}:${c.tiles}t/${c.pop}p/${ERAS[c.era]}/s${c.stability}`).join(", ")} | "${headline(ev)}"`);
  }
}
console.log(kinds, `state ${(JSON.stringify(world).length / 1024).toFixed(0)}KB, total ${Date.now() - t0}ms`);
