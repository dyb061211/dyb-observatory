import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { featuredProjects, githubPages, siteCopy, type FeaturedProject, type PublicRepository } from "../db/schema";
import { uuid } from "./entries";
import initialRepositoryPage from "./initial-repository-page.json";

export const copyDefaults = {
  home_intro: "我是 DYB，在读软件工程，平时写一些日常用得上的小工具。这里写下做项目时遇见的问题，也留些地方给随笔。",
  about_intro: "我是 DYB，在读软件工程，平时写一些日常用得上的小工具。主要接触 Java 后端、Python 数据处理和一些 AI 应用，欢迎随时写信聊聊。",
  projects_intro: "从一张商品表到一个桌面工具，这里收录写过的小项目与公开仓库。",
  life_intro: "软件工程在读，最近在学 Java 后端，也在做 Python 和 AI 小工具。",
  footer_note: "DYB · 写于日常与代码之间"
} as const;

export type SiteCopyKey = keyof typeof copyDefaults;
export type SiteCopyMap = Record<SiteCopyKey, string>;

export const defaultFeaturedProjects: FeaturedProject[] = [
  {
    id: "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
    repoId: 1346997599,
    repoName: "product-normalizer",
    name: "Product Normalizer",
    tech: "Python · Pandas",
    detail: "把条码和商品资料按 SKU 对齐，保留前导零，导出标准 Excel 和校验报告。",
    demoUrl: "/projects/product-normalizer.html",
    demoLabel: "数据清洗示例",
    sortOrder: 10,
    updatedAt: 1760000000000
  },
  {
    id: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
    repoId: 1344840291,
    repoName: "walmart-listing-agent",
    name: "Walmart Listing 智能体",
    tech: "桌面工具 · Coze",
    detail: "从原始货盘整理英文文案和商品图，录入 ERP 前可以逐项审核。",
    demoUrl: "/projects/walmart-listing.html",
    demoLabel: "查看工作流程",
    sortOrder: 20,
    updatedAt: 1760000000000
  }
];

export function isSiteCopyKey(key: string): key is SiteCopyKey {
  return Object.prototype.hasOwnProperty.call(copyDefaults, key);
}

export async function getSiteCopyMap(): Promise<SiteCopyMap> {
  const result: SiteCopyMap = { ...copyDefaults };
  try {
    const rows = await getDb().select().from(siteCopy);
    for (const row of rows) {
      if (isSiteCopyKey(row.key) && row.content.trim()) {
        result[row.key] = row.content;
      }
    }
  } catch {
    // Fall back gracefully if the CMS table has not been migrated yet.
  }
  return result;
}

export async function saveSiteCopy(key: SiteCopyKey, rawContent: string): Promise<string | null> {
  const content = rawContent.replace(/\r\n?/g, "\n").trim();
  if (content.length > 2000) return "简介文案最多 2000 字。";
  const db = getDb();
  if (!content) {
    await db.delete(siteCopy).where(eq(siteCopy.key, key));
    return null;
  }
  const now = Date.now();
  await db.insert(siteCopy).values({ key, content, updatedAt: now })
    .onConflictDoUpdate({ target: siteCopy.key, set: { content, updatedAt: now } });
  return null;
}

export async function listFeaturedProjects(): Promise<FeaturedProject[]> {
  try {
    return await getDb().select().from(featuredProjects)
      .orderBy(asc(featuredProjects.sortOrder), desc(featuredProjects.updatedAt));
  } catch {
    return defaultFeaturedProjects;
  }
}

export async function findFeaturedProject(id: string): Promise<FeaturedProject | undefined> {
  if (!uuid.test(id)) return undefined;
  return getDb().select().from(featuredProjects).where(eq(featuredProjects.id, id)).get();
}

export type ProjectInput = {
  id: string;
  repoId: number | null;
  repoName: string;
  name: string;
  tech: string;
  detail: string;
  demoUrl: string;
  demoLabel: string;
  sortOrder: number;
};

export function projectFromForm(form: FormData): ProjectInput {
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const repoIdRaw = str("repoId");
  const parsedRepoId = repoIdRaw && /^\d+$/.test(repoIdRaw) ? Number(repoIdRaw) : null;
  const sortRaw = Number(str("sortOrder"));
  return {
    id: str("id"),
    repoId: parsedRepoId,
    repoName: str("repoName"),
    name: str("name"),
    tech: str("tech"),
    detail: str("detail").replace(/\r\n?/g, "\n"),
    demoUrl: str("demoUrl"),
    demoLabel: str("demoLabel"),
    sortOrder: Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0
  };
}

export function checkFeaturedProject(input: ProjectInput): string | null {
  if (!uuid.test(input.id)) return "项目编号无效，请重新打开编辑页面。";
  if (!input.repoName || input.repoName.length > 100 || !/^[\w.-]+$/.test(input.repoName)) return "请选择一个有效的 GitHub 仓库。";
  if (!input.name || input.name.length > 100) return "项目名称必填，且最多 100 字。";
  if (input.tech.length > 60) return "技术标签最多 60 字。";
  if (!input.detail || input.detail.length > 600) return "项目介绍必填，且最多 600 字。";
  if (input.demoUrl) {
    if (input.demoUrl.length > 300) return "演示链接最多 300 字符。";
    const safeRelative = input.demoUrl.startsWith("/") && !input.demoUrl.startsWith("//");
    const safeHttp = /^https?:\/\/\S+$/i.test(input.demoUrl);
    if (!safeRelative && !safeHttp) return "演示链接仅支持站内路径（以 / 开头）或 http(s):// 网址。";
  }
  if (input.demoLabel.length > 40) return "演示按钮文案最多 40 字。";
  if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < -999 || input.sortOrder > 9999) return "排序数字需在 -999 到 9999 之间。";
  return null;
}

export async function saveFeaturedProject(input: ProjectInput): Promise<void> {
  const now = Date.now();
  await getDb().insert(featuredProjects).values({
    id: input.id,
    repoId: input.repoId,
    repoName: input.repoName,
    name: input.name,
    tech: input.tech,
    detail: input.detail,
    demoUrl: input.demoUrl,
    demoLabel: input.demoLabel,
    sortOrder: input.sortOrder,
    updatedAt: now
  }).onConflictDoUpdate({
    target: featuredProjects.id,
    set: {
      repoId: input.repoId,
      repoName: input.repoName,
      name: input.name,
      tech: input.tech,
      detail: input.detail,
      demoUrl: input.demoUrl,
      demoLabel: input.demoLabel,
      sortOrder: input.sortOrder,
      updatedAt: now
    }
  });
}

export async function deleteFeaturedProject(id: string): Promise<boolean> {
  if (!uuid.test(id)) return false;
  const deleted = await getDb().delete(featuredProjects)
    .where(eq(featuredProjects.id, id))
    .returning({ id: featuredProjects.id });
  return deleted.length === 1;
}

export async function listAllSyncedRepos(): Promise<PublicRepository[]> {
  const seen = new Set<string>();
  const combined: PublicRepository[] = [];
  const pushRepo = (repo: PublicRepository) => {
    const key = repo.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(repo);
    }
  };
  try {
    const pages = await getDb().select().from(githubPages).orderBy(asc(githubPages.page));
    for (const p of pages) {
      if (Array.isArray(p.repositories)) {
        for (const repo of p.repositories) pushRepo(repo);
      }
    }
  } catch {
    // Ignore DB errors and fall back to bundled initial snapshot.
  }
  for (const repo of initialRepositoryPage.repositories as PublicRepository[]) {
    pushRepo(repo);
  }
  return combined;
}
