import { checkDraft, discardDraft, draftFrom, editorId, findAuthorEntry, findPublishedEntry, listEntries, newDraft, saveEntry, uuid } from "./entries";
import { shell } from "./interiors";
import { editor, reader, writingIndex } from "./writing-view";
import { html, stations, type Station, type WritingStation } from "./stations";

export function stationPath(slug: WritingStation) {
  return slug === "blog" ? "/" : `/${slug}`;
}

export function redirect(location: string) {
  return new Response(null, { status: 303, headers: { location, "cache-control": "private, no-store" } });
}

export function missing(s?: Station) {
  const isLife = s?.slug === "life";
  const backHref = isLife ? "/life" : "/";
  const backLabel = isLife ? s.title : "首页";
  return html(
    shell(
      s ?? stations[0],
      `<div class="manuscript"><h1>找不到这个页面</h1><p class="empty-line">这里没有对应的文章或页面。</p><p class="blog-back"><a href="${backHref}">← 返回${backLabel}</a></p></div>`,
      { title: "找不到这个页面" }
    ),
    404
  );
}

export async function handleWritingGet(request: Request, s: Station) {
  const slug: WritingStation = s.slug === "life" ? "life" : "blog";
  const query = new URL(request.url).searchParams;
  const author = await editorId();
  const edit = query.get("edit");
  const read = query.get("read");
  if (edit) {
    if (!author) return missing(s);
    const draft = edit === "new" ? newDraft(slug) : uuid.test(edit) ? await findAuthorEntry(slug, edit, author) : null;
    if (!draft) return missing(s);
    if (edit === "new" && slug === "life" && query.get("topic") === "经历") draft.topic = "经历";
    return html(editor(s, draft, {
      saved: query.get("saved") === "1" && draft.revision > 0,
      hasDraft: "hasDraft" in draft && !!draft.hasDraft,
      published: "published" in draft && !!draft.published
    }));
  }
  if (read) {
    const row = uuid.test(read) ? await findPublishedEntry(slug, read) : null;
    if (!row || row.published === null) return missing(s);
    return html(reader(s, { id: row.id, title: row.title!, body: row.body!, topic: row.topic!, date: row.published }, author === row.author));
  }
  const drafts = query.get("list") === "drafts";
  if (drafts && !author) return missing(s);
  const page = Math.min(100000, Math.max(0, Math.floor(Number(query.get("page")) || 0)));
  const records = await listEntries(slug, drafts ? author : null, page);
  return html(writingIndex(s, records, author, drafts, page));
}

export async function handleWritingPost(request: Request, s: Station) {
  const slug: WritingStation = s.slug === "life" ? "life" : "blog";
  const author = await editorId();
  if (!author) return new Response("需要站主身份。", { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("无法验证表单来源。", { status: 403 });
  if (Number(request.headers.get("content-length")) > 1600000) return new Response("正文超过长度限制。", { status: 413 });
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/x-www-form-urlencoded")) return new Response("表单格式无效。", { status: 415 });
  const form = await request.formData();
  const d = draftFrom(form);
  const intent = form.get("intent");
  if (!["draft", "publish", "preview", "continue", "discard"].includes(String(intent))) return new Response("未知操作。", { status: 400 });
  const current = d.revision && uuid.test(d.id) ? await findAuthorEntry(slug, d.id, author) : null;
  const options = { hasDraft: !!current?.hasDraft, published: !!current?.published };
  if (intent === "preview" || intent === "continue") return html(editor(s, d, { ...options, preview: intent === "preview" }));
  const err = checkDraft(d, intent === "publish", slug);
  if (err && intent !== "discard") return html(editor(s, d, { ...options, error: err }), 422);
  const ok = intent === "discard" ? await discardDraft(slug, author, d.id, d.revision) : await saveEntry(slug, author, d, intent === "publish");
  if (!ok) return html(editor(s, d, { ...options, error: "另一个页面已经改过这条记录。你刚输入的内容还在下方，可以复制后从草稿箱重新打开最新版本。" }), 409);
  const base = stationPath(slug);
  const location = base + (intent === "discard" ? "?list=drafts#entries" : intent === "publish" ? "?read=" + d.id : "?edit=" + d.id + "&saved=1");
  return request.headers.get("x-station-editor") === "1"
    ? Response.json({ location }, { headers: { "cache-control": "private, no-store" } })
    : redirect(location);
}
