
(function(){
  var ns='http://www.w3.org/2000/svg';
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A1 — constellation threads + orbiting motes behind the App/OS + Home/Discovery/Workspace clusters */
  var shelves=Array.prototype.slice.call(document.querySelectorAll('#appos .po-shelf, #what .po-shelf'));
  shelves.forEach(function(shelf){
    var svg=document.createElementNS(ns,'svg'); svg.setAttribute('class','po-constellation');
    shelf.insertBefore(svg,shelf.firstChild);
    if(!RM){ for(var i=0;i<4;i++){ var p=document.createElement('i'); p.className='po-orbit';
      p.style.setProperty('--ox',(Math.random()*22-11).toFixed(0)+'px');
      p.style.setProperty('--oy',(Math.random()*22-13).toFixed(0)+'px');
      p.style.setProperty('--od',(11+Math.random()*8).toFixed(1)+'s');
      p.style.animationDelay='-'+(Math.random()*8).toFixed(1)+'s';
      shelf.insertBefore(p,shelf.firstChild); } }
    function draw(){
      var beads=shelf.querySelectorAll('.po-rest'); if(beads.length<2) return;
      var w=shelf.clientWidth,h=shelf.clientHeight; if(!w||!h) return;
      svg.setAttribute('viewBox','0 0 '+w+' '+h); svg.setAttribute('width',w); svg.setAttribute('height',h);
      var pts=[]; for(var b=0;b<beads.length;b++){ var el=beads[b]; pts.push([el.offsetLeft+el.offsetWidth/2, el.offsetTop+el.offsetHeight/2]); }
      while(svg.firstChild) svg.removeChild(svg.firstChild);
      for(var i=0;i<pts.length;i++){ for(var j=i+1;j<pts.length;j++){ var ln=document.createElementNS(ns,'line');
        ln.setAttribute('x1',pts[i][0]);ln.setAttribute('y1',pts[i][1]);ln.setAttribute('x2',pts[j][0]);ln.setAttribute('y2',pts[j][1]); svg.appendChild(ln); } }
      var cx=0,cy=0; pts.forEach(function(p){cx+=p[0];cy+=p[1];}); cx/=pts.length; cy/=pts.length;
      var orbits=shelf.querySelectorAll('.po-orbit');
      for(var k=0;k<orbits.length;k++){ var a=k/orbits.length*6.283; orbits[k].style.left=(cx+Math.cos(a)*w*0.34)+'px'; orbits[k].style.top=(cy+Math.sin(a)*h*0.34)+'px'; }
    }
    draw(); shelf._owDraw=draw;
  });
  /* A4 — inhabited panels: soft aura + drifting memory motes inside each .ow-glass */
  Array.prototype.forEach.call(document.querySelectorAll('.ow-glass'),function(panel){
    var aura=document.createElement('span'); aura.className='owc-aura'; panel.insertBefore(aura,panel.firstChild);
    if(!RM){ for(var i=0;i<5;i++){ var m=document.createElement('i'); m.className='owc-mote';
      m.style.left=(12+Math.random()*74)+'%'; m.style.top=(18+Math.random()*64)+'%';
      m.style.setProperty('--mx',(Math.random()*16-8).toFixed(0)+'px');
      m.style.setProperty('--my',(-(4+Math.random()*12)).toFixed(0)+'px');
      m.style.setProperty('--md',(9+Math.random()*7).toFixed(1)+'s'); m.style.animationDelay='-'+(Math.random()*8).toFixed(1)+'s';
      panel.insertBefore(m,panel.firstChild); } }
  });
  /* A5 — page-wide faint atmosphere (fixed, behind everything; reduces "black void + one object") */
  var amb=document.createElement('div'); amb.className='ow-amb-layer'; document.body.appendChild(amb);
  var hues=['var(--land-hue-1,139,92,255)','var(--land-hue-0,93,226,255)','var(--land-hue-2,176,80,255)',
    'var(--land-hue-1,139,92,255)','var(--land-hue-0,93,226,255)','var(--land-hue-1,139,92,255)'];
  for(var n=0;n<6;n++){ var neb=document.createElement('div'); neb.className='ow-amb neb';
    var hh=hues[n%hues.length]; var sz=(220+Math.random()*240)|0;
    neb.style.width=sz+'px'; neb.style.height=sz+'px';
    neb.style.background='radial-gradient(circle,rgba('+hh+',.08),transparent 70%)';
    neb.style.left=(Math.random()*88)+'%'; neb.style.top=(Math.random()*94)+'%'; amb.appendChild(neb); }
  /* the five outlined "ghost" squares that drifted over the sky are gone (the founder, 2026-10-17: "random pop-it boxes on
     here, which should all be completely removed"; "no boxes should have randomly colored dots inside of them": the
     galaxy's coloured stars showed through them) */
  /* resize / orientation recompute (debounced) — constellations stay attached (canon §18) */
  var t; function recompute(){ shelves.forEach(function(s){ if(s._owDraw) s._owDraw(); }); }
  addEventListener('resize', function(){ clearTimeout(t); t=setTimeout(recompute,120); }, {passive:true});
  addEventListener('orientationchange', function(){ setTimeout(recompute,260); });
})();
