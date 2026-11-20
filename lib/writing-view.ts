import { escapeHTML as e, icon, type Station } from "./stations";
import { existingArticles, currentLife, shell } from "./interiors";
import { pageSize, type Draft, type listEntries } from "./entries";

const formattedDate = new Intl.DateTimeFormat("zh-CN", { timeZone:"America/New_York",year:"numeric",month:"long",day:"numeric" });
export function writingIndex(s: Station, list: Awaited<ReturnType<typeof listEntries>>, author: string | null, drafts: boolean, page: number) {
  const life=s.slug==="life", label=life?"动态":"文章", path="/"+s.slug, listUrl=path+(drafts?"?list=drafts":"?list=published");
  const compose=author?(life
    ? `<div class="station-actions"><a class="primary-link" href="/life?edit=new&amp;topic=近况">写近况</a><a class="plain-link" href="/life?edit=new&amp;topic=经历">记一段经历</a></div>`
    : `<div class="station-actions"><a class="primary-link" href="/blog?edit=new">${icon("book")}写文章</a></div>`):import.meta.env.DEV?
    `<div class="station-actions"><a class="plain-link" href="/signin-with-chatgpt?return_to=/${s.slug}" target="_top">登录测试作者</a></div>`:"";
  const rows=list.slice(0,pageSize).map(r=>`<a class="entry-row" href="${path}?${drafts?"edit":"read"}=${r.id}">
    <small>${e(r.topic||label)}<i>·</i><time datetime="${new Date(r.date!).toISOString()}">${formattedDate.format(r.date!)}</time>${drafts&&r.wasPublished?" · 已发表文章的修订":""}</small>
    <h3>${e(r.title||"无标题草稿")}</h3></a>`).join("");
  const paging=(page>0?`<a href="${listUrl}&amp;page=${page-1}#entries">上一页</a>`:"")+
    (list.length>pageSize?`<a href="${listUrl}&amp;page=${page+1}#entries">下一页</a>`:"");
  const extra=!drafts&&s.slug==="blog"&&list.length<=pageSize?existingArticles():"";
  const empty=rows||extra?"":`<p class="empty-line">${drafts?"草稿箱是空的。":life?"还没有发表生活动态。":"还没有文章。"}</p>`;
  const tabs=author?`<div class="index-tabs"><a href="${path}#entries" ${!drafts?'aria-current="page"':''}>已发表</a><a href="${path}?list=drafts#entries" ${drafts?'aria-current="page"':''}>草稿箱</a></div>`:"";
  return shell(s,`<div class="station-content${life?" life-grid":""}" id="entries"><div><div class="list-heading"><h2>${drafts?"我的草稿":life?"生活记录":"文章"}</h2>${tabs}</div>
    <div class="rows">${rows}${extra}${empty}</div>${paging?'<nav class="pagination">'+paging+'</nav>':""}</div>${life?currentLife():""}</div>`,{actions:compose});
}

