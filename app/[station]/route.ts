import { profile, projects, shell } from "../../lib/interiors";
import { getRepositoryPage, repositoryPageNumber } from "../../lib/repositories";
import { repositorySection } from "../../public/assets/github-catalog.js";
import initialRepositoryPage from "../../lib/initial-repository-page.json";
import { html, stations } from "../../lib/stations";
import { handleWritingGet, handleWritingPost, missing, redirect } from "../../lib/writing-route";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ station: string }> };

export async function GET(request: Request, context: Context) {
  const { station } = await context.params;
  const url = new URL(request.url);
  if (station === "index.html") return redirect("/");
  if (station === "blog") return redirect(`/${url.search}`);
  if (station === "about") return redirect("/profile");
  const s = stations.find(t => t.slug === station);
  if (!s) return missing();
  const query = url.searchParams;
  if (s.slug === "projects") {
    const result = await getRepositoryPage(repositoryPageNumber(query.get("page")));
    const snapshot = result.page === 1 && !result.syncedAt ? { ...result, ...initialRepositoryPage } : result;
    const list = repositorySection(snapshot);
    return html(query.get("view") === "repositories" ? list : shell(s, projects(list)));
  }
  if (s.slug === "profile") return html(shell(s, profile()));
  return handleWritingGet(request, s);
}

export async function POST(request: Request, context: Context) {
  const { station } = await context.params;
  const s = stations.find(t => t.slug === station);
  if (!s || (s.slug !== "blog" && s.slug !== "life")) return missing();
  return handleWritingPost(request, s);
}
