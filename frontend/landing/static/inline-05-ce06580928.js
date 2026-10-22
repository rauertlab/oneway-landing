
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
  /* FAST, ON EVERY PLATFORM AND BROWSER (the founder, 2026-10-21: "the text typing and popping on the landing page needs to
     always type fast no matter the platform and browser"). It typed one letter per timer, 16 to 38 ms apart, so wherever a
     browser held its timers back or the phone was busy every letter waited: measured 1.7 to 2.2 s a line, and 3.4 to 6.1 s
     with the processor slowed six times (a line left half typed after 3.5 s). Now the letters shown follow the clock, read
     on each frame: a late frame shows every letter that is due at once, so a line is typed within 0.38 to 0.8 s whatever the
     frames do, and a timer types the rest if the frames stop altogether (a background tab, a phone saving power). */
  function play(el){
    if(el._played) return; el._played=true; el.classList.add('in');
    var chars=el._ty||[], n=0, done=false, t0=null, total=Math.max(380, Math.min(800, chars.length*9));
    var caret=document.createElement('span'); caret.className='ty-caret';
    function upTo(k){
      k=Math.min(chars.length, k); if(k<=n) return;
      for(; n<k; n++) chars[n].classList.add('on');
      var last=chars[n-1]; if(last && last.parentNode) last.parentNode.insertBefore(caret, last.nextSibling);
    }
    function end(){
      if(done) return; done=true; upTo(chars.length);
      setTimeout(function(){ if(caret.parentNode) caret.parentNode.removeChild(caret); }, 1100);
    }
    function frame(t){
      if(done) return;
      if(t0===null) t0=t;
      upTo(Math.ceil((t-t0)/total*chars.length));
      if(n<chars.length) requestAnimationFrame(frame); else end();
    }
    requestAnimationFrame(frame);
    setTimeout(end, total+250);
  }
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ play(e.target); io.unobserve(e.target); } }); },{threshold:.35});
    els.forEach(function(el){ io.observe(el); });
  }
  /* fail-open: a line already on screen, or one the observer missed, plays anyway */
  function sweep(){ els.forEach(function(el){ if(el._played) return; var r=el.getBoundingClientRect(); if(r.top<innerHeight*.9 && r.bottom>0) play(el); }); }
  addEventListener('scroll', sweep, {passive:true}); setTimeout(sweep, 900); setTimeout(sweep, 2500);
})();
