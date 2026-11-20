// Positions, camera and particles share one coordinate system; +z is forward.
export const END = 4.32;
export const bodies = [
  { file:"spiral", center:[0,0,0], radius:452, tilt:.83, roll:.32, spin:.034, sign:[.46,-.10], tint:"#f2c0e0" },
  { file:"bar", center:[-270,735,1600], radius:437, tilt:.48, roll:-.47, spin:-.033, sign:[-.33,.27], tint:"#f1cb91" },
  { file:"ring", center:[1470,800,3210], radius:365, tilt:.25, roll:.21, spin:.025, sign:[.58,.43], tint:"#9de2f4" },
  { file:"cloud", center:[-530,-860,4830], radius:434, tilt:.40, roll:.45, spin:-.024, sign:[.20,-.43], tint:"#e9a7e3" },
  { file:"blackhole", center:[805,435,6500], radius:600, tilt:.025, roll:.115, spin:0, sign:[-.40,-.34], tint:"#ffbf83" }
];
export const limit = (n, low=0, high=1) => Math.min(high,Math.max(low,n));
export const smooth = (a,b,x) => { const t=limit((x-a)/(b-a)); return t*t*(3-2*t); };

function randomStream(seed) {
  return () => {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeView(width,height) {
  const focal = Math.min(height * .96, width * .96);
  const portrait = width < height * .95;
  const keys = [];
  for (let i=0; i<bodies.length; i++) {
    const body=bodies[i], [x,y,z]=body.center;
    const distance=i===4 ? 860 : 755;
    const sx=portrait ? .49 : [.605,.585,.61,.575,.605][i];
    const sy=portrait ? .57 : [.555,.515,.545,.54,.535][i];
    const eye=[x-(sx-.5)*width*distance/focal,y+(sy-.5)*height*distance/focal,z-distance];
    keys.push({ at:i, eye });
    if (i<4) {
      // Cross an outer arm, not the singular center of its texture.
      const side=i%2===0 ? 1 : -1;
      const crossingRadius = i===2 ? .72 : .30;
      keys.push({ at:i+.43, eye:[x-side*body.radius*crossingRadius,y+body.radius*.06,z-90] });
      const next=bodies[i+1].center;
      keys.push({ at:i+.68, eye:[x+(next[0]-x)*.32+side*75,y+(next[1]-y)*.32-40,z+347] });
    } else {
      keys.push({ at:END, eye:[x-(sx-.5)*width*490/focal,y+(sy-.5)*height*490/focal,z-490] });
    }
  }
  return {width,height,focal,keys};
}

export function cameraAt(progress,view,time,lookX,lookY) {
  const keys=view.keys;
  let i=0;
  while(i<keys.length-2 && keys[i+1].at<progress) i++;
  const a=keys[i], b=keys[i+1], prev=keys[Math.max(0,i-1)], next=keys[Math.min(i+2,keys.length-1)];
  const dt=b.at-a.at, t=limit((progress-a.at)/dt), t2=t*t, t3=t2*t;
  const eye=a.eye.map((value,axis)=>{
    const m0=(b.eye[axis]-prev.eye[axis])*dt/(b.at-prev.at);
    const m1=(next.eye[axis]-a.eye[axis])*dt/(next.at-a.at);
    return (2*t3-3*t2+1)*value+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b.eye[axis]+(t3-t2)*m1;
  });
  const drift=1-smooth(3.55,3.96,progress);
  eye[0]+=lookX*22+Math.sin(time*.15)*4*drift;
  eye[1]+=lookY*16+Math.sin(time*.21)*2.6*drift;
  // As the current arm passes the lens, turn to pick up the next galaxy.
  // At either end of a leg the camera returns to its composed station view.
  const leg=Math.min(4,Math.floor(progress)), fraction=progress-leg;
  let turnX=0, turnY=0;
  if(leg<4) {
    const dest=bodies[leg+1].center, distance=dest[2]-eye[2];
    const lead=.92*smooth(.22,.59,fraction)*(1-smooth(.69,1,fraction));
    turnX=lead*limit((dest[0]-eye[0])/distance-.055,-1.15,1.15);
    turnY=lead*limit((dest[1]-eye[1])/distance+.02,-.96,.96);
  }
  const horizontal=Math.hypot(turnX,1), length=Math.hypot(horizontal,turnY);
  const right=[1/horizontal,0,-turnX/horizontal];
  const forward=[turnX/length,turnY/length,1/length];
  const up=[forward[1]*right[2],horizontal/length,-forward[1]*right[0]];
  const bank=.045*Math.sin(progress*Math.PI*2)-turnX*.066+lookX*.009;
  const c=Math.cos(bank),s=Math.sin(bank), axes=[];
  for(let axis=0;axis<3;axis++) axes.push(right[axis]*c+up[axis]*s,up[axis]*c-right[axis]*s,forward[axis]);
  return {eye,axes,turnX,turnY,ax:lookX*.020,ay:lookY*.014};
}

export function basisAt(body,time) {
  const rotation=body.spin*time, cr=Math.cos(rotation), sr=Math.sin(rotation);
  const roll=body.roll+(body.spin?Math.sin(time*.13)*.022:0), tilt=body.tilt+(body.spin?Math.sin(time*.09)*.022:0);
  const a=Math.cos(roll), b=Math.sin(roll), c=Math.cos(tilt), d=Math.sin(tilt);
  return [
    a*cr-b*c*sr, b*cr+a*c*sr,d*sr,
    -a*sr-b*c*cr,-b*sr+a*c*cr,d*cr,
    b*d,-a*d,c
  ];
}

export function worldPoint(center,basis,x,y,z) {
  return [center[0]+basis[0]*x+basis[3]*y+basis[6]*z,
    center[1]+basis[1]*x+basis[4]*y+basis[7]*z,
    center[2]+basis[2]*x+basis[5]*y+basis[8]*z];
}

export function project(x,y,z,camera,view) {
  x-=camera.eye[0]; y-=camera.eye[1]; z-=camera.eye[2];
  const a=camera.axes;
  const d=a[2]*x+a[5]*y+a[8]*z;
  if(d<9) return null;
  return {x:view.width*.5+((a[0]*x+a[3]*y+a[6]*z)/d+camera.ax)*view.focal,
    y:view.height*.5-((a[1]*x+a[4]*y+a[7]*z)/d+camera.ay)*view.focal,d};
}

export function loadArt(body) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("星体纹理未加载"));
    image.src=new URL("./sky/"+body.file+".webp",import.meta.url).href;
  });
}

