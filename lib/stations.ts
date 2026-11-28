export const stations = [
  { slug: "blog", title: "博客", note: "写下做项目时遇见的问题，也留些地方给随笔。", hint: "文章与随笔" },
  { slug: "projects", title: "项目", note: "从一张商品表到一个桌面工具，这里收录写过的小项目与公开仓库。", hint: "作品与源码" },
  { slug: "life", title: "近况", note: "记录正在做的事，也把值得回看的经历留在这里。", hint: "近况与经历" },
  { slug: "profile", title: "关于", note: "我是 DYB，在读软件工程，平时写一些日常用得上的小工具。欢迎写信聊聊。", hint: "简介与联系" }
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
