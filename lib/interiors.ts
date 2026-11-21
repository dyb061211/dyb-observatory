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
export function existingArticles() {
  return `<a class="entry-row" href="/notes/catalog-order.html"><small>Java · 集合</small><h3>商品目录为什么要保留录入顺序？</h3><p>从一个 SKU 查询和排序的小问题，认识 LinkedHashMap。</p></a>
    <a class="entry-row" href="/notes/upc-text.html"><small>Python · 数据清洗</small><h3>为什么要把 UPC 存成文本？</h3><p>一个开头的零，足以让两个看似相同的条码产生差别。</p></a>`;
}
export function currentLife() {
  return `<aside class="life-aside"><h3>目前的状态</h3>
    <p>软件工程在读，最近在学 Java 后端，也在做 Python 和 AI 小工具。</p>
      <h3 class="aside-heading">学习与项目经历</h3>
      <a class="experience-item" href="/notes/catalog-order.html"><b>Java 后端练习</b><span>在商品目录里实现按 SKU 查询和按录入顺序展示，再用测试检查顺序。</span></a>
      <a class="experience-item" href="/projects/product-normalizer.html"><b>商品数据清洗</b><span>把条码表和商品表按 SKU 对齐，做成可以导出 Excel 的工具。</span></a></aside>`;
}

