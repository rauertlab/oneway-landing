
/* THE ROTATING NOUN — "Connect your ___ in one place." ★ FOUNDER/412: as
   smooth as when it was the main wordmark. Runs after the sentence exists;
   the first width is measured once the display face has loaded. */
(function(){
  var el=document.getElementById('rotWord'); if(!el) return;
  var words=['communities','people','hotel','casino','city','convention center',
             'stadium','restaurant','museum','school','church','club','neighborhood',
             'business','brand','organization'];
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var m=document.createElement('span'); m.className='rot-measure'; el.parentNode.appendChild(m);
  function sync(){ var cs=getComputedStyle(el); m.style.font=cs.font; m.style.letterSpacing=cs.letterSpacing; }
  function widthOf(w){ m.textContent=w; return m.getBoundingClientRect().width; }
  function fit(){ sync(); el.style.width=widthOf(el.textContent)+'px'; }
  fit();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  addEventListener('resize', fit, {passive:true});
  var i=0;
  setInterval(function(){
    var next=words[(i+1)%words.length];
    sync();
    el.style.width=widthOf(next)+'px';
    el.classList.add('sw');
    setTimeout(function(){ i=(i+1)%words.length; el.textContent=next; el.classList.remove('sw'); },220);
  },1900);
})();
