/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportSettlement(runtime: RuntimeBindings): () => void {
  var settlementRuntimeScript: Dynamic;
  function buildSettlementScript(input?: Dynamic): Dynamic {
    return settlementRuntimeScript
      .replace("__CAP__", String(input.capMs))
      .replace("__EAGER__", input.eagerImages ? "1" : "0")
      .replace("__SCROLL__", input.scrollThrough ? "1" : "0")
      .replace("__OPEN__", input.openDetails ? "1" : "0")
      .replace("__FINISH__", input.finishAnimations ? "1" : "0");
  }
  bindRuntimeValue(
    runtime,
    "buildSettlementScript",
    () => buildSettlementScript,
  );
  bindRuntimeValue(
    runtime,
    "settlementRuntimeScript",
    () => settlementRuntimeScript,
    (value) => {
      settlementRuntimeScript = value;
    },
  );
  return () => {
    settlementRuntimeScript = `(async function(){
  var t0=performance.now(),cap=__CAP__,eager=__EAGER__,scroll=__SCROLL__,openDets=__OPEN__,fin=__FINISH__;
  var left=function(){return Math.max(0,cap-(performance.now()-t0))};
  var race=function(p){return Promise.race([p,new Promise(function(r){setTimeout(r,left())})])};
  var finish=function(){
    var n=0,as=[];
    try{if(fin&&document.getAnimations)as=document.getAnimations()}catch(e){}
    for(var q=0;q<as.length;q++){
      try{
        var a=as[q],tm=a.effect&&a.effect.getComputedTiming();
        if(a.playState==='running'&&tm&&isFinite(tm.endTime)){a.finish();n++}
      }catch(e){}
    }
    return n;
  };
  var fontsReady=false,imagesReady=false;
  await race(document.fonts.ready.then(function(){fontsReady=true}));
  finish();
  if(openDets){
    try{
      var dets=document.querySelectorAll('details');
      for(var i=0;i<dets.length;i++)dets[i].open=true;
    }catch(e){}
  }
  if(eager){
    try{
      var lz=document.querySelectorAll('img[loading="lazy"]');
      for(var j=0;j<lz.length;j++)lz[j].loading='eager';
    }catch(e){}
  }
  if(scroll){
    var sx=window.scrollX,sy=window.scrollY;
    try{
      var sc=document.scrollingElement||document.documentElement;
      var full=Math.max(sc.scrollHeight,document.body.scrollHeight);
      var step=window.innerHeight||800;
      for(var y=0;y<=full&&left()>0;y+=step){
        window.scrollTo(0,y);
        await race(new Promise(function(r){requestAnimationFrame(r)}));
      }
    }catch(e){}finally{try{window.scrollTo(sx,sy)}catch(e){}}
  }
  try{
    var imgs=document.images,p=[];
    for(var k=0;k<imgs.length;k++){
      var im=imgs[k];
      if(im.complete&&im.naturalWidth>0)continue;
      if(!eager&&im.loading==='lazy')continue;
      if(typeof im.decode==='function')p.push(im.decode().catch(function(){}));
    }
    if(p.length)await race(Promise.all(p).then(function(){imagesReady=true}));
    else imagesReady=true;
  }catch(e){}
  try{
    var vs=document.querySelectorAll('video'),vp=[];
    for(var m=0;m<vs.length;m++)(function(v){
      /* only a video that is loading, or will: not one with no source, preload off, or already failed */
      if(v.readyState>=2||v.error||v.networkState===3||!(v.currentSrc||v.src||v.querySelector('source[src]')))return;
      if(v.preload==='none'&&!v.autoplay)return;
      /* capture: a failing <source> fires error on itself, and that does not bubble */
      vp.push(new Promise(function(r){v.addEventListener('loadeddata',r,{once:true});v.addEventListener('error',r,{once:true,capture:true})}));
    })(vs[m]);
    if(vp.length)await Promise.race([Promise.all(vp),new Promise(function(r){setTimeout(r,Math.min(left(),600))})]);
  }catch(e){}
  await race(new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})}));
  if(finish())await race(new Promise(function(r){requestAnimationFrame(r)}));
  return{fontsReady:fontsReady,imagesReady:imagesReady,timedOut:left()<=0};
})()`;
  };
}
