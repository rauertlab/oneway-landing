/* oneway-galaxy.js — THE GALAXY'S COLOURS, FOLLOWING THE PERSON.
 *
 * ★ FOUNDER, 2026-08-24: *"the landing page should automatically sync users hue
 *   used on the platform"* — and the galaxies are the most visible thing on it.
 *
 * FIVE SURFACES RUN THE SAME STARFIELD — index, app, os, brain,
 * hotel-operations — each with its own copy of the same three accent colours
 * hardcoded as [6,182,212] · [167,139,250] · [245,158,11]. So the starfield
 * stayed cyan/violet/amber no matter what colour someone had chosen for the
 * rest of ONEWAY, on every surface, identically wrong.
 *
 * This does not rebuild those renderers — founder: *"PRESERVE the existing
 * frontend, do not rebuild for architectural purity."* It re-tints the arrays
 * they already hold.
 *
 * THE TRIAD IS A RELATIONSHIP, NOT THREE COLOURS. The person's hue, +71°, and
 * +211°. At the default of 187° those resolve to the exact palette that has
 * always been there, so nothing changes for somebody who has never picked a
 * hue — and for somebody who has, the whole galaxy rotates together instead of
 * one accent clashing with the other two.
 *
 * MUTATED IN PLACE, ON PURPOSE. Every particle, wireframe and bokeh holds a
 * REFERENCE to one of these arrays, so rewriting their contents recolours a few
 * hundred objects on the next frame with no rebuild and no dropped animation.
 *
 *   OW.galaxy.follow({ CYAN: CYAN, PURPLE: PURPLE, AMBER: AMBER });
 */
(function (global) {
  'use strict';

  /* MEASURED OFF THE SHIPPED COLOURS, NOT ESTIMATED. The first version of this
     file carried eyeballed constants (187 / +71 / +211) and would have shifted
     the palette for every person who has never chosen a hue — a "fix" that
     changes the default look for everyone is not a fix. Converting
     [6,182,212] · [167,139,250] · [245,158,11] to HSL gives the real triad,
     and the test asserts the default round-trips back to those exact RGBs. */
  var BASE = 188.7;               /* the palette that was always here */
  var OFFSET = { CYAN: 0, PURPLE: 66.4, AMBER: 209.0 };
  var SAT    = { CYAN: 94.5, PURPLE: 91.7, AMBER: 92.1 };
  var LUM    = { CYAN: 42.7, PURPLE: 76.3, AMBER: 50.2 };

  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) {
      return l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  /* THE HUE THIS DEVICE IS CURRENTLY SHOWING. Read from the CSS variable rather
     than from storage or the account, because `oneway-hue.js` is what resolves
     those — one resolver, and this reads its answer. Absent means the person
     has chosen nothing, which is not the same as 0 (red). */
  function currentHue() {
    var h = NaN;
    try {
      h = parseInt(global.getComputedStyle(document.documentElement)
                   .getPropertyValue('--ow-user-hue'), 10);
    } catch (e) {}
    if (isNaN(h)) {
      try {
        h = parseInt(global.getComputedStyle(document.body)
                     .getPropertyValue('--ow-brand-hue'), 10);
      } catch (e) {}
    }
    return isNaN(h) ? BASE : h;
  }

  function tint(arr, h, s, l) {
    if (!arr || arr.length < 3) { return; }
    var c = hsl2rgb(((h % 360) + 360) % 360, s, l);
    arr[0] = c[0]; arr[1] = c[1]; arr[2] = c[2];
  }

  /* Hand in whichever of the three arrays this surface actually has. White is
     never tinted — it is the light, not an accent, and tinting it is what makes
     a recoloured starfield look like a colour cast instead of a galaxy. */
  function follow(arrays) {
    if (!arrays) { return function () {}; }
    function paint() {
      var h = currentHue();
      ['CYAN', 'PURPLE', 'AMBER'].forEach(function (k) {
        if (arrays[k]) { tint(arrays[k], h + OFFSET[k], SAT[k], LUM[k]); }
      });
    }
    paint();
    /* `oneway-hue.js` announces every change — including the correction that
       arrives when the ACCOUNT's hue comes back and disagrees with this
       device's cache. A canvas has already read these colours into its objects
       by then, so it has to be told. */
    try { global.addEventListener('ow:hue', paint); } catch (e) {}
    /* Cross-tab: another tab's picker writes through, this repaints. */
    try {
      global.addEventListener('storage', function (e) {
        if (e && e.key === 'ow_user_hue') { setTimeout(paint, 0); }
      });
    } catch (e) {}
    return paint;
  }

  global.OW = global.OW || {};
  global.OW.galaxy = { follow: follow, currentHue: currentHue, BASE: BASE };
})(typeof window !== 'undefined' ? window : this);
