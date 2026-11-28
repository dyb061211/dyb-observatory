import { editorId } from "../../lib/entries";
import { profile, projectEditor, projects, shell } from "../../lib/interiors";
import { getRepositoryPage, repositoryPageNumber } from "../../lib/repositories";
import { repositorySection } from "../../public/assets/github-catalog.js";
import initialRepositoryPage from "../../lib/initial-repository-page.json";
import { checkFeaturedProject, deleteFeaturedProject, findFeaturedProject, getSiteCopyMap, listAllSyncedRepos, listFeaturedProjects, projectFromForm, saveFeaturedProject, type ProjectInput } from "../../lib/site-content";
import { html, stations } from "../../lib/stations";
import { handleCopyPost, handleWritingGet, handleWritingPost, missing, redirect, verifyOwnerPost } from "../../lib/writing-route";

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
    const [author, copy, featured] = await Promise.all([editorId(), getSiteCopyMap(), listFeaturedProjects()]);
    const canEdit = Boolean(author);
    const editParam = query.get("edit");
    if (editParam) {
      if (!canEdit) return missing(s);
      const repos = await listAllSyncedRepos();
      if (editParam === "new") {
        const preRepoName = query.get("repo") || "";
        const matched = repos.find(r => r.name === preRepoName) ?? (preRepoName ? undefined : repos[0]);
        const initial: ProjectInput = {
          id: crypto.randomUUID(),
          repoId: matched?.id ?? null,
          repoName: preRepoName || matched?.name || "",
          name: matched?.name || preRepoName || "",
          tech: matched?.language || "",
          detail: matched?.description || "",
          demoUrl: "",
          demoLabel: "",
          sortOrder: (featured.length + 1) * 10
        };
        return html(projectEditor(s, initial, repos, { isNew: true, footerNote: copy.footer_note }));
      }
      const existing = await findFeaturedProject(editParam);
      if (!existing) return missing(s);
      return html(projectEditor(s, existing, repos, { isNew: false, footerNote: copy.footer_note }));
    }
    const result = await getRepositoryPage(repositoryPageNumber(query.get("page")));
    const snapshot = result.page === 1 && !result.syncedAt ? { ...result, ...initialRepositoryPage } : result;
    const list = repositorySection(snapshot, {
      featuredRepos: featured.map(p => p.repoName),
      canEdit
    });
    return html(query.get("view") === "repositories"
      ? list
      : shell(s, projects(list, featured, copy.projects_intro, canEdit), { footerNote: copy.footer_note }));
  }
  if (s.slug === "profile") {
    const [author, copy] = await Promise.all([editorId(), getSiteCopyMap()]);
    return html(shell(s, profile(copy.about_intro, copy.footer_note, Boolean(author)), { footerNote: copy.footer_note }));
  }
  return handleWritingGet(request, s);
}

export async function POST(request: Request, context: Context) {
  const { station } = await context.params;
  const s = stations.find(t => t.slug === station);
  if (!s) return missing();
  if (s.slug === "blog" || s.slug === "life") return handleWritingPost(request, s);

  const verified = await verifyOwnerPost(request);
  if ("error" in verified) return verified.error;
  const { form } = verified;
  const intent = String(form.get("intent") ?? "");

  if (s.slug === "projects") {
    if (intent === "save-copy") return handleCopyPost(form, "/projects");
    if (intent === "save-project") {
      const input = projectFromForm(form);
      const err = checkFeaturedProject(input);
      if (err) {
        const [repos, existing, copy] = await Promise.all([
          listAllSyncedRepos(),
          findFeaturedProject(input.id),
          getSiteCopyMap()
        ]);
        return html(projectEditor(s, input, repos, { isNew: !existing, error: err, footerNote: copy.footer_note }), 422);
      }
      await saveFeaturedProject(input);
      return redirect("/projects");
    }
    if (intent === "delete-project") {
      await deleteFeaturedProject(String(form.get("id") ?? ""));
      return redirect("/projects");
    }
    return new Response("未知操作。", { status: 400 });
  }

  if (s.slug === "profile") {
    if (intent === "save-copy") return handleCopyPost(form, "/profile");
    return new Response("未知操作。", { status: 400 });
  }

  return missing();
}
