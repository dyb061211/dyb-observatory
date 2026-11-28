import { escapeHTML as e } from "./escape-html.js";
import { githubProfile as git } from "./github-api.js";

const repositoryLabels = new Map([
  ["java-backend-learning", "Java 后端学习"], ["python-backend-learning", "Python 后端学习"],
  ["gigab2b-local-product-library", "本地商品资料库"], ["humanizer-zh", "中文写作工具"], ["shadowrocket-rules", "Shadowrocket 规则"]
]);

/**
 * @param {import("../../lib/repositories").RepositoryPage} snapshot
 * @param {{ featuredRepos?: string[]; canEdit?: boolean }} [options]
 */
export function repositorySection(snapshot, options = {}) {
  const { page, repositories, hasNext, stale, syncedAt } = snapshot;
  const featuredRepos = Array.isArray(options.featuredRepos) ? options.featuredRepos : [];
  const canEdit = Boolean(options.canEdit);
  const featuredSet = new Set(featuredRepos.map(name => name.toLowerCase()));
  const visible = repositories.filter(repo => !featuredSet.has(repo.name.toLowerCase()));
  const rows = visible.map(repo => {
    const label = repositoryLabels.get(repo.name);
    const description = !label && repo.description ? `<p class="repo-desc">${e(repo.description)}</p>` : "";
    const fork = repo.fork ? '<span class="repo-fork">Fork</span>' : "";
    const meta = e(label ? repo.name : repo.language);
    const pick = canEdit ? `<a class="repo-pick" href="/projects?edit=new&amp;repo=${encodeURIComponent(repo.name)}">+ 设为精选</a>` : "";
    return `<li><div class="repo-main"><a href="${git}/${encodeURIComponent(repo.name)}" target="_blank" rel="noopener noreferrer">${e(label || repo.name)}</a>${fork}${description}</div><div class="repo-aside">${meta ? `<span class="repo-meta">${meta}</span>` : ""}${pick}</div></li>`;
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
  return `<section class="blog-section" id="repositories" aria-labelledby="repositories-title" data-page="${page}" data-stale="${stale}" data-synced-at="${syncedAt}" data-refresh-in="${Math.max(1000, snapshot.nextCheckAt - Date.now())}" data-featured="${e(JSON.stringify(featuredRepos))}" data-can-edit="${canEdit}">
    <div class="blog-section-head"><h2 id="repositories-title">更多仓库</h2><p class="repo-sync" role="status">${status}</p></div>
    ${rows ? `<ul class="repo-list">${rows}</ul>` : `<p class="empty-line">${empty}</p>`}${pages}</section>`;
}
