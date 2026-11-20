import { program } from "./gl-program.js";
import { bodies, limit, smooth, project, worldPoint } from "./flight-world.js?v=3.2";
import { createHorizonGL, createHorizonCanvas, horizonScale, horizonAspect, shadowFraction } from "./horizon.js?v=3.1";

const identity=[1,0,0,0,1,0,0,0,1];
const origin=[0,0,0];
const quad=new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
// Distant objects stay visible as landmarks, without shining through the foreground.
const distantLight = depth => 1 - .85 * smooth(1200, 5900, depth);
const horizonLight = depth => 1 - .95 * smooth(1520, 4100, depth);
const projection=`
  uniform vec3 uEye;
  uniform mat3 uCamera;
  uniform vec2 uAim, uScale;
  vec4 toClip(vec3 world) {
    vec3 d=uCamera*(world-uEye);
    return vec4((d.xy+d.z*uAim)*uScale,d.z-16.,d.z);
  }`;
const panelVert=`
  attribute vec2 aVertex;
  varying mediump vec2 vUV;
  void main(){ vUV=.5+.5*aVertex; gl_Position=vec4(aVertex,0.,1.); }`;
const skyFrag=`
  precision mediump float;
  varying mediump vec2 vUV;
  uniform sampler2D uTexture;
  uniform vec2 uDrift, uLens;
  void main(){
    vec2 p=(vUV-.5)*uLens;
    vec3 fog=texture2D(uTexture,p*.59+.38+uDrift).rgb;
    float edge=smoothstep(.13,.92,length((vUV-.51)*vec2(.95,1.06)));
    gl_FragColor=vec4(fog*(1.-.26*edge),1.);
  }`;
const lensedSkyFrag=`
  precision mediump float;
  varying mediump vec2 vUV;
  uniform sampler2D uSource;
  uniform vec2 uCenter,uRadius;
  void main(){
    vec2 relative=(vUV-uCenter)/uRadius;
    float r=length(relative);
    // Inverse lens equation in Einstein-radius units. A background star
    // near the optical axis appears on both sides of the hole.
    float strength=1.-smoothstep(2.1,4.4,r);
    vec2 source=vUV-relative*uRadius*strength/max(.48,r*r);
    gl_FragColor=vec4(texture2D(uSource,source).rgb,1.);
  }`;
const galaxyVert=`
  ${projection}
  attribute vec2 aVertex;
  uniform vec3 uCenter; uniform mat3 uBasis; uniform vec2 uRadius;
  varying mediump vec2 vUV; varying mediump float vDepth;
  void main(){
    vec3 world=uCenter+uBasis*vec3(aVertex*uRadius,0.);
    gl_Position=toClip(world);
    vUV=.5+.5*aVertex; vDepth=gl_Position.w;
  }`;
const galaxyFrag=`
  precision mediump float;
  uniform sampler2D uTexture,uBloom; uniform float uFade,uHole;
  varying mediump vec2 vUV; varying mediump float vDepth;
  void main(){
    vec4 ink=texture2D(uTexture,vUV);
    if(uHole>1.5){
      vec3 glow=texture2D(uBloom,vUV).rgb*vec3(.71,.61,.49);
      gl_FragColor=vec4((ink.rgb+(1.-.72*ink.rgb)*glow)*uFade,ink.a*uFade);
      return;
    }
    if(uHole>.5){gl_FragColor=vec4(ink.rgb,ink.a*uFade);return;}
    vec3 light=max(ink.rgb-vec3(.006),vec3(0.));
    light=pow(light,vec3(.86))*vec3(1.04,1.05,1.15);
    float fade=uFade*smoothstep(36.,245.,vDepth);
    gl_FragColor=vec4(light,fade);
  }`;
