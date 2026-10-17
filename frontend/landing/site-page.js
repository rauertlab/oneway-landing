/* THE MAP'S PAGES — the galaxy, the bar and the reveals, shared by the pages of the founder's map that are built
   from words (/ecosystem, /approach, /contact, /os/business and its industries, /os/developer; see site-page.css).
   The galaxy is app.html's field exactly as it stands (bc83371a, and since 2026-10-10 nothing vanishes on the screen): the stars fly in and take no cursor (the
   founder, 2026-10-09: "remove the pale white dots that follow the cursor"), and only the wireframes keep a slight
   parallax. */
  /* THE GALAXY — the same field the landing pages share, retinted from the
     person's hue (oneway-galaxy.js); the safe floor keeps it light on phones. */
  (function () {
    var canvas = document.getElementById('hero-canvas'); if(!canvas) return;
    var ctx = canvas.getContext('2d'), W, H, CX, CY;
    var DEPTH=1600, FOV=900, isMob=(window.owSafeFloor?window.owSafeFloor():(window.matchMedia&&matchMedia('(pointer:coarse)').matches)), PCOUNT=isMob?90:200, SCOUNT=isMob?8:16;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ PCOUNT=60; SCOUNT=0; }
    function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; CX=W/2; CY=H/2; }
    addEventListener('resize',resize,{passive:true}); resize();
    var WHITE=[255,255,255], CYAN=[6,182,212], PURPLE=[167,139,250], AMBER=[245,158,11];
    if (window.OW && window.OW.galaxy) { window.OW.galaxy.follow({ CYAN:CYAN, PURPLE:PURPLE, AMBER:AMBER }); }
    function rndCol(){ var r=Math.random(); if(r<0.06) return CYAN; if(r<0.14) return PURPLE; if(r<0.17) return AMBER; return WHITE; }
    function project(x,y,z){ if(z<=-FOV+1) return null; var s=FOV/(FOV+z); return {sx:CX+x*s, sy:CY+y*s, s:s}; }
    function rot3(vx,vy,vz,rx,ry,rz){ var y1=vy*Math.cos(rx)-vz*Math.sin(rx), z1=vy*Math.sin(rx)+vz*Math.cos(rx);
      var x2=vx*Math.cos(ry)+z1*Math.sin(ry), z2=-vx*Math.sin(ry)+z1*Math.cos(ry);
      var x3=x2*Math.cos(rz)-y1*Math.sin(rz), y3=x2*Math.sin(rz)+y1*Math.cos(rz); return [x3,y3,z2]; }
    /* NOTHING VANISHES ON THE SCREEN (the founder, 2026-10-10: "particles in background galaxies must not disappear if not travlimng fully of screen first they cannot just vanish in the middle of the screen"): a star or a wireframe flies at you and outward, and is let go only once it is wholly off the screen. Its line of flight is drawn so that happens before it is NEAR_S (a star: never blown up) or SHAPE_S (a wireframe) times nearer, and one just made fades in. */
    var NEAR_S=2.4, NEAR_Z=FOV/NEAR_S-FOV, SHAPE_S=4, SHAPE_Z=FOV/SHAPE_S-FOV, OFF=60, BORN=120, SHAPE_BORN=40;
    function offScreen(sx,sy){ return sx<-OFF||sx>W+OFF||sy<-OFF||sy>H+OFF; }
    function boxOff(pts){ var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(var i=0;i<pts.length;i++){ x0=Math.min(x0,pts[i].sx); x1=Math.max(x1,pts[i].sx); y0=Math.min(y0,pts[i].sy); y1=Math.max(y1,pts[i].sy); } return x1<-OFF||x0>W+OFF||y1<-OFF||y0>H+OFF; }
    function leaves(x,y,rx,ry,s){ return Math.max(0,Math.abs(x)-rx)*s>W/2+OFF || Math.max(0,Math.abs(y)-ry)*s>H/2+OFF; }
    function outbound(xs,ys,rx,ry,s){ var x=0,y=0; for(var k=0;k<24;k++){ x=(Math.random()-.5)*xs; y=(Math.random()-.5)*ys; if(leaves(x,y,rx,ry,s)) return [x,y]; } return [(x<0?-1:1)*((W/2+OFF+1)/s+rx), y]; }
    function mkP(init){ var col=rndCol(), acc=col!==WHITE, xy=outbound(W*3.5,H*3.5,0,0,NEAR_S); return {x:xy[0], y:xy[1],
      z:init?Math.random()*DEPTH:DEPTH, vz:-(0.25+Math.random()*0.55), col:col,
      alpha:acc?(0.45+Math.random()*0.45):(0.12+Math.random()*0.55), r:acc?(0.8+Math.random()*2.2):(0.35+Math.random()*1.4)}; }
    var particles=[]; for(var i=0;i<PCOUNT;i++) particles.push(mkP(true));
    function mkS(){ var cols=[CYAN,PURPLE,AMBER], col=cols[Math.floor(Math.random()*3)], sides=Math.random()>.45?3:4, size=28+Math.random()*88, verts=[];
      for(var i=0;i<sides;i++){ var a=(i/sides)*Math.PI*2; verts.push([Math.cos(a)*size, Math.sin(a)*size, (Math.random()-.5)*size*.6]); }
      var reach=size*1.05, xy=outbound(W*3,H*2.5,reach+27,reach+17,FOV/(FOV/SHAPE_S+reach));
      return {x:xy[0], y:xy[1], z:120+Math.random()*1400, vz:-(0.06+Math.random()*0.16),
        rx:Math.random()*6.28, drx:(Math.random()-.5)*.006, ry:Math.random()*6.28, dry:(Math.random()-.5)*.007,
        rz:Math.random()*6.28, drz:(Math.random()-.5)*.005, verts:verts, col:col, alpha:0.18+Math.random()*0.28}; }
    var shapes=[]; for(var k=0;k<SCOUNT;k++) shapes.push(mkS());
    /* NO DOT FOLLOWS THE CURSOR (the founder, 2026-10-09: "remove the pale white dots that follow the cursor", and "i still wanna keep the moving galaxy effect"): the stars fly in as before and take no cursor, and each leaves by an edge before it comes close (above); only the wireframes keep a slight parallax */
    var mx=.5, my=.5; addEventListener('mousemove',function(e){ mx=e.clientX/W; my=e.clientY/H; },{passive:true});
    function frame(){ ctx.clearRect(0,0,W,H); var pmx=(mx-.5)*90, pmy=(my-.5)*55;
      for(var i=0;i<shapes.length;i++){ var sh=shapes[i]; sh.rx+=sh.drx; sh.ry+=sh.dry; sh.rz+=sh.drz; sh.z+=sh.vz;
        var pts=sh.verts.map(function(v){ var r=rot3(v[0],v[1],v[2],sh.rx,sh.ry,sh.rz); return project(sh.x+r[0]+pmx*.6, sh.y+r[1]+pmy*.6, sh.z+r[2]); });
        if(pts.some(function(p){ return !p; }) || (sh.z<SHAPE_Z && boxOff(pts))){ shapes[i]=mkS(); shapes[i].z=DEPTH; continue; }
        var s0=pts[0].s, alpha=sh.alpha*Math.min(1,s0*1.4)*Math.min(1,(DEPTH-sh.z)/SHAPE_BORN); if(alpha<.015) continue;
        ctx.beginPath(); ctx.moveTo(pts[0].sx,pts[0].sy); for(var j=1;j<pts.length;j++) ctx.lineTo(pts[j].sx,pts[j].sy); ctx.closePath();
        ctx.strokeStyle='rgba('+sh.col[0]+','+sh.col[1]+','+sh.col[2]+','+alpha.toFixed(3)+')'; ctx.lineWidth=Math.max(.25,s0*1.1); ctx.stroke(); }
      for(var n=0;n<particles.length;n++){ var p=particles[n]; p.z+=p.vz;
        var pr=project(p.x,p.y,p.z);
        if(!pr || (p.z<NEAR_Z && offScreen(pr.sx,pr.sy))){ particles[n]=mkP(false); continue; }
        if(offScreen(pr.sx,pr.sy)) continue; var size=p.r*pr.s*2.2, al=p.alpha*Math.min(1,pr.s*2)*Math.min(1,(DEPTH-p.z)/BORN);
        if(al<.01||size<.15) continue; ctx.beginPath(); ctx.arc(pr.sx,pr.sy,Math.max(.2,size),0,6.28);
        ctx.fillStyle='rgba('+p.col[0]+','+p.col[1]+','+p.col[2]+','+al.toFixed(3)+')'; ctx.fill(); }
      if(!still) requestAnimationFrame(frame); }
    /* a person who asked for less motion gets the field once, still */
    var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(frame);
  }());

  /* THE BAR AND THE REVEALS — app.html's: the bar takes its ground once the page moves; a section is visible at
     rest, and only one below the first screen waits to rise, with the scroll itself as the fail-open */
  (function(){
    var nav=document.getElementById('nav');
    function onScroll(){ if(nav) nav.classList.toggle('scrolled', scrollY>16); }
    addEventListener('scroll', onScroll, {passive:true}); onScroll();
    var els=[].slice.call(document.querySelectorAll('.rv'));
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
      els.forEach(function(el){ if(el.getBoundingClientRect().top>innerHeight) el.classList.add('wait'); });
      var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.remove('wait'); io.unobserve(e.target); } }); },{threshold:.12});
      els.forEach(function(el){ io.observe(el); });
      function sweep(){ els.forEach(function(el){ if(!el.classList.contains('wait')) return; var r=el.getBoundingClientRect(); if(r.top<innerHeight*.95 && r.bottom>0) el.classList.remove('wait'); }); }
      addEventListener('scroll', sweep, {passive:true}); setTimeout(sweep, 1500);
    }
  })();
