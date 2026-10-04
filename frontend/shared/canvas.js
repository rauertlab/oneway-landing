/* ONEWAY — THE CANVAS.  What you put on your own surface, and how you move it.

   ★ FOUNDER, PRODUCT_RESET §19: Popits *"should not remain shallow decorative
     widgets … A Popit might open into something as substantial as a game
     comparable to Crossy Road. The closed state maintains the ONEWAY
     holographic/floating visual language. The opened state can be radically
     different. Do not architect the runtime so every Popit must look or behave
     like a card."*

   THE SENTENCE THAT DECIDED THIS FILE'S SHAPE is the last one, because the
   runtime it sits beside already breaks it. `OW.widget(data)` requires
   `WIDGET[data.kind]` — a CLOSED registry — and emits a fixed
   `.po po-w po--{size}` tile. `OW.open(data)` renders `renderSheet(data)`. So a
   Popit today is structurally a card that opens into a sheet, and a game cannot
   exist in that model.

   SO THE CLOSED STATE AND THE OPEN STATE ARE SEPARATED HERE:

       CLOSED   this file's business. A placement has a size on a grid and the
                holographic treatment. Uniform on purpose — a wall of things
                that each chose their own resting appearance is a mess.
       OPEN     NOT this file's business, and deliberately not one code path.
                A catalogued Popit opens through `OW.open` because that is what
                it is. An APP opens into a sandboxed frame at whatever size it
                asks for, with no ONEWAY chrome inside it. That is how a Popit
                becomes a game rather than a bigger card.

   THE SAVE IS THE WHOLE ARRANGEMENT, ONCE, AT THE END OF A DRAG.
   Dragging produces an arrangement, not a stream of moves. Sending moves would
   be a toggle-shaped operation that cannot be replayed — the founder's law of
   2026-08-23 — and would also put a request behind every pointer event. */

(function (global) {
  'use strict';

  var OW = global.OW = global.OW || {};

  /* ── A HARD DEPENDENCY, FAILING AT LOAD RATHER THAN AT RENDER ──────────
     ow-time.js carries the temporal contract and must load before this file
     (oneway-app.html orders them). A missing shared rule is not something to
     paper over with a local fallback — a fallback here would be the second
     copy the contract exists to prevent, and it would be the copy nobody
     notices is running. */
  /* ── A HARD DEPENDENCY THAT FAILS LOUDLY AND LOCALLY ───────────────────
     ow-time.js carries the temporal contract and must load before this file. A
     missing shared rule is not something to paper over with a local fallback —
     a fallback here would be the second copy the contract exists to prevent,
     and it would be the copy nobody notices is running.

     BUT THIS THREW AT MODULE LOAD, AND THAT WAS WRONG. I added the script tag
     to oneway-app.html and to nothing else, so dashboard.html and
     tools/popit-shapes.html — which also load canvas.js — died on this line,
     taking down whatever came after it on those pages. It surfaced only as a
     stray key in localStorage:

       ow_brain_err_Error: Uncaught Error: canvas.js requires shared/ow-time.js

     A guard that converts a missing script tag into a blank page on a surface
     in somebody else's lane is not a guard, it is a landmine — and the harm
     lands on whoever loads this file next, not on whoever forgot the tag.

     So the requirement stands and the failure is contained: say so once, in
     the console, and refuse at MOUNT with a visible fault. The page survives,
     any surface that actually wanted a canvas says honestly that it could not
     draw one, and nothing silently renders a canvas with a second temporal
     rule behind it. */
  var TIME = OW.time;
  if (!TIME) {
    try {
      global.console && console.error(
        '[canvas] shared/ow-time.js must load BEFORE shared/canvas.js. ' +
        'Canvases on this page will refuse to render rather than run a ' +
        'second copy of the temporal contract.');
    } catch (eT) {}
  }
  var doc = global.document;

  /* ── ONE CANVAS, TWO SHELLS ──────────────────────────────────────────────
     ★ FOUNDER: *"Center -> Oneway OS: customizable Center canvas/surface …
       SAME Canvas primitive · SAME canonical state · NO second Center Canvas
       implementation."*

     The App and the OS are different shells with different request layers: the
     App has `OW.data.get/post`, the OS has `window.owApi(path, opts)`. That is a
     TRANSPORT difference, not a product one — the state, the authority and the
     arrangement are identical — so the canvas takes whichever is present rather
     than a second canvas being written for the second shell.

     `OW.data` WINS WHEN BOTH EXIST. It dedupes, caches briefly and routes
     queueable writes through the outbox; `owApi` is a plain fetch. Preferring
     the richer one means the App keeps offline placement and the OS gets the
     canvas, rather than both being levelled down to what they share. */
  function req(path, opts) {
    opts = opts || {};
    if (OW.data && OW.data.get && OW.data.post) {
      return opts.method && opts.method !== 'GET'
        ? OW.data.post(path, opts.body, opts)
        : OW.data.get(path, { fresh: !!opts.fresh });
    }
    if (typeof global.owApi === 'function') {
      var init = { method: opts.method || 'GET' };
      if (opts.body) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(opts.body);
      }
      return global.owApi(path, init).then(function (r) {
        if (!r) return { ok: false, status: 0, error: '' };
        return r.json().catch(function () { return null; }).then(function (j) {
          return r.ok ? { ok: true, status: r.status, data: j }
                      : { ok: false, status: r.status,
                          error: (j && (j.detail || j.error)) || ('HTTP ' + r.status) };
        });
      }).catch(function () { return { ok: false, status: 0, error: '' }; });
    }
    /* THE OS, WHICH PUBLISHES NEITHER — SO THE SHELL HANDS ONE IN.
       `OW.data` is the App's. `owApi` exists in the OS ONLY under `?demo=1`,
       where it is a stub answering every unknown path with `{ok:true}`; it is
       checked BEFORE this so demo mode stays demo, and it must never become the
       way production talks to the server.

       That left the OS with nothing, and this line used to return a dead
       `{ok:false, status:0}` — the Center canvas rendered empty, arranging
       appeared to save, and no request was ever made. Measured 2026-08-24.

       The fix is an ADAPTER THE SHELL INSTALLS (`OW.canvas.transport`), not a
       second request layer living in here: this file must not know what a
       session token is or where the OS keeps it. One canvas, one state, one
       authority — and whichever door the shell already uses. */
    if (typeof OW.canvas.transport === 'function') {
      return OW.canvas.transport(path, opts).then(function (r) {
        return r || { ok: false, status: 0, error: '' };
      }).catch(function () { return { ok: false, status: 0, error: '' }; });
    }
    /* NO SHELL AT ALL. Not silent: `load` draws its fault state from this and
       `save` now says so out loud, because a canvas that cannot reach anything
       must never look like a canvas that saved. */
    return Promise.resolve({ ok: false, status: 0, error: '' });
  }

  /* The kinds that answer to the hand. Mirrors FREEFORM_KINDS on the server;
     one rule, stated in both places rather than a client that disagrees. */
  var FREEFORM = ['sticker'];

  var COLS = 12;               /* replaced by whatever the server reports */
  var ROW = 44;                /* px per grid row; the one visual constant */
  var GAP = 10;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── STATE ──────────────────────────────────────────────────────────────
     One canvas per host element. Held here rather than on the DOM so a
     re-render cannot lose an in-flight drag. */
  /* EVERY MOUNTED CANVAS, so a late answer can reach the surfaces it changes.
     See `rememberCatalog` — the specs arrive after the first paint and they
     decide geometry, not just wording. */
  var _live = [];

  function Canvas(host, surface) {
    this.host = host;
    this.surface = surface;
    if (_live.indexOf(this) < 0) _live.push(this);
    /* A Center surface's catalog includes that Center's own Popit apps. */
    var m = /^center:(.+)$/.exec(surface || '');
    this.centerId = m ? m[1] : '';
    this.items = [];
    this.mayArrange = false;
    /* THREE STATES, NOT TWO — see `render`. `null` until the server answers,
       because "we have not asked yet" is a third thing again. */
    this.arranged = null;
    this.cols = COLS;
    this.saveTimer = null;
    this.dirty = false;
  }

  Canvas.prototype.load = function () {
    var self = this;
    /* SAY THAT WE ARE ASKING. Between mount and answer this host was blank,
       which on a slow read is indistinguishable from "this Center has nothing"
       — the same absent/empty confusion the render already guards, one step
       earlier. Drawn only when there is nothing on screen yet, so a REFRESH
       does not blank an arrangement the person is already looking at. */
    if (!this.grid) {
      this.host.innerHTML = '<div class="ow-cv-wait" role="status">Loading</div>';
      this.paintNote();
    }
    /* THE FIRST DRAW MAY TAKE AN ANSWER THE DATA LAYER ALREADY HOLDS — Home
       asks for its canvas alongside its own read (home.js), and every write
       to a canvas invalidates '/api/canvas/'. A REFRESH of a drawn canvas
       always asks again. */
    return req('/api/canvas/' + encodeURIComponent(this.surface), { fresh: !!this.grid })
      .then(function (r) {
        if (!r || !r.ok) {
          /* A CANVAS THAT COULD NOT BE READ IS NOT AN EMPTY CANVAS. Rendering
             nothing would tell a person their arrangement is gone. */
          self.host.innerHTML = '<div class="ow-cv-fault">This canvas could not ' +
            'be loaded. It has not been changed.</div>';
          self.paintNote();
          return null;
        }
        self.items = (r.data.placements || []).slice();
        self.mayArrange = !!r.data.may_arrange;
        self.arranged = !!r.data.arranged;
        self.cols = (r.data.grid && r.data.grid.cols) || COLS;
        self.render();
        return r.data;
      })
      /* ── A PROMISE THAT REJECTS LEAVES "Loading" ON SCREEN FOREVER ──────
         The branch above answers `!r.ok`, which covers a refusal the transport
         understood. It does not cover the transport THROWING — a dropped
         connection, a 200 whose body will not parse, a CORS refusal. In those
         cases `.then` never runs, and the word Loading sits on the surface for
         the rest of the session, saying something that stopped being true
         immediately.

         A surface that cannot load must say so. Same fault, same words as the
         refusal path, because to the person looking at it they are the same
         event. */
      .catch(function (e) {
        try {
          self.host.innerHTML = '<div class="ow-cv-fault">This canvas could not ' +
            'be loaded. Nothing has been changed.</div>';
          global.console && console.warn('[canvas] load failed for ' +
            self.surface + ':', e && e.message);
        } catch (e2) {}
      });
  };

  /* ── RENDER ─────────────────────────────────────────────────────────────
     Absolute placement on a percentage grid, so one arrangement is the same
     arrangement on a phone and on a desktop. Columns collapse on a narrow
     screen through CSS alone (see the stylesheet) — the SAVED geometry never
     changes because of the screen it was looked at on. */
  /* WARM THE NAMES ONCE. An unbound Popit needs the catalog to say its real
     name, and without this it only ever had it after somebody opened the
     picker — so a fresh Home showed identifiers until you happened to press
     Add. One read, shared by every tile on the surface. */
  var _catalogAsked = false;
  function warmCatalog() {
    if (_catalogAsked) return;
    _catalogAsked = true;
    try {
      req('/api/canvas/catalog').then(function (r) {
        if (r && r.ok && r.data && r.data.catalog) rememberCatalog(r.data.catalog);
      }).catch(function () {});
    } catch (e) {}
  }

  /* ═══ THE ARRANGEMENT TRANSLATES; IT IS NOT REBUILT ══════════════════════
     ★ FOUNDER, 2026-08-30: *"the layouts users arrange need to automatically
       adjust to all platform… make sure they translate layouts cross platform
       and orientation nicely."*

     ONE NUMBER DOES ALL OF IT. `x` and `w` are already fractions of the column
     count, so horizontal placement is a percentage and translates to any width
     for nothing. The only pixel in the whole grid is the ROW HEIGHT, and a row
     that stays 44px while a column shrinks from 92px to 32px is precisely what
     turns a neat square Popit into a tall slab. So the row scales WITH the
     column and the shapes survive the trip.

     THE RATIO IS TAKEN FROM THE DESIGN, NOT INVENTED: 44px rows against ~92px
     columns is what every Popit in this product was drawn at, so `ROW_RATIO`
     is that relationship and nothing else. Reproduce the desktop proportion at
     any width and a 3x2 Clock is a 3x2 Clock everywhere.

     BUT IT IS CLAMPED, BECAUSE TYPE HAS A FLOOR. Scaled purely, a phone row
     would be ~15px and a two-row Popit 30px tall — geometrically faithful and
     unreadable. The floor is what makes the small end an iOS SMALL WIDGET
     rather than a sliver, and the ceiling stops a wide desktop from inflating
     everything into billboards. Between those it is pure proportion.

     THE FACES WERE ALREADY READY FOR THIS. Every Popit face sizes its type in
     `cqw` — container-query units against its own tile — so text scales with
     the widget instead of against it. That work is what makes scaling the row
     safe rather than a new set of breakpoints to keep in step. */
  /* ── THE CELL IS SQUARE, AND THE PLANE IS CAPPED ──────────────────────
     ★ FOUNDER, 2026-09-12: *"the widgets the design of the post ones are they
       just dont have perfect perportions but coloring and shining is good."*

     THE ROW WAS CLAMPED WHILE THE COLUMN WAS FREE, so a footprint had no
     shape of its own — it had whatever shape the viewport left it. Measured on
     one real Centre canvas, the SAME 6x4 placement:

         320px   144 x 150   0.96 : 1        768px   368 x 150   2.45 : 1
         375px   172 x 150   1.14 : 1        900px   434 x 154   2.82 : 1
         430px   199 x 150   1.33 : 1       1440px   704 x 238   2.96 : 1

     A three-fold swing. One Popit is a square on a phone and a letterbox on a
     desktop, and no amount of type or inset work can make that read as a
     family. The comment on `viewCols` already claimed the opposite — "the row
     height already scales with the column (ROW_RATIO), so a tile keeps its
     aspect as well as its proportion" — and it was true only INSIDE the clamp
     band, which a phone is nowhere near: at 320px the ratio wants a 8.4px row
     and the floor lifts it to 30, a 3.6x distortion on one axis only.

     SO THE CELL IS SQUARE. `row + gap` is set equal to the column pitch, which
     makes an NxN footprint exactly square and an Nx2N exactly 2:1 at every
     width there is. The aspect of a placement is now a property of the
     placement, the way `systemSmall` is a shape rather than a measurement.

     AND THE SIZE IS CAPPED BY CAPPING THE PLANE, NOT THE ROW. ROW_MAX existed
     because "above this, a wide desktop makes billboards", and that is a real
     concern — but clamping one axis is how the shape was lost. The plane has a
     max width instead, so on a wide desktop the whole arrangement stops
     growing and stays centred, and every tile inside it keeps its exact
     proportion. ROW_MIN goes the same way and costs nothing: measured at
     320px, the old floor gave a 150px-tall `large` and a square cell gives
     150px — the phone, which is the surface this is judged on, barely moves.
     What moves is the desktop, which is where the distortion was. */
  var PLANE_MAX = 880;          /* px — the widest the arrangement is drawn */

  /* ── THE FAMILY, SO A RESIZE LANDS ON ONE ──────────────────────────────
     ★ FOUNDER, 2026-09-13: *"MAKE SURE RESIZE WORKS UNIVERSALLY"*

     A drag used to snap to GRID LINES and could finish on any span at all —
     6x8, 5x3, whatever the hand stopped at. The server then snapped it to a
     footprint on save, so the tile JUMPED after release: the person placed one
     shape and a different one appeared. A closed family that is only enforced
     on the server is a family nobody can see while they are choosing.

     So the drag snaps to the family LIVE. The person drags between four
     shapes, the same way a home screen resizes between its widget sizes, and
     what they let go of is what they get.

     THE SERVER IS STILL THE ARBITER. `canvas.py` snaps on write and on read,
     and if these two ever disagree the server wins and the tile corrects on
     the next read — this list is a PREVIEW of that decision, not a second
     authority. It is spelled out here because the canvas payload does not
     carry the set today; when it does, this reads it instead. */
  var FOOTPRINTS = [[3, 3], [6, 3], [6, 6], [12, 6]];

  /* Nearest by area, then by shape, ties to the smaller — the same order
     `snap_footprint` applies, so the preview and the save agree. */
  function snapFootprint(w, h) {
    w = Math.max(1, Math.round(w || 3));
    h = Math.max(1, Math.round(h || 2));
    var want = w * h, best = null, i, fw, fh, d;
    for (i = 0; i < FOOTPRINTS.length; i++) {
      fw = FOOTPRINTS[i][0]; fh = FOOTPRINTS[i][1];
      d = [Math.abs(fw * fh - want), Math.abs((fw / fh) - (w / h)), fw * fh];
      if (!best || d[0] < best[0][0] ||
          (d[0] === best[0][0] && (d[1] < best[0][1] ||
           (d[1] === best[0][1] && d[2] < best[0][2])))) {
        best = [d, fw, fh];
      }
    }
    return [best[1], best[2]];
  }


  /* ═══ THE ARRANGEMENT IS STORED IN TWELVE COLUMNS AND PROJECTED ══════════
     ★ FOUNDER, 2026-08-30: *"make sure they translate layouts cross platform
       and orientation nicely"* · *"they cannot appear broken when resized or
       stretched."*

     TWELVE COLUMNS ON A PHONE IS THE WHOLE PROBLEM. At 360px a column is 20px
     wide, so a 1x1 Popit is a 20px box — and a 768-combination sweep across
     three device widths found 63 breakages, every one of them at 360px and
     none at 1100px. No component can be designed to survive 20px, and none
     should have to: the tile is simply too small to be a widget.

     SO THE GRID CHANGES AND THE ARRANGEMENT DOES NOT. Twelve columns is the
     CANONICAL space — it is what is stored, what the server validates, and what
     every device agrees on. What each device renders is a projection of that
     space onto a column count its screen can actually hold, which is exactly
     what a phone home screen does: the same widgets, fewer columns, same
     relative places.

         stored   x=6 w=3  of 12      "starts halfway, a quarter wide"
         phone    x=2 w=1  of  4      the same sentence, in four columns

     RELATIVE POSITION AND RELATIVE WIDTH BOTH SURVIVE, which is what an
     arrangement IS. What does not survive is the illusion that a twelfth of a
     phone is a place you can put something.

     ROWS ARE NOT PROJECTED. A row is a fixed height that already scales with
     the column in `fitRows`, so vertical order and proportion carry across
     untouched. Only the horizontal axis has a device-dependent capacity.

     AND IT ROUND-TRIPS. Anything dragged on a phone is converted back to the
     canonical twelve before it is saved, so a person can arrange on any device
     and every other device sees the same intent. The quantisation is real —
     four columns cannot express twelfths — so the conversion rounds ONCE, at
     the edit, rather than compounding on every render. */
  var BASE_COLS = 12;

  Canvas.prototype.viewCols = function () {
    var w = (this.grid && this.grid.clientWidth)
         || (this.host && this.host.clientWidth) || 0;
    if (!w) return BASE_COLS;
    /* THE BREAKPOINTS ARE A MINIMUM TILE WIDTH, not device names. A column has
       to be big enough to hold the smallest real widget — roughly 76px, which
       is what an iOS small widget occupies once padding is taken out. Naming
       them "phone" and "tablet" would be a guess about hardware; this is a
       measurement about the box. */
    /* ★ THE FLOOR IS TWO, NOT FOUR.
       Measured 2026-08-30 at an innerWidth of 280px: four columns produced
       54px cells, and a 54px Popit cannot hold "NEW YORK" at any type size —
       the label truncated to "NE…" and it read as a typography failure when it
       was a GRID failure. Below roughly 340px, four columns is not a phone
       layout, it is a spreadsheet.

       Two columns of ~117px is a real widget at that width, and it is what a
       narrow window or a split view actually needs. The same single rule
       produces it — keep halving the column count until a cell is big enough to
       be a widget — the floor was simply set too high to reach the answer. */
    /* ═══ AND THEN THE FOUNDER RULED THE WHOLE APPROACH OUT ═══════════════
       ★ FOUNDER, 2026-09-03: *"just make sure its one universal plane sizes of
         popits and order shouldnt change whatsoever whenever reviewed upon."*

       Everything above is the reasoning for REFLOWING a narrow screen into
       fewer columns, and it was answering the wrong question. Measured on one
       real Home, the same twelve placements:

           360px    every tile 96.9% wide at x=0 — ONE column. A 3-wide Popit
                    and a 12-wide Popit rendered identically.
           1440px   widths 31.7 / 48.3 / 65%, at x 0 / 50 / 66.7.
           and the ORDER differed: two tiles swapped places between the two.

       A person arranges one thing. Halving the columns re-packs it, so the
       proportions they chose are gone and the reading order they chose can
       change — which is the arrangement being REBUILT, not translated, and it
       is what the ruling forbids.

       ONE PLANE. The arrangement is always twelve columns and the columns
       scale, so a 6-wide is half the width on every device and a 3-wide is a
       quarter, and nothing is ever repacked. It scales like a photograph
       rather than reflowing like a document.

       WHAT THIS COSTS, NAMED: at 360px a 3-wide Popit is about 81px. That is
       small. The founder has weighed that against an arrangement that does not
       survive being looked at on a phone, and chosen the plane — and a Popit
       that is too small to say anything at that width now has one honest job,
       which is to say less, not to become a different shape. The density
       ladders already do exactly that.

       The row height already scales with the column (ROW_RATIO), so a tile
       keeps its aspect as well as its proportion. */
    return BASE_COLS;
  };

  Canvas.prototype.toView = function (n) {
    return (n || 0) * this.cols / BASE_COLS;
  };
  Canvas.prototype.toBase = function (n) {
    return (n || 0) * BASE_COLS / this.cols;
  };

  /* ── A LIST IS TRIMMED BY MEASUREMENT, NOT BY ARITHMETIC ───────────────
     ★ MEASURED 2026-09-12 by this lane's own clipped probe, one commit after
       the rows were added: an Events tile overflowed by 8px and the probe went
       from 0 findings to 5. The rows I had just written to honour "a surface
       that shows less than the truth must say so" were themselves the surface
       showing less than the truth without saying so.

     THE CAP WAS COMPUTED IN GRID ROWS. `h - 2` — where a grid row is ~33px on
     this canvas and a text row ~20, and an Events reading has a date medallion
     in front of it taking whatever it takes. No arithmetic on the FOOTPRINT
     can know how many lines are left, because the footprint is not what
     decides: the front is, the type ramp is, and the width the name needs is.
     Only the rendered box knows — which is the same thing the probe's own
     header says, and I had just ignored it in the code the probe was written
     to check.

     So the list is painted WHOLE and then shortened one row at a time until it
     fits inside the face that clips it, and every row that came off is counted
     into the remainder. The remainder therefore names what the tile could not
     hold rather than what I guessed it could not. */
  /* ── A FACE IN A ROW IS A BACKGROUND, NOT AN <img> ─────────────────────
     `paintRows` re-writes its own innerHTML several times per render while the
     fitter measures, so every repaint would build and discard a fresh set of
     image elements. A background-image on the chip costs one declaration, the
     initial underneath shows through when the picture does not load, and there
     is nothing to tear down between passes.

     THE URL IS FENCED. `_public_avatar` only ever returns a path the person
     published on this platform, but this is going into a `url()` inside a
     style attribute — so anything carrying a quote, a paren, a backslash or
     whitespace is dropped rather than escaped. A face that cannot be proven
     safe is a face that does not appear, and the initial is already there. */
  function faceStyle(face) {
    face = face || {};
    var out = '';
    var col = faceColour(face);
    if (col) { out += '--av-c:' + col + ';'; }
    var u = String(face.url || '');
    if (u && !/["'()\\\s]/.test(u)) {
      out += 'background-image:url(' + (OW.imageUrl ? OW.imageUrl(u) : u) + ');';
    }
    return out;
  }

  function paintRows(list, all, keep) {
    var shown = all.slice(0, Math.max(0, keep));
    var left = all.length - shown.length;
    list.innerHTML = shown.map(function (r) {
      var ch = String(r.text || '').trim().charAt(0).toUpperCase();
      var st = faceStyle(r.face);
      /* A PICTURE IS NOT WRITTEN OVER: the letter was content and the photo a
         background, so a person's initial was printed across their own face.
         No picture: a person is the outline of one (founder/495), anything
         else keeps its initial. */
      var inner = /background-image/.test(st) ? ''
        : ((r.person && OW.faceMark) ? OW.faceMark() : esc(ch));
      /* a row that is not somebody or somewhere — a page of a site — wears no
         chip at all: a letter in a circle says "a face" (founder/590 Website) */
      var av = (!r.plain && (r.face || ch))
        ? '<u class="ow-cv-row__av" style="' + esc(st) + '">' + inner + '</u>'
        : '';
      return '<span class="ow-cv-row">' + av + '<b>' + esc(r.text) + '</b>' +
             (r.note ? '<i>' + esc(r.note) + '</i>' : '') + '</span>';
    }).join('') +
    (left > 0
      ? '<span class="ow-cv-row ow-cv-row--more">and ' + left + ' more</span>'
      : '');
  }

  /* HOW MUCH OF ITSELF A BOX IS HIDING, summed over everything in a face
     except the list being fitted.

     ★ MEASURED 2026-09-12, from a screenshot rather than from a number: a
       Guestbook tile drew "3 signatures" cut through the middle of the glyphs
       and a name sliced in half under it. Every rectangle still sat inside the
       face, so the clipped probe was clean and my own trim thought the list
       fitted — because the list HAD fitted. It had fitted by taking 10px from
       the headline and 12 more from the quote, and a flex row squashes its
       children silently rather than overflowing.

     SO THE QUESTION IS NOT "DOES THE LIST FIT" BUT "WHAT DID IT COST". The
     baseline is taken with the list hidden; a list that raises it has not
     found room, it has taken room from the reading above it. Same rule as
     everywhere else in this lane, applied one level further in: a surface
     that shows less than the truth must say so, and a headline cut off at the
     knees says nothing at all. */
  function hiddenIn(face, skip) {
    var all = face.querySelectorAll('*');
    var t = 0;
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e === skip || (skip && skip.contains && skip.contains(e))) continue;
      if (e.ownerSVGElement) continue;          /* a drawing is not truncated text */
      var d = e.scrollHeight - e.clientHeight;
      if (d <= 1) continue;
      /* ── A BOX THAT ANNOUNCES ITS OWN CUT IS NOT A COST ────────────────
         The clipped probe settled this on its first real finding and the rule
         is the same one level in: a rendered ellipsis SHOWS LESS AND SAYS SO,
         and a hard cut shows less and says nothing.

         It is also the only reason the clamp trade can work at all. Clamping
         the quote from four lines to two makes its `scrollHeight` deficit go
         UP — that is what a clamp IS — so a fitter that counted it would read
         the trade as damage and undo the very thing that made room for the
         rows. Measured: with the clamp counted, no list ever fitted on a 432px
         tile; the two changes were fighting each other and the list always
         lost. */
      var cs;
      try { cs = global.getComputedStyle(e); } catch (_) { cs = null; }
      if (!cs) continue;
      /* ── ONLY A BOX THAT CLIPS CAN HIDE ANYTHING ───────────────────────
         `scrollHeight > clientHeight` on an `overflow:visible` box means the
         glyphs are taller than their line box, not that a reader is missing
         a word — the date in the Events medallion reads 4px over and is drawn
         in full. Counting those made the fitter refuse rows to protect text
         that was never at risk. The probe has had this distinction from the
         start (`clips()`); this is the same test, used for the same reason. */
      if (!(cs.overflow === 'hidden' || cs.overflowY === 'hidden' ||
            cs.overflow === 'clip' || cs.overflowY === 'clip' ||
            cs.overflowY === 'auto' || cs.overflowY === 'scroll')) continue;
      if (cs.textOverflow === 'ellipsis' ||
          (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;
      t += d;
    }
    return t;
  }

  /* Runs after `fitRows`, because the row height it sets is what decides how
     tall a tile actually is — trimming before it would measure a canvas that
     is about to change size. Cheap by construction: only tiles that HAVE a
     list are touched, and a list is at most eight rows. */
  /* ── THE HERO IS SET TO THE NAME, NOT THE NAME TO THE HERO ─────────────
     ★ FOUNDER: *"they cannot appear broken when resized or stretched."*

     A type ramp written in `cqw` knows the WIDTH of the tile and nothing
     whatever about the number of characters it has been asked to hold. It is
     right for "Online" and wrong for "Boardwalk Arcade" in the same 115px
     tile, and no ramp can tell the difference because the ramp is not given
     the text. Only the rendered box knows — the same sentence the clipped
     probe opens with.

     So the declared size is the IDEAL and this is the floor: step down until
     the widest line fits the column, stop at 13px, and only then allow a word
     to break. Cheap and bounded — a handful of 1px steps on the few tiles
     whose name is long, and nothing at all on the rest. */
  Canvas.prototype.fitType = function () {
    var h = this.grid;
    if (!h || !h.querySelectorAll) return;
    var sigs = h.querySelectorAll('.ow-cv-face--po .ow-cv-sig');
    for (var i = 0; i < sigs.length; i++) {
      var sig = sigs[i];
      /* EVERY PASS STARTS FROM THE IDEAL, so a tile that grew gets its full
         size back rather than keeping a floor it needed when it was narrow */
      sig.style.fontSize = '';
      sig.classList.remove('is-tight');
      if (!sig.offsetParent) continue;
      if (sig.scrollWidth <= sig.clientWidth + 0.5) continue;
      var px = parseFloat(global.getComputedStyle(sig).fontSize) || 0;
      if (!px) continue;
      while (px > 13 && sig.scrollWidth > sig.clientWidth + 0.5) {
        px -= 1;
        sig.style.fontSize = px + 'px';
      }
      /* A WORD THAT WILL NOT FIT AT 13px IS NOT GOING TO. Breaking it is
         ugly and it is still the better of the two: the alternative is a name
         that ends at the tile edge without saying it has. */
      if (sig.scrollWidth > sig.clientWidth + 0.5) sig.classList.add('is-tight');
    }
  };

  Canvas.prototype.fitLists = function () {
    var h = this.grid;
    if (!h || !h.querySelectorAll) return;
    var lists = h.querySelectorAll('.ow-cv-rows');
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      var all = list._rows || [];
      if (!all.length) continue;
      var face = list.closest ? list.closest('.ow-cv-face') : null;
      if (!face) continue;
      /* A LIST THE STYLESHEET HAS TAKEN AWAY IS NOT THIS PASS'S BUSINESS.
         Below 200px the container query hides it outright, and a fitter that
         measured a `display:none` box would read every rect as zero, conclude
         everything fits, and paint rows nobody will ever see. */
      if (!list.offsetParent && !list.style.display) continue;
      var fb = face.getBoundingClientRect();
      if (!fb.height) continue;            /* not laid out — not a claim */
      var pad = 0;
      try { pad = parseFloat(global.getComputedStyle(face).paddingBottom) || 0; }
      catch (_) { pad = 0; }
      /* the CONTENT bottom, not the border bottom: a row that sits in the
         face's own padding has not been clipped, but it has stopped looking
         like it belongs to the tile */
      var limit = fb.bottom - pad;

      /* WHAT THE TILE LOOKS LIKE WITH NO LIST AT ALL — measured first, because
         it is the thing the list is not allowed to make worse. */
      list.style.display = 'none';
      face.classList.remove('has-list');
      var base = hiddenIn(face, list);

      /* EVERY PASS STARTS FROM THE WHOLE LIST. A tile that grew — a window
         widening, a font finally landing, a phone turning — must be able to
         win rows back, and a pass that only ever removed them could not give
         one back once it was gone.

         The face is told it has a list BEFORE anything is measured, because
         the telling is what frees the height: a front that fills the tile
         yields to `has-list`, and a quote gives up two of its lines to make
         room for rows that say more than the two lines did. */
      list.style.display = '';
      face.classList.add('has-list');
      var keep = all.length;
      paintRows(list, all, keep);
      var fits = function () {
        return list.getBoundingClientRect().bottom <= limit + 0.5 &&
               list.scrollHeight <= list.clientHeight + 1 &&
               hiddenIn(face, list) <= base + 1;
      };
      while (keep > 0 && !fits()) {
        keep--;
        paintRows(list, all, keep);
      }
      /* KEEP ZERO IS STILL AN ANSWER. "and 7 more" alone is true, and it is
         the whole reason the list exists on a tile too short to draw it —
         the reading above already says which one is latest. Only when even
         that one line hangs out of the tile is there nothing to say here. */
      if (!fits()) {
        /* HIDDEN, NOT EMPTIED — and that distinction cost a probe finding.
           An emptied list still holds its 6px top margin and its `width:100%`,
           which in a wrapping face is a whole flex line: the Events tile still
           overflowed by 7px with nothing whatever inside the list.

           `display:none` rather than removal, because the node carries the
           payload the next pass measures against. */
        list.innerHTML = '';
        list.style.display = 'none';
        /* and the front takes its height back — a tile with no list is the
           tile it was before there was one */
        face.classList.remove('has-list');
      }
    }
  };

  /* What a grid row measures right now, in px. Falls back to the constant only
     when there is nothing laid out to ask — a value used before first paint is
     better than a NaN, and every caller re-reads on the next gesture. */
  Canvas.prototype.rowPx = function () {
    var h = this.grid;
    if (!h) { return ROW; }
    var v = parseFloat(global.getComputedStyle(h).getPropertyValue('--cv-row'));
    return (isFinite(v) && v > 0) ? v : ROW;
  };

  Canvas.prototype.fitRows = function () {
    var h = this.grid;
    if (!h) return;
    var w = h.clientWidth || (this.host && this.host.clientWidth) || 0;
    if (!w) return;                 /* not laid out yet — the observer re-runs it */
    var cols = this.cols || COLS;
    /* THE SAME ARITHMETIC THE STYLESHEET USES, not an approximation of it. A
       tile's width is `(w / cols) * 100% - gap`, so the column PITCH is
       `width / cols` and a one-wide tile is `pitch - gap`. The row pitch is
       `row + gap`. Setting them equal is what makes the cell square — and it
       has to be read off the same number the CSS divides by, or the two drift
       by a gap and every footprint is a little wrong. */
    var pitch = w / cols;
    var row = Math.max(1, Math.round(pitch - GAP));
    h.style.setProperty('--cv-row', row + 'px');
    /* THE TYPE SCALES WITH THE PLANE BELOW A PHONE'S WIDTH. The plane is one
       plane (founder, 2026-09-03) and scales like a photograph — but the
       words inside a tile were fixed pixels, so at a 290px pane (the
       founder's own browser pane, measured 2026-09-20) a 2×2 tile was 117px
       wide holding 16px type: three lines over each other and a face over
       the words. `--cv-type` is 1 at 380px and above and shrinks with the
       plane below it, never under .62; the stylesheet multiplies the face's
       type by it. Above a phone nothing changes. */
    h.style.setProperty('--cv-type', String(Math.max(.62, Math.min(1, w / 380)).toFixed(3)));
  };

  /* ORIENTATION IS JUST A WIDTH CHANGE, so there is no orientation branch —
     one observer covers rotating a phone, resizing a window, a split view, a
     keyboard opening, and the pane this is being developed in.

     `ResizeObserver` RATHER THAN `window.resize`: the canvas can change width
     without the window doing anything at all — a sidebar opening, a tab strip
     appearing, the OS shell reflowing around it — and a window listener is
     blind to every one of those. It falls back to the window event where the
     observer does not exist, because a stale row height is worse than a
     coarser trigger. */
  Canvas.prototype.watchSize = function () {
    var self = this;
    if (this._sizing) return;
    /* ★ A RESIZE THAT CHANGES THE COLUMN COUNT MUST RE-PROJECT.
       ★ FOUNDER, 2026-08-30: *"when adjusting view ratio everything breaks
         layout wise"* — this is the other half of that.

       `fitRows` only rescales the ROW HEIGHT. The column count is decided in
       `render()`, so widening a window from 1100 to 1280 left the canvas on
       whatever projection it had when it last drew — measured: still four
       columns at 1280px after being six at 1100. The layout was correct for a
       width the window no longer had.

       So the observer asks whether the projection itself changed, and re-renders
       only then. A resize that does not cross a column boundary still costs one
       cheap comparison and no paint, which is what keeps a drag smooth while a
       keyboard opens or a sidebar animates. */
    var fit = function () {
      var want = self.viewCols();
      if (want !== self.cols) { self.render(); return; }
      self.fitRows();
      self.fitType();
      self.fitLists();
      if (self._sel) self.placeBox();
    };
    if (typeof global.ResizeObserver === 'function') {
      this._sizing = new global.ResizeObserver(fit);
      try { this._sizing.observe(this.host); } catch (_) { this._sizing = null; }
    }
    if (!this._sizing) {
      this._sizing = true;
      global.addEventListener('resize', fit);
      global.addEventListener('orientationchange', fit);
    }
  };

  Canvas.prototype.render = function () {
    var self = this;
    warmCatalog();
    /* ── A SELECTION SURVIVES A RE-RENDER ──────────────────────────────────
       Saving invalidates the canvas read, the surface redraws, and every tile
       node is replaced — which silently took the transform box with it. So a
       person resized a Popit and their selection vanished the instant it
       saved, which reads as the control breaking at the moment it worked.
       The id is remembered here and re-attached after the draw. */
    var keepId = this._sel && this._sel.item && this._sel.item.id;
    this.deselect();
    var h = doc.createElement('div');
    h.className = 'ow-cv' + (this.mayArrange ? ' is-mine' : '')
                + (this.shell === 'os' ? ' ow-cv--os' : '');
    /* the device's column count, decided from the measured box — see
       `viewCols`. The stored arrangement is untouched; only its projection
       changes. */
    this.cols = this.viewCols();
    /* ONE LAYOUT PASS FOR THE WHOLE CANVAS, computed before any tile is drawn —
       a per-tile calculation cannot know what the tile beside it took. */
    this._pack = this.packed();
    h.style.setProperty('--cv-cols', this.cols);
    /* ONE SOURCE FOR THE CAP. The stylesheet carries a fallback so a canvas
       rendered before this line still has a sane ceiling, but the number that
       decides is the constant — a literal in two places is a number that will
       disagree with itself. */
    h.style.setProperty('--cv-max', PLANE_MAX + 'px');
    /* THE ROW FROM THE HOST'S WIDTH, BEFORE ANY TILE HAS A STYLE (2026-10-01).
       This set the constant ROW and let `fitRows` correct it after the grid was
       in the document — but `fitRows` reads `clientWidth`, which gives every
       tile a computed `top` at the constant row first, so the correction ran
       as a 180ms `top` transition: every Popit on Home slid and grew as it
       landed. Measured on a phone-speed network (tools/probe/home-cls.cjs):
       about 0.25 of a 0.31 layout shift. The plane's width is the host's
       (capped at PLANE_MAX), so the row is known now; `fitRows` then confirms
       it and changes nothing. ROW stays only for a host not laid out yet. */
    var hostW = Math.min((this.host && this.host.clientWidth) || 0, PLANE_MAX);
    h.style.setProperty('--cv-row', (hostW ? Math.max(1, Math.round(hostW / this.cols - GAP)) : ROW) + 'px');
    h.classList.add('is-booting');                  /* no slide on the first frames */
    /* where there are no frames (a renderer driven outside a browser, as
       tools/canvas_render_check.cjs does) a timeout stands in for two */
    var nextFrame = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame
                  : function (fn) { return setTimeout(fn, 16); };
    nextFrame(function () { nextFrame(function () { h.classList.remove('is-booting'); }); });
    h.style.setProperty('--cv-gap', GAP + 'px');

    var maxY = 0;
    var pack = this._pack || {};
    var shown = (this.items || []).filter(function (it) { return !self.isVoid(it); });
    shown.forEach(function (it) {
      var b = pack[it.id];
      maxY = Math.max(maxY, b ? (b.y + b.h) : ((it.y || 0) + (it.h || 1)));
      h.appendChild(self.tile(it));
    });
    h.style.setProperty('--cv-rows', Math.max(maxY, 6));
    if (keepId) {
      /* after paint — the tile must be in the document before it can be
         measured, and the box measures the tile */
      global.setTimeout(function () {
        var node = h.querySelector('[data-id="' + keepId + '"]');
        var item = self.items.filter(function (x) { return x.id === keepId; })[0];
        if (node && item && node.isConnected) self.select(h, node, item);
      }, 0);
    }

    /* `shown`, NOT `items` — a surface whose every placement is voided for
       this viewer is an empty surface to them, and drawing a canvas with
       nothing in it is the one state this branch exists to avoid. */
    if (!shown.length) {
      /* ── NEVER ARRANGED vs DELIBERATELY EMPTIED ─────────────────────────
         The server distinguishes them (founder/312: absent · null · empty) and
         so must this, or the distinction was preserved all the way to the wire
         and then thrown away by the thing that draws it.

           never arranged  -> an invitation. They have not seen this yet.
           emptied         -> NOTHING. They cleared it on purpose, and putting
                              a prompt back is the platform overruling them.
           not theirs      -> nothing; an empty surface is not somebody else's
                              business.

         `arranged === null` means the answer has not arrived, and an invitation
         drawn before the answer would flicker in front of a person who does
         have a canvas. */
      if (this.mayArrange && this.arranged === false) {
        /* AN INVITATION THAT CANNOT BE ACCEPTED IS A DEAD END, and shipping one
           is worse than shipping nothing: it tells a person the product has a
           feature and then refuses to open it. The first version of this said
           "Add a Popit or a sticker" and there was no way to. */
        var empty = doc.createElement('button');
        empty.type = 'button';
        empty.className = 'ow-cv-empty ow-cv-empty--act';
        empty.textContent = 'Nothing here yet — add a Popit';
        empty.addEventListener('click', function () { self.pick(); });
        h.appendChild(empty);

        /* ── PUBLISHING YOUR ARRANGEMENT IS A TAP, NOT A DEFAULT ───────────
           ★ FOUNDER RULING, 2026-09-04: the public face is `profile:{email}`.
           ★ STANDING RULE: *"NOTHING PUBLISHES ITSELF."*

           Those two together decide this. The profile is a different surface
           from the Home, so arranging a Home no longer puts anything on the
           face other people see — which is correct, and would otherwise leave
           a person with a carefully arranged Home and an empty public profile
           and no visible connection between them.

           So on YOUR OWN profile, while it has never been arranged, and only
           when your Home actually has something on it, there is one offer to
           bring it across. It goes through the same adopt as Copy Layout, so
           it leaves personal content behind exactly as copying somebody else's
           layout does — publishing your arrangement is not publishing your
           Count, your Said or your collections.

           It is NOT offered on a profile that was deliberately emptied: that
           branch is above, and putting a prompt back there is the platform
           overruling a person's decision. */
        /* ── PUBLISHING YOUR ARRANGEMENT IS A TAP, NOT A DEFAULT ───────────
           ★ FOUNDER RULING, 2026-09-04: the public face is `profile:{email}`.
           ★ STANDING RULE: *"NOTHING PUBLISHES ITSELF."*

           Those two together decide this. The profile is a different surface
           from the Home, so arranging a Home no longer puts anything on the
           face other people see — correct, and it would otherwise leave a
           person with a carefully arranged Home, an empty public profile, and
           no visible connection between them.

           So on YOUR OWN profile, while it has never been arranged, there is
           one offer. It opens the SAME surface as the permanent control beside
           Add, so the preview and the price cannot differ between the two ways
           in. Not offered on a profile that was deliberately emptied — that
           branch is above, and putting a prompt back there is the platform
           overruling a person's decision. */
        if (self.isMyProfile()) {
          var invite = doc.createElement('button');
          invite.type = 'button';
          invite.className = 'ow-cv-empty ow-cv-empty--act ow-cv-empty--pub';
          invite.textContent = 'Show my Home layout here';
          invite.addEventListener('click', function () { self.offerRepublish(); });
          h.appendChild(invite);
        }
      } else {
        /* Nothing to draw and nothing to say. Do not occupy the space. */
        this.host.innerHTML = '';
        this.grid = null;
        this.paintNote();
        return;
      }
    }

    this.host.innerHTML = '';
    this.paintNote();
    this.host.appendChild(h);
    this.grid = h;
    this.fitRows();
    this.watchSize();
    /* AN ARRANGEMENT SAVED BEFORE THIS RULE EXISTED IS STILL OVERLAPPING.
       Repairing it on the way in — once, quietly, and only when it is actually
       wrong — is better than showing somebody a pile and waiting for them to
       drag their way out of it. It saves only if it changed something, so a
       clean canvas costs nothing. */
    /* `items.length` GUARDS THE FLAG, not just the work. `render()` runs once
       before `load()` answers, with an empty list — setting the flag there
       meant the repair was marked done before there was anything to repair, and
       the real arrangement rendered overlapping exactly as before. Measured:
       three stored overlaps survived a reload with this code in place. */
    if (this.mayArrange && !this._repaired && (this.items || []).length) {
      this._repaired = true;
      if (this.relayout(null)) { this.dirty = true; this.render(); this.save(); return; }
    }
    /* the mode survives a re-render — a save mid-arrangement must not silently
       drop the person back into browsing */
    if (this.editing) h.setAttribute('data-editing', '1');
    /* ── COPY THIS LAYOUT ────────────────────────────────────────────────
       ★ FOUNDER, 2026-08-27: *"let users copy each others layouts and paste
         them to their home and profile."*  and, on the wording, 2026-09-03:
       *"The UI should not expose implementation categories like SETTING /
         CONTENT / OBJECT. That's an internal contract."*

       So the control says what a person gets, not how it is computed:
       "This copies the arrangement and style while leaving the person's
       content behind." One sentence, no taxonomy.

       IT APPEARS ONLY WHERE IT CAN WORK — on somebody ELSE'S arrangement that
       actually has something in it, and only for a signed-in person who has a
       surface of their own to paste onto. An offer that would refuse is worse
       than no offer. */
    if (!this.mayArrange && this.items.length && this.canAdopt()) {
      var copy = doc.createElement('button');
      copy.type = 'button';
      copy.className = 'ow-cv-add ow-cv-copy';
      copy.textContent = 'Copy this layout';
      copy.addEventListener('click', function () { self.offerCopy(); });
      this.host.appendChild(copy);
    }
    if (this.mayArrange) {
      this.arm(h);
      if (this.items.length) {
        /* THE LOOP MUST NOT END AT ONE. Without this, a person can add their
           first Popit and then never a second — the only door was the empty
           state, and adding something closes it behind them. */
        var more = doc.createElement('button');
        more.type = 'button';
        more.className = 'ow-cv-add';
        more.textContent = 'Add';
        more.addEventListener('click', function () { self.pick(); });
        this.host.appendChild(more);

        /* the permanent door to re-publishing — see offerRepublish. Only on
           your OWN profile: it is meaningless anywhere else, and an offer that
           would refuse is worse than no offer. */
        if (this.isMyProfile()) {
          var pubAgain = doc.createElement('button');
          pubAgain.type = 'button';
          pubAgain.className = 'ow-cv-add';
          pubAgain.textContent = 'Use my Home layout';
          pubAgain.addEventListener('click', function () { self.offerRepublish(); });
          this.host.appendChild(pubAgain);
        }

        /* ── A DOOR INTO ARRANGEMENT THAT IS NOT A SECRET ─────────────────
           Press-and-hold is the gesture people already know, and it is also
           invisible: nothing on the screen says it exists. A home screen has
           the same problem and solves it the same way — the gesture for people
           who know it, a named control for everyone else, and BOTH lead to the
           identical mode rather than to two slightly different ones.

           It is also the way OUT. While arranging, this says Done, so the
           person is never in a mode whose exit they have to guess. */
        var done = doc.createElement('button');
        done.type = 'button';
        done.className = 'ow-cv-add ow-cv-done';
        done.textContent = self.editing ? 'Done' : 'Arrange';
        done.addEventListener('click', function (ev) {
          ev.stopPropagation();
          self.setEditing(!self.editing);
        });
        this.host.appendChild(done);

        /* ONLY WHILE ARRANGING. Offering "Cancel" to somebody who is browsing
           asks them what they would be cancelling. */
        if (self.editing) {
          var undo = doc.createElement('button');
          undo.type = 'button';
          undo.className = 'ow-cv-add ow-cv-cancel';
          undo.textContent = 'Cancel';
          undo.addEventListener('click', function (ev) {
            ev.stopPropagation();
            self.revert();
            self.setEditing(false);
          });
          this.host.appendChild(undo);
        }
      }
    }

    /* ── LAST, BECAUSE IT MEASURES ───────────────────────────────────────
       Every list on this canvas is now in the document at its final size, so
       the rows can be trimmed to what their tile actually holds.

       AND AGAIN WHEN THE FONTS LAND. A measured layout taken against the
       fallback face is a measurement of a page that no longer exists a moment
       later — the display font is wider than the system one, and a list that
       fit by 2px before it loaded is cut by 6px after. Once, guarded, and only
       while the fonts are still loading. */
    this.fitType();
    this.fitLists();
    if (doc.fonts && doc.fonts.status !== 'loaded' && doc.fonts.ready &&
        typeof doc.fonts.ready.then === 'function') {
      doc.fonts.ready.then(function () {
        if (!self.grid || !self.grid.isConnected) return;
        self.fitType();
        self.fitLists();
      });
    }
  };

  /* ── THE CATALOG, AS A THING YOU CHOOSE FROM ─────────────────────────────
     ★ FOUNDER, PRODUCT_RESET §19: *"Users can choose Popits FROM A CATALOG and
       put them on Home, public profile, potentially Centers."*

     THE LIST COMES FROM THE SERVER, ALWAYS. `/api/canvas/catalog` returns the
     platform's Popits, this Center's apps, the animation vocabulary and the
     grid. The App holds no list of its own — that is the second-hardcoded-list
     defect that had `_DOMAIN_PKGS` silently missing `messaging`, and it would go
     stale in exactly the same silence the day a Popit is added.

     SELECTING IS NOT OWNING (founder/315). Choosing from this catalog places
     something; it does not establish that the person OWNS it. Placement must
     never be the only record of Popit ownership, and this picker deliberately
     does not pretend to be one. */
  Canvas.prototype.pick = function () {
    var self = this;
    var sheet = doc.createElement('div');
    /* THE SHEET LIVES ON `body`, SO IT INHERITS NOTHING FROM THE CANVAS.
       Every colour in here is a `--ow-*` token, and `.ow-cv--os` is the one
       place those tokens are remapped onto the OS's own — without it the
       picker opened as a full-screen DARK sheet in the middle of a light OS.
       Measured 2026-08-24 in the Center hub. Same stylesheet, same tokens; it
       just has to be told which ground it is standing on. */
    sheet.className = 'ow-cv-pick' + (this.shell === 'os' ? ' ow-cv--os' : '');
    sheet.innerHTML = '<div class="ow-cv-pick__bar"><span>Add to your canvas</span>' +
      '<button type="button" class="ow-cv-pick__x">Close</button></div>' +
      '<div class="ow-cv-pick__list"><div class="ow-cv-pick__wait">Loading</div></div>';
    doc.body.appendChild(sheet);
    var close = function () { if (sheet.parentNode) sheet.parentNode.removeChild(sheet); };
    sheet.querySelector('.ow-cv-pick__x').addEventListener('click', close);
    doc.addEventListener('keydown', function esc_(e) {
      if (e.key === 'Escape') { close(); doc.removeEventListener('keydown', esc_); }
    });

    OW.canvas.catalog(self.centerId || '').then(function (cat) {
      var list = sheet.querySelector('.ow-cv-pick__list');
      if (!cat) {
        /* SAY WHY. A catalog that will not load and an empty catalog are
           different things to the person looking at them. */
        list.innerHTML = '<div class="ow-cv-pick__wait">The catalog could not ' +
          'be loaded. Nothing has been changed.</div>';
        return;
      }
      /* EACH ROW STATES ITS PLACEMENT KIND. The catalog groups them already —
         `popits` and `apps` — so this reads the grouping the server sent
         instead of inspecting a `kind` field that means something else. */
      /* A PERSON'S OWN COLLECTIONS LEAD THE LIST. They are the only rows here
         that are INSTANCES rather than types — "Atlantic City", not "Clock" —
         so they are the ones somebody is actually looking for by name, and a
         list that opens with fifteen generic types buries them. */
      var rows = (cat.collections || []).map(function (c0) {
        return { place: 'collection', id: c0.id,
                 name: c0.name || (c0.collection === 'playlist'
                                     ? 'Playlist' : 'Highlight'),
                 blurb: c0.blurb || (c0.count
                   + (c0.collection === 'playlist'
                        ? (c0.count === 1 ? ' video' : ' videos')
                        : (c0.count === 1 ? ' story' : ' stories'))),
                 w: c0.w, h: c0.h };
      }).concat((cat.popits || []).filter(function (r0) {
        /* ── DO NOT OFFER WHAT THIS SURFACE CANNOT ANSWER ────────────────
           ★ FOUNDER, 2026-09-09: *"users should not need to understand the
             architecture to use Oneway"* — and, in the same directive, *"do
             not remove real capability just to make it look simple."*

           MEASURED on one real Centre: 7 of its 18 placements were permanently
           `not_supported` — now · marks · visited · rhythm · favourite ·
           guestbook · said — each holding a 6x3 tile that will never fill.
           Thirty-nine percent of that Centre's surface was dead by
           construction, explaining the type system to its visitors.

           EVERY ONE OF THEM WAS OFFERED BY THIS LIST. The registry has always
           declared which subjects a kind answers for, and always enforced it —
           but only at ANSWER time, so a person learned the rule by placing a
           Guestbook on a place and watching it say "For a person, not a place"
           forever.

           NO CAPABILITY IS REMOVED. A Guestbook is still a Guestbook and still
           placeable everywhere it works; this stops offering it where it
           provably cannot, which is exactly the line his two sentences draw
           together. The constraint is the REGISTRY'S, carried on the catalog
           row — a second list of which kinds suit which surface is the
           stale-in-silence defect this picker's own server docstring warns of.

           A ROW WITH NO `subjects` IS ALLOWED. Unknown means unconstrained: an
           older server, an unregistered kind or an unreadable seam must never
           silently take a capability away. */
        if (!r0 || !r0.subjects || !r0.subjects.length) { return true; }
        var sk = String(self.surface || '').split(':')[0];
        if (!sk) { return true; }
        return r0.subjects.indexOf(sk) !== -1;
      }).map(function (r0) {
        return { place: 'popit', id: r0.id, name: r0.name, blurb: r0.blurb,
                 w: r0.w, h: r0.h };
      })).concat((cat.apps || []).map(function (a0) {
        return { place: 'app', id: a0.id, name: a0.name, blurb: a0.blurb,
                 w: a0.w, h: a0.h };
      }));
      if (!rows.length) {
        list.innerHTML = '<div class="ow-cv-pick__wait">Nothing to add yet.</div>';
        return;
      }
      list.innerHTML = '';

      /* ── A STICKER IS AN UPLOAD, NOT A CATALOG ROW (§20) ────────────────
         It sits at the top of the same list because it is the same act from
         the person's side — "put something on my canvas" — while being a
         different act underneath: a Popit is CHOSEN from what exists, a sticker
         is BROUGHT. The upload mints the only kind of ref `normalize()` will
         accept, so the loop is closed rather than two rules that can drift. */
      var up = doc.createElement('label');
      up.className = 'ow-cv-pick__row ow-cv-pick__row--up';
      up.innerHTML = '<span class="ow-cv-pick__name">Upload a sticker</span>' +
        '<span class="ow-cv-pick__blurb">An image of your own. Drag it, resize ' +
        'it, and it reacts when you tap it.</span>';
      var file = doc.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.style.display = 'none';
      up.appendChild(file);
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var say = up.querySelector('.ow-cv-pick__blurb');
        say.textContent = 'Uploading';
        var fr = new global.FileReader();
        fr.onload = function () {
          req('/api/canvas/sticker',
              { method: 'POST', body: { data: String(fr.result || '') } })
            .then(function (r) {
              if (!r || !r.ok || !r.data || !r.data.placement) {
                /* SAY WHY, AND CHANGE NOTHING. A refused upload must not leave
                   a placeholder on somebody's canvas. */
                say.textContent = (r && r.error) ? String(r.error)
                  : 'That image could not be added. Nothing has changed.';
                return;
              }
              self.add(r.data.placement);
              close();
            });
        };
        fr.onerror = function () {
          say.textContent = 'That file could not be read.';
        };
        fr.readAsDataURL(f);
      });
      list.appendChild(up);

      function row(entry) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'ow-cv-pick__row';
        b.innerHTML = '<span class="ow-cv-pick__name">' + esc(entry.name) + '</span>' +
          (entry.blurb ? '<span class="ow-cv-pick__blurb">' + esc(entry.blurb) + '</span>' : '');
        /* ── AND ITS MARK, SO THE ROW IS RECOGNISABLE BEFORE IT IS READ ────
           Every Popit carries a glyph on its tile — the same one, drawn here.
           A gallery of twelve rows that differ only in their words makes a
           person read twelve sentences to find the thing they already know
           the shape of; the mark is how you find Places without reading
           "Places". It is the tile's own glyph rather than a set of icons
           invented for this screen, so what you pick is marked the way what
           you get is marked.

           NOT A PREVIEW OF THE CONTENT, deliberately. A real preview would
           need a live read per kind before a person has chosen anything, and
           a FAKE one would be the miniature fake feed the founder's ruling is
           against. The mark is true without asking the server a question. */
        var gp = glyph(entry.kind || entry.id);
        if (gp) { gp.className += ' ow-cv-pick__gl'; b.appendChild(gp); }
        b.addEventListener('click', function () {
          self.add(entry);
          close();
        });
        list.appendChild(b);
      }
      function group(label) {
        var g = doc.createElement('div');
        g.className = 'ow-cv-pick__grp';
        g.textContent = label;
        list.appendChild(g);
      }
      rows.forEach(row);

      /* ── THE OTHER TWO KINDS A CENTER CAN SHOW ───────────────────────────
         ★ FOUNDER, 2026-08-24: *"He clicks Add, chooses an Event, Center,
           Popit, or Sticker, places it, and saves."*

         `normalize` has always accepted `event` and `center` placements and
         `project` has always joined them — but the only way to place one was
         the discovery card's `place()`. From inside the canvas, Add offered
         Popits and stickers alone, so two of the four kinds in the founder's
         sentence were unreachable from the surface they belong to.

         ONE CANONICAL READ, TWO LISTS, AND NO NEW REPRESENTATION.
         `/api/public/centers/{id}/events` already returns every Event this
         Center shows — owned, hosted, promoted, displayed — each row carrying
         the owning Center. So the Events offered are that list, and the Centers
         offered are the Centers already in it: the ones this Center
         demonstrably works with. Nothing here invents a second Event shape, a
         second Center shape, or a "related centers" store.

         BOUNDED AT THE SOURCE. That route windows at 200 and says so; this
         asks for far less, because a picker is a thing you read.

         ONLY WHAT CAN ACTUALLY BE PLACED. A row with no id, or one the server
         reports as never anchored, is skipped — `normalize` would refuse it,
         and offering a choice that returns an error is the dead-end this file
         already refuses to ship in its empty state. */
      if (!self.centerId) { return; }
      /* THE CANONICAL EVENTS (2026-10-01): /api/oneway/places/{id}/events is
         public by default and answers the Center's own events, flat
         ({id, title, starts_at, place}); the legacy /api/public/centers/…
         read is not called. */
      req('/api/oneway/places/' + encodeURIComponent(self.centerId) +
          '/events?limit=40').then(function (r) {
        if (!r || !r.ok || !r.data) { return; }   /* silent: Popits still work */
        var evs = (r.data.events || []).filter(function (e) {
          return e && e.id;
        }).map(function (e) {
          return { event_id: e.id, title: e.title,
                   date: String(e.starts_at || '').slice(0, 10),
                   location: (e.place && (e.place.name || e.place.label)) || (typeof e.place === 'string' ? e.place : '') };
        });
        if (evs.length) {
          group('Events');
          evs.slice(0, 40).forEach(function (e) {
            var when = [e.date || '', e.location || ''].filter(Boolean).join(' · ');
            row({ place: 'event', id: e.event_id, w: 6, h: 3,
                  name: e.title || 'Event', blurb: when });
          });
        }
        /* THE CENTERS THIS ONE IS ACTUALLY CONNECTED TO.
           The first version read only each Event's OWNER, which for a Center
           whose Events are all its own yields exactly nothing — an "Add a
           Center" group that is empty for the common case is the dead end this
           file refuses elsewhere. The connection that matters is the whole
           Event graph: who owns it AND who promotes, hosts or displays it. A
           Center that promotes this Center's concert IS a Center it works with;
           that is the relationship, and `/api/public/events/{id}/centers` is
           the canonical way to ask for it.

           BOUNDED, AND HONEST ABOUT IT. Asked for the first few Events only —
           a picker is read, not paged — so this cannot fan out with the
           calendar. Nothing is invented when the answer is empty: the group
           simply does not appear. */
        var probe = evs.slice(0, 6);
        Promise.all(probe.map(function (e) {
          /* the canonical relationship read: {center_id, name, rel, says} */
          return req('/api/oneway/events/' + encodeURIComponent(e.event_id) +
                     '/centers').then(function (x) {
            return ((x && x.ok && x.data && x.data.centers) || []).map(function (o) {
              return o && { biz_id: o.center_id || o.biz_id, name: o.name };
            });
          }).catch(function () { return []; });
        })).then(function (lists) {
          var seen = {}, centers = [];
          lists.forEach(function (l) {
            l.forEach(function (o) {
              if (!o || !o.biz_id || o.biz_id === self.centerId) { return; }
              if (seen[o.biz_id]) { return; }
              seen[o.biz_id] = 1;
              centers.push(o);
            });
          });
          if (!centers.length) { return; }
          group('Centers');
          centers.forEach(function (o) {
            row({ place: 'center', id: o.biz_id, w: 4, h: 3,
                  name: o.name || o.biz_id,
                  blurb: 'A Center this one works with' });
          });
        });
      });
    });
  };

  /* ══ THE INSTRUMENTS ═══════════════════════════════════════════════════
     ★ FOUNDER, 2026-08-25: *"A Popit is an interactive instrument, not a card
       … Do not solve this by adding more text … if I screenshot the Popit with
       all text removed, its visual form should still communicate roughly what
       kind of thing it is."*

     The previous pass gave every Popit the same rounded body and put different
     WORDS inside it, which is a card with better typography. The form itself
     has to carry the meaning, so each bound kind gets its own drawn instrument:

       now    a live signal — concentric rings around a core that breathes
              while the person is actually online, and goes hollow when they
              are not. Reads as a status light with no words at all.
       next   a time dial — an arc showing how near the Event is, wound from
              today to the date, with the day of the month at its centre.
              Reads as a countdown.
       world  a locator — range rings and a crosshair with the point set from
              the real coordinate. Reads as a map.

     DRAWN FROM THE CANONICAL PROJECTION, never decoration. The arc is the
     actual distance to the actual Event; the pin sits where the Center actually
     is. An instrument that moves independently of its data is an ornament. */
  function svgEl(tag, attrs) {
    var n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
    return n;
  }

  /* ══ SIZE IS PROJECTION DEPTH, NOT CSS ═════════════════════════════════
     ★ FOUNDER SPEC §5-6: *"Do not make Small Person Popit, Medium Person Popit
       and Large Person Popit as three separate components. It is ONE Popit. The
       physical size determines information density."*

         small   the essential signal
         medium  useful context
         large   rich information + actions

     This is the property that stops a Popit being a card. A card shows the same
     thing at every size and just reflows; an instrument shows MORE OF THE TRUTH
     as you give it room. Every front below takes `d` and decides what is worth
     saying at that depth.

     AND IT NEVER FILLS SPACE (§6). If a large Popit has two legitimate facts it
     stays elegant with two. Fabricating a third to balance the layout is the
     same defect as fabricating data, one layer up. */
  /* ══ EVERY POPIT HAS ITS OWN MARK ══════════════════════════════════════
     ★ FOUNDER, 2026-08-25: *"everything must have icons and must differ from
       each other."*

     Not emoji and not one shared placeholder: a drawn glyph per type, so the
     silhouette alone separates a clock from a place from a person. This is the
     acceptance test made structural — strip every word and the forms still say
     which is which.

     Line geometry on purpose. It inherits the Popit's hue, scales to any tile
     without resampling, and sits in the same instrument language as the dial
     and the locator rather than importing a second icon style. */
  var GLYPH = {
    /* presence — rings around a live core */
    now:      '<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>' +
              '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10.6" opacity=".45"/>',
    /* a dated page with the day marked */
    next:     '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/>' +
              '<path d="M8 3v4M16 3v4"/><rect x="7.4" y="13" width="4.6" height="4" rx="1.2" fill="currentColor" stroke="none"/>',
    /* a month grid — many days, not one */
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/>' +
              '<path d="M8 3v4M16 3v4"/><circle cx="8" cy="14" r="1.1" fill="currentColor" stroke="none"/>' +
              '<circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/>' +
              '<circle cx="16" cy="18" r="1.1" fill="currentColor" stroke="none"/>' +
              '<circle cx="8" cy="18" r="1.1" opacity=".4" fill="currentColor" stroke="none"/>',
    /* a globe */
    /* ── THE 2026-09-12 TWELVE ─────────────────────────────────────────
       Same mark as the reader each one came from: Places IS what Visited was,
       Events IS what Next was, Location IS what World was. A new glyph would
       claim a new object, and these are renames — `test_popits` requires every
       registered kind to declare one, which is how the gap was found. */
    places:   '<path d="M7 10.5c0 3-3 5.5-3 5.5S1 13.5 1 10.5a3 3 0 0 1 6 0z" transform="translate(3 -1)"/>' +
              '<path d="M14 15.5c0 3-3 5.5-3 5.5s-3-2.5-3-5.5a3 3 0 0 1 6 0z" transform="translate(5 -3)"/>',
    events:   '<rect x="3.5" y="5" width="17" height="15" rx="3"/>' +
              '<path d="M8 3v4M16 3v4M3.5 10h17"/>',
    location: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/>' +
              '<circle cx="12" cy="10" r="2.6"/>',
    following:'<circle cx="9" cy="9" r="3.4"/>' +
              '<path d="M3.2 19.2a6.2 6.2 0 0 1 11.6 0"/><path d="M16.5 7.5l2 2 3.5-3.5"/>',
    saved:    '<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.4L6 20V5.5a1 1 0 0 1 1-1z"/>',
    people:   '<circle cx="8.5" cy="9" r="3.2"/><circle cx="16" cy="10" r="2.6"/>' +
              '<path d="M2.8 19a5.9 5.9 0 0 1 11.4 0"/><path d="M15 19a4.6 4.6 0 0 1 6.4-2.6"/>',
    about:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r="1.1"/>',
    /* a window onto a site — founder/590 */
    website:  '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3 9h18"/>' +
              '<circle cx="6.2" cy="6.8" r=".8" fill="currentColor" stroke="none"/><circle cx="8.7" cy="6.8" r=".8" fill="currentColor" stroke="none"/>',
    world:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>' +
              '<path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
    /* two places and the way between them */
    visited:  '<path d="M7 10.5c0 3-3 5.5-3 5.5S1 13.5 1 10.5a3 3 0 0 1 6 0z" transform="translate(3 -1)"/>' +
              '<path d="M20 6.5c0 2.4-2.4 4.4-2.4 4.4S15.2 8.9 15.2 6.5a2.4 2.4 0 0 1 4.8 0z"/>' +
              '<path d="M8 18.5c3.5 1.6 7 .6 9-2" stroke-dasharray="2 3"/>',
    /* a flag planted */
    marks:    '<path d="M6 21V4"/><path d="M6 4.5h11l-2.6 3.6L17 12H6z" fill="currentColor" fill-opacity=".22"/>',
    /* an open book */
    guestbook:'<path d="M12 6.5C10.2 5 7.6 4.4 4 4.6v13c3.6-.2 6.2.4 8 1.9 1.8-1.5 4.4-2.1 8-1.9v-13c-3.6-.2-6.2.4-8 1.9z"/>' +
              '<path d="M12 6.5v12.9"/>',
    /* chain links */
    links:    '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.5 6.8"/>' +
              '<path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
    /* an hourglass */
    since:    '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9"/>' +
              '<path d="M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    /* a tally */
    count:    '<path d="M5 20V9M10 20V4M15 20v-8M20 20V6"/>',
    /* ── THE FOUR THE PICKER EXPOSED ──────────────────────────────────
       ★ MEASURED 2026-09-12 in the Add sheet: ten of fifteen rows carried a
         mark and five did not, and a gallery where some rows have one and
         some do not reads as broken rather than as restrained.

       These four are the CLIENT-DRAWN kinds. On a tile each draws a real
       instrument — a clock face, a date medallion, a post — and the
       instrument IS the mark, which is why none of them ever needed a glyph
       and why none was noticed missing. The picker has no instrument to draw,
       because a preview there would need a live read before the person has
       chosen anything. So they get the mark they never needed until now.

       DRAWN IN THE EXISTING HAND: 24x24, 1.5 stroke, no fill except where the
       set already fills a small solid to mark a focal point. `clock` and
       `countdown` are both round and are deliberately told apart by what is
       INSIDE — hands that tell you the time, against a ring that is winding
       down and tells you how much is left. */
    /* a stack, the newest on top */
    posts:    '<rect x="6" y="7.5" width="14" height="12" rx="2.6"/>' +
              '<path d="M4 15.5V6.2A2.2 2.2 0 0 1 6.2 4h9.3" opacity=".5"/>' +
              '<path d="M9.5 12h7M9.5 15.4h4.4"/>',
    /* something going on right now — a source and what is coming off it */
    happening:'<circle cx="8" cy="12" r="2.4" fill="currentColor" stroke="none"/>' +
              '<path d="M12.6 8.2a5.4 5.4 0 0 1 0 7.6"/>' +
              '<path d="M16 4.8a10.2 10.2 0 0 1 0 14.4" opacity=".45"/>',
    /* a ring winding down */
    countdown:'<circle cx="12" cy="12" r="8.6" opacity=".35"/>' +
              '<path d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6"/><path d="M12 8.4V12"/>',
    /* the time, told by hands */
    clock:    '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2"/>',
    /* overlapping pigment */
    colours:  '<circle cx="9.2" cy="10" r="5.2" fill="currentColor" fill-opacity=".22"/>' +
              '<circle cx="14.8" cy="10" r="5.2" fill="currentColor" fill-opacity=".22"/>' +
              '<circle cx="12" cy="15" r="5.2" fill="currentColor" fill-opacity=".22"/>',
    /* a star */
    favourite:'<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z"/>',
    /* speech, with the quote inside it */
    said:     '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-4.2A8 8 0 1 1 21 12z"/>' +
              '<path d="M9 10.5h1.6M13.4 10.5H15" stroke-linecap="round"/>',
    /* a waveform */
    rhythm:   '<path d="M3 12h2.4l2-5.5 2.6 12L13 8l2 6 1.6-3H21" stroke-linejoin="round"/>'
  };

  function glyph(ref) {
    var d = GLYPH[ref];
    if (!d) { return null; }
    var g = doc.createElement('span');
    g.className = 'ow-gl ow-gl--' + esc(ref);
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<svg viewBox="0 0 24 24" class="ow-gl-svg" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' + d + '</svg>';
    return g;
  }

  /* THE SAME RULE `popits.size_of` APPLIES, and it has to be the same rule or
     the tile and its projection disagree about what they are. The family is
     square-celled — small 3x3 · wide 6x3 · large 6x6 · full 12x6 — and density
     is deliberately UNCHANGED by that: only `full` was ever `lg`, and only
     `full` is now. Width is in the rule because area cannot see it: a 12x3
     strip and a 6x6 square are both area 36 and only one is 870px wide. */
  function depthOf(it) {
    var w = it.w || 3, h = it.h || 2;
    var area = w * h;
    if (area <= 9) { return 'sm'; }
    if (w >= 12 || area >= 48 || (w >= 8 && h >= 4)) { return 'lg'; }
    return 'md';
  }

  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                'JUL','AUG','SEP','OCT','NOV','DEC'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function whenParts(iso) {
    var out = { mon: '', day: '', weekday: '', full: '', days: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) { return out; }
    var t = Date.parse(iso + 'T00:00:00Z');
    if (isNaN(t)) { return out; }
    var d = new Date(t);
    out.mon = MONTHS[d.getUTCMonth()];
    out.day = String(d.getUTCDate());
    out.weekday = DAYS[d.getUTCDay()];
    out.full = out.weekday + ' ' + out.day + ' ' +
               ['January','February','March','April','May','June','July','August',
                'September','October','November','December'][d.getUTCMonth()] +
               ' ' + d.getUTCFullYear();
    out.days = Math.max(0, Math.round((t - Date.now()) / 86400000));
    return out;
  }

  /* ══ NEXT — THE EVENT POPIT ════════════════════════════════════════════
     ★ FOUNDER, 2026-08-25: *"designing the front with a DOMINATING ICON and
       information cleanly laid out, then opened into the hologram expanded
       informational surface."*

     THE FRONT. A date medallion large enough to be the object rather than an
     ornament beside the text: month above, day of the month as the face, and a
     ring wound to how near the Event actually is. Everything else is a clean
     column beside it — title, then time and place in one quiet line, then who
     is going. Read the medallion and you already know it is a dated thing that
     is close; read one more line and you know which. */
  function frontNext(live) {
    var w = whenParts(live.signal);
    var wrap = doc.createElement('span');
    wrap.className = 'ow-po ow-po--next';

    var med = doc.createElement('span');
    med.className = 'ow-med';
    var C = 2 * Math.PI * 45;
    var frac = w.days === null ? 0 : Math.max(0.05, Math.min(1, 1 - (w.days / 60)));
    med.innerHTML =
      '<svg class="ow-med-svg" viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="ow-med-track" cx="50" cy="50" r="45"/>' +
        '<circle class="ow-med-arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)" ' +
          'stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
      '</svg>' +
      '<span class="ow-med-mon">' + esc(w.mon) + '</span>' +
      '<span class="ow-med-day">' + esc(w.day) + '</span>';

    /* ── A CANCELLED EVENT MUST NOT READ LIKE A LIVE ONE ──────────────────
       ★ MEASURED 2026-09-08 on a real Centre's public face: this tile drew
       "SEP 12 · Boardwalk Concert · 23:00" for an event that had been
       CANCELLED, with no sign whatever. `cancelled` is a PUBLIC state on
       purpose — somebody who planned around an evening needs to learn it is
       off — and the row simply did not carry the state, so every consumer drew
       it exactly like a live one. That is the most confident possible way to
       be wrong about a person's evening.

       IT REPLACES THE TIME RATHER THAN SITTING BESIDE IT, because the time is
       precisely the part that is no longer true. A struck-through hour with a
       label next to it asks the reader to do the reasoning; "Cancelled" does
       not. */
    var offState = (live.state && live.state !== 'scheduled' && live.state !== 'live')
      ? (live.state === 'cancelled' ? 'Cancelled'
         : live.state === 'ended' ? 'Ended' : String(live.state))
      : '';

    var col = doc.createElement('span');
    col.className = 'ow-po-col';
    col.innerHTML =
      '<span class="ow-po-title">' + esc(live.detail || 'Event') + '</span>' +
      (offState
        ? '<span class="ow-po-line ow-po-off"><b>' + esc(offState) + '</b></span>'
        : '') +
      '<span class="ow-po-line"' + (offState ? ' hidden' : '') + '>' +
        (live.time ? '<b>' + esc(live.time) + '</b>' : '') +
        (live.time && live.location ? '<i>·</i>' : '') +
        (live.location ? esc(live.location) : '') +
      '</span>' +
      (typeof live.going === 'number'
        ? '<span class="ow-po-foot"><span class="ow-po-dot"></span>' +
          esc(live.going + (live.going === 1 ? ' going' : ' going')) + '</span>'
        : '') +
      (w.days !== null
        ? '<span class="ow-po-foot ow-po-foot--soft">' +
          (w.days === 0 ? 'Today' : w.days === 1 ? 'Tomorrow' : 'in ' + w.days + ' days') +
          '</span>'
        : '');

    wrap.appendChild(med);
    wrap.appendChild(col);
    return wrap;
  }

  /* THE OPEN STATE — a hologram expanded informational surface.
     ★ FOUNDER: *"then opened into the hologram expanded informational
       surface."*

     Not the generic widget sheet and not a jump straight to the Event page. The
     Popit EXPANDS: the medallion grows and stays the anchor, the information it
     was summarising opens out beneath it, and the actions sit at the bottom.
     The galaxy stays behind it — `po-locked` already fades the App and lifts
     the world, so this surface is projected onto the environment rather than
     covering it.

     THE CANONICAL OBJECT IS STILL ONE PRESS AWAY. This is the expanded reading,
     not a replacement for the Event; "Open Event" walks you into the real
     thing, which is the same destination the shell already routes. */
  /* ══ THE OPENED EVENT ═══════════════════════════════════════════════════
     ★ FOUNDER, 2026-09-08: *"an event... make it a first class object on
       oneway with features information and presentation. nothing in the app
       should have brief info when its popit is opened."*

     THIS PANEL WAS THE BRIEF INFO HE MEANT. It showed a medallion, a title, a
     date line and a button — and the call site handed it `description: ''`,
     `performers: []` and `centers: []` HARDCODED, so three of the fields it
     could already draw were empty by construction. Meanwhile the Event object
     carries nineteen: an end time, a mode, a venue, a place, an online url, a
     cover image, a description, performers, a host, a state and RSVP counts.

     HOW OTHER PLATFORMS TREAT AN EVENT — the anatomy is remarkably settled
     across Facebook Events, Eventbrite and Luma, and it is: a cover image, the
     title, the FULL time (start AND end, not just a date), where — a real place
     or a link for an online one — WHO IS HOSTING, the description, who is
     going, and one obvious act. ONEWAY already stores every one of those.

     SO THE PANEL NOW READS THE WHOLE OBJECT. `/api/oneway/events/{id}` answers
     anonymously with `event`, `when`, `counts`, `capacity` and `you`, so a
     stranger gets the same page a member does, minus what is theirs.

     IT PAINTS TWICE ON PURPOSE. What the tile already knows — the medallion,
     the title, the date — is drawn synchronously, so opening is instant and
     never a spinner over a blank sheet; the rest arrives and fills in. A person
     who taps a concert should see the concert immediately.

     AND IT SAYS WHEN IT CANNOT SAY. `when.readable` is false with a REASON when
     the Centre has no location — "the Center this event belongs to has not been
     placed" — so the panel prints the reason instead of inventing a local time.
     Founder, on the countdown: never invent a time. */
  function expandNext(live) {
    var w = whenParts(live.signal);
    var C = 2 * Math.PI * 45;
    var frac = w.days === null ? 0 : Math.max(0.05, Math.min(1, 1 - (w.days / 60)));

    var el = doc.createElement('div');
    el.className = 'ow-ex ow-ex--next';

    var cover = doc.createElement('div');
    cover.className = 'ow-ex-cover';
    cover.hidden = true;
    el.appendChild(cover);

    var head = doc.createElement('div');
    head.className = 'ow-ex-head';
    head.innerHTML =
      '<span class="ow-med ow-med--big">' +
        '<svg class="ow-med-svg" viewBox="0 0 100 100" aria-hidden="true">' +
          '<circle class="ow-med-track" cx="50" cy="50" r="45"/>' +
          '<circle class="ow-med-arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)" ' +
            'stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
        '</svg>' +
        '<span class="ow-med-mon">' + esc(w.mon) + '</span>' +
        '<span class="ow-med-day">' + esc(w.day) + '</span>' +
      '</span>' +
      '<span class="ow-ex-id">' +
        '<span class="ow-ex-kind">Event</span>' +
        '<h2 class="ow-ex-title">' + esc(live.detail || 'Event') + '</h2>' +
        /* ── ONE TIME, NOT TWO ────────────────────────────────────────────
           THE PANEL STATED TWO DIFFERENT START TIMES. This line printed the
           raw stamp off the tile — "23:00" — while the WHEN fact below printed
           the same instant resolved to the reader's own clock, "7:00 PM". Same
           event, same panel, two answers, and a person deciding when to leave
           had no way to tell which one to believe.

           The header keeps a placeholder that the full read replaces, and the
           WHEN fact is the single authority: it knows the end, the duration
           and the reader's timezone, and this line knew none of them. */
        '<p class="ow-ex-when"></p>' +
      '</span>';
    el.appendChild(head);

    var body = doc.createElement('div');
    body.className = 'ow-ex-body-wrap';
    el.appendChild(body);

    var acts = doc.createElement('div');
    acts.className = 'ow-ex-acts';
    el.appendChild(acts);

    /* ── THE WHOLE OBJECT ─────────────────────────────────────────────── */
    function fill(d) {
      var e = (d && d.event) || {};
      var when = (d && d.when) || {};
      var counts = (d && d.counts) || {};

      /* ── A COVER THAT DOES NOT LOAD IS NOT A COVER ────────────────────
         This checked that the FIELD was set and showed the box. The fixture
         event carried a path to an image that does not exist, so the panel
         opened on a large empty rectangle — which is precisely the thing the
         comment on `.ow-ex-cover` says is worse than no photo. I wrote that
         sentence and then shipped it, because "has a url" and "has a picture"
         are not the same fact and only one of them can be checked from here.

         So it is loaded first and revealed on success. A broken or missing
         image simply leaves the panel without a cover, which is what an event
         with no picture already looks like. */
      if (e.cover_image_url) {
        var probe = new global.Image();
        probe.onload = function () {
          cover.hidden = false;
          cover.style.backgroundImage =
            'url("' + String(e.cover_image_url).replace(/"/g, '') + '")';
        };
        probe.src = e.cover_image_url;
      }
      if (e.title) {
        var h2 = el.querySelector('.ow-ex-title');
        if (h2) { h2.textContent = e.title; }
      }
      /* THE STATE IS PART OF THE OBJECT. A draft opened by its operator should
         say so rather than looking published. */
      if (e.state && e.state !== 'scheduled') {
        var k = el.querySelector('.ow-ex-kind');
        if (k) { k.textContent = 'Event · ' + e.state; }
      }

      body.innerHTML = '';

      /* WHEN — the full span, not a date. An end time is information a person
         plans around, and it was being thrown away. */
      var whenLine = fullWhen(e);
      if (whenLine) {
        body.appendChild(exRow('when', 'When', whenLine));
        /* the header says how near, the fact says exactly when — two different
           questions, so they do not repeat each other */
        var wp = el.querySelector('.ow-ex-when');
        if (wp) { wp.textContent = nearness(e.starts_at); }
      }
      if (when.readable === false && when.why) {
        body.appendChild(exNote(when.why));
      }

      /* WHERE — a real place, or the link for an online one. Never both. */
      if (e.mode === 'online' || (!e.place && e.online_url)) {
        if (e.online_url) { body.appendChild(exRow('online', 'Where', 'Online')); }
      } else if (e.place) {
        body.appendChild(exRow('place', 'Where', e.place));
      }

      if (Array.isArray(e.performers) && e.performers.length) {
        body.appendChild(exRow('who', 'Who', e.performers.join(' · ')));
      }
      if (counts && typeof counts.going === 'number' && counts.going > 0) {
        body.appendChild(exRow('going', 'Going',
          counts.going + (counts.going === 1 ? ' person' : ' people')));
      }
      if (e.description) {
        var p = doc.createElement('p');
        p.className = 'ow-ex-body';
        p.textContent = e.description;
        body.appendChild(p);
      }

      /* ── AND YOU CAN ANSWER IT ────────────────────────────────────────
         ★ FOUNDER, 2026-09-08: a first-class Event with *"features
           information and presentation"* — this is the feature. An Event you
         can read and cannot answer is a poster, not an event.

         IT ACTS THROUGH THE ONE PATH EVERY POPIT ACTS THROUGH. The material
         announces and the live layer carries out: this dispatches `ow:act`
         with `ways`, exactly as a room's control does, so `OW.act` performs
         the request with its optimistic label and its undo, and there remains
         exactly ONE place a Popit can change reality and one place to audit.
         No second HTTP call is written here.

         `body` is a FUNCTION of the direction, which the act helper documents
         as the reason it survives a lost reply: "going" and "not" are
         idempotent however many times they arrive, where a bare "toggle" flips
         a person back when a retry lands.

         SHOWN ONLY TO SOMEBODY WHO CAN ANSWER. A signed-out reader gets the
         count and no control — a button that always 401s is a dead control,
         and the runtime already refuses cancelled, ended and full events, so
         those refusals surface as themselves rather than as a broken button. */
      var signedIn = !!(OW.data && OW.data.me && OW.data.me());
      var going = (d && d.you) === 'going';
      acts.innerHTML =
        (signedIn && e.state === 'scheduled'
          ? '<button type="button" class="ow-ex-go" data-po-act="rsvp"' +
            ' aria-pressed="' + (going ? 'true' : 'false') + '">' +
            (going ? 'Going' : 'Going?') + '</button>'
          : '') +
        '<button type="button" class="' + (signedIn ? 'ow-ex-alt' : 'ow-ex-go') +
          '" data-go="event">Open Event</button>' +
        (e.online_url
          ? '<button type="button" class="ow-ex-alt" data-go="online">Join online</button>'
          : (e.place
              ? '<button type="button" class="ow-ex-alt" data-go="here">Get Here</button>'
              : ''));
      el._ways = [{
        verb: 'rsvp',
        path: '/api/oneway/events/' + encodeURIComponent(e.id) + '/rsvp',
        undoPath: '/api/oneway/events/' + encodeURIComponent(e.id) + '/rsvp',
        body: function (on) { return { answer: on ? 'going' : 'not' }; },
        label: 'Going?', labelOn: 'Going'
      }];
    }

    /* what the tile already knows, drawn now — opening is never a blank sheet */
    if (live.location) { body.appendChild(exRow('place', 'Where', live.location)); }
    acts.innerHTML = live.event_id
      ? '<button type="button" class="ow-ex-go" data-go="event">Open Event</button>' : '';

    if (live.event_id) {
      req('/api/oneway/events/' + encodeURIComponent(live.event_id))
        .then(function (r) {
          if (r && r.ok !== false && r.data) { fill(r.data); }
          else { body.appendChild(exNote('The rest of this event could not be loaded.')); }
        })
        .catch(function () {
          body.appendChild(exNote('The rest of this event could not be loaded.'));
        });
    }
    return el;
  }

  /* one labelled fact */
  function exRow(kind, label, value) {
    var r = doc.createElement('div');
    r.className = 'ow-ex-fact';
    r.setAttribute('data-t', kind);
    r.innerHTML = '<span class="ow-ex-lbl">' + esc(label) + '</span>' +
                  '<span class="ow-ex-val">' + esc(String(value)) + '</span>';
    return r;
  }
  function exNote(text) {
    var n = doc.createElement('p');
    n.className = 'ow-ex-note';
    n.textContent = text;
    return n;
  }

  /* HOW NEAR, WHICH IS A DIFFERENT QUESTION FROM WHEN. The medallion already
     answers "is this close"; this says it in words for anyone who does not read
     a ring. It never competes with the WHEN fact because it never states a
     time. */
  function nearness(startsAt) {
    var a = startsAt ? new Date(startsAt) : null;
    if (!a || isNaN(a.getTime())) { return ''; }
    var days = Math.round((a - new Date()) / 86400000);
    if (days < 0) { return 'Already happened'; }
    if (days === 0) { return 'Today'; }
    if (days === 1) { return 'Tomorrow'; }
    if (days < 7) { return 'In ' + days + ' days'; }
    if (days < 14) { return 'Next week'; }
    return 'In ' + Math.round(days / 7) + ' weeks';
  }

  /* ── THE WHOLE SPAN, IN A PERSON'S WORDS ──────────────────────────────
     A date is not a time and a start is not a span. This prints the day, the
     start, and — when there is one — the end and how long it runs, because
     "23:00" and "23:00 until 02:30, three and a half hours" are different
     facts and only the second one lets somebody plan.

     IT NEVER INVENTS AN END. An empty `ends_at` prints a start and stops. */
  function fullWhen(e) {
    var a = e.starts_at ? new Date(e.starts_at) : null;
    if (!a || isNaN(a.getTime())) { return ''; }
    var day = '', t1 = '', t2 = '';
    try {
      day = a.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      t1 = a.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (x) { return ''; }
    var b = e.ends_at ? new Date(e.ends_at) : null;
    if (!b || isNaN(b.getTime())) { return day + ' · ' + t1; }
    try { t2 = b.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    catch (x2) { return day + ' · ' + t1; }
    var mins = Math.round((b - a) / 60000);
    var howLong = '';
    if (mins > 0) {
      var h = Math.floor(mins / 60), m = mins % 60;
      howLong = h ? (h + 'h' + (m ? ' ' + m + 'm' : '')) : (m + 'm');
    }
    return day + ' · ' + t1 + ' until ' + t2 + (howLong ? ' · ' + howLong : '');
  }


  /* One surface, mounted over the App, closed by tapping away or Escape. The
     App's own `po-locked` class does the receding — the same projection every
     opened Popit gets, so this is not a second way of opening something. */
  function expand(build) {
    var back = doc.createElement('div');
    back.className = 'ow-ex-back';
    var panel = build();
    back.appendChild(panel);
    doc.body.appendChild(back);
    doc.body.classList.add('po-locked');
    var close = function () {
      if (back.parentNode) { back.parentNode.removeChild(back); }
      doc.body.classList.remove('po-locked');
      doc.removeEventListener('keydown', onKey);
    };
    function onKey(e) { if (e.key === 'Escape') { close(); } }
    back.addEventListener('click', function (e) { if (e.target === back) { close(); } });
    doc.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { back.classList.add('is-on'); });
    return { el: panel, close: close };
  }

  /* ═══ THE CLOCK ═══════════════════════════════════════════════════════════
     ★ FOUNDER, 2026-08-26: *"start simple with things like clocks set to time
       zones that look good and expand when people resize them."*

     ONE COMPONENT, FOUR DENSITIES — never four components. §11 of the spec:
     *"DO NOT TREAT SIZE AS THREE DIFFERENT COMPONENTS. Size controls density."*
     So the same element is built once and asks how much room it has:

         1 row      the time. Nothing else fits, and nothing else is needed.
         2 rows     the time and where it is.
         3 rows     + the day and date.
         4+ rows    + a sweep dial and seconds — the size where a clock can
                    afford to be a clock rather than a readout.

     IT IS USEFUL CLOSED, which is the rule for every Popit: even at one row it
     says 9:42 PM, not "CLOCK".

     THE ZONE IS THE POPIT'S OWN CONFIG, so two Clocks on one Home are two
     places and not one type rendered twice — the founder's own example of why
     multiple instances of a type must work.

     TICKS ON THE MINUTE UNLESS SECONDS ARE SHOWN. A second-by-second repaint
     for a face that only displays minutes is the cost law broken for nothing,
     and dozens of Popits share one surface. */
  function clockFace(cfg, w, h) {
    cfg = cfg || {};
    var tz = cfg.tz || 'UTC';
    var wants24 = cfg.format === '24';
    var mode = cfg.face || 'digital';          /* digital · analog · both */
    var box = doc.createElement('span');
    box.className = 'ow-clk';
    /* DENSITY IS AN ATTRIBUTE — the CSS decides layout, this decides what
       exists. §11: size controls density, never which component renders.

       ★ IT IS MEASURED ON BOTH AXES. Founder, 2026-08-30: *"they cannot appear
         appear broken when resized or stretched."*

       THIS READ HEIGHT ONLY, and height alone is not how much room there is. A
       2-wide, 4-tall Popit scored `xl` — a full dial, sixty ticks, numerals and
       seconds — inside a sliver, and measured on the live document three of its
       elements were clipped. A 1x1 overflowed its tile by three. Every other
       Popit kind survived all ten shapes; this was the only one, and it was this
       line.

       THE LIMITING DIMENSION WINS, which is the only rule that holds for a tile
       the person can drag to any proportion. A wide-and-short tile and a
       tall-and-narrow one are both small — they are just small in different
       directions — and the component that fits is the one sized to whichever
       direction ran out first. */
    var tier = ['s', 'm', 'l', 'xl'];
    var byH = h >= 4 ? 3 : (h >= 3 ? 2 : (h >= 2 ? 1 : 0));
    var byW = w >= 6 ? 3 : (w >= 4 ? 2 : (w >= 3 ? 1 : 0));
    var dense = tier[Math.min(byH, byW)];
    box.setAttribute('data-d', dense);
    /* A PORTRAIT TILE STACKS. Side by side, a dial and a readout need width;
       when the tile is taller than it is wide they go one above the other
       rather than each getting half of a narrow box. */
    if (h * 2 > w * 3) box.setAttribute('data-stack', '1');
    box.setAttribute('data-face', mode);
    /* ★ A CHOICE IS HONOURED AT EVERY SIZE.
       ★ FOUNDER, 2026-08-30: *"the moment a setting for the popit is clicked,
         the popit itself should change no snap back to an alternive thing."*

       THIS LINE WAS THE SNAP-BACK. `&& dense !== 's'` meant that choosing Dial
       on a small Popit showed a dial for about four hundred milliseconds — the
       optimistic redraw — and then the save's re-render, now measuring the real
       packed size, scored it `s` and drew DIGITS. The stored setting still said
       `analog`. The person asked for a dial, watched one appear, and was given
       something else.

       IT ALSO BROKE §11 IN THE PROJECT'S OWN WORDS: *"size controls density,
       never which component renders."* Suppressing the dial is size choosing
       the component, which is the one thing that rule forbids.

       So the dial is always drawn when it is asked for, and SIZE DECIDES HOW
       MUCH OF IT: at `xl` sixty ticks and four numerals, at `l`/`m` the twelve
       hours, at `s` the rim and the hands alone — which is still unmistakably a
       clock face and is what a small analogue watch actually looks like. */
    var showDial = (mode === 'analog' || mode === 'both');
    var digitsOnly = mode === 'analog' && showDial;
    /* SECONDS NEED ROOM, AND ASKING FOR THEM IS NOT THE SAME AS HAVING IT.
       `cfg.seconds` forced them at every size, so a one-column Popit tried to
       fit "3:47:22 PM" across ~80px and clipped — the last two breaks in a
       256-shape sweep were both this. The person's choice is honoured the
       moment there is space to honour it, which is the same rule the dial
       already follows two lines below. §11: size controls density. */
    /* SECONDS ARE THE FIRST THING TO GO, and the last thing to come back —
       they are the least informative digit on the face and the most expensive
       in width. The ladder decides; the person's choice is honoured wherever
       there is room to honour it. */
    var showSeconds = (cfg.seconds && dense !== 's' && dense !== 'm') || dense === 'xl';

    if (showDial) {
      var dial = svgEl('svg', { viewBox: '0 0 100 100', class: 'ow-clk-dial' });
      dial.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 46, class: 'ow-clk-rim' }));
      /* SIXTY TICKS, TWELVE OF THEM LONGER — the thing that separates a clock
         from a circle with sticks in it. */
      for (var i = 0; i < 60; i++) {
        var major = i % 5 === 0;
        /* ★ A DIAL WITHOUT HOURS IS A CIRCLE WITH STICKS IN IT.
           ★ FOUNDER, 2026-08-30: *"The Clock losing detail is unacceptable…
             preserve the clock face/dial… compress the presentation, but
             preserve the identity of the widget."*

           I had dropped EVERY tick at `s`, leaving a rim and two hands — which
           is the exact "stripped to a useless number" failure, in dial form.
           The twelve hour marks are what make a circle read as a clock at a
           glance, and they cost twelve line elements. They stay at every size;
           only the sixty minute ticks and the numerals are a density decision. */
        if (!major) { if (dense !== 'xl') continue; }
        var ang = i * 6 * Math.PI / 180;
        var r1 = major ? 36 : 40, r2 = 44;
        dial.appendChild(svgEl('line', {
          x1: (50 + Math.sin(ang) * r1).toFixed(2),
          y1: (50 - Math.cos(ang) * r1).toFixed(2),
          x2: (50 + Math.sin(ang) * r2).toFixed(2),
          y2: (50 - Math.cos(ang) * r2).toFixed(2),
          class: major ? 'ow-clk-tick ow-clk-tick--h' : 'ow-clk-tick' }));
      }
      /* HOUR NUMERALS at the size that can hold them. Twelve, three, six and
         nine only — a full set of twelve at this scale is noise, and these four
         are the ones the eye actually uses to orient. */
      if (dense === 'xl') {
        [[12, 50, 22], [3, 76, 53.5], [6, 50, 85], [9, 24, 53.5]].forEach(function (n2) {
          var t = svgEl('text', { x: n2[1], y: n2[2], class: 'ow-clk-num' });
          t.textContent = n2[0];
          dial.appendChild(t);
        });
      }
      /* PROPORTIONS ARE WHAT MAKE IT READ AS A CLOCK. The hour hand is short
         and heavy, the minute long and lighter, the second a hairline — and
         each carries a small tail past the pivot, which is what stops them
         looking like spokes. Ratios against a 46 radius: .48 / .74 / .82. */
      var hh = svgEl('line', { x1: 50, y1: 57, x2: 50, y2: 28, class: 'ow-clk-hand ow-clk-hand--h' });
      var mm = svgEl('line', { x1: 50, y1: 59, x2: 50, y2: 16, class: 'ow-clk-hand ow-clk-hand--m' });
      dial.appendChild(hh); dial.appendChild(mm);
      var ss = null;
      if (showSeconds) {
        ss = svgEl('line', { x1: 50, y1: 62, x2: 50, y2: 12, class: 'ow-clk-hand ow-clk-hand--s' });
        dial.appendChild(ss);
      }
      /* the cap covers all three pivots, so the hands meet cleanly */
      dial.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 3.4, class: 'ow-clk-cap' }));
      if (showSeconds) {
        dial.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 1.5, class: 'ow-clk-pin' }));
      }
      box.appendChild(dial);
      box._hands = { h: hh, m: mm, s: ss };
    }

    /* ── THE PLACE LEADS. ALWAYS. ─────────────────────────────────────────
       ★ FOUNDER, 2026-08-30: *"Never make the user wonder where the time is
         coming from. The location should be explicit."*

       The place was under the time in small caps — legible, but secondary, and
       on the smallest size it was dropped entirely, which left a bare "4:41 AM"
       floating on a Home with three other clocks. A time with no place is not a
       world clock, it is a number.

       So the city is FIRST at every density, and the only thing that ever gets
       dropped is detail below it:

         tiny    NEW YORK / 10:52
         small   NEW YORK / 10:52 / EDT
         medium  NEW YORK / 10:52 / 1h behind you
         large   NEW YORK / 10:52 / EDT · Aug 30 / 1 hour behind you   */
    /* ═══ THE LADDER IS A PRODUCT RULE, NOT A CSS TWEAK ═══════════════════
       ★ FOUNDER, 2026-08-30, and this is the contract:

           large    10:43 PM · ATLANTIC CITY · EDT · AUG 31
           medium   10:43 PM · Atlantic City · EDT
           small    10:43    · ATLANTIC CITY

       TIME AND PLACE ARE NEVER DROPPED. Everything else — the zone, the date,
       the relative line, the seconds — is what compresses. A Clock that has
       been reduced to a bare number has stopped being this widget; the founder
       called that unacceptable and he is right, because "10:43" without a place
       is the one thing a phone's own clock already tells you.

       So the elements are built from the ladder rather than from a scatter of
       size conditions, and `s` still gets both of the two that matter. */
    var LADDER = {
      s:  { city: true, time: true, zone: false, date: false, rel: false },
      m:  { city: true, time: true, zone: true,  date: false, rel: false },
      l:  { city: true, time: true, zone: true,  date: true,  rel: true },
      xl: { city: true, time: true, zone: true,  date: true,  rel: true }
    };
    var show = LADDER[dense] || LADDER.m;

    var read = doc.createElement('span');
    read.className = 'ow-clk-read';
    read.innerHTML =
        '<span class="ow-clk-city"></span>'
      + (digitsOnly ? '' : '<b class="ow-clk-t"></b>')
      + ((show.zone || show.date) ? '<span class="ow-clk-meta"></span>' : '')
      + (show.rel ? '<span class="ow-clk-o"></span>' : '');
    box.appendChild(read);

    function fmt(d, o) {
      try { return new Intl.DateTimeFormat(undefined,
        Object.assign({ timeZone: tz }, o)).format(d); } catch (e) { return ''; }
    }
    function parts(d) {
      /* ── THE LAST RUNG OF THE CLOCK'S LADDER IS THE CLOCK FACE ITSELF ───
         ★ FOUNDER, 2026-09-03: *"one universal plane sizes of popits and order
           shouldnt change whatsoever."*

         Under one plane a 3-wide Popit is about 71px on a 360px phone — 45px
         of content — and "10:18 PM" wants 50px at the smallest size the ladder
         offers. It was drawing past its box: not truncated, because nothing
         truncates any more, but not inside the tile either, which is the same
         fault in a different costume.

         The ladder already drops the zone, the date and the relative line in
         turn. This is the step it was missing: at the width where the meridiem
         does not fit, the clock reads 24-hour. "22:18" is five characters
         against eight, it is unambiguous, and it is a real convention rather
         than an abbreviation — which is why this is a rung and not a
         truncation. A person who chose 12-hour keeps it everywhere it fits. */
      /* MEASURED IN PIXELS, AND RE-ASKED ONCE THERE ARE ANY.
         Two wrong answers before this one, both worth keeping:
           · `box.clientWidth` alone is 0 on the first paint, so the clock drew
             12-hour past its box and only corrected on the next minute's tick.
           · columns instead — `w <= 3` — is stable but WRONG, because under one
             universal plane three columns is 71px on a phone and 137px on a
             desktop. It made every 3-wide clock 24-hour everywhere, including
             where there was room for the meridiem. Measured: "22:20" at 1440.
         The question is how many PIXELS this clock has, so that is what is
         asked; `_refit` below re-runs the tick once layout exists, which is
         what makes the first paint self-correct rather than wait a minute. */
      var px = 0;
      try { px = box.clientWidth || box.getBoundingClientRect().width || 0; }
      catch (e) {}
      var narrow = px > 0 && px < 92;
      var o = { hour: 'numeric', minute: '2-digit',
                hour12: !wants24 && !narrow };
      if (showSeconds) o.second = '2-digit';
      return fmt(d, o);
    }
    /* THE ZONE'S OWN WALL-CLOCK PIECES, for the hands. Derived from Intl so a
       daylight-saving change is right without this file knowing the rules. */
    function zoned(d) {
      try {
        var p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false,
          hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d);
        var o = {};
        p.forEach(function (x) { if (x.type !== 'literal') o[x.type] = parseInt(x.value, 10); });
        return o;
      } catch (e) { return null; }
    }
    /* ── THE ZONE'S OWN NAME, DERIVED — NEVER STORED ──────────────────────
       ★ FOUNDER: *"DST needs to be completely automatic... The location is
         canonical; the displayed UTC offset is derived."*

       `EDT` and `EST` are the same place in different months. Storing either
       would mean a clock that is wrong for half the year and needs somebody to
       remember to fix it. Only `America/New_York` is stored; the abbreviation
       and the offset are asked of Intl every tick, so the changeover happens
       on its own and nothing here knows the rules. */
    function zoneAbbr(d) {
      try {
        var p = new Intl.DateTimeFormat('en-US',
          { timeZone: tz, timeZoneName: 'short' }).formatToParts(d);
        var n2 = (p.filter(function (x) { return x.type === 'timeZoneName'; })[0] || {}).value || '';
        /* Intl gives "GMT+9" for zones with no common abbreviation. That is a
           real answer and better than blank, but it is not a NAME, so it is
           shown only where there is room for it to be understood. */
        return n2;
      } catch (e) { return ''; }
    }
    /* ── THE RELATIONSHIP, ONLY WHEN IT SAYS SOMETHING ────────────────────
       ★ FOUNDER: *"Don't permanently display '1 hour behind you' when the
         relationship is obvious or unnecessary."*

       Same zone -> nothing at all, because a clock showing your own time does
       not need telling you so. A different DAY is the fact that actually
       catches people out when they are coordinating, so it leads when it is
       true: "Tomorrow · 12:52 AM". */
    function relation(d, short) {
      try {
        var here = new Date(d.toLocaleString('en-US'));
        var there = new Date(d.toLocaleString('en-US', { timeZone: tz }));
        var mins = Math.round((there - here) / 60000);
        if (Math.abs(mins) < 2) return '';
        var dayHere = new Intl.DateTimeFormat('en-CA').format(d);
        var dayThere = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
        var hrs = Math.abs(mins) / 60;
        var n2 = (hrs % 1 === 0) ? String(hrs) : hrs.toFixed(1).replace(/\.0$/, '');
        var word = short ? (n2 + 'h') : (n2 + (hrs === 1 ? ' hour' : ' hours'));
        /* "ahead OF you" but "behind you" — English does not take the
           preposition on both, and `dir + ' of you'` produced "9 hours behind
           of you". */
        var dir = mins > 0 ? (short ? 'ahead' : 'ahead of you')
                           : (short ? 'behind' : 'behind you');
        var rel = word + ' ' + dir;
        if (dayThere !== dayHere) {
          var which = dayThere > dayHere ? 'Tomorrow' : 'Yesterday';
          return short ? (which + ' · ' + rel) : (which + ' there · ' + rel);
        }
        return rel;
      } catch (e) { return ''; }
    }

    var tEl = read.querySelector('.ow-clk-t');
    var cEl = read.querySelector('.ow-clk-city');
    var mEl = read.querySelector('.ow-clk-meta');
    var oEl = read.querySelector('.ow-clk-o');

    /* ── THE TIME FITS, MEASURED RATHER THAN GUESSED ───────────────────────
       A ratio of the container cannot suit every clock: "9:42 PM" is seven
       characters and "01:26:43" is eight. At one fixed ratio the short ones
       waste the tile and the long ones CLIP — and a clipped clock shows the
       wrong time, which is the single failure a clock must not have. */
    var lastFit = '';
    function fit() {
      if (!tEl) return;
      /* THE WIDTH IS PART OF THE MEMO. Keyed on the text alone, this never ran
         again after the first paint — so a Popit dragged to a new size kept the
         font size it was measured at, which is exactly the "broken when
         resized" the founder reported. The CSS above now does the real work;
         this stays as the last line of defence and is no longer blind to a
         resize. */
      var txt = (tEl.textContent || '') + '@' + Math.round(tEl.clientWidth)
              + 'x' + Math.round(tEl.clientHeight);
      if (txt === lastFit) return;
      lastFit = txt;
      tEl.style.fontSize = '';
      var avail = tEl.clientWidth || (tEl.parentNode && tEl.parentNode.clientWidth) || 0;
      if (!avail) return;
      var want = tEl.scrollWidth;
      if (want <= avail) return;
      var base = parseFloat(getComputedStyle(tEl).fontSize) || 24;
      tEl.style.fontSize = Math.max(11, Math.floor(base * (avail / want) * 0.98)) + 'px';
    }

    function tick() {
      var now = new Date();
      var t = parts(now);
      var broken = !t;
      var city = cfg.label || tz.split('/').pop().replace(/_/g, ' ');
      if (cEl) cEl.textContent = broken ? 'Unknown place' : city;
      if (tEl) tEl.textContent = t || '—';
      if (broken) box.setAttribute('data-broken', ''); else box.removeAttribute('data-broken');
      var rel = broken ? '' : relation(now, dense === 'm');
      if (mEl) {
        /* THE LINE UNDER THE TIME, sized to the room there is for it — and it
           never renders blank. At medium the relationship is the useful fact,
           but a clock in YOUR OWN zone has no relationship to state, so the
           zone's name takes the line instead of leaving a gap. */
        /* BUILT FROM THE LADDER, not from a scatter of size conditions. The
           zone and the date are the two facts this line can carry; the ladder
           says which of them this size has earned, and they compose. */
        if (broken) mEl.textContent = 'that time zone is not one we know';
        else {
          var bits = [];
          if (show.zone) bits.push(zoneAbbr(now));
          if (show.date) bits.push(fmt(now, { month: 'short', day: 'numeric' }));
          /* at medium the RELATIONSHIP is the more useful of the two, but a
             clock in your own zone has none — so the zone keeps the line
             rather than leaving it blank */
          if (show.zone && !show.date && rel && dense === 'm') bits = [rel];
          mEl.textContent = bits.filter(Boolean).join(' · ');
        }
      }
      if (oEl) oEl.textContent = rel;
      if (box._hands) {
        var z = zoned(now);
        if (z) {
          var sec = z.second + now.getMilliseconds() / 1000;
          var min = z.minute + sec / 60;
          var hr = (z.hour % 12) + min / 60;
          box._hands.h.setAttribute('transform', 'rotate(' + (hr * 30) + ' 50 50)');
          box._hands.m.setAttribute('transform', 'rotate(' + (min * 6) + ' 50 50)');
          if (box._hands.s) box._hands.s.setAttribute('transform', 'rotate(' + (sec * 6) + ' 50 50)');
        }
      }
      fit();
    }
    tick();

    /* PARKED WITH THE TAB — canon §4. A clock nobody is looking at costs
       nothing. A dial with a second hand needs frames; everything else needs a
       tick a minute. */
    var timer = 0, raf = 0;
    var sweeping = !!(box._hands && box._hands.s);
    function schedule() {
      clearTimeout(timer);
      if (doc.hidden) return;
      if (sweeping) { raf = requestAnimationFrame(function () { tick(); schedule(); }); return; }
      var ms = showSeconds ? (1000 - (Date.now() % 1000)) : (60000 - (Date.now() % 60000));
      timer = setTimeout(function () { tick(); schedule(); }, ms + 5);
    }
    schedule();
    try {
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) { clearTimeout(timer); cancelAnimationFrame(raf); }
        else { tick(); schedule(); }
      });
    } catch (e) {}
    /* THE FORMAT IS PART OF THE FIT. `fit()` sizes the type; the meridiem is
       the other half of the same question, and it needs a real width too. */
    box._refit = function () { lastFit = ''; tick(); fit(); };
    try {
      if (global.ResizeObserver) {
        var ro = new ResizeObserver(function () { box._refit(); });
        ro.observe(box); box._ro = ro;
      }
    } catch (e) {}
    box._stop = function () {
      clearTimeout(timer); cancelAnimationFrame(raf); if (box._ro) box._ro.disconnect();
    };
    return box;
  }

  /* ═══ ONE SWIPE PAST THE ARRANGEMENT ════════════════════════════════════
     ★ FOUNDER, 2026-09-03: *"people should be able to scroll past their popit
       blocks at top of home in one swipe should feel like a different part of
       the app"* and *"natural swipe like on scroll not on feed only exception."*

     WHY THIS IS JAVASCRIPT AND NOT CSS, measured rather than assumed. I tried
     `scroll-snap-type: y proximity` and then `mandatory`, with the arrangement
     and the feed as the two stops. Neither pages past the block, and the reason
     is in the spec rather than in the values: A SNAP AREA LARGER THAN THE
     SNAPPORT DOES NOT FORCE ALIGNMENT — the reader may rest anywhere inside it.
     A Home arrangement measured 1905px against a 526px viewport, so the whole
     block is one oversized snap area and snapping correctly declines to move.
     Scroll feels right precisely because each of its pages IS one viewport.

     I also tried bounding the block to one screen with its own scroller. That
     was worse twice: it CLIPPED a Popit mid-tile — the cut content the founder
     has forbidden — and an inner scroller makes "swipe past" impossible, since
     the swipe scrolls the block instead of the page.

     So the gesture is handled. One decisive flick downward, while the
     arrangement still owns most of the screen, carries the page to the feed —
     and that is the ONLY thing it does. It never runs inside the feed (the
     founder's named exception), never on a small arrangement that a normal
     scroll already clears, never against a slow deliberate drag, and never
     when a person is arranging. Everything else is the browser's own scroll. */
  function homeSwipePast(host) {
    var doc2 = doc, root = doc.scrollingElement || doc.documentElement;
    var startY = 0, startAt = 0, tracking = false;

    function feedTop() {
      var sw = doc2.querySelector('.ow-feedswitch') || doc2.querySelector('.po-river');
      if (!sw) return 0;
      var r = sw.getBoundingClientRect();
      return Math.round(r.top + (global.scrollY || root.scrollTop || 0) - 6);
    }
    function armed() {
      /* only while the arrangement still owns the screen — once the feed is up,
         this is an ordinary page and the gesture has no business here */
      if (host.getAttribute('data-editing') === '1') return false;
      var top = feedTop();
      if (!top) return false;
      var y = global.scrollY || root.scrollTop || 0;
      var vh = global.innerHeight || 0;
      /* a block a normal scroll already clears does not need a shortcut */
      if (top - y < vh * 1.2) return false;
      return y < top;
    }
    function glide() {
      var to = feedTop();
      if (!to) return;
      try { root.scrollTo({ top: to, behavior: 'smooth' }); }
      catch (e) { root.scrollTop = to; }
    }
    doc2.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
      if (e.target && e.target.closest && e.target.closest('.po-river')) { tracking = false; return; }
      tracking = armed();
      startY = e.touches[0].clientY;
      startAt = Date.now();
    }, { passive: true });
    doc2.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = (e.changedTouches && e.changedTouches[0]);
      if (!t) return;
      var dy = startY - t.clientY;                 /* upward finger = scroll down */
      var ms = Date.now() - startAt;
      /* A FLICK, NOT A DRAG. Distance alone would fire on a slow deliberate
         scroll through somebody's Popits, which is a thing people do on their
         own Home. Velocity is what separates "take me past this" from
         "I am reading this". */
      if (dy > 60 && ms < 320 && (dy / ms) > 0.5) glide();
    }, { passive: true });
  }

  /* ═══ ONE SOCIAL READ PER SURFACE ═══════════════════════════════════════
     ★ FOUNDER, 2026-08-30, on the widget contract: *"Efficiency matters. Every
       widget should share one resolution of context rather than each asking
       for its own."*

     `context: ["social"]` in the capability spec is a CLAIM ON THIS READ. Two
     Latest Popits on one Home — a plausible arrangement, since one can be a
     Center's and one your own — must cost one request, not two, and must never
     show two different answers to the same question. The promise is cached by
     surface, so the second tile joins the first tile's read in flight.

     WHICH FEED IS NOT A GUESS. Measured 2026-09-02 against the canonical
     runtime, and confirmed by A who owns the Post material: a Center surface
     reads the canonical place feed, a person's Home reads their own. Both
     answer `{feed: [...]}` in the SAME Post shape, which is the whole reason
     one renderer can serve both. `experience.feed` is deliberately not read —
     A measured it the same day as a SECOND Center-feed implementation the App
     already ignores, and it is on the retire list. */
  var _social = {};
  /* THE DECLARED `refresh` IS THE CACHE, not a comment about one. `posts`
     declares 120 in its capability spec, so a read older than two minutes is
     retaken and anything newer is shared. Two tiles painting in the same frame
     share one request; a tile repainted after a drag ten seconds later shares
     it too; the same tile looked at after lunch does not. */
  /* ── A FAILED READ IS NOT AN EMPTY WORLD ────────────────────────────────
     All three shared reads ended `.catch(function () { return []; })` and none
     of them looked at `r.ok`. So a 500, a dropped connection and a Center with
     genuinely nothing on lately all arrived at the face as the same empty
     array — and the face then said NOTHING NEW, NOTHING HERE YET, NOT PLACED
     YET. Those are not blank spaces; they are POSITIVE CLAIMS about the world,
     made most confidently at exactly the moment the app knew least.

     The rule is already written down in this codebase, in project()'s own
     docstring: *"A REF THAT NO LONGER RESOLVES IS SAID OUT LOUD ... a card
     that quietly empties is indistinguishable from one that failed to load."*
     The server obeys it. These client reads did not.

     So a read now answers {ok, rows} — three states where there were two:

       ok:true,  rows:[...]   this is what is there
       ok:true,  rows:[]      there is genuinely nothing
       ok:false               we could not find out

     and the faces render the third differently from the second. The cache
     still holds one read per surface; what changed is that it can now cache
     "we do not know" without that curdling into "there is nothing".

     NOT CACHED ON FAILURE, deliberately. A 500 held for the full TTL would
     make a transient blip look like a stable emptiness for two minutes; the
     next paint should get to ask again. */
  function socialFeed(surface) {
    var spec = (_specs && _specs.posts) || {};
    var ttl = (typeof spec.refresh === 'number' ? spec.refresh : 120) * 1000;
    var hit = _social[surface];
    if (hit && (Date.now() - hit.at) < ttl) return hit.pr;
    /* ── WHOSE POSTS THIS SURFACE IS ASKING FOR ──────────────────────────
       ★ A PROFILE WAS SHOWING THE VIEWER THEIR OWN FEED.

       This matched `center:` and let EVERYTHING ELSE fall through to
       `/api/feed`, which is the signed-in person's own home feed. On a
       `center:` surface that was right. On `home:` it was also right — your
       own feed is exactly what belongs on your own Home.

       On `profile:` it was wrong in the way that is hardest to notice:
       measured 2026-09-07 on loop.ada's profile, the Latest Popit rendered
       posts by "WIll MAo". Not an error, not an empty state — somebody else's
       content, rendered confidently, under Ada's name. And because /api/feed
       is per-viewer, EVERY VISITOR SAW A DIFFERENT PROFILE: their own feed,
       wearing the page of whoever they were looking at.

       It reads as a leak and is not quite one — the rows are the viewer's own,
       so nothing private travelled — but a page that shows you your own things
       while claiming to be another person's is worse than either an error or a
       gap, because nobody can tell it is wrong by looking at it. Ada's own
       visitors would each have seen it working.

       `/api/users/{email}` already answers this and answers it to a STRANGER —
       it carries that person's posts, visibility-gated, with no token. The
       existing extractor below already reads `d.posts`, which is the key that
       response uses, so the shape needed nothing.

       A surface with no `:` and anything unrecognised still falls through to
       the person's own feed, which is the only safe default: your own things. */
    var mc = /^center:(.+)$/.exec(surface || '');
    var mp = /^profile:(.+)$/.exec(surface || '');
    /* A PERSON'S POSTS FROM THE COMPOSED PROFILE READ. This asked the legacy
       `/api/users/{email}` — the last old-backend request on a stranger's
       first Home (measured 2026-09-14, founder/377). `/api/oneway/people/
       {email}/profile` carries the same `posts`, answers a stranger the same
       way, and is the read the opened profile already makes, so the widget
       and the page cannot disagree about what somebody has written. */
    /* ── HOME'S LATEST READS THE SAME DOOR AS HOME'S RIVER ─────────────────
       MEASURED 2026-09-21: loop.ada published a Post; the river under the
       canvas showed it first; the Latest tile above it kept showing ada.ops's
       Sep 9 posts — it was asking the LEGACY /api/feed while the river reads
       /api/oneway/home (home.information.feed). Two readers of "your feed",
       two answers on one screen. One door now. */
    var mh = /^home:(.+)$/.exec(surface || '');
    var url = mc ? '/api/oneway/feed/places/' + encodeURIComponent(mc[1]) + '?limit=6'
            : mp ? '/api/oneway/people/' + encodeURIComponent(mp[1]) + '/profile'
            : mh ? '/api/oneway/home'
                 : '/api/oneway/feed?limit=6';
    var pr = req(url).then(function (r) {
      if (!r || r.ok === false) return { ok: false, rows: [] };
      var d = (r && r.data) || {};
      var rows = mh ? ((((d.home || {}).information || {}).feed) || []).slice(0, 6)
                    : ((d.feed || d.posts || d.items || []) || []);
      return { ok: true, rows: rows };
    }).catch(function () { return { ok: false, rows: [] }; });
    _social[surface] = { at: Date.now(), pr: pr };
    return pr.then(function (v) { if (!v.ok) forgetSocial(surface); return v; });
  }
  /* A save on the surface can add a Post; the next paint must not serve the
     read taken before it. */
  function forgetSocial(surface) {
    if (surface) delete _social[surface]; else _social = {};
  }

  /* ═══ ONE EVENTS READ PER SURFACE ═══════════════════════════════════════
     The same claim-on-a-shared-read that `context: ["social"]` makes, for
     `context: ["events"]`. A Center's What's Happening and anything else that
     wants to know what is on cost one request between them.

     ONLY A CENTER HAS EVENTS. A person's Home has no events endpoint of its
     own — `/api/me/discover` answers 0 events, 0 activity and 0 connections
     for a real account, measured 2026-09-02 — so a Home resolves to nothing
     and the tile says so, rather than a route being invented to be empty at. */
  /* ── WHAT IS ON IS NOT EVERYTHING THE DOMAIN WILL HAND BACK ────────────
     `upcoming()` is right to return more than this: it serves an OPERATOR
     managing a Center, and `PUBLIC_STATES` deliberately includes `ended` and
     `cancelled` so a list can show what happened and what was called off.

     A Popit that says NEXT or WHAT'S HAPPENING is making a different claim —
     that this is on — and only two states support it. Found by my own test,
     2026-09-02: I cancelled an event I had created, the domain correctly kept
     returning it because I operate that Center, and my tile went on
     advertising a cancelled concert as the next thing happening. The domain
     was not wrong; the widget was reading a management list as a promise.

     A DRAFT IS EXCLUDED FOR THE SAME REASON: it exists but has not been
     announced, and announcing it is precisely what these tiles do. */
  /* the announceable filter now lives in the shared temporal contract, so a
     surface that is not this canvas cannot answer it differently */
  /* read through TIME at CALL time, not at load — with the contract missing,
     dereferencing it here would reintroduce the load-time crash this file just
     stopped having */
  function isOn(ev) { return TIME ? TIME.isAnnounceable(ev) : false; }

  var _events = {};
  function eventsRead(surface) {
    var spec = (_specs && _specs.happening) || {};
    var ttl = (typeof spec.refresh === 'number' ? spec.refresh : 300) * 1000;
    var hit = _events[surface];
    if (hit && (Date.now() - hit.at) < ttl) return hit.pr;
    var m = /^center:(.+)$/.exec(surface || '');
    var pr = m
      ? req('/api/oneway/places/' + encodeURIComponent(m[1]) + '/events?limit=6')
          .then(function (r) {
            if (!r || r.ok === false) return { ok: false, rows: [] };
            var d = (r && r.data) || {};
            return { ok: true, rows: ((d.events || d.items || []) || []).filter(isOn) };
          }).catch(function () { return { ok: false, rows: [] }; })
      /* a Home has no events endpoint of its own — that is a KNOWN nothing,
         not a failure, and it must keep saying so */
      : Promise.resolve({ ok: true, rows: [] });
    _events[surface] = { at: Date.now(), pr: pr };
    return pr.then(function (v) { if (!v.ok) delete _events[surface]; return v; });
  }

  /* ═══ WHAT'S HAPPENING — WHAT IS ON, AND NEVER WHEN ═════════════════════
     ★ FOUNDER: *"If the start time isn't known: BOARDWALK CONCERT / TIME NOT
       ANNOUNCED. Never invent a countdown."*

     Measured 2026-09-02 across three Centers: EVERY event in the store has an
     empty `starts_at`. So this Popit shows the title, the place and the one
     line the event carries about itself — "4,200 going", "On the sand, as the
     light goes" — and says nothing at all about time. Not "tonight", not
     "soon", not a relative phrase inferred from a missing field. When times
     arrive it can grow a line; it will not grow one before then.

     The ladder is the same descent as Latest, for the same reason: whole parts
     are removed until the content fits, and nothing is ever cut. */
  var HAP_RUNGS = [
    { n: 3, note: 1, place: 1 },
    { n: 3, note: 0, place: 1 },
    { n: 2, note: 1, place: 1 },
    { n: 2, note: 0, place: 1 },
    { n: 1, note: 1, place: 1 },
    { n: 1, note: 0, place: 1 },
    { n: 1, note: 0, place: 0 }
  ];
  function happeningFace(cfg, w, h, surface, onOpen) {
    var box = doc.createElement('div');
    box.className = 'ow-cv-hap';
    var head = doc.createElement('div');
    head.className = 'ow-cv-hap__k';
    head.textContent = 'What’s happening';
    box.appendChild(head);
    var list = doc.createElement('div');
    list.className = 'ow-cv-hap__list';
    box.appendChild(list);

    var built = [], tries = 0;
    function apply(i) {
      var r = HAP_RUNGS[i];
      box.setAttribute('data-note', r.note ? '1' : '0');
      box.setAttribute('data-place', r.place ? '1' : '0');
      for (var k = 0; k < built.length; k++) built[k].hidden = (k >= r.n);
    }
    function fits() { return list.scrollHeight <= list.clientHeight + 1; }
    function descend() {
      if (!built.length) return;
      var i = h >= 5 ? 0 : (h >= 3 ? 2 : (h === 2 ? 4 : 5));
      apply(i);
      if (!list.clientHeight) {
        if (tries++ < 12) {
          try { requestAnimationFrame(descend); } catch (e) { setTimeout(descend, 32); }
        }
        return;
      }
      tries = 0;
      while (i < HAP_RUNGS.length - 1 && !fits()) { i++; apply(i); }
      box.setAttribute('data-rung', String(i));
    }
    box._refit = descend;

    eventsRead(surface).then(function (res) {
      /* ── THE THIRD STATE, SAID IN ITS OWN WORDS ───────────────────────
         Not the absence wording. "Nothing here yet" is a claim about the
         world; this is a claim about us. A person who cannot tell them apart
         will refresh a page that was never going to fill, or conclude a place
         is dead when the request simply did not arrive. */
      if (res && res.ok === false) {
        var fx = doc.createElement('div');
        fx.className = 'ow-cv-hap__none ow-cv-fault';
        fx.textContent = 'Could not load';
        list.appendChild(fx);
        return;
      }
      /* the same order Counting Down means by "next" — these two Popits read
         the same endpoint and used to disagree about which event came first */
      var rows = TIME.rank((res && res.rows) || []);
      if (!rows.length) {
        var e = doc.createElement('div');
        e.className = 'ow-cv-hap__none';
        /* THE PLATFORM'S OWN WORDS, for the reason given on the Latest
           empty state: this phrasing is what the quality harness recognises
           as a NAMED ABSENCE rather than a placeholder, and a second vocabulary
           for the same condition would make the product say two things and the
           detector believe neither. "nothing on in your world" reads well and
           matches nothing — measured, it would have been reported. */
        /* the same two parts as Next's, for the same reason — a narrow tile
           drops the tail and keeps a whole sentence. This was left as one
           string when Next's was split, so What's Happening went on wrapping
           the full phrase and clipping by 14px at its own default size. */
        if (/^center:/.test(surface || '')) {
          e.textContent = 'Nothing here yet';
        } else {
          e.textContent = 'Nothing yet';
          var tail = doc.createElement('span');
          tail.textContent = ' IN YOUR WORLD';
          e.appendChild(tail);
        }
        list.appendChild(e);
        return;
      }
      for (var i = 0; i < rows.length && i < HAP_RUNGS[0].n; i++) {
        var ev = rows[i] || {};
        var row = doc.createElement(ev.id ? 'button' : 'div');
        row.className = 'ow-cv-hap__e';
        if (ev.id) row.type = 'button';
        var t = doc.createElement('span');
        t.className = 'ow-cv-hap__t';
        t.textContent = ev.title || 'Untitled';
        row.appendChild(t);
        if (ev.place) {
          var pl = doc.createElement('span');
          pl.className = 'ow-cv-hap__p';
          pl.textContent = ev.place;
          row.appendChild(pl);
        }
        if (ev.description) {
          var nt = doc.createElement('span');
          nt.className = 'ow-cv-hap__n';
          nt.textContent = ev.description;
          row.appendChild(nt);
        }
        /* AN EVENT WITH NO ID CANNOT BE OPENED, so it is not offered as though
           it could. Measured: caesars' events carry an empty `id`. A button
           that goes nowhere is worse than a line of text that never claimed to. */
        if (ev.id) {
          (function (node, id) {
            node.addEventListener('click', function (e2) {
              e2.preventDefault(); e2.stopPropagation();
              if (onOpen) onOpen(id, { node: node, rect: node.getBoundingClientRect() });
            });
          })(row, ev.id);
        }
        built.push(row);
        list.appendChild(row);
      }
      descend();
      try {
        if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
          doc.fonts.ready.then(function () { descend(); });
        }
      } catch (e3) {}
      global.setTimeout(descend, 260);
    });

    try {
      if (global.ResizeObserver) {
        var ro = new ResizeObserver(function () { descend(); });
        ro.observe(box); box._ro = ro;
      }
    } catch (e4) {}
    box._stop = function () { if (box._ro) box._ro.disconnect(); };
    return box;
  }

  /* ═══ ONE LOCATION READ PER SURFACE ═════════════════════════════════════
     `context: ["location"]` — the same claim-on-a-shared-read as social and
     events. `/where` answers the chain, the city, the region, the country AND
     the zone in one call, which is exactly why the Location Center exists: a
     Popit that kept its own timezone would be a second answer to a question
     the platform already answers, and the zone, the DST state, the offset and
     the abbreviation all change without anybody editing a record. */
  var _where = {};
  function whereRead(surface) {
    var spec = (_specs && _specs.where) || {};
    var ttl = (typeof spec.refresh === 'number' ? spec.refresh : 60) * 1000;
    var hit = _where[surface];
    if (hit && (Date.now() - hit.at) < ttl) return hit.pr;
    var m = /^center:(.+)$/.exec(surface || '');
    var pr = m
      ? req('/api/oneway/centers/' + encodeURIComponent(m[1]) + '/where')
          .then(function (r) {
            if (!r || r.ok === false) return { ok: false, data: null };
            return { ok: true, data: (r && r.data) || null };
          })
          .catch(function () { return { ok: false, data: null }; })
      /* not a Center: there is no location to have, which is a fact */
      : Promise.resolve({ ok: true, data: null });
    _where[surface] = { at: Date.now(), pr: pr };
    return pr.then(function (v) { if (!v.ok) delete _where[surface]; return v; });
  }

  /* ═══ CONNECTED LOCATION — WHERE THIS CENTER IS ═════════════════════════
     THE TIME IS RENDERED, NEVER RELAYED. `/where` returns
     `local: "2026-09-03T09:16:25.759173-04:00"`, which is a true value in a
     machine's shape — B named this class after printing one onto a surface,
     and a widget showing a real value a person cannot read is as hollow as an
     empty one. So the zone comes from the platform and the FORMATTING is done
     here, in the reader's own conventions.

     WHAT IT NEVER INVENTS: a place. A Center that has not been placed says so.
     Measured 2026-09-02: 80 of 196 Centers resolve; the rest answer
     `resolved: false`, and that is a fact about the Center, not a gap to fill
     with the viewer's own city. */
  function whereFace(cfg, w, h, surface) {
    var box = doc.createElement('div');
    box.className = 'ow-cv-where';
    var head = doc.createElement('div');
    head.className = 'ow-cv-where__k';
    head.textContent = 'Location';
    box.appendChild(head);
    var body = doc.createElement('div');
    body.className = 'ow-cv-where__b';
    box.appendChild(body);

    var timer = 0;
    whereRead(surface).then(function (res) {
      /* ── THE THIRD STATE, SAID IN ITS OWN WORDS ───────────────────────
         Not the absence wording. "Nothing here yet" is a claim about the
         world; this is a claim about us. A person who cannot tell them apart
         will refresh a page that was never going to fill, or conclude a place
         is dead when the request simply did not arrive. */
      if (res && res.ok === false) {
        var fx = doc.createElement('div');
        fx.className = 'ow-cv-where__none ow-cv-fault';
        fx.textContent = 'Could not load';
        body.appendChild(fx);
        return;
      }
      var d = res && res.data;
      if (!d || !d.resolved) {
        var e = doc.createElement('div');
        e.className = 'ow-cv-where__none';
        e.textContent = /^center:/.test(surface || '')
          ? 'Not placed yet' : 'Nothing here yet';
        body.appendChild(e);
        return;
      }
      var city = doc.createElement('span');
      city.className = 'ow-cv-where__city';
      city.textContent = d.city || d.label || '';
      body.appendChild(city);

      /* the rest of the chain, outermost last, and only what is known */
      var restBits = [];
      if (d.region) restBits.push(d.region);
      if (d.country) restBits.push(d.country);
      if (restBits.length) {
        var rest = doc.createElement('span');
        rest.className = 'ow-cv-where__rest';
        rest.textContent = restBits.join(' · ');
        body.appendChild(rest);
      }

      var t = d.time || {};
      if (t.readable && t.timezone) {
        var clock = doc.createElement('span');
        clock.className = 'ow-cv-where__t';
        function paint() {
          var now;
          try {
            now = new Date().toLocaleTimeString([], {
              hour: 'numeric', minute: '2-digit', timeZone: t.timezone
            });
          } catch (e2) { now = ''; }
          /* THE ABBREVIATION EARNS ITS PLACE ONLY WHEN IT DIFFERS. A Center in
             the reader's own zone showing "EDT" is telling them something they
             already know; one in another zone is telling them something real. */
          var mine = '';
          try { mine = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e3) {}
          clock.textContent = now + (mine && mine !== t.timezone && t.abbreviation
            ? ' · ' + t.abbreviation : '');
        }
        paint();
        body.appendChild(clock);
        function schedule() {
          clearTimeout(timer);
          if (doc.hidden) return;
          timer = setTimeout(function () { paint(); schedule(); },
                             60000 - (Date.now() % 60000) + 5);
        }
        schedule();
        try {
          doc.addEventListener('visibilitychange', function () {
            if (doc.hidden) clearTimeout(timer); else { paint(); schedule(); }
          });
        } catch (e4) {}
      }
    });
    box._stop = function () { clearTimeout(timer); };
    return box;
  }

  /* ═══ NEXT — A COUNTDOWN WHEN THERE IS A TIME, AND A FACT WHEN THERE IS NOT
     ★ FOUNDER: *"If the start time isn't known: BOARDWALK CONCERT / TIME NOT
       ANNOUNCED. Never invent a countdown."*

     Measured 2026-09-02: every event in the store has an EMPTY `starts_at`, so
     on today's data this Popit renders the second half of that sentence for
     every event it is given. That is not a degraded mode — it is the mode the
     founder specified, and building it now means the first event that arrives
     with a time gets a countdown without anything being rewritten.

     THE COUNTDOWN IS COARSE ON PURPOSE. It counts down in the largest unit
     that is still true — days, then hours, then minutes — and never seconds.
     A tile that changes every second is a tile the eye cannot leave alone, and
     it costs a frame a second forever to say something nobody needed to that
     precision. Under a minute it says the event is starting, which is the only
     honest thing left to say. */
  /* the four states and their words are the contract's; see ow-time.js for the
     founder's ruling and for why ENDED had to exist */
  function untilText(startsAt, endsAt) { return TIME.until(startsAt, endsAt); }

  function countdownFace(cfg, w, h, surface, onOpen) {
    var box = doc.createElement('div');
    box.className = 'ow-cv-next';
    var head = doc.createElement('div');
    head.className = 'ow-cv-next__k';
    head.textContent = 'Next';
    box.appendChild(head);
    var body = doc.createElement('div');
    body.className = 'ow-cv-next__b';
    box.appendChild(body);

    var timer = 0;
    eventsRead(surface).then(function (res) {
      /* ── THE THIRD STATE, SAID IN ITS OWN WORDS ───────────────────────
         Not the absence wording. "Nothing here yet" is a claim about the
         world; this is a claim about us. A person who cannot tell them apart
         will refresh a page that was never going to fill, or conclude a place
         is dead when the request simply did not arrive. */
      if (res && res.ok === false) {
        var fx = doc.createElement('div');
        fx.className = 'ow-cv-next__none ow-cv-fault';
        fx.textContent = 'Could not load';
        body.appendChild(fx);
        return;
      }
      var rows = (res && res.rows) || [];
      if (!rows.length) {
        var e = doc.createElement('div');
        e.className = 'ow-cv-next__none';
        /* TWO PARTS, so a narrow tile can drop the tail and keep a whole
           sentence rather than a cut one — "Nothing yet" is still the
           platform's absence wording, which is what the harness reads. */
        if (/^center:/.test(surface || '')) {
          e.textContent = 'Nothing here yet';
        } else {
          e.textContent = 'Nothing yet';
          var tail = doc.createElement('span');
          tail.textContent = ' IN YOUR WORLD';
          e.appendChild(tail);
        }
        body.appendChild(e);
        return;
      }
      /* ── WHICH ONE IS "NEXT" ────────────────────────────────────────────
         Sooner is not simply smaller. The first version took the minimum
         timestamp, and a concert that ended last March is the smallest number
         in the set — so a Popit called Next would have led with the most
         thoroughly over event a Center had, while a real one two hours away sat
         behind it.

         The order a person means by "next":
             1  happening now      — the answer to "what is on" is this
             2  the soonest FUTURE one
             3  ended, and only when there is nothing else to say
             4  no time at all — kept last, because an event with a known time
                is more useful than one without, but never dropped: it is still
                a real thing happening here.
         Within a tier, soonest first. */
      /* ONE READ OF THE SHARED RANKING, not a second copy of it.
         This used to hand-roll tierOf and a best-so-far loop here, inside the
         picker, which is exactly what the founder called burying the contract:
         What's Happening read the same events and did not rank them at all. */
      var pick = TIME.rank(rows)[0] || rows[0];

      /* ── WHAT THIS TILE IS SHOWING, WHERE THE HANDOFF CAN SEE IT ─────────
         A client-drawn kind resolves its own object at DRAW time — there is no
         `resolved` on the placement for `objectOf` to read, so a Countdown
         naming one specific Event handed off with `object: null` and the App
         had to open the room instead of the evening. The tile records what it
         drew; nothing else changes, and a kind that draws nothing records
         nothing and still says so honestly. */
      if (pick.id || pick.event_id) {
        /* on the FACE, not on the tile: this runs while the face is still
           being built and has no parent to climb to yet. The handoff looks
           down from the tile instead of up from here. */
        box.dataset.objKind = 'event';
        box.dataset.objId = String(pick.event_id || pick.id);
      }

      var row = doc.createElement(pick.id ? 'button' : 'div');
      row.className = 'ow-cv-next__e';
      if (pick.id) row.type = 'button';

      var when = doc.createElement('span');
      when.className = 'ow-cv-next__w';
      var title = doc.createElement('span');
      title.className = 'ow-cv-next__t';
      title.textContent = pick.title || 'Untitled';
      var place = doc.createElement('span');
      place.className = 'ow-cv-next__p';
      if (pick.place) place.textContent = pick.place;

      function paint() {
        var u = untilText(pick.starts_at, pick.ends_at);
        if (!u) {
          /* the founder's own words for this state */
          when.textContent = 'Date and time not set';
          when.setAttribute('data-known', '0');
          when.removeAttribute('data-state');
          return false;
        }
        when.textContent = u.word;
        when.setAttribute('data-known', '1');
        when.setAttribute('data-state', u.state);
        if (u.on) when.setAttribute('data-now', '1');
        else when.removeAttribute('data-now');
        /* an ENDED event needs no ticking — it will not become less ended */
        return u.state !== 'ended';
      }
      var known = paint();
      row.appendChild(when);
      row.appendChild(title);
      if (pick.place) row.appendChild(place);
      if (pick.id) {
        row.addEventListener('click', function (e2) {
          e2.preventDefault(); e2.stopPropagation();
          if (onOpen) onOpen(pick.id, { node: row, rect: row.getBoundingClientRect() });
        });
      }
      body.appendChild(row);

      /* ONLY A KNOWN TIME COSTS A TIMER, and it ticks a minute — see above.
         Parked with the tab, canon §4: a countdown nobody is looking at is a
         countdown nobody needs recomputed. */
      if (known) {
        function schedule() {
          clearTimeout(timer);
          if (doc.hidden) return;
          timer = setTimeout(function () { paint(); schedule(); },
                             60000 - (Date.now() % 60000) + 5);
        }
        schedule();
        try {
          doc.addEventListener('visibilitychange', function () {
            if (doc.hidden) clearTimeout(timer); else { paint(); schedule(); }
          });
        } catch (e3) {}
      }
    });
    box._stop = function () { clearTimeout(timer); };
    return box;
  }

  /* ═══ LATEST — A PROJECTION OF THE POST, NOT A COPY OF ONE ══════════════
     ★ FOUNDER, 2026-08-30: *"Use the exact Post material. Don't invent a
       special 'widget post card.' It should literally be a projection of the
       same Post object."*

     So there is no markup for a post in this function. It calls `OW.card` —
     the same renderer behind Home, a profile, a Center page and the Post
     surface — and its whole job is deciding HOW MANY and HOW MUCH, which is
     the only thing a tile knows that those four surfaces do not.

     COMPRESSION, NEVER TRUNCATION.
     ★ FOUNDER, 2026-08-28: *"i dont want to see any cut out or ... text
       anywhere."*
     A card clipped by a short tile is cut text, and an ellipsis is cut text
     that admits it. Both are forbidden, so the ladder REMOVES WHOLE PARTS —
     media first, then the body — and what remains is rendered complete. A
     Latest showing only who posted and when is a smaller true statement; a
     Latest showing half a sentence is a broken one.

       1 row     who + when.  The identity of the newest post and nothing else.
       2 rows    + the reaction counts — enough to know it landed.
       3-4 rows  + the body, whole, and a second post beneath it.
       5+ rows   the card as the river renders it, media included. */
  /* THE LADDER IS A DESCENT, AND THE TILE DECIDES HOW FAR DOWN IT GOES.
     The first version of this chose a rung from the ROW COUNT alone, and that
     is not a measurement. Measured 2026-09-02 on a real Home: a 3-row Latest
     projected to 112x176px asked for two cards, each of which laid out 183px
     tall — 366px of Post in 176px of tile. The cards were real, the content was
     right, and it was CUT, which is the one outcome forbidden outright:
     ★ FOUNDER, 2026-08-28: *"i dont want to see any cut out or ... text
       anywhere."*

     So the rungs are ordered heaviest to lightest, the row count picks a
     STARTING rung, and then the tile is measured and the descent continues
     until the content actually fits. Every step removes a WHOLE part — a
     photograph, a sentence, a count, an entire post — so what remains is always
     a smaller true statement and never a broken one. */
  /* THE ORDER OF SACRIFICE IS THE DESIGN. What goes first is the photograph,
     then the reaction counts, then a whole second post, and the BODY is nearly
     last — because the body is the post. An earlier ordering here dropped the
     sentence before the counts, which left a Latest reading "Loop Test Center ·
     11m ago · 3 likes" and saying nothing about what was actually said. */
  /* ── THE LAST RUNG KEPT THE BYLINE AND DROPPED THE WORDS ──────────────
     ★ MEASURED 2026-09-07 on a real Center's public face: the Latest Popit
     read "loop.ada · 23h ago" and nothing else. Three posts were in the DOM,
     their text sitting at display:none.

     Nothing was broken. `fits()` measures real overflow and was right: one
     card with a byline AND a body wants ~80px, and the list had 73px. The
     ladder descended correctly to its final rung — and that rung's content is
     `{n:1, body:0}`, a post card with no post in it.

     IT IS THE DEFAULT, NOT AN EDGE CASE. The catalog places Latest at 6x3,
     which is a ~40px list, so the DEFAULT placement of the Popit whose entire
     purpose is showing posts could not show one.

     A POST IS ITS WORDS. When there is room for exactly one thing, the one
     thing is what was said, not who said it — a byline with no sentence is the
     least informative half of a post, and on a Center's face the reader is
     already looking at whose posts these are. So `who` becomes a dimension
     like the others and the final rung spends it instead of the body.

     This keeps the ladder's own law — remove whole parts, never truncate —
     and only corrects WHICH part goes last. */
  var POST_RUNGS = [
    { n: 3, media: 1, body: 1, foot: 1, who: 1 },
    { n: 3, media: 0, body: 1, foot: 1, who: 1 },
    { n: 2, media: 0, body: 1, foot: 1, who: 1 },
    { n: 2, media: 0, body: 1, foot: 0, who: 1 },
    { n: 1, media: 0, body: 1, foot: 1, who: 1 },
    { n: 1, media: 0, body: 1, foot: 0, who: 1 },
    { n: 1, media: 0, body: 1, foot: 0, who: 0 },
    /* ── AND BEFORE THE TALLY, THE FIRST LINES OF THE NEWEST POST ────────
       ★ MEASURED 2026-09-20 at 290px: Latest is a 117x116 tile there, the
         newest Post's body is long, and the rung above needs the WHOLE body —
         so the ladder fell to "6 posts" over 80px of empty material, on the
         one tile whose job is to show the posts. A body cut at a line
         boundary ends in an ellipsis, which is this lane's own announcement
         that there is more; "6 posts" and nothing is a smaller truth than
         "ada.ops · before anyone is up…". Three lines with the name, then two
         without; the tally stays the floor beneath both. */
    { n: 1, media: 0, body: 1, foot: 0, who: 1, clamp: 3 },
    { n: 1, media: 0, body: 1, foot: 0, who: 0, clamp: 2 }
  ];
  /* where a tile of this many rows starts looking */
  function startRung(h) {
    if (h >= 5) return 0;
    if (h >= 3) return 2;
    if (h === 2) return 4;
    return 5;
  }
  function postsFace(cfg, w, h, surface, onOpen) {
    var box = doc.createElement('div');
    box.className = 'ow-cv-posts';
    box.setAttribute('data-dense', h <= 1 ? 's' : (h === 2 ? 'm' : (h <= 4 ? 'l' : 'xl')));

    var head = doc.createElement('div');
    head.className = 'ow-cv-posts__k';
    /* ★ FOUNDER/467: *"dont like all capitals."* The 2026-09-20 sweep turned
       97 CSS rules to sentence case; these kind labels were literals in this
       file and stayed shouting on Home. Sentence case, everywhere a tile
       speaks. */
    head.textContent = 'Latest';
    box.appendChild(head);

    var list = doc.createElement('div');
    list.className = 'ow-cv-posts__list';
    box.appendChild(list);

    var built = [];      /* every card built, in order — rungs only hide them */
    /* how many the feed returned — the tally rung reports this when no
       card can be shown whole. Declared HERE, in the function that uses
       it: it first went into `happeningFace`, whose `var built` line is
       identical, so the edit landed in the wrong closure and every
       assignment threw — which emptied Latest completely. */
    var rowCount = 0;
    function apply(i) {
      var r = POST_RUNGS[i];
      box.setAttribute('data-media', r.media ? '1' : '0');
      box.setAttribute('data-body', r.body ? '1' : '0');
      box.setAttribute('data-foot', r.foot ? '1' : '0');
      box.setAttribute('data-who', r.who ? '1' : '0');
      if (r.clamp) box.setAttribute('data-clamp', String(r.clamp)); else box.removeAttribute('data-clamp');
      for (var k = 0; k < built.length; k++) built[k].hidden = (k >= r.n);
    }
    /* OVERFLOW IS THE ONLY TEST THAT COUNTS. `scrollHeight` against
       `clientHeight` is what the browser itself knows about content it could
       not show, so this asks the question directly instead of predicting it
       from font sizes that a person's own settings can change. */
    function fits() { return list.scrollHeight <= list.clientHeight + 1; }
    function descend() {
      if (!built.length) return;
      var i = startRung(h);
      apply(i);
      /* A TILE WITH NO HEIGHT CANNOT BE MEASURED, AND WAITING FOR THE OBSERVER
         IS NOT ENOUGH. Measured 2026-09-02: the fill resolves while the box is
         still detached, `clientHeight` is 0, the descent returns — and the
         ResizeObserver's first callback arrives in the same frame the tile is
         attached, when the list has been laid out but the cards inside it have
         not. Both looks are blind, `data-rung` stayed null, and two 183px cards
         sat in 176px of tile. So the descent RE-ASKS on its own until there is
         something real to measure, and gives up after a handful of frames
         rather than spinning. */
      if (!list.clientHeight) {
        if (tries++ < 12) {
          try { requestAnimationFrame(descend); }
          catch (e4) { setTimeout(descend, 32); }
        }
        return;
      }
      tries = 0;
      while (i < POST_RUNGS.length - 1 && !fits()) { i++; apply(i); }
      box.setAttribute('data-rung', String(i));

      /* ── AND WHEN EVEN ONE POST CANNOT BE SHOWN WHOLE ───────────────────
         Under one universal plane a column is a fraction of the screen, so a
         `min` expressed in columns cannot promise a number of PIXELS: Latest
         declares 4x2 and was still handed a 112x110 tile on a 280px viewport,
         where a long author name wraps to four lines and the last rung was
         21px too tall. Measured at its own default size of 6x3.

         Clipping is not an option and neither is an ellipsis, so the widget
         says the true thing that fits: how many there are. "6 POSTS" is a fact
         about the feed rather than a broken picture of one, and it is the
         honest floor of this ladder — below it the tile would be lying either
         way. */
      if (!fits() && built.length) {
        for (var z = 0; z < built.length; z++) built[z].hidden = true;
        if (!box._tally) {
          box._tally = doc.createElement('div');
          box._tally.className = 'ow-cv-posts__tally';
          list.appendChild(box._tally);
        }
        box._tally.hidden = false;
        box._tally.textContent = rowCount
          + (rowCount === 1 ? ' post' : ' posts');
        box.setAttribute('data-rung', 'tally');
      } else if (box._tally) {
        box._tally.hidden = true;
      }
      /* Nothing may be cut. If even the lightest rung overflows the tile is
         smaller than this kind's declared minimum, and saying so beats
         pretending — but it must not LOOK broken, so the list shows what fits
         and the tile reports the condition for a browser check to catch. */
      box.setAttribute('data-overflow', fits() ? '0' : '1');
    }
    var tries = 0;
    box._refit = descend;

    socialFeed(surface).then(function (res) {
      /* ── THE THIRD STATE, SAID IN ITS OWN WORDS ───────────────────────
         Not the absence wording. "Nothing here yet" is a claim about the
         world; this is a claim about us. A person who cannot tell them apart
         will refresh a page that was never going to fill, or conclude a place
         is dead when the request simply did not arrive. */
      if (res && res.ok === false) {
        var fx = doc.createElement('div');
        fx.className = 'ow-cv-posts__none ow-cv-fault';
        fx.textContent = 'Could not load';
        list.appendChild(fx);
        return;
      }
      var rows = (res && res.rows) || [];
      /* NO `isConnected` GUARD HERE, and it is worth saying why: it was here,
         and it emptied every tile. `postsFace` builds the box and RETURNS it —
         the render attaches it to the face, the face to the tile and the tile
         to the grid afterwards. A cached or fast read resolves on the next
         microtask, which is BEFORE any of that has happened, so the guard read
         "not in the document" for the ordinary case and skipped the fill. The
         tile then said NOTHING NEW next to a feed holding six posts.
         Measured 2026-09-02: 4 renders, 4 reads, 200 OK on every one, zero
         cards. Filling a detached node is correct — it is painted when the
         render attaches it. */
      rows = rows || [];
      rowCount = rows.length;
      /* ★ FOUNDER: *"Empty state: what it says when there is nothing."*
         An empty feed is a real answer and gets a real sentence, not a
         skeleton that implies something is still coming. */
      if (!rows.length) {
        var e = doc.createElement('div');
        e.className = 'ow-cv-posts__none';
        e.textContent = /^center:/.test(surface || '')
          ? 'Nothing posted here yet' : 'Nothing new';
        list.appendChild(e);
        return;
      }
      for (var i = 0; i < rows.length && i < POST_RUNGS[0].n; i++) {
        var card;
        try { card = OW.card(OW.riverRow(rows[i] || {})); } catch (e2) { card = null; }
        if (!card) continue;
        /* The card is already a <button>; inside a canvas tile its press has
           to reach the Post surface the same way a river card's does, and
           carry an origin so the opening animation has something to fly
           from. Rect read at press, because a tile can be dragged. */
        (function (node, row) {
          node.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            var id = (row && row.id) || '';
            if (!id || !onOpen) return;
            onOpen(id, { node: node, rect: node.getBoundingClientRect() });
          });
        })(card, rows[i]);
        built.push(card);
        list.appendChild(card);
      }
      descend();
      /* ── AND AGAIN WHEN THE TYPE IS REAL ──────────────────────────────
         The first descent measures against whatever face the browser has at
         that instant. Outfit arrives after it, every line changes height, and
         the rung chosen a moment earlier is now one lower than the tile can
         afford. Measured 2026-09-02 at 390px: the first pass settled on the
         lightest rung and a hand-run refit immediately went back up one and
         showed the body — the tile was throwing away the sentence because it
         had measured a fallback font.

         The descent starts from the same rung every time and only ever removes
         what does not fit, so running it again is free and can only improve
         what is shown. */
      try {
        if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
          doc.fonts.ready.then(function () { descend(); });
        }
      } catch (e5) {}
      global.setTimeout(descend, 260);
    });

    /* A Latest is resized by dragging its own handle and by turning the phone,
       and the rung has to be re-chosen for the tile that is now there. */
    try {
      if (global.ResizeObserver) {
        var ro = new ResizeObserver(function () { descend(); });
        ro.observe(box); box._ro = ro;
      }
    } catch (e3) {}
    box._stop = function () { if (box._ro) box._ro.disconnect(); };
    return box;
  }

  /* WHAT THE CATALOG SAID ABOUT A KIND — remembered from the one read the
     picker already makes, so a tile never asks the server for a word. */
  /* ★ THE CLIENT ASKS THE DECLARATION, IT DOES NOT RE-DERIVE IT.
     ★ FOUNDER, 2026-08-30: *"individual widgets declare what they are capable
       of instead of adding another giant conditional tree."*

     The server now serves a `spec` with every catalog row and a
     `placement_specs` map for the kinds that are not catalog Popits. Both sides
     therefore read ONE declaration — which is what stops the client and the
     server disagreeing about whether a thing may be rotated, the way they did
     when a rotate handle appeared on every Popit while `FREEFORM_KINDS` said
     only a sticker was freeform. */
  var _specs = {};          /* ref  -> spec, for catalog Popits */
  var _pspecs = {};         /* kind -> spec, for placement kinds */
  var _catalog = {};
  function rememberCatalog(c) {
    if (c && c.placement_specs) _pspecs = c.placement_specs;
    ((c && c.popits) || []).forEach(function (p) {
      if (p && p.spec) _specs[p.id] = p.spec;
      /* ── AND `opens`, WHICH THIS FUNCTION DROPPED ON THE FLOOR ─────────
         ★ FOUNDER, 2026-09-12: a Popit *"previews Posts → opens the real
           Feed/Scroll."*  The catalog publishes `opens` per kind and this kept
         only the name and the blurb, so `catalogEntry(ref).opens` was undefined
         and the handoff silently never fired — the tile opened its room and
         nothing said why.

         THE COMMENT DIRECTLY BELOW IS ABOUT THIS EXACT MISTAKE, made with
         `min` in September: *"a contract nothing re-reads is a contract nothing
         enforces."*  Third field now — `min`, then `animations`, now `opens`.
         The shape is always a server that publishes a capability and a client
         that copies two keys out of the payload.

         SPREAD RATHER THAN LISTED, so the next field the catalog grows arrives
         without a fourth instance of this. */
      if (p && p.id) {
        var row = { name: p.name || '', blurb: p.blurb || '' };
        for (var k in p) {
          if (Object.prototype.hasOwnProperty.call(p, k) && k !== 'spec') {
            row[k] = p[k];
          }
        }
        _catalog[p.id] = row;
      }
    });
    ((c && c.apps) || []).forEach(function (p) {
      if (p && p.id) _catalog[p.id] = { name: p.name || '', blurb: p.blurb || '',
                                        kind: p.kind || 'app' };
    });
    fillEmptyTiles();
    /* ── AND THE GEOMETRY, BECAUSE THE SPECS DECIDE IT ────────────────────
       This used to fill in names and blurbs and stop, which was right when a
       spec only carried words. It carries `min` now, and `packed()` reads that
       to decide how many columns a Popit may be projected into — so a catalog
       that arrives after the first paint left every tile laid out under the
       fallback floor of ONE column, permanently.

       Measured 2026-09-02 at 280px: `posts` declares a four-column minimum, the
       catalog landed after the pack, and Latest stayed in a 98px tile for the
       life of the page. Enforcing the minimum in `packed()` changed nothing on
       screen until this line existed, which is the whole lesson — a contract
       nothing re-reads is a contract nothing enforces.

       A surface being ARRANGED is left alone: re-laying out under somebody's
       hand would move the tile they are holding. */
    try {
      for (var li = 0; li < _live.length; li++) {
        var cv = _live[li];
        if (cv && !cv.editing && cv.host && cv.host.isConnected && cv.items
            && cv.items.length) cv.render();
      }
    } catch (e) {}
  }
  /* WHAT MAY THIS PLACEMENT DO. Falls back to the local FREEFORM list when the
     catalog has not answered yet — a canvas must render before the catalog
     loads, and a first paint that guessed "everything rotates" would flash a
     handle it then took away. */
  function specOf(it) {
    if (!it) return null;
    if (it.kind === 'popit') return _specs[it.ref] || null;
    return _pspecs[it.kind] || null;
  }
  function isFree(it) {
    var sp = specOf(it);
    if (sp && typeof sp.grid === 'boolean') return !sp.grid;
    return FREEFORM.indexOf(it.kind) >= 0;
  }
  function mayRotate(it) {
    var sp = specOf(it);
    if (sp && typeof sp.rotate === 'boolean') return sp.rotate;
    return FREEFORM.indexOf(it.kind) >= 0;
  }

  /* ═══ `shows` — DOES THIS POPIT HAVE ENOUGH TO BE WORTH SHOWING ════════
     ★ FOUNDER, 2026-09-02: *"these hollow projections of any popit and look
       like placeholders are gonna be systematically eliminated."*

     Agreed with B, 2026-09-02, as ONE rule across both widget mounts so this
     stays a law rather than two mechanisms:

         name       `shows`
         signature  shows(data) -> boolean
         default    ABSENT means render, exactly as before. A gate for the
                    kinds that need one, never an obligation on every kind.
         failure    THROWS => FAIL OPEN. Unknown is not empty, and silently
                    deleting a good Popit is worse than showing a thin one.

     WHY THE PREDICATES LIVE HERE AND NOT IN `KIND_SPECS`: the server spec
     crosses as JSON and a function cannot. The spec advertises THAT a kind
     gates; the predicate itself is the client's, because it is the client that
     holds the rendered reading. Same name, same signature, same defaults.

     AND WHAT FALSE MEANS ON A CANVAS. B's mount refuses to render the widget.
     A canvas tile is a placement somebody made deliberately, so removing it
     would leave a hole in an arrangement they authored. Here a refused Popit
     falls back to the NAMED-ABSENCE state instead — the same designed empty
     tile that says "Nothing here yet". The predicate is identical; the honest
     response to it differs because the surface differs. */
  var SHOWS = {
    /* A RHYTHM IS A CLAIM ABOUT A PATTERN, AND A PATTERN NEEDS MORE THAN ONE
       POINT. Found by the hollow harness on a Center surface, 2026-09-02:
       "Rhythm · 244x112 · renders a frame and no fact". B found the same kind
       rendering fourteen bars with thirteen marked `data-off` — one week of
       attendance drawn as a chart of a week. One point is a fact; it is not a
       rhythm, and drawing it as one is the placeholder. */
    rhythm: function (d) {
      if (!d) return true;                    /* nothing to judge — fail open */
      var pts = d.points || d.series || d.bars || d.days;
      if (!pts || typeof pts.length !== 'number') return true;
      var live = 0;
      for (var i = 0; i < pts.length; i++) {
        var v = pts[i];
        var on = (v && typeof v === 'object') ? (v.value || v.n || v.count) : v;
        if (on) live++;
      }
      return live >= 2;
    }
  };
  function shows(it, data) {
    var fn = it && SHOWS[it.ref];
    if (typeof fn !== 'function') return true;
    try { return !!fn(data); } catch (e) { return true; }
  }

  /* Declared, like rotation. A Popit that cannot be resized must not offer a
     handle that does nothing. */
  function mayResize(it) {
    var sp = specOf(it);
    if (sp && typeof sp.resize === 'boolean') return sp.resize;
    return true;
  }

  function catalogEntry(ref) { return _catalog[ref] || null; }
  /* THE CATALOG ARRIVES AFTER THE FIRST PAINT, and an empty Popit drawn before
     it lands has only a fallback name and a generic line. Rather than block the
     render on a word, the tiles already on screen are filled in when the answer
     comes — so the first frame is immediate and the second is right. */
  function fillEmptyTiles() {
    try {
      doc.querySelectorAll('.ow-cv-t').forEach(function (t) {
        var face = t.querySelector('.ow-cv-face.is-empty');
        if (!face) return;
        var meta = catalogEntry(t.getAttribute('data-ref') || '');
        if (!meta) return;
        var nEl = face.querySelector('.ow-cv-name');
        var bEl = face.querySelector('.ow-cv-blurb');
        /* a label the PERSON set is theirs and is never overwritten */
        if (nEl && !t.hasAttribute('data-labelled') && meta.name) nEl.textContent = meta.name;
        if (bEl && meta.blurb) bEl.textContent = meta.blurb;
      });
    } catch (e) {}
  }
  /* the last resort, and it must never be the raw identifier */
  function titleCase(v) {
    return String(v || '').replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  /* ── A NAME WITH A FACE ────────────────────────────────────────────────
     ★ FOUNDER, 2026-09-13: *"things like an online popit and boardwalk arcade
       should have user and profile picture."*

     The projections now answer `face: {url, hue}` for whoever or whatever a
     Popit names. This draws it once, so a Now tile, a Following tile, a People
     row and a Guestbook row all get a face for the same reason instead of
     three renderers remembering to.

     A MISSING PICTURE IS NOT A MISSING FACE. Most people on this platform have
     published no avatar, and a grey circle would be a placeholder — which this
     codebase does not ship. The fallback is their INITIAL in their own light,
     which is a real answer: it identifies them, it is theirs, and it is the
     same convention the thread rows and the map pins already use. The hue
     travels with the face so a shelf of people is lit five ways, the way a
     feed drawn from five Centres is.

     `object-fit: cover` and a real `alt` of "" — it sits beside the name it
     belongs to, so announcing it twice is noise to a screen reader. */
  /* THE SUBJECT'S OWN LIGHT, IN THE PLATFORM'S OWN FORMULA. A hue arrives as
     an ANGLE — `accent_hue`, 0-360, the number a person picks in Settings —
     and `oneway-hue.js` has always turned that into a colour exactly one way:
     `hsl(angle, 75%, 64%)`. Resolved here rather than in CSS because only this
     knows whether the subject HAS a hue; absent means the face falls back to
     the surface pair, which is the honest default rather than a guessed angle. */
  function faceColour(face) {
    var h = face && face.hue;
    if (h === undefined || h === null || h === '') { return ''; }
    var n = parseFloat(h);
    if (!isFinite(n)) { return ''; }
    /* ── WHITE INK NEEDS A GROUND THAT STAYS DARK ─────────────────────────
       `oneway-hue.js` renders an accent at `hsl(h, 75%, 64%)`, and 64%
       lightness is an ACCENT — a line, a glow, a fill behind dark type. An
       initial is white ON this, and measured by tools/probe/contrast.js the
       letters came back at 3.19:1 and 4.49:1 against two real people's hues.
       The same defect as the sent-message bubble one kind over: the ink is
       fixed at #fff, so the ground cannot be allowed to drift light.

       46% is where both pass with room; 54% still fails one. Taken at 44 with
       the saturation eased a little, so it reads as the same colour the rest
       of the surface is lit by rather than a darker second one. The ANGLE is
       untouched, which is what makes it still recognisably theirs. */
    return 'hsl(' + ((n % 360) + 360) % 360 + ',72%,44%)';
  }

  function faceNode(face, name, kind) {
    face = face || {};
    var box = doc.createElement('span');
    /* THE SHAPE IS THE PERSON'S, NOT THE SURFACE'S. ★ FOUNDER: *"users should
       choose."*  They already did — `avatar_shape` is stored beside the
       picture and every account carries one — and the canvas was drawing a
       circle over the top of that choice. A Centre keeps its own soft square,
       which is the platform's distinction between a person and a place rather
       than a preference either of them expressed. */
    var shape = (kind === 'center') ? 'center' : (face.shape || 'round');
    box.className = 'ow-cv-av ow-cv-av--' + esc(shape);
    var col = faceColour(face);
    if (col) { box.style.setProperty('--av-c', col); }
    if (face.url) {
      var im = doc.createElement('img');
      im.alt = '';
      im.loading = 'lazy';
      im.decoding = 'async';
      /* A PICTURE THAT DOES NOT LOAD LEAVES THE INITIAL BEHIND IT, rather than
         a broken-image glyph in a round hole. The letter is already under it. */
      im.addEventListener('error', function () {
        try { im.remove(); } catch (_) {}
      }, { once: true });
      im.src = (OW.imageUrl ? OW.imageUrl(face.url) : face.url);
      box.appendChild(im);
    }
    /* A PERSON IS A FACE OR THE OUTLINE OF ONE, NEVER A LETTER (founder/495).
       A Centre keeps its monogram. The mark sits under the picture exactly as
       the letter did, so a picture that fails still leaves a person there. */
    if (kind === 'person' && OW.faceMark) {
      var mk0 = doc.createElement('i');
      mk0.innerHTML = OW.faceMark();
      box.insertBefore(mk0, box.firstChild);
      return box;
    }
    var ch = String(name || '').trim().charAt(0).toUpperCase();
    if (ch) {
      var i = doc.createElement('i');
      i.textContent = ch;
      box.insertBefore(i, box.firstChild);
    }
    return (face.url || ch) ? box : null;
  }

  function instrument(ref, live) {
    var box = doc.createElement('span');
    box.className = 'ow-in ow-in--' + esc(ref);
    box.setAttribute('aria-hidden', 'true');
    var svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'ow-in-svg' });

    if (ref === 'now') {
      /* ── IT READ A KEY THE PROJECTION DOES NOT SEND ──────────────────
         ★ MEASURED 2026-09-13 on a real Home: the ring reported
           `data-status="unknown"` for a person the same tile was calling
           ONLINE, so it has never pulsed and has never shown a real state.
         `_presence_project` answers `status`; this asked for `signal`, which
         is the name the EVENTS front uses for its date. One of the two had to
         be wrong and nothing said which. Both are accepted now — `status`
         first, because that is what presence actually sends. */
      var st = String((live && (live.status || live.signal)) || '').toLowerCase();
      box.setAttribute('data-status', st || 'unknown');
      svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 40, class: 'ow-in-ring' }));
      svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 27, class: 'ow-in-ring2' }));
      /* THE BREATH IS THE STATUS. Only a live person pulses — away and offline
         hold still, so the movement itself is information rather than flair. */
      if (st === 'online') {
        svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 16, class: 'ow-in-pulse' }));
      }
      svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 15, class: 'ow-in-core' }));
      /* ── AND THE PERSON IS THE CORE ─────────────────────────────────
         The ring is the STATE and the face is the PERSON, and a status tile
         needs both — "Online" with nothing to attach it to is the complaint.
         The face sits inside the ring the way it does in every messaging
         product there is, so the pulse reads as that person's pulse. Where
         there is no face the abstract core underneath is what shows, which is
         what the tile has always drawn. */
      var pf = faceNode(live && live.face,
                        (live && (live.who || live.label)) || '', 'person');
      if (pf) { pf.className += ' ow-cv-av--core'; box.appendChild(pf); }

    } else if (ref === 'events' || ref === 'next') {
      /* HOW NEAR IT IS, AS AN ANGLE. Wound over a 60-day horizon: something
         tomorrow is nearly a full ring, something two months out is a sliver.
         The person reads distance before they read the date. */
      var days = null;
      var when = (live && live.signal) || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
        var t = Date.parse(when + 'T00:00:00Z');
        if (!isNaN(t)) { days = Math.max(0, Math.round((t - Date.now()) / 86400000)); }
      }
      var frac = days === null ? 0 : Math.max(0.06, Math.min(1, 1 - (days / 60)));
      var C = 2 * Math.PI * 38;
      svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 38, class: 'ow-in-track' }));
      svg.appendChild(svgEl('circle', {
        cx: 50, cy: 50, r: 38, class: 'ow-in-arc',
        'stroke-dasharray': (C * frac).toFixed(1) + ' ' + C.toFixed(1),
        transform: 'rotate(-90 50 50)' }));
      /* the day of the month as the dial's face — a numeral, not a sentence */
      var day = when.slice(8, 10).replace(/^0/, '');
      if (day) {
        var num = svgEl('text', { x: 50, y: 50, class: 'ow-in-num',
                                  'text-anchor': 'middle', 'dominant-baseline': 'central' });
        num.textContent = day;
        svg.appendChild(num);
      }
      svg.appendChild(svgEl('circle', { cx: 50, cy: 12, r: 3.4, class: 'ow-in-tick' }));

    } else if (ref === 'location' || ref === 'world') {
      /* RANGE RINGS AND A CROSSHAIR, with the point placed from the REAL
         coordinate — longitude across, latitude down, so two Centers in
         different places do not draw the same picture. */
      [40, 27, 14].forEach(function (r) {
        svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: r, class: 'ow-in-geo' }));
      });
      svg.appendChild(svgEl('line', { x1: 50, y1: 4, x2: 50, y2: 96, class: 'ow-in-cross' }));
      svg.appendChild(svgEl('line', { x1: 4, y1: 50, x2: 96, y2: 50, class: 'ow-in-cross' }));
      var lat = live && typeof live.lat === 'number' ? live.lat : null;
      var lng = live && typeof live.lng === 'number' ? live.lng : null;
      if (lat !== null && lng !== null) {
        var px = 50 + Math.max(-34, Math.min(34, (((lng + 180) % 360) - 180) / 180 * 34));
        var py = 50 - Math.max(-34, Math.min(34, lat / 90 * 34));
        svg.appendChild(svgEl('circle', { cx: px.toFixed(1), cy: py.toFixed(1),
                                          r: 7, class: 'ow-in-halo' }));
        svg.appendChild(svgEl('circle', { cx: px.toFixed(1), cy: py.toFixed(1),
                                          r: 3.6, class: 'ow-in-pin' }));
      }
    } else {
      return null;                       /* no instrument drawn for this kind */
    }
    box.appendChild(svg);
    return box;
  }

  Canvas.prototype.tile = function (it) {
    var self = this;
    var n = doc.createElement('div');
    /* THE CLOSED STATE IS UNIFORM. A sticker and a game and a counter all rest
       the same way — floating, holographic, the App's own light. What they
       BECOME when opened is where they differ. */
    n.className = 'ow-cv-t ow-cv-t--' + esc(it.kind);
    n.setAttribute('data-id', it.id);
    /* ── A TILE KNOWS WHICH CANVAS IT IS ON ────────────────────────────────
       Opening a Popit asks its SURFACE for the full projection, and the surface
       was being read from a module global that every `mount` overwrites. The
       App shell mounts `home:`, `profile:` AND `center:` canvases into one page
       session, so opening a Popit on any canvas but the last-mounted one asked
       the WRONG surface, got `404 that is not on this surface`, and the sheet
       silently stayed at catalog name and blurb — the same "brief info when
       opened" symptom arriving by a different door.

       It is written on the tile because the tile is the only thing that always
       knows, and it survives whatever else mounts afterwards. */
    if (self.surface) { n.setAttribute('data-surface', self.surface); }

    /* ── EVERY POPIT OPENS, AND THE HANDLER LIVES WHERE EVERY POPIT IS ─────
       ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info when
         its popit is opened."*

       Only FIVE kinds could be opened. The open handler was attached at the
       END of the tile builder, and the kinds with a drawn face of their own —
       rhythm, clock, count, since, said, colours, now, links, posts, countdown,
       happening, where — all `return n` BEFORE reaching it. Measured: tapping
       Guestbook opened a sheet and tapping Rhythm did nothing at all.

       Nothing was broken. Twelve early returns each skipped a line at the
       bottom of a long function, and every one of them looked correct on its
       own — which is the argument for the handler living HERE, on the tile,
       where there is exactly one of them, rather than at the end of a path
       there are thirteen of.

       The specialised openers still win: `next` and a Popit app stop
       propagation on their own handlers, so this never double-opens. */
    n.addEventListener('click', function (e) {
      if (inert(n)) { return; }
      if (e.defaultPrevented) { return; }
      OW.canvas.open(it, n);
    });
    /* ── NO TWO POPITS ARE STAMPED FROM THE SAME DIE ─────────────────────
       ★ FOUNDER, 2026-09-03: *"everything in it needs to look NATURAL."*

       A Post has carried this since the beginning: `OW.card` stamps a
       `data-v` from a hash of the object's id, and six variants each give a
       different asymmetric radius, a different seam angle and a different
       breathing period. That is what stops a river of Posts reading as a
       spreadsheet — every one is cut slightly differently, by the same hand.

       Popit tiles had ONE radius and ONE seam angle for every tile on the
       surface, which is why a Home read as tidier and flatter than a feed even
       once the material matched. Same hash, same six variants, same rules —
       the tile just joins the selector list rather than getting a set of its
       own to drift from.

       DERIVED FROM THE PLACEMENT ID, so a Popit keeps its own cut across
       reloads, re-renders and re-arrangements. A variant that changed when you
       moved something would be noise, not character. */
    var _vs = String(it.id || ''), _vh = 5381;
    for (var _vi = 0; _vi < _vs.length; _vi++) {
      _vh = ((_vh << 5) + _vh + _vs.charCodeAt(_vi)) | 0;
    }
    n.setAttribute('data-v', Math.abs(_vh) % 6);
    /* PROJECTED FOR DRAWING, CANONICAL IN `it`. The item keeps its stored
       twelve-column geometry; only what is painted is converted. A width never
       rounds below one column — a Popit projected to nothing would silently
       vanish from a phone, which is the worst possible way to lose an
       arrangement. */
    /* THE PACKED POSITION, not a per-tile projection — see `packed()`. A
       sticker is not in the pack and keeps its own freeform coordinates. */
    var box = (this._pack || {})[it.id];
    /* ── A FREEFORM PLACEMENT IS NOT PROJECTED, AND THE COMMENT ABOVE SAID SO
           BEFORE THE CODE DID ────────────────────────────────────────────────
       "a sticker is not in the pack and keeps its own freeform coordinates" was
       half true: `packed()` correctly leaves it out, and then the FALLBACK ran
       `toView()` on it and projected it anyway — the very thing the sentence
       promised it would not do.

       Measured 2026-09-03 on a real sticker saved at x2 y1 w3 h3 of twelve
       columns, viewed on a 244px grid projected to two columns:

           freeform expectation   left 41px · width 61px
           what rendered          left  0px · width 112px

       It jumped to the left edge and nearly doubled, because x=2/12 floors to
       column 0 and w=3/12 rounds up to a whole column of two. The contract
       already says this must not happen — `shape: "free"`, `grid: false`,
       `FREEFORM_KINDS = ("sticker",)` — and nothing enforced it, which is the
       same failure as the declared `min` that nothing read.

       So a freeform placement is positioned as a FRACTION of the canonical
       twelve, which is what its coordinates have always meant. It lands in the
       same relative spot on a phone as on a desktop, and it is exempt from the
       edge clamp below because a sticker may deliberately hang off a corner —
       clamping is a grid rule, and it is not on the grid. */
    var free = isFree(it);
    var vx, vy, vw, vh;
    if (free) {
      var pct = function (v) { return (Math.max(0, +v || 0) / COLS) * 100; };
      n.style.setProperty('--fx', pct(it.x) + '%');
      n.style.setProperty('--fy', (it.y || 0));
      n.style.setProperty('--fw', pct(it.w || 3) + '%');
      n.style.setProperty('--fh', (it.h || 2));
      n.setAttribute('data-free', '1');
      vx = it.x || 0; vy = it.y || 0; vw = it.w || 3; vh = it.h || 2;
      n.style.setProperty('--x', vx);
      n.style.setProperty('--y', vy);
      n.style.setProperty('--w', vw);
      n.style.setProperty('--h', vh);
    } else {
      vx = box ? box.x : Math.round(this.toView(it.x || 0));
      vy = box ? box.y : (it.y || 0);
      vw = box ? box.w : Math.max(1, Math.round(this.toView(it.w || 3)));
      vh = box ? box.h : (it.h || 2);
      if (vx + vw > this.cols) vx = Math.max(0, this.cols - vw);
      n.style.setProperty('--x', vx);
      n.style.setProperty('--y', vy);
      n.style.setProperty('--w', vw);
      n.style.setProperty('--h', vh);
    }

    /* ★ A POPIT MAY WEAR ITS OWN COLOUR.
       ★ FOUNDER, 2026-08-30: *"colors should be an option to recolor individual
         popits"* · *"Center hue → Popit inherits. Override: Popit-specific hue
         → Popit uses its own appearance."* · *"never be implemented as a
         CSS-only hack."*

       THE OVERRIDE IS DATA AND THIS IS ONLY ITS RENDERING. The angle lives in
       the placement's own config, validated server-side, and this reads it. So
       it persists, survives a reload, moves with the Popit when it is dragged,
       and looks identical on every surface that draws this canvas — because
       every one of them is drawing the same stored fact rather than a local
       style somebody applied.

       SET ON THE TILE, WHICH IS WHY IT CANNOT LEAK. `--ow-h1`/`--ow-h2` are
       inherited custom properties, so scoping them to this element re-colours
       this Popit's material and NOTHING ELSE — the document's own pair is
       untouched, the Center's hue is untouched, and the tile beside it still
       inherits the world. That containment is a property of the cascade rather
       than of a rule somebody has to remember not to break.

       ABSENT IS INHERIT, and absent is the common case: no attribute is written
       at all, so a Popit that has never been recoloured is byte-identical to
       one from before this existed. */
    var look = it.config || {};
    if (look.hue != null && look.hue !== '' && OW.hue && OW.hue.fromAngle) {
      var pair = OW.hue.fromAngle(look.hue);
      n.style.setProperty('--ow-h1', pair[0]);
      n.style.setProperty('--ow-h2', pair[1]);
      /* the third colour rides with the pair (founder/459) */
      if (OW.hue.third) n.style.setProperty('--ow-h3', OW.hue.third(pair[0]) || pair[1]);
      n.style.setProperty('--po-h', parseInt(look.hue, 10) || 0);
      n.setAttribute('data-recoloured', '1');
    } else {
      n.style.removeProperty('--ow-h1');
      n.style.removeProperty('--ow-h2');
      n.style.removeProperty('--ow-h3');
      n.removeAttribute('data-recoloured');
    }
    if (look.treatment) n.setAttribute('data-treat', look.treatment);
    else n.removeAttribute('data-treat');
    /* THE DIRECTIONAL AXIS. Carried on every tile so the stylesheet needs no
       branch; it is 0 for everything the person cannot turn. */
    n.style.setProperty('--rot', (it.rot || 0) + 'deg');
    /* THE DEPTH THIS TILE WAS DRAWN AT, remembered on the item so `refill`
       can tell a resize that crossed a rung from one that did not. Set here
       rather than on first settle, or the FIRST resize after a page load has
       nothing to compare against and silently skips its re-read. */
    it._depth = depthOf(it);
    n.setAttribute('data-size', it._depth);
    if (it.kind === 'popit') { n.setAttribute('data-po', it.ref || ''); }

    /* ── NO TWO OF THEM ARE THE SAME SHAPE ────────────────────────────────
       ★ FOUNDER, 2026-08-25: *"make the popits look less visually symmetrical
         and more free to be arranged."*

       Every face was cut with the SAME eight-value radius, so a wall of them
       read as one repeated shape on a grid — which is the opposite of what a
       hand-cut object is. The landing page varies its beads per position; a
       canvas cannot, because the person decides how many there are and where.

       So the variant is derived from the placement's own id: DETERMINISTIC, not
       random. Random would re-cut every Popit on every render, so a surface
       would never look twice the same and a drag would change the shape of the
       thing being dragged. Same id, same object, forever. */
    var seed = 0, key = String(it.id || it.ref || '');
    for (var si = 0; si < key.length; si++) {
      seed = (seed * 31 + key.charCodeAt(si)) >>> 0;
    }
    var pick = function (n_) { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n_; };
    /* A WIDGET'S CORNER IS CONSISTENT; A BLOB'S IS NOT. These wandered from
       24px to 38px on the same wall, which is what made a grid of Popits read
       as hand-cut shapes rather than as widgets — the founder's reference is
       iOS, where every widget on a page shares one continuous radius. Kept a
       degree of wander so the family's hand is still in it (the feed card does
       the same at 22/19/23/20), but around ONE value instead of across a
       range. Founder, 2026-08-26. */
    /* THE CARD'S RADIUS, so a Popit and a Post are cut the same way. The card
       is `22px 17px 24px 19px`; these wander around the same centre. */
    var RADII = [
      '22px 17px 24px 19px',
      '19px 24px 17px 22px',
      '24px 19px 22px 17px',
      '21px 18px 23px 20px',
      '18px 23px 20px 21px',
      '23px 20px 18px 24px'
    ];
    n.style.setProperty('--po-r', RADII[pick(RADII.length)]);
    /* a degree or two off true — enough that the wall stops reading as a grid,
       not so much that it reads as broken */
    n.style.setProperty('--po-tilt', ((pick(9) - 4) * 0.42).toFixed(2) + 'deg');
    /* ★ `--seam`, NOT `--po-seam`. THIS IS A ROTATION; `--po-seam` IS A LENGTH.
       ★ FOUNDER, 2026-08-30: *"Re-add the dotted lines."*

       `oneway-popit.css` defines `--po-seam: 4px` — WHERE the dotted boundary
       sits, the inset the whole content box is derived from. This line was
       writing a DEGREE into it, so on every Popit tile the seam's
       `inset: var(--po-seam)` resolved to `0.44deg`, which is not a length, so
       the declaration was dropped and the pseudo-element fell back to `auto`
       insets. Measured on the live face: `71.5px 169.9px 71.5px 9.09px` — a
       ring nowhere near the card edge.

       So the boundary has been geometrically wrong on Popits for as long as
       this line has existed, and my removing it earlier hid the symptom rather
       than the cause. The rotation the jitter was actually reaching for is
       `--seam`, which is what the transform reads. Same jitter, correct name,
       and the inset now inherits the Post's 4px. */
    n.style.setProperty('--seam', ((pick(7) - 3) * 0.22 + 0.35).toFixed(2) + 'deg');
    /* the catchlight is hand-placed, so it does not sit in the same spot twice */
    n.style.setProperty('--po-hx', (30 + pick(26)) + '%');
    n.style.setProperty('--po-hy', (8 + pick(10)) + '%');

    /* ── ITS COLOUR IS THE PERSON'S, UNTIL THEY SAY OTHERWISE ─────────────
       ★ FOUNDER, 2026-08-25: *"need to correspond to users hue by default
         unless color is custom changed by the user."*
       No override means the variable is never set, so it INHERITS — change
       your hue and every Popit that follows you changes with it, on every
       device. An override pins this one and stops it following. */
    var ownHue = (it.config && it.config.hue);
    if (ownHue !== undefined && ownHue !== null && ownHue !== '') {
      n.style.setProperty('--po-hue', String(ownHue));
    }
    n.style.zIndex = String(10 + (it.z || 0));

    if (it.kind === 'sticker') {
      /* §20 — an image, positioned, that reacts when you click it. It does NOT
         get the Popit runtime; forcing a card renderer onto a picture is the
         thing the founder asked us not to do, one object smaller. */
      var img = doc.createElement('img');
      img.className = 'ow-cv-sticker';
      /* `OW.data` is the App's layer and is ABSENT in the OS shell. An asset
         path is already absolute and same-origin, so the raw ref is correct
         there; the resolver only matters when the App is opened from a
         different origin in development. */
      img.src = (OW.data && OW.data.asset) ? OW.data.asset(it.ref) : it.ref;
      img.alt = (it.config && it.config.alt) || '';
      img.loading = 'lazy';
      img.draggable = false;
      /* ── THE PERSON TURNS IT, NOT US ──────────────────────────────────
         ★ FOUNDER, 2026-08-25: *"let users change the directional axis of
           stickers themselves."*

         A handle, shown only to somebody who may arrange this surface, that
         rotates the sticker under the pointer. It writes the SAME `rot` the
         server stores and the same one the tile renders, so what you let go of
         is exactly what is saved and exactly what everyone else sees.

         It is a drag on a handle rather than a slider in a panel because the
         axis is a physical property of the object — you turn a sticker by
         turning it. */
      /* ★ ROTATION IS FOR FREEFORM KINDS ONLY.
         ★ FOUNDER, 2026-08-30: *"should auto snap if rotation isnt allowed."*

         The handle was offered on EVERY placement — the comment below even
         says so — while the arrangement model, on both sides, says only a
         sticker is freeform (`FREEFORM_KINDS` in canvas.py, `FREEFORM` here).
         So a Popit could be turned to an angle the grid does not keep, which is
         a control that quietly does not mean what it appears to.

         A grid-bound Popit gets no handle and SNAPS instead — see `settle()`,
         which is what actually enforces it after every gesture. */
      if (this.mayArrange && mayRotate(it)) {
        var turn = doc.createElement('button');
        turn.type = 'button';
        turn.className = 'ow-cv-turn';
        turn.title = 'Turn this sticker';
        turn.setAttribute('aria-label', 'Turn this sticker');
        turn.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();          /* the tile's own drag must not start */
          var box = n.getBoundingClientRect();
          var cx = box.left + box.width / 2, cy = box.top + box.height / 2;
          var start = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
          var was = it.rot || 0;
          /* SAME GUARD AS THE OTHER THREE CAPTURES IN THIS FILE, and it was
             the only one missing it. The reason is already written down at the
             transform box: an unguarded capture THROWS whenever the pointer id
             is not actively down, and takes the whole gesture with it — the
             sticker then neither turned nor selected, silently. Rotation is
             the entire reason a sticker is not a Popit, so the one gesture
             that defines the object was the one left unprotected. */
          try { turn.setPointerCapture(ev.pointerId); } catch (_) {}
          var spin = function (m) {
            var now = Math.atan2(m.clientY - cy, m.clientX - cx) * 180 / Math.PI;
            var deg = was + (now - start);
            /* SHIFT SNAPS TO TWELVE O'CLOCK STEPS. Free by default, because
               the gesture is the point; held, because sometimes straight is
               the point. */
            if (m.shiftKey) { deg = Math.round(deg / 15) * 15; }
            deg = Math.round((((deg + 180) % 360 + 360) % 360 - 180) * 1000) / 1000;
            it.rot = deg;
            n.style.setProperty('--rot', deg + 'deg');
            self.dirty = true;
          };
          var done = function () {
            try { turn.releasePointerCapture(ev.pointerId); } catch (_) {}
            doc.removeEventListener('pointermove', spin);
            doc.removeEventListener('pointerup', done);
            doc.removeEventListener('pointercancel', done);
            self.save();
          };
          doc.addEventListener('pointermove', spin);
          doc.addEventListener('pointerup', done);
          doc.addEventListener('pointercancel', done);
        });
        n.appendChild(turn);
      }

      var anim = (it.config && it.config.animation) || 'none';
      if (anim !== 'none') {
        n.addEventListener('click', function (e) {
          if (inert(n)) return;
          e.stopPropagation();
          img.classList.remove('anim-' + anim);
          /* reflow, or a second click within the animation does nothing */
          void img.offsetWidth;
          img.classList.add('anim-' + anim);
        });
      }
      n.appendChild(img);
      return n;
    }

    if (it.kind === 'collection') {
      /* ── A HIGHLIGHT OR A PLAYLIST, ON THE SAME PLANE ─────────────────
         ★ FOUNDER, 2026-08-30: *"highlights and playlists should feel like
           they are apart of the same plane as the popits and stickers not
           seperate catagories that people can freely move around and
           arrange."*

         SO IT IS A PLACEMENT, NOT A RAIL. The first pass put a row of circles
         and a grid of cards ABOVE the canvas — which made them a category
         sitting on top of the person's arrangement rather than part of it, and
         nothing about them could be moved. Here they are dragged, resized,
         snapped and ordered by exactly the same code as the Clock beside them,
         because they ARE the same kind of object to this canvas.

         THE SHAPE STILL SAYS WHICH IS WHICH. A Highlight reads as a circle and
         a Playlist as a cover with a count — the conventions people already
         know — but both are now wearing the Popit's material and living in the
         Popit's grid. The founder's own rule: differentiate through material
         and composition, not by making people learn a new interaction.

         AND IT SCALES WITH THE TILE. A Highlight at 3x3 is a cover with its
         name; the same Highlight pulled wider shows its count as well. The
         container query does that, so one placement is genuinely several sizes
         rather than one size stretched. */
      var cr = it.resolved || null;
      var cface = doc.createElement(cr ? 'a' : 'div');
      var isPl = cr && cr.collection === 'playlist';
      cface.className = 'ow-cv-face ow-cv-face--coll'
        + (cr ? (isPl ? ' is-playlist' : ' is-highlight') : ' is-gone');
      if (cr) {
        cface.href = '/k/' + encodeURIComponent(it.ref);
        cface.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
          /* THE GUARD EVERY OTHER TILE ALREADY HAD, AND THIS ONE DID NOT.
             Without it, dragging a Highlight and letting go opened the Story
             viewer — and in arrangement a tap both selected the tile and
             opened it. Measured: one tap raised the transform box and the
             viewer together. */
          if (inert(n)) { e.preventDefault(); return; }
          try {
            e.preventDefault();
            doc.dispatchEvent(new CustomEvent('ow:open-collection',
              { detail: { id: it.ref } }));
          } catch (_) {}
        });
        var ct = cr.title || (isPl ? 'Playlist' : 'Highlight');
        var cn = cr.count || 0;
        var cover = cr.cover
          ? '<img class="ow-cv-coll__img" src="' + esc(OW.imageUrl(cr.cover))
            + '" alt="" loading="lazy"/>'
          /* NO COVER IS STILL A FACE — an empty circle reads as a broken
             image, so the initial stands in until they choose one. */
          : '<span class="ow-cv-coll__initial">'
            + esc(ct.trim() ? ct.trim()[0].toUpperCase() : '\u00b7') + '</span>';
        cface.innerHTML =
            '<span class="ow-cv-coll__cover">' + cover
          + (isPl ? '<span class="ow-cv-coll__n">' + esc(cn) + '</span>' : '')
          + '</span>'
          + '<span class="ow-cv-coll__t">' + esc(ct) + '</span>'
          + '<span class="ow-cv-coll__c">' + esc(cn)
          + (isPl ? (cn === 1 ? ' video' : ' videos')
                  : (cn === 1 ? ' story' : ' stories')) + '</span>';
      } else {
        cface.innerHTML = '<span class="ow-cv-kind">Collection</span>'
          + '<span class="ow-cv-name">No longer available</span>'
          + '<span class="ow-cv-sub">This was removed after you placed it.</span>';
      }
      n.appendChild(cface);
      return n;
    }

    if (it.kind === 'event' || it.kind === 'center') {
      /* ── A REFERENCE, DRAWN ───────────────────────────────────────────
         The server sends `resolved` — joined at read time from the canonical
         Event or Center — and never stores it. This draws that join.

         `gone` IS SAID OUT LOUD. An Event cancelled after somebody placed it is
         a real thing that happened in their world; a card that quietly empties
         is indistinguishable from one that failed to load, and the person
         cannot tell whether to remove it or wait. */
      var r = it.resolved || null;
      var face = doc.createElement(r ? 'a' : 'div');
      face.className = 'ow-cv-face ow-cv-face--ref' + (r ? '' : ' is-gone');
      if (r) {
        /* THE HREF IS THE PUBLIC WEB VIEW, AND IT IS THE FALLBACK, NOT THE
           BEHAVIOUR. Founder, 2026-08-24: tapping a placed Event must open the
           APP's Event surface rather than throwing the person out of the App.
           So the click announces an intent the shell routes, and the href
           remains only so the tile is a real link — copyable, openable in a new
           tab, and still correct if the shell is not listening. */
        face.href = (it.kind === 'event' ? '/e/' : '/c/') + encodeURIComponent(it.ref);
        face.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;  /* new tab is theirs */
          if (inert(n)) { e.preventDefault(); return; }
          try {
            e.preventDefault();
            doc.dispatchEvent(new CustomEvent(
              it.kind === 'event' ? 'ow:open-event' : 'ow:enter-center',
              { detail: { id: it.ref } }));
          } catch (_) {
            /* No shell listening — let the link do what links do. */
          }
        });
        var head = it.kind === 'event' ? (r.title || 'Event') : (r.name || 'Center');
        var sub = it.kind === 'event'
          ? [r.date, r.time, r.location].filter(Boolean).join(' · ')
          : [r.category, r.location].filter(Boolean).join(' · ');
        face.innerHTML = '<span class="ow-cv-kind">' +
          esc(it.kind === 'event' ? 'Event' : 'Center') + '</span>' +
          '<span class="ow-cv-name">' + esc(head) + '</span>' +
          (sub ? '<span class="ow-cv-sub">' + esc(sub) + '</span>' : '');
      } else {
        face.innerHTML = '<span class="ow-cv-kind">' +
          esc(it.kind === 'event' ? 'Event' : 'Center') + '</span>' +
          '<span class="ow-cv-name">No longer available</span>' +
          '<span class="ow-cv-sub">This was removed after you placed it.</span>';
      }
      n.appendChild(face);
      return n;
    }

    /* ── A POPIT SHOWS WHAT IT IS FOR, AT REST ───────────────────────────
       ★ FOUNDER, 2026-08-25: *"popits should never just be menu interaction
         buttons — look at widgets on iOS devices"*, and *"a Popit should feel
         like a small interactive holographic interface emerging from the
         Galaxy, not a conventional rectangular web card."*

       This drew `it.label` and nothing else — a name in a box, which is a menu
       button. Meanwhile a placed Event beside it showed its title, date and
       location, because `project()` resolved it. The difference was never
       visual; it was that a Popit had no binding.

       THREE ANSWERS, DRAWN AS THREE DIFFERENT THINGS:
         unbound        — no binding is written for this Popit yet. Its name is
                          the honest whole of what we know, so its name is what
                          it shows. Not an error.
         bound, empty   — there IS a live question here and today's answer is
                          nothing. Say that, quietly. Never fill it.
         bound, content — the projection: the value first, because that is what
                          a person reads in half a second, and the label under
                          it so they know what they are reading.
       Collapsing "no binding" into "nothing to show" would make a whole catalog
       look broken; collapsing it the other way would invent content. */
    var face = doc.createElement('button');
    face.type = 'button';
    face.className = 'ow-cv-face ow-cv-face--po';
    /* ── AND THE NAME WAS THE RAW REF ────────────────────────────────────
       ★ FOUNDER, 2026-08-30: *"Don't render unbound internal concepts as
         user-facing empty boxes... `colours` looks like a backend variable
         leaked into production."*

       This fallback is that leak, still here. `it.label || config.title ||
       it.ref` never asks the CATALOG, which carries the proper name for every
       kind — so a placement with no label of its own drew its identifier.
       Measured 2026-09-12 on the owner's view of a profile: four retirement
       notices reading "marks", "rhythm", "said", "since". It is invisible
       most of the time only because most refs happen to be ordinary words,
       and `happening` is not one of them.

       The catalog first, then a capitalised ref for a kind the catalog no
       longer lists — every retired ref is one English word whose display name
       IS its capitalisation, so that needs no table to drift out of date. */
    var meta0 = catalogEntry(it.ref);
    var name = esc(it.label || (it.config && it.config.title) ||
                   (meta0 && meta0.name) ||
                   (String(it.ref || '').charAt(0).toUpperCase() +
                    String(it.ref || '').slice(1)));
    var live = it.resolved || null;

    /* ── A RETIRED KIND IS ITS OWNER'S BUSINESS, NOT A VISITOR'S ─────────
       ★ FOUNDER, 2026-09-12, retiring six kinds: *"Fewer Popits... Every Popit
         earns its space."*

       The server marks a retired placement rather than deleting it — 78 exist,
       and a layout somebody arranged is theirs. But a visitor cannot act on
       somebody else's retired tile and did not ask to read about a vocabulary
       change, so they simply do not see it: the surface they meet is the new
       twelve, immediately, with nobody's arrangement destroyed to get there.

       THE OWNER SEES IT, AND IS TOLD WHY. Same mechanism as `not_supported`,
       which already draws this distinction — one rule, two reasons a tile
       cannot answer, and the same progressive disclosure for both.

       IT SITS ABOVE EVERY KIND-SPECIFIC RENDERER, and that is the whole
       reason it works. Placed lower it ran after the branches that draw
       their own face — `rhythm` has one — so a retired Rhythm rendered its
       week of bars to a visitor while `marks` and `said` were correctly
       hidden. Measured: 3 of 4 hidden, and the one that was not is the one
       with a renderer of its own. A gate that runs after the thing it
       gates is not a gate. */
    var retiredAs = (it.config && it.config.retired) || '';
    if (retiredAs) {
      /* ★ FOUNDER/424: *"nothing broken and feed is broken again."* Six
         "This Popit has been retired" tombstones on a Home read as a broken
         Home to the person whose Home it is. The notice is for ARRANGING —
         where the tile can be removed — and for nobody else: outside
         arranging, a retired Popit is not drawn, for the owner exactly as for
         a visitor. The placement is not deleted; it is theirs to remove. */
      if (!this.mayArrange || !this.editing) {
        n.setAttribute('data-void', '');
        n.appendChild(face);
        return n;
      }
      face.className += ' is-quiet has-gl is-misplaced';
      var rgl = glyph(it.ref);
      if (rgl) { face.appendChild(rgl); }
      var rtx = doc.createElement('span');
      rtx.className = 'ow-cv-read';
      /* THE NOTICE FITS THE FOOTPRINT. "This Popit has been retired" wraps to
         three lines in a 73px small tile and fills it entirely with an
         apology. At `small` it is one word; the sentence is for a footprint
         that can hold a sentence. Same ladder, same rule.

         THE THRESHOLD IS THE FAMILY'S, NOT A NUMBER FROM THE OLD ONE. This
         read `roomR > 6`, written when small was 3x2 = 6 — so small got the
         word. When the family went square (small 3x3 = 9, wide 6x3 = 18,
         large 36, full 72) every small tile passed 6 and got the sentence,
         and clipped it: MEASURED by A on Home, four 75px tiles reading "This
         Popit has bee…". Same defect as the ROW=44 divisor — a constant
         calibrated to a layout that no longer exists. `small` is the
         smallest footprint the family has; the sentence is for everything
         above it. */
      var packR = (this._pack || {})[it.id];
      var roomR = packR ? (packR.w * packR.h) : ((it.w || 3) * (it.h || 3));
      var smallR = FOOTPRINTS[0][0] * FOOTPRINTS[0][1];
      var roomy = roomR > smallR;
      rtx.innerHTML = '<span class="ow-cv-kind">' + name + '</span>' +
        '<span class="ow-cv-detail">' +
          (roomy ? 'This Popit has been retired' : 'Retired') + '</span>' +
        (roomy
          ? '<span class="ow-cv-sub">Only you can see this \u00b7 remove it when you like</span>'
          : '');
      face.appendChild(rtx);
      n.appendChild(face);
      return n;
    }

    /* ── ONE PLACE THAT KNOWS EACH PROJECTION'S SHAPE ────────────────────
       The `popits` domain shapes each kind's content for the size it was
       asked at — `now` answers {status,label}, `next` answers {next,items},
       `said` answers {unread,latest}. This renderer previously read a single
       {signal,detail} shape and, when the domain's contract improved, every
       bound Popit silently fell through to "Nothing right now" while the API
       was returning real content. Measured 2026-08-25.

       So the mapping lives here, once, per kind — and anything it does not
       recognise renders its label rather than a wrong reading. */
    function reading(ref, c) {
      if (!c) { return null; }
      if (ref === 'now') {
        /* ── ONE WORD IS NOT A WIDGET ──────────────────────────────────
           ★ FOUNDER, 2026-09-12: *"NOW 'online' ???? what have u been working
             on ?"*  A 160x70 tile said exactly one word, because this read
           `activity` — which only exists when a connector has reported one —
           and `at_center`, which the presence view has NEVER returned.

           WHAT A PERSON'S STATUS ACTUALLY IS, in the order they read it: the
           word, then what they said about it or what they are doing, then when
           they were last here. The third is the one that is always available
           and it was being held back to `open` for no reason. */
        /* ── THE READING CHOOSES ITS LINE; CSS DOES NOT DISCARD MEANING ──
           My first fix put the last-seen time in `sub`, and it never rendered:
           `@container (max-width:220px)` hides `.ow-cv-sub`, and a WIDE
           footprint on a phone is 160px — so the third line is hidden on every
           phone there is. The substance was being emitted into the one slot
           guaranteed to be dropped.

           That rule is correct and stays: three lines do not fit in 160x70.
           What was wrong is a reading that emits two supporting lines and
           leaves it to the stylesheet to pick. The tile gets ONE, and the
           reading picks it, in the order a person cares:

               what they are doing  ->  what they said  ->  when they were here

           The time is the only one that is ALWAYS available, which is why it
           is the floor rather than the flourish. The activity's source stays
           in `sub` because it is genuinely secondary — a caption on a line
           that is already there, safe to lose on a narrow tile. */
        /* ── AND IT WAS READING TWO KEYS THE PROJECTION DOES NOT SEND ───
           ★ FOUNDER, 2026-09-13: *"HAVE THIS JUST BE A USER STATUS POPIT SO
             NOT SHALLOW."*

           `c.activity` has never existed — presence answers `activities`, and
           now `doing` — and `c.text` has never existed either. So the whole
           first branch was dead and every Now tile fell through to the status
           word. The complaint was accurate and the cause was two names.

           THE SUBJECT OF A STATUS IS THE PERSON. The tile led with the STATE,
           which is why "Online" read as a machine reporting rather than
           somebody being somewhere. Their name leads now and the state is what
           is said ABOUT them — which is the order the sentence has in English
           and the order every messaging product puts it in.

           ONE SUPPORTING LINE, AND THE READING PICKS IT — the same rule this
           tile already had, applied to what is actually available: what they
           are doing if anything reports it, otherwise the state and when they
           were last here, together, because "Online" alone is the complaint
           and "just now" alone does not say what. `sub` never carries the only
           substance: `@container (max-width:220px)` drops it on every phone. */
        var doing = c.doing || null;
        var who = (c.who || '').trim();
        var when = c.last_seen || c.seen || '';
        var state = c.label || '';
        var said = doing && doing.title ? doing.title : '';
        if (who) {
          return { sig: who,
                   detail: said || (state + (when ? ' \u00b7 ' + when : '')),
                   sub: said ? (state + (when ? ' \u00b7 ' + when : ''))
                             : ((doing && doing.source) || '') };
        }
        return { sig: state,
                 detail: said || when,
                 sub: said ? when : ((doing && doing.source) || '') };
      }
      if (ref === 'events' || ref === 'next' || ref === 'calendar') {
        var n = c.next; if (!n) { return null; }
        /* ── A CANCELLED EVENT MUST NOT READ LIKE A LIVE ONE ──────────────
           Measured on a real Centre: this tile said "SEP 12 · Boardwalk
           Concert · 23:00" for an event that had been CANCELLED. `cancelled`
           is a PUBLIC state on purpose — somebody who planned around it needs
           to learn it is off — but the reading gave no sign, which is the most
           confident possible way to be wrong about a person's evening.

           It replaces the time rather than sitting beside it, because the time
           is the part that is no longer true. */
        if (n.state && n.state !== 'scheduled' && n.state !== 'live') {
          return { sig: n.title || '',
                   detail: n.state === 'cancelled' ? 'Cancelled'
                         : n.state === 'ended' ? 'Ended' : String(n.state),
                   sub: n.center || '' };
        }
        var when = [n.date || '', n.time || ''].filter(Boolean).join(' · ');
        return { sig: n.title || '', detail: when,
                 sub: n.location || (c.more ? ('+' + c.more + ' more') : ''),
                 partial: !!c.partial };
      }
      if (ref === 'location' || ref === 'world') {
        /* ── THE CITY LEADS; THE CHAIN FOLLOWS ──────────────────────────
           ★ FOUND BY `tools/probe/clipped.js` on a real Centre, 2026-09-09:
           this tile had 140px of content in a 110px box — 30px hidden, with
           nothing saying so. The whole chain, "Atlantic City · New Jersey ·
           United States", was going into `sig`, which is the largest type on
           the tile; at 6x3 that is three lines and the third is gone.

           A PLACE HAS A NATURAL LADDER AND THE PROJECTION ALREADY SENDS IT.
           `_place_project` returns `city`, `region` and `country` separately,
           and the one a person reads is the city — the rest says WHICH
           Atlantic City. So the city is the signal and the chain is the
           detail, which fits, reads better, and is the same "size is
           projection depth" rule the rest of this file runs on. The full
           chain, the zone and the local date are all in the opened Popit.

           AND THE OLD `detail` WAS COORDINATES. "39.364, -74.423" is what this
           codebase calls a machine's shape — its own comment on the Where
           Popit says *"a widget showing a real value a person cannot read is
           as hollow as an empty one."* It is gone; the point is still in the
           payload for anything that needs to plot. */
        var city = c.city || '';
        var rest = [c.region || '', c.country || ''].filter(Boolean).join(' \u00b7 ');
        if (!city && c.label) {
          /* an older payload with only the joined chain — split it rather than
             printing three lines into a one-line slot */
          var bits = String(c.label).split(' \u00b7 ');
          city = bits.shift() || '';
          rest = bits.join(' \u00b7 ');
        }
        return { sig: city || c.label || 'On the map',
                 detail: rest,
                 sub: c.local_date || '' };
      }
      /* ── FOLLOWING ────────────────────────────────────────────────
         ★ FOUNDER, 2026-09-12: *"Following — Followed Centers/people — opens
           Their latest content."*

         The tile names the first place and how many there are; opening it is
         the handoff to their content, which is the canonical Feed rather than
         anything rebuilt here. */
      if (ref === 'following') {
        var fl = c.latest || {};
        if (!fl.name) { return null; }
        var fn = c.count || 0;
        return { sig: fl.name,
                 detail: fn > 1 ? ((fn - 1) + ' more') : '',
                 sub: fn === 1 ? '1 place' : (fn + ' places'),
                 /* THE PLACE THIS NAMES HAS A FACE — see `faceNode`. Carried
                    on the reading rather than looked up again in the renderer,
                    so the tile and the row underneath it show the same one. */
                 face: fl.face || null, faceName: fl.name, faceKind: 'center' };
      }
      /* ── ABOUT ────────────────────────────────────────────────────────
         ★ FOUNDER: *"About — Short identity/about — opens Full profile/Center
           information."*  The name leads and the sentence follows it, which is
         the same order a Post uses for a person. */
      if (ref === 'about') {
        if (!c.name && !c.about) { return null; }
        return { face: c.face || null, faceName: c.name || '',
                 faceKind: (c.pronouns || c.bio) ? 'person' : 'center',
                 sig: c.name || '',
                 detail: c.about || '',
                 sub: c.kind || '' };
      }
      /* ── A CENTER'S WEBSITE, ON ITS CANVAS (founder/590) ─────────────────
         "centers should be shapable canvases and displays of websites" — the
         operator places and sizes this like any Popit; it says whose site it
         is, the line it opens with, and how much of it there is, and opening
         it goes to the site itself (`opens: site`). */
      if (ref === 'website') {
        if (!c.name && !c.count && !c.website) { return null; }
        var wsub = c.count ? (c.count === 1 ? 'One page' : c.count + ' pages') : '';
        if (c.website && c.website.host) { wsub = wsub ? wsub + ' \u00b7 ' + c.website.host : c.website.host; }
        return { face: c.face || null, faceName: c.name || '', faceKind: 'center',
                 sig: c.name || '', detail: c.line || '', sub: wsub };
      }
      if (ref === 'said') {
        var l = c.latest || {};
        return { sig: c.unread ? String(c.unread) : (l.who || ''),
                 detail: c.unread ? (l.who || '') : (l.preview || ''),
                 sub: c.unread ? (l.preview || '') : '' };
      }
      if (ref === 'links') {
        return { sig: c.name || '', detail: c.category || '', sub: c.city || '' };
      }
      /* ── A WALL READS AS THE LAST PERSON WHO SIGNED IT ──────────────────
         The projection carries {count, latest, items}. What a person wants
         from a glance at their own wall is WHO came by and WHAT they said —
         the count is context, not the headline, so it takes the sub line.

         A REMOVED ENTRY KEEPS ITS PLACE. The wall itself leaves a tombstone
         rather than a silent hole, and a tile that quietly skipped removed
         entries would disagree with the surface it is a window onto. */
      /* ── ONE THING SOMEBODY CHOSE TO SHOW ───────────────────────────────
         The projection carries the post, already filtered by the server to
         what a stranger may see — a chosen post that is restricted, deleted or
         gone arrives as no answer at all, so there is nothing to guard here
         and nothing to leak. What the tile shows is the words; whose they are
         is the sub line, because a favourite is about the thing, not the
         attribution. */
      /* ── PLACES YOU HAVE BEEN ────────────────────────────────────────────
         The most recent place leads, because "where have I been lately" is
         the question a glance asks. How you came to be there is the detail —
         a guest's relationship is a real one and the platform already says so
         in those words. */
      if (ref === 'places' || ref === 'visited') {
        /* ── SAME CONSTANT, ONE LEVEL OUT ──────────────────────────────
           The opened sheet had seven rows whose value was the word "visits";
           this is the TILE saying it about the one place it shows. I fixed the
           sheet first and saw the tile still doing it in the next screenshot,
           which is the argument for looking at the thing rather than at the
           diff — the same constant lived in two renderers for one kind.

           WHEN, not HOW. `at` is in the payload; `how` is dropped when it is
           the ordinary case and kept when it is not, because a membership is
           not a visit. */
        var vl = c.latest || {};
        if (!vl.name) { return null; }
        var vn = c.count || 0;
        return { sig: vl.name,
                 detail: dayWhen(vl.at, vl.how, 'visits'),
                 sub: vn > 1 ? (vn + ' places') : '',
                 face: vl.face || null, faceName: vl.name, faceKind: 'center' };
      }
      /* ── WALLS YOU HAVE SIGNED ───────────────────────────────────────────
         THE SERVER ANSWERED AND THE CLIENT COULD NOT DRAW IT. `marks` was
         bound, registered, adopted and proven — `state: "available", count: 2`
         on the wire — and this function had no branch for it, so it fell
         through to the unrecognised-shape tail, returned null, and the tile
         drew NOTHING RIGHT NOW. A Popit with content rendering its own empty
         state, which is the three-answers law broken from the other side: the
         server said `available` and the surface said nothing is here.

         Nothing failed. It is the same family as a class nobody styles — the
         half that was built works perfectly and the half that draws it was
         never written. I shipped the binding today and did not open it on a
         person who HAD marks; Bo did, and it read empty for hours.

         It is Visited read from the other end, so it is Visited's shape: the
         most recent wall leads, because "where have I signed lately" is the
         question a glance asks. The OWNER is the reading — a mark is somebody
         else's page with your handwriting on it — and the count is the sub. */
      /* ── HOW LONG IT HAS BEEN ────────────────────────────────────────────
         The number leads, because that is the whole reading — "412" then
         "days", the way a person says it out loud. The caption is what they
         are counting from and it is theirs, so it goes in the sub where their
         own words go. */
      if (ref === 'since') {
        if (!c.value) { return null; }
        return { sig: String(c.value),
                 detail: c.unit || '',
                 sub: c.caption || '' };
      }
      if (ref === 'marks') {
        var ml = c.latest || {};
        if (!ml.name) { return null; }
        var mn = c.count || 0;
        return { sig: ml.name,
                 detail: 'you signed',
                 sub: mn ? (mn === 1 ? '1 wall' : mn + ' walls') : '' };
      }
      if (ref === 'favourite') {
        var fb = (c.body || '').trim();
        if (!fb) { return null; }
        return { sig: fb, detail: '', sub: c.who ? ('by ' + c.who) : '' };
      }
      if (ref === 'guestbook') {
        var g = c.latest || {};
        if (!g.who && !g.body) { return null; }
        var n = c.count || 0;
        return { sig: g.who || '',
                 detail: g.removed ? 'Entry removed' : (g.body || ''),
                 sub: n ? (n === 1 ? '1 signature' : n + ' signatures') : '' };
      }
      /* an unrecognised shape is not a reading */
      return (c.signal || c.detail)
        ? { sig: c.detail || c.signal, detail: c.signal || '', sub: c.location || '' }
        : null;
    }
    /* ── A CLOCK IS ITS OWN FACE, AND IT IS ASKED FIRST ───────────────────
       It has no server binding, so `reading()` returns null for it and every
       branch below is about what the runtime said. Placed after them, this
       never ran at all: the tile rendered as an unbound Popit with a glyph and
       the word "Clock". A Popit whose content is the CURRENT TIME does not
       need the server to have answered anything. */
    /* ── THE KINDS THAT CARRY THEIR OWN CONTENT ──────────────────────────
       ★ FOUNDER, 2026-09-05: *"popits go most need designs still"*

       Measured: five of eighteen kinds render something of their own; thirteen
       rendered the SAME generic three-line panel — the catalog's blurb over
       the words NOTHING HERE YET. A Count looked like a Marks looked like a
       Guestbook, and none of them could hold anything anyway (the server
       stored no field for them until this pass).

       These three are the ones whose content is the person's own and needs no
       server binding: a number, a date, a sentence. Each is built in the
       language the working five already established — the eyebrow, the value
       that carries the tile, the sentence under it — because the standing rule
       is to reuse the component language and generate CONTENT, never a new
       visual grammar. Nothing here is a new material, a new colour or a new
       shape; it is the existing panel finally given something to say.

       THE EMPTY STATE IS NOT A FAILURE, IT IS AN INVITATION, and only on your
       own surface: a stranger looking at a Count you have not set should see
       nothing rather than a prompt addressed to you. */
    /* ── RHYTHM IS A SHAPE, SO IT IS DRAWN RATHER THAN SAID ──────────────
       ★ CATALOG: *"The shape of your week."*

       Seven bars and a total. No names, no bodies, no ids — the projection
       deliberately carries none, because a rhythm is a shape and anything more
       would be a feed with a chart on it.

       Built from the same tokens as everything else: the track is `--ow-seam`,
       the bars are `--ow-h1-ink`, which is the accent already clamped for
       legibility in both themes. No new colour, no new material. */
    if (it.ref === 'rhythm' && it.resolved && it.resolved.days) {
      var rr = it.resolved;
      face.className += ' ow-cv-face--own ow-cv-face--rhythm';
      var rbody = doc.createElement('div');
      rbody.className = 'ow-cv-own';
      var reye = doc.createElement('div');
      reye.className = 'ow-cv-kind';
      reye.textContent = (_catalog[it.ref] || {}).name || 'Rhythm';
      rbody.appendChild(reye);

      var bars = doc.createElement('div');
      bars.className = 'ow-cv-rhythm';
      var peak = Math.max(1, rr.peak || 1);
      (rr.days || []).forEach(function (d, i) {
        var col = doc.createElement('div');
        col.className = 'ow-cv-rhythm__d';
        var bar = doc.createElement('div');
        bar.className = 'ow-cv-rhythm__b';
        /* a day with nothing keeps its column and shows an empty track — a
           week is seven days whether or not you were busy */
        bar.style.height = Math.round((d / peak) * 100) + '%';
        if (!d) bar.setAttribute('data-none', '');
        col.appendChild(bar);
        if (rr.labels && rr.labels[i]) {
          var lb = doc.createElement('span');
          lb.className = 'ow-cv-rhythm__l';
          lb.textContent = rr.labels[i];
          col.appendChild(lb);
        }
        bars.appendChild(col);
      });
      rbody.appendChild(bars);

      /* ── A WEEK OF EMPTY BARS IS NOT A READING ────────────────────────────
         ★ FOUNDER, 2026-09-08: *"RHYTHM SHOULD BE MORE DETAILED BY DEFAULT
           UNLESS USER CHOOSES THIS PRESENTATION... ITS ALMOST JOKE LIKE."*

         The tile drew seven bars and "3 this week" — and on a quiet week that
         is six empty columns and a number, which says nothing a person did not
         already know about their own days.

         The projection now carries what a rhythm actually IS: the busiest day
         by name, how many of the seven had anything, last week's total and the
         direction between them, and the run still going. All of it came from
         rows that were already being read and thrown away. This draws it.

         THE BARS-ONLY PRESENTATION REMAINS A CHOICE, not the default —
         `config.style = 'bars'` — because a person who wants the shape without
         the words should still get it. */
      var rline = doc.createElement('div');
      rline.className = 'ow-cv-own__cap';
      rline.textContent = rr.total === 1 ? '1 this week' : rr.total + ' this week';
      rbody.appendChild(rline);

      if ((it.config || {}).style !== 'bars') {
        var bits = [];
        /* THE DIRECTION FIRST — it is the only part that needs last week, and
           it is the part a person cannot work out by looking at the bars. */
        if (rr.trend && typeof rr.prev_total === 'number') {
          bits.push(rr.trend === 'up' ? 'up from ' + rr.prev_total
                  : rr.trend === 'down' ? 'down from ' + rr.prev_total
                  : 'same as last week');
        }
        if (rr.peak_day && rr.peak > 0) {
          bits.push('busiest ' + rr.peak_day.charAt(0) +
                    rr.peak_day.slice(1).toLowerCase());
        }
        if (typeof rr.streak === 'number' && rr.streak > 1) {
          bits.push(rr.streak + ' days running');
        } else if (typeof rr.active_days === 'number') {
          bits.push(rr.active_days === 1 ? 'one day of seven'
                                         : rr.active_days + ' days of seven');
        }
        if (bits.length) {
          var rsub = doc.createElement('div');
          rsub.className = 'ow-cv-own__sub';
          rsub.textContent = bits.join(' · ');
          rbody.appendChild(rsub);
        }
      }
      face.appendChild(rbody);
      n.appendChild(face);
      return n;
    }

    if (it.ref === 'count' || it.ref === 'since' || it.ref === 'said'
        || it.ref === 'colours' || it.ref === 'now' || it.ref === 'links') {
      var cfg0 = it.config || {};
      var own = null;

      if (it.ref === 'count') {
        /* A NUMBER IS THE WHOLE TILE. Absent and zero are different: zero is a
           fact somebody chose to show, absent is a Popit nobody has filled. */
        if (typeof cfg0.value === 'number') {
          own = { sig: String(cfg0.value), detail: cfg0.caption || '' };
        }
      } else if (it.ref === 'since') {
        var t0 = cfg0.started ? Date.parse(cfg0.started) : NaN;
        if (t0 && !isNaN(t0)) {
          /* SAID IN WHOLE UNITS, because "3.7 months" is a measurement and
             this is a person's own milestone. The unit steps up as it grows so
             the number stays small enough to read at a glance. */
          var days = Math.floor((Date.now() - t0) / 86400000);
          var word, n0;
          if (days < 0) { n0 = -days; word = n0 === 1 ? 'day away' : 'days away'; }
          else if (days < 31) { n0 = days; word = n0 === 1 ? 'day' : 'days'; }
          else if (days < 365) { n0 = Math.floor(days / 30); word = n0 === 1 ? 'month' : 'months'; }
          else { n0 = Math.floor(days / 365); word = n0 === 1 ? 'year' : 'years'; }
          own = { sig: String(n0), unit: word, detail: cfg0.caption || '' };
        }
      } else if (it.ref === 'colours') {
        /* ── EVERYBODY HAS A LIGHT, SO THIS IS NEVER EMPTY ────────────────
           The other three are empty until somebody fills them. Colours is
           not: a person always has a hue, either one they pinned onto this
           placement or the one they are following. Rendering "NOTHING HERE
           YET" over a light that plainly exists was the tile disagreeing with
           the rest of the screen, which is painted in that same light.

           The two states are worth telling apart, because one of them is a
           decision: PINNED is a colour chosen for this tile and held there;
           FOLLOWING means change your hue and this changes with it, which is
           the founder's rule about a Popit following its person. */
        var pinned = cfg0.hue !== undefined && cfg0.hue !== null && cfg0.hue !== '';
        own = { light: true, pinned: pinned,
                detail: pinned ? (parseInt(cfg0.hue, 10) + '\u00b0') : 'Your own light' };
      } else if (it.ref === 'links') {
        var ls = (cfg0.links || []).filter(function (l) { return l && l.url; });
        if (ls.length) own = { links: ls };
      } else if (cfg0.text) {
        /* A SENTENCE IS THE VALUE. It gets the tile's own voice rather than a
           number's weight, so it wraps and is never cut — the rung is the
           whole sentence or nothing, which is this lane's rule everywhere. */
        own = { say: cfg0.text };
        /* ── AND FOR A STATUS, THE SENTENCE IS NOT THE WHOLE VALUE ────────
           ★ FOUNDER, 2026-09-13: *"HAVE THIS JUST BE A USER STATUS POPIT SO
             NOT SHALLOW."*

           MEASURED on loop.ada's home: a Now carrying a status message drew
           the message and NOTHING ELSE — no picture, no name, no state, no
           last-seen — because this branch runs INSTEAD of the bound reading
           rather than beside it. The projection had already answered with all
           four and the tile threw the answer away.

           That is the shallow tile, and it is shallow in the worst place: the
           kind whose whole subject is a person. On MSN the personal message
           never replaced you — it sat under your picture and your name, with
           your state beside them. Four facts, one of which is the sentence.

           So the sentence stays the loud part and the person comes back
           around it. `count`, `colours` and `links` are about a value, a light
           and places; only `now` is about somebody. */
        if (it.ref === 'now' && it.resolved && (it.resolved.who || it.resolved.face)) {
          own.person = it.resolved;
        }
      }

      if (own) {
        face.className += ' ow-cv-face--own ow-cv-face--' + it.ref;
        var body0 = doc.createElement('div');
        body0.className = 'ow-cv-own';

        var eyebrow = doc.createElement('div');
        eyebrow.className = 'ow-cv-kind';
        eyebrow.textContent = (_catalog[it.ref] || {}).name || it.ref;
        body0.appendChild(eyebrow);

        if (own.links) {
          /* ── A SHELF OF PLACES, NOT A LIST OF URLS ─────────────────────
             A person reads "anywhere else you are" as names, so the label
             leads and the host is the quiet half. A row with no label falls
             back to its host rather than showing a raw URL, because a raw URL
             is a machine's shape — the same reason the Connected Location
             Popit formats a timestamp instead of relaying one.

             THE LADDER REMOVES WHOLE ROWS. A shelf that cannot fit six shows
             four; it never shows six cut ones. */
          /* ── THE LADDER THE COMMENT ABOVE PROMISES, WHICH DID NOT EXIST ──
             ★ MEASURED 2026-09-09 in the Popit demo, at 375x812: a Links Popit
             with three links on a 6x3 tile rendered

                 The pier · Tide times · The
                 bandstand          <- sliced by the tile's bottom edge

             The comment directly above says *"THE LADDER REMOVES WHOLE ROWS. A
             shelf that cannot fit six shows four; it never shows six cut
             ones."* The code was `own.links.forEach` with no cap at all. The
             intent was written down and the implementation never was.

             AND THE ACTUAL CUT WAS A WRAP, not a row count. "The bandstand" is
             one link whose NAME wrapped to two lines in a narrow tile, so the
             row grew and the tile clipped it mid-word. A row cap alone would
             not have caught it.

             So both halves: a name is ONE line, ellipsised if it is long — a
             shortened name is still a name and the full one is in the room —
             and the number of rows is capped to what the tile can actually
             hold, with the remainder NAMED. That is the third instance of one
             rule today (the Count that drew "124", the wall of forty that said
             six, this): A SURFACE THAT SHOWS LESS THAN THE TRUTH MUST SAY SO.

             The cap comes from the PACKED height, which is the tile really on
             screen — the same source the clock and where faces use, and for
             the reason recorded there: a naive projection can seat a Popit in
             fewer rows than its stored size suggests. */
          var lpk = (this._pack || {})[it.id];
          var lrows = lpk ? lpk.h : (it.h || 3);
          /* one row of the grid is roughly 28px and the kind label eats the
             first; each link row is ~21px. Floor of one so a 1-row Links tile
             still shows a link rather than only a remainder. */
          /* NOT `lcap` — that name is taken by the colours caption in the
             branch below, and `var` hoists to the whole function. Two branches
             that never both run would still be two declarations of one name. */
          var linkCap = Math.max(1, Math.floor((lrows * 28 - 34) / 21));
          var lall = own.links;
          var lshown = lall.slice(0, linkCap);
          var list0 = doc.createElement('div');
          list0.className = 'ow-cv-own__links';
          lshown.forEach(function (l) {
            var host = '';
            try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) {}
            var a = doc.createElement('a');
            a.className = 'ow-cv-own__link';
            a.href = l.url;
            a.target = '_blank';
            /* it leaves this platform, so it leaves without a handle on us */
            a.rel = 'noopener noreferrer';
            /* ★ FOUNDER/471 §10–11: the platform recognised from the link
               itself and drawn as its own mark (447), before the word */
            var plat = (OW.links && OW.links.platformOf) ? OW.links.platformOf(l.url) : null;
            if (plat && OW.links.icon) {
              var mk0 = doc.createElement('span');
              mk0.className = 'ow-cv-own__linkm';
              mk0.setAttribute('data-platform', plat.key);
              mk0.innerHTML = OW.links.icon(plat.key);
              a.appendChild(mk0);
            }
            var nm = doc.createElement('span');
            nm.className = 'ow-cv-own__linkn';
            nm.textContent = l.label || (plat && plat.key !== 'web' ? plat.name : '') || host || 'Link';
            a.appendChild(nm);
            if (host && l.label) {
              var hs = doc.createElement('span');
              hs.className = 'ow-cv-own__linkh';
              hs.textContent = host;
              a.appendChild(hs);
            }
            list0.appendChild(a);
          });
          /* THE REMAINDER, NAMED. Same rule and same words as the guestbook
             face: a shelf that shows three of five says so. */
          if (lall.length > lshown.length) {
            var lmore = doc.createElement('span');
            lmore.className = 'ow-cv-own__linkmore';
            lmore.textContent = 'and ' + (lall.length - lshown.length) + ' more';
            list0.appendChild(lmore);
          }
          body0.appendChild(list0);
        } else if (own.light) {
          var swatch = doc.createElement('div');
          swatch.className = 'ow-cv-own__light';
          body0.appendChild(swatch);
          var lcap = doc.createElement('div');
          lcap.className = 'ow-cv-own__cap';
          lcap.textContent = own.detail;
          body0.appendChild(lcap);
        } else if (own.say) {
          /* THE PERSON FIRST, THEN WHAT THEY SAID, THEN HOW THEY ARE — the
             order the sentence has when a person says it out loud, and the
             order every messaging product has used since MSN. */
          var pr = own.person;
          if (pr) {
            var pf0 = faceNode(pr.face, pr.who, 'person');
            var head = doc.createElement('div');
            head.className = 'ow-cv-own__who';
            if (pf0) { head.appendChild(pf0); }
            if (pr.who) {
              var nm0 = doc.createElement('span');
              nm0.className = 'ow-cv-own__nm';
              nm0.textContent = pr.who;
              head.appendChild(nm0);
            }
            if (head.firstChild) {
              face.className += ' has-face';
              body0.appendChild(head);
            }
          }
          var q = doc.createElement('div');
          q.className = 'ow-cv-own__say';
          q.textContent = own.say;
          body0.appendChild(q);
          if (pr && (pr.label || pr.last_seen)) {
            var st0 = doc.createElement('div');
            st0.className = 'ow-cv-own__cap';
            st0.textContent = (pr.label || '') +
              (pr.last_seen ? ' \u00b7 ' + pr.last_seen : '');
            body0.appendChild(st0);
          }
        } else {
          var big = doc.createElement('div');
          big.className = 'ow-cv-own__n';
          big.textContent = own.sig;
          /* ── A CUT NUMBER IS WRONG, NOT MERELY CRAMPED ──────────────────
             ★ MEASURED 2026-09-09 in the Popit demo: a Count of 1247 in a
             3-column tile rendered "124". Not clipped-looking — CLIPPED, so
             the tile stated a different number than the one stored. This file
             already records the identical failure in the Clock: a London clock
             told it had six columns chose the `xl` ladder and drew "10:43:4",
             *"a CUT TIME, which is wrong rather than merely cramped."*

             The type is sized in `cqw`, which knows the tile's width and
             nothing about how many characters are going into it — so the
             ladder is correct for three digits and overflows at four. The
             caption beside it already carries the rule ("NEVER CUT ... the
             tile gives way elsewhere"); the number did not.

             The count of characters is the missing input, and it is known here
             for free. CSS divides its ladder by it, so four digits get a
             narrower ladder rather than a narrower tile, and nothing has to
             measure anything after layout. */
          big.style.setProperty('--po-digits',
            String(Math.max(2, String(own.sig == null ? '' : own.sig).length)));
          body0.appendChild(big);
          if (own.unit) {
            var u = doc.createElement('div');
            u.className = 'ow-cv-own__u';
            u.textContent = own.unit;
            body0.appendChild(u);
          }
          if (own.detail) {
            var cap = doc.createElement('div');
            cap.className = 'ow-cv-own__cap';
            cap.textContent = own.detail;
            body0.appendChild(cap);
          }
        }
        face.appendChild(body0);
        n.appendChild(face);
        return n;
      }
    }

    if (it.ref === 'clock') {
      face.className += ' ow-cv-face--clock';
      /* THE VIEW WIDTH, NOT THE STORED ONE. Density has to describe the tile
         that is actually on the screen: a canonical 3-wide Popit is a QUARTER
         of a four-column phone, and handing the density ladder the number 3
         made it lay out for three columns' worth of room it does not have.
         Measured — the last two breakages in a 640-shape phone sweep were both
         this, and both vanished when the projected width was passed instead. */
      /* THE PACKED WIDTH, NOT THE PROJECTED ONE. `packed()` may seat a Popit
         in fewer columns than a naive projection suggests, and the density
         ladder has to describe the tile that is really on screen. Measured: a
         London clock was told it had six columns, chose the `xl` ladder with
         seconds, and rendered "10:43:4" — a CUT TIME, which is wrong rather
         than merely cramped. */
      var pb = (this._pack || {})[it.id];
      face.appendChild(clockFace(it.config || {},
        pb ? pb.w : Math.max(1, Math.round(this.toView(it.w || 3))),
        pb ? pb.h : (it.h || 2)));
      n.appendChild(face);
      return n;
    }
    if (it.ref === 'where') {
      face.className += ' ow-cv-face--where';
      var wp = (this._pack || {})[it.id];
      face.appendChild(whereFace(it.config || {},
        wp ? wp.w : Math.max(1, Math.round(this.toView(it.w || 6))),
        wp ? wp.h : (it.h || 2),
        this.surface));
      n.appendChild(face);
      return n;
    }
    if (it.ref === 'countdown') {
      face.className += ' ow-cv-face--next';
      var np = (this._pack || {})[it.id];
      face.appendChild(countdownFace(it.config || {},
        np ? np.w : Math.max(1, Math.round(this.toView(it.w || 6))),
        np ? np.h : (it.h || 2),
        this.surface,
        function (id, from) {
          doc.dispatchEvent(new CustomEvent('ow:open-event',
            { detail: { id: id, event_id: id, from: from } }));
        }));
      n.appendChild(face);
      return n;
    }
    /* ── WHAT'S HAPPENING, ASKED FOR THE SAME REASON AS LATEST ───────────
       Its content comes from the events domain, not the canvas `live` payload,
       so it has to be seated above the branches that ask what the runtime said. */
    if (it.ref === 'happening') {
      face.className += ' ow-cv-face--hap';
      var hp = (this._pack || {})[it.id];
      face.appendChild(happeningFace(it.config || {},
        hp ? hp.w : Math.max(1, Math.round(this.toView(it.w || 6))),
        hp ? hp.h : (it.h || 3),
        this.surface,
        function (id, from) {
          doc.dispatchEvent(new CustomEvent('ow:open-event',
            { detail: { id: id, event_id: id, from: from } }));
        }));
      n.appendChild(face);
      return n;
    }
    /* ── LATEST, ASKED HERE FOR THE CLOCK'S REASON ───────────────────────
       Its content comes from the feed, not from the canvas `live` payload, so
       `reading()` returns null for it too and every branch below is about what
       the canvas runtime said. Seated after them it would render as an unbound
       Popit with a glyph and the word "Latest" — the exact failure the clock
       had before it was moved above them. */
    if (it.ref === 'posts') {
      face.className += ' ow-cv-face--posts';
      var pp = (this._pack || {})[it.id];
      face.appendChild(postsFace(it.config || {},
        pp ? pp.w : Math.max(1, Math.round(this.toView(it.w || 6))),
        pp ? pp.h : (it.h || 3),
        this.surface,
        function (id, from) {
          /* The canvas does not know what a Post surface is, and must not.
             It says what happened and the App decides — the same seam
             `ow:open-collection` and `ow:open-event` already use. */
          doc.dispatchEvent(new CustomEvent('ow:open-post',
            { detail: { id: id, from: from } }));
        }));
      n.appendChild(face);
      return n;
    }
    /* ── A PUBLISHED APP OR GAME, CLOSED ─────────────────────────────────
       ★ FOUNDER, 2026-09-09: *"could be anything but starts out as a similar
         looking square rectangle and sometimes square and share design
         language"* and *"i want full games to be able to be built uploaded and
         played in these like newgrounds."*

       MEASURED: a game published through the real endpoint and placed on a real
       Centre rendered "Boardwalk Flyer · Nothing here yet." There was no branch
       for `kind: "app"`, so a working, uploaded, playable game fell through to
       the named-absence tile and told everybody it was empty. The worst version
       of the hollow-projection defect: not a Popit with nothing in it, but a
       Popit with a whole game in it saying it had nothing.

       IT IS THE SAME SQUARE AS EVERYTHING ELSE. Same `.ow-cv-face--po` material,
       same hue, same seam — because that is the shared design language, and an
       app that announced itself differently on the shelf would break the one
       promise the shelf makes: these are all the same kind of thing until you
       open one. What is its own is what it SAYS: its name, whether it is a game
       or an app, and that it is ready — never a fabricated score, player count
       or rating, none of which this platform knows. */
    if (it.kind === 'app') {
      face.className += ' is-live ow-cv-face--app';
      var acfg = it.config || {};
      var aname = it.label || acfg.title || 'App';
      var akind = (acfg.kind === 'game') ? 'GAME' : 'APP';
      var abody = doc.createElement('span');
      abody.className = 'ow-cv-read';
      abody.innerHTML =
        '<span class="ow-cv-kind">' + esc(akind) + '</span>' +
        '<span class="ow-cv-sig ow-cv-sig--app">' + esc(aname) + '</span>' +
        (acfg.description
          ? '<span class="ow-cv-detail">' + esc(String(acfg.description).slice(0, 90)) + '</span>'
          : '') +
        '<span class="ow-cv-sub">Tap to ' + (akind === 'GAME' ? 'play' : 'open') + '</span>';
      var agl = glyph('app');
      if (agl) { face.appendChild(agl); }
      face.appendChild(abody);
      n.appendChild(face);
      return n;
    }
    /* ── WHAT A LARGE FOOTPRINT IS FOR ─────────────────────────────────
       ★ FOUNDER, 2026-09-12: *"look at apples widgets are the popits from the
         outside all looking like that yet"*

       The footprints made them a family; this is the half that makes the
       family MEAN something. Apple's rule is that a size is a different
       CONTENT DESIGN, not the same content with more whitespace around it — a
       small holds one idea, a large holds a list. Ours rendered the identical
       three lines at every size and simply spread them out.

       AND THE LIST WAS ALREADY IN THE PAYLOAD. Every projection returns
       `items` from `md` upward — seven places, eight events, twelve
       signatures — and the tile has never drawn one of them. A 6x4 Places
       tile showed ONE place out of seven while the other six sat in the
       response. That is the opposite of the rule this lane enforces
       everywhere else: a surface that shows less than the truth must say so.

       THE HEIGHT EARNS IT, NOT THE WIDTH. A wide tile is two rows tall and has
       room for a fact and a line; a large is four and can hold a list under
       them. So the rows are drawn on `h >= 4` — which is `large` and `full`,
       and nothing else, by construction of the footprint set. */
    function rowsOf(ref, c) {
      if (!c) { return []; }
      var src = c.items || [];
      if (!src.length) { return []; }
      return src.map(function (x) {
        if (ref === 'guestbook') {
          return { text: x.who || '', person: true,
                   note: x.removed ? 'removed' : (x.body || ''),
                   face: x.face || null };
        }
        if (ref === 'places' || ref === 'visited') {
          return { text: x.name || '', note: dayWhen(x.at, x.how, 'visits'),
                   face: x.face || null };
        }
        if (ref === 'events' || ref === 'next' || ref === 'calendar') {
          /* THE SAME VOCABULARY THE MEDALLION ABOVE IT USES — "SEP 12", not
             "2026-09-12". A value a person has to parse is as hollow as an
             empty one, and this row sits directly under a medallion already
             saying the month and the day in words.

             AND A CANCELLED EVENT MUST NOT READ LIKE A LIVE ONE here either:
             the front replaces the hour with the state for exactly this
             reason, and a list underneath quietly printing "23:00" for an
             evening that is off would put the defect back one line lower. */
          var wd = whenParts(x.date || '');
          var offR = (x.state && x.state !== 'scheduled' && x.state !== 'live')
            ? (x.state === 'cancelled' ? 'Cancelled'
               : x.state === 'ended' ? 'Ended' : String(x.state))
            : '';
          var day = wd.mon ? (wd.mon + ' ' + wd.day) : (x.date || '');
          return { text: x.title || '',
                   note: [day, offR || x.time || ''].filter(Boolean)
                           .join(' \u00b7 ') };
        }
        if (ref === 'following') {
          return { text: x.name || '', note: x.role || '', face: x.face || null,
                   person: x.kind === 'person' };
        }
        if (ref === 'people') {
          return { text: x.name || '', note: x.how || '', face: x.face || null,
                   person: true };
        }
        if (ref === 'saved') {
          return { text: x.who || '', note: x.body || '' };
        }
        if (ref === 'website') {
          return { text: x.name || '', plain: true };
        }
        if (ref === 'said') {
          return { text: x.who || '', note: x.preview || '' };
        }
        if (ref === 'marks') {
          return { text: x.name || x.owner || '', note: dayWhen(x.at, '', '') };
        }
        return { text: x.name || x.title || x.who || '',
                 note: x.detail || x.body || '' };
      }).filter(function (r) { return r.text; });
    }

    var read = reading(it.ref, live);
    /* ── THE GATE, ASKED BEFORE THE READING IS DRAWN ─────────────────────
       A kind that declares `shows` gets to refuse its own live branch when it
       does not have enough to be worth showing. Falling through here lands on
       the named-absence tile below, which tells the person the truth about
       their Popit instead of drawing a chart of nothing. */
    if (read && !shows(it, (live && live[it.ref]) || read)) read = null;
    if (read && (read.sig || read.detail)) {
      face.className += ' is-live';
      /* ── DESIGNED ONE POPIT AT A TIME ─────────────────────────────────
         `next` has its own front now — a dominating medallion with the
         information laid out beside it. The others keep the current treatment
         until each is designed in turn; a half-generic pass applied to all of
         them is what made them read as cards. */
      if ((it.ref === 'events' || it.ref === 'next') && live && live.next) {
        face.className += ' has-front';
        /* ── MAP ONCE, AND USE THE SAME OBJECT EVERYWHERE ─────────────────
           ★ THE FRONT WAS MAPPED AND THE EXPANSION WAS NOT, and all three
           consumers below read the mapped names.

           `live` arrives shaped `{next:{title,date,time,location,event_id}}`.
           This built a flat object for `frontNext` — `detail`, `signal`,
           `time`, `location`, `event_id` — and then handed `expandNext` the
           RAW `live`, whose `detail` and `signal` do not exist.

           MEASURED 2026-09-07, by tapping a real Event Popit in a browser: the
           tile says "Boardwalk Concert" and the panel it opens is titled
           "Event", with an empty when-line. `expandNext` reads `live.detail`,
           gets undefined, and falls back to the word "Event" — a fallback
           doing its job perfectly while describing nothing.

           AND BOTH ACTIONS WERE DEAD FOR THE SAME REASON. The handler guards
           on `live.event_id` and passes `live.location`, and neither exists on
           the raw shape — so "Open the event" could never fire and "Get here"
           carried no location. Not a broken button: a button whose condition
           is structurally always false.

           One object, built once, passed to all three. The bug was possible
           only because two shapes for one thing existed in the same function. */
        var shown = {
          signal: live.next.date || '', detail: live.next.title || '',
          state: live.next.state || '',
          time: live.next.time || '', location: live.next.location || '',
          going: null, centers: [], performers: [],
          description: '', event_id: live.next.event_id || ''
        };
        /* ── AND IT WAS THE ONE TILE ON THE SHELF WITHOUT A NAME ────────
           ★ MEASURED 2026-09-12 on a profile at phone width: five tiles
             reading GUESTBOOK, PLACES, SAVED, LINKS, LOCATION, and between
             them one with a date medallion and no label at all.

           The argument for leaving it off is real — a calendar widget does
           not need a heading saying "calendar", the date IS the heading — and
           it is the right argument for a shelf of ONE kind of object. This
           shelf is mixed, every neighbour is labelled, and the odd one out
           reads as a tile that lost its label rather than one that never had
           one. Consistency across a grid of unlike things is worth more here
           than the purity of the front, and it costs 14px on a tile the
           fitter will account for anyway. */
        var colF = doc.createElement('span');
        colF.className = 'ow-cv-read ow-cv-read--front';
        var kf = doc.createElement('span');
        kf.className = 'ow-cv-kind';
        kf.innerHTML = name;
        colF.appendChild(kf);
        colF.appendChild(frontNext(shown));
        face.appendChild(colF);
        face.addEventListener('click', function (e) {
          if (inert(n)) return;
          e.stopPropagation();
          /* ── THE RULING APPLIES TO THE ONE TILE THAT HAD ITS OWN DOOR ─────
             ★ FOUNDER, 2026-09-12: *"a Popit can open into the existing
               canonical experience. So a Posts Popit doesn't contain a
               miniature fake feed database. It previews Posts → opens the real
               Feed/Scroll."*

             MEASURED 2026-09-12 on a real Centre: tapping the Events tile
             fired NO handoff at all. This branch returns before the generic
             click handler is attached, so the one Popit with a designed front
             was the one Popit that never offered the canonical experience —
             it opened its own expansion, which is precisely the miniature the
             ruling is about.

             THE EXPANSION IS NOT REMOVED, because it is real capability and
             removing it to look simple is the other thing he forbade. It
             becomes what it is everywhere else on this canvas: the FALLBACK.
             The handoff is offered first, and if the App claims it the person
             lands on the actual Event; if nothing claims it they get the
             expansion they get today. Same rule as every other kind, finally
             including this one. */
          if (handOff(it, n)) { return; }
          var ex = expand(function () { return expandNext(shown); });
          ex.el.addEventListener('click', function (ev) {
            /* AN ACT ANNOUNCES; IT DOES NOT ACT HERE. Same shape the sheet's
               single listener dispatches, so the live layer performs it and
               this surface stays a material that knows no endpoints. */
            var act = ev.target.closest && ev.target.closest('[data-po-act]');
            if (act) {
              ev.preventDefault();
              doc.dispatchEvent(new global.CustomEvent('ow:act', { detail: {
                button: act, verb: act.getAttribute('data-po-act'),
                create: null, widget: { ways: ex.el._ways || [] },
                node: ex.el, from: 'room' } }));
              return;
            }
            var b = ev.target.closest && ev.target.closest('[data-go]');
            if (!b) return;
            var go = b.getAttribute('data-go');
            ex.close();
            if (go === 'event' && shown.event_id) {
              doc.dispatchEvent(new CustomEvent('ow:open-event',
                { detail: { id: shown.event_id } }));
            } else if (go === 'here') {
              doc.dispatchEvent(new CustomEvent('ow:get-here',
                { detail: { event_id: shown.event_id, location: shown.location } }));
            } else if (go === 'online') {
              /* THE CANVAS DOES NOT KNOW WHAT OPENING A LINK MEANS AND MUST
                 NOT — same seam every other act here uses. It says what
                 happened; the App decides. */
              doc.dispatchEvent(new CustomEvent('ow:open-event',
                { detail: { id: shown.event_id, online: true } }));
            }
          });
        });
        /* ── AND THE REST OF THE AGENDA, WHEN THE FOOTPRINT HOLDS IT ──────
           Events has its own medallion front and returns before the generic
           reading — so it was the one kind a `large` footprint did nothing
           for. A 6x4 Events tile drew the same single event a 6x2 does, with
           more air around it, while the payload carried eight.

           The medallion IS the next one; the list underneath is what comes
           after it, which is exactly what the extra two rows of a large are
           for. Same helper, same remainder rule as every other kind. */
        var packE2 = (this._pack || {})[it.id];
        var hE2 = packE2 ? packE2.h : (it.h || 2);
        if (hE2 >= 4) {
          var restE = rowsOf(it.ref, live).slice(1);
          if (restE.length) {
            var listE = doc.createElement('span');
            listE.className = 'ow-cv-rows ow-cv-rows--under';
            listE._rows = restE;
            paintRows(listE, restE, restE.length);
            face.appendChild(listE);
          }
        }
        n.appendChild(face);
        return n;
      }
      var ins = instrument(it.ref, live);
      /* ── A FACE OUTRANKS A GLYPH ────────────────────────────────────────
         ★ FOUNDER, 2026-09-13: *"boardwalk arcade should have user and profile
           picture."*

         Where the reading names somebody — a place you follow, a person an
         About is about — the mark is THEIR FACE, not the kind's icon. A glyph
         says what sort of Popit this is, which the label above it has already
         said; a face says WHO, which nothing else on the tile does. Only when
         there is neither an instrument nor a face does the glyph stand in, so
         no Popit is ever an unmarked rectangle. */
      var hero = (!ins && read && read.face)
        ? faceNode(read.face, read.faceName || read.sig, read.faceKind)
        : null;
      if (ins) { face.className += ' has-in'; face.appendChild(ins); }
      else if (hero) { face.className += ' has-face'; face.appendChild(hero); }
      else {
        /* EVERY POPIT CARRIES ITS MARK, not only the three with drawn
           instruments. Where a full instrument exists it IS the mark; where one
           does not, the glyph is — so no Popit is ever an unmarked rectangle. */
        var g = glyph(it.ref);
        if (g) { face.className += ' has-gl'; face.appendChild(g); }
      }
      /* THE READING, BESIDE THE INSTRUMENT — never instead of it. `now` states
         its status in the ring, so the word beneath is confirmation rather than
         the content; `next` puts the day on the dial and the title beside it.
         Compact on purpose: the founder's test is that the form survives having
         every word removed. */
      var txt = doc.createElement('span');
      txt.className = 'ow-cv-read';
      txt.innerHTML =
        '<span class="ow-cv-kind">' + name + '</span>' +
        '<span class="ow-cv-body">' +
          (read.sig ? '<span class="ow-cv-sig">' + esc(read.sig) + '</span>' : '') +
          (read.detail ? '<span class="ow-cv-detail">' + esc(read.detail) + '</span>' : '') +
          (read.sub ? '<span class="ow-cv-sub">' + esc(read.sub) + '</span>' : '') +
          /* A PARTIAL AGENDA SAYS SO. An unreadable Center and a clear calendar
             look identical otherwise, and one of them is wrong. */
          (read.partial ? '<span class="ow-cv-sub">Part of your agenda could not be read</span>' : '') +
        '</span>';
      /* ── AND AT `large`, THE LIST THE PAYLOAD HAS ALWAYS CARRIED ────────
         The height earns it: a wide footprint is two rows and holds a fact and
         a line; a large is four and can hold those plus the list underneath.
         `h >= 4` is `large` and `full` and nothing else, by construction of
         the footprint set — so this is the content design changing with the
         family rather than the same three lines spread further apart.

         THE FIRST ROW IS ALREADY THE SIG, so it is dropped here — a Places
         tile that says "Atlantic City" and then lists Atlantic City first has
         said one thing twice. And the remainder is NAMED, because a list that
         shows four of seven and does not say so is the defect this lane has
         now fixed five times. */
      var packL = (this._pack || {})[it.id];
      var rowsH = packL ? packL.h : (it.h || 2);
      if (rowsH >= 4) {
        var rows = rowsOf(it.ref, live).slice(1);
        if (rows.length) {
          var list = doc.createElement('span');
          list.className = 'ow-cv-rows';
          list._rows = rows;
          paintRows(list, rows, rows.length);
          txt.querySelector('.ow-cv-body').appendChild(list);
        }
      }
      face.appendChild(txt);
    } else if (it.state === 'not_supported') {
      /* ── THE WRONG QUESTION IS NOT AN EMPTY ANSWER ──────────────────────
         ★ MEASURED 2026-09-08 on a real Centre's public face: seven kinds came
         back `not_supported` — the registry's subject guard refusing to ask a
         person's question of a place — and every one of them drew "Nothing
         right now".

         That is a FALSE STATEMENT ABOUT THE CENTRE. A Centre does not HAVE a
         guestbook, so "nothing right now" tells an operator their guestbook is
         empty and invites them to wait for signatures that can never arrive.
         The truth is that this Popit does not belong here.

         `not_supported` is the FOURTH state and I found it two days ago by
         placing person-only kinds on a Centre. I proved the guard held on the
         WIRE and never looked at what the tile drew — the same omission that
         hid `marks` and `since`, three for three, and this one I introduced by
         discovering a state and not checking its rendering.

         It says which way it is wrong, because "not here" without "then where"
         is only half an answer, and the person is holding a Popit they can
         still use somewhere. */
      /* ── AND A VISITOR SHOULD NOT BE READING THE TYPE SYSTEM ───────────
         ★ FOUNDER, 2026-09-09: *"Oneway OS is overdeveloped on the surface...
           too dense, difficult to understand"* · *"users should not need to
           understand the architecture to use Oneway"* · and the constraint that
           bounds this fix: *"do not remove real capability just to make it look
           simple."*

         MEASURED on one real Centre: SEVEN of eighteen placements were
         permanently `not_supported`, each holding a 6x3 tile. Thirty-nine
         percent of that Centre's public face was a lesson in which kinds apply
         to which subject — addressed to visitors, who cannot act on it and did
         not ask.

         The sentence above is RIGHT and stays. What was wrong is WHO IT IS
         FOR. "For a person, not a place" is a message to the person who placed
         it: they are holding a Popit they can still use somewhere else, and
         only they can move it. A visitor can do nothing with it at all.

         SO IT IS PROGRESSIVE DISCLOSURE, WHICH IS THE INSTRUMENT HE NAMED, AND
         IT REMOVES NO CAPABILITY. The owner sees it, at a size that says
         "attend to me" rather than occupying the plane; a visitor does not see
         a tile that can never answer for anyone. Nothing is deleted, nothing
         is unplaceable, and the placement is still in the layout the moment
         they open Arrange.

         The picker no longer offers these on a Centre at all (see `pick`), so
         this is the residue of choices made before that existed rather than a
         state the product can still produce. */
      if (!this.mayArrange) {
        /* NOT A HOLE IN THE GRID. `is-void` keeps the placement's cells so the
           layout around it does not reflow — a visitor and the owner see the
           same arrangement, one of them with a quiet gap where a Popit that
           does not belong here is waiting to be moved. */
        n.setAttribute('data-void', '');
        n.appendChild(face);
        return n;
      }
      face.className += ' is-quiet has-gl is-misplaced';
      var gn = glyph(it.ref);
      if (gn) { face.appendChild(gn); }
      var tn = doc.createElement('span');
      tn.className = 'ow-cv-read';
      tn.innerHTML = '<span class="ow-cv-kind">' + name + '</span>' +
        '<span class="ow-cv-detail">' +
        (/^center:/.test(this.surface || '')
          ? 'For a person, not a place'
          : 'For a place, not a person') +
        '</span>' +
        /* THE WAY OUT, SAID PLAINLY. Naming the problem without naming the
           remedy is what makes an honest state read as a dead end. */
        '<span class="ow-cv-sub">Only you can see this — move it to your Home</span>';
      face.appendChild(tn);
    } else if (it.bound) {
      /* BOUND, AND TODAY'S ANSWER IS NOTHING. Still marked, still recognisable
         as what it is — a calendar with nothing on it is a calendar. The glyph
         goes quiet rather than absent, which is the difference between "nothing
         is happening" and "something is broken". */
      /* ── AND AN EMPTY WIDE TILE SAID THREE WORDS ────────────────────
         ★ FOUNDER, 2026-09-12, on the tile beside this one: *"NOW 'online' ????
           what have u been working on ?"*  The same failure wearing different
           words — "LINKS · Nothing right now" is one line in a footprint with
           room for two, and a wide tile carrying three words is the density
           failure whichever words they are.

         NAMING THE ABSENCE STAYS. It is the platform's own wording and the
         reason is recorded three rules down: the blurb alone *"describes what
         this Popit WILL show, which reads exactly like a value that failed to
         load. It never NAMES THE ABSENCE."*  So the absence is named FIRST and
         what would fill it follows — both, in that order, rather than either
         alone.

         AND ONLY WHERE THERE IS ROOM. At `sm` the footprint holds a name and
         one line, so it gets the absence and nothing else; the invitation is a
         `md`-and-up line. That is the ladder: the same Popit saying more of
         the same thing as it earns the space, never something different. */
      face.className += ' is-quiet has-gl';
      var gq = glyph(it.ref);
      if (gq) { face.appendChild(gq); }
      var tq = doc.createElement('span');
      tq.className = 'ow-cv-read';
      var meta = catalogEntry(it.ref);
      var willBe = (meta && meta.blurb) ? String(meta.blurb) : '';
      var packE = (this._pack || {})[it.id];
      var roomE = packE ? (packE.w * packE.h) : ((it.w || 3) * (it.h || 2));
      /* ── AND THE INVITATION WAS IN THE SLOT THAT IS ALWAYS DROPPED ──────
         ★ MEASURED 2026-09-12 on a signed-in Home at phone width: an empty
           Places tile, 150px tall, reading "PLACES / Nothing right now" and
           nothing else. The sentence saying what would fill it was emitted
           into `.ow-cv-sub`, which `@container (max-width:220px)` hides — so
           on every phone there is, the tile spent 150px on three words.

         THAT IS THE THIRD TIME I have put substance in that slot. It is the
         Now tile's caption, the empty-state blurb, and now this one again, and
         the lesson evidently does not stick as a lesson: the rule is that
         `.ow-cv-sub` is for a line the tile can lose, and ANYTHING a person
         would miss belongs in the detail beside the words it qualifies.

         So the absence and what would end it are ONE reading now, in one box,
         and the tile is already a door — tapping it dispatches its `opens`
         handoff whether it is full or empty. */
      tq.innerHTML = '<span class="ow-cv-kind">' + name + '</span>' +
        '<span class="ow-cv-detail">Nothing right now' +
        ((willBe && roomE > 6)
          ? '<b class="ow-cv-will">' + esc(willBe) + '</b>' : '') +
        '</span>';
      face.appendChild(tq);
    } else {
      /* ── AN EMPTY POPIT IS DESIGNED, NOT A LEAKED VARIABLE ─────────────
         ★ FOUNDER, 2026-08-30: *"Don't render unbound internal concepts as
           user-facing empty boxes... `colours` looks like a backend variable
           leaked into production."*

         It was `name = it.label || it.config.title || it.ref`, and for a Popit
         with neither the fallback was the RAW REF — so a person placed Colours
         and got a lowercase identifier in a box. The catalog already carries
         the proper name and a sentence saying what the Popit will show; both
         come from the same server read the picker makes.

         Not hidden, because the person put it there on purpose. Shown as what
         it is: its mark, its real name, and what will appear in it. */
      /* ── EMPTY AND UNANSWERED ARE NOT THE SAME STATE ────────────────────
         ★ FOUNDER, 2026-09-02: *"these hollow projections … are gonna be
           systematically eliminated."*

         Measured by the hollow harness on the Center surface: a Rhythm tile
         "renders a frame and no fact", present during the scan and GONE from
         the DOM immediately after — a tile painted while the surface was still
         assembling. No data gate can fix that, because there is no data yet to
         judge; the fix is not to make a claim before there is one.

         `arranged === null` is this canvas's existing three-state signal for
         "the answer has not arrived". While that holds, the tile says it is
         still reading rather than asserting that it has nothing — an empty
         claim made before the question was answered is a placeholder, and a
         true one made after it is not.

         Stated, not inferred, so the quality harness can read the condition
         instead of guessing at it from the text. */
      var unanswered = (this.arranged === null);
      face.className += ' has-gl ' + (unanswered ? 'is-loading' : 'is-empty');
      n.setAttribute('data-ref', it.ref || '');
      if (it.label || (it.config && it.config.title)) n.setAttribute('data-labelled', '');
      var gu = glyph(it.ref);
      if (gu) { face.appendChild(gu); }
      var meta = catalogEntry(it.ref);
      var tu = doc.createElement('span');
      tu.className = 'ow-cv-read';
      tu.innerHTML = '<span class="ow-cv-name">'
        + esc(it.label || (it.config && it.config.title) || (meta && meta.name) || titleCase(it.ref))
        + '</span>'
        + (meta && meta.blurb
            ? '<span class="ow-cv-blurb">' + esc(meta.blurb) + '</span>'
            : '<span class="ow-cv-blurb">Nothing here yet.</span>')
        /* ── AND IT SAYS THAT IT HAS NOTHING ────────────────────────────
           ★ FOUNDER, 2026-09-02: *"these hollow projections of any popit and
             look like placeholders are gonna be systematically eliminated."*

           The name and the blurb above are the founder's own design for an
           unbound Popit and they stay. What was missing is the one thing that
           separates an honest empty state from a placeholder: the blurb
           describes what this Popit WILL show, which reads exactly like a
           value that failed to load. It never NAMES THE ABSENCE.

           The hollow detector agreed — measured 2026-09-02, Colours and Count
           came back EMPTY: "renders a frame and no fact". Both were telling the
           truth and neither was saying so.

           A named absence is the form the rule wants more of, not less.

           THE WORDS ARE THE PLATFORM'S OWN. "Nothing here yet" is already the
           fallback sentence a few lines up, and it is the vocabulary the
           quality harness recognises as a named absence. Inventing a second
           phrase for the same condition would make the product say two things
           and the detector believe neither.

           AND IT IS ONLY SAID ONCE THE QUESTION HAS BEEN ANSWERED. Saying it
           while the surface is still reading would be the same placeholder in
           politer words. */
        + (unanswered
            ? '<span class="ow-cv-none">STILL READING</span>'
            : '<span class="ow-cv-none">NOTHING HERE YET</span>');
      face.appendChild(tu);
    }
    face.addEventListener('click', function (e) {
      if (inert(n)) return;
      e.stopPropagation();
      /* ── THE ACTION IS THE CANONICAL OBJECT ───────────────────────────
         ★ FOUNDER, 2026-08-25: *"Popit -> canonical object/data -> live
           projection -> ACTION"* — and, for the Event Popit specifically,
           *"open Event."*

         A bound Popit is a window onto a real thing, so pressing it must walk
         you INTO that thing. `next` showing the Boardwalk Beach Concert and
         then opening a generic widget sheet ABOUT the concept of "next" would
         be the card-shaped answer the whole binding exists to replace.

         The same events the shell already routes for a placed Event or Center
         — one destination per object, not a second opening path. Where the
         projection names no object, the Popit opens as itself. */
      /* ── THESE TWO RETURN WHETHER ANYBODY IS LISTENING OR NOT ─────────
         ★ MEASURED 2026-09-12 with every listener muted: tapping the Links
           Popit did NOTHING. It dispatches `ow:enter-center` and returns, so
           on a shell that does not listen the tile is a dead control — Rule
           12, in the file that refuses it elsewhere in those words.

         I MADE THEM CLAIMABLE AND PUT IT BACK, and the reason is worth
         keeping. These two predate the `preventDefault` convention the
         handoff introduced, and the App's listeners for them navigate WITHOUT
         claiming. Requiring a claim here would have left the canvas opening
         its own sheet on top of a navigation A had already started — a
         regression on the surface that works, to cure one on a surface that
         does not exist yet.

         So the ask is A's and it is one line each: `e.preventDefault()` in the
         `ow:enter-center` and `ow:open-event` listeners. The moment those two
         claim, this becomes `if (ev.defaultPrevented) return;` like every
         other opening on this canvas, and the dead control on an unlistening
         shell goes with it. Sent on the lane channel with this commit. */
      var live = it.resolved || null;
      if (live && live.event_id) {
        try {
          doc.dispatchEvent(new CustomEvent('ow:open-event',
            { detail: { id: live.event_id } }));
          return;
        } catch (_) {}
      }
      if (live && live.center_id && it.ref !== 'world') {
        try {
          doc.dispatchEvent(new CustomEvent('ow:enter-center',
            { detail: { id: live.center_id } }));
          return;
        } catch (_) {}
      }
      OW.canvas.open(it, n);
    });
    n.appendChild(face);
    return n;
  };

  /* ── OPENING — TWO PATHS, ON PURPOSE ────────────────────────────────────
     This is the whole architectural point of the file. A card and a game do not
     open the same way, and pretending they do is what makes every Popit a card. */
  /* ── WHERE A POPIT HANDS OFF TO ─────────────────────────────────────────
     ★ FOUNDER, 2026-09-12: *"a Popit can open into the existing canonical
       experience. So a Posts Popit doesn't contain a miniature fake feed
       database. It previews Posts → opens the real Feed/Scroll. A Places Popit
       previews places → opens the real map/Center experience."*

     THE CATALOG DECLARES IT — every row carries `opens`, so the destination is
     one declaration the server and the client share rather than a table here
     that goes stale the first time a kind changes. The canvas knows nothing
     about what a Feed or a map IS, and must not: it says what happened and the
     App decides, which is the same seam `ow:open-event` and `ow:open-post`
     already use and A already listens for.

     AND IT ALWAYS OPENS SOMETHING. A dispatched event that nothing handles
     would make the tile a dead control — Rule 12, and the defect this file
     refuses elsewhere in those words. So the handoff is offered first and the
     room is the fallback: if no listener claims it, the Popit opens the way it
     always has. Nothing regresses while the App side is still being wired. */
  var OPENS_EVENT = {
    feed:      'ow:open-feed',
    map:       'ow:open-map',
    profiles:  'ow:open-people',
    saved:     'ow:open-saved',
    events:    'ow:open-events',
    event:     'ow:open-event',
    profile:   'ow:open-profile',
    site:      'ow:open-site'
  };

  /* ── WHAT THE TILE IS SHOWING, NAMED AS THE THING IT IS ────────────────
     ★ MEASURED 2026-09-12 in the browser, on a signed-in Home: tapping the
       Following Popit routed to `#post/pl_fo` and drew "THIS POST · no such
       post". `pl_fo` is the PLACEMENT id — the id of a rectangle on a canvas —
       and it was being opened as a Post.

     THE CONTRACT WAS AMBIGUOUS AND I WROTE IT. I told A the detail carries
     `{surface, ref, id, from, resolved}`. In an event called `ow:open-feed`,
     `id` reads as "the id of the thing to open", and A implemented exactly
     that: `var pid = d.id || _first(d, ['post_id','id'])`. The listener is
     correct against the contract it was given. The contract was wrong.

     So the canvas says what it means. `placement` is the rectangle — useful
     for provenance, never an object to open — and `object` is the canonical
     thing the tile is currently showing, typed, or null when it is showing a
     LIST rather than a thing. Null is the answer that makes "Following opens
     the real Feed" correct: there is no single post behind a follow list, so
     the destination is the Feed itself.

     `id` IS GONE RATHER THAN DEPRECATED. Leaving it would leave the defect
     working exactly as it does today in every listener that has not been
     updated yet, which is the opposite of a migration. Removing it makes the
     six listeners fall through to their room — the correct destination — from
     the moment this lands and before A changes a line. */
  function objectOf(ref, live, origin) {
    /* what a CLIENT-DRAWN tile recorded at draw time takes precedence: it is
       the thing the person is actually looking at, and for those kinds the
       placement carries no projection at all */
    var drawn = origin && origin.querySelector
      ? (origin.matches && origin.matches('[data-obj-id]')
          ? origin : origin.querySelector('[data-obj-id]'))
      : null;
    if (drawn) {
      return { kind: drawn.dataset.objKind || 'event',
               id: String(drawn.dataset.objId) };
    }
    if (!live || typeof live !== 'object') { return null; }
    var row = live.next || live.latest ||
              (Array.isArray(live.items) ? live.items[0] : null) || live;
    if (!row || typeof row !== 'object') { return null; }
    /* A LIST IS NOT A THING. Where the projection carries several and names no
       single one, the tile is a preview of a room and the room is the
       destination — so this answers null rather than picking the first row and
       calling it the answer. */
    var many = Array.isArray(live.items) && live.items.length > 1 &&
               !live.next && !live.latest;
    if (many) { return null; }
    /* a person by @handle first — an address is no longer sent about anybody but you */
    var pick = [['event', 'event_id'], ['post', 'post_id'],
                ['center', 'center_id'], ['person', 'ref'], ['person', 'email']];
    for (var i = 0; i < pick.length; i++) {
      var v = row[pick[i][1]];
      if (v) { return { kind: pick[i][0], id: String(v) }; }
    }
    return null;
  }

  function handOff(it, origin) {
    var entry = catalogEntry(it.ref) || {};
    var name = OPENS_EVENT[entry.opens || ''];
    if (!name) { return false; }
    var ev = new CustomEvent(name, {
      detail: { surface: (origin && origin.closest &&
                          (origin.closest('[data-surface]') || {}).getAttribute)
                  ? origin.closest('[data-surface]').getAttribute('data-surface')
                  : (OW._cvSurface || ''),
                ref: it.ref, placement: it.id,
                object: objectOf(it.ref, it.resolved || null, origin),
                from: origin,
                /* the reading the tile is already showing, so the destination
                   can open ON the thing rather than at the top of a list */
                resolved: it.resolved || null },
      cancelable: true
    });
    doc.dispatchEvent(ev);
    /* HANDLED IS STATED, NOT GUESSED. A listener calls preventDefault to say it
       took this; silence means nobody did and the room opens instead. */
    return ev.defaultPrevented;
  }

  function open(it, origin) {
    if (it.kind === 'app') return openApp(it, origin);
    if (handOff(it, origin)) { return; }
    /* A catalogued Popit is a Popit — the existing runtime already knows how to
       open one, and a second implementation here would be a second answer to
       what a Popit looks like. */
    if (!OW.open) { return; }

    /* ── AND IT WAS OPENING WITH NOTHING IN IT ─────────────────────────────
       ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info when
         its popit is opened."*

       This handed the sheet `{kind, id, label}` — a name and an id. The sheet
       itself is a full object page: it renders a lead sentence, a state, a
       FACT TABLE, what happens next, what already happened, relationships and
       conversations. It was being given none of them, so every Popit opened
       onto its own title.

       I nearly fixed this by writing a second panel here, which is precisely
       what the comment above forbids and would have been the twelfth place a
       Popit's appearance is decided. The runtime was never the problem. THE
       CANVAS WAS NOT SPEAKING TO IT.

       IT ASKS AT FULL DEPTH, because that is what opening means — §11, "size
       controls density". Measured: a guestbook at 4x2 answers `count` and
       `latest`; the same guestbook at 12x8 answers `count`, `latest` AND
       `items`. The deep projection was built, correct, and unreachable, since
       the canvas read answers each placement at the size it was PLACED.

       It opens IMMEDIATELY with what the tile already knows and fills in when
       the read lands — a person who taps a tile should never watch a spinner
       where the thing they tapped was. */
    /* THE NAME COMES FROM THE CATALOG when the placement has none of its own.
       A Popit a person has not renamed still has a name, and opening one onto
       an empty title is the "brief info" complaint in miniature. The blurb is
       the lead until the real projection lands, so the sheet is never blank. */
    var base = { kind: it.ref, id: it.id,
                 label: it.label || kindName(it.ref),
                 kind_label: kindName(it.ref),
                 glance: kindBlurb(it.ref) };
    OW.open(base, origin);

    /* FROM THE TILE, NOT FROM A GLOBAL. `OW.canvas.open` is exported and called
       unbound, so `this` is never the Canvas — the old expression fell through
       to a module global on every single call and nobody could see it, because
       a page with ONE canvas gives the right answer either way. */
    var surface = (origin && origin.closest &&
                   (origin.closest('[data-surface]') || {}).getAttribute)
      ? origin.closest('[data-surface]').getAttribute('data-surface')
      : (OW._cvSurface || '');
    if (!surface || it.kind !== 'popit') { return; }
    req('/api/canvas/' + encodeURIComponent(surface) +
        '/popit/' + encodeURIComponent(it.ref) + '?w=12&h=8')
      .then(function (r) {
        var d = (r && r.data) || {};
        /* ── UNBOUND IS NOT "NOTHING TO SHOW" FOR A CLIENT-DRAWN KIND ─────
           Seven kinds are drawn from their own reads and the registry has
           never projected them. This branch returned here, which is why
           opening a Countdown produced its own title twice while the tile
           behind it named the event and counted down to it. */
        if (d.state !== 'available' || !d.content) {
          return clientSheet(it.ref, it, surface, base).then(function (alt) {
            if (alt && OW.refill) { OW.refill(alt); mountLive(it, alt); }
          }).catch(function () {});
        }
        var deep = sheetOf(it.ref, d.content, base, it);
        /* ── FILL IT, DO NOT OPEN IT AGAIN ────────────────────────────────
           This called `OW.open` a second time and the comment claimed it only
           replaced the contents. It does not: `OW.open` cancels every running
           animation on the sheet and rebuilds the unfold from the origin.
           MEASURED — two 540ms unfolds 18ms apart, so the sheet snapped back to
           the bead and unfolded again for a single tap.

           The unfold is a promise about where this came from; playing it twice
           breaks it. `OW.refill` re-renders the body through the SAME
           `renderSheet` and touches nothing else — and it refuses when the
           sheet is not open, so a read landing after somebody has closed it
           cannot reopen it behind them. */
        if (OW.refill) { OW.refill(deep); }
        else if (OW.open) { OW.open(deep, origin); }
      })
      .catch(function () {});
  }

  /* ── AN INSTRUMENT IN A SHEET IS THE SAME INSTRUMENT, RUNNING ──────────
     `renderSheet` is markup, so `faceHTML` can only ever be a photograph of a
     live face. A clock rendered that way is a stopped clock filling a screen,
     which is worse than the three settings it replaced.

     So the markup is a placeholder and the real element is mounted into it the
     moment the sheet has it: the SAME `clockFace` the tile draws, with its own
     minute-aligned timer, rather than a second clock written for the sheet —
     the same rule that keeps a Popit made of Post. `OW.refill` has just
     replaced the sheet's contents, so this runs after it and not before. */
  function mountLive(it, data) {
    if (!data || data.faceKind !== 'clock') { return; }
    var slot = doc.querySelector('.po-sheet.is-open .po-sheet__face [data-clock]');
    if (!slot || !slot.parentNode) { return; }
    var box = slot.parentNode;
    var live = clockFace(it.config || {}, 12, 6);
    if (!live) { return; }
    box.replaceChild(live, slot);
  }

  /* ── THE KINDS THE REGISTRY DOES NOT ANSWER STILL HAVE SOMETHING TO SAY ──
     ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info when
       its popit is opened."*

     MEASURED 2026-09-08 on center:8df4dc30c113. The Countdown TILE said

         NEXT · STARTS IN 4 DAYS · Boardwalk Beach Concert

     and opening it produced NINETEEN CHARACTERS: the word "Countdown", twice.
     THE OPENED POPIT SAID STRICTLY LESS THAN THE TILE IT CAME FROM. That is
     the ruling broken in its worst form, and it was true of SEVEN kinds.

     WHY, AND IT IS NOT A MISSING PROJECTION. Seven catalog kinds are drawn
     CLIENT-SIDE — `clock`, `colours`, `count`, `countdown`, `happening`,
     `posts`, `where` — each from its own read, because their content comes
     from the events domain, the feed or the location chain rather than from
     the canvas payload. The registry has never answered them and that is
     CORRECT: `unbound` is the honest state for a kind nothing on the server
     projects. But `open()` asked the registry, got `unbound`, and stopped —
     so the one path that had the data (the tile, already on screen) was the
     one path opening never consulted.

     Verified before building: all seven are PLACED on real surfaces today, and
     six of the seven draw real content. This is not a hypothetical.

     NOTHING NEW IS FETCHED. `eventsRead`, `whereRead` and `socialFeed` are the
     same memoised readers the faces used a moment ago, so an open is a cache
     hit; `clock`, `colours` and `count` are config-only and the placement is
     already in hand. A second endpoint for what is on screen would be a second
     source of truth for one fact, which is the thing this file exists to
     prevent. */
  function clientSheet(ref, it, surface, base) {
    var cfg = it.config || {};
    var out = {};
    for (var k in base) { if (base.hasOwnProperty(k)) out[k] = base[k]; }

    function evRows(rows, lead) {
      /* ORDERED THE WAY THE TILE ORDERS THEM, by the one temporal contract —
         re-sorting here would let a room disagree with the tile it opened
         from about which event is next. */
      rows = (rows || []).slice().sort(function (a, b) {
        return TIME ? TIME.compare(a, b) : 0;
      });
      var id = {};
      rows.forEach(function (e, i) {
        var u = TIME ? TIME.until(e.starts_at, e.ends_at) : null;
        var when = u ? u.word : 'Date not set';   /* never invent a countdown */
        var where = e.place || e.online_url || '';
        var name = (e.title || 'An event') + (id[e.title] ? ' (' + (i + 1) + ')' : '');
        id[name] = when + (where ? ' · ' + where : '') +
                   ((e.state || '') === 'cancelled' ? ' · CANCELLED' : '');
      });
      if (Object.keys(id).length) { out.identity = id; }
      out.glance = rows.length
        ? (lead || (rows.length + (rows.length === 1 ? ' event' : ' events')))
        : base.glance;
      return out;
    }

    if (ref === 'countdown' || ref === 'happening') {
      return eventsRead(surface).then(function (res) {
        if (!res || res.ok === false) { return null; }   /* a failed read is not an empty one */
        var rows = res.rows || [];
        if (!rows.length) { return null; }
        var first = rows[0] || {};
        var u = TIME ? TIME.until(first.starts_at, first.ends_at) : null;
        return evRows(rows, ref === 'countdown' && u
          ? u.word + ' · ' + (first.title || '')
          : null);
      });
    }
    if (ref === 'where') {
      return whereRead(surface).then(function (res) {
        var d = (res && res.data) || null;
        if (!d || !d.resolved) { return null; }
        var id = {};
        if (d.city) { id.City = d.city; }
        if (d.region) { id.Region = d.region; }
        if (d.country) { id.Country = d.country; }
        var t = d.time || {};
        if (t.timezone) { id.Timezone = t.timezone; }
        if (t.local_date) { id['Local date'] = t.local_date; }
        if (t.utc_offset) { id['UTC offset'] = t.utc_offset; }
        /* THE CHAIN IS THE PLACE'S OWN STRUCTURE, and a room has space for it
           where a tile has one line. Each link is named by what it IS. */
        (d.chain || []).forEach(function (link) {
          if (link && link.name && link.kind && !id[link.kind]) {
            id[link.kind.charAt(0).toUpperCase() + link.kind.slice(1)] = link.name;
          }
        });
        out.label = d.label || out.label;
        out.identity = id;
        return Object.keys(id).length ? out : null;
      });
    }
    if (ref === 'posts') {
      return socialFeed(surface).then(function (res) {
        if (!res || res.ok === false) { return null; }
        var rows = res.rows || [];
        if (!rows.length) { return null; }
        /* ── THE AUTHOR IS A NESTED OBJECT, NOT THREE FLAT KEYS ────────
           My first version read `author_name || author_email || who` and every
           row fell through to "Post 1", "Post 2" — four posts attributed to
           nobody. A feed row carries `author: {email, name, image, kind}`.
           SAME WRONG-KEY SHAPE AS THE FIVE FOUND EARLIER TODAY, and caught the
           same way: by looking at a real payload instead of at my own guess. */
        var id = {};
        rows.slice(0, 12).forEach(function (p, i) {
          var a = p.author || {};
          var who = a.name || a.email || ('Post ' + (i + 1));
          var body = (p.body || p.title || '').slice(0, 140);
          /* WHERE IT WENT is half of what a Post is on this platform — the
             same Post lit to a Centre and lit nowhere are different acts. */
          var dest = p.destination_name ? ' · ' + p.destination_name : '';
          id[who + (id[who] ? ' (' + (i + 1) + ')' : '')] = (body || 'A post') + dest;
        });
        out.identity = id;
        out.glance = rows.length + (rows.length === 1 ? ' post' : ' posts');
        return out;
      });
    }
    /* ── AUTHORED KINDS: THE PERSON WROTE THE ANSWER ─────────────────────
       ★ MEASURED 2026-09-09 while building the Popit fixture. Place a Links
       Popit, type three links, and the surface reports:

           links   state: empty   config: {links:[3 of them]}

       The TILE draws them — it reads the config client-side. The REGISTRY
       answers `empty`, and opening it showed nothing at all.

       THE CAUSE IS A COLLISION ON ONE ID, and it is worth stating plainly
       because it is not a bug in either half:

           catalog   links  "Links — Anywhere else you are."
           registry  links  bound to `_center_read` — a linked CENTRE
           catalog   said   "Said — Something worth keeping."
           registry  said   bound to `_messages_read` — recent THREADS

       Two different Popits share one ref. The registry dutifully answers the
       question it was bound to, finds nothing, and says so honestly; the person
       is looking at the other Popit entirely.

       RESOLVING WHICH MEANING WINS IS NOT A WIRING DECISION — it renames a
       registered kind or splits a catalog entry, and this lane does not make
       that call alone. Reported to B, who owns the registry, and to the
       founder, whose vocabulary the catalog is.

       WHAT IS SAFE AND OBVIOUS MEANWHILE: an opened Popit must show what the
       person put in it. The config is their authored answer and it is right
       here. This does not touch the binding, does not pick a winner, and stops
       being reachable the moment the collision is resolved. */
    if (ref === 'said' && (cfg.text || '').trim()) {
      out.identity = { 'In their words': cfg.text };
      out.glance = '';
      return Promise.resolve(out);
    }
    if (ref === 'links') {
      var ls = (cfg.links || []).filter(function (l) { return l && l.url; });
      if (ls.length) {
        var lid = {};
        ls.forEach(function (l, i) {
          lid[l.label || ('Link ' + (i + 1))] = l.url;
        });
        out.identity = lid;
        out.glance = ls.length + (ls.length === 1 ? ' link' : ' links');
        return Promise.resolve(out);
      }
    }
    if (ref === 'now' && (cfg.text || '').trim()) {
      /* `now` is bound correctly, to presence — but a person may also have
         TYPED what they are doing, and an authored line outranks an inferred
         one for the same reason a chosen status beats a derived one (§10). */
      out.identity = { 'Right now': cfg.text };
      return Promise.resolve(out);
    }

    /* ── CONFIG-ONLY KINDS. The placement IS the answer. ──────────────────
       A clock has no reading to fetch: its truth is the zone somebody chose,
       and the hands are drawn from the device. Saying which zone, in which
       format, on which face is everything there is to say about it — and it
       is more than the tile, which shows the time and not the choice. */
    if (ref === 'clock') {
      /* ── AN OPENED CLOCK THAT DOES NOT SHOW THE TIME ────────────────────
         ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info
           when its popit is opened."*

         MEASURED 2026-09-12 by opening one: the tile read "UTC · 8:04:15 PM ·
         UTC, Sep 12 · 4 hours ahead of you" and the whole-screen sheet it
         opened into read "Timezone UTC · Clock 12-hour · Face digital". Three
         SETTINGS and no clock. The opened Popit said strictly less than the
         tile it came from — the same defect I fixed for seven kinds four days
         ago, still true of the most-placed Popit on the platform, because
         this branch was written to describe the placement rather than to
         answer the question the Popit exists to answer.

         THE FACE IS THE ANSWER AND IT TICKS. `faceHTML` is the sheet's own
         slot for an object's face, and `mountClock` below replaces that markup
         with the REAL `clockFace` element once the sheet is open — the same
         instrument the tile draws, on its own minute-aligned timer, rather
         than a second clock written for the sheet. The settings stay under it,
         which is where settings belong. */
      var cid = {};
      cid.Timezone = cfg.tz || 'UTC';
      cid.Clock = (cfg.format === '24') ? '24-hour' : '12-hour';
      cid.Face = cfg.face || 'digital';
      if (cfg.label) { out.label = cfg.label; }
      out.identity = cid;
      out.faceKind = 'clock';
      out.faceHTML = '<div class="ow-cv-face ow-cv-face--po ow-cv-face--clock' +
                     ' ow-sheet-clock" data-clock="1"></div>';
      out.stageless = true;
      return Promise.resolve(out);
    }
    if (ref === 'colours') {
      /* ── THE LIGHT IS THE SURFACE'S, NOT A STORED PAIR ─────────────────
         My first version read `h1`/`h2` off the placement and found neither,
         so Colours opened blank — the one kind whose tile says it is NEVER
         empty ("everybody has a light"), opening onto nothing.

         The tile is right and it already knows the distinction worth stating:
         PINNED is an angle chosen for this tile and held there; FOLLOWING
         means the person changes their hue and this changes with them. That is
         a DECISION, and a room is where a decision gets named. The two actual
         colours are read from the live custom properties the world is painted
         with, which is the same light the eye is seeing — not a second copy. */
      var pinned = cfg.hue !== undefined && cfg.hue !== null && cfg.hue !== '';
      var cid = {};
      cid.Source = pinned ? 'Pinned to this Popit' : 'Follows your own light';
      if (pinned) { cid.Angle = parseInt(cfg.hue, 10) + '\u00b0'; }
      try {
        var cs = global.getComputedStyle(doc.documentElement);
        var p1 = (cs.getPropertyValue('--ow-h1') || '').trim();
        var p2 = (cs.getPropertyValue('--ow-h2') || '').trim();
        if (p1) { cid.Primary = p1; }
        if (p2) { cid.Secondary = p2; }
      } catch (e) { /* a light we cannot read is not a light we invent */ }
      out.identity = cid;
      return Promise.resolve(out);
    }
    if (ref === 'count') {
      /* A COUNT WITH NO NUMBER IS EMPTY AND MUST KEEP SAYING SO. The tile
         already renders "Nothing here yet" for this and the room must not
         contradict it with a fabricated zero. */
      if (cfg.value == null && cfg.year == null) { return Promise.resolve(null); }
      var nid = {};
      if (cfg.label) { nid.Counting = cfg.label; }
      if (cfg.value != null) { nid.Value = String(cfg.value); }
      if (cfg.year != null) { nid.Year = String(cfg.year); }
      if (cfg.unit) { nid.Unit = cfg.unit; }
      out.identity = nid;
      return Promise.resolve(out);
    }
    return Promise.resolve(null);
  }

  /* ── ONE PROJECTION, TRANSLATED ONCE ────────────────────────────────────
     The registry's kinds are the same shape wearing different field names, so
     the mapping lives here, once, rather than in a panel per kind. Anything it
     does not recognise still opens with its own count and items — an unknown
     kind should degrade to less detail, never to none. */
  /* A STORED TIMESTAMP AS A DAY A PERSON WOULD SAY, with an optional qualifier
     that is dropped when it is the ordinary case. Returns the qualifier alone
     when there is no readable date, and an empty string when there is neither —
     never the raw ISO string, which is a machine's shape (§ the Where Popit's
     own note: "a widget showing a real value a person cannot read is as hollow
     as an empty one"). */
  /* NOT `when` — `var when` is declared inside the tile renderer at two places
     and `var` hoists to the top of that whole function, so a module-level
     `function when` is SHADOWED and reads as undefined inside `reading()`. It
     threw "when is not a function", the canvas caught it, and the entire
     surface rendered as "This canvas could not be loaded".

     THE SECOND TIME I HIT THIS TODAY. The links ladder had the same collision
     with `lcap`, which I caught by reading. This one I did not, and the cost
     was the whole canvas rather than one branch — a name collision in a 9,000
     line file is not a style issue. */
  /* ── HOW LONG AGO, THEN THE DAY, THEN THE MONTH ────────────────────────
     ★ MEASURED 2026-09-12 on a profile at phone width: a Places tile reading
       "Atlantic City / September 8, 2026" directly above a Location tile
       reading "Atlantic City". The second line was 21 characters of absolute
       date on a 125px tile, and it did not answer the question a person
       actually has about a place they went — which is how long ago.

     EVERYTHING ELSE ON THIS PLATFORM ALREADY SPEAKS THIS WAY. The Now tile
     says "2 days ago", the server's own `_ago` says "just now", the feed says
     "2d ago". One reading in the same column saying "September 8, 2026" was
     the odd voice, and it was the longest one.

     So the scale is the ordinary one: a week of relative time, then the day
     and month while the year is obvious, then month and year once it is not.
     A FUTURE date keeps its full form — "in 3 days" is a different kind of
     statement and nothing routed through here makes one. */
  function dayWhen(at, how, ordinary) {
    var out = '';
    if (at) {
      var d = new Date(at);
      if (!isNaN(d.getTime())) {
        var ms = Date.now() - d.getTime();
        var days = Math.floor(ms / 86400000);
        if (ms < 0) {
          out = d.toLocaleDateString([], { day: 'numeric', month: 'long',
                                           year: 'numeric' });
        } else if (days <= 0) { out = 'today'; }
        else if (days === 1) { out = 'yesterday'; }
        else if (days < 7) { out = days + ' days ago'; }
        else if (days < 365) {
          out = d.toLocaleDateString([], { day: 'numeric', month: 'long' });
        } else {
          out = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
        }
      }
    }
    var q = (how && how !== ordinary) ? String(how) : '';
    if (out && q) { return q + ' \u00b7 ' + out; }
    return out || q;
  }

  function sheetOf(ref, c, base, it) {
    var out = {};
    for (var k in base) { if (base.hasOwnProperty(k)) out[k] = base[k]; }
    /* ── AN OPENED NOW IS THE PERSON'S OWN SENTENCE, THEN THEIR STATE ────
       ★ FOUNDER, 2026-09-08: nothing is brief when opened; 2026-09-10: a
         status Popit is *"supposed to be NOSTALGIC not dull."*
       MEASURED 2026-09-20 on loop.ada's Home at 290px: the tile read
       "Reading on the boardwalk before the tide turns · Online · just now";
       the OPENED sheet read "What you are doing at the moment. / Label:
       Online / Last seen: just now". The sentence the person typed lives in
       the placement's config and never reached the sheet, and the scalar
       fallback printed the payload's KEYS as a fact table (S10).
       So: their sentence is the lead, their state with when they were seen
       is the chip beside it, and what they are doing (when a source reported
       any) is the table. No "Label". */
    if (ref === 'now') {
      /* the sheet is named for the PERSON, as the tile is — not "Now / Now" */
      var whoNow = c.who || (c.face && c.face.name) || '';
      if (whoNow) out.label = whoNow;
      var said = String(((it && it.config) || {}).text || '').trim();
      if (said) out.glance = said;
      var state = [c.label || '', c.last_seen ? 'seen ' + c.last_seen : ''].filter(Boolean).join(' · ');
      if (state) out.lifecycle = state;
      var doing = {};
      (c.items || (c.doing ? [c.doing] : [])).forEach(function (x, i) {
        if (!x) return;
        var t = typeof x === 'string' ? x : (x.title || x.name || '');
        var v = typeof x === 'string' ? ' ' : (x.detail || x.source || ' ');
        if (t) doing[t + (doing[t] ? ' (' + (i + 1) + ')' : '')] = v;
      });
      if (Object.keys(doing).length) out.identity = doing;
      return out;
    }
    var n = (typeof c.count === 'number') ? c.count : null;
    var word = { guestbook: 'signature', visited: 'place', places: 'place',
                 following: 'place', saved: 'thing', people: 'person', marks: 'wall',
                 said: 'message', links: 'link' }[ref] || 'item';
    if (n !== null) {
      /* the count leads and the kind's own sentence follows it, so the lead
         says both what this is and how much of it there is */
      out.glance = n + ' ' + (n === 1 ? word : word + 's') +
                   (base.glance ? ' · ' + base.glance : '');
    }
    var items = c.items || (c.latest ? [c.latest] : []);
    /* THE FACT TABLE IS THE SHEET'S OWN STRUCTURE — a flat key/value record it
       already knows how to lay out and reveal. Giving it one is why an opened
       Popit stops being a title. */
    var id = {};
    items.forEach(function (x, i) {
      var t = x.who || x.name || x.owner || x.title || '';
      /* ── A CONSTANT IS NOT A READING ──────────────────────────────────
         ★ SEEN IN THE BROWSER, 2026-09-10: an opened Visited listed seven
         places and every single row's value was the word "visits":

             Atlantic City            visits
             Feed Continuity Center   visits
             Proof Cafe               visits

         and an opened Marks put "you signed" beside every wall. Seven rows of
         the same word is worse than brief — it is a table whose entire second
         column is noise, and the founder's ruling that nothing is brief when
         opened is not satisfied by repeating one word down the page.

         THE DATE WAS ALREADY IN THE PAYLOAD AND WAS BEING DROPPED.
         `_visited_project` returns `at` from the place's `last` mark and
         `_marks_project` returns the date of the signature; both arrived here
         and neither was read. WHEN you were somewhere is the thing that makes
         a list of places a history rather than a set.

         `how` still rides along when it says something the default does not —
         a membership is not a visit — and is dropped when it is the ordinary
         case, because "visits" beside a date is the same noise one column
         over. */
      var v = (ref === 'guestbook') ? (x.removed ? 'Entry removed' : (x.body || ''))
            : (ref === 'visited' || ref === 'places') ? dayWhen(x.at, x.how, 'visits')
            /* FOLLOWING says what you ARE there — founding a place and
               following one are different relationships, and the row knows. */
            : (ref === 'following') ? (x.role || ' ')
            : (ref === 'marks') ? dayWhen(x.at, '', '')
            /* an activity's own words if a source gave any, else the source
               that reported it — "Kid A · Spotify" beats "Kid A · " */
            : (ref === 'now') ? (x.detail || x.source || '')
            : (x.detail || x.at || '');
      if (t) { id[t + (id[t] ? ' (' + (i + 1) + ')' : '')] = v || ' '; }
    });
    if (Object.keys(id).length) { out.identity = id; }

    /* ── EVERY OTHER SHAPE STILL HAS EVERYTHING IT HAS ────────────────────
       The two branches above know `{count, items}` and the week. Kinds whose
       projection is neither — `world` returns a label and a city, `links`
       returns a name, a category and a city — fell through with no `identity`
       at all, so opening one showed a title and a lead and nothing else. That
       is the founder's brief-info ruling surviving in the kinds nobody thought
       to check, which is exactly where it would.

       `factTable` already humanises a key into a label and already skips nulls,
       empty strings and nested objects — so the honest general answer is to
       hand it what the projection actually returned rather than teach this
       function eleven more shapes. A kind added tomorrow opens with its own
       fields on the day it is bound, without touching this. */
    if (!out.identity) {
      /* ── AND THE SUBJECT IS THE TITLE, NOT A ROW ────────────────────────
         `links` projects the LINKED Centre and `world` projects the place, so
         the `name` in the content is not this Popit's kind — it is what the
         Popit is ABOUT. Left in the fact table it was dropped outright, since
         the sheet skips `name` on purpose (the pane's own title already says
         it) — so opening a Link showed the word "Links" and nothing else while
         the Centre's actual name sat in the payload.

         Promoted here it becomes the pane's title, with `kind_label` still the
         eyebrow above it: LINKS / Feed Continuity Center. A placement the
         person has RENAMED keeps their name — theirs outranks the record's. */
      var subj = '';
      /* `who` leads: a Now opened with nothing reported took its title from
         `label` and called the pane "Online", which names the state and not
         the person it is about. Only presence puts `who` at the top level of
         its content — every list kind carries `who` per ITEM — so this stays
         the general rule it already was. */
      var keys = ['who', 'name', 'label', 'title'];
      for (var s = 0; s < keys.length; s++) {
        if (typeof c[keys[s]] === 'string' && c[keys[s]]) { subj = keys[s]; break; }
      }
      if (subj && out.label === out.kind_label) { out.label = c[subj]; }
      var flat = {};
      for (var f in c) {
        if (!Object.prototype.hasOwnProperty.call(c, f)) { continue; }
        var v = c[f];
        if (v === null || v === '' || typeof v === 'object') { continue; }
        /* the lead already says the count; repeating it as a row is noise */
        if (f === 'count') { continue; }
        if (f === subj) { continue; }     /* it is the title now */
        flat[f] = v;
      }
      if (Object.keys(flat).length) { out.identity = flat; }
    }
    if (c.days && c.labels) {
      /* ── THE OPENED RHYTHM IS THE FULL READING ─────────────────────────
         This listed seven integers, which is the same thinness the tile had
         and the founder's "almost joke like" one level in. An opened Popit
         should say everything it knows, so the record leads with what the week
         MEANT — the total, the direction, the busiest day, the coverage — and
         the day-by-day sits underneath it as the evidence. */
      var r = {};
      r['This week'] = String(c.total || 0);
      if (typeof c.prev_total === 'number') {
        r['Last week'] = String(c.prev_total) +
          (c.trend && c.trend !== 'level' ? ' (' + c.trend + ' since)' : '');
      }
      if (c.peak_day && c.peak) {
        r['Busiest day'] = c.peak_day.charAt(0) + c.peak_day.slice(1).toLowerCase() +
                           ' · ' + c.peak;
      }
      if (typeof c.active_days === 'number') {
        r['Days active'] = c.active_days + ' of 7';
      }
      if (typeof c.streak === 'number' && c.streak > 0) {
        r['Streak'] = c.streak === 1 ? '1 day' : c.streak + ' days running';
      }
      if (c.span) { r['Week of'] = c.span; }
      /* ── AND OPENED, THE READING IS LONGER THAN A WEEK ────────────────
         The registry gained an `open` branch on rhythm: twelve weekly totals,
         the busiest of them, and the two ends of the record — all derived from
         the 120 posts the reader was already fetching and this projection was
         already discarding. This branch built its record from the WEEK fields
         alone, so every one of those arrived and was dropped one line before
         being rendered. A projection that answers more and a panel that reads
         the same six keys is the same brief Popit with a longer payload.

         It sits ABOVE the day-by-day deliberately: the long shape is the
         reading, and the seven days are this week's evidence for it. */
      if (typeof c.in_window === 'number') {
        r['On record'] = c.in_window + (c.in_window === 1 ? ' post' : ' posts');
      }
      if (c.first_seen) {
        r['Since'] = c.first_seen + (c.last_seen && c.last_seen !== c.first_seen
                                     ? ' – ' + c.last_seen : '');
      }
      if (typeof c.active_days_total === 'number' && c.active_days_total) {
        r['Days posted on'] = String(c.active_days_total);
      }
      if (typeof c.per_active_day === 'number') {
        r['On a day they post'] = c.per_active_day + ' posts';
      }
      if (typeof c.best_week === 'number' && c.best_week) {
        r['Busiest week'] = c.best_week + (c.best_week_of
                                           ? ' · week of ' + c.best_week_of : '');
      }
      if (typeof c.weeks_counted === 'number') {
        r['Weeks with anything'] = c.weeks_counted + ' of 12';
      }
      c.labels.forEach(function (lbl, i) {
        var name = lbl.charAt(0) + lbl.slice(1).toLowerCase();
        r[name] = String(c.days[i] || 0);
      });
      out.identity = r;
      out.glance = (c.total || 0) + ' this week' +
        (c.trend === 'up' && typeof c.prev_total === 'number'
          ? ' · up from ' + c.prev_total
          : c.trend === 'down' && typeof c.prev_total === 'number'
            ? ' · down from ' + c.prev_total : '');
    }
    return out;
  }

  /* THE CATALOG ALREADY NAMES EVERY KIND — "Guestbook", not "guestbook" — and
     describes it in a sentence. Reading it here means the sheet's title and its
     lead come from the SAME declaration the picker shows, so a Popit cannot be
     called one thing when you add it and another when you open it. My first
     version read `_specs.kinds`, which does not exist, and every sheet opened
     titled with the raw ref. */
  function kindName(ref) {
    var c = _catalog[ref] || {};
    if (c.name) { return c.name; }
    /* ── A STRANGER HAS NO CATALOG ─────────────────────────────────────────
       `/api/canvas/catalog` requires a session — measured, it answers
       "Sign in" — so an anonymous visitor's canvas has no names, no blurbs and
       no specs, and every sheet opened titled "guestbook" in lowercase.

       The catalog needing auth may well be right; it lists a Centre's own apps.
       But a PUBLIC surface should not render worse for the public, so the ref
       is titled rather than shown raw. It is a fallback, not a translation —
       the catalog's own word still wins whenever it is there. */
    return ref ? ref.charAt(0).toUpperCase() + ref.slice(1) : '';
  }
  function kindBlurb(ref) {
    var c = _catalog[ref] || {};
    return c.blurb || (c.spec && c.spec.purpose) || '';
  }

  /* AN APP OPENS INTO ITS OWN WORLD, NOT INTO A SHEET.
     Full-bleed, no ONEWAY chrome inside the frame, sized by the app rather than
     by a card. The frame is the EXISTING sandboxed Popit-app runtime — one-shot
     ticket, capability bridge, no token inside — because that runtime is good
     and building a second one would be exactly the duplication we are removing.
     A ticket is fetched per open and is short-lived, so revoking an app takes
     effect on the next open rather than eventually. */
  function openApp(it, origin) {
    /* ── A GAME OPENS THE WAY EVERYTHING ELSE OPENS ────────────────────────
       ★ FOUNDER, 2026-09-09: *"i want full games to be able to be built
         uploaded and played in these like newgrounds"* and *"the animation will
         lead to that and be used for anything."*

       This built its OWN overlay — appended to the body, with a Close bar, no
       unfold and no origin. So a game arrived from nowhere while every other
       Popit unfolded out of the tile the person had just touched. One shelf,
       two ways of opening, and the game was the one that felt bolted on.

       It is the same pane now. `stage: true` renders the sheet with its reading
       furniture removed and the app owning the floor, so the unfold, the galaxy
       ground, the object's own hue, the edge-light, Escape, the scrim and the
       fold back into the bead are all the ones every Popit already has. Nothing
       about the app runtime changes: the ticket is still one-shot, the frame is
       still sandboxed, the CSP is still the runtime's.

       IT OPENS BEFORE THE TICKET LANDS, for the same reason every other Popit
       does — a person who taps a thing should never watch a spinner where the
       thing they tapped used to be. The frame is mounted into the stage when
       the ticket arrives, through `OW.stageNode`, which does not re-render the
       pane and so cannot cancel the unfold mid-flight. */
    if (!OW.open) { return; }
    var title = (it.config && it.config.title) || it.label || 'App';
    OW.open({ kind: it.ref, id: it.id, label: title,
              kind_label: (it.config && it.config.kind === 'game') ? 'Game' : 'App',
              stage: true }, origin);

    req('/api/popit-apps/' + encodeURIComponent(it.ref) + '/ticket',
        { method: 'POST', body: {} })
      .then(function (r) {
        var stage = OW.stageNode && OW.stageNode();
        if (!stage) { return; }        /* closed while the ticket was in flight */
        if (!r || !r.ok || !r.data || !r.data.ticket) {
          /* SAY WHY. An app that will not open and a blank rectangle are
             different things to the person looking at them. */
          stage.innerHTML = '<div class="po-stage__wait">This app could not be ' +
            'opened. It may have been removed, or access may have been withdrawn.</div>';
          return;
        }
        var f = doc.createElement('iframe');
        f.src = '/api/popit-apps/' + encodeURIComponent(it.ref) + '/host?t=' +
                encodeURIComponent(r.data.ticket);
        /* The runtime already sets a strict CSP on the document it serves; this
           is the second wall, on our side of the frame. `allow-scripts` alone
           keeps it same-origin-less, so it can run a game and reach nothing. */
        f.setAttribute('sandbox', 'allow-scripts');
        f.setAttribute('referrerpolicy', 'no-referrer');
        f.setAttribute('title', title);
        stage.innerHTML = '';
        stage.appendChild(f);
      })
      .catch(function () {});
  }

  /* ── ARRANGING ──────────────────────────────────────────────────────────
     Pointer events, so a finger and a mouse are one code path. The tile follows
     the pointer in pixels for feel, and SNAPS to the grid on release — the grid
     is what gets saved, and the pixels never do. */
  /* ═══ THE TRANSFORM BOX ═══════════════════════════════════════════════════
     ★ FOUNDER, 2026-08-26: *"moving and sizing and placing them should be up to
       the user, but always snap to where things are close to each other...
       a box that applies with a directional axis tilt and resizing lines like a
       text box."*

     The control is a TRANSFORM BOX — the selection rectangle with corner and
     edge handles plus a rotation handle that Figma, Canva, Keynote and Stories
     all use. It is everywhere precisely because it needs no explaining: the
     thing you are changing is the thing you grab.

     WHAT ALREADY EXISTED, AND WHAT DID NOT. Move existed and snapped to the
     grid on release; stickers could be turned. There was NO resize of any kind
     and no visible selection at all — measured on the running App, zero handle
     elements in the DOM — so a person could put a Popit anywhere and never
     change its size, which is half of what arranging means.

     TWO SNAPS, AND THE SECOND IS THE ONE ASKED FOR. The grid keeps a surface
     legible for people who did not arrange it. NEIGHBOUR snapping — edges and
     centres of the tiles already placed — is what makes a hand-made layout look
     deliberate, and it is what "snap to where things are close to each other"
     means. Both run; whichever is nearer wins, and the line it snapped to is
     drawn so the person can see WHY it moved. */
  var SNAP_PX = 9;                 /* how near counts as "close to each other" */

  Canvas.prototype.geom = function (grid) {
    var rect = grid.getBoundingClientRect();
    /* A ZERO-WIDTH GRID MUST NOT PRODUCE NaN. A hidden pane, a display:none
       ancestor or a measurement taken before layout all give width 0 — and
       `NaN + 'px'` is an invalid declaration the browser DROPS SILENTLY, so
       the transform box came back with no width at all and looked like a
       broken control rather than an unmeasurable one. Measured 2026-08-26. */
    var cw = (rect.width - GAP * (this.cols - 1)) / this.cols;
    if (!isFinite(cw) || cw <= 0) cw = 0;
    /* ── THE ROW HEIGHT IS READ, NOT ASSUMED ────────────────────────────
       ★ FOUNDER, 2026-09-13: *"MAKE SURE RESIZE WORKS UNIVERSALLY"* — and it
         did not, anywhere except one window width.

       Every pixel-to-row conversion in the drag and resize paths divided by
       the CONSTANT `ROW` (44). The row height has never actually been 44 on a
       real screen: it used to be clamped into 30–52, so 44 was merely
       near-enough in the middle of that band and wrong at both ends, and now
       that the cell is square it is 17px at a 320 plane and 63px at 880.
       Dividing a pointer delta by 44 when the row is 17 moves the tile a
       QUARTER as far as the hand — the control feels broken and the person
       cannot tell why.

       So the geometry asks the grid what a row is. One reading per gesture,
       from the same custom property the stylesheet lays the tiles out with,
       which is the only number that cannot disagree with what is on screen. */
    var rowh = this.rowPx();
    return { rect: rect, cw: cw, rowh: rowh,
             px: function (x) { return x * (cw + GAP); },
             py: function (y) { return y * (rowh + GAP); },
             pw: function (w) { return w * cw + (w - 1) * GAP; },
             ph: function (h) { return h * rowh + (h - 1) * GAP; } };
  };

  /* THE LINES SOMETHING SNAPPED TO. Drawn only while a gesture is live — a
     guide that outlives the drag is decoration. */
  Canvas.prototype.guides = function (grid, vs, hs) {
    var box = this._guideBox;
    if (!box) {
      box = this._guideBox = doc.createElement('div');
      box.className = 'ow-cv-guides';
      grid.appendChild(box);
    }
    var g = this.geom(grid), html = '';
    (vs || []).forEach(function (x) {
      html += '<i style="left:' + g.px(x) + 'px"></i>';
    });
    (hs || []).forEach(function (y) {
      html += '<u style="top:' + g.py(y) + 'px"></u>';
    });
    box.innerHTML = html;
  };
  Canvas.prototype.clearGuides = function () {
    if (this._guideBox) this._guideBox.innerHTML = '';
  };

  /* EVERY EDGE AND CENTRE ALREADY ON THE SURFACE, except the one being moved —
     snapping a tile to itself would pin it in place. */
  Canvas.prototype.snapLines = function (skipId) {
    /* THE LINES ARE IN VIEW SPACE, because the thing being dragged is. `it.x`
       and `it.w` are canonical twelfths; on a four-column phone a neighbour's
       edge at x=6 is at view-column 2, and offering the raw 6 would snap the
       tile to an edge that is not on the screen. Vertical lines are projected;
       horizontal ones are not, because rows are the same on every device. */
    var self = this;
    var vs = [0, this.cols], hs = [0];
    this.items.forEach(function (it) {
      if (it.id === skipId || it.gone) return;
      var x = self.toView(it.x), w = Math.max(1, self.toView(it.w || 1));
      var h = it.h || 1;
      vs.push(x, x + w, x + w / 2);
      hs.push(it.y, it.y + h, it.y + h / 2);
    });
    return { vs: vs, hs: hs };
  };

  /* `(value, hitList)` — the nearest line within reach, in GRID units, using a
     pixel threshold so the pull feels the same on a phone and a monitor. */
  function nearest(v, lines, perUnit) {
    var best = null, bestD = SNAP_PX;
    for (var i = 0; i < lines.length; i++) {
      var d = Math.abs((lines[i] - v) * perUnit);
      if (d < bestD) { bestD = d; best = lines[i]; }
    }
    return best;
  }

  Canvas.prototype.select = function (grid, tile, item) {
    var self = this;
    this.deselect();
    if (!this.mayArrange || !tile || !item) return;
    this._sel = { tile: tile, item: item };
    tile.setAttribute('data-selected', '');

    var box = doc.createElement('div');
    box.className = 'ow-cv-box';
    box.setAttribute('aria-hidden', 'true');
    /* ── ONE HANDLE, NOT NINE ─────────────────────────────────────────────
       ★ FOUNDER, 2026-09-02: *"make them easier to click on and edit like hold
         down with ios apps."*  and, standing since 2026-08-28, that arranging
       a Home should not feel like *"wrestling with an SVG transform editor."*

       This used to build eight handles and a turn on EVERY selection — the
       comment above it said "the vocabulary a person already knows", and that
       was true of a drawing program and false of a Home screen. Nine targets
       on a 92px tile also means eight of them sit within a thumb's width of
       each other, which is the literal reading of "easier to click on".

       WHAT REPLACES THEM IS THE TILE ITSELF. The whole tile is the drag target
       once the grid is shaking, so position needs no handle at all. Size keeps
       ONE, at the bottom-right, where a resize handle has lived in every
       windowing system since 1984 — and only when the kind actually declares
       `resize`. Rotation likewise appears only for a kind that declares it,
       which on this platform is a sticker, and never for a grid Popit that
       would only snap back. */
    var dirs = mayResize(item) ? ['se'] : [];
    dirs.forEach(function (dir) {
      var h = doc.createElement('b');
      h.className = 'ow-cv-h ow-cv-h--' + dir;
      h.setAttribute('data-dir', dir);
      box.appendChild(h);
    });
    if (mayRotate(item)) {
      var turn = doc.createElement('i');
      turn.className = 'ow-cv-h ow-cv-h--turn';
      turn.setAttribute('data-dir', 'turn');
      box.appendChild(turn);
    }
    /* THE REMOVE BADGE, WHERE IOS PUTS IT. Removing a Popit was reachable only
       from a menu; on a shaking grid the badge is the affordance people expect,
       and it is the other half of "easier to edit". */
    if (self.mayArrange) {
      var kill = doc.createElement('button');
      kill.type = 'button';
      kill.className = 'ow-cv-kill';
      kill.setAttribute('aria-label', 'Remove ' + (item.name || 'this Popit'));
      kill.textContent = '\u2212';
      kill.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      kill.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        if (typeof self.remove === 'function') self.remove(item.id);
        else doc.dispatchEvent(new CustomEvent('ow:remove-popit',
          { detail: { id: item.id, surface: self.surface } }));
      });
      box.appendChild(kill);
    }
    grid.appendChild(box);
    this._box = box;
    this.placeBox(grid);

    /* ── A CLOCK NEEDS A ZONE, OR IT IS HALF A CLOCK ──────────────────────
       ★ FOUNDER: *"clocks set to time zones."*

       Adding one from the picker gives it UTC, because the picker places a
       kind and knows nothing about configuration — so without this a person
       could add a Clock and never make it their Clock. The chooser rides the
       SELECTION rather than living in a settings panel: the thing you are
       changing is already the thing you grabbed.

       THE DEVICE'S OWN ZONE LEADS. It is the one a person is most likely to
       want and the only one we can know without asking. The rest are offered
       as a short list rather than a search over six hundred IANA names — a
       Clock is chosen, not configured. */
    if (item.ref === 'clock') {
      /* ── A PERSON PICKS A CITY, NOT AN IANA IDENTIFIER ────────────────
         ★ FOUNDER, 2026-08-30: *"not make the user understand IANA timezone
           identifiers... The underlying backend can store America/New_York but
           the user sees New York."*

         So the search is over CITY NAMES and the identifier is what gets
         stored. `Intl.supportedValuesOf('timeZone')` is the browser's own list
         where it exists — every zone the platform could ever want, with no
         table to maintain here — and a short hand-written list is the fallback
         for engines that do not have it yet. */
      var zones = [];
      try {
        var mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (mine) zones.push(mine);
      } catch (e) {}
      try {
        if (Intl.supportedValuesOf) {
          Intl.supportedValuesOf('timeZone').forEach(function (z) {
            if (zones.indexOf(z) < 0) zones.push(z);
          });
        }
      } catch (e) {}
      if (zones.length < 5) {
        ['America/New_York', 'America/Los_Angeles', 'America/Chicago',
         'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
         'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
         'Australia/Sydney', 'America/Sao_Paulo', 'Africa/Lagos', 'UTC']
          .forEach(function (z) { if (zones.indexOf(z) < 0) zones.push(z); });
      }
      /* THE ONES PEOPLE ACTUALLY ADD, offered before anybody types. A list of
         six hundred is a database, not a choice. */
      var COMMON = ['America/New_York', 'America/Los_Angeles', 'Europe/London',
                    'Europe/Paris', 'Asia/Tokyo', 'Asia/Dubai',
                    'Australia/Sydney', 'UTC'];
      function cityOf(z) { return z.split('/').pop().replace(/_/g, ' '); }

      var zb = doc.createElement('div');
      zb.className = 'ow-cv-zones';

      /* ── PRESENTATION IS THE PERSON'S, NOT THE PLATFORM'S ──────────────
         ★ FOUNDER, 2026-08-30: *"people should be able to choose
           presentation."*

         A dial and a readout show one fact two ways, and which one somebody
         wants is taste. Offered on the SELECTION, beside the zone, because
         both are facts about this placement — and stored per placement, so one
         Home can hold a numeric New York and an analogue Tokyo. */
      function chips(rows, current, apply) {
        var g = doc.createElement('div');
        g.className = 'ow-cv-chips';
        rows.forEach(function (r) {
          var b = doc.createElement('button');
          b.type = 'button'; b.className = 'ow-cv-zone'; b.textContent = r[1];
          if (current === r[0]) b.setAttribute('aria-pressed', 'true');
          b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          b.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            item.config = item.config || {};
            apply(r[0]);
            self.dirty = true; self.save();
            var host = tile.querySelector('.ow-cv-face');
            if (host) {
              host.innerHTML = '';
              host.appendChild(clockFace(item.config, item.w || 3, item.h || 2));
            }
            Array.prototype.forEach.call(g.children, function (x) { x.removeAttribute('aria-pressed'); });
            b.setAttribute('aria-pressed', 'true');
          });
          g.appendChild(b);
        });
        return g;
      }
      var cfgNow = item.config || {};
      zb.appendChild(chips([['digital', 'Digits'], ['analog', 'Dial'], ['both', 'Both']],
        cfgNow.face || 'digital', function (v) { item.config.face = v; }));
      zb.appendChild(chips([['12', '12h'], ['24', '24h']],
        cfgNow.format || '12', function (v) { item.config.format = v; }));
      zb.appendChild(chips([[false, 'No seconds'], [true, 'Seconds']],
        !!cfgNow.seconds, function (v) { item.config.seconds = v; }));

      function pickZone(z) {
        item.config = item.config || {};
        item.config.tz = z;
        item.config.label = cityOf(z);      /* what the person sees */
        self.dirty = true; self.save();
        var host = tile.querySelector('.ow-cv-face');
        if (host) {
          host.innerHTML = '';
          host.appendChild(clockFace(item.config, item.w || 3, item.h || 2));
        }
      }

      var find = doc.createElement('div');
      find.className = 'ow-cv-find';
      var input = doc.createElement('input');
      input.type = 'search';
      input.className = 'ow-cv-search';
      input.placeholder = 'Search a city';
      input.setAttribute('aria-label', 'Search for a city');
      var list = doc.createElement('div');
      list.className = 'ow-cv-hits';
      find.appendChild(input); find.appendChild(list);

      function paint(q) {
        q = (q || '').trim().toLowerCase();
        var pool = q
          ? zones.filter(function (z) { return cityOf(z).toLowerCase().indexOf(q) >= 0
                                            || z.toLowerCase().indexOf(q) >= 0; })
          : COMMON.filter(function (z) { return zones.indexOf(z) >= 0; });
        list.innerHTML = '';
        if (q && !pool.length) {
          var none = doc.createElement('span');
          none.className = 'ow-cv-none';
          none.textContent = 'No city by that name';
          list.appendChild(none);
          return;
        }
        /* CAPPED, AND THE CAP IS SAID. Six hundred buttons is not a menu. */
        pool.slice(0, 24).forEach(function (z) {
          var b = doc.createElement('button');
          b.type = 'button'; b.className = 'ow-cv-zone';
          b.textContent = cityOf(z); b.title = z;
          if ((item.config || {}).tz === z) b.setAttribute('aria-pressed', 'true');
          b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          b.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            pickZone(z);
            Array.prototype.forEach.call(list.children, function (x) { x.removeAttribute('aria-pressed'); });
            b.setAttribute('aria-pressed', 'true');
          });
          list.appendChild(b);
        });
        if (pool.length > 24) {
          var more = doc.createElement('span');
          more.className = 'ow-cv-none';
          more.textContent = '+' + (pool.length - 24) + ' more — keep typing';
          list.appendChild(more);
        }
      }
      input.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      input.addEventListener('input', function () { paint(input.value); });
      paint('');
      zb.appendChild(find);
      box.appendChild(zb);
    }

    /* ═══ THIS POPIT'S OWN COLOUR ═════════════════════════════════════════
       ★ FOUNDER, 2026-08-30: *"colors should be an option to recolor
         individual popits"* · *"Center hue → Popit inherits. Override:
         Popit-specific hue → Popit uses its own appearance."*

       ON THE SELECTION, LIKE THE CLOCK'S ZONE, AND FOR EVERY KIND. Colour is a
       fact about a PLACEMENT rather than about what a Popit means, so it is
       offered wherever a placement is selected — a Highlight, a sticker and a
       Clock are all things somebody might want in a different colour, and none
       of them should need its own settings screen to say so.

       "CENTER COLOUR" LEADS AND IS THE DEFAULT STATE. Inheriting is not the
       absence of a choice, it is the choice most people want, so it is a
       control rather than something you reach by deselecting every swatch. It
       CLEARS the stored key, which is what makes the Center's hue able to win
       the tile back — see `_look_config` in canvas.py for why absent and zero
       have to be different things.

       IT APPLIES BEFORE IT SAVES. The properties are written straight onto the
       tile so the change is visible on the same frame the finger lands, and the
       save follows. A colour picker that waits for a round trip feels broken
       even when it is working, and re-rendering the tile instead would destroy
       the selection the person is still holding. */
    /* ── FILLING IN A POPIT YOU HAVE PLACED ────────────────────────────────
       ★ FOUNDER, 2026-09-09: *"i want them to be fully customizeable"* — and
         the operating directive: *"There is no longer time for endless
         exploratory development... the objective is a finished platform."*

       THE LOOP WAS OPEN AND THIS IS WHERE IT BROKE. Six kinds have a complete,
       server-validated field — `count` a number and a caption, `since` a date,
       `said` and `now` a line of text, `links` up to six links, `favourite` a
       Post — and complete tile renderers reading it. `KIND_SPECS` even declares
       `"action": "edit"` for four of them. THERE WAS NO INPUT ANYWHERE. A
       person could add a Count and never give it a number; the tile said
       "Nothing here yet" forever and was telling the truth.

       The comment that created those fields says the tiles *"were empty because
       the platform had no field to put them in"*. The field exists now. This is
       the half that never arrived — a validator with no writer is the same
       dead-capability shape as a writer with no reader, seen from the other
       end.

       IT RIDES THE SELECTION, exactly as the Clock's zone chooser does, for the
       reason stated there: *"the thing you are changing is already the thing
       you grabbed."* No settings screen, no second navigation, no modal. And it
       JOINS the panel the clock and colour rows already build rather than
       making a third absolute box at the same coordinates — the mistake
       `colourRow` records below.

       WHAT IT DOES NOT DO: invent a field. Every input here writes a key the
       server already validates (`_count_config`, `_since_config`, `_said_config`,
       `_now_config`, `_links_config` in api/canvas/canvas.py). Nothing is
       stored that the server would strip, and nothing is offered that it would
       refuse. */
    (function contentRow() {
      var FIELDS = {
        count:     [{ k: 'value',   t: 'number', label: 'Number', max: 12 },
                    { k: 'caption', t: 'text',   label: 'What it counts', max: 40 }],
        since:     [{ k: 'started', t: 'date',   label: 'Since when' },
                    { k: 'caption', t: 'text',   label: 'What began', max: 40 }],
        said:      [{ k: 'text',    t: 'area',   label: 'In their words', max: 160 }],
        now:       [{ k: 'text',    t: 'text',   label: 'What you are doing', max: 90 }],
        links:     [{ k: 'links',   t: 'links',  label: 'Links' }]
      };
      var fields = FIELDS[item.ref];
      if (!fields || !self.mayArrange) { return; }

      var panel = box.querySelector('.ow-cv-zones');
      var own = !panel;
      if (own) {
        panel = doc.createElement('div');
        panel.className = 'ow-cv-zones';
      }
      var wrap = doc.createElement('div');
      wrap.className = 'ow-cv-cfg';

      /* ONE WRITE PATH. Every field lands here, so the dirty flag, the save and
         the redraw cannot differ between them — which is how two inputs on one
         panel come to disagree about whether a change was kept. */
      function put(key, val) {
        item.config = item.config || {};
        if (val === '' || val === null || val === undefined) { delete item.config[key]; }
        else { item.config[key] = val; }
        self.dirty = true;
        self.save();
        /* ── THE TILE ANSWERS WITH WHAT WAS JUST TYPED ──────────────────
           Redrawn in place rather than through `render()`, for the reason the
           Clock's own `pickZone` gives: a full re-render rebuilds every tile
           and would destroy the selection box this panel is inside — the person
           would be typing into a field that vanishes on the first keystroke. */
        var host = tile.querySelector('.ow-cv-face');
        if (host && self.tile) {
          var fresh = self.tile(item);
          var face = fresh && fresh.querySelector('.ow-cv-face');
          if (face) { host.innerHTML = face.innerHTML; host.className = face.className; }
        }
      }

      fields.forEach(function (f) {
        var row = doc.createElement('label');
        row.className = 'ow-cv-cfg__row';
        var lab = doc.createElement('span');
        lab.className = 'ow-cv-cfg__k';
        lab.textContent = f.label;
        row.appendChild(lab);

        if (f.t === 'links') {
          /* SIX SLOTS, WHICH IS THE SERVER'S OWN CAP. Showing seven and having
             one silently dropped is the kind of half-honest form this file
             refuses elsewhere. */
          var have = ((item.config || {}).links || []).slice(0, 6);
          var host = doc.createElement('span');
          host.className = 'ow-cv-cfg__links';
          function drawLinks() {
            host.innerHTML = '';
            var rows = have.concat(have.length < 6 ? [{ label: '', url: '' }] : []);
            rows.forEach(function (L, i) {
              var pair = doc.createElement('span');
              pair.className = 'ow-cv-cfg__pair';
              var nm = doc.createElement('input');
              nm.type = 'text'; nm.className = 'ow-cv-cfg__in';
              nm.placeholder = 'Name'; nm.maxLength = 40; nm.value = L.label || '';
              var ur = doc.createElement('input');
              ur.type = 'url'; ur.className = 'ow-cv-cfg__in ow-cv-cfg__in--url';
              ur.placeholder = 'https://'; ur.maxLength = 300; ur.value = L.url || '';
              function commit() {
                have[i] = { label: nm.value.trim(), url: ur.value.trim() };
                /* A LINK WITH NO URL IS NOT A LINK. The server drops it; this
                   drops it too, so the two never disagree about what was kept. */
                have = have.filter(function (x) { return x && x.url; }).slice(0, 6);
                put('links', have.length ? have : null);
                drawLinks();
              }
              nm.addEventListener('change', commit);
              ur.addEventListener('change', commit);
              [nm, ur].forEach(function (el) {
                el.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
                el.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
              });
              pair.appendChild(nm); pair.appendChild(ur);
              host.appendChild(pair);
            });
          }
          drawLinks();
          row.appendChild(host);
        } else {
          var inp = doc.createElement(f.t === 'area' ? 'textarea' : 'input');
          inp.className = 'ow-cv-cfg__in';
          if (f.t !== 'area') {
            inp.type = (f.t === 'date') ? 'date' : (f.t === 'number' ? 'number' : 'text');
          }
          if (f.max) { inp.maxLength = f.max; }
          if (f.t === 'number') { inp.min = '-999999999'; inp.max = '999999999'; }
          var cur = (item.config || {})[f.k];
          inp.value = (cur === undefined || cur === null) ? '' : String(cur);
          inp.placeholder = f.label;
          /* THE CANVAS IS LISTENING FOR DRAGS AND KEYS. Without these a tap in
             a field starts an arrange gesture and typing a space scrolls the
             page — the field would look editable and not be. */
          inp.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          inp.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
          inp.addEventListener('change', function () {
            var v = inp.value.trim();
            if (f.t === 'number') {
              var n = parseInt(v, 10);
              put(f.k, (v === '' || isNaN(n)) ? null : n);
            } else {
              put(f.k, v || null);
            }
          });
          row.appendChild(inp);
        }
        wrap.appendChild(row);
      });

      panel.appendChild(wrap);
      if (own) { box.appendChild(panel); }
    })();

    (function colourRow() {
      var WHEEL = [266, 292, 320, 348, 12, 28, 46, 88, 150, 186, 208, 238];
      /* ONE PANEL PER SELECTION, NOT TWO STACKED ON EACH OTHER.
         `.ow-cv-zones` is `position:absolute` at `top:calc(100% + 10px)`, so a
         second one lands in exactly the same place as the first — on a Clock the
         colour row would have been drawn underneath the zone search, both
         claiming the same coordinates. So this JOINS the panel that is already
         there and only makes its own when the placement has no settings of its
         own. Same reason the clock's own chips live in one `zb` rather than
         three absolute rows. */
      var panel = box.querySelector('.ow-cv-zones');
      var own = !panel;
      if (own) {
        panel = doc.createElement('div');
        panel.className = 'ow-cv-zones';
      }
      var wrap = doc.createElement('div');
      wrap.className = 'ow-cv-colour';
      var lab = doc.createElement('span');
      lab.className = 'ow-cv-zlab'; lab.textContent = 'Colour';
      wrap.appendChild(lab);
      var row = doc.createElement('div');
      row.className = 'ow-cv-swatches';

      function press(el) {
        Array.prototype.forEach.call(row.children, function (x) {
          x.removeAttribute('aria-pressed'); });
        if (el) el.setAttribute('aria-pressed', 'true');
      }
      function wear(angle) {
        item.config = item.config || {};
        if (angle == null) {
          delete item.config.hue;
          tile.style.removeProperty('--ow-h1');
          tile.style.removeProperty('--ow-h2');
          tile.style.removeProperty('--ow-h3');
          tile.removeAttribute('data-recoloured');
        } else {
          item.config.hue = angle;
          var pair = OW.hue.fromAngle(angle);
          tile.style.setProperty('--ow-h1', pair[0]);
          tile.style.setProperty('--ow-h2', pair[1]);
          if (OW.hue.third) tile.style.setProperty('--ow-h3', OW.hue.third(pair[0]) || pair[1]);
          tile.style.setProperty('--po-h', angle);
          tile.setAttribute('data-recoloured', '1');
        }
        self.dirty = true; self.save();
      }

      var none = doc.createElement('button');
      none.type = 'button'; none.className = 'ow-cv-zone';
      none.textContent = 'Center colour';
      if (!(item.config || {}).hue && (item.config || {}).hue !== 0) {
        none.setAttribute('aria-pressed', 'true');
      }
      none.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      none.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation(); wear(null); press(none);
      });
      row.appendChild(none);

      WHEEL.forEach(function (a) {
        var b = doc.createElement('button');
        b.type = 'button'; b.className = 'ow-cv-sw';
        var pair = OW.hue.fromAngle(a);
        b.style.setProperty('--sw1', 'rgb(' + pair[0] + ')');
        b.style.setProperty('--sw2', 'rgb(' + pair[1] + ')');
        b.setAttribute('aria-label', 'Colour ' + a);
        if (String((item.config || {}).hue) === String(a)) {
          b.setAttribute('aria-pressed', 'true');
        }
        b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
        b.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation(); wear(a); press(b);
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      panel.appendChild(wrap);
      if (own) box.appendChild(panel);
      /* CLAMP AFTER THE PANEL EXISTS. `placeBox` measures it and pulls it back
         inside the canvas — running before it was built measured nothing, and
         three chips stayed off-screen on a right-hand tile. */
      self.placeBox();
    })();

    box.addEventListener('pointerdown', function (e) {
      var dir = e.target && e.target.getAttribute && e.target.getAttribute('data-dir');
      if (!dir) return;
      e.preventDefault(); e.stopPropagation();
      if (dir === 'turn') return self.beginTurn(grid, e);
      self.beginResize(grid, e, dir);
    });
  };

  Canvas.prototype.deselect = function () {
    if (this._sel && this._sel.tile) this._sel.tile.removeAttribute('data-selected');
    if (this._box && this._box.parentNode) this._box.parentNode.removeChild(this._box);
    this._box = null; this._sel = null;
    this.clearGuides();
  };

  /* ═══ WHERE A GESTURE LEAVES THINGS IS NOT WHERE THEY BELONG ══════════════
     ★ FOUNDER, 2026-08-30: *"the adjustment axis needs to follow the popits set
       postion not what user last moved it to an should auto snap if rotation
       isnt allowed."*

     DURING a drag the tile tracks the pointer, which is correct — the object
     should be under your finger. AFTER it, the stored geometry is the truth,
     and for a grid-bound Popit that truth is a whole number of cells and an
     angle of zero. Nothing was re-asserting it: `up()` cleared the guides and
     saved, so the transform box kept whatever sub-cell offset the pointer
     happened to end on and the axis sat slightly off the object it framed.

     So every gesture ends here. The values are snapped ONCE, at the commit,
     written back to the tile, and the box is re-placed FROM THE TILE — which is
     the same single source `placeBox` already measures, so the box and the
     object cannot disagree by construction.

     A STICKER IS EXEMPT AND THAT IS THE WHOLE POINT OF A STICKER: it answers to
     the hand, keeps its angle, and is not pulled onto the grid. */
  /* ═══ TWO POPITS MAY NOT OCCUPY THE SAME CELLS ═══════════════════════════
     ★ FOUNDER, 2026-08-30: *"need a flawless widget system"* · *"its not as
       smooth, or as seemless as I need it to be."*

     FOUND BY LOOKING AT THE SCREEN, not by measuring. Three placements were
     stored overlapping — a Highlight ring drawn on top of the Said Popit, its
     own title hidden behind the Playlist beside it. Every geometry check passed
     the whole time, because each tile was individually correct; nothing had ever
     asked whether two of them wanted the same cells.

     NO GRID WIDGET SYSTEM ALLOWS THIS. A home screen does not let you drop one
     widget onto another and leave both there — the one you are holding wins its
     place and the others yield. That is the behaviour people already expect, so
     it needs no explaining, and it is the difference between an arrangement and
     a pile.

     THE TILE YOU MOVED IS THE ANCHOR. It is placed first and keeps exactly where
     it was dropped; everything else is re-seated in reading order, pushed DOWN
     until it fits. Down rather than sideways because a column is a stronger
     visual relationship than a row here — a Popit that jumps to the far side of
     the canvas has been moved by the platform, which is the thing that makes an
     arrangement feel like it is being argued with.

     STICKERS ARE EXEMPT, as they are from every other grid rule: they are
     decoration and they are meant to overlap. `FREEFORM` is the one place that
     distinction is declared. */
  function _boxOf(it) {
    return { x: it.x || 0, y: it.y || 0, w: it.w || 1, h: it.h || 1 };
  }
  function _hits(a, b) {
    return Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x)
        && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  }

  /* ═══ THE LAYOUT PASS — PACK, DO NOT MERELY PROJECT ══════════════════════
     ★ FOUNDER, 2026-08-30: *"when adjusting view ratio everything breaks layout
       wise completly"* · *"things are overlapping, not free to be used and
       moved at will."*

     PROJECTING x AND w PROPORTIONALLY IS NOT ENOUGH, and looking at the screen
     is what showed it. At 900px the canvas ran at ten columns, the authored
     twelve-column arrangement scaled down — and every Popit ended up alone on
     its own row with the entire right half of the canvas empty. Each tile was
     individually correct. The composition was gone.

     TWO THINGS WERE WRONG AND THEY COMPOUND:
       · a proportional x can land a tile where it no longer fits, and
       · the overlap fix only ever pushed DOWN, so anything that collided became
         a new row instead of moving beside its neighbour.
     Between them, a side-by-side arrangement became a column of islands.

     SO THE VIEW IS PACKED. The canonical arrangement gives the ORDER — reading
     order, top-to-bottom then left-to-right, which is what a person actually
     authored — and each Popit is placed at the first position where it FITS in
     the columns this device really has. It keeps its own column when that
     column is free, so on a wide screen the layout is the one they made; it
     slides up beside its neighbour when there is room, so on a narrow one there
     are no holes.

     NOTHING CANONICAL IS TOUCHED. This produces VIEW coordinates only. The
     stored arrangement stays the twelve-column intent, so a phone never
     rewrites what a desktop authored — which is the invariant the founder set:
     *"the user's arrangement is canonical, the viewport is only a projection."*

     STICKERS DO NOT PARTICIPATE. They are freeform by declaration and float
     above the grid. */
  /* ═══ DISPLACEMENT — MOVE ONLY WHAT MUST MOVE ════════════════════════════
     ★ FOUNDER, 2026-08-30: *"I moved this here, and the other things
       intelligently made room"* · *"don't arbitrarily repack the entire page
       just because a denser arrangement exists"* · *"only move things that need
       to move because of the user's action."*

     THIS IS NOT `packed()`. `packed()` re-seats EVERY placement and is the right
     answer for a RESPONSIVE PROJECTION — a different column count is a different
     grid, and something has to decide the whole arrangement. It is the wrong
     answer while somebody is dragging, because it re-authors the page in
     response to one gesture, which is precisely the "layout engine replaced my
     intent" the founder ruled against.

     SO: the moving Popit goes where the pointer says. Anything it lands on is
     pushed DOWN by the least that clears it, and anything THAT displaces is
     pushed in turn — the cascade stops as soon as nothing overlaps. Everything
     the gesture did not touch keeps the exact cells it had.

     DOWN, NOT SIDEWAYS, and never a re-sort: a Popit that reappears on the
     other side of the canvas has been moved by the platform, and the person has
     lost the spatial map they were working from.

     THE INVARIANT IS ABSOLUTE — no two grid Popits may occupy a cell, in any
     state, including mid-drag. That is what makes the preview honest: what you
     see while dragging is what release commits. */
  /* ═══ THE INVARIANT IS CANONICAL, SO IT MUST BE ENFORCED THERE ═══════════
     ★ FOUNDER, 2026-08-30: *"nothing can occupy the same space as another
       Popit. Ever."*

     MEASURED AND IT WAS BROKEN: dragging across columns produced two stored
     overlaps, dragging past the right edge produced one — while the SCREEN
     showed none. Collisions were being resolved in VIEW space (six columns on
     this shell) and written back in CANONICAL space (twelve), and the two
     disagree: two tiles a whole view-column apart can land on the same
     canonical cells once `toBase` doubles their coordinates, and a displaced
     neighbour keeps its canonical `x`, so nothing notices.

     So the commit ends here. The same minimal-displacement rule is applied a
     second time, in twelve-column space, anchored on the Popit the person
     actually moved — it keeps exactly where they put it, and anything that
     collides only in canonical space is pushed down by the least that clears
     it. Everything else is untouched, which is the whole point.

     THE VIEW PASS IS STILL RIGHT AND STILL NEEDED: it is what makes the ghost
     honest and the neighbours move under the finger. This is not a replacement
     for it — it is the guarantee that what gets STORED satisfies the invariant
     the founder set, on a grid the person may not even be looking at. */
  Canvas.prototype.settleCanonical = function (anchorId) {
    var base = {}, self = this;
    (this.items || []).forEach(function (it) {
      if (FREEFORM.indexOf(it.kind) >= 0) return;      /* stickers float */
      base[it.id] = { x: it.x || 0, y: it.y || 0,
                      w: Math.max(1, it.w || 1), h: Math.max(1, it.h || 1) };
    });
    var anchor = base[anchorId];
    if (!anchor) return false;
    var out = this.displace(base, anchorId, anchor);
    var changed = false;
    (this.items || []).forEach(function (it) {
      var b = out[it.id];
      if (!b) return;
      if (it.y !== b.y || it.x !== b.x) { changed = true; }
      it.x = b.x; it.y = b.y;
    });
    return changed;
  };

  Canvas.prototype.displace = function (base, movingId, box) {
    var out = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) {
      out[k] = { x: base[k].x, y: base[k].y, w: base[k].w, h: base[k].h };
    }
    out[movingId] = { x: box.x, y: box.y, w: box.w, h: box.h };

    var ids = Object.keys(out).filter(function (id) { return id !== movingId; });
    /* nearest first, so a cascade resolves in the order a person would expect */
    ids.sort(function (a, b) { return (out[a].y - out[b].y) || (out[a].x - out[b].x); });

    var settled = [out[movingId]], guard = 0;
    ids.forEach(function (id) {
      var b = out[id];
      while (guard++ < 2000 && settled.some(function (p) { return _hits(b, p); })) {
        /* the LEAST that clears it — drop to the bottom of whatever it is
           sitting on, not an arbitrary row further down */
        var lowest = b.y + 1;
        settled.forEach(function (p) {
          if (_hits(b, p)) lowest = Math.max(lowest, p.y + p.h);
        });
        b.y = lowest;
      }
      settled.push(b);
    });
    return out;
  };

  /* ── A PLACEMENT NOBODY BUT ITS OWNER CAN SEE IS NOT IN THE LAYOUT ─────
     ★ MEASURED 2026-09-12 on a real Centre's public face: 18 placements, TEN
       of them voided for a visitor — retired vocabulary, and Popits that can
       only ever answer for a person. Every one of them still held its six
       cells, so the page a visitor got was two Popits, a hole, two Popits,
       two holes, and an empty row at the top.

     The comment on the void branch argued for keeping the cells so that "a
     visitor and the owner see the same arrangement". That reasoning is right
     about ONE hole and wrong about ten: at that density the arrangement a
     visitor sees is not the owner's arrangement with a gap in it, it is a
     sieve, and the geometry being faithful to a layout nobody can perceive
     buys nothing. The owner still sees every placement, in place, with its
     notice — they are the only person who can act on it.

     SO IT IS DECIDED ONCE, HERE, and the pack closes over it: the same
     predicate gates the layout and the draw, because a tile excluded from one
     and not the other is a hole of a different kind. */
  Canvas.prototype.isVoid = function (it) {
    /* ── A RETIRED PLACEMENT HOLDS ITS CELLS ONLY WHILE ARRANGING ─────────
       ★ MEASURED 2026-09-20 on loop.ada's Home at 290px: six retired
         placements (count · since · said · rhythm · marks · colours) are not
         drawn outside arranging (founder/424 took the tombstones down) — and
         every one still held its rows, so Home was two tiles, a hole the
         height of a screen, two tiles. Invisible AND load-bearing is the worst
         of both. Outside arranging the pack closes over them, for the owner
         as for a visitor; in Arrange they take their place again, with the
         notice and the remove, because that is where they can be acted on. */
    if (it.config && it.config.retired) return !(this.mayArrange && this.editing);
    if (this.mayArrange) return false;
    return it.state === 'not_supported';
  };

  Canvas.prototype.packed = function () {
    var self = this, cols = this.cols || COLS;
    var out = {}, rows = [];          /* rows[y] = array of booleans, cols wide */

    function free(x, y, w, h) {
      if (x < 0 || x + w > cols) return false;
      for (var j = y; j < y + h; j++) {
        var row = rows[j];
        if (!row) continue;
        for (var i = x; i < x + w; i++) if (row[i]) return false;
      }
      return true;
    }
    function occupy(x, y, w, h) {
      for (var j = y; j < y + h; j++) {
        if (!rows[j]) { rows[j] = []; }
        for (var i = x; i < x + w; i++) rows[j][i] = true;
      }
    }

    var order = (this.items || []).filter(function (it) {
      return FREEFORM.indexOf(it.kind) < 0 && !self.isVoid(it);
    }).sort(function (a, b) {
      return ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0));
    });

    order.forEach(function (it) {
      /* ── THE DECLARED MINIMUM IS ENFORCED HERE, OR IT IS DECORATION ──────
         ★ FOUNDER, 2026-08-30, on the capability contract: *"individual widgets
           declare what they are capable of."*

         Every kind declares a `min` in `KIND_SPECS` — `posts` says four columns
         by two rows, because a Post is a wide object. NOTHING READ IT. The
         floor here was the literal number 1, so on a narrow phone a canonical
         6-wide Latest projected to a SINGLE column: measured 2026-09-02, a 98px
         tile holding a 78px card whose name column was 30px, wrapping "Loop
         Test Center 370201" into a six-line stack. Every CSS repair for that is
         a repair to a situation that should not arise.

         So the projection floors at the declared minimum, and only the screen
         itself may override it — `Math.min(cols, ...)` because a two-column
         phone cannot give four, and a Popit that takes the whole row there is
         the correct answer rather than a violated contract. A kind that
         declares nothing keeps the old floor of one. */
      var _sp = specOf(it);
      var _minW = (_sp && _sp.min && _sp.min.length) ? (_sp.min[0] || 1) : 1;
      var floorW = Math.max(1, Math.min(cols, _minW));
      var vw = Math.max(floorW, Math.min(cols, Math.round(self.toView(it.w || 3))));
      var _minH = (_sp && _sp.min && _sp.min.length > 1) ? (_sp.min[1] || 1) : 1;
      var vh = Math.max(1, _minH, it.h || 2);
      var want = Math.max(0, Math.min(cols - vw, Math.round(self.toView(it.x || 0))));
      var y = 0, placed = false;
      /* THE AUTHORED COLUMN FIRST — a tile that still fits where it was put
         stays where it was put, which is what keeps a wide screen looking like
         the arrangement somebody actually made. */
      for (y = 0; y < 400 && !placed; y++) {
        if (free(want, y, vw, vh)) { out[it.id] = { x: want, y: y, w: vw, h: vh }; placed = true; break; }
        for (var x = 0; x <= cols - vw; x++) {
          if (free(x, y, vw, vh)) { out[it.id] = { x: x, y: y, w: vw, h: vh }; placed = true; break; }
        }
      }
      if (!placed) out[it.id] = { x: 0, y: rows.length, w: vw, h: vh };
      var b = out[it.id];
      occupy(b.x, b.y, b.w, b.h);
    });
    return out;
  };

  Canvas.prototype.relayout = function (anchorId) {
    var gridItems = (this.items || []).filter(function (it) {
      return FREEFORM.indexOf(it.kind) < 0;
    });
    var order = gridItems.slice().sort(function (a, b) {
      if (a.id === anchorId) return -1;
      if (b.id === anchorId) return 1;
      return (a.y - b.y) || (a.x - b.x);
    });
    var placed = [], moved = false;
    order.forEach(function (it) {
      var box = _boxOf(it), guard = 0;
      /* BOUNDED. A pathological arrangement must cost a strange layout, never a
         frozen tab — 400 rows is far past any canvas a person builds. */
      while (guard++ < 400 && placed.some(function (p) { return _hits(box, p); })) {
        box.y += 1;
      }
      if (it.y !== box.y) { it.y = box.y; moved = true; }
      placed.push(box);
    });
    return moved;
  };

  Canvas.prototype.settle = function (it, tile) {
    if (!it || !tile) return;
    if (FREEFORM.indexOf(it.kind) >= 0) { this.placeBox(); return; }
    it.x = Math.max(0, Math.round(it.x || 0));
    it.y = Math.max(0, Math.round(it.y || 0));
    it.w = Math.max(1, Math.round(it.w || 1));
    it.h = Math.max(1, Math.round(it.h || 1));
    /* AN ANGLE THE MODEL WILL NOT KEEP MUST NOT BE LEFT ON SCREEN. The server
       stores `rot` only for freeform kinds, so a Popit showing a tilt is
       showing something that will vanish on the next read — worse than never
       having tilted. */
    it.rot = 0;
    tile.style.setProperty('--rot', '0deg');
    var vx = Math.round(this.toView(it.x));
    var vw = Math.max(1, Math.round(this.toView(it.w)));
    if (vx + vw > this.cols) vx = Math.max(0, this.cols - vw);
    tile.style.setProperty('--x', vx);
    tile.style.setProperty('--y', it.y);
    tile.style.setProperty('--w', vw);
    tile.style.setProperty('--h', it.h);
    tile.setAttribute('data-size', depthOf(it));
    /* THE TYPE AND THE LIST RE-FIT TO THE BOX THAT NOW EXISTS. Both passes
       measure the rendered tile, and until now they only ran on a full render
       or a window resize — so a Popit resized by hand kept a hero sized for
       its old width and a row list trimmed to its old height. */
    this.fitType();
    this.fitLists();
    /* NOTHING MAY BE LEFT UNDERNEATH. The moved tile anchors; whatever it
       landed on yields. A redraw is required because this changes OTHER tiles,
       and the selection is restored by `render`'s own keepId path. */
    if (this.relayout(it.id)) this.render();
    if (this.settleCanonical(it.id)) this.render();
    this.placeBox();
    this.refill(it);
  };

  /* ── A BIGGER TILE IS ENTITLED TO MORE, AND HAS TO ASK FOR IT ───────────
     ★ FOUNDER, 2026-09-13: *"resizing should automatically adjust sizing."*

     SIZE IS PROJECTION DEPTH — that is the rule this whole domain is built on
     — and the projection is answered at the size the placement HAD when the
     canvas was read. Drag a `small` up to a `full` and the tile grows, the
     type grows, and the content does not: it is still the one line the server
     was asked for. The tile gets roomier and says exactly as much.

     So a resize that crosses a density rung re-asks. Only then — a drag inside
     one rung changes no answer, and a request per pointer-up would be a
     request per twitch. One placement, not the canvas: the others did not
     change and re-reading them would cost a round trip to confirm it. */
  Canvas.prototype.refill = function (it) {
    if (!it || it.kind !== 'popit') { return; }
    var want = depthOf(it);
    if (want === it._depth) { return; }
    it._depth = want;
    var surface = OW._cvSurface || '';
    if (!surface) { return; }
    var self = this;
    req('/api/canvas/' + encodeURIComponent(surface) +
        '/popit/' + encodeURIComponent(it.ref) +
        '?w=' + (it.w || 3) + '&h=' + (it.h || 2))
      .then(function (r) {
        var d = (r && r.data) || {};
        /* A DEEPER READ THAT ANSWERS NOTHING MUST NOT ERASE WHAT IS DRAWN.
           `state` can come back `empty` or `unbound` for a kind the client
           draws itself, and overwriting a live tile with that would blank a
           Popit for resizing it. */
        if (d.state !== 'available' || !d.content) { return; }
        it.resolved = d.content;
        if (d.actions) { it.actions = d.actions; }
        self.render();
      })
      .catch(function () {});
  };

  Canvas.prototype.placeBox = function (grid) {
    if (!this._box || !this._sel) return;
    var t = this._sel.tile, it = this._sel.item;
    /* ── THE BOX IS MEASURED OFF THE TILE, NEVER RECOMPUTED ────────────────
       It first derived its own rect from the grid maths — cols, cell width,
       gap — and came out 5px wider than the thing it was framing, because the
       tile's own CSS accounts for the track slightly differently. Any second
       calculation of one rectangle is a second answer, and here the disagreement
       is visible: a selection box that does not sit on its object reads as
       broken however small the error.

       Reading `offsetLeft/Top/Width/Height` cannot drift, and it is correct
       mid-drag too: the tile's `--w`/`--h` are set before this is called, and
       reading an offset flushes layout. Measured 2026-08-26: 292 vs 297. */
    var b = this._box.style;
    if (!t.offsetWidth && !t.offsetHeight) return;   /* nothing to measure yet */
    b.left = t.offsetLeft + 'px';
    b.top = t.offsetTop + 'px';
    b.width = t.offsetWidth + 'px';
    b.height = t.offsetHeight + 'px';
    b.transform = 'rotate(' + (it.rot || 0) + 'deg)';
    /* ── THE SELECTION TAKES THE POPIT'S OWN CUT ─────────────────────────
       ★ FOUNDER, 2026-09-03: *"everything in it needs to look NATURAL."*

       The box was a uniform 6px rounded rectangle drawn around a tile whose
       corners are all different — 21px 24px 21px 18px on one, something else on
       the next, because each Popit wears one of the six hand-cut variants. A
       square-cornered frame around a hand-cut object is the tell that the frame
       was drawn by a different hand than the thing.

       So it reads the radius off the FACE it is framing rather than declaring
       one of its own. Nothing to keep in step: change a variant and the
       selection follows, because it is not a copy. */
    var _f = t.querySelector('.ow-cv-face');
    if (_f) {
      try { b.borderRadius = global.getComputedStyle(_f).borderRadius; }
      catch (e) {}
    }

    /* ★ THE SETTINGS PANEL IS CLAMPED TO THE CANVAS, NOT TO THE VIEWPORT.
       It is a child of the transform box, so `left:0` means "the left edge of
       the selected tile" — and its `max-width:86vw` knows nothing about where
       that tile is. Selecting a right-hand Popit on a 280px screen put the
       panel from 122px to 363px and cut off "Both", "Seconds" and half the city
       list. Measured on screen; no geometry check would see it, because
       nothing was overflowing its own box.

       So it is offset back by however much it would overrun the grid. A
       negative left is correct here — the panel belongs to the tile but must
       live inside the canvas, and those are different frames. */
    var panel = this._box.querySelector('.ow-cv-zones');
    if (panel && this.grid) {
      panel.style.left = '0px';
      panel.style.maxWidth = this.grid.clientWidth + 'px';
      var pr = panel.getBoundingClientRect();
      var gr = this.grid.getBoundingClientRect();
      var over = pr.right - gr.right;
      if (over > 0) panel.style.left = (-Math.min(over, t.offsetLeft)) + 'px';
      /* ── AND IT MAY NOT COVER ANOTHER POPIT ────────────────────────────
         ★ FOUNDER, 2026-08-28: *"things are overlapping"* — and, on the tiles
         themselves, *"Nothing can occupy the same space as another Popit.
         Ever."*  A settings panel that hides two Popits to configure a third
         breaks the same rule from the other side.

         `.ow-cv-zones` sat at `top:calc(100% + 10px)` — ten pixels under the
         SELECTED TILE, which on a Home is directly on top of whatever is
         arranged below it. Measured 2026-09-02: choosing a colour for Colours
         covered Said and Boardwalk completely.

         So it hangs below the GRID instead: the same panel, at a spot where
         there is nothing to cover, and in one predictable place rather than
         wherever the selection happens to be. The two frames differ, which is
         why this is done here where both rects are already in hand. */
      var below = (gr.bottom - pr.top) + 10;
      panel.style.top = (parseFloat(getComputedStyle(panel).top || 0) + below) + 'px';
    }
  };

  Canvas.prototype.beginResize = function (grid, e, dir) {
    var self = this, it = this._sel.item, tile = this._sel.tile;
    var g = this.geom(grid);
    var sx = e.clientX, sy = e.clientY;
    /* THE GESTURE HAPPENS IN VIEW SPACE, THE STORE STAYS CANONICAL. The hand is
       working on the columns actually on screen — four on a phone — while `it`
       always holds the twelve-column truth. Converting at the two ends keeps
       every line of the snapping and clamping maths below unchanged, and on
       desktop the two spaces are identical so nothing moves at all. */
    var ox = Math.round(self.toView(it.x)), oy = it.y;
    var ow = Math.max(1, Math.round(self.toView(it.w || 1))), oh = it.h || 1;
    var free = FREEFORM.indexOf(it.kind) >= 0;
    var lines = this.snapLines(it.id);
    /* CAPTURE IS AN OPTIMISATION, NOT A PRECONDITION. It throws whenever the
       pointer id is not actively down — a released pointer, a synthetic event,
       a cancelled touch — and an uncaught throw here aborted the whole gesture
       before a single listener was attached, so the handle simply did nothing.
       The drag works without capture; it is only smoother with it. */
    try { this._box.setPointerCapture(e.pointerId); } catch (_) {}

    function move(ev) {
      var dx = (ev.clientX - sx) / (g.cw + GAP);
      var dy = (ev.clientY - sy) / (g.rowh + GAP);
      var x = ox, y = oy, w = ow, h = oh;
      if (dir.indexOf('e') >= 0) w = ow + dx;
      if (dir.indexOf('s') >= 0) h = oh + dy;
      if (dir.indexOf('w') >= 0) { x = ox + dx; w = ow - dx; }
      if (dir.indexOf('n') >= 0) { y = oy + dy; h = oh - dy; }

      /* SNAP THE EDGE BEING DRAGGED, not the whole tile — a resize that jumps
         the far edge is the control fighting the hand. */
      var vhit = [], hhit = [];
      if (dir.indexOf('e') >= 0) {
        var se = nearest(x + w, lines.vs, g.cw + GAP);
        if (se != null) { w = se - x; vhit.push(se); }
      }
      if (dir.indexOf('w') >= 0) {
        var sw = nearest(x, lines.vs, g.cw + GAP);
        if (sw != null) { w = w + (x - sw); x = sw; vhit.push(sw); }
      }
      if (dir.indexOf('s') >= 0) {
        var ss = nearest(y + h, lines.hs, g.rowh + GAP);
        if (ss != null) { h = ss - y; hhit.push(ss); }
      }
      if (dir.indexOf('n') >= 0) {
        var sn = nearest(y, lines.hs, g.rowh + GAP);
        if (sn != null) { h = h + (y - sn); y = sn; hhit.push(sn); }
      }
      if (!free) {
        x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        /* ── AND ONTO THE FAMILY, WHILE THE HAND IS STILL ON IT ──────────
           Snapped in BASE columns, not projected ones: the footprints are
           spans of the canonical twelve, and snapping a projected width would
           make the same drag land on a different shape depending on the
           window. Converted back for the live preview so what is drawn is
           what will be stored. */
        var fp = snapFootprint(self.toBase(w), h);
        w = Math.max(1, Math.round(self.toView(fp[0])));
        h = fp[1];
        /* ── THE DENSITY FOLLOWS THE HAND ────────────────────────────────
           ★ FOUNDER, 2026-09-13: *"resizing should automatically adjust
             sizing."*
           `data-size` is what every density rule keys on, and it was written
           once at build time and never again — so a tile dragged from `small`
           to `full` kept the type, the inset and the line clamps of a small
           one until something else forced a redraw. The shape changed and the
           content did not follow it. */
        tile.setAttribute('data-size', depthOf({ w: self.toBase(w), h: h }));
      }
      /* A POPIT HAS A FLOOR. Below one cell it is not a small Popit, it is an
         invisible one — and the person cannot grab it again to undo that. */
      w = Math.max(free ? 1 : 1, Math.min(self.cols, w));
      h = Math.max(1, h);
      x = Math.max(0, Math.min(self.cols - w, x));
      y = Math.max(0, y);

      /* BACK TO TWELVE ON THE WAY IN. Rounding once, here at the edit, rather
         than on every render — a value that is re-quantised each paint drifts
         a little further from what the person actually did every time. */
      it.x = Math.round(self.toBase(x)); it.y = y;
      it.w = Math.max(1, Math.round(self.toBase(w))); it.h = h;
      tile.style.setProperty('--x', x); tile.style.setProperty('--y', y);
      tile.style.setProperty('--w', w); tile.style.setProperty('--h', h);
      self.dirty = true;
      self.placeBox(grid);
      self.guides(grid, vhit, hhit);
    }
    function up() {
      try { self._box.releasePointerCapture(e.pointerId); } catch (_) {}
      grid.removeEventListener('pointermove', move);
      grid.removeEventListener('pointerup', up);
      grid.removeEventListener('pointercancel', up);
      self.clearGuides();
      self.settle(it, tile);      /* the box follows the SET position */
      self.save();
    }
    grid.addEventListener('pointermove', move);
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', up);
  };

  /* THE DIRECTIONAL AXIS, for every Popit rather than only for stickers. */
  Canvas.prototype.beginTurn = function (grid, e) {
    var self = this, it = this._sel.item, tile = this._sel.tile;
    var box = tile.getBoundingClientRect();
    var cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    var start = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    var was = it.rot || 0;
    /* CAPTURE IS AN OPTIMISATION, NOT A PRECONDITION. It throws whenever the
       pointer id is not actively down — a released pointer, a synthetic event,
       a cancelled touch — and an uncaught throw here aborted the whole gesture
       before a single listener was attached, so the handle simply did nothing.
       The drag works without capture; it is only smoother with it. */
    try { this._box.setPointerCapture(e.pointerId); } catch (_) {}
    function move(ev) {
      var now = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      var deg = was + (now - start);
      /* SHIFT SNAPS TO TWELVE O'CLOCK STEPS, and so does anything within three
         degrees of square — free by default, because the axis is theirs. */
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      else if (Math.abs(deg % 90) < 3 || Math.abs(deg % 90) > 87) deg = Math.round(deg / 90) * 90;
      deg = Math.round(deg * 10) / 10;
      it.rot = deg;
      tile.style.setProperty('--rot', deg + 'deg');
      self.dirty = true;
      self.placeBox(grid);
    }
    function up() {
      try { self._box.releasePointerCapture(e.pointerId); } catch (_) {}
      grid.removeEventListener('pointermove', move);
      grid.removeEventListener('pointerup', up);
      grid.removeEventListener('pointercancel', up);
      self.settle(it, tile);      /* the box follows the SET position */
      self.save();
    }
    grid.addEventListener('pointermove', move);
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', up);
  };

  /* ARRANGEMENT IS A MODE YOU ENTER, AND LEAVING IT IS ALWAYS ONE GESTURE.
     `editing` gates every arrangement gesture and every open, so the two can
     never both fire. It is per-canvas rather than global: somebody arranging
     their Home has not put a Center's canvas into edit mode. */
  /* MAY THIS TAP OPEN THE THING IT LANDED ON?
     Two reasons it may not, and both were previously answered per-handler —
     which is how the collection tile came to have neither. A tap is inert if
     the tile was just DRAGGED (the click that follows a drag is not a tap) or
     if the canvas is in ARRANGEMENT (where a tap means select).
     One function, so a sixth tile kind cannot forget half of it. */
  function inert(n) {
    if (!n || !n.hasAttribute) return false;
    if (n.hasAttribute('data-dragging')) return true;
    return !!(n.closest && n.closest('[data-editing="1"]'));
  }

  /* ═══ LEAVING WITHOUT KEEPING ═════════════════════════════════════════════
     ★ FOUNDER, 2026-08-30: *"arrange → modify → cancel must restore the
       committed state."*

     THE CANVAS SAVES AS YOU GO, which is right — a home screen does not ask you
     to confirm every nudge, and an arrangement you have to remember to save is
     one you will lose. But "no confirm step" is not the same as "no way back",
     and until now there was none: a person who dragged four Popits while
     exploring had no way to say *put it back how it was*.

     SO THE COMMITTED STATE IS PHOTOGRAPHED ON THE WAY IN. Entering arrangement
     snapshots the geometry of every placement; Cancel restores that snapshot
     and saves it, which makes the revert as durable as the change was. It is a
     copy of GEOMETRY AND CONFIG only — never the resolved content, which is
     joined at read time and would go stale in a snapshot. */
  /* WHO MAY BE OFFERED THE COPY. A person with no surface of their own has
     nowhere to paste, and an anonymous reader has no identity to paste as. */
  Canvas.prototype.canAdopt = function () {
    if (this.shell === 'os') return false;
    try { return !!(OW.data && OW.data.me && OW.data.me()); } catch (e) { return false; }
  };

  /* WHAT WILL TRANSFER, SHOWN BEFORE IT HAPPENS.
     ★ FOUNDER, 2026-09-03: the flow is *"see what will transfer"* then
       *"confirm"* — so this counts the arrangement in the person's own terms
       rather than announcing a result afterwards. The count comes from the
       SAME declaration the server copies by, so the preview cannot promise
       something the adopt then declines to bring. */
  /* ── THE DESTINATIONS A PERSON MAY PASTE ONTO ───────────────────────────
     ★ FOUNDER, 2026-08-27: *"let users copy each others layouts and paste them
       to their home and profile."*

     It only ever pasted to Home. `home:` was hardcoded in six places in the
     sheet below — the count line, the replace warning, both button labels, the
     POST, and the failure message — so "and profile" was not half-built, it
     was absent, and the sheet said "Copy to my Home" as though that were the
     whole offer.

     The two are genuinely different acts now that the profile renders its own
     canvas: Home is the private console, Profile is the face other people see.
     Pasting onto one is arranging; pasting onto the other is PUBLISHING. */
  Canvas.prototype.destinations = function (mine) {
    return [
      { key: 'home', surface: 'home:' + mine, label: 'Copy to my Home',
        noun: 'Home', lands: '#home' },
      { key: 'profile', surface: 'profile:' + mine, label: 'Copy to my Profile',
        noun: 'Profile', lands: '#center' }
    ];
  };

  /* the POST, the landing and the failure wording, once — the sheet and the
     publish offer both go through here so they cannot drift apart */
  Canvas.prototype.adoptInto = function (dest, source, onFail) {
    return req('/api/canvas/' + encodeURIComponent(dest.surface) + '/adopt',
               { method: 'POST', body: { source: source },
                 invalidate: '/api/canvas/' })
      .then(function (r) {
        var got = (r && r.data && r.data.adopted) || 0;
        /* LAND ON THEIR OWN SURFACE — the founder's step 8. A copy that leaves
           you looking at somebody else's profile has not finished. */
        if (got) {
          try { doc.dispatchEvent(new CustomEvent('ow:layout-adopted',
            { detail: { adopted: got, source: source, target: dest.surface } })); } catch (e) {}
          /* only when there is somewhere to go. The publish offer adopts into
             the surface the person is ALREADY looking at and re-loads it in
             place; `location.hash = ''` would have navigated them off their
             own profile at the moment it filled up. */
          if (dest.lands) { try { global.location.hash = dest.lands; } catch (e2) {} }
        }
        return got;
      })
      .catch(function () { if (onFail) onFail(); return 0; });
  };

  /* ── ONE COPY SURFACE, WHATEVER IS BEING COPIED WHERE ───────────────────
     ★ STANDING RULE: *"NO POPUPS, NO MODALS ... never a centred modal with a
       backdrop"* and *"FULL-SCREEN, NEVER A BOX."*

     This began as a 380px card centred on a blurred scrim, painted in literals
     — rgba(12,13,26,.96) on rgba(6,7,16,.72) — so on the light theme it opened
     as a dark slab over a pale app. Both faults are gone: it is full-screen,
     and it wears `.ow-cv-pick`, the Add sheet's own fully tokenised chrome.
     *"SEAMLESS FIT. Do not invent per-panel chrome."* `.ow-cv-pick__row` is
     already "a thing you tap, with a name and a line explaining it", which is
     exactly what a destination is — so there is no new component here and no
     second set of colours to keep in step.

     PARAMETERISED because there are two ways in and they are the same act:
     copying somebody else's arrangement (two destinations, source is their
     surface) and publishing your own Home onto your profile (one destination,
     source decided). Writing it twice would have produced two previews that
     could disagree about what a copy carries.

     Still role="dialog" aria-modal — full-screen is a statement about the
     PIXELS, not about semantics, and focus still belongs inside it. */
  Canvas.prototype.copySurface = function (o) {
    var self = this;
    var sheet = doc.createElement('div');
    sheet.className = 'ow-cv-pick' + (this.shell === 'os' ? ' ow-cv--os' : '');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', o.title);

    var bar = doc.createElement('div');
    bar.className = 'ow-cv-pick__bar';
    var barName = doc.createElement('span');
    barName.textContent = o.title;
    var x = doc.createElement('button');
    x.type = 'button'; x.className = 'ow-cv-pick__x'; x.textContent = 'Close';
    bar.appendChild(barName); bar.appendChild(x);

    var list = doc.createElement('div');
    list.className = 'ow-cv-pick__list';
    var lead = doc.createElement('p');
    lead.className = 'ow-cv-copy__p';
    lead.textContent = o.lead;
    var n = doc.createElement('p');
    n.className = 'ow-cv-copy__n';
    /* NO DESTINATION NAMED IN THIS LINE. It used to say "to your Home" while
       the rows below offered two, and a sentence that contradicts the control
       under it is worse than no sentence. */
    n.textContent = o.carried + (o.carried === 1 ? ' Popit' : ' Popits')
                  + ' will come across, empty and ready for yours.';
    list.appendChild(lead); list.appendChild(n);

    function close() {
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
      doc.removeEventListener('keydown', esc_);
    }
    function esc_(e) { if (e.key === 'Escape') close(); }
    x.addEventListener('click', close);
    doc.addEventListener('keydown', esc_);

    /* ── EACH DESTINATION SAYS WHAT IT COSTS, BEFORE IT IS CHOSEN ──────────
       Adopting REPLACES the target arrangement — `set_layout` is desired
       state, which is what makes it idempotent and replayable. Measured
       2026-09-03: a person with `said` and `count` on their Home adopted a
       layout and had `clock` and `posts` instead.

       ★ FOUNDER, founder/312: *"Otherwise we're not refactoring — we're
         silently deleting user state."*

       The price is PER DESTINATION, because "this replaces 4 Popits" is true
       of one and false of the other, and it sits on the row it prices. Never
       a colour of alarm: replacing your own arrangement is a normal thing to
       choose rather than a mistake. */
    var dests = o.dests;
    dests.forEach(function (d) {
      var row = doc.createElement('button');
      row.type = 'button';
      row.className = 'ow-cv-pick__row';
      var name = doc.createElement('span');
      name.className = 'ow-cv-pick__name';
      name.textContent = d.label;
      var blurb = doc.createElement('span');
      blurb.className = 'ow-cv-pick__blurb';
      blurb.textContent = 'Reading what is there now…';
      row.appendChild(name); row.appendChild(blurb);
      d.btn = row;

      try {
        req('/api/canvas/' + encodeURIComponent(d.surface)).then(function (r) {
          var have = ((r && r.data && r.data.placements) || []).length;
          blurb.textContent = have
            ? ('Replaces the ' + have + (have === 1 ? ' Popit' : ' Popits')
               + ' on your ' + d.noun + ' now. You can arrange it again afterwards.')
            : ('Nothing on your ' + d.noun + ' yet.');
        }).catch(function () {
          /* A ROW THAT CANNOT SAY WHAT IT REPLACES STILL SAYS SOMETHING.
             Leaving "Reading what is there now" up forever is a surface
             pretending it is still working. */
          blurb.textContent = 'Could not read what is on your ' + d.noun
                            + ' right now.';
        });
      } catch (e0) { blurb.textContent = ''; }

      row.addEventListener('click', function () {
        dests.forEach(function (q) { q.btn.disabled = true; });
        name.textContent = 'Copying…';
        self.adoptInto(d, o.source, function () {
          dests.forEach(function (q) { q.btn.disabled = false; });
          name.textContent = d.label;
          n.textContent = 'That did not copy. Nothing on your ' + d.noun
                        + ' changed.';
        }).then(function (got) {
          if (!got) return;
          close();
          if (o.after) o.after();
        });
      });
      list.appendChild(row);
    });

    sheet.appendChild(bar);
    sheet.appendChild(list);
    doc.body.appendChild(sheet);
    try { dests[0].btn.focus(); } catch (e4) {}
  };

  /* IS THIS MY OWN PUBLIC FACE? Asked in two places — the empty state's offer
     and the permanent control beside Add — so it is one predicate rather than
     two regexes that can drift. */
  Canvas.prototype.isMyProfile = function () {
    var m = /^profile:(.+)$/.exec(this.surface || '');
    var me = this.meEmail();
    return !!(m && me && m[1].toLowerCase() === me.toLowerCase());
  };

  /* ── WHO IS LOOKING, ASKED ONCE ────────────────────────────────────────── */
  Canvas.prototype.meEmail = function () {
    try { return (OW.data && OW.data.me && OW.data.me()) || ''; } catch (e) { return ''; }
  };

  /* ── YOUR PUBLIC FACE DOES NOT FOLLOW YOUR HOME, SO IT NEEDS A DOOR ──────
     The empty-state offer only appears while a profile has NEVER been
     arranged — correctly, because a profile somebody emptied on purpose must
     not be nagged. But that left the door open exactly once: publish, and from
     then on there was no way to bring a changed Home across again. A private
     Home that has moved on and a public face frozen at the day you first
     published is worse than either, and it was a dead end I introduced in the
     same commit that made the two surfaces different.

     So the act gets a permanent, named control on your own profile, beside
     Add. It goes through the SAME full-screen surface as Copy Layout — same
     preview, same per-destination price, same adopt — because it is the same
     act with the source and destination already decided. */
  Canvas.prototype.offerRepublish = function () {
    var mine = this.meEmail();
    if (!mine) return;
    var from = 'home:' + mine;
    var self = this;
    req('/api/canvas/' + encodeURIComponent(from)).then(function (r) {
      var rows = (r && r.data && r.data.placements) || [];
      var carried = rows.filter(function (it) {
        return ['collection', 'sticker', 'event', 'center', 'app'].indexOf(it.kind) < 0;
      }).length;
      if (!carried) return;
      self.copySurface({
        title: 'Use my Home layout',
        lead: 'This puts the arrangement from your Home onto your public '
            + 'profile. Your Count, your Said and your collections stay private.',
        source: from,
        carried: carried,
        dests: [{ key: 'profile', surface: self.surface, label: 'Put it on my Profile',
                  noun: 'Profile', lands: '' }],
        after: function () { self.load(); }
      });
    }).catch(function () {
      /* ── A NAMED CONTROL MUST NEVER PRESS INTO SILENCE ──────────────────
         This was `.catch(function () {})`. "Use my Home layout" is a button
         with a name on it; when the Home read failed it did NOTHING — no
         sheet, no message, no change — which reads as a broken product rather
         than as a request that did not arrive. I wrote that empty catch in the
         same commit that added the control.

         It cannot open the sheet, because the sheet's whole job is to show
         what will transfer and it has nothing true to show. So it says so
         where the press happened. */
      try {
        var w = doc.createElement('div');
        w.className = 'ow-cv-empty ow-cv-fault';
        w.textContent = 'Could not read your Home just now. Nothing has been changed.';
        if (self.host) self.host.appendChild(w);
        global.setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 6000);
      } catch (e2) {}
    });
  };

  Canvas.prototype.offerCopy = function () {
    var mine = this.meEmail();
    if (!mine) return;

    /* PERSONAL PLACEMENTS ARE NOT COUNTED, because they will not arrive. The
       server's `PERSONAL_PLACEMENTS` is the authority; this mirrors only the
       shape of the question so the number a person sees is the number they
       get. */
    var carried = this.items.filter(function (it) {
      return ['collection', 'sticker', 'event', 'center', 'app']
        .indexOf(it.kind) < 0;
    }).length;
    if (!carried) return;

    this.copySurface({
      title: 'Copy this layout',
      lead: 'This copies the arrangement and style while leaving the '
          + 'person\u2019s content behind.',
      source: this.surface,
      carried: carried,
      dests: this.destinations(mine)
    });
  };


  /* ── A SNAPSHOT HAS TO BE ABLE TO REBUILD WHAT IT SAW ───────────────────
     This kept id, geometry and config — enough to move a tile back, and not
     enough to bring one BACK. `kind` and `ref` are what say which Popit a row
     even is, so a placement deleted during an arrange session could not be
     reconstructed from the snapshot at any price, and revert() quietly did not
     try. See revert() for what that cost.

     Everything on the row is carried now, with config deep-copied because it
     is the only nested part a session can mutate in place. The projection
     fields (bound, resolved, state) ride along by reference, which is right:
     they are a view of canonical data that has not changed just because
     somebody dragged something. */
  Canvas.prototype.snapshot = function () {
    return (this.items || []).map(function (it) {
      var copy = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k];
      copy.config = JSON.parse(JSON.stringify(it.config || {}));
      return copy;
    });
  };

  Canvas.prototype.revert = function () {
    var snap = this._snap;
    if (!snap) return false;
    var by = {};
    snap.forEach(function (r) { by[r.id] = r; });
    var changed = false;
    this.items.forEach(function (it) {
      var was = by[it.id];
      if (!was) return;
      /* ── ROTATION AND DEPTH ARE CHANGES TOO ─────────────────────────
         The line below restores z and rot faithfully. The COMPARISON did not
         mention them, so a session in which somebody only turned a sticker —
         which is the whole gesture stickers exist for — reported `changed`
         false, and Cancel skipped the write that would have undone it. The
         angle went back on screen and stayed turned on the server: the one
         outcome Cancel exists to make impossible.
         ★ FOUNDER, 2026-08-30: *"arrange -> modify -> cancel must restore the
           committed state."* */
      if (it.x !== was.x || it.y !== was.y || it.w !== was.w || it.h !== was.h
          || (it.z || 0) !== (was.z || 0)
          || (it.rot || 0) !== (was.rot || 0)
          || JSON.stringify(it.config || {}) !== JSON.stringify(was.config)) {
        changed = true;
      }
      it.x = was.x; it.y = was.y; it.w = was.w; it.h = was.h;
      it.z = was.z; it.rot = was.rot;
      it.config = JSON.parse(JSON.stringify(was.config));
    });
    /* ── AND A PLACEMENT REMOVED DURING THE SESSION IS A CHANGE TOO ───────
       ★ FOUNDER, 2026-08-30: *"arrange -> modify -> cancel must restore the
         committed state."*

       This filtered out placements ADDED during the session — correct, and it
       was the only direction handled. A placement REMOVED during the session
       was never put back. `remove()` writes immediately, so by the time Cancel
       is pressed the deletion is already on the server; Cancel then reported
       "nothing to undo" and the Popit was gone for good.

       Arrange, delete a Popit, change your mind, press Cancel — and the
       control named Cancel confirms the deletion. That is the worst shape a
       bug can take: the safe-looking action is the destructive one.

       The committed state is the snapshot, so revert now REBUILDS from it
       rather than editing the live list. A row still present keeps its live
       object (so nothing else holding a reference goes stale); a row that was
       removed comes back from the snapshot, which is why snapshot() had to
       start carrying kind and ref. */
    var live = {};
    this.items.forEach(function (it) { live[it.id] = it; });
    var before = this.items.length;
    var restored = 0;
    this.items = snap.map(function (r) {
      if (live[r.id]) return live[r.id];
      restored++;
      var back = {};
      for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) back[k] = r[k];
      return back;
    });
    if (this.items.length !== before || restored) changed = true;
    if (changed) { this.dirty = true; this.render(); this.save(); }
    return changed;
  };

  Canvas.prototype.setEditing = function (on) {
    on = !!on && !!this.mayArrange;
    if (this.editing === on) return;
    if (on) this._snap = this.snapshot();
    this.editing = on;
    if (this.grid) this.grid.setAttribute('data-editing', on ? '1' : '');
    if (!on) this.deselect();
    /* THE CONTROLS FOLLOW THE MODE IMMEDIATELY, NOT AT THE NEXT RENDER.
       `Cancel` is built in `render()`, so entering arrangement left it absent
       until something else caused a redraw — measured: enter Arrange and there
       is no way back until you have already moved something, which is exactly
       when you most want one. The label and the button are updated here, where
       the mode actually changes, rather than being a side effect of drawing. */
    if (this.host) {
      var self2 = this;
      var b = this.host.querySelector('.ow-cv-done');
      if (b) b.textContent = on ? 'Done' : 'Arrange';
      var c = this.host.querySelector('.ow-cv-cancel');
      if (on && !c && b) {
        c = doc.createElement('button');
        c.type = 'button';
        c.className = 'ow-cv-add ow-cv-cancel';
        c.textContent = 'Cancel';
        c.addEventListener('click', function (ev) {
          ev.stopPropagation();
          self2.revert();
          self2.setEditing(false);
        });
        b.parentNode.insertBefore(c, b.nextSibling);
      } else if (!on && c) {
        c.parentNode.removeChild(c);
      }
    }
    /* retired tiles are drawn only while arranging (424) — the mode change
       is what shows or hides them, so it redraws */
    try { if (this.items.some(function (it) { return it && it.config && it.config.retired; })) this.render(); } catch (_) {}
    try {
      global.dispatchEvent(new CustomEvent('ow:canvas-editing',
        { detail: { surface: this.surface, editing: on } }));
    } catch (_) {}
  };

  Canvas.prototype.arm = function (grid) {
    var self = this;
    /* LETTING GO IS AS IMPORTANT AS GRABBING. A transform box with no way out
       is a mode, and a mode a person cannot leave is the thing that makes
       direct manipulation feel like a tool rather than a surface. */
    grid.addEventListener('pointerdown', function (e) {
      if (!e.target.closest || (!e.target.closest('.ow-cv-t') && !e.target.closest('.ow-cv-box')
                                && !e.target.closest('.ow-cv-done'))) {
        /* THE GROUND IS THE WAY OUT. Tapping the galaxy leaves arrangement
           entirely rather than merely dropping the selection — otherwise the
           person is still in a mode with nothing selected to show it. */
        if (self.editing) self.setEditing(false); else self.deselect();
      }
    }, true);
    /* ── ONE ESCAPE LISTENER FOR EVERY CANVAS, NOT ONE PER CANVAS FOREVER ──
       This added an ANONYMOUS keydown handler to the document for every Canvas
       ever constructed, and an anonymous listener cannot be removed. Each one
       closes over `self`, so every canvas a person ever opened stayed alive
       through that closure — navigate Home -> a profile -> a Center and three
       instances are retained, three handlers run on every Escape, and a
       detached canvas can still be told to leave arrangement.

       Nothing about it was visible: Escape kept working, because the LIVE
       canvas is among the ones being called.

       So the listener is installed once for the module and walks the canvases
       that are still attached, dropping the rest as it goes. Same behaviour,
       one handler, and a canvas that leaves the document stops being reachable
       from it. */
    OW._cvEsc = OW._cvEsc || (function () {
      var live = [];
      try {
        doc.addEventListener('keydown', function (e) {
          if (e.key !== 'Escape') return;
          for (var i = live.length - 1; i >= 0; i--) {
            var c = live[i];
            /* a canvas whose host has left the document is no longer anyone's
               business, and holding it is the leak this replaced */
            if (!c.host || !c.host.isConnected) { live.splice(i, 1); continue; }
            if (c._sel || c.editing) { e.stopPropagation(); c.setEditing(false); }
          }
        });
      } catch (_) {}
      return { add: function (c) { if (live.indexOf(c) < 0) live.push(c); },
               count: function () { return live.length; } };
    })();
    OW._cvEsc.add(self);
    /* ═══ TAP OPENS · HOLD ARRANGES ═══════════════════════════════════════
       ★ FOUNDER, 2026-08-30: *"must fix collision issues with clicking to edit
         and open… need a flawless widget system."*

       ONE TAP WAS DOING BOTH, and that is not a subtle bug — measured on the
       live canvas, a single tap on a Highlight raised the transform box AND
       opened the Story viewer in the same gesture. The canvas was permanently
       in arrange mode whenever the surface was yours, so "select this to edit
       it" and "open this" were the same event.

       THE ANSWER IS THE ONE EVERY WIDGET SYSTEM ALREADY USES, and the founder's
       own familiarity rule says to use it rather than invent: a home screen is
       NOT in edit mode until you ask for it. Tap opens. Press and hold enters
       arrangement, and while arranging, tap selects and never opens. Leaving is
       always available — Escape, a tap on the ground, or Done.

       IT ALSO FIXES A QUIETER FAULT: a person browsing their own Home could
       nudge a Popit out of place with an ordinary scroll-start, and the save
       was silent. Arrangement is now something you enter on purpose. */
    /* ── THE GESTURE THAT ENTERS ARRANGEMENT MUST NOT ALSO FIRE A CONTROL ──
       ★ FOUNDER, 2026-09-04, on long-press interference: a hold must not open
         a Post, like one, scroll, select text, or activate a button.

       inert() already says whether a tap may open what it landed on, and every
       handler the canvas owns asks it. But a Latest tile embeds REAL Posts —
       button.po-card and span.po-card__who — whose click handlers live in the
       shared Post code and have never heard of this canvas. So a hold on a Post
       inside a widget did both things at once.

       MEASURED, before this listener existed:
         short press (the control)  → viewer opens, ow:open-post × 1   ✓ correct
         long press                 → data-editing="1" AND ow:open-post × 1 ✗

       The fix belongs here, not in the Post. The canvas owns the gesture, so
       the canvas owns its consequences; teaching po-card about arrangement
       would put canvas rules inside a component that renders in three other
       places that have no arrangement. One capture-phase listener on the grid
       runs before any descendant's bubbling handler and answers for ALL of
       them — including the nested control somebody adds next year, which is
       the same reason inert() was made one function instead of five. */
    grid.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.ow-cv-t') : null;
      if (!t || !inert(t)) return;
      e.preventDefault();
      e.stopPropagation();
      /* stopPropagation alone leaves other listeners ON THIS SAME NODE to run;
         a Post card that registered its handler on the grid would still fire */
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }, true);

    var HOLD_MS = 420;

    grid.addEventListener('pointerdown', function (e) {
      var t = e.target.closest ? e.target.closest('.ow-cv-t') : null;
      if (!t || !self.mayArrange || self.editing) return;
      /* not editing yet — a HOLD is the way in, and it must not fight a scroll,
         so any real movement cancels it */
      var hx = e.clientX, hy = e.clientY;
      var timer = global.setTimeout(function () {
        self.setEditing(true);
        var id2 = t.getAttribute('data-id');
        var it2 = self.items.filter(function (x) { return x.id === id2; })[0];
        if (it2) self.select(grid, t, it2);
        /* the gesture that opened edit mode must not also open the Popit */
        t.setAttribute('data-dragging', '');
        global.setTimeout(function () { t.removeAttribute('data-dragging'); }, 0);
        try { if (global.navigator && navigator.vibrate) navigator.vibrate(8); } catch (_) {}
      }, HOLD_MS);
      function cancel(ev) {
        if (ev && ev.type === 'pointermove'
            && Math.abs(ev.clientX - hx) < 6 && Math.abs(ev.clientY - hy) < 6) return;
        global.clearTimeout(timer);
        grid.removeEventListener('pointermove', cancel);
        grid.removeEventListener('pointerup', cancel);
        grid.removeEventListener('pointercancel', cancel);
      }
      grid.addEventListener('pointermove', cancel);
      grid.addEventListener('pointerup', cancel);
      grid.addEventListener('pointercancel', cancel);
    });

    grid.addEventListener('pointerdown', function (e) {
      var t = e.target.closest ? e.target.closest('.ow-cv-t') : null;
      if (!t || !self.mayArrange || !self.editing) return;
      var id = t.getAttribute('data-id');
      var it = self.items.filter(function (x) { return x.id === id; })[0];
      if (!it) return;

      var rect = grid.getBoundingClientRect();
      var cw = (rect.width - GAP * (self.cols - 1)) / self.cols;
      /* the same live reading the resize path takes — a drag and a resize that
         disagree about how tall a row is are two different grids */
      var rowh = self.rowPx();
      var sx = e.clientX, sy = e.clientY;
      var ox = Math.round(self.toView(it.x)), oy = it.y;
      var moved = false;
      /* SAME GUARD AS THE TRANSFORM BOX. An unguarded capture throws whenever
         the pointer id is not actively down and takes the whole gesture with
         it — the tile then neither moved nor selected, silently. */
      try { t.setPointerCapture(e.pointerId); } catch (_) {}

      /* ── A STICKER ANSWERS TO THE HAND, A POPIT TO THE GRID ─────────────
         ★ FOUNDER, 2026-08-25: *"let them drag them literally anywhere on this
           open canvas."*

         Same drag, same coordinate space, same saved shape — the ONLY
         difference is that a sticker is not rounded to a cell and is not
         pulled back from the edge. Snapping is what makes a COMPOSED surface
         line up for people who did not arrange it; a sticker is decoration,
         and rounding somebody's placement to the nearest column is the
         platform overruling a gesture. The server agrees (FREEFORM_KINDS), so
         there is one rule and not a client that quietly disagrees. */
      var free = FREEFORM.indexOf(it.kind) >= 0;

      /* ═══ THE GESTURE IS CONTINUOUS; ONLY THE RESULT IS DISCRETE ═════════
         ★ FOUNDER, 2026-08-30: *"editing and dragging still feels like I'm
           wrestling control away from a grid"* · *"the object should actually
           follow their hand"* · *"make Arrange behave like iOS app
           rearrangement."*

         WHAT WAS WRONG, IN ONE LINE: `--x` and `--y` were rewritten to ROUNDED
         CELL VALUES on every pointermove. The tile teleported from cell to
         cell under a finger that was moving smoothly, and the neighbour-snap
         then nudged it somewhere else again. That is the whole "fighting the
         grid" feeling, and no amount of geometry correctness removes it.

         THREE SEPARATE THINGS, KEPT SEPARATE, exactly as the founder set out:
           1. THE HAND is continuous — a pixel translate, nothing rounded.
           2. THE DESTINATION is discrete — the cell under the pointer, and it
              is recomputed only when it actually CHANGES, so neighbours are not
              re-solved sixty times a second.
           3. COLLISION is resolved by `displace()` — the least movement that
              clears the space, everything untouched left exactly where it is.

         THE GHOST IS THE PROMISE. What it shows is what release commits: the
         same layout, already applied to the neighbours, so nothing jumps at the
         moment of release. */
      var vw = Math.max(1, Math.round(self.toView(it.w || 1)));
      var vh = Math.max(1, it.h || 1);
      var basePack = {}, kk;
      for (kk in (self._pack || {})) if (self._pack.hasOwnProperty(kk)) {
        basePack[kk] = { x: self._pack[kk].x, y: self._pack[kk].y,
                         w: self._pack[kk].w, h: self._pack[kk].h };
      }
      var lastTX = null, lastTY = null, liveLayout = null, ghost = null;

      function paintOthers(layout) {
        Object.keys(layout).forEach(function (id2) {
          if (id2 === it.id) return;
          var node = grid.querySelector('[data-id="' + id2 + '"]');
          if (!node) return;
          node.style.setProperty('--x', layout[id2].x);
          node.style.setProperty('--y', layout[id2].y);
        });
      }

      function move(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        /* MOVEMENT TOLERANCE BEFORE IT IS A DRAG — and it is generous on
           touch, because a finger that intends to scroll always travels a few
           pixels sideways first. Stealing that is what makes a page feel like
           it is grabbing at you. */
        if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        if (!moved) {
          moved = true;
          t.setAttribute('data-dragging', '');
          if (!free) {
            ghost = doc.createElement('div');
            ghost.className = 'ow-cv-ghost';
            ghost.style.setProperty('--w', vw);
            ghost.style.setProperty('--h', vh);
            grid.appendChild(ghost);
          }
        }

        if (free) {
          /* a sticker keeps its own model — continuous, unrounded, unsnapped */
          var fx = ox + dx / (cw + GAP), fy = oy + dy / (rowh + GAP);
          it.x = Math.max(0, Math.min(self.cols, Math.round(fx * 1000) / 1000));
          it.y = Math.max(0, Math.round(fy * 1000) / 1000);
          t.style.setProperty('--x', it.x);
          t.style.setProperty('--y', it.y);
          self.dirty = true;
          return;
        }

        /* 1 · THE HAND. Nothing here is rounded. */
        t.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.04)';

        /* 2 · THE DESTINATION. Rounded once, from the pointer. */
        var tx = Math.max(0, Math.min(self.cols - vw,
                   Math.round(ox + dx / (cw + GAP))));
        var ty = Math.max(0, Math.round(oy + dy / (rowh + GAP)));
        if (tx === lastTX && ty === lastTY) return;
        lastTX = tx; lastTY = ty;

        /* 3 · MAKE ROOM, minimally, and show it. */
        liveLayout = self.displace(basePack, it.id, { x: tx, y: ty, w: vw, h: vh });
        paintOthers(liveLayout);
        if (ghost) {
          ghost.style.setProperty('--x', tx);
          ghost.style.setProperty('--y', ty);
        }
        self.dirty = true;
      }

      function up() {
        self.clearGuides();
        try { t.releasePointerCapture(e.pointerId); } catch (_) {}
        grid.removeEventListener('pointermove', move);
        grid.removeEventListener('pointerup', up);
        grid.removeEventListener('pointercancel', up);
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        t.style.transform = '';
        /* the flag outlives the pointerup by a tick so the click that follows a
           drag does not also OPEN the thing that was just moved */
        setTimeout(function () { t.removeAttribute('data-dragging'); }, 0);
        /* RELEASE COMMITS WHAT THE GHOST PROMISED. The layout the person has
           been looking at for the whole gesture is the one that is written —
           nothing is recomputed at the last moment, so nothing jumps. */
        if (moved && !free && liveLayout) {
          /* ═══ COMMITTING A PROJECTED VIEW WITHOUT RE-AUTHORING THE PAGE ═══
             ★ FOUNDER, 2026-08-30: *"only move things that need to move because
               of the user's action"* · *"the layout engine may constrain user
               intent, it may not routinely replace user intent with its own
               optimization."*

             THE FIRST VERSION OF THIS COMMIT MOVED SEVEN PLACEMENTS OUT OF
             EIGHT for a single drag — measured. It wrote every tile's canonical
             `x` back from its VIEW position, and on a two-column phone
             `toBase()` multiplies by six, so one gesture rewrote an entire
             twelve-column arrangement that had been authored on a desktop.
             Zero overlaps, perfectly valid, and the person's composition gone.

             SO THE TWO ROLES ARE SEPARATED:

               THE DRAGGED POPIT is the user's explicit intent. Its position is
               what they just said, so it is committed — x and y.

               A DISPLACED NEIGHBOUR only moved because it was in the way. It
               was pushed DOWN, so only its `y` changes. Its COLUMN was never
               part of this gesture and must survive it — otherwise arranging on
               a phone silently flattens the desktop layout.

             AND ONLY WHAT ACTUALLY MOVED IS WRITTEN, so a tile the cascade
             never reached keeps its exact stored values. */
          self._pack = liveLayout;
          var wasPack = basePack;
          Object.keys(liveLayout).forEach(function (id2) {
            var target = self.items.filter(function (x) { return x.id === id2; })[0];
            if (!target) return;
            var b2 = liveLayout[id2], was = wasPack[id2];
            if (id2 === it.id) {
              target.x = Math.round(self.toBase(b2.x));
              target.y = b2.y;
            } else if (!was || was.y !== b2.y) {
              target.y += (b2.y - (was ? was.y : b2.y));   /* the push, nothing else */
            } else {
              return;                                       /* untouched stays untouched */
            }
            var node = grid.querySelector('[data-id="' + id2 + '"]');
            if (node) {
              node.style.setProperty('--x', b2.x);
              node.style.setProperty('--y', b2.y);
            }
          });
          /* AND THE STORED ARRANGEMENT MUST SATISFY THE INVARIANT TOO —
             see `settleCanonical`. A redraw follows only when it actually had
             to move something, so an ordinary drag costs no extra paint. */
          if (self.settleCanonical(it.id)) self.render();
          self.placeBox();
          self.save();
        } else if (moved) { self.settle(it, t); self.save(); }
        /* A TAP SELECTS, A DRAG MOVES — one gesture, decided by whether the
           pointer travelled. Selecting on pointerdown would put a transform box
           over everything the person merely brushed past. */
        else self.select(grid, t, it);
      }
      grid.addEventListener('pointermove', move);
      grid.addEventListener('pointerup', up);
      grid.addEventListener('pointercancel', up);
    });
  };

  /* ── SAVING ─────────────────────────────────────────────────────────────
     ONE request per arrangement, debounced. The whole layout, because a layout
     is DESIRED STATE — replacing it with the same thing is the same thing, which
     is what makes it replayable offline with no idempotency machinery at all.
     Queued when the network is gone: rearranging your own profile is exactly the
     reversible action §24 says must not be refused for want of a connection. */
  Canvas.prototype.save = function () {
    var self = this;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(function () {
      req('/api/canvas/' + encodeURIComponent(self.surface),
          { method: 'PUT', body: { placements: self.items }, queueable: true,
            label: 'Your arrangement', invalidate: '/api/canvas/' })
        .then(function (r) {
          if (r && r.ok && r.data && r.data.placements) {
            /* THE SERVER'S ARRANGEMENT WINS. Geometry is repaired on the way in
               — a width clamped, a tile pushed back onto the grid — so keeping
               our own copy of what we sent would drift from what is actually
               stored on the first correction. */
            self.items = r.data.placements;
            /* ── AND THE THIRD ANSWER COMES BACK WITH IT ──────────────────
               The write returns `arranged: true` and this dropped it on the
               floor. `arranged` is how a surface tells never-configured from
               deliberately-emptied (founder/312), and the empty state draws a
               different thing for each: an invitation, or nothing at all.

               So a person whose surface had never been arranged, who added a
               Popit and then removed it, kept a client-side `arranged: false`
               and was shown the first-time invitation over a surface they had
               just deliberately cleared — the platform overruling a decision
               it had itself recorded correctly on the server. */
            if (r.data.arranged === true) self.arranged = true;
            self.dirty = false;
            /* A SUCCESSFUL WRITE RETIRES THE LAST FAILURE. Leaving "that change
               was not saved" above a canvas that has since saved is a second
               way of being wrong about the same thing. */
            self.noteText = '';
            self.render();
          } else if (r && r.queued) {
            /* NOT SAVED. WRITTEN DOWN. The distinction is the whole promise. */
            self.dirty = true;
            try {
              global.dispatchEvent(new CustomEvent('ow:canvas-pending',
                { detail: { surface: self.surface } }));
            } catch (_) {}
          } else {
            /* REFUSED — AND IT USED TO SAY NOTHING AT ALL.
               A 403 (a visitor who may not arrange), a 400 (a placement the
               server would not take) or an unreachable API all landed here and
               fell straight through: the tile stayed where it was dropped and
               the person had every reason to believe it was saved. That is the
               fake-success failure in its purest form — the screen disagreeing
               with the server and only the screen being visible.

               So: SAY IT, then SHOW THE TRUTH. Re-reading is what makes the
               correction honest rather than cosmetic — whatever the server
               actually holds is what ends up on screen, including the tile
               snapping back to where it really is. */
            self.dirty = true;
            self.note((r && r.status === 403)
              ? 'This canvas is not yours to arrange. Nothing was changed.'
              : 'That change was not saved. Showing what the server has.',
              true);
            self.grid = null;      /* let `load` draw its own state again */
            self.load();
          }
        });
    }, 450);
  };

  /* ONE LINE, ABOVE THE CANVAS, THAT TELLS THE TRUTH ABOUT THE LAST WRITE.
     Not a toast and not a modal (both are ruled out): it sits in the surface it
     is about, and it is replaced rather than stacked, because the only thing
     worth reading is the most recent answer. */
  Canvas.prototype.note = function (text, bad) {
    /* HELD IN STATE, NOT IN THE DOM. Every draw path in here rewrites
       `host.innerHTML`, so a note written straight into the host is erased by
       the very re-render that was meant to show the corrected truth — which
       would leave the person with a silently reverted tile and no explanation.
       That is the same silence this note exists to end, so it survives the
       redraw instead. */
    this.noteText = text || '';
    this.noteBad = !!bad;
    this.paintNote();
  };

  Canvas.prototype.paintNote = function () {
    if (!this.host || !this.noteText) { return; }
    var el = doc.createElement('div');
    el.className = 'ow-cv-note' + (this.noteBad ? ' ow-cv-note--bad' : '');
    el.setAttribute('role', 'status');
    el.textContent = this.noteText;
    this.host.insertBefore(el, this.host.firstChild);
  };

  /* ── WHAT A POPIT KNOWS ABOUT ITSELF THE MOMENT IT IS PLACED ────────────
     ★ FOUNDER, 2026-08-30: *"clocks set to time zones"* — and, on this exact
       shape: a person could add a Clock and never make it their Clock.

     A Clock placed with no configuration was stored as UTC. That is the right
     FALLBACK on the server, which cannot know where anybody is, and the wrong
     ANSWER here, where the browser knows exactly: `Intl` has already resolved
     the device's zone. Measured 2026-09-03 by adding every kind in turn — a
     fresh Clock read "UTC · 02:39", which is nobody's clock.

     THE DEVICE'S ZONE IS THE ONLY ONE THAT CAN BE KNOWN WITHOUT ASKING, and it
     is the one a person most likely wants first. It is a starting point, not a
     decision: the zone chooser rides the selection, so the first tap changes
     it. What it must never be is a place nobody chose.

     The label comes from the same resolution rather than from the identifier —
     "America/New_York" is a database key, not a place a person recognises, and
     that rule is already written on the server's side of this. */
  function withZone(cfg, tz) {
    var out = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) out[k] = cfg[k];
    out.tz = tz;
    out.label = tz.split('/').pop().replace(/_/g, ' ');
    return out;
  }

  function newConfig(entry) {
    var cfg = entry.config || {};
    var ref = entry.id || entry.ref || '';
    if (ref !== 'clock' || cfg.tz) return cfg;
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (!tz) return cfg;                       /* no guess is better than UTC */
    return withZone(cfg, tz);
  }

  /* ── A CLOCK ON A CENTER TAKES THE CENTER'S ZONE ────────────────────────
     The catalog declares `clock: {context: ["location", "time"]}` and says why
     in its own comment: *"THE CLOCK IS LIVE AND SHARES ITS LOCATION …
     `context: location` is what stops five Atlantic City clocks each resolving
     the same zone independently."*

     Nothing implemented it. Measured with the contract probe: the clock never
     requested /where at all, so the sharing it describes was not merely
     inefficient, it did not exist — and `newConfig` seeded the ADDER'S DEVICE
     zone. Add a Clock to an Atlantic City Center from a laptop in London and
     the Center's own page told visitors it was London time; on the server side
     `_clock_config` falls back to UTC, so the other path gave UTC.

     Neither is a fact about the Center. The Center knows its own zone —
     `/where` answers `time.timezone: "America/New_York"` — and `whereRead` is
     the shared, cached read the declaration was pointing at all along. Five
     clocks on one Center now cost one request between them, which is the
     sentence in the catalog finally being true.

     Only when the person has not chosen a zone. An explicit tz is their
     decision and is never overridden. */
  function zoneForSurface(surface) {
    if (!/^center:/.test(surface || '')) return Promise.resolve('');
    return whereRead(surface).then(function (res) {
      var d = res && res.ok && res.data;
      return (d && d.time && d.time.timezone) || '';
    }).catch(function () { return ''; });
  }

  Canvas.prototype.add = function (entry) {
    /* A NEW THING GOES WHERE THERE IS ROOM, not on top of something else. */
    var maxY = 0;
    this.items.forEach(function (i) { maxY = Math.max(maxY, (i.y || 0) + (i.h || 1)); });
    /* ── TWO DIFFERENT THINGS CALLED `kind`, AND IT BROKE EVERY ADD ──────
       This method is handed two shapes. A SERVER PLACEMENT (the sticker
       upload returns one) carries `kind` = the PLACEMENT kind — one of
       popit · sticker · app · event · center. A CATALOG ROW carries `kind` =
       the WIDGET's own kind: `{"id":"favourite","kind":"favourite"}`.

       Reading `entry.kind` for both sent `{"kind":"colours"}` to the server,
       which answered `400 unknown placement kind: colours` — so NO Popit could
       ever be added from the catalog, the single commonest thing this picker
       exists to do. It looked like it worked, because the tile was drawn
       locally before the refusal came back and nothing announced the refusal.
       Measured 2026-08-24 in the OS Center canvas; present since the picker
       was written.

       So the placement kind is now stated OUTRIGHT by whoever calls this, as
       `place`, and the widget's identity stays where it always belonged — in
       the `ref`. `kind` is still honoured for the server-placement shape,
       which is the one case where it already means the right thing. */
    var pkind = entry.place || entry.kind || 'popit';
    this.items.push({
      id: 'pl_' + Math.random().toString(36).slice(2, 10),
      /* A CATALOG ROW IS IDENTIFIED BY `id`; AN UPLOAD BY `ref`. Preferring
         `id` blindly would turn a sticker's asset path into whatever the row
         happened to call itself. */
      kind: pkind,
      ref: (pkind === 'sticker' ? entry.ref : (entry.id || entry.ref)),
      x: 0, y: maxY, w: entry.w || 3, h: entry.h || 2, z: 0,
      /* ── A PLACEMENT DOES NOT STORE THE THING'S NAME ────────────────────
         This seeded `label` with `entry.name` — the catalog's own title for
         the object. project()'s docstring is explicit about why that is wrong:
         *"A stored title is a copy; a joined title is a view. The difference
         only becomes visible the day the Event is renamed — one of them
         changes and one of them lies."* Placing a Collection called "Atlantic
         City" wrote those words into the placement, and renaming the
         collection left the tile saying the old name forever.

         `label` is for what a PERSON typed. Empty means "use the canonical
         name", which is what the read already joins and what _clock_config
         already derives when no label is set. */
      config: newConfig(entry), label: ''
    });
    this.render();
    this.save();

    /* the Center's own zone, if this is a Clock nobody has set a zone on. It
       lands after the first save because the read is shared and may already be
       cached; a second save is cheap and the alternative is blocking the add
       on a network round trip. */
    var ref0 = entry.id || entry.ref || '';
    var placed = this.items[this.items.length - 1];
    if (ref0 === 'clock' && !(entry.config && entry.config.tz)) {
      var self0 = this;
      zoneForSurface(this.surface).then(function (tz) {
        if (!tz || !placed || placed.config.tz === tz) return;
        placed.config = withZone(placed.config || {}, tz);
        self0.render();
        self0.save();
      });
    }
  };

  Canvas.prototype.remove = function (id) {
    this.items = this.items.filter(function (i) { return i.id !== id; });
    this.render();
    this.save();
  };

  /* ── ONE PLACEMENT PRIMITIVE ─────────────────────────────────────────────
     ★ FOUNDER, 2026-08-24: *"Don't build three different mechanisms. There
       should be ONE placement primitive with different authorization/context."*

     `place(kind, ref)` is how anything gets onto any canvas from anywhere:
     an Event you found in a Center, the Center itself, later a Popit from a
     catalog somewhere else. It reads the target arrangement, appends, and PUTs
     THE WHOLE THING back — the same desired-state write the drag uses, so a
     placement made from a Center page and a placement made by dragging are
     literally the same operation and cannot drift.

     THE TARGET IS A SURFACE, AND AUTHORITY IS THE SERVER'S. This offers Home
     always, and any Center the caller has been TOLD it may arrange — never a
     list this file computes. `may_arrange` comes from `may_operate`; a client
     that decided for itself would be a second answer to a permission question.

     IT IS QUEUEABLE. `PUT /api/canvas/{surface}` replaces an arrangement with
     an arrangement, so a replay writes what it wrote the first time — lane B
     lists it SAFE-WITHOUT-KEY. Placing something with no signal is therefore a
     reversible action that must not be refused (§24), and the person is told it
     is on this device and not yet elsewhere rather than told it succeeded. */
  function place(kind, ref, opts) {
    opts = opts || {};
    /* WHO IS PLACING. `OW.data.me()` is the App's answer; the OS shell has no
       such reader, and placing onto a PERSON'S Home is not something the OS
       does — an operator there is arranging a CENTER. So no identity means no
       Home target rather than a thrown error. */
    var me = (OW.data && OW.data.me) ? (OW.data.me() || '') : '';
    if (!me && !(opts.also || []).length) {
      return Promise.resolve({ ok: false, reason: 'signed_out' });
    }

    var targets = me ? [{ surface: 'home:' + me, label: 'Your Home' }] : [];
    (opts.also || []).forEach(function (t) {
      if (t && t.surface && t.label) targets.push(t);
    });

    var chosen = targets.length === 1
      ? Promise.resolve(targets[0])
      : ask(targets, opts.what || 'Add to');

    return chosen.then(function (t) {
      if (!t) return { ok: false, reason: 'cancelled' };
      return req('/api/canvas/' + encodeURIComponent(t.surface), { fresh: true })
        .then(function (r) {
          if (!r || !r.ok) return { ok: false, reason: 'unreadable' };
          var items = (r.data.placements || []).map(function (p) {
            /* SEND BACK WHAT IS STORED, NOT WHAT WAS READ. `project()` adds
               `resolved` and `gone` at read time; PUTting those back would be
               writing a copy of the Event into the placement — the exact thing
               the reference model exists to prevent. */
            /* `rot` TRAVELS WITH THE PLACEMENT. This rebuilt every existing
               row to append one new placement and listed nine fields; rot was
               not among them, so placing anything onto a surface flattened
               every sticker on it back to zero degrees. The angle is a
               person's gesture — the founder asked for stickers to be turned
               by hand — and it was being discarded by an unrelated act. */
            return { id: p.id, kind: p.kind, ref: p.ref, x: p.x, y: p.y,
                     w: p.w, h: p.h, z: p.z, rot: p.rot,
                     config: p.config, label: p.label };
          });
          if (items.some(function (p) { return p.kind === kind && p.ref === ref; })) {
            return { ok: true, already: true, surface: t.surface, label: t.label };
          }
          var maxY = 0;
          items.forEach(function (p) { maxY = Math.max(maxY, (p.y || 0) + (p.h || 1)); });
          items.push({ id: 'pl_' + Math.random().toString(36).slice(2, 10),
                       kind: kind, ref: ref, x: 0, y: maxY,
                       w: opts.w || 6, h: opts.h || 3, z: 0, config: {}, label: '' });
          return req('/api/canvas/' + encodeURIComponent(t.surface),
                     { method: 'PUT', body: { placements: items }, queueable: true,
                       label: 'Adding to ' + t.label, invalidate: '/api/canvas/' })
            .then(function (w) {
              if (w && w.ok) return { ok: true, surface: t.surface, label: t.label };
              /* NOT SAVED. WRITTEN DOWN. The distinction is the whole promise. */
              if (w && w.queued) return { ok: false, queued: true, label: t.label };
              return { ok: false, reason: 'refused',
                       error: (w && w.error) || '' };
            });
        });
    });
  }

  /* A chooser, only when there is a choice. One destination goes straight
     through — asking a person to confirm the only option is not a decision. */
  function ask(targets, title) {
    return new Promise(function (resolve) {
      var sheet = doc.createElement('div');
      sheet.className = 'ow-cv-pick' +
        ((OW.data && OW.data.get) ? '' : ' ow-cv--os');
      sheet.innerHTML = '<div class="ow-cv-pick__bar"><span>' + esc(title) +
        '</span><button type="button" class="ow-cv-pick__x">Cancel</button></div>' +
        '<div class="ow-cv-pick__list"></div>';
      doc.body.appendChild(sheet);
      var done = function (v) {
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        resolve(v);
      };
      sheet.querySelector('.ow-cv-pick__x').addEventListener('click', function () { done(null); });
      var list = sheet.querySelector('.ow-cv-pick__list');
      targets.forEach(function (t) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'ow-cv-pick__row';
        b.innerHTML = '<span class="ow-cv-pick__name">' + esc(t.label) + '</span>';
        b.addEventListener('click', function () { done(t); });
        list.appendChild(b);
      });
    });
  }

  /* ── THE OS DOOR, IN THE OS'S OWN IDIOM ──────────────────────────────────
     `dashboard.html` is 7,900 lines and every one of its surfaces opens the
     same way: a `window.owXxxOpen()` the shell calls. So this follows that
     rather than performing surgery on the shell to insert a panel — founder:
     *"PRESERVE the existing frontend, do not rebuild for architectural
     purity."*

     SAME CANVAS, SAME STATE, SAME AUTHORITY. The only thing that differs is the
     PALETTE: the OS is a light surface with its own tokens, and a canvas
     carrying the App's dark fallbacks into it would be a parallel palette. The
     `--os` variant maps the OS's own variables onto the ones this file already
     uses, so there is one stylesheet and not two. */
  OW.canvas = {
    place: place,
    mount: function (host, surface, opts) {
      opts = opts || {};
      /* THE HONEST FAULT. Without the contract this cannot rank or word an
         event, and guessing is the failure the contract exists to prevent. Say
         so where a canvas was expected rather than leaving a silent gap. */
      if (!TIME) {
        try {
          host.innerHTML = '';
          var f = doc.createElement('div');
          f.className = 'ow-cv-fault';
          f.textContent = 'This canvas could not load. Nothing has been changed.';
          host.appendChild(f);
        } catch (eF) {}
        return null;
      }
      /* WHICH SURFACE IS BEING LOOKED AT. `OW.canvas.open` is exported and
         called unbound — `OW.canvas.open(it, n)` — so it cannot reach the
         instance through `this`. Opening a Popit has to ask the surface it was
         placed on, because the same kind answers differently for different
         people, so the surface is recorded here at mount. */
      OW._cvSurface = surface;
      var c = new Canvas(host, surface);
      /* Explicit when given; otherwise inferred from which shell is present.
         The App publishes `OW.data`; the OS does not. */
      c.shell = opts.shell || ((OW.data && OW.data.get) ? 'app' : 'os');
      c.load();
      /* ONLY A PERSON'S OWN HOME PAGES PAST ITSELF. A Center's canvas is the
         page, not a block at the top of one, and the OS is not a scroll at
         all — so the gesture is bound where the ruling was about, once. */
      if (/^home:/.test(surface || '') && c.shell === 'app' && !OW._swipePast) {
        OW._swipePast = true;
        try { homeSwipePast(host); } catch (e) {}
      }
      return c;
    },
    /* The OS calls this. One Center, its own surface, arranged by whoever
       `may_operate` says may arrange it — the server decides, not the shell. */
    openForCenter: function (host, centerId, opts) {
      if (!host || !centerId) return null;
      return OW.canvas.mount(host, 'center:' + centerId, opts || { shell: 'os' });
    },
    open: open,
    catalog: function (centerId) {
      return req('/api/canvas/catalog' +
                 (centerId ? '?center_id=' + encodeURIComponent(centerId) : ''))
        .then(function (r) {
          var c = (r && r.ok) ? r.data.catalog : null;
          /* REMEMBERED, so an unbound Popit can say its real name. The picker
             already fetches this; a tile asking the server again for a word it
             has just been told is a second read of one fact. */
          if (c) rememberCatalog(c);
          return c;
        });
    }
  };

  var css = [
    /* THE OS IS A LIGHT SURFACE WITH ITS OWN TOKENS. This remaps them onto the
       names this stylesheet already uses, so the canvas inherits the OS's
       palette rather than carrying the App's into it. One stylesheet, two
       grounds — not a second design. */
    '.ow-cv--os{--ow-ink:var(--ow-text-primary,#1d1d1f);',
    '  --ow-ink-2:var(--ow-text-secondary,#6e6e73);',
    '  --ow-ink-3:var(--ow-text-tertiary,#86868b);',
    '  --ow-seam:var(--ow-bdr-subtle,rgba(0,0,0,.08));',
    '  --ow-panel-1:var(--ow-bg-elevated,#fff);',
    '  --ow-panel-2:var(--ow-bg-panel,#fff);',
    '  --ow-ground:var(--ow-bg-base,#fbfbfd)}',
    '.ow-cv--os .ow-cv-face{background:var(--ow-bg-elevated,#fff);',
    '  box-shadow:var(--ow-elev-2,0 2px 8px rgba(0,0,0,.06));backdrop-filter:none}',
    /* CAPPED AND CENTRED — see PLANE_MAX. The cap is on the PLANE so the cell
       stays square; capping the row instead is what cost the Popits their
       proportion in the first place. */
    '.ow-cv{position:relative;display:block;width:100%;',
    '  max-width:var(--cv-max,880px);margin-inline:auto;',
    '  min-height:calc(var(--cv-rows,6) * (var(--cv-row) + var(--cv-gap)))}',
    /* ── THE TRANSFORM BOX ────────────────────────────────────────────────
       Drawn in the world's own light rather than as OS chrome: a thin hue line
       with square handles, the shape a person already reads as "this is the
       thing I am changing". */
    /* ── THE CLOCK ────────────────────────────────────────────────────────
       Type does the work. The time is the object; everything else is a label
       for it, so the hierarchy is steep — a glance should land on the number
       and never on the word underneath it. */
    /* SIZED TO THE TILE, NOT THE WINDOW. `vw` was the wrong unit: on a wide
       screen a three-column Clock is still narrow, so 8vw resolved to 40px
       inside a ~90px tile and the time clipped — "12:25 PM" rendered as
       "2:25 PM", which is not a cosmetic fault, it is the wrong time. Container
       units measure the thing the text actually sits in. */
    '.ow-cv-face--clock{align-items:center;justify-content:center;padding:8px 10px;',
    '  container-type:inline-size;overflow:hidden}',
    '.ow-clk{display:flex;align-items:center;gap:14px;width:100%;height:100%;',
    '  justify-content:center;min-width:0}',
    '.ow-clk-read{display:flex;flex-direction:column;min-width:0;align-items:flex-start;',
    '  max-width:100%;overflow:hidden}',
    /* ★ `line-height:1` CLIPS THE GLYPHS THEMSELVES.
       ★ FOUNDER, 2026-08-30: *"i dont want to see any cut out … text
         anywhere."*

       Measured: at `font-size:12px` with `line-height:12px`, the time needed 14
       pixels of box and had 12 — so "4:03 AM" was losing two pixels off its
       ascenders and descenders on every small clock. It reads as slightly wrong
       rather than obviously broken, which is why it survived every earlier pass:
       nothing was ellipsised and no word was missing, the letters were simply
       being shaved.

       A ratio just over one keeps the tight, numeric look the big readout wants
       while giving the font the room it actually asks for. */
    '.ow-clk-t{max-width:100%;overflow:visible}',
    '.ow-clk-t{font-family:var(--ow-font-display,inherit);font-weight:650;',
    '  letter-spacing:-.03em;line-height:1.14;color:var(--ow-ink,#fff);',
    '  font-variant-numeric:tabular-nums;white-space:nowrap}',
    /* TABULAR FIGURES so the time does not jiggle as the digits change — the
       single most noticeable thing a clock can get wrong. */
    /* THE PLACE LEADS — above the time, in the accent, so a wall of clocks is
       read as places before it is read as numbers. */
    /* ★ A PLACE NAME IS NOT DECORATION — IT IS THE POINT OF THE POPIT.
       ★ FOUNDER, 2026-08-30: *"see how text drops out."*

       "NEW YORK" was rendering as "NE…" and "GMT+9" as "G…". The cause was not
       the tile being too small — the words fit — it was `letter-spacing:.13em`
       on UPPERCASE text plus `white-space:nowrap`, which together demand about
       forty percent more width than the glyphs need and then ellipsis away the
       difference. Tracking is a typographic nicety; the name of the city is the
       thing the founder asked to always be visible.

       So the tracking RELAXES as the tile narrows, and below that the name is
       allowed a second line rather than being cut. Density, not clipping —
       which is the founder's own rule for running out of room. */
    '.ow-clk-city{font-size:clamp(8px,min(11px,17cqh),11px);font-weight:600;',
    '  letter-spacing:clamp(0em,1.2cqw,.13em);',
    /* the accent AS INK, which is the hue on dark and a lightness-clamped
       version of the same hue on light. Measured at 1.30:1 before this — the
       one line the founder said must always be visible was the least visible
       thing on the canvas. See --ow-h2-ink in oneway-popit.css. */
    '  color:var(--ow-h2-ink,rgba(var(--ow-h2),.98));',
    '  overflow:visible;max-width:100%;',
    '  margin-bottom:2px;line-height:1.12;',
    /* NO ELLIPSIS. A place name that ends in "…" has not been shortened, it has
       been broken — and this is the one line the founder said must always be
       visible. It shrinks and, at the very bottom, wraps; it never gets cut. */
    '  white-space:normal;overflow-wrap:normal;word-break:normal}',
    /* ★ ONE LINE, ALWAYS — WRAPPING WAS WORSE THAN TRUNCATING.
       Allowing two lines stopped "NEW YORK" being cut and immediately produced
       "TOK / YO" sitting ON TOP of the time beneath it, and "GMT+9" pushed out
       of the tile entirely. A clock has a fixed vertical budget; spending it on
       a second line of label takes it from the thing the Popit is for.

       The truncation is gone anyway, and it was never the width — it was
       `letter-spacing:.13em` on uppercase demanding about forty percent more
       room than the glyphs need. Relaxed tracking fits "NEW YORK" on one line
       at this size with space to spare.

       AND THE SUPPORTING LINE YIELDS FIRST. When the tile is genuinely too
       short, the zone/date line goes before the place name does — the founder's
       rule is that the location is always visible, so it is the last thing to
       be given up, not the first. */
    '@container (max-height:104px){.ow-clk-meta{display:none}}',
    /* ★ TRACKING GOES TO ZERO ON A NARROW TILE, AND THAT IS THE WHOLE FIX.
       `letter-spacing:clamp(0em,1.2cqw,.13em)` still resolved near its maximum,
       because `cqw` scales WITH the tile — a narrow Popit has small cq units but
       the ratio stays the same, so the tracking never actually relaxed. A
       container query asks the question the clamp could not: is this tile small.
       At 9px with no tracking "NEW YORK" needs about 46px inside a ~95px box. */
    '@container (max-width:152px){',
    '  .ow-clk-city{letter-spacing:0;font-size:9px}',
    '  .ow-clk-meta{letter-spacing:0;font-size:9px}',
    '}',
    /* a name gets its two lines wherever it has not got the width for one */
    '@container (max-width:170px){',
    /* the narrow variant follows the same rule — wrap, never clamp */
    '  .ow-cv-coll__t{white-space:normal;overflow:visible;',
    '   text-overflow:clip;font-size:11px;line-height:1.16}',
    '}',
    '.ow-clk-meta{font-size:clamp(8px,min(11px,15cqh),11px);font-weight:500;',
    '  letter-spacing:clamp(0em,.6cqw,.06em);',
    '  color:var(--ow-ink-2,rgba(255,255,255,.68));margin-top:4px;',
    '  overflow:hidden;max-width:100%;overflow-wrap:anywhere;line-height:1.15}',
    '.ow-clk-meta:empty{display:none}',
    /* the four densities — one component, four amounts of it */
    '.ow-clk[data-d="s"]{justify-content:center}',
    '.ow-clk[data-d="s"] .ow-clk-read{align-items:center;text-align:center}',
    '.ow-clk[data-d="s"] .ow-clk-city{font-size:9.5px;letter-spacing:.1em}',
    /* ★ THE TIME IS BOUNDED BY BOTH AXES. Founder, 2026-08-30: *"they cannot
       appear broken when resized or stretched."*

       THESE WERE `cqw` ONLY, and width is half the tile. A 12-wide, 1-row Clock
       is very wide and 44px tall: `26cqw` resolved to the 30px ceiling, the city
       and the meta line sat above and below it, and three elements pushed
       straight out of the tile — measured, not guessed.

       `min(Ncqw, Ncqh)` is the whole fix: whichever dimension runs out first
       decides the type size, so a flat tile shrinks the digits instead of
       overflowing and a narrow tile does the same. The px clamp still holds the
       floor and the ceiling. This is why the tile became a `size` container —
       `cqh` does not exist without it.

       IT ALSO MAKES THE JS FALLBACK ALMOST DEAD CODE, which is the point:
       `fit()` measured once per text change and never re-ran on resize, so a
       Popit dragged wider kept the font it was measured at. Geometry that holds
       by construction beats a measurement that has to be remembered. */
    '.ow-clk[data-d="s"] .ow-clk-t{font-size:clamp(14px,min(26cqw,46cqh),30px)}',
    '.ow-clk[data-d="m"] .ow-clk-read{align-items:center}',
    '.ow-clk[data-d="m"] .ow-clk-t{font-size:clamp(15px,min(25cqw,38cqh),38px)}',
    '.ow-clk[data-d="l"] .ow-clk-t{font-size:clamp(17px,min(20cqw,30cqh),46px)}',
    '.ow-clk[data-d="xl"] .ow-clk-t{font-size:clamp(19px,min(15cqw,26cqh),52px)}',
    /* the supporting lines answer to height too, or they reappear as the
       overflow the time no longer causes */
    '.ow-clk-city{font-size:clamp(8px,min(11px,17cqh),11px)}',
    '.ow-clk-meta{font-size:clamp(8px,min(11px,15cqh),11px)}',
    '.ow-clk-read{max-height:100%}',
    '.ow-clk[data-d="xl"]{justify-content:flex-start;padding-left:4px}',
    /* the sweep — only at the size where it can be seen */
    /* ── THE DIAL ─────────────────────────────────────────────────────────
       A real face: sixty ticks with the hours longer, three weighted hands and
       a cap. The weights are what make it read as a clock rather than as a
       circle with sticks in it — an hour hand must be visibly shorter and
       heavier than a minute hand. */
    /* ── THE DIAL TAKES ITS SHARE, NOT ALL OF IT ──────────────────────────
       At `flex:0 0 auto` with `max-width:100%` a tall tile gave the dial the
       whole width and the readout was squeezed to nothing — the "both" clock
       rendered as analogue-only, silently. Measured 2026-08-30.

       ANALOGUE fills the tile, because the dial IS the content. BOTH caps the
       dial at 44% so the digits keep a column, which is what "both" means. */
    '.ow-clk-dial{width:auto;height:auto;flex:0 0 auto;overflow:hidden;',
    '  aspect-ratio:1;max-height:100%;max-width:100%}',
    '.ow-clk[data-face="both"] .ow-clk-dial{max-width:44%}',
    /* ★ NO CUT TEXT, ANYWHERE — SO THE DIAL YIELDS BEFORE THE WORDS DO.
       ★ FOUNDER, 2026-08-30: *"i dont want to see any cut out or ... text
         anywhere."*

       Measured on a 390px phone: a "both" clock gave its dial 44% and left the
       readout THIRTEEN PIXELS for the word "London", which needs forty-eight.
       The readout was being treated as whatever was left over.

       Below the width where both can coexist, the clock STACKS — dial above,
       readout beneath at full width — so the place name always has the whole
       tile to sit in. The person still gets the dial they chose; it simply
       stops competing with the thing it is labelling. */
    '@container (max-width:210px){',
    '  .ow-clk[data-face="both"]{flex-direction:column;align-items:center;',
    '    justify-content:center;gap:4px}',
    '  .ow-clk[data-face="both"] .ow-clk-dial{max-width:min(64%,62cqh)}',
    '  .ow-clk[data-face="both"] .ow-clk-read{align-items:center;text-align:center;',
    '    width:100%;flex:0 0 auto}',
    '}',
    /* A READOUT MAY SHRINK, BUT NEVER BELOW THE WORDS IT HOLDS. `min-width:0`
       is what let it collapse to thirteen pixels — it permits a flex item to go
       under its own content size, which is exactly the cut we are removing. */
    '.ow-clk[data-face="both"] .ow-clk-read{flex:1 1 auto;min-width:min(100%,8ch)}',
    /* ── AND STACKED, THE READOUT KEEPS ITS HEIGHT (founder/513 tour) ──────
       The stacked rule above says `flex:0 0 auto` and this line, one rule
       later at the same weight, said `flex:1 1 auto` — the later one won, so
       in a stacked clock the readout could SHRINK: measured at 390px, an 80px
       Atlantic City clock gave its readout 18px for 27px of words and the time
       was cut in half. Stacked, the dial is what gives: it is a picture and
       can be smaller; the time cannot be shorter. */
    '@container (max-width:210px){',
    '  .ow-clk[data-face="both"] .ow-clk-read{flex:0 0 auto}',
    '  .ow-clk[data-face="both"] .ow-clk-dial{flex:0 1 auto;min-height:0}',
    '}',
    '.ow-clk-rim{fill:none;stroke:rgba(var(--ow-h1),.28);stroke-width:2}',
    '.ow-clk-tick{stroke:rgba(var(--ow-h1),.26);stroke-width:.8;stroke-linecap:round}',
    '.ow-clk-tick--h{stroke:rgba(var(--ow-h1),.85);stroke-width:2.2}',
    /* NO CSS transform-origin. The hands are rotated by the SVG `rotate(a cx cy)`
       ATTRIBUTE, which already names the pivot in user units. A CSS origin in
       px is resolved against the element's own box unless `transform-box` is
       set, so the two disagreed and the hands swung off the face — the stray
       stroke below the dial. One source for the pivot, and it is the one that
       carries the centre with it. */
    '.ow-clk-hand{stroke-linecap:round}',
    '.ow-clk-hand--h{stroke:var(--ow-ink,#fff);stroke-width:4.6}',
    '.ow-clk-hand--m{stroke:var(--ow-ink,#fff);stroke-width:2.8;opacity:.9}',
    /* THE SECOND HAND IS THE ONE MOVING THING, so it is the accent and it is
       drawn brightly — at 1.3 against a violet rim it disappeared. */
    '.ow-clk-hand--s{stroke:rgb(var(--ow-h2));stroke-width:1.8;',
    '  filter:drop-shadow(0 0 6px rgba(var(--ow-h2),1))}',
    '.ow-clk-cap{fill:var(--ow-ink,#fff)}',
    '.ow-clk-pin{fill:rgb(var(--ow-h2))}',
    '.ow-clk-num{fill:var(--ow-ink-2,rgba(255,255,255,.68));font-size:11px;',
    '  font-weight:600;text-anchor:middle;dominant-baseline:middle;',
    '  font-family:var(--ow-font,inherit)}',
    '@media (prefers-reduced-motion:reduce){.ow-clk-hand--s{display:none}}',
    /* PRESENTATION DECIDES THE LAYOUT. A dial alone centres; a dial with a
       readout sits beside it; digits alone fill the tile. */
    '.ow-clk[data-face="analog"]{justify-content:center}',
    /* ★ AN ANALOGUE CLOCK PUTS ITS PLACE UNDERNEATH, NOT BESIDE.
       ★ FOUNDER, 2026-08-30: *"i dont want to see any cut out or ... text
         anywhere"* and, earlier, *"everyone should display what location its
         getting time from."*

       Measured: a 167px tile with Dial chosen gave the dial 124px and left the
       readout THIRTEEN, so "London" rendered as a sliver. The dial is square
       and claims the height; laying the words beside it means they get whatever
       a circle did not want.

       Stacked, the dial takes the room it needs and the place name has the full
       width of the tile. Both survive, which is the only acceptable outcome —
       the person chose the dial, and the location is the one line that must
       always be readable. */
    '.ow-clk[data-face="analog"]{flex-direction:column;align-items:center;',
    '  justify-content:center;gap:3px}',
    '.ow-clk[data-face="analog"] .ow-clk-dial{flex:0 1 auto;min-height:0;',
    '  max-width:min(100%,74cqh)}',
    '.ow-clk[data-face="analog"] .ow-clk-read{align-items:center;text-align:center;',
    '  width:100%;flex:0 0 auto;min-width:0}',
    '.ow-clk[data-face="both"]{justify-content:flex-start}',
    /* ── IT DROPS, IT DOES NOT CUT ──────────────────────────────────────
       ★ FOUNDER, 2026-08-28: *"i dont want to see any cut out or ... text
         anywhere."*
       This carried `text-overflow:ellipsis`, which is cut text that admits it.
       It survived only because the old reflow gave every tile a wide column;
       under one universal plane a 6-wide Popit is 152px on a phone and the
       line became "Tomorrow there · 5 hour…". A relative time is the least
       important thing a clock says, so at that width it is simply not said. */
    '.ow-clk-o{font-size:11px;color:var(--ow-ink-3,rgba(255,255,255,.48));margin-top:3px;',
    '  white-space:normal;overflow:visible;max-width:100%}',
    '@container (max-width:190px){.ow-clk-o{display:none}}',
    '.ow-clk-o:empty{display:none}',
    /* NOTHING ESCAPES THE POPIT — the founder's rule, enforced at the box
       rather than trusted to each line. */
    '.ow-clk,.ow-clk-read{max-width:100%;min-width:0;overflow:hidden}',
    /* an unreadable zone is stated, never rendered as a broken number */
    '.ow-clk[data-broken] .ow-clk-t{opacity:.5}',
    '.ow-clk[data-broken] .ow-clk-z{color:var(--ow-ink-3,rgba(255,255,255,.48));',
    '  text-transform:none;letter-spacing:0;font-size:10.5px}',
    '.ow-cv-box{position:absolute;z-index:40;pointer-events:none;',
    '  box-shadow:0 0 0 1.5px rgba(var(--ow-h1),.95),0 0 22px -6px rgba(var(--ow-h1),.8);',
    '  border-radius:6px;transform-origin:50% 50%}',
    /* ★ FOUNDER, 2026-09-02: *"make them easier to click on."*  13px was a
       MOUSE target on a surface people use with a thumb. The visible dot stays
       small — a big white square on a small tile is the transform-editor look
       the founder has objected to twice — and the TOUCH target is grown around
       it with a transparent ::before, so what you press is 30px and what you
       see is 13. */
    '.ow-cv-h{position:absolute;pointer-events:auto;width:13px;height:13px;',
    '  margin:-7px 0 0 -7px;border-radius:4px;background:#fff;',
    '  box-shadow:0 0 0 1.5px rgba(var(--ow-h1),.95),0 2px 6px rgba(0,0,0,.5);',
    '  touch-action:none}',
    '.ow-cv-h::before{content:"";position:absolute;left:50%;top:50%;',
    '  width:30px;height:30px;transform:translate(-50%,-50%)}',
    /* ── THE REMOVE BADGE ────────────────────────────────────────────────
       Top-left, the corner iOS uses, on the tile rather than in a menu. Same
       trick as the handles: a small mark with a thumb-sized target. */
    '.ow-cv-kill{position:absolute;left:0;top:0;margin:-9px 0 0 -9px;',
    '  width:19px;height:19px;border-radius:50%;border:0;padding:0;',
    '  pointer-events:auto;cursor:pointer;z-index:41;',
    '  display:flex;align-items:center;justify-content:center;',
    '  font:600 15px/1 var(--ow-font,inherit);color:#12111a;background:#fff;',
    '  box-shadow:0 0 0 1.5px rgba(0,0,0,.35),0 2px 8px rgba(0,0,0,.5);',
    '  touch-action:none}',
    '.ow-cv-kill::before{content:"";position:absolute;left:50%;top:50%;',
    '  width:34px;height:34px;transform:translate(-50%,-50%)}',
    '.ow-cv-kill:focus-visible{outline:2px solid rgba(var(--ow-h1),.95);',
    '  outline-offset:2px}',
    '.ow-cv-h--nw{left:0;top:0;cursor:nwse-resize}',
    '.ow-cv-h--n{left:50%;top:0;cursor:ns-resize}',
    '.ow-cv-h--ne{left:100%;top:0;cursor:nesw-resize}',
    '.ow-cv-h--e{left:100%;top:50%;cursor:ew-resize}',
    '.ow-cv-h--se{left:100%;top:100%;cursor:nwse-resize}',
    '.ow-cv-h--s{left:50%;top:100%;cursor:ns-resize}',
    '.ow-cv-h--sw{left:0;top:100%;cursor:nesw-resize}',
    '.ow-cv-h--w{left:0;top:50%;cursor:ew-resize}',
    /* the turn handle stands off the top edge on its own stalk, which is what
       tells the eye it rotates rather than resizes */
    '.ow-cv-h--turn{left:50%;top:-26px;border-radius:50%;width:15px;height:15px;',
    '  margin:-7px 0 0 -7px;cursor:grab}',
    '.ow-cv-h--turn::after{content:"";position:absolute;left:50%;top:14px;',
    '  width:1.5px;height:14px;margin-left:-.75px;background:rgba(var(--ow-h1),.95)}',
    '.ow-cv-t[data-selected]{z-index:30}',
    /* the lines a thing snapped to, only while the gesture is live */
    /* the zone chooser sits under the box it belongs to, and scrolls rather
       than wrapping — a control that changes height moves the thing above it */
    /* the chooser groups its rows; each row scrolls on its own */
    '.ow-cv-chips{display:flex;gap:5px;flex:0 0 auto;padding-right:6px;',
    '  border-right:1px solid rgba(255,255,255,.12);margin-right:2px}',
    '.ow-cv-chips:last-of-type{border-right:0}',
    '.ow-cv-zones{position:absolute;left:0;top:calc(100% + 10px);z-index:41;',
    '  display:flex;gap:5px;pointer-events:auto;max-width:min(420px,80vw);',
    '  overflow-x:auto;scrollbar-width:none;padding:5px;border-radius:13px;',
    '  background:rgba(8,9,20,.86);-webkit-backdrop-filter:blur(14px);',
    '  backdrop-filter:blur(14px);',
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),.3),0 12px 30px -14px rgba(0,0,0,.8)}',
    '.ow-cv-zones::-webkit-scrollbar{display:none}',
    /* the chooser stacks: presentation chips on one line, the city search under */
    '.ow-cv-zones{flex-wrap:wrap;max-width:min(430px,86vw)}',
    '.ow-cv-find{flex:1 1 100%;display:flex;flex-direction:column;gap:6px;',
    '  margin-top:4px;min-width:0}',
    '.ow-cv-search{width:100%;box-sizing:border-box;border:0;border-radius:9px;',
    '  padding:7px 10px;font-family:var(--ow-font,inherit);font-size:12.5px;',
    '  color:var(--ow-ink,#fff);background:rgba(255,255,255,.07);',
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),.26);outline:none}',
    '.ow-cv-search::placeholder{color:var(--ow-ink-3,rgba(255,255,255,.45))}',
    '.ow-cv-search:focus{box-shadow:inset 0 0 0 1.5px rgba(var(--ow-h1),.6)}',
    '.ow-cv-hits{display:flex;flex-wrap:wrap;gap:5px;max-height:132px;',
    '  overflow-y:auto;scrollbar-width:none}',
    '.ow-cv-hits::-webkit-scrollbar{display:none}',
    '.ow-cv-none{font-family:var(--ow-font,inherit);font-size:11.5px;',
    '  color:var(--ow-ink-3,rgba(255,255,255,.45));padding:4px 2px}',
    '.ow-cv-zone{flex:0 0 auto;border:0;cursor:pointer;white-space:nowrap;',
    '  font-family:var(--ow-font,inherit);font-size:11.5px;font-weight:560;',
    '  padding:6px 10px;border-radius:9px;color:var(--ow-ink,#fff);',
    '  background:rgba(var(--ow-h1),.16)}',
    '.ow-cv-zone[aria-pressed="true"]{background:rgb(var(--ow-h1));color:#0b0b16}',
    '.ow-cv-guides{position:absolute;inset:0;pointer-events:none;z-index:45}',
    '.ow-cv-guides i{position:absolute;top:-8px;bottom:-8px;width:1px;',
    '  background:rgba(var(--ow-h2),.9);box-shadow:0 0 8px rgba(var(--ow-h2),.9)}',
    '.ow-cv-guides u{position:absolute;left:-8px;right:-8px;height:1px;',
    '  background:rgba(var(--ow-h2),.9);box-shadow:0 0 8px rgba(var(--ow-h2),.9)}',
    '@media (pointer:coarse){.ow-cv-h{width:17px;height:17px;margin:-9px 0 0 -9px}}',
    '.ow-cv-t{position:absolute;--rot:0deg;',
    '  left:calc((var(--x) / var(--cv-cols)) * 100%);',
    '  width:calc((var(--w) / var(--cv-cols)) * 100% - var(--cv-gap));',
    '  top:calc(var(--y) * (var(--cv-row) + var(--cv-gap)));',
    '  height:calc(var(--h) * var(--cv-row) + (var(--h) - 1) * var(--cv-gap));',
    '  transition:left .18s var(--ow-ease,ease),top .18s var(--ow-ease,ease)}',
    '.ow-cv.is-booting .ow-cv-t{transition:none}',
    /* ── A FREEFORM PLACEMENT USES THE CANONICAL TWELVE, NOT THE PROJECTED
           COLUMN COUNT ──────────────────────────────────────────────────────
       The rule above divides by `--cv-cols`, the number of columns the DEVICE
       is showing — which is what makes a Popit's grid position translate. A
       sticker is not on the grid: its coordinates are a position in the
       arrangement, and the arrangement is always twelve wide. Dividing them by
       two on a phone is what moved a sticker to the left edge and doubled it.
       `--fx`/`--fw` are already percentages of the twelve, computed where the
       tile is built, so here they are simply used. */
    '.ow-cv-t[data-free="1"]{',
    '  left:var(--fx);',
    '  width:calc(var(--fw) - var(--cv-gap));',
    '  top:calc(var(--fy) * (var(--cv-row) + var(--cv-gap)));',
    '  height:calc(var(--fh) * var(--cv-row) + (var(--fh) - 1) * var(--cv-gap))}',
    /* THE DIRECTIONAL AXIS is the person's, so it is applied to the tile and
       not to the image — a rotated tile carries its outline and its handle
       around with it, which is what makes it feel like one object. */
    '.ow-cv-t--sticker{transform:rotate(var(--rot,0deg))}',
    '.ow-cv-t--sticker[data-dragging]{transform:rotate(var(--rot,0deg)) scale(1.02)}',
    /* superseded by the drag rule above — the transform is now the hand's */
    /* ── touch-action: A TILE ONLY OWNS THE FINGER WHILE ARRANGING ─────────
       ★ FOUNDER, 2026-09-03: *"people should be able to scroll past their
         popit blocks at top of home in one swipe should feel like a different
         part of the app."*
       ★ FOUNDER, 2026-09-04, on long-press interference: a hold must not scroll
         — and, read the other way, an ordinary swipe must still scroll.

       This was `touch-action:none` on every tile whenever the surface was mine.
       touch-action intersects down the ancestor chain, so the faces declaring
       `auto` inside could not give it back: a touch that began anywhere on a
       Popit could not scroll the page AT ALL. The one-swipe requirement was
       unmeetable for the whole top of Home, and it read as the app being stuck.

       `none` is right only while arranging, where the drag IS the gesture and a
       scroll would fight it. Resting, the tile wants `pan-y`: the browser keeps
       vertical scrolling, the tile keeps everything else, and a scroll that
       starts on a Popit also delivers pointercancel — which cancels the hold
       timer for free, so a swipe can no longer become an accidental arrange. */
    '.ow-cv.is-mine .ow-cv-t{cursor:grab;touch-action:pan-y}',
    '.ow-cv.is-mine[data-editing="1"] .ow-cv-t{touch-action:none}',
    /* ── AND A HOLD MUST NOT RAISE THE SELECTION UI ────────────────────────
       A long press on text is the platform's own "select this word" gesture,
       and it was live on every tile: user-select computed `auto` on the tile,
       the face and the text runs. On a touch device the hold would enter
       arrangement AND raise the selection handles and the callout menu over
       the top of it. A home-screen widget does not offer its label for
       selection on any platform the founder asked us to feel like; the Post
       opens on tap, and that is where its text is selectable. */
    '.ow-cv.is-mine .ow-cv-t{-webkit-user-select:none;user-select:none;',
    '  -webkit-touch-callout:none}',
    /* ── THE RESTING STATE IS THE POPIT MATERIAL, NOT A GLASS RECTANGLE ──
       ★ FOUNDER, 2026-08-25: *"the popit designs found on the users profile
         right now are horrible. refer to the ones on our landing page for a
         basis of their design"* — and, separately, that the basis is the
         RESTING object, not the opened room.

       This was a 16px-radius pane with one flat gradient and a blur. The
       landing page and `oneway-popit.css` have carried the real material all
       along: a hand-cut silhouette, wet catchlights, a candy bloom from below,
       colour pooled off-axis, an internal glow, a stitched seam and a woven
       grain. A canvas full of the flat version next to a landing page full of
       the real one is not a style difference — it is the same object rendered
       by two different products.

       CARRIED OVER VALUE-FOR-VALUE from `.po-face`, with one substitution: the
       colour comes from the PERSON'S HUE rather than fixed brand ink, so a
       canvas belongs to whoever arranged it. `--h`/`--h2` are taken in this
       stylesheet (they are the grid's width and height), which is exactly the
       kind of collision that silently breaks geometry — so the Popit hues are
       named `--po-a`/`--po-b` here.

       NOT THE OPENED STATE. Opening is a projection onto the galaxy, and it
       lives in oneway-popit.css where the projection does. */
    /* ── THE SAME MATERIAL, AT A DIFFERENT SIZE ─────────────────────────
       The landing page's bead is 124x174 — at that size a saturated candy body
       reads as a sweet. A canvas tile is six columns by four rows, roughly
       600x220, and the identical gradients stretched over that area stop being
       an object and become a slab of colour: the first attempt turned Home
       into a wall of hot pink. Measured 2026-08-25.
       So the LIGHT is carried over value-for-value — the catchlights, the
       gloss, the rim, the seam, the spill — and the BODY is taken down to a
       tint, letting the galaxy through it. The object still reads as the same
       material; it just stops shouting at four times the area. */
    /* ══ A LITTLEBIGPLANET POPIT, LIT LIKE A HOLOGRAM ══════════════════
       ★ FOUNDER, 2026-08-25: *"this looks far too transparent. I want it to be
         a futuristic but simple colorful hologram that appears over the
         galaxies. Look at LittleBigPlanet popits."*

       I over-corrected twice. First a tinted rectangle, then — reading Law 16's
       "light, not glass" too literally — a pool of light with almost nothing
       to it. An LBP Popit is neither: it is a SOLID, saturated, hand-made
       object you want to touch. Law 16 says the hue lights the information; it
       does not say the object should be see-through.

       So: an opaque candy body, and the light it throws is what makes it
       holographic over the galaxy.

         · a hand-cut silhouette, no two the same perfect pill
         · a saturated body built from the PERSON'S hue
         · a wet gloss along the top and pooled catchlights
         · a stitched thread just inside the edge (the LBP signature)
         · a woven grain so it reads as a made material
         · a bright rim, and a wide spill of its own colour into the world

       Carried over value-for-value from `oneway-popit.css`, which has held this
       material all along — one material, not a third invention. */
    /* ══ ONE PALETTE, MANY PLACES IN IT ════════════════════════════════
       ★ FOUNDER, 2026-08-25: *"they still look alike to each other and do not
         yet feel alive. they also don't automatically shift color in animation
         like rest of the platform does."*

       Every Popit was rendering the person's hue at the same angle, so a wall
       of them was one colour repeated — differentiation had to come from the
       words, which is exactly the card failure. The rest of the platform does
       not work that way: it carries a hue PAIR (`--ow-h1`/`--ow-h2`) that
       shifts with the active identity.

       So each kind takes its own OFFSET from the person's hue. It is still
       their palette — change the hue and every Popit moves together, keeping
       the relationships — but presence, time, place and messages each sit
       somewhere different in it, and you can tell them apart across the room.

       AND IT BREATHES. A slow drift of a few degrees, staggered per kind, so
       the surface is alive rather than a static fill. Small enough that nothing
       ever reads as a different colour; large enough that the wall is never
       still. Motion here is state, not decoration — it stops entirely under
       reduced motion and the mobile safe floor. */
    '.ow-cv{--po-h:var(--po-hue,var(--ow-user-hue,258))}',
    /* A BAND, NOT THE WHOLE WHEEL. The first version spread the kinds across
       360 degrees, which at hue 286 put a green Popit beside a magenta one:
       distinguishable, and no longer one person's palette. Compressed to about
       90 degrees — far enough apart to tell across the room, close enough that
       the wall still reads as one identity, and the second hue trails the first
       by a fixed interval so every Popit keeps the same internal relationship. */
    '.ow-cv-t{--po-shift:0;',
    '  --po-h1:calc(var(--po-h) + var(--po-shift));',
    '  --po-h2:calc(var(--po-h) + var(--po-shift) + 22)}',
    '.ow-cv-t[data-po="now"]{--po-shift:0}',
    '.ow-cv-t[data-po="next"]{--po-shift:5}',
    '.ow-cv-t[data-po="calendar"]{--po-shift:5}',
    '.ow-cv-t[data-po="world"]{--po-shift:10}',
    '.ow-cv-t[data-po="said"]{--po-shift:15}',
    '.ow-cv-t[data-po="links"]{--po-shift:20}',
    '.ow-cv-t[data-po="since"]{--po-shift:24}',
    '.ow-cv-t[data-po="colours"]{--po-shift:28}',
    '.ow-cv-t[data-po="visited"]{--po-shift:8}',
    '.ow-cv-t[data-po="marks"]{--po-shift:18}',
    '.ow-cv-t[data-po="guestbook"]{--po-shift:13}',
    '.ow-cv-t[data-po="count"]{--po-shift:22}',
    '.ow-cv-t[data-po="favourite"]{--po-shift:26}',
    '.ow-cv-t[data-po="rhythm"]{--po-shift:3}',
    /* ── IT BREATHES BY MOVING, NOT BY CHANGING COLOUR ─────────────────
       This was `ow-po-live`, a 26s `hue-rotate(±7deg) saturate(±.06)` on the
       FACE — so every tile slowly recoloured everything inside it: its text,
       its clock dial, its avatars. A Post never does that, and a filter on a
       parent is not a mood, it is a lens over the content.

       The platform already has its own idea of a living Popit and it is
       movement: `ow-bob`, driven by the `--bobD/--bobX/--bobY` that each of
       the six variants already sets — the same variants this tile now wears.
       So a Popit drifts a pixel or two on its own period, like the `.po`
       widgets always have, and nothing it contains changes colour. */
    /* `ow-bob` ends in `scale(var(--sc))` with NO fallback — a `.po` always
       has one, a tile does not, and `scale()` with an empty value invalidates
       the whole transform rather than ignoring one term. So the tile brings
       its own. */
    '.ow-cv-t .ow-cv-face{--sc:1;',
    '  font-size:calc(16px * var(--cv-type,1));',
    '  animation:ow-bob var(--bobD,7s) ease-in-out infinite;',
    '  will-change:transform}',
    '@media (prefers-reduced-motion:reduce){',
    '  .ow-cv-t .ow-cv-face{animation:none}}',
    /* ── THE PERIOD COMES FROM THE VARIANT, NOT FROM POSITION IN THE GRID ──
       These set 31s and 23s to stagger the old 26s colour breathe. Against
       `ow-bob` they fight the `--bobD` each variant already carries (6.4s to
       9.1s) — measured, a Home showed bob periods of 7.6s, 31s, 23s, 6.4s and
       7s, so half the tiles drifted at a quarter of the intended speed for no
       reason except being even-numbered.

       A Popit's period is a property of the Popit, like its radius and its
       seam angle, and it already has one. Position in a grid is not character;
       it changes when you rearrange. The delay is kept and made variant-shaped
       so two neighbours still do not swing in lockstep. */
    '.ow-cv-t[data-v="1"] .ow-cv-face{animation-delay:-1.4s}',
    '.ow-cv-t[data-v="2"] .ow-cv-face{animation-delay:-3.3s}',
    '.ow-cv-t[data-v="3"] .ow-cv-face{animation-delay:-2.1s}',
    '.ow-cv-t[data-v="4"] .ow-cv-face{animation-delay:-4.7s}',
    '.ow-cv-t[data-v="5"] .ow-cv-face{animation-delay:-0.8s}',
    '@keyframes ow-po-live{',
    '  0%{filter:hue-rotate(0deg) saturate(1)}',
    '  33%{filter:hue-rotate(7deg) saturate(1.06)}',
    '  66%{filter:hue-rotate(-5deg) saturate(.97)}',
    '  100%{filter:hue-rotate(0deg) saturate(1)}}',
    '@media (prefers-reduced-motion:reduce){',
    '  .ow-cv-t .ow-cv-face{animation:none}}',
    'html[data-fx="safe"] .ow-cv-t .ow-cv-face{animation:none}',
    /* ── THE FACE'S INK FOLLOWS THE THEME, AND IT WAS HARDCODED WHITE ───
       ★ FOUND BY `tools/probe/contrast.js`, 2026-09-09: five text runs on the
       canvas failed AA in LIGHT theme, four of them at ratios between 1.41 and
       1.48 — white on a light lavender tile, which is very close to invisible.

           SEP                       1.41 : 1     need 4.5
           Boardwalk Beach Concert   1.43 : 1
           12                        1.44 : 1
           up from 0 · busiest Wed   1.48 : 1

       In light theme a person could not read their own Countdown's date or its
       title. Dark passed 0/33 and system passed 0/33, which is exactly why it
       survived: everyone building this is sitting in dark, and the file's own
       theme note already records that failure mode — *"neither is visible to
       whoever writes it, because they are sitting in the mode that looks
       right."*

       THE TOKEN EXISTS AND MOST OF THE FILE ALREADY USES IT. `--ow-ink` is
       #fff on dark and #14131f on light, and the Count's own number reads
       correctly at rgb(20,19,31) because it asks for it by name. The FACE set
       `color:#fff` literally and every child that merely inherits — the
       medallion, the title, the rhythm's sentence — inherited a colour that is
       right in one theme only.

       This is the ink-literal defect `tools/probe/ink-literals.cjs` exists to
       catch, in the one place it matters most: the container everything else
       inherits from. */
    '.ow-cv-face{width:100%;height:100%;position:relative;border:0;',
    '  color:var(--ow-ink,#fff);font:inherit;display:flex;align-items:center;',
    /* ★ PADDING IS PROPORTIONAL, BECAUSE A FIXED INSET EATS A SMALL TILE.
       Founder, 2026-08-30: *"they cannot appear broken when resized or
       stretched."*

       At 16px/18px a narrow Popit spent most of itself on margin: measured on a
       80px-wide tile, 36px of padding left 44px of content and the time string
       needed 55 — so the clock clipped at its own minimum font size, with room
       sitting unused on both sides. Every remaining breakage in the sweep was
       this one declaration.

       `cqw` makes the inset a proportion of the tile, so a large Popit keeps
       exactly the generous 16/18 it was designed with and a small one gives its
       space to its contents instead of its margins. */
    /* ── CONTENT CLEARS THE STITCHING BY THE PLATFORM'S OWN GAP ─────────
       A Post's content sits 14px inside its card, and that number is not a
       number: it is `--po-seam` (4px) plus `--po-gap` (10px) — the thread, then
       the breathing room the whole design system uses inside one.

       This was `clamp(6px,4cqw,16px) clamp(7px,5cqw,18px)`, which measured 9px
       top and 12px left on a real tile: the content crowded its own dashed seam
       by five pixels, and did it asymmetrically, so a Popit sat tighter and
       lopsided next to a Post that breathes evenly.

       Now it is the same expression, so if either token moves the Post and the
       Popit move together. The clamp is kept for the container-relative growth
       a tile needs and a card does not — a Popit is sized by its owner and a
       card is not — but its FLOOR is the Post's inset rather than an
       independently chosen small number. */
    '  padding:clamp(calc(var(--po-seam,4px) + var(--po-gap,10px)),4cqw,18px);',
    '  text-align:left;cursor:pointer;overflow:hidden;',
    '  border-radius:var(--po-r,26px 23px 25px 22px / 24px 26px 22px 25px);',
    /* GLOSS IS REFLECTED LIGHT; A HOLOGRAM EMITS ITS OWN.
       The candy pass put a wet specular highlight along the top and two hard
       white catchlights on the body — that is a shiny plastic surface bouncing
       a light source back at you, and it is exactly what read as "too glossy".
       A projected image has no specular at all: it is evenly luminous, brighter
       toward its core, and it falls off at the edges instead of catching a
       rim. So the highlights are gone and the light now comes from INSIDE. */
    /* ── THE SAME MATERIAL THE FEED CARD IS MADE OF ────────────────────
       ★ FOUNDER, 2026-08-26: *"I need popit widgets looking more like posts
         do right now cause that's perfect, and need them to start resembling
         real iOS-like widgets."*

       The card and the Popit were built the opposite way round, and that is
       the whole difference. `.po-card__face` lays the person's hue over a DARK
       PANEL as light — .46 and .20 alpha above `--ow-panel-1/2`. This laid
       down saturated hue at 88-96%% saturation and .86-.96 alpha with no panel
       underneath at all, so there was nothing for the light to fall on: a
       solid colour slab with text washed out on top of it. That is the
       'tinted rectangle' §16.3 forbids, and it is why a wall of them read as
       one colour repeated while the feed below looked finished.

       So the composition is now the card's, expressed in the angle system
       this canvas already uses: panel first, hue as light on top, the same
       `--ow-lift`/`--ow-weight`/`--ow-rim`/`--ow-drop` tokens the card uses.
       One material family, one set of tokens — not a second look that happens
       to resemble the first (§16.7: evolve, never redesign).

       THE LAW IT RESTORES: light, not glass. The hue lights the information;
       it does not tint a rectangle. */
    /* ── EXACTLY THE POST'S MATERIAL, RE-MEASURED ─────────────────────────
       ★ FOUNDER: *"the popits need to be designed around EXACTLY the material
         of the posts."*

       The first attempt copied `.po-card[data-blended]`, which is no longer the
       rule that paints a Post. The live one is `.ow-fpos .po-card` and it is a
       far LIGHTER touch: two hue washes over a near-transparent white film —
       `rgba(255,255,255,.058)` — with a 1px hue rim and a hairline top light.
       No opaque panel, no big outer glow.

       That difference is the whole reason the Popits read as heavy while the
       Posts read as finished: an opaque body under a hue wash is a slab, and a
       film over the world is a widget. Copied declaration for declaration,
       including the light and system-dark variants, so the two cannot diverge
       again without both changing. Measured 2026-08-30. */
    /* ── THE MATERIAL IS NOT HERE ANY MORE ─────────────────────────────
       ★ FOUNDER, 2026-09-03: *"not exactly like posts and everything in it
         needs to look NATURAL."*

       The recipe that stood here was copied from `.ow-fpos .po-card` on
       2026-08-30 — Scroll's override — which A then measured as the file's one
       divergence from canonical Post material. So a Popit was painted to match
       the single rule that is not a Post.

       It now shares `.po-card__face`'s material, written once in
       `oneway-popit.css` beside the Post's own. Nothing paints a Popit here,
       and the light and system-dark variants go with it — they were variants
       of the wrong material, and the shared one carries its own. */
    '  transition:transform .18s cubic-bezier(.2,.9,.3,1.2),box-shadow .28s ease}',
    /* the system-dark variant of the old material goes with it — a media
       query is a stronger place in the cascade than the rule it varied, so
       leaving it here would have kept repainting the Popit in the material
       everything else had just stopped using. Measured: the grain arrived and
       the wash did not, because THIS was still winning. */
    /* ── NO BLACK DROP. The comment here used to say "the tile carries the
       drop, exactly as the card does" — and the card's `filter` is `none`.
       A Post carries its drop INSIDE its material, as
       `0 16px 40px -14px var(--ow-drop)` alongside the hue glow, which the
       shared material now gives this tile too. So the tile was wearing BOTH,
       and the extra one was flat black.

       ★ A, 2026-09-02: *"A black drop shadow is the tell that something is not
         made of Post."*  Measured on this surface: tile
         `filter: drop-shadow(rgba(0,0,0,.55) 0 22px 40px)`, Post `none`.

       Dropping the filter also un-does a side effect nobody asked for: a
       `filter` makes an element a containing block, so every tile was one —
       which is a strange thing for a drag transform and a jiggle to live
       inside. */
    /* the stitched thread — inherits the hand-cut edge, no filter, ships everywhere */
    /* the seam — the card's own thread and inset, so the two belong */
    /* the seam — the card's own thread, inset and wander */
    /* ★ THE SEAM IS BACK, AND IT IS THE POST'S OWN — MEASURED, NOT REMEMBERED.
       ★ FOUNDER, 2026-08-30: *"Re-add the dotted lines. The dotted boundary is
         part of the material and was deliberately established."* and
         *"Compare the widget directly against an actual Post in the browser
         rather than approximating it from memory."*

       I REMOVED THIS ON A MISREADING and the founder has corrected it. His
       earlier note — *"the sitiching dotted lines left"* — I took as "these
       were left in, take them out". It meant the opposite. The boundary is
       canon; what was wrong was elsewhere.

       SO THESE NUMBERS ARE READ OFF A LIVE POST, not recalled:

         .po-card__face::before
           border   1.5px dashed rgba(255,255,255,.24)   (--ow-seam)
           inset    4px          <- the canvas had been using 9px
           radius   inherit      (the hand-cut 22/19/23/20 family)
           rotate   0.35deg

       The inset is the part that mattered: at 9px the ring floated well inside
       the card and read as a selection artifact rather than as the card's own
       stitching — which is exactly the "drop-target-looking" failure the
       founder warned against. At 4px it sits where a Post's does.

       It is under the content (`z-index:1`, and the readout is z-index 2), so
       it can never cross a word. */
    /* ★ FOUNDER/437 (2026-09-19): the lines around Popits are gone, for
       mainstreamability. The seam rule stays declared so every `--po-seam`
       and `--seam` a tile sets still has somewhere to land; it just does
       not draw. Same in oneway-popit.css for the Post and the sheet. */
    '.ow-cv-face::before{content:"";position:absolute;inset:var(--po-seam,4px);',
    '  z-index:1;border-radius:inherit;pointer-events:none;',
    '  border:1.5px dashed var(--ow-seam,rgba(255,255,255,.24));',
    '  transform:rotate(var(--seam,.35deg));display:none}',
    /* ── RESTORED 2026-08-30 AFTER I DELETED THEM MYSELF ───────────────────
       These two blocks were collateral: a region-replace that put the dotted
       seam back spanned further than intended and took the glyph-collision fix
       and the blurb rules with it. Symptom on screen was immediate — the Count
       Popit's description wrapped into its own icon and was cut. Noting it
       because a silent re-deletion is the kind of thing that gets rediscovered
       as "a regression" a week later.

       ★ THE MARK AND THE WORDS CANNOT OCCUPY THE SAME PIXELS. The glyph is
       absolutely positioned in the top-right, so the text column has no idea it
       is there. The column is inset by exactly the space the mark occupies, and
       below the width where both fit the MARK goes rather than the words —
       the words are what say which Popit this is. */
    '.ow-cv-face--po .ow-gl{position:absolute;top:clamp(calc(8px * var(--cv-type,1)),4cqw,14px);',
    '  right:clamp(8px,4cqw,14px);',
    '  width:clamp(17px,5cqw,22px);opacity:.85;z-index:3}',
    '.ow-cv-face--po .ow-cv-read{gap:2px;',
    '  padding-right:calc(clamp(17px,5cqw,22px) + clamp(8px,4cqw,14px) + 6px)}',
    '@container (max-width:132px){',
    '  .ow-cv-face--po .ow-gl{display:none}',
    '  .ow-cv-face--po .ow-cv-read{padding-right:0}',
    '}',
    /* ★ A DESCRIPTION IS SHOWN WHOLE, OR NOT AT ALL.
       ★ FOUNDER, 2026-08-30: *"i dont want to see any cut out or ... text
         anywhere."* A clamped sentence ending in an ellipsis tells the person
       there is something they cannot read, which is worse than the platform
       not saying it here. Below the size where the whole thing fits, the NAME
       carries the Popit alone — density, which is the founder's own rule for
       running out of room. */
    /* ── A POPIT'S NAME IS A TITLE, AND IT HAD NO TYPOGRAPHY AT ALL ─────
       ★ FOUNDER, 2026-09-03: *"everything in it needs to look NATURAL."*

       `.ow-cv-name` appeared only in the markup — there was no rule for it
       anywhere in this file or the stylesheet. Measured: 16px, weight 400,
       line-height `normal`, in the body font. Those are the BROWSER'S
       defaults, not a decision: the identity line of every Popit on the
       platform was unstyled text.

       A Post's title is `.po-card__t` — the display face, weight 800, tracking
       -.02em, line-height 1.16 — and that is what an object's name looks like
       here. The Popit takes the same treatment, sized for a tile rather than a
       card, so a name reads as a name on both. Same tracking, same weight,
       same family; only the scale differs, because a tile is not a card. */
    '.ow-cv-name{font-family:var(--ow-font-display);font-weight:650;',
    '  font-size:clamp(13px,4.6cqw,17px);letter-spacing:-.02em;',
    '  line-height:1.16;color:var(--ow-ink,#fff);display:block;',
    '  overflow-wrap:normal;word-break:normal}',
    /* and the sentence under it is the Post's own sub-line treatment */
    '.ow-cv-blurb{font-size:clamp(9.5px,3cqw,11px);line-height:1.3;',
    '  color:var(--ow-ink-3,rgba(255,255,255,.45));max-width:24ch;',
    '  overflow:visible;overflow-wrap:normal;word-break:normal}',
    '@container (max-width:150px){.ow-cv-blurb{display:none}}',
    '@container (max-height:104px){.ow-cv-blurb{display:none}}',
    /* ── A BLOCK, NOT A FLEX COLUMN, AND THAT IS A CORRECTION ───────────
       ★ MEASURED 2026-09-12, by reading the COMPUTED display of the quote and
         not the stylesheet that sets it: `.ow-cv-detail` declares
         `display:-webkit-box` so `-webkit-line-clamp` can cut it at a line
         boundary with an ellipsis. As a FLEX ITEM the browser blockifies that
         to `flow-root`, and a `-webkit-box` that is not a `-webkit-box` has no
         line clamp at all. The declaration was correct, inert, and had been
         inert for however long this body has been a flex container — the
         Guestbook quote was hard-cut mid-word, "the organ can", with no
         ellipsis and nothing saying so.

       THE SECOND HALF IS WORSE AND IS THE SAME CAUSE. A flex column SHRINKS
       its children to fit rather than overflowing: measured on a real tile,
       the headline asked for 35px and was given 28, the caption asked for 15
       and got 13. Both were sliced through the middle of the glyphs, and
       neither showed as a defect to `clipped.js` — every rectangle still sat
       inside the face, because the boxes had been made smaller rather than
       pushed out. A layout that hides its overage by quietly crushing type is
       invisible to a probe that looks for overflow, which is why this was
       found in a screenshot.

       A BLOCK DOES NEITHER. Children take the height they need, the clamp on
       the quote is live again and ends in a real ellipsis, and anything that
       still does not fit OVERFLOWS — where the face clips it and the probe
       reports it. The gap is a margin; that is all flex was providing. */
    '.ow-cv-body{display:block;min-width:0}',
    '.ow-cv-body > * + *{margin-top:2px}',
    /* ── MATERIAL AND INK ARE ONE THING ────────────────────────────────
       ★ FOUNDER, 2026-09-04, on the Post glow: *"Fix the shared rendering
         contract if that's where the discrepancy originates. Don't make a
         Popit-specific approximation."*

       These six rules were written as literal whites — #fff, rgba(255,255,255,
       .82), .66, .62, .6, .5 — which are exactly the dark-theme values of
       --ow-ink, --ow-ink-2 and --ow-ink-3. Correct, and invisibly so, for as
       long as this face was dark.

       Then I gave .ow-cv-face the Post material so a Popit would carry the
       Post's visual identity. In light mode that material is a LIGHT panel,
       and six frozen whites became white-on-white: the Said tile rendered
       "SAID / Nothing right now" at a measured contrast of 1.1:1.

       The lesson is not "add a light override". It is that adopting a
       material obliges you to adopt its ink. The Post inks its own name with
       var(--ow-ink) (oneway-popit.css, .po-card__nm); a surface wearing the
       Post's material inks itself the same way or it has only copied half a
       contract. The tokens already flip per theme — nothing new is needed.

       The bare .ow-cv-sig / .ow-cv-detail further down stay literal white with
       a dark halo ON PURPOSE. They ink an image-backed face, where the ground
       is a photograph in both themes and white is right in both. */
    '.ow-cv-face--po .ow-cv-kind{font-size:clamp(calc(10px * var(--cv-type,1)),2.6cqw,11.5px);font-weight:600;',
    '  letter-spacing:.01em;',
    '  color:var(--ow-ink-3);margin:0 0 auto}',
    /* the value carries the tile */
    '.ow-cv-face--po .ow-cv-sig{font-size:clamp(calc(21px * var(--cv-type,1)),7.2cqw,40px);font-weight:600;',
    /* ── A NAME TOO LONG FOR ITS TILE IS SET SMALLER, NOT SNAPPED ────────
       ★ MEASURED 2026-09-12 on a signed-in Home at phone width: a Following
         tile 115px wide, a content column 87px wide, and "Boardwalk" set at
         the 21px floor of this ramp measuring 101px. The word cannot fit on a
         line, so it ran past the face and was clipped by it.

       I FIXED THAT WITH `break-word` FIRST AND THE SCREENSHOT SETTLED IT:
       the tile then read "Boardwa / lk / Arcade", three lines with a word
       snapped in the middle, and that is worse than the hairline it cured. A
       probe finding cured by making the tile uglier is not a fix.

       SO THE TYPE SHRINKS TO THE NAME, which is what a home screen has always
       done and what `fitType` below now does by measurement. The ramp here is
       the IDEAL; that pass is the floor. `block` so it has a width to measure
       against — an inline span reports none — and `is-tight` is the last
       resort for a word that will not fit even at the smallest step. */
    '  display:block;',
    '  letter-spacing:-.03em;line-height:1.02;color:var(--ow-ink);',
    /* the bare .ow-cv-sig above sets `text-shadow:0 1px 12px rgba(0,0,0,.55)`
       to lift white type off a photo. A panel is not a photo: on the light
       material that halo is a smudge under dark ink. Reset it here. */
    '  text-shadow:none;margin-top:2px}',
    '.ow-cv-face--po .ow-cv-detail{font-size:clamp(calc(12px * var(--cv-type,1)),3cqw,14px);line-height:1.3;',
    '  color:var(--ow-ink-2);text-shadow:none;margin-top:3px;',
    /* ── WHOLE WORDS, AND A BOUNDED NUMBER OF LINES ────────────────────────
       The first half of this is an existing correction and it stays: whole
       words, wrapped, never a cut sentence — measured under one plane, where
       "Nothing right now" became "Nothing right n…" in a 152px Said. Cutting a
       short phrase mid-word to fit a box is the wrong trade.

       BUT `overflow:visible` MEANT A LONG BODY LEFT THE TILE ENTIRELY.
       Found by `tools/probe/clipped.js` on a real profile, 2026-09-09: a
       Guestbook tile with 86px of content hidden below its own face — an entry
       reading "The organ came back after eleven years…" running past the
       bottom edge and hard-clipped by the face, with nothing saying so. The
       fix for the short phrase had made the long one worse.

       `-webkit-line-clamp` cuts at a LINE boundary, not a character: whole
       words survive, "Nothing right now" at two lines is untouched, and a long
       entry ends with an ellipsis — which by this lane's own rule IS the
       announcement, in the only vocabulary one line has. Both corrections hold
       at once.

       THE LADDER IS THE TILE'S OWN. Three lines at the default, six when the
       tile is large enough to have earned them — size is projection depth, and
       a bigger Popit says more of the same thing rather than something else. */
    '  white-space:normal;text-overflow:clip;',
    '  display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;',
    '  -webkit-line-clamp:var(--po-lines,3)}',
    '.ow-cv-t[data-size="lg"] .ow-cv-face--po .ow-cv-detail{--po-lines:6}',
    '.ow-cv-t[data-size="sm"] .ow-cv-face--po .ow-cv-detail{--po-lines:2}',
    '.ow-cv-face--po .ow-cv-sub{font-size:calc(12px * var(--cv-type,1));color:var(--ow-ink-3)}',
    /* the second half of an empty tile's reading — quieter than the absence
       above it, and inside the detail so it survives everywhere the detail
       does rather than being dropped with the caption on a phone */
    '.ow-cv-will{display:block;font-weight:inherit;color:var(--ow-ink-3);',
    '  margin-top:3px}',
    /* AND THE CLAMP HAS TO LET IT FINISH. The ladder is three lines at `md`,
       written for a reading that has a hero above it — an absence tile has no
       hero and nothing else to hold, so the same three lines cut the
       invitation to "Places near..." on the tile that had 90px of empty
       material under it. A quiet tile spends its lines here or nowhere. */
    '.ow-cv-face--po.is-quiet .ow-cv-detail{--po-lines:6}',
    /* ── THE QUIET GAP THAT WAS NEVER DRAWN ──────────────────────────────
       ★ MEASURED 2026-09-12 on a real Centre's public face: NINE blank
         Popits. Not empty states — blank. Full material, full glow, full
         dashed seam, 150px each, and `textContent` of "".

       Two branches above hand a visitor a voided tile: a RETIRED placement,
       and one whose Popit cannot answer for a place. Both set `data-void` and
       return a face with nothing in it, and the comment on the second says
       what that was meant to look like — *"a quiet gap where a Popit that
       does not belong here is waiting to be moved."*

       THERE WAS NO RULE FOR IT. Not for `data-void`, not for the `is-void` the
       comment names; the attribute was written and nothing anywhere read it.
       So the tile that was supposed to be a gap was drawn as a lit, empty
       rectangle — which is worse than either showing the notice or removing
       the placement, because it reads as a Popit that failed to load.

       `visibility:hidden` rather than `display:none`: the placement keeps its
       cells, so the owner and the visitor see the same arrangement with the
       same geometry, and it leaves the tab order as well as the plane. */
    '.ow-cv-t[data-void]{visibility:hidden;pointer-events:none}',
    /* ── THE LIST A LARGE FOOTPRINT HOLDS ───────────────────────────────
       Rows, not a paragraph: a name and its note on one line each, the note
       quiet and shortened rather than wrapping. A wrapped row would make four
       items into seven lines and the list would stop being scannable, which is
       the only thing a list is for. */
    /* under the medallion front, the list spans the whole tile rather than
       sitting in the text column beside it */
    '.ow-cv-rows--under{position:relative;z-index:2;width:100%;',
    '  margin-top:6px;flex:0 0 auto}',
    '.ow-cv-face--po.has-front{flex-wrap:wrap;align-content:stretch}',
    /* ── THE FRONT STOPS GROWING WHEN THERE IS A LIST UNDER IT ──────────
       ★ MEASURED 2026-09-12: an Events front is 122px tall inside a 122px
         face. Not because it needs 122 — the medallion is 78 and the column
         beside it is 41 — but because `.ow-po{height:100%}` asks for the lot
         and a flex row gives it. So the list underneath could never fit on
         ANY footprint, and Events at large drew exactly what Events at wide
         draws. Large was more air around the same one event.

       This is the content rule for this kind, in one declaration: the front
       takes what it needs and the height it was not using becomes the agenda
       after it. `flex:1 0 100%` keeps it on its own line so the list wraps
       UNDER it rather than squeezing in beside the medallion. */
    /* THE LABEL SITS IN A COLUMN WITH THE FRONT, which is the structure every
       other reading already uses — `.ow-cv-read` is a column of kind then
       body, and an Events front is a body like any other. Inventing a second
       arrangement for one kind is how a shelf stops looking like one shelf.

       `height:100%` ON `.ow-po` WAS THE TROUBLEMAKER, twice. It asks for the
       whole face, a flex row gives it, and anything else on the tile — a
       label above, a list below — is then pushed out of a box that is already
       full. It becomes `flex:1 1 auto` inside the column: it takes what is
       LEFT and centres the medallion in it, which is what it was always
       trying to express.

       ONE LINE STRETCHES, TWO LINES DO NOT — that is `align-content` doing
       the work rather than a height. With no list the column is the only line
       and fills the tile; with a list the column takes its natural height at
       the top and the agenda sits on the bottom edge. */
    '.ow-cv-read--front{flex:1 0 100%;min-width:0;min-height:0}',
    '.ow-cv-read--front .ow-po{height:auto;flex:1 1 auto;min-height:0}',
    /* ── A LARGE TRADES PARAGRAPH FOR LIST ───────────────────────────────
       The quote is clamped harder the moment there are rows under it. That is
       the content rule for a large footprint stated as a design decision
       rather than as a fallback: two lines of the newest signature AND three
       names under it says more about a wall than four lines of one signature
       does, and the clamp's ellipsis is itself the announcement that the quote
       goes on — which is exactly why the probe does not count one. */
    '.ow-cv-face--po.has-list .ow-cv-detail{--po-lines:2}',
    /* ── AND THE HERO STEPS DOWN ─────────────────────────────────────────
       The other half of the same trade, and the half that actually creates
       the room: measured on a 432x154 tile, the reading alone is 104px of a
       126px content box, and 35 of those 104 are the headline. Clamping the
       quote frees 17px and one row needs 21 — so without this the list can
       never appear on the footprint it was designed for, which is precisely
       what "large renders the same reading with more whitespace" meant.

       A LIST IS A SECOND VOICE and the first one stops shouting over it. The
       name is still the loudest thing on the tile; it is no longer the ONLY
       thing on it. This is the content rule for a large stated in type: not
       more air around one fact, but one fact and then the ones after it. */
    '.ow-cv-face--po.has-list .ow-cv-sig{font-size:clamp(calc(17px * var(--cv-type,1)),4.6cqw,26px)}',
    '.ow-cv-face--po .ow-cv-sig.is-tight{overflow-wrap:break-word}',
    /* ── A ROW NEEDS WIDTH, AND HEIGHT ALONE WAS THE WRONG GATE ──────────
       ★ MEASURED 2026-09-12 in a 285px pane: the same large placement that
         reads "Feed Continuity Center — September 8, 2026" on a desktop
         renders "Feed C... Septe..." on a phone, and "loop.bo" becomes "lo...".
         Two ellipsised fragments on one line are not a shortened row, they are
         a row that has stopped being a row.

       So the gate is a container query, not a grid count. Under 260px the note
       goes and the names stand alone — the same list, one field deep, which is
       the projection rule applied sideways. Under 200px the list goes
       entirely: the tile is holding a name and a quote already, and a third
       thing at that width is a texture rather than a reading. */
    /* the agenda sits on the BOTTOM edge under a front that keeps its centre,
       rather than leaving a hole between them */
    '.ow-cv-face--po.has-front.has-list{align-content:space-between}',
    '.ow-cv-rows{display:flex;flex-direction:column;gap:2px;margin-top:7px;',
    '  min-height:0;overflow:hidden}',
    '.ow-cv-row{display:flex;align-items:baseline;gap:8px;min-width:0;',
    '  font-size:clamp(11px,2.9cqw,13px);line-height:1.35}',
    '.ow-cv-row b{font-weight:560;color:var(--ow-ink);white-space:nowrap;',
    '  overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}',
    '.ow-cv-row i{font-style:normal;color:var(--ow-ink-3);white-space:nowrap;',
    '  overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;text-align:right}',
    /* ── AND IT IS NOT A HEADLINE, SO IT DOES NOT TAKE THE HUE ──────────
       ★ MEASURED 2026-09-12 by tools/probe/contrast.js in dark: "AND 2 MORE"
         at 4.43:1 against a hue-tinted panel, where small text needs 4.5.
         `--ow-h1-ink` is the legible-on-ground form of the accent and it is
         STILL marginal here, because the panel ground under a Popit is
         lighter than the page ground the token's lightness floor was set
         against. A token that is nearly legible is a token being used for the
         wrong job.

       A remainder is a quiet fact, not an accent — the form already marks it
       out, 9px uppercase with letter-spacing, and it needs contrast far more
       than it needs colour. Measured after: passes in both themes. */
    /* ── THE FACE ─────────────────────────────────────────────────────────
       ★ FOUNDER, 2026-09-13: *"things like an online popit and boardwalk
         arcade should have user and profile picture."*

       Round for a person, the Centre's own soft square for a place — the same
       distinction the thread rows already draw, so a face means the same thing
       wherever it appears. Lit by `--av-h`, the subject's OWN hue, falling back
       to the surface pair when they have not chosen one.

       THE INITIAL IS UNDER THE PICTURE, not instead of it: the letter is laid
       out first and the image covers it, so a slow or broken load degrades to
       something that still identifies the person rather than to a hole. */
    '.ow-cv-av{--av-c:rgb(var(--ow-h1));position:relative;flex:none;',
    '  display:grid;place-items:center;',
    '  width:clamp(26px,22cqmin,54px);aspect-ratio:1;border-radius:50%;',
    '  overflow:hidden;font-family:var(--ow-font-display);font-weight:650;',
    '  font-size:clamp(11px,9cqmin,22px);color:#fff;line-height:1;',
    '  background:linear-gradient(150deg,var(--av-c),',
    '    color-mix(in oklab,var(--av-c) 45%,#14131f));',
    /* no glow on a face (founder/471 §5) — the top light only where initials are */
    '  box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}',
    '.ow-cv-av i{font-style:normal;position:relative;z-index:0}',
    '.ow-cv-av img{position:absolute;inset:0;width:100%;height:100%;',
    '  object-fit:cover;z-index:1}',
    /* a place is not a person — the same soft square a Centre wears elsewhere */
    '.ow-cv-av--round{border-radius:50%}',
    '.ow-cv-av--rounded{border-radius:32% 28% 34% 30%}',
    '.ow-cv-av--square{border-radius:16%}',
    '.ow-cv-av--center{border-radius:30% 26% 32% 28%}',
    /* ── A FACE BESIDE A NAME NEEDS WIDTH TO SIT BESIDE IT ───────────────
       ★ MEASURED 2026-09-13: a Places tile 133px wide, a 29px face and a gap
         left 67px for the reading, and "Atlantic City" came out "Atlan / tic /
         City" — broken mid-word, twice. The face did not make the tile worse
         by being there; it made it worse by standing NEXT to the thing it
         belongs to on a square that has no width to spare.

       So the row is only a row when there is room for one. Below 200px the
       face sits ABOVE the name — which is what a contact widget does, and what
       the tile was always shaped for: a square wants a column. The face grows
       a little when it leads, because at the top of a square it is the first
       thing read rather than a marker beside the words. */
    '.ow-cv-face--po.has-face{gap:clamp(calc(8px * var(--cv-type,1)),4cqw,16px)}',
    '.ow-cv-face--po.has-face .ow-cv-read{min-width:0;flex:1 1 auto}',
    '@container (max-width:200px){',
    /* ── AND THE INSTRUMENT IS THE SAME OBJECT IN THE SAME SLOT ──────────
       The moment `.ow-in` stopped being 0x0 it started competing for width
       exactly as the face does, and a Location tile answered "Atlanti / c
       City". One rule for both, because on this shelf a face and an
       instrument are the same thing: the mark that leads a reading. */
    '  .ow-cv-face--po.has-face,.ow-cv-face--po.has-in{flex-direction:column;',
    '    align-items:flex-start;gap:clamp(6px,3cqh,12px)}',
    '  .ow-cv-face--po.has-in .ow-in{width:clamp(calc(24px * var(--cv-type,1)),20cqmin,44px)}',
    '  .ow-cv-face--po.has-in .ow-cv-read{flex:0 1 auto;width:100%}',
      /* SMALLER WHEN IT LEADS A COLUMN, NOT BIGGER. My first pass grew it to
       30cqmin on the theory that a face at the top of a square is the first
       thing read — and it pushed the tile 5px past its own edge, because the
       column now pays for the face in HEIGHT where the row paid in width.
       22cqmin is the same size the row uses, and the stack fits with room. */
    '  .ow-cv-face--po.has-face .ow-cv-av{width:clamp(calc(26px * var(--cv-type,1)),22cqmin,48px)}',
    '  .ow-cv-face--po.has-face .ow-cv-read{flex:0 1 auto;width:100%}',
    '}',
    /* ── AND A WIDE SHORT TILE IS NOT A SQUARE ──────────────────────────
       ★ FOUNDER: *"they just dont have perfect perportions."*

       The rule above stacks the mark above the name below 200px, and it is
       right for the tile it was written against — a SQUARE with no width to
       spare, where "Atlantic City" broke mid-word. It matches on width alone,
       so it also caught the wide footprint: a 6x3 Now at 160x74 got a column,
       which spends the one dimension that tile has least of. The mark then
       had to shrink to its floor to leave room for two lines underneath, and
       the floor is what made the picture eleven pixels.

       A short container gets its row back, and the mark is sized from HEIGHT
       there — the dimension that is actually scarce — so it grows with the
       tile instead of sitting on a floor. Ordered after the block above so it
       wins for a container that is both narrow and short. */
    /* A SHORT TILE, NOT A SMALL ONE. This query is for the one-row bar —
       a wide, short tile that lays its face beside its words. At a narrow
       plane (290px, the founder's own pane) a 2×2 SQUARE is 116px tall and
       fell into it, so a square Popit drew a bar's 52px face across half of
       itself. The aspect ratio says which it is. */
    '@container (max-height:120px) and (min-aspect-ratio:7/4){',
    '  .ow-cv-face--po.has-face,.ow-cv-face--po.has-in{flex-direction:row;',
    '    align-items:center;gap:clamp(7px,5cqh,13px)}',
    '  .ow-cv-face--po.has-in .ow-in{width:clamp(calc(30px * var(--cv-type,1)),52cqh,58px)}',
    '  .ow-cv-face--po.has-face .ow-cv-av{width:clamp(calc(28px * var(--cv-type,1)),46cqh,52px)}',
    '  .ow-cv-face--po.has-face .ow-cv-read,',
    '  .ow-cv-face--po.has-in .ow-cv-read{flex:1 1 auto;width:auto;min-width:0}',
    '}',
    /* inside the presence ring, the face IS the core — and at 46% it was not.
       ★ FOUNDER, 2026-09-13: *"SAME PFP AS USER SIGNED IN ON DISPLAY."*
       MEASURED: the ring floors at 24px on a wide tile, so the person's
       picture rendered at 46% of that — ELEVEN PIXELS SQUARE, a 150x150 image
       shown smaller than a favicon. The comment claimed the face was the core
       while the number made it a dot with a halo around it.
       72% is the proportion every product that puts a status ring on a person
       uses: the picture is the subject and the ring is a stroke around it. */
    '.ow-cv-av--core{position:absolute;left:50%;top:50%;',
    '  transform:translate(-50%,-50%);width:72%;box-shadow:none}',
    /* the small chip a list row carries */
    '.ow-cv-row__av{flex:none;display:inline-grid;place-items:center;',
    '  width:1.55em;height:1.55em;border-radius:50%;overflow:hidden;',
    '  font-style:normal;font-weight:650;font-size:.82em;color:#fff;',
    '  background-size:cover;background-position:center;',
    '  background-color:var(--av-c,rgb(var(--ow-h1)));margin-right:.15em}',
    '.ow-cv-row--more{font-family:var(--ow-font-atmos);font-weight:600;',
    '  font-size:12px;letter-spacing:.01em;',
    '  color:var(--ow-ink-2);margin-top:2px}',
    /* AFTER the rules they narrow, and that placement is the whole point:
       written above `.ow-cv-rows{display:flex}` these lost to it on source
       order at equal specificity and the list stayed visible at 125px while
       LOOKING like it had been gated. Measured, not assumed. */
    '@container (max-width:260px){.ow-cv-row i{display:none}',
    '  .ow-cv-row b{white-space:normal;overflow:visible;text-overflow:clip}}',
    '@container (max-width:150px){.ow-cv-rows{display:none}}',
    /* the label pins to the top, the value to the bottom — the whole surface is
       used, which is what makes a widget feel like a surface and not a card */
    /* ── PACKED LIKE A POST, NOT SPREAD ACROSS THE TILE ─────────────────
       ★ FOUNDER, 2026-09-03: *"everything in it needs to look NATURAL."*

       `space-between` was right when this held TWO things — a name at the top
       and a reading at the bottom. The named-absence line made it three, and
       `space-between` divides the leftover evenly between every gap: measured
       on an empty Colours, name at 0, blurb at 66, "NOTHING HERE YET" at 135 —
       51px and 57px of dead tile in the middle of a 157px column, with the
       three lines as far from each other as the box allowed.

       A Post packs its who and its body at the top and puts its foot at the
       base. A Popit now does the same: identity and sentence are one block,
       and the absence is a footnote sitting where a Post's foot sits. One
       quiet space at the bottom instead of two holes in the middle. */
    '.ow-cv-face--po .ow-cv-read{display:flex;flex-direction:column;height:100%;',
    '  justify-content:flex-start}',
    '.ow-cv-face--po .ow-cv-none{margin-top:auto}',
    '.ow-cv-t[data-size="sm"] .ow-cv-face--po .ow-cv-sig{font-size:clamp(calc(19px * var(--cv-type,1)),9cqw,26px)}',
    /* ── THE MARK WAS INVISIBLE IN LIGHT THEME ─────────────────────────
       ★ FOUND BY `tools/probe/ink-literals.cjs` — the source-reading probe,
       run for the first time right after the contrast probe caught the same
       class of defect in text. This is the version of it the contrast probe
       CANNOT see, because a glyph is an SVG and that probe measures text runs.

       MEASURED in light: the quiet mark computes `rgba(255,255,255,.4)` on a
       tile ground of rgb(222,212,230) — 1.43 : 1. Confirmed by looking: the
       MARKS tile in dark carries a small flag in its corner, and in light the
       corner is empty. Founder's rule is that everything has a mark and every
       kind declares a glyph; here it was declared and unseeable.

       LAW 16 STILL HOLDS — the mark is LIT, not drawn on a tinted plate. What
       changes is that its light follows the ground it is lit against, which is
       the same correction `.ow-cv-face` just took for its ink. A literal is
       only correct when the ground refuses the theme, and this ground does not.

       THE GLOW STAYS AS IT IS. `drop-shadow(0 0 14px rgba(255,255,255,.5))` is
       a white halo: it does its work on dark and is simply not seen on light,
       which costs nothing and is not wrong. The DARK shadow underneath is what
       gives the mark its edge on a pale tile, and it was already there. */
    '.ow-gl{flex:0 0 auto;display:grid;place-items:center;',
    '  width:clamp(32px,16cqw,60px);aspect-ratio:1;',
    '  color:var(--ow-ink,#fff);',
    '  filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))',
    '         drop-shadow(0 0 14px rgba(255,255,255,.5))}',
    '.ow-gl-svg{width:100%;height:100%}',
    /* quiet is a STATE, not a colour — it steps down the same ink rather than
       switching to a different one, so it cannot be right in one theme only */
    '.ow-cv-face--po.is-quiet .ow-gl{color:var(--ow-ink-3);filter:none}',

    /* ── THE EVENT POPIT HAD NO CSS AT ALL, AND SHIPPED THAT WAY ─────────
       ★ MEASURED 2026-09-07, in a browser, on a real Center's public face as
       an ANONYMOUS STRANGER: "SEP12Boardwa…" clipped mid-word, the month and
       day jammed together with no space, every element at the browser default
       16px, and a large black disc across the tile. The content overflowed its
       121x110 tile by 12px to the right and 11px below.

       The cause was not a broken rule. `frontNext` emits `.ow-po--next`,
       `.ow-po-col`, `.ow-med`, `.ow-med-svg`, `.ow-med-track`, `.ow-med-arc`,
       `.ow-med-mon`, `.ow-med-day` and `.ow-po-dot`, and NOT ONE OF THEM WAS
       DEFINED ANYWHERE IN THE REPOSITORY. The only `.ow-po*` rules that
       existed were the three size-ladder rules below — which clamp
       `.ow-po-title` and hide `.ow-po-line` at `sm`. A ladder that removes
       parts of a component nobody had drawn yet.

       So the black disc was the medallion's own SVG: a circle with no `fill`
       rule paints black, and the ring meant to say "how near this is" was a
       filled blob covering the tile.

       THE RULE THIS BREAKS IS THE ONE I WOULD HAVE SAID I FOLLOW: the ladder
       was written against class names, and class names are not a component.
       Nothing failed, nothing logged, the suites stayed green, and the
       distinction between "styled" and "named in a stylesheet" is invisible
       until somebody looks at it. Which is the whole argument for opening the
       page.

       THE DESIGN IS THE ONE `frontNext` ALREADY DESCRIBES, in its own words:
       "a date medallion large enough to be the object rather than an ornament
       beside the text: month above, day of the month as the face, and a ring
       wound to how near the Event actually is. Everything else is a clean
       column beside it." This draws that and invents nothing. */
    '.ow-po{display:flex;align-items:center;gap:clamp(8px,4cqw,16px);',
    '  height:100%;min-width:0;overflow:hidden}',

    /* THE MEDALLION IS THE OBJECT. It holds its square at every size, and the
       ring is drawn OVER nothing — the svg is a layer, not a background, so a
       theme change cannot leave a plate behind it. */
    '.ow-med{position:relative;flex:0 0 auto;display:flex;flex-direction:column;',
    '  align-items:center;justify-content:center;line-height:1;',
    '  width:clamp(30px,24cqw,78px);aspect-ratio:1}',
    '.ow-med-svg{position:absolute;inset:0;width:100%;height:100%}',
    /* FILL:NONE IS LOAD-BEARING — without it these circles paint solid black,
       which is exactly what shipped. */
    '.ow-med-track{fill:none;stroke:currentColor;stroke-width:5;opacity:.18}',
    '.ow-med-arc{fill:none;stroke:currentColor;stroke-width:5;',
    '  stroke-linecap:round;opacity:.85}',
    '.ow-med-mon{font-size:clamp(7px,3.4cqw,11px);letter-spacing:.1em;',
    '  opacity:.72;font-weight:600}',
    '.ow-med-day{font-size:clamp(15px,8.5cqw,30px);font-weight:650;',
    '  letter-spacing:-.02em}',

    /* MIN-WIDTH:0 IS THE OVERFLOW FIX AND IT IS NOT DEFENSIVE NOISE. A flex
       child will not shrink below its content's intrinsic width without it, so
       a long title pushed the column past the tile edge instead of ellipsing —
       the measured 12px. */
    '.ow-po-col{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;',
    '  justify-content:center;gap:clamp(1px,.8cqw,4px)}',
    /* A WORD IS NEVER SLICED. Measured at a 121px tile: the column was 47px,
       "Boardwalk" wanted 55px, `overflow-wrap:normal` cannot break it, and a
       clamp only ellipses VERTICAL overflow — so the title rendered as
       "Boardwa" with no ellipsis and no sign anything was missing. Cut text
       that does not admit it is cut is the defect this file's rung ladder
       exists to avoid, and I had reintroduced it in the rule meant to fix it.
       `anywhere` lets the word wrap, and the clamp then ellipses honestly.

       The medallion gives back the room rather than the title taking it: its
       floor was 38px, which is a third of a small tile spent on an ornament
       before a word is read. */
    '.ow-po-title{font-size:clamp(11px,5.4cqw,19px);font-weight:600;',
    '  line-height:1.15;display:-webkit-box;-webkit-box-orient:vertical;',
    '  -webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}',
    '.ow-po-line{font-size:clamp(9px,4cqw,14px);opacity:.78;line-height:1.3;',
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ow-po-line i{font-style:normal;opacity:.5;margin:0 .35em}',
    /* the state reads as the fact it is, not as decoration on a time.
       THEME-FOLLOWING GROUND, so theme-following ink: this sits on a Popit tile
       like the medallion and the title beside it, both of which were white
       literals until the contrast probe measured them at 1.41 and 1.43 in
       light. No fixture here has a CANCELLED event, so this one was never
       rendered for either probe to catch — fixed on the same reasoning rather
       than waiting for a person to find it. */
    '.ow-po-off b{color:var(--ow-ink);opacity:.95;letter-spacing:.02em}',
    '.ow-po-off{opacity:1}',
    /* the rhythm's words — quieter than the count above them, and hidden at the
       smallest rung where there is genuinely no room for a sentence */
    /* the person a status belongs to: their face, then their name */
    '.ow-cv-own__who{display:flex;align-items:center;gap:clamp(calc(6px * var(--cv-type,1)),3cqw,10px);',
    '  min-width:0;margin-bottom:clamp(3px,1.5cqh,7px)}',
    '.ow-cv-own__who .ow-cv-av{width:clamp(calc(22px * var(--cv-type,1)),16cqmin,40px)}',
    '.ow-cv-own__nm{font-family:var(--ow-font-display);font-weight:650;',
    '  font-size:clamp(12px,4.6cqw,17px);letter-spacing:-.01em;',
    '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
    '.ow-cv-own__sub{font-size:clamp(calc(9px * var(--cv-type,1)),3cqw,12px);opacity:.62;line-height:1.35;',
    '  margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ow-cv-t[data-size="sm"] .ow-cv-own__sub{display:none}',
    '.ow-po-foot{font-size:clamp(8px,3.4cqw,12px);opacity:.6;line-height:1.3;',
    '  display:flex;align-items:center;gap:.4em;',
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ow-po-foot--soft{opacity:.45}',
    '.ow-po-dot{flex:0 0 auto;width:.42em;height:.42em;border-radius:50%;',
    '  background:currentColor;opacity:.7}',

    /* ── THE OPENED EVENT — FIFTEEN MORE CLASSES NOBODY HAD DRAWN ────────
       Found by the same audit as the medallion, one layer deeper: every
       `.ow-ex*` class was emitted and styled nowhere. Measured by tapping a
       real Event Popit — the panel came back at the browser's defaults, its
       `<h2>` at 24px because that is what an unstyled h2 is, and its BACKDROP
       had no rules at all, so the "surface mounted over the App" was simply
       appended to the end of the body.

       FULL-SCREEN, NOT A MODAL. The repo standard is explicit — creation,
       warnings and every hub fill the viewport — and `expand()` already does
       the other half by adding `po-locked` to the body so the App recedes
       behind it. This only draws what that function always intended.

       IT WEARS THE POPIT'S OWN MATERIAL rather than inventing a panel: the
       same hue pair, the same hand-cut radius, the same dashed seam. Opening a
       Popit should feel like the Popit getting bigger, not like a dialog
       arriving from somewhere else. */
    '.ow-ex-back{position:fixed;inset:0;z-index:60;display:grid;',
    '  place-items:center;padding:max(16px,4vmin);overflow:auto;',
    '  background:rgba(8,7,18,.62);backdrop-filter:blur(14px) saturate(1.1);',
    '  -webkit-backdrop-filter:blur(14px) saturate(1.1);',
    '  opacity:0;transition:opacity .18s ease}',
    '.ow-ex-back.is-on{opacity:1}',

    '.ow-ex{position:relative;width:min(560px,100%);container-type:inline-size;',
    '  --h:var(--ow-h1);--h2:var(--ow-h2);',
    '  border-radius:26px 22px 27px 23px;padding:clamp(18px,5cqw,30px);',
    '  color:#fff;display:flex;flex-direction:column;gap:clamp(12px,3cqw,20px);',
    /* ── `--ow-h1` IS AN RGB TRIPLET, NOT A HUE ANGLE ─────────────────
       I wrote `hsl(var(--h) 92% 62%)` here and the panel came back near-black.
       The variable resolves to `124,45,255` — three channels — so the hsl()
       was invalid, the whole gradient was dropped, and only the flat base
       underneath survived. It looked like a deliberate dark panel and was a
       silently discarded declaration.

       Two hue conventions live in this file and they are not interchangeable:
       `--po-h` is an ANGLE and takes hsl(); `--ow-h1`/`--ow-h2` are TRIPLETS
       and take rgba(). The face itself uses the triplet form, which is why it
       carries the person's colour and my panel did not. */
    '  background:',
    '    radial-gradient(120% 100% at 12% 0%,rgba(var(--h),.92),transparent 62%),',
    '    radial-gradient(120% 110% at 100% 100%,rgba(var(--h2),.85),transparent 60%),',
    '    linear-gradient(160deg,rgba(38,32,72,.98),rgba(18,15,38,.98));',
    '  box-shadow:0 30px 80px rgba(0,0,0,.5)}',
    /* the seam, the same thread every Popit wears */
    '.ow-ex::before{content:"";position:absolute;inset:var(--po-seam,5px);',
    '  border-radius:inherit;pointer-events:none;',
    '  border:1.5px dashed rgba(255,255,255,.22);display:none}',   /* founder/437 */

    /* ── THE COVER LEADS, WHEN THERE IS ONE ─────────────────────────────
       Every platform that treats an event as a first-class object opens with
       the picture, because it is the fastest thing a person reads. It is a
       BACKGROUND rather than an <img> so a wrong aspect ratio crops instead of
       distorting, and it is hidden outright when the event has none — a grey
       rectangle where a photo should be is worse than no photo. */
    '.ow-ex-cover{width:100%;aspect-ratio:16/9;border-radius:18px 15px 19px 16px;',
    '  background-size:cover;background-position:center;',
    '  box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}',
    '.ow-ex-body-wrap{display:flex;flex-direction:column;gap:clamp(8px,2cqw,12px);',
    '  min-width:0}',
    /* A LABELLED FACT. The label is quiet and fixed-width so the values line up
       into a column a person can scan, which is what makes several facts read
       as one block rather than a list of sentences. */
    '.ow-ex-fact{display:flex;gap:clamp(10px,3cqw,16px);align-items:baseline;',
    '  min-width:0;font-size:clamp(12px,3.2cqw,15px)}',
    '.ow-ex-lbl{flex:0 0 auto;width:clamp(44px,13cqw,64px);opacity:.55;',
    '  font-size:clamp(9px,2.6cqw,11px);letter-spacing:.1em;',
    '  font-weight:600}',
    '.ow-ex-val{min-width:0;overflow-wrap:anywhere;line-height:1.4}',
    /* THE PLATFORM ADMITTING SOMETHING, never a fact. Quieter and italic so it
       cannot be mistaken for the event's own words. */
    '.ow-ex-note{margin:0;font-size:clamp(11px,2.9cqw,13px);opacity:.6;',
    '  font-style:italic;line-height:1.45}',
    '.ow-ex-head{display:flex;align-items:center;gap:clamp(12px,4cqw,22px);',
    '  min-width:0}',
    /* THE MEDALLION IS THE OBJECT HERE TOO, and bigger because there is room */
    '.ow-med--big{width:clamp(64px,22cqw,108px)}',
    '.ow-ex-id{min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.ow-ex-kind{font-size:clamp(9px,2.6cqw,12px);letter-spacing:.14em;',
    '  opacity:.66;font-weight:600}',
    '.ow-ex-title{margin:0;font-size:clamp(20px,6cqw,32px);font-weight:650;',
    '  line-height:1.1;letter-spacing:-.01em;overflow-wrap:anywhere}',
    '.ow-ex-when{margin:0;font-size:clamp(12px,3.2cqw,15px);opacity:.78}',
    '.ow-ex-body{margin:0;font-size:clamp(13px,3.4cqw,16px);line-height:1.55;',
    '  opacity:.86}',

    '.ow-ex-rows{list-style:none;margin:0;padding:0;display:flex;',
    '  flex-direction:column;gap:9px}',
    '.ow-ex-row{display:flex;align-items:center;gap:10px;min-width:0;',
    '  font-size:clamp(12px,3.2cqw,15px);opacity:.9}',
    '.ow-ex-mark{flex:0 0 auto;width:7px;height:7px;border-radius:50%;',
    '  background:#fff;opacity:.55}',
    /* each strand names itself by shape, so the list reads without labels */
    '.ow-ex-row[data-t="place"] .ow-ex-mark{border-radius:2px}',
    '.ow-ex-row[data-t="center"] .ow-ex-mark{border-radius:2px;opacity:.8}',
    '.ow-ex-row[data-t="going"] .ow-ex-mark{opacity:.8}',

    '.ow-ex-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:2px}',
    '.ow-ex-go,.ow-ex-alt{font:inherit;font-weight:600;cursor:pointer;',
    '  border-radius:999px;padding:11px 20px;',
    '  font-size:clamp(13px,3.2cqw,15px);transition:transform .12s ease}',
    '.ow-ex-go{border:0;background:#fff;color:#181433}',
    '.ow-ex-alt{border:1.5px solid rgba(255,255,255,.34);background:transparent;',
    '  color:#fff}',
    '.ow-ex-go:active,.ow-ex-alt:active{transform:scale(.97)}',
    '@media (prefers-reduced-motion:reduce){',
    '  .ow-ex-back{transition:none}',
    '  .ow-ex-go,.ow-ex-alt{transition:none}}',
    /* ── DEPTH: what is worth saying at this size ──────────────────────── */
    /* ── A SMALL POPIT'S SIDE MARGINS ARE THE FIRST THING IT SPENDS ──────
       13px each side is 26px of a 51px tile — half of it — and under one
       universal plane that tile exists on any phone rather than only in a
       deliberately tiny window. Measured at 280px: "Tokyo" wanted 32px in the
       25px that was left, and the same for the time and the absence line.

       `data-size="sm"` already means "this Popit is small", so the number is
       corrected where it is decided rather than fought with a more specific
       selector elsewhere — I tried that twice and lost to this rule both
       times. The seam is untouched at 4px: the stitching is the object's edge
       and it does not move. */
    /* ── AND THAT REASON EXPIRED ON 2026-09-12 ─────────────────────────
       ★ FOUNDER: *"are the popits from the outside all looking like that
         yet"* — measured against Apple's shelf, the answer was no, and the
       inset was one of the four reasons. Two tiles on one Home measured
       `9px 7px` and two measured `14px`, so nothing lined up across the
       screen. Apple pads every widget from the same optical inset whatever
       its family, which is why the content columns agree.

       THE 51px TILE THE RULE ABOVE WAS WRITTEN FOR CANNOT EXIST ANY MORE.
       Popits are now one of four FOOTPRINTS and the smallest is three of
       twelve columns — about 77px at 375, never 51. The measurement that
       justified 9px was true and is now unreachable.

       So the inset is one value per footprint, and the two that share a width
       share an inset, which is what makes a column line up with the one under
       it. Still asymmetric-free: the same number on all four sides, because a
       Popit that is tighter on one axis reads as lopsided beside a Post. */
    '.ow-cv-t[data-size="sm"] .ow-cv-face{padding:11px}',
    '.ow-cv-t[data-size="sm"] .ow-po-line,',
    '.ow-cv-t[data-size="sm"] .ow-po-foot,',
    '.ow-cv-t[data-size="sm"] .ow-cv-sub{display:none}',
    '.ow-cv-t[data-size="sm"] .ow-po-title{-webkit-line-clamp:1}',
    /* ── THE ROOM HAS ALREADY SAID THE NAME ──────────────────────────────
       A Clock's face carries its own eyebrow — the label, or the zone when
       there is none — and an opened Popit puts the kind and the name in its
       header one line above it. Measured on screen: "UTC" twice, stacked, in
       two type sizes, and the second one saying nothing the first had not.
       Emptying the config would not fix it, because the eyebrow falls back to
       the zone; the duplication is contextual, so the answer is too. Only in
       a sheet: on a tile the eyebrow is the only thing naming the clock. */
    '.po-sheet__face .ow-clk-city{display:none}',
    /* ── AND THREE WHEN THE TILE IS TALL ENOUGH TO HOLD THEM ─────────────
       ★ MEASURED 2026-09-12 on a Centre's public face: "Boardwalk Beach
         Concert" rendered as "Boardwalk Beach..." in a 125x150 tile whose
         front had 60px of unused height under it. Two lines is the right
         clamp beside a medallion in a SHORT tile and the wrong one in a tall
         one, and the ladder was written for width alone.

       The event's NAME is the one thing on this tile a person is reading; an
       ellipsis in it is legible but it is still the third word of a title
       being spent on nothing. Same rule as everywhere else here — the same
       Popit says more of the same thing as it earns the room. */
    '@container (min-height:120px){.ow-po-title{-webkit-line-clamp:3}}',
    '.ow-cv-t[data-size="md"] .ow-po-foot--soft{display:none}',
    /* ── A GENEROUS INSET IS A PROMISE ABOUT HEIGHT ──────────────────────
       ★ MEASURED 2026-09-13 by resizing a Guestbook to `full` at a narrow
         plane: the box is 275x134 — WIDE and short — and this rule spent 40 of
         those 134 pixels on top-and-bottom inset, then the `lg` clamp asked
         for six lines of quote. 122px of ink in 94px of room, overflowing by
         21.

       `lg` is a rung keyed on AREA, and area cannot tell a tall tile from a
       long one. The horizontal inset stays 22 — that is a promise about WIDTH
       and this box has width to spare — but the vertical one is now a
       proportion of the height it is actually taking, so a short tile keeps
       its content and a tall one keeps its air. Same correction as the hero
       ramp two rules up: ask the axis that is running out. */
    '.ow-cv-t[data-size="lg"] .ow-cv-face{padding:clamp(9px,6cqh,20px) 22px}',
    /* and the clamp cannot promise more lines than the box has room for */
    '@container (max-height:190px){',
    '  .ow-cv-t[data-size="lg"] .ow-cv-face--po .ow-cv-detail{--po-lines:3}}',
    '.ow-cv-t[data-size="lg"] .ow-po{gap:22px}',

    /* ── THE INSTRUMENT HAD NO RULES AT ALL ──────────────────────────────
       ★ MEASURED 2026-09-13, chasing why a face appeared in the wrong place:
         `.ow-in` computes 0x0 and `position:static`. There is no rule for
         `.ow-in`, none for `.ow-in-svg`, none for `.ow-in-ring`, `.ow-in-ring2`
         or `.ow-in-core` anywhere in this file or the stylesheet. The only
         `.ow-in-*` rules that exist are the four for the map pin and a
         reduced-motion guard for a pulse that is never drawn.

       SO EVERY POPIT WITH AN INSTRUMENT HAS BEEN DRAWING NOTHING. `instrument`
       builds a real SVG — concentric rings for presence, a wound ring for how
       near an event is — appends it to a box with no size, and the circles
       inherit no fill and no stroke. `has-in` has been a class that costs a
       DOM node and paints air. That is most of why a status tile reads as a
       word on an empty square: the drawing that was supposed to carry it was
       never visible.

       Sized like a face, and for the same reason — the two sit in the same
       slot on the same shelf and must agree. `position:relative` because the
       face goes INSIDE the ring, and an absolutely-positioned child of a
       static box escapes to the tile, which is exactly what it did. */
    '.ow-in{position:relative;flex:none;display:block;',
    '  width:clamp(26px,22cqmin,54px);aspect-ratio:1}',
    '.ow-in-svg{display:block;width:100%;height:100%;overflow:visible}',
    /* the rings are the subject's own light, the way every other mark is */
    '.ow-in-ring{fill:none;stroke:var(--ow-ink-3);stroke-width:3;opacity:.5}',
    '.ow-in-ring2{fill:none;stroke:var(--ow-ink-3);stroke-width:2.5;opacity:.28}',
    '.ow-in-core{fill:var(--ow-ink-3)}',
    /* ── THE STATE IS THE COLOUR, AND IT IS THE ONLY THING THAT IS ───────
       Presence has three answers and they are told apart by hue, not by a
       label: online is the platform's own light, away is warm, offline stays
       quiet ink. `data-status` is set by `instrument` from the projection. */
    '.ow-in--now[data-status="online"] .ow-in-core,',
    '.ow-in--now[data-status="online"] .ow-in-pulse{fill:rgb(var(--ow-h2))}',
    '.ow-in--now[data-status="online"] .ow-in-ring{stroke:rgb(var(--ow-h2));opacity:.85}',
    '.ow-in--now[data-status="away"] .ow-in-core{fill:hsl(38,92%,62%)}',
    '.ow-in--now[data-status="away"] .ow-in-ring{stroke:hsl(38,92%,62%);opacity:.7}',
    '.ow-in-pulse{fill:rgb(var(--ow-h2));opacity:.35;',
    '  transform-origin:50% 50%;animation:ow-in-breathe 2.6s ease-in-out infinite}',
    '@keyframes ow-in-breathe{0%,100%{transform:scale(1);opacity:.35}',
    '  50%{transform:scale(1.45);opacity:.05}}',
    /* ── FILL:NONE IS LOAD-BEARING, AND THIS FILE ALREADY KNEW ───────────
       The medallion's own note says it in these words: *"without it these
       circles paint solid black, which is exactly what shipped."* It shipped
       again here. `.ow-in-geo` sets a stroke and no fill, and an SVG circle
       fills black by default — so the Location globe was three filled black
       discs. Nobody saw it because `.ow-in` was 0x0 and clipped the lot; the
       moment the box got a size, the blob appeared. Two defects hiding each
       other is why neither was found. */
    '.ow-in-geo{fill:none;stroke:var(--ow-ink-3);stroke-width:2;opacity:.55}',
    '.ow-in-cross{stroke:var(--ow-ink-3);stroke-width:1.5;opacity:.3;',
    '  stroke-dasharray:2 7}',
    /* ── AND THE EVENTS INSTRUMENT HAD NO RULES AT ALL ───────────────────
       `track`, `arc`, `num` and `tick` are built by `instrument` and styled
       nowhere — the ring that says how near an event is has never been drawn.
       The arc is wound by `stroke-dasharray` in the JS, so all it needs here
       is a colour, a cap and the same fill:none the rest of them needed. */
    '.ow-in-track{fill:none;stroke:var(--ow-ink-3);stroke-width:6;opacity:.22}',
    '.ow-in-arc{fill:none;stroke:rgb(var(--ow-h1));stroke-width:6;',
    '  stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%}',
    '.ow-in-num{fill:var(--ow-ink);font-family:var(--ow-font-display);',
    '  font-weight:650;font-size:34px;text-anchor:middle;',
    '  dominant-baseline:central}',
    '.ow-in-tick{fill:rgb(var(--ow-h2))}',
    '.ow-in-halo{fill:hsl(var(--po-h) 92% 68% / .26)}',
    '.ow-in-pin{fill:hsl(var(--po-h) 92% 70%);',
    '  filter:drop-shadow(0 0 10px hsl(var(--po-h) 92% 62% / .95))}',
    '@media (prefers-reduced-motion:reduce){.ow-in-pulse{animation:none;opacity:.3}}',
    'html[data-fx="safe"] .ow-in-pulse{animation:none;opacity:.3}',
    '.ow-cv-sig{font-size:clamp(calc(19px * var(--cv-type,1)),4.6cqw,30px);font-weight:600;',
    '  letter-spacing:-.02em;line-height:1.06;color:#fff;',
    '  text-shadow:0 1px 12px rgba(0,0,0,.55)}',
    '.ow-cv-detail{font-size:calc(13px * var(--cv-type,1));line-height:1.35;color:rgba(255,255,255,.82);',
    '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;',
    '  text-shadow:0 1px 8px rgba(0,0,0,.5)}',
    '.ow-cv-face--po.is-quiet .ow-cv-detail{color:var(--ow-ink-3)}',
    /* the label above the value, in the Popit\'s own quiet voice */
    '.ow-cv-face--po .ow-cv-kind{margin-bottom:5px;color:var(--ow-ink-3)}',
    /* container queries so ONE Popit renders correctly at every tile size and
       on every screen — the same object on App and OS, per the brief */
    /* ★ `size`, NOT `inline-size` — HEIGHT IS HALF THE SHAPE.
       Founder, 2026-08-30: *"they cannot appear broken when resized or
       stretched."*

       With `inline-size` a component can only ask how WIDE its tile is, so a
       12-wide, 1-row Popit answered "very wide" and laid itself out for a
       billboard inside a 30px strip. Measured across 256 shape/kind
       combinations, every remaining break was a SHORT tile — h=1 rows and
       wide-and-flat tiles — and none of them were askable until now.

       `container-type:size` is safe here precisely because the tile's height
       never depends on its contents: it is absolutely positioned and its height
       comes from `--h` and the row. That is the condition the property needs,
       and this grid satisfies it by construction. */
    /* ── TREATMENT: HOW LOUDLY THE POPIT WEARS ITS COLOUR ──────────────────
       The hue says WHICH colour; the treatment says HOW MUCH. One person wants
       a Popit that recedes into the galaxy and another wants one that announces
       itself, and both are the same colour decision at different volumes.

       It is a MULTIPLIER on the material's existing intensities rather than a
       second set of gradients, so a treatment cannot invent a look the Popit
       does not otherwise have — quiet is the same face turned down, vivid is
       the same face turned up. `normal` writes nothing, which is why it is not
       stored: it IS the default. */
    '.ow-cv-t[data-treat="quiet"] .ow-cv-face{--po-lift:.62}',
    '.ow-cv-t[data-treat="vivid"] .ow-cv-face{--po-lift:1.5}',
    '.ow-cv-t[data-recoloured] .ow-cv-face{',
    /* a recoloured Popit keeps its own rim rather than the world's, so it reads
       as deliberate at a glance instead of looking like a rendering error */
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),calc(.34 * var(--po-lift,1))),',
    '             inset 0 1px 0 rgba(255,255,255,.11)}',
    /* ── THE COLOUR ROW ────────────────────────────────────────────────────
       A swatch is the colour itself, so it needs no label, no border and no
       container to explain it — the founder's rule about not adding chrome for
       separation applies most where the control IS the thing it sets. It wears
       the same gradient the Popit will, so choosing is comparing.

       "Center colour" stays a WORD, because the absence of an override has no
       colour of its own to show — it is whatever the world currently is, and a
       swatch of that would read as a thirteenth choice rather than as the
       default state. */
    '.ow-cv-colour{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.ow-cv-swatches{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.ow-cv-sw{width:20px;height:20px;padding:0;border:0;border-radius:50%;',
    '  cursor:pointer;background:linear-gradient(145deg,var(--sw1),var(--sw2));',
    '  box-shadow:0 0 0 1px rgba(255,255,255,.16);',
    '  transition:transform .16s var(--ow-ease,ease),box-shadow .16s var(--ow-ease,ease)}',
    '.ow-cv-sw:hover{transform:scale(1.14)}',
    /* THE CHOSEN ONE IS RINGED, NOT TICKED. A checkmark on a 20px circle
       covers the colour you are trying to judge. */
    '.ow-cv-sw[aria-pressed="true"]{transform:scale(1.14);',
    '  box-shadow:0 0 0 2px var(--ow-ground,#08070e),0 0 0 4px var(--sw1)}',
    '.ow-cv-sw:focus-visible{outline:2px solid var(--sw1);outline-offset:3px}',
    '.ow-cv-zlab{font-size:calc(10px * var(--cv-type,1));font-weight:600;letter-spacing:.16em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    /* ── THE GHOST: WHAT RELEASE WILL COMMIT ────────────────────────────────
       ★ FOUNDER, 2026-08-30: *"show the destination before committing it."*

       It occupies the exact cells the Popit will take, using the same grid
       variables the tiles do — so it cannot disagree with the thing it is
       predicting. Quiet, because it is a promise rather than an object: an
       outline and a wash of the surface hue, no material, no shadow, nothing
       that competes with the Popit actually under the finger. */
    '.ow-cv-ghost{position:absolute;pointer-events:none;z-index:1;',
    '  left:calc((var(--x) / var(--cv-cols)) * 100%);',
    '  width:calc((var(--w) / var(--cv-cols)) * 100% - var(--cv-gap));',
    '  top:calc(var(--y) * (var(--cv-row) + var(--cv-gap)));',
    '  height:calc(var(--h) * var(--cv-row) + (var(--h) - 1) * var(--cv-gap));',
    '  border-radius:var(--po-r,22px 17px 24px 19px);',
    '  background:rgba(var(--ow-h1),.10);',
    '  box-shadow:inset 0 0 0 1.5px rgba(var(--ow-h1),.42);',
    '  transition:left .16s var(--ow-ease,ease),top .16s var(--ow-ease,ease)}',
    /* THE ONE BEING DRAGGED RIDES ABOVE EVERYTHING AND ANSWERS ONLY TO THE
       HAND — no position transition, or it would lag behind the finger. */
    '.ow-cv-t[data-dragging]{z-index:999!important;transition:none;',
    '  cursor:grabbing;filter:drop-shadow(0 16px 28px rgba(0,0,0,.55))}',
    /* THE NEIGHBOURS GLIDE. Seeing WHICH tile moved and where it went is the
       whole difference between "the layout made room" and "things jumped". */
    '.ow-cv[data-editing="1"] .ow-cv-t:not([data-dragging]){',
    '  transition:left .22s var(--ow-ease,cubic-bezier(.2,.8,.2,1)),',
    '             top .22s var(--ow-ease,cubic-bezier(.2,.8,.2,1))}',
    '.ow-cv-t{container-type:size}',
    '@container (max-width:220px){',
    '  .ow-cv-sig{font-size:calc(20px * var(--cv-type,1))}.ow-cv-sub{display:none}}',
    /* ★ NOTHING ESCAPES ITS TILE. Founder, 2026-08-30: *"they cannot appear
       broken when resized or stretched."*

       A floor rather than a fix: `overflow:hidden` on the face means the worst
       a mis-sized component can do is be cropped, never spill across the
       Popit beside it — and `min-width:0` is what actually lets flex children
       shrink instead of forcing their parent wider than the tile, which is the
       mechanism behind almost every overflow of this kind.

       The real repair for the Clock is its density ladder above; this is here
       so the NEXT component's mistake is contained the day it is written. */
    '.ow-cv-face,.ow-cv-face *{min-width:0;min-height:0}',
    '.ow-cv-face{overflow:hidden}',
    /* the clock stacks its dial above its readout on a portrait tile */
    '.ow-clk[data-stack] {flex-direction:column;align-items:center}',
    '.ow-clk[data-stack] .ow-clk-dial{max-width:min(74%,100%);max-height:56%}',
    '.ow-cv-face--ref{flex-direction:column;align-items:flex-start;gap:3px;',
    '  justify-content:flex-end;text-decoration:none}',
    '.ow-cv-kind{font-size:calc(11.5px * var(--cv-type,1));font-weight:500;letter-spacing:0;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-cv-sub{font-size:calc(12px * var(--cv-type,1));color:var(--ow-ink-2,#9793ad);overflow:hidden;',
    '  text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
    '.ow-cv-face--ref.is-gone{opacity:.62;cursor:default;',
    '  box-shadow:inset 0 0 0 1px rgba(255,255,255,.09)}',

    /* ── A COLLECTION TILE ──────────────────────────────────────────────────
       Same face material as every other tile on this canvas — it inherits
       `.ow-cv-face` and adds only what makes a Highlight legible as a Highlight.
       The founder's rule holds: the SHAPE is borrowed because people already
       know it, and only the material is ours.

       IT SIZES WITH THE TILE, not with the viewport. `cqw` against the tile's
       own container query means a 3x3 Highlight and a 6x4 Highlight are two
       genuinely different compositions rather than one scaled picture — which
       is the whole reason these are placements and not a fixed rail. */
    /* ── NOT EVERY POPIT IS A BOX ───────────────────────────────────────────
       ★ FOUNDER, 2026-08-30: *"not every popit should be a box like a highlight
         should be its own shape think dynamically."*

       SO THE CARD IS REMOVED, NOT RESHAPED. A Highlight drawn as a circle
       inside a rounded rectangle is still a rectangle with a picture in it —
       the panel is what the eye reads first, and it makes the Highlight look
       like a Popit ABOUT a Highlight rather than the thing itself. Taking the
       face's background and its edge away leaves the circle sitting directly on
       the galaxy, which is what it is.

       THE BOX IS STILL THERE FOR LAYOUT and that is the point: the placement
       keeps its grid cell, its drag, its resize, its snapping and its selection
       outline, because those belong to the ARRANGEMENT and not to the picture.
       Only the paint is gone. A shape is a rendering decision; a tile is a
       spatial one, and collapsing them would mean a circular Popit could not be
       laid out beside a rectangular one.

       DYNAMICALLY, ALSO, IS THE POINT: the shape follows the KIND. A Highlight
       is a ring, a Playlist is a stack of covers — and anything later that has
       a real shape of its own says so here rather than inheriting a card by
       default. */
    /* THREE SELECTORS, AND EACH ONE WAS EARNED BY A FAILED ATTEMPT.
       `.ow-cv-face--coll` alone lost on SOURCE ORDER — `.ow-cv-face` sets the
       card material further down this same stylesheet at equal specificity.
       `.ow-cv-face.ow-cv-face--coll` (0,2,0) still lost, to the light-mode
       rule `html:not([data-theme="dark"]) .ow-cv-face` at (0,2,1) — which
       applies in DARK mode too, because "no explicit theme" is the default and
       `:not([data-theme="dark"])` matches it. So the card kept coming back
       while the override sat in the sheet looking correct.

       Measured both times by asking the live element which rules matched it,
       rather than by reading the stylesheet and believing it. */
    '.ow-cv-t--collection .ow-cv-face.ow-cv-face--coll{',
    '  flex-direction:column;align-items:center;',
    '  justify-content:center;gap:clamp(5px,2cqw,11px);text-decoration:none;',
    '  text-align:center;padding:clamp(4px,2cqw,10px);',
    '  background:none;box-shadow:none;border-radius:0;',
    '  backdrop-filter:none;-webkit-backdrop-filter:none}',
    /* the tile shell must not paint one either, or the card comes back */
    '.ow-cv-t--collection .ow-cv-face::before,',
    '.ow-cv-t--collection .ow-cv-face::after{display:none}',
    /* A PLAYLIST IS A STACK, not a single cover — that is what says "there are
       more of these inside" before anybody reads the count. Two offset edges
       behind the cover, drawn on the cover itself, so it costs no extra
       elements and no extra paint node. */
    '.ow-cv-face--coll.is-playlist .ow-cv-coll__cover{',
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),.34),',
    '    0 -5px 0 -2px rgba(var(--ow-h1),.16),',
    '    0 -9px 0 -4px rgba(var(--ow-h1),.09)}',
    /* ── THE COVER FITS BOTH WAYS, WHICH IS THE WHOLE TRICK ────────────────
       Sized from the tile's WIDTH alone, a Highlight in a short tile drew a
       stretched ellipse — measured on the live canvas, a circle 271px wide in a
       132px-tall tile. A placement can be any shape the person drags it into,
       so a cover sized against one axis is wrong the moment they resize it.

       `flex:1 1 0` in a column lets the free HEIGHT decide, `aspect-ratio`
       derives the width from that height, and `max-width:100%` caps it — at
       which point the aspect ratio pulls the height back down to match. The
       shape survives every tile the person can make. */
    /* ★ SIZED FROM THE TILE, NOT FROM LEFTOVER FLEX SPACE.
       Founder, 2026-08-30: *"they cannot appear broken when resized or
       stretched."*

       `flex:1 1 0` + `aspect-ratio` LOOKED right and was not. In a column, flex
       decides the HEIGHT and `aspect-ratio` derives the width from it — but
       once `max-width:100%` clamps that width, the height does NOT shrink back
       to match. On a one-column phone tile the Highlight rendered as an
       ELLIPSE, roughly 65x130, which is the one thing a Story ring must never
       be. My shape sweep did not catch it because it measured overflow and
       clipping, not distortion; the aspect check is now part of that suite.

       Container units are DEFINITE, so there is no negotiation: the circle is
       the smaller of 86% of the tile's width and 54% of its height. It is a
       circle in every tile the person can drag, and the remaining height is
       left for the name. */
    '.ow-cv-coll__cover{position:relative;display:block;flex:0 0 auto;',
    '  min-height:0;min-width:0;align-self:center;overflow:hidden}',
    /* THE RING IS THE HUE, NOT A BORDER — a solid line reads as UI chrome, a
       conic pass reads as light around the cover, which is what the rest of
       this platform is made of. */
    '.ow-cv-face--coll.is-highlight .ow-cv-coll__cover{',
    '  width:min(86cqw,54cqh);aspect-ratio:1;',
    '  border-radius:50%;padding:clamp(2px,.8cqw,3.5px);',
    '  background:conic-gradient(from 200deg,rgb(var(--ow-h1)),',
    '    rgb(var(--ow-h2)),rgb(var(--ow-h1)))}',
    '.ow-cv-face--coll.is-playlist .ow-cv-coll__cover{',
    '  width:min(100%,calc(54cqh * 1.6));aspect-ratio:16/10;',
    '  border-radius:clamp(8px,3cqw,14px);',
    '  margin-top:clamp(6px,2.5cqw,11px)}',
    '.ow-cv-coll__img,.ow-cv-coll__initial{display:block;width:100%;height:100%;',
    '  object-fit:cover;border-radius:inherit}',
    '.ow-cv-face--coll.is-highlight .ow-cv-coll__img,',
    '.ow-cv-face--coll.is-highlight .ow-cv-coll__initial{border-radius:50%}',
    /* THE STAND-IN COVER MUST BE OPAQUE ENOUGH TO BE A COVER. At .34/.22 over
       the galaxy the ring showed straight through it and the tile read as one
       flat gradient disc with a letter on it — the ring and the cover have to
       be two things or the ring is not saying anything. The dark base is the
       canvas ground, so this is still the platform's material rather than a
       panel colour invented here. */
    '.ow-cv-coll__initial{display:flex;align-items:center;justify-content:center;',
    /* ── #fff, NOT var(--ow-ink) — THE GROUND HERE DOES NOT FOLLOW THE THEME.
       Three lines below, this disc paints itself
       linear-gradient(168deg,rgba(14,12,26,.94),rgba(10,9,20,.97)): near-black
       in BOTH themes, on purpose, because it is art behind a letter rather
       than a panel. --ow-ink flips to #14131f on light, so the initial went
       dark-on-dark and measured 1.18:1 — the Playlist covers rendered as
       blank discs.

       This is the same mistake as the Popit face, inverted. There, a face
       took the Post's light material and kept dark-theme ink. Here, ink
       follows the theme while its ground refuses to. The rule underneath both:
       ink and ground are chosen together or not at all. Take the theme token
       only if your ground takes it too. */
    '  font-weight:650;font-size:clamp(15px,11cqw,34px);color:#fff;',
    '  background:',
    '    radial-gradient(125% 95% at 20% -12%,rgba(var(--ow-h1),.42),transparent 64%),',
    '    radial-gradient(105% 85% at 90% 110%,rgba(var(--ow-h2),.3),transparent 68%),',
    '    linear-gradient(168deg,rgba(14,12,26,.94),rgba(10,9,20,.97))}',
    /* the count is how somebody decides whether to start a playlist, so it sits
       ON the cover where the eye already is */
    '.ow-cv-coll__n{position:absolute;right:6px;bottom:6px;',
    '  padding:2px 6px;border-radius:999px;font-size:clamp(9px,2.4cqw,11px);',
    '  font-weight:600;line-height:1.35;color:#fff;background:rgba(12,10,22,.66);',
    '  box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}',
    /* `flex:0 0 auto` — the NAME IS NOT NEGOTIABLE. With the cover on
       `flex:1 1 0` and the words left to default, a short tile squeezed the
       title until it was clipped mid-word; the picture is what shrinks, never
       the thing that says which Highlight this is. */
    /* THE NAME IS WHAT IDENTIFIES A HIGHLIGHT. "Atlant…" identifies nothing,
       and two short lines cost less than a name nobody can read. */
    /* A COLLECTION'S NAME MAY TAKE TWO LINES — unlike the clock it has no
       fixed readout competing for the same vertical budget, and "Atlantic City"
       reading in full is worth one extra line. It breaks on WORDS, so a name
       never splits mid-word the way "Boardw/alk" did. */
    /* ── THE FLOOR IS 8px, BECAUSE A NAME CAN BE ONE LONG WORD ───────────
       A collection's title wraps at spaces and never breaks mid-word — that is
       the founder's rule and it stays. But "Boardwalk" has no space in it, so
       at a floor of 10.5px it wanted 52px in the 43px a 3-wide tile has under
       one universal plane, and simply drew past its edge. Measured at 280px.

       A word that cannot wrap and must not break has one honest way to fit,
       which is to be smaller. The clamp already scales with the container; its
       FLOOR was set for a world where a tile was never this narrow. */
    /* ── A NAME IS NOT CLAMPED. IT WRAPS, AND THE TILE GIVES UP SOMETHING
           ELSE INSTEAD. ────────────────────────────────────────────────────
       ★ FOUNDER: *"i dont want to see any cut out or ... text anywhere."*

       This was `-webkit-line-clamp:2` with `overflow:hidden`, under a comment
       claiming it wrapped "rather than cutting". A clamp wraps for two lines
       and then cuts, with an ellipsis, and the comment was true only until a
       collection had a longer name than the test data did.

       Every other ladder in this file removes WHOLE PARTS — Latest drops to a
       count, What's Happening drops the note then the place — because a
       removed part is an honest smaller answer and a cut word is a broken one.
       The count line below already works that way, appearing only when the
       tile can afford it. The name now behaves like the rest of the lane: it
       wraps as far as it needs, and what gives way is the line underneath it. */
    '.ow-cv-coll__t{flex:0 0 auto;font-weight:600;',
    '  font-size:clamp(8px,3.4cqw,15px);',
    '  line-height:1.2;color:var(--ow-ink,#fff);max-width:100%;',
    '  white-space:normal;overflow:visible;text-overflow:clip;',
    '  overflow-wrap:normal;word-break:normal;hyphens:none}',
    /* THE COUNT LINE APPEARS ONLY WHEN THE TILE CAN AFFORD IT. On a small
       Highlight the cover and the name are the whole story; below that width a
       third line is what turns a clean tile into a cramped one. */
    '.ow-cv-coll__c{display:none;flex:0 0 auto;',
    '  font-size:clamp(9px,2.3cqw,10.5px);font-weight:600;',
    '  letter-spacing:.01em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '@container (min-width:150px) and (min-height:120px){.ow-cv-coll__c{display:block}}',
    /* ── SHORT TILE: THE SAME PARTS, LAID OUT AS A ROW ──────────────────────
       Not a different component and not a cropped one — a stacked cover, title
       and count simply cannot exist in a 30px strip, and forcing them there is
       what "broken when stretched" looks like. Side by side, the identical
       three parts fit any flat tile down to one row, and the result is the
       familiar list-row shape people already read.

       §11 holds: SIZE CONTROLS DENSITY, NEVER WHICH COMPONENT RENDERS. */
    /* ★ WIDE AND FLAT, NOT MERELY SHORT.
       Keyed on height alone, this fired on a small SQUARE tile — a Highlight at
       roughly 120x111 became a cramped left-aligned row with "Atl…" beside a
       shrunken ring, when the centred circle it is supposed to be fits that box
       comfortably. A row layout earns its place when the tile is genuinely
       wider than it is tall; an aspect ratio says that and a height cannot. */
    '@container (min-aspect-ratio:8/5) and (max-height:150px){',
    '  .ow-cv-t--collection .ow-cv-face.ow-cv-face--coll{',
    '    flex-direction:row;align-items:center;justify-content:flex-start;',
    '    gap:clamp(6px,2cqw,10px);text-align:left;padding:0 clamp(6px,2cqw,10px)}',
    /* ★ A SHAPE MUST BE BOUND ON BOTH AXES OR IT IS NOT A SHAPE.
       `height` from the tile's height and a `max-width:44%` clamp is two
       DIFFERENT constraints fighting: on a 75px-wide, 74px-tall tile the height
       asked for 55px and the width clamp allowed 33px, so the ring rendered
       33x55 — an ellipse again, in the row layout this time. `aspect-ratio`
       cannot rescue that; it only fills in a dimension nobody else has claimed.

       So the single bound carries both: the cover's height is the smaller of a
       share of the tile's HEIGHT and a share of its WIDTH, and the aspect ratio
       derives the other side from it. One constraint, so nothing can disagree.
       Caught by adding a circle-distortion check to the shape sweep — the
       earlier passes measured overflow and clipping and would never have seen
       an ellipse, which is why one shipped twice. */
    '  .ow-cv-coll__cover{flex:0 0 auto;width:auto;max-width:none;margin-top:0}',
    '  .ow-cv-face--coll.is-highlight .ow-cv-coll__cover{',
    '    height:min(74cqh,40cqw);width:auto}',
    '  .ow-cv-face--coll.is-playlist .ow-cv-coll__cover{',
    '    height:min(74cqh,27cqw);width:auto}',
    '  .ow-cv-face--coll.is-playlist .ow-cv-coll__cover{box-shadow:',
    '    inset 0 0 0 1px rgba(var(--ow-h1),.34)}',
    '  .ow-cv-coll__t{flex:1 1 auto;text-align:left}',
    '  .ow-cv-coll__n{display:none}',
    '}',
    /* AND BELOW ~54px even a row is only one line — the name is the thing that
       identifies it, so the picture is what goes. */
    '@container (max-height:54px){',
    '  .ow-cv-t--collection .ow-cv-coll__cover{display:none}',
    '  .ow-cv-coll__t{font-size:clamp(11px,4cqh,14px)}',
    '}',
    /* THE CLOCK, SAME RULE. A one-row Clock is a time and a place on one line;
       the dial and the meta need height that is not there. */
    '@container (min-aspect-ratio:8/5) and (max-height:96px){',
    '  .ow-clk{flex-direction:row;align-items:center;gap:8px}',
    '  .ow-clk-dial,.ow-clk-meta,.ow-clk-rel{display:none}',
    '}',
    /* ── WHEN ONLY TWO LINES FIT, THEY ARE THE TWO THAT SAY SOMETHING ─────
       ★ MEASURED 2026-09-12 on a signed-in Home: the Now tile is 70px tall,
         which is 42px of content after its inset. The label takes 8 and the
         hero 21; the caption under them begins at 55 and ends at 71, one
         pixel outside the tile. "just now" was drawn ACROSS the dashed seam.

       I DROPPED THE CAPTION FIRST AND THAT WAS THE OLD MISTAKE AGAIN. The
       caption is the EVIDENCE. The founder had just asked *"NOW 'online' ????
       what have u been working on ?"*, the answer I put on the tile was the
       word underneath the status, and hiding the third line to make the tile
       fit deleted that answer and left exactly the tile he complained about.
       Twice now I have put substance in the slot that gets dropped.

       SO THE LABEL GOES INSTEAD. It is the Popit's own name, on a Popit this
       person chose and placed; "Online / just now" needs no heading, and a
       heading over one word is chrome sitting where a fact should be. The
       instrument or the glyph still marks which Popit it is, and the opened
       sheet is titled. Held to `max-height` alone rather than an aspect ratio,
       because a tile can be short at any width. */
    '@container (max-height:88px){.ow-cv-face--po .ow-cv-kind{display:none}',
    /* ── ON A SHORT FACE, HEIGHT IS THE CONSTRAINT, SO HEIGHT SETS THE TYPE ─
       ★ MEASURED 2026-09-13 on a real Home at a 249px plane: a `wide` face
         115x53, inset 14px top and bottom, holding a 21.6px hero and a 15.8px
         caption — 37.4px of ink in 25px of room, clipped by 3px, with "just
         now" sitting on the dashed seam.

       THE RAMP WAS KEYED TO WIDTH. `clamp(21px, 7.2cqw, 40px)` asks the tile
       how WIDE it is, and on a short tile the answer is irrelevant: 7.2cqw
       resolves to 8px and the 21px FLOOR — a floor set so a hero stays a hero
       on a narrow tile — is what does not fit. A minimum sized against one axis
       is a minimum that ignores the axis actually running out.

       So inside a short face the hero is keyed to `cqh` and the inset gives up
       its vertical half. The horizontal inset does NOT move: it is `--po-seam`
       plus `--po-gap`, the distance a Post's content sits from its own
       stitching, and crowding that sideways is the defect that number exists to
       prevent. Vertically a short tile has a seam at 4px and can sit 8px in
       without touching it. Measured after: 15px hero, 15.8px caption, 31px of
       ink in 37px of room. */
    '  .ow-cv-face--po{padding-top:8px;padding-bottom:8px}',
    '  .ow-cv-face--po .ow-cv-sig{font-size:clamp(calc(15px * var(--cv-type,1)),5cqh,22px);line-height:1.1}',
    '  .ow-cv-face--po .ow-cv-detail{--po-lines:1}',
    '}',
    /* ── A QUIET TILE TOO SMALL FOR A SENTENCE SAYS ITS NAME ─────────────
       ★ MEASURED 2026-09-20 at 290px: a 3x3 Events tile is 54px square. The
         rule above hid its name and the absence clamped to "Nothing right…" —
         a cut phrase about nothing, on a tile that no longer said what it
         was. Below 96px a quiet tile carries its glyph and its NAME; the
         absence and the invitation are the opened sheet's. */
    '@container (max-width:96px){.ow-cv-face--po.is-quiet .ow-cv-kind{display:block;margin:auto 0 0}',
    '  .ow-cv-face--po.is-quiet .ow-cv-detail{display:none}',
    /* ...AND ITS GLYPH, as the line above promises. The 132px rule hides every
       Popit's corner mark to give the words the width — right for a tile with
       words, and on a quiet tile under 96px it left only the name at the
       bottom of an empty square (the founder/513 tour's Events tile). Here
       the mark is the content: centred, quiet, the name beneath it. */
    '  .ow-cv-face--po.is-quiet .ow-gl{display:grid;top:50%;left:50%;right:auto;',
    '    transform:translate(-50%,-66%);width:24px;opacity:.5}}',
    '.ow-cv-face--coll.is-gone{flex-direction:column;align-items:flex-start;',
    '  justify-content:flex-end;opacity:.62;cursor:default}',
    '.ow-cv-t--sticker{display:grid;place-items:center}',
    /* ── A WHITE OUTLINE, THE WAY A STICKER HAS ONE ─────────────────────────
       ★ FOUNDER, 2026-08-25: *"give it and stickers a white outline."*
       A real sticker is die-cut with a white border, and that border is what
       separates it from whatever it is stuck to — here, the galaxy. Drawn with
       stacked drop-shadows rather than a box border, because the outline has to
       follow the IMAGE's alpha silhouette, not its rectangular box. */
    '.ow-cv-sticker{max-width:100%;max-height:100%;object-fit:contain;',
    '  user-select:none;filter:',
    '    drop-shadow(0 0 0 #fff) drop-shadow(0 0 0 #fff) drop-shadow(0 0 0 #fff)',
    '    drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff)',
    '    drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)',
    '    drop-shadow(1.5px 1.5px 0 #fff) drop-shadow(-1.5px 1.5px 0 #fff)',
    '    drop-shadow(1.5px -1.5px 0 #fff) drop-shadow(-1.5px -1.5px 0 #fff)',
    '    drop-shadow(0 8px 18px rgba(0,0,0,.42))}',
    /* THE TURN HANDLE — only for somebody who may arrange this surface, and
       only visible when they are near the sticker, because a decoration should
       not wear its controls all the time. */
    '.ow-cv-turn{position:absolute;top:-11px;right:-11px;width:26px;height:26px;',
    '  border-radius:50%;border:2px solid #fff;cursor:grab;padding:0;z-index:4;',
    '  background:hsl(var(--po-h) 84% 62%);opacity:0;',
    '  box-shadow:0 3px 10px rgba(0,0,0,.45);transition:opacity .16s ease}',
    '.ow-cv-turn::after{content:"";position:absolute;inset:6px;border-radius:50%;',
    '  border:2px solid #fff;border-top-color:transparent;border-right-color:transparent}',
    '.ow-cv-turn:active{cursor:grabbing}',
    '.ow-cv-t--sticker:hover .ow-cv-turn,',
    '.ow-cv-turn:focus-visible{opacity:1}',
    '@media (pointer:coarse){.ow-cv-turn{opacity:1}}',
    '.ow-cv-empty,.ow-cv-fault{color:var(--ow-ink-3,#6f6b85);font-size:14px;',
    '  padding:26px 0}',
    '.ow-cv-empty--act{display:block;width:100%;text-align:left;background:none;',
    /* SOLID, for the same reason as the seam — an invitation to add your first
       Popit is not a drop zone, and drawing it like one makes a finished empty
       state look like a half-built form. */
    '  border:1px solid var(--ow-seam,rgba(255,255,255,.14));border-radius:14px;',
    '  padding:20px 18px;font:inherit;color:var(--ow-ink-2,#9793ad);cursor:pointer}',
    '.ow-cv-empty--act:hover{border-color:rgba(255,255,255,.28);',
    '  color:var(--ow-ink,#f3f2f8)}',
    /* ── ARRANGEMENT IS VISIBLE WITHOUT BEING NOISY ────────────────────────
       No jiggling. The founder has ruled repeatedly against motion that exists
       to decorate, and a canvas of wobbling tiles is exactly that — it also
       makes the thing you are trying to place harder to judge. The mode is said
       by a lifted ground and a live edge on the tiles, both static: you can see
       that everything is grabbable without anything moving. */
    '.ow-cv[data-editing="1"]{cursor:grab}',
    '.ow-cv[data-editing="1"] .ow-cv-t .ow-cv-face{',
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),.5),',
    '             inset 0 1px 0 rgba(255,255,255,.14),',
    '             0 8px 26px -14px rgba(var(--ow-h1),.55)}',
    '.ow-cv[data-editing="1"] .ow-cv-t{cursor:grab}',

    /* ═══ THE SHAKE ══════════════════════════════════════════════════════
       ★ FOUNDER, 2026-09-02: *"make them easier to click on and edit like hold
         down with ios apps and they all start shaking like on ios."*

       This REPLACES the previous decision, which is written a few lines above
       and said the opposite — a lifted ground and a live edge, deliberately
       static. That was my call and the founder has overruled it: on iOS the
       shake is what tells you the grid is live, and it is the thing people
       already know.

       IT IS ON THE FACE, NOT THE TILE, AND THAT IS LOAD-BEARING. `.ow-cv-t`
       carries the drag: a pixel-follow `transform` written every pointermove.
       An animation on the same element would fight that write frame for frame
       and the dragged tile would judder against the finger. The face is inside
       the tile and free, so the two never touch.

       OUT OF PHASE, LIKE THE REAL THING. iOS does not shake a grid in lockstep
       — that reads as one sheet wobbling rather than many loose icons. Two
       keyframes of opposite phase, alternated, plus a per-tile delay, and no
       two neighbours agree. The rotation is DEGREES OF A DEGREE: at 0.7deg a
       92px tile moves about a pixel at its corner, which is the amount that
       says "loose" without smearing the text inside it. */
    '@keyframes ow-cv-jiggle-a{',
    '  0%{transform:rotate(-.7deg) translate(0,0)}',
    ' 25%{transform:rotate(.35deg) translate(.4px,-.4px)}',
    ' 50%{transform:rotate(.7deg) translate(0,0)}',
    ' 75%{transform:rotate(-.35deg) translate(-.4px,.4px)}',
    '100%{transform:rotate(-.7deg) translate(0,0)}}',
    '@keyframes ow-cv-jiggle-b{',
    '  0%{transform:rotate(.7deg) translate(0,0)}',
    ' 25%{transform:rotate(-.35deg) translate(-.4px,.4px)}',
    ' 50%{transform:rotate(-.7deg) translate(0,0)}',
    ' 75%{transform:rotate(.35deg) translate(.4px,-.4px)}',
    '100%{transform:rotate(.7deg) translate(0,0)}}',
    '.ow-cv[data-editing="1"] .ow-cv-t .ow-cv-face{',
    '  animation:ow-cv-jiggle-a .26s linear infinite;',
    '  transform-origin:50% 50%;will-change:transform}',
    '.ow-cv[data-editing="1"] .ow-cv-t:nth-child(2n) .ow-cv-face{',
    '  animation-name:ow-cv-jiggle-b;animation-duration:.28s;',
    '  animation-delay:-.06s}',
    '.ow-cv[data-editing="1"] .ow-cv-t:nth-child(3n) .ow-cv-face{',
    '  animation-duration:.3s;animation-delay:-.13s}',
    '.ow-cv[data-editing="1"] .ow-cv-t:nth-child(5n) .ow-cv-face{',
    '  animation-duration:.24s;animation-delay:-.19s}',
    /* THE TILE IN YOUR HAND HOLDS STILL. A tile that keeps shaking while it is
       being dragged reads as unheld, and it is the one tile whose exact
       position you are trying to judge. */
    '.ow-cv[data-editing="1"] .ow-cv-t[data-dragging] .ow-cv-face{animation:none}',
    /* ★ CANON §4 — motion is a preference, not a decoration. */
    '@media (prefers-reduced-motion:reduce){',
    '  .ow-cv[data-editing="1"] .ow-cv-t .ow-cv-face{animation:none}}',
    'html[data-motion="reduced"] .ow-cv[data-editing="1"] .ow-cv-t .ow-cv-face{',
    '  animation:none}',
    '.ow-cv-done{margin-left:8px}',
    '.ow-cv-cancel{margin-left:8px;color:var(--ow-ink-3,#6f6b85)}',
    '.ow-cv-done[data-on]{color:var(--ow-ink,#f3f2f8)}',
    '.ow-cv-add{margin-top:10px;background:none;font:inherit;cursor:pointer;',
    '  border:1px solid var(--ow-seam,rgba(255,255,255,.10));border-radius:999px;',
    '  padding:8px 18px;color:var(--ow-ink-2,#9793ad);font-size:13px;font-weight:560}',
    '.ow-cv-add:hover{color:var(--ow-ink,#f3f2f8)}',
    '.ow-cv-pick{position:fixed;inset:0;z-index:9000;background:var(--ow-ground,#08070f);',
    '  display:flex;flex-direction:column}',
    '.ow-cv-pick__bar{display:flex;align-items:center;justify-content:space-between;',
    '  padding:14px 18px;font-size:13.5px;font-weight:560;color:var(--ow-ink,#f3f2f8);',
    '  border-bottom:1px solid var(--ow-seam,rgba(255,255,255,.09))}',
    '.ow-cv-pick__x{background:none;border:1px solid var(--ow-seam,rgba(255,255,255,.09));',
    '  color:inherit;font:inherit;border-radius:999px;padding:6px 14px;cursor:pointer}',
    '.ow-cv-pick__list{flex:1;overflow:auto;padding:14px 18px 40px;display:flex;',
    '  flex-direction:column;gap:8px;max-width:720px;width:100%;margin:0 auto}',
    /* ── THE ONE POPIT SURFACE WITH NO POPIT ON IT ──────────────────────
       ★ FOUNDER, 2026-09-12: *"look at apples widgets — are the popits from
         the outside all looking like that yet"*

       MEASURED by opening it: the Add sheet drew twelve flat dark slabs with
       a 1px border. It is the screen where a person CHOOSES a Popit, and it
       was the only Popit surface in the product with none of the material on
       it — a list of names for objects whose whole point is how they look.
       Apple's gallery shows the widget itself; this showed a receipt.

       So a row wears the same ground and the same weave as the tile it is
       offering, from the same declaration every other surface takes. What it
       keeps is what makes it a ROW in a list: its own radius, its inset, its
       column of name and blurb. It does NOT take the seam — twelve dashed
       edges in a scrolling list is noise, and the one dashed row in here is
       the file drop target, where dashed still means something. */
    '.ow-cv-pick__row{display:flex;flex-direction:column;gap:3px;text-align:left;',
    '  position:relative;isolation:isolate;--h:var(--ow-h1);--h2:var(--ow-h2);',
    '  border:0;border-radius:16px 13px 17px 14px;padding:14px 16px;',
    '  font:inherit;cursor:pointer;color:inherit}',
    '.ow-cv-pick__row::after{z-index:-1}',
    /* the mark sits where a tile's does — top right, quiet, out of the way of
       the words rather than in a column beside them */
    '.ow-cv-pick__gl{position:absolute;top:12px;right:14px;width:22px;height:22px;',
    '  color:var(--ow-ink-3);opacity:.9;pointer-events:none}',
    '.ow-cv-pick__gl .ow-gl-svg{width:100%;height:100%;display:block}',
    '.ow-cv-pick__row .ow-cv-pick__name,',
    '.ow-cv-pick__row .ow-cv-pick__blurb{padding-right:30px}',
    /* WAS A HARDCODED WHITE. Invisible on a light surface, which made every
       row in the OS look unclickable. Tokenised so both grounds get an edge. */
    '.ow-cv-pick__row:hover{border-color:var(--ow-ink-3,rgba(255,255,255,.22))}',
    /* THE ONE DASHED EDGE THAT STAYS. This row is a real FILE DROP TARGET, and
       dashed is that convention doing its actual job rather than decorating a
       finished surface. Removing it here would cost meaning instead of noise. */
    /* THE DROP TARGET KEEPS ITS DASHED EDGE, and it needs a border of its own
       to dash now that the row has none. It is drawn as the material's seam is
       drawn — inside the radius, on a layer of its own — so it reads as part of
       the object rather than a box around it. Dashed still means "put a file
       here" on this one row, which is why it survived the sweep that removed
       decorative dashes everywhere else. */
    '.ow-cv-pick__row--up::before{content:"";position:absolute;inset:5px;',
    '  border-radius:inherit;pointer-events:none;',
    '  border:1.5px dashed var(--ow-seam,rgba(255,255,255,.22))}',
    '.ow-cv-pick__name{font-size:15px;font-weight:560;color:var(--ow-ink,#f3f2f8)}',
    '.ow-cv-pick__blurb{font-size:13px;color:var(--ow-ink-3,#6f6b85)}',
    /* ── THE STATES A SURFACE MUST BE ABLE TO SAY ──────────────────────
       Waiting, and what happened to the last write. Both use the tokens this
       stylesheet already defines, so the OS variant remaps them for free and
       there is still one design here rather than two. */
    '.ow-cv-wait{color:var(--ow-ink-3,#6f6b85);font-size:14px;padding:22px 2px}',
    '.ow-cv-note{font-size:13px;line-height:1.45;padding:10px 12px;margin:0 0 12px;',
    '  border-radius:10px;border:1px solid var(--ow-seam,rgba(255,255,255,.10));',
    '  color:var(--ow-ink-2,#9793ad);background:var(--ow-panel-2,rgba(255,255,255,.03))}',
    '.ow-cv-note--bad{color:var(--ow-ink,#f3f2f8);',
    '  border-color:color-mix(in srgb,#e5484d 42%,transparent);',
    '  background:color-mix(in srgb,#e5484d 12%,transparent)}',
    '.ow-cv-pick__grp{font-size:10.5px;font-weight:650;letter-spacing:.16em;',
    '  color:var(--ow-ink-3,#6f6b85);',
    '  padding:18px 0 6px;border-top:1px solid var(--ow-seam,rgba(255,255,255,.08));',
    '  margin-top:8px}',
    '.ow-cv-pick__grp:first-child{border-top:0;margin-top:0;padding-top:4px}',
    '.ow-cv-pick__wait{color:var(--ow-ink-3,#6f6b85);font-size:14px;padding:24px 0;',
    '  text-align:center;line-height:1.5}',
    /* The Center surface's event rows — the discover -> place path. */
    '.ow-center-events{margin-top:22px;display:flex;flex-direction:column;gap:8px}',
    '.ow-center-ev{display:flex;flex-direction:column;gap:3px;align-items:flex-start;',
    '  background:var(--ow-panel-1,#100e1a);border:1px solid var(--ow-seam,rgba(255,255,255,.09));',
    '  border-radius:14px;padding:13px 15px}',
    '.ow-center-ev__rel{font-size:10px;font-weight:650;letter-spacing:.18em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-center-ev__open{background:none;border:0;padding:0;font:inherit;',
    '  text-align:left;cursor:pointer;color:var(--ow-ink,#f3f2f8)}',
    '.ow-center-ev__open:hover{text-decoration:underline}',
    '.ow-center-ev__more{font-size:12.5px;color:var(--ow-ink-3,#6f6b85);padding:4px 2px}',
    '.ow-center-ev__when{font-size:12px;font-weight:560;color:var(--ow-ink-2,#9793ad);',
    '  letter-spacing:.02em}',
    '.ow-center-ev__t{font-size:15.5px;font-weight:560;color:var(--ow-ink,#f3f2f8)}',
    '.ow-center-ev__w{font-size:12.5px;color:var(--ow-ink-3,#6f6b85)}',
    '.ow-center-ev .po-act{margin-top:8px}',
    '.ow-center-canvas{margin-top:18px}',
    '.ow-cv-fault{color:var(--ow-ink-2,#9793ad)}',
    /* AN APP IS NOT A CARD AND DOES NOT OPEN LIKE ONE. Full-bleed, its own
       world, ONEWAY chrome only in the bar above it. */
    '.ow-cv-app{position:fixed;inset:0;z-index:9000;background:var(--ow-ground,#08070f);',
    '  display:flex;flex-direction:column}',
    '.ow-cv-app__bar{display:flex;align-items:center;justify-content:space-between;',
    '  padding:12px 16px;font-size:13.5px;font-weight:560;',
    '  color:var(--ow-ink,#f3f2f8);border-bottom:1px solid var(--ow-seam,rgba(255,255,255,.09))}',
    '.ow-cv-app__x{background:none;border:1px solid var(--ow-seam,rgba(255,255,255,.09));',
    '  color:inherit;font:inherit;border-radius:999px;padding:6px 14px;cursor:pointer}',
    '.ow-cv-app__stage{flex:1;position:relative;display:grid;place-items:center}',
    '.ow-cv-app__frame{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '.ow-cv-app__wait{color:var(--ow-ink-3,#6f6b85);font-size:14px;max-width:36ch;',
    '  text-align:center;line-height:1.5}',
    '@keyframes ow-cv-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-18%)}',
    '  55%{transform:translateY(4%)}}',
    '@keyframes ow-cv-spin{to{transform:rotate(360deg)}}',
    '@keyframes ow-cv-pulse{0%,100%{transform:scale(1)}45%{transform:scale(1.14)}}',
    '@keyframes ow-cv-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}',
    '  75%{transform:rotate(7deg)}}',
    '@keyframes ow-cv-pop{0%{transform:scale(1)}40%{transform:scale(1.25)}',
    '  70%{transform:scale(.94)}100%{transform:scale(1)}}',
    '.anim-bounce{animation:ow-cv-bounce .55s ease}',
    '.anim-spin{animation:ow-cv-spin .7s ease}',
    '.anim-pulse{animation:ow-cv-pulse .5s ease}',
    '.anim-wobble{animation:ow-cv-wobble .5s ease}',
    '.anim-pop{animation:ow-cv-pop .45s ease}',
    /* A PERSON WHO ASKED FOR LESS MOTION GETS LESS MOTION. A sticker that
       reacts is decoration; a vestibular disorder is not. */
    '@media (prefers-reduced-motion:reduce){',
    '  .anim-bounce,.anim-spin,.anim-pulse,.anim-wobble,.anim-pop{animation:none}',
    '  .ow-cv-t{transition:none}}',
    /* ★ A NARROW SCREEN KEEPS THE ARRANGEMENT. IT DOES NOT DISCARD IT.
       Founder, 2026-08-30: *"the layouts users arrange need to automatically
       adjust to all platform… make sure they translate layouts cross platform
       and orientation nicely."*

       WHAT USED TO BE HERE THREW THE LAYOUT AWAY. Under 560px every tile was
       forced to `left:0; width:100%; position:relative` — one stacked column.
       Two Popits the person deliberately put side by side became one above the
       other; a small Clock became a full-bleed slab. The arrangement is WHICH
       COLUMN a thing is in and WHAT SITS BESIDE IT, and that was exactly the
       part being discarded, on the one platform most people are using.

       THE ARRANGEMENT IS ALREADY RESOLUTION-INDEPENDENT and always was: `x` and
       `w` are fractions of `--cv-cols`, so they are percentages that translate
       to any width for free. The only thing measured in pixels is the ROW
       HEIGHT — and a fixed 44px row against a narrow column is what actually
       distorts the shapes. So the row scales with the column instead, in
       `fitRows()` below, and this media query has nothing left to do.

       ORIENTATION FALLS OUT OF THE SAME MECHANISM. Landscape is simply a wider
       canvas: the columns get wider, the rows scale with them, and the tiles
       keep their proportions and their neighbours. No second layout, no
       breakpoint that has to be kept in step with a stored arrangement. */
    ''
  ].join('');
  try {
    var st = doc.createElement('style');
    st.setAttribute('data-ow', 'canvas');
    st.textContent = css;
    doc.head.appendChild(st);
  } catch (_) {}

})(typeof window !== 'undefined' ? window : this);

