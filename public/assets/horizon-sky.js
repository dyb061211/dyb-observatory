// Serene dawn/dusk salt-flat sky & mirror water canvas.
// Features smooth day<->night sky morphing, drifting clouds, distant birds,
// multi-layer parallax, interactive water ripples, and reduced-motion support.

const PALETTES = {
  light: {
    sky: [
      [76, 109, 148],
      [110, 137, 169],
      [165, 178, 194],
      [215, 196, 190],
      [240, 220, 199]
    ],
    glow: [255, 240, 220, 0.58],
    cloud: [252, 245, 238, 0.13],
    cloudWarm: [244, 212, 194, 0.14],
    ridgeFar: [128, 134, 152, 0.19],
    ridgeNear: [116, 118, 134, 0.24],
    bird: [56, 62, 76, 0.42],
    water: [
      [237, 216, 198],
      [203, 188, 192],
      [139, 158, 183],
      [92, 118, 150]
    ],
    shimmer: [255, 244, 232, 0.28],
    crack: [250, 246, 238, 0.18],
    ripple: [255, 248, 240, 0.42]
  },
  dark: {
    sky: [
      [10, 14, 22],
      [18, 27, 43],
      [32, 40, 56],
      [49, 40, 48],
      [69, 49, 48]
    ],
    glow: [214, 132, 102, 0.18],
    cloud: [176, 192, 218, 0.055],
    cloudWarm: [196, 134, 112, 0.065],
    ridgeFar: [16, 20, 30, 0.58],
    ridgeNear: [12, 15, 22, 0.76],
    bird: [218, 182, 164, 0.34],
    water: [
      [61, 44, 44],
      [36, 38, 50],
      [20, 26, 39],
      [12, 16, 24]
    ],
    shimmer: [218, 152, 122, 0.14],
    crack: [220, 226, 238, 0.06],
    ripple: [224, 156, 126, 0.28]
  }
};

const SKY_STOPS = [0.00, 0.28, 0.52, 0.74, 1.00];
const WATER_STOPS = [0.00, 0.24, 0.62, 1.00];

const CLOUDS = [
  { x: 0.14, y: 0.23, rx: 0.34, ry: 0.058, speed: 0.011, warm: false },
  { x: 0.58, y: 0.33, rx: 0.42, ry: 0.068, speed: 0.0085, warm: true },
  { x: 0.86, y: 0.48, rx: 0.36, ry: 0.050, speed: 0.0145, warm: true },
  { x: 0.36, y: 0.57, rx: 0.44, ry: 0.044, speed: 0.0072, warm: false }
];

const BIRDS = [
  { x: 0.16, y: 0.34, size: 5.5, speed: 0.016, vy: -0.0022, flap: 3.1, phase: 0.4 },
  { x: 0.20, y: 0.37, size: 4.5, speed: 0.015, vy: -0.0018, flap: 3.4, phase: 1.7 },
  { x: 0.24, y: 0.33, size: 4.0, speed: 0.014, vy: -0.0020, flap: 2.9, phase: 2.8 },
  { x: 0.56, y: 0.44, size: 5.0, speed: 0.012, vy: -0.0014, flap: 2.7, phase: 4.1 },
  { x: 0.61, y: 0.46, size: 3.8, speed: 0.011, vy: -0.0012, flap: 3.2, phase: 0.9 }
];

const RIDGE_POINTS_FAR = [
  [0.00, 0.022], [0.08, 0.036], [0.16, 0.028], [0.27, 0.048], [0.39, 0.024],
  [0.52, 0.018], [0.64, 0.038], [0.76, 0.026], [0.89, 0.044], [1.00, 0.020]
];

const RIDGE_POINTS_NEAR = [
  [0.00, 0.014], [0.12, 0.020], [0.23, 0.012], [0.36, 0.025], [0.48, 0.011],
  [0.61, 0.019], [0.74, 0.010], [0.86, 0.022], [1.00, 0.013]
];

function lerp(a, b, t) { return a + (b - a) * t; }

function mixRGB(a, b, t) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

function mixRGBA(a, b, t, alphaScale = 1) {
  const alpha = lerp(a[3], b[3], t) * alphaScale;
  return `rgba(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))},${alpha.toFixed(3)})`;
}

