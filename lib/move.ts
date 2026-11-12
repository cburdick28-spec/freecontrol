import type { Move } from "@/sim";

export const DAY = 24 * 3_600_000;

export interface MoveStatus { last: Move | null; nextAt: string | null; ready: boolean }

export function moveStatus(last: Move | null, now = Date.now()): MoveStatus {
  if (!last) return { last: null, nextAt: null, ready: true };
  const next = Date.parse(last.at) + DAY;
  return { last, nextAt: new Date(next).toISOString(), ready: now >= next };
}

export const POWERS = {
  meteor: { name: "Meteor", needs: "tile", blurb: "Flatten everything within three tiles and darken the sky for centuries." },
  plague: { name: "Plague", needs: "target", blurb: "Hollow out one nation or one species." },
  bless: { name: "Blessing", needs: "species", blurb: "One species breeds and spreads like never before for a thousand years." },
  fire: { name: "Gift of Fire", needs: "species", blurb: "Make one species smarter. Smart enough, and it builds nations." },
  iceage: { name: "Ice Age", needs: "none", blurb: "Dim the sun. Glaciers march for fifteen centuries." },
} as const;

export type Power = keyof typeof POWERS;
