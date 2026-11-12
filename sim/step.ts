import type { Civ, CivTrait, Move, Species, World, WorldEvent } from "./types";
import { ICE, MOUNTAIN, DESERT, TUNDRA, OCEAN, SEA_ICE } from "./types";
import { biomeAt, currentClimate, dist, isLand, neighbours, tileTemp } from "./geo";
import { chance, int, pick, rand, range } from "./rng";
import { civName, speciesName } from "./names";
import { blurb, eraOf, ERAS, FERTILITY } from "./describe";
import { newSpecies } from "./worldgen";

const MAX_SPECIES = { land: 16, sea: 11 };
const CROWDED = { land: 11, sea: 7 };
const MAX_CIVS = 10;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const alive = (w: World) => w.civs.filter((c) => c.fell === undefined);
const living = (w: World) => w.species.filter((s) => s.died === undefined);
const civById = (w: World, id: number) => w.civs.find((c) => c.id === id);

type Say = (k: WorldEvent["k"], s: string, weight: 1 | 2 | 3, tile?: number) => void;

export interface StepOptions { noCivs?: boolean }

/** Advance the world by one tick (one century). Mutates and returns the events of that tick. */
export function step(w: World, moves: Move[] = [], opts: StepOptions = {}): WorldEvent[] {
  w.tick++;
  w.year = (w.tick - w.dawn) * 100;
  const ev: WorldEvent[] = [];
  const say: Say = (k, s, weight, tile) => ev.push({ t: w.tick, y: w.year, k, s, w: weight, ...(tile === undefined ? {} : { tile }) });

  climate(w, say);
  for (const m of moves) {
    if (w.appliedMoves.includes(m.id)) continue;
    applyMove(w, m, say);
    w.appliedMoves.push(m.id);
    if (w.appliedMoves.length > 50) w.appliedMoves.shift();
  }
  ecology(w, say);
  if (!opts.noCivs) civPhase(w, say);
  nature(w, say);
  tidy(w);
  return ev;
}

export function headline(ev: WorldEvent[]): string {
  if (!ev.length) return "A quiet century";
  return ev.reduce((a, b) => (b.w > a.w ? b : a)).s;
}

// ---------------------------------------------------------------- climate

function climate(w: World, say: Say) {
  const phase = (w.seed % 628) / 100;
  w.climate = round1(7 * Math.sin(w.tick / 41 + phase) + 3.5 * Math.sin(w.tick / 13 + phase * 2));
  w.climateFx = w.climateFx.filter((f) => f.until > w.tick);
  const c = currentClimate(w);
  for (let i = 0; i < w.biome.length; i++) w.biome[i] = biomeAt(w, i, c);
  const mood = c < -6 ? "cold" : c > 6 ? "warm" : "mild";
  if (mood !== w.climateMood) {
    if (mood === "cold") say("nature", "The world cools. Glaciers creep down from the poles", 2);
    else if (mood === "warm") say("nature", "A warm age begins. The ice retreats and the seas rise with life", 2);
    else say("nature", w.climateMood === "cold" ? "The long cold ends" : "The great warmth fades", 1);
    w.climateMood = mood;
  }
}

// ---------------------------------------------------------------- ecology

