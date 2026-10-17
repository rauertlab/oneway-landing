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

  /* ═══ 1 · DATA lives in frontend/shared/oneway-data.js (PLAN G6 and B6: the App and the OS read and write through one
     door, which keys a write, keeps one that found no network in the outbox and tells every screen). This file keeps the
     App's own session at open, below; the names the rest of it uses are the shared door's. */
  var data = OW.data;
  if (!data) { console.warn('[oneway-popit-live] load oneway-data.js first'); return; }
  function token() { return data.token(); }
  function cookieSession() { return data.cookieSession(); }
  var assetUrl = data.asset, wrote = data.wrote;

  /* ═══ THE SESSION AT OPEN: THE COOKIE, ONCE A DAY FRESH (B: 24ee7de0, 7956e8cb, 10bf9333) ═══
     The OS's flow and the OS's keys (os.js, 03488a42), so the two renew once between them:
     1 · A token still in storage, never yet a cookie: POST /api/auth/refresh with it, once. The
         answer sets the HttpOnly cookie and ends that token in the same act; `ow_session_cookie`
         remembers that this browser has one, and from then on the App sends no session header.
     2 · Then at most once a day (`ow_session_at`): POST /api/auth/refresh with no body. The cookie
         is the session, and the answer gives a fresh one, so a session lives its 30 days
         (10bf9333) without signing out anyone who comes back.
     Nothing is written back to storage (lane B, 2026-10-09): a token left there goes once the
     cookie exists. A 30-second lock keeps two tabs from renewing at once. A 401 goes to sign-in unless
     another tab has just renewed; a network failure changes nothing. */
  var REFRESH_EVERY_MS = 864e5, REFRESH_LOCK_MS = 30000;
  /* A SESSION THAT ENDS TAKES WHAT THIS DEVICE KEPT OF THE PERSON (PLAN §3.1 SF-6): the outbox and the service worker's
     copies of their reads, before the page leaves. The App's sign-out never called the purge, so a signed-out device
     served the last person's identity, messages and notifications offline to whoever opened it next. The page waits a
     second at most: a sign-out never hangs on it. */
  function leaving(to) {
    var go = function () { global.location.href = to; };
    var p = null;
    try { p = (OW.offline && OW.offline.purge) ? OW.offline.purge() : null; } catch (_) {}
    if (!p || typeof p.then !== 'function') return go();
    Promise.race([p, new Promise(function (r) { global.setTimeout(r, 1000); })]).then(go, go);
  }
  function keepForPages(d) {
    /* NOTHING IS KEPT ANY MORE (lane B, 2026-10-09: the secure-cookie completion). The sign-in,
       sign-up and "Sign in with ONEWAY" pages, the OS, the realtime stream and the hue all go by the
       HttpOnly cookie now, so a token left in storage is only a copy an injected script could carry
       away. Whatever an older sign-in left there is removed the first time this browser holds the
       cookie. */
    var ls = global.localStorage;
    try { ls.removeItem('ow_session_token'); ls.removeItem('ow_tokens'); } catch (_) {}
    /* and the copy inside `ow_session`: the exchange ENDED that token, and a page that still sent it
       (doc-editor.js reads it) would be signed out, because a header outranks the cookie (measured
       in the browser, 2026-10-09: that token answered 401, the cookie alone 200) */
    try {
      var s = JSON.parse(ls.getItem('ow_session') || 'null');
      if (s && s.token) { delete s.token; ls.setItem('ow_session', JSON.stringify(s)); }
    } catch (_) {}
    data._session.forget();
  }
  function refreshDaily() {
    var ls = global.localStorage, t = token(), cookie = cookieSession(), at = 0, lock = 0;
    if (!t && !cookie) return Promise.resolve(false);                 /* signed out */
    try {
      at = +ls.getItem('ow_session_at') || +ls.getItem('ow_token_at') || 0;
      lock = +ls.getItem('ow_refreshing') || 0;
    } catch (_) { return Promise.resolve(false); }
    var exchange = !!t && (!cookie || !!data._session.base());                        /* a stored token, never yet a cookie */
    if (!exchange && at && Date.now() - at < REFRESH_EVERY_MS) return Promise.resolve(false);
    if (cookie && !data._session.base() && at && Date.now() - at < REFRESH_EVERY_MS) return Promise.resolve(false);
    if (lock && Date.now() - lock < REFRESH_LOCK_MS) return Promise.resolve(false);
    var began = Date.now();
    try { ls.setItem('ow_refreshing', String(began)); } catch (_) {}
    function unlock() { try { ls.removeItem('ow_refreshing'); } catch (_) {} }
    return global.fetch(data._session.base() + '/api/auth/refresh', {
      method: 'POST', credentials: 'same-origin',
      /* on this origin the answer is the cookie alone: no token in the body (identity/routes._signed_in) */
      headers: data._session.base() ? { 'Content-Type': 'application/json', 'Accept': 'application/json' }
                    : { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-ONEWAY-Session': 'cookie' },
      body: JSON.stringify(exchange ? { refresh_token: t } : {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        unlock();
        if (r.ok && j && (j.access_token || j.session === 'cookie')) {
          try {
            if (!data._session.base()) ls.setItem('ow_session_cookie', '1');
            ls.setItem('ow_session_at', String(Date.now()));
            ls.removeItem('ow_token_at');                               /* the App's older key */
          } catch (_) {}
          if (data._session.base()) { try { ls.setItem('ow_session_token', j.access_token); } catch (_) {} data._session.set(j.access_token); }
          else keepForPages(j);
          return true;
        }
        if (r.status === 401) {
          var again = 0;
          try { again = +ls.getItem('ow_session_at') || 0; } catch (_) {}
          if (again >= began) { data._session.forget(); return false; }           /* another tab renewed it first */
          try { ['ow_session_token', 'ow_tokens', 'ow_session', 'ow_token_at', 'ow_session_at', 'ow_session_cookie'].forEach(function (k) { ls.removeItem(k); }); } catch (_) {}
          data._session.forget();
          leaving('/login.html?return=' + encodeURIComponent('/oneway-app.html'));
        }
        return false;
      });
    }).catch(function () { unlock(); return false; });
  }
  /* after the first screen, never in its way */
  try { global.addEventListener('load', function () { setTimeout(refreshDaily, 4000); }); } catch (_) {}

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


  /* the controls for one post on one page agree: pressing Save in the post's room presses it on the card behind */
  function syncControls(path, on, body) {
    var m = /^\/api\/objects\/([^/]+)\/([^/]+)\/(save|repost|respond)$/.exec(String(path || ''));
    if (!m) return;
    var id = decodeURIComponent(m[2]), what = m[3];
    var verb = what === 'respond' ? String((body && body.type) || '') : what;
    var sel = {
      save: '[data-po-save]', repost: '[data-po-repost]',
      like: '[data-po-respond="like"]', dislike: '[data-po-respond="dislike"]'
    };
    function press(selector, state) {
      Array.prototype.forEach.call(doc.querySelectorAll(selector), function (b) {
        if (b.getAttribute('data-obj') !== id) return;
        b.setAttribute('aria-pressed', String(state));
        b.setAttribute('data-act', state ? 'on' : 'off');
      });
    }
    if (!sel[verb]) return;
    var wantOn = (what === 'respond' && body && typeof body.on === 'boolean') ? body.on : on;
    press(sel[verb], wantOn);
    if (verb === 'like' && wantOn) press(sel.dislike, false);
    if (verb === 'dislike' && wantOn) press(sel.like, false);
  }

  /* ── A WRITE WAITING IN THE OUTBOX HAS A SCREEN THAT IS WAITING FOR IT (PLAN G6) ───────────────────────────────────────
     `OW.outbox.watch(id, sent, failed)`: the id is `pending_id` from a queued write. When the write lands, `sent(detail)` runs
     (detail.result is the server's own answer) and every screen is told the thing changed (OW.changes.wrote); when the server
     refuses it, or it never gets through, `failed(words)` runs and the screen puts back what it showed and says why. One
     registry, so no flow keeps its own listeners and none can forget the second ending. */
  OW.outbox = OW.outbox || {};
  (function () {
    var waiting = {};
    OW.outbox.watch = function (id, sent, failed) { if (id) waiting[id] = { sent: sent || null, failed: failed || null }; };
    OW.outbox.waiting = function () { return Object.keys(waiting).length; };
    try {
      global.addEventListener('ow:outbox-sent', function (e) {
        var d = (e && e.detail) || {}, w = waiting[d.id];
        if (!w) return;
        delete waiting[d.id];
        try { if (w.sent) w.sent(d); } catch (_) {}
        try { OW.changes && OW.changes.wrote && OW.changes.wrote(d.path || '', d.method || 'POST'); } catch (_) {}
      });
      global.addEventListener('ow:outbox-failed', function (e) {
        var d = (e && e.detail) || {}, w = waiting[d.id];
        if (!w) return;
        delete waiting[d.id];
        try { if (w.failed) w.failed(String(d.why || 'That did not go through.')); } catch (_) {}
      });
    } catch (_) {}
  })();
  var toldWaiting = false;
  function toldOnce() {
    if (toldWaiting || !OW.toast) return;
    toldWaiting = true;
    OW.toast('Saved on this device. It will send when you are back online.', { tone: 'ok' });
    try { global.addEventListener('online', function () { toldWaiting = false; }, { once: true }); } catch (_) {}
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

    /* ── NOBODY IS SIGNED IN (founder/769: "Look around first" is a guest) ──────────────────────────────────────────
       What a guest may do (a like, a dislike: `spec.guest`) is kept on this device, kept when the App is closed, and
       counts as theirs when they sign in (founder/770; offline.js waits on it until someone does). Anything else a guest
       presses (comment, repost, save) brings up the sign-in screen, which returns here. */
    var signedIn = !!((data.token && data.token()) || (data.sendsHeader && !data.sendsHeader()));   /* the one reader's word */
    if (!signedIn) {
      if (spec.guest && OW.offline && OW.offline.keepable) {
        return OW.offline.keepable(spec.method || 'POST', path).then(function (may) {
          if (!may) return { ok: false, queued: false };
          return OW.offline.queue(path, payload, { method: spec.method || 'POST', key: OW.offline.keyFor(spec.method || 'POST', path),
                                                   label: spec.guestLabel || 'Your like', guest: true });
        }).then(function (q) {
          if (!q || !q.queued) { actState(btn, wasOn ? 'on' : 'off'); btn.setAttribute('aria-pressed', String(wasOn)); return q || { ok: false }; }
          actState(btn, on ? 'on' : 'off');
          btn.setAttribute('data-pending', q.pending_id || '1');
          try { syncControls(path, on, payload); } catch (e) {}
          if (!OW.__guestTold) { OW.__guestTold = true; if (OW.toast) OW.toast('Kept on this device. It counts when you sign in.'); }
          return q;
        });
      }
      btn.setAttribute('aria-pressed', String(wasOn)); actState(btn, wasOn ? 'on' : 'off');
      global.location.href = '/login.html?next=' + encodeURIComponent(global.location.pathname + global.location.search + global.location.hash);
      return Promise.resolve({ ok: false, signin: true });
    }

    /* SOME ACTS ARE NOT POSTS. `oneway.graph` undoes a block with DELETE on the
       same path, which is the correct shape for it — and a toggle helper that
       can only POST forces every such control to be hand-rolled beside this one
       and drift from it. One writer, which takes a verb. */
    var verb = on ? (spec.method || 'POST') : (spec.undoMethod || spec.method || 'POST');

    return data.post(path, payload, { method: verb, queueable: true }).then(function (r) {
      /* ── WRITTEN DOWN, NOT YET SENT (PLAN G6): it shows at once, and it says it is waiting ──────────────────
         The network did not answer, the write is in the outbox with its key, and it will land exactly once when the network is
         back. The control keeps the state the person pressed (a like that waits is still a like on their screen), carries
         `data-pending` so a surface can show it is not yet the server's, and is put back, with the reason, only if the server
         refuses it later (`ow:outbox-failed`). `ok` stays false: nothing here claims the server accepted it. */
      if (r.queued) {
        actState(btn, on ? 'on' : 'off');
        btn.setAttribute('data-pending', r.pending_id || '1');
        try { syncControls(path, on, payload); } catch (e) {}
        OW.outbox.watch(r.pending_id,
          function () { btn.removeAttribute('data-pending'); },
          function (words) {
            if (btn.isConnected !== false) {
              btn.removeAttribute('data-pending');
              btn.setAttribute('aria-pressed', String(wasOn));
              btn.textContent = was;
              actState(btn, wasOn ? 'on' : 'off');
              try { syncControls(path, wasOn, payload && typeof payload.on === 'boolean' ? Object.assign({}, payload, { on: wasOn }) : payload); } catch (e) {}
            }
            if (OW.toast) OW.toast(words);
          });
        toldOnce();
        return r;
      }
      if (r.ok) {
        actState(btn, on ? 'on' : 'off');
        data.invalidate(spec.invalidate || '/api/me');
        /* the same post drawn elsewhere on this page (the feed behind its own room) is kept in step */
        try { syncControls(path, on, payload); } catch (e) {}
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
  /* THE TOAST ITSELF LIVES IN THE SHARED MATERIAL (frontend/shared/oneway-popit.js), so the App and the OS say an alert
     in the one gray box (S23); this file only uses it. */

  /* S23 (the founder, 2026-10-11): an alert about an interaction is a SYSTEM NOTIFICATION, never a mark on the
     interaction: "any alerts appearing on the interaction itself, they should appear as system notifications ...
     little gray boxes like other platforms that pop up when there's an error." `OW.say` wrote a line beside the
     control; it is now the toast, said as a sentence, and `near` is only where it was pressed. One bar, one place. */
  OW.say = function (near, msg, opts) {
    var t = String(msg || '').trim();
    if (!t || !OW.toast) return;
    t = t.charAt(0).toUpperCase() + t.slice(1);
    OW.toast(/[.!?\u2026]$/.test(t) ? t : t + '.', opts);
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
    d.appendChild(OW.globe({ size: 108, label: 'Oneway' }));
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
    logo.setAttribute('alt', 'Oneway'); logo.setAttribute('width', '132');
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
    /* founder/786: "the sign in buttons should have the same" outline the sign-in page's buttons wear (.ow-btn--outline) */
    var inb = mk('a', 'po-act ow-btn--outline', 'Sign in');
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
    var back = AWAY.indexOf(f.code) >= 0;
    stateTile(host, 'refused', what || f.title, f.detail + (back ? ' This comes back by itself when Oneway answers.' : ''), '4x1');
    /* only offer a retry where trying again could actually change the answer —
       a retry button on a 403 tells someone to keep knocking on a locked door */
    if (f.retry) {
      var b = mk('button', 'po-act', 'Try again');
      b.type = 'button';
      b.addEventListener('click', function () { global.location.reload(); });
      host.appendChild(b);
    }
    if (back) whenBack(host);
    return 0;
  }
  /* ONEWAY WAS NOT THERE, AND THEN IT WAS (P0 2026-10-17). The founder's "Your feed" said "Something went wrong" after the
     server restarted under it and stayed so with the server answering again, until a press. A block that failed only
     because Oneway could not be reached (nothing answered, the front door's 502 or 504, a 503) asks Oneway's health about
     every few seconds, longer each time, and when it answers does what Try again does. Not over a person's unsent words:
     with something typed on the page it only says Oneway is back. It stops when the block is gone from the page. */
  var AWAY = ['unreachable', 'offline', 'timeout', 'bad_gateway', 'unavailable', 'gateway_timeout'];
  var BACK_ASK_MS = [2000, 3000, 5000, 8000, 13000, 20000, 30000];
  var BACK_ASKS_MAX = 40;                                   /* about twenty minutes of asking, then the button alone */
  var BACK_RELOAD_SPREAD_MS = 4000;                         /* Oneway back: every waiting page reloads within this, not at once */
  var backWatch = null;
  function typing() {
    var els = doc.querySelectorAll('textarea, input[type=text], input:not([type]), [contenteditable=""], [contenteditable=true]');
    for (var i = 0; i < els.length; i++) {
      var v = els[i].value != null ? els[i].value : els[i].textContent;
      if (v && String(v).trim()) return true;
    }
    return false;
  }
  /* each wait is its step plus up to as much again (0-100% jitter, the review's P3 on 41d51ec0), so pages that lost
     Oneway at the same moment do not all ask at the same moment when it returns */
  function backWait(n) { var b = BACK_ASK_MS[Math.min(n, BACK_ASK_MS.length - 1)]; return Math.round(b * (1 + Math.random())); }
  function whenBack(host) {
    if (backWatch) { backWatch.hosts.push(host); return; }
    var w = backWatch = { hosts: [host], n: 0, timer: 0, asking: false };
    function later() { w.timer = global.setTimeout(ask, backWait(w.n)); }
    function ask() {
      /* ONE CHAIN: a timer that is pending is the next ask; 'online' asks now instead of beside it */
      global.clearTimeout(w.timer); w.timer = 0;
      if (w.asking || backWatch !== w) return;
      w.hosts = w.hosts.filter(function (h) { return h.isConnected; });
      if (!w.hosts.length || w.n++ >= BACK_ASKS_MAX) { backWatch = null; return; }
      w.asking = true;
      data.get('/api/health', { fresh: true }).then(function (r) {
        w.asking = false;
        if (!r || !r.ok) { later(); return; }
        backWatch = null;
        if (typing()) {
          w.hosts.forEach(function (h) { var p = h.querySelector('.po-w__note'); if (p) p.textContent = 'Oneway is answering again. Try again when you are ready.'; });
          return;
        }
        global.setTimeout(function () { global.location.reload(); }, Math.round(Math.random() * BACK_RELOAD_SPREAD_MS));
      }, function () { w.asking = false; later(); });
    }
    w.timer = global.setTimeout(ask, backWait(0));
    global.addEventListener('online', function once() { global.removeEventListener('online', once); ask(); });
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
      d.appendChild(OW.globe({ size: 84, label: label || 'Oneway' }));
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
        /* ── SEND TO, SNAPCHAT'S WAY (founder, 2026-10-16: "make it feel like taking a photo with snap and quick
           sending") ── with `pick`, the list is a choice, not a trigger: each person is their face, their name and a
           circle that fills when chosen; one bar across the bottom names who and sends to all of them at once. The
           one-tap rows below stay for every other caller (a Post's own share sheet). */
        if (opts.pick) {
          var chosen = [];
          var list = mk('div', 'ow-sendto__list');
          var bar = mk('div', 'ow-sendto__bar');
          var who = mk('span', 'ow-sendto__names', '');
          var go = mk('button', 'ow-btn ow-sendto__go', 'Send'); go.type = 'button';
          bar.appendChild(who); bar.appendChild(go);
          var paintBar = function () {
            bar.hidden = !chosen.length;
            who.textContent = chosen.map(function (d) { return d.label || 'them'; }).join(', ');
            go.textContent = chosen.length > 1 ? 'Send to ' + chosen.length : 'Send';
          };
          dests.forEach(function (d) {
            var b = mk('button', 'ow-sendto__p'); b.type = 'button';
            b.setAttribute('role', 'checkbox'); b.setAttribute('aria-checked', 'false');
            var face = mk('span', 'ow-sendto__face');
            if (OW.cards && OW.cards.fill) OW.cards.fill(face, { kind: (d.kind === 'center' || /^center:/.test(d.id || '')) ? 'center' : 'person',
                                                               name: d.label || '', picture: d.picture || d.image || '' });
            b.appendChild(face);
            b.appendChild(mk('span', 'ow-sendto__who', esc(d.label || d.id)));
            b.appendChild(mk('span', 'ow-sendto__tick', ''));
            if (d.available === false) { b.disabled = true; b.title = d.unavailable_reason || 'cannot be sent to'; }
            b.addEventListener('click', function () {
              var i = chosen.indexOf(d);
              if (i < 0) chosen.push(d); else chosen.splice(i, 1);
              b.setAttribute('aria-checked', String(i < 0));
              paintBar();
            });
            list.appendChild(b);
          });
          go.addEventListener('click', function () {
            if (!chosen.length) return;
            go.disabled = true; go.textContent = 'Sending…';
            var sent = [], failed = [];
            chosen.reduce(function (p, d) {
              return p.then(function () {
                return data.post('/api/oneway/sharing/to-conversation', {
                  conversation_id: d.conversation_id, subject_type: kind, subject_id: id
                }).then(function (rr) { (rr.ok ? sent : failed).push(d); });
              });
            }, Promise.resolve()).then(function () {
              data.invalidate('/api/oneway/messaging');
              if (failed.length && OW.toast) OW.toast('Not sent to ' + failed.map(function (d) { return d.label || 'them'; }).join(', ') + '. Try again.');
              if (sent.length && opts.onSentAll) opts.onSentAll(sent);
              chosen = failed.slice();
              [].forEach.call(list.children, function (row, k) { row.setAttribute('aria-checked', String(chosen.indexOf(dests[k]) >= 0)); });
              go.disabled = false; paintBar();
            });
          });
          panel.appendChild(list);
          panel.appendChild(bar);
          paintBar();
          return dests.length;
        }
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
                   this no longer has to guess which one arrived. S23: said as the toast. */
                if (OW.toast) OW.toast('Not sent. ' + (rr.error || 'Try again.'));
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
  /* ── THE DOUBLE TAP THAT STILL OPENED THE POST, FIXED AT THE ROOT (the founder, 2026-10-09: "fix the double tap to
     like bug opening posts, multiple attempts have been made on the issue before to no prevail ... users can 2 tap
     anywhere on the post to like it ... ideally it knows just one press means open post after a sec").
     A double tap is two clicks, and EACH click asked for an open. The guard was stamped at the second pointerdown
     and compared with each click's own time minus 40 ms, so the second click's open (scheduled 50-150 ms after its
     pointerdown on a phone) was never cancelled, and the Post opened 300 ms after the like. Now one open waits per
     card: a second click inside the window cancels the waiting open instead of adding its own, and any open still
     waiting gives up if a double tap landed after it was asked for. */
  var OPEN_AFTER_MS = 300, DOUBLE_GUARD_MS = 600;
  OW.openAfterTap = function (fn, key) {
    var k = key || doc, at = (global.performance || Date).now();
    if (k.__owTapWait) { global.clearTimeout(k.__owTapWait); k.__owTapWait = 0; return; }
    if (OW.tapGuard && at - OW.tapGuard < DOUBLE_GUARD_MS) return;      /* the second press of a double tap */
    k.__owTapWait = global.setTimeout(function () {
      k.__owTapWait = 0;
      if (OW.tapGuard >= at) return;      /* a double tap landed while this waited */
      fn();
    }, OPEN_AFTER_MS);
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
                       + '[data-po-center], [data-po-product], a, input, textarea')) return null;

    /* ANYWHERE ON THE POST (the founder, 2026-10-09: "users can 2 tap anywhere on the post to like it"): the words,
       the picture, the space between. Only the controls, links and faces above keep their own taps. */
    return target.closest('.po-card[data-po-id]');
  };

  /* DOES THIS LIKE ZONE ALSO OPEN? Only the text-Post case does, and only it
     pays the wait. One function so the gesture and the open cannot disagree
     about which case they are in — the same reason `likeZone` is shared. */
  /* EVERY ZONE OPENS, AFTER THE BEAT (one press = open the Post a moment later; two = like it, never open), except
     the picture in the full-screen Scroll, where a tap on the media is the viewer's own and never an open. */
  OW.likeZoneOpens = function (zone, target) {
    if (!zone) return false;
    if (target && target.closest && doc.documentElement.getAttribute('data-ow-view') === 'immersive'
        && target.closest('.po-card__media, .po-card__cover, .po-shots')) return false;
    return true;
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
      /* the double tap's bloom is the like the person chose (OW.likes): a heart, or a thumbs up */
      n.innerHTML = OW.glyph((OW.likes && OW.likes.glyph()) || 'heart');
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
        }, cv.closest('.po-card') || cv);
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
      /* ── THE NUMBER MOVES WITH THE PRESS (the founder, 2026-10-09: "make sure things like live like counters and
         allat is working ... ULTRA CONSITANTLY"). Measured that day: a like turned the heart on and its count stayed
         at 0, because every tally was painted only from the live bus, and the bus was not watching that card. Now the
         press moves its own number and the cleared opinion's at once; the server's answer then paints the true counts
         on every copy of this Post on screen (OW.realtime.paintCounts); a refusal puts the numbers back. */
      var wasOn = r.getAttribute('aria-pressed') === 'true';
      var before = [];
      function bump(btn, d) {
        var b = btn.querySelector('b');
        if (!b || btn.closest('[data-counts-hidden]')) return;
        before.push([b, b.textContent]);
        b.textContent = String(Math.max(0, (parseInt(b.textContent, 10) || 0) + d));
      }
      bump(r, wasOn ? -1 : 1);
      sibs.forEach(function (x) { if (x[1] === 'true') bump(x[0], -1); });
      /* THE SMASH (the founder: "with a smash of an animation"): a like pops, overshoots and settles, once */
      if (!wasOn && verb === 'like') {
        r.classList.remove('is-smash'); void r.offsetWidth; r.classList.add('is-smash');
        global.setTimeout(function () { r.classList.remove('is-smash'); }, 700);
      }
      /* the control says what it is answering; `gallery` remains the default
         so every existing caller behaves exactly as before */
      var okind = r.getAttribute('data-okind') || 'post';
      var pr = OW.act(r, { path: '/api/objects/' + encodeURIComponent(okind) + '/' + id + '/respond',
        guest: verb === 'like' || verb === 'dislike',      /* what a guest may do (founder/769) */
        /* the DESIRED state, not a flip — so a retry after a dropped reply
           cannot undo the press (see OW.act) */
        body: function (on) { return { type: verb, on: on }; },
        invalidate: FEED_READS });
      /* A REFUSED ANSWER PUTS THE OTHER ONE BACK. OW.act restores the pressed
         control; the sibling it cleared (the heart, when "Not for me" was
         refused) was left dark while the server still held the like
         (founder/502 sweep). */
      if (pr && pr.then) pr.then(function (res) {
        var counts = res && res.ok && res.data && res.data.responses && res.data.responses.counts;
        if (counts && OW.realtime && OW.realtime.paintCounts) OW.realtime.paintCounts(id, counts);
        if (res && !res.ok && !res.queued) {
          sibs.forEach(function (x) {
            x[0].setAttribute('aria-pressed', x[1] || 'false');
            x[0].setAttribute('data-act', x[2] || 'off');
          });
          before.forEach(function (x) { x[0].textContent = x[1]; });
        }
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
        body: function (on) { return { on: on }; },      /* the DESIRED state, not a flip (PLAN G6) */
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
        body: function (on) { return { on: on }; },      /* the DESIRED state, not a flip (PLAN G6) */
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
      var waits = zone && OW.likeZoneOpens && OW.likeZoneOpens(zone, e.target);
      if (zone && !waits) return;
      var pid = card.getAttribute('data-po-id');
      if (!pid || typeof global.openPost !== 'function') return;
      var r = card.getBoundingClientRect();
      var origin = { node: card, rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                     at: { x: e.clientX, y: e.clientY } };
      var enter = function () { global.openPost(pid, origin); };
      if (waits && OW.openAfterTap) { OW.openAfterTap(enter, card); return; }
      enter();
    });
  };




















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
  /* ── WHAT CONNECTING LETS ONEWAY DO, AGREED FIRST (founder, chat 2026-10-04: "make a
     disclaimer to each permission before they authorize it and why they use it and have them
     agree to it on our end first, then they are able to connect") ──────────────────────────
     Before a platform is asked for anything, every permission ONEWAY will ask it for is shown
     in words with WHY, and each needs its own agreement. Drawn inline under the row (S2: no
     box over the page). The server holds the same gate (distribution/permissions.py): a
     connect without this agreement is refused 409, so this step cannot be skipped by a
     different screen. Resolves true when the person has agreed (or already had), false when
     they cancel or it could not be read. */
  function permBtn(label) {                 /* the Connect button's own look (po-act ow-reach__go, in the platform's hue) */
    var b = mk('button', 'po-act ow-reach__go', esc(label));
    b.type = 'button';
    b.style.setProperty('--h', 'var(--ow-h1)'); b.style.setProperty('--h2', 'var(--ow-h2)');
    return b;
  }
  function reachAgree(t, host2, note) {
    function say(m) { if (note) note.textContent = m || ''; }
    var path = '/api/oneway/distribution/permissions/' + encodeURIComponent(t.key) + '?center_id=' + encodeURIComponent(t.center);
    return data.get(path, { fresh: true }).then(function (r) {
      var d = (r && r.ok && r.data) || null;
      if (!d) { say('That could not be read just now. Nothing was connected.'); return false; }
      if (d.agreed || !(d.items || []).length) return true;
      return new Promise(function (resolve) {
        var old = host2.querySelector('.ow-perm');
        if (old) old.parentNode.removeChild(old);
        var box = mk('div', 'ow-perm');
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', 'What connecting ' + t.label + ' lets Oneway do');
        var ticked = {}, go = permBtn('Agree and connect');
        go.disabled = true;
        function sync() {
          var all = d.items.every(function (i) { return ticked[i.key]; });
          go.disabled = !all;
        }
        d.items.forEach(function (i) {
          /* a yes is a dot: the words lead, a ring fills when you agree, the whole row is the target */
          var row = mk('button', 'ow-agree');
          row.type = 'button'; row.setAttribute('aria-pressed', 'false');
          row.innerHTML = '<span class="ow-agree__b"><b>' + esc(i.what) + '</b><span>' + esc(i.why)
            + '</span></span><span class="ow-agree__k" aria-hidden="true"></span>';
          row.addEventListener('click', function () {
            ticked[i.key] = !ticked[i.key];
            row.setAttribute('aria-pressed', String(!!ticked[i.key]));
            sync();
          });
          box.appendChild(row);
        });
        var act = mk('div', 'ow-reach__formrow');
        var cancel = mk('button', 'po-act po-act--ghost', 'Cancel'); cancel.type = 'button';
        cancel.style.setProperty('--h', 'var(--ow-h1)'); cancel.style.setProperty('--h2', 'var(--ow-h2)');
        act.appendChild(go); act.appendChild(cancel); box.appendChild(act);
        cancel.addEventListener('click', function () { box.parentNode && box.parentNode.removeChild(box); say(''); resolve(false); });
        go.addEventListener('click', function () {
          go.disabled = true;
          data.post('/api/oneway/distribution/permissions/' + encodeURIComponent(t.key) + '/agree',
                    { center_id: t.center, agreed: d.items.filter(function (i) { return ticked[i.key]; }).map(function (i) { return i.key; }) })
            .then(function (a) {
              if (!a || !a.ok) { go.disabled = false; say((a && a.error) || 'That did not save. Nothing was connected.'); return; }
              box.parentNode && box.parentNode.removeChild(box);
              resolve(true);
            }, function () { go.disabled = false; say('That did not reach the server. Nothing was connected.'); });
        });
        host2.appendChild(box);
        say('');
        try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      });
    }, function () { say('That could not be read just now. Nothing was connected.'); return false; });
  }
  function reachForm(t, host2, done) {
    var open = host2.querySelector('.ow-reach__form, .ow-perm');
    if (open) { open.parentNode.removeChild(open); return; }
    return reachAgree(t, host2).then(function (ok) { if (ok) reachFormBuild(t, host2, done); });
  }
  function reachFormBuild(t, host2, done) {
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
            said.textContent = d.words || ('Approve Oneway on your ' + t.label + ' server.');
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
    var row = note.closest ? note.closest('.ow-reach__row') : null, slot = null;
    if (row) {
      slot = row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('ow-reach__slot') ? row.nextSibling : null;
      if (!slot) { slot = mk('div', 'ow-reach__slot'); row.parentNode.insertBefore(slot, row.nextSibling); }
      var open = slot.querySelector('.ow-perm');
      if (open) { open.parentNode.removeChild(open); note.textContent = ''; return Promise.resolve(); }
    }
    return reachAgree(t, slot || note.parentNode, note).then(function (ok) {
      if (!ok) return;
      note.textContent = 'Opening ' + t.label + '…';
      return reachGo(t, note);
    });
  }
  function reachGo(t, note) {
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



















  /* ── THE OTHER TWO HALVES OF THE SAME EXTRACTION ────────────────────────
     `CO_STEPS` and `coKind` were left in app/create/create.js by the same move
     that split the shrink unit above, and they fail the SAME way: the composer
     paints its step rail from CO_STEPS and classifies an imported URL with
     coKind, both from this file, both declared eight scripts later. Fixing
     `coShrink` alone would have moved the crash from "Choose" to the step rail
     — which is why the whole set moved in one pass rather than one name at a
     time. Nothing outside this file reads either one. */
  var CO_STEPS = ['Make', 'Review', 'Describe', 'Where', 'Send'];









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

  /* A DECISION IS ANSWERED WHERE IT IS SHOWN, WITH ONE SET OF BUTTONS (brain/durable `mine`; GET/POST /api/oneway/me/decisions).
     Lifted from Workspace (2026-10-16, R10) so Settings > Supervision shows a parent's invitations and a teen's asks with the
     same card and the same one door, never a second approve button: the buttons Messages' requests use (`po-act`); a
     refusal is the toast (S23), in the door's words, and the buttons come back; an answer takes their place with what was
     answered, and a message accepted opens its conversation, as the requests tray does. `done(choice)` is told after. */
  function decisionActs(dec, card, done) {
    var acts = mk('div', 'ow-req__acts');
    var btns = (dec.choices || []).map(function (ch, i) {
      var b = mk('button', i === 0 ? 'po-act po-act--go' : 'po-act', esc(ch.words)); b.type = 'button';
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.disabled = true; });
        acts.setAttribute('data-busy', '1');
        data.post('/api/oneway/me/decisions/answer', { id: dec.id, answer: ch.id }).then(function (r) {
          acts.removeAttribute('data-busy');
          if (!r.ok) {
            btns.forEach(function (x) { x.disabled = false; });
            if (OW.toast) OW.toast(r.error || 'That could not be answered just now.');
            return;
          }
          card.setAttribute('data-decided', ch.id);
          acts.innerHTML = '';
          acts.appendChild(mk('span', 'ow-req__done', esc(ch.words)));
          var conv = ((r.data || {}).outcome || {}).conversation_id;
          if (conv) global.setTimeout(function () { global.location.hash = '#messages/' + encodeURIComponent(conv); }, 260);
          if (done) done(ch);
        });
      });
      acts.appendChild(b);
      return b;
    });
    if (!btns.length && dec.may_not) acts.appendChild(mk('span', 'ow-req__done', esc(dec.may_not)));
    return acts;
  }

  /* ── A TEEN'S TIME, TOLD AT THE LIMIT, NEVER CUT (PLAN R10; people/usage.py; founder/785, 658) ─────────────────────
     The App says its screen is open about once a minute while it is visible (POST /api/oneway/me/usage/beat); the server
     counts the minutes of its own clock. An adult's answer is {metered: false}: nothing is stored and this page asks no
     more. At the limit the answer's own words are said in a line on the page (no modal: S20), with the one choice, Keep
     going (POST /api/oneway/me/usage/keep-going), and the App keeps working whatever is chosen. A line put away is not
     said again that day on this device; the recap is Settings > Supervision. */
  var USAGE_BEAT_MS = 60000;
  var usage = { last: null, timer: 0, off: false, at: 0 };
  function usageDay() { try { return new Date().toDateString(); } catch (_) { return ''; } }
  function usageLine(a) {
    var host = doc.querySelector('.ow-main');
    var line = doc.querySelector('.ow-time');
    var put = (function () { try { return global.localStorage.getItem('ow_time_put_away') === usageDay(); } catch (_) { return false; } })();
    if (!host || !a || !a.metered || !a.reached || a.kept_going || put) { if (line) line.remove(); return; }
    if (!line) {
      line = mk('div', 'ow-time');
      line.setAttribute('role', 'status');
      line.appendChild(mk('p', 'ow-time__w'));
      var acts = mk('div', 'ow-time__acts');
      var go = mk('button', 'ow-btn', 'Keep going'); go.type = 'button';                 /* Settings' own buttons (S20) */
      var away = mk('button', 'ow-btn ow-btn--quiet', 'Not now'); away.type = 'button';
      go.addEventListener('click', function () {
        go.disabled = true;
        data.post('/api/oneway/me/usage/keep-going', {}).then(function (r) {
          go.disabled = false;
          if (!r.ok) { if (OW.toast) OW.toast(r.error || 'That could not be saved just now.'); return; }
          usage.last = r.data || usage.last;
          line.remove();
          if (OW.toast) OW.toast('Kept going for today.', { tone: 'ok' });
        });
      });
      away.addEventListener('click', function () {
        try { global.localStorage.setItem('ow_time_put_away', usageDay()); } catch (_) {}
        line.remove();
      });
      acts.appendChild(go); acts.appendChild(away);
      line.appendChild(acts);
      host.insertBefore(line, host.firstChild);
    }
    line.querySelector('.ow-time__w').textContent = (a.words || '') + '.';
  }
  function usageBeat() {
    if (usage.off || doc.visibilityState !== 'visible' || !signedIn()) return;
    if (Date.now() - usage.at < USAGE_BEAT_MS - 2000) return;     /* a minute is counted once; asking sooner says nothing new */
    usage.at = Date.now();
    data.post('/api/oneway/me/usage/beat', {}).then(function (r) {
      if (!r.ok) return;
      var a = r.data || {};
      if (a.metered === false) { usage.off = true; global.clearInterval(usage.timer); return; }
      usage.last = a;
      usageLine(a);
      try { doc.dispatchEvent(new CustomEvent('ow:usage', { detail: a })); } catch (_) {}
    });
  }
  OW.usage = {
    start: function () {
      if (usage.timer || usage.off) return;
      usageBeat();
      usage.timer = global.setInterval(usageBeat, USAGE_BEAT_MS);
      doc.addEventListener('visibilitychange', usageBeat);
    },
    last: function () { return usage.last; },
    stopped: function () { return usage.off; },     /* an adult's answer said metered false: no more asking on this page */
    said: usageLine
  };

  OW._u = {
    decisionActs: decisionActs,
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
    refused: refused,
    signedIn: signedIn,
    refreshDaily: refreshDaily,
    token: token,
    whenWords: whenWords,
    postPayload: postPayload,
    imageUrl: imageUrl,
    FEED_READS: FEED_READS,
    hueOf: hueOf,
    leaving: leaving,
    realCategory: realCategory,
    setIcon: setIcon,
    stateTile: stateTile,
    toldOnce: toldOnce
    /* what the boot split moved out (tools/boot_split.mjs) reads these back; composer, postToPlace, beginEmptyPost,
       brainSuggests and beyondOneway are put here by frontend/app/compose/compose.js, before create.js loads */
  };

  global.OW = OW;
})(window);
