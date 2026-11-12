import type { Species, World } from "./types";
import { biomeAt, isLand, tileTemp } from "./geo";
import { int, rand, range } from "./rng";
import { speciesName, worldName } from "./names";

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let v = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        v += hash3(xi + dx, yi + dy, zi + dz, seed) * (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
  return v;
}
function fbm(x: number, y: number, z: number, seed: number): number {
  let v = 0, amp = 1, f = 1, tot = 0;
  for (let o = 0; o < 4; o++) {
    v += noise3(x * f, y * f, z * f, seed + o * 101) * amp;
    tot += amp; amp *= 0.5; f *= 2;
  }
  return v / tot;
}

/** Turn raw noise into 0..100 percentiles so every seed gets the same land/sea split. */
function percentile(vals: number[]): number[] {
  const order = vals.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = new Array<number>(vals.length);
  order.forEach(([, i], rank) => (out[i] = Math.round((rank / (vals.length - 1)) * 100)));
  return out;
}

export function newSpecies(w: World, part: Partial<Species> & Pick<Species, "habitat" | "diet">): Species {
  const s: Species = {
    id: w.nextId++, name: speciesName(w), hue: int(w, 360), parent: 0, born: w.tick,
    size: 3, speed: 3, smarts: 1, temp: 15, pops: {}, total: 0, peak: 0, top: 0, ...part,
  };
  w.species.push(s);
  return s;
}

export function generate(seed: number, wd = 56, h = 32): World {
  const N = wd * h;
  const rawE: number[] = [], rawM: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < wd; x++) {
      const a = (x / wd) * Math.PI * 2;
      const cx = Math.cos(a) * 1.6, cz = Math.sin(a) * 1.6, cy = (y / h) * 3.2;
      rawE.push(fbm(cx + 7, cy, cz + 7, seed));
      rawM.push(fbm(cx * 1.3 + 31, cy * 1.3, cz * 1.3 + 31, seed + 999));
    }
  const w: World = {
    v: 1, seed, name: "", rng: seed >>> 0, tick: 0, dawn: 0, year: 0, epoch: "",
    w: wd, h, elev: percentile(rawE), moist: percentile(rawM), biome: new Array(N).fill(0), owner: new Array(N).fill(0),
    climate: 0, climateFx: [], climateMood: "mild", species: [], civs: [], ruins: [],
    rel: {}, wars: {}, pacts: {}, nextId: 1, appliedMoves: [],
  };
  w.name = worldName(w);
  for (let i = 0; i < N; i++) w.biome[i] = biomeAt(w, i, 0);

  const seedLife = (habitat: "land" | "sea", diet: "h" | "c" | "o", size: number) => {
    for (let tries = 0; tries < 400; tries++) {
      const i = int(w, N);
      if (isLand(w, i) !== (habitat === "land")) continue;
      const t = tileTemp(w, i, 0);
      if (t < 2 || t > 30) continue;
      const s = newSpecies(w, { habitat, diet, size, speed: range(w, 2, 5), smarts: range(w, 0.3, 1.5), temp: Math.round(t) });
      s.pops[i] = 300; s.total = 300; s.top = i;
      return;
    }
  };
  seedLife("sea", "h", 2); seedLife("sea", "h", 5); seedLife("sea", "c", 6);
  seedLife("land", "h", 2); seedLife("land", "h", 4); seedLife("land", "h", 7);
  seedLife("land", "o", 3); seedLife("land", "c", 5);
  void rand;
  return w;
}