const starVert=`
  ${projection}
  attribute vec3 aPosition,aColor; attribute vec2 aParams;
  uniform mat3 uBasis; uniform vec3 uCenter,uTrail;
  uniform float uTime,uFocal,uRatio,uGain;
  uniform mediump float uMode;
  varying mediump vec4 vColor; varying mediump float vSpark;
  void main(){
    float seed=abs(aParams.y);
    vec3 world=uCenter+uBasis*aPosition;
    if(uMode==2. && aParams.y<0.) world+=uTrail;
    gl_Position=toClip(world);
    float d=gl_Position.w;
    if(d<9.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;vColor=vec4(0.);vSpark=0.;return;}
    float flux=aParams.x*uFocal/max(d,20.);
    float nearFade=smoothstep(8.,38.,d);
    float scint=.86+.14*sin(uTime*(.8+seed)+seed*74.);
    float alpha=clamp(.16+flux*.39,.15,1.)*scint*nearFade*uGain;
    float px=clamp(1.65+flux*4.35,1.65,43.);
    vSpark=step(.959,seed)*smoothstep(.3,1.7,flux);
    if(uMode==1.){alpha*=.84;px=clamp(1.4+flux*3.7,1.4,30.);}
    if(uMode==2.){alpha*=.65*(aParams.y<0.?0.19:1.)*(1.-smoothstep(400.,2100.,d));}
    if(uMode==3.){px=clamp(12.+(8.+seed*11.)*uFocal/d*3.,12.,102.);alpha=.055*nearFade*uGain*(.5+.5*seed);}
    gl_PointSize=px*uRatio; vColor=vec4(aColor,alpha);
  }`;
const starFrag=`
  precision mediump float;
  varying mediump vec4 vColor; varying mediump float vSpark; uniform mediump float uMode;
  void main(){
    if(uMode==2.) {gl_FragColor=vColor;return;}
    vec2 xy=gl_PointCoord*2.-1.;
    float rr=dot(xy,xy);
    if(rr>1.)discard;
    float light=exp(-rr*23.)+.23*exp(-rr*4.8);
    light+=vSpark*.36*(exp(-abs(xy.x)*37.-abs(xy.y)*4.)+exp(-abs(xy.y)*37.-abs(xy.x)*4.));
    if(uMode==3.)light=exp(-rr*4.5)*(1.-smoothstep(.5,1.,rr));
    gl_FragColor=vec4(vColor.rgb,vColor.a*light);
  }`;

