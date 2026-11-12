import { readJson } from "@/lib/github";

export async function GET() {
  try {
    const history = await readJson<unknown[]>("history.json");
    return Response.json({ history: history ?? [] }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load history." }, { status: 502 });
  }
}
