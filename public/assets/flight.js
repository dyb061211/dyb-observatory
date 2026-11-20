import { bodies, END, limit, smooth, makeView, cameraAt, basisAt, worldPoint, project,
  loadArt, galaxyStars, fieldStars, makeAtmosphere } from "./flight-world.js?v=3.2";
import { createSkyRenderer } from "./flight-renderer.js?v=3.2";
import { loadHorizon } from "./horizon.js?v=3.1";

import { installPassages } from "./entry-flight.js?v=4.4";

const track = document.querySelector("#sky");
const stage = track.querySelector(".flight-stage");
const rail = [...stage.querySelectorAll(".flight-rail a")];
const anchors = [...track.querySelectorAll(".flight-anchor")];
const beacons = [...stage.querySelectorAll(".beacon")];
const opening = stage.querySelector(".opening-story");
const story = stage.querySelector(".stop-story");
const storyTitle = story.querySelector("h2");
const storyLine = story.querySelector(".station-line");
const work = stage.querySelector("#current-work");
const workKind = work.querySelector("small");
const workName = work.querySelector("strong");
const hint = stage.querySelector(".scroll-hint span");
const meter = stage.querySelector(".journey-meter i");
const cruise = stage.querySelector("#cruise");
const cruiseIcon = cruise.querySelector("use");
const cruiseLabel = cruise.querySelector("span");
const menu = document.querySelector("#sky-menu");
const ambient = menu.querySelector("#ambient");
const playHorizon = stage.querySelector("#play-horizon");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const pointer = matchMedia("(hover: hover) and (pointer: fine)");
const preferenceKey = "dyb-observatory-motion";

let view, renderer, range = 0, trackTop = 0;
let target = 0, progress = 0, previousEye, previousTime = 0, clock = 0;
let frame = 0, visible = true, active = -1, cruisePosition = null;
let lookX = 0, lookY = 0, aimX = 0, aimY = 0;
let preference = null;
try { preference = localStorage.getItem(preferenceKey); } catch { /* optional storage */ }
const ambientEnabled = () => preference === "on" || (preference !== "off" && !reduced.matches);

function requestFrame() {
  if (!frame && renderer && visible && !document.hidden) frame = requestAnimationFrame(draw);
}

function readScroll() {
  target = limit((window.scrollY - trackTop) / range) * END;
  requestFrame();
}

function measure() {
  const width = stage.clientWidth, height = stage.clientHeight;
  const top = track.getBoundingClientRect().top + window.scrollY;
  const nextRange = Math.max(1, track.offsetHeight - height);
  if (view && width === view.width && height === view.height && trackTop === top && range === nextRange) return;
  const oldFraction = range ? (window.scrollY - trackTop) / range : -1;
  view = makeView(width, height);
  trackTop = top;
  range = nextRange;
  anchors.forEach((anchor, i) => { anchor.style.top = (range * i / END) + "px"; });
  if (renderer) renderer.resize(view);
  if (oldFraction > 0 && oldFraction <= 1) {
    window.scrollTo({top: trackTop + oldFraction * range, behavior: "instant"});
  }
  readScroll();
  progress = target;
  previousEye = null;
}

function syncCruise() {
  const running = cruisePosition !== null;
  cruiseLabel.textContent = running ? "暂停巡航" : target >= END - .015 ? "重新巡航" : "自动巡航";
  cruiseIcon.setAttribute("href", "assets/icons.svg#" + (running ? "pause" : "play"));
  cruise.setAttribute("aria-pressed", String(running));
}

function stopCruise() {
  if (cruisePosition === null) return;
  cruisePosition = null;
  syncCruise();
}

function syncMotion() {
  const enabled = ambientEnabled();
  stage.classList.toggle("moving-sky", enabled);
  ambient.textContent = enabled ? "暂停星空动效" : "开启星空动效";
  playHorizon.hidden = enabled || active !== bodies.length - 1;
  if (!enabled) aimX = aimY = 0;
  requestFrame();
}

function changeStation(index) {
  if (active === index) return;
  if (active !== -1) beacons[active].removeAttribute("data-current");
  for (const link of rail) link.removeAttribute("aria-current");
  active = index;
  playHorizon.hidden = ambientEnabled() || index !== bodies.length - 1;
  const beacon = beacons[index];
  const { kind, name, label, note } = beacon.dataset;
  document.querySelector("#body-name").textContent = kind;
  beacon.setAttribute("data-current","");
  work.dataset.enter = String(index);
  stage.dataset.station = name;
  stage.style.setProperty("--tint", bodies[index].tint);
  rail[index].setAttribute("aria-current", "step");
  storyTitle.textContent = name;
  storyLine.textContent = note;
  work.href = beacon.getAttribute("href");
  workKind.textContent = kind;
  workName.textContent = label;
}

