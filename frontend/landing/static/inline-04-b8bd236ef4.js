
/* THE TWO LINES TYPE THEMSELVES IN (founder/493 #2, 534). Each word is kept
   whole (a word never breaks across lines), each letter is laid out from the
   start and only its ink appears, so the line never reflows while it types;
   the caret has no width. Words are split on ordinary spaces only, so a
   non-breaking space still binds its pair. */
(function(){
  var els=[].slice.call(document.querySelectorAll('.ty'));
  if(!els.length) return;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach(function(el){
    var text=el.textContent; el.setAttribute('aria-label', text.replace(/ /g,' '));
    if(still){ el.classList.add('in'); return; }
    var inner=document.createElement('span'); inner.setAttribute('aria-hidden','true');
    var chars=[];
    text.split(' ').forEach(function(word, wi, all){
      var w=document.createElement('span'); w.className='ty-w';
      for(var k=0;k<word.length;k++){ var c=document.createElement('span'); c.className='ty-c'; c.textContent=word[k]; w.appendChild(c); chars.push(c); }
      inner.appendChild(w);
      if(wi<all.length-1){ var sp=document.createElement('span'); sp.className='ty-c'; sp.textContent=' '; inner.appendChild(sp); chars.push(sp); }
    });
    el.textContent=''; el.appendChild(inner); el._ty=chars; el.classList.add('ty-armed');
  });
  if(still) return;
  function play(el){
    if(el._played) return; el._played=true; el.classList.add('in');
    var chars=el._ty||[], n=0, per=Math.max(16, Math.min(38, 1500/Math.max(1,chars.length)));
    var caret=document.createElement('span'); caret.className='ty-caret';
    (function step(){
      if(n<chars.length){ chars[n].classList.add('on'); chars[n].parentNode.insertBefore(caret, chars[n].nextSibling); n++; setTimeout(step, per); }
      else setTimeout(function(){ if(caret.parentNode) caret.parentNode.removeChild(caret); }, 1400);
    })();
  }
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ play(e.target); io.unobserve(e.target); } }); },{threshold:.35});
    els.forEach(function(el){ io.observe(el); });
  }
  /* fail-open: a line already on screen, or one the observer missed, plays anyway */
  function sweep(){ els.forEach(function(el){ if(el._played) return; var r=el.getBoundingClientRect(); if(r.top<innerHeight*.9 && r.bottom>0) play(el); }); }
  addEventListener('scroll', sweep, {passive:true}); setTimeout(sweep, 900); setTimeout(sweep, 2500);
})();
