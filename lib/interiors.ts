import { escapeHTML as e, type Station } from "./stations";
import { githubProfile as git } from "../public/assets/github-api.js";
import { featuredProjects } from "../public/assets/github-catalog.js";

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

const blogFooter = `<footer class="blog-footer"><div class="blog-footer-inner"><span>DYB · 写于日常与代码之间</span><span class="blog-footer-links"><a href="${git}" target="_blank" rel="noopener noreferrer">GitHub</a><a href="#top">回到顶部 ↑</a></span></div></footer>`;

export function shell(s: Station, content: string, options: { title?: string; hero?: boolean } = {}) {
  const pageTitle = s.slug === "blog" && !options.title ? "DYB" : `${e(options.title || s.title)} — DYB`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${pageTitle}</title><meta name="description" content="${e(s.note)}">
      <meta name="theme-color" content="#4e6f95" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b0f18" media="(prefers-color-scheme: dark)">
      <link rel="icon" href="/assets/mark.svg"><link rel="preload" href="/assets/fonts/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
      <link rel="stylesheet" href="/assets/blog.css?v=6"><script src="/assets/color-mode.js?v=3"></script>
      <script type="module" src="/assets/horizon-sky.js?v=1"></script>
      <script type="module" src="/assets/interiors.js?v=12"></script></head>
      <body class="blog-page" id="top"><a class="blog-skip" href="#station-content">跳到正文</a>
      <div class="horizon-stage${options.hero ? "" : " compact"}"><canvas class="horizon-canvas" aria-hidden="true"></canvas>${renderHeader(s.slug)}</div>
      <main class="editorial-sheet" id="station-content">${content}</main>${blogFooter}</body></html>`;
}

export function projects(repositoryList: string) {
  const cards = featuredProjects.map(({ repo, name, tech, detail, demo, file }) => `<li class="project-card">
    <span class="folio-top"><span class="folio-eyebrow">${e(tech)}</span></span>
    <h3><a href="/projects/${e(file)}">${e(name)}</a></h3>
    <p>${e(detail)}</p>
    <div class="folio-actions"><a href="/projects/${e(file)}">${e(demo)} →</a><a href="${git}/${e(repo)}" target="_blank" rel="noopener noreferrer">查看源码 ↗</a></div>
  </li>`).join("");
  return `<header class="blog-page-head"><h1>项目</h1><p>从一张商品表到一个桌面工具，这里收录写过的小项目与公开仓库。</p></header>
    <section class="blog-section" aria-labelledby="featured-title">
      <div class="blog-section-head"><h2 id="featured-title">精选项目</h2><a class="section-more" href="${git}?tab=repositories" target="_blank" rel="noopener noreferrer">GitHub 全部仓库 ↗</a></div>
      <ul class="folio-grid">${cards}</ul>
    </section>
    ${repositoryList}<script type="module" src="/assets/repositories.js?v=12"></script>`;
}

export function profile() {
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
  return `<header class="blog-page-head"><h1>关于</h1><p>我是 DYB，在读软件工程，平时写一些日常用得上的小工具。主要接触 Java 后端、Python 数据处理和一些 AI 应用，欢迎随时写信聊聊。</p></header>
    <section class="blog-section" aria-labelledby="contact-title">
      <div class="blog-section-head"><h2 id="contact-title">联系方式</h2></div>
      <div class="contact-list">${rows}</div>
    </section><script type="module" src="/assets/contacts.js?v=2"></script>`;
}

export function blogEntry(url: string, title: string, note: string) {
  return `<li class="blog-entry"><a class="entry-link" href="${e(url)}"><span class="entry-title">${e(title)}</span><span class="entry-meta">${note}</span></a></li>`;
}

export function existingArticles() {
  return blogEntry("/notes/catalog-order.html", "商品目录为什么要保留录入顺序？", "Java · 集合")
    + blogEntry("/notes/upc-text.html", "为什么要把 UPC 存成文本？", "Python · 数据清洗");
}

export function blogIntro() {
  const links = profiles.map(([name, , url, id]) => `<a href="${e(url)}"${id === "mail" ? "" : ' target="_blank" rel="noopener noreferrer"'}>${e(id === "mail" ? "写信" : name)}</a>`).join("");
  return `<div class="lead-accent" aria-hidden="true"></div>
      <p class="blog-lead">我是 DYB，在读软件工程，平时写一些日常用得上的小工具。这里写下做项目时遇见的问题，也留些地方给随笔。</p>
      <p class="blog-links">${links}</p>`;
}

export function blogFeaturedProjects() {
  const cards = featuredProjects.map(({ file, name, tech, detail }) => `<li><a class="folio-card" href="/projects/${e(file)}">
    <span class="folio-top"><span class="folio-eyebrow">${e(tech)}</span><span class="folio-arrow" aria-hidden="true">↗</span></span>
    <h3>${e(name)}</h3>
    <p>${e(detail)}</p>
  </a></li>`).join("");
  return `<ul class="folio-grid">${cards}</ul>`;
}
