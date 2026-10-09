
/* HIS OS SENTENCE, LINED UP AT EVERY WIDTH (the founder, 2026-10-09: "no line them up that looks misspaced"). The
   stylesheet's column widths line the two halves up where they were measured; between those widths the halves wrap
   to different line counts and end on different rows (measured: 6 and 7 lines at 320 px, 2 and 3 at 768 and 1024).
   So the split between the columns moves until both halves run the same number of lines: the fewest both can share,
   from the middle of the range of splits that give it. Without script the stylesheet's widths stand. */
(function(){
  var box=document.querySelector('.os-flow'); if(!box) return;
  var a=box.querySelector('.os-flow__a'), b=box.querySelector('.os-flow__b'); if(!a || !b) return;
  function lines(el){
    var r=document.createRange(); r.selectNodeContents(el);
    var rs=r.getClientRects(), seen={}, n=0;
    for(var i=0;i<rs.length;i++){ var t=Math.round(rs[i].top); if(!seen[t]){ seen[t]=1; n++; } }
    return n;
  }
  function split(f){ box.style.gridTemplateColumns='minmax(0,'+f.toFixed(2)+'fr) minmax(0,'+(2-f).toFixed(2)+'fr)'; }
  var laidAt='';
  function lay(){
    // the box stops growing at its max width while the type still scales with the window, so both are the key
    var w=box.clientWidth; if(!w) return;
    var key=w+'/'+getComputedStyle(box).fontSize; if(key===laidAt) return; laidAt=key;
    box.style.gridTemplateColumns='';
    if(lines(a)===lines(b)) return;
    var fits=[], fewest=Infinity;
    for(var k=0;k<=50;k++){
      var f=0.5+k*0.02; split(f);
      var n=lines(a); if(n!==lines(b)) continue;
      if(n<fewest){ fewest=n; fits=[]; }
      if(n===fewest) fits.push(f);
    }
    if(fits.length) split(fits[fits.length>>1]); else box.style.gridTemplateColumns='';
  }
  lay();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ laidAt=''; lay(); });
  addEventListener('resize', function(){ requestAnimationFrame(lay); }, {passive:true});
})();
