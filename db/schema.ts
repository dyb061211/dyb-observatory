import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const writingOwner = sqliteTable("writing_owner", {
  slot: integer("slot").primaryKey(),
  userId: text("user_id").notNull()
});

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(),
  station: text("station", { enum: ["blog", "life"] }).notNull(),
  author: text("author").notNull(),
  revision: integer("revision").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  topic: text("topic").notNull(),
  edited: integer("edited").notNull(),
  publishedTitle: text("published_title"),
  publishedBody: text("published_body"),
  publishedTopic: text("published_topic"),
  published: integer("published"),
  hasDraft: integer("has_draft", { mode: "boolean" }).notNull()
}, t => [
  index("entries_public").on(t.station, t.published),
  index("entries_drafts").on(t.author, t.station, t.hasDraft, t.edited)
]);

export const siteCopy = sqliteTable("site_copy", {
  key: text("key").primaryKey(),
  content: text("content").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const featuredProjects = sqliteTable("featured_projects", {
  id: text("id").primaryKey(),
  repoId: integer("repo_id"),
  repoName: text("repo_name").notNull(),
  name: text("name").notNull(),
  tech: text("tech").notNull(),
  detail: text("detail").notNull(),
  demoUrl: text("demo_url").notNull(),
  demoLabel: text("demo_label").notNull(),
  sortOrder: integer("sort_order").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export type FeaturedProject = typeof featuredProjects.$inferSelect;

export type PublicRepository = {
  id: number;
  name: string;
  description: string;
  language: string;
  fork: boolean;
};

export const githubPages = sqliteTable("github_repository_pages", {
  page: integer("page").primaryKey(),
  repositories: text("repositories", { mode: "json" }).$type<PublicRepository[]>().notNull(),
  hasNext: integer("has_next", { mode: "boolean" }).notNull(),
  etag: text("etag"),
  syncedAt: integer("synced_at").notNull(),
  nextCheckAt: integer("next_check_at").notNull(),
  stale: integer("stale", { mode: "boolean" }).notNull()
});
