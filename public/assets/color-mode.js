// Blocking, tiny: apply paper/study theme before first paint, then wire the toggle and reading progress.
(function () {
  var root = document.documentElement, key = "dyb-color-mode", saved = null;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  try { saved = localStorage.getItem(key); } catch (e) {}
  function syncButton(mode) {
    var toggle = document.getElementById("mode-toggle");
    if (!toggle) return;
    var dark = mode === "dark";
    if (toggle.tagName === "INPUT") {
      toggle.checked = dark;
    } else {
      toggle.setAttribute("aria-pressed", dark ? "true" : "false");
      toggle.setAttribute("title", dark ? "切换到浅色模式" : "切换到深色模式");
    }
  }
  function apply(mode) {
    root.setAttribute("data-color-mode", mode);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", mode === "dark" ? "#151413" : "#f6f3ec");
    syncButton(mode);
  }
  apply(saved === "dark" || saved === "light" ? saved : media && media.matches ? "dark" : "light");
  if (media && media.addEventListener) media.addEventListener("change", function (ev) {
    var chosen = null;
    try { chosen = localStorage.getItem(key); } catch (e) {}
    if (!chosen) apply(ev.matches ? "dark" : "light");
  });
  document.addEventListener("DOMContentLoaded", function () {
    var current = root.getAttribute("data-color-mode") || "light";
    syncButton(current);
    var toggle = document.getElementById("mode-toggle");
    if (toggle) {
      var eventName = toggle.tagName === "INPUT" ? "change" : "click";
      toggle.addEventListener(eventName, function () {
        var isDark = toggle.tagName === "INPUT"
          ? toggle.checked
          : root.getAttribute("data-color-mode") !== "dark";
        var mode = isDark ? "dark" : "light";
        apply(mode);
        try { localStorage.setItem(key, mode); } catch (e) {}
      });
    }
    var reading = document.querySelector(".blog-reading");
    if (reading && document.body) {
      var bar = document.createElement("div");
      bar.className = "reading-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.insertBefore(bar, document.body.firstChild);
      var update = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
        bar.setAttribute("data-active", window.scrollY > 40 && max > 80 ? "true" : "false");
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update, { passive: true });
    }
  });
})();
