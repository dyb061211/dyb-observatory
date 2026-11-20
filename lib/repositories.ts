import { eq, lte } from "drizzle-orm";
import { getDb } from "../db";
import { githubPages } from "../db/schema";
import { emptyPage, refreshPage } from "../public/assets/github-api.js";

export type RepositoryPage = typeof githubPages.$inferSelect;

export function repositoryPageNumber(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

async function savedPage(page: number) {
  return getDb().select().from(githubPages).where(eq(githubPages.page, page)).get();
}

export async function getRepositoryPage(page: number): Promise<RepositoryPage> {
  const started = Date.now();
  const saved = await savedPage(page).catch(() => undefined);
  if (saved && saved.nextCheckAt > started) return saved;
  const previous = saved ?? emptyPage(page);
  const result = await refreshPage(previous, started, "worker");
  try {
    // Concurrent readers can refresh together. A failure never replaces a newer success.
    const rows = await getDb().insert(githubPages).values(result).onConflictDoUpdate({
      target: githubPages.page,
      set: result.stale ? { stale: true, nextCheckAt: result.nextCheckAt } : result,
      setWhere: result.stale ? lte(githubPages.nextCheckAt, started) : lte(githubPages.syncedAt, started)
    }).returning();
    if (rows.length) return rows[0];
    return await savedPage(page) ?? result;
  } catch {
    return result;
  }
}
