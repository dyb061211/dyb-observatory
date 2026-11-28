import { escapeHTML as e, type Station } from "./stations";
import { blogEntry, blogFeaturedProjects, blogIntro, existingArticles, shell } from "./interiors";
import { pageSize, type Draft, type listEntries } from "./entries";

const formattedDate = new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" });
const shortDate = (time: number) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(time).map(p => [p.type, p.value]));
  return `${parts.year}.${parts.month}.${parts.day}`;
};

function readingMinutes(source: string) {
  const plain = source.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]+`/g, " ");
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjk / 350 + latin / 220));
}

export function writingIndex(s: Station, list: Awaited<ReturnType<typeof listEntries>>, author: string | null, drafts: boolean, page: number) {
  const life = s.slug === "life";
  const label = life ? "动态" : "文章";
  const base = life ? "/life" : "/";
  const listUrl = base + (drafts ? "?list=drafts" : "?list=published");
  const compose = author ? (life
    ? `<div class="station-actions"><a href="/life?edit=new&amp;topic=近况">写近况</a><a href="/life?edit=new&amp;topic=经历">记一段经历</a></div>`
    : `<div class="station-actions"><a href="/?edit=new">写文章</a></div>`) : import.meta.env.DEV
    ? `<div class="station-actions"><a href="/signin-with-chatgpt?return_to=${base}" target="_top">登录测试作者</a></div>` : "";
  const visible = list.slice(0, pageSize);
  const rows = visible.map(row => {
    const url = `${base}?${drafts ? "edit" : "read"}=${row.id}`;
    const title = row.title || "无标题草稿";
    const topic = e(row.topic || label);
    const revision = drafts && row.wasPublished ? " · 已发表文章的修订" : "";
    const date = `<time datetime="${new Date(row.date!).toISOString()}">${shortDate(row.date!)}</time>`;
    const meta = life ? `${topic} · ${date}${revision}` : `${row.topic ? topic + " · " : ""}${date}${revision}`;
    return blogEntry(url, title, meta);
  }).join("");
  const paging = (page > 0 ? `<a href="${listUrl}&amp;page=${page - 1}#entries">← ${life ? "较新的记录" : "较新的文章"}</a>` : "") +
    (list.length > pageSize ? `<a href="${listUrl}&amp;page=${page + 1}#entries">${life ? "更早的记录" : "更早的文章"} →</a>` : "");
  const extra = !life && !drafts && list.length <= pageSize ? existingArticles() : "";
  const empty = rows || extra ? "" : `<p class="empty-line">${drafts ? "草稿箱是空的。" : life ? "还没有发表生活动态。" : "还没有文章。"}</p>`;
  const tabs = author ? `<div class="index-tabs"><a href="${base}#entries" ${!drafts ? 'aria-current="page"' : ""}>已发表</a><a href="${base}?list=drafts#entries" ${drafts ? 'aria-current="page"' : ""}>草稿箱</a></div>` : "";
  if (!life) {
    const isHero = !drafts && page === 0;
    return shell(s, `<h1 class="sr-only">DYB</h1>
    ${isHero ? `<section class="blog-intro" aria-label="关于这里">${blogIntro()}</section>` : ""}
    <section class="blog-section" id="entries" aria-labelledby="blog-list-title">
      <div class="blog-section-head"><h2 id="blog-list-title">${drafts ? "我的草稿" : "文章"}</h2>${compose}</div>
      ${tabs}
      ${rows || extra ? `<ul class="blog-list">${rows}${extra}</ul>` : empty}
      ${paging ? `<nav class="pagination" aria-label="文章分页">${paging}</nav>` : ""}
    </section>
    ${isHero ? `<section class="blog-section" aria-labelledby="blog-projects-title"><div class="blog-section-head"><h2 id="blog-projects-title">项目</h2><a class="section-more" href="/projects">全部 →</a></div>
      ${blogFeaturedProjects()}</section>` : ""}`, { hero: isHero });
  }
  return shell(s, `<header class="blog-page-head"><h1>近况</h1><p>软件工程在读，最近在学 Java 后端，也在做 Python 和 AI 小工具。</p></header>
    <section class="blog-section" id="entries" aria-labelledby="life-list-title">
      <div class="blog-section-head"><h2 id="life-list-title">${drafts ? "我的草稿" : "记录"}</h2>${compose}</div>
      ${tabs}
      ${rows ? `<ul class="blog-list">${rows}</ul>` : empty}
      ${paging ? `<nav class="pagination" aria-label="记录分页">${paging}</nav>` : ""}
    </section>`);
}

// Escape text before emitting any inline formatting. Only explicit http(s) links become anchors.
function inline(text: string) {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^()\s]+\))/g).map(part => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return "<code>" + e(part.slice(1, -1)) + "</code>";
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return "<strong>" + e(part.slice(2, -2)) + "</strong>";
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return "<em>" + e(part.slice(1, -1)) + "</em>";
    const link = part.match(/^\[([^\]\n]+)\]\((https?:\/\/[^()\s]+)\)$/);
    if (link) return '<a rel="noopener noreferrer" href="' + e(link[2]) + '">' + e(link[1]) + "</a>";
    return e(part);
  }).join("");
}

export function articleBody(source: string) {
  const out: string[] = [], paragraph: string[] = [], items: string[] = [], code: string[] = [];
  let fenced = false;
  function flush() {
    if (paragraph.length) out.push("<p>" + paragraph.splice(0).map(inline).join("<br>") + "</p>");
    if (items.length) out.push("<ul>" + items.splice(0).map(t => "<li>" + inline(t) + "</li>").join("") + "</ul>");
  }
  for (const line of source.split("\n")) {
    if (/^```/.test(line)) {
      flush();
      if (fenced) out.push("<pre><code>" + e(code.splice(0).join("\n")) + "</code></pre>");
      fenced = !fenced;
      continue;
    }
    if (fenced) { code.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^---+\s*$/.test(line.trim())) { flush(); out.push('<hr class="prose-rule">'); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/), quote = line.match(/^>\s?(.*)$/), item = line.match(/^[-*]\s+(.+)$/);
    if (heading) { flush(); const tag = heading[1].length === 3 ? "h3" : "h2"; out.push("<" + tag + ">" + inline(heading[2]) + "</" + tag + ">"); }
    else if (quote) { flush(); out.push("<blockquote>" + inline(quote[1]) + "</blockquote>"); }
    else if (item) { if (paragraph.length) flush(); items.push(item[1]); }
    else { if (items.length) flush(); paragraph.push(line); }
  }
  if (fenced) out.push("<pre><code>" + e(code.join("\n")) + "</code></pre>");
  flush();
  return out.join("");
}

