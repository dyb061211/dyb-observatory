import { program } from "./gl-program.js";

// The pivot is the nucleus in each original emission map, in bottom-left UV coordinates.
const galaxies = {
  spiral: {
    pivot: [.516, .507],
    flow: `
      float shear = .17 * (sin(.40*t + 3.2*r) - sin(3.2*r)) * smoothstep(.08,.62,r);
      q = rotatePoint(p, -.108*t - shear);
      light = sweep(p, .61*t + 5.8*r, 6.) * smoothstep(.10,.42,r);
      gain = 1.02 + .27*light;
    `
  },
  bar: {
    pivot: [.497, .508],
    flow: `
      float arms = smoothstep(.32,.84,r);
      q = rotatePoint(p, .087*t + .23*sin(.34*t)*arms);
      float ends = exp(-18.*q.y*q.y) * smoothstep(.10,.44,abs(q.x));
      float flow = .5 + .5*cos(10.*abs(q.x) - 1.32*t + 1.2*q.x);
      light = ends*flow + .35*arms*sweep(p, -.60*t + 3.5*r, 5.);
      gain = 1.01 + .29*light;
    `
  },
  ring: {
    pivot: [.492, .514],
    flow: `
      float rim = smoothstep(.17,.54,r);
      q = rotatePoint(p, -rim*(.135*t + .065*sin(3.1*r + .52*t)));
      light = rim*(sweep(p,.70*t+.4,8.) + .43*sweep(p,.56*t+3.3,12.));
      gain = 1.0 + .45*light;
    `
  },
  cloud: {
    pivot: [.50, .50],
    flow: `
      // Advect overlapping filaments locally so the cloud keeps its irregular outline.
      vec2 phase = vec2(3.4*p.y + 1.65*p.x, 3.1*p.x - 1.8*p.y);
      vec2 drift = vec2(sin(phase.x + .47*t) - sin(phase.x), cos(phase.y - .39*t) - cos(phase.y));
      vec2 wisps = vec2(sin(7.*p.y-.62*t)-sin(7.*p.y), sin(6.*p.x+.53*t)-sin(6.*p.x));
      q = p + drift*vec2(.057,.049) + .014*wisps;
      light = .5 + .5*sin(5.2*p.x - 4.3*p.y - .88*t + .7*sin(.46*t+3.*p.y));
      gain = .96 + .27*light;
    `
  }
};

const vertex = `
  attribute vec2 position;
  varying mediump vec2 uv;
  void main() {
    uv = position*.5 + .5;
    gl_Position = vec4(position,0.,1.);
  }`;

function makeDiscGL(gl, canvas, image, galaxy) {
  const fragment = `
    precision highp float;
    varying mediump vec2 uv;
    uniform sampler2D art;
    uniform vec2 pivot;
    uniform float t;
    vec2 rotatePoint(vec2 p, float a) {
      float c=cos(a), s=sin(a);
      return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
    }
    float sweep(vec2 p, float a, float width) {
      return pow(max(0.,dot(p/max(length(p),.001),vec2(cos(a),sin(a)))),width);
    }
    float peak(vec3 c) {return max(c.r,max(c.g,c.b));}
    void main() {
      vec2 p = 2.*(uv-pivot), q;
      float r = length(p), light, gain;
      ${galaxy.flow}
      vec2 source = pivot + .5*q;
      vec3 color = texture2D(art,source).rgb;
      // Only compact, already luminous knots scintillate. The dark lanes stay dark.
      float nearby = .5*(peak(texture2D(art,source+vec2(.0025,.0016)).rgb)
                       + peak(texture2D(art,source-vec2(.0013,.0031)).rgb));
      float knot = max(0.,peak(color)-nearby);
      float flicker = .5+.5*sin(1.75*t + dot(q,vec2(83.,109.)));
      gl_FragColor=vec4(color*(gain+.48*knot*flicker) + .048*knot*light,1.);
    }`;
  const pipe = program(gl, vertex, fragment);
  gl.useProgram(pipe.out);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(pipe.attr.position);
  gl.vertexAttribPointer(pipe.attr.position, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(pipe.u.art, 0);
  gl.uniform2fv(pipe.u.pivot, galaxy.pivot);
  return {
    resize() {
      const side = Math.min(image.naturalWidth, Math.ceil(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.6)));
      if (side > 0 && side !== canvas.width) canvas.width = canvas.height = side;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(time) {
      gl.uniform1f(pipe.u.t, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}

// On devices without WebGL, animate two feathered pieces of the same high-resolution map.
function makeDisc2D(canvas, image, kind) {
  const side = 768;
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d", { alpha: false });
  const [u,v] = galaxies[kind].pivot;
  const cx = u*side, cy = (1-v)*side;
  function layer(inner) {
    const sheet = document.createElement("canvas");
    sheet.width = sheet.height = side;
    const paint = sheet.getContext("2d");
    paint.drawImage(image, 0, 0, side, side);
    const mask = kind === "cloud" ? paint.createLinearGradient(.22*side,0,.78*side,.25*side)
      : paint.createRadialGradient(cx,cy,.08*side,cx,cy,.40*side);
    mask.addColorStop(0, "#000"); mask.addColorStop(1, "transparent");
    paint.globalCompositeOperation = inner ? "destination-in" : "destination-out";
    paint.fillStyle = mask; paint.fillRect(0, 0, side, side);
    return sheet;
  }
  const inner = layer(true), outer = layer(false);
  function place(sheet, angle, dx=0, dy=0) {
    ctx.save(); ctx.translate(cx+dx, cy+dy); ctx.rotate(angle);
    ctx.drawImage(sheet, -cx, -cy); ctx.restore();
  }
  return {
    draw(time) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, side, side);
      ctx.globalCompositeOperation = "lighter";
      if (kind === "cloud") {
        place(inner, .055*Math.sin(.38*time), 18*Math.sin(.41*time), 14*Math.sin(.52*time));
        place(outer, -.047*Math.sin(.46*time), -15*Math.sin(.37*time), -13*Math.sin(.48*time));
      } else {
        const rate = { spiral: -.108, bar: .087, ring: -.135 }[kind];
        place(inner, kind === "ring" ? 0 : rate*time);
        place(outer, rate*time + .16*Math.sin(.40*time));
      }
    }
  };
}

export async function createStationGalaxy(art) {
  const kind = art.dataset.body, image = art.querySelector("img");
  if (!image.complete || !image.naturalWidth) await image.decode();
  const canvas = art.querySelector("canvas");
  const gl = canvas.getContext("webgl", { alpha:false, antialias:false, depth:false, stencil:false, powerPreference:"low-power" });
  if (!gl) return makeDisc2D(canvas, image, kind);
  let renderer, lastTime = 0;
  function use2D() {
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    renderer = makeDisc2D(fresh, image, kind);
    renderer.draw(lastTime);
  }
  try {
    renderer = makeDiscGL(gl, canvas, image, galaxies[kind]);
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); use2D(); }, {once:true});
  } catch { use2D(); }
  return { draw(time) { lastTime = time; renderer.draw(time); }, resize: () => renderer.resize?.() };
}
