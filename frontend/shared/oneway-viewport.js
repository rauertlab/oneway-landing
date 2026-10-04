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

  /* WHETHER THE HEAVY WORLD RUNS. Touch, or the person asked for less motion.
     Width is not consulted, on purpose. */
  function safeFloor() { return isTouch() || reducedMotion(); }

  /* APPLY IT ONCE, HERE, so no page hand-rolls the gate again. `?fx=` still
     overrides for on-device bisection of the iOS renderer crash. */
  function stamp() {
    try {
      var d = doc.documentElement;
      var q = new URLSearchParams(global.location.search || '');
      var fx = (q.get('fx') || '').toLowerCase();
      if (fx) { d.setAttribute('data-fx', fx); return; }
      if (safeFloor()) { d.setAttribute('data-fx', 'safe'); }
      else { d.removeAttribute('data-fx'); }
    } catch (e) {}
  }
  stamp();

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
              safeFloor: safeFloor, stamp: stamp };

  global.OW = global.OW || {};
  global.OW.viewport = api;
  /* The short names the pages already reach for. */
  global.owVW = width;
  global.owIsTouch = isTouch;
  global.owIsNarrow = isNarrow;
  global.owSafeFloor = safeFloor;
})(typeof window !== 'undefined' ? window : this);
