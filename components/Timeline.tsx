"use client";
import { useState } from "react";
import { yearLabel } from "@/sim";
import { compact } from "@/lib/format";

export interface HistoryRow { t: number; y: number; sp: number; cv: number; pop: number; c: number; h: string }

interface Props { history: HistoryRow[]; nowTick: number; viewTick: number; busy: boolean; onTravel: (tick: number) => void }

function path(values: number[], w: number, h: number): string {
  const max = Math.max(1, ...values);
  return values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join("");
}

export default function Timeline({ history, nowTick, viewTick, busy, onTravel }: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  if (history.length < 2) return <p className="text-sm text-dim">History starts filling in after the first few ticks.</p>;
  const first = history[0].t, shown = drag ?? viewTick;
  const row = history.find((r) => r.t === shown) ?? history[history.length - 1];
  const commit = () => { if (drag !== null) { onTravel(drag); setDrag(null); } };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">Time machine</span>
        <span className="font-mono text-xs text-dim">people <span className="text-gold">━</span> · species <span className="text-[#6fb3a8]">━</span></span>
      </div>
      <svg viewBox="0 0 600 44" preserveAspectRatio="none" className="mt-2 h-11 w-full" aria-hidden>
        <path d={path(history.map((r) => r.sp), 600, 44)} fill="none" stroke="#6fb3a8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity="0.8" />
        <path d={path(history.map((r) => r.pop), 600, 44)} fill="none" stroke="#e3b45c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <input
        type="range" min={first} max={nowTick} step={1} value={shown} aria-label="Travel through history"
        className="w-full" disabled={busy}
        onChange={(e) => setDrag(Number(e.target.value))}
        onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} onBlur={commit}
      />
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="min-w-0">
          <span className="font-serif text-base text-text">{yearLabel(row.y)}</span>
          <span className="ml-2 text-dim">{row.h}</span>
        </p>
        <p className="font-mono text-xs text-dim">
          {row.cv} nations · {compact(row.pop)} people · {row.sp} species
          {viewTick !== nowTick && drag === null && (
            <button onClick={() => onTravel(nowTick)} className="ml-3 rounded-sm border border-gold px-2 py-0.5 text-gold hover:bg-gold hover:text-ink">Back to now</button>
          )}
        </p>
      </div>
    </div>
  );
}
