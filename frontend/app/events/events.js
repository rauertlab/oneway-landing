/* ONEWAY — APP · EVENT.  One Event, opened inside Oneway.

   ★ FOUNDER, 2026-08-24: *"A placed Event opens `/e/{id}` instead of an actual
     App Event experience."* And: *"App navigation stays inside Oneway when an
     Event is opened from the App."*

   `/e/{id}` REMAINS THE PUBLIC, SHAREABLE WEB REPRESENTATION. This is a
   different VIEW of the same Event, not a second Event. Both resolve the same
   `evt_` id through the same canonical capability; neither materialises its own
   copy.

   THE VISITOR PAIR, AND WHY IT IS NOT `/api/events/{id}`
   =======================================================
       GET /api/public/events/{id}           the Event, canonically
       GET /api/public/events/{id}/centers   owner + DECLARED relationships

   Lane A's rule: `/api/public/events/...` is VISITOR context — no session, so
   it withholds Centers with no public face and never exposes an owner's grant
   list. `/api/events/{id}/...` is OPERATOR context and checks authority against
   a specific Center. A page a visitor can reach calls the public pair.

   `GET /api/events/{id}` IS NOT USED HERE AND MUST NOT BE. Measured
   2026-08-24: it scans `kv_load_all("org_events")`, loops every Center's every
   event, and FABRICATES performer->Center links with a bidirectional substring
   match — `p_lc in nm or nm in p_lc` — so a Center named "AC" links to "Black
   Sabbath" and one named "Butcher Shop" to "Cher". The live Event is
   `Wale · Jadakiss · Fat Joe`. Rendering it would put an invented relationship
   in front of a person, which §21 forbids outright. A is replacing that route
   in place; when it happens this file does not change, because it is already
   only asking for what will still be true.

   A GRANT IS NOT A PUBLICATION. Promoting Centers come from the DECLARED
   relationships, never from the owner's grant list — "who may" and "who did"
   are different facts and only the second is true of this page.

   ATTENDANCE IS ONE FACT
   ======================
   `POST /api/org/events/{id}/rsvp` takes a DESIRED STATUS and returns
   `{status, attending}`. There is no App attendance and OS attendance; the
   count on this page is the same row the OS reads. Nothing here counts
   anything itself. */

