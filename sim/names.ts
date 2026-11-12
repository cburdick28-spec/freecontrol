import type { CivTrait, World } from "./types";
import { int, pick } from "./rng";

const ONSET = ["k", "v", "th", "r", "m", "z", "sh", "t", "n", "l", "dr", "br", "g", "s", "h", "kr", "y", "f", "p", "qu"];
const VOWEL = ["a", "e", "i", "o", "u", "ae", "ou", "ia", "y"];
const CODA = ["", "", "n", "r", "l", "s", "th", "x", "m"];

function root(w: World, syl: number): string {
  let s = "";
  for (let i = 0; i < syl; i++) s += pick(w, ONSET) + pick(w, VOWEL) + (i === syl - 1 ? pick(w, CODA) : "");
  return s[0].toUpperCase() + s.slice(1);
}

export function speciesName(w: World): string {
  return root(w, 2) + pick(w, ["i", "a", "ids", "ops", "ae", "ons", "ari"]);
}

const TITLES: Record<CivTrait, string[]> = {
  warlike: ["Horde", "Empire", "Dominion", "Warbands"],
  traders: ["League", "Republic", "Compact", "Free Cities"],
  builders: ["Kingdom", "Realm", "Dynasty", "Commonwealth"],
  zealots: ["Covenant", "Theocracy", "Order", "Chosen"],
};

export function civName(w: World, trait: CivTrait): string {
  return `${root(w, 2)} ${pick(w, TITLES[trait])}`;
}

export function worldName(w: World): string {
  return root(w, 2 + int(w, 2));
}