// Escape text before emitting any inline formatting. Only explicit http(s) links become anchors.
function inline(text: string) {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^()\s]+\))/g).map(part=>{
    if (part.startsWith("`")&&part.endsWith("`")&&part.length>2) return "<code>"+e(part.slice(1,-1))+"</code>";
    if (part.startsWith("**")&&part.endsWith("**")&&part.length>4) return "<strong>"+e(part.slice(2,-2))+"</strong>";
    const link=part.match(/^\[([^\]\n]+)\]\((https?:\/\/[^()\s]+)\)$/);
    if (link) return '<a rel="noopener noreferrer" href="'+e(link[2])+'">'+e(link[1])+'</a>';
    return e(part);
  }).join("");
}
export function articleBody(source: string) {
  const out: string[]=[], paragraph: string[]=[], items: string[]=[], code: string[]=[];
  let fenced=false;
  function flush() {
    if(paragraph.length) out.push("<p>"+paragraph.splice(0).map(inline).join("<br>")+"</p>");
    if(items.length) out.push("<ul>"+items.splice(0).map(t=>"<li>"+inline(t)+"</li>").join("")+"</ul>");
  }
  for(const line of source.split("\n")) {
    if (/^```/.test(line)) {
      flush();
      if(fenced) out.push("<pre><code>"+e(code.splice(0).join("\n"))+"</code></pre>");
      fenced=!fenced; continue;
    }
    if(fenced){code.push(line);continue;}
    if(!line.trim()) {flush();continue;}
    const heading=line.match(/^(#{1,3})\s+(.+)$/), quote=line.match(/^>\s?(.*)$/), item=line.match(/^[-*]\s+(.+)$/);
    if(heading){flush();const tag=heading[1].length===3?"h3":"h2";out.push("<"+tag+">"+inline(heading[2])+"</"+tag+">");}
    else if(quote){flush();out.push("<blockquote>"+inline(quote[1])+"</blockquote>");}
    else if(item){if(paragraph.length)flush();items.push(item[1]);}
    else {if(items.length)flush();paragraph.push(line);}
  }
  if(fenced)out.push("<pre><code>"+e(code.join("\n"))+"</code></pre>");
  flush();return out.join("");
}
export function reader(s: Station, text: {id:string; title:string; body:string; topic:string;date:number}, author: boolean) {
  const action=author?`<a class="plain-link" href="/${s.slug}?edit=${text.id}">编辑${s.slug==="life"?"记录":"文章"}</a>`:"";
  return shell(s,`<article class="manuscript reading"><div class="editor-nav"><a href="/${s.slug}">${s.title}</a>${action}</div>
    <header><p class="orbit-name">${e(text.topic||s.title)} · ${formattedDate.format(text.date)}</p><h1>${e(text.title)}</h1></header>
    <div class="typeset">${articleBody(text.body)}</div></article>`,{compact:true,title:text.title});
}
export function editor(s: Station, d: Draft, options: { saved?:boolean; error?:string; preview?:boolean; hasDraft?:boolean; published?:boolean }={}) {
  const path="/"+s.slug, life=s.slug==="life", subject=life?"记录":"文章";
  const topic=life
    ? `<select id="topic" name="topic"><option${d.topic==="近况"?" selected":""}>近况</option><option${d.topic==="经历"?" selected":""}>经历</option></select>`
    : `<input id="topic" name="topic" maxlength="40" value="${e(d.topic)}" placeholder="例如：随笔">`;
  const notice=options.error?`<p class="form-note" role="alert">${e(options.error)}</p>`:options.saved?'<p class="save-note" role="status">草稿已保存</p>':"";
  const confirm=options.hasDraft?`<details class="discard"><summary>${options.published?"放弃这次修订":"删除这份草稿"}</summary>
    <p>${options.published?"这份草稿会恢复为上次发表的版本。":"删除后，这份未发表的草稿将无法恢复。"}</p><button type="submit" formnovalidate name="intent" value="discard">确认${options.published?"放弃修订":"删除草稿"}</button></details>`:"";
  const head=options.preview?"预览"+subject:(d.revision?"编辑":"写")+subject;
  return shell(s,`<div class="manuscript"><div class="editor-nav"><a href="${path}">${s.title}</a><a href="${path}?list=drafts#entries">草稿箱</a></div>
    <form method="post" action="${path}" class="writing-form"><input type="hidden" name="id" value="${e(d.id)}"><input type="hidden" name="revision" value="${d.revision}">
    <header><p class="orbit-name">${s.body}</p><h1>${head}</h1></header>${notice}
    ${options.preview?`<div class="preview-panel"><h2>${e(d.title||"无标题")}</h2><div class="typeset">${articleBody(d.body)||"<p>还没有正文。</p>"}</div></div>`:""}
    <fieldset${options.preview?" hidden":""}><label for="title">标题</label><input id="title" name="title" maxlength="160" placeholder="${life?"这段日子在做什么":"给文章起个名字"}" value="${e(d.title)}">
       <label for="topic">${life?"记录类型":"分类（选填）"}</label>${topic}
       <label for="body">正文</label><textarea id="body" name="body" maxlength="120000" placeholder="从第一句话开始……">${e(d.body)}</textarea>
       <small>支持 Markdown 的标题、列表、引用、链接和代码块。</small></fieldset>
    <div class="editor-actions"><button type="submit" class="primary-link" name="intent" value="draft">保存草稿</button>
       <button type="submit" name="intent" value="${options.preview?"continue":"preview"}">${options.preview?"继续编辑":"预览排版"}</button>
       <button type="submit" name="intent" value="publish">${options.published?"更新已发表版本":"发表"+subject}</button></div>${confirm}</form></div>`,{compact:true,title:head});
}

