// The same curved centreline is used by the ray-cast gas, airborne dust and
// software renderer. Distances are in throat radii, angles in radians.
const stations = [
  { cool: [.31,.46,.94], warm: [1.00,.61,.47], phase: .35 },
  { cool: [.25,.55,.63], warm: [1.00,.70,.29], phase: 1.76 },
  { cool: [.24,.66,.90], warm: [.97,.74,.60], phase: 3.22 },
  { cool: [.48,.33,.75], warm: [1.00,.52,.61], phase: 4.41 },
  { cool: [.46,.26,.35], warm: [1.00,.56,.23], phase: 5.56 }
];
const tau = Math.PI * 2;
const clamp = x => Math.max(0, Math.min(1, x));
function smooth(a, b, x) {
  const f = clamp((x-a)/(b-a));
  return f*f*(3-2*f);
}
function randomStream(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const flowAtlas = typeof Image === "undefined" ? null : new Image();
if (flowAtlas) {
  flowAtlas.decoding = "async";
  flowAtlas.src = new URL("./sky/passage-flow.webp", import.meta.url).href;
}

const common = `
  uniform float uProgress, uPhase;
  uniform vec2 uRes, uOrigin;
  const float TAU=6.28318530718;
  vec2 path(float z) {
    return vec2(1.16*sin(.31*z+uPhase)+.49*sin(.56*z-.36*uPhase),
                .78*cos(.29*z-.52*uPhase)+.33*sin(.53*z+uPhase));
  }
  float flightTime() {
    float t=clamp((uProgress-.145)/.785,0.,1.);
    return 23.*(t-.15*sin(TAU*t));
  }
  vec2 heading(float z) { return (path(z+2.65)-path(z))/2.65; }
  float roll(float z) { return .115*sin(.34*z+uPhase)+.07*sin(.52*z-.44*uPhase); }
  mat2 rotate(float a) { float c=cos(a),s=sin(a);return mat2(c,s,-s,c); }
  vec2 centre() {
    vec2 start=vec2(uOrigin.x,1.-uOrigin.y);
    return mix(start,vec2(.5),smoothstep(.015,.42,uProgress));
  }
  float openingRadius() {
    return .019+.083*smoothstep(0.,.12,uProgress)+.147*smoothstep(.055,.24,uProgress)
           +1.09*pow(smoothstep(.14,.47,uProgress),2.15);
  }
  float aperture() { return 1.16+.28*smoothstep(.20,.55,uProgress); }
  float endFade() { return 1.-smoothstep(.825,.989,uProgress); }
`;
const quadVertex = `
  attribute vec2 aPosition;
  void main() { gl_Position=vec4(aPosition,0.,1.); }
`;

const mediumFragment = `
  precision highp float;
  ${common}
  uniform vec3 uCool, uWarm;
  uniform sampler2D uFlow;
  uniform float uHorizon;
  float hash(vec2 p) {
    vec3 m=fract(vec3(p.xyx)*vec3(.1031,.11369,.13787));
    m+=dot(m,m.yzx+19.19);
    return fract((m.x+m.y)*m.z);
  }
  float stars(vec2 uv,float scale,float seed) {
    vec2 grid=uv*scale+seed;
    vec2 cell=floor(grid);
    vec2 off=vec2(hash(cell+17.72),hash(cell+72.14))*.72+.14;
    vec2 d=fract(grid)-off;
    float mag=pow(hash(cell+48.34),15.);
    float width=.032+.068*mag;
    return mag*exp(-dot(d,d)/(width*width));
  }
  // The angular coordinate wraps through the noisy filament field once per
  // turn; wisps stay attached to space as the observer moves past them.
  vec3 polarSample(float turns,vec2 flow) {
    // atan jumps by one turn on its negative axis. Use the equivalent
    // positive chart there so mip gradients never smear across the seam.
    vec2 uv=vec2(turns,0.)+flow;
    vec3 a=texture2D(uFlow,uv).rgb;
    vec3 b=texture2D(uFlow,uv+vec2(step(turns,0.),0.)).rgb;
    return mix(a,b,smoothstep(.28,.41,abs(turns)));
  }
  vec3 wall(float theta,float z,float layer) {
    float shear=.09*sin(z*.24+uPhase)+z*.016;
    return polarSample(theta/TAU,vec2(shear+.045*sin(z*.39+theta)+.11*uPhase+layer,
                   z*.044+.036*cos(theta*2.-z*.19)+.3*layer));
  }
  float embers(float angle,float z) {
    vec2 p=vec2(fract(angle/TAU+1.)*168.,z*8.25);
    vec2 cell=floor(p), offset=.18+.64*vec2(hash(cell+5.),hash(cell+79.));
    vec2 d=fract(p)-offset;
    float luminous=pow(hash(cell+42.),12.);
    float size=.034+.077*luminous;
    return luminous*exp(-dot(d,d)/(size*size));
  }
  vec3 distantSky(vec2 uv) {
    vec3 fog=texture2D(uFlow,uv*vec2(.21,.18)+vec2(.32,uPhase*.11)).rgb;
    float single=stars(uv,57.,1.)+.55*stars(uv,95.,3.);
    return vec3(.009,.012,.025)+uCool*(.035*fog.r+.065*fog.b)
           +mix(vec3(.63,.77,1.),vec3(1.,.80,.66),fog.r)*single*.95;
  }
  float tubeRadius(float z) { return 1.60+.14*sin(z*.68+uPhase)+.11*sin(z*.39-.5*uPhase); }
  vec3 corridor(vec2 uv) {
    float cam=flightTime();
    vec2 near=path(cam);
    vec2 ray=rotate(roll(cam))*uv*aperture()+heading(cam);
    // Bound the step by the transverse speed of the ray and the moving wall.
    // A final interpolation resolves the first wall even near grazing angles.
    float travel=.06, gap=1., lastGap=1., lastTravel=0.;
    for (int i=0; i<23; i++) {
      float z=cam+travel;
      gap=tubeRadius(z)-length(near+ray*travel-path(z));
      if(gap<.008 || travel>21.) break;
      lastTravel=travel; lastGap=gap;
      travel+=clamp(gap/(.55+length(ray)),.047,2.5);
    }
    if(gap<0.) travel=mix(lastTravel,travel,clamp(lastGap/(lastGap-gap),0.,1.));
    float z=cam+travel;
    vec2 radial=near+ray*travel-path(z);
    float angle=atan(radial.y,radial.x);
    vec3 ink=wall(angle,z,0.);
    vec3 veil=wall(angle+.29*sin(z*.45+angle),z+1.7,.41);
    float turn=angle-.19*z-.55*sin(z*.34)+uPhase;
    float key=.48+.52*cos(turn);
    float hot=smoothstep(.29,.98,key)*(.35+.65*veil.r);
    vec3 tint=mix(uCool,uWarm,smoothstep(.15,.85,key+.20*sin(.38*z)));
    float cloud=pow(ink.r,2.25)*(.38+1.10*key*key);
    float strands=pow(ink.g,1.48)*(.45+1.43*ink.r)+.40*pow(veil.g,2.);
    float emission=cloud+strands*.90+pow(ink.b,2.6)*.90;
    // Small knots are hot enough to lose saturation; clear lanes between
    // sheets reveal the colder, lit face of the opposite wall.
    vec3 gas=tint*(.016+.88*emission)+uCool*.10*veil.r*veil.r;
    gas+=mix(vec3(.70,.85,1.),vec3(1.,.90,.73),hot)*embers(angle,z)*(.52+ink.b);
    gas+=vec3(1.,.89,.77)*(.39*ink.b*ink.g+.62*pow(ink.g,3.4))*hot;
    float shadow=.43+.57*smoothstep(.12,.48,ink.r+.1*veil.g);
    gas*=shadow*(.87+.13*sin(z*.43+angle));
    float distanceLight=.16+.95*exp(-.095*travel);
    vec3 sky=distantSky(uv+.28*heading(cam));
    float hit=(1.-smoothstep(13.,21.,travel))*(1.-smoothstep(.06,.3,max(gap,0.)));
    vec3 space=mix(sky,vec3(.005,.009,.018)+gas*distanceLight,hit);
    space+=uCool*pow(veil.r,2.)*.045*exp(-.043*travel);
    return space;
  }
  // The exterior sphere images a full shell through a hemispherical lens. Its
  // narrow ridgeline, caustic arcs and sheared sky use different deflections.
  vec4 mouth(vec2 q,float pixel) {
    float r=max(length(q),.0001), ang=atan(q.y,q.x);
    float edge=r-1.;
    float softness=clamp(pixel,.002,.035);
    float inside=1.-smoothstep(-softness,softness,edge);
    vec2 direction=q/r;
    float theta=asin(clamp(r,0.,1.));
    vec2 refracted=direction*(theta*.93)+.27*vec2(sin(uPhase),cos(uPhase));
    float deflection=1.-smoothstep(.0,1.23,abs(edge));
    vec2 warped=q-direction*(.82/max(r,.35))*deflection;
    vec3 sky=distantSky(refracted+uProgress*vec2(-.21,.075));
    vec3 exterior=distantSky(warped*.71);
    float spectral=.5+.5*cos(ang+uPhase*.35-.45);
    vec3 tint=mix(uCool,uWarm,smoothstep(.12,.86,spectral));
    vec3 gas=polarSample(ang/TAU,vec2(.06*uPhase,.46*theta+.055*uProgress));
    float limb=pow(clamp(r,0.,1.),3.);
    float striation=pow(max(0.,gas.g),1.4);
    vec3 inner=sky*(.92+1.6*limb)+tint*(.05+limb*.68)*(gas.r*gas.r+striation);
    float line=exp(-abs(edge)/max(.005,softness*.65));
    float fine=exp(-abs(edge-.018)/max(.003,softness*.52));
    float glow=exp(-abs(edge)/.084);
    float arc=.31+.69*pow(.5+.5*cos(ang-.43+1.24*uPhase),2.);
    float spark=pow(.5+.5*cos(ang*2.+.84+uPhase-uProgress*4.),11.);
    vec3 rim=tint*((1.20*line+.31*fine+.24*glow)*arc)
             +mix(tint,vec3(1.,.94,.83),.64)*(.99*line+.18*glow)*spark;
    float disk=0.;
    if(uHorizon>.5) {
      vec2 tilted=rotate(.12)*q;
      float lane=abs(length(tilted*vec2(.62,4.58))-1.);
      disk=exp(-lane/.088)*(.30+.70*smoothstep(-.26,.22,-tilted.y))*.66;
      rim+=mix(uWarm,vec3(1.,.82,.57),.33)*disk;
    }
    float outerAlpha=clamp(.11*deflection+.68*glow+line+.48*disk,0.,1.);
    return vec4(mix(exterior,inner,inside)+rim, max(inside*.98,outerAlpha));
  }
  void main() {
    vec2 uv=(gl_FragCoord.xy-centre()*uRes)/uRes.y;
    float radius=openingRadius(), r=length(uv)/radius;
    float enter=smoothstep(.235,.47,uProgress);
    vec4 lens=vec4(0.);
    if(enter<.998) lens=mouth(uv/radius,1./(uRes.y*radius));
    vec3 gas=vec3(0.);
    if(enter>.002 || (r<1. && uProgress>.135)) {
      // A glimpse inside the spherical throat precedes the camera crossing
      // its edge. The bending lens straightens as it passes behind the viewer.
      float distort=(1.-enter)*.42*min(dot(uv,uv)/max(radius*radius,.0001),1.);
      gas=corridor(uv*(1.+distort));
    }
    float window=(1.-smoothstep(.49,.97,r))*smoothstep(.15,.33,uProgress);
    vec3 light=mix(lens.rgb,gas,max(enter,window));
    float alpha=mix(lens.a,1.,smoothstep(.135,.425,uProgress));
    alpha*=smoothstep(0.,.052,uProgress);
    // Soft film shoulder; bright, very thin sources retain a warm core.
    vec3 color=pow(1.-exp(-1.88*max(light,vec3(0.))),vec3(.84));
    color=mix(vec3(.024,.028,.047),color,endFade());
    gl_FragColor=vec4(color,alpha);
  }
`;

const dustVertex = `
  precision highp float;
  ${common}
  attribute vec4 aDust;
  attribute vec2 aCorner;
  varying lowp float vAcross,vAlong,vEnergy,vTone;
  vec2 screenPosition(float cam,float depth,vec2 point) {
    vec2 ray=(point-path(cam))/max(depth,.10)-heading(cam);
    return centre()*uRes+rotate(-roll(cam))*ray*(uRes.y/aperture());
  }
  void main() {
    float cam=flightTime();
    float span=aDust.y-cam;
    float theta=aDust.x+.08*aDust.y;
    vec2 point=path(aDust.y)+aDust.z*vec2(cos(theta),sin(theta));
    vec2 head=screenPosition(cam,span,point);
    float shutter=.055+.39*sin(3.14159*clamp((uProgress-.16)/.75,0.,1.));
    vec2 tail=screenPosition(cam-shutter,span+shutter,point);
    vec2 delta=head-tail;
    float size=length(delta);
    vec2 tangent=size>.01 ? delta/size : vec2(0.,1.);
    float width=(.33+.82*aDust.w)*min(1.9,max(.63,uRes.y/810.));
    tail=head-tangent*clamp(size,.9,165.*uRes.y/810.);
    vec2 pos=mix(tail,head,aCorner.x)+vec2(-tangent.y,tangent.x)*aCorner.y*width;
    gl_Position=vec4(pos/uRes*2.-1.,0.,1.);
    vAcross=aCorner.y; vAlong=aCorner.x;
    vEnergy=smoothstep(.19,.39,uProgress)*endFade()*smoothstep(.16,.77,span)
      *(1.-smoothstep(5.,15.,span))*(.11+.83*pow(aDust.w,2.));
    // A dust grain beyond the throat's radius is occluded by the gas.
    vEnergy*=1.-smoothstep(1.20,1.75,aDust.z);
    vTone=.5+.5*cos(theta+uPhase);
  }
`;
const dustFragment = `
  precision mediump float;
  uniform vec3 uCool,uWarm;
  varying lowp float vAcross,vAlong,vEnergy,vTone;
  void main() {
    float stroke=(1.-vAcross*vAcross)*(.09+.91*vAlong*vAlong)*vEnergy;
    vec3 hue=mix(uCool,uWarm,vTone);
    gl_FragColor=vec4(mix(hue,vec3(.96,.94,1.),.53*vAlong),stroke);
  }
`;

function link(gl, vertex, fragment) {
  const compiled = [];
  const program = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader = gl.createShader(type);
      compiled.push(shader);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of compiled) gl.deleteShader(shader);
  }
  const uniforms = {};
  for (let i=0; i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS); i++) {
    const {name} = gl.getActiveUniform(program,i);
    uniforms[name] = gl.getUniformLocation(program,name);
  }
  return {program,uniforms};
}

