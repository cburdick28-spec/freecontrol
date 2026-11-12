"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BIOME_NAME, currentClimate, tileTemp, yearLabel, type World, type WorldEvent } from "@/sim";
import type { MoveStatus, Power } from "@/lib/move";
import { num, untilLabel } from "@/lib/format";
import WorldMap, { type Layer } from "./WorldMap";
import Timeline, { type HistoryRow } from "./Timeline";
import Paper from "./Paper";
import { Nations, SpeciesList } from "./Lists";
import MovePanel from "./MovePanel";

interface Payload { world: World; chronicle: WorldEvent[]; move: MoveStatus }
type Tab = "paper" | "nations" | "life" | "move";
const TABS: [Tab, string][] = [["paper", "The Paper"], ["nations", "Nations"], ["life", "Life"], ["move", "Your Move"]];
const SEEN = "freecontrol:lastSeenTick";
const HOUR = 3_600_000;

export default function Observatory() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [past, setPast] = useState<World | null>(null);
  const [travelling, setTravelling] = useState(false);
  const [layer, setLayer] = useState<Layer>("nations");
  const [tab, setTab] = useState<Tab>("paper");
  const [tile, setTile] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [species, setSpecies] = useState<number | null>(null);
  const [civ, setCiv] = useState<number | null>(null);
  const [power, setPower] = useState<Power>("meteor");
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const first = useRef(true);

  const load = useCallback(async () => {
    try {
      const [w, h] = await Promise.all([fetch("/api/world").then((r) => r.json()), fetch("/api/timeline").then((r) => r.json())]);
      if (w.error) { setError(w.error); return; }
      setError(null); setData(w); setHistory(h.history ?? []); setNow(Date.now());
      if (first.current) {
        first.current = false;
        let seen: number | null = null;
        try { const v = localStorage.getItem(SEEN); seen = v === null ? null : Number(v); localStorage.setItem(SEEN, String(w.world.tick)); } catch {}
        setSince(seen !== null && Number.isFinite(seen) ? seen : null);
        if (!w.world.civs.some((c: { fell?: number }) => c.fell === undefined)) setLayer("life");
      }
    } catch { setError("Could not reach the world. Check your connection and reload."); }
  }, []);

  useEffect(() => {
    const kick = setTimeout(load, 0);
    const poll = setInterval(load, 5 * 60_000), clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(kick); clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const travel = useCallback(async (tick: number) => {
    if (!data) return;
    if (tick >= data.world.tick) { setPast(null); return; }
    setTravelling(true);
    try {
      const res = await fetch(`/api/state?t=${tick}`).then((r) => r.json());
      if (res.world) { setPast(res.world); setTile(null); }
    } catch {}
    setTravelling(false);
  }, [data]);

  const world = past ?? data?.world ?? null;

  const hoverInfo = useMemo(() => {
    if (!world || hover === null) return null;
    const owner = world.owner[hover] ? world.civs.find((c) => c.id === world.owner[hover]) : undefined;
    let top: { name: string; n: number } | null = null;
    for (const s of world.species) { const n = s.pops[hover]; if (s.died === undefined && n && (!top || n > top.n)) top = { name: s.name, n }; }
    const ruin = world.ruins.find((r) => r.tile === hover);
    return [
      BIOME_NAME[world.biome[hover]], `${Math.round(tileTemp(world, hover, currentClimate(world)))}°`,
      owner ? owner.name : ruin ? `ruins of ${ruin.name}` : "unclaimed", top ? `mostly ${top.name} (${num(top.n)})` : "lifeless",
    ].join(" · ");
  }, [world, hover]);

  if (error && !data) return <Shell><p className="mx-auto max-w-md py-24 text-center font-serif text-xl text-dim">{error}</p></Shell>;
  if (!data || !world) return <Shell><p className="py-24 text-center font-mono text-sm uppercase tracking-widest text-dim">Finding the world…</p></Shell>;

  const live = data.world;
  const nextTick = Date.parse(live.epoch) + (live.tick - live.dawn + 1) * HOUR;
  const climate = currentClimate(world);
  const livingSpecies = world.species.filter((s) => s.died === undefined).length;
  const nations = world.civs.filter((c) => c.fell === undefined).length;
  const locate = (t: number) => { setTile(t); if (typeof window !== "undefined") document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line pb-4">
        <div>
          <p className="label">freecontrol · a world that runs without you</p>
          <h1 className="font-serif text-5xl font-semibold leading-none tracking-tight sm:text-6xl">{world.name}</h1>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs">
          <Stat k={past ? "Viewing" : "Now"} v={yearLabel(world.year)} gold={!!past} />
          <Stat k="Climate" v={`${climate > 0 ? "+" : ""}${climate.toFixed(1)}° ${climate < -6 ? "ice age" : climate > 6 ? "warm age" : "mild"}`} />
          <Stat k="Species" v={String(livingSpecies)} />
          <Stat k="Nations" v={String(nations)} />
          <Stat k="Next century" v={untilLabel(nextTick - now)} />
        </dl>
      </header>

      {past && (
        <p role="status" className="mt-4 rounded-sm border border-gold bg-raised px-4 py-2 text-sm text-gold">
          You are looking at the past: {yearLabel(past.year)}. This is the real saved state from that moment.
          <button onClick={() => setPast(null)} className="ml-3 underline underline-offset-4">Back to now</button>
        </p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section id="map" className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Map layer" className="flex gap-1">
              {(["nations", "life", "terrain"] as Layer[]).map((l) => (
                <button key={l} onClick={() => setLayer(l)} aria-pressed={layer === l}
                  className={`rounded-sm border px-3 py-1 font-mono text-xs uppercase tracking-widest ${layer === l ? "border-gold text-gold" : "border-line text-dim hover:text-text"}`}>{l}</button>
              ))}
            </div>
            {species !== null && layer === "life" && (
              <button onClick={() => setSpecies(null)} className="font-mono text-xs text-dim underline underline-offset-4">Show all species</button>
            )}
          </div>
          <div className="rounded-sm border border-line bg-panel p-1.5">
            <WorldMap world={world} layer={layer} focusSpecies={species} selected={tile} blast={tab === "move" && power === "meteor"} onPick={setTile} onHover={setHover} />
          </div>
          <p className="mt-2 min-h-5 font-mono text-xs text-dim" aria-live="off">{hoverInfo ?? "Hover the map to inspect a tile. East and west wrap around."}</p>
          <div className="mt-4 rounded-sm border border-line bg-panel p-4">
            <Timeline history={history} nowTick={live.tick} viewTick={world.tick} busy={travelling} onTravel={travel} />
          </div>
        </section>

        <section className="min-w-0">
          <div role="tablist" aria-label="Sections" className="mb-3 flex gap-1 border-b border-line">
            {TABS.map(([id, name]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-widest ${tab === id ? "border-gold text-gold" : "border-transparent text-dim hover:text-text"}`}>
                {name}{id === "move" && data.move.ready ? " ●" : ""}
              </button>
            ))}
          </div>
          <div className="fade-in" key={tab}>
            {tab === "paper" && <Paper world={live} chronicle={data.chronicle} since={since} onLocate={locate} />}
            {tab === "nations" && <Nations world={world} picked={civ} onPick={(id, capital) => { setCiv(id); setLayer("nations"); setTile(capital); }} />}
            {tab === "life" && <SpeciesList world={world} picked={species} onPick={(id) => { setSpecies(id); setLayer("life"); }} />}
            {tab === "move" && (
              <MovePanel world={live} now={now} status={data.move} power={power} onPower={setPower} tile={past ? null : tile} species={species} civ={civ}
                onCast={(move) => setData({ ...data, move })} />
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-line pt-4 font-mono text-xs leading-6 text-dim">
        Every hour a robot advances {live.name} by one century and commits the result to git. Nobody plays it. Seed {live.seed}, tick {live.tick}.{" "}
        <a className="underline underline-offset-4 hover:text-text" href="https://github.com/cburdick28-spec/freecontrol/commits/world">Read the history as commits</a>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>;
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className={`mt-0.5 text-sm ${gold ? "text-gold" : "text-text"}`}>{v}</dd>
    </div>
  );
}
