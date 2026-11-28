// Serene dawn/dusk salt-flat sky & mirror water canvas.
// Automatically adapts to light/dark color mode, pauses off-screen, and respects reduced-motion.

const PALETTES = {
  light: {
    sky: [
      [0.00, "#4c6d94"],
      [0.28, "#6e89a9"],
      [0.52, "#a5b2c2"],
      [0.74, "#d7c4be"],
      [1.00, "#f0dcc7"]
    ],
    glow: "rgba(255, 240, 220, 0.56)",
    cloud: "rgba(252, 245, 238, 0.11)",
    cloudWarm: "rgba(244, 212, 194, 0.12)",
    ridgeFar: "rgba(128, 134, 152, 0.18)",
    ridgeNear: "rgba(116, 118, 134, 0.22)",
    water: [
      [0.00, "#edd8c6"],
      [0.24, "#cbbcc0"],
      [0.62, "#8b9eb7"],
      [1.00, "#5c7696"]
    ],
    shimmer: "rgba(255, 244, 232, 0.22)",
    crack: "rgba(250, 246, 238, 0.16)"
  },
  dark: {
    sky: [
      [0.00, "#0a0e16"],
      [0.36, "#121b2b"],
      [0.66, "#202838"],
      [0.88, "#312830"],
      [1.00, "#453130"]
    ],
    glow: "rgba(214, 132, 102, 0.16)",
    cloud: "rgba(176, 192, 218, 0.045)",
    cloudWarm: "rgba(196, 134, 112, 0.055)",
    ridgeFar: "rgba(16, 20, 30, 0.55)",
    ridgeNear: "rgba(12, 15, 22, 0.72)",
    water: [
      [0.00, "#3d2c2c"],
      [0.28, "#242632"],
      [0.68, "#141a27"],
      [1.00, "#0c1018"]
    ],
    shimmer: "rgba(218, 152, 122, 0.10)",
    crack: "rgba(220, 226, 238, 0.05)"
  }
};

const CLOUDS = [
  { x: 0.18, y: 0.24, rx: 0.34, ry: 0.055, speed: 0.0022, warm: false },
  { x: 0.62, y: 0.34, rx: 0.42, ry: 0.065, speed: 0.0016, warm: true },
  { x: 0.85, y: 0.48, rx: 0.36, ry: 0.048, speed: 0.0028, warm: true },
  { x: 0.38, y: 0.56, rx: 0.44, ry: 0.042, speed: 0.0013, warm: false }
];

const RIDGE_POINTS_FAR = [
  [0.00, 0.022], [0.08, 0.036], [0.16, 0.028], [0.27, 0.048], [0.39, 0.024],
  [0.52, 0.018], [0.64, 0.038], [0.76, 0.026], [0.89, 0.044], [1.00, 0.020]
];

const RIDGE_POINTS_NEAR = [
  [0.00, 0.014], [0.12, 0.020], [0.23, 0.012], [0.36, 0.025], [0.48, 0.011],
  [0.61, 0.019], [0.74, 0.010], [0.86, 0.022], [1.00, 0.013]
];

