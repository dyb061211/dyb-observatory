import type { FeaturedProject, PublicRepository } from "../db/schema";
import { escapeHTML as e, type Station } from "./stations";
import { githubProfile as git } from "../public/assets/github-api.js";
import type { ProjectInput } from "./site-content";

const contactEmail = "ddddddyb1211@gmail.com";
const profiles = [
  ["GitHub", "dyb061211", git, "github"],
  ["X", "@Dcme812", "https://x.com/Dcme812", "xmark"],
  ["LINUX DO", "dyb", "https://linux.do/u/dyb/summary", "linuxdo"],
  ["Gmail", contactEmail, `mailto:${contactEmail}`, "mail"]
] as const;

const modeToggle = `<button type="button" id="mode-toggle" class="mode-toggle" aria-label="切换深浅色"><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg></button>`;

// Shared chrome for every page. Static pages in public/notes/ and public/projects/ mirror this markup.
function renderHeader(activeSlug?: Station["slug"]) {
  const nav = [
    ["blog", "/", "文章"],
    ["projects", "/projects", "项目"],
    ["life", "/life", "近况"],
    ["profile", "/profile", "关于"]
  ].map(([slug, href, label]) => `<a href="${href}"${activeSlug === slug ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="blog-header"><div class="blog-bar">
        <a class="blog-name" href="/">DYB<span class="blog-seal" aria-hidden="true"></span></a>
        <nav class="blog-nav" aria-label="站点导航">${nav}${modeToggle}</nav>
      </div></header>`;
}

function renderFooter(footerNote?: string) {
  return `<footer class="blog-footer"><div class="blog-footer-inner"><span>${e(footerNote || "DYB · 写于日常与代码之间")}</span><span class="blog-footer-links"><a href="${git}" target="_blank" rel="noopener noreferrer">GitHub</a><a href="#top">回到顶部 ↑</a></span></div></footer>`;
}

export function shell(s: Station, content: string, options: { title?: string; hero?: boolean; footerNote?: string } = {}) {
  const pageTitle = s.slug === "blog" && !options.title ? "DYB" : `${e(options.title || s.title)} — DYB`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${pageTitle}</title><meta name="description" content="${e(s.note)}">
      <meta name="theme-color" content="#4e6f95" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b0f18" media="(prefers-color-scheme: dark)">
      <link rel="icon" href="/assets/mark.svg"><link rel="preload" href="/assets/fonts/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
      <link rel="stylesheet" href="/assets/blog.css?v=8"><script src="/assets/color-mode.js?v=4"></script>
      <script type="module" src="/assets/horizon-sky.js?v=2"></script>
      <script type="module" src="/assets/interiors.js?v=13"></script></head>
      <body class="blog-page" id="top"><a class="blog-skip" href="#station-content">跳到正文</a>
      <div class="horizon-stage${options.hero ? "" : " compact"}"><canvas class="horizon-canvas" aria-hidden="true"></canvas>${renderHeader(s.slug)}</div>
      <main class="editorial-sheet" id="station-content">${content}</main>${renderFooter(options.footerNote)}</body></html>`;
}

export function renderParagraphs(text: string, className = "") {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const cls = className ? ` class="${className}"` : "";
  return blocks.map(block => `<p${cls}>${block.split("\n").map(line => e(line)).join("<br>")}</p>`).join("");
}

export function inlineCopyEditor(
  action: string,
  returnTo: string,
  fields: Array<{ key: string; label: string; value: string; rows?: number; singleLine?: boolean }>,
  summaryLabel = "编辑简介"
) {
  const inputs = fields.map(f => {
    const id = `copy-${f.key}`;
    return `<label for="${id}">${e(f.label)}</label>` + (f.singleLine
      ? `<input id="${id}" name="copy:${e(f.key)}" maxlength="200" value="${e(f.value)}">`
      : `<textarea id="${id}" name="copy:${e(f.key)}" rows="${f.rows ?? 3}" maxlength="2000">${e(f.value)}</textarea>`);
  }).join("");
  return `<details class="inline-copy-edit"><summary>${e(summaryLabel)}</summary>
    <form method="post" action="${e(action)}" class="inline-copy-form">
      <input type="hidden" name="intent" value="save-copy">
      <input type="hidden" name="return_to" value="${e(returnTo)}">
      ${inputs}
      <div class="inline-copy-actions"><button type="submit" class="primary-save">保存</button><small>空行可分段，清空保存可恢复默认文案。</small></div>
    </form>
  </details>`;
}

export function projects(repositoryList: string, featured: FeaturedProject[], introText: string, canEdit: boolean) {
  const cards = featured.map(item => {
    const repoUrl = `${git}/${encodeURIComponent(item.repoName)}`;
    const primaryHref = item.demoUrl ? e(item.demoUrl) : repoUrl;
    const primaryExternal = !item.demoUrl || /^https?:\/\//i.test(item.demoUrl);
    const demoAction = item.demoUrl
      ? `<a href="${e(item.demoUrl)}"${/^https?:\/\//i.test(item.demoUrl) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${e(item.demoLabel || "查看示例")} →</a>`
      : "";
    const ownerBar = canEdit
      ? `<div class="project-owner"><a href="/projects?edit=${e(item.id)}">编辑</a><details class="inline-delete"><summary>删除</summary><form method="post" action="/projects" class="inline-delete-form"><input type="hidden" name="intent" value="delete-project"><input type="hidden" name="id" value="${e(item.id)}"><span>确定从精选移除？</span><button type="submit">确认删除</button></form></details></div>`
      : "";
    return `<li class="project-card">
      <span class="folio-top"><span class="folio-eyebrow">${e(item.tech || item.repoName)}</span></span>
      <h3><a href="${primaryHref}"${primaryExternal ? ' target="_blank" rel="noopener noreferrer"' : ""}>${e(item.name)}</a></h3>
      <p>${e(item.detail)}</p>
      <div class="folio-actions">${demoAction}<a href="${repoUrl}" target="_blank" rel="noopener noreferrer">查看源码 ↗</a></div>
      ${ownerBar}
    </li>`;
  }).join("");
  const headAction = canEdit
    ? `<a class="section-more" href="/projects?edit=new">+ 添加精选项目</a>`
    : import.meta.env.DEV
      ? `<a class="section-more" href="/signin-with-chatgpt?return_to=/projects" target="_top">登录测试作者</a>`
      : "";
  const copyEdit = canEdit ? inlineCopyEditor("/projects", "/projects", [{ key: "projects_intro", label: "项目页导语", value: introText }]) : "";
  return `<header class="blog-page-head"><h1>项目</h1>${renderParagraphs(introText)}${copyEdit}</header>
    <section class="blog-section" aria-labelledby="featured-title">
      <div class="blog-section-head"><h2 id="featured-title">精选项目</h2><div class="head-links">${headAction}<a class="section-more" href="${git}?tab=repositories" target="_blank" rel="noopener noreferrer">GitHub 全部仓库 ↗</a></div></div>
      ${featured.length ? `<ul class="folio-grid">${cards}</ul>` : `<p class="empty-line">还没有精选项目。${canEdit ? '可以从下方「更多仓库」挑一个设为精选，或点击右上角「+ 添加精选项目」。' : ""}</p>`}
    </section>
    ${repositoryList}<script type="module" src="/assets/repositories.js?v=13"></script>`;
}