function resize(canvas, budget, dprLimit) {
  const box=canvas.getBoundingClientRect();
  const width=box.width || window.innerWidth, height=box.height || window.innerHeight;
  const ratio=Math.min(window.devicePixelRatio || 1,dprLimit,Math.sqrt(budget/(width*height)));
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  if (canvas.width!==w) canvas.width=w;
  if (canvas.height!==h) canvas.height=h;
}

function particleSet(seed,count) {
  const rand=randomStream(seed), result=[];
  for (let i=0;i<count;i++) {
    result.push([rand()*tau,rand()*39+.18,.32+Math.sqrt(rand())*1.35,rand()]);
  }
  return result;
}

function glPassage(canvas, gl, station, index, origin) {
  const programs=[], buffers=[], textures=[];
  const attributes=[];
  function dispose() {
    if (gl.isContextLost()) return;
    for (const attr of attributes) gl.disableVertexAttribArray(attr);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const tex of textures) gl.deleteTexture(tex);
    for (const entry of programs) gl.deleteProgram(entry.program);
  }
  function buffer(values) {
    const result=gl.createBuffer();
    buffers.push(result);
    gl.bindBuffer(gl.ARRAY_BUFFER,result);
    gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
    return result;
  }
  function attr(entry,name) {
    const loc=gl.getAttribLocation(entry.program,name);
    attributes.push(loc);
    return loc;
  }
  try {
    const gas=link(gl,quadVertex,mediumFragment);
    programs.push(gas);
    const dust=link(gl,dustVertex,dustFragment);
    programs.push(dust);
    const quad=buffer(new Float32Array([-1,-1,3,-1,-1,3]));
    const pos=attr(gas,"aPosition"), grain=attr(dust,"aDust"), edge=attr(dust,"aCorner");
    const points=particleSet(11003+index*701,1750), vertices=new Float32Array(points.length*36);
    let cursor=0;
    for (const part of points) {
      for (const corner of [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]]) {
        vertices.set(part,cursor); vertices.set(corner,cursor+4); cursor+=6;
      }
    }
    const particles=buffer(vertices);
    const texture=gl.createTexture();
    textures.push(texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    // Complete the sampler immediately, including on a slow connection.
    const side=64, initial=new Uint8Array(side*side*4);
    for (let y=0; y<side; y++) for (let x=0; x<side; x++) {
      const i=(y*side+x)*4, a=tau*x/side,b=tau*y/side, lane=3*a+b+1.8*Math.sin(b+a);
      initial[i]=108+57*Math.sin(lane)+30*Math.cos(2*b-7*a);
      initial[i+1]=160*Math.pow(.5+.5*Math.cos(8*lane-2*b),7);
      initial[i+2]=65*Math.pow(.5+.5*Math.sin(3*lane-b),2);
      initial[i+3]=255;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,side,side,0,gl.RGBA,gl.UNSIGNED_BYTE,initial);
    gl.generateMipmap(gl.TEXTURE_2D);
    let ready=false;
    function commonUniforms(entry, t) {
      const u=entry.uniforms;
      gl.useProgram(entry.program);
      gl.uniform1f(u.uProgress,t);
      gl.uniform1f(u.uPhase,station.phase);
      gl.uniform2f(u.uRes,canvas.width,canvas.height);
      gl.uniform2f(u.uOrigin,origin.x,origin.y);
      gl.uniform3fv(u.uCool,station.cool);
      gl.uniform3fv(u.uWarm,station.warm);
    }
    return {
      draw(t) {
        resize(canvas,window.innerWidth<700 ? 430000 : 790000,1.38);
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        if (!ready && flowAtlas?.complete && flowAtlas.naturalWidth) {
          gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,flowAtlas);
          gl.generateMipmap(gl.TEXTURE_2D);
          ready=true;
        }
        commonUniforms(gas,t);
        gl.uniform1i(gas.uniforms.uFlow,0);
        gl.uniform1f(gas.uniforms.uHorizon,index===4 ? 1 : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER,quad);
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLES,0,3);
        gl.disableVertexAttribArray(pos);
        if (t>.19 && t<.986) {
          gl.enable(gl.BLEND);
          gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ZERO,gl.ONE);
          commonUniforms(dust,t);
          gl.bindBuffer(gl.ARRAY_BUFFER,particles);
          gl.enableVertexAttribArray(grain); gl.enableVertexAttribArray(edge);
          gl.vertexAttribPointer(grain,4,gl.FLOAT,false,24,0);
          gl.vertexAttribPointer(edge,2,gl.FLOAT,false,24,16);
          gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
          gl.disableVertexAttribArray(grain); gl.disableVertexAttribArray(edge);
          gl.disable(gl.BLEND);
        }
      }, dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function curve(z, ph) {
  return [1.16*Math.sin(.31*z+ph)+.49*Math.sin(.56*z-.36*ph),
          .78*Math.cos(.29*z-.52*ph)+.33*Math.sin(.53*z+ph)];
}
function startCamera(cam, ph) {
  const [x,y]=curve(cam,ph), [aheadX,aheadY]=curve(cam+2.65,ph);
  const bank=.115*Math.sin(.34*cam+ph)+.07*Math.sin(.52*cam-.44*ph);
  return {x,y,cam,dx:(aheadX-x)/2.65,dy:(aheadY-y)/2.65,c:Math.cos(bank),s:Math.sin(bank)};
}
function projected(wx,wy,wz,camera,focal) {
  const z=Math.max(.10,wz-camera.cam);
  const x=(wx-camera.x)/z-camera.dx, y=(wy-camera.y)/z-camera.dy;
  return [(x*camera.c+y*camera.s)*focal,(x*camera.s-y*camera.c)*focal];
}
function colorMix(station,t,alpha=1) {
  const rgb=station.cool.map((v,i)=>Math.round((v+(station.warm[i]-v)*t)*255));
  return "rgba("+rgb.join(",")+","+clamp(alpha)+")";
}

