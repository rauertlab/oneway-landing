/* ONEWAY — THE ONE TOP BAR (frontend/shared/oneway-bar.js, with oneway-bar.css; read the CSS file's head first)
   Opens on hover or focus anywhere on the bar, or on a tap on a touch screen; stays two seconds after the pointer
   leaves (the founder, 2026-10-10: "have it stay up for like 2 seconds once a user leaves the top bar and make sure it
   closes smoothly"); any scroll folds it home (his: "itll still go back to center smoothly even if scorlling the page up
   and down mad fast").

   THE WORDMARK'S FLIGHT, ON EVERY PAGE (the founder, 2026-10-10: "the logo sizing animation much work no matter the page
   or display type which is not and must work 100% of the time"). A page marks the wordmark in its opening with
   data-owbar-hero (an <img>). One visible wordmark, made here, starts exactly on it and shrinks into the bar's mark as
   the page scrolls; it glides with the mark when the bar opens and closes. Before this, the landing and the red pages
   each had their own copy, nine pages had none, and three things broke it (measured, tools/probe/wordmark-fly.cjs):
   a position read once at load and kept (a sticky bar moves after load: Privacy docked 18 px low), a page too short to
   scroll the whole flight (the 404 never docked, so its bar never opened), and a picture drawn smaller than its box
   (object-fit). So every frame reads where the hero's drawn wordmark and the bar's mark are NOW; the flight is never
   longer than the page can scroll; a page that cannot scroll at all docks the wordmark when the bar opens.
   - data-owbar-span on the hero: the flight's length as a share of the window's height (the landing: 0.62); otherwise
     the distance from the hero to the bar.
   - The bar opens once the wordmark is in it (the landing's rule: "the menu lives in the bar once the logo is there").
   Every open and close is announced on the bar as `owbar:move` ({detail:{open}}).
   It stores nothing. Signed in, it asks who, and its Sign in becomes the person's face (WHO IS HERE, below). */
