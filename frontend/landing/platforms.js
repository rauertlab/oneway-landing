/* ONEWAY — THE PLATFORMS WHEEL  (frontend/landing/platforms.js)

   ★ FOUNDER/794, 2026-10-16: *"add a scrolling wheel of ALL Of the platforms oneway works with and was built to work
     with. the exact icons and wordmarks and links to their sites."*

   THE LIST IS NOT WRITTEN HERE. tools/platforms_wheel.py reads it from the code (each platform with the function,
   constant or file that connects to it, re-checked on every run) and projects it into the page as a plain list of
   links between its PLATFORMS markers, so the page works with no script at all. This file only makes that list move:
   it lays a second, silent copy of each row beside the first, so the row can drift by exactly one copy and loop with no
   seam, and gives each row the duration that moves it at one speed.

   THE MOTION IS THE LANDING'S OWN (index.html `.eco-run`) and is CSS (platforms.css), so it runs off the main thread:
     · it stands still under the pointer and while a link in it has the keyboard's focus; a focused link that is out
       of its lane is brought in, so the person sees what they are on;
     · it stands still while it is off the screen;
     · with reduced motion it never moves: the rows stand as a wrapped list, and the copy is not drawn.

   NOTHING SHIFTS. The wheel's layout is in place from the first paint (`@media (scripting:enabled)`); the copy goes in
   to the right of a row that is already wider than its lane, and the drift starts from where the row stands. Until
   this file has run a row scrolls in its lane (platforms.css), so a person who has swiped it before the wheel turns on
   keeps what they see: the scroll becomes the drift's starting point.

   PROPOSED, for his eye: the speed. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  if (OW.platforms) return;
  var doc = global.document;
  /* px a second, both rows: the landing's own drifting strip (index.html .eco-track, 46 s over its width) measured 26.4
     at 1280 on 2026-10-17 (context/audits/platforms-wheel-2026-10-17/probe.json, `eco`) */
  var SPEED = 26;
  var PAD = 16;            /* how far inside its lane a focused link is brought */

  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }
  function rowOf(lane) { return lane.querySelector('.owpl-row:not(.owpl-row--echo)'); }
  function trackOf(lane) { return lane.querySelector('.owpl-track'); }
  function animOf(lane) {
    var t = trackOf(lane);
    try { return (t && t.getAnimations && t.getAnimations()[0]) || null; } catch (e) { return null; }
  }

  /* one speed for both rows: a row's duration is its own width over SPEED. When the width changes (the face arrives,
     the window turns) the row keeps its place in the loop rather than jumping to wherever the new duration puts it. */
  function pace(lane) {
    var row = rowOf(lane);
    if (!row) return;
    var w = row.getBoundingClientRect().width;
    if (!w || Math.abs(w - (lane.__w || 0)) < 0.5) return;
    /* the duration as the sheet will hold it (two decimals), so a time set from it is a time inside the loop */
    var dur = parseFloat((w / SPEED).toFixed(2)), a = animOf(lane), p = null;
    try { if (a && a.effect) p = a.effect.getComputedTiming().progress; } catch (e) { p = null; }
    lane.style.setProperty('--owpl-dur', dur.toFixed(2) + 's');
    lane.__w = w; lane.__dur = dur;
    if (a && p != null) { try { a.currentTime = p * dur * 1000; } catch (e) {} }
  }

  /* a link reached with the keyboard is brought inside its lane (the row is paused while it has the focus) */
  function reveal(link) {
    var lane = link.closest('.owpl-lane');
    if (!lane) return;
    if (lane.scrollLeft) lane.scrollLeft = 0;          /* where `overflow:clip` is not known, focus scrolls the lane */
    var a = animOf(lane);
    if (!a || !lane.__w || !lane.__dur) return;
    var lr = lane.getBoundingClientRect(), r = link.getBoundingClientRect(), tr = trackOf(lane).getBoundingClientRect();
    var move = 0;
    if (r.left < lr.left + PAD) move = lr.left + PAD - r.left;
    else if (r.right > lr.right - PAD) move = lr.right - PAD - r.right;
    if (!move) return;
    /* the drift is measured from the track's start, inside the lane's own room for the focus ring (platforms.css) */
    var room = 0;
    try { room = parseFloat(global.getComputedStyle(lane).paddingLeft) || 0; } catch (e) { room = 0; }
    var W = lane.__w, x = Math.max(-W, Math.min(0, (tr.left - lr.left - room) + move));
    var p = lane.classList.contains('owpl-lane--back') ? (x + W) / W : -x / W;
    /* the back row's start is the loop's last moment; one millisecond short of it (a few hundredths of a pixel), never
       the end itself, which is the next loop's first moment and would show the copy instead */
    var end = lane.__dur * 1000;
    try { var d = a.effect.getComputedTiming().duration; if (d > 0 && isFinite(d)) end = d; } catch (e) {}
    try { a.currentTime = Math.max(0, Math.min(p * end, end - 1)); } catch (e) {}
  }

  /* a row a person scrolled by `s` before the wheel was on starts its drift there: the ahead row stands at -s when the
     loop is s/W through, the back row (which runs from -W to 0) when it is (W - s)/W through */
  function holdAt(lane, s) {
    var a = animOf(lane), W = lane.__w, dur = lane.__dur;
    if (lane.scrollLeft) lane.scrollLeft = 0;
    if (!a || !W || !dur) return;
    s = Math.max(0, Math.min(W, s));
    var p = lane.classList.contains('owpl-lane--back') ? (W - s) / W : s / W;
    try { a.currentTime = Math.min(p, 0.9999) * dur * 1000; } catch (e) {}
  }

  function mount(host) {
    if (!host || host.__owpl) return host;
    var lanes = host.querySelectorAll('.owpl-lane');
    if (!lanes.length) return host;
    host.__owpl = true;
    each(lanes, function (lane) {
      var track = trackOf(lane), row = rowOf(lane);
      if (!track || !row) return;
      if (!track.querySelector('.owpl-row--echo')) {
        var echo = row.cloneNode(true);
        echo.classList.add('owpl-row--echo');
        echo.setAttribute('aria-hidden', 'true');
        echo.setAttribute('inert', '');
        each(echo.querySelectorAll('a'), function (el) { el.setAttribute('tabindex', '-1'); });
        track.appendChild(echo);
      }
      pace(lane);
    });
    host.addEventListener('focusin', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('a.owpl-i') : null;
      if (el) reveal(el);
    });
    var again = function () { each(lanes, pace); };
    if (global.ResizeObserver) {
      var ro = new global.ResizeObserver(again);
      each(lanes, function (lane) { var row = rowOf(lane); if (row) ro.observe(row); });
    } else {
      global.addEventListener('resize', again);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(again);
    }
    if (global.IntersectionObserver) {
      new global.IntersectionObserver(function (seen) {
        seen.forEach(function (s) { if (s.isIntersecting) host.removeAttribute('data-off'); else host.setAttribute('data-off', ''); });
      }).observe(host);
    }
    var stood = [];
    each(lanes, function (lane) { stood.push(lane.scrollLeft || 0); });
    host.setAttribute('data-on', '');
    each(lanes, function (lane, i) { if (stood[i]) holdAt(lane, stood[i]); });
    return host;
  }

  function start() { each(doc.querySelectorAll('[data-ow-platforms]'), mount); }

  OW.platforms = { mount: mount, SPEED: SPEED };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
