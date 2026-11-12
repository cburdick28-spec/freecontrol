import { timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { fileSha, hasToken, readJson, writeFile } from "@/lib/github";
import { moveStatus, POWERS, type Power } from "@/lib/move";
import type { Move, World } from "@/sim";

const digest = (s: string) => createHash("sha256").update(s).digest();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cast today's move. It is saved to the world branch and lands on the next tick.
export async function POST(req: Request) {
  const secret = process.env.MOVE_PASSWORD;
  if (!secret || !hasToken())
    return Response.json({ error: "Moves are not set up. Add GITHUB_TOKEN and MOVE_PASSWORD in Vercel, then redeploy." }, { status: 503 });

  let body: { password?: unknown; type?: unknown; tile?: unknown; species?: unknown; civ?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }

  if (typeof body.password !== "string" || !timingSafeEqual(digest(body.password), digest(secret))) {
    await sleep(600);
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  if (typeof body.type !== "string" || !(body.type in POWERS)) return Response.json({ error: "Unknown power." }, { status: 400 });
  const type = body.type as Power;

  try {
    const [world, last] = await Promise.all([readJson<World>("state.json"), readJson<Move>("move.json")]);
    if (!world) return Response.json({ error: "No world yet." }, { status: 404 });
    const status = moveStatus(last);
    if (!status.ready) return Response.json({ error: "You already moved today.", move: status }, { status: 429 });

    const move: Move = { id: randomUUID(), type, at: new Date().toISOString() };
    const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
    if (type === "meteor") {
      if (!Number.isInteger(body.tile) || (body.tile as number) < 0 || (body.tile as number) >= world.w * world.h)
        return Response.json({ error: "Pick a spot on the map for the meteor." }, { status: 400 });
      move.tile = body.tile as number;
    } else if (type === "plague" && isId(body.civ)) {
      if (!world.civs.some((c) => c.id === body.civ && c.fell === undefined)) return Response.json({ error: "That nation is gone." }, { status: 400 });
      move.civ = body.civ;
    } else if (type !== "iceage") {
      if (!isId(body.species) || !world.species.some((s) => s.id === body.species && s.died === undefined))
        return Response.json({ error: "Pick a living species." }, { status: 400 });
      move.species = body.species;
    }

    await writeFile("move.json", JSON.stringify(move) + "\n", `A hand reaches down: ${POWERS[type].name}`, await fileSha("move.json"));
    return Response.json({ ok: true, move: moveStatus(move) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "The move could not be saved." }, { status: 502 });
  }
}
