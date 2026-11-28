import { checkDraft, deleteEntry, discardDraft, draftFrom, editorId, findAuthorEntry, findPublishedEntry, listEntries, newDraft, saveEntry, uuid } from "./entries";
import { shell } from "./interiors";
import { getSiteCopyMap, isSiteCopyKey, listFeaturedProjects, saveSiteCopy } from "./site-content";
import { editor, reader, writingIndex } from "./writing-view";
import { html, stations, type Station, type WritingStation } from "./stations";

export function stationPath(slug: WritingStation) {
  return slug === "blog" ? "/" : `/${slug}`;
}

export function redirect(location: string) {
  return new Response(null, { status: 303, headers: { location, "cache-control": "private, no-store" } });
}

export function safeReturnTo(raw: FormDataEntryValue | null, fallback: string) {
  const value = String(raw ?? "").trim();
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function missing(s?: Station) {
  const isLife = s?.slug === "life";
  const backHref = isLife ? "/life" : "/";
  const backLabel = isLife ? s.title : "首页";
  const copy = await getSiteCopyMap();
  return html(
    shell(
      s ?? stations[0],
      `<div class="manuscript"><h1>找不到这个页面</h1><p class="empty-line">这里没有对应的文章或页面。</p><p class="blog-back"><a href="${backHref}">← 返回${backLabel}</a></p></div>`,
      { title: "找不到这个页面", footerNote: copy.footer_note }
    ),
    404
  );
}

export async function verifyOwnerPost(request: Request): Promise<{ author: string; form: FormData } | { error: Response }> {
  const author = await editorId();
  if (!author) return { error: new Response("需要站主身份。", { status: 403 }) };
  if (request.headers.get("origin") !== new URL(request.url).origin) return { error: new Response("无法验证表单来源。", { status: 403 }) };
  if (Number(request.headers.get("content-length")) > 1600000) return { error: new Response("正文超过长度限制。", { status: 413 }) };
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/x-www-form-urlencoded")) return { error: new Response("表单格式无效。", { status: 415 }) };
  return { author, form: await request.formData() };
}

export async function handleCopyPost(form: FormData, fallbackPath: string) {
  for (const [field, value] of form.entries()) {
    if (!field.startsWith("copy:")) continue;
    const key = field.slice(5);
    if (!isSiteCopyKey(key)) return new Response("无效的文案字段。", { status: 400 });
    const err = await saveSiteCopy(key, String(value));
    if (err) return new Response(err, { status: 422 });
  }
  return redirect(safeReturnTo(form.get("return_to"), fallbackPath));
}

export async function handleWritingGet(request: Request, s: Station) {
  const slug: WritingStation = s.slug === "life" ? "life" : "blog";
  const query = new URL(request.url).searchParams;
  const [author, copy, featured] = await Promise.all([
    editorId(),
    getSiteCopyMap(),
    slug === "blog" ? listFeaturedProjects() : Promise.resolve([])
  ]);
  const edit = query.get("edit");
  const read = query.get("read");
  if (edit) {
    if (!author) return missing(s);
    const draft = edit === "new" ? newDraft(slug) : uuid.test(edit) ? await findAuthorEntry(slug, edit) : null;
    if (!draft) return missing(s);
    if (edit === "new" && slug === "life" && query.get("topic") === "经历") draft.topic = "经历";
    return html(editor(s, draft, {
      saved: query.get("saved") === "1" && draft.revision > 0,
      hasDraft: "hasDraft" in draft && !!draft.hasDraft,
      published: "published" in draft && !!draft.published,
      footerNote: copy.footer_note
    }));
  }
  if (read) {
    const row = uuid.test(read) ? await findPublishedEntry(slug, read) : null;
    if (!row || row.published === null) return missing(s);
    return html(reader(s, { id: row.id, title: row.title!, body: row.body!, topic: row.topic!, date: row.published }, Boolean(author), copy.footer_note));
  }
  const drafts = query.get("list") === "drafts";
  if (drafts && !author) return missing(s);
  const page = Math.min(100000, Math.max(0, Math.floor(Number(query.get("page")) || 0)));
  const records = await listEntries(slug, drafts ? author : null, page);
  return html(writingIndex(s, records, author, drafts, page, copy, featured));
}

export async function handleWritingPost(request: Request, s: Station) {
  const slug: WritingStation = s.slug === "life" ? "life" : "blog";
  const verified = await verifyOwnerPost(request);
  if ("error" in verified) return verified.error;
  const { author, form } = verified;
  const intent = String(form.get("intent") ?? "");
  const base = stationPath(slug);

  if (intent === "save-copy") return handleCopyPost(form, base);

  const d = draftFrom(form);
  if (intent === "delete") {
    if (!uuid.test(d.id)) return new Response("文章编号无效。", { status: 400 });
    await deleteEntry(slug, d.id);
    const location = safeReturnTo(form.get("return_to"), base);
    return request.headers.get("x-station-editor") === "1"
      ? Response.json({ location }, { headers: { "cache-control": "private, no-store" } })
      : redirect(location);
  }

  if (!["draft", "publish", "preview", "continue", "discard"].includes(intent)) return new Response("未知操作。", { status: 400 });
  const copy = await getSiteCopyMap();
  const current = d.revision && uuid.test(d.id) ? await findAuthorEntry(slug, d.id) : null;
  const options = { hasDraft: !!current?.hasDraft, published: !!current?.published, footerNote: copy.footer_note };
  if (intent === "preview" || intent === "continue") return html(editor(s, d, { ...options, preview: intent === "preview" }));
  const err = checkDraft(d, intent === "publish", slug);
  if (err && intent !== "discard") return html(editor(s, d, { ...options, error: err }), 422);
  const ok = intent === "discard" ? await discardDraft(slug, d.id, d.revision) : await saveEntry(slug, author, d, intent === "publish");
  if (!ok) return html(editor(s, d, { ...options, error: "另一个页面已经改过这条记录。你刚输入的内容还在下方，可以复制后从草稿箱重新打开最新版本。" }), 409);
  const location = base + (intent === "discard" ? "?list=drafts#entries" : intent === "publish" ? "?read=" + d.id : "?edit=" + d.id + "&saved=1");
  return request.headers.get("x-station-editor") === "1"
    ? Response.json({ location }, { headers: { "cache-control": "private, no-store" } })
    : redirect(location);
}
