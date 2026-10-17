/* ONEWAY — APP · MESSAGING  (frontend/app/messaging/messaging.js)

   THE APP'S PROJECTION OF THE ONE CANONICAL MESSAGING CAPABILITY.

   ★ FOUNDER, 2026-07-30: *"messages should be a page in the app and should work
     like traditional messaging. anything else was previous drift."*

   ★ FOUNDER, 2026-08-22: *"Messaging should be one canonical capability... The
     App and OS can expose different controls, layouts and contextual
     information. But they should not create two incompatible message systems."*

   ★ FOUNDER, 2026-09-01: *"Wire the App to the existing 23 canonical messaging
     routes… Do not create a second messaging architecture in the App. Consume
     the canonical backend contracts already proven."*

   ── WHAT THIS FILE REPLACED, AND WHY IT COUNTED AS A DEFECT ───────────────

   The backend had 23 canonical routes under `/api/oneway/messaging/*` and 52
   passing checks over them. THIS FILE CALLED NONE OF THEM. It read
   `/api/conversations` and `/api/me/dm`, so everything the canonical domain
   had been built to guarantee — requests, blocking, reactions, replies,
   delivery state, retention, notification resolution — existed, worked, was
   tested, and reached nobody.

   That is not a missing system. It is a missing CONSUMER, and it is the shape
   the founder named on 2026-09-01: *"Missing consumer or missing proof ≠
   missing system."* So nothing here re-implements a rule the domain already
   owns. Every decision this file makes about who may write, what may be
   reacted to, whether a message waits in requests and how long a room keeps
   what is said in it is READ FROM THE SERVER, never decided locally.

   ── THE ONE CONTRACT DETAIL EVERY SURFACE HERE IS BUILT AROUND ────────────

   A `conv:` realtime event CARRIES NO MESSAGE TEXT. The server says a message
   with this seq exists and each client reads the conversation it is already
   entitled to read — so a policy that hides history from a new participant
   cannot be defeated by listening to the bus. That means "a message arrived"
   is a PROMPT TO READ, never content to paint, and the code below never
   renders anything it heard on the wire.

   ── SEQ IS THE ONLY ORDER ─────────────────────────────────────────────────

   Never `created_at`. `seq` is monotonic per conversation, allocated in the
   same transaction that stamps the preview, and it is what pagination, unread
   arithmetic and read receipts are all expressed in. Two messages can share a
   millisecond; they cannot share a seq.

   LOAD ORDER: `oneway-popit.js` -> `popit-live.js` -> `oneway-realtime.js`
   -> this. */