function ecology(w: World, say: Say) {
  const N = w.w * w.h, nb = neighbours(w.w, w.h), c = currentClimate(w);
  const temp = new Float64Array(N), fert = new Float64Array(N), land = new Uint8Array(N);
  for (let i = 0; i < N; i++) { temp[i] = tileTemp(w, i, c); fert[i] = FERTILITY[w.biome[i]]; land[i] = isLand(w, i) ? 1 : 0; }

  const sp = living(w), L = sp.length;
  const P = sp.map((s) => { const a = new Float64Array(N); for (const k in s.pops) a[+k] = s.pops[k]; return a; });
  const blessed = sp.map((s) => (s.blessedUntil ?? 0) > w.tick);
  const adv = sp.map((s, i) => 0.7 + 0.03 * s.speed + 0.06 * s.smarts + (blessed[i] ? 0.5 : 0));
  const rate = sp.map((s, i) => (0.6 / Math.pow(s.size, 0.3)) * (blessed[i] ? 1.6 : 1));
  const span = sp.map((s) => (s.diet === "o" ? 22 : 16));
  const alpha = sp.map((a) => sp.map((b) =>
    a.habitat === b.habitat && (a.diet === "c") === (b.diet === "c") ? Math.exp(-(((a.size - b.size) / 2.5) ** 2)) : 0));
  const suit = (i: number, t: number) => Math.max(0, 1 - Math.abs(temp[t] - sp[i].temp) / span[i]);

  const civTech = new Map<number, Civ>();
  for (const cv of alive(w)) civTech.set(cv.id, cv);

  const next = P.map((a) => new Float64Array(a));
  const present: number[] = [];
  for (let t = 0; t < N; t++) {
    present.length = 0;
    for (let i = 0; i < L; i++) if (P[i][t] > 0) present.push(i);
    if (!present.length) continue;
    let prey = 0, hunters = 0;
    for (const i of present) { const m = P[i][t] * sp[i].size; if (sp[i].diet === "c") hunters += m; else prey += m; }
    const K = fert[t] * 4000;
    for (const i of present) {
      const s = sp[i], p = P[i][t], sf = suit(i, t);
      if (sf < 0.05) { next[i][t] = p * 0.4; continue; }
      let D = 0;
      for (const j of present) D += alpha[i][j] * P[j][t] * sp[j].size;
      const cap = (s.diet === "c" ? prey * 0.12 : K * (s.diet === "o" ? 0.8 : 1)) * sf * adv[i];
      const f = cap > 0 ? 1 - D / cap : -1;
      next[i][t] = p * Math.max(0.2, 1 + rate[i] * Math.max(-1, f));
    }
    if (hunters > 0 && prey > 0) {
      const frac = Math.min(0.25, (hunters * 0.6) / prey);
      for (const i of present) if (sp[i].diet !== "c") next[i][t] *= 1 - frac;
    }
    const own = w.owner[t];
    if (own) {
      const cv = civTech.get(own);
      if (cv) {
        const loss = Math.min(0.4, 0.02 + cv.tech / 350);
        for (const i of present) if (sp[i].id !== cv.species) next[i][t] *= 1 - loss;
      }
    }
  }

  // spread into neighbouring tiles
  for (let i = 0; i < L; i++) {
    const s = sp[i], arr = next[i], delta = new Float64Array(N), wantLand = s.habitat === "land" ? 1 : 0;
    const mv = (0.04 + 0.012 * s.speed) / 4;
    for (let t = 0; t < N; t++) {
      const p = arr[t];
      if (p < 30) continue;
      for (let d = 0; d < 4; d++) {
        const n = nb[t * 4 + d];
        if (n < 0 || land[n] !== wantLand || suit(i, n) < 0.08) continue;
        delta[n] += p * mv; delta[t] -= p * mv;
      }
    }
    for (let t = 0; t < N; t++) arr[t] += delta[t];
  }

  // write back, extinctions
  const civSpecies = new Set(alive(w).map((cv) => cv.species));
  // a crowded world pushes its rarest species into a slow fade, which keeps evolution moving
  for (const hab of ["land", "sea"] as const) {
    const here = sp.filter((s) => s.habitat === hab);
    if (here.length > CROWDED[hab] && !here.some((s) => s.fading)) {
      let weak: Species | undefined;
      for (const s of here) {
        if (civSpecies.has(s.id) || s.sapient || w.tick - s.born < 6) continue;
        if (!weak || s.total * (1 + s.smarts / 4) < weak.total * (1 + weak.smarts / 4)) weak = s;
      }
      if (weak) weak.fading = true;
    }
  }
  for (let i = 0; i < L; i++) if (sp[i].fading) for (let t = 0; t < N; t++) next[i][t] *= 0.65;
  for (let i = 0; i < L; i++) {
    const s = sp[i], arr = next[i];
    const prevTop = s.top;
    s.pops = {}; s.total = 0;
    let best = 0;
    for (let t = 0; t < N; t++) {
      const v = Math.floor(arr[t]);
      if (v >= 1) { s.pops[t] = v; s.total += v; if (v > best) { best = v; s.top = t; } }
    }
    if (s.total > s.peak) s.peak = s.total;
    if (s.total < 15 && !civSpecies.has(s.id)) {
      s.died = w.tick; s.pops = {}; s.total = 0;
      const killer = w.owner[prevTop] ? civById(w, w.owner[prevTop]) : undefined;
      const lived = (s.died - s.born) * 100;
      say("extinct",
        killer ? `The ${s.name} are gone, crowded out as the ${killer.name} spreads`
          : `The ${s.name} go extinct after ${lived.toLocaleString("en-US")} years`,
        s.peak > 20000 ? 2 : 1, prevTop);
    }
  }

  speciate(w, say, temp, land, nb);

  if (!living(w).length) {
    const s = newSpecies(w, { habitat: "sea", diet: "h", size: 2, temp: 15 });
    for (let tries = 0; tries < 500; tries++) {
      const t = int(w, N);
      if (!land[t] && w.biome[t] === OCEAN) { s.pops[t] = 300; s.total = 300; s.top = t; break; }
    }
    say("species", `Life restarts. The ${s.name} stir in the empty seas`, 3, s.top);
  }
}

