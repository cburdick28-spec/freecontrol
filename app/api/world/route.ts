import { readJson } from "@/lib/github";
import { moveStatus } from "@/lib/move";
import type { Move, World, WorldEvent } from "@/sim";

export async function GET() {
  try {
    const [world, chronicle, move] = await Promise.all([
      readJson<World>("state.json"), readJson<WorldEvent[]>("chronicle.json"), readJson<Move>("move.json"),
    ]);
    if (!world) return Response.json({ error: "The world has not been created yet." }, { status: 404 });
    return Response.json({ world, chronicle: chronicle ?? [], move: moveStatus(move) }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not reach the world." }, { status: 502 });
  }
}