export function reader(s: Station, text: { id: string; title: string; body: string; topic: string; date: number }, author: boolean) {
  const life = s.slug === "life";
  const base = life ? "/life" : "/";
  const action = author ? `<a class="plain-link" href="${base}?edit=${text.id}">编辑${life ? "记录" : "文章"}</a>` : "";
  const mins = readingMinutes(text.body);
  return shell(s, `<article class="blog-reading">
    <header class="blog-article-head">
      <p class="blog-article-meta">${text.topic ? `<span class="meta-topic">${e(text.topic)}</span>` : ""}<time datetime="${new Date(text.date).toISOString()}">${formattedDate.format(text.date)}</time><span>约 ${mins} 分钟阅读</span></p>
      <h1>${e(text.title)}</h1>
      <div class="article-rule" aria-hidden="true"></div>
    </header>
    <div class="blog-prose">${articleBody(text.body)}</div>
    <hr class="blog-dinkus">
    <nav class="blog-article-foot" aria-label="文章导航"><a href="${base}">← ${life ? "返回近况" : "全部文章"}</a>${action}</nav>
  </article>`, { title: text.title });
}

export function editor(s: Station, d: Draft, options: { saved?: boolean; error?: string; preview?: boolean; hasDraft?: boolean; published?: boolean } = {}) {
  const life = s.slug === "life";
  const base = life ? "/life" : "/";
  const subject = life ? "记录" : "文章";
  const topic = life
    ? `<select id="topic" name="topic"><option${d.topic === "近况" ? " selected" : ""}>近况</option><option${d.topic === "经历" ? " selected" : ""}>经历</option></select>`
    : `<input id="topic" name="topic" maxlength="40" value="${e(d.topic)}" placeholder="例如：随笔">`;
  const notice = options.error ? `<p class="form-note" role="alert">${e(options.error)}</p>` : options.saved ? '<p class="save-note" role="status">草稿已保存</p>' : "";
  const confirm = options.hasDraft ? `<details class="discard"><summary>${options.published ? "放弃这次修订" : "删除这份草稿"}</summary>
    <p>${options.published ? "这份草稿会恢复为上次发表的版本。" : "删除后，这份未发表的草稿将无法恢复。"}</p><button type="submit" formnovalidate name="intent" value="discard">确认${options.published ? "放弃修订" : "删除草稿"}</button></details>` : "";
  const head = options.preview ? "预览" + subject : (d.revision ? "编辑" : "写") + subject;
  return shell(s, `<div class="manuscript"><div class="editor-nav"><a href="${base}">← ${life ? "返回近况" : "全部文章"}</a><a href="${base}?list=drafts#entries">草稿箱</a></div>
    <form method="post" action="${base}" class="writing-form"><input type="hidden" name="id" value="${e(d.id)}"><input type="hidden" name="revision" value="${d.revision}">
    <header><h1>${head}</h1></header>${notice}
    ${options.preview ? `<div class="preview-panel"><h2>${e(d.title || "无标题")}</h2><div class="typeset">${articleBody(d.body) || "<p>还没有正文。</p>"}</div></div>` : ""}
    <fieldset${options.preview ? " hidden" : ""}><label for="title">标题</label><input id="title" name="title" maxlength="160" placeholder="${life ? "这段日子在做什么" : "给文章起个名字"}" value="${e(d.title)}">
       <label for="topic">${life ? "记录类型" : "分类（选填）"}</label>${topic}
       <label for="body">正文</label><textarea id="body" name="body" maxlength="120000" placeholder="从第一句话开始……">${e(d.body)}</textarea>
       <small>支持 Markdown 的标题、粗体/斜体、分隔线、列表、引用、链接和代码块。</small></fieldset>
    <div class="editor-actions"><button type="submit" class="primary-link" name="intent" value="draft">保存草稿</button>
       <button type="submit" name="intent" value="${options.preview ? "continue" : "preview"}">${options.preview ? "继续编辑" : "预览排版"}</button>
       <button type="submit" name="intent" value="publish">${options.published ? "更新已发表版本" : "发表" + subject}</button></div>${confirm}</form></div>`, { title: head });
}
