async function loadRenderer(art) {
  if (art.dataset.body !== "blackhole") {
    const { createStationGalaxy } = await import("./station-galaxy.js?v=8.0");
    return createStationGalaxy(art);
  }
  const { createHorizonCanvas, loadHorizon } = await import("./horizon.js?v=3.1");
  const render = createHorizonCanvas(await loadHorizon());
  const canvas = art.querySelector("canvas"), ctx = canvas.getContext("2d");
  return {
    draw(time) {
      const frame = render(time);
      if (canvas.width !== frame.width || canvas.height !== frame.height) {
        canvas.width = frame.width;
        canvas.height = frame.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0);
    }
  };
}

export function startStationMotion(art) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const frameInterval = art.dataset.body === "blackhole" ? 67 : 1000/30;
  let inView = !("IntersectionObserver" in window);
  let renderer, pending = false, disabled = false, frameId = 0, lastFrame = null, elapsed = 0;

  function frame(now) {
    frameId = 0;
    if (lastFrame === null || now-lastFrame >= frameInterval-1) {
      if (lastFrame !== null) elapsed += Math.min(.2, (now-lastFrame)/1000);
      lastFrame = now;
      renderer.draw(elapsed);
      art.classList.add("has-motion");
    }
    frameId = requestAnimationFrame(frame);
  }
  function sync() {
    if (disabled || reduced.matches || !inView || document.hidden) {
      cancelAnimationFrame(frameId); frameId = 0; lastFrame = null;
      return;
    }
    if (renderer) {
      if (!frameId) frameId = requestAnimationFrame(frame);
    } else if (!pending) {
      pending = true;
      loadRenderer(art).then(value => {
        renderer = value;
        renderer.resize?.();
        sync();
      }).catch(() => {
        disabled = true;
        art.classList.remove("has-motion");
      });
    }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(art);
  }
  new ResizeObserver(() => {
    if (!renderer?.resize) return;
    renderer.resize();
    if (inView && !document.hidden && art.classList.contains("has-motion")) renderer.draw(elapsed);
  }).observe(art);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pageshow", sync);
  reduced.addEventListener("change", sync);
  sync();
}
