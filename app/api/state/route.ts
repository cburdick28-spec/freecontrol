import type { NextRequest } from "next/server";
import { readJson, stateCommits, yearOfMessage } from "@/lib/github";
import type { World } from "@/sim";

// Time travel: load the world exactly as it was at a past tick, straight out of git history.
export async function GET(req: NextRequest) {
  const t = Number(req.nextUrl.searchParams.get("t"));
  if (!Number.isInteger(t) || t < 0) return Response.json({ error: "Bad tick." }, { status: 400 });
  try {
    const now = await readJson<World>("state.json");
    if (!now) return Response.json({ error: "No world yet." }, { status: 404 });
    if (t > now.tick || t < now.dawn) return Response.json({ error: "That moment was never recorded." }, { status: 404 });
    const wantYear = (t - now.dawn) * 100;
    // One commit per tick, newest first, so the commit for tick t is (now.tick - t) places back.
    const back = now.tick - t;
    let sha: string | undefined;
    for (const page of [Math.floor(back / 100) + 1, Math.floor(back / 100) + 2, Math.floor(back / 100)]) {
      if (page < 1) continue;
      const commits = await stateCommits(page);
      sha = commits.find((c) => yearOfMessage(c.message) === wantYear)?.sha;
      if (sha || !commits.length) break;
    }
    if (!sha) return Response.json({ error: "That moment was never recorded." }, { status: 404 });
    const world = await readJson<World>("state.json", sha);
    return Response.json({ world, sha }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load that moment." }, { status: 502 });
  }
}
