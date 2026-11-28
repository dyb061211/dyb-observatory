// Blocking, tiny: apply paper/study theme before first paint, then wire toggle, reading progress, and scroll reveals.
(function () {
  var root = document.documentElement, key = "dyb-color-mode", saved = null;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
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
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", mode === "dark" ? "#0b0f18" : "#4e6f95");
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
        toggle.classList.remove("is-turning");
        void toggle.offsetWidth;
        toggle.classList.add("is-turning");
        setTimeout(function () { toggle.classList.remove("is-turning"); }, 450);
      });
    }

    var reading = document.querySelector(".blog-reading");
    if (reading && document.body) {
      var bar = document.createElement("div");
      bar.className = "reading-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.insertBefore(bar, document.body.firstChild);
      var updateBar = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
        bar.setAttribute("data-active", window.scrollY > 40 && max > 80 ? "true" : "false");
      };
      updateBar();
      window.addEventListener("scroll", updateBar, { passive: true });
      window.addEventListener("resize", updateBar, { passive: true });
    }

    if (!reduced || !reduced.matches) {
      if ("IntersectionObserver" in window) {
        var targets = document.querySelectorAll(
          ".blog-section, .folio-card, .project-card, .blog-prose > h2, .blog-prose > h3, .blog-prose > blockquote, .blog-prose > pre, .blog-prose > .note-example, .blog-prose > .sample, .blog-prose > .source-group"
        );
        var pending = [];
        var cutoff = window.innerHeight * 0.94;
        for (var j = 0; j < targets.length; j++) {
          var el = targets[j];
          if (el.getBoundingClientRect().top > cutoff) {
            el.setAttribute("data-reveal", "pending");
            pending.push(el);
          }
        }
        if (pending.length) {
          var reveal = function (node) {
            node.setAttribute("data-reveal", "visible");
          };
          var io = new IntersectionObserver(function (entries) {
            for (var k = 0; k < entries.length; k++) {
              if (entries[k].isIntersecting) {
                reveal(entries[k].target);
                io.unobserve(entries[k].target);
              }
            }
          }, { rootMargin: "0px 0px -24px 0px", threshold: 0.04 });
          for (var p = 0; p < pending.length; p++) io.observe(pending[p]);
          var sweepBottom = function () {
            var doc = document.documentElement;
            if (window.scrollY + window.innerHeight >= doc.scrollHeight - 16) {
              for (var q = 0; q < pending.length; q++) {
                if (pending[q].getAttribute("data-reveal") === "pending") {
                  reveal(pending[q]);
                  io.unobserve(pending[q]);
                }
              }
            }
          };
          window.addEventListener("scroll", sweepBottom, { passive: true });
        }
      }
    }
  });
})();
