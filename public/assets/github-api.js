const owner = "dyb061211";
export const githubProfile = `https://github.com/${owner}`;
export const syncMinutes = 5;
const minute = 60_000;

/** @param {number} page */
export function emptyPage(page) {
  return { page, repositories: [], hasNext: false, etag: null, syncedAt: 0, nextCheckAt: 0, stale: true };
}

/** @param {unknown} payload @returns {import("../../db/schema").PublicRepository[]} */
function readRepositories(payload) {
  if (!Array.isArray(payload)) throw new Error("Invalid GitHub repository list");
  return payload.flatMap(repo => {
    if (typeof repo?.private !== "boolean" || typeof repo.owner?.login !== "string")
      throw new Error("Missing repository visibility or owner");
    if (repo.private || repo.owner.login.toLowerCase() !== owner) return [];
    if (!Number.isSafeInteger(repo.id) || typeof repo.name !== "string" || !/^[\w.-]+$/.test(repo.name))
      throw new Error("Invalid repository identity");
    return [{ id: repo.id, name: repo.name, description: typeof repo.description === "string" ? repo.description : "",
      language: typeof repo.language === "string" ? repo.language : "", fork: repo.fork === true }];
  });
}

/** @param {Response} response @param {number} now */
function nextRetry(response, now) {
  const after = Number(response.headers.get("retry-after")) * 1000;
  const reset = response.headers.get("x-ratelimit-remaining") === "0"
    ? Number(response.headers.get("x-ratelimit-reset")) * 1000 - now : 0;
  return now + Math.max(minute, Number.isFinite(after) ? after : 0, Number.isFinite(reset) ? reset : 0);
}

/**
 * @param {import("../../lib/repositories").RepositoryPage} previous
 * @param {number} started
 * @param {"worker"|"browser"} source
 * @returns {Promise<import("../../lib/repositories").RepositoryPage>}
 */
export async function refreshPage(previous, started, source) {
  let retryAt = started + minute;
  try {
    const headers = new Headers({ Accept: "application/vnd.github+json" });
    if (source === "worker") {
      headers.set("User-Agent", "DYB-Observatory");
      headers.set("X-GitHub-Api-Version", "2022-11-28");
      if (previous.etag) headers.set("If-None-Match", previous.etag);
    }
    const url = new URL(`https://api.github.com/users/${owner}/repos`);
    url.search = new URLSearchParams({ type: "owner", sort: "created", direction: "desc",
      per_page: "30", page: String(previous.page) }).toString();
    const response = await fetch(url, { headers, credentials: "omit", referrerPolicy: "no-referrer",
      cache: source === "worker" ? "no-store" : "default", signal: AbortSignal.timeout(6000) });
    const fresh = { ...previous, syncedAt: started, nextCheckAt: started + syncMinutes * minute, stale: false };
    if (response.status === 304 && previous.syncedAt) return fresh;
    if (response.ok) return { ...fresh, repositories: readRepositories(await response.json()),
      hasNext: /rel="next"/.test(response.headers.get("link") || ""), etag: response.headers.get("etag") };
    retryAt = nextRetry(response, started);
  } catch {
    // Keep the verified snapshot on transport errors and incomplete responses.
  }
  return { ...previous, nextCheckAt: retryAt, stale: true };
}
