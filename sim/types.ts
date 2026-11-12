// Shared shapes for the world. Everything here is plain JSON so it can live in git.

export const OCEAN = 0, SEA_ICE = 1, ICE = 2, TUNDRA = 3, MOUNTAIN = 4, DESERT = 5, GRASS = 6, FOREST = 7, JUNGLE = 8;

export type Diet = "h" | "c" | "o"; // herbivore, carnivore, omnivore
export type Habitat = "land" | "sea";
export type CivTrait = "warlike" | "traders" | "builders" | "zealots";

export interface Species {
  id: number;
  name: string;
  hue: number;
  parent: number;
  born: number; // tick
  died?: number; // tick
  size: number; // 1..10
  speed: number; // 1..10
  smarts: number; // 0..10
  temp: number; // preferred temperature
  diet: Diet;
  habitat: Habitat;
  pops: Record<string, number>; // tile index -> population
  total: number;
  peak: number;
  top: number; // tile with the biggest population
  blessedUntil?: number;
  sapient?: boolean;
  fading?: boolean;
}

export interface Civ {
  id: number;
  name: string;
  species: number;
  hue: number;
  trait: CivTrait;
  capital: number;
  founded: number;
  fell?: number;
  pop: number;
  tech: number; // 0..100
  stability: number; // 0..100
  tiles: number;
  era: number;
  stars?: boolean;
}

export interface Ruin { tile: number; name: string; tick: number }

export interface WorldEvent {
  t: number; // tick
  y: number; // year
  k: "species" | "extinct" | "civ" | "war" | "peace" | "fall" | "era" | "nature" | "god" | "split" | "pact";
  s: string; // headline text
  w: 1 | 2 | 3; // importance
  tile?: number;
}

export interface Move {
  id: string;
  type: "meteor" | "plague" | "bless" | "iceage" | "fire";
  tile?: number;
  species?: number;
  civ?: number;
  at: string; // ISO time it was cast
}

export interface World {
  v: 1;
  seed: number;
  name: string;
  rng: number;
  tick: number;
  dawn: number; // tick when the Watching began (year 0)
  year: number;
  epoch: string; // real time of dawn, ISO
  w: number;
  h: number;
  elev: number[];
  moist: number[];
  biome: number[];
  owner: number[];
  climate: number;
  climateFx: { amount: number; until: number }[];
  climateMood: "cold" | "mild" | "warm";
  species: Species[];
  civs: Civ[];
  ruins: Ruin[];
  rel: Record<string, number>;
  wars: Record<string, number>;
  pacts: Record<string, number>;
  nextId: number;
  appliedMoves: string[];
}

export const SEA_LEVEL = 60;
