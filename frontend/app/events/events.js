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

  var ATTENDEES_SHOWN = 24;          /* names drawn on the event for its organiser; the rest are counted */

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
    /* THE ZONE'S NAME ON THE EVENT'S OWN DAY, not today's: a weekly 8 pm after the clocks change is 8 PM EST, though the
       Center reads EDT this morning (events/series.py keeps the hour; walked 2026-10-20) */
    if (tz.timezone) {
      try {
        var zn = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(t)
          .filter(function (p) { return p.type === 'timeZoneName'; })[0];
        if (zn && zn.value) abbr = zn.value;
      } catch (e) { /* the Center's own word for today stands */ }
    }
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

  /* WHERE AN EVENT WAS OPENED FROM (events/insights.py): the App says each page it walks to (`ow:navigate`), the event's own
     last; the one before it is where the person was. Opened straight at an event (a link, a push, a reload) it is "link". */
  var evNav = { now: '', before: '' };
  document.addEventListener('ow:navigate', function (e) { evNav.before = evNav.now; evNav.now = String(((e && e.detail) || {}).to || ''); });
  function evVia() {
    var v = String(evNav.now === 'Event' ? evNav.before : evNav.now).split(':')[0].toLowerCase();
    return ({ home: 'home', discovery: 'discovery', map: 'map', center: 'center', messaging: 'messaging', messages: 'messaging',
              notifications: 'notifications' })[v] || (v ? 'other' : 'link');
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
      data.get('/api/oneway/events/' + encodeURIComponent(eventId) + '?via=' + evVia(), { fresh: true }),     /* an open, counted for its host */
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
      /* ── ITS DATES (events/series.py): one of a series, each date an event of its own; the next ones open as themselves ── */
      var sr = (er.data && er.data.series) || {};
      if (sr.dates && sr.dates.length > 1) {
        var srBox = mk('div', 'ow-ev__series', '');
        srBox.appendChild(mk('div', 'ow-ev__sr-t', esc(sr.words || 'Repeats')));
        var srRow = mk('div', 'ow-ev__sr-d', '');
        sr.dates.filter(function (d) { return d.state === 'scheduled' || d.state === 'live' || d.id === eventId; }).slice(0, 8).forEach(function (d) {
          var dd = new Date(d.starts_at), word = isNaN(dd.getTime()) ? '' : dd.toLocaleDateString(undefined, (tz && tz.timezone) ? { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz.timezone } : { weekday: 'short', month: 'short', day: 'numeric' });
          var a = mk(d.id === eventId ? 'span' : 'a', 'ow-ev__sr-c' + (d.id === eventId ? ' is-here' : ''), esc(word));
          if (d.id !== eventId) a.setAttribute('href', '#event/' + encodeURIComponent(d.id)); else a.setAttribute('aria-current', 'true');
          srRow.appendChild(a);
        });
        srBox.appendChild(srRow);
        page.appendChild(srBox);
      }
      /* ── FROM THE HOST (events/news.py): what the guests were told, the newest first; read by whoever said going or maybe ── */
      var news = (er.data && er.data.news) || [];
      if (news.length) {
        var nb = mk('div', 'ow-ev__news', '');
        nb.appendChild(mk('div', 'ow-ev__sr-t', 'From the host'));
        news.slice(0, 5).forEach(function (x) {
          var it = mk('div', 'ow-ev__note' + (x.kind === 'change' ? ' is-change' : ''), ''), at = new Date(x.at), o = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
          if (tz && tz.timezone) o.timeZone = tz.timezone;
          it.appendChild(mk('p', 'ow-ev__note-t', esc(x.text)));
          if (!isNaN(at.getTime())) { try { it.appendChild(mk('span', 'ow-ev__note-at', esc(at.toLocaleString(undefined, o)))); } catch (e) { /* no date said */ } }
          nb.appendChild(it);
        });
        page.appendChild(nb);
      }
      /* ── THE DRAWING THIS EVENT HOLDS (systems/casino/drawings.py): what is won, when entries open and close, the person's own
         entries and one free entry a day; once drawn, the winners by first name and how they were picked; the official rules ── */
      var dw = (er.data && er.data.drawing) || {};
      if (dw.state) {
        var dwBox = mk('div', 'ow-ev__drawing', ''), dwWhen = function (iso) {
          var t = new Date(iso), o = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
          if (tz && tz.timezone) o.timeZone = tz.timezone;
          try { return isNaN(t.getTime()) ? '' : t.toLocaleString(undefined, o); } catch (e) { return ''; }
        };
        dwBox.setAttribute('data-drawing', dw.state);
        dwBox.appendChild(mk('div', 'ow-ev__sr-t', 'Drawing'));
        var dwPr = mk('div', 'ow-ev__sr-d', '');
        (dw.prizes || []).forEach(function (p) { dwPr.appendChild(mk('span', 'ow-ev__sr-c', esc(p.name + (p.count > 1 ? ' × ' + p.count : '')))); });
        dwBox.appendChild(dwPr);
        var dwSaid = mk('p', 'ow-ev__said', '');
        dwSaid.setAttribute('data-drawing-said', '');
        dwSaid.textContent = ({ coming: 'Entries open ' + dwWhen(dw.opens_at) + '.', open: 'Entries close ' + dwWhen(dw.closes_at) + '. One free entry a day.',
          closed: 'Entries are closed. The winners are drawn soon.', drawn: 'The winners are drawn.' })[dw.state] || '';
        dwBox.appendChild(dwSaid);
        var tiers = Object.keys(dw.multipliers || {});
        if (tiers.length && (dw.state === 'open' || dw.state === 'coming')) {
          dwBox.appendChild(mk('p', 'ow-ev__note-at', esc('Rewards members: ' + tiers.map(function (t) {
            return t.charAt(0).toUpperCase() + t.slice(1) + ' counts ' + dw.multipliers[t] + ' entries a day'; }).join(', ') + '.')));
        }
        var dwMine = mk('p', 'ow-ev__said', '');
        dwMine.setAttribute('data-drawing-mine', '');
        var paintMine = function (n) { dwMine.textContent = n ? 'You have ' + n + (n === 1 ? ' entry.' : ' entries.') : ''; };
        paintMine(dw.mine || 0);
        dwBox.appendChild(dwMine);
        if (dw.state === 'open') {
          var may = dw.may || {};
          if (signedIn() && may.may === false && may.why) {
            dwBox.appendChild(mk('p', 'ow-ev__note-at', esc(may.why.charAt(0).toUpperCase() + may.why.slice(1) + '.')));
          } else {
            var dwB = mk('button', 'po-act', signedIn() ? 'Enter today' : 'Sign in to enter');
            dwB.type = 'button'; dwB.setAttribute('data-drawing-enter', ''); dwB.setAttribute('data-act', 'on');
            dwB.addEventListener('click', function () {
              if (!signedIn()) { if (global.go) global.go('home'); return; }
              dwB.disabled = true;
              data.post('/api/oneway/events/' + encodeURIComponent(eventId) + '/drawing/enter', {}).then(function (r) {
                if (r && r.ok && r.data) {
                  dwSaid.textContent = r.data.words || dwSaid.textContent; paintMine(r.data.entries || 0);
                  dwB.textContent = 'Entered today'; return;
                }
                dwB.disabled = false;
                if (global.OW && OW.toast) OW.toast((r && r.error) || 'You were not entered. Try again.');
              });
            });
            dwBox.appendChild(dwB);
          }
        }
        if ((dw.winners || []).length) {
          var wl = mk('ol', 'ow-ev__winners', '');
          dw.winners.forEach(function (w) {
            var li = mk('li', w.state === 'won' ? '' : 'is-passed', esc(w.prize + ': ' + w.name + (w.state === 'won' ? '' : ' (passed over)')));
            wl.appendChild(li);
          });
          dwBox.appendChild(wl);
          var pf = dw.proof || {};
          if (pf.seed) {
            var how = mk('details', 'ow-ev__rules', '');
            how.appendChild(mk('summary', '', 'How the winners were picked'));
            how.appendChild(mk('p', 'ow-ev__note-at', esc(pf.entries + ' entries by ' + pf.people + (pf.people === 1 ? ' person' : ' people') + ', one win each')));
            [['Fingerprint', pf.list_hash], ['Seed', pf.seed], ['Drawn again with', (pf.redraws || []).map(function (x) { return x.seed; }).join(', ')]].forEach(function (f) {
              if (f[1]) how.appendChild(mk('p', 'ow-ev__note-at', esc(f[0] + ': ' + f[1])));
            });
            dwBox.appendChild(how);
          }
        }
        var rules = mk('details', 'ow-ev__rules', '');
        rules.appendChild(mk('summary', '', 'Official rules'));
        rules.appendChild(mk('p', 'ow-ev__note-t', esc(dw.rules || '')));
        rules.appendChild(mk('p', 'ow-ev__note-at', 'No purchase necessary.'));
        dwBox.appendChild(rules);
        page.appendChild(dwBox);
      }
      /* ── THE RECAP AND THE PHOTOS FROM THE NIGHT (events/recap.py): the host's recap first; then the album, which whoever
         went adds to once it is on, each under a first name; a person takes back their own ── */
      var evPhoto = function (p, cap) {
        var f = mk('figure', 'ow-ev__ph', ''), img = document.createElement('img');
        img.loading = 'lazy'; img.alt = cap ? 'A photo ' + cap : 'A photo from the event'; img.src = p.url;
        if (p.width && p.height) { img.width = p.width; img.height = p.height; }
        f.appendChild(img);
        if (cap) f.appendChild(mk('figcaption', 'ow-ev__ph-by', esc(cap)));
        return f;
      };
      var rcp = (er.data && er.data.recap) || {}, alb = (er.data && er.data.album) || {};
      if (rcp.text || (rcp.photos || []).length) {
        var rb = mk('div', 'ow-ev__recap', ''), rg = mk('div', 'ow-ev__grid', '');
        rb.appendChild(mk('div', 'ow-ev__sr-t', 'The recap'));
        if (rcp.text) rb.appendChild(mk('p', 'ow-ev__note-t', esc(rcp.text)));
        (rcp.photos || []).forEach(function (p) { rg.appendChild(evPhoto(p)); });
        rb.appendChild(rg);
        page.appendChild(rb);
      }
      var photos = (alb.photos || []).slice();
      if (photos.length || alb.may_add) {
        var ab = mk('div', 'ow-ev__album', ''), ah = mk('div', 'ow-ev__sr-t', ''), ag = mk('div', 'ow-ev__grid', '');
        ab.appendChild(ah); ab.appendChild(ag);
        var paintAlbum = function () {
          ah.textContent = 'Photos' + (photos.length ? ' \u00b7 ' + photos.length : '');
          ag.innerHTML = '';
          photos.forEach(function (p) {
            var f = evPhoto(p, 'by ' + p.by);
            if (p.may_remove) {
              var x = mk('button', 'ow-ev__ph-x', 'Remove');
              x.type = 'button'; x.setAttribute('aria-label', 'Remove this photo');
              x.addEventListener('click', function () {
                x.disabled = true;
                data.del('/api/oneway/events/' + encodeURIComponent(eventId) + '/photos/' + encodeURIComponent(p.id)).then(function (r) {
                  if (r && r.ok) { photos = photos.filter(function (q) { return q.id !== p.id; }); paintAlbum(); return; }
                  x.disabled = false;
                  if (global.OW && OW.toast) OW.toast((r && r.error) || 'That did not change. Try again.');
                });
              });
              f.appendChild(x);
            }
            ag.appendChild(f);
          });
        };
        paintAlbum();
        if (alb.may_add) {
          var pick = document.createElement('input'), addB = mk('button', 'po-act', 'Add your photos'), said = mk('p', 'ow-ev__note-at', esc('Everyone who can see this event sees them.'));
          pick.type = 'file'; pick.accept = 'image/*'; pick.multiple = true; pick.hidden = true; pick.className = 'ow-ev__pick';
          addB.type = 'button'; addB.setAttribute('data-act', 'on'); addB.setAttribute('data-photos', 'add');
          addB.addEventListener('click', function () { pick.click(); });
          pick.addEventListener('change', function () {
            var files = [].slice.call(pick.files || []).slice(0, 10), n = 0, err = '', chain = Promise.resolve();
            if (!files.length) return;
            addB.disabled = true; said.textContent = 'Adding ' + files.length + (files.length === 1 ? ' photo\u2026' : ' photos\u2026');
            files.forEach(function (file) {
              chain = chain.then(function () {
                return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(file); });
              }).then(function (src) {
                return src ? data.post('/api/oneway/media', { data: src, origin: 'uploaded' }) : null;
              }).then(function (m) {
                if (!m || !m.ok || !m.data || !m.data.media) { err = (m && m.error) || err; return null; }
                return data.post('/api/oneway/events/' + encodeURIComponent(eventId) + '/photos', { media: m.data.media });
              }).then(function (r) {
                if (r && r.ok && r.data && r.data.photo) { photos.unshift(r.data.photo); n++; } else if (r) err = r.error || err;
              });
            });
            chain.then(function () {
              addB.disabled = false; pick.value = '';
              said.textContent = n ? (n === 1 ? 'Added to the album.' : n + ' photos added to the album.') : (err || 'Those photos could not be added.');
              paintAlbum();
            });
          });
          ab.appendChild(addB); ab.appendChild(pick); ab.appendChild(said);
        }
        page.appendChild(ab);
      }

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
      /* ── ITS WAITLIST (events/waitlist.py): full, a person waits in order and is told when a place opens ── */
      var left = (er.data && er.data.places_left != null) ? er.data.places_left : null;
      var waitAt = ((er.data && er.data.waitlist) || {}).position || 0;
      var waitBox = mk('div', 'ow-ev__wait', '');
      function nth(n) { return n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
      function paintWait() {
        waitBox.innerHTML = '';
        if (asksAnything()) return;                      /* a sign-up form says it in its own words */
        var full = left === 0 && String(mine || '') !== 'going';
        if (!full && !waitAt) return;
        waitBox.appendChild(mk('p', 'ow-ev__said', esc(waitAt ? 'You\u2019re ' + nth(waitAt) + ' on the waitlist: you are told when a place opens.' : 'This event is full.')));
        var b = mk('button', 'po-act', waitAt ? 'Leave the waitlist' : 'Join the waitlist');
        b.type = 'button'; b.setAttribute('data-wait', waitAt ? 'leave' : 'join'); if (!waitAt) b.setAttribute('data-act', 'on');
        b.addEventListener('click', function () {
          if (!signedIn()) { if (global.go) global.go('home'); return; }
          b.disabled = true;
          var url = '/api/oneway/events/' + encodeURIComponent(eventId) + '/waitlist';
          (waitAt ? data.del(url) : data.post(url, {})).then(function (r) {
            b.disabled = false;
            if (r && r.ok) { waitAt = (r.data && r.data.position) || 0; paintWait(); return; }
            if (global.OW && OW.toast) OW.toast((r && r.error) || 'That did not change. Try again.');
          });
        });
        waitBox.appendChild(b);
      }
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
            + (att.maybe ? ' \u00b7 ' + att.maybe + ' maybe' : '')
            /* ITS ROOM (rsvp.places_left: seats, a person and the guests they bring): said only when the host set one */
            + (left != null ? ' \u00b7 ' + (left ? left + (left === 1 ? ' place left' : ' places left') : 'full') : '');
          paintWait();
        }
      }

      /* A TICKETED EVENT IS GONE TO WITH A TICKET (events/rsvp.door; the review of 2026-10-20): no free Going is offered; a ticket
         holder is Going already and their tickets are refunded by the Center, not answered away */
      var ticketed = !!(er.data && er.data.ticketed), holds = ((er.data && er.data.my_tickets) || []).length > 0;
      var tkSaid = (ticketed && !holds) ? mk('p', 'ow-ev__said', esc('Going takes a ticket: buy one below.')) : null;
      CHOICES.filter(function (c) { return !ticketed || (holds ? c.v === 'going' : c.v !== 'going'); }).forEach(function (c) {
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
                if (r.data.places_left !== undefined) left = r.data.places_left;
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
                /* and the answer is put back, with the words, if the server refuses it later (PLAN G6); when it lands the count is the server's */
                if (global.OW && OW.outbox) OW.outbox.watch(r.pending_id,
                  function (d) {
                    var j = (d && d.result) || {};
                    paint(j.answer || c.v, j.counts && j.counts.going, j.counts && j.counts.maybe);
                  },
                  function (words) {
                    paint(prev, null);
                    count.textContent = prevCount;
                    if (OW.toast) OW.toast('Your answer did not change. ' + words);
                  });
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
      /* ── ITS SIGN-UP FORM (events/registration.py, on the one Forms engine): the host's questions, the guests a person
         may bring, and whether the host lets each person in. Drawn instead of Going / Maybe when the event asks anything;
         sent, the person is Going at once or waits for the host, and the page says which in the server's own words. ── */
      var reg = (er.data && er.data.registration) || {}, regd = (er.data && er.data.registered) || {};
      /* at an event that sells its places, Going is a ticket: the form stays only for who signed up before (their answers stand) */
      var asks = !!((reg.questions || []).length || reg.approval || reg.plus_ones_max) && !((er.data && er.data.ticketed) && !regd.state);
      function asksAnything() { return asks; }
      function signup() {
        var box = mk('form', 'ow-ev__signup', ''), said = mk('p', 'ow-ev__said', '');
        box.setAttribute('novalidate', '');
        var paintSaid = function () {
          said.textContent = regd.state ? (regd.words + (regd.state === 'in' && regd.plus_ones ? ', with ' + regd.plus_ones + (regd.plus_ones === 1 ? ' guest' : ' guests') : '') + '.') : '';
        };
        paintSaid();
        if (regd.state === 'declined') { box.appendChild(said); return box; }
        (reg.questions || []).forEach(function (q) {
          var lab = mk('label', 'ow-ev__q', ''), sp = document.createElement('span'), inp;
          sp.textContent = q.label + (q.required ? '' : ' (if you like)');
          if (q.form === 'long') inp = document.createElement('textarea');
          else if (q.form === 'choice' || q.form === 'yesno') {
            inp = document.createElement('select');
            [''].concat(q.form === 'yesno' ? ['yes', 'no'] : (q.options || [])).forEach(function (o) {
              var op = document.createElement('option'); op.value = o;
              op.textContent = o ? (q.form === 'yesno' ? (o === 'yes' ? 'Yes' : 'No') : o) : 'Choose'; inp.appendChild(op);
            });
          } else { inp = document.createElement('input'); inp.type = { number: 'number', date: 'date' }[q.form] || 'text'; }
          inp.name = q.key; inp.className = 'ow-ev__in';
          if ((regd.answers || {})[q.key] != null) inp.value = regd.answers[q.key];
          lab.appendChild(sp); lab.appendChild(inp); box.appendChild(lab);
        });
        if (reg.plus_ones_max) {
          var pl = mk('label', 'ow-ev__q', ''), ps = document.createElement('span'), sel = document.createElement('select');
          ps.textContent = 'Guests you bring'; sel.name = '_plus'; sel.className = 'ow-ev__in';
          for (var i = 0; i <= reg.plus_ones_max; i++) {
            var op = document.createElement('option'); op.value = String(i); op.textContent = i ? String(i) : 'Just me';
            if ((regd.plus_ones || 0) === i) op.selected = true; sel.appendChild(op);
          }
          pl.appendChild(ps); pl.appendChild(sel); box.appendChild(pl);
        }
        var send = mk('button', 'po-act', esc(regd.state ? 'Change my answers' : (reg.approval ? 'Ask to come' : 'Sign up')));
        send.type = 'submit'; send.setAttribute('data-act', 'on'); box.appendChild(send); box.appendChild(said);   /* drawn as a chosen answer is */
        box.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!signedIn()) { if (global.go) global.go('home'); return; }
          var answers = {}, plus = 0;
          Array.prototype.forEach.call(box.elements, function (x) {
            if (!x.name) return;
            if (x.name === '_plus') plus = parseInt(x.value, 10) || 0; else answers[x.name] = x.value;
          });
          send.disabled = true; said.textContent = 'Sending\u2026';
          data.post('/api/oneway/events/' + encodeURIComponent(eventId) + '/register', { answers: answers, plus_ones: plus },
                    { invalidate: '/api/oneway/events/' })
            .then(function (r) {
              send.disabled = false;
              if (r && r.ok) { regd = (r.data && r.data.registered) || {}; paintSaid(); send.textContent = 'Change my answers'; return; }
              said.textContent = (r && r.error) || 'It was not sent. Try again.';
            });
        });
        return box;
      }
      var state = String(ev.state || '').toLowerCase();
      if (state === 'ended') {
        var went = (att.going != null) ? att.going : null;
        page.appendChild(mk('div', 'ow-ev__state',
          'This event has ended' + (went ? (' \u00b7 ' + went + (went === 1 ? ' person went' : ' people went')) : '') + '.'));
      } else if (state === 'cancelled') {
        page.appendChild(mk('div', 'ow-ev__state', 'This event was cancelled.'));
      } else {
        if (state === 'live') page.appendChild(mk('div', 'ow-ev__state ow-ev__state--live', 'Happening now.'));
        if (!asks && tkSaid) page.appendChild(tkSaid);          /* said above the answers, never in their row */
        page.appendChild(asks ? signup() : acts);
        page.appendChild(count);
        page.appendChild(waitBox);
        /* ── TICKETS, PAID ON ONEWAY (PLAN §5.0 unit 1; founder/744) ─────────────────────────────────────────────
           An event that states its ticket price is sold on the Center's own Stripe: what is for sale, its price and
           how many one order takes are the server's (payments/payable), asked only for an event that has a price.
           Buy goes to Stripe's page in this tab; paid, Stripe brings the person back to the Center with the toast,
           and a signed-in buyer is answered Going by the event itself. */
        if (ev.ticket_price && ev.center_id) {
          var tk = mk('div', 'ow-ev__acts', '');
          page.appendChild(tk);
          data.get('/api/oneway/places/' + encodeURIComponent(ev.center_id) + '/pay/event_ticket/' + encodeURIComponent(eventId), { fresh: true }).then(function (pr) {
            var o = pr && pr.ok && pr.data;
            if (!o || !o.pays_here) { if (pr && !pr.ok && pr.status === 409 && pr.error) tk.appendChild(mk('div', 'ow-ev__state', esc(pr.error))); return; }
            var n = 1, most = Math.max(1, o.quantity_max || 1);
            var less = mk('button', 'po-act', '\u2212'), more = mk('button', 'po-act', '+'), howMany = mk('span', 'ow-ev__count', '1 ticket');
            var buy = mk('button', 'po-act', esc('Buy tickets \u00b7 ' + o.price));
            [less, more, buy].forEach(function (x) { x.type = 'button'; });
            less.setAttribute('aria-label', 'One ticket fewer'); more.setAttribute('aria-label', 'One ticket more');
            buy.setAttribute('data-act', 'on');
            var said = function () { howMany.textContent = n + (n === 1 ? ' ticket' : ' tickets'); less.disabled = n <= 1; more.disabled = n >= most; };
            less.addEventListener('click', function () { if (n > 1) { n--; said(); } });
            more.addEventListener('click', function () { if (n < most) { n++; said(); } });
            buy.addEventListener('click', function () {
              buy.disabled = true;
              data.post('/api/oneway/places/' + encodeURIComponent(ev.center_id) + '/pay', { kind: 'event_ticket', ref: eventId, quantity: n }).then(function (r) {
                var url = r && r.ok && r.data && r.data.url;
                if (url && /^https?:\/\//i.test(url)) { global.location.assign(url); return; }
                buy.disabled = false;
                if (global.OW && OW.toast) OW.toast((r && r.error) || 'The checkout did not open. Nothing was charged.');
              });
            });
            if (most > 1) { tk.appendChild(less); tk.appendChild(howMany); tk.appendChild(more); }
            tk.appendChild(buy);
            said();
          });
        }
        /* ── ITS TICKET TYPES (events/ticket_types.py): each a product of the Center tied to this event, bought through the
           one checkout (kind product) on the Center's own Stripe; paid, the seats are the buyer's, one code each. What is
           on sale, its price and what is left are the server's own words. ── */
        var types = (er.data && er.data.ticket_types) || [];
        if (types.length && ev.center_id) {
          var tt = mk('div', 'ow-ev__types', '');
          types.forEach(function (t) {
            var rowEl = mk('div', 'ow-ev__type', '');
            rowEl.appendChild(mk('div', 'ow-ev__typeinfo', '<b>' + esc(t.name) + '</b><span>' + esc([t.price ? t.price + ' ' + String(t.currency || '').toUpperCase() : '',
              t.left != null && t.left > 0 ? t.left + ' left' : ''].filter(Boolean).join(' \u00b7 ')) + '</span>'));
            if (!t.on_sale) {
              var why = String(t.why_not || 'not on sale');
              rowEl.appendChild(mk('span', 'ow-ev__typeoff', esc(why.charAt(0).toUpperCase() + why.slice(1))));
              tt.appendChild(rowEl); return;
            }
            var most = Math.max(1, Math.min(10, t.left == null ? 10 : t.left));
            var sel = document.createElement('select'); sel.className = 'ow-ev__in ow-ev__qty';
            sel.setAttribute('aria-label', 'How many ' + t.name + ' tickets');
            for (var i = 1; i <= most; i++) { var op = document.createElement('option'); op.value = String(i); op.textContent = String(i); sel.appendChild(op); }
            var buy = mk('button', 'po-act', 'Buy'); buy.type = 'button'; buy.setAttribute('data-act', 'on'); buy.setAttribute('data-ticket-type', t.id);
            buy.addEventListener('click', function () {
              if (!signedIn()) { if (global.go) global.go('home'); return; }
              buy.disabled = true;
              data.post('/api/oneway/places/' + encodeURIComponent(ev.center_id) + '/pay', { kind: 'product', ref: t.id, quantity: parseInt(sel.value, 10) || 1 }).then(function (r) {
                var url = r && r.ok && r.data && r.data.url;
                if (url && /^https?:\/\//i.test(url)) { global.location.assign(url); return; }
                buy.disabled = false;
                if (global.OW && OW.toast) OW.toast((r && r.error) || 'The checkout did not open. Nothing was charged.');
              });
            });
            rowEl.appendChild(sel); rowEl.appendChild(buy); tt.appendChild(rowEl);
          });
          page.appendChild(tt);
        }
      }
      /* ── THE TICKETS THIS PERSON HOLDS FOR IT (events/tickets: theirs alone), one code a seat: what the door reads ── */
      var held = (er.data && er.data.my_tickets) || [], pass = (er.data && er.data.my_pass) || {};
      /* the QR is the server's own drawing of the code (events/scan.qr: squares only), shown for the door to scan */
      if (held.length || pass.code) {
        var hb = mk('div', 'ow-ev__held', '<b>' + (held.length ? 'Your tickets' : 'Your pass') + '</b>');
        held.forEach(function (h) {
          (h.codes || []).forEach(function (code, i) {
            hb.appendChild(mk('div', 'ow-ev__code', '<span class="ow-ev__qr">' + ((h.qr || [])[i] || '') + '</span><span>' + esc(h.type) + '</span><code>' + esc(code) + '</code>'));
          });
        });
        if (pass.code) hb.appendChild(mk('div', 'ow-ev__code', '<span class="ow-ev__qr">' + (pass.qr || '') + '</span><span>Show this at the door</span><code>' + esc(pass.code) + '</code>'));
        page.appendChild(hb);
      }
      /* THE VIEWER'S OWN ANSWER IS NOT ON A SESSIONLESS READ, and it is not
         invented. Nothing is shown as selected until they choose, which is
         honest for a first tap and self-corrects the instant they do. Claiming
         "not going" for somebody who has not answered would be a fact the
         platform does not have. */
      paint(mine, (att.going != null) ? att.going : null);

      /* ── WHO IS COMING, FOR THE PEOPLE WHO RUN IT (PLAN B2, the content loop's observe step) ──────────
         The roster is the organiser's read and only theirs: the event read says whether this person organises it, and
         /attendees refuses everyone else. Each by the name they go by (an address never leaves the server), drawn as
         the line-up is. A guest sees the count above and nothing more. */
      if (er.data && er.data.organiser === true) {
        var whoBox = mk('div', 'ow-ev__perf');
        page.appendChild(whoBox);
        data.get('/api/oneway/events/' + encodeURIComponent(eventId) + '/attendees', { fresh: true }).then(function (ar) {
          if (!ar || !ar.ok || !ar.data) return;              /* not this person's to read: nothing drawn */
          var list = ar.data.attendees || [];
          whoBox.appendChild(mk('span', 'ow-ev__perfw', 'Who is coming'));
          if (!list.length) { whoBox.appendChild(mk('span', 'ow-ev__perfn', 'Nobody has said yet')); return; }
          list.slice(0, ATTENDEES_SHOWN).forEach(function (a) { whoBox.appendChild(mk('span', 'ow-ev__perfn', esc(a.who || 'A guest'))); });
          var rest = (ar.data.count || list.length) - Math.min(list.length, ATTENDEES_SHOWN);
          if (rest > 0) whoBox.appendChild(mk('span', 'ow-ev__perfn', esc('and ' + rest + ' more')));
        });
      }

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
    '.ow-ev__series{margin:10px 0 2px}.ow-ev__sr-t{font-size:13px;font-weight:600;color:var(--ow-ink-2,#9793ad);margin-bottom:6px}',
    '.ow-ev__sr-d{display:flex;flex-wrap:wrap;gap:6px}.ow-ev__sr-c{font-size:13px;padding:5px 10px;border-radius:999px;border:1px solid var(--ow-line,rgba(255,255,255,.14));color:inherit;text-decoration:none}',
    '.ow-ev__sr-c.is-here{border-color:currentColor;font-weight:600}',
    '.ow-ev__recap,.ow-ev__album{margin:16px 0 4px}.ow-ev__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0 8px}',
    '@media (min-width:700px){.ow-ev__grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
    '.ow-ev__ph{position:relative;margin:0;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.06);aspect-ratio:1/1}.ow-ev__ph img{width:100%;height:100%;object-fit:cover;display:block}',
    '.ow-ev__ph-by{position:absolute;left:6px;bottom:5px;font-size:11px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)}',
    '.ow-ev__ph-x{position:absolute;top:4px;right:4px;font-size:11px;padding:3px 8px;border-radius:999px;border:0;background:rgba(0,0,0,.6);color:#fff}',
    '.ow-ev__news{margin:14px 0 4px;display:grid;gap:8px}.ow-ev__note{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--ow-line,rgba(255,255,255,.12))}',
    '.ow-ev__note.is-change{border-style:dashed}.ow-ev__note-t{margin:0 0 4px;font-size:14.5px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}.ow-ev__note-at{font-size:12px;color:var(--ow-ink-2,#9793ad)}',
    '.ow-ev__drawing{margin:14px 0 4px;display:grid;gap:8px;padding:12px 14px;border-radius:14px;border:1px solid var(--ow-line,rgba(255,255,255,.12))}',
    '.ow-ev__drawing .po-act{justify-self:start;border:1px solid currentColor;border-radius:999px;padding:10px 20px;font-weight:600}',
    '.ow-ev__winners{margin:0;padding-left:20px;display:grid;gap:4px;font-size:14.5px}.ow-ev__winners .is-passed{opacity:.6;text-decoration:line-through}',
    '.ow-ev__rules summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--ow-ink-2,#9793ad)}.ow-ev__rules p{margin:6px 0 0;overflow-wrap:anywhere}',
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
    '.ow-ev__signup{display:grid;gap:10px;margin-top:10px;max-width:520px}',
    '.ow-ev__q{display:grid;gap:4px;font-size:14px}',
    '.ow-ev__in{font:inherit;padding:10px 12px;border:1px solid currentColor;border-radius:10px;background:transparent;color:inherit;width:100%;box-sizing:border-box}',
    'textarea.ow-ev__in{min-height:88px}',
    '.ow-ev__signup .po-act{justify-self:start;border:1px solid currentColor;border-radius:999px;padding:10px 20px;font-weight:600}',
    '.ow-ev__said{margin:0;font-size:14px;min-height:1.2em}',
    '.ow-ev__types{display:grid;gap:8px;margin-top:14px;max-width:560px}',
    '.ow-ev__type{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:14px}',
    '.ow-ev__typeinfo{display:flex;flex-direction:column;min-width:0}',
    '.ow-ev__typeinfo span{font-size:13px;opacity:.75}',
    '.ow-ev__typeoff{font-size:13px;opacity:.75;grid-column:2 / -1}',
    '.ow-ev__qty{width:auto;padding:8px 10px}',
    '.ow-ev__held{display:grid;gap:6px;margin-top:14px;max-width:560px}',
    '.ow-ev__code{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:1px dashed color-mix(in srgb,currentColor 40%,transparent);border-radius:12px}',
    '.ow-ev__code code{font-family:ui-monospace,Menlo,monospace;font-size:16px;letter-spacing:.08em}',
    '.ow-ev__qr{display:block;width:96px;height:96px;flex:0 0 96px;background:#fff;border-radius:8px;padding:4px;box-sizing:border-box}',
    '.ow-ev__qr svg{display:block;width:100%;height:100%}',
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
