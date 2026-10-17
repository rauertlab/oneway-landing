/* oneway-hue.js — shared accent-hue boot + cross-tab sync.
 *
 * Reads the user-picked hue from localStorage.ow_user_hue (0-360 or empty)
 * and applies it as a CSS variable + .ow-hue-on class on <body> so every
 * page in the ONEWAY platform — dashboard, brain product page, API docs,
 * auth flow — picks up the same accent.
 *
 * Pages that want to be hue-aware include this script in <head> and add
 * one CSS block that derives their accents from var(--ow-user-hue):
 *
 *   body.ow-hue-on {
 *     --accent:        hsl(var(--ow-user-hue, 260), 75%, 64%);
 *     --accent-soft:   hsl(var(--ow-user-hue, 260), 75%, 64% / .14);
 *     ...
 *   }
 *
 * Cross-tab: when the user changes the hue in Settings, every other open
 * ONEWAY tab repaints instantly via the 'storage' event.
 */
(function(){
  /* CSS VARIABLES REPAINT THEMSELVES; CANVASES DO NOT. Anything drawing its own
     pixels — the landing page's starfield and Center map, the Brain graph —
     has already read the hue into buffers by the time it changes, so it needs
     telling. One event, so no surface has to poll `getComputedStyle`. */
  function announce(h){
    try {
      window.dispatchEvent(new CustomEvent('ow:hue', { detail: { hue: h } }));
    } catch(_){}
  }

  /* ★ FOUNDER/471 §12: ONEWAY's icon is the loading globe, and it takes the signed-in person's hue in every view — the
     browser tab too. THE TAB'S GLOBE IN THE PAGE'S OWN COLOUR (the founder, 2026-10-17: "when a user signed in, it should
     obviously sync to their hue ... If they're a random user, it should sync with whatever predominant color the page's
     hue is ... calculated every time"; founder/829: "the icon isnt even right on safari wtf").
     THE GLOBE IS A FILE, NAMED WHILE THE HEAD IS READ. It was drawn here, after load, through a canvas into a data: PNG;
     Chromium followed, Safari never did (it draws no SVG tab icon and does not take one a script swaps in after load), so
     its tab kept the first static PNG, the blue globe. Now the transparent globe is pre-drawn in every hue at 10-degree
     steps (assets/icons/globe/, tools/make_tab_globes.cjs: oneway-globe.svg with its strokes #1f8fff as hsl(h 92% 58%)),
     the head's first script writes the one icon link to the file of the hue the page is about to paint
     (tools/site_seo.py TAB_GLOBE_JS, which leaves what it decided in window.__owTabGlobe), and this keeps THAT link in
     step afterwards, pointing it at the same files: the account's answer, a colour the page chooses, a Center the App
     stands in. The order is the sync rule's: a context the surface stands in (owTabHue.context, oneway-popit.js), the
     person's hue, the colour the page chose this load (owTabHue(h)), its ground's (owTabHue(h, true) from the galaxy; the
     head's ground), its world's (--ow-user-hue), else the globe as drawn, blue. */
  var GLOBE_DIR = '/assets/icons/globe/', GLOBE_STEP = 10, globeWant = null, pageHue = null, ctxHue = null;
  var headGlobe = window.__owTabGlobe || null;
  function norm(h){ if (h == null || h === '') return null; h = Number(h); return isFinite(h) ? ((h % 360) + 360) % 360 : null; }
  function globeFile(h){
    if (h == null) return GLOBE_DIR + 'globe-blue-32.png';
    var k = Math.round(norm(h) / GLOBE_STEP) * GLOBE_STEP % 360;
    return GLOBE_DIR + 'globe-' + ('00' + k).slice(-3) + '-32.png';
  }
  /* the colour the page chose in its head (window.__owPageHue, the landing's and the OS page's look) is its choice from
     the first moment, so nothing paints the tab another colour before the page's own script says so again */
  if (headGlobe && headGlobe.page != null && norm(headGlobe.page) != null) pageHue = norm(headGlobe.page);
  /* A page that chooses its colours says so (owTabHue(h)); the page's ground (the galaxy) says its hue too
     (owTabHue(h, true)), but never over a page that has chosen. */
  window.owTabHue = function(h, ground){
    if (ground && (window.owTabHue.chosen || (headGlobe && headGlobe.page != null))) return;
    if (!ground) window.owTabHue.chosen = true;
    pageHue = norm(h); tabIcon(globeWant);
  };
  /* THE IDENTITY THE SURFACE STANDS IN (oneway-popit.js OW.paintIcon: a Center's light while the App is in it, null when
     it is back in the person's own): it wins while it lasts, and null hands the tab back to the rule above */
  window.owTabHue.context = function(h){ ctxHue = (h == null) ? null : norm(h); tabIcon(globeWant); };
  window.owTabHue.file = globeFile;
  function brandHue(){
    /* the hue the page is showing: its world's (--ow-user-hue, the App's purple for a visitor), else its brand's */
    try {
      var cs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body || document.documentElement);
      var v = [cs.getPropertyValue('--ow-user-hue'), bs.getPropertyValue('--ow-user-hue'), bs.getPropertyValue('--ow-brand-hue')];
      for (var i = 0; i < v.length; i++) { var b = parseFloat(v[i]); if (isFinite(b)) return ((b % 360) + 360) % 360; }
    } catch (_) {}
    return null;
  }
  function tabIcon(h){
    globeWant = (h == null) ? null : norm(h);
    try {
      var link = document.querySelector('link[rel="icon"][data-ow-globe]');
      if (!link) {
        /* a page whose head does not write the globe (not projected by tools/site_seo.py): once it is read, it gets one */
        if (document.readyState === 'loading') {
          if (!tabIcon.waiting) {
            tabIcon.waiting = true;
            document.addEventListener('DOMContentLoaded', function(){ tabIcon.waiting = false; tabIcon(globeWant); });
          }
          return;
        }
        link = document.createElement('link');
        link.setAttribute('rel', 'icon');
        link.setAttribute('data-ow-globe', '1');
        document.head.appendChild(link);
      }
      /* the one tab icon: any other a browser could prefer goes (the touch icon and the manifest are a home screen's) */
      document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(function(other){
        if (other !== link) other.remove();
      });
      var hue = ctxHue != null ? ctxHue
              : globeWant != null ? globeWant
              : pageHue != null ? pageHue
              : (headGlobe && headGlobe.ground != null) ? norm(headGlobe.ground)
              : brandHue();
      var href = globeFile(hue);
      if (link.getAttribute('type') !== 'image/png') link.setAttribute('type', 'image/png');
      if (link.getAttribute('sizes') !== '32x32') link.setAttribute('sizes', '32x32');
      if (link.getAttribute('href') !== href) link.setAttribute('href', href);   /* the same file is never asked for twice */
    } catch(_){}
  }

  function apply(hue){
    try {
      var html = document.documentElement;
      var body = document.body;
      if (hue == null || hue === '' || isNaN(parseInt(hue, 10))) {
        // Reset path: remove override, fall back to per-page defaults.
        html.style.removeProperty('--ow-user-hue');
        if (body) {
          body.style.removeProperty('--ow-user-hue');
          body.classList.remove('ow-hue-on');
        }
        announce(null);
        tabIcon(null);
        return;
      }
      var h = Math.max(0, Math.min(360, parseInt(hue, 10)));
      html.style.setProperty('--ow-user-hue', h);
      announce(h);
      tabIcon(h);
      if (body) {
        body.style.setProperty('--ow-user-hue', h);
        body.classList.add('ow-hue-on');
      } else {
        // body not parsed yet — wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', function(){
          document.body.style.setProperty('--ow-user-hue', h);
          document.body.classList.add('ow-hue-on');
        });
      }
    } catch(_){}
  }
  /* ── WHERE THE HUE ACTUALLY LIVES ──────────────────────────────────────
     ★ FOUNDER §0.0: *"No major user-owned state should be trapped inside a
       particular device, interface, System, or external platform."*

     It used to live in `localStorage.ow_user_hue` and nowhere else, so the
     colour a person picked for the whole platform belonged to a BROWSER. A new
     laptop, a phone, a cleared cache, and ONEWAY had forgotten what they look
     like — while every surface confidently rendered the default as though it
     were their choice.

     So the account is the home and localStorage is a CACHE:

       1. Paint from the cache immediately, so a signed-in person never sees
          the default flash past on the way to their own colour.
       2. Ask the server, and let its answer win — including when the answer is
          "no hue recorded", which must clear a stale cached one rather than
          leave this device showing a colour the person has since removed.
       3. Anything that CHANGES the hue writes to the server; the cache is
          updated as a consequence, never as the record.

     Signed out, there is no account to ask and the cache is the whole truth —
     which is right: the landing page should still look like you if you have
     been here before. */
  /* THE SESSION IS THE ONE READER'S (frontend/shared/oneway-data.js; PLAN §3.1, finish list 5.0 item 9, C-app line 3).
     This read three storage keys itself, one of them a copy B removed on 2026-10-09. A token goes only where the writer
     would send one (a dev ?api= origin); everywhere else the HttpOnly cookie is the session, and on a page with no App
     on it there is nothing to ask. */
  function tok(){
    try {
      var D = window.OW && window.OW.data;
      return (D && D.token && (!D.sendsHeader || D.sendsHeader()) && D.token()) || '';
    } catch(_){ return ''; }
  }
  /* SIGNED IN BY THE COOKIE (lane B, 2026-10-09): no token is kept any more; the HttpOnly cookie is the
     session, and `ow_session_cookie` says this browser holds one. */
  function signedIn(){
    if (tok()) return true;
    try { return localStorage.getItem('ow_session_cookie') === '1'; } catch(_){ return false; }
  }
  function cache(h){
    try {
      if (h === null || h === '' || h === undefined) localStorage.removeItem('ow_user_hue');
      else localStorage.setItem('ow_user_hue', String(h));
    } catch(_){}
  }

  // 1 · Boot pass — paint the cached hue with no network in the way.
  try { apply(localStorage.getItem('ow_user_hue')); } catch(_){}

  // 2 · Then ask the account, and let it correct us.
  /* ONE READ, THE CANONICAL ONE. This asked the legacy /api/profile for a
     CHOSEN hue and, when that was null, asked /api/auth/me for the DERIVED
     one — two requests on every boot, the first of them to the old backend.
     /api/auth/me has carried the answer to both questions since 2026-08-30
     (`identity/accounts.py`): `hue_angle` is the chosen hue when there is
     one and the derived hue when there is not, and `hue_chosen` says which.
     A choice still outranks a derivation — that is decided where the fact
     lives, once, instead of by which of two requests happened to answer.
     Measured 2026-09-14 on a stranger's first hour: three /api/profile reads
     gone, nothing else changes hands. */
  function sync(){
    var t = tok();
    if (!signedIn() || typeof fetch !== 'function') return Promise.resolve(null);
    var base = (window._OW_API || '');
    var asked = fetch(base + '/api/auth/me', { headers: t ? { 'X-Session-Token': t } : {}, credentials: 'same-origin' });
    /* The App reads this same door a moment later (OW.data.get('/api/auth/me')); it takes this answer instead of asking again
       (popit-live.js `__owEarly`, consumed once, only on the same origin). A second copy of the response is kept for it. */
    try { if (!base) { window.__owEarly = window.__owEarly || {}; if (!window.__owEarly['/api/auth/me']) window.__owEarly['/api/auth/me'] = asked.then(function(r){ return r.clone(); }); } } catch(_){}
    return asked
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        if (!j) return null;                 /* unreachable: keep the cache */
        var u = j.user || j;
        /* `null` is still an answer — nobody has a hue on this account yet —
           and it must clear a stale cache rather than leave a colour that was
           never theirs (the sign-up crossing measured on 2026-08-30 painted
           one hue and Home settled to another a second later). */
        if (!u || u.hue_angle == null) { cache(null); apply(null); return null; }
        cache(u.hue_angle); apply(u.hue_angle); return u.hue_angle;
      })
      .catch(function(){ return null; });    /* offline: the cache stands */
  }
  try { sync(); } catch(_){}

  /* 3 · CHANGING IT is the App's: its Settings writes the hue through the one writer (frontend/app/popit-live.js,
     PUT /api/oneway/people/me/appearance), and every page paints what the account says (sync, above). A second writer
     of the same door lived here, called by nothing; removed (finish list 5.0 item 9, C-app line 2). */
  // Listen for changes in OTHER tabs (Settings hue picker writes via
  // localStorage.setItem; the originating tab fires no storage event so
  // a same-tab listener isn't needed — dashboard.html updates inline).
  try {
    window.addEventListener('storage', function(e){
      if (e && e.key === 'ow_user_hue') apply(e.newValue);
    });
  } catch(_){}
  // Expose the painter for pages that draw the hue themselves.
  window.OnewayHue = { apply: apply, sync: sync };
})();
