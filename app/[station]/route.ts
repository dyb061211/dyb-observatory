import { checkDraft, discardDraft, draftFrom, editorId, findAuthorEntry, findPublishedEntry, listEntries, newDraft, saveEntry, uuid } from "../../lib/entries";
import { projects, profile, reserve, shell } from "../../lib/interiors";
import { getRepositoryPage, repositoryPageNumber } from "../../lib/repositories";
import { repositorySection } from "../../public/assets/github-catalog.js";
import initialRepositoryPage from "../../lib/initial-repository-page.json";
import { editor, reader, writingIndex } from "../../lib/writing-view";
import { stations, html, type Station } from "../../lib/stations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ station:string }> };
function missing(s?: Station) {
  return html(s ? shell(s,`<div class="manuscript"><h1>找不到这篇记录</h1><a class="plain-link" href="/${s.slug}">回到${s.title}</a></div>`,{compact:true})
    : '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>找不到这处坐标</title><h1>找不到这处坐标</h1><a href="/">返回星图</a></html>',404);
}
function redirect(location:string) {
  return new Response(null,{status:303,headers:{location,"cache-control":"private, no-store"}});
}
export async function GET(request: Request, context: Context) {
  const {station}=await context.params;
  if(station==="index.html") return redirect("/");
  const s = stations.find(t=>t.slug===station);
  if(!s) return missing();
  const query = new URL(request.url).searchParams;
  if (s.slug === "projects") {
    const result = await getRepositoryPage(repositoryPageNumber(query.get("page")));
    const snapshot = result.page === 1 && !result.syncedAt ? { ...result, ...initialRepositoryPage } : result;
    const list = repositorySection(snapshot);
    return html(query.get("view") === "repositories" ? list : shell(s, projects(list)));
  }
  if(s.slug==="profile")return html(shell(s,profile()));
  if(s.slug==="reserve")return html(shell(s,reserve()));
  const author = await editorId();
  const edit=query.get("edit"), read=query.get("read");
  if(edit) {
    if(!author) return missing(s);
    const draft=edit==="new"?newDraft(s.slug):uuid.test(edit)?await findAuthorEntry(s.slug,edit,author):null;
    if(!draft) return missing(s);
    if(edit==="new"&&s.slug==="life"&&query.get("topic")==="经历")draft.topic="经历";
    return html(editor(s,draft,{saved:query.get("saved")==="1"&&draft.revision>0,hasDraft:"hasDraft" in draft && !!draft.hasDraft,published:"published" in draft&&!!draft.published}));
  }
  if(read) {
    const row=uuid.test(read)?await findPublishedEntry(s.slug,read):null;
    if(!row || row.published===null) return missing(s);
    return html(reader(s,{id:row.id,title:row.title!,body:row.body!,topic:row.topic!,date:row.published},author===row.author));
  }
  const drafts=query.get("list")==="drafts";
  if(drafts&&!author)return missing(s);
  const page=Math.min(100000,Math.max(0,Math.floor(Number(query.get("page"))||0)));
  const records=await listEntries(s.slug,drafts?author:null,page);
  return html(writingIndex(s,records,author,drafts,page));
}
export async function POST(request: Request, context: Context) {
  const {station}=await context.params;
  const s=stations.find(t=>t.slug===station);
  if(!s || (s.slug!=="blog"&&s.slug!=="life"))return missing();
  const author=await editorId();
  if(!author)return new Response("需要站主身份。",{status:403});
  if(request.headers.get("origin")!==new URL(request.url).origin) return new Response("无法验证表单来源。",{status:403});
  if(Number(request.headers.get("content-length"))>1600000)return new Response("正文超过长度限制。",{status:413});
  const type=request.headers.get("content-type")||"";
  if(!type.startsWith("application/x-www-form-urlencoded"))return new Response("表单格式无效。",{status:415});
  const form=await request.formData(), d=draftFrom(form), intent=form.get("intent");
  if(!["draft","publish","preview","continue","discard"].includes(String(intent)))return new Response("未知操作。",{status:400});
  const current=d.revision&&uuid.test(d.id)?await findAuthorEntry(s.slug,d.id,author):null;
  const options={hasDraft:!!current?.hasDraft,published:!!current?.published};
  if(intent==="preview"||intent==="continue") return html(editor(s,d,{...options,preview:intent==="preview"}));
  const err=checkDraft(d,intent==="publish",s.slug);
  if(err&&intent!=="discard")return html(editor(s,d,{...options,error:err}),422);
  const ok=intent==="discard"?await discardDraft(s.slug,author,d.id,d.revision):await saveEntry(s.slug,author,d,intent==="publish");
  if(!ok)return html(editor(s,d,{...options,error:"另一个页面已经改过这条记录。你刚输入的内容还在下方，可以复制后从草稿箱重新打开最新版本。"}),409);
  const location=`/${s.slug}`+(intent==="discard"?"?list=drafts#entries":intent==="publish"?"?read="+d.id:"?edit="+d.id+"&saved=1");
  return request.headers.get("x-station-editor")==="1"
    ? Response.json({location},{headers:{"cache-control":"private, no-store"}}) : redirect(location);
}

