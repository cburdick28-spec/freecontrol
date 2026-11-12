"use client";
import { useEffect, useMemo, useRef } from "react";
import { BIOME_COLOR, SEA_LEVEL, dist, type World } from "@/sim";

export type Layer = "terrain" | "life" | "nations";
const CELL = 16;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

interface Props {
  world: World;
  layer: Layer;
  focusSpecies: number | null;
  selected: number | null;
  blast: boolean; // show the meteor radius around the selected tile
  onPick: (tile: number) => void;
  onHover: (tile: number | null) => void;
}

export default function WorldMap({ world, layer, focusSpecies, selected, blast, onPick, onHover }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = world.w, H = world.h;

  // dominant species per tile, for the life layer and hover info
  const dominant = useMemo(() => {
    const best = new Float64Array(W * H), who = new Int32Array(W * H).fill(-1);
    world.species.forEach((s, idx) => {
      if (s.died !== undefined) return;
      for (const k in s.pops) { const t = +k; if (s.pops[k] > best[t]) { best[t] = s.pops[k]; who[t] = idx; } }
    });
    return { best, who };
  }, [world, W, H]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * CELL * dpr; cv.height = H * CELL * dpr;
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let t = 0; t < W * H; t++) {
      const x = (t % W) * CELL, y = Math.floor(t / W) * CELL, e = world.elev[t];
      const amt = e < SEA_LEVEL ? (e - SEA_LEVEL) / 400 : (e - 78) / 260;
      g.fillStyle = shade(BIOME_COLOR[world.biome[t]], amt);
      g.fillRect(x, y, CELL, CELL);
    }

    if (layer === "life") {
      const focus = focusSpecies !== null ? world.species.find((s) => s.id === focusSpecies) : undefined;
      if (focus) {
        const max = Math.max(1, ...Object.values(focus.pops));
        for (const k in focus.pops) {
          const t = +k;
          g.fillStyle = `hsla(${focus.hue},85%,60%,${0.25 + 0.65 * Math.sqrt(focus.pops[k] / max)})`;
          g.fillRect((t % W) * CELL, Math.floor(t / W) * CELL, CELL, CELL);
        }
      } else {
        for (let t = 0; t < W * H; t++) {
          const i = dominant.who[t];
          if (i < 0) continue;
          g.fillStyle = `hsla(${world.species[i].hue},70%,58%,${Math.min(0.8, 0.2 + Math.log10(1 + dominant.best[t]) / 6)})`;
          g.fillRect((t % W) * CELL + 2, Math.floor(t / W) * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }

    if (layer === "nations") {
      const hue = new Map(world.civs.map((c) => [c.id, c.hue]));
      for (let t = 0; t < W * H; t++) {
        const o = world.owner[t];
        if (!o) continue;
        const x = (t % W) * CELL, y = Math.floor(t / W) * CELL, h = hue.get(o) ?? 0;
        g.fillStyle = `hsla(${h},68%,52%,0.58)`;
        g.fillRect(x, y, CELL, CELL);
        g.fillStyle = `hsl(${h},80%,22%)`;
        const tx = t % W, ty = Math.floor(t / W);
        if (world.owner[ty * W + ((tx + 1) % W)] !== o) g.fillRect(x + CELL - 2, y, 2, CELL);
        if (world.owner[ty * W + ((tx - 1 + W) % W)] !== o) g.fillRect(x, y, 2, CELL);
        if (ty === 0 || world.owner[t - W] !== o) g.fillRect(x, y, CELL, 2);
        if (ty === H - 1 || world.owner[t + W] !== o) g.fillRect(x, y + CELL - 2, CELL, 2);
      }
      g.strokeStyle = "rgba(240,230,205,0.55)"; g.lineWidth = 1.5;
      for (const r of world.ruins) {
        if (world.owner[r.tile]) continue;
        const x = (r.tile % W) * CELL, y = Math.floor(r.tile / W) * CELL;
        g.beginPath(); g.moveTo(x + 5, y + 5); g.lineTo(x + 11, y + 11); g.moveTo(x + 11, y + 5); g.lineTo(x + 5, y + 11); g.stroke();
      }
      for (const c of world.civs) {
        if (c.fell !== undefined) continue;
        const x = (c.capital % W) * CELL, y = Math.floor(c.capital / W) * CELL;
        g.fillStyle = "#0b0f17"; g.fillRect(x + 4, y + 4, 8, 8);
        g.fillStyle = "#fff6dd"; g.fillRect(x + 6, y + 6, 4, 4);
      }
    }

    if (selected !== null) {
      if (blast) {
        for (let t = 0; t < W * H; t++) {
          const d = dist(world, t, selected);
          if (d > 3) continue;
          g.fillStyle = d <= 1 ? "rgba(255,120,70,0.75)" : "rgba(224,80,50,0.5)";
          g.fillRect((t % W) * CELL, Math.floor(t / W) * CELL, CELL, CELL);
        }
      }
      g.strokeStyle = "#e3b45c"; g.lineWidth = 2;
      g.strokeRect((selected % W) * CELL + 1, Math.floor(selected / W) * CELL + 1, CELL - 2, CELL - 2);
    }
  }, [world, layer, focusSpecies, selected, blast, dominant, W, H]);

  const tileAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W), y = Math.floor(((e.clientY - r.top) / r.height) * H);
    return x >= 0 && x < W && y >= 0 && y < H ? y * W + x : null;
  };

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Map of ${world.name}`}
      className="block w-full cursor-crosshair rounded-sm"
      style={{ aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }}
      onMouseMove={(e) => onHover(tileAt(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => { const t = tileAt(e); if (t !== null) onPick(t); }}
    />
  );
}