function fade(element, alpha) {
  element.hidden = alpha <= .015;
  if (!element.hidden) element.style.opacity = alpha.toFixed(2);
}

function updateOverlay(camera, bases) {
  const index = Math.min(bodies.length - 1, Math.floor(progress + .44));
  changeStation(index);
  const distance = progress - index;
  fade(opening, 1 - smooth(.08, .27, progress));
  let caption = index === 0 ? 0 : smooth(-.42, -.13, distance);
  if (index < bodies.length - 1) caption *= 1 - smooth(.16, .48, distance);
  fade(story, caption);
  // Project the axes of every visible disk. Their hit areas follow the same
  // camera, perspective, tilt and roll as the drawn stars, including on touch.
  for (let i=0;i<bodies.length;i++) {
    const body=bodies[i], base=bases[i], hit=beacons[i];
    const pos=project(...body.center,camera,view);
    if(!pos || pos.d<55){hit.hidden=true;continue;}
    const scale=body.radius*(i===4?1.13:.85), yScale=i===4?.49:1;
    const axisX=project(...worldPoint(body.center,base,scale*.10,0,0),camera,view);
    const axisY=project(...worldPoint(body.center,base,0,scale*yScale*.10,0),camera,view);
    if(!axisX||!axisY){hit.hidden=true;continue;}
    const ax=10*(axisX.x-pos.x), ay=10*(axisX.y-pos.y);
    const bx=10*(axisY.x-pos.x), by=10*(axisY.y-pos.y);
    const xx=ax*ax+bx*bx, yy=ay*ay+by*by, xy=ax*ay+bx*by;
    const split=Math.hypot(xx-yy,2*xy), angle=.5*Math.atan2(2*xy,xx-yy);
    const rx=Math.sqrt(Math.max(0,(xx+yy+split)*.5)), ry=Math.sqrt(Math.max(0,(xx+yy-split)*.5));
    const ex=Math.sqrt(xx), ey=Math.sqrt(yy);
    hit.hidden=rx<13||pos.x+ex<0||pos.x-ex>view.width||pos.y+ey<0||pos.y-ey>view.height;
    if(hit.hidden)continue;
    const w=2*Math.max(22,rx), h=2*Math.max(22,ry);
    hit.style.width=w.toFixed(1)+"px";hit.style.height=h.toFixed(1)+"px";
    hit.style.setProperty("--angle",angle.toFixed(3)+"rad");
    hit.style.zIndex=String(bodies.length-i);
    hit.style.transform="translate3d("+(pos.x-w/2).toFixed(1)+"px,"+(pos.y-h/2).toFixed(1)+"px,0) rotate("+angle.toFixed(3)+"rad)";
  }
  const captionText = progress > END - .12 ? "点击黑洞进入 · 继续滚动查看目录" : "滚动航行 · 点击星系进入";
  if (hint.textContent !== captionText) hint.textContent = captionText;
  meter.style.transform = "scaleX(" + (progress / END).toFixed(4) + ")";
  if (cruisePosition === null && (cruiseLabel.textContent === "重新巡航") !== (target >= END - .015)) syncCruise();
}

function draw(now) {
  frame = 0;
  if (document.hidden || !visible || isInPassage()) return;
  const dt = previousTime ? Math.min(.12, (now - previousTime) / 1000) : 1 / 60;
  const inMotion = Math.abs(target - progress) > .00025 || cruisePosition !== null ||
    Math.abs(lookX - aimX) + Math.abs(lookY - aimY) > .002;
  // The sky can idle at 30 fps. Scroll and pointer input use the display cadence.
  if (!inMotion && previousTime && now - previousTime < 32) { requestFrame(); return; }
  previousTime = now;
  if (cruisePosition !== null) {
    cruisePosition = Math.min(END, cruisePosition + dt * END / 32);
    window.scrollTo({top: trackTop + range * cruisePosition / END, behavior: "instant"});
    target = cruisePosition;
    if (cruisePosition >= END) stopCruise();
  }
  const response = reduced.matches ? 1 : 1 - Math.exp(-dt / .065);
  progress += (target - progress) * response;
  if (Math.abs(target - progress) < .00025) progress = target;
  lookX += (aimX - lookX) * response;
  lookY += (aimY - lookY) * response;
  if (ambientEnabled()) clock += dt;
  const camera = cameraAt(progress, view, clock, lookX, lookY);
  const bases = bodies.map(body => basisAt(body, clock));
  const exposure = reduced.matches ? 0 : Math.min(3, .045 / dt);
  const trail = camera.eye.map((value, axis) => previousEye ? (value - previousEye[axis]) * exposure : 0);
  const speed = Math.hypot(...trail);
  if (speed > 140) for (let i = 0; i < 3; i++) trail[i] *= 140 / speed;
  renderer.render(camera, view, clock, bases, trail);
  previousEye = camera.eye;
  updateOverlay(camera, bases);
  if (ambientEnabled() || inMotion || progress !== target) requestFrame();
}

