
/* THE BRAIN ON THE DESKTOP'S SCREEN — the OS's own canvas, live where a
   pointer can afford it; a still of the same map everywhere else (the safe
   floor: no always-on canvas on a phone, ever). */
(function(){
  try{
    var c=document.getElementById('ow-map'); if(!c) return;
    var phone=(window.owIsNarrow ? window.owIsNarrow(641) : Math.min(screen.width, innerWidth) <= 640) || matchMedia('(pointer:coarse)').matches;
    if(phone || !window.OW_BRAINMAP){ c.remove(); return; }
    var ctl=window.OW_BRAINMAP.mount(c, { tree: window.OW_BRAINMAP.presetOneway() });
    var still=document.querySelector('#aioBrain .still'); if(still) still.remove();
    if(ctl && ctl.resize){
      requestAnimationFrame(function(){ ctl.resize(); });
      addEventListener('resize', function(){ ctl.resize(); }, {passive:true});
    }
  }catch(_){}
})();
