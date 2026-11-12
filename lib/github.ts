// Server-only helpers for reading and writing the world's save files on the `world` branch.
const REPO = process.env.WORLD_REPO ?? "cburdick28-spec/freecontrol";
export const BRANCH = process.env.WORLD_BRANCH ?? "world";
const API = `https://api.github.com/repos/${REPO}`;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    "User-Agent": "freecontrol",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export const hasToken = () => Boolean(process.env.GITHUB_TOKEN);

/** Raw text of a file at a branch or commit, or null if it does not exist. */
export async function readFile(path: string, ref: string = BRANCH): Promise<string | null> {
  // Local dev: point WORLD_LOCAL_DIR at a folder made by `npm run tick -- --dir <folder> --no-git`.
  const local = process.env.WORLD_LOCAL_DIR;
  if (local) {
    const { readFile: fsRead } = await import("node:fs/promises");
    return fsRead(`${local}/${path}`, "utf8").catch(() => null);
  }
  const url = `${API}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  let res = await fetch(url, { headers: headers({ Accept: "application/vnd.github.raw+json" }), cache: "no-store" });
  // A bad or expired token should not take the whole site down. The repo is public, so reading still works without it.
  if ((res.status === 401 || res.status === 403) && hasToken())
    res = await fetch(url, { headers: { "User-Agent": "freecontrol", Accept: "application/vnd.github.raw+json" }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
  return res.text();
}

export async function readJson<T>(path: string, ref?: string): Promise<T | null> {
  const text = await readFile(path, ref);
  return text === null ? null : (JSON.parse(text) as T);
}

/** Blob sha of a file on the world branch (needed to overwrite it), or null if missing. */
export async function fileSha(path: string): Promise<string | null> {
  const res = await fetch(`${API}/contents/${path}?ref=${BRANCH}`, { headers: headers({ Accept: "application/vnd.github.object+json" }), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
  return ((await res.json()) as { sha: string }).sha;
}

export async function writeFile(path: string, content: string, message: string, sha: string | null): Promise<void> {
  const res = await fetch(`${API}/contents/${path}`, {
    method: "PUT", headers: headers({ Accept: "application/vnd.github+json", "Content-Type": "application/json" }),
    body: JSON.stringify({ message, branch: BRANCH, content: Buffer.from(content).toString("base64"), ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} writing ${path}`);
}

export interface CommitInfo { sha: string; message: string; date: string }

/** Commits that touched state.json, newest first. One per tick, plus genesis. */
export async function stateCommits(page: number): Promise<CommitInfo[]> {
  const res = await fetch(`${API}/commits?sha=${BRANCH}&path=state.json&per_page=100&page=${page}`, {
    headers: headers({ Accept: "application/vnd.github+json" }), cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} listing commits`);
  const rows = (await res.json()) as { sha: string; commit: { message: string; committer: { date: string } } }[];
  return rows.map((r) => ({ sha: r.sha, message: r.commit.message.split("\n")[0], date: r.commit.committer.date }));
}

/** "Year 3,000: something" -> 3000. Genesis is year 0. */
export function yearOfMessage(message: string): number | null {
  const m = /^Year ([\d,]+)/.exec(message);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}