function speciate(w: World, say: Say, temp: Float64Array, land: Uint8Array, nb: Int32Array) {
  const N = w.w * w.h;
  for (const s of living(w)) {
    const keys = Object.keys(s.pops);
    if (!keys.length) continue;
    if (!chance(w, Math.min(0.12, 0.03 + 0.0007 * keys.length))) continue;
    const origin = +pick(w, keys);
    let habitat = s.habitat, diet = s.diet, place = -1;
    const flip = chance(w, s.habitat === "sea" ? 0.25 : 0.06);
    if (flip) {
      for (let d = 0; d < 4; d++) {
        const n = nb[origin * 4 + d];
        if (n >= 0 && land[n] !== (s.habitat === "land" ? 1 : 0) && w.biome[n] !== ICE && w.biome[n] !== SEA_ICE) { place = n; break; }
      }
      if (place >= 0) habitat = s.habitat === "sea" ? "land" : "sea";
    }
    let rafted = false;
    if (place < 0 && s.habitat === "land" && chance(w, 0.08)) {
      for (let tries = 0; tries < 30; tries++) {
        const t = int(w, N);
        if (land[t] && dist(w, t, origin) <= 8 && !s.pops[t] && Math.abs(temp[t] - s.temp) < 10) { place = t; rafted = true; break; }
      }
    }
    if (living(w).filter((x) => x.habitat === habitat).length >= MAX_SPECIES[habitat]) continue;
    if (chance(w, 0.08)) diet = pick(w, ["h", "c", "o"] as const);
    let taken = 0;
    const share: Record<string, number> = {};
    for (const k of keys) {
      if (dist(w, +k, origin) > 2) continue;
      const take = Math.floor(s.pops[k] * 0.5);
      if (take < 1) continue;
      share[k] = take; taken += take;
    }
    if (taken < 40) continue;
    for (const k in share) { s.pops[k] -= share[k]; s.total -= share[k]; }
    const d = newSpecies(w, {
      habitat, diet, parent: s.id, name: speciesName(w), hue: (s.hue + Math.round(range(w, -30, 30)) + 360) % 360,
      size: round1(clamp(s.size * range(w, 0.75, 1.33), 1, 10)),
      speed: round1(clamp(s.speed + range(w, -1.5, 1.5), 1, 10)),
      smarts: round1(clamp(s.smarts + (rand(w) - 0.36) * 2.2, 0, 10)),
      temp: Math.round(place >= 0 ? temp[place] : clamp(s.temp + range(w, -8, 8), -15, 32)),
    });
    if (place >= 0) d.pops = { [place]: taken }; else d.pops = share;
    d.total = taken; d.peak = taken; d.top = place >= 0 ? place : origin;
    if (habitat !== s.habitat)
      say("species", habitat === "land"
        ? `The ${d.name} crawl out of the sea. Descendants of the ${s.name} now walk on land`
        : `The ${d.name} return to the water, leaving their ${s.name} cousins ashore`, 2, d.top);
    else if (rafted) say("species", `A few ${s.name} drift to a far shore and become the ${d.name}`, 1, d.top);
    else say("species", `The ${d.name} (${blurb(d)}) branch off from the ${s.name}`, 1, d.top);
  }
}

