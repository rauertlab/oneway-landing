/* oneway-projection.js — A CENTER, OPENED OVER ANY PAGE.
 *
 * ★ FOUNDER/401, 2026-09-14: *"I don't want it to take you to the app. It
 *   should be able to display right over the landing page. One way should be
 *   able to do this naturally on other people's websites if they wanted it
 *   to. Really, the projection technology should work that well. It should go
 *   right over the landing page of the person sent to and should be like
 *   opening a mini website right on the landing page. For any active center,
 *   doesn't matter what the niche is or topic or business, whatever."*
 * ★ FOUNDER/396: *"an animation of the poppet opening, taking up the screen
 *   like a hologram, and then the center's information and hue displaying
 *   over it, but not taking over visually the galaxy, just replacing the text
 *   on screen… This will be the animation that serves the entire platform…
 *   from any pop it opened at any position… a post, a profile, a pop it
 *   block, a widget, a game."*
 *
 * WHAT THIS IS. One verb — OW.project.open(kind, id, originEl) — that unfolds
 * the App's OWN surface for a thing (a Center, a person, a post, an event) from
 * the Popit that was pressed, over whatever page the Popit is on. The page
 * stays where it is behind a light veil; the thing's information arrives in
 * the App's material and the world takes the thing's hue. Close, and it folds
 * back into the Popit it came from. No navigation, no second implementation of
 * any surface: the surface IS OW.live.center / .profile / .post / .event,
 * rendered into a pane instead of the App's main column.
 *
 * ON ANY PAGE. Include the App's material and this file:
 *   <link rel="stylesheet" href="/frontend/shared/oneway-popit.css">
 *   <script src="/frontend/shared/oneway-hue.js"></script>
 *   <script src="/frontend/shared/oneway-popit.js"></script>
 *   <script src="/frontend/app/popit-live.js"></script>      (the surfaces)
 *   <script src="/frontend/shared/oneway-projection.js"></script>
 * and any element can open a Center: OW.project.open('center', 'caesars', el).
 * A page that carries `html.ow-in-center` rules (index.html does) steps its
 * own text back while the projection is open; a page without them is simply
 * veiled. The styles this needs are injected here, so a host page adds nothing.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var OW = global.OW = global.OW || {};
  if (OW.project) return;

  var CSS = [
    '.ow-proj{position:fixed;inset:0;z-index:1200;display:none}',
    '.ow-proj.is-on{display:block}',
    /* ── THE WORLD STAYS, THE WORLD STOPS COMPETING ────────────────────────
       ★ FOUNDER/396: the Center's information displays over the world *"but
         not taking over visually the galaxy, just replacing the text on
         screen."*
       A 34% tint is right over the galaxy, which is light on black and has no
       words in it. Over the MAP it is not: pin labels, the street-detail
       notice and place names sit inside the Center's own text (measured on a
       phone, Atlantic City opened from a pin). The veil keeps its light tint
       and adds a BLUR — the world is still there, still moving, still its own
       colour, and nothing behind the pane can be read as words any more. */
    '.ow-proj__veil{position:absolute;inset:0;background:rgba(3,4,10,.42);opacity:0;',
    '  -webkit-backdrop-filter:blur(14px) saturate(1.06);backdrop-filter:blur(14px) saturate(1.06);',
    '  transition:opacity .5s cubic-bezier(.4,0,.2,1)}',
    /* a browser without backdrop-filter gets the tint alone, darker, because
       there it is the only thing separating the two layers */
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){',
    '  .ow-proj__veil{background:rgba(3,4,10,.72)}}',
    /* ── AND THE VEIL KNOWS WHAT IT IS OVER ────────────────────────────────
       The blur cannot be relied on alone: a browser without the compositor
       for it (and every headless one this is proved in) renders none, and
       over a MAP the world behind is not a field of light — it is labels,
       notices and place names, which land inside the Center's own sentences.
       So the pane says what it is over, and the tint answers: a map is
       covered, the galaxy is not. One attribute, set where the fact is
       known, rather than a second veil or a guess about the host. */
    '.ow-proj[data-over="map"] .ow-proj__veil{background:rgba(3,4,10,.96)}',   /* .9 let street names through the Center's own rows (measured 2026-09-20) */
    '.ow-proj[data-over="page"] .ow-proj__veil{background:rgba(3,4,10,.92)}',   /* an App page's words behind the pane (2026-09-20) */
    /* OVER THE MAP THE VEIL IS NEAR-BLACK, SO THE INK IS LIGHT — in every
       theme. Measured by B 2026-09-20: Four Queens opened from Discovery in
       the light theme drew its name in rgb(20,19,31) on a 0.9 black veil —
       unreadable (the founder: "look what happened when I tried to open it
       from discovery"). The pane over the map carries dark-mode ink. */
    '.ow-proj[data-over="map"] .ow-proj__pane,.ow-proj[data-over="page"] .ow-proj__pane{--ow-ink:#fff;--ow-ink-2:rgba(255,255,255,.68);--ow-ink-3:rgba(255,255,255,.52);color:var(--ow-ink)}',
    '.ow-proj.is-in .ow-proj__veil{opacity:1}',
    '.ow-proj__pane{position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
    '  transform-origin:0 0;will-change:transform,opacity;outline:0}',
    '.ow-proj__stage{max-width:760px;margin:0 auto;padding:max(18px,env(safe-area-inset-top)) 16px 90px;opacity:0;transition:opacity .45s cubic-bezier(.4,0,.2,1) .18s}',
    '.ow-proj.is-in .ow-proj__stage{opacity:1}',
    '.ow-proj__close{position:fixed;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));z-index:2;',
    '  width:40px;height:40px;border-radius:999px;border:0;cursor:pointer;color:#fff;',
    '  background:rgba(12,12,20,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 0 1px rgba(var(--ow-h1,163,92,255),.35),0 0 26px -6px rgba(var(--ow-h1,163,92,255),.6);',
    '  display:grid;place-items:center;opacity:0;transition:opacity .4s ease .25s}',
    '.ow-proj.is-in .ow-proj__close{opacity:1}',
    '.ow-proj__close svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}',
    '.ow-proj__stage .ow-surface,.ow-proj__stage > *{min-height:0}',
    '.ow-proj-locked{overflow:hidden!important}'
  ].join('\n');

  var root = null, pane = null, stage = null, host = null, veil = null, closeBtn = null;
  var originEl = null, openSeq = 0, lastFocus = null, current = null;

  function ensure() {
    if (root) return root;
    var st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);
    root = doc.createElement('div'); root.className = 'ow-proj';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    veil = doc.createElement('div'); veil.className = 'ow-proj__veil';
    pane = doc.createElement('div'); pane.className = 'ow-proj__pane'; pane.tabIndex = -1;
    stage = doc.createElement('div'); stage.className = 'ow-proj__stage';
    /* THE SURFACE GETS ITS OWN ELEMENT. Every App surface opens with
       `host.className = ''; host.innerHTML = ''` — it owns what it draws into.
       Handing it the stage wiped the stage's class and the pane's padding
       with it (measured on the first open: the projection was on and its
       stage had no class). The stage keeps the frame; the surface draws in
       a child it may own entirely, re-dressed as `.ow-surface.is-in` after
       each draw, the way the App's own shell does. */
    host = doc.createElement('div'); host.className = 'ow-surface is-in';
    stage.appendChild(host);
    closeBtn = doc.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'ow-proj__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    pane.appendChild(stage);
    root.appendChild(veil); root.appendChild(pane); root.appendChild(closeBtn);
    doc.body.appendChild(root);
    veil.addEventListener('click', function () { OW.project.close(); });
    closeBtn.addEventListener('click', function () { OW.project.close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-on')) OW.project.close(); });
    /* ── LEAVING THE PAGE CLOSES WHAT WAS OVER IT ─────────────────────────
       MEASURED 2026-09-19, walking the loop as a new person: open a Center
       from a map pin, then press Home in the nav. The App routed — the hash
       became `#home` and Home rendered underneath — and the Center's pane was
       STILL ON TOP with `ow-proj-locked` still on the document. The person was
       looking at a Center they had left, unable to scroll, with no way back
       except the X they had no reason to look for. Back did not close it
       either: it changed the hash again and the pane stayed.

       A projection is over a PAGE. When the page it is over goes, it goes. No
       history entry is pushed to achieve this — the App's router owns history
       and a modal that inserts its own entries fights it — so Back closes the
       pane and moves the host as it always did, which is the honest reading of
       "leave this page". */
    global.addEventListener('hashchange', function () {
      if (root.classList.contains('is-on')) OW.project.close();
    });
    global.addEventListener('popstate', function () {
      if (root.classList.contains('is-on')) OW.project.close();
    });
    return root;
  }

  /* the unfold — FROM the Popit's own box TO the whole viewport, the same
     promise OW.open makes for the sheet: nothing teleports, the thing grows
     out of what was pressed */
  function unfold(from) {
    var W = global.innerWidth, H = global.innerHeight;
    var r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) { pane.style.transform = ''; pane.style.opacity = '1'; return Promise.resolve(); }
    var sx = Math.max(r.width / W, .06), sy = Math.max(r.height / H, .06);
    pane.style.transformOrigin = '0 0';
    var a = pane.animate([
      { transform: 'translate(' + r.left + 'px,' + r.top + 'px) scale(' + sx + ',' + sy + ')', opacity: .55, offset: 0 },
      { opacity: 1, offset: .5 },
      { transform: 'translate(0px,0px) scale(1,1)', opacity: 1, offset: 1 }
    ], { duration: reduced() ? 1 : 560, easing: 'cubic-bezier(.34,1.3,.64,1)', fill: 'both' });
    return a.finished.then(function () { a.cancel(); pane.style.transform = ''; }).catch(function () {});
  }
  function fold(to) {
    var W = global.innerWidth, H = global.innerHeight;
    var r = to && to.getBoundingClientRect ? to.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) return Promise.resolve();
    var sx = Math.max(r.width / W, .06), sy = Math.max(r.height / H, .06);
    var a = pane.animate([
      { transform: 'translate(0px,0px) scale(1,1)', opacity: 1, offset: 0 },
      { transform: 'translate(' + r.left + 'px,' + r.top + 'px) scale(' + sx + ',' + sy + ')', opacity: .3, offset: 1 }
    ], { duration: reduced() ? 1 : 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    return a.finished.then(function () { a.cancel(); }).catch(function () {});
  }
  function reduced() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* which surface draws which kind — the App's own, never a copy */
  function renderer(kind) {
    var L = OW.live || {};
    return { center: L.center, person: L.profile, profile: L.profile, post: L.post,
             event: L.event, gallery: L.gallery,
             /* who somebody follows / who follows them — `following:<email>`
                or `followers:<email>` (founder/472: every button works) */
             people: L.people }[kind] || null;
  }

  OW.project = {
    /* open(kind, id, originEl, opts) → Promise<boolean>. false = the surface for
       this kind is not loaded on this page; the caller decides what to do
       (a page without the App's surfaces can still send someone to the App). */
    open: function (kind, id, from, opts) {
      opts = opts || {};
      var draw = renderer(kind);
      if (!draw || !id) return Promise.resolve(false);
      ensure();
      var seq = ++openSeq;
      lastFocus = doc.activeElement;
      originEl = from || null;
      current = { kind: kind, id: id };
      host.className = 'ow-surface'; host.innerHTML = '';
      /* what is behind this pane right now — a map is covered, the galaxy is
         not (see the veil rules). Asked at OPEN, because the same page can be
         a map on one destination and a feed on the next. */
      var overMap = false;
      try {
        /* NOT `offsetParent`: the map is `position:fixed`, and a fixed element
           has no offsetParent whether it is on screen or not — so that test
           answered "no map" on the one surface that is nothing but map. Its
           box is the honest question. */
        var m = doc.querySelector('.ow-map');
        var mr = m && m.getBoundingClientRect ? m.getBoundingClientRect() : null;
        overMap = !!(mr && mr.width > 0 && mr.height > 0
                     && getComputedStyle(m).visibility !== 'hidden');
      } catch (e) {}
      if (opts.over === 'map' || overMap) root.setAttribute('data-over', 'map');
      else {
        /* ── AND AN APP PAGE IS WORDS TOO ──────────────────────────────────
           MEASURED 2026-09-20 at 290px on the safe tier (no backdrop blur):
           the Following list opened over Home and Home's greeting read
           straight through the pane's head — "Following" over "loop.ada"
           over "ONEWAY operations". The galaxy alone has no words; the App's
           pages do. So over the App's own surface the veil covers, as over
           the map. A host page without a surface (the landing page, a
           website) keeps the light tint the founder asked for. */
        var sf = doc.getElementById('surface');
        var words = false;
        try { words = !!(sf && String(sf.textContent || '').trim()); } catch (e) {}
        if (words) root.setAttribute('data-over', 'page');
        else root.removeAttribute('data-over');
      }
      root.classList.add('is-on');
      doc.documentElement.classList.add('ow-in-center', 'ow-proj-locked');
      if (originEl) originEl.setAttribute('data-po-open', '');
      pane.scrollTop = 0;
      var grown = unfold(originEl);
      /* the surface renders while the pane grows; its own reads decide what
         it says, and it asserts the thing's hue on the world (§17) */
      var drawn;
      try {
        drawn = Promise.resolve(draw(host, id, Object.assign({
          onBack: function () { OW.project.close(); },
          onMessage: function (c) {
            /* a conversation is the App's; from a projection it opens there */
            if (c && c.id) global.location.href = '/oneway-app.html#messages/' + encodeURIComponent(c.id);
          },
          onPerson: function (em) { if (em) OW.project.open('person', em, null); }
        }, opts)));
      } catch (e) { drawn = Promise.reject(e); }
      return Promise.all([grown, drawn.catch(function () { return null; })]).then(function () {
        if (seq !== openSeq) return true;
        host.classList.add('ow-surface', 'is-in');
        root.classList.add('is-in');
        try { pane.focus({ preventScroll: true }); } catch (e) {}
        return true;
      });
    },
    close: function () {
      if (!root || !root.classList.contains('is-on')) return Promise.resolve();
      openSeq++;
      root.classList.remove('is-in');
      var to = originEl;
      return fold(to).then(function () {
        root.classList.remove('is-on');
        host.className = 'ow-surface'; host.innerHTML = '';
        doc.documentElement.classList.remove('ow-in-center', 'ow-proj-locked');
        if (to) to.removeAttribute('data-po-open');
        /* the world returns to whoever is looking (§17) */
        try { if (OW.hue && OW.hue.context) OW.hue.context(null, null, 600); } catch (e) {}
        try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
        originEl = null; current = null;
      });
    },
    current: function () { return current; },
    isOpen: function () { return !!(root && root.classList.contains('is-on')); }
  };
})(window);
