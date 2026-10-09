/* ONEWAY — THE LEGAL PAGES' WORDMARK (frontend/shared/oneway-legal.js)
   The landing's one-element wordmark (index.html, #flyLogo): the white wordmark starts large in the red
   hero, then shrinks and rises into the bar as the page scrolls, and stays there. The same object the whole
   way: no second logo and no crossfade. The founder, 2026-10-05: "strongest wordmark wins and animations
   needs to follow it". With reduced motion it sits in the bar from the start. It reads nothing and stores
   nothing. */
(function () {
  var fly = document.getElementById('flyLogo'), hero = document.querySelector('.hero-mark'),
      slot = document.querySelector('.logo .slot'), sect = document.querySelector('.hero');
  if (!fly || !hero || !slot || !sect) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, g = null;
  function measure() {
    var hr = hero.getBoundingClientRect(), nr = slot.getBoundingClientRect(), keep = fly.style.transform;
    fly.style.transform = 'none';
    var fr = fly.getBoundingClientRect();
    fly.style.transform = keep;
    if (hr.width > 0 && nr.width > 0 && fr.width > 0) {
      g = { fw: fr.width, fh: fr.height, hcx: hr.left + hr.width / 2, hcy: hr.top + hr.height / 2 + window.scrollY,
            ncx: nr.left + nr.width / 2, ncy: nr.top + nr.height / 2, s1: nr.width / fr.width };
    }
  }
  function place() {
    if (!g) return;
    var span = Math.max(160, sect.offsetHeight * 0.7);
    var p = still ? 1 : Math.min(1, Math.max(0, window.scrollY / span));
    var e = 1 - Math.pow(1 - p, 3);                       // decelerate into the dock
    var cy0 = g.hcy - window.scrollY;
    var cx = g.hcx + (g.ncx - g.hcx) * e, cy = cy0 + (g.ncy - cy0) * e, s = 1 + (g.s1 - 1) * e;
    fly.style.transform = 'translate(' + (cx - g.fw / 2) + 'px,' + (cy - g.fh / 2) + 'px) scale(' + s + ')';
  }
  window.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', function () { measure(); place(); }, { passive: true });
  window.addEventListener('load', function () { measure(); place(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); place(); });
  measure(); place();
})();
