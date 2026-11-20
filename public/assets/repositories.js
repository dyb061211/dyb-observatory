import { emptyPage, refreshPage } from "./github-api.js";
import { repositorySection } from "./github-catalog.js?v=9";

const section = document.getElementById("repositories");
const page = Number(section.dataset.page);
const storageKey = "dyb-public-github-v1/" + page;
const endpoint = new URL("/projects", location.origin);
endpoint.search = new URLSearchParams({ view: "repositories", page: section.dataset.page });
let devicePage = emptyPage(page);
function latestDevicePage() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.page === page && Array.isArray(saved.repositories) && Number.isFinite(saved.syncedAt)
        && Number.isFinite(saved.nextCheckAt) && saved.nextCheckAt >= devicePage.nextCheckAt) devicePage = saved;
  } catch {}
  return devicePage;
}
let firstCheck = true;
let nextCheck = section.dataset.stale === "true" || latestDevicePage().syncedAt > Number(section.dataset.syncedAt)
  ? Date.now() : Date.now() + Number(section.dataset.refreshIn);
let timer;
let checking = false;

function parseSection(markup) {
  const incoming = new DOMParser().parseFromString(markup, "text/html").getElementById("repositories");
  if (!incoming || incoming.dataset.page !== section.dataset.page) throw new Error("Unexpected repository page");
  return incoming;
}

async function serverSection() {
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Repository refresh unavailable");
    return parseSection(await response.text());
  } catch {
    const last = section.cloneNode(true);
    last.dataset.stale = "true";
    last.dataset.refreshIn = "60000";
    last.querySelector(".repo-sync").textContent = "列表暂时无法刷新，连接恢复后会自动重试。";
    return last;
  }
}

async function resolveSection(server) {
  let saved = latestDevicePage();
  if (server.dataset.stale !== "true") {
    return !saved.stale && saved.nextCheckAt > Date.now() && saved.syncedAt > Number(server.dataset.syncedAt)
      ? parseSection(repositorySection(saved)) : server;
  }
  // The public API also supports anonymous CORS reads from a visitor's browser.
  if (saved.nextCheckAt <= Date.now()) {
    saved = devicePage = await refreshPage(saved, Date.now(), "browser");
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
  }
  if (saved.syncedAt && (!saved.stale || saved.syncedAt >= Number(server.dataset.syncedAt))) {
    return parseSection(repositorySection(saved));
  }
  const delay = Math.min(Number(server.dataset.refreshIn), saved.nextCheckAt - Date.now());
  server.dataset.refreshIn = String(Math.max(1000, delay));
  return server;
}

function schedule() {
  clearTimeout(timer);
  if (!document.hidden && !checking) {
    timer = setTimeout(refresh, Math.max(0, nextCheck - Date.now()));
  }
}

async function refresh() {
  if (document.hidden || checking) return;
  checking = true;
  try {
    const useInitial = firstCheck && (section.dataset.stale === "true" || latestDevicePage().nextCheckAt > Date.now());
    firstCheck = false;
    const incoming = await resolveSection(useInitial ? section.cloneNode(true) : await serverSection());
    if (incoming.innerHTML !== section.innerHTML) {
      const focused = section.contains(document.activeElement) ? document.activeElement.closest("a")?.href : null;
      section.replaceChildren(...incoming.childNodes);
      if (focused) Array.from(section.querySelectorAll("a")).find(a => a.href === focused)?.focus({ preventScroll: true });
    }
    Object.assign(section.dataset, incoming.dataset);
    nextCheck = Date.now() + Number(incoming.dataset.refreshIn);
  } catch {
    section.querySelector(".repo-sync").textContent = "列表暂时无法刷新，连接恢复后会自动重试。";
    nextCheck = Date.now() + 60_000;
  } finally {
    checking = false;
    schedule();
  }
}

document.addEventListener("visibilitychange", schedule);
window.addEventListener("pageshow", schedule);
window.addEventListener("online", () => { nextCheck = Date.now(); schedule(); });
schedule();
