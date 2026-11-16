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
  /* A VIDEO BEING MADE PLAYABLE SAYS SO WHILE IT RUNS (ask-11; api/media/video.py). An iPhone films HEVC, which most
     browsers cannot play, so the server converts it to H.264 inside the upload. While a video upload is still in flight
     after a moment, this asks GET /api/oneway/media/converting and shows the server's own words ("About 12 seconds left")
     in the toast, until the upload answers. Returns the function that stops it. */
  function videoWait() {
    var done = false, said = false, timer = 0;
    function ask() {
      if (done) return;
      var t = token(), h = { 'Accept': 'application/json' };
      if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
      global.fetch(BASE + '/api/oneway/media/converting', { headers: h, credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var w = j && j.converting && j.converting[0];
          if (!done && w && w.words && OW.toast) { OW.toast(w.words, { tone: 'ok' }); said = true; }
        }, function () {})
        .then(function () { if (!done) timer = global.setTimeout(ask, 1500); });
    }
    timer = global.setTimeout(ask, 1200);
    return function () {
      done = true;
      global.clearTimeout(timer);
      if (said && OW.toast && OW.toast.hide) OW.toast.hide();
    };
  }

  /* ═══ A FILE GOING UP: ONE TABLE, ONE SENTENCE, ONE WAY OF SHOWING IT (blocker M09) ═════════════════════════════════════
     ★ The founder: "uploads are inconsistent across the platform". Measured 2026-11-11 with files made locally: the composer
       refused a video past 44 MB, Messages past 60 MB and the server past 64; the OS said "That image is larger than 5MB."
       where the server said its own words; nothing but Messages showed that a file was still going; and a connection that
       dropped read "Oneway did not answer", as if nothing had been sent.
     So, here, at the one writer every surface of the App and the OS already sends through:
       · UPLOADS is what each door that takes a file takes: the server's own subjects and numbers (api/media/store.py; held
         equal by api/media/test_upload_words.py, which reads this table as data). No caller keeps a number of its own.
       · `tooLarge(door, bytes)` is the server's own sentence, said BEFORE anything is sent, and `post` says it for any
         body that carries a file past its door's size, so a person never waits out an upload that ends in a refusal.
       · a body that carries a file is sent so its progress can be read, and after a moment says how far it has gone
         ("Sending… 42%") in the bar that already says what just happened (OW.toast); a screen that shows it itself (the
         editor's own button) takes it instead by answering the `ow:sending` event.
       · a connection that drops while a file is going says that, and that nothing was saved. */
  var UPLOADS = /*uploads:begin*/[
    {"door": "/api/oneway/media", "what": "Photo or video", "mb": 64},
    {"door": "/api/me/profile-banner", "what": "Banner image", "mb": 8},
    {"door": "/api/canvas/sticker", "what": "Sticker", "mb": 5},
    {"door": "/look", "what": "Picture", "mb": 5}
  ]/*uploads:end*/;
  var SENDING_SHOWN_FROM_BYTES = 262144;    /* a body carrying less than this goes in a moment: nothing to show */
  var SENDING_SAID_AFTER_MS = 700;          /* how long a file is going before the bar says so (a quick one says nothing) */
  function takes(path) {
    var p = String(path || '').split('?')[0];
    for (var i = 0; i < UPLOADS.length; i++) {
      var d = UPLOADS[i].door;
      if (p === d || (d === '/look' && /^\/api\/oneway\/centers\/[^/]+\/look$/.test(p))) return UPLOADS[i];      /* '/look': a Center's look, whichever Center */
    }
    return null;
  }
  function tooLarge(path, bytes, what) {
    var t = takes(path);
    if (!t || !(bytes > t.mb * 1048576)) return '';
    return (what || t.what) + ' is too large. The most this takes is ' + t.mb + ' MB.';
  }
  /* the size of the file inside a data: address, without decoding it */
  function dataBytes(u) {
    var s = String(u || ''), c = s.indexOf(',');
    if (s.slice(0, 5) !== 'data:' || c < 0) return 0;
    var n = s.length - c - 1;
    if (!/;base64/i.test(s.slice(0, c))) return n;
    return Math.floor(n * 3 / 4) - (s.charAt(s.length - 1) === '=' ? (s.charAt(s.length - 2) === '=' ? 2 : 1) : 0);
  }
  /* the files a body carries at its top level: [{key, bytes}] */
  function filesIn(body) {
    var out = [];
    if (body && typeof body === 'object') {
      for (var k in body) {
        if (typeof body[k] === 'string' && body[k].length > 64 && body[k].slice(0, 5) === 'data:') out.push({ key: k, bytes: dataBytes(body[k]) });
      }
    }
    return out;
  }
  /* ONE REQUEST WHOSE PROGRESS CAN BE READ. fetch cannot say how much of a body has gone; this can. It answers what `post`
     reads of a fetch answer (status, ok, json()), carries the session exactly as fetch's same-origin does, and rejects when
     the connection drops, as fetch does. Only `post` calls it, and only for a body that carries a file. */
  function sendFile(url, method, headers, text, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new global.XMLHttpRequest();
      x.open(method, url, true);
      for (var k in headers) { if (Object.prototype.hasOwnProperty.call(headers, k)) x.setRequestHeader(k, headers[k]); }
      if (x.upload) x.upload.onprogress = function (e) { if (e && e.lengthComputable && e.total) onProgress(e.loaded / e.total); };
      x.onload = function () {
        resolve({ status: x.status, ok: x.status >= 200 && x.status < 300,
                  json: function () { try { return Promise.resolve(JSON.parse(x.responseText)); } catch (e) { return Promise.reject(e); } } });
      };
      x.onerror = x.onabort = x.ontimeout = function () { reject(new Error('the connection dropped')); };
      x.send(text);
    });
  }
  /* HOW FAR A FILE HAS GONE, SAID ONCE IT HAS BEEN GOING A MOMENT. `at(fraction)` as it goes, `end()` when it is answered. */
  function sending(path) {
    var frac = 0, shown = false, done = false, last = 0, mine = '';
    function say() {
      if (done) return;
      var claimed = false;
      try {
        var ev = new global.CustomEvent('ow:sending', { cancelable: true, detail: { path: path, fraction: frac } });
        claimed = !doc.dispatchEvent(ev);                    /* a screen that shows it itself answers preventDefault() */
      } catch (_) {}
      if (claimed || !OW.toast) return;
      mine = frac >= 1 ? 'Finishing\u2026' : 'Sending\u2026 ' + Math.round(frac * 100) + '%';
      if (shown && OW.toast.say && OW.toast.say(mine)) return;
      OW.toast(mine, { tone: 'ok', hold: true });
      shown = true;
    }
    var timer = global.setTimeout(function () { timer = 0; say(); }, SENDING_SAID_AFTER_MS);
    return {
      at: function (f) {
        frac = Math.max(0, Math.min(1, f || 0));
        var now = Date.now();
        if (!timer && (frac >= 1 || now - last > 200)) { last = now; say(); }
      },
      end: function () {
        done = true;
        global.clearTimeout(timer);
        try { doc.dispatchEvent(new global.CustomEvent('ow:sending', { detail: { path: path, fraction: 1, done: true } })); } catch (_) {}
        /* only the bar this put up, and only while it still says this file's words: another message is never taken down */
        if (shown && OW.toast && OW.toast.hide && (!OW.toast.said || OW.toast.said() === mine)) OW.toast.hide();
      }
    };
  }

  /* THE SESSION ENDED HERE (PLAN §3.1 SF-6). A 401 to a request that went with a session (the cookie this browser holds,
     or a token) is the server saying there is none any more. What this device kept of that person goes with it, once:
     the outbox and the service worker's copies of their reads (OW.offline.purge), which a signed-out device served
     offline to whoever opened it next. A request sent with no session that is answered 401 is only a visitor. */
  /* AND THE PAGE IS TOLD, ONCE (app-baseline V2; the walker's baseline 2026-11-14: after the server restarted, Home still greeted him
     by name and Post said "Not posted. no one is signed in." with no way back but signing in again by hand). A 401 from any
     other door is asked about once, through the one reader of who is signed in (/api/auth/me, as the realtime stream's refusal
     is), before it is believed: a door may answer 401 for its own reason (a wrong password asked again), and a read that crossed
     a renewal may too. When /api/auth/me itself answers 401 the session has ended: what this device kept goes (above), and
     `ow:signed-out` is announced, so the App can keep what the person was writing and take them to sign in. */
  var ended = false, asking = false, WHO_PATH = '/api/auth/me';
  function sessionEnded(path) {
    if (ended) return;
    if (path && path !== WHO_PATH) {
      if (asking) return;
      asking = true;
      data.get(WHO_PATH, { fresh: true }).then(function () { asking = false; }, function () { asking = false; });
      return;
    }
    ended = true;
    try { if (OW.offline && OW.offline.purge) OW.offline.purge(); } catch (_) {}
    try { doc.dispatchEvent(new global.CustomEvent('ow:signed-out', { detail: { path: path || '' } })); } catch (_) {}
  }

  /* NOTHING IN FLIGHT ACROSS A RENEWAL (PLAN R22, the founder 2026-10-20: "the app i think needs to be perfect"). A
     renewal ROTATES the session (POST /api/auth/refresh ends the old one at once, on purpose), and the App renews 4 s after
     a load, while the person is already moving: a read sent with the old cookie came back 401 (walked: GET
     /api/oneway/me/footsteps on Discovery, a console error), and a 401 here reads as "signed out" (sessionEnded). So every
     request is counted while it flies, a renewal waits until none is and holds every new one until it has answered,
     and a held request builds its session headers when it is finally sent.
     NO CAP ON THE WAIT (the staging walk, 2026-10-20: once in three fresh walks at 390, Messages' GET
     /api/oneway/me/push came back 401 and read as signed out). The wait stopped at 4 s with requests still flying, and on a
     busy server a read sent before that mark was taken up after the refresh had ended the old session. So the renewal
     starts at the first moment nothing is in flight (decided in the same turn as the last answer, so nothing can slip
     between); new requests keep going out while it waits, so a slow one never stalls the App; and if the App is never
     quiet for 30 s, this renewal is put off (its promise answers `false`, "not renewed now") and the session it has
     stands. Long-lived streams (the realtime stream) do not come through here and are never counted. */
  var flying = 0, renewal = null, waiting = null;
  function landed() { flying--; if (!flying && waiting) begin(waiting); }
  function lift(send) {
    function go() {
      flying++;
      return send().then(function (r) { landed(); return r; }, function (e) { landed(); throw e; });
    }
    return renewal ? renewal.then(go, go) : go();
  }
  function begin(w) {
    if (waiting === w) waiting = null;
    global.clearTimeout(w.timer);
    /* set in this turn, so every request asked for from here on waits for the renewal's answer */
    renewal = Promise.resolve().then(w.renew)
      .then(function (v) { renewal = null; return v; }, function (e) { renewal = null; throw e; });
    renewal.then(w.ok, w.no);
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

  /* ═══ READ IT BEFORE IT IS PRESSED (founder/1303: "it should be preloading the post before the post shows, and it should feel instant") ═══════════
     `cached(path)`: a fresh answer is held for this read, so a surface that has it draws at once with no waiting state at all.
     `ahead(paths, {idle})`: reads that a person is likely to open next, taken through the same `get` (same key, same dedupe, so the press that follows
     finds the answer or the read already flying: no second request), held a little longer than a plain read (AHEAD_TTL).
     NEVER WHEN IT COSTS THE PERSON: not with the data saver on (the setting, or the browser's), not on a 2g line, not in a hidden tab, and at most
     AHEAD_PARALLEL at once, so a read ahead never queues in front of the page the person is on. It adds no server cost an open does not already pay
     (the same read, earlier, once: test_open_ratchet counts the server's open, which this does not touch). */
  var AHEAD_TTL = 45000, AHEAD_PARALLEL = 2, aheadQueue = [], aheadBusy = 0;
  function saving() {
    var c = global.navigator && global.navigator.connection;
    return !!((OW.prefs && OW.prefs.dataSaver) || (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) || (global.document && global.document.hidden));
  }
  function aheadPump() {
    while (aheadBusy < AHEAD_PARALLEL && aheadQueue.length) {
      var path = aheadQueue.shift();
      if (data.cached(path) || inflight[path] || saving()) continue;
      aheadBusy++;
      (function (p) {
        data.get(p).then(function (v) { aheadBusy--; if (v && v.ok && cache[p]) cache[p].ttl = AHEAD_TTL; aheadPump(); });
      })(path);
    }
  }
  /* A READ ANOTHER READ ALREADY ANSWERED (feed speed, 2026-11-10: "I need speed big time"): a feed page carries each post whole, so a
     card's own read is put here from it, never asked of the network one card at a time (the page made per-post calls, 6 on the first
     screen, N+1 down the feed). The one cache, so any write or a change heard from elsewhere clears it as it clears every read; never over
     an answer that is younger or a read in flight; held PRIME_TTL, then asked again as any read is. */
  var PRIME_TTL = 180000;
  var data = {
    prime: function (path, answer, ttl) {
      if (!path || !answer || inflight[path] || data.cached(path)) return false;
      cache[path] = { at: Date.now(), v: { ok: true, status: 200, data: answer, primed: true }, ttl: ttl || PRIME_TTL };
      return true;
    },
    cached: function (path) { var c = cache[path]; return !!(c && c.v && c.v.ok && (Date.now() - c.at) < (c.ttl || TTL)); },
    ahead: function (paths, opts) {
      if (saving()) return 0;
      var list = (paths || []).filter(function (p) { return p && !data.cached(p) && !inflight[p] && aheadQueue.indexOf(p) < 0; });
      if (!list.length) return 0;
      var run = function () { aheadQueue = aheadQueue.concat(list); aheadPump(); };
      if (opts && opts.idle) {
        if (global.requestIdleCallback) global.requestIdleCallback(run, { timeout: 2500 }); else global.setTimeout(run, 700);
      } else run();
      return list.length;
    },
    asset: assetUrl,
    /* the data saver, a 2g line or a hidden tab: nothing is read or fetched ahead of a press (what `ahead` itself asks; Discovery's map hints ask it too) */
    saving: saving,
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
    /* `opts.hold` (ms): an answer this young is still the truth for this caller (Settings holds its reads for the visit, polish P036). It is
       the one cache, so a write here or on another device (OW.changes, `ow:changed`) clears it all the same: a hold never outlives a change.
       Only an answer is held; a refusal or a failure is asked again as any read's is. */
    get: function (path, opts) {
      opts = opts || {};
      var key = path;
      var now = Date.now();
      var held = opts.hold && cache[key] && cache[key].v && cache[key].v.ok ? opts.hold : 0;
      if (!opts.fresh && cache[key] && (now - cache[key].at) < (held || cache[key].ttl || TTL)) {
        return Promise.resolve(cache[key].v);
      }
      if (inflight[key]) return inflight[key];
      var held = cookieSession() || !!token();
      function send() {
        var t = token(), h = Object.assign({ 'Accept': 'application/json' }, opts.headers);   /* `opts.headers`: a door that asks for one of its own (a guest's key to their line) */
        if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
        return global.fetch(BASE + path, { headers: h, credentials: 'same-origin' });
      }
      /* A READ THE PAGE ALREADY STARTED (oneway-app.html's early Home read),
         taken once, and only on the same origin it was asked of */
      var early = !BASE && global.__owEarly && global.__owEarly[path];
      if (early) {
        delete global.__owEarly[path];
        /* it has been flying since the page began: counted from here, so a renewal waits for it too */
        flying++;
        early = early.then(function (r) { landed(); return r; }, function (e) { landed(); throw e; });
      }
      var p = (early || lift(send))
        .then(function (r) {
          if (r.status === 401 && held) sessionEnded(path);
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
      var t = token(), h = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, opts.headers), held = cookieSession() || !!t;
      if (t && sendsHeader()) { h['X-Session-Token'] = t; h['Authorization'] = 'Bearer ' + t; }
      /* ── EXACTLY ONCE STARTS AT THE FIRST ATTEMPT (PLAN G6) ──────────────
         A write the server honours (GET /api/idempotency/honoured: the gateway runs it once per key) carries a key from the very
         first send, and the same key goes into the queue if the answer never comes back. If only the queued copy had a key, an
         attempt that landed and whose answer was lost would land a second time when the queue drained.

         THE CALLER OPTS IN (`queueable: true`), because the caller is the one that can SHOW a waiting write. A surface that does not
         know about `queued` would draw the write as failed while it sits in the outbox, the person would press it again, and
         the second press (a new key) would be a second write. So a write is queued only when the screen that made it says it can
         show it waiting, and only when the server honours it (`OW.offline.keyFor` answers '' for anything it does not). */
      var key = opts.key || ((!opts.queueable || !OW.offline || !OW.offline.keyFor) ? '' : OW.offline.keyFor(opts.method || 'POST', path));
      if (key) h['X-Idempotency-Key'] = key;
      /* A FILE PAST ITS DOOR'S SIZE IS REFUSED HERE, IN THE DOOR'S OWN WORDS, BEFORE A BYTE IS SENT (M09). A video's poster is
         a small picture with its own cap at the door, so it is not counted as the file. */
      var files = filesIn(body), carried = 0, fi;
      for (fi = 0; fi < files.length; fi++) {
        carried += files[fi].bytes;
        var over = files[fi].key === 'poster' ? '' : tooLarge(path, files[fi].bytes);
        if (over) return Promise.resolve({ ok: false, status: 413, error: over, body: { detail: over } });
      }
      var going = (carried >= SENDING_SHOWN_FROM_BYTES && global.XMLHttpRequest) ? sending(path) : null;
      var waited = (path === '/api/oneway/media' && body && String(body.data || '').indexOf('data:video/') === 0) ? videoWait() : null;
      return lift(function () {
        var t2 = token();
        if (t2 && sendsHeader()) { h['X-Session-Token'] = t2; h['Authorization'] = 'Bearer ' + t2; }
        if (going) return sendFile(BASE + path, opts.method || 'POST', h, JSON.stringify(body), going.at);
        return global.fetch(BASE + path, {
          method: opts.method || 'POST', headers: h, credentials: 'same-origin',
          body: body ? JSON.stringify(body) : '{}'
        });
      }).then(function (r) {
        if (going) going.end();
        if (waited) waited();
        if (r.status === 401 && held) sessionEnded(path);
        return r.json().catch(function () { return null; }).then(function (j) {
          if (r.ok) { wrote(path, opts.method || 'POST'); followAnswered(path, opts.method || 'POST', j); }
          return r.ok ? { ok: true, data: j }
                      : { ok: false, status: r.status,
                          error: failSaid(j, r.status), body: j };
        });
      }).catch(function () {
        if (going) going.end();
        if (waited) waited();
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
        /* A FILE THAT WAS STILL GOING SAYS SO (M09): "did not answer" reads as if nothing had been sent */
        if (carried) return { ok: false, status: 0, dropped: true, error: 'The connection dropped before this finished sending, so nothing was saved. Try again.' };
        return { ok: false, status: 0, error: 'Oneway did not answer, so nothing was done. Try again.' };
      });
    },
    /* A RENEWAL, WHEN NOTHING IS IN FLIGHT (above): `renew` is called at the first moment no request is flying, and every
       request made after that waits for its answer; never quiet for 30 s, it is put off and answers `false`. One at a time:
       a second asks for the first. */
    /* A REQUEST SENT OUTSIDE THIS FILE, CARRIED AS ONE OF ITS OWN (R18, 2026-10-20: the OS's reads went around OW.data, so
       one in flight across a renewal came back 401 and read as signed out): counted while it flies, and held while a
       renewal runs. `send` is called when it may go and returns the request's promise. */
    carry: function (send) { return lift(send); },
    renewWhenQuiet: function (renew) {
      if (renewal) return renewal;
      if (waiting) return waiting.p;
      var w = { renew: renew };
      w.p = new Promise(function (ok, no) { w.ok = ok; w.no = no; });
      waiting = w;
      if (!flying) { begin(w); return w.p; }
      w.timer = global.setTimeout(function () { if (waiting === w) { waiting = null; w.ok(false); } }, 30000);
      return w.p;
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
    /* has this page been told its session ended (ow:signed-out, above)? */
    signedOut: function () { return ended; },
    invalidate: function (match) {
      Object.keys(cache).forEach(function (k) {
        if (!match || k.indexOf(match) >= 0) delete cache[k];
      });
    }
  };
  OW.data = data;

  /* EVERY PUBLIC ADDRESS (founder/1141): the backend builds them (api/oneway/seo/address.py) and a read carries its own, so this says which to use. With none
     given, a Center's and an event's id still lead home: their old address answers one 301 to where it is now, forever. A person's is theirs by name. */
  OW.address = {
    center: function (id, given) {
      if (given) return given;
      var r = String(id || '');
      return r.charAt(0) === '.' ? '/' + encodeURIComponent(r).replace(/^\./, '.') : '/c/' + encodeURIComponent(r);   /* a name is its own address; an id leads there */
    },
    event: function (id, given) { return given || '/e/' + encodeURIComponent(id || ''); },
    person: function (handle) { return '/@' + encodeURIComponent(String(handle || '').replace(/^@/, '')); }
  };

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
  /* FOLLOW COUNTS, LIVE ON EVERY SURFACE (the founder, 2026-10-22: "follwer and following counts need to be live and accurate
     across all surfaces and must count up number or drop down one when users follows/unfollows user"). Every follow and
     unfollow in the App and the OS is a write through this one writer, and the graph's answer now carries the followed
     side's exact counts (api/oneway/graph/service._target_counts) beside the follower's own. So here, once: every count box
     that says whose it is (data-ow-of: its ids, @handle and id) shows the target's new followers, and a box that is the
     viewer's own shows their new following. The exact numbers from the server, never a guess; a press that changed nothing
     changes nothing. Then 'ow:follow' tells any surface that wants more. Held by tools/probe/follow-counts.cjs. */
  var FOLLOW_PATH = /^\/api\/oneway\/graph\/follow\/([^\/?#]+)/;
  function bare(x) { return String(x || '').trim().toLowerCase().replace(/^@/, ''); }
  function followAnswered(path, method, j) {
    var m = FOLLOW_PATH.exec(String(path || ''));
    if (!m || !j || typeof j !== 'object') return;
    var d = { ref: decodeURIComponent(m[1]), on: method !== 'DELETE', changed: j.changed,
              target_counts: j.target_counts || null, counts: j.counts || null };
    try { syncFollowCounts(d); } catch (e) {}
    try { syncFollowButtons(d.ref, d.on); } catch (e) {}
    try { global.document.dispatchEvent(new CustomEvent('ow:follow', { detail: d })); } catch (e) {}
  }
  /* EVERY COPY OF A FOLLOW BUTTON SAYS THE SAME (the founder, 2026-10-30), here and on the person's other devices. A button marks whom it follows
     (data-ow-follow: its refs; data-ow-follow-on / -off: its words) and its state is set from the graph's word: this tab's own answer, or the
     server's `follow-state` from a press made elsewhere (graph/service.py _numbers_moved). A press in flight on that very button decides for
     itself. Every press that changed anything says so once and in order, so the last word heard is the true one. */
  function syncFollowButtons(ref, on) {
    var doc = global.document, who = bare(ref); if (!doc || !doc.querySelectorAll || !who) return;
    [].forEach.call(doc.querySelectorAll('[data-ow-follow]'), function (btn) {
      if (String(btn.getAttribute('data-ow-follow') || '').split(/\s+/).map(bare).indexOf(who) < 0) return;
      if (btn.disabled || btn.getAttribute('data-act') === 'working' || btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.getAttribute('aria-pressed') === String(!!on)) return;
      btn.setAttribute('aria-pressed', String(!!on));
      if (btn.hasAttribute('data-act')) btn.setAttribute('data-act', on ? 'on' : 'off');
      var say = btn.getAttribute(on ? 'data-ow-follow-on' : 'data-ow-follow-off');
      if (say) btn.textContent = say;
      if (OW.motion && OW.motion.bounce) OW.motion.bounce(btn, 'bump');
    });
  }
  if (global.document && global.document.addEventListener) global.document.addEventListener('ow:follow-state', function (e) {
    var d = (e && e.detail) || {};
    if (!d.ref) return;
    /* a press from before this page read anything, replayed by the stream as it opens: what the page read is newer */
    if (d.at && global.performance && global.performance.timeOrigin && d.at * 1000 < global.performance.timeOrigin) return;
    try { syncFollowButtons(d.ref, d.on); } catch (err) {}
    try { global.document.dispatchEvent(new CustomEvent('ow:follow', { detail: { ref: d.ref, on: !!d.on, remote: true } })); } catch (err) {}
  });
  function putCount(box, key, n) {
    if (typeof n !== 'number' || !isFinite(n)) return;
    if (OW.cards && OW.cards.setCount) return OW.cards.setCount(box, key, n);        /* ONE WRITER of a count box (oneway-cards.js): an unchanged number is not rewritten */
    [].forEach.call(box.querySelectorAll('[data-count="' + key + '"]'), function (el) {
      var b = el.querySelector('b'); if (!b) return;
      var say = (OW.cards && OW.cards.number) ? OW.cards.number : String;
      if (OW.motion && OW.motion.count) OW.motion.count(b, n, say); else b.textContent = say(n);
      var word = (OW.cards && OW.cards.countWords) ? OW.cards.countWords(key, n) : (key === 'followers' ? (n === 1 ? 'follower' : 'followers') : key);
      var sp = el.querySelector('span');
      if (sp) sp.textContent = word;
      else if (b.nextSibling && b.nextSibling.nodeType === 3) b.nextSibling.textContent = ' ' + word;
    });
  }
  function syncFollowCounts(d) {
    var doc = global.document; if (!doc || !doc.querySelectorAll) return;
    var ref = bare(d.ref), mine = [bare(ME)].filter(Boolean);
    [].forEach.call(doc.querySelectorAll('[data-ow-of]'), function (box) {
      var of = String(box.getAttribute('data-ow-of') || '').split(/\s+/).map(bare).filter(Boolean);
      if (ref && of.indexOf(ref) >= 0 && d.target_counts) putCount(box, 'followers', d.target_counts.followers);
      if (d.counts && (box.getAttribute('data-ow-self') === '1' || of.some(function (x) { return mine.indexOf(x) >= 0; })))
        putCount(box, 'following', d.counts.following);
    });
  }
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
  /* WHAT A DOOR THAT TAKES A FILE TAKES, and its refusal for a file past it, in the server's own words (above): a screen asks
     before it reads a file (`OW.data.tooLarge('/api/oneway/media', file.size)`), and never keeps a number of its own */
  data.takes = takes;
  data.tooLarge = tooLarge;
  /* WHAT A FILE IS, FROM ITS FIRST SIXTEEN BYTES, read as the server reads them (media/store.sniff; the HEIC brands are oneway/kernel/files.kind_of's): 'png',
     'webp', 'jpeg', 'gif', 'heic', 'avif', 'video' or '' — for `upload`'s `only`, so a refusal names what was chosen */
  var FORMAT_NAMES = { png: 'a PNG', webp: 'a WebP', jpeg: 'a JPEG', gif: 'a GIF', heic: 'a HEIC photo', avif: 'an AVIF picture', video: 'a video' };
  function formatOf(file) {
    var head = (file && typeof file.slice === 'function') ? Promise.resolve(file.slice(0, 16)).then(function (b) {
      return (b && typeof b.arrayBuffer === 'function') ? b.arrayBuffer() : b;
    }) : Promise.resolve(null);
    return head.then(function (buf) {
      if (!buf) return '';
      var b = new Uint8Array(buf), s = '', i;
      for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      if (s.slice(0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
      if (s.slice(0, 4) === 'RIFF' && s.slice(8, 12) === 'WEBP') return 'webp';
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
      if (s.slice(0, 4) === 'GIF8') return 'gif';
      if (s.slice(4, 8) === 'ftyp') return /^(heic|heix|mif1|msf1|hevc)/.test(s.slice(8, 12)) ? 'heic' : (/^avi[fs]/.test(s.slice(8, 12)) ? 'avif' : 'video');
      if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video';
      return '';
    }, function () { return ''; });
  }
  /* ONE FILE A PERSON CHOSE, SENT WHOLE (M09). Each screen that takes a file read it, posted it and unwrapped the answer
     by hand, and said a failure in words of its own, or not at all (a file that could not be read left the canvas's photo
     pickers saying "Uploading" for good). `upload(file, {door, body, what})`: the file is refused first if it is past what the
     door takes (in the door's words, nothing read or sent), read, and sent through `post` (so its progress is shown and
     a dropped connection is said). It answers {ok, url, item, data} or {ok: false, status, error} with the words to say,
     and never throws. `door` is the media door unless named; `file` may be a data: address already in hand. */
  data.upload = function (file, opts) {
    opts = opts || {};
    var path = opts.door || '/api/oneway/media';
    if (!file) return Promise.resolve({ ok: false, status: 0, error: 'No file was chosen.' });
    var whole = typeof file === 'string';
    var early = whole ? '' : tooLarge(path, file.size || 0, opts.what);
    if (early) return Promise.resolve({ ok: false, status: 413, error: early });
    /* A PLACE THAT TAKES ONLY SOME PICTURES SAYS SO FIRST (M09): a logo given a HEIC went to the media door, which answered
       for itself ("Photo or video must be a JPG, PNG, GIF or WebP picture or an MP4, MOV or WebM video"), offering a video
       and a JPG the logo refuses. `only: {formats, subject, takes}` reads the file's first bytes (never its name) and,
       when it is none of `formats`, answers "<subject> must be <takes>. This one is <what it is>." with nothing sent. */
    if (opts.only && !whole) {
      return formatOf(file).then(function (fmt) {
        var o = opts.only;
        if ((o.formats || []).indexOf(fmt) >= 0) {
          var rest = {}, k;
          for (k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k) && k !== 'only') rest[k] = opts[k]; }
          return data.upload(file, rest);
        }
        return { ok: false, status: 400, error: o.subject + ' must be ' + o.takes + '. ' + (FORMAT_NAMES[fmt] ? 'This one is ' + FORMAT_NAMES[fmt] + '.' : 'This file is not one.') };
      });
    }
    var read = whole ? Promise.resolve(file) : new Promise(function (ok) {
      var fr = new global.FileReader();
      fr.onload = function () { ok(String(fr.result || '')); };
      fr.onerror = fr.onabort = function () { ok(''); };
      try { fr.readAsDataURL(file); } catch (_) { ok(''); }
    });
    return read.then(function (src) {
      if (!src) return { ok: false, status: 0, error: 'That file could not be read. Nothing was sent. Try again.' };
      var body = {}, k;
      body[opts.field || 'data'] = src;
      if (path === '/api/oneway/media') body.origin = opts.origin || 'uploaded';
      for (k in (opts.body || {})) { if (Object.prototype.hasOwnProperty.call(opts.body, k)) body[k] = opts.body[k]; }
      return data.post(path, body, { method: opts.method || 'POST' }).then(function (r) {
        if (!r || !r.ok) return { ok: false, status: (r && r.status) || 0, error: (r && r.error) || 'That file was not kept, so nothing was saved. Try again.' };
        var d = r.data || {}, item = d.media || d.item || d.placement || d;
        return { ok: true, url: (item && (item.url || item.ref)) || d.url || '', item: item, data: d };
      });
    });
  };
  /* THE FILE AN INPUT WAS GIVEN, AND THE INPUT LEFT EMPTY, so choosing the same file again (after a refusal, to try again)
     is heard: an input that keeps its value does not say `change` for the file it already holds. `many`: all of them. */
  data.chosen = function (input, many) {
    var files = [].slice.call((input && input.files) || []);
    try { input.value = ''; } catch (_) {}
    return many ? files : (files[0] || null);
  };
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
    /* A data: ADDRESS IS DECODED HERE, NOT FETCHED: the App's connect-src is 'self', which refuses a fetch of one, and
       Lightbulb's Edit on a photo just taken (a data: address) opened nothing at all (walked 2026-10-21) */
    if (/^data:/i.test(u)) {
      try {
        var cut = u.indexOf(','), head = u.slice(5, cut), body = u.slice(cut + 1);
        var bytes;
        if (/;base64/i.test(head)) {
          var bin = global.atob(body);
          bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else bytes = new global.TextEncoder().encode(decodeURIComponent(body));
        return Promise.resolve(new global.Blob([bytes], { type: head.split(';')[0] || 'application/octet-stream' }));
      } catch (e) { return Promise.reject(new Error('That picture could not be read.')); }
    }
    var full = /^(data:|blob:|https?:)/.test(u) ? u : (BASE + (u.charAt(0) === '/' ? u : '/' + u));
    return global.fetch(full, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('That picture could not be read.');
      return r.blob();
    });
  };
  /* A PRESS THAT READS OUTSIDE ANSWERS AT ONCE, AND ITS OUTCOME IS READ BACK AT ITS OWN DOOR (RT2-08, the way Gather's is): `d` is the press's answer, `path` the door, `read` the page's own reader.
     The answer the press would have had, or its refusal in the same words. An answer with nothing being read goes straight through. */
  data.untilRead = function (d, path, read) {
    var turn = d && d.reading;
    if (!turn || !turn.token) return Promise.resolve(d);
    var at = path + '?token=' + encodeURIComponent(turn.token), tries = 0;
    return new Promise(function (done, refused) {
      (function tick() {
        read(at).then(function (r) {
          if (r && r.failed) { refused(new Error(r.failed)); return; }
          if (r && r.reading) {
            if (++tries >= 90) { refused(new Error('It is still being read. Look again in a minute.')); return; }
            setTimeout(tick, 1500);
            return;
          }
          done(r || {});
        }).catch(refused);
      })();
    });
  };
  /* a shell's own session at open renews the session; these are its only handles on what this file holds */
  data._session = { base: function () { return BASE; }, forget: function () { TOKEN = null; }, set: function (t) { TOKEN = t || null; } };
})(typeof window !== 'undefined' ? window : this);