function makeGL(canvas,gl,world) {
  const sky=program(gl,panelVert,skyFrag), galaxy=program(gl,galaxyVert,galaxyFrag), stars=program(gl,starVert,starFrag);
  function makeBuffer(data,step) {
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    return {buffer,count:data.length/step};
  }
  const vertices=makeBuffer(quad,2), field=makeBuffer(world.field,8);
  const trailData=[];
  for(let i=0;i<18500;i+=3) {
    const star=Array.from(world.field.subarray(i*8,i*8+8));
    trailData.push(...star);star[7]=-Math.max(.0001,star[7]);trailData.push(...star);
  }
  const trails=makeBuffer(new Float32Array(trailData),8);
  const clusters=world.clusters.map(data=>makeBuffer(data,8));
  const dust=world.clusters.map(data=>{
    const cloud=[]; for(let i=0;i<data.length;i+=8*31) cloud.push(...data.subarray(i,i+8));
    return makeBuffer(new Float32Array(cloud),8);
  });
  function texture(source,repeat=false) {
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    const power=v=>(v & (v-1))===0;
    const mip=power(source.width)&&power(source.height);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    if(mip)gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }
  const atmosphere=texture(world.sky,true), images=world.images.map(image=>texture(image));
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  function select(p) {
    gl.useProgram(p.out);
    // All programs use at most three locations but the linker chooses their order.
    for(let i=0;i<3;i++)gl.disableVertexAttribArray(i);
  }
  function streams(p,asset,layout,stride) {
    gl.bindBuffer(gl.ARRAY_BUFFER,asset.buffer);
    for(const [name,components,offset] of layout) {
      const loc=p.attr[name];gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,components,gl.FLOAT,false,stride,offset);
    }
  }
  const corners=[["aVertex",2,0]], attributes=[["aPosition",3,0],["aColor",3,12],["aParams",2,24]];
  function drawQuad(p) {
    select(p);streams(p,vertices,corners,0);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  const horizon=world.horizon?createHorizonGL(gl,world.horizon,panelVert,program,drawQuad):null;
  const lens=program(gl,panelVert,lensedSkyFrag);
  const skyFrame=gl.createFramebuffer(), skyImage=gl.createTexture();
  let skyWidth=0, skyHeight=0;
  function captureSky() {
    if(skyWidth!==canvas.width || skyHeight!==canvas.height) {
      skyWidth=canvas.width;skyHeight=canvas.height;
      gl.bindTexture(gl.TEXTURE_2D,skyImage);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,skyWidth,skyHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,skyFrame);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,skyImage,0);
  }
  let ratio=1;
  function resize(view) {
    ratio=Math.min(devicePixelRatio||1,view.width>900?1.45:1.65);
    canvas.width=Math.round(view.width*ratio);canvas.height=Math.round(view.height*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  function uniforms(p,cam,v) {
    gl.uniform3fv(p.u.uEye,cam.eye);gl.uniformMatrix3fv(p.u.uCamera,false,cam.axes);gl.uniform2f(p.u.uAim,cam.ax,cam.ay);
    gl.uniform2f(p.u.uScale,2*v.focal/v.width,2*v.focal/v.height);
  }
  function render(cam,v,time,bases,velocity) {
    const hole=bodies[bodies.length-1], pos=project(...hole.center,cam,v);
    const radius=pos?v.focal*hole.radius*horizonScale/pos.d:0;
    const diameter=radius*2, distance=hole.center[2]-cam.eye[2];
    const inView=pos && pos.x+radius>0 && pos.x-radius<v.width &&
      pos.y+radius>0 && pos.y-radius<v.height;
    const useLens=horizon && inView && diameter>95 && distance<3100;
    if(horizon && inView) {
      const elevation=.125+.080*(1-smooth(490,1700,distance))+cam.ay*1.7;
      horizon.update(time,elevation,diameter*ratio);
    }
    gl.activeTexture(gl.TEXTURE0);
    if(useLens)captureSky();
    gl.disable(gl.BLEND);select(sky);streams(sky,vertices,corners,0);
    gl.bindTexture(gl.TEXTURE_2D,atmosphere);
    gl.uniform2f(sky.u.uLens,Math.min(2.4,v.width/v.height),1);
    gl.uniform2f(sky.u.uDrift,cam.eye[0]*.000027+cam.eye[2]*.000010+cam.turnX*.08,cam.eye[1]*.000032+cam.turnY*.07);
    gl.drawArrays(gl.TRIANGLES,0,6);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    function points(asset,mode,center,basis,gain) {
      if(!asset.count)return;
      select(stars);streams(stars,asset,attributes,32);uniforms(stars,cam,v);
      gl.uniform3fv(stars.u.uCenter,center);gl.uniformMatrix3fv(stars.u.uBasis,false,basis);
      gl.uniform1f(stars.u.uTime,time%9000);gl.uniform1f(stars.u.uMode,mode);gl.uniform1f(stars.u.uGain,gain);
      gl.uniform1f(stars.u.uFocal,v.focal);gl.uniform1f(stars.u.uRatio,ratio);gl.uniform3fv(stars.u.uTrail,velocity);
      gl.drawArrays(mode===2?gl.LINES:gl.POINTS,0,asset.count);
    }
    points(field,0,origin,identity,1.1);
    if(useLens) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);
      gl.useProgram(lens.out);gl.bindTexture(gl.TEXTURE_2D,skyImage);
      gl.uniform2f(lens.u.uCenter,pos.x/v.width,1-pos.y/v.height);
      const einstein=radius*shadowFraction*1.56*smooth(3100,1100,distance);
      gl.uniform2f(lens.u.uRadius,Math.max(1,einstein)/v.width,Math.max(1,einstein)/v.height);
      drawQuad(lens);gl.enable(gl.BLEND);
    }
    for(let i=bodies.length-1;i>=0;i--) {
      const b=bodies[i],d=b.center[2]-cam.eye[2];
      if(d < -b.radius)continue;
      const isHole=i===4;
      if(isHole && !inView)continue;
      const liveHole=isHole && horizon;
      if(d>35) {
        select(galaxy);streams(galaxy,vertices,corners,0);uniforms(galaxy,cam,v);
        gl.uniform3fv(galaxy.u.uCenter,b.center);gl.uniformMatrix3fv(galaxy.u.uBasis,false,bases[i]);
        const extent=b.radius*(liveHole?horizonScale:1);
        gl.uniform2f(galaxy.u.uRadius,extent,extent*(liveHole?horizonAspect:isHole?world.images[i].height/world.images[i].width:1));
        gl.uniform1f(galaxy.u.uFade,isHole?horizonLight(d):distantLight(d)*smooth(68,b.radius*.89,d));
        gl.uniform1f(galaxy.u.uHole,liveHole?2:isHole?1:0);
        gl.uniform1i(galaxy.u.uBloom,1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D,liveHole?horizon.bloom:images[i]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,liveHole?horizon.base:images[i]);
        gl.blendFunc(liveHole?gl.ONE:gl.SRC_ALPHA,isHole?gl.ONE_MINUS_SRC_ALPHA:gl.ONE);
        gl.drawArrays(gl.TRIANGLES,0,6);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      }
      if(!isHole && d<2400) {
        points(clusters[i],1,b.center,bases[i],.63+.55*(1-smooth(135,720,Math.abs(d))));
        if(Math.abs(d)<650)points(dust[i],3,b.center,bases[i],1-smooth(180,650,Math.abs(d)));
      }
    }
    const speed=Math.hypot(...velocity);
    if(speed>5)points(trails,2,origin,identity,Math.min(speed/145,1)*.86);
  }
  return {resize,render,canvas,mode:"webgl"};
}

