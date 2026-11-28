import { escapeHTML as e, icon, stations, type Station } from "./stations";
import { githubProfile as git } from "../public/assets/github-api.js";
import { featuredProjects } from "../public/assets/github-catalog.js";

const contactEmail = "ddddddyb1211@gmail.com";
const profiles = [
  ["GitHub","dyb061211",git,"github"],
  ["X","@Dcme812","https://x.com/Dcme812","xmark"],
  ["LINUX DO","dyb","https://linux.do/u/dyb/summary","linuxdo"],
  ["Gmail",contactEmail,`mailto:${contactEmail}`,"mail"]
];
export function shell(s: Station, content: string, options: {compact?:boolean; actions?:string; title?:string}={}) {
  if (s.slug === "blog") {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${e(options.title || "博客")} · DYB 观测站</title><meta name="description" content="${e(s.note)}">
      <meta name="theme-color" content="#f0eee6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#1f1e1d" media="(prefers-color-scheme: dark)">
      <link rel="icon" href="/assets/mark.svg"><link rel="preload" href="/assets/fonts/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
      <link rel="stylesheet" href="/assets/blog.css?v=2"><script src="/assets/color-mode.js?v=1"></script>
      <script type="module" src="/assets/interiors.js?v=11"></script></head>
      <body class="blog-page" id="top"><a class="blog-skip" href="#station-content">跳到正文</a>${blogHeader}
      <main class="blog-main" id="station-content">${content}</main>${blogFooter}</body></html>`;
  }
  const compact = !!options.compact;
  const stationNav = stations.map(t => `<a href="/${t.slug}"${t.slug===s.slug?' aria-current="page"':''}>${t.title}</a>`).join("");
  const hero = compact ? "" : `<header class="station-hero">
    <div class="station-art" data-body="${s.art}" aria-hidden="true"><img class="station-object" alt="" src="/assets/sky/${s.art}.webp"><canvas class="station-object" width="1024" height="1024"></canvas><div class="stars-dust"></div></div>
    <div class="hero-inner"><p class="orbit-name"><i></i>${s.body}</p>
    <h1>${s.title}</h1><p class="station-intro">${s.note}</p>${options.actions||""}</div>
  </header>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <title>${e(options.title||s.title)} · DYB 观测站</title><meta name="theme-color" content="#0b0e16"><meta name="description" content="${s.note}">
    <link rel="icon" href="/assets/mark.svg"><link rel="stylesheet" href="/assets/site.css?v=11611228ef"><link rel="stylesheet" href="/assets/interiors.css?v=10">
    <script type="module" src="/assets/interiors.js?v=9"></script></head>
    <body class="interior ${s.slug}${compact?" compact":""}" style="--accent:${s.tint}"><a class="skip" href="#station-content">跳到正文</a>
     <div class="station-bar"><div class="station-bar-inner"><a class="return-map" href="/#${s.anchor}">${icon("observatory")}<span>返回星图</span></a><span class="mast-name">DYB 观测站</span>
      <details class="interior-menu"><summary>星系导航</summary><nav aria-label="星系导航">${stationNav}</nav></details></div></div>
     <main id="station-content">${hero}${content}</main><footer class="station-foot"><span>DYB 观测站</span><a href="/#${s.anchor}">返回${s.body}</a></footer></body></html>`;
}
export function projects(repositoryList: string) {
  const cards=featuredProjects.map(({repo,name,tech,detail,demo,file,style})=>`<article class="repo-lead ${style}">
    <span class="repo-tech">${icon("branch")}${tech}</span><h3><a href="${git}/${repo}">${name}</a></h3><p>${detail}</p>
    <div class="repo-links"><a href="${git}/${repo}">${icon("github")} 查看仓库</a><a href="/projects/${file}">${demo}</a></div></article>`).join("");
  return `<div class="station-content"><div class="list-heading"><h2>精选项目</h2><a href="${git}?tab=repositories">GitHub 全部仓库</a></div>
    <div class="featured-repos">${cards}</div>${repositoryList}</div><script type="module" src="/assets/repositories.js?v=9"></script>`;
}
export function profile() {
  const rows = profiles.map(([name, handle, url, id]) => {
    const email = id === "mail";
    const address = email ? handle : url;
    const alternate = email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}` : url;
    return `<div class="contact-item">
      <a class="contact-row" href="${e(url)}" target="${email ? "_top" : "_blank"}" rel="noopener noreferrer">
        <span>${icon(id)}${e(name)}</span><b>${e(handle)}</b>
      </a>
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
  return `<div class="station-content contact-content"><div class="list-heading"><h2>找到我</h2></div>
    <div class="contact-list">${rows}</div></div><script type="module" src="/assets/contacts.js?v=1"></script>`;
}
export function reserve() {
  return "";
}
// Shared chrome for every blog page. Static notes in public/notes/ copy this markup by hand.
const blogHeader = `<header class="blog-header"><div class="blog-bar">
        <a class="blog-name" href="/blog">DYB</a>
        <nav class="blog-nav" aria-label="博客导航"><a href="/#star-normalizer">星图</a><a href="/profile">关于</a>
          <span class="mode-switch"><input type="checkbox" id="mode-toggle" aria-label="深色模式"><label for="mode-toggle" title="切换深浅色"></label></span></nav>
      </div></header>`;
const blogFooter = `<footer class="blog-footer"><span>DYB 观测站</span><a href="#top">回到顶部 ↑</a></footer>`;
export function blogEntry(url: string, title: string, note: string) {
  return `<li class="blog-entry"><a href="${e(url)}">${e(title)}</a><span class="blog-note">${note}</span></li>`;
}
export function existingArticles() {
  return blogEntry("/notes/catalog-order.html", "商品目录为什么要保留录入顺序？", "Java · 集合")
    + blogEntry("/notes/upc-text.html", "为什么要把 UPC 存成文本？", "Python · 数据清洗");
}
export function blogIntro() {
  const links = profiles.map(([name, , url, id]) => `<a href="${e(url)}"${id === "mail" ? "" : ' target="_blank" rel="noopener noreferrer"'}>${e(id === "mail" ? "写信" : name)}</a>`).join("");
  return `<p>我是 DYB，在读软件工程，喜欢做些日常用得上的小工具。这里写下做项目时遇见的问题，也留些地方给随笔。</p>
      <p class="blog-links">${links}</p>`;
}
export function blogElsewhere() {
  const places = [["星图", "/#star-normalizer", "回到观测站"], ...stations.filter(t => t.slug !== "blog" && t.slug !== "reserve").map(t => [t.title, `/${t.slug}`, t.hint])];
  return places.map(([name, url, note]) => `<li><a href="${e(url)}">${e(name)}</a><span class="blog-note">${e(note)}</span></li>`).join("");
}
export function currentLife() {
  return `<aside class="life-aside"><h3>目前的状态</h3>
    <p>软件工程在读，最近在学 Java 后端，也在做 Python 和 AI 小工具。</p>
      <h3 class="aside-heading">学习与项目经历</h3>
      <a class="experience-item" href="/notes/catalog-order.html"><b>Java 后端练习</b><span>在商品目录里实现按 SKU 查询和按录入顺序展示，再用测试检查顺序。</span></a>
      <a class="experience-item" href="/projects/product-normalizer.html"><b>商品数据清洗</b><span>把条码表和商品表按 SKU 对齐，做成可以导出 Excel 的工具。</span></a></aside>`;
}