function navigateToStation(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const hash = event.currentTarget.hash;
  const anchor = document.getElementById(hash.slice(1));
  if (!anchor) return;
  if (location.hash !== hash) history.pushState(null, "", hash);
  anchor.focus({preventScroll:true});
  anchor.scrollIntoView({block:"start", behavior: reduced.matches ? "instant" : "smooth"});
}

function locateInitialHash() {
  const targetNode = document.getElementById(location.hash.slice(1));
  if (!targetNode && ["#works","#notes","#about"].includes(location.hash)) { location.replace(({ "#works":"/projects","#notes":"/blog","#about":"/profile" })[location.hash]); return; }
  if (targetNode) targetNode.scrollIntoView({block:"start", behavior:"instant"});
  readScroll();
  progress = target;
}

menu.addEventListener("click", event => { if (event.target.closest("a")) menu.open = false; });
document.addEventListener("pointerdown", event => {
  if (!menu.contains(event.target)) menu.open = false;
  if (!cruise.contains(event.target)) stopCruise();
}, {passive:true});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
  if (event.target !== cruise || !["Enter", " "].includes(event.key)) stopCruise();
});

const isInPassage = installPassages({stage,anchors,portals:beacons,stopCruise,
  motionAllowed:()=>ambientEnabled() && !(reduced.matches && preference!=="on"),
  redraw:()=>{locateInitialHash();readScroll();requestFrame();}});
async function start() {
  track.classList.add("live");
  measure();
  rail.forEach(link => link.addEventListener("click", navigateToStation));
  locateInitialHash();
  const [images,horizon] = await Promise.all([Promise.all(bodies.map(loadArt)),loadHorizon().catch(()=>null)]);
  const world = { images, horizon, clusters: bodies.map((b, i) => galaxyStars(b, images[i], i)),
    field: fieldStars(), sky: makeAtmosphere() };
  renderer = createSkyRenderer(document.querySelector("#universe"), world);
  renderer.resize(view);
  stage.dataset.renderer = renderer.mode;
  renderer.canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    renderer = createSkyRenderer(renderer.canvas, world, true);
    renderer.resize(view);
    stage.dataset.renderer = renderer.mode;
    requestFrame();
  }, {once:true});
  cruise.addEventListener("click", () => {
    if (cruisePosition !== null) { stopCruise(); return; }
    cruisePosition = target >= END - .015 ? 0 : target;
    if (cruisePosition === 0) { progress = 0; previousEye = null; }
    previousTime = 0;
    syncCruise();
    requestFrame();
  });
  function setAmbient(enabled) {
    preference = enabled ? "on" : "off";
    try { localStorage.setItem(preferenceKey, preference); } catch { /* optional storage */ }
    syncMotion();
  }
  ambient.addEventListener("click", () => setAmbient(!ambientEnabled()));
  playHorizon.addEventListener("click", () => {
    setAmbient(true);
    menu.querySelector("summary").focus({preventScroll:true});
  });
  reduced.addEventListener("change", syncMotion);
  stage.addEventListener("pointermove", event => {
    if (!pointer.matches || !ambientEnabled() || event.pointerType === "touch") return;
    const bounds = stage.getBoundingClientRect();
    aimX = limit((event.clientX - bounds.left) / view.width, 0, 1) * 2 - 1;
    aimY = 1 - limit((event.clientY - bounds.top) / view.height, 0, 1) * 2;
    requestFrame();
  }, {passive:true});
  stage.addEventListener("pointerleave", () => { aimX = aimY = 0; requestFrame(); });
  window.addEventListener("wheel", stopCruise, {passive:true});
  window.addEventListener("scroll", readScroll, {passive:true});
  window.addEventListener("pageshow", event=>{if(event.persisted&&location.hash.startsWith("#star-"))locateInitialHash();readScroll();});
  window.addEventListener("hashchange",locateInitialHash);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(track);
  window.addEventListener("resize", measure, {passive:true});
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      previousTime = 0;
      if (visible) readScroll(); else stopCruise();
    }).observe(stage);
  }
  document.addEventListener("visibilitychange", () => {
    previousTime = 0;
    if (document.hidden) { stopCruise(); cancelAnimationFrame(frame); frame = 0; }
    else readScroll();
  });
  measure();
  readScroll();
  progress = target;
  cruise.hidden = ambient.hidden = false;
  syncMotion();
  stage.classList.add("has-sky");
  if(location.hash.startsWith("#star-"))requestAnimationFrame(()=>{locateInitialHash();requestFrame();});
}

start().catch(() => {
  track.classList.remove("live");
  stage.classList.remove("has-sky");
  anchors.forEach(anchor => anchor.style.removeProperty("top"));
  const section = document.getElementById(location.hash.slice(1));
  if (section) section.scrollIntoView({block:"start", behavior:"instant"});
});
