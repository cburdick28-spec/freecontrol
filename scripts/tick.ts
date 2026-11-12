// Advances the world and commits every tick as its own moment in git history.
//
//   npx tsx scripts/tick.ts --dir world            run every tick that is due (one per real hour)
//   npx tsx scripts/tick.ts --dir world --ticks 5  force exactly 5 ticks
//
// `--dir` is a checkout of the `world` branch. The site reads the files this writes.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genesis, step, headline, yearLabel, blurb, ERAS, type Move, type World, type WorldEvent } from "../sim";

const HOUR = 3_600_000, MAX_PER_RUN = 48, CHRONICLE_MAX = 600, HISTORY_MAX = 4000;
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const dir = arg("dir") ?? "world";
const forced = arg("ticks") ? Math.max(0, Math.min(500, Number(arg("ticks")) || 0)) : undefined;
const useGit = !process.argv.includes("--no-git");

const file = (n: string) => join(dir, n);
const read = <T,>(n: string, fallback: T): T => (existsSync(file(n)) ? JSON.parse(readFileSync(file(n), "utf8")) : fallback);
const write = (n: string, data: unknown) => writeFileSync(file(n), JSON.stringify(data) + "\n");
const git = (cmd: string) => useGit && execSync(`git ${cmd}`, { cwd: dir, stdio: "inherit" });

export interface HistoryRow { t: number; y: number; sp: number; cv: number; pop: number; c: number; h: string }

function row(w: World, ev: WorldEvent[]): HistoryRow {
  const civs = w.civs.filter((c) => c.fell === undefined);
  return {
    t: w.tick, y: w.year, sp: w.species.filter((s) => s.died === undefined).length, cv: civs.length,
    pop: civs.reduce((a, c) => a + c.pop, 0), c: w.climate, h: headline(ev),
  };
}

function readme(w: World, chronicle: WorldEvent[]): string {
  const civs = w.civs.filter((c) => c.fell === undefined).sort((a, b) => b.pop - a.pop);
  const species = w.species.filter((s) => s.died === undefined).sort((a, b) => b.total - a.total);
  const news = chronicle.filter((e) => e.w >= 2).slice(-12).reverse();
  return [
    `# The world of ${w.name}`, "",
    `**${yearLabel(w.year)}** · tick ${w.tick} · ${species.length} living species · ${civs.length} nations`, "",
    "This branch is the world's save file. A robot commits here every hour. Nobody edits it by hand.",
    "Every commit is one century. Read the commit log and you are reading history.", "",
    "## Latest news", "", ...(news.length ? news.map((e) => `- **${yearLabel(e.y)}** ${e.s}`) : ["- Nothing but wind and waves."]), "",
    "## Nations", "",
    ...(civs.length
      ? ["| Nation | Era | People | Land | Stability |", "| --- | --- | ---: | ---: | ---: |",
        ...civs.map((c) => `| ${c.name} | ${ERAS[c.era]} | ${c.pop.toLocaleString("en-US")} | ${c.tiles} | ${c.stability} |`)]
      : ["None yet. The world is still wild."]), "",
    "## Most common species", "",
    ...species.slice(0, 8).map((s) => `- **${s.name}**: ${blurb(s)}, ${s.total.toLocaleString("en-US")} alive${s.sapient ? " (thinking)" : ""}`), "",
  ].join("\n");
}

function save(w: World, chronicle: WorldEvent[], history: HistoryRow[], message: string) {
  write("state.json", w);
  write("chronicle.json", chronicle);
  write("history.json", history);
  writeFileSync(file("README.md"), readme(w, chronicle));
  if (!existsSync(file("vercel.json"))) writeFileSync(file("vercel.json"), JSON.stringify({ git: { deploymentEnabled: false } }, null, 2) + "\n");
  git("add -A");
  git(`commit -q -m ${JSON.stringify(message)}`);
}

function main() {
  let world = read<World | null>("state.json", null);
  let chronicle = read<WorldEvent[]>("chronicle.json", []);
  let history = read<HistoryRow[]>("history.json", []);

  if (!world) {
    const born = genesis(Number(process.env.WORLD_SEED || 99), new Date().toISOString());
    world = born.world;
    chronicle = born.events.filter((e) => e.w >= 2).slice(-120);
    chronicle.push({ t: world.tick, y: 0, k: "god", s: `The Watching begins. Someone is looking at ${world.name}`, w: 3 });
    history = [row(world, [])];
    save(world, chronicle, history, `Year 0: the Watching begins over ${world.name}`);
    console.log(`genesis: ${world.name}, seed ${world.seed}, ${world.tick} ticks of deep time`);
  }

  const elapsed = Math.floor((Date.now() - Date.parse(world.epoch)) / HOUR);
  const due = forced ?? Math.max(0, Math.min(MAX_PER_RUN, elapsed - (world.tick - world.dawn)));
  if (forced !== undefined) world.epoch = new Date(Date.parse(world.epoch) - Math.max(0, forced - Math.max(0, elapsed - (world.tick - world.dawn))) * HOUR).toISOString();
  console.log(`${due} tick(s) due`);

  for (let n = 0; n < due; n++) {
    const move = read<Move | null>("move.json", null);
    const ev = step(world, move && typeof move.id === "string" ? [move] : []);
    chronicle.push(...ev);
    if (chronicle.length > CHRONICLE_MAX) chronicle = chronicle.slice(-CHRONICLE_MAX);
    history.push(row(world, ev));
    if (history.length > HISTORY_MAX) history = history.filter((_, i) => i >= HISTORY_MAX / 2 || i % 2 === 0);
    save(world, chronicle, history, `${yearLabel(world.year)}: ${headline(ev)}`);
    console.log(`${yearLabel(world.year)}: ${headline(ev)}`);
  }
}

main();
