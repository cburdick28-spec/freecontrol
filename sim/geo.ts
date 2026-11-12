import type { World } from "./types";
import { OCEAN, SEA_ICE, ICE, TUNDRA, MOUNTAIN, DESERT, GRASS, FOREST, JUNGLE, SEA_LEVEL } from "./types";

export function currentClimate(w: Pick<World, "climate" | "climateFx" | "tick">): number {
  let c = w.climate;
  for (const fx of w.climateFx) if (fx.until > w.tick) c += fx.amount;
  return c;
}

export function tileTemp(w: Pick<World, "w" | "h" | "elev">, i: number, climate: number): number {
  const y = Math.floor(i / w.w);
  const mid = (w.h - 1) / 2;
  const lat = Math.abs(y - mid) / mid;
  return 30 - 46 * lat - Math.max(0, w.elev[i] - SEA_LEVEL) * 0.25 + climate;
}

export function biomeAt(w: Pick<World, "w" | "h" | "elev" | "moist">, i: number, climate: number): number {
  const t = tileTemp(w, i, climate);
  const e = w.elev[i];
  if (e < SEA_LEVEL) return t < -9 ? SEA_ICE : OCEAN;
  if (t < -6) return ICE;
  if (e > 93) return MOUNTAIN;
  if (t < 4) return TUNDRA;
  const m = w.moist[i];
  if (m < 28 && t > 16) return DESERT;
  if (m > 66 && t > 21) return JUNGLE;
  if (m > 46) return FOREST;
  return GRASS;
}

export const isLand = (w: Pick<World, "elev">, i: number) => w.elev[i] >= SEA_LEVEL;

const cache = new Map<string, Int32Array>();
/** 4 neighbours per tile, flat. East/west wraps; north/south edges repeat -1. */
export function neighbours(wd: number, h: number): Int32Array {
  const key = `${wd}x${h}`;
  let n = cache.get(key);
  if (n) return n;
  n = new Int32Array(wd * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < wd; x++) {
      const i = y * wd + x;
      n[i * 4] = y * wd + ((x + 1) % wd);
      n[i * 4 + 1] = y * wd + ((x - 1 + wd) % wd);
      n[i * 4 + 2] = y > 0 ? i - wd : -1;
      n[i * 4 + 3] = y < h - 1 ? i + wd : -1;
    }
  cache.set(key, n);
  return n;
}

export function dist(w: Pick<World, "w">, a: number, b: number): number {
  const ax = a % w.w, ay = Math.floor(a / w.w), bx = b % w.w, by = Math.floor(b / w.w);
  const dx = Math.abs(ax - bx);
  return Math.min(dx, w.w - dx) + Math.abs(ay - by);
}
