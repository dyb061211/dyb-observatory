// Rays are integrated in units of GM/c². Azimuth is measured in turns.
const TAU = 2 * Math.PI;
const WIDTH = 25, HEIGHT = 15.625;
export const horizonAspect = HEIGHT / WIDTH;
export const horizonScale = 1.24;
export const shadowFraction = Math.sqrt(27) / WIDTH;

export async function loadHorizon() {
  async function image(name) {
    const art = new Image();
    art.src = new URL("./sky/horizon-" + name, import.meta.url).href;
    await art.decode();
    return art;
  }
  const [rays, plasma] = await Promise.all([image("rays.png"), image("plasma.webp")]);
  return {rays, plasma};
}

// A ray can cross the equatorial disk on both sides of the shadow. Both
// images sample the same moving gas, including a light-travel delay.
const surfaceFragment = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying mediump vec2 vUV;
  uniform sampler2D uRays, uPlasma;
  uniform float uTime, uElevation, uSoftness;
  const float pi=3.14159265, tau=6.28318531;

  float radiusAt(float impact, float sweep) {
    vec2 uv=(vec2(clamp((impact-.012)/31.988,0.,1.),sweep/tau)*vec2(1279.,511.)+.5)/vec2(1280.,512.);
    vec2 bytes=texture2D(uRays,uv).rg;
    return 2./max(dot(bytes,vec2(256./257.,1./257.)),.04);
  }
  float speedAt(float lane) {
    return .215*exp(-2.25*lane/10.);
  }
  float hotspot(float angle,float r,float center,float radialWidth,float speed,float offset,float time) {
    float d=(r-center)/radialWidth;
    float phase=tau*(angle-time*speed-offset)+.55*d;
    return exp(-.85*d*d)*(exp(26.*(cos(phase)-1.))+.39*exp(6.*(cos(phase+.47)-1.)));
  }
  vec4 gas(float r,float angle,float impactX,float time,float indirect) {
    float plunge=smoothstep(3.05,4.25,r)*(1.-smoothstep(4.9,6.,r));
    float coverage=(smoothstep(4.55,6.05,r)+.23*plunge)*(1.-smoothstep(17.,24.4,r));
    if(coverage<.003)return vec4(0.);
    float radial=clamp(log(r/3.25)/2.04,0.,1.);
    float lane=radial*10.;
    vec2 uv=vec2(angle,radial*.98+.01);
    // Adjacent annuli advect independently. Their crossfade avoids winding
    // the entire texture into subpixel rings during a long visit.
    vec3 a=texture2D(uPlasma,vec2(fract(uv.x-time*speedAt(floor(lane))),uv.y)).rgb;
    vec3 b=texture2D(uPlasma,vec2(fract(uv.x-time*speedAt(floor(lane)+1.)),uv.y)).rgb;
    vec3 flow=mix(a,b,smoothstep(.12,.88,fract(lane)));
    vec2 eddyUV=vec2(fract(2.*uv.x-.12*time+.21*radial),fract(1.83*radial+.23));
    float detail=texture2D(uPlasma,eddyUV).g;
    float mass=pow(max(.01,flow.r),2.);
    float filaments=pow(flow.g,2.4)*(.44+2.1*detail);
    float knots=hotspot(angle,r,7.35,1.06,.15,.06,time)
              +.89*hotspot(angle,r,10.7,1.36,.096,.49,time)
              +.69*hotspot(angle,r,15.35,2.08,.061,.79,time);
    float shift=sqrt(max(.23,1.-3./r))/max(.46,1.+impactX*cos(uElevation)/pow(r,1.5));
    float streams=2.55*flow.b*(.46+flow.r)+4.8*knots*(.38+mass+.60*flow.g);
    float heat=((.074+1.67*mass+1.64*filaments)*pow(shift,1.82)+streams*(.60+.53*shift))
                *pow(8.8/r,1.10)*(1.-.29*indirect);
    vec3 color=1.-exp(-heat*vec3(1.68,.62,.204));
    color+=vec3(.0,.085,.21)*smoothstep(1.40,3.95,heat)*(.57+.43*smoothstep(.88,1.35,shift));
    float opacity=coverage*(.69+.29*flow.r)*(1.-.47*plunge);
    return vec4(color*opacity,opacity);
  }
  vec4 over(vec4 nearLayer,vec4 farLayer){return nearLayer+farLayer*(1.-nearLayer.a);}
  void main() {
    vec2 p=(vUV*2.-1.)*vec2(25.,15.625);
    float impact=max(length(p),.0001);
    vec2 dir=p/impact;
    float sine=sin(uElevation), cosine=cos(uElevation);
    float sweep=atan(sine,-dir.y*cosine);
    float azimuth=atan(dir.x*sin(sweep),cosine*cos(sweep)-dir.y*sine*sin(sweep))/tau;
    float shadow=1.-smoothstep(5.16-uSoftness,5.21+uSoftness,impact);
    float edge=abs(impact-5.218);
    float ring=exp(-edge/max(.048,uSoftness*.70))+.19*exp(-edge/.24);
    float polar=atan(dir.y,dir.x);
    float echo=exp(7.*(cos(polar-1.32*uTime-.4)-1.))+.48*exp(5.*(cos(polar+.78*uTime+1.5)-1.));
    float light=ring*(.18+.20*(1.-dir.x)+1.35*echo);
    vec3 rimColor=mix(vec3(1.,.50,.16),vec3(1.,.91,.70),clamp(echo,0.,1.));
    vec4 result=vec4(vec3(.002,.002,.004)*shadow+light*rimColor,max(shadow,clamp(light,0.,1.)));
    vec4 farGas=gas(radiusAt(impact,sweep+pi),azimuth+.5,p.x,uTime-.87,1.);
    vec4 nearGas=gas(radiusAt(impact,sweep),azimuth,p.x,uTime,0.);
    gl_FragColor=over(nearGas,over(farGas,result));
  }`;

const bloomFragment = `
  precision mediump float;
  varying mediump vec2 vUV;
  uniform sampler2D uSource;
  uniform vec2 uStep;
  uniform float uExtract;
  vec3 sampleLight(vec2 uv){
    vec3 c=texture2D(uSource,uv).rgb;
    float power=max(c.r*.68+c.g*.32,c.b);
    return c*mix(1.,smoothstep(.30,.89,power),uExtract);
  }
  void main(){
    vec3 glow=sampleLight(vUV)*.227027;
    glow+=(sampleLight(vUV+uStep*1.384615)+sampleLight(vUV-uStep*1.384615))*.316216;
    glow+=(sampleLight(vUV+uStep*3.230769)+sampleLight(vUV-uStep*3.230769))*.070270;
    gl_FragColor=vec4(glow,1.);
  }`;

export function createHorizonGL(gl, art, vertex, program, drawQuad) {
  const surface=program(gl,vertex,surfaceFragment), blur=program(gl,vertex,bloomFragment);
  function makeTexture(image, repeat=false) {
    const texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(image) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    }
    return texture;
  }
  gl.activeTexture(gl.TEXTURE0);
  const rays=makeTexture(art.rays), plasma=makeTexture(art.plasma,true);
  const framebuffer=gl.createFramebuffer();
  const base=makeTexture(), horizontal=makeTexture(), bloom=makeTexture();
  let width=0, height=0, smallWidth=0, smallHeight=0, lastTime=-Infinity, lastElevation=0;
  function size(tex,w,h) {
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  }
  function attach(tex,w,h) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.viewport(0,0,w,h);
  }
  function blurPass(source,dest,x,y,extract) {
    attach(dest,smallWidth,smallHeight);
    gl.useProgram(blur.out);
    gl.bindTexture(gl.TEXTURE_2D,source);
    gl.uniform2f(blur.u.uStep,x,y);
    gl.uniform1f(blur.u.uExtract,extract);
    drawQuad(blur);
  }
  function update(time,elevation,diameter) {
    const next=diameter<100?128:diameter<310?384:diameter<620?704:1024;
    const cadence=next<=384?1/16:1/45;
    if(width===next && time>=lastTime && time-lastTime<cadence && Math.abs(elevation-lastElevation)<.0013)return;
    gl.activeTexture(gl.TEXTURE0);
    if(width!==next) {
      width=next;height=Math.round(width*horizonAspect);
      smallWidth=Math.round(width/4);smallHeight=Math.round(height/4);
      size(base,width,height);size(horizontal,smallWidth,smallHeight);size(bloom,smallWidth,smallHeight);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.disable(gl.BLEND);
    attach(base,width,height);gl.useProgram(surface.out);
    gl.bindTexture(gl.TEXTURE_2D,rays);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,plasma);
    gl.uniform1i(surface.u.uPlasma,1);
    gl.uniform1f(surface.u.uTime,time);
    gl.uniform1f(surface.u.uElevation,elevation);
    gl.uniform1f(surface.u.uSoftness,Math.min(.16,WIDTH*1.6/width));
    drawQuad(surface);
    gl.activeTexture(gl.TEXTURE0);
    blurPass(base,horizontal,5.6/width,0,1);
    blurPass(horizontal,bloom,0,5.6/height,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    lastTime=time;lastElevation=elevation;
  }
  return {base,bloom,update};
}

// Canvas uses the same two ray intersections. Cache the optical geometry
// once, then only move gas through the visible pixels on each animation tick.
export function createHorizonCanvas(art) {
  function pixels(image) {
    const canvas=document.createElement("canvas");
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    return ctx.getImageData(0,0,image.width,image.height).data;
  }
  const rays=pixels(art.rays), plasma=pixels(art.plasma);
  const surface=document.createElement("canvas");
  surface.width=512;surface.height=Math.round(surface.width*horizonAspect);
  const ctx=surface.getContext("2d"), image=ctx.createImageData(surface.width,surface.height);
  const base=new Uint8ClampedArray(image.data.length);
  const layers=[[],[]], sine=Math.sin(.17), cosine=Math.cos(.17);
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  function inverse(index) {return (rays[index]*256+rays[index+1])/131070;}
  function radius(impact,sweep) {
    const x=clamp((impact-.012)/31.988)*(art.rays.width-1);
    const y=clamp(sweep/TAU)*(art.rays.height-1);
    const ix=Math.floor(x),iy=Math.floor(y),s=x-ix,t=y-iy,k=(iy*art.rays.width+ix)*4;
    const dx=ix<art.rays.width-1?4:0,dy=iy<art.rays.height-1?art.rays.width*4:0;
    return 1/Math.max(.02,(inverse(k)*(1-s)+inverse(k+dx)*s)*(1-t)+(inverse(k+dy)*(1-s)+inverse(k+dy+dx)*s)*t);
  }
  const palette=Array.from({length:3},(_,channel)=>Uint8ClampedArray.from({length:1024},(_,i)=>
    255*(1-Math.exp(-i/105*[1.68,.62,.204][channel])+[0,.06,.15][channel]*smooth(1.4,3.95,i/105))));
  const knotOrbits=[[7.35,1.06,.15,.06,1],[10.7,1.36,.096,.49,.89],[15.35,2.08,.061,.79,.69]];
  for(let y=0;y<surface.height;y++) for(let x=0;x<surface.width;x++) {
    const px=((x+.5)/surface.width*2-1)*WIDTH, py=(1-(y+.5)/surface.height*2)*HEIGHT;
    const impact=Math.max(.0001,Math.hypot(px,py)),dx=px/impact,dy=py/impact;
    const sweep=Math.atan2(sine,-dy*cosine);
    const angle=Math.atan2(dx*Math.sin(sweep),cosine*Math.cos(sweep)-dy*sine*Math.sin(sweep))/TAU;
    const offset=(y*surface.width+x)*4,edge=Math.abs(impact-5.218);
    const glow=(Math.exp(-edge/.062)+.22*Math.exp(-edge/.27))*(.75-.23*dx);
    const alpha=Math.max(1-smooth(5.12,5.26,impact),clamp(glow));
    if(alpha>0){
      base[offset]=255*glow/alpha;base[offset+1]=165*glow/alpha;base[offset+2]=76*glow/alpha;base[offset+3]=255*alpha;
    }
    for(let order=1;order>=0;order--) {
      const r=radius(impact,sweep+order*Math.PI),plunge=smooth(3.05,4.25,r)*(1-smooth(4.9,6,r));
      const coverage=(smooth(4.55,6.05,r)+.23*plunge)*(1-smooth(17,24.4,r))*(1-.47*plunge);
      if(coverage<.008)continue;
      const radial=clamp(Math.log(r/3.25)/2.04),lane=radial*10;
      const speed=.215*Math.exp(-2.25*Math.floor(lane)/10);
      const shift=Math.sqrt(Math.max(.23,1-3/r))/Math.max(.46,1+px*cosine/r**1.5);
      const orbit=angle+.5*order, sampleRow=Math.round((radial*.98+.01)*(art.plasma.height-1));
      const weights=knotOrbits.map(([center,width,rate,phase,gain])=>{
        const d=(r-center)/width;
        return [gain*Math.exp(-.85*d*d),orbit-phase+.55*d/TAU,rate];
      }).filter(([weight])=>weight>.012);
      layers[order].push({offset,orbit,speed,row:sampleRow*art.plasma.width,blend:smooth(.12,.88,lane%1),
        intensity:(8.8/r)**1.10*(1-.29*order),thermal:shift**1.82,boost:.60+.53*shift,coverage,weights});
    }
  }
  const wrap=art.plasma.width-1;
  function renderLayer(samples,time) {
    for(const s of samples){
      const a=(s.row+(Math.floor((s.orbit-time*s.speed)*art.plasma.width)&wrap))*4;
      const b=(s.row+(Math.floor((s.orbit-time*s.speed*.798516)*art.plasma.width)&wrap))*4;
      const blend=s.blend, mass=(plasma[a]*(1-blend)+plasma[b]*blend)/255;
      const fibers=(plasma[a+1]*(1-blend)+plasma[b+1]*blend)/255;
      const fronts=(plasma[a+2]*(1-blend)+plasma[b+2]*blend)/255;
      let knots=0;
      for(const [weight,angle,speed] of s.weights){
        const phase=(angle-time*speed)*TAU;
        knots+=weight*(Math.exp(26*(Math.cos(phase)-1))+.39*Math.exp(6*(Math.cos(phase+.47)-1)));
      }
      const streams=2.55*fronts*(.46+mass)+4.8*knots*(.38+mass*mass+.60*fibers);
      const energy=((.074+1.67*mass*mass+1.64*fibers**2.4)*s.thermal+streams*s.boost)*s.intensity;
      const color=Math.min(1023,Math.round(energy*105));
      const i=s.offset,nearAlpha=s.coverage*(.69+.29*mass);
      const alpha=nearAlpha+image.data[i+3]/255*(1-nearAlpha),weight=nearAlpha/alpha;
      for(let channel=0;channel<3;channel++){
        image.data[i+channel]=palette[channel][color]*weight+image.data[i+channel]*(1-weight);
      }
      image.data[i+3]=alpha*255;
    }
  }
  let last=-Infinity;
  return function frame(time) {
    if(time<last || time-last>=1/19){
      image.data.set(base);
      renderLayer(layers[1],time-.87);renderLayer(layers[0],time);
      ctx.putImageData(image,0,0);last=time;
    }
    return surface;
  };
}
