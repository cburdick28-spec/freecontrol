import type { World } from "./types";

// mulberry32, with its state stored on the world so every tick continues the same stream.
export function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) >>> 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const range = (w: World, a: number, b: number) => a + rand(w) * (b - a);
export const int = (w: World, n: number) => Math.floor(rand(w) * n);
export const pick = <T,>(w: World, arr: T[]): T => arr[int(w, arr.length)];
export const chance = (w: World, p: number) => rand(w) < p;