(function (global) {
  'use strict';
  var OW = global.OW;
  if (!OW || !OW._u) {
    console.warn('[app/events] load oneway-popit.js and popit-live.js first');
    return;
  }
  var _u = OW._u;
  var data = _u.data, doc = _u.doc, esc = _u.esc, failed = _u.failed;
  var loading = _u.loading, mk = _u.mk, refused = _u.refused;
  var signedIn = _u.signedIn, whenWords = _u.whenWords;

  (function () {
    var need = ['data', 'doc', 'esc', 'loading', 'mk', 'refused', 'signedIn', 'whenWords'];
    var missing = need.filter(function (n) { return typeof _u[n] === 'undefined'; });
    if (missing.length) console.error('[app/events] OW._u is missing: ' + missing.join(', '));
  })();

  /* The three answers a person may give. Values, not a toggle — see `rsvp`. */
  var CHOICES = [
    { v: 'going', label: 'Going' },
    { v: 'maybe', label: 'Maybe' },
    { v: 'not',   label: 'Not going' }
  ];

  /* What a declared relationship MEANS on this page. `promotes` and `displays`
     are distinct canonical declarations (lane A) and are not folded into a
     boolean — a Center that chose to promote an Event did something different
     from one that merely shows it, and the page says which. */
  var REL_WORDS = { owns: 'By', hosts: 'Hosted at',
                    promotes: 'Promoted by', displays: 'Shown at' };

  /* WHEN AN EVENT HAPPENS, as a person reads it.

     Separate from `whenWords` on purpose: that one answers "how long ago", this
     one answers "when is it", and an Event is almost always in the future.
     Returns '' rather than a guess when there is nothing parseable — the caller
     then shows no line at all. */
  /* ── IN THE PLACE'S OWN CLOCK, NEVER THE READER'S ────────────────────────
     `starts_at` is an instant. `toLocaleTimeString([])` writes it in the
     reader's zone, and a person in Los Angeles reading about a concert in
     Atlantic City was told 4:00 PM for a show at 7:00. B's audit found it; the
     public page and the Center's Upcoming tab had the same defect this
     morning, in two other costumes.

     The zone is the CENTER'S, from `/places/{cid}/events/{id}/when`, which
     derives it through the Center's location and answers `timezone` and
     `abbreviation` beside `starts_local`. Intl formats the instant IN that
     zone — no arithmetic, no guessing — and the abbreviation is written
     beside the hour so nobody has to wonder whose clock this is.

     WHEN THE ZONE CANNOT BE READ, the hour is written in UTC and says so.
     That is an honest answer; the reader's own clock, unlabelled, is not. */
  function eventWhen(ev, tz) {
    ev = ev || {}; tz = tz || {};
    var now = new Date();
    /* A DATE IS NOT AN INSTANT. An older event carries `date: "2026-09-01"`
       and `time: "18:00"` as the place wrote them, with no instant at all.
       `new Date("2026-09-01")` is midnight UTC, so a concert at six read
       "Tue, Sep 1, 12:00 AM UTC" (measured 2026-09-25 on the Boardwalk Beach
       Concert). The date and the hour are the place's own wall clock: they
       are written back as given, in no zone and with no zone label. */
    if (!ev.starts_at && !ev.start && /^\d{4}-\d{2}-\d{2}$/.test(String(ev.date || ''))) {
      var p = String(ev.date).split('-'), y = +p[0];
      var noon = new Date(Date.UTC(y, +p[1] - 1, +p[2], 12));
      var dayOnly = new Intl.DateTimeFormat([], { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
                                                   year: (y === now.getFullYear()) ? undefined : 'numeric' }).format(noon);
      var hm = /^(\d{1,2}):(\d{2})/.exec(String(ev.time || ''));
      var hour = hm ? new Intl.DateTimeFormat([], { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })
                        .format(new Date(Date.UTC(2000, 0, 1, +hm[1], +hm[2]))) : '';
      var here = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      var ahead = Math.round((Date.UTC(y, +p[1] - 1, +p[2]) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      if (String(ev.date) === here) return hour ? 'Today, ' + hour : 'Today';
      if (ahead === 1) return hour ? 'Tomorrow, ' + hour : 'Tomorrow';
      return (hour ? dayOnly + ', ' + hour : dayOnly) + ((ahead > 1 && ahead < 7) ? '  ·  in ' + ahead + ' days' : '');
    }
    var iso = ev.starts_at || ev.start || ev.date || '';
    if (!iso) return '';
    var t = new Date(String(iso));
    if (isNaN(t.getTime())) return '';
    var zone = tz.timezone || 'UTC';
    var abbr = tz.timezone ? (tz.abbreviation || '') : 'UTC';
    function fmt(o) {
      try { return new Intl.DateTimeFormat([], Object.assign({ timeZone: zone }, o)).format(t); }
      catch (e) { return new Intl.DateTimeFormat([], o).format(t); }
    }
    var yearThere = +fmt({ year: 'numeric' });
    var day = fmt({ weekday: 'short', month: 'short', day: 'numeric',
                    year: (yearThere === now.getFullYear()) ? undefined : 'numeric' });
    var time = fmt({ hour: 'numeric', minute: '2-digit' }) + (abbr ? (' ' + abbr) : '');
    var out = day + ', ' + time;

    /* AND HOW FAR OFF, because "Thu 10 Sep" alone makes a person do the
       arithmetic. Only for the near future, where it is the useful part. */
    var days = Math.round((t - now) / 864e5);
    if (days === 0) out = 'Today, ' + time;
    else if (days === 1) out = 'Tomorrow, ' + time;
    else if (days > 1 && days < 7) out += '  ·  in ' + days + ' days';

    /* ── AND WHEN IT ENDS, WHICH THE RUNTIME HAS ALWAYS ANSWERED ───────────
       `ends_at` is on every Event the canonical door serves and no surface
       drew it, so "7:30 PM" never said whether that meant an hour or a night.
       Same day → the closing time only ("6:30 – 9:00 PM"); a different day →
       the whole date, because an event that runs past midnight is two days to
       the person going to it. */
    var e2 = ev.ends_at || ev.end || '';
    if (e2) {
      var t2 = new Date(String(e2));
      if (!isNaN(t2.getTime()) && t2 > t) {
        function fmt2(o) {
          try { return new Intl.DateTimeFormat([], Object.assign({ timeZone: zone }, o)).format(t2); }
          catch (e) { return new Intl.DateTimeFormat([], o).format(t2); }
        }
        var sameDay = fmt({ year: 'numeric', month: 'short', day: 'numeric' })
                   === fmt2({ year: 'numeric', month: 'short', day: 'numeric' });
        var end = sameDay ? (fmt2({ hour: 'numeric', minute: '2-digit' }) + (abbr ? (' ' + abbr) : ''))
          : (fmt2({ weekday: 'short', month: 'short', day: 'numeric' }) + ', '
             + fmt2({ hour: 'numeric', minute: '2-digit' }) + (abbr ? (' ' + abbr) : ''));
        out = out.replace('  ·  in ', '\u0000in ');
        var tail = '';
        var cut = out.indexOf('\u0000');
        if (cut >= 0) { tail = '  ·  ' + out.slice(cut + 1); out = out.slice(0, cut); }
        out = out + ' – ' + end + tail;
      }
    }
    return out;
  }

  OW.live.event = function (host, eventId, opts) {
    opts = opts || {};
    eventId = String(eventId || '').trim();
    if (!eventId) { failed(host, 'This Event'); return Promise.resolve(0); }
    loading(host, 2);

    /* ONE EVENT BY ID, not an Event universe. Both reads are by id; neither
       walks a Center's calendar to find one thing. */
    /* ── THE EVENT NOW COMES FROM THE NEW BACKEND ──────────────────────
       ★ FOUNDER, 2026-09-03: *"establish Events as a canonical domain."*

       `/api/oneway/events/{id}` is served by `api/oneway/`, which imports
       nothing from main.py. It answers the Event, the viewer's OWN answer, the
       public counts and the resolved local time in ONE read — the same round
       trip this surface already wanted, from the domain that owns the fact.

       ONE EVENT ADDRESSED BY ITS OWN ID. The legacy RSVP route read the owning
       Center from the CALLER (`body.center_id or biz_id`), so a person who
       found an Event in a feed or from a link got 404 unless the client already
       knew who owned it. The canonical route reads the Center off the Event, so
       finding a thing and acting on it no longer contradict each other.

       `/centers` IS CANONICAL TOO, as of the same change. It projects the
       relationship model in `core/centers/events.py` — owns · hosts · promotes
       · displays, with real authority behind each — rather than rebuilding it,
       so there is one answer to "which Centers carry this Event" and not two. */
    return Promise.all([
      data.get('/api/oneway/events/' + encodeURIComponent(eventId), { fresh: true }),
      data.get('/api/oneway/events/' + encodeURIComponent(eventId) + '/centers')
        .catch(function () { return { ok: false }; })
    ]).then(function (rs) {
      var er = rs[0], cr = rs[1];
      if (!er.ok) { refused(host, er, 'This Event'); return 0; }
      /* THE PLACE'S CLOCK, asked once the event has said which place. This is
         a third read on the page, and it should not be: the event's own read
         knows its Center and could carry starts_local and timezone itself.
         Asked of B; when it lands this call goes and eventWhen reads the row. */
      var ev0 = (er.data && (er.data.event || er.data)) || {};
      var cid0 = ev0.center_id || ev0.host_center_id || '';
      var whenRead = cid0
        ? data.get('/api/oneway/places/' + encodeURIComponent(cid0) + '/events/'
                   + encodeURIComponent(eventId) + '/when')
            .catch(function () { return { ok: false }; })
        : Promise.resolve({ ok: false });
      return whenRead.then(function (wr) { return rs.concat([wr]); });
    }).then(function (rs) {
      var er = rs[0], cr = rs[1], wr = rs[2];
      if (!er || !er.ok) return 0;
      var tz = (wr && wr.ok && wr.data && wr.data.readable) ? wr.data : {};
      var ev = (er.data && (er.data.event || er.data)) || {};
      if (!ev.title) { refused(host, { status: 404 }, 'This Event'); return 0; }
      /* ATTENDANCE RIDES IN THE BODY READ. "Boardwalk Beach Concert / Owned by
         Atlantic City / Going · 24" is ONE thing a person looks at, so it is one
         round trip. `interested` and `maybe` are the same stored fact under two
         names — the interest route writes status "maybe" — and this surface does
         not need to know that. */
      /* THE CANONICAL SHAPE, NOT A TRANSLATION LAYER. The domain answers
         `counts: {going, maybe, not}` and `you: "going"|"maybe"|"not"|""`.
         Mapping those back onto the legacy `attendance`/`my_rsvp` names here
         would be a second vocabulary for one fact — the thing this migration
         exists to remove — so the surface reads what the domain says. */
      var _counts = (er.data && er.data.counts) || {};
      var att = { going: _counts.going, maybe: _counts.maybe };
      /* THE HOST IS ON THE ROW NOW (B, 78226c3): `host {id, name, hue}`. This
         page could not say "By Feed Continuity Center" because the row had
         only host_center_id and no name, and /centers answered owner null
         for an event whose row named its host. The row is asked first; the
         /centers read still adds the declared relationships (hosts,
         promotes, displays). */
      var ownerRec = (er.data && er.data.owner)
        || (ev.host && ev.host.name ? { name: ev.host.name, biz_id: ev.host.id, center_id: ev.host.id } : null)
        || null;

      host.className = ''; host.innerHTML = '';
      var page = mk('div', 'ow-ev', '');

      /* ── THE EVENT'S OWN PICTURE ────────────────────────────────────────
         `cover_image_url` has been on the contract since Events became
         canonical and no surface ever drew it — an event with a poster was
         rendered as a line of text. It leads, the way a poster does, and an
         event without one is a line of text because that is all it has. */
      var cover = (ev.cover_image_url || ev.cover || '').trim();
      if (cover) {
        var cw = mk('div', 'ow-ev__cover');
        var ci = doc.createElement('img');
        ci.src = OW.imageUrl ? OW.imageUrl(cover) : cover;
        ci.alt = ''; ci.loading = 'lazy'; ci.decoding = 'async';
        ci.addEventListener('error', function () { cw.remove(); });
        cw.appendChild(ci);
        page.appendChild(cw);
      }
      page.appendChild(mk('div', 'ow-ev__kind', 'Event'));
      page.appendChild(mk('h1', 'ow-ev__t', esc(ev.title)));    /* mk writes HTML: a title is text (lane B) */
      /* ── WHEN, AND WHY NOT `whenWords` ────────────────────────────────
         This said `whenWords(ev)` and rendered NOTHING, so an Event opened with
         no date and no time at all — the canonical read carries
         `starts_at: "2026-09-10T23:00:00+00:00"` the whole time.

         TWO FAULTS, EITHER ALONE ENOUGH. `whenWords(iso)` takes an ISO STRING
         and was handed the whole Event object, so `new Date(object)` is an
         Invalid Date and it returns ''. And it is a PAST-tense relative
         formatter — "now", "5m", "Yesterday" — so even with the right argument
         an Event next Thursday computes negative minutes and reads "now". A
         helper written for how long ago something happened cannot answer when
         something WILL happen; that is a different question wearing the same
         word.

         AN ABSENT DATE STAYS ABSENT. If nothing parses, this renders nothing
         rather than "Invalid Date" or today — an Event with no announced time
         is a real state, and inventing one is worse than showing none. */
      var when = eventWhen(ev, tz);
      if (when) page.appendChild(mk('div', 'ow-ev__when', when));

      /* `place` is the canonical field; `location` was the legacy one and is
         kept as a fallback while both stores answer. `digital` is the canonical
         mode word — checked against events/contracts.py MODES rather than
         guessed. */
      var where = (ev.mode === 'digital') ? 'Online'
        : ((ev.place || ev.location || '').trim() || '');
      if (where) page.appendChild(mk('div', 'ow-ev__w', esc(where)));

      /* ── WHO IS ON ─────────────────────────────────────────────────────
         `performers` is the field an event about people is FOR — a lineup, a
         speaker, a band — and nothing rendered it. Each is named as itself;
         one that names a Center opens it. */
      /* A PERFORMER IS A NAME. `events/contracts.py` stores
         `[str(p)[:80] …]`, so the field is names and nothing else — an object
         sent here is stringified into "{'name': …}" at the door. Names are
         what is drawn; if performers ever become people or Centers, this is
         where the door opens, not a guess about a shape that does not exist. */
      var perf = (ev.performers || [])
        .map(function (x) { return (typeof x === 'string' ? x : (x && x.name) || '').trim(); })
        .filter(Boolean);
      if (perf.length) {
        var pr = mk('div', 'ow-ev__perf');
        pr.appendChild(mk('span', 'ow-ev__perfw', perf.length === 1 ? 'Performing' : 'Line-up'));
        perf.slice(0, 8).forEach(function (nm) { pr.appendChild(mk('span', 'ow-ev__perfn', esc(nm))); });
        page.appendChild(pr);
      }

      /* ── AND THE WAY IN, WHEN IT IS ONLINE ──────────────────────────────
         An online event whose `online_url` is never drawn is an event you
         cannot attend. Only a real http(s) address is offered — the same rule
         every other link on this platform obeys — and it opens in its own tab
         with no referrer. */
      var ourl = String(ev.online_url || '').trim();
      if (ourl && /^https?:\/\//i.test(ourl)) {
        var oa = doc.createElement('a');
        oa.className = 'ow-ev__join'; oa.href = ourl;
        oa.target = '_blank'; oa.rel = 'noopener noreferrer';
        oa.textContent = 'Join online';
        page.appendChild(oa);
      }

      /* ── GOING · MAYBE · NOT ─────────────────────────────────────────────
         ★ FOUNDER: *"The user shouldn't care that an API exists. They should
           see 'Going · 24 people going', and tapping it should change the
           canonical state."*

         A DESIRED STATUS IS SENT, NEVER A TAP. Lane B was explicit: queue
         `going`, not "the user pressed the button". A toggle replayed after a
         reconnect can land the opposite of what she chose, and this write is
         replayable by design.

         RSVP is SAFE-WITHOUT-KEY — a replay writes the same value — so it may
         be queued offline, and the outbox reconciles it on the 200 rather than
         waiting for a `replayed` flag that will never come for this class. */
      var acts = mk('div', 'ow-ev__acts', '');
      var count = mk('div', 'ow-ev__count', '');
      var mine = String((er.data && er.data.you) || ev.my_rsvp || '').toLowerCase();

      function paint(status, attending, maybe) {
        mine = String(status || '').toLowerCase();
        Array.prototype.forEach.call(acts.children, function (b) {
          var on = b.getAttribute('data-v') === mine;
          b.setAttribute('data-act', on ? 'on' : 'off');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (attending != null) {
          /* AND WHO MIGHT (founder/559): `counts.maybe` rode on every read
             and was never drawn — "5 people going · 2 maybe" is the answer
             a person weighing whether to go is actually looking for */
          if (maybe != null) att.maybe = maybe;
          count.textContent = attending + (attending === 1 ? ' person going'
                                                           : ' people going')
            + (att.maybe ? ' \u00b7 ' + att.maybe + ' maybe' : '');
        }
      }

      CHOICES.forEach(function (c) {
        var b = mk('button', 'po-act', c.label);
        b.type = 'button';
        b.setAttribute('data-v', c.v);
        b.addEventListener('click', function () {
          if (!signedIn()) { if (global.go) global.go('home'); return; }
          var prev = mine, prevCount = count.textContent;
          /* Optimistic for feel — and REVERTED on refusal, never left standing.
             The count is not guessed: it is cleared until the server says, and
             a made-up number would be a second attendance answer. */
          paint(c.v, null);
          count.textContent = '';
          data.post('/api/oneway/events/' + encodeURIComponent(eventId) + '/rsvp',
                    { answer: c.v },
                    { queueable: true, label: c.label,
                      invalidate: '/api/oneway/events/' })
            .then(function (r) {
              if (r && r.ok && r.data) {
                /* `answer` and `counts.going` are the domain's own names. */
                paint(r.data.answer || c.v,
                      (r.data.counts && r.data.counts.going),
                      (r.data.counts && r.data.counts.maybe));
                return;
              }
              if (r && r.queued) {
                /* WRITTEN DOWN, NOT SAVED. The person's choice is shown because
                   it IS their choice; the count is not, because nobody has
                   counted it yet. */
                paint(c.v, null);
                count.textContent = 'Pending — this device only';
                return;
              }
              paint(prev, null);
              count.textContent = prevCount;
              /* the reason, where the person is looking — a choice that just
                 "didn't take" is a press they cannot learn from (founder/502
                 sweep: event full, ended, a rule) */
              if (global.OW && OW.toast) OW.toast('Your answer did not change. ' + ((r && r.error) || 'Try again.'));
            })
            .then(function () { Array.prototype.forEach.call(acts.querySelectorAll('button'), function (x) { x.disabled = false; }); });
          /* one answer in flight at a time, so a second press cannot race the
             revert of the first */
          Array.prototype.forEach.call(acts.querySelectorAll('button'), function (x) { x.disabled = true; });
        });
        acts.appendChild(b);
      });
      /* ── THE STATE IS THE CLOCK'S, AND THE PAGE SAYS IT ─────────────────
         B (e4c89c1): `state` is derived on every read — scheduled -> live ->
         ended — and the RSVP door refuses an ended event with its own
         sentence. This page kept offering Going / Maybe / Not going on a
         concert that ended the night before, MEASURED the morning after; a
         press would now be refused, and a control that exists to be refused
         is the dead-control family. An ended event says so and counts who
         went; a live one says it is on. The choices are drawn only while
         they can still be chosen. `stored_state` rides beside it and is not
         what a person is shown. */
      var state = String(ev.state || '').toLowerCase();
      if (state === 'ended') {
        var went = (att.going != null) ? att.going : null;
        page.appendChild(mk('div', 'ow-ev__state',
          'This event has ended' + (went ? (' \u00b7 ' + went + (went === 1 ? ' person went' : ' people went')) : '') + '.'));
      } else if (state === 'cancelled') {
        page.appendChild(mk('div', 'ow-ev__state', 'This event was cancelled.'));
      } else {
        if (state === 'live') page.appendChild(mk('div', 'ow-ev__state ow-ev__state--live', 'Happening now.'));
        page.appendChild(acts);
        page.appendChild(count);
      }
      /* THE VIEWER'S OWN ANSWER IS NOT ON A SESSIONLESS READ, and it is not
         invented. Nothing is shown as selected until they choose, which is
         honest for a first tap and self-corrects the instant they do. Claiming
         "not going" for somebody who has not answered would be a fact the
         platform does not have. */
      paint(mine, (att.going != null) ? att.going : null);

      if (ev.description) {
        page.appendChild(mk('p', 'ow-ev__d', esc(ev.description)));
      }

      /* ── WHOSE EVENT THIS IS, AND WHO ELSE CARRIES IT ───────────────────
         From the CANONICAL relationship read, never from the legacy route's
         derived fields. An unanchored Event answers 404 with BLIND in it —
         that is "cannot be asked", not "no other Centers", so nothing is
         rendered rather than a false absence being stated. */
      var rel = (cr && cr.ok && cr.data) ? cr.data : null;
      if (rel || ownerRec) {
        rel = rel || {};
        var owner = rel.owner || ownerRec || null;
        /* `center_id` is the canonical name for it; `biz_id` is the legacy
           spelling of the same value and is read as a fallback so this surface
           keeps working against either while the switch settles. */
        var others = (rel.centers || []).filter(function (x) {
          return x && x.rel && x.rel !== 'owns' && (x.center_id || x.biz_id);
        });
        if (owner || others.length) {
          var box = mk('div', 'ow-ev__rel', '');
          if (owner && owner.name) {
            box.appendChild(relRow('owns', owner.name, owner.center_id || owner.biz_id));
          }
          others.forEach(function (x) {
            /* A CENTER WITH NO RESOLVED NAME IS SKIPPED, not printed as an id.
               `x.name || x.biz_id` rendered `b8064b160465` at a person the
               moment a Center record could not be read. Saying nothing about a
               Center we cannot name is the honest outcome. */
            var cid = x.center_id || x.biz_id;
            if (!x.name) return;
            box.appendChild(relRow(x.rel, x.name, cid));
          });
          page.appendChild(box);
        }
      }

      /* ── WHERE ELSE THIS EVENT WENT ──────────────────────────────────────
         ★ FOUNDER: *"then, if distributed externally: Shared to Reddit ->
           Reddit attribution/link."*

         ONLY WHAT ACTUALLY LANDED. Lane B's distribution rows carry three
         states — `sent` requires the provider's own reference, `refused` keeps
         the provider's words, `failed` means we could not reach it. A visitor
         is shown only `sent`, because that is the only one that is a fact about
         the Event rather than about our attempt. A refusal is an operator's
         business and appears on an operator's surface, not on a page a stranger
         reads.

         AND IT IS NEVER PRESENTED AS AN ONEWAY POST. The row links OUT with the
         platform named. Oneway shared this somewhere; it did not absorb it. */
      /* CANONICAL, AND IT FIXES WHAT A VISITOR COULD SEE. The legacy route
         sliced this by the CALLER's Center, so a person reading a public Event
         saw no distributions unless they happened to be in the owning Center —
         measured with a control, 1 row as the owner and 0 as anyone else. The
         canonical route reads the Center off the Event. */
      data.get('/api/oneway/events/' + encodeURIComponent(eventId) + '/distributions')
        .then(function (dr) {
          if (!dr || !dr.ok || !dr.data) return;    /* not ours to see: silent */
          var sent = (dr.data.distributions || []).filter(function (d) {
            return d && d.state === 'sent' && d.url;
          });
          if (!sent.length) return;
          var box = mk('div', 'ow-ev__dist', '');
          sent.slice(0, 6).forEach(function (d) {
            var a = doc.createElement('a');
            a.className = 'ow-ev__distrow';
            a.href = d.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.innerHTML = '<span class="ow-ev__distw">Shared to</span>' +
              '<span class="ow-ev__distn">' +
              esc(d.platform_label || d.platform || 'another platform') + '</span>';
            box.appendChild(a);
          });
          page.appendChild(box);
        });

      /* Put it somewhere of your own. The SAME placement primitive the Center
         surface uses — not a second mechanism. */
      if (signedIn() && OW.canvas && OW.canvas.place) {
        var add = mk('button', 'po-act po-act--ghost', 'Add to your Home');
        add.type = 'button';
        add.addEventListener('click', function () {
          add.disabled = true;
          var was = add.textContent;
          OW.canvas.place('event', eventId, { what: 'Add ' + ev.title + ' to' })
            .then(function (r) {
              add.disabled = false;
              if (r && r.ok && r.already) add.textContent = 'Already on ' + r.label;
              else if (r && r.ok) add.textContent = 'Added to ' + r.label;
              else if (r && r.queued) add.textContent = 'Saved on this device';
              else add.textContent = was;
              if (r && (r.ok || r.queued)) {
                setTimeout(function () { add.textContent = was; }, 2600);
              }
            });
        });
        page.appendChild(add);
      }

      host.appendChild(page);
      return 1;
    });
  };

  function relRow(rel, name, cid) {
    var a = doc.createElement('a');
    a.className = 'ow-ev__relrow';
    a.href = '#center/' + encodeURIComponent(cid);
    a.innerHTML = '<span class="ow-ev__relw">' + esc(REL_WORDS[rel] || rel) +
      '</span><span class="ow-ev__reln">' + esc(name) + '</span>';
    a.addEventListener('click', function (e) {
      /* STAY INSIDE ONEWAY. Announce the intent; the SHELL owns the surface
         stack and decides what arriving at a Center means. `go()` is the
         destination router and takes no id — routing a Center through it would
         have landed on My Center instead of theirs. */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      try {
        e.preventDefault();
        doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: cid } }));
      } catch (_) {}
    });
    return a;
  }

  var css = [
    '.ow-ev{display:flex;flex-direction:column;gap:10px;max-width:720px}',
    '.ow-ev__kind{font-size:10.5px;font-weight:650;letter-spacing:.24em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-ev__t{font-size:clamp(22px,5vw,28px);font-weight:650;letter-spacing:-.03em;',
    '  line-height:1.05;margin:2px 0 0;color:var(--ow-ink,#f3f2f8)}',
    '.ow-ev__when{font-size:14.5px;font-weight:560;color:var(--ow-ink-2,#9793ad)}',
    '.ow-ev__w{font-size:13.5px;color:var(--ow-ink-3,#6f6b85)}',
    '.ow-ev__cover{width:100%;margin:0 0 14px;border-radius:20px 15px 18px 16px;overflow:hidden;',
    '  background:rgba(255,255,255,.04);box-shadow:0 0 0 1px rgba(var(--ow-h1),.28),0 18px 40px -22px rgba(0,0,0,.8)}',
    '.ow-ev__cover img{display:block;width:100%;height:auto;max-height:42vh;object-fit:cover}',
    '.ow-ev__perf{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.ow-ev__perfw{font-family:var(--ow-font-atmos);font-size:10px;font-weight:600;letter-spacing:.2em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-ev__perfn{font-weight:600;font-size:13px;color:#fff;padding:6px 12px;border:0;cursor:default;',
    '  border-radius:12px 9px 11px 10px;background:rgba(var(--ow-h1),.16);',
    '  box-shadow:inset 0 0 0 1px rgba(var(--ow-h1),.34)}',
    '.ow-ev__join{display:inline-flex;align-self:flex-start;align-items:center;margin-top:10px;font-weight:650;font-size:13.5px;',
    '  color:#fff;text-decoration:none;padding:9px 16px;border-radius:13px 10px 12px 11px;',
    '  background:linear-gradient(150deg,rgba(var(--ow-h1),.7),rgba(var(--ow-h2),.45));',
    '  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 0 26px -8px rgba(var(--ow-h1),.9)}',
    '.ow-ev__acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
    '.ow-ev__count{font-size:13px;color:var(--ow-ink-2,#9793ad);min-height:1.2em}',
    '.ow-ev__state{margin-top:10px;font-size:13.5px;font-weight:560;color:var(--ow-ink-2,#9793ad)}',
    '.ow-ev__state--live{color:var(--ow-ink,#fff)}',
    '.ow-ev__d{font-size:15.5px;line-height:1.55;color:var(--ow-ink,#f3f2f8);',
    '  white-space:pre-wrap;margin:6px 0 0}',
    '.ow-ev__rel{display:flex;flex-direction:column;gap:6px;margin-top:12px}',
    '.ow-ev__relrow{display:flex;gap:8px;align-items:baseline;text-decoration:none;',
    '  background:var(--ow-panel-1,#100e1a);border:1px solid var(--ow-seam,rgba(255,255,255,.09));',
    '  border-radius:12px;padding:10px 13px}',
    '.ow-ev__relw{font-size:10.5px;font-weight:650;letter-spacing:.18em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-ev__reln{font-size:14.5px;font-weight:560;color:var(--ow-ink,#f3f2f8)}',
    '.ow-ev__dist{display:flex;flex-direction:column;gap:6px;margin-top:12px}',
    '.ow-ev__distrow{display:flex;gap:8px;align-items:baseline;text-decoration:none;',
    '  border:1px solid var(--ow-seam,rgba(255,255,255,.09));border-radius:12px;',
    '  padding:9px 13px}',
    '.ow-ev__distw{font-size:10.5px;font-weight:650;letter-spacing:.18em;',
    '  color:var(--ow-ink-3,#6f6b85)}',
    '.ow-ev__distn{font-size:14px;font-weight:560;color:var(--ow-ink,#f3f2f8)}',
    '@media (max-width:560px){.ow-ev__acts .po-act{flex:1 1 auto}}'
  ].join('');
  try {
    var st = doc.createElement('style');
    st.setAttribute('data-ow', 'app-events');
    st.textContent = css;
    doc.head.appendChild(st);
  } catch (_) {}

})(typeof window !== 'undefined' ? window : this);