let flowPixels;
function readFlow() {
  if (flowPixels) return flowPixels;
  if (!flowAtlas?.complete || !flowAtlas.naturalWidth || typeof document==="undefined") return null;
  const copy=document.createElement("canvas");
  copy.width=512;copy.height=256;
  const ctx=copy.getContext("2d",{willReadFrequently:true});
  if (!ctx) return null;
  ctx.drawImage(flowAtlas,0,0,512,256);
  flowPixels=ctx.getImageData(0,0,512,256).data;
  return flowPixels;
}

// Without WebGL, intersect each viewing ray against cross-sections of the
// same bent tube. Lighting is cached on the gas, in world coordinates. Only
// its projection and the short range of newly visible material change.
function softwareMedium(atlas,station) {
  const surface=document.createElement("canvas");
  const ctx=surface.getContext("2d",{alpha:false});
  if (!ctx) return null;
  const sides=384, rows=[], depthScale=10, ph=station.phase;
  const tone=new Uint8ClampedArray(2048);
  for (let i=0;i<tone.length;i++) tone[i]=255*Math.pow(1-Math.exp(-1.88*i/512),.84);
  function sample(turns,z,layer) {
    const theta=turns*tau;
    const u=turns+.09*Math.sin(z*.24+ph)+z*.016+.045*Math.sin(z*.39+theta)+.11*ph+layer;
    const v=z*.044+.036*Math.cos(2*theta-z*.19)+.3*layer;
    return (((Math.floor(v*256)&255)*512)+(Math.floor(u*512)&511))*4;
  }
  function rowAt(index) {
    if (rows[index]) return rows[index];
    const z=index/depthScale;
    const row=new Float32Array((sides+1)*3);
    for (let j=0;j<sides;j++) {
      const turns=j/sides, theta=turns*tau;
      const one=sample(turns,z,0),two=sample(turns+.29/tau*Math.sin(z*.45+theta),z+1.7,.41);
      const mass=atlas[one]/255, thread=atlas[one+1]/255, knot=atlas[one+2]/255;
      const veil=atlas[two]/255,fine=atlas[two+1]/255;
      const key=.48+.52*Math.cos(theta-.19*z-.55*Math.sin(z*.34)+ph);
      const tint=smooth(.15,.85,key+.20*Math.sin(.38*z));
      const cloud=Math.pow(mass,2.25)*(.38+1.10*key*key);
      const strands=Math.pow(thread,1.48)*(.45+1.43*mass)+.40*fine*fine;
      const emission=.016+.88*(cloud+.90*strands+.90*Math.pow(knot,2.6));
      const hot=smooth(.29,.98,key)*(.35+.65*veil)*(.39*knot*thread+.62*Math.pow(thread,3.4));
      const shade=(.43+.57*smooth(.12,.48,mass+.10*fine))*(.87+.13*Math.sin(.43*z+theta));
      for (let c=0;c<3;c++) {
        const pigment=station.cool[c]+(station.warm[c]-station.cool[c])*tint;
        row[j*3+c]=(pigment*emission+station.cool[c]*.10*veil*veil+hot*(1-.11*c))*shade;
      }
    }
    row.set(row.subarray(0,3),sides*3);
    rows[index]=row;
    return row;
  }
  const strides=[.10];
  while (strides.at(-1)<22) strides.push(strides.at(-1)*1.133+.095);
  let image;
  return function paint(camera,aspect,aperture,cx,cy) {
    const limit=aspect<.8 ? 79000 : 105000;
    const h=Math.max(1,Math.round(Math.sqrt(limit/aspect))),w=Math.max(1,Math.round(h*aspect));
    if (!image || surface.width!==w || surface.height!==h) {
      surface.width=w;surface.height=h;image=ctx.createImageData(w,h);
    }
    const xShift=[],yShift=[],square=[],exposure=[];
    for (const d of strides) {
      const z=camera.cam+d,[x,y]=curve(z,ph);
      xShift.push(camera.x-x);yShift.push(camera.y-y);
      square.push((1.6+.14*Math.sin(z*.68+ph)+.11*Math.sin(z*.39-.5*ph))**2);
      exposure.push((.16+.95*Math.exp(-.095*d))*(1-smooth(13,21,d)));
    }
    const startRow=Math.floor(camera.cam*depthScale);
    const endRow=Math.ceil((camera.cam+strides.at(-1))*depthScale)+1;
    for(let j=startRow;j<=endRow;j++) rowAt(j);
    const screenX=-cx*aspect*aperture, step=aperture/h, stepX=step*camera.c, stepY=step*camera.s;
    const data=image.data;
    let off=0;
    for(let y=0;y<h;y++) {
      const screenY=(cy-(y+.5)/h)*aperture;
      let rx=camera.c*screenX-camera.s*screenY+camera.dx+.5*stepX;
      let ry=camera.s*screenX+camera.c*screenY+camera.dy+.5*stepY;
      for(let x=0;x<w;x++,off+=4,rx+=stepX,ry+=stepY) {
        let j=1,prevGap=square[0],gap=0,px=0,py=0;
        for(;j<strides.length;j++){
          const d=strides[j];px=rx*d+xShift[j];py=ry*d+yShift[j];
          gap=square[j]-px*px-py*py;
          if(gap<=0)break;
          prevGap=gap;
        }
        if(j===strides.length){
          data[off]=11;data[off+1]=14;data[off+2]=24;data[off+3]=255;continue;
        }
        const f=clamp(prevGap/(prevGap-gap));
        const near=strides[j-1],d=near+f*(strides[j]-near);
        const farX=rx*near+xShift[j-1],farY=ry*near+yShift[j-1];
        let turn=Math.atan2(farY+f*(py-farY),farX+f*(px-farX))/tau;
        if(turn<0)turn+=1;
        if(turn===1)turn=0;
        const angle=turn*sides,a=Math.floor(angle)*3,af=angle-Math.floor(angle);
        const zz=(camera.cam+d)*depthScale,iz=Math.floor(zz),zf=zz-iz,r0=rows[iz],r1=rows[iz+1];
        const gain=exposure[j-1]+f*(exposure[j]-exposure[j-1]);
        for(let c=0;c<3;c++) {
          const k=a+c,lower=r0[k]+af*(r0[k+3]-r0[k]),upper=r1[k]+af*(r1[k+3]-r1[k]);
          const light=(lower+zf*(upper-lower))*gain+.006+c*.004;
          data[off+c]=tone[Math.min(2047,Math.floor(light*512))];
        }
        data[off+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
    return surface;
  };
}

function canvasPassage(canvas, ctx, station, index, origin) {
  let paintMedium=null;
  const ph=station.phase, rand=randomStream(9356+index*700);
  const grains=particleSet(11003+index*701,1170).map(([angle,z,radius,power])=>{
    const [x,y]=curve(z,ph), a=angle+z*.08;
    return {x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius,z,power,color:.5+.5*Math.cos(a+ph)};
  });
  // Each strand is anchored in the tube, with a short break or a knot. The
  // changing angle of the path creates real parallax and asymmetrical folds.
  const ribbons=Array.from({length:122},()=>({
    a:rand()*tau,r:1.14+.38*rand(),bright:.14+.86*rand(),bias:rand()*tau,
    width:.7+Math.pow(rand(),2)*4.5
  }));
  const backgroundStars=Array.from({length:180},()=>[rand()*tau,Math.sqrt(rand()),rand()]);
  return {
    draw(t) {
      resize(canvas,window.innerWidth<700 ? 330000 : 640000,1.15);
      const w=canvas.width,h=canvas.height;
      const focus=smooth(.015,.42,t), cx=w*(origin.x+(.5-origin.x)*focus),cy=h*(origin.y+(.5-origin.y)*focus);
      const radius=h*(.019+.083*smooth(0,.12,t)+.147*smooth(.055,.24,t)+1.09*Math.pow(smooth(.14,.47,t),2.15));
      const entry=smooth(.235,.47,t), travel=clamp((t-.145)/.785), cam=23*(travel-.15*Math.sin(tau*travel));
      const camera=startCamera(cam,ph), oldCamera=startCamera(cam-.23,ph);
      const focal=h/(1.16+.28*smooth(.20,.55,t));
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation="source-over";
      ctx.clearRect(0,0,w,h);
      if (t<.001) return;
      ctx.save(); ctx.translate(cx,cy);
      const atmosphere=smooth(.135,.425,t);
      if (atmosphere>0) {
        ctx.fillStyle="rgba(5,7,15,"+atmosphere+")";
        ctx.fillRect(-cx,-cy,w,h);
      }
      if (entry<1) {
        ctx.save(); ctx.globalAlpha=smooth(0,.052,t)*(1-entry);
        const halo=ctx.createRadialGradient(0,0,radius*.74,0,0,radius*1.28);
        halo.addColorStop(0,colorMix(station,.45,0)); halo.addColorStop(.34,colorMix(station,.5,.13));
        halo.addColorStop(.46,colorMix(station,.72,.78)); halo.addColorStop(.50,colorMix(station,.9,.44));
        halo.addColorStop(.60,colorMix(station,.37,.11));halo.addColorStop(1,colorMix(station,.4,0));
        ctx.fillStyle=halo; ctx.fillRect(-1.3*radius,-1.3*radius,2.6*radius,2.6*radius);
        ctx.save();
        ctx.beginPath();ctx.arc(0,0,radius*.991,0,tau);ctx.clip();
        const interior=ctx.createRadialGradient(-.27*radius,.20*radius,0,0,0,radius*1.14);
        interior.addColorStop(0,"#070c17");interior.addColorStop(.62,"#101726");interior.addColorStop(.88,colorMix(station,.12,.86));interior.addColorStop(1,"#080c16");
        ctx.fillStyle=interior;ctx.fillRect(-radius,-radius,2*radius,2*radius);
        for (const [a,d,l] of backgroundStars) {
          const polar=a+.12*Math.sin(t*tau)+.27*d, lens=Math.sin(1.51*d)*radius;
          const x=Math.cos(polar)*lens,y=Math.sin(polar)*lens,size=(.29+.68*l)*Math.max(.60,Math.sqrt(radius/h)*1.52);
          ctx.fillStyle=colorMix(station,l,.28+l*.64);
          ctx.fillRect(x,y,size,size);
        }
        ctx.restore();
        for (let i=0;i<9;i++) {
          ctx.strokeStyle=colorMix(station,i/9,.20+.40*(1-i/9));ctx.lineWidth=Math.max(.48,radius*.004);
          const angle=ph+i*2.29+t*.55;
          ctx.beginPath();ctx.ellipse(0,0,radius*(.982+.004*i),radius*(.983+.004*i),.1,angle,angle+.32+.14*i);ctx.stroke();
        }
        if (index===4) {
          ctx.strokeStyle=colorMix(station,.90,.66);ctx.lineWidth=Math.max(.8,radius*.013);
          ctx.beginPath();ctx.ellipse(0,0,radius*1.6,radius*.22,-.12,0,Math.PI);ctx.stroke();
        }
        ctx.restore();
      }
      if (t>.18 && t<.99) {
        ctx.save();
        const intensity=smooth(.18,.43,t)*(1-smooth(.825,.989,t));
        if (entry<.98) { ctx.beginPath();ctx.arc(0,0,Math.max(1,radius*.98),0,tau);ctx.clip(); }
        const atlas=readFlow();
        if (!paintMedium && atlas) paintMedium=softwareMedium(atlas,station);
        if (paintMedium) {
          const gas=paintMedium(camera,w/h,h/focal,cx/w,cy/h);
          ctx.globalAlpha=intensity;
          ctx.drawImage(gas,-cx,-cy,w,h);
          ctx.globalAlpha=1;
        }
        ctx.globalCompositeOperation="lighter";
        const pole=ctx.createRadialGradient(0,0,h*.04,0,0,h*.8);
        pole.addColorStop(0,colorMix(station,.22,0));pole.addColorStop(.65,colorMix(station,.17,.084*intensity));
        pole.addColorStop(1,colorMix(station,.83,.10*intensity));
        ctx.fillStyle=pole;ctx.fillRect(-cx,-cy,w,h);
        if (!paintMedium) {
          const slices=22, distances=Array.from({length:slices},(_,j)=>.36*1.19**j);
          const centres=distances.map(d=>curve(cam+d,ph));
          for (const thread of ribbons) {
            const points=[];
            for (let j=0;j<slices;j++) {
              const z=cam+distances[j], a=thread.a+.185*z+.24*Math.sin(.47*z+thread.bias)+.065*Math.cos(.73*z+thread.a);
              const r=thread.r+.14*Math.sin(.68*z+ph);
              points.push(projected(centres[j][0]+r*Math.cos(a),centres[j][1]+r*Math.sin(a),z,camera,focal));
            }
            const light=.4+.6*Math.cos(thread.a+ph+.21*cam+thread.bias*.25)**2;
            const hue=clamp(.46+.53*Math.cos(thread.a+ph-.09*cam));
            const alpha=(.12+.45*thread.bright)*light*intensity;
            for (let group=0;group<3;group++) {
              const start=group*7, end=group===2 ? slices-1 : start+7;
              ctx.beginPath();ctx.moveTo(...points[start]);
              for (let j=start+1;j<=end;j++) ctx.lineTo(...points[j]);
              ctx.lineWidth=(.58+thread.width/(1+group*1.4))*Math.max(.65,h/820);
              ctx.strokeStyle=colorMix(station,hue,alpha*(1-.22*group));ctx.stroke();
              if (thread.bright>.68 && group<2) {
                ctx.lineWidth*=4.;ctx.strokeStyle=colorMix(station,hue,alpha*.12);ctx.stroke();
              }
            }
          }
        }
        ctx.lineCap="round";
        for (const grain of grains) {
          const depth=grain.z-cam;
          if(depth<.3 || depth>12) continue;
          const [x,y]=projected(grain.x,grain.y,grain.z,camera,focal);
          if(x < -cx-40 || x>w-cx+40 || y < -cy-40 || y>h-cy+40) continue;
          const tail=projected(grain.x,grain.y,grain.z,oldCamera,focal);
          ctx.strokeStyle=colorMix(station,grain.color,intensity*(.08+.70*grain.power*grain.power)*(1-smooth(5,12,depth)));
          ctx.lineWidth=(.55+.93*grain.power)*Math.max(.7,h/820);
          ctx.beginPath();ctx.moveTo(...tail);ctx.lineTo(x+.12,y+.12);ctx.stroke();
        }
        ctx.restore();
      }
      const dim=smooth(.82,.989,t);
      if (dim>0) { ctx.fillStyle="rgba(6,7,12,"+dim+")";ctx.fillRect(-cx,-cy,w,h); }
      ctx.restore();
    },
    dispose() {}
  };
}

export function createPassage(canvas,index,origin,skyCanvas) {
  // The previous scene is composed by the browser under this transparent
  // canvas. It works even when its WebGL drawing buffer has been discarded.
  const station=stations[index] || stations[0];
  const centre={x:clamp(Number.isFinite(origin?.x)?origin.x:.5),y:clamp(Number.isFinite(origin?.y)?origin.y:.5)};
  let layer=canvas, renderer=null, disposed=false;
  function fallback() {
    let context=canvas.getContext("2d");
    if (!context) {
      layer=canvas.cloneNode(false);
      canvas.replaceWith(layer);
      context=layer.getContext("2d");
    }
    if (context) return canvasPassage(layer,context,station,index,centre);
    return {
      draw(t) { layer.style.background=t<.10?"transparent":"radial-gradient(ellipse at center,#151522,#06070c 80%)"; },
      dispose() {}
    };
  }
  try {
    const gl=canvas.getContext("webgl",{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});
    if (gl && !gl.isContextLost()) renderer=glPassage(canvas,gl,station,index,centre);
  } catch { /* A software canvas can still render the flight. */ }
  if (!renderer) renderer=fallback();
  function contextLost(event) {
    event.preventDefault();
    if (!disposed && layer===canvas) {
      renderer.dispose();
      renderer=fallback();
    }
  }
  canvas.addEventListener("webglcontextlost",contextLost);
  return {
    draw(progress) { if (!disposed) renderer.draw(clamp(progress)); },
    dispose() {
      if (disposed) return;
      disposed=true;
      canvas.removeEventListener("webglcontextlost",contextLost);
      renderer.dispose();
      if (layer!==canvas) layer.replaceWith(canvas);
    }
  };
}
