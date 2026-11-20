import sky from "../views/sky.html?raw";
import { stations, html } from "../lib/stations";

const menu = stations.map((s, i) => `<a href="/${s.slug}" data-enter="${i}">${s.title}</a>`).join("");
const anchors = stations.map(s => `<span class="flight-anchor" id="${s.anchor}" tabindex="-1" aria-label="${s.body} · ${s.title}"></span>`).join("");
const portals = stations.map((s, i) => `<a class="beacon" href="/${s.slug}" data-enter="${i}" data-kind="${s.body}" data-name="${s.title}" data-label="进入${s.title}" data-note="${s.note}" style="--tint:${s.tint}" aria-label="进入${s.title}（${s.body}）" hidden><span aria-hidden="true">${s.title}</span></a>`).join("");
const rail = stations.map(s => `<a href="#${s.anchor}" style="--tint:${s.tint}" aria-label="定位${s.body} · ${s.title}"><span>${s.title}</span><i></i></a>`).join("");
const atlas = stations.map((s, i) => `<a href="/${s.slug}" data-enter="${i}" style="--tint:${s.tint}"><div class="atlas-art"><img loading="lazy" src="/assets/sky/${s.art}.webp" alt=""></div><small>${s.body}</small><h3>${s.title}</h3><span>${s.hint}</span></a>`).join("");
const home = sky.replace("<!--station-menu-->",menu).replace("<!--station-anchors-->",anchors)
  .replace("<!--station-portals-->",portals).replace("<!--station-rail-->",rail).replace("<!--station-atlas-->",atlas);
export function GET() { return html(home); }

