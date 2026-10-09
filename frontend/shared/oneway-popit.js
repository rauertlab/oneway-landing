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
  var OW = {};

  /* ── tiny helpers ────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* AN IMAGE URL THIS MATERIAL WILL LOAD. `esc` stops a value breaking OUT of
     the attribute; it does nothing about where the attribute POINTS. Every
     cover, avatar and banner here comes from a server payload, and a client
     that loads whatever a payload names is one bad row away from making every
     viewer fetch an attacker's host — a tracking beacon carrying each viewer's
     IP, fired for everyone who opens the surface.

     Mirrors the rule the runtime already enforces on the way in (`_asset_url`:
     "never an arbitrary remote URL — that would let a profile hotlink
     anything"). Same rule at both ends, so neither can be the weak one. Lives
     HERE rather than in the reality layer because this is where images are
     rendered, and one validator is the point. */
  var SAFE_PATH = /^\/(assets|media|uploads)\/[A-Za-z0-9._\-\/]{1,200}$/;
  /* IMAGES ARE SERVED BY THE RUNTIME, so a server-relative path follows the
     runtime's origin — not the origin the page happens to be served from.
     Same-origin in production makes these identical; they are NOT identical
     when the App is opened against an API on another host, which is every
     development setup and every future native shell. Set by OW.data.configure
     so there is one place that knows where the runtime lives. */
  OW.assetBase = '';
  OW.imageUrl = function (v) {
    var u = String(v == null ? '' : v).trim();
    if (!u) return '';
    if (SAFE_PATH.test(u) && u.indexOf('..') < 0) return (OW.assetBase || '') + u;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
    if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
    return '';                       /* refused → the caller's honest fallback */
  };

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
  var DEF1 = '124,45,255', DEF2 = '93,226,255';
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
      var d = parseInt(deg, 10); if (isNaN(d)) d = 258;
      return [hsl2rgb(d, 100, 68).join(','), hsl2rgb(d - 64, 100, 68).join(',')];
    },
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
      return hsl2rgb((hsl[0] + 42) % 360, 100, 66).join(',');
    },
    set: function (h1, h2) {
      if (hueRAF) { cancelAnimationFrame(hueRAF); hueRAF = 0; }
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
      var cs = getComputedStyle(root);
      var fr1 = parseTriplet(cs.getPropertyValue('--ow-h1')) || parseTriplet(DEF1);
      var fr2 = parseTriplet(cs.getPropertyValue('--ow-h2')) || parseTriplet(DEF2);
      if (!to2) to2 = to1;
      var dur = ms || 800, t0 = performance.now();
      if (hueRAF) cancelAnimationFrame(hueRAF);
      huePending = { h1: h1, h2: h2, angle: wantsAngle ? parseInt(angle, 10) : null };
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        function mix(a, b) {
          return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * e); }).join(',');
        }
        var m1 = mix(fr1, to1);
        root.style.setProperty('--ow-h1', m1);
        root.style.setProperty('--ow-h2', mix(fr2, to2));
        root.style.setProperty('--ow-h3', hue.third(m1) || mix(fr2, to2));
        if (wantsAngle) {
          /* the angle of the colour THIS frame is painting. The second
             argument says whether this frame is a waypoint or the
             destination — only the destination wakes the canvases. */
          var landed = (k >= 1);
          var a = landed ? parseInt(angle, 10) : hue.angleOf(m1);
          if (a != null) hue.angle(a, !landed);
        }
        hueRAF = k < 1 ? requestAnimationFrame(step) : 0;
        if (k >= 1) huePending = null;          /* it arrived under its own power */
      })(t0);
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

         Every listener redraws in full. `OW.farField` repaints an entire
         starfield — every link stroked, every point filled, twice, because the
         sky is two parallax canvases — and `oneway-galaxy.js` re-reads
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

  /* Bind the surface to the viewer's own hue. Call once at boot in the App.
     `hue` may be a pair {h1,h2} (an authored identity — always wins) or an
     angle (the backend's resolved_hue, bridged to a pair). */
  hue.bind = function (opts) {
    opts = opts || {};
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
      return inContext ? null : applyPair(DEF1, DEF2, _ms); }
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
    var back = ctxPair || { h1: DEF1, h2: DEF2 };
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
  var worldNode = null, canvasStop = null;
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
      /* THE BACKING GALAXY, generated rather than tiled. Sits under the live
         network and over the star field — the far distance, still, because
         motion at this depth is what turns a sky into a screensaver. */
      /* ── DEPTH: TWO FIELDS, NOT ONE ────────────────────────────────────
         ★ FOUNDER, 2026-08-29: *"make sure that galaxy background when turned
           on looks good on all platforms, on local host here looks quite
           shallow."*

         It was shallow because it was ONE layer. Every structure was drawn at
         one distance from one origin, so the sky had scale variation but no
         PARALLAX — nothing was behind anything else, and a flat field of dots
         is what that looks like however varied the dots are.

         A second field is drawn from a DIFFERENT REGION of the same infinite
         generator, smaller and dimmer, sitting behind the first. Two fields
         from one generator, not two generators: the far one is the same sky
         seen from further away, which is why it never disagrees with the near
         one about what kind of place this is.

         IT COSTS ONE MORE CANVAS AND NO FRAMES. Both are drawn once and never
         animate — motion at this depth is what turns a sky into a
         screensaver — so depth here is paid for in pixels, not in frame time,
         and the mobile safe floor drops the far one rather than the near. */
      var deep = doc.createElement('canvas'); deep.className = 'ow-world__deep';
      worldNode.appendChild(deep);
      try { OW.farField(deep, { ox: 48310, oy: 22740 }); } catch (e) {}

      var far = doc.createElement('canvas'); far.className = 'ow-world__far';
      worldNode.appendChild(far);
      try { OW.farField(far); } catch (e) {}
      var cv = doc.createElement('canvas'); cv.className = 'ow-world__canvas';
      worldNode.appendChild(cv);
      doc.body.insertBefore(worldNode, doc.body.firstChild);
      if (tier === 2) canvasStop = mountCanvas(cv);
      watchFrames();
      return worldNode;
    },
    unmount: function () {
      if (canvasStop) { canvasStop(); canvasStop = null; }
      if (worldNode) { worldNode.remove(); worldNode = null; }
    }
  };

  /* Tier-2 only: parallax bokeh over the CSS starfield. Deliberately small —
     the CSS layers already carry the sky; this adds foreground depth. Parks
     itself whenever the tab is hidden. */
  function mountCanvas(cv) {
    var ctx = cv.getContext('2d', { alpha: true }), raf = 0, W = 0, H = 0;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var mx = .5, my = .5, pts = [];
    function size() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      pts = []; var n = 16;
      for (var i = 0; i < n; i++) pts.push({
        x: Math.random(), y: Math.random(),
        r: 20 + Math.random() * 70,
        a: .012 + Math.random() * .03,
        par: .3 + Math.random() * 1.5,
        vx: (Math.random() - .5) * .00012, vy: (Math.random() - .5) * .0001
      });
    }
    function frame() {
      if (doc.hidden) { raf = requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      var pmx = (mx - .5) * 80, pmy = (my - .5) * 50;
      var cs = getComputedStyle(root);
      var c1 = parseTriplet(cs.getPropertyValue('--ow-h1')) || [139, 92, 255];
      var c2 = parseTriplet(cs.getPropertyValue('--ow-h2')) || [93, 226, 255];
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -.2 || p.x > 1.2) p.vx *= -1;
        if (p.y < -.2 || p.y > 1.2) p.vy *= -1;
        var bx = p.x * W + pmx * p.par, by = p.y * H + pmy * p.par;
        var col = (i % 2) ? c2 : c1;
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, p.r);
        g.addColorStop(0, 'rgba(' + col.join(',') + ',' + p.a + ')');
        g.addColorStop(1, 'rgba(' + col.join(',') + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, p.r, 0, 6.2832); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    function onMove(e) { mx = e.clientX / (W || 1); my = e.clientY / (H || 1); }
    size(); seed(); raf = requestAnimationFrame(frame);
    var ro = global.ResizeObserver ? new ResizeObserver(size) : null;
    if (ro) ro.observe(cv); else global.addEventListener('resize', size, { passive: true });
    global.addEventListener('mousemove', onMove, { passive: true });
    return function () {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else global.removeEventListener('resize', size);
      global.removeEventListener('mousemove', onMove);
    };
  }

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

  /* A small, neutral icon set. Icons NAME a role, they never decorate — and a
     Popit whose object gives no icon simply has none (nothing is invented). */
  var ICONS = {
    home:    '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3z"/>',
    layers:  '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    people:  '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6"/>',
    place:   '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    event:   '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    talk:    '<path d="M4 5h16v11H9l-4 4V5z"/>',
    doc:     '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    building:'<path d="M4 21V7l8-4 8 4v14"/><path d="M3 21h18M9 21v-5h6v5M9 11h.01M15 11h.01"/>',
    spark:   '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    link:    '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    music:   '<circle cx="7" cy="18" r="3"/><circle cx="18" cy="15" r="3"/><path d="M10 18V6l11-2v11"/>',
    video:   '<rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="M16 11l6-3v8l-6-3z"/>',
    camera:  '<rect x="2.5" y="6.5" width="19" height="13" rx="3"/><circle cx="12" cy="13" r="3.6"/><path d="M8 6.5l1.4-2h5.2L16 6.5"/>',
    cart:    '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l3 12h11l2-8H7"/>',
    mail:    '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.2 0 18M12 3c-3 3.4-3 14.2 0 18"/>',
    write:   '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13.5 6.5l3 3"/>',
    /* THE RESPONSE GLYPHS. The runtime stores MEANING ("like"), never a glyph —
       so the heart lives here, in presentation, and changing it needs no
       migration (the response primitive keeps the two apart on purpose). */
    /* ── THE RESPONSE GLYPHS, REDRAWN ────────────────────────────────────
       ★ FOUNDER, 2026-08-29: *"icons still look really weird and aren't shaped
         well enough, like and dislike."*

       THE HEART WAS NOT A HEART. Its two lobes started at y=7 while the point
       sat at y=20 — a 13-unit drop from a 5-unit shoulder — so it read as a
       narrow shield with a dent in the top. A heart's lobes have to be nearly
       circular and sit high, and its widest point is ABOVE the vertical middle.
       This one is drawn from two arcs of equal radius meeting at a centre
       notch, on the 24-unit grid the rest of the set uses.

       THE THUMB WAS NOT A THUMB. `M7 3h9l3 8h-4v6.5…` is a wedge with a
       rectangle beside it: no thumb, no knuckle, no cuff — a shape nobody
       reads as a hand. Redrawn with a real thumb, a fist and a separate cuff,
       pointing down, so it is legible at 24px without a caption. */
    heart:   '<path d="M12 20.4 4.6 13.2a4.6 4.6 0 0 1 0-6.6 4.6 4.6 0 0 1 '
             + '6.5 0l.9.9.9-.9a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.6z"/>',
    thumbdown:'<path d="M15.2 3.2H8.6a2 2 0 0 0-2 1.7l-1 6.4a2 2 0 0 0 2 2.3h3.2'
             + 'l-.7 3.3a2.1 2.1 0 0 0 2 2.6c.5 0 .9-.3 1.1-.7l2.9-5.6z"/>'
             + '<path d="M18.1 3.2h1.2a1.4 1.4 0 0 1 1.4 1.4v7.2a1.4 1.4 0 0 1'
             + '-1.4 1.4h-1.2z"/>',
    repost:  '<path d="M4 9V7a3 3 0 0 1 3-3h9"/><path d="M13 1.5L16.5 4 13 6.5"/><path d="M20 15v2a3 3 0 0 1-3 3H8"/><path d="M11 22.5L7.5 20 11 17.5"/>',
    share:   '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>',
    bookmark:'<path d="M6 3h12v18l-6-4.5L6 21z"/>',
    eye:     '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/>',
    /* ── THE VIDEO SET ────────────────────────────────────────────────────
       Same 24-unit grid, same weight, so a sound control over a video belongs
       to the same family as a heart on a card. `muted` is the speaker with the
       cross rather than a speaker with no waves: an absence reads as "no
       icon", a cross reads as "off". */
    play:    '<path d="M7.5 4.8 19 12 7.5 19.2z"/>',
    pause:   '<path d="M8.5 4.5h3v15h-3z"/><path d="M12.5 4.5h3v15h-3z"/>',
    sound:   '<path d="M4 9.5h3.6L12 5.4v13.2L7.6 14.5H4z"/>'
             + '<path d="M15.6 9a4.2 4.2 0 0 1 0 6"/>'
             + '<path d="M18.2 6.4a7.8 7.8 0 0 1 0 11.2"/>',
    muted:   '<path d="M4 9.5h3.6L12 5.4v13.2L7.6 14.5H4z"/>'
             + '<path d="M16 9.6l4.6 4.8"/><path d="M20.6 9.6 16 14.4"/>'
  };
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

  /* ═══ THE MARK WEARS THE SAME LIGHT AS THE WORLD ═══════════════════════
     Founder (2026-08-02): the app and web icon should correspond to the
     user's — or the viewed Center's — hue.

     The tab icon is therefore DERIVED, not a file: the same globe geometry,
     painted in whatever `--ow-h1` currently is, written into the <link> as an
     SVG data URI. So entering a Center re-colours the world AND the tab, and a
     person's own hue follows them across every surface.

     It is one geometry with the built file: tools/make_icon.py emits the same
     cage into oneway-globe.svg and the PNGs. The PNG sizes stay ONEWAY purple
     on purpose — an installed home-screen icon is baked at install time and a
     phone will not repaint it, so promising a per-person app icon there would
     be a promise the platform cannot keep. The tab, which IS repaintable, keeps
     its promise. */
  var ICON_PAR = [[33.06,9.92,20.96],[41.54,12.46,35.48],[44,13.2,50],
                  [41.54,12.46,64.52],[33.06,9.92,79.04]];
  var ICON_MER = [44, 40.8, 32.7, 22, 10.64];
  var lastIcon = '';

  function iconSVG(rgb) {
    var lines = '<circle cx="50" cy="50" r="44"/>';
    ICON_PAR.forEach(function (p) {
      lines += '<ellipse cx="50" cy="' + p[2] + '" rx="' + p[0] + '" ry="' + p[1] + '"/>';
    });
    ICON_MER.forEach(function (r) {
      lines += '<ellipse cx="50" cy="50" rx="' + r + '" ry="44"/>';
    });
    lines += '<line x1="50" y1="6" x2="50" y2="94"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
      + '<g fill="none" stroke="rgb(' + rgb + ')" stroke-width="7" opacity=".26">'
      + lines + '</g>'
      + '<g fill="none" stroke="rgb(' + rgb + ')" stroke-width="2.6" opacity=".8">'
      + lines + '</g>'
      + '<circle cx="50" cy="50" r="44" fill="none" stroke="rgb(' + rgb + ')"'
      + ' stroke-width="3"/></svg>';
  }

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
  OW.paintIcon = function () {
    if (!doc || !doc.head) return;
    var rgb = getComputedStyle(root).getPropertyValue('--ow-h1').trim();
    if (!rgb || rgb === lastIcon) return;
    lastIcon = rgb;
    var icon = rgb.replace(/\s+/g, '') === PLATFORM_HUE ? ICON_BLUE : rgb;
    var href = 'data:image/svg+xml,' + encodeURIComponent(iconSVG(icon));
    var link = doc.querySelector('link[rel="icon"][data-ow-dynamic]');
    if (!link) {
      link = doc.createElement('link');
      link.rel = 'icon'; link.type = 'image/svg+xml';
      link.setAttribute('data-ow-dynamic', '1');
      doc.head.appendChild(link);
    }
    link.href = href;

    /* ★ THE STATIC ICONS MUST GO, OR THE HUE NEVER REACHES THE TAB.
       Founder, 2026-08-30: *"that OW browser icon is severely dated and we have
       the globe icon that should auto sync with users set hue."*

       THE DYNAMIC MARK WAS ALREADY BEING GENERATED CORRECTLY — measured on the
       live document, a data-URI globe in `rgb(160,92,255)`, the viewer's own
       hue, appended last. It just was not what the browser drew. The page also
       ships `<link rel="icon" href="/oneway-globe.svg">` and a 32x32 PNG, and a
       browser picks the icon whose declared SIZE fits the slot it needs — a
       sized raster beats an unsized SVG almost everywhere. So the tab showed a
       FIXED PURPLE globe on every surface, in every Center, whatever colour the
       person had chosen. The right geometry in the wrong, frozen colour.

       Removing them is what makes the remaining one authoritative. The mark is
       identical — same generator, same geometry — so nothing about the identity
       changes except that it now follows the light like everything else does.

       APPLE-TOUCH AND MANIFEST ARE LEFT ALONE, deliberately: an installed icon
       is fetched once by the OS and no script can repaint it, which is exactly
       why `setLink` below points those at the server-side renderer in the
       person's own colour instead. */
    var stale = doc.querySelectorAll('link[rel~="icon"]:not([data-ow-dynamic])');
    for (var i = 0; i < stale.length; i++) {
      if (/apple-touch/i.test(stale[i].getAttribute('rel') || '')) continue;
      stale[i].parentNode.removeChild(stale[i]);
    }

    /* THE BROWSER CHROME TAKES THE SAME LIGHT — and it is the HUE, not the
       ground. Setting theme-color to the near-black ground meant the status bar
       and the task switcher stayed identically dark in every Center, so the one
       piece of platform chrome a person actually sees on a phone was the one
       piece that never corresponded to anything. */
    var tc = doc.querySelector('meta[name="theme-color"]');
    if (!tc) { tc = doc.createElement('meta'); tc.name = 'theme-color';
               doc.head.appendChild(tc); }
    tc.setAttribute('content', 'rgb(' + rgb + ')');

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

  /* ═══ THE SKY — the constellation, which is the real ONEWAY background ═════
     Founder (2026-08-03): the sign-up page "is a perfect basis for how the final
     should look… the main things are backgrounds and layouts."

     I HAD INVENTED SOMETHING ELSE. My first version was drifting nebulae —
     plausible, atmospheric, and nowhere in this product. The actual background,
     already shipping on sign-up, is a NETWORK: points that drift and draw a line
     to every neighbour they come close to. That is not decoration, it is the thesis —
     Centers are only interesting because of what connects them — which is
     exactly why it was the wrong thing to replace with clouds.

     THREE THINGS CHANGE AS IT BECOMES SHARED:
     · it takes the HUE, so the world is this person's world (sign-up drew it in
       flat white, which was fine when it lived on one page and wrong the moment
       every surface carries it);
     · the mobile safe floor gets a STATIC field instead — canon is explicit that
       touch devices get no always-on canvas, and a page that quietly runs one
       anyway is the safe floor being observed in comment only;
     · it PARKS when the tab is hidden, because a rAF loop nobody is looking at
       is pure battery. */
  /* EVERY POINT WAS THE SAME POINT — and that is why it read as a mesh rather
     than a sky. One size, one speed, one link distance, one opacity: a regular
     lattice wearing a colour. A real constellation has magnitude, depth and
     clustering, and those are what make it feel found rather than drawn.

     FIVE VARIABLES NOW, and each does something a person can feel:

       z     DEPTH. Drives size, brightness AND speed together, so far points
             drift slowly and dim while near ones move and shine. Parallax with
             no second layer to keep in sync.
       r     MAGNITUDE. A few bright anchors among many faint ones, so the eye
             finds structure instead of texture.
       link  REACH, per point. Uniform reach is what produced the even mesh;
             varying it lets dense knots and empty gulfs appear on their own.
       tw    A slow, out-of-phase brightness drift. Never a blink — a blinking
             background is a nervous tic.
       seeds CLUSTERING. Uniform random is not random-looking: it is evenly
             grey. Most points gather loosely around a few seeds, the rest
             scatter, which is how actual star fields read.

     Deliberately NOT seeded per person: the hue already carries whose world
     this is, and a fixed layout would make every reload identical — the sky
     should be different every time you arrive, the way a sky is. */
  /* ── A SKY WITH STRUCTURE, NOT AN EVEN SPRINKLE ─────────────────────────
     ★ FOUNDER, 2026-08-26: *"in the galaxy itself make sure patterns don't look
       too close to each other or duplicates of each to avoid it feeling cheap"*
       — and, after the star tiles were fixed: *"still has repetition with
       patterns."* The tiles were only half of it; this is the other half.

     WHY EVERY REGION LOOKED THE SAME. Four things, and none of them was random
     enough to hide the other three:

       · the count was CAPPED AT 90 however wide the screen — so a 2226px
         canvas got the same handful of points as a laptop, spread thinner;
       · there were only 2-4 seeds;
       · every seed used the SAME spread formula and the same 62% gather
         probability, so every knot had an identical statistical shape;
       · `link` sat in a narrow band (9000-22000), so mesh density was uniform
         across the whole field — every triangle the same size as every other.

     Uniform randomness is not variety. It is noise with one texture, and the
     eye reads one texture as a repeat however random the individual dots are.

     WHAT MAKES A SKY READ AS REAL IS THE EMPTINESS. Real skies are mostly
     nothing, with a few dense cores and long bare stretches between them. So
     each region now has its OWN character — its own population, tightness and
     link reach — and some of the field is deliberately left bare. */
  function skyPoints(w, h) {
    var pts = [], i, j;
    var R = Math.random;
    /* SCALED BY AREA, so a wide screen gets a fuller sky instead of the same
       ninety points stretched across it. Still bounded — the cost law applies
       to a field that is redrawn every frame, and the pair loop below is
       quadratic, so this is a ceiling rather than a target. */
    var area = Math.max(1, w * h);
    var n = Math.max(38, Math.min(150, Math.round(area / 15000)));

    /* EACH REGION IS ITS OWN KIND OF PLACE. A core is tight, populous and
       heavily linked; a drift is wide, sparse and barely linked at all. Giving
       every seed the same character is what made four knots look like one knot
       drawn four times. */
    var sn = 3 + ((R() * 4) | 0);                     /* 3-6 regions */
    var seeds = [];
    for (i = 0; i < sn; i++) {
      var core = R() < .45;
      seeds.push({
        x: R() * w, y: R() * h,
        tight: core ? (.05 + R() * .07) : (.16 + R() * .20),
        weight: core ? (1.4 + R() * 1.6) : (.4 + R() * .8),
        /* the reach of a line, PER REGION and across a wide range — a core
           webs densely, a drift is nearly bare */
        link: core ? (16000 + R() * 20000) : (2500 + R() * 7000)
      });
    }
    var total = seeds.reduce(function (a, s) { return a + s.weight; }, 0);

    /* A VOID. One region of the field is kept empty, because bare sky is what
       the eye uses to tell one part from another — an evenly covered field has
       no landmarks and therefore no scale. */
    var void_ = { x: R() * w, y: R() * h, r: Math.min(w, h) * (.18 + R() * .14) };

    function inVoid(x, y) {
      var dx = x - void_.x, dy = y - void_.y;
      return (dx * dx + dy * dy) < (void_.r * void_.r);
    }

    /* gaussian-ish, so a core actually has a CORE rather than a flat disc */
    function bell() { return (R() + R() + R() - 1.5) / 1.5; }

    var guard = 0;
    while (pts.length < n && guard < n * 30) {
      guard++;
      var x, y, seed = null;
      var roll = R();
      if (roll < .78) {                               /* most belong to a region */
        var t = R() * total, acc = 0;
        for (j = 0; j < seeds.length; j++) {
          acc += seeds[j].weight;
          if (t <= acc) { seed = seeds[j]; break; }
        }
        seed = seed || seeds[0];
        var spread = Math.min(w, h) * seed.tight;
        x = seed.x + bell() * spread * 2.2;
        y = seed.y + bell() * spread * 2.2;
      } else {                                        /* the rest are between */
        x = R() * w; y = R() * h;
      }
      /* REFLECTED, NOT CLAMPED. Clamping stacks every stray point onto the
         edge, which draws a bright line down the side of the screen. */
      if (x < 0) x = -x; if (x > w) x = w - (x - w);
      if (y < 0) y = -y; if (y > h) y = h - (y - h);
      if (x < 0 || x > w || y < 0 || y > h) continue;
      if (inVoid(x, y) && R() < .93) continue;        /* the void, mostly kept */

      var z = .3 + R() * .7;
      var bright = R() < .10;
      /* A FEW LONERS — bright, isolated, linked to nothing. They are what stop
         the field reading as one connected mesh. */
      var loner = R() < .08;
      pts.push({
        x: x, y: y, z: z,
        vx: (R() - .5) * .26 * z,
        vy: (R() - .5) * .26 * z,
        r: (bright ? 1.7 : .7) + R() * .9 * z,
        link: loner ? 300 : ((seed ? seed.link : 3500) * (.7 + R() * .6)),
        tw: R() * 6.283,
        tws: .0004 + R() * .0011
      });
    }
    return pts;
  }

  /* ═══ THE BACKING GALAXY — an environment, not wallpaper ══════════════════
     ★ FOUNDER, 2026-08-26: *"the faint backing/secondary constellation field
       behind them is still visibly repetitive... Don't generate a collection of
       randomized versions of one constellation. Generate an environment whose
       regions have fundamentally different statistical structures."*

     WHAT IT WAS. `.ow-sky::after` was a 420x420 SVG holding ONE hand-drawn
     constellation — five paths, eleven stars — set to `background-repeat`. On a
     2226px screen that is the same constellation 5.3 times across and 2.5 times
     down, at opacity .5. Not "randomness that reads as repetitive": literally
     one picture, tiled. No amount of extra points would have fixed it, which is
     exactly why the founder said not to try.

     WHAT IT IS NOW. Position-dependent deterministic generation:

         world position -> regional seed -> regional MORPHOLOGY -> stars

     The middle step is the one that matters. Seeding coordinates randomly still
     produces wallpaper if every region runs the same generator — same topology,
     same spread formula, same connection rule. So a region first draws WHAT KIND
     OF PLACE IT IS from seven genuinely different grammars, and each grammar has
     its own scale, orientation, density, opacity, node size and linking
     behaviour. A filament and a globular cluster are not two samples of one
     distribution; they are different objects.

     STABLE, BECAUSE THE SEED IS THE POSITION. The same region generates
     identically on every reload and at every viewport, so nothing flickers when
     the window resizes and a person does not get a different galaxy for turning
     their phone. Viewport only decides WHICH cells are drawn.

     NOT A GRID, THOUGH IT IS GENERATED FROM ONE. Structures are centred anywhere
     within a cell and are frequently LARGER than one, so they cross boundaries;
     cells hold zero, one or two of them; and the draw walks a one-cell margin so
     off-screen structures bleed in. A cell is where a seed comes from, never a
     frame anything is drawn inside. */
  var FAR_CELL = 1180;

  /* integer hash — deterministic, order-independent, no Math.random anywhere in
     this file's far-field path (that is what would make it flicker) */
  function fhash(x, y, salt) {
    var h = (x | 0) * 374761393 + (y | 0) * 668265263 + (salt | 0) * 1442695040;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function frand(seed) {                       /* mulberry32 */
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── WHERE THE GALAXY IS RICH AND WHERE IT IS BARREN ────────────────────
     ★ FOUNDER, 2026-08-26: *"don't make the spacing mechanically uniform. I
       want natural gaps: sometimes two relatively close, sometimes a huge empty
       stretch, then one faint constellation far away."*

     ROLLING EACH CELL INDEPENDENTLY CANNOT PRODUCE THAT. Independent rolls give
     a Poisson field, which is statistically uniform — every stretch of sky is
     as likely to be empty as every other, so the gaps all come out the same
     SIZE. That reads as mechanical however random each individual roll is, and
     it is why "reduce the probability" alone would only have made a uniformly
     emptier sky.

     Natural clustering needs SPATIAL CORRELATION: a slow field, several cells
     across, that says how rich this whole area is. Two neighbouring cells share
     almost the same value, so structures arrive in loose company; a barren
     stretch stays barren for its whole width. Smoothed value noise over the
     same deterministic hash, so it costs nothing and stays stable. */
  function fnoise(x, y, salt) {           /* value noise in [0,1] */
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    function at(a, b) { return fhash(a, b, salt) / 4294967296; }
    var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function richness(cx, cy) {
    /* two octaves — the broad continent, and a little relief on it */
    var n = fnoise(cx / 5.5, cy / 5.5, 31) * .72 + fnoise(cx / 2.1, cy / 2.1, 57) * .28;
    /* PUSHED TOWARD THE EXTREMES so most of the sky is genuinely empty and the
       rich parts are unmistakably rich — a mid-heavy field is the uniform one
       again, wearing different numbers. */
    /* TUNED AGAINST THE FIELD IT REPLACED, not against taste. The tiled original
       measured 58,980 lit pixels on a 2560x1640 buffer. At exponent 1.75 this
       came out at 74,716 — DENSER than the thing the founder called too
       frequent. The lever is frequency, not brightness: fewer structures, each
       keeping its own character and its own distance, which is what "more
       widely spaced" actually asks for. */
    return Math.pow(n, 2.45);
  }

  /* ── THE GRAMMARS. Each returns {pts:[{x,y,r,a}], links:[[i,j,a]]} in local
     coordinates around (0,0). They differ in TOPOLOGY, not in parameters. */
  var FAR_MORPH = {
    /* barely anything — the bare stretches that give the sky its scale */
    void: function (R) {
      var n = (R() * 3) | 0, pts = [], i;
      for (i = 0; i < n; i++)
        pts.push({ x: (R() - .5) * 900, y: (R() - .5) * 900,
                   r: 1.1 + R() * .9, a: .40 + R() * .28 });
      return { pts: pts, links: [] };
    },
    /* unstructured haze — many faint points, no links, no centre */
    dust: function (R) {
      var n = 26 + ((R() * 60) | 0), pts = [], i;
      var sx = 300 + R() * 700, sy = 300 + R() * 700;
      for (i = 0; i < n; i++)
        pts.push({ x: (R() - .5) * sx * 2, y: (R() - .5) * sy * 2,
                   r: .8 + R() * .7, a: .30 + R() * .26 });
      /* A FEW VERY LONG, VERY FAINT THREADS. Measured against the tiled field
         it replaced: that had 1,562 bright pixels and 57,418 FAINT ones — its
         whole presence was long barely-visible line work, and dropping it is
         what made this read as removed rather than as distant. */
      var links = [];
      for (i = 0; i + 1 < pts.length; i++)
        if (R() < .24) links.push([i, (R() * pts.length) | 0, .042 + R() * .045]);
      return { pts: pts, links: links };
    },
    /* a long thread of stars, linked in sequence — thin, directional, nothing
       like a cluster */
    filament: function (R) {
      var n = 11 + ((R() * 16) | 0), pts = [], links = [], i;
      var len = 1000 + R() * 1900, ang = R() * 6.283;
      var bow = (R() - .5) * 620, wob = 14 + R() * 46;
      for (i = 0; i < n; i++) {
        var t = i / (n - 1), off = Math.sin(t * Math.PI) * bow;
        var lx = (t - .5) * len, ly = off + (R() - .5) * wob;
        pts.push({ x: lx * Math.cos(ang) - ly * Math.sin(ang),
                   y: lx * Math.sin(ang) + ly * Math.cos(ang),
                   r: 1.1 + R() * .9, a: .40 + R() * .32 });
        if (i) links.push([i - 1, i, .07 + R() * .07]);
      }
      return { pts: pts, links: links };
    },
    /* a dense core falling off radially — links only near the middle */
    globular: function (R) {
      var n = 26 + ((R() * 46) | 0), pts = [], links = [], i, j;
      var core = 40 + R() * 120, halo = 2.4 + R() * 3.2;
      var sx = .6 + R() * .9, sy = .6 + R() * .9, ang = R() * 6.283;
      for (i = 0; i < n; i++) {
        var rr = core * Math.pow(R(), .45) * halo, a2 = R() * 6.283;
        var lx = Math.cos(a2) * rr * sx, ly = Math.sin(a2) * rr * sy;
        pts.push({ x: lx * Math.cos(ang) - ly * Math.sin(ang),
                   y: lx * Math.sin(ang) + ly * Math.cos(ang),
                   r: .75 + (1 - rr / (core * halo)) * 1.7,
                   a: .26 + (1 - rr / (core * halo)) * .5 });
      }
      for (i = 0; i < pts.length; i++)
        for (j = i + 1; j < pts.length; j++) {
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          if (dx * dx + dy * dy < core * core * 2.1 && R() < .42)
            links.push([i, j, .05 + R() * .06]);
        }
      return { pts: pts, links: links };
    },
    /* two knots and a bridge — a topology no single cluster produces */
    pair: function (R) {
      var gap = 260 + R() * 700, ang = R() * 6.283, pts = [], links = [], k, i;
      var anchors = [];
      for (k = 0; k < 2; k++) {
        var cx = (k ? gap / 2 : -gap / 2), n = 5 + ((R() * 12) | 0);
        var spread = 30 + R() * 90;
        anchors.push(pts.length);
        for (i = 0; i < n; i++) {
          var lx = cx + (R() - .5) * spread * 2, ly = (R() - .5) * spread * 2;
          pts.push({ x: lx * Math.cos(ang) - ly * Math.sin(ang),
                     y: lx * Math.sin(ang) + ly * Math.cos(ang),
                     r: 1.15 + R() * 1.0, a: .42 + R() * .32 });
        }
      }
      links.push([anchors[0], anchors[1], .07 + R() * .06]);
      return { pts: pts, links: links };
    },
    /* a far-off smudge: many tiny dim points, no links at all */
    smudge: function (R) {
      var n = 40 + ((R() * 90) | 0), pts = [], i;
      var rx = 120 + R() * 300, ry = rx * (.25 + R() * .5), ang = R() * 6.283;
      for (i = 0; i < n; i++) {
        var rr = Math.pow(R(), .7), a2 = R() * 6.283;
        var lx = Math.cos(a2) * rr * rx, ly = Math.sin(a2) * rr * ry;
        pts.push({ x: lx * Math.cos(ang) - ly * Math.sin(ang),
                   y: lx * Math.sin(ang) + ly * Math.cos(ang),
                   r: .7 + R() * .6, a: .26 + (1 - rr) * .3 });
      }
      return { pts: pts, links: [] };
    },
    /* loose scatter, sparsely webbed — the only grammar resembling the old one,
       and it is now ONE of seven rather than all of them */
    web: function (R) {
      var n = 12 + ((R() * 16) | 0), pts = [], links = [], i, j;
      var spread = 300 + R() * 620, reach = spread * (.5 + R() * .58);
      for (i = 0; i < n; i++)
        pts.push({ x: (R() - .5) * spread * 2, y: (R() - .5) * spread * 2,
                   r: .55 + R() * .85, a: .32 + R() * .34 });
      for (i = 0; i < n; i++)
        for (j = i + 1; j < n; j++) {
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < reach && R() < .7)
            links.push([i, j, .06 + R() * .07]);
        }
      return { pts: pts, links: links };
    },
    /* a handful of unrelated bright loners, no structure whatsoever */
    loners: function (R) {
      var n = 2 + ((R() * 4) | 0), pts = [], i;
      for (i = 0; i < n; i++)
        pts.push({ x: (R() - .5) * 1300, y: (R() - .5) * 1300,
                   r: 1.5 + R() * 1.5, a: .55 + R() * .34 });
      return { pts: pts, links: [] };
    }
  };
  /* WEIGHTED SO EMPTINESS DOMINATES. A sky that is mostly structure is a
     texture; a sky that is mostly nothing, with things in it, is space. */
  /* BALANCED BY MEASUREMENT, NOT BY FEEL. The first weighting had three voids
     in twelve plus a 42% empty-cell roll, and measuring eight distant regions
     found FIVE of them completely blank — emptiness is right, invisibility is
     not. A galaxy is mostly nothing WITH THINGS IN IT; this is the second half
     of that sentence. */
  var FAR_TABLE = ['void', 'void', 'smudge', 'smudge', 'dust', 'dust',
                   'filament', 'filament', 'globular', 'globular',
                   'pair', 'loners', 'web', 'web'];

  /* A NAME IN THE TABLE THAT IS NOT A GRAMMAR FALLS BACK TO `web` AND NOBODY
     NOTICES — the variety quietly halves while the code still runs. Checked at
     load instead: `dust_web` was in this table for exactly that reason. */
  (function () {
    for (var i = 0; i < FAR_TABLE.length; i++) {
      if (!FAR_MORPH[FAR_TABLE[i]]) {
        try { console.warn('farField: no grammar named ' + FAR_TABLE[i]); } catch (e) {}
      }
    }
  })();

  /* WHAT A REGION ACTUALLY CONTAINS, without drawing it. The acceptance test
     for this field is "would a person say that is the same constellation
     again" — which is a question about STRUCTURE, not about pixel counts. This
     reports the grammars a region chose and how big each came out, so the
     answer can be measured across distant regions rather than eyeballed. */
  OW.farPlan = function (ox, oy, w, h) {
    var out = [];
    var c0 = Math.floor(ox / FAR_CELL) - 1, c1 = Math.ceil((ox + w) / FAR_CELL) + 1;
    var r0 = Math.floor(oy / FAR_CELL) - 1, r1 = Math.ceil((oy + h) / FAR_CELL) + 1;
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        /* THE SAME ROLLS IN THE SAME ORDER AS `draw`, or this reports a
           galaxy nobody is looking at. Kept adjacent to it on purpose. */
        var R = frand(fhash(cx, cy, 7));
        var rich = richness(cx, cy);
        var count = 0;
        if (R() < rich * 1.35) count = 1;
        if (count && R() < rich * .5) count = 2;
        for (var k = 0; k < count; k++) {
          var kind = FAR_TABLE[(R() * FAR_TABLE.length) | 0];
          R(); R();                                  /* the two placement rolls */
          var o = (FAR_MORPH[kind] || FAR_MORPH.web)(R);
          var far = Math.pow(R(), .55);
          var scale = 1.6 - far * 1.3;
          var xs = o.pts.map(function (p) { return p.x; });
          var ys = o.pts.map(function (p) { return p.y; });
          var span = o.pts.length
            ? Math.round(Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs),
                                  Math.max.apply(null, ys) - Math.min.apply(null, ys)) * scale)
            : 0;
          out.push({ kind: kind, n: o.pts.length, links: o.links.length,
                     span: span, scale: +scale.toFixed(2),
                     far: +far.toFixed(2), rich: +rich.toFixed(3) });
        }
      }
    }
    return out;
  };

  OW.farField = function (cv, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d');
    var DPR = Math.min(global.devicePixelRatio || 1, 2);
    /* WHERE IN THE GALAXY THE APP OPENS. The generator is infinite and
       position-seeded, so (0,0) is not special — and measuring it found it
       nearly empty: three lit pixels in a 1200x700 screenful. An honest galaxy
       contains such regions, but opening the product in one is a choice, not
       honesty.

       So the App starts at a region measured for BALANCE rather than for
       maximum content: ten structures on a 1400x800 screenful, drawn from
       seven different grammars, with a depth spread of .87 — some near enough
       to read at scale 1.44, some so distant they render at .31 and are barely
       there. Chosen by scanning two hundred regions for that combination.

       This is a view of the world, not a special place in it: every other
       region generates identically and the distribution across sixty sampled
       screenfuls is min 0, median 6, p75 11, max 26, with six of the sixty
       completely empty. Landing on a median-to-good one is a choice about
       where the front door is. */
    var ox = opts.ox == null ? 15730 : opts.ox;
    var oy = opts.oy == null ? 6110 : opts.oy;

    function draw() {
      var w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
      cv.width = Math.max(1, w * DPR); cv.height = Math.max(1, h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var rgb = (getComputedStyle(root).getPropertyValue('--ow-h1').trim() || '124,45,255');

      var c0 = Math.floor(ox / FAR_CELL) - 1, c1 = Math.ceil((ox + w) / FAR_CELL) + 1;
      var r0 = Math.floor(oy / FAR_CELL) - 1, r1 = Math.ceil((oy + h) / FAR_CELL) + 1;

      for (var cy = r0; cy <= r1; cy++) {
        for (var cx = c0; cx <= c1; cx++) {
          var R = frand(fhash(cx, cy, 7));
          /* HOW MANY OBJECTS THIS REGION HOLDS — set by how rich this part of
             the galaxy is, not by an independent coin flip. A barren stretch
             stays barren across its whole width; a rich one occasionally puts
             two near each other. Most of the sky is the former. */
          var rich = richness(cx, cy);
          var count = 0;
          if (R() < rich * 1.35) count = 1;
          if (count && R() < rich * .5) count = 2;
          for (var k = 0; k < count; k++) {
            var kind = FAR_TABLE[(R() * FAR_TABLE.length) | 0];
            var gen = FAR_MORPH[kind] || FAR_MORPH.web;
            /* centred ANYWHERE in the cell, and most structures are wider than
               a cell — so the grid that produced the seed never becomes a
               visible frame */
            var px = cx * FAR_CELL + R() * FAR_CELL - ox;
            var py = cy * FAR_CELL + R() * FAR_CELL - oy;
            var o = gen(R);
            /* ── DEPTH, WHICH IS WHAT MAKES IT AN ENVIRONMENT ──────────────
               ★ FOUNDER: *"let some be extremely faint/distant... some larger
                 but much farther apart... think depth and distance."*
               One scale range gave everything the same apparent distance, so
               the field read as a flat layer of decoration rather than as
               something you look INTO. Distance is drawn from a curve that
               mostly returns FAR, and opacity falls with it — a distant thing
               is dimmer, not merely smaller. */
            var far = Math.pow(R(), .55);          /* 0 near ... 1 far */
            var scale = 1.6 - far * 1.3;           /* 1.6 near -> .30 far */
            /* A FLOOR UNDER DISTANCE. At .74 the farthest objects came out
               around alpha .03 once the grammar's own opacity was applied —
               present in the data and invisible on screen, which is the
               "almost entirely gone" the founder rejected. Distance still
               dims, it just cannot dim to nothing. */
            var dim = 1 - far * .42;
            var pts = o.pts, i;

            ctx.lineWidth = Math.max(.9, 1.25 * scale);
            for (i = 0; i < o.links.length; i++) {
              var L = o.links[i], A = pts[L[0]], B = pts[L[1]];
              if (!A || !B) continue;
              ctx.strokeStyle = 'rgba(' + rgb + ',' + (L[2] * dim).toFixed(3) + ')';
              ctx.beginPath();
              ctx.moveTo(px + A.x * scale, py + A.y * scale);
              ctx.lineTo(px + B.x * scale, py + B.y * scale);
              ctx.stroke();
            }
            for (i = 0; i < pts.length; i++) {
              var P = pts[i];
              ctx.fillStyle = 'rgba(' + rgb + ',' + (P.a * dim).toFixed(3) + ')';
              ctx.beginPath();
              ctx.arc(px + P.x * scale, py + P.y * scale, P.r * Math.max(.6, scale * .9), 0, 6.283);
              ctx.fill();
            }
          }
        }
      }
    }
    draw();
    var t;
    try {
      global.addEventListener('resize', function () {
        clearTimeout(t); t = setTimeout(draw, 160);
      }, { passive: true });
      global.addEventListener('ow:hue', function () { draw(); });
    } catch (e) {}
    return draw;
  };

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

    /* THE SAFE FLOOR GETS THE FIELD AND NOTHING THAT TICKS. .ow-sky already
       carries a hue-tinted static network in CSS, so a phone is not left with a
       flat black page — it simply does not get the motion. */
    var RM = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var safe = root.getAttribute('data-fx') === 'safe';
    if (safe || RM || opts.still) return;

    var c = doc.createElement('canvas');
    c.className = 'ow-net'; c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    var ctx = c.getContext('2d');
    var DPR = Math.min(global.devicePixelRatio || 1, 2);
    var pts = [], raf = 0;

    function size() {
      c.width = innerWidth * DPR; c.height = innerHeight * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pts = skyPoints(innerWidth, innerHeight);
    }
    /* the line colour is READ FROM THE LIVE HUE each frame batch, so walking
       into a Center re-colours the network with everything else — one truth,
       not a copy of the hue kept here */
    function hueRGB() {
      return (getComputedStyle(root).getPropertyValue('--ow-h1').trim() || '124,45,255');
    }
    var _t = 0;
    function frame() {
      var w = innerWidth, h = innerHeight, i, j, rgb = hueRGB();
      _t++;
      ctx.clearRect(0, 0, w, h);
      for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        /* A LINE BELONGS TO THE PAIR, not to the field: reach is the nearer
           point's, and depth fades it — so a far knot whispers and a near one
           is legible, which is what gives the field its sense of space. */
        for (j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          var reach = p.link < q.link ? q.link : p.link;
          if (d < reach) {
            var depth = (p.z + q.z) * .5;
            ctx.strokeStyle = 'rgba(' + rgb + ','
              + ((1 - d / reach) * .30 * depth).toFixed(3) + ')';
            ctx.lineWidth = depth > .8 ? 1.1 : .7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }

        /* magnitude + a slow, out-of-phase drift in brightness */
        var tw = .78 + Math.sin(p.tw + _t * p.tws * 60) * .22;
        ctx.fillStyle = 'rgba(' + rgb + ',' + (p.z * .55 * tw).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    size(); frame();
    var t; global.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(size, 140);
    }, { passive: true });
    /* parked with the tab — canon §4 */
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(frame);
    });
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
    unreachable:    { who:'unreachable', title:"Couldn't reach ONEWAY",
                      detail:'Nothing answered.', do:'retry' },
    blocked:        { who:'network', title:'Something is blocking ONEWAY',
                      detail:'Requests are being dropped rather than refused — usually '
                           + 'a firewall, VPN or guest network.', do:'retry' },
    cors:           { who:'oneway', title:'ONEWAY is refusing this browser',
                      detail:'The service is up but will not accept requests from this '
                           + 'page. A configuration fault on our side.', do:null },
    timeout:        { who:'network', title:'That took too long',
                      detail:'ONEWAY did not answer in time. It may still be working.',
                      do:'retry' },

    /* ── ours, and named as ours ──────────────────────────────────────── */
    server_error:   { who:'oneway', title:'ONEWAY hit an error',
                      detail:'The service answered and reported a fault. Ours, not yours.',
                      do:'retry' },
    bad_gateway:    { who:'oneway', title:'ONEWAY is between restarts',
                      detail:'A part of the service is not answering yet.', do:'retry' },
    unavailable:    { who:'oneway', title:'ONEWAY is down for a moment',
                      detail:'The service is deliberately not accepting work right now.',
                      do:'retry' },
    gateway_timeout:{ who:'oneway', title:'ONEWAY took too long on its own side',
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
    catch (_) { where = api || 'ONEWAY'; }

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
          if (read.v === 'unwell') return { who: 'oneway', title: 'ONEWAY hit an error',
            detail: 'The service answered and reported a fault. Ours, not yours.', retry: true };
          if (read.v === 'ok') return { who: 'request', title: "That request didn't go through",
            detail: 'Both ends are fine. Try it again.', retry: true };
          return { who: 'oneway', title: 'ONEWAY is refusing this browser',
            detail: 'The service is up at ' + where + ' but will not accept requests '
                  + 'from this page. A configuration fault on our side.', retry: false };
        });
      }
      if (reach.v === 'timeout') return { who: 'network', title: 'Something is blocking ONEWAY',
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
      return { who: 'unreachable', title: "Couldn't reach ONEWAY",
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
    var KEEP = /(^|\s)(ow-sky|ow-net|ow-worldwash|ow-crossing)(\s|$)/;
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
                       label: opts.label || (opts.working ? 'One moment' : 'ONEWAY') });
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

       ONE RULE, NO CONDITION: the tally is always drawn. A zero is a fact
       about a Post and stating it plainly is not a judgement — withholding
       it was what made the feed look arbitrary.

       THE ONE ABSENCE THAT REMAINS is `counts_hidden` — the author or the
       viewer has HIDDEN the numbers (founder, 2026-09-06: *"UNLESS USER HAS
       CHOSEN TO HIDE ON EITHER SIDE"*). That is a different thing from zero
       and it removes every tally on the card, which is why it is decided
       once, here, rather than per act. */
    function tally(n) {
      if (hideCounts) return '';
      return '<b>' + esc(String(n == null ? 0 : n)) + '</b>';
    }
    function act(verb, icon, label, on, count) {
      return '<button type="button" class="po-act po-act--icon"'
        + ' data-po-respond="' + esc(verb) + '" data-obj="' + esc(g.id) + '"'
        + ' data-okind="' + esc(okind) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(label) + '"'
        + ' data-act="' + (on ? 'on' : 'off') + '">'
        + OW.glyph(icon)
        + tally(count) + '</button>';
    }
    var html = offers.map(function (verb) {
      var icon = ({ like: 'heart', dislike: 'thumbdown' })[verb] || 'spark';
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
    if (you.mine) {
      html += '<span class="po-act po-act--icon po-act--stat" aria-label="'
        + esc(reposts === 1 ? '1 repost' : (reposts || 0) + ' reposts') + '">'
        + OW.glyph('repost') + tally(reposts) + '</span>';
    } else {
      html += '<button type="button" class="po-act po-act--icon" data-po-repost'
        + ' data-obj="' + esc(g.id) + '" data-okind="' + esc(okind) + '"'
        + ' aria-pressed="' + (reposted ? 'true' : 'false') + '"'
        + ' aria-label="Repost"'
        + ' data-act="' + (reposted ? 'on' : 'off') + '">'
        + OW.glyph('repost')
        + tally(reposts) + '</button>';
    }

    var saves = hideCounts ? 0 : ((counts.save != null) ? counts.save : (g.saves || 0));
    html += '<button type="button" class="po-act po-act--icon" data-po-save'
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
    /* THE MARK THE LIVE PATH READS. Every optimistic press in popit-live.js
       creates a `<b>` when the server answers with a tally — so without this a
       card that correctly rendered no numbers would grow one the moment its
       viewer pressed anything, and hiding would last exactly until the first
       tap. The flag lives on the acts container because that is the node every
       one of those handlers can already reach with `closest`. */
    if (hideCounts) slot.setAttribute('data-counts-hidden', '1');
    else slot.removeAttribute('data-counts-hidden');
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

    var ms = opts.ms || 340;
    plate.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.8,.2,1),'
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

  OW.glyph = function (name) { return svg(name); };

  function svg(name) {
    var d = ICONS[name]; if (!d) return '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

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
      var src = OW.imageUrl ? OW.imageUrl(data.face.image) : (data.face.image || '');
      if (src) fc.innerHTML = '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">';
      /* a person with no picture gets the outline (founder/495); anything
         else — a Center, a place, a thing — keeps its monogram */
      else if (String((data.face && data.face.kind) || '') === 'person' && OW.faceMark) {
        fc.innerHTML = OW.faceMark();
      }
      else fc.appendChild(el('i', '', esc(OW.initials ? OW.initials(data.face.name || data.label) : String(data.label || '').slice(0, 2).toUpperCase())));
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
  /* A POST IS BOTH THE PERSON AND THE PLACE (founder, 2026-08-15).
     Cards took the actor's hue alone, so a feed drawn from five different
     Centers read as one world — the place a thing was said contributed nothing
     to how it looked. This blends the two angles on the colour wheel, by the
     SHORT way round, so violet + teal lands between them rather than travelling
     through the grey on the far side. Weighted toward the place (.55), because
     what a feed most needs to tell you at a glance is WHERE you are. */
  function blendHues(actorHue, placeHue) {
    var a = hue.angleOf(actorHue) != null ? hue.angleOf(actorHue) : hue.fromHex
      ? (function () { var t = hue.fromHex(actorHue); return t ? hue.angleOf(t) : null; })()
      : null;
    if (a == null && typeof actorHue === 'number') a = actorHue;
    var b = (typeof placeHue === 'number') ? placeHue
          : (placeHue ? (function () { var t = hue.fromHex(placeHue); return t ? hue.angleOf(t) : null; })() : null);
    if (a == null) return (b == null) ? null : hue.fromAngle(b);
    if (b == null) return hue.fromAngle(a);
    var d = ((b - a + 540) % 360) - 180;          /* the short way round */
    return hue.fromAngle((a + d * 0.55 + 360) % 360);
  }

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
      title: p.title || '',
      description: p.body || '',
      cover: (m && (m.url || m.src || m)) || '',
      _hue: p.destination_hue != null ? p.destination_hue : null,
      _post: true,
      /* THE ROOM, ONLY WHEN THE ROOM IS NOT THE AUTHOR. A post to a person's
         own Center carries `destination === center_id`, and the card rendered
         "Walk Tester · 1m ago · in Walk Tester" — the same person named as the
         writer and as the place. Where a post lives earns its line when it is
         a community; said of yourself it is noise. */
      _place: (p.destination_name
               && String(p.destination || '') !== String(p.center_id || ''))
        ? p.destination_name : '',
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
      state: p.state || '',
      publish_at: p.publish_at || '',
      edited_at: p.edited_at || '',
      edit_count: p.edit_count || 0
    };
  }

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
    /* THE NAME, NOT THE EMAIL'S LEFT HALF. This read `String(e).split('@')[0]`
       — the comment two lines up says "a name is worth more than a count" and
       then it printed `pal327375` about the person the notification beside it
       called "Sam Vale". One human being, two identities, on one screen.

       `known_likers.people` now carries `{email, name}` and the name is
       resolved server-side once per person per page. A plain string is still
       accepted, because a client that only works against the newest payload
       breaks the moment a cached response is a version behind — and the
       fallback is the same local part it always showed, so an old payload is
       no worse than it was. */
    var who = (k.people || []).map(function (e) {
      if (e && typeof e === 'object') {
        return String(e.name || '').trim() ||
               String(e.email || '').split('@')[0];
      }
      return String(e).split('@')[0];
    }).filter(Boolean);
    var more = Math.max(0, (k.n || who.length) - who.length);
    if (!who.length) return '';
    if (who.length === 1 && !more) {
      return k.capped ? ('Liked by ' + who[0] + ' and others')
                      : ('Liked by ' + who[0]);
    }
    /* THE COMMENT ABOVE PROMISED THIS AND THE CODE DID NOT KEEP IT. The
       capped branch read `(k.capped ? ' you know' : ' you know')` — the same
       string on both sides — so a list the server had cut at eight was
       reported as "and 7 others", an exact figure for a count nobody had. B's
       audit found it. When the sample is full, the number is not known and
       is not said. */
    if (k.capped) return 'Liked by ' + who[0] + ' and others you know';
    if (who.length === 1) return 'Liked by ' + who[0] + ' and ' + more + ' more';
    var head = who[0] + ' and ' + (who.length - 1 + more);
    return 'Liked by ' + head + ' ' + ((who.length - 1 + more) === 1 ? 'other' : 'others')
           + ' you know';
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
    /* A POST WEARS BOTH: the person who said it and the place it was said.
       A gallery or a person keeps their own hue alone — only a post has two
       owners. Blend, never replace: whose thing it is must still be visible. */
    var ah = parseTriplet(who.hue);
    var blended = (g._post && g._hue != null) ? blendHues(who.hue, g._hue) : null;
    var bh = blended ? parseTriplet('rgb(' + blended[0] + ')') || blended : null;
    var pair = blended || (ah ? [ah.join(','), ah.join(',')] : null);
    var avHue = pair ? ('--ch1:' + pair[0] + ';--ch2:' + (pair[1] || pair[0])) : '';

    /* THE WHOLE CARD WEARS IT, not just the avatar.
       The blend was reaching `po-card__av` only, so the little circle changed
       colour and the post it belonged to did not — which is not what "a post is
       a blend of the person and the place" means. The card carries the pair too
       now, so its ground, its edge and its glow all come from the same two
       owners. The avatar keeps its own copy: it is the PERSON in a card that is
       person-and-place, and it must stay legible when the two are close. */
    if (pair) {
      n.style.setProperty('--ch1', pair[0]);
      n.style.setProperty('--ch2', pair[1] || pair[0]);
      /* AND THE CARD'S OWN FACE, which is the part that was making a feed of
         many people look like one thing.
         `.po-card__face` draws its wash, its rim and its glow from `--h`/`--h2`
         — and those default to `--ow-h1`, THE READER'S hue. So every card in
         the feed was the colour of whoever was looking at it, and the blend I
         had set on `--ch1` was a variable the face never reads. Setting the
         pair here is what turns the feed into an array of the people and places
         in it rather than a stack of identical panels. */
      n.style.setProperty('--h', pair[0]);
      n.style.setProperty('--h2', pair[1] || pair[0]);
      if (g._post) n.setAttribute('data-blended', '1');
    }

    var media = (g.media_count || 0), posts = (g.post_count || 0);
    var counted = [];
    if (g._highlight) {
      /* the Center's name is already the face; saying it twice is noise, and
         a members figure is only said when there is one */
      if (g.title && who.name && g.title.trim() === String(who.name).trim()) g.title = '';
      if (g._members) counted.push(g._members + (g._members === 1 ? ' member' : ' members'));
      if (g._center) {
        n.setAttribute('data-po-center', g._center);
        n.setAttribute('data-po-kind', 'highlight');
        n.setAttribute('aria-label', 'Open ' + (who.name || 'this Center'));
      }
    } else if (g._post) {
      /* WHERE IT WAS LIT, in the slot the counts use. A post's place is the
         point of it — "in Food & Dining" is what makes it a post to a Center
         rather than a note to nobody. Absent when the runtime cannot name the
         place, never an id. */
      if (g._place) counted.push('in ' + g._place);
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
      coverAR = ' style="--po-ar:' + r.toFixed(4) + '"';
    }());
    /* A VIDEO COVER IS NOT AN IMAGE, AND RENDERING IT AS ONE PAINTED THE BLACK
       BOX. The first media item becomes the Gallery's cover, the runtime
       accepts MP4/MOV/WebM (`_sniff_media`), so the first thing anyone films
       arrives here as `cover: "….mp4"` — loaded into an <img>, which fails,
       fires `onerror="this.remove()"`, and leaves the bare cover ground: a
       4:3 near-black slab where the person's video should be. Video only ever
       played in IMMERSIVE mode, where `OW.media` pools real players; the
       standard feed had no video path at all.
       Poster-less by design — the runtime stores no thumbnail, and inventing
       one would be inventing content (Law 15). `preload="metadata"` is enough
       for the browser to paint the first frame. */
    var isVid = /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(coverSrc || '');

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
               + ' tabindex="-1" aria-hidden="true" onerror="this.remove()"></video>'
             : '<img src="' + esc(u) + '" alt="' + esc(it.alt || '')
               + '" loading="lazy" decoding="async" onerror="this.remove()">')
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
      : !coverSrc ? ''
      : isVid
        /* SAME FALLBACK THE IMAGE PATH HAS. A dead reference, an expired signed
           URL or a codec this browser will not decode leaves an empty player
           sitting on the cover ground — which is the black rectangle again, by
           a slower route. Removing it lets the hue treatment underneath be the
           cover, exactly as a broken <img> already does. */
        ? '<video src="' + esc(coverSrc) + '" muted playsinline preload="metadata"'
          + ' tabindex="-1" aria-hidden="true" onerror="this.remove()"></video>'
        : '<img src="' + esc(coverSrc) + '" alt="" loading="lazy" decoding="async"'
          + ' onerror="this.remove()">';
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
    var bodyHTML =
      '<span class="po-card__body">' +
        (g._post
          ? (g.title ? '<span class="po-card__t">' + esc(g.title) + '</span>' : '')
          : '<span class="po-card__t">' + esc(g.title || 'Untitled') + '</span>') +
        (g.description ? '<span class="po-card__d">' + esc(g.description) + '</span>' : '') +
      '</span>';
    /* a reel: the cover is a video, or the first piece of a strip is */
    var capAbove = !!(cover && (isVid || (shots && shots[0] &&
      ((shots[0].kind === 'video') || /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(String(shots[0].url || shots[0].src || ''))))));
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
       the globe leads and the platforms it also came from follow it; *"put
       the icons in a small … triangle like formation when multiple"* — the
       CSS lays 2+ out as a cluster (`data-many`), the globe at the apex; and
       *"always keep the icons small on the post"* — 18px alone, 15px in the
       cluster. 476: the globe is drawn white, in the page's ink, like every
       mark beside it. */
    var marks = ['oneway'].concat(fromKeys).slice(0, 4);   /* the globe and up to three platforms — the base of the triangle */
    var fromHTML = '<span class="po-card__from"' + (marks.length > 1 ? ' data-many="' + marks.length + '"' : '') + '>' +
      marks.map(function (k) {
        /* the platform's colour rides on the mark so ONE stylesheet rule
           colours every platform in colour mode (founder/496) */
        var mkHue = (OW.links && OW.links.hueOf) ? OW.links.hueOf(k) : '';
        return '<i class="po-card__from__i" data-platform="' + esc(k) + '"'
          + (mkHue ? ' style="--mk:' + esc(mkHue) + '"' : '')
          + ' aria-label="' + esc(k === 'oneway' ? 'ONEWAY' : k) + '">'
          + (OW.links && OW.links.icon ? OW.links.icon(k) : '') + '</i>';
      }).join('') +
      '</span>';
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
        /* THE NOTE RIDES WITH THE FACE (founder, 2026-08-17). It is emitted
           before the avatar in source order so it can be positioned above it
           without the row having to reserve height for a note nobody set — a
           person with no note costs this row exactly nothing, which is the
           only way "everywhere" is affordable on a scrolling surface. */
        OW.noteHTML(who.note, 'sm') +
        '<span class="po-card__av" data-kind="' + esc(/^(user|profile|)$/.test(String(who.kind || '')) ? 'person' : who.kind) + '"' +
          /* the author's own cut, when they chose one (founder/409) */
          (/^(round|rounded|square)$/.test(String(who.shape || '')) ? ' data-shape="' + esc(who.shape) + '"' : '') +
          (avHue ? ' style="' + avHue + '"' : '') +
          ' data-ini="' + esc(OW.initials(who.name)) + '">' +
          /* ★ FOUNDER/495: a person with no picture is an OUTLINE OF A
             PERSON, not their initials. A Center keeps a monogram — it is an
             organisation and "FC" is a mark somebody could actually have —
             but a person is a person. One drawing, `OW.faceMark`. */
          (OW.imageUrl(who.image)
             ? '<img src="' + esc(OW.imageUrl(who.image)) + '" alt="" onerror="OW.faceFail(this)">'
             /* the feed names a person's kind `user` (and older reads
                `profile`); all three are a person — only a Center or a
                community keeps its monogram (2026-09-26 sweep: every person
                on Home drew initials because the check read only `person`) */
             : (/^(person|user|profile|)$/.test(String(who.kind || 'person'))
                 ? (OW.faceMark ? OW.faceMark() : '')
                 : '<i>' + esc(OW.initials(who.name)) + '</i>')) +
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
        '<span class="po-card__when">' + esc(OW.when(item.at)) +
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
      '<span class="po-card__media"><span class="po-card__cover"' + emptyNote + coverAR + '>' + cover + '</span></span>') +
      (capAbove ? '' : bodyHTML) +
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
      (g._known && g._known.people && g._known.people.length
        ? '<button type="button" class="po-card__known" data-po-likers'
          + ' data-obj="' + esc(g.id) + '"'
          + ' aria-label="' + esc(knownWords(g._known)) + '. Open the list.">'
          + OW.glyph('heart')
          + '<span>' + esc(knownWords(g._known)) + '</span></button>'
        : '') +
      '<span class="po-card__foot">' +
        '<span class="po-acts" data-po-responses></span>' +
        (counted.length ? '<span class="po-card__count">' + esc(counted.join(' · ')) + '</span>' : '') +
      '</span>';

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
        var w = im ? im.naturalWidth : vd.videoWidth;
        var h = im ? im.naturalHeight : vd.videoHeight;
        if (!w || !h) return;
        var r = Math.max(RATIO_MIN, Math.min(RATIO_MAX, w / h));
        box.style.aspectRatio = r.toFixed(4);
      };
      if (!im) {
        if (vd.videoWidth) shape();
        else vd.addEventListener('loadedmetadata', shape, { once: true });
        return;
      }
      /* ── AND THE FAILURE PATH, WHICH WAS NEVER WIRED ────────────────────
         ★ FOUNDER, 2026-08-31 (founder/358): failed loading must be PROVEN,
           and *"a video failure must never become a feed failure."*

         `judge()` only ever ran on `load`. A broken or missing file fires
         `error`, so nothing collapsed the frame — measured with a deliberately
         truncated JPEG and a 404: the card kept a **414px EMPTY `.po-card__
         cover`**, a photo-shaped hole with nothing in it. That is the "black
         box" the founder named on 2026-08-16, arrived at from the other
         direction: not an empty Gallery published by accident, but a real Post
         whose picture did not come back.

         The `[data-empty]` treatment already exists and is already right — it
         collapses `aspect-ratio` to auto and prints one quiet line. It simply
         was not reachable from a failure. Now it is, and it says something
         DIFFERENT from the never-had-a-picture case, because those are
         different facts and a person can act on one of them. */
      var failed = function () {
        try { im.remove(); } catch (_) {}
        if (!box.hasAttribute('data-empty')) {
          box.setAttribute('data-empty', 'this picture could not be loaded');
        }
      };
      if (im.complete && !im.naturalWidth) failed();
      else if (im.complete) { judge(); shape(); }
      else {
        im.addEventListener('load', function () { judge(); shape(); }, { once: true });
        im.addEventListener('error', failed, { once: true });
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
    return n;
  };

  /* An identity with no picture still has a name. Initials differentiate people
     honestly where the runtime cannot yet: every new account is issued the same
     default hue, so avatars were otherwise identical. A hash-derived colour
     would be inventing identity (Law 15); a person's own initial is not. */
  OW.initials = function (name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
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
    return '<svg class="ow-facemark" viewBox="0 0 24 24" fill="none"'
      + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"'
      + ' aria-hidden="true">'
      + '<circle cx="12" cy="8.4" r="3.6"/>'
      + '<path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0"/>'
      + '</svg>';
  };

  /* A FACE THAT DOES NOT LOAD IS THE FACE THAT HAS NONE (2026-10-09). Measured at 390 on Home: a
     demo avatar that answers 404 drew the browser's broken-image glyph on every one of that person's
     posts. An `<img>` in a face box calls this on error: a person becomes their outline, a Center or
     a community its monogram (`data-ini` on the box), exactly what a face with no picture draws. */
  OW.faceFail = function (img) {
    var box = img && img.parentNode;
    if (!box) return;
    var kind = String(box.getAttribute('data-kind') || 'person');
    if (/^(person|user|profile)$/.test(kind) && OW.faceMark) { box.innerHTML = OW.faceMark(); return; }
    var i = doc.createElement('i');
    i.textContent = box.getAttribute('data-ini') || '';
    box.innerHTML = '';
    box.appendChild(i);
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
    wrap.insertBefore(n, avatarEl);
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
  OW.mountRiver = function (host, items, opts) {
    if (!host) return 0;
    host.classList.add('po-river');
    var frag = doc.createDocumentFragment(), n = 0;
    (items || []).forEach(function (it) {
      frag.appendChild(OW.card(OW.riverRow(it), opts)); n++;
    });
    host.appendChild(frag);
    return n;
  };

  /* ═══ 6 · THE SHEET — depth 2, "Enter" ═════════════════════════════════ */
  var scrim, stage, sheet, outHint, beam, originEl = null, lockY = 0, locked = false;
  var outTimer = 0, hintTimer = 0, worldTweened = false, lastFocus = null;
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
    outHint = el('div', 'po-out', 'tap away &middot; esc');
    beam = el('div', 'po-beam');
    beam.setAttribute('aria-hidden', 'true');
    stage.appendChild(sheet);
    doc.body.appendChild(scrim); doc.body.appendChild(beam);
    doc.body.appendChild(stage); doc.body.appendChild(outHint);
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
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { outHint.classList.add('is-on'); }, 2600);
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
      ? '<img src="' + esc(d.image.url) + '" alt="" loading="lazy" decoding="async">' +
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

  OW.open = function (data, origin) {
    ensure();
    data = data || {};
    openData = data;
    openSeq++;
    clearTimeout(outTimer); clearTimeout(hintTimer);
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
      ], { duration: RM ? 1 : 540, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' });
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
    clearTimeout(outTimer); clearTimeout(hintTimer);
    outHint.classList.remove('is-on');
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
    var a = sheet.animate([
      { transform: restTransform(), opacity: 1, offset: 0 },
      { opacity: 1, offset: .72 },
      { transform: 'translate(' + (o.tx + restAt.x) + 'px,' + (o.ty + restAt.y) + 'px) scale('
                   + o.sx + ',' + o.sy + ') rotate(0deg)', opacity: 0, offset: 1 }
    ], { duration: RM ? 1 : 360, easing: 'cubic-bezier(.5,0,.65,1)', fill: 'forwards' });

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
                       + ' onerror="this.remove()">' : '')
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
            + ' loading="lazy" decoding="async" onerror="this.remove()"></div>';
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
            + ' loading="lazy" decoding="async" onerror="this.remove()"></div>';
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

  global.OW = OW;
})(window);