function makeCanvas(canvas,world) {
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)throw new Error("浏览器不支持画布");
  let ratio=1;
  let paintHorizon;
  const tones=["#c4d5ff","#ffdda8","#f1b8e2","#a0dfed"];
  const glows=tones.map(color=>{
    const sprite=document.createElement("canvas");
    sprite.width=sprite.height=64;
    const brush=sprite.getContext("2d"), gradient=brush.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,"#fff9f6");gradient.addColorStop(.07,"#fff5e7");
    gradient.addColorStop(.17,color+"da");gradient.addColorStop(.36,color+"51");gradient.addColorStop(.7,color+"0f");gradient.addColorStop(1,color+"00");
    brush.fillStyle=gradient;brush.fillRect(0,0,64,64);
    return sprite;
  });
  function points(data,step,center,basis,camera,view,time,gain,velocity,flying,volume=false) {
    for(let i=0;i<data.length;i+=step*8) {
      const localX=data[i],localY=data[i+1],localZ=data[i+2];
      const worldX=center[0]+basis[0]*localX+basis[3]*localY+basis[6]*localZ;
      const worldY=center[1]+basis[1]*localX+basis[4]*localY+basis[7]*localZ;
      const worldZ=center[2]+basis[2]*localX+basis[5]*localY+basis[8]*localZ;
      const p=project(worldX,worldY,worldZ,camera,view);
      if(!p||p.x<0||p.y<0||p.x>view.width||p.y>view.height)continue;
      const flux=data[i+6]*view.focal/p.d, size=limit(flux,.52,8);
      const seed=data[i+7];
      const colorIndex=(seed*4)|0;
      const alpha=limit((.30+size*.34)*(.86+.14*Math.sin(time+seed*50))*gain*smooth(9,35,p.d),0,.97);
      ctx.globalAlpha=alpha;
      if(size<.91) {
        ctx.fillStyle=tones[colorIndex];ctx.fillRect(p.x,p.y,size+.23,size+.23);
      } else {
        const radius=1.05+2.65*size;
        ctx.drawImage(glows[colorIndex],p.x-radius,p.y-radius,2*radius,2*radius);
      }
      if(volume && p.d<540 && seed>.975) {
        const radius=Math.min(77,6+17*view.focal/p.d);
        ctx.globalAlpha=alpha*.13;
        ctx.drawImage(glows[colorIndex],p.x-radius,p.y-radius,2*radius,2*radius);
      }
      if(flying && p.d<920 && seed>.77) {
        const end=project(worldX+velocity[0],worldY+velocity[1],worldZ+velocity[2],camera,view);
        if(end) {
          const dx=end.x-p.x,dy=end.y-p.y,length=Math.hypot(dx,dy);
          if(length>2) {
            const fraction=Math.min(1,68/length);
            ctx.globalAlpha=alpha*.37;ctx.strokeStyle=tones[colorIndex];ctx.lineWidth=Math.min(1.45,.55+size*.18);
            ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx*fraction,p.y+dy*fraction);ctx.stroke();
          }
        }
      }
    }
  }
  return {canvas,mode:"canvas",resize(v){ratio=Math.min(devicePixelRatio||1,1.3);canvas.width=Math.round(v.width*ratio);canvas.height=Math.round(v.height*ratio);},
    render(cam,v,time,bases,velocity){
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;
      const shift=cam.eye[0]*.04-cam.turnX*37, drift=cam.eye[1]*.03+cam.turnY*32;
      ctx.drawImage(world.sky,-240+shift,-170+drift,v.width+500,v.height+440);
      const flying=Math.hypot(...velocity)>5;
      ctx.globalCompositeOperation="lighter";points(world.field,2,origin,identity,cam,v,time,1.18,velocity,flying);
      for(let i=bodies.length-1;i>=0;i--) {
        const b=bodies[i], basis=bases[i], d=b.center[2]-cam.eye[2];
        if(d < -b.radius)continue;
        const center=project(...b.center,cam,v), hole=i===4;
        if(center && d>70) {
          let image=world.images[i], extent=b.radius;
          if(hole && world.horizon && horizonLight(d)>.08) {
            if(!paintHorizon)paintHorizon=createHorizonCanvas(world.horizon);
            image=paintHorizon(time);extent*=horizonScale;
          }
          const r=extent*.25;
          const right=project(...worldPoint(b.center,basis,r,0,0),cam,v);
          const up=project(...worldPoint(b.center,basis,0,r*(hole?image.height/image.width:1),0),cam,v);
          if(right&&up) {
            ctx.save();ctx.globalCompositeOperation=hole?"source-over":"screen";
            ctx.globalAlpha=hole?horizonLight(d):distantLight(d)*smooth(68,b.radius*.89,d);
            ctx.transform((right.x-center.x)*4,(right.y-center.y)*4,(center.x-up.x)*4,(center.y-up.y)*4,center.x,center.y);
            ctx.drawImage(image,-1,-1,2,2);ctx.restore();
          }
        }
        if(!hole&&d<1750)points(world.clusters[i],4,b.center,basis,cam,v,time,1.04,velocity,flying,true);
      }
      ctx.globalAlpha=1;
    }};
}

export function createSkyRenderer(canvas,world,forceCanvas=false) {
  if(!forceCanvas) {
    const gl=canvas.getContext("webgl",{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:"default"});
    if(gl)try{return makeGL(canvas,gl,world);}catch(error){ console.warn("使用兼容星空渲染器",error.message); }
  }
  const fresh=canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  return makeCanvas(fresh,world);
}
