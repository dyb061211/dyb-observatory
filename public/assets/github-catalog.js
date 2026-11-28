import { escapeHTML as e } from "./escape-html.js";
import { githubProfile as git } from "./github-api.js";

export const featuredProjects = [
  { id: 1346997599, repo: "product-normalizer", name: "Product Normalizer", tech: "Python · Pandas",
    detail: "把条码和商品资料按 SKU 对齐，保留前导零，导出标准 Excel 和校验报告。", demo: "数据清洗示例", file: "product-normalizer.html", style: "data" },
  { id: 1344840291, repo: "walmart-listing-agent", name: "Walmart Listing 智能体", tech: "桌面工具 · Coze",
    detail: "从原始货盘整理英文文案和商品图，录入 ERP 前可以逐项审核。", demo: "查看工作流程", file: "walmart-listing.html", style: "listing" }
];
const repositoryLabels = new Map([
  ["java-backend-learning", "Java 后端学习"], ["python-backend-learning", "Python 后端学习"],
  ["gigab2b-local-product-library", "本地商品资料库"], ["humanizer-zh", "中文写作工具"], ["shadowrocket-rules", "Shadowrocket 规则"]
]);

/** @param {import("../../lib/repositories").RepositoryPage} snapshot */
export function repositorySection(snapshot) {
  const { page, repositories, hasNext, stale, syncedAt } = snapshot;
  const visible = repositories.filter(repo => !featuredProjects.some(project => project.id === repo.id));
  const rows = visible.map(repo => {
    const label = repositoryLabels.get(repo.name);
    const description = !label && repo.description ? `<p class="repo-desc">${e(repo.description)}</p>` : "";
    const fork = repo.fork ? '<span class="repo-fork">Fork</span>' : "";
    const meta = e(label ? repo.name : repo.language);
    return `<li><div class="repo-main"><a href="${git}/${encodeURIComponent(repo.name)}" target="_blank" rel="noopener noreferrer">${e(label || repo.name)}</a>${fork}${description}</div>${meta ? `<span class="repo-meta">${meta}</span>` : ""}</li>`;
  }).join("");
  let status = "";
  if (stale && syncedAt) {
    const stamp = new Date(syncedAt).toISOString();
    status = `GitHub 暂时连接不上，显示 <time datetime="${stamp}">${stamp.slice(0, 16).replace("T", " ")} UTC</time> 的记录。`;
  } else if (stale) status = "GitHub 暂时连接不上，稍后会自动重试。";
  const empty = stale && !syncedAt ? `<a class="plain-link" href="${git}?tab=repositories" target="_blank" rel="noopener noreferrer">在 GitHub 查看公开仓库</a>`
    : "这一页没有其他公开仓库。";
  const pageLink = (n, text) => `<a href="/projects${n === 1 ? "" : `?page=${n}`}#repositories">${text}</a>`;
  const pages = page > 1 || hasNext ? `<nav class="pagination" aria-label="仓库翻页">${page > 1 ? pageLink(page - 1, "← 上一页") : ""}${hasNext ? pageLink(page + 1, "下一页 →") : ""}</nav>` : "";
  const count = visible.length ? `<span class="section-count">${String(visible.length).padStart(2, "0")}</span>` : "";
  return `<section class="blog-section" id="repositories" aria-labelledby="repositories-title" data-page="${page}" data-stale="${stale}" data-synced-at="${syncedAt}" data-refresh-in="${Math.max(1000, snapshot.nextCheckAt - Date.now())}">
    <div class="blog-section-head"><div class="blog-section-title"><h2 id="repositories-title">更多仓库</h2>${count}</div><p class="repo-sync" role="status">${status}</p></div>
    ${rows ? `<ul class="repo-list">${rows}</ul>` : `<p class="empty-line">${empty}</p>`}${pages}</section>`;
}
