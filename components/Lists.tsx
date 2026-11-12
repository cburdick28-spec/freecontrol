"use client";
import { blurb, ERAS, yearLabel, type World } from "@/sim";
import { compact, num } from "@/lib/format";

const TRAIT = { warlike: "Warlike", traders: "Traders", builders: "Builders", zealots: "Zealots" } as const;

function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-line align-middle">
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </span>
  );
}

export function Nations({ world, picked, onPick }: { world: World; picked: number | null; onPick: (id: number, capital: number) => void }) {
  const live = world.civs.filter((c) => c.fell === undefined).sort((a, b) => b.pop - a.pop);
  const fallen = world.civs.filter((c) => c.fell !== undefined).sort((a, b) => b.fell! - a.fell!);
  const name = (id: number) => world.civs.find((c) => c.id === id)?.name ?? "?";
  const species = (id: number) => world.species.find((s) => s.id === id)?.name ?? "a lost people";
  const links = (book: Record<string, number>, id: number) =>
    Object.keys(book).map((k) => k.split("-").map(Number)).filter((p) => p.includes(id)).map((p) => name(p[0] === id ? p[1] : p[0]));

  if (!live.length && !fallen.length)
    return <p className="text-sm leading-6 text-dim">No nations yet. Somewhere out there, a species is getting clever. Check the Life tab and watch the smartest ones.</p>;

  return (
    <div className="space-y-2">
      {live.map((c) => {
        const wars = links(world.wars, c.id), pacts = links(world.pacts, c.id);
        return (
          <button key={c.id} onClick={() => onPick(c.id, c.capital)}
            className={`block w-full rounded-sm border p-3 text-left transition-colors ${picked === c.id ? "border-gold bg-raised" : "border-line bg-panel hover:border-dim"}`}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: `hsl(${c.hue},68%,52%)` }} />
              <span className="font-serif text-lg leading-tight">{c.name}</span>
              {c.stars && <span className="label !text-gold">starfaring</span>}
            </div>
            <p className="mt-1 text-xs text-dim">{ERAS[c.era]} · {TRAIT[c.trait]} · people of the {species(c.species)} · founded {yearLabel((c.founded - world.dawn) * 100)}</p>
            <p className="mt-2 font-mono text-xs text-text">
              {compact(c.pop)} people · {c.tiles} lands · steady <Meter value={c.stability} max={100} color={c.stability < 30 ? "#e0694a" : "#6fb3a8"} /> · tech <Meter value={c.tech} max={100} color="#e3b45c" />
            </p>
            {wars.length > 0 && <p className="mt-1 text-xs text-ember">At war with {wars.join(", ")}</p>}
            {pacts.length > 0 && <p className="mt-1 text-xs text-[#6fb3a8]">Trade pact with {pacts.join(", ")}</p>}
          </button>
        );
      })}
      {fallen.length > 0 && (
        <details className="rounded-sm border border-line p-3">
          <summary className="label cursor-pointer">Fallen nations ({fallen.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-dim">
            {fallen.slice(0, 40).map((c) => (
              <li key={c.id}><span className="font-serif text-text">{c.name}</span> · {yearLabel((c.founded - world.dawn) * 100)} to {yearLabel((c.fell! - world.dawn) * 100)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function SpeciesList({ world, picked, onPick }: { world: World; picked: number | null; onPick: (id: number | null) => void }) {
  const live = world.species.filter((s) => s.died === undefined).sort((a, b) => b.total - a.total);
  const dead = world.species.filter((s) => s.died !== undefined).sort((a, b) => b.died! - a.died!);
  const parent = (id: number) => world.species.find((s) => s.id === id)?.name;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-dim">Tap a species to see where it lives. Smarts of 7 or more means it can build nations.</p>
      {live.map((s) => (
        <button key={s.id} onClick={() => onPick(picked === s.id ? null : s.id)}
          className={`block w-full rounded-sm border px-3 py-2 text-left transition-colors ${picked === s.id ? "border-gold bg-raised" : "border-line bg-panel hover:border-dim"}`}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `hsl(${s.hue},70%,58%)` }} />
            <span className="font-serif text-base leading-tight">{s.name}</span>
            {s.sapient && <span className="label !text-gold">thinking</span>}
            {s.fading && <span className="label !text-ember">fading</span>}
            {(s.blessedUntil ?? 0) > world.tick && <span className="label !text-[#6fb3a8]">blessed</span>}
            <span className="ml-auto font-mono text-xs text-dim">{num(s.total)}</span>
          </div>
          <p className="mt-0.5 text-xs text-dim">
            {s.habitat === "sea" ? "Sea" : "Land"} · {blurb(s)} · smarts <Meter value={s.smarts} max={10} color={s.smarts >= 7 ? "#e3b45c" : "#8793a8"} /> {s.smarts.toFixed(1)}
            {s.parent && parent(s.parent) ? ` · from the ${parent(s.parent)}` : ""}
          </p>
        </button>
      ))}
      {dead.length > 0 && (
        <details className="rounded-sm border border-line p-3">
          <summary className="label cursor-pointer">Extinct ({dead.length} remembered)</summary>
          <ul className="mt-2 space-y-1 text-sm text-dim">
            {dead.slice(0, 40).map((s) => (
              <li key={s.id}><span className="font-serif text-text">{s.name}</span> · {blurb(s)} · died {yearLabel((s.died! - world.dawn) * 100)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
