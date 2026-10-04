/* ═══════════════════════════════════════════════════════════════════════════
   ONEWAY — POPITS, MADE FUNCTIONAL  (oneway-popit-live.js)
   Requires: oneway-popit.js (the material + renderer). Load after it.

   This is the layer that turns a Popit from a rendering into a working part of
   the App. Three surfaces, one contract:

     OW.live.home(host)              the person's own surface — widgets that DO
     OW.live.profile(host, email)    someone's profile — widgets that SHOW
     OW.live.center(host, centerId)  a Center, opened from the App

   ── WHY THIS IS A SEPARATE FILE ───────────────────────────────────────────
   oneway-popit.js knows nothing about hotels, galleries, follows or HTTP — and
   that is what lets one Popit work on every surface. The reality binding lives
   here, so a kiosk or a Center Site can use the material with a different
   source and the material never learns a second job.

   ── THE FOUR LAWS THIS FILE ENFORCES ──────────────────────────────────────
   1 · NEVER SIMULATE. A Popit exists only when its contents exist. Loading
       renders STRUCTURE, never plausible-looking placeholder content — a fake
       row is a lie that becomes a screenshot.
   2 · EMPTY IS A VALID ANSWER (canon). "Nothing here yet" is a true sentence
       and ships as one. No surface is ever padded to look busy.
   3 · ONLY WHAT REALITY SUPPORTS (Gate 3, EXACT CAPABILITIES). A Center that
       cannot be joined shows no Join. The server says what is possible
       (`participation.begin`); the UI never invents an affordance.
   4 · NEVER CLAIM AN OUTCOME THE SERVER DID NOT CONFIRM. Actions are
       optimistic for feel, but a failure REVERTS and says what happened. A
       button that goes quiet on error is how a product starts lying.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var OW = global.OW;
  if (!OW) { console.warn('[oneway-popit-live] load oneway-popit.js first'); return; }
  var doc = global.document;
  OW.live = OW.live || {};

  /* ═══ 1 · DATA ═════════════════════════════════════════════════════════
     One fetch path for every surface. Deduped, briefly cached, and honest
     about failure — the cost law says opening a surface must be cheap, and
     four widgets asking for the same read must not become four requests. */
  var BASE = '', TOKEN = null, ME = '', HOME = '', cache = {}, inflight = {};
  var TTL = 20000;   /* short: reality moves, but a single paint must not
                        re-request the same read per widget */

  function token() {
    if (TOKEN) return TOKEN;
    try {
      var t = global.localStorage.getItem('ow_session_token');
      if (t) return (TOKEN = t);
      var raw = global.localStorage.getItem('ow_tokens');
      if (raw) { var o = JSON.parse(raw); if (o && o.access) return (TOKEN = o.access); }
    } catch (_) {}
    return null;
  }

  /* THE SESSION IS A COOKIE NO SCRIPT CAN READ (B, 7956e8cb). Once this browser holds one
     (`ow_session_cookie`, the OS's key too, 03488a42), a same-origin call carries it by itself and
     the App sends no session header. A dev `?api=` override is another origin: it keeps the header. */
  function cookieSession() {
    try { return global.localStorage.getItem('ow_session_cookie') === '1'; } catch (_) { return false; }
  }
  function sendsHeader() { return !!BASE || !cookieSession(); }

  /* ANOTHER TAB RENEWED THE SESSION: the App and the OS share this origin's storage, and a refresh
     in one ends the session the other holds in memory (24ee7de0: a refresh ROTATES). */
  try {
    global.addEventListener('storage', function (e) {
      if (e && (e.key === 'ow_session_token' || e.key === 'ow_tokens')) TOKEN = null;
    });
  } catch (_) {}

  /* ═══ THE SESSION AT OPEN: THE COOKIE, ONCE A DAY FRESH (B: 24ee7de0, 7956e8cb, 10bf9333) ═══
     The OS's flow and the OS's keys (os.js, 03488a42), so the two renew once between them:
     1 · A token still in storage, never yet a cookie: POST /api/auth/refresh with it, once. The
         answer sets the HttpOnly cookie and ends that token in the same act; `ow_session_cookie`
         remembers that this browser has one, and from then on the App sends no session header.
     2 · Then at most once a day (`ow_session_at`): POST /api/auth/refresh with no body. The cookie
         is the session, and the answer gives a fresh one, so a session lives its 30 days
         (10bf9333) without signing out anyone who comes back.
     The renewed token is written back to storage only where one was kept, for the pages that still
     read it (the site's auth.js, the sign-in page) until they read the cookie; the App itself never
     sends it. A 30-second lock keeps two tabs from renewing at once. A 401 goes to sign-in unless
     another tab has just renewed; a network failure changes nothing. */
  var REFRESH_EVERY_MS = 864e5, REFRESH_LOCK_MS = 30000;
  function keepForPages(d) {
    if (!(d && d.access_token)) return;
    var ls = global.localStorage;
    try {
      if (!ls.getItem('ow_session_token') && !ls.getItem('ow_tokens')) return;   /* none kept: keep none */
      ls.setItem('ow_session_token', d.access_token);
      var o = {};
      try { o = JSON.parse(ls.getItem('ow_tokens') || '{}') || {}; } catch (_) { o = {}; }
      o.access = o.access_token = d.access_token;
      o.refresh = o.refresh_token = d.refresh_token || d.access_token;
      ls.setItem('ow_tokens', JSON.stringify(o));
    } catch (_) {}
    TOKEN = d.access_token;
  }
  function refreshDaily() {
    var ls = global.localStorage, t = token(), cookie = cookieSession(), at = 0, lock = 0;
    if (!t && !cookie) return Promise.resolve(false);                 /* signed out */
    try {
      at = +ls.getItem('ow_session_at') || +ls.getItem('ow_token_at') || 0;
      lock = +ls.getItem('ow_refreshing') || 0;
    } catch (_) { return Promise.resolve(false); }
    var exchange = !!t && (!cookie || !!BASE);                        /* a stored token, never yet a cookie */
    if (!exchange && at && Date.now() - at < REFRESH_EVERY_MS) return Promise.resolve(false);
    if (cookie && !BASE && at && Date.now() - at < REFRESH_EVERY_MS) return Promise.resolve(false);
    if (lock && Date.now() - lock < REFRESH_LOCK_MS) return Promise.resolve(false);
    var began = Date.now();
    try { ls.setItem('ow_refreshing', String(began)); } catch (_) {}
    function unlock() { try { ls.removeItem('ow_refreshing'); } catch (_) {} }
    return global.fetch(BASE + '/api/auth/refresh', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(exchange ? { refresh_token: t } : {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        unlock();
        if (r.ok && j && j.access_token) {
          try {
            if (!BASE) ls.setItem('ow_session_cookie', '1');
            ls.setItem('ow_session_at', String(Date.now()));
            ls.removeItem('ow_token_at');                               /* the App's older key */
          } catch (_) {}
          if (BASE) { try { ls.setItem('ow_session_token', j.access_token); } catch (_) {} TOKEN = j.access_token; }
          else keepForPages(j);
          return true;
        }
        if (r.status === 401) {
          var again = 0;
          try { again = +ls.getItem('ow_session_at') || 0; } catch (_) {}
          if (again >= began) { TOKEN = null; return false; }           /* another tab renewed it first */
          try { ['ow_session_token', 'ow_tokens', 'ow_session', 'ow_token_at', 'ow_session_at', 'ow_session_cookie'].forEach(function (k) { ls.removeItem(k); }); } catch (_) {}
          TOKEN = null;
          global.location.href = '/login.html?return=' + encodeURIComponent('/oneway-app.html');
        }
        return false;
      });
    }).catch(function () { unlock(); return false; });
  }
  /* after the first screen, never in its way */
  try { global.addEventListener('load', function () { setTimeout(refreshDaily, 4000); }); } catch (_) {}

  /* AN ASSET URL IS RELATIVE, AND "RELATIVE TO WHAT" IS NOT OBVIOUS.
     The API serves `/assets/center-pictures/…` from its OWN persistent
     directory. The App, opened from a different origin in development, asked
     its own server and got 404 — measured 2026-08-17:

         /assets/profile-avatars/pat.svg   200 on :3030   404 on :8000
         /assets/center-pictures/x.png     404 on :3030   200 on :8000

     One lives in the repo the static server serves, the other in the API's
     store. In production both are one origin and both work, which is exactly
     how this hides. Every asset the API NAMES should be fetched from the API. */
  function assetUrl(u) {
    u = String(u || '');
    if (!u || !BASE) return u;
    return u.charAt(0) === '/' ? BASE + u : u;
  }

  var data = {
    asset: assetUrl,
    configure: function (opts) {
      opts = opts || {};
      if (opts.base != null) {
        BASE = opts.base.replace(/\/$/, '');
        /* images live where the runtime lives (see OW.imageUrl) */
        OW.assetBase = BASE;
      }
      if (opts.token != null) TOKEN = opts.token;
      /* WHO IS LOOKING. Messages carry an author email and no is-me flag, so a
         bubble cannot know which side it belongs on without this. */
      if (opts.me != null) ME = String(opts.me).toLowerCase();
      if (opts.home != null) HOME = String(opts.home);
      return data;
    },
    /* A read. Resolves to {ok, data} or {ok:false, status, error} — it NEVER
       throws and never resolves to invented content, so a caller cannot
       accidentally render a failure as if it were reality. */
    get: function (path, opts) {
      opts = opts || {};
      var key = path;
      var now = Date.now();
      if (!opts.fresh && cache[key] && (now - cache[key].at) < TTL) {
        return Promise.resolve(cache[key].v);
      }
      if (inflight[key]) return inflight[key];
      var t = token(), h = { 'Accept': 'application/json' };
      if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
      /* A READ THE PAGE ALREADY STARTED (oneway-app.html's early Home read),
         taken once, and only on the same origin it was asked of */
      var early = !BASE && global.__owEarly && global.__owEarly[path];
      if (early) delete global.__owEarly[path];
      var p = (early || global.fetch(BASE + path, { headers: h, credentials: 'same-origin' }))
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (j) {
            var v = r.ok
              ? { ok: true, status: r.status, data: j }
              : { ok: false, status: r.status,
                  /* THE DOOR'S OWN SENTENCE, FLATTENED ONCE. Whatever shape
                     the refusal arrives in, `error` is a string a surface can
                     put straight on the screen — and `body` keeps the raw
                     answer for the rare caller that needs the rule name. */
                  error: failSaid(j, r.status), body: j };
            cache[key] = { at: Date.now(), v: v };
            return v;
          });
        })
        .catch(function (e) {
          /* NOT 'offline' — WE DO NOT KNOW THAT.
             Every read in the App funnels through this catch, and it asserted
             the PERSON'S CONNECTION was down for any rejection at all: a wrong
             API base, a blocked request, DNS, a dead service, an aborted
             navigation. It is the third time tonight this same overclaim has
             turned up (login said it, the diagnosis said it, and now the layer
             underneath both). Status 0 with no error is the honest record of
             "the request did not come back"; OW.fault turns that into a real
             name, and only OW.diagnose — which actually probes — is allowed to
             say whose fault it is. */
          return { ok: false, status: 0, error: '' };
        })
        .then(function (v) { delete inflight[key]; return v; });
      inflight[key] = p;
      return p;
    },
    /* `opts.method` because some writes are PUT (profile style is one). One
       writer that takes a verb, never a second near-identical function whose
       error handling drifts from this one's. */
    post: function (path, body, opts) {
      opts = opts || {};
      var t = token(), h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
      return global.fetch(BASE + path, {
        method: opts.method || 'POST', headers: h, credentials: 'same-origin',
        body: body ? JSON.stringify(body) : '{}'
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) {
          return r.ok ? { ok: true, data: j }
                      : { ok: false, status: r.status,
                          error: failSaid(j, r.status), body: j };
        });
      }).catch(function () {
        /* ── THE REQUEST DID NOT COME BACK (C, 2026-08-23) ─────────────────
           Founder, PRODUCT_RESET §24: *"do not unnecessarily reject reversible
           actions just because the network is unavailable"* — and, in the same
           section, *"Never fabricate server success."*

           So a caller that has declared this write REVERSIBLE gets it written
           down and replayed; everything else keeps the honest refusal it always
           had. The caller decides, because the caller is the only one that
           knows whether replaying this is safe: a message can be sent late, a
           payment cannot.

           THE RESULT STILL HAS `ok: false`. Every branch in the App reads that
           field, so a surface which has not been taught about queueing renders
           this as the failure it currently is, rather than as a success it is
           not. Opting in to the pending treatment means reading `queued`. */
        if (opts.queueable && OW.offline && OW.offline.queue) {
          return OW.offline.queue(path, body, {
            method: opts.method || 'POST',
            label: opts.label || '',
            invalidate: opts.invalidate || ''
          });
        }
        /* a WRITE that got no answer says so in words — without claiming
           whose fault it was (the read path's rule, above) */
        return { ok: false, status: 0, error: 'ONEWAY did not answer, so nothing was done. Try again.' };
      });
    },
    /* DELETE, PUT — the same request path with a different verb. `post`
       already took `opts.method`; these exist so a caller reads as what it
       does. Undoing something is not a POST, and a surface that has to say so
       in an options bag is a surface that will forget to. */
    del: function (path, opts) {
      return this.post(path, null, Object.assign({}, opts || {}, { method: 'DELETE' }));
    },
    put: function (path, body, opts) {
      return this.post(path, body, Object.assign({}, opts || {}, { method: 'PUT' }));
    },
    /* PATCH — CHANGE PART OF SOMETHING. It is a different promise from PUT:
       PUT replaces, PATCH merges, and the canonical person route is a merge
       (sending a pronoun must not blank a bio). It did not exist, and the
       profile editor was written calling it — `data.patch is not a function`
       throws inside the click handler, so the field would have said "Saving…"
       forever and no request would ever have left the page. Caught before it
       shipped; the shape is the one this session keeps finding, which is a
       caller naming something the other side does not have. */
    patch: function (path, body, opts) {
      return this.post(path, body, Object.assign({}, opts || {}, { method: 'PATCH' }));
    },
    /* Reality changed → the reads that described it are stale. Called after
       every successful action so the next paint is true. */
    me: function () { return ME; },
    /* ── A PERSON'S OWN PLACE ────────────────────────────────────────────
       A canonical Post belongs to a Place — `POST /api/oneway/social/posts`
       refuses without a `center_id` — and every surface that wanted to write
       one had to find the person's own Centre for itself. `/api/auth/me`
       has always returned it as `home_id`; nothing read it. Read once, at the
       same moment the session is, so no surface asks a second time and no two
       surfaces can disagree about which Place a person writes from. */
    meHome: function () { return HOME; },
    /* WHO IS SIGNED IN, ANSWERED ONCE FOR THE WHOLE APP. `doc-editor.js` keeps
       its own token reader (localStorage, where a real sign-in puts it) and had
       no way to see a session configured in memory — so the editor reported
       "Save failed" against a perfectly valid session. Exposed rather than
       duplicated: two readers of one session drift, and this one is the App's. */
    token: function () { return token(); },
    invalidate: function (match) {
      Object.keys(cache).forEach(function (k) {
        if (!match || k.indexOf(match) >= 0) delete cache[k];
      });
    }
  };
  OW.data = data;

  /* ── WHICH CACHED READS AN ACT INVALIDATES ─────────────────────────────
     Every act below invalidated the literal string `/api/me/feed`.
     `data.invalidate(match)` deletes cache keys CONTAINING `match`, and Home
     stopped reading that path when the feed moved to the new backend — so
     after the migration these calls cleared a key nothing caches any more,
     while the canonical feed stayed cached and stale.

     MEASURED IN THE BROWSER 2026-09-03: with `/api/oneway/feed/stream?limit=24`
     in the cache, `invalidate('/api/me/feed')` produced ZERO refetches;
     `invalidate('/api/oneway/feed')` produced one. Then end to end through the
     real control: clicking Like fired one `/respond` and one feed re-read.

     `/feed` is the substring every feed read shares — the canonical stream,
     the canonical social feed and the legacy galleries feed alike — and
     nothing else in the App has it. It keeps matching when the last legacy
     feed retires, which is the point: this is the line that should NOT need
     editing again.

     ★ THIS FIX WAS APPLIED ONCE AND LOST. It was uncommitted working-tree work
     when lane C committed this file at 16:28 on 2026-09-03, and went with it.
     Re-applied. */
  var FEED_READS = '/feed';

  /* ═══ 2 · ACTIONS ══════════════════════════════════════════════════════
     A Popit that can only be looked at is a picture. This is how one DOES
     something — and the whole design is about not lying while it happens.

     Optimistic for feel; reverted and explained on failure. The control is
     disabled in flight so a double-tap cannot fire twice. On success the
     affected reads are invalidated so the surface re-reads reality rather
     than trusting what it just assumed. */
  function actState(btn, s) {
    btn.setAttribute('data-act', s);
    btn.disabled = (s === 'working');
  }

  /* ── THE PERSON'S OWN ANSWER ABOUT MOTION ────────────────────────────────
     `reduce_motion` is an enforced ONEWAY setting, and the OS carries its own
     preference. Both are honoured, and the CSS reads this attribute — so the
     answer is resolved ONCE here rather than by every animation deciding for
     itself. What is removed is movement; the state change itself always still
     happens, because a person who dislikes animation has not asked to be kept
     uninformed. */
  (function () {
    function apply(on) {
      try {
        if (on) doc.documentElement.setAttribute('data-ow-motion', 'reduce');
        else doc.documentElement.removeAttribute('data-ow-motion');
      } catch (e) {}
    }
    try {
      var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq && mq.matches) apply(true);
    } catch (e) {}
    /* and the account's own setting, once it is known — asked only when
       there is an account to ask (signed out, the only answer is 401) */
    try {
      if (token()) data.get('/api/me/settings').then(function (r) {
        var s = (r && r.ok && r.data && r.data.settings) || null;
        if (s && s.reduce_motion) apply(true);
      }).catch(function () {});
    } catch (e) {}
  })();

  /* ── A COUNT BESIDE A BUTTON MUST MOVE WHEN THE BUTTON DOES ────────────
     Pressing Follow flipped the label to "Following" and left "1 follower"
     sitting next to it — correct on the server, wrong on the screen, until the
     person reloaded. Found by walking the product; every suite was green,
     because the server was right and nothing asked what the screen said.

     ONE STEP, NOT A GUESS AT A TOTAL. `/api/me/follow` answers `following` and
     `friends` and carries no count, so there is no authoritative number to
     take. Adjusting by one is exactly what just happened, and the next read
     replaces it with the server's own figure.

     IT CREATES THE STAT WHEN THERE WAS NONE. A person with no followers has no
     followers line at all, so following them had nothing to update — the count
     would have appeared only on reload, which is the same defect wearing a
     zero. */
  function bumpStat(fromBtn, key, delta, one, many) {
    var box = fromBtn && fromBtn.closest && fromBtn.closest('.ow-prof__id');
    if (!box) return;
    var el = box.querySelector('[data-stat="' + key + '"]');
    var n;
    if (el) {
      n = Math.max(0, (parseInt((el.querySelector('b') || {}).textContent, 10) || 0) + delta);
      if (!n) { el.parentNode && el.parentNode.removeChild(el); return; }
      el.innerHTML = '<b>' + n + '</b>' + (n === 1 ? one : many);
      return;
    }
    if (delta <= 0) return;
    var row = box.querySelector('.ow-prof__stats');
    if (!row) return;
    var made = mk('span', 'ow-prof__stat', '<b>1</b>' + one);
    made.setAttribute('data-stat', key);
    row.insertBefore(made, row.firstChild);
  }

  OW.act = function (btn, spec) {
    spec = spec || {};
    if (!btn || btn.disabled) return Promise.resolve({ ok: false });
    var was = btn.textContent, wasOn = btn.getAttribute('aria-pressed') === 'true';
    var on = !wasOn;
    var path = on ? spec.path : (spec.undoPath || spec.path);
    if (!path) return Promise.resolve({ ok: false });

    actState(btn, 'working');
    if (spec.labels) btn.textContent = spec.labels[on ? 'on' : 'off'] || was;
    btn.setAttribute('aria-pressed', String(on));

    /* THE BODY MAY DEPEND ON WHICH DIRECTION THIS PRESS IS GOING.
       ★ FOUNDER, 2026-08-26: the reaction path must survive *"reconnect after
         temporary network loss."*
       A control that only ever says "toggle" cannot: the request is sent, the
       reply is lost, the retry flips it back, and the person is left NOT having
       liked the thing they pressed. Passing a function lets a caller state the
       state it wants — `{type:"like", on:true}` — which is idempotent however
       many times it arrives. A plain object still works unchanged. */
    var payload = (typeof spec.body === 'function') ? spec.body(on) : spec.body;

    /* SOME ACTS ARE NOT POSTS. `oneway.graph` undoes a block with DELETE on the
       same path, which is the correct shape for it — and a toggle helper that
       can only POST forces every such control to be hand-rolled beside this one
       and drift from it. One writer, which takes a verb. */
    var verb = on ? (spec.method || 'POST') : (spec.undoMethod || spec.method || 'POST');

    return data.post(path, payload, { method: verb }).then(function (r) {
      if (r.ok) {
        actState(btn, on ? 'on' : 'off');
        data.invalidate(spec.invalidate || '/api/me');
        if (spec.after) spec.after(r, on);
        return r;
      }
      /* THE HONEST PATH. Put it back exactly as it was and say what happened —
         never leave a control showing a state the server refused. */
      btn.textContent = was;
      btn.setAttribute('aria-pressed', String(wasOn));
      actState(btn, 'failed');
      /* WHAT THIS PARTICULAR REFUSAL MEANS. A caller may name the statuses it
         knows about — `/api/me/follow` now answers 409 for a block and 503 for
         a failed canonical write, and those need opposite responses from a
         person: one is permanent, one is "press it again". Collapsing them into
         a single "could not" is how a surface tells somebody to keep trying
         something that will never work. */
      var said = spec.says && spec.says[r.status];
      /* 401 is "signed out"; a 403 is the server's own reason — a private
         place, a rule, a block — and telling a signed-in person to "sign in
         first" sent them to fix the wrong thing (founder/502 sweep). A press
         with no answer says so, never an empty line. */
      var why = said
        || (r.status === 401 ? 'Sign in first.' : r.error)
        || 'That did not go through. Try again.';
      btn.setAttribute('title', String(why));
      /* ── AND IT SAYS SO WHERE A PERSON IS LOOKING ──────────────────────
         ★ FOUNDER/493: the bottom bar exists to describe *"an individual
           error."*
         `OW.say` writes beside the control, which is right when the control is
         a word in a form and useless when it is a 19px heart at the bottom of
         a card that may be half off the screen — the case that is most of this
         product. Both: the line stays where the press was, and the bar says it
         where a person is already looking. */
      OW.say(btn, why);
      if (OW.toast) OW.toast(String(why));
      setTimeout(function () { actState(btn, wasOn ? 'on' : 'off'); }, 2400);
      return r;
    });
  };

  /* a small honest word next to the thing that failed — never a toast that
     outlives the reason for it */
  /* ══ THE BAR THAT SAYS WHAT JUST HAPPENED ═════════════════════════════
     ★ FOUNDER/493: *"What oneway app has to begin doing is having a bottom
       notification bar that can popup like all social medias describing
       briefly for a second an individual error if there is then fade away
       after a second."*

     `OW.say` puts a line next to the control that failed, which works when
     there IS a control on screen and the person is looking at it. Most of what
     goes wrong is not like that: a post that failed to upload, a repost the
     server refused, a read that came back empty. The App had nowhere to say
     any of it, so it said nothing at all — which is why a failed act has been
     indistinguishable from a slow one.

     ONE BAR, ONE MESSAGE, ONE PLACE. Above the dock, so it never covers the
     thing the person is reaching for; centred and narrow so it reads as a
     notice rather than a screen. A second message REPLACES the first rather
     than stacking — a column of toasts is a different product, and the
     founder's word is "an individual error".

     IT SAYS WHERE THE THING WENT, TOO. `tone` is `'ok'` for a post that
     landed, and the caller may pass an action ("See it") — 493 asks for
     *"feedback that truly tells user where a post uploaded and where to click
     it."*  The action is optional and the bar is identical without it.

     IT IS NOT A DIALOG. Nothing here takes focus, nothing blocks, nothing
     waits for a press; it fades on its own. An error a person cannot dismiss
     is at least an error that cannot trap them. */
  var toastEl = null, toastTimer = 0;
  OW.toast = function (msg, opts) {
    opts = opts || {};
    if (!msg) return;
    if (toastTimer) { global.clearTimeout(toastTimer); toastTimer = 0; }
    if (!toastEl || !toastEl.parentNode) {
      toastEl = doc.createElement('div');
      toastEl.className = 'ow-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '';
    toastEl.setAttribute('data-tone', opts.tone === 'ok' ? 'ok' : 'bad');
    toastEl.appendChild(mk('span', 'ow-toast__t', esc(String(msg))));
    if (opts.action && typeof opts.onAction === 'function') {
      var b = mk('button', 'ow-toast__a', esc(String(opts.action)));
      b.type = 'button';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        try { opts.onAction(); } catch (_) {}
        OW.toast.hide();
      });
      toastEl.appendChild(b);
    }
    /* reflow so a replacement message re-runs the entrance rather than
       appearing already-arrived */
    toastEl.removeAttribute('data-on');
    void toastEl.offsetWidth;
    toastEl.setAttribute('data-on', '1');
    /* an error gets the second he asked for; something with an action to press
       gets long enough to press it */
    toastTimer = global.setTimeout(OW.toast.hide, opts.action ? 5200 : 2400);
  };
  OW.toast.hide = function () {
    if (toastTimer) { global.clearTimeout(toastTimer); toastTimer = 0; }
    if (!toastEl) return;
    toastEl.removeAttribute('data-on');
    var el = toastEl;
    global.setTimeout(function () {
      if (el && el.parentNode && !el.hasAttribute('data-on')) el.parentNode.removeChild(el);
    }, 320);
  };

  OW.say = function (near, msg) {
    if (!near) return;
    var n = doc.createElement('span');
    n.className = 'po-say';
    n.textContent = String(msg || '');
    near.insertAdjacentElement('afterend', n);
    setTimeout(function () { n.remove(); }, 2600);
  };


  /* ═══ 2.1 · THE ACT LISTENER ═══════════════════════════════════════════
     The material file announces intent; this carries it out. One listener for
     every acting widget on every surface — so there is exactly one place where
     a Popit can change reality, and exactly one place to audit. */
  doc.addEventListener('ow:act', function (e) {
    var d = e.detail || {}, btn = d.button, w = d.widget || {};
    if (!btn) return;

    if (d.create) {
      /* NO PERSONAL CREATE ENDPOINT EXISTS YET — and that matters more than it
         looks. `/api/me/lightbulb` is a GET: it states what a person MAY
         create. There is no POST behind it, so a button that "began" something
         here would 404 forever while appearing to work.

         So this does not mutate. It announces the intent and the App routes
         into Lightbulb with the type chosen — which is the correct behaviour
         regardless: Lightbulb is the entry point for everything personal, and
         creation belongs in the creation environment, not in a tile on Home.

         When a personal create endpoint exists, this becomes an OW.act call
         and nothing else on the surface changes. */
      doc.dispatchEvent(new CustomEvent('ow:create', {
        detail: { type: d.create, from: d.from === 'room' ? 'room' : 'home' } }));
      /* BEGUN FROM INSIDE THE OBJECT. Creation moves you to Lightbulb, so the
         room you began in must fold away first — otherwise the sheet is left
         floating over the surface you were just sent to. */
      if (d.from === 'room') OW.close();
      OW.live.begin(d.create, btn);
      return;
    }

    var way = (w.ways || []).filter(function (x) { return x.verb === d.verb; })[0];
    if (!way) return;
    OW.act(btn, {
      path: way.path, undoPath: way.undoPath, body: way.body,
      labels: { on: way.labelOn || (way.label + 'ing'), off: way.label },
      invalidate: '/api/',
      after: function (r, on) {
        /* reality moved, so the sentence describing it must be re-read, not
           assumed — the widget's own footer is refreshed from the server */
        if (typeof w.onChanged === 'function') w.onChanged(on);
        /* AND THE OTHER COPY OF THIS CONTROL MOVES WITH IT. The same way is
           now rendered twice — on the tile and in the room it opens — and two
           nodes for one state is how a button comes to say "Joining" in one
           place and "Join" in the other. The state is the server's; this only
           stops the second view from contradicting the first. */
        OW.mirrorAct(d.verb, on, btn);
      }
    });
  });

  /* ═══ 3 · STATES ═══════════════════════════════════════════════════════
     Loading shows the SHAPE of what is coming and nothing else. Empty says a
     true sentence. Refused says what happened. None of the three ever draws
     content that could be mistaken for reality. */
  function stateTile(host, state, label, msg, size) {
    var n = doc.createElement('div');
    n.className = 'po po-w po--' + (size || '2x1');
    n.setAttribute('data-state', state);
    n.setAttribute('data-v', '0');
    n.appendChild(mk('span', 'po-face'));
    n.appendChild(mk('span', 'po-w__head',
      '<span class="po-w__eyebrow">' + esc(label || '') + '</span>'));
    n.appendChild(mk('span', 'po-w__body',
      state === 'loading' ? '<span class="po-skel"></span><span class="po-skel"></span>'
                          : '<span class="po-w__note">' + esc(msg || '') + '</span>'));
    if (host) host.appendChild(n);
    return n;
  }
  function mk(t, c, h) { var n = doc.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ══ THE PLATFORM'S OWN SENTENCE, WHEREVER IT REFUSES ═══════════════════
     ★ FOUNDER/402: the refusal appears where the interaction is, and it says
     the actual reason.

     A door refuses in one of three shapes and a surface that only reads one
     of them prints nothing useful for the other two:

       {detail: "not available — 1 conflicting reservation(s)"}   a sentence
       {detail: {error, rule, message, refusals:[{rule, message}]}} a RULE
       {detail: [{loc, msg}]}                                      validation

     AND ALMOST NOTHING IN THE APP EVER SHOWED ONE. Eight surfaces read
     `r.data.detail` on a refusal — the booking, the cancel, the post editor,
     the delete, the profile field, adding someone to a conversation — and on
     a failure this layer sets no `data` at all. Every one of them was reading
     a field that is never there, so every refusal in the App fell through to
     its own generic sentence and the door's actual reason was discarded on
     the way in. Two surfaces read `r.error`, which is the real contract, and
     one of those had a comment saying so.

     So the flattening happens HERE, once, where every read and every write
     already funnels: `error` is a string a surface can put on the screen
     whatever shape arrived, and `body` keeps the raw answer for a caller that
     needs the rule name to act on it.

     All the refusals are said, never just the first: a stay can break two
     rules at once, and fixing one only to be refused again reads as a broken
     form rather than a house rule. */
  /* WHAT A PERSON READS WHEN A REQUEST IS REFUSED. The server's own words
     when it gave some; otherwise a sentence for the kind of failure — never
     "HTTP 500", which is what a person used to read under a message that did
     not send (founder/502 sweep). A server FAULT (500 · 502 · 504) never
     shows the server's text at all: that is an exception's message, written
     for whoever runs the server ("profile brain unavailable: KeyError …"). */
  function failSaid(payload, status) {
    if (status === 500 || status === 502 || status === 504) return failWords(status);
    return refusalWords(payload, failWords(status));
  }
  function failWords(status) {
    if (status === 401) return 'You are signed out. Sign in again, then try once more.';
    if (status === 403) return 'That is not open to you.';
    if (status === 404) return 'That is no longer here.';
    if (status === 409) return 'That changed while you were on it. Try again.';
    if (status === 413) return 'That is too big to send.';
    if (status === 429) return 'Too many at once. Wait a moment, then try again.';
    if (status >= 500) return 'Something went wrong on ONEWAY\'s side. Nothing changed — try again in a moment.';
    return 'That could not be done. Nothing has changed.';
  }
  function refusalWords(payload, fallback) {
    var d = (payload && typeof payload === 'object' && 'detail' in payload)
      ? payload.detail : payload;
    if (typeof d === 'string' && d.trim()) return sentence(d);
    if (d && typeof d === 'object') {
      var rs = d.refusals, said = [], i;
      if (rs && rs.length) {
        for (i = 0; i < rs.length; i++) {
          var m = rs[i] && (rs[i].message || rs[i].msg);
          if (m && said.indexOf(sentence(m)) < 0) said.push(sentence(m));
        }
        if (said.length) return said.join(' ');
      }
      if (d.message) return sentence(d.message);
      if (d.error && typeof d.error === 'string') return sentence(d.error);
      if (d.length) {
        for (i = 0; i < d.length; i++) if (d[i] && d[i].msg) said.push(sentence(d[i].msg));
        if (said.length) return said.join(' ');
      }
    }
    return fallback || 'That could not be done. Nothing has changed.';
  }
  /* The engine answers a bare clause — "already held then" — so the surface
     ends it, and two clauses join with one space rather than running on. */
  function sentence(s) {
    s = String(s == null ? '' : s).trim();
    return (s && !/[.!?]$/.test(s)) ? (s + '.') : s;
  }

  /* ONE IMAGE VALIDATOR, and it lives in the material (oneway-popit.js)
     beside the other place images are rendered. Aliased here so this file
     reads naturally; a second copy would be a second rule to keep in sync,
     which is how the two ends drift apart. */
  var imageUrl = OW.imageUrl;

  /* WAITING LOOKS LIKE ONEWAY. Skeleton tiles are what every product uses and
     they promise a shape the answer may not have — a person watches two grey
     rectangles and then gets one row, or nothing. The globe promises only that
     something is happening, which is the only honest thing a loader knows.

     It also costs less: eight animated opacities on one GPU layer, against N
     skeleton blocks each pulsing their own background. */
  function loading(host, n, word) {
    host.className = ''; host.innerHTML = '';
    var wrap = mk('div', 'ow-loading');
    wrap.appendChild(OW.globe({ label: word || 'Loading' }));
    wrap.appendChild(mk('span', 'ow-loading__w', esc(word || 'One moment')));
    host.appendChild(wrap);
    return wrap;
  }
  /* ═══ THE DOOR ══════════════════════════════════════════════════════════
     Founder (2026-08-03): "I used to be able to view centres and posts on the
     app without having to sign up… When people try to go to specific user
     functions, they should be met with the loading globe and a sign up or
     login button. With the ONEWAY hero logo."

     TWO DIFFERENT THINGS WERE BEING TREATED AS ONE. "Not signed in" is not a
     failure — it is a person who has not arrived yet, and answering it with a
     grey tile reading "not yours to see" turns the front door into an error
     message. A 404 or a dead network IS a failure and keeps the tile.

     WHAT IS PUBLIC STAYS PUBLIC. This door appears in front of the functions
     that are genuinely a PERSON'S — their feed, their messages, their work,
     their own Center — and never in front of a Center's public window or the
     posts it published. A place anyone can walk past should not ask for papers.

     THE MARK IS ONEWAY'S OWN HERE, not a hue: there is no viewer yet to take a
     colour from, and inventing one would be the platform claiming an identity
     on behalf of somebody who has not chosen anything. */
  function signedIn() { return !!token() || cookieSession(); }
  OW.signedIn = signedIn;

  OW.door = function (host, what, why) {
    host.classList.remove('po-grid'); host.innerHTML = '';
    var d = mk('div', 'ow-door');
    d.appendChild(OW.globe({ size: 108, label: 'ONEWAY' }));
    var logo = mk('img', 'ow-door__logo');
    /* THE LOGO IS A WEB ASSET, NOT AN API ONE. Prefixing OW.assetBase pointed it
       at the API origin, which serves data and has never served the wordmark —
       so the door rendered with a broken image where the mark should be. The
       two bases are not interchangeable just because both are origins. */
    /* ── THE MARK IS A DIFFERENT FILE IN LIGHT, NOT A FILTERED ONE ──────
       The stylesheet inverts this in light mode
       (`html[data-theme="light"] .ow-door__logo{filter:invert(1) …}`) and that
       rule does not run: `html[data-fx="safe"] *` sets `filter:none !important`
       on everything. So on the safe tier — this machine, and most phones — the
       sign-in door showed a WHITE wordmark on a light page.

       Identical to the defect just fixed on `.ow-top__mark`, and it is the
       worse half of it: this is the FIRST screen a new person sees, and it
       looks perfectly correct on a capable laptop, which is where it would be
       checked. `logo-black.png` already exists.

       Read from the attribute the theme writer maintains rather than from
       `matchMedia`, so the door agrees with the rest of the App including a
       person's explicit override. */
    var _lightDoor = doc.documentElement.getAttribute('data-theme') === 'light';
    logo.src = _lightDoor ? 'logo-black.png' : 'logo-white.png';
    if (!_lightDoor) logo.setAttribute('srcset', 'logo-white@2x.png 2x');
    logo.setAttribute('alt', 'ONEWAY'); logo.setAttribute('width', '132');
    d.appendChild(logo);
    /* THE WORDS ARE THE FOUNDER'S (2026-08-03), verbatim. I had written a
       different line per surface; copy is voice, voice is theirs, and the
       buttons say the same verbs the sentence does — "join" and "sign in",
       not a sentence about joining above a button marked Sign up. */
    d.appendChild(mk('p', 'ow-door__why',
      'You are not currently logged in. Join our growing user network, or sign in.'));
    var row = mk('div', 'ow-door__acts');
    /* THE WAY BACK TRAVELS WITH THEM. Signing in is an interruption; a person
       who was looking at a Center and pressed Sign in should be looking at that
       Center afterwards. Without this they land on a default surface and have
       to find their way back to what they were already doing — the friction the
       founder named. `?new=1` also went to login.html, which has no sign-up on
       it; Join now opens the page that actually signs people up. */
    var here = withApi('login.html') ;
    var back = '&return=' + encodeURIComponent(
      global.location.pathname + global.location.search + global.location.hash);
    var up = mk('a', 'po-act po-act--primary', 'Join');
    up.href = withApi('signup.html') + (withApi('signup.html').indexOf('?') >= 0 ? '' : '?') + back.slice(1);
    var inb = mk('a', 'po-act', 'Sign in');
    inb.href = here + (here.indexOf('?') >= 0 ? back : '?' + back.slice(1));
    row.appendChild(up); row.appendChild(inb);
    d.appendChild(row);
    host.appendChild(d);
    return d;
  };
  /* THE DEV API OVERRIDE TRAVELS WITH THE PERSON THROUGH THE DOOR, or a preview
     link dead-ends at a sign-in page pointed at the wrong origin. The separator
     is decided by the href it is joining, not assumed — the first version wrote
     "&" for both and would have produced login.html&api=… , which is a query
     string that is really part of the path. `login.html` is only ever a
     same-origin sibling of this page, so this cannot be steered anywhere. */
  function withApi(href) {
    try {
      var q = new global.URLSearchParams(global.location.search).get('api');
      if (!q) return href;
      return href + (href.indexOf('?') >= 0 ? '&' : '?')
        + 'api=' + encodeURIComponent(q);
    } catch (_) { return href; }
  }

  function refused(host, r, what) {
    var f = OW.fault(r);
    /* a person who has not arrived yet meets the door, not an error tile —
       "sign in" is a way forward, and an error is not */
    if (f.do === 'sign_in') return OW.door(host, what);
    host.classList.add('po-grid'); host.innerHTML = '';
    stateTile(host, 'refused', what || f.title, f.detail, '4x1');
    /* only offer a retry where trying again could actually change the answer —
       a retry button on a 403 tells someone to keep knocking on a locked door */
    if (f.retry) {
      var b = mk('button', 'po-act', 'Try again');
      b.type = 'button';
      b.addEventListener('click', function () { global.location.reload(); });
      host.appendChild(b);
    }
    return 0;
  }
  /* ═══ 3.1 · FAILURE IS LOCAL ════════════════════════════════════════════
     Founder (2026-08-02): "if they fail to load it fails individual blocks or
     popits rather than the entire page or section… things should have their
     own try and refresh button that groups the more things that fail at once."

     THE RULE: one failed read takes down ONE block. A surface is many reads —
     the feed, your notifications, what your role operates — and letting the
     first refusal blank the page throws away everything that DID load. A
     person who can still see four of five things is in a far better position
     than one looking at an error.

     AND FAILURES GROUP. Five separate "Try again" buttons is five decisions
     about the same broken network. The first failure renders its own retry;
     from the second onward they collapse into ONE control that retries all of
     them together, and the count is stated plainly. Retrying re-runs only the
     loaders that actually failed — never the whole surface, which would throw
     away the parts that worked.

     Nothing here invents a state: a block that fails says what the runtime
     said, with the same honest wording `refused` already uses. */
  var failed = [];          /* the loaders currently in a failed state */
  var groupBar = null;

  /* ONE VOCABULARY. This had its own four-case wording ('not yours to see',
     'nothing there', 'you appear to be offline'), refused() below had a second
     set, and login.html had a third — so the same 403 read differently on three
     surfaces of one product. They all read the fault table now; a failure kind
     is described in exactly one place, and a new one is a row rather than three
     edits nobody remembers to make. */
  function failWord(r) {
    return OW.fault(r).title;
  }

  function renderGroup() {
    /* one control for everything currently broken — built fresh each time so
       it can never claim more failures than there are */
    if (groupBar && groupBar.parentElement) groupBar.parentElement.removeChild(groupBar);
    groupBar = null;
    if (failed.length < 2) return;
    groupBar = mk('div', 'ow-retry-all');
    groupBar.innerHTML = '<span>' + (failed.length === 1
      ? 'One thing did not load.'
      : failed.length + ' things did not load.') + '</span>';
    var b = mk('button', 'po-act', 'Try all again');
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Trying…';
      var again = failed.slice();
      failed = [];
      renderGroup();
      again.forEach(function (f) { f.run(); });
    });
    groupBar.appendChild(b);
    (doc.getElementById('surface') || doc.body).appendChild(groupBar);
  }

  /* Run one loader inside its own boundary. `label` is what the person calls
     the thing, so a failure can name it. Returns a promise that NEVER rejects
     — a block's failure is its own business and must not take down its
     siblings. */
  OW.block = function (host, label, loader) {
    if (!host) return Promise.resolve(null);
    var entry = { label: label, run: null };

    function attempt() {
      /* drop any earlier failure for this block before trying again */
      failed = failed.filter(function (f) { return f !== entry; });
      host.innerHTML = '';
      var out;
      try {
        out = loader(host);
      } catch (e) {
        out = Promise.reject(e);
      }
      return Promise.resolve(out).catch(function (e) {
        /* THE BLOCK FAILS, AND ONLY THE BLOCK */
        host.innerHTML = '';
        host.classList.add('po-grid');
        /* THE LAST RESORT SHOULD STILL SAY SOMETHING TRUE. This ended in
           'something went wrong' — the one sentence in the App that tells a
           person nothing at all, sitting under a heading that already said the
           block did not load. Its own siblings in `OW.fault` set the bar:
           "You're offline", "Couldn't reach ONEWAY", "ONEWAY is between
           restarts", "That took too long". Each names WHO failed and WHAT it
           means for you.

           When there is genuinely no status and no message there is still one
           true and useful thing to say: nothing was changed. That is what a
           person actually wants to know before pressing Try again. */
        var why = (e && e.status !== undefined) ? failWord(e)
                : (e && e.message) ? e.message
                : 'This did not load, and nothing has been changed';
        var tile = stateTile(host, 'refused', label || 'Did not load',
                             why + '.', '4x1');
        var again = mk('button', 'po-act', 'Try again');
        again.type = 'button';
        again.addEventListener('click', function () {
          again.disabled = true; again.textContent = 'Trying…';
          attempt();
        });
        (tile || host).appendChild(again);
        if (failed.indexOf(entry) < 0) failed.push(entry);
        renderGroup();
        return null;
      }).then(function (v) {
        renderGroup();
        return v;
      });
    }
    entry.run = attempt;
    return attempt();
  };

  /* a read that REFUSED is a failure for block purposes — callers hand the
     response straight to this so one shape covers both throw and 4xx */
  OW.blockFail = function (r) {
    var e = new Error(failWord(r));
    e.status = (r || {}).status;
    e.error = (r || {}).error;
    throw e;
  };

  /* THE EMPTY STATE IS A PLACE, NOT A BROKEN TILE (founder, 2026-08-09).
     This used to be a small dashed `po-w` box pinned to the top-left of an
     otherwise empty world — the founder's words on seeing it: the quiet-feed
     box "is exactly what shouldn't be", while the signed-out DOOR (§23 — the
     turning globe, the wordmark, one sentence, a way in) "was perfect and the
     exact visual direction our UI should be taking."

     So an empty surface now speaks in the Door's language instead of a state
     tile's: the mark keeps turning, the sentence is centred and given room,
     and there is no dashed rectangle implying something failed to load.
     NOTHING IS INVENTED HERE — `.ow-door` already centres, already carries the
     globe, and §23 already says what this moment is: "not an error state: this
     is the front of the building." An empty feed is the same moment for
     somebody who HAS arrived.

     THIS COMMENT USED TO END "minus the way in, which they no longer need",
     AND THAT WAS WRONG — corrected here after walking the App as a stranger.
     A signed-out visitor at the Door can at least sign in. A new person whose
     feed is empty was handed the sentence "Follow a Center or join a
     community" AND NOTHING TO CLICK: an instruction where a door should be,
     on the first screen they ever see. They need the way in MORE than the
     visitor does, not less.

     So `acts` is optional and every empty surface that can name a next move
     now passes one. IT NAVIGATES THROUGH `global.go`, WHICH IS WHAT THE
     SIGNED-OUT DOOR TWENTY LINES ABOVE ALREADY DOES. An `ow:go` event was
     written here first and thrown away: it worked, but it would have been a
     second way to change destination in a codebase whose first build rule is
     never a second implementation of an existing concept. Where `go` is
     absent — the signed-out surfaces — the act simply does not render, which
     is honest: a button that cannot go anywhere is the dead end again.

     AND THE GLOBE IS `done` HERE, NOT `loading`. The sweep means "something
     is coming". On an empty surface nothing is coming, and a mark that
     implies otherwise is the same lie as a spinner that never resolves —
     with `role="status"` it is also what a screen reader announces. Still,
     present, turning slowly: the network exists, you are simply not yet
     connected to it.

     The label becomes the display line and the sentence sits under it, which
     is the Door's own order (mark → name → why). */
  function nothing(host, sentence, label, acts) {
    host.classList.remove('po-grid');
    /* THE SAME DOOR, INSIDE A SURFACE THAT ALREADY HAS CHROME. The signed-out
       Door owns a whole viewport; this one sits under a header and above the
       nav, and at the page Door's spacing its action fell under the dock — so
       the only thing to do on an empty screen needed a scroll to find. The
       modifier tightens the spacing and nothing else: the founder approved
       that Door, so its own measurements are not touched. */
    var d = mk('div', 'ow-door ow-door--inline');
    try {
      /* ── THE MARK TURNS HERE; IT DOES NOT FLASH ─────────────────────────
         ★ FOUNDER, 2026-08-30: *"fix it flashing completed WHEN CHANGING
           PAGES"* · *"it should be rotating in its loading animation"*.

         This mounted the globe in `state:'done'`, which plays the completion
         flash — the beat that says A THING HAS FINISHED. Nothing finishes when
         you open an empty Home; the screen you land on after changing pages
         was announcing a success that had not happened, and it was the flash
         he kept seeing.

         The completion beat is reserved for work that actually processed: a
         login, a payment, an upload landing (`OW.globeDone` at the gallery
         contribution below). Everywhere else the mark simply turns. */
      d.appendChild(OW.globe({ size: 84, label: label || 'ONEWAY' }));
    } catch (_) {}
    d.appendChild(mk('b', 'ow-door__title', esc(label || 'Quiet')));
    d.appendChild(mk('p', 'ow-door__why', esc(sentence || '')));
    if (acts && acts.length) {
      var row = mk('div', 'ow-door__acts');
      acts.forEach(function (a) {
        if (!a || !a.label) return;
        if (a.go && typeof global.go !== 'function') return;
        var b = mk('button', 'po-act', esc(a.label));
        b.type = 'button';
        b.addEventListener('click', function () {
          if (typeof a.fn === 'function') { a.fn(); return; }
          if (a.go) global.go(a.go);
        });
        row.appendChild(b);
      });
      if (row.children.length) d.appendChild(row);
    }
    host.appendChild(d);
    return d;
  }
  OW.states = { loading: loading, refused: refused, nothing: nothing };

  /* ═══ 4 · ADAPTERS — real payloads become widgets ═══════════════════════
     Each adapter maps ONE real endpoint shape onto the widget contract. When a
     field is absent from reality the widget is not built — that is how "a
     Popit exists only when its contents exist" is enforced in code rather than
     hoped for. Hues carried per-identity, never invented (Law 15): a Center
     with no approved hue gets the surface's, not a made-up one. */

  function hueOf(o) {
    if (!o) return null;
    if (o.hue1 || o.h1) return { h1: o.hue1 || o.h1, h2: o.hue2 || o.h2 || o.hue1 || o.h1 };
    if (typeof o.hue === 'number') { var p = OW.hue.fromAngle(o.hue); return { h1: p[0], h2: p[1] }; }
    return null;
  }


  /* 4.0 — WHOSE WORLD THIS IS. The surface must wear the SIGNED-IN PERSON'S own
     hue, not the platform default (founder: "make sure they are replying to the
     user's individual hues").

     It is read from their profile's style.accent_hue — a real per-person field
     they can change. Note the runtime currently keeps TWO user-hue stores that
     do not talk to each other: settings/personal → appearance.brand_hue (what
     _user_hue/resolved_hue reads) and this one. Writing the first changes
     nothing here. The App binds to the one the reads actually serve, and the
     split is a backend matter, not something to paper over with a guess. */
  OW.live.identity = function (email) {
    if (!email) return Promise.resolve(null);
    /* ── ONE READ, AND IT KNOWS THE DIFFERENCE ─────────────────────────────
       This asked `/api/users/{email}` and then, for the signed-in person,
       `/api/auth/me` as well — two requests to answer one question, because
       the first could not tell a CHOSEN colour from the platform default.
       That trap is documented at length three times in this file and cost the
       founder *"THE HUE TRANISTION FOR USERS STILL DOESNT WORK"*: of 1,260
       accounts, 1,255 answer 266 in the same field and the same shape as a
       real decision.

       `/api/oneway/people/{email}/profile` answers BOTH halves in one read —
       `person.hue` with `person.hue_chosen` beside it, and the `style` row for
       the five accounts that chose an exact pair. So the ambiguity that needed
       a second request is gone rather than worked around, and the second
       request with it. */
    /* NOT `fresh` — this is the BOOT read and its answer is a person's own
       colour, which does not change between the shell starting and My Center
       painting a moment later. Asking fresh here made every surface that reads
       the same door on the same load pay for its own round trip: measured
       THREE requests to one URL opening My Center. The surfaces that genuinely
       need the newest answer ask for it themselves. */
    return data.get('/api/oneway/people/' + encodeURIComponent(email) + '/profile')
      .then(function (r) {
      if (!r.ok) return null;
      var d = r.data || {};
      var person = d.person || {};
      var style = d.style || {};
      /* AN EXACT COLOUR OUTRANKS AN ANGLE — the same precedence the identity
         model uses everywhere else: what a person actually chose beats
         anything derived for them. */
      var pair = OW.hue.pairOf(style);
      if (pair) {
        OW.hue.bind({ pair: pair, angle: person.hue });
        return person.hue;
      }
      /* A DEFAULT IS NOT A CHOICE, and now the payload says which. Binding a
         derived hue would paint ONEWAY purple over a person's own world — the
         exact defect this replaces, where the crossing recoloured the world
         correctly and this line painted the default back over it a second
         later. Nothing is bound unless somebody chose it. */
      if (person.hue_chosen && person.hue != null) {
        OW.hue.bind({ angle: person.hue });
        return person.hue;
      }
      return null;
    });
  };

  /* 4.1 — HOME IS THE FEED (EXPERIENCE.md, the founder's Feed Correction,
     2026-07-23, canonical — it supersedes every "Home is not a feed" line in
     the repo, including the one I built against first).

     A familiar scrolling feed whose cards are GALLERIES: Gallery → Media →
     Feed. The card is a Popit's glance; opening it is the whole Gallery.

     The card already arrives complete — /api/me/feed/galleries returns the
     actor's identity and hue, the cover, the counts, and this viewer's own
     interaction state in ONE read. So a feed of fifty cards is one request,
     not fifty (the cost law), and the response controls are built from the
     server's own `offers` rather than a vocabulary invented here. */
  /* ═══ 4.1a · MEDIA — POOLING AND PRE-CACHING ═══════════════════════════
     The immersive feed's playback machinery, and the reason it can be smooth
     on a mid-range phone. Referenced by the feed since it was written and
     never actually built, so opening Home threw on the first `OW.media` call —
     which is why the feed's own end marker never appeared. Written now.

     THE ARCHITECTURE, in web primitives (founder's brief: TikTok/Instagram):

     · PLAYER POOLING. A fixed, tiny pool of <video> elements is MOVED between
       items rather than one player per post. Fifty posts with fifty players is
       fifty decoder pipelines; mobile browsers cap concurrent decoders and
       start failing silently long before that. Three is enough for previous ·
       current · next.
     · INTERSECTIONOBSERVER, NEVER A SCROLL HANDLER. A scroll listener runs on
       the main thread and competes with the compositor for exactly the frames
       you are trying to protect. The observer does not run there at all.
     · PRE-CACHING THE NEIGHBOURS, NOT THE FEED. The next two items are warmed
       (`img.decode()` off the main thread, `video.preload='auto'`); the rest
       are left alone. Warming fifty items is how a feed burns a person's data
       plan for content they never reach — and the cost law says the same thing
       about the server side.
     · AUTOPLAY IS OFF BY DEFAULT (the Engagement Laws, 2026-07-30). The
       ACTIVE item is prepared and, muted, may play; nothing else does, and a
       person who scrolls away has it paused immediately. */
  var mediaPool = { vids: [], active: -1 };

  function poolVideo(i) {
    if (!mediaPool.vids[i]) {
      var v = doc.createElement('video');
      v.className = 'po-card__vid';
      v.playsInline = true; v.muted = true; v.loop = true;
      v.preload = 'none'; v.controls = false;
      v.setAttribute('playsinline', '');   /* iOS honours the attribute */
      mediaPool.vids[i] = v;
    }
    return mediaPool.vids[i];
  }

  /* WHICH PLAYER ALREADY HOLDS THESE BYTES. A warmed <video> is only useful if
     the SAME element becomes the player — warming slot 1 and then playing slot
     0 throws the work away and relies on the HTTP cache to hide it. This hands
     back whichever element is already pointed at the source, and falls back to
     the play slot when none is. */
  function takePlayer(src) {
    for (var i = 0; i < mediaPool.vids.length; i++) {
      var v = mediaPool.vids[i];
      if (v && v.getAttribute('src') === src) return v;
    }
    var p = poolVideo(0);
    if (p.getAttribute('src') !== src) { p.setAttribute('src', src); p.load(); }
    return p;
  }

  /* WARM ONE POSITION — every piece of media it holds, none that it does not.
     A group of five text Posts warms nothing at all, which is the point: the
     cost follows the content rather than the page count. */
  var warmSlot = 1;
  function warmPos(pos) {
    if (!pos || !pos.items) return;
    pos.items.forEach(function (e) {
      var f = (e && e.face) || {};
      if (f.image) {
        var im = new global.Image();
        im.src = imageUrl(f.image);
        if (im.decode) { im.decode().catch(function () {}); }
      }
      if (f.video) {
        var src = imageUrl(f.video);
        var held = null, i;
        for (i = 0; i < mediaPool.vids.length; i++) {
          if (mediaPool.vids[i] && mediaPool.vids[i].getAttribute('src') === src) held = mediaPool.vids[i];
        }
        if (held) return;                       /* already warm */
        warmSlot = warmSlot === 1 ? 2 : 1;      /* never slot 0 — that is the player */
        var v = poolVideo(warmSlot);
        v.setAttribute('src', src);
        v.preload = 'auto';
        v.load();
      }
    });
  }

  /* ═══ VIDEO CONTROLS ══════════════════════════════════════════════════
     ★ FOUNDER, 2026-08-29: *"A modern video feed needs: autoplay · pause/play ·
       mute/unmute · volume · progress indication where appropriate ·
       captions/subtitles when available · fullscreen behavior · playback
       position handling · replay · preloading · graceful failure · adaptive
       media quality · correct behavior when scrolling away · correct behavior
       when returning. And critically: only the appropriate nearby players
       should actually be active."*

     WHAT IS BUILT HERE, and what is deliberately left to the platform:

       autoplay · pause/play · mute/unmute · progress · replay · position
       handling · scroll-away/return · graceful failure · a bounded pool
                                                    -> all of it, below.
       captions                                     -> rendered when the Post
                                                       CARRIES a track. Nothing
                                                       is generated: a caption
                                                       nobody wrote is a caption
                                                       nobody said (Law 15).
       fullscreen                                   -> the position IS full
                                                       screen. A second, nested
                                                       fullscreen would be a
                                                       different frame around
                                                       the same frame.
       adaptive quality · transcoding               -> a delivery concern, and
                                                       it belongs to whatever
                                                       serves the bytes. Named
                                                       as not-here rather than
                                                       silently missing.

     NO CHROME UNTIL IT IS WANTED. A feed that draws a control bar over every
     video is a video player with a feed attached. The whole frame is the
     play/pause target, the progress line is one pixel at the bottom, and the
     sound control is the only thing always drawn — because muted-by-default
     is a promise the person has to be able to see and undo. */

  function play(v, gesture) {
    if (!v) return;
    var p = null;
    try { p = v.play(); } catch (_) { p = null; }
    if (!p || !p.catch) return;
    p.catch(function (err) {
      /* ── TWO DIFFERENT REFUSALS, AND THEY NEED DIFFERENT ANSWERS ────────
         NOT READY YET (`AbortError`, because `load()` was called a moment
         ago): try again when the element says it can play. One listener,
         removed when it fires.

         NOT ALLOWED (`NotAllowedError`): the browser will not autoplay audio
         without a gesture. That is policy, not a bug — and leaving a dead
         frame because of it is the worst possible reading of it. A person who
         turned sound on gets sound on the next clip they touch; THIS clip
         plays MUTED rather than not at all, which is what every video feed
         does and what the founder's *"autoplay"* actually means.

         A press IS a gesture, so a `gesture` call never silently mutes: if
         somebody asked for sound and pressed play, the refusal is real and
         the control stays honest about it. */
      var name = (err && err.name) || '';
      if (name === 'NotAllowedError' && !gesture && !v.muted) {
        v.muted = true;
        var q = null;
        try { q = v.play(); } catch (_) {}
        if (q && q.catch) q.catch(function () {});
        return;
      }
      var once = function () {
        v.removeEventListener('canplay', once);
        try { var r = v.play(); if (r && r.catch) r.catch(function () {}); } catch (_) {}
      };
      v.addEventListener('canplay', once, { once: true });
    });
  }

  /* SOUND IS ONE DECISION, NOT ONE PER VIDEO. Unmuting the third clip and
     having the fourth arrive silent is the thing every video feed gets wrong;
     the choice belongs to the person and it travels with them. */
  var soundOn = false;
  try { soundOn = global.localStorage.getItem('ow_feed_sound') === '1'; } catch (_) {}

  function setSound(on) {
    soundOn = !!on;
    try { global.localStorage.setItem('ow_feed_sound', soundOn ? '1' : '0'); } catch (_) {}
    mediaPool.vids.forEach(function (v) { if (v) v.muted = !soundOn; });
    doc.querySelectorAll('[data-ow-sound]').forEach(function (b) {
      b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      b.setAttribute('aria-label', soundOn ? 'Mute' : 'Unmute');
      b.innerHTML = OW.glyph ? OW.glyph(soundOn ? 'sound' : 'muted') : (soundOn ? '&#9835;' : '&#9834;');
    });
  }

  /* ── THE CONTROLS FOR ONE POSITION ──────────────────────────────────────
     Built once per position and reused: `mount` is called on every index
     change, and rebuilding the chrome each time would throw away the very
     element the person may be pressing. */
  function mount(posEl, v, pos) {
    if (!posEl || !v) return;
    var bar = posEl.querySelector('.ow-vctl');
    if (!bar) {
      bar = doc.createElement('div');
      bar.className = 'ow-vctl';
      bar.innerHTML =
        '<button type="button" class="ow-vctl__sound" data-ow-sound '
        + 'aria-label="Unmute" aria-pressed="false"></button>'
        + '<div class="ow-vctl__line"><i></i></div>'
        + '<button type="button" class="ow-vctl__play" aria-label="Play" hidden></button>';
      posEl.appendChild(bar);
      /* PAINT IT ONCE IT EXISTS. `setSound` is what draws the glyph, and it
         was only ever called on a press — so the control shipped empty until
         somebody pressed the empty thing. */
      setSound(soundOn);

      bar.querySelector('[data-ow-sound]').addEventListener('click', function (e) {
        e.stopPropagation();
        setSound(!soundOn);
        /* UNMUTING IS A GESTURE, so it is also the moment a browser will let a
           paused-by-policy video start. */
        if (soundOn) play(v, true);
      });

      /* THE FRAME IS THE PLAY/PAUSE TARGET. Not a button drawn over the video —
         the founder's *"large INTERACTIONS, not buttons"* applies here more
         than anywhere, because the interaction is the whole screen. The rail
         and the author row stop the press so they keep their own meaning. */
      posEl.addEventListener('click', function (e) {
        if (e.target.closest('.po-acts, .po-card__who, .ow-vctl, [data-po-respond],'
                             + ' [data-po-repost], [data-po-save], [data-po-share], [data-po-who]')) return;
        var cur = posEl.querySelector('video.po-card__vid');
        if (!cur) return;
        if (cur.paused) { play(cur, true); } else { try { cur.pause(); } catch (_) {} }
      });
    }
    var line = bar.querySelector('.ow-vctl__line > i');
    var playBtn = bar.querySelector('.ow-vctl__play');

    if (v.__owWired !== posEl) {
      v.__owWired = posEl;
      /* PROGRESS IS PAINTED FROM `timeupdate`, which fires a few times a
         second — not from an animation frame, which would run sixty times a
         second to move a line by a pixel. */
      v.addEventListener('timeupdate', function () {
        var host = v.__owWired;
        if (!host) return;
        var l = host.querySelector('.ow-vctl__line > i');
        if (!l || !v.duration) return;
        l.style.width = Math.max(0, Math.min(100, (v.currentTime / v.duration) * 100)) + '%';
      });
      var paint = function () {
        var host = v.__owWired;
        if (!host) return;
        var b = host.querySelector('.ow-vctl__play');
        if (b) b.hidden = !v.paused;
        host.setAttribute('data-playing', v.paused ? '0' : '1');
      };
      v.addEventListener('play', paint);
      v.addEventListener('pause', paint);
      /* GRACEFUL FAILURE. A dead source must not leave a black rectangle with
         no explanation — the position says so and stops pretending to play. */
      v.addEventListener('error', function () {
        var host = v.__owWired;
        if (host) host.setAttribute('data-media-failed', '1');
      });
    }
    if (playBtn) {
      playBtn.innerHTML = OW.glyph ? OW.glyph('play') : '&#9654;';
      playBtn.onclick = function (e) { e.stopPropagation(); play(v, true); };
      playBtn.hidden = !v.paused;
    }
    if (line && v.duration) {
      line.style.width = ((v.currentTime / v.duration) * 100) + '%';
    }
    v.muted = !soundOn;
    /* REPLAY. `loop` is set on every pooled player, so a clip that ends starts
       again — which is what a feed does. `currentTime` is reset when a person
       comes BACK to a position they had left part-way through, because
       resuming a video somebody scrolled away from mid-sentence is worse than
       starting it again. */
    if (pos && pos.__owLeft) { try { v.currentTime = 0; } catch (_) {} pos.__owLeft = false; }
  }

  /* ── THE PERSON'S DISPLAY PREFERENCES, APPLIED (founder/556) ───────────
     Settings › Content and Accessibility offered four switches that nothing
     read. They are applied here — at boot from /api/me/settings and again the
     moment one changes — as facts on the document the whole App can follow:
       autoplay_media   video in Scroll waits for a tap when off
       data_saver       no autoplay and nothing fetched ahead
       high_contrast    stronger secondary ink and edges (never the galaxy)
       larger_text      the content column enlarged, the way browser zoom does
     `reduce_motion` keeps its own attribute, which it has had since it was
     written. */
  OW.applyPrefs = function (s) {
    s = s || {};
    OW.prefs = { autoplay: s.autoplay_media !== false, dataSaver: !!s.data_saver };
    var root = doc.documentElement;
    if (s.high_contrast) root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast');
    if (s.larger_text) root.setAttribute('data-text', 'large'); else root.removeAttribute('data-text');
    if (s.data_saver) root.setAttribute('data-saver', '1'); else root.removeAttribute('data-saver');
  };

  OW.media = {
    /* ── PREPARE THE POSITION THE PERSON IS ON, AND THE TWO AFTER IT ────────
       Called by the immersive viewer's pager on every index change — including
       the ones the NATIVE scroller made, which is why this takes an index
       rather than watching the DOM itself. There is no observer here and no
       scroll listener: the viewer already knows where it is.

       AUTOPLAY IS OFF EXCEPT FOR THE ONE THING BEING LOOKED AT (the Engagement
       Laws). The active media position plays, muted; everything else gives its
       player back immediately. */
    prepare: function (positions, i) {
      if (!positions || !positions.length) return 0;
      var cur = positions[i] || null;

      mediaPool.vids.forEach(function (v) {
        if (!v.parentElement) return;
        if (cur && cur.el && cur.el.contains(v)) return;
        /* SCROLLED AWAY: pause immediately and give the player back. The
           position remembers it was left, so coming back starts the clip
           again rather than resuming it mid-sentence. */
        try { v.pause(); } catch (_) {}
        var owner = v.__owWired;
        if (owner) { owner.removeAttribute('data-playing'); }
        v.__owWired = null;
        v.parentElement.removeChild(v);
      });
      (positions || []).forEach(function (p, k) {
        if (p && p.kind === 'media' && k !== i && p.el) p.__owLeft = true;
      });

      if (cur && cur.kind === 'media' && cur.el) {
        var f = (cur.items[0] && cur.items[0].face) || {};
        var host = cur.el.querySelector('.po-card');
        if (f.video && host) {
          var src = imageUrl(f.video);
          var v = takePlayer(src);
          if (v.parentElement !== host) host.appendChild(v);
          /* ── PLAY, AND KEEP TRYING UNTIL IT ACTUALLY DOES ────────────────
             `play()` rejects with AbortError when it is called while the
             element is still loading — which is exactly when this runs, since
             `takePlayer` may have just called `load()`. The rejection was
             swallowed, so the first video of a session sat on frame zero
             looking like a still. Measured on localhost: `readyState 4,
             paused: true`, and pressing play by hand worked immediately.

             So a refusal is retried once the element says it can play. Bounded
             to one listener, removed when it fires, and never a loop. */
          /* PLAY VIDEO AUTOMATICALLY / DATA SAVER (founder/556): with either
             one off-for-autoplay the clip waits on its frame with the play
             mark, and a tap starts it — the same tap that pauses it. */
          var pr = OW.prefs || {};
          if (pr.autoplay !== false && !pr.dataSaver) play(v);
          mount(cur.el, v, cur);
        }
      }

      /* DATA SAVER: the next two are not fetched ahead — preloading is where
         a feed spends a person's data plan, not on what they are watching */
      if (!(OW.prefs && OW.prefs.dataSaver)) {
        warmPos(positions[i + 1]);
        warmPos(positions[i + 2]);
      }
      mediaPool.active = i;
      return 1;
    },

    /* Give everything back. Called on leaving the viewer, so players never
       accumulate across surfaces. */
    release: function () {
      mediaPool.vids.forEach(function (v) {
        try { v.pause(); } catch (_) {}
        v.removeAttribute('src');
        try { v.load(); } catch (_) {}
        if (v.parentElement) v.parentElement.removeChild(v);
      });
      mediaPool.active = -1;
    },

    /* for the proving ground — what the pool is actually holding */
    state: function () {
      return { players: mediaPool.vids.length, active: mediaPool.active,
               holding: mediaPool.vids.map(function (v) {
                 return { src: v.getAttribute('src') || '', mounted: !!v.parentElement };
               }) };
    }
  };

  /* ══ SEND TO — ONE SHEET, EVERY SURFACE THAT CAN SEND ═══════════════════
     ★ FOUNDER, 2026-09-07: *"they can seamlessly send things to their friends
       through messages. There's basically no friction."*

     THE BACKEND WAS FINISHED AND THE COMPOSER HAD NEVER CALLED IT.
     `/api/oneway/sharing/destinations` ranks where a thing could go and returns
     the REASON for each; `/api/oneway/sharing/to-conversation` sends it as a
     REFERENCE, so an edit reaches every conversation it was shared into and a
     deleted post reports itself unavailable rather than showing words its
     author removed. Both shipped. The single-Post page used them. The camera —
     the one surface where sending to a friend is the whole point — offered
     "your profile" and "a place you belong to" and nothing else.

     So this is lifted OUT of app/posts/posts.js verbatim rather than written
     again. Two send sheets would drift, and the one that drifts is the one
     nobody is looking at: a person would learn the sheet on a Post and meet a
     different one after taking a photograph.

     THE REASONS ARE RENDERED AS THE RUNTIME WROTE THEM. Rewriting `why` here
     would be this surface inventing a justification for a ranking it did not
     compute — the route's own docstring asks for exactly that restraint.

     `opts.onSent` lets a caller say what happens next: the Post page stays
     put, the composer moves on. */
  OW.sendTo = function (panel, opts) {
    opts = opts || {};
    var kind = opts.subject_type || 'post';
    var id = opts.subject_id || '';
    panel.innerHTML = '';
    if (!id) {
      panel.appendChild(mk('p', 'po-acts__wait',
        'There is nothing to send yet.'));
      return Promise.resolve(0);
    }
    panel.appendChild(mk('span', 'po-acts__wait', 'Reading…'));
    return data.get('/api/oneway/sharing/destinations?subject_type='
                    + encodeURIComponent(kind) + '&subject_id='
                    + encodeURIComponent(id) + '&limit=12', { fresh: true })
      .then(function (r) {
        panel.innerHTML = '';
        if (!r.ok) {
          panel.appendChild(mk('p', 'po-acts__wait',
            'Could not read where this could go.'));
          return 0;
        }
        var dests = ((r.data || {}).destinations || []).filter(function (d) {
          /* THE PEOPLE FIRST, AND ONLY THE PEOPLE WHEN A CALLER ASKS. The
             ranking includes "Copy link" and "Share via…", which are the right
             answer on a Post page and noise directly after a photograph —
             there the question is WHO, not HOW. */
          return !opts.peopleOnly || (d.kind !== 'link' && d.kind !== 'external');
        });
        if (!dests.length) {
          /* AN HONEST ABSENCE, NAMED. A person with no open conversations has
             nowhere to send this yet, and saying so beats an empty panel that
             reads as a failure. */
          panel.appendChild(mk('p', 'po-acts__wait',
            'Nowhere to send this yet — start a conversation and it will show '
            + 'up here.'));
          return 0;
        }
        /* ── TWO PEOPLE WITH ONE NAME ────────────────────────────────────
           ★ MEASURED 2026-09-09, walking the send flow: the picker offered
           `pal327375@ow.test` and `mate549770@ow.test` as two rows both reading
           "Sam Vale", with nothing else on either. Two different human beings,
           identical rows, and this is the sheet where somebody chooses who
           receives a private photograph.

           Duplicate names are ordinary — there are many Sam Vales — so this is
           not a fixture problem that goes away in production; production is
           where it starts to matter.

           DISAMBIGUATED ONLY WHEN AMBIGUOUS. Putting a handle under every row
           would make the common case noisier to fix a case that usually is not
           there. So the labels are counted first, and only a name that appears
           more than once earns the second line that tells them apart. */
        var seenLabel = {};
        dests.forEach(function (d) {
          var k = (d.label || '').trim().toLowerCase();
          if (k) seenLabel[k] = (seenLabel[k] || 0) + 1;
        });
        dests.forEach(function (d) {
          var b = mk('button', 'ow-sendto__d'); b.type = 'button';
          b.appendChild(mk('span', 'ow-sendto__who', esc(d.label || d.id)));
          var lk = (d.label || '').trim().toLowerCase();
          if (lk && seenLabel[lk] > 1 && d.id && d.id !== d.label) {
            /* THE TAIL THAT TELLS TWO APART, shaped by what the id is. For a
               person it is their handle — the thing that is actually theirs
               alone. For a conversation or a Center the id is
               "conv:conv_9de33b16c5ff" / "center:047fcbb50531", and this
               printed it whole: MEASURED on Send to… with nineteen Centers of
               one name, a raw id after every one. Those get the same short
               tail the composer's destination chips wear — the head of the
               id, the string a person has seen in the address bar. */
            var idS = String(d.id), tail;
            if (idS.charAt(0) === '@') tail = idS;        /* a person's @handle, whole */
            else {
              var bare = idS.replace(/^[a-z]+:/, '').replace(/^(conv|post|center)_/, '');
              tail = bare.slice(0, 4);
            }
            b.appendChild(mk('span', 'ow-sendto__id', esc(tail)));
          }
          if (d.why) b.appendChild(mk('span', 'ow-sendto__why', esc(d.why)));
          if (d.available === false) {
            /* WHY it cannot go there, rather than a row that silently does
               nothing — the runtime answers this, and hiding it would make a
               blocked conversation look like a bug. */
            b.disabled = true;
            b.appendChild(mk('span', 'ow-sendto__no',
              esc(d.unavailable_reason || 'cannot be sent to')));
          }
          b.addEventListener('click', function () {
            Array.prototype.forEach.call(panel.children,
              function (x) { x.disabled = true; });
            b.querySelector('.ow-sendto__who').textContent = 'Sending…';
            data.post('/api/oneway/sharing/to-conversation', {
              conversation_id: d.conversation_id,
              subject_type: kind, subject_id: id
            }).then(function (rr) {
              if (!rr.ok) {
                panel.innerHTML = '';
                /* `data.post` flattens every refusal shape into a string, so
                   this no longer has to guess which one arrived. */
                panel.appendChild(mk('p', 'ow-sendto__failed',
                  esc('Not sent — ' + (rr.error || 'try again'))));
                return;
              }
              data.invalidate('/api/oneway/messaging');
              if (opts.onSent) { opts.onSent(d); return; }
              panel.innerHTML = '';
              panel.appendChild(mk('p', 'ow-sendto__ok',
                esc('Sent to ' + (d.label || 'them') + '.')));
              global.setTimeout(function () { panel.innerHTML = ''; }, 3500);
            });
          });
          panel.appendChild(b);
        });
        return dests.length;
      });
  };

  OW.word = function (v) {
    return ({ like: 'Like', dislike: 'Not for me', interested: 'Interested',
      attending: 'Going', approve: 'Approve', needs_changes: 'Needs changes',
      important: 'Important' })[v] || (String(v).charAt(0).toUpperCase() + String(v).slice(1));
  };

  /* WALKING INTO A PLACE — one listener, one path.
     A Popit can be opened from the map, a feed, a profile or a search, and any
     of them may offer the way in. Routing is the App shell's job (it owns the
     surface stack and the nav), so this announces and never navigates: the
     material knows no destinations, this layer knows no router, and the shell
     decides what "enter" means. The sheet folds away first, because the thing
     it was describing is about to become the whole surface. */
  doc.addEventListener('click', function (e) {
    var en = e.target.closest && e.target.closest('[data-po-enter]');
    if (!en) return;
    e.preventDefault();
    var id = en.getAttribute('data-po-enter');
    if (!id) return;
    OW.close();
    doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: id } }));
  });

  /* ── DOUBLE TAP TO LIKE, ON ANY KIND OF POST ─────────────────────────────
     ★ FOUNDER, 2026-08-29: *"people should be able to double tap any kind of
       post to like it."*

     ONE DELEGATED LISTENER, so it works on every projection at once — the
     standard feed, a Scroll group, a full-frame video or photo, and a Post
     opened over the feed. There is no per-surface copy to keep in step.

     IT ONLY EVER LIKES, NEVER UNLIKES. Every platform that has this treats the
     gesture as "yes" — a second double-tap on something you already like must
     not quietly take it back, because the gesture is a reflex and the undo
     would be invisible. Clearing a like is what the control is for.

     AND IT NEVER STEALS A REAL PRESS. A double tap that lands on a control, a
     link, the author or the media strip is left alone: those already mean
     something, and hijacking them would make the buttons unreliable — which is
     the defect this session already fixed once.

     THE TIMING IS THE PLATFORM'S, not a guess: two presses within 300ms and
     40px of each other is a double tap on every touch surface, and using
     `pointerdown` rather than `click` means it fires before any 300ms tap
     delay a mobile browser might add. */
  /* WHEN A DOUBLE TAP LAST HAPPENED. A surface that opens something on a tap
     checks this before acting — see `OW.openAfterTap`. */
  OW.tapGuard = 0;

  /* DEFER AN OPEN LONG ENOUGH TO KNOW IT WAS NOT A DOUBLE TAP.
     One place, so every surface that opens on a tap behaves identically and
     nobody has to remember the window. The delay is the double-tap window plus
     a frame — long enough to be sure, short enough that a real tap still feels
     immediate. */
  /* ── AND THE DELAY IS GONE, BECAUSE THE CONFLICT IS GONE ────────────────
     ★ FOUNDER, 2026-09-02, on how Instagram/TikTok/Facebook actually do this:
       *"Because single-tapping the video doesn't open the post anyway, no
       complex timing code is needed to block navigation."*

     MEASURED BEFORE THIS CHANGE: **635ms** from tap to a Post opening. Every
     single tap on every Post paid the full double-tap window plus a frame,
     because the open had to wait long enough to be sure a second tap was not
     coming. That is the timing-and-cancellation pattern, and it is the one
     platforms use only where they have no choice.

     THEY MOSTLY HAVE A CHOICE, AND SO DO WE. The two gestures were competing
     for the same pixels; segmenting the targets removes the competition
     instead of arbitrating it, and then NOTHING has to wait:

         media  — double tap LIKES. A single tap plays or pauses a video and
                  does nothing to a photo, so there is no navigation to hold.
         rest   — a single tap OPENS, immediately. No gesture is defined here,
                  so there is nothing to be sure about.

     WE HAD IT EXACTLY BACKWARDS. The old handler EXCLUDED the media strip from
     the like gesture and ran it on the card body — so a person double-tapped
     the words to like a photo, and the one region that opens the Post was the
     one region that had to wait.

     THIS FUNCTION STAYS, and it still holds, for any caller that genuinely has
     both gestures on one target. It is simply not on the Post-open path any
     more; `home.js` calls it only for a tap that landed in a like zone. */
  OW.openAfterTap = function (fn) {
    var at = (global.performance || Date).now();
    global.setTimeout(function () {
      if (OW.tapGuard > at - 40) return;      /* it was a double tap */
      fn();
    }, 320);
  };

  /* IS THIS TAP INSIDE THE LIKE ZONE — the one question both halves ask, so
     the gesture and the open can never disagree about where the boundary is.
     Two readers of one boundary is how the media strip came to be excluded
     from the gesture while still being treated as openable. */
  /* ── AND A TEXT POST HAS NO MEDIA TO DOUBLE-TAP. I BROKE THIS. ──────────
     ★ FOUNDER, 2026-09-02: *"i cannot double click to like atleast on localhost
       as i stated i needed working going back to the rules set."*

     ★ FOUNDER, 2026-08-29, the rule being returned to: *"double tap like needs
       to override the single tap popit open."*

     I moved the gesture onto the media because that is where Instagram puts it,
     and that half was right. What I did not check is that MOST POSTS ON THIS
     FEED HAVE NO MEDIA — measured on Home the same day: 20 cards, ZERO with a
     cover. So I moved the like gesture onto a region that does not exist on the
     majority of Posts, and double-tap-to-like stopped working at all. A correct
     rule applied to the wrong population is still a regression.

     THE HONEST RESOLUTION IS THE FOUNDER'S OWN RESEARCH, READ PROPERLY.
     Platforms segment targets WHERE THEY CAN and fall back to timing where they
     cannot — *"no complex timing code is needed"* describes the media case, not
     every case. A text Post is precisely the case where the two gestures do
     compete for the same pixels, and there the 2026-08-29 rule decides it: the
     like wins, so the open waits.

         a Post WITH media   → the media is the like zone. Tapping it does not
                               open, so nothing waits. Everywhere else opens
                               instantly.
         a Post WITHOUT media → the BODY is the like zone, and the open goes
                               through `openAfterTap`. It costs the double-tap
                               window on text Posts only — which is the price of
                               having both gestures on one target, and it is the
                               price the founder's rule chooses.

     `hasMedia` is asked of the RENDERED CARD, never of the payload. This file
     already records why: the row and the renderer disagree about what counts as
     media, and the rendered card is what the finger lands on. */
  OW.likeZone = function (target) {
    if (!target || !target.closest) return null;
    /* things that already mean something keep meaning it — a control, a link,
       the author chip, and the carousel's pagination dots (swiping a carousel
       is a different gesture from tapping it, so the photos themselves stay) */
    if (target.closest('.po-shots__dots, .po-act, .ow-vctl, [data-po-respond], '
                       + '[data-po-repost], [data-po-save], [data-po-share], [data-po-who], '
                       + '[data-po-center], a, input, textarea')) return null;

    var media = target.closest('.po-card__media, .po-card__cover, .po-shots');
    if (media) return media;

    var card = target.closest('.po-card[data-po-id]');
    if (!card) return null;
    /* NO MEDIA ON THIS CARD → THE CARD IS THE ZONE. */
    if (card.querySelector('.po-card__cover, .po-card__media, .po-shots')) return null;
    return card;
  };

  /* DOES THIS LIKE ZONE ALSO OPEN? Only the text-Post case does, and only it
     pays the wait. One function so the gesture and the open cannot disagree
     about which case they are in — the same reason `likeZone` is shared. */
  OW.likeZoneOpens = function (zone) {
    return !!(zone && zone.classList && zone.classList.contains('po-card'));
  };

  (function () {
    var DOUBLE_MS = 300, DOUBLE_PX = 40;
    var last = { t: 0, x: 0, y: 0, card: null };

    function bloom(x, y, hue) {
      var n = doc.createElement('div');
      n.className = 'ow-bloom';
      if (hue) n.style.setProperty('--h', hue);
      n.style.left = x + 'px';
      n.style.top = y + 'px';
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="M12 21s-7.5-4.9-7.5-10.2A4.8 4.8 0 0 1 12 7.3a4.8 4.8 0 0 1 '
        + '7.5 3.5C19.5 16.1 12 21 12 21z"/></svg>';
      doc.body.appendChild(n);
      var gone = function () { if (n.parentNode) n.parentNode.removeChild(n); };
      n.addEventListener('animationend', gone, { once: true });
      global.setTimeout(gone, 900);
    }

    doc.addEventListener('pointerdown', function (e) {
      var card = e.target.closest && e.target.closest('.po-card[data-po-id]');
      if (!card) { last.card = null; return; }
      /* ── THE GESTURE LIVES ON THE MEDIA, WHICH IS WHERE PEOPLE REACH FOR IT.
         This used to exclude `.po-shots` and the media entirely and run the
         like on the card BODY — the exact inverse of every platform the
         founder named. One boundary function now answers for both halves. */
      if (!OW.likeZone(e.target)) { last.card = null; return; }
      var now = (global.performance || Date).now();
      var near = Math.abs(e.clientX - last.x) < DOUBLE_PX
              && Math.abs(e.clientY - last.y) < DOUBLE_PX;
      if (last.card === card && near && (now - last.t) < DOUBLE_MS) {
        last.card = null; last.t = 0;
        /* ── THE DOUBLE TAP WINS ─────────────────────────────────────────
           ★ FOUNDER, 2026-08-29: *"double tap like needs to override the
             single tap popit open."*
           The first tap of a double tap is indistinguishable from a single one
           until the second arrives, so the OPEN has to wait — `OW.tapGuard`
           is how it knows to give up. Stamped before the like fires, so the
           pending open is already cancelled by the time anything else runs. */
        OW.tapGuard = now;
        var like = card.querySelector('[data-po-respond="like"]');
        if (!like) return;
        /* THE BLOOM SHOWS EITHER WAY — a double tap on something already liked
           is not an error and should not feel like one; it simply does not
           change the state. */
        bloom(e.clientX, e.clientY, card.style.getPropertyValue('--h'));
        if (like.getAttribute('aria-pressed') === 'true') return;
        e.preventDefault();
        like.click();
        return;
      }
      last.card = card; last.t = now; last.x = e.clientX; last.y = e.clientY;
    }, true);
  })();

  /* one listener for every feed interaction on the surface */
  doc.addEventListener('click', function (e) {
    /* ── A TAP ON A VIDEO PLAYS IT ──────────────────────────────────────
       ★ FOUNDER/482: cards *"clean to interact with and accurate when
         clicked anywhere."*
       The media is the like zone and never opens (the segmented-target
       rule above). In Scroll the position's own handler plays and pauses
       the pooled player. In the Feed a video card is its cover's own
       `<video>` — a still frame — and a tap on it did NOTHING: measured
       2026-09-21 on Home at 290, `paused: true, currentTime: 0` before and
       after the press. So the tap does what a tap on a video means: play
       it, muted and inline, or pause it. It waits out the double-tap
       window the way the open does, so a double tap likes without
       flicking the clip. Scroll is excluded — its player is not this
       element. */
    var cv = e.target.closest('.po-card__cover, .po-shot');
    if (cv && doc.documentElement.getAttribute('data-ow-view') !== 'immersive'
        && !e.target.closest('.po-act, .ow-vctl, [data-po-respond]')) {
      var cvid = cv.querySelector('video');
      if (cvid) {
        e.preventDefault(); e.stopPropagation();
        OW.openAfterTap(function () {
          if (!cvid.isConnected) return;
          if (cvid.paused) {
            cvid.muted = true; cvid.loop = true; cvid.playsInline = true;
            play(cvid, true);
          } else {
            try { cvid.pause(); } catch (_) {}
          }
        });
        return;
      }
    }
    var r = e.target.closest('[data-po-respond]');
    if (r) {
      e.preventDefault(); e.stopPropagation();
      var verb = r.getAttribute('data-po-respond'), id = r.getAttribute('data-obj');
      /* one answer per person per object: choosing another clears the first,
         so the sibling controls are turned off here to match what the store
         will do rather than letting the UI show two answers at once */
      var sibs = [];
      Array.prototype.forEach.call(r.parentNode.querySelectorAll('[data-po-respond]'), function (b) {
        if (b !== r) {
          sibs.push([b, b.getAttribute('aria-pressed'), b.getAttribute('data-act')]);
          b.setAttribute('aria-pressed', 'false'); b.setAttribute('data-act', 'off');
        }
      });
      /* the control says what it is answering; `gallery` remains the default
         so every existing caller behaves exactly as before */
      var okind = r.getAttribute('data-okind') || 'post';
      var pr = OW.act(r, { path: '/api/objects/' + encodeURIComponent(okind) + '/' + id + '/respond',
        /* the DESIRED state, not a flip — so a retry after a dropped reply
           cannot undo the press (see OW.act) */
        body: function (on) { return { type: verb, on: on }; },
        invalidate: FEED_READS });
      /* A REFUSED ANSWER PUTS THE OTHER ONE BACK. OW.act restores the pressed
         control; the sibling it cleared (the heart, when "Not for me" was
         refused) was left dark while the server still held the like
         (founder/502 sweep). */
      if (pr && pr.then) pr.then(function (res) {
        if (res && !res.ok && !res.queued) sibs.forEach(function (x) {
          x[0].setAttribute('aria-pressed', x[1] || 'false');
          x[0].setAttribute('data-act', x[2] || 'off');
        });
      });
      return;
    }
    /* ── COMMENT OPENS THE POST ────────────────────────────────────────────
       ★ FOUNDER, 2026-08-30: *"comments are still gone."*

       Not a response and not an act with a tally to flip — pressing it takes
       you to the conversation, which is a SURFACE. The Post viewer already
       owns that surface and already renders the thread, the pinned three and
       the composer, so this reaches the same place a tap on the card does.
       Building a second thread here would be a second implementation of the
       one conversation a Post has.

       IT MUST STOP THE EVENT. Without `stopPropagation` the card's own open
       handler also fires and the Post opens twice — the double-advance shape
       the pager already refuses by name. */
    /* ── WHO LIKED THIS ───────────────────────────────────────────────────
       ★ FOUNDER/488: *"put the like by under the bio and make it clickable
         with lists."*
       The "Liked by …" line is a control now; this is what it reaches. The
       people pane draws it (`OW.live.people` with a `likers:` id), because it
       is a list of people and there is one of those. */
    var lk = e.target.closest('[data-po-likers]');
    if (lk) {
      e.preventDefault(); e.stopPropagation();
      var lid = lk.getAttribute('data-obj');
      if (lid && OW.project && OW.project.open) OW.project.open('people', 'likers:' + lid, lk);
      return;
    }
    var cm = e.target.closest('[data-po-comment]');
    if (cm) {
      e.preventDefault(); e.stopPropagation();
      var cid = cm.getAttribute('data-obj');
      /* `openPost` is the App's own route for a Post, declared in
         oneway-app.html and already the destination of a tap on a card. Read
         from the running page rather than assumed: my first attempt called
         `OW.live.openPost`, which does not exist, and would have made the
         control silently do nothing — the same shape as the missing control
         it replaces. */
      /* ALREADY ON THIS POST, the box is right here: go to it. Reopening the
         Post to focus a field rebuilt the whole page under the person's thumb
         (founder/502's crawl found the press doing nothing it could see). */
      var here = cid && doc.querySelector('[data-ow-comment-box="' + String(cid).replace(/"/g, '') + '"]');
      if (here) {
        try { here.scrollIntoView({ block: 'center', behavior: 'smooth' }); here.focus({ preventScroll: true }); }
        catch (_) { try { here.focus(); } catch (__) {} }
        return;
      }
      if (cid && typeof global.openPost === 'function') {
        global.openPost(cid, undefined, { focusComment: true });
      }
      return;
    }

    /* REPOST — its own act. Not a response (it is not an opinion) and not a
       save (it is public and counted). The tally beside it is the server's
       answer, so an optimistic press updates the number and a refusal puts it
       back — a count that lies is worse than a count that waits. */
    var rp = e.target.closest('[data-po-repost]');
    if (rp) {
      e.preventDefault(); e.stopPropagation();
      var rid = rp.getAttribute('data-obj');
      /* A POST IS NOT A GALLERY, AND THIS SAID IT WAS. `respond` was taught to
         read the kind off the control; repost and save were left hardcoded to
         `gallery`, so every Repost and every Save on a POST was addressed to
         the gallery store. Measured 2026-08-25 against a real feed row:
             POST /api/objects/gallery/post_caesars_54368/repost
             -> 404 {"detail":"no such gallery here"}
         Not "unmigrated" — BROKEN, and broken silently, because the control
         reverted and the person just saw a press that did nothing (Rule 12: do
         not make actions dead). The kind travels ON the control exactly as it
         does for `respond`; `gallery` stays the default so every existing
         gallery caller behaves precisely as before. */
      var rkind = rp.getAttribute('data-okind') || 'post';
      var robj = '/api/objects/' + encodeURIComponent(rkind) + '/' + rid;
      var wasOn = rp.getAttribute('aria-pressed') === 'true';
      var tally = rp.querySelector('b');
      var had = tally ? (parseInt(tally.textContent, 10) || 0) : 0;
      /* ── A PRESS MUST NOT CREATE A NUMBER SOMEBODY CHOSE TO HIDE ────────
         ★ FOUNDER, 2026-09-06: *"UNLESS USER HAS CHOSEN TO HIDE ON EITHER
           SIDE UNDERSTAND?"*
         The server removes the tallies and the card renders none; this handler
         then CREATES a `<b>` from the server's reply, so hiding would have
         lasted exactly until the viewer's first tap on their own screen. The
         act still happens and still counts — it is the DISPLAY that was
         chosen against. */
      var hidden = !!rp.closest('[data-counts-hidden]');
      OW.act(rp, {
        path: robj + '/repost',
        undoPath: robj + '/repost?undo=true',
        invalidate: FEED_READS,
        after: function (res, on) {
          /* the server returns the real tally — show THAT, never our guess */
          if (hidden) return;
          /* ZERO IS SHOWN, like every other tally (founder/488) — see the
             `tally` helper in oneway-popit.js and `paint` in
             oneway-realtime.js. Undoing the last repost shows 0, it does not
             make the number disappear. */
          var n = Math.max(0, (res && res.data && typeof res.data.reposts === 'number')
                    ? res.data.reposts : (had + (on ? 1 : -1)));
          if (!tally) { tally = doc.createElement('b'); rp.appendChild(tally); }
          tally.textContent = String(n);
        }
      });
      return;
    }

    var sv = e.target.closest('[data-po-save]');
    if (sv) {
      e.preventDefault(); e.stopPropagation();
      /* SAME DEFECT, SAME FIX — see the repost block above. */
      var skind = sv.getAttribute('data-okind') || 'post';
      OW.act(sv, { path: '/api/objects/' + encodeURIComponent(skind) + '/'
                       + sv.getAttribute('data-obj') + '/save',
        labels: { on: 'Saved', off: 'Save' }, invalidate: FEED_READS });
    }
    /* SHARE (founder/471) — the send-to interface, inline under the card */
    var sh = e.target.closest('[data-po-share]');
    if (sh) {
      e.preventDefault(); e.stopPropagation();
      var card = sh.closest('.po-card') || sh.parentNode;
      var panel = card.querySelector('.ow-sendto[data-for-share]');
      if (panel) { panel.parentNode.removeChild(panel); sh.setAttribute('aria-expanded', 'false'); return; }
      panel = doc.createElement('div'); panel.className = 'ow-sendto'; panel.setAttribute('data-for-share', '1');
      panel.addEventListener('click', function (ev) { ev.stopPropagation(); });
      card.appendChild(panel);
      sh.setAttribute('aria-expanded', 'true');
      if (OW.sendTo) OW.sendTo(panel, { subject_type: sh.getAttribute('data-okind') || 'post', subject_id: sh.getAttribute('data-obj') });
      else panel.appendChild(mk('p', 'po-acts__wait', 'Sending is not available on this page just now.'));
    }
  }, true);

  /* 4.2 — PROFILE (My Center). Rewritten against the real payload, which
     turned out to carry more than the first pass used:
       · user.style.accent_hue — THE VIEWED PERSON'S OWN HUE. Feed actors are
         all issued the platform default, but a profile knows its person's hue,
         so their widgets can wear it.
       · rings — the Gallery rings EXPERIENCE.md describes, each with a cover
         and a real media count.

     TWO RULES REAL DATA FORCED, both about not lying with numbers:
       · A ZERO IS NOT EXPRESSION. "Followers 0" is a scoreboard reading nil,
         and putting it on someone's profile says something about them that
         they did not choose to say. Counts appear only when there is something
         to count.
       · A COUNT BELONGS TO THE THING IT COUNTS. The first pass labelled the
         total number of galleries onto ONE gallery ("5 public" beside a
         gallery holding 3 items), which is simply false. */
  /* 4.2a — THE PROFILE SHELL. The familiar shape (founder, 2026-07-30: "think
     twitter/reddit profiles layout with bars people can click on replacing the
     entire lower subsection of the page") — banner, avatar over it, identity,
     then a row of BARS whose selection replaces everything below.

     Familiar chrome, ONEWAY underneath: each panel's contents are still Popits,
     and the CSS this builds against (§15) was written for exactly this markup.

     A panel is rendered ON DEMAND and then kept. Rendering all of them up front
     would fetch reality nobody asked to see, which is the cost law; re-rendering
     on every visit would throw away a scroll position a person just set. */
  /* 4.2a-bis — SETTING YOUR OWN NOTE.

     Founder, 2026-08-17: a note is *"a thing that appears above a profile
     picture basically everywhere where they would display it."* A note nobody
     can write is a rendering exercise, so this is the field — and it lives in
     the note's OWN position, above the person's own face, rather than buried in
     Settings. You change it where you see it.

     WHAT IT REFUSES TO DO. It does not offer a length it cannot keep: the
     runtime caps at 60 characters and CUTS rather than refusing, so a client
     that let a person type 200 would silently lose 140 of their words and show
     them a note they did not write. The counter is the truth of that cap, read
     FROM the runtime (`max_chars`) rather than hardcoded here — two numbers for
     one rule is how they drift apart.

     CLEARING IS NOT AN EMPTY NOTE. Sending "" would be a note that says
     nothing; `DELETE` is the absence the badge field is built on, and it is the
     same distinction the runtime draws between `nobody` and a blank string. */
  function noteComposer(idRow, avatarEl, existing) {
    var caps = { max_chars: 60 };
    var btn = mk('button', 'ow-note-set');
    btn.type = 'button';
    var relabel = function (note) {
      var t = note && note.text ? String(note.text) : '';
      btn.textContent = t || 'Leave a note';
      /* when a note EXISTS the badge is already drawn by `OW.noteOn`, so the
         button must not draw a second copy of the same words on top of it —
         it becomes the affordance to CHANGE the one that is showing */
      btn.style.display = note && note.text ? 'none' : '';
    };
    relabel(existing);

    /* the note badge is the click target once one exists — tapping your own
       note edits it, which is the gesture people already expect */
    var badge = null;
    var openEditor = function () {
      if (idRow.querySelector('.ow-note-edit')) return;
      badge = idRow.querySelector('.po-note');
      if (badge) badge.style.visibility = 'hidden';
      btn.style.display = 'none';

      var box = mk('div', 'ow-note-edit');
      var inp = doc.createElement('input');
      inp.type = 'text'; inp.placeholder = 'Say something';
      inp.maxLength = caps.max_chars;
      inp.value = (existing && existing.text) || '';
      var count = mk('small', '', String(caps.max_chars - inp.value.length));
      var save = mk('button', '', 'Set');
      var clear = mk('button', '', 'Clear');
      clear.setAttribute('data-act', 'clear');
      save.type = clear.type = 'button';
      box.appendChild(inp); box.appendChild(count);
      box.appendChild(save); box.appendChild(clear);
      idRow.appendChild(box);
      inp.focus(); inp.select();

      inp.addEventListener('input', function () {
        /* clamped at zero: `maxLength` stops a person typing past the cap, but
           a value set any other way can, and "-20" characters remaining is a
           number that means nothing to anybody */
        count.textContent = String(Math.max(0, caps.max_chars - inp.value.length));
      });

      var close = function () {
        box.remove();
        if (badge) badge.style.visibility = '';
        relabel(existing);
      };
      var redraw = function (note) {
        existing = note;
        if (badge) { badge.remove(); badge = null; }
        if (note && note.text) OW.noteOn(avatarEl, note);
        close();
        /* THE NOTE IS ON OTHER SURFACES TOO, AND THEY ARE CACHED. Skipping
           this is the "a write nobody reads" defect one layer up: the note is
           saved, the runtime is right, and the person's own feed keeps showing
           yesterday's badge until a reload. Every read that carries a note is
           dropped, so the next paint of any of them is true. */
        ['/api/oneway/people/', '/api/oneway/social/feed', '/api/conversations', '/api/oneway/map',
         '/api/oneway/people/me/note'].forEach(function (k) { data.invalidate(k); });
      };

      save.addEventListener('click', function () {
        var text = inp.value.trim();
        if (!text) { close(); return; }
        save.disabled = true;
        data.post('/api/oneway/people/me/note', { text: text }, { method: 'PUT' })
          .then(function (r) {
            /* A NOTE THAT DID NOT SAVE IS NOT DRAWN AS IF IT DID — this fell
               back to what was typed on any failure, so the badge showed a
               note nobody else could see (founder/502 sweep). The editor stays
               open with the words in it, and the reason is said. */
            if (!r || !r.ok) {
              save.disabled = false;
              if (OW.toast) OW.toast('Your note did not save. ' + ((r && r.error) || 'Try again.'));
              return;
            }
            /* the RUNTIME's version of the note is what everyone else will
               see — it collapsed the whitespace and cut it to the cap — so the
               badge is redrawn from the response, never from what was typed */
            redraw((r.data && r.data.note) || { text: text });
          })
          .catch(function () { save.disabled = false; });
      });
      clear.addEventListener('click', function () {
        clear.disabled = true;
        data.post('/api/oneway/people/me/note', null, { method: 'DELETE' })
          .then(function (r) {
            if (!r || !r.ok) {
              clear.disabled = false;
              if (OW.toast) OW.toast('Your note is still up. ' + ((r && r.error) || 'Try again.'));
              return;
            }
            redraw(null);
          })
          .catch(function () { clear.disabled = false; });
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); save.click(); }
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
    };

    btn.addEventListener('click', openEditor);
    idRow.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.po-note')) openEditor();
    });
    idRow.appendChild(btn);

    /* the cap comes from the runtime, and the composer works before it answers
       — an editor that waits on a GET to become usable is a slower editor for
       no gain, since 60 is only ever tightened, never loosened */
    data.get('/api/oneway/people/me/note').then(function (r) {
      if (r && r.ok && r.data && r.data.max_chars) {
        caps.max_chars = r.data.max_chars;
        var live = idRow.querySelector('.ow-note-edit input');
        if (live) live.maxLength = caps.max_chars;
      }
    }).catch(function () {});
  }

/* ═══ A PROFILE IS WHAT THIS PERSON HAS, IN THEIR ORDER ═════════════
   ★ FOUNDER, 2026-08-26: *"I'd rather icons than text be people's
     profiles makeup. It should go Main, their home with popits and
     stickers, then posts, then links, then reposts, then favorites, then
     their private videos (if they have these things only)."*

   TWO CHANGES, AND THE SECOND MATTERS MORE. Icons instead of words is
   the visible one. The real one is CONDITIONALITY: the strip carried
   World, Story and Memories for everybody, so most people got five tabs
   where four opened onto nothing. A tab is a promise that something is
   behind it, and an empty one is the same lie as a dead button.

   Every tab below is present only when the runtime says that person has
   the thing. `Main` and `Home` are unconditional — Main is who they are,
   and Home is theirs to arrange even when it is still empty.

   PRIVATE VIDEOS ARE NOT HERE, deliberately. The founder listed them,
   and no canonical read reports whether a person has any — inventing the
   tab would mean inventing the condition. It appears the moment there is
   an endpoint that answers it. */
var TAB_ICON = {
  main:      '<circle cx="12" cy="9" r="3.4"/><path d="M5.5 19.2a6.8 6.8 0 0 1 13 0"/>',
  /* ★ FOUNDER, 2026-08-26: *"I like the icon with the four squares you
     use better than the photo icon you use for post. So swap that out."*
     The grid goes to POSTS. Home then needs its own mark rather than
     inheriting the one that just left — so it becomes a Popit ON a
     surface: one tile lifted off a plane, which is what a Home actually
     is and what no other tab here looks like. */
  home:      '<path d="M3.4 17.6l8.6 3.4 8.6-3.4"/>'
           + '<rect x="7.4" y="3.2" width="9.2" height="9.2" rx="2.8"/>'
           + '<path d="M3.4 13.8l8.6 3.4 8.6-3.4"/>',
  posts:     '<rect x="3.6" y="3.6" width="7" height="7" rx="2.2"/>'
           + '<rect x="13.4" y="3.6" width="7" height="7" rx="2.2"/>'
           + '<rect x="3.6" y="13.4" width="7" height="7" rx="2.2"/>'
           + '<rect x="13.4" y="13.4" width="7" height="7" rx="2.2"/>',
  links:     '<path d="M10.5 13.5a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 1 0-5.1-5.1l-1 1"/>'
           + '<path d="M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 1 0 5.1 5.1l1-1"/>',
  /* THE CLOSED LOOP, not two loose arrows. The first pass drew two
     separate strokes that read as "back and forward" — navigation, not
     re-sharing. A repost is a circuit: it goes out and comes back
     round, which is the shape every platform has settled on because it
     is the shape of the act. */
  reposts:   '<path d="M6.2 7.2h8.6a3.4 3.4 0 0 1 3.4 3.4v2.2"/>'
           + '<path d="M9.2 4.2 6 7.2l3.2 3"/>'
           + '<path d="M17.8 16.8H9.2a3.4 3.4 0 0 1-3.4-3.4v-2.2"/>'
           + '<path d="M14.8 19.8 18 16.8l-3.2-3"/>',
  favorites: '<path d="M12 4.8l2.3 4.7 5.2.8-3.7 3.6.9 5.1-4.7-2.4-4.7 2.4.9-5.1-3.7-3.6 5.2-.8z"/>'
};
function iconTab(id, label, render, n) {
  return { id: id, label: label, icon: TAB_ICON[id] || '', n: n || 0, render: render };
}

  /* ── A NAME, SET IN THE FACE ITS OWNER CHOSE ──────────────────────────
     ★ FOUNDER, 2026-09-10: *"i want to also supoort custom wordmarks on
       peoples profiles and posts like apple music now does."*

     THE WORDS COME FROM THE NAME, ALWAYS. A wordmark is a treatment, not a
     second name and not an image — so this takes the name the surface was
     already going to render and only changes the FACE. There is nothing a
     person can put here that is not their own name.

     THE STACK COMES FROM THE SERVER, RESOLVED. `person.wordmark` arrives as
     {key, label, stack, weight}, so no surface joins a key against a
     catalogue — a failed join would set somebody's name in the wrong face,
     and every surface would have to do it.

     SILENT WHEN THERE IS NOTHING TO SAY. No wordmark, or the default one, and
     the element is left exactly as it was: the platform's own face, which is
     what a person who has chosen nothing should see. */
  function wearWordmark(el, wm) {
    if (!el || !wm || !wm.stack) return el;
    if (wm.key && wm.key !== 'default') {
      el.classList.add('ow-wm');
      el.style.setProperty('--wm', wm.stack);
      if (wm.weight) el.style.setProperty('--wm-w', String(wm.weight));
    }
    return el;
  }

  function profileShell(host, o) {
    o = o || {};
    host.className = ''; host.innerHTML = '';
    var root = mk('div', 'ow-prof');
    /* NO hue.scope HERE, deliberately. Both callers already set the SURFACE
       hue via hue.context — this whole page IS that identity's world. Scoping
       it again pinned --ow-h1 onto this subtree, so when a person picked a new
       colour the tween moved the document and the profile underneath it did
       not: the choice appeared to do nothing until reload. One identity, one
       place that decides its light. (A REFERENCED identity inside the page —
       a Center on a shelf — is still scoped per widget; that is the other
       layer and it stays.) */

    /* the banner: their picture if they have one, their own light if not —
       never a stock image chosen for them (Law 15 reaches appearance too) */
    var ban = mk('div', 'ow-banner');
    var bannerSrc = imageUrl(o.banner);
    if (bannerSrc) {
      var im = doc.createElement('img');
      im.src = bannerSrc; im.alt = ''; im.loading = 'eager'; im.decoding = 'async';
      ban.appendChild(im);
      ban.appendChild(mk('span', 'ow-banner__hue'));
    }
    ban.appendChild(mk('span', 'ow-banner__shade'));
    root.appendChild(ban);

    var id = mk('div', 'ow-prof__id');
    var av = mk('div', 'ow-avatar');
    if (o.avatarShape) av.setAttribute('data-shape', o.avatarShape);
    /* A LOGO IS NOT ALWAYS A FILE. Some Centers store a single glyph as their
       mark, which is a real choice they made — running it through the URL
       validator refuses it and falls back to initials, quietly replacing their
       identity with ours. So: a URL renders as an image, a short glyph renders
       as itself, and only genuine absence falls back to initials. */
    var rawLogo = String(o.logo == null ? '' : o.logo).trim();
    var logoSrc = imageUrl(rawLogo);
    if (logoSrc) {
      var lg = doc.createElement('img'); lg.src = logoSrc; lg.alt = ''; av.appendChild(lg);
    } else if (rawLogo && rawLogo.length <= 8 && !/[\/:.]/.test(rawLogo)) {
      av.textContent = rawLogo;                       /* their mark, as given */
    } else if (o.kind === 'person' && OW.faceMark) {
      /* ★ FOUNDER/495: a person with no picture is the outline of a person.
         This header is shared with Centers, which keep their monogram; the
         2026-09-26 sweep found every person's page (and a new account's own)
         still drawing initials here. */
      av.innerHTML = OW.faceMark();
    } else {
      av.textContent = OW.initials ? OW.initials(o.name || '') : (o.name || '?').charAt(0);
    }
    id.appendChild(av);
    /* THE NOTE SITS ON THE FACE (founder, 2026-08-17: *"a note is like a thing
       that appears above a profile picture basically everywhere where they
       would display it"*). `OW.noteOn` is the same implementation the feed card
       uses through `OW.noteHTML` — one note, two entry points, never a second
       design that drifts from the first. On the person's own profile the note
       and the field that writes it occupy the SAME position, because reading
       your note and changing it should not be two different places. */
    if (o.note) OW.noteOn(av, o.note);
    if (o.noteMine) noteComposer(id, av, o.note);
    id.appendChild(wearWordmark(mk('h1', 'ow-prof__name', esc(o.name || '')), o.wordmark));
    if (o.sub) id.appendChild(mk('p', 'ow-prof__handle', esc(o.sub)));

    /* ── WHAT A PERSON SAYS ABOUT THEMSELVES ──────────────────────────────
       ★ FOUNDER, 2026-09-06: *"PROFILE SHOULD BE PERFECT AND SO SHOULD USER
         DEPTH OF GOOGLE ACCOUNT AND FACEBOOK."*

       A canonical profile held a name and a note. Four things a person could
       be, against the eleven claims Google returns for the same human — and
       this shell had nowhere to put a bio even if one existed.

       IT SITS UNDER THE NAME AND ABOVE THE STATS, deliberately: their own
       sentence outranks a count of their followers. A person who has written
       nothing gets NOTHING here — no placeholder, no "no bio yet" — because an
       empty profile is a legitimate thing to be and a page must not nag. */
    if (o.bio) id.appendChild(mk('p', 'ow-prof__bio', esc(o.bio)));
    /* THE ONE LINK BAR (founder/442) — under the sentence, above the counts */
    if (o.links) id.appendChild(o.links);

    /* THE SMALL FACTS — where they are, where else they are. Each is drawn
       only when it is KNOWN; absent stays absent rather than becoming a row
       with a dash in it. A website is the one fact that is also a door, so it
       is the only one that is a link, and the scheme is checked before it
       becomes an href: a profile field is text a stranger typed, and
       `javascript:` is a URL. */
    var facts = (o.facts || []).filter(function (f) { return f && f.value; });
    if (facts.length) {
      var fr = mk('div', 'ow-prof__facts');
      facts.forEach(function (f) {
        var href = f.href && /^https?:\/\//i.test(f.href) ? f.href : '';
        var one;
        if (href) {
          one = doc.createElement('a');
          one.className = 'ow-prof__fact ow-prof__fact--link';
          one.href = href; one.target = '_blank'; one.rel = 'noopener noreferrer';
        } else {
          one = mk('span', 'ow-prof__fact');
        }
        one.innerHTML = '<span>' + esc(f.value) + '</span>';
        fr.appendChild(one);
      });
      id.appendChild(fr);
    }
    /* WHAT IS HAPPENING HERE — a live line the CALLER composes, because only the
       caller knows what "live" means for its kind. A Center says what is coming
       up; a person has no equivalent and passes nothing, which is why this is a
       node rather than a string field: absent is the common case and it must
       cost nothing. */
    if (o.live) id.appendChild(o.live);

    /* A ZERO IS NOT EXPRESSION — the same rule the widgets follow. Counts are
       passed in already filtered; nothing here invents one. */
    if ((o.stats || []).length) {
      var st = mk('div', 'ow-prof__stats');
      o.stats.forEach(function (s) {
        /* ★ FOUNDER/472: a count of followers or following is a DOOR to the
           list, as it is on every platform a person has used — it was plain
           text here. Pressing one opens the list over the page. */
        var key = s[2] || (/^follow/.test(String(s[1])) ? (String(s[1]).indexOf('following') === 0 ? 'following' : 'followers') : '');
        var opens = (key === 'following' || key === 'followers') && o.email;
        var one = mk(opens ? 'button' : 'span', 'ow-prof__stat',
          '<b>' + esc(s[0]) + '</b>' + esc(s[1]));
        /* AN OPTIONAL THIRD ELEMENT NAMES THE STAT, so an action can correct it
           without re-rendering the whole profile. Rendering is unchanged when
           it is absent. */
        if (key) one.setAttribute('data-stat', key);
        if (opens) {
          one.type = 'button';
          one.addEventListener('click', function () {
            if (OW.project && OW.project.open) OW.project.open('people', key + ':' + o.email, one);
          });
        }
        st.appendChild(one);
      });
      id.appendChild(st);
    }
    if (o.acts) id.appendChild(o.acts);
    root.appendChild(id);

    /* the bars */
    /* PUBLIC FIRST, THEN THE PERSON'S OWN — a STABLE partition, so each group
       keeps the order its caller declared. Without this the boundary is not a
       boundary: `Memories` is public and was declared after three owner-only
       tabs, so a single separator would have landed mid-row with public tabs on
       both sides of it, which is worse than no separator at all. */
    /* A HIDDEN TAB STILL EXISTS, IT JUST HAS NO CHIP. `Understanding` moved
       into the person's Menu and is opened from there; its renderer must stay
       reachable by id, so it is filtered out of the STRIP rather than deleted
       from the list. Filtering here — the one place the strip is built — is
       what makes the flag real; set on a tab and honoured nowhere, it would
       have been a no-op that read as a change. */
    var tabs = (o.tabs || []).filter(Boolean);
    /* ── THE STRIP IS WHAT THIS PERSON IS; THE GEAR IS HOW THEY RUN IT ─────
       ★ FOUNDER, 2026-08-26: *"make a settings gear in the upper right, no
         yours on the profile categories."*

       The strip carried both — Profile, World, Posts, Story, Memories AND
       Understanding, Appearance, Your activity, Settings — separated by a
       little "yours" divider that existed to explain why two unlike things
       were in one row. The divider was the tell: a row that needs a label
       explaining its own contents is two rows. Administration moves behind a
       gear, which is where every platform puts it and where a person already
       looks, and the strip goes back to being views of a person. */
    var strip = tabs.filter(function (t) { return !t.hidden && !t.own; });
    var bar = mk('div', 'ow-tabs'); bar.setAttribute('role', 'tablist');
    var panel = mk('div', 'ow-panel');
    var built = {}, active = null;

    /* ── A PANE THAT WAS RIGHT WHEN IT WAS BUILT ─────────────────────────────
       Panes are rendered once and kept — deliberately, so returning to a tab
       does not re-fetch reality nobody asked for and does not throw away a
       scroll position the person just set.

       **But a kept pane is a SNAPSHOT, and something can make it false.**
       Choose your widgets under Appearance, tap Profile, and the old set is
       still there: the pane was correct when it was built and the world moved
       underneath it. The person changed the one setting whose entire purpose is
       to change that pane, and the surface showed them their previous answer.

       So a caller can say the snapshot is stale. Only the ACTIVE pane is rebuilt
       immediately; the rest are dropped and rebuilt when next opened, because
       re-rendering a tab nobody is looking at spends a fetch on nothing. */
    function forget() {
      var was = active;
      built = {}; active = null;
      var t = (tabs.filter(function (x) { return x.id === was; })[0]) || strip[0];
      if (t) show(t);
    }
    doc.addEventListener('ow:profile-changed', forget);

    /* ── A SECTION CAN SEND YOU TO THE TAB THAT HOLDS THE REST ───────────
       ★ FOUNDER/429: things must *"feel like real pages"*. A real page shows
       three of what it has and links to all of them; that link needs a way to
       say "open the Events tab" from inside another pane. Published on the
       host rather than passed down, because the panes are built by callers
       that do not know the strip exists. */
    host.__owShowTab = function (id) {
      var t = tabs.filter(function (x) { return x.id === id; })[0];
      if (t) show(t);
    };

    function show(t) {
      /* the tab you are on takes you to the top of what it shows — never a
         press that does nothing (founder/502) */
      if (active === t.id) {
        try { bar.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {}
        return;
      }
      active = t.id;
      Array.prototype.forEach.call(bar.children, function (b) {
        b.setAttribute('aria-selected', b.dataset.t === t.id ? 'true' : 'false');
      });
      panel.innerHTML = '';
      var pane = built[t.id];
      if (!pane) {
        pane = built[t.id] = mk('div');
        panel.appendChild(pane);
        try { t.render(pane); } catch (e) {
          pane.classList.add('po-grid');
          stateTile(pane, 'refused', 'Not shown', 'This did not render.', '4x1');
        }
        return;
      }
      panel.appendChild(pane);
    }

    /* ── TWO JOBS, NOT NINE PEERS ────────────────────────────────────────
       Founder, 2026-08-17: *"right now on a person's profile this is not
       cutting it and is not intuitive."*

       My Center carried NINE tabs in one flat strip — Profile · World ·
       Galleries · Story · Understanding · Appearance · Your activity ·
       Memories · Settings — needing ~940px on a screen that gives 375. But the
       width was the symptom. **The strip mixed two different jobs and gave the
       person no way to tell them apart:** five of those tabs are what the WORLD
       SEES on your profile, and four are controls only YOU ever touch. A
       visitor's view and an owner's console, interleaved, in one undifferentiated
       row.

       That is why "what does my profile actually look like to someone else" had
       no answer on the screen whose entire job is to answer it.

       So a tab may declare `own: true`, and the strip SEPARATES at the boundary
       rather than reordering into a second control. One row still, one gesture
       still — the fade that earns its way in by measurement still works because
       it measures the same element — but the eye is told where the person's own
       side begins. Nothing is hidden and nothing moves out of reach; the only
       change is that the row stops pretending Settings and Galleries are the
       same kind of thing. */
    strip.forEach(function (t) {
      /* ICONS CARRY THE STRIP; the word is the accessible name and the
         tooltip. A tab that has no icon keeps its word, so nothing that has
         not been drawn yet silently disappears. */
      var b = mk('button', 'ow-tab', t.icon
        ? ('<svg viewBox="0 0 24 24" aria-hidden="true">' + t.icon + '</svg>'
           + (t.n ? '<span class="ow-tab__n">' + esc(t.n) + '</span>' : ''))
        : (esc(t.label) + (t.n ? '<span class="ow-tab__n">' + esc(t.n) + '</span>' : '')));
      b.type = 'button'; b.dataset.t = t.id; b.setAttribute('role', 'tab');
      if (t.icon) { b.setAttribute('aria-label', t.label); b.setAttribute('title', t.label);
                    b.setAttribute('data-icon', 'true'); }
      if (t.own) b.setAttribute('data-own', 'true');
      b.addEventListener('click', function () { show(t); });
      bar.appendChild(b);
    });
    /* THE GEAR, UPPER RIGHT. Only when this surface actually has a menu —
       somebody else's profile has no settings to open, and a gear that opens
       nothing is worse than no gear. */
    if (typeof o.menu === 'function') {
      /* ── A MARK, NOT A BUTTON ───────────────────────────────────────────
         ★ FOUNDER, 2026-08-26: *"the button shouldn't look ai generated nor
           have that border around it."*

         It had a plate: a tinted rounded rectangle with a 1.5px hue ring
         around a stock twelve-tooth cog. Two faults in one control — a
         CONTAINER where the surface already provides one (the header sits on
         the banner; a chip on top of it is a second surface for no reason),
         and the most generic possible glyph inside it.

         So the plate is gone entirely and the mark is drawn for this platform:
         three concentric arcs with a single break, which reads as adjustment —
         a dial, not a machine part — and matches the thin-stroke geometry the
         rest of the App is drawn in. Nothing behind it, nothing around it. */
      var gear = mk('button', 'ow-shell__gear'); gear.type = 'button';
      gear.setAttribute('aria-label', 'Settings and your account');
      gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="2.1"/>'
        + '<path d="M12 4.2a7.8 7.8 0 0 1 7.6 6.1"/>'
        + '<path d="M19.7 13.5A7.8 7.8 0 0 1 12 19.8"/>'
        + '<path d="M10.3 19.6A7.8 7.8 0 0 1 4.3 13"/>'
        + '<path d="M4.5 10.2A7.8 7.8 0 0 1 9.6 4.6"/>'
        + '<path d="M12 7.4v1.6M16.6 12h-1.6M12 16.6v-1.6M7.4 12h1.6"/>'
        + '</svg>';
      gear.addEventListener('click', function () {
        if (typeof o.onMenu === 'function') {
          o.onMenu(gear, function (id, label, render) {
            show({ id: id, label: label, render: render });
          });
          return;
        }
        show({ id: '__menu', label: 'Menu', render: o.menu });
      });
      root.appendChild(gear);
    }
    root.appendChild(bar);
    root.appendChild(panel);
    host.appendChild(root);
    /* ── OPEN ON A TAB THAT HAS SOMETHING IN IT ──────────────────────────
       ★ FOUNDER, 2026-09-09: *"Profiles and Centers still need professional
         design refinement"* and *"improve hierarchy, progressive disclosure,
         navigation, defaults, grouping"* — without removing capability.

       This opened `tabs[0]` unconditionally. For a Center that is always Main,
       and Main is the arranged canvas, which almost nobody has arranged. So the
       ordinary visit landed on the one empty tab and spent half the screen
       explaining the emptiness — measured on Harbour Lights: 0 posts, 0
       upcoming, a real Story and eight fields of About, and the first thing a
       visitor saw was a globe and "Main is unarranged".

       A DEFAULT IS NOT A REORDERING. The strip keeps its order, Main stays
       first and one tap away; only the tab that OPENS changes.

       AND IT ONLY SKIPS A TAB THAT SAYS IT IS EMPTY. `n === 0` or
       `has === false` is a tab declaring, from data it already holds, that
       there is nothing behind it. A tab that declares NOTHING is unknown, and
       unknown is never skipped — guessing a tab is empty and passing over it is
       how this surface would start lying about Centers that do have something. */
    var opening = tabs.filter(function (t) {
      if (t.hidden) return false;
      if (t.has === false) return false;
      if (typeof t.n === 'number' && t.n === 0 && t.has !== true) return false;
      return true;
    })[0] || tabs[0];
    /* A CALLER MAY NAME THE TAB THAT OPENS. ★ FOUNDER/459: a Center button
       on Home takes you to the Center's FEED — its Main, arrangement on top,
       posts under — whatever else the Center carries (a written site opens
       on its own Home when you arrive from elsewhere). The strip's order is
       untouched; only the tab that opens is the one asked for. */
    if (o.open) {
      var asked = tabs.filter(function (t) { return t.id === o.open && !t.hidden; })[0];
      if (asked) opening = asked;
    }
    if (tabs.length) show(opening);

    /* THE FADE IS EARNED BY MEASUREMENT, NOT ASSUMED BY A BREAKPOINT. Seven
       tabs need ~729px; a phone gives 375, so the last label was sliced through
       its letters at the screen edge and read as broken layout rather than as
       "there is more this way". The mask that fixes it must not sit over a row
       that already fits, so the class is set from the element's own scrollWidth
       — the only thing that actually knows. Re-checked on resize and on
       rotation, because a row that fits in landscape does not in portrait. */
    function fade() {
      if (!bar.isConnected) return;
      bar.classList.toggle('ow-tabs--more', bar.scrollWidth > bar.clientWidth + 2);
    }
    fade();
    /* after fonts settle: a label measured before its webfont loads is the
       wrong width, and this row is entirely text */
    global.setTimeout(fade, 400);
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(fade);
    global.addEventListener('resize', fade);
    bar.addEventListener('scroll', function () {
      /* once they have scrolled to the end there is nothing more to promise */
      bar.classList.toggle('ow-tabs--more',
        bar.scrollWidth - bar.clientWidth - bar.scrollLeft > 2);
    });
    return root;
  }

  /* 4.2b — A LIST OF FACTS, as bars. Value leads; the caption and HOW IT IS
     KNOWN sit beneath it. The audit line is not decoration — the Explainability
     Law means a fact that cannot say where it came from should not be presented
     as one, so it travels with the value rather than being available elsewhere. */
  /* ═══ A POST, AS THE MATERIAL DESCRIBES ONE ══════════════════════════════
     ONE MAPPING, TWO CALLERS. The feed and a profile both show posts, and both
     must open the SAME room — so the runtime row is translated into the `post`
     kind exactly once, here. Two translations would be two descriptions of one
     object, and the shipping example of what that costs is right below this:
     posts were rendered as `said` on profiles and as nothing at all in the
     feed, which is the same object described two wrong ways.

     Every field is read from what `/api/users/{email}` and `/api/me/feed`
     actually return — measured, not assumed. */
  /* "OTHER" IS NOT A CATEGORY, IT IS THE ABSENCE OF ONE — and printed as the
     first thing under a Center's name it is the zero-information filler the
     founder's law rejects outright. A Center that has not said what it is says
     where it is instead.

     ONE RULE, NOT TWO. I fixed this on the map Popit first and then found the
     Center surface saying "OTHER · 12 Harbour Parade" two inches away, from a
     different line of code — which is the duplication the founder named in the
     same breath as demos. Both read this now, so the next placeholder word
     added here is right everywhere at once. */
  var _EMPTY_CATEGORY = /^(other|others|uncategor(ised|ized)|none|n\/?a|unknown|misc(ellaneous)?|general|default)$/i;
  function realCategory(c) {
    var v = String(c == null ? '' : c).trim();
    return (!v || _EMPTY_CATEGORY.test(v)) ? '' : v;
  }

  /* ═══ PLATES — things you look AT, not rows you read ══════════════════════
     (founder, 2026-08-16: upcoming events "shouldn't be structured like that
     whatsoever. It should be way more creative. Let's have, like, photos. I
     want a lot more photos than you're thinking right now. Photos should
     naturally complement the Popits.")

     I had built what is on at a Center as a `<ul>` of title-and-date rows. That
     is a timetable. A gathering is a thing you look at and decide you want to
     be at, and the runtime was already carrying `cover_image_url` on every
     event while the App rendered the text beside it and dropped the picture.

     MEASURED FIRST, because it changes what this must do: in this environment
     every `cover_image_url` is EMPTY, the one gallery has 0 media, and the
     Center has no banner. The write paths exist (`/api/center/identity/assets`,
     `/api/galleries/{gid}/upload`, `cover_image_url` on event create) — nobody
     has used them yet. So a photo-led design that only works with photographs
     would render an empty surface today.

     §20.1 already answers this and it is the whole reason imagery is a
     LANGUAGE and not an asset: "'We have no photography' is not a blocker —
     treating imagery as an asset instead of a language is." The plate takes
     real material when it exists and otherwise becomes the tier-4
     environmental treatment derived from the place's OWN hue — never stock,
     never generated, never a grey box. The composition is identical either
     way, so the day a Center uploads its first photograph nothing has to be
     redesigned around it: the picture simply arrives.

     The seed makes each plate's light its own — same input, same plate, every
     reload (Gate 5), so a set reads as different places rather than one
     gradient repeated. */
  /* WHEN A THING HAPPENED — shared, and it very nearly left with Discovery.
     `whenWords` went out inside the Discovery block and `OW.live.messages` /
     `OW.live.thread` still called it, two files away. `node --check` cannot see
     that: a missing function is a ReferenceError at render, not a syntax error,
     and the browser check that "passed" had only ever opened Discovery.
     VERIFY THE SURFACE YOU BROKE, NOT THE ONE YOU CHANGED. */
  function whenWords(iso) {
    if (!iso) return '';
    var t = new Date(iso), now = new Date();
    if (isNaN(t)) return '';
    var mins = Math.round((now - t) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'm';
    if (t.toDateString() === now.toDateString()) {
      return t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    var y = new Date(now); y.setDate(y.getDate() - 1);
    if (t.toDateString() === y.toDateString()) return 'Yesterday';
    if ((now - t) < 6048e5) return t.toLocaleDateString([], { weekday: 'short' });
    return t.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  /* ── WHEN SOMETHING NEXT HAPPENS, WHICH IS NOT THE SAME QUESTION ──────
     `OW.when` and `whenWords` both answer "how long AGO", and both were
     written for that. Handed a FUTURE time they answer "just now" / "now",
     because the elapsed seconds go negative and fall through the first
     branch.

     MEASURED 2026-09-12 in the browser, on the real helpers:
         in 4 minutes -> "just now"
         in 3 hours   -> "just now"
         tomorrow     -> "just now"
         in 5 days    -> "just now"

     So a room next free NEXT WEEK would have read "next free just now" on a
     Center's Book tab. I very nearly shipped that: the first Center I tested
     happened to have a room free four minutes out, where the wrong answer and
     the right one look identical.

     THE TWO HELPERS ARE NOT CHANGED. They are correct for the question they
     were built for, one of them lives in another lane's file, and widening a
     past-tense formatter to also read forwards is how a helper ends up with
     two meanings and neither stated. This is the other question, named for
     what it answers.

     PAST OR NOW IS "now", DELIBERATELY. For availability that is the truth a
     person wants — a room whose slot opened a minute ago is free, not late. */
  function fromNowWords(iso) {
    if (!iso) return '';
    var t = new Date(iso), now = new Date();
    if (isNaN(t)) return '';
    var mins = Math.round((t - now) / 60000);
    if (mins <= 0) return 'now';
    if (mins < 60) return 'in ' + mins + 'm';
    var hhmm = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (t.toDateString() === now.toDateString()) return 'at ' + hhmm;
    var tm = new Date(now); tm.setDate(tm.getDate() + 1);
    if (t.toDateString() === tm.toDateString()) return 'tomorrow ' + hhmm;
    if ((t - now) < 6048e5) {
      return t.toLocaleDateString([], { weekday: 'short' }) + ' ' + hhmm;
    }
    return t.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  /* ── HOW FAR AWAY, IN NO ZONE AT ALL ────────────────────────────────────
     `fromNowWords` is right for a thing that happens where the READER is: it
     falls back to `toLocaleTimeString`, which is their clock, and their clock
     is the correct one for their own feed.

     A RESERVATION IS NOT THAT. It happens at a Center that may keep a
     different clock, and the doors that list them — `/mine`, and `next_free`
     on `/bookable` — carry no timezone at all. Formatting those with the
     reader's locale prints "Tue 7:00 PM" over a place where it is already
     Wednesday, and it looks entirely trustworthy, which is what makes it worth
     a separate function rather than a note.

     MEASURED 2026-09-13: the list said "Tue 7:00 PM" for a table booked at a
     Center whose zone the read never sent. Same instant, a clock that is only
     the reader's.

     So this says only HOW FAR AWAY, which is true in every zone on earth. The
     exact hour belongs to the OPENED booking, where `when.start_local` and
     `when.timezone` come from the Center's own clock and are shown with the
     zone named beside them. */
  /* A CALENDAR DATE IN WORDS, from Y-M-D and nothing else. The legacy event
     rows carry `date` ("2026-07-17") and `time` as the operator typed it
     ("7:00 PM", "18:00") — free text, which is why it is appended as written
     rather than parsed: `new Date("2026-07-17T7:00 PM")` is Invalid Date and
     a helper that tried it rendered nothing. The date is built from its parts
     so it cannot move a day in half the world. Unparseable stands as written.
     On OW because Discovery is a separate closure and draws the same rows. */
  OW.dayWords = function (date, time) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
    var day = m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined,
                { weekday: 'short', month: 'short', day: 'numeric' })
                : String(date || '');
    return [day, String(time || '').trim()].filter(Boolean).join(' \u00b7 ');
  };

  function awayWords(iso) {
    if (!iso) return '';
    var t = new Date(iso);
    if (isNaN(t)) return '';
    var ms = t - new Date(), past = ms < 0, mins = Math.round(Math.abs(ms) / 6e4);
    if (mins < 1) return 'now';
    var say;
    if (mins < 60) say = mins + 'm';
    else if (mins < 1440) say = Math.round(mins / 60) + 'h';
    else if (mins < 10080) { var d = Math.round(mins / 1440); say = d + (d === 1 ? ' day' : ' days'); }
    else { var w = Math.round(mins / 10080); say = w + (w === 1 ? ' week' : ' weeks'); }
    return past ? (say + ' ago') : ('in ' + say);
  }

  /* ══ BOOKING A THING, FROM THE CENTER ═══════════════════════════════════
     ★ THREE_LANES section 5, step 5 and step 7: a customer books from the App
       and from the web page.

     I SHIPPED THE LIST FIRST AND SAID SO. The Book tab named the things and
     when each was next free, and there was no control that booked anything. A
     list is not a booking and calling it one is the failure this project keeps
     naming, so it went out as a list with the gap stated on the channel.

     ── IT ASKS BEFORE IT COMMITS ─────────────────────────────────────────
     `GET .../availability` is checked on the chosen window BEFORE the book,
     so a refusal names its rule while the person can still change the answer.
     Booking blind and reporting a 400 afterwards is the same information
     delivered at the one moment it is useless.

     ── THE RULES ARE READ, NEVER ASSUMED ─────────────────────────────────
     Each bookable thing carries its own `rules`. `max_party_size` caps the
     input rather than being discovered by a refusal, and `approval_required`
     is said BEFORE the press — somebody who thinks they have a table and
     actually has a request is the worst version of this screen.

     ── THE HANDLE, NEVER THE ID ──────────────────────────────────────────
     B's handle law: the public doors take `place: po_<handle>`. The payload
     carries `kind_of_id: "handle"` and this passes exactly that through; an
     asset id would be refused, and quietly, because it looks like an id.

     NO MODAL — an inline panel under the row that was tapped (standing UI
     rules), and pressing the same row again closes it. */
  /* ══ THE INSTANT A DATE MEANS AT THE PLACE, NOT IN THE READER'S BROWSER ══
     A guest in London picking "20 October" for a room in Atlantic City meant
     15:00 BST — 10:00 in the morning at the hotel, five hours before check-in
     and, at either end of the day, occasionally the wrong night entirely. The
     stay is counted by the hotel's own calendar day (`stay_rules` reads
     `start[:10]`), so the App has to send the instant whose WALL CLOCK at the
     Center is the hour a hotel means. The composed read already carries
     `where.time.timezone`; nothing had ever used it to write. */
  function atZone(dayStr, hour, tz) {
    var guess = new Date(dayStr + 'T' + (hour < 10 ? '0' : '') + hour + ':00:00Z');
    if (isNaN(guess)) return null;
    if (!tz) return guess;
    try {
      var f = new global.Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var q = {};
      f.formatToParts(guess).forEach(function (x) { q[x.type] = x.value; });
      var asUTC = Date.UTC(+q.year, +q.month - 1, +q.day,
                           (+q.hour) % 24, +q.minute, +q.second);
      return new Date(guess.getTime() + (guess.getTime() - asUTC));
    } catch (e) { return guess; }            /* no Intl → the reader's clock */
  }
  function dayValue(d) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function bookingSheet(node, centerId, thing, book, clock) {
    if (!node || !thing) return;
    var open = node.parentNode && node.parentNode.querySelector('.ow-bk');
    if (open) {
      var forThis = open.getAttribute('data-for') === (thing.handle || thing.id);
      open.parentNode.removeChild(open);
      if (forThis) return;                    /* same row again = close */
    }
    var rules = thing.rules || {};
    var wrap = mk('div', 'ow-bk');
    wrap.setAttribute('data-for', thing.handle || thing.id || '');

    var head = mk('div', 'ow-bk__h', esc(thing.name || 'This place'));
    wrap.appendChild(head);
    if (rules.approval_required) {
      /* SAID BEFORE THE PRESS, not after it. */
      wrap.appendChild(mk('p', 'ow-bk__note',
        'This one is a request — the Center confirms it.'));
    }

    function field(label, el) {
      var f = mk('label', 'ow-bk__f');
      f.appendChild(mk('span', '', esc(label)));
      f.appendChild(el);
      return f;
    }
    /* THE DEFAULT IS THE THING'S OWN NEXT OPENING, because that is the answer
       to the question the person is already asking. Falling back to the next
       whole hour when nothing is known — never to \"now\", which is never
       bookable by the time they press. */
    var startAt = thing.next_free ? new Date(thing.next_free) : new Date();
    if (!thing.next_free || isNaN(startAt) || startAt < new Date()) {
      startAt = new Date(Date.now() + 36e5);
      startAt.setMinutes(0, 0, 0);
    }
    function localValue(d) {
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
             + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    /* ══ A ROOM IS NOT BOOKED BY THE HOUR ═══════════════════════════════
       This sheet asked every bookable thing the same two questions — a
       datetime and "1–4 hours" — and a hotel room was one of them. A guest
       could book the Ocean View King from 3pm to 4pm, the engine would take
       it, and the hotel's own minimum-stay and closed-to-arrival rules, which
       are counted in NIGHTS, were being asked about a stay of none.

       So a room asks the two questions a hotel asks: the night you arrive and
       how many nights. A table, a cabana and a ballroom keep the hours. */
    var isRoom = String(thing.kind || '').toLowerCase() === 'room';
    var tz = (clock && clock.timezone) || '';
    var when = doc.createElement('input');
    when.className = 'ow-bk__in';
    var hours = doc.createElement('select');
    hours.className = 'ow-bk__in';
    if (isRoom) {
      when.type = 'date';
      when.value = dayValue(startAt);
      when.min = dayValue(new Date());
      [1, 2, 3, 4, 5, 6, 7].forEach(function (n) {
        var o = doc.createElement('option');
        o.value = String(n); o.textContent = n + (n === 1 ? ' night' : ' nights');
        hours.appendChild(o);
      });
    } else {
      when.type = 'datetime-local';
      when.value = localValue(startAt);
      [1, 2, 3, 4].forEach(function (h) {
        var o = doc.createElement('option');
        o.value = String(h); o.textContent = h + (h === 1 ? ' hour' : ' hours');
        hours.appendChild(o);
      });
    }

    var party = doc.createElement('input');
    party.type = 'number'; party.className = 'ow-bk__in';
    party.min = '1'; party.value = '2';
    /* CAPPED BY THE THING'S OWN RULE, so the limit is visible rather than
       discovered by a refusal. `capacity` is the floor when no rule is set. */
    var cap = rules.max_party_size || thing.capacity || 0;
    if (cap) { party.max = String(cap); }

    wrap.appendChild(field(isRoom ? 'Arrive' : 'When', when));
    wrap.appendChild(field(isRoom ? 'How many nights' : 'How long', hours));
    wrap.appendChild(field((isRoom ? 'Guests' : 'How many')
                           + (cap ? (' (up to ' + cap + ')') : ''), party));
    /* THE HOUSE'S HOURS, SAID BEFORE THE PRESS AND IN THE HOUSE'S CLOCK. A
       stay written down as 3pm to 11am is the hotel's convention, not this
       reader's afternoon, and a person is owed the difference in writing when
       the two are not the same place. (B: `check_in_time`/`check_out_time`
       belong to the hotel System — until they do, this is the convention the
       industry keeps and the App says so rather than silently assuming it.) */
    if (isRoom) {
      wrap.appendChild(mk('p', 'ow-bk__note',
        'Arrive from 3pm, leave by 11am'
        + (tz ? (' — ' + esc(tz.split('/').pop().replace(/_/g, ' ')) + ' time') : '')
        + '.'));
    }

    var why = mk('p', 'ow-bk__why', '');
    var row = mk('div', 'ow-bk__row');
    var go = mk('button', 'po-act ow-bk__go',
                rules.approval_required ? 'Request it' : 'Book it');
    go.type = 'button';
    row.appendChild(go);
    wrap.appendChild(row);
    wrap.appendChild(why);

    go.addEventListener('click', function () {
      var startD, endD;
      if (isRoom) {
        var nights = parseInt(hours.value, 10) || 1;
        startD = atZone(when.value, 15, tz);
        if (!startD || isNaN(startD)) { why.textContent = 'Pick the night you arrive.'; return; }
        var out = new Date(when.value + 'T00:00:00Z');
        out.setUTCDate(out.getUTCDate() + nights);
        endD = atZone(out.toISOString().slice(0, 10), 11, tz);
      } else {
        startD = new Date(when.value);
        endD = startD && !isNaN(startD)
          ? new Date(startD.getTime() + (parseInt(hours.value, 10) || 1) * 36e5) : null;
      }
      if (!startD || isNaN(startD) || !endD || isNaN(endD)) {
        why.textContent = 'Pick a time first.'; return;
      }
      var n = parseInt(party.value, 10) || 1;
      if (cap && n > cap) {
        why.textContent = 'This one holds ' + cap + '.';
        return;
      }
      var startISO = startD.toISOString(), endISO = endD.toISOString();
      var place = thing.handle || thing.id || '';
      go.disabled = true;
      why.textContent = 'Checking…';
      var base = '/api/oneway/reservations/' + encodeURIComponent(centerId);
      data.get(base + '/availability?place=' + encodeURIComponent(place)
               + '&start=' + encodeURIComponent(startISO)
               + '&end=' + encodeURIComponent(endISO), { fresh: true })
        .then(function (av) {
          var a = (av && av.ok && av.data && av.data.availability) || null;
          if (a && a.free === false) {
            go.disabled = false;
            /* THE ENGINE'S OWN REASON, and the next opening when it knows one
               — a refusal that does not say when to come back instead is a
               dead end with extra steps. */
            /* THE ENGINE'S SENTENCE, PUNCTUATED HERE. It answers a bare
               clause — "already held then" — so the surface ends it and joins
               the next one with a single space. Two strings concatenated with
               their own leading spaces is how "already held then  Next free"
               reached the screen with a gap in it. */
            var said = sentence(a.why || 'That time is taken.');
            if (a.next_free) {
              said += ' Next free ' + awayWords(a.next_free) + '.';
            }
            why.textContent = said;
            return;
          }
          why.textContent = rules.approval_required ? 'Sending…' : 'Booking…';
          return data.post(base + '/book', {
            place: place, start: startISO, end: endISO, party_size: n
          }).then(function (r) {
            go.disabled = false;
            if (!r || !r.ok) {
              why.textContent = (r && r.error)
                || 'That could not be booked. Nothing has been reserved.';
              return;
            }
            var rec = (r.data && r.data.reservation) || {};
            wrap.innerHTML = '';
            wrap.appendChild(mk('div', 'ow-bk__h', esc(thing.name || 'Booked')));
            wrap.appendChild(mk('p', 'ow-bk__ok',
              (rec.status === 'confirmed' ? 'Booked · ' : 'Requested · ')
              + awayWords(rec.start || startISO)
              + (rec.party_size ? (' for ' + rec.party_size) : '')));
            /* AND IT JOINS THE LIST OF WHAT YOU HOLD. A receipt that vanishes
               on the next tap, leaving "Yours here" exactly as it was before
               the booking, reads as a booking that did not take. */
            var mine = wrap.parentNode && wrap.parentNode.querySelector('.ow-mine');
            if (mine && mine.__refresh) mine.__refresh();
          });
        })
        .catch(function () {
          go.disabled = false;
          why.textContent = 'That could not be checked just now. Nothing has been reserved.';
        });
    });

    if (node.parentNode) node.parentNode.insertBefore(wrap, node.nextSibling);
  }

  /* ══ THE BOOKINGS A PERSON ALREADY HAS ══════════════════════════════════
     ★ B -> A (07eed3d): the booking may now be opened and called off.

     THE LOOP HAD ONE HALF. A person could book a table and there was no screen
     in the App that admitted the booking existed afterwards — no way to check
     what they had held, and no way to let it go. A booking you cannot cancel
     is a worse promise than no booking, because the Center keeps holding a
     table nobody is coming to.

     ── THE LIST SAYS *WHEN* AND NEVER A CLOCK TIME ───────────────────────
     `/mine` carries `start` in UTC and NOTHING that says which clock the
     place keeps. Rendering that with the browser's own zone would print the
     reader's Tuesday evening over a Center that is five hours away, and it
     would look completely convincing. So the list says "in two days", which
     is true in every zone, and the exact hour waits for the opened booking —
     where `when.start_local` and `when.timezone` come from the Center's own
     clock and can be shown with the zone named beside them.

     ── AND NEVER AN ASSET ID ─────────────────────────────────────────────
     `/mine` rows name their thing by `asset_id` and carry no name. That is the
     one reservations door still echoing a raw id, so nothing here reads it:
     the row is identified by its time, and the THING is named by the opened
     booking, which answers a handle and a name. (Reported to B.)

     ── WHAT MAY BE DONE IS READ, NEVER GUESSED ───────────────────────────
     The Cancel control is drawn from `next.may_cancel`, which B reads out of
     the engine's own transition table. A surface that decides for itself which
     controls to draw eventually draws one the write then refuses, and the
     person finds out by pressing it. */
  function bookingWhen(iso) {
    /* THE WALL CLOCK OUT OF THE STRING, not out of a Date. `start_local` is
       already the Center's own wall time with its offset attached; handing it
       to `new Date` and formatting would convert it straight back into the
       reader's zone and undo the only reason the server sent it. */
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));   /* weekday only */
    var h = +m[4], ap = h >= 12 ? 'PM' : 'AM';
    return DAY[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MON[+m[2] - 1]
         + ', ' + (h % 12 || 12) + ':' + m[5] + ' ' + ap;
  }
  var BOOK_STATE = {
    confirmed: 'Booked', pending: 'Requested', requested: 'Requested',
    held: 'Held', cancelled: 'Cancelled', checked_in: 'Checked in',
    checked_out: 'Finished', no_show: 'Missed'
  };
  function bookingWord(st) {
    return BOOK_STATE[String(st || '').toLowerCase()] || (st ? String(st) : '');
  }
  /* ONE PAINTER FOR A ROW, used when the list is drawn and again when a
     booking is cancelled from the panel under it. Two pieces of code writing
     the same row is how a list ends up disagreeing with the thing it opened. */
  function paintBookingRow(row, rec) {
    var live = !/cancelled|no_show|checked_out/i.test(rec.status || '');
    row.setAttribute('data-live', live ? 'on' : 'off');
    row.querySelector('.ow-mine__when').textContent =
      live ? awayWords(rec.start) : bookingWord(rec.status);
    var sub = [];
    if (rec.party_size) sub.push('party of ' + rec.party_size);
    if (live) sub.push(bookingWord(rec.status));
    row.querySelector('.ow-mine__sub').textContent = sub.join(' · ');
  }

  function myBookings(pane, centerId) {
    var box = mk('div', 'ow-mine');
    pane.appendChild(box);
    function load() {
      box.innerHTML = '';
      data.get('/api/oneway/reservations/' + encodeURIComponent(centerId) + '/mine',
               { fresh: true })
        .then(function (r) {
          /* 401 IS NOT AN EMPTY LIST. Signed out, a person has no bookings to
             be shown and no gap to explain — the section simply is not part of
             their screen. Unreadable for any other reason is said, because a
             person who has a table here must never be told they have none. */
          if (!r || !r.ok) {
            if (r && r.status === 401) { box.remove(); return; }
            box.appendChild(mk('p', 'ow-bk__why',
              'Your bookings here could not be read just now.'));
            return;
          }
          var rows = (r.data && r.data.reservations) || [];
          if (!rows.length) { box.remove(); return; }
          rows.sort(function (a, b) {
            return String(a.start || '') < String(b.start || '') ? -1 : 1;
          });
          box.appendChild(mk('div', 'ow-mine__h', 'Yours here'));
          rows.forEach(function (rec) {
            var row = mk('button', 'ow-mine__row');
            row.type = 'button';
            row.appendChild(mk('span', 'ow-mine__when', ''));
            row.appendChild(mk('span', 'ow-mine__sub', ''));
            paintBookingRow(row, rec);
            row.addEventListener('click', function () { openBooking(row, centerId, rec.id); });
            box.appendChild(row);
          });
        })
        .catch(function () {
          box.innerHTML = '';
          box.appendChild(mk('p', 'ow-bk__why',
            'Your bookings here could not be read just now.'));
        });
    }
    box.__refresh = load;
    load();
    return box;
  }

  /* ONE OPENED BOOKING, under the row that was pressed. Same rule as the
     booking sheet: no modal, and pressing the same row again closes it. */
  function openBooking(node, centerId, id) {
    var open = node.parentNode && node.parentNode.querySelector('.ow-bk');
    if (open) {
      var forThis = open.getAttribute('data-for') === id;
      open.parentNode.removeChild(open);
      if (forThis) return;
    }
    var wrap = mk('div', 'ow-bk');
    wrap.setAttribute('data-for', id);
    wrap.appendChild(mk('p', 'ow-bk__why', 'Opening…'));
    node.parentNode.insertBefore(wrap, node.nextSibling);
    var base = '/api/oneway/reservations/' + encodeURIComponent(centerId)
             + '/booking/' + encodeURIComponent(id);

    function draw(b) {
      wrap.innerHTML = '';
      var thing = b.thing || {}, when = b.when || {}, next = b.next || {};
      wrap.appendChild(mk('div', 'ow-bk__h', esc(thing.name || 'Your booking')));
      var hour = bookingWhen(when.start_local || b.start);
      if (hour) {
        /* THE ZONE IS NAMED BESIDE THE HOUR. A time with no zone beside it is
           a time the reader will assume is theirs. */
        var zone = String(when.timezone || '').split('/').pop().replace(/_/g, ' ');
        wrap.appendChild(mk('p', 'ow-bk__note',
          esc(hour + (zone ? (' · ' + zone + ' time') : ''))));
      }
      var facts = [];
      if (b.party_size) facts.push('Party of ' + b.party_size);
      if (thing.capacity) facts.push('holds ' + thing.capacity);
      var word = bookingWord(b.status);
      if (word) facts.unshift(word);
      if (facts.length) wrap.appendChild(mk('p', 'ow-bk__ok', esc(facts.join(' · '))));
      var why = mk('p', 'ow-bk__why', '');
      if (next.may_cancel) {
        var row = mk('div', 'ow-bk__row');
        var off = mk('button', 'po-act', 'Cancel this booking');
        off.type = 'button';
        off.addEventListener('click', function () {
          off.disabled = true;
          why.textContent = 'Cancelling…';
          data.post(base + '/cancel', {})
            .then(function (c) {
              off.disabled = false;
              if (!c || !c.ok) {
                why.textContent = (c && c.error)
                  || 'That could not be cancelled. The booking still stands.';
                return;
              }
              /* THE DOOR ANSWERS THE WHOLE BOOKING BACK, so the panel redraws
                 from the server's own record rather than from an assumption
                 about what cancelling did. The list above it reloads for the
                 same reason. */
              /* THE PANEL AND THE ROW ABOVE IT, both from the returned
                 record. Reloading the whole list here would wipe the panel the
                 person is reading the outcome in — they would press Cancel and
                 watch the answer disappear. */
              draw(c.data || {});
              paintBookingRow(node, c.data || {});
            })
            .catch(function () {
              off.disabled = false;
              why.textContent = 'That could not be cancelled just now. The booking still stands.';
            });
        });
        row.appendChild(off);
        wrap.appendChild(row);
      }
      wrap.appendChild(why);
    }

    data.get(base, { fresh: true })
      .then(function (r) {
        if (!r || !r.ok) {
          wrap.innerHTML = '';
          wrap.appendChild(mk('p', 'ow-bk__why',
            esc((r && r.error) || 'That booking could not be opened.')));    /* mk writes HTML (lane B) */
          return;
        }
        draw(r.data || {});
      })
      .catch(function () {
        wrap.innerHTML = '';
        wrap.appendChild(mk('p', 'ow-bk__why', 'That booking could not be opened just now.'));
      });
  }

  function plate(it) {
    it = it || {};
    var img = imageUrl(it.cover || it.image || it.cover_image_url || '');
    var seed = 0, s = String(it.id || it.title || '');
    for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 360;
    return '<figure class="po-plate" data-v="' + (seed % 6) + '"'
      + ' style="--ang:' + seed + 'deg">'
      + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async"'
               + ' onerror="this.remove()">' : '')
      + (it.icon && OW.glyph(it.icon) ? '<span class="po-plate__ic">'
           + OW.glyph(it.icon) + '</span>' : '')
      + '<figcaption>'
      + (it.when ? '<span class="po-plate__when">' + esc(it.when) + '</span>' : '')
      + '<span class="po-plate__t">' + esc(it.title || '') + '</span>'
      + (it.sub ? '<span class="po-plate__s">' + esc(it.sub) + '</span>' : '')
      + '</figcaption></figure>';
  }
  function plateRow(items) {
    items = (items || []).filter(function (x) { return x && x.title; });
    if (!items.length) return '';
    return '<div class="po-plates">' + items.map(plate).join('') + '</div>';
  }

  function postData(po) {
    po = po || {};
    var m = (po.media || [])[0];
    var cover = m ? (m.url || m.src || (typeof m === 'string' ? m : '')) : '';
    /* the post wears the hue of WHERE IT WAS LIT (§17) — that is what makes a
       shelf of them read as one person reaching into several worlds */
    var placeHue = null;
    if (po.destination_hue != null) {
      var t = OW.hue.fromAngle(po.destination_hue);
      if (t) placeHue = { h1: t[0], h2: t[1] };
    }
    return {
      kind: 'post', id: po.id || '',
      label: po.title || '', title: po.title || '', body: po.body || '',
      cover: imageUrl(cover) || '',
      /* the room, only when the room is not the author — a post to a person's
         own Center carries `destination === center_id`, and a card reading
         "Walk Tester … in Walk Tester" names them twice (see OW.live.post) */
      place: (po.destination_name
              && String(po.destination || '') !== String(po.center_id || ''))
        ? po.destination_name : '',
      when: po.created_at ? OW.when(po.created_at) : '',
      counts: po.actions || {},
      hue: placeHue
    };
  }
  function postPayload(po) { return OW.widgetPayload(postData(po)); }

  /* ═══ A CENTER, OPENED OVER THE MAP ══════════════════════════════════════
     (founder, 2026-08-16: clicking a dot or searching "should feel like the
     Popit Center is opening like a hologram over the map, and it takes them in
     a GTA like animation over the location".)

     The flight was already built by the other sessions — `land()` flies, the
     globe leans, the flat map settles, and the world bends toward the place's
     own colour. The half that was missing is that it arrived at NOTHING: the
     camera stopped over a dot the person had already pressed.

     This is the arrival. It is the same projection every other Popit uses — the
     pane, the beam, the emitter left lit — so a Center met on the map is the
     same object as a Center met anywhere else, which is the One Reality rule
     at the surface layer rather than in the store.

     IT READS, IT DOES NOT INVENT. Everything below comes from the public
     experience read the Center surface already uses; a Center with a quiet
     window opens quietly. */
  /* ── AN AREA OF A CENTER, OPENED ───────────────────────────────────────
     The composed read's `explore` rows are the house as the operator
     describes it — The Lobby, The Gaming Floor, Qua Baths & Spa — each with
     a sentence and whatever events are on there. One that is a Center of its
     own opens as a Center (`openCenterPopit`); the rest open here, as the
     object they are. The pane draws only what the row carries: a name, its
     sentence, its events placed by their own date — an event whose day has
     passed under "What already happened", not "next" — and nothing else. */
  function openAreaPopit(area, originEl, huePair) {
    if (!area || !area.name || !OW.open) return false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var next = [], past = [];
    (area.events_here || []).forEach(function (v) {
      if (!v || !v.title) return;
      var row = { text: v.title, at: OW.dayWords(v.date, v.time), kind: 'event' };
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v.date || ''));
      var day = m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
      (day && day < today ? past : next).push(row);
    });
    var n = next.length + past.length;
    OW.open({
      kind: 'place', kind_label: 'Area', icon: 'place',
      label: area.name,
      glance: area.description || '',
      signal: n ? (n + (n === 1 ? ' event' : ' events')) : '',
      hue: huePair || null,
      time_forward: next,
      time_back: past
    }, originEl);
    return true;
  }

  function openCenterPopit(centerId, originEl, hueAngle) {
    if (!centerId) return Promise.resolve(false);
    /* ── A CENTER OPENS AS ITSELF, OVER THE GALAXY — NEVER AS A CARD ────────
       ★ FOUNDER/405 (2026-09-14): *"when I click Atlantic City, it shouldn't
         open to a card. It should just open to the center over the galaxy
         background."* And /396: one opening for the whole platform — the
         Popit grows to the screen like a hologram, the galaxy stays, the
         Center's information and hue arrive over it.
       So wherever the projection is loaded (the landing page, the App), a
       Center pressed from any Popit — a door on About, a tile on Discovery,
       a pin's arrival, a row in a list — projects the whole Center from that
       Popit. The sheet below stays only for a page that has not loaded the
       projection. */
    if (OW.project && OW.project.open) {
      return OW.project.open('center', centerId, originEl || null).then(function (ok) {
        if (ok) return true;
        return openCenterSheet(centerId, originEl, hueAngle);
      });
    }
    return openCenterSheet(centerId, originEl, hueAngle);
  }
  function openCenterSheet(centerId, originEl, hueAngle) {
    if (originEl) originEl.setAttribute('data-po-loading', '');
    /* THE COMPOSED READ, the same door the opened Center reads (B, 518d3b5:
       header and today are on /app, byte-identical to /experience). This was
       the last surface asking the legacy /experience door on its own, and it
       drew GALLERIES under a label saying "Posts" — a name retired by ruling
       over a family whose feed half is dead. It draws the Center's canonical
       Posts now, from the same answer. A 404 here is "not a Center"; the
       door is public, so a stranger meets the same room a member does. */
    return data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/app')
      .then(function (r) {
        if (originEl) originEl.removeAttribute('data-po-loading');
        if (!r.ok || !r.data || r.data.exists === false) {
          OW.say(originEl, r.status === 404 ? 'not a public Center' : (r.error || 'could not open'));
          return false;
        }
        var e = r.data;
        var head = e.header || {};
        /* the header carries category, location and introduction; the
           identity carries the one-line description — one object for the
           readers below, which were written against the legacy identity */
        var ident = Object.assign({}, head, {
          name: head.name || (e.identity || {}).name || e.name || '',
          description: (e.identity || {}).description || '' });
        var arr = { hue: (e.identity || {}).hue, banner: '', logo: '' };
        var hue = hueOf(arr) || hueOf(head) || null;
        if (!hue && hueAngle != null) {
          var t = OW.hue.fromAngle(hueAngle);
          if (t) hue = { h1: t[0], h2: t[1] };
        }

        var today = e.today || [], info = e.information || [];
        /* the Center's Posts, as the plates the galleries used to fill — a
           post's first picture is its cover, its title or first line its name */
        var gals = ((e.posts || {}).items || []).slice(0, 8).map(function (po) {
          var m = (po.media || [])[0] || {};
          return { id: po.id, title: po.title || String(po.body || '').split('\n')[0].slice(0, 60) || 'A post',
                   cover: (m.kind === 'image' || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(m.url || '')) ? m.url : '',
                   media_count: (po.media || []).length,
                   who: (po.author || {}).name || '' };
        });

        /* the face: what is ON here, as objects — a place is its activity, and
           a shelf of what is happening reads as a place in a way a paragraph
           never does. With nothing on, the Center's own light carries it. */
        /* ── THE FACE IS THE GLANCE. THE SHEET IS THE THING. ────────────────
           ★ FOUNDER, 2026-09-08: *"nothing in the app should have brief info
             when its popit is opened."*

           This row of marks is ORNAMENT on the header — it is not information
           and it is not the panel. It stays capped, because eight marks and
           forty marks say the same thing at a glance and forty is a smear.
           Everything BELOW, which is the opened Popit, no longer truncates. */
        var face = today.length
          ? '<div class="po-marks po-marks--room">' + today.slice(0, 8).map(function (t) {
              return '<i class="po-mark" title="' + esc(t.title || t.name || '') + '">'
                   + OW.glyph('event') + '</i>'; }).join('') + '</div>'
          : (gals.length
              ? '<div class="po-marks po-marks--room">' + gals.slice(0, 8).map(function (g) {
                  return '<i class="po-mark" title="' + esc(g.title || '') + '">'
                       + OW.glyph('camera') + '</i>'; }).join('') + '</div>'
              : '');

        var room = '';
        if (today.length) {
          /* WHAT IS ON HERE, AS THINGS YOU LOOK AT. A timetable tells you a
             gathering exists; a plate makes you want to be at it. Each carries
             its own cover when the Center has given one, and its own light
             when it has not. */
          /* ALL OF THEM. This was `.slice(0, 8)` and said nothing about the
             rest, so a Center with thirty things on looked like a Center with
             eight — a silent truncation is worse than a long list, because a
             long list is honest and a short one is a claim. The sheet is
             full-screen and scrolls; that is what it is for. */
          room += '<div><div class="po-sheet__label">On here</div>'
            + plateRow(today.map(function (t) {
                return { id: t.id, title: t.title || t.name || '',
                         cover: t.cover_image_url || '',
                         icon: 'event',
                         when: OW.dayWords(t.date, t.time),
                         sub: t.location || '' }; }))
            + '</div>';
        }
        /* ABOUT MUST NOT REPEAT THE HEADER. `information` carries the Center's
           name and address, and both are already worn on the pane — so the
           first version of this printed "Harbour Rooms · Name" and the street
           address directly under a title and a subtitle that said exactly
           that. A fact restated two inches below itself is not information,
           and it is the same duplication the infobox guards against with
           FACT_SKIP. Compared on VALUE, because the labels differ per Center
           while the repetition is always of the words themselves. */
        var already = [head.name || '', ident.name || '', ident.location || '']
          .filter(Boolean).map(function (s) { return String(s).toLowerCase().trim(); });
        var facts = info.filter(function (i) {
          var v = String(i && i.value || '').toLowerCase().trim();
          return v && already.indexOf(v) < 0;
        });
        if (facts.length) {
          room += '<div><div class="po-sheet__label">About</div><ul class="po-time">'
            + facts.map(function (i) {
                return '<li>' + esc(i.value || '')
                  + '<time>' + esc(i.label || '') + '</time></li>'; }).join('') + '</ul></div>';
        }
        if (gals.length) {
          /* A GALLERY IS THE PLATFORM'S CORE CONTENT OBJECT (the Feed
             Correction) — listing one by name and a count is the least it can
             be shown as. Its cover is the picture; where there is none yet, the
             plate carries the Center's light and the count says how much is
             waiting inside. */
          room += '<div><div class="po-sheet__label">Posts</div>'
            + plateRow(gals.map(function (g) {
                return { id: g.id, title: g.title || 'A post',
                         cover: g.cover || '', icon: g.cover ? 'camera' : 'write',
                         sub: g.who || '' };
              }))
            + '</div>';
        }

        /* AND A WAY IN. A Popit that shows you a place and gives you no way to
           walk into it is a poster. The Center surface already exists
           (`OW.live.center`) — this is the door to it, rendered in the room so
           it is the last thing read rather than a control competing with the
           place's own content.

           It carries the id on the markup and is caught by ONE delegated
           listener, because the sheet's innerHTML is rebuilt by `OW.open` and a
           handler attached to a node here would be thrown away on the next
           open. Same reason every other control in a room works this way. */
        room += '<div class="po-acts po-acts--stack">'
          + '<button type="button" class="po-act po-act--wide" data-po-enter="'
          + esc(centerId) + '"><b>Enter ' + esc(head.name || ident.name || 'this Center')
          + '</b><em>its people, what is on, and everything it keeps</em></button></div>';

        OW.open({
          id: centerId,
          label: head.name || ident.name || 'A Center',
          kind_label: [realCategory(ident.category), ident.location]
                        .filter(Boolean).join(' · ') || 'A place',
          glance: ident.description || head.line || '',
          image: arr.banner ? { url: imageUrl(arr.banner) } : null,
          faceHTML: face, faceKind: 'center',
          openHTML: room,
          hue: hue,
          /* THE WORLD TAKES ITS LIGHT. A Center portal is the one thing allowed
             to re-colour the whole page (§17), and arriving somewhere on the
             map is exactly that arrival. */
          world: true
        }, originEl || null);
        return true;
      });
  }
  OW.live.centerPopit = openCenterPopit;

  /* ═══ OPENING AN EVENT ══════════════════════════════════════════════════
     AN EVENT OPENS AS AN EVENT: the App's own event screen (`openEvent` in
     oneway-app.html, `OW.live.event`), read from the events domain on the new
     backend. Until 2026-10-01 a crossing, a memory and a Center's calendar row
     opened through main.py's public Popit (`/api/public/center/{id}/popit/
     {object}`), which knows only the legacy calendar. MEASURED that day on an
     isolated copy: an event made through the new backend answered 404 "this
     Center does not show that publicly", so every event the platform makes
     today opened to that sentence. The event screen also opens the legacy
     events the events domain carries; one known only to the legacy store says
     so on the screen itself. */
  function openEventScreen(eventId) {
    if (!eventId) return false;
    try {
      doc.dispatchEvent(new CustomEvent('ow:open-event', { detail: { id: String(eventId) } }));
    } catch (e) { return false; }
    return true;
  }

  function factList(host, rows, emptySentence, onPick) {
    rows = (rows || []).filter(function (r) { return r && r.value; });
    if (!rows.length) {
      return nothing(host, emptySentence || 'Nothing here yet.', 'Quiet');
    }
    host.classList.add('po-list');
    var frag = doc.createDocumentFragment();
    rows.forEach(function (r, i) {
      var n = OW.glance({
        id: r.id || ('fact-' + i),
        label: r.value,
        signal: [r.label, r.audit].filter(Boolean).join(' · '),
        icon: r.icon || '', hue: r.hue || null,
        face: r.face || null,
        /* a row that knows its date shows it ON the mark — see OW.glance */
        when: r.when || null
      }, { open: r.open !== false && !!r.open });
      /* THE ROW CARRIES ITS OWN IDENTITY. Binding a handler by POSITION and
         reading back into the source array is only correct while the two stay
         the same length — and this function drops rows with no value, so one
         unnamed Center would have made every click after it open a different
         place than the one under the finger. Nothing here counts. */
      /* the row is handed back WITH its element — an opening Popit unfolds from
         the thing that was pressed, and a caller with only the data has nothing
         to give the FLIP as an origin */
      if (onPick) n.addEventListener('click', function () { onPick(r, n); });
      frag.appendChild(n);
    });
    host.appendChild(frag);
    return rows.length;
  }

  /* ── THE PERSON'S CHOICE, APPLIED TO WHAT REALITY OFFERED ────────────────
     `built` is every widget the data supports. `chose` is the person's ordered
     list of KINDS, or null when they have never chosen.

     THREE RULES, AND EACH ONE IS A DECISION SOMEBODY COULD GET WRONG:

     1. **NEVER CHOSE ≠ CHOSE NOTHING.** `null` shows everything; `[]` shows
        nothing. A profile stripped bare is a legitimate thing to want, and a
        surface that quietly refuses it has overruled the person.

     2. **THE ORDER IS THEIRS, NOT THE RENDERER'S.** Kinds come out in the order
        they were chosen, because "the main part of a person's profile" means
        they decide what leads. Anything they built but did not rank keeps its
        own relative order behind the ranked ones — it is not dropped, because
        a POST is a widget too and nobody ranks their posts.

     3. **A KIND THEY CHOSE THAT HAS NO WIDGET SIMPLY DOES NOT APPEAR.** The
        server deliberately does not validate kind names (a whitelist there
        would need a runtime release before anyone could pick a new widget —
        `_APP_LIGHTBULB_TYPES` one layer over). So the renderer is the only
        thing that knows what it can draw, and silence is the right answer to a
        name it does not recognise. */
  /* ── CHOOSING WHAT YOUR PROFILE IS MADE OF ───────────────────────────────
     Founder, 2026-08-18: *"this should be basically the main part of a person's
     profile where it'll be made up of their widgets that they choose to
     display… users can choose to add or remove these from their profiles."*

     WHAT IT OFFERS IS EVERY KIND THE MATERIAL CAN DRAW, not only the kinds this
     person currently has data for. That is the whole point of choosing: a
     person picks "Been to" BEFORE they have been anywhere, and the widget then
     says what would fill it. Offering only what they already have would make
     the chooser a mirror of their history rather than a statement of what they
     want their profile to be.

     NEVER CHOSEN IS SHOWN AS "everything", not as "nothing selected" — because
     that is what the profile is actually doing, and a control that misreports
     the current state is worse than no control.

     It lives under Appearance because what your profile shows IS what your
     profile looks like — the same reasoning that put the field on `style`
     beside `avatar_shape` and `theme`, rather than inventing a second store. */
  /* ── THE CHOICES COME FROM THE PLATFORM, NOT FROM THIS FILE ────────────
     ★ FOUNDER, 2026-09-12 (relayed by C): fewer, better Popits — *"names like
       Rhythm, World, Marks, Visited, Favourite, Next can feel like internal
       product terminology."* C consolidated them to twelve and folded the
       retired kinds the same day.

     THIS LIST DID NOT MOVE, AND IT WAS THE ONLY THING A PERSON COULD PICK
     FROM. Measured 2026-09-12 against `/api/canvas/catalog`:

         offered here   Been to · Your world · Marks · Rhythm · Next ·
                        Guestbook · Find them · Posts
         served         posts · people · places · events · happening ·
                        following · saved · links · guestbook · countdown ·
                        location · about · clock · now

     SIX of the eight on offer no longer exist — a person choosing "Marks"
     for their profile picked a kind the platform had retired — and TEN kinds
     the platform serves were unofferable. A hard-coded list beside a served
     catalogue is a second source of truth, and this is what it costs.

     The catalogue is the list now. A kind added or retired by C reaches this
     picker with no edit here, which is the only arrangement that cannot drift
     again. `FALLBACK_CHOICES` exists ONLY for a catalogue that cannot be read:
     an empty picker would read as "your profile can show nothing". */
  var FALLBACK_CHOICES = [
    ['posts',    'Posts',     'the things you wrote'],
    ['places',   'Places',    'places you have been'],
    ['people',   'People',    'people around you'],
    ['events',   'Events',    'what is coming up']
  ];

  function widgetChooser(host, style) {
    var chose = Array.isArray(style.profile_widgets) ? style.profile_widgets.slice() : null;
    var sec = mk('div', 'ow-cust__row');
    sec.appendChild(mk('span', 'ow-cust__lbl', 'What your profile shows'));
    var body = mk('div', 'ow-wpick');
    sec.appendChild(body);
    host.appendChild(sec);

    function state() {
      return chose === null
        ? 'Showing everything you have. Pick some to choose for yourself.'
        : (chose.length
            ? 'Showing ' + chose.length + (chose.length === 1 ? ' widget' : ' widgets')
              + ', in this order.'
            : 'Showing nothing. Your profile is just you.');
    }

    var line = mk('p', 'ow-wpick__now', esc(state()));
    body.appendChild(line);

    var grid = mk('div', 'ow-wpick__grid');
    body.appendChild(grid);

    function paintChoices(choices) {
      grid.innerHTML = '';
      choices.forEach(function (c) {
      var kind = c[0];
      var b = mk('button', 'ow-wpick__opt'); b.type = 'button';
      b.appendChild(mk('b', '', esc(c[1])));
      b.appendChild(mk('span', '', esc(c[2])));
      var on = chose === null ? false : chose.indexOf(kind) >= 0;
      b.setAttribute('aria-pressed', String(on));
      /* the ORDER a person picked is the order it shows, so the number is not
         decoration — it is the thing they are choosing when they tap */
      var pos = mk('i', 'ow-wpick__n', on ? String(chose.indexOf(kind) + 1) : '');
      b.appendChild(pos);
      b.addEventListener('click', function () {
        if (chose === null) chose = [];
        var at = chose.indexOf(kind);
        if (at >= 0) chose.splice(at, 1); else chose.push(kind);
        save();
      });
      grid.appendChild(b);
      });
    }

    /* THE PLATFORM'S OWN LIST, and the fallback only if it cannot be read.
       `/api/canvas/catalog` is C's canonical answer to "what kinds exist". */
    paintChoices(FALLBACK_CHOICES);
    data.get('/api/canvas/catalog').then(function (r) {
      var pop = ((r.ok && r.data && r.data.catalog) || {}).popits || [];
      var rows = pop.filter(function (k) { return k && k.kind; })
                    .map(function (k) {
                      return [k.kind, k.name || k.kind, k.blurb || ''];
                    });
      if (rows.length) paintChoices(rows);
    });

    /* RETURNING TO "everything" IS A REAL CHOICE AND NEEDS ITS OWN CONTROL.
       Deselecting every widget means "show nothing" — a legitimate thing to
       want and NOT the same as never having chosen. Without this the default
       would be unreachable once a person touched the control at all. */
    var back = mk('button', 'po-act', 'Show everything');
    back.type = 'button';
    back.addEventListener('click', function () { chose = null; save(true); });
    body.appendChild(back);

    function save(clear) {
      var was = style.profile_widgets === undefined ? null : (style.profile_widgets || []).slice();
      data.post('/api/oneway/people/me/style',
        { style: { profile_widgets: clear ? null : chose } }, { method: 'PUT' })
        .then(function (r) {
          /* A REFUSED CHOICE IS PUT BACK AND SAID — this redrew the new order
             and told the Profile pane it had changed while the profile kept
             the old set (founder/502 sweep) */
          if (!r || !r.ok) {
            chose = was;
            host.innerHTML = '';
            widgetChooser(host, style);
            appearance(host, style, data.me());
            if (OW.toast) OW.toast('What your profile shows did not change. ' + ((r && r.error) || 'Try again.'));
            return;
          }
          data.invalidate('/api/oneway/people/');
          style.profile_widgets = clear ? undefined : chose.slice();
          host.innerHTML = '';
          widgetChooser(host, style);
          appearance(host, style, data.me());
          /* the Profile pane is now a snapshot of a decision that changed */
          doc.dispatchEvent(new CustomEvent('ow:profile-changed'));
        });
    }
  }

  /* ── A TILE MUST SAY WHAT IS IN IT ───────────────────────────────────────
     Founder, 2026-08-19: *"they dont seem working or alive on localhost to me."*

     He is right, and the diagnosis is narrow: **the rooms work and the tiles do
     not.** Opening `Your world` gives *"PART OF · Harbour Rooms Community"* —
     real, readable, correct. The TILE above it renders a constellation whose
     names live only in `title` tooltips on `aria-hidden` marks, so on a phone
     there is no gesture that reveals them. A person sees two unlabelled dots and
     a legend, and nothing tells them there is anything behind it.

     `data.signal` renders into `po-w__foot` — OUTSIDE the body's clip, by
     design, because that is where an affordance lives. So a tile whose body is
     abstract can still NAME its contents in words, from this side, without
     touching the material.

     ★ NAMES, NOT COUNTS. "Harbour Rooms Community" tells a person something;
     "1 place" tells them there is a number. The count is what the tile already
     fails to communicate visually — repeating it in words adds nothing. Where
     there are too many to name, the first few and a remainder, because a list
     that runs off the tile is worse than an honest "and 4 more". */
  function saysWhat(names, more) {
    names = (names || []).filter(Boolean);
    if (!names.length) return '';
    if (names.length <= 2) return names.join(' · ');
    return names.slice(0, 2).join(' · ') + ' · and ' + (names.length - 2) + ' more';
  }

  function applyChoice(built, chose) {
    if (!chose) return built;                       /* never chose → everything */
    /* CHOSE NOTHING MEANS NOTHING. My first cut let posts ride along even
       here, which quietly overruled the one instruction that is hardest to
       give — a person who empties their profile has said something specific
       and a surface that keeps two tiles anyway has decided it knows better. */
    if (!chose.length) return [];
    var rank = {};
    chose.forEach(function (k, i) { rank[k] = i; });
    var picked = built.filter(function (d) { return rank[d.kind] != null; });
    /* ★ `order` IS THE MATERIAL'S OWN FIELD AND IT WAS BUILT FOR EXACTLY THIS.
       `OW.mountProfile` sorts by each kind's default rank UNLESS a widget
       carries `order`, and its comment says why: *"an owner's explicit `order`
       always wins, because a profile is theirs to arrange."* Nothing had ever
       set it — so sorting the array here did nothing, because the material
       re-sorted it by kind a moment later and world always preceded visited
       whatever the person asked for. **The affordance existed and had no
       caller**, which is this repo's signature defect, found in my own change
       within the hour of writing it. */
    picked.forEach(function (d) { d.order = rank[d.kind]; });
    /* a person's own POSTS are not a kind anybody ranks — they ride behind the
       chosen widgets rather than being deleted by an omission */
    var carried = built.filter(function (d) {
      return rank[d.kind] == null && d.kind === 'post';
    });
    carried.forEach(function (d) { d.order = 900; });
    return picked.concat(carried);
  }

  /* ── A LIST OF POSTS IS NOT A LIST OF POSTS UNTIL YOU CAN ACT ON IT ──
     ★ FOUNDER, 2026-08-31 (founder/354 §2): the profile is *"a complete
       social destination"* — Posts, Reposts, Favorites all of a piece.

     MEASURED on My Center with one repost and one save present: Reposts
     rendered 1 canonical card with **0 interactions**, Favourites the
     same. `OW.mountRiver` draws the card; it does not wire the response
     bar — `OW.mountResponses` does, and only the Posts tab was calling it.
     So a person could see a Post they had reposted and not like it.

     ONE HELPER, THREE TABS. Written once here rather than three times:
     a fourth collection added tomorrow inherits the interactions instead
     of forgetting them, which is the difference between a primitive and a
     habit (founder/346 §39). */
  /* ── A CARD OPENS ITS POST, WHEREVER THE POST IS LISTED ─────────────────
     founder/502's crawl: a text Post's card opened from Home and did nothing
     on a profile or a Center, because every river mounts with `open:false`
     (so the real Post, not the generic sheet, is what opens) and only Home's
     `wireRiver` put the open back. One handler for every other river, with
     Home's rules: the acts, a person's or a Center's face and any link keep
     their own taps; a Post with media opens from its words, not its picture
     (the picture is the like gesture); a text Post waits out the double-tap
     window so a double tap still likes it; the open carries where it began. */
  OW.openCardsIn = function (river) {
    if (!river || river.__owOpens) return;
    river.__owOpens = true;
    river.addEventListener('click', function (e) {
      var card = e.target.closest && e.target.closest('.po-card[data-po-id]');
      if (!card || !river.contains(card) || e.defaultPrevented) return;
      /* THE FACE KEEPS ITS OWN TAP — and here it had none. A card mounted with
         `open:false` never gets the material's own listener, so pressing the
         author on a Center's page, a person's page or your own did nothing
         (the 2026-09-26 crawl: "Open ONEWAY Operations B" DEAD on a Center,
         "Open ada.ops" on a person). The press goes where the feed sends it. */
      var who = e.target.closest('[data-po-who]');
      if (who && card.contains(who)) {
        e.preventDefault();
        doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { ref: who.getAttribute('data-po-who') } }));
        return;
      }
      var cen = e.target.closest('[data-po-center]');
      if (cen && card.contains(cen)) {
        e.preventDefault();
        doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: cen.getAttribute('data-po-center') } }));
        return;
      }
      if (e.target.closest('.po-act, [data-po-respond], [data-po-save], [data-po-repost], [data-po-share], '
          + '[data-po-comment], [data-po-who], [data-po-center], [data-po-likers], a, input, textarea, video, .ow-vctl')) return;
      var kindEl = card.querySelector('[data-okind]');
      if (kindEl && kindEl.getAttribute('data-okind') !== 'post') return;
      var zone = OW.likeZone && OW.likeZone(e.target);
      var waits = zone && OW.likeZoneOpens && OW.likeZoneOpens(zone);
      if (zone && !waits) return;
      var pid = card.getAttribute('data-po-id');
      if (!pid || typeof global.openPost !== 'function') return;
      var r = card.getBoundingClientRect();
      var origin = { node: card, rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                     at: { x: e.clientX, y: e.clientY } };
      var enter = function () { global.openPost(pid, origin); };
      if (waits && OW.openAfterTap) { OW.openAfterTap(enter); return; }
      enter();
    });
  };

  function mountStream(pane, rows) {
    var wrapped = OW.riverRows ? OW.riverRows(rows) : rows;
    OW.mountRiver(pane, wrapped, { open: false });
    OW.openCardsIn(pane);
    if (OW.mountResponses) {
      wrapped.forEach(function (it) { OW.mountResponses(pane, it); });
    }
    /* THE SAME LIVE PATH THE FEED USES — same nodes, so a count corrected
       anywhere is corrected here. */
    if (OW.realtime) {
      OW.realtime.watch(wrapped.map(function (it) {
        return ((it && it.post) || it || {}).id || ''; }).filter(Boolean));
    }
    return wrapped.length;
  }

  /* ── WHO THIS IS, BEFORE THE HEAVY READ COMES BACK ──────────────────────
     ★ FOUNDER, 2026-09-09: *"the loading shouldnt be that common and should
       block the page … have indidvudal posts load whatever optimizes best for
       loading fast on high connections and fast on garbage cellular data."*

     A profile used to show the globe and the word "One moment" until THREE
     reads had all landed, the slowest of which is a 133-line monolith handler.
     On a good connection that is a flash of nothing; on bad cellular it is the
     entire experience of opening somebody's profile.

     Their NAME AND FACE do not depend on any of that. `people/{email}` is a
     keyed read of one row, so it arrives first and the header is real — not a
     skeleton, not a shimmer, not a guess. Everything heavy fills in beneath it.

     IT PAINTS NOTHING IT DOES NOT KNOW. No counts, no Follow button, no
     "nothing here yet" — every one of those is a CLAIM, and a claim made
     before its read has answered is the defect this file already carries three
     comments about. What is not yet known is simply absent, and absence is
     replaced by the full render the moment it is. */
  function paintIdentityFirst(host, p) {
    if (!p || !p.email) return false;
    host.className = ''; host.innerHTML = '';
    /* THE SAME CLASSES `profileShell` USES, and not one of my own. A first
       paint that invents its own class names is a first paint nothing styles —
       and a stylesheet that NAMES a class and one that STYLES it are
       indistinguishable to every tool, so it would have looked done. Checked:
       `ow-prof__sub`, `ow-prof__who` and `ow-avatar__i` were mine and were
       styled by nothing; `ow-prof__handle` is the real one. The structure is
       flat here because it is flat there — a wrapper this side and none the
       other is how the header would jump when the full render replaces it. */
    var root = mk('div', 'ow-prof');
    var ban = mk('div', 'ow-banner');
    ban.appendChild(mk('span', 'ow-banner__shade'));
    root.appendChild(ban);
    var id = mk('div', 'ow-prof__id');
    var av = mk('div', 'ow-avatar');
    var src = imageUrl(p.picture);
    if (src) {
      var im = doc.createElement('img');
      im.src = src; im.alt = ''; im.loading = 'eager'; im.decoding = 'async';
      av.appendChild(im);
    } else {
      if (OW.faceMark) { av.innerHTML = OW.faceMark(); }      /* founder/495 */
      else av.textContent = OW.initials ? OW.initials(p.display_name || '')
                                   : (p.display_name || p.email || '?').charAt(0);
    }
    id.appendChild(av);
    id.appendChild(wearWordmark(mk('h1', 'ow-prof__name',
      esc(p.display_name || p.email)), (p.person || p).wordmark));
    var prof = p.profile || {};
    var sub = [prof.handle ? '@' + prof.handle : '', prof.pronouns]
                .filter(Boolean).join(' · ');
    if (sub) id.appendChild(mk('p', 'ow-prof__handle', esc(sub)));
    if (prof.bio) id.appendChild(mk('p', 'ow-prof__bio', esc(prof.bio)));
    root.appendChild(id);
    host.appendChild(root);
    return true;
  }

  /* ═══ WHO THEY FOLLOW · WHO FOLLOWS THEM ═══════════════════════════════
     ★ FOUNDER/472: *"every feature and every button should work right now."*
     MEASURED 2026-09-20 on loop.ada's Home at 290px: the Following Popit's
     button did nothing — its catalog entry "opens the feed", and on Home you
     are already there, so `go('home')` returned. And the "4 following ·
     4 followers" counts on every profile were plain text. The graph has
     answered `/api/oneway/graph/{email}/following` and `/followers` all
     along; nothing in the App opened either.

     One surface for both, drawn into the projection pane over whatever page
     the person is on: the graph's rows (people as emails, Centers with their
     names) become faces and names — the App reads each person once, as the
     inbox does until B enriches the door — and pressing a row opens them.
     `id` is `following:<email>` or `followers:<email>`. */
  OW.live.people = function (host, id, opts) {
    opts = opts || {};
    var parts = String(id || '').split(':');
    var which = parts.shift() || 'following';
    var email = parts.join(':') || ME;
    /* ── ONE LIST OF PEOPLE, THREE THINGS IT CAN BE A LIST OF ─────────────
       ★ FOUNDER/488: *"make it clickable with lists, putting users the user
         follows or is friends iwth first."*

       Following, Followers and now WHO LIKED THIS POST. A second renderer for
       the third one would be a second set of rows that drift — different face
       shapes, a different way of opening a person, a different empty state —
       so this surface takes a different READ and draws the same list. The
       ordering is the server's (`service.likers_of_post` ranks the people
       this viewer knows first); nothing is re-sorted here, because a surface
       that re-ranks what a backend ranked is two answers to one question. */
    var likers = which === 'likers';
    if (!likers && which !== 'followers') which = 'following';
    var post = likers ? (parts.join(':') || email) : '';
    var word = likers ? 'Liked by' : (which === 'followers' ? 'Followers' : 'Following');
    loading(host, 3);
    return Promise.all([
      likers
        ? data.get('/api/oneway/social/posts/' + encodeURIComponent(post) + '/likers')
        : data.get('/api/oneway/graph/' + encodeURIComponent(email) + '/' + which),
      likers ? Promise.resolve({ ok: false })
             : data.get('/api/oneway/people/' + encodeURIComponent(email))
    ]).then(function (rs) {
      var g = rs[0], who = (rs[1].ok && rs[1].data) || {};
      host.className = ''; host.innerHTML = '';
      host.classList.add('ow-people');
      var head = mk('div', 'ow-people__head');
      head.appendChild(mk('h1', 'ow-people__h', esc(word)));
      if (!likers) {
        head.appendChild(mk('p', 'ow-people__who', esc(who.display_name || '')));
      }
      host.appendChild(head);
      if (!g.ok) { refused(host, g, word); return 0; }
      var d = g.data || {};
      /* THE SAMPLE IS BOUNDED AND THE PAGE SAYS SO rather than presenting a
         partial list as the whole of it (the backend's `capped`). */
      if (likers && d.capped) {
        head.appendChild(mk('p', 'ow-people__who',
          'The most recent. There are more.'));
      }
      /* each person by @handle (`ref`) — the lists carry no address but your own (people/refs.py) */
      var people = (d.people || []).filter(function (x) { return x && (x.ref || x.email); });
      var centers = (d.centers || []).filter(function (x) { return x && (x.center_id || x.id); });
      if (!people.length && !centers.length) {
        nothing(host, likers ? 'Nobody has liked this yet.'
                : which === 'followers' ? 'Nobody follows them yet.'
                : 'Not following anyone yet.', word);
        return 0;
      }
      var list = mk('div', ''); host.appendChild(list);
      /* THE ROWS ARE DRAWN AT ONCE from what the graph said, and each person's
         face and name arrive as their light read lands — nothing waits on
         thirty reads to show the first name. */
      var rows = centers.map(function (c) {
        return { id: 'c-' + (c.center_id || c.id), value: c.name || 'Center',
                 label: c.kind || '', icon: 'center',
                 hue: (typeof c.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(c.hue) : null,
                 face: { image: c.picture || '', name: c.name || '', shape: c.shape || 'rounded' },
                 go: { center: c.center_id || c.id } };
      }).concat(people.map(function (x) {
        /* the likers read already carries the resolved name, so those rows do
           not flash an email's left half before the light read lands */
        var nm = String(x.name || '').trim() || 'Someone';
        var key = x.ref || x.email;
        return { id: 'p-' + key, value: nm,
                 label: x.known ? 'You follow them' : '', icon: 'person',
                 face: { image: '', name: nm, shape: 'round', kind: 'person' },
                 go: { person: key } };
      }));
      var rowEls = {};
      var n = factList(list, rows, '', function (row, el) {
        if (!row || !row.go) return;
        /* the list is a pane over the page; the person or Center opens AS the
           page, so the pane folds away first — otherwise the page changed
           underneath a list that stayed on top (measured 2026-09-20) */
        try { if (OW.project && OW.project.isOpen && OW.project.isOpen()) OW.project.close(); } catch (_) {}
        try {
          if (row.go.center) doc.dispatchEvent(new CustomEvent('ow:open-map', { detail: { id: row.go.center, from: el } }));
          else doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { ref: row.go.person, from: el } }));
        } catch (_) {}
      });
      Array.prototype.forEach.call(list.querySelectorAll('.po-glance'), function (el, i) {
        if (rows[i]) rowEls[rows[i].id] = el;
      });
      people.slice(0, 40).forEach(function (x) {
        var key = x.ref || x.email;
        data.get('/api/oneway/people/' + encodeURIComponent(key)).then(function (pr) {
          if (!pr.ok || !pr.data) return;
          var pd = pr.data;
          var el = rowEls['p-' + key];
          if (!el) return;
          var nmEl = el.querySelector('.po-glance__lb');
          if (nmEl && pd.display_name) {
            var sig = nmEl.querySelector('.po-glance__sig');
            nmEl.textContent = pd.display_name;
            if (sig) nmEl.appendChild(sig);
          }
          var faceEl = el.querySelector('.po-glance__face');
          if (faceEl && pd.picture && imageUrl(pd.picture)) {
            faceEl.innerHTML = '';
            var im = doc.createElement('img'); im.src = imageUrl(pd.picture); im.alt = ''; im.loading = 'lazy';
            faceEl.appendChild(im);
            if (/^(round|rounded|square)$/.test(String(pd.shape || ''))) faceEl.setAttribute('data-shape', pd.shape);
          }
        });
      });
      return n;
    });
  };

  OW.live.profile = function (host, email, opts) {
    opts = opts || {};
    loading(host, 3);
    /* THE FIRST PAINT COMES FROM THE CANONICAL BACKEND. Fired here rather than
       inside the Promise.all so it races the heavy reads instead of queueing
       behind them — and it yields the moment the full render is ready, so a
       fast connection never sees two paints. */
    var painted = false;
    data.get('/api/oneway/people/' + encodeURIComponent(email))
      .then(function (pr) {
        if (host.getAttribute('data-full') === '1') return;   /* heavy read won */
        if (pr.ok && pr.data && paintIdentityFirst(host, pr.data)) {
          painted = true;
          /* their light, as soon as it is known — the same rule the full
             render applies, one read earlier */
          if (pr.data.hue_chosen && pr.data.hue != null) {
            var fp = OW.hue.fromAngle(pr.data.hue);
            OW.hue.context('person', { h1: fp[0], h2: fp[1] }, 800);
          }
        }
      });
    /* ── THE RELATIONSHIP COMES FROM THE GRAPH, NOT FROM THE PROFILE ──────
       ★ LANE B, 2026-09-02, handing over the sealed contract: *"popit-live.js
         currently derives the Follow button from `person.is_following` on the
         legacy payload, which is the field that was lying."*

       THE SPLIT-BRAIN, FROM THIS SIDE. `/api/me/follow` used to write a legacy
       `follows` namespace and return `ok:true` while the canonical graph was
       untouched — so this button said "Following", and the Following feed, the
       audience rules and DM eligibility all disagreed with it. B has sealed the
       WRITE. This is the READ half: `/api/oneway/graph/between/{email}` is the
       one place that knows, and its own docstring names this surface — *"a
       profile header draws every one of its states from this and never
       guesses."*

       READ IN THE SAME BREATH as the profile, deliberately. Fetching it after
       the shell mounts would paint a Follow button in whatever state the legacy
       payload claimed and then correct it — a visible lie, however brief, about
       a relationship. `can_follow` already folds in "they blocked me" WITHOUT
       disclosing the block, so this must not compute that itself. */
    /* ── THE PROFILE'S OWN COMPOSED READ ───────────────────────────────
       `GET /api/oneway/people/{email}/profile` was built FOR this surface and
       then not wired to it: I shipped the door, the session was redirected,
       and I carried "profile is composed" in my own lane report for days while
       this line still read the 133-line legacy monolith handler. Caught by
       reading my own claim against the file. Corrected on the channel too.

       THREE READS BECOME ONE. Identity, the relationship (its own request
       until now), the counts, links, rings, the arranged surfaces, the style
       row, a first page of posts with its cursor, the pinned row and the
       memberships — each in its own guard, with `unreadable[]` naming any part
       that failed. The relationship riding on the same answer also means it
       can no longer disagree with the identity beside it.

       THE CANVAS STAYS ITS OWN READ: a different subject, already canonical. */
    return Promise.all([
      data.get('/api/oneway/people/' + encodeURIComponent(email) + '/profile',
               { fresh: true }),
      /* ── THE PUBLIC FACE, READ BEFORE ANYTHING DECIDES THE PAGE IS EMPTY ──
         ★ FOUNDER RULING, 2026-09-04: a person's public face is their PROFILE
           (`profile:{email}`).

         Nothing rendered it. `canvas.mount` appeared in exactly three places —
         the owner's own Home, a Center, and My Center's Main tab — and the
         last of those mounted `home:` + email. `may_view` allows a home to be
         read ONLY by its owner, so a visitor's read returned an empty canvas
         and this surface never asked for one at all. Measured with a second
         real account: home:will 0 placements to a visitor, 12 to the owner.

         So every visitor to every profile saw none of the Popits that person
         arranged, and the owner — looking at their own page — saw all of them
         and had no way to know.

         Read HERE rather than after the shell mounts, for the same reason the
         graph is: the empty-profile message below is a claim about this person,
         and making it before the canvas has answered is how the page came to
         say "has not put anything on their profile yet" about somebody who
         had. */
      data.get('/api/canvas/' + encodeURIComponent('profile:' + email))
    ]).then(function (res) {
      var _pr = res[0], cvRes = res[1];
      /* ── THE ENVELOPES THE RENDERER ALREADY READS ──────────────────────
         Shaped here, once, so the eight hundred lines below are unchanged: a
         change of SOURCE, not a rewrite of the surface. Every field is carried
         from the part of the composed answer that owns it — nothing is
         renamed, invented or defaulted, because that would be the frontend
         model this project ruled out. */
      var _d = (_pr.ok && _pr.data) || {};
      var _p = _d.person || {}, _rel = _d.relationship || {}, _cn = _d.counts || {};
      var _sf = _d.surfaces || {};
      var u = {
        ok: _pr.ok, status: _pr.status, error: _pr.error,
        data: {
          user: {
            email: _p.email || email,
            name: _p.name || '',
            username: _p.handle || '',
            handle: _p.handle || '',
            picture: _p.picture || '', shape: _p.shape || '',
            /* THE CHOSEN HUE AND THE STYLE ROW'S DEFAULT ARE DIFFERENT
               ANSWERS and this surface has been burned by conflating them —
               `style.accent_hue` is the platform default for 1,255 accounts in
               1,260. `hue_chosen` travels beside it so the renderer can tell. */
            hue: _p.hue, hue_chosen: !!_p.hue_chosen,
            style: _d.style || {},
            pronouns: _p.pronouns, bio: _p.bio,
            location: _p.location, website: _p.website,
            note: _p.note,
            /* the face a name wears, resolved by the API */
            wordmark: _p.wordmark,
            /* the person's OWN links (canonical `person.links`, founder/442)
               outrank the legacy widget list, which is empty for anyone who
               set theirs in Settings */
            links: (_p.links && _p.links.length) ? _p.links : (_d.links || []),
            followers: _cn.followers, following: _cn.following, likes: _cn.likes,
            is_me: !!_rel.is_me, is_following: !!_rel.following,
            is_friend: !!_rel.mutual
          },
          posts: _d.posts || [], posts_cursor: _d.posts_cursor || '',
          marks: _sf.marks, next: _sf.next, rhythm: _sf.rhythm,
          visited: _sf.visited, world: _sf.world,
          pinned: _d.pinned || [], memberships: _d.memberships || []
        }
      };
      /* THE RELATIONSHIP IS THE GRAPH'S ANSWER, in the envelope the Follow
         control already reads. It was its own request; it rides on the same
         answer now, which also means it can never disagree with the identity
         beside it. */
      var bt = { ok: _pr.ok && (_d.unreadable || []).indexOf('relationship') < 0,
                 data: _rel };
      /* ── A READ THAT FAILED IS NOT A PERSON WITH AN EMPTY PROFILE ───────
         This counted placements and nothing else, so a failed canvas read gave
         0 — and 0 is what the empty branch below turns into "has not put
         anything on their profile yet", a sentence about a human being,
         asserted on the strength of a request that never arrived.

         The comment on the read above already says the claim must not be made
         before the canvas has answered. It can also fail to answer, and that is
         a third case, not a quiet second helping of the second. */
      var faceOk = !!(cvRes && cvRes.ok);
      var facePlacements = ((cvRes && cvRes.ok && cvRes.data &&
                             cvRes.data.placements) || []).length;
      /* THE CANVAS LEADS, THE FACTS FOLLOW — the arrangement is the thing they
         made; the profile details sit under it. Same order the owner's own
         Main tab already uses, so one person's page is not two designs. */
      function mountFace(into) {
        /* ── THE FAULT GOES WHERE THE CANVAS WOULD HAVE BEEN ──────────────
           Answering only on `facePlacements` meant a FAILED read and a person
           with no Popits produced the identical page. Where the profile also
           has legacy widgets the empty branch is never reached, so the canvas
           was simply absent with nothing said — no false claim, but no truth
           either, which is its own way of being wrong.

           A surface that could not load says so, in the place the thing would
           have been, whether or not anything else on the page rendered. */
        if (!(OW.canvas && OW.canvas.mount)) return false;
        if (!faceOk) {
          var f = mk('div', 'ow-prof__canvas');
          var msg = mk('div', 'ow-cv-fault',
            'Their Popits could not be loaded just now. Nothing has been changed.');
          f.appendChild(msg);
          into.appendChild(f);
          return false;
        }
        if (!facePlacements) return false;
        var slot = mk('div', 'ow-prof__canvas');
        into.appendChild(slot);
        try { OW.canvas.mount(slot, 'profile:' + email); } catch (e) { return false; }
        return true;
      }
      /* THE FULL RENDER CLAIMS THE HOST. Set BEFORE the refusal branch, so a
         first paint that lands late cannot overwrite a refusal with a header
         and leave somebody looking at a name above nothing. */
      host.setAttribute('data-full', '1');
      if (!u.ok) { refused(host, u, 'This profile'); return 0; }
      var p = u.data || {}, person = p.user || {}, style = person.style || {};
      /* UNKNOWN IS NOT "NOT FOLLOWING" (founder/350). A failed graph read means
         the relationship is unknown, and the acts below say so rather than
         drawing a Follow button that would create a second follow on press. */
      var rel = bt.ok ? (bt.data || {}) : null;
      host.className = ''; host.innerHTML = '';

      /* their hue, if they have chosen one — never invented for them.
         `style.accent_hue` is 266 for everyone who never chose (see below),
         so it is only believed when `hue_chosen` says there was a choice;
         otherwise the tiles inherit the world's light rather than painting
         a stranger's page platform purple. */
      var _angle = person.hue_chosen
        ? (person.hue != null ? person.hue : style.accent_hue) : null;
      var theirs = (_angle != null) ? OW.hue.fromAngle(_angle) : null;
      var hue = theirs ? { h1: theirs[0], h2: theirs[1] } : null;

      /* ── THE SURFACE WEARS THE IDENTITY YOU ARE STANDING IN ──────────────
         ★ FOUNDER, 2026-09-08: *"THE HUE TRANISTION FOR USERS STILL DOESNT
           WORK WT"* — and he was right for a reason nothing in the code
         admitted.

         `hue.context` HAS a person branch. Its own docstring names this exact
         surface — *"another person's while you are on their profile"* — and
         records a defect it already fixed there: *"THE PERSON BRANCH DISCARDED
         THE HUE IT WAS GIVEN … so another person's identity never reached the
         surface at all."* `profileShell`, sixty lines down, states as fact that
         *"Both callers already set the SURFACE hue via hue.context"*.

         MEASURED 2026-09-08: every `hue.context` call site in the entire
         frontend passed 'center'. Not one passed a person. The branch was
         written, documented, cited to the founder, fixed once for a bug inside
         it — and NEVER CALLED. Signed in as a person who chose 150, standing on
         the profile of a person who chose 210, `--ow-h1` did not move: 92,255,173
         before and after. A complete contract with no producer, which is the
         same shape as `presence.touch()` having one caller — its own test — and
         everyone on ONEWAY being permanently offline with 43 checks passing.

         AND IT NEEDS `hue_chosen`, WHICH IS WHY THIS COULD NOT SIMPLY BE
         SWITCHED ON. `style.accent_hue` is sanitised to the platform default
         266 for everybody who has never picked a colour, so of 1,260 accounts
         exactly 5 have a chosen hue and 1,255 answer 266 in the same field and
         the same shape as a real decision. Asserting that is not "wearing their
         light", it is stripping yours and painting ONEWAY purple on a stranger's
         face 1,255 times out of 1,260. `/api/users/{email}` now says whether the
         colour was CHOSEN — the same question `/api/auth/me` already answers for
         the viewer — so an unchosen hue returns the world to YOU instead.

         `mine` is not consulted: on your own profile this resolves to your own
         pair, which is what the world is already wearing, so it is a no-op
         rather than a special case that could rot. */
      if (person.hue_chosen && hue) OW.hue.context('person', hue, 800);
      else OW.hue.context(null, null, 700);

      /* WHOSE PROFILE THIS IS, DECIDED BEFORE ANYTHING ASKS.
         This value was computed FIFTY-FIVE LINES BELOW the widgets that read
         it. `var` hoists but the assignment does not, so `mine` was `undefined`
         at every use above — and `undefined ? 'Your' : 'Their'` is always
         "Their". A person's own profile called them by the third person, and
         the ternary looked correct in the diff.

         THIS IS THE SECOND TIME. The comment further down already recorded it
         once — "WHOSE PROFILE THIS IS WAS DECIDED TWENTY LINES TOO LATE",
         written when My Center told Mara that "Mara has not put anything on
         their profile yet". That fix moved the READ; this one moves the VALUE,
         which is the half that actually stops it recurring. A warning about a
         mistake is not a guard against it, and I made this one with the warning
         on screen. */
      /* opened by @handle, your own profile is known by the server's word (`self`), not by
         comparing an address the App no longer holds for anybody else */
      var mine = (email || '').toLowerCase() === (data.me() || '').toLowerCase() || !!_p.self;
      var w = [];

      /* ── WHICH WIDGETS THIS PERSON CHOSE TO SHOW ──────────────────────────
         Founder, 2026-08-18: *"this should be basically the main part of a
         person's profile where it'll be made up of their widgets that they
         choose to display… users can choose to add or remove these."*

         `style.profile_widgets` is an ORDERED list of kinds. Order is half the
         feature: making widgets the profile means the person decides what
         LEADS, not just what appears.

         ★ ABSENT AND EMPTY ARE DIFFERENT ANSWERS.
             undefined  → never chose   → show everything there is (the default)
             []         → chose NOTHING → show nothing, and obey it
         Collapsing those is the defect that put a person's own Center into
         their own world this morning. `chose` is null-or-array, never a
         falsy-checked list. */
      var chose = Array.isArray(style.profile_widgets) ? style.profile_widgets : null;

      /* GALLERY RINGS ARE RETIRED with the galleries (the founder's ruling; the profile read stopped
         carrying `rings` on 2026-10-03, when its reader left main.py). */

      /* WHAT THEY HAVE SAID, ON THEIR OWN PROFILE.
         The profile read has ALWAYS returned `posts` and this surface has never
         rendered one — a person could post, see it live in the Center's feed,
         and open their own profile to "Your profile is empty". Galleries and
         links were the only things a profile could be made of, and most people
         have neither. Posts are the thing almost everyone has.

         Rendered in the tile grammar already here — same shape as a gallery
         tile, so `mountProfile` needs no new case and the two cannot drift. */
      /* A POST IS A POST, NOT A QUOTE (founder, 2026-08-16 — posts should be
         smaller Popits that expand on the person's world).

         These were rendered as `said`, the ONE authored widget, which threw
         away everything except the words: where it was lit, when, its media,
         and what people did with it. The earlier note here was half right —
         `OW.widget` DOES silently return null for an unknown kind, and that is
         why the first `kind:'post'` attempt vanished — but the answer was to
         give the material the word, not to borrow one that means something
         else. `post` is now a registered kind.

         EACH ONE WEARS THE HUE OF THE PLACE IT WENT TO, not the person's, so a
         profile reads as someone reaching into several worlds (§17). A post
         lit nowhere keeps the person's own light, because that is the truth
         about it. */
      /* ── POSTS ARE NOT WIDGETS ANY MORE. THEY HAVE THEIR OWN TAB. ────────
         ★ FOUNDER, 2026-08-31 (founder/352 §4): *"Main content — Posts shows
           everything… Profile Popits — use Popits for specialized profile
           collections: Highlights, Playlists, Favorites where applicable,
           pinned content."*

         Six Posts were rendered here as `kind:'post'` widgets — the same Posts
         the Posts tab now shows as canonical cards with their interactions. So
         a person saw their last six twice: once as tiles they could not like,
         and once properly. The tiles were the older answer to "a profile
         should show what you made", and the founder has since split it: the
         STREAM is the stream, and Popits are for the COLLECTIONS.

         `postData` stays — Highlights and Playlists will want exactly that
         translation when they exist, and deleting it would only mean writing
         it again. */

      var links = person.links;
      if (links && (links.length || (!Array.isArray(links) && Object.keys(links).length))) {
        var list = Array.isArray(links) ? links
          : Object.keys(links).map(function (k) { return { name: k, url: links[k] }; });
        if (list.length) w.push({ kind: 'links', id: 'p-links', label: 'Find them',
          size: '2x2', links: list, hue: hue, visibility: 'public' });
      }

      /* counts only when there is something to count */
      /* ── THE WIDGETS THE RUNTIME NOW FEEDS, WHICH THIS RENDERER IGNORED ──
         (founder, 2026-08-17: "People still don't have widgets on their
         profiles.")

         Half of that was mine and already fixed — every tile was being dropped
         by a visibility filter the App fed a word it did not know. The other
         half was that the READ had nothing in it: `/api/users/{email}` answered
         posts, galleries and rings, and nothing else, while the material
         supports seventeen kinds.

         The runtime session has since fed `visited`, `world` and `rhythm` from
         things the platform already records — real memberships, real RSVPs, the
         days a person was actually here. And this function did not read them.
         Same defect I have been chasing all day, this time in my own file.

         ABSENT IS NOT EMPTY, and the distinction is theirs and correct: a key
         that is missing means there is NO SOURCE for it, so nothing is drawn.
         An empty LIST means the source answered "none", which is a true
         sentence and may be shown. So every block below is guarded on presence,
         never on truthiness — `marks: []` would say "no marks yet"; no `marks`
         key at all says nothing, because we do not know. */

      /* WHERE THEY HAVE BEEN — real places, each in its own colour (§17), and
         each one openable because the read carries `center_id`. */
      /* ★ A CHOSEN WIDGET SHOWS EVEN WHEN IT IS EMPTY.
         Founder, 2026-08-18: *"this should be basically the main part of a
         person's profile where it'll be made up of their widgets that they
         choose to display… users can choose to add or remove these."*

         THAT CHANGES WHAT AN EMPTY WIDGET MEANS. While widgets were a garnish,
         skipping an empty one was right — nobody misses a tile they never chose.
         **Once the widgets ARE the profile, skipping one puts a hole where a
         person's choice was**, and the surface silently overrules them.

         AND THE CODE ALREADY CONTRADICTED ITS OWN COMMENT. The note above says,
         correctly, *"every block below is guarded on presence, never on
         truthiness — `marks: []` would say 'no marks yet'; no `marks` key at all
         says nothing, because we do not know."* Then every guard read
         `&& p.visited.length`, which is a truthiness guard. **The rule was
         written down and not implemented**, which is why a person with one place
         and no marks saw a profile that looked broken rather than new.

         Presence only, from here. An empty LIST is the source saying "none" —
         a true sentence about a real person, and the widget says it. An absent
         KEY is still nothing drawn, because we genuinely do not know. */
      /* ── "BEEN TO" IS NOT DRAWN, BECAUSE NOTHING RECORDS IT ──────────────
         MEASURED 2026-09-14 as a brand-new person: one hour old, she had
         opened Caesars in the App and her own page said "Been to · Caesars
         Atlantic City · by proximity". She has been nowhere. The producer's
         own docstring (`_profile_widget_reads`) says what `visited` is:
         "REAL memberships" — the same list the "Your world" tile beside it
         already draws, under a truthful name. A membership shown as a visit
         is a claim about a person's movements that the platform did not
         witness, and it is the tile a stranger would read first. Absent
         until something actually records where a person has been; `world`
         keeps saying where they belong. */


      /* THEIR WORLD — who and what they belong to. The read answers a COUNT and
         NAMES rather than the relationship objects the field draws, so the
         names are carried through and nothing is invented about the ties: no
         weights, no relations we were not told. */
      if (p.world && Array.isArray(p.world.names)) {
        /* THE THIRD PERSON, SAID TO THE PERSON THEMSELVES. `mine` is the same
           value the empty-state sentences above already use, and this label
           was the one thing on My Center still narrating the owner from
           outside — "Their world", on your own profile. Cheap to say right. */
        /* THE PAGE DRAWS THESE AS THE CENTERS THEY ARE (founder/429), with
           faces and doors, so the names-only tile would be the same fact said
           twice — and the weaker of the two. It stays only for a read that
           carried `world` without memberships. */
        if (!(p.memberships || []).length)
        w.push({ kind:'world', id:'p-world', label: mine ? 'Your world' : 'Their world', size:'2x2',
          signal: saysWhat(p.world.names || []),
          me: { name: person.name || email },
          places: (p.world.names || []).map(function (n) {
            return { name: n, icon:'place', relation:'member' }; }),
          people: [], hue: hue, visibility:'public' });
      }

      /* RHYTHM — days they were actually here. The widget draws BARS and the
         read gives DATES, so the dates become the last fourteen days as
         present/absent: earned, never gamified, and never a smoothed curve
         invented to look busier than the person was. */
      if (p.rhythm && Array.isArray(p.rhythm.active_days)) {
        var days = {}, i;
        p.rhythm.active_days.forEach(function (d) { days[String(d).slice(0,10)] = 1; });
        var weeks = [];
        for (i = 13; i >= 0; i--) {
          var dt = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
          weeks.push(days[dt] ? 100 : 0);
        }
        w.push({ kind:'rhythm', id:'p-rhythm', label:'Rhythm', size:'2x1',
          weeks: weeks, hue: hue, visibility:'public' });
      }

      /* marks too — presence, not truthiness. A person with no marks yet is a
         person at the start of their world, and the widget saying so is more
         honest than the widget vanishing. */
      if (Array.isArray(p.marks)) {
        w.push({ kind:'marks', id:'p-marks', label:'Marks', size:'2x2',
          signal: saysWhat(p.marks.map(function (m) {
            return m && (m.name || m.center_name || m.label); })),
          marks: p.marks, hue: hue, visibility:'public' });
      }
      if (p.next && (p.next.text || p.next.title)) {
        w.push({ kind:'next', id:'p-next', label:'Next', size:'2x1',
          text: p.next.text || p.next.title, hue: hue, visibility:'public' });
      }

      if (person.followers) w.push({ kind:'count', id:'p-followers', label:'Followers',
        size:'1x1', value: String(person.followers), hue: hue, visibility:'public' });
      if (person.likes) w.push({ kind:'count', id:'p-likes', label:'Liked',
        size:'1x1', value: String(person.likes), hue: hue, visibility:'public' });

      /* ── ONE QUESTION GETS ONE ANSWER ON A PAGE ────────────────────────
         ★ MEASURED 2026-09-06, on a stranger's anonymous view of a real
         profile: the canvas said VISITED · Atlantic City, and eleven lines
         below it the legacy strip said BEEN TO · "Feed Continuity Center ·
         Feed Continuity Center · and 10 more". Same question, same person,
         same screen, two different answers — and nothing on the page told a
         visitor which one was true.

         It happens because BOTH SYSTEMS USE THE SAME VOCABULARY. The legacy
         widget kinds here are `visited · world · rhythm · marks · next ·
         count · links` and the canvas Popit refs are the same words. That is
         not a coincidence to be tidied away — it is the whole point, because
         the canvas is the REPLACEMENT for these. But while both render, every
         kind a person has actually placed comes out twice.

         They disagree because they read different sources. The canvas kinds
         are projections over canonical state (`visited` is the person's own
         `visited` marks). These widgets are fed by the profile payload, which
         for places carries the DISCOVERY index — every Center the person ever
         touched, `kind='touched'` included, which `_person_place_touch` says
         in its own words is never a strand.

         THE CANVAS WINS, because it is the arrangement the person made and it
         is bound to the canonical reader. So a legacy widget is dropped when
         the same kind is already on the canvas. It is not deleted — a person
         who has placed nothing still gets the full default strip, which is
         what keeps this a migration rather than a removal.

         This is the last step of DONE the founder names — "legacy dependency
         removed" — done narrowly and reversibly: per kind, per profile, only
         where the canvas actually answered. Retiring the strip outright is a
         product decision and is not mine to take. */
      var onCanvas = {};
      if (faceOk) {
        ((cvRes.data && cvRes.data.placements) || []).forEach(function (pl) {
          if (pl && pl.kind === 'popit' && pl.ref) {
            onCanvas[String(pl.ref).toLowerCase()] = true;
          }
        });
      }
      w = w.filter(function (it) {
        return !onCanvas[String((it && it.kind) || '').toLowerCase()];
      });

      /* SOMEONE YOU CAN SEE AND CANNOT REACH IS NOT A PROFILE. This surface
         rendered widgets and nothing else — no name, no way to follow, no way
         to say anything. The runtime already carried `is_following` and both
         acts existed; only the affordances were missing.

         The person's OWN profile gets no acts: following yourself and
         messaging yourself are not things. */
      /* EMBEDDED vs ITS OWN SURFACE. My Center already IS a profile shell, so
         calling this inside its Profile tab produced a shell within a shell —
         two banners, two tab bars, the person's name twice. `bare` renders
         just what the person shows; the full shell is for when this surface
         is the whole page. Same function, one honest difference. */
      /* `mine` IS NOW DECIDED AT THE TOP OF THIS FUNCTION — see the note
         there. It used to be computed on this line, and the widgets are built
         fifty lines ABOVE it. */

      if (opts.bare) {
        /* ── BARE MEANS THE CALLER ALREADY DREW THE CANVAS ─────────────────
           `bare` is passed by exactly one caller: My Center's Main tab, which
           mounts the face itself into its own slot and then calls this for the
           profile facts underneath. Mounting again here rendered the person's
           arrangement TWICE — measured, 18 tiles where there are 9, and two
           "Add" and two "Use my Home layout" controls on one page.

           So this branch does not mount. It still COUNTS the face, because the
           emptiness decision below is a claim about a human being and it must
           not be made on the legacy widgets alone. */
        if (!w.length) {
          if (facePlacements) return facePlacements;
          if (!faceOk) return nothing(host,
            'Their profile could not be loaded just now. Nothing has been '
            + 'changed.', 'Could not load');
          return mine
            ? nothing(host,
                'Nothing on your profile yet. What you make and share is what '
                + 'shows here — this is your side of ONEWAY, not a form to '
                + 'fill in.', 'Your profile is empty',
                [{ label: 'Make a post', go: 'lightbulb' }])
            : nothing(host,
                (person.name || email) + ' has not put anything on their '
                + 'profile yet.', 'An empty profile');
        }
        OW.mountProfile(host, applyChoice(w, chose), { relation: opts.relation || 'stranger' });
        return applyChoice(w, chose).length + facePlacements;
      }

      var acts = mk('div', 'ow-prof__acts');

      if (!mine) {
        if (!rel) {
          /* THE GRAPH DID NOT ANSWER. Every act below depends on knowing the
             relationship, and guessing it is exactly the defect being fixed. */
          acts.appendChild(mk('p', 'po-act__why',
            esc('Could not read your relationship with this person, so the '
                + 'actions here are not shown rather than shown wrong.')));
        } else if (rel.blocked) {
          /* YOU BLOCKED THEM. Follow and Message are not the acts on offer;
             the only one that means anything is undoing it. Rendering a Follow
             button here would be offering something the runtime refuses — the
             Join-on-a-Center-you-cannot-join shape. */
          var unb = mk('button', 'po-act', 'Blocked'); unb.type = 'button';
          unb.setAttribute('aria-pressed', 'true');
          unb.setAttribute('data-act', 'on');
          unb.addEventListener('click', function () {
            OW.act(unb, { path: '/api/oneway/graph/block/' + encodeURIComponent(email),
              undoPath: '/api/oneway/graph/block/' + encodeURIComponent(email),
              method: 'DELETE', undoMethod: 'DELETE',
              invalidate: '/api/oneway/graph',
              labels: { on: 'Blocked', off: 'Block' },
              after: function () { if (opts.reload) opts.reload(); } });
          });
          acts.appendChild(unb);
          acts.appendChild(mk('p', 'po-act__why',
            esc('You blocked this person. Unblock to follow or message them.')));
        } else if (rel.can_follow === false) {
          /* THE GRAPH SAYS NO, AND DOES NOT SAY WHY — deliberately. `can_follow`
             folds in "they blocked me" so that no surface has to ask a question
             whose answer would disclose somebody's private decision. This
             renders the refusal without inventing a reason for it. */
          var no = mk('button', 'po-act', 'Cannot follow');
          no.type = 'button'; no.disabled = true;
          no.setAttribute('data-act', 'off');
          acts.appendChild(no);
        } else {
        var isFol = !!rel.following;
        var fol = mk('button', 'po-act', isFol ? 'Following' : 'Follow');
        fol.type = 'button';
        fol.setAttribute('aria-pressed', String(isFol));
        fol.setAttribute('data-act', isFol ? 'on' : 'off');
        /* MUTUAL IS DERIVED BY THE GRAPH, never by this surface comparing two
           booleans — the same rule that keeps `can_follow` honest. */
        if (rel.mutual) fol.setAttribute('title', 'You follow each other');
        fol.addEventListener('click', function () {
          /* THE CANONICAL GRAPH, DIRECTLY (2026-10-01). B had held the button on
             /api/me/follow while that route wrote the graph first and a legacy
             projection second. The projection's readers are gone or read the
             graph first (_following/_followers; /api/me/relationships is served
             by the new backend), and the founder dropped the old dashboard and
             asked for the new backend now — so the one writer is called itself:
             POST to follow, DELETE the same path to undo. */
          var gpath = '/api/oneway/graph/follow/' + encodeURIComponent(email);
          OW.act(fol, { path: gpath, undoPath: gpath, undoMethod: 'DELETE',
            body: {}, invalidate: '/api/',
            labels: { on: 'Following', off: 'Follow' },
            /* 409 AND 503 ARE NEW AND THEY MEAN DIFFERENT THINGS. This route
               previously could not fail — it answered ok:true over an untouched
               graph. Now a block is a 409 and a failed canonical write is a
               503, and collapsing them into one "could not" would tell somebody
               to retry a thing that will never succeed, or give up on a thing
               that would work on the next press. */
            says: { 403: 'this person cannot be followed',
                    404: 'this person is not on ONEWAY',
                    409: 'this person cannot be followed',
                    503: 'that did not save — try again' },
            /* ONLY ON A CONFIRMED WRITE. `after` runs on success, so a refused
               follow leaves the number alone rather than showing a person a
               follower they did not gain. */
            after: function (r, on) {
              bumpStat(fol, 'followers', on ? 1 : -1, 'follower', 'followers');
            } });
        });
        acts.appendChild(fol);
        }

        /* THE REST OF THE ACTS NEED A KNOWN RELATIONSHIP. With none, the
           surface says so once, above, and offers nothing it cannot stand
           behind. Blocked is its own case: messaging somebody you blocked is
           refused by the runtime, so offering it would be a button that exists
           to fail. */
        if (rel && !rel.blocked) {

        /* ── MESSAGE — THE DOOR INTO THE CANONICAL CAPABILITY ────────────
           ★ FOUNDER, 2026-09-01: *"Do not create a second messaging
             architecture in the App. Consume the canonical backend contracts
             already proven."*

           THIS WAS THE OTHER HALF OF THE MESSAGING SEAM, and it is the half
           that mattered more. The Messages page reading a legacy list is a
           rendering problem; this button is the ENTRY POINT, and it posted to
           `/api/conversations {kind:'dm'}` — the legacy writer. So every rule
           the canonical `start` enforces was bypassed at the exact moment it
           applies: the recipient's `dm_from_*` settings, the block check, and
           the first-message hold. A person who had blocked somebody could be
           messaged by them from their own profile page.

           STARTING IS THREE OUTCOMES, NOT TWO. Opened · held as a request ·
           refused by a rule. The middle one is a 200, and treating it as
           success would walk the sender into a conversation that does not
           exist yet; treating it as failure would tell them their message was
           lost when it is waiting to be accepted. `OW.messaging.start` is the
           one reader of that distinction and this asks it. */
        var msg = mk('button', 'po-act', 'Message'); msg.type = 'button';
        msg.addEventListener('click', function () {
          msg.disabled = true; msg.textContent = 'Opening…';
          OW.messaging.start([email]).then(function (out) {
            msg.disabled = false;
            if (out.state === 'open') {
              msg.textContent = 'Message';
              if (out.conversation && opts.onMessage) opts.onMessage(out.conversation);
              return;
            }
            /* A PASSING FAILURE IS NOT A REFUSAL: the button stays a button */
            if (out.state === 'refused' && out.passing) {
              msg.textContent = 'Message';
              if (OW.toast) OW.toast('That did not open. ' + (out.why || 'Try again.'));
              return;
            }
            /* NEITHER OF THESE IS AN ERROR TILE. A held request and a privacy
               refusal are both the system working, and each says a different
               true thing in the place the person pressed. */
            msg.disabled = true;
            msg.setAttribute('data-act', 'off');
            msg.textContent = out.state === 'held' ? 'Request sent' : 'Cannot be reached';
            var line = mk('p', 'po-act__why', esc(out.why || ''));
            if (msg.nextSibling && msg.nextSibling.className === 'po-act__why') {
              msg.parentNode.removeChild(msg.nextSibling);
            }
            acts.appendChild(line);
            /* ── SAY WHO YOU ARE (founder/556) ────────────────────────────
               A request is a name and nothing else unless the sender says
               something; the words ride with it and become the first message
               if they accept. Asked here, once, never required. */
            if (out.state === 'held' && !acts.querySelector('.ow-reqsay')) {
              var say = mk('form', 'ow-reqsay');
              var inp = doc.createElement('input');
              inp.type = 'text'; inp.maxLength = 1000; inp.className = 'ow-reqsay__in';
              inp.placeholder = 'Add a message to your request';
              inp.setAttribute('aria-label', 'A message to send with your request');
              var go = mk('button', 'po-act', 'Send'); go.type = 'submit';
              say.appendChild(inp); say.appendChild(go);
              say.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var words = inp.value.trim(); if (!words) { inp.focus(); return; }
                go.disabled = true;
                OW.messaging.start([email], { first_message: words }).then(function (again) {
                  go.disabled = false;
                  if (again.state === 'held') {
                    say.innerHTML = '';
                    say.appendChild(mk('p', 'po-act__why', esc('Sent with your request. They see it when they decide.')));
                  } else if (again.state === 'open') {
                    if (again.conversation && opts.onMessage) opts.onMessage(again.conversation);
                  } else if (OW.toast) OW.toast(again.why || 'That did not send. Try again.');
                });
              });
              acts.appendChild(say);
            }
          });
        });
        acts.appendChild(msg);

        /* ── BLOCK AND MUTE — THE OTHER MISSING CONSUMER ─────────────────
           ★ FOUNDER, 2026-09-01, on the messaging proof: *"blocked user
             cannot communicate."*

           `/api/oneway/graph/block/{email}` and its DELETE, `mute` and its
           DELETE, and `/graph/between/{email}` all exist, are canonical, and
           had NO CONTROL ANYWHERE IN THE APP. A person could be blocked only
           by somebody who could write an HTTP request — which means the block
           the whole messaging privacy model rests on was unreachable by the
           people it exists for.

           BEHIND `More`, ON PURPOSE. Follow and Message are what a profile is
           for; block and mute are deliberate acts and should take a deliberate
           press, not sit under a thumb beside Follow.

           THE STATE IS READ, NEVER ASSUMED. `between` answers all of it in one
           call — which is the reason it exists, and why this does not stitch
           the answer together from three. */
        var more = mk('button', 'po-act', 'More'); more.type = 'button';
        more.setAttribute('aria-expanded', 'false');
        more.addEventListener('click', function () {
          var open = acts.querySelector('.po-acts__more');
          if (open) { open.remove(); more.setAttribute('aria-expanded', 'false'); return; }
          var row = mk('div', 'po-acts__more');
          acts.appendChild(row);
          more.setAttribute('aria-expanded', 'true');
          /* THE RELATIONSHIP WAS ALREADY READ, once, at the top of this
             surface. Asking `between` a second time on every press was a second
             read of a fact already in hand — and worse, a second READER of it,
             which is how two parts of one screen come to disagree about whether
             somebody is blocked. */
          (function () {
            var st = rel || {};
            [['block', 'Block', 'Blocked', !!st.blocked],
             ['mute', 'Mute', 'Muted', !!st.muted]].forEach(function (t) {
              var kind = t[0], off = t[1], on = t[2], isOn = t[3];
              var b = mk('button', 'po-act', isOn ? on : off); b.type = 'button';
              b.setAttribute('aria-pressed', String(isOn));
              b.setAttribute('data-act', isOn ? 'on' : 'off');
              b.addEventListener('click', function () {
                var next = !isOn;
                b.disabled = true;
                var path = '/api/oneway/graph/' + kind + '/' + encodeURIComponent(email);
                (next ? data.post(path, {}) : data.del(path)).then(function (rr) {
                  b.disabled = false;
                  if (!rr.ok) { b.textContent = 'Could not change that'; return; }
                  isOn = next;
                  b.textContent = isOn ? on : off;
                  b.setAttribute('aria-pressed', String(isOn));
                  b.setAttribute('data-act', isOn ? 'on' : 'off');
                  /* A BLOCK CHANGES WHAT MESSAGING WILL ALLOW, so every read
                     that described the old relationship is now wrong. */
                  data.invalidate('/api/oneway/graph');
                  if (kind === 'block') data.invalidate('/api/oneway/messaging');
                  /* BLOCKING CHANGES THE WHOLE HEADER — Follow and Message stop
                     being offered — so the surface is re-read rather than
                     patched in place. Patching would leave a Follow button
                     beside a person this viewer just blocked. */
                  if (kind === 'block' && opts.reload) opts.reload();
                });
              });
              row.appendChild(b);
            });

            /* ── REPORT — THE PRODUCER FOR A QUEUE THAT HAD NONE ───────────
               `api/oneway/moderation/` serves six routes and the App called
               NONE of them. A person could be reported by nobody, and the
               platform-wide queue built on 2026-09-03 would have had no way to
               receive anything a person actually saw.

               ★ THIS CONTROL EXISTED ONCE AND WAS LOST. It was uncommitted
               working-tree work when lane C committed this file at 16:28 on
               2026-09-03; `git log -S "OW.moderation"` finds it nowhere in
               history. Rebuilt, and committed this time.

               THE REASONS ARE THE SERVER'S. `/moderation/reasons` returns a
               CLOSED list, and this renders that list rather than carrying its
               own copy — a free-text-only report cannot be counted, routed or
               answered at scale, and a second copy of the vocabulary would
               drift the first time a reason was added.

               IT PROMISES ONLY WHAT IS TRUE. The domain guarantees the reporter
               is never named to anyone, so the surface says exactly that and
               nothing more. It does not say the person will be removed, or that
               anybody will look today. */
            var rep = mk('button', 'po-act', 'Report'); rep.type = 'button';
            rep.addEventListener('click', function () {
              if (rep.getAttribute('data-open') === '1') {
                var open = row.querySelector('.ow-report');
                if (open) open.remove();
                rep.setAttribute('data-open', '0');
                return;
              }
              rep.setAttribute('data-open', '1');
              var box = mk('div', 'ow-report');
              row.appendChild(box);
              box.appendChild(mk('p', 'ow-report__q', 'What is wrong here?'));
              var list = mk('div', 'ow-report__list');
              box.appendChild(list);
              list.appendChild(mk('p', 'ow-report__wait', 'Reading the reasons.'));
              data.get('/api/oneway/moderation/reasons').then(function (rr) {
                list.innerHTML = '';
                if (!rr.ok) {
                  /* NO HARDCODED FALLBACK LIST. Inventing reasons here would be
                     a second vocabulary, and the one thing worse than not being
                     able to report is reporting under a reason the platform
                     does not recognise. */
                  list.appendChild(mk('p', 'ow-report__wait',
                    'The reasons could not be read, so this cannot be sent right now.'));
                  return;
                }
                (rr.data.reasons || []).forEach(function (reason) {
                  var r = mk('button', 'po-act po-act--ghost',
                             reason.replace(/_/g, ' '));
                  r.type = 'button';
                  r.addEventListener('click', function () {
                    Array.prototype.forEach.call(list.querySelectorAll('button'),
                      function (x) { x.disabled = true; });
                    data.post('/api/oneway/moderation/report/person/'
                              + encodeURIComponent(email), { reason: reason })
                      .then(function (sr) {
                        box.innerHTML = '';
                        box.appendChild(mk('p', 'ow-report__done', sr.ok
                          ? 'Reported. Nobody is told who reported it.'
                          : esc(sr.error || 'That could not be sent.')));
                      });
                  });
                  list.appendChild(r);
                });
              });
            });
            row.appendChild(rep);
          })();
        });
        acts.appendChild(more);

        }   /* end: relationship known and not blocked */
      }

      var stats = [];
      if (person.followers) stats.push([person.followers,
        person.followers === 1 ? 'follower' : 'followers', 'followers']);
      if (person.following) stats.push([person.following, 'following']);

      /* ══ WHERE THEY BELONG, AND WHAT THEY HAVE MADE (founder/429) ══════
         Every fact from the read this surface already made. A membership row
         carries the Center's name, the person's role in it, and — since
         founder/409 — that Center's picture, shape and hue, so the places
         somebody belongs to are drawn as themselves rather than as a list of
         words. Pressing one opens it. */
      function personPage(pane) {
        var ms = (p.memberships || []).filter(function (m) { return m && m.center_id && m.center_name; });
        if (!ms.length) return null;
        var runs = ms.filter(function (m) { return m.operating; });
        var belongs = ms.filter(function (m) { return !m.operating && m.belongs; });
        var follows = ms.filter(function (m) { return !m.operating && !m.belongs && m.following; });
        var page = mk('div', 'ow-cpage');
        function band(title, rows) {
          if (!rows.length) return;
          var h = mk('div', 'ow-cpage__h');
          h.appendChild(mk('span', 'ow-cpage__ht', title));
          page.appendChild(h);
          var strip = mk('div', 'ow-cpage__faces');
          page.appendChild(strip);
          /* SIX, THEN THE REST ON A PRESS. This cut at twelve and said
             nothing about the others — a person who runs nineteen places saw
             twelve and no sign of seven more (founder/520). */
          var SHOWN = 6;
          rows.slice(0, SHOWN).forEach(chip);
          if (rows.length > SHOWN) {
            var more = mk('button', 'ow-cpage__more', '+' + (rows.length - SHOWN) + ' more'); more.type = 'button';
            more.addEventListener('click', function () { more.remove(); rows.slice(SHOWN).forEach(chip); });
            strip.appendChild(more);
          }
          function chip(m) {
            var b = mk('button', 'ow-cpage__who'); b.type = 'button';
            b.setAttribute('aria-label', 'Open ' + m.center_name);
            var hp = (typeof m.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(m.hue) : null;
            if (hp) { b.style.setProperty('--h', hp[0]); b.style.setProperty('--h2', hp[1] || hp[0]); }
            var f = mk('span', 'ow-cpage__wf');
            var shp = String(m.shape || 'rounded').toLowerCase();
            if (/^(round|rounded|square)$/.test(shp)) f.setAttribute('data-shape', shp);
            var pic = m.picture ? (OW.imageUrl ? OW.imageUrl(m.picture) : m.picture) : '';
            if (pic) {
              var im = doc.createElement('img');
              im.src = pic; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
              f.appendChild(im);
            } else {
              f.appendChild(mk('i', '', esc(OW.initials ? OW.initials(m.center_name) : m.center_name.slice(0, 2).toUpperCase())));
            }
            b.appendChild(f);
            b.appendChild(mk('b', '', esc(m.center_name)));
            if (m.role) b.appendChild(mk('span', '', esc(m.role)));
            b.addEventListener('click', function () {
              try { doc.dispatchEvent(new CustomEvent('ow:enter-center',
                { detail: { id: m.center_id, name: m.center_name } })); } catch (e) {}
            });
            var mo = strip.querySelector('.ow-cpage__more');
            if (mo) strip.insertBefore(b, mo); else strip.appendChild(b);
          }
        }
        band(mine ? 'You run' : 'Runs', runs);
        band(mine ? 'You belong to' : 'Belongs to', belongs);
        band(mine ? 'You follow' : 'Follows', follows);
        if (page.childNodes.length) { pane.appendChild(page); return page; }
        return null;
      }

      profileShell(host, {
        kind: 'person',
        name: person.name || email,
        /* the face they chose, resolved by the API — see `wearWordmark` */
        wordmark: person.wordmark,
        /* PRONOUNS RIDE WITH THE HANDLE, which is where every platform a
           person already uses puts them, and where a reader looks before they
           write the first word about somebody. `location` was ALREADY read
           here and `/api/users/{email}` had never produced it — so this line
           has always been the handle alone and looked deliberate. It is
           produced now, and it has moved to the facts row, where it stands as
           a fact instead of hiding behind a middot. */
        sub: [person.handle ? '@' + person.handle : '', person.pronouns]
               .filter(Boolean).join(' · '),
        bio: person.bio || '',
        /* ★ FOUNDER/442 addendum: *"those types of layouts should be
           universal."* A person's header is the Center's: name, @handle, the
           sentence, THE ONE LINK BAR (their site and their platforms, drawn
           as the platforms' own marks), counts, Follow, Message. The website
           chip and the location fact are gone from the facts row; the site
           is in the bar and the city belongs in the sentence when it
           matters. */
        facts: [],
        links: (function () {
          if (!OW.links) return null;
          var raw = [];
          if (person.website) raw.push({ url: person.website });
          /* the person's own links first (canonical, founder/442), then the
             legacy widget's; an empty list is not an answer */
          var own = (person.links && person.links.length) ? person.links
                  : ((typeof d !== 'undefined' && d && d.links && d.links.length) ? d.links : []);
          own.forEach(function (l) { raw.push(l); });
          return OW.links.bar(raw, []);
        })(),
        banner: style.banner_url || '', logo: person.picture || style.avatar_url || '',
        /* the cut is the person's own — canonical `person.shape` first, the
           legacy style's answer only when the composed read has none (409) */
        avatarShape: person.shape || style.avatar_shape || 'round', hue: hue,
        email: email,
        /* THE NOTE, above their face, where the founder said it lives. `mine`
           is passed as well as the note itself because the person's OWN
           profile is where a note is SET — the field and the note occupy the
           same spot, so setting one is the same gesture as reading one. */
        note: person.note, noteMine: mine,
        stats: stats, acts: acts.children.length ? acts : null,
        tabs: [
          /* ══ POSTS — THE CANONICAL STREAM, NOT SIX WIDGETS ═══════════════
             ★ FOUNDER, 2026-08-31 (founder/352 §4, 354 §2): *"Main content —
               Posts shows everything. No unnecessary separation between text,
               photos, videos."* and *"Profile Popits — use Popits for
               specialized profile collections: Highlights, Playlists,
               Favorites where applicable, pinned content."*

             THE ARCHITECTURE WAS INVERTED. Posts were rendered AS widgets,
             `.slice(0, 6)`, through `OW.widget({kind:'post'})` — so a person
             with forty Posts had six, none of them a `.po-card`, and none with
             a like, a comment, a repost or a save. The QA lane measured it:
             *"closest('[class*=po-],[class*=card]') is null, 0 interactive
             elements in the wrapper."*

             Popits are for the COLLECTIONS. The stream is the stream, and it
             is the SAME stream Home renders — `OW.mountRiver` +
             `OW.mountResponses`, the one interaction path, so a like given on
             a profile is the same like given in the feed. That is the whole
             point of the founder's split: one object, two placements, never
             two renderers.

             AND THE PAYLOAD ALREADY CARRIED THE STATE. `/api/users/{email}`
             returns `actions` and `you` on every Post — the counts and this
             viewer's own answer — so the missing interactions were never a
             backend gap. They were a renderer that threw the fields away. */
          { id: 'posts', label: 'Posts', render: function (pane) {
              /* ── POSTS COME FROM THE CANONICAL BACKEND, A PAGE AT A TIME ──
                 ★ FOUNDER, 2026-09-09: *"have indidvudal posts load whatever
                   optimizes best for loading fast on high connections and fast
                   on garbage cellular data"* and *"need full NEW backend."*

                 This read `p.posts` — the legacy monolith's payload, which
                 ships EVERY post the person has ever written in the same
                 blocking response as their name. Measured on a real account:
                 28,618 bytes total, of which POSTS ARE 27,450 — 95.9%. Nobody
                 sees most of it, everybody waits for all of it, and on bad
                 cellular that is the whole experience of opening a profile.

                 `social/people/{email}/posts` is cursor-paged and already
                 exists; I built the author index behind it. Six posts is
                 4,284 bytes. The rest arrives when somebody asks for it.

                 AND IT NEEDS NO NEW RENDERER. Measured field by field, the
                 author route's items are the SAME shape Home's feed already
                 draws — `/api/oneway/feed/stream` adds only its four ranking
                 debug keys (_rung, _score, _source, _tier) and nothing else
                 differs. So this stays on `OW.riverRows`, the one description
                 of a feed row, exactly as before.

                 THREE ANSWERS, NOT TWO. The old branch said "has not posted
                 yet" whenever the list was empty — which it also is when the
                 read failed. That is a sentence about a person, asserted on
                 the strength of a request that never arrived. A failed read
                 now says so. */
              /* TWO NODES, BECAUSE `mountRiver` TURNS ITS HOST INTO THE RIVER.
                 It sets `po-river` on whatever it is given, so a Load-more
                 button appended to that same node becomes a row of the feed —
                 laid out as a post, between posts. The river gets its own
                 element and the footer sits beside it. */
              var LIMIT = 8;
              var slot = mk('div');
              var river = mk('div');
              var foot = mk('div', 'ow-prof__more');
              slot.appendChild(river); slot.appendChild(foot);
              pane.appendChild(slot);
              var more = null, seen = {}, drawn = 0;

              function page(cursor) {
                var url = '/api/oneway/social/people/'
                        + encodeURIComponent(email) + '/posts?limit=' + LIMIT
                        + (cursor ? '&before=' + encodeURIComponent(cursor) : '');
                return data.get(url).then(function (r) {
                  if (more) { more.remove(); more = null; }
                  if (!r.ok || !r.data) {
                    if (!drawn) nothing(slot,
                      'Their posts could not be loaded just now. Nothing has '
                      + 'been changed.', 'Could not load');
                    return;
                  }
                  var d = r.data;
                  /* the server's own word for "I could not answer" — distinct
                     from an honest empty, and it must not become a claim */
                  if (d.readable === false) {
                    if (!drawn) nothing(slot,
                      'Their posts could not be read just now.', 'Could not load');
                    return;
                  }
                  var rows = d.feed || [];
                  if (!rows.length && !drawn) {
                    return mine
                      ? nothing(slot, 'What you post appears here.',
                                'No posts yet',
                                [{ label: 'Make your first post', go: 'lightbulb' }])
                      : nothing(slot, (person.name || email) + ' has not posted yet.',
                                'No posts yet');
                  }
                  /* A CURSOR CAN TIE, so a repeated id is dropped rather than
                     drawn twice — `before` is inclusive on the canonical pager
                     precisely so composite-cursor ties survive, and the cost of
                     that is that the boundary row can come back. */
                  var fresh = rows.filter(function (row) {
                    var id = (row && row.id) || '';
                    if (!id || seen[id]) return false;
                    seen[id] = 1; return true;
                  });
                  var wrapped = OW.riverRows ? OW.riverRows(fresh) : fresh;
                  OW.mountRiver(river, wrapped, { open: false }); OW.openCardsIn(river);
                  if (OW.mountResponses) {
                    wrapped.forEach(function (it) { OW.mountResponses(river, it); });
                  }
                  /* THE SAME LIVE PATH THE FEED USES, so a count corrected in
                     one place is corrected in both — they are the same
                     elements. Watched per page, for the page just drawn. */
                  if (OW.realtime) {
                    OW.realtime.watch(wrapped.map(function (it) {
                      return ((it && it.post) || it || {}).id || ''; }).filter(Boolean));
                  }
                  drawn += wrapped.length;
                  /* A SHORT PAGE ENDS THE WALK. The canonical pager only sets
                     `next_cursor` on a full page, so its absence is the end of
                     their work — a different fact from "we stopped at eight",
                     which is the only thing the legacy payload could express. */
                  if (d.next_cursor) {
                    more = mk('button', 'po-act po-act--ghost', 'Load more');
                    more.type = 'button';
                    more.addEventListener('click', function () {
                      more.disabled = true;
                      more.textContent = 'Loading';
                      page(d.next_cursor);
                    });
                    foot.appendChild(more);
                  }
                });
              }
              page('');
            } },
          { id: 'shows', label: 'Profile', render: function (pane) {
              /* ── A PERSON IS A PAGE TOO (founder/429) ──────────────────
                 A Center became a real page — open now, what is on, what you
                 can book, how to reach it. A person was still a canvas and a
                 row of widgets, and the most informative thing this platform
                 knows about somebody was drawn as a tile of NAMES: the places
                 they run, belong to and follow, each of which is a real
                 Center with a face and a door.

                 Same rule as the Center's page: a section only when it has
                 something to say, and nothing said twice — the `world` widget
                 that listed those names is dropped where this draws them. */
              personPage(pane);
              /* ── EACH HALF GETS ITS OWN CONTAINER ──────────────────────
                 `OW.mountProfile` turns the node it is handed into a
                 `.po-grid`. Mounting the canvas into that same node made the
                 canvas a GRID ITEM: measured on a stranger's view of a real
                 profile, the canvas came out 117px wide inside a 280px page
                 and every Popit rendered 19px across — squeezed into a
                 column, overlapping, unreadable. The founder's one universal
                 plane held perfectly; it was being asked to fill a cell.

                 My Center's Main tab already split its two halves, and its
                 comment already warns about this exact node being shared. The
                 stranger-facing tab never got the same treatment because it
                 never had a canvas until now. */
              var faceSlot = mk('div');
              var widgetSlot = mk('div');
              pane.appendChild(faceSlot);
              pane.appendChild(widgetSlot);
              var shownFace = mountFace(faceSlot);
              if (!w.length) {
                if (shownFace) return facePlacements;
                if (!faceOk) return nothing(widgetSlot,
                  'Their profile could not be loaded just now. Nothing has '
                  + 'been changed.', 'Could not load');
                pane = widgetSlot;
                /* same correction as the bare branch above — the owner is
                   told about their own profile in the second person, and is
                   given the one thing that fills it */
                return mine
                  ? nothing(pane,
                      'Nothing on your profile yet. What you make and share '
                      + 'is what shows here.', 'Your profile is empty',
                      [{ label: 'Make a post', go: 'lightbulb' }])
                  : nothing(pane,
                      (person.name || email) + ' has not put anything on '
                      + 'their profile yet.', 'An empty profile');
              }
              OW.mountProfile(widgetSlot, applyChoice(w, chose),
                              { relation: opts.relation || 'stranger' });
            } }
        ].concat((function () {
          /* OPPORTUNITIES (founder/682): what this person offers, read from the profile's
             `offering`; the tab is here only when something is open, or it is yours (S18) */
          var _pd = (typeof _d !== 'undefined' && _d) || {};
          var _t = OW.opps && OW.opps.tabEntry && OW.opps.tabEntry(mine ? 'me' : (_pd.ref || ''), _pd.offering);
          return _t ? [_t] : [];
        })())
      });
      return w.length;
    });
  };

  /* 4.2c — MY CENTER. The person's own place, opened from the inside.

     There is NO profile object — the Center IS the profile (`/api/me/center`
     says so in its own words), so this is the profile shell pointed at
     yourself, with the tabs a person needs when it is theirs: what they show,
     the world they belong to, their galleries, and how it looks.

     THE WORLD TAB IS THE POINT. It was answering "0 Centers" to the person who
     runs one, because /api/me/relationships composed memberships, follows and
     commitments but not the ROLES a person holds. Working is a relationship —
     canon's one relationship model has always listed it beside joining and
     booking — and the App is the front door, so being blind to a Center you
     operate was the worst possible place for that gap. Fixed at the source;
     this reads it. Entitlement is still decided by /api/os/access alone, so
     seeing your Center here grants nothing. */
  /* ═══ 4.2c-b · THE PROFILE BRAIN IN ITS OWN WORDS ═══════════════════════
     The Understanding pane already shows the GRAPH — what a person belongs to,
     made, and who follows them back. Five endpoints that actually SPEAK were
     still dark: narrative · creation-assist · intelligence · summary · ask.

     WHY THESE AND NOT A NEW SURFACE. FOUNDATION.md gives every Profile Center
     a Brain, and this pane IS that Brain. A second place to meet it would be
     the second-implementation defect the whole platform is organised against.
     So it extends: counts, then the Brain's own sentence, then the question.

     AND THESE ARE SAFE TO SHOW BECAUSE THE RUNTIME REFUSES TO INVENT — checked
     by calling it on a brand-new account, not assumed:
       /narrative → "ONEWAY is just getting to know you." + an observation
                    telling them what would change that
       /ask       → "Not enough information yet. Connect with a Center or post
                     in a community to let Brain build your graph."
     That is INTELLIGENCE.md's central law already holding in the runtime —
     unknown is better than invented — which means the honest empty state is
     the SERVER'S sentence, not one this file makes up. Nothing here writes
     copy on the Brain's behalf. */
  /* ═══ 4.2c-c · WHAT IS STRONGEST IN YOUR WORLD ═══════════════════════════
     `/api/brain/profile/intelligence` — the last substantive dark read on the
     consumer side of the Brain. The narrative says what Brain NOTICED; this
     says what is STRONGEST, with the strength it measured and which way it is
     moving. Both are the same Brain; neither invents.

     IT DEDUPES, AND THAT IS NOT COSMETIC. The graph holds one community as TWO
     nodes — `center:__oneway__` and `community:comm_oneway_food-dining` —
     both named "Food & Dining", both strength 3.0, both pointing at the same
     person. Measured, not assumed. Rendering the payload as given shows a
     person the same place twice and tells them their world is twice as
     connected as it is, which is a quiet way of inventing. One row per NAME,
     strongest kept.

     Trend is shown only when the Brain actually moved it. `trend_pct: 100` on a
     first-ever connection is arithmetic, not a trend, so it is not dressed up
     as one — a first connection says "new", which is the true thing. */
  /* 2026-10-01 — THE NEW BACKEND (oneway/people/brain.py) COUNTS ACTS. The
     legacy read ranked a profile graph that held 20 edges for 13 people on the
     whole database, so almost everyone's "strongest" was empty however much
     they had done. Each row now says what it was counted FROM (`evidence`:
     "a member · 5 posts · going to 1 event") and which way the week went
     (`moving`: new · rising · falling · steady, measured against the week
     before) — and it OPENS, a place to its Center and a person to them. */
  function brainStrongest(pane, onPick) {
    var wrap = mk('div');
    pane.appendChild(wrap);
    return data.get('/api/oneway/people/me/brain/intelligence').then(function (r) {
      if (!r.ok) return 0;                    /* never costs the pane above */
      var d = r.data || {};
      var seen = {}, rows = [];
      (d.spotlights || []).forEach(function (x) {
        var name = (x && x.name) || '';
        if (!name) return;
        var prev = seen[name];
        if (prev && (prev.strength || 0) >= (x.strength || 0)) return;
        if (prev) { rows = rows.filter(function (y) { return y.name !== name; }); }
        seen[name] = x; rows.push(x);
      });
      if (!rows.length) return 0;             /* nothing strong yet is a true answer */

      wrap.appendChild(mk('p', 'ow-cust__lbl', 'What is strongest in your world'));
      var list = mk('div');
      var words = { rising: 'more this week', falling: 'quieter this week', 'new': 'new this week' };
      factList(list, rows.slice(0, 8).map(function (x, i) {
        return { id: 'bi-' + i,
                 value: x.name,
                 label: [x.evidence || '', words[x.moving] || ''].filter(Boolean).join(' · '),
                 icon: x.type === 'person' ? 'people' : 'place',
                 /* pressing opens it (onPick) — `open` would draw the row
                    unfolded, which is a different thing */
                 opens: x.opens || '', nodeId: x.id || '' };
      }), '', onPick || null);
      wrap.appendChild(list);
      return rows.length;
    }).catch(function () { return 0; });
  }

  function brainVoice(pane, nar) {
    if (!nar || !nar.ok) return;                  /* never costs the counts */
    var d = nar.data || {};
    var line = (d.summary || '').trim();
    var obs = d.observations || [];
    if (!line && !obs.length) return;
    if (line) pane.appendChild(mk('p', 'ow-cust__lbl', esc(line)));
    if (obs.length) {
      var list = mk('div');
      OW.mountList(list, obs.slice(0, 6).map(function (o, i) {
        return { id: 'bn-' + i,
                 label: o.text || '',
                 signal: o.kind && o.kind !== 'start' ? String(o.kind).replace(/_/g, ' ') : '',
                 icon: 'spark' };
      }), { open: false });
      pane.appendChild(list);
    }
  }

  /* ASKING YOUR OWN BRAIN. Conversation is the Brain's PRIMARY expression
     (BRAIN_LAWS) and a person could not address theirs at all. The answer is
     printed exactly as the runtime returns it — including "not enough
     information yet", which is the truthful answer and must never be dressed
     up into something that sounds like understanding. */
  function brainAsk(pane) {
    var box = mk('div', 'ow-composer');
    var ta = doc.createElement('textarea');
    ta.rows = 1;
    ta.placeholder = 'Ask your Brain about your world';
    ta.setAttribute('aria-label', 'Ask your Brain');
    var go = mk('button', 'ow-send',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 8 6 8z"/></svg>');
    go.type = 'button'; go.disabled = true;
    go.setAttribute('aria-label', 'Ask');
    var out = mk('div');
    ta.addEventListener('input', function () { go.disabled = !ta.value.trim(); });
    function ask() {
      var q = ta.value.trim();
      if (!q) return;
      go.disabled = true; out.innerHTML = '';
      out.appendChild(mk('p', 'ow-note show', 'Thinking…'));
      data.post('/api/oneway/people/me/brain/ask', { question: q }).then(function (r) {
        out.innerHTML = '';
        var d = (r && r.data) || {};
        if (!r.ok || !d.answer) {
          out.appendChild(mk('p', 'ow-note show ow-note--bad',
            esc((d.error || (r && r.error)) || 'no answer came back')));
        } else {
          /* the answer's own paragraphs, kept — escaped first, then its line
             breaks drawn as breaks (a list of places read as one run-on line) */
          out.appendChild(mk('p', 'ow-note show', esc(d.answer).replace(/\n+/g, '<br>')));
        }
        go.disabled = !ta.value.trim();
      });
    }
    go.addEventListener('click', ask);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
    });
    box.appendChild(ta); box.appendChild(go);
    pane.appendChild(box);
    pane.appendChild(out);
  }

  /* ══ THE DOOR TO THE OS ═════════════════════════════════════════════════
     ★ FOUNDER, 2026-08-31: *the App must not become a second Center creator;
       it provides the BRIDGE — "Create your Center" launches the free OS
       Center-founding flow. That preserves the distinction rather than
       creating two competing Center creators.*

     THE OS SIDE WAS BUILT AND THE APP HAD NO DOOR. `frontend/os-next/os.js`
     was given hash routing FOR THIS — its own comment says so: *"For that door
     to exist, this side has to be addressable… the App had nowhere to point."*
     `#found` is the intent, deliberately separate from "has no Center", so
     somebody who already operates one can found a second.

     ── AND I MEASURED THE WRONG STRING FIRST. CORRECTED 2026-09-02. ──────
     I grepped `frontend/app/**` and `oneway-app.html` for `oneway-os.html`,
     found nothing, and concluded "the App has no door to the OS. A bridge with
     one end." The grep was accurate and the conclusion was wrong: there IS a
     door — `.ow-top__os` in the header, `aria-label="Enter ONEWAY OS"` — and it
     points at **`/dashboard.html`**, the LEGACY OS surface. Searching for the
     replacement's filename could not find a link to the legacy one. Absence of
     the string I chose is not absence of the thing I was looking for.

     WHAT THAT ACTUALLY MEANS IS SHARPER THAN WHAT I CLAIMED. The App's OS door
     leads to the legacy OS, while the replacement OS — the one given hash
     routing expressly so the App could point at it — is reached from the App by
     nothing. That is the production-entrypoint divergence the founder found on
     2026-09-02, one layer up in the interface: the surface a person actually
     reaches is the legacy one, while the hardened replacement sits unreferenced.

     WHICH OS IS CANONICAL IS NOT THIS FILE'S DECISION and the header link is
     not repointed here. `#found` below is different: the founder ruled
     specifically that "Create your Center" launches the OS founding flow, and
     `os-next` built `#found` for that ruling, so this door has a stated target.

     The header door also decides visibility from `/api/me/relationships` and a
     `.operating` flag, while the canonical answer is `/api/oneway/centers/mine`
     → `any_operator`. Two readers of "may this person operate anything" — worth
     collapsing, and worth doing once, by whoever owns that surface.

     ONE READ DECIDES BOTH DOORS. `/api/oneway/centers/mine` answers
     `{places, any_operator}` — it is the runtime's own answer to "may this
     person operate anything", derived from MEMBERSHIP rather than a flag, so a
     Center handed over or revoked changes this without anything being migrated.

     AND IT IS A LINK, NOT A FETCH. The OS is a different surface with its own
     shell; the App's job here is to point at it and get out of the way. Doing
     anything else is how a second Center creator gets built by accident. */
  var OS_SURFACE = '/oneway-os.html';

  function osDoors(acts, opts) {
    opts = opts || {};
    /* THE FOUNDING DOOR IS UNCONDITIONAL. It does not wait for the read: a
       person with no Centers and a person with five both reach it the same
       way, and gating it on a fetch would mean the primary act of the whole
       OS blinks into existence a second after the page settles. */
    var found = mk('a', 'po-act po-act--go', 'Create your Center');
    found.href = OS_SURFACE + '#found';
    found.setAttribute('data-door', 'os');
    acts.appendChild(found);

    return data.get('/api/oneway/centers/mine', { fresh: true }).then(function (r) {
      /* UNKNOWN IS NOT "NONE" (founder/350). A failed read must not render the
         screen of somebody who operates nothing — that would quietly hide a
         person's own Centers behind a network blip. It says what happened. */
      if (!r.ok) {
        if (r.status === 401) return 0;   /* signed out: the door alone is right */
        acts.appendChild(mk('p', 'po-act__why',
          esc('Could not read which Centers you operate.')));
        return 0;
      }
      var d = r.data || {};
      var places = d.places || [];
      if (!d.any_operator || !places.length) return 0;

      /* ── ONE DOOR, NOT ONE PER CENTER — AND I BUILT IT THE WRONG WAY FIRST.
         My first cut rendered an anchor per Center at `#center/<id>`. Two things
         were wrong with it and both matter.

         THE FRAGMENT WAS A LIE. `readHash()` in os-next routes exactly ONE
         hash — `found` — and returns false for everything else. So every one of
         those links would have landed on the OS's default view while claiming
         in the address bar to be somewhere specific. Wiring to a route that
         does not exist is inventing a bridge, which is the thing the founder
         ruled against in the same sentence that asked for this door.

         AND THE OS ALREADY HAS THIS SCREEN. `viewHome()` lists every Center the
         person operates, with the role, the tier and an ENTER on each — it is
         the operator's own hub and the founder's own question, *"which Center
         am I operating?"* Rebuilding that list in the App is the second version
         of the Center he has ruled against twice.

         So: ONE door, and the names are CONTEXT rather than controls. A person
         should know what is behind a door before they walk through it; they
         should not be given four doors into one room. */
      var open_ = mk('a', 'po-act', 'Open your OS');
      open_.href = OS_SURFACE;
      open_.setAttribute('data-door', 'os');
      acts.appendChild(open_);

      /* ── NO SENTENCE UNDER THE DOOR (founder/445, S17; founder/471 §8) ────
         This carried "You operate N Centers: A · B · C." under "Open your OS"
         — a helper line ONEWAY wrote on a person's own page, and on every
         test account it read "You operate 19 Centers, all called Feed
         Continuity Center", which is a fixture speaking on a profile. The OS's
         own hub (`viewHome()`) lists every Center the person operates, with
         the role and an ENTER on each; that is where the names belong. The
         profile's rows now run picture → name → handle → bar → counts → acts
         → tabs with nothing ONEWAY added between them. */
      return places.length;
    });
  }

  OW.live.myCenter = function (host, email, opts) {
    /* MY CENTER IS THE PERSON THEMSELVES — there is no version of it for
       somebody who has not said who they are. Note this gates the OWN-center
       read only: another person's public profile still opens for a stranger,
       which is the whole point of a public profile. */
    if (!email && !signedIn()) {
      OW.door(host, 'Me');            /* founder, 2026-08-25 — renamed */
      return Promise.resolve(0);
    }

    opts = opts || {};
    if (!email) {
      host.className = ''; host.classList.add('po-grid'); host.innerHTML = '';
      stateTile(host, 'refused', 'Your Center',
        'You are not signed in, so there is nobody to show.', '4x1');
      return Promise.resolve(0);
    }
    loading(host, 3);
    /* MY CENTER IS A PROFILE — YOUR OWN. It read the legacy monolith handler
       for the same fields the profile surface did, so it inherited the same
       defect and had to be fixed twice every time. One composed read, the same
       one the profile uses, shaped into the envelope this renderer already
       expects. `include_private` is not a parameter anywhere: the door decides
       what a viewer may see from the session, and here the viewer IS the
       subject. */
    /* /api/me/social WAS READ FOR ONE NUMBER. Measured 2026-09-13: the only
       field this surface took from it was `following.length`, for the stats
       row — and the composed profile read on the line above already carries
       `counts.following`, the same number from the same graph. A legacy read
       whose one consumed field is on the canonical door is a legacy read that
       should not exist. Gone; the count comes from the composed read. */
    return Promise.all([
      data.get('/api/oneway/people/' + encodeURIComponent(email) + '/profile'),
      data.get('/api/me/relationships')
    ]).then(function (res) {
      var _mr = res[0], rel = res[1];
      if (!_mr.ok) { refused(host, _mr, 'Your Center'); return 0; }
      var _md = _mr.data || {}, _mp = _md.person || {}, _mc = _md.counts || {};
      var _msf = _md.surfaces || {};
      var u = { ok: true, data: {
        user: {
          email: _mp.email || email, name: _mp.name || '',
          username: _mp.handle || '', handle: _mp.handle || '',
          picture: _mp.picture || '', shape: _mp.shape || '',
          hue: _mp.hue, hue_chosen: !!_mp.hue_chosen,
          style: _md.style || {},
          pronouns: _mp.pronouns, bio: _mp.bio,
          location: _mp.location, website: _mp.website, note: _mp.note,
          wordmark: _mp.wordmark,
          links: (_mp.links && _mp.links.length) ? _mp.links : (_md.links || []),
          followers: _mc.followers, following: _mc.following, likes: _mc.likes,
          is_me: true
        },
        posts: _md.posts || [], posts_cursor: _md.posts_cursor || '',
        marks: _msf.marks, next: _msf.next, rhythm: _msf.rhythm,
        visited: _msf.visited, world: _msf.world,
        pinned: _md.pinned || [], memberships: _md.memberships || []
      } };
      var p = u.data || {}, person = p.user || {}, style = person.style || {};

      /* MEASURED 2026-09-14 as a brand-new person: the world wore her derived
         green (auth/me hue_angle 128) and every tile on her own page wore
         163,92,255 — the platform purple `style.accent_hue` answers for
         anyone who never chose. A colour is believed only when `hue_chosen`
         says it was chosen; otherwise the tiles inherit the world, which on
         this page is already hers. */
      var _angle = person.hue_chosen
        ? (person.hue != null ? person.hue : style.accent_hue) : null;
      var theirs = (_angle != null) ? OW.hue.fromAngle(_angle) : null;
      var hue = theirs ? { h1: theirs[0], h2: theirs[1] } : null;

      /* ── YOUR OWN PAGE DOES NOT RE-COLOUR THE WORLD; IT ALREADY IS IT ────
         ★ FOUNDER, 2026-09-02: *"why does home and everything else not sync to
           what the signed in users hue is"*.

         MEASURED, walking the whole dock as a signed-in person whose hue angle
         is 34:

             home        255,184,92   ✓ theirs
             discovery   255,184,92   ✓
             lightbulb   255,184,92   ✓
             messages    255,184,92   ✓
             center      163,92,255   ✗ THE PLATFORM DEFAULT
             home        255,184,92   ✓ (recovered)

         Every destination carried their light except the one page that IS
         them. This line was why: it re-derived a hue from `style.accent_hue`
         on `/api/users/{email}`, which answers **266 — the platform default —
         for anybody who has never picked a colour**, in the same field and the
         same shape as a real decision.

         THAT EXACT TRAP IS ALREADY DOCUMENTED, twenty lines inside
         `OW.live.identity`, which was fixed for it and now asks `/api/auth/me`
         whether the colour was CHOSEN. This surface was never taught the same
         thing, so the App had two readers of one fact and only one of them
         knew the fact was unreliable — the same shape as the follow
         split-brain, in a smaller place.

         AND THE FIX IS NOT A SECOND `hue_chosen` CHECK HERE. That would be a
         third reader. The world was already bound to this person's own light
         at sign-in, by the one function whose job that is; a page that IS the
         person has nothing to add to it, and `go()` deliberately skips its
         reset for `center` so nothing clears it either. So this simply stops
         asserting a colour on their behalf.

         `hue` is still computed — the shell below uses it to tint their own
         widgets, which is a different act from re-lighting the world. */

      var places = (rel.ok && rel.data && rel.data.relationships) || [];

      /* counts only where there is something to count */
      var stats = [];
      if (places.length) stats.push([places.length, places.length === 1 ? 'place' : 'places']);
      if (person.following) stats.push([person.following, 'following']);
      if (person.followers) stats.push([person.followers,
        person.followers === 1 ? 'follower' : 'followers']);

      /* ══ YOUR PLANS (founder/429) ═══════════════════════════════════════
         The lifestyle half of a person's own page: what they have booked and
         what they carry. It uses the SAME material a Center's page uses, so
         one design language answers "what is this place" and "what have I
         got on".

         A plan is a booking the reservation engine confirmed, read off the
         relationships this profile already carries — no scan, no second read.
         The known limit is stated where it bites: `identity.store.commitments`
         finds a booking through the Places a person is CONNECTED to, so a
         booking at a place they neither follow nor belong to is not found.
         That wants a person-indexed reservation write (asked of B); until it
         lands, this section is honest about what it can see rather than
         claiming to be everything. */
      function plansSection(pane, memberships, who) {
        var rows = [];
        (memberships || []).forEach(function (m) {
          (m.commitments || []).forEach(function (c) {
            if (!c || !c.start) return;
            if (String(c.status || '').toLowerCase() === 'cancelled') return;
            rows.push({ center_id: m.center_id, center: m.center_name || m.center_id,
                        kind: c.kind || 'reservation', start: c.start,
                        status: c.status || '', hue: m.hue });
          });
        });
        rows.sort(function (a2, b2) { return String(a2.start).localeCompare(String(b2.start)); });
        var now = new Date();
        var soon = rows.filter(function (r) {
          var d = new Date(r.start); return !isNaN(d) && d >= now;
        });
        if (!soon.length) return null;

        var page = mk('div', 'ow-cpage');
        var h = mk('div', 'ow-cpage__h');
        h.appendChild(mk('span', 'ow-cpage__ht', 'What you have coming'));
        /* the whole of it is the Calendar (founder/520) */
        var allCal = mk('button', 'ow-cpage__all', 'Calendar'); allCal.type = 'button';
        allCal.addEventListener('click', function () {
          try { doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: 'calendar' } })); } catch (e) {}
        });
        h.appendChild(allCal);
        page.appendChild(h);
        var body = mk('div', 'ow-cpage__b');
        page.appendChild(body);
        var WORD = { reservation: 'Booked', booking: 'Booked', rsvp: 'Going' };
        soon.slice(0, 6).forEach(function (r) {
          var d = new Date(r.start);
          var when = '';
          try {
            when = new Intl.DateTimeFormat(undefined,
              { weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit' }).format(d);
          } catch (e) { when = r.start; }
          var days = Math.round((d - now) / 864e5);
          var soonWord = days <= 0 ? 'today' : (days === 1 ? 'tomorrow'
            : (days < 7 ? ('in ' + days + ' days') : ''));
          var one = mk('button', 'ow-cpage__ev'); one.type = 'button';
          one.appendChild(mk('b', '', esc((WORD[r.kind] || 'Booked') + ' \u00b7 ' + r.center)));
          one.appendChild(mk('span', '', esc([when, soonWord, r.status && r.status !== 'confirmed' ? r.status : '']
            .filter(Boolean).join(' \u00b7 '))));
          if (r.center_id) {
            one.addEventListener('click', function () {
              try { doc.dispatchEvent(new CustomEvent('ow:enter-center',
                { detail: { id: r.center_id, name: r.center } })); } catch (e) {}
            });
          }
          body.appendChild(one);
        });
        pane.insertBefore(page, pane.firstChild);

        /* AND THE CARDS THEY CARRY — one read, drawn only when there is one
           (founder/422's wallet; a person with no card sees no heading). */
        data.get('/api/oneway/me/rewards').then(function (rr) {
          var cards = ((rr && rr.ok && rr.data && rr.data.memberships) || [])
            .filter(function (c) { return c && (c.center_name || c.center_id); });
          if (!cards.length) return;
          var wh = mk('div', 'ow-cpage__h');
          wh.appendChild(mk('span', 'ow-cpage__ht', 'What you carry'));
          page.appendChild(wh);
          var wb = mk('div', 'ow-cpage__b');
          page.appendChild(wb);
          cards.slice(0, 6).forEach(function (c) {
            var one = mk('button', 'ow-cpage__ev'); one.type = 'button';
            one.appendChild(mk('b', '', esc(c.center_name || c.center_id)));
            var bits = [];
            if (c.tier) bits.push(String(c.tier));
            if (c.member_no) bits.push(String(c.member_no));
            if (c.as_of && c.book_of_record) bits.push('as reported by ' + c.book_of_record);
            one.appendChild(mk('span', '', esc(bits.join(' \u00b7 '))));
            if (c.center_id) one.addEventListener('click', function () {
              try { doc.dispatchEvent(new CustomEvent('ow:enter-center',
                { detail: { id: c.center_id, name: c.center_name || '' } })); } catch (e) {}
            });
            wb.appendChild(one);
          });
        }).catch(function () {});
        return page;
      }

      var tabs = [
        /* ── MAIN IS THEIR HOME. ONE TAB, NOT TWO. ────────────────────────
           ★ FOUNDER, 2026-08-26: *"NO SEPARATE ONE FOR POPITS AND PERSON"* —
           resolving *"main and the block you have for the Popit should be
           exactly the same."*

           This shipped as two tabs, Main and Home, and that was the mistake:
           a person's Popits ARE their main surface, not a second view of them.
           Splitting them asked a visitor to choose between "who they are" and
           "what they built", which is not a choice a profile should offer —
           and it made the first tab a header with nothing under it.

           The canvas leads because it is the thing they arranged; the profile
           facts follow underneath. `OW.canvas` is the same renderer Home uses,
           so this is one Home in two places rather than two Homes. */
        { id: 'profile', label: 'Main', icon: TAB_ICON.main, render: function (pane) {
            /* EACH HALF GETS ITS OWN CONTAINER. `OW.live.profile` clears the
               host it is handed — appending the canvas to the same node first
               meant the profile render wiped it, and the tab came back with no
               Popits at all while looking like it had worked. */
            var canvasSlot = mk('div', 'ow-prof__canvas');
            var profileSlot = mk('div');
            pane.appendChild(canvasSlot);
            pane.appendChild(profileSlot);
            /* ── YOUR OWN PAGE SHOWS WHAT OTHER PEOPLE SEE ─────────────
               ★ FOUNDER RULING, 2026-09-04: the public face is
                 `profile:{email}`.

               This mounted `home:` + email. `may_view` allows a home to be
               read only by its owner, so this tab showed the owner twelve
               Popits and every visitor to the same person zero — and the
               owner had no way to discover that, because the one view that
               would have told them was the view that lied.

               The 2026-08-26 ruling this replaces — *"NO SEPARATE ONE FOR
               POPITS AND PERSON"* — was about not splitting a person into two
               TABS, and it still holds: there is one Main tab and the canvas
               still leads it. What changes is which surface it reads, so that
               "my page" and "my page as others see it" are the same page.

               A profile that has never been arranged offers to bring the
               Home layout across (canvas.js, the empty state). That keeps the
               standing rule — nothing publishes itself — while giving the
               owner one tap to make their arrangement public. */
            if (OW.canvas && OW.canvas.mount) {
              OW.canvas.mount(canvasSlot, 'profile:' + email);
            }
            /* ── WHAT YOU HAVE COMING ─────────────────────────────────────
               ★ FOUNDER/429: real informational depth, *"a lifestyle app"*.
               A person's own page has never said the one thing a lifestyle
               app exists to hold: what they have booked and where they are
               going. The platform has recorded it all along — every
               relationship this person has carries its `commitments`, and the
               wallet carries every card — and no surface read either.

               ONE READ, THE ONE ALREADY MADE. The profile read carries the
               memberships and their commitments; the wallet is a second small
               read and is drawn only when a card exists. Nothing here is
               composed: a plan is a booking the engine confirmed.

               YOURS ONLY. This is the self pane; a stranger's profile has no
               such section, because where somebody is going is not public. */
            plansSection(pane, (p.memberships || []), (p.user || {}));
            /* bare: this pane already lives inside My Center's own shell */
            return OW.live.profile(profileSlot, email, { relation: 'self', bare: true });
          } },

        /* WHERE THEY BELONG. Operating leads, because a place you run is the
           strongest tie there is; then membership, then following. The line
           the runtime already composed says which it is — nothing is
           re-derived here. */

        /* YOUR OWN GALLERIES, INCLUDING THE PRIVATE ONES. This read `rings`,
           which is the PUBLIC projection of a profile — right for a stranger
           looking at you, wrong for you looking at yourself. A private gallery
           you cannot see in your own Center may as well not exist, and the
           runtime was answering correctly the whole time: /api/me/galleries is
           the owner's read and it had them. The App was asking the stranger's
           question about itself. */
        /* ══ POSTS — EVERYTHING, AS THE CANONICAL STREAM ═══════════════════
           ★ FOUNDER, 2026-08-31 (founder/352 §4, 354 §2): *"Main content —
             Posts shows everything. No unnecessary separation between text,
             photos, videos."*
           ★ FOUNDER (founder/356): *"one type of post across all forms, users
             dont choose it happens autoamtically."*

           WHAT THIS TAB USED TO BE: it read `/api/me/galleries` and rendered
           GALLERIES as profile widgets. A tab labelled "Posts" that showed a
           different object, capped at 18, as tiles with no interactions. The QA
           lane measured the consequence — *"the body renders under a POSTED
           heading but is NOT a .po-card; 0 interactive elements"*.

           NOW IT IS THE STREAM, and it is the SAME stream Home renders:
           `OW.mountRiver` + `OW.mountResponses`, the one interaction path. A
           like given on a profile is the same like given in the feed, because
           it is the same element and the same delegated handler. That is what
           makes "one Post, many placements" true rather than aspirational.

           GALLERIES DID NOT VANISH — a Gallery is its own object (GALLERY ->
           MEDIA -> FEED) and it belongs with the profile COLLECTIONS, which is
           what the founder reserved Popits for. It is on the Main tab with the
           rest of a person's world, not masquerading as their Posts. */
        { id: 'posts', label: 'Posts', icon: TAB_ICON.posts, render: function (pane) {
            /* ── THE SAME WALK THE OTHER PROFILE ALREADY MAKES ─────────────
               This read LEGACY /api/users/{email} — all fifty posts in one
               answer, 27KB of a 28KB profile — and never looked at `ur.ok`,
               so a failed read rendered "No Posts yet · Make something" on a
               person's OWN page about their OWN work. B's audit found the
               second; the first is the surface-by-surface rule: the other
               person's Posts tab was cut over to the canonical cursor-paged
               author route weeks ago, with three answers and a Load more, and
               this one was left behind on the old door. Same reader now, for
               both — one description of "somebody's posts", and the legacy
               read is gone from this surface. */
            var LIMIT = 8;
            var slot = mk('div'), river = mk('div'), foot = mk('div', 'ow-prof__more');
            slot.appendChild(river); slot.appendChild(foot);
            pane.appendChild(slot);
            var more = null, seen = {}, drawn = 0;
            function page(cursor) {
              var url = '/api/oneway/social/people/' + encodeURIComponent(email || '')
                      + '/posts?limit=' + LIMIT
                      + (cursor ? '&before=' + encodeURIComponent(cursor) : '');
              return data.get(url, cursor ? {} : { fresh: true }).then(function (r) {
                if (more) { more.remove(); more = null; }
                if (!r.ok || !r.data) {
                  if (!drawn) nothing(slot,
                    'Your posts could not be loaded just now. Nothing has been changed.',
                    'Could not load');
                  return;
                }
                var d = r.data;
                if (d.readable === false) {
                  if (!drawn) nothing(slot, 'Your posts could not be read just now.', 'Could not load');
                  return;
                }
                var rows = d.feed || [];
                if (!rows.length && !drawn) {
                  return nothing(slot,
                    'Everything you post shows here — words, photographs and '
                    + 'video, all in one place.', 'No Posts yet',
                    [{ label: 'Make a post', go: 'lightbulb' }]);
                }
                var fresh = rows.filter(function (row) {
                  var id = (row && row.id) || '';
                  if (!id || seen[id]) return false;
                  seen[id] = 1; return true;
                });
                var wrapped = OW.riverRows ? OW.riverRows(fresh) : fresh;
                OW.mountRiver(river, wrapped, { open: false }); OW.openCardsIn(river);
                if (OW.mountResponses) {
                  wrapped.forEach(function (it) { OW.mountResponses(river, it); });
                }
                if (OW.realtime) {
                  OW.realtime.watch(wrapped.map(function (it) {
                    return ((it && it.post) || it || {}).id || ''; }).filter(Boolean));
                }
                drawn += wrapped.length;
                if (d.next_cursor) {
                  more = mk('button', 'po-act po-act--ghost', 'Load more');
                  more.type = 'button';
                  more.addEventListener('click', function () {
                    more.disabled = true; more.textContent = 'Loading';
                    page(d.next_cursor);
                  });
                  foot.appendChild(more);
                }
              });
            }
            return page('');
          } },

        /* YOUR STORY — the Continuation Law made visible: "opening ONEWAY is
           not starting; it is returning." The runtime has composed this the
           whole time (/api/me/story: a chapter per PLACE, your relationship
           with it, and the moments that happened there) and nothing in the App
           ever showed it.

           Chapters read OLDEST FIRST inside a place, because a relationship
           with somewhere is a story and reading it forward is what makes it
           one — the same rule the Gallery follows, and the opposite of the
           feed, which is discovery rather than memory. */

        /* THE PERSON'S OWN BRAIN. FOUNDATION.md gives every Profile Center a
           Brain and NOTHING in the App opened one — ten endpoints, zero call
           sites, three never reached by either App. The largest block of dark
           capability on the consumer side, and the App is where it belongs:
           this is a person's own understanding of their own life here.

           IT SHOWS ONLY WHAT ACTUALLY HAPPENED. The counts are real — joined
           Destinations, published creations, MUTUAL friends — and a new person
           honestly reads zero on all three, because a one-way follow is not a
           friendship and a draft in Workspace is not a creation yet. That is
           the Brain being truthful, not the surface being broken, and it is
           said in words rather than left as a bare 0 that looks like a bug. */
        /* LINKS — only when they have some. `links` rides on the person the
           runtime already returned, so this costs no extra read. */
        /* ★ FOUNDER/471 §10–11: *"links tab is a disgrace but literally the
           outline for it is there to be fixed with our new icons. icons for
           links i want able to be recongized by the platform."* The tab is
           the one link bar stood on end (`OW.links.bar`, `layout:'list'`):
           every link recognised from its URL and drawn as the platform's own
           mark, the word the person gave it beside, the host quietly after;
           no plate, no hairline (437). It was a boxed list of title + raw URL. */
        (person.links && person.links.length)
          ? iconTab('links', 'Links', function (pane) {
              var rows = (person.links || []).map(function (l) {
                return typeof l === 'string' ? l
                  : { url: (l && (l.url || l.href)) || '', label: (l && (l.title || l.label)) || '', kind: l && l.kind, value: l && l.value };
              });
              var bar = OW.links && OW.links.bar ? OW.links.bar(rows, [], { layout: 'list' }) : null;
              if (!bar) { nothing(pane, 'No links yet.', 'Links'); return 0; }
              var wrap = mk('div', 'ow-links');
              wrap.appendChild(bar);
              pane.appendChild(wrap);
              return bar.children.length;
            }, person.links.length)
          : null,

        /* REPOSTS — what they put into their own world from somebody else's.
           Canonical: served by `oneway/social`. */
        iconTab('reposts', 'Reposts', function (pane) {
          return data.get('/api/oneway/social/people/' + encodeURIComponent(email) + '/reposts')
            .then(function (r) {
              if (!r.ok) { refused(pane, r, 'Reposts'); return 0; }
              var rows = (r.data && (r.data.reposts || r.data.feed)) || [];
              if (!rows.length) { nothing(pane, 'Nothing reposted yet.', 'Reposts'); return 0; }
              /* THE CANONICAL LIST RENDERER, WITH ITS INTERACTIONS. `OW.river`
                 does not exist — guarded with `? :` it would have rendered
                 NOTHING whenever there were rows, which is the silent-empty
                 defect wearing a safety check. */
              return mountStream(pane, rows);
            });
        }),

        /* FAVOURITES — a private list, so it is the OWNER'S tab only. Showing
           a stranger the tab and then refusing the contents would announce
           that the list exists, which is the thing keeping it private is for. */
        opts.relation === 'self' || (person.is_me)
          ? iconTab('favorites', 'Favourites', function (pane) {
              return data.get('/api/oneway/social/me/saved').then(function (r) {
                if (!r.ok) { refused(pane, r, 'Favourites'); return 0; }
                var rows = (r.data && (r.data.saved || r.data.feed)) || [];
                if (!rows.length) { nothing(pane, 'Nothing saved yet.', 'Favourites'); return 0; }
                return mountStream(pane, rows);
              });
            })
          : null,

        { own: true, id: 'brain', hidden: true, label: 'Understanding',
          render: function (pane) { return brainPane(pane); } },

        /* ── ONE MENU, NOT FOUR TABS ────────────────────────────────────
           ★ FOUNDER, 2026-08-26: *"I want one menu with understanding,
             appearance, your activity, and settings. And I want the menu to be
             extremely laid out in categories."*

           Understanding, Appearance, Your activity and Settings were four
           sibling tabs in a row that already held Profile, World, Posts,
           Story and Memories — nine tabs, four of which are the same KIND of
           thing: what this platform holds about you and how you have set it
           up. A tab strip is for moving between VIEWS of a person; those four
           are administration, and putting them in the same strip made both
           harder to find.

           The four renderers are unchanged and are called from here — this is
           an index over them, never a second implementation of any of them. */


        /* SETTINGS BELONG TO THE PERSON, so they live in the person's own
           place — not a seventh destination (the nav is frozen at six). Nine
           real settings existed with a working read and write and NO surface
           anywhere in the App, which meant the privacy controls in particular
           — who may DM you, whether your profile is private — were unreachable
           by the person they protect. */
        /* EVERYTHING THIS PLATFORM HOLDS ABOUT YOU, in the place you already
           go to see yourself. Founder, 2026-08-15: "what people could see
           through their settings and their activity. It should all just be one
           pipeline."

           IT IS THE SAME READ A MODERATOR GETS, asked with you as the actor —
           `/api/me/settings/data` calls the identical `lens.look`, so the
           person's answer and the moderator's can never drift into two truths
           about one life. What differs is only how much comes back: you get
           the whole record and the count of it; they get the public projection
           with no total. */


        /* MEMORIES — the nostalgia engine, given a window at last.
           Founder, 2026-08-17: *"a memory or a highlight is basically just a
           recommendation engine saying, remember these things from x years ago.
           It's like a nostalgia thing."*
           `GET /api/me/memories` shipped the same day and the App called it
           ZERO times, which is this repo's signature failure — a capability
           built with no window. This is the window. */

      ];

      var myActs = mk('div', 'ow-prof__acts');
      profileShell(host, {
        kind: 'person',
        name: person.name || email,
        /* the face they chose, resolved by the API — see `wearWordmark` */
        wordmark: person.wordmark,
        /* PRONOUNS RIDE WITH THE HANDLE, which is where every platform a
           person already uses puts them, and where a reader looks before they
           write the first word about somebody. `location` was ALREADY read
           here and `/api/users/{email}` had never produced it — so this line
           has always been the handle alone and looked deliberate. It is
           produced now, and it has moved to the facts row, where it stands as
           a fact instead of hiding behind a middot. */
        sub: [person.handle ? '@' + person.handle : '', person.pronouns]
               .filter(Boolean).join(' · '),
        bio: person.bio || '',
        /* ★ FOUNDER/442 addendum: *"those types of layouts should be
           universal."* A person's header is the Center's: name, @handle, the
           sentence, THE ONE LINK BAR (their site and their platforms, drawn
           as the platforms' own marks), counts, Follow, Message. The website
           chip and the location fact are gone from the facts row; the site
           is in the bar and the city belongs in the sentence when it
           matters. */
        facts: [],
        links: (function () {
          if (!OW.links) return null;
          var raw = [];
          if (person.website) raw.push({ url: person.website });
          /* the person's own links first (canonical, founder/442), then the
             legacy widget's; an empty list is not an answer */
          var own = (person.links && person.links.length) ? person.links
                  : ((typeof d !== 'undefined' && d && d.links && d.links.length) ? d.links : []);
          own.forEach(function (l) { raw.push(l); });
          return OW.links.bar(raw, []);
        })(),
        banner: style.banner_url || '', logo: person.picture || style.avatar_url || '',
        /* the cut is the person's own — canonical `person.shape` first, the
           legacy style's answer only when the composed read has none (409) */
        avatarShape: person.shape || style.avatar_shape || 'round', hue: hue,
        email: email,
        /* My Center IS this person's own profile — the surface reached only
           when `email` is the signed-in person — so the note here is always
           editable. This is the primary place a note gets written. */
        note: person.note, noteMine: true,
        /* OPPORTUNITIES (founder/682): what you offer at your own home, drafts included */
        stats: stats, tabs: tabs.concat((function () {
          var _om = (typeof _md !== 'undefined' && _md) || {};
          var _t = OW.opps && OW.opps.tabEntry && OW.opps.tabEntry('me', _om.offering);
          return _t ? [_t] : [];
        })()), acts: myActs,
        menu: function (pane) { return settings(pane); },
        onMenu: function (anchor, open) { personMenu(anchor, open, style, email, tabs); }
      });
      /* AFTER the shell, because the read is asynchronous and the node is
         already mounted — nothing waits on the network to appear. */
      osDoors(myActs, opts);
      return tabs.length;
    });
  };

  /* 4.2c-ter — PLACES JOINED, PLACES BEEN, AND WHO CROSSED YOUR WORLD.

     Founder, 2026-08-15: *"You could join places and places visited inside of
     person's world. Because remember our StreetPass feature."*

     THREE READS, AND THE THIRD WAS ALREADY BUILT AND UNREACHABLE.
     `GET /api/me/crossings` is StreetPass — *"who and what crossed paths with
     my world"* — and its ONLY caller was `personal.html`, the LEGACY App
     surface. It has worked the whole time in a file the product no longer
     ships. Wiring it here is the entire fix.

     **STREETPASS HERE IS OVERLAP, NOT PROXIMITY.** The runtime computes it from
     shared membership and shared events — *"discovery through reality, never a
     follower mechanic"* — never from a device's location. Nothing on this
     platform reads a coordinate, and its own `Permissions-Policy` header sends
     `geolocation=()`, which forbids it outright. So this surface says "crossed
     paths" and means *your worlds overlap here*, which is what the data can
     actually support.

     WHERE YOU HAVE BEEN is derived from the record you already own — the same
     `lens.look` behind Your activity, grouped by the place each act landed in.
     Not a second store, and not a visit log the platform never kept. */
  function worldReality(host, onCenter) {
    var box = mk('div');
    host.appendChild(box);

    return Promise.all([
      data.get('/api/me/communities', { fresh: true }).catch(function () { return { ok: false }; }),
      /* WHERE YOU HAVE BEEN, WITH ITS IDENTITY — and it REPLACED a read rather
         than joining it. `/api/me/settings/data` was fetched here only to group
         its activity items by the place NAME; now that the rows come from
         `/api/me/places` (which carries `center_id`), that read has no reader,
         so it is gone rather than left running. Fetching something nobody uses
         is the same defect as writing something nobody reads — it just costs a
         request instead of a row. */
      data.get('/api/oneway/people/me/places', { fresh: true }).catch(function () { return { ok: false }; }),
      data.get('/api/oneway/people/me/crossings', { fresh: true }).catch(function () { return { ok: false }; })
    ]).then(function (res) {
      var joined = ((res[0].data || {}).communities) || [];
      var placed = ((res[1].data || {}).places) || [];
      var cross = ((res[2].data || {}).crossings) || [];

      function head(text, first) {
        var h = mk('p', 'ow-cust__lbl', esc(text));
        h.style.margin = (first ? '18px' : '18px') + ' 0 8px';
        box.appendChild(h);
      }

      if (joined.length) {
        head('Places you joined');
        var jl = mk('div');
        factList(jl, joined.slice(0, 40).map(function (c) {
          return { id: 'j-' + (c.id || c.community_id),
                   value: c.name || c.id,
                   label: c.role ? String(c.role) : 'member',
                   centerId: c.biz_id || c.id, icon: 'place', open: false };
        }), null, function (r) {
          if (onCenter && r.centerId) onCenter(r.centerId);
        });
        box.appendChild(jl);
      }

      /* WHERE YOU HAVE BEEN — grouped by place, counted, most-visited first.
         A list of every act would be the activity tab again; what a world
         wants is the PLACES, with how much of you is in each. */
      /* ── A PLACE YOU HAVE BEEN IS A PLACE YOU CAN GO BACK TO ────────────
         (founder, 2026-08-16: "you need to get things on the app actually
         openable".)

         This was built by grouping activity items on `a.where` — a STRING —
         and keying each row `'b-' + placeName`. So the row named a Center and
         carried no way to reach one, and `open:false` was the only honest
         thing to write. It is the seam CLAUDE.md says has bitten this platform
         three times: joining a row to its object BY NAME.

         `GET /api/me/places` already answers this with identity —
         `{center_id, center_name, depth, first, strands}` — and had no caller.
         So the fix is a READ SWAP, not a schema change and not a new endpoint:
         nothing in the runtime moved, and the rows open.

         DEPTH IS THE PLATFORM'S OWN MEASURE, not a tally of log lines. Counting
         activity strings answered "how many rows mention this place"; `depth`
         and `strands` answer how much of you is actually in it, which is the
         question the surface was always asking. */
      if (placed.length) {
        head('Where you have been');
        var bl = mk('div');
        factList(bl, placed.slice(0, 20).map(function (pl) {
          var strands = (pl.strands || []).length;
          return { id: pl.center_id,
                   value: pl.center_name || pl.center_id,
                   label: [pl.depth ? String(pl.depth) : '',
                           strands ? (strands + (strands === 1 ? ' way' : ' ways')
                                      + ' you are here') : '',
                           pl.first ? ('since ' + String(pl.first).slice(0, 10)) : '']
                          .filter(Boolean).join(' · '),
                   centerId: pl.center_id, icon: 'place' };
        }), null, function (r) {
          if (onCenter && r.centerId) onCenter(r.centerId);
        });
        box.appendChild(bl);
      }

      if (cross.length) {
        head('Crossed paths');
        var cl = mk('div');
        /* ── A CROSSING NAMES A REAL THING, SO IT OPENS ONE ────────────────
           (founder, 2026-08-16: "you need to get things on the app actually
           openable".)

           These were keyed `'x-' + i` — the row's POSITION in a list — and set
           open:false, which was honest: an index is not an identity. The row
           said "Bo is going to the Rooftop dinner too" and could reach neither
           Bo, the dinner, nor the place.

           The runtime already carried `evidence:[{type,id}]` naming exactly
           what the crossing is about; what it did NOT carry was which Center to
           read that object through — it sent `center` as a NAME. That is fixed
           at the emitter (three append sites now send `center_id`), so the
           routing here can be exact rather than inferred:

               evidence.type === 'center' -> the place itself
               evidence.type === 'event'  -> that event, read through its Center

           A crossing with neither still renders and still does not open. It is
           a true sentence about your world either way; what it must never do is
           look openable and do nothing. */
        factList(cl, cross.slice(0, 20).map(function (c, i) {
          var ev = (c.evidence || [])[0] || {};
          return { id: (ev.id || ('x-' + i)),
                   value: c.text || '', label: c.why || '', icon: 'people',
                   evType: ev.type || '', evId: ev.id || '',
                   centerId: c.center_id || '' };
        }), null, function (r) {
          if (r.evType === 'center' && r.evId) {
            openCenterPopit(r.evId, null);
          } else if (r.evType === 'event' && r.evId) {
            openEventScreen(r.evId);
          }
        });
        box.appendChild(cl);
        box.appendChild(mk('p', 'ow-door__why',
          'Your worlds overlap here — shared places and shared moments. '
          + 'ONEWAY does not read your location.'));
      }
      return joined.length + been.length + cross.length;
    }).catch(function () { return 0; });
  }

  /* 4.2c-bis — THE ACTIVITY CENTRE. Your record, and who else may read it.

     THE PART THAT IS NOT DECORATION: it shows the person WHAT A MODERATOR CAN
     SEE and what nobody can. A platform that can be looked into should say so
     to the people being looked at, in the same words it uses internally — the
     pipeline describes itself (`/api/me/settings/data` carries the subject
     table) rather than this file keeping a hand-written copy that drifts. */
  /* 4.2d — MEMORIES. The nostalgia engine, finally given a window.

     Founder, 2026-08-17: *"a memory or a highlight is basically just a
     recommendation engine saying, remember these things from x years ago. It's
     like a nostalgia thing."*

     `GET /api/me/memories` shipped the same afternoon and the App called it
     ZERO times. That is this repo's signature failure — a capability built with
     nothing showing it to anyone — and it is the third time today alone.

     ── THE ONE RULE THAT DECIDES WHETHER THIS IS NOSTALGIA OR NOISE ─────────
     `nothing_today: true` is the COMMON answer on a platform this young, and it
     must be rendered AS ITSELF. The tempting move — pad the empty day with
     recent things so the tab never looks bare — destroys the entire premise:
     a surface that shows you last Tuesday alongside "three years ago today"
     is a feed with a sentimental label on it, and once a person notices it
     padded once they never trust a date on it again. So an empty day says it
     is empty, and offers the one honest thing that can change the answer:
     widening the window.

     AND IT SAYS WHAT IT CANNOT SEE. The runtime returns `not_included` —
     today, "events attended", because the only available read is a
     platform-wide scan it refused to add. A nostalgia surface silently missing
     a whole category of a person's past is worse than one that admits it: the
     person cannot tell "you were nowhere" from "we did not look." */
  function memories(host) {
    var win = 0;                         /* days either side; 0 = this day only */
    host.className = ''; host.innerHTML = '';

    function draw() {
      loading(host, 2);
      return data.get('/api/oneway/people/me/memories?window_days=' + win).then(function (r) {
        host.className = ''; host.innerHTML = '';
        if (!r.ok) { refused(host, r, 'Memories'); return 0; }
        var d = r.data || {};
        var list = d.memories || [];

        /* the widening control is drawn on BOTH states — it is the only thing
           that can change an empty answer, so hiding it exactly when the answer
           is empty would be the wrong way round */
        function widen(where) {
          var cap = d.max_window_days || 15;
          if (win >= cap) return;
          var row = mk('div', 'ow-mem__widen');
          [[3, 'a few days either side'], [7, 'the week around it'],
           [cap, 'the fortnight around it']].forEach(function (o) {
            if (o[0] <= win || o[0] > cap) return;
            var b = mk('button', 'po-act', esc('Look ' + o[1]));
            b.type = 'button';
            b.addEventListener('click', function () { win = o[0]; draw(); });
            row.appendChild(b);
          });
          if (row.children.length) where.appendChild(row);
        }

        if (d.nothing_today || !list.length) {
          nothing(host,
            win
              ? 'Nothing from this time in other years — not within ' + win
                + ' days of today. This fills as the years do.'
              : 'Nothing happened on this day in an earlier year. Memories are '
                + 'whole years back, so this is quiet until there is a year to '
                + 'look back on.',
            'On this day',
            []);
          widen(host);
          notIncluded(host, d);
          return 0;
        }

        var head = mk('div', 'ow-mem__head');
        head.appendChild(mk('b', 'ow-mem__t', esc('On this day')));
        head.appendChild(mk('span', 'ow-mem__n',
          esc(list.length + (list.length === 1 ? ' memory' : ' memories'))));
        host.appendChild(head);

        /* GROUPED BY HOW LONG AGO, because that is the only ordering a person
           reads a memory by. Whole years — the runtime already refuses
           anything else, so "eleven days ago" can never appear here. */
        var byYear = {};
        list.forEach(function (m) {
          var y = m.years_ago || 0;
          (byYear[y] = byYear[y] || []).push(m);
        });
        Object.keys(byYear).sort(function (a, b) { return a - b; }).forEach(function (y) {
          var n = Number(y);
          var sec = mk('section', 'ow-mem__yr');
          sec.appendChild(mk('h3', 'ow-mem__yrt',
            esc(n === 1 ? 'One year ago' : n + ' years ago')));
          var grid = mk('div', 'po-grid');
          byYear[y].forEach(function (m) {
            var card = mk('button', 'ow-mem__c'); card.type = 'button';
            card.appendChild(mk('span', 'ow-mem__k', esc(m.kind || '')));
            card.appendChild(mk('b', 'ow-mem__ct',
              esc(m.title || 'Something you wrote')));
            /* `days_off` is the runtime being honest about a widened window:
               inside it, "on this day" is not literally true, and saying so is
               cheaper than a person noticing the date does not match. */
            if (m.days_off) {
              card.appendChild(mk('span', 'ow-mem__off',
                esc(m.days_off === 1 ? 'a day either side' : m.days_off + ' days off')));
            }
            /* 2026-10-01: the new backend (oneway/people/record.py) puts the
               thing's `id` on the memory itself — the legacy read nested it
               under `post`/`gallery`, so `m.id` was undefined and no memory
               ever opened. An event opens through its place, as every
               object does. */
            card.addEventListener('click', function () {
              if (m.kind === 'event' && m.id) {
                openEventScreen(m.id);
              } else if (m.id) {
                /* the same room a post opens from the Brain or a profile —
                   `global.openPost` was never defined, so this did nothing */
                data.get('/api/posts/' + encodeURIComponent(m.id)).then(function (res) {
                  var po = res.ok && res.data && (res.data.post || res.data);
                  if (po && (po.body || po.title)) OW.open(postPayload(po), card);
                  else OW.say(card, 'that post is no longer here');
                });
              }
            });
            grid.appendChild(card);
          });
          sec.appendChild(grid);
          host.appendChild(sec);
        });
        widen(host);
        notIncluded(host, d);
        return list.length;
      });
    }

    /* WHAT THE ENGINE CANNOT SEE, SAID OUT LOUD. The runtime volunteers this
       rather than being asked, which is unusual and right: a person cannot tell
       "you were nowhere that year" from "we did not look there." */
    function notIncluded(where, d) {
      var miss = d.not_included || [];
      if (!miss.length) return;
      var p = mk('p', 'ow-mem__miss',
        esc('Not looked at yet: ' + miss.join('; ') + '.'));
      where.appendChild(p);
    }

    return draw();
  }

  function activityCentre(host) {
    var wrap = mk('div');
    host.appendChild(wrap);
    wrap.appendChild(mk('p', 'ow-door__why', 'Loading your record…'));
    return data.get('/api/oneway/people/me/record', { fresh: true }).then(function (r) {
      wrap.innerHTML = '';
      if (!r.ok) { refused(wrap, r, 'Your activity'); return 0; }
      var d = r.data || {}, act = d.activity || {}, items = act.items || [];

      wrap.appendChild(mk('h3', 'ow-group', 'What you have done here'));
      if (typeof act.total === 'number') {
        wrap.appendChild(mk('p', 'ow-door__why',
          /* ONE IS NOT ONE THINGS. A count printed straight into a sentence
             reads as a bug to the person it is about, and it is the first
             thing they see on their own activity page. */
          act.total ? (act.total === 1 ? 'One thing so far.'
                                       : act.total + ' things, newest first.')
                    : 'Nothing recorded yet — post somewhere and it appears here.'));
      }

      var kinds = act.kinds || {};
      if (Object.keys(kinds).length) {
        var row = mk('div', 'po-acts');
        Object.keys(kinds).forEach(function (k) {
          row.appendChild(mk('span', 'ow-pill', esc(k) + ' ' + kinds[k]));
        });
        wrap.appendChild(row);
      }

      /* THE SETTINGS TAB'S OWN MATERIAL — `ow-cust__row` / `ow-cust__lbl`.
         Reused rather than a new row class, because a second row style beside
         its sibling is how one surface starts looking like two. */
      var box = mk('div', 'ow-cust');
      items.slice(0, 60).forEach(function (i) {
        /* `mk(tag, cls, html)` assigns innerHTML, so EVERY dynamic value here
           is escaped. A post body is text a stranger wrote. */
        var line = mk('div', 'ow-cust__row');
        /* ── NEVER A RAW DATE ON A SURFACE ─────────────────────────────────
           This printed `(i.at || '').slice(0, 10)` — "2026-09-03" — beside the
           kind, on the page that shows a person what they have done. A stored
           timestamp truncated to ten characters is a machine's date, and
           "yesterday" is what somebody is actually asking. `OW.when` is the
           App's one answer to that and every other surface already uses it. */
        line.appendChild(mk('span', 'ow-cust__lbl',
          esc(i.at ? OW.when(i.at) : '') + '  ' + esc(i.kind || '')));
        /* a join or a visit has no words of its own — only where — so the
           separator is drawn only between two things that are there */
        line.appendChild(mk('span', '',
          [i.what, i.where].filter(Boolean).map(esc).join(' \u00b7 ')));
        box.appendChild(line);
      });
      if (items.length) wrap.appendChild(box);

      /* WHO ELSE MAY ASK, in the platform's own words rather than mine. */
      var pipe = (d.pipeline || {}).subjects || [];
      if (pipe.length) {
        wrap.appendChild(mk('h3', 'ow-group', 'Who can see this'));
        var pbox = mk('div', 'ow-cust');
        /* founder/542 sweep: this printed the platform's internal notes to the
           person ("a moderator sees the public projection with no total and no
           residue", "trajectory", "algorithms"). Each kind the runtime names is
           said here in plain words; a kind this build does not know keeps the
           runtime's own note rather than being dropped. */
        var PLAIN = {
          person: ['Your own record', 'You see all of it. A platform moderator sees only what you did in public.'],
          center: ['What happens at a Center you run', 'You and your team see what people did through your Center.'],
          trajectory: ['Whether a Center is growing', 'Platform moderators see whether a Center is growing or going quiet, never who did what.'],
          opportunities: ['What people ask for', 'Platform moderators see requests ONEWAY does not meet yet, never who asked.'],
          algorithms: ['What decides what you see', 'Platform moderators can review every rule that decides what appears for you.']
        };
        pipe.forEach(function (s) {
          var pl = PLAIN[s.kind];
          var line = mk('div', 'ow-cust__row');
          line.appendChild(mk('span', 'ow-cust__lbl', esc(pl ? pl[0] : s.kind)));
          line.appendChild(mk('span', '', esc(pl ? pl[1] : (s.note || ''))));
          pbox.appendChild(line);
        });
        wrap.appendChild(pbox);
        wrap.appendChild(mk('p', 'ow-door__why',
          'A moderator sees only what you did in public, and is never told how '
          + 'much was left out. Your messages are not read by any of this.'));
      }
      return items.length;
    }).catch(function () { return 0; });
  }

  /* 4.2d — APPEARANCE. A person's own look, edited where it is seen (founder,
     2026-07-30: bring the customization back — uploaded banners and
     backgrounds as well as stock, and "no more preset only").

     It writes the SAME profile-style record everything else reads, so there is
     no second appearance model. Uploads go through the endpoint that validates
     real image bytes; nothing here trusts a data URL into storage. */
  /* 4.2e — SETTINGS. The person's own switches, grouped the way a person
     thinks about them rather than the way the record stores them.

     THE VOCABULARY IS THE SERVER'S. Every key below exists in the runtime's
     own defaults; nothing is invented here, and a setting the runtime does not
     have would simply not appear. Each change is written immediately and the
     control shows the SERVER's answer back — a switch that flips locally and
     fails quietly is the same lie as an optimistic action with no revert. */
  var SETTING_GROUPS = [
    ['Privacy', [
      ['private_profile', 'Private profile',
       'Only people you are friends with can see what you post.'],
      ['dm_from_anyone', 'Messages from anyone',
       'Off means friends and people from your communities only.'],
      ['comments_anyone', 'Anyone can comment',
       'Off means friends and community members only.'],
      ['activity_status', 'Show when you are active', '']
    ]],
    ['Notifications', [
      ['push_notifs', 'Push notifications', 'Mentions, messages, community activity.'],
      ['mention_notifs', 'When someone mentions you', ''],
      ['email_digest', 'Weekly email summary', 'Off by default — this is yours to switch on.']
    ]],
    ['Preferences', [
      ['personalized', 'Personalised discovery',
       'Uses the places and people you already belong to. Never engagement.'],
      ['reduce_motion', 'Reduce motion',
       'The world stops moving; everything still works.']
    ]]
  ];

  /* ═══ THE PERSON'S MENU — a dropdown, and Settings is its own page ══════
     ★ FOUNDER, 2026-08-26: *"settings should be its own page or dropdown."*

     THE FIRST VERSION WAS A LIST OF ROWS AND THAT WAS THE MISTAKE. Four
     destinations rendered as text rows in a plate — a shape that could belong
     to any product, and one that buried Settings as the fourth line of an
     index nobody asked to read. A person reaching for the gear wants Settings;
     making them read a menu first to get there is a step that earns nothing.

     So the gear opens a short dropdown, each entry carries its OWN mark, and
     every one of them opens as a FULL PAGE — the same mechanism the tabs use,
     so a pane is a pane wherever it was opened from and there is no second
     kind of surface to maintain.

     THE MARKS ARE THE POINT. Strip the words and each is still identifiable:
     a node graph for Understanding, a stack of records for Your activity, a
     filled disc in the person's own colour for Appearance, two tracks with
     knobs for Settings. That is §17 — hue and form are recognition — applied
     to a menu instead of to a Popit. */
  var MENU_MARKS = {
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    understanding: '<circle cx="6" cy="7" r="1.7"/><circle cx="17" cy="5.5" r="1.4"/>'
         + '<circle cx="12" cy="13" r="2.1"/><circle cx="19" cy="16" r="1.5"/>'
         + '<circle cx="6.5" cy="17.5" r="1.5"/>'
         + '<path d="M6 7l6 6M17 5.5L12 13M12 13l7 3M12 13l-5.5 4.5"/>',
    activity: '<path d="M4 6.5h13M4 11h16M4 15.5h9M4 20h11"/>'
            + '<circle cx="19.5" cy="15.5" r="1.4"/>',
    appearance: '<circle cx="12" cy="12" r="7.4" class="ow-dd__disc"/>'
        + '<path d="M12 4.6a7.4 7.4 0 0 1 0 14.8"/>',
    settings: '<path d="M3.5 8.5h17M3.5 15.5h17"/>'
            + '<circle cx="9" cy="8.5" r="2.5"/><circle cx="15.5" cy="15.5" r="2.5"/>'
  };

  function personMenu(anchor, open, style, email, tabs) {
    /* one at a time — a second dropdown over the first is two answers to one
       press, and the older one keeps its own click handlers alive */
    var old = doc.querySelector('.ow-dd'); if (old) old.remove();

    function tabRender(id) {
      var t = (tabs || []).filter(function (x) { return x.id === id; })[0];
      return t && t.render;
    }

    var items = [
      ['settings', 'Settings', 'Privacy, who can reach you, notifications'],
      ['appearance', 'Appearance', 'Your colour, banner and profile Popits'],
      ['calendar', 'Calendar', 'Your stays, bookings and plans, in order'],
      ['understanding', 'Understanding', 'What your world adds up to'],
      ['activity', 'Your activity', 'Everything ONEWAY holds about you']
    ];

    var dd = mk('div', 'ow-dd');
    dd.setAttribute('role', 'menu');
    items.forEach(function (it) {
      var b = mk('button', 'ow-dd__row'); b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.innerHTML =
        '<span class="ow-dd__mark"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + (MENU_MARKS[it[0]] || '') + '</svg></span>'
        + '<span class="ow-dd__txt"><span class="ow-dd__t">' + esc(it[1]) + '</span>'
        + '<span class="ow-dd__n">' + esc(it[2]) + '</span></span>';
      b.addEventListener('click', function () {
        close();
        /* A REAL NAVIGATION, not a panel swap — so Back works, the URL is
           shareable and a reload lands where the person was. The App owns the
           router; the runtime asks it rather than reaching into it. */
        doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: it[0] } }));
      });
      dd.appendChild(b);
    });

    /* ANCHORED TO THE GEAR, and kept on screen. A dropdown that opens off the
       right edge on a phone is a menu the person cannot read. */
    (anchor.offsetParent || doc.body).appendChild(dd);
    var a = anchor.getBoundingClientRect();
    var host = (anchor.offsetParent || doc.body).getBoundingClientRect();
    dd.style.top = (a.bottom - host.top + 10) + 'px';
    dd.style.right = Math.max(8, host.right - a.right) + 'px';
    requestAnimationFrame(function () { dd.classList.add('is-in'); });

    function close() {
      dd.classList.remove('is-in');
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('pointerdown', onOut, true);
      setTimeout(function () { dd.remove(); }, 160);
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function onOut(e) {
      if (dd.contains(e.target) || anchor.contains(e.target)) return;
      close();
    }
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('pointerdown', onOut, true);
    var first = dd.querySelector('.ow-dd__row'); if (first) first.focus();
  }

  function settings(host) {
    loading(host, 2);
    return Promise.all([
      data.get('/api/me/settings', { fresh: true }),
      data.get('/api/oneway/people/me/plus'),
      /* the canonical shape of this menu; a runtime without it falls back */
      data.get('/api/oneway/settings/menu/person').catch(function () { return { ok: false }; }),
      /* THE PERSON'S OWN WORDS, read WITH the settings rather than after them.
         Painting the fields empty and filling them a beat later shows somebody
         a blank bio they did not write — a lie about themselves, however
         brief, in the one place they came to correct it. */
      data.get('/api/oneway/people/me', { fresh: true })
        .catch(function () { return { ok: false }; })
    ]).then(function (res) {
      var r = res[0], pl = res[1], mn = res[2], meRes = res[3];
      var menuData = (mn && mn.ok && mn.data && mn.data.menu) || null;
      if (!r.ok) { refused(host, r, 'Your settings'); return 0; }
      var cur = (r.data || {}).settings || {};
      host.className = ''; host.innerHTML = '';
      var box = mk('div', 'ow-cust');
      var n = 0;

      /* ══ YOU ═══════════════════════════════════════════════════════════
         ★ FOUNDER, 2026-09-06: *"PROFILE SHOULD BE PERFECT AND SO SHOULD USER
           DEPTH OF GOOGLE ACCOUNT AND FACEBOOK."*

         ── THE DEPTH EXISTED AND NOBODY COULD REACH IT ────────────────────
         The store learned pronouns, a bio, a location, a website and a
         birthday, the route carried them and the profile drew them — and there
         was NOWHERE ON THIS PLATFORM TO TYPE ONE. A field only an API can set
         is a field nobody has; the whole depth would have shipped invisible and
         measured perfectly green, which is the exact shape of a complete
         contract with no producer.

         ── IT IS FIRST, BECAUSE IT IS WHO YOU ARE ─────────────────────────
         Everything else on this screen is a preference about the room. This is
         the person. Appearance, notifications and the rest follow.

         ── EACH FIELD SAVES ITSELF, AND SAYS SO ───────────────────────────
         ★ FOUNDER, 2026-09-06: *"look at settings our posts is the language I
           want the whole platform moving towards."*
         Every switch on this screen commits the moment it is pressed. A Save
         button here would make one section of Settings work differently from
         all the others, and a form that must be submitted is a form that gets
         abandoned half-filled. So: it commits when you leave the field, and it
         REPORTS — "Saved", or what actually went wrong. A screen that says
         saved when the store refused is the same lie as a feed that shows
         empty when it could not read. */
      (function () {
        var me = (meRes && meRes.ok && meRes.data) || null;
        var prof = (me && me.profile) || {};
        var row = mk('div', 'ow-cust__row ow-cust__row--stack');
        row.appendChild(mk('span', 'ow-cust__lbl', 'You'));
        if (!me) {
          /* HONEST RATHER THAN EMPTY. Drawing blank fields over a failed read
             invites somebody to retype what they already wrote, and the save
             would then overwrite words this screen never managed to see. */
          row.appendChild(mk('p', 'ow-note',
            'Your profile could not be read just now, so it is not shown. '
            + 'Nothing has been changed.'));
          box.appendChild(row); n++;
          return;
        }
        var FIELDS = [
          ['display_name', 'Name', 'text', 'What people call you', 200,
           me.display_name || ''],
          ['pronouns', 'Pronouns', 'text', 'they/them', 40, prof.pronouns || ''],
          ['bio', 'About you', 'area', 'A few lines about yourself', 600,
           prof.bio || ''],
          ['location', 'Where you are', 'text', 'A city, a region, anywhere',
           120, prof.location || ''],
          ['website', 'Your site', 'url', 'https://', 300, prof.website || ''],
          /* PRIVATE, AND SAID SO ON THE SCREEN ITSELF. A birthday is the claim
             an identity provider leaks first; it is withheld from every public
             read, and a person typing it deserves to know that BEFORE they
             type it rather than in a policy page. */
          ['birthday', 'Birthday', 'date', '', 10, prof.birthday || '']
        ];
        var grid = mk('div', 'ow-you');
        FIELDS.forEach(function (f) {
          var key = f[0], label = f[1], kind = f[2];
          var fld = mk('label', 'ow-you__f');
          fld.appendChild(mk('span', 'ow-you__lbl', esc(label)));
          var el = doc.createElement(kind === 'area' ? 'textarea' : 'input');
          el.className = 'ow-you__in';
          if (kind === 'area') { el.rows = 3; }
          else { el.type = (kind === 'date' ? 'date' : (kind === 'url' ? 'url' : 'text')); }
          el.maxLength = f[4];
          if (f[3]) el.placeholder = f[3];
          el.value = f[5];
          var said = mk('span', 'ow-you__say', '');
          var was = el.value;
          function commit() {
            var v = el.value.trim();
            if (v === was) return;                 /* no write, nothing to say */
            said.textContent = 'Saving…';
            said.setAttribute('data-s', 'busy');
            var body = {}; body[key] = v;
            data.patch('/api/oneway/people/me', body).then(function (rr) {
              if (!rr || !rr.ok) {
                said.textContent = ((rr && rr.error) || 'That did not save.');
                said.setAttribute('data-s', 'bad');
                return;
              }
              was = v;
              /* CLEARED IS ITS OWN OUTCOME. "Saved" over an emptied field
                 reads as though something was kept. */
              said.textContent = v ? 'Saved' : 'Cleared';
              said.setAttribute('data-s', 'ok');
              /* THE PAGE UNDERNEATH IS NOW WRONG. Every surface that draws a
                 person listens for this already — the note composer raised it
                 first — so a name changed here changes the profile behind this
                 sheet instead of waiting for a reload. */
              try {
                doc.dispatchEvent(new CustomEvent('ow:profile-changed',
                                                  { detail: { email: me.email } }));
              } catch (e) {}
            });
          }
          el.addEventListener('blur', commit);
          el.addEventListener('change', commit);
          el.addEventListener('input', function () {
            if (said.getAttribute('data-s')) {
              said.textContent = ''; said.removeAttribute('data-s');
            }
          });
          fld.appendChild(el);
          fld.appendChild(said);
          if (key === 'birthday') {
            fld.appendChild(mk('span', 'ow-you__why',
              'Only you see this. It never leaves ONEWAY with your profile.'));
          }
          grid.appendChild(fld);
        });
        /* ══ YOUR LINKS — the one link bar, edited where it is read ═════════
           ★ FOUNDER/442: *"one link bar … that people could prominently put."*
           One URL per line; the bar recognises the platform from the URL and
           draws its mark, so a person types an address and sees Instagram,
           not a form asking which platform it is. Saved on blur, like every
           field above; the preview underneath is the bar itself. */
        /* ══ ADDING A LINK IS A BOX AND ENTER ══════════════════════════════
           ★ FOUNDER/496: *"It should be much easier to add links than just
             having one box with lines that people copy and paste. It should be
             add box with link and then enter. Then it automatically detects
             the platform and icon."*

           IT WAS A TEXTAREA. Every link a person had, as raw text, one per
           line, in a box they had to edit like a config file — and the only
           feedback was a preview bar underneath that redrew as they typed. To
           remove the third link you selected the third line. To reorder them
           you cut and pasted. Nothing about it said "this is your Instagram";
           it said "these are strings".

           A LINK IS A THING NOW. Paste, press Enter, and it becomes a ROW
           carrying the platform's own mark and name, with an X to remove it.
           The platform is resolved by `OW.links.platformOf` — the same
           function the bar itself uses, so what the editor says a link IS and
           what the profile draws can never disagree.

           SAVED ON EVERY CHANGE, not on blur. A row added and then navigated
           away from used to be lost, because the textarea only committed when
           it lost focus and pressing Enter inside it did not. There is no blur
           to wait for now — adding and removing ARE the changes. */
        (function () {
          var fld = mk('label', 'ow-you__f');
          fld.appendChild(mk('span', 'ow-you__lbl', 'Your links'));

          var rows = (prof.links || [])
            .map(function (l) { return (l && (l.url || l.href || l.value)) || ''; })
            .filter(Boolean);

          var said = mk('span', 'ow-you__say', '');
          var listEl = mk('div', 'ow-lnked');
          var add = mk('div', 'ow-lnked__add');
          var input = doc.createElement('input');
          input.type = 'url';
          input.className = 'ow-you__in';
          input.placeholder = 'Paste a link and press Enter';
          input.setAttribute('aria-label', 'Add a link');
          var addBtn = mk('button', 'ow-lnked__go', 'Add');
          addBtn.type = 'button';
          add.appendChild(input); add.appendChild(addBtn);

          function save() {
            said.textContent = 'Saving\u2026'; said.setAttribute('data-s', 'busy');
            var list = rows.map(function (u) {
              return { url: /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : ('https://' + u) };
            });
            data.patch('/api/oneway/people/me', { links: list }).then(function (rr) {
              if (!rr || !rr.ok) {
                said.textContent = (rr && rr.error) || 'That did not save.';
                said.setAttribute('data-s', 'bad');
                if (OW.toast) OW.toast('Your links did not save.');
                return;
              }
              said.textContent = list.length ? 'Saved' : 'Cleared';
              said.setAttribute('data-s', 'ok');
              data.invalidate('/api/oneway/people');
              try { doc.dispatchEvent(new CustomEvent('ow:profile-changed', { detail: { email: me.email } })); } catch (e) {}
            });
          }

          function paint() {
            listEl.innerHTML = '';
            rows.forEach(function (u, i) {
              var p = (OW.links && OW.links.platformOf) ? OW.links.platformOf(u) : null;
              var r = mk('div', 'ow-lnked__r');
              var ic = mk('span', 'ow-lnked__i');
              ic.setAttribute('data-platform', (p && p.key) || 'web');
              var hue = (OW.links && OW.links.hueOf) ? OW.links.hueOf((p && p.key) || '') : '';
              if (hue) ic.style.setProperty('--mk', hue);
              ic.innerHTML = (OW.links && OW.links.icon)
                ? OW.links.icon((p && p.key) || 'web', (p && p.href) || u) : '';
              var t = mk('div', 'ow-lnked__t');
              t.appendChild(mk('b', '', esc((p && p.name) || 'Link')));
              t.appendChild(mk('span', '', esc(u.replace(/^https?:\/\//i, ''))));
              var x = mk('button', 'ow-lnked__x', '');
              x.type = 'button';
              x.setAttribute('aria-label', 'Remove ' + ((p && p.name) || u));
              x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
                + '<path d="M6 6l12 12M18 6L6 18"/></svg>';
              x.addEventListener('click', function () {
                rows.splice(i, 1); paint(); save();
              });
              r.appendChild(ic); r.appendChild(t); r.appendChild(x);
              listEl.appendChild(r);
            });
          }

          function addOne() {
            var v = input.value.trim();
            /* ADD WITH NOTHING TYPED WAS A BUTTON THAT DID NOTHING (founder/559:
               the one Settings control the crawl found dead). It now puts you
               in the box and says what goes there. */
            if (!v) {
              input.focus();
              said.textContent = 'Paste a link in the box, then press Add.';
              said.setAttribute('data-s', 'busy');
              return;
            }
            /* the same link twice is a mistake, not an intention */
            var seen = rows.some(function (u) {
              return u.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
                === v.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
            });
            if (seen) {
              input.value = '';
              if (OW.toast) OW.toast('That link is already there.');
              return;
            }
            rows.push(v);
            input.value = '';
            paint();
            save();
          }
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addOne(); }
          });
          addBtn.addEventListener('click', addOne);

          fld.appendChild(add);
          fld.appendChild(listEl);
          fld.appendChild(said);
          grid.appendChild(fld);
          paint();
        })();
        row.appendChild(grid);
        box.appendChild(row); n++;
      })();

      /* LIGHT OR DARK LIVES HERE NOW. It used to sit permanently in the top
         bar; the bar is gone, and a preference belongs with the other
         preferences rather than on screen at all times. Same switch material
         as every other setting, so it reads as one of them — which it is. */
      /* ── THE ROOM: light or dark, and whether the world is in it ────────
         THIS SWITCH DID NOTHING. It wrote `data-mode="light"`, and every light
         rule in the material system is keyed on `data-theme="light"` — so the
         switch flipped, the label changed, and the App stayed dark. Light mode
         was never missing; it was never connected. It also stored the choice
         and nothing read it back, so even a working switch would have been
         forgotten on reload.

         Both are now the App's own `OW.theme`, which is what the retired header
         button already drove — one writer for the person's room instead of a
         second one that happens to be inert. */
      /* ── LIGHT · DARK · DEVICE. THREE STATES, BECAUSE THERE ARE THREE. ───
         ★ FOUNDER, 2026-09-02: *"add a device setting for dark mode."*

         THE BINARY SWITCH COULD NOT EXPRESS THE DEFAULT, AND THAT WAS THE
         DEFECT. `OW.theme.set(null)` has always meant "follow the device", the
         boot script has always honoured it, and every person starts there — but
         a two-state toggle can only ever write 'light' or 'dark'. So the first
         press was a ONE-WAY DOOR: a person who tried light mode could never get
         back to following their phone, and from then on ONEWAY stayed bright at
         2am and dark at noon whatever their device did.

         A control that cannot reach a state the system has is a control that
         lies about the system's shape. Three choices, and Device is the one
         they arrived with — so it is listed first and it is not a fallback. */
      (function () {
        var T = global.OW && global.OW.theme;
        var row = mk('div', 'ow-cust__row ow-cust__row--stack');
        row.appendChild(mk('span', 'ow-cust__lbl', 'Appearance'));
        var seg = mk('div', 'ow-seg');
        if (!T) {
          /* honest rather than a switch that pretends: the writer is missing */
          seg.appendChild(mk('span', 'po-acts__wait', 'The theme writer did not load.'));
          row.appendChild(seg); box.appendChild(row); n++;
          return;
        }
        var CHOICES = [
          ['', 'Device', 'follows your phone or computer'],
          ['light', 'Light', ''],
          ['dark', 'Dark', '']
        ];
        var btns = [];
        function paint() {
          var cur = T.get() || '';
          btns.forEach(function (b) {
            var on = b.getAttribute('data-v') === cur;
            b.setAttribute('aria-pressed', String(on));
            b.setAttribute('data-act', on ? 'on' : 'off');
          });
          /* WHAT DEVICE CURRENTLY MEANS, said out loud. "Device" alone does not
             tell somebody whether they are about to get light or dark, and the
             answer is knowable — so it is stated rather than left to be
             discovered by pressing it. */
          note.textContent = cur ? '' :
            ('Your device is asking for ' + (T.isDark() ? 'dark' : 'light') + ' right now.');
        }
        CHOICES.forEach(function (c) {
          var b = mk('button', 'ow-seg__b', esc(c[1]));
          b.type = 'button';
          b.setAttribute('data-v', c[0]);
          if (c[2]) b.setAttribute('title', c[2]);
          b.addEventListener('click', function () { T.set(c[0] || null); paint(); });
          btns.push(b); seg.appendChild(b);
        });
        var note = mk('p', 'ow-seg__note', '');
        row.appendChild(seg); row.appendChild(note);
        paint();

        /* AND IT FOLLOWS THE DEVICE WHILE THE APP IS OPEN, not only at boot.
           A phone that switches to dark at sunset must take the App with it —
           otherwise "Device" means "device, as it was when you last loaded",
           which is a different and much weaker promise. */
        try {
          var mq = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)');
          if (mq && mq.addEventListener) {
            mq.addEventListener('change', function () {
              if (!T.get()) { T.set(null); paint(); }
            });
          }
        } catch (e) {}

        box.appendChild(row);
        n++;
      })();

      /* PLAIN — the galaxy put away for a flat ground. */
      (function () {
        var W = global.OW && global.OW.world;
        var row = mk('div', 'ow-cust__row');
        row.appendChild(mk('span', 'ow-cust__lbl', 'Plain background'));
        var sw = mk('button', 'ow-switch');
        sw.type = 'button';
        function paint(plain) {
          sw.setAttribute('aria-pressed', plain ? 'true' : 'false');
          sw.innerHTML = '<span class="ow-switch__b"><b>'
            + (plain ? 'On' : 'Off') + '</b><span>'
            + 'No galaxy — just the ground, black or white with your theme.'
            + '</span></span>';
        }
        if (!W) {
          sw.textContent = 'Unavailable'; sw.disabled = true;
        } else {
          paint(W.get() === 'plain');
          sw.addEventListener('click', function () {
            var next = W.get() === 'plain' ? 'galaxy' : 'plain';
            W.set(next); paint(next === 'plain');
          });
        }
        row.appendChild(sw);
        box.appendChild(row);
        n++;
      })();

      /* ── SIMPLE MODE ────────────────────────────────────────────────────
         ★ FOUNDER, 2026-09-02: *"on simple mode we are gonna drop the popit
           presentation and ahve instagram/ twitter display"* · *"on home and
           scroll but only WHEN simple mode is on"*.

         IT SITS WITH THE OTHER DISPLAY PREFERENCES because that is what it is —
         beside Light mode and Plain background, not in a new section. And it
         drives `OW.simple`, the ONE writer, rather than setting an attribute
         itself: the light/dark switch once wrote `data-mode` while the material
         system keyed on `data-theme`, so the switch flipped, the label changed,
         and nothing happened. Two writers, one of them inert. */
      (function () {
        var S = global.OW && global.OW.simple;
        var row = mk('div', 'ow-cust__row');
        row.appendChild(mk('span', 'ow-cust__lbl', 'Simple mode'));
        var sw = mk('button', 'ow-switch'); sw.type = 'button';
        function paint(on) {
          sw.setAttribute('aria-pressed', String(!!on));
          sw.innerHTML = '<span class="ow-switch__b"><b>' + (on ? 'On' : 'Off')
            + '</b><span>' + (on
              ? 'Home and Scroll drop the Popit frame — posts sit on the ground, '
                + 'separated by a line, with pictures edge to edge.'
              : 'Home and Scroll show Popits — the ONEWAY card, with its own frame '
                + 'and light.')
            + '</span></span>';
        }
        if (!S) {
          /* UNAVAILABLE IS NOT OFF. A switch that reports "Off" for a feature it
             cannot reach is the false-state rule broken on the settings screen. */
          sw.textContent = 'Unavailable'; sw.disabled = true;
        } else {
          paint(S.get());
          sw.addEventListener('click', function () { paint(S.set(!S.get())); });
        }
        row.appendChild(sw);
        box.appendChild(row); n++;
      })();

      /* WHICH SUBSCRIPTION IS YOURS, named so it cannot be mistaken for the
         other one (founder, 2026-08-02). ONEWAY+ is a PERSON's subscription;
         ONEWAY OS+ and OS Max are a CENTER's operating tiers, bought per
         Center and shown in the OS. The names are one character apart, so
         this says which is which rather than assuming anyone can tell.
         Status only — it reports what the runtime knows and promises
         nothing the runtime does not enforce. */
      if (pl.ok && pl.data) {
        var plus = mk('div', 'ow-cust__row');
        plus.appendChild(mk('span', 'ow-cust__lbl', 'Your subscription'));
        var card = mk('div', 'ow-switch');
        card.setAttribute('aria-pressed', String(!!pl.data.plus));
        card.style.cursor = 'default';
        var feats = (pl.data.features || []).map(function (f) { return esc(f); });
        card.innerHTML = '<span class="ow-switch__b"><b>'
          + (pl.data.plus ? 'ONEWAY+' : 'ONEWAY+ — not subscribed') + '</b>'
          + '<span>' + (pl.data.plus
              ? feats.join(' · ')
              : 'A subscription for a person — it deepens your own Space. '
                + 'Different from ONEWAY OS+, which a Center buys to operate.')
          + '</span></span>';
        plus.appendChild(card);
        box.appendChild(plus);
        n++;
      }

      function save(key, val, row) {
        var patch = {}; patch[key] = val;
        return data.post('/api/me/settings', { settings: patch }, { method: 'PUT' })
          .then(function (res) {
            if (!res.ok) {
              /* put it back and say so — never leave a switch showing a state
                 the server refused */
              row.setAttribute('aria-pressed', String(!val));
              row.setAttribute('data-failed', '1');
              row.disabled = false;
              /* and SAY so — the comment always promised it; a thin outline
                 could not tell locked from broken (founder/502 sweep) */
              if (OW.toast) OW.toast('That setting did not change. ' + (res.error || 'Try again.'));
              return;
            }
            row.disabled = false;
            var got = (res.data || {}).settings || {};
            cur = got;
            row.setAttribute('aria-pressed', String(!!got[key]));
            row.removeAttribute('data-failed');
            /* reduce motion is not a preference the App merely stores — it
               changes how this world behaves, immediately */
            if (key === 'reduce_motion') {
              doc.documentElement.setAttribute('data-motion',
                got[key] ? 'reduced' : 'full');
            }
            /* the display switches take effect at once, like reduce motion */
            if (OW.applyPrefs) OW.applyPrefs(got);
          });
      }

      /* ── THE MENU IS THE BACKEND'S, NOT A SECOND COPY OF IT ──────────────
         ★ FOUNDER, 2026-08-26: *"consolidate settings menu and make sure all
           options are working."*

         `SETTING_GROUPS` was this file's OWN description of the menu — which
         groups exist, which rows sit in them, in what order — while the
         canonical settings domain has its own. Two descriptions of one menu,
         and they had already diverged: the backend offered thirteen switches
         and this rendered nine, because four of them (the three "who can reach
         you" channels and the external-activity switch) were simply missing
         from the local list. A person could not turn off a channel the runtime
         was enforcing.

         `/api/oneway/settings/menu/person` is now the shape, and it drops any
         group whose rows are all unwired so a heading never renders empty. The
         local list stays ONLY as the fallback for a runtime that does not serve
         the menu yet, and it deletes the day that is everywhere. */
      var GROUPS = (menuData && menuData.length)
        ? menuData.map(function (g) {
            return [g.group, g.rows.map(function (r) {
              return [r.key, r.label, r.note || '']; })];
          })
        : SETTING_GROUPS;
      GROUPS.forEach(function (grp) {
        var rows = grp[1].filter(function (s) { return s[0] in cur; });
        if (!rows.length) return;          /* a setting the runtime lacks is absent */
        var sec = mk('div', 'ow-cust__row');
        sec.appendChild(mk('span', 'ow-cust__lbl', esc(grp[0])));
        rows.forEach(function (s) {
          var key = s[0];
          var row = mk('button', 'ow-switch');
          row.type = 'button';
          row.setAttribute('aria-pressed', String(!!cur[key]));
          row.innerHTML = '<span class="ow-switch__b">'
            + '<b>' + esc(s[1]) + '</b>'
            + (s[2] ? '<span>' + esc(s[2]) + '</span>' : '')
            + '</span><span class="ow-switch__k" aria-hidden="true"></span>';
          row.addEventListener('click', function () {
            if (row.disabled) return;
            var next = row.getAttribute('aria-pressed') !== 'true';
            row.setAttribute('aria-pressed', String(next));   /* optimistic */
            row.disabled = true;           /* one answer at a time: a quick second
                                              press raced the first, last one won */
            save(key, next, row);
          });
          sec.appendChild(row);
          n++;
        });
        box.appendChild(sec);
      });

      /* ── WHERE YOU ARE, AND WHO CAN SEE IT ──────────────────────────────
         The runtime shipped the founder's location ruling and NOTHING opened
         it. This is that door, and it is built on one principle:

         **EVERY WORD DESCRIBING A PRIVACY CHOICE COMES FROM THE RUNTIME.**
         `GET /api/me/location` returns `audience_words` — a sentence per
         audience — and this surface prints them VERBATIM. It authors none of
         its own. Two descriptions of one setting is how a person shares more
         than they meant to, and the client is the wrong place for the
         authoritative sentence: it can drift from what the server actually
         enforces, and the person would never know which one was true.

         A peer session argued this screen should not be built until the
         founder rules on what `everyone` means, since the runtime currently
         reads it as including SIGNED-OUT strangers and nobody asked for that.
         The concern is right and the conclusion was backwards: not building it
         leaves that decision invisible in a payload. Printing the runtime's own
         sentence — *"anyone on ONEWAY, including people who are not signed
         in"* — puts the unruled choice ON SCREEN where he can see it and rule.
         The screen does not commit to the answer; it displays whatever the
         runtime says, so when he rules, the wording follows with no client
         change.

         AND IT DEFAULTS TO OFF. Nothing is shared until the person says so,
         nothing is pre-selected, and `nobody` DELETES the row rather than
         storing a "no" — an off switch that leaves a record is not off. */
      (function () {
        var sec = mk('div', 'ow-cust__row');
        sec.appendChild(mk('span', 'ow-cust__lbl', 'Where you are'));
        var body = mk('div', 'ow-loc');
        sec.appendChild(body);
        box.appendChild(sec);
        n++;

        data.get('/api/oneway/people/me/location', { fresh: true }).then(function (lr) {
          body.innerHTML = '';
          if (!lr.ok) { body.appendChild(mk('p', 'ow-loc__why',
            'Location sharing is not available right now.')); return; }
          var d = lr.data || {};
          var words = d.audience_words || {};
          var cur = (d.location && d.location.audience) || 'nobody';
          var live = !!d.sharing;

          /* the STATE first, in the runtime's words, because a person opening
             this screen is asking "who can see me right now" before anything */
          var now = mk('p', 'ow-loc__now', live
            ? esc('Sharing with ' + (words[cur] || cur) + '.')
            : esc(d['default'] || 'Off — nothing is shared until you say so.'));
          body.appendChild(now);

          var list = mk('div', 'ow-loc__opts');
          (d.audiences || []).forEach(function (a) {
            var b = mk('button', 'ow-loc__opt'); b.type = 'button';
            b.setAttribute('aria-pressed', String(a === cur && live));
            /* `followers` and `friends` are NOT the same thing and the whole
               difference lives in the sentence — one is everyone who follows
               you, the other is mutual only. The name alone would let a person
               pick the wrong one, so the sentence is not optional chrome. */
            b.appendChild(mk('b', '', esc(a)));
            if (words[a]) b.appendChild(mk('span', '', esc(words[a])));
            b.addEventListener('click', function () { choose(a, b); });
            list.appendChild(b);
          });
          body.appendChild(list);

          if (d.chosen_max) {
            body.appendChild(mk('p', 'ow-loc__why',
              esc('You can name up to ' + d.chosen_max + ' people.')));
          }

          /* ── HOW IT IS SHARED, NOT ONLY WITH WHOM ─────────────────────────
             ★ FOUNDER/493: *"make sure users can choose to share their
               locations and how its shared, device tracking, when using, who
               sees it, yk, also in settings."*

             WHO could be chosen; HOW was decided for them. `choose()` sent
             `mode: 'while_using'` and `precision: 'approximate'` as literals,
             while the runtime has been answering with `modes: [always,
             while_using]` and `precisions: [exact, approximate]` the whole
             time. So the two questions a person most wants to answer about
             their own location — is my phone reporting when the app is shut,
             and is this my street or my building — were answered by a constant
             in this file. That is not a missing feature; it is a decision
             taken on somebody's behalf about where they physically are.

             Both are drawn from the runtime's own lists, so a value added
             there appears here without an edit. The words are ours because the
             runtime sends keys, and a key is not a sentence a person can
             consent to.
             THEY ONLY APPLY TO SOMETHING. With sharing off there is nothing to
             qualify, so the rows are hidden rather than shown inert — a
             control that does nothing yet is a question a person answers
             twice. */
          var MODE_WORDS = {
            while_using: 'Only while I am using ONEWAY',
            always: 'In the background too, even when ONEWAY is closed'
          };
          var PREC_WORDS = {
            approximate: 'Approximate — the area you are in',
            exact: 'Exact — where you actually are'
          };
          var curMode = d.mode || 'while_using';
          var curPrec = (d.location && d.location.precision) || 'approximate';

          function pickRow(label, keys, cur2, words, onPick) {
            if (!keys || keys.length < 2) return;
            var sec2 = mk('div', 'ow-loc__how');
            sec2.appendChild(mk('span', 'ow-loc__howlbl', esc(label)));
            var row = mk('div', 'ow-loc__opts');
            keys.forEach(function (k) {
              var b = mk('button', 'ow-loc__opt'); b.type = 'button';
              b.setAttribute('aria-pressed', String(k === cur2));
              b.appendChild(mk('b', '', esc(k.replace(/_/g, ' '))));
              if (words[k]) b.appendChild(mk('span', '', esc(words[k])));
              b.addEventListener('click', function () { onPick(k, b); });
              row.appendChild(b);
            });
            sec2.appendChild(row);
            body.appendChild(sec2);
          }

          if (live && cur !== 'nobody') {
            pickRow('When', d.modes || [], curMode, MODE_WORDS,
                    function (k, b) { requalify({ mode: k }, b); });
            pickRow('How precisely', d.precisions || [], curPrec, PREC_WORDS,
                    function (k, b) { requalify({ precision: k }, b); });
          }

          /* ONE WRITER. `choose` and this both PUT the same record, so the
             qualifiers are changed by re-stating the whole thing with one
             field different — a partial write here and a full write there is
             how the two would eventually disagree about what is stored. */
          function requalify(patch, btn) {
            btn.disabled = true;
            locate().then(function (pos) {
              return data.post('/api/oneway/people/me/location', {
                lat: pos.lat, lng: pos.lng, audience: cur,
                precision: patch.precision || curPrec,
                mode: patch.mode || curMode
              }, { method: 'PUT' });
            }).then(function (r) {
              if (!r || !r.ok) {
                btn.disabled = false;
                if (OW.toast) OW.toast('That did not change. ' + ((r && r.error) || 'Try again.'));
                return;
              }
              data.invalidate('/api/oneway/people/me/location');
              data.invalidate('/api/oneway/map');
              settings(host);
            }).catch(function () {
              btn.disabled = false;
              if (OW.toast) OW.toast('Your browser did not give a location, so nothing changed.');
            });
          }

          function choose(a, btn) {
            btn.disabled = true;
            /* NOBODY IS A DELETE, not a stored "no" — the same distinction the
               runtime draws, and the reason an off switch here leaves nothing
               behind to leak later. */
            var req = (a === 'nobody')
              ? data.post('/api/oneway/people/me/location', null, { method: 'DELETE' })
              : locate().then(function (pos) {
                  return data.post('/api/oneway/people/me/location', {
                    lat: pos.lat, lng: pos.lng, audience: a,
                    /* the person's own qualifiers are kept when they change
                       WHO can see them — changing the audience must not
                       silently reset how precisely, or for how long */
                    precision: curPrec, mode: curMode
                  }, { method: 'PUT' });
                });
            /* A REFUSAL IS NOT A SUCCESS. `data.post` resolves `{ok:false}`
               rather than rejecting, and this redrew as if every answer were
               yes — so a person who pressed "nobody" and was refused was left
               sharing where they are, with nothing on screen to say so (found
               by the founder/502 sweep). Where somebody physically is, that is
               the one silence this surface cannot have. */
            req.then(function (r) {
              if (!r || !r.ok) {
                btn.disabled = false;
                if (OW.toast) OW.toast((a === 'nobody'
                  ? (live ? 'You are still sharing where you are — that did not go through. '
                          : 'Nothing changed — you were not sharing where you are. ')
                  : 'Who can see where you are did not change. ')
                  + ((r && r.error) || 'Try again.'));
                return;
              }
              data.invalidate('/api/oneway/people/me/location');
              data.invalidate('/api/oneway/map');
              settings(host);            /* redraw from the runtime, not from here */
            }).catch(function () {
              btn.disabled = false;
              if (OW.toast) OW.toast('Your browser did not give a location, so nothing was shared.');
            });
          }

          /* THE BROWSER OWNS THE COORDINATE AND THE PERSON OWNS THE BROWSER.
             The prompt IS the consent step; this never reads a position before
             an audience has been chosen, so nothing is located "just in case". */
          function locate() {
            return new Promise(function (ok, no) {
              if (!global.navigator || !navigator.geolocation) { no(); return; }
              navigator.geolocation.getCurrentPosition(
                function (p) { ok({ lat: p.coords.latitude, lng: p.coords.longitude }); },
                function () { no(); }, { maximumAge: 60000, timeout: 12000 });
            });
          }
        });
      })();

      /* ══ WHO YOU HAVE BLOCKED, AND WHO YOU HAVE MUTED ═══════════════════
         ★ FOUNDER, 2026-09-02: *"Especially don't let the blocked/muted lists
           turn into a new social-graph architecture. They should consume the
           canonical graph that B already established."*

         SO THERE IS NO STATE HERE. Each list is one canonical read, each undo
         is one canonical DELETE, and the list is re-read afterwards rather
         than patched — a local copy of who you blocked is a second answer to a
         question `oneway.graph` already owns, and a second answer is how the
         follow split-brain started.

         BLOCKING WAS INVOCABLE AND NOT REVIEWABLE. The controls went in on
         2026-09-01 (a profile's More → Block), but a person could only see a
         block by visiting the profile of somebody they had deliberately made
         hard to find. A safety control you cannot audit is half a control. */
      (function () {
        [['blocked', 'Blocked', 'block', 'You have not blocked anyone.'],
         ['muted', 'Muted', 'mute', 'You have not muted anyone.']
        ].forEach(function (t) {
          var slug = t[0], title = t[1], kind = t[2], empty = t[3];
          var row = mk('div', 'ow-cust__row ow-cust__row--stack');
          row.appendChild(mk('span', 'ow-cust__lbl', title));
          var list = mk('div', 'ow-people');
          row.appendChild(list);
          box.appendChild(row); n++;

          function draw(before, append) {
            if (!append) list.innerHTML = '';
            return data.get('/api/oneway/graph/me/' + slug + '?limit=25'
                            + (before ? '&before=' + encodeURIComponent(before) : ''),
                            { fresh: true }).then(function (r) {
              if (!r.ok) {
                list.appendChild(mk('p', 'ow-people__none',
                  esc('Could not read this list.')));
                return;
              }
              var d = r.data || {};
              /* UNKNOWN IS NOT EMPTY (founder/350). `readable:false` means the
                 store could not be read — printing "you have not blocked
                 anyone" over that would be the most dangerous false zero on
                 this whole surface. */
              if (d.readable === false) {
                list.appendChild(mk('p', 'ow-people__none',
                  esc('This list could not be read, so it is not shown. It is '
                      + 'not empty — it is unknown.')));
                return;
              }
              var people = d.people || [];
              if (!people.length && !append) {
                list.appendChild(mk('p', 'ow-people__none', esc(empty)));
                return;
              }
              people.forEach(function (who) {
                var em = who.email || '';
                var r2 = mk('div', 'ow-person');
                var av = mk('span', 'ow-person__av');
                if (OW.faceMark) av.innerHTML = OW.faceMark();   /* founder/495 */
                else av.textContent = OW.initials ? OW.initials(em) : '?';
                r2.appendChild(av);
                var b = mk('div', 'ow-person__b');
                /* THE NAME IS NOT IN THIS CONTRACT — the rows carry
                   `{email, at, note}` and nothing else. The local part is the
                   honest rendering of what was actually returned; inventing a
                   display name, or fetching one per row, would be a second
                   read of a fact this list does not carry. Asked B for
                   `{email, name}`. */
                b.appendChild(mk('span', 'ow-person__nm', esc(em.split('@')[0])));
                if (who.at) b.appendChild(mk('span', 'ow-person__t',
                  esc(whenWords(who.at))));
                r2.appendChild(b);
                var undo = mk('button', 'po-act',
                              kind === 'block' ? 'Unblock' : 'Unmute');
                undo.type = 'button';
                undo.addEventListener('click', function () {
                  undo.disabled = true; undo.textContent = 'Undoing…';
                  data.del('/api/oneway/graph/' + kind + '/' + encodeURIComponent(em))
                    .then(function (rr) {
                      if (!rr.ok) {
                        undo.disabled = false;
                        undo.textContent = kind === 'block' ? 'Unblock' : 'Unmute';
                        OW.say(undo, 'That did not save');
                        return;
                      }
                      data.invalidate('/api/oneway/graph');
                      if (kind === 'block') data.invalidate('/api/oneway/messaging');
                      /* RE-READ, NEVER PATCH. The graph is the answer; this
                         surface is a window onto it. */
                      draw('', false);
                    });
                });
                r2.appendChild(undo);
                list.appendChild(r2);
              });
              if (d.next_cursor) {
                var more = mk('button', 'po-act ow-people__more', 'More');
                more.type = 'button';
                more.addEventListener('click', function () {
                  more.remove(); draw(d.next_cursor, true);
                });
                list.appendChild(more);
              }
            });
          }
          draw('', false);
        });
      })();

      host.appendChild(box);
      return n;
    });
  }

  function appearance(host, style, email) {
    var box = mk('div', 'ow-cust');

    /* The PUT takes the WHOLE style, so send the whole thing — `style` is the
       live record and every control mutates it before calling this. Sending
       only the changed key would silently reset everything else to defaults,
       which is the same silent-loss-at-a-boundary shape that dropped bg_url. */
    /* ── THE HUE HAS ONE OWNER AND IT IS THE NEW BACKEND ──────────────────
       ★ FOUNDER, 2026-09-10: *"DO IT RIGHT!!! NEW BACKEND ONLY!"*

       The picker saved the hue through `PUT /api/me/profile-style` — the
       legacy monolith's whole-style record — while `people/appearance` is the
       declared canonical owner and its own docstring calls itself "THE
       CANONICAL DOOR ONTO A HUE THAT ALREADY HAD ONE OWNER". Writing the
       colour through the legacy door is how one fact came to have three
       stores in the first place.

       The hue now goes to `PUT /api/oneway/people/me/appearance` and nowhere
       else. Everything ELSE on this panel — banner, background, avatar shape —
       still uses the style record, because those genuinely live there and
       moving them is a separate migration with its own readers to check. */
    function saveHue(angle) {
      style.accent_hue = angle;
      return data.put('/api/oneway/people/me/appearance', { hue: angle })
        .then(function (r) {
          /* THE COLOUR IS ALREADY ON SCREEN, so a failed save must not be
             silent — the person would carry a colour this device believes in
             and no other device has. The panel says so where it says
             everything else. */
          /* `say` is not in scope on this panel (founder/502 sweep: an AST
             scope walk), so this message could never show; the bar can */
          if (!r.ok && OW.toast) OW.toast('That colour did not save to your account — it shows only on this device. Try again.');
          data.invalidate('/api/oneway/people/');
          data.invalidate('/api/oneway/people/');
          return r;
        });
    }

    function save(patch) {
      var body = {};
      Object.keys(style).forEach(function (k) { body[k] = style[k]; });
      Object.keys(patch || {}).forEach(function (k) { body[k] = patch[k]; });
      /* ── THE HUE DOES NOT TRAVEL THROUGH THIS DOOR ────────────────────────
         The note above says the colour "now goes to PUT
         /api/oneway/people/me/appearance and nowhere else", and it was half
         true: `saveHue` writes canonically, and then THIS function sends the
         WHOLE style record — `accent_hue` included — every time somebody
         changes a banner, a background or an avatar shape.

         MEASURED 2026-09-12 on the running gateway, and it is not theoretical:
             canonical hue before   210
             PUT /api/me/profile-style {accent_hue: 99, ...}
             canonical hue after     99
         The legacy style door IS a second writer of the canonical hue. So
         changing your banner silently rewrote your colour to whatever this
         record happened to be carrying — and what it carries is often the
         platform default, because that is what the style row answers for the
         1,255 accounts in 1,260 who never chose one.

         That is the founder's own bug wearing a different hat: *"im checking
         if user hue in settings changes whole platform still doesnt"*. One
         fact, one writer — so the key is dropped here rather than sent. The
         local `style.accent_hue` stays for the swatches to read; it simply
         never leaves through this door.

         B has the other half: this route should refuse `accent_hue` outright,
         since `people/appearance` is the declared owner. Until it does, this
         line is what stops the App being the thing that calls it. */
      delete body.accent_hue;
      return data.post('/api/oneway/people/me/style', { style: body }, { method: 'PUT' })
        .then(function (r) {
          /* the server is the authority on what it kept — and it now reports
             what it refused, so a dropped field is visible instead of silent */
          if (r.ok && r.data && r.data.style) {
            Object.keys(r.data.style).forEach(function (k) { style[k] = r.data.style[k]; });
          }
          /* every caller of this ignores its answer, so it says a refusal
             itself — a banner or a shape that did not save is on this
             device only (founder/502 sweep) */
          if (!r.ok && OW.toast) OW.toast('That did not save to your account — it shows only on this device. Try again.');
          data.invalidate('/api/oneway/people/');
          return r;
        });
    }

    /* ── EVERY DISPLAY SETTING IS CHOSEN HERE ──────────────────────────────
       ★ FOUNDER, 2026-09-10: *"ALL SHOULD SYNC!! light mode dark mode simple
         mode galaxy and all other display settings will be chosen here."*

       They existed and they were not here. `OW.theme`, `OW.simple` and
       `OW.world` are already the ONE writer for each — each persists its own
       key and stamps its own attribute on `<html>` — but the only way to reach
       them was a header button and Settings. Appearance, the page named for
       how the platform looks, offered colour, banner and avatar and nothing
       about light, dark, simple or galaxy.

       NOTHING NEW IS INVENTED HERE. These rows call the existing writers, so
       there is no second source of truth to drift: flip simple mode here or
       anywhere else and both places agree, because both are reading the same
       function. That is the whole reason this is a handful of rows and not a
       settings system. */
    function choiceRow(label, options, read, write) {
      var row = mk('div', 'ow-cust__row');
      row.appendChild(mk('span', 'ow-cust__lbl', label));
      var group = mk('div', 'ow-swatches ow-choice');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', label);
      options.forEach(function (o) {
        var b = mk('button', 'po-act', o.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(read() === o.value));
        b.addEventListener('click', function () {
          write(o.value);
          Array.prototype.forEach.call(group.children, function (x) {
            x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          b.setAttribute('data-act', 'on');
          Array.prototype.forEach.call(group.children, function (x) {
            if (x !== b) x.removeAttribute('data-act'); });
        });
        if (read() === o.value) b.setAttribute('data-act', 'on');
        group.appendChild(b);
      });
      row.appendChild(group);
      box.appendChild(row);
    }

    /* LIGHT · DARK · DEVICE. "Device" is a real third answer — it means follow
       the phone — and clearing the stored choice is how it is expressed, which
       is why it cannot be a two-way switch. */
    choiceRow('Theme',
      [{ label: 'Device', value: '' },
       { label: 'Light', value: 'light' },
       { label: 'Dark', value: 'dark' }],
      function () { try { return localStorage.getItem('ow_theme') || ''; } catch (e) { return ''; } },
      function (v) { if (OW.theme) OW.theme.set(v || null); });

    /* GALAXY OR PLAIN — the world behind everything. */
    choiceRow('World',
      [{ label: 'Galaxy', value: 'galaxy' }, { label: 'Plain', value: 'plain' }],
      function () { return (OW.world && OW.world.get()) || 'galaxy'; },
      function (v) { if (OW.world) OW.world.set(v); });

    /* SIMPLE — the familiar layout, without the Popit presentation. */
    choiceRow('Layout',
      [{ label: 'ONEWAY', value: 'full' }, { label: 'Simple', value: 'simple' }],
      function () { return (OW.simple && OW.simple.get()) ? 'simple' : 'full'; },
      function (v) { if (OW.simple) OW.simple.set(v === 'simple'); });

    /* ── HOW YOUR NAME IS SET ─────────────────────────────────────────────
       ★ FOUNDER, 2026-09-10: *"custom wordmarks on peoples profiles and posts
         like apple music now does"* and *"all should sync… all other display
         settings will be chosen here."*

       IT LIVES HERE because this panel is where every display decision is
       made, and a wordmark is one. The faces come from the platform
       (`/api/oneway/people/wordmarks`) rather than a list kept in this file:
       a second catalogue would be one release from disagreeing with the one
       the server validates against, and the write would start refusing
       choices the picker offered.

       EACH BUTTON IS SET IN ITS OWN FACE, which is the only honest way to
       show a typeface — a list of names in one font tells somebody nothing
       about what they are choosing, and this is exactly what he could not
       judge before: *"i barley saw the fonts"*. */
    (function wordmarkRow() {
      var row = mk('div', 'ow-cust__row');
      row.appendChild(mk('span', 'ow-cust__lbl', 'Your name'));
      var group = mk('div', 'ow-swatches ow-choice ow-wmpick');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'How your name is set');
      row.appendChild(group);
      box.appendChild(row);

      /* THE CATALOGUE AND WHAT THEY CURRENTLY WEAR, together. The profile read
         is the one this shell already made at boot, so it is served from cache
         and costs nothing — and taking the current face from the SAME place
         every surface draws it from means the picker cannot show one answer
         while the profile header shows another. */
      Promise.all([
        data.get('/api/oneway/people/wordmarks'),
        email ? data.get('/api/oneway/people/' + encodeURIComponent(email) + '/profile')
              : Promise.resolve({ ok: false })
      ]).then(function (rs) {
        var r = rs[0], mine = rs[1];
        var faces = (r.ok && r.data && r.data.faces) || [];
        if (!faces.length) {
          /* NOTHING INVENTED WHEN THE CATALOGUE CANNOT BE READ. The row is
             removed rather than filled with guesses, because a picker showing
             faces the server will refuse is worse than no picker. */
          if (row.parentNode) row.parentNode.removeChild(row);
          return;
        }
        var current = ((((mine.ok && mine.data && mine.data.person) || {})
                        .wordmark) || {}).key || 'default';
        faces.forEach(function (f) {
          var b = mk('button', 'po-act', esc(f.label));
          b.type = 'button';
          /* THE BUTTON IS THE SPECIMEN. The default is the platform's own
             face — wearWordmark leaves a default name untouched, so it draws
             in ONEWAY Sans — and its specimen says so, whatever family the
             catalogue row still names (founder/530). */
          b.style.fontFamily = f.key === 'default' ? 'var(--ow-font)' : f.stack;
          if (f.weight) b.style.fontWeight = String(f.weight);
          b.setAttribute('aria-pressed', String(current === f.key));
          if (current === f.key) b.setAttribute('data-act', 'on');
          b.addEventListener('click', function () {
            current = f.key;
            Array.prototype.forEach.call(group.children, function (x) {
              x.setAttribute('aria-pressed', 'false');
              x.removeAttribute('data-act');
            });
            b.setAttribute('aria-pressed', 'true');
            b.setAttribute('data-act', 'on');
            data.patch('/api/oneway/people/me', { wordmark: f.key })
              .then(function (res) {
                if (!res.ok) {
                  if (OW.toast) OW.toast('That face did not save to your account — it shows only on this device. Try again.');
                  return;
                }
                /* EVERY SURFACE THAT DRAWS THE NAME MUST RE-READ, including
                   the feed: a post card carries its author's face. */
                data.invalidate('/api/oneway/people/');
                data.invalidate('/api/oneway/social/');
                data.invalidate('/api/oneway/home');
              });
          });
          group.appendChild(b);
        });
      });
    })();

    /* THE HUE — the one decision that changes everything else. Twelve steps
       around the wheel: enough to find yourself in, few enough to choose from. */
    var row1 = mk('div', 'ow-cust__row');
    row1.appendChild(mk('span', 'ow-cust__lbl', 'Your colour'));
    var sw = mk('div', 'ow-swatches');
    for (var a = 0; a < 360; a += 30) (function (angle) {
      var pair = OW.hue.fromAngle(angle);
      var b = mk('button', 'ow-sw'); b.type = 'button';
      b.style.background = 'linear-gradient(140deg,rgb(' + pair[0] + '),rgb(' + pair[1] + '))';
      b.setAttribute('aria-label', 'Hue ' + angle);
      b.setAttribute('aria-pressed', String(Number(style.accent_hue) === angle));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(sw.children, function (x) {
          x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        style.accent_hue = angle;
        /* ── PICKING A COLOUR CHANGES WHO YOU ARE, NOT JUST WHAT IS PAINTED ──
           ★ FOUNDER, 2026-09-10: *"im checking if user hue in settings changes
             whole platform still doesnt!! WHY THE HELL!!!"*

           This TWEENED and wrote localStorage and never told the identity layer
           anything. `ctxPair` and `ownAngle` — the viewer's own colour — are
           written only by `hue.bind`, and they are exactly what
           `hue.context('personal')` restores on EVERY navigation. So the pick
           repainted the surface, and the first dock press handed back the hue
           the App booted with.

           MEASURED before the fix: picked 270 here, then Home 150, Discovery
           150, Messages 150. The colour was never wrong on this page, which is
           the only page anybody tests it on.

           `hue.bind` is the one writer of the viewer's identity — it sets
           boundAngle, ownAngle and ctxPair, and persists `ow_user_hue` itself,
           so the manual localStorage write here is gone with it. It takes the
           450ms now so the change is still SEEN happening. */
        OW.hue.bind({ angle: angle, ms: 450 });
        saveHue(angle);
      });
      sw.appendChild(b);
    })(a);
    /* AND A COLOUR OF THEIR OWN. Twelve swatches are enough to find yourself in
       and not enough to BE yourself in: every one is saturation 100 at lightness
       68, so nothing muted, nothing dark and no brand colour was reachable. The
       native picker is deliberate — it is the control every platform already
       gives people, including eyedroppers and their own saved palettes, and
       rebuilding it worse is the definition of inventing a second way. */
    var cust = mk('button', 'ow-sw ow-sw--custom'); cust.type = 'button';
    cust.setAttribute('aria-label', 'Choose your own colour');
    var pick = mk('input'); pick.type = 'color'; pick.className = 'ow-sw__pick';
    pick.value = OW.hue.hexOf(style) || '#7c2dff';
    cust.appendChild(pick);
    pick.addEventListener('input', function () {
      var h1 = OW.hue.fromHex(pick.value); if (!h1) return;
      var h2 = OW.hue.mate(h1);
      Array.prototype.forEach.call(sw.children, function (x) {
        x.setAttribute('aria-pressed', 'false'); });
      cust.setAttribute('aria-pressed', 'true');
      cust.style.background = 'linear-gradient(140deg,rgb(' + h1 + '),rgb(' + h2 + '))';
      /* seen immediately, saved when they stop dragging — a write per frame of
         a colour wheel is the cost law broken in the most literal way */
      OW.hue.bind({ pair: { h1: h1, h2: h2 } });
      style.accent_hex1 = pick.value; style.accent_hex2 = '#' + h2.split(',')
        .map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
      clearTimeout(pick.__t);
      pick.__t = setTimeout(function () {
        save({ accent_hex1: style.accent_hex1, accent_hex2: style.accent_hex2 });
      }, 420);
    });
    if (OW.hue.hexOf(style)) {
      var c1 = OW.hue.fromHex(OW.hue.hexOf(style));
      cust.setAttribute('aria-pressed', 'true');
      cust.style.background = 'linear-gradient(140deg,rgb(' + c1 + '),rgb('
        + OW.hue.mate(c1) + '))';
    }
    sw.appendChild(cust);

    /* picking a wheel colour CLEARS the custom one, or the exact colour would
       outrank the swatch they just pressed and nothing would appear to happen */
    Array.prototype.forEach.call(sw.children, function (b) {
      if (b === cust) return;
      b.addEventListener('click', function () {
        cust.setAttribute('aria-pressed', 'false');
        style.accent_hex1 = ''; style.accent_hex2 = '';
        save({ accent_hex1: '', accent_hex2: '' });
      });
    });

    row1.appendChild(sw);
    box.appendChild(row1);

    /* THE BANNER — theirs, uploaded. Previously used banners stay pickable, so
       changing back is one tap and nothing is lost. */
    var row2 = mk('div', 'ow-cust__row');
    row2.appendChild(mk('span', 'ow-cust__lbl', 'Banner'));
    var picks = mk('div', 'ow-picks');
    function paintPicks() {
      picks.innerHTML = '';
      (style.banner_urls || []).forEach(function (url) {
        var b = mk('button', 'ow-pick'); b.type = 'button';
        b.setAttribute('aria-pressed', String(style.banner_url === url));
        var im = doc.createElement('img'); im.src = imageUrl(url); im.alt = ''; im.loading = 'lazy';
        b.appendChild(im);
        b.addEventListener('click', function () {
          style.banner_url = url; style.banner_customized = true;
          paintPicks(); save({ banner_url: url, banner_customized: true });
          var live = doc.querySelector('.ow-banner img');
          if (live) live.src = imageUrl(url);
        });
        picks.appendChild(b);
      });
    }
    paintPicks();
    row2.appendChild(picks);

    var up = mk('label', 'ow-upload', '<span>Upload a banner</span>');
    var inp = doc.createElement('input');
    inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      up.setAttribute('data-busy', '1');
      up.firstChild.textContent = 'Uploading…';
      var fr = new FileReader();
      fr.onload = function () {
        data.post('/api/me/profile-banner', { data: fr.result, kind: 'banner' })
          .then(function (r) {
            up.removeAttribute('data-busy');
            if (!r.ok) { up.firstChild.textContent = 'That did not upload'; return; }
            up.firstChild.textContent = 'Upload a banner';
            var url = (r.data || {}).url || '';
            if (!url) return;
            style.banner_urls = [url].concat(style.banner_urls || []).slice(0, 12);
            style.banner_url = url; style.banner_customized = true;
            paintPicks(); save({ banner_url: url, banner_customized: true });
            var live = doc.querySelector('.ow-banner img');
            if (live) { live.src = imageUrl(url); }
            else {
              var ban = doc.querySelector('.ow-banner');
              if (ban) {
                var n = doc.createElement('img'); n.src = imageUrl(url); n.alt = '';
                ban.insertBefore(n, ban.firstChild);
                ban.insertBefore(mk('span', 'ow-banner__hue'), ban.lastChild);
              }
            }
          });
      };
      fr.readAsDataURL(f);
    });
    up.appendChild(inp);
    row2.appendChild(up);
    row2.appendChild(mk('p', 'ow-door__why',
      'Your own picture, or one you have used before. Your colour washes over '
      + 'it so the place still reads as yours.'));
    box.appendChild(row2);

    /* THE AVATAR SHAPE — small, but it is the thing people recognise first */
    var row3 = mk('div', 'ow-cust__row');
    row3.appendChild(mk('span', 'ow-cust__lbl', 'Avatar'));
    var shapes = mk('div', 'ow-swatches');
    ['round', 'rounded', 'square'].forEach(function (s) {
      var b = mk('button', 'ow-sw'); b.type = 'button';
      b.style.borderRadius = s === 'round' ? '50%' : (s === 'square' ? '5px' : '11px 9px 12px 10px');
      b.style.background = 'linear-gradient(150deg,rgb(var(--ow-h1)),rgba(var(--ow-h2),.75))';
      b.setAttribute('aria-label', s); b.title = s;
      /* a circle unless they chose otherwise (founder/471 §6) — the picker
         marks the same default every face already draws */
      b.setAttribute('aria-pressed', String((style.avatar_shape || 'round') === s));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(shapes.children, function (x) {
          x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        style.avatar_shape = s; save({ avatar_shape: s });
        /* THE CUT HAS ONE OWNER NOW — people.appearance, beside the picture
           (founder/409). The legacy style row is written above for every
           surface that still reads it; the canonical door is what the
           composed profile and every card answer from. */
        try { data.patch('/api/oneway/people/me', { shape: s }); } catch (e) {}
        var av = doc.querySelector('.ow-avatar');
        if (av) av.setAttribute('data-shape', s);
      });
      shapes.appendChild(b);
    });
    row3.appendChild(shapes);
    box.appendChild(row3);

    host.appendChild(box);
    return 4;
  }

  /* 4.3 — A CENTER, opened from the App. Same shape as a profile, because a
     Center met in the App IS a profile of a place (Center Site · App · OS are
     three views of one reality). The bars carry the six-stage journey the
     experience read already returns; `participation` still decides which ways
     a relationship can honestly begin. */
  /* ═══ THE PERSON'S OWN SURFACES, AS REAL DESTINATIONS ══════════════════
     ★ FOUNDER, 2026-08-26: *"Every App menu destination must become a real
       page... dedicated route or page state, independent composition,
       navigation/back behavior, deep-linkability, persistence after reload."*

     They were panel states inside My Center — `show({id:'__settings'})` swapped
     the panel and nothing else. No URL, so a reload landed back on Profile, a
     link could not be shared, and Back left the App rather than the surface.
     That is a subsection wearing a page's clothes, which is exactly what the
     founder said not to build.

     ONE ENTRY POINT PER SURFACE, so the router and the gear call the SAME
     thing. A destination reachable two ways that each build it differently is
     the drift this whole architecture exists to stop.

     EACH FETCHES WHAT IT NEEDS. A deep link arrives with no profile in hand, so
     these cannot depend on My Center having run first — that dependency is
     precisely what made them subsections. */
  function ownStyle() {
    return data.get('/api/oneway/people/me/style').then(function (r) {
      return (r.ok && r.data && r.data.style) || {};
    }).catch(function () { return {}; });
  }

  /* THE UNDERSTANDING PANE, EXTRACTED. It was inline in a tab, which meant
     the only way to render it was to be a tab — so the routed surface would
     have needed a second copy. One function, two callers. */
  function brainPane(pane) {
            /* TWO READS, TWO FATES — the narrative is allowed to fail without
               costing a person the sight of their own graph (§4.2c-b) */
            return Promise.all([
              data.get('/api/oneway/people/me/brain'),
              data.get('/api/oneway/people/me/brain/narrative')
                .catch(function () { return { ok: false }; })
            ]).then(function (res) {
              var r = res[0], nar = res[1];
              if (!r.ok) { refused(pane, r, 'Your understanding'); return 0; }
              /* the Brain's own sentence comes FIRST — understanding before
                 counting, which is the order INTELLIGENCE.md puts them in */
              brainVoice(pane, nar);
              var d = r.data || {}, t = d.totals || {}, nodes = d.nodes || [];
              /* founder/542 sweep: a new person met four ways of saying
                 "nothing yet" — the Brain's sentence, three tiles of 0, and the
                 empty state. With nothing to count, only the empty state. */
              var anything = nodes.length || (t.destinations || 0) || (t.made || t.shared || 0) || (t.friends || 0);
              if (anything) pane.appendChild(mk('p', 'ow-cust__lbl',
                esc('What ONEWAY understands about your world')));
              if (anything) factList(pane, [
                { id: 'ub-dest', value: String(t.destinations || 0),
                  label: 'places you belong to', icon: 'place', open: false },
                { id: 'ub-made', value: String(t.creations || 0) + (t.creations_more ? '+' : ''),
                  label: 'things you have made and shared', icon: 'spark', open: false },
                { id: 'ub-frnd', value: String(t.friends || 0),
                  label: 'friends — people who follow you back', icon: 'people', open: false }
              ], '', null);
              if (!nodes.length) {
                /* THE HONEST EMPTY. Never "your Brain is still learning",
                   which implies work is happening somewhere. Nothing is
                   happening: nothing has happened yet. */
                nothing(pane,
                  'This fills in as you join places, share what you make and '
                  + 'people follow you back. It only shows what actually happened.',
                  'Nothing yet');
                /* you can ask it even when it knows nothing — and it will say
                   so, in the runtime's own words rather than a stalling UI */
                brainAsk(pane);
                return 1;
              }
              /* ── A BRAIN NODE IS A THING THAT HAPPENED, SO IT OPENS ──────
                 (founder, 2026-08-16: "you need to get things on the app
                 actually openable".)

                 This threw away TWO fields the read was already sending. Every
                 node from `/api/me/brain` carries its own `id` and an `opens`
                 verb — measured: a Creation sends `post_6eeea180968045 /
                 opens:post`, a Destination sends `comm_ea875825bf21 /
                 opens:destination`. The renderer replaced the id with the row's
                 POSITION (`'ub-n-' + i`) and hardcoded `open:false`.

                 So the Brain listed the things a person had done and let them
                 reach none of them — including, until the runtime session fixed
                 the missing verb today, the posts they had written themselves.
                 That is the third and last surface in this file built on a
                 synthesised key; the other two were "where you have been" and
                 "crossed paths".

                 THE VERB DECIDES, NEVER THE TYPE NAME. `opens` is the runtime's
                 own statement about what this node can become, so a node it
                 does not consider openable stays shut — Collection and Growth
                 are SUMMARIES, and marking a summary openable is a worse lie
                 than leaving a real thing closed. */
              var list = mk('div');
              factList(list, nodes.slice(0, 24).map(function (n, i) {
                return { id: n.id || ('ub-n-' + i),
                         value: n.name || n.type,
                         label: [n.type, n.meta].filter(Boolean).join(' · '),
                         icon: n.type === 'Destination' ? 'place'
                             : (n.type === 'Creation' ? 'spark' : 'people'),
                         opens: n.opens || '', nodeId: n.id || '' };
              }), 'Nothing here yet.', openNode);
              function openNode(r, el) {
                if (!r.nodeId || !r.opens) return;      /* a summary stays shut */
                /* THE ROW IS THE ORIGIN, AND THAT IS NOT COSMETIC. Passing null
                   here made a REFUSAL silent: `Food & Dining` is a platform
                   built-in whose public experience read answers 404, so the
                   node routed correctly, the read honestly declined, and the
                   person saw a row that did nothing at all. A Popit also
                   unfolds FROM its origin — with no element there is no beam
                   and no fold-back either. Every branch gets the row. */
                if (r.opens === 'destination') {
                  openCenterPopit(r.nodeId, el);
                } else if (r.opens === 'user') {
                  if (opts && opts.onPerson) opts.onPerson(r.nodeId);
                } else if (r.opens === 'post') {
                  /* the same room a post opens from the feed or a profile —
                     one description of what opening a post means */
                  data.get('/api/posts/' + encodeURIComponent(r.nodeId))
                    .then(function (res) {
                      var po = res.ok && res.data && (res.data.post || res.data);
                      if (po && (po.body || po.title)) OW.open(postPayload(po), el);
                      else OW.say(el, 'that post is no longer here');
                    });
                }
              }
              pane.appendChild(list);
              brainStrongest(pane, openNode);   /* what it MEASURED, after what it counted — and it opens the same way */
              brainAsk(pane);
              return nodes.length;
            });
  }

  /* ═══ NOTIFICATIONS — a destination, because nothing rendered them ═══════
     ★ FOUNDER, 2026-08-26: *"next to it should be the notification button, on
       the right side corner."*

     `/api/me/notifications` has existed and ONE surface read it — Workspace,
     for a count. The list itself had no window anywhere in the App, which is
     this repo's signature failure: a capability built with nothing showing it
     to anyone. A bell that opens nothing would have been the same failure with
     a button on it.

     FIVE HONEST STATES, not one empty list. "Nothing yet", "we could not read
     this" and "you are not signed in" are three different facts about a
     person's day and the interface must not render them identically. */
  /* ═══ HIGHLIGHTS AND PLAYLISTS ═══════════════════════════════════════════
     ★ FOUNDER, 2026-08-30: *"Use established interaction conventions wherever
       users already understand the object. Oneway's differentiation should
       primarily come through material, composition, animation, and
       integration — not by forcing users to learn unfamiliar interactions."*

     So: a Highlight is a CIRCLE with a cover and a title under it, and tapping
     it opens a vertical viewer. A Playlist is a CARD with a cover, a title and
     a count, and tapping it plays through in order. Anybody arriving from
     Instagram or YouTube knows both before they notice we have redesigned
     anything — the Oneway part is the material and the light, not the grammar.

     NEITHER IS A POST. They are profile objects that REFERENCE canonical
     Posts, which is why nothing here renders a body: a row of covers that
     joined every Post would be the N+1 the architecture exists to prevent.
     `resolve=false` on the list; the viewer resolves when one is opened. */
  /* ═══ HIGHLIGHTS AND PLAYLISTS ═══════════════════════════════════
     ★ FOUNDER, 2026-08-30: *"highlights and playlists should feel like they are
       apart of the same plane as the popits and stickers not seperate catagories
       that people can freely move around and arrange."*

     THIS FILE OWNS THE VIEWER AND NOTHING ELSE. The first pass also owned a rail
     of circles and a grid of cards, mounted above the profile's widgets. That
     was the separate category: it sat on top of the person's arrangement, it
     could not be moved, and it meant one object had two presentations that would
     drift the first time either changed.

     A Highlight is now a PLACEMENT on the canvas — `kind:"collection"` — dragged,
     resized and snapped by the same code as every Popit beside it, drawn by
     `canvas.js`, stored by the canvas domain. What is left here is the thing a
     canvas tile cannot be: the full-screen sequence you open when you tap one. */
  /* ── THE VIEWER ────────────────────────────────────────────────────────
     One vertical viewer for both, because Stories and a playlist are the same
     interaction: a sequence you move through and leave. Familiar controls —
     tap right for next, left for previous, Escape or the close button to
     leave — and it returns to EXACTLY where the profile was, which is the part
     people notice only when it is missing. */
  /* THE CANVAS TILE ANNOUNCES AN INTENT AND THIS ROUTES IT — the same seam
     `ow:open-event` and `ow:enter-center` already use, so `canvas.js` still
     knows nothing about the App shell and the viewer has exactly one owner. */
  doc.addEventListener('ow:open-collection', function (e) {
    var id = e && e.detail && e.detail.id;
    if (id) openCollection(id);
  });

  /* A POST OPENED FROM A CANVAS TILE IS THE SAME OPEN AS ANY OTHER.
     ★ FOUNDER, 2026-08-30: *"It should literally be a projection of the same
       Post object."* — which has to hold for the PRESS as well as the paint.
     A Latest tile that opened some lesser reader would make the projection a
     lie at the one moment a person tests it. So the origin travels through and
     the App's own opener runs, animation included. */
  doc.addEventListener('ow:open-post', function (e) {
    var d = (e && e.detail) || {}, id = d.id;
    if (!id) return;
    /* THE HOST'S ROUTER LEADS, AND THE ORDER IS NOT ARBITRARY. Both openers
       exist on the App shell: `window.openPost` walks the shell to the Post
       surface and updates the route, and `OW.feed.openPost` mounts the feed's
       own overlay. Measured 2026-09-02 on oneway-app.html: asking `OW.feed`
       first returned a function, ran, changed nothing and threw nothing — a
       real tap on a Latest card did NOTHING while every seam under it reported
       success. Calling `window.openPost` with the same id went straight to
       #post/… with the body, the likes and the comments.

       So the page it is embedded in gets first refusal, because that is the
       thing that owns the route; `OW.feed` remains the answer on a surface
       that has no shell router of its own. */
    var open = global.openPost || (OW.feed && OW.feed.openPost);
    if (typeof open === 'function') { open(id, d.from); return; }
    /* No opener on this page is a routing gap, not a reason to invent a
       viewer here — say so once rather than failing silently. */
    try { console.warn('ow:open-post — no opener mounted on this surface'); } catch (_) {}
  });

  function openCollection(cid) {
    var atY = global.scrollY || 0;
    var scrim = mk('div', 'ow-cvw');
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.innerHTML =
        '<button class="ow-cvw__x" type="button" aria-label="Close">\u00d7</button>'
      + '<div class="ow-cvw__bars" aria-hidden="true"></div>'
      + '<div class="ow-cvw__head"></div>'
      + '<div class="ow-cvw__body"></div>'
      + '<button class="ow-cvw__nav ow-cvw__nav--prev" type="button" aria-label="Previous"></button>'
      + '<button class="ow-cvw__nav ow-cvw__nav--next" type="button" aria-label="Next"></button>';
    doc.body.appendChild(scrim);
    doc.documentElement.setAttribute('data-viewer', 'open');

    var items = [], at = 0;
    var body = scrim.querySelector('.ow-cvw__body');
    var head = scrim.querySelector('.ow-cvw__head');
    var bars = scrim.querySelector('.ow-cvw__bars');

    function close() {
      doc.documentElement.removeAttribute('data-viewer');
      doc.removeEventListener('keydown', onKey, true);
      scrim.remove();
      /* BACK TO THE EXACT POSITION. A viewer that returns you to the top of a
         profile has lost your place, and on a long profile that is the whole
         session. */
      try { global.scrollTo(0, atY); } catch (e) {}
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    }
    function go(d) {
      if (!items.length) return;
      var n = at + d;
      /* PAST THE END IS THE EXIT, which is what a Story viewer does. */
      if (n < 0) return;
      if (n >= items.length) { close(); return; }
      at = n; paint();
    }
    function paint() {
      /* THE CLASS IS RE-ASSERTED HERE, AND IT IS NOT DEFENSIVE NOISE.
         `loading()` starts with `host.className = ''` — every surface that
         calls it hands over a node it is willing to have cleared. This viewer
         hands it `.ow-cvw__body`, whose class carries the entire layout: the
         grid row, the centring, the padding, the media sizing. So the first
         `loading()` silently stripped it and the viewer rendered its words
         jammed under the header with no styling at all, which is what it was
         doing when it was measured — `cls: ""` on the body element.

         Measured, not guessed: reading the viewer's children back from the
         live document showed an empty className where the layout should be. */
      body.className = 'ow-cvw__body';
      var p = items[at] || {};
      bars.innerHTML = items.map(function (_, i) {
        return '<i' + (i <= at ? ' data-on=""' : '') + '></i>'; }).join('');
      var who = (p.author && (p.author.name || p.author.email)) || '';
      head.innerHTML = (who ? '<b>' + esc(who) + '</b>' : '')
        + (p.created_at ? '<span>' + esc(OW.when(p.created_at)) + '</span>' : '');
      var media = (p.media || [])[0];
      var url = media && OW.imageUrl(media.url || media);
      body.innerHTML = (url
          ? (/\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url)
              ? '<video src="' + esc(url) + '" autoplay playsinline controls></video>'
              : '<img src="' + esc(url) + '" alt=""/>')
          : '')
        + '<div class="ow-cvw__words">'
        + (p.title ? '<h2>' + esc(p.title) + '</h2>' : '')
        + (p.body ? '<p>' + esc(p.body) + '</p>' : '')
        + '</div>';
    }

    scrim.querySelector('.ow-cvw__x').addEventListener('click', close);
    scrim.querySelector('.ow-cvw__nav--next').addEventListener('click', function () { go(1); });
    scrim.querySelector('.ow-cvw__nav--prev').addEventListener('click', function () { go(-1); });
    doc.addEventListener('keydown', onKey, true);

    loading(body, 1);
    body.className = 'ow-cvw__body';       /* same reason as in `paint` above */
    data.get('/api/oneway/collections/' + encodeURIComponent(cid)).then(function (r) {
      if (!r.ok) { body.innerHTML = ''; body.className = 'ow-cvw__body';
                   refused(body, r, 'This'); return; }
      var c = (r.data && r.data.collection) || {};
      items = c.resolved || [];
      if (!items.length) {
        body.innerHTML = ''; body.className = 'ow-cvw__body';
        /* EMPTY AND UNAVAILABLE ARE DIFFERENT FACTS. A Highlight whose Stories
           this viewer may not see is not an empty Highlight. */
        nothing(body, c.unavailable
          ? 'Nothing in here is visible to you.'
          : 'There is nothing in this yet.', c.title || 'Empty');
        return;
      }
      paint();
    });
  }

  OW.live.notifications = function (host) {
    host.className = '';
    host.innerHTML = '';
    loading(host, 3);
    return data.get('/api/me/notifications', { fresh: true }).then(function (r) {
      host.innerHTML = '';
      if (!r.ok) { refused(host, r, 'Your notifications'); return 0; }
      var d = r.data || {};
      var rows = (d.needs_you || []).concat(d.social || []);
      if (!rows.length) rows = d.notifications || [];
      if (!rows.length) {
        nothing(host, 'When somebody answers you, mentions you or something '
              + 'happens where you belong, it arrives here.', 'Nothing yet');
        return 0;
      }
      /* ── THE SERVER ALREADY WROTE THE SENTENCE ─────────────────────────
         Every row carries `line` — "loop.bo sent you a message" — rendered from
         the closed `KNOWN` vocabulary in `activity/contracts.py`, plus a
         `preview` and `created_at`. This read `n.text || n.body || n.title ||
         n.kind`, NONE of which the contract has, so it fell through to the raw
         kind and printed "messaged" thirty times. The timestamp read `n.at`;
         the field is `created_at`, so no row ever showed when it happened.

         A contract mismatch that parses cleanly and renders nonsense — the
         producer and the consumer never disagreed loudly enough to notice. */

      /* ── AND THIRTY OF THE SAME LINE IS NOT THIRTY THINGS TO KNOW ───────
         Consecutive rows from the SAME person about the SAME thing collapse
         into one, carrying a count. Thirty messages in one conversation are one
         fact about that conversation; listing them thirty times buries the
         follow and the reply underneath them, which are the rows that actually
         need answering.

         CONSECUTIVE ONLY, never platform-wide: the list is newest-first, so
         grouping across a gap would silently reorder somebody's history. */
      var grouped = groupRuns(rows);

      var list = mk('div', 'ow-notes');
      grouped.forEach(function (n) {
        var b = mk('button', 'ow-note'); b.type = 'button';
        var unread = !(n.read || n.seen);
        if (unread) b.setAttribute('data-unread', 'true');
        var who = (n.actor && (n.actor.name || n.actor.email)) || n.from || '';
        /* `line` FIRST — it is the server's own sentence and already names the
           actor. The raw `kind` is the last resort and reads like a database
           column, which is what a person was being shown. */
        var txt = n.line || n.text || n.body || n.title || n.kind || 'Something happened';
        if (n._n > 1) txt += ' · ' + n._n + ' times';
        var at = n.created_at || n.at || '';
        /* ── WHO, BEFORE WHAT (founder/513 tour) ─────────────────────────
           Every row began with an empty gutter — the unread dot's slot, blank
           on every read row — so thirty rows read as thirty grey boxes. The
           row names its actor; the actor's face goes where the eye starts, as
           in every notification list a person already knows, and the dot
           moves to the far edge. Filled below from each person's light read,
           once per person. */
        /* the actor by @handle — a notification carries no address (people/refs.py) */
        var aem = String((n.actor && (n.actor.ref || n.actor.email)) || '').toLowerCase();
        if (aem) b.setAttribute('data-actor', aem);
        b.innerHTML =
          '<span class="ow-note__face" aria-hidden="true">' + (OW.faceMark ? OW.faceMark() : '') + '</span>'
          + '<span class="ow-note__dot" aria-hidden="true"></span>'
          + '<span class="ow-note__b">'
          + '<span class="ow-note__t">' + esc(txt) + '</span>'
          /* THE PREVIEW IS WHAT WAS ACTUALLY SAID, and it is the difference
             between "somebody messaged you" and knowing whether to open it. */
          + (n.preview ? '<span class="ow-note__p">' + esc(String(n.preview).slice(0, 90)) + '</span>' : '')
          + (at ? '<span class="ow-note__w">' + esc(OW.when(at)) + '</span>' : '')
          + '</span>';
        /* only where the runtime actually said where this goes — a row that
           navigates nowhere is a dead control (Rule 12) */
        var to = n.link || n.href || '';
        if (to) b.addEventListener('click', function () {
          /* ── ONE CLICK, ONE READ ─────────────────────────────────────────
             MEASURED 2026-09-21: a row opened its conversation and `unread`
             stayed 289 — the App never told the domain anything was read
             (its only writer, /api/me/notifications/read, had no caller in
             the App). The door is a watermark: read up to a `seq`, which is
             this row and everything older — the same thing every inbox means
             by "read down to here". The row drops its mark at once and the
             bell re-reads its count; the domain stays the authority. */
          if (unread && typeof n.seq === 'number') {
            b.removeAttribute('data-unread');
            Array.prototype.forEach.call(list.querySelectorAll('[data-unread]'), function (o) {
              var os = parseInt(o.getAttribute('data-seq') || '0', 10);
              if (os && os <= n.seq) o.removeAttribute('data-unread');
            });
            data.post('/api/me/notifications/read?seq=' + encodeURIComponent(n.seq), {})
              .then(function () {
                data.invalidate('/api/me/notifications');
                doc.dispatchEvent(new CustomEvent('ow:notifications-changed'));
              }).catch(function () {});
          }
          try { global.location.hash = to.replace(/^#/, '#'); } catch (e) {}
        }); else b.disabled = true;
        if (typeof n.seq === 'number') b.setAttribute('data-seq', String(n.seq));
        list.appendChild(b);
      });
      host.appendChild(list);
      /* one light read per person, however many rows they have */
      var faces = {};
      Array.prototype.forEach.call(list.querySelectorAll('[data-actor]'), function (row) {
        var em = row.getAttribute('data-actor');
        (faces[em] = faces[em] || []).push(row);
      });
      Object.keys(faces).forEach(function (em) {
        data.get('/api/oneway/people/' + encodeURIComponent(em)).then(function (r) {
          var d = (r && r.ok && r.data) || null;
          var pc = d && d.picture && (d.picture.url || d.picture);
          if (!pc || typeof pc !== 'string') return;
          var src = OW.imageUrl ? OW.imageUrl(pc) : pc;
          faces[em].forEach(function (row) {
            var f = row.querySelector('.ow-note__face');
            if (!f) return;
            f.innerHTML = '';
            var im = doc.createElement('img'); im.src = src; im.alt = ''; im.decoding = 'async';
            f.appendChild(im);
          });
        }).catch(function () {});
      });
      return rows.length;
    });
  };

  /* THE COUNT THE BELL WEARS. Its own small read so a header does not have to
     build the whole surface to know whether to show a dot. */
  OW.live.unread = function () {
    /* no session, no question: the bell has nothing to count for a stranger,
       and the 401 it would take is not "unknown", it is "nobody" */
    if (!token()) return Promise.resolve(null);
    return data.get('/api/me/notifications').then(function (r) {
      if (!r.ok) return null;                    /* unknown, NOT zero */
      var d = r.data || {};
      return typeof d.unread === 'number' ? d.unread
           : ((d.needs_you || []).length + (d.social || []).length);
    }).catch(function () { return null; });
  };

  /* ══ SETTINGS AND PRIVACY — laid out like TikTok's, then simpler ══════════
     ★ FOUNDER/501, 2026-09-23: *"make it easy to change username and profile
       information like email address and password it should all be in
       settings make it laid out like TikTok settings … make it all even
       simpler and easier for the user to find things and make sure we have
       things like 2fa."*

     TIKTOK, AS RESEARCHED: Profile → menu → "Settings and privacy" — a flat
     list, grey section headings (Account · Privacy · Security and permissions
     · Content & display · Support & about · Login), one row per thing, each
     row opening its own page, 2-step verification under Security.

     SIMPLER THAN TIKTOK IN THREE WAYS:
       · a SEARCH at the top. "2fa", "dark", "location", "password" land on the
         row without knowing which section it lives in.
       · every row shows its CURRENT VALUE on the right (your @name, "On",
         "Off") so most visits end on the list without opening anything.
       · five sections, plain words, nothing named after how the system works.

     THE CONTROLS ARE THE ONES THAT ALREADY WORK. The old page (`settings()`)
     is rendered off-screen and its sections are MOVED into the pages here,
     listeners and all — every toggle keeps the save path it was proven with.
     Only what did not exist is new: username, password, two-step, where you
     are signed in, colour logos, log out.

     NO MODALS (standing rule): a row opens a page in the same surface with a
     back arrow; Escape goes back too. */
  var SET_ICONS = {
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    activity: '<path d="M4 12h3.5l2.5-6 4 12 2.5-6H20"/>',
    understanding: '<circle cx="6" cy="7" r="1.7"/><circle cx="17" cy="6" r="1.5"/><circle cx="12" cy="13" r="2.1"/><circle cx="18" cy="17" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><path d="M7.2 8.2 10.6 11.6M15.9 7.2 13 11.2M14 13.8l2.6 2.2M10.3 14.2 7.8 16.4"/>',
    at: '<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7"/>',
    person: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m4 7 8 6 8-6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
    shield: '<path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    device: '<rect x="6" y="2.8" width="12" height="18.4" rx="2.6"/><path d="M10.5 18h3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    bell: '<path d="M18 8.6a6 6 0 1 0-12 0c0 5-2.1 6.4-2.1 6.4h16.2S18 13.6 18 8.6z"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    access: '<circle cx="12" cy="4.6" r="1.8"/><path d="M5 8.5h14M12 8.5v5.5m0 0-3.5 6.5M12 14l3.5 6.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h6M9.5 16h6"/>',
    out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.6 7l.9 12.2h9l.9-12.2M10.2 10.6v5.4M13.8 10.6v5.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    mute: '<path d="M18 8.6a6 6 0 0 0-9.7-4.7M6.2 7.4A6 6 0 0 0 6 8.6c0 5-2.1 6.4-2.1 6.4H15"/><path d="M13.7 19a2 2 0 0 1-3.4 0M4 4l16 16"/>',
    inbox: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h5l1 2h4l1-2h5"/>'
  };
  function setIcon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (SET_ICONS[name] || '') + '</svg>';
  }
  /* one icon set for every settings-shaped page in the App (Settings, the
     Post screen, a chat's settings) — founder/510 */
  OW.setIcon = setIcon;

  /* ═══ ONE POST, MANY PLATFORMS — the App's half ═══════════════════════════
     ★ FOUNDER/503: *"cross platform posting … is extremely important in both
       lightbulb for app and os and app interfaces for posting and settings are
       getting redesigned right now."*

     B's half (5f66099e): `POST /api/oneway/social/posts` takes `destinations`,
     a JOB sends them as the Center (the person's own home, for a person), and
     every platform's own result lands on the post — `GET …/syndication`.
     These are the three pieces every surface shares: which platforms there
     are and whether each is connected, each platform's own mark, and the one
     way to connect. The composer and Settings draw from them; neither keeps a
     second list of platforms. */
  var REACH_LABEL = { x: 'X', instagram: 'Instagram', facebook: 'Facebook',
    linkedin: 'LinkedIn', tiktok: 'TikTok', threads: 'Threads', pinterest: 'Pinterest',
    youtube: 'YouTube', reddit: 'Reddit', google: 'Google',
    bluesky: 'Bluesky', mastodon: 'Mastodon', telegram: 'Telegram', discord: 'Discord' };
  /* the old person-shaped read said `twitter`; ONEWAY's own name is `x` */
  function reachKey(t) {
    var k = String((t && (t.platform || t.channel)) || '').toLowerCase();
    return k === 'twitter' ? 'x' : k;
  }
  /* ONE CENTER'S PLATFORMS (B 2d2f0c8a) — `center_id` is the place the post
     belongs to: the person's own home, or a Center they run. Every row says,
     in ONEWAY's names and the platform's own words, whether it is connected,
     as whom, whether it can send and why not, whether it can be connected at
     all, and what it needs. A refusal (403: this person may not post as that
     Center) is an empty list, never a guess. */
  function reachTargets(centerId, place) {
    if (!centerId) return Promise.resolve([]);
    /* A PLACE YOU BELONG TO BUT DO NOT RUN is answered here, not asked
       (founder/559): anyone who belongs may post INTO it, only the people who
       run it may send its posts on to its platforms, and the place list
       already says which — asking anyway spent a 403 on every pick. */
    if (place && place.operates === false) return Promise.resolve([]);
    return data.get('/api/oneway/distribution?center_id=' + encodeURIComponent(centerId), { fresh: true })
      .then(function (r) {
        if (!r || !r.ok) return [];
        var seen = {};
        return (((r.data || {}).targets) || []).map(function (t) {
          var k = reachKey(t);
          if (!k || seen[k]) return null;
          seen[k] = 1;
          return { key: k, label: t.name || REACH_LABEL[k] || k, center: centerId,
                   connected: !!t.connected, account: t.account || '',
                   canSend: !!t.connected && t.can_send !== false, whyNot: t.why_not || '',
                   canConnect: t.connect !== false, connectWhyNot: t.connect_why_not || '',
                   needs: t.needs || '', needsWords: t.needs_words || '', max: +t.max_chars || 0,
                   /* `form`: the person brings their own access (Bluesky, Mastodon,
                      Telegram, Discord) and the server says what to ask for */
                   connectKind: t.connect_kind || 'oauth', fields: t.fields || [] };
        }).filter(Boolean);
      }, function () { return []; });
  }
  function reachMark(key) {
    var s = mk('span', 'ow-reach__mk');
    s.setAttribute('data-platform', key);
    var hue = OW.links && OW.links.hueOf ? OW.links.hueOf(key) : '';
    if (hue) s.style.setProperty('--mk', hue);
    s.innerHTML = OW.links ? OW.links.icon(key) : '';
    return s;
  }
  /* CONNECTING: the door hands back the platform's consent screen, bound to
     THIS Center, and the platform returns the person to Settings > Connected
     accounts with ?connected= or ?failed=&why= — so the browser can go there
     without carrying a session header it cannot carry. */
  var REACH_RETURN = '/oneway-app.html#settings/connected';
  /* ── CONNECTING WITH YOUR OWN ACCESS (founder, chat 2026-10-03: "The fact
     that they can't post to other platforms is crazy. We must do it.") ────
     Bluesky, Mastodon, a Telegram channel and a Discord channel need no
     ONEWAY developer app: the person brings an app password, their server, a
     bot or a webhook. The server names each field and says how to get it; this
     draws them INLINE under the row (S2: never a box over the page), sends
     them once, and says what happened. Nothing typed is kept on this device. */
  function reachForm(t, host2, done) {
    var old = host2.querySelector('.ow-reach__form');
    if (old) { old.parentNode.removeChild(old); return; }
    var form = mk('form', 'ow-reach__form');
    var inputs = {};
    (t.fields || []).forEach(function (f) {
      var lab = mk('label', 'ow-fld ow-set__f ow-reach__field');
      lab.appendChild(mk('span', 'ow-set__fl', esc(f.label || f.name)));
      var inp = doc.createElement('input');
      inp.type = f.secret ? 'password' : 'text';
      inp.name = f.name; inp.placeholder = f.placeholder || '';
      inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('autocapitalize', 'off');
      lab.appendChild(inp);
      if (f.help) lab.appendChild(mk('span', 'ow-set__say ow-reach__help', esc(f.help)));
      form.appendChild(lab);
      inputs[f.name] = inp;
    });
    var row = mk('div', 'ow-reach__formrow');
    var send = mk('button', 'po-act', esc('Connect ' + t.label));
    send.type = 'submit';
    row.appendChild(send);
    var said = mk('span', 'ow-reach__said', '');
    row.appendChild(said);
    form.appendChild(row);
    var code = null;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var creds = {};
      Object.keys(inputs).forEach(function (k) { creds[k] = inputs[k].value.trim(); });
      if (code && code.value.trim()) creds.code = code.value.trim();
      send.disabled = true;
      said.textContent = 'Checking with ' + t.label + '…';
      data.post('/api/oneway/distribution/connect',
                { platform: t.key, center_id: t.center, credentials: creds, return: REACH_RETURN })
        .then(function (r) {
          send.disabled = false;
          if (!r || !r.ok) { said.textContent = (r && r.error) || ('That did not connect ' + t.label + '.'); return; }
          var d = r.data || {};
          if (d.url) {
            /* MASTODON: approve on your own server. It comes back here; a
               server that shows a code instead gets a field to paste it in. */
            said.textContent = d.words || ('Approve ONEWAY on your ' + t.label + ' server.');
            if (!code) {
              var cl = mk('label', 'ow-fld ow-set__f ow-reach__field');
              cl.appendChild(mk('span', 'ow-set__fl', 'Code from your server, if it shows one'));
              code = doc.createElement('input'); code.type = 'text'; code.name = 'code'; code.autocomplete = 'off';
              cl.appendChild(code);
              form.insertBefore(cl, row);
            }
            var open = mk('a', 'po-act po-act--ghost', 'Open ' + esc(t.label));
            open.href = d.url;
            if (!row.querySelector('a')) row.insertBefore(open, said);
            return;
          }
          Object.keys(inputs).forEach(function (k) { inputs[k].value = ''; });
          said.textContent = d.words || (t.label + ' is connected.');
          if (done) global.setTimeout(done, 900);
        }, function () { send.disabled = false; said.textContent = 'That did not reach the server — try again.'; });
    });
    host2.appendChild(form);
    var first = form.querySelector('input');
    if (first) try { first.focus(); } catch (e) {}
    return form;
  }
  function reachConnect(t, note) {
    if (!t.canConnect) {
      note.textContent = t.connectWhyNot || (t.label + ' cannot be connected on this server yet.');
      return Promise.resolve();
    }
    note.textContent = 'Opening ' + t.label + '…';
    return data.post('/api/oneway/distribution/connect',
                     { platform: t.key, center_id: t.center, return: REACH_RETURN }).then(function (r) {
      if (r && r.ok && r.data && r.data.url) { global.location.href = r.data.url; return; }
      /* a server without that platform's app answers in a developer's words
         ("META_APP_ID not configured"); a person reads what it means, and the
         exact words stay on the line for whoever runs the server */
      if (r && (r.status === 409 || r.status === 400 || r.status === 501 || r.status === 503)) {
        note.textContent = t.label + ' cannot be connected on this server yet.';
        if (r.error) note.title = r.error;
        return;
      }
      note.textContent = 'Connecting ' + t.label + ' did not start — try again.';
    });
  }
  function reachDisconnect(t, note) {
    return data.del('/api/oneway/distribution/connections/' + encodeURIComponent(t.key)
                    + '?center_id=' + encodeURIComponent(t.center)).then(function (r) {
      if (!r || !r.ok) { note.textContent = (r && r.error) || 'That did not disconnect.'; return false; }
      note.textContent = ((r.data || {}).words) || (t.label + ' is disconnected.');
      return true;
    });
  }
  /* does what was made meet what this platform needs? */
  function reachMeets(t, kinds) {
    var k = kinds || [];
    var photo = k.indexOf('photo') >= 0 || k.indexOf('image') >= 0, video = k.indexOf('video') >= 0;
    if (t.needs === 'image') return photo;
    if (t.needs === 'video') return video;
    if (t.needs === 'image_or_video') return photo || video;
    return true;
  }
  /* WHERE IT WENT — each platform's own answer, said in words */
  function reachSaid(s) {
    var n = REACH_LABEL[s.platform] || s.platform;
    if (s.state === 'published') return 'On ' + n;
    if (s.state === 'queued' || s.state === 'sending') return 'Sending to ' + n + '…';
    /* the platform's own reason usually names it already ("X is not
       connected for …"); it is not said twice */
    var why = String(s.why || '');
    if (why && why.toLowerCase().indexOf(String(n).toLowerCase()) === 0) return why;
    return n + ' — ' + (why || 'it did not go out');
  }
  /* THE COMPOSER'S ROW — "Also post to", each platform its mark. `picked` is
     the composer's own object so a repaint keeps the choice; `kinds` is what
     was made (photo, video — nothing for words alone); `blocked` is the
     sentence to say instead when this post cannot go outward. No chip is ever
     dead: one that cannot be chosen says why when pressed, and offers the one
     act that fixes it where there is one. */
  function reachRow(host2, targets, picked, blocked, kinds) {
    if (!targets || !targets.length) return null;
    var box = mk('div', 'ow-reach');
    box.appendChild(mk('span', 'ow-reach__lbl', 'Also post to'));
    var chips = mk('div', 'ow-reach__chips');
    var why = mk('p', 'ow-reach__why', blocked ? esc(blocked) : '');
    targets.forEach(function (t) {
      var fits = reachMeets(t, kinds);
      if (picked[t.key] && (!fits || !t.canSend)) picked[t.key] = false;
      var b = mk('button', 'ow-reach__chip');
      b.type = 'button';
      b.setAttribute('data-k', t.key);
      b.setAttribute('aria-pressed', String(!!picked[t.key] && !blocked));
      /* NOT CONNECTED YET IS NOT OFF (founder/544: a distributor for the
         whole internet). A platform a person can still connect looks
         available and wears a +; only one that cannot take this post, or
         cannot be connected here at all, is dimmed. */
      if (blocked || !fits || (t.connected ? !t.canSend : !t.canConnect)) b.setAttribute('data-off', '1');
      else if (!t.connected) b.setAttribute('data-connect', '1');
      b.setAttribute('aria-label', (t.connected ? 'Also post to ' : 'Connect ') + t.label);
      b.appendChild(reachMark(t.key));
      b.appendChild(mk('span', 'ow-reach__n', esc(t.label)));
      b.addEventListener('click', function () {
        if (blocked) { why.textContent = blocked; return; }
        if (!t.connected) {
          why.innerHTML = '';
          if (!t.canConnect) { why.textContent = t.connectWhyNot || (t.label + ' cannot be connected on this server yet.'); return; }
          if (t.connectKind === 'form') {
            why.appendChild(doc.createTextNode(t.label + ' is not connected yet. Connect it here; '
              + 'then choose it again for this post.'));
            reachForm(t, why, function () { b.removeAttribute('data-connect'); why.textContent = t.label
              + ' is connected. Open the composer again to choose it.'; });
            return;
          }
          why.appendChild(doc.createTextNode(t.label + ' is not connected yet. Connecting opens '
            + t.label + ' and brings you back to Settings. '));
          var go = mk('button', 'po-act', esc('Connect ' + t.label));
          go.type = 'button';
          var said = mk('span', '', '');
          go.addEventListener('click', function () { reachConnect(t, said); });
          why.appendChild(go); why.appendChild(said);
          return;
        }
        if (!fits) { why.textContent = t.needsWords || (t.label + ' cannot take this post.'); return; }
        if (!t.canSend) { why.textContent = t.whyNot || (t.label + ' cannot send this right now.'); return; }
        picked[t.key] = !picked[t.key];
        b.setAttribute('aria-pressed', String(!!picked[t.key]));
        why.textContent = '';
      });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    box.appendChild(why);
    host2.appendChild(box);
    return box;
  }
  /* THE SAME CHOICE AS A LIST — the Post screen's own page (founder/510):
     each platform its mark, its state in words, a check when chosen. One that
     cannot be chosen says why when pressed, and offers Connect where that is
     the fix. */
  function reachList(host2, targets, picked, kinds) {
    (targets || []).forEach(function (t) {
      var fits = reachMeets(t, kinds);
      var can = t.canSend && fits;
      if (picked[t.key] && !can) picked[t.key] = false;
      var el = mk('button', 'ow-set__row ow-setpick');
      el.type = 'button';
      el.setAttribute('role', 'checkbox');
      el.setAttribute('data-k', t.key);
      el.setAttribute('aria-checked', String(!!picked[t.key]));
      if (!can) el.setAttribute('data-off', '1');
      var mark = reachMark(t.key); mark.classList.add('ow-setpick__face');
      el.appendChild(mark);
      var sub = t.connected
        ? (fits ? (t.account || 'Connected') : (t.needsWords || 'Cannot take this post'))
        : (t.canConnect ? 'Not connected' : (String(t.connectWhyNot || '').split(' — ')[0] || 'Cannot be connected here yet'));
      var w = mk('span', 'ow-setpick__w');
      w.appendChild(mk('b', '', esc(t.label)));
      w.appendChild(mk('span', '', esc(sub)));
      el.appendChild(w);
      var ok = mk('span', 'ow-setpick__ok');
      ok.innerHTML = picked[t.key] ? setIcon('check') : '';
      el.appendChild(ok);
      var note = mk('p', 'ow-reach__why', '');
      el.addEventListener('click', function () {
        note.innerHTML = '';
        if (!t.connected) {
          if (!t.canConnect) { note.textContent = t.connectWhyNot || sub; return; }
          note.appendChild(doc.createTextNode('Connecting opens ' + t.label + ' and brings you back to Settings. '));
          var go = mk('button', 'po-act', esc('Connect ' + t.label)); go.type = 'button';
          var said = mk('span', '', '');
          go.addEventListener('click', function () { reachConnect(t, said); });
          note.appendChild(go); note.appendChild(said);
          return;
        }
        if (!can) { note.textContent = (!fits ? t.needsWords : t.whyNot) || (t.label + ' cannot take this post.'); return; }
        picked[t.key] = !picked[t.key];
        el.setAttribute('aria-checked', String(!!picked[t.key]));
        ok.innerHTML = picked[t.key] ? setIcon('check') : '';
      });
      host2.appendChild(el);
      host2.appendChild(note);
    });
  }
  function reachKeys(picked) {
    return Object.keys(picked || {}).filter(function (k) { return picked[k]; });
  }
  /* WHERE IT WENT, AS IT HAPPENS. The post answers at once with each platform
     `queued`; the sending is a job, and when a platform's result is written
     the post's own topic says so (B 762f60eb) — so this listens, and asks the
     operator's door for the words only when something changed. A slow ask
     stands behind it for a moment the stream is down. Each platform is said:
     the link where it went, its own reason where it did not, and Try again. */
  function reachTrack(host2, pid, list) {
    if (!pid || !list || !list.length) return;
    var ul = mk('ul', 'ow-reach__went');
    host2.appendChild(ul);
    var tries = 0, lane = 'reach:' + pid;
    function pending(s) { return s.state === 'queued' || s.state === 'sending'; }
    function reread() {
      return data.get('/api/oneway/social/posts/' + encodeURIComponent(pid) + '/syndication', { fresh: true })
        .then(function (r) {
          var items = r && r.ok && r.data && r.data.syndication;
          if (items && items.length) list = items;
          paint();
        });
    }
    function paint() {
      ul.innerHTML = '';
      list.forEach(function (s) {
        var li = mk('li');
        li.setAttribute('data-state', s.state || '');
        li.appendChild(reachMark(s.platform));
        li.appendChild(mk('span', '', esc(reachSaid(s))));
        if (s.state === 'published' && s.url) {
          var a = mk('a', 'po-act', 'Open');
          a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          li.appendChild(a);
        }
        if (s.state === 'failed' || s.state === 'not_sent') {
          var again = mk('button', 'po-act', 'Try again');
          again.type = 'button';
          again.addEventListener('click', function () {
            again.disabled = true;
            data.post('/api/oneway/social/posts/' + encodeURIComponent(pid) + '/syndicate',
                      { destinations: [s.platform] }).then(function (r) {
              if (!r || !r.ok) { again.disabled = false; if (OW.toast) OW.toast((r && r.error) || 'That did not send.'); return; }
              var back = (r.data || {}).syndication || [];
              list = list.map(function (x) {
                return back.filter(function (y) { return y.platform === x.platform; })[0] || x;
              });
              tries = 0; paint(); poll();
            });
          });
          li.appendChild(again);
        }
        ul.appendChild(li);
      });
      if (!list.some(pending) && OW.realtime) OW.realtime.unwatch(lane);
    }
    function onEvent(e) {
      var d = (e && e.detail) || {};
      if (d.post !== pid) return;
      if (!ul.isConnected) { doc.removeEventListener('ow:syndication', onEvent); return; }
      reread();
    }
    doc.addEventListener('ow:syndication', onEvent);
    if (OW.realtime) OW.realtime.watchTopics(lane, ['post:' + pid]);
    function poll() {
      if (!list.some(pending) || tries++ > 8) return;
      global.setTimeout(function () {
        if (!ul.isConnected) { if (OW.realtime) OW.realtime.unwatch(lane); return; }
        reread().then(poll);
      }, 4000);
    }
    paint(); poll();
  }
  /* WHY THERE IS NO "ALSO POST TO" ROW — said once, quietly, where the row
     would be, so a person who picked a place they belong to is not left
     wondering where the platforms went (founder/559) */
  function reachNotRun(host2, place) {
    if (!host2 || !place || place.operates !== false) return false;
    host2.appendChild(mk('p', 'ow-reach__why ow-reach__why--run',
      esc('Only the people who run ' + (place.name || 'this place') + ' can send its posts to other platforms.')));
    return true;
  }
  OW.reach = { targets: reachTargets, notRun: reachNotRun, mark: reachMark, connect: reachConnect, form: reachForm,
               disconnect: reachDisconnect, said: reachSaid, label: REACH_LABEL,
               row: reachRow, list: reachList, keys: reachKeys, track: reachTrack, meets: reachMeets };

  function settingsMenu(host) {
    var src = mk('div');        /* the proven sections, built off-screen */
    /* ── THE MENU IS ON SCREEN AT ONCE (founder/512: "get everything where I
       could see it"). Measured 2026-09-24: Settings took 13–21 seconds to
       appear, because it waited for three reads — the slowest a composed
       person read the backend answers in ~0.7s alone and far longer while the
       App boots. The list of rows needs none of them. So it paints now from
       what is already known (the address, the theme), and paints again with
       the real values when the reads answer; a row pressed in between opens
       the moment its page can be built. */
    var carry = { page: '', want: String(global.location.hash || '').split('/')[1] || '' };
    var reads = Promise.all([
      settings(src).catch(function () { return 0; }),
      data.get('/api/oneway/people/me', { fresh: true }).catch(function () { return { ok: false }; }),
      data.get('/api/oneway/identity/2fa', { fresh: true }).catch(function () { return { ok: false }; })
    ]);
    render([0, { ok: false }, { ok: false }], false);
    return reads.then(function (res) { return render(res, true); });

    function render(res, full) {
      var me = (res[1] && res[1].ok && res[1].data) || {};
      var tf = (res[2] && res[2].ok && res[2].data) || {};
      var email = me.email || data.me() || '';
      /* THE USERNAME IS THE ONE THE ACCOUNT HOLDS, never guessed from the
         address: for the few accounts with no username, the address's first
         half is somebody else's (B f8f00cfc). No username says so. */
      var handle = ((me.profile || {}).handle) || '';

      /* index the old page's sections by their own heading */
      var secs = {};
      function indexSecs() {
        secs = {};
        var root = src.querySelector('.ow-cust') || src;
        Array.prototype.forEach.call(root.children, function (el) {
          var lb = el.querySelector && el.querySelector('.ow-cust__lbl');
          var t = lb ? lb.textContent.trim() : '';
          if (t && !secs[t]) secs[t] = el;
        });
      }
      indexSecs();
      function has(names) { return names.some(function (n) { return !!secs[n]; }); }

      host.className = ''; host.innerHTML = '';
      host.classList.add('ow-set');
      var menu = mk('div', 'ow-set__menu');
      var page = mk('div', 'ow-set__page'); page.hidden = true;
      host.appendChild(menu); host.appendChild(page);

      /* ── THE LIST ─────────────────────────────────────────────────────── */
      menu.appendChild(mk('h1', 'ow-set__h', 'Settings and privacy'));
      var sb = mk('label', 'ow-set__search');
      sb.innerHTML = setIcon('search');
      var q = doc.createElement('input');
      q.type = 'search'; q.placeholder = 'Search settings';
      q.setAttribute('aria-label', 'Search settings');
      sb.appendChild(q); menu.appendChild(sb);
      var list = mk('div', 'ow-set__list'); menu.appendChild(list);

      var GROUPS = [
        ['Account', [
          { id: 'username', label: 'Username', icon: 'at',
            value: !full ? '' : (handle ? '@' + handle : 'Choose one'),
            keys: 'username handle @ name change', open: pageUsername },
          { id: 'profile', label: 'Name and profile', icon: 'person', value: me.display_name || '',
            keys: 'name display bio pronouns links website birthday profile about', move: ['You'] },
          { id: 'email', label: 'Email', icon: 'mail', value: email,
            keys: 'email address mail', open: pageEmail },
          { id: 'password', label: 'Password', icon: 'key',
            keys: 'password change reset', open: pagePassword },
          { id: 'connected', label: 'Connected accounts', icon: 'link',
            keys: 'connected accounts instagram x twitter tiktok facebook linkedin youtube threads pinterest platforms cross post share',
            open: pageConnected },
          /* DELETE YOUR ACCOUNT (founder/581) — the one core task of 36 that
             had no door. Red, like Log out, because it cannot be undone. */
          { id: 'delete', label: 'Delete your account', icon: 'trash', danger: true,
            keys: 'delete account remove close deactivate erase leave oneway gdpr', open: pageDelete }
        ]],
        /* ── HOW YOU USE ONEWAY (founder/520) ────────────────────────────
           Your activity, Understanding and the Calendar are pages with no
           door: the gear that once opened them moved to the top bar as
           Settings (495), and Settings never listed them — reachable only by
           typing an address. Instagram keeps these in its menu under "How you
           use Instagram"; here they are a section of the same list, each row
           going to its page rather than opening a panel. */
        ['How you use ONEWAY', [
          { id: 'go-calendar', label: 'Calendar', icon: 'calendar', go: 'calendar',
            keys: 'calendar plans bookings reservations stays events going schedule' },
          { id: 'go-activity', label: 'Your activity', icon: 'activity', go: 'activity',
            keys: 'activity history what i did posts follows log' },
          { id: 'go-understanding', label: 'Understanding', icon: 'understanding', go: 'understanding',
            keys: 'understanding brain what oneway knows about me insight' },
          /* 2026-10-01 — TWO FOUNDER FEATURES WITH NO DOOR. "Where you have
             been" with StreetPass (founder, 2026-08-15) and "On this day"
             (2026-08-17) were built, then lost their only callers when the
             profile moved to Popits: `worldReality` and `memories` had no
             caller anywhere. Each is a page here, like the rows above. */
          { id: 'go-places', label: 'Where you have been', icon: 'pin', go: 'places',
            keys: 'places visited joined been streetpass crossed paths friends overlap world' },
          { id: 'go-memories', label: 'On this day', icon: 'clock', go: 'memories',
            keys: 'memories on this day years ago nostalgia anniversary remember' }
        ]],
        ['Security', [
          { id: 'twostep', label: 'Two-step verification', icon: 'shield',
            value: full ? (tf.enabled ? 'On' : 'Off') : '',
            keys: '2fa two factor two-step 2-step verification authenticator code security mfa', open: pageTwoStep },
          { id: 'sessions', label: 'Where you are signed in', icon: 'device',
            keys: 'devices sessions sign out log out everywhere logins security', open: pageSessions },
          /* SIGN IN WITH ONEWAY (founder/581): the sites a person carried their
             identity to. The consent screen promises "You can remove <site>
             any time in Settings" — this row is that promise kept. */
          { id: 'sites', label: 'Sites you signed in to', icon: 'access',
            keys: 'sign in with oneway apps websites sites third party connected access remove revoke',
            open: pageSites }
        ]],
        ['Privacy', [
          { id: 'privacy', label: 'Privacy', icon: 'lock',
            keys: 'private profile comments counts likes active typing seen', move: ['Privacy'] },
          { id: 'where', label: 'Where you are', icon: 'pin',
            keys: 'location map share where gps precise approximate background', move: ['Where you are'] },
          /* ★ FOUNDER/539: "add the missing settings". The old page's Blocked
             and Muted lists (one canonical read each, one DELETE to undo,
             re-read after — 2026-09-02) were still drawn off-screen, and no
             row of the new pages moved them in: since 1c36a0ed a person could
             block someone and never see or undo it. Both are enforced — a
             block closes messages and the profile, a mute takes a person out
             of the feed (feed/visibility.py) — so they are rows again. */
          { id: 'blocked', label: 'Blocked accounts', icon: 'ban',
            keys: 'blocked block unblock accounts people privacy', move: ['Blocked'] },
          { id: 'muted', label: 'Muted accounts', icon: 'mute',
            keys: 'muted mute unmute quiet hide feed accounts people', move: ['Muted'] }
        ]],
        /* ── MESSAGES (founder/539: "and messaging settings") ─────────────
           Who may message you was a row under Privacy, and the requests it
           creates — a message from someone those rules hold back waits,
           `GET /api/oneway/messaging/requests` — had no screen anywhere: the
           runtime kept them and nothing in the App ever read them. Instagram
           and TikTok keep both together under Messages. */
        ['Messages', [
          { id: 'reach', label: 'Who can message you', icon: 'chat',
            keys: 'messages dm reach friends anyone requests', move: ['Who can reach you'] },
          { id: 'requests', label: 'Message requests', icon: 'inbox',
            keys: 'message requests waiting strangers accept decline dm messages', open: pageRequests }
        ]],
        ['Content and display', [
          { id: 'notifications', label: 'Notifications', icon: 'bell',
            keys: 'push mentions email summary notifications alerts', move: ['Notifications'] },
          { id: 'appearance', label: 'Appearance', icon: 'moon',
            value: (doc.documentElement.getAttribute('data-theme') === 'light' ? 'Light' : 'Dark'),
            keys: 'dark light mode theme galaxy background plain colour color logos icons black white mono simple',
            move: ['Appearance', 'Plain background', 'Simple mode'], extra: marksRow },
          { id: 'discovery', label: 'Discovery', icon: 'compass',
            keys: 'personalised personalized discovery suggestions recommendations', move: ['Discovery'] },
          { id: 'accessibility', label: 'Accessibility', icon: 'access',
            keys: 'reduce motion accessibility animation', move: ['Accessibility'] },
          { id: 'plus', label: 'Your subscription', icon: 'star',
            keys: 'subscription plus plan billing', move: ['Your subscription'] }
        ]],
        ['Support and about', [
          { id: 'terms', label: 'Terms of Service', icon: 'doc', keys: 'terms legal', href: '/terms.html' },
          { id: 'policy', label: 'Privacy Policy', icon: 'doc', keys: 'privacy policy legal data', href: '/privacy.html' }
        ]]
      ];

      /* ── NOTHING FALLS OFF THESE PAGES AGAIN (founder/539) ───────────────
         The new pages show an old section only where a row names it, and the
         Blocked and Muted lists fell off that way for three days. Any section
         the old page draws that no row names gets a row of its own here, so a
         group the runtime starts enforcing tomorrow (the menu's "Content",
         say) appears without anybody remembering to add it. */
      if (full) {
        var named = {};
        GROUPS.forEach(function (g) { g[1].forEach(function (r) { (r.move || []).forEach(function (n) { named[n] = 1; }); }); });
        var orphans = Object.keys(secs).filter(function (n) { return !named[n]; });
        if (orphans.length) {
          GROUPS.splice(GROUPS.length - 1, 0, ['More settings', orphans.map(function (n) {
            return { id: 'more-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: n, icon: 'sliders',
                     keys: n.toLowerCase(), move: [n] };
          })]);
        }
      }
      var rowEls = [];
      GROUPS.forEach(function (g) {
        var rows = g[1].filter(function (r) { return !r.move || !full || has(r.move); });
        if (!rows.length) return;
        var sec = mk('section', 'ow-set__sec');
        sec.appendChild(mk('h2', 'ow-set__sh', esc(g[0])));
        rows.forEach(function (r) {
          var el = mk(r.href ? 'a' : 'button', 'ow-set__row' + (r.danger ? ' ow-set__row--out' : ''));
          if (r.href) { el.href = r.href; } else { el.type = 'button'; }
          el.setAttribute('data-set', r.id);
          el.innerHTML = '<span class="ow-set__ic">' + setIcon(r.icon) + '</span>'
            + '<span class="ow-set__lb">' + esc(r.label) + '</span>'
            + '<span class="ow-set__v">' + esc(r.value || '') + '</span>'
            + '<span class="ow-set__cv">' + setIcon('chevron') + '</span>';
          if (r.go) el.addEventListener('click', function () {
            try { doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: r.go } })); } catch (e) {}
          });
          else if (!r.href) el.addEventListener('click', function () { openPage(r); });
          sec.appendChild(el);
          rowEls.push({ el: el, sec: sec, text: (r.label + ' ' + (r.keys || '') + ' ' + g[0]).toLowerCase() });
        });
        list.appendChild(sec);
      });
      /* every row shows its current value (the list's own rule): how many
         people wait, and how many are blocked or muted (founder/539) */
      if (full) {
        data.get('/api/oneway/messaging/requests', { fresh: true }).then(function (r) {
          var n2 = r.ok ? (((r.data || {}).requests) || []).length : 0; if (n2) setValue('requests', String(n2));
        });
        [['blocked', 'blocked'], ['muted', 'muted']].forEach(function (t) {
          data.get('/api/oneway/graph/me/' + t[1] + '?limit=50', { fresh: true }).then(function (r) {
            var d = (r.ok && r.data) || {}; var n3 = (d.people || []).length;
            if (d.readable !== false && n3) setValue(t[0], n3 + (d.next_cursor ? '+' : ''));
          });
        });
      }

      /* LOG OUT — last, alone, and it asks once by asking twice (no modal) */
      var outSec = mk('section', 'ow-set__sec');
      var outBtn = mk('button', 'ow-set__row ow-set__row--out');
      outBtn.type = 'button';
      outBtn.innerHTML = '<span class="ow-set__ic">' + setIcon('out') + '</span>'
        + '<span class="ow-set__lb">Log out</span>';
      var outArmed = 0;
      outBtn.addEventListener('click', function () {
        if (!outArmed) {
          outArmed = global.setTimeout(function () {
            outArmed = 0; outBtn.querySelector('.ow-set__lb').textContent = 'Log out';
          }, 3200);
          outBtn.querySelector('.ow-set__lb').textContent = 'Tap again to log out';
          return;
        }
        global.clearTimeout(outArmed);
        data.post('/api/auth/signout', {}).then(function () {
          try {
            ['ow_session_token', 'ow_tokens', 'ow_session'].forEach(function (k) { global.localStorage.removeItem(k); });
          } catch (_) {}
          global.location.href = '/login.html';
        });
      });
      outSec.appendChild(outBtn);
      list.appendChild(outSec);

      /* SEARCH — every row answers to its words, its section, and the words
         a person would type for it ("2fa", "dark", "gps") */
      var none = mk('p', 'ow-set__none', 'Nothing in settings matches that.'); none.hidden = true;
      list.appendChild(none);
      q.addEventListener('input', function () {
        var t = q.value.trim().toLowerCase();
        var shown = 0;
        rowEls.forEach(function (x) {
          var hit = !t || t.split(/\s+/).every(function (w) { return x.text.indexOf(w) >= 0; });
          x.el.hidden = !hit; if (hit) shown++;
        });
        Array.prototype.forEach.call(list.querySelectorAll('.ow-set__sec'), function (sec) {
          if (sec === outSec) { sec.hidden = !!t; return; }
          sec.hidden = !Array.prototype.some.call(sec.querySelectorAll('.ow-set__row'), function (r) { return !r.hidden; });
        });
        none.hidden = !(t && !shown);
      });

      /* ── A ROW'S OWN PAGE ─────────────────────────────────────────────── */
      var built = {};
      function openPage(r) {
        /* a row that is a door to another page goes there, even by deep link */
        if (r.go) { try { doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: r.go } })); } catch (e) {} return; }
        carry.page = r.id;
        page.innerHTML = '';
        var head = mk('div', 'ow-set__ph');
        var back = mk('button', 'ow-set__back'); back.type = 'button';
        back.setAttribute('aria-label', 'Back to settings');
        back.innerHTML = setIcon('back');
        back.addEventListener('click', function () { closePage(); });
        head.appendChild(back);
        head.appendChild(mk('h1', 'ow-set__pt', esc(r.label)));
        page.appendChild(head);
        var body = built[r.id];
        if (!body && !full) {
          /* its page needs what the reads bring; it opens when they answer */
          body = mk('div', 'ow-set__pb');
          body.appendChild(mk('p', 'ow-set__lede', 'One moment…'));
        } else if (!body) {
          body = mk('div', 'ow-set__pb');
          if (r.move) r.move.forEach(function (n) {
            if (secs[n]) { secs[n].setAttribute('data-moved', n); body.appendChild(secs[n]); }
          });
          if (r.extra) r.extra(body);
          if (r.open) r.open(body, r);
          built[r.id] = body;
        }
        page.appendChild(body);
        menu.hidden = true; page.hidden = false;
        page.classList.remove('is-in'); void page.offsetWidth; page.classList.add('is-in');
        try { global.scrollTo(0, 0); } catch (_) {}
        /* A PAGE IS A STEP BACK CLOSES (founder, chat 2026-10-04: does moving
           around feel natural). Measured: a swipe Back from Connected accounts
           skipped the Settings list and left Settings. The page now adds an
           entry at the same address — the shell's router leaves Settings alone
           for it — and Back closes the page. Its own arrow is the one back
           control while it is open (the header's would be a second arrow). */
        doc.documentElement.classList.add('ow-subpage');
        if (!(global.history.state && global.history.state.owSet)) {
          try { global.history.pushState({ owSet: r.id }, '', global.location.href); } catch (_) {}
        }
        if (!pageStep) {
          pageStep = function () {
            if (!host.isConnected || page.hidden) { global.removeEventListener('popstate', pageStep); pageStep = null; return; }
            if (!(global.history.state && global.history.state.owSet)) { global.removeEventListener('popstate', pageStep); pageStep = null; closePage(true); }
          };
          global.addEventListener('popstate', pageStep);
        }
      }
      var pageStep = null;
      /* ── A SECTION THAT REDRAWS ITSELF STAYS WHERE IT WAS MOVED ──────────
         Some sections redraw the WHOLE old page after a change — "Where you
         are" calls `settings(host)` so every word comes back from the runtime.
         That host is the off-screen one, so without this the page on screen
         would keep showing the answer from before the change. When the source
         redraws, each page that holds moved sections swaps in the fresh ones,
         in the same order, where the old ones were. */
      var ROWS = {};
      GROUPS.forEach(function (g) { g[1].forEach(function (r) { ROWS[r.id] = r; }); });
      if (global.MutationObserver) {
        new global.MutationObserver(function () {
          if (!src.querySelector('.ow-cust')) return;      /* the loader, mid-redraw */
          indexSecs();
          Object.keys(built).forEach(function (id) {
            var r = ROWS[id], body = built[id];
            if (!r || !r.move || !body) return;
            var olds = Array.prototype.slice.call(body.querySelectorAll('[data-moved]'));
            var anchor = olds.length ? olds[0] : body.firstChild;
            r.move.forEach(function (n) {
              if (!secs[n]) return;
              secs[n].setAttribute('data-moved', n);
              body.insertBefore(secs[n], anchor);
            });
            olds.forEach(function (o) { if (o.parentNode === body && !Object.keys(secs).some(function (k) { return secs[k] === o; })) o.remove(); });
          });
        }).observe(src, { childList: true });
      }

      function closePage(popped) {
        carry.page = '';
        page.hidden = true; menu.hidden = false;
        doc.documentElement.classList.remove('ow-subpage');
        try { global.scrollTo(0, 0); } catch (_) {}
        /* closed by its own arrow: take back the step it added */
        if (popped !== true && global.history.state && global.history.state.owSet) {
          if (pageStep) { global.removeEventListener('popstate', pageStep); pageStep = null; }
          try { global.history.back(); } catch (_) {}
          return;
        }
        /* the address follows the page back out, so Back is Settings */
        try {
          if (/^#settings\//.test(global.location.hash)) global.history.replaceState(global.history.state, '', '#settings');
        } catch (_) {}
      }
      /* A PAGE ASKED FOR BY ADDRESS — `#settings/connected` is where a
         platform's consent screen returns a person (B 2d2f0c8a), with
         ?connected=x or ?failed=x&why=… before the hash. The answer is said
         once, in the bar, and taken off the address so a reload does not say
         it again. */
      global.setTimeout(function () {
        var want = carry.want;
        if (!full) { if (want && ROWS[want] && host.isConnected) openPage(ROWS[want]); return; }
        carry.want = '';
        var q = {};
        String(global.location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
          var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
        });
        var nameOf = function (k) {
          return String(k || '').split(',').map(function (x) { return OW.reach.label[x] || x; }).join(' and ');
        };
        if (q.connected && OW.toast) OW.toast(nameOf(q.connected) + ' is connected.', { tone: 'ok' });
        else if (q.failed && OW.toast) OW.toast(nameOf(q.failed) + ' did not connect' + (q.why ? ' — ' + q.why : '') + '.');
        if (q.connected || q.failed) {
          try { global.history.replaceState(global.history.state, '', global.location.pathname + global.location.hash); } catch (_) {}
        }
      }, 0);
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !page.hidden && host.isConnected) closePage();
      });
      function setValue(id, v) {
        var el = list.querySelector('[data-set="' + id + '"] .ow-set__v');
        if (el) el.textContent = v;
      }

      function field(lbl, type, attrs) {
        var f = mk('label', 'ow-fld ow-set__f');
        f.appendChild(mk('span', 'ow-set__fl', esc(lbl)));
        var i = doc.createElement('input'); i.type = type || 'text';
        Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); });
        f.appendChild(i);
        return { el: f, input: i };
      }
      function say(body, text, bad) {
        var n = body.querySelector('.ow-set__say');
        if (!n) { n = mk('p', 'ow-set__say'); body.appendChild(n); }
        n.textContent = text || ''; n.setAttribute('data-bad', bad ? '1' : '0');
      }
      function btn(label, cls) {
        var b = mk('button', 'ow-btn ' + (cls || '')); b.type = 'button'; b.textContent = label; return b;
      }

      /* USERNAME — checked as you type, claimed atomically on the server */
      function pageUsername(body) {
        body.appendChild(mk('p', 'ow-set__lede', handle
          ? 'Your username is how people find and mention you: @' + esc(handle) + '. Letters, numbers, underscores and periods.'
          : 'You do not have a username yet. Choose one — it is how people find and mention you. Letters, numbers, underscores and periods.'));
        var f = field('Username', 'text', { autocapitalize: 'off', spellcheck: 'false', maxlength: '24', value: handle });
        f.el.classList.add('ow-set__at');
        body.appendChild(f.el);
        var save = btn('Save'); save.disabled = true; body.appendChild(save);
        var t = 0;
        f.input.addEventListener('input', function () {
          global.clearTimeout(t);
          var v = f.input.value.trim().replace(/^@/, '').toLowerCase();
          save.disabled = true;
          if (!v || v === handle) { say(body, ''); return; }
          say(body, 'Checking…');
          t = global.setTimeout(function () {
            data.get('/api/oneway/people/handles/' + encodeURIComponent(v) + '/available', { fresh: true })
              .then(function (r) {
                if (f.input.value.trim().replace(/^@/, '').toLowerCase() !== v) return;
                var d = (r.ok && r.data) || {};
                if (d.available) { say(body, '@' + v + ' is available.'); save.disabled = false; }
                else say(body, d.reason || 'That username cannot be used.', true);
              });
          }, 320);
        });
        save.addEventListener('click', function () {
          var v = f.input.value.trim().replace(/^@/, '').toLowerCase();
          save.disabled = true; say(body, 'Saving…');
          data.put('/api/oneway/people/me/handle', { handle: v }).then(function (r) {
            if (!r.ok) { say(body, r.error || 'That did not save.', true); save.disabled = false; return; }
            handle = v; setValue('username', '@' + v);
            say(body, 'Your username is now @' + v + '.');
            data.invalidate('/api/oneway/people');
            if (OW.toast) OW.toast('Username changed to @' + v + '.', { tone: 'ok' });
          });
        });
      }

      /* EMAIL — shown, and honest about why it does not change yet */
      function pageEmail(body) {
        body.appendChild(mk('p', 'ow-set__big', esc(email)));
        body.appendChild(mk('p', 'ow-set__lede',
          'This is the address you sign in with. It is also how ONEWAY knows you everywhere '
          + '— your posts, your messages and the Centers you belong to — so changing it moves '
          + 'your whole account, and that is not available yet.'));
      }

      /* PASSWORD — the current one, the new one twice; everywhere else signs out */
      function pagePassword(body) {
        body.appendChild(mk('p', 'ow-set__lede',
          'Changing your password signs you out everywhere else. You stay signed in here.'));
        var cur = field('Current password', 'password', { autocomplete: 'current-password' });
        var nw = field('New password', 'password', { autocomplete: 'new-password', minlength: '8' });
        var nw2 = field('New password again', 'password', { autocomplete: 'new-password', minlength: '8' });
        [cur, nw, nw2].forEach(function (x) { body.appendChild(x.el); });
        var save = btn('Change password'); body.appendChild(save);
        save.addEventListener('click', function () {
          if (nw.input.value.length < 8) { say(body, 'A password needs at least 8 characters.', true); return; }
          if (nw.input.value !== nw2.input.value) { say(body, 'The two new passwords are not the same.', true); return; }
          save.disabled = true; say(body, 'Changing…');
          data.post('/api/oneway/identity/password', { current: cur.input.value, new: nw.input.value })
            .then(function (r) {
              save.disabled = false;
              if (!r.ok) { say(body, r.error || 'That did not change.', true); return; }
              [cur, nw, nw2].forEach(function (x) { x.input.value = ''; });
              var n = ((r.data || {}).signed_out_elsewhere) || 0;
              say(body, 'Password changed.' + (n ? ' Signed out on ' + n + ' other '
                + (n === 1 ? 'device.' : 'devices.') : ''));
              if (OW.toast) OW.toast('Password changed.', { tone: 'ok' });
            });
        });
      }

      /* ── DELETE YOUR ACCOUNT (identity/departure.py) ─────────────────────
         What goes and what stays is said before anything is asked. The
         password is the gate (and the code, if the server says two-step is
         on); the button asks once by asking twice, the rule Log out keeps —
         no modal. A Center the person owns is named by the server's refusal
         and must be handed over first. */
      function pageDelete(body) {
        body.appendChild(mk('p', 'ow-set__lede',
          'Your profile, your posts, your likes and the people you follow are removed. '
          + 'Every session ends, every site you signed in to with ONEWAY loses access, '
          + 'and you leave every Center you belong to. Comments you left in other people\'s '
          + 'conversations stay, shown as "Deleted account". Your email address cannot be '
          + 'used for a new account. This cannot be undone.'));
        var pw = field('Your password', 'password', { autocomplete: 'current-password' });
        body.appendChild(pw.el);
        var code = field('A code from your authenticator app', 'text',
          { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '12' });
        code.el.style.display = 'none';     /* .ow-set__f is display:flex, which [hidden] loses to */
        body.appendChild(code.el);
        var go = btn('Delete your account', 'ow-set__danger'); body.appendChild(go);
        var armed = 0;
        go.addEventListener('click', function () {
          if (!pw.input.value) { say(body, 'Enter your password.', true); return; }
          if (!armed) {
            armed = global.setTimeout(function () { armed = 0; go.textContent = 'Delete your account'; }, 4000);
            go.textContent = 'Tap again to delete it for good';
            return;
          }
          global.clearTimeout(armed); armed = 0;
          go.disabled = true; go.textContent = 'Deleting…'; say(body, '');
          data.post('/api/oneway/identity/delete',
                    { password: pw.input.value, code: code.input.value, confirm: 'delete' })
            .then(function (r) {
              if (!r.ok) {
                go.disabled = false; go.textContent = 'Delete your account';
                if (r.body && r.body.needs_2fa) code.el.style.display = '';
                say(body, r.error || 'Your account was not deleted.', true);
                return;
              }
              try {
                ['ow_session_token', 'ow_tokens', 'ow_session'].forEach(function (k) { global.localStorage.removeItem(k); });
              } catch (_) {}
              body.innerHTML = '';
              body.appendChild(mk('p', 'ow-set__big', 'Your account is deleted.'));
              global.setTimeout(function () { global.location.href = '/login.html'; }, 1800);
            });
        });
      }

      /* TWO-STEP VERIFICATION — an authenticator app, recovery codes shown once */
      function pageTwoStep(body) {
        function paint(state) {
          body.innerHTML = '';
          if (state.enabled) {
            body.appendChild(mk('p', 'ow-set__big', 'On'));
            body.appendChild(mk('p', 'ow-set__lede',
              'Signing in asks for a code from your authenticator app after your password. '
              + state.recovery_codes_left + ' recovery code'
              + (state.recovery_codes_left === 1 ? '' : 's') + ' left.'));
            var pw = field('Your password', 'password', { autocomplete: 'current-password' });
            body.appendChild(pw.el);
            var fresh = btn('Get new recovery codes', 'ow-btn--quiet');
            body.appendChild(fresh);
            var code = field('A code from your app, to turn it off', 'text',
              { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '12' });
            body.appendChild(code.el);
            var off = btn('Turn off two-step verification', 'ow-btn--quiet');
            body.appendChild(off);
            fresh.addEventListener('click', function () {
              data.post('/api/oneway/identity/2fa/recovery', { password: pw.input.value }).then(function (r) {
                if (!r.ok) { say(body, r.error || 'That did not work.', true); return; }
                showCodes((r.data || {}).recovery_codes || [], 'Your old recovery codes no longer work.');
              });
            });
            off.addEventListener('click', function () {
              data.post('/api/oneway/identity/2fa/disable', { password: pw.input.value, code: code.input.value })
                .then(function (r) {
                  if (!r.ok) { say(body, r.error || 'That did not work.', true); return; }
                  setValue('twostep', 'Off');
                  if (OW.toast) OW.toast('Two-step verification is off.', { tone: 'ok' });
                  paint({ enabled: false });
                });
            });
            return;
          }
          body.appendChild(mk('p', 'ow-set__big', 'Off'));
          body.appendChild(mk('p', 'ow-set__lede',
            'Add a second step to signing in: after your password, a 6-digit code from an '
            + 'authenticator app on your phone — Apple Passwords, Google Authenticator, '
            + '1Password, Authy or any other.'));
          var pw2 = field('Your password, to start', 'password', { autocomplete: 'current-password' });
          body.appendChild(pw2.el);
          var go = btn('Turn on'); body.appendChild(go);
          go.addEventListener('click', function () {
            go.disabled = true;
            data.post('/api/oneway/identity/2fa/setup', { password: pw2.input.value }).then(function (r) {
              go.disabled = false;
              if (!r.ok) { say(body, r.error || 'That did not start.', true); return; }
              setup(r.data || {});
            });
          });
        }
        function setup(d) {
          body.innerHTML = '';
          body.appendChild(mk('p', 'ow-set__step', '1 · Add ONEWAY to your authenticator app'));
          var open = mk('a', 'ow-btn', 'Open in my authenticator app');
          open.href = d.otpauth || '#';
          body.appendChild(open);
          body.appendChild(mk('p', 'ow-set__lede', 'Or type this key into the app:'));
          var key = String(d.secret || '').replace(/(.{4})/g, '$1 ').trim();
          var k = mk('p', 'ow-set__key', esc(key)); body.appendChild(k);
          var cp = btn('Copy key', 'ow-btn--quiet'); body.appendChild(cp);
          cp.addEventListener('click', function () {
            try { global.navigator.clipboard.writeText(d.secret || ''); cp.textContent = 'Copied'; } catch (_) {}
          });
          body.appendChild(mk('p', 'ow-set__step', '2 · Enter the code it shows'));
          var code = field('6-digit code', 'text', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6' });
          body.appendChild(code.el);
          var on = btn('Turn on'); body.appendChild(on);
          on.addEventListener('click', function () {
            on.disabled = true;
            data.post('/api/oneway/identity/2fa/enable', { code: code.input.value }).then(function (r) {
              on.disabled = false;
              if (!r.ok) { say(body, r.error || 'That code did not work.', true); return; }
              setValue('twostep', 'On');
              if (OW.toast) OW.toast('Two-step verification is on.', { tone: 'ok' });
              showCodes((r.data || {}).recovery_codes || [],
                'If you lose your phone, each of these signs you in once. This is the only time they are shown.');
            });
          });
        }
        function showCodes(codes, why) {
          body.innerHTML = '';
          body.appendChild(mk('p', 'ow-set__step', 'Save your recovery codes'));
          body.appendChild(mk('p', 'ow-set__lede', esc(why)));
          var box = mk('div', 'ow-set__codes');
          codes.forEach(function (c) { box.appendChild(mk('code', '', esc(c))); });
          body.appendChild(box);
          var cp = btn('Copy all', 'ow-btn--quiet'); body.appendChild(cp);
          cp.addEventListener('click', function () {
            try { global.navigator.clipboard.writeText(codes.join('\n')); cp.textContent = 'Copied'; } catch (_) {}
          });
          var done = btn('I have saved them'); body.appendChild(done);
          done.addEventListener('click', function () {
            data.get('/api/oneway/identity/2fa', { fresh: true }).then(function (r) {
              paint((r.ok && r.data) || { enabled: true, recovery_codes_left: codes.length });
            });
          });
        }
        paint(tf);
      }

      /* WHERE YOU ARE SIGNED IN — every session, and one way to end the rest */
      function pageSessions(body) {
        body.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
        data.get('/api/oneway/identity/sessions', { fresh: true }).then(function (r) {
          body.innerHTML = '';
          var list2 = ((r.ok && r.data && (r.data.sessions || r.data.items)) || []);
          if (!r.ok) { body.appendChild(mk('p', 'ow-set__lede', 'Your sessions could not be read just now.')); return; }
          body.appendChild(mk('p', 'ow-set__lede',
            list2.length + ' place' + (list2.length === 1 ? '' : 's') + ' signed in to your account.'));
          /* ── THE WAY OUT FIRST, THIS DEVICE FIRST, THE REST FOLDED ─────────
             Measured (founder/513 tour): an account signed in 586 times drew
             586 rows of "A browser", and the one act a person comes here for —
             ending the others — sat under all of them. The act leads; this
             device, then the most recently used, then "Show all". */
          var sorted = list2.slice().sort(function (a, b) {
            if (a.current !== b.current) return a.current ? -1 : 1;
            return String(b.last_seen || b.created_at || '').localeCompare(String(a.last_seen || a.created_at || ''));
          });
          var SHOWN = 9;
          function sessRow(x) {
            var row = mk('div', 'ow-set__sess');
            row.innerHTML = '<span class="ow-set__ic">' + setIcon('device') + '</span>'
              + '<span class="ow-set__lb">' + esc(x.client || 'A browser') + (x.current ? ' · this device' : '') + '</span>'
              + '<span class="ow-set__v">' + esc(OW.when ? OW.when(x.last_seen || x.created_at) : (x.last_seen || '')) + '</span>';
            return row;
          }
          var listHost = mk('div');
          if (list2.length > 1) {
            var all = btn('Sign out everywhere else', 'ow-btn--quiet'); body.appendChild(all);
            all.addEventListener('click', function () {
              data.post('/api/oneway/identity/signout-everywhere', {}).then(function (rr) {
                if (!rr.ok) { say(body, rr.error || 'That did not work.', true); return; }
                if (OW.toast) OW.toast('Signed out everywhere else.', { tone: 'ok' });
                pageSessions((body.innerHTML = '', body));
              });
            });
          }
          body.appendChild(listHost);
          sorted.slice(0, SHOWN).forEach(function (x) { listHost.appendChild(sessRow(x)); });
          if (sorted.length > SHOWN) {
            var more = btn('Show all ' + sorted.length, 'ow-btn--quiet');
            body.appendChild(more);
            more.addEventListener('click', function () {
              more.remove();
              sorted.slice(SHOWN).forEach(function (x) { listHost.appendChild(sessRow(x)); });
            });
          }
        });
      }

      /* ── SITES YOU SIGNED IN TO (founder/581) ──────────────────────────
         Every site a person used Sign in with ONEWAY on, newest first, with
         what it receives. Remove ends the site's access at once — its token
         stops answering on the next read. One read, one DELETE, re-read. */
      function pageSites(body) {
        body.innerHTML = '';
        body.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
        data.get('/api/oneway/signin/grants', { fresh: true }).then(function (r) {
          body.innerHTML = '';
          if (!r.ok) { body.appendChild(mk('p', 'ow-set__lede', 'Your sites could not be read just now.')); return; }
          var sites = (r.data && r.data.sites) || [];
          if (!sites.length) {
            body.appendChild(mk('p', 'ow-set__lede', 'You have not used Sign in with ONEWAY on any site.'));
            return;
          }
          body.appendChild(mk('p', 'ow-set__lede', 'These sites know you through ONEWAY. Removing one ends its access.'));
          sites.forEach(function (s) {
            var row = mk('div', 'ow-set__sess ow-set__site');
            var addr = ((s.origins || [])[0] || '').replace(/^https?:\/\//, '');
            var gets = (s.scope || []).indexOf('email') >= 0 ? 'Name, picture and email' : 'Name and picture';
            row.innerHTML = '<span class="ow-set__ic">' + setIcon('access') + '</span>'
              + '<span class="ow-set__lb">' + esc(s.name)
              + '<small>' + esc(addr + ' · ' + gets) + '</small></span>';
            var rm = btn('Remove', 'ow-btn--quiet');
            rm.addEventListener('click', function () {
              rm.disabled = true;
              data.del('/api/oneway/signin/grants/' + encodeURIComponent(s.client_id)).then(function (rr) {
                if (!rr.ok) { rm.disabled = false; say(body, rr.error || 'That did not work.', true); return; }
                if (OW.toast) OW.toast(s.name + ' removed.', { tone: 'ok' });
                pageSites(body);
              });
            });
            row.appendChild(rm);
            body.appendChild(row);
          });
        });
      }

      /* ── MESSAGE REQUESTS (founder/539) ────────────────────────────────
         A message from someone your rules in Who can message you hold back
         waits as a request. Messages draws them above the inbox; Settings had
         no door to them at all. This page draws Messages' own block
         (`OW.messaging.requestsBlock`) — one way to accept or decline, in
         one file — and an accepted request walks the person into it. */
      function pageRequests(body) {
        body.innerHTML = '';
        body.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
        data.get('/api/oneway/messaging/requests', { fresh: true }).then(function (r) {
          body.innerHTML = '';
          if (!r.ok) { body.appendChild(mk('p', 'ow-set__lede', 'Your message requests could not be read just now.')); return; }
          var rows = ((r.data && r.data.requests) || []).filter(function (x) { return x && x.from; });
          setValue('requests', rows.length ? String(rows.length) : '');
          body.appendChild(mk('p', 'ow-set__lede', esc(rows.length
            ? 'These people messaged you from outside your rules in Who can message you. Accept opens the conversation. Decline keeps it closed, and they are not told.'
            : 'No one is waiting. A message from someone outside your rules in Who can message you waits here until you decide.')));
          if (rows.length && OW.messaging && OW.messaging.requestsBlock) {
            body.appendChild(OW.messaging.requestsBlock(rows, {
              onOpen: function (c) { if (c && c.id) global.location.hash = '#messages/' + encodeURIComponent(c.id); }
            }));
          }
        });
      }

      /* CONNECTED ACCOUNTS — the accounts you already have, so what you post
         here can go there too (founder/503). Each platform is its own mark,
         whether it is connected, and the one act that fits: Connect. Nothing
         is ever sent from here; a post goes out only where it is chosen. */
      /* the row's act is the same chip "Try again" is — painted from the
         person's own light, so it reads on either theme */
      function reachBtn(label) {
        var b = mk('button', 'po-act ow-reach__go', esc(label));
        b.type = 'button';
        b.style.setProperty('--h', 'var(--ow-h1)');
        b.style.setProperty('--h2', 'var(--ow-h2)');
        return b;
      }
      /* IMPORT EVERYTHING (founder/597) — a connected account's posts, all of
         them, brought here as real posts through the platform's own API with
         the sign-in it granted. Never a link. The server says which platforms
         it can read and what each one gives (`platforms`), and how far a run
         has got (`imports`); this strip only says it in words and offers the
         one act that fits: Import posts · Stop · Continue · Import new posts. */
      function importsOf(cid) {
        return data.get('/api/oneway/places/' + encodeURIComponent(cid) + '/imports', { fresh: true })
          .then(function (r) {
            var d = (r && r.ok && r.data) || {};
            var cat = {}, runs = {};
            (d.platforms || []).forEach(function (p) { cat[p.platform] = p; });
            (d.imports || []).forEach(function (x) { if (!runs[x.platform]) runs[x.platform] = x; });
            return { cat: cat, runs: runs, ok: !!(r && r.ok) };
          }, function () { return { cat: {}, runs: {}, ok: false }; });
      }
      function importWords(t, run) {
        var n = function (v, one, many) { v = +v || 0; return v + ' ' + (v === 1 ? one : many); };
        if (!run || !run.state) return { line: 'Bring your ' + t.label + ' posts here', act: 'Import posts' };
        var kept = run.media_missed ? ' · ' + n(run.media_missed, 'photo or video', 'photos or videos') + ' could not be kept' : '';
        if (run.live && run.state === 'queued') return { line: 'Starting…', act: 'Stop', busy: true };
        if (run.live) return { line: 'Importing — ' + n(run.imported, 'post', 'posts') + ' in so far'
                                     + (run.already ? ', ' + run.already + ' already here' : ''), act: 'Stop', busy: true };
        if (run.state === 'done' && run.caught_up && !run.imported) return { line: 'Up to date — nothing new on ' + t.label + '.', act: 'Import new posts' };
        if (run.state === 'done') return { line: 'All in — ' + n(run.imported, 'post', 'posts') + ' imported' + kept + '.', act: 'Import new posts' };
        if (run.state === 'failed') return { line: run.reason || (t.label + ' stopped answering.'), act: '' };
        /* stopped, or a run whose process went away: a headline, then the
           platform's own words and what is already here on a quieter line */
        var said = run.said ? t.label + ' said: \u201c' + run.said + '\u201d. ' : '';
        return { line: run.reason || ('The import stopped before the end.'),
                 sub: said + (run.imported ? n(run.imported, 'post is', 'posts are') + ' already in. ' : '')
                      + (run.auth ? '' : 'Continue picks up where it stopped.'),
                 act: 'Continue' };
      }
      function importStrip(t, cat, run) {
        var strip = mk('div', 'ow-reach__imp');
        var txt = mk('span', 'ow-reach__imp-w');
        var line = mk('span', 'ow-reach__imp-t', '');
        var sub = mk('span', 'ow-reach__imp-s', '');
        txt.appendChild(line); txt.appendChild(sub);
        strip.appendChild(txt);
        var btn = reachBtn('Import posts');
        strip.appendChild(btn);
        var timer = 0;
        function paint(r) {
          run = r || run;
          var w = importWords(t, run);
          line.textContent = w.line;
          sub.textContent = (!run || !run.state) ? (cat.brings || '') : (w.sub || '');
          strip.setAttribute('data-busy', w.busy ? '1' : '0');
          btn.hidden = !w.act;
          btn.textContent = w.act || '';
          btn.setAttribute('aria-label', (w.act || '') + ' — ' + t.label);
          btn.disabled = false;
          global.clearTimeout(timer);
          if (w.busy) timer = global.setTimeout(poll, 2500);
        }
        function poll() {
          if (!global.document.body.contains(strip)) return;       /* the page was left */
          importsOf(t.center).then(function (s) { paint(s.runs[t.key] || run); });
        }
        btn.addEventListener('click', function () {
          var stopping = btn.textContent === 'Stop';
          btn.disabled = true;
          var url = '/api/oneway/places/' + encodeURIComponent(t.center) + '/imports'
                    + (stopping ? '/' + encodeURIComponent(t.key) + '/stop' : '');
          data.post(url, stopping ? {} : { platform: t.key }).then(function (r) {
            if (r && r.ok && r.data && r.data.import) { paint(r.data.import); return; }
            line.textContent = (r && r.error) || (stopping ? 'That did not stop — try again.' : 'The import did not start — try again.');
            btn.disabled = false;
          });
        });
        paint(run);
        return strip;
      }
      function pageConnected(body) {
        body.innerHTML = '';
        body.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
        var home = data.meHome && data.meHome();
        Promise.all([OW.reach.targets(home), home ? importsOf(home) : Promise.resolve({ cat: {}, runs: {} })]).then(function (got) {
          var ts = got[0], imp = got[1];
          body.innerHTML = '';
          if (!ts.length) {
            body.appendChild(mk('p', 'ow-set__lede', 'The platforms could not be read just now.'));
            return;
          }
          var on = ts.filter(function (t) { return t.connected; }).length;
          body.appendChild(mk('p', 'ow-set__lede', on
            ? on + ' connected. When you post, choose which of them it also goes to.'
            : 'Connect an account and anything you post here can go to it too. '
              + 'Nothing is sent anywhere unless you choose it on the post.'));
          /* what connecting means for being recognised (identity/links.py
             recognisable): said where the connecting happens */
          body.appendChild(mk('p', 'ow-set__lede', 'Places recognise you by these accounts only if you turn on '
            + 'Include accounts you connect, in Privacy.'));
          ts.forEach(function (t) {
            var row = mk('div', 'ow-reach__row');
            row.appendChild(OW.reach.mark(t.key));
            var w = mk('span', 'ow-reach__w');
            w.appendChild(mk('b', '', esc(t.label)));
            w.appendChild(mk('span', 'ow-reach__acct', esc(t.connected
              ? (t.account || 'Connected')
              : (t.canConnect ? 'Not connected'
                 : (String(t.connectWhyNot || '').split(' — ')[0] || 'Cannot be connected here yet')))));
            var note = mk('span', 'ow-reach__note', '');
            w.appendChild(note);
            row.appendChild(w);
            if (t.connected) {
              /* taking it back asks twice, the way Log out does (no modal) */
              var off = reachBtn('Disconnect');
              off.setAttribute('aria-label', 'Disconnect ' + t.label);
              var armed = 0;
              off.addEventListener('click', function () {
                if (!armed) {
                  armed = global.setTimeout(function () { armed = 0; off.textContent = 'Disconnect'; }, 3200);
                  off.textContent = 'Tap again';
                  return;
                }
                global.clearTimeout(armed); armed = 0; off.disabled = true;
                OW.reach.disconnect(t, note).then(function (done) {
                  if (done) global.setTimeout(function () { pageConnected(body); }, 1600);
                  else { off.disabled = false; off.textContent = 'Disconnect'; }
                });
              });
              row.appendChild(off);
            } else if (t.canConnect) {
              var c = reachBtn('Connect');
              c.setAttribute('aria-label', 'Connect ' + t.label);
              var slot = null;
              c.addEventListener('click', function () {
                if (t.connectKind === 'form') {
                  OW.reach.form(t, slot, function () { pageConnected(body); });
                  return;
                }
                c.disabled = true;
                OW.reach.connect(t, note).then(function () { c.disabled = false; });
              });
              row.appendChild(c);
            }
            body.appendChild(row);
            if (!t.connected && t.canConnect && t.connectKind === 'form') {
              slot = mk('div', 'ow-reach__slot');
              body.appendChild(slot);
            }
            /* connected and readable: its posts can come here, all of them */
            var cat = imp.cat[t.key];
            if (t.connected && cat && cat.can_import) body.appendChild(importStrip(t, cat, imp.runs[t.key]));
            else if (t.connected && cat && cat.why_not) note.textContent = cat.why_not;
          });
        });
      }

      /* COLOUR LOGOS — one switch for links and posts (founder/496) */
      function marksRow(body) {
        var sec = mk('div', 'ow-cust__row');
        sec.appendChild(mk('span', 'ow-cust__lbl', 'Platform logos'));
        var row = mk('button', 'ow-switch'); row.type = 'button';
        var on = !(OW.marks && OW.marks.get() === 'mono');
        row.setAttribute('aria-pressed', String(on));
        row.innerHTML = '<span class="ow-switch__b"><b>Colour logos</b>'
          + '<span>On your links and posts. Off shows them in black and white.</span></span>'
          + '<span class="ow-switch__k" aria-hidden="true"></span>';
        row.addEventListener('click', function () {
          var next = row.getAttribute('aria-pressed') !== 'true';
          row.setAttribute('aria-pressed', String(next));
          if (OW.marks) OW.marks.set(next ? 'color' : 'mono');
        });
        sec.appendChild(row);
        body.appendChild(sec);
      }

      /* the page a person opened while the reads were out, or the one the
         address asks for, opens again now that it can be built */
      if (full && carry.page && ROWS[carry.page]) openPage(ROWS[carry.page]);
      return rowEls.length;
    }
  }

  OW.live.settings = function (host) {
    return settingsMenu(host);
  };

  OW.live.appearance = function (host, email) {
    host.innerHTML = '';
    var wrap = mk('div');
    host.appendChild(wrap);
    loading(wrap, 2);
    return ownStyle().then(function (style) {
      wrap.innerHTML = '';
      widgetChooser(wrap, style);
      appearance(wrap, style, email || data.me() || '');
      return 1;
    });
  };

  OW.live.activity = function (host) {
    return activityCentre(host);
  };

  /* ══ THE CALENDAR — a person's plans, in order (founder/520) ═════════════
     THE CANON, docs/product/EXPERIENCE.md (the Founding Set): *"The ONEWAY
     Calendar connects experiences and commitments. It can include: events ·
     reservations · community activities · invitations · personal plans. The
     Calendar becomes a timeline of a person's interactions with the world."*
     The App had none of it.

     WHAT IT READS TODAY. `me/workspace.commitments` is the person's own
     bookings across every Center, each already carrying what was booked, the
     place, its local times, the party and the status. The events a person has
     said they are going to have no read by person yet (RSVPs are kept per
     Center) — asked of B; they join this list when it lands, through the same
     row. Nothing here is invented: an empty calendar says so.

     THE TIME IS THE PLACE'S. A stay at a hotel in New Jersey begins at 3:00 PM
     there, whoever is reading — so the hour is read off the booking's own
     local time, never converted into the reader's zone. */
  OW.live.calendar = function (host) {
    host.innerHTML = '';
    host.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
    return data.get('/api/oneway/me/workspace', { fresh: true }).then(function (r) {
      host.innerHTML = '';
      if (!r.ok) { refused(host, r, 'Your calendar'); return 0; }
      var d = r.data || {};
      var items = (d.commitments || []).filter(function (x) { return x && (x.start_local || x.start); })
        .map(function (x) {
          var st = parts(x.start_local || x.start), en = parts(x.end_local || x.end);
          var nights = (st && en) ? Math.round((Date.UTC(en.y, en.m - 1, en.d) - Date.UTC(st.y, st.m - 1, st.d)) / 864e5) : 0;
          var who = x.party_size > 1 ? x.party_size + ' people' : '';
          var kind = x.kind === 'reservation' ? ((x.thing && x.thing.kind === 'room') ? 'Stay' : 'Booking')
                   : x.kind === 'event' ? 'Event' : (x.kind || 'Plan');
          return { at: st, until: en, key: st ? st.key : '',
                   title: (x.thing && x.thing.name) || x.title || x.name || kind,
                   sub: [x.place || x.center || '', nights > 0 ? nights + (nights === 1 ? ' night' : ' nights') : '', who]
                          .filter(Boolean).join(' \u00b7 '),
                   kind: kind, status: x.status || '', center: x.center_id || '', id: x.id,
                   event: x.kind === 'event' ? (x.event_id || x.id) : '' };
        })
        .filter(function (x) { return x.at; })
        .sort(function (a, b) { return a.at.sort < b.at.sort ? -1 : a.at.sort > b.at.sort ? 1 : 0; });
      if (!items.length) {
        /* true again (B 8fa8f6b7): commitments carry the events a person
           answered Going, beside their bookings */
        nothing(host, 'What you book and the events you are going to appear here, in the order they happen.', 'Nothing planned');
        return 0;
      }
      var now = new Date();
      var today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
      var todayKey = key(today);
      var tomorrow = new Date(now.getTime() + 864e5);
      var tomorrowKey = key({ y: tomorrow.getFullYear(), m: tomorrow.getMonth() + 1, d: tomorrow.getDate() });
      var coming = items.filter(function (x) { return x.key >= todayKey || (x.until && x.until.key >= todayKey); });
      var past = items.filter(function (x) { return coming.indexOf(x) < 0; });
      var wrap = mk('div', 'ow-cal');
      var head = mk('div', 'ow-cal__head');
      head.appendChild(mk('h1', 'ow-cal__h', 'Calendar'));
      head.appendChild(mk('span', 'ow-cal__n', coming.length
        ? coming.length + ' coming up' : 'Nothing coming up'));
      wrap.appendChild(head);
      if (coming.length) paintDays(wrap, coming);
      else wrap.appendChild(mk('p', 'ow-set__lede', 'What you book and the events you are going to appear here.'));
      if (past.length) {
        var more = mk('button', 'ow-btn ow-btn--quiet', 'Earlier \u00b7 ' + past.length); more.type = 'button';
        more.addEventListener('click', function () {
          more.remove();
          var old = mk('div', 'ow-cal__past');
          old.appendChild(mk('h2', 'ow-cal__earlier', 'Earlier'));
          paintDays(old, past.slice().reverse());
          wrap.appendChild(old);
        });
        wrap.appendChild(more);
      }
      host.appendChild(wrap);
      return items.length;

      function paintDays(into, list) {
        var lastKey = '';
        list.forEach(function (x) {
          if (x.key !== lastKey) {
            lastKey = x.key;
            into.appendChild(mk('h3', 'ow-cal__day', esc(dayWord(x.at))));
          }
          var b = mk('button', 'ow-cal__row'); b.type = 'button';
          b.setAttribute('data-kind', x.kind.toLowerCase());
          b.innerHTML = '<span class="ow-cal__time"><b>' + esc(clock(x.at)) + '</b>'
            + '<span>' + esc(x.kind) + '</span></span>'
            + '<span class="ow-cal__b"><span class="ow-cal__t">' + esc(x.title) + '</span>'
            + (x.sub ? '<span class="ow-cal__s">' + esc(x.sub) + '</span>' : '')
            + (x.until && x.until.key !== x.key ? '<span class="ow-cal__s">Until ' + esc(dayWord(x.until)) + ', ' + esc(clock(x.until)) + '</span>' : '')
            + '</span>'
            + (x.status ? '<span class="ow-cal__st" data-status="' + esc(x.status) + '">' + esc(x.status.charAt(0).toUpperCase() + x.status.slice(1)) + '</span>' : '');
          /* an event opens itself; a booking opens the place it is at */
          if (x.event) b.addEventListener('click', function () {
            try { global.location.hash = '#event/' + encodeURIComponent(x.event); } catch (e) {}
          });
          else if (x.center) b.addEventListener('click', function () {
            try { global.location.hash = '#center/' + encodeURIComponent(x.center); } catch (e) {}
          });
          else b.disabled = true;
          into.appendChild(b);
        });
      }
      function dayWord(p) {
        if (p.key === todayKey) return 'Today';
        if (p.key === tomorrowKey) return 'Tomorrow';
        var dt = new Date(p.y, p.m - 1, p.d);
        var o = { weekday: 'short', day: 'numeric', month: 'short' };
        if (p.y !== today.y) o.year = 'numeric';
        return dt.toLocaleDateString(undefined, o);
      }
    });
    function parts(iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso || ''));
      if (!m) return null;
      var p = { y: +m[1], m: +m[2], d: +m[3], h: m[4] == null ? null : +m[4], mi: m[5] == null ? 0 : +m[5] };
      /* a bare UTC instant ("…Z") has no local hour of its own — read it in
         the reader's zone rather than print a UTC hour as the place's */
      if (/Z$|\.\d+Z$/.test(String(iso)) && p.h != null) {
        var dt = new Date(iso);
        p = { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() };
      }
      p.key = key(p);
      p.sort = p.key + ' ' + (p.h == null ? '00' : ('0' + p.h).slice(-2)) + ':' + ('0' + p.mi).slice(-2);
      return p;
    }
    function key(p) { return p.y + '-' + ('0' + p.m).slice(-2) + '-' + ('0' + p.d).slice(-2); }
    function clock(p) {
      if (p.h == null) return 'All day';
      var h12 = ((p.h + 11) % 12) + 1;
      return h12 + (p.mi ? ':' + ('0' + p.mi).slice(-2) : '') + (p.h < 12 ? ' AM' : ' PM');
    }
  };

  /* the two pages above — the renderers already existed; these are their doors */
  OW.live.places = function (host) {
    host.className = ''; host.innerHTML = '';
    return worldReality(host, function (cid) { openCenterPopit(cid, null); });
  };
  OW.live.memories = function (host) { return memories(host); };

  OW.live.understanding = function (host) {
    /* `brainPane` already makes both reads and already decides what happens
       when the narrative fails. Calling it is the whole implementation — an
       earlier version restated the fetches here and referred to a
       `brainRender` that never existed, which rendered an empty surface and
       threw only when something asked it to. */
    return brainPane(host);
  };

  /* ── THE REAL SITE AS THE CENTER'S TABS (founder/514–516) ────────────
     `website.pages[]` is the site's pages in its own menu order, each with
     where it opens and how (`frame` live, `mirror` the owner's copy, `link`
     forbidden to frame). A page deeper in the site belongs under the section
     it lives in — Four Queens' twelve room pages are the Hotel's, not twelve
     more tabs — so a page whose folder is a section already listed is that
     section's; `parent` on the page, when the read carries the menu's own
     hierarchy (B is building it), outranks the folder. Each tab opens with
     its section's pages in a row above the frame. */
  function realSiteTabs(web) {
    if (!web || !web.url || !(web.mode === 'frame' || web.mode === 'mirror')) return [];
    if (!(OW.site && OW.site.mirror)) return [];
    var pages = (web.pages || []).filter(function (p) { return p && p.opens && p.mode !== 'link'; });
    if (!pages.length) pages = [{ path: '/', label: 'Home', opens: web.url, mode: web.mode }];
    var tops = [], byPath = {}, byDir = {};
    function dirOf(path) { return String(path || '/').replace(/[?#].*$/, '').replace(/[^/]*$/, ''); }
    pages.forEach(function (p) {
      var owner = (p.parent && byPath[p.parent]) || null;
      if (!owner) { var d = dirOf(p.path); if (d !== '/' && byDir[d]) owner = byDir[d]; }
      if (owner) { owner.kids.push(p); return; }
      var t = { page: p, kids: [] };
      tops.push(t);
      byPath[p.path] = t;
      var d2 = dirOf(p.path);
      if (d2 !== '/' && !byDir[d2]) byDir[d2] = t;
    });
    /* ONE "Website" TAB, NOT THE SITE'S MENU (founder/561: "The Center's tab
       strip should contain Oneway-relevant modules, not every navigation item
       found on an external website"). The Hoxton put 40 entries in the strip —
       languages, every city, "View all London properties". The site's own
       pages now live in the mirror's page row inside that one tab: a section
       per top-level path, language roots left to the site's own switch, eight
       at most; its front door stays in the link bar. */
    var LANG = /^[a-z]{2}(-[a-z]{2})?$/i, row = [], taken = {};
    function seg(path) { var m = /^\/([^/?#]+)/.exec(String(path || '/')); return m ? m[1].toLowerCase() : ''; }
    tops.map(function (t) { return t.page; }).forEach(function (p) {
      var k = seg(p.path);
      if (k && LANG.test(k)) return;
      if (taken[k || '/']) return;
      taken[k || '/'] = 1; row.push(p);
    });
    if (!row.length) row = [pages[0]];
    return [{ id: 'website', label: 'Website', has: true,
              render: function (pane) {
                OW.site.mirror(pane, { url: web.url, mode: web.mode, sandbox: web.sandbox,
                                       title: web.title, why: web.why, pages: row.slice(0, 8) }, 0);
              } }];
  }

  OW.live.center = function (host, centerId, opts) {
    opts = opts || {};
    loading(host, 2);
    return Promise.all([
      /* THE LEGACY /experience READ IS GONE (2026-10-01). Its last fact,
         network.down — what this Center contains — now rides on the composed
         /app answer as nearby.down, and that answer was already composing the
         same experience server-side: every Center page did it twice. */
      Promise.resolve({ ok: false }),
      /* PARTICIPATION IS ON THE COMPOSED READ NOW (B, 1b2c48a): begin, reach
         and why beside `you`, resolved by the same code the legacy door used.
         The legacy read that stood here is gone; `part` is built from the
         composed answer below. The slot stays so the indices under it do not
         move. */
      Promise.resolve({ ok: true, data: {} }),
      /* the Center's own canvas, read rather than inferred from a mounted
         instance — see the note on the Main tab below */
      data.get('/api/canvas/' + encodeURIComponent('center:' + centerId)),
      /* ── THE CENTER'S OWN COMPOSED READ ───────────────────────────────
         ★ MEASURED BY B, 2026-09-12: this surface printed "1 posts" for a
           Center holding FIFTY, because the count came from
           `e.galleries.length` — the number of GALLERIES on the legacy
           experience payload, which is a different question that happened to
           be a number.

         `/api/oneway/centers/{ref}` is the canonical face and it answers
         `public.posts`, `public.members` and `public.located` — the counts as
         COUNTS, from the store that owns them, not as the length of whatever
         list was nearest. This is the first read of the Center's cutover onto
         the composed model; the legacy experience payload still carries the
         events, the systems and the rest until B's composed Center read
         subsumes them, and when it does this line is the one that widens. */
      data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/app')
    ]).then(function (res) {
      var ex = res[0], pa = res[1], cvRes = res[2], cn = res[3];
      /* The canonical face, or nothing — never a guess. An unreadable
         canonical read leaves `pub` empty and every consumer below falls back
         to what the legacy payload can answer, which is how it behaved
         before this line existed. */
      /* THE COMPOSED CENTER READ (B, 3c98f04). `/app` is the same route family
         as the thin one this used to call, and additive: identity, where with
         a map pin and local time, heartbeat, counts, the viewer's standing,
         posts, events, bookable, people and the message door, each read in its
         own guard so a part that could not be read is NAMED in `unreadable`
         and its slot is empty rather than missing. */
      var app = (cn && cn.ok && cn.data) || {};
      var pub = app.counts || {};
      var cbook = app.bookable || {};
      /* the composed read's own word on whether this part could be read */
      var bookUnreadable = (app.unreadable || []).indexOf('bookable') >= 0;
      var cpeople = app.people || {};
      var cvData = (cvRes && cvRes.ok && cvRes.data) || {};
      var centerPlacements = (cvData.placements || []).length;
      /* same distinction as the profile: a Center whose canvas read failed is
         not a Center with nothing on it, and "An empty Main" is a claim about
         the place rather than about the request */
      var centerCvOk = !!(cvRes && cvRes.ok);
      /* WHO MAY ARRANGE IS THE SERVER'S ANSWER, and it is now taken from the
         canvas read instead of from `centerCv.mayArrange` on a mounted
         instance. Same fact, same source — but it no longer requires the
         canvas to be in the DOM at the moment somebody presses Place, which
         it is not until the Main tab has rendered. */
      var centerMayArrange = !!cvData.may_arrange;
      /* THE COMPOSED READ IS THE ONE THIS SURFACE STANDS ON. This refused on
         the legacy /experience read, so a Center whose canonical door answered
         was still "could not be loaded" when the legacy one failed. Measured
         2026-09-14 over all 486 Centers in the dev database: both doors answer
         200 for every one, so the guard moves to the read every part below is
         drawn from. */
      if (!cn || !cn.ok) { refused(host, cn, 'This Center'); return 0; }
      var e = (ex && ex.ok && ex.data) || {};
      /* ── SIX PARTS FROM THE COMPOSED READ (B, 518d3b5) ──────────────────
         presence, opportunities, today, header, story and information are on
         /app, byte-identical to the /experience copies — B diffed the first
         four; the last two were diffed here over six Centers on 2026-09-14
         (36 parts, 0 differences). They are read from the composed answer
         first and from the legacy payload only when it did not answer.

         WHAT WAS "STILL ONLY ON /experience" WAS MEASURED AND MOSTLY WAS NOT:
           arrival.hue       == header.hue on every Center (and identity.hue is
                                set where both are null — the canonical-founded
                                ones — so hue reads identity last)
           arrival.heartbeat == /app.heartbeat, byte for byte
           arrival.banner/logo — 0 of 985 Center rows have ever carried one;
                                there is no writer, so there is nothing to read
           network.up        == nearby.up, byte for byte
           stay.room_kinds   — every Center that has one also lists those rooms
                                in bookable.things, so the Here fallback it fed
                                could never fire
         ONE FIELD REMAINS: network.down — what this Center contains — which
         /app.nearby does not carry yet. It is asked of B, and when nearby.down
         lands the /experience read (the only reason `ex` still exists) leaves
         this surface. `galleries` is retired by founder ruling and is not read. */
      var _cnA = (cn && cn.ok && cn.data) || {};
      ['presence', 'opportunities', 'today', 'header', 'story', 'information']
        .forEach(function (k) { if (_cnA[k] != null) e[k] = _cnA[k]; });
      /* `head` carries name, category, location, introduction and heartbeat —
         everything the legacy `identity` block was read for — so there is one
         source for the Center's own facts, not two that could disagree. */
      var head = e.header || {}, ident = head;
      /* `part` from the composed read: begin/reach/why are its own part, and
         the viewer's standing is `you` — same facts the legacy participation
         door answered, from one read instead of two. `operating` was the
         legacy word; the canonical one is `operates`, so the viewer object
         carries both spellings and every reader below keeps working. */
      var _cn0 = (cn && cn.ok && cn.data) || {};
      var _you = _cn0.you || {};
      var part = {
        begin: (_cn0.participation || {}).begin || {},
        reach: (_cn0.participation || {}).reach || {},
        why: (_cn0.participation || {}).why || {},
        counts: _cn0.counts || {},
        viewer: { following: !!_you.following, member: !!_you.member,
                  operating: !!_you.operates, operates: !!_you.operates,
                  role: _you.role || '', signed_in: !!_you.signed_in }
      };
      void pa;
      var hue = hueOf(head) || hueOf(_cnA.identity) || null;
      if (hue) OW.hue.context('center', hue, 800);   /* the world takes its light (§17) */

      /* ── THE CENTER'S OWN CANVAS ─────────────────────────────────────
         ★ FOUNDER, 2026-08-24: *"Center -> Oneway OS: customizable Center
           canvas/surface … the same ecosystem, different surface and
           permissions."* And: *"do not mark Canvas complete merely because Home
           works."*

         ONE MODEL, THREE SURFACES. This is the same `OW.canvas` that draws a
         person's Home, pointed at `center:{id}`. What differs is not the
         renderer but WHO MAY ARRANGE — and that answer comes from the server's
         `may_arrange`, which resolves through `may_operate`. A visitor sees the
         Center's arrangement and cannot move it; an operator can. Neither is a
         second canvas.

         IT IS ADDITIVE. Everything already on this surface — the ways in, the
         counts, the identity — is untouched. Founder: *"do not rewrite
         functioning frontend merely because the backend underneath it
         changed."* */
      /* ── THE CENTER'S CANVAS IS MOUNTED IN ITS MAIN TAB, NOT HERE ───────
         ★ FOUNDER, 2026-08-24: *"Center -> Oneway OS: customizable Center
           canvas/surface … the same ecosystem, different surface and
           permissions."* And: *"do not mark Canvas complete merely because
           Home works."*

         IT WAS MOUNTED HERE, INTO `host`, AND THEN DELETED EVERY TIME. Six
         hundred lines below, this function calls `profileShell(host, …)`,
         whose first act is `host.className = ''; host.innerHTML = ''`. So the
         canvas was built, populated from the server, and wiped before anyone
         saw it — on every render since it was written. Measured on a Center
         with nine placements and may_arrange true: 0 `.ow-center-canvas` nodes
         in the DOM, no error, no warning. It looked like a Center that had
         never been arranged.

         THIS IS THE THIRD TIME THIS EXACT SHAPE HAS COST US A CANVAS, and the
         second one left a comment saying so — My Center's Main tab: *"appending
         the canvas to the same node first meant the profile render wiped it,
         and the tab came back with no Popits at all while looking like it had
         worked."* A warning about a mistake is not a guard against it.

         So the canvas goes where a person's does: inside the Main tab, in its
         own container, under the shell that owns the page. */

      /* ── DISCOVER -> CHOOSE -> PLACE ─────────────────────────────────────
         ★ FOUNDER, 2026-08-24: *"How does someone get from an Event/Center they
           discover into a Canvas placement? … Don't build three different
           mechanisms. There should be ONE placement primitive with different
           authorization/context."*

         So this is `OW.canvas.place()` and nothing else — the same
         desired-state write the drag uses. What the surface supplies is only
         the CONTEXT: what is being placed, and which destinations exist here.

         THE CENTER IS OFFERED AS A DESTINATION ONLY IF THE SERVER SAID SO.
         `centerMayArrange` comes from the canvas read at the top of this
         function, which resolves through `may_operate`; this file never
         decides it. A visitor is offered their Home and nothing else, which is
         the true answer rather than a disabled button. */
      function placeTargets() {
        var also = [];
        if (centerMayArrange) {
          also.push({ surface: 'center:' + centerId,
                      label: (head.name || 'This Center') + ' — its own surface' });
        }
        return also;
      }
      function placeBtn(label, kind, ref, what) {
        var b = mk('button', 'po-act po-act--ghost', label);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (!signedIn()) { if (global.go) global.go('home'); return; }
          b.disabled = true;
          var was = b.textContent;
          OW.canvas.place(kind, ref, { also: placeTargets(), what: what })
            .then(function (r) {
              b.disabled = false;
              /* FOUR ANSWERS, NOT TWO. "Added" and "already there" are
                 different facts; so are "written down here" and "saved". A
                 button that says Added for a queued write is the fabricated
                 success §24 forbids. */
              if (r && r.ok && r.already) b.textContent = 'Already on ' + r.label;
              else if (r && r.ok) b.textContent = 'Added to ' + r.label;
              else if (r && r.queued) b.textContent = 'Saved on this device';
              else if (r && r.reason === 'cancelled') b.textContent = was;
              else b.textContent = 'Could not add';
              if (r && (r.ok || r.queued)) {
                setTimeout(function () { b.textContent = was; }, 2600);
              }
            });
        });
        return b;
      }

      /* the ways in, only those reality supports */
      var begin = part.begin || {}, viewer = part.viewer || {};
      var acts = mk('div', 'ow-prof__acts');
      function way(on, label, path, undo, undoMethod, stat, then) {
        var b = mk('button', 'po-act', on ? (label + 'ing') : label);
        b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('data-act', on ? 'on' : 'off');
        b.addEventListener('click', function () {
          OW.act(b, { path: path, undoPath: undo, invalidate: '/api/',
            undoMethod: undoMethod || undefined,
            labels: { on: label + 'ing', off: label },
            /* the count under the name moves with the press — `on` is the
               state the act just reached, handed in by OW.act */
            after: function (r, nowOn) {
              if (stat) bumpStat(b, stat[0], nowOn ? 1 : -1, stat[1], stat[2]);
              if (typeof then === 'function') then(nowOn);
            } });
        });
        acts.appendChild(b);
      }
      /* The ways a relationship can BEGIN are for people who do not have one.
         Offering Follow to the person who runs the place is the runtime asking
         someone to start something they are already inside. */
      /* ── FOLLOW A CENTER THROUGH THE GRAPH, the door the composed read
         already believes. `you.following` on /app is read from the canonical
         graph edge (gstore.edge(FOLLOW, me, cid)); this button wrote through
         legacy /api/centers/{id}/follow, so the screen's own state and the
         button's write went through two doors. MEASURED 2026-09-13 before
         cutting over: POST /api/oneway/graph/follow/{cid} -> you.following
         true and counts.followers 0 -> 1; DELETE -> back to false and 0. One
         path, one write, one read. Surface-by-surface: the legacy pair is
         gone from this screen. (Join/leave stays on the legacy door until a
         canonical membership write exists — that is a different primitive.) */
      /* ★ FOUNDER/442: *"Follow and join should be the exact same thing."*
         One button. Following IS joining: the press writes the graph edge
         (the door the composed read believes) and, where the Center takes
         members, the membership too — so a person who followed a community
         is in it, and a person who followed a hotel follows it. One word on
         the button, because the act is one act. */
      if ((begin.follow || begin.join) && !viewer.operating) {
        /* THE MEMBERSHIP RIDES ALONG WITH THE FOLLOW, AND ONLY AFTER IT — in
           the state the follow actually reached. This was a second click
           listener reading `aria-pressed`, which the follow's own press had
           ALREADY flipped: so unfollowing a Center JOINED it and following it
           LEFT (founder/502 crawl: one press, DELETE follow + POST join). Now
           it is told the answer, and a refused follow writes no membership. */
        way(!!(viewer.following || viewer.member), 'Follow',
          '/api/oneway/graph/follow/' + encodeURIComponent(centerId),
          '/api/oneway/graph/follow/' + encodeURIComponent(centerId), 'DELETE',
          ['followers', 'follower', 'followers'],
          begin.join ? function (nowOn) {
            /* the canonical membership writer (team.join / team.leave), whose
               route honours the Center's join mode — 2026-10-01; the legacy
               /api/centers/{id}/join alias is not called */
            data.post('/api/oneway/places/' + encodeURIComponent(centerId) + (nowOn ? '/join' : '/leave'), {}).then(function (r) {
              /* the follow went through and the membership did not — said,
                 because "Following IS joining" (442) and the person would
                 believe they were in (founder/502 sweep) */
              if (r && !r.ok && OW.toast) OW.toast((nowOn ? 'You follow it, but joining did not go through. '
                                                          : 'You unfollowed it, but you are still a member. ')
                                                   + (r.error || 'Try again.'));
            });
          } : null);
      }

      /* ── MESSAGING A CENTER — WHO WILL ACTUALLY READ THIS ───────────────
         ★ FOUNDER, 2026-09-01: *"Center reception where applicable."*

         A CENTER IS NOT A PERSON, and messaging one is a different act. It
         declares HOW it receives — a Brain, a workspace, named recipients —
         and `GET /api/oneway/centers/{id}/reception` answers that BEFORE
         anybody writes. So the button says who is on the other end instead of
         posting into a room and hoping, which is the difference between a
         contact form and a conversation.

         `/reception` and `/message` are canonical, tested, and had no caller
         anywhere in the App — the same gap as the messaging surface itself,
         one object over. Reading reception first is also what stops this from
         being a second messaging entry point: the conversation it opens is an
         ordinary conversation and lands in the ordinary inbox. */
      var reach = mk('button', 'po-act', 'Message'); reach.type = 'button';
      reach.addEventListener('click', function () {
        /* ── A GUEST CAN ASK WITHOUT AN ACCOUNT (EXPERIENCE.md) ────────────
           The canon's Guest Communication: *"People should be able to
           interact with Centers without requiring a full account
           immediately … asking a hotel question · contacting a restaurant ·
           requesting information."* Signed out, this press was a refusal.
           Now it opens the question right here — no modal — and sends it
           through the Center's public door, which routes it to the right
           team and opens a conversation on the Center's side. The contact
           is how they answer; nothing else is asked. */
        if (!signedIn()) { guestAsk(); return; }
        reach.disabled = true; reach.textContent = 'Opening…';
        /* ONE CALL, BECAUSE THE ROUTE ALREADY DOES BOTH. My first cut read
           `/reception` and then posted to `/message` — but `/message` takes no
           body, opens (or REUSES) the conversation, and returns the disclosure
           with it. Two calls would have raced the Center's own answer against
           itself and made "who receives this" a thing the client stitched
           together from two reads instead of the one the route exists to give.
           Read the contract; do not infer it from the name. */
        OW.messaging.messageCenter(centerId).then(function (out) {
          reach.disabled = false; reach.textContent = 'Message';
          if (out.state !== 'open') {
            acts.appendChild(mk('p', 'po-act__why', esc(out.why || 'refused')));
            return;
          }
          var d = out.data || {};
          var disc = (d.reception || {}).disclosure || {};
          /* WHO IS ON THE OTHER END, SAID BEFORE THE FIRST WORD IS TYPED. A
             Center may be answered by its Brain, and the person is told so —
             `is_human` is a fact this surface must never soften. */
          if (disc.who) {
            acts.appendChild(mk('p', 'po-act__why',
              esc(disc.says || ('Received by ' + disc.who))));
          }
          if (d.conversation_id && opts.onMessage) {
            opts.onMessage({ id: d.conversation_id,
                             title: head.name || 'This Center',
                             kind: 'center', object: centerId,
                             about: disc.who || '',
                             participants: [data.me()] });
          }
        });
      });
      acts.appendChild(reach);
      function guestAsk() {
        var open = acts.parentNode && acts.parentNode.querySelector('.ow-guest');
        if (open) { var ta0 = open.querySelector('textarea'); if (ta0) ta0.focus(); return; }
        var box = mk('form', 'ow-guest');
        box.setAttribute('novalidate', '');
        var nm = head.name || ident.name || 'this place';
        box.appendChild(mk('h3', 'ow-guest__h', esc('Ask ' + nm)));
        box.appendChild(mk('p', 'ow-guest__p', 'No account needed. They reply to the email or number you leave.'));
        var q = doc.createElement('textarea'); q.rows = 3; q.placeholder = 'Your question';
        q.setAttribute('aria-label', 'Your question'); q.maxLength = 800;
        var who = doc.createElement('input'); who.type = 'text'; who.placeholder = 'Your name';
        who.setAttribute('aria-label', 'Your name'); who.maxLength = 80; who.autocomplete = 'name';
        var how = doc.createElement('input'); how.type = 'text'; how.placeholder = 'Email or phone';
        how.setAttribute('aria-label', 'Email or phone, so they can reply'); how.maxLength = 120; how.autocomplete = 'email';
        var said = mk('p', 'ow-guest__said', '');
        var row = mk('div', 'ow-guest__acts');
        var send = mk('button', 'ow-btn', 'Send'); send.type = 'submit';
        var cancel = mk('button', 'ow-btn ow-btn--quiet', 'Cancel'); cancel.type = 'button';
        cancel.addEventListener('click', function () { box.remove(); });
        row.appendChild(send); row.appendChild(cancel);
        [q, who, how].forEach(function (el) { box.appendChild(el); });
        box.appendChild(said); box.appendChild(row);
        box.addEventListener('submit', function (e) {
          e.preventDefault();
          var text = q.value.trim(), contact = how.value.trim();
          if (!text) { said.textContent = 'Write your question first.'; q.focus(); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && (contact.replace(/[^0-9]/g, '').length < 7)) {
            said.textContent = 'Leave an email or a phone number, so they can answer you.'; how.focus(); return;
          }
          send.disabled = true; send.textContent = 'Sending…'; said.textContent = '';
          data.post('/api/public/center/' + encodeURIComponent(centerId) + '/message',
            { message: text, guest_name: who.value.trim() || 'Guest', contact: contact, source: 'app' })
            .then(function (r) {
              send.disabled = false; send.textContent = 'Send';
              if (!r.ok) { said.textContent = r.error || 'That did not send. Try again.'; return; }
              box.innerHTML = '';
              box.appendChild(mk('h3', 'ow-guest__h', 'Sent'));
              box.appendChild(mk('p', 'ow-guest__p', esc(((r.data && r.data.message) || ('Sent to ' + nm + '.'))
                + ' They will answer at ' + contact + '.')));
            });
        });
        acts.parentNode.insertBefore(box, acts.nextSibling);
        q.focus();
      }


      /* ★ FOUNDER/442: *"I don't even know what an add to your home button
         means — that should just be in the popit add menu."* Gone from the
         header; the Popit add menu on Home is where a Center is added. */

      /* ── AND *THEN* WHERE IT IS ─────────────────────────────────────────
         MEASURED 2026-09-13 at 375px: this block used to be built HERE, before
         "Add to your Home", and `.ow-prof__acts` is a wrapping flex row while
         `.ow-where` claims a whole line of it. So the header read

             [ Message ]
             [ Atlantic City · New Jersey · United States ][ Take me there ]
             [ Add to your Home ]

         — the two things you can DO to this Center split apart by a panel
         about where it is, and a 157px tall "actions row". Nothing was wrong
         with either piece; they were in the wrong order, which is the kind of
         thing that reads as "unfinished" without ever looking like a bug.

         The two acts now sit together and the place follows them, which is
         also the honest reading order: what you can do here, then where here
         is. Only the position moved — every word, rule and door below is
         unchanged. */
      /* ── WHERE IT IS, AND HOW TO GET THERE ──────────────────────────────
         ★ FOUNDER, 2026-09-02: *"needs to SEEMLESS BIND CENTER TO LOCATION FOR
           THOSE THAT HAVE. WE NEED SIMPLE TRANSIT INSTRUCTIONS FOR NOW AND
           EVENTUALLY WILL HAVE FULL GOOGLE MAPS APPLE MAPS NAVIGATION."*

         ★ FOUNDER, same block: *"these hollow projections of any popit and look
           like placeholders are gonna be systematically eliminated."*

         SO THIS RENDERS NOTHING AT ALL WHEN THERE IS NO LOCATION. Measured on
         the canonical store: 80 of 196 Centers resolve a location and 116 do
         not. A "location" row on those 116 would be a hollow projection — a
         Popit-shaped hole where a fact should be — which is the exact thing
         being eliminated. `resolved:false` means the element is never created.

         SEAMLESS MEANS IT IS NOT A SEPARATE ACT. The Center already knows where
         it is; `/api/oneway/centers/{ref}/where` is the canonical answer and it
         carries the chain, the city and the LOCAL TIME, all derived from one
         zone rather than stored — so a Center never has a stale "open now".
         Nothing here is entered by hand and nothing is a second location store.

         AND THE TRANSIT HANDOFF IS THE BRIDGE, NOT A STOPGAP. A `geo:` /
         maps-query URL is what every phone already understands: iOS opens Apple
         Maps, Android and desktop open Google Maps, and the person gets THEIR
         navigation with their saved places and their account. That is better
         than an embedded map we would have to key, and when full in-app
         navigation arrives this same call site hands off the same destination —
         the contract does not change, only what receives it.

         NO KEY, NO EMBED, NO THIRD PARTY IN THE PAGE. Founder, 2026-08-31:
         *"no exposed secret · no fake map · works globally."* */
      /* ★ FOUNDER/442: *"Atlantic City New Jersey United States two sixteen
         p.m EDT — I have no idea what that means … clicking take me there
         does nothing."* The place-and-clock line is gone from the header: the
         city is in the bio when it matters, and a clock only means something
         when the reader is in another zone. Directions are one press in the
         link bar (below), built from the Center's own point, and they open the
         person's own maps app. */
      var whereRead = data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/where')
        .catch(function () { return { ok: false }; });

      /* ── "WHAT IS HAPPENING" IS THE UPCOMING TAB ─────────────────────────
         A second list of this Center's events stood here, below the tabs,
         read from the legacy relationship door (/api/public/centers/{id}/
         events) so that an event another Center PROMOTES here could be
         shown. Measured 2026-09-14 across the whole dev database: 283 event
         edges, 279 of them `owns` (the Center's own calendar, already on the
         composed read and drawn by the Upcoming tab) and exactly ONE
         `promotes` — Caesars carrying a concert that ended on the 1st. So
         on every Center this section was the Upcoming tab said twice, from
         the old backend, on every open — three of a stranger's first-hour
         requests. Founder/377: the new backend, from the start. The tab is
         the list. When the canonical events read carries relationships
         (B's, named), "promoted by" returns as a line ON those rows, not as
         a second list. */

      var counts = part.counts || {};
      var stats = [];
      /* MEMBERS FROM THE PLACE THAT COUNTS THEM. `participation` answers for
         the viewer's own relationship; the canonical face answers for the
         Center, and where both speak the canonical one is the Center's own
         number. */
      var _members = (typeof pub.members === 'number') ? pub.members : counts.members;
      var _followers = (typeof pub.followers === 'number') ? pub.followers : counts.followers;
      /* ONE IS NOT PLURAL. The person's profile has singularised `follower`
         since it was written; a Center said "1 members" and "1 followers" —
         and a new Center has exactly one member, so this was the FIRST thing
         its founder ever read about their own place. */
      /* the third element NAMES the stat so a press can correct it live —
         the person profile already does this for followers; the Center's
         counts stood still until reload while the button said Joining */
      if (_members) stats.push([_members, _members === 1 ? 'member' : 'members', 'members']);
      if (_followers) stats.push([_followers,
                                  _followers === 1 ? 'follower' : 'followers', 'followers']);
      /* A COUNT, NOT THE LENGTH OF A LIST THAT HAPPENED TO BE THERE. See the
         note on the canonical read above: this said "1 posts" about fifty. */
      var _posts = (typeof pub.posts === 'number') ? pub.posts
                 : 0;
      if (_posts) stats.push([_posts, _posts === 1 ? 'post' : 'posts']);

      var hb = (head.heartbeat || _cnA.heartbeat || {});

      /* ══ THE PAGE (founder/429) ═══════════════════════════════════════════
         Sections, in the order a person visiting a place actually needs them.
         Each is drawn only when it has content; each that continues in a tab
         carries the door to it. Everything comes from the composed read this
         surface already made, plus the Center's own article. */
      function pageSections(pane) {
        /* ══ THE PAGE, BY KIND AND BY DEPTH ═══════════════════════════════
           ★ FOUNDER/448: *"product needs to varry and be grea."* — with
             442's addendum: the header is universal, EVERYTHING ELSE is
             the Center's own. A hotel led with the same list as a museum
             and a casino; only the words differed. Now the ORDER and the
             FRAMING come from what the place is: a hotel leads with where
             you stay, a casino with tonight and the floor, a museum with
             what is on view, a restaurant with the table.
           ★ FOUNDER/454–455 (S18): a section earns its place only with
             depth. "Open now · 2:45 PM there" was a band of its own; "Reach
             them" repeated the link bar; "The place · Established 1928" was
             two lines anybody could skip. Gone as sections. What has depth
             is drawn: three things to book, what is on with its own
             photographs, the areas inside, what it is known for when there
             is a real list, and ONE "Visit" block only when it can say at
             least three things (hours, now, address, since).
           EVERYTHING HERE IS A READ. The composed read this surface already
           made, plus the Center's own article; nothing composed in prose.
           One draw pass, after the article answers, so the order is the
           kind's order and never "whichever read came back first". */
        var page = mk('div', 'ow-cpage');
        pane.appendChild(page);
        var kindWord = String((app.identity && app.identity.kind) || ident.category || '').toLowerCase();
        function sec(title, doorLabel, doorTab) {
          var h = mk('div', 'ow-cpage__h');
          h.appendChild(mk('span', 'ow-cpage__ht', esc(title)));
          if (doorLabel && doorTab) {
            var d = mk('button', 'ow-cpage__door', esc(doorLabel));
            d.type = 'button';
            d.addEventListener('click', function () {
              if (host.__owShowTab) host.__owShowTab(doorTab);
            });
            h.appendChild(d);
          }
          page.appendChild(h);
          var body = mk('div', 'ow-cpage__b');
          page.appendChild(body);
          page.__owHas = true;
          try {
            var ghost = pane.querySelector('.po-empty, .po-state, .ow-empty');
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
          } catch (e) {}
          return body;
        }
        function lines(body, rows) {
          rows.filter(function (r) { return r && r.v; }).forEach(function (r) {
            var one = mk('div', 'ow-cpage__row');
            one.appendChild(mk('span', 'ow-cpage__k', esc(r.k || '')));
            if (r.href && /^(https?:|tel:|mailto:)/i.test(r.href)) {
              var a2 = doc.createElement('a');
              a2.className = 'ow-cpage__v ow-cpage__v--link';
              a2.href = r.href; a2.textContent = r.v;
              if (/^https?:/i.test(r.href)) { a2.target = '_blank'; a2.rel = 'noopener noreferrer'; }
              one.appendChild(a2);
            } else {
              one.appendChild(mk('span', 'ow-cpage__v', esc(r.v)));
            }
            body.appendChild(one);
          });
        }
        /* a row that is a thing — with its own photograph when it has one */
        function thingRow(title, line, pic, onPress) {
          var row = mk(onPress ? 'button' : 'div', 'ow-cpage__ev');
          if (onPress) { row.type = 'button'; row.addEventListener('click', onPress); }
          var src = pic ? (OW.imageUrl ? OW.imageUrl(pic) : pic) : '';
          if (src) {
            var im = doc.createElement('img');
            im.className = 'ow-cpage__pic'; im.src = src; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
            row.appendChild(im); row.setAttribute('data-pic', '1');
          }
          var t = mk('span', 'ow-cpage__t');
          t.appendChild(mk('b', '', esc(title)));
          if (line) t.appendChild(mk('span', '', esc(line)));
          row.appendChild(t);
          return row;
        }

        var zone = ((_cnA.where || {}).time || {}).timezone || '';
        function inZone(iso, opts) {
          var dt = new Date(iso); if (isNaN(dt)) return '';
          try {
            return new Intl.DateTimeFormat(undefined,
              Object.assign(zone ? { timeZone: zone } : {}, opts)).format(dt);
          } catch (e) { return ''; }
        }
        function sameDay(iso) {
          var a = inZone(iso, { year: 'numeric', month: 'numeric', day: 'numeric' });
          var b = inZone(new Date().toISOString(), { year: 'numeric', month: 'numeric', day: 'numeric' });
          return a && a === b;
        }
        function spansDays(x) {
          if (!x.starts_at || !x.ends_at) return false;
          return (new Date(x.ends_at) - new Date(x.starts_at)) > 3 * 86400000;
        }

        /* ── WHAT IS ON ─────────────────────────────────────────────────── */
        var NOT = { cancelled: 1, draft: 1, ended: 1 };
        var evs = (((_cnA.events || {}).items) || []).filter(function (x) {
          return x && x.title && !NOT[String(x.state || '').toLowerCase()]
                 && !(x.legacy && !x.starts_at);
        }).sort(function (a3, b3) {
          return String(a3.starts_at || '~').localeCompare(String(b3.starts_at || '~'));
        });
        function drawEvents() {
          if (!evs.length) return;
          var onView = evs.filter(spansDays), soon = evs.filter(function (x) { return !spansDays(x); });
          var title;
          if (kindWord === 'museum' || kindWord === 'gallery') title = onView.length ? 'On view' : 'Coming up';
          else if (kindWord === 'casino' || kindWord === 'club' || kindWord === 'venue') title = soon.length && sameDay(soon[0].starts_at) ? 'Tonight' : 'What is on';
          else title = 'What is on';
          var ordered = (kindWord === 'museum' || kindWord === 'gallery') ? onView.concat(soon) : evs;
          /* the Events tab's id is `today`; "events" opened nothing (559) */
          var eb = sec(title, ordered.length > 3 ? ('All ' + ordered.length) : '', 'today');
          ordered.slice(0, 3).forEach(function (x) {
            var day = x.starts_at ? inZone(x.starts_at, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            var hour = x.starts_at ? inZone(x.starts_at, { hour: 'numeric', minute: '2-digit' }) : '';
            var until = spansDays(x) && x.ends_at ? ('until ' + inZone(x.ends_at, { month: 'short', day: 'numeric' })) : '';
            var venue = (x.mode === 'digital' || x.mode === 'online') ? 'Online' : (x.place || '');
            var line = spansDays(x) ? [until, venue].filter(Boolean).join(' · ')
                                    : [day, hour, venue].filter(Boolean).join(' · ');
            eb.appendChild(thingRow(x.title, line, x.cover_image_url || x.cover || '', function () {
              try { doc.dispatchEvent(new CustomEvent('ow:open-event', { detail: { id: x.id } })); } catch (e) {}
            }));
          });
        }

        /* ── WHAT YOU CAN BOOK ──────────────────────────────────────────── */
        var bk = _cnA.bookable || {};
        var things = (bk.things || []).filter(function (t) { return t && t.name; });
        function drawBook() {
          if (!(bk.takes_bookings && things.length)) return;
          var kinds = {};
          things.forEach(function (t) { kinds[(t.kind || '').toLowerCase()] = 1; });
          var title = kinds.room ? 'Stay here'
                    : kinds.table ? 'Eat here'
                    : (kindWord === 'museum' || kindWord === 'gallery') ? 'Book a visit'
                    : (kindWord === 'casino' || kindWord === 'venue' || kindWord === 'club') ? 'Reserve'
                    : 'What you can book';
          var bb = sec(title, things.length > 3 ? ('All ' + things.length) : '', 'book');
          things.slice(0, 3).forEach(function (t) {
            bb.appendChild(thingRow(t.name, [t.kind || '', t.capacity ? ('holds ' + t.capacity) : '']
              .filter(Boolean).join(' · '), t.picture || '', null));
          });
        }

        /* ── THE AREAS OF THE HOUSE ─────────────────────────────────────── */
        var areas = (_cnA.explore || []).filter(function (a4) { return a4 && a4.name; });
        function drawInside() {
          if (areas.length < 2) return;                       /* one area is not a map of the house */
          var ab = sec((kindWord === 'casino') ? 'The floor' : 'Inside', '', '');
          areas.slice(0, 4).forEach(function (a4) {
            ab.appendChild(thingRow(a4.name, a4.description || '', a4.picture || a4.image || '', null));
          });
        }

        /* ── THE ARTICLE'S FACTS: known for, and the one Visit block ─────── */
        var facts = {};
        function drawKnown() {
          var spec = facts.specialties;
          if (!Array.isArray(spec) || spec.length < 3) return;     /* a list, not a word */
          var sb = sec((kindWord === 'museum' || kindWord === 'gallery') ? 'Collections' : 'Known for', '', '');
          var chips = mk('div', 'ow-cpage__chips');
          spec.slice(0, 8).forEach(function (x) {
            chips.appendChild(mk('span', 'ow-cpage__chip', esc(String(x))));
          });
          sb.appendChild(chips);
        }
        function drawVisit() {
          var rows = [];
          var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
          var DN = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
          var hrs = facts.hours;
          if (hrs && typeof hrs === 'object') {
            var said = [];
            DAYS.forEach(function (d) {
              var spans = hrs[d]; if (!spans || !spans.length) return;
              var txt = spans.map(function (sp) {
                return (sp[0] === '00:00' && sp[1] === '24:00') ? 'Open all day' : sp[0] + ' – ' + sp[1];
              }).join(', ');
              if (said.length && said[said.length - 1].txt === txt) { said[said.length - 1].days.push(d); return; }
              said.push({ txt: txt, days: [d] });
            });
            var closed = DAYS.filter(function (d) { return !hrs[d] || !hrs[d].length; });
            said.forEach(function (g) {
              rows.push({ k: g.days.length === 7 ? 'Every day'
                : (g.days.length > 1 ? (DN[g.days[0]] + '–' + DN[g.days[g.days.length - 1]]) : DN[g.days[0]]),
                v: g.txt });
            });
            if (closed.length && closed.length < 7) rows.push({ k: closed.map(function (d) { return DN[d]; }).join(', '), v: 'Closed' });
          }
          var openNow = facts.open_now;
          var localNow = zone ? (function () {
            try { return new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date()); }
            catch (e) { return ''; }
          })() : '';
          if (typeof openNow === 'boolean') rows.unshift({ k: 'Now', v: (openNow ? 'Open' : 'Closed') + (localNow ? ' · ' + localNow + ' there' : ''), open: openNow });
          var whereLabel = ((_cnA.where || {}).label) || ((_cnA.where || {}).address) || '';
          if (whereLabel && String(whereLabel).indexOf('·') < 0) rows.push({ k: 'Address', v: String(whereLabel) });
          if (facts.established) rows.push({ k: 'Since', v: String(facts.established) });
          if (rows.length < 3) return;                         /* S18: three facts or nothing */
          var vb = sec('Visit', '', '');
          lines(vb, rows);
          var nowRow = vb.querySelector('.ow-cpage__row');
          if (nowRow && typeof openNow === 'boolean') nowRow.setAttribute('data-open', openNow ? '1' : '0');
        }

        var ORDER = {
          hotel: ['book', 'events', 'inside', 'known', 'visit'],
          resort: ['book', 'events', 'inside', 'known', 'visit'],
          casino: ['events', 'book', 'inside', 'known', 'visit'],
          venue: ['events', 'book', 'inside', 'known', 'visit'],
          club: ['events', 'book', 'inside', 'known', 'visit'],
          museum: ['events', 'book', 'known', 'inside', 'visit'],
          gallery: ['events', 'book', 'known', 'inside', 'visit'],
          restaurant: ['book', 'events', 'known', 'inside', 'visit'],
          bar: ['book', 'events', 'known', 'inside', 'visit'],
          cafe: ['book', 'events', 'known', 'inside', 'visit'],
          _: ['events', 'book', 'inside', 'known', 'visit']
        };
        var DRAW = { events: drawEvents, book: drawBook, inside: drawInside, known: drawKnown, visit: drawVisit };
        var drawn = false;
        function draw() {
          if (drawn) return; drawn = true;
          (ORDER[kindWord] || ORDER._).forEach(function (k) { try { DRAW[k](); } catch (e) { console.warn('[app/center] section', k, e && e.message); } });
          page.__owHas = page.childNodes.length > 0;
        }
        data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/about')
          .then(function (r) {
            var art = (r && r.ok && r.data) || null;
            ((art && art.sections && art.sections.what || {}).facts || []).forEach(function (f) {
              if (f && f.key) facts[f.key] = f.value;
            });
            draw();
          }).catch(draw);
        /* the article never answering must not cost the page its events */
        setTimeout(draw, 2500);

        page.__owHas = !!(evs.length || (bk.takes_bookings && things.length) || areas.length > 1);
        return page;
      }

      /* ══ THE CENTER'S FEED, UNDER ITS MAIN ═══════════════════════════════
         ★ FOUNDER/459, 2026-09-20: *"these should take you to each centers
           feed with their main popit arrangment coming up at the top of the
           feed like users under a users view if they have."*
         A Center's posts were a tab of their own ("Posts"), two taps from
         the door. A person's page has never worked that way: the header,
         then their posts. So the Center's stream is drawn under Main — under
         the arrangement, under the page — and the Posts tab is gone. The
         stream draws NOTHING when there is nothing: no "Nothing public yet"
         (S17), the page above already says what the place is. */
      function mountCenterPosts(p) {
        var first = app.posts || {};
        var firstRows = first.items || first.feed || [];
        var unreadable = (app.unreadable || []).indexOf('posts') >= 0 || first.readable === false;
        if (unreadable) return 0;
        if (!firstRows.length) {
          /* EMPTY LOOKS INTENTIONALLY EMPTY, NOT BROKEN (founder/561: "An empty
             Main should clearly communicate something like: No posts yet with
             the appropriate Center context/action if the user has permission
             to post"). Where the posts would be, every Center the same way;
             the one act offered only to someone who can post here. */
          var _v = (part && part.viewer) || {};
          nothing(p, 'Nothing has been posted to ' + (head.name || 'this Center') + ' yet.', 'No posts yet',
                  (_v.member || _v.operates) ? [{ label: 'Post here', go: 'lightbulb' }] : []);
          return 0;
        }
        var wrap = mk('div', 'ow-cfeed');
        var h = mk('div', 'ow-cpage__h');
        h.appendChild(mk('span', 'ow-cpage__ht', esc(firstRows.length === 1 ? 'Post' : 'Posts')));
        wrap.appendChild(h);
        var river = mk('div', 'po-river');
        wrap.appendChild(river);
        p.appendChild(wrap);
        var seen = {};
        var fresh = firstRows.filter(function (row) {
          var id = (row && row.id) || ''; if (!id || seen[id]) return false;
          seen[id] = 1; return true; });
        OW.mountRiver(river, fresh, { open: false });
        OW.openCardsIn(river);
        /* AND ITS INTERACTIONS. A Post owns them on every surface
           (founder, 2026-08-30). */
        fresh.forEach(function (row) { OW.mountResponses(river, row); });
        /* NO "LOAD MORE" YET, DELIBERATELY: /social/places/{id}/feed takes no
           `before` — a cursor with no door that accepts it. Asked of B. */
        return fresh.length;
      }

      /* ONE COUNT OF WHAT IS COMING UP, for the tab, its icon in the link bar
         and nothing else to disagree with: the legacy day list plus the
         canonical rows that are neither over, cancelled, draft nor
         dateless-and-unopenable, deduped by id. MEASURED (founder/559): the
         link bar drew an Events icon from the raw item count, so Atlantic
         City and ONEWAY Test Hotel (two past events each) offered Events and
         opened "Nothing on the calendar yet". */
      var _upN = (function () {
        var ids = {};
        (e.today || []).forEach(function (t) { if (t && t.id) ids[t.id] = 1; });
        var NOT = { cancelled: 1, draft: 1, ended: 1 };
        return (e.today || []).length + (((app.events && app.events.items) || [])
          .filter(function (ev) {
            return ev && !(ev.id && ids[ev.id])
              && !NOT[String(ev.state || '').toLowerCase()]
              && !(ev.legacy && !ev.starts_at);
          }).length);
      })();
      var tabs = [
        /* ── MAIN — A CENTER IS A PROFILE OF A PLACE ───────────────────────
           ★ FOUNDER, 2026-08-25: *"I NEED THE USER PROFILES TO BECOME THE
             BASIS FOR MULTI PERSON CENTERS."*

           Me leads with the person's composed tiles. The Center led with a
           list of events and had no composed surface at all — two halves of
           one product opening in different grammars. Same tiles, same runtime,
           for a place.

           THE CONTRACTS ARE READ FROM THE REGISTRY, NOT INFERRED:
               now / next   render `d.text` and nothing else
               gallery      `cover` + `counts`
           I shipped `signal`, then `title`/`value`/`place`, then `{label,
           centerId}` links — three guesses, three empty tiles, before reading
           the six lines that decide it. `links` is deliberately not used: it
           keeps only entries with a real `url`, and a Center is an address in
           the App, not a web link. */
        /* WHETHER MAIN HAS ANYTHING ON IT, declared from the canvas read that
           has already happened. The shell opens the first tab that does not say
           it is empty, and without this Main would be "unknown" and would keep
           opening onto its own empty state. `centerCvOk` matters: a canvas that
           could not be READ is not a canvas with nothing on it, and must not be
           skipped as though it were. */
        { id: 'main', label: 'Main',
          /* MAIN IS ALWAYS THE PAGE NOW. It used to exist only when the
             Center had arranged Popits — so a Center with a real address,
             real hours and four rooms opened onto its own empty state
             (founder/429). The page has something to say whenever the Center
             does; `pageSections` decides that from the reads, not from a
             placement count. */
          has: true,
          render: function (pane) {
            /* EACH HALF ITS OWN CONTAINER — `OW.mountProfile` turns the node it
               is handed into a `.po-grid`, and a canvas mounted into that node
               becomes a GRID ITEM. Measured on a stranger's profile before this
               was understood: a 280px page gave the canvas 117px and every
               Popit rendered 19px wide. The plane was never wrong; it was being
               asked to fill a cell. */
            var faceSlot = mk('div', 'ow-center-canvas');
            var widgetSlot = mk('div');
            pane.appendChild(faceSlot);
            pane.appendChild(widgetSlot);
            /* ── THE CENTER AS A REAL PAGE ────────────────────────────────
               ★ FOUNDER/429: *"I need things to have real informational depth
                 and feel like real pages. Real web pages for things that
                 aren't part of a social media app, but a lifestyle app, which
                 one way also incorporates."*

               Main was a canvas and two tiles. A hotel, a museum, a casino,
               a community centre — on the internet each of those IS a page:
               whether it is open right now, what is on, what you can book,
               what it is known for, how to reach it, where it is, how long it
               has been there. Every one of those facts is already in the two
               reads this surface makes; none of them was drawn.

               THE RULES THIS PAGE KEEPS:
               · A section exists only when it has something to say. No empty
                 headings, no "no information available".
               · Three of a thing, then the door to the rest — the tab that
                 holds them all. A page shows; a tab lists.
               · Nothing is duplicated from the header (name, category,
                 location and the Center's own sentence live there).
               · Every fact is a read. Nothing here is composed prose. */
            var pageNode = pageSections(pane);
            /* the Center's own stream, last — under the arrangement and the
               page (founder/459) */
            var feedSlot = mk('div', 'ow-center-feed');
            pane.appendChild(feedSlot);
            var fed = mountCenterPosts(feedSlot);
            var faceMounted = false;
            if (centerPlacements && OW.canvas && OW.canvas.mount) {
              try {
                OW.canvas.mount(faceSlot, 'center:' + centerId);
                faceMounted = true;
              } catch (cvErr) {
                /* A Center's canvas must never cost somebody the Center. */
                console.warn('[app/center] canvas did not mount:',
                             cvErr && cvErr.message);
                if (faceSlot.parentNode) faceSlot.parentNode.removeChild(faceSlot);
              }
            }
            var w = [];
            /* gallery tiles are gone from here: the name is retired by
               ruling and the feed half of the family is dead (B's
               galleries.md); a Center's posts are its Posts tab */
            var soon = (e.today || {}).events || [];
            if (soon.length) {
              var n0 = soon[0] || {};
              w.push({ kind: 'next', id: 'c-next', size: '2x1', hue: hue,
                       text: [n0.title || 'An event',
                              OW.dayWords(n0.date, n0.time),
                              n0.location || ''].filter(Boolean).join(' — ') });
            }
            if (ident.location) {
              /* ── TWO POPITS REMOVED HERE, AND NEITHER WAS A STYLING FIX ──
                 ★ FOUNDER, 2026-09-06: *"see that how right now looks is
                   absolutely unacceptable. And these should not be how POPITS
                   should ever look."*

                 `kind: 'now'` IS A LIVENESS INSTRUMENT. `canvas.js` draws it as
                 a status ring with a pulsing core for online / away / offline —
                 movement that is meant to BE the information. Two Popits here
                 wore it around facts that never change, so a Center's page
                 showed a live-signal tile breathing over its own postcode. They
                 did not look wrong because of their styling; they looked wrong
                 because they were the wrong thing.

                 `c-where` also printed the category and location a THIRD time —
                 they are already the name and the sub-line. This file states
                 that rule two hundred lines below, about `who` and `where` from
                 the presence payload: *"printing them again is the 'Walk Tester
                 · in Walk Tester' duplication."* It was being broken here.

                 `c-net` carried something real — which Centers this one belongs
                 to — so it is NOT deleted, it is moved to About, where a
                 standing fact belongs. Deleting it would have been the other
                 mistake: losing information to tidy a tile. */
            }
            var net = _cnA.nearby || e.network || {};
            var around = (net.up || []).concat(net.down || (e.network || {}).down || []);
            if (!w.length) {
              if (faceMounted) return centerPlacements + fed;
              if (!centerCvOk) return nothing(widgetSlot,
                'This Center\u2019s surface could not be loaded just now. '
                + 'Nothing has been changed.', 'Could not load');
              /* THE CLAIM MUST MATCH WHAT IS TRUE OF THE PAGE. "Nothing has
                 been put on this Center yet" was said on a Center carrying
                 seven Posts, an upcoming Concert and a Story — all of them
                 visible in the tabs six inches above the sentence denying they
                 exist. Main is the ARRANGED surface: what an operator has
                 placed. Empty means nobody has arranged it, not that the place
                 is empty, and the difference is the whole reason this file
                 already distinguishes a failed canvas read from a bare Center.
                 It says which, and points at where the rest is. */
              /* AND NOT OVER A PAGE THAT SAYS PLENTY. Main carries the
                 Center's own page now (founder/429) — what is on, what you
                 can book, its hours, how to reach it. "Nobody has arranged
                 this" is about the CANVAS, and printing it above a full page
                 is the same false claim this note already records once. */
              if (pageNode && pageNode.__owHas) return centerPlacements + fed;
              /* ★ FOUNDER/445 (S17): *"dont add random subtext to real
                 profiles."* "Main is unarranged — nobody has arranged this
                 Center's Main yet…" was a paragraph ONEWAY wrote onto a real
                 Center's page. An empty Main is a legitimate thing to be:
                 the header says who they are, the tabs say what exists, and
                 the page does not explain itself. */
              return centerPlacements + fed;
            }
            OW.mountProfile(widgetSlot, w, { relation: 'stranger' });
            return w.length + centerPlacements + fed;
          } },

        /* THE RUNTIME'S OWN KEYS, AND THE RUNTIME'S OWN MEANING.
           Two defects met here and both were invisible until a Center had real
           events in it:

           1. This read `t.when` and `t.going`. The payload has `date`, `time`,
              `location` and `attendee_count` — so every event rendered as a
              bare title with NOTHING under it. "Rooftop dinner" with no date is
              not an event, it is a rumour. Same shape as the Discovery row that
              read `name` on objects that call themselves `event`.

           2. The tab said TODAY while the runtime hands it `upcoming[:10]` —
              so a dinner on 20 August was filed under "today". The label was
              describing a different question from the one the data answers.
              Renamed to what it IS; the founder's ruling that correctness
              fixes still count is what makes this mine to change.

           The date is written the way the rest of the App writes dates (the
           same `toLocaleDateString` shape `OW.when` falls back to), so a
           calendar row and a feed timestamp cannot drift into two formats. */
        /* NO `n` HERE, DELIBERATELY. It used to be `(e.today || []).length`,
           which is the LEGACY store's count — and this pane now also reads the
           canonical one, asynchronously, so a truthful count is not knowable at
           the moment the strip is built. Declaring 0 would be worse than
           declaring nothing: the opening-tab rule skips a tab that says it is
           empty, so this tab would have been stepped over while holding two
           real events. An unknown count is never skipped, which is exactly the
           behaviour an unknown deserves. */
        { id: 'today', label: 'Events',
          /* WHAT THIS TAB HOLDS, KNOWN BEFORE IT OPENS. The shell opens the
             first tab that does not say it is empty, and this one said
             nothing — so a Center with an unarranged Main and no calendar
             opened onto "Quiet · Nothing on the calendar yet" (Caesars,
             measured 2026-09-14) when About and Story had everything. The
             count is the same rule the render below applies: the legacy
             day list plus the canonical rows that are neither over,
             cancelled, draft nor dateless-and-unopenable, deduped by id. */
          n: _upN,
          /* NOTHING COMING UP, NO TAB (founder/559: "Name + 1 member +
             empty tabs"). Book, People and Here already leave the strip when
             they hold nothing; Events stayed, to say "Quiet · Nothing on the
             calendar yet" on every place that has no calendar. */
          hidden: _upN === 0,
          render: function (p) {
            var rows = (e.today || []).map(function (t) {
              /* A CALENDAR DATE IS NOT AN INSTANT. `Date.parse("2026-08-14")`
                 reads a bare Y-M-D as UTC MIDNIGHT, and rendering that in a
                 timezone behind UTC moves it to the 13th — I shipped exactly
                 that and watched a dinner on the 20th advertise itself as the
                 19th. Building the date from its own parts keeps it the day
                 the operator typed, in every timezone on earth. */
              var when = '';
              if (t.date) {
                var md = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t.date));
                if (md) {
                  when = new Date(+md[1], +md[2] - 1, +md[3])
                    .toLocaleDateString(undefined,
                      { weekday: 'short', month: 'short', day: 'numeric' });
                } else {
                  var dt = Date.parse(t.date);
                  when = isNaN(dt) ? String(t.date)
                       : new Date(dt).toLocaleDateString(undefined,
                           { weekday: 'short', month: 'short', day: 'numeric' });
                }
              }
              var going = (t.attendee_count > 0)
                ? (t.attendee_count + ' going') : '';
              /* THE DAY GOES ON THE MARK, not on a line underneath — the
                 same rule as the canonical rows below. `when` is already
                 formatted above under the timezone care this file documents;
                 the mark needs only the month and the day number. */
              var mdM = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t.date || ''));
              var mark = mdM ? { mon: new Date(+mdM[1], +mdM[2] - 1, +mdM[3])
                                     .toLocaleDateString(undefined, { month: 'short' }),
                                 day: +mdM[3] } : null;
              return { id: t.id || '', icon: 'event', when: mark,
                       _date: mdM ? mdM[0] : '', _time: t.time || '',
                       value: t.title || t.name || t.text,
                       label: [mark ? '' : when, t.time, t.location, going]
                                .filter(Boolean).join(' · ') }; });
            /* ── TWO EVENT SYSTEMS, AND THIS TAB COULD ONLY SEE ONE ───────
               ★ FOUNDER, 2026-09-09: surface *"architectural contradictions"*
                 and *"duplicated systems"* rather than working around them.

               MEASURED: The Boardwalk Bandstand has two scheduled events —
               "Boardwalk Beach Concert" on the 12th and "Late season swim" on
               the 26th — correctly stored and correctly indexed in
               `events_by_center`. This tab said "Quiet right now".

               `e.today` comes from `_center_events_all` in main.py, which reads
               `_org_events` plus resource objects. `events_by_center` is read by
               exactly one thing on the platform: `api/oneway/events/store.py`.
               So the canonical events domain writes one pair of stores and the
               Center page reads a different pair, and a Center's real calendar
               was invisible on the Center's own page.

               THE RIGHT FIX IS ONE SOURCE, and that is B's to make — the legacy
               reader should ask the canonical store. Until it does, a surface
               that CAN see the events should not pretend the place is quiet, so
               this reads the canonical route too and merges.

               BOTH DOORS, DEDUPED BY ID. Neither store is declared the loser:
               whichever holds an event, it appears once. A Center whose events
               live only in the legacy store is exactly as it was. */
            var _rest = mk('div');
            p.appendChild(_rest);
            /* ── THE CANONICAL HALF, FROM THE READ THIS SCREEN ALREADY MADE ──
               ★ FOUNDER/368: "right down to the pages". The public page and
                 this tab now read the SAME canonical list, so a Center cannot
                 say one thing on the web and another in the App.

               This was a SECOND request to /api/oneway/places/{id}/events on
               a screen whose composed read (`/app`, above) already carries
               `events.items` from the same service. Surface-by-surface
               cutover: one screen, one composed read. The request is gone and
               the rows come from `app.events`.

               FOUR DEFECTS IN THE OLD BLOCK, all found by B's audit or by
               fixing the public page an hour earlier:
                 · it read `ev.location`; canonical writes `place`. Every
                   canonical event on this tab lost its venue.
                 · `_iso` was never set on ANY row, so the "calendar" sorted
                   by rendered label text — "Fri" before "Mon" before "Sat".
                 · the day was the UTC calendar date of `starts_at`, built
                   into a local Date. A concert at 02:00Z is the 13th in UTC
                   and the evening of the 12th at the Center. The comment
                   forty lines up warns about exactly this, for the other
                   shape.
                 · cancelled and ended events were listed under "Upcoming".

               THE DAY AND HOUR ARE THE CENTER'S. `where.time.timezone` is on
               the same composed read, and Intl formats an instant IN a zone —
               no arithmetic, no guessing. A Center with no resolved zone shows
               the instant unconverted rather than the reader's clock. */
            (function () {
              var cev = (app.events && app.events.items) || [];
              var zone = (app.where && app.where.time && app.where.time.timezone) || '';
              var NOT_UPCOMING = { cancelled: 1, draft: 1, ended: 1 };
              var have = {};
              rows.forEach(function (x) {
                if (x.id) have[x.id] = 1;
                /* legacy rows: a naive local date+time, ordered as written */
                if (!x._iso && x._date) x._iso = x._date + 'T' + (x._time || '00:00');
              });
              function inZone(iso, opts) {
                var d = new Date(iso);
                if (isNaN(d)) return '';
                try {
                  return new Intl.DateTimeFormat(undefined,
                    zone ? Object.assign({ timeZone: zone }, opts) : opts).format(d);
                } catch (e) { return new Intl.DateTimeFormat(undefined, opts).format(d); }
              }
              cev.forEach(function (ev) {
                if (!ev || (ev.id && have[ev.id])) return;
                if (NOT_UPCOMING[String(ev.state || '').toLowerCase()]) return;
                /* ── A LEGACY ROW WITH NO INSTANT IS NOT "UPCOMING" ───────
                   MEASURED 2026-09-14 on Caesars: three rows under
                   "Upcoming" with no day on the mark, and pressing one did
                   nothing; on Atlantic City two more, and pressing one said
                   "not shown publicly". They are the legacy list's events
                   (`legacy: true`), which the composed read projects with
                   `starts_at` EMPTY and `state` "scheduled" — the store
                   holds "2026-07-17 · 7:00 PM"; all seven such rows on the
                   platform are past, and the projection drops the date
                   before the clock can say so. A row this surface can
                   neither place in time nor open is nothing a person can
                   act on, so it is not listed as coming up. Reported to B:
                   carry the date and the rows sort and end themselves, and
                   this line has no work left. */
                if (ev.legacy && !ev.starts_at) return;
                var iso = String(ev.starts_at || '');
                var when = iso ? inZone(iso, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
                var hour = iso ? inZone(iso, { hour: 'numeric', minute: '2-digit' }) : '';
                var mark = iso ? { mon: inZone(iso, { month: 'short' }),
                                   day: +inZone(iso, { day: 'numeric' }) } : null;
                var venue = (ev.mode === 'digital' || ev.mode === 'online') ? 'Online'
                          : (ev.place || ev.location || '');
                rows.push({ id: ev.id || '', icon: 'event', when: mark, _iso: iso,
                            value: ev.title || 'An event',
                            label: [mark ? '' : when, hour, venue].filter(Boolean).join(' \u00b7 ') });
              });
              /* SORTED ON THE INSTANT, which every row now carries. A row with
                 none sorts last rather than jumping the queue. */
              rows.sort(function (a, b) {
                return String(a._iso || '~').localeCompare(String(b._iso || '~')); });
              _rest.innerHTML = '';
              if (!rows.length) { _rest.classList.add('po-grid');
                /* THE CALENDAR'S OWN SENTENCE, not the heartbeat's. This
                   printed `hb.line` here, and on Caesars that is "Things are
                   coming up" — the heartbeat's reading of a post in the
                   last day — under the word "Quiet" on an empty calendar.
                   Two instruments, one contradiction. The heartbeat keeps
                   its line in the header; this tab says what it knows. */
                nothing(_rest, 'Nothing on the calendar yet.', 'Quiet');
                return; }
              factList(_rest, rows, null, function (rr, el) {
                if (rr.id) openEventScreen(rr.id);
              });
            })();
            /* AN EVENT IS AN OPENABLE THING (§19). The row above opens the
               object's Popit — the full article: its facts, what is coming,
               what already happened, who decided what, and what it is connected
               to. A row with no id simply does not open rather than opening
               something wrong. That call now lives inside the read, because the
               rows are not complete until the canonical store has answered;
               rendering here as well drew the list twice. */
            return rows.length;
          } },
        /* ── WHAT IS ACTUALLY HERE ────────────────────────────────────────
           Founder, 2026-08-18: *"focus on the actual contents of centers."*

           `opportunities.places` had never been rendered, and on a hotel it is
           the OFFER:

               Harbour Suite   capacity 4
               Room 101        capacity 2
               The terrace     capacity 40

           **A guest could not see what they could book.** The Center published
           its rooms and its public page showed events, photographs and prose
           while the thing a person came to find was in the payload, unread.

           ★ AND `stay.room_kinds` IS THE SAME REALITY SUMMARISED — "Room ×2" is
           an aggregate of two of the rows above. Rendering both would put one
           truth on the screen twice under two headings, which is the
           duplication the Constitution forbids by name. **The named list wins
           because it says more**: a capacity and an identity per place, rather
           than a count of a category. `stay` is used only when there are no
           named places, where a summary is the only thing there is. */
        /* ── WHAT YOU CAN ACTUALLY BOOK ─────────────────────────────────
           ★ FOUNDER (THREE_LANES section 5, step 5): opening a Center shows
             "where, local time, open or quiet, posts, events, BOOKABLE,
             people, a Message door".

           MEASURED 2026-09-12 in the browser: bookable and people were the two
           things on that list with nothing on screen — and the backend answers
           both. `bookable` carries `takes_bookings`, a named thing per place
           with its capacity, its rules and `next_free`, and `book_at`. This
           tab showed `opportunities.places` instead: the same rooms, with no
           word that they could be booked and no idea when one is free.

           THE CANONICAL LIST WINS WHERE IT ANSWERS, and the legacy places stay
           as the fallback for a Center the composed read has nothing for —
           said out loud rather than quietly preferred, because they are two
           descriptions of the same rooms and only one of them knows they are
           for hire.

           A THING IS NAMED BY ITS HANDLE, never an asset id — B's handle law,
           and the doors take `place: po_<handle>`. Passing an id here would
           produce a booking the public door refuses. */
        /* ── UNREADABLE IS NOT "TAKES NO BOOKINGS" ────────────────────────
           The composed read guards each part and NAMES a failed one in
           `unreadable[]`, handing back `{takes_bookings:false, things:[]}` in
           its place. This tab was drawn from the fallback alone, so a Center
           whose bookable read had failed rendered EXACTLY like a Center that
           takes no bookings — the tab simply was not there. And with it went
           "Yours here": the only path in the App to a table a person already
           holds at this place. Someone with a booking tonight would open the
           Center and find no trace of it, and nothing to say why.

           B's audit found it. Three answers, three renderings: bookable and
           empty -> no tab (correct, nothing to offer); unreadable -> the tab
           stays, the offer says it could not be read, and the person's own
           bookings — a separate read that may well have succeeded — are still
           shown. Never built is the composed read's `bookable` being absent
           altogether, and that renders as it always did. */
        (bookUnreadable || (cbook.takes_bookings && (cbook.things || []).length))
          ? { id: 'book', label: 'Book',
              n: bookUnreadable ? undefined : (cbook.count || (cbook.things || []).length),
              render: function (p) {
                /* WHAT YOU ALREADY HOLD COMES FIRST. If a person has a table
                   here, that is the fact they opened this tab for; the list of
                   what else is free is the second question, not the first. The
                   section removes itself when they have none and when they are
                   signed out, so it costs an empty screen nothing. */
                myBookings(p, centerId);
                if (bookUnreadable) {
                  p.appendChild(mk('p', 'ow-bk__why',
                    'What can be booked here could not be read just now. '
                    + 'That is not the same as nothing being bookable.'));
                  return 1;
                }
                var byHandle = {};
                (cbook.things || []).forEach(function (t) {
                  byHandle[t.handle || t.id || ''] = t;
                });
                return factList(p, (cbook.things || []).map(function (t) {
                  /* WHEN IT IS FREE IS THE FACT A PERSON CAME FOR. Said only
                     when it is known: a thing with no next opening says its
                     capacity instead, and a thing with neither says nothing
                     rather than "0" or "unknown". */
                  /* the Center's clock is not the reader's, and this row
                     carries no zone — see `awayWords` */
                  var when = t.next_free ? awayWords(t.next_free) : '';
                  var cap = t.capacity ? ('holds ' + t.capacity) : (t.kind || '');
                  return { id: 'bk-' + (t.handle || t.id || ''),
                           value: t.name || 'A place',
                           label: when ? ('next free ' + when) : cap,
                           icon: 'place',
                           go: t.handle || t.id || '' };
                }), 'Nothing here takes bookings yet.', function (row, node) {
                  bookingSheet(node, centerId, byHandle[row.go], cbook,
                               (app.where || {}).time);
                });
              } }
          : null,

        /* ── WHO IS HERE ────────────────────────────────────────────────
           The other half of the same measurement. `people.faces` carries a
           name and a ROLE per person and nothing on this surface read it, so a
           Center with members looked like a Center with nobody. Tapping a face
           opens that person, through the shell's own door — the same one a
           feed card and a map pin use. */
        ((cpeople.faces || []).length)
          ? { id: 'people', label: 'People',
              /* THE NUMBER ON THE TAB IS THE NUMBER OF ROWS UNDER IT. This
                 was `members` (the roster count, 3 on Caesars) over a list of
                 `faces` (the operators who speak for the place, 1) — a count
                 and a list that disagree on one screen, the defect the public
                 page's "2 upcoming" over one row had a day earlier. The
                 composed door carries operators' faces by contract and the
                 roster count as a fact; the fact is already in the header as
                 "3 members", so the tab counts what it shows. */
              n: (cpeople.faces || []).length,
              render: function (p) {
                /* by @handle — the read no longer sends anybody's address (people/refs.py) */
                return factList(p, (cpeople.faces || []).map(function (f, i) {
                  var who = f.ref || f.email || '';
                  return { id: 'pf-' + (who || i),
                           value: f.name || '',
                           label: f.role || '', icon: 'person',
                           face: { image: f.picture || f.image || '', name: f.name || '', shape: f.shape || 'round', kind: 'person' },
                           go: who };
                }), 'Nobody has joined yet.', function (row) {
                  if (row && row.go) {
                    try {
                      doc.dispatchEvent(new CustomEvent('ow:open-person',
                        { detail: { ref: row.go } }));
                    } catch (_) {}
                  }
                });
              } }
          : null,

        /* AND NOT TWICE. `opportunities.places` is the SAME rooms the Book
           tab above is already naming, from the legacy read. Rendering both
           put one truth on the screen under two headings — measured: "Book 24"
           beside "What's here 12" on one Center — which is the duplication the
           Constitution forbids by name, and this file already made exactly
           this ruling once about `stay.room_kinds`. Book says more, so Book
           wins; this stays for a Center the composed read has nothing for. */
        /* ── THE CENTER'S AREAS, FROM THE COMPOSED READ ─────────────────
           ★ FOUNDER/372, the casino, guest side; /373, "genuinely deep".

           MEASURED on Caesars: the composed /app door carries `explore` —
           eight areas of the house, each with its own sentence: The Lobby,
           The Gaming Floor, The Restaurants, The Circus Maximus Theater (with
           an event in it), Qua Baths & Spa, The Ocean Tower, Caesars Rewards,
           and the Gordon Ramsay Pub as a Center of its own. The public page
           draws them under "Here". The App drew NONE of them — a guest on the
           web could see the house and a guest in the App could not. A field
           on the wire that nothing read.

           `explore` is the canonical form of what this tab was drawing from
           the legacy `opportunities.places`; canonical leads, the legacy list
           stays as the fallback for a Center the composed read has nothing
           for, deduped by name against both the areas and the bookable
           things so one room is never on the screen twice (the rule this tab
           already keeps against Book). An area that is a Center opens as one;
           an area with an event says so. */
        (function () {
          var areas = (app.explore || []).filter(function (x) { return x && x.name; });
          var seen = {};
          areas.forEach(function (x) { seen[String(x.name).trim().toLowerCase()] = 1; });
          (cbook.things || []).forEach(function (t) { if (t && t.name) seen[String(t.name).trim().toLowerCase()] = 1; });
          var legacyPlaces = ((e.opportunities || {}).places || []).filter(function (x) {
            return x && x.name && !seen[String(x.name).trim().toLowerCase()]; });
          var any = areas.length || (!(cbook.takes_bookings && (cbook.things || []).length)
                                     && legacyPlaces.length);
          if (!any) return null;
          return { id: 'here', label: areas.length ? 'Here' : 'What\u2019s here',
              n: (areas.length + legacyPlaces.length) || undefined,
              render: function (p) {
                if (areas.length) {
                  var byId = {};
                  areas.forEach(function (x) { byId[x.id || x.name] = x; });
                  return factList(p, areas.map(function (x) {
                    var ev = (x.events_here || []).length;
                    return { id: 'ar-' + (x.id || x.name),
                             value: x.name,
                             label: [x.description || '',
                                     ev ? (ev + (ev === 1 ? ' event here' : ' events here')) : '']
                                      .filter(Boolean).join(' \u00b7 '),
                             icon: x.kind === 'center' ? 'center' : 'place',
                             face: x.kind === 'center' ? { image: x.picture || x.avatar || '', name: x.name, shape: x.shape || 'rounded' } : null,
                             go: x.kind === 'center' ? (x.id || '') : '' };
                  }).concat(legacyPlaces.map(function (x) {
                    return { id: 'pl-' + (x.id || ''), value: x.name,
                             label: x.capacity ? ('holds ' + x.capacity) : (x.kind || ''),
                             icon: 'place' };
                  })), 'Nothing here yet.', function (row, el) {
                    if (row.go) { openCenterPopit(row.go, el); return; }
                    /* ── AN AREA OPENS TOO ────────────────────────────────
                       MEASURED 2026-09-14: pressing "The Lobby" did nothing.
                       Seven of Caesars' eight areas are not Centers, so the
                       one door above skipped them and the row was a button
                       that led nowhere. Founder/376: every page has depth.
                       An area is what the Center says it is — its name, its
                       sentence, and what is on there — opened in the same
                       pane everything else opens in, out of the row that
                       was pressed. No box it does not have anything for. */
                    var area = byId[String(row.id || '').replace(/^ar-/, '')];
                    if (area) openAreaPopit(area, el, hue);
                  });
                }
                var places = legacyPlaces;
                if (places.length) {
                  return factList(p, places.map(function (x) {
                    return { id: 'pl-' + (x.id || ''),
                             value: x.name || 'A place',
                             /* CAPACITY IS THE FACT A PERSON IS LOOKING FOR, and
                                it is only said when it is known — a room with no
                                stated capacity says nothing rather than "0". */
                             label: x.capacity ? ('holds ' + x.capacity) : (x.kind || ''),
                             icon: 'place' };
                  }), 'Nothing here yet.');
                }
                /* `stay.room_kinds` ("8 × Room") stood here as a last
                   fallback. Measured 2026-09-14: every Center that has one
                   also lists those rooms in bookable.things, and this tab
                   is not built when Book has them — so this branch could
                   not be reached, and it is gone rather than left describing
                   a case that does not occur. */
                return factList(p, [], 'Nothing here yet.');
              } };
        })(),

        { id: 'about', label: 'About', render: function (p) {
            /* every fact says how it is known — status and audit come from the
               runtime, so nothing here is asserted without an origin */
            /* THE NETWORK IS A STANDING FACT, so it reads as one — first,
               because "what is this part of" places a Center before any of its
               details do. It was a "RIGHT NOW" tile; see the note in `main`. */
            var _net = _cnA.nearby || {};
            var _legacyNet = e.network || {};
            /* ── UP IS NOT DOWN ────────────────────────────────────────────
               This concatenated `up` and `down` under one label, "Part of".
               MEASURED on Caesars: "Atlantic City · Gordon Ramsay Pub & Grill
               · Part of" — a pub INSIDE the casino read as something the
               casino is part of. The relationship graph has a direction
               (contains / member_of, frozen vocabulary) and the sentence
               threw it away.

               `up` stays a fact — "Part of · Atlantic City" — because a Center
               belongs to few things. `down` is what this Center CONTAINS, and
               that is a LIST, not a clause: a casino holds a pub today and,
               once a site can be taken on (founder/374), a brand Center holds
               eight games and twenty-seven characters. Drawn as its own rows,
               each opening the thing it names, under the About prose. */
            var _around = (_net.up || _legacyNet.up || []);
            /* `down` is the one field still read off /experience — see the
               note at the top of this surface. nearby.down first, so the
               day B carries it the legacy read has no reader left. */
            var _inside = (_net.down || _legacyNet.down || _legacyNet.children || [])
              .filter(function (c) { return c && (c.name || c.id); });
            /* ── ABOUT DOES NOT REPEAT THE HEADING ────────────────────────
               ★ FOUNDER, 2026-09-09: *"Profiles and Centers still need
                 professional design refinement"* and *"improve hierarchy"*.

               The first card in About was the Center's NAME, a few lines under
               the same name set in display type as the page title. Measured on
               Harbour Lights: heading "Harbour Lights 643725", then a fact card
               reading "Harbour Lights 643725 · Name · Verified by the owner."
               A person does not read that as provenance; they read it as the
               page repeating itself, and the facts under it inherit the doubt.

               THE FACT IS NOT REMOVED FROM THE PLATFORM. `information` still
               carries the name and its audit, and every other reader — an
               operator's Brain view included — sees it exactly as before. This
               is the visitor surface declining to say the same thing twice,
               which is hierarchy rather than deletion.

               MATCHED ON THE VALUE, not the label. A label is display text a
               future source could reword or localise; the value either IS the
               heading or it is not, and that is the only question being asked. */
            var _heading = String(head.name || ident.name || '').trim().toLowerCase();
            var _facts = (e.information || []).filter(function (i) {
              return !(_heading &&
                       String(i.value || '').trim().toLowerCase() === _heading);
            }).map(function (i) {
              return { value: i.value, label: i.label, audit: i.audit }; });
            /* ONE CHIP PER PARENT, EACH A DOOR. "Part of" was one span
               joining up to three names with dots, and pressing it did
               nothing — measured on Caesars, whose "Atlantic City · Part of"
               is a Center a person can open. A parent is a place; it opens
               like one. */
            _around.slice(0, 3).reverse().forEach(function (c) {
              if (!c || !(c.name || c.id)) return;
              _facts.unshift({ label: 'Part of', value: c.name || c.id, go: c.id || '' });
            });
            /* ── A SENTENCE IS NOT A FACT, AND THEY WERE THE SAME SLAB ────
               ★ FOUNDER, 2026-09-09: the OS is *"too complicated, feature/list
                 driven, dense"* and the instrument is *"hierarchy, progressive
                 disclosure, navigation, defaults, grouping"* — not removal.

               `factList` gives every row the identical treatment: a full-width
               hue chip, a label and a provenance line. So a Center's own
               description — the one sentence it wrote about itself — arrived
               looking exactly like its postcode. Measured on Harbour Lights:
               two identical green slabs, "A room by the water." and "Harbour",
               with nothing to say which one a person came to read.

               THE DESCRIPTION IS THE CENTER SPEAKING. It reads as prose, in the
               same `ow-prof__bio` a person's own words already use, so a Center
               and a person say things the same way. What is left is small
               facts, and those go in `ow-prof__facts` — the quiet wrapping row
               built for exactly this, already styled, already used one surface
               over.

               NOTHING IS REMOVED AND NOTHING IS INVENTED. Every fact still
               appears and still carries its audit; the audit is simply
               subordinate to the fact rather than the same size as it. A Center
               with no description falls back to the list it always had, because
               then there is no sentence to lead with and a facts row alone is
               the honest shape. */
            var _prose = null, _small = [];
            _facts.forEach(function (f) {
              var lab = String(f.label || '').trim().toLowerCase();
              if (!_prose && (lab === 'about' || lab === 'description')) _prose = f;
              else _small.push(f);
            });
            /* ── ABOUT OPENS LIKE A CLEANLY ORDERED WEBSITE ─────────────────
               ★ FOUNDER/404 (2026-09-14), pointing at this tab drawn as five
                 stacked bars — Name · Location · Website · About · Industry,
                 each a Popit: *"this is what i mean when i say post card. if
                 about is a section it should open like a cleanly ordered
                 website."*
               So: the Center's own sentence as prose, then its facts as an
               ordered table — the label on the left, the value on the right,
               a hairline between rows, nothing boxed — Website a link out,
               Part of a door in, the audit on hover. What is inside follows
               as the list it is. A Center with no sentence keeps the table. */
            p.classList.remove('po-grid');
            var wrap = mk('div', 'ow-cabout');
            if (_prose) {
              wrap.appendChild(mk('p', 'ow-prof__bio', esc(_prose.value)));
              /* AN AUDIT LINE THAT KNOWS NOTHING IS NOT PROVENANCE. Measured
                 on Boardwalk Grand — a Center ONEWAY founded through the
                 canonical door — the line under its own sentence read
                 "Imported from an unknown source." A provenance line exists to
                 say WHERE a fact came from; when the runtime cannot say, the
                 honest rendering is silence, not a sentence that reads like a
                 fault. (The missing provenance itself is B's: a Center founded
                 by an operator should record that it was.) */
              /* ONLY A VERIFICATION IS SAID ALOUD (founder/561 + 445): "Verified
                 by the owner" was printed from a source string, never from a
                 verification; and a line saying who stated it is a line ONEWAY
                 added to a real profile. The audit stays on hover; a real
                 verification is the one that earns a visible line. */
              if (_prose.audit && /^Verified\b/.test(_prose.audit)) {
                wrap.appendChild(mk('p', 'ow-cabout__audit', esc(_prose.audit)));
              }
            }
            if (_small.length) {
              var dl = mk('dl', 'ow-cabout__dl');
              _small.forEach(function (f) {
                var rowEl = mk('div', 'ow-cabout__row');
                rowEl.appendChild(mk('dt', '', esc(f.label || '')));
                var dd = mk('dd', '');
                var site = String(f.label || '').trim().toLowerCase() === 'website'
                  ? String(f.value || '').trim() : '';
                if (site && !/^[a-z][a-z0-9+.-]*:/i.test(site)) site = 'https://' + site;
                if (site && /^https?:\/\//i.test(site)) {
                  var a = doc.createElement('a');
                  a.className = 'ow-cabout__link'; a.href = site; a.target = '_blank'; a.rel = 'noopener noreferrer';
                  a.textContent = f.value; dd.appendChild(a);
                } else if (f.go) {
                  var b = mk('button', 'ow-cabout__door', esc(f.value)); b.type = 'button';
                  b.addEventListener('click', function () { openCenterPopit(f.go, b); });
                  dd.appendChild(b);
                } else {
                  dd.textContent = f.value;
                }
                if (f.audit) rowEl.setAttribute('title', f.audit);
                rowEl.appendChild(dd);
                dl.appendChild(rowEl);
              });
              wrap.appendChild(dl);
            }
            /* SAID ONLY WHEN IT IS TRUE OF THE WHOLE TAB. This printed before
               the article below answered — and the article always carries
               something (who runs the place, when it came to ONEWAY), so on
               every reserve world About read "This place has not said
               anything about itself yet." directly above "Run by …" and its
               history (founder/559). Now it is said only when the article
               answers nothing either. */
            var _sayNothing = function () {
              if (_prose || _small.length) return;
              wrap.appendChild(mk('p', 'ow-cabout__audit', 'This place has not said anything about itself yet.'));
            };
            p.appendChild(wrap);
            /* ── THE ARTICLE (founder/381 · 404 · 414; B, 2026-09-18) ─────────
               GET /api/oneway/centers/{id}/about is the Center as an article,
               composed from what the platform knows and inventing nothing —
               its words, why it matters, hours and links, its history, who
               runs it, what it runs. Drawn UNDER the facts, in the founder's
               order, each section only when it has content, in the same
               prose / table shapes this tab already uses. Lane B made this
               cutover because no lane-A session was running; A owns it. */
            var artHost = mk('div', 'ow-cabout ow-cabout--article');
            p.appendChild(artHost);
            data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/about').then(function (r) {
              var art = (r && r.ok && r.data) || null;
              if (!art || !art.sections) { _sayNothing(); return; }
              var S = art.sections, w = S.what || {}, why = S.why || {}, hist = S.history || {},
                  ppl = S.people || {}, runs = S.runs || {};
              function section(title) {
                artHost.appendChild(mk('div', 'ow-cinside__h', title));
              }
              function table(rows) {
                var dl = mk('dl', 'ow-cabout__dl');
                rows.forEach(function (rw) {
                  if (!rw || rw.value == null || rw.value === '') return;
                  var rowEl = mk('div', 'ow-cabout__row');
                  rowEl.appendChild(mk('dt', '', esc(rw.label || '')));
                  var dd = mk('dd', '');
                  if (rw.href) { var a = doc.createElement('a'); a.className = 'ow-cabout__link'; a.href = rw.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = rw.value; dd.appendChild(a); }
                  else dd.textContent = rw.value;
                  rowEl.appendChild(dd); dl.appendChild(rowEl);
                });
                if (dl.childNodes.length) artHost.appendChild(dl);
              }
              /* in their words — anything the operator said that the prose above did not */
              var said = (w.words || []).filter(function (x) { return x && x.text && (!_prose || x.text !== _prose.value); });
              if (said.length) { section('In their words'); said.forEach(function (x) { artHost.appendChild(mk('p', 'ow-prof__bio', esc(x.text))); }); }
              /* why it matters */
              var whyRows = (why.items || []).filter(function (x) { return x && x.text; });
              if (whyRows.length || (why.goals || []).length) {
                section('Why it matters');
                whyRows.forEach(function (x) { artHost.appendChild(mk('p', 'ow-prof__bio', esc(x.text))); });
                if ((why.goals || []).length) table([{ label: 'Goals', value: why.goals.join(' · ') }]);
              }
              /* hours · links · established · specialties — the facts the table above never had */
              var DAYS = ['mon','tue','wed','thu','fri','sat','sun'], DN = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
              var factRows = [];
              (w.facts || []).forEach(function (f) {
                if (!f || f.value == null || f.value === '') return;
                if (f.key === 'hours' && typeof f.value === 'object') {
                  /* SEVEN IDENTICAL ROWS ARE ONE FACT. A hotel open around the
                     clock rendered "Mon Open all day" seven times down the
                     page; a place with one weekday pattern rendered it five.
                     Days that say the same thing are said once, in the order
                     the week runs — and a week that genuinely differs still
                     lists every day. */
                  var said = [], order = [];
                  DAYS.forEach(function (d) {
                    var spans = f.value[d]; if (!spans || !spans.length) return;
                    var txt = spans.map(function (sp) { return (sp[0] === '00:00' && sp[1] === '24:00') ? 'Open all day' : sp[0] + ' – ' + sp[1]; }).join(', ');
                    if (said.length && said[said.length - 1].txt === txt) { said[said.length - 1].days.push(d); return; }
                    said.push({ txt: txt, days: [d] }); order.push(d);
                  });
                  said.forEach(function (g) {
                    var lab = g.days.length === 7 ? 'Every day'
                      : g.days.length > 1 ? (DN[g.days[0]] + '–' + DN[g.days[g.days.length - 1]])
                      : DN[g.days[0]];
                    factRows.push({ label: lab, value: g.txt });
                  });
                } else if (f.key === 'links' && Array.isArray(f.value)) {
                  f.value.forEach(function (l) { if (l && l.value) factRows.push({ label: l.label || l.kind || 'Link', value: l.value, href: /^https?:\/\//i.test(l.value) ? l.value : '' }); });
                } else if (['kind','where','since','website','timezone','open_now','team','location','industry'].indexOf(f.key) < 0) {
                  factRows.push({ label: f.label, value: Array.isArray(f.value) ? f.value.join(' · ') : String(f.value) });
                }
              });
              if (factRows.length) { section('Details'); table(factRows); }
              /* who runs it, and what it runs */
              /* A DEMONSTRATION SAYS SO, and says nothing more than the records
                 do (founder/561): ONEWAY made it; the business has not claimed
                 it. No "Run by ONEWAY" on a business ONEWAY does not run. */
              if (app.identity && app.identity.demo) {
                table([{ label: 'Made by', value: 'ONEWAY, as a demo environment — not a real business' }]);
              }
              if (ppl.demonstration) {
                table([{ label: 'Made by', value: 'ONEWAY, as a demonstration' }]);
                if (!ppl.demonstration.claimed) table([{ label: 'Claimed', value: 'Not yet claimed by ' + (head.name || 'the business') }]);
              }
              if ((ppl.operators || []).length) table([{ label: 'Run by', value: ppl.operators.map(function (o) { return o.name || o.email; }).join(' · ') }]);
              if ((runs.systems || []).length) table([{ label: 'Runs', value: runs.systems.map(function (x) { return x.name; }).join(' · ') }]);
              /* history — dated rows, newest first, as the article orders them */
              var hrows = (hist.items || []).filter(function (h) { return h && h.text; });
              if (hrows.length) { section('History'); table(hrows.map(function (h) { return { label: h.at || '', value: h.text }; })); }
            }).catch(function () { /* the facts above already stand; the article is additive */ });
            /* WHAT IS INSIDE — rows, each a door. Absent entirely when the
               Center contains nothing; never a heading over an empty list. */
            if (_inside.length) {
              var insideWrap = mk('div', 'ow-cinside');
              insideWrap.appendChild(mk('div', 'ow-cinside__h',
                _inside.length === 1 ? 'Inside' : 'Inside · ' + _inside.length));
              var insideList = mk('div');
              insideWrap.appendChild(insideList);
              p.appendChild(insideWrap);
              factList(insideList, _inside.map(function (c) {
                return { id: 'in-' + (c.id || c.name), value: c.name || c.id,
                         label: [c.category, c.location].filter(Boolean).join(' · '),
                         icon: 'place', go: c.id || '',
                         face: { image: c.picture || c.avatar || '', name: c.name || c.id, shape: c.shape || 'rounded' } };
              }), null, function (rr, el) {
                if (rr.go) openCenterPopit(rr.go, el);
              });
            }
          } },
        { id: 'story', label: 'Story', render: function (p) {
            /* A DATE IS A DATE, NOT AN ISO STRING. "2026-07-17 · record" is
               how a database says it; "Fri 17 Jul 2026 · record" is how a
               person reads it. A story date is a CALENDAR DATE — no hour, no
               zone — so it is built from its own parts, never parsed as an
               instant (which would move it a day in half the world). What
               does not parse stands as written. */
            function storyDay(d) {
              var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
              if (!m) return String(d || '');
              return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined,
                { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            }
            factList(p, (e.story || []).map(function (m) {
              return { value: m.text, label: storyDay(m.date), audit: m.origin }; }),
              'The living record begins here.');
          } }
      ];

      /* ── WHAT IS HAPPENING HERE, RIGHT NOW ────────────────────────────
         Founder, 2026-08-18: *"focus on the actual contents of centers and
         profiles."*

         `/api/public/center/{id}/experience` returns TWENTY blocks and this
         surface rendered EIGHT. `presence` was among the nine it threw away,
         and it is the best of them — the runtime had already composed a
         Center's whole front door:

             who       "Harbour Rooms — Other"
             where     "12 Harbour Parade, Atlantic City, NJ 08401"
             happening "Things are coming up — Next: Rooftop dinner · 2026-08-20"
             can_do    ["Plan a stay", "See rooms & amenities"]

         A person arriving at a Center wants to know what is going on there
         before anything else, and the answer existed, phrased, unread. This is
         the "read nobody renders" defect on the founder's own question.

         ONLY `happening` IS DRAWN, AND THE OMISSIONS ARE DELIBERATE:
         · `who` and `where` are already the name and the sub-line — printing
           them again is the "Walk Tester · in Walk Tester" duplication.
         · **`can_do` IS NOT RENDERED AND MUST NOT BE.** They are LABELS with no
           destination — the payload carries strings, not routes. A chip reading
           "Plan a stay" that does nothing is the `OW.go` defect exactly: a
           control indistinguishable from a feature switched off. When the
           runtime gives them somewhere to go they become buttons; until then
           they are a promise the surface cannot keep. */
      /* ★ FOUNDER/397: *"Caesars Atlantic City things are coming up is exactly
           what I mean. With shallow, it should just say events."* The line
           under the name — "Things are coming up — 1 happening in the last
           day", the heartbeat's sentence about activity — is gone. What is on
           is the Events tab, as a list: the day on the mark, the title, the
           place and the hour. A sentence about events is not events. */
      var live = null;

      /* ── THE CENTER'S SITE — ITS PAGES ARE ITS CATEGORIES (founder/433, /437)
         B, oneway-site.js: the site Lightbulb wrote, natively, in its own
         fonts and colours; the company's own site, exactly, in its frame.
         They LEAD when they exist, so opening the Center lands on its own
         home — projected over the galaxy. A page without oneway-site.js
         draws the Center as before. */
      /* ★ FOUNDER/514–516 (to B, 2026-09-24): *"both the site and the center
           should be the same but the site should be how its displayed on the
           oneway app with a centers profile framing and page sturcture"* ·
           *"I want these to be able to show real websites, not just our
           recreations of them … our recreations are pretty bad so far."*
         A Center that HAS a website shows THE WEBSITE: its own pages as the
         Center's tabs, in the site's own menu order, each drawn exactly —
         live in the frame where the site allows it, the owner's copy (the
         mirror) where it refuses. The recreation Lightbulb wrote stops being
         what people see; it stays underneath as data. The Center's own tabs
         (events, booking, people…) follow the site's pages. */
      function ownCover(idn) {
        var c = String(idn.cover || '').trim();
        if (!c) return '';
        if (/^\/assets\//.test(c)) return c;
        var host2 = function (u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; } };
        var ch = host2(c), site = host2(idn.website || '');
        if (!ch || !site) return '';
        /* the site's own host or one of its subdomains (cdn.example.com for example.com) */
        return (ch === site || ch.slice(-(site.length + 1)) === '.' + site) ? c : '';
      }
      /* ★ FOUNDER/681: a site's pages are among the Center's MAIN categories
           (its home simply Home), chosen by the Center — oneway-site.js
           categoryTabs, from the read's `website.categories`. Null when the
           Center keeps its site as one Website tab: realSiteTabs, as before. */
      var _real = (OW.site && OW.site.categoryTabs && OW.site.categoryTabs(app && app.website)) || realSiteTabs(app && app.website);
      if (_real.length) tabs = _real.concat(tabs);
      else if (OW.site && OW.site.tabsFor) tabs = OW.site.tabsFor(app, centerId).concat(tabs);
      /* and in the order the Center chose for its whole strip, the site's
         pages among its own categories (founder/681; oneway-site.js arrange) */
      /* OPPORTUNITIES (founder/682): the tab is here only when something is open (S18), read from
         the composed answer's `offering`; app/opportunities/opportunities.js draws it */
      var _opT = OW.opps && OW.opps.tabEntry && OW.opps.tabEntry(centerId, _cnA.offering);
      if (_opT) tabs.push(_opT);
      if (OW.site && OW.site.arrange) tabs = OW.site.arrange(tabs, app && app.website);
      profileShell(host, {
        kind: 'center', name: head.name || ident.name || 'Center',
        /* WHAT THIS PLACE IS — never what the READER is to it. `viewer.line`
           ("no relationship yet — one act away") was joined onto the end, so a
           Center's identity read:
               "Resort & Casino · Atlantic City, New Jersey ·
                no relationship yet — one act away"
           Three different kinds of statement in one uppercase run-on: a
           category, an address, and a prompt aimed at the reader. The prompt is
           also redundant — Follow and Message sit directly beneath it and say
           the same thing in the form of something you can press. */
        /* ★ FOUNDER/442: the address is one of the prominent things shown —
           `.handle`, a dot, not a dollar — with the kind after it. The city
           line and the website line are gone from the header: one link bar
           carries the site, the platforms, Events and Directions. */
        open: opts.open || '',
        sub: [((app.identity && app.identity.handle) ? '.' + String(app.identity.handle).replace(/^[$.]/, '') : ''),
              realCategory(ident.category) || ((app.identity || {}).kind && (app.identity || {}).kind !== 'community' ? app.identity.kind : ''),
              /* founder/561: a ONEWAY demo environment is unmistakably one */
              (app.identity && app.identity.demo) ? 'Demo' : '']
               .filter(Boolean).join(' \u00b7 '),
        /* THE PLACE'S OWN SENTENCE, under its name — the same slot a person's
           bio takes, drawn by the same rule: present when it exists, nothing
           at all when it does not (founder/369). MEASURED on Caesars as a
           guest: the door carried "The Boardwalk's grand room, where the
           lights never quite go down." and the header showed nothing of it;
           it lived only on the About tab. Every real place page puts that
           line under the name. The About tab keeps the whole About and its
           provenance; this is the first thing a guest reads. */
        bio: String((app.identity && app.identity.description)
                    || ident.introduction || '').trim(),
        /* THE CENTER'S OWN FACE, from the composed read — its picture as a
           served path and how it is cut (founder/409: "their profile pictures
           everywhere… the square and circle orientation"). Set through
           POST /api/center/picture; "" draws initials in the Center's hue. */
        /* ── ITS COVER, WHEN THE COVER IS ITS OWN (founder/559) ───────────
           `identity.cover` has been on every composed answer and this passed
           `banner: ''`, so no Center ever showed one. It is drawn now — but
           only a cover the place can be said to OWN: a file uploaded to
           ONEWAY (`/assets/…`), or an image served from the Center's own
           website. MEASURED: Four Queens carries a Wikimedia Commons photo
           under CC BY 4.0, stored without its attribution and stamped as
           coming from its website; drawn, it would read as the casino's own
           asset. founder/559: "don't imply that a downloaded image is an
           official business asset unless its provenance supports that." */
        banner: ownCover(app.identity || {}), logo: (app.identity && app.identity.picture) || '',
        avatarShape: (app.identity && app.identity.shape) || 'rounded', hue: hue,
        /* ── ITS ADDRESS, AND ITS OWN SITE ────────────────────────────────
           The composed read has carried `identity.handle` and
           `identity.website` all along and the header drew neither: a
           Center's address on this platform ($yourplace — the founder's own
           second shape of a name) appeared nowhere a person could see it,
           and its website lived only in the About table, four taps in. Both
           are the same chips a person's profile already uses; the link is
           scheme-checked there, so a Center gets the rule for free. */
        facts: [],
        /* ══ THE ONE LINK BAR — universal on every Center (442 addendum) ═══
           Its website, its platforms (recognised from the URL, drawn as the
           platform's own mark), then Events and Directions as icons. Nothing
           is drawn when there is nothing. */
        links: (function () {
          if (!OW.links) return null;
          var idn = app.identity || {};
          var raw = [];
          if (idn.website) raw.push({ url: idn.website, label: '' });
          (idn.links || []).forEach(function (l) { raw.push(l); });
          var extra = [];
          if (_upN > 0) {
            extra.push({ key: 'events', name: 'Events', onPress: function () {
              if (host.__owShowTab) host.__owShowTab('today');   /* the Events tab's id */
            } });
          }
          var bar = OW.links.bar(raw, extra);
          /* DIRECTIONS ARRIVE WHEN THE PLACE IS KNOWN — from the Center's
             own point, never a name a maps app has to guess at. iOS and
             Macs get Apple Maps, everyone else Google Maps: the person's own
             navigation with their own saved places. The icon is added only
             when `/where` resolves, so nothing here can be pressed and do
             nothing (founder/442: "clicking take me there does nothing"). */
          whereRead.then(function (r) {
            var w = (r && r.ok && r.data) || {};
            if (!w.resolved) return;
            var pt = (w.point && w.point.lat != null && w.point.lng != null) ? w.point
                   : ((w.lat != null && w.lng != null) ? w : null);
            var dest;
            if (pt) dest = encodeURIComponent(String(pt.lat) + ',' + String(pt.lng));
            else {
              var parts = (w.chain || []).map(function (c) { return c && c.name; }).filter(Boolean);
              if (!parts.length) return;
              dest = encodeURIComponent([head.name].concat(parts).filter(Boolean).join(', '));
            }
            var href = 'https://www.google.com/maps/dir/?api=1&destination=' + dest;
            var add = OW.links.bar([], [{ key: 'directions', name: 'Directions', onPress: function () {
              var apple = /iPad|iPhone|iPod|Macintosh/.test(global.navigator.userAgent || '');
              if (apple) { try { global.location.href = 'maps://?daddr=' + dest; return; } catch (_) {} }
              global.open(href, '_blank', 'noopener');
            } }]);
            if (!add) return;
            var el = add.firstChild;
            var into = host.querySelector('.ow-linkbar');
            if (into) into.appendChild(el);
            else {
              var bio = host.querySelector('.ow-prof__bio, .ow-prof__handle');
              if (bio && bio.parentNode) bio.parentNode.insertBefore(add, bio.nextSibling);
            }
          });
          return bar;
        })(),
        live: live,
        stats: stats, acts: acts, tabs: tabs
      });
      return tabs.length;
    });
  };

  /* 4.4 — DISCOVERY. "Discover should not become endless scrolling. The purpose
     is meaningful discovery." (EXPERIENCE.md) So: a few grouped, reasoned
     suggestions with a hard ceiling — never a river, never a ranked stream.

     THE WHY IS THE SURFACE. A suggestion without a reason is a recommendation
     engine, which this deliberately is not — the runtime returns a `why` on
     every item ("a gallery from Jake") and it LEADS the row rather than sitting
     under it as small print. That reason is also the whole legal and ethical
     position: nothing here is surfaced because it performs well.

     NOTHING HERE ACTS. Discovery exposes possible relationships and never
     creates one — opening is all a row does; the graph changes only on a
     chosen act elsewhere. */
  /* DISCOVERY IS THE ONE SURFACE THAT MUST WORK BEFORE YOU EXIST. Its whole
     job is showing a stranger what is out here, and a door in front of it asks
     someone to commit to a platform they have not been allowed to look at.
     Signed out it reads the PUBLIC catalogue — the same Centers, minus the
     three groups that are relationships ("through people you know" cannot mean
     anything yet), and each one still walks into a real public window. */
  OW.live.readMedia = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var input = doc.createElement('input');
      input.type = 'file';
      input.accept = opts.accept || 'image/*,video/*';
      if (opts.multiple !== false) input.multiple = true;
      input.style.display = 'none';
      doc.body.appendChild(input);
      /* CLOSING THE PICKER IS AN ANSWER TOO. Without this a person who opened
         it and changed their mind left the promise waiting forever, and the
         control that opened it stuck on its busy word. */
      input.addEventListener('cancel', function () {
        input.remove();
        resolve({ items: [], refused: [] });
      });
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.remove();
        if (!files.length) { resolve({ items: [], refused: [] }); return; }
        var items = [], refused = [], left = files.length;
        files.forEach(function (f) {
          var fr = new global.FileReader();
          fr.onerror = function () {
            refused.push({ name: f.name, why: 'could not be read' });
            if (!--left) resolve({ items: items, refused: refused });
          };
          fr.onload = function () {
            var src = String(fr.result || '');
            var isVid = /^data:video\//i.test(src);
            var take = function (out) {
              if (coBytes(out) > CO_MAX_BYTES) {
                refused.push({ name: f.name, why: 'too big — keep it under about '
                  + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB' });
              } else {
                items.push({ src: out, kind: isVid ? 'video' : 'photo', name: f.name });
              }
              if (!--left) resolve({ items: items, refused: refused });
            };
            if (isVid) take(src); else coShrink(src, take);
          };
          fr.readAsDataURL(f);
        });
      });
      input.click();
    });
  };

  /* THE ONE DOOR FOR BYTES. `POST /api/oneway/media` stores a file and answers
     a CONTRACTED media item — its `kind` from the SERVER's sniff of the bytes,
     never our guess — which a Post takes exactly as it is.

     This filed every file into a Gallery first (`/api/galleries/{gid}/upload`,
     making one when none was named). Galleries are retired, not migrated
     (founder, 2026-08-26, kept in api/oneway/manifest.py), and a file no longer
     needs an object to own it before it can exist. */
  OW.live.uploadMedia = function (dataUrl, opts) {
    opts = opts || {};
    return data.post('/api/oneway/media', { data: dataUrl, origin: opts.origin || 'uploaded' })
      .then(function (u) {
        var item = u.ok && (u.data || {}).media;
        if (!item || !item.url) return { ok: false, error: (u.error || 'the file was refused') };
        return { ok: true, item: item };
      });
  };

  /* PICK AND STORE, for a surface that wants the bytes filed immediately.
     Sequential on purpose: a phone uploading eight photos at once competes with
     itself and the failure is a stall nobody can explain. */
  OW.live.pickMedia = function (opts) {
    opts = opts || {};
    return OW.live.readMedia(opts).then(function (res) {
      var out = { stored: [], refused: res.refused.slice() };
      return res.items.reduce(function (chain, it, i) {
        return chain.then(function () {
          if (typeof opts.onProgress === 'function') opts.onProgress(i + 1, res.items.length);
          return OW.live.uploadMedia(it.src).then(function (u) {
            if (u.ok) out.stored.push(u.item);
            else out.refused.push({ name: it.name, why: u.error });
          });
        });
      }, Promise.resolve()).then(function () {
        if (typeof opts.onDone === 'function') opts.onDone(out);
        return out;
      });
    });
  };

  /* ── THE IMAGE-SHRINK UNIT, WHOLE ───────────────────────────────────────
     `CO_MAX_BYTES`, `coBytes` and `coShrink` are one unit: coShrink consults
     both, and every caller of all three is in THIS file. An extraction had
     moved the cap and the shrinker into app/create/create.js while leaving
     coBytes and all eight call sites here — and create.js loads eight scripts
     later, so the references could never resolve. Create opened on
     `coShrink is not defined`. Kept together so the split cannot recur. */
  /* the runtime's own cap is 64MB ("a phone video, not a film"); the base64
     body is ~4/3 of that, so the client refuses earlier and says why rather
     than letting the person wait out an upload that ends in a 413 */
  var CO_MAX_BYTES = 44 * 1024 * 1024;

  /* RESIZE, AND NEVER ONTO A BLACK GROUND. A canvas starts fully transparent
     and JPEG has no alpha, so every transparent pixel of a PNG — a logo, a
     cut-out, a screenshot with rounded corners — encodes as BLACK. A PNG
     already under the cap is passed through UNTOUCHED, which keeps its alpha
     and costs nothing; anything that must be resized is composited onto white
     first. This is the whole reason this function is shared rather than copied. */
  function coShrink(dataUrl, cb) {
    var isPng = /^data:image\/png/i.test(dataUrl);
    if (isPng && coBytes(dataUrl) <= CO_MAX_BYTES) { cb(dataUrl); return; }
    var img = new global.Image();
    img.onload = function () {
      var MAX = 1600;
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) { cb(dataUrl); return; }
      var scale = Math.min(1, MAX / Math.max(w, h));
      var cv = doc.createElement('canvas');
      cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);   /* never a black ground */
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      try { cb(cv.toDataURL('image/jpeg', 0.9)); }
      catch (_) { cb(dataUrl); }        /* tainted canvas — send the original */
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  function coBytes(dataUrl) {
    var i = String(dataUrl || '').indexOf(',');
    return i < 0 ? 0 : Math.floor((dataUrl.length - i - 1) * 3 / 4);
  }

  /* ── THE OTHER TWO HALVES OF THE SAME EXTRACTION ────────────────────────
     `CO_STEPS` and `coKind` were left in app/create/create.js by the same move
     that split the shrink unit above, and they fail the SAME way: the composer
     paints its step rail from CO_STEPS and classifies an imported URL with
     coKind, both from this file, both declared eight scripts later. Fixing
     `coShrink` alone would have moved the crash from "Choose" to the step rail
     — which is why the whole set moved in one pass rather than one name at a
     time. Nothing outside this file reads either one. */
  var CO_STEPS = ['Make', 'Review', 'Describe', 'Where', 'Send'];

  /* WHAT AN IMPORTED URL IS. Extension only, because import takes a LINK and
     there are no bytes to inspect — a Gallery holds references, so this is the
     only signal available at pick time. */
  function coKind(url) {
    return /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i.test(String(url || ''))
      ? 'video' : 'photo';
  }

  function composer(host, opts) {
    opts = opts || {};
    var picks = [];            /* {src, kind, external} — held HERE, not on a server */
    var step = 0;
    var title = '', caption = '';
    var place = '';            /* '' = your profile only */
    var places = [];
    /* the platforms it can also go to, per Center it could belong to, and the
       ones chosen (founder/503) */
    var reachFor = {}, outTo = {};
    var posting = false;       /* on the upload screen (founder/493) */
    var audience = 'everyone'; /* who can see it — the post door's own three */
    var sub = '';              /* the Post screen's own page: where · who · platforms */
    function placeOf(cid) {
      var hit = null;
      places.forEach(function (p) { if (p && p.id === cid) hit = p; });
      return hit;
    }
    function reachOf(cid) {
      if (!cid) return [];
      if (reachFor[cid] === undefined) {
        reachFor[cid] = null;                               /* asked, not answered */
        OW.reach.targets(cid, placeOf(cid)).then(function (ts) {
          reachFor[cid] = ts || [];
          if ((picks.length || (posting && textPost)) && step !== 5) paintStage();
        });
      }
      return reachFor[cid] || [];
    }
    /* ── WHO YOU ARE SENDING IT TO ──────────────────────────────────────
       Founder, 2026-09-07: *"it does feel like Snapchat, and they can
       seamlessly send things to their friends through messages. There's
       basically no friction."*

       A camera app's primary act is SEND TO A PERSON. This surface could
       photograph, film, trim, name and publish — and the only destinations it
       had were your own profile and a Center. There was no way to give the
       thing you just made to somebody. That is not a missing feature of the
       camera; it is the missing half of what a camera is for. */
    var friends = [];          /* [{email, name}] — people you follow */
    var sendTo = [];           /* the ones chosen, by email */
    var stream = null, video = null, rec = null, chunks = [], facing = 'environment';
    /* whether the microphone was actually granted — a silent video is still
       a video, and the person is told rather than left wondering. */
    var hasAudio = true;

    var wrap = mk('div', 'ow-compose');
    var head = mk('div', 'ow-compose__steps');
    var stage = mk('div', 'ow-compose__stage');
    var status = mk('p', 'ow-compose__status');
    var foot = mk('div', 'ow-compose__foot');
    wrap.appendChild(head); wrap.appendChild(stage);
    wrap.appendChild(status); wrap.appendChild(foot);
    host.appendChild(wrap);

    function say(m, bad) {
      status.textContent = m || '';
      status.classList.toggle('is-bad', !!bad);
      /* the status line is behind the camera while the camera is up, so a
         problem is said over it instead */
      if (m && bad && curLens && curLens.frame.isConnected && OW.toast) OW.toast(m);
    }

    /* THE STREAM MUST NOT OUTLIVE THE SURFACE, however a person leaves it. A
       camera light still on after someone walked away is the single most
       damaging thing this surface could do. */
    function stop() {
      /* the lens is closing, whichever way it closed — the screen comes back
         (founder/493). One place, because every exit already runs this. */
      try { doc.documentElement.removeAttribute('data-ow-lens'); } catch (_) {}
      stopStream();
      curLens = null;
    }
    /* LEAVING LIGHTBULB ENDS THE MAKING SCREEN TOO — the shell announces every
       navigation (`ow:navigate`), and a screen that took the viewport must
       give it back, or the dock stays hidden on the next page. */
    function leave() {
      stop();
      screenMode(false);
      doc.removeEventListener('ow:navigate', leave);
    }
    try {
      doc.addEventListener('ow:navigate', leave);
      /* a hidden tab releases the camera and a returning one takes it back —
         the screen stays the camera the whole time (founder/545) */
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) { if (stream) stopStream(); return; }
        if (curLens && curLens.frame.isConnected && !video && !picks.length
            && curLens.frame.getAttribute('data-state') !== 'off'
            && curLens.frame.getAttribute('data-state') !== 'ask') startStream(curLens);
      });
    } catch (_) {}
    /* WHAT YOU MADE IS ITS OWN SCREEN (founder/493: "after attaching and
       editing, they come to an upload screen, not everything on one
       portion"). From the moment something is attached until the receipt,
       the stage takes the viewport the way the lens does — edit, then post,
       then where it went — and the rest of Lightbulb waits behind it. The
       status line comes with it, so a sentence about the post is never said
       behind the screen. */
    function screenMode(on) {
      try {
        if (on) doc.documentElement.setAttribute('data-ow-make', '1');
        else doc.documentElement.removeAttribute('data-ow-make');
      } catch (_) {}
      if (on) stage.appendChild(status);
      else if (status.parentNode !== wrap) wrap.insertBefore(status, foot);
    }

    /* ── the step rail ─────────────────────────────────────────────────── */
    /* THE RAIL APPEARS WHEN THERE IS SOMETHING TO STEP THROUGH.
       Founder: *"everything should have steps to it"* — and also that Create
       should feel like making something rather than filling a form. Five greyed
       steps shown before a person has touched anything served the first and
       broke the second: taking one photo LOOKED like a five-stage process.

       So step 1 is just the camera, and the rail appears the moment there is
       something to arrange — which is exactly when the steps start being true.
       The steps are not removed; they stop being a warning. */
    /* ══ THERE IS NO WALKTHROUGH ═══════════════════════════════════════════
       ★ FOUNDER, 2026-09-07: *"You may feel like a walk through with steps
         that should feel like a tool that people everyday naturally use."*

       This drew "1. Make · 2. Review · 3. Describe · 4. Where · 5. Send" across
       the top and a Next button underneath, and that rail IS the complaint. A
       numbered path tells a person they are COMPLETING A PROCESS. Nothing
       anybody opens forty times a day does that: a camera is a place you are,
       not a form you finish, and no camera on any phone has ever shown a step
       counter.

       The rail was also honest work — it earned its place when Create meant
       assembling a document, and the earlier rulings about steps were about
       that. A photograph is not that, and the founder has now said so twice.

       SO THERE ARE TWO SURFACES AND NO STAGES: the camera, and what you made.
       Everything the middle steps held — a name, a caption, where it goes — is
       still here, sitting ON the second surface as fields you may ignore,
       because none of them was ever a decision that needed its own screen.

       This function stays and renders nothing. Deleting it would mean chasing
       every caller, and a `head` that is empty is what "no rail" IS. */
    function paintSteps() {
      head.innerHTML = '';
      head.style.display = 'none';
    }
    /* A STEP YOU HAVE NOT EARNED IS SHOWN AND DISABLED, NEVER HIDDEN — the
       shape of the path is itself information, and "Arrange" with nothing to
       arrange is a step that can only disappoint. */
    function canReach(i) {
      if (i === 0) return true;
      return picks.length > 0;
    }
    function go(i) {
      if (i > 0) stop();                /* leaving the lens releases it */
      if (i === 0) { posting = false; sub = ''; textPost = false; }   /* back to the camera is back to the start */
      step = i; say('');
      paintSteps(); paintStage(); paintFoot();
    }

    /* ══ LIGHTBULB OPENS AS THE CAMERA ════════════════════════════════════
       ★ FOUNDER/544: *"Get light bulb feeling like the Snapchat camera. Before
         it becomes like the TikTok post page … At first it should feel like a
         fresh place using the user's camera for fresh ideas. And also
         uploading like we discussed."*
       ★ FOUNDER/545: *"no tap to start thats friction i want none"*
       ★ FOUNDER/546: *"maybe on pc with permissions and allat"*

       THE CAMERA IS THE FIRST SCREEN, AND ON A PHONE IT IS SIMPLY ON. This
       overturns the rule that stood here since 2026-08-08 ("a surface that
       opens with a permission dialog has already failed") and the 2026-09-07
       middle ground that opened straight in only when the browser had already
       said yes. The browser's own one-time question is the only thing left
       between a person and their camera; ONEWAY adds nothing to it.

       A COMPUTER IS THE ONE EXCEPTION HE ALLOWED: until the browser has said
       yes, one press turns the camera on. After that a computer opens straight
       in too.

       IT IS A PLACE, NOT A SHEET OVER A PAGE. The dock stays over the picture
       the way Snapchat's does, so a person leaves the camera the way they
       leave anything else. Upload and Import sit beside the shutter
       (founder/493), and under it the three ways of making: the camera, words
       on their own, and the rest of Lightbulb. Whatever cannot run (no
       camera, a refusal) is said in one line on the same screen, with Upload
       and Import still under the thumb. */
    var mode = 'camera';       /* 'camera' | 'write' — the strip under the shutter */
    var lensShut = false;      /* the person chose More: the rest of Lightbulb */
    var textPost = false;      /* words on their own went to the post page */
    var lensGen = 0;           /* a stream that answers after its lens closed is released */
    var curLens = null;

    function isPhone() {
      try { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); }
      catch (_) { return false; }
    }
    function lensOn() {
      try { doc.documentElement.setAttribute('data-ow-lens', '1'); } catch (_) {}
    }
    /* the stream alone — the screen stays. Flip, Write and a hidden tab use
       this; `stop()` is for leaving the camera altogether. */
    function stopStream() {
      lensGen++;
      try { if (rec && rec.state === 'recording') rec.stop(); } catch (_) {}
      rec = null;
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      stream = null;
      if (video) { try { video.pause(); } catch (_) {} if (video.parentNode) video.parentNode.removeChild(video); }
      video = null;
    }

    function paintChoose() {
      stage.innerHTML = '';
      if (lensShut) { drawDoor(); return; }
      if (mode === 'write') { paintWrite(); return; }
      openLens();
    }

    /* THE STRIP UNDER THE SHUTTER — what you are making with it */
    function modeStrip(frame) {
      var strip = mk('div', 'ow-compose__modes');
      [['camera', 'Camera'], ['write', 'Write'], ['more', 'More']].forEach(function (m) {
        var b = mk('button', 'ow-compose__mode', m[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(mode === m[0]));
        if (m[0] === 'more') b.setAttribute('aria-label', 'More of Lightbulb: writing, drafts and everything else you can make');
        b.addEventListener('click', function () {
          if (m[0] === mode) return;
          if (m[0] === 'more') {
            lensShut = true; stop(); stage.innerHTML = ''; drawDoor();
            try { global.scrollTo(0, 0); } catch (_) {}
            return;
          }
          stopStream();
          mode = m[0];
          paintChoose();
        });
        strip.appendChild(b);
      });
      frame.appendChild(strip);
    }

    function lensShell() {
      stage.innerHTML = '';
      var frame = mk('div', 'ow-compose__lens');
      frame.setAttribute('data-state', 'starting');
      var mid = mk('div', 'ow-compose__lensmid');
      frame.appendChild(mid);
      var panel = mk('div', 'ow-compose__lenspanel');
      frame.appendChild(panel);

      var top = mk('div', 'ow-compose__lenstop');
      var flip = mk('button', 'ow-compose__round');
      flip.type = 'button';
      flip.setAttribute('aria-label', 'Switch camera');
      flip.title = 'Switch camera';
      flip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><path d="M9 13.4a3.1 3.1 0 0 1 5.4-1.9M15 13.2a3.1 3.1 0 0 1-5.4 1.9"/><path d="M14.6 9.8v1.9h-1.9M9.4 16.6v-1.9h1.9"/></svg>';
      flip.addEventListener('click', function () {
        facing = (facing === 'environment') ? 'user' : 'environment';
        stopStream(); startStream(L);
      });
      top.appendChild(mk('span', ''));
      top.appendChild(flip);
      frame.appendChild(top);

      var bar = mk('div', 'ow-compose__bar');
      /* ── ONE SHUTTER. TAP IS A PHOTO, HOLD IS A VIDEO. (2026-09-07)
         The press length decides, so nobody has to choose what they are
         making before they can see what they are pointing at. Pointer events
         give one path for a finger, a pen and a mouse; `setPointerCapture`
         ends a video on release even if the finger slid off; `contextmenu` is
         refused because a phone reads a long press as "select this". */
      var HOLD_MS = 320;
      var holdTimer = null, holding = false, recording = false;
      var shot = mk('button', 'ow-compose__shutter');
      shot.type = 'button';
      shot.setAttribute('aria-label', 'Tap for a photo, hold for a video');
      function beginHold(e) {
        if (!video) return;
        if (holding) return;
        holding = true;
        try { shot.setPointerCapture(e.pointerId); } catch (_) {}
        holdTimer = global.setTimeout(function () {
          holdTimer = null;
          recording = true;
          shot.classList.add('is-rec');
          frame.setAttribute('data-rec', '1');
          toggleRec(shot, true);
        }, HOLD_MS);
      }
      function endHold() {
        if (!holding) return;
        holding = false;
        if (holdTimer) { global.clearTimeout(holdTimer); holdTimer = null; snap(); return; }
        if (recording) {
          recording = false;
          shot.classList.remove('is-rec');
          frame.removeAttribute('data-rec');
          toggleRec(shot, false);
        }
      }
      shot.addEventListener('pointerdown', beginHold);
      shot.addEventListener('pointerup', endHold);
      shot.addEventListener('pointercancel', endHold);
      shot.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      /* before the camera is on, the shutter is the way to turn it on (546) */
      shot.addEventListener('click', function () {
        if (!video && frame.getAttribute('data-state') === 'ask') startStream(L);
      });
      shot.addEventListener('keydown', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && video) { e.preventDefault(); snap(); }
      });

      /* Upload and Import beside the shutter (founder/493): a mark and one
         word each, because the row is over a live picture; the title carries
         the rest. */
      var pick = mk('button', 'ow-compose__side');
      pick.type = 'button';
      pick.setAttribute('aria-label', 'Upload photos and videos from this device');
      pick.title = 'Upload photos and videos from this device';
      pick.innerHTML = '<span>' + (OW.glyph ? OW.glyph('share') : '') + '</span><b>Upload</b>';
      pick.addEventListener('click', function () { filePick.click(); });
      var imp = mk('button', 'ow-compose__side');
      imp.type = 'button';
      imp.setAttribute('aria-label', 'Import something you host elsewhere');
      imp.title = 'Import something you host elsewhere';
      imp.innerHTML = '<span>' + (OW.glyph ? OW.glyph('link') : '') + '</span><b>Import</b>';
      imp.addEventListener('click', function () { openImport(panel); });
      bar.appendChild(pick); bar.appendChild(shot); bar.appendChild(imp);
      frame.appendChild(bar);
      modeStrip(frame);
      stage.appendChild(frame);
      lensOn();

      var L = {
        frame: frame,
        panel: panel,
        state: function (s) { frame.setAttribute('data-state', s); shot.disabled = (s === 'off'); },
        /* one line, on the picture, saying why it is dark */
        off: function (words) {
          L.state('off');
          mid.innerHTML = '';
          mid.appendChild(mk('p', 'ow-compose__lensnote', esc(words)));
        },
        /* a computer whose browser has not said yes yet: one press (546) */
        ask: function () {
          L.state('ask');
          mid.innerHTML = '';
          var on = mk('button', 'ow-compose__lenson', 'Turn on camera');
          on.type = 'button';
          on.addEventListener('click', function () { startStream(L); });
          mid.appendChild(on);
        },
        live: function () { L.state('live'); mid.innerHTML = ''; }
      };
      curLens = L;
      return L;
    }

    var CAM_OFF = 'Your browser has the camera off for ONEWAY. Turn it on from the address bar, or upload instead.';
    function startStream(L) {
      var md = global.navigator && global.navigator.mediaDevices;
      if (!md || !md.getUserMedia) { L.off('No camera on this device. Upload or import instead.'); return; }
      var gen = ++lensGen;
      L.state('starting');
      /* AUDIO IS ASKED FOR WITH THE PICTURE, because the shutter does not know
         yet whether this will be a video; a refusal of the microphone still
         leaves a camera and silent video (2026-09-07). */
      md.getUserMedia({ video: { facingMode: facing }, audio: true })
        .catch(function () {
          hasAudio = false;
          return md.getUserMedia({ video: { facingMode: facing }, audio: false });
        })
        .then(function (s) {
          /* THE PERSON MAY HAVE LEFT WHILE THE BROWSER WAS ASKING — a camera
             light on for a screen nobody is looking at is the worst thing this
             surface could do, so a late stream is released at once. */
          if (gen !== lensGen || !L.frame.isConnected) {
            s.getTracks().forEach(function (t) { t.stop(); });
            return;
          }
          stream = s;
          video = doc.createElement('video');
          video.setAttribute('playsinline', '');
          video.muted = true;
          video.srcObject = s;
          if (facing === 'user') video.setAttribute('data-mirror', '1');
          video.play().catch(function () {});
          L.frame.insertBefore(video, L.frame.firstChild);
          L.live();
        })
        .catch(function (e) {
          if (gen !== lensGen || !L.frame.isConnected) return;
          var n = (e && e.name) || '';
          L.off(n === 'NotAllowedError' || n === 'SecurityError' ? CAM_OFF
            : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No camera found. Upload or import instead.'
            : 'The camera did not start. Upload or import instead.');
        });
    }

    function openLens() {
      mode = 'camera';
      var L = lensShell();
      var md = global.navigator && global.navigator.mediaDevices;
      if (!md || !md.getUserMedia) { L.off('No camera on this device. Upload or import instead.'); return; }
      if (isPhone()) { startStream(L); return; }          /* 545: no tap */
      var perms = global.navigator.permissions;
      if (!perms || !perms.query) { L.ask(); return; }
      try {
        perms.query({ name: 'camera' }).then(function (st) {
          if (!L.frame.isConnected || picks.length) return;
          if (st && st.state === 'granted') startStream(L);
          else if (st && st.state === 'denied') L.off(CAM_OFF);
          else L.ask();
        }, function () { if (L.frame.isConnected) L.ask(); });
      } catch (e) { L.ask(); }
    }

    /* WORDS ON THEIR OWN — the camera's third way of making. The screen is
       the person's colour instead of a picture, the words are the thing, and
       Next goes to the same post page a photo goes to. One post type
       (2026-09-07): these are the Post's words, with no media inside it. */
    function paintWrite() {
      stage.innerHTML = '';
      var frame = mk('div', 'ow-compose__lens ow-compose__write');
      frame.setAttribute('data-state', 'write');
      var ta = doc.createElement('textarea');
      ta.className = 'ow-compose__words';
      ta.placeholder = 'Say something';
      ta.setAttribute('aria-label', 'What you want to say');
      ta.maxLength = 5000;
      ta.value = caption;
      var bar = mk('div', 'ow-compose__bar');
      var next = mk('button', 'ow-btn ow-compose__next', 'Next');
      next.type = 'button';
      next.disabled = !caption.trim();
      ta.addEventListener('input', function () { caption = ta.value; next.disabled = !caption.trim(); });
      next.addEventListener('click', function () {
        if (!caption.trim()) return;
        textPost = true; stop(); posting = true; paintStage();
        try { global.scrollTo(0, 0); } catch (_) {}
      });
      bar.appendChild(next);
      frame.appendChild(ta);
      frame.appendChild(bar);
      modeStrip(frame);
      stage.appendChild(frame);
      lensOn();
      if (!isPhone()) { try { ta.focus(); } catch (_) {} }
    }

    /* THE CAMERA, AFTER THE PERSON CHOSE MORE: the rest of Lightbulb is under
       it, and this is the way back in. */
    function drawDoor() {
      var lens = mk('button', 'ow-compose__lensdoor');
      lens.type = 'button';
      lens.setAttribute('aria-label', 'Open the camera');
      lens.innerHTML =
        '<span class="ow-compose__ring"></span>' +
        '<span class="ow-compose__lenslbl">Camera</span>';
      lens.addEventListener('click', function () { lensShut = false; openLens(); });
      stage.appendChild(lens);
      var row = mk('div', 'ow-compose__ways');
      way(row, 'Upload', 'photos and videos, as many as you like',
          function () { filePick.click(); });
      way(row, 'Import a link', 'something you host elsewhere',
          function () { openImport(row); });
      stage.appendChild(row);
    }
    function way(host2, label, why, run) {
      var b = mk('button', 'ow-compose__way');
      b.type = 'button';
      b.innerHTML = '<b>' + esc(label) + '</b><span>' + esc(why) + '</span>';
      b.addEventListener('click', run);
      host2.appendChild(b);
      return b;
    }

    /* IMPORT IS THE SAME `/media` CALL. A Gallery holds references, so an
       external URL is the primitive rather than a special case — no fetch, no
       proxy, no second store. Over the camera it opens on the picture, above
       the shutter; its message is said in the box, because the status line
       is behind the camera. */
    function openImport(seat) {
      var had = seat.querySelector('.ow-compose__imp');
      if (had) { had.remove(); return; }
      var box = mk('div', 'ow-compose__imp');
      var fld = mk('div', 'ow-fld');
      var input = doc.createElement('input');
      input.type = 'url';
      input.placeholder = 'https://…';
      input.setAttribute('aria-label', 'Link to import');
      fld.appendChild(input);
      var add = mk('button', 'ow-btn', 'Add it');
      add.type = 'button';
      var note = mk('p', 'ow-compose__impnote', '');
      add.addEventListener('click', function () {
        var u = input.value.trim();
        if (!u) return;
        if (!/^https?:\/\//i.test(u)) { note.textContent = 'That needs to be a http or https link.'; return; }
        picks.push({ src: u, kind: coKind(u), external: true });
        box.remove();
        say('');
        go(1);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); add.click(); }
        if (e.key === 'Escape') box.remove();
      });
      box.appendChild(fld); box.appendChild(add); box.appendChild(note);
      seat.appendChild(box);
      input.focus();
    }

    function snap() {
      if (!video) return;
      var w = video.videoWidth || 1280, h = video.videoHeight || 720;
      var cv = doc.createElement('canvas');
      cv.width = w; cv.height = h;
      var cx = cv.getContext('2d');
      /* the front camera is shown as a mirror, and the photo is what was seen */
      if (facing === 'user') { cx.translate(w, 0); cx.scale(-1, 1); }
      cx.drawImage(video, 0, 0, w, h);
      /* JPEG — a phone frame as PNG is several megabytes for no gain */
      /* ── WHERE IT CAME FROM IS DECIDED HERE AND NOWHERE ELSE ──────────
         ★ B, 2026-09-07: origin is `captured | created | uploaded | imported`
           and is *"declared by the client, never inferred — only you know
           whether the camera or the picker produced a file."* True: by the
           time bytes reach the server a shutter and a file chooser are
           identical, and the founder's *"people should be able to distinct
           uploading pictures, videos"* is a fact about each ITEM, not about
           the Post — one Post can carry a photograph you took beside one you
           picked, and both are the same type of post. */
      picks.push({ src: cv.toDataURL('image/jpeg', 0.9), kind: 'photo',
                   origin: 'captured' });
      stop();
      go(1);                              /* straight to Arrange, never away */
    }

    /* `want` is EXPLICIT — true starts, false stops — because the shutter now
       drives this from a gesture rather than from alternating taps. A hold
       that ends before the recorder finished starting would otherwise toggle
       it ON at the moment the finger came up, and leave the camera recording
       with nobody holding anything. Omitted, it still behaves as the toggle it
       was, so any other caller is unaffected. */
    function toggleRec(btn, want) {
      if (!global.MediaRecorder) {
        say('This browser cannot record video — you can film with your camera '
            + 'app and upload it instead.', 1);
        return;
      }
      var on = !!(rec && rec.state === 'recording');
      if (want === undefined) want = !on;
      if (want === on) return;
      if (!want) { try { rec.stop(); } catch (_) {} return; }
      chunks = [];
      var mime = '';
      ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].some(function (m) {
        if (global.MediaRecorder.isTypeSupported
            && global.MediaRecorder.isTypeSupported(m)) { mime = m; return true; }
        return false;
      });
      try { rec = new global.MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (_) { say('This browser refused to record.', 1); return; }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new global.Blob(chunks, { type: mime || 'video/webm' });
        var fr = new global.FileReader();
        fr.onload = function () {
          var src = String(fr.result || '');
          if (coBytes(src) > CO_MAX_BYTES) {
            say('That clip is too big to send — keep it under about '
                + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB.', 1);
            return;
          }
          picks.push({ src: src, kind: 'video', origin: 'captured' });
          stop();
          go(1);
          /* SAID ONCE, AT THE MOMENT IT MATTERS. A person who declined the
             microphone gets a video with no sound, and finding that out on
             playback — after sending it — is worse than being told here. */
          if (!hasAudio) say('That was recorded without sound: the microphone '
                             + 'is off for ONEWAY.', 1);
        };
        fr.onerror = function () { say('That recording could not be read.', 1); };
        fr.readAsDataURL(blob);
      };
      rec.start();
      btn.classList.add('is-on');
      say('');
    }

    /* UPLOAD. Multiple, photos AND videos, feeding the same picks list — one
       pipeline, never a second one. */
    var filePick = doc.createElement('input');
    filePick.type = 'file';
    filePick.accept = 'image/*,video/*';
    filePick.multiple = true;
    filePick.style.display = 'none';
    filePick.addEventListener('change', function () {
      var files = Array.prototype.slice.call(filePick.files || []);
      filePick.value = '';                /* so the same file can be picked twice */
      if (!files.length) return;
      say('Reading ' + files.length + (files.length === 1 ? ' file…' : ' files…'));
      var left = files.length;
      files.forEach(function (f) {
        var fr = new global.FileReader();
        fr.onerror = function () { if (!--left) go(1); };
        fr.onload = function () {
          var src = String(fr.result || '');
          var isVid = /^data:video\//i.test(src);
          var done = function (out) {
            if (coBytes(out) > CO_MAX_BYTES) {
              say('"' + (f.name || 'that file') + '" is too big to send — keep it '
                  + 'under about ' + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB.', 1);
            } else {
              picks.push({ src: out, kind: isVid ? 'video' : 'photo',
                           origin: 'uploaded' });
            }
            if (!--left) go(1);
          };
          /* a modern phone photo blows through the cap, so it is re-encoded
             on the same canvas the camera path uses. Video is passed through:
             re-encoding it in a browser is not something to do quietly. */
          if (isVid) done(src); else shrink(src, done);
        };
        fr.readAsDataURL(f);
      });
    });
    wrap.appendChild(filePick);

    /* TRANSPARENCY BECOMES BLACK IF YOU LET IT, AND THAT IS THE BLACK BOX
       ARRIVING BY A THIRD ROUTE. A canvas starts fully transparent and JPEG
       has no alpha channel, so every transparent pixel of a PNG — a logo, a
       screenshot with rounded corners, a sticker, anything cut out — encodes
       as BLACK. Caught on screen: a transparent test PNG rendered as a solid
       black square in the Arrange grid.

       Two answers, in order. A PNG already under the cap is passed through
       UNTOUCHED, which keeps its alpha and costs nothing — re-encoding a file
       that does not need it only ever loses something. Anything that must be
       resized is composited onto WHITE first, so flattening produces the
       colour a person expects rather than the one the format defaults to. */
    /* `shrink` lives at module scope now (see coShrink) so the composer and
       any operator-side intake share ONE implementation — the transparency fix
       must not exist twice. */
    var shrink = coShrink;

    /* ── WHAT YOU MADE, and what you do with it ───────────────────────── */
    function paintArrange() {
      stage.innerHTML = '';
      if (!picks.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'Nothing chosen yet. Go back and take, film, upload or import something.'));
        return;
      }
      /* THE THING FIRST, THEN WHAT TO DO WITH IT. The acts were rendered
         ABOVE the photograph — a person looked at two buttons before they
         looked at what they had taken, which is the ordering of a form rather
         than of a camera. Nothing anybody uses every day asks you to decide
         before it shows you.

         AND THE INSTRUCTIONAL LINE IS GONE with one thing. "One thing, ready.
         The first is what people see first." is a sentence teaching a rule
         about ORDER, and there is no order to teach until there are two. */
      if (picks.length > 1) {
        stage.appendChild(mk('p', 'ow-compose__why',
          picks.length + ' things. The first is what people see first.'));
      }
      var grid = mk('div', 'ow-compose__picks');
      grid.setAttribute('data-n', String(picks.length));
      picks.forEach(function (p, i) {
        var cell = mk('div', 'ow-compose__pick');
        if (p.kind === 'video') {
          var v = doc.createElement('video');
          v.src = p.src; v.muted = true; v.setAttribute('playsinline', '');
          v.preload = 'metadata';
          cell.appendChild(v);
          cell.appendChild(mk('span', 'ow-compose__tag', 'Video'));
          /* TRIM — the one edit almost every clip needs. Lightbulb could film
             and upload video and could not cut a second off either end, which
             is the difference between a camera and something you'd post from. */
          var trimBtn = mk('button', 'ow-compose__trim', 'Trim');
          trimBtn.type = 'button';
          trimBtn.setAttribute('aria-label', 'Trim video ' + (i + 1));
          trimBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openTrim(p, i);
          });
          cell.appendChild(trimBtn);
        } else {
          var im = doc.createElement('img');
          im.src = p.src; im.alt = '';
          cell.appendChild(im);
          if (p.external) cell.appendChild(mk('span', 'ow-compose__tag', 'Link'));
        }
        var rm = mk('button', 'ow-compose__rm', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove item ' + (i + 1));
        rm.addEventListener('click', function () { picks.splice(i, 1); go(1); });
        cell.appendChild(rm);
        grid.appendChild(cell);
      });
      stage.appendChild(grid);
      var more = mk('button', 'po-act', 'Add more');
      more.type = 'button';
      more.addEventListener('click', function () { go(0); });
      stage.appendChild(more);
    }


    /* ═══ TRIM — REAL, NOT A REMEMBERED IN/OUT POINT ═══════════════════════
       The tempting version stores `in`/`out` on the media row and lets players
       honour it. That is a WRITE NOBODY READS: the feed's cover, the immersive
       player, the gallery viewer and every future reader would each have to
       learn the convention, and until all of them did, a "trimmed" clip would
       play full-length everywhere it mattered. This codebase has a name for
       that defect and has been bitten by it three times.

       So the trim PRODUCES A REAL, SHORTER FILE — captureStream() off a
       <video> into MediaRecorder — and the rest of the platform needs to know
       nothing. It costs the clip's own duration in real time, which is honest
       and is why the button says so rather than pretending to be instant.

       DEGRADES RATHER THAN LIES: a browser without captureStream or
       MediaRecorder is told plainly that it cannot trim here, and the original
       is kept untouched. */
    function openTrim(p, idx) {
      var wrap = mk('div', 'ow-trim');
      var v = doc.createElement('video');
      v.src = p.src; v.setAttribute('playsinline', ''); v.preload = 'metadata';
      v.muted = true; v.className = 'ow-trim__v';
      wrap.appendChild(v);

      var read = mk('p', 'ow-compose__why', 'Reading the clip…');
      wrap.appendChild(read);
      var row = mk('div', 'ow-trim__row');
      var inR = doc.createElement('input'); inR.type = 'range'; inR.min = 0; inR.step = 0.05;
      var outR = doc.createElement('input'); outR.type = 'range'; outR.min = 0; outR.step = 0.05;
      inR.setAttribute('aria-label', 'Start'); outR.setAttribute('aria-label', 'End');
      row.appendChild(inR); row.appendChild(outR);

      var acts = mk('div', 'po-acts');
      acts.style.setProperty('--h', 'var(--ow-h1)');
      acts.style.setProperty('--h2', 'var(--ow-h2)');
      var keep = mk('button', 'ow-btn', 'Trim it');
      keep.type = 'button'; keep.disabled = true;
      var cancel = mk('button', 'po-act', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { go(1); });
      acts.appendChild(keep); acts.appendChild(cancel);

      var note = mk('p', 'ow-compose__status');

      v.addEventListener('loadedmetadata', function () {
        var dur = v.duration;
        /* A CLIP OF UNKNOWN LENGTH CANNOT BE TRIMMED HONESTLY. Some recordings
           report Infinity until they are fully seeked; saying so beats showing
           a slider that means nothing. */
        if (!isFinite(dur) || dur <= 0) {
          read.textContent = 'This clip does not report its length, so it cannot be trimmed here.';
          return;
        }
        inR.max = outR.max = dur;
        inR.value = 0; outR.value = dur;
        keep.disabled = false;
        function say() {
          var a = Math.min(+inR.value, +outR.value), b = Math.max(+inR.value, +outR.value);
          read.textContent = 'Keeping ' + (b - a).toFixed(1) + 's of ' + dur.toFixed(1) + 's'
                           + ' — from ' + a.toFixed(1) + 's to ' + b.toFixed(1) + 's.';
          v.currentTime = a;
        }
        inR.addEventListener('input', say);
        outR.addEventListener('input', say);
        say();
      });
      v.addEventListener('error', function () {
        read.textContent = 'That clip could not be opened.';
      });

      keep.addEventListener('click', function () {
        var a = Math.min(+inR.value, +outR.value), b = Math.max(+inR.value, +outR.value);
        if (b - a < 0.2) { note.textContent = 'That is too short to keep.'; return; }
        keep.disabled = true;
        trimVideo(v, a, b, note, function (blob) {
          if (!blob) { keep.disabled = false; return; }
          var fr = new global.FileReader();
          fr.onload = function () {
            picks[idx] = { src: String(fr.result || ''), kind: 'video' };
            go(1);
          };
          fr.onerror = function () { note.textContent = 'The trimmed clip could not be read.'; keep.disabled = false; };
          fr.readAsDataURL(blob);
        });
      });

      wrap.appendChild(row); wrap.appendChild(acts); wrap.appendChild(note);
      stage.innerHTML = '';
      stage.appendChild(wrap);
    }

    /* RE-RECORD THE KEPT RANGE. `captureStream` gives the element's own output,
       so this is a straight copy of what plays — no canvas, no per-frame draw,
       and the audio track comes with it. It runs in REAL TIME because that is
       what the media element does; the note says so while it works, because a
       silent ten-second wait reads as a hang. */
    function trimVideo(srcVideo, a, b, note, done) {
      if (!srcVideo.captureStream && !srcVideo.mozCaptureStream) {
        note.textContent = 'This browser cannot trim video — the clip is unchanged.';
        return done(null);
      }
      if (!global.MediaRecorder) {
        note.textContent = 'This browser cannot record — the clip is unchanged.';
        return done(null);
      }
      var stream;
      try {
        stream = srcVideo.captureStream ? srcVideo.captureStream() : srcVideo.mozCaptureStream();
      } catch (_) {
        note.textContent = 'This clip cannot be trimmed here — it is unchanged.';
        return done(null);
      }
      var mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(function (m) {
        return global.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m);
      })[0];
      var rec2;
      try { rec2 = new global.MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (_) { note.textContent = 'This browser refused to trim.'; return done(null); }

      var chunks2 = [];
      rec2.ondataavailable = function (e) { if (e.data && e.data.size) chunks2.push(e.data); };
      rec2.onstop = function () {
        srcVideo.muted = true;
        note.textContent = '';
        done(new global.Blob(chunks2, { type: mime || 'video/webm' }));
      };

      var stopAt = function () {
        if (srcVideo.currentTime >= b - 0.03) {
          srcVideo.removeEventListener('timeupdate', stopAt);
          try { srcVideo.pause(); } catch (_) {}
          try { rec2.stop(); } catch (_) {}
        }
      };
      srcVideo.currentTime = a;
      srcVideo.muted = false;          /* the audio has to be flowing to be captured */
      srcVideo.addEventListener('timeupdate', stopAt);
      note.textContent = 'Trimming — this takes about ' + (b - a).toFixed(1) + 's, the length you kept.';
      rec2.start();
      srcVideo.play().catch(function () {
        note.textContent = 'The clip would not play, so it could not be trimmed.';
        try { rec2.stop(); } catch (_) {}
        done(null);
      });
      /* A HARD CEILING, because `timeupdate` stops firing if a tab is
         backgrounded and the recorder would otherwise run forever. */
      setTimeout(function () {
        if (rec2.state === 'recording') { try { srcVideo.pause(); rec2.stop(); } catch (_) {} }
      }, Math.ceil((b - a) * 1000) + 2500);
    }

    /* ══ SEND IT TO SOMEBODY. THE WHOLE POINT OF A CAMERA. ═════════════════
       ★ FOUNDER, 2026-09-07: *"they can seamlessly send things to their friends
         through messages. There's basically no friction or anything like that."*

       IT DID NOT EXIST. Step 4 "Where" offered exactly two destinations —
       your profile, and a place you belong to — and the composer had never
       called `/api/oneway/sharing/to-conversation` even though the Post page
       had used it for weeks. A finished backend with no producer, on the one
       act a camera app is for.

       IT SITS AT REVIEW, not at the end. Snapchat is shutter, person, sent;
       everything after this step — a name, a caption, a destination — is for
       something you are PUBLISHING, and a person sending one photograph to one
       friend should never walk past it.

       ── WHAT "PRIVATE" MEANS HERE, EXACTLY ────────────────────────────────
       The Post is created as a DRAFT. A draft is in no feed and — since the
       fix in the same change as this — on no profile. The share reference is
       what GRANTS SIGHT of it, so it reaches the people it was sent to and
       nobody else. Proven end to end: the recipient's thread resolves it with
       its media while the author's own profile does not list it.

       That also answers the founder's other sentence in one object. It is a
       Post, `contracts.NATIVE`, carrying image AND video items together — not
       a photo-thing and a video-thing, and never a reel. */
    var sentPost = '';          /* the draft, once made — sent again, not remade */

    function sendRow(host2) {
      var wrap = mk('div', 'ow-compose__send');

      /* ── POST IT, FROM HERE, IN ONE TAP ──────────────────────────────────
         ★ FOUNDER, 2026-09-07: *"There's basically no friction or anything
           like that."*

         Posting a photograph cost FOUR presses from this step — Next, Next,
         Next, Share — through a name you do not have to give, a caption you
         may not want and a destination that is already correct. Every one of
         those steps is worth keeping for the thing that needs it: twenty
         photographs from a night, a name somebody will search for later, a
         community to light it to. None of them is worth making a person walk
         through to post one picture.

         So the common case is one press and the steps are still there for the
         uncommon one. `share()` already handles an empty title and no place —
         it posts to the person's own Centre, which is where it was going
         anyway, and the summary at step 5 exists to CONFIRM that rather than
         to decide it.

         IT SITS BESIDE "SEND TO A FRIEND" because those are the two things a
         person does with what they just made, and they are the same size. */
      /* ★ FOUNDER/493 (2026-09-22) OVERRULES THE ONE-TAP POST ABOVE: *"The
         process should be like tiktok … where after attaching and editing,
         they come to an upload screen, not everything on one portion."* So
         the edit screen's act is Next, and posting happens on its own screen
         — the caption, where it goes, the other platforms, and one Post. */
      var post = mk('button', 'ow-btn ow-compose__postbtn', 'Next');
      post.type = 'button';
      post.addEventListener('click', function () {
        posting = true; paintStage();
        try { global.scrollTo(0, 0); } catch (_) {}
      });

      var btn = mk('button', 'ow-btn ow-compose__sendbtn', 'Send to a friend');
      btn.type = 'button';
      var panel = mk('div', 'ow-sendto');
      var row = mk('div', 'ow-compose__twoacts');
      row.appendChild(post); row.appendChild(btn);
      wrap.appendChild(row); wrap.appendChild(panel);
      host2.appendChild(wrap);

      btn.addEventListener('click', function () {
        if (panel.firstChild) { panel.innerHTML = ''; return; }
        if (!OW.sendTo) {
          panel.appendChild(mk('p', 'po-acts__wait',
            'Sending is not available just now.'));
          return;
        }
        btn.disabled = true;
        panel.innerHTML = '';
        panel.appendChild(mk('span', 'po-acts__wait', 'Getting it ready…'));
        makePrivatePost().then(function (id) {
          btn.disabled = false;
          if (!id) {
            panel.innerHTML = '';
            panel.appendChild(mk('p', 'ow-sendto__failed',
              'That could not be prepared to send. Nothing has been shared.'));
            return;
          }
          OW.sendTo(panel, {
            subject_type: 'post', subject_id: id, peopleOnly: true,
            onSent: function (d) {
              /* THE CONFIRMATION OUTLIVES THE LIST. My first version replaced
                 the panel with "Sent to X" and then re-rendered the people over
                 the top of it — so a person tapped, and a second and a half
                 later there was no evidence anything had happened. Caught in
                 the browser: the panel came back looking exactly as it had
                 before the tap.

                 So the receipt is its own line ABOVE the list and it stays.
                 Sending one photograph to three people is the common case, not
                 an edge one, and `sentPost` is kept so the second send costs
                 one tap and never remakes the Post. */
              var done = wrap.querySelector('.ow-sendto__ok');
              if (!done) {
                done = mk('p', 'ow-sendto__ok', '');
                wrap.insertBefore(done, panel);
              }
              var was = (done.getAttribute('data-to') || '').split('\u0000')
                          .filter(Boolean);
              if (was.indexOf(d.label || 'them') < 0) was.push(d.label || 'them');
              done.setAttribute('data-to', was.join('\u0000'));
              done.textContent = 'Sent to ' + was.join(', ') + '.';
              OW.sendTo(panel, { subject_type: 'post', subject_id: id,
                                 peopleOnly: true });
            }
          });
        });
      });
    }

    /* ONE DRAFT POST CARRYING EVERYTHING PICKED. The uploads go through the
       same `/upload` the publish path uses, so bytes are stored once, the same
       way, whichever button a person pressed. */
    function makePrivatePost() {
      if (sentPost) return Promise.resolve(sentPost);
      var home = (data.meHome && data.meHome()) || '';
      if (!home) {
        return Promise.resolve('');   /* no Place of their own — say so, do not guess */
      }
      var uploaded = [];
      return picks.reduce(function (chain, p) {
        return chain.then(function () {
          /* ORIGIN TRAVELS WITH A SENT THING TOO. It was omitted here and the
             recipient's copy came back with `origin: ""` — measured — so a
             photograph you TOOK arrived indistinguishable from one you picked.
             The founder's distinction is a fact about the item and it must
             survive the send, not only the post. */
          if (p.external) {
            uploaded.push({ url: p.src, kind: p.kind, origin: 'imported' });
            return;
          }
          /* THE SAME DOOR AS `share()`. Two upload paths in one file is how
             the origin came to be set in one of them and not the other — the
             defect fixed an hour ago. One door cannot have that bug. */
          return data.post('/api/oneway/media',
                           { data: p.src, origin: p.origin || 'uploaded' })
            .then(function (u) {
              if (!u.ok) throw new Error(u.error || 'that file was refused');
              var item = (u.data || {}).media;
              if (!item || !item.url) throw new Error('that file was refused');
              uploaded.push(item);
            });
        });
      }, Promise.resolve()).then(function () {
        return data.post('/api/oneway/social/posts', {
          center_id: home,
          body: caption.trim() || title.trim() || '',
          title: title.trim(),
          media: uploaded,
          /* BORN UNPUBLISHED. Not a euphemism: `contracts.VISIBLE_STATES` is
             (PUBLISHED,), so this is in no feed and on no profile, and the
             share reference is the only thing that shows it to anybody. */
          state: 'draft'
        });
      }).then(function (r) {
        var id = ((r.data || {}).post || {}).id || (r.data || {}).id || '';
        if (!r.ok || !id) throw new Error('it could not be prepared');
        sentPost = id;
        return id;
      }).catch(function () { return ''; });
    }

    /* ── step 3 · DESCRIBE ─────────────────────────────────────────────── */
    /* ── WORDS, IF YOU WANT THEM ─────────────────────────────────────────
       This was a STAGE with a Next button and, before that, a required name.
       It is two optional fields now, sitting under what they describe. Nothing
       waits on them and nothing is disabled by them.

       COLLAPSED BY DEFAULT, because the common case is a photograph with
       nothing to say and a shut field is quieter than an open one — but ONE
       TAP away and labelled with what it is for, never a bare "..." . */
    function paintDescribe() {
      stage.innerHTML = '';
      /* ── A PHOTO DOES NOT NEED A NAME ────────────────────────────────────
         ★ FOUNDER, 2026-09-07: *"There's basically no friction or anything
           like that."*

         Next was DISABLED here until a title was typed, with "A name first."
         under it. That is a form standing between a person and the thing they
         just photographed — and nothing a camera app competes with has ever
         asked for one. Snapchat does not. Instagram does not.

         The field stays, because a name is genuinely useful on the things that
         want one — a set of twenty photographs from a night, a gallery
         somebody will look for again. It is simply no longer a toll.

         `share()` already handles an empty title: the summary reads "Untitled"
         and publish sets the cover from the first item, so a nameless Post is
         a Post with a picture and no heading, not a broken one. */
      stage.appendChild(mk('p', 'ow-compose__why',
        'Both optional. A name helps people find this again later.'));
      var tf = mk('div', 'ow-fld');
      var ti = doc.createElement('input');
      ti.type = 'text';
      ti.placeholder = 'Name it (optional)';
      ti.setAttribute('aria-label', 'Name');
      ti.value = title;
      ti.addEventListener('input', function () { title = ti.value; paintFoot(); });
      tf.appendChild(ti);
      var cf = mk('div', 'ow-fld');
      var ca = doc.createElement('textarea');
      ca.rows = 3;
      ca.placeholder = 'Say something about it';
      ca.setAttribute('aria-label', 'Caption');
      ca.value = caption;
      ca.addEventListener('input', function () { caption = ca.value; });
      cf.appendChild(ca);
      stage.appendChild(tf); stage.appendChild(cf);
      ti.focus();
    }

    /* ── step 4 · WHERE ────────────────────────────────────────────────── */
    /* THE DESTINATION IS STATED, ALWAYS. "Your profile" is not a euphemism: a
       person's Gallery is owned by their Profile Center, and publishing it is
       what puts it on their profile and into the feeds of people who follow
       them — measured, not assumed (a follower's `/api/me/feed/galleries` goes
       from 0 rows to 1 the moment publish is called, and 0 before it).
       A place is ADDITIONAL: it also lights a post to a community they belong
       to, which is the act `light_to` has always existed for. */
    /* WHERE IT GOES is now the Post screen's own row and page (founder/510,
       paintPost / paintPostSub); the inline chip row that stood here is gone. */

    function paintWhere() {
      stage.innerHTML = '';
      stage.appendChild(mk('p', 'ow-compose__why',
        'This goes to your profile, where anyone who follows you will see it. '
        + 'You can also send it to a place you are part of.'));
      var chips = mk('div', 'po-acts');
      chips.style.setProperty('--h', 'var(--ow-h1)');
      chips.style.setProperty('--h2', 'var(--ow-h2)');

      var mine = mk('button', 'po-act po-act--primary', 'Your profile');
      mine.type = 'button';
      mine.disabled = true;               /* always true, never a choice to undo */
      mine.setAttribute('aria-pressed', 'true');
      chips.appendChild(mine);

      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;
        var b = mk('button', 'po-act', esc(p.name));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(place === p.id));
        b.classList.toggle('po-act--primary', place === p.id);
        b.addEventListener('click', function () {
          place = (place === p.id) ? '' : p.id;
          paintWhere(); paintFoot();
        });
        chips.appendChild(b);
      });
      stage.appendChild(chips);
      if (!places.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'You have not joined anywhere yet, so your profile is the only '
          + 'destination. Joining somewhere adds more.'));
      }

      /* ── AND SEND IT TO SOMEBODY ────────────────────────────────────────
         The act a camera is actually for. Multi-select, because nobody sends
         one photo to exactly one person, and pressed state is the whole UI —
         no submenu, no second screen, no modal. It sits in the destination
         step beside the places rather than behind anything, because the
         founder's word was "seamless" and a send that costs a navigation is
         not.

         IT IS ADDITIVE, NOT A REPLACEMENT. What you make still goes to your
         profile; choosing people ALSO puts it in their messages. Whether a
         person can send privately WITHOUT posting is a real product question
         and a bigger one than this change — "Your profile" is deliberately
         `disabled` above with the note "always true, never a choice to undo" —
         so it is raised rather than decided here. */
      stage.appendChild(mk('h3', 'ow-compose__to', 'Send it to'));
      if (friendsOk === false) {
        /* BLIND IS NOT EMPTY. Saying "you follow nobody" when the read failed
           is the more expensive of the two lies: it is a false statement about
           a person's life, and they cannot tell it from the truth. */
        stage.appendChild(mk('p', 'ow-compose__why',
          'Your people could not be loaded just now, so there is nobody to '
          + 'choose here. Nothing else about this is affected.'));
      } else if (friendsOk === null) {
        stage.appendChild(mk('p', 'ow-compose__why', 'Finding your people…'));
      } else if (!friends.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'You are not following anyone yet. Follow someone and you can send '
          + 'them what you make.'));
      } else {
        var who = mk('div', 'po-acts');
        who.style.setProperty('--h', 'var(--ow-h1)');
        who.style.setProperty('--h2', 'var(--ow-h2)');
        friends.forEach(function (f) {
          var on = sendTo.indexOf(f.who) >= 0;
          var b = mk('button', 'po-act', esc(f.name));
          b.type = 'button';
          b.setAttribute('aria-pressed', String(on));
          b.classList.toggle('po-act--primary', on);
          b.addEventListener('click', function () {
            var i = sendTo.indexOf(f.who);
            if (i >= 0) sendTo.splice(i, 1); else sendTo.push(f.who);
            paintWhere(); paintFoot();
          });
          who.appendChild(b);
        });
        stage.appendChild(who);
      }
    }

    /* ── THE SEND ────────────────────────────────────────────────────────
       ONE AT A TIME, AND ONE FAILURE NEVER KILLS THE REST. Sending to four
       people is four independent acts; a reduce over a promise chain keeps
       them ordered and keeps each one's outcome, so the person is told exactly
       who got it rather than "it did not send".

       THROUGH THE CANONICAL PAIR, NOT THE OBVIOUS ONE. `POST /api/conversations`
       has the better name and writes a conversation that APPEARS IN NOBODY'S
       MESSAGES LIST: measured 2026-09-07, it writes the participants row and
       not `oneway_person_conversations`, which is what the list reads. It also
       drops `kind:"direct"` to "group", so opening a line to the same person
       twice mints two threads. `/api/oneway/messaging/conversations` writes the
       index, reuses the one thread per pair, and is the domain that owns the
       list — so it is the one a camera sends through.

       HELD IS NOT SENT AND IT IS NOT REFUSED. A first message to somebody who
       does not know you waits for them to accept it. The runtime says so
       (`held:true` with a reason) and this repeats it, because telling a person
       "sent" when it is sitting in a request queue is a lie they will only
       discover from the silence. */
    function sendToPeople(gid, made) {
      if (!sendTo.length) return Promise.resolve([]);
      var nameOf = {};
      friends.forEach(function (f) { nameOf[f.who] = f.name; });
      return sendTo.reduce(function (chain, em) {
        return chain.then(function (acc) {
          var nm = nameOf[em] || em;
          say('Sending to ' + nm + '…');
          return data.post('/api/oneway/messaging/conversations',
                           { with_people: [em] })
            .then(function (r) {
              if (!r.ok) throw new Error(r.error || 'a line could not be opened');
              var d = r.data || {};
              if (d.held) return { to: nm, held: true };
              var cid = (d.conversation || {}).id;
              if (!cid) throw new Error('a line could not be opened');
              return data.post('/api/oneway/messaging/conversations/'
                               + cid + '/messages', {
                body: caption.trim() || title.trim() || 'Sent you something',
                /* ── THE MEDIA ITSELF, NOT A LINK TO IT ──────────────────
                   `attachments` is the field, and the runtime contracts it
                   through the SAME function a Post's media goes through
                   (`service._contracted` -> `_sc.media`). So a thing sent to a
                   person and a thing posted to a feed are one media shape,
                   which is the founder's rule that everything uploaded is one
                   type of post, holding at the message layer too.

                   ★ I FIRST SENT `object_ref` AND IT VANISHED. The send
                   returned 200 with a message id, the body arrived, and the
                   reference was NULL when the recipient read it — FastAPI
                   ignores a field the model does not declare and still answers
                   200, which `tools/contracts.py` warns about in its own
                   output. A camera app would have been sending friends the
                   sentence "look at this" with nothing attached, and the
                   sender would have been told it sent. Only reading it back as
                   the RECIPIENT found it. */
                attachments: made || []
              }).then(function (m) {
                if (!m.ok) throw new Error(m.error || 'it did not send');
                return { to: nm, sent: true };
              });
            })
            .catch(function (e) {
              return { to: nm, failed: (e && e.message) || 'it did not send' };
            })
            .then(function (one) { acc.push(one); return acc; });
        });
      }, Promise.resolve([]));
    }

    /* ── step 5 · SHARE ────────────────────────────────────────────────── */
    function paintShare() {
      stage.innerHTML = '';
      var name = title.trim() || 'Untitled';
      var to = 'your profile';
      places.forEach(function (p) { if (p.id === place) to = 'your profile and ' + p.name; });
      var sum = mk('div', 'ow-compose__sum');
      sum.innerHTML =
        '<p><b>' + esc(name) + '</b></p>'
        + '<p>' + esc(picks.length + (picks.length === 1 ? ' item' : ' items'))
        + ' &middot; going to ' + esc(to) + '</p>'
        + '<p class="ow-compose__why">Nothing has been shared yet. Until you tap '
        + 'Share this is private to you.</p>';
      stage.appendChild(sum);
    }

    /* THE ONE ACT. Four calls that already exist, in the order the runtime
       documents them: upload the bytes · attach the reference · set what the
       person wrote and the visibility they chose · publish. Publishing sets
       the cover from the first item, which is why a shared Gallery always has
       a picture on it and can never be the black box. */
    function share(btn) {
      btn.disabled = true;
      var made = [];        /* what actually got uploaded, in Post media shape */

      /* ══ ONE ACT MAKES ONE OBJECT ══════════════════════════════════════
         ★ FOUNDER, 2026-09-07: *"People should be able to distinct uploading
           pictures, videos, etcetera, but it should all be uploaded under ONE
           TYPE OF POST. There should be no posts on reels, like, on
           Instagram."*

         THIS MADE THREE OBJECTS OUT OF ONE ACT, and each destination got a
         different one:

             your profile   a GALLERY, created private, filled, made public,
                            published — four calls to the object model this
                            repo has already retired
             a place        a POST carrying the caption and NO MEDIA AT ALL,
                            so a community you lit it to received words and no
                            photograph
             a friend       the media COPIED into a message

         One photograph, three shapes, and only the third could be looked at
         where it landed. That is not a stray inconsistency — it is the exact
         thing the founder's sentence forbids, sitting in the primary write
         path of the App, and it is why the same picture had a like count on
         one surface and none on another.

         NOW IT IS ONE CANONICAL POST. `contracts.NATIVE` is "post"; the KIND
         lives on the media items inside it, so an image and a video ride in
         the same object and no reel is possible. The place is `light_to` on
         that same Post rather than a second, emptier one. And because a Post
         is what `oneway/sharing` can reference, the friend gets a pointer to
         the very thing on the profile instead of a frozen duplicate.

         WHY THE GALLERY IS NOT MISSED: `/api/users/{email}` serves canonical
         Posts (measured — a Post created through this door appears on the
         profile with its media), and the Post write maintains the feed index
         itself, which the gallery path never did. Galleries are untouched
         everywhere else; this stops MAKING new ones from the camera.

         THE BYTES GO THROUGH `POST /api/oneway/media`, which returns the
         contracted item itself — so nothing has to invent an object to hold a
         file, and nothing has to assemble one either. */
      say('Getting it ready…');
      /* ── A BAR, NOT A SENTENCE ───────────────────────────────────────────
         ★ FOUNDER/493: *"There is also loading bars for post uploads."*

         This said "Adding 2 of 3…" and nothing else — a line of text that a
         person reads once and then watches not change for however long a video
         takes. The steps are honest and countable (one per file, plus the post
         itself), so the bar measures something real rather than animating to
         look busy: it moves when a file has actually landed.

         IT IS NOT A PERCENTAGE OF BYTES, and it does not pretend to be. Bytes
         would need upload progress events the data layer does not expose; a
         bar that crept to 90% and sat there would be a worse lie than a bar
         that steps. Each step is a file that is genuinely on the server. */
      var steps = picks.length + 1, at = 0;
      var prog = mk('div', 'ow-compose__prog');
      var bar = mk('i', '');
      prog.appendChild(bar);
      prog.setAttribute('role', 'progressbar');
      prog.setAttribute('aria-valuemin', '0');
      prog.setAttribute('aria-valuemax', String(steps));
      function tick(n) {
        at = n;
        prog.setAttribute('aria-valuenow', String(at));
        bar.style.width = Math.round((at / steps) * 100) + '%';
      }
      tick(0);
      if (status && status.parentNode) status.parentNode.insertBefore(prog, status.nextSibling);
      else wrap.appendChild(prog);
      var clearProg = function () { if (prog.parentNode) prog.parentNode.removeChild(prog); };

      var home = (data.meHome && data.meHome()) || '';
      var pid = '';
      return picks.reduce(function (chain, p, i) {
        return chain.then(function () {
          say('Adding ' + (i + 1) + ' of ' + picks.length + '…');
          /* AN IMPORT IS ALREADY A REFERENCE — it needs no upload */
          if (p.external) {
            made.push({ url: p.src, kind: p.kind, origin: 'imported' });
            return;
          }
          /* ── THE SERVER HANDS BACK THE ITEM, AND THE CLIENT STOPS BUILDING
                 ONE ────────────────────────────────────────────────────────
             ★ B, 2026-09-07: `POST /api/oneway/media` returns *"the same
               media_item shape a Post carries and a message attachment now
               carries, origin included — so the client hands it straight to
               POST /api/posts or to a message without reshaping anything."*
               And they proved the property that matters: SENT ITEM == POSTED
               ITEM, byte for byte.

             This was assembling `{url, kind, origin}` by hand from a
             url-and-kind reply. That worked and it made the byte-for-byte
             property a COINCIDENCE — two hands building the same shape, which
             is the arrangement that drifts. Now there is one builder and it is
             the contract itself.

             WHERE IT CAME FROM IS STILL THE CLIENT'S TO SAY, because only this
             code knows whether the shutter or the picker produced the file —
             it is DECLARED on the way in rather than inferred on the way
             out. */
          return data.post('/api/oneway/media',
                           { data: p.src, origin: p.origin || 'uploaded' })
            .then(function (u) {
              if (!u.ok) throw new Error(u.error || 'that file was refused');
              var item = (u.data || {}).media;
              if (!item || !item.url) throw new Error('that file was refused');
              made.push(item);
              tick(made.length);
            });
        });
      }, Promise.resolve()).then(function () {
        say('Sharing…');
        tick(picks.length);
        /* ══ POSTING MOVES TO THE NEW BACKEND ═════════════════════════════
           ★ FOUNDER/500: *"verify that we are truly moving over to a new
             backend and this is truly becoming a real platform down to the
             backend."*

           MEASURED 2026-09-23 (tools/probe/backend-reality.cjs): the App's
           reads are 80% on `api/oneway/`, and the single most important thing
           a person does on a social platform — POSTING — still went through
           the legacy application's `/api/posts`. The same composer's "Send to a
           friend" already used the canonical `/api/oneway/social/posts`, so one
           screen created one kind of object through two backends.

           THIS WAS A PROMISE A LANE-A SESSION MADE AND DID NOT KEEP. The
           canonical route carries a comment quoting it: *"canonical door
           exists but has no security screen and no idempotency replay; add
           them and I move the write the same hour."*  B added both. The write
           never moved. It moves now.

           THE MAPPING IS EXACT, NOT APPROXIMATE. The legacy door took
           `light_to` (a destination) and fell back to the author's own Center;
           the canonical model says a Post BELONGS TO A PLACE and names it
           `center_id`. So `center_id` is the place the person chose, or their
           own Center when they chose none — which is precisely what the legacy
           door did with `light_to`. The canonical route screens content
           (refusing rather than posting unscreened), replays idempotent
           retries, and honours `audience` — everything the legacy door did. */
        var body = { center_id: place || home, body: caption.trim(),
                     title: title.trim(), media: made };
        if (audience && audience !== 'everyone') body.audience = audience;
        if (!body.center_id) throw new Error('there is nowhere for it to go yet');
        /* ALSO TO THE PLATFORMS CHOSEN — only the ones this Center can send
           to; the server holds back anything else by name (founder/503) */
        var can = reachFor[body.center_id] || [];
        var outward = OW.reach.keys(outTo).filter(function (k) {
          return can.some(function (t) { return t.key === k && t.canSend; });
        });
        if (outward.length) body.destinations = outward;
        return data.post('/api/oneway/social/posts', body);
      }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'it did not go out');
        pid = ((r.data || {}).post || {}).id || (r.data || {}).id || '';
        if (!pid) throw new Error('it did not go out');
        /* THE PEOPLE LAST, AND DELIBERATELY SO. The thing must exist and be
           published before anybody is handed a link to it; sending first would
           put a reference to a private draft in somebody's messages. And a
           send that fails must never lose what was already made — which is why
           `sendToPeople` resolves with outcomes instead of rejecting. */
        return sendToPeople(pid, made).then(function (sent) {
          data.invalidate('/api/');
          tick(steps);
          clearProg();
          done(pid, r, sent);
        });
      }).catch(function (e) {
        clearProg();
        var why = (e && e.message) || 'try again';
        say('That did not share — ' + why + '.', 1);
        /* the bar says it too, because the composer may be scrolled away from
           this line by the time it fails (founder/493) */
        if (OW.toast) OW.toast('That did not post — ' + why);
        btn.disabled = false;
      });
    }

    /* IT LANDED, AND THIS SAYS WHERE — IT DOES NOT WALK YOU THERE.
       The old code fired `ow:open-gallery` and the App navigated, so finishing
       one thing threw you onto a page you had not asked for. A person who has
       just shared something usually wants to share the next thing. So the
       result is a sentence and a LINK: going is their choice. */
    /* THE RECEIPT IS ALREADY ON SCREEN. `done()` renders it directly, so a
       repaint at this point must LEAVE IT ALONE rather than redraw it — the
       one thing worse than a walkthrough is a screen that erases the sentence
       telling you something worked. */
    function paintDone() { /* nothing: done() owns this surface */ }
    function done(gid, postRes, sent) {
      stop();
      step = 5; paintSteps();
      stage.innerHTML = '';
      foot.innerHTML = '';
      say('');
      /* A POST OF WORDS ALONE HAS NO PICKS. It used to read `Shared "0 things"`
         — so with nothing picked, the receipt names the person's own words. */
      var words = caption.trim().replace(/\s+/g, ' ');
      var name = title.trim() ||
        (picks.length === 0 ? (words.length > 40 ? words.slice(0, 40).replace(/\s+\S*$/, '') + '\u2026' : words) || 'Your post'
         : picks.length === 1 ? 'What you made'
         : picks.length + ' things');
      var where = 'your profile';
      places.forEach(function (p) {
        if (p.id === place) {
          where = postRes && postRes.ok
            ? 'your profile and ' + p.name
            : 'your profile — but it could not also go to ' + p.name;
        }
      });
      var ok = mk('div', 'ow-compose__done');
      ok.appendChild(mk('p', 'ow-note show ow-note--good',
        esc('Shared "' + name + '" to ' + where + '.')));
      /* ── WHERE IT WENT, AND HOW TO OPEN IT ───────────────────────────────
         ★ FOUNDER/493: *"feedback that truly tells user where a post uploaded
           and where to click it."*

         The receipt below says where and offers a link, and it is correct — but
         it lives on the composer, which is the one surface a person leaves the
         moment they are done. The bar says the same thing over whatever they
         went to next, and its action opens the Post itself. Five seconds,
         because a control nobody has time to press is not a control. */
      if (OW.toast && gid) {
        OW.toast('Posted to ' + where + '.', {
          tone: 'ok',
          action: 'See it',
          onAction: function () {
            try {
              doc.dispatchEvent(new CustomEvent('ow:open-post', { detail: { id: gid } }));
            } catch (_) {}
          }
        });
      }

      /* WHO ACTUALLY GOT IT — NAMED, AND SPLIT THREE WAYS.
         "Sent to 3 people" is the sentence that hides a failure. Sending is
         per-person and so is the outcome, so each of the three real endings
         gets its own words: it arrived · it is waiting for them to accept a
         first message from you · it did not go. Anything less makes a person
         believe something reached somebody it did not reach. */
      (sent || []).length && (function () {
        var went = (sent || []).filter(function (x) { return x.sent; })
                     .map(function (x) { return x.to; });
        var held = (sent || []).filter(function (x) { return x.held; })
                     .map(function (x) { return x.to; });
        var bad  = (sent || []).filter(function (x) { return x.failed; })
                     .map(function (x) { return x.to; });
        if (went.length) {
          ok.appendChild(mk('p', 'ow-note show ow-note--good',
            esc('Sent to ' + went.join(', ') + '.')));
        }
        if (held.length) {
          ok.appendChild(mk('p', 'ow-compose__why',
            esc('Waiting for ' + held.join(', ') + ' to accept a first message '
                + 'from you — it is not in their messages yet.')));
        }
        if (bad.length) {
          ok.appendChild(mk('p', 'ow-note show is-bad',
            esc('It did not reach ' + bad.join(', ') + '. What you made is '
                + 'safe — you can send it from the post itself.')));
        }
      }());
      /* and each platform it also went to, each with its own answer */
      OW.reach.track(ok, gid, ((postRes && postRes.data) || {}).syndication || []);
      var acts = mk('div', 'po-acts');
      acts.style.setProperty('--h', 'var(--ow-h1)');
      acts.style.setProperty('--h2', 'var(--ow-h2)');
      /* ── BACK TO THE CAMERA IS THE PRIMARY ACT ──────────────────────────
         ★ FOUNDER, 2026-09-07: *"a tool that people everyday naturally use."*

         The receipt offered "See it" first and "Make another" second, which is
         the ordering of something you did ONCE. What people actually do after
         posting a photograph is take another one — every camera app returns
         you to the viewfinder, and the one that does not is the one you open
         twice a week.

         The confirmation stays, because a person needs to know it went. It is
         the ORDER and the WORD that change: "Camera" rather than "Make
         another", first rather than second. */
      var see = mk('button', 'po-act', 'See it');
      see.type = 'button';
      see.addEventListener('click', function () {
        /* IT IS A POST NOW, so this opens the Post surface. `ow:open-gallery`
           would have been handed a post id and found nothing — a "See it" that
           does nothing is the dead control Rule 12 forbids by name. */
        if (typeof global.openPost === 'function') { global.openPost(gid); return; }
        try {
          doc.dispatchEvent(new global.CustomEvent('ow:open-post',
            { detail: { id: gid } }));
        } catch (_) {}
      });
      var again = mk('button', 'po-act po-act--primary', 'Camera');
      again.type = 'button';
      again.addEventListener('click', function () {
        picks = []; title = ''; caption = ''; place = ''; outTo = {}; audience = 'everyone'; sub = '';
        sentPost = '';        /* a new thing, not the last one sent again */
        go(0);
      });
      acts.appendChild(again); acts.appendChild(see);
      ok.appendChild(acts);
      stage.appendChild(ok);
    }

    /* ── the foot: back / next / share ─────────────────────────────────── */
    /* NO NEXT, NO SHARE-AT-THE-END, NO BACK-AS-A-STAGE. `Post it` and `Send
       to a friend` sit with the thing they act on, where a person is already
       looking. The only thing left down here is the way OUT of what you made —
       and it is a way back to the CAMERA, not to a previous step. */
    function paintFoot() {
      foot.innerHTML = '';
      if (step === 5 || !picks.length) return;
      var again = mk('button', 'po-act', 'Camera');
      again.type = 'button';
      again.setAttribute('aria-label', 'Back to the camera');
      again.addEventListener('click', function () { go(0); });
      foot.appendChild(again);
    }

    /* WHAT IS ON SCREEN IS DECIDED BY WHETHER YOU HAVE MADE ANYTHING, not by
       how far along a path you are. `step` still exists because `done()` and
       the lens both set it and the rail is gone rather than every call site
       rewritten — but nothing READS it to choose a surface any more.

       `step === 5` is the one exception and it is not a stage either: it is
       the receipt after something has actually gone out. */
    function paintStage() {
      if (step === 5) paintDone();
      else if (!picks.length && !(posting && textPost)) { posting = false; paintChoose(); }
      else if (posting) { if (sub) paintPostSub(); else paintPost(); }
      else paintMade();
      screenMode(step === 5 || !!picks.length || (posting && textPost));
    }

    /* ── WHAT YOU MADE ─────────────────────────────────────────────────────
       Everything that used to be Review, Describe and Where, on one surface,
       in the order a person actually cares about it: the thing itself, what to
       do with it, and then — quietly, below — the optional words and the
       optional destination. */
    function screenTop(title, backLabel, onBack) {
      var top = mk('div', 'ow-upload__top');
      var back = mk('button', 'ow-upload__back');
      back.type = 'button';
      back.setAttribute('aria-label', backLabel);
      back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
      back.addEventListener('click', onBack);
      top.appendChild(back);
      top.appendChild(mk('h2', 'ow-upload__h', esc(title)));
      stage.insertBefore(top, stage.firstChild);
    }
    function paintMade() {
      stage.innerHTML = '';
      paintArrange();          /* the picks, Add more, Remove, trim */
      screenTop('Edit', 'Back to the camera', function () { go(0); });
      sendRow(stage);          /* Next · Send to a friend */
    }

    /* ── THE UPLOAD SCREEN ─────────────────────────────────────────────────
       ★ FOUNDER/493: TikTok's flow — attach, edit, THEN a separate screen
       to post from. Laid out the way TikTok's Post screen is: the words
       beside the cover, then where it goes, then the other platforms, then
       one Post across the bottom. Back returns to editing with nothing lost —
       every value here lives in the composer, not in this screen. */
    function paintPost() {
      stage.innerHTML = '';
      screenTop('Post', 'Back to editing', function () { posting = false; paintStage(); });

      var row = mk('div', 'ow-upload__row');
      var cf = mk('div', 'ow-fld ow-upload__cap');
      var ca = doc.createElement('textarea');
      ca.rows = 5;
      ca.placeholder = 'Describe your post';
      ca.setAttribute('aria-label', 'Caption');
      ca.value = caption;
      ca.addEventListener('input', function () { caption = ca.value; });
      cf.appendChild(ca);
      row.appendChild(cf);
      var first = picks[0];
      var cover = mk('div', 'ow-upload__cover');
      if (!first) cover.hidden = true;        /* words on their own have no cover */
      if (first) {
        var m = doc.createElement(first.kind === 'video' ? 'video' : 'img');
        m.src = first.src;
        if (first.kind === 'video') { m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
        else m.alt = '';
        cover.appendChild(m);
        if (picks.length > 1) cover.appendChild(mk('span', 'ow-upload__n', String(picks.length)));
      }
      row.appendChild(cover);
      stage.appendChild(row);

      /* a headline is the uncommon case: a quiet control, never a box */
      var tf = mk('div', 'ow-fld');
      var ti = doc.createElement('input');
      ti.type = 'text'; ti.maxLength = 200;
      ti.placeholder = 'Headline';
      ti.setAttribute('aria-label', 'Headline');
      ti.value = title;
      ti.addEventListener('input', function () { title = ti.value; });
      tf.appendChild(ti);
      if (!title) {
        tf.hidden = true;
        var addT = mk('button', 'ow-depth__add', 'Add a headline');
        addT.type = 'button';
        addT.addEventListener('click', function () {
          tf.hidden = false; addT.remove();
          try { ti.focus(); } catch (_) {}
        });
        stage.appendChild(addT);
      }
      stage.appendChild(tf);

      /* ── THE ROWS, TIKTOK'S WAY (founder/510) ─────────────────────────────
         *"clean to use and labeled into different areas and it's easy to get
         back and into different sections."* Each decision is one labelled
         row saying its current answer; pressing it opens its own page with a
         back arrow, and the answer comes back here. The same row the Settings
         pages use, so the two read as one product. */
      var sec = mk('section', 'ow-set__sec ow-upload__rows');
      postRow(sec, 'pin', 'Where it goes', whereWords(), 'where');
      postRow(sec, 'lock', 'Who can see it', AUD_WORDS[audience] || 'Everyone', 'who');
      stage.appendChild(sec);

      /* ── ONE POST, THE WHOLE INTERNET ─────────────────────────────────────
         ★ FOUNDER/544: *"like a distributor platform for the entire
           internet"* — and 503: cross-platform posting is *"extremely
           important"*.

         It was a row reading "Other platforms · Off" that opened a page: the
         one thing that makes this more than a camera, one level down and
         worded as absent. It is now TikTok's "Share to" row on the post page
         itself: every platform's own mark, one tap to add it, and a platform
         that is not connected yet says so and offers Connect in place. The
         list is the Center's own (`/api/oneway/distribution`), never a second
         one kept here. */
      var ts = reachOf(place || ((data.meHome && data.meHome()) || ''));
      var reachSlot = mk('div', 'ow-upload__reach');
      stage.appendChild(reachSlot);
      if (place && OW.reach.notRun(reachSlot, placeOf(place))) { /* said why */ }
      else if (ts.length) OW.reach.row(reachSlot, ts, outTo, '', picks.map(function (p) { return p.kind; }));

      /* one Post, across the bottom, where the thumb already is */
      var bar = mk('div', 'ow-upload__bar');
      var go = mk('button', 'ow-btn ow-upload__post', 'Post');
      go.type = 'button';
      go.addEventListener('click', function () { share(go); });
      bar.appendChild(go);
      stage.appendChild(bar);
    }
    var AUD_WORDS = { everyone: 'Everyone', followers: 'Followers', close: 'Close friends' };
    var AUD_SAID = {
      everyone: 'Anyone on ONEWAY, and anywhere it is shared.',
      followers: 'Only people who follow you.',
      close: 'Only the people in your close friends.'
    };
    function whereWords() {
      var w = 'Your profile';
      places.forEach(function (p) { if (p && p.id === place) w = p.name; });
      return w;
    }
    function reachWords(ts) {
      var on = OW.reach.keys(outTo).map(function (k) {
        var t = ts.filter(function (x) { return x.key === k; })[0];
        return t ? t.label : '';
      }).filter(Boolean);
      return on.length ? on.join(', ') : 'Off';
    }
    function postRow(host2, icon, label, value, page) {
      var el = mk('button', 'ow-set__row');
      el.type = 'button';
      el.setAttribute('data-post-row', page);
      el.innerHTML = '<span class="ow-set__ic">' + setIcon(icon) + '</span>'
        + '<span class="ow-set__lb">' + esc(label) + '</span>'
        + '<span class="ow-set__v">' + esc(value || '') + '</span>'
        + '<span class="ow-set__cv">' + setIcon('chevron') + '</span>';
      el.addEventListener('click', function () { sub = page; paintStage(); try { global.scrollTo(0, 0); } catch (_) {} });
      host2.appendChild(el);
    }
    /* a choice among a few, TikTok's way: the row is the choice and a check
       says which one it is. Pressing one chooses it and goes back. */
    function pickRowOf(host2, label, said, on, face, onPick) {
      var el = mk('button', 'ow-set__row ow-setpick');
      el.type = 'button';
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', String(!!on));
      el.innerHTML = (face ? '' : '<span class="ow-set__ic"></span>')
        + '<span class="ow-setpick__w"><b>' + esc(label) + '</b>' + (said ? '<span>' + esc(said) + '</span>' : '') + '</span>'
        + '<span class="ow-setpick__ok">' + (on ? setIcon('check') : '') + '</span>';
      if (face) el.insertBefore(face, el.firstChild);
      el.addEventListener('click', onPick);
      host2.appendChild(el);
    }
    function paintPostSub() {
      stage.innerHTML = '';
      var TITLES = { where: 'Where it goes', who: 'Who can see it', platforms: 'Other platforms' };
      screenTop(TITLES[sub] || 'Post', 'Back to your post', function () { sub = ''; paintStage(); });
      var sec = mk('section', 'ow-set__sec');
      var back = function () { sub = ''; paintStage(); };
      if (sub === 'where') {
        stage.appendChild(mk('p', 'ow-set__lede', 'It goes to your profile. It can go to a place you are part of instead, where its members see it.'));
        /* your profile wears your own face, like the places under it */
        var meFace = mk('span', 'ow-dest__face ow-setpick__face');
        meFace.setAttribute('data-shape', 'round');
        if (OW.faceMark) meFace.innerHTML = OW.faceMark();
        data.get('/api/oneway/people/me').then(function (r) {
          var pc = r && r.ok && r.data && r.data.picture;
          pc = pc && (pc.url || pc);
          if (pc && typeof pc === 'string' && meFace.isConnected) {
            meFace.innerHTML = ''; var mi = doc.createElement('img'); mi.src = OW.imageUrl ? OW.imageUrl(pc) : pc; mi.alt = ''; meFace.appendChild(mi);
          }
        });
        pickRowOf(sec, 'Your profile', 'Everyone who follows you sees it.', !place, meFace, function () { place = ''; back(); });
        places.forEach(function (p) {
          if (!p || !p.id || !p.name) return;
          var face = mk('span', 'ow-dest__face ow-setpick__face');
          var pair = (typeof p.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(p.hue) : null;
          if (pair) { face.style.setProperty('--h', pair[0]); face.style.setProperty('--h2', pair[1] || pair[0]); }
          if (p.picture && OW.imageUrl) { var im = doc.createElement('img'); im.src = OW.imageUrl(p.picture); im.alt = ''; face.appendChild(im); }
          else face.textContent = String(p.name).trim().slice(0, 2).toUpperCase();
          pickRowOf(sec, p.name, '', place === p.id, face, function () { place = p.id; back(); });
        });
      } else if (sub === 'who') {
        ['everyone', 'followers', 'close'].forEach(function (a) {
          pickRowOf(sec, AUD_WORDS[a], AUD_SAID[a], audience === a, null, function () { audience = a; back(); });
        });
      } else if (sub === 'platforms') {
        stage.appendChild(mk('p', 'ow-set__lede', 'Choose where else it goes. Nothing is sent anywhere you do not choose.'));
        var ts = reachOf(place || ((data.meHome && data.meHome()) || ''));
        OW.reach.list(sec, ts, outTo, picks.map(function (p) { return p.kind; }));
        var done = mk('button', 'ow-btn ow-upload__post', 'Done');
        done.type = 'button';
        done.addEventListener('click', back);
        sec.appendChild(done);
      }
      stage.appendChild(sec);
    }

    /* the places are read ONCE, up front, so step 4 never waits on a request */
    data.get('/api/me/communities').then(function (r) {
      /* a person's own home is "your profile", never a second place beside it */
      var _home = (data.meHome && data.meHome()) || '';
      places = ((r.ok && r.data && r.data.communities) || []).filter(function (p) { return !p || p.id !== _home; });
    }).catch(function () { places = []; });
    reachOf((data.meHome && data.meHome()) || '');

    /* THE PEOPLE, READ ONCE, FOR THE SAME REASON — a person choosing where
       something goes must never wait on a request to find their friends.

       ASKED BY ADDRESS, NEVER BY "me". `/api/oneway/graph/{person}/following`
       answers 200 with `readable:true` and an EMPTY list for an address that
       does not resolve — including the literal string "me", which the rest of
       this codebase uses as an alias everywhere (`/api/me/places`,
       `/api/me/galleries`, `/api/me/lightbulb`). Measured 2026-09-07: asking
       it for "me" and asking it for a person who does not exist give the same
       confident empty answer as a real person with no follows. So a picker
       built on the convenient spelling would tell people they have no friends
       and never admit it had asked a bad question. `data.me()` is the address.

       FAILING TO READ IS NOT HAVING NOBODY, which is why the catch leaves the
       list empty AND `paintWhere` says which of the two happened. */
    var friendsOk = null;      /* null = not answered yet */
    (function () {
      var me = (data.me && data.me()) || '';
      if (!me) { friendsOk = false; return; }
      data.get('/api/oneway/graph/' + encodeURIComponent(me) + '/following')
        .then(function (r) {
          if (!r || !r.ok) { friendsOk = false; return; }
          friendsOk = true;
          /* `who` is the @handle: the list no longer carries anybody's address, and the
             conversation door takes the handle (people/refs.py, 2026-10-02) */
          friends = ((r.data || {}).people || []).filter(function (x) {
            return x && (x.ref || x.email);
          }).map(function (x) {
            return { who: x.ref || x.email, name: x.name || 'Someone' };
          });
        })
        .catch(function () { friendsOk = false; });
    }());

    paintSteps(); paintStage(); paintFoot();
    return { stop: stop };
  }

  /* NO NATIVE PROMPT. This asked for the name with `window.prompt()` — a
     browser-chrome modal in the middle of a surface that is otherwise entirely
     ONEWAY's own material. It breaks the platform's own rule ("no popups, no
     modals — every add-X is an inline composer"), it cannot be styled, cannot
     be themed to the person's hue, and on iOS it is a system sheet that closes
     the keyboard. It is replaced by the same inline composer pattern
     `postToPlace` uses: the field material that already exists, opened in
     place, with Enter to commit and Escape to change your mind. */
  function beginEmptyPost(host, anchor) {
    var seat = anchor || host;
    var open = seat.querySelector('.ow-galnew');
    if (open) { var f = open.querySelector('input'); if (f) f.focus(); return; }

    var wrap = mk('div', 'ow-galnew');
    var fld = mk('div', 'ow-fld');
    var input = doc.createElement('input');
    input.type = 'text';
    input.placeholder = 'What is this a place for?';
    input.setAttribute('aria-label', 'Name this post');
    fld.appendChild(input);
    var go = mk('button', 'ow-btn', 'Make it');
    go.type = 'button'; go.disabled = true;
    var out = mk('div');
    input.addEventListener('input', function () { go.disabled = !input.value.trim(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); go.click(); }
      if (e.key === 'Escape') wrap.remove();
    });
    go.addEventListener('click', function () {
      var name = input.value.trim(); if (!name) return;
      go.disabled = true;
      makeEmptyPost(name, out, wrap, go);
    });
    wrap.appendChild(fld); wrap.appendChild(go); wrap.appendChild(out);
    seat.appendChild(wrap);
    input.focus();
  }

  /* AN EMPTY POST IS A POST. This made a Gallery (`POST /api/me/galleries`)
     under the word "post" — the name was retired and the object under it was
     not, so the App's last legacy write lived behind this row. Galleries are
     retired, not migrated (founder, 2026-08-26, kept in api/oneway/manifest.py),
     and the App is to stand entirely on the new backend (founder/641).

     So it is the canonical Post, BORN A DRAFT: in no feed, on no profile,
     visible to its author alone until they share it — which is exactly what the
     row promises ("private until you share it"). The name is its title; the
     photos go in from the Post itself; it waits in Workspace meanwhile. */
  function makeEmptyPost(name, out, wrap, go) {
    function failed(why) {
      /* `.ow-note` is display:none until `.show` — a post that did not save
         must say so, where the person is looking */
      out.innerHTML = '';
      out.appendChild(mk('p', 'ow-note show ow-note--bad',
        esc('That did not save — ' + why + '.')));
      if (go) go.disabled = false;      /* they must be able to try again */
    }
    /* THE PERSON'S OWN PLACE. The shell learns it from `/api/auth/me` at boot;
       a press that beats that answer asks once more rather than refusing a
       person who is signed in. */
    function withHome() {
      var h = (data.meHome && data.meHome()) || '';
      if (h) return Promise.resolve(h);
      return data.get('/api/auth/me', { fresh: true }).then(function (r) {
        var u = (r && r.ok && r.data) || {};
        h = u.home_id || (u.user || {}).home_id || '';
        if (h) data.configure({ home: h });
        return h;
      });
    }
    return withHome().then(function (home) {
      if (!home) { failed('sign in again'); return null; }
      return data.post('/api/oneway/social/posts',
        { center_id: home, title: name, state: 'draft' });
    }).then(function (r) {
      if (r === null) return;
      var po = (r && r.ok && (r.data || {}).post) || {};
      if (!po.id) { failed((r && r.error) || 'try again'); return; }
      data.invalidate('/api/');
      /* IT SAYS WHERE IT WENT; IT DOES NOT WALK YOU THERE.
         Naming something must not throw the person off Create onto a screen
         they had not asked for — the "spawning objects in different pages" the
         founder named. Announcing it is the right move mid-flow; going is their
         choice, so it is a link. */
      if (out) {
        out.innerHTML = '';
        out.appendChild(mk('p', 'ow-note show ow-note--good',
          esc('"' + (po.title || name) + '" is ready, and private until you '
              + 'share it.')));
        var open = mk('button', 'po-act', 'Open it');
        open.type = 'button';
        open.addEventListener('click', function () {
          if (typeof global.openPost === 'function') { global.openPost(po.id); return; }
          try {
            doc.dispatchEvent(new global.CustomEvent('ow:open-post', { detail: { id: po.id } }));
          } catch (_) {}
        });
        out.appendChild(open);
      }
      /* the field and its button have done their work; the note replaces them
         in place, so the row the person started from is where the answer is */
      if (wrap) {
        var fldEl = wrap.querySelector('.ow-fld');
        if (fldEl) fldEl.remove();
      }
      if (go && go.parentNode) go.remove();
      try {
        doc.dispatchEvent(new global.CustomEvent('ow:created',
          { detail: { type: 'post', id: po.id } }));
      } catch (_) {}
    });
  }

  /* ═══ 7c · WHAT THE BRAIN SUGGESTS YOU MAKE ══════════════════════════════
     "The Brain understands. Lightbulb creates." (FOUNDATION.md) — the two are
     named as a pair in canon and the App had no join between them.
     `/api/brain/profile/creation-assist` was dark.

     IT EARNS ITS PLACE BECAUSE EVERY SUGGESTION CARRIES ITS OWN `why`, which is
     the one thing this surface's canon demands and the reason I did NOT wire
     `/api/discovery/*` — seven live routes whose payloads carry no reason at
     all. Measured on a real account rather than assumed:

       new person   → 1 suggestion, why: "Brain hasn't found a clear theme yet —
                      each post you make teaches Brain what you care about"
       after joining
       a community  → a SECOND appears: "Publish your next post to Food &
                      Dining", why: "It's your most active community"

     That is the Brain reasoning from what actually happened, and saying so. The
     reason LEADS in the row, because a suggestion without one is a
     recommendation and this surface deliberately is not that.

     NO NEW CREATION PATH. `kind` is already a Lightbulb create type (post ·
     document · note), so a tap runs the SAME `OW.live.begin()` every other row
     on this surface runs. A second way to start something would be the
     defect the whole platform is organised against. */
  function brainSuggests(host) {
    var wrap = mk('div');
    host.appendChild(wrap);
    return data.get('/api/oneway/people/me/brain/creation-assist').then(function (r) {
      if (!r.ok) return 0;                    /* never costs the create list */
      var d = r.data || {};
      var sugg = (d.suggestions || []).filter(function (x) {
        return x && x.prompt && x.kind;
      });
      /* NOTHING TO SAY IS A VALID ANSWER — no heading, no empty shell. The
         Brain not having noticed anything yet is not a surface to render. */
      if (!sugg.length) return 0;

      wrap.appendChild(mk('h3', 'ow-group', 'What Brain suggests'));
      /* the door writes its theme in markdown bold (`**theme**`) — measured on
         the Lightbulb 2026-09-21: the asterisks were on the screen. The one
         form it uses is drawn as what it means; everything else stays escaped
         (B told: the door should send words, not markup). */
      if (d.statement) {
        wrap.appendChild(mk('p', 'ow-door__why',
          esc(d.statement).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')));
      }
      var list = mk('div');
      OW.mountList(list, sugg.slice(0, 4).map(function (x, i) {
        return { id: 'bs-' + i,
                 label: x.prompt,
                 /* the REASON, said out loud — this surface's own law */
                 signal: x.why || '',
                 icon: 'spark' };
      }), { open: false });
      list.addEventListener('click', function (e) {
        var row = e.target.closest('.po-glance'); if (!row) return;
        var i = parseInt((row.getAttribute('data-po-id') || '').replace(/^bs-/, ''), 10);
        var pick = sugg[i];
        if (!pick) return;
        /* the same begin() every other row runs — no second creation path */
        OW.live.begin(pick.kind, row);
      });
      wrap.appendChild(list);
      return sugg.length;
    }).catch(function () { return 0; });
  }

  /* ═══ 7b · BEYOND ONEWAY — the accounts a person already has ═════════════
     Founder-prioritised 2026-08-08; founder/503 made it one path. This was a
     SECOND composer — its own box, its own Post button, its own legacy doors
     (`/api/connections/status`, `/api/marketing/publish-targets`,
     `/api/social/publish`) — beside the composer every post is made in. Two
     ways to post outward is the duplication rule broken in the one place the
     founder called "extremely important".

     Posting outward is now "Also post to" on the post itself (OW.reach, on
     B's canonical distribution door). What stays here is what Lightbulb is
     for: saying where what you make can reach, and the one step to reach
     further — Settings > Connected accounts. Rendered after the creation list
     and allowed to fail on its own without costing anyone the list above. */
  function beyondOneway(host) {
    var wrap = mk('div', 'ow-beyond');
    host.appendChild(wrap);
    return OW.reach.targets((data.meHome && data.meHome()) || '').then(function (ts) {
      if (!ts.length) return 0;            /* silent — it must never cost the list */
      var on = ts.filter(function (t) { return t.connected; });
      wrap.appendChild(mk('h3', 'ow-group', 'Beyond ONEWAY'));
      wrap.appendChild(mk('p', 'ow-door__why', esc(on.length
        ? 'What you post can also go to ' + on.map(function (t) { return t.label; }).join(', ')
          + ' — choose it on the post.'
        : 'Connect the accounts you already have, and what you post here can go to them too.')));
      if (on.length) {
        var marks = mk('div', 'ow-reach__chips');
        on.forEach(function (t) { marks.appendChild(OW.reach.mark(t.key)); });
        wrap.appendChild(marks);
      }
      var go = mk('button', 'po-act', on.length ? 'Connected accounts' : 'Connect an account');
      go.type = 'button';
      go.style.setProperty('--h', 'var(--ow-h1)');
      go.style.setProperty('--h2', 'var(--ow-h2)');
      go.addEventListener('click', function () { global.location.hash = '#settings/connected'; });
      wrap.appendChild(go);
      return on.length;
    }).catch(function () { return 0; });
  }

  /* ═══ 8c · POST TO A PLACE — the basis of the platform ═════════════════
     FOUNDER, 2026-08-09: "users cannot post via only their accounts, they
     have to post to a center. that's the basis of the platform."

     THE CAPABILITY WAS COMPLETE AND NOBODY COULD REACH IT. `POST /api/posts
     {light_to}` — the Lightbulb publish, screened, indexed into
     `feed_by_destination`, wired to the Brain — had ZERO callers across the
     App and the OS. Nothing in the product had ever sent `light_to`. So this
     is not a new capability; it is the door onto one that was already there.

     WHY THE DESTINATIONS COME FROM MEMBERSHIP AND NOT FROM
     `can_publish_through`. Those are two different questions and the runtime
     already settled one of them: `can_publish_through` is "which Centers may
     I publish AS", and it is EMPTY BY THE FOUNDER'S 2026-08-08 RULING —
     the App does not offer creating under a business. Posting TO a place you
     belong to is the opposite act: you speak as YOURSELF, and the place is
     where it lands. Sourcing this from `/api/me/communities` honours both
     rulings and adds no second notion of permission.

     AND THE DESTINATION IS REQUIRED. There is no "just me" option, because
     the ruling is that a person does not post into their own account. If a
     person belongs nowhere the composer says so and opens Discovery, rather
     than quietly letting them post into a room with no one in it. */
  function postToPlace(host) {
    var wrap = mk('div');
    host.appendChild(wrap);
    return Promise.all([
      data.get('/api/me/communities'),
      /* WHO THIS PERSON IS, so their own Center can be named rather than
         labelled with a generic word. Read in parallel — it costs no wall
         clock, and a destination a person cannot see their own name on does
         not read as theirs. */
      /* the canonical person read — it carries the ONE face (436) and the
         cut, which the legacy /api/auth/me never did */
      data.get('/api/oneway/people/me').catch(function () { return { ok: false }; })
    ]).then(function (rs) {
      var r = rs[0], mr = rs[1];
      /* a person's own home is the "you" chip, never a second place beside it */
      var _home = (data.meHome && data.meHome()) || '';
      var places = ((r.ok && r.data && r.data.communities) || []).filter(function (p) { return !p || p.id !== _home; });
      var meRow = (mr.ok && mr.data && (mr.data.person || mr.data)) || {};
      var myName = (meRow.display_name || meRow.name || meRow.full_name || '').trim();
      /* the heading is the SURFACE'S now ("Say something") — this used to add
         its own, and two headings for one composer is how a screen starts
         reading like a stack of unrelated panels */

      /* ═══ TWO POSTABLES, NAMED APART ═══════════════════════════════════
         Founder, 2026-08-16: *"clearly separating the main, like, postables,
         like the mainstream post to a center, and then the personal story
         post. I also want text like posts, like Twitter."*

         ⚠ SUPERSEDED THE SAME DAY — READ THIS BEFORE RESTORING ANYTHING.
         The paragraph above was written for a personal post that no longer
         exists. Later on 2026-08-16 the founder ruled, narrowly and
         unambiguously:

             "people don't have their own posts, everything is posted under a
              community — that's a core correction that i already laid out"

         THE SOURCE OF THE EARLIER QUOTE IS REAL AND IS RECORDED HERE, because
         getting this label right matters more than the feature did. Asked about
         it, the founder answered "I did not tell another Claude that" — and I
         briefly marked this MISATTRIBUTED on the strength of that. That was
         wrong. The session that built the personal post holds the verbatim line
         from its own transcript, said in a longer message about Lightbulb:

             "...clearly separating the main, like, postables, like the
              mainstream post to a center, and then the personal story post."

         Both of his statements are true from where he was sitting. One founder,
         two moments, hours apart. Writing "a session invented a quote" would
         have put a FALSE thing in this file to make a true correction look
         tidier — and a file that claims he never said something he did is worth
         less than no comment at all.

         SUPERSEDED, therefore: said, then narrowed by the same person the same
         day. The later ruling governs and is not re-litigated.

         The quote is left standing rather than deleted, because a comment that
         edits its own history teaches the next reader it was always right — and
         because this is exactly how the misattribution was caught: it was
         written down, so it could be put to the founder and checked. A tidy
         file would have hidden it.

         It is re-marked, not erased. If anyone ever produces a verbatim source
         for it, that belongs in front of the founder, not in a rebuild.

         The old objection was fair and is answered rather than ignored — a
         person who has joined nowhere could not write a sentence. They still
         cannot post, because there is nowhere for a post to live; but they are
         now told that plainly and pointed at joining a place, instead of being
         handed a composer whose button never lights.

         MEASURED, NOT ASSUMED. `POST /api/posts` with `light_to:""` returns
         200, stores `destination:""` against the person's own Profile Center,
         and the post appears in their own `/api/me/feed/posts`. What it does
         NOT do is appear in `/api/me/posts`, which powers the profile page and
         reads a different store (channel messages) — so the copy below says
         "your feed" and does not promise a profile listing it cannot keep. */
      /* ── EVERYTHING IS POSTED UNDER A COMMUNITY ────────────────────────
         (founder, 2026-08-16: "people don't have their own posts, everything
         is posted under a community — that's a core correction I already laid
         out".)

         This surface offered "Your own feed" FIRST and called it "the one that
         always works", sending `light_to:""` — a post belonging to no place.
         The runtime accepts that, so nothing could ever catch it: it was not
         wrong in a way a test can see, it was wrong about what a post IS here.

         A post is an act INSIDE a community. Remove the community and it is not
         a lighter-weight post — it is a different object with no home, no
         audience, and no Center whose Brain can do anything with it. The shape
         was already telling on itself: personal posts land in
         `/api/me/feed/posts` while a profile reads a different store, so they
         appeared on no profile at all. A dead end by construction.

         So there is no personal destination. Someone who belongs nowhere is not
         handed an empty picker and a dead button — they are told the true thing
         about posting here, which is that it happens in a place. */
      /* ── ⚠ THE PARAGRAPH ABOVE READ THE RULING BACKWARDS, AND IT CLOSED THE
            FRONT DOOR. Founder, 2026-08-17: *"none of the posts are working."*
            Walked as an account thirty seconds old: Create → "Post it" → *"Posts
            live in communities. Join one, and this is where you write to it."*
            No picker, no button, and no way to join from that screen. A new
            person could not write one sentence on this platform.

            Read the governing quote as English: *"people dont have their own
            posts — everything is posted under a community — thats a core
            correctaiton that i already laid out."* That is the founder naming
            a DEFECT, and saying he had already called it out once. It was read
            as an instruction to make a community mandatory, which is precisely
            the thing being complained about. The two clauses were treated as
            rule-then-reason when they are symptom-then-symptom.

            The reasoning built on top of it was sound and is kept: a post with
            no home is a row nothing can show, and that dead end was real. What
            was wrong is the arithmetic — a person's OWN Center is a home, every
            account is given one at registration, and it was never counted.
            `light_to:''` no longer means "belongs nowhere"; the runtime resolves
            it to this person's own Center by name, so the post has a place, an
            author and a Brain that can use it.

            MEASURED, NOT ASSUMED, on the shared database: a fresh account with
            zero communities posts, and the row comes back `destination_name:
            "Walk Tester"` and is carried by `/api/me/feed/posts`, `/api/feed`
            AND `/api/me/posts` — the profile read. Three of three. */
      var SELF = '@me';                 /* sentinel: the person's own Center */
      var selfLabel = myName || 'Your own Center';
      /* THE PERSON'S OWN PLACE IS THE DEFAULT, whatever else they belong to.
         This pre-picked the one community when there was exactly one, so a
         brand-new person who had joined a Center a minute earlier wrote her
         first words and read "Posted to Caesars Atlantic City" (measured
         2026-09-14 as Ida, on a fresh gateway). Where a post goes is her
         choice (Lightbulb rulings: nothing is decided for her); her own
         Center is the one destination that is always there, so it is the one
         that is chosen until she chooses. */
      var picked = SELF;

      wrap.appendChild(mk('p', 'ow-door__why',
        places.length ? 'Where does this go?'
                      : 'This goes to your profile. Join a place to post there too.'));
      /* ★ FOUNDER/438 + /442: a ROW of faces, sideways, not a wall of chips
         — the same row the media composer's "Also to" draws. */
      var chips = mk('div', 'ow-compose__dests');

      /* ── TWO DESTINATIONS WITH ONE NAME IS NOT A CHOICE ──────────────────
         MEASURED 2026-09-13 on a real signed-in account: this picker offered
         TWENTY destinations and TWO distinct labels. Nineteen chips all read
         "Feed Continuity Center", and a person deciding where to put what they
         just wrote could not tell them apart. The machine was never confused —
         each chip carries `data-dest` with its own id — but the person is the
         one being asked, and they were choosing blind.

         It is not a fixture artefact. A chain operates "Bally's" in three
         towns; each is a real Center with its own id, and its operator posts
         to one of them specifically. Posting to the wrong branch and not being
         able to tell is a worse failure than any empty state on this screen.

         WHAT IS ACTUALLY AVAILABLE TO TELL THEM APART. `/api/me/communities`
         carries id, name, role, operates, hue, members and joined_at — and no
         location, which would have been the human answer. joined_at does not
         separate them either: these nineteen were joined within minutes of
         each other. So the only always-unique, person-checkable fact is the id
         — and it is the one already in the address bar when you open a Center
         (#/c/047fcbb50531), so a short head of it is something a person can
         actually match against something they have seen.

         SO THE DISAMBIGUATOR IS SHOWN ONLY WHERE IT IS NEEDED. A picker where
         every name is unique shows no ids at all; a name that occurs twice
         carries a quiet tail on both. Nothing is added to a screen that does
         not need it — which is the same rule the location block follows.

         AND EACH CHIP TAKES ITS OWN CENTER'S HUE, which the payload has been
         sending all along and nothing read. Nineteen chips in nineteen colours
         are distinguishable at a glance even before the text is read, and a
         Center's hue is already how this product says which world you are in. */
      var nameCount = {};
      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;
        var nm = String(p.name).trim();
        nameCount[nm] = (nameCount[nm] || 0) + 1;
      });

      function chip(id, label, hue, picture, shape) {
        var nm = String(label).trim();
        var tail = (nameCount[nm] > 1 && id && id !== SELF)
          ? String(id).slice(0, 4) : '';
        var b = mk('button', 'ow-dest');
        var face = mk('span', 'ow-dest__face');
        if (/^(round|rounded|square)$/.test(String(shape || ''))) face.setAttribute('data-shape', shape);
        if (picture && OW.imageUrl) {
          var im = doc.createElement('img'); im.src = OW.imageUrl(picture); im.alt = ''; im.loading = 'lazy'; face.appendChild(im);
        } else if (id === SELF && OW.faceMark) {
          face.innerHTML = OW.faceMark();          /* you, with no picture: the outline (founder/495) */
        } else {
          face.textContent = (id === SELF ? nm.slice(0, 1) : nm.slice(0, 2)).toUpperCase();
        }
        b.appendChild(face);
        b.appendChild(mk('span', 'ow-dest__n', esc(nm) + (tail ? ' <i class="po-act__tag">' + esc(tail) + '</i>' : '')));
        b.type = 'button';
        /* THE CHIP WEARS THE CENTER IT SENDS TO, not the row's.
           `--ow-h1` is an RGB TRIPLE ("r,g,b"), not an angle and not HSL —
           `OW.hue.fromAngle` is the one bridge from the backend's single
           integer to the pair the canon requires, and writing an angle
           straight into the variable produces `rgb(8 70% 58%)`, which is
           invalid and paints nothing. I wrote exactly that first. */
        if (typeof hue === 'number' && OW.hue && OW.hue.fromAngle) {
          var pair = OW.hue.fromAngle(hue);
          if (pair && pair[0]) {
            b.style.setProperty('--h', pair[0]);
            b.style.setProperty('--h2', pair[1] || pair[0]);
          }
        }
        /* THE CHIP CARRIES ITS OWN DESTINATION. Every later read — the
           pre-select, the confirmation — asks the chip what it means rather
           than matching its visible text, which is a label and may be a
           person's name, a community's, or a translation. */
        b.setAttribute('data-dest', id);
        b.setAttribute('aria-pressed', String(picked === id));
        b.addEventListener('click', function () {
          picked = (picked === id) ? '' : id;
          Array.prototype.forEach.call(chips.children, function (c) {
            var on = c === b && picked;
            c.setAttribute('aria-pressed', String(!!on));
          });
          sync();
        });
        chips.appendChild(b);
        return b;
      }
      /* THE PERSON'S OWN CENTER COMES FIRST — it is the one destination that
         is always there, and on a brand-new account it is the only one. */
      /* the person's own face on their own destination (436) */
      chip(SELF, selfLabel, null, meRow.picture || meRow.image || '', meRow.shape || 'round');
      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;      /* a place we cannot name */
        chip(p.id, p.name, typeof p.hue === 'number' ? p.hue : null, p.picture || '', p.shape || '');
      });

      /* THE FIELD MATERIAL ALREADY EXISTS — `.ow-fld` carries the dark
         ground, the radius, the placeholder tone and the focus ring that
         takes the person's own hue. A bare <textarea> renders as a WHITE BOX
         in a dark world; I shipped exactly that a moment ago and saw it on
         screen. Reuse beats inventing a second field style. */
      /* A HEADLINE, OPTIONAL. `POST /api/posts` has always taken `title` and
         the App has never sent one, so a person could not give their post a
         name while the Center's own composer could. Same field material as
         the body — `.ow-fld` — never a second one. */
      /* ── DEPTH ON REQUEST, NEVER AN EMPTY BOX ─────────────────────────
         ★ FOUNDER/369: *"how things like extra descriptions and headers
           could be optional for things like posts while not making them feel
           like empty boxes that a user has to either live leave in or leave
           out."*

         THIS WAS THE EMPTY BOX. The headline input sat above the body on
         every open of the composer, empty, saying "A headline, if it needs
         one" — and every person writing a two-line post had to decide what
         to do about a field they had not asked for. Two bad outcomes, both
         the founder's words: fill it with something to make the box go away,
         or leave it and post past a hole.

         THE PATTERN EVERY PLATFORM CONVERGED ON is one field and a quiet way
         to ask for more. The composer opens as the body alone. "Add a
         headline" is a text control under it, not a box; pressing it reveals
         the field, focused, and the control goes. A person who never wants a
         headline never sees an input for one. A person who does is one press
         from it. Nothing is hidden that has a value: once the field exists it
         stays for this composer, and an emptied one is simply not sent.

         The same pattern is the answer for descriptions, venues and the rest
         of an Event's depth (founder/369 names events first) — the field is
         the depth, the control is the invitation, and the box is never there
         until it is wanted. */
      var tfld = mk('div', 'ow-fld');
      tfld.hidden = true;
      var tin = doc.createElement('input');
      tin.type = 'text';
      tin.placeholder = 'Headline';
      tin.setAttribute('aria-label', 'Headline');
      tfld.appendChild(tin);
      var more = mk('div', 'ow-depth');
      var addT = mk('button', 'ow-depth__add', 'Add a headline');
      addT.type = 'button';
      addT.addEventListener('click', function () {
        tfld.hidden = false;
        addT.remove();
        if (!more.children.length) more.remove();
        try { tin.focus(); } catch (e) {}
      });
      more.appendChild(addT);

      var fld = mk('div', 'ow-fld');
      var ta = doc.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'Say something';
      ta.setAttribute('aria-label', 'What to post');
      fld.appendChild(ta);
      var send = mk('button', 'ow-btn', 'Post it');
      send.type = 'button'; send.disabled = true;
      var out = mk('div');

      function sync() { send.disabled = !(ta.value.trim() && picked); }
      ta.addEventListener('input', sync);

      /* PRE-SELECT WHAT IS ALREADY DECIDED. A person who belongs nowhere has
         exactly one destination — their own Center — and asking them to tap a
         chip with no alternative is a step with a single possible outcome.
         Done here rather than in the chip helper because `send` does not exist
         yet up there and `sync()` would throw on it.

         THE OLD VERSION MATCHED ON LABEL TEXT and compared against `''` when
         there was more than one place, so every chip got `aria-pressed=false`
         while `picked` held a real id — the button was live and the screen
         showed nothing chosen. Matching the CHIP'S OWN VALUE instead cannot
         drift from what will actually be sent. */
      Array.prototype.forEach.call(chips.children, function (c) {
        var on = !!picked && c.getAttribute('data-dest') === picked;
        c.setAttribute('aria-pressed', String(on));
        c.classList.toggle('po-act--primary', on);
      });
      sync();

      send.addEventListener('click', function () {
        var body = ta.value.trim(); if (!body || !picked) return;
        send.disabled = true;
        out.innerHTML = '';
        /* A DESTINATION IS NOT OPTIONAL — `picked` is a real community id, or
           the sentinel meaning this person's own Center, or the button never
           enabled. `@me` is translated to an empty `light_to` at the wire,
           because the SERVER owns what "my own Center" resolves to: it holds
           the person's Center id and its display name, and a client that
           guessed either would be inventing a destination. */
        /* ── ON THE NEW BACKEND (founder/500) ────────────────────────────
           The second of the App's two posting doors that still wrote through
           legacy `/api/posts`. The canonical route names the destination
           explicitly as `center_id`; "my own Center" is `data.meHome()`, which
           is the SERVER'S value — the `home_id` it handed back at sign-in — so
           the reasoning above still holds: nothing here guesses a destination,
           it repeats the one the server already stated. */
        var ownHome = (data.meHome && data.meHome()) || '';
        var dest = (picked === SELF) ? ownHome : picked;
        if (!dest) {
          out.appendChild(mk('p', 'ow-note show ow-note--bad',
            'There is nowhere for this to go yet — your own Center has not been made.'));
          sync(); return;
        }
        var wbody = { center_id: dest, body: body, title: (tin.value || '').trim() };
        var can = reachFor[reachCenter()] || [];
        var outward = OW.reach.keys(outTo).filter(function (k) {
          return can.some(function (t) { return t.key === k && t.canSend && OW.reach.meets(t, []); });
        });
        if (outward.length) wbody.destinations = outward;
        data.post('/api/oneway/social/posts', wbody)
          .then(function (res) {
            if (!res.ok) {
              /* NAMED, NEVER SWALLOWED — and `.ow-note` is display:none until
                 `.show`, which is how twelve earlier notes wrote to nobody */
              out.appendChild(mk('p', 'ow-note show ow-note--bad',
                esc(res.status === 422
                    ? 'That did not pass the security screen.'
                    : (res.error || 'It did not go out.'))));
              sync(); return;
            }
            /* THE SERVER NAMES THE PLACE IT ACTUALLY LANDED IN. This used to
               search `places` only, so a post to the person's own Center — not
               in that list — fell through to "the place you chose", which tells
               someone nothing about where their words went. */
            var name = ((res.data || {}).post || {}).destination_name || '';
            if (!name) places.forEach(function (p) { if (p.id === picked) name = p.name; });
            if (!name && picked === SELF) name = selfLabel;
            ta.value = ''; tin.value = '';
            out.appendChild(mk('p', 'ow-note show ow-note--good',
              esc('Posted to ' + (name || 'the place you chose') + '.')));
            OW.reach.track(out, ((res.data || {}).post || {}).id || '', (res.data || {}).syndication || []);
            outTo = {}; paintReach();
            /* the feed this just landed in must re-read reality */
            data.invalidate(FEED_READS);
            /* SEEING IT LAND IS THE SATISFYING PART, and a confirmation with
               nowhere to go is a dead end. Home is where a post to a place
               you belong to actually arrives — verified: `/api/me/feed/posts`
               carries it, nested as `{actor, post:{title, body…}}`. The App
               has no route to a single Center, so this goes to the feed and
               says so rather than promising a page that does not exist. */
            if (typeof global.go === 'function') {
              var seeIt = mk('button', 'po-act', 'See it in Home');
              seeIt.type = 'button';
              seeIt.addEventListener('click', function () { global.go('home'); });
              out.appendChild(seeIt);
            }
            sync();
          });
      });

      wrap.appendChild(chips);
      wrap.appendChild(tfld);            /* hidden until asked for */
      wrap.appendChild(fld);
      wrap.appendChild(more);            /* the invitations to add depth */
      /* ALSO TO THE PLATFORMS — the ones the chosen place can send to; a
         place the person does not run answers none, and then there is no row
         (founder/503) */
      var outTo = {}, reachSlot = mk('div'), reachFor = {};
      wrap.appendChild(reachSlot);
      function reachCenter() {
        return picked === SELF ? ((data.meHome && data.meHome()) || '') : (picked || '');
      }
      function paintReach() {
        var cid = reachCenter();
        reachSlot.innerHTML = '';
        var pl = null;
        places.forEach(function (p) { if (p && p.id === cid) pl = p; });
        if (OW.reach.notRun(reachSlot, pl)) return;
        if (reachFor[cid] === undefined) {
          reachFor[cid] = null;
          OW.reach.targets(cid, pl).then(function (ts) { reachFor[cid] = ts || []; paintReach(); });
          return;
        }
        OW.reach.row(reachSlot, reachFor[cid] || [], outTo, '', []);
      }
      paintReach();
      chips.addEventListener('click', function () { global.setTimeout(paintReach, 0); });
      wrap.appendChild(send);
      wrap.appendChild(out);
      return places.length;
    }).catch(function () { return 0; });
  }


  /* ═══ OPENING A POST ════════════════════════════════════════════════════════
     Founder, 2026-08-17: *"The post is a laughable excuse for a Popit opening."*
     He is right, and the measurement is short. Tapping a post opened the GENERIC
     Popit sheet, which showed three things:

         the body · "POSTED / Posted" · "LIT TO / Food & Dining"

     No author. No time. No like. No comment. No way to reach the person who
     wrote it — and the type printed twice, once as a label and once as its own
     value. A post is the act this platform is built on and it opened as a
     property dump.

     NOTHING HERE IS NEW DATA. `GET /api/posts/{id}` already returns author,
     created_at, destination_name, media, galleries and an `interactions` block
     carrying `offers` and `mine`; `/comments` already returns real comments.
     Every field below was being returned and thrown away — which is this
     platform's signature failure, in the one surface where it is most visible.

     THE RESPONSE VOCABULARY IS THE SERVER'S. `offers` says what this object
     accepts and `mine` says what this person already gave. Nothing hardcodes
     "like" — a post offers like/dislike, another object may offer approve, and
     the same code renders both because it READS rather than assumes. */
  /* THE SHARED TOOLS, PUBLISHED ONCE — the seam that lets a capability live in
     its own file without a build step. `frontend/app/discovery/discovery.js`
     binds these by name at load. Anything added here becomes available to every
     capability file; anything REMOVED breaks them loudly at load rather than
     quietly at render, which is the whole reason it is an explicit object and
     not an implicit closure. */
  /* ── CONSECUTIVE RUNS OF THE SAME EVENT, COLLAPSED ────────────────────
     Ten rows of "loop.bo sent you a message" is not ten pieces of news, it is
     one piece of news that happened ten times. Notifications has collapsed
     them for a while; WORKSPACE rendered the same rows raw and showed the line
     ten times over — the same data, two behaviours, and the worse one on the
     surface a person opens to see what needs them.

     CONSECUTIVE ONLY, NEVER ACROSS A GAP. Collapsing a run keeps the order the
     server sent; collapsing everything of a kind would silently reorder
     somebody's history and put an old thing back at the top.

     Shared rather than copied. It was copied once — into a comment in
     Notifications explaining that `line` comes first and the raw `kind` "reads
     like a database column" — and Workspace never received either half. */
  function groupRuns(rows) {
    var out = [];
    (rows || []).forEach(function (n) {
      var last = out[out.length - 1];
      var key = [n.kind, (n.actor || {}).email || n.actor || '',
                 n.subject || n.subject_id || ''].join('\u0000');
      if (last && last._key === key) { last._n += 1; return; }
      var g = {};
      for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) g[k] = n[k];
      g._key = key; g._n = 1;
      out.push(g);
    });
    return out;
  }

  OW._u = {
    assetUrl: assetUrl,
    groupRuns: groupRuns,
    data: data,
    doc: doc,
    esc: esc,
    failed: failed,
    loading: loading,
    mk: mk,
    nothing: nothing,
    openCenterPopit: openCenterPopit,
    openEventScreen: openEventScreen,
    refused: refused,
    signedIn: signedIn,
    refreshDaily: refreshDaily,
    token: token,
    whenWords: whenWords,
    composer: composer,
    postPayload: postPayload,
    beginEmptyPost: beginEmptyPost,
    imageUrl: imageUrl,
    beyondOneway: beyondOneway,
    /* ── CALLED BY app/create/create.js ─────────────────────────────────────
       Both are defined in this file and were being called from create.js,
       which is a separate closure and could not see them — Create opened on
       `postToPlace is not defined`. Exposed here rather than copied there:
       a second brain-suggestion or place-posting path is exactly the kind of
       duplication that leaves two surfaces disagreeing. */
    brainSuggests: brainSuggests,
    postToPlace: postToPlace,
  };

  global.OW = OW;
})(window);
