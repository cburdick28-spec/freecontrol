import type { Species, World } from "./types";
import { OCEAN, SEA_ICE, ICE, TUNDRA, MOUNTAIN, DESERT, GRASS, FOREST, JUNGLE } from "./types";

export const BIOME_NAME = ["ocean", "sea ice", "ice sheet", "tundra", "mountains", "desert", "grassland", "forest", "jungle"];
export const BIOME_COLOR = ["#12304a", "#a9c4d4", "#e6eef2", "#8a9a86", "#6f6a66", "#c9a86a", "#7da453", "#3f7a45", "#2a6140"];
export const FERTILITY = [0.45, 0.05, 0, 0.15, 0.1, 0.1, 0.8, 1, 1.1];
void [OCEAN, SEA_ICE, ICE, TUNDRA, MOUNTAIN, DESERT, GRASS, FOREST, JUNGLE];

export const ERAS = ["Stone Age", "Bronze Age", "Iron Age", "Medieval Age", "Renaissance", "Industrial Age", "Atomic Age", "Space Age"];
const ERA_AT = [0, 10, 22, 36, 52, 68, 82, 95];
export function eraOf(tech: number): number {
  let e = 0;
  for (let i = 0; i < ERA_AT.length; i++) if (tech >= ERA_AT[i]) e = i;
  return e;
}

export function sizeWord(size: number): string {
  return size < 2.5 ? "tiny" : size < 4.5 ? "small" : size < 6.5 ? "mid-sized" : size < 8.5 ? "large" : "giant";
}
export function dietWord(s: Pick<Species, "diet" | "habitat">): string {
  if (s.habitat === "sea") return s.diet === "h" ? "filter-feeders" : s.diet === "c" ? "sea hunters" : "scavengers";
  return s.diet === "h" ? "grazers" : s.diet === "c" ? "hunters" : "foragers";
}
export function climateWord(temp: number): string {
  return temp < 5 ? "cold-loving" : temp > 22 ? "heat-loving" : "temperate";
}
export function blurb(s: Species): string {
  return `${sizeWord(s.size)} ${climateWord(s.temp)} ${dietWord(s)}`;
}

export function yearLabel(year: number): string {
  if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BW`;
  return `Year ${year.toLocaleString("en-US")}`;
}

export function tileXY(w: Pick<World, "w">, i: number): [number, number] {
  return [i % w.w, Math.floor(i / w.w)];
}