function initHorizon() {
  const stage = document.querySelector(".horizon-stage");
  const canvas = stage?.querySelector(".horizon-canvas");
  if (!stage || !(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const compact = stage.classList.contains("compact");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let targetMix = document.documentElement.getAttribute("data-color-mode") === "dark" ? 1 : 0;
  let themeMix = targetMix;
  let width = 0, height = 0, dpr = 1;
  let visible = true;
  let rafId = 0;
  let targetParallax = 0;
  let parallax = 0;
  let scrollShift = 0;
  const ripples = [];
  const started = performance.now();
  let lastTick = started;

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

  function drawBird(x, y, size, flapOffset, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - size, y + flapOffset * 0.4);
    ctx.quadraticCurveTo(x - size * 0.45, y - size * 0.35 + flapOffset, x, y);
    ctx.quadraticCurveTo(x + size * 0.45, y - size * 0.35 + flapOffset, x + size, y + flapOffset * 0.4);
    ctx.stroke();
  }

  function drawFrame(now) {
    if (!width || !height) resize();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTick) * 0.001));
    lastTick = now;

    const reduce = Boolean(reducedMotion?.matches);
    if (reduce) {
      themeMix = targetMix;
    } else if (Math.abs(targetMix - themeMix) > 0.001) {
      const step = dt / 0.7; // ~700ms day-night morph
      if (targetMix > themeMix) themeMix = Math.min(targetMix, themeMix + step);
      else themeMix = Math.max(targetMix, themeMix - step);
    } else {
      themeMix = targetMix;
    }

    const L = PALETTES.light;
    const D = PALETTES.dark;
    const m = themeMix;
    const t = reduce ? 0 : (now - started) * 0.001;
    parallax += (targetParallax - parallax) * 0.075;

    const baseHorizon = height * (compact ? 0.78 : 0.70);
    const horizonY = baseHorizon + scrollShift * (compact ? 0.25 : 0.65);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Atmospheric sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    for (let i = 0; i < SKY_STOPS.length; i++) {
      skyGrad.addColorStop(SKY_STOPS[i], mixRGB(L.sky[i], D.sky[i], m));
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY + 2);

    // 2. Breathing directional horizon glow
    const glowBreath = reduce ? 1 : (0.94 + 0.06 * Math.sin(t * 0.65));
    const glowX = width * 0.72 + parallax * 0.35;
    const glowR = Math.max(width * 0.48, height * 0.92);
    const glow = ctx.createRadialGradient(glowX, horizonY, 0, glowX, horizonY, glowR);
    glow.addColorStop(0, mixRGBA(L.glow, D.glow, m, glowBreath));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizonY + 2);

    // 3. Soft drifting cloud bands
    for (const c of CLOUDS) {
      const cx = (((c.x + t * c.speed) % 1.45) - 0.22) * width + parallax * 0.42;
      const cy = c.y * horizonY + scrollShift * 0.2;
      const rx = c.rx * width;
      const ry = c.ry * horizonY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      cg.addColorStop(0, mixRGBA(c.warm ? L.cloudWarm : L.cloud, c.warm ? D.cloudWarm : D.cloud, m));
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Distant hazy mountain silhouettes
    const ridgeScale = compact ? height * 0.9 : height;
    drawRidge(RIDGE_POINTS_FAR, horizonY, ridgeScale, mixRGBA(L.ridgeFar, D.ridgeFar, m), parallax * 0.5, false);
    drawRidge(RIDGE_POINTS_NEAR, horizonY, ridgeScale, mixRGBA(L.ridgeNear, D.ridgeNear, m), parallax * 0.8, false);

    // 5. Distant gliding birds (full hero only)
    const birdPositions = [];
    if (!compact && !reduce) {
      const birdColor = mixRGBA(L.bird, D.bird, m);
      for (const b of BIRDS) {
        const bx = (((b.x + t * b.speed) % 1.24) - 0.12) * width + parallax * 0.55;
        const by = (b.y + Math.sin(t * 0.3 + b.phase) * 0.025) * horizonY;
        const flap = Math.sin(t * b.flap + b.phase) * (b.size * 0.42);
        drawBird(bx, by, b.size, flap, birdColor);
        birdPositions.push({ bx, by, size: b.size, flap });
      }
    }

    // 6. Shallow mirror salt-flat water
    const waterH = Math.max(1, height - horizonY);
    const waterGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    for (let i = 0; i < WATER_STOPS.length; i++) {
      waterGrad.addColorStop(WATER_STOPS[i], mixRGB(L.water[i], D.water[i], m));
    }
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, horizonY, width, waterH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, waterH);
    ctx.clip();

    // Reflected horizon glow on water
    const wGlow = ctx.createRadialGradient(glowX, horizonY, 0, glowX, horizonY, glowR * 0.8);
    wGlow.addColorStop(0, mixRGBA(L.glow, D.glow, m, 0.58 * glowBreath));
    wGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wGlow;
    ctx.fillRect(0, horizonY, width, waterH);

    // Faint mirrored ridge
    ctx.globalAlpha = 0.42;
    drawRidge(RIDGE_POINTS_NEAR, horizonY, ridgeScale, mixRGBA(L.ridgeNear, D.ridgeNear, m), parallax * 0.8, true);

    // Faint reflected birds in the water
    if (birdPositions.length) {
      const mirrorBird = mixRGBA(L.bird, D.bird, m, 0.24);
      for (const b of birdPositions) {
        const my = horizonY + (horizonY - b.by) * 0.52;
        if (my < height) drawBird(b.bx, my, b.size * 0.92, -b.flap * 0.7, mirrorBird);
      }
    }

    // Flowing water shimmer bands (concentrated along sun/twilight reflection axis)
    ctx.globalAlpha = 1;
    const ripplesCount = compact ? 6 : 14;
    for (let i = 0; i < ripplesCount; i++) {
      const f = (i + 0.4) / ripplesCount;
      const ry = horizonY + Math.pow(f, 1.4) * waterH;
      const wave = reduce ? 0.7 : (0.35 + 0.65 * Math.sin(t * 0.95 + i * 1.35));
      const rw = width * (0.10 + 0.16 * (0.5 + 0.5 * Math.sin(i * 2.1)));
      const drift = Math.sin(t * 0.25 + i * 1.9) * 28;
      const centerAxis = i % 2 === 0 ? glowX : width * ((i * 0.29) % 0.85 + 0.08);
      const rx = centerAxis - rw * 0.5 + drift + parallax * (0.5 + f * 0.6);
      ctx.fillStyle = mixRGBA(L.shimmer, D.shimmer, m, (0.25 + 0.55 * (1 - f)) * wave);
      ctx.fillRect(rx, ry, rw, 1);
    }

    // Subtle salt-crust mineral lines in the lower foreground
    if (!compact) {
      ctx.strokeStyle = mixRGBA(L.crack, D.crack, m);
      ctx.lineWidth = 1;
      const step = Math.max(95, width / 11);
      for (let x = -step; x < width + step; x += step) {
        const base = x + parallax * 1.0;
        ctx.beginPath();
        ctx.moveTo(base, horizonY + waterH * 0.46);
        ctx.lineTo(base + step * 0.42, horizonY + waterH * 0.68);
        ctx.lineTo(base - step * 0.14, height);
        ctx.moveTo(base + step * 0.42, horizonY + waterH * 0.68);
        ctx.lineTo(base + step * 1.08, horizonY + waterH * 0.78);
        ctx.stroke();
      }
    }

    // Interactive expanding water ripples on click
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = (now - rp.start) * 0.001;
      if (age > 2.2) {
        ripples.splice(i, 1);
        continue;
      }
      const p = age / 2.2;
      const ease = 1 - Math.pow(1 - p, 3);
      const fade = (1 - p) * (1 - p);
      ctx.strokeStyle = mixRGBA(L.ripple, D.ripple, m, fade);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rp.x + parallax * 0.8, rp.y, 10 + ease * 88, 2 + ease * 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (age > 0.22) {
        const p2 = (age - 0.22) / 1.98;
        const ease2 = 1 - Math.pow(1 - p2, 3);
        ctx.strokeStyle = mixRGBA(L.ripple, D.ripple, m, (1 - p2) * 0.6);
        ctx.beginPath();
        ctx.ellipse(rp.x + parallax * 0.8, rp.y, 6 + ease2 * 64, 1.5 + ease2 * 9.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  function needsMoreFrames() {
    const morphing = Math.abs(targetMix - themeMix) > 0.001;
    const hasRipples = ripples.length > 0;
    return morphing || hasRipples || (visible && !reducedMotion?.matches);
  }

  function loop(now) {
    drawFrame(now);
    if (needsMoreFrames()) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = 0;
    }
  }

  function kick() {
    if (!rafId) {
      lastTick = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  resize();
  kick();

  window.addEventListener("resize", () => {
    resize();
    drawFrame(performance.now());
  }, { passive: true });

  window.addEventListener("pointermove", ev => {
    if (ev.pointerType === "touch") return;
    const norm = (ev.clientX / Math.max(1, window.innerWidth)) - 0.5;
    targetParallax = norm * 20; // Up to +-10px layered parallax
  }, { passive: true });

  window.addEventListener("scroll", () => {
    scrollShift = Math.min(28, Math.max(0, window.scrollY * 0.08));
    if (!visible && Math.abs(targetMix - themeMix) <= 0.001) return;
    if (!rafId) drawFrame(performance.now());
  }, { passive: true });

  stage.addEventListener("click", ev => {
    if (reducedMotion?.matches) return;
    if (ev.target instanceof Element && ev.target.closest("a, button")) return;
    const rect = stage.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const rawY = ev.clientY - rect.top;
    const horizonY = height * (compact ? 0.78 : 0.70);
    const y = Math.max(horizonY + 8, Math.min(height - 10, rawY));
    ripples.push({ x, y, start: performance.now() });
    kick();
  });

  const observer = new MutationObserver(() => {
    const next = document.documentElement.getAttribute("data-color-mode") === "dark" ? 1 : 0;
    if (next !== targetMix) {
      targetMix = next;
      kick();
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
