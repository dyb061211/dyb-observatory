import { env } from "cloudflare:workers";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { entries, writingOwner } from "../db/schema";
import type { WritingStation } from "./stations";

export type Entry = typeof entries.$inferSelect;
export type Draft = Pick<Entry, "id" | "revision" | "title" | "topic" | "body">;
export const pageSize = 18;
export async function editorId() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (import.meta.env.DEV && user.userId === "local_seedy") return user.userId;
  const db = getDb();
  const owner = () => db.select({ id: writingOwner.userId }).from(writingOwner)
    .where(eq(writingOwner.slot, 1)).get();
  let bound = await owner();
  if (!bound) {
    // Enroll the verified owner on the private site. Later sign-ins use only the stable site identity.
    const email = env.STATION_OWNER_EMAIL?.trim().toLowerCase();
    if (!email || user.email.trim().toLowerCase() !== email) return null;
    await db.insert(writingOwner).values({ slot: 1, userId: user.userId }).onConflictDoNothing();
    bound = await owner();
  }
  return bound?.id === user.userId ? user.userId : null;
}
export function findAuthorEntry(station: WritingStation, id: string, author: string) {
  return getDb().select().from(entries)
    .where(and(eq(entries.id,id),eq(entries.station,station),eq(entries.author,author))).get();
}
export function findPublishedEntry(station: WritingStation, id: string) {
  return getDb().select({
    id: entries.id, author: entries.author, published: entries.published,
    title: entries.publishedTitle, topic: entries.publishedTopic, body: entries.publishedBody
  }).from(entries)
    .where(and(eq(entries.id,id),eq(entries.station,station),isNotNull(entries.published))).get();
}
export function listEntries(station: WritingStation, draftAuthor: string | null, page: number) {
  const draft = Boolean(draftAuthor);
  return getDb().select({
    id: entries.id, title: draft ? entries.title : entries.publishedTitle,
    topic: draft ? entries.topic : entries.publishedTopic, date: draft ? entries.edited : entries.published,
    wasPublished: entries.published
  }).from(entries).where(and(eq(entries.station,station),draftAuthor
    ? and(eq(entries.author,draftAuthor),eq(entries.hasDraft,true))
    : isNotNull(entries.published)))
    .orderBy(desc(draft ? entries.edited : entries.published), desc(entries.id)).limit(pageSize+1).offset(page*pageSize);
}
export function newDraft(station: WritingStation): Draft {
  return { id:crypto.randomUUID(), revision:0, title:"", body:"", topic:station === "life" ? "近况" : "" };
}
export function draftFrom(form: FormData): Draft {
  const value = (field: string) => String(form.get(field) ?? "");
  return { id:value("id"), revision:Number(value("revision")), title:value("title").trim(), topic:value("topic").trim(), body:value("body").replace(/\r\n?/g,"\n") };
}
export const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
export function checkDraft(d: Draft, publish: boolean, station: WritingStation) {
  if (!uuid.test(d.id) || !Number.isSafeInteger(d.revision) || d.revision < 0) return "编辑信息无效，请重新打开编辑器。";
  if (d.title.length > 160 || d.topic.length > 40 || d.body.length > 120000) return "标题最多 160 字，分类最多 40 字，正文最多 12 万字。";
  if (station === "life" && !["经历","近况"].includes(d.topic)) return "请选择记录类型。";
  if (!d.title && !d.body.trim()) return "先写一个标题或一段正文，再保存草稿。";
  if (publish && (!d.title || !d.body.trim())) return "发表前需要填写标题和正文。";
  return null;
}
export async function saveEntry(station: WritingStation, author: string, d: Draft, publish: boolean) {
  const db = getDb(), now = Date.now();
  const fields = {
    title:d.title, topic:d.topic, body:d.body, edited:now, revision:d.revision+1, hasDraft:!publish,
    ...(publish ? {published:now, publishedTitle:d.title, publishedBody:d.body, publishedTopic:d.topic} : {})
  };
  const written = d.revision === 0
    ? await db.insert(entries).values({ ...fields, id:d.id, station, author }).onConflictDoNothing().returning({id:entries.id})
    : await db.update(entries).set(fields).where(and(eq(entries.id,d.id),eq(entries.station,station),
      eq(entries.author,author),eq(entries.revision,d.revision))).returning({id:entries.id});
  if (written.length) return true;
  // A retry after an interrupted redirect may refer to the write just completed.
  const existing = await findAuthorEntry(station,d.id,author);
  return existing && existing.revision===d.revision+1 && existing.body===d.body && existing.title===d.title
    && existing.topic===d.topic && existing.hasDraft===!publish;
}
export async function discardDraft(station: WritingStation, author: string, id: string, revision: number) {
  const row = await findAuthorEntry(station,id,author);
  if (!row || row.revision!==revision || !row.hasDraft) return false;
  const where=and(eq(entries.id,id),eq(entries.author,author),eq(entries.station,station),eq(entries.revision,revision));
  const db=getDb();
  const changed = row.published === null
    ? await db.delete(entries).where(and(where,isNull(entries.published))).returning({id:entries.id})
    : await db.update(entries).set({title:row.publishedTitle!,topic:row.publishedTopic!,body:row.publishedBody!,
        edited:Date.now(),revision:revision+1,hasDraft:false}).where(where).returning({id:entries.id});
  return changed.length === 1;
}

