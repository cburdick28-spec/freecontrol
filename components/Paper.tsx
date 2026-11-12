"use client";
import { useState } from "react";
import { yearLabel, type World, type WorldEvent } from "@/sim";

const KIND: Record<WorldEvent["k"], string> = {
  species: "Nature", extinct: "Extinction", civ: "Nations", war: "War", peace: "Peace", fall: "Collapse",
  era: "Progress", nature: "Nature", god: "Omen", split: "Civil war", pact: "Diplomacy",
};

interface Props { world: World; chronicle: WorldEvent[]; since: number | null; onLocate: (tile: number) => void }

export default function Paper({ world, chronicle, since, onLocate }: Props) {
  const [all, setAll] = useState(false);
  // New visitors get the last day. Returning visitors get everything since they left.
  const from = since === null || since >= world.tick ? world.tick - 24 : since;
  const fresh = chronicle.filter((e) => e.t > from);
  const big = fresh.filter((e) => e.w >= 2).sort((a, b) => b.w - a.w || b.t - a.t);
  const lead = big[0] ?? fresh[fresh.length - 1];
  const rest = (all ? [...fresh].reverse() : big.slice(1, 9)).filter((e) => e !== lead);
  const centuries = world.tick - from;
  const away = since !== null && since < world.tick;

  return (
    <article className="paper rounded-sm p-5 shadow-lg">
      <header className="border-b-2 border-paper-ink pb-2 text-center">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper-dim">
          {away ? `While you were gone: ${centuries} ${centuries === 1 ? "century" : "centuries"}` : "Latest edition"}
        </p>
        <h2 className="font-serif text-3xl font-bold leading-tight tracking-tight">The {world.name} Chronicle</h2>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper-dim">{yearLabel(world.year)}</p>
      </header>

      {lead ? (
        <button onClick={() => lead.tile !== undefined && onLocate(lead.tile)} className="mt-4 block w-full text-left">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ember">{KIND[lead.k]} · {yearLabel(lead.y)}</p>
          <p className="mt-1 font-serif text-2xl font-semibold leading-snug">{lead.s}.</p>
        </button>
      ) : (
        <p className="mt-4 font-serif text-xl">Nothing to report. The wind blows, the tides turn.</p>
      )}

      {rest.length > 0 && (
        <ul className="mt-4 divide-y divide-paper-ink/15 border-t border-paper-ink/30">
          {rest.map((e, i) => (
            <li key={`${e.t}-${i}`}>
              <button onClick={() => e.tile !== undefined && onLocate(e.tile)} className="flex w-full gap-3 py-2 text-left hover:bg-paper-ink/5">
                <span className="w-20 shrink-0 font-mono text-[0.62rem] uppercase leading-5 tracking-wider text-paper-dim">{yearLabel(e.y)}</span>
                <span className={`font-serif leading-5 ${e.w >= 2 ? "font-semibold" : "text-paper-ink/80"}`}>{e.s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {fresh.length > big.length && (
        <button onClick={() => setAll(!all)} className="mt-3 font-mono text-[0.68rem] uppercase tracking-widest text-paper-dim underline underline-offset-4">
          {all ? "Headlines only" : `Every story (${fresh.length})`}
        </button>
      )}
      <p className="mt-4 border-t border-paper-ink/30 pt-2 font-mono text-[0.6rem] uppercase tracking-widest text-paper-dim">
        One hour of your time is one century here. BW means before the Watching began.
      </p>
    </article>
  );
}