// ---------------------------------------------------------------- civilizations

const TRAITS: CivTrait[] = ["warlike", "traders", "builders", "zealots"];

function claimable(w: World, t: number, tech: number): boolean {
  if (w.owner[t] || !isLand(w, t)) return false;
  const b = w.biome[t];
  if (b === ICE) return false;
  if (b === MOUNTAIN) return tech > 15;
  if (b === DESERT || b === TUNDRA) return tech > 8;
  return true;
}

function found(w: World, s: Species, tile: number): Civ {
  const nb = neighbours(w.w, w.h);
  const trait = pick(w, TRAITS);
  const cv: Civ = {
    id: w.nextId++, name: civName(w, trait), species: s.id, hue: (w.nextId * 137) % 360, trait,
    capital: tile, founded: w.tick, pop: 200, tech: 1, stability: 70, tiles: 1, era: 0,
  };
  w.civs.push(cv);
  w.owner[tile] = cv.id;
  for (let d = 0; d < 4; d++) { const n = nb[tile * 4 + d]; if (n >= 0 && claimable(w, n, 0)) w.owner[n] = cv.id; }
  return cv;
}

function fall(w: World, cv: Civ, reason: string, say: Say) {
  cv.fell = w.tick;
  for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === cv.id) w.owner[i] = 0;
  cv.tiles = 0;
  w.ruins.push({ tile: cv.capital, name: cv.name, tick: w.tick });
  if (w.ruins.length > 40) w.ruins.shift();
  for (const book of [w.rel, w.wars, w.pacts]) for (const k of Object.keys(book)) if (k.split("-").includes(String(cv.id))) delete book[k];
  const years = (w.tick - cv.founded) * 100;
  say("fall", `${cv.name} ${reason} after ${years.toLocaleString("en-US")} years`, 3, cv.capital);
}

function recount(w: World) {
  const count = new Map<number, number>();
  for (const o of w.owner) if (o) count.set(o, (count.get(o) ?? 0) + 1);
  for (const cv of w.civs) if (cv.fell === undefined) cv.tiles = count.get(cv.id) ?? 0;
}

function someTile(w: World, id: number): number {
  const N = w.owner.length, start = int(w, N);
  for (let k = 0; k < N; k++) { const t = (start + k) % N; if (w.owner[t] === id) return t; }
  return -1;
}

