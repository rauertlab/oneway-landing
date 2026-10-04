/* oneway-feed.js — THE IMMERSIVE FEED: COMPOSITION AND NAVIGATION.
 *
 * ★ FOUNDER, 2026-08-26: *"The feed is a composition of canonical Posts into an
 *   immersive spatial experience. It is not a conventional card feed with a
 *   Galaxy wallpaper behind it, and it is not a TikTok clone."*
 *
 * WHAT WAS THERE BEFORE, AND WHY IT WAS WRONG. Immersive mode was one CSS
 * class: `.po-river--immersive` made every card `height:100svh` with
 * `scroll-snap-type:y mandatory`. So a post reading "Doors at seven." — fifteen
 * characters — became a full screen of nothing, and a person scrolled a whole
 * page to reach the next fifteen characters. That is the TikTok clone the
 * founder ruled out by name: full-screen is what VIDEO earns, not what text is
 * owed.
 *
 * ── THE THREE THINGS THIS FILE IS ─────────────────────────────────────────
 *
 *   1. COMPOSE  — decide what one feed position contains. Text Posts pack into
 *                 a GROUP that fills one page; a video Post is a position of
 *                 its own. Pure, and separately testable: `OW.feed.compose`.
 *   2. PROJECT  — put the already-rendered Post Popits into those positions.
 *   3. NAVIGATE — advance exactly one position per gesture, at Reels speed.
 *
 * ── PROJECTION IS REPARENTING, AND THAT IS THE WHOLE ARCHITECTURE ─────────
 *
 * ★ FOUNDER: *"There must be exactly one canonical Post… a like made in one
 *   presentation must immediately be the same like everywhere."*
 *
 * This file NEVER renders a Post. `OW.mountRiver` has already built one
 * `.po-card` per feed row and `home.js` has already wired it; projection MOVES
 * those exact DOM nodes into position wrappers. Same node, same listeners,
 * same `data-obj`, same aria-pressed — so the like, the repost, the save and
 * the open-the-post press are not reimplemented here, they are carried across
 * unchanged. There is no second renderer and no second interaction path,
 * because there is no second anything: it is the same element in a different
 * place on the page.
 *
 * Two consequences worth stating, because they are what make this safe:
 *   · The response controls are served by a DELEGATED listener on `document`
 *     (`popit-live.js`), so reparenting cannot detach them.
 *   · `wireRiver` binds by DOM order (`querySelectorAll('.po-card')[i]`).
 *     Reparenting PRESERVES document order, so that mapping still holds — and
 *     projection runs after wiring, never before.
 *
 * ── PACKING IS MEASURED, NOT ESTIMATED ────────────────────────────────────
 *
 * A group must fit one page or its last Popit is clipped, and a clipped Post is
 * a Post the person cannot read or press. Estimating heights from character
 * counts gets that wrong at both ends — one long post, one narrow phone, one
 * long author name. So the cards are measured at their real width in a single
 * layout pass and packed against real numbers. One reflow, no clipping.
 *
 * ── WHY THE SCROLLER IS NATIVE ────────────────────────────────────────────
 *
 * ★ FOUNDER: *"The gesture → velocity → release → snap → settling behavior
 *   needs to feel essentially identical to the short-form video apps."*
 *
 * On a phone, the ONLY thing that feels like that is the platform's own
 * scroller — iOS momentum runs in the compositor, off the main thread, and no
 * JavaScript animation can reproduce its curve or its interruptibility. So
 * touch is given straight to the native scroller with CSS snap, and this file
 * runs NO CODE during a touch gesture at all.
 *
 * `scroll-snap-stop: always` is what makes a hard fling advance exactly one
 * position instead of three — the founder's "no accidental double-advance", on
 * touch, done by the platform.
 *
 * WHEEL IS THE OPPOSITE CASE and needs the opposite treatment. A trackpad emits
 * a long momentum tail of events after the fingers lift, and a mouse notch
 * emits one large delta; handed to a mandatory-snap scroller the first skips
 * several positions and the second fights the snap. So wheel is intercepted and
 * answered with ONE advance per gesture, where a gesture ends after a quiet
 * period — the tail is swallowed on purpose.
 *
 * That is the founder's rule kept honestly: *"The implementation can adapt to
 * the input method; the experience cannot drift."* One position per intent,
 * whichever hand made it.
 */
