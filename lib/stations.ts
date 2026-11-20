export const stations = [
  { slug:"blog", title:"博客", body:"旋涡星系", art:"spiral", anchor:"star-normalizer",
    tint:"#e7b9d3", note:"写下做项目时遇见的问题，也留些地方给随笔。", hint:"文章与随笔" },
  { slug:"projects", title:"GitHub 项目", body:"棒旋星系", art:"bar", anchor:"star-listing",
    tint:"#ebc68c", note:"从一张商品表到一个桌面工具。这里可以试用示例，也可以翻开源码。", hint:"作品与源码" },
  { slug:"life", title:"经历与近况", body:"环状星系", art:"ring", anchor:"star-java",
    tint:"#9ddbe1", note:"记录正在做的事，也把值得回看的经历留在这里。", hint:"个人经历与生活状态" },
  { slug:"reserve", title:"未命名星域", body:"不规则星系", art:"cloud", anchor:"star-upc",
    tint:"#dfa6d2", note:"这一站先留白。", hint:"留给以后" },
  { slug:"profile", title:"个人信息", body:"黑洞视界", art:"blackhole", anchor:"star-horizon",
    tint:"#f4b884", note:"我是 DYB，在读软件工程，喜欢做些日常用得上的小工具。欢迎写信聊聊。", hint:"个人资料与联系方式" }
] as const;
export type Station = typeof stations[number];
export type WritingStation = "blog" | "life";

export const icon = (id: string) => '<svg class="icon" aria-hidden="true" focusable="false"><use href="/assets/icons.svg?v=8#' + id + '"></use></svg>';
export { escapeHTML } from "../public/assets/escape-html.js";
export function html(markup: string, status = 200) {
  return new Response(markup, { status, headers: {
    "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store",
    "referrer-policy": "strict-origin-when-cross-origin", "x-content-type-options": "nosniff"
  }});
}