function civPhase(w: World, say: Say) {
  const N = w.w * w.h, nb = neighbours(w.w, w.h);

  // the spark: smart land species found civilizations
  for (const s of living(w)) {
    if (s.habitat !== "land" || s.smarts < 7 || s.total < 500) continue;
    const own = alive(w).filter((cv) => cv.species === s.id).length;
    const first = !s.sapient;
    if (first) { s.sapient = true; say("civ", `The ${s.name} learn to speak, tame fire, and bury their dead`, 3, s.top); }
    const p = own === 0 ? 0.6 : own < 3 && alive(w).length < MAX_CIVS ? 0.05 : 0;
    if (!chance(w, p)) continue;
    const spots = Object.keys(s.pops).map(Number).filter((t) => !w.owner[t] && FERTILITY[w.biome[t]] > 0.3).sort((a, b) => s.pops[b] - s.pops[a] || a - b);
    if (!spots.length) continue;
    const cv = found(w, s, spots[0]);
    say("civ", `The ${s.name} raise their ${own === 0 ? "first" : "newest"} nation: the ${cv.name}`, own === 0 ? 3 : 2, cv.capital);
  }

  recount(w);
  let civs = alive(w);
  if (!civs.length) return;

  // one pass over the map: carrying capacity, frontiers, coasts, borders
  const cap = new Map<number, number>(), frontier = new Map<number, number[]>(), coast = new Map<number, number[]>();
  const borders = new Map<string, number[]>();
  const techOf = new Map(civs.map((cv) => [cv.id, cv.tech]));
  for (let t = 0; t < N; t++) {
    const a = w.owner[t];
    if (!a) continue;
    cap.set(a, (cap.get(a) ?? 0) + FERTILITY[w.biome[t]] * 220 * (1 + (techOf.get(a) ?? 0) / 18));
    for (let d = 0; d < 4; d++) {
      const n = nb[t * 4 + d];
      if (n < 0) continue;
      const b = w.owner[n];
      if (!b) {
        if (isLand(w, n)) { if (!frontier.has(a)) frontier.set(a, []); frontier.get(a)!.push(n); }
        else { if (!coast.has(a)) coast.set(a, []); coast.get(a)!.push(t * 4 + d); }
      } else if (b !== a && a < b) {
        const k = key(a, b);
        if (!borders.has(k)) borders.set(k, []);
        borders.get(k)!.push(t, n);
      }
    }
  }

  for (const cv of civs) {
    if (cv.tiles === 0) { fall(w, cv, "vanishes", say); continue; }
    const K = cap.get(cv.id) ?? 0;
    cv.pop = K > 0 ? cv.pop + 0.3 * cv.pop * (1 - cv.pop / K) : cv.pop * 0.7;
    cv.pop = Math.max(1, Math.round(cv.pop));
    const gain = (0.11 + Math.log10(1 + cv.pop) / 28) * (cv.trait === "builders" ? 1.15 : cv.trait === "zealots" ? 0.85 : 1);
    cv.tech = round1(Math.min(100, cv.tech + gain));
    const era = eraOf(cv.tech);
    if (era > cv.era) { cv.era = era; say("era", `${cv.name} enters the ${ERAS[era]}`, era >= 5 ? 2 : 1, cv.capital); }
    if (cv.tech >= 100 && !cv.stars) { cv.stars = true; say("era", `${cv.name} launches its first ship beyond the sky`, 3, cv.capital); }

    // expansion
    const edge = frontier.get(cv.id) ?? [];
    const pressure = clamp(K > 0 ? cv.pop / K : 0, 0.1, 0.9);
    const tries = 1 + Math.floor(cv.tech / 18);
    for (let k = 0; k < tries && edge.length; k++) {
      const t = pick(w, edge);
      if (chance(w, pressure) && claimable(w, t, cv.tech)) w.owner[t] = cv.id;
    }
    const shore = coast.get(cv.id) ?? [];
    if (cv.tech >= 30 && shore.length && chance(w, 0.15)) {
      const code = pick(w, shore), d = code % 4;
      let t = nb[code];
      for (let hop = 0; hop < 6 && t >= 0 && !isLand(w, t); hop++) t = nb[t * 4 + d];
      if (t >= 0 && isLand(w, t) && claimable(w, t, cv.tech)) {
        w.owner[t] = cv.id;
        say("civ", `Ships of the ${cv.name} plant a colony across the water`, 1, t);
      }
    }
  }

  // diplomacy and war
  civs = alive(w);
  for (let i = 0; i < civs.length; i++)
    for (let j = i + 1; j < civs.length; j++) {
      const A = civs[i], B = civs[j];
      if (A.fell !== undefined || B.fell !== undefined) continue;
      const k = key(A.id, B.id), line = borders.get(k);
      let r = w.rel[k] ?? 0;
      if (line) {
        r += range(w, -6, 5) + (w.pacts[k] ? 2 : 0) + (A.species === B.species ? 1 : -1);
        for (const cv of [A, B]) r += cv.trait === "warlike" ? -2 : cv.trait === "traders" ? 2 : 0;
      } else r -= r * 0.05;
      r = Math.round(clamp(r, -100, 100));
      w.rel[k] = r;

      if (w.wars[k] !== undefined) { wage(w, A, B, k, line, say); continue; }
      if (line && r < -55 && chance(w, 0.35)) {
        w.wars[k] = w.tick; delete w.pacts[k];
        const [x, y] = A.trait === "warlike" || (B.trait !== "warlike" && chance(w, 0.5)) ? [A, B] : [B, A];
        say("war", `${x.name} declares war on ${y.name}`, 2, x.capital);
      } else if (line && r > 55 && !w.pacts[k]) {
        w.pacts[k] = w.tick;
        say("pact", `${A.name} and ${B.name} swear a pact of trade`, 1, A.capital);
      }
      if (w.pacts[k]) {
        const hi = Math.max(A.tech, B.tech);
        A.tech = round1(A.tech + (hi - A.tech) * 0.03); B.tech = round1(B.tech + (hi - B.tech) * 0.03);
      }
    }

  recount(w);
  for (const cv of alive(w)) {
    if (cv.tiles === 0) { fall(w, cv, "is wiped from the map", say); continue; }
    const wars = Object.keys(w.wars).filter((k) => k.split("-").includes(String(cv.id))).length;
    const age = w.tick - cv.founded;
    const target = 75 - Math.max(0, cv.tiles - (14 + cv.tech * 0.8)) * 1.1 - wars * 8 - age / 25 + (cv.trait === "builders" ? 8 : 0);
    cv.stability = Math.round(clamp(cv.stability + (target - cv.stability) * 0.15 + range(w, -4, 4), 0, 100));

    if (cv.stability < 12 && chance(w, 0.3)) { fall(w, cv, "collapses into ruin", say); continue; }
    if (cv.stars && chance(w, 0.012)) { fall(w, cv, "leaves for the stars, its cities standing empty", say); continue; }
    if (cv.stability < 32 && cv.tech > 5 && !cv.stars) {
      cv.tech = round1(cv.tech - 0.6);
      const era = eraOf(cv.tech);
      if (era < cv.era) { cv.era = era; say("era", `A dark age falls on ${cv.name}. Knowledge is lost`, 2, cv.capital); }
    }
    if (cv.pop < 20) { fall(w, cv, "dwindles to nothing", say); continue; }
    if (cv.stability < 25 && cv.tiles >= 8 && alive(w).length < MAX_CIVS + 2 && chance(w, 0.15)) split(w, cv, say);
  }
}

