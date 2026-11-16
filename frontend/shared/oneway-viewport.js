/* oneway-viewport.js — ONE ANSWER TO "IS THIS A PHONE?", FOR EVERY SURFACE.
 *
 * ★ CANON, already written in `oneway-app.html` and now enforced here:
 *     *"A COARSE POINTER IS THE SAFE FLOOR'S QUESTION, NOT WINDOW WIDTH.
 *       `innerWidth<768` is a proxy for 'phone'; a narrow desktop window trips
 *       it and loses the always-on world for no reason. Canon scopes the safe
 *       floor to TOUCH devices — width is layout, not capability."*
 *
 * WHY THIS FILE EXISTS. That ruling was applied to the App and nowhere else, so
 * every other surface kept its own copy of the old rule and the galaxies became
 * inconsistent in two different ways:
 *
 *   1. A NARROW DESKTOP WINDOW lost the starfield — the exact case the canon
 *      exists to prevent. Still live in `index.html` and `popit-app.html`.
 *   2. A ZERO WIDTH was read as "narrow". `innerWidth` is 0 whenever layout has
 *      not happened yet: a background tab, a prerender, an embedded webview.
 *      `index.html` therefore stripped every blur and REMOVED the hero canvas
 *      on a perfectly ordinary desktop, and no resize brought it back because
 *      the element was gone. Measured 2026-08-24: `innerWidth` 0, `data-fx`
 *      safe, `#hero-canvas` absent, on a 1512px Mac.
 *
 * So the rule lives in one file that every surface loads, and a page that wants
 * the safe floor does not get to invent its own version of the question.
 *
 * Load it in <head>, BEFORE first paint, so nothing heavy ever composites on a
 * phone:  <script src="/frontend/shared/oneway-viewport.js"></script>
 */
