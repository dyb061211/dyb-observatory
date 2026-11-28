let dirty = false;
const leave = ev => { ev.preventDefault(); ev.returnValue = ""; };
function markDirty(on) {
  dirty = on;
  if (on) window.addEventListener("beforeunload", leave);
  else window.removeEventListener("beforeunload", leave);
}
document.addEventListener("input", ev => { if (!dirty && ev.target.closest(".writing-form")) markDirty(true); });
document.addEventListener("keydown", ev => {
  const form = ev.target.closest(".writing-form");
  if (form && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    form.requestSubmit(form.querySelector('button[value="draft"]'));
  }
});
document.addEventListener("submit", async ev => {
  const form = ev.target;
  if (!form.matches(".writing-form")) return;
  ev.preventDefault();
  if (form.getAttribute("aria-busy") === "true") return;
  const intent = ev.submitter?.value || "draft";
  const params = new URLSearchParams(new FormData(form));
  params.set("intent", intent);
  form.setAttribute("aria-busy", "true");
  let status = form.querySelector(".request-note");
  if (!status) {
    status = document.createElement("p");
    status.className = "request-note save-note";
    status.setAttribute("role", "status");
    form.querySelector(".editor-actions").after(status);
  }
  status.textContent = "正在提交…";
  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: params,
      credentials: "same-origin",
      headers: { "X-Station-Editor": "1", "Accept": "application/json, text/html" }
    });
    const mime = response.headers.get("content-type") || "";
    if (response.ok && mime.includes("application/json")) {
      const result = await response.json();
      const next = new URL(result.location, location.href);
      if (next.origin !== location.origin) throw new Error("unexpected destination");
      markDirty(false);
      location.assign(next.href);
      return;
    }
    if (mime.includes("text/html") && [200, 409, 422].includes(response.status)) {
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      const current = document.querySelector("#station-content"), incoming = doc.querySelector("#station-content");
      if (!incoming?.querySelector(".writing-form")) throw new Error("missing editor");
      current.replaceWith(incoming);
      document.title = doc.title;
      markDirty(true);
      const title = incoming.querySelector("h1");
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    status.textContent = response.status === 403 ? "保存未完成，请确认已用站主账号登录。正文仍在编辑器中。" : "保存未完成。正文仍在编辑器中，可以再次提交。";
  } catch {
    status.textContent = "连接中断，正文仍在编辑器中。网络恢复后可以再次提交。";
  } finally {
    form.removeAttribute("aria-busy");
  }
});