function strength(w: World, cv: Civ): number {
  return (cv.pop / Math.max(1, cv.tiles)) * (1 + cv.tech / 15) * (0.5 + rand(w)) * (0.5 + cv.stability / 100) * (cv.trait === "warlike" ? 1.25 : 1);
}

function wage(w: World, A: Civ, B: Civ, k: string, line: number[] | undefined, say: Say) {
  const length = w.tick - w.wars[k];
  if (!line) {
    if (length > 3) { delete w.wars[k]; w.rel[k] = -20; say("peace", `The war between ${A.name} and ${B.name} fizzles out`, 1); }
    return;
  }
  // line holds [tileOfLower, tileOfHigher, ...] where lower/higher is by civ id
  const [lo, hi] = A.id < B.id ? [A, B] : [B, A];
  const battles = Math.min(8, Math.ceil(line.length / 4));
  for (let n = 0; n < battles; n++) {
    const at = int(w, line.length / 2) * 2, tl = line[at], th = line[at + 1];
    if (w.owner[tl] !== lo.id || w.owner[th] !== hi.id) continue;
    const win = strength(w, lo) > strength(w, hi) ? lo : hi, lose = win === lo ? hi : lo;
    const prize = win === lo ? th : tl;
    w.owner[prize] = win.id; win.tiles++; lose.tiles--;
    if (prize === lose.capital && lose.tiles > 0) {
      lose.capital = someTile(w, lose.id);
      lose.stability = Math.max(0, lose.stability - 15);
      say("war", `${win.name} sacks the capital of ${lose.name}`, 2, prize);
    }
  }
  A.pop = Math.max(1, Math.round(A.pop * 0.97)); B.pop = Math.max(1, Math.round(B.pop * 0.97));

  if (A.tech >= 82 && B.tech >= 82 && chance(w, 0.08)) {
    for (const cv of [A, B]) { cv.pop = Math.max(1, Math.round(cv.pop * 0.55)); cv.stability = Math.max(0, cv.stability - 30); }
    w.climateFx.push({ amount: -6, until: w.tick + 5 });
    say("war", `Fire from the sky: ${A.name} and ${B.name} trade atomic strikes`, 3, A.capital);
  }
  for (const [win, lose] of [[A, B], [B, A]] as const)
    if (lose.tiles <= 0 && lose.fell === undefined) { fall(w, lose, `is conquered by ${win.name}`, say); return; }
  if (length >= 4 && chance(w, 0.18)) {
    delete w.wars[k]; w.rel[k] = -15;
    say("peace", `${A.name} and ${B.name} make peace after ${(length * 100).toLocaleString("en-US")} years of war`, 2);
  }
}

