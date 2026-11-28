// Blocking, tiny: pick the light or dark paper before the first paint, then wire the switch.
(function () {
  var root = document.documentElement, key = "dyb-color-mode", saved = null;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  try { saved = localStorage.getItem(key); } catch (e) {}
  function apply(mode) {
    root.setAttribute("data-color-mode", mode);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", mode === "dark" ? "#1f1e1d" : "#f0eee6");
    var toggle = document.getElementById("mode-toggle");
    if (toggle) toggle.checked = mode === "dark";
  }
  apply(saved === "dark" || saved === "light" ? saved : media && media.matches ? "dark" : "light");
  if (media && media.addEventListener) media.addEventListener("change", function (ev) {
    var chosen = null;
    try { chosen = localStorage.getItem(key); } catch (e) {}
    if (!chosen) apply(ev.matches ? "dark" : "light");
  });
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("mode-toggle");
    if (!toggle) return;
    toggle.checked = root.getAttribute("data-color-mode") === "dark";
    toggle.addEventListener("change", function () {
      var mode = toggle.checked ? "dark" : "light";
      apply(mode);
      try { localStorage.setItem(key, mode); } catch (e) {}
    });
  });
})();