export function projectEditor(
  s: Station,
  project: ProjectInput,
  repos: PublicRepository[],
  options: { isNew: boolean; error?: string; footerNote?: string }
) {
  const inList = repos.some(r => r.name === project.repoName);
  const repoOptions = [
    ...(project.repoName && !inList ? [{ id: project.repoId ?? 0, name: project.repoName, language: project.tech, description: project.detail, fork: false }] : []),
    ...repos
  ].map(r => `<option value="${e(r.name)}" data-repo-id="${r.id || ""}" data-lang="${e(r.language || "")}" data-desc="${e(r.description || "")}"${r.name === project.repoName ? " selected" : ""}>${e(r.name)}${r.language ? ` (${e(r.language)})` : ""}</option>`).join("");
  const notice = options.error ? `<p class="form-note" role="alert">${e(options.error)}</p>` : "";
  const deleteBlock = !options.isNew
    ? `<form method="post" action="/projects" class="discard danger-zone-wrap"><input type="hidden" name="id" value="${e(project.id)}"><details class="discard danger-zone"><summary>从精选项目中删除</summary><p>删除后这个项目不会再出现在首页和「精选项目」中，但不会影响你的 GitHub 仓库。</p><button type="submit" name="intent" value="delete-project">确认删除</button></details></form>`
    : "";
  const title = options.isNew ? "添加精选项目" : "编辑精选项目";
  return shell(s, `<div class="manuscript">
    <div class="editor-nav"><a href="/projects">← 返回项目</a></div>
    <form method="post" action="/projects" class="writing-form project-form"${options.isNew ? ' data-autofill="1"' : ""}>
      <input type="hidden" name="id" value="${e(project.id)}">
      <input type="hidden" name="repoId" id="repo-id" value="${project.repoId ?? ""}">
      <header><h1>${title}</h1></header>${notice}
      <fieldset>
        <label for="repo-select">选择 GitHub 仓库</label>
        <select id="repo-select" name="repoName">${repoOptions}</select>
        <label for="project-name">展示名称</label>
        <input id="project-name" name="name" maxlength="100" required value="${e(project.name)}" placeholder="例如：Product Normalizer">
        <label for="project-tech">技术标签（选填）</label>
        <input id="project-tech" name="tech" maxlength="60" value="${e(project.tech)}" placeholder="例如：Python · Pandas">
        <label for="project-detail">项目介绍</label>
        <textarea id="project-detail" name="detail" class="compact-textarea" maxlength="600" required placeholder="用一两句话介绍这个项目做什么、解决了什么问题">${e(project.detail)}</textarea>
        <label for="project-demo-url">演示或说明页链接（选填）</label>
        <input id="project-demo-url" name="demoUrl" maxlength="300" value="${e(project.demoUrl)}" placeholder="留空则直接跳到 GitHub 仓库，或填 /projects/xxx.html">
        <label for="project-demo-label">演示链接文案（选填）</label>
        <input id="project-demo-label" name="demoLabel" maxlength="40" value="${e(project.demoLabel)}" placeholder="例如：查看示例">
        <label for="project-sort">排序权重（数字越小越靠前）</label>
        <input id="project-sort" name="sortOrder" type="number" min="-999" max="9999" value="${project.sortOrder}">
      </fieldset>
      <div class="editor-actions">
        <button type="submit" class="primary-link" name="intent" value="save-project">${options.isNew ? "添加到精选" : "保存修改"}</button>
      </div>
    </form>
    ${deleteBlock}
  </div>`, { title, footerNote: options.footerNote });
}