(function (global) {
  'use strict';
  var OW = global.OW;
  if (!OW || !OW._u) {
    console.warn('[app/messaging] load oneway-popit.js and popit-live.js first');
    return;
  }
  var _u = OW._u;
  var data = _u.data;
  var doc = _u.doc;
  var esc = _u.esc;
  var loading = _u.loading;
  var mk = _u.mk;
  var nothing = _u.nothing;
  var refused = _u.refused;
  var whenWords = _u.whenWords;

  /* A NAME FOR SOMEBODY WHO HAS NONE YET. Everybody else in a conversation arrives as their
     @handle (people/refs.for_reader, 2026-10-02) and only you as your own address — so the
     fallback is the handle without its @, and never the left half of somebody's address. */
  function bare(who) {
    var s = String(who || '');
    return s.charAt(0) === '@' ? s.slice(1) : s.split('@')[0];
  }

  (function () {
    var missing = ['data', 'doc', 'esc', 'loading', 'mk', 'nothing', 'refused', 'whenWords']
      .filter(function (n) { return typeof _u[n] === 'undefined'; });
    if (missing.length) console.error('[app/messaging] OW._u is missing: ' + missing.join(', '));
  })();

  /* THE CANONICAL PREFIX, WRITTEN ONCE. Every path below is built from it, so
     there is exactly one place that knows where messaging lives and no way for
     half the file to drift onto a legacy route while the other half does not —
     which is precisely how this surface ended up split across
     `/api/conversations` and `/api/me/dm` in the first place. */
  var API = '/api/oneway/messaging';
  var conv_ = function (cid) { return API + '/conversations/' + encodeURIComponent(cid); };

  /* ── A REFUSAL SAYS WHICH RULE REFUSED ────────────────────────────────────
     The routes answer 403 with `detail: {rule, message}` — deliberately, so a
     surface can say what the conversation decided rather than "not allowed".
     `data.post` hands that dict through as `error`, so it arrives here as an
     OBJECT and `esc(r.error)` would have printed "[object Object]" on every
     privacy refusal in the App. */
  function why(r) {
    var e = r && r.error;
    if (e && typeof e === 'object') return e.message || e.rule || 'refused';
    if (typeof e === 'string' && e) return e;
    if (r && r.status === 0) return 'the request did not come back';
    return 'refused';
  }
  function ruleOf(r) {
    var e = r && r.error;
    return (e && typeof e === 'object' && e.rule) || '';
  }

  /* ── STARTING A CONVERSATION IS THREE OUTCOMES, NOT TWO ───────────────────
     opened · HELD as a request · REFUSED by a rule. The middle one is the one
     surfaces get wrong: a held first message is not an error and not a
     success, and calling it either lies to the sender. The route answers 200
     with `held:true` for exactly this reason, and this is the only place in
     the App that knows how to read it. */
  OW.messaging = OW.messaging || {};
  OW.messaging.start = function (people, opts) {
    opts = opts || {};
    var body = { with_people: [].concat(people || []) };
    if (opts.title) body.title = opts.title;
    if (opts.type) body.type = opts.type;
    if (opts.policy) body.policy = opts.policy;
    /* the words a stranger sends with a request (founder/556) */
    if (opts.first_message) body.first_message = String(opts.first_message);
    return data.post(API + '/conversations', body).then(function (r) {
      data.invalidate(API);
      if (!r.ok) {
        /* `status` travels too: a rule's refusal (403) is permanent, a request
           that did not come back or a server fault (0, 5xx) is not — and a
           caller must not tell somebody they cannot be reached because of a
           blip (founder/502 sweep) */
        return { state: 'refused', rule: ruleOf(r), why: why(r), status: r.status || 0,
                 passing: !r.status || r.status >= 500 };
      }
      var d = r.data || {};
      if (d.held) {
        return { state: 'held', request: d.request,
                 why: d.why || 'your first message is waiting for them to accept it' };
      }
      return { state: 'open', conversation: d.conversation };
    });
  };

  /* ── ONE CONVERSATION, BY ID, SO A URL CAN OPEN IT ───────────────────────
     `openThread` has always pushed `#messages/<id>` into history, and the
     router answered it by opening the LIST — with a comment saying a
     conversation object cannot come from a URL. That was true of the surface
     it was written for and is not true any more: the id is the only thing a
     thread genuinely needs, and the inbox already answers who is in it.

     So a shared link, a reload and the back button all land where they say
     they will. AN ID THAT IS NOT IN THE INBOX RESOLVES TO NOTHING and the
     caller falls back to the list — never to a half-opened thread with a
     title it guessed. */
  OW.messaging.find = function (cid) {
    /* ★ FOUNDER/424: *"1 click 1 read."* The conversation's page read carries
       the room's own row now (`conversation`), so a link straight into a
       thread costs one read — the same read the thread then paints from,
       cached for it. The inbox is read only when a runtime did not answer. */
    return data.get(conv_(cid) + '?limit=30', { fresh: true }).then(function (r) {
      var c = r.ok && r.data && r.data.conversation;
      if (c && c.id) return c;
      return data.get(API + '/inbox?limit=50', { fresh: true }).then(function (r2) {
        if (!r2.ok) return null;
        var rows = (r2.data || {}).conversations || [];
        for (var i = 0; i < rows.length; i++) if (rows[i].id === cid) return rows[i];
        return null;
      });
    });
  };

  /* ══ A GROUP'S DOOR — founder/556 ══════════════════════════════════════
     "How people join" (invite · ask and an admin approves · anyone who finds
     it) was a rule nobody could reach: a group had no link and someone
     outside it met an error. A group's link is its thread address; opened by
     somebody who is not in it, this is what they see — its name, its face, how
     many are in it, and the one thing its rule lets them do. Never a message. */
  OW.messaging.door = function (cid) {
    return data.get(conv_(cid) + '/door', { fresh: true }).then(function (r) {
      return (r && r.ok && r.data && r.data.door) || null;
    }).catch(function () { return null; });
  };
  OW.live.groupDoor = function (host, d, opts) {
    opts = opts || {};
    host.className = ''; host.innerHTML = '';
    var pg = mk('div', 'ow-door-g');
    var top = mk('div', 'ow-set__ph');
    var bk = mk('button', 'ow-set__back'); bk.type = 'button';
    bk.setAttribute('aria-label', 'Back to Messages');
    bk.innerHTML = OW.setIcon ? OW.setIcon('back') : '';
    bk.addEventListener('click', function () { if (opts.onBack) opts.onBack(); });
    top.appendChild(bk);
    pg.appendChild(top);
    var face = mk('span', 'ow-thread__av ow-chatset__face ow-door-g__face');
    face.setAttribute('data-kind', 'center');
    if (d.picture) { var im = doc.createElement('img'); im.src = OW.imageUrl ? OW.imageUrl(d.picture) : d.picture; im.alt = ''; face.appendChild(im); }
    else face.textContent = OW.initials ? OW.initials(d.title || 'Group') : 'G';
    pg.appendChild(face);
    pg.appendChild(mk('h1', 'ow-door-g__t', esc(d.title || 'A group')));
    pg.appendChild(mk('p', 'ow-door-g__n', esc(d.members + (d.members === 1 ? ' person' : ' people'))));
    var act = mk('div', 'ow-door-g__act');
    var said = mk('p', 'ow-door-g__said', '');
    function joinNow(note, btn) {
      btn.disabled = true;
      data.post(conv_(d.id) + '/join', { note: note || '' }).then(function (r) {
        btn.disabled = false;
        if (!r || !r.ok) { said.textContent = why(r) || 'That did not work. Try again.'; return; }
        var out = r.data || {};
        if (out.state === 'joined' || out.state === 'already_in') {
          data.invalidate(API);
          if (opts.onJoined) opts.onJoined(d.id);
          return;
        }
        act.innerHTML = '';
        said.textContent = 'Your request is with the admins. You will be in when one of them lets you in.';
      });
    }
    if (d.state === 'pending') {
      said.textContent = 'Your request is with the admins. You will be in when one of them lets you in.';
    } else if (d.joining === 'open') {
      var j = mk('button', 'ow-btn ow-door-g__go', 'Join'); j.type = 'button';
      j.addEventListener('click', function () { joinNow('', j); });
      act.appendChild(j);
      said.textContent = 'Anyone with this link can join.';
    } else if (d.joining === 'request') {
      var f = mk('form', 'ow-reqsay');
      var inp = doc.createElement('input'); inp.type = 'text'; inp.maxLength = 400; inp.className = 'ow-reqsay__in';
      inp.placeholder = 'Say who you are (optional)'; inp.setAttribute('aria-label', 'A note to the admins');
      var go = mk('button', 'ow-btn ow-door-g__go', d.state === 'declined' ? 'Ask again' : 'Ask to join'); go.type = 'submit';
      f.appendChild(inp); f.appendChild(go);
      f.addEventListener('submit', function (ev) { ev.preventDefault(); joinNow(inp.value.trim(), go); });
      act.appendChild(f);
      said.textContent = d.state === 'declined' ? 'An admin did not let you in last time.' : 'An admin decides who joins.';
    } else {
      said.textContent = 'Only people an admin adds can join this group.';
    }
    pg.appendChild(act);
    pg.appendChild(said);
    host.appendChild(pg);
    return Promise.resolve(1);
  };

  /* ══ THE INBOX ══════════════════════════════════════════════════════════ */

  OW.live.messages = function (host, opts) {
    opts = opts || {};
    loading(host, 2);
    /* ── ONE COMPOSED READ FOR MESSAGES (B, f4dc52e) ───────────────────
       This asked two questions — "who is waiting for a decision from me" and
       "what am I already in" — and a person needs both before the screen
       means anything. `GET /api/oneway/messaging/screen` answers both, and
       three more the surface was not asking at all: the people it can reach
       with their presence, this person's own reception settings, and the
       Centers they operate.

       FAILURE IS STILL LOCAL, which was the whole reason for two reads. The
       composed answer carries `unreadable[]`, so a part that could not be read
       is NAMED and the rest still paints — a stronger version of the same
       rule, because now the surface is told which half is missing instead of
       inferring it from an envelope that did not arrive. */
    return data.get('/api/oneway/messaging/screen', { fresh: true })
      .then(function (sc) {
      if (!sc.ok) { refused(host, sc, 'Messages'); return 0; }
      var _s = sc.data || {};
      /* handed on in the envelopes this renderer already reads.

         THE INBOX HALF WAS HARDCODED `ok: true`. The comment above says the
         composed answer NAMES a part that could not be read — and the requests
         envelope honoured that while the inbox one did not. So an inbox the
         server had marked unreadable arrived here as a healthy, empty one, and
         a person with thirty conversations was told "No conversations yet"
         and sent to Discovery to find somebody to talk to. B's audit found
         it. Both halves now read the same word. */
      var _unr = _s.unreadable || [];
      var ib = { ok: _unr.indexOf('inbox') < 0, data: _s.inbox || {} };
      var rq = { ok: _unr.indexOf('requests') < 0, data: _s.requests || {} };

      host.className = ''; host.innerHTML = '';
      /* ── THE INBOX'S OWN HEADER, TIKTOK'S WAY (founder/510) ──────────────
         A title, and the one act the list itself owns: starting a message.
         There was no way to begin a conversation from Messages at all — only
         from somebody's profile. */
      var top = mk('div', 'ow-inbox__top');
      top.appendChild(mk('h1', 'ow-inbox__h', 'Messages'));
      var nw = mk('button', 'ow-thread-head__more'); nw.type = 'button';
      nw.setAttribute('aria-label', 'New message');
      nw.innerHTML = OW.setIcon ? OW.setIcon('plus') : '+';
      nw.addEventListener('click', function () { newMessage(host, opts); });
      top.appendChild(nw);
      host.appendChild(top);

      var reqs = (rq.ok && ((rq.data || {}).requests || [])) || [];
      var list = ((ib.data || {}).conversations || []).filter(function (c) {
        if (!c || c.archived) return false;
        /* A CONCLUDED CONVERSATION IS NOT AN INBOX ITEM — and `status` on the
           canonical row is the WORK STATE: open · assigned · escalated ·
           concluded. Nothing else.

           THE OLD FILTER WAS `active || quiet`, AND I CARRIED IT ACROSS
           WITHOUT RE-READING THE CONTRACT. Those are the legacy envelope's
           words; the canonical envelope has never emitted either of them. So
           an allow-list of two values that can never occur hid EVERY
           conversation — a freshly accepted message request opened correctly,
           appeared in the API, and rendered as an empty inbox. Caught in the
           browser within a minute, invisible to every suite, and exactly the
           seam shape this whole pass is about: two correct halves joined on a
           word that does not mean the same thing on both sides.

           A DENY-LIST, NOT AN ALLOW-LIST. A status this file has not been
           taught about must leave the conversation VISIBLE — being wrong in
           the direction of showing somebody their own messages is recoverable;
           being wrong in the direction of hiding them is what just happened. */
        return (c.status || 'open') !== 'concluded';
      });

      if (reqs.length) host.appendChild(requestsBlock(reqs, opts));

      /* UNREADABLE IS NOT EMPTY. An inbox that could not be read says so,
         above whatever else did paint, and never tells the person they have
         nothing — they may have thirty conversations behind a failed read. */
      if (!ib.ok) {
        host.appendChild(mk('p', 'ow-note show ow-note--bad',
          'Your conversations could not be read just now. They are still there.'));
      }
      if (!list.length) {
        if (!reqs.length && ib.ok) {
          host.classList.add('po-grid');
          nothing(host,
            'No conversations yet. Messages start where something is happening — '
            + 'a person, a place, or a thing you are both looking at.',
            'Nothing to read',
            [{ label: 'Find people and places', go: 'discovery' }]);
        }
        return reqs.length;
      }

      /* newest first: a message list is read by recency, unlike a Gallery */
      list.sort(function (a, b) {
        return String(b.last_at || b.last_activity || '')
          .localeCompare(String(a.last_at || a.last_activity || ''));
      });

      /* A THREAD NOBODY HAS SPOKEN IN IS NOT A CONVERSATION YET. Measured on
         the founder's own pane (2026-09-20): ten rows of "No messages yet" —
         threads opened by a tap and never written in — stood between him and
         the people who had actually written. They are kept (opening the
         person or the Center finds them again); they are not listed. */
      /* SPOKEN MEANS A MESSAGE EXISTS — not that its last one has words. A
         conversation whose newest message was deleted (preview "") or was a
         photo carried no text, and this dropped the WHOLE conversation from
         the list: the direct thread with ada.ops, with messages in it, was
         simply gone (founder/502 crawl, 2026-09-24). */
      var spoken = list.filter(function (c) {
        var lm = c.last_message || {};
        return !!(lm.id || lm.preview || lm.body || c.about || c.unread);
      });
      /* ONE CONVERSATION PER PAIR. Six "loop.bo · typo here" rows on the
         founder's pane were six direct threads with the same two people in
         them (opened by probes). Two people have one conversation; the list
         shows the newest thread for a pair and the rest stay reachable
         through it. A room (three or more) or an object thread is its own. */
      var seenPair = {};
      spoken = spoken.filter(function (c) {
        if (!isDirect(c)) return true;
        var key = (c.participants || []).map(function (p) {
          return String((p && (p.email || p)) || '').toLowerCase(); }).filter(Boolean).sort().join('|');
        if (!key || (c.participants || []).length > 2) return true;
        if (seenPair[key]) return false;
        seenPair[key] = 1; return true;
      });
      var wrap = mk('div', 'ow-threads');
      spoken.forEach(function (c) { wrap.appendChild(threadRow(c, opts)); });
      host.appendChild(wrap);
      return spoken.length;
    });
  };

  /* ── NEW MESSAGE — its own page, and back ──────────────────────────────
     The people you follow first (the ones you are most likely to write to),
     narrowed as you type; past two letters the platform's own search joins
     in. Choosing a person starts the conversation the same way a profile's
     Message button does (OW.messaging.start: opened · held · refused), so a
     request that waits for acceptance is said, never walked into. */
  function newMessage(host, opts) {
    host.innerHTML = '';
    var pg = mk('div', 'ow-set ow-set__page is-in');
    var ph = mk('div', 'ow-set__ph');
    var bk = mk('button', 'ow-set__back'); bk.type = 'button';
    bk.setAttribute('aria-label', 'Back to Messages');
    bk.innerHTML = OW.setIcon ? OW.setIcon('back') : '';
    bk.addEventListener('click', function () { OW.live.messages(host, opts); });
    ph.appendChild(bk);
    ph.appendChild(mk('h1', 'ow-set__pt', 'New message'));
    pg.appendChild(ph);
    var sb = mk('label', 'ow-set__search');
    sb.innerHTML = OW.setIcon ? OW.setIcon('search') : '';
    var q = doc.createElement('input');
    q.type = 'search'; q.placeholder = 'Search people';
    q.setAttribute('aria-label', 'Search people');
    sb.appendChild(q); pg.appendChild(sb);
    var sec = mk('section', 'ow-set__sec');
    var sh = mk('h2', 'ow-set__sh', 'People you follow');
    sec.appendChild(sh);
    var list = mk('div', 'ow-newmsg__list');
    sec.appendChild(list);
    pg.appendChild(sec);
    var said = mk('p', 'ow-set__lede', '');
    pg.appendChild(said);
    host.appendChild(pg);

    var mine = [];
    function row(pp) {
      /* the person by @handle (`ref`): the follow list and search no longer carry anybody's
         address, and every person door and the conversation door take the handle
         (people/refs.py, 2026-10-02) */
      var em = String(pp.ref || pp.email || pp.id || '').toLowerCase();
      if (!em) return;
      var b = mk('button', 'ow-set__row ow-newmsg__p'); b.type = 'button';
      var f = mk('span', 'ow-newmsg__face');
      var pic = pp.picture || pp.image || '';
      if (pic) { var im = doc.createElement('img'); im.src = OW.imageUrl ? OW.imageUrl(pic) : pic; im.alt = ''; f.appendChild(im); }
      else if (OW.faceMark) f.innerHTML = OW.faceMark();
      b.appendChild(f);
      var w = mk('span', 'ow-setpick__w');
      w.appendChild(mk('b', '', esc(pp.name || pp.display_name || 'Someone')));
      w.appendChild(mk('span', '', esc(pp.handle ? '@' + String(pp.handle).replace(/^@/, '') : (em.charAt(0) === '@' ? em : ''))));
      b.appendChild(w);
      /* the follow list carries addresses only; each row fills its own face
         and name from the person's light read, as the inbox rows do */
      if (!pic || !(pp.name || pp.display_name)) {
        data.get('/api/oneway/people/' + encodeURIComponent(em)).then(function (r) {
          var d = (r && r.ok && r.data) || null;
          if (!d || !b.isConnected) return;
          if (d.display_name || d.name) w.querySelector('b').textContent = d.display_name || d.name;
          var pc = d.picture && (d.picture.url || d.picture);
          if (pc && typeof pc === 'string') { f.innerHTML = ''; var im2 = doc.createElement('img'); im2.src = OW.imageUrl ? OW.imageUrl(pc) : pc; im2.alt = ''; f.appendChild(im2); }
        });
      }
      b.addEventListener('click', function () {
        b.disabled = true; said.textContent = 'Opening…';
        OW.messaging.start([em]).then(function (out) {
          b.disabled = false;
          if (out.state === 'open' && out.conversation && opts.onOpen) { opts.onOpen(out.conversation); return; }
          said.textContent = out.state === 'held'
            ? 'Request sent. ' + (out.why || 'They see it once they accept.')
            : (out.why || 'They cannot be messaged right now.');
        });
      });
      list.appendChild(b);
    }
    function paint(people, title) {
      list.innerHTML = '';
      sh.textContent = title;
      if (!people.length) { list.appendChild(mk('p', 'ow-set__lede', 'Nobody by that name here.')); return; }
      people.forEach(row);
    }
    var me = String(data.me() || '');
    data.get('/api/oneway/graph/' + encodeURIComponent(me) + '/following?limit=30').then(function (r) {
      mine = ((r && r.ok && r.data && r.data.people) || []);
      if (!q.value.trim()) paint(mine, mine.length ? 'People you follow' : 'Search for someone to message');
    });
    var t = null, seq = 0;
    q.addEventListener('input', function () {
      var v = q.value.trim().toLowerCase();
      clearTimeout(t);
      var local = mine.filter(function (pp) {
        return !v || String(pp.name || '').toLowerCase().indexOf(v) >= 0 || String(pp.ref || '').toLowerCase().indexOf(v) >= 0;
      });
      paint(local, v ? 'People' : 'People you follow');
      if (v.length < 2) return;
      var my = ++seq;
      t = setTimeout(function () {
        data.get('/api/oneway/search?q=' + encodeURIComponent(v) + '&kind=person&limit=12').then(function (r) {
          if (my !== seq) return;
          var found = ((r && r.ok && r.data && r.data.results) || []).filter(function (x) { return x && (x.kind === 'person'); });
          var have = {}; local.forEach(function (pp) { have[String(pp.ref || pp.email || '').toLowerCase()] = 1; });
          found.forEach(function (x) {
            var em = String(x.ref || x.id || '').toLowerCase();
            if (em && !have[em] && em !== me.toLowerCase()) { local.push({ ref: em, name: x.name, picture: x.picture || x.image, handle: x.handle }); have[em] = 1; }
          });
          paint(local, 'People');
        });
      }, 250);
    });
    try { q.focus(); } catch (e) {}
  }

  /* ── IS THIS A CONVERSATION BETWEEN PEOPLE? ONE ANSWER ────────────────
     ★ FOUNDER/495: a person with no picture is an outline of a person.

     This file asked the question FIVE times and in THREE different ways:
     `kind === 'dm'`, `kind === 'dm' || kind === 'direct'`, and
     `kind !== 'dm' && type !== 'direct'`. The inbox sends `direct`, so the
     avatar's test — `c.kind !== 'dm'` — called every direct conversation a
     Center. Measured 2026-09-23: all four rows carried `data-kind="center"`,
     including loop.bo, a person, who was therefore drawn as a monogram instead
     of a face. The row two lines down resolved the same conversation as a
     PERSON and fetched their picture, so one row held two opinions about what
     it was looking at.

     One predicate, used everywhere. An object thread (a conversation ABOUT
     something) is not a person's row even when it is between two people —
     that is what `c.object` has always meant here. */
  function isDirect(c) {
    if (!c || c.object) return false;
    var k = String(c.kind || c.type || '').toLowerCase();
    return k === 'dm' || k === 'direct';
  }

  /* AN INBOX'S TIME, ONE WAY (founder/550): the clock today, then
     Yesterday, then the weekday, then the date — "now" and "6m" beside
     "10:54 AM" were two ways of saying the same thing in one column. */
  function inboxWhen(iso) {
    var d = new Date(iso || ''); if (isNaN(d.getTime())) return whenWords(iso);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var days = Math.round((t - x) / 86400000);
    if (days <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function threadRow(c, opts) {
    var b = mk('button', 'ow-thread'); b.type = 'button';
    if (c.unread) b.setAttribute('data-unread', String(c.unread));

    var av = mk('span', 'ow-thread__av');
    if (!isDirect(c)) av.setAttribute('data-kind', 'center');
    /* A DIRECT CONVERSATION HAS NO TITLE and is not supposed to have one — it
       is named by who is in it. Reading `title` alone printed "?" on every DM,
       which is the "Someone" failure in miniature: a placeholder standing in
       for data that is right there in the row. */
    /* founder/495: a DM row is a PERSON and gets the outline; a Center or a
       room keeps its monogram, which is what `data-kind="center"` above marks */
    if (!av.hasAttribute('data-kind') && OW.faceMark) av.innerHTML = OW.faceMark();
    else av.textContent = OW.initials ? OW.initials(rowTitle(c) || '?') : '?';
    /* THEIR COLOUR, NOT MINE. The stylesheet has always drawn this face from
       `--ch1`/`--ch2` ("the person's hue, on the person", founder/493) and
       nothing ever set them, so every face in the inbox wore the viewer's
       colour — Priya's amber and Jordan's blue were Maya's pink (found walking
       the App with the founder, 2026-09-26). The inbox row carries the face's
       own hue (`face.hue`); a room with none keeps the viewer's. */
    var _fh = c.face && typeof c.face.hue === 'number' && OW.hue && OW.hue.fromAngle
      ? OW.hue.fromAngle(c.face.hue) : null;
    if (_fh) { av.style.setProperty('--ch1', _fh[0]); av.style.setProperty('--ch2', _fh[1] || _fh[0]); }
    b.appendChild(av);
    /* ── THE OTHER PERSON, BY NAME AND FACE, NOT BY ADDRESS ──────────────
       The inbox read names a participant by email only, so a DM row said
       "ada.ops@ow.test" over an initial — measured on the founder's pane,
       2026-09-20. The person's own light read (`/api/oneway/people/{email}`)
       carries their display name, picture and shape; it is asked once per
       person (the data layer caches) and the row fills in when it answers.
       Until B composes people onto the inbox rows this is the honest way. */
    if (isDirect(c)) {
      var _mine = String(data.me() || '').toLowerCase();
      var _o = (c.participants || []).map(personOf).filter(function (p) {
        return p && !isBrain(p) && String(p.email || '').toLowerCase() !== _mine;
      })[0];
      if (_o && _o.email && /@/.test(_o.email) && !c.title) {
        data.get('/api/oneway/people/' + encodeURIComponent(_o.email)).then(function (r) {
          var d = (r && r.ok && r.data) || null; if (!d || !b.isConnected) return;
          var nm = b.querySelector('.ow-thread__nm');
          var name = d.display_name || d.name || '';
          if (nm && name) nm.textContent = name;
          var pic = d.picture ? (OW.imageUrl ? OW.imageUrl(d.picture) : d.picture) : '';
          if (pic) {
            av.textContent = '';
            var im = doc.createElement('img'); im.src = pic; im.alt = ''; im.decoding = 'async';
            im.className = 'ow-thread__face';
            av.appendChild(im);
            if (/^(round|rounded|square)$/.test(String(d.shape || ''))) av.setAttribute('data-shape', d.shape);
          }
        }).catch(function () {});
      }
    }

    /* THE OTHER PERSON'S NOTE, ON A DM ROW ONLY. This row IS the other person,
       so it is THEIR note — mine is already above my own face on my own
       profile. A room with several people has no single face, so it gets no
       note rather than an arbitrary one. */
    if (isDirect(c)) {
      var mine = String(data.me() || '').toLowerCase();
      var other = (c.participants || []).map(personOf).filter(function (p) {
        return p && String(p.email || '').toLowerCase() !== mine;
      })[0];
      if (other && other.note && OW.noteOn) OW.noteOn(av, other.note, 'sm');
    }

    var body = mk('div', 'ow-thread__b');
    var top = mk('div', 'ow-thread__top');
    top.appendChild(mk('span', 'ow-thread__nm', esc(rowTitle(c))));
    /* ── WHICH HAT YOU ARE WEARING ────────────────────────────────────────
       ★ B, 2026-09-12: the operator inbox now carries every Center a person
         operates, each row with `for_center {id, name}` — *"Show 'as Harbour
         Hotel' on those rows."*

       WITHOUT IT THE INBOX IS AMBIGUOUS IN THE WORST DIRECTION. An operator's
       own DMs and the messages customers wrote to their Centers arrive in one
       list, and a reply goes out in whichever identity the conversation
       belongs to. A person answering "yes, we're open Sunday" needs to know
       before they type whether that lands as themselves or as the business.

       ABSENT MEANS IT IS YOURS. `for_center` is null on a personal
       conversation, so the mark appears only where the answer is not
       obvious — a badge on every row would say nothing. */
    var forC = c.for_center || null;
    top.appendChild(mk('span', 'ow-thread__t',
      esc(inboxWhen(c.last_at || c.last_activity))));
    /* LAST IN THE ROW, so it is the thing that WRAPS when the line is tight.
       Placed between the name and the time it crushed the name to "a..." at
       375px — and then, once the name held its floor, crushed itself to the
       same. A badge that can only render an ellipsis says nothing; on a narrow
       phone this takes its own line and says the whole Center's name. */
    if (forC && forC.name) {
      top.appendChild(mk('span', 'ow-thread__as', esc('as ' + forC.name)));
    }
    body.appendChild(top);

    /* `preview`, not `body` — the runtime's own field name. Reading the wrong
       key returns undefined rather than throwing, so the row would say "No
       messages yet" beside a real message and every test of the shape would
       still pass. */
    var lm0 = c.last_message || {};
    /* a deleted last message or one without words still says what it was */
    var lastMsg = lm0.preview || lm0.body
      || (lm0.expired ? 'Disappeared' : lm0.deleted ? 'Message deleted'
          : (lm0.kind === 'image' ? 'Photo' : lm0.kind === 'video' ? 'Video'
             : (lm0.id ? 'Message' : '')));
    /* WHO SAID IT, the way every inbox says it: "You:" on your own last
       line, and in a group the speaker's first name — a preview without it
       reads as the other person having said your words (founder/550). */
    if (lastMsg && lm0.author) {
      var la = String(lm0.author).toLowerCase(), meNow = String(data.me() || '').toLowerCase();
      if (la === meNow) lastMsg = 'You: ' + lastMsg;
      else if (!isDirect(c)) {
        var lp = (c.people || []).filter(function (x) { return String((x && x.id) || '').toLowerCase() === la; })[0];
        var ln = String((lp && lp.name) || bare(la)).split(' ')[0];
        if (ln) lastMsg = ln + ': ' + lastMsg;
      }
    }
    body.appendChild(mk('div', 'ow-thread__last',
      esc(lastMsg || c.about || 'No messages yet')));
    b.appendChild(body);

    if (c.unread) b.appendChild(mk('span', 'ow-thread__n', esc(c.unread)));
    if (c.muted) b.appendChild(mk('span', 'ow-thread__mute', 'Muted'));
    b.addEventListener('click', function () { if (opts.onOpen) opts.onOpen(c); });
    return b;
  }

  /* Participants arrive as EMAIL STRINGS from `/inbox` and as objects from
     older reads. One normaliser rather than two renderers. */
  function personOf(p) {
    if (!p) return null;
    if (typeof p === 'string') return { email: p, name: bare(p) };
    /* an object participant with an email and no name is still a person, not
       an address — the thread's head read "ada.ops@ow.test" (measured
       2026-09-21) because `p.name || p.email` fell through to the email */
    if (!p.name && p.email && /@/.test(String(p.email))) {
      return { email: p.email, name: bare(p.email), picture: p.picture, shape: p.shape, person: p.person };
    }
    return p;
  }
  /* AN OPAQUE IDENTIFIER IS NOT A NAME. Center ids are 12 hex characters and
     the canonical row puts the OBJECT'S ID in `title` for an object
     conversation — measured 2026-09-12, an operator's inbox read
     "4f5097e13fdb" where the Center's name sat in the same row under
     `for_center`. A person reading their own messages should never meet a
     hex string, so anything shaped like one is refused as a title and the
     row falls through to something a person wrote. */
  function looksLikeAnId(t) {
    return /^[0-9a-f]{8,}$/i.test(String(t || '').trim());
  }

  /* AND A BRAIN IS NOT A PERSON IN THE LIST OF PEOPLE. Participants carry
     `brain:<center_id>` for a Center that answers with its Brain; naming it
     alongside the humans would put "brain:4f5097e13fdb" in a row that is
     supposed to say who you are talking to. The reception disclosure is where
     a Brain is declared, and it says so in words. */
  function isBrain(p) {
    return /^brain:/i.test(String((p && (p.email || p)) || ''));
  }

  function titleFor(c) {
    var mine = String(data.me() || '').toLowerCase();
    var others = (c.participants || []).filter(function (raw) {
      return !isBrain(raw);
    }).map(personOf).filter(function (p) {
      return p && !isBrain(p) && String(p.email || '').toLowerCase() !== mine;
    });
    if (others.length) {
      return others.map(function (p) { return p.name || p.email; }).join(', ');
    }
    /* NOBODY ELSE IS NAMED. If the row says which Center it is FOR, that is
       the honest name for it — you are looking at this Center's reception.
       Otherwise say what it is rather than inventing who it is with. */
    var fc = c.for_center || null;
    if (fc && fc.name) return fc.name;
    if (c.object && c.object.type === 'center') return 'A Center';
    return 'Conversation';
  }

  /* THE ONE PLACE A ROW IS NAMED, so the id check cannot be applied in one
     caller and forgotten in the next. */
  function rowTitle(c) {
    var t = (c && c.title) || '';
    /* ── A ROW DOES NOT SAY THE SAME WORDS TWICE ──────────────────────────
       On an operator's row the canonical title is the CENTER'S NAME, and the
       badge beside it already says "as <that Center>". Rendered together the
       row read "Marlow & Pike · as Marlow & Pike" — the page repeating itself,
       which is the same defect this platform already corrected on the Center's
       About tab.

       FROM THE OPERATOR'S SIDE THE ROW IS THE CUSTOMER. They know which of
       their Centers it is — the badge says so; what they need is WHO is
       writing. So when the title only restates the badge, the row falls
       through to the people in it. On anybody else's row the Center's name is
       exactly right and is left alone. */
    var fc = (c && c.for_center) || null;
    if (fc && fc.name && String(t).trim() === String(fc.name).trim()) {
      var who = titleFor(c);
      if (who && who !== fc.name) return who;
    }
    if (t && !looksLikeAnId(t)) return t;
    return titleFor(c);
  }

  /* ── MESSAGE REQUESTS ─────────────────────────────────────────────────────
     ★ FOUNDER's list: *"DM controls"*. `message_requests` — hold a stranger's
     first message instead of delivering it — had a setting, a store, a service
     and two routes, and NOTHING RENDERED IT. A person's requests were held
     correctly and were invisible to them, which is the same thing as losing
     the message with extra steps.

     DECLINING IS NOT BLOCKING and this says so, because the domain is explicit
     that they are different acts with different meanings. */
  function requestsBlock(reqs, opts) {
    var box = mk('section', 'ow-reqs');
    var h = mk('div', 'ow-reqs__top');
    h.appendChild(mk('b', 'ow-reqs__ttl',
      esc(reqs.length === 1 ? '1 message request' : reqs.length + ' message requests')));
    /* no explanatory subtitle (S17's spirit): "1 message request" and the
       person's row say it */
    box.appendChild(h);

    reqs.forEach(function (q) {
      var sender = q.from || q['from'] || '';
      var row = mk('div', 'ow-req');
      var av = mk('span', 'ow-thread__av');
      if (OW.faceMark) av.innerHTML = OW.faceMark();          /* founder/495 */
      else av.textContent = OW.initials ? OW.initials(sender) : '?';
      row.appendChild(av);
      var b = mk('div', 'ow-req__b');
      var reqNm = mk('span', 'ow-req__nm', esc(bare(sender || '')));
      b.appendChild(reqNm);
      if (/@/.test(sender)) {
        data.get('/api/oneway/people/' + encodeURIComponent(sender)).then(function (r) {
          var d = (r && r.ok && r.data) || null;
          if (d && (d.display_name || d.name) && reqNm.isConnected) reqNm.textContent = d.display_name || d.name;
        }).catch(function () {});
      }
      /* WHAT THEY SAID, when they said something — who they are and why is
         the whole decision (founder/556) */
      if (q.message) b.appendChild(mk('span', 'ow-req__msg', esc(q.message)));
      /* each face in its own person's colour, as everywhere */
      if (/@/.test(sender)) {
        data.get('/api/oneway/people/' + encodeURIComponent(sender)).then(function (r) {
          var d = (r && r.ok && r.data) || null;
          if (d && typeof d.hue === 'number' && OW.hue && OW.hue.fromAngle && av.isConnected) {
            var hh = OW.hue.fromAngle(d.hue); av.style.setProperty('--ch1', hh[0]); av.style.setProperty('--ch2', hh[1] || hh[0]);
          }
        }).catch(function () {});
      }
      b.appendChild(mk('span', 'ow-req__t', esc(whenWords(q.at))));
      row.appendChild(b);

      var acts = mk('div', 'ow-req__acts');
      var yes = mk('button', 'po-act po-act--go', 'Accept'); yes.type = 'button';
      var no = mk('button', 'po-act', 'Decline'); no.type = 'button';
      function decide(accept, btn) {
        acts.setAttribute('data-busy', '1');
        yes.disabled = no.disabled = true;
        data.post(API + '/requests/' + encodeURIComponent(sender), { accept: accept })
          .then(function (r) {
            acts.removeAttribute('data-busy');
            if (!r.ok) {
              yes.disabled = no.disabled = false;
              acts.innerHTML = '';
              acts.appendChild(mk('span', 'ow-req__no', esc(why(r))));
              return;
            }
            data.invalidate(API);
            var c = (r.data || {}).conversation;
            row.setAttribute('data-decided', accept ? 'accepted' : 'declined');
            acts.innerHTML = '';
            acts.appendChild(mk('span', 'ow-req__done',
              accept ? 'Accepted' : 'Declined'));
            /* ACCEPTING OPENS IT FOR REAL — the conversation is created in the
               recipient's name, which is the whole point of a request. Walking
               them into it is the honest next step; leaving them on a list
               with a green tick is not. */
            /* THE ACCEPT RESPONSE'S CONVERSATION CARRIES NO ROSTER — it is
               the row as just created, and the roster is written beside it.
               The App knows both people anyway: it is me and the person whose
               request I just accepted. Naming them from what is already in
               hand is not inventing data; leaving the thread called
               "Conversation" would be discarding it. */
            if (accept && c && opts.onOpen) {
              if (!c.participants || !c.participants.length) {
                c.participants = [data.me(), sender].filter(Boolean);
              }
              global.setTimeout(function () { opts.onOpen(c); }, 260);
            }
          });
      }
      yes.addEventListener('click', function () { decide(true, yes); });
      no.addEventListener('click', function () { decide(false, no); });
      acts.appendChild(yes); acts.appendChild(no);
      row.appendChild(acts);
      box.appendChild(row);
    });
    return box;
  }

  /* ══ ONE CONVERSATION ═══════════════════════════════════════════════════ */

  OW.live.thread = function (host, conv, opts) {
    opts = opts || {};
    if (!conv || !conv.id) return Promise.resolve(0);
    var cid = conv.id;
    var me = (data.me() || '').toLowerCase();

    host.className = ''; host.innerHTML = '';
    /* a chat's settings page belongs to that chat: opening another chat from
       it (a notification, a link) must not inherit "settings open" and hide
       the new chat's bar — the host is reused (founder/553 check) */
    host.removeAttribute('data-chatset');

    /* ── STATE, ALL OF IT NAMED ──────────────────────────────────────────
       `rows` is the truth; `byId` is the index that makes a realtime merge
       cost a lookup instead of a scan; `readBy` is a WATERMARK PER PERSON
       rather than a flag per message, because that is what the server
       actually publishes and storing it any other way would mean inventing
       state the server never said. */
    var rows = [], byId = {}, readBy = {}, replyTo = null;
    var policy = {}, myRole = '', oldest = null, more = false;
    var acked = {};
    var closed = false;

    /* ══ THE CHAT'S OWN BAR — founder/550, 552 ════════════════════════════
       *"it needs to feel iconic but also simple enough and familar enough to
       use every day"*. The head was a "Back" pill, a name, and chips — and it
       scrolled away with the page, so at the bottom of a conversation nobody
       could see who they were talking to or get back. It is pinned now, the
       way every messenger's is, and it reads the way they all read: an arrow,
       the face in that person's own colour, their name, one quiet line under
       it (here now, or what this chat does with messages), and the menu. */
    var head = mk('div', 'ow-thread-head');
    if (opts.onBack) {
      var back = mk('button', 'ow-thread-head__back'); back.type = 'button';
      back.setAttribute('aria-label', 'Back to Messages');
      back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
      back.addEventListener('click', function () { teardown(); opts.onBack(); });
      head.appendChild(back);
    }
    /* the face the inbox row wears for this chat, so the two always agree */
    var headFace = mk('span', 'ow-thread__av ow-thread-head__face');
    (function () {
      var fc = conv.face || {};
      var direct = isDirect(conv);
      if (!direct) headFace.setAttribute('data-kind', 'center');
      if (fc.image) {
        var hi = doc.createElement('img'); hi.src = OW.imageUrl ? OW.imageUrl(fc.image) : fc.image; hi.alt = ''; headFace.appendChild(hi);
      } else if (direct && OW.faceMark) headFace.innerHTML = OW.faceMark();
      else {
        /* a group's own name first, the way its inbox row letters it */
        var gt = (conv.title && !/@/.test(String(conv.title)) && !looksLikeAnId(conv.title)) ? conv.title : titleFor(conv);
        headFace.textContent = OW.initials ? OW.initials(gt || '?') : '?';
      }
      if (typeof fc.hue === 'number' && OW.hue && OW.hue.fromAngle) {
        var hh = OW.hue.fromAngle(fc.hue); headFace.style.setProperty('--ch1', hh[0]); headFace.style.setProperty('--ch2', hh[1] || hh[0]);
      }
      if (/^(round|rounded|square)$/.test(String(fc.shape || '')) && direct) headFace.setAttribute('data-shape', fc.shape);
    })();
    head.appendChild(headFace);
    /* the bar's own name and face, redrawn when the room is renamed or given
       a picture (founder/556) */
    function paintHead() {
      var fc = conv.face || {};
      if (!isDirect(conv) && conv.title && headNm) headNm.textContent = conv.title;
      if (!isDirect(conv)) {
        headFace.innerHTML = '';
        if (fc.image) { var hi2 = doc.createElement('img'); hi2.src = OW.imageUrl ? OW.imageUrl(fc.image) : fc.image; hi2.alt = ''; headFace.appendChild(hi2); }
        else headFace.textContent = OW.initials ? OW.initials(conv.title || titleFor(conv) || '?') : '?';
      }
    }
    var hb = mk('div', 'ow-thread-head__b');
    /* the head is named the way the inbox row is — never by an address; a
       title that is itself an email is not a title */
    var headTitle = (conv.title && !/@/.test(String(conv.title)) && !looksLikeAnId(conv.title)) ? conv.title : titleFor(conv);
    var headNm = mk('b', 'ow-thread-head__nm', esc(headTitle));
    hb.appendChild(headNm);
    /* AND THE PERSON'S OWN NAME, from their light read — the same read the
       inbox row makes (3e14b619) — so the two never disagree about who this is */
    (function () {
      var mine0 = String(data.me() || '').toLowerCase();
      var other = (conv.participants || []).map(personOf).filter(function (p) {
        return p && !isBrain(p) && String(p.email || '').toLowerCase() !== mine0;
      });
      if (!isDirect(conv) || other.length !== 1 || !other[0].email || !/@/.test(other[0].email)) return;
      data.get('/api/oneway/people/' + encodeURIComponent(other[0].email)).then(function (r) {
        var d = (r && r.ok && r.data) || null;
        if (d && (d.display_name || d.name) && headNm.isConnected) headNm.textContent = d.display_name || d.name;
      }).catch(function () {});
    })();
    /* ── WHETHER THEY ARE THERE ───────────────────────────────────────────
       `GET …/messaging/screen` has answered `people[]` with `status` and
       `last_seen_at` since it was written, and no surface drew either: a
       person opened a conversation and could not tell whether the other side
       was reading it. The line under the name says what is true for the other
       people in THIS room — "Online", or when they were last seen — and says
       nothing at all when the runtime does not know, which is a different
       fact from "offline" and must not be rendered as one.
       A room with many people says how many are here rather than listing. */
    var presence = mk('span', 'ow-thread-head__pr');
    presence.hidden = true;
    hb.appendChild(presence);
    function agoWords(ts) {
      if (!ts) return '';
      var secs = Math.floor(Date.now() / 1000) - Number(ts);
      if (!isFinite(secs) || secs < 0) return '';
      if (secs < 90) return 'just now';
      if (secs < 3600) return Math.round(secs / 60) + 'm ago';
      if (secs < 86400) return Math.round(secs / 3600) + 'h ago';
      var d = Math.round(secs / 86400);
      return d === 1 ? 'yesterday' : (d + 'd ago');
    }
    function paintPresence(rows) {
      var others = (rows || []).filter(function (p) {
        return p && p.email && String(p.email).toLowerCase() !== me;
      });
      if (!others.length) { presence.hidden = true; return; }
      var on = others.filter(function (p) { return p.status === 'online'; });
      var txt = '';
      if (on.length === others.length && others.length === 1) txt = 'Online';
      else if (on.length) txt = on.length + ' online';
      else if (others.length === 1) {
        var w = agoWords(others[0].last_seen_at);
        txt = w ? ('Last seen ' + w) : '';
      }
      if (!txt) { presence.hidden = true; return; }
      presence.textContent = txt;
      presence.setAttribute('data-on', on.length ? '1' : '');
      presence.hidden = false;
    }
    /* WHAT THIS IS ABOUT stays visible while you read it — the object model,
       in the one place a familiar messaging UI has no equivalent for. */
    if (conv.about) hb.appendChild(mk('span', 'ow-thread-head__ab', esc(conv.about)));
    var facts = mk('div', 'ow-thread-head__facts');
    hb.appendChild(facts);
    head.appendChild(hb);
    /* ── CHAT SETTINGS, TIKTOK'S WAY (founder/510) ───────────────────────
       *"messaging menus for users and individual DMs look a lot like
       TikTok's menus … labelled into different areas and it's easy to get
       back and into different sections."* The chat's controls were chips
       under its name; they are one page now, behind the header's "…", with
       a back arrow — the same rows and sections the Settings pages use. */
    var moreB = mk('button', 'ow-thread-head__more'); moreB.type = 'button';
    moreB.setAttribute('aria-label', 'Chat settings');
    moreB.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
    moreB.addEventListener('click', function () { openChatSet(); });
    /* WHO THIS IS IS THE DOOR TO WHAT THIS CHAT IS (founder/554, point 6) —
       pressing the name or the face opens the chat's controls, the way every
       messenger's header does; the ⋯ stays for anybody who looks for it. */
    [headFace, hb].forEach(function (el) {
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.setAttribute('aria-label', 'Chat settings');
      el.addEventListener('click', function () { openChatSet(); });
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openChatSet(); } });
    });
    hb.classList.add('is-door');
    head.appendChild(moreB);
    host.appendChild(head);
    var chatSet = mk('div', 'ow-chatset'); chatSet.hidden = true;
    host.appendChild(chatSet);
    /* what the page reads — filled by the same reads the chips used */
    var ntfInfo = null, retInfo = null, mayAdd = false;

    var older = mk('div', 'ow-msgs__older');
    host.appendChild(older);

    var msgs = mk('div', 'ow-msgs');
    host.appendChild(msgs);

    var typing = mk('div', 'ow-typing'); typing.hidden = true;
    host.appendChild(typing);

    var foot = mk('div', 'ow-thread__foot');
    host.appendChild(foot);

    /* ── SCROLL IS THE PERSON'S, NOT THE PAGE'S ──────────────────────────
       ★ FOUNDER/346 §31: removing or inserting DOM *"must never alter scroll
       position"*. A message arriving while somebody is reading history must
       not throw them to the bottom, and loading older messages must not move
       the words under their eyes. Both are handled by measuring, never by
       hoping. */
    function atBottom() {
      return (global.innerHeight + global.scrollY)
        >= (doc.documentElement.scrollHeight - 90);
    }
    function toBottom() {
      try { global.scrollTo(0, doc.documentElement.scrollHeight); } catch (e) {}
    }

    /* ══ RENDERING ONE MESSAGE ═══════════════════════════════════════════ */

    /* the time a message was sent, the way every messenger writes it on the
       message — the day is said once, above, by the day line */
    function clockOf(iso) {
      var d = new Date(iso || '');
      if (isNaN(d.getTime())) return whenWords(iso);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    function dayOf(iso) {
      var d = new Date(iso || ''); if (isNaN(d.getTime())) return '';
      var t = new Date(); t.setHours(0, 0, 0, 0);
      var x = new Date(d); x.setHours(0, 0, 0, 0);
      var days = Math.round((t - x) / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }
    function bubble(m, run) {
      run = run || { first: true, last: true };
      var n = mk('div', 'ow-msg');
      /* WHERE IT SITS IN A RUN (founder/552): the first of a run carries the
         name in a group and the space above it; the last carries the time and
         the tail. A message in the middle is just the words. */
      if (run.first) n.setAttribute('data-first', '1');
      if (run.last) n.setAttribute('data-last', '1');
      /* THEIR MESSAGES IN THEIR COLOUR. Every bubble from the other side wore
         the viewer's hue, so Jordan's words were Maya's pink beside Jordan's
         own blue face. A person is one colour everywhere (founder/550): their
         face, their name in a group, their bubbles' light. */
      var _au = String(m.author || '').toLowerCase();
      var _w = m.who || (peopleOf() || {})[_au] || null;
      if (_au && _au !== me && _w && typeof _w.hue === 'number' && OW.hue && OW.hue.fromAngle) {
        var _hp = OW.hue.fromAngle(_w.hue);
        n.style.setProperty('--h', _hp[0]); n.style.setProperty('--h2', _hp[1] || _hp[0]);
      }
      n.setAttribute('data-mid', m.id || '');
      if (m.seq) n.setAttribute('data-seq', String(m.seq));
      var mine = m.mine != null ? !!m.mine
        : (String(m.author || '').toLowerCase() === me);
      if (mine) n.setAttribute('data-mine', '1');

      if (m.deleted) {
        /* A REMOVED MESSAGE IS NOT A GAP. The server keeps the row and reports
           `deleted` with no author and no body — so the honest rendering is a
           line saying something was removed, in the place it was removed from.
           Painting nothing would silently renumber the conversation. */
        n.setAttribute('data-gone', '1');
        n.appendChild(mk('span', 'ow-msg__gone',
          esc(m.deleted_by === 'admin' ? 'Removed by an admin' : 'Message removed')));
        return n;
      }

      if (!mine && run.first && conv.kind !== 'dm' && conv.type !== 'direct') {
        /* the name the server resolved, not the local part of an address */
        var who = (m.who && m.who.name) || m.author_name || bare(m.author || '');
        if (who) n.appendChild(mk('span', 'ow-msg__who', esc(who)));
      }

      /* ── WHAT IT ANSWERS, RESOLVED BY THE SERVER ──────────────────────
         `replying_to` arrives already resolved and already refusing to carry
         a removed parent — so this renders what it is given and never goes
         and fetches a parent itself. A reply is CONTAINED: a quoted line
         above the message, inside the same bubble, not a second bubble that
         looks like its own message. */
      if (m.replying_to && m.replying_to.available !== false) {
        var q = mk('button', 'ow-msg__q'); q.type = 'button';
        var qem = String(m.replying_to.author || '').toLowerCase();
        var qw = (peopleOf() || {})[qem] || {};
        var qname = qem === me ? 'You' : (m.replying_to.author_name || qw.name || bare(qem) || 'Reply');
        q.appendChild(mk('span', 'ow-msg__q-who', esc(qname)));
        /* `excerpt` IS THE CONTRACT'S NAME FOR IT, and I guessed `body` then
           `preview`. Both are undefined, which renders as an empty line rather
           than throwing — so the sender saw the quote (their own optimistic
           copy carried the parent's text under a name they had chosen) and the
           RECEIVER saw an author with nothing beneath them. Two halves that
           each looked right from where they were written.

           It is the same mistake this file already records one layer up, where
           an inbox row's last message is `preview` and not `body`. A quote is
           deliberately not a copy — 120 characters, so that removing the
           original still means something — and that is why it has a name of
           its own. */
        q.appendChild(mk('span', 'ow-msg__q-b',
          esc(String(m.replying_to.excerpt || '').slice(0, 140))));
        q.addEventListener('click', function (ev) { ev.stopPropagation(); jumpTo(m.replying_to.id); });
        n.appendChild(q);
      } else if (m.reply_to) {
        n.appendChild(mk('span', 'ow-msg__q ow-msg__q--gone', 'In reply to a removed message'));
      }

      /* A PHOTO IS THE MESSAGE AND ITS WORDS ARE ITS CAPTION (founder/554:
         "the image + caption/message relationship should feel like one
         coherent message"): the picture first, edge to edge, then the words
         under it. Anything else attached keeps the words first. */
      var atts = m.attachments || [];
      var isPic = atts.length && atts.every(function (a) { return a && a.url && (a.kind === 'image' || a.kind === 'video' || a.type === 'media'); });
      if (isPic) atts.forEach(function (a) { n.appendChild(attachment(a, m)); });
      if (m.body) n.appendChild(mk('span', 'ow-msg__x', esc(m.body)));
      if (!isPic) atts.forEach(function (a) { n.appendChild(attachment(a, m)); });

      var meta = mk('span', 'ow-msg__t');
      meta.appendChild(mk('span', 'ow-msg__tt', esc(clockOf(m.created_at))));
      if (m.edited) meta.appendChild(mk('i', 'ow-msg__ed', 'edited'));
      n.appendChild(meta);

      n.appendChild(reactionsRow(m));
      n.appendChild(actionsRow(m, mine));
      /* ── ITS ACTIONS ARE THERE WHEN YOU ASK FOR THEM (founder/550, 552) ──
         Reply · React · Edit · Remove sat under EVERY message, so one line of
         words was an 87px card and a conversation was a column of toolbars.
         Every messenger a person already knows keeps them behind a press: a
         tap or a long press on the message opens them (with its time), a
         second tap or anywhere else closes them. With a mouse they also show
         on hover. Nothing is removed — only when it is on screen. */
      if (!m.pending) {
        n.tabIndex = 0;
        n.addEventListener('click', function (ev) {
          if (ev.target.closest('button, a, video, textarea, input, .ow-msg__acts')) return;
          openActs(n);
        });
        n.addEventListener('contextmenu', function (ev) {
          if (ev.target.closest('a, textarea, input')) return;
          ev.preventDefault(); openActs(n, true);
        });
        n.addEventListener('keydown', function (ev) {
          if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === n) { ev.preventDefault(); openActs(n); }
          if (ev.key === 'Escape') closeActs();
        });
      }
      return n;
    }
    var openMsg = null;
    function closeActs() {
      if (openMsg) { openMsg.removeAttribute('data-open'); openMsg = null; }
    }
    function openActs(n, keep) {
      if (openMsg === n && !keep) { closeActs(); return; }
      closeActs();
      n.setAttribute('data-open', '1');
      openMsg = n;
    }
    function onOutside(ev) {
      if (openMsg && !openMsg.contains(ev.target)) closeActs();
    }
    doc.addEventListener('pointerdown', onOutside, true);

    /* ══ A PHOTO OR A VIDEO SOMEBODY SENT ══════════════════════════════════
       ★ FOUNDER/438: *"they click on a video their friend sent you — is there
         a back arrow with their name and profile picture transparently over
         the video and does it look clean?"*
       The bubble carries the thing itself, bounded; the tap opens OW.viewer
       with the sender's one face (436), their name and when over it. */
    function mediaAttachment(a, m) {
      var isVideo = a.kind === 'video';
      var box = mk('button', 'ow-msg__media'); box.type = 'button';
      if (isVideo) box.setAttribute('data-video', '1');
      box.setAttribute('aria-label', (isVideo ? 'Video' : 'Photo') + ' — open');
      var url = OW.imageUrl ? OW.imageUrl(a.url) : a.url;
      if (isVideo) {
        var v = doc.createElement('video'); v.src = url; v.muted = true; v.playsInline = true;
        v.preload = 'metadata'; v.setAttribute('aria-hidden', 'true');
        if (a.poster) v.poster = OW.imageUrl ? OW.imageUrl(a.poster) : a.poster;
        box.appendChild(v);
      } else {
        var im = doc.createElement('img'); im.src = url; im.alt = a.alt || ''; im.loading = 'lazy'; im.decoding = 'async';
        im.addEventListener('error', function () { box.setAttribute('data-gone', '1'); im.remove(); box.textContent = 'This photo is no longer available'; }, { once: true });
        box.appendChild(im);
      }
      box.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!OW.viewer) return;
        var em = String(m.author || '').toLowerCase();
        var w = m.who || (peopleOf() || {})[em] || {};
        OW.viewer.open({
          url: a.url, kind: isVideo ? 'video' : 'image', poster: a.poster || '',
          caption: m.body || '',
          when: whenWords(m.created_at),
          who: { name: w.name || bare(em) || '', picture: w.image || '', shape: w.shape || 'round', hue: w.hue,
                 onPress: (em && w.account !== false) ? function () {
                   try { doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { email: em } })); } catch (e) {}
                 } : null }
        });
      });
      return box;
    }

    function attachment(a, m) {
      /* the door normalises a media attachment into the platform's media
         item — {url, kind: image|video, width, height, thumb …} — so the
         thing is recognised by what it IS, not by a tag the sender set */
      if (a && a.url && (a.kind === 'image' || a.kind === 'video' || a.type === 'media')) return mediaAttachment(a, m || {});
      var box = mk('div', 'ow-att');
      var res = (a && a.resolved) || null;

      if (res && res.available === false) {
        /* THE REFERENCE OUTLIVED THE THING. A share is a reference, not a
           copy, so a deleted original reports itself unavailable — and saying
           so is the whole value of it being a reference rather than a copy of
           words its author has since removed. */
        box.setAttribute('data-empty', '1');
        box.appendChild(mk('span', 'ow-att__gone',
          esc(res.reason || 'this is no longer available')));
        return box;
      }

      /* ── THE RESOLVED OBJECT IS NESTED UNDER ITS OWN TYPE ──────────────
         `resolve` answers `{available, post: {...}}` — the subject keyed by
         `subject_type`, not spread at the top level. Reading `res.title` and
         `res.body` found neither, so this fell through to its last resort and
         rendered the literal string **"shared_content"** into a message: a
         machine name, shown to a person, in the one place the platform is
         supposed to be a conversation.

         Third time in this file that a guessed key rendered as nothing or as
         nonsense (`preview`, `excerpt`, and now this). The pattern is always
         the same and so is the fix: read the contract, then write the reader. */
      var kind = (a && a.subject_type) || 'post';
      var obj = res && (res[kind] || res.subject || null);

      if (obj) {
        var card = mk('button', 'ow-att__card'); card.type = 'button';
        var who = (obj.author && (obj.author.name || obj.author.email)) || '';
        if (who) card.appendChild(mk('span', 'ow-att__who', esc(who)));
        var words = obj.title || obj.body || '';
        if (words) card.appendChild(mk('span', 'ow-att__b',
          esc(String(words).slice(0, 200))));
        var pic = (obj.media || [])[0];
        var picUrl = pic && (pic.url || pic.src || (typeof pic === 'string' ? pic : ''));
        if (picUrl) {
          var im = doc.createElement('img');
          im.loading = 'lazy'; im.alt = '';
          /* THE SAME FAILURE PATH THE FEED USES. A share whose picture is gone
             collapses to its words rather than leaving a picture-shaped hole. */
          im.addEventListener('error', function () {
            try { im.remove(); } catch (_) {}
          }, { once: true });
          im.src = OW.imageUrl ? OW.imageUrl(picUrl) : picUrl;
          card.insertBefore(im, card.firstChild);
        }
        if (obj.destination_name) {
          card.appendChild(mk('span', 'ow-att__where', esc(obj.destination_name)));
        }
        /* A SHARE IS A DOOR TO THE ORIGINAL, which is the point of it being a
           reference. The App already routes `#post/<id>`; this uses that
           rather than teaching the thread how to open a Post. */
        if (obj.id && kind === 'post') {
          card.addEventListener('click', function () {
            try { global.location.hash = '#post/' + encodeURIComponent(obj.id); } catch (e) {}
          });
        } else {
          card.disabled = true;
        }
        box.appendChild(card);
        return box;
      }

      /* A PLAIN FILE. */
      var url = (a && (a.url || a.src)) || '';
      if (url && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) {
        var im2 = doc.createElement('img');
        im2.loading = 'lazy'; im2.alt = a.alt || '';
        im2.addEventListener('error', function () {
          box.setAttribute('data-empty', '1');
          try { im2.remove(); } catch (_) {}
          box.appendChild(mk('span', 'ow-att__gone', 'this picture could not be loaded'));
        }, { once: true });
        im2.src = OW.imageUrl ? OW.imageUrl(url) : url;
        box.appendChild(im2);
        return box;
      }

      /* NOTHING RESOLVED AND NOTHING TO SHOW. It says that, in words — never
         the attachment's own type name, which is what it used to do. */
      box.setAttribute('data-empty', '1');
      box.appendChild(mk('span', 'ow-att__gone',
        esc((a && a.name) || (a && a.preview) || 'a shared item')));
      return box;
    }

    var EMOJI = ['❤️', '👍', '😂', '😮', '😢'];

    function reactionsRow(m) {
      var row = mk('div', 'ow-rx');
      var rx = m.reactions || {};
      Object.keys(rx).forEach(function (e) {
        var who = rx[e] || [];
        if (!who.length) return;
        var chip = mk('button', 'ow-rx__c'); chip.type = 'button';
        if (who.indexOf(me) >= 0) chip.setAttribute('aria-pressed', 'true');
        else chip.setAttribute('aria-pressed', 'false');
        chip.appendChild(doc.createTextNode(e));
        chip.appendChild(mk('b', '', String(who.length)));
        chip.setAttribute('aria-label', e + ', ' + who.length);
        chip.addEventListener('click', function () { react(m.id, e); });
        row.appendChild(chip);
      });
      return row;
    }

    function actionsRow(m, mine) {
      var row = mk('div', 'ow-msg__acts');
      /* NOTHING TO ACT ON YET. A message the server has not accepted has no
         id anybody else could reply to or react to, so offering both is
         offering an act that cannot be performed — the Join-button-on-a-Center
         -you-cannot-join shape, one layer down. */
      if (m.pending) return row;
      if (policy.replies !== 'deny') {
        var rp = mk('button', 'ow-msg__act', 'Reply'); rp.type = 'button';
        rp.addEventListener('click', function () { closeActs(); aimReply(m); });
        row.appendChild(rp);
      }
      if (policy.reactions !== 'deny') {
        var rx = mk('button', 'ow-msg__act', 'React'); rx.type = 'button';
        rx.setAttribute('aria-expanded', 'false');
        rx.addEventListener('click', function () {
          var open = row.querySelector('.ow-rx__pick');
          if (open) { open.remove(); rx.setAttribute('aria-expanded', 'false'); return; }
          var pick = mk('span', 'ow-rx__pick');
          EMOJI.forEach(function (e) {
            var b = mk('button', 'ow-rx__p', e); b.type = 'button';
            b.setAttribute('aria-label', 'React ' + e);
            b.addEventListener('click', function () {
              pick.remove(); rx.setAttribute('aria-expanded', 'false'); closeActs(); react(m.id, e);
            });
            pick.appendChild(b);
          });
          row.appendChild(pick);
          rx.setAttribute('aria-expanded', 'true');
        });
        row.appendChild(rx);
      }
      /* MAY_EDIT AND MAY_DELETE ARE THE SERVER'S ANSWER, not a guess from
         authorship. An admin may remove somebody else's message where the
         room's policy allows it, and the author may not where it does not —
         neither is derivable here, and both are already decided per message. */
      if (m.may_edit) {
        var ed = mk('button', 'ow-msg__act', 'Edit'); ed.type = 'button';
        ed.addEventListener('click', function () { closeActs(); editInline(m); });
        row.appendChild(ed);
      }
      if (m.may_delete) {
        /* CONFIRMED IN PLACE (no pop-ups, standing rule): the first press asks,
           the second removes — the pattern Block already uses. It used the
           browser's own confirm() because the App's confirm screen does not
           exist here. */
        var dl = mk('button', 'ow-msg__act', 'Remove'); dl.type = 'button';
        dl.addEventListener('click', function () {
          if (!dl.hasAttribute('data-armed')) {
            dl.setAttribute('data-armed', '1');
            dl.textContent = 'Tap again to remove';
            global.setTimeout(function () {
              if (dl.isConnected) { dl.removeAttribute('data-armed'); dl.textContent = 'Remove'; }
            }, 3200);
            return;
          }
          closeActs(); removeMsg(m);
        });
        row.appendChild(dl);
      }
      return row;
    }

    function jumpTo(mid) {
      var n = msgs.querySelector('[data-mid="' + cssq(mid) + '"]');
      if (!n) return;
      n.scrollIntoView({ block: 'center', behavior: 'smooth' });
      n.setAttribute('data-flash', '1');
      global.setTimeout(function () { n.removeAttribute('data-flash'); }, 900);
    }
    function cssq(s) {
      return (global.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s);
    }

    /* ══ PAINTING THE WHOLE LIST ═════════════════════════════════════════ */

    /* ── WHO SAID IT, WEARING THEIR OWN FACE ─────────────────────────────
       ★ FOUNDER/409: *"I want to start seeing their profile pictures
         everywhere. Make sure it supports the square and circle
         orientation."*  B's page read carries `who` on every message —
         {email, name, image, shape, hue} — and the bubble drew none of it:
         a name in a group room, nothing at all in a DM.

       THE FACE SITS AT THE END OF A RUN, not on every bubble: five messages
       in a row from one person are one person, and five faces down the
       margin is noise. The others keep the space, so the column never
       shifts. `mine` never wears one — you know who you are. */
    function faceFor(m) {
      var em = String(m.author || '').toLowerCase();
      var w = m.who || (peopleOf() || {})[em] || null;
      /* A SYSTEM LINE HAS NO AUTHOR and must not wear an empty circle: the
         room's own opening sentence ("You are chatting with …") arrives with
         `author: ""` and `who: {}`. Nobody said it, so nobody is drawn. */
      if (!em) return null;
      if (w && !w.email && !w.name && !w.image) w = null;
      w = w || { email: em, name: bare(em) };
      var f = mk('span', 'ow-msg-face');
      var shape = String(w.shape || 'round').toLowerCase();
      if (/^(round|rounded|square)$/.test(shape)) f.setAttribute('data-shape', shape);
      var hp = (typeof w.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(w.hue) : null;
      if (hp) { f.style.setProperty('--h', hp[0]); f.style.setProperty('--h2', hp[1] || hp[0]); }
      var url = w.image || '';
      if (url) {
        var im = doc.createElement('img');
        im.src = OW.imageUrl ? OW.imageUrl(url) : url;
        im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        f.appendChild(im);
      } else {
        if (OW.faceMark) f.innerHTML = OW.faceMark();          /* founder/495 */
        else f.appendChild(mk('i', '', esc(OW.initials ? OW.initials(w.name || w.email) : String(w.name || w.email || '').slice(0, 2).toUpperCase())));
      }
      f.title = w.name || w.email || '';
      /* a face is a door to the person (founder/411: "you move between the
         Center and Profiles") — unless there is no one behind it: an address
         with no ONEWAY account (B 1dee46f9, `account:false`) has no profile,
         and a door onto "not found" is worse than a face. `null` means the
         account store could not answer, which is not "no": still a door. */
      if (w.email && w.account !== false) {
        f.setAttribute('role', 'button'); f.tabIndex = 0;
        f.setAttribute('aria-label', 'Open ' + (w.name || w.email));
        f.addEventListener('click', function (ev) {
          ev.stopPropagation();
          try { doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { email: w.email } })); } catch (e) {}
        });
      }
      return f;
    }
    var _people = null;
    function peopleOf() { return _people; }

    /* ── WHAT HAS ALREADY BEEN ON SCREEN ────────────────────────────────
       ★ FOUNDER/493: *"the service should have smooth animations like
         iMessage."*
       `paint()` rebuilds the whole thread on every change, so animating every
       row would replay the entire conversation each time somebody typed. The
       ids seen on the last paint are remembered, and ONLY a row that was not
       there before is marked as arriving. The first paint marks nothing — a
       thread opens, it does not perform. */
    var _seenMsg = null;
    /* A MESSAGE'S SENDING STATE LIVES ON THE MESSAGE, NOT ON ITS BUBBLE.
       It was written onto the DOM node only, and every paint() rebuilds every
       node — so the next send, a reply arriving, or "Earlier messages" wiped
       "Not sent" and its Try again, and the failed message sat there looking
       sent (founder/502 sweep). The row carries `pending`, `failed` (the
       reason) and `retry`; this draws them on every paint. */
    function markState(b, m) {
      if (!b || !m || !m.pending) return;
      if (!m.failed) { b.setAttribute('data-pending', '1'); return; }
      b.setAttribute('data-failed', '1');
      var f = mk('div', 'ow-msg__fail');
      f.appendChild(mk('span', 'ow-msg__fail-x', esc('Not sent — ' + m.failed)));
      if (typeof m.retry === 'function') {
        var again = mk('button', 'ow-msg__fail-go', 'Try again');
        again.type = 'button';
        again.addEventListener('click', function (ev) { ev.stopPropagation(); m.retry(); });
        f.appendChild(again);
      }
      var acts = b.querySelector('.ow-msg__acts');
      if (acts) b.insertBefore(f, acts); else b.appendChild(f);
    }
    /* a failed placeholder leaves the LIST, not only the screen, when it is
       tried again — or the next paint draws it back beside the new attempt */
    function dropRow(id) {
      var old = byId[id];
      var i = old ? rows.indexOf(old) : -1;
      if (i >= 0) rows.splice(i, 1);
      delete byId[id];
    }
    /* ── A MESSAGE WITH A TIMER GOES WHEN ITS TIME IS UP (founder/556) ──
       The server stamps `expires_at` on a message sent while the room has
       disappearing on, and stops serving it after. An open conversation
       must not keep showing it, so it is dropped here at that moment and the
       next expiry is scheduled — one timer, never one per bubble. */
    var _expiryTimer = null;
    function dropExpired() {
      var now = Date.now(), next = Infinity;
      for (var i = rows.length - 1; i >= 0; i--) {
        var ex = Date.parse(rows[i].expires_at || '');
        if (!isFinite(ex)) continue;
        if (ex <= now) { delete byId[rows[i].id]; rows.splice(i, 1); }
        else if (ex < next) next = ex;
      }
      if (_expiryTimer) { global.clearTimeout(_expiryTimer); _expiryTimer = null; }
      if (next < Infinity && !closed) {
        _expiryTimer = global.setTimeout(function () { if (!closed) paint(); }, Math.min(2147483000, next - now + 50));
      }
    }
    function paint() {
      dropExpired();
      var first = _seenMsg === null;
      var was = _seenMsg || {};
      _seenMsg = {};
      msgs.innerHTML = '';
      var day = '';
      rows.forEach(function (m, i) {
        var d = (m.created_at || '').slice(0, 10);
        if (d && d !== day) {
          day = d;
          msgs.appendChild(mk('div', 'ow-msg-day', esc(dayOf(m.created_at))));
        }
        /* A RUN: one person, the same day, each message within five minutes
           of the one before. Mine run too — only the face is theirs alone. */
        var prv = rows[i - 1], nxt0 = rows[i + 1];
        var au = String(m.author || '').toLowerCase();
        var near = function (a, b2) {
          if (!a || !b2 || a.deleted || b2.deleted) return false;
          if (String(a.author || '').toLowerCase() !== String(b2.author || '').toLowerCase()) return false;
          if ((a.created_at || '').slice(0, 10) !== (b2.created_at || '').slice(0, 10)) return false;
          var ta0 = Date.parse(a.created_at || ''), tb0 = Date.parse(b2.created_at || '');
          return !(isFinite(ta0) && isFinite(tb0)) || Math.abs(tb0 - ta0) < 5 * 60 * 1000;
        };
        var run = { first: !(prv && !m.deleted && near(prv, m)), last: !(nxt0 && !m.deleted && near(m, nxt0)) };
        /* A SYSTEM LINE is the room speaking ("Maya made Jordan an admin"):
           centred and quiet, never a bubble from nobody */
        if (m.system || (!m.author && !m.deleted && m.body && !(m.attachments || []).length)) {
          msgs.appendChild(mk('div', 'ow-msg-sys', esc(m.body || '')));
          return;
        }
        var b = bubble(m, run);
        markState(b, m);
        var _mid = m.id || m.message_id || ((m.created_at || '') + '|' + (m.author || ''));
        _seenMsg[_mid] = 1;
        if (!first && !was[_mid]) b.classList.add('ow-msg--new');
        var mine = m.mine != null ? !!m.mine : (String(m.author || '').toLowerCase() === me);
        if (mine || m.deleted) {
          if (run.first) b.setAttribute('data-gap', '1');
          msgs.appendChild(b); return;
        }
        var endsRun = run.last;
        var line = mk('div', 'ow-msg-line');
        if (run.first) line.setAttribute('data-gap', '1');
        var f = endsRun ? faceFor(m) : mk('span', 'ow-msg-face is-blank');
        if (f) line.appendChild(f);
        line.appendChild(b);
        msgs.appendChild(line);
      });
      paintDelivery();
    }

    /* ── SENT · DELIVERED · READ, ON THE ONE MESSAGE IT IS ABOUT ──────────
       ★ FOUNDER: *"Do not confuse: server accepted · delivered to recipient
         device · opened/read. These are different states."*

       AND ONE MARKER, NOT ONE PER BUBBLE. A tick under every own-message would
       need a delivery read per message — the page-bounded N+1 the platform has
       already been bitten by twice. Read state is a WATERMARK, so the newest
       own message carries the strongest true statement about all of them, and
       that is exactly the marker a person actually reads.

       IT IS ALSO NEVER OPTIMISTIC. `delivered` is a fact about somebody else's
       client and this file cannot know it — founder/350: never display
       "delivered" when delivery has not been established. Until the server
       says so it says `Sent`, which is true the moment the row exists. */
    function paintDelivery() {
      var old = msgs.querySelector('.ow-msg__st');
      if (old) old.remove();
      var last = null;
      for (var i = rows.length - 1; i >= 0; i--) {
        var m = rows[i];
        var mine = m.mine != null ? !!m.mine : (String(m.author || '').toLowerCase() === me);
        if (mine && !m.deleted && !m.pending) { last = m; break; }
      }
      if (!last) return;
      var node = msgs.querySelector('[data-mid="' + cssq(last.id) + '"]');
      if (!node) return;

      var others = readers();
      var seen = others.filter(function (p) {
        return (readBy[p] || 0) >= (last.seq || 0);
      });
      var word;
      if (!others.length) word = 'Sent';
      else if (seen.length >= others.length) word = 'Read';
      else if (last.delivered) word = 'Delivered';
      else word = 'Sent';
      var st = mk('span', 'ow-msg__st', esc(word));
      st.setAttribute('data-st', word.toLowerCase());
      if (others.length > 1 && seen.length && seen.length < others.length) {
        st.textContent = 'Read by ' + seen.length + ' of ' + others.length;
      }
      /* under the bubble, the way every messenger says it — not inside it,
         where it made the last message a line taller than the rest */
      node.parentNode.insertBefore(st, node.nextSibling);
    }

    function readers() {
      return (conv.participants || []).map(personOf)
        .map(function (p) { return p && String(p.email || '').toLowerCase(); })
        .filter(function (e) { return e && e !== me; });
    }

    /* ══ READING THE CONVERSATION ════════════════════════════════════════ */

    function merge(list, where) {
      var added = 0;
      (list || []).forEach(function (m) {
        if (!m || !m.id) return;
        if (byId[m.id]) {
          /* AN UPDATE, NOT A DUPLICATE. An edit, a removal or a reaction
             re-reads the same id and must REPLACE rather than append — a
             merge that only ever appends is how a thread grows a second copy
             of every message somebody reacted to. */
          var at = rows.indexOf(byId[m.id]);
          if (at >= 0) rows[at] = m;
          byId[m.id] = m;
          return;
        }
        byId[m.id] = m; rows.push(m); added++;
      });
      rows.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      return added;
    }

    function readPage(before) {
      var p = conv_(cid) + '?limit=30' + (before ? '&before_seq=' + encodeURIComponent(before) : '');
      /* the first page may be the one `find` just read for a deep link — one
         read, not two (424); older pages and every later pull are fresh */
      return data.get(p, { fresh: !!before });
    }

    function load() {
      return readPage(null).then(function (r) {
        if (!r.ok) { refused(msgs, r, 'This conversation'); return 0; }
        var d = r.data || {};
        policy = d.policy || {};
        myRole = d.my_role || '';
        if (d.people) _people = d.people;
        /* the page read's `people` is keyed by address and carries no
           presence; the screen read carries presence for everyone this person
           can reach. Asked once, for the people in THIS room. */
        (function () {
          var want = (conv.participants || []).map(function (x) {
            return String((x && x.email) || x || '').toLowerCase(); }).filter(Boolean);
          data.get('/api/oneway/messaging/screen').then(function (sc) {
            if (closed || !sc.ok) return;
            var all = ((sc.data || {}).people) || [];
            var rows = all.filter(function (p) {
              return p && p.email && (!want.length
                || want.indexOf(String(p.email).toLowerCase()) >= 0); });
            paintPresence(rows);
          }).catch(function () {});
        })();
        /* the room's two facts, from the same read (424) */
        if (d.retention !== undefined || d.notify !== undefined) facts_(d);
        openProps = d.proposals || [];
        merge(d.messages || []);
        oldest = rows.length ? rows[0].seq : null;
        more = d.next_cursor != null;
        addDoor_(policy, myRole);
        if (!rows.length) {
          msgs.classList.add('po-grid');
          nothing(msgs, 'Nothing said yet.', 'A new conversation');
        } else {
          msgs.classList.remove('po-grid');
          paint();
          toBottom();
          /* A CHAT OPENS ON ITS NEWEST MESSAGE, and stays there while its
             pictures arrive. The first scroll ran before a photo had a
             height, so the conversation opened short of its last message,
             under the composer (measured at 390x844, founder/552). For the
             first few seconds — and after that whenever the person is already
             at the bottom — a picture landing keeps them there. */
          var openedAt = Date.now();
          global.requestAnimationFrame(toBottom);
          Array.prototype.forEach.call(msgs.querySelectorAll('img, video'), function (el) {
            el.addEventListener(el.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', function () {
              if (Date.now() - openedAt < 5000 || atBottom()) toBottom();
            }, { once: true });
          });
        }
        pagerState();
        mountComposer();
        paintProps();                 /* what the room is deciding (556) */
        seenIt();
        watch();
        return rows.length;
      });
    }

    /* ── OLDER MESSAGES, WITHOUT MOVING THE WORDS ────────────────────────
       `before_seq` is the canonical cursor and `next_cursor` is the server
       saying there is more behind it. The scroll compensation is the whole
       point: prepending 30 messages moves everything the person is reading
       down by however tall they are, and correcting for it afterwards is a
       jump they can see. Measure, prepend, restore. */
    function pagerState() {
      older.innerHTML = '';
      if (!more) return;
      var b = mk('button', 'po-act ow-msgs__more', 'Earlier messages');
      b.type = 'button';
      b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Reading…';
        var h0 = doc.documentElement.scrollHeight, y0 = global.scrollY;
        readPage(oldest).then(function (r) {
          if (!r.ok) {
            b.disabled = false;
            b.textContent = 'Could not read earlier messages — try again';
            return;
          }
          var d = r.data || {};
          merge(d.messages || []);
          oldest = rows.length ? rows[0].seq : oldest;
          more = d.next_cursor != null;
          paint();
          pagerState();
          try {
            global.scrollTo(0, y0 + (doc.documentElement.scrollHeight - h0));
          } catch (e) {}
        });
      });
      older.appendChild(b);
    }

    /* ── ARRIVING IS RECEIVING, AND OPENING IS READING ───────────────────
       Two different acts against two different routes, because they are two
       different facts. `delivered` is this client saying "I have it" and only
       a client can say it; `read` is the person having looked. Sending both
       from one place would collapse a distinction the domain is built on. */
    function seenIt() {
      var top = 0, ids = [];
      rows.forEach(function (m) {
        if (m.seq > top) top = m.seq;
        var mine = m.mine != null ? !!m.mine : (String(m.author || '').toLowerCase() === me);
        if (!mine && !m.deleted && m.id && !acked[m.id]) { acked[m.id] = 1; ids.push(m.id); }
      });
      if (ids.length) {
        data.post(conv_(cid) + '/delivered', { message_ids: ids.slice(0, 200) });
      }
      if (top) {
        data.post(conv_(cid) + '/read', { seq: top }).then(function () {
          data.invalidate(API);
        });
      }
    }

    /* ══ WRITING ═════════════════════════════════════════════════════════ */

    function aimReply(m) {
      replyTo = m;
      var chip = foot.querySelector('.ow-reply-aim');
      if (chip) chip.remove();
      var c = mk('div', 'ow-reply-aim');
      /* by name, the way the quote in the bubble will say it — never an address */
      var ra = String(m.author || '').toLowerCase();
      var rw = m.who || (peopleOf() || {})[ra] || {};
      var rname = ra === me ? 'yourself' : (rw.name || bare(ra) || 'a message');
      c.appendChild(mk('span', 'ow-reply-aim__who', esc('Replying to ' + rname)));
      c.appendChild(mk('span', 'ow-reply-aim__b',
        esc(String(m.body || '').slice(0, 90))));
      var x = mk('button', 'ow-reply-aim__x', '×'); x.type = 'button';
      x.setAttribute('aria-label', 'Stop replying');
      x.addEventListener('click', function () { replyTo = null; c.remove(); });
      c.appendChild(x);
      foot.insertBefore(c, foot.firstChild);
      var ta = foot.querySelector('textarea');
      if (ta) ta.focus();
    }

    function mountComposer() {
      /* A FIELD THAT LOOKS WRITABLE AND REFUSES ON SEND is the same lie as a
         Join button on a Center that cannot be joined. `my_role` comes from
         the server, so this asks rather than assumes — and where a person may
         not write, it says WHY instead of showing nothing. */
      var mayWrite = myRole && myRole !== 'banned' && myRole !== 'viewer';
      if (!mayWrite) {
        foot.innerHTML = '';
        foot.appendChild(mk('p', 'ow-composer__no',
          esc(myRole === 'banned'
            ? 'You cannot post in this conversation.'
            : 'You can read this conversation but not write in it.')));
        return;
      }
      if (foot.querySelector('.ow-composer')) return;

      var comp = mk('div', 'ow-composer');
      var ta = doc.createElement('textarea');
      ta.rows = 1; ta.placeholder = 'Message';
      ta.setAttribute('aria-label', 'Write a message');
      var send = mk('button', 'ow-send',
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 8 6 8z"/></svg>');
      send.type = 'button'; send.disabled = true;
      send.setAttribute('aria-label', 'Send');
      /* ── A PHOTO OR A VIDEO, FROM THE CAMERA OR THE ROLL ─────────────────
         ★ FOUNDER/438. The door has taken image and video kinds since the
         contract was written; nothing in the App could send one. The file
         goes through the one media writer (POST /api/oneway/media — magic
         bytes, size cap, owner-named), then the message is sent as its kind
         with the served path as its attachment. The bubble appears at once
         with the local file while the upload runs, marked pending, and is
         replaced by the server's row — the same honest optimism a text
         message gets. */
      var attach = mk('button', 'ow-attach',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>');
      attach.type = 'button'; attach.setAttribute('aria-label', 'Send a photo or video');
      var pick = doc.createElement('input'); pick.type = 'file'; pick.accept = 'image/*,video/*'; pick.hidden = true;
      attach.addEventListener('click', function () { pick.click(); });
      pick.addEventListener('change', function () {
        var f = pick.files && pick.files[0]; pick.value = '';
        if (!f) return;
        if (f.size > 60 * 1024 * 1024) { note('That file is over 60 MB.'); return; }
        var isVideo = /^video\//.test(f.type);
        var local = URL.createObjectURL(f);
        var rd = new FileReader();
        rd.onload = function () { sendMedia(String(rd.result || ''), isVideo, local, ta.value.trim()); };
        rd.onerror = function () { note('That file could not be read.'); };
        rd.readAsDataURL(f);
      });
      function sendMedia(dataUrl, isVideo, local, caption) {
        var kind = isVideo ? 'video' : 'image';
        var tmp = { id: 'tmp_' + Math.random().toString(36).slice(2), author: me, mine: true, body: caption,
                    kind: kind, pending: true, seq: (rows.length ? rows[rows.length - 1].seq : 0) + 0.5,
                    created_at: new Date().toISOString(), replying_to: null, reply_to: '', reactions: {},
                    attachments: [{ type: 'media', kind: kind, url: local }] };
        merge([tmp]); paint();
        var node = msgs.querySelector('[data-mid="' + cssq(tmp.id) + '"]');
        if (node) node.setAttribute('data-pending', '1');
        toBottom();
        ta.value = ''; ta.style.height = 'auto'; send.disabled = true; attach.disabled = true;
        data.post('/api/oneway/media', { data: dataUrl, origin: 'uploaded' }).then(function (up) {
          attach.disabled = false;
          var item = up && up.ok && up.data && (up.data.media || up.data.item || up.data);
          var url = item && (item.url || (item.media && item.media.url));
          var again = function () { dropRow(tmp.id); sendMedia(dataUrl, isVideo, local, caption); };
          if (!url) { fail(tmp, (up && up.error) || 'That could not be uploaded.', again); return; }
          var att = { type: 'media', kind: kind, url: url, width: item.width || null, height: item.height || null };
          return data.post(conv_(cid) + '/messages', { body: caption, kind: kind, attachments: [att] }).then(function (r) {
            if (!r || !r.ok) { fail(tmp, (r && r.error) || 'Not sent.', again); return; }
            delete byId[tmp.id];
            var at = rows.indexOf(tmp); if (at >= 0) rows.splice(at, 1);
            merge([{ id: (r.data || {}).message_id, seq: (r.data || {}).seq, author: me, mine: true, body: caption,
                     kind: kind, created_at: new Date().toISOString(), replying_to: null, reply_to: '',
                     reactions: {}, attachments: [att] }]);
            paint(); data.invalidate(API); if (atBottom()) toBottom();
            pull((r.data || {}).seq);
            try { URL.revokeObjectURL(local); } catch (e) {}
          });
        });
      }
      function fail(tmp, why_, retry) {
        attach.disabled = false;
        tmp.failed = why_;
        tmp.retry = retry || null;
        paint();
      }

      ta.addEventListener('input', function () {
        send.disabled = !ta.value.trim();
        ta.style.height = 'auto';
        ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
        /* THE THROTTLE LIVES IN THE CLIENT, not here — founder: *"Do not write
           every keystroke into the database."* */
        if (OW.realtime && OW.realtime.typing) OW.realtime.typing('conv:' + cid);
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
      });
      /* WRAPPED, NOT PASSED. `post` grew a `reuse` parameter for the retry
         path, and `addEventListener('click', post)` hands the CLICK EVENT in
         as that argument — a truthy object whose `.body` is undefined, so
         every send read an empty body and returned silently. The button
         worked, the field kept its text, and nothing anywhere said no. */
      send.addEventListener('click', function () { post(); });

      function post(reuse) {
        var body = reuse ? reuse.body : ta.value.trim();
        if (!body) return;
        var aim = reuse ? reuse.aim : replyTo;
        if (reuse) dropRow(reuse.tmpId);
        ta.value = ''; ta.style.height = 'auto'; send.disabled = true;
        var chip = foot.querySelector('.ow-reply-aim');
        if (chip) chip.remove();
        replyTo = null;
        if (OW.realtime && OW.realtime.stopTyping) OW.realtime.stopTyping('conv:' + cid);

        /* THE SEND IS OPTIMISTIC AND HONEST ABOUT IT. The bubble appears
           immediately because that is what makes messaging feel like
           messaging, and it is marked `data-pending` until the server
           confirms and `data-failed` if it refuses. A message that silently
           never sent is the worst failure this surface can have, and an
           unmarked optimistic bubble is exactly what that looks like. */
        var tmp = {
          id: 'tmp_' + Math.random().toString(36).slice(2),
          author: me, mine: true, body: body, pending: true,
          seq: (rows.length ? rows[rows.length - 1].seq : 0) + 0.5,
          created_at: new Date().toISOString(),
          /* THE SERVER'S OWN SHAPE, so the optimistic bubble and the one that
             comes back render through exactly the same branch. A placeholder
             that describes itself differently from the real thing is a second
             contract nobody declared. */
          replying_to: aim ? { id: aim.id, author: aim.author,
                               excerpt: String(aim.body || '').slice(0, 120),
                               available: true } : null,
          reply_to: aim ? aim.id : ''
        };
        merge([tmp]);
        paint();
        var node = msgs.querySelector('[data-mid="' + cssq(tmp.id) + '"]');
        if (node) node.setAttribute('data-pending', '1');
        toBottom();

        data.post(conv_(cid) + '/messages',
          { body: body, reply_to: aim ? aim.id : '' }).then(function (r) {
          if (!r.ok) {
            /* ── A FAILED SEND HAS TO BE UNMISSABLE, AND HAS TO SAY WHY ──
               ★ FOUNDER/350, "No false UI state". The rule that refused it,
               in the place it was refused, and a way forward: the message was
               never stored, so re-sending cannot duplicate it. Recorded on the
               ROW so every later paint keeps saying it (markState). */
            tmp.failed = why(r);
            tmp.retry = function () { post({ body: body, aim: aim, tmpId: tmp.id }); };
            paint();
            return;
          }
          /* THE SERVER'S ID AND SEQ REPLACE THE PLACEHOLDER'S. Without this
             the realtime echo of my own message arrives as a stranger and the
             thread shows it twice — the duplicate the founder's proof list
             asks about, and it comes from exactly here. */
          delete byId[tmp.id];
          var at = rows.indexOf(tmp);
          if (at >= 0) rows.splice(at, 1);
          var real = { id: (r.data || {}).message_id, seq: (r.data || {}).seq,
                       author: me, mine: true, body: body,
                       created_at: new Date().toISOString(),
                       replying_to: tmp.replying_to, reply_to: tmp.reply_to,
                       reactions: {}, attachments: [] };
          merge([real]);
          paint();
          data.invalidate(API);
          if (atBottom()) toBottom();
          /* AND THEN THE SERVER'S OWN ROW. The placeholder cannot know what
             the server allows on it (`may_edit`, `may_delete`, `who`), so a
             message you had just sent offered no Edit and no Remove until the
             chat was reopened — a typo you could not take back (founder/553,
             found by chat-flows.cjs). The re-read replaces it by id. */
          pull((r.data || {}).seq);
        });
      }

      comp.appendChild(attach); comp.appendChild(pick); comp.appendChild(ta); comp.appendChild(send);
      foot.appendChild(comp);
    }

    function react(mid, emoji) {
      data.post(conv_(cid) + '/messages/' + encodeURIComponent(mid) + '/react',
        { emoji: emoji }).then(function (r) {
        if (!r.ok) { note(why(r)); return; }
        var m = byId[mid];
        if (m) { m.reactions = (r.data || {}).reactions || {}; paint(); }
      });
    }

    function editInline(m) {
      var node = msgs.querySelector('[data-mid="' + cssq(m.id) + '"]');
      if (!node || node.querySelector('.ow-msg__edit')) return;
      var box = mk('div', 'ow-msg__edit');
      var ta = doc.createElement('textarea');
      ta.value = m.body || ''; ta.rows = 2;
      ta.setAttribute('aria-label', 'Edit this message');
      var ok = mk('button', 'po-act po-act--go', 'Save'); ok.type = 'button';
      var no = mk('button', 'po-act', 'Cancel'); no.type = 'button';
      no.addEventListener('click', function () { box.remove(); });
      ok.addEventListener('click', function () {
        var v = ta.value.trim();
        if (!v) return;
        ok.disabled = true;
        data.post(conv_(cid) + '/messages/' + encodeURIComponent(m.id),
          { body: v }, { method: 'PATCH' }).then(function (r) {
          if (!r.ok) { ok.disabled = false; note(why(r)); return; }
          m.body = v; m.edited = true; box.remove(); paint();
          data.invalidate(API);
        });
      });
      box.appendChild(ta); box.appendChild(ok); box.appendChild(no);
      node.appendChild(box);
      ta.focus();
    }

    function removeMsg(m) {
      var run = function (yes) {
        if (!yes) return;
        data.del(conv_(cid) + '/messages/' + encodeURIComponent(m.id))
          .then(function (r) {
            if (!r.ok) { note(why(r)); return; }
            m.deleted = true; m.body = ''; m.attachments = []; m.reactions = {};
            m.deleted_by = (r.data || {}).deleted_by || 'author';
            paint(); data.invalidate(API);
          });
      };
      run(true);                /* the row already asked (Tap again to remove) */
    }

    function note(text) {
      var n = mk('div', 'ow-thread__note', esc(text));
      foot.insertBefore(n, foot.firstChild);
      global.setTimeout(function () { try { n.remove(); } catch (e) {} }, 4200);
    }

    /* ══ REALTIME ════════════════════════════════════════════════════════
       ★ FOUNDER, 2026-09-01: *"realtime arrival without reload"*, *"read state
         propagation"*, *"reaction propagation"*, *"reply propagation"*, *"no
         duplicate or missing messages"*.

       THE EVENT IS A PROMPT TO READ, NEVER CONTENT. It carries an id and a
       seq and no words, on purpose — so this asks the server for the messages
       it is entitled to and merges them by id. That is also what makes
       duplicates structurally impossible rather than carefully avoided: the
       merge is keyed, and the echo of my own send finds the row already there
       under the id the server gave it. */
    var onConv = null;
    function watch() {
      if (!OW.realtime || !OW.realtime.watchTopics) return;
      OW.realtime.watchTopics('conv', ['conv:' + cid]);
      onConv = function (e) {
        var d = (e && e.detail) || {};
        if (!d.data || d.data.conversation !== cid) return;
        apply(d.kind, d.data);
      };
      doc.addEventListener('ow:conv', onConv);
    }
    /* ── SCREENSHOT NOTICES (founder/160) ───────────────────────────────
       A browser cannot see a screenshot. It can see the keys that take one —
       Print Screen, and on a Mac ⌘⇧3 / ⌘⇧4 / ⌘⇧5 — so when a chat asks for
       notices (`screenshots: recorded`) those keys are reported, and the
       server records it. A phone's own screenshot gesture never reaches a
       web page; the native App is where that becomes complete. */
    var onShot = function (e) {
      if (closed || (policy || {}).screenshots !== 'recorded') return;
      var mac = e.metaKey && e.shiftKey && /^(Digit3|Digit4|Digit5)$/.test(e.code || '');
      if (e.key !== 'PrintScreen' && !mac) return;
      data.post(conv_(cid) + '/screenshot', {}).catch(function () {});
    };
    var onShotUp = function (e) { if (e.key === 'PrintScreen') onShot(e); };
    doc.addEventListener('keydown', onShot);
    doc.addEventListener('keyup', onShotUp);
    function teardown() {
      closed = true;
      doc.removeEventListener('pointerdown', onOutside, true);
      doc.removeEventListener('keydown', onShot);
      doc.removeEventListener('keyup', onShotUp);
      if (onConv) doc.removeEventListener('ow:conv', onConv);
      if (OW.realtime && OW.realtime.unwatch) OW.realtime.unwatch('conv');
      if (OW.realtime && OW.realtime.stopTyping) OW.realtime.stopTyping('conv:' + cid);
    }

    var pulling = false;
    function apply(kind, d) {
      if (closed) return;
      if (kind === 'message') {
        if (d.internal) return;          /* a note is not a message */
        if (d.author && String(d.author).toLowerCase() === me) return;
        pull(d.seq);
        return;
      }
      /* WHO IS IN THE ROOM, OR WHAT IT IS CALLED, CHANGED (founder/556).
         Removed yourself → the room says so and stops taking words. */
      if (kind === 'proposal') { rereadRoom(); return; }
      if (kind === 'join_request') {
        if (!chatSet.hidden && chatSet.getAttribute('data-page') === 'people') openChatSet('people');
        return;
      }
      if (kind === 'roster' || kind === 'renamed') {
        if (kind === 'roster' && d.removed && String(d.person || '').toLowerCase() === me) {
          foot.innerHTML = '';
          foot.appendChild(mk('p', 'ow-composer__no', esc(d.by && String(d.by).toLowerCase() === me ? 'You left this chat.' : 'You were removed from this chat.')));
          closed = true;
          return;
        }
        rereadRoom();
        return;
      }
      if (kind === 'msg_reaction' || kind === 'edited' || kind === 'removed') {
        pull(null);
        return;
      }
      if (kind === 'read') {
        /* THE WATERMARK MOVED. This is the whole of read-state propagation:
           one number per person, and every own message at or below it has
           been read by them. */
        if (d.person) readBy[String(d.person).toLowerCase()] = Number(d.seq) || 0;
        paintDelivery();
        return;
      }
      if (kind === 'delivered') {
        rows.forEach(function (m) {
          var mine = m.mine != null ? !!m.mine : (String(m.author || '').toLowerCase() === me);
          if (mine) m.delivered = true;
        });
        paintDelivery();
        return;
      }
      if (kind === 'typing') {
        /* THE PAYLOAD IS A ROSTER, NOT A BOOLEAN. `presence` publishes
           `{topic, typing:[{person}]}` — the whole set of people currently
           claiming to be typing — because a per-person boolean cannot express
           two of them at once and would race on whose event landed last.
           Reading it as `d.typing` truthy would have shown "typing" forever:
           an empty array is truthy in JavaScript. */
        var who = (d.typing || []).map(function (t) {
          return String((t && t.person) || t || '').toLowerCase();
        }).filter(function (e) { return e && e !== me; });
        typing.hidden = !who.length;
        typing.textContent = !who.length ? ''
          : (who.length === 1
              ? bare(who[0]) + ' is typing…'
              : who.length + ' people are typing…');
        return;
      }
    }

    /* ONE READ IN FLIGHT AT A TIME, and it is bounded by how far behind we
       are — never by the corpus. A burst of twenty messages is one catch-up
       read, not twenty. */
    function pull(uptoSeq) {
      if (pulling || closed) return;
      pulling = true;
      var top = rows.reduce(function (a, m) { return Math.max(a, m.seq || 0); }, 0);
      var behind = uptoSeq ? Math.max(1, Math.ceil(uptoSeq) - Math.floor(top)) : 8;
      var want = Math.min(60, Math.max(5, behind + 3));
      var stick = atBottom();
      data.get(conv_(cid) + '?limit=' + want, { fresh: true }).then(function (r) {
        pulling = false;
        if (closed || !r.ok) return;
        var d = r.data || {};
        policy = d.policy || policy;
        myRole = d.my_role || myRole;
        if (d.people) _people = Object.assign(_people || {}, d.people);
        if (d.proposals) { openProps = d.proposals; paintProps(); }
        merge(d.messages || []);
        paint();
        /* A MESSAGE ARRIVING MUST NOT MOVE SOMEBODY READING HISTORY. Only
           follow the bottom if they were already at it. */
        if (stick) toBottom();
        seenIt();
      });
    }

    /* ── WHAT THIS ROOM DOES WITH WHAT IS SAID IN IT ─────────────────────
       Retention and notification are answerable BEFORE anything happens, which
       is what makes them honest rather than aspirational — and both were built,
       routed, tested and rendered by nothing. Read together because they are
       the two facts a person actually wants stated at the top of a room. */
    /* ★ FOUNDER/424: *"1 click 1 read."* The page read carries both facts
       now (`retention`, `notify`); the two extra GETs are only made when a
       page from an older runtime did not answer them. */
    var factsDrawn = false;
    function facts_(fromPage) {
      if (factsDrawn) return;
      var fp = fromPage || {};
      var retP = fp.retention !== undefined ? Promise.resolve({ ok: true, data: { retention: fp.retention || {} } })
                                            : data.get(conv_(cid) + '/retention', { fresh: true });
      var ntfP = fp.notify !== undefined ? Promise.resolve({ ok: true, data: fp.notify || {} })
                                         : data.get(conv_(cid) + '/notify', { fresh: true });
      if (fp.retention !== undefined || fp.notify !== undefined) factsDrawn = true;
      retP.then(function (r) {
        if (!r.ok || closed) return;
        var t = (r.data || {}).retention || {};
        var ttl = Number(t.ttl || 0);
        if (!ttl && !t.preserve) return;
        /* A DEFAULT NOBODY CHOSE IS NOT SAID. The runtime resolves a room
           that never spoke to a 2-day "platform default" — and nothing in it
           removes a message after 2 days (measured 2026-09-26: a chat showing
           this line held messages from 22 days before). The founder's words
           are "No disappearing messages" (346), and the choice is the
           person's (160, 541). So the line appears only when a room, a Place
           or the person chose it. */
        if (!t.preserve && (t.source || 'default') === 'default') return;
        var line = t.preserve
          ? 'Kept' + (t.preserve_reason ? ' — ' + t.preserve_reason : '')
          : 'Messages disappear after ' + human(ttl);
        var chip = mk('span', 'ow-fact', esc(line));
        if (t.locked) chip.setAttribute('data-locked', '1');
        chip.title = 'Set by ' + (t.source || 'the platform');
        facts.appendChild(chip);
        retInfo = { ttl: ttl, preserve: !!t.preserve, reason: t.preserve_reason || '', source: t.source || '' };
      });
      ntfP.then(function (r) {
        if (!r.ok || closed) return;
        var n = r.data || {};
        if (!n || (!n.levels && !n.effective)) return;
        /* the choice lives on the Chat settings page now (founder/510) */
        ntfInfo = { levels: n.levels || ['all', 'mentions', 'none'], cur: n.effective || 'all', why: n.why || '' };
        /* muted says so where the chat is read, the one fact worth a glance */
        var mutedMark = facts.querySelector('[data-muted]');
        if (ntfInfo.cur === 'none' && !mutedMark) {
          var mm = mk('span', 'ow-fact', 'Muted'); mm.setAttribute('data-muted', '1'); facts.appendChild(mm);
        }
      });
    }
    /* ── ADD SOMEONE — the door B built (ec605c4) that nothing in the App
       opened. "You could open a group chat and then not add anyone to it":
       POST .../participants {person} has existed for hours with no control.

       DRAWN ONLY WHEN THE PRESS WOULD SUCCEED. The thread read answers
       `policy.who_can_add` (a role) and `my_role`; the server refuses below
       that rank. The rank order is the contract's own (owner 5 · admin 4 ·
       moderator 3 · participant 2 · guest 1 · banned 0), read here rather
       than guessed, so a control is never shown to somebody the door will
       turn away. A conversation with no `type` is still asked — the door
       decides, and a DM owner adding a third person is exactly how a group
       begins.

       DEPTH ON REQUEST (founder/369): a quiet "Add someone" in the facts row;
       pressing it reveals the field, focused. Never a box that was not asked
       for. The person is named by email or handle, whatever the door takes;
       a refusal carries the door's own sentence ("only admin may add someone
       here", "that person is not reachable"), never a generic one. */
    var RANK_ = { owner: 5, admin: 4, moderator: 3, participant: 2, member: 2, guest: 1, banned: 0 };
    function addDoor_(pol, role) {
      var need = String((pol || {}).who_can_add || 'admin').toLowerCase();
      mayAdd = !!role && (RANK_[String(role).toLowerCase()] || 0) >= (RANK_[need] || 4);
    }
    /* the add form, drawn into whichever page asks for it */
    function addForm(facts) {
      (function () {
        if (facts.querySelector('.ow-addp')) return;
        var row = mk('form', 'ow-addp');
        var inp = doc.createElement('input');
        inp.type = 'text'; inp.className = 'ow-addp__in';
        inp.placeholder = 'Their email or handle';
        inp.setAttribute('aria-label', 'Who to add');
        inp.autocomplete = 'off';
        var go = mk('button', 'po-act', 'Add'); go.type = 'submit';
        var why = mk('span', 'ow-addp__why', '');
        row.appendChild(inp); row.appendChild(go); row.appendChild(why);
        row.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var who = inp.value.trim(); if (!who) return;
          go.disabled = true; why.textContent = 'Adding…';
          data.post(conv_(cid) + '/participants', { person: who }).then(function (r) {
            go.disabled = false;
            if (!r || !r.ok) {
              why.textContent = (r && r.error) || 'That person could not be added.';
              return;
            }
            /* THE ROSTER IS THE SERVER'S. The answer carries the participant
               it made — that row, not the name that was typed, joins the
               conversation's people, so the title and the read-receipts count
               it from now on. The inbox cache is dropped so the list agrees. */
            var made = (r.data && r.data.participant) || null;
            if (made) {
              conv.participants = (conv.participants || []).concat([made]);
              var nm = head.querySelector('.ow-thread-head__nm');
              if (nm && !conv.title) nm.textContent = titleFor(conv);
            }
            data.invalidate('/api/oneway/messaging/');
            why.textContent = 'Added' + (made && (made.name || made.person || made.email)
              ? ' ' + String(made.name || made.person || made.email) + '.' : '.');
            inp.value = '';
          });
        });
        facts.appendChild(row);
        try { inp.focus(); } catch (e) {}
      })();
    }

    /* ── THE CHAT SETTINGS PAGE ─────────────────────────────────────────
       Sections the way TikTok's are: who this is, Notifications, This chat,
       Privacy and safety. Every row is the Settings row; a row with a choice
       opens its own page and comes back. Nothing here is new capability —
       each row is a door the chips or the profile already used. */
    function icon(n) { return OW.setIcon ? OW.setIcon(n) : ''; }
    function setRow(into, ic, label, value, onPress, bad) {
      var el = mk(onPress ? 'button' : 'div', 'ow-set__row' + (bad ? ' ow-set__row--out' : ''));
      if (onPress) { el.type = 'button'; el.addEventListener('click', onPress); }
      el.innerHTML = '<span class="ow-set__ic">' + icon(ic) + '</span>'
        + '<span class="ow-set__lb">' + esc(label) + '</span>'
        + '<span class="ow-set__v">' + esc(value || '') + '</span>'
        + (onPress && !bad ? '<span class="ow-set__cv">' + icon('chevron') + '</span>' : '');
      into.appendChild(el);
      return el;
    }
    function section(into, title) {
      var sec = mk('section', 'ow-set__sec');
      if (title) sec.appendChild(mk('h2', 'ow-set__sh', esc(title)));
      into.appendChild(sec);
      return sec;
    }
    var NTF_SAY = { all: 'All messages', mentions: 'Only when you are mentioned', none: 'Muted' };

    /* ══ CHAT RULES — every choice a chat can make, founder/160 and 541 ═══════
       ★ FOUNDER/160: *"turn off detection for screenshots, edit messaging, you
         could turn that on and off depending on who changes it in the chat
         settings between you and another person or in a group chat. You could
         give people permissions inside of a group chat. That's what makes
         ONEWAY good for messaging."* ★ FOUNDER/148: *"group chats need to be
         super advanced and super customizable."* ★ 541: *"users better be
         able to do all i disscused … about advanced user choice in messaging."*

       THE RULES WERE BUILT AND NEVER SHOWN. A conversation's policy
       (messaging/contracts.py POLICY) carries each of these, the service
       enforces them (edit, delete, forward, reactions, replies, attachments,
       read receipts, typing, screenshots, joining, who may add, slow mode,
       governance), and the page read answers the resolved set with
       `my_role` — and the App drew one of them, read-only. Only rules with a
       reader are offered; a switch nothing enforces would be a lie.

       WHO MAY CHANGE THEM is the room's own answer (`who_can_settings`, a
       rank) and HOW A CHANGE PASSES is `governance`: under anything but
       `admins` a change becomes a proposal the others vote on, and the page
       says so rather than pretending it took. */
    function ruleIsOn(key) {
      var v = (policy || {})[key];
      if (key === 'screenshots') return v === 'recorded' || v === true;
      return !(v === 'denied' || v === false);
    }
    function mayRule() {
      var need = String((policy || {}).who_can_settings || 'admin').toLowerCase();
      return (RANK_[String(myRole || '').toLowerCase()] || 0) >= (RANK_[need] || 4);
    }
    function whoMayRule() {
      var need = String((policy || {}).who_can_settings || 'admin').toLowerCase();
      if (need === 'participant' || need === 'member') return 'Anyone in this chat can change these.';
      if (conv.type === 'direct' && need !== 'participant') return 'Only the person who started this chat can change these.';
      return need === 'owner' ? 'Only the owner of this chat can change these.' : 'Only the admins of this chat can change these.';
    }
    function sendRule(changes, el, after) {
      if (el) { el.disabled = true; el.removeAttribute('data-failed'); }
      data.put(conv_(cid) + '/policy', { changes: changes }).then(function (r) {
        if (el) el.disabled = false;
        if (!r || !r.ok) {
          if (el) el.setAttribute('data-failed', '1');
          if (OW.toast) OW.toast((r && r.error) || 'That rule did not change. Try again.');
          return;
        }
        var d = r.data || {};
        if (d.applied === false && d.proposal) {
          var pr = d.proposal;
          if (OW.toast) OW.toast('Proposed. It changes when ' + Math.ceil((pr.needed || 0.5) * (pr.electorate || 1)) + ' of ' + (pr.electorate || 1) + ' people agree.', { tone: 'ok' });
        } else {
          policy = Object.assign({}, policy || {}, changes);
          if (OW.toast) OW.toast('Saved for everyone in this chat.', { tone: 'ok' });
        }
        data.invalidate(conv_(cid));
        if (after) after(d);
      });
    }
    function ruleSwitch(into, key, label, onWords, offWords, can) {
      var sw = mk('button', 'ow-switch'); sw.type = 'button';
      function paint() {
        var on = ruleIsOn(key);
        sw.setAttribute('aria-pressed', String(on));
        sw.innerHTML = '<span class="ow-switch__b"><b>' + esc(label) + '</b><span>' + esc(on ? onWords : offWords)
          + '</span></span><span class="ow-switch__k" aria-hidden="true"></span>';
      }
      paint();
      if (!can) sw.disabled = true;
      else sw.addEventListener('click', function () {
        var turnOn = !ruleIsOn(key), ch = {};
        ch[key] = key === 'screenshots' ? (turnOn ? 'recorded' : 'allowed') : (turnOn ? 'allowed' : 'denied');
        sendRule(ch, sw, paint);
      });
      into.appendChild(sw);
      return sw;
    }
    function ruleChoice(into, key, label, options, can) {
      /* one of several answers: a row per answer, the chosen one pressed */
      var box = mk('div', 'ow-rulech');
      box.appendChild(mk('b', 'ow-rulech__l', esc(label)));
      var list = mk('div', 'ow-rulech__o'); box.appendChild(list);
      function cur() { var v = (policy || {})[key]; return v === undefined || v === null ? options[0][0] : v; }
      function paint() {
        list.innerHTML = '';
        options.forEach(function (o) {
          var b = mk('button', 'po-act ow-rulech__b', esc(o[1])); b.type = 'button';
          var on = String(cur()) === String(o[0]);
          b.setAttribute('aria-pressed', String(on));
          if (!can) b.disabled = true;
          else b.addEventListener('click', function () {
            if (String(cur()) === String(o[0])) return;
            var ch = {}; ch[key] = o[0];
            sendRule(ch, null, paint);
          });
          list.appendChild(b);
        });
      }
      paint();
      into.appendChild(box);
    }
    /* ══ WHO THE ADMINS ARE — founder/549 ════════════════════════════════
       ★ FOUNDER/549: *"make the admin assigning more clear"*

       "Admins" was a word on four controls and the chat never said who they
       were: the rules page read "Only the admins of this chat can change
       these", the People row was a bare count, and nothing anywhere named a
       person as an admin. So the chat now says it by name — here, at the top
       of Chat rules, and on its own People and admins page, admins first.
       Making someone an admin is a door lane B is building
       (PUT …/participants/{email} {role}); its buttons go on this page the
       day it answers, and not before — a button the server refuses is worse
       than none. */
    function isAdminRole(r) { return (RANK_[String(r || '').toLowerCase()] || 0) >= RANK_.admin; }
    function roleWords(r) {
      r = String(r || '').toLowerCase();
      return r === 'owner' ? 'Admin · started this chat' : r === 'admin' ? 'Admin'
        : r === 'moderator' ? 'Moderator' : r === 'guest' ? 'Guest' : 'Member';
    }
    function roster() {
      var ppl = (typeof peopleOf === 'function' && peopleOf()) || {};
      return (conv.participants || []).map(function (p) {
        var o = personOf(p) || {};
        var em = String(o.email || '').toLowerCase();
        var pw = ppl[em] || {};
        return { email: em, name: pw.name || o.name || bare(em), image: pw.image || o.picture || '',
                 role: (p && p.role) || o.role || '', me: em === me };
      }).filter(function (p) { return p.email && !isBrain(p); });
    }
    function adminsSaid(list) {
      var a = list.filter(function (p) { return isAdminRole(p.role); });
      if (!a.length) return '';
      var names = a.map(function (p) { return p.me ? 'You' : p.name; });
      var joined = names.length < 3 ? names.join(' and ')
        : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      return joined + (a.length === 1 && !a[0].me ? ' is the admin here.' : a.length === 1 ? ' are the admin here.' : ' are the admins here.');
    }
    function drawPeople(body) {
      var all = roster();
      var admins = all.filter(function (p) { return isAdminRole(p.role); });
      var rest = all.filter(function (p) { return !isAdminRole(p.role); });
      var amAdmin = admins.some(function (p) { return p.me; });
      body.appendChild(mk('p', 'ow-set__lede', esc((amAdmin ? 'You are an admin. ' : adminsSaid(all) + ' ')
        + 'Admins change the chat rules and decide who can add people.')));
      [['Admins', admins], ['Members', rest]].forEach(function (grp) {
        if (!grp[1].length) return;
        var sec = section(body, grp[0]);
        grp[1].forEach(function (p) {
          var row = mk('div', 'ow-set__row ow-setpick ow-people__row');
          row.setAttribute('data-role', String(p.role || 'participant'));
          var av = mk('span', 'ow-thread__av ow-people__av');
          if (p.image) { var im = doc.createElement('img'); im.src = OW.imageUrl ? OW.imageUrl(p.image) : p.image; im.alt = ''; av.appendChild(im); }
          else if (OW.faceMark) av.innerHTML = OW.faceMark();
          /* each face in its own person's colour, as the inbox draws it */
          data.get('/api/oneway/people/' + encodeURIComponent(p.email)).then(function (r) {
            var d = (r && r.ok && r.data) || null; if (!d || !row.isConnected) return;
            /* their name as they wrote it, not their address */
            if (d.display_name) nmEl.textContent = d.display_name + (p.me ? ' (you)' : '');
            if (typeof d.hue === 'number' && OW.hue && OW.hue.fromAngle) {
              var h = OW.hue.fromAngle(d.hue); av.style.setProperty('--ch1', h[0]); av.style.setProperty('--ch2', h[1] || h[0]);
            }
            var pic = d.picture && (d.picture.url || d.picture);
            if (pic && typeof pic === 'string' && !p.image) {
              av.innerHTML = ''; var im2 = doc.createElement('img'); im2.src = OW.imageUrl ? OW.imageUrl(pic) : pic; im2.alt = ''; av.appendChild(im2);
            }
          }).catch(function () {});
          row.appendChild(av);
          var w = mk('span', 'ow-setpick__w');
          var nmEl = mk('b', '', esc(p.name + (p.me ? ' (you)' : '')));
          w.appendChild(nmEl);
          w.appendChild(mk('span', '', esc(roleWords(p.role))));
          row.appendChild(w);
          if (isAdminRole(p.role)) row.appendChild(mk('span', 'ow-people__badge', 'Admin'));
          sec.appendChild(row);
          /* THE ACTS ON THIS PERSON (founder/549, 556) — drawn only where the
             server's rules would say yes: an admin makes a member an admin;
             only the owner takes admin away; nobody touches the owner;
             removal follows who_can_remove and never reaches someone who
             ranks with you. The server decides again on the press. */
          var myR = RANK_[String(myRole || '').toLowerCase()] || 0;
          var theirR = RANK_[String(p.role || '').toLowerCase()] || 0;
          var isOwner = String(p.role || '').toLowerCase() === 'owner';
          if (!p.me && !isOwner && myR >= RANK_.admin) {
            var ar = mk('div', 'ow-people__acts');
            if (!isAdminRole(p.role)) peopleAct(ar, 'Make admin', function (b) { setRoleOf(p, 'admin', b); });
            else if (String(myRole || '').toLowerCase() === 'owner') peopleAct(ar, 'Make member', function (b) { setRoleOf(p, 'member', b); });
            var needRm = RANK_[String((policy || {}).who_can_remove || 'admin').toLowerCase()] || RANK_.admin;
            if (myR >= needRm && theirR < myR) {
              var rmB = peopleAct(ar, 'Remove', function (b) {
                if (!b.hasAttribute('data-armed')) { arm(b, 'Tap again to remove'); return; }
                removeFrom(p, b);
              });
              rmB.setAttribute('data-danger', '1');
            }
            if (ar.firstChild) sec.appendChild(ar);
          }
        });
      });
      /* WHO IS ASKING TO JOIN (founder/556) — for the people who decide */
      var sAsk = mk('div');
      body.appendChild(sAsk);
      data.get(conv_(cid) + '/joins', { fresh: true }).then(function (r) {
        var reqs = (r && r.ok && r.data && r.data.requests) || [];
        if (!reqs.length || !sAsk.isConnected) return;
        var sec = section(sAsk, 'Asking to join');
        reqs.forEach(function (q) {
          var row = mk('div', 'ow-set__row ow-setpick ow-people__row');
          var av = mk('span', 'ow-thread__av ow-people__av');
          if (OW.faceMark) av.innerHTML = OW.faceMark();
          row.appendChild(av);
          var w = mk('span', 'ow-setpick__w');
          w.appendChild(mk('b', '', esc(q.name || bare(q.person || ''))));
          w.appendChild(mk('span', '', esc(q.note || 'Asked ' + whenWords(q.at))));
          row.appendChild(w);
          sec.appendChild(row);
          var ar = mk('div', 'ow-people__acts');
          [['Let in', true], ['Decline', false]].forEach(function (o) {
            peopleAct(ar, o[0], function (b) {
              b.disabled = true;
              data.post(conv_(cid) + '/joins/' + encodeURIComponent(q.person), { approve: o[1] }).then(function (rr) {
                b.disabled = false;
                if (!rr || !rr.ok) { if (OW.toast) OW.toast(why(rr) || 'That did not work. Try again.'); return; }
                if (OW.toast) OW.toast(o[1] ? (q.name || 'They') + ' is in.' : 'Declined.', { tone: 'ok' });
                rereadRoom('people');
              });
            });
          });
          sec.appendChild(ar);
        });
      }).catch(function () {});
      /* LEAVING IS YOURS — anyone but the person who started the chat */
      var meRow = all.filter(function (p) { return p.me; })[0];
      if (meRow && String(meRow.role || '').toLowerCase() !== 'owner') {
        var sL = section(body, '');
        var lv = setRow(sL, 'out', 'Leave this chat', '', function () {
          if (!lv.hasAttribute('data-armed')) {
            lv.setAttribute('data-armed', '1');
            lv.querySelector('.ow-set__lb').textContent = 'Tap again to leave';
            global.setTimeout(function () { if (lv.isConnected) { lv.removeAttribute('data-armed'); lv.querySelector('.ow-set__lb').textContent = 'Leave this chat'; } }, 3200);
            return;
          }
          lv.disabled = true;
          data.del(conv_(cid) + '/participants/' + encodeURIComponent(me)).then(function (r) {
            lv.disabled = false;
            if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That did not work. Try again.'); return; }
            data.invalidate(API);
            if (OW.toast) OW.toast('You left ' + (conv.title || 'the chat') + '.', { tone: 'ok' });
            teardown();
            if (opts.onBack) opts.onBack(); else global.location.hash = '#messages';
          });
        }, true);
      }
    }
    function peopleAct(into, label, run) {
      var b = mk('button', 'po-act ow-people__act', esc(label)); b.type = 'button';
      b.addEventListener('click', function () { run(b); });
      into.appendChild(b);
      return b;
    }
    function arm(b, words) {
      var was = b.textContent;
      b.setAttribute('data-armed', '1'); b.textContent = words;
      global.setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-armed'); b.textContent = was; } }, 3200);
    }
    /* after a change, the room's own roster from the server, then the page again */
    function rereadRoom(page) {
      return data.get(conv_(cid) + '?limit=30', { fresh: true }).then(function (r) {
        var d = (r && r.ok && r.data) || {};
        if (d.conversation) {
          conv.participants = d.conversation.participants || conv.participants;
          if (d.conversation.title !== undefined) conv.title = d.conversation.title;
          if (d.conversation.face) conv.face = d.conversation.face;
        }
        if (d.my_role) myRole = d.my_role;
        if (d.policy) policy = d.policy;
        if (d.people) _people = Object.assign(_people || {}, d.people);
        if (d.proposals) { openProps = d.proposals; paintProps(); }
        if (d.messages) { merge(d.messages); paint(); }
        paintHead();
        data.invalidate(API);
        if (page !== undefined) openChatSet(page);
      });
    }
    function setRoleOf(p, role, b) {
      b.disabled = true;
      data.put(conv_(cid) + '/participants/' + encodeURIComponent(p.email), { role: role }).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That did not change. Try again.'); return; }
        if (OW.toast) OW.toast(p.name + (role === 'admin' ? ' is an admin now.' : ' is a member now.'), { tone: 'ok' });
        rereadRoom('people');
      });
    }
    function removeFrom(p, b) {
      b.disabled = true;
      data.del(conv_(cid) + '/participants/' + encodeURIComponent(p.email)).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That did not work. Try again.'); return; }
        if (OW.toast) OW.toast(p.name + ' was removed.', { tone: 'ok' });
        rereadRoom('people');
      });
    }

    function drawRules(body, others) {
      var can = mayRule();
      var need_ = String((policy || {}).who_can_settings || 'admin').toLowerCase();
      var group_ = conv.type !== 'direct' && others.length > 1 || conv.type === 'group';
      /* IN A GROUP, THE ADMINS BY NAME (549) — and the way to see them all */
      var lede_ = whoMayRule();
      if (group_ && need_ !== 'participant' && need_ !== 'member') {
        var said_ = adminsSaid(roster());
        lede_ = (can ? 'You are an admin here, so you can change these.' : (said_ ? said_ + ' Only admins can change these.' : lede_));
      }
      body.appendChild(mk('p', 'ow-set__lede', esc(lede_ + (can ? ' A change applies to everyone here.' : ''))));
      if ((openProps || []).length) {
        var sV = section(body, 'Waiting on a vote');
        openProps.forEach(function (pr) { sV.appendChild(propCard(pr)); });
      }
      if (group_) {
        var pa = mk('button', 'po-act ow-people__open', 'See people and admins');
        pa.type = 'button';
        pa.addEventListener('click', function () { openChatSet('people'); });
        body.appendChild(pa);
      }
      var gov = String((policy || {}).governance || 'admins');
      if (can && gov !== 'admins') body.appendChild(mk('p', 'ow-set__lede', esc('Changes here are put to a vote: '
        + ({ majority: 'more than half', supermajority: 'two thirds', unanimous: 'everyone' }[gov] || gov) + ' of the chat must agree.')));

      var sM = section(body, 'Messages');
      ruleSwitch(sM, 'edit_own', 'Edit messages', 'People can edit what they sent.', 'A sent message stays as it was sent.', can);
      ruleSwitch(sM, 'edit_history', 'Show edit history', 'An edited message keeps what it said before.', 'Only the latest version is kept.', can);
      ruleSwitch(sM, 'delete_own', 'Delete messages', 'People can delete what they sent.', 'Sent messages stay.', can);
      ruleSwitch(sM, 'delete_is_visible', 'Show deleted messages', 'A deleted message leaves a line saying it was deleted.', 'A deleted message leaves no trace.', can);
      ruleSwitch(sM, 'forward', 'Forwarding', 'Messages can be forwarded to other chats.', 'Messages stay in this chat.', can);
      ruleSwitch(sM, 'reactions', 'Reactions', 'People can react to messages.', 'No reactions.', can);
      ruleSwitch(sM, 'replies', 'Replies', 'People can reply to a single message.', 'No threaded replies.', can);
      ruleSwitch(sM, 'attachments', 'Photos and files', 'People can send photos, videos and files.', 'Text only.', can);

      var sP = section(body, 'Privacy');
      ruleSwitch(sP, 'read_receipts', 'Read receipts', 'People see when their messages are read.', 'Nobody sees when a message is read.', can);
      ruleSwitch(sP, 'typing', 'Typing indicator', 'People see when someone is typing.', 'Typing is never shown.', can);
      ruleSwitch(sP, 'screenshots', 'Screenshot notices', 'The chat is told when someone takes a screenshot.', 'Screenshots are not reported.', can);
      var sD = section(body, 'Disappearing messages');
      ruleChoice(sD, 'disappearing', 'Messages disappear', [['denied', 'Off'], [86400, 'After 24 hours'], [604800, 'After 7 days'], [7776000, 'After 90 days']], can);

      if (conv.type !== 'direct' && others.length > 1 || conv.type === 'group') {
        var sG = section(body, 'Group');
        ruleChoice(sG, 'who_can_add', 'Who can add people', [['admin', 'Admins'], ['participant', 'Everyone']], can);
        ruleChoice(sG, 'who_can_settings', 'Who can change these rules', [['admin', 'Admins'], ['participant', 'Everyone']], can);
        ruleChoice(sG, 'joining', 'How people join', [['invite', 'By invitation'], ['request', 'They ask, an admin approves'], ['open', 'Anyone who finds it']], can);
        ruleSwitch(sG, 'history_for_new', 'New people see earlier messages', 'Someone added later can read what came before.', 'Someone added later starts from when they joined.', can);
        ruleChoice(sG, 'slow_mode_s', 'Slow mode', [[0, 'Off'], [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes']], can);
        ruleChoice(sG, 'governance', 'How rule changes pass', [['admins', 'An admin decides'], ['majority', 'More than half agree'], ['supermajority', 'Two thirds agree'], ['unanimous', 'Everyone agrees']], can);
      }
    }

    function openChatSet(page) {
      chatSet.innerHTML = '';
      chatSet.hidden = false;
      chatSet.setAttribute('data-page', page || '');
      host.setAttribute('data-chatset', '1');
      var others = (conv.participants || []).map(personOf).filter(function (p) {
        return p && !isBrain(p) && String(p.email || '').toLowerCase() !== me;
      });
      /* A GROUP OF TWO IS STILL A GROUP — after people leave, "Roof crew" with
         two left is Roof crew, not a line to whoever remains: no Block on
         the chat's page, and its People and admins stay (founder/556) */
      var one = (isDirect(conv) && others.length === 1) ? others[0] : null;
      var people = (typeof peopleOf === 'function' && peopleOf()) || conv.people || {};
      if (one && people[String(one.email || '').toLowerCase()]) {
        var pw = people[String(one.email).toLowerCase()];
        one = Object.assign({}, one, { name: pw.name || one.name, image: pw.image || one.image, account: pw.account });
      }
      var TITLES = { notify: 'Notifications', add: 'Add someone', report: 'Report', rules: 'Chat rules', people: 'People and admins', name: 'Group name' };
      var pg = mk('div', 'ow-set__page is-in');
      var ph = mk('div', 'ow-set__ph');
      var bk = mk('button', 'ow-set__back'); bk.type = 'button';
      bk.setAttribute('aria-label', page ? 'Back to chat settings' : 'Back to the chat');
      bk.innerHTML = icon('back');
      bk.addEventListener('click', function () { if (page) openChatSet(); else closeChatSet(); });
      ph.appendChild(bk);
      ph.appendChild(mk('h1', 'ow-set__pt', esc(TITLES[page] || 'Chat settings')));
      pg.appendChild(ph);
      var body = mk('div', 'ow-set__pb');
      pg.appendChild(body);
      chatSet.appendChild(pg);

      if (!page) {
        /* WHO THIS IS */
        var who = mk('div', 'ow-chatset__who');
        var f = mk('span', 'ow-chatset__face');
        if (one && one.image) { var im = doc.createElement('img'); im.src = OW.imageUrl ? OW.imageUrl(one.image) : one.image; im.alt = ''; f.appendChild(im); }
        else if (OW.faceMark) f.innerHTML = OW.faceMark();
        who.appendChild(f);
        var nm = mk('div', 'ow-chatset__nm');
        nm.appendChild(mk('b', '', esc(one ? (one.name || bare(one.email || '')) : (head.querySelector('.ow-thread-head__nm') || {}).textContent || 'This chat')));
        /* never an address under a name — their @handle, when they have one */
        var sub_ = mk('span', '', esc(one ? (one.account === false ? 'Not on ONEWAY yet' : '') : (others.length + 1) + ' people'));
        nm.appendChild(sub_);
        who.appendChild(nm);
        /* the face in their colour, as the bar and the inbox draw it */
        f.classList.add('ow-thread__av');
        var fh_ = conv.face && typeof conv.face.hue === 'number' && OW.hue && OW.hue.fromAngle ? OW.hue.fromAngle(conv.face.hue) : null;
        if (fh_) { f.style.setProperty('--ch1', fh_[0]); f.style.setProperty('--ch2', fh_[1] || fh_[0]); }
        if (!one) {
          f.setAttribute('data-kind', 'center'); f.innerHTML = '';
          var gp = (conv.face || {}).image;
          if (gp) { var gpi = doc.createElement('img'); gpi.src = OW.imageUrl ? OW.imageUrl(gp) : gp; gpi.alt = ''; f.appendChild(gpi); }
          else f.textContent = (headFace.textContent || '').trim();
          /* THE GROUP'S PICTURE: press its face (founder/556) */
          if (mayRule()) {
            f.setAttribute('role', 'button'); f.tabIndex = 0;
            f.setAttribute('aria-label', 'Change the group picture');
            f.classList.add('is-editable');
            var gpick = doc.createElement('input'); gpick.type = 'file'; gpick.accept = 'image/*'; gpick.hidden = true;
            who.appendChild(gpick);
            f.addEventListener('click', function () { gpick.click(); });
            gpick.addEventListener('change', function () {
              var file = gpick.files && gpick.files[0]; gpick.value = '';
              if (!file) return;
              var rd = new FileReader();
              rd.onload = function () {
                f.setAttribute('data-busy', '1');
                data.post('/api/oneway/media', { data: String(rd.result || ''), origin: 'uploaded' }).then(function (up) {
                  var item = up && up.ok && up.data && (up.data.media || up.data);
                  var url = item && item.url;
                  if (!url) { f.removeAttribute('data-busy'); if (OW.toast) OW.toast((up && up.error) || 'That picture could not be uploaded.'); return; }
                  return data.patch(conv_(cid), { picture: url }).then(function (r) {
                    f.removeAttribute('data-busy');
                    if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That did not save.'); return; }
                    conv.face = Object.assign({}, conv.face || {}, { image: url });
                    rereadRoom('');
                  });
                });
              };
              rd.readAsDataURL(file);
            });
          }
        }
        if (one && one.email && one.account !== false) {
          data.get('/api/oneway/people/' + encodeURIComponent(one.email)).then(function (r) {
            var d = (r && r.ok && r.data) || null;
            var hd = d && (d.handle || (d.profile && d.profile.handle));
            if (hd && sub_.isConnected) sub_.textContent = '@' + String(hd).replace(/^@/, '');
          }).catch(function () {});
        }
        body.appendChild(who);

        /* THE THREE THINGS PEOPLE DO HERE MOST, FIRST (founder/554, point 6):
           quiet it, see its rules, see who it is (or who is in it). Each is a
           row further down too; these are the reach-for-it copies. */
        var quick = mk('div', 'ow-chatset__quick');
        function qb(ic, label, run, on) {
          var q = mk('button', 'ow-chatset__q'); q.type = 'button';
          if (on) q.setAttribute('aria-pressed', 'true');
          q.innerHTML = '<span>' + icon(ic) + '</span><b>' + esc(label) + '</b>';
          q.addEventListener('click', function () { run(q); });
          quick.appendChild(q);
          return q;
        }
        var muted = !!(ntfInfo && ntfInfo.cur === 'none');
        qb(muted ? 'bell' : 'mute', muted ? 'Unmute' : 'Mute', function (q) {
          var lv = (ntfInfo && ntfInfo.cur === 'none') ? 'all' : 'none';
          q.disabled = true;
          data.put(conv_(cid) + '/notify', { level: lv }).then(function (r) {
            q.disabled = false;
            if (!r || !r.ok) { if (OW.toast) OW.toast('That did not change. ' + ((r && r.error) || 'Try again.')); return; }
            if (ntfInfo) ntfInfo.cur = (r.data || {}).level || lv;
            var mm = facts.querySelector('[data-muted]');
            if (ntfInfo && ntfInfo.cur === 'none' && !mm) { mm = mk('span', 'ow-fact', 'Muted'); mm.setAttribute('data-muted', '1'); facts.appendChild(mm); }
            if (ntfInfo && ntfInfo.cur !== 'none' && mm) mm.remove();
            data.invalidate(API);
            openChatSet();
          });
        }, muted);
        qb('sliders', 'Rules', function () { openChatSet('rules'); });
        if (one && one.email && one.account !== false) {
          qb('person', 'Profile', function () {
            try { doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { email: one.email } })); } catch (e) {}
          });
        } else if (!one) {
          qb('person', 'People', function () { openChatSet('people'); });
        }
        body.appendChild(quick);

        var s1 = section(body, 'Notifications');
        if (ntfInfo) setRow(s1, 'bell', 'Notifications', NTF_SAY[ntfInfo.cur] || ntfInfo.cur, function () { openChatSet('notify'); });
        else setRow(s1, 'bell', 'Notifications', 'Could not be read just now');

        var s2 = section(body, 'This chat');
        /* the label names the setting and the value is its answer — "Messages ·
           Messages disappear after 2 days" said it twice and was cut off */
        /* ★ FOUNDER/160, 541: every choice about this chat — editing,
           screenshots, read receipts, disappearing messages, a group's
           permissions — is on the Chat rules page, and pressing Disappearing
           messages goes there too. */
        /* the chat's own rule first — the one Chat rules changes — so this row
           and that page can never disagree; the retention read only when the
           rule is not a number (a Place's policy, a preserve) */
        var dis = Number((policy || {}).disappearing);
        setRow(s2, 'clock', 'Disappearing messages',
               dis > 0 ? 'After ' + human(dis)
                       : (retInfo && retInfo.ttl && !retInfo.preserve && retInfo.source !== 'default' ? 'After ' + human(retInfo.ttl) : 'Off'),
               function () { openChatSet('rules'); });
        setRow(s2, 'sliders', 'Chat rules', mayRule() ? '' : 'View', function () { openChatSet('rules'); });
        if (mayAdd) setRow(s2, 'plus', 'Add someone', '', function () { openChatSet('add'); });
        if (!one && mayRule()) {
          setRow(s2, 'doc', 'Group name', conv.title || '', function () { openChatSet('name'); });
        }
        /* THE GROUP'S LINK (founder/556) — how "anyone who finds it" and "they
           ask" become reachable. Copied, never opened in a sheet. */
        if (!one) {
          var jm = String((policy || {}).joining || 'invite');
          setRow(s2, 'link', 'Invite link',
                 jm === 'open' ? 'Anyone can join' : jm === 'request' ? 'They ask first' : 'Admins add people',
                 function () {
                   var url = global.location.origin + global.location.pathname + '#messages/' + encodeURIComponent(cid);
                   var done = function () { if (OW.toast) OW.toast('Link copied. ' + (jm === 'invite' ? 'Only admins can add people, so the link shows the group but does not let anyone in.' : 'Anyone you send it to can ' + (jm === 'open' ? 'join.' : 'ask to join.')), { tone: 'ok' }); };
                   try { global.navigator.clipboard.writeText(url).then(done, function () { if (OW.toast) OW.toast(url); }); }
                   catch (e) { if (OW.toast) OW.toast(url); }
                 });
        }
        if (!one) {
          var nAdm = roster().filter(function (p) { return isAdminRole(p.role); }).length;
          setRow(s2, 'person', 'People and admins',
                 nAdm + (nAdm === 1 ? ' admin' : ' admins') + ' · ' + (others.length + 1) + ' people',
                 function () { openChatSet('people'); });
        }

        if (one && one.email && one.account !== false) {
          var s3 = section(body, 'Privacy and safety');
          var first = (one.name || bare(one.email));
          var blk = setRow(s3, 'ban', 'Block ' + first, '', function () {
            if (!blk.getAttribute('data-armed')) {
              blk.setAttribute('data-armed', '1');
              blk.querySelector('.ow-set__lb').textContent = 'Tap again to block ' + first;
              setTimeout(function () { if (blk.isConnected) { blk.removeAttribute('data-armed'); blk.querySelector('.ow-set__lb').textContent = 'Block ' + first; } }, 3200);
              return;
            }
            blk.disabled = true;
            data.post('/api/oneway/graph/block/' + encodeURIComponent(one.email), {}).then(function (r) {
              blk.disabled = false;
              if (!r || !r.ok) { if (OW.toast) OW.toast('That did not block. ' + ((r && r.error) || 'Try again.')); return; }
              if (OW.toast) OW.toast(first + ' is blocked. They cannot message you or see your profile.', { tone: 'ok' });
              data.invalidate('/api/');
              closeChatSet();
            });
          }, true);
          setRow(s3, 'flag', 'Report ' + first, '', function () { openChatSet('report'); });
        }
      } else if (page === 'rules') {
        drawRules(body, others);
      } else if (page === 'people') {
        drawPeople(body);
      } else if (page === 'name') {
        /* A GROUP'S NAME (founder/556) — one field, Save, and back */
        var fN = mk('form', 'ow-rename');
        var inN = doc.createElement('input');
        inN.type = 'text'; inN.maxLength = 140; inN.value = conv.title || '';
        inN.setAttribute('aria-label', 'Group name'); inN.className = 'ow-rename__in';
        var goN = mk('button', 'ow-btn', 'Save'); goN.type = 'submit';
        fN.appendChild(inN); fN.appendChild(goN);
        fN.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var t = inN.value.trim(); if (!t) { inN.focus(); return; }
          goN.disabled = true;
          data.patch(conv_(cid), { title: t }).then(function (r) {
            goN.disabled = false;
            if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That did not save. Try again.'); return; }
            conv.title = ((r.data || {}).conversation || {}).title || t;
            if (OW.toast) OW.toast('Renamed.', { tone: 'ok' });
            rereadRoom('');
          });
        });
        body.appendChild(fN);
        try { inN.focus(); inN.select(); } catch (e) {}
      } else if (page === 'notify') {
        var sN = section(body, '');
        (ntfInfo ? ntfInfo.levels : ['all', 'mentions', 'none']).forEach(function (lv) {
          var el = mk('button', 'ow-set__row ow-setpick'); el.type = 'button';
          el.setAttribute('role', 'radio');
          var on = ntfInfo && ntfInfo.cur === lv;
          el.setAttribute('aria-checked', String(!!on));
          el.innerHTML = '<span class="ow-set__ic">' + icon(lv === 'none' ? 'ban' : 'bell') + '</span>'
            + '<span class="ow-setpick__w"><b>' + esc(NTF_SAY[lv] || lv) + '</b></span>'
            + '<span class="ow-setpick__ok">' + (on ? icon('check') : '') + '</span>';
          el.addEventListener('click', function () {
            el.disabled = true;
            data.put(conv_(cid) + '/notify', { level: lv }).then(function (r) {
              el.disabled = false;
              if (!r || !r.ok) { if (OW.toast) OW.toast('That did not change. ' + ((r && r.error) || 'Try again.')); return; }
              ntfInfo.cur = (r.data || {}).level || lv;
              var mm = facts.querySelector('[data-muted]');
              if (ntfInfo.cur === 'none' && !mm) { mm = mk('span', 'ow-fact', 'Muted'); mm.setAttribute('data-muted', '1'); facts.appendChild(mm); }
              if (ntfInfo.cur !== 'none' && mm) mm.remove();
              data.invalidate(API);
              openChatSet();
            });
          });
          sN.appendChild(el);
        });
        if (ntfInfo && ntfInfo.why) body.appendChild(mk('p', 'ow-set__lede', esc(ntfInfo.why)));
      } else if (page === 'add') {
        body.appendChild(mk('p', 'ow-set__lede', 'Add someone to this chat by their email or username.'));
        addForm(body);
      } else if (page === 'report' && one) {
        body.appendChild(mk('p', 'ow-set__lede', 'What is wrong? Nobody is told who reported it.'));
        var sR = section(body, '');
        sR.appendChild(mk('p', 'ow-set__lede', 'Reading the reasons…'));
        data.get('/api/oneway/moderation/reasons').then(function (rr) {
          sR.innerHTML = '';
          if (!rr.ok) { sR.appendChild(mk('p', 'ow-set__lede', 'The reasons could not be read, so this cannot be sent right now.')); return; }
          (rr.data.reasons || []).forEach(function (reason) {
            setRow(sR, 'flag', String(reason).replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }), '', function () {
              data.post('/api/oneway/moderation/report/person/' + encodeURIComponent(one.email), { reason: reason }).then(function (sr) {
                if (OW.toast) OW.toast(sr.ok ? 'Reported. Nobody is told who reported it.' : ('That could not be sent. ' + (sr.error || '')), sr.ok ? { tone: 'ok' } : undefined);
                if (sr.ok) openChatSet();
              });
            });
          });
        });
      }
      /* THE PAGE'S TOP IS THE WINDOW'S TOP. `scrollIntoView` put the page's
         own header flush with the viewport — under the App's sticky top bar,
         so the back arrow sat on the OS button (founder's pane, 2026-09-26).
         The page is the surface's first thing, so the window's top is its top. */
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    function closeChatSet() {
      chatSet.hidden = true; chatSet.innerHTML = '';
      host.removeAttribute('data-chatset');
    }
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !chatSet.hidden && host.isConnected) closeChatSet();
    });

    /* ══ WHAT THE ROOM IS DECIDING (founder/556) ════════════════════════════
       A group that chose "more than half agree" turns a rule change into a
       proposal — and nothing showed it or took a vote, so no change could ever
       pass. Each open proposal is shown above the composer and at the top of
       Chat rules, in the words Chat rules itself uses, with its count and
       Agree / Disagree for anybody who may vote and has not. */
    var openProps = [];
    var propsBox = mk('div', 'ow-props');
    var RULE_LABELS = { edit_own: 'Edit messages', edit_history: 'Show edit history', delete_own: 'Delete messages',
      delete_is_visible: 'Show deleted messages', forward: 'Forwarding', reactions: 'Reactions', replies: 'Replies',
      attachments: 'Photos and files', read_receipts: 'Read receipts', typing: 'Typing indicator',
      screenshots: 'Screenshot notices', disappearing: 'Messages disappear', who_can_add: 'Who can add people',
      who_can_settings: 'Who can change the rules', joining: 'How people join',
      history_for_new: 'New people see earlier messages', slow_mode_s: 'Slow mode', governance: 'How rule changes pass' };
    function ruleValueWords(k, v) {
      if (k === 'disappearing') return (v === 'denied' || !Number(v)) ? 'Off' : 'After ' + human(Number(v));
      if (k === 'slow_mode_s') return Number(v) ? human(Number(v)) : 'Off';
      var W = { allowed: 'On', denied: 'Off', recorded: 'On', admin: 'Admins', participant: 'Everyone', member: 'Everyone',
                invite: 'By invitation', request: 'They ask, an admin approves', open: 'Anyone who finds it',
                admins: 'An admin decides', majority: 'More than half agree', supermajority: 'Two thirds agree',
                unanimous: 'Everyone agrees' };
      return W[String(v)] || String(v);
    }
    function changeWords(ch) {
      return Object.keys(ch || {}).map(function (k) {
        return (RULE_LABELS[k] || k.replace(/_/g, ' ')) + ': ' + ruleValueWords(k, ch[k]);
      }).join(' · ');
    }
    function propCard(pr) {
      var c = mk('div', 'ow-prop');
      c.appendChild(mk('p', 'ow-prop__what', esc((pr.by_name || 'Someone') + ' proposes ' + changeWords(pr.changes))));
      var needN = pr.governance === 'unanimous' ? pr.electorate : Math.max(1, Math.ceil((pr.needed || 0.5) * (pr.electorate || 1) - 1e-9));
      c.appendChild(mk('span', 'ow-prop__n', esc(pr.yes + ' of ' + pr.electorate + ' agree · passes at ' + needN)));
      var acts = mk('div', 'ow-prop__acts');
      if (pr.may_vote && pr.my_vote === null) {
        [['Agree', true], ['Disagree', false]].forEach(function (o) {
          var b = mk('button', 'po-act' + (o[1] ? ' po-act--go' : ''), o[0]); b.type = 'button';
          b.addEventListener('click', function () {
            acts.setAttribute('data-busy', '1');
            data.post(conv_(cid) + '/proposals/' + encodeURIComponent(pr.id) + '/vote', { yes: o[1] }).then(function (r) {
              acts.removeAttribute('data-busy');
              if (!r || !r.ok) { if (OW.toast) OW.toast(why(r) || 'That vote did not count. Try again.'); return; }
              var out = r.data || {};
              if (OW.toast) OW.toast(out.applied ? 'It passed. The rule has changed for everyone.'
                                   : out.failed ? 'It did not pass.' : 'Your vote is in.', { tone: 'ok' });
              rereadRoom(chatSet.hidden ? undefined : 'rules');
            });
          });
          acts.appendChild(b);
        });
      } else if (pr.my_vote !== null && pr.my_vote !== undefined) {
        acts.appendChild(mk('span', 'ow-prop__mine', pr.my_vote ? 'You agreed' : 'You disagreed'));
      }
      c.appendChild(acts);
      return c;
    }
    function paintProps() {
      propsBox.innerHTML = '';
      (openProps || []).forEach(function (pr) { propsBox.appendChild(propCard(pr)); });
      if (!propsBox.parentNode && foot) foot.insertBefore(propsBox, foot.firstChild);
    }

    function human(sec) {
      if (sec >= 86400) { var d = Math.round(sec / 86400); return d + (d === 1 ? ' day' : ' days'); }
      if (sec >= 3600) { var h = Math.round(sec / 3600); return h + (h === 1 ? ' hour' : ' hours'); }
      var m = Math.max(1, Math.round(sec / 60)); return m + (m === 1 ? ' minute' : ' minutes');
    }

    /* facts are drawn from the page read in load(); the separate reads run
       only if that read did not carry them (an older runtime) */
    return load().then(function (n) { facts_(); return n; });
  };

  /* ══ REACHING A CENTER ══════════════════════════════════════════════════
     ★ FOUNDER's list: *"Center reception where applicable."*

     A Center is not a person and messaging it is a different act: the Center
     declares HOW it receives (a Brain, a workspace, named recipients) and what
     the sender will be told. `GET .../reception` answers that BEFORE the
     person writes, so the App can say who will read this rather than posting
     into a room and hoping. */
  /* the waiting requests as one block — Messages draws it above the inbox,
     and Settings > Message requests draws the same block (founder/539), so
     there is one way to accept or decline a request, not two */
  OW.messaging.requestsBlock = function (reqs, opts) { return requestsBlock(reqs || [], opts || {}); };

  OW.messaging.centerReception = function (centerId) {
    return data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/reception',
                    { fresh: true });
  };
  /* NO BODY. The route opens (or reuses) the conversation and hands back the
     disclosure with it — the first message is then sent through the ordinary
     messaging path, into the ordinary conversation, like any other. */
  OW.messaging.messageCenter = function (centerId) {
    return data.post('/api/oneway/centers/' + encodeURIComponent(centerId) + '/message',
                     {}).then(function (r) {
      data.invalidate(API);
      if (!r.ok) return { state: 'refused', rule: ruleOf(r), why: why(r) };
      return { state: 'open', data: r.data };
    });
  };

})(window);
