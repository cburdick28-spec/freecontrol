"use client";
import { useState } from "react";
import { POWERS, type MoveStatus, type Power } from "@/lib/move";
import { untilLabel } from "@/lib/format";
import type { World } from "@/sim";

interface Props {
  world: World;
  status: MoveStatus;
  now: number;
  power: Power;
  onPower: (p: Power) => void;
  tile: number | null;
  species: number | null;
  civ: number | null;
  onCast: (status: MoveStatus) => void;
}

export default function MovePanel({ world, status, now, power, onPower, tile, species, civ, onCast }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const needs = POWERS[power].needs;
  const sp = species !== null ? world.species.find((s) => s.id === species && s.died === undefined) : undefined;
  const cv = civ !== null ? world.civs.find((c) => c.id === civ && c.fell === undefined) : undefined;

  let target = "", ready = true;
  if (needs === "tile") { ready = tile !== null; target = ready ? `Aimed at tile ${tile! % world.w}, ${Math.floor(tile! / world.w)}. The red area is the blast.` : "Click the map to aim."; }
  else if (needs === "species") { ready = !!sp; target = sp ? `Target: the ${sp.name}.` : "Pick a living species in the Life tab."; }
  else if (needs === "target") { ready = !!(cv || sp); target = cv ? `Target: ${cv.name}.` : sp ? `Target: the ${sp.name}.` : "Pick a nation in the Nations tab, or a species in the Life tab."; }
  else target = "No target needed. The whole world feels it.";

  async function cast() {
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/move", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, type: power, tile, ...(needs === "target" && cv ? { civ: cv.id } : { species: sp?.id }) }),
      });
      const data = await res.json();
      if (data.move) onCast(data.move);
      setNote(res.ok ? { ok: true, text: "Done. Your move lands on the next tick and goes into the history books." } : { ok: false, text: data.error ?? "That did not work." });
      if (res.ok) setPassword("");
    } catch { setNote({ ok: false, text: "Could not reach the server. Try again." }); }
    setBusy(false);
  }

  const wait = status.nextAt ? Date.parse(status.nextAt) - now : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-line bg-panel p-3">
        <p className="label">Your one move</p>
        {status.ready ? (
          <p className="mt-1 font-serif text-xl text-gold">Ready. Choose carefully, you get one a day.</p>
        ) : (
          <p className="mt-1 font-serif text-xl">Spent. Next move in {untilLabel(wait)}.</p>
        )}
        {status.last && <p className="mt-1 text-xs text-dim">Last move: {POWERS[status.last.type].name}, {new Date(status.last.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>}
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {(Object.keys(POWERS) as Power[]).map((p) => (
          <button key={p} onClick={() => onPower(p)} aria-pressed={power === p}
            className={`rounded-sm border px-3 py-2 text-left transition-colors ${power === p ? "border-gold bg-raised" : "border-line bg-panel hover:border-dim"}`}>
            <span className="font-serif text-base">{POWERS[p].name}</span>
            <span className="mt-0.5 block text-xs leading-5 text-dim">{POWERS[p].blurb}</span>
          </button>
        ))}
      </div>

      <p className={`text-sm ${ready ? "text-text" : "text-ember"}`}>{target}</p>

      <form onSubmit={(e) => { e.preventDefault(); if (!busy) cast(); }} className="flex gap-2">
        <label className="sr-only" htmlFor="move-password">Move password</label>
        <input id="move-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Move password" autoComplete="current-password"
          className="min-w-0 flex-1 rounded-sm border border-line bg-ink px-3 py-2 text-sm placeholder:text-dim" />
        <button type="submit" disabled={busy || !ready || !status.ready || !password}
          className="rounded-sm bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Casting" : `Cast ${POWERS[power].name}`}
        </button>
      </form>
      {note && <p role="status" className={`text-sm ${note.ok ? "text-[#6fb3a8]" : "text-ember"}`}>{note.text}</p>}
    </div>
  );
}
