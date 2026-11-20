import { createPassage } from "./passage.js?v=4.5";

export function installPassages({stage, anchors, portals, stopCruise, motionAllowed, redraw}) {
  const layer=document.querySelector("#passage");
  const caption=layer.querySelector('[role="status"]');
  const skip=layer.querySelector("button");
  let destination=null, effect=null, raf=0;
  function finish() {
    if (!destination) return;
    cancelAnimationFrame(raf);
    try { sessionStorage.setItem("dyb-arrival",String(Date.now())); } catch {}
    location.assign(destination);
  }
  function reset() {
    cancelAnimationFrame(raf);effect?.dispose();effect=null;destination=null;
    stage.querySelector("#universe")?.style.removeProperty("transform");
    layer.hidden=true;document.body.classList.remove("in-passage");redraw();
  }
  function aim(link,index,event) {
    const core=portals[index], box=core.getBoundingClientRect();
    if (!core.hidden && stage.getBoundingClientRect().top<=2 && stage.getBoundingClientRect().bottom>innerHeight*.5)
      return {x:Math.min(.96,Math.max(.04,(box.left+box.width/2)/innerWidth)),y:Math.min(.96,Math.max(.04,(box.top+box.height/2)/innerHeight))};
    if (event.detail&&link.closest(".atlas-grid")) return {x:event.clientX/innerWidth,y:event.clientY/innerHeight};
    return {x:.54,y:.50};
  }
  document.addEventListener("click",event=>{
    const link=event.target.closest("a[data-enter]");
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.shiftKey||event.ctrlKey||event.altKey)return;
    event.preventDefault();
    if(destination)return;
    const index=Number(link.dataset.enter), core=portals[index];
    if(!core){location.assign(link.href);return;}
    const origin=aim(link,index,event), under=stage.querySelector("#universe");
    stopCruise();
    // Native Back and the link on arrival both restore the actual departure station.
    history.replaceState(history.state,"","#"+anchors[index].id);
    destination=link.href;
    if(!motionAllowed()){finish();return;}
    document.body.classList.add("in-passage");
    layer.hidden=false;layer.style.setProperty("--passage-tint",core.style.getPropertyValue("--tint"));
    caption.textContent="正在飞往"+core.dataset.name;
    const canvas=document.createElement("canvas");
    canvas.setAttribute("aria-hidden","true");layer.querySelector("canvas").replaceWith(canvas);
    if(under)under.style.transformOrigin=`${origin.x*100}% ${origin.y*100}%`;
    skip.focus({preventScroll:true});
    try{effect=createPassage(canvas,index,origin,under);}
    catch{finish();return;}
    let start=null;
    function paint(now) {
      if(start===null)start=now;
      const t=Math.min(1,(now-start)/2650);
      if(under&&t<.55)under.style.transform=`scale(${1+2.2*t*t})`;
      try{effect.draw(t);}catch{finish();return;}
      if(t<1)raf=requestAnimationFrame(paint);else finish();
    }
    raf=requestAnimationFrame(paint);
  });
  skip.addEventListener("click",finish);
  document.addEventListener("keydown",event=>{if(destination&&event.key==="Escape")finish();});
  window.addEventListener("pageshow",event=>{if(event.persisted&&destination)reset();});
  return ()=>!!destination;
}

