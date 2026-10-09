
/* Ambient hero globe — slow, elegant, non-interactive (interaction belongs to the demo section). */
(function(){
  var cv=document.getElementById('heroGlobe'); if(!cv) return;
  /* iOS crash hardening: skip the second canvas entirely on phones (it renders at
     opacity .26 there anyway), and cap DPR — Safari kills tabs over GPU memory. */
  if(Math.min(screen.width,innerWidth)<=640){ cv.remove(); return; }
  var ctx=cv.getContext('2d'), DPR=Math.min(devicePixelRatio||1,1.5), W,H,R;
  function size(){ var r=cv.getBoundingClientRect(); W=cv.width=r.width*DPR; H=cv.height=r.height*DPR; R=Math.min(W,H)*0.36; }
  size(); addEventListener('resize',size);
  var N=620, pts=[], GA=Math.PI*(3-Math.sqrt(5));
  for(var i=0;i<N;i++){ var y=1-(i/(N-1))*2, rad=Math.sqrt(1-y*y), th=GA*i;
    pts.push({x:Math.cos(th)*rad, y:y, z:Math.sin(th)*rad, city:(i%47===0)}); }
  var tilt=-0.42, ct=Math.cos(tilt), st=Math.sin(tilt), rot=0;
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(){
    ctx.clearRect(0,0,W,H); rot+=0.00105;
    var cr=Math.cos(rot), sr=Math.sin(rot), cx=W/2, cy=H/2, t=performance.now()/1000;
    for(var i=0;i<N;i++){ var p=pts[i];
      var x=p.x*cr+p.z*sr, z=-p.x*sr+p.z*cr, y=p.y*ct-z*st; z=p.y*st+z*ct;
      if(z<-0.15) continue;
      var depth=(z+1)/2, px=cx+x*R, py=cy+y*R;
      if(p.city){ var tw=0.65+0.35*Math.sin(t*1.6+i);
        ctx.fillStyle='rgba(207,211,255,'+(0.5*depth*tw+0.12)+')';
        ctx.beginPath(); ctx.arc(px,py,(1.9+depth)*DPR*0.9,0,7); ctx.fill();
      } else {
        ctx.fillStyle='rgba(169,176,255,'+(0.34*depth+0.045)+')';
        ctx.beginPath(); ctx.arc(px,py,(0.7+depth*0.8)*DPR*0.8,0,7); ctx.fill();
      }
    }
    ctx.strokeStyle='rgba(169,176,255,.14)'; ctx.lineWidth=1.2*DPR;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
    if(!reduced) requestAnimationFrame(frame);
  }
  frame();
})();