export function profile(aboutText: string, footerText: string, canEdit: boolean) {
  const rows = profiles.map(([name, handle, url, id]) => {
    const email = id === "mail";
    const address = email ? handle : url;
    const alternate = email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}` : url;
    return `<div class="contact-item">
      <div class="contact-head">
        <a class="contact-row" href="${e(url)}" target="${email ? "_top" : "_blank"}" rel="noopener noreferrer">${e(name)}</a>
        <span class="contact-handle">${e(handle)}</span>
      </div>
      <details class="contact-options">
        <summary aria-label="查看${e(name)}地址与复制选项">查看地址</summary>
        <div class="contact-panel">
          <input class="contact-value" aria-label="${e(name)} ${email ? "邮箱地址" : "主页网址"}" value="${e(address)}" readonly dir="ltr" inputmode="none" spellcheck="false">
          <div class="contact-tools">
            <button type="button" class="contact-copy" hidden>${email ? "复制邮箱" : "复制链接"}</button>
            <a class="plain-link" href="${e(alternate)}" target="_top" rel="noopener noreferrer">${email ? "用 Gmail 网页版写信" : "在当前页打开"}</a>
          </div>
          <p class="contact-status" role="status"></p>
        </div>
      </details>
    </div>`;
  }).join("");
  const copyEdit = canEdit
    ? inlineCopyEditor("/profile", "/profile", [
        { key: "about_intro", label: "关于页自我介绍", value: aboutText, rows: 4 },
        { key: "footer_note", label: "全站页脚落款", value: footerText, singleLine: true }
      ], "编辑关于与页脚")
    : import.meta.env.DEV
      ? `<div class="head-login"><a class="section-more" href="/signin-with-chatgpt?return_to=/profile" target="_top">登录测试作者</a></div>`
      : "";
  return `<header class="blog-page-head"><h1>关于</h1>${renderParagraphs(aboutText)}${copyEdit}</header>
    <section class="blog-section" aria-labelledby="contact-title">
      <div class="blog-section-head"><h2 id="contact-title">联系方式</h2></div>
      <div class="contact-list">${rows}</div>
    </section><script type="module" src="/assets/contacts.js?v=2"></script>`;
}

export function blogEntry(url: string, title: string, note: string, ownerActions = "") {
  return `<li class="blog-entry"><div class="entry-row-wrap"><a class="entry-link" href="${e(url)}"><span class="entry-title">${e(title)}</span><span class="entry-meta">${note}</span></a>${ownerActions}</div></li>`;
}

export function blogIntro(introText: string, canEdit: boolean) {
  const links = profiles.map(([name, , url, id]) => `<a href="${e(url)}"${id === "mail" ? "" : ' target="_blank" rel="noopener noreferrer"'}>${e(id === "mail" ? "写信" : name)}</a>`).join("");
  const edit = canEdit ? inlineCopyEditor("/", "/", [{ key: "home_intro", label: "首页个人简介", value: introText }], "编辑简介") : "";
  return `<div class="lead-accent" aria-hidden="true"></div>
      ${renderParagraphs(introText, "blog-lead")}
      <p class="blog-links">${links}</p>${edit}`;
}

export function blogFeaturedProjects(items: FeaturedProject[], canEdit: boolean) {
  if (!items.length) {
    return `<p class="empty-line">还没有精选项目。${canEdit ? '<a href="/projects?edit=new">去挑选一个 GitHub 仓库 →</a>' : ""}</p>`;
  }
  const cards = items.map(item => {
    const href = item.demoUrl ? e(item.demoUrl) : `${git}/${encodeURIComponent(item.repoName)}`;
    const external = !item.demoUrl || /^https?:\/\//i.test(item.demoUrl);
    return `<li><a class="folio-card" href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
      <span class="folio-top"><span class="folio-eyebrow">${e(item.tech || item.repoName)}</span><span class="folio-arrow" aria-hidden="true">↗</span></span>
      <h3>${e(item.name)}</h3>
      <p>${e(item.detail)}</p>
    </a></li>`;
  }).join("");
  return `<ul class="folio-grid">${cards}</ul>`;
}