function initHorizon() {
  const stage = document.querySelector(".horizon-stage");
  const canvas = stage?.querySelector(".horizon-canvas");
  if (!stage || !(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const compact = stage.classList.contains("compact");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let mode = document.documentElement.getAttribute("data-color-mode") === "dark" ? "dark" : "light";
  let width = 0, height = 0, dpr = 1;
  let visible = true;
  let rafId = 0;
  let targetParallax = 0;
  let parallax = 0;
  const started = performance.now();

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function drawRidge(points, horizonY, scaleY, color, offsetX, flip = false) {
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let i = 0; i < points.length; i++) {
      const x = points[i][0] * width + offsetX;
      const dy = points[i][1] * scaleY * (flip ? -0.52 : 1);
      ctx.lineTo(x, horizonY - dy);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawFrame(now) {
    if (!width || !height) resize();
    const p = PALETTES[mode];
    const t = reducedMotion?.matches ? 0 : (now - started) * 0.001;
    parallax += (targetParallax - parallax) * 0.06;

    const horizonY = height * (compact ? 0.78 : 0.70);
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Atmospheric sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    for (const [stop, color] of p.sky) skyGrad.addColorStop(stop, color);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY + 1);

    // 2. Directional horizon glow
    const glowX = width * 0.72 + parallax * 0.45;
    const glowR = Math.max(width * 0.46, height * 0.9);
    const glow = ctx.createRadialGradient(glowX, horizonY, 0, glowX, horizonY, glowR);
    glow.addColorStop(0, p.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizonY + 1);

    // 3. Soft drifting cloud bands
    for (const c of CLOUDS) {
      const cx = (((c.x + t * c.speed) % 1.4) - 0.2) * width + parallax * 0.35;
      const cy = c.y * horizonY;
      const rx = c.rx * width;
      const ry = c.ry * horizonY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      cg.addColorStop(0, c.warm ? p.cloudWarm : p.cloud);
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Distant hazy mountain silhouettes
    const ridgeScale = compact ? height * 0.9 : height;
    drawRidge(RIDGE_POINTS_FAR, horizonY, ridgeScale, p.ridgeFar, parallax * 0.25, false);
    drawRidge(RIDGE_POINTS_NEAR, horizonY, ridgeScale, p.ridgeNear, parallax * 0.5, false);

    // 5. Shallow mirror salt-flat water
    const waterH = height - horizonY;
    const waterGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    for (const [stop, color] of p.water) waterGrad.addColorStop(stop, color);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, horizonY, width, waterH);

    // Reflected horizon glow on water
    const wGlow = ctx.createRadialGradient(glowX, horizonY, 0, glowX, horizonY, glowR * 0.78);
    wGlow.addColorStop(0, p.glow);
    wGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, waterH);
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = wGlow;
    ctx.fillRect(0, horizonY, width, waterH);

    // Faint mirrored ridge
    ctx.globalAlpha = 0.42;
    drawRidge(RIDGE_POINTS_NEAR, horizonY, ridgeScale, p.ridgeNear, parallax * 0.5, true);

    // Delicate breathing water shimmer bands
    ctx.globalAlpha = 1;
    const ripples = compact ? 5 : 10;
    for (let i = 0; i < ripples; i++) {
      const f = (i + 0.5) / ripples;
      const ry = horizonY + Math.pow(f, 1.45) * waterH;
      const wave = 0.45 + 0.55 * Math.sin(t * 0.45 + i * 1.15);
      const rw = width * (0.18 + 0.24 * Math.sin(i * 2.1 + 0.7) * 0.5 + 0.14);
      const rx = ((Math.sin(i * 4.3 + t * 0.04) * 0.5 + 0.5) * (width - rw)) + parallax * (0.4 + f * 0.5);
      ctx.fillStyle = p.shimmer;
      ctx.globalAlpha = (0.16 + 0.28 * (1 - f)) * wave;
      ctx.fillRect(rx, ry, rw, 1);
    }

    // Subtle salt-crust mineral lines in the lower foreground (full hero only)
    if (!compact) {
      ctx.strokeStyle = p.crack;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.75;
      const step = Math.max(95, width / 11);
      for (let x = -step; x < width + step; x += step) {
        const base = x + parallax * 0.9;
        ctx.beginPath();
        ctx.moveTo(base, horizonY + waterH * 0.46);
        ctx.lineTo(base + step * 0.42, horizonY + waterH * 0.68);
        ctx.lineTo(base - step * 0.14, height);
        ctx.moveTo(base + step * 0.42, horizonY + waterH * 0.68);
        ctx.lineTo(base + step * 1.08, horizonY + waterH * 0.78);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  function loop(now) {
    drawFrame(now);
    if (visible && !reducedMotion?.matches) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = 0;
    }
  }

  function kick() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  resize();
  kick();

  window.addEventListener("resize", () => {
    resize();
    drawFrame(performance.now());
  }, { passive: true });

  stage.addEventListener("pointermove", ev => {
    if (ev.pointerType === "touch") return;
    const norm = (ev.clientX / Math.max(1, window.innerWidth)) - 0.5;
    targetParallax = norm * 8; // Max +-4px subtle atmospheric shift
  }, { passive: true });

  const observer = new MutationObserver(() => {
    const next = document.documentElement.getAttribute("data-color-mode") === "dark" ? "dark" : "light";
    if (next !== mode) {
      mode = next;
      drawFrame(performance.now());
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !rafId && !reducedMotion?.matches) kick();
    });
    io.observe(stage);
  }
}

initHorizon();