(function () {
  if (!window.OnewayHue && !document.querySelector('script[src*="oneway-hue.js"]')) {
    var hueScript = document.createElement('script');
    hueScript.src = '/frontend/shared/oneway-hue.js';
    document.head.appendChild(hueScript);
  }
  var bar = document.querySelector('.owbar');
  if (!bar || bar._owbar) return;
  bar._owbar = true;
  var brand = bar.querySelector('.owbar-brand'), pages = bar.querySelector('.owbar-pages'),
      right = bar.querySelector('.owbar-right'), mark = bar.querySelector('.owbar-mark');
  var links = pages ? [].slice.call(pages.querySelectorAll('a')) : [];

  /* the order the words come out and fold back in, and the page you are on */
  var here = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  links.forEach(function (a, i) {
    a.style.setProperty('--i', i);
    a.style.setProperty('--n', links.length);
    var to = (a.getAttribute('href') || '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (to === here) a.setAttribute('aria-current', 'page');
  });

  /* the room the pages have: from beside the wordmark (where it sits when open) to short of the right side */
  function fit() {
    if (!pages || !mark) return;
    var cs = getComputedStyle(bar), padL = parseFloat(cs.paddingLeft) || 0;
    var gap = parseFloat(getComputedStyle(pages).marginLeft) || 0;
    var start = bar.getBoundingClientRect().left + padL + mark.offsetWidth + gap;
    var stop = right && right.offsetWidth ? right.getBoundingClientRect().left - 12 : bar.getBoundingClientRect().right - padL;
    var room = Math.max(72, Math.floor(stop - start));
    pages.style.maxWidth = room + 'px';
    edges();
  }
  /* which ends of the row hide more pages: the fade sits only on a side that has more to show */
  function edges() {
    if (!pages) return;
    var more = pages.scrollWidth - pages.clientWidth;
    bar.classList.toggle('owbar--more-left', more > 1 && pages.scrollLeft > 1);
    bar.classList.toggle('owbar--more-right', more > 1 && pages.scrollLeft < more - 1);
  }

  /* A CONDENSED WINDOW SCROLLS THE ROW (the founder, 2026-10-10: "let users on condensed windows scroll through the
     pages at the top with their finger. Or cursor"): a finger swipes it (native, sideways only), a wheel or trackpad
     turns into sideways movement while the pointer is over it (and never scrolls the page, which would close the bar),
     and a mouse can drag it; a drag never counts as a click on the page it started on. */
  if (pages) {
    pages.addEventListener('scroll', edges, { passive: true });
    pages.addEventListener('wheel', function (e) {
      var more = pages.scrollWidth - pages.clientWidth;
      if (more <= 1) return;
      e.preventDefault();
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pages.scrollLeft += d * (e.deltaMode === 1 ? 16 : 1);
    }, { passive: false });
    var drag = null, dragged = false;
    pages.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || pages.scrollWidth - pages.clientWidth <= 1) return;
      drag = { x: e.clientX, left: pages.scrollLeft }; dragged = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!dragged && Math.abs(dx) < 4) return;
      dragged = true; pages.classList.add('owbar-dragging');
      pages.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null; pages.classList.remove('owbar-dragging');
      setTimeout(function () { dragged = false; }, 0);
    });
    pages.addEventListener('click', function (e) { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    pages.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  var closing = null, linger = null, flight = null;
  function isOpen() { return bar.classList.contains('owbar--open'); }
  /* NOTHING SNAPS, HOWEVER IT IS HANDLED (the founder, 2026-10-10: "the logo or text cannot snap back or appear for a
     split second and all possible user trigger possiblites must be accounted for ... it should be fidliable"). Each word
     comes out and folds back from exactly where it is drawn this instant (its opacity times the row's, and its slide), so
     in-out-in at any speed only ever continues; the row is put away only once every word is home. */
  var openY = 0;
  function where(a, row) {
    var cs = getComputedStyle(a), o = row * (parseFloat(cs.opacity) || 0), x = 0;
    var m = /matrix\(([^)]+)\)/.exec(cs.transform || '');
    if (m) x = parseFloat(m[1].split(',')[4]) || 0;
    a.style.setProperty('--fo', o.toFixed(3));
    a.style.setProperty('--fx', (o < 0.01 ? -10 : x).toFixed(1) + 'px');
    return o;
  }
  function set(open) {
    if (open && flight && !flight.canOpen()) open = false;
    if (open === isOpen()) return;
    if (open) fit();
    var row = pages ? parseFloat(getComputedStyle(pages).opacity) || 0 : 0, shown = 0;
    links.forEach(function (a) { shown = Math.max(shown, where(a, row)); });
    bar.classList.toggle('owbar--warm', open && shown > 0.05);    // words already out: no wait before they continue
    bar.classList.toggle('owbar--open', open);
    clearTimeout(closing);
    if (open) { bar.classList.remove('owbar--closing'); openY = window.scrollY; }
    else {
      bar.classList.add('owbar--closing');
      closing = setTimeout(function () {
        bar.classList.remove('owbar--closing');
        if (pages) pages.scrollLeft = 0;                            // only once nothing is showing
      }, 760);
    }
    if (flight) flight.glide();
    var ev;
    try { ev = new CustomEvent('owbar:move', { detail: { open: open } }); }
    catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('owbar:move', false, false, { open: open }); }
    bar.dispatchEvent(ev);
  }

  bar.addEventListener('mouseenter', function () { clearTimeout(linger); set(true); });
  bar.addEventListener('mouseleave', function () { clearTimeout(linger); linger = setTimeout(function () { set(false); }, 2000); });
  bar.addEventListener('focusin', function () { clearTimeout(linger); set(true); });
  bar.addEventListener('focusout', function (e) {
    if (bar.contains(e.relatedTarget) || (bar.matches && bar.matches(':hover'))) return;   // a click on the bar keeps it
    set(false);
  });
  /* a touch screen has no hover: a tap on the bar (not on a link) opens or closes it, a tap elsewhere closes it */
  bar.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'touch' || (e.target.closest && e.target.closest('a'))) return;
    clearTimeout(linger); set(!isOpen());
  });
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && isOpen() && !bar.contains(e.target)) set(false);
  }, { passive: true });

  function grounded() {
    if (bar.classList.contains('owbar--solid')) return;
    bar.classList.toggle('owbar--scrolled', flight ? flight.docked() : window.scrollY > 16);
  }
  function onScroll() {
    if (isOpen() && Math.abs(window.scrollY - openY) > 8) { clearTimeout(linger); set(false); }
    if (flight) flight.frame(); else grounded();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  grounded();
  fit();
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('resize', fit, { passive: true });

  /* ── THE FLIGHT ─────────────────────────────────────────────────────────────────────────────────────────────── */
  var markImg = mark && mark.querySelector('img');
  if (bar.classList.contains('owbar--fly')) document.documentElement.classList.add('owbar-flying');
  function startFlight() {
    var hero = document.querySelector('[data-owbar-hero]');
    if (!hero || !markImg || !bar.classList.contains('owbar--fly')) {
      bar.classList.remove('owbar--fly'); document.documentElement.classList.remove('owbar-flying'); grounded(); return;
    }
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fly = document.createElement('img');
    fly.className = 'owbar-fly'; fly.alt = ''; fly.setAttribute('aria-hidden', 'true');
    fly.src = hero.currentSrc || hero.src;
    var share = parseFloat(hero.getAttribute('data-owbar-span'));
    document.body.appendChild(fly);
    var p = 0, short = false, queued = false, K = 0, glide0 = null;   // K: how far into the bar the open state has drawn it
    var yS = null, lastT = 0;                                       // the scroll as the flight draws it (eased), and when
    var moving = 0;                                                 // the dock's own glide is running (any interruption included)
    if (brand) {
      brand.addEventListener('transitionrun', function () { moving++; queue(); });
      ['transitionend', 'transitioncancel'].forEach(function (n) {
        brand.addEventListener(n, function () { moving = Math.max(0, moving - 1); queue(); });
      });
    }

    /* the box the wordmark is DRAWN in: an <img> with object-fit:contain draws smaller than its box */
    function drawn(img) {
      var r = img.getBoundingClientRect();
      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!r.width || !r.height) return null;
      if (!nw || !nh) return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
      var k = Math.min(r.width / nw, r.height / nh), w = nw * k, h = nh * k;
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: w, h: h };
    }
    /* where the wordmark belongs this instant: on the hero, in the bar, or the share of the flight the scroll has made */
    function target(H, M) {
      var y = window.scrollY || 0;
      var room = Math.max(0, (document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight);
      /* NEVER PAST THE BAR, ON ANY SCREEN (the founder: "it shouldnt just disappear even when windowed"). The opening's
         wordmark scrolls away at the page's speed; if the flight were longer than its distance to the bar, the wordmark
         would rise above the bar and leave the screen before docking (a narrow window: the landing's rose 20 px past the
         top). With the flight no longer than that distance D, its height over the dock is D(1-p)^4 >= 0 all the way. */
      var D = Math.max(0, (H.cy + y) - M.cy);
      var want = share > 0 ? window.innerHeight * share : D;
      var span = Math.min(want, D, room);
      short = span < 24;                                            // the page cannot scroll the flight at all
      /* SMOOTHER (the founder, 2026-10-10: "working good make it smoother"): a wheel scrolls in steps of ~100 px and the
         flight stepped with it. The flight is drawn at an eased scroll yS (70 ms behind the page's) and EVERYTHING in it
         is taken at yS: the progress and where the hero would stand. So the never-past-the-bar law holds for yS exactly,
         at rest it is exact (yS = scroll), docked it is exact (the mark is fixed). Reduced motion draws the scroll itself. */
      var now = performance.now();
      if (yS === null || still) yS = y;
      else yS = yS + (y - yS) * (1 - Math.exp(-Math.min(64, now - lastT) / 70));
      if (Math.abs(y - yS) < 0.25) yS = y; else queue();
      lastT = now;
      p = short ? 0 : Math.min(1, Math.max(0, y / span));            // where the page is (opening the bar, the probe)
      var pS = short ? 0 : Math.min(1, Math.max(0, yS / span));      // where the flight is drawn
      H = { cx: H.cx, cy: H.cy + (y - yS), w: H.w, h: H.h };         // the hero as it stood at yS
      var e = 1 - Math.pow(1 - pS, 3);                              // decelerate into the dock
      e = e + (1 - e) * K;                                          // the bar open draws it the rest of the way, smoothly
      return { cx: H.cx + (M.cx - H.cx) * e, cy: H.cy + (M.cy - H.cy) * e, w: H.w + (M.w - H.w) * e };
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function frame() {
      queued = false;
      if (document.body.classList.contains('po-locked')) return;     // a popit holds the page still (the landing)
      var H = drawn(hero), M = drawn(markImg);
      if (!H || !M || !fly.naturalWidth) return;                    // nothing to measure this instant: keep what is drawn
      if (glide0) {                                                 // the open state eases from wherever it was
        var t = Math.min(1, (performance.now() - glide0.t0) / 1000), k = ease(t);
        K = glide0.k + ((isOpen() ? 1 : 0) - glide0.k) * k;
        if (t >= 1) glide0 = null;
      }
      var S = target(H, M);                                          // the dock is read live: it glides by itself (CSS)
      if (glide0 || moving) queue();                                 // keep drawing while anything moves
      var ratio = H.h / H.w;
      fly.style.width = H.w + 'px';
      fly.style.transform = 'translate(' + (S.cx - S.w / 2) + 'px,' + (S.cy - S.w * ratio / 2) + 'px) scale(' + (S.w / H.w) + ')';
      fly.classList.add('on');
      grounded();
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    flight = {
      frame: queue,
      /* home when it is visibly in the bar: 97% of the eased flight (a window made narrower lengthens the flight, and
         the wordmark sitting a pixel short of its dock must not keep the bar shut) */
      docked: function () { return 1 - Math.pow(1 - p, 3) > 0.97; },
      canOpen: function () { return short || 1 - Math.pow(1 - p, 3) > 0.97; },
      /* the bar opened or closed: its mark moved at once (.owbar--fly); the wordmark glides there in 1 s, from where it
         is drawn right now, toward wherever it belongs on every frame of the glide (scrolling meanwhile included) */
      glide: function () {
        if (still) K = isOpen() ? 1 : 0; else glide0 = { k: K, t0: performance.now() };
        queue();
        setTimeout(queue, 1100);                                    // and once more when the dock's own glide has ended
      }
    };
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('load', queue);
    window.addEventListener('pageshow', queue);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
    [hero, markImg, fly].forEach(function (img) { if (!img.complete) img.addEventListener('load', queue); });
    if (window.ResizeObserver) new ResizeObserver(queue).observe(document.body);   // pictures and fonts arriving move the hero
    frame();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFlight); else startFlight();

  /* ── WHO IS HERE: SIGNED IN, SIGN IN IS YOUR FACE (founder/790, 2026-10-16: "when a user is signed in has to save when
     they go from the os to landing page and sign in buton when signed in shows profile picture") ─────────────────────
     The platform's own way, nothing of the bar's own. The session is the HttpOnly cookie no script can read, and this
     browser keeps a mark that it holds one (`ow_session_cookie`), which the App and the OS go by. With no mark nothing is
     asked and the bar says Sign in: a visitor, and the static landing, which has no API. With the mark, the one reader
     (OW.data, frontend/shared/oneway-data.js, loaded here where a page has none) asks the session's own read, GET
     /api/auth/me, then the person read the App's own face comes from, GET /api/oneway/people/<you>. Same origin: the
     cookie goes by itself, the bar reads no token and sends no header. The face follows the one face rule: the picture
     when there is one, the person's outline (OW.faceMark, founder/495) on their hue when there is none or it will not
     load. A picture kept on another site is not drawn here (no third-party request from a landing page): the outline.
     Signed in, the slot is a round button to your Me in the App, named "Your profile"; a refusal, a silence or a failure
     leaves Sign in. While it asks (2.5 s at most) the slot keeps still, so nobody signed in sees Sign in turn into a face.
     Another tab signing in or out changes it here (the mark's storage event); a page brought back from the cache asks
     again; and where the change bus runs (S22), a write anywhere asks again. */
  var you = right && right.querySelector('a.owbar-signin[href*="login"]');
  if (you) (function () {
    var signIn = { href: you.getAttribute('href'), html: you.innerHTML, label: you.getAttribute('aria-label') };
    var asked = 0, timer = null, drawn = null;
    function held() { try { return localStorage.getItem('ow_session_cookie') === '1'; } catch (_) { return false; } }
    function still(on) {
      clearTimeout(timer);
      bar.classList.toggle('owbar--asking', !!on);
      if (on) timer = setTimeout(function () { bar.classList.remove('owbar--asking'); }, 2500);
    }
    /* the one reader: the page's, or loaded once (oneway-data.js guards against a second copy of itself) */
    function reader(cb) {
      var O = window.OW;
      if (O && O.data && O.data.get) return cb(O.data);
      var s = document.querySelector('script[src*="/frontend/shared/oneway-data.js"]');
      if (!s) {
        s = document.createElement('script');
        s.src = '/frontend/shared/oneway-data.js';
        s.async = true;
        document.head.appendChild(s);
      }
      var done = false;
      function then() { if (done) return; done = true; var D = window.OW && window.OW.data; cb(D && D.get ? D : null); }
      s.addEventListener('load', then);
      s.addEventListener('error', then);
    }
    /* a picture this page may draw: the App's own check of its address where loaded (OW.imageUrl), then this origin only.
       for his eye: a face kept on another site (an imported social picture) is the outline here, not a request to that site */
    function faceSrc(v) {
      var u = String(v == null ? '' : v).trim();
      if (u && window.OW && window.OW.imageUrl) u = window.OW.imageUrl(u);
      if (!u) return '';
      if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u)) {
        /* base64 the browser can read at all (the forgiving-base64 rule): '=' only as the end's padding, and never one
           character past a whole group. A cut that breaks it (a JPEG's 600 characters) is no request and no console error */
        var b = u.slice(u.indexOf(',') + 1);
        if (b.length % 4 === 0) b = b.replace(/==?$/, '');
        return b.length % 4 === 1 || b.indexOf('=') >= 0 ? '' : u;
      }
      try { var a = new URL(u, location.href); return a.origin === location.origin && u.indexOf('..') < 0 ? a.href : ''; }
      catch (_) { return ''; }
    }
    /* A PICTURE THAT DRAWS NOTHING IS NONE (measured 2026-10-16, context/audits/landing-2026-10-16/bar-cut.json): the
       people store keeps a picture's first 600 characters, so a picture sent as data: comes back cut. Cut, a JPEG, WebP
       or GIF fails to load (the error below); a PNG loads at its full size and paints nothing, so the face was an empty
       disc. So the outline stands until the picture has loaded AND paints: read back on a 16 px canvas, any pixel drawn.
       A picture the page may not read back (a runtime on another origin) counts as drawn. The cut is the store's (B). */
    function paints(im) {
      try {
        var c = document.createElement('canvas'), g;
        c.width = c.height = 16;
        g = c.getContext('2d');
        g.drawImage(im, 0, 0, 16, 16);
        var d = g.getImageData(0, 0, 16, 16).data;
        for (var i = 3; i < d.length; i += 4) if (d[i]) return true;
        return false;
      } catch (_) { return true; }
    }
    /* a person with no picture is their outline: OW.faceMark where the page has it; on a page without oneway-popit.js
       (the legal pages, Security, the 404) the same drawing, so the outline is never anything else */
    function outline() {
      if (window.OW && window.OW.faceMark) return window.OW.faceMark();
      return '<svg class="ow-facemark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"'
        + ' stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.4" r="3.6"/><path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0"/></svg>';
    }
    function asSignIn() {
      still(false);
      if (!you.classList.contains('owbar-you')) return;
      you.classList.remove('owbar-you');
      you.setAttribute('href', signIn.href);
      you.innerHTML = signIn.html;
      if (signIn.label == null) you.removeAttribute('aria-label'); else you.setAttribute('aria-label', signIn.label);
      drawn = null;
      fit();
    }
    function asYou(picture) {
      still(false);
      var src = faceSrc(picture);
      if (you.classList.contains('owbar-you') && drawn === src) return;   // already this face: nothing moves
      var face = document.createElement('span');
      face.className = 'owbar-face';
      face.innerHTML = outline();                                       // the outline until the picture is seen to draw
      if (src) {
        var im = document.createElement('img');
        im.alt = ''; im.decoding = 'async';
        im.addEventListener('load', function () {                       // a face that will not load, or draws nothing, is none
          if (!im.naturalWidth || !paints(im)) return;
          face.innerHTML = '';
          face.appendChild(im);
        });
        im.src = src;
      }
      you.classList.add('owbar-you');
      /* for his eye: the face opens the person's own Me in the App (the dock's `center`, labelled Me) */
      you.setAttribute('href', '/oneway-app.html#center');
      you.setAttribute('aria-label', 'Your profile');
      you.innerHTML = '';
      you.appendChild(face);
      drawn = src;
      fit();
    }
    function ask(again) {
      var n = ++asked;
      if (!held()) { asSignIn(); return; }
      if (!you.classList.contains('owbar-you')) still(true);
      reader(function (D) {
        if (n !== asked) return;
        if (!D) { asSignIn(); return; }
        var o = again ? { fresh: true } : {};
        D.get('/api/auth/me', o).then(function (r) {
          if (n !== asked) return;
          var d = (r && r.ok && r.data) || {};
          var em = String(d.email || (d.user && d.user.email) || '').trim().toLowerCase();
          if (!em) { asSignIn(); return; }
          if (!you.classList.contains('owbar-you')) asYou('');            // signed in: the outline until the face is read
          return D.get('/api/oneway/people/' + encodeURIComponent(em), o).then(function (p) {
            if (n !== asked || !(p && p.ok && p.data)) return;             // unread: the outline stands, honestly
            asYou(p.data.picture || '');
          });
        }).catch(function () { if (n === asked) asSignIn(); });
      });
    }
    function begin() {
      ask(false);
      if (window.OW && window.OW.changes && window.OW.onChanged) window.OW.onChanged(bar, function () { ask(true); });
    }
    if (held()) still(true);                                           // from the first frame, not after the page parses
    /* once the page's own scripts have run, so its reader is the one asked */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin); else begin();
    window.addEventListener('storage', function (e) { if (!e || e.key === null || e.key === 'ow_session_cookie') ask(true); });
    window.addEventListener('pageshow', function (e) { if (e && e.persisted) ask(true); });
  })();

  window.owBar = { el: bar, set: set, fit: fit };
})();