(function (global) {
  'use strict';

  var OW = global.OW = global.OW || {};
  var doc = global.document;

  function mk(tag, cls) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* ═══ 1 · WHAT A ROW ACTUALLY IS ═══════════════════════════════════════
     A feed row arrives in one of the shapes the App already carries: a post
     row (`{post}`), a gallery row (`{gallery}`), or an external row. This reads
     what it needs and INVENTS NOTHING — a row that declares no media has none,
     rather than being given a default. */

  var VIDEO_RE = /\.(mp4|m4v|mov|webm)(\?|#|$)/i;

  function face(item) {
    var g = (item && (item.post || item.gallery)) || item || {};
    var media = g.media || [];
    var vid = '', img = '';
    for (var i = 0; i < media.length; i++) {
      var m = media[i], url = (m && (m.url || m.src)) || (typeof m === 'string' ? m : '');
      if (!url) continue;
      var isV = (m && m.kind === 'video') || VIDEO_RE.test(url);
      if (isV && !vid) vid = url;
      else if (!isV && !img) img = url;
    }
    /* A GALLERY'S COVER IS ITS MEDIA. The cover field carries whatever the
       first piece was, and the runtime accepts video there — so a cover ending
       .mp4 is a video post by every meaning that matters here. */
    var cover = g.cover || '';
    if (!vid && cover && VIDEO_RE.test(cover)) vid = cover;
    if (!img && cover && !VIDEO_RE.test(cover)) img = cover;

    var who = (item && item.actor) || g.author || {};
    return {
      id: g.id || '',
      text: String(g.body || g.description || g.title || ''),
      video: vid,
      image: img,
      isVideo: !!vid,
      isImage: !vid && !!img,
      /* WHOSE AND WHERE — the two facts a group diversifies on. Read off the
         canonical Post, never derived or guessed; absent stays absent. */
      who: String(who.email || who.name || ''),
      place: String(g.destination || g.destination_name || ''),
      external: (item && item.type === 'external') || false
    };
  }

  /* ═══ 2 · COMPOSE — THE SEQUENCE OF FEED POSITIONS ═════════════════════

     ★ FOUNDER, 2026-08-26 (the correcting message — THIS model, and it is not
       to be reinterpreted):

         [ VIDEO ] -> [ VIDEO ] -> [ TEXT GROUP + GALAXY ] -> [ VIDEO ]

       *"Videos are individual immersive feed items. Text Posts are
       automatically collected into substantial recommended groups. The group
       is one swipeable feed position."*

     So this walks the order the BACKEND gave and never re-ranks it. A video is
     a position of its own — *"There is no grouping of videos."* A run of text
     is gathered into one group that costs exactly one swipe.

     WHAT "RECOMMENDED" HONESTLY MEANS TODAY. `/api/oneway/social/feed` returns
     `ranked: false, rank: "recent"` — it says so itself. There is no learned
     recommender behind this yet, and pretending otherwise here would be
     inventing a capability. What this DOES do is the part the founder asked
     for that can be done without one: *"combine relevant text Posts from
     different People, Centers, communities, topics"* — the group prefers a new
     voice and a new place over another Post by someone already in it, chosen
     from a BOUNDED LOOKAHEAD so the feed order still governs. The day `ranked`
     turns true this consumes it with no change here.

     HOW MANY FIT IS ASKED, NOT ESTIMATED. The Popits WRAP — two short ones sit
     side by side, a long one takes the row — so no arithmetic over heights can
     predict the count. `fits` is the caller's question "does the page still
     hold this?", answered against the real laid-out group (see `project`). The
     estimate fallback exists only so this function stays testable with no DOM.
     Founder: *"The exact number should be determined responsively."* */

  /* HOME'S OWN HEIGHTS, measured on the laid-out feed at 430px rather than
     guessed: a short Post is ~142px there, not the 108px a half-width tile
     needed. `GAP` is Home's 6px rhythm plus the card's own outer glow. */
  var EST = { sm: 142, md: 190, lg: 260 };
  var GAP = 8;

  function estimateFits(budget) {
    /* ── ONE ACROSS, AT HOME'S WIDTH ────────────────────────────────────────
       ★ FOUNDER, 2026-08-31: *"make sure popits and posts on home and
         scrolling look consistent and exactly like posts on home right now."*

       THIS REVERSES A RULING, and the reversal is recorded rather than quietly
       applied. On 2026-08-26 the founder asked for *"less posts and having the
       existing be smaller"*, and this modelled that as TWO ACROSS at half
       width with shrunken chrome. Measured at a 430px viewport, that made a
       Post in Scroll a visibly different object from the same Post on Home:

           Home    394px wide (91.6%)  ·  18px gutters  ·  34px avatar
           Scroll  359px wide (83.5%)  ·  36px gutters  ·  24px avatar

       Density is a legitimate thing to vary between presentations; the object's
       IDENTITY is not. A card whose avatar shrinks by 29% reads as a different
       component, which is what the founder is seeing.

       So the packing is now ONE ACROSS at full width and the budget decides how
       many fit — fewer Posts per page, each identical to Home. The `sm/md/lg`
       classes survive and now govern TEXT CLAMPING only, which is density
       without touching identity. */
    return function (group) {
      var h = 0;
      for (var i = 0; i < group.length; i++) {
        h += EST[group[i].size] + (i ? GAP : 0);
      }
      return h <= budget;
    };
  }

  function sizeOf(f) {
    /* Media never reaches a group any more — it takes its own page — but a
       size is still asked for when a media position renders, and 'lg' is what
       a full-frame Post is. */
    if (f.isVideo || f.isImage) return 'lg';
    var n = f.text.length;
    if (n <= 70) return 'sm';
    if (n <= 210) return 'md';
    return 'lg';
  }

  OW.feed = OW.feed || {};

  OW.feed.compose = function (items, opts) {
    opts = opts || {};
    items = items || [];
    var fits = opts.fits || estimateFits(opts.budget || 640);
    var maxN = opts.max || 14;
    var look = opts.window == null ? 12 : opts.window;

    var faces = [], i;
    for (i = 0; i < items.length; i++) faces.push(face(items[i]));

    /* ── ONE ANSWER TO "DOES THIS POST HAVE MEDIA" ────────────────────────
       The row says one thing and the rendered card can say another: `face()`
       reads `media`/`cover` off the payload, while the renderer decides from
       `cover` plus the strip. Where they disagreed, a Post with a media block
       was composed into a TEXT group — and it brought a 270px picture frame
       into a stack sized for sentences.

       So the caller that has the cards supplies the test, and the payload
       reading is only the fallback for callers with no DOM (the suites). The
       rendered card wins because the rendered card is what the person sees. */
    function faceHasMedia(k) { return faces[k].isVideo || faces[k].isImage; }
    var hasMedia = opts.isMedia
      ? function (k) { return opts.isMedia(k, faceHasMedia); }
      : faceHasMedia;

    function entryAt(k) {
      return { item: items[k], index: k, face: faces[k], size: sizeOf(faces[k]) };
    }

    var used = [], out = [], head = 0, leftover = [];

    function nextFree(from) {
      for (var k = from; k < items.length; k++) if (!used[k]) return k;
      return -1;
    }

    while (true) {
      head = nextFree(head);
      if (head < 0) break;

      /* ★ FOUNDER, 2026-08-29: *"the whole point is that posts with photos do
           not appear here but just appear as a normal video would."*

         So MEDIA takes the page — a photograph as much as a video. An earlier
         reading put image Posts inside the text groups as larger Popits; that
         is explicitly wrong. The immersive feed shows media FULL FRAME and
         gathers TEXT into groups over the Galaxy. One rule: has media -> its
         own position; text only -> composed. */
      if (hasMedia(head)) {
        used[head] = true;
        out.push({ kind: 'media',
                   media: faces[head].isVideo ? 'video' : 'image',
                   items: [entryAt(head)] });
        continue;
      }

      /* ── GATHER A TEXT GROUP ────────────────────────────────────────────
         The FIRST Post is whatever the feed put next — its choice is not
         second-guessed. Everything after is chosen from a bounded lookahead
         for a new voice and a new place, so a group reads as a collection
         rather than as one person's timeline. */
      var group = [entryAt(head)];
      used[head] = true;
      var seenWho = {}, seenPlace = {};
      seenWho[faces[head].who] = 1;
      seenPlace[faces[head].place] = 1;

      if (!fits(group)) {
        /* one Post taller than the whole page — it gets the page, and it is
           still a Popit rather than a full-bleed video sheet */
        out.push({ kind: 'group', solo: true, items: group });
        continue;
      }

      var starved = false;              /* the BATCH ran out, not the page */
      while (group.length < maxN) {
        var pick = -1, best = -Infinity, seen = 0;
        for (var j = head; j < items.length && seen < look; j++) {
          if (used[j] || hasMedia(j)) continue;
          seen++;
          var f = faces[j];
          var score = 0;
          if (f.who && !seenWho[f.who]) score += 2;
          if (f.place && !seenPlace[f.place]) score += 2;
          score -= seen * 0.12;            /* the feed's own order still leads */
          if (score > best) { best = score; pick = j; }
        }
        if (pick < 0) { starved = true; break; }

        group.push(entryAt(pick));
        if (!fits(group)) { group.pop(); break; }
        used[pick] = true;
        seenWho[faces[pick].who] = 1;
        seenPlace[faces[pick].place] = 1;
      }

      /* ── A HALF-EMPTY PAGE IS A BATCH BOUNDARY LEAKING THROUGH ───────────
         ★ FOUNDER, 2026-08-29: *"screens should appear full unless there are
           no posts to populate them."*

         MEASURED BEFORE THIS: driving the pager to position 178 gave group
         sizes 6,1,1,6,1,1 … then 6,2,6,2 … then 5,3,5,3. Position 178 held
         THREE Popits with 407px of an 812px page empty. Nothing was wrong with
         the packer — `fits` was right every time. The feed fetches eight rows
         at a time, the packer filled one page from them, and whatever was left
         over became a page of its own. Every batch left a remainder, and every
         remainder became a half-empty screen. About one page in two.

         So a group that stopped because THE BATCH ran dry (`starved`) is not
         emitted at all — it is handed back as `leftover` and prepended to the
         next batch, where it finishes filling. A group that stopped because
         THE PAGE ran out is full and is emitted as it is.

         The end of the feed is the one place a short group is honest, and the
         caller says so by not asking to carry. */
      if (starved && opts.carry) { leftover = group; break; }

      /* WHY THIS PAGE ENDED, kept on the position. A short page is a defect
         and the first question about one is always which of the two limits
         stopped it — the page, or the batch. Guessing that cost an hour. */
      out.push({ kind: 'group', items: group,
                 why: starved ? 'batch' : (group.length >= maxN ? 'max' : 'page') });
    }

    var placed = interleave(out);
    placed.leftover = leftover;
    return placed;
  };

  /* ── ONE CONTENT UNIVERSE, NOT THREE QUEUES ────────────────────────────
     ★ FOUNDER, 2026-08-29: *"The user shouldn't be able to infer the
       implementation's content-type batching. The feed is one content
       universe."*

     The backend hands back its ranked order, and media is usually the newest
     thing in it — so walking that order emitted every video and photo first
     and then six text groups back to back. Nobody chose that; it is the
     content-type batching leaking straight through the composer.

     THE RANK ORDER IS PRESERVED WITHIN EACH KIND — the best video is still the
     first video, the best group still the first group. What changes is where
     each media position SITS relative to the groups: spread across the run
     instead of clustered at its head. So a person sees video / group / video /
     photo / group rather than a schedule they can read off the screen.

     COMPOSITION, NOT RANKING. It never reorders within a kind and never drops
     anything, so it cannot make the feed worse — only less machine-shaped. */
  function interleave(positions) {
    var media = [], groups = [];
    positions.forEach(function (p) {
      (p.kind === 'media' ? media : groups).push(p);
    });
    if (!media.length || !groups.length) return positions;

    var total = media.length + groups.length;
    var out = new Array(total);
    /* ★ FOUNDER: *"these scrolls should be rarer than videos."*  A text group
       is the occasional page between media, not the substance of the feed. Two
       things make that true: a group holds as many Posts as the screen fits
       (so the same text makes FEWER positions), and the spread below starts
       with media so a run opens on something to watch. */
    for (var i = 0; i < media.length; i++) {
      var slot = Math.floor(i * total / Math.max(media.length, 1));
      if (slot >= total) slot = total - 1;
      /* a collision walks forward, then wraps — every item is placed, never
         dropped, whatever the ratio of media to text turns out to be */
      var tries = 0;
      while (out[slot] && tries < total) { slot = (slot + 1) % total; tries++; }
      out[slot] = media[i];
    }
    var g = 0;
    for (var k = 0; k < total; k++) {
      if (!out[k]) out[k] = groups[g++];
    }
    return out.filter(Boolean);
  }

  /* ═══ 3 · THE GROUP'S SHAPE ── see §4 below ═══════════════════

     This section used to carry a drawing of Popits scattered at seeded widths,
     and a seeded `hash`/`rnd` pair to place them. The founder overturned both
     on 2026-08-29 — *"they cannot just be randomly spaced out and cut boxes"* —
     and §4 records what replaced them. The code is gone rather than left
     unreferenced, because a dead placer beside a live one is the next agent's
     wrong turn. */

  /* ═══ 4 · THE STACK ════════════════════════════════════════════════════

     ★ FOUNDER, 2026-08-29: *"the popits should be like the one saying
       'personal from operator' and basically touching each other… they cannot
       just be randomly spaced out and cut boxes, they should be coherent and
       take up the whole screen. platform type changes how many are shown per
       scroll."*

     THREE ATTEMPTS GOT THIS WRONG BEFORE THIS ONE, and each was a different
     kind of over-thinking:

       1. seeded widths in a wrapping row box   -> objects dropped in at random
       2. a pair/pair/single rhythm             -> a tidy grid of boxes
       3. hand-composed coordinates on guides   -> a scatter with holes in it

     All three were trying to make the page interesting. The founder does not
     want interesting — he wants COHERENT: full-width Popits, stacked, nearly
     touching, filling the screen. One column, one shape, no holes. The wide
     Popit that reads "Personal from the operator." is the shape; everything
     else was decoration around it.

     HOW MANY IS NOT A CONSTANT. `fits` measures the real laid-out stack against
     the real page, so a phone takes what a phone holds and a desktop takes
     more — *"platform type changes how many are shown per scroll"* falls out of
     measuring instead of being a table of numbers per device. */

  var GAP = 4;              /* "basically touching each other" — matches
                               `.ow-fgroup{gap}` in oneway-popit.css */

  function place(card, entry, i) {
    /* FULL WIDTH, EVERY ONE. No `--fx`, no per-card width: the variation that
       matters is the content and the author's hue, not the geometry. */
    card.style.setProperty('--fw', '100');
    card.style.removeProperty('--fx');
    card.style.removeProperty('--fy');
    card.setAttribute('data-fsize', entry.size);
    /* ITS PLACE IN THE STACK, so the page can arrive as a body of content
       rather than as six things appearing at once. The CSS turns this into a
       stagger; nothing here decides timing. */
    card.style.setProperty('--i', String(i || 0));
  }

  /* HOW MANY A PAGE MAY HOLD AT MOST. The real limit is `fits` — this is only
     a ceiling so one enormous group cannot swallow the whole pool, and it is
     high enough that a desktop is never the thing that stops it. */
  /* ★ FOUNDER/480: *"they dont even appear in a consistent manner text
       posts."* — and 479: it has to feel like Instagram, TikTok, Twitter. A
     page held two, four, one, five text Posts depending on what fitted, so
     the Scroll view drew every text page differently. ONE POST PER PAGE, the
     same every time — the earlier "screens should appear full" (2026-08-30)
     gives way to the newer word; a text page is full of its one Post. */
  function maxComposed() { return 1; }

  /* ═══ 5 · THE PAGER ════════════════════════════════════════════════════ */

  /* THE TUNING CONSTANTS ARE GONE WITH THE HEURISTIC THAT NEEDED THEM
     (DUR, QUIET, TH, LOCK — see below). Nothing here has a number to get
     wrong any more. */
  /* ══ THE MECHANISM THAT NEVER BREAKS ══════════════════════════════════════
     ★ FOUNDER/488, 2026-09-21: *"there are still unresponvice scrolls. build a
       MECHANISM THAT NEVER BREAKS. this is a social media app. this portion can
       not be underestimated."*  And: *"scrolling up and repadilty scrolling
       makes the platform stop for a seocnd unacceptable."*
     ★ FOUNDER/486 was the same complaint one round earlier, and /480 the round
       before that. THREE REPORTS OF ONE DEFECT. That is not three bugs; it is
       one wrong mechanism, and this replaces it rather than patching it again.

     WHAT WAS HERE, AND WHY IT COULD NEVER BE RIGHT. A JavaScript pager that
     intercepted every wheel event (`preventDefault`), accumulated deltas,
     decided by heuristic where one gesture ended and the next began, and drove
     `scrollTop` itself with a requestAnimationFrame animation. It carried nine
     pieces of mutable state — armed, acc, lastDir, deadDir, lastWheel,
     lastAdvance, lastAdvDir, pendingDir, animating — and EVERY defect he
     reported was one of them holding a stale answer:

       · `armed=false` swallowing the next swipe (he: "i cant even scroll up");
       · `deadDir` killing a whole direction until the pad went silent;
       · `animating` refusing input for 280ms and `LOCK` for 380ms — which IS
         *"the platform stops for a second"* when scrolling rapidly.

     No amount of tuning fixes that shape. A heuristic that must classify a
     continuous stream of wheel events into gestures has a wrong answer for
     some input, always — and the person who finds it is the person using it.

     SO THE MECHANISM IS THE BROWSER'S. `scroll-snap-type: y mandatory` with
     `scroll-snap-stop: always` on every page is a one-page-per-gesture pager
     implemented in the compositor: momentum, reversal mid-fling, rapid
     flicking, trackpad, mouse wheel, touch and every device this product has
     never seen are handled by code that has been tuned for a decade and runs
     off the main thread. It cannot be blocked by a busy frame, it holds no
     state that can go stale, and it is the SAME path touch already used — the
     one half of this view that was never reported broken.

     WHAT IS LEFT HERE is bookkeeping, not control: an IntersectionObserver
     that says which position is on screen, and `go()` for the keyboard and for
     programmatic jumps. Nothing listens to `wheel`. Nothing calls
     `preventDefault`. There is no `animating` flag, so there is no state in
     which the view refuses a person's hand.

     ONE POST PER GESTURE IS NOT LOST. `scroll-snap-stop: always` is precisely
     the rule that forbids a fling from skipping past a snap point — it is the
     platform's own implementation of the founder's rule (see the CSS block
     that sets it, which already says so). */

  /* the founder asked for measurement rather than a claim of smoothness, so the
     pager keeps its own last-N record and nothing else does */
  var metrics = { transitions: [], worstFrame: 0, doubles: 0 };

  function pager(scroller, onIndex, opts) {
    var idx = 0, H = 0;
    var io = null, destroyed = false;

    /* HOW LONG THE FEED IS, asked of the feed rather than of the DOM. With a
       bounded window the DOM holds five positions out of hundreds. */
    function count() {
      return (opts && opts.total && opts.total()) || scroller.children.length;
    }

    function measure() { H = scroller.clientHeight || 1; }

    /* ── GOING SOMEWHERE ON PURPOSE (keys, Home/End, a programmatic jump) ──
       Handed to the browser too. `scrollTo({behavior:'smooth'})` respects the
       snap container, honours prefers-reduced-motion, and — the reason it is
       used rather than an rAF loop — is INTERRUPTIBLE: a person who scrolls
       during it simply takes over. The old animation had to refuse them. */
    function go(i, src) {
      i = Math.max(0, Math.min(count() - 1, i));
      measure();
      var to = Math.round(i * H);
      if (Math.abs(scroller.scrollTop - to) < 2 && i === idx) return false;
      idx = i;
      if (onIndex) onIndex(idx);
      metrics.transitions.push({ src: src || 'js', latency: 0 });
      if (metrics.transitions.length > 40) metrics.transitions.shift();
      try { scroller.scrollTo({ top: to, behavior: 'smooth' }); }
      catch (e) { scroller.scrollTop = to; }
      return true;
    }

    function advance(dir, src) { return go(idx + dir, src); }

    /* ── THE ONE THING NATIVE SNAP CANNOT SERVE: A MOUSE NOTCH ───────────
       MEASURED in the pane after the rewrite above: a trackpad swipe advances
       exactly one page, up and down, every time — and a single mouse-wheel
       notch does NOTHING. One notch is 100px against an 863px page, so the
       scroller travels 12% of a page and the snap correctly returns it to
       where it started. That is native behaviour working as designed, and to
       the person holding the mouse it is an unresponsive scroll.

       So a notch — and ONLY a notch — is served here.

       THIS HOLDS NO STATE, WHICH IS THE WHOLE POINT. The old pager's defects
       were all accumulated state going stale (founder/489: *"fix core issues
       dont put bandaids on them"*). Both questions below are answered from
       the event in hand and from the scroller itself, read at the moment of
       use. Nothing is remembered between events, so there is no value that
       can be wrong and nothing that can get stuck.

         IS THIS A NOTCH?  A mouse wheel reports `deltaMode` in lines/pages,
           or — Chrome on every platform — a pixel delta that is an exact
           multiple of 100 (`wheelDeltaY` is derived from it, so the two say
           the same thing and only one is worth asking). A trackpad reports a
           continuous stream of arbitrary deltas: measured from the founder's
           own hand in his pane, 1, 3, 5, 8, 14, 31, 47, 59, 67, 171, −141.

         IS IT ALONE?  A notch arrives by itself; a trackpad's events arrive
           8ms apart for a second or more. So a notch is an event with no
           other wheel event in the 120ms before it.

       THE ONE PIECE OF STATE IS A TIMESTAMP, AND IT FAILS OPEN. `lastWheel`
       is the only thing remembered, and every way it can be wrong makes this
       MORE permissive, never less: stale, absent or cleared, the next event
       reads as isolated and is served. That is the difference from the pager
       this replaced, where `armed`, `deadDir` and `animating` all failed
       CLOSED — a stale value there meant a person's hand did nothing, which
       is exactly what he reported three times.

       WHY NOT ASK WHETHER THE SCROLLER IS AT REST — measured, and it is racy:
       by the time the handler runs, the browser has already applied the
       scroll, so `scrollTop` reads mid-page for the very first event of a
       gesture. A question whose answer arrives after the fact is not a
       question worth asking.

       Everything else — every trackpad gesture, every touch, every fling and
       every reversal — returns on the first line and is handled by the
       compositor, untouched. */
    var lastWheel = 0;
    function onWheel(e) {
      var now = (global.performance || Date).now();
      var alone = now - lastWheel > 120;
      lastWheel = now;
      if (!e.deltaY) return;
      var notch = e.deltaMode !== 0 || Math.abs(e.deltaY) % 100 === 0;
      if (!notch || !alone) return;
      e.preventDefault();
      go(idx + (e.deltaY > 0 ? 1 : -1), 'wheel');
    }

    /* ── KEYBOARD ──────────────────────────────────────────────────────── */
    function onKey(e) {
      /* ── THE KEYS WORK WHEREVER FOCUS IS ─────────────────────────────────
         The listener was on the scroller, so the arrow keys did nothing unless
         the scroller itself had focus — and pressing the Scroll switch leaves
         focus on the switch (measured 2026-09-21, founder/478). It listens on
         the document while the pager lives, and stands aside for typing and
         for anything open over the view. */
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
      if (doc.querySelector('.po-sheet.is-open, .ow-proj.is-on, .ow-viewer')) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
        e.preventDefault(); advance(1, 'key');
      } else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) {
        e.preventDefault(); advance(-1, 'key');
      } else if (k === 'Home') { e.preventDefault(); go(0, 'key'); }
      else if (k === 'End') { e.preventDefault(); go(count() - 1, 'key'); }
    }

    /* ── WHICH POSITION IS THE PERSON ON ───────────────────────────────────
       An IntersectionObserver, never a scroll listener: a scroll handler runs
       on the main thread and competes for exactly the frames a transition
       needs. Touch never calls `go`, so this is how the index stays true when
       the native scroller is the one doing the work. */
    function watch() {
      if (!global.IntersectionObserver) return;
      io = new global.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var en = entries[i];
          if (!en.isIntersecting || en.intersectionRatio < 0.55) continue;
          /* THE POSITION'S OWN INDEX, not its place among the children. With a
             bounded window there is a spacer at the front and only a handful
             of positions mounted, so `indexOf` in `children` is not the feed
             index any more — and reading it as one would make the pager think
             the person had jumped to position 1 on every prune. */
          var at = parseInt(en.target.getAttribute('data-fpos'), 10);
          if (!isNaN(at) && at !== idx) { idx = at; if (onIndex) onIndex(idx); }
        }
      }, { root: scroller, threshold: [0.55] });
      Array.prototype.forEach.call(
        scroller.querySelectorAll('.ow-fpos[data-fpos]'),
        function (n) { io.observe(n); });
    }

    function onResize() {
      var was = idx;
      measure();
      /* re-pin without animating — a resize is not a navigation */
      var prev = scroller.style.scrollSnapType;
      scroller.style.scrollSnapType = 'none';
      scroller.scrollTop = Math.round(was * H);
      /* restore on the next frame, once the new scrollTop has been taken */
      global.requestAnimationFrame(function () {
        scroller.style.scrollSnapType = prev || '';
      });
    }

    measure();
    /* The compositor's snap scroller is the pager. `onWheel` claims exactly
       one case it cannot serve — a discrete mouse notch — and returns on the
       first line for everything else (founder/488). */
    scroller.addEventListener('wheel', onWheel, { passive: false });
    doc.addEventListener('keydown', onKey);
    global.addEventListener('resize', onResize);
    watch();
    if (onIndex) onIndex(0);

    return {
      go: go,
      advance: advance,
      index: function () { return idx; },
      count: count,
      /* NEW POSITIONS NEED WATCHING TOO. Appending to the scroller does not
         put them under the observer that decides which one is active, so a
         feed that grew would stop knowing where the person was. */
      rewatch: function () {
        if (io) { try { io.disconnect(); } catch (e) {} io = null; }
        watch();
      },
      observe: function () { if (io) { try { io.disconnect(); } catch (e) {} } watch(); },
      destroy: function () {
        destroyed = true;
        scroller.removeEventListener('wheel', onWheel);
        doc.removeEventListener('keydown', onKey);
        global.removeEventListener('resize', onResize);
        if (io) { try { io.disconnect(); } catch (e) {} io = null; }
        scroller.style.scrollSnapType = '';
      }
    };
  }

  /* ═══ 6 · PROJECT ══════════════════════════════════════════════════════ */

  /* ── PAIR A ROW WITH ITS CARD BY IDENTITY, NOT BY POSITION ──────────────
     Both lists are built in feed order, so index k SHOULD be the same Post in
     each — and when it is not, nothing says so. Measured on localhost: a
     four-photo Post composed into a TEXT group, because the card the composer
     read at that index belonged to a different Post and had no media block.
     Everything downstream then followed the wrong answer: wrong page kind,
     wrong size, 467px of photo strip hanging off a page built for sentences.

     A Post has an id and its card carries it. Matching on that cannot drift,
     whatever order the surface mounted things in or inserted between them.
     Cards with no id — an external slot — keep their place in the queue, so
     the fallback is exactly the previous behaviour.

     Returns the two lists trimmed to what actually pairs, plus whatever cards
     nothing claimed, which the caller detaches. */
  function alignByIdentity(cards, items) {
    var byId = {}, k;
    for (k = 0; k < cards.length; k++) {
      var cid = cards[k].getAttribute && cards[k].getAttribute('data-po-id');
      if (cid && !byId[cid]) byId[cid] = cards[k];
    }
    var claimed = {}, lp = 0, matched = 0;
    var loose = cards.filter(function (c) {
      var id = c.getAttribute && c.getAttribute('data-po-id');
      return !id || byId[id] !== c;
    });
    var pairedCards = [], pairedItems = [];
    for (k = 0; k < items.length; k++) {
      var row = items[k];
      var g = (row && row.post) ? row.post : row;
      var id = g && g.id;
      var c = null;
      if (id && byId[id] && !claimed[id]) { c = byId[id]; claimed[id] = 1; matched++; }
      else { c = loose[lp++] || null; }
      if (c) { pairedCards.push(c); pairedItems.push(row); }
    }
    if (!matched) return { cards: cards, items: items, orphans: [] };
    var orphans = cards.filter(function (c) { return pairedCards.indexOf(c) < 0; });
    return { cards: pairedCards, items: pairedItems, orphans: orphans };
  }

  /* ONE COMPOSER, TWO CALLERS. The first batch and every later append run
     through this — so a position added on the fortieth swipe is built by
     exactly the code that built the first, and cannot drift from it. */
  function composeInto(river, cards, items, narrow, budget, carry) {
    var pen = positionEl('group');
    pen.classList.add('ow-fmeasure');
    var inner = mk('div', 'ow-fgroup');
    pen.appendChild(inner);
    river.appendChild(pen);

    var mounted = [];
    function fits(group) {
      while (mounted.length) {
        var drop = mounted.pop();
        if (drop.parentNode) drop.parentNode.removeChild(drop);
      }
      if (group.length > maxComposed()) return false;
      for (var k = 0; k < group.length; k++) {
        var c = cards[group[k].index];
        if (!c) continue;
        place(c, group[k], k);
        inner.appendChild(c);
        mounted.push(c);
      }
      /* DOES THE STACK FIT. With the column packed from the top,
         `scrollHeight` IS the content height and `clientHeight` is the room —
         one comparison, no per-child arithmetic to get wrong.

         The version this replaces walked `offsetTop + offsetHeight` while the
         column was CENTRED, which under-reports: centring moves the stack up
         by half of whatever you add, so the measured bottom grew at half rate
         and the packer stopped at three Popits with 470px of the page unused. */
      var room = inner.clientHeight || budget;
      var tail = inner.lastElementChild;
      if (OW.feed.trace) {
        OW.feed.trace.push({ n: group.length, room: room,
                             used: tail ? (tail.offsetTop + tail.offsetHeight) : 0,
                             each: mounted.map(function (c) { return c.offsetHeight; }) });
      }
      /* PACKED FROM THE TOP, so the bottom of the last child IS the content
         height — exact, and immune to the ~12px `scrollHeight` inflates on a
         sub-pixel flex column (measured: 807 laid out, 819 reported). */
      var used = tail ? (tail.offsetTop + tail.offsetHeight) : 0;
      return used <= room;
    }

    var plan = OW.feed.compose(items, { fits: fits,
                                        max: maxComposed(),
                                        carry: !!carry,
                                        window: 12,
                                        isMedia: function (k, byFace) {
                                          /* THE CARD IS THE ANSWER WHEN THERE
                                             IS ONE. When there is not — a
                                             renderer that returned fewer
                                             elements than rows — fall back to
                                             the payload rather than answering
                                             "text", which is how a four-photo
                                             Post ended up as the first item of
                                             a text group at 467px tall. */
                                          var c = cards[k];
                                          if (!c || !c.querySelector) return byFace(k);
                                          return !!c.querySelector('.po-card__media');
                                        } });
    plan.forEach(function (pos) {
      var host = positionEl(pos.kind);
      pos.el = host;
      if (pos.kind === 'media') {
        host.setAttribute('data-media', pos.media);
        var c = cards[pos.items[0].index];
        if (c) { c.classList.add('po-card--imm'); host.appendChild(c); }
      } else {
        var box = mk('div', 'ow-fgroup');
        box.setAttribute('data-n', String(pos.items.length));
        if (pos.solo) host.setAttribute('data-solo', '1');
        pos.items.forEach(function (p) {
          var el = cards[p.index];
          if (el) box.appendChild(el);
        });
        host.appendChild(box);
      }
    });
    if (pen.parentNode) pen.parentNode.removeChild(pen);
    /* THE LEFTOVER TRAVELS AS ROWS AND CARDS TOGETHER. `compose` indexes into
       `cards` by position in `items`, so the two arrays must be prepended to
       the next batch in step or every index would point at the wrong Post. */
    plan.carried = (plan.leftover || []).map(function (e) {
      return { row: items[e.index], card: cards[e.index] };
    }).filter(function (c) { return c.row && c.card; });
    return plan;
  }

  /* ONE PAGE, ONE BUILDER — used for the measuring pen and for every mounted
     position, so the thing measured and the thing rendered cannot drift. */
  function positionEl(kind) {
    var host = mk('div', 'ow-fpos');
    host.setAttribute('data-kind', kind);
    return host;
  }

  var live = null;

  OW.feed.project = function (river, items, opts) {
    opts = opts || {};
    if (!river || !items || !items.length) return null;
    OW.feed.restore(river);

    /* the rendered cards, in feed order. `paintExternal` may have swapped a
       `.po-card` for an `.ow-xc-slot`, so both are collected — order is the
       contract, not the class. */
    var cards = [];
    Array.prototype.forEach.call(river.children, function (n) {
      if (n.classList && (n.classList.contains('po-card') || n.classList.contains('ow-xc-slot'))) {
        cards.push(n);
      }
    });
    var pair = alignByIdentity(cards, items);
    cards = pair.cards; items = pair.items;
    pair.orphans.forEach(function (c) { if (c.parentNode === river) river.removeChild(c); });

    /* ── A MISSING CARD IS DRAWN, NOT DROPPED ─────────────────────────────
       ★ FOUNDER, 2026-08-30: *"scroll is currently violating the laws we
         already set."*  It was, and this is why.

       Home fills its river progressively. Pressing Scroll a few seconds after
       opening the App found 24 feed rows against 7 mounted cards — so the
       viewer composed SEVEN POSTS and every law failed at once, downstream of
       that one fact:

         · none of the seven happened to carry media, so there were no media
           positions at all — video and photo Posts never got their own
           full-frame page (the ruling that they take the page like a video)
         · seven Posts spread over six pages gave groups of ONE and TWO, so
           almost every screen was mostly empty ("screens should appear full
           unless there are no posts to populate them")
         · with no media positions there was nothing for text groups to be
           rarer than

       An earlier version REFUSED on any mismatch; I replaced that with a
       PREFIX, which turned a visible failure into a quiet one — the viewer
       opened, looked plausible, and was composing a third of the feed.

       Neither is right, because both treat "no card yet" as "no Post". The
       surface already hands us `render`, which is how `more()` draws every
       later batch. So a row without a card gets one drawn the same way, and
       the viewer composes the WHOLE feed it was given. No truncation, no
       refusal, and no second renderer — Home still owns rendering. */
    if (cards.length !== items.length) {
      var pairedCards = [], pairedItems = [], missing = [];
      var byCard = {};
      cards.forEach(function (c) {
        var id = c.getAttribute && c.getAttribute('data-po-id');
        if (id) byCard[id] = c;
      });
      var loose = cards.filter(function (c) {
        var id = c.getAttribute && c.getAttribute('data-po-id');
        return !id || byCard[id] !== c;
      });
      var lp = 0;
      items.forEach(function (row) {
        var g = (row && row.post) ? row.post : row;
        var id = g && g.id;
        var c = (id && byCard[id]) ? byCard[id] : (loose[lp] || null);
        if (c && !(id && byCard[id])) lp++;
        if (c) { pairedCards.push(c); pairedItems.push(row); }
        else { missing.push(row); }
      });

      if (missing.length && opts.render) {
        /* DRAWN BY THE SURFACE, in feed order, and appended so document order
           still matches. A render that throws leaves those rows out rather
           than taking the whole viewer down with it. */
        var drawn = [];
        try { drawn = opts.render(missing) || []; } catch (e) { drawn = []; }
        for (var m = 0; m < missing.length && m < drawn.length; m++) {
          river.appendChild(drawn[m]);
          pairedCards.push(drawn[m]);
          pairedItems.push(missing[m]);
        }
        try {
          console.warn('feed: ' + missing.length + ' row(s) had no card yet — '
                       + drawn.length + ' drawn so the whole feed composes');
        } catch (e) {}
      }
      cards = pairedCards;
      items = pairedItems;
      if (!cards.length) return null;
    }

    river.classList.add('ow-fscroll');

    /* THE PAGE'S OWN ROOM, measured once from a real position so the composer
       and the mounted result cannot disagree about how much space there is. */
    var narrow = (river.clientWidth || global.innerWidth || 0) < 560;
    var probe = positionEl('group');
    probe.classList.add('ow-fmeasure');
    var probeBox = mk('div', 'ow-fgroup');
    probe.appendChild(probeBox);
    river.appendChild(probe);
    var budget = probeBox.clientHeight
      || (river.clientHeight || global.innerHeight || 720);
    if (probe.parentNode) probe.parentNode.removeChild(probe);

    /* THE FIRST BATCH CARRIES TOO, when there is a `more` behind it. Without
       this the very first screens already showed the batch boundary. */
    var positions = composeInto(river, cards, items, narrow, budget, !!opts.more);

    var frag = doc.createDocumentFragment();
    positions.forEach(function (pos, pi) {
      pos.el.setAttribute('data-fpos', String(pi));
      frag.appendChild(pos.el);
    });
    river.appendChild(frag);

    /* ── THE SCROLLER HOLDS PAGES, NOTHING ELSE ──────────────────────────
       Every `.po-card` composition consumed has moved into a position. Any
       left as a direct child is one Home mounted between this function reading
       `river.children` and finishing — a real race, because Home fills its
       river progressively — and it would sit in the scroller as a page-height
       fragment wedged between two real pages, breaking `scrollTop == index *
       pageHeight` for everything after it. Measured on localhost as a stray
       495px Popit and a scroller 495px longer than the feed.

       Its ROW is still in the feed and returns through `more()`; only the
       orphaned element goes. */
    var strays = 0;
    Array.prototype.slice.call(river.children).forEach(function (n) {
      if (n.classList && n.classList.contains('po-card')) {
        river.removeChild(n); strays++;
      }
    });
    if (strays) {
      try { console.warn('feed: removed ' + strays + ' card(s) left loose in the scroller'); } catch (e) {}
    }

    /* THE FEED ENDS ONLY WHEN IT GENUINELY HAS. The marker is appended so it
       is always last, and stays hidden until the backend says the pool is
       exhausted — running out of UNSEEN content is not the end. */
    var tailEl = null;
    if (opts.tail) {
      tailEl = positionEl('end');
      tailEl.appendChild(opts.tail);
      river.appendChild(tailEl);
    }

    river.setAttribute('tabindex', '0');

    /* `live` IS SET BEFORE THE PAGER EXISTS, and that ordering is load-bearing.
       `pager()` reports its starting index from inside its own constructor, so
       the first `onIndex(0)` fires while this assignment is still pending — and
       `prepare` reads `live`. Written the other way round (it was), position
       ZERO was never prepared: the first video in the feed got no player, no
       autoplay and no warm neighbours, and only started working once a person
       scrolled away and back. Caught by the video probe, because the real feed
       has no video in it to catch it with. */
    live = { river: river, positions: positions, pager: null, over: null,
             narrow: narrow, budget: budget, tailEl: tailEl,
             /* the surface owns rendering and knows what "more" means */
             more: opts.more || null, render: opts.render || null,
             onSeen: opts.onSeen || null, loading: false, done: false,
             /* what did not fill a page last time, waiting for the next batch */
             carried: positions.carried || [], dryRounds: 0 };

    var p = pager(river, function (i) {
      river.setAttribute('data-at', String(i));
      /* BOUND THE DOM BEFORE ANYTHING ELSE. Mounting what is needed and
         dropping what is not has to happen before `prepare` looks for a
         player, or it would warm a position that is about to be removed. */
      window_(i);
      /* ── KEEP GOING BEFORE THE END ARRIVES ──────────────────────────────
         ★ FOUNDER, 2026-08-29: *"Prefetch additional candidates before the
           current set is exhausted… never make the user manually refresh."*
         Asked here rather than at the last position, because arriving at the
         end and THEN fetching is the spinner this exists to prevent. */
      extend(i);
      report(i);
      var pos = positions[i] || null;
      /* WHAT THE PERSON IS STANDING IN.
         ★ FOUNDER: *"The Galaxy is simply the environment in which the grouped
           text content exists… Video does not use the Galaxy background."*
         So the environment is a property of the POSITION, never of the mode.
         The scroller carries it so the page behind can answer — and nothing
         animates, because the founder ruled out a cinematic transition
         between groups by name. */
      river.setAttribute('data-env', pos && pos.kind === 'media' ? 'dark' : 'galaxy');
      prepare(i);
      if (opts.onIndex) opts.onIndex(i, pos);
    }, { total: function () { return (live && live.positions.length) || 0; } });

    /* ── SCROLL OPENS AT THE FIRST POST, NOT WHERE FEED WAS LEFT ────────
       ONE element carries both modes, so the pager inherits Feed's scroll
       offset — measured 5,685px, which in a snap container is the LAST page.
       Tapping Scroll landed on "More from your world. Keep scrolling.", the
       end-of-feed card, as though the person had already seen everything they
       had just asked to see.

       AFTER the pages exist and the pager is built, not before. Reset first and
       the layout that follows puts the offset straight back — measured: 4,873px
       on the next run, which is how I learned the difference. */
    river.scrollTop = 0;
    if (p && typeof p.to === 'function') { try { p.to(0); } catch (e) {} }

    live.pager = p;
    return live;
  };

  OW.feed.restore = function (river) {
    /* leaving Scroll takes the stray sweep with it — an observer that outlives
       the mode it was built for is a leak that also fights the Feed layout */
    if (OW.feed.stopStrayWatch) OW.feed.stopStrayWatch();
    if (!river) return;
    if (live && live.river === river && live.pager) { try { live.pager.destroy(); } catch (e) {} }
    if (live && live.river === river) live = null;
    var kept = [];
    Array.prototype.forEach.call(river.querySelectorAll('.ow-fpos'), function (pos) {
      Array.prototype.forEach.call(pos.querySelectorAll('.po-card, .ow-xc-slot, .ow-caught'),
        function (c) { kept.push(c); });
    });
    Array.prototype.forEach.call(
      river.querySelectorAll('.ow-fpos, .ow-fmeasure, .ow-fspacer'),
      function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    kept.forEach(function (c) {
      c.classList.remove('po-card--imm');
      c.removeAttribute('data-fsize');
      c.style.removeProperty('--fw');
      c.style.removeProperty('--fx');
      c.style.removeProperty('--fy');
      river.appendChild(c);
    });
    river.classList.remove('ow-fscroll');
    river.removeAttribute('data-at');
    river.removeAttribute('data-env');
    river.removeAttribute('tabindex');
  };

  OW.feed.current = function () { return live; };
  OW.feed.active = function () { return !!live; };

  /* ═══ 6b · CONTINUITY — MORE POSITIONS, BEFORE THEY ARE NEEDED ════════

     ★ FOUNDER, 2026-08-29: *"The user must never become trapped after a few
       swipes merely because the current candidate batch is exhausted."*

     The backend makes the feed inexhaustible (`/api/oneway/feed/stream` — see
     `oneway/feed/continuity.py`). This is the half that keeps ASKING: when the
     person is within `LOOKAHEAD` positions of the end, one more batch is
     fetched, rendered by the surface that owns rendering, composed with the
     same machinery the first batch used, and appended.

     ONE REQUEST IN FLIGHT AT A TIME. Two swipes in quick succession must not
     produce two batches of the same content — `loading` is the whole guard,
     and it is released only when the append is done.

     THE SURFACE RENDERS, NOT THIS FILE. `opts.render(rows)` hands back wired
     `.po-card` elements, because wiring a card means knowing about responses,
     the post route and the person route — all of which belong to Home. This
     module composes and pages; it still never renders a Post. */

  var LOOKAHEAD = 3;

  /* every Post id this viewer already holds — composed into a position, or
     carried forward waiting for a page */
  function shownIds(h) {
    var had = {};
    function take(row) {
      var id = ((row && row.post) || row || {}).id;
      if (id) had[id] = 1;
    }
    ((h && h.positions) || []).forEach(function (pos) {
      ((pos && pos.items) || []).forEach(function (x) {
        take(x && x.item !== undefined ? x.item : x);
      });
    });
    ((h && h.carried) || []).forEach(function (c) { take(c && c.row); });
    return had;
  }

  function extend(i) {
    if (!live || !live.more || live.loading || live.done) return;
    /* HOW MANY POSITIONS THERE ARE, ASKED OF `positions` RATHER THAN THE PAGER.
       The pager announces its starting index from inside its own constructor,
       so the first call lands here while `live.pager` is still null — reading
       `live.pager.count()` threw, the constructor never returned, and the
       whole viewer mounted with no pager and no positions. The same ordering
       trap `prepare` already had; `positions` is set before the pager exists
       and is the honest source for this anyway. */
    var total = (live.positions || []).length;
    if (i < total - 1 - LOOKAHEAD) return;
    live.loading = true;
    var handle = live;
    Promise.resolve()
      .then(function () { return handle.more(); })
      .then(function (rows) {
        if (handle !== live) return;                 /* the viewer moved on */
        rows = rows || [];
        /* ── A POST IS SHOWN ONCE PER SCROLL ─────────────────────────────
           ★ FOUNDER/482: cards *"accurate when clicked anywhere"* — and a
             feed that shows the same Post twice is not accurate about what
             the person's world did.
           The first batch comes from `/api/oneway/home`; every later one
           from `/api/oneway/feed/stream`, which ranks by what has been
           marked SEEN — and only what reached the screen is marked. So the
           stream legitimately re-offers Posts the first batch already holds
           further down. Measured 2026-09-21 on loop.ada: 44 positions, 42
           unique — `post_cd40d0…` at 19 and 31, `post_f104b2…` at 18 and
           33. The seam is between two reads; this side closes it by id
           against everything already composed or carried. */
        var had = shownIds(handle);
        rows = rows.filter(function (r) {
          var id = ((r && r.post) || r || {}).id;
          if (!id) return true;
          if (had[id]) return false;
          had[id] = 1;
          return true;
        });
        if (!rows.length) {
          /* NOTHING CAME BACK. Not necessarily the end — a source may have
             been unreadable — so this stops asking for a moment rather than
             declaring the feed over. `done` is only set when the backend says
             it is genuinely exhausted. */
          handle.loading = false;
          /* BUT A CARRY MUST NOT BE HELD HOSTAGE BY AN EMPTY BATCH. If posts
             are waiting to be placed and nothing more is coming, they are
             placed now — a short page at the end of the feed is the one place
             a short page is honest, and holding them back would lose them. */
          flushCarry();
          return;
        }
        appendItems(rows);
      })
      .catch(function () {
        /* A FAILED FETCH MUST NOT END THE FEED. The person keeps whatever is
           already composed and the next arrival tries again. */
        if (handle === live) handle.loading = false;
      });
  }

  /* THE LAST PAGE MAY BE SHORT — nothing else may. Composed with `carry`
     off, so whatever is held gets placed however little of the page it fills. */
  function flushCarry() {
    var h = live;
    if (!h || !h.carried || !h.carried.length) return;
    var rows = h.carried.map(function (c) { return c.row; });
    var cards = h.carried.map(function (c) { return c.card; });
    h.carried = [];
    var made = composeInto(h.river, cards, rows, h.narrow, h.budget, false);
    if (!made.length) return;
    var frag = doc.createDocumentFragment();
    made.forEach(function (pos) { frag.appendChild(pos.el); });
    if (h.tailEl && h.tailEl.parentNode === h.river) h.river.insertBefore(frag, h.tailEl);
    else h.river.appendChild(frag);
    h.positions.push.apply(h.positions, made);
    if (h.pager) h.pager.rewatch();
  }

  function appendItems(rows) {
    var h = live;
    if (!h) return;
    var cards = [];
    try { cards = (h.render && h.render(rows)) || []; } catch (e) { cards = []; }
    if (!cards.length) { h.loading = false; return; }

    /* ── WHAT DID NOT FILL A PAGE LAST TIME GOES FIRST ────────────────────
       Prepended rather than appended so the feed's own order is preserved:
       these Posts were already next when the batch ran out. Their CARDS come
       with them — they are wired, they are the same canonical Posts, and
       re-rendering them would make a second element for one Post. */
    if (h.carried && h.carried.length) {
      rows = h.carried.map(function (c) { return c.row; }).concat(rows);
      cards = h.carried.map(function (c) { return c.card; }).concat(cards);
      h.carried = [];
    }
    var surplus = [];
    /* SAME PAIRING RULE AS THE FIRST BATCH. This path renders its own cards,
       so a row the renderer skipped shifts every later pairing — and the
       composer asks the CARD whether a Post has media. */
    var pair = alignByIdentity(cards, rows);
    (pair.orphans || []).forEach(function (c) {
      if (c && c.parentNode) c.parentNode.removeChild(c);
    });
    if (pair.items.length !== rows.length) {
      surplus = rows.filter(function (r) { return pair.items.indexOf(r) < 0; })
                    .map(function (r) { return { row: r, card: null }; })
                    .filter(function (c) { return !!c.card; });
    }
    cards = pair.cards; rows = pair.items;
    if (!rows.length) { h.loading = false; return; }

    /* ── ROWS AND CARDS MUST STAY IN STEP HERE TOO ───────────────────────
       `project` has guarded this since the first version; this path never did,
       and it is the path every batch after the first goes through. A renderer
       that hands back fewer elements than rows (one row it cannot draw is
       enough) shifts every later pairing by one — and because the composer
       asks the CARD whether a Post has media, a missing card reads as "text"
       and a photo Post is composed into a text stack. Measured on localhost:
       a four-photo Post as item 0 of a five-Popit group, 467px tall in a
       812px page, its strip hanging 555px past the page it was on.

       The surplus rows are carried, not dropped — they are still real Posts
       and the next batch will place them. */
    if (cards.length !== rows.length) {
      var keep = Math.min(cards.length, rows.length);
      try {
        console.warn('feed: batch row/card count disagree (' + rows.length + '/' +
                     cards.length + ') — placing ' + keep + ', carrying the rest');
      } catch (e) {}
      surplus = rows.slice(keep).map(function (row, i) {
        return { row: row, card: cards[keep + i] };
      }).filter(function (c) { return c.row && c.card; });
      cards.slice(keep).forEach(function (c) {
        if (c && c.parentNode) c.parentNode.removeChild(c);
      });
      rows = rows.slice(0, keep);
      cards = cards.slice(0, keep);
      if (!rows.length) { h.carried = surplus; h.loading = false; return; }
    }

    var made = composeInto(h.river, cards, rows, h.narrow, h.budget, !h.done);

    /* ── THE SCROLLER HOLDS PAGES, ON EVERY BATCH — NOT ONLY THE FIRST ────
       ★ FOUNDER, 2026-09-08: the only UI work worth doing is genuine quality
         work. This is that: the surface was visibly wrong and measurably so.

       MEASURED in the browser, signed in, after scrolling a real feed:

           .po-river.ow-fscroll   children: 72 x .po-card, 4 x .ow-fpos

       SEVENTY-TWO CARDS LOOSE IN A MANDATORY-SNAP SCROLLER. Each is ~190px in
       a 551px page, so the snap points land mid-card and Scroll renders as a
       stack of small Feed cards instead of one Post per screen — the immersive
       mode showing the feed's own layout.

       `project` already sweeps strays and says exactly why: a loose card
       "would sit in the scroller as a page-height fragment wedged between two
       real pages, breaking `scrollTop == index * pageHeight`". That sweep runs
       ONCE, at build. Every batch after the first goes through here, where the
       renderer appends its cards to the river as a side effect and the
       composer is expected to move all of them into pages. Anything it does
       not move stays exactly where the renderer put it.

       CARRIED, NOT DELETED. A loose card is a real Post that has not found a
       page yet, and this file already has the mechanism for that — the same
       carry the composer uses when a batch does not fill one. Removing them
       would lose Posts to tidy the DOM; carrying them means the next batch
       places them, in feed order, with the element they already have. */
    var loose = Array.prototype.slice.call(h.river.children).filter(function (n) {
        return n.classList && n.classList.contains('po-card');
    });
    if (loose.length) {
        var back = alignByIdentity(loose, rows);
        var rescued = [];
        (back.cards || []).forEach(function (c, i) {
            var row = (back.items || [])[i];
            if (!row) { return; }
            if (c && c.parentNode) { c.parentNode.removeChild(c); }
            rescued.push({ row: row, card: c });
        });
        /* AN ELEMENT WITH NO ROW CANNOT BE CARRIED — there is nothing to place
           it against on the next batch — so it goes, and it is reported. It is
           the one case where losing the element is right: it is already
           outside every page and is drawing over the reader's screen. */
        (back.orphans || []).forEach(function (c) {
            if (c && c.parentNode) { c.parentNode.removeChild(c); }
        });
        try {
            console.warn('feed: ' + loose.length + ' card(s) were left loose in '
                + 'the scroller — ' + rescued.length + ' carried to the next '
                + 'batch, ' + ((back.orphans || []).length) + ' unpairable');
        } catch (e) {}
        surplus = rescued.concat(surplus);
    }

    /* THE COMPOSER'S CARRY FIRST, THEN THE SURPLUS — feed order either way. */
    h.carried = (made.carried || []).concat(surplus);
    if (!made.length) {
      /* EVERY ROW WENT INTO THE CARRY. Nothing was appended, so no position
         change will happen to ask again — this has to ask for itself, or the
         person is stranded one swipe from the end holding a part-page. Bounded,
         so an endpoint that returns the same nothing forever cannot spin. */
      h.loading = false;
      h.dryRounds = (h.dryRounds || 0) + 1;
      if (h.dryRounds < 4 && !h.done && h.pager) {
        extend(h.pager.index());
      }
      return;
    }
    h.dryRounds = 0;

    /* BEFORE THE TAIL, so "you are caught up" stays the last thing. */
    var frag = doc.createDocumentFragment();
    made.forEach(function (pos) { frag.appendChild(pos.el); });
    if (h.tailEl && h.tailEl.parentNode === h.river) {
      h.river.insertBefore(frag, h.tailEl);
    } else {
      h.river.appendChild(frag);
    }
    h.positions.push.apply(h.positions, made);
    if (h.pager) h.pager.rewatch();
    h.loading = false;
  }

  /* WHAT THE PERSON ACTUALLY SAW. Reported from the surface because only the
     surface knows what reached the screen — serving a Post is not showing it,
     and recording exposure at serve time would suppress content nobody ever
     looked at. */
  function report(i) {
    if (!live || !live.onSeen) return;
    var pos = live.positions[i];
    if (!pos || pos.reported) return;
    pos.reported = true;
    var ids = (pos.items || []).map(function (e) { return e.face.id; })
      .filter(Boolean);
    if (ids.length) { try { live.onSeen(ids); } catch (e) {} }
  }

  /* ═══ 6c · A BOUNDED DOM, INSIDE AN UNBOUNDED FEED ═════════════════════

     ★ FOUNDER, 2026-08-29: *"30 -> 238 cards after 55 swipes. That means the
       feed can eventually degrade despite every functional test remaining
       green… The user should experience an effectively infinite feed while the
       browser maintains only a bounded active DOM window."*

     Measured, and it was real: nothing was ever removed, so the card count grew
     with every swipe and would keep growing until the tab died. Every suite
     stayed green throughout, which is exactly the point — a leak is invisible
     to functional tests.

     THE WINDOW:

                     spacer (exactly the height of what was removed)
             N-2  ┐
             N-1  │
             N    │  mounted
             N+1  │
             N+2  ┘
                     (nothing beyond is built until it is approached)

     WHY A SPACER RATHER THAN REFLOWING. Every position is exactly one page
     tall, so a spacer of `removed * pageHeight` keeps `scrollTop == index *
     pageHeight` true forever. No scroll compensation, no drift, no jump — the
     arithmetic the pager already relies on is simply preserved. Removing the
     elements without it would yank the page under the person's thumb.

     WHY POSITIONS CAN BE REBUILT. A pruned position keeps its ROWS, which are
     small data, and drops its ELEMENTS, which are not. Scrolling back re-renders
     it through the same `render` the surface uses for new content, and the
     stack has no arrangement to choose — same Posts, same order, same column —
     so a Post returns to the exact spot it left. */

  var KEEP_BEHIND = 2;
  var KEEP_AHEAD = 2;

  function pageH() {
    return (live && live.river && live.river.clientHeight) || 1;
  }

  function unmountPosition(pos) {
    if (!pos || !pos.el) return;
    /* THE CARDS GO WITH IT. Detaching the position but keeping references to
       its cards would move the leak rather than remove it. */
    if (pos.el.parentNode) pos.el.parentNode.removeChild(pos.el);
    pos.el = null;
    pos.mounted = false;
  }

  function mountPosition(pos, index) {
    if (!live || !pos || pos.el) return;
    var rows = (pos.items || []).map(function (e) { return e.item; });
    var cards = [];
    try { cards = (live.render && live.render(rows)) || []; } catch (e) { cards = []; }
    if (!cards.length) return;

    var host = positionEl(pos.kind);
    host.setAttribute('data-fpos', String(index));
    if (pos.kind === 'media') {
      host.setAttribute('data-media', pos.media || 'video');
      cards[0].classList.add('po-card--imm');
      host.appendChild(cards[0]);
    } else {
      var box = mk('div', 'ow-fgroup');
      box.setAttribute('data-n', String(pos.items.length));
      if (pos.solo) host.setAttribute('data-solo', '1');
      /* DETERMINISTIC: the same group always composes the same way, so a
         rebuilt page is the page the person left, not a new arrangement. */
      pos.items.forEach(function (e, k) {
        var c = cards[k];
        if (!c) return;
        place(c, e, k);
        box.appendChild(c);
      });
      host.appendChild(box);
    }
    pos.el = host;
    pos.mounted = true;

    /* ── THE PAGE IS THE CONSTRAINT, CHECKED AGAIN ON ARRIVAL ─────────────
       ★ FOUNDER, 2026-08-29: *"The boundary is the constraint; the content
         must fit inside it… Do not use `overflow: visible` as a workaround. If
         a Post genuinely contains too much text for its assigned Popit size,
         the composition engine should assign that Post a more appropriate
         Popit size."*

       `fits` measured this group when it was composed. A rebuilt page is
       measured AGAIN, because the two moments are not the same moment: media
       that had not decoded, a font that had not loaded, or a row the renderer
       drew differently all change a card's height after the fact — and when
       that happened the stack simply hung past the page, 555px of Popit
       painted over the page below it.

       So anything that no longer fits is taken off this page and carried. It
       is not dropped: it goes back to the front of the queue and gets a page
       where it does fit, which is the "more appropriate arrangement" the
       ruling asks for rather than a distorted container. */
    if (pos.kind !== 'media' && box) {
      var room = box.clientHeight || pageH();
      var spill = [];
      while (box.lastElementChild &&
             (box.lastElementChild.offsetTop + box.lastElementChild.offsetHeight) > room &&
             box.children.length > 1) {
        var over = box.lastElementChild;
        box.removeChild(over);
        spill.unshift(pos.items[box.children.length]);
      }
      if (spill.length) {
        pos.items = pos.items.slice(0, box.children.length);
        host.querySelector('.ow-fgroup').setAttribute('data-n', String(pos.items.length));
        var back = spill.filter(Boolean).map(function (e, k) {
          return { row: e.item, card: cards[box.children.length + k] };
        }).filter(function (c) { return c.row && c.card; });
        live.carried = back.concat(live.carried || []);
        try {
          console.warn('feed: position ' + index + ' overflowed on rebuild — ' +
                       spill.length + ' Popit(s) carried to a page that holds them');
        } catch (e) {}
      }
    }

    /* PUT IT BACK WHERE IT BELONGS — after the last mounted position before it,
       so document order still matches feed order. */
    var before = null;
    for (var j = index + 1; j < live.positions.length; j++) {
      if (live.positions[j].el) { before = live.positions[j].el; break; }
    }
    if (!before && live.tailEl && live.tailEl.parentNode === live.river) {
      before = live.tailEl;
    }
    live.river.insertBefore(host, before);
  }

  function window_(idx) {
    if (!live || !live.render) return;      /* no rebuild path -> never prune */
    var P = live.positions, H = pageH();
    var lo = Math.max(0, idx - KEEP_BEHIND);
    var hi = Math.min(P.length - 1, idx + KEEP_AHEAD);

    for (var i = 0; i < P.length; i++) {
      if (i >= lo && i <= hi) {
        if (!P[i].el) mountPosition(P[i], i);
      } else if (P[i].el) {
        unmountPosition(P[i]);
      }
    }

    /* ── THE SPACERS ARE THE SCROLL MATHS, AND THERE HAVE TO BE TWO ────────
       Their heights are exactly the ground the removed positions used to
       occupy, so `scrollTop == index * pageHeight` stays true and nothing
       under the thumb moves.

       THERE WAS ONLY A LEADING ONE, and that is a scale defect rather than a
       tidiness one. Measured 2026-08-29: 22 positions, `scrollHeight` 4,995px
       where 22 x 900 = 19,800. Everything after the mounted window had been
       unmounted with nothing standing in for it, so the scroller's whole range
       WAS the window. The feed still moved forward — each advance re-windows,
       which mounts the next page just in time — so it looked fine and the leak
       fix looked complete. But the arithmetic every jump relies on was false
       for any index past `hi`: `pager.go(1)` from the tail left the person
       looking at "You are caught up", because the scroll position it computed
       did not exist in a 4,995px scroller.

       A trailing spacer restores the range. Both are `.ow-fspacer`: they paint
       nothing, catch nothing, and hold ground. */
    if (!live.spacer) {
      live.spacer = mk('div', 'ow-fspacer');
      live.river.insertBefore(live.spacer, live.river.firstChild);
    }
    live.spacer.style.height = (lo * H) + 'px';

    if (!live.spacerEnd) {
      live.spacerEnd = mk('div', 'ow-fspacer');
    }
    /* BEFORE THE TAIL, so "you are caught up" stays the last thing in the
       scroller — the tail is not a position and must not be pushed out of
       reach by the ground standing in for ones that are. */
    var anchor = (live.tailEl && live.tailEl.parentNode === live.river)
      ? live.tailEl : null;
    if (live.spacerEnd.parentNode !== live.river ||
        live.spacerEnd.nextSibling !== anchor) {
      live.river.insertBefore(live.spacerEnd, anchor);
    }
    live.spacerEnd.style.height = (Math.max(0, P.length - 1 - hi) * H) + 'px';

    if (live.pager) live.pager.rewatch();
  }

  /* ═══ 7 · THE TAKEOVER ═════════════════════════════════════════════════

     ★ FOUNDER, 2026-08-26: *"immersive should bypass the popit start and
       completely and utterly switch the page to a black scrolling background…
       a VIEWING type rather than a POSTING type."*

     `enter` is therefore not "a class on the feed". It changes what the page
     IS: the header, the nav, the mode switch and the Home canvas leave, the
     ground goes black, and the only thing on screen is Posts and the way out.

     A POSTING SURFACE IS NOT A VIEWING SURFACE. The Home canvas is the
     person's own arranged Popits — the thing they PUT there — and it is hidden
     here for that reason rather than for room. Nothing in this viewer offers
     to compose, publish or arrange. Answering a Post is not posting: like,
     dislike, comment, repost, save and share all stay, because they are how a
     person watches something with other people. */

  var CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M6 6l12 12M18 6L6 18"/></svg>';

  var shell = null;

  /* THE VIEWER MOUNTS NO EXIT OF ITS OWN.
     ★ FOUNDER, 2026-08-29: *"rather than a X button have the switch from feed
       to scrolling like on standard feed."*
     Home's switch is lifted into view by CSS while Scroll is open, so the
     control that moves between the two projections is literally the same
     element in both — there is no second way out to keep in step with the
     first. `Escape` still leaves, because a full-screen surface should.

     The overlay keeps a cross, and that is a different thing: it closes a Post
     laid over the feed rather than leaving the feed. */

  /* ── OPENING ONE POST WITHOUT LOSING THE FEED ─────────────────────────────
     The App's own route for a post (`openPost`) walks the whole surface stack
     to a new page, which unmounts the feed — press one Post out of a group of
     five and the other four, and the scroll position, are gone. The founder's
     rule is the opposite: open it *"without destroying the relationship to the
     feed"*.

     So the SAME surface (`OW.live.post` — no second post renderer) is mounted
     into an overlay ABOVE the still-live scroller. Closing it reveals the
     exact position it was pressed from. */
  function openPost(id, from) {
    /* ★ THE SECOND ARGUMENT WAS ARRIVING AND BEING DROPPED.
       ★ A, 2026-09-02: the tap now carries `{node, rect, at}` — where it
         started — and every caller has been passing it here. This signature
         took one parameter, so the origin went nowhere.

       `OW.originOpen` is the consumer (Popit material). It returns immediately
       and animates on its own layer, so the overlay below still mounts on this
       frame — the animation decorates the open, it never gates it. Reduced
       motion, a missing origin or a zero-size rect all no-op. */
    if (!id || !live) return;
    closePost();
    var over = mk('div', 'ow-fover');
    over.setAttribute('role', 'dialog');
    over.setAttribute('aria-modal', 'true');
    var inner = mk('div', 'ow-fover__in');
    over.appendChild(inner);
    /* THE GUTTER AND THE SURFACE ARE TWO ELEMENTS.
       ★ FOUNDER/482: cards *"accurate when clicked anywhere"* — and the room
         a card opens into has to be laid out like a room.
       `OW.live.post` begins with `host.className = ''` (it owns its host),
       so mounting it straight into `.ow-fover__in` erased the 18px gutter
       and the Post sat flush against the left edge of the screen — measured
       2026-09-21 at 290: body left = 0. The surface gets a host of its own
       INSIDE the gutter; it may wipe that one. */
    var page = mk('div', '');
    inner.appendChild(page);
    /* ITS OWN CONTROL, AND ONLY ONE ON SCREEN. The viewer already has an exit
       in the top-left; a second identical glyph in the same place is two
       buttons a person cannot tell apart, doing different things. The overlay
       marks the document while it is open and the viewer's exit steps aside —
       so there is always exactly one way back, and it always means "back one
       level". */
    var close = mk('button', 'ow-fexit ow-fexit--over');
    close.type = 'button';
    close.setAttribute('aria-label', 'Back to the feed');
    close.innerHTML = CLOSE_SVG;
    close.addEventListener('click', function (e) { e.preventDefault(); closePost(); });
    doc.body.appendChild(over);
    doc.body.appendChild(close);
    doc.documentElement.setAttribute('data-ow-over', '1');
    live.over = { el: over, close: close };

    /* THE TAPPED CARD BECOMES THIS SURFACE. Fired AFTER the overlay is in the
       document, because the plate flies to where the surface actually IS —
       measuring a destination that has not been laid out yet is how a
       shared-element transition ends up landing in the wrong place. It is
       fire-and-forget: nothing below waits on it. */
    if (from && OW.originOpen) { try { OW.originOpen(from, inner); } catch (_) {} }

    if (OW.live && typeof OW.live.post === 'function') {
      try {
        OW.live.post(page, id, {
          onPerson: function (em) {
            doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { email: em } }));
          },
          onBack: closePost
        });
      } catch (e) { closePost(); }
    } else {
      /* NO POST SURFACE MEANS NO OVERLAY — never an empty black sheet. Falling
         through to the App's own route loses the feed, which is the thing this
         exists to protect, so it says nothing rather than doing the wrong
         thing quietly. */
      closePost();
    }
  }

  function closePost() {
    doc.documentElement.removeAttribute('data-ow-over');
    if (!live || !live.over) return;
    if (live.over.el && live.over.el.parentNode) live.over.el.parentNode.removeChild(live.over.el);
    if (live.over.close && live.over.close.parentNode) {
      live.over.close.parentNode.removeChild(live.over.close);
    }
    live.over = null;
  }

  OW.feed.openPost = openPost;
  OW.feed.closePost = closePost;

  function onEsc(e) {
    if (e.key !== 'Escape') return;
    if (live && live.over) { e.preventDefault(); closePost(); return; }
    if (shell) { e.preventDefault(); shell.exit(); }
  }

  /* ── A STRAY CARD IN A MANDATORY-SNAP SCROLLER BREAKS THE WHOLE THING ──
     ★ FOUNDER, 2026-09-10: *"Scroll is completly broken along with sizing on
       feed."*

     MEASURED on Home, pressing Scroll: the river held FOUR correct `.ow-fpos`
     pages at 812px and TWENTY-FOUR loose `.po-card` at 190 and 420. Snap is
     `y mandatory`, so those short cards are snap targets too and the scroller
     lands mid-card — Scroll renders as a stack of Feed cards, which is exactly
     what it is not for.

     `project` already sweeps strays, and it is right — but it sweeps ONCE, at
     the moment Scroll is entered. The standard feed's own pagination keeps
     appending underneath, so every batch that lands after that moment is loose
     again. A one-time sweep cannot fix a continuing writer; this is the same
     shape as an index with a second door.

     SO THE SWEEP CONTINUES WHILE IMMERSIVE IS LIVE. A card that arrives as a
     direct child is WRAPPED in the same `positionEl` page the composer builds,
     in place, so it becomes one full-screen position instead of a fragment
     wedged between two. Nothing is deleted: a stray is a real Post that has
     not found a page yet, and it keeps the element it already has.

     Disconnected by `restore`, so leaving Scroll leaves no observer behind. */
  var strayWatch = null;

  function watchStrays(river) {
    if (strayWatch) { try { strayWatch.disconnect(); } catch (e) {} }
    if (!river || typeof MutationObserver !== 'function') return;
    var pending = false;
    strayWatch = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      /* ONE PASS PER TICK, AND THE OBSERVER IS DEAF WHILE IT WORKS.
         Wrapping a stray is itself a childList mutation, so an observer left
         connected re-triggers on its own work — I shipped exactly that and
         hung the page. It disconnects, wraps, then re-observes; and `setTimeout`
         rather than rAF because a hidden tab gets no frames and the sweep must
         still run. */
      setTimeout(function () {
        pending = false;
        if (!strayWatch) return;
        try { strayWatch.disconnect(); } catch (e) {}
        try {
          var loose = Array.prototype.slice.call(river.children).filter(function (n) {
            return n.classList && (n.classList.contains('po-card')
                                || n.classList.contains('ow-xc-slot'));
          });
          loose.forEach(function (card) {
            var page = positionEl('post');
            river.insertBefore(page, card);
            page.appendChild(card);
          });
        } catch (e) {}
        try { strayWatch.observe(river, { childList: true }); } catch (e) {}
      }, 0);
    });
    try { strayWatch.observe(river, { childList: true }); } catch (e) {}
  }

  OW.feed.stopStrayWatch = function () {
    if (strayWatch) { try { strayWatch.disconnect(); } catch (e) {} strayWatch = null; }
  };

  OW.feed.enter = function (river, items, opts) {
    opts = opts || {};
    if (shell) OW.feed.exit();

    var root = doc.documentElement;
    root.setAttribute('data-ow-view', 'immersive');

    /* EVERY OPTION TRAVELS. Naming two of them here meant `more`, `render` and
       `onSeen` were silently dropped between `enter` and `project` — the
       continuation callbacks existed, were wired by Home, and reached nothing.
       A pass-through must not be a whitelist. */
    var handle = OW.feed.project(river, items, opts);
    watchStrays(river);        /* the sweep has to keep sweeping — see above */
    if (!handle) {
      /* composition refused (a row/card mismatch it already reported). Do not
         leave the page taken over with nothing in it. */
      root.removeAttribute('data-ow-view');
      return null;
    }

    doc.addEventListener('keydown', onEsc);
    doc.addEventListener('ow:navigate', onNavigate);
    try { river.focus({ preventScroll: true }); } catch (e) { try { river.focus(); } catch (_) {} }

    shell = {
      river: river,
      exit: function () { OW.feed.exit(); if (opts.onExit) opts.onExit(); }
    };
    return handle;
  };

  /* LEAVING HOME LEAVES THE SCROLL VIEW. The shell announces every page
     change (`ow:navigate`) and nothing here listened, so pressing Discovery in
     the dock from the Scroll view left the document in `immersive` — the
     body stayed scroll-locked and the next page could not be scrolled at all
     (found walking the App with the founder, 2026-09-26). Plain `exit`, not
     the shell's: leaving by the dock is not choosing the Feed, so the
     remembered view stays Scroll and Home comes back to it. */
  function onNavigate() { OW.feed.exit(); }

  OW.feed.exit = function () {
    closePost();
    doc.removeEventListener('keydown', onEsc);
    doc.removeEventListener('ow:navigate', onNavigate);
    if (OW.media && OW.media.release) { try { OW.media.release(); } catch (e) {} }
    if (shell) {
      OW.feed.restore(shell.river);
      shell = null;
    }
    doc.documentElement.removeAttribute('data-ow-view');
  };

  /* ═══ 8 · PREPARING WHAT HAS NOT ARRIVED YET ═══════════════════════════

     ★ FOUNDER: *"Never allow: gesture → blank Galaxy → loading → content."*

     The feed is FINITE and it ends (canon forbids infinite scroll), so every
     position is already in the DOM and no transition ever waits on a request.
     What can still arrive late is MEDIA — bytes, not markup — so the next two
     positions are warmed and the active one gets the player.

     THE NEXT TWO, NOT THE FEED. Warming fifty items is how a feed burns a
     person's data plan for content they never reach. */
  function prepare(i) {
    if (!live || !OW.media || !OW.media.prepare) return;
    try { OW.media.prepare(live.positions, i); } catch (e) {}
  }

  /* WHAT THE NAVIGATION ACTUALLY DID — latency per transition and the worst
     frame gap seen inside one. The founder asked for measurement rather than a
     claim, and this is the smallest thing that answers it. */
  OW.feed.metrics = function () {
    var t = metrics.transitions;
    var lat = t.map(function (x) { return x.latency; });
    return {
      transitions: t.length,
      lastLatency: lat.length ? lat[lat.length - 1] : null,
      medianLatency: lat.length
        ? lat.slice().sort(function (a, b) { return a - b; })[Math.floor(lat.length / 2)] : null,
      maxLatency: lat.length ? Math.max.apply(null, lat) : null,
      worstFrameGap: metrics.worstFrame,
      swallowedDoubles: metrics.doubles
    };
  };
  OW.feed.resetMetrics = function () {
    metrics.transitions = []; metrics.worstFrame = 0; metrics.doubles = 0;
  };

  /* exposed for the acceptance walk — what a region of the feed composed into */
  OW.feed.plan = function () {
    if (!live) return null;
    return live.positions.map(function (p) {
      return {
        kind: p.kind, media: p.media || '', n: p.items.length,
        sizes: p.items.map(function (i) { return i.size; }),
        people: Object.keys(p.items.reduce(function (a, i) {
          if (i.face.who) a[i.face.who] = 1; return a; }, {})).length,
        places: Object.keys(p.items.reduce(function (a, i) {
          if (i.face.place) a[i.face.place] = 1; return a; }, {})).length
      };
    });
  };

})(window);