function split(w: World, cv: Civ, say: Say) {
  const mine: number[] = [];
  for (let t = 0; t < w.owner.length; t++) if (w.owner[t] === cv.id) mine.push(t);
  let far = mine[0];
  for (const t of mine) if (dist(w, t, cv.capital) > dist(w, far, cv.capital)) far = t;
  const rebels = mine.filter((t) => dist(w, t, far) < dist(w, t, cv.capital));
  if (rebels.length < 2 || rebels.length === mine.length) return;
  const trait = pick(w, TRAITS);
  const nu: Civ = {
    id: w.nextId++, name: civName(w, trait), species: cv.species, hue: (w.nextId * 137) % 360, trait,
    capital: far, founded: w.tick, pop: Math.max(20, Math.round((cv.pop * rebels.length) / mine.length)), tech: round1(cv.tech * 0.75),
    stability: 60, tiles: rebels.length, era: eraOf(cv.tech * 0.75),
  };
  w.civs.push(nu);
  for (const t of rebels) w.owner[t] = nu.id;
  cv.pop = Math.max(20, cv.pop - nu.pop); cv.tiles -= rebels.length; cv.stability = Math.min(100, cv.stability + 35);
  const k = key(cv.id, nu.id);
  w.rel[k] = -70; w.wars[k] = w.tick;
  say("split", `Civil war tears ${cv.name} apart. The ${nu.name} break away`, rebels.length >= 10 ? 3 : 2, far);
}

// ---------------------------------------------------------------- nature and gods

function scorch(w: World, centre: number, radius: number, kill: number) {
  for (const s of living(w))
    for (const k of Object.keys(s.pops)) {
      if (dist(w, +k, centre) > radius) continue;
      const left = Math.floor(s.pops[k] * (1 - kill));
      s.total -= s.pops[k] - left;
      if (left >= 1) s.pops[k] = left; else delete s.pops[k];
    }
}

function nature(w: World, say: Say) {
  const N = w.w * w.h;
  if (chance(w, 0.03)) {
    let best = -1;
    for (let k = 0; k < 20; k++) { const t = int(w, N); if (isLand(w, t) && (best < 0 || w.elev[t] > w.elev[best])) best = t; }
    if (best >= 0) {
      scorch(w, best, 1, 0.8);
      const cv = w.owner[best] ? civById(w, w.owner[best]) : undefined;
      if (cv) cv.pop = Math.max(1, Math.round(cv.pop * 0.93));
      say("nature", cv ? `A volcano erupts in the lands of ${cv.name}` : "A volcano erupts in the wilderness", cv ? 2 : 1, best);
    }
  }
  const civs = alive(w);
  if (civs.length && chance(w, 0.025)) {
    const cv = pick(w, civs);
    cv.pop = Math.max(1, Math.round(cv.pop * 0.6)); cv.stability = Math.max(0, cv.stability - 10);
    say("nature", `A plague sweeps through ${cv.name}`, 2, cv.capital);
  }
  if (civs.length && chance(w, 0.025)) {
    const cv = pick(w, civs);
    cv.stability = Math.min(100, cv.stability + 18); cv.tech = round1(Math.min(100, cv.tech + 2));
    say("era", `A golden age dawns in ${cv.name}`, 1, cv.capital);
  }
}

