/* ONEWAY — THE ONE READER AND WRITER  (frontend/shared/oneway-data.js)

   ★ PLAN G6 and B6 (one of each): every change goes through one writer, which keys it, writes it down when the network is
   gone (frontend/shared/offline.js) and tells every screen (oneway-realtime.js, OW.changes). It lived inside the App
   (popit-live.js), so the OS kept a second writer of its own that did none of that: a change made in the OS with no
   network was simply lost. It lives here now, and both shells load it: the App before popit-live.js, the OS before os.js.

   WHAT IS HERE: the session as a reader sends it (the cookie, or a token where a dev `?api=` origin needs the header), the
   read (deduped, briefly cached, honest about failure and about a cached answer), the write (keyed from its first send,
   queued when it got no answer and the caller can show it waiting), what a refusal says in words, the offline notices,
   and the change bus's door. WHAT IS NOT: a shell's own session at open (the App's renewal stays in popit-live.js, the
   OS's in os.js), which differ in where a signed-out person is sent. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  if (OW.data) return;
  var doc = global.document;
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

  /* THE SESSION ENDED HERE (PLAN §3.1 SF-6). A 401 to a request that went with a session (the cookie this browser holds,
     or a token) is the server saying there is none any more. What this device kept of that person goes with it, once:
     the outbox and the service worker's copies of their reads (OW.offline.purge), which a signed-out device served
     offline to whoever opened it next. A request sent with no session that is answered 401 is only a visitor. */
  var ended = false;
  function sessionEnded() {
    if (ended) return;
    ended = true;
    try { if (OW.offline && OW.offline.purge) OW.offline.purge(); } catch (_) {}
  }

  /* NOTHING IN FLIGHT ACROSS A RENEWAL (PLAN R22, the founder 2026-10-20: "the app i think needs to be perfect"). A
     renewal ROTATES the session (POST /api/auth/refresh ends the old one at once, on purpose), and the App renews 4 s after
     a load, while the person is already moving: a read sent with the old cookie came back 401 (walked: GET
     /api/oneway/me/footsteps on Discovery, a console error), and a 401 here reads as "signed out" (sessionEnded). So every
     request is counted while it flies, a renewal waits until none is (at most 4 s) and holds every new one until it has
     answered, and a held request builds its session headers when it is finally sent. */
  var flying = 0, renewal = null;
  function lift(send) {
    function go() {
      flying++;
      return send().then(function (r) { flying--; return r; }, function (e) { flying--; throw e; });
    }
    return renewal ? renewal.then(go, go) : go();
  }

  /* ANOTHER TAB RENEWED THE SESSION: the App and the OS share this origin's storage, and a refresh
     in one ends the session the other holds in memory (24ee7de0: a refresh ROTATES). */
  try {
    global.addEventListener('storage', function (e) {
      if (e && (e.key === 'ow_session_token' || e.key === 'ow_tokens')) TOKEN = null;
    });
  } catch (_) {}



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

  /* once per time without a network, in the bar that already says what just happened (OW.toast), not in a new place on the screen;
     and HOW MANY CHANGES WAIT (PLAN G6, the global waiting count): said with it, then said again when they have all gone */
  var staleTold = false;
  function waitingWords(n) { return n === 1 ? '1 change waits to send.' : n + ' changes wait to send.'; }
  function staleOnce() {
    if (staleTold || !OW.toast) return;
    staleTold = true;
    var say = function (n) { OW.toast('You are offline. This is what you last saw.' + (n ? ' ' + waitingWords(n) : ''), { tone: 'ok' }); };
    if (OW.offline && OW.offline.pending) OW.offline.pending().then(function (st) { say((st && st.pending) || 0); }).catch(function () { say(0); });
    else say(0);
    try { global.addEventListener('online', function () { staleTold = false; }, { once: true }); } catch (_) {}
  }
  /* BACK ONLINE, AND EVERYTHING WRITTEN DOWN HAS GONE: said once, when the count of what waited reaches nothing */
  (function () {
    var was = 0;
    function watchOutbox() {
      if (!OW.offline || !OW.offline.onChange) return false;
      OW.offline.onChange(function (st) {
        var n = (st && st.pending) || 0;
        if (was > 0 && n === 0 && (st.failed || 0) === 0 && global.navigator && global.navigator.onLine !== false && OW.toast) {
          OW.toast(was === 1 ? 'Back online. Your change was sent.' : 'Back online. Your ' + was + ' changes were sent.', { tone: 'ok' });
        }
        was = n;
      });
      return true;
    }
    if (!watchOutbox()) global.addEventListener('load', watchOutbox, { once: true });
  })();

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
      if (opts.me != null) global.setTimeout(function () { ownTopic(0); }, 0);
      /* someone is signed in: what was kept on this device (a guest's likes, writes made offline) goes now, as them */
      if (opts.me) global.setTimeout(function () { if (OW.offline && OW.offline.flush) OW.offline.flush(); }, 0);
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
      var held = cookieSession() || !!token();
      function send() {
        var t = token(), h = { 'Accept': 'application/json' };
        if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
        return global.fetch(BASE + path, { headers: h, credentials: 'same-origin' });
      }
      /* A READ THE PAGE ALREADY STARTED (oneway-app.html's early Home read),
         taken once, and only on the same origin it was asked of */
      var early = !BASE && global.__owEarly && global.__owEarly[path];
      if (early) delete global.__owEarly[path];
      var p = (early || lift(send))
        .then(function (r) {
          if (r.status === 401 && held) sessionEnded();
          return r.json().catch(function () { return null; }).then(function (j) {
            /* A CACHED ANSWER SAYS SO (PLAN G6; sw.js labels it `X-OW-From-Cache`). With no network the worker answers a read from
               the last time it was made, and a screen that draws it as if it were now is telling a lie by leaving something out. */
            var stale = !!(r.ok && r.headers && r.headers.get && r.headers.get('X-OW-From-Cache') === '1');
            if (stale) staleOnce();
            var v = r.ok
              ? { ok: true, status: r.status, data: j, cached: stale || undefined }
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
      var t = token(), h = { 'Content-Type': 'application/json', 'Accept': 'application/json' }, held = cookieSession() || !!t;
      if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
      /* ── EXACTLY ONCE STARTS AT THE FIRST ATTEMPT (PLAN G6) ──────────────
         A write the server honours (GET /api/idempotency/honoured: the gateway runs it once per key) carries a key from the very
         first send, and the same key goes into the queue if the answer never comes back. If only the queued copy had a key, an
         attempt that landed and whose answer was lost would land a second time when the queue drained.

         THE CALLER OPTS IN (`queueable: true`), because the caller is the one that can SHOW a waiting write. A surface that does not
         know about `queued` would draw the write as failed while it sits in the outbox, the person would press it again, and
         the second press (a new key) would be a second write. So a write is queued only when the screen that made it says it can
         show it waiting, and only when the server honours it (`OW.offline.keyFor` answers '' for anything it does not). */
      var key = (!opts.queueable || !OW.offline || !OW.offline.keyFor) ? '' : OW.offline.keyFor(opts.method || 'POST', path);
      if (key) h['X-Idempotency-Key'] = key;
      return lift(function () {
        var t2 = token();
        if (t2 && sendsHeader()) { h['X-Session-Token'] = t2; h['Authorization'] = 'Bearer ' + t2; }
        return global.fetch(BASE + path, {
          method: opts.method || 'POST', headers: h, credentials: 'same-origin',
          body: body ? JSON.stringify(body) : '{}'
        });
      }).then(function (r) {
        if (r.status === 401 && held) sessionEnded();
        return r.json().catch(function () { return null; }).then(function (j) {
          if (r.ok) wrote(path, opts.method || 'POST');
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
        if ((opts.queueable || key) && OW.offline && OW.offline.queue) {
          return OW.offline.queue(path, body, {
            method: opts.method || 'POST',
            label: opts.label || '',
            invalidate: opts.invalidate || '',
            key: key
          });
        }
        /* a WRITE that got no answer says so in words — without claiming
           whose fault it was (the read path's rule, above) */
        return { ok: false, status: 0, error: 'Oneway did not answer, so nothing was done. Try again.' };
      });
    },
    /* A RENEWAL, WHEN NOTHING IS IN FLIGHT (above): `renew` is called once every request already sent has its answer (or
       after 4 s), and every request made meanwhile waits for its answer. One at a time: a second asks for the first. */
    renewWhenQuiet: function (renew) {
      if (renewal) return renewal;
      var quiet = new Promise(function (done) {
        var waited = 0;
        (function look() { if (!flying || waited >= 4000) return done(); waited += 50; global.setTimeout(look, 50); })();
      });
      renewal = quiet.then(function () { return renew(); })
        .then(function (v) { renewal = null; return v; }, function (e) { renewal = null; throw e; });
      return renewal;
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
    /* the one rule for a session that ended, for a shell's own reader (the OS's) and its own sign-out */
    sessionEnded: function () { sessionEnded(); },
    invalidate: function (match) {
      Object.keys(cache).forEach(function (k) {
        if (!match || k.indexOf(match) >= 0) delete cache[k];
      });
    }
  };
  OW.data = data;

  /* ═══ A WRITE CHANGES WHAT EVERY SCREEN READ (the founder, 2026-10-10) ═══════════════════════════════════════════
     ★ *"when i save a post why doesnt my favorites popit on my home menu update instantly"*, then *"dont just fix favorites
     do any states that dont update user wide to the platform. if cross projection architecrure doesnt even work in our own
     app, how will it work on the internet"*.

     It was a pattern: each writer named the reads it made stale (`invalidate: FEED_READS`) and a surface that stayed
     mounted (the Home canvas, a page left open) had no way to hear, so each state was one more place to forget. Now:
       · any successful write clears the read cache (a write may change any read; a cache is only an accelerator) and
         announces `ow:changed {path, method}`;
       · the server announces the same write to the person on every other device and tab (`person:<you>`, `changed`:
         oneway/platform/change_announce.py), which arrives here as `ow:wire-changed`, is dropped when this tab's own
         announcement just said it, and otherwise clears the cache and announces `ow:changed {remote:true}`;
       · a surface that must stay true while open says so once: `OW.onChanged(host, refresh)`;
       · the same post drawn twice on one page (the feed behind the post's own room) is kept in step (`ow:responded`).
     A path that is not a change of anything drawn (typing, presence, beacons) is not announced. */
  /* the one translator lives in oneway-realtime.js (OW.changes), so every shell shares it; these are the App's doors to it */
  function wrote(path, method) { if (OW.changes) OW.changes.wrote(path, method); }
  OW.onChanged = function (host, fn, opts) {
    return OW.changes ? OW.changes.on(host, fn, opts) : function () {};
  };
  /* THE PERSON'S OWN TOPIC IS THE SESSION'S: subscribed once identity is known, whichever page opened first */
  function ownTopic(tries) {
    if (!ME) return;
    if (OW.changes && OW.changes.own(ME)) return;
    if ((tries || 0) < 20) global.setTimeout(function () { ownTopic((tries || 0) + 1); }, 300);
  }


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
    /* 502 AND 504 ARE THE FRONT DOOR SAYING ONEWAY DID NOT ANSWER (P0 2026-10-17: the founder's "Your feed" read "Something
       went wrong on Oneway's side" while the server was restarting and nothing behind the door was listening) */
    if (status === 502) return 'Oneway did not answer just now; it may be restarting. Nothing changed.';
    if (status === 504) return 'Oneway took too long to answer. Nothing changed.';
    if (status >= 500) return 'Something went wrong on Oneway\'s side. Nothing changed — try again in a moment.';
    return 'That could not be done. Nothing has changed.';
  }
  function refusalWords(payload, fallback) {
    var d = (payload && typeof payload === 'object' && 'detail' in payload)
      ? payload.detail : payload;
    if (typeof d === 'string' && d.trim()) return sentence(d);
    if (d && typeof d === 'object') {
      /* THE NEW BACKEND'S OWN SENTENCE ({refused, words}): the door said what happened, so that is what is said */
      if (typeof d.words === 'string' && d.words.trim()) return sentence(d.words);
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


  /* WHAT THE SHELLS ASK OF THE SESSION AND OF A REFUSAL, beside the door itself */
  data.cookieSession = cookieSession;
  data.sendsHeader = sendsHeader;
  data.failSaid = failSaid;
  data.failWords = failWords;
  data.refusalWords = refusalWords;
  data.sentence = sentence;
  data.wrote = wrote;
  /* A PICTURE OR A VIDEO, READ AS ITS BYTES (Oneway's editor opens a file already on the platform, founder/831): a Blob,
     or a refusal in words. Same origin, the session's cookie, never cached away from the person; a data: or blob: address
     is read as it is. The one home for a raw read of media, so no surface keeps its own fetch (one_of_each frontend.fetch). */
  data.blob = function (url) {
    var u = String(url || '');
    if (!u) return Promise.reject(new Error('There is nothing here to read.'));
    var full = /^(data:|blob:|https?:)/.test(u) ? u : (BASE + (u.charAt(0) === '/' ? u : '/' + u));
    return global.fetch(full, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('That picture could not be read.');
      return r.blob();
    });
  };
  /* a shell's own session at open renews the session; these are its only handles on what this file holds */
  data._session = { base: function () { return BASE; }, forget: function () { TOKEN = null; }, set: function (t) { TOKEN = t || null; } };
})(typeof window !== 'undefined' ? window : this);
