/* ═══════════════════════════════════════════════════════════════════════════
   ONEWAY — THE POPIT RUNTIME  (oneway-popit.js)   companion: oneway-popit.css

   One renderer, one hue engine, one FLIP, one world. Surface-agnostic: the
   App, the OS, a Center Site and a kiosk all call the same functions.

   CANON: docs/product/DESIGN_LANGUAGE.md · context/LBP_POPIT_DESIGN_LAWS.md
   This IMPLEMENTS the ratified language. It invents nothing (§22).

   WHY A RENDERER AND NOT MARKUP —
   The proving ground hardcoded every Popit as an object literal. The runtime
   already returns the full anatomy for ANY object from ONE endpoint:
     GET /api/center/object/{id}/popit  →  _object_popit()
     { label · kind_label · glance · image{url,source} · time_back ·
       time_forward · relationships · conversations · decisions · actions ·
       permissions · lifecycle }
   So: data in, Popit out. Nothing about a hotel, a machine or a gallery is
   known here — which is the only way one Popit works on every surface.

   EXPORTS (window.OW)
     OW.hue.set(h1,h2) · OW.hue.tween(h1,h2,ms) · OW.hue.fromAngle(deg)
     OW.hue.scope(el,h1,h2) · OW.hue.reset(ms)
     OW.world.mount(opts) · OW.world.tier()
     OW.bead(data,opts) · OW.glance(data,opts) · OW.mountList(el,items,opts)
     OW.open(data,originEl) · OW.close()
     OW.fromApi(payload)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var doc = global.document, root = doc.documentElement;
  var RM = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A MERGE, NEVER A REPLACEMENT: the App's address (OW.here, OW.go, OW.url) is defined in oneway-app.html's head before this file
     loads, and the closing `global.OW = OW` once wiped it, which blanked the App ("OW.here is not a function", rc-2 2026-11-09).
     Held by api/oneway/platform/test_app_paths.py. */
  var OW = global.OW || {};

  /* ══ MOTION, READ FROM THE ONE SET OF NAMES (S33; founder/865: "smooth, slow, drawn out, and bubbly") ══════════
     The durations and the springs are named once, in oneway-popit.css's :root (--ow-dur-*, --ow-spring, ...). A
     moment that is moved from script (an element.animate, a timer that waits for a leave) asks here rather than
     writing a number of its own, so a change to a name reaches the CSS moments and the scripted ones together.
       OW.motion.ms('open')        a duration in ms (1 when the person asked for less motion)
       OW.motion.ease('spring')    an easing by its token name ('spring', 'spring-soft', 'ease-out', 'ease-leave')
       OW.motion.still()           the system's or the App's own Reduce motion
       OW.motion.arrive(host)      a surface arriving: its rows flow in for one beat (.ow-arrive), and only then, so a
                                   list that redraws itself later does not replay it
       OW.motion.bounce(el, k, r)  a held icon pressed on ('on') or off ('off'), or a change in place ('bump'), from what is on
                                   screen now to rest (r), so a press in the middle of one carries on from it
       OW.motion.jump(el, then)    a mark's one hop, then `then` as it lands; at once when el is off screen or the person asked for less motion
       OW.motion.count(el, n, f)   a number moving to n (f says it: OW.cards.number for "1,204"), a short eased count; one step settles in
       OW.motion.countOf(el)       the number el is at or on its way to: every reader asks here, never el.textContent */
  OW.motion = (function () {
    var EASE = { 'spring': 'cubic-bezier(.34,1.56,.64,1)', 'spring-soft': 'cubic-bezier(.22,1.12,.36,1)',
                 'ease-out': 'cubic-bezier(.22,1,.36,1)', 'ease-leave': 'cubic-bezier(.55,0,.45,1)', 'ease': 'cubic-bezier(.4,0,.2,1)' };
    var DUR = { press: 280, state: 360, enter: 600, open: 720, settle: 800, flow: 640, leave: 420, stagger: 55 };
    function still() {
      try {
        return !!((global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches)
          || root.getAttribute('data-motion') === 'reduced' || root.getAttribute('data-ow-motion') === 'reduce');
      } catch (_) { return false; }
    }
    /* MOTION's names do not change while a page is open (reduced motion is still()'s, above), so each is read from the
       stylesheet once: read on every call, a press or a page change in the middle of building a page made the browser work
       out the whole page's style to answer it (the design red team's D14, ~30-75 ms a time at 4x CPU) */
    var read = {};
    function token(name) {
      if (read[name]) return read[name];
      try { var v = global.getComputedStyle(root).getPropertyValue('--ow-' + name).trim(); if (v) read[name] = v; return v; } catch (_) { return ''; }
    }
    /* and all of them once the page is idle, so the first press or page change never asks mid-build */
    try {
      var warm = function () { ['dur-press', 'dur-state', 'dur-enter', 'dur-open', 'dur-settle', 'dur-flow', 'dur-leave', 'stagger',
        'ease', 'ease-out', 'ease-leave', 'spring', 'spring-soft', 'settle'].forEach(token); };
      var idle = function () { (global.requestIdleCallback || function (f) { return global.setTimeout(f, 300); })(warm, { timeout: 2000 }); };
      if (doc.readyState === 'complete') idle(); else global.addEventListener('load', idle);
    } catch (_) {}
    function ms(name) {
      if (still()) return 1;
      var v = token(name === 'stagger' ? 'stagger' : 'dur-' + name), n = parseFloat(v);
      if (!isFinite(n)) return DUR[name] || 0;
      return /ms$/.test(v) ? n : n * 1000;
    }
    var scripted = null;    /* does element.animate() take linear()? asked once, on a detached element */
    function ease(name) {
      var v = token(name);
      /* the stylesheet hands a browser without linear() the cubic-bezier already; a browser that draws linear() in CSS
         but refuses it in element.animate() (which would throw, and an open would never run) gets the cubic-bezier */
      if (v && v.indexOf('linear(') === 0) {
        if (scripted === null) {
          try { doc.createElement('i').animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, easing: 'linear(0,1)' }).cancel(); scripted = true; }
          catch (_) { scripted = false; }
        }
        if (!scripted) v = '';
      }
      return v || EASE[name] || EASE.ease;
    }
    var timers = typeof WeakMap === 'function' ? new WeakMap() : null;
    function arrive(host) {
      if (!host || !host.classList) return;
      var was = timers && timers.get(host);
      if (was) global.clearTimeout(was);
      host.classList.remove('ow-arrive');
      /* jshint expr:true */ host.offsetWidth;
      host.classList.add('ow-arrive');
      /* removed only once the last row (the eighth waits seven beats) has come to rest, so removing it cuts nothing */
      var t = global.setTimeout(function () { host.classList.remove('ow-arrive'); },
                                ms('flow') + 7 * ms('stagger') + 200);
      if (timers) timers.set(host, t);
    }
    /* A BOUNCE THAT NEVER JUMPS (the founder, 2026-10-21: "like change ... button change ... should be smooth and consistent
       and shouldnt break under pressure"). Measured before at 390: nine quick taps on a heart made 21 frames on which it
       jumped (its CSS keyframes began at scale .62 and restarted from there on every tap, wherever the last one had got to).
       Script starts each bounce from what is on screen this frame, so a tap in the middle of a bounce carries on from it, and
       only one runs per element. `rest` is the transform the element rests at ('' for none; a toast rests translated). */
    var SHAPES = {   /* [transform, offset]; the founder's four gestures (2026-08-29: "expressive ... for like dislike repost
                        and favorite"), each its own meaning, then giving back and a change in place */
      like:    [['scale(.84) rotate(-6deg)', .16], ['scale(1.3) rotate(6deg)', .4], ['scale(.94) rotate(-2deg)', .62], ['scale(1.05) rotate(1deg)', .82]],
      dislike: [['translateY(3px) scale(1.14)', .34], ['translateY(1px) scale(.95)', .66]],
      repost:  [['rotate(200deg) scale(1.16)', .45], ['rotate(360deg) scale(1)', .999]],
      save:    [['translateY(-6px) scale(1.14)', .3], ['translateY(1px) scale(.96)', .62]],
      jump:    [['translateY(-14px) scale(1.14)', .42]],
      off:     [['scale(.8)', .3], ['scale(1.06)', .64]],
      bump:    [['scale(.97)', .22], ['scale(1.025)', .55]]
    };
    SHAPES.on = SHAPES.like;
    function bounce(el, kind, rest) {
      if (!el || typeof el.animate !== 'function' || still()) return null;
      var shape = SHAPES[kind] || SHAPES.bump, base = rest || '';
      var from = 'none';
      try { from = global.getComputedStyle(el).transform || 'none'; } catch (_) {}
      if (el.__owBounce) { try { el.__owBounce.cancel(); } catch (_) {} }
      var frames = [{ transform: from === 'none' ? (base || 'none') : from, offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' }];
      shape.forEach(function (f) {
        frames.push({ transform: (base ? base + ' ' : '') + f[0], offset: f[1], easing: 'cubic-bezier(.45,0,.55,1)' });
      });
      frames.push({ transform: base || 'none', offset: 1 });
      try {
        var a = el.animate(frames, { duration: ms(kind === 'bump' ? 'enter' : kind === 'jump' ? 'state' : 'settle') });
        el.__owBounce = a;
        a.onfinish = a.oncancel = function () { if (el.__owBounce === a) el.__owBounce = null; };
        return a;
      } catch (_) { return null; }
    }
    /* A MARK'S ONE HOP, AND WHAT WAITS FOR IT TO LAND (his words, 2026-11-06: "then lightbulb jumps when they hit the +  button on home to arrange that cavnas"): by the clock and by transform alone, so it
       holds at 120 and at 60 frames. A second press in the hop starts nothing. `then` runs once: on landing, at once when there is nothing to watch, and never later than the moment plus a spare beat,
       so a page put away mid-hop holds nothing back. */
    var JUMP_SPARE_MS = 80;
    function jump(el, then) {
      if (el && el.__owJumping) return;
      var a = el && el.getClientRects && el.getClientRects().length ? bounce(el, 'jump') : null;
      if (!a) { then(); return; }
      el.__owJumping = true;
      var landed = function () { if (!el.__owJumping) return; el.__owJumping = false; then(); };
      if (a.finished) a.finished.then(landed, landed);
      global.setTimeout(landed, ms('state') + JUMP_SPARE_MS);
    }
    /* A NUMBER THAT MOVES (the founder, 2026-10-30). One writer for every tally and count on the platform, and one frame loop however many
       are moving (a refresh can touch forty boxes at once). The target is held on el.__owTo from the first moment, so a reader in the middle
       of the count gets the number it is going to, never one it is passing: a like pressed during a count of 12 to 20 is 21, and the server's
       answer of 20 finds nothing to do. Only integers are written, only when the integer changes, and the figures are tabular in the
       stylesheet, so the box changes width only when the number really gains a digit. One step (a like, a follow) has nothing to count
       through: the new figure settles in on transform and opacity, which moves nothing beside it. A number going from 12 to 13 twice is
       said once. Reduced motion, a hidden tab and a box not on the page get the target at once. */
    var countRuns = [], countFrame = 0;
    function countOf(el) {
      if (!el) return 0;
      if (typeof el.__owTo === 'number' && (el.__owRun || el.textContent === el.__owSaid)) return el.__owTo;
      var n = parseInt(String(el.textContent || '').replace(/[^\d]/g, ''), 10);
      return isFinite(n) ? n : 0;
    }
    function countQuiet(el, on) {   /* a live region says the number it reached, not the ones it passed */
      var region = el.closest && el.closest('[aria-live]');
      if (region) { if (on) region.setAttribute('aria-busy', 'true'); else region.removeAttribute('aria-busy'); }
    }
    function countSettle(el, to, said) {
      el.__owRun = null; el.__owTo = to; el.__owSaid = said;
      if (el.textContent !== said) el.textContent = said;
    }
    function countStep(el) {
      if (typeof el.animate !== 'function') return;
      try {
        if (el.__owStep) el.__owStep.cancel();
        el.__owStep = el.animate([{ transform: 'translateY(-.42em)', opacity: 0 }, { transform: 'translateY(.06em)', opacity: 1, offset: .55 }, { transform: 'none', opacity: 1 }],
          { duration: ms('state'), easing: ease('ease-out') });
      } catch (_) {}
    }
    function countTick(now) {
      countFrame = 0;
      countRuns = countRuns.filter(function (r) {
        if (r.el.__owRun !== r) return false;
        if (!r.at) r.at = now;
        var t = (now - r.at) / r.ms;
        if (t >= 1 || !r.el.isConnected) { countSettle(r.el, r.to, r.say(r.to)); countQuiet(r.el, false); return false; }
        var v = Math.round(r.from + (r.to - r.from) * (1 - Math.pow(1 - t, 3)));      /* eased out: it lands softly */
        if (v !== r.now) { r.now = v; r.el.textContent = r.say(v); }
        return true;
      });
      if (countRuns.length) countFrame = global.requestAnimationFrame(countTick);
    }
    function count(el, to, say) {
      if (!el) return;
      to = Math.max(0, Math.round(Number(to)));
      if (!isFinite(to)) return;
      if (to) el.removeAttribute('data-zero'); else el.setAttribute('data-zero', '');
      say = say || String;
      if (el.__owRun && el.__owTo === to) return;                     /* already on its way there: the answer to a press finds nothing to do */
      var from = el.__owRun ? el.__owRun.now : countOf(el), said = say(to), far = Math.abs(to - from);
      if (!far) { if (el.__owRun) { countQuiet(el, false); countSettle(el, to, said); } return; }
      var off = still() || doc.hidden || !el.isConnected || typeof global.requestAnimationFrame !== 'function';
      if (off || far === 1) {
        if (el.__owRun) countQuiet(el, false);
        countSettle(el, to, said);
        if (!off) countStep(el);
        return;
      }
      el.__owTo = to; el.__owSaid = said;
      el.__owRun = { el: el, from: from, now: from, to: to, say: say, ms: ms('state'), at: 0 };
      countRuns.push(el.__owRun);
      countQuiet(el, true);
      if (!countFrame) countFrame = global.requestAnimationFrame(countTick);
    }
    return { still: still, ms: ms, ease: ease, arrive: arrive, bounce: bounce, jump: jump, count: count, countOf: countOf };
  })();

  /* ── tiny helpers ────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* what a repost needs, in the server's own words (service.repost) so the button and the refusal say the same thing; popit-live.js reads them too */
  var REPOST_NEEDS = { like: 'Like this post to repost it.', dislike: 'You disliked this post, so you can\'t repost it.' };
  OW.repostNeeds = REPOST_NEEDS;
  /* AN IMAGE URL THIS MATERIAL WILL LOAD. `esc` stops a value breaking OUT of
     the attribute; it does nothing about where the attribute POINTS. Every
     cover, avatar and banner here comes from a server payload, and a client
     that loads whatever a payload names is one bad row away from making every
     viewer fetch an attacker's host — a tracking beacon carrying each viewer's
     IP, fired for everyone who opens the surface.

     The runtime's rule on the way in, here: one validator. */
  var SAFE_PATH = /^\/(assets|media|uploads)\/[A-Za-z0-9._\-\/]{1,200}$/;
  /* IMAGES ARE SERVED BY THE RUNTIME, so a server-relative path follows the
     runtime's origin — not the origin the page happens to be served from.
     Same-origin in production; NOT when the App is opened against an API on
     another host (development, a native shell). Set by OW.data.configure
     so there is one place that knows where the runtime lives. */
  OW.assetBase = '';
  OW.imageUrl = function (v) {
    var u = String(v == null ? '' : v).trim();
    if (!u) return '';
    if (SAFE_PATH.test(u) && u.indexOf('..') < 0) return (OW.assetBase || '') + u;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
    /* another server's picture: our signed copy only (own_copies) */
    if (/^\/api\/oneway\/pictures\/outside\?u=[\w.~%-]+&s=[0-9a-f]{32}$/.test(u)) return (OW.assetBase || '') + u;
    if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u.indexOf(location.origin + '/') ? '' : u;
    return '';                       /* refused → the caller's honest fallback */
  };

  /* A CARD'S PICTURE THAT FAILS, ONE HANDLER (the founder, 2026-10-30: "images are not currently loading"). A phone on a poor signal loses
     pictures it could have had a second later, and `onerror="this.remove()"` gave each exactly one chance. So: its srcset goes (a narrower
     candidate the network or the server could not give is not asked again), the card's own ground shows meanwhile, it is asked for once more after a
     short wait, or when the network is back if it is gone, and if that fails too it leaves the ground, the hue the card is made of. Every card
     reserves the picture's room in its stylesheet, so none of this moves anything. A face has its own fallback (OW.faceFail): its letters. */
  var IMAGE_RETRY_WAIT_MS = 900;
  OW.imgFail = function (img) {
    if (!img || !img.parentNode) return;
    if (img.__owAskedAgain) {
      var frame = img.parentNode;
      img.remove();
      if (frame.getAttribute && !frame.querySelector('img') && !frame.hasAttribute('aria-label')) { frame.setAttribute('role', 'img'); frame.setAttribute('aria-label', 'This picture could not be loaded'); }
      return;
    }
    img.__owAskedAgain = true;
    var src = img.getAttribute('src') || img.currentSrc || '';
    if (!src) { img.remove(); return; }
    img.style.visibility = 'hidden';
    /* both attributes leave together, or dropping srcset alone makes the browser ask for src this instant */
    img.removeAttribute('src'); img.removeAttribute('srcset'); img.removeAttribute('sizes');
    var again = function () {
      if (!img.isConnected) return;
      img.addEventListener('load', function () { img.style.visibility = ''; }, { once: true });
      img.setAttribute('src', src);
    };
    if (global.navigator && global.navigator.onLine === false) global.addEventListener('online', again, { once: true });
    else global.setTimeout(again, IMAGE_RETRY_WAIT_MS);
  };

  /* PICTURES AHEAD OF THE READER (feed speed, 2026-11-10: "I need speed big time"; main: "never show a blank card in view", "nothing
     fills in while he watches"). A card's picture is `loading="lazy"`, which the browser starts only about a screen and a half before it
     shows: a hard fling outruns that, and the card arrives grey and fills in on screen. So every card a feed draws is watched, and once it
     is within PICS_AHEAD of the screen (four screens below, one above) its pictures are asked for at once and decoded, so the pixels are
     ready before the card scrolls in. Far below that nothing is fetched, so a feed of a hundred posts does not load a hundred pictures. */
  var PICS_AHEAD = '100% 0px 400% 0px';
  /* the widest a post's picture is drawn on a desktop (his compare with Instagram's desktop feed, 2026-11-10: a narrow centred column,
     the whole post in one window); oneway-popit.css draws the same number */
  var MEDIA_MAX_PX = 620;
  OW.picsAhead = (function () {
    var io = null;
    function ready(img) {
      if (img.getAttribute('loading') === 'lazy') img.setAttribute('loading', 'eager');
      if (!img.decode) return;
      var go = function () { img.decode().catch(function () {}); };
      if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
    }
    return function (root) {
      if (!root || !global.IntersectionObserver) return;
      if (!io) io = new global.IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          Array.prototype.forEach.call(en.target.querySelectorAll('img'), ready);
        });
      }, { rootMargin: PICS_AHEAD });
      var cards = root.matches && root.matches('.po-card') ? [root] : root.querySelectorAll('.po-card');
      Array.prototype.forEach.call(cards, function (c) { io.observe(c); });
    };
  })();

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* Deterministic variant from the object's OWN id. The same object is always
     the same hand-cut shape — reproducible across reloads and devices (Gate 5,
     EXACT RENDERING) — while a set of them never looks machine-stamped. */
  function variantFor(id) {
    var s = String(id || ''), h = 5381, i = 0;
    for (; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 6;
  }

  /* ═══ 1 · THE HUE ENGINE ═══════════════════════════════════════════════
     ONE representation platform-wide: a PAIR of "R,G,B" triplets (§17).
     Before this file there were six — the landing's RGB pair, ow-design.css's
     HSL angle, personal.html's desaturated angle, dashboard.html's named
     tokens, oneway-hue.js's localStorage angle, and the backend's single
     integer. Everything now funnels through here. */
  /* THE TWELVE, ONE PER MONTH (founder/891, 892, 896, 897, 2026-10-21: "make colors in between these still keeping the same
     flush and saturation but equaling 12 for the 12 months of the year. each must be mapped to a default month. when a user
     chooses no hue the button says No hue (changes monthly)"; "june july aug should be yellowish bighter months while the
     winter should be darker, blues reds, spring is when purples and others"; "magenta for feb pink for april"). Each is its
     angle at full strength (HSV 100%, 100%: Orange 27 is #FF7300, Pink 302 #FF00F6), and so is every angle between them:
     a hue on Oneway is drawn at the strength of the twelve. Listed January to December. Nobody who has chosen nothing, and
     nobody who chose No hue, wears a fixed violet any more: they wear the month's (THE PLATFORM DEFAULT, DEF1 and DEF2). */
  var MONTHS = [['Azure', 203, '009DFF'], ['Magenta', 332, 'FF0077'], ['Violet', 274, '9000FF'], ['Pink', 302, 'FF00F6'],
                ['Green', 115, '15FF00'], ['Lemon', 54, 'FFE500'], ['Amber', 45, 'FFBF00'], ['Lime', 75, 'BFFF00'],
                ['Aqua', 172, '00FFDD'], ['Orange', 27, 'FF7300'], ['Red', 0, 'FF0000'], ['Blue', 228, '0033FF']];
  /* an angle at full strength; the twelve are their own hexes exactly (two of them sit half a step from the rounding) */
  function strong(d) {
    d = ((Math.round(d) % 360) + 360) % 360;
    for (var i = 0; i < MONTHS.length; i++) if (MONTHS[i][1] === d) {
      var n = parseInt(MONTHS[i][2], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return hsl2rgb(d, 100, 50);
  }
  var MONTH_NOW = MONTHS[new Date().getMonth()];
  var DEF1 = strong(MONTH_NOW[1]).join(','), DEF2 = strong(MONTH_NOW[1] - 64).join(',');
  var huePending = null;   /* a destination a hidden tab still owes */
  var hueRAF = 0;

  function parseTriplet(v) {
    if (v == null) return null;
    var s0 = String(v).trim();
    /* The runtime serves a hue three ways depending on the read: a triplet, an
       angle, and — on feed actors — a HEX. Accepting hex here rather than at
       every call site is what keeps it one contract instead of a seventh. */
    var m = /^#?([0-9a-f]{6})$/i.exec(s0);
    if (m) { var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var p = s0.split(',').map(function (n) { return parseInt(n, 10); });
    return (p.length === 3 && p.every(function (n) { return !isNaN(n); })) ? p : null;
  }

  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  /* the inverse, needed the moment a person can pick a colour rather than an
     angle: to build the second tone of a custom pair by the SAME -64deg rule
     the wheel uses, the chosen colour has to be readable as hue/sat/light. Two
     different rules for one gradient is two gradients. */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 2, h = 0, sat = 0;
    if (d) {
      sat = d / (1 - Math.abs(2 * l - 1));
      if (mx === r)      h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else               h = 60 * ((r - g) / d + 4);
    }
    return [((h % 360) + 360) % 360, sat * 100, l * 100];
  }

  var hue = {
    /* THE BRIDGE. The backend serves ONE integer (_resolved_hue, 0-359) where
       the canon requires a pair. This derives a plausible partner using the
       same interval as ONEWAY's own pair (violet 258 → cyan 194, i.e. -64) at
       the canon's candy saturation — never the muted 12-14% the App uses today.
       It is a DERIVATION, not a claim: an authored Center pair always wins,
       and when the backend serves two this becomes a pass-through. */
    fromAngle: function (deg) {
      var d = parseInt(deg, 10); if (isNaN(d)) d = MONTH_NOW[1];
      return [strong(d).join(','), strong(d - 64).join(',')];
    },
    /* the twelve, January to December: { name, angle, hex, month (0-11) } */
    months: MONTHS.map(function (m, i) {
      return { name: m[0], angle: m[1], month: i,
        hex: '#' + m[2] };
    }),
    /* the month's own, for a date (now when none is given) */
    month: function (when) { return hue.months[(when || new Date()).getMonth()]; },
    /* ── THE THIRD COLOUR ─────────────────────────────────────────────────
       ★ FOUNDER/459, 2026-09-20: *"make sure it supports multi color
         gradients."* The material was a PAIR — the hue and its partner —
         and a two-stop gradient is a two-colour gradient. `--ow-h3` is
         derived from the first colour (+42° on the wheel at the same candy
         saturation) and rides with the pair everywhere the pair is set: the
         world, a scoped subtree, every frame of a tween. An authored third
         colour, when the platform serves one, would win here the same way
         an authored pair wins over the derivation. */
    third: function (h1) {
      var t = parseTriplet(h1); if (!t) return null;
      var hsl = rgb2hsl(t[0], t[1], t[2]);
      return hsl2rgb((hsl[0] + 42) % 360, 100, 50).join(',');
    },
    set: function (h1, h2) {
      if (hueRAF) { cancelAnimationFrame(hueRAF); hueRAF = 0; }
      [].forEach.call(doc.querySelectorAll ? doc.querySelectorAll('.ow-world__was') : [], function (o) {   /* nor a fading sky */
        if (o.parentNode) o.parentNode.removeChild(o); });
      root.style.setProperty('--ow-h1', h1 || DEF1);
      root.style.setProperty('--ow-h2', h2 || h1 || DEF2);
      root.style.setProperty('--ow-h3', hue.third(h1 || DEF1) || h2 || DEF2);
    },
    /* Entering a Center re-colours the WORLD (§2, §17) — the place's light
       carries, so objects never need banners. rAF, not setInterval, so the
       tween rides the same clock as everything else and parks with the tab. */
    /* ── THE ANGLE TRAVELS WITH THE PAIR ──────────────────────────────────
       ★ FOUNDER, 2026-08-26: *"how come home and popits doesn't change in a
         smooth animation like everything else does"*

       Because this tweened the PAIR and nothing else. Two representations of
       one hue live on :root — the pair (`--ow-h1`/`--ow-h2`) and the angle
       (`--ow-user-hue`) — and Home's Popits are painted from the ANGLE:
       `.ow-cv{--po-h:var(--po-hue,var(--ow-user-hue,258))}`. So picking a
       colour glided every surface built on the pair while the Popits sat
       perfectly still for 450ms and then snapped, late, when the save came
       back through `oneway-hue.js` and set the angle in one frame.

       It could not be fixed with a CSS transition: a custom property does not
       interpolate, and a Popit face is built from GRADIENTS, which CSS cannot
       transition at all. The only thing that moves a gradient smoothly is
       re-resolving its inputs every frame — which is exactly what this loop
       already does. So the angle joins the loop rather than getting an
       animation system of its own.

       DERIVED FROM THE MIXED PAIR, NOT INTERPOLATED BESIDE IT. A second
       interpolation is a second answer, and the two would disagree mid-flight
       (and disagree about which way round the wheel to travel). Reading the
       angle back off the colour this frame actually painted means the pair and
       the angle cannot drift apart, by construction. A mid-tween near-grey has
       no angle to read — `angleOf` returns null — and there the last good
       angle stands rather than a fabricated one.

       Only when a caller passes `angle` — the person changing THEIR OWN
       colour. Entering a Center must not rewrite the viewer's own hue, so
       `hue.context` passes nothing and behaves exactly as before. */
    tween: function (h1, h2, ms, angle) {
      var to1 = parseTriplet(h1), to2 = parseTriplet(h2 || h1);
      if (!to1) return;
      var wantsAngle = (angle != null && !isNaN(parseInt(angle, 10)));
      if (RM) {                                             /* honest snap */
        if (wantsAngle) hue.angle(parseInt(angle, 10));
        return hue.set(h1, h2);
      }
      /* ── A TWEEN NOBODY CAN SEE IS NOT AN ANIMATION, AND IT DOES NOT FINISH ──
         `requestAnimationFrame` does not fire in a hidden tab. This loop drives
         the colour ONLY from rAF, so backgrounding the app mid-navigation
         froze the sweep wherever it was and NOTHING ever resumed it: come back
         to the tab and the world is still wearing the colour it was leaving,
         permanently, until the next navigation happens to tween again.

         MEASURED 2026-09-09: with the pane hidden, `hue.context('person', …)`
         was called with 255,92,228 and `--ow-h1` stayed 92,255,173 forever.
         (It also cost me two false bug reports today, because a throttled tween
         and a broken producer look identical from the outside.)

         So: hidden means ARRIVE, not animate — there is no motion to show and
         the destination is the only thing that was ever wanted. And a tween
         that is in flight when the tab goes away is completed rather than
         abandoned, because a half-finished colour is not a state anybody
         chose. */
      if (doc.hidden) {
        if (wantsAngle) hue.angle(parseInt(angle, 10));
        return hue.set(h1, h2);
      }
      /* ── THE PAGE ARRIVES IN ITS COLOUR; THE WORLD BEHIND IT GLIDES (the design red team's D14, 2026-10-21: at 4x CPU
         opening a profile dropped ~100 frames in 2.6 s, frames of 60-311 ms). Every frame of this tween rewrote the root's
         three colours, which every element inherits, so the whole document's style was recalculated each frame for 800 ms
         (665 ms of style in a Chrome trace; the script itself ~100 ms). Now the root takes the destination in one write,
         while the page change hides it (the new page is fading in; the leaving page keeps its own colours,
         oneway-app.html's ghost layer), and the colour field behind everything, `.ow-world`, glides on variables of its own:
         a few elements, not the document. The angle lands once, so the canvases are woken once. */
      var world = doc.querySelector('.ow-world');
      /* the colour worn now, read from the root's own line (hue.set writes it there), never from computed style: a computed read
         here, mid-navigation, made the browser work out the whole page's style once more (D14) */
      var fr1 = parseTriplet(root.style.getPropertyValue('--ow-h1')) || parseTriplet(DEF1);
      var fr2 = parseTriplet(root.style.getPropertyValue('--ow-h2')) || parseTriplet(DEF2);
      if (!to2) to2 = to1;
      var dur = ms || 800, t0 = performance.now();
      if (hueRAF) cancelAnimationFrame(hueRAF);
      huePending = null;
      root.style.setProperty('--ow-h1', to1.join(','));
      root.style.setProperty('--ow-h2', to2.join(','));
      root.style.setProperty('--ow-h3', hue.third(to1.join(',')) || to2.join(','));
      if (wantsAngle) hue.angle(parseInt(angle, 10));
      if (!world || (fr1.join(',') === to1.join(',') && fr2.join(',') === to2.join(','))) return;
      /* the world's colour layers, copied in the colour they had, laid over the new and faded out: opacity alone, which the
         compositor runs, so no frame repaints the sky or recalculates a style */
      var was = world.querySelectorAll('.ow-world__field, .ow-world__wash, .ow-world__neb');
      if (!was.length) return;
      var veil = doc.createElement('div');
      veil.className = 'ow-world__was'; veil.setAttribute('aria-hidden', 'true');
      veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;will-change:opacity;opacity:0;--ow-h1:' + fr1.join(',')
        + ';--ow-h2:' + fr2.join(',');
      [].forEach.call(was, function (el) { var c = el.cloneNode(false); c.style.animation = 'none'; veil.appendChild(c); });
      [].forEach.call(world.querySelectorAll('.ow-world__was'), function (o) { o.parentNode.removeChild(o); });
      world.insertBefore(veil, was[was.length - 1].nextSibling);
      /* a Web Animation, which starts without a forced reflow (a CSS transition needed one: `void offsetWidth`, D14) */
      var gone = function () { if (veil.parentNode) veil.parentNode.removeChild(veil); };
      try {
        var an = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: (OW.motion && OW.motion.ease) ? OW.motion.ease('ease') : 'ease', fill: 'forwards' });
        an.onfinish = gone; an.oncancel = gone;
      } catch (_) { gone(); }
      global.setTimeout(gone, dur + 200);
    },
    /* THE ONE WRITER OF THE COMPAT ANGLE. Every surface still painting from a
       single angle — Home's Popit canvas, the Galaxy starfield, anything on
       `oneway-hue.js` — reads this, so it must have exactly one setter or the
       tween and the boot path will each set it differently. */
    /* `midFlight` says this is one frame of a sweep rather than a destination.
       The VARIABLE is still written every frame — it is two style properties
       and the gradients that read it glide for free. The EVENT is not, and
       that distinction is the whole of this parameter: see the note above the
       dispatch. */
    angle: function (deg, midFlight) {
      var d = parseInt(deg, 10); if (isNaN(d)) return;
      d = ((d % 360) + 360) % 360;
      boundAngle = d;
      /* ON BOTH, BECAUSE `oneway-hue.js` SETS BOTH. It writes the angle to
         <html> AND <body>, so a value left on <body> shadows the root for
         every element inside it. Setting only the root looked correct at the
         root and changed nothing on screen: `--ow-user-hue` swept 266 -> 30
         while `--po-h` on the Popit canvas — a descendant of <body> — stayed
         frozen at the last value <body> had been given. Measured 2026-08-26.
         Two writers of one variable is the defect; until they are one, they
         must at least write the same places. */
      root.style.setProperty('--ow-user-hue', d);
      if (doc.body) {
        doc.body.style.setProperty('--ow-user-hue', d);
        doc.body.classList.add('ow-hue-on');
      }
      /* ── THE CANVASES ARE TOLD WHERE IT LANDED, NOT WHERE IT IS PASSING ──
         The canvases cannot see a CSS variable change — they have already read
         the colour into their buffers — so they are told by event. What that
         event COSTS was never counted, and once the angle joined the tween it
         became the most expensive thing in a navigation.

         Every listener redraws in full. `oneway-galaxy.js` re-reads
         `getComputedStyle` and re-tints three palettes. At one event per frame
         that is ~96 full starfield redraws and ~48 forced style recalculations
         for ONE 800ms transition, on the main thread, while a profile is also
         parsing three responses and building its widgets.

         SO THE TWO JOBS ARE SPLIT. A CSS variable is cheap and everything that
         reads it — `.ow-cv{--po-h:var(--po-hue,var(--ow-user-hue,258))}`, every
         gradient, every accent — glides for free at 60fps, unchanged. An event
         is not cheap, and a starfield does not need to travel: it needs to
         arrive. Mid-flight frames set the variable and stay silent; the frame
         that LANDS tells the canvases, once.

         This is not a throttle and not a debounce — nothing is dropped or
         delayed on a guess. It is the observation that a sweep has exactly one
         destination and the buffers only ever needed that. */
      if (midFlight) return;
      try { global.dispatchEvent(new CustomEvent('ow:hue', { detail: { hue: d } })); }
      catch (_) {}
    },
    /* RESET MEANS "BACK TO ME", NOT "BACK TO PURPLE".
       This tweened to DEF1/DEF2 — the platform default — so closing any Popit
       that had re-coloured the world dropped the viewer into ONEWAY purple
       instead of their own hue, and did it without passing applyPair, so the
       tab icon was left wearing whatever it had. Third instance of one defect:
       a second path to a value that has exactly one correct source. The
       viewer's own pair is what hue.bind resolved; ctxPair holds it, and the
       platform default is only the answer when a viewer has chosen nothing. */
    reset: function (ms) { hue.context(null, null, ms == null ? 700 : ms); },
    /* Scope a Center to a subtree without touching the world. */
    scope: function (node, h1, h2) {
      if (!node) return;
      node.style.setProperty('--ow-h1', h1 || DEF1);
      node.style.setProperty('--ow-h2', h2 || h1 || DEF2);
      node.style.setProperty('--ow-h3', hue.third(h1 || DEF1) || h2 || DEF2);
    }
  };

  /* ── 1.1 · THE BINDING — the surface hue is the PERSON'S or the CENTER'S ──
     (founder, 2026-07-28: "make sure these hues would follow and automatically
     adjust to a user's chosen hue in app settings and center in os.")

     TWO HUE LAYERS, and confusing them is the mistake to avoid:

     · THE SURFACE hue is whose world you are standing in. In the App that is
       the VIEWER'S own chosen hue; in the OS it is the CENTER being operated
       (resolved_hue: personal → user_hue · center → center_hue). It drives the
       world, the material, every glow. Set on :root, so everything inherits and
       nothing has to be told.

     · A REFERENCED CENTER keeps ITS OWN hue wherever it appears — the dots in
       Belonging, the marks on a shelf. Those are other people's identities, not
       the viewer's theme, and recolouring them to match the surface would erase
       the one thing that makes the widget legible (§17: hue is recognition).

     Reuses the App's existing key (localStorage.ow_user_hue) rather than
     inventing a second one, and keeps writing --ow-user-hue so surfaces still
     on oneway-hue.js keep working while they are converted. */
  /* `boundAngle` is the angle CURRENTLY WORN; `ownAngle` is the viewer's own,
     which only `hue.bind` sets. They were one variable, and that is why half
     the surface transitioned — see the note in applyPair. */
  /* `inContext` is TRUE while the surface is wearing somebody else's light —
     a Centre's or another person's. It exists because `hue.bind` answers a
     different question ("who is the viewer?") and was silently answering this
     one too; see the note on hue.bind. */
  var boundAngle = null, ownAngle = null, ctxPair = null, inContext = false;

  function applyPair(p1, p2, ms, angle) {
    /* ── THE PAIR MOVED AND THE WORLD DID NOT ────────────────────────────
       ★ FOUNDER, 2026-09-09, looking at a profile mid-transition: *"it looks
         good but is not stable i can see multiple issues here."*

       MEASURED that moment, standing on the profile of somebody who chose 210
       while signed in as somebody who chose 150:

           --ow-h1        92,173,255   HERS
           --ow-user-hue  150          MINE

       Both, at once, on the same surface. The cards, glow and accents wore her
       blue while the galaxy behind them and every Popit face — which paint from
       the ANGLE, `.ow-cv{--po-h:var(--po-hue,var(--ow-user-hue,258))}` — stayed
       my green. Not a colour that was wrong: two colours that disagreed, which
       is worse, and it is exactly what "not stable" looks like.

       The cause was one variable doing two jobs. `applyPair` repainted the
       angle from `boundAngle` — "the viewer's own" — so a context could move
       the pair and had no way to move the angle with it. The fix is to say
       which angle this paint wears, and to keep the viewer's own separately so
       leaving can restore it. A context NEVER persists: `ow_user_hue` is still
       written only by `hue.bind`, so standing in somebody's light cannot
       overwrite your own colour on this device.

       compat: older surfaces derive their accents from a single angle.
       THROUGH THE ONE SETTER. This wrote the variable itself, on the root only
       — a third writer of `--ow-user-hue`, and the one every boot and every
       `hue.bind` goes through. `oneway-hue.js` also writes <body>, so the
       stale body value shadowed this for every element inside it and the Popit
       canvas never moved. Measured 2026-08-26. */
    /* THE ANGLE RIDES INSIDE THE TWEEN, NOT BESIDE IT. Setting it here as well
       would land the destination angle on frame one and the world would JUMP
       while the pair glided — the same disagreement one layer down. `tween`
       already derives the angle from the colour it is painting this frame, so
       it is handed over and only the instant path sets it directly. */
    var a = (angle != null) ? angle : boundAngle;
    if (ms) { hue.tween(p1, p2, ms, a); }
    else { hue.set(p1, p2); if (a != null) hue.angle(a); }
    /* THE MARK TAKES THE SAME LIGHT. Hooked HERE — the one place every hue
       change passes through — so the tab can never disagree with the world,
       whichever surface changed it. After the tween, not during: repainting a
       data URI on every frame of an 800ms transition would be absurd. */
    if (OW.paintIcon) global.setTimeout(OW.paintIcon, ms ? ms + 30 : 0);
  }
  function readUserAngle() {
    try {
      var v = global.localStorage.getItem('ow_user_hue');
      var n = parseInt(v, 10);
      return isNaN(n) ? null : Math.max(0, Math.min(359, n));
    } catch (_) { return null; }
  }

  /* WHAT A PERSON WEARS BEFORE THEIR OWN COLOUR IS KNOWN. A signed-out guest wears the month's pair; a signed-in person, on a browser that
     has not heard the account yet, wears a neutral ink and never a colour that is not theirs (his ruling, "Fixed per person"). */
  var QUIET_INK = '142,142,150', wearingQuiet = false, answeredNone = false;     /* answeredNone: the account has answered and has no hue of its own, so the neutral is over for good (it was bound again on leaving a context) */
  function unknownPair() {
    var inside = false;
    try { inside = typeof OW.signedIn === 'function' ? !!OW.signedIn() : global.localStorage.getItem('ow_session_cookie') === '1'; } catch (_) {}
    return inside && !answeredNone ? { h1: QUIET_INK, h2: QUIET_INK } : { h1: DEF1, h2: DEF2 };
  }

  /* THE ACCOUNT HAS ANSWERED (oneway-hue.js sync): whoever is wearing the neutral wears their own now, on any page. An exact pair comes with the
     person's profile, and it is never on this path: a saved one binds without the neutral. */
  hue.heard = function (a) {
    if (!wearingQuiet) return;
    /* an account that answers with no hue of its own wears Oneway's own, never the neutral grey for good (main, 2026-11-09: the chosen outline and Keep were grey) */
    if (a != null) hue.bind({ angle: a }); else hue.bind({ month: true });
  };

  /* Bind the surface to the viewer's own hue. Call once at boot in the App.
     `hue` may be a pair {h1,h2} (an authored identity — always wins) or an
     angle (the backend's resolved_hue, bridged to a pair). */
  hue.bind = function (opts) {
    opts = opts || {};
    wearingQuiet = false;
    /* ── BIND CAN GLIDE, BECAUSE THE PICKER HAS TO USE IT ─────────────────
       ★ FOUNDER, 2026-09-10: *"im checking if user hue in settings changes
         whole platform still doesnt!!"*

       He is right, and this is why. The Appearance picker PAINTED — it tweened
       the variables and wrote localStorage — and never told the identity layer
       anything. `ctxPair` and `ownAngle` are set only by this function, and
       they are what `hue.context('personal')` restores on every navigation. So
       a person picked a colour, watched the whole surface change, walked to
       Home, and the dock's own reset handed them back the hue they booted with.
       MEASURED: picked 270 on Appearance, then Home / Discovery / Messages all
       read 150 again.

       The picker could not call `bind` before now because bind SNAPPED, and
       the pick is the one moment the change must be seen happening. So bind
       takes a duration. One writer, and it can animate. */
    var _ms = (opts.ms == null) ? 0 : opts.ms;
    /* AN EXACT COLOUR OUTRANKS AN ANGLE. A person who chose #2f6f5e means that
       colour; an angle can only ever express a fully-saturated neon, so
       deriving one from their pick would quietly replace it with something
       adjacent and brighter. Remembered locally as well, because a reload that
       shows the platform default for 400ms before the profile arrives is the
       same defect briefly. */
    if (opts.pair && opts.pair.h1) {
      /* THE COMPAT ANGLE DESCRIBES THE COLOUR, NOT THE FIELD BESIDE IT. This
         took `opts.angle` — the account's `accent_hue` — which is still 266
         for anyone who chose a hex, so every angle-only surface was told
         "platform default" about a person who had picked a colour. Derived
         from the pair, `--ow-user-hue` and `ow_user_hue` now at least name
         the right family. `angleOf` returns null for a grey, and the supplied
         angle remains the fallback. */
      var derived = hue.angleOf(opts.pair.h1);
      boundAngle = (derived != null) ? derived
                 : ((opts.angle != null) ? parseInt(opts.angle, 10) : null);
      ownAngle = boundAngle;          /* this IS the viewer; remember it */
      ctxPair = opts.pair;
      try {
        global.localStorage.setItem('ow_user_pair',
          opts.pair.h1 + '|' + (opts.pair.h2 || opts.pair.h1));
        /* THE KEY THE OTHER PRODUCT READS. `dashboard.html` resolves a person's
           hue from `ow_user_hue` BEFORE it asks the server, so writing it here
           is the whole of the App's side of the seam — the OS needs no change
           to stop showing default purple to somebody who chose a colour. The
           pair stays authoritative for anything that can read one. */
        if (boundAngle != null)
          global.localStorage.setItem('ow_user_hue', String(boundAngle));
      } catch (_) {}
      /* ── BINDING WHO YOU ARE MUST NOT REPAINT WHOSE WORLD YOU ARE IN ────
         ★ MEASURED 2026-09-09: open somebody's profile link COLD — not by
         tapping through the app, but by arriving at the URL — and the surface
         wears YOUR colour, not theirs. Signed in as a person whose hue is 150,
         landing on the profile of a person who chose 310: --ow-h1 came back
         92,255,173. Mine. Every time.

         The profile does assert their light; it just loses a race. Boot calls
         `OW.live.identity(ME)` (oneway-app.html:1139), which resolves the
         viewer's own colour a beat later and lands here — and this function
         ended by PAINTING. So the deep link rendered their world and then the
         viewer's identity arrived and painted over it, about a second in.

         That is the same shape the comment inside `OW.live.identity` already
         records about the sign-up crossing: "this line bound 266 about a
         second after Home booted and painted the default back over it". Same
         defect, one layer down, and it survives because tapping through the
         app hides it — by then identity has long since resolved.

         So bind still records the viewer — ctxPair, ownAngle, localStorage,
         all unchanged, because leaving a context has to know where to return
         to — and it only PAINTS when the surface is not currently standing in
         somebody else's light. */
      if (inContext) return ctxPair;
      return applyPair(opts.pair.h1, opts.pair.h2, _ms);
    }
    if (opts.angle != null || opts.clear) {
      try { global.localStorage.removeItem('ow_user_pair'); } catch (_) {}
    } else {
      var saved = readUserPair();
      if (saved) { ctxPair = saved;
        var sa = hue.angleOf(saved.h1);
        if (sa != null) { boundAngle = sa; ownAngle = sa; }
        return applyPair(saved.h1, saved.h2, _ms); }
    }
    var a = (opts.angle != null) ? parseInt(opts.angle, 10) : readUserAngle();
    if (a == null || isNaN(a)) { ctxPair = null; ownAngle = null;
      /* a viewer who has chosen nothing must not repaint the world in the
         PLATFORM DEFAULT over somebody else's identity either */
      /* {month:true} is the one press that asks for the month's by name: No hue in Settings (founder/891); the account cannot say so yet, so it holds for that page */
      if (opts.month) answeredNone = true;
      var none = opts.month ? { h1: DEF1, h2: DEF2 } : unknownPair();
      wearingQuiet = none.h1 === QUIET_INK;
      return inContext ? null : applyPair(none.h1, none.h2, _ms); }
    boundAngle = a;
    ownAngle = a;                     /* this IS the viewer; remember it */
    /* ── AN ANGLE HAS TO SURVIVE THE NAVIGATION TOO ──────────────────────
       Only the `pair` branch above persisted anything, so binding by ANGLE
       painted the current page and was forgotten the moment it unloaded —
       while `OW.crossing`'s own comment promises "bind persists the pair, so
       the destination is already their colour on its FIRST PAINT".

       That promise held for somebody who had chosen a hex and failed for
       everybody else, which is exactly the first-time case: a person who
       registered ten seconds ago has an angle derived from their identity and
       nothing else. Measured 2026-08-30 — the sign-up crossing recoloured the
       world to 255,92,211 and the App booted in platform purple, so the
       "clean animation into their hue" ended by throwing the hue away.

       `ow_user_hue` is the key `dashboard.html` reads before it asks the
       server, so writing it here is also the whole of the App's side of that
       seam. `ow_user_pair` is deliberately NOT written: a pair is an exact
       colour somebody chose, and an angle is not that. */
    try { global.localStorage.setItem('ow_user_hue', String(a)); } catch (_) {}
    var p = hue.fromAngle(a);
    ctxPair = { h1: p[0], h2: p[1] };
    /* AND THIS IS THE BRANCH ALMOST EVERYONE TAKES. The guard went onto the
       `pair` branch first, which only runs for somebody who picked an exact
       hex — five accounts in 1,260. Everybody else binds by ANGLE and fell
       straight through it, so a cold deep link still painted the viewer's
       colour over the profile it had just opened. Measured: arriving at the
       URL of a person who chose 310, signed in as 150, still read 150. */
    if (inContext) return ctxPair;
    applyPair(p[0], p[1], _ms);
  };

  /* a colour a person actually chose, held for the next cold boot */
  function readUserPair() {
    try {
      var v = (global.localStorage.getItem('ow_user_pair') || '').split('|');
      if (v.length === 2 && parseTriplet(v[0]) && parseTriplet(v[1]))
        return { h1: v[0], h2: v[1] };
    } catch (_) {}
    return null;
  }

  /* #2f6f5e → "47,111,94". The one place a chosen colour becomes a triplet, so
     the surface, the tab icon and the installed icon cannot disagree about what
     the person picked. */
  /* the ONE reader of "what colour did this person choose?", so the boot path,
     the picker and anything later cannot each decide it differently */
  hue.hexOf = function (style) {
    var h = String((style || {}).accent_hex1 || '').trim();
    return /^#?[0-9a-f]{6}$/i.test(h) ? (h[0] === '#' ? h : '#' + h) : '';
  };
  hue.pairOf = function (style) {
    var h1 = hue.hexOf(style); if (!h1) return null;
    var r1 = hue.fromHex(h1); if (!r1) return null;
    var r2 = hue.fromHex((style || {}).accent_hex2) || hue.mate(r1);
    return { h1: r1, h2: r2 };
  };
  /* THE ANGLE THAT DESCRIBES A COLOUR SOMEBODY ACTUALLY PICKED.
     `fromAngle` goes one way — an angle becomes a fully-saturated pair. This
     goes back, and it exists because the OS cannot yet carry a pair: it paints
     from a single angle (`--ow-user-hue`, `owApplyResolvedHue`) and reads it
     from the account as `accent_hue`, which stays at the platform default 266
     when a person expresses themselves as a HEX instead of a wheel angle.

     MEASURED 2026-08-09: person sets accent_hex1 #2f6f5e; the App wears that
     exact muted green across every page; the OS receives {"user":266} and
     paints the DEFAULT PURPLE — and 266 is the very value the OS treats as
     "unset". Not an approximation of their colour: the absence of one.

     So the compat angle is derived FROM the chosen colour rather than read
     beside it. Saturation and lightness are lost — that is inherent to an
     angle and is exactly why the App itself never uses one when a pair
     exists — but "the right family, brighter" beats "the platform default",
     which is what the OS shows today. The proper fix is the contract carrying
     the pair; this is the half that lives in the App and does not need it. */
  hue.angleOf = function (rgb) {
    var t = parseTriplet(rgb); if (!t) return null;
    var r = t[0] / 255, g = t[1] / 255, b = t[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return null;                    /* a grey has no hue to describe */
    var h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    return ((h % 360) + 360) % 360;
  };
  hue.fromHex = function (hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  };
  /* the second tone of a pair, if a person picked only one: the same -64°
     relationship fromAngle uses, so a custom colour and a wheel colour build
     their gradient the same way rather than by two different rules */
  /* THE MONTH'S HUE, AS A TOKEN AND ON TIME (founder/891: "should show on app guest screens and the apps landing page hue mixed
     with others"; founder/980). `--ow-month` on the root is this month's colour as an "R,G,B" triplet, for a look to draw as one
     of its glows, never the lead (founder/976: the landings lead with deep blues and purples): rgba(var(--ow-month), .5).
     OW.hue.month() gives {name, angle, hex, month}. The month turns on the 1st by the person's own clock: a page left open
     across it turns too, and so does everybody who wears No hue (no hue of their own, so the platform default is the month's). */
  function monthTurn() {
    var now = new Date(), m = MONTHS[now.getMonth()], was = MONTH_NOW;
    MONTH_NOW = m;
    DEF1 = strong(m[1]).join(','); DEF2 = strong(m[1] - 64).join(',');
    root.style.setProperty('--ow-month', DEF1);
    if (was !== m && ownAngle == null && !inContext) {
      try { if (!global.localStorage.getItem('ow_user_pair') && !global.localStorage.getItem('ow_user_hue') && unknownPair().h1 === DEF1) hue.set(DEF1, DEF2); } catch (_) {}
    }
    var next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 1);
    global.setTimeout(monthTurn, Math.min(next - now, 2147483000));
  }
  monthTurn();
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && MONTHS[new Date().getMonth()] !== MONTH_NOW) monthTurn(); });

  hue.mate = function (rgb) {
    var t = parseTriplet(rgb); if (!t) return rgb;
    var h = rgb2hsl(t[0], t[1], t[2]);
    return hsl2rgb((h[0] - 64 + 360) % 360, h[1], h[2]).join(',');
  };

  /* THE ACTIVE CONTEXT. Personal mode wears the viewer's hue; entering a Center
     to operate it re-colours the world to that Center (§17 — "entering a Center
     should re-colour the world"). Leaving returns to the person. One entry
     point, so no surface can change context without the world responding. */
  /* THE RULE, PLAINLY: the surface wears the identity you are STANDING IN.
     Your own by default; a Center's while you are in it; another person's while
     you are on their profile. Leaving anything returns you to your own — which
     is why the fallback is ctxPair (what hue.bind resolved for THIS viewer) and
     never the platform default.

     TWO DEFECTS THIS REPLACES, both of which made the founder's rule half-true.

     1 · IT BYPASSED applyPair. It called hue.tween directly, and applyPair is
     the ONE place OW.paintIcon is hooked — so the world re-coloured on entering
     a Center and THE TAB ICON DID NOT. The single most visible half of "the
     icon corresponds to the Center you are viewing" was the half that never
     ran. A second path to a thing that has one hook is a second path that
     forgets the hook.

     2 · THE PERSON BRANCH DISCARDED THE HUE IT WAS GIVEN. Viewing someone
     else's profile passed their pair in and fell through to "go back to mine",
     so another person's identity never reached the surface at all. Any mode
     carrying a hue now WEARS it; only an absent hue means "return to me". */
  /* 3 · IT MOVED THE PAIR AND LEFT THE WORLD BEHIND. Entering an identity
     re-coloured the accents and not the galaxy or the Popit faces, because
     those paint from the compat ANGLE and nothing carried it. Both halves
     travel together now — see applyPair — and leaving restores the viewer's
     OWN angle rather than whatever they were last standing in. */
  hue.context = function (mode, theirs, ms) {
    if (theirs) {
      var p = (typeof theirs === 'object' && theirs.h1)
        ? [theirs.h1, theirs.h2 || theirs.h1]
        : hue.fromAngle(theirs);
      /* derived from the colour, not read from a field beside it — the same
         rule `hue.bind` follows, so one identity cannot have two answers */
      inContext = true;
      return applyPair(p[0], p[1], ms == null ? 800 : ms, hue.angleOf(p[0]));
    }
    var back = ctxPair || unknownPair();
    inContext = false;                       /* back in your own world */
    /* `ms || 700` turned an explicit 0 into a 700ms tween — a caller asking
       for an instant change got the opposite. Zero is a duration. */
    applyPair(back.h1, back.h2, ms == null ? 700 : ms,
              (ownAngle != null) ? ownAngle : hue.angleOf(back.h1));
  };

  /* A TWEEN CAUGHT MID-FLIGHT BY THE TAB GOING AWAY STILL ARRIVES. rAF stops
     the moment the document hides, so without this the sweep is abandoned at
     whatever fraction it had reached and that colour becomes permanent. Landing
     it while hidden costs one style write and means the person comes back to
     the world they navigated to, not to the one they were leaving. */
  try {
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden || !huePending) return;
      var d = huePending; huePending = null;
      if (hueRAF) { cancelAnimationFrame(hueRAF); hueRAF = 0; }
      hue.set(d.h1, d.h2);
      if (d.angle != null) hue.angle(d.angle);
    });
  } catch (_) {}

  /* The setting changes in another tab → every open surface repaints. Same
     mechanism oneway-hue.js already used; one listener, no polling. */
  try {
    global.addEventListener('storage', function (e) {
      if (!e || (e.key !== 'ow_user_hue' && e.key !== 'ow_user_pair')) return;
      /* THE PAIR WINS, OR THIS LISTENER UNDOES THE CHOICE IT IS REPAINTING
         FOR. Binding a pair now also writes the derived `ow_user_hue` so the
         OS can read it — which fires this listener in every OTHER open App
         tab, and binding an angle CLEARS the pair. One person, two tabs, and
         the second tab would quietly downgrade an exact colour to the neon
         nearest it. So the exact colour is re-read first and only its absence
         falls through to the angle. */
      var p = readUserPair();
      if (p) hue.bind({ pair: p });
      else if (e.key === 'ow_user_hue') hue.bind({ angle: e.newValue });
    });
  } catch (_) {}

  OW.hue = hue;

  /* ═══ 2 · CAPABILITY TIERS ═════════════════════════════════════════════
     Measured, never sniffed. The old build asked "is this a phone?" and gave
     phones nothing. This asks "what can this device actually sustain?" and
     lets a modern phone have the full world. Tier only ever DOWNGRADES at
     runtime — never oscillates. */
  var tier = 1;
  function detectTier() {
    if (RM) return 0;
    var mem = global.navigator.deviceMemory || 4;
    var cpu = global.navigator.hardwareConcurrency || 4;
    var slow = global.matchMedia && matchMedia('(update: slow)').matches;
    var save = global.navigator.connection && global.navigator.connection.saveData;
    if (slow || save || mem <= 1 || cpu <= 2) return 0;
    var coarse = global.matchMedia && matchMedia('(pointer: coarse)').matches;
    /* Touch devices stay at tier 1 by default: the CSS starfield gives them a
       real sky at no cost, and the 2026-07 iPhone crash was the always-on
       canvas stacked ON TOP of the backdrop-filter/blend/filter set. That set
       is gone from the material now, but re-introducing the canvas on phones
       requires physical-device re-verification (the permanent baseline). */
    if (coarse) return 1;
    return (mem >= 4 && cpu >= 4) ? 2 : 1;
  }
  function setTier(t) {
    tier = t; root.setAttribute('data-ow-tier', String(t));
  }
  /* Runtime guard: if the first ~90 frames are consistently slow, step down. */
  function watchFrames() {
    if (tier === 0) return;
    var n = 0, slow = 0, last = performance.now();
    (function tick(t) {
      var dt = t - last; last = t;
      if (n++ > 4 && dt > 26) slow++;
      if (n < 90) requestAnimationFrame(tick);
      else if (slow > 26) setTier(Math.max(0, tier - 1));
    })(last);
  }

  /* ═══ 3 · THE WORLD ════════════════════════════════════════════════════ */
  var worldNode = null;
  OW.world = {
    tier: function () { return tier; },
    mount: function (opts) {
      opts = opts || {};
      if (worldNode) return worldNode;
      setTier(opts.tier != null ? opts.tier : detectTier());
      worldNode = el('div', 'ow-world');
      worldNode.setAttribute('aria-hidden', 'true');
      worldNode.appendChild(el('div', 'ow-world__field'));
      worldNode.appendChild(el('div', 'ow-world__wash'));
      worldNode.appendChild(el('div', 'ow-world__neb'));
      worldNode.appendChild(el('div', 'ow-world__stars'));
      /* NO CONNECTED DOTS (S39, founder/1309: "Arrows not dots"): the two far fields, which drew knots of points joined by lines at every
         width, are gone. The sky is the wash, the nebula and the stars (founder, 2026-10-09: "keep the moving galaxy effect"). */
      /* NO DOTS FOLLOW THE CURSOR. ★ FOUNDER, 2026-10-09: *"there are these dots that move with the cursor that
         feel like they are awfully to blown up and close to the screen. i still wanna keep the moving galaxy effect
         but simply remove the pale white dots that follow the cursor"*. Tier 2 drew sixteen soft glows (20-90 px)
         on a canvas over the stars, swung by the cursor; that canvas is gone. The galaxy still moves: the nebula
         (92 s) and both star layers (300 s, 420 s) drift in CSS, over the two still fields. */
      doc.body.insertBefore(worldNode, doc.body.firstChild);
      watchFrames();
      return worldNode;
    },
    unmount: function () {
      if (worldNode) { worldNode.remove(); worldNode = null; }
    }
  };


  /* ═══ 4 · LIVE-WHILE-VISIBLE ═══════════════════════════════════════════
     The bob runs ONLY for beads in view. A feed of 200 objects animates the
     ~8 you can actually see, and off-screen beads hold no compositor layer.
     This is what makes the material affordable at density. */
  var io = global.IntersectionObserver ? new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      entries[i].target.classList.toggle('po-live', entries[i].isIntersecting);
    }
  }, { rootMargin: '120px' }) : null;
  function observe(node) { if (io) io.observe(node); else node.classList.add('po-live'); }

  /* ═══ 5 · THE RENDERER ═════════════════════════════════════════════════
     data → Popit. The shape is the runtime's own contract; see fromApi().
       { id, label, kind_label, glance, signal, icon, image:{url,source},
         time_back:[{at,text}], time_forward:[{text,why}], hue:{h1,h2} } */

  /* ═══ ONE ICON SET: PHOSPHOR (founder/886, 2026-10-21: "more detailed and dynamic icons, the icons should be universal across
     here and the center pages and have a huge selection ... they must have no geommetric errors or misspaced overlapping
     lines"; his word ~16:45Z: "download Phosphor and use it as Oneway's icon set"). Phosphor Icons 2.1.1, MIT
     (assets/icons/phosphor/LICENSE), each icon drawn exactly as Phosphor ships it on its 256 grid: Bold for the interface (the
     old 2px line), Fill for the selected one (it springs in over the outline, oneway-popit.css "ONE ICON SET"), Two-tone for
     page icons, tiles and empty states. tools/phosphor_build.py builds the data from the npm package: the few Home's first
     screen draws ride here (PH_BOOT), the rest of what Oneway draws loads at idle (oneway-icons.js), and any other of the set's
     1,512 a letter at a time (assets/icons/phosphor/all/), so a Center's chosen icon draws for every visitor. Icons NAME a
     role, they never decorate; a Popit whose object gives no icon has none. ICONS are the roles asked for by name
     (OW.glyph('heart')); any Phosphor name works as well (OW.glyph('coffee', {w: 'd'})). */
  var ICONS = {
    home: 'house', compass: 'compass', layers: 'stack', people: 'users-three', place: 'map-pin', event: 'calendar-blank',
    talk: 'chat-circle', doc: 'file-text', building: 'buildings', spark: 'sparkle', link: 'link', music: 'music-notes',
    video: 'video-camera', camera: 'camera', cart: 'shopping-cart', mail: 'envelope-simple', globe: 'globe',
    write: 'pencil-simple', clock: 'clock', tag: 'tag', parking: 'letter-circle-p', card: 'credit-card', phone: 'phone',
    /* the response glyphs: the runtime stores MEANING ("like"), never a glyph, so the heart lives here, in presentation */
    heart: 'heart', thumbup: 'thumbs-up', thumbdown: 'thumbs-down', repost: 'repeat', share: 'export',
    bookmark: 'bookmark-simple', eye: 'eye', play: 'play', pause: 'pause', sound: 'speaker-high', muted: 'speaker-slash'
  };
  /* PHOSPHOR BOOT (built by tools/phosphor_build.py; do not edit by hand) */
  var PH_BOOT = {"bookmark-simple":{"b":"<path d=\"M184,28H72A20,20,0,0,0,52,48V224a12,12,0,0,0,18.36,10.18l57.63-36,57.65,36A12,12,0,0,0,204,224V48A20,20,0,0,0,184,28Zm-4,174.35-45.65-28.53a12,12,0,0,0-12.72,0L76,202.35V52H180Z\"/>","f":"<path d=\"M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z\"/>"},"calendar-blank":{"b":"<path d=\"M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Z\"/>","f":"<path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z\"/>"},"chat":{"b":"<path d=\"M216,44H40A20,20,0,0,0,20,64V224A19.82,19.82,0,0,0,31.56,242.1a20.14,20.14,0,0,0,8.49,1.9,19.91,19.91,0,0,0,12.82-4.72l.12-.11L84.47,212H216a20,20,0,0,0,20-20V64A20,20,0,0,0,216,44Zm-4,144H80a11.93,11.93,0,0,0-7.84,2.92L44,215.23V68H212Z\"/>","f":"<path d=\"M232,64V192a16,16,0,0,1-16,16H83l-32.6,28.16-.09.07A15.89,15.89,0,0,1,40,240a16.05,16.05,0,0,1-6.79-1.52A15.84,15.84,0,0,1,24,224V64A16,16,0,0,1,40,48H216A16,16,0,0,1,232,64Z\"/>"},"chat-circle":{"b":"<path d=\"M128,20A108,108,0,0,0,31.85,177.23L21,209.66A20,20,0,0,0,46.34,235l32.43-10.81A108,108,0,1,0,128,20Zm0,192a84,84,0,0,1-42.06-11.27,12,12,0,0,0-6-1.62,12.1,12.1,0,0,0-3.8.62l-29.79,9.93,9.93-29.79a12,12,0,0,0-1-9.81A84,84,0,1,1,128,212Z\"/>","f":"<path d=\"M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z\"/>"},"compass":{"b":"<path d=\"M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212ZM163.27,77l-56,24a12,12,0,0,0-6.3,6.3l-24,56A12,12,0,0,0,92.73,179l56-24a12,12,0,0,0,6.3-6.3l24-56A12,12,0,0,0,163.27,77Zm-28.41,57.89-24,10.29,10.29-24,24-10.29Z\"/>","f":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm51.58,57.79-32,64a4.08,4.08,0,0,1-1.79,1.79l-64,32a4,4,0,0,1-5.37-5.37l32-64a4.08,4.08,0,0,1,1.79-1.79l64-32A4,4,0,0,1,179.58,81.79Z\"/>"},"export":{"b":"<path d=\"M220,112v96a20,20,0,0,1-20,20H56a20,20,0,0,1-20-20V112A20,20,0,0,1,56,92H76a12,12,0,0,1,0,24H60v88H196V116H180a12,12,0,0,1,0-24h20A20,20,0,0,1,220,112ZM96.49,72.49,116,53v83a12,12,0,0,0,24,0V53l19.51,19.52a12,12,0,1,0,17-17l-40-40a12,12,0,0,0-17,0l-40,40a12,12,0,1,0,17,17Z\"/>","f":"<path d=\"M216,112v96a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V112A16,16,0,0,1,56,96h64v48a8,8,0,0,0,16,0V96h64A16,16,0,0,1,216,112ZM136,43.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,69.66L120,43.31V96h16Z\"/>"},"eye":{"b":"<path d=\"M251,123.13c-.37-.81-9.13-20.26-28.48-39.61C196.63,57.67,164,44,128,44S59.37,57.67,33.51,83.52C14.16,102.87,5.4,122.32,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212s68.63-13.66,94.48-39.51c19.36-19.35,28.12-38.79,28.49-39.61A12.08,12.08,0,0,0,251,123.13Zm-46.06,33C183.47,177.27,157.59,188,128,188s-55.47-10.73-76.91-31.88A130.36,130.36,0,0,1,29.52,128,130.45,130.45,0,0,1,51.09,99.89C72.54,78.73,98.41,68,128,68s55.46,10.73,76.91,31.89A130.36,130.36,0,0,1,226.48,128,130.45,130.45,0,0,1,204.91,156.12ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,148Z\"/>"},"hammer":{"b":"<path d=\"M250.18,105.17,186.71,41.25a100.11,100.11,0,0,0-141.43,0l-.13.14L31.37,55.61a12,12,0,1,0,17.24,16.7L62.32,58.16A75.68,75.68,0,0,1,77.49,46.43L119,88,25.85,181.16a20,20,0,0,0,0,28.29l20.69,20.69a20,20,0,0,0,28.28,0L168,137l1.51,1.51h0l23.65,23.66a20,20,0,0,0,28.29,0l28.69-28.7A20,20,0,0,0,250.18,105.17ZM60.68,210.34l-15-15L108,133l15,15ZM140,131l-15-15,19.51-19.51a12,12,0,0,0,0-17L102.24,37.24a75.94,75.94,0,0,1,67.47,20.95l31.44,31.67L178,113l-1.51-1.51a12,12,0,0,0-17,0Zm67.32,11.31L195,130l23.09-23.09,12.3,12.39Z\"/>","f":"<path d=\"M251.34,112,183.88,44.08a96.1,96.1,0,0,0-135.77,0l-.09.09L34.25,58.4A8,8,0,0,0,45.74,69.53L59.47,55.35a79.92,79.92,0,0,1,18.71-13.9L124.68,88l-96,96a16,16,0,0,0,0,22.63l20.69,20.69a16,16,0,0,0,22.63,0l96-96,32,32a16,16,0,0,0,22.63,0l28.69-28.69A16,16,0,0,0,251.34,112Zm-89,2.33L140,136.67,119.31,116l22.35-22.35a8,8,0,0,0,0-11.32L94.32,35a80,80,0,0,1,78.23,20.41l44.22,44.51L188,128.66l-14.34-14.34A8,8,0,0,0,162.34,114.32Zm49,37.66-12-12L228,111.25l12,12Z\"/>"},"heart":{"b":"<path d=\"M178,36c-20.09,0-37.92,7.93-50,21.56C115.92,43.93,98.09,36,78,36a66.08,66.08,0,0,0-66,66c0,72.34,105.81,130.14,110.31,132.57a12,12,0,0,0,11.38,0C138.19,232.14,244,174.34,244,102A66.08,66.08,0,0,0,178,36Zm-5.49,142.36A328.69,328.69,0,0,1,128,210.16a328.69,328.69,0,0,1-44.51-31.8C61.82,159.77,36,131.42,36,102A42,42,0,0,1,78,60c17.8,0,32.7,9.4,38.89,24.54a12,12,0,0,0,22.22,0C145.3,69.4,160.2,60,178,60a42,42,0,0,1,42,42C220,131.42,194.18,159.77,172.51,178.36Z\"/>","f":"<path d=\"M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z\"/>"},"house":{"b":"<path d=\"M222.14,105.85l-80-80a20,20,0,0,0-28.28,0l-80,80A19.86,19.86,0,0,0,28,120v96a12,12,0,0,0,12,12h64a12,12,0,0,0,12-12V164h24v52a12,12,0,0,0,12,12h64a12,12,0,0,0,12-12V120A19.86,19.86,0,0,0,222.14,105.85ZM204,204H164V152a12,12,0,0,0-12-12H104a12,12,0,0,0-12,12v52H52V121.65l76-76,76,76Z\"/>","f":"<path d=\"M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z\"/>"},"lightbulb":{"b":"<path d=\"M180,232a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h80A12,12,0,0,1,180,232Zm40-128a91.51,91.51,0,0,1-35.17,72.35A12.26,12.26,0,0,0,180,186v2a20,20,0,0,1-20,20H96a20,20,0,0,1-20-20v-2a12,12,0,0,0-4.7-9.51A91.57,91.57,0,0,1,36,104.52C35.73,54.69,76,13.2,125.79,12A92,92,0,0,1,220,104Zm-24,0a68,68,0,0,0-69.65-68C89.56,36.88,59.8,67.55,60,104.38a67.71,67.71,0,0,0,26.1,53.19A35.87,35.87,0,0,1,100,184h56.1A36.13,36.13,0,0,1,170,157.49,67.68,67.68,0,0,0,196,104Zm-20.07-5.32a48.5,48.5,0,0,0-31.91-40,12,12,0,0,0-8,22.62,24.31,24.31,0,0,1,16.09,20,12,12,0,0,0,23.86-2.64Z\"/>","f":"<path d=\"M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-32.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z\"/>"},"repeat":{"b":"<path d=\"M20,128A76.08,76.08,0,0,1,96,52h99l-3.52-3.51a12,12,0,1,1,17-17l24,24a12,12,0,0,1,0,17l-24,24a12,12,0,0,1-17-17L195,76H96a52.06,52.06,0,0,0-52,52,12,12,0,0,1-24,0Zm204-12a12,12,0,0,0-12,12,52.06,52.06,0,0,1-52,52H61l3.52-3.51a12,12,0,1,0-17-17l-24,24a12,12,0,0,0,0,17l24,24a12,12,0,1,0,17-17L61,204h99a76.08,76.08,0,0,0,76-76A12,12,0,0,0,224,116Z\"/>","f":"<path d=\"M24,128A72.08,72.08,0,0,1,96,56h96V40a8,8,0,0,1,13.66-5.66l24,24a8,8,0,0,1,0,11.32l-24,24A8,8,0,0,1,192,88V72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H64V168a8,8,0,0,0-13.66-5.66l-24,24a8,8,0,0,0,0,11.32l24,24A8,8,0,0,0,64,216V200h96a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z\"/>"},"storefront":{"b":"<path d=\"M236,96a12,12,0,0,0-.44-3.3L221.2,42.51A20.08,20.08,0,0,0,202,28H54A20.08,20.08,0,0,0,34.8,42.51L20.46,92.7A12,12,0,0,0,20,96h0v16a43.94,43.94,0,0,0,16,33.92V216a12,12,0,0,0,12,12H208a12,12,0,0,0,12-12V145.92A43.94,43.94,0,0,0,236,112V96ZM57.05,52H199l9.14,32H47.91Zm91,56v4a20,20,0,0,1-40,0v-4ZM53,128.71A20,20,0,0,1,44,112v-4H84v4a20,20,0,0,1-20,20,19.76,19.76,0,0,1-9.07-2.2A11.54,11.54,0,0,0,53,128.71ZM196,204H60V155.81c1.32.12,2.65.19,4,.19a43.86,43.86,0,0,0,32-13.85,43.89,43.89,0,0,0,64,0A43.86,43.86,0,0,0,192,156c1.35,0,2.68-.07,4-.19Zm16-92a20,20,0,0,1-9,16.71,11.66,11.66,0,0,0-1.88,1.09A20,20,0,0,1,172,112v-4h40Z\"/>","f":"<path d=\"M231.69,93.81,217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.81A7.94,7.94,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96A7.94,7.94,0,0,0,231.69,93.81ZM88,112a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8H88Zm64,0a24,24,0,0,1-48,0v-8h48Zm64,0a24,24,0,0,1-11.07,20.2,8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48Z\"/>"},"thumbs-down":{"b":"<path d=\"M243.78,156.53l-12-96A28,28,0,0,0,204,36H32A20,20,0,0,0,12,56v88a20,20,0,0,0,20,20H72.58l36.69,73.37A12,12,0,0,0,120,244a44.05,44.05,0,0,0,44-44V188h52a28,28,0,0,0,27.78-31.47ZM68,140H36V60H68Zm151,22.65a4,4,0,0,1-3,1.35H152a12,12,0,0,0-12,12v24a20,20,0,0,1-13.18,18.8L92,149.17V60H204a4,4,0,0,1,4,3.5l12,96A4,4,0,0,1,219,162.65Z\"/>","f":"<path d=\"M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Z\"/>"},"thumbs-up":{"b":"<path d=\"M237,77.47A28,28,0,0,0,216,68H164V56a44.05,44.05,0,0,0-44-44,12,12,0,0,0-10.73,6.63L72.58,92H32a20,20,0,0,0-20,20v88a20,20,0,0,0,20,20H204a28,28,0,0,0,27.78-24.53l12-96A28,28,0,0,0,237,77.47ZM36,116H68v80H36ZM220,96.5l-12,96a4,4,0,0,1-4,3.5H92V106.83L126.82,37.2A20,20,0,0,1,140,56V80a12,12,0,0,0,12,12h64a4,4,0,0,1,4,4.5Z\"/>","f":"<path d=\"M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32Z\"/>"},"user":{"b":"<path d=\"M234.38,210a123.36,123.36,0,0,0-60.78-53.23,76,76,0,1,0-91.2,0A123.36,123.36,0,0,0,21.62,210a12,12,0,1,0,20.77,12c18.12-31.32,50.12-50,85.61-50s67.49,18.69,85.61,50a12,12,0,0,0,20.77-12ZM76,96a52,52,0,1,1,52,52A52.06,52.06,0,0,1,76,96Z\"/>","f":"<path d=\"M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z\"/>"}};
  var PH_JS = '/frontend/shared/oneway-icons.js?v=2b35eb18';
  var PH_PICK = '/frontend/shared/oneway-iconpicker.js?v=e8e956ef';
  /* PHOSPHOR BOOT END */
  var PH = {}, PH_NAMES = null, PH_TAGS = null, PH_LOAD = {}, PH_ALL = '/assets/icons/phosphor/all/';
  (function () { for (var k in PH_BOOT) PH[k] = PH_BOOT[k]; })();
  /* the ones a press holds: they carry the outline and the fill, and the fill springs in when held */
  var HELD = { heart: 1, thumbup: 1, thumbdown: 1, repost: 1, bookmark: 1 };
  /* THE LIGHT AN ICON GIVES WHEN IT IS LIT (the founder, 2026-10-10: "look at facebook ... and all our interactions do").
     The interactions a person can hold or press carry three soft copies of their own filled shape behind them, hidden until
     the button is lit (oneway-popit.css, "LIT BUTTONS GLOW"): wide and faint, then tighter and brighter, so the glow follows
     the heart's or the thumb's own outline. Drawn in the SVG, not filtered: the safe floor every phone runs strips filters. */
  var HALOED = { heart: 1, thumbup: 1, thumbdown: 1, repost: 1, bookmark: 1, share: 1, talk: 1 };
  /* THE SPEECH BUBBLE'S THREE DOTS (the founder, 2026-10-10: "give it three dots like the typing animation when its open"):
     they only show, and only move, while the conversation is open (`aria-expanded`; ".ow-dot"). Not an icon: a motion. */
  var DOTS = '<circle class="ow-dot" cx="88" cy="128" r="13"/><circle class="ow-dot" cx="128" cy="128" r="13"/>'
           + '<circle class="ow-dot" cx="168" cy="128" r="13"/>';
  function phScript(src, then) {              /* one script, asked for once; then() when it has run */
    var q = PH_LOAD[src];
    if (q === true) { if (then) then(); return; }
    if (q) { if (then) q.push(then); return; }
    q = PH_LOAD[src] = then ? [then] : [];
    try {
      var s = doc.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { PH_LOAD[src] = true; q.forEach(function (f) { try { f(); } catch (_) {} }); };
      s.onerror = function () { delete PH_LOAD[src]; };
      (doc.head || doc.documentElement).appendChild(s);
    } catch (_) {}
  }
  function phHas(n, w, sel) { var I = PH[n]; return !!(I && (sel ? I.b && I.f : I[w])); }
  function phWant(n, w, sel) {
    if (!PH_NAMES) { phScript(PH_JS); return; }
    if (!PH_NAMES[n]) return;
    (sel ? ['b', 'f'] : [w]).forEach(function (x) { if (!(PH[n] && PH[n][x])) phScript(PH_ALL + x + '-' + n.charAt(0) + '.js?v=2.1.1'); });
  }
  function phBody(role, n, w, sel) {
    var I = PH[n], body = sel ? '<g class="ow-ic__o">' + I.b + '</g><g class="ow-ic__f">' + I.f + '</g>' : I[w];
    if (HALOED[role]) {
      var F = I.f || I.b;
      body = '<g class="ow-halo ow-halo--x">' + F + '</g><g class="ow-halo ow-halo--w">' + F + '</g><g class="ow-halo ow-halo--t">'
        + F + '</g>' + body;
    }
    return role === 'talk' ? body + DOTS : body;
  }
  /* a placeholder drawn before its icon arrived is filled in where it stands; one the set does not have hides */
  function phFill() {
    var els = doc.querySelectorAll ? doc.querySelectorAll('svg.ow-ic[data-ic]:empty') : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i], n = el.getAttribute('data-ic'), w = el.getAttribute('data-w') || 'b', sel = el.classList.contains('ow-ic--sel');
      if (phHas(n, w, sel)) el.innerHTML = phBody(el.getAttribute('data-role') || n, n, w, sel);
      else if (PH_NAMES && !PH_NAMES[n]) el.setAttribute('data-ic-none', '');
      else phWant(n, w, sel);
    }
  }
  function glyph(name, opts) {
    opts = opts || {};
    var role = String(name || ''), n = ICONS[role] || role, w = opts.w === 'f' || opts.w === 'd' ? opts.w : 'b';
    var sel = opts.sel != null ? !!opts.sel : !!HELD[role];
    if (!/^[a-z0-9-]+$/.test(n) || (PH_NAMES && !PH_NAMES[n] && !PH[n])) return '';
    var ok = phHas(n, w, sel);
    if (!ok) phWant(n, w, sel);
    return '<svg class="ow-ic' + (sel ? ' ow-ic--sel' : '') + (w === 'd' ? ' ow-ic--d' : '') + '" viewBox="0 0 256 256" aria-hidden="true"'
      + ' data-ic="' + n + '"' + (w !== 'b' ? ' data-w="' + w + '"' : '') + (role !== n ? ' data-role="' + role + '"' : '') + '>'
      + (ok ? phBody(role, n, w, sel) : '') + '</svg>';
  }
  function svg(name) { return glyph(name); }
  OW.icons = {
    v: '2.1.1',
    /* oneway-icons.js and the whole set's files call this: their drawings, and (once) every name in the set */
    add: function (set, names) {
      for (var n in set) { var I = PH[n] || (PH[n] = {}); for (var w in set[n]) I[w] = set[n][w]; }
      if (names) { PH_NAMES = {}; names.forEach(function (x) { PH_NAMES[x] = 1; }); }
      phFill();
    },
    tags: function (rows) { PH_TAGS = rows; },
    rows: function () { return PH_TAGS; },
    has: function (name) { var n = ICONS[name] || name; return !!(PH[n] || (PH_NAMES && PH_NAMES[n])); },
    ready: function (then) { phScript(PH_JS, then); },
    /* the whole set, for the picker: every name with its tags, then each weight a letter at a time */
    all: function (w, then) {
      phScript(PH_ALL + 'names.js?v=2.1.1', function () {
        var letters = {}; (PH_TAGS || []).forEach(function (r) { letters[r[0].charAt(0)] = 1; });
        var ls = Object.keys(letters), left = ls.length;
        if (!left) return then && then();
        ls.forEach(function (l) { phScript(PH_ALL + (w || 'b') + '-' + l + '.js?v=2.1.1', function () { if (--left === 0 && then) then(); }); });
      });
    },
    /* the picker is its own file, asked for the first time someone opens one */
    picker: function (host, o) {
      phScript(PH_PICK, function () { OW.iconPicker && OW.iconPicker(host, o); });
    }
  };
  /* what Oneway draws beyond the first screen arrives once the page is idle, before anyone asks for it */
  (function () {
    function soon() { (global.requestIdleCallback || function (f) { return global.setTimeout(f, 900); })(function () { phScript(PH_JS); }, { timeout: 3000 }); }
    if (doc.readyState === 'complete') soon(); else global.addEventListener('load', soon);
  })();
  /* ═══ THE ONEWAY GLOBE ═════════════════════════════════════════════════
     Founder (2026-08-02): loading and success animations unique to ONEWAY,
     a wireframe globe doing a neon flashing sequence — referencing the LED
     globes outside Harrah's and the way they FLICKER rather than fade.

     THAT DISTINCTION IS THE WHOLE DESIGN. A soft cross-fade reads as a web
     spinner; an LED reads as a chase — crisp attack, longer decay, bands
     lighting in sequence around the sphere, and every so often the whole
     thing hitting at once before the chase resumes. So the timing is stepped,
     not eased.

     NEON WITHOUT A FILTER. `filter: drop-shadow` is exactly what the mobile
     safe floor strips, and it is a per-frame compositor cost on top — so the
     glow is GEOMETRY: every line is drawn twice, a thick translucent halo
     under a thin bright core. It renders identically with the safe floor on
     or off, which is this file's one engineering law.

     ONLY OPACITY ANIMATES. No layout, no paint of new geometry, nothing the
     compositor cannot hand to the GPU — which is what keeps it at 120Hz while
     a feed is loading behind it.

     Geometry is real: parallels are the sphere's chords at each latitude,
     foreshortened; meridians are full-height ellipses narrowing toward the
     limb. It is a globe, not a circle with lines on it. */
  /* THE CAGE — built to how Vegas signs actually animate.
     Founder (2026-08-02): recreate the Harrah's globe; a left-to-right sweep
     does not work.

     IT DOES NOT WORK BECAUSE THAT IS NOT THE TECHNIQUE. Two things these signs
     actually do (Neon Museum, on vintage sign animation):

       · CHASING runs along the sign's BORDER — bulbs wired in sequence around
         the perimeter, "producing the impression of continuous movement".
         Around, never across.
       · FLASHING CIRCUITS light "sections of tubing in coordinated patterns",
         which is how they simulated "flowing water, SPINNING WHEELS, cascading
         letters". A spinning wheel on a static sign is groups firing in a
         repeating phase cycle — the wagon-wheel effect — not a smooth sweep.

     So: the rim carries a chase around its circumference, and the meridians
     fire in THREE COORDINATED PHASES rather than one by one. Three phases is
     what makes a wheel look like it is turning; a sequential sweep just looks
     like a sequential sweep, which is exactly what it looked like.

     Neon is still geometry — a wide dim halo beneath a thin bright core — so
     no filter, nothing the mobile safe floor strips, and it renders the same
     everywhere. */
  var GLOBE_PARALLELS = [
    [33.06,  9.92, 20.96, 0],
    [41.54, 12.46, 35.48, 0],
    [44.00, 13.20, 50.00, 1],   /* the equator — structure, drawn heaviest */
    [41.54, 12.46, 64.52, 0],
    [33.06,  9.92, 79.04, 0]
  ];
  /* THE MERIDIANS, AS HALF-ARCS — and this is the fix that made it turn.
     Founder: "it's still going in two directions."

     IT WAS, AND THE ELLIPSE WAS WHY. A meridian drawn as a full ellipse is
     SYMMETRIC: lighting it lights its left side and its right side at the same
     instant, so a widening sequence reads as light spreading outward BOTH ways
     from the axis. No timing fixes that — a symmetric shape cannot express a
     direction.

     What a meridian actually projects to is a HALF-ellipse: the arc from pole
     to pole passing through x = R·sin(L) at the equator, on the side sign(L).
     So the left limb, the narrowing left arcs, the axis, the widening right
     arcs and the right limb are FIFTEEN DISTINCT POSITIONS across the face,
     and lighting them in order is one unambiguous direction — light entering
     at one limb, crossing the face, leaving at the other. That is rotation,
     not a metaphor for it.

     Longitudes are evenly spaced, so the angular velocity is even and the
     travel does not slow in the middle. At rest a left arc and its right twin
     draw the same ellipse the cage always had — the picture is unchanged, only
     what can be lit independently. */
  var GLOBE_LONGITUDES = [-90,-77,-64,-51,-38,-26,-13, 0, 13, 26, 38, 51, 64, 77, 90];

  OW.globe = function (opts) {
    opts = opts || {};
    var n = doc.createElement('span');
    n.className = 'ow-globe';
    /* ★ FOUNDER/1353: a LOADING globe is plain - the mode's own ink, never the person's hue.
       "a normal plain loading state with the globe in the middle and like a grayed out like white
       plain loading state or a black plain loading state depending on light mode or dark mode."
       The hued globe stays the hued globe everywhere it is the mark rather than a wait. */
    if (opts.plain) n.setAttribute('data-plain', '1');
    if (opts.size) {
      n.style.setProperty('--g', opts.size + 'px');
      /* the cage needs room; below this it becomes a smudge (see the CSS) */
      if (opts.size < 34) n.setAttribute('data-small', '1');
    }
    n.setAttribute('data-state', opts.state || 'loading');
    if (opts.label) n.setAttribute('aria-label', opts.label);
    n.setAttribute('role', 'status');

    var i, cage = '', N = GLOBE_LONGITUDES.length;
    for (i = 0; i < GLOBE_PARALLELS.length; i++) {
      var L = GLOBE_PARALLELS[i];
      cage += '<ellipse class="ow-globe__par' + (L[3] ? ' ow-globe__eq' : '')
            + '" cx="50" cy="' + L[2]
            + '" rx="' + L[0] + '" ry="' + L[1] + '" style="--i:' + i + '"/>';
    }
    for (i = 0; i < N; i++) {
      var lon = GLOBE_LONGITUDES[i];
      var w = Math.round(44 * Math.abs(Math.sin(lon * Math.PI / 180)) * 100) / 100;
      /* --k is the arc's PLACE ACROSS THE FACE, left limb to right limb. The
         turn runs straight through it and wraps: the light leaves at the right
         limb and re-enters at the left, which is what going around the back
         looks like from here.

         A LARGER --k MEANS A LARGER NEGATIVE DELAY, so that arc PEAKED EARLIER
         — which is why the index is inverted. With k = i the light ran right to
         left; a globe is pictured turning the other way (surface features cross
         the face left to right, the way the Earth does from here). Measured on
         the rendered document, because the sign of a delay is not something to
         reason about twice. */
      var st = ' style="--k:' + (N - 1 - i) + '"';
      cage += (w < 0.01)
        /* edge-on at longitude 0: a straight line, because that is what it is */
        ? '<line class="ow-globe__mer ow-globe__ax" x1="50" y1="6" x2="50" y2="94"' + st + '/>'
        /* sweep flag picks the side — 1 bulges right, 0 bulges left */
        : '<path class="ow-globe__mer" d="M50 6A' + w + ' 44 0 0 '
          + (lon > 0 ? '1' : '0') + ' 50 94"' + st + '/>';
    }
    var rim = '<circle class="ow-globe__rim" cx="50" cy="50" r="44"/>';
    /* THE LAP — one bright arc that runs the rim ONCE, at success only. During
       loading it is invisible: a chase circling the border while the turn
       crosses the face is a SECOND motion, and two motions is exactly what
       "going in two directions" describes. One thing moves at a time. */
    var lap = '<circle class="ow-globe__lap" cx="50" cy="50" r="44"/>';
    /* THE SHOCKWAVE — rings the sphere throws off its limb on arrival. Drawn
       from the start and transparent until then: creating them at the instant
       of success would be a layout and a paint with the eye already on it. */
    var burst = '<circle class="ow-globe__burst" cx="50" cy="50" r="44"/>'
              + '<circle class="ow-globe__burst ow-globe__burst--2" cx="50" cy="50" r="44"/>';
    n.innerHTML =
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<g class="ow-globe__halo">' + rim + cage + '</g>' +
        '<g class="ow-globe__core">' + rim + cage + '</g>' +
        /* the hot head — white overshoot at the strike, above the tube it
           belongs to and below the arrival rings */
        '<g class="ow-globe__hot">' + cage + '</g>' +
        lap + burst +
      '</svg>';
    n.style.setProperty('--turn-n', String(N));
    return n;
  };

  /* THE SUCCESS BEAT — a cut-out, two teases, an accelerating build, and a
     payoff it holds. The choreography is in the CSS; what lives here is how
     long a caller waits for it.

     THE HOLD MUST OUTLAST THE ANIMATION, or the caller tears it down mid-beat.
     This waited 900ms against a 950ms animation, which was survivable while the
     finish was one strike and is not now. A caller passing its own `ms` still
     wins, and `OW.cross` does exactly that — see the note there for why
     navigating at the payoff is right and waiting for the settle is not. */
  OW.globeDone = function (node, ms) {
    if (!node) return Promise.resolve();
    node.setAttribute('data-state', 'done');
    return new Promise(function (res) { global.setTimeout(res, ms || 2080); });
  };

  /* ═══ THE CARD SKELETON — where cards load, the cards are grey and already there ═══════════════════════
     ★ FOUNDER/1302: "The post page, rather than having the globe loading bumper when you click on it, I want the individual
       postcards themselves to have a grayed out state, like loading, like how Instagram does ... When a user searches a page
       that has multiple cards posts loading at once rather than one globe bumper loading, it makes them feel like they're
       already scanning the page rather than waiting for something to come to them in the first place."

     ONE BUILDER, and it draws the card's own boxes (the same classes the real card wears: .po-card__who, __av, __n, __nm,
     __when, __body, __d, __media, __cover, __foot), so the stylesheet that sizes the real card in light, dark, Simple and Popit
     sizes this one: nothing here is a measured copy of a number. Only the fill is its own (grey, in the page's ink, never a hue).

     WHERE IT IS USED: a Post's page, Home's feed, a feed of the person's own, a profile's and a Center's posts, Discovery's grid and
     its search. The globe stays elsewhere (a sign-in, a payment, an upload; founder/471, 499). `loading(host, n, word, shape)` in
     popit-live.js is the one door: with a shape it draws these, without one the globe, as before.

     IT NEVER STANDS ALONE. A caller replaces it with the cards, or with its own honest state (OW.states.refused / nothing: S11);
     the skeleton carries no timer of its own that would let it outlast the answer, and `OW.skeleton.out` is how the caller says so. */
  OW.skeleton = (function () {
    /* THE GLOBE GOES BY INSIDE EACH GREY CARD (founder/1303: "The cards themselves should show the globe bumper going by before they load. We
       shouldn't phase out the globe for this"): the ONE mark, OW.globe, drawn once per size and put in the card as its shimmer. It crosses the
       card left to right, slow, one card a beat after the next; reduced motion leaves it still. No second drawing of it, no second kind of shimmer. */
    var passHTML = {};
    function pass(i, size) {
      if (!passHTML[size]) passHTML[size] = OW.globe({ size: size, plain: true }).outerHTML;   /* founder/1353: a wait is plain */
      /* an <i>, not a <span>: Simple lays the card's spans out in a grid (.po-river>.po-card>span), and a grid-placed box would take its column's area as its ground */
      return '<i class="ow-skel__pass" aria-hidden="true" style="--i:' + i + ';--pg:' + size + 'px">' + passHTML[size] + '</i>';
    }
    /* SKEL-CARD-BEGIN: tools/build_app.mjs draws the first screen's grey cards from these same lines, so the page holds them before this file has come */
    function t(cls, w, text) { return '<span class="' + cls + ' ow-skel__t" style="width:' + w + '">' + (text || 'Loading') + '</span>'; }
    function line(w) { return '<i class="ow-skel__l" style="width:' + w + '"></i>'; }
    function lines(ws) { return ws.map(line).join(''); }
    var WIDTHS = [['100%', '96%', '58%'], ['100%', '72%'], ['94%', '100%', '88%', '40%']];
    /* a feed card: who, the words, (a picture), the foot. `media` reserves the cover's box at the card's own 4:5 */
    function card(i, media) {
      var w = WIDTHS[i % WIDTHS.length];
      return '<div class="po-card po-card--skel"' + (media ? '' : ' data-text="1"') + ' aria-hidden="true">' +
        '<span class="po-card__face"></span>' +
        '<span class="po-card__who"><span class="po-card__av"></span>' +
          '<span class="po-card__n">' + t('po-card__nm', (84 + (i % 3) * 22) + 'px') + t('po-card__when', '44px') + '</span></span>' +
        (media ? '<span class="po-card__media"><span class="po-card__cover"></span></span>' : '') +
        '<span class="po-card__body"><span class="po-card__d">' + lines(w) + '</span></span>' +
        '<span class="po-card__foot"><span class="po-acts"><i class="ow-skel__a"></i><i class="ow-skel__a"></i><i class="ow-skel__a"></i></span></span>' +
        pass(i, 72) +
        '</div>';
    }
    /* SKEL-CARD-END */
    /* a Post's own page: the who row, the words, the picture and the acts of .ow-post */
    function post() {
      return '<div class="ow-skel__post" aria-hidden="true">' +
        '<div class="ow-post__who"><span class="ow-skel__f"></span><div class="ow-post__nm">' +
          t('ow-skel__nm', '120px') + t('ow-skel__wh', '64px') + '</div></div>' +
        '<div class="ow-skel__pbody">' + lines(['100%', '94%', '100%', '62%']) + '</div>' +
        '<div class="ow-skel__pic"></div>' +
        '<div class="ow-skel__acts"><i class="ow-skel__a"></i><i class="ow-skel__a"></i><i class="ow-skel__a"></i></div>' +
        pass(0, 96) +
        '</div>';
    }
    /* Discovery's three-column grid of tiles, the sheet's own ow-ds__grid and ow-ds__tile */
    function tiles(n) {
      var h = '';
      for (var i = 0; i < n; i++) h += '<div class="ow-ds__tile ow-skel__tile' + (i === 1 ? ' is-tall' : '') + '"></div>';
      return h;
    }
    var SHAPES = {
      card: function (n) { var h = ''; for (var i = 0; i < n; i++) h += card(i, i % 2 === 0); return '<div class="po-river">' + h + '</div>'; },
      post: function () { return post(); },
      tiles: function (n) { return '<div class="ow-ds__grid">' + tiles(n) + '</div>' + pass(1, 56); },
      /* the search's rows (Discovery's list of hits): a face and two lines, the sheet's own .ow-ds__hit */
      hits: function (n) {
        var h = '';
        for (var i = 0; i < n; i++) h += '<div class="po-act ow-ds__hit ow-skel__hit" aria-hidden="true"><span class="ow-ds__face"></span><span class="ow-ds__rt">' +
          '<b class="ow-skel__t" style="width:' + (120 + (i % 3) * 36) + 'px">Loading</b><span class="ow-skel__t" style="width:' + (80 + (i % 2) * 40) + 'px">Loading</span></span></div>';
        return h + pass(0, 48);
      },
      /* DISCOVERY'S FIRST FRAME (v52/discovery-loading; founder/1302, 1303: the screen is there at the press, grey, with the globe going by).
         The ground is the map's own earth colour; the search, the two round controls and the sheet's bar stand in the boxes sheet.js gives
         them (one geometry: SHEET below, which sheet.js reads too), so the real map arrives under it and nothing moves. */
      discover: function () { return discoverHTML(); },
      /* what the sheet's body holds before its first read has answered (a docked sheet shows it at once): a short list and the grid */
      sheet: function () {
        /* its own boxes (ow-skel__*), not the sheet's: this is drawn at the press, before sheet.js and its stylesheet have come */
        var h = '', i;
        for (i = 0; i < 3; i++) h += '<div class="ow-skel__row"><i class="ow-skel__face"></i><span class="ow-skel__rt">' +
          '<b class="ow-skel__t" style="width:' + (120 + (i % 3) * 36) + 'px">Loading</b><span class="ow-skel__t" style="width:' + (80 + (i % 2) * 40) + 'px">Loading</span></span></div>';
        var g = '';
        for (i = 0; i < 6; i++) g += '<i class="ow-skel__cell' + (i === 1 ? ' is-tall' : '') + '"></i>';
        return '<div class="ow-skel__sh">' + t('ow-skel__shh', '96px') + '</div>' + h + '<div class="ow-skel__sh">' + t('ow-skel__shh', '84px') + '</div><div class="ow-skel__grid">' + g + '</div>' + pass(2, 56);
      }
    };
    /* ONE GEOMETRY FOR THE SHEET AND ITS SKELETON: the widths at which the sheet docks, read by sheet.js too, so a change here moves both */
    var SHEET = { WIDE: 900, TAB: 700, SHORT: 500, SHORT_WIDE: 640, DOCK_W: 440, TITLE: 'Explore' };
    function discoverHTML() {
      var glass = OW.glyph ? OW.glyph('magnifying-glass') : '';
      var glassHTML = typeof glass === 'string' ? glass : (glass && glass.outerHTML) || '';
      return '<i class="ow-skel__ground" aria-hidden="true"></i>' +
        '<span class="ow-skel__find" aria-hidden="true">' + glassHTML + '<span class="ow-skel__ph">Search</span></span>' +
        '<i class="ow-skel__ctl ow-skel__you" aria-hidden="true"></i><i class="ow-skel__ctl ow-skel__add" aria-hidden="true"></i>' +
        '<div class="ow-skel__sheet" aria-hidden="true"><div class="ow-skel__bar"><i class="ow-skel__grab"></i>' +
          '<div class="ow-skel__hd"><span class="ow-skel__title">' + SHEET.TITLE + '</span>' + t('ow-skel__where', '96px') + '</div>' + pass(0, 48) + '</div>' +
          '<div class="ow-skel__body">' + SHAPES.sheet() + '</div></div>';
    }
    /* the boxes the real sheet is placed in, from the same measures (sheet.js fit(): the header's foot, the dock's top, a rail on the left),
       set on the skeleton as the vars its CSS reads, so a wide screen, a tablet and a phone each draw it where the sheet will stand */
    function geometry(wrap) {
      var vw = global.innerWidth || 390, vh = global.innerHeight || 800;
      var top = doc.querySelector('.ow-top'), nav = doc.querySelector('.ow-nav');
      var tr = top ? top.getBoundingClientRect() : null, nr = nav ? nav.getBoundingClientRect() : null;
      if (nr && !nr.width) nr = null;
      var rail = !!nr && nr.height > nr.width;
      var wide = vw >= SHEET.WIDE || (vh < SHEET.SHORT && vw >= SHEET.SHORT_WIDE), tab = !wide && vw >= SHEET.TAB;
      var foot = nr && !rail ? Math.max(0, Math.round(vh - nr.top)) : 0;
      wrap.style.setProperty('--ds-top', Math.max(12, Math.round((tr && tr.width > 0 ? tr.bottom : 0) + 6)) + 'px');
      if (rail && nr.left < 200) wrap.style.setProperty('--ds-left', Math.max(12, Math.round(nr.right + 12)) + 'px');
      wrap.style.setProperty('--ds-bot', (foot + 12) + 'px');
      wrap.style.setProperty('--ds-foot', foot + 'px');
      if (wide || tab) wrap.style.setProperty('--ds-w', Math.min(SHEET.DOCK_W, Math.round(vw * 0.52)) + 'px');
      wrap.classList.toggle('is-wide', wide); wrap.classList.toggle('is-tab', tab); wrap.classList.toggle('is-short', wide && vh < SHEET.SHORT);
    }
    var COUNT = { card: 3, post: 1, tiles: 9, hits: 3, discover: 1, sheet: 1 };
    /* into(host, shape, n): the skeleton in the host at once, no globe. Returns the node; `aria-busy` tells a reader of the page it is coming. */
    function into(host, shape, n, word) {
      var make = SHAPES[shape] || SHAPES.card;
      var wrap = doc.createElement('div');
      wrap.className = 'ow-skel ow-skel--' + (SHAPES[shape] ? shape : 'card');
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-busy', 'true');
      wrap.setAttribute('aria-label', word || 'Loading');
      wrap.innerHTML = make(n || COUNT[shape] || 3);
      host.appendChild(wrap);
      if (shape === 'discover') geometry(wrap);
      return wrap;
    }
    /* done(host): the first frame of a screen that is one whole picture (Discovery's) leaves when the real one stands under it: it fades over
       the screen's leave beat and is taken away, never cut. Reduced motion takes it at once. */
    function done(host) {
      var s = host && host.querySelectorAll ? host.querySelectorAll('.ow-skel--discover') : [];
      for (var i = 0; i < s.length; i++) (function (el) {
        if (el.__owGoing) return; el.__owGoing = true;
        var ms = OW.motion ? OW.motion.ms('leave') : 0;
        var gone = function () { if (el.parentNode) el.parentNode.removeChild(el); };
        if (ms <= 1) { gone(); return; }
        el.setAttribute('aria-busy', 'false'); el.classList.add('is-done');
        global.setTimeout(gone, ms + 60);
      })(s[i]);
    }
    /* out(host): taken away the moment the caller has its answer (cards, an honest empty, or a refusal), so none outlasts it */
    function out(host) {
      var s = host && host.querySelectorAll ? host.querySelectorAll('.ow-skel') : [];
      for (var i = 0; i < s.length; i++) if (s[i].parentNode) s[i].parentNode.removeChild(s[i]);
    }
    return { into: into, out: out, done: done, sheet: SHEET };
  })();

  /* ═══ THE MARK WEARS THE SAME LIGHT AS THE WORLD ═══════════════════════
     Founder (2026-08-02): the app and web icon should correspond to the
     user's — or the viewed Center's — hue.

     The tab icon follows the identity the surface stands in: entering a Center
     re-colours the world AND the tab, and a person's own hue follows them
     across every surface. Since founder/829 the tab is the transparent globe
     as a file, pre-drawn in every hue (assets/icons/globe/), named by the
     page's head and kept in step by oneway-hue.js; this tells it the context.
     The home-screen PNGs stay as drawn on purpose: an installed icon is baked
     at install time and a phone will not repaint it. */
  var lastIcon = '';

  /* Repaint the tab icon in the current surface hue. Cheap and idempotent —
     it does nothing when the hue has not actually changed, so it can be called
     from every hue transition without thinking about it. */
  /* ★ FOUNDER/471 §12: *"our icon on all platofrms should be the loading
     globe having a vibrant blue icon. changing to users hue obivously no
     matter the view, loading browser etc. default on platofrtm can staty as
     purple."* The WORLD's default stays purple; the ICON's default is the
     vibrant blue every store, tab and home screen shows (tools/make_icon.py
     BLUE). So: a person's chosen hue paints the icon; the platform's own
     purple — nobody's hue — paints it blue. */
  var PLATFORM_HUE = '124,45,255', ICON_BLUE = '31,143,255';

  /* NO HUE BAR AT THE TOP (founder/1176, 2026-11-02: "i do not like the hue bar at the top"). The browser's chrome took the
     person's hue here (theme-color = the hue), so Safari painted a band of it over the top of every page. It takes the
     room's own ground now, the colour the App's theme writer gives it (oneway-app.html: light #eceaf3, dark #000000), so
     the top of the browser reads as the page. The hue stays on the icon and the tab.
     THE ROOM IN FORCE, AND LIVE (the founder, 2026-11-09: "It should sync to device automatically"). A page that leaves the
     room to the device (no data-theme: sign-in, reset) was given the dark bar in a light room, because only data-theme was
     read; and a device that switched kept the bar it had, because this ran only when the hue changed. The room in force is
     the person's choice, else the device's, and the bar follows either the moment it changes. */
  var lightQ = null;
  try { lightQ = global.matchMedia ? global.matchMedia('(prefers-color-scheme: light)') : null; } catch (_) {}
  function paintChrome() {
    if (!doc || !doc.head) return;
    var t = root.getAttribute('data-theme');
    var light = t === 'light' || (t !== 'dark' && !!(lightQ && lightQ.matches));
    var tc = doc.querySelector('meta[name="theme-color"]');
    if (!tc) { tc = doc.createElement('meta'); tc.name = 'theme-color';
               doc.head.appendChild(tc); }
    tc.removeAttribute('media');
    tc.setAttribute('content', light ? (tc.getAttribute('data-light') || '#eceaf3') : (tc.getAttribute('data-dark') || '#000000'));
  }
  OW.paintChrome = paintChrome;
  try {
    if (lightQ) { if (lightQ.addEventListener) lightQ.addEventListener('change', paintChrome); else if (lightQ.addListener) lightQ.addListener(paintChrome); }
    if (global.MutationObserver && root) new global.MutationObserver(paintChrome).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    paintChrome();
  } catch (_) {}

  OW.paintIcon = function () {
    if (!doc || !doc.head) return;
    paintChrome();
    var rgb = getComputedStyle(root).getPropertyValue('--ow-h1').trim();
    if (!rgb || rgb === lastIcon) return;
    lastIcon = rgb;
    var icon = rgb.replace(/\s+/g, '') === PLATFORM_HUE ? ICON_BLUE : rgb;
    /* THE TAB HAS ONE WRITER (founder/829, 2026-10-17: "the icon isnt even right on safari wtf"). This drew its own SVG
       globe (an older cage) into a second icon link and removed every other, while oneway-hue.js drew the transparent
       globe into its own: two writers of one tab, and whichever ran last won. The tab is now the transparent globe the
       head names as a file in the page's hue (tools/site_seo.py TAB_GLOBE_JS), kept in step by oneway-hue.js; what
       this adds is the identity the surface stands in: a Center's or another person's light while the App wears it,
       and null when it is back in the viewer's own (the rule then gives the person's hue, or the page's). */
    try {
      if (global.owTabHue && global.owTabHue.context) global.owTabHue.context(inContext ? hue.angleOf(rgb) : null);
    } catch (_) {}

    /* THE INSTALLED ICON, which the tab trick cannot reach. A home-screen icon
       is fetched ONCE, at install, and the OS owns the bitmap after that — no
       script repaints it. So the only moment its colour can be decided is the
       moment the platform reads these two links, and they now name the viewer's
       own hue. Same mark, same generator, rendered server-side in their colour.

       Pointed at the API rather than a local file because that is where the
       renderer lives; OW.assetBase is already the one place that resolves. */
    var tag = icon.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '');
    if (/^\d+-\d+-\d+$/.test(tag)) {
      var base = (OW.assetBase || '');
      setLink('apple-touch-icon', base + '/assets/icon/' + tag + '/180.png?plate=1');
      setLink('manifest', base + '/assets/icon/' + tag + '/manifest.webmanifest');
    }
  };

  /* one <link rel=X> per rel, replaced in place — a second manifest link is
     ignored by every platform, silently, which is the worst way to be wrong */
  function setLink(rel, href) {
    var l = doc.querySelector('link[rel="' + rel + '"]');
    if (!l) { l = doc.createElement('link'); l.rel = rel; doc.head.appendChild(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
  }

  /* ═══ THE SKY: the hue wash under every surface (.ow-sky, .ow-worldwash; oneway-popit.css). The washes need no script, so a phone, a reduced-motion
     reader and the first paint all get a real background. Opted out with {sky:false} by a page that paints its own world. */
  OW.sky = function (opts) {
    opts = opts || {};
    if (doc.querySelector('.ow-sky')) return;
    var host = doc.body || doc.documentElement;

    var sky = doc.createElement('div');
    sky.className = 'ow-sky'; sky.setAttribute('aria-hidden', 'true');
    host.appendChild(sky);

    var wash = doc.createElement('div');
    wash.className = 'ow-worldwash'; wash.setAttribute('aria-hidden', 'true');
    host.appendChild(wash);

    /* NO NET (S39, founder/1309: "Arrows not dots"): the live canvas of points joined by lines is gone at every tier. The hue wash is the sky. */
  };

  /* ═══ WHAT ACTUALLY WENT WRONG ═════════════════════════════════════════
     Founder (2026-08-03): "tell people the reason why it's not working… let
     people know if ONEWAY is the issue or if their connection is the issue. I
     hate platforms that are just like, something is probably wrong on our end.
     ONEWAY should be able to tell the user what's going on."

     THIS IS DETERMINABLE, WHICH IS WHY SHRUGGING IS INEXCUSABLE. A failed
     request is ambiguous on its own, but three cheap probes resolve it:

       · the browser says it is offline            → their connection, certainly
       · this page's OWN ORIGIN answers            → their connection is alive
       · the API answers /api/health               → ONEWAY is alive

     Cross those and every case has a true name:

       offline                    → "You are offline."
       origin ok, API silent      → "ONEWAY is not responding." (ours, and we say so)
       origin silent, API silent  → "Your connection dropped."  (theirs, and we say so)
       both ok, request failed    → the request itself failed; say which one

     NO GUESSING, AND NO FALSE MODESTY EITHER. "This might be on our end" is
     worse than useless: it is the platform admitting it did not look. If we
     cannot tell, the honest answer is "we could not determine this", which has
     never once been the right answer here because the probes always resolve.

     It is CHEAP: two HEAD requests with a short timeout, run only when
     something has already failed. It never runs on the happy path. */
  /* ═══ THE FAULT TABLE — every way this platform can fail to do a thing ═════
     Founder (2026-08-03): "You cannot just include a few basic error messages.
     It needs to have things for every single thing. We need to be building for
     the future, not just to pass the next reality check."

     SO THIS IS A TABLE, NOT A CHAIN OF `if`s. Every failure the runtime can
     produce has a canonical code and one place that says what it means, who it
     belongs to, and what the person can do next. Adding a failure kind is a ROW
     — the platform's own law that capability should arrive as registration
     rather than implementation, applied to the one surface area that always
     grows fastest and is always written last.

     FOUR FIELDS PER ROW, AND THEY EARN THEIR PLACE:
       who     'you' | 'oneway' | 'network' | 'unreachable' | 'permission' |
               'request' — a surface decides what to OFFER from this, not just
               what to print. A retry button on a 403 is an insult.
       title   the fact, in the fewest words that are still true
       detail  the one thing worth knowing beyond the title. Never our reasoning.
       do      what THEY can do, or null when the honest answer is nothing.

     WHAT IT REPLACES: three separate vocabularies — failWord() in the live
     layer ('not yours to see'), refused() beside it, and a pile of literal
     strings on login.html. Three places to be inconsistent, and they were.

     NOTHING HERE SAYS "SOMETHING WENT WRONG". If a row cannot say what
     happened, the row is wrong and should be split until it can. */
  var FAULTS = {
    /* ── the network, before anything of ours is reached ─────────────── */
    offline:        { who:'you', title:"You're offline",
                      detail:'Reconnect and this will go straight through.', do:'retry' },
    unreachable:    { who:'unreachable', title:"Couldn't reach Oneway",
                      detail:'Nothing answered.', do:'retry' },
    blocked:        { who:'network', title:'Something is blocking Oneway',
                      detail:'Requests are being dropped rather than refused — usually '
                           + 'a firewall, VPN or guest network.', do:'retry' },
    cors:           { who:'oneway', title:'Oneway is refusing this browser',
                      detail:'The service is up but will not accept requests from this '
                           + 'page. A configuration fault on our side.', do:null },
    timeout:        { who:'network', title:'That took too long',
                      detail:'Oneway did not answer in time. It may still be working.',
                      do:'retry' },

    /* ── ours, and named as ours ──────────────────────────────────────── */
    server_error:   { who:'oneway', title:'Oneway hit an error',
                      detail:'The service answered and reported a fault. Ours, not yours.',
                      do:'retry' },
    bad_gateway:    { who:'oneway', title:'Oneway is between restarts',
                      detail:'A part of the service is not answering yet.', do:'retry' },
    unavailable:    { who:'oneway', title:'Oneway is down for a moment',
                      detail:'The service is deliberately not accepting work right now.',
                      do:'retry' },
    gateway_timeout:{ who:'oneway', title:'Oneway took too long on its own side',
                      detail:'The request reached us and we did not finish in time.',
                      do:'retry' },

    /* ── permission and identity — never offer a retry ───────────────── */
    signed_out:     { who:'permission', title:"You're not signed in",
                      detail:'This belongs to a person, so it needs to know who you are.',
                      do:'sign_in' },
    expired:        { who:'permission', title:'Your session ended',
                      detail:'Sign in again and you will come straight back here.',
                      do:'sign_in' },
    forbidden:      { who:'permission', title:'Not yours to open',
                      detail:'Your account does not have access to this.', do:null },
    needs_plan:     { who:'permission', title:'This needs a different plan',
                      detail:'The Center this belongs to is not on a plan that includes it.',
                      do:'plans' },
    needs_role:     { who:'permission', title:'Your role does not cover this',
                      detail:'Someone who operates this Center can grant it.', do:null },

    /* ── the request itself ───────────────────────────────────────────── */
    not_found:      { who:'request', title:'Nothing here by that name',
                      detail:'It may have been removed, or the link may be wrong.', do:null },
    gone:           { who:'request', title:'This was deleted',
                      detail:'It existed once and does not any more.', do:null },
    conflict:       { who:'request', title:'That already happened',
                      detail:'Someone — possibly you, on another device — already did this.',
                      do:'refresh' },
    invalid:        { who:'request', title:'Something in that was not valid',
                      detail:'Check the highlighted fields and try again.', do:null },
    too_large:      { who:'request', title:'That file is too big',
                      detail:'Try a smaller one.', do:null },
    unsupported:    { who:'request', title:'That kind of file is not supported',
                      detail:'Images and video only.', do:null },
    rate_limited:   { who:'you', title:'Too many attempts',
                      detail:'Wait a moment and try again.', do:'wait' },
    request_failed: { who:'request', title:"That request didn't go through",
                      detail:'Both ends are fine. Try it again.', do:'retry' }
  };

  /* HTTP is a coarse instrument, so the mapping is stated once rather than
     re-guessed at every call site. A body that names a more specific reason
     (`fault` or `code`) always wins over the status — the runtime knows more
     about its own refusal than a number does. */
  var BY_STATUS = {
    400:'invalid', 401:'signed_out', 402:'needs_plan', 403:'forbidden',
    404:'not_found', 405:'invalid', 408:'timeout', 409:'conflict', 410:'gone',
    413:'too_large', 415:'unsupported', 422:'invalid', 429:'rate_limited',
    500:'server_error', 502:'bad_gateway', 503:'unavailable', 504:'gateway_timeout'
  };

  OW.faults = FAULTS;

  /* Resolve a fault SYNCHRONOUSLY from whatever the data layer produced. Always
     returns a usable row — an unknown status resolves to a real named fault
     rather than to a shrug. */
  OW.fault = function (r, opts) {
    r = r || {}; opts = opts || {};
    var named = r.fault || r.code || (r.data && (r.data.fault || r.data.code));
    var key = (named && FAULTS[named]) ? named : null;
    if (!key && r.status) key = BY_STATUS[r.status]
      || (r.status >= 500 ? 'server_error' : 'request_failed');
    if (!key && (global.navigator && global.navigator.onLine === false)) key = 'offline';
    if (!key) key = 'unreachable';
    var row = FAULTS[key];
    return { code:key, who:row.who, title:row.title,
             /* a server that explains itself is more specific than our row —
                but only when it is a real sentence, never a stack trace */
             detail:(typeof r.error === 'string' && r.error.length > 3 && r.error.length < 200
                     && !/^[A-Za-z]*Error:/.test(r.error)) ? r.error : row.detail,
             do:row.do, retry:row.do === 'retry' };
  };

  /* The same answer, SHARPENED by actually probing the network — only worth it
     when nothing came back at all, because that is the one case a status code
     cannot describe. Everything else is already precise. */
  OW.faultDeep = function (r, opts) {
    var flat = OW.fault(r, opts);
    if (r && r.status) return Promise.resolve(flat);
    return OW.diagnose(opts || {}).then(function (d) {
      return { code:d.who === 'you' ? 'offline' : 'unreachable',
               who:d.who, title:d.title, detail:d.detail, do:'retry', retry:true };
    }).catch(function () { return flat; });
  };

  /* ═══ WHAT WENT WRONG — determined, not guessed ════════════════════════
     Founder (2026-08-03): tell people whether it is ONEWAY or their connection,
     and "add the technology to where it could tell what's going on."

     THE TECHNIQUE. A browser reports every network failure as one opaque
     TypeError, which is why most products give up here and write "something
     went wrong". But two probes and a stopwatch separate every real case:

       no-cors probe   does ANYTHING answer at that address? (no-cors resolves
                       even when the response is unreadable, so it tests the
                       CONNECTION rather than the permission)
       cors probe      may this page read it?
       elapsed time    a refused connection dies in milliseconds; a packet being
                       silently dropped takes the full timeout

     Cross them:

       no-cors ok  + cors ok            → both ends fine; the request itself failed
       no-cors ok  + cors fails         → the service is UP and refusing this
                                          origin. That is a CORS/config fault and
                                          it is ours, precisely.
       no-cors fails FAST               → no connection was established. Could be
                                          the service, the address, DNS, or the
                                          browser refusing to send it at all.
                                          Name the address; do not name a culprit.
       no-cors fails SLOW (timeout)     → something is swallowing the packets:
                                          a firewall, a VPN, a captive portal
       5xx                              → it answered and said it is unwell

     Every branch is a fact we measured. Nothing says "this might be on our end".

     THE WORDS ARE SHORT ON PURPOSE. A person meeting an error wants to know who
     broke it and what to do, in one line. Explaining our reasoning to them is
     us talking about ourselves. */
  function _probe(url, ms, cors) {
    var t0 = (global.performance && performance.now) ? performance.now() : Date.now();
    return new Promise(function (res) {
      var done = false;
      function end(v) {
        if (done) return; done = true; clearTimeout(timer);
        var t1 = (global.performance && performance.now) ? performance.now() : Date.now();
        res({ v: v, ms: Math.round(t1 - t0) });
      }
      var timer = global.setTimeout(function () { end('timeout'); }, ms || 3500);
      try {
        global.fetch(url, { method: 'GET', cache: 'no-store',
                            mode: cors ? 'cors' : 'no-cors' })
          .then(function (r) { end(r && r.status >= 500 ? 'unwell' : 'ok'); })
          .catch(function () { end('fail'); });
      } catch (_) { end('fail'); }
    });
  }

  /* {who, title, detail, retry} — `who` is 'you' | 'oneway' | 'network' |
     'request', so a surface can decide what to offer, not only what to say. */
  OW.diagnose = function (opts) {
    opts = opts || {};
    var api = (opts.api != null ? opts.api : (OW.assetBase || '')) || '';
    var where = '';
    try { where = api ? new global.URL(api, global.location.href).host : global.location.host; }
    catch (_) { where = api || 'Oneway'; }

    if (global.navigator && global.navigator.onLine === false) {
      return Promise.resolve({ who: 'you', title: "You're offline",
        detail: 'Reconnect and this will go straight through.', retry: true });
    }
  /* ── WHICH DOOR PROVES ONEWAY IS ALIVE ───────────────────────────────────
     This probed `/api/health`, which is served by the LEGACY application. So
     the one question this whole diagnosis exists to answer — "is ONEWAY alive
     or is it you?" — was being answered by the half of the platform being
     retired.

     It is also the WRONG answer on the merits. `api/gateway.py` imports the
     replacement app EAGERLY and the legacy app LAZILY, so a replacement that
     fails to boot takes every request down with it — measured 2026-09-03: with
     `oneway.app` made to raise on import, a request to a purely legacy route
     never arrives at all. A green legacy health check therefore could not have
     meant "ONEWAY is alive"; the replacement is the load-bearing half and it is
     the one worth asking about.

     `/api/oneway/health` answers from the replacement and names what it serves.
     Same probe, same three-way verdict, now pointed at the half that decides. */
    return _probe(api + '/api/oneway/health?_=' + Date.now(), 4000, false).then(function (reach) {
      if (reach.v === 'ok' || reach.v === 'unwell') {
        return _probe(api + '/api/oneway/health?_=' + Date.now(), 4000, true).then(function (read) {
          if (read.v === 'unwell') return { who: 'oneway', title: 'Oneway hit an error',
            detail: 'The service answered and reported a fault. Ours, not yours.', retry: true };
          if (read.v === 'ok') return { who: 'request', title: "That request didn't go through",
            detail: 'Both ends are fine. Try it again.', retry: true };
          return { who: 'oneway', title: 'Oneway is refusing this browser',
            detail: 'The service is up at ' + where + ' but will not accept requests '
                  + 'from this page. A configuration fault on our side.', retry: false };
        });
      }
      if (reach.v === 'timeout') return { who: 'network', title: 'Something is blocking Oneway',
        detail: 'Requests to ' + where + ' are being dropped rather than refused — '
              + 'usually a firewall, VPN or guest network.', retry: true };
      /* A FAST FAILURE MEANS NO CONNECTION WAS ESTABLISHED — and that is ALL it
         means. I first wrote this as "nothing is running there", which asserts
         something about a server we never reached: the same failure covers a
         service that is down, a wrong host or port, a DNS miss, and a request
         the browser refused to send at all (an extension, a policy, a blocked
         mixed-content call). Proved by running it against a LIVE API and being
         told nothing was running on it.

         So it reports the observation and names the address — which is the part
         that makes it actionable — and stops short of the diagnosis it cannot
         support. `who` is 'unreachable' rather than 'oneway' for the same
         reason: no surface should route this to "our fault" on this evidence. */
      return { who: 'unreachable', title: "Couldn't reach Oneway",
        detail: 'Nothing answered at ' + where + '.', retry: true };
    }).catch(function () {
      return { who: 'request', title: "That didn't go through",
               detail: 'Try it again.', retry: true };
    });
  };

  /* ═══ THE CROSSING — leaving one surface for another, without leaving the world
     Founder (2026-08-03): sign-in should transition seamlessly into the App or
     the OS depending on which the person actually uses.

     NOTHING HERE IS A NEW IDEA — it is the landing's own motion, generalised.
     `html.ow-in-center` already does exactly this when you step into a Center:
     the page's content dissolves (opacity + a 2px blur over .55s) while the
     FIXED WORLD LAYERS ARE DELIBERATELY UNTOUCHED, so what is left on screen is
     the world and the thing you are entering. Canon §5 states the values; they
     are reused verbatim rather than re-chosen, because two dissolves at two
     durations is two dissolves.

     WHY IT READS AS SEAMLESS ACROSS A REAL PAGE LOAD: the constellation, the
     wash and the hue are mounted identically by OW.boot on both sides. The
     surface dissolves, the mark does its arrival beat, the document changes —
     and the world behind it never blinked, because it is the same world drawn
     from the same seed in the same hue. There is no SPA router here and there
     does not need to be one.

     WHERE IT GOES IS NOT THIS FUNCTION'S BUSINESS. The caller has already
     resolved the destination (login.html asks the runtime whether this person
     operates anything). A crossing that also decided where to go would be a
     second router beside the one that exists. */
  OW.crossing = function (url, opts) {
    opts = opts || {};
    if (!url) return Promise.resolve();

    /* THE WORLD TAKES THEIR LIGHT ON THE WAY IN (founder, 2026-08-03: the
       transition goes "to the user's HUE").

       This is the moment the platform stops being generic and becomes theirs —
       the constellation, the wash, the tab icon and the installed-icon links all
       recolour from the platform default to the colour they chose, while the
       surface they were signing in on dissolves. Then the destination boots and
       binds the SAME hue, so nothing changes across the page load and the two
       halves read as one continuous move into their own world.

       It goes through hue.bind rather than a tween, deliberately: bind persists
       the pair, so the destination is already their colour on its FIRST PAINT
       instead of flashing purple and correcting itself once the profile read
       comes back. Everything downstream — icon, theme colour, manifest — is
       hooked to that one call and follows without being told. */
    if (opts.hue) hue.bind({ pair: opts.hue, angle: opts.hueAngle });
    else if (opts.hueAngle != null) hue.bind({ angle: opts.hueAngle });
    var RM = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* someone who asked for stillness gets the destination, not a light show */
    if (RM) { global.location.href = url; return Promise.resolve(); }

    /* the mark rides ABOVE the dissolving page and inside the world, so it is
       the one thing that does not fade — you are following it across */
    /* THE DISSOLVE IS APPLIED EXPLICITLY, NOT BY SELECTOR.
       A rule of the form `html.ow-crossing-on body > *:not(...)` reads well and
       failed twice here for reasons that cost more to diagnose than the
       behaviour is worth — the page stayed lit and the stage came out at zero.
       Walking body's own children and setting the two properties is
       deterministic, inspectable in the DOM, and cannot be out-specified by
       anything else on the page. The world layers and the stage are excluded by
       name, which is also the honest way to say what is happening. */
    var KEEP = /(^|\s)(ow-sky|ow-worldwash|ow-crossing)(\s|$)/;
    var safeFloor = root.getAttribute('data-fx') === 'safe';
    [].forEach.call((doc.body || {}).children || [], function (el) {
      if (KEEP.test(el.className || '')) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      el.style.transition = 'opacity .55s cubic-bezier(.4,0,.2,1)'
        + (safeFloor ? '' : ', filter .55s cubic-bezier(.4,0,.2,1)');
      el.style.pointerEvents = 'none';
      /* A FORCED REFLOW, NOT A FRAME. The transition needs a start value to run
         from, and the usual way to get one is to wait a rAF — but rAF is a
         REQUEST, and an environment that throttles or parks it (a background
         tab, a low-power device, an embedded view) simply never calls back. The
         dissolve would then never be applied at all and the crossing would jump.
         Reading a layout property flushes style synchronously and cannot be
         skipped, so the animation is a nicety while the state change is not. */
      /* jshint expr:true */ el.offsetHeight;
      el.style.opacity = '0';
      if (!safeFloor) el.style.filter = 'blur(2px)';
    });

    var stage = doc.createElement('div');
    stage.className = 'ow-crossing';
    stage.style.opacity = '0';       /* faded in below, by transition */
    /* ── THE ROTATION IS THE DEFAULT; THE FLASH IS EARNED ────────────────
       ★ FOUNDER, 2026-08-30: *"the loading should be the default when
         switching between pages should only show if like a payment or login
         is processing"*, then, correcting my first reading of it: *"a page
         switch should not show the flashing completed globe animation but
         rather the clean rotating"*.

       So the two states divide like this:

         default          the clean ROTATION. Every page switch. The mark
                          turns while the next surface comes up and that is
                          all — nothing claims to have finished, because
                          nothing was being done.
         working: true    rotates while a real request is in flight, and THEN
                          plays the completed flash. A login or a payment has
                          an answer to arrive; the flash is what says it did.

       I built this the other way round first — mounting a page switch in the
       completed state — which put a "done" beat on transitions where nothing
       had been done. The flash is a statement about work finishing and must
       not be spent on a navigation. */
    var g = OW.globe({ size: opts.size || 116,
                       label: opts.label || (opts.working ? 'One moment' : 'Oneway') });
    stage.appendChild(g);
    if (opts.word) {
      var w = doc.createElement('span');
      w.className = 'ow-loading__w'; w.textContent = opts.word;
      stage.appendChild(w);
    }
    (doc.body || doc.documentElement).appendChild(stage);
    /* same forced flush, same reason — it must arrive whether or not a frame
       ever runs, and it must end up VISIBLE if the transition is skipped */
    /* jshint expr:true */ stage.offsetHeight;
    stage.style.opacity = '1';

    root.classList.add('ow-crossing-on');
    /* let the dissolve get under way, then strike — the arrival beat lands as
       the surface finishes leaving, which is what makes it one movement rather
       than two animations played back to back */
    /* ── HOW LONG THE MOMENT LASTS IS THE CALLER'S TO SAY ──────────────────
       ★ FOUNDER, 2026-08-30: *"to fast should feel like an event."*

       Both numbers were fixed here, so every crossing in the product was the
       same length — and they are not the same event. Signing in again is
       routine and 320+1260 is right for it; JOINING happens once, and at the
       same speed it reads as a page load rather than as arriving somewhere.

       `dwell` is how long the surface gets to dissolve before the mark strikes;
       `ms` is how long the arrival beat holds. The defaults are exactly what
       every existing caller already got, so nothing changes for them. */
    var dwell = (opts.dwell != null) ? opts.dwell : 320;
    return new Promise(function (res) {
      global.setTimeout(function () {
        /* A PAGE SWITCH LEAVES ON THE ROTATION. Only work that processed gets
           the completed flash — see the state note above. */
        if (!opts.working) { global.location.href = url; res(); return; }
        OW.globeDone(g, opts.ms).then(function () {
          global.location.href = url;
          res();
        });
      }, dwell);
    });
  };

  /* kept as a no-op so any surface that learned to call it does not break —
     the hold it used to release is gone (see the CSS for why) */
  OW.arrive = function () { root.classList.remove('ow-arriving'); };


  /* ═══ A POST'S INTERACTIONS, ON EVERY SURFACE ═════════════════════════════
     ★ FOUNDER, 2026-08-30: *"Interactions stay inside the Post — Like,
       Comments, Repost, Share, Save/Favorite, Counts, any Post-specific
       action… Never create surface-specific interaction state."*

     MOVED HERE FROM `home.js` ON 2026-08-30, unchanged. It was Home's private
     function, which meant Home was the only surface where a Post had controls:
     the Center page's Posts tab drew the same canonical Posts with nothing to
     press. A Post that can be liked on one screen and not on another is two
     Posts, whatever the backend says.

     PLACEMENT IS THE CARD'S DECISION, NOT THE SURFACE'S (founder, 2026-08-03):
     a Post with media gets the side RAIL laid over it; a Post without gets the
     bottom ROW. Same controls, same behaviour, one implementation — only the
     placement moves. */
  OW.mountResponses = function (host, item) {
    /* UNWRAPPED THE SAME WAY THE RIVER UNWRAPS. The card is found by
       `[data-po-id]`, and a wrapped row has no `id` of its own — so this
       returned early and EVERY interaction control silently disappeared from
       every post. The feed still rendered, which is what made it hard to see:
       the cards looked finished and had no like, dislike, repost, save or
       comment on them at all. Measured 2026-08-25. */
    /* the canonical object first; the legacy wrapper is still accepted so a
       row written before the unification still finds its object, and that
       clause is what deletes when A's migration lands */
    var g = item.post || item.gallery || item;
    /* a highlight is a Center, not a Post — there is nothing here to like,
       repost, save or comment on; the card itself is the door (see postFace) */
    if (g && (g.type === 'highlight' || g._highlight)) return;
    /* the wrapper carries the interaction state for a migrated row */
    if (item.interactions && !g.interactions) { g = Object.assign({}, g, {
      interactions: item.interactions, _post: true }); }
    /* WHERE THE RESPONSES LIVE (founder, 2026-08-03): "lean a little bit more
       into the TikTok with likes and stuff being on the side of posts for the
       scrolling feed and on Instagram, Twitter being on the bottom — but not as
       buttons, but as actual icons."

       Both, and the card decides. A post with media gets the SIDE RAIL laid over
       it, which is what the vertical feed convention is for; a post without gets
       the BOTTOM ROW, because a rail over nothing is chrome. Neither is a button
       any more — bare glyph, count beneath or beside it, nothing drawn around
       it. The controls are identical in both places; only the placement moves,
       so there is one set of behaviour rather than two. */
    var card = host.querySelector('[data-po-id="' + (g.id || '') + '"]');
    if (!card) return;
    /* ── THE RAIL NEEDS ROOM, AND A WIDE PICTURE HAS NONE ─────────────────
       (kept as the record of why the rail was ever conditional; the block
       after it retires the rail from the Feed altogether)
       The cover's shape is clamped to a 1.91:1 landscape floor (see coverAR),
       which at a phone's card width is ~177px tall. The rail — five glyphs
       with their tallies, stacked — is 185–214px. So every landscape cover
       at the floor was SHORTER than the rail laid over it, and the rail,
       anchored to the bottom, ran 23px out of the top of the picture with
       the heart floating on the card ground above it. B measured it on two
       cards; A reproduced it on a 173px cover (rail 185) and a 186px one.

       The decision this block already makes — rail over media, row under
       words — gets one more clause: the rail only when the cover is tall
       enough to hold it. A wide picture keeps its shape uncropped and takes
       the bottom row, like a post with no picture does. The threshold is the
       cover's own aspect: below 1.5:1 (≥ ~226px at 339 wide) the rail fits
       with air; at or above it, it does not. Same controls, same behaviour —
       only the placement, which is the whole design of this block. */
    /* ── THE RAIL IS THE SCROLL'S, THE ROW IS THE FEED'S ─────────────────
       ★ FOUNDER, 2026-08-03, the ruling this block quotes: the side rail
         *"for the scrolling feed"*, the bottom row for *"Instagram,
         Twitter"* — two PRESENTATIONS, not two kinds of Post.
       ★ FOUNDER/485, 2026-09-21, looking at Home: *"this isnt shapped right
         at all photos to small whatsoever … does not feel like a social
         media."*

       The clause above read the ruling as "media → rail, words → row" and
       laid a TikTok rail over every picture on Home — six glyphs and a
       scrim on top of the photograph, and on a carousel the stack ran out
       of the top of the picture into the author's name. Measured
       2026-09-21 at 290. No feed does that: Instagram and Twitter put the
       row UNDER the picture, and the rail exists only where the picture is
       the whole screen.

       So the controls are mounted in the row, always. The Scroll's media
       page lays that same row out as its rail in CSS
       (`.ow-fpos[data-kind="media"] .po-card__foot .po-acts`) — one set of
       controls, one DOM position, and the presentation decides the shape,
       which is what the ruling actually says. `railFits` and its aspect
       arithmetic went with the second slot. */
    var slot = card.querySelector('[data-po-responses]');
    if (!slot) return;
    /* a card rendered before this change may still carry the old rail
       slot; it must be empty or both copies answer the same press */
    var other = card.querySelector('[data-po-rail]');
    if (other) other.innerHTML = '';
    var inter = g.interactions || {}, offers = inter.offers || [], mine = inter.mine || '';
    var guest = typeof OW.signedIn === 'function' && !OW.signedIn();
    if (guest) offers = offers.filter(function (verb) { return verb === 'like'; });
    var counts = inter.counts || {};
    /* ★ FOUNDER/471: *"why doesnt saves and reposts have a count."* The
       tallies for repost, share and save arrive on the row's `actions`
       (contracts.interactions() counts only like and dislike); read them
       there when `counts` is silent, so every act shows its number. */
    var tallies = g.actions || {};
    ['repost', 'share', 'save'].forEach(function (k) {
      if (counts[k] == null && typeof tallies[k] === 'number') counts[k] = tallies[k];
    });
    /* ── THE COMMENT TALLY LIVES BESIDE `counts`, NOT INSIDE IT ───────────
       ★ FOUNDER, 2026-09-06: *"this grey backing will not be final and needs
         to show COMMENT."*

       The control below read `counts.comment`. The producer has never written
       that: `contracts.interactions()` puts the tally at `interactions.comments`
       — deliberately, and it says why in its own docstring — *"`counts` is keyed
       by OFFERS… folding it in would have made it look like a third reaction."*

       So the comment control was drawn on every card, on every surface, with NO
       NUMBER, forever. The control existed, the thread worked, the backend
       counted correctly, and the card asked the one question the payload does
       not answer. Fifth instance of this exact shape today — a reader naming a
       field the producer does not write, with `|| 0` quietly covering it.

       BOTH ARE READ. `interactions.comments` is the canonical place; the
       in-`counts` name stays as a fallback while any older producer answers,
       and costs nothing when it does not. */
    var nComments = inter.counts_hidden ? 0
                  : ((typeof inter.comments === 'number') ? inter.comments
                     : (counts.comment || 0));
    /* WHICH KIND OF OBJECT IS BEING ANSWERED. `/api/objects/{type}/{id}/respond`
       is generic and this bar hardcoded `gallery` — correct while a card could
       only ever be a gallery, and silently wrong the moment a post wears the
       same bar, which it now does. The type travels ON the control rather than
       being assumed by the listener, because the listener is one handler for a
       whole page and cannot know what it just heard from. */
    /* THE OBJECT SAYS WHAT IT IS. This inferred the kind — "the wrapper
       carries interaction state and the object does not, therefore post" —
       and an inference holds only until the contract moves. It moved:
       2026-08-25, the canonical Post began carrying `interactions` of its own,
       so `!g.interactions` went false, `_post` was never set, and every Post
       in the feed started addressing itself as a GALLERY again — the exact
       defect that inference was written to fix, re-created by a backend change
       that broke nothing else. Measured on the running App: type "post",
       controls emitting data-okind="gallery".

       A canonical Post carries `type: "post"` and a legacy gallery carries
       `type: "gallery"`, so the object's own declaration is the answer and no
       longer depends on which optional fields happen to be populated. The
       inference stays last, for rows that predate the field. */
    /* ── THERE IS ONE OBJECT HERE, AND IT IS A POST ────────────────────
       ★ FOUNDER, 2026-08-25: *"remove all references of galleries and just
         make them posts, and ones with multiple photos and videos shouldn't
         be different."*

       This branched: a card was a `gallery` or a `post`, and the kind decided
       which endpoint the like, the repost and the save were addressed to. That
       branch is the whole defect — a post carrying six photos was a different
       KIND of thing from a post carrying one, so it answered to a different
       store, and the same press meant two different rows depending on how much
       media happened to be attached.

       Media count is not identity. A Post with one photo and a Post with
       twelve are one object with a longer `media[]`, so there is one kind and
       one address. Nothing infers, nothing branches, nothing defaults.

       The data-model half of this is A's and is in flight; this is the App's
       half — the App no longer has a second object to be wrong about. */
    var okind = 'post';
    /* ── REPOST AND SAVE READ THE CANONICAL OBJECT, NOT LEGACY FIELDS ──────
       Like and dislike were taught the canonical names (`actions` is the
       tallies, `you` is this viewer's own state); repost and save were left
       reading `g.reposted` / `g.reposts` / `g.saved`, which a canonical Post
       does not carry. So a Post you HAD reposted rendered un-pressed and its
       tally rendered as nothing at all — the interface stating, confidently,
       the opposite of what the backend says (founder: counts and viewer state
       must come from the canonical backend).

       A rename, not an invention: every value is read straight off the payload,
       and the legacy field remains the fallback so galleries are untouched.
       `0` is a real tally and stays absent-when-zero exactly as before. */
    var you = g.you || {};
    var reposted = ('reposted' in you) ? !!you.reposted : !!g.reposted;
    /* ── HIDDEN ON EITHER SIDE ────────────────────────────────────────────
       ★ FOUNDER, 2026-09-06: *"HAS to show reactions and profile PICTURES…
         UNLESS USER HAS CHOSEN TO HIDE ON EITHER SIDE UNDERSTAND?"*

       When the author has hidden the counts on what they post, or the viewer
       has hidden them on what they see, the server REMOVES the numbers and
       says `counts_hidden` rather than sending zeroes — zero is a fact about a
       Post and a card showing 0 where a hundred people reacted would be the
       platform lying on somebody's behalf.

       THE ABSENCE ALONE IS NOT ENOUGH ON THIS SIDE, and that is the whole
       reason this flag is read here rather than being left implicit. The line
       below falls back to the LEGACY `g.reposts` when `counts.repost` is
       missing — and missing is exactly what hidden looks like. A `||` fallback
       covering a deliberate absence is the defect this session has now found
       eight times; here it would have quietly leaked the one number the person
       asked to hide.

       The card is MARKED so that the live path honours it too: a press must
       not be able to create a tally on a card that has none. */
    var hideCounts = !!inter.counts_hidden;
    var reposts  = hideCounts ? 0
                 : ((counts.repost != null) ? counts.repost : g.reposts);
    var saved    = ('saved' in you) ? !!you.saved : !!g.saved;
    /* THE GLYPHS ARE PRESENTATION, THE MEANING IS THE RUNTIME'S. The store
       holds "like"; the heart lives here (the response primitive keeps the two
       apart precisely so a glyph can change without a migration).

       COUNTS ARE ALWAYS SHOWN, INCLUDING ZERO-AS-ABSENT: a tally appears when
       there is something to count. Founder (2026-08-02): likes and dislikes
       both public, views and reposts separate metrics beside them — never
       summed into one score, because they mean different things. */
    /* ── EVERY ACT CARRIES ITS NUMBER, IN EVERY FEED ─────────────────────
       ★ FOUNDER/488, 2026-09-21: *"everything should have counts visible, no
         matter what feed it is viewed in. things like this shouldnt have to
         be said."*

       THIS OVERTURNS A RULE I WROTE AND IT WAS MINE, NOT HIS. Every tally on
       this card was rendered `count ? <b>count</b> : ''`, reasoned as *"a
       count of zero is not a number to print — '0' reads as a judgement
       nobody made"*. The consequence is what he is looking at: on one card
       the heart has a number and the repost does not, on the next it is the
       other way round, and the row's width changes between Home and Scroll
       because different acts happen to be at zero. A person reads that as
       the interface being unfinished, which it was.

       HIS WORD SINCE, 2026-11-07 (L7, "Hide until it's 1"): the tally is always in the row, so the row keeps its
       shape and a press has its number to move, and a count of 0 is not shown (`data-zero`, oneway-popit.css).

       THE ONE ABSENCE THAT REMAINS is `counts_hidden` — the author or the
       viewer has HIDDEN the numbers (founder, 2026-09-06: *"UNLESS USER HAS
       CHOSEN TO HIDE ON EITHER SIDE"*). That is a different thing from zero
       and it removes every tally on the card, which is why it is decided
       once, here, rather than per act. */
    function tally(n) {
      if (hideCounts) return '';
      return '<b' + (+n ? '' : ' data-zero') + '>' + esc(String(n == null ? 0 : n)) + '</b>';     /* a count shows from 1 (his word, 2026-11-07, L7) */
    }
    function act(verb, icon, label, on, count) {
      return '<button type="button" class="po-act po-act--icon"'
        + ' data-po-respond="' + esc(verb) + '" data-obj="' + esc(g.id) + '"'
        + ' data-okind="' + esc(okind) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(label) + '"'
        + ' data-act="' + (on ? 'on' : 'off') + '">'
        + OW.glyph(icon)
        + (verb === 'dislike' && inter.dislike_count_hidden ? '' : tally(count)) + '</button>';
    }
    var html = offers.map(function (verb) {
      var icon = ({ like: OW.likes.glyph(), dislike: 'thumbdown' })[verb] || 'spark';
      return act(verb, icon, OW.word(verb), mine === verb, counts[verb] || 0);
    }).join('');

    /* ── COMMENT — THE CONTROL THAT DID NOT EXIST ─────────────────────────
       ★ FOUNDER, 2026-08-30: *"comments are still gone at least on my last
         view."*  They were, and not from the thread — from the CARD.

       Every control here except this one had a path. `offers` from the backend
       is `("like", "dislike")` and nothing else, and the comment control was
       rendered ONLY from that list — so it never appeared on any Post, on any
       surface, ever. Meanwhile `actions` carries `comment` and the tally was
       being counted, the thread rendered fine in the Post viewer, and the
       backend's comment domain was complete. The one missing piece was the way
       in, and its absence looked like a design choice.

       WHY IT IS EXPLICIT RATHER THAN ADDED TO `OFFERS`. `offers` is the set of
       OPINIONS a person can hold about a Post — like and dislike are opposites
       and `mine` names which one is held. A comment is an ACT, not an opinion:
       you can comment and like, comment twice, or comment without any opinion
       at all. Repost and save are drawn explicitly for exactly that reason and
       comment belongs with them.

       IT OPENS THE POST rather than carrying its own thread. A comment thread
       is a surface, and the Post viewer already owns it — `data-po-open`
       reaches the same place a tap on the card does, so there is one way into
       a Post's conversation rather than two. */
    html += '<button type="button" class="po-act po-act--icon" data-po-comment'
      + (guest ? ' disabled aria-disabled="true" title="Sign in to comment"' : '')
      + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
      + ' aria-label="' + esc(nComments
          ? (nComments === 1 ? '1 comment' : nComments + ' comments')
          : 'Comment') + '">'
      /* `talk` is the existing speech glyph in the icon table. Adding a
         second one called `comment` would be two icons for one meaning, which
         is the duplication rule applied to pictures. */
      + OW.glyph('talk')
      + tally(nComments) + '</button>';

    /* REPOST — a re-share, not an opinion: it puts this in your own world and
       the people connected to you meet it. Its own act, its own tally. */
    /* YOUR OWN POST IS NOT YOURS TO REPOST — the server refuses it ("you
       cannot repost your own post"), so offering the press was a control that
       could only fail (founder/502's crawl found it). The count stays, because
       who reposted what you made is yours to see; it is simply not a button. */
    /* ...unless it was made in a Center's name: then it is the Center's, and its author passes it on like anyone
       (the founder, 2026-10-21: "why can i william rauert not repost my centers posts"; `may_repost` is the door's rule) */
    if (you.mine && !you.may_repost) {
      html += '<span class="po-act po-act--icon po-act--stat" aria-label="'
        + esc(reposts === 1 ? '1 repost' : (reposts || 0) + ' reposts') + '">'
        + OW.glyph('repost') + tally(reposts) + '</span>';
    } else {
      /* A POST IS REPOSTED ONLY AFTER IT IS LIKED, AND NEVER AFTER IT IS DISLIKED (the founder, 2026-11-03: "You have to like a
         post before you could repost it ... if you dislike a post, you cannot repost it"). The server refuses it
         (service.repost); the button shows why before it is pressed. A repost already made stays a button that takes it back. */
      var repostWhy = (!guest && !reposted && okind === 'post' && ('liked' in you))
        ? (you.disliked ? 'dislike' : (you.liked ? '' : 'like')) : '';
      html += '<button type="button" class="po-act po-act--icon" data-po-repost'
        + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
        + ' aria-pressed="' + (reposted ? 'true' : 'false') + '"'
        + ' aria-label="Repost"'
        + (repostWhy ? ' aria-disabled="true" data-repost-needs="' + repostWhy + '" title="' + esc(REPOST_NEEDS[repostWhy]) + '"' : '')
        + ' data-act="' + (reposted ? 'on' : 'off') + '">'
        + OW.glyph('repost')
        + tally(reposts) + '</button>';
    }

    /* SAVE STANDS AT THE ROW'S RIGHT END (founder/831: the interactions "spaced exactly like Instagram"): the acts
       that answer the Post sit together on the left, and keeping it for yourself is the one at the far edge. It is
       built here and placed last, after Share and the views. */
    /* A FAVORITE IS YOURS (the founder, 2026-10-30: "posts shouldnt have the faviorite count go up like that when users fav a post"): no number on the button, for anyone */
    var saves = 0;
    var saveHTML = '<button type="button" class="po-act po-act--icon" data-po-save'
      + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
      + ' aria-pressed="' + (saved ? 'true' : 'false') + '"'
      + ' aria-label="' + (saved ? 'Saved' : 'Save') + '"'
      + ' data-act="' + (saved ? 'on' : 'off') + '">'
      + OW.glyph('bookmark')
      + tally(saves) + '</button>';
    /* ★ FOUNDER/471: *"where is my share button and interface."* SHARE is
       its own act on every card — the arrow leaving the box — with its
       tally, and it opens the send-to interface INLINE under the card (no
       modal, S-rules): the people and places you talk to, ranked with
       reasons, one press to send the Post as a reference. The handler is
       in popit-live.js beside repost and save. */
    var shares = hideCounts ? 0 : ((counts.share != null) ? counts.share : 0);
    html += '<button type="button" class="po-act po-act--icon" data-po-share'
      + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
      + ' aria-label="Share" aria-expanded="false">'
      + OW.glyph('share')
      + tally(shares) + '</button>';

    /* VIEWS ARE NOT AN ACTION — nothing to press, so it is not a button. How
       many people opened it, stated beside what they thought of it. */
    /* VIEWS OBEY THE SAME CHOICE. It is not inside `counts`, so the server
       removing the tally does not remove this one — and "hide the counts on
       what I post" plainly includes how many people opened it. A rule honoured
       on three numbers out of four is not a rule. */
    if (g.views && !hideCounts) {
      html += '<span class="po-act po-act--icon po-act--stat" aria-label="'
        + esc(g.views + ' opened this') + '">' + OW.glyph('eye')
        + '<b>' + esc(g.views) + '</b></span>';
    }
    html += saveHTML;
    /* MORE (the half-baked audit, 2026-11-01, unit 5): Not interested, Mute, Add a note and Report, in the one menu a More opens
       (OW.cards.menu; the App's OW.postMenu says what each choice does). The backend's doors existed since 2026-10-31 and no
       post reached them. Not signed out, and only where a page wires it. At the row's end, after Save: the head's right is
       where the post was made (PROPOSED, for his eye: Instagram and X put it at the head's right). ON YOUR OWN POST it is the
       author's More (founder/1204, the pages inside a Post): Edit, Insights and Delete, as Instagram's is; before, your own
       post had no More at all and its Edit and Delete lived only on the post's own page. */
    if (!guest && OW.postMenu && OW.cards && OW.cards.mark) {
      html += '<button type="button" class="po-act po-act--icon po-act--more" data-po-more-menu' + (you.mine ? ' data-po-mine="1"' : '') + (you.may_remove_from_center ? ' data-po-takeoff="1"' : '')
        + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
        + ' aria-label="More" aria-expanded="false">' + OW.cards.mark('more') + '</button>';
    }
    /* THE MARK THE LIVE PATH READS. Every optimistic press in popit-live.js
       creates a `<b>` when the server answers with a tally — so without this a
       card that correctly rendered no numbers would grow one the moment its
       viewer pressed anything, and hiding would last exactly until the first
       tap. The flag lives on the acts container because that is the node every
       one of those handlers can already reach with `closest`. */
    if (hideCounts) slot.setAttribute('data-counts-hidden', '1');
    else slot.removeAttribute('data-counts-hidden');
    if (inter.dislike_count_hidden) slot.setAttribute('data-dislike-count-hidden', '1');
    else slot.removeAttribute('data-dislike-count-hidden');
    slot.innerHTML = html;
  };

  /* A glyph by name, for callers that build markup as strings. Same icon
     table the material uses, so a heart is the same heart everywhere. */
  /* ═══ THE OPENING — A POPIT BECOMES THE SURFACE IT OPENS ═════════════════
     ★ FOUNDER, 2026-09-02, and A cleared the way for it in the same pass:
       the tap now carries WHERE IT STARTED — `{node, rect, at}` — through
       `opts.onPost(id, from)` and `OW.feed.openPost(id, from)`.

     THAT ARGUMENT WAS ARRIVING AND BEING DROPPED. `openPost(id)` takes one
     parameter, so every caller has been handing it an origin it ignores. This
     is the consumer.

     WHY IT NEEDED A'S 635ms FIX FIRST. A shared-element transition that begins
     a third of a second after the finger landed does not read as the object
     moving — it reads as a stutter, and no easing hides it. The gesture had to
     become immediate before the animation could mean anything, which is why
     these two pieces of work only make sense together.

     FLIP, NOT ANIMATED GEOMETRY. The plate is placed at its DESTINATION, then
     inverse-transformed back onto the tapped card's rect, then released to
     identity. So the browser animates one `transform` on one layer — nothing
     reflows, nothing repaints per frame, and it holds 120Hz on a phone while a
     surface mounts behind it. Animating `left/top/width/height` would relayout
     every frame, which is the version of this that always feels cheap.

     IT IS A PLATE, NOT A CLONE. Cloning the card would duplicate its media, its
     video elements and its listeners for the length of the animation. The plate
     wears the Popit material and the ORIGIN'S OWN HUE — that is what makes it
     read as *that* object growing rather than a generic rectangle — and it is
     removed the moment it lands.

     IT NEVER BLOCKS. `pointer-events:none`, and the surface behind it is live
     from the first frame: if the animation is skipped, dropped or cut short,
     the person has the thing they tapped and nothing is owed. */
  function _assignShallow(a, b) {
    var out = {}, k;
    for (k in (b || {})) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    for (k in (a || {})) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    return out;
  }

  OW.originOpen = function (from, target, opts) {
    opts = opts || {};
    var reduced = RM || root.getAttribute('data-motion') === 'reduced';
    /* SIMPLE OPENS PLAINLY (his walk, 2026-11-08, item 22: "On simple mode, they don't have to have the pop-it opening animation"):
       the plate is the Popit material in flight, so in Simple there is none; the page's own short fade is the whole opening */
    if (root.getAttribute('data-simple') === '1') return Promise.resolve(false);
    if (reduced || !from || !from.rect || !target) return Promise.resolve(false);
    var a = from.rect;
    if (!a.width || !a.height) return Promise.resolve(false);

    /* ★ THE DESTINATION IS NOT MEASURABLE ON THE FRAME IT IS CREATED.
       Measured: tapping a real card opened the Post and produced NO plate,
       because `walkTo` hands its builder a host that is in the document but has
       not been laid out — `getBoundingClientRect()` returns 0x0 and the guard
       below correctly refused to animate to nothing.

       So a zero-size target is not a refusal, it is "not yet". One frame is
       given, and the size is asked again. A SECOND failure IS a refusal — an
       element that is still 0x0 after layout is genuinely not a destination,
       and flying a plate at it would leave a rectangle collapsing into a corner.

       The wait is a rAF with a timeout behind it, for the reason this file
       already records twice: rAF is a REQUEST, and a throttled or backgrounded
       view never calls back. */
    function measure() {
      try { var r = target.getBoundingClientRect(); return (r.width && r.height) ? r : null; }
      catch (_) { return null; }
    }
    var b = measure();
    if (!b) {
      return new Promise(function (res) {
        var ran = false;
        function second() {
          if (ran) return; ran = true;
          var again = measure();
          if (!again) { res(false); return; }
          res(OW.originOpen(from, target, _assignShallow({ _measured: again }, opts)));
        }
        try { global.requestAnimationFrame(second); } catch (_) {}
        global.setTimeout(second, 48);
      });
    }
    if (opts._measured) b = opts._measured;
    /* IT LANDS ON WHAT IS SEEN (item 23: "on pop-it mode, that opening animation should be perfect"): a Post's page runs far below
       the screen, and a plate sized to the whole of it grew past the bottom edge and faded out while still growing, so the eye
       never saw it arrive. It lands on the part of the destination the screen shows. */
    try {
      var vh = global.innerHeight || doc.documentElement.clientHeight || 0, top = Math.max(b.top, 0), bot = vh ? Math.min(b.bottom, vh) : b.bottom;
      if (bot - top > 40) b = { left: b.left, top: top, width: b.width, height: bot - top };
    } catch (_) {}

    var plate = doc.createElement('div');
    plate.className = 'ow-openflip';
    plate.setAttribute('aria-hidden', 'true');
    /* THE ORIGIN'S LIGHT, so it is recognisably the card that was pressed. A
       Post wears the hue of the Center it was lit to (§17), and losing that on
       the way in would break the one thread the eye is following. */
    var h1 = '', h2 = '';
    try {
      if (from.node) {
        var cs = getComputedStyle(from.node);
        h1 = cs.getPropertyValue('--h').trim() || cs.getPropertyValue('--ow-h1').trim();
        h2 = cs.getPropertyValue('--h2').trim() || cs.getPropertyValue('--ow-h2').trim();
      }
    } catch (_) {}
    if (h1) plate.style.setProperty('--h', h1);
    if (h2) plate.style.setProperty('--h2', h2 || h1);

    /* placed at the DESTINATION — the inverse below is what puts it on the
       card, and releasing that inverse is the whole animation */
    plate.style.left = b.left + 'px';
    plate.style.top = b.top + 'px';
    plate.style.width = b.width + 'px';
    plate.style.height = b.height + 'px';
    (doc.body || doc.documentElement).appendChild(plate);
    /* THE PAGE LEFT GOES UNDER THE PLATE (item 23): the plate is light on cloth, not a wall, and the page being left faded across the
       new one for the whole flight, its words showing through both (measured at real speed: Home's greeting over the Post's words at
       480 to 640 ms). It goes in the first quarter of the flight now (the shell's OW.ghostsAway), so the plate lands on the Post alone. */
    if (OW.ghostsAway) { try { OW.ghostsAway(Math.round((opts.ms || OW.motion.ms('open')) * 0.25)); } catch (_) {} }

    var sx = a.width / b.width, sy = a.height / b.height;
    var dx = a.left - b.left, dy = a.top - b.top;
    plate.style.transformOrigin = '0 0';
    plate.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale('
                          + sx + ',' + sy + ')';
    plate.style.opacity = '1';
    /* A FORCED FLUSH, NOT A FRAME. `requestAnimationFrame` is a REQUEST, and a
       background tab or a throttled view simply never calls back — the plate
       would then sit at the origin rect forever. Reading a layout property
       flushes style synchronously and cannot be skipped. This file already
       learned that lesson in `OW.cross`. */
    /* jshint expr:true */ plate.offsetHeight;

    var ms = opts.ms || OW.motion.ms('open');
    plate.style.transition = 'transform ' + ms + 'ms ' + OW.motion.ease('spring-soft') + ','
                           + ' opacity ' + Math.round(ms * 0.55) + 'ms linear '
                           + Math.round(ms * 0.45) + 'ms';
    plate.style.transform = 'translate(0,0) scale(1,1)';
    plate.style.opacity = '0';

    return new Promise(function (res) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (plate.parentNode) plate.parentNode.removeChild(plate);
        res(true);
      }
      plate.addEventListener('transitionend', finish);
      /* THE TIMEOUT IS THE CONTRACT, not a belt-and-braces. `transitionend`
         does not fire for a transition the compositor never ran — a hidden
         tab, a discarded layer — and a plate left on screen would sit over the
         surface it was introducing. */
      global.setTimeout(finish, ms + 120);
    });
  };

  OW.glyph = glyph;

  /* ── SOMEBODY IS TYPING UNDER A POST, AND THE POST'S CARD SAYS SO LIVE ────────
     ★ FOUNDER, 2026-10-10: *"when a user is typing under a video even if the user watching doesnt have it open still
     show the typing thatd be cool and futuistic if can do that live"*.
     The server already announces who is composing under a post on the post's own topic (realtime/typing_presence.py), and
     every card on screen is watched on that topic (`OW.realtime.watch`), so the event arrives at a card whose post is
     not open. This marks each copy of that post's comment bubble `data-typing`, and the bubble runs the same three
     typing dots it runs while its conversation is open (oneway-popit.css, ".ow-dot"). The card says THAT someone is
     typing and never WHO: a feed is read by people the typist may not know. The server announces the stop; the timer
     is only for a stream that dropped before it could. */
  (function () {
    var timers = {}, TTL = 9000;
    function bubbles(id) {
      var q = '[data-po-comment][data-obj="' + (global.CSS && global.CSS.escape ? global.CSS.escape(id) : id) + '"]';
      return doc.querySelectorAll(q);
    }
    function paint(id, on) {
      Array.prototype.forEach.call(bubbles(id), function (b) {
        if (on) b.setAttribute('data-typing', '1'); else b.removeAttribute('data-typing');
      });
    }
    doc.addEventListener('ow:typing', function (e) {
      var d = (e && e.detail) || {}, t = String(d.topic || '');
      if (t.indexOf('post:') !== 0) return;
      var id = t.slice(5), on = !!(d.typing && d.typing.length);
      paint(id, on);
      global.clearTimeout(timers[id]);
      if (on) timers[id] = global.setTimeout(function () { paint(id, false); }, TTL);
    });
  })();

  /* ── LIKES AND DISLIKES, IN THE STYLE A PERSON CHOOSES ─────────────────────
     ★ FOUNDER, 2026-10-09: *"give users the option in settings and appeance to choose between likes and dislikes
       (facebook) and instagram likes and dislikes maximize it"*.
     Two styles of the same two opinions, chosen in Settings > Appearance: Instagram's heart, or Facebook's thumbs up;
     the dislike is the thumbs down in both. Kept on this device like the theme and the logos (OW.marks), read
     wherever a like is drawn: the card's control, the Scroll rail, a Post's own page, the double-tap bloom and the
     "liked by" line. Changing it redraws every like already on screen; its count and pressed state are untouched. */
  OW.likes = {
    get: function () {
      try { return global.localStorage.getItem('ow_likes') === 'facebook' ? 'facebook' : 'instagram'; }
      catch (e) { return 'instagram'; }
    },
    glyph: function () { return OW.likes.get() === 'facebook' ? 'thumbup' : 'heart'; },
    set: function (v) {
      try { global.localStorage.setItem('ow_likes', v === 'facebook' ? 'facebook' : 'instagram'); } catch (e) {}
      OW.likes.paint();
    },
    paint: function () {
      root.setAttribute('data-ow-likes', OW.likes.get());
      var mark = svg(OW.likes.glyph());
      Array.prototype.forEach.call(doc.querySelectorAll('[data-po-respond="like"] > svg, .po-card__known > svg'), function (old) {
        var t = doc.createElement('span'); t.innerHTML = mark;
        if (t.firstChild) old.parentNode.replaceChild(t.firstChild, old);
      });
    }
  };
  root.setAttribute('data-ow-likes', OW.likes.get());


  /* THE RESTING BEAD — depth 1, "Glance". Icon, a one-word label, and AT MOST
     one live signal. It withholds on purpose: the closed state teases, the
     open state rewards (§12, the Curiosity Law). If a bead explains itself
     fully at rest, it has failed. */
  OW.bead = function (data, opts) {
    data = data || {}; opts = opts || {};
    var n = doc.createElement('button');
    n.type = 'button';
    /* PLACED BY DEFAULT. Floating is opt-in and belongs to a hero moment — a
       profile, a feed or an Information tab is a set of placed objects, not a
       mobile. Pass {float:true} deliberately or it does not drift. */
    n.className = 'po' + (opts.float ? ' po-float' : '') + (data.size ? ' po--' + data.size : '');
    n.setAttribute('data-v', variantFor(data.id || data.label));
    n.setAttribute('data-po-id', data.id || '');
    n.setAttribute('aria-label', (data.label || '') + (data.signal ? ' — ' + data.signal : ''));
    if (data.hue) hue.scope(n, data.hue.h1, data.hue.h2);
    n.appendChild(el('span', 'po-face'));
    if (data.icon && ICONS[data.icon]) n.appendChild(el('span', 'po-ic', svg(data.icon)));
    n.appendChild(el('span', 'po-lb', esc(data.label || '')));
    if (data.signal) n.appendChild(el('span', 'po-sig', esc(data.signal)));
    n._po = data;
    observe(n);
    if (opts.open !== false) n.addEventListener('click', function () { OW.open(data, n); });
    return n;
  };

  /* THE GLANCE ROW — same silhouette, same hue, same internal bloom; no seam,
     no grain, no spill, no bob. For feeds, Information tabs, search results —
     the density case the old system had no answer for. */
  OW.glance = function (data, opts) {
    data = data || {}; opts = opts || {};
    var n = doc.createElement('button');
    n.type = 'button';
    n.className = 'po-glance';
    n.setAttribute('data-v', variantFor(data.id || data.label));
    n.setAttribute('data-po-id', data.id || '');
    if (data.hue) hue.scope(n, data.hue.h1, data.hue.h2);
    /* ── THE DATE IS ON THE ICON ───────────────────────────────────────────
       ★ FOUNDER, 2026-09-10: *"Look at how Apple Calendar does it ... where
         they have the calendar date on the icon itself, and it looks really
         clean and nice. That's how the interfaces should look one way, and
         everything should be lined up and intentional. There shouldn't be no
         subphrases just randomly explaining people's things."*

       An event row read: a generic calendar glyph, the title, and then a
       SUBPHRASE under it carrying "Sat, Sep 12". Three elements to say one
       thing, and the subphrase is exactly the randomly-explaining line he is
       objecting to.

       The date goes ON the mark, the way Apple Calendar's icon carries the
       day. The glyph is replaced — not decorated — so the row is a date and a
       title, lined up, with nothing underneath. `when` is passed already
       formatted by the caller, because only the caller knows the timezone
       rules this codebase has already been burned by twice.

       ANY ROW CAN USE IT. It is not an event feature: anything with a real
       date shows it here, and anything without keeps its glyph. */
    if (data.when && data.when.day) {
      var dt = el('span', 'po-glance__ic po-glance__date');
      dt.appendChild(el('b', 'po-glance__mon', esc(data.when.mon || '')));
      dt.appendChild(el('b', 'po-glance__day', esc(String(data.when.day))));
      n.appendChild(dt);
    } else if (data.face) {
      /* ── A FACE, NOT A PIN ───────────────────────────────────────────────
         ★ FOUNDER/407 (2026-09-14): *"Those location pins are unacceptable.
           We will have profile pictures only at this real point."*
         A Center or a person on a row is shown as itself: its picture when it
         has one, its initials in its own hue when it does not — the same face
         the feed card wears (.po-card__av). Never a glyph standing in for a
         real thing. `face: {image, name}`. */
      var fc = el('span', 'po-glance__ic po-glance__face');
      /* HOW THE FACE IS CUT — round · rounded · square. ★ FOUNDER/409:
         *"make sure it supports the square and circle orientation."* A
         person reads round unless they chose otherwise; a Center reads as a
         tile. `face.shape` is the owner's answer; absent, the kind decides. */
      var shp = String(data.face.shape || (data.face.kind === 'person' ? 'round' : '') || '').toLowerCase();
      if (shp === 'round' || shp === 'rounded' || shp === 'square') fc.setAttribute('data-shape', shp);
      /* THE ONE FACE (founder/1221): its picture whole, else its initials on its own colour (the founder, 2026-10-17). A row
         names the picture `picture`, the one field; discovery.js still hands `image` until its own turn (v52/faces) */
      fc.innerHTML = OW.face.inner({ name: data.face.name || data.label, picture: data.face.picture || data.face.image },
                                   { letters: 'i', img: ' loading="lazy"' });
      n.appendChild(fc);
    } else if (data.icon && ICONS[data.icon]) {
      n.appendChild(el('span', 'po-glance__ic', svg(data.icon)));
    }
    n.appendChild(el('span', 'po-glance__lb',
      esc(data.label || '') + (data.signal ? '<span class="po-glance__sig">' + esc(data.signal) + '</span>' : '')));
    n._po = data;
    if (opts.open !== false) n.addEventListener('click', function () { OW.open(data, n); });
    return n;
  };

  /* THE GRID — the default arrangement. Widgets claim spans of one shared
     column rhythm, so a 1×1 and a 2×2 compose without either knowing about
     the other. */
  OW.mountGrid = function (host, items, opts) {
    if (!host) return;
    host.classList.add('po-grid');
    var frag = doc.createDocumentFragment();
    (items || []).forEach(function (d) { frag.appendChild(OW.bead(d, opts)); });
    host.appendChild(frag);
    return host;
  };

  OW.mountList = function (host, items, opts) {
    if (!host) return;
    host.classList.add('po-list');
    var frag = doc.createDocumentFragment();
    (items || []).forEach(function (d) { frag.appendChild(OW.glance(d, opts)); });
    host.appendChild(frag);
    return host;
  };

  /* Normalise the runtime payload from GET /api/center/object/{id}/popit.
     Absent fields stay absent — a Popit is honest before it is pretty. */
  OW.fromApi = function (p, extra) {
    p = p || {}; extra = extra || {};
    return {
      id: p.id, label: p.label, kind: p.kind, kind_label: p.kind_label, glance: p.glance,
      image: (p.image && p.image.url) ? p.image : null,
      time_back: p.time_back || [], time_forward: p.time_forward || [],
      /* ── EVERYTHING BELOW WAS ALREADY BEING SENT AND WAS BEING DROPPED HERE.
         `_object_popit` returns identity · lifecycle · decisions ·
         relationships · conversations · actions · permissions on every object,
         and this normaliser kept four fields and discarded the rest, so the
         App rendered a name, a sentence and two lists of an object the runtime
         could describe completely.

         That is this platform's signature defect in its other direction — not
         a write nobody reads, but a READ nobody renders — and it is why an
         opened Popit could not be "information and history like a Wikipedia
         article" (founder, 2026-08-16). It already was one; nothing was
         showing it. Carrying these through is the whole change: no endpoint
         was added and no field was invented. */
      identity: p.identity || null,          /* the record's own facts — an infobox */
      lifecycle: p.lifecycle || '',          /* what state it is in */
      decisions: p.decisions || [],          /* what was decided, by whom, when */
      relationships: p.relationships || null,/* people · places · family · commitments */
      conversations: p.conversations || [],  /* the talk that belongs to it */
      actions: p.actions || [],              /* routable acts on it */
      permissions: p.permissions || null,    /* what THIS viewer may do */
      signal: extra.signal || (p.time_forward && p.time_forward[0] && p.time_forward[0].text) || '',
      icon: extra.icon || '', hue: extra.hue || null, world: !!extra.world
    };
  };


  /* ═══ 9 · THE FEED CARD ════════════════════════════════════════════════
     Home is a familiar scrolling feed (EXPERIENCE.md, the founder's Feed
     Correction) whose cards are GALLERIES — Gallery → Media → Feed. A card is
     the GLANCE of a Popit; opening it is the complete Gallery experience.

     Data in, card out. This knows nothing about HTTP: the shape it takes is
     the one /api/me/feed/galleries already returns. */
  /* A POST WEARS THE SAME CARD. Founder, 2026-08-09: a person posts TO a
     Center, and the canonical Home stream is post-based "with Gallery as
     CONTEXT rather than being replaced by it". The App had no post card at
     all — so the feed could not show the act the platform is built on.

     THIS IS A PROJECTION, NOT A SECOND CARD. A post is mapped onto the face
     this component already draws: the author is the actor it already renders,
     the body is the description, the first media is the cover, and WHERE IT
     WAS LIT takes the slot the counts use. One card, two inputs — because a
     second card component is exactly the duplication this codebase's first
     build rule forbids, and it would drift from this one within a week. */
  /* ★ FOUNDER/1041, 2026-10-26: *"User's posts on home when pop-it cards are being used need to be each user's own hue.
       They shouldn't match the user who's viewing hue. It should be a reflection of each user's hue and each center's hue.
       So each card, post, etc. should be colored to the own hue, whether it's in simple or pop-it mode."* And that night:
       *"not just a blend of blue on every single post on home because I set my hue to that. It should just be the
       background in my post and my profile that change."*
     EACH POST WEARS ITS AUTHOR'S OWN HUE: a person's post in that person's, a Center's (speaking as itself) in the
     Center's. MEASURED at df4ec323 on an isolated runtime, a viewer in Blue (228) on Home: Rosa's Red (0) post, Gil's
     Green (115) and Nia's (no hue) were all drawn in 228, the viewer's. The server sends `author.hue` as an ANGLE and the
     card read it as a triplet (parseTriplet(0) is null), so a card had a colour only when the post also carried the place's
     hue, which a person's own home never does to anyone but them (social/service.hides_home_scope); every other card fell
     through to `--ow-h1`, whoever was looking. Where it did have one it was the founder's 2026-08-15 blend of person and
     place, weighted .55 to the place: Otto's Aqua (172) post in the Pink Pier Arcade (302) was drawn in 243, the viewer's
     own post in 307 (her 228 bent toward the hash colour of her home). founder/1041 replaces the blend: the card is its
     author's. A person with no hue chosen wears what they wear on their own screen, the month's (founder/891-897,
     OW.hue.fromAngle with no angle); a Center always has one (store.place_hue: chosen, else derived from its id). */
  function authorPair(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' || /^\s*\d{1,3}\s*$/.test(String(v))) return hue.fromAngle(v);
    var t = parseTriplet(v);                       /* a triplet or a hex, as a gallery's actor carries it */
    return t ? [t.join(','), t.join(',')] : null;
  }
  /* THE VIEWER'S OWN POSTS WEAR THE VIEWER'S OWN LIGHT, AS IT IS NOW (S22): the pair hue.bind resolved (an exact pair
     wins, the month's when none), and a change of it repaints every one of them (paintMine, after hue.bind). Before the
     viewer is known, the post's own author.hue stands, which is the same colour by the server's account. */
  var ownBound = false;
  function minePair() { if (ctxPair) return [ctxPair.h1, ctxPair.h2 || ctxPair.h1]; var u = unknownPair(); return [u.h1, u.h2]; }
  function wearPair(n, pair) {
    n.style.setProperty('--ch1', pair[0]);
    n.style.setProperty('--ch2', pair[1] || pair[0]);
    n.style.setProperty('--h', pair[0]);
    n.style.setProperty('--h2', pair[1] || pair[0]);
    /* and the third (founder/459): the face's gradients fall back to `--ow-h3`, THE VIEWER'S, when a card does not say */
    n.style.setProperty('--h3', hue.third(pair[0]) || pair[1] || pair[0]);
  }
  function paintMine() {
    if (!doc.querySelectorAll) return;
    var p = minePair();
    [].forEach.call(doc.querySelectorAll('.po-card[data-po-mine]'), function (n) { wearPair(n, p); });
  }
  var bindSelf = hue.bind;
  hue.bind = function (opts) {
    var out = bindSelf(opts);
    ownBound = true;
    paintMine();
    return out;
  };
  /* THE ONE ANSWER TO "WHAT COLOUR IS THIS POST?": OW.hue.ofPost(post) -> [h1, h2], for the card (OW.card) and for a
     Post opened as a Popit (popit-live.js postData), so the two cannot disagree. `post` is the canonical Post
     (social/service.to_post). Its `mine` says the viewer wrote it in her own name (never a Center's voice). */
  function ownPost(p) {
    return !!(p && p.you && p.you.mine && String((p.author || {}).kind || '') !== 'center');
  }
  hue.ofPost = function (p) {
    p = p || {};
    var au = p.author || {};
    if (ownPost(p) && ownBound) return minePair();
    return authorPair(au.hue)
        || (String(au.kind || '') === 'center' ? authorPair(p.destination_hue) : null)
        || hue.fromAngle();
  };

  function networkBoostHTML() {
    return '<span class="po-card__when po-card__known" data-po-network-boost aria-label="The count includes Oneway network boosts, not individual people">Oneway boost</span>';
  }
  OW.networkBoostHTML = networkBoostHTML;

  function postFace(p) {
    var mm = p.media || [];
    var m = mm[0];
    return {
      id: p.id,
      /* ★ FOUNDER, 2026-08-26: *"A multi-photo Post remains one Post containing
           ordered media items… Do not flatten the slideshow into four
           independent Posts."*

         This read `media[0]` and nothing else, so a four-photo Post arrived
         intact from the backend and rendered as one photo with three of them
         unreachable — the flattening the founder ruled out, done by the
         renderer instead of by the store. The whole ordered list travels now;
         `cover` stays as the first item because every existing caller reads
         it. */
      _media: mm,
      /* WHERE IT CAME FROM, whole (471 §9): the Post's own provenance and the
         list of platforms when B's import records several. The per-item
         `source` travels inside `_media` already. */
      provenance: p.provenance || null,
      sources: p.sources || p.platforms || null,
      /* WHO YOU KNOW LIKED THIS. Read straight off the canonical Post; absent
         means nobody the viewer knows has — which is a different fact from
         "no likes" and must render as nothing rather than as a zero. */
      _known: p.known_likers || null,
      network_boost: p.network_boost || null,   /* the server sends it only to who uploaded the post (founder/1053) */
      title: p.title || '',
      description: p.body || '',
      cover: (m && (m.url || m.src || m)) || '',
      _coverSizes: (m && m.sizes) || null,
      _coverWidth: (m && m.width) || 0,
      /* a video's poster (research unit C1): the picture of its first frame, painted before the clip's first byte */
      _coverPoster: (m && (m.thumb || m.poster)) || '',
      _hue: p.destination_hue != null ? p.destination_hue : null,
      _post: true,
      /* THE ROOM, ONLY WHEN THE ROOM IS NOT THE AUTHOR. A post to a person's
         own Center carries `destination === center_id`, and the card rendered
         "Walk Tester · 1m ago · in Walk Tester" — the same person named as the
         writer and as the place. Where a post lives earns its line when it is
         a community; said of yourself it is noise. */
      _place: OW.postPlace(p),
      _placeId: String(p.destination || ''),
      _placePic: String(p.destination_picture || ''),     /* the place's own face beside its name (item 8) */
      /* WHERE A CARRIED POST WAS POSTED (founder/758, 759): a place's feed carries the posts of the places inside
         it, the posts about it and the feeds merged with it, and each says where it came from ("from Broad
         Channel"), the server's own words; absent on a Center's own post. */
      _from: (p.posted_in && p.posted_in.words) ? String(p.posted_in.words) : '',
      /* AND AN IMPORTED POST SAYS WHERE IT CAME FROM (founder/1143): "From TikTok", the server's words, beside where it was posted */
      _imported: (p.imported_from && p.imported_from.words) ? String(p.imported_from.words) : '',
      /* THE PLATFORM'S OWN PLAYER (founder/1139): a platform and an id the server read again, drawn by OW.embed */
      _embed: (p.embed && p.embed.provider && p.embed.id) ? p.embed : null,
      /* the post's own page on its platform, the server's address (players.page_of), where its one mark goes (founder/1307) */
      _origin: (p.imported_from && p.imported_from.url) ? String(p.imported_from.url) : '',
      /* its platform's mark only when it came from there; a post that links someone else's video was made here */
      platform: (p.imported_from && p.imported_from.platform) || '',
      /* AND, ON HOME, WHICH PLACE YOU FOLLOW BROUGHT IT (founder/760: following the Rockaways brings Broad Channel's
         posts): "via the Rockaways", or "about Hamels" for a post about the place followed; the server's words, absent
         on the carrying place's own page. */
      _via: (p.posted_in && p.posted_in.via && p.posted_in.via.words) ? String(p.posted_in.via.words) : '',
      /* ── A HIGHLIGHT IS A CENTER, NOT A POST ──────────────────────────
         MEASURED 2026-09-14 as a brand-new person: the first card on Home
         was `type: "highlight"` — a Center the door picked for her — drawn
         as a Post. Like answered 404 twice and reverted; pressing the card
         opened "#post/hl_…" and said "no such post". Every act on the first
         thing she touched led nowhere. The row names the Center it is
         (`destination`), so the card is a door to that Center and nothing
         else. */
      _highlight: p.type === 'highlight',
      _center: (p.type === 'highlight') ? String(p.destination || p.center_id || '') : '',
      _members: (p.type === 'highlight' && typeof p.member_count === 'number')
        ? p.member_count : 0,
      /* THREE FACTS THE CARD DRAWS AND THIS USED TO DROP. `postFace` is the
         only thing between a canonical Post and the card, so a field it does
         not carry over can never be rendered however faithfully the runtime
         sends it — which is how `audience`, `state` and the edited mark stayed
         invisible while being on every row. */
      audience: p.audience || '',
      /* WHAT IT SELLS (commerce SHOP-2): the live product this Post is about, its public card read when the
         Post was served; null when it was taken down, so the card simply has no product. */
      _product: (p.about && p.about.kind === 'product' && p.about.product && p.about.product.id) ? p.about.product : null,
      /* and when it was taken down, the Post says so under its words rather than losing the row (S11) */
      _productGone: (p.about && p.about.kind === 'product' && !p.about.product) ? (p.about.title || 'This product') : '',
      state: p.state || '',
      publish_at: p.publish_at || '',
      edited_at: p.edited_at || '',
      edit_count: p.edit_count || 0
    };
  }

  /* ── A VIDEO'S FIRST FRAME, AS A PICTURE (research unit C1, 2026-10-31) ────────────────────────────────────────────────
     The poster a clip is stored with: drawn here from the file before it is sent, by the composer and by Messages alike, and
     kept by the server as one small WebP (api/media/sizes.py poster). Without it a card's <video preload="metadata"> is an
     empty box until its first bytes arrive, and iOS Safari loads none until it plays. WebP where the browser encodes it,
     JPEG where it does not (Safari); '' when the browser cannot draw the clip, and the player's own first frame is all there is. */
  var STILL_EDGE = 1080, STILL_WAIT_MS = 6000;
  OW.videoStill = function (blob) {          /* a Blob or File, or an object URL the caller already holds (and keeps) */
    return new Promise(function (ok) {
      var held = typeof blob === 'string';
      if (!blob || (!held && !(global.URL && global.URL.createObjectURL))) { ok(''); return; }
      var url = held ? blob : global.URL.createObjectURL(blob), v = doc.createElement('video'), over = false;
      function end(still) {
        if (over) return;
        over = true;
        global.clearTimeout(wait);
        v.removeAttribute('src');
        try { v.load(); } catch (_) {}
        if (!held) global.URL.revokeObjectURL(url);
        ok(still);
      }
      var wait = global.setTimeout(function () { end(''); }, STILL_WAIT_MS);
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('error', function () { end(''); });
      v.addEventListener('loadeddata', function () { try { v.currentTime = 0.001; } catch (_) { end(''); } }, { once: true });
      v.addEventListener('seeked', function () {
        try {
          var k = Math.min(1, STILL_EDGE / Math.max(v.videoWidth, v.videoHeight));
          var cv = doc.createElement('canvas');
          cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          var webp = cv.toDataURL('image/webp', 0.8);
          end(webp.indexOf('data:image/webp') === 0 ? webp : cv.toDataURL('image/jpeg', 0.86));
        } catch (_) { end(''); }
      }, { once: true });
      v.src = url;
    });
  };

  /* ── A VIDEO PLAYS IN ITS OWN FRAME, AND ONLY THE PART THAT WAS KEPT (founder/831) ──────────────────────────────
     The editor (oneway-editor.js) keeps a clip whole and sends its frame beside it: `crop` {x, y, w, h}, fractions of
     the source, and `trim` {start, end} in seconds (api/oneway/social/routes.py upload_media). This is their one reader.
     Every Post face notes its framed videos by address (postFace, wrapped below), and any <video> of that address in a
     card or on a post's page is framed once it knows its size: the source sized and placed so the crop fills its box
     (the card's box taking the crop's shape), or, for a player with its own controls, cover-fit on the crop; and it
     plays only its kept part, from `start` (a seek at loadedmetadata: a `#t=` address would not pass OW.imageUrl) to
     `end` (a timeupdate loop, back to the start when it loops). `apply(video, item, {fit: 'contain'})` frames one
     directly; `note(media)` is how a surface that does not draw a card (posts.js) says what it is about to play. */
  OW.mediaFrame = (function () {
    var seen = {};
    function key(u) {
      try { return new URL(String(u || ''), global.location.href).pathname; } catch (_) { return String(u || '').split(/[?#]/)[0]; }
    }
    function within(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    var SET = ['position', 'objectFit', 'objectPosition', 'maxWidth', 'maxHeight', 'width', 'height', 'left', 'top',
               'right', 'bottom', 'clipPath', 'aspectRatio'];
    function clear(v) {
      SET.forEach(function (k) { v.style[k] = ''; });
      v.__owFrame = null; v.__owFrameKey = '';
    }
    /* set as !important inline, so a surface's own !important sizes (Lightbulb's full-bleed preview) cannot undo it */
    function put(st, k, val) { st.setProperty(k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), val, 'important'); }
    function place(v) {
      var m = v.__owFrame, c = m && m.crop, box = v.parentElement, sw = v.videoWidth, sh = v.videoHeight;
      if (!c || !box || !sw || !sh) return;
      var ar = (c.w * sw) / (c.h * sh), st = v.style;
      if (v.controls) {
        var vw = Math.min(sw, sh * ar), vh = vw / ar, cx = (c.x + c.w / 2) * sw, cy = (c.y + c.h / 2) * sh;
        put(st, 'aspectRatio', ar.toFixed(4)); put(st, 'objectFit', 'cover');
        put(st, 'objectPosition', (sw > vw ? within((cx - vw / 2) / (sw - vw), 0, 1) * 100 : 50).toFixed(2) + '% '
          + (sh > vh ? within((cy - vh / 2) / (sh - vh), 0, 1) * 100 : 50).toFixed(2) + '%');
        return;
      }
      if (box.classList.contains('po-card__cover')) box.style.aspectRatio = within(ar, 0.5625, 1.91).toFixed(4);
      var bw = box.clientWidth, bh = box.clientHeight;
      if (!bw || !bh) return;
      var contain = m.fit === 'contain';
      var s = contain ? Math.min(bw / (c.w * sw), bh / (c.h * sh)) : Math.max(bw / (c.w * sw), bh / (c.h * sh));
      var W = sw * s, H = sh * s, ox = bw / 2 - (c.x + c.w / 2) * W, oy = bh / 2 - (c.y + c.h / 2) * H;
      if (!contain) { ox = within(ox, bw - W, 0); oy = within(oy, bh - H, 0); }
      put(st, 'position', 'absolute'); put(st, 'objectFit', 'fill'); put(st, 'maxWidth', 'none'); put(st, 'maxHeight', 'none');
      put(st, 'right', 'auto'); put(st, 'bottom', 'auto');
      put(st, 'width', (W / bw * 100).toFixed(4) + '%'); put(st, 'height', (H / bh * 100).toFixed(4) + '%');
      put(st, 'left', (ox / bw * 100).toFixed(4) + '%'); put(st, 'top', (oy / bh * 100).toFixed(4) + '%');
      if (contain) put(st, 'clipPath', 'inset(' + (c.y * 100).toFixed(3) + '% ' + ((1 - c.x - c.w) * 100).toFixed(3) + '% '
        + ((1 - c.y - c.h) * 100).toFixed(3) + '% ' + (c.x * 100).toFixed(3) + '%)');
    }
    function start(v) {
      var t = v.__owFrame && v.__owFrame.trim;
      if (t && v.currentTime < t.start - 0.05) { try { v.currentTime = t.start; } catch (_) {} }
    }
    function apply(v, item, o) {
      if (!v || !item || !(item.crop || item.trim)) return v;
      v.__owFrame = { crop: item.crop || null, trim: item.trim || null, fit: (o && o.fit) || (item.fit || '') };
      v.__owFrameKey = key(v.getAttribute('src') || v.currentSrc);
      var go = function () { place(v); start(v); };
      /* after the card's own shape() (oneway-popit.js "THE FRAME TAKES THE MEDIA'S OWN SHAPE"), which also answers loadedmetadata */
      if (v.readyState >= 1) setTimeout(go, 0); else v.addEventListener('loadedmetadata', function () { setTimeout(go, 0); }, { once: true });
      if (!v.__owFrameRO && global.ResizeObserver && v.parentElement) {
        v.__owFrameRO = new global.ResizeObserver(function () { place(v); });
        v.__owFrameRO.observe(v.parentElement);
      }
      if (!v.__owFrameT) {
        v.__owFrameT = 1;
        v.addEventListener('timeupdate', function () {
          var t = v.__owFrame && v.__owFrame.trim;
          if (!t) return;
          if (v.currentTime >= t.end - 0.05) {
            if (v.loop) { try { v.currentTime = t.start; } catch (_) {} }
            else { try { v.pause(); v.currentTime = t.start; } catch (_) {} }
          } else if (v.currentTime < t.start - 0.3) { try { v.currentTime = t.start; } catch (_) {} }
        });
        v.addEventListener('ended', function () { var t = v.__owFrame && v.__owFrame.trim; if (t && v.loop) { try { v.currentTime = t.start; v.play(); } catch (_) {} } });
      }
      return v;
    }
    function note(media) {
      (media || []).forEach(function (m) {
        if (!m || typeof m !== 'object' || !(m.crop || m.trim)) return;
        var u = m.url || m.src || '';
        if (u && (m.kind === 'video' || /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(u))) seen[key(u)] = { crop: m.crop || null, trim: m.trim || null };
      });
    }
    /* every video that loads in a card or on a post's page is looked up by its address; a pooled player given another
       address gives the last one's frame back */
    function heard(e) {
      var v = e.target;
      if (!v || v.tagName !== 'VIDEO') return;
      var k = key(v.getAttribute('src') || v.currentSrc);
      if (v.__owFrameKey === k && v.__owFrame) return;
      if (v.__owFrameKey && v.__owFrameKey !== k) clear(v);
      var m = seen[k];
      if (!m || !v.closest || !v.closest('.po-card, .ow-post__media')) return;
      apply(v, m);
    }
    ['loadedmetadata', 'play'].forEach(function (ev) { doc.addEventListener(ev, heard, true); });
    return { note: note, apply: apply, clear: clear, frameOf: function (u) { return seen[key(u)] || null; } };
  }());
  /* A SPOT'S OWN GHOST (his word, 2026-11-07, L9: "that Rotating globe shadow state on the cards or posts that give that ghost loading state to each visual focus point that will load rather then the whole page"):
     each picture or video spot on a card is the grey of the grey cards, and once it has been on screen and waiting 160 ms it wears the one globe, turning, until its own picture comes. A cached picture never shows it;
     a spot off screen draws no globe; one that never answers lets go after 8 s of being seen. A video with a poster or no preload has nothing to wait for. */
  var spotIO = null, spotMark = '';
  OW.spotGhost = function (box, media) {
    if (!box || !media || box.hasAttribute('data-spot')) return;
    var isV = media.tagName === 'VIDEO';
    if (isV ? (media.readyState >= 2 || media.poster || media.preload === 'none') : (media.complete && media.naturalWidth)) return;
    var done = false, g = null, wait = 0, off = 0;
    box.setAttribute('data-spot', '');
    function take() { if (g && g.parentNode) g.parentNode.removeChild(g); g = null; }
    function end() { if (done) return; done = true; global.clearTimeout(wait); global.clearTimeout(off); take(); box.removeAttribute('data-spot'); box.__owSpot = null; if (spotIO) spotIO.unobserve(box); }
    box.__owSpot = function (on) {
      global.clearTimeout(wait);
      if (!on) { take(); return; }
      if (!off) off = global.setTimeout(end, 8000);
      wait = global.setTimeout(function () {
        if (done || g || !OW.globe) return;
        if (!spotMark) spotMark = OW.globe({ size: 44 }).outerHTML;
        g = doc.createElement('i'); g.className = 'ow-spot'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = spotMark; box.appendChild(g);
      }, 160);
    };
    ['load', 'loadeddata', 'canplay', 'error'].forEach(function (ev) { media.addEventListener(ev, end, { once: true }); });
    if (!global.IntersectionObserver) { box.__owSpot(true); return; }
    if (!spotIO) spotIO = new global.IntersectionObserver(function (es) { es.forEach(function (e) { if (e.target.__owSpot) e.target.__owSpot(e.isIntersecting); }); });
    spotIO.observe(box);
  };
  // Warm nearby card media before native lazy loading waits for a skipped card to paint.
  /* SIX SCREENS AHEAD (the founder, 2026-11-09: "the post pops in"): a fast fling crosses two screens in a third of a second, and a
     picture fetched and decoded two screens ahead finished loading on screen 14 times in 100 posts at 390, four ahead 3 times
     (tools/probe/feed-fling-walk.cjs) */
  var MEDIA_AHEAD_SCREENS=6;
  var mediaAheadObserver=null,mediaAheadFallback=0;
  OW.mediaAhead=function(card){
    function warm(){
      var near=card.getBoundingClientRect(),visible=near.top<global.innerHeight&&near.bottom>0;
      Array.prototype.forEach.call(card.querySelectorAll('.po-card__cover > img,.po-shot:first-child > img,.po-card__who img'),function(img){
        img.loading='eager';img.decoding='async';if(visible)img.fetchPriority='high';
      });
    }
    if(!global.IntersectionObserver){if(mediaAheadFallback++<3)warm();return;}
    if(!mediaAheadObserver){
      var saver=global.navigator&&global.navigator.connection&&global.navigator.connection.saveData;
      mediaAheadObserver=new global.IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){if(e.target.__owWarm)e.target.__owWarm();mediaAheadObserver.unobserve(e.target);}});},{rootMargin:(saver?0:Math.max(800,global.innerHeight*MEDIA_AHEAD_SCREENS))+'px 0px'});
    }
    card.__owWarm=warm;mediaAheadObserver.observe(card);
  };

  postFace = (function (face) {
    return function (p) { if (p && p.media) OW.mediaFrame.note(p.media); return face(p); };
  }(postFace));

  /* the feed's own event vocabulary, said the way a person would. Only kinds
     the runtime actually emits appear here; an unknown kind is left unnamed. */
  var VERB = {
    gallery_created: function () { return 'posted'; },
    media_added: function (it) {
      var g = it.post || it.gallery || {};
      var n = g.media_count || (g.media || []).length || 0;
      return n ? ('added ' + n + (n === 1 ? ' piece' : ' pieces')) : 'added something';
    },
    post_created: function () { return 'posted'; }
  };

  /* HOW MANY PEOPLE, SAID THE WAY A PERSON WOULD. A name is worth more than a
     count, so the first one or two are named and the rest are a number. When
     the sample the server drew from was full it says "and others" rather than
     a figure — a truncated list must not be reported as an exact one. */
  function knownWords(k) {
    /* THE NAME, NOT THE EMAIL'S LEFT HALF: `known_likers.people` carries `{name, ref, picture}`, the name resolved
       server-side once per person per page; a plain string from an older payload still reads as its local part. */
    return knownParts(k).map(function (x) { return x.t; }).join('');
  }
  /* "Liked by <someone> and others", AS INSTAGRAM SAYS IT (founder/832). One person is named (the server puts the
     people the viewer follows first). No figure on any post: a boost is known only to who uploaded it (founder/1053), and a
     number on some posts and none on others would say which. `others` is the server's. Parts, so the name can be set
     bold while the label reads the same words. */
  function knownParts(k) {
    var who = (k.people || []).map(function (e) {
      if (e && typeof e === 'object') return String(e.name || '').trim() || String(e.email || '').split('@')[0];
      return String(e).split('@')[0];
    }).filter(Boolean);
    if (!who.length) return [];
    var out = [{ t: 'Liked by ' }, { t: who[0], b: 1 }];
    if (k.others) out.push({ t: ' and ' }, { t: 'others', b: 1 });
    return out;
  }
  function knownHTML(k) {
    var faces = (k.people || []).filter(function (p) { return p && typeof p === 'object'; }).slice(0, 3);
    var stack = faces.length
      ? '<span class="po-card__kfaces" aria-hidden="true">' + faces.map(function (p) {
          /* the one face, small (founder/1221): their picture whole, else their initials */
          return '<i' + (OW.face.picture(p) ? '' : ' data-ini="1"') + '>' + OW.face.inner(p) + '</i>';
        }).join('') + '</span>'
      : '';
    return stack + '<span>' + knownParts(k).map(function (x) {
      return x.b ? '<b>' + esc(x.t) + '</b>' : esc(x.t);
    }).join('') + '</span>';
  }

  /* WHO A POST WAS FOR, in the words a person would use. The keys are the
     runtime's; anything it sends that is not here prints itself rather than
     being swallowed, because an audience nobody can read is worse than an
     ugly one. */
  var AUDIENCE = {
    members: 'members only', member: 'members only',
    team: 'the team', staff: 'the team',
    followers: 'followers', private: 'only you', me: 'only you',
    center: 'this Center', operators: 'operators'
  };

  function suggestedHost(cid) {
    var h = doc.createElement('div');
    h.className = 'po-card ow-lchost';
    h.setAttribute('data-po-kind', 'highlight');
    if (!cid) { h.hidden = true; return h; }
    h.setAttribute('data-po-center', cid);
    var ready = OW.suggested ? Promise.resolve() : (OW.need ? OW.need(['lcard', 'livecard']) : Promise.reject(new Error('no loader')));
    ready.then(function () { OW.suggested('center', cid, h); }, function () { h.hidden = true; });
    return h;
  }
  /* ── A POST'S #TAG AND ITS PLACE ARE PRESSES (founder/1258, "discovery better work perfect for the entire platform"; the verifier: a #tag was
     plain text with no code and no route, a post's place the same) ──
     A #tag opens Discovery's one search on that tag (the sheet's grid), a place opens the map there, through the App's own addresses
     (#discovery/tag/<word>, #discovery/at/<Center>). What counts as a tag is feed/topics.py _HASHTAG's rule, so a press names what the
     server has indexed: after a space, a bracket or the start, a letter first, 2 to 40 letters, digits, _ and -, never ending on a -.
     Spans, not buttons, inside the card's button (as data-po-product); one listener here, for the App, the OS and a Center's site. */
  var TAG_RE = null;
  try { TAG_RE = new RegExp('(^|[\\s(])#(\\p{L}[\\p{L}\\p{N}_-]*)', 'gu'); } catch (e) { TAG_RE = /(^|[\s(])#([A-Za-z][\w-]*)/g; }
  OW.tagParts = function (text) {
    var s = String(text == null ? '' : text), out = [], last = 0, m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(s))) {
      var word = m[2].replace(/-+$/, ''), at = m.index + m[1].length;
      if (word.length < 2 || word.length > 40) continue;
      if (at > last) out.push({ text: s.slice(last, at) });
      out.push({ text: '#' + word, tag: word.toLowerCase() });
      last = at + 1 + word.length;
    }
    if (last < s.length) out.push({ text: s.slice(last) });
    return out;
  };
  OW.postWords = function (text) {
    return OW.tagParts(text).map(function (p) {
      return p.tag ? '<span class="po-tag" role="link" tabindex="0" data-po-tag="' + esc(p.tag) + '">' + esc(p.text) + '</span>' : esc(p.text);
    }).join('');
  };
  /* A POST'S PLACE, NAMED (founder/1258; PROPOSED for his eye: the line is back on the card). Measured: nothing on a post has named its place since
     2026-09-06, when the post contract made center_id and destination one value (contracts.py) and the old guard, destination != center_id, could
     never hold again. The rule that guard was for stands: the room, only when the room is not the author (a Center posting as itself, or a person's
     own space under their own name), and not on that Center's own page, where every post is there. */
  OW.postPlace = function (p) {
    var name = String((p && p.destination_name) || '').trim(), au = (p && p.author) || {};
    if (!name || !p.destination) return '';
    if (au.kind === 'center' || name.toLowerCase() === String(au.name || '').trim().toLowerCase()) return '';
    if (String((OW.here ? OW.here() : global.location.hash) || '') === '#center/' + encodeURIComponent(p.destination)) return '';
    return name;
  };
  /* THE PLACE IS ITS FACE AND ITS NAME, NEVER AN UNDERLINE (his walk, 2026-11-08, item 8: "rather than showing in Boardwalk with an
     underline ... the underline just makes it feel dated. Just show the center's profile picture and just let their name be clickable
     and highlight in their hues color when somebody hovers over it"; item 9: "make sure collision won't be an issue for people's fingers
     on mobile"). The Center's canonical round face (OW.face, S14) and its name; the name takes the Center's own hue only under a real
     pointer (oneway-popit.css, .po-place). `look` is { picture, hue } from the post (destination_picture, destination_hue). */
  OW.placePress = function (id, name, look) {
    look = look || {};
    var h = (typeof look.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(look.hue)[0] : '';
    return '<span class="po-place" role="link" tabindex="0" data-po-place="' + esc(id) + '" aria-label="' + esc(name) + '"' +
      (h ? ' style="--po-place-h:' + esc(h) + '"' : '') + '>' +
      OW.face({ kind: 'center', name: name, picture: look.picture || '', hue: typeof look.hue === 'number' ? look.hue : undefined }, { size: 18, cls: 'po-place__f' }) +
      '<span class="po-place__n">' + esc(name) + '</span></span>';
  };
  function intoDiscovery(el) {
    var tag = el.getAttribute('data-po-tag');
    var path = 'discovery/' + (tag ? 'tag/' + encodeURIComponent(tag) : 'at/' + encodeURIComponent(el.getAttribute('data-po-place') || ''));
    if (/^\/(app|oneway-app)/.test(global.location.pathname)) (OW.go ? OW.go('#' + path) : (global.location.hash = '#' + path));
    else global.location.href = '/app#' + path;
  }
  doc.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-po-tag],[data-po-place]');
    if (!el) return;
    e.preventDefault(); e.stopPropagation();       /* the card under it neither opens nor likes */
    intoDiscovery(el);
  }, true);
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target && e.target.matches && e.target.matches('[data-po-tag],[data-po-place]') ? e.target : null;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    intoDiscovery(el);
  }, true);

  OW.card = function (item, opts) {
    item = item || {}; opts = opts || {};
    var g = item.post ? postFace(item.post) : (item.gallery || item),
        who = item.actor || {};
    var n = doc.createElement('button');
    n.type = 'button';
    n.className = 'po-card';
    n.setAttribute('data-v', variantFor(g.id || g.title));
    n.setAttribute('data-po-id', g.id || '');

    /* the ACTOR wears their own hue — a feed is people showing you things, and
       whose thing it is must be visible at a glance (§17) */
    /* ★ FOUNDER/1041: A POST WEARS ITS AUTHOR'S OWN HUE, in Simple and in Popit, never the viewer's (OW.hue.ofPost, above):
       the person's for a person's post, the Center's for a Center speaking as itself (its author.hue is the Center's; the
       place's hue stands in only if a Center's came without one), the month's for a person who chose none, and the
       viewer's own bound pair on her own. A gallery or a person keeps the actor's own. */
    var mine = !!(g._post && ownPost(item.post));
    var pair = g._post ? hue.ofPost(item.post) : authorPair(who.hue);

    /* THE WHOLE CARD WEARS IT, not just the avatar (which inherits it from here, so a repaint reaches both).
       `.po-card__face` draws its wash, its rim and its glow from `--h`/`--h2`/`--h3`, and those default to `--ow-h1`,
       THE READER'S hue. So every card in the feed was the colour of whoever was looking at it. Setting the pair here is
       what turns the feed into an array of the people and places in it rather than a stack of identical panels.
       `data-blended` is the closed Post Popit's material (oneway-popit.css); every Post now wears it, where it reached only
       the Posts that also carried a place's hue, so the same Post was one material to its author and another to everyone
       else. */
    if (pair) {
      wearPair(n, pair);
      if (g._post) n.setAttribute('data-blended', '1');
      if (mine) n.setAttribute('data-po-mine', '1');
    }

    var media = (g.media_count || 0), posts = (g.post_count || 0);
    /* A SUGGESTED CENTER IS THE LANDING'S CARD (the founder, 2026-10-21, his Home at 1366: "instead of our beautiful cards
       on the landing we made on both simple and popit with interactions we load these? what the heck man!"). The flat
       box this drew (the renderer's simple row inside a feed card) is gone: the card is OW.lcard, alive
       (frontend/shared/oneway-livecard.js), in a host that keeps the feed's one-card-per-row count. */
    if (g._highlight) return suggestedHost(g._center);
    var counted = [];
    if (g._post) {
      /* WHERE IT WAS LIT, in the slot the counts use. A post's place is the
         point of it — "in Food & Dining" is what makes it a post to a Center
         rather than a note to nobody. Absent when the runtime cannot name the
         place, never an id. */
      if (g._imported) counted.push(g._imported);
      if (g._from) counted.push(g._from);
      if (g._via) counted.push(g._via);
    } else {
      if (media) counted.push(media + (media === 1 ? ' photo' : ' pieces'));
      if (posts) counted.push(posts + (posts === 1 ? ' post' : ' posts'));
    }

    /* A COVER THAT FAILS TO LOAD MUST NOT LEAVE A BROKEN ICON. Dead CDN links,
       expired signed URLs and truncated fields are ordinary in production (the
       runtime silently truncates this field at 1000 chars today), so the image
       removes itself on error and the hue-derived environmental treatment
       underneath becomes the cover. Degrading to the honest fallback beats
       showing a torn-page glyph over someone's gallery. */
    var coverSrc = OW.imageUrl(g.cover);
    /* ── THE BOX TAKES THE SHAPE OF THE PICTURE ──────────────────────────
       ★ FOUNDER, 2026-09-09: *"Popits could be better shaped around text and
         images."*

       Every cover was `aspect-ratio:4/5` with `object-fit:cover`, so a 16:9
       landscape, a square and a 3:1 panorama were all cropped into the same
       portrait box — the photograph reshaped to fit the card instead of the
       card shaped around the photograph.

       IT COMES FROM THE STORED DIMENSIONS, NOT FROM THE LOADED IMAGE. Reading
       `naturalWidth` means waiting for the bytes and then resizing, which is
       layout shift — the thing `content-visibility` and the intrinsic-size
       estimates exist to prevent. `POST /api/oneway/media` now records width
       and height at upload, so the shape is known before a single byte of the
       image is fetched and the box is right on the first frame.

       CLAMPED, BECAUSE A CARD IS STILL A CARD. A 3:1 panorama at its true
       ratio is a 110px sliver nobody can see, and a tall portrait at its true
       ratio pushes every other post off the screen. The range is 4:5 (the
       shape it always used, now the TALLEST rather than the only one) to
       1.91:1 — the same landscape floor Instagram settled on, for the same
       reason. Inside that range the picture is uncropped; outside it, the
       clamp crops, and `object-fit:cover` still does that part honestly.

       ABSENT DIMENSIONS CHANGE NOTHING. Older rows, and every video, carry
       null — so they fall through to the 4:5 the stylesheet has always
       applied. */
    var coverAR = '';
    (function () {
      /* THE POST IS WRAPPED. `riverRows` hands the card `{post, at, actor,
         interactions}` and the renderer keeps the original as `g._post` — the
         line forty below already reads it. My first version asked `g.media`,
         which is undefined on a feed row, so the variable was never set and the
         box kept its 4:5 while looking entirely correct in the diff. */
      /* `_media` IS WHERE THE ORDERED ITEMS LIVE. `postFace` normalises a Post
         into the card's face and keeps the full array as `_media` — `cover` is
         only the first URL, and `_post` is a BOOLEAN FLAG, not the post.

         I got this wrong three times in a row: `g.media` (undefined on a feed
         row), then `g._post.media` (a boolean has no media), then all three at
         once. Every version set nothing and left the 4:5 in place, and every
         version read correctly in the diff — which is what a wrong field name
         always does. The fix each time was to print the object rather than
         reason about it. */
      var m0 = (g._media && g._media[0]) ||
               ((g.media && g.media.length) ? g.media[0] : null);
      var w = m0 && +m0.width, h = m0 && +m0.height;
      if (!w || !h || !isFinite(w) || !isFinite(h)) return;
      var r = Math.min(1.91, Math.max(0.5625, w / h));
      /* A PICTURE PAST THE BOUNDS IS SHOWN WHOLE inside them (founder/1193: the editor keeps a panorama's own shape, so the card must not
         cut what the person kept): the card stops at 1.91:1 or 9:16 and the picture sits whole in it on the card's ground. PROPOSED for
         his eye: Instagram never lets a post past 1.91:1, so there is no reference card for it. */
      /* --po-w: its own width, so a desktop never draws it wider than its pixels (oneway-popit.css, "THE WHOLE POST IN ONE WINDOW") */
      coverAR = ' style="--po-ar:' + r.toFixed(4) + ';--po-w:' + Math.round(w) + 'px"' + (Math.abs(r / (w / h) - 1) > 0.004 ? ' data-whole' : '');
    }());
    /* A VIDEO COVER IS NOT AN IMAGE, AND RENDERING IT AS ONE PAINTED THE BLACK
       BOX. The first media item becomes the Gallery's cover, the runtime
       accepts MP4/MOV/WebM (`_sniff_media`), so the first thing anyone films
       arrives here as `cover: "….mp4"` — loaded into an <img>, which fails,
       fires its onerror (OW.imgFail), and leaves the bare cover ground: a
       4:3 near-black slab where the person's video should be. Video only ever
       played in IMMERSIVE mode, where `OW.media` pools real players; the
       standard feed had no video path at all.
       ITS POSTER IS ITS OWN FIRST FRAME (research unit C1, 2026-10-31): the
       upload keeps the picture the App drew from the clip (OW.videoStill) or the
       platform an import came from made, never an invented one (Law 15), and the
       card paints it before the clip's first byte; with none, `preload="metadata"`
       paints the first frame once it arrives, as before. */
    var isVid = /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(coverSrc || '');
    /* ── A POST THAT PLAYS IN ITS PLATFORM'S OWN PLAYER (founder/1139) ─────────────────────────────────────────────────
       Its light card (our own copy of the cover, the platform's mark) stands where a photo would, shaped as the player is;
       the player itself is made by OW.embed only once the card is in view (frontend/shared/oneway-links.js). A page without
       the helper draws the cover alone, never an empty frame. */
    var embedFace = (g._embed && !(g._media && g._media.length) && OW.embed) ? OW.embed.face(g._embed) : '';
    if (g._embed && !(g._media && g._media.length)) {
      if (!coverSrc && g._embed.cover) coverSrc = OW.imageUrl(g._embed.cover);
      var ear = +g._embed.aspect;
      /* --fa: a platform's player keeps its own shape on a desktop too (oneway-surface.css, "THE WHOLE POST IN ONE WINDOW" cuts a photo to 4:5) */
      if (ear > 0 && isFinite(ear)) coverAR = ' style="--po-ar:' + Math.min(1.91, Math.max(0.5625, ear)).toFixed(4) + ';--fa:var(--po-ar)"';
      if (embedFace) { isVid = false; if (!coverSrc) coverSrc = 'embed'; }
    }

    /* ── MORE THAN ONE PIECE IS A STRIP, NOT A STACK ──────────────────────
       ★ FOUNDER: *"Horizontal swiping changes the media item and therefore its
         associated caption."*

       Built from the SAME `.po-card` — there is no carousel component and no
       second renderer, because a multi-photo Post is not a different kind of
       Post. The strip is a horizontal CSS snap scroller for exactly the reason
       the vertical feed is: the platform's own scroller is the only thing that
       feels native under a thumb, and this way a sideways swipe is handled by
       the compositor while a vertical one still pages the feed.

       PER-ITEM CAPTIONS ARE OPTIONAL (founder: *"not mandatory"* for native
       Posts). A strip whose items carry none renders no caption line at all
       rather than an empty bar. */
    /* A PHOTO'S SIZES (CP-02, 2026-10-19): the upload writes WebP at the widths narrower than the photo
       (api/media/sizes.py) and the item carries them; the browser takes the one its screen needs, and the
       original stays the widest choice and the fallback. */
    /* THE PHOTO AS SENT IS NEVER A CHOICE WHEN ITS OWN WIDTH IS THERE IN WEBP (feed speed, 2026-11-10: "I need speed big time"): the upload
       also writes the photo's own width (media/sizes.py), so the JPEG as sent (265 to 750 KB measured) is listed only for a photo stored
       before that, and only when it is wider than every size. `sizes` is the card's own room: the screen's width on a phone, at most
       MEDIA_MAX_PX beside the window on a desktop (oneway-popit.css, "THE WHOLE POST IN ONE WINDOW"). */
    var srcsetOf = function (sizes, orig, ow) {
      if (!sizes || !sizes.length) return '';
      var set = [], k, widest = 0;
      for (k = 0; k < sizes.length; k++) {
        var su = OW.imageUrl((sizes[k] || {}).url || '');
        if (su && sizes[k].w) { set.push(su + ' ' + sizes[k].w + 'w'); widest = Math.max(widest, +sizes[k].w); }
      }
      if (ow && orig && ow > widest) set.push(orig + ' ' + ow + 'w');
      return set.length ? ' srcset="' + esc(set.join(', ')) + '" sizes="(max-width: 660px) 100vw, ' + MEDIA_MAX_PX + 'px"' : '';
    };
    var shots = (g._media && g._media.length > 1) ? g._media : null;
    var shotsHTML = '';
    if (shots) {
      var anyCap = false, i2;
      for (i2 = 0; i2 < shots.length; i2++) {
        if ((shots[i2] || {}).caption) { anyCap = true; break; }
      }
      var cells = '';
      for (i2 = 0; i2 < shots.length; i2++) {
        var it = shots[i2] || {};
        var u = OW.imageUrl(it.url || it.src || '');
        if (!u) continue;
        var vid = (it.kind === 'video') || /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(u);
        cells += '<span class="po-shot" data-i="' + i2 + '">'
          + (vid
             ? '<video src="' + esc(u) + '" muted playsinline preload="metadata"'
               + ((it.thumb || it.poster) ? ' poster="' + esc(OW.imageUrl(it.thumb || it.poster)) + '"' : '')
               + ' tabindex="-1" aria-hidden="true" onerror="this.remove()"></video>'
             : '<img src="' + esc(u) + '"' + srcsetOf(it.sizes, u, it.width) + ' alt="' + esc(it.alt || '')
               + '" loading="lazy" decoding="async" onerror="OW.imgFail(this)">')
          + '</span>';
      }
      var dots = '';
      for (i2 = 0; i2 < shots.length; i2++) {
        dots += '<i' + (i2 === 0 ? ' data-on="1"' : '') + '></i>';
      }
      shotsHTML =
        '<span class="po-shots" data-n="' + shots.length + '"'
        + ' role="group" aria-label="' + shots.length + ' pieces">' + cells + '</span>'
        + '<span class="po-shots__dots" aria-hidden="true">' + dots + '</span>'
        + (anyCap ? '<span class="po-shots__cap"></span>' : '');
    }

    var cover = shotsHTML ? shotsHTML
      : embedFace ? embedFace
      : !coverSrc ? ''
      : isVid
        /* SAME FALLBACK THE IMAGE PATH HAS. A dead reference, an expired signed
           URL or a codec this browser will not decode leaves an empty player
           sitting on the cover ground — which is the black rectangle again, by
           a slower route. Removing it lets the hue treatment underneath be the
           cover, exactly as a broken <img> already does. */
        ? '<video src="' + esc(coverSrc) + '" muted playsinline preload="metadata"'
          + (g._coverPoster ? ' poster="' + esc(OW.imageUrl(g._coverPoster)) + '"' : '')
          + ' tabindex="-1" aria-hidden="true" onerror="this.remove()"></video>'
        : '<img src="' + esc(coverSrc) + '"' + srcsetOf(g._coverSizes, coverSrc, g._coverWidth)
          + ' alt="" loading="lazy" decoding="async" onerror="OW.imgFail(this)">';
    /* an empty Gallery is honest about being empty rather than being dressed
       up as a picture — nothing is ever invented to fill a frame (Law 15).
       It is a QUIET LINE now, not a photo-shaped hole: see the `[data-empty]`
       rule in oneway-popit.css. */
    /* ── EMPTY MEANS "NOTHING WILL RENDER", NOT "THE COUNTER SAYS ZERO" ────
       This asked `media_count`, and a Gallery whose count is 3 while none of
       its pieces resolves to a URL therefore did NOT get the collapsed band —
       it got the full 4:3 reservation with nothing in it, which is the
       screen-wide black rectangle the founder ruled out by name, arriving by a
       second route.

       MEASURED 2026-08-29, and it was also corrupting the Scroll composition:
       such a card measured 406px in the composer's pen and 131px once the
       browser had finished with it, so the packer sized a whole page against a
       void and stopped four Popits in. A stale counter was deciding a layout.

       The test is now what the markup will actually paint: no cover element
       and no strip. A count cannot make a picture appear (Law 15). */
    var emptyNote = (!cover) ? ' data-empty="nothing in it yet"' : '';

    /* THE BODY, built once so it can sit above or below the media (470). A
       POST IS ITS BODY: forcing "Untitled" onto a post that simply has no
       headline would put a placeholder where the person's own words belong —
       a Gallery still gets the fallback, because a Gallery is a named thing. */
    /* A POST'S WORDS: its #tags are presses (OW.postWords); anything else a card carries stays plain words */
    var saidHTML = function (s) { return g._post ? OW.postWords(s) : esc(s); };
    var bodyHTML =
      '<span class="po-card__body">' +
        (g._post
          ? (g.title ? '<span class="po-card__t">' + saidHTML(g.title) + '</span>' : '')
          : '<span class="po-card__t">' + esc(g.title || 'Untitled') + '</span>') +
        (g.description ? '<span class="po-card__d">' + saidHTML(g.description) + '</span>' : '') +
      '</span>';
    /* WHAT THE POST SELLS (commerce SHOP-2), under its words: the Center page's own thing row (its picture, its
       name, its price) and the one-source button. Pressing the row opens the product; Buy opens the Center's own
       checkout. Spans, not buttons, inside the card's button; both are claimed by their own listeners below. */
    var prod = g._product;
    var prodPic = prod && prod.pictures && prod.pictures[0] && prod.pictures[0].url;
    var prodLine = prod ? (OW.priceWords(prod) + (prod.available === false ? ' · Sold out' : '')) : '';
    var productHTML = prod
      ? '<span class="ow-cpage__ev po-card__product" data-po-product="' + esc(prod.id) + '"'
        + (prodPic ? ' data-pic="1"' : '') + ' role="button" tabindex="0"'
        + ' aria-label="' + esc(prod.name + (prodLine ? ', ' + prodLine : '')) + '">'
        + (prodPic ? '<img class="ow-cpage__pic" src="' + esc(OW.imageUrl ? OW.imageUrl(prodPic) : prodPic)
                     + '" alt="" loading="lazy" decoding="async">' : '')
        + '<span class="ow-cpage__t"><b>' + esc(prod.name) + '</b>' + (prodLine ? '<span>' + esc(prodLine) + '</span>' : '')
        + '</span>'
        + (OW.canBuy(prod) ? '<span class="ow-popit-btn po-card__buy" data-po-buy role="link" tabindex="0">Buy</span>' : '')
        + '</span>'
      : (g._productGone
        ? '<span class="ow-cpage__ev po-card__product" data-po-product-gone><span class="ow-cpage__t"><b>'
          + esc(g._productGone) + '</b><span>No longer sold here</span></span></span>'
        : '');
    /* a reel: the cover is a video, or the first piece of a strip is */
    var capAbove = !!(cover && (isVid || (embedFace && +g._embed.aspect < 1) || (shots && shots[0] &&
      ((shots[0].kind === 'video') || /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(String(shots[0].url || shots[0].src || ''))))));
    /* A PHOTO'S CAPTION COMES AFTER WHO LIKED IT (founder/832: "leave space under the interactions for it to say liked
       by the mutuals and then also have the caption on photos"): the picture, the icons, the liked-by line, then the
       words, led by the author's name as Instagram sets a caption. A reel keeps its words above (founder/470) and a
       post of words alone keeps them on top, where they are the post; the order under the icons is the same. */
    var capBelow = !capAbove && !!coverSrc && !!(g.description || g.title);
    var captionHTML = capBelow
      ? '<span class="po-card__body po-card__body--cap">' +
          (g.title && g._post ? '<span class="po-card__t">' + saidHTML(g.title) + '</span>' : '') +
          (g.description || (!g._post && g.title)
            ? '<span class="po-card__d"><b class="po-card__capby">' + esc(who.name || '') + '</b> '
              + saidHTML(g.description || g.title) + '</span>'
            : '') +
        '</span>'
      : '';
    /* ★ FOUNDER/470: *"platform icon should appear in top right corner of
       post depending on native platform it was posted from."* The row says
       where a piece came from (`media[].source` / `origin` / `origin_url`,
       B's import model); a Post made here carries ONEWAY's own mark. Drawn
       as the platform's own glyph (447), never a label. */
    /* ★ FOUNDER/471 §9: *"make the icon around the same size or slightly
       smaller then the profile pic and if a post is uploaded in multiple
       areas have multiple icons."* EVERY platform the Post is known to have
       come from, one mark each: the Post's own `sources[]` when B's import
       records several, its `provenance.source`, and every media item's
       `source` / `origin` / the host of its `origin_url` (the contract is
       per item, because one Post can carry pieces from two places). The same
       platform twice is one mark. Nothing known → ONEWAY's own globe. */
    var fromKeys = (function () {
      var seen = {}, out = [];
      function add(raw, url) {
        raw = String(raw || '').toLowerCase().trim();
        if (!raw && url && OW.links && OW.links.platformOf) {
          var p = OW.links.platformOf(url); raw = (p && p.key !== 'web') ? p.key : '';
        }
        if (raw === 'twitter') raw = 'x';
        if (!raw || raw === 'oneway' || raw === 'native' || raw === 'lightbulb' || raw === 'source_unrecorded') return;
        if (raw === 'captured' || raw === 'created' || raw === 'uploaded' || raw === 'imported') return;   /* how, not where */
        /* a Post row's own `source` is the ACCOUNT's provenance (oneway/provenance.py:
           real · fixture · synthetic · test · unknown) — never a platform */
        if (raw === 'real' || raw === 'fixture' || raw === 'synthetic' || raw === 'test' || raw === 'unknown') return;
        if (!seen[raw]) { seen[raw] = 1; out.push(raw); }
      }
      (g.sources || g.platforms || []).forEach(function (x) { add(typeof x === 'string' ? x : (x && (x.key || x.source || x.platform)), x && x.url); });
      add(g.platform, g.origin_url);
      if (g.provenance) add(g.provenance.source, g.provenance.origin_url);
      var items = (g._media && g._media.length) ? g._media : (g.media || []);
      items.forEach(function (m) { if (m) add(m.source || m.origin, m.origin_url); });
      return out;
    }());
    /* ★ FOUNDER/475: *"the globe icon should always be there if it's
       obviously posted to one way"* — a Post in this feed is on ONEWAY, so
       the globe leads and *"always keep the icons small on the post"*: 18px. 476: the globe is drawn white, in the page's ink, like every
       mark beside it. */
    /* ★ FOUNDER/1307: *"THE SOCIAL ICONS R STILL STACKED ... THEY CLICK SOCIAL ICON TO BE TAIEN TO ORGIJAL POST"*, and 1245: *"should never
       stack"*: ONE mark on a card. A post that came from a platform wears that platform's, and pressing it opens the original there
       (OW.embed's press, oneway-links.js); any other post the globe (475). Over a live player the player's own mark is the one, so
       this one steps aside (1235: no duplicate; oneway-popit.css). */
    var oneKey = (embedFace && g._embed.provider) || fromKeys[0] || 'oneway';
    var oneTo = oneKey === 'oneway' ? '' : (embedFace ? OW.embed.watch(g._embed) : (/^https:\/\//.test(g._origin || '') ? g._origin : ''));
    var oneHue = (OW.links && OW.links.hueOf) ? OW.links.hueOf(oneKey) : '';
    var oneName = oneKey === 'oneway' ? 'Oneway' : (embedFace ? OW.embed.table.players[oneKey].label : oneKey);
    var fromHTML = '<span class="po-card__from"><i class="po-card__from__i" data-platform="' + esc(oneKey) + '"'
      + (oneHue ? ' style="--mk:' + esc(oneHue) + '"' : '')
      + (oneTo ? ' data-ow-orig="' + esc(oneTo) + '" role="link" tabindex="0" aria-label="See the original on ' + esc(oneName) + '"' : ' aria-label="' + esc(oneName) + '"') + '>'
      + (OW.links && OW.links.icon ? OW.links.icon(oneKey) : '') + '</i></span>';
    /* THE ORIGINAL, SAID SMALL (his words, 2026-11-10: "no big deal on Instagram button. That's kind of the whole point of the social icon
       being in the top right, dude, unless that button is needed. But make it as small as possible."). The mark above is the link. Where
       the platform's own player is not drawn (it refused, or it is never framed, as X) the post still names where it is from and links to
       it, as its terms ask: one small line under the words, shown only then (oneway-popit.css, "THE MARK IS THE LINK"), never a button
       over the picture. */
    var origWho = embedFace && g._embed.author && g._embed.author.handle ? '@' + String(g._embed.author.handle).replace(/^@/, '').slice(0, 60) : '';
    var origHTML = (embedFace && oneTo)
      ? '<a class="ow-orig" hidden href="' + esc(oneTo) + '" data-ow-orig="' + esc(oneTo) + '" target="_blank" rel="noopener noreferrer">'
        + esc((OW.embed.table.players[oneKey].verb || 'View') + ' on ' + oneName + (origWho ? ' · ' + origWho : '')) + '</a>'
      : '';
    if (g._post && !coverSrc) n.setAttribute('data-text', '1');   /* a text Post: the words are the card (470) */

    n.innerHTML =
      '<span class="po-card__face"></span>' +
      fromHTML +
      /* WHOSE THING THIS IS, AND YOU CAN GO TO THEM.
         (founder, 2026-08-17: "If I click somebody's icon, it doesn't even open
         to their profile. Like, this shit's totally not working.")

         The avatar and the name were plain <span>s inside the card, so a tap on
         a person's face fell through to the card's own handler and opened THE
         POST — the one thing a person clicking a face is certainly not asking
         for. A feed is people showing you things; the person is the first thing
         on the row and was the only thing on it that led nowhere.

         `data-po-who` carries the actor's email, which `/api/me/feed/posts`
         has been sending all along. NOT a nested <button>: `.po-card` is itself
         a button, and a button inside a button is invalid markup and unusable
         with a keyboard — so the card's existing handler intercepts it, exactly
         the way the response controls already do. */
      /* A CENTER IS SOMEBODY TOO, AND ITS FACE LED NOWHERE.
         `data-po-who` carries an EMAIL, and the first cut of this fix guarded
         on `who.email` — so it reached people and silently skipped every Center.
         Measured 2026-08-17 against the live feed: every `gallery_created` and
         `media_added` row has `actor.kind === "center"` and `actor.email === ""`,
         because a Center has no email and saying otherwise would be a lie. So
         the founder's *"if I click somebody's icon, it doesn't even open to
         their profile"* was fixed for the minority of rows and left broken for
         the majority — the same complaint, one class of actor over.

         The actor carries `id` in both cases. A person opens by email, a Center
         opens by id, and `ow:enter-center` is the route that already exists for
         the second. Two attributes, one gesture. */
      /* ── IT IS A CONTROL, SO IT SAYS SO ──────────────────────────────────
         ★ FOUNDER, 2026-08-31 (founder/347, P0 — Interaction reliability):
           every control needs *"keyboard access"*.

         This is a <span> that opens a person or a Center on click, and until
         now it carried neither a role nor a tabindex — so it was invisible to
         the Tab key, announced as text by a screen reader, and unreachable by
         anyone using a switch device. Found by `tools/probe/controls.js` on
         seven chips across one screen of Home; not found by any human, because
         it looks and behaves correctly with a mouse.

         `role="button"` + `tabindex="0"` is the whole fix. The Enter/Space
         handling lives with the existing delegated click handler rather than
         here, so there is still ONE path that opens a person (founder/346 §39:
         build the primitive, not the exception). A bare `<button>` would have
         been cleaner still, but this span carries the avatar, the note bubble
         and the name — nesting that inside a button is invalid markup and
         breaks the note's positioning. */
      /* ── WHAT THE AUTHOR IS DECIDES WHERE THE TAP GOES ─────────────────
         `who.email` used to be tested FIRST, so a CENTER that has an address
         routed to a person. Measured 2026-09-04 in the first-hour walk: a Post
         by `{name: "Caesars Atlantic City", kind: "center", email:
         "seed@oneway.center"}` rendered the Center's name, and tapping it
         opened `#center/@seed@oneway.center` — the seeding account's empty
         profile. Every Center-authored Post on the platform did this.

         `kind` is what the row actually says the author IS, so it is asked
         first and the address is only a person's address.

         AND THE CENTER'S REF IS `destination` WHEN THE AUTHOR CARRIES NO ID.
         The author object has a name, a kind and an email — never an `id` — so
         the old `who.kind === 'center' && who.id` branch could not have fired
         either. The Post already names where it lives (`caesars`,
         `gordonramsay`), which is the same Center. A Center with neither is not
         made tappable, because a control that cannot arrive anywhere is worse
         than plain text. */
      '<span class="po-card__who"' +
          (function () {
            var cref = (who.kind === 'center' || who.kind === 'community')
              ? (who.id || item.destination || (item.post && item.post.destination) || '')
              : '';
            if (cref) {
              return ' data-po-center="' + esc(cref) + '"' +
                     ' role="button" tabindex="0"' +
                     ' aria-label="Open ' + esc(who.name || 'this Center') + '"' +
                     ' title="' + esc(who.name || '') + '"';
            }
            /* BY @handle (2026-10-02): a person's address is no longer sent
               about anybody but you; `ref` names them, and every person door
               accepts it (people/refs.py). Your own rows may still carry it. */
            var pref = who.kind !== 'center' ? (who.ref || who.email || '') : '';
            if (pref) {
              return ' data-po-who="' + esc(pref) + '"' +
                     ' role="button" tabindex="0"' +
                     ' aria-label="Open ' + esc(who.name || 'this person') + '"' +
                     ' title="' + esc(who.name || '') + '"';
            }
            return '';
          })() + '>' +
        /* THE NOTE IS DRAWN IN THE NAME'S OWN BLOCK BELOW, to the right of the
           name (founder/1261; above it from founder/878), so a person with no
           note costs this row nothing. */
        '<span class="po-card__av" data-kind="' + esc(/^(user|profile|)$/.test(String(who.kind || '')) ? 'person' : who.kind) + '"' +
          /* the author's own cut, when they chose one (founder/409) */
          (/^(round|rounded|square)$/.test(String(who.shape || '')) ? ' data-shape="' + esc(who.shape) + '"' : '') +
          ' data-ini="' + esc(OW.initials(who.name)) + '">' +
          /* ★ FOUNDER/495: a person with no picture is an OUTLINE OF A
             PERSON, not their initials. A Center keeps a monogram — it is an
             organisation and "FC" is a mark somebody could actually have —
             but a person is a person. One drawing, `OW.faceMark`. */
          /* THE ONE FACE (founder/1221): the author's one picture, `picture`, drawn whole; no picture, their initials */
          OW.face.inner(who, { letters: 'i' }) +
        '</span>' +
        /* ── THE AUTHOR'S NAME WEARS THE FACE THEY CHOSE ──────────────────
           ★ FOUNDER, 2026-09-10: *"custom wordmarks on peoples profiles and
             POSTS like apple music now does."*

           `who.wordmark` arrives RESOLVED — {key, label, stack, weight} — and
           is ABSENT for somebody who has chosen nothing, so this card draws
           its own face in that case rather than being handed a default it
           cannot tell from a choice. The stack always ends in a system face,
           so a card exported or rendered where the webfont cannot load still
           sets in something chosen. Size and weight of the row do not move:
           only the FACE changes, or a person with a wordmark would have a
           taller card than a person without one. */
        '<span class="po-card__n"><span class="po-card__nm'
          + (who.wordmark && who.wordmark.stack ? ' ow-wm' : '') + '"'
          + (who.wordmark && who.wordmark.stack
             ? ' style="--wm:' + esc(who.wordmark.stack)
               + ';--wm-w:' + esc(String(who.wordmark.weight || 700)) + '"'
             : '')
          + '>' + esc(who.name || '') + '</span>' +
        /* THE NOTE IS TO THE RIGHT OF THE NAME (founder/1261, 2026-11-04: "the note should go to the right of user name so it
           does not stretch the post bubble"; it was above the name since founder/878): after the name, on the name's line, so a
           card whose author has a note is exactly as tall as one without */
        OW.noteHTML(who.note, 'sm') +
        '<span class="po-card__when">' + esc(OW.when(item.at)) +
          /* WHERE IT WAS LIT, a press into the map there (founder/1258; OW.postPlace, PROPOSED: on the line the time is on, as the post page says it; the foot's
             slot for it is hidden on a feed card) */
          (g._post && g._place && g._placeId ? ' · ' + OW.placePress(g._placeId, g._place, { picture: g._placePic, hue: g._hue }) : '') +
          /* ── WHAT ACTUALLY HAPPENED, WHICH THE FEED HAS ALWAYS KNOWN ──────
             Home is an ACTIVITY stream by design: a gallery made on Monday and
             photographs added to it on Wednesday are TWO things that happened,
             and the runtime says which is which — every row carries `kind`
             (`gallery_created` · `media_added`). The card rendered neither.

             So two events on one gallery came out as two IDENTICAL cards, and
             an identical card repeated does not read as history, it reads as a
             bug — which is exactly how it was reported. Nothing was duplicated;
             the surface simply refused to say what each row was.

             The verb goes beside the time, where a person reads "when" anyway.
             A row whose kind we do not recognise says nothing rather than
             guessing — an activity feed that invents the activity is worse than
             one that stays quiet about it. */
          (VERB[item.kind] ? ' · ' + esc(VERB[item.kind](item)) : '') +
          /* ── THREE FACTS A POST CARRIES AND NO CARD EVER SAID ──────────
             `audience`, `state` + `publish_at`, and `edited_at`/`edit_count`
             are on every canonical Post and none of them was drawn.

             · WHO CAN SEE IT. A Post to members only looked exactly like a
               Post to everyone, so the author had no way to tell — from the
               thing itself — which of the two they had just made. Only a
               narrowed audience is marked: "everyone" is the default and
               saying it on every card would be noise.
             · WHEN IT GOES. A scheduled Post appeared as though it were
               already out. It says when instead.
             · THAT IT WAS EDITED. The word, never the history: a reader is
               owed the fact, and the revisions belong to the author. */
          (function () {
            var st = String(g.state || '').toLowerCase();
            var bits = [];
            var aud = String(g.audience || '').toLowerCase();
            if (aud && aud !== 'everyone' && aud !== 'public') {
              bits.push(AUDIENCE[aud] || aud.replace(/_/g, ' '));
            }
            if (st === 'scheduled') {
              bits.push(g.publish_at ? ('goes ' + OW.when(g.publish_at)) : 'scheduled');
            } else if (st === 'archived') {
              bits.push('archived');
            }
            if (g.edited_at || (g.edit_count || 0) > 0) bits.push('edited');
            return bits.length ? (' · ' + esc(bits.join(' · '))) : '';
          })() +
        '</span></span>' +
      '</span>' +
      /* A TRENDING POST SAYS SO (founder/1261): "#N in Trending", blue, N the server's rank (OW.trending, oneway-cards.js;
         api/oneway/map/trending.py); nothing for a post the board does not rank */
      (OW.trending ? OW.trending.chip(g) : '') +
      /* A TEXT POST HAS NO PICTURE, AND THAT IS NOT AN ABSENCE.
         The empty-cover treatment says "nothing in it yet", which is true and
         useful for a GALLERY — a gallery is a container someone has not filled.
         A post of one sentence is COMPLETE. Rendering it with a screen-height
         empty frame dressed the person's words as a missing image, which is
         the same defect Law 15 names from the other direction. So a post
         without media simply has no media block, and its words are the card. */
      /* ★ FOUNDER/470: *"reels should appear with the captions above no
         matter the platform."* A vertical video's words go BEFORE the video;
         a photo's stay under it, where every feed puts them. */
      (capAbove ? bodyHTML : '') +
      ((g._post && !coverSrc) ? '' :
      /* THE RAIL SLOT IS GONE (founder/485). The responses live in the foot's
         row on every card; the Scroll's media page shapes that row into the
         TikTok rail with CSS. A second slot here was a second set of the
         same controls — and, on Home, a rail over the photograph. */
      '<span class="po-card__media"><span class="po-card__cover' + (shotsHTML ? ' ow-shotsbox' : '') + '"' + emptyNote + coverAR + '>' + cover + '</span></span>') +
      (capAbove || capBelow ? '' : bodyHTML) +
      productHTML +
      /* ── SOCIAL PROOF, WHERE A PERSON LOOKS FOR IT ─────────────────────
         ★ FOUNDER, 2026-08-29: *"no where to see if other users the user knows
           have liked this post."*
         NAMES, not a number: "3 people" tells you nothing, "Will" tells you
         why it is on your screen.

         ── UNDER THE WORDS, AND IT OPENS ────────────────────────────────
         ★ FOUNDER/488, 2026-09-21: *"put the like by under the bio and make
           it clickable with lists, putting users the user follows or is
           friends iwth first."*

         IT WAS ABOVE THE WORDS. The comment above claimed "under the words"
         and the code placed it BEFORE `bodyHTML` — so on every card the line
         "Liked by ada.ops" sat between the author and the sentence it was
         about, and a person read the social proof before the Post. Measured
         2026-09-21 on Home. The claim and the code now agree.

         AND IT IS A BUTTON. The sentence names one or two people and then
         stops; the list behind it is
         `GET /api/oneway/social/posts/{id}/likers`, which ranks the people
         this viewer follows first (see `service.likers_of_post`). It was a
         dead line of text on the one card element people actually want to
         press. `data-po-likers` is claimed by the App's one feed listener,
         beside the comment and repost controls. */
      '<span class="po-card__foot">' +
        '<span class="po-acts" data-po-responses></span>' +
        (counted.length ? '<span class="po-card__count">' + esc(counted.join(' · ')) + '</span>' : '') +
      '</span>' +
      /* UNDER THE ICONS (the founder, 2026-10-10: "like messages and other interaction messages need to display under
         the interactions of a post without creating a stupid amount of deadspace for them"). It sat between the words
         and the icons; the foot gives up its bottom padding when this follows (oneway-popit.css, "LIKED BY UNDER THE
         ICONS"), so the card grows by the line and nothing else. */
      (g.network_boost ? networkBoostHTML() : '') +
      (g._known && g._known.people && g._known.people.length
        ? '<button type="button" class="po-card__known" data-po-likers'
          + ' data-obj="' + esc(g.id) + '"'
          + ' aria-label="' + esc(knownWords(g._known)) + '. Open the list.">'
          + knownHTML(g._known) + '</button>'
        : '') +
      captionHTML + origHTML;


    /* THE PRODUCT ROW KEEPS ITS OWN PRESS: it opens the product, its Buy opens the checkout, and neither opens
       the Post nor likes it (OW.likeZone leaves [data-po-product] alone, so a double tap here is not a like). */
    var prodEl = prod ? n.querySelector('[data-po-product]') : null;
    if (prodEl) {
      var press = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (e.target.closest && e.target.closest('[data-po-buy]')) OW.buy(prod);
        else OW.openProduct(prod, prodEl);
      };
      prodEl.addEventListener('click', press);
      prodEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') press(e); });
      prodEl.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    }

    n._po = {
      id: g.id,
      /* ONE KIND. A post with twelve photos is a post; it was labelled
         "Gallery" purely because media arrived attached, which made media
         count into identity (founder, 2026-08-25). */
      label: g.title || (g.description || 'Post').slice(0, 60),
      kind_label: 'Post',
      glance: g.description || '',
      image: g.cover ? { url: g.cover, source: 'the post’s own cover' } : null,
      time_back: [], time_forward: []
    };
    /* ── AN IMAGE THAT LOADS IS NOT AUTOMATICALLY A PICTURE ──────────────
       (founder, 2026-08-16: galleries "with a black box, a concept we need to
       lighten up on" — this was the last route to that box.)

       `onerror` catches a cover that FAILS. It cannot catch one that SUCCEEDS
       and carries no picture. Measured on Home: a 1x1 probe upload loads
       perfectly, reports `complete`, and is stretched across a 350px 4:3 frame
       as one flat colour — a full-width black slab, which is exactly the thing
       the founder named and which every existing guard passed straight over.

       Below ~32px on a side there is no photograph in the file: no crop, no
       subject, nothing anyone could be looking at. It is treated as ABSENT and
       the frame collapses to the quiet band the honest empty state already
       uses. Nothing is invented to replace it (Law 15) — the platform simply
       stops presenting a pixel as a photograph.

       IN JS, NOT AN `onload` ATTRIBUTE. I tried the attribute first and it
       never reached the DOM at all; inline handlers are also the first thing a
       Content-Security-Policy removes, so the guard would have died silently in
       production while passing locally. AND `complete` IS CHECKED IMMEDIATELY,
       because a cached image finishes before any handler is attached and never
       fires `load` — which is the common case on a second visit, i.e. exactly
       when a person is most likely to see it. */
    [].forEach.call(n.querySelectorAll('.po-card__cover > img,.po-card__cover > video,.po-shot > img,.po-shot > video'), function (m) { OW.spotGhost(m.parentNode, m); });
    (function () {
      var box = n.querySelector('.po-card__cover');
      var im = box && box.querySelector('img');
      var vd = box && box.querySelector('video');
      if (!box || (!im && !vd)) return;
      var judge = function () {
        if (!im.naturalWidth) return;                 /* not decoded yet */
        if (im.naturalWidth >= 32 && im.naturalHeight >= 32) return;
        im.remove();
        if (!box.hasAttribute('data-empty')) box.setAttribute('data-empty', 'no picture in it yet');
      };
      /* ── THE FRAME TAKES THE MEDIA'S OWN SHAPE, CLAMPED ─────────────────
         ★ FOUNDER, 2026-08-31 (founder/358): *"correct aspect ratio · no
           accidental distortion · no unexpected cropping"* and *"Mobile media
           should use the correct 4:5 portrait geometry WHERE APPROPRIATE."*

         "Where appropriate" is doing the work in that sentence. I first made
         the frame 4:5 for EVERYTHING, which is right for a portrait source and
         wrong for every other one. Measured with real fixtures — the first
         media that could show it, because the old ones were solid colour:

             9:16 tall (0.56)    -> 4:5 frame, top and bottom CUT: the corner
                                    markers and safe border are gone
             16:9 landscape      -> 4:5 frame, both ends cut
             3:1 panorama        -> 4:5 frame, almost nothing survives
             1:1 square          -> 4:5 frame, sides cut

         INSTAGRAM DOES NOT DO THIS EITHER. It supports 4:5, 1:1 and 1.91:1 and
         takes the ratio of the media, clamping anything beyond those bounds.
         That is the spatial discipline the founder asked to copy — a Post is
         as tall as its picture wants to be, within limits a feed can live with.

         SO: ratio = clamp(source, 4:5, 1.91:1). A 4:5 portrait is unchanged. A
         square is square. A 16:9 is 16:9. A 9:16 clamps to 4:5 (a feed cannot
         give one Post the whole screen) and a 3:1 panorama clamps to 1.91:1 —
         both still cropped, but at the bound rather than arbitrarily, which is
         the difference between a decision and an accident.

         SET FROM `naturalWidth`, ON LOAD, because nothing stores the media's
         dimensions yet. That is the honest cost: the frame is 4:5 until the
         image decodes. The CSS default is the most common case so the common
         case does not move at all — and storing dimensions at upload is the
         real fix, recorded rather than pretended. */
      /* ── 9:16 IS A SHAPE A POST IS ALLOWED TO BE ───────────────────────
         ★ FOUNDER/493: *"card and photo display should appear based off the
           photo and video the card is displaying"*, and it *"should do so
           naturally."*  ★ FOUNDER/491: *"native frame for content … 9x16,
           etc."*

         THE FLOOR WAS 4:5 AND THAT WAS MY CALL, NOT HIS. The note above
         reasoned that "a feed cannot give one Post the whole screen" and
         clamped every vertical clip to 4:5 — so the one shape a phone actually
         films in was the one shape this refused. Measured on the fixtures: the
         organ clip is 1080×1440 (0.75) and was being shown at 0.8; a 9:16
         phone video (0.5625) lost a third of its height. He has now ruled on
         it twice. A vertical Post is vertical.

         1.91:1 stays as the wide bound (Instagram's, for the same reason a
         3:1 panorama is a sliver nobody can read). Between 9:16 and 1.91:1
         NOTHING is cropped — the frame is the media's own.

         AND A VIDEO IS MEASURED TOO. This only ever looked at `<img>`, so
         every clip in the feed kept the stylesheet's 4:5 no matter its real
         shape — which is precisely the "differently shaped only in certain
         areas" he is describing. `loadedmetadata` carries `videoWidth` before
         a frame is painted. */
      var RATIO_MIN = 0.5625;           /* 9:16 — the tallest a Post may be */
      var RATIO_MAX = 1.91;             /* 1.91:1 — the widest */
      var shape = function () {
        /* THE ROOM THE SERVER SAID IS THE ROOM (--po-ar, from the upload's own size): a srcset's narrower candidate rounds to a slightly different
           ratio, which moved the card by a pixel as its picture arrived (measured 2026-10-30) */
        if (im && box.style.getPropertyValue('--po-ar')) return;
        var w = im ? im.naturalWidth : vd.videoWidth;
        var h = im ? im.naturalHeight : vd.videoHeight;
        if (!w || !h) return;
        var r = Math.max(RATIO_MIN, Math.min(RATIO_MAX, w / h));
        box.style.aspectRatio = r.toFixed(4);
        if (Math.abs(r / (w / h) - 1) > 0.004) box.setAttribute('data-whole', '');   /* past the bounds: whole, never cut (founder/1193) */
      };
      if (!im) {
        if (vd.videoWidth) shape();
        else vd.addEventListener('loadedmetadata', shape, { once: true });
        return;
      }
      /* ── THE FAILURE PATH (founder/358: failed loading must be PROVEN, and "a video failure must never become a feed failure"; the founder,
         2026-10-30: a like, a send and a picture hold the page still). A picture that fails is OW.imgFail's: its one retry, then the card's own hue
         where the picture was. This collapsed the frame to a dashed band saying "this picture could not be loaded" on the FIRST error, so a blip
         on a phone took the picture away for good and pulled up to 450 px out from under the person reading (measured 2026-10-30, 250 px on a
         1.4:1 cover at 390). The frame now keeps its room, and the fact is said to a screen reader (OW.imgFail). [FOR THE FOUNDER'S EYE: he
         named a black hole in 358 and 2026-08-16; this ground is the card's hue, and a Post that never had a picture still collapses.] */
      if (im.complete && !im.naturalWidth && !im.__owAskedAgain && im.getAttribute('src')) OW.imgFail(im);    /* it failed before anyone was listening */
      else if (im.complete) { judge(); shape(); }
      else {
        im.addEventListener('load', function () { judge(); shape(); }, { once: true });
      }
    })();

    if (opts.open !== false) {
      n.addEventListener('click', function (e) {
        if (e.target.closest('[data-po-act],[data-po-save]')) return;   /* acting, not opening */
        /* THE PERSON WINS OVER THE THING. Checked BEFORE the card opens,
           because both are the same click and the more specific target is the
           one that was aimed at. */
        var c = e.target.closest('[data-po-center]');
        if (c) {
          e.preventDefault(); e.stopPropagation();
          doc.dispatchEvent(new CustomEvent('ow:enter-center', {
            detail: { id: c.getAttribute('data-po-center') } }));
          return;
        }
        var w = e.target.closest('[data-po-who]');
        if (w) {
          e.preventDefault(); e.stopPropagation();
          doc.dispatchEvent(new CustomEvent('ow:open-person', {
            detail: { ref: w.getAttribute('data-po-who') } }));
          return;
        }
        OW.open(n._po, n);
      });

    }

    /* ── THE STRIP TELLS YOU WHICH PIECE YOU ARE ON ───────────────────────
       An IntersectionObserver with the STRIP as its root, never a scroll
       handler — the same rule the vertical feed keeps, for the same reason: a
       scroll handler runs on the main thread and competes with the gesture it
       is watching. Here it also means the caption follows a native horizontal
       fling with no JavaScript in the gesture path at all.

       Wired here rather than by the feed, because it belongs to the Post
       Popit: the strip works identically on Home, in a profile, in the
       immersive group and in the post surface, and none of them needs to know
       it exists. */
    if (shots) {
      var strip = n.querySelector('.po-shots');
      var capEl = n.querySelector('.po-shots__cap');
      var dotEls = n.querySelectorAll('.po-shots__dots i');
      var mark = function (at) {
        var k;
        for (k = 0; k < dotEls.length; k++) {
          if (k === at) dotEls[k].setAttribute('data-on', '1');
          else dotEls[k].removeAttribute('data-on');
        }
        if (capEl) {
          var c = (shots[at] || {}).caption || '';
          capEl.textContent = c;
          capEl.setAttribute('data-empty', c ? '' : '1');
        }
      };
      mark(0);
      if (strip && global.IntersectionObserver) {
        var sio = new global.IntersectionObserver(function (es) {
          for (var q = 0; q < es.length; q++) {
            if (!es[q].isIntersecting || es[q].intersectionRatio < 0.6) continue;
            mark(parseInt(es[q].target.getAttribute('data-i'), 10) || 0);
          }
        }, { root: strip, threshold: [0.6] });
        Array.prototype.forEach.call(strip.children, function (c) { sio.observe(c); });
      }
      /* a dot is a control, not an indicator — pressing one goes there, and it
         must never also open the Post underneath */
      Array.prototype.forEach.call(dotEls, function (d, k) {
        d.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (strip) strip.scrollTo({ left: k * strip.clientWidth, behavior: 'smooth' });
        });
      });
    }
    if(OW.mediaAhead)OW.mediaAhead(n);
    if(embedFace && OW.embed)OW.embed.watch_in(n);   /* the platform's player, once this card is in view (founder/1139) */
    if(OW.cards && OW.cards.identityReady)OW.cards.identityReady(n.querySelector('.po-card__who'));
    /* A FINGER ON THE WORDS OPENS THE POST, NEVER THE AUTHOR ABOVE THEM (his walk, 2026-11-08, item 9: "make sure collision won't be an
       issue for people's fingers on mobile"). Measured in WebKit at 390 in Simple: a tap on a post's first line opened its author's
       profile, because iOS's finger adjustment moves a tap to the nearest thing that answers a press, and the words had none of
       their own (only the card around them, which the adjustment passes over for the author's press inside it), while Simple's
       head sits flush on them. The words answer the press themselves now; the press still bubbles to the card, which opens the post. */
    var words = n.querySelector('.po-card__body');
    if (words) words.addEventListener('click', function () {});
    return n;
  };

  /* An identity with no picture still has a name. Initials differentiate people
     honestly where the runtime cannot yet: every new account is issued the same
     default hue, so avatars were otherwise identical. A hash-derived colour
     would be inventing identity (Law 15); a person's own initial is not. */
  /* LETTERS ONLY (founder, 2026-10-17: his own face showed '＠'): a name-less account's name is its handle, so each word
     gives its first letter or digit, never a sigil or a mark ('＠williamrauert' is W, '$cash.app' is C, 'maya.cole' is M).
     The one place initials are made; api/test_profile_header.py holds it. */
  /* A CENTER'S LETTERS, ASKED FOR (opts.center; the renders' rule, Menu.dc.html and Main.dc.html: 'The Ocean Pier Hotel' is OP,
     'Pier Grill' PG): the first two words that name it, an article, a bare number and the small words between names left out.
     Only a caller that says it draws a Center asks (the OS menu's faces); a person's letters, and every caller that passes one
     argument, are as before. */
  var CENTER_SMALL = /^(the|a|an|on|of|at|in|by|and|for|to|de|la|le|el|du|des|del|da|di|&|\+)$/i;
  OW.initials = function (name, opts) {
    if (opts && opts.center) {
      var named = String(name || '').trim().split(/\s+/).filter(function (w) { return w && !CENTER_SMALL.test(w) && !/^\d+$/.test(w) && /[\p{L}\p{N}]/u.test(w); });
      if (named.length) return named.slice(0, 2).map(function (w) { return w.match(/[\p{L}\p{N}]/u)[0]; }).join('').toUpperCase();
    }
    var parts = String(name || '').trim().split(/\s+/).map(function (w) {
      var m = w.match(/[\p{L}\p{N}]/u); return m ? m[0] : '';
    }).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0] + (parts.length > 1 ? parts[parts.length - 1] : '')).toUpperCase();
  };

  /* ══ A PERSON WITH NO PICTURE IS A PERSON ════════════════════════════════
     ★ FOUNDER/495, 2026-09-23: *"Make the default profile picture for all
       people just an outline of a person's body."*

     EVERY SURFACE INVENTED ITS OWN. A face with no picture was drawn as
     INITIALS — "M", "FC", "WI" — by five different files, each calling
     `OW.initials` and styling the letters its own way. Two letters on a
     coloured disc is a placeholder that looks like data: it reads as a monogram
     somebody chose, and on a Center row beside a real photograph it reads as a
     different KIND of thing. It is also wrong about people with one name, no
     name, or a name in a script whose first glyph means nothing on its own.

     ONE DRAWING, HERE, so there is one default and it changes in one place.
     Head and shoulders — the outline of a person, stroked in `currentColor` so
     it takes whatever ink the surface it lands on is using, at whatever size
     that surface draws a face. It is deliberately the SAME geometry as the
     `center` mark in the App's own icon table, because that mark already means
     "a person" in this product and a second drawing of one would be two.

     `initials` STAYS and is not deprecated: a name is still the right thing to
     read out to a screen reader, and callers pass it as the label. What
     changes is what is DRAWN. */
  OW.faceMark = function () {
    return glyph('user', { sel: false }).replace('class="ow-ic', 'class="ow-facemark ow-ic');   /* the dock's person, Phosphor's */
  };

  /* A FACE THAT DOES NOT LOAD IS THE FACE THAT HAS NONE (2026-10-09). Measured at 390 on Home: a
     demo avatar that answers 404 drew the browser's broken-image glyph on every one of that person's
     posts. An `<img>` in a face box calls this on error: a person becomes their outline, a Center or
     a community its monogram (`data-ini` on the box), exactly what a face with no picture draws. */
  OW.faceFail = function (img) {
    var box = img && img.parentNode;
    if (!box) return;
    var kind = String(box.getAttribute('data-kind') || 'person');
    var i = doc.createElement('i');
    i.textContent = box.getAttribute('data-ini') || '';
    box.innerHTML = '';
    box.appendChild(i);
  };

  /* ══ THE ONE FACE ════════════════════════════════════════════════════════
     ★ FOUNDER/1221, 2026-11-03: *"they r still not showing exact PFP's i want
       one pfp everywhere"*.

     MEASURED THAT DAY (context/audits/faces-2026-11-03): a person who cut her
     own picture and wore it was drawn by each surface its own way. The likes
     list and the followers and following lists were sent no picture at all
     and drew her letters; the story bar drew one letter on a hue of its own;
     her profile drew an outline when a read came without one; the feed, the
     comments and Messages read a field named `image` while the rest read
     `picture`. Each was a copy of "how a face is drawn", and each copy was
     fixed or not on its own.

     ONE MODULE, HERE, beside OW.initials and OW.imageUrl, which every page that
     draws a person loads. Every surface asks it (B6: import the one):
       OW.face(who, opts)            the markup of a face: <span class="ow-face">
       OW.face.fill(box, who, opts)  a surface's own holder (its class, its size,
                                     its place kept), filled by the same rule
       OW.face.inner(who, opts)      what a holder holds: the picture, or letters
       OW.face.picture(who)          the one picture's address, or ''
     who:  {kind, name, picture, shape, hue, ref|handle, presence, letters}.
           `picture` IS THE ONE FIELD: an address, or {url} as a card carries it.
     opts: {cls, size (px), letters ('i': the letters in an <i>), img (further
           attributes, as written), ring ({unseen, hue}: the story ring, in the
           author's hue), here (true: the online dot), label (read aloud)}.

     THE PICTURE IS DRAWN WHOLE. A person cuts their picture in the editor's
     circle (1080 by 1080, oneway-editor.js), so the holder is square, round
     (S14), and the picture covers it from its centre: what they cut is what
     every surface shows, at any size, never cut a second time.
     NO PICTURE: their initials on the holder's ground (founder/816; OW.initials
     makes them). A picture that does not load becomes those (OW.faceFail). */
  var FACE_CSS = [
    /* :where() — no weight: a surface's own holder rule (its size, its border, its place) always wins over these defaults */
    ':where(.ow-face){position:relative;display:inline-grid;place-items:center;flex:none;box-sizing:border-box;width:var(--ow-face-size,40px);',
    'height:var(--ow-face-size,40px);border-radius:50%;overflow:hidden;color:#fff;',
    /* no picture: the initials on the person's own colour (founder/816), flat as on a post (his word, 2026-11-07, L6: "Make both flat"); deepened in the light room */
    'background:rgb(var(--h,var(--ow-h1,124,45,255)));',
    'font-weight:700;font-size:calc(var(--ow-face-size,40px) * .38);line-height:1;letter-spacing:0;-webkit-user-select:none;user-select:none}',
    ':where(.ow-face>img,img.ow-face__img){display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%;border-radius:inherit}',
    ':where(.ow-face>i){font-style:normal}',
    ':where(html[data-theme="light"] .ow-face:not(:has(img))){background:color-mix(in srgb,rgb(var(--h,var(--ow-h1,124,45,255))) 78%,#000)}',
    '.ow-face-on{position:relative;display:inline-grid;flex:none}',
    '.ow-face-on>.ow-face__on{position:absolute;right:0;bottom:0;width:26%;height:26%;min-width:9px;min-height:9px;max-width:14px;max-height:14px;',
    'border-radius:50%;background:#2fd27a;box-shadow:0 0 0 2px var(--ow-ground,#000)}'
  ].join('');
  function faceCss() {
    if (!doc || doc.getElementById('ow-face-css')) return;
    var st = doc.createElement('style'); st.id = 'ow-face-css'; st.textContent = FACE_CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  function facePicture(who) {
    var p = who && who.picture;
    if (p && typeof p === 'object') p = p.url;
    return OW.imageUrl(p);
  }
  function faceInner(who, opts) {
    who = who || {}; opts = opts || {};
    faceCss();
    var src = facePicture(who);
    if (src) return '<img class="ow-face__img" src="' + esc(src) + '" alt="" decoding="async" draggable="false"' + (opts.img || '') +
      ' onerror="OW.faceFail&&OW.faceFail(this)">';
    var ini = esc(who.letters != null ? who.letters : OW.initials(who.name || String(who.ref || who.handle || '').replace(/^@/, ''), faceAsks(who)));
    return opts.letters === 'i' ? '<i>' + ini + '</i>' : ini;
  }
  function faceAsks(who) { return who && who.kind === 'center' ? { center: true } : undefined; }     /* a Center's letters ('The Ocean Pier Hotel' OP), 11-04 */
  function faceKind(who) {
    var k = String((who && who.kind) || '');
    return /^(user|profile|person|)$/.test(k) ? 'person' : k;
  }
  function faceRef(who) {
    var r = String((who && (who.handle || who.ref)) || '');
    return r && r.indexOf('@') <= 0 && !/\s/.test(r) ? '@' + r.replace(/^@/, '') : '';
  }
  OW.face = function (who, opts) {
    who = who || {}; opts = opts || {};
    faceCss();
    var ring = opts.ring, hue = ring && typeof ring.hue === 'number' && OW.hue && OW.hue.fromAngle ? OW.hue.fromAngle(ring.hue) : null;
    var own = typeof who.hue === 'number' && OW.hue && OW.hue.fromAngle ? OW.hue.fromAngle(who.hue) : null;      /* their colour, under letters */
    var style = (opts.size ? '--ow-face-size:' + (+opts.size) + 'px;' : '') + (hue && hue[0] ? '--sh1:' + hue[0] + ';--sh2:' + (hue[1] || hue[0]) + ';' : '') +
      (own && own[0] ? '--h:' + own[0] + ';--h2:' + (own[1] || own[0]) + ';' : '');
    var html = '<span class="ow-face' + (opts.cls ? ' ' + esc(opts.cls) : '') + (ring ? ' ow-sts-has' : '') + '"' +
      ' data-kind="' + esc(faceKind(who)) + '" data-ini="' + esc(OW.initials(who.name || '', faceAsks(who))) + '"' +
      (ring && ring.unseen ? ' data-unseen' : '') + (style ? ' style="' + style + '"' : '') +
      (opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : '') + '>' +
      faceInner(who, { letters: opts.letters || 'i', img: opts.img }) + '</span>';
    if (!opts.here) return html;
    /* THE ONLINE DOT (founder/863, 954): drawn when the read says online; a face with a handle is marked for presence.js,
       the one reader and writer of every dot, which keeps it true on the screen's beat */
    var ref = faceRef(who), on = opts.here === true || who.presence === 'online';
    return '<span class="ow-face-on"' + (ref ? ' data-dot="' + esc(ref) + '" data-dot-seed="' + (on ? 'online' : 'offline') + '"' : '') + '>' + html +
      (on ? '<i class="ow-face__on" role="img" aria-label="Online"></i>' : '') + '</span>';
  };
  OW.face.inner = faceInner;
  OW.face.picture = facePicture;
  OW.face.fill = function (box, who, opts) {
    if (!box) return box;
    who = who || {}; opts = opts || {};
    faceCss();
    box.setAttribute('data-kind', faceKind(who));
    box.setAttribute('data-ini', OW.initials(who.name || '', faceAsks(who)));
    box.innerHTML = faceInner(who, opts);
    if (opts.ring && OW.stories && OW.stories.ringFrom) OW.stories.ringFrom(box, opts.ring);
    return box;
  };

  /* ── THE NOTE ──────────────────────────────────────────────────────────
     Founder, 2026-08-17: *"a note is like a thing that appears above a profile
     picture basically everywhere where they would display it."*

     A NOTE IS NOT A POST AND IT IS NOT A COMMENT. I built it as a comment
     first, on a post, which was wrong in both directions — it belongs to the
     PERSON, not to a thing they made, and it rides with their face wherever
     that face is drawn. So it is written HERE, in the material, beside
     `initials` and `when`: anything that can draw an avatar can draw the note
     on it, and nothing has to know how.

     WHY IT LOOKS LIKE THIS RATHER THAN LIKE INSTAGRAM'S. Instagram's note is a
     speech bubble with two tail dots, and copying that mark would have made a
     borrowed thing sit on the one surface that is most ours. This world already
     has the right idea in it: a Popit is a PROJECTION and the thing it came
     from is the EMITTER (§6). A person's face is an emitter. A note is the
     smallest projection there is — one line, tethered by one point of light
     rather than a cartoon tail. Same material as the pane, at bead scale.

     IT IS ABSENT OR IT IS REAL. No placeholder, no "no note yet", nothing
     invented to fill the space above a face (Law 15). An expired note is
     ABSENT, which is the runtime's job; a blank string is absent here.

     `size` is the only variance: 'sm' where the avatar is a 34px row-mark and
     the line has to earn its height, default where the avatar is a person's
     whole identity and the note can breathe. Two scales of one thing — not two
     designs, which is how a surface goes generic. */
  OW.noteHTML = function (note, size) {
    /* THE ONE RENDERER (founder/878: "it appears everywhere but must look good doing so"): the bubble above the name is
       oneway-cards.js's; a page without it keeps this plate. No size is the profile's own (two lines). */
    if (OW.cards && OW.cards.noteHTML) return OW.cards.noteHTML(note, size === 'sm' ? 'sm' : (size || 'profile'));
    var text = typeof note === 'string' ? note : (note && note.text);
    text = String(text == null ? '' : text).trim();
    if (!text) return '';
    return '<span class="po-note' + (size ? ' po-note--' + esc(size) : '') + '"' +
      ' aria-label="note">' +
      '<span class="po-note__t">' + esc(text) + '</span>' +
      '<i class="po-note__tie" aria-hidden="true"></i>' +
      '</span>';
  };

  /* The DOM half of the same thing, for the surfaces that build with `mk()`
     rather than a template — the profile header, a thread row, a post byline.
     One implementation, two entry points; never a second note. */
  OW.noteOn = function (avatarEl, note, size) {
    if (!avatarEl) return null;
    var html = OW.noteHTML(note, size);
    if (!html) return null;
    var wrap = avatarEl.parentNode;
    if (!wrap) return null;
    /* the note is positioned against the FACE, so the face's container is the
       one that has to hold the coordinate space — set here rather than in a
       stylesheet rule that would have to name every wrapper class there is */
    var cs = global.getComputedStyle(wrap);
    if (cs.position === 'static') wrap.style.position = 'relative';
    var host = doc.createElement('span');
    host.className = 'po-note__host';
    host.innerHTML = html;
    var n = host.firstChild;
    /* ABOVE THE NAME (founder/878): the first thing in the block beside the face, which holds the name; where a face has
       no such block, before the face as it was */
    var above = function () {
      var named = avatarEl.nextElementSibling;
      if (named && named !== n && !named.classList.contains('po-note')) {
        /* a POST's byline holds it to the RIGHT of the name (founder/1261): after the name's own element, on its line */
        var nameEl = named.matches && named.matches('.ow-post__nm,.po-card__n') ? named.firstElementChild : null;
        named.insertBefore(n, nameEl ? nameEl.nextSibling : named.firstChild);
        return true;
      }
      return false;
    };
    if (!above()) {
      /* a row that adds its name after the face (a conversation's row) gets it on the next frame, before it is painted */
      wrap.insertBefore(n, avatarEl);
      global.requestAnimationFrame(function () { if (n.parentNode === wrap) above(); });
    }
    return n;
  };

  /* relative time, said the way a person would — BACKWARDS ONLY, and it now
     says so instead of guessing.

     ★ FOUND BY LANE A, 2026-09-12, on the real helper in a browser:

           in 4 minutes  -> "just now"
           in 3 hours    -> "just now"
           tomorrow      -> "just now"
           in 5 days     -> "just now"

     Elapsed seconds go negative for a future time and every one of them falls
     through the first branch. Nothing renders a future time through this
     today — I checked all five callers, and the Countdown that A flagged as
     the likely one reads `TIME.until` from the time contract, not this — so
     it was a lie waiting rather than a lie on screen. A formatter that
     answers confidently across half a domain it cannot describe is a trap
     whoever adds the sixth caller walks into.

     IT DOES NOT LEARN TO SPEAK FORWARDS HERE. A has `fromNowWords` for that
     question already, and a second forward vocabulary in the shared file is
     exactly the "two answers to one question" the lanes exist to prevent. So
     a future time gets the absolute short date, which is the same fallback
     the far past gets and is never wrong. If the platform wants ONE voice for
     both directions, the forward half moves in here and this delegates — A's
     call, since they own it.

     THE FLOOR IS -60s AND NOT ZERO, deliberately: a server clock a few
     seconds ahead stamps a post "in the future" and "just now" is the true
     answer for it. */
  OW.when = function (iso) {
    if (!iso) return '';
    var t = Date.parse(iso); if (isNaN(t)) return '';
    var s = (Date.now() - t) / 1000;
    if (s < -60) {
      return new Date(t).toLocaleDateString(undefined,
                                            { month: 'short', day: 'numeric' });
    }
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  /* ── ONE ADAPTER, CANONICAL POST -> RIVER ROW ──────────────────────────
     The river reads `item.post ? postFace(item.post) : item`, so a row must
     arrive WRAPPED. The canonical Social endpoints return BARE post objects,
     and an unwrapped one falls to the gallery branch: the card renders
     "Untitled" in the default hue while the words and the Place's colour sit
     unread in the payload.

     Home already carried this adapter inline. Reposts and Favourites then hit
     the identical bug — measured 2026-08-29, both shelves rendering "Untitled"
     over real posts — which is the moment a second copy becomes a third. So it
     lives here, in the file every surface already loads, and there is one
     description of the shape.

     IT RENAMES AND NOTHING ELSE. `actor` and `at` are the names the river
     reads; `author` and `created_at` are the same facts on the canonical post.
     No field is invented or defaulted — the day the endpoint returns
     `{post, at}` this deletes and no caller changes. */
  OW.riverRow = function (p) {
    if (!p || p.post) return p;                 /* already wrapped */
    var acts = p.actions || {}, you = p.you || {};
    var offers = ['like', 'dislike', 'comment', 'repost', 'save']
      .filter(function (v) { return Object.prototype.hasOwnProperty.call(acts, v); });
    return {
      post: p,
      /* a highlight's `created_at` is when the door composed it, not when
         anything happened — "4m ago" beside a Center's name says nothing */
      at: (p.type === 'highlight') ? '' : (p.created_at || p.saved_at || p.reposted_at || ''),
      actor: p.author || {},
      interactions: offers.length
        ? { offers: offers,
            mine: you.liked ? 'like' : (you.disliked ? 'dislike' : ''),
            counts: acts }
        : null
    };
  };
  OW.riverRows = function (rows) {
    return (rows || []).map(OW.riverRow);
  };

  /* ★ THE RIVER ADAPTS ITS OWN INPUT. THIS IS THE FIX FOR THE POSTS.
     Founder, 2026-08-30: *"we lost the beautiful design of our posts that we
     were literally working on… unacceptable."*

     NOTHING ABOUT THE POST CARD WAS EVER BROKEN. `OW.card` takes a WRAPPED row
     — `{post, at, actor, interactions}` — and `home.js` was handing it the bare
     canonical Post straight from `/api/feed`. So `it.post` was undefined on
     every card and each one rendered its own empty state: **"Untitled" over
     "NOTHING IN IT YET" with a blank avatar**, twenty times down the page. The
     material, the radius, the seam, the hue were all still exactly right, which
     is precisely why it read as the design having been destroyed rather than as
     a payload never arriving.

     THREE CALLERS HAD IT WRONG AND TWO HAD IT RIGHT, which is the shape of a
     contract that lives in the caller's head. `OW.riverRows` existed for this
     and Home simply did not call it — measured: `home.js:245`, `:481`, `:562`
     raw; `popit-live.js:2909`, `:2922` adapted.

     SO THE ADAPTER MOVES INSIDE THE DOOR. `riverRow` already opens with
     `if (!p || p.post) return p` — it is idempotent by construction, so an
     already-wrapped row passes through untouched and a bare Post is wrapped.
     One place, no contract for a caller to remember, and a fourth caller
     written next week cannot get it wrong. */
  /* A CARD RESERVES ITS OWN HEIGHT BEFORE IT IS DRAWN (the founder, 2026-11-09: "the whole frame just kind of studders and the post pops
     in"). The river skips drawing a card that is off screen (content-visibility) and stands it at a guess, 190 px or 420 with media; a tall
     photo is 650 at 390, so in a fast fling a card grew from the guess to its size as it reached the screen and moved what was there. The
     picture's shape is in the post's own data (--po-ar from the upload's size, --ow-emb-ar from the player's table), so the card's height is
     reserved from it, at the river's width; once drawn, `auto` keeps the drawn size. RIVER_CHROME_PX: the who row, a line of words and the
     acts around a picture (the stylesheet's text-card guess). */
  var RIVER_CHROME_PX = 190;
  OW.riverWidth = 0;
  /* AND THE GUESS IS LEARNED FROM THE CARDS ALREADY DRAWN (rc-2 walk, 2026-11-09: a fling at 390 jumped past cards it had not drawn yet,
     and drawn late, on the screen, each photo card fell 53 px from its guess (425 to 372) and each card of words 60 (190 to 130): a
     layout shift of 0.063). 190 is a guess at the room around a picture, and the stylesheet's 190 a guess at a card of words. What they
     really take is read once from cards on the screen, which are drawn: around a picture, the room above and below it and how much
     narrower it is than the river; for words, the room around them, their line and how many letters a line holds. Every card still
     waiting undrawn is then reserved from those and its own words. `auto` keeps a drawn card's own size, so no drawn card moves. */
  var learned = { key: '' };
  /* what was learned holds for one look at one river width; never window.innerWidth here, which makes the browser lay the page out
     again, and this is asked for every card drawn (measured: the next page took 1.1 s to draw, a card a frame, instead of 80 ms) */
  function learnKey() { return (doc.documentElement.getAttribute('data-simple') || '0') + '|' + OW.riverWidth; }
  function wordsPx(m, card) {
    var d = card.querySelector('.po-card__d'), n = d ? (d.textContent || '').length : 0;
    return n && m.lineH ? m.lineH * Math.min(m.clamp, Math.max(1, Math.ceil(n / m.cpl))) : 0;
  }
  function reserve(card, host) {
    var c = card.querySelector('.po-card__cover'), e = card.querySelector('.ow-emb');
    var L = learned.key === learnKey() ? learned : null;
    if (!c && !e) {
      if (L && L.text && !card.querySelector('.po-shots, video')) card.style.containIntrinsicSize = 'auto ' + Math.round(L.text.base + wordsPx(L.text, card)) + 'px';
      return;
    }
    var ar = +((c && c.style.getPropertyValue('--po-ar')) || (e && e.style.getPropertyValue('--ow-emb-ar')) || 0.8);
    if (!(ar > 0)) return;
    var w = (host && host.isConnected && host.clientWidth) || OW.riverWidth || Math.min((global.innerWidth || 390) - 24, 600);
    if (host && host.isConnected && host.clientWidth) OW.riverWidth = host.clientWidth;
    var M = L && L.cover;
    if (M) w = Math.max(1, w - M.inset);
    /* a player's card stops at seven tenths of the screen's height (.po-card__cover:has(>.ow-emb)) */
    var media = w / ar;
    if (e) media = Math.min(media, (global.innerHeight || 800) * 0.7, 720);
    card.style.containIntrinsicSize = 'auto ' + Math.round((M ? M.base + wordsPx(M, card) : RIVER_CHROME_PX) + media) + 'px';
  }
  function measure(card, mediaH) {
    var d = card.querySelector('.po-card__d'), m = { base: card.getBoundingClientRect().height - mediaH, lineH: 0, cpl: 1, clamp: 12 };
    if (d) {
      var cs = global.getComputedStyle(d), fs = parseFloat(cs.fontSize) || 16;
      m.lineH = parseFloat(cs.lineHeight) || fs * 1.45;
      m.cpl = Math.max(8, d.clientWidth / (fs * 0.5));          /* letters a line holds: half an em each, on average */
      m.clamp = parseInt(cs.webkitLineClamp, 10) || 12;
      m.base -= d.getBoundingClientRect().height;
    }
    return m;
  }
  function learn() {
    var key = learnKey(), L = learned.key === key ? learned : { key: key };
    if (L.cover && L.text) return;
    var vh = global.innerHeight || 800, rows = doc.querySelectorAll('.po-river > .po-card:not(.po-card--skel)'), got = false;
    for (var i = 0; i < rows.length && !(L.cover && L.text); i++) {
      var k = rows[i], r = k.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.height < 20) continue;             /* only a card on the screen is surely drawn */
      var cv = k.querySelector('.po-card__cover'), inner = cv || k.querySelector('.po-card__body');
      if (k.querySelector('.ow-emb, .po-shots, video') || !inner || (inner.checkVisibility && !inner.checkVisibility({ contentVisibilityAuto: true }))) continue;
      if (cv && !L.cover) { var cb = cv.getBoundingClientRect(); if (cb.height > 20) { L.cover = measure(k, cb.height); L.cover.inset = k.parentNode.clientWidth - cb.width; got = true; } }
      else if (!cv && !L.text) { L.text = measure(k, 0); got = true; }
    }
    if (!got) return;
    learned = L;
    [].forEach.call(rows, function (k) { try { reserve(k, k.parentNode); } catch (_) {} });
  }
  OW.mountRiver = function (host, items, opts) {
    if (!host) return 0;
    host.classList.add('po-river');
    var frag = doc.createDocumentFragment(), n = 0;
    (items || []).forEach(function (it) {
      var card = OW.card(OW.riverRow(it), opts);
      try { reserve(card, host); } catch (_) {}
      frag.appendChild(card); n++;
    });
    host.appendChild(frag);
    /* once cards are on the screen and drawn, they teach the guess (a page drawn into a pen joins the river before the second frame) */
    if (!(learned.key === learnKey() && learned.cover && learned.text) && global.requestAnimationFrame) {
      global.requestAnimationFrame(function () { global.requestAnimationFrame(function () { try { learn(); } catch (_) {} }); });
    }
    return n;
  };

  /* ═══ 6 · THE SHEET — depth 2, "Enter" ═════════════════════════════════ */
  var scrim, stage, sheet, beam, originEl = null, lockY = 0, locked = false;
  var outTimer = 0, worldTweened = false, lastFocus = null;
  /* what is open right now — the room's controls act on the same widget the
     tile does, and a listener bound once at ensure() has no other way to know */
  var openData = {};
  /* ── WHICH OPEN IS THIS ─────────────────────────────────────────────────
     Closing is animated, so its cleanup runs ~400ms after the person let go.
     If they open something else inside that window, the OLD close's cleanup
     lands on the NEW sheet. This counter is how the two tell each other apart:
     `close` remembers the generation it was closing, and its cleanup stands
     down when the number has moved on. */
  var openSeq = 0;

  function ensure() {
    if (sheet) return;
    scrim = el('div', 'po-scrim');
    stage = el('div', 'po-stage');
    sheet = el('div', 'po-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.tabIndex = -1;
    beam = el('div', 'po-beam');
    beam.setAttribute('aria-hidden', 'true');
    stage.appendChild(sheet);
    doc.body.appendChild(scrim); doc.body.appendChild(beam);
    doc.body.appendChild(stage);
    scrim.addEventListener('click', OW.close);
    /* §18: a handcrafted world stays physically coherent WHILE it is resized,
       and a beam is exactly the kind of measured geometry that goes wrong. It
       is re-measured rather than remembered. Scroll is not a case — the body is
       locked while a Popit is open, so the emitter cannot move under it. */
    global.addEventListener('resize', function () {
      if (!sheet || !sheet.classList.contains('is-open')) return;
      /* re-decide where there is room to step, THEN re-aim — a window dragged
         narrow can take the room away entirely, and the pane must return to
         centre rather than stay stepped off the edge (§18: nothing may end up
         clipped or orphaned by a resize) */
      sheet.style.transform = 'none';
      var m = sheet.getBoundingClientRect();       /* the centred layout box */
      restAt = restPlace();
      sheet.style.transform = restTransform();
      aimBeam({ left: m.left + restAt.x, top: m.top + restAt.y,
                width: m.width, height: m.height });
      settleInStage();          /* the same guarantee holds through a resize */
    }, { passive: true });

    /* ── A ROOM THAT CAN ACT ────────────────────────────────────────────
       THE DEFECT THIS CLOSES, stated plainly because it is why no acting
       widget had a room: `ow:act` was announced by a listener bound to the
       TILE, and the sheet is appended to document.body — so it is not a
       descendant of the tile it came from. A control rendered inside a room
       could never dispatch. The room was therefore a picture of a control
       panel, which is precisely the "do not feel as widgets" half of the
       2026-08-16 correction.

       This is the same announcement, from the sheet, carrying the same widget
       data — NOT a second action path. The material still performs no HTTP and
       knows no endpoints; oneway-popit.js announces and oneway-popit-live.js
       carries out, exactly as before, so there remains exactly ONE place a
       Popit can change reality and exactly one place to audit. */
    sheet.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-po-act],[data-po-create]');
      if (!a) return;
      e.preventDefault();
      doc.dispatchEvent(new CustomEvent('ow:act', { detail: {
        button: a,
        verb: a.getAttribute('data-po-act') || 'create',
        create: a.getAttribute('data-po-create') || null,
        widget: openData.widget || openData, node: sheet, from: 'room'
      } }));
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') OW.close(); });
    /* the way out speaks up only when someone is visibly hunting for it (§5) */
    doc.addEventListener('mousemove', function () {
      if (!sheet.classList.contains('is-open')) return;
    }, { passive: true });
    attachDrag();
  }

  function lock() {
    if (locked) return;
    lockY = global.pageYOffset || root.scrollTop || 0;
    doc.body.style.top = (-lockY) + 'px';
    doc.body.classList.add('po-locked');
    locked = true;
  }
  function unlock() {
    if (!locked) return;
    doc.body.classList.remove('po-locked');
    doc.body.style.top = '';
    locked = false;
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';       /* never animate the restore */
    global.scrollTo(0, lockY);
    root.style.scrollBehavior = prev;
  }

  /* The angle the sheet comes to rest at, owned by CSS (--po-rest-rot) so the
     stylesheet's media queries decide it and the FLIP can never disagree:
     hand-tilted when floating in space, square when resting against an edge. */
  function restRot() {
    var v = getComputedStyle(sheet).getPropertyValue('--po-rest-rot').trim();
    return v || '-1.2deg';
  }

  /* ── WHERE THE PANE COMES TO REST ───────────────────────────────────────
     §7 IS EXPLICIT AND WAS NOT IMPLEMENTED: the Popit "floats in the world and
     is tethered to where it was summoned, NOT a detached centered overlay."
     The stage centred it. Everything that made the open state read as a dialog
     rather than a projection followed from that one fact — the object it came
     from ended up UNDERNEATH it (measured: a 635×735 pane on a 1280×860 screen
     covers the middle 634×734, and every tile in a grid falls inside that), so
     there was nothing to project from and no relationship left to see.

     So the pane steps aside just far enough to clear its own emitter, and no
     further — this is not a new position, it is the law's position. It moves on
     ONE axis, choosing whichever has the room, because a diagonal shift reads
     as drift rather than as making way.

     WHEN THERE IS NO ROOM IT STAYS CENTRED. A narrow window, or a pane nearly
     as wide as the screen, has nowhere to step: it centres, the beam stays off,
     and nothing is half-drawn. Degrading to exactly the old behaviour is the
     correct failure here. */
  /* the layout viewport — the space getBoundingClientRect reports in */
  function vpW() { return root.clientWidth || global.innerWidth || 0; }
  function vpH() { return root.clientHeight || global.innerHeight || 0; }

  function restPlace() {
    var z = { x: 0, y: 0 };
    if (!originEl || !sheet) return z;
    /* a phone rests the pane against the bottom edge — native grammar and the
       only thumb-reachable position (§6.4). It does not step aside. */
    if (vpW() <= 640) return z;

    var o = originEl.getBoundingClientRect();
    var m = sheet.getBoundingClientRect();
    if (!o.width || !m.width) return z;

    /* THE VIEWPORT IS MEASURED, NOT ASKED FOR. `innerWidth`/`clientWidth` are
       not guaranteed to share a coordinate space with getBoundingClientRect —
       under a page scale factor, fixed-position boxes are reported against the
       visual viewport while those properties report the layout one, and mixing
       the two computed a step twice the size it should have been and threw the
       pane off the top of the screen. `.po-stage` is `position:fixed; inset:0`,
       so ITS rect is the viewport in exactly the space the pane is measured in.
       One space, no conversion, nothing to disagree about. */
    var st = stage.getBoundingClientRect();
    var vw = st.width || vpW(), vh = st.height || vpH(), pad = 24, gap = 26;
    var cx = st.left + vw / 2, cy = st.top + vh / 2;
    var ox = o.left + o.width / 2, oy = o.top + o.height / 2;
    var roomX = Math.max(0, (vw - m.width) / 2 - pad);
    var roomY = Math.max(0, (vh - m.height) / 2 - pad);

    /* how far the pane must move for its near edge to clear the emitter */
    var needX = ox < cx ? (ox + o.width / 2 + gap) - (cx - m.width / 2)
                        : (ox - o.width / 2 - gap) - (cx + m.width / 2);
    var needY = oy < cy ? (oy + o.height / 2 + gap) - (cy - m.height / 2)
                        : (oy - o.height / 2 - gap) - (cy + m.height / 2);

    /* IT STEPS AS FAR AS THERE IS ROOM, rather than only when it can clear the
       emitter completely. Requiring full clearance made this all-or-nothing,
       and on any object near the middle of the screen the answer was always
       nothing — the pane snapped back to dead centre and read as the dialog
       §7 forbids. Moving what it can is always better than not moving: the
       object is more visible, the composition is off-centre and alive, and
       whether the projection is actually legible is aimBeam's question, asked
       against the real geometry rather than guessed at here. */
    var canX = Math.max(0, roomX - Math.abs(needX)), canY = Math.max(0, roomY - Math.abs(needY));
    /* one axis only — a diagonal step reads as drift rather than as making way,
       so it takes whichever axis gets closest to actually clearing */
    var step = z;
    if (roomX >= 8 && (canX >= canY || roomY < 8)) {
      step = { x: Math.max(-roomX, Math.min(roomX, needX)), y: 0 };
    } else if (roomY >= 8) {
      step = { x: 0, y: Math.max(-roomY, Math.min(roomY, needY)) };
    }

    /* THE GUARANTEE, AND IT IS NOT THE SAME AS THE CLAMP ABOVE. The clamp
       trusts that roomX/roomY were computed in a coherent space; this checks
       the ANSWER against the stage and refuses it if the pane would leave the
       screen. It cost nothing to write and it caught a real off-screen pane —
       a step measured across two coordinate spaces sailed the whole projection
       off the top edge while every intermediate number looked reasonable.
       An open Popit that cannot be seen is the worst failure this component
       has, so it is the one thing that is checked rather than reasoned about. */
    var l = m.left + step.x, t = m.top + step.y;
    if (l < st.left + 4 || t < st.top + 4 ||
        l + m.width > st.right - 4 || t + m.height > st.bottom - 4) return z;
    return step;
  }

  /* the one description of "at rest", so the open animation, the close
     animation and the beam can never disagree about where the pane is */
  var restAt = { x: 0, y: 0 };
  function restTransform() {
    return 'translate(' + restAt.x + 'px,' + restAt.y + 'px) scale(1,1) rotate(' + restRot() + ')';
  }

  /* THE PANE IS ON SCREEN — verified against the rendered box, not predicted.
     This is the only check in the component that reads the world AFTER the
     fact, and it is here because an open Popit that cannot be seen is the
     worst thing this component can do: the founder is looking at a beam
     pointing off the top of the screen at nothing. Give up the step, keep the
     Popit. */
  function settleInStage() {
    if (!sheet || !stage || !sheet.classList.contains('is-open')) return;
    if (!restAt.x && !restAt.y) return;                /* centred already */
    var a = sheet.getBoundingClientRect(), b = stage.getBoundingClientRect();
    if (a.left >= b.left - 1 && a.top >= b.top - 1 &&
        a.right <= b.right + 1 && a.bottom <= b.bottom + 1) return;
    restAt = { x: 0, y: 0 };
    sheet.style.transform = restTransform();
    aimBeam();                                         /* which will now be off */
  }

  /* ── AIM THE BEAM — emitter to pane ─────────────────────────────────────
     THE PROJECTION HAS TO COME FROM SOMEWHERE, or the pane is a dialog that
     arrived (founder, 2026-08-16). This measures the two boxes and writes four
     custom properties; the CSS owns everything about how the light looks, so
     the geometry and the material can never argue.

     It stops at the pane's EDGE rather than its centre, because a projection
     lands on a surface — running the cone under the pane and out the far side
     is what would make it read as a line through a diagram. */
  function aimBeam(paneRect) {
    if (!beam) return;
    if (!originEl || !sheet || !sheet.classList.contains('is-open')) {
      beam.classList.remove('is-on');
      return;
    }
    var o = originEl.getBoundingClientRect();
    var m = paneRect || sheet.getBoundingClientRect();
    if (!o.width || !m.width) { beam.classList.remove('is-on'); return; }
    var ox = o.left + o.width / 2, oy = o.top + o.height / 2;
    var mx = m.left + m.width / 2, my = m.top + m.height / 2;
    var dx = mx - ox, dy = my - oy;
    var dist = Math.sqrt(dx * dx + dy * dy);

    /* AN EMITTER UNDER ITS OWN PANE HAS NO BEAM. If the object still sits
       behind where the pane came to rest — a window too narrow for the pane to
       step aside in — the cone would be drawn inside the pane and read as a
       smear across the content. A projection has to travel to be seen at all,
       so here it simply is not drawn. */
    var inside = Math.abs(dx) < m.width / 2 + 8 && Math.abs(dy) < m.height / 2 + 8;
    if (inside || dist < 60) { beam.classList.remove('is-on'); return; }

    /* stop at the edge: how far along the ray the pane's box begins */
    var tx = Math.abs(dx) > 1 ? (m.width / 2) / Math.abs(dx) : Infinity;
    var ty = Math.abs(dy) > 1 ? (m.height / 2) / Math.abs(dy) : Infinity;
    var reach = dist * (1 - Math.min(1, Math.min(tx, ty)));

    beam.style.setProperty('--beam-x', ox + 'px');
    beam.style.setProperty('--beam-y', oy + 'px');
    beam.style.setProperty('--beam-l', Math.max(0, reach) + 'px');
    beam.style.setProperty('--beam-a', (Math.atan2(dy, dx) * 57.2958) + 'deg');
    /* the cone opens toward the pane, in proportion to how far it has to go */
    beam.style.setProperty('--beam-w', Math.max(60, Math.min(200, reach * .5)) + 'px');
    /* the light is the OBJECT'S, so the beam inherits the hue the sheet is
       wearing — a Center projects in its own colour (§17) */
    var cs = getComputedStyle(sheet);
    beam.style.setProperty('--h', cs.getPropertyValue('--h').trim() || '124,45,255');
    beam.classList.add('is-on');
  }

  function timeList(items, cls) {
    if (!items || !items.length) return '';
    return '<ul class="po-time ' + cls + '">' + items.map(function (t) {
      return '<li' + (t.kind ? ' data-k="' + esc(t.kind) + '"' : '') + '>' +
        esc(t.text || '') +
        (t.at ? '<time>' + esc(t.at) + '</time>' : '') +
        (t.why ? '<time>' + esc(t.why) + '</time>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* ═══ THE ARTICLE ═══════════════════════════════════════════════════════
     (founder, 2026-08-16: a Popit must "be able to give information and
     history, like Wikipedia articles, be able to be used, like Apple widgets,
     and then click on reveal more information and display more graphics".)

     ALL THREE ALREADY EXIST IN THE RUNTIME AND NONE WERE RENDERED. Every
     object comes back from `_object_popit` carrying `identity` (its own facts —
     an infobox), typed `time_back` (decision · repair · revision · outcome —
     a history section), `decisions` (with who and when — provenance),
     `relationships` (people · places · family · commitments — see-also),
     `conversations`, and `actions` gated by `permissions` (the usable part).
     The App kept four fields of that and dropped the rest.

     So this is not a new document format bolted onto a card. It is the shape
     the runtime has been describing all along, finally drawn. Every section
     renders only from data that is present — an object with one fact shows one
     fact, because "empty is a valid answer" outranks a full-looking page. */

  /* REVEAL IN PLACE. `<details>` is the whole mechanism: keyboard-operable and
     screen-reader-correct for free, no second state machine to keep in step,
     no modal inside a modal (which the standing UI rules forbid outright), and
     it expands the pane rather than covering it — the reveal is more of the
     same object, never a new surface stacked on it. */
  function reveal(label, html, count) {
    if (!html) return '';
    return '<details class="po-more"><summary>' + esc(label) +
      (count ? '<b>' + esc(String(count)) + '</b>' : '') +
      '</summary><div class="po-more__in">' + html + '</div></details>';
  }

  /* A field name off a stored record is a key, not a caption. */
  function fieldName(k) {
    return String(k || '').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }
  var FACT_SKIP = { id: 1, name: 1, title: 1, description: 1, significance: 1,
                    center_id: 1, biz_id: 1, owner: 1, status: 1,
                    resource_type: 1, obj_class: 1, kind: 1 };

  /* THE INFOBOX. `identity` is every scalar the record carries that the
     runtime already judged safe to show this viewer — the public/operational
     boundary is decided there, never here. The name and the description are
     skipped because they are already the pane's title and its lead; repeating
     them in a fact table is how an infobox turns into noise. */
  function factTable(identity) {
    if (!identity) return '';
    var rows = [], vals = [];
    for (var k in identity) {
      if (!Object.prototype.hasOwnProperty.call(identity, k)) continue;
      if (FACT_SKIP[k]) continue;
      var v = identity[k];
      if (v == null || v === '' || typeof v === 'object') continue;
      if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
      vals.push(String(v));
      rows.push('<div class="po-fact"><dt>' + esc(fieldName(k)) + '</dt><dd>' +
                esc(String(v)) + '</dd></div>');
    }
    if (!rows.length) return '';
    /* the first few stand in the open; a long record reveals the rest rather
       than making the reader scroll past a wall of keys to reach the history */
    /* ── PROSE IS NOT A READOUT ────────────────────────────────────────
       The readout sets a value big, in display weight, because a city or a
       count is a THING you came to see. A guestbook entry and a post body
       arrive through the same table and are sentences — set at 19px display
       weight they shout, and the room turns into a wall of headlines.

       Decided from the CONTENT, not per kind: if the typical value is long
       enough to be a sentence, the whole table drops to reading type and one
       column. Nothing has to be declared, and a kind added later gets the
       right treatment on the day it is bound. */
    var longest = 0;
    for (var i2 = 0; i2 < vals.length; i2++) {
      if (vals[i2].length > longest) { longest = vals[i2].length; }
    }
    var prose = longest > 68 ? ' po-facts--prose' : '';
    var head = rows.slice(0, 6).join(''), rest = rows.slice(6).join('');
    return '<dl class="po-facts' + prose + '">' + head + '</dl>' +
      (rest ? reveal('All details',
                     '<dl class="po-facts' + prose + '">' + rest + '</dl>',
                     rows.length - 6) : '');
  }

  /* SEE-ALSO, as objects rather than a table (Brain Laws 5/7/10 — nothing is an
     orphan). Each group is drawn only where the constellation actually has
     members; a heading over an empty group asserts a connection that is not
     there. */
  function connections(rel) {
    if (!rel) return '';
    var out = '';
    var fam = (rel.family || []).filter(function (f) { return f && f.name; });
    if (fam.length) {
      out += section('Part of the same work', noteList(fam.map(function (f) {
        return { text: f.name, note: f.type || '' }; })));
    }
    if ((rel.places || []).length) {
      out += section('Where', noteList((rel.places || []).map(function (p) {
        return { text: typeof p === 'string' ? p : (p.name || ''), note: '' }; })));
    }
    if ((rel.commitments || []).length) {
      out += section('Commitments', noteList((rel.commitments || []).map(function (c) {
        return { text: typeof c === 'string' ? c : (c.label || c.text || ''),
                 note: (c && c.who) || '' }; })));
    }
    if ((rel.people || []).length) {
      out += section('People', noteList((rel.people || []).map(function (p) {
        return { text: typeof p === 'string' ? p : (p.name || ''), note: '' }; })));
    }
    return out;
  }

  /* WHAT CAN BE DONE TO IT — and only what really can.
     `actions` are creation ripples: each names a TYPE the one creation pipeline
     already knows how to begin, so an action routes exactly where `create`
     does and there is no second act path. An action that names no type is
     stated rather than offered — a control that cannot reach anything is the
     button-that-goes-quiet this file exists to prevent, and Gate 3 says the UI
     never invents an affordance the runtime did not offer. */
  function actionsBlock(actions, perms) {
    actions = (actions || []).filter(function (a) { return a && a.label; });
    if (!actions.length) return '';
    /* the runtime answers this per viewer; absent means it did not say, and a
       missing answer is not a yes */
    var mayEdit = !!(perms && perms.edit);
    if (!mayEdit) {
      return section('What happens from here', noteList(actions.map(function (a) {
        return { text: a.label, note: a.why || '' }; })));
    }
    var live = actions.filter(function (a) { return a.act && a.act.type; });
    var told = actions.filter(function (a) { return !(a.act && a.act.type); });
    return section('What you can do',
      (live.length ? '<div class="po-acts po-acts--stack">' + live.map(function (a) {
        return '<button type="button" class="po-act po-act--wide" data-po-create="' +
          esc(a.act.type) + '"><b>' + esc(a.label) + '</b>' +
          (a.why ? '<em>' + esc(a.why) + '</em>' : '') + '</button>';
      }).join('') + '</div>' : '') +
      (told.length ? noteList(told.map(function (a) {
        return { text: a.label, note: a.why || '' }; })) : ''));
  }

  /* The whole article, in reading order: what it is · its facts · what is
     coming · what already happened · what was decided · what it is connected
     to · what is being said about it · what you can do. */
  function renderArticle(d) {
    var histCount = (d.time_back || []).length;
    var hist = timeList(d.time_back, 'po-time--back');
    var convs = (d.conversations || []).filter(function (c) { return c; });

    return '' +
      (d.openHTML || '') +
      factTable(d.identity) +
      (d.time_forward && d.time_forward.length
        ? section('What happens next', timeList(d.time_forward, 'po-time--fwd')) : '') +
      /* HISTORY IS THE SECTION THAT EARNS "WIKIPEDIA". A long one opens with
         its most recent and reveals the rest — dumping thirty entries under a
         heading is a log, and a log is not a history. */
      (histCount
        ? section('What already happened',
            histCount <= 4 ? hist
              : timeList((d.time_back || []).slice(0, 4), 'po-time--back') +
                reveal('Earlier', timeList((d.time_back || []).slice(4), 'po-time--back'),
                       histCount - 4))
        : '') +
      ((d.decisions || []).length
        ? section('Decided', noteList((d.decisions || []).map(function (x) {
            return { text: x.decision || '',
                     note: [x.by, x.at].filter(Boolean).join(' · ') }; })))
        : '') +
      connections(d.relationships) +
      (convs.length
        ? reveal('Conversations', noteList(convs.map(function (c) {
            return { text: c.title || c.subject || c.label || 'A conversation',
                     note: [c.by || c.last_by || '', c.at || c.last_at || '']
                             .filter(Boolean).join(' · ') }; })), convs.length)
        : '') +
      actionsBlock(d.actions, d.permissions);
  }

  /* ── THE FACE — what you are actually looking INTO ──────────────────────
     (founder, 2026-08-16: Popits "are visually beautiful as buttons, but when
     you open them, they do not feel as widgets or as opening parts of the
     ONEWAY world yet.")

     THE CAUSE WAS HERE. §20.1 ranks imagery — real material, then the Center's
     own, then an environmental treatment — and with no photograph the plane
     fell to the bottom rung: a 172px coloured rectangle with the title on it.
     That is the hero banner §20.3 forbids, and it is the same "180px empty
     colored banner" this document opens by naming as the first pass's failure.
     So the FIRST thing a person met on opening any object was dead colour, and
     the object they had just picked up was nowhere on the screen.

     An object already HAS a face — the widget's living body, the bead's
     icon-object — and with no photograph that face is the truest picture of it
     there is. It is derived entirely from the object's own reality, so it
     breaks no law: nothing stock, nothing generated, nothing invented.

     THE DIVISION OF LABOUR THIS SETS UP, and it is the whole shape of the fix:
     THE PLANE HOLDS THE OBJECT — the living thing, at room scale.
     THE BODY HOLDS WHAT THE FACE COULD NOT — the detail, the list, the
     controls, the time. Never the same content twice. */
  function faceOf(d) {
    if (d.faceHTML) {
      return '<div class="po-sheet__face"' +
        (d.faceKind ? ' data-kind="' + esc(d.faceKind) + '"' : '') + '>' +
        d.faceHTML + '</div>';
    }
    /* A BEAD'S FACE IS ITS ICON-OBJECT. It is the thing that was just picked
       up, at scale, in the same candy material it wore on the shelf — so the
       threshold is continuous and you can see what you opened. */
    if (d.icon && ICONS[d.icon]) {
      return '<div class="po-sheet__face" data-kind="mark">' +
        '<i class="po-sheet__ic">' + svg(d.icon) + '</i>' +
        (d.signal ? '<span class="po-sheet__sig">' + esc(d.signal) + '</span>' : '') +
        '</div>';
    }
    return '';
  }

  /* §19 anatomy — strong header · meaningful imagery · supporting context ·
     interactive content. §23 — and its TIME, forward and back. The imagery
     plane never disappears: real material first, then the object's own face,
     and only with neither the tier-4 environmental treatment derived from the
     Center's own hue (§20.1).
     Nothing here is ever filled with stock or generated scenery (Law 15). */
  function renderSheet(d) {
    /* ── A POPIT CAN BE A STAGE ────────────────────────────────────────────
       ★ FOUNDER, 2026-09-09: *"think of each as a mini openable interface to be
         projected over galaxy background in exact hue"* and *"i want full games
         to be able to be built uploaded and played in these like newgrounds."*

       THE RUNTIME FOR THAT ALREADY SHIPS. `POST /api/center/popit-apps` takes
       `kind: "app" | "game"` — its own comment says *"presentation only, same
       container"* — validates a manifest, refuses any source that reaches for
       the host page, issues a one-shot ticket and serves the app under a strict
       CSP into a sandboxed frame with a capability bridge and per-person
       revocable grants. A game can be published and played today.

       WHAT WAS WRONG IS WHERE IT PLAYED. `openApp` appended its own overlay to
       the body with a "Close" bar — a SECOND opened-experience, arriving with
       no unfold, from nowhere, while every other Popit unfolded out of the tile
       you tapped. So a game was not a Popit that happened to be a game; it was
       a different thing wearing the same shelf.

       A stage is the pane with the chrome taken off: no plane, no lead, no
       room — the object fills it edge to edge and the pane is the frame. The
       name still rides the top, because a person needs to know what they
       opened and how to get out. Native kinds that ARE an interface use this
       too; a game is not a special case of it, it is the ordinary case.

       "THE ANIMATION WILL LEAD TO THAT AND BE USED FOR ANYTHING" — so the
       stage is a branch of `renderSheet`, not a second surface. Whatever
       unfolds, unfolds the same way, into the same box, out of the same tile. */
    if (d.stage) {
      return '' +
        '<div class="po-sheet__grab" aria-hidden="true"></div>' +
        '<span class="po-sheet__seam" aria-hidden="true"></span>' +
        '<div class="po-sheet__stage" data-stage>' +
          '<div class="po-stage__bar">' +
            (d.kind_label ? '<span class="po-stage__kind">' + esc(d.kind_label) + '</span>' : '') +
            '<span class="po-stage__name">' + esc(d.label || '') + '</span>' +
          '</div>' +
          '<div class="po-stage__in">' + (d.stageHTML ||
            '<div class="po-stage__wait">Opening</div>') + '</div>' +
        '</div>';
    }
    var hasImg = !!(d.image && d.image.url);
    var img = hasImg
      ? '<img src="' + esc(d.image.url) + '" alt="" loading="lazy" decoding="async" onerror="OW.imgFail(this)">' +
        (d.image.source ? '<span class="po-sheet__src">' + esc(d.image.source) + '</span>' : '')
      : '';
    var face = hasImg ? '' : faceOf(d);
    return '' +
      '<div class="po-sheet__grab" aria-hidden="true"></div>' +
      '<span class="po-sheet__seam" aria-hidden="true"></span>' +
      '<div class="po-sheet__plane"' + (face ? ' data-face' : '') + '>' + img + face +
        '<div class="po-sheet__id">' +
          (d.kind_label ? '<span class="po-sheet__kind">' + esc(d.kind_label) + '</span>' : '') +
          '<span class="po-sheet__name">' + esc(d.label || '') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="po-sheet__body">' +
        /* THE LEAD — what this is, in a sentence, before any structure. The
           lifecycle rides with it because "which state is this in" is the
           first thing a reader needs and the runtime already answers it. */
        (d.glance || d.lifecycle
          ? '<p class="po-sheet__glance">' + esc(d.glance || '') +
            (d.lifecycle ? '<span class="po-state">' + esc(d.lifecycle) + '</span>' : '') +
            '</p>'
          : '') +
        renderArticle(d) +
      '</div>';
  }

  /* ── FILL AN OPEN SHEET WITHOUT OPENING IT AGAIN ───────────────────────
     ★ FOUNDER, 2026-09-08: *"once the popit opening animation is complete we
       start working on actual openable popit widgets."* The animation is the
     gate, so it has to be right before anything else is built on it.

     A Popit now opens INSTANTLY with what the tile already knows and fills in
     when its full projection lands. The canvas did that by calling `OW.open` a
     second time — and `OW.open` cancels every running animation on the sheet
     and rebuilds the FLIP from the origin. MEASURED: two 540ms unfolds 18ms
     apart, so the sheet snapped back to the bead and unfolded a second time.

     The unfold is a promise about WHERE THIS CAME FROM. Playing it twice for
     one tap breaks that promise, and it is the kind of wrongness a person feels
     without being able to name.

     So arriving content re-renders the body and touches nothing else: no
     `ensure`, no hue re-scope, no `is-open`, no lock, and above all no
     animation. `renderSheet` is the SAME function `open` uses, so the two can
     never drift into showing different things. */
  /* THE STAGE NODE, once the pane exists. A caller that has to fetch a ticket
     before it can mount anything needs somewhere to put the result WITHOUT
     re-rendering the pane and cancelling the unfold — the same reason
     `OW.refill` exists. Returns null when the open pane is not a stage, so a
     caller cannot quietly write into an ordinary room. */
  OW.stageNode = function () {
    if (!sheet || !sheet.classList.contains('is-open')) { return null; }
    return sheet.querySelector('.po-stage__in');
  };

  OW.refill = function (data) {
    if (!sheet || !sheet.classList.contains('is-open')) { return false; }
    openData = data || {};
    sheet.innerHTML = renderSheet(openData);
    return true;
  };

  /* ── A PRODUCT (commerce SHOP-2) ──────────────────────────────────────────
     The founder, 2026-10-10: tonight a Center sells in the App. Under the Payments Law Oneway never takes the
     money: Buy opens the Center's OWN checkout (its Shopify, Square or Stripe page) in a new tab, exactly as the
     Center gave it, carrying nothing of the person (noopener, noreferrer), and the sheet says whose checkout it
     is. The product opens as any Popit opens: OW.open, the sheet unfolding from what was pressed. */
  OW.priceWords = function (p) {
    if (!p || !p.price || !p.currency) { return ''; }
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency }).format(Number(p.price));
    } catch (e) { return p.price + ' ' + p.currency; }
  };
  OW.canBuy = function (p) {
    return !!(p && p.available !== false && (p.pays_here || /^https:\/\//i.test(String(p.checkout_url || ''))));
  };
  /* ── PAID ON ONEWAY (founder/744; payments slice 2) ──────────────────────────────────────────────────────────────
     A Center whose own Stripe is connected sells here: Buy asks this server for an order and Stripe's page for it, and
     the person goes to Stripe's page in this tab (a tab opened after an answer is a blocked pop-up). The price, the fee
     and the way back are the server's; the App sends only what was chosen. Stripe brings the person back to the Center
     (#/c/<center>/order/...), where OW.orderBack says, in the server's words, whether it is paid. */
  function choicesOf(p, el) {
    var got = {}, missing = '';
    (p.options || []).forEach(function (o) {
      if (!o || !o.name || !(o.values || []).length) { return; }
      var on = el && el.querySelector('[data-po-pick="' + CSS.escape(o.name) + '"][aria-pressed="true"]');
      if (on) { got[o.name] = on.getAttribute('data-po-value'); } else if (!missing) { missing = o.name; }
    });
    return { choices: got, missing: missing };
  }
  /* A TIP, WHERE THE CENTER ASKS ONE (oneway/tips): its suggested percents and an amount of the person's own; none unless
     pressed. The server takes the tip from what was chosen and refuses in words what it does not offer. */
  function places(cur) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; }
    catch (e) { return 2; }
  }
  function tipOf(p, el) {
    var box = el && el.querySelector('[data-po-tip]');
    if (!box || !box.firstChild) { return null; }
    var own = box.querySelector('[data-po-tip-own]');
    var v = own && String(own.value || '').trim().replace(/^[^0-9.]+/, '');
    if (v) {
      if (!/^\d+(\.\d+)?$/.test(v)) { return false; }
      return { minor: Math.round(Number(v) * Math.pow(10, places(p.currency))) };
    }
    var on = box.querySelector('[data-po-tip-pick][aria-pressed="true"]');
    var pct = on ? Number(on.getAttribute('data-po-tip-pick')) : 0;
    return pct > 0 ? { percent: pct } : null;
  }
  function tipRow(p, box) {
    OW.data.get('/api/oneway/centers/' + encodeURIComponent(p.center_id) + '/tips').then(function (r) {
      var t = r && r.ok && r.data;
      if (!t || !t.on || (t.kinds || []).indexOf('product') < 0 || !box.isConnected) { return; }
      var price = Number(p.price) || 0;
      var amt = function (pct) {
        try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency }).format(price * pct / 100); }
        catch (e) { return ''; }
      };
      box.innerHTML = '<p class="ow-product__d">Add a tip</p><div class="ow-product__buy" role="group" aria-label="Tip">'
        + '<button type="button" class="ow-popit-btn ow-popit-btn--fill" data-po-tip-pick="0" aria-pressed="true">No tip</button>'
        + (t.suggestions || []).map(function (x) {
            return '<button type="button" class="ow-popit-btn" data-po-tip-pick="' + Number(x) + '" aria-pressed="false" aria-label="'
              + Number(x) + ' percent, ' + esc(amt(x)) + '">' + Number(x) + '% <span class="ow-product__whose">' + esc(amt(x)) + '</span></button>';
          }).join('') + '</div>'
        + (t.custom ? '<label class="ow-product__d">Or an amount <input class="ow-product__tipown" data-po-tip-own inputmode="decimal"'
          + ' autocomplete="off" placeholder="3.00" aria-label="Tip amount"></label>' : '')
        + '<p class="ow-product__whose">The tip goes to the team, with your order.</p>';
    });
  }
  OW.pay = function (p, el, btn) {
    if (!p || !p.pays_here || !p.center_id || !OW.data) { return false; }
    var c = choicesOf(p, el);
    if (c.missing) {
      if (!el) { OW.openProduct(p); } else { OW.toast('Choose its ' + c.missing.toLowerCase() + ' first.'); }
      return true;
    }
    var tip = tipOf(p, el);
    if (tip === false) { OW.toast('A tip is an amount, like 3.00.'); return true; }
    if (btn) { btn.disabled = true; }
    OW.data.post('/api/oneway/places/' + encodeURIComponent(p.center_id) + '/checkout',
                 { product_id: p.id, quantity: 1, choices: c.choices, tip: tip }).then(function (r) {
      var url = r && r.ok && r.data && r.data.url;
      if (url && /^https?:\/\//i.test(url)) { global.location.assign(url); return; }
      if (btn) { btn.disabled = false; }
      OW.toast((r && r.error) || 'The checkout did not open. Nothing was charged.');
    });
    return true;
  };
  OW.buy = function (p) {
    if (!OW.canBuy(p)) { return false; }
    if (p.pays_here) { return OW.pay(p, null, null); }
    var w = global.open(p.checkout_url, '_blank', 'noopener,noreferrer');
    if (w) { try { w.opener = null; } catch (e) {} }
    return true;
  };
  /* back from starting a recurring charge (commerce/recurring): "<charge>.back|cancel"; what it is now, in the server's words */
  OW.recurringBack = function (center, ref) {
    var m = /^(rc_[a-f0-9]+)\.(back|cancel)$/.exec(String(ref || ''));
    try { global.history.replaceState(global.history.state, '', (OW.url ? OW.url('#/c/' + encodeURIComponent(center)) : global.location.pathname + '#/c/' + encodeURIComponent(center))); } catch (e) {}
    if (!m || !OW.data) { return; }
    if (m[2] === 'cancel') { OW.toast('Not started. Nothing was charged.'); return; }
    OW.data.get('/api/oneway/me/recurring', { fresh: true }).then(function (r) {
      var x = ((r && r.ok && r.data && r.data.charges) || []).filter(function (c) { return c.id === m[1]; })[0];
      if (!x) { return; }
      OW.toast(x.state === 'active' ? 'You\u2019re in: ' + x.name + ', ' + x.price_words + '.'
                                    : 'Stripe is confirming it. It shows under Me when it starts.', { tone: 'ok' });
    });
  };
  /* back from Stripe: "<order>.<key>.back|cancel", read once; the key leaves the address at once */
  OW.orderBack = function (center, ref) {
    var m = /^(ord_[a-f0-9]+)\.([A-Za-z0-9_-]+)\.(back|cancel)$/.exec(String(ref || ''));
    try { global.history.replaceState(global.history.state, '', (OW.url ? OW.url('#/c/' + encodeURIComponent(center)) : global.location.pathname + '#/c/' + encodeURIComponent(center))); } catch (e) {}
    if (!m || !OW.data) { return; }
    OW.data.post('/api/oneway/orders/' + m[1] + '/receipt', { key: m[2], came: m[3] }).then(function (r) {
      var d = r && r.ok && r.data;
      if (d && d.words) { OW.toast(d.words, { tone: d.state === 'paid' || m[3] === 'cancel' ? 'ok' : 'bad' }); }
      /* a pickup order paid now (pickup/payable.py): its card opens again, saying it is paid, or still to pay at the counter */
      if (d && d.kind === 'pickup_order' && d.ref && OW.pickup && OW.pickup.open) { OW.pickup.open(center, d.ref); }
    });
  };
  if (!doc.__owPayBound) {
    doc.__owPayBound = true;
    doc.addEventListener('input', function (e) {
      var own = e.target && e.target.closest && e.target.closest('[data-po-tip-own]');
      if (!own || !String(own.value || '').trim()) { return; }
      own.closest('[data-po-tip]').querySelectorAll('[data-po-tip-pick]').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false'); b.classList.remove('ow-popit-btn--fill');
      });
    });
    doc.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      var pick = t && t.closest('[data-po-pick]');
      if (pick) {
        e.preventDefault();
        var name = pick.getAttribute('data-po-pick');
        pick.parentNode.querySelectorAll('[data-po-pick]').forEach(function (b) {
          if (b.getAttribute('data-po-pick') !== name) { return; }
          var on = b === pick;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.classList.toggle('ow-popit-btn--fill', on);
        });
        return;
      }
      var tp = t && t.closest('[data-po-tip-pick]');
      if (tp) {
        e.preventDefault();
        tp.parentNode.querySelectorAll('[data-po-tip-pick]').forEach(function (b) {
          var on = b === tp;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.classList.toggle('ow-popit-btn--fill', on);
        });
        var own = tp.closest('[data-po-tip]') && tp.closest('[data-po-tip]').querySelector('[data-po-tip-own]');
        if (own) { own.value = ''; }
        return;
      }
      var pay = t && t.closest('[data-po-pay]');
      if (pay && openProductData) {
        e.preventDefault();
        OW.pay(openProductData, pay.closest('.ow-product'), pay);
      }
    });
  }
  var openProductData = null;
  OW.openProduct = function (p, origin) {
    if (!p || !p.id) { return; }
    var pics = (p.pictures || []).filter(function (x) { return x && x.url; });
    var src = function (u) { return OW.imageUrl ? OW.imageUrl(u) : u; };
    var more = pics.slice(1).map(function (x) {
      return '<img src="' + esc(src(x.url)) + '" alt="' + esc(x.alt || '') + '" loading="lazy" decoding="async">';
    }).join('');
    openProductData = p;
    var buy = !OW.canBuy(p) ? ''
      : p.pays_here
      ? '<button type="button" class="ow-popit-btn ow-popit-btn--fill" data-po-pay>Buy</button>'
        + '<span class="ow-product__whose">Paying takes you to Stripe\u2019s page, which will see your internet address and the card you type.</span>'
      : '<a class="ow-popit-btn ow-popit-btn--fill" href="' + esc(p.checkout_url) + '" target="_blank"'
        + ' rel="noopener noreferrer" data-po-buy>Buy</a>'
        + (p.checkout_host ? '<span class="ow-product__whose">Checkout on ' + esc(p.checkout_host) + '</span>' : '');
    /* THE PICTURE IS THE PRODUCT'S FACE: under its name on the one surface, at its own shape (an open sheet has
       no picture band, by the founder's "no header" rule, so `image` would be a strip behind the name). */
    OW.open({
      kind_label: 'Product', label: p.name || '',
      faceHTML: pics[0] ? '<img src="' + esc(src(pics[0].url)) + '" alt="' + esc(pics[0].alt || '') + '"'
        + (pics[0].width && pics[0].height ? ' width="' + pics[0].width + '" height="' + pics[0].height + '"' : '')
        + ' decoding="async">' : '',
      faceKind: 'product',
      glance: OW.priceWords(p), lifecycle: p.available === false ? 'Sold out' : '',
      openHTML: '<div class="ow-product">'
        + (p.description ? '<p class="ow-product__d">' + esc(p.description) + '</p>' : '')
        /* its choices, as its owner named them (PLAN B8 slice 3); the store's own page takes the one a person picks */
        + (p.options || []).filter(function (o) { return o && o.name && (o.values || []).length; }).map(function (o) {
            /* paid here, each choice is picked on the sheet (one of its values, pressed); otherwise the store's own page
               takes it, and the sheet only says what there is */
            if (p.pays_here && OW.canBuy(p)) {
              return '<p class="ow-product__d" data-po-option>' + esc(o.name) + '</p><div class="ow-product__buy" role="group" aria-label="' + esc(o.name) + '">'
                + o.values.map(function (v) {
                    return '<button type="button" class="ow-popit-btn" data-po-pick="' + esc(o.name) + '" data-po-value="' + esc(v.label) + '" aria-pressed="false">' + esc(v.label) + '</button>';
                  }).join('') + '</div>';
            }
            return '<p class="ow-product__d" data-po-option>' + esc(o.name) + ': ' + esc(o.values.map(function (v) { return v.label; }).join(' \u00b7 ')) + '</p>';
          }).join('')
        + (more ? '<div class="ow-product__pics">' + more + '</div>' : '')
        + (p.pays_here && OW.canBuy(p) ? '<div class="ow-product__tip" data-po-tip></div>' : '')
        + (buy ? '<div class="ow-product__buy">' + buy + '</div>' : '')
        /* ORDER TO PICK UP, PAY AT THE COUNTER (oneway/pickup; frontend/shared/oneway-pickup.js draws it, loaded when wanted) */
        + '<div class="ow-product__pickup" data-po-pickup></div>'
        + '</div>'
    }, origin);
    var tb = doc.querySelector('.ow-product [data-po-tip]');
    if (tb && OW.data) { tipRow(p, tb); }
    var pu = doc.querySelector('.ow-product [data-po-pickup]');
    if (pu && p.center_id) {
      (OW.need ? OW.need('pickup') : Promise.resolve()).then(function () { if (OW.pickup) OW.pickup.offer(p, pu); }, function () {});
    }
  };

  OW.open = function (data, origin) {
    ensure();
    data = data || {};
    openData = data;
    openSeq++;
    clearTimeout(outTimer);
    if (originEl) originEl.style.visibility = '';
    lastFocus = doc.activeElement;

    sheet.style.removeProperty('--ow-h1'); sheet.style.removeProperty('--ow-h2');
    if (data.hue) {
      /* a Center portal makes the WORLD respond; a plain object tints only the
         sheet. One entry point, so a Center can never be opened without the
         world carrying its light (§17). */
      if (data.world) { hue.tween(data.hue.h1, data.hue.h2, 800); worldTweened = true; }
      else hue.scope(sheet, data.hue.h1, data.hue.h2);
    }

    sheet.innerHTML = renderSheet(data);
    sheet.classList.add('is-open');
    scrim.classList.add('is-on');
    lock();

    originEl = origin || null;
    sheet.getAnimations().forEach(function (a) { a.cancel(); });
    /* every measurement below is of the UNTRANSFORMED box, so nothing from a
       previous open may still be holding the pane off-centre */
    sheet.style.transform = '';

    /* where it will come to rest, decided BEFORE the FLIP is built so the
       unfold ends exactly where the beam will be aimed */
    restAt = restPlace();

    /* FLIP — the sheet unfolds FROM the bead's box. Nothing teleports. */
    var m = sheet.getBoundingClientRect();
    var o = originEl ? originEl.getBoundingClientRect() : null;
    /* SIMPLE OPENS PLAINLY (his walk, 2026-11-08, item 22: "On simple mode, they don't have to have the pop-it opening animation. But on
       pop-it mode, that opening animation should be perfect"): no unfold from the piece and no beam, the sheet fades in where it rests */
    var plain = doc.documentElement.getAttribute('data-simple') === '1';
    if (plain) {
      sheet.style.transform = restTransform();
      sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OW.motion.ms('press'), easing: OW.motion.ease('ease-out') });
      sheet.focus({ preventScroll: true });
      return;
    }
    if (o && o.width && m.width) {
      var sx = Math.max(o.width / m.width, .04), sy = Math.max(o.height / m.height, .04);
      /* the emitter's offset is measured from the pane's CENTRED box, so the
         resting displacement is subtracted out — otherwise the unfold starts
         one step to the side of the object it is supposed to come from */
      var tx = (o.left + o.width / 2) - (m.left + m.width / 2) - restAt.x;
      var ty = (o.top + o.height / 2) - (m.top + m.height / 2) - restAt.y;
      /* THE BEAD LIFTS OFF — but its PLACE stays lit. §4: an open Popit is
         "tethered to its origin (you can feel where it came from)", and a
         hidden bead leaves a hole in the arrangement, which is what makes the
         sheet read as a dialog that arrived rather than this object, opened.
         The socket is drawn by CSS on the origin itself, so it inherits that
         object's own hue and needs no second element to keep in position
         through a scroll or a resize (§18). */
      originEl.setAttribute('data-po-open', '');
      originEl.style.visibility = 'hidden';
      sheet.style.willChange = 'transform,opacity';
      var a = sheet.animate([
        { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + sx + ',' + sy + ') rotate(0deg)', opacity: .55, offset: 0 },
        { opacity: 1, offset: .45 },
        { transform: restTransform(), opacity: 1, offset: 1 }
      ], { duration: OW.motion.ms('open'), easing: OW.motion.ease('ease-out'), fill: 'both' });
      /* S33: drawn out and soft. Not a spring: the old .34,1.56 curve drew the open sheet past its own size before it
         settled, the "cards ... become super large" founder/863 saw; a sheet this big lands on the long ease instead */
      /* HAND THE REST POSITION TO INLINE STYLE AND RELEASE THE FILL. A filling
         animation outranks inline style in the cascade, so while it holds the
         pane nothing can measure the resting box — every rect read comes back
         mid-unfold. Committing it means a resize can re-measure honestly (§18),
         which is the whole reason the beam can be re-aimed at all. */
      a.finished.then(function () {
        sheet.style.willChange = '';
        sheet.style.transform = restTransform();
        a.cancel();
        /* AND NOW CHECK THE REAL BOX. Everything up to here is prediction: the
           step was decided from a measurement taken before the pane had its
           resting rotation, before a web font had reflowed the room, and before
           max-height had settled against the final content. Four kinds out of
           sixteen ended up 30-50px off the edge that way, and every intermediate
           number in each looked reasonable — which is exactly the shape of
           finding this project keeps having to un-publish.

           So the outcome is measured rather than trusted, once, after it comes
           to rest. If the pane is not fully inside the stage it gives up the
           step and centres, which is always safe and always visible. */
        settleInStage();
      }).catch(function () {});
    }
    /* THE BEAM IS AIMED AT WHERE THE PANE COMES TO REST — never at where it is
       mid-unfold. `m` was measured with every animation cancelled, so it is the
       true centred layout box; the resting box is that box, stepped aside. */
    aimBeam(m && m.width ? { left: m.left + restAt.x, top: m.top + restAt.y,
                             width: m.width, height: m.height } : null);
    sheet.focus({ preventScroll: true });
  };

  OW.close = function () {
    if (!sheet || !sheet.classList.contains('is-open')) return;
    clearTimeout(outTimer);
    scrim.classList.remove('is-on');
    if (beam) beam.classList.remove('is-on');   /* the light goes first */
    if (worldTweened) { hue.reset(700); worldTweened = false; }
    sheet.getAnimations().forEach(function (a) { a.cancel(); });

    /* Fold back into the bead's LIVE rect, so it lands on the exact object
       even if the page scrolled or resized while it was open (§18). */
    var o = { tx: 0, ty: 0, sx: .2, sy: .2 };
    if (originEl) {
      var br = originEl.getBoundingClientRect(), mr = sheet.getBoundingClientRect();
      if (br.width && mr.width) o = {
        sx: br.width / mr.width, sy: br.height / mr.height,
        tx: (br.left + br.width / 2) - (mr.left + mr.width / 2),
        ty: (br.top + br.height / 2) - (mr.top + mr.height / 2)
      };
    }
    sheet.style.willChange = 'transform,opacity';
    /* THE FOLD TARGET IS RELATIVE TO THE LAYOUT BOX, NOT THE RESTING ONE.
       `o.tx/o.ty` is the gap from where the pane IS to the bead; the keyframe
       is a transform applied to the untransformed box, so the step-aside has to
       be added back or the pane folds into a point one step off the object —
       visible as a miss on every Popit that stepped, and invisible on every one
       that did not, which is exactly the kind of half-right that survives. */
    /* Simple closes as it opened: a fade where it rests (item 22) */
    var a = doc.documentElement.getAttribute('data-simple') === '1'
      ? sheet.animate([{ transform: restTransform(), opacity: 1 }, { transform: restTransform(), opacity: 0 }],
                      { duration: OW.motion.ms('press'), easing: OW.motion.ease('ease-leave'), fill: 'forwards' })
      : sheet.animate([
      { transform: restTransform(), opacity: 1, offset: 0 },
      { opacity: 1, offset: .72 },
      { transform: 'translate(' + (o.tx + restAt.x) + 'px,' + (o.ty + restAt.y) + 'px) scale('
                   + o.sx + ',' + o.sy + ') rotate(0deg)', opacity: 0, offset: 1 }
    ], { duration: OW.motion.ms('leave'), easing: OW.motion.ease('ease-leave'), fill: 'forwards' });

    var seq = openSeq;
    var done = function () {
      /* ── A CANCELLED CLOSE IS NOT A FINISHED CLOSE ─────────────────────
         MEASURED 2026-09-08: close a Popit and open another within ~400ms and
         the second one lost `is-open` — its open styling, the scroll lock, the
         focus trap, and every late projection, because `OW.refill` refuses a
         sheet that is not open. So a person who closed Where and tapped Links
         got a title and nothing else: the founder's brief-info complaint,
         reappearing as a RACE rather than as a missing projection.

         The cause is that `a.finished.then(done).catch(done)` treats a
         CANCELLED animation as a completed one — and `OW.open` cancels every
         running animation on the sheet by design, which is correct. What was
         wrong is what the cancellation then meant. `clearTimeout(outTimer)` in
         `open` already killed the belt-and-braces timer; nothing killed this.

         Not fixed by removing the `.catch`: cancellation is one of several
         ways `finished` rejects, and a close that never cleans up leaks the
         scroll lock. The generation says which sheet this cleanup belongs to. */
      if (seq !== openSeq) { return; }
      sheet.classList.remove('is-open');
      sheet.style.willChange = '';
      sheet.style.transform = '';
      if (originEl) { originEl.style.visibility = ''; originEl.removeAttribute('data-po-open'); }
      unlock();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      originEl = null; lastFocus = null; openData = {};
    };
    a.finished.then(done).catch(done);
    outTimer = setTimeout(done, 420);   /* belt-and-braces if finished never resolves */
  };

  /* 6.2 — ONE STATE, TWO VIEWS OF IT. A way to begin is now rendered on the
     tile AND inside the room the tile opens, which is correct — you must be
     able to act on the thing you have opened — but it means one piece of
     reality has two controls. This carries a confirmed change from whichever
     was pressed to the other, scoped to the open pair (the sheet and the exact
     origin it unfolded from), so it can never reach a different widget that
     happens to share a verb.

     IT SETTLES NOTHING ITSELF. The state came from the server through OW.act;
     this only stops the second view from contradicting the first. */
  OW.mirrorAct = function (verb, on, from) {
    if (!verb) return;
    var scopes = [sheet, originEl];
    for (var i = 0; i < scopes.length; i++) {
      var s = scopes[i];
      if (!s || !s.querySelectorAll) continue;
      var list = s.querySelectorAll('[data-po-act="' + String(verb).replace(/"/g, '') + '"]');
      for (var j = 0; j < list.length; j++) {
        var b = list[j];
        if (b === from) continue;                 /* the one that was pressed
                                                     already carries the state */
        b.setAttribute('aria-pressed', String(!!on));
        b.setAttribute('data-act', on ? 'on' : 'off');
        /* the label the sibling would have shown for this state, taken from
           that control's own markup rather than re-derived here */
        var w = (openData.widget && openData.widget.ways) || [];
        for (var k = 0; k < w.length; k++) {
          if (w[k].verb !== verb) continue;
          b.textContent = on ? (w[k].labelOn || (w[k].label + 'ing')) : w[k].label;
          break;
        }
      }
    }
  };

  /* 6.1 — MOBILE DRAG-TO-DISMISS. On a phone the sheet rests against the
     bottom edge, so the native gesture is a downward drag. Transform-only
     while the finger is down; past a third of its height (or a fast flick) it
     folds back into the bead exactly as a tap-away would. */
  function attachDrag() {
    var y0 = null, dy = 0, t0 = 0, h = 0;
    function start(e) {
      if (!sheet.classList.contains('is-open')) return;
      if (global.innerWidth > 640) return;
      if (sheet.scrollTop > 0) return;            /* let content scroll first */
      y0 = e.touches[0].clientY; dy = 0; t0 = performance.now();
      h = sheet.getBoundingClientRect().height || 1;
      sheet.classList.add('is-dragging');
    }
    function move(e) {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy < 0) dy = 0;
      sheet.style.transform = 'translateY(' + dy + 'px)';
      scrim.style.opacity = String(Math.max(0, 1 - dy / h));
    }
    function end() {
      if (y0 == null) return;
      var v = dy / Math.max(1, performance.now() - t0);
      sheet.classList.remove('is-dragging');
      sheet.style.transform = ''; scrim.style.opacity = '';
      if (dy > h / 3 || v > .5) OW.close();
      y0 = null; dy = 0;
    }
    doc.addEventListener('touchstart', function (e) {
      if (sheet.contains(e.target)) start(e);
    }, { passive: true });
    doc.addEventListener('touchmove', function (e) { if (y0 != null) move(e); }, { passive: true });
    doc.addEventListener('touchend', end);
    doc.addEventListener('touchcancel', end);
  }


  /* ═══ 8 · POPIT WIDGETS ════════════════════════════════════════════════
     "Widgets are what people display to other users when clicked on their
     profile." (founder, 2026-07-28)

     So a widget is a MEETING, not a decoration. Everything below follows from
     that one sentence:

     · IT IS BUILT FOR A VISITOR. The glance is what a stranger reads in half a
       second; the open state is the room they step into. A widget that only
       makes sense to its owner is a settings panel.

     · THE SAME PROFILE IS A DIFFERENT PROJECTION PER VISITOR (the Perspective
       Law). Each widget declares who may meet it; mountProfile never BUILDS
       the tiles a viewer is not entitled to — nothing is hidden by CSS, so
       nothing can leak by a filter someone forgets.

     · IT PROJECTS REALITY THE PLATFORM ALREADY HOLDS. Belonging comes from the
       relationship graph, marks from real attendance, the guestbook from other
       people. `said` is the ONE authored widget and it is visibly a person
       talking — the honest widgets stay trustworthy only if the written one is
       never dressed up as a derived fact. */

  /* how much of the grid each size claims — used to enforce a kind's minimum */
  var SIZE_RANK = { '1x1':1, '2x1':2, '3x1':3, '4x1':4, '2x2':5, '4x2':6 };

  /* who may meet a widget. A visitor's standing is resolved by the caller from
     the real relationship graph; this only ranks it. */
  var RELATION = { stranger:0, follower:1, member:2, self:3 };
  var VISIBILITY = {
    public:0, followers:1, members:2, private:3,
    /* ── `member`, SINGULAR, IS THE RUNTIME'S SPELLING AND IT IS 20 SITES ──
       Measured in `api/main.py`: `visibility="member"` × 20. This table said
       `members`. One missing "s", and it flipped meaning twice in one day:
       BEFORE the fail-closed fix it leaked member-only items to strangers;
       AFTER it, the same "s" hid them from the members they belong to. Both
       wrong — the second is the safe wrong and still wrong.

       WHAT IT WAS HIDING IS EXACTLY WHAT HE SAYS IS MISSING: a person's own
       attendance history (`profile_attended_event`, `profile_interested_event`)
       and a Center's installed Systems. *"People still don't have widgets on
       their profiles"* is partly this.

       AN ALIAS IS THE STOPGAP, NOT THE ANSWER. Two spellings of one concept is
       the duplication the ecosystem priority forbids; the fix is for the
       runtime to converge on `members` and for this line to be deleted. That
       crosses the seam, so it is the runtime session's, and until it lands
       nothing should be locked out. */
    member:2
  };
  /* THE RUNTIME ALSO EMITS AN OPERATIONAL VOCABULARY THIS TABLE DELIBERATELY
     DOES NOT KNOW: `staff` (14) · `center` · `organization` · `admin_os` ·
     `team_portal` · `both` · `shared` · `parents`. They are ROLES inside a
     Center, not RELATIONS a visitor can hold — and the App's whole relation
     vocabulary is stranger · follower · member · self, none of which can
     satisfy "staff". So they fall through to the unknown branch and fail
     closed, which is the correct answer rather than a gap: before today every
     one of them computed `public`, which made `admin_os` — the most restricted
     word in the platform — as visible as a public post. */
  /* WHO MAY MEET A WIDGET — and what happens when the caller says a word this
     table does not know.

     THE BUG THIS COMMENT EXISTS FOR (found 2026-08-16): `oneway-app.html` opens
     every other person's profile with `relation:'known'`. There is no `known`
     here, so `RELATION['known']` was `undefined`, `undefined >= 0` is FALSE,
     and EVERY widget was filtered out — including `visibility:'public'` ones,
     which by definition a stranger may see. Every profile in the App rendered
     `data-shown="0"` and read as "this person has put nothing here", for
     everyone, always. Nothing threw; the grid was built and silently emptied.

     AN UNKNOWN RELATION IS NOW THE LOWEST STANDING, NOT NO STANDING. That is
     the safe direction and the correct one at the same time: an unrecognised
     word grants what a stranger gets and never more, so a typo can only ever
     under-share. Failing to `false` looked safe and was actually a data-loss
     bug wearing a security costume.

     It also says so out loud. A caller passing a word this table does not know
     is a defect in that caller, and the whole reason this survived is that it
     was silent. */
  function mayMeet(w, relation) {
    /* ── AN UNKNOWN PRIVACY WORD FAILS CLOSED. ───────────────────────────
       This function had two guards pointing in OPPOSITE safety directions,
       and only one of them was noticed. An unknown RELATION warns loudly and
       falls back to `stranger` — least privilege, correct. An unknown
       VISIBILITY did `need = 0`, which is `public`: **a word this table did
       not recognise was shown to everyone, silently.**

       ABSENT AND UNKNOWN ARE NOT THE SAME THING and that is the whole fix.
       A widget that declares NO visibility is public by design — it said
       nothing, and nothing means open here. A widget that declares a word
       this table cannot resolve has said something we failed to understand,
       and the only safe reading of "I could not understand your privacy
       setting" is the most private one.

       NOT HYPOTHETICAL. The runtime shipped location audiences the same day:
       `nobody · chosen · followers · friends · places · everyone`. This table
       knows `public · followers · members · private`. Of those six words FIVE
       are unknown here — so anything carrying `visibility:"friends"` would
       have rendered to strangers. */
    var declared = w.visibility;
    var need;
    if (declared == null || declared === '') {
      need = 0;                                  /* said nothing → public */
    } else {
      need = VISIBILITY[declared];
      if (need == null) {                        /* said something we cannot read */
        if (!mayMeet._vwarned) mayMeet._vwarned = {};
        if (!mayMeet._vwarned[declared]) {
          mayMeet._vwarned[declared] = 1;
          try {
            console.warn('[oneway-popit] unknown visibility "' + declared +
              '" — treated as PRIVATE. Known: ' + Object.keys(VISIBILITY).join(', '));
          } catch (_) {}
        }
        need = VISIBILITY.private;               /* fail closed, and say so */
      }
    }
    var word = relation || 'stranger';
    var has = RELATION[word];
    if (has == null) {
      if (!mayMeet._warned) {
        mayMeet._warned = {};
      }
      if (!mayMeet._warned[word]) {
        mayMeet._warned[word] = 1;
        try {
          console.warn('[oneway-popit] unknown relation "' + word +
            '" — treated as stranger. Known: ' + Object.keys(RELATION).join(', '));
        } catch (_) {}
      }
      has = RELATION.stranger;
    }
    return has >= need;
  }

  function hueVars(c) {
    return '--ch1:' + (c.h1 || '124,45,255') + ';--ch2:' + (c.h2 || c.h1 || '93,226,255');
  }



  /* ── LINK SAFETY ────────────────────────────────────────────────────────
     These URLs are typed by people, so they are the one place on a profile
     where untrusted input becomes something a visitor can activate. Two hard
     rules, both enforced here rather than trusted to a caller:

       · ONLY http(s). A javascript:, data: or vbscript: URL in a profile is a
         script-injection dressed as a link, so it is dropped outright — not
         escaped, not warned about, dropped.
       · EVERY outbound link is rel="noopener noreferrer" and opens away, so a
         destination can never reach back into the page that linked it.

     And the host is extracted for DISPLAY, because a visitor is entitled to
     know where a tap goes before they take it. */
  function safeUrl(u) {
    var v = String(u == null ? '' : u).trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;   /* another scheme — refuse */
      v = 'https://' + v;                                 /* bare host — assume https */
    }
    try { var p = new URL(v); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : null; }
    catch (_) { return null; }
  }
  function hostOf(u) {
    try { return new URL(u).host.replace(/^www\./, ''); } catch (_) { return ''; }
  }
  /* A neutral icon inferred from the destination when a person chose none.
     Deliberately NOT a redrawn brand mark: approximating someone else's logo is
     the same fabrication the identity law forbids for Centers, and the host is
     already on the row doing the recognising. */
  var HOST_ICON = [
    [/spotify|soundcloud|bandcamp|apple\.com\/.*music|tidal/i, 'music'],
    [/youtube|youtu\.be|vimeo|twitch|tiktok/i,                 'video'],
    [/instagram|flickr|behance|dribbble|unsplash|pinterest/i,  'camera'],
    [/etsy|shopify|gumroad|ebay|amazon|shop/i,                 'cart'],
    [/mailto|gmail|proton|substack.*subscribe/i,               'mail'],
    [/substack|medium|wordpress|ghost\.io|notion/i,            'write'],
    [/github|gitlab|codeberg/i,                                'layers'],
    [/eventbrite|meetup|luma|lu\.ma/i,                         'event'],
    [/discord|slack|whatsapp|telegram|signal/i,                'talk']
  ];
  function iconForLink(l) {
    if (l.icon && ICONS[l.icon]) return l.icon;
    var u = l.url || '';
    for (var i = 0; i < HOST_ICON.length; i++) if (HOST_ICON[i][0].test(u)) return HOST_ICON[i][1];
    return 'link';
  }

  /* A CREATION TYPE, AS AN OBJECT. The ids are the runtime's own registry
     (`register_creation_type`), so this is a READING of that list and never a
     second list of what can be created — a type it does not name still takes
     its place on the shelf wearing `spark`, which honestly says "something you
     can make" rather than dressing it as a document it is not. */
  var CREATE_ICON = {
    post:'talk', note:'write', website:'globe',
    budget:'cart', offer:'cart',
    campaign:'mail', invitation:'mail',
    event:'event', schedule:'event',
    flyer:'camera', presentation:'camera',
    document:'doc', article:'doc', guide:'doc', sop:'doc', policy:'doc',
    playbook:'doc', form:'doc', menu:'doc', tracking_plan:'doc',
    template:'layers', workflow:'layers', system_definition:'layers',
    app:'layers', widget_popit:'layers',
    decision:'bookmark', next_step:'bookmark', initiative:'bookmark',
    responsibility:'people'
  };
  function linkRows(list, limit) {
    var out = '', n = 0;
    for (var i = 0; i < list.length; i++) {
      var href = safeUrl(list[i].url);
      if (!href) continue;                       /* refused, and silently absent */
      if (limit && n >= limit) break;
      n++;
      out += '<a class="po-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">'
        + '<span class="po-link__ic">' + svg(iconForLink(list[i])) + '</span>'
        + '<span class="po-link__t"><span class="po-link__n">' + esc(list[i].name || hostOf(href)) + '</span>'
        + '<span class="po-link__h">' + esc(hostOf(href)) + '</span></span>'
        + '<span class="po-link__go" aria-hidden="true">&#8599;</span></a>';
    }
    return { html: out, shown: n };
  }
  function usableLinks(list) {
    return (list || []).filter(function (l) { return !!safeUrl(l.url); });
  }

  /* ── THE IDENTITY FIELD — shared by Where She's Been and Her World ──────
     One component, two readings. Positions come from the DATA (x/y, 0-100), so
     the same person always reads the same field on every device and reload
     (Gate 5). When a position is absent it is derived deterministically from
     the index and the tie — never randomised, because a field that reshuffles
     on reload is decoration, not a map. */
  function idMark(it, opts) {
    opts = opts || {};
    var isPerson = it.type === 'person';
    var cls = 'po-id ' + (isPerson ? 'po-id--person' : 'po-id--place') + (it.me ? ' po-id--me' : '');
    var inner = it.logo
      ? '<img src="' + esc(it.logo) + '" alt="" loading="lazy" decoding="async">'
      : (it.icon && ICONS[it.icon] ? svg(it.icon) : '');
    /* ── THE MARK MUST CARRY ITS OWN NAME ────────────────────────────────
       Founder, 2026-08-19: the widgets *"dont seem working or alive."* This is
       a large part of why. The name was in a `title` tooltip on an element
       marked `aria-hidden="true"` — so it reached:

           a phone          NO   there is no gesture that reveals a title
           a screen reader  NO   aria-hidden excludes it by definition
           a keyboard       NO   <i> is not focusable

       On the surface he was looking at, `world` was a box holding two unlabelled
       circles and a legend reading "belongs · follows" — a key explaining a
       relationship between two things it would not name. **The content was
       there the whole time and reached nobody.**

       `role="img"` + `aria-label` names it as ONE thing rather than announcing a
       decorative element's contents, and `title` stays for the desktop hover it
       already served. `data-name` is carried so the surface can draw the label
       visibly when the composition has room — that is a layout decision and it
       belongs to whoever composes the field, not here. */
    var _label = esc(it.name || '') + (it.note ? ' — ' + esc(it.note) : '');
    /* THE NAME, DRAWN — when the field is sparse enough to hold it.
       `opts.named` is set by the composer, which knows how many marks are in
       the box; below that count a field is not a constellation, it is a mostly
       empty rectangle containing two circles, and a name beside each is the
       only thing that makes it mean anything at a glance.

       MEASURED ON A PHONE, WHICH CHANGED THE NUMBER: the field is 214px wide
       there (not the 460 a desktop shows) and a full name at 11px runs 138px —
       so ONE fits per row, not three. The label is therefore capped and
       ellipsised rather than trusted to be short: a name that overruns its box
       is worse than the tooltip it replaced. */
    var _nm = (opts.named && it.name)
      ? '<b class="po-id__nm">' + esc(it.name) + '</b>' : '';
    return '<i class="' + cls + (_nm ? ' po-id--named' : '') + '"'
      + ' style="left:' + it.x + '%;top:' + it.y + '%;' + hueVars(it) + '"'
      + (it.weight ? ' data-w="' + it.weight + '"' : '')
      + (it.relation ? ' data-rel="' + esc(it.relation) + '"' : '')
      + (it.name ? ' data-name="' + esc(it.name) + '"' : '')
      + ' title="' + _label + '"'
      + (it.name
          ? ' role="img" aria-label="' + _label + '"'
          /* nameless marks stay decorative — announcing "image" with no name is
             noise, and a screen reader reading twenty of those is worse than
             silence */
          : ' aria-hidden="true"')
      + '>' + _nm + '</i>';
  }

  /* Lay out items that carry no position: a deterministic spiral, tighter for
     stronger ties, so belonging sits nearer the centre than following does. */
  function placeItems(items, anchored) {
    var n = items.length;
    return items.map(function (it, i) {
      if (it.x != null && it.y != null) return it;
      var strong = it.relation === 'member' || it.relation === 'belongs';
      var a = (i / Math.max(1, n)) * 6.2832 - 1.1;
      var r = (anchored ? (strong ? 26 : 40) : 34) + ((i * 7) % 11);
      /* ★ THE CLAMP IS FOR THE MARK, NOT THE POINT.
         ★ FOUNDER, 2026-08-30: *"i dont want to see any cut out or ... text
           anywhere."*

         A point at `top:88%` is inside the box; the MARK drawn on it is not —
         it carries a circle and, when named, a label underneath, and both hang
         BELOW the anchor. Measured on the profile: the field wanted 195px in a
         145px body and the bottom row of names was being shaved off.

         So the placement range leaves room for what is drawn on each point
         rather than for the point itself. The field is a mostly-empty
         rectangle at the counts real people have — its own comment below says
         so — so tightening the orbit costs nothing visually and removes the
         clip entirely. */
      return Object.assign({}, it, {
        x: Math.max(10, Math.min(84, 50 + Math.cos(a) * r * .86)),
        y: Math.max(12, Math.min(74, 50 + Math.sin(a) * r * .66))
      });
    });
  }

  /* shallow merge — this file avoids Object.assign for the engines it targets */
  function _assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var o = arguments[i] || {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) t[k] = o[k];
    }
    return t;
  }

  function fieldBody(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return '<span class="po-w__foot">' + esc(opts.empty || 'Nothing yet') + '</span>';
    var pts = placeItems(items, !!opts.anchor);
    /* ── NAME THEM WHILE THEY FIT, THEN STOP ─────────────────────────────
       Founder, 2026-08-19: the widgets *"dont seem working or alive."* At the
       counts real people have, this box is not a constellation with a density
       problem — it is a mostly-empty rectangle containing two circles, and
       nothing collides. A name beside each mark is what makes it mean anything
       at a glance.

       THE CUTOFF IS WHAT FITS, NOT A PREFERENCE. Measured on a phone: the field
       is 214px wide and a name at 11px runs up to 138px — ONE per row, not the
       three a 460px desktop box allows. So the threshold is low and the label
       is capped (`.po-id__nm`, ellipsised) rather than trusted to be short. A
       name that overruns its box is worse than the tooltip it replaced.

       Above it, the field is genuinely dense and labels would collide — and the
       marks are not lost: each carries `aria-label`, and the room lists every
       one of them in words. */
    var named = pts.length <= 4;
    var out = '<div class="po-field"' + (named ? ' data-named' : '') + '>';
    /* threads exist only where a real tie does */
    if (opts.anchor) {
      var me = pts.filter(function (p) { return p.me; })[0];
      if (me) pts.forEach(function (p) {
        if (p === me) return;
        var dx = p.x - me.x, dy = p.y - me.y;
        out += '<i class="po-field__t"' + (p.relation === 'following' ? ' data-weak' : '')
            + ' style="left:' + me.x + '%;top:' + me.y + '%;width:'
            + Math.sqrt(dx * dx + dy * dy) + '%;transform:rotate('
            + (Math.atan2(dy, dx) * 57.2958) + 'deg)"></i>';
      });
    }
    pts.forEach(function (p) {
      out += idMark(p, named ? _assign({}, opts, {named: true}) : opts);
    });
    if (opts.key) out += '<span class="po-field__key">' + esc(opts.key) + '</span>';
    return out + '</div>';
  }

  function fieldRoom(groups) {
    return groups.filter(function (g) { return g.items && g.items.length; })
      .map(function (g) {
        return '<div><div class="po-sheet__label">' + esc(g.label) + '</div><ul class="po-time">'
          + g.items.map(function (it) {
              return '<li>' + esc(it.name || '')
                + (it.note ? '<time>' + esc(it.note) + '</time>' : '') + '</li>'; }).join('')
          + '</ul></div>';
      }).join('');
  }

  /* ── A SHELF OF ICON-OBJECTS — the face for a kind whose body is controls ──
     §15's "tray of distinct gummy icon-objects", reusing the mark material
     rather than inventing a second one: a shelf is what `marks` already is, and
     a second gummy tile would be a second rule to keep in step with the first.
     Every item is derived from the object's own data — the hosts a person
     actually linked, the types they can actually begin. Nothing is padded. */
  function objShelf(items) {
    if (!items || !items.length) return '';
    return '<div class="po-marks po-marks--room">' + items.map(function (it) {
      return '<i class="po-mark" title="' + esc(it.name || '') + '"'
        + (it.hue ? ' style="' + hueVars(it.hue) + '"' : '') + '>'
        + (it.icon && ICONS[it.icon] ? svg(it.icon) : '') + '</i>';
    }).join('') + '</div>';
  }

  /* A room section. Kept to one shape so every kind's detail reads the same
     way, and so an empty section is impossible to render by accident — a
     heading over nothing is exactly the padding the empty law forbids. */
  function section(label, html) {
    return html ? '<div><div class="po-sheet__label">' + esc(label) + '</div>' + html + '</div>' : '';
  }
  function noteList(rows) {
    rows = (rows || []).filter(function (r) { return r && r.text; });
    if (!rows.length) return '';
    return '<ul class="po-time">' + rows.map(function (r) {
      return '<li>' + esc(r.text) + (r.note ? '<time>' + esc(r.note) + '</time>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* ── THE CONTROLS, WRITTEN ONCE ──────────────────────────────────────────
     The tile renders them and so does the room, and they must be the SAME
     controls: a second copy is a second state to keep true, which is how a
     button comes to say "Joining" in one place and "Join" in another. Gate 3
     still holds at both scales — only the ways the server said are possible
     are ever drawn. */
  function actRow(ways) {
    ways = ways || [];
    if (!ways.length) return '<span class="po-w__note">No way to begin here yet.</span>';
    return '<div class="po-acts">' + ways.map(function (w) {
      return '<button type="button" class="po-act" data-po-act="' + esc(w.verb) + '"'
        + ' aria-pressed="' + (w.on ? 'true' : 'false') + '"'
        + ' data-act="' + (w.on ? 'on' : 'off') + '">'
        + esc(w.on ? (w.labelOn || (w.label + 'ing')) : w.label) + '</button>';
    }).join('') + '</div>';
  }
  function createRow(options) {
    options = options || [];
    if (!options.length) return '<span class="po-w__note">Nothing to begin yet.</span>';
    return '<div class="po-acts po-acts--stack">' + options.map(function (c) {
      /* `label` is the distinct thing (Post · Event · Flyer); `verb` and
         `lands` are the same for every row, so leading with them made four
         identical-looking options. The name leads; where it lands follows. */
      var name = c.label || c.type || '';
      var where = [c.begins ? ('a ' + c.begins) : '', c.lands ? ('in ' + c.lands) : '']
                    .filter(Boolean).join(' · ');
      return '<button type="button" class="po-act po-act--wide" data-po-create="'
        + esc(c.type || '') + '"><b>' + esc(name) + '</b>'
        + (where ? '<em>' + esc(where) + '</em>' : '') + '</button>';
    }).join('') + '</div>';
  }

  /* Each kind owns its eyebrow, its default span, its BODY (what a visitor
     sees at a glance) and its ROOM (what opening it reveals). Adding a widget
     kind is a registration here — never a change to the grid, the material or
     the sheet. */
  var WIDGET = {

    /* THE STORY BAR ON HOME'S CANVAS (founder/1220): canvas.js draws the strip itself in its piece; this names it for the one list */
    stories: { eyebrow:'Stories', size:'4x1', minSize:'4x1', rank:90, body: function () { return ''; } },
    /* a Center's week (founder/1209 Q23): the one widget renderer draws its anatomy; this names it for the one list */
    hours: { eyebrow:'Hours', size:'2x2', minSize:'2x2', rank:60, body: function () { return ''; } },

    /* WHERE SHE'S BEEN — places she actually went, laid out by proximity.
       No threads: near is not the same as related. Weight is real returns. */
    visited: { eyebrow:'Been to', size:'2x2', minSize:'2x2', rank:20,
      body: function (d) {
        return fieldBody((d.places || []).map(function (p) {
          return Object.assign({ type:'place' }, p); }),
          { key:'by proximity', empty:'Nowhere yet' });
      },
      room: function (d) {
        return fieldRoom([{ label:'Places she has been', items:(d.places || []).map(function (p) {
          return { name:p.name, note:[p.note, p.last].filter(Boolean).join(' · ') }; }) }]);
      } },

    /* HER WORLD — who and what she belongs to and follows. She is the anchor;
       closeness is the strength of the tie. Places are tiles, people are rounds,
       and following reads lighter than belonging. */
    world: { eyebrow:'Belongs to', size:'2x2', minSize:'2x2', rank:10,
      body: function (d) {
        var items = [];
        if (d.me) items.push(Object.assign({ type:'person', me:true, relation:'belongs' }, d.me));
        (d.places || []).forEach(function (p) { items.push(Object.assign({ type:'place' }, p)); });
        (d.people || []).forEach(function (p) { items.push(Object.assign({ type:'person' }, p)); });
        return fieldBody(items, { anchor:true, key:'belongs · follows', empty:'Not part of anywhere yet' });
      },
      room: function (d) {
        function g(list, rel) {
          return (list || []).filter(function (x) { return rel ? x.relation === rel : true; })
            .map(function (x) { return { name:x.name, note:x.note || '' }; });
        }
        return fieldRoom([
          { label:'Part of',   items:g(d.places, 'member') },
          { label:'Follows',   items:g(d.places, 'following').concat(g(d.people, 'following')) },
          { label:'People',    items:g((d.people || []).filter(function (x) { return x.relation !== 'following'; })) }
        ]);
      } },

    /* Popits as collectibles, made literal: a Center issues one when a person
       actually turns up, so the shelf is a true record of where they have been */
    marks: { eyebrow:'Marks', size:'2x2', minSize:'2x2', rank:30,
      body: function (d) {
        var m = d.marks || [];
        if (!m.length) return '<span class="po-w__foot">No marks yet</span>';
        var show = m.slice(0, 11), rest = m.length - show.length;
        return '<div class="po-marks">' + show.map(function (k) {
          return '<i class="po-mark" title="' + esc(k.label || '') + '" style="' + hueVars(k) + '">'
               + (k.icon && ICONS[k.icon] ? svg(k.icon) : '') + '</i>';
        }).join('') + (rest > 0 ? '<i class="po-mark po-mark--more">+' + rest + '</i>' : '') + '</div>';
      },
      /* THE TILE SHOWS ELEVEN AND A "+N". THE ROOM SHOWS ALL OF THEM.
         (founder, 2026-08-16: the closed state "could be as vague as just
         saying a word and a couple details" — the open one "has to feel like a
         full catalog of something that you're opening.")
         A truncation is a tile's constraint, and carrying it through the door
         is what makes an open Popit feel like a bigger card instead of the
         whole holding. */
      face: function (d) {
        var m = d.marks || [];
        if (!m.length) return '<span class="po-w__foot">No marks yet</span>';
        return '<div class="po-marks po-marks--room">' + m.map(function (k) {
          return '<i class="po-mark" title="' + esc(k.label || '') + '" style="' + hueVars(k) + '">'
               + (k.icon && ICONS[k.icon] ? svg(k.icon) : '') + '</i>';
        }).join('') + '</div>';
      },
      /* AND A CATALOG HAS SECTIONS. One flat list of every mark is an inventory;
         grouped by the Center that issued them it becomes a record of where a
         person has been — which is what the shelf actually IS. The grouping is
         a real property of the data (`from`), never an imposed taxonomy, and
         marks with no issuer keep their own section rather than being dropped. */
      room: function (d) {
        var m = d.marks || [];
        if (!m.length) return '';
        var order = [], by = {};
        m.forEach(function (k) {
          var g = k.from || 'Elsewhere';
          if (!by[g]) { by[g] = []; order.push(g); }
          by[g].push(k);
        });
        /* GROUPING THAT GROUPS NOTHING IS WORSE THAN NO GROUPING. One mark per
           Center gives a column of headings each owning a single row — more
           chrome than content, and it reads as a form rather than a catalog. So
           the sections appear only when at least one of them actually collects
           something; otherwise the issuer travels on the row, where it was. */
        var collects = order.some(function (g) { return by[g].length > 1; });
        if (!collects) {
          return section('Earned by turning up', noteList(m.map(function (k) {
            return { text: k.label || '',
                     note: [k.from, k.at].filter(Boolean).join(' · ') }; })));
        }
        return order.map(function (g) {
          return section(g, noteList(by[g].map(function (k) {
            return { text: k.label || '', note: k.at || '' }; })));
        }).join('');
      } },

    /* the only widget whose content comes from OTHER PEOPLE — which is exactly
       why it belongs on a surface built for visitors */
    guestbook: { eyebrow:'Guestbook', size:'4x1', rank:90,
      /* ── A TRUNCATED LIST MUST SAY IT IS TRUNCATED ────────────────────
         ★ A -> C, 2026-09-09: *"guestbook 'face' slices to 6 with no '+N', so a
           wall with forty signatures silently claims six."*

         They are right, and it is the same family as the Count that rendered
         "124" for 1247 this morning: a surface stating a smaller number than
         the truth, with nothing to tell a reader it has done so. Forty people
         signed and the wall showed six as though six were all there were.

         THE PATTERN IS ALREADY IN THIS FILE, DIRECTLY BELOW. `links` slices to
         a measured cap, records what it showed on `d._shown`, and its foot
         says "All N links" whenever the two differ. Guestbook now does exactly
         that rather than inventing a second way to say the same thing.

         THE CAPS THEMSELVES ARE UNCHANGED — three on the tile because three is
         what fits, six on the face. What changes is that the remainder is
         named instead of dropped. */
      body: function (d) {
        var all = d.entries || [];
        if (!all.length) return '<span class="po-w__foot">Be the first to leave a mark</span>';
        var g = all.slice(0, 3);
        d._gshown = g.length;
        return '<div class="po-guest">' + g.map(function (e) {
          return '<span class="po-guest__m"><b>' + esc(e.by || '') + '</b><span>'
               + esc(e.text || '') + '</span></span>'; }).join('') + '</div>';
      },
      /* THE COUNT IS THE FACT, and it rides outside the clipped body for the
         same reason `links` puts its own control there — a remainder cut off
         by the tile it is describing is worse than no remainder at all. */
      foot: function (d) {
        var all = (d.entries || []).length, shown = d._gshown || 0;
        if (!all) return '';
        return all > shown
          ? '<button type="button" class="po-links__more" data-po-more>All '
            + all + ' signatures &#8595;</button>'
          : esc(all + (all === 1 ? ' signature' : ' signatures'));
      },
      /* the tile shows three because three is what fits; the pane shows what
         the guestbook actually holds — a visitor opening it is asking for all
         of it, and the room below carries the dates */
      face: function (d) {
        var all = d.entries || [];
        if (!all.length) return '<span class="po-w__foot">Be the first to leave a mark</span>';
        var g = all.slice(0, 6);
        var more = all.length - g.length;
        return '<div class="po-guest">' + g.map(function (e) {
          return '<span class="po-guest__m"><b>' + esc(e.by || '') + '</b><span>'
               + esc(e.text || '') + '</span></span>'; }).join('') +
          (more > 0
            ? '<span class="po-guest__more">and ' + more + ' more</span>'
            : '') + '</div>';
      },
      room: function (d) {
        return '<div><div class="po-sheet__label">What people have left</div><ul class="po-time">'
          + (d.entries || []).map(function (e) {
              return '<li>' + esc(e.text || '') + '<time>' + esc(e.by || '')
                + (e.at ? ' · ' + esc(e.at) : '') + '</time></li>'; }).join('')
          + '</ul></div>';
      } },

    /* LINKS — whatever a person wants to point at. The ONE widget whose tile is
       a container rather than a button: a links list is not a door into a room,
       it IS the thing, and one tap must reach the destination. */
    links: { eyebrow:'Links', size:'2x2', rank:85, interactive:true,
      body: function (d) {
        var all = usableLinks(d.links);
        if (!all.length) return '<span class="po-w__foot">No links yet</span>';
        /* How many rows actually FIT — measured against the tile, not guessed.
           A 2x2 holds four rows only when no "all N" control is needed; with one
           it holds three. Getting this wrong pushed a row over the footer. */
        var tall = (d.size === '2x2' || d.size === '4x2');
        var cap = tall ? (all.length <= 4 ? 4 : 3) : (all.length <= 2 ? 2 : 1);
        var r = linkRows(all, cap);
        d._shown = r.shown;
        return '<div class="po-links">' + r.html + '</div>';
      },
      foot: function (d) {
        var all = usableLinks(d.links), shown = d._shown || 0;
        if (!all.length) return '';
        return all.length > shown
          ? '<button type="button" class="po-links__more" data-po-more>All '
            + all.length + ' links &#8595;</button>'
          : esc(all.length + (all.length === 1 ? ' link' : ' links'));
      },
      /* the face is the SET, as objects — the rows themselves are controls and
         a link half-under the plane's grounding gradient is not a link */
      face: function (d) {
        var all = usableLinks(d.links);
        return objShelf(all.map(function (l) {
          return { name: l.name || hostOf(safeUrl(l.url)), icon: iconForLink(l) }; }));
      },
      room: function (d) {
        var all = usableLinks(d.links);
        if (!all.length) return '';
        return '<div><div class="po-sheet__label">Where these go</div>'
          + '<div class="po-links">' + linkRows(all).html + '</div></div>';
      } },

    /* ── ACTING WIDGETS ─────────────────────────────────────────────────
       These are the ones that DO something, so both are containers (real
       controls inside) rather than buttons. */

    /* BEGIN — the ways a relationship with a Center can honestly start. The
       server says which are possible (participation.begin); this renders only
       those. A Center with no community shows no Join — that is Gate 3
       (EXACT CAPABILITIES) at the widget layer, not a filter someone
       remembered to write. */
    begin: { eyebrow:'Your standing', size:'2x1', rank:5, interactive:true,
      body: function (d) { return actRow(d.ways); },
      /* WHERE YOU ACTUALLY STAND, said rather than offered. The tile's body is
         the controls; the face is the state those controls are currently in,
         which is the honest thing to look INTO — and it is read from the same
         `on` flags the server sent, never assumed. */
      face: function (d) {
        var ways = d.ways || [];
        var on = ways.filter(function (w) { return w.on; });
        return '<div class="po-standing po-standing--room">'
          + (on.length
              ? on.map(function (w) {
                  return '<b>' + esc(w.labelOn || (w.label + 'ing')) + '</b>'; }).join('')
              : '<span>' + esc(ways.length ? 'Not yet begun' : 'No way to begin here yet') + '</span>')
          + '</div>';
      },
      /* THE CONTROLS TRAVEL WITH THE OBJECT. Opening a thing you can act on and
         finding no way to act on it is the "widgets" half of the 2026-08-16
         correction — the room was a picture of a control panel. */
      room: function (d) {
        return section('Ways to begin', actRow(d.ways));
      } },

    /* CREATE — the one Home widget that starts something. Options come from
       /api/me/lightbulb, so a person is never offered a creation type they
       cannot actually begin, and everything begins as a draft (never a
       publish). */
    create: { eyebrow:'Begin something', size:'2x2', rank:15, interactive:true,
      body: function (d) { return createRow(d.options); },
      /* WHAT CAN BE MADE HERE, as objects on a shelf — the kinds before the
         buttons. The icon is looked up from the creation type the server named,
         and a type nobody registered a glyph for still takes its place on the
         shelf: the shelf is a record of what is possible, and dropping a row
         because an icon is missing would make that record lie. */
      face: function (d) {
        return objShelf((d.options || []).map(function (c) {
          return { name: c.label || c.type || '',
                   icon: CREATE_ICON[c.type] || 'spark' }; }));
      },
      room: function (d) { return section('What you can begin', createRow(d.options)); } },

    now:  { eyebrow:'Right now', size:'2x1', rank:50,
      body: function (d) { return d.text
        ? '<span class="po-said" style="font-style:normal">' + esc(d.text) + '</span>'
        : '<span class="po-w__foot">Not anywhere in particular</span>'; } },

    next: { eyebrow:'Next', size:'2x1', rank:60,
      body: function (d) { return d.text
        ? '<span class="po-said" style="font-style:normal">' + esc(d.text) + '</span>'
        : '<span class="po-w__foot">Nothing on the books</span>'; },
      /* ── THE TILE IS THE FIRST ONE; THE ROOM IS THE BOOK ─────────────────
         ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info
           when its popit is opened."*

         This kind had NO room at all, so opening it showed the same single
         line the tile does — and the line is a join of three fields into one
         string, which is the most a 2x1 tile can hold and the least an opened
         Popit should.

         The caller already had the rest. A Centre's Next is built from the
         agenda's FIRST row while the whole list sits beside it; the profile's
         from `p.next`, which carries its own fields. Both now hand the widget
         `items`, and this renders them — one query, nothing invented, and the
         tile's own sentence untouched.

         `text` still draws the tile when a caller has only that, so a producer
         that has not been updated degrades to what it always showed rather
         than to nothing. */
      room: function (d) {
        var rows = (d.items || []).filter(function (e) { return e && (e.title || e.text); })
          .map(function (e) {
            return { text: e.title || e.text,
                     note: [e.date || '', e.time || '', e.location || '']
                             .filter(Boolean).join(' · ') };
          });
        if (!rows.length) { return ''; }
        var head = rows.slice(0, 6), rest = rows.slice(6);
        return section(rows.length === 1 ? 'What is next' : 'What is coming',
                       noteList(head)) +
          (rest.length ? reveal('Everything else on the books',
                                noteList(rest), rest.length) : '');
      } },

    /* ── THE CLOCK, IN THE REGISTRY THAT DECIDES WHAT IS RENDERABLE ────────
       ★ CAUGHT BY `test_canvas`: *"every catalog Popit is a kind the runtime
         can render"* — and the Clock was not one.

       IT LOOKED FINE BECAUSE IT IS DRAWN SOMEWHERE ELSE. `canvas.js` has its
       own `clockFace()` — the dial, the city, the zone, the relative time — so
       three clocks rendered perfectly on Home while this registry, which is
       what every OTHER Popit surface asks, had never heard of the kind. Offer a
       Popit in the catalog and it can be placed anywhere a Popit can go; on any
       surface that is not the canvas it would have drawn nothing at all.

       THIS IS THE REST-STATE FACE, NOT A SECOND CLOCK. The canvas owns the
       live dial because only the canvas knows the tile's size, which is the
       whole point of the Clock. What belongs here is what a Clock IS when
       something asks the Popit runtime to show one: the place and its time,
       from the config the placement already carries. No second timezone model,
       no second formatter — `Intl` is asked the same question in the same way.

       AND IT SAYS THE PLACE FIRST (founder, 2026-08-30: *"everyone should
       display what location its getting time from"*). */
    clock:{ eyebrow:'Time in', size:'2x1', rank:118,
      body: function (d) {
        var tz = d.tz || '';
        var label = d.label || (tz ? tz.split('/').pop().replace(/_/g, ' ') : '');
        var when = '';
        try {
          when = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric', minute: '2-digit',
            hour12: String(d.format || '12') === '12',
            timeZone: tz || undefined
          }).format(new Date());
        } catch (_) {
          /* AN UNKNOWN ZONE SAYS SO RATHER THAN SHOWING THIS DEVICE'S TIME.
             Falling back to local would print a confident wrong time under
             somebody else's city name, which is worse than printing nothing. */
          when = '';
        }
        return '<span class="po-sig">' + esc(label) + '</span>'
             + '<span class="po-num">' + esc(when || '—') + '</span>';
      },
      room: function (d) {
        var tz = d.tz || '';
        if (!tz) return '';
        var bits = [];
        try {
          var f = new Intl.DateTimeFormat('en-US',
            { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
          var z = (f.filter(function (x) { return x.type === 'timeZoneName'; })[0] || {}).value;
          if (z) bits.push({ text: z });
        } catch (_) {}
        try {
          bits.push({ text: new Intl.DateTimeFormat(undefined,
            { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' })
            .format(new Date()) });
        } catch (_) {}
        return bits.length ? section('There', noteList(bits)) : '';
      } },

    since:{ eyebrow:'Here since', size:'1x1', rank:120,
      body: function (d) { return '<span class="po-num">' + esc(d.year || '') + '</span>'; },
      /* HOW LONG THAT IS — arithmetic on the year the object already carries,
         which is a derivation and not an invention. A value no arithmetic is
         possible on (absent, or not a year) states nothing rather than guessing. */
      room: function (d) {
        var y = parseInt(d.year, 10);
        if (!y || y < 1900 || y > 9999) return '';
        var n = new Date().getFullYear() - y;
        return section('Which is', noteList([{ text:
          n <= 0 ? 'This year' : (n === 1 ? 'One year' : n + ' years') }]));
      } },

    /* A COUNT IS NOT A YEAR. Followers and Liked were rendered through `since`
       because it draws one big number — so a profile said
       "HERE SINCE / Followers / 1", a year's eyebrow over a tally.
       The eyebrow names the KIND and the label names the ITEM (that is the
       grammar of this whole component; making the eyebrow echo the label, which
       I tried first, just prints the word twice). So the kind that was missing
       is `count`, and it is four lines rather than a workaround. */
    count:{ eyebrow:'Count', size:'1x1', rank:120,
      body: function (d) {
        return '<span class="po-num">' + esc(String(d.value != null ? d.value
                                                    : (d.year || ''))) + '</span>'; } },

    colours:{ eyebrow:'Colours', size:'1x1', rank:110,
      body: function (d) {
        return '<div class="po-swatch">'
          + '<i style="background:linear-gradient(150deg,rgb(' + (d.h1 || '124,45,255') + '),rgba(' + (d.h1 || '124,45,255') + ',.6))"></i>'
          + '<i style="background:linear-gradient(150deg,rgb(' + (d.h2 || '93,226,255') + '),rgba(' + (d.h2 || '93,226,255') + ',.6))"></i>'
          + '</div>'; },
      /* THE PAIR ITSELF. A hue is identity here, not decoration (§17), so the
         room states the actual values rather than describing them — the object
         opened is the pair, and the pair is two triplets. */
      room: function (d) {
        return section('The pair', noteList([
          { text: 'Primary',   note: d.h1 || '' },
          { text: 'Secondary', note: d.h2 || '' }
        ].filter(function (r) { return r.note; })));
      } },

    /* real material when it exists; the hue-derived environmental treatment
       when it does not (§20.1 tier 4) — never stock, never generated */
    /* minSize came down to 2x1 once the compressed cover existed (§9.6b): a
       gallery at one row is a square thumb with its title beside it, which is
       still a cover. Before that it was a stripe, and raising every caller to
       2x2 was the right protection — it just flattened every profile into a
       uniform grid because four kinds did the same thing. */
    gallery:{ eyebrow:'A post', size:'2x2', minSize:'2x1', rank:80,
      body: function (d) {
        /* the same fallback the feed card has: a cover that fails to load
           removes itself so the hue-derived treatment underneath becomes the
           cover. A torn-page glyph over someone's gallery is worse than the
           honest absence. */
        return '<div class="po-cover">'
          + (d.cover ? '<img src="' + esc(d.cover) + '" alt="" loading="lazy" decoding="async"'
                       + ' onerror="OW.imgFail(this)">' : '')
          + '</div>'; },
      /* ── A GALLERY OPENED IS STILL THE COVER, PLUS WHAT IT IS ────────────
         The face carries the cover across at room scale (that is what `face`
         defaults to), so the room's job is the part a cover cannot say: what
         this gallery is called and how much is in it. Both callers already
         have both — the profile as `signal`, the Centre as `counts.pieces` —
         and neither reached the room, because there was no room.

         DELIBERATELY NOT A GRID OF THE PIECES. The media are not in this
         payload; drawing a strip of them would mean a second read from the
         material layer, which performs no HTTP by law. Opening the gallery
         itself is the act that shows the pieces, and the action row already
         carries it when a caller declares one. */
      room: function (d) {
        var n = (d.counts && d.counts.pieces);
        var rows = [];
        if (d.label) { rows.push({ text: d.label, note: 'Title' }); }
        if (n != null) {
          rows.push({ text: n + (n === 1 ? ' piece' : ' pieces'), note: 'Inside' });
        } else if (d.signal) {
          rows.push({ text: d.signal, note: 'Inside' });
        }
        if (d.at) { rows.push({ text: d.at, note: 'Made' }); }
        return rows.length ? section('This gallery', noteList(rows)) : '';
      } },

    favourite:{ eyebrow:'Always', size:'1x1', rank:100,
      body: function (d) { return '<span class="po-w__foot" style="-webkit-line-clamp:3">'
        + esc(d.text || '') + '</span>'; } },

    /* the ONE authored widget, and it says so */
    said: { eyebrow:'In their words', size:'2x1', rank:40,
      body: function (d) { return '<span class="po-said">' + esc(d.text || '') + '</span>'; },
      authored: true },

    /* ── A POST — the thing almost everyone has ──────────────────────────
       (founder, 2026-08-16: posts on a profile should be "smaller Popits" that
       "feel like they're expanding on the person's world".)

       IT WAS BEING RENDERED AS `said`, WHICH IS A DIFFERENT OBJECT. `said` is
       the ONE authored widget — a line a person simply wrote on their own
       profile, and it is marked "written" precisely so the derived widgets
       around it stay trustworthy. A post is not that: it was PUBLISHED, to a
       place, at a time, and other people have answered it. Flattening one into
       the other threw away every part of it except the words, and quietly told
       a visitor that a thing said in a community was a line on a profile.
       (The vocabulary rule is right — `post` was simply a word the material
       did not have yet, and `OW.widget` returns null for an unknown kind
       SILENTLY, which is how the first attempt at this vanished.)

       AND THE EXPANSION IS THE HUE. A profile is the person's colour; each post
       carries the colour of WHERE IT WAS LIT (§17 — hue is recognition, not
       decoration). So a shelf of posts on one profile reads as that person
       reaching into several worlds, and opening one takes you toward the place
       it went. That is the "expanding on their world" made literal rather than
       described. */
    post: { eyebrow:'Posted', size:'2x1', minSize:'2x1', rank:45,
      body: function (d) {
        var said = (d.title || d.body || '').trim();
        if (d.cover) {
          return '<div class="po-cover"><img src="' + esc(d.cover) + '" alt=""'
            + ' loading="lazy" decoding="async" onerror="OW.imgFail(this)"></div>';
        }
        return said
          ? '<span class="po-said" style="font-style:normal">' + esc(said) + '</span>'
          : '<span class="po-w__foot">Nothing written</span>';
      },
      /* opened, it is the words at full length — a tile truncates, a room
         must not (the 2026-08-16 "full catalog" rule) */
      face: function (d) {
        if (d.cover) {
          return '<div class="po-cover"><img src="' + esc(d.cover) + '" alt=""'
            + ' loading="lazy" decoding="async" onerror="OW.imgFail(this)"></div>';
        }
        var said = (d.body || d.title || '').trim();
        return said
          ? '<span class="po-said" style="font-style:normal">' + esc(said) + '</span>'
          : '<span class="po-w__foot">Nothing written</span>';
      },
      room: function (d) {
        var out = '';
        /* WHERE IT WENT — the expansion. A post on a profile is a thread back
           into a place, and this is the end of that thread a visitor can see. */
        if (d.place) {
          out += section('Lit to', noteList([{ text: d.place, note: d.when || '' }]));
        } else if (d.when) {
          out += section('Posted', noteList([{ text: d.when }]));
        }
        /* the words, when the tile showed a cover instead of them */
        if (d.cover && (d.body || '').trim()) {
          out += section('What they said', '<p class="po-sheet__glance">'
            + esc(d.body) + '</p>');
        }
        /* WHAT PEOPLE DID WITH IT — counts only where there is something to
           count, and never summed into a score (founder, 2026-08-02: likes,
           dislikes, views and reposts mean different things). */
        var c = d.counts || {};
        var rows = [['like','Liked'],['dislike','Disliked'],['comment','Replies'],
                    ['repost','Reposts'],['save','Saved']]
          .filter(function (k) { return c[k[0]]; })
          .map(function (k) { return { text: k[1], note: String(c[k[0]]) }; });
        if (rows.length) out += section('What people did', noteList(rows));
        return out;
      } },

    /* earned, never gamified — the bars are real attendance */
    rhythm:{ eyebrow:'Rhythm', size:'2x1', rank:70,
      /* ── ONE BAR IS NOT A RHYTHM ────────────────────────────────────────
         ★ FOUNDER, 2026-09-02: *"these hollow projections of any popit and
           look like placeholders are gonna be systematically eliminated."*

         FOUND BY `tools/probe/hollow.js` on a real profile: this rendered
         FOURTEEN BARS, THIRTEEN OF THEM `data-off`. Every one of those thirteen
         is the element saying in its own markup that it has nothing, and the
         result reads as a placeholder chart — a frame with a shape in it that
         means "no data" while looking like data.

         It was not lying. The person genuinely had one week of attendance, so
         each bar was true. But `Rhythm` is a claim about a PATTERN, and a
         pattern needs more than one point: with a single value there is nothing
         to see, nothing to compare it against, and the honest rendering of that
         is no Popit at all rather than a mostly-empty one.

         `shows` is the gate every kind here already has, so this needs no new
         machinery — it simply states the condition under which the Popit has
         something to say. Two weeks is the smallest number from which a rhythm
         can be read; below it the surface shows nothing, which is the founder's
         standing rule: *display nothing rather than simulate.* */
      /* ── AND ≥2 WAS MY INVENTION ON A FALSE PREMISE. CORRECTED. ────────
         I set this to "at least two live weeks" on the reasoning that one bar
         is not a rhythm — while believing the detector's report that the tile
         rendered THIRTEEN of fourteen bars empty.

         LANE C MEASURED IT PROPERLY: the tile carries THREE bars at `--v:100`
         and is populated. The detector was wrong, not the widget. Its only
         TEXT is its eyebrow, and `carriesSomething` could not see a chart drawn
         from `<i>` elements rather than an `<img>` — so it stripped the label
         as chrome, found nothing left, and called a real chart a frame around
         nothing.

         So the design judgment stands on nothing. A sparse chart is SPARSE
         TRUTH, not simulation, and the founder's rule is *display nothing
         rather than simulate* — it does not ask us to hide thin facts. Gating a
         real value off the screen is the opposite error from a placeholder and
         a worse one: a placeholder is visible and can be reported, and content
         I deleted cannot.

         The gate now refuses only what genuinely carries nothing — every bar
         `data-off`, no value plotted at all — which is exactly the case the
         corrected detector still reports. Gate and detector agree on one
         definition rather than each holding its own. */
      shows: function (d) {
        var w = (d && d.weeks) || [];
        return w.some(function (v) { return !!v; });
      },
      body: function (d) {
        var w = d.weeks || [];
        return '<div class="po-rhythm">' + w.map(function (v) {
          return v ? '<i style="--v:' + Math.max(12, Math.min(100, v)) + '"></i>' : '<i data-off></i>';
        }).join('') + '</div>'; },
      /* WHAT THE BARS COUNT. Counting the weeks that have a value is reading
         the same array the bars are drawn from, so the sentence cannot drift
         from the picture above it — the two are one measurement. */
      room: function (d) {
        var w = d.weeks || [];
        if (!w.length) return '';
        var on = w.filter(function (v) { return !!v; }).length;
        return section('Turned up', noteList([{
          text: on + (on === 1 ? ' week' : ' weeks'),
          note: 'of the last ' + w.length }]));
      } }
  };

  /* Build one widget tile. It is a Popit — same material, same FLIP, same open
     grammar — that happens to claim a span and fill a body. */
  OW.widget = function (data, opts) {
    data = data || {}; opts = opts || {};
    var spec = WIDGET[data.kind];
    if (!spec) return null;                       /* an unknown kind renders
                                                     nothing rather than an
                                                     empty tile pretending to
                                                     hold something */

    /* ── AND A KNOWN KIND WITH NOTHING TO SHOW DOES THE SAME ──────────────
       ★ FOUNDER, 2026-09-02: *"these hollow projections of any popit and look
         like placeholders are gonna be systematically eliminated."*

       The line above already states the rule for an UNKNOWN kind — *"rather
       than an empty tile pretending to hold something"* — and the identical
       reasoning applies to a kind that is known and simply has nothing today.
       A spec knows what it needs; nothing else does. `Rhythm` needs more than
       one week or there is no rhythm to read, and only `Rhythm` can say so.

       FOUND SYSTEMATICALLY, NOT BY NOTICING. `tools/probe/hollow.js` walks
       every Popit on every destination and reports the ones that occupy space
       and carry no fact. Rhythm was rendering fourteen bars with THIRTEEN of
       them marked `data-off` — each bar true, the whole a placeholder.

       DECLARING NOTHING KEEPS TODAY'S BEHAVIOUR. A spec without `shows` renders
       exactly as it always did, so this adds a gate for the kinds that need one
       rather than a new obligation on every kind. */
    if (typeof spec.shows === 'function') {
      var _has;
      try { _has = spec.shows(data); }
      catch (e) {
        /* A GATE THAT THROWS MUST NOT DELETE CONTENT. Unknown is not empty:
           failing open shows a Popit that may be thin; failing closed silently
           removes one that was fine, and nobody would ever see why. */
        _has = true;
      }
      if (!_has) return null;
    }
    /* A KIND MAY DECLARE A MINIMUM SIZE. Some content does not survive being
       shrunk: a gallery cover in a one-row tile is not a cover, it is a 50px
       stripe. Rather than trusting every caller to remember, the kind states
       the smallest size its content still means something at, and a smaller
       request is raised to it. */
    var size = data.size || spec.size || '2x1';
    if (spec.minSize && SIZE_RANK[size] < SIZE_RANK[spec.minSize]) size = spec.minSize;
    /* A container widget renders as a div: real controls live inside it, and a
       button inside a button is invalid markup and unusable with a keyboard. */
    var n = doc.createElement(spec.interactive ? 'div' : 'button');
    if (!spec.interactive) n.type = 'button';
    else n.setAttribute('data-interactive', '');
    n.className = 'po po-w po--' + size;
    n.setAttribute('data-v', variantFor(data.id || data.kind));
    n.setAttribute('data-po-id', data.id || '');
    n.setAttribute('data-kind', data.kind);
    if (data.hue) hue.scope(n, data.hue.h1, data.hue.h2);
    n.setAttribute('aria-label', (data.label || spec.eyebrow) + (data.signal ? ' — ' + data.signal : ''));

    n.appendChild(el('span', 'po-face'));
    /* THE SAME WORD IS NEVER PRINTED TWICE. The eyebrow says what KIND of thing
       this is and the label says WHICH one — but when a widget's only name is
       its kind, both said it and the tile read "RHYTHM / Rhythm", the eyebrow
       merely uppercased by CSS. Founder, 2026-08-17, on exactly this shape one
       surface out: *"POSTED / Posted"* in the post opening. Fixed at the head
       rather than per widget, because any spec whose label matches its kind
       would otherwise grow the same defect the day it is added. */
    var _eyebrow = String(spec.eyebrow || '');
    var _label = String(data.label || '');
    var _same = _label && _eyebrow
      && _label.trim().toLowerCase() === _eyebrow.trim().toLowerCase();
    n.appendChild(el('span', 'po-w__head',
      '<span class="po-w__eyebrow">' + esc(_eyebrow) + (spec.authored ? ' · written' : '') + '</span>' +
      (_same ? '' : '<span class="po-w__label">' + esc(_label) + '</span>')));
    n.appendChild(el('span', 'po-w__body', spec.body(data) || ''));
    /* THE FOOTER IS WHERE AN AFFORDANCE LIVES. The body is clipped to the tile
       (a widget declared a size and must honour it), so a control rendered into
       the body can be cut off — which is exactly what happened to "All N links".
       A spec that owns a footer renders it here, outside the clip. */
    var footHTML = spec.foot ? spec.foot(data) : (data.signal ? esc(data.signal) : '');
    if (footHTML) n.appendChild(el('span', 'po-w__foot', footHTML));

    /* THE ROOM A VISITOR STEPS INTO — and the object goes in with them.
       (founder, 2026-08-16: opened Popits "do not feel as widgets".)

       They did not, because the widget did not survive its own door: the tile's
       living body — the field of ties, the shelf of marks, the rhythm, the
       cover — was thrown away on open and replaced by a paragraph and a bullet
       list. A visitor met the object, tapped it, and the object vanished.

       So the FACE is the widget's own body, carried across at room scale, and
       the ROOM is what the tile was too small to hold. A kind whose body is
       CONTENT (a field, a shelf, a cover, a sentence) shows that body; a kind
       whose body is CONTROLS (begin · create · links) declares a `face` of its
       own subject instead, because a button half-under the plane's grounding
       gradient is not a control, and the real controls belong in the room where
       they can be pressed. */
    var payload = OW.widgetPayload(data, spec);
    n._po = payload;
    observe(n);
    if (spec.interactive) {
      /* only the explicit affordance opens the room — a stray tap on a shelf
         must never yank a visitor out of the list they are reading */
      n.addEventListener('click', function (e) {
        if (e.target.closest('[data-po-more]')) { e.preventDefault(); OW.open(payload, n); return; }
        /* AN ACTING CONTROL. The material file performs no HTTP and knows no
           endpoints — it announces intent and the reality layer
           (oneway-popit-live.js) carries it out. That separation is what lets
           the same widget work against a different source, or none. */
        var a = e.target.closest('[data-po-act],[data-po-create]');
        if (!a) return;
        e.preventDefault();
        doc.dispatchEvent(new CustomEvent('ow:act', { detail: {
          button: a,
          verb: a.getAttribute('data-po-act') || 'create',
          create: a.getAttribute('data-po-create') || null,
          widget: data, node: n
        } }));
      });
    } else if (opts.open !== false) {
      n.addEventListener('click', function () { OW.open(payload, n); });
    }
    return n;
  };

  /* THE PROFILE. Renders what THIS visitor is entitled to meet — the same
     profile is a different projection per relationship, and the tiles a viewer
     may not have are never built. */
  OW.mountProfile = function (host, widgets, viewer) {
    if (!host) return;
    host.classList.add('po-grid');
    var relation = (viewer && viewer.relation) || 'stranger';
    var frag = doc.createDocumentFragment(), shown = 0;
    /* THE LOGICAL ORDER a visitor reads a person in:
         who they belong to → where they have been → what they are like →
         what is happening with them → what they have made → what others say →
         the small facts.
       Each kind carries a default rank so an unordered list still composes; an
       owner's explicit `order` always wins, because a profile is theirs to
       arrange. */
    var list = (widgets || []).slice().sort(function (a, b) {
      var ao = a.order, bo = b.order;
      if (ao != null || bo != null) return (ao == null ? 999 : ao) - (bo == null ? 999 : bo);
      var ar = (WIDGET[a.kind] && WIDGET[a.kind].rank) || 500;
      var br = (WIDGET[b.kind] && WIDGET[b.kind].rank) || 500;
      return ar - br;
    });
    list.forEach(function (w) {
      if (!mayMeet(w, relation)) return;
      var node = OW.widget(w);
      if (node) { frag.appendChild(node); shown++; }
    });
    host.appendChild(frag);
    /* empty is a valid answer — a quiet profile is a state, not an error */
    host.setAttribute('data-shown', shown);
    return shown;
  };

  /* THE PAYLOAD, WITHOUT A TILE TO BUILD IT FROM.
     (founder, 2026-08-16: "we need feed posts clickable by now".)

     A post in the feed and the same post on a profile must open the SAME room.
     The description of what opening a kind means lived inside `OW.widget`,
     reachable only by building a tile first — so a feed card, which is not a
     widget tile, had no way to reach it and simply did nothing when pressed.
     Splitting it out is what lets one kind have one room from anywhere; the
     alternative is a caller rebuilding the room by hand, and two descriptions
     of one object drift within a week.

     Returns null for an unknown kind rather than an empty room — the same
     honest refusal `OW.widget` makes, and the reason `kind:'post'` silently
     vanished before `post` was registered. */
  OW.widgetPayload = function (data, spec) {
    data = data || {};
    spec = spec || WIDGET[data.kind];
    if (!spec) return null;
    return {
      id: data.id, label: data.label || spec.eyebrow, kind_label: spec.eyebrow,
      glance: data.glance || '', image: data.image || null,
      faceHTML: (spec.face ? spec.face(data) : spec.body(data)) || '',
      faceKind: data.kind,
      openHTML: spec.room ? spec.room(data) : '',
      time_back: data.time_back || [], time_forward: data.time_forward || [],
      hue: data.hue || null,
      /* the room's controls act through the same one listener the tile uses,
         so there is still exactly one place a Popit can change reality */
      widget: data
    };
  };

  OW.widgetKinds = function () { return Object.keys(WIDGET); };

  /* ═══ 7 · BOOT ═════════════════════════════════════════════════════════ */
  OW.boot = function (opts) {
    opts = opts || {};
    if (opts.world !== false) OW.world.mount(opts);
    /* THE SURFACE ADOPTS ITS OWNER'S HUE AUTOMATICALLY. In the App that is the
       viewer's chosen setting; in the OS pass the operating Center. Nothing
       downstream needs telling — every Popit, widget and world layer reads
       --ow-h1/--ow-h2 from :root. */
    hue.bind({ pair: opts.hue || null, angle: opts.hueAngle });
    if (opts.centerHue) hue.context('center', opts.centerHue, 0);
    /* THE SKY IS PART OF BOOTING, NOT SOMETHING A SURFACE REMEMBERS TO ASK FOR.
       Founder: the atmospheric layout belongs in the App and the OS too, and a
       shared thing every surface must opt into is a shared thing half the
       surfaces will be missing by next month. Opt OUT with {sky:false} for a
       page that genuinely paints its own world — the landing does. */
    if (opts.sky !== false) OW.sky(opts);
    /* the world is up; the surface may now be seen */
    OW.arrive();
    return OW;
  };

  /* ══ ENTER AND SPACE ARE THE KEYBOARD'S CLICK — ONE HANDLER, WHOLE APP ════
   *
   * ★ FOUNDER, 2026-08-31 (founder/347, P0 — Interaction reliability): every
   *   control needs *"keyboard access"*, and the harness must be *"systemic
   *   rather than fixed one button at a time."*
   *
   * A native <button> fires a click on Enter and Space for free. An element
   * wearing `role="button"` does NOT — so putting one in the tab order without
   * this makes it WORSE than leaving it out: the focus ring promises an action
   * that never happens.
   *
   * MY FIRST ATTEMPT WAS PER-CARD AND SILENTLY DID NOTHING. I attached the
   * keydown beside the per-card click listener, which lives inside
   * `if (opts.open !== false)` — and the feed builds its cards with
   * `open:false` because it delegates opening at the river level. So the
   * attribute landed, the chip became focusable, Enter did nothing, and the
   * probe reported the accessibility finding as CLOSED. Caught by asking
   * whether the event actually FIRED rather than whether the attribute was
   * present.
   *
   * ONE listener on the document, at the capture-free bubble phase, covering
   * every `role="button"` that is not already a native control — current
   * surfaces and any built tomorrow. It synthesises the SAME click the mouse
   * produces rather than duplicating any open logic, so pointer and keyboard
   * can never diverge (founder/346 §39). */
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var t = e.target;
    if (!t || !t.closest) return;
    /* Native controls already do this, and a textarea needs its Enter. */
    var tag = (t.tagName || '').toUpperCase();
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' ||
        tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
    var btn = t.closest('[role="button"]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    /* Space scrolls the page by default; the person would act AND jump a screen. */
    e.preventDefault();
    btn.click();
  });

  /* ══ THE TOAST: THE ONE PLACE AN ALERT IS SAID (STANDING_RULES S23) ═══════════════════════════════════════════
     ★ FOUNDER/493: "a bottom notification bar that can popup like all social medias describing briefly for a second an
       individual error if there is then fade away after a second."  ★ The founder, 2026-10-11: "any alerts appearing on
       the interaction itself, they should appear as system notifications ... little gray boxes ... We have this."
     Moved here from the App (app/popit-live.js) so the OS says its alerts in the same box. One bar, one message, one
     place: a second message replaces the first; `tone` 'ok' for something that landed; an optional `action` with
     `onAction` (Try again, See it). Not a dialog: nothing takes focus, nothing blocks, it fades on its own. Its look is
     the founder's to tune (.ow-toast in oneway-popit.css). */
  var toastEl = null, toastTimer = 0;
  /* where a bar at the foot stands: above a dock that runs along the bottom, else where its stylesheet puts it (the toast
     and OW.sure both, so the two never disagree) */
  function aboveDock(el) {
    try {
      var nav = doc.querySelector('.ow-nav'), vh = global.innerHeight || 0, nr = nav && nav.getBoundingClientRect();
      var clear = (nr && nr.height && nr.top > vh * 0.6 && global.getComputedStyle(nav).display !== 'none') ? (vh - nr.top + 10) : 0;
      el.style.bottom = clear ? 'max(' + Math.round(clear) + 'px, calc(14px + var(--ow-dock,0px) + env(safe-area-inset-bottom)))' : '';
    } catch (_) {}
  }
  OW.toast = function (msg, opts) {
    opts = opts || {};
    if (!msg) return;
    if (toastTimer) { global.clearTimeout(toastTimer); toastTimer = 0; }
    if (!toastEl || !toastEl.parentNode) {
      toastEl = doc.createElement('div');
      toastEl.className = 'ow-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.setAttribute('aria-atomic', 'true');
      doc.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '';
    toastEl.setAttribute('data-tone', opts.tone === 'ok' ? 'ok' : 'bad');
    var face = doc.createElement('span'); face.className = 'po-card__face';
    face.setAttribute('aria-hidden', 'true'); toastEl.appendChild(face);
    var head = doc.createElement('div'); head.className = 'ow-toast__head';
    var brand = doc.createElement('span'); brand.className = 'ow-toast__brand';
    brand.textContent = 'Oneway'; head.appendChild(brand);
    var dismiss = doc.createElement('button'); dismiss.className = 'ow-toast__dismiss';
    dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.textContent = '\u00d7'; dismiss.addEventListener('click', function () { OW.toast.hide(); });
    head.appendChild(dismiss); toastEl.appendChild(head);
    /* A SAVE A PERSON SHOULD SEE (opts.big; founder/882: "favorites need to be saved with a console alert and they always need
       to stay up long enough and be prominent enough for users to see them"): larger words, the mark of what was kept, seven
       seconds at least */
    if (opts.big) toastEl.setAttribute('data-big', '1'); else toastEl.removeAttribute('data-big');
    if (opts.big) { var mark = doc.createElement('span'); mark.className = 'ow-toast__mark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = '\u2605'; toastEl.appendChild(mark); }
    var tt = doc.createElement('span'); tt.className = 'ow-toast__t'; tt.textContent = String(msg); toastEl.appendChild(tt);
    if (opts.action && typeof opts.onAction === 'function') {
      var b = doc.createElement('button'); b.className = 'ow-toast__a'; b.textContent = String(opts.action);
      b.type = 'button';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        try { opts.onAction(); } catch (_) {}
        OW.toast.hide();
      });
      toastEl.appendChild(b);
    }
    /* ABOVE THE DOCK, MEASURED (2026-10-11). `--ow-dock` is set only in the immersive view, so on Home a phone's bar sat
       over the dock it promises to clear (walk camera-keep, 390). Where a dock runs along the bottom, the bar sits
       above its top edge; a dock down the side (a wide screen) changes nothing. */
    aboveDock(toastEl);
    /* A REPLACEMENT WHILE ONE IS UP BREATHES IN PLACE (the founder, 2026-10-21: "notifcaton ... should be smooth and consistent
       and shouldnt break under pressure"): twelve toasts in a burst are one bar changing its words, with a breath from what is
       on screen (OW.motion.bounce); a toast that was not up rises in */
    if (toastEl.hasAttribute('data-on') && OW.motion) {
      OW.motion.bounce(toastEl, 'bump', 'translateX(-50%) translateY(0)');
    } else {
      toastEl.removeAttribute('data-on');
      void toastEl.offsetWidth;
      toastEl.setAttribute('data-on', '1');
    }
    /* an error gets the second he asked for; something with an action to press
       gets long enough to press it */
    toastTimer = global.setTimeout(OW.toast.hide, opts.action ? 8000 : Math.min(10000, Math.max(opts.big ? 7000 : 4000, String(msg).length * 45)));
  };
  OW.toast.hide = function () {
    if (toastTimer) { global.clearTimeout(toastTimer); toastTimer = 0; }
    if (!toastEl) return;
    toastEl.removeAttribute('data-on');
    var el = toastEl;
    global.setTimeout(function () {
      if (el && el.parentNode && !el.hasAttribute('data-on')) el.parentNode.removeChild(el);
    }, OW.motion.ms('leave') + 100);      /* after its leave has run */
  };

  /* ══ ARE YOU SURE: THE ONE QUESTION BEFORE AN ACT (founder/882, 2026-10-21: "are you sure u want to delete? system popups
     should popup smoothly in simple mode or popit") ═══════════════════════════════════════════════════════════════════════
     OW.sure(words, { yes, no, tone: 'danger' }) -> a promise of true or false. It is the toast's own surface (its look in
     Popit and in Simple, founder/871) holding the question and two buttons, and it moves as the toast does (S33): it rises
     from under the dock, swells a touch and settles; leaving, it sinks. Not a box over the page (S2): nothing behind it dims
     or stops, and the page can still be scrolled and read. Escape, or the other button, is no. A second question while one
     is up answers the first no and takes its place with a breath. The App had none ("the App's confirm screen does not exist
     here", messaging.js), so each surface asked in its own way; every confirm and alert asks here now. */
  var sureEl = null, sureDone = null, sureN = 0;
  OW.sure = function (msg, opts) {
    opts = opts || {};
    var was = !!(sureEl && sureEl.parentNode && sureEl.hasAttribute('data-on'));
    if (sureDone) sureDone(false, true);
    if (OW.toast && OW.toast.hide) OW.toast.hide();
    return new Promise(function (resolve) {
      var back = doc.activeElement, id = 'ow-sure-' + (++sureN);
      if (!sureEl || !sureEl.parentNode) {
        sureEl = doc.createElement('div');
        sureEl.className = 'ow-toast ow-sure';
        sureEl.setAttribute('role', 'alertdialog');
        doc.body.appendChild(sureEl);
      }
      var el = sureEl;
      el.innerHTML = '';
      var t = doc.createElement('p'); t.className = 'ow-sure__t'; t.id = id; t.textContent = String(msg || 'Are you sure?');
      el.setAttribute('aria-labelledby', id);
      var row = doc.createElement('div'); row.className = 'ow-sure__acts';
      var no = doc.createElement('button'); no.type = 'button'; no.className = 'po-act'; no.textContent = opts.no || 'Cancel';
      var yes = doc.createElement('button'); yes.type = 'button'; yes.className = 'po-act po-act--primary' + (opts.tone === 'danger' ? ' po-act--danger' : ''); yes.textContent = opts.yes || 'Yes';
      if (opts.tone === 'danger') yes.setAttribute('data-tone', 'danger');
      row.appendChild(no); row.appendChild(yes); el.appendChild(t); el.appendChild(row);
      aboveDock(el);
      var over = false;
      function done(v, quiet) {
        if (over) return; over = true; sureDone = null;
        doc.removeEventListener('keydown', key, true);
        if (!quiet) {
          el.removeAttribute('data-on');
          global.setTimeout(function () { if (el.parentNode && !el.hasAttribute('data-on')) el.parentNode.removeChild(el); }, OW.motion.ms('leave') + 100);
          try { if (back && back.focus && back.isConnected) back.focus({ preventScroll: true }); } catch (_) {}
        }
        resolve(!!v);
      }
      function key(e) { if (e.key === 'Escape') { e.preventDefault(); done(false); } }
      no.addEventListener('click', function () { done(false); });
      yes.addEventListener('click', function () { done(true); });
      doc.addEventListener('keydown', key, true);
      sureDone = done;
      if (was && el.hasAttribute('data-on')) OW.motion.bounce(el, 'bump', 'translateX(-50%) translateY(0)');
      else { el.removeAttribute('data-on'); void el.offsetWidth; el.setAttribute('data-on', '1'); }
      try { (opts.tone === 'danger' ? no : yes).focus({ preventScroll: true }); } catch (_) {}
    });
  };

  global.OW = OW;
})(window);