const colors=[[.75,.84,1],[.93,.94,1],[1,.83,.64],[.72,.94,1],[1,.76,.86]];

export function fieldStars() {
  const rand=randomStream(17761), data=[];
  function add(x,y,z,size) {
    const rgb=colors[Math.floor(rand()*colors.length)];
    data.push(x,y,z,...rgb,size,rand());
  }
  for(let i=0;i<18500;i++) {
    const z=-980+rand()*9080;
    const p=limit(z/1620,0,4), j=Math.min(3,Math.floor(p)), t=p-j;
    const a=bodies[j].center,b=bodies[j+1].center;
    add(a[0]+(b[0]-a[0])*t+(rand()-.5)*3640,a[1]+(b[1]-a[1])*t+(rand()-.5)*2620,z,.51+Math.pow(rand(),8)*5.2);
  }
  for(let i=0;i<10800;i++) {
    const z=10300+rand()*12800;
    add((rand()-.5)*z*3.65,(rand()-.5)*z*2.32,z,1.6+Math.pow(rand(),4)*19);
  }
  return new Float32Array(data);
}

// Sample the actual emission map so the three-dimensional stars follow the
// arms, the ring and the cloud knots even as the camera crosses their planes.
export function galaxyStars(body,image,index) {
  if(index===4) return new Float32Array(0);
  const side=192, sampler=document.createElement("canvas");
  sampler.width=sampler.height=side;
  const ctx=sampler.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(image,0,0,side,side);
  const pixels=ctx.getImageData(0,0,side,side).data, cdf=new Float64Array(side*side);
  let total=0;
  for(let j=0;j<cdf.length;j++) {
    const k=j*4;
    const light=Math.max(pixels[k],pixels[k+1],pixels[k+2])/255;
    total+=Math.pow(Math.max(0,light-.028),.90);
    cdf[j]=total;
  }
  const rand=randomStream(55428+2309*index);
  const count=[18000,14500,12700,15000][index], data=new Float32Array(count*8);
  for(let i=0;i<count;i++) {
    let lo=0,hi=cdf.length-1;
    const target=rand()*total;
    while(lo<hi) { const mid=(lo+hi)>>1; if(cdf[mid]<target) lo=mid+1; else hi=mid; }
    const k=lo*4, out=i*8, xx=((lo%side+rand())/side-.5)*2, yy=(.5-((lo/side|0)+rand())/side)*2;
    data[out]=xx*body.radius;
    data[out+1]=yy*body.radius;
    const bulge=Math.exp(-9*(xx*xx+yy*yy));
    data[out+2]=(rand()+rand()+rand()-1.5)*(index===3?92:30+bulge*57);
    const value=Math.max(1,pixels[k],pixels[k+1],pixels[k+2]);
    const color=colors[Math.floor(rand()*colors.length)];
    for(let c=0;c<3;c++) data[out+3+c]=.6*pixels[k+c]/value+.4*color[c];
    data[out+6]=.15+Math.pow(rand(),6)*1.70;
    data[out+7]=rand();
  }
  return data;
}

export function makeAtmosphere() {
  const canvas=document.createElement("canvas");
  canvas.width=512; canvas.height=512;
  const ctx=canvas.getContext("2d"), image=ctx.createImageData(512,512);
  const rand=randomStream(19071), grid=Float32Array.from({length:128*128},rand);
  function noise(x,y,scale) {
    x=x/512*scale; y=y/512*scale;
    const a=Math.floor(x), b=Math.floor(y);
    const tx=x-a, ty=y-b, u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty);
    const get=(i,j)=>grid[((j%scale+scale)%scale)*128+((i%scale+scale)%scale)];
    return (get(a,b)*(1-u)+get(a+1,b)*u)*(1-v)+(get(a,b+1)*(1-u)+get(a+1,b+1)*u)*v;
  }
  for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
    const n=noise(x,y,4)*.48+noise(x+29,y+72,8)*.25+noise(x+91,y,16)*.15+noise(x,y,32)*.08+noise(x,y,64)*.04;
    const fog=Math.pow(limit((n-.24)*2.1),1.65), k=(y*512+x)*4;
    image.data[k]=12+fog*30; image.data[k+1]=12+fog*22; image.data[k+2]=30+fog*44; image.data[k+3]=255;
  }
  ctx.putImageData(image,0,0);
  return canvas;
}
