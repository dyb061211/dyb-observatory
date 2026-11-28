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

// Shared chrome for every page. Static pages in public/notes/ and public/projects/ mirror this markup.
function renderHeader(activeSlug?: Station["slug"]) {
  const nav = [
    ["projects", "/projects", "项目"],
    ["life", "/life", "近况"],
    ["profile", "/profile", "关于"]
  ].map(([slug, href, label]) => `<a href="${href}"${activeSlug === slug ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="blog-header"><div class="blog-bar">
        <a class="blog-name" href="/">DYB</a>
        <nav class="blog-nav" aria-label="站点导航">${nav}
          <span class="mode-switch"><input type="checkbox" id="mode-toggle" aria-label="深色模式"><label for="mode-toggle" title="切换深浅色"></label></span></nav>
      </div></header>`;
}

const blogFooter = `<footer class="blog-footer"><span>DYB</span><a href="#top">回到顶部 ↑</a></footer>`;

export function shell(s: Station, content: string, options: { title?: string } = {}) {
  const pageTitle = s.slug === "blog" && !options.title ? "DYB" : `${e(options.title || s.title)} — DYB`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${pageTitle}</title><meta name="description" content="${e(s.note)}">
      <meta name="theme-color" content="#f0eee6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#1f1e1d" media="(prefers-color-scheme: dark)">
      <link rel="icon" href="/assets/mark.svg"><link rel="preload" href="/assets/fonts/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
      <link rel="stylesheet" href="/assets/blog.css?v=3"><script src="/assets/color-mode.js?v=1"></script>
      <script type="module" src="/assets/interiors.js?v=12"></script></head>
      <body class="blog-page" id="top"><a class="blog-skip" href="#station-content">跳到正文</a>${renderHeader(s.slug)}
      <main class="blog-main" id="station-content">${content}</main>${blogFooter}</body></html>`;
}

export function projects(repositoryList: string) {
  const items = featuredProjects.map(({ repo, name, tech, detail, demo, file }) => `<li class="project-item">
    <h3><a href="/projects/${e(file)}">${e(name)}</a><span class="blog-note">${e(tech)}</span></h3>
    <p class="project-desc">${e(detail)}</p>
    <p class="project-links"><a href="/projects/${e(file)}">${e(demo)}</a><a href="${git}/${e(repo)}" target="_blank" rel="noopener noreferrer">查看源码</a></p>
  </li>`).join("");
  return `<header class="blog-page-head"><h1>项目</h1><p>从一张商品表到一个桌面工具，这里收录写过的小项目与公开仓库。</p></header>
    <section class="blog-section" aria-labelledby="featured-title">
      <div class="blog-section-head"><h2 id="featured-title">精选项目</h2><a class="section-more" href="${git}?tab=repositories" target="_blank" rel="noopener noreferrer">GitHub 全部仓库 ↗</a></div>
      <ul class="project-list">${items}</ul>
    </section>
    ${repositoryList}<script type="module" src="/assets/repositories.js?v=10"></script>`;
}

export function profile() {
  const rows = profiles.map(([name, handle, url, id]) => {
    const email = id === "mail";
    const address = email ? handle : url;
    const alternate = email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}` : url;
    return `<div class="contact-item">
      <div class="contact-head">
        <a class="contact-row" href="${e(url)}" target="${email ? "_top" : "_blank"}" rel="noopener noreferrer">${e(name)}</a>
        <span class="blog-note">${e(handle)}</span>
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
  return `<header class="blog-page-head"><h1>关于</h1><p>我是 DYB，在读软件工程，平时写一些日常用得上的小工具。平时主要接触 Java 后端、Python 数据处理和一些 AI 应用，欢迎随时写信聊聊。</p></header>
    <section class="blog-section" aria-labelledby="contact-title">
      <h2 id="contact-title">联系方式</h2>
      <div class="contact-list">${rows}</div>
    </section><script type="module" src="/assets/contacts.js?v=2"></script>`;
}

export function blogEntry(url: string, title: string, note: string) {
  return `<li class="blog-entry"><a href="${e(url)}">${e(title)}</a><span class="blog-note">${note}</span></li>`;
}

export function existingArticles() {
  return blogEntry("/notes/catalog-order.html", "商品目录为什么要保留录入顺序？", "Java · 集合")
    + blogEntry("/notes/upc-text.html", "为什么要把 UPC 存成文本？", "Python · 数据清洗");
}

export function blogIntro() {
  const links = profiles.map(([name, , url, id]) => `<a href="${e(url)}"${id === "mail" ? "" : ' target="_blank" rel="noopener noreferrer"'}>${e(id === "mail" ? "写信" : name)}</a>`).join("");
  return `<p>我是 DYB，在读软件工程，平时写一些日常用得上的小工具。这里写下做项目时遇见的问题，也留些地方给随笔。</p>
      <p class="blog-links">${links}</p>`;
}

export function blogFeaturedProjects() {
  return featuredProjects.map(({ file, name, tech }) => `<li><a href="/projects/${e(file)}">${e(name)}</a><span class="blog-note">${e(tech)}</span></li>`).join("");
}