(function (global) {
  'use strict';

  var doc = global.document;

  /* THE FIRST WIDTH ANYTHING ACTUALLY KNOWS, and 0 only when nothing does.
     Callers must treat 0 as UNKNOWN — never as small. */
  function width() {
    try {
      var d = doc && doc.documentElement;
      return (global.innerWidth || 0) ||
             (d && d.clientWidth || 0) ||
             (global.screen && global.screen.width || 0) || 0;
    } catch (e) { return 0; }
  }

  function height() {
    try {
      var d = doc && doc.documentElement;
      return (global.innerHeight || 0) ||
             (d && d.clientHeight || 0) ||
             (global.screen && global.screen.height || 0) || 0;
    } catch (e) { return 0; }
  }

  /* THE SAFE FLOOR'S ONE QUESTION. Does not depend on layout having happened,
     which is exactly why it is the right question. */
  function isTouch() {
    try {
      return !!(global.matchMedia && global.matchMedia('(pointer:coarse)').matches);
    } catch (e) { return false; }
  }

  /* NARROW means MEASURED and narrow. Kept for LAYOUT decisions — how many
     columns, which nav — and deliberately NOT used to decide whether a surface
     may render. A width of 0 is never narrow. */
  function isNarrow(px) {
    var w = width();
    return w > 0 && w < (px || 768);
  }

  function reducedMotion() {
    try {
      return !!(global.matchMedia &&
                global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* ── WHETHER THE HEAVY WORLD RUNS ──────────────────────────────────────
     ★ FOUNDER, 2026-11-08: *"user choice with liqud glass as its always
       been"*. Liquid Glass is the material oneway.center has always shown and
       it is now the DEFAULT EVERYWHERE, a phone included. A touch screen is no
       longer an answer on its own.

       WHAT THIS FIXES, measured on his instance 2026-11-08: `isTouch()` here
       stamped data-fx="safe" on EVERY touch device, and eight rules across the
       frontend are written `:not([data-fx="safe"])`, so they switched off on
       his phone while rendering on his desktop. Discovery's sheet was one of
       them: plain load `background-color rgb(0,0,0)`, `backdrop-filter none`;
       the same element with the gate lifted, `rgba(10,12,24,.52)` and
       `blur(20px) saturate(1.25)`. The galaxy could never read through on a
       phone. (The 32 rules written `html[data-fx="safe"]` are substitutes, a
       deliberate lighter drawing, and are untouched by this.)

       TWO THINGS STILL TURN IT DOWN, in this order:
       1. the person's own choice, `OW.fx.get()` — 'safe' or 'rich' — which is
          what he asked for and is offered in the look menu;
       2. the operating system's own "reduce motion", which we honour without
          being asked, because a person who set it there meant it everywhere.
     ─────────────────────────────────────────────────────────────────────── */
  function chosenFx() {
    try {
      var v = (global.OW && OW.fx && OW.fx.get && OW.fx.get()) || '';
      return (v === 'safe' || v === 'rich') ? v : '';
    } catch (e) { return ''; }
  }
  function safeFloor() { return reducedMotion(); }

  /* APPLY IT ONCE, HERE, so no page hand-rolls the gate again. `?fx=` still
     overrides for on-device bisection of the iOS renderer crash. */
  function stamp() {
    try {
      var d = doc.documentElement;
      var q = new URLSearchParams(global.location.search || '');
      var fx = (q.get('fx') || '').toLowerCase();
      if (fx) { d.setAttribute('data-fx', fx); return; }
      var chose = chosenFx();
      if (chose) { d.setAttribute('data-fx', chose === 'safe' ? 'safe' : 'rich'); return; }
      if (safeFloor()) { d.setAttribute('data-fx', 'safe'); }
      else { d.removeAttribute('data-fx'); }
    } catch (e) {}
  }
  stamp();

  /* ── THE GLASS, ONLY WHERE THE FRAME HOLDS IT ────────────────────────────
     ★ FOUNDER, 2026-11-13 ~17:50Z: *"blur only on fast devices make sure
       design not sacraficed"*.
       MEASURED (home-speed, Home at 1366 in Popit dark with 25 widgets and the
       feed, the headless shell painting on the CPU): a steady scroll's middle
       frame took 74 ms with every backdrop blur on and 33 ms with them off. The
       blur behind each widget and post face (oneway-surface.css, LIQUID GLASS)
       is paid again on every frame that something moves behind it, so a
       device that cannot pay it drops frames all the way down the feed.
     DECIDED ONCE, FROM THIS DEVICE'S OWN FRAMES, never from its name, its
     user agent or a guess at its memory: while the glass is on the screen and
     the page scrolls, the frames are timed in windows of GLASS_FRAMES. ONLY
     HOME TIMES IT (the review of home-speed, 2026-11-13: this module loads on
     the landing, the OS and the marketing pages too, and timed from load, so
     the page a visitor scrolled first, the landing with one glass face, kept
     'glass' for the whole site and Home's 25 faces were never timed): nothing
     is timed until a page calls timeGlass(shown), where shown() says its glass
     is on the screen now; Home calls it once its canvas has mounted
     (home.js homeGlassOn), and only frames while shown() holds count. The
     screen's own beat is the quickest tenth of a window; when the middle frame
     takes longer than one and a half beats and longer than 20 ms (a 60 Hz
     screen under 40 frames a second, a 120 Hz one under 50: a fast screen
     held at 60 keeps its glass), the window says solid. One window that holds the frame decides
     glass; solid is decided only when two windows say it (a slow moment while
     the page was still arriving does not take a fast device's glass). The
     answer is kept (localStorage `ow_glass`) and stamped here before the first
     paint of every later visit: data-glass="solid" on <html>, the same face
     with an opaque ground where the blur was (oneway-surface.css), so the
     depth, the edge and the hue are the design's on every device.
     `?glass=solid|glass` shows either on any device, as `?fx=` does. Simple and
     the safe floor have no glass to time. PROPOSED: the
     window, the beat, the one and a half and the 20 ms. Measured in the
     headless shell (no GPU) on the same Home: at 1366 the glass's middle frame
     66.6 ms (658 frames dropped in 15 s), the solid's 24.6 ms (185 in 9 s), and
     a fresh visit decided solid by itself; at 390 the glass held 16.4 ms. */
  var GLASS_KEY = 'ow_glass', GLASS_FRAMES = 60;
  function glassAsked() {
    try { var g = (new URLSearchParams(global.location.search || '').get('glass') || '').toLowerCase(); return (g === 'solid' || g === 'glass') ? g : ''; }
    catch (e) { return ''; }
  }
  function glassKept() {
    try { var v = global.localStorage ? global.localStorage.getItem(GLASS_KEY) : ''; return (v === 'solid' || v === 'glass') ? v : ''; }
    catch (e) { return ''; }
  }
  function stampGlass() {
    try {
      var d = doc.documentElement, v = glassAsked() || glassKept();
      if (v === 'solid') d.setAttribute('data-glass', 'solid'); else d.removeAttribute('data-glass');
    } catch (e) {}
  }
  stampGlass();
  /* the glass is on the screen: Popit's look, not the safe floor, and not already solid (a plain world's faces blur its flat ground at
     the same cost, so it is timed too) */
  var glassOn = null, glassTiming = false;
  function glassShown() {
    var d = doc.documentElement;
    if (d.getAttribute('data-simple') === '1' || d.getAttribute('data-fx') === 'safe' || d.hasAttribute('data-glass')) return false;
    try { return !!(glassOn && glassOn()); } catch (e) { return false; }
  }
  /* one window of frame times (ms) -> 'glass', 'solid', or '' while it is not full */
  function frameVerdict(ds) {
    if (!ds || ds.length < GLASS_FRAMES) return '';
    var s = ds.slice().sort(function (a, b) { return a - b; });
    var beat = Math.max(6, Math.min(17.5, s[Math.floor(s.length * 0.1)]));
    return s[Math.floor(s.length / 2)] > Math.max(beat * 1.5, 20) ? 'solid' : 'glass';
  }
  /* `shown`: the page's own answer to "is my glass on the screen now" (Home: Home is the page and a glass face is drawn there). Asked once
     a burst of scrolling, never per frame. A second call (Home drawn again) only gives the newer answer. */
  function timeGlass(shown) {
    if (typeof shown === 'function') glassOn = shown;
    if (glassTiming || glassAsked() || glassKept()) return;
    glassTiming = true;
    var ds = [], last = 0, until = 0, running = false, slow = 0, over = false, live = false;
    function keep(v) {
      over = true;
      try { global.removeEventListener('scroll', onScroll, true); } catch (e) {}
      try { if (global.localStorage) global.localStorage.setItem(GLASS_KEY, v); } catch (e) {}
      stampGlass();
    }
    function frame(t) {
      if (over) { running = false; return; }
      if (last && live && !doc.hidden) { var dt = t - last; if (dt > 0 && dt < 1000) ds.push(dt); }
      last = t;
      var v = frameVerdict(ds);
      if (v) {
        ds = [];
        if (v === 'glass') { keep('glass'); running = false; return; }
        if (++slow >= 2) { keep('solid'); running = false; return; }
      }
      if (global.performance.now() < until) global.requestAnimationFrame(frame);
      else { running = false; last = 0; }
    }
    function onScroll() {
      if (over) return;
      until = global.performance.now() + 150;
      if (!running && global.requestAnimationFrame) { live = glassShown(); if (!live) return; running = true; last = 0; global.requestAnimationFrame(frame); }
    }
    try { global.addEventListener('scroll', onScroll, { passive: true, capture: true }); } catch (e) {}
  }

  /* A TAB THAT LOADED HIDDEN HAS NO VIEWPORT, AND NOTHING ANNOUNCES THAT IT
     GOT ONE. Anything sized from the viewport must re-measure when the tab is
     first actually looked at, or it keeps whatever it guessed at while nobody
     could see it. One event, so no surface has to poll. */
  function announce(why) {
    try {
      global.dispatchEvent(new CustomEvent('ow:viewport', {
        detail: { width: width(), height: height(), reason: why,
                  touch: isTouch(), safeFloor: safeFloor() }
      }));
    } catch (e) {}
  }
  try {
    global.addEventListener('resize', function () { announce('resize'); },
                            { passive: true });
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden) { stamp(); announce('visible'); }
    }, { passive: true });
    /* A pointer that becomes coarse (a 2-in-1 folded into a tablet) changes the
       answer, and the canon says that — not width — is what may strip a
       surface. */
    if (global.matchMedia) {
      var mq = global.matchMedia('(pointer:coarse)');
      var onChange = function () { stamp(); announce('pointer'); };
      if (mq.addEventListener) { mq.addEventListener('change', onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
  } catch (e) {}

  var api = { width: width, height: height, isTouch: isTouch,
              isNarrow: isNarrow, reducedMotion: reducedMotion,
              safeFloor: safeFloor, stamp: stamp,
              glass: function () { return doc.documentElement.getAttribute('data-glass') === 'solid' ? 'solid' : 'glass'; },
              frameVerdict: frameVerdict, timeGlass: timeGlass };

  global.OW = global.OW || {};
  global.OW.viewport = api;
  /* The short names the pages already reach for. */
  global.owVW = width;
  global.owIsTouch = isTouch;
  global.owIsNarrow = isNarrow;
  global.owSafeFloor = safeFloor;
})(typeof window !== 'undefined' ? window : this);