function applyMove(w: World, m: Move, say: Say) {
  if (m.type === "meteor" && m.tile !== undefined && m.tile >= 0 && m.tile < w.owner.length) {
    scorch(w, m.tile, 3, 0.9);
    const hit = new Map<number, number>();
    for (let t = 0; t < w.owner.length; t++) {
      const d = dist(w, t, m.tile), o = w.owner[t];
      if (!o || d > 3) continue;
      hit.set(o, (hit.get(o) ?? 0) + 1);
      if (d <= 1) w.owner[t] = 0;
    }
    recount(w);
    for (const [id, n] of hit) {
      const cv = civById(w, id);
      if (!cv || cv.fell !== undefined) continue;
      cv.pop = Math.max(1, Math.round(cv.pop * (1 - Math.min(0.8, (n / Math.max(1, cv.tiles + n)) * 1.2))));
      cv.stability = Math.max(0, cv.stability - 20);
      if (w.owner[cv.capital] !== cv.id) { const t = someTile(w, cv.id); if (t >= 0) cv.capital = t; }
    }
    w.climateFx.push({ amount: -5, until: w.tick + 6 });
    const names = [...hit.keys()].map((id) => civById(w, id)?.name).filter(Boolean);
    say("god", names.length ? `A meteor falls from a clear sky and strikes ${names.join(" and ")}` : "A meteor falls from a clear sky. Dust darkens the world", 3, m.tile);
  } else if (m.type === "iceage") {
    w.climateFx.push({ amount: -12, until: w.tick + 15 });
    say("god", "Without warning, the sun dims. An age of ice is summoned", 3);
  } else if (m.type === "plague" && m.civ !== undefined) {
    const cv = civById(w, m.civ);
    if (cv && cv.fell === undefined) {
      cv.pop = Math.max(1, Math.round(cv.pop * 0.4)); cv.stability = Math.max(0, cv.stability - 15);
      say("god", `A sickness with no source hollows out ${cv.name}`, 3, cv.capital);
    }
  } else if (m.species !== undefined) {
    const s = w.species.find((x) => x.id === m.species && x.died === undefined);
    if (!s) return;
    if (m.type === "plague") {
      for (const k of Object.keys(s.pops)) { const left = Math.floor(s.pops[k] * 0.3); if (left >= 1) s.pops[k] = left; else delete s.pops[k]; }
      s.total = Object.values(s.pops).reduce((a, b) => a + b, 0);
      say("god", `A sickness with no source cuts down the ${s.name}`, 3, s.top);
    } else if (m.type === "bless") {
      s.blessedUntil = w.tick + 10;
      say("god", `The ${s.name} are blessed. Their young thrive as never before`, 3, s.top);
    } else if (m.type === "fire") {
      s.smarts = round1(Math.min(10, s.smarts + 2));
      say("god", `Something stirs behind the eyes of the ${s.name}. They are given the spark`, 3, s.top);
    }
  }
}

function tidy(w: World) {
  const dead = w.species.filter((s) => s.died !== undefined);
  if (dead.length > 150) {
    const drop = new Set(dead.slice(0, dead.length - 150).map((s) => s.id));
    w.species = w.species.filter((s) => !drop.has(s.id));
  }
  const fallen = w.civs.filter((c) => c.fell !== undefined);
  if (fallen.length > 150) {
    const drop = new Set(fallen.slice(0, fallen.length - 150).map((c) => c.id));
    w.civs = w.civs.filter((c) => !drop.has(c.id));
  }
}
