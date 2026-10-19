/* A CENTER'S PAGE: OW.live.center and its bookings.
   Moved whole from frontend/app/popit-live.js by tools/boot_split.mjs (the boot split, PLAN §2 App boot row):
   oneway-app.html loads it with OW.need('center') when its screen first opens; index.html loads it by tag. */
(function (global) {
  'use strict';
  var OW = global.OW;
  var _u = OW._u;
  var assetUrl = _u.assetUrl,
      bumpStat = _u.bumpStat,
      data = _u.data,
      doc = _u.doc,
      esc = _u.esc,
      factList = _u.factList,
      hueOf = _u.hueOf,
      loading = _u.loading,
      mk = _u.mk,
      nothing = _u.nothing,
      openCenterPopit = _u.openCenterPopit,
      openEventScreen = _u.openEventScreen,
      profileShell = _u.profileShell,
      realCategory = _u.realCategory,
      refused = _u.refused,
      sentence = _u.sentence,
      signedIn = _u.signedIn;


  /* ── THE STRIP FOLLOWS ITS SECTIONS (the OS's cold walk, 2026-10-17, item 10: the OS's Sections listed Main and About
     while the page had no About tab, two ideas of "tabs" at once; web's ruling: the strip reads its Sections, and a
     Section with no tab is not listed). When the Center has arranged its Sections (the app read's `sections`, as this
     viewer may see them), each tab that IS a Section takes its Section's word and its place in their order, and is not
     shown when it is not among them; every other tab (its website's pages, Photos, Story) keeps its own place. A Section
     no tab draws (a hero, a custom block) is not a tab, so the strip does not list it. Held by api/test_center_sections.py. */
  var SECTION_TAB = { main: 'main', about: 'about', events: 'today', spaces: 'book', community: 'people', discovery: 'nearby', opportunities: 'opportunities' };
  function sectionedStrip(tabs, secs) {
    if (!Array.isArray(secs) || !secs.length || !Array.isArray(tabs)) return tabs;
    var byTab = {}, owned = {};
    Object.keys(SECTION_TAB).forEach(function (k) { owned[SECTION_TAB[k]] = true; });
    secs.forEach(function (x) { var t = x && SECTION_TAB[x.kind]; if (t && !byTab[t]) byTab[t] = x; });
    var kept = tabs.filter(function (t) { return !(t && owned[t.id]) || byTab[t.id]; });
    var slots = [], mine = [];
    kept.forEach(function (t, i) { if (t && byTab[t.id]) { slots.push(i); mine.push(t); } });
    mine.sort(function (a, b) { return byTab[a.id].order - byTab[b.id].order; });
    mine.forEach(function (t, j) {
      var x = byTab[t.id];
      if (x.label && x.label !== t.label) { t = Object.assign({}, t, { label: x.label }); }
      kept[slots[j]] = t;
    });
    return kept;
  }
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
      /* ── ITS DEPOSIT, PAID ON ONEWAY (PLAN §5.0 unit 1; the hotel canon's money/deposits) ─────────────────────────
         What the house asks of this stay, less what was taken, is the server's (payments/payable, kind stay_deposit),
         offered only to the stay's own guest and only while something is owed; paid on the Center's own Stripe, the
         hotel records it taken from Stripe's signed event. Nothing is drawn when nothing is owed. */
      if (!/cancelled|no_show|checked_out/i.test(b.status || '')) {
        var payBox = mk('div', 'ow-bk__row');
        wrap.appendChild(payBox);
        data.get('/api/oneway/places/' + encodeURIComponent(centerId) + '/pay/stay_deposit/' + encodeURIComponent(id), { fresh: true }).then(function (pr) {
          var o = pr && pr.ok && pr.data;
          if (!o || !o.pays_here) return;
          var pay = mk('button', 'po-act', esc('Pay the deposit \u00b7 ' + o.price));
          pay.type = 'button';
          pay.addEventListener('click', function () {
            pay.disabled = true;
            data.post('/api/oneway/places/' + encodeURIComponent(centerId) + '/pay', { kind: 'stay_deposit', ref: id, quantity: 1 }).then(function (r) {
              var url = r && r.ok && r.data && r.data.url;
              if (url && /^https?:\/\//i.test(url)) { global.location.assign(url); return; }
              pay.disabled = false;
              why.textContent = (r && r.error) || 'The checkout did not open. Nothing was charged.';
            });
          });
          payBox.appendChild(pay);
        });
      }
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
      /* A CENTER THAT WEARS A DESIGN WEARS ITS BRAND HERE TOO (founder, 2026-10-12: "focus on having the branding match
         the site"): the world takes its light from the logo's own colours (the first and last of its wordmark's
         gradient, else its ink and accent), and its cut mark is its face until it chooses a picture of its own. */
      var _brand = (function (st) {
        var pres = (st && st.design && st.presentation) || null;
        if (!pres) return null;
        var rgb = function (v) { var m = /^#([0-9a-f]{6})/i.exec(String(v || '').trim()); if (!m) return ''; var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255].join(','); };
        var g = ((pres.brand || {}).look || {}).wordmark_gradient || [], t = pres.tokens || {};
        var a1 = rgb(g[0]) || rgb(t['ink-1']), a2 = rgb(g[g.length - 1]) || rgb(t.accent) || a1;
        return { pair: a1 ? { h1: a1, h2: a2 } : null, mark: pres.logo_mark_image || '' };
      })(_cnA.site);
      var hue = (_brand && _brand.pair) || hueOf(head) || hueOf(_cnA.identity) || null;
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
        /* THE CENTER'S OWN RUNG, SAID ON THE PRESS (walked 2026-10-18: set to Nobody, the button still opened the line and
           the message went through). The composed read carries messaging/inbound's answer for this person; a refusal is
           its words, once, beside the button, and nothing is opened. Its people always reach it. */
        var rm = (part.reach || {}).messaging;
        if (rm && rm.allowed === false && !(part.viewer || {}).operates) {
          var said0 = acts.querySelector('.po-act__why--reach') || mk('p', 'po-act__why po-act__why--reach', '');
          var w0 = String(rm.why || 'this Center is not taking messages');
          said0.textContent = w0.charAt(0).toUpperCase() + w0.slice(1) + '.';
          if (!said0.parentNode) acts.appendChild(said0);
          return;
        }
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
      /* FOLLOWERS LEAD, MEMBERS SIT BESIDE THEM (founder, 2026-10-15): the count row reads like every social
         profile's ("N followers"), so a Center's followers come first and always show, even at 0, and its
         members are the next count in the SAME row rather than a line of their own under the name. */
      stats.push([_followers || 0, _followers === 1 ? 'follower' : 'followers', 'followers']);
      if (_members) stats.push([_members, _members === 1 ? 'member' : 'members', 'members']);
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

        /* ── THE SHOP (commerce SHOP-2) ───────────────────────────────────────
           The founder, 2026-10-10: tonight a Center sells in the App. Its live products, each the page's own thing
           row (its picture, its name, its price); pressing one opens it, and Buy there opens the Center's own
           checkout. The first SHOP_FIRST, then "Show N more" pages in place (S9: one press away). A Center selling
           nothing has no Shop (S18). Asked beside the article, so the section can take its place in the order. */
        var SHOP_FIRST = 6;
        var shop = { rows: [], total: 0, next: '', asked: false };
        var shopP = data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/products?limit=' + SHOP_FIRST)
          .then(function (r) {
            var d = (r && r.ok && r.data) || {};
            shop.rows = d.products || []; shop.total = d.total || shop.rows.length; shop.next = d.next || '';
          }).catch(function () {}).then(function () { shop.asked = true; if (drawn) drawShop(); });
        function shopRow(p) {
          var line = OW.priceWords(p) + (p.available === false ? ' · Sold out' : '');
          var pic = (p.pictures && p.pictures[0] && p.pictures[0].url) || '';
          var row = thingRow(p.name, line, pic, function (e) { OW.openProduct(p, e.currentTarget); });
          row.setAttribute('data-po-product', p.id);
          return row;
        }
        function drawShop() {
          if (!shop.asked || !shop.rows.length || page.__owShop) return;
          page.__owShop = true;
          var sb = sec('Shop', '', '');
          shop.rows.forEach(function (p) { sb.appendChild(shopRow(p)); });
          if (!shop.next) return;
          var more = mk('button', 'ow-popit-btn ow-cpage__more');
          more.type = 'button';
          var say = function () { more.textContent = 'Show ' + Math.max(0, shop.total - shop.rows.length) + ' more'; };
          say();
          more.addEventListener('click', function () {
            more.disabled = true;
            data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/products?after=' + encodeURIComponent(shop.next))
              .then(function (r) {
                var d = (r && r.ok && r.data) || {};
                (d.products || []).forEach(function (p) { shop.rows.push(p); sb.insertBefore(shopRow(p), more); });
                shop.next = d.next || '';
                if (!shop.next) more.remove(); else { more.disabled = false; say(); }
              }).catch(function () { more.disabled = false; more.textContent = 'Could not load more. Try again'; });
          });
          sb.appendChild(more);
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
            bb.appendChild(thingRow(t.name, [t.kind || '', t.capacity ? ('holds ' + t.capacity) : '',
              (t.rules && t.rules.members_only) ? 'members only' : '']          /* the engine refuses anyone else (660 row 541) */
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
        /* WHAT IS TRUE TODAY, AND THE DAYS THAT DIFFER (PLAN B2: the content loop's dated days, cross projection's special
           hours). `/places/{id}/now` is the one answer to "open now" (centers/now.py): a date the Center said overrides its
           weekday, so a closed holiday reads closed here as it does on Google and on the Center's own site. */
        var nowOpen = null;
        var SPECIAL_SHOWN = 4;          /* the days ahead with their own hours said here; the rest are counted, never dropped */
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
        /* A DOOR SIGN'S WORDS, as the header's card says them (api/oneway/centers/hours.py door_sign, which the card read
           uses): "6 AM–6 PM", "11 AM–2 PM, 5–10 PM", "6 PM–midnight"; two times in the same half of the day share one AM or
           PM. So the page never says the same hours in two clocks. */
        function doorTime(t) {
          var h = parseInt(String(t).slice(0, 2), 10), m = parseInt(String(t).slice(3, 5), 10) || 0;
          if (isNaN(h)) return String(t || '');
          if ((h === 0 || h === 24) && !m) return 'midnight';
          var h12 = h % 12 || 12;
          return (m ? h12 + ':' + (m < 10 ? '0' : '') + m : String(h12)) + (h < 12 ? ' AM' : ' PM');
        }
        function doorSign(spans) {
          return (spans || []).map(function (x) {
            if (x[0] === '00:00' && x[1] === '24:00') return 'Open all day';
            var a = doorTime(x[0]), b = doorTime(x[1]);
            if (a.slice(-2) === b.slice(-2) && /[AP]M$/.test(a)) a = a.slice(0, -3);
            return a + '–' + b;
          }).join(', ');
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
              var txt = doorSign(spans);
              if (said.length && said[said.length - 1].txt === txt) { said[said.length - 1].days.push(d); return; }
              said.push({ txt: txt, days: [d] });
            });
            var closed = DAYS.filter(function (d) { return !hrs[d] || !hrs[d].length; });
            said.forEach(function (g) {
              rows.push({ k: g.days.length === 7 ? 'Every day'
                : (g.days.length > 1 ? (DN[g.days[0]] + '–' + DN[g.days[g.days.length - 1]]) : DN[g.days[0]]),
                v: g.txt, said: 'hours' });
            });
            if (closed.length && closed.length < 7) rows.push({ k: closed.map(function (d) { return DN[d]; }).join(', '), v: 'Closed', said: 'hours' });
          }
          /* the days ahead that differ, each as the record says it: its own hours or closed, and why */
          var op = nowOpen || null, todaySpecial = (op && op.today_special) || null;
          function spansWords(sp) { return doorSign(sp); }
          function dayWords(iso) {
            try { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
            catch (e) { return String(iso); }
          }
          var ahead = ((op && op.special_hours) || []).filter(function (r) { return r && r.date && !(todaySpecial && r.date === todaySpecial.date); });
          ahead.slice(0, SPECIAL_SHOWN).forEach(function (r) {
            rows.push({ k: dayWords(r.date), v: [(r.spans && r.spans.length) ? spansWords(r.spans) : 'Closed', r.label].filter(Boolean).join(' · ') });
          });
          var moreDays = Math.max(0, ahead.length - SPECIAL_SHOWN) + ((op && op.special_hours_more) || 0);
          if (moreDays) rows.push({ k: '', v: moreDays + ' more ' + (moreDays === 1 ? 'day has its' : 'days have their') + ' own hours' });
          var openNow = facts.open_now;
          var localNow = zone ? (function () {
            try { return new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date()); }
            catch (e) { return ''; }
          })() : '';
          if (op && (op.state === 'open' || op.state === 'closed')) {
            /* NOW, FROM THE ONE ANSWER: today's own date first (a holiday's hours or its closing), then the weekday */
            openNow = op.state === 'open';
            var said = openNow ? (op.all_day ? 'Open all day' : 'Open' + (op.until ? ' until ' + doorTime(op.until) : ''))
                               : ((todaySpecial && todaySpecial.closed) ? 'Closed today' : 'Closed' + (op.opens ? ' · opens at ' + doorTime(op.opens) : ''));
            if (todaySpecial && todaySpecial.label) said += ' · ' + todaySpecial.label;
            rows.unshift({ k: 'Now', v: said + (localNow ? ' · it is ' + localNow + ' there' : ''), open: openNow });
          } else if (typeof openNow === 'boolean') rows.unshift({ k: 'Now', v: (openNow ? 'Open' : 'Closed') + (localNow ? ' · it is ' + localNow + ' there' : ''), open: openNow });
          var whereLabel = ((_cnA.where || {}).label) || ((_cnA.where || {}).address) || '';
          if (whereLabel && String(whereLabel).indexOf('·') < 0) rows.push({ k: 'Address', v: String(whereLabel), said: 'address' });
          if (facts.established) rows.push({ k: 'Since', v: String(facts.established), said: 'established' });
          if (rows.length < 3) return;                         /* S18: three facts or nothing */
          var vb = sec('Visit', '', '');
          lines(vb, rows);
          var drawn = [].slice.call(vb.querySelectorAll('.ow-cpage__row'));
          rows.filter(function (r) { return r && r.v; }).forEach(function (r, i) { if (r.said && drawn[i]) drawn[i].setAttribute('data-said', r.said); });
          var nowRow = vb.querySelector('.ow-cpage__row');
          if (nowRow && typeof openNow === 'boolean') nowRow.setAttribute('data-open', openNow ? '1' : '0');
          /* SAID ONCE (a cold judge, 2026-10-17: the bakery's hours twice, "Mon–Fri · 6 AM–6 PM" in the header's card and
             "06:00 – 18:00" here): what the header's card already says (pages.js sets data-card-says from its details) is
             not said again here, and what is left keeps S18's rule, three facts or no Visit at all. Checked now and again
             when the card lands, whichever comes first. */
          function sayOnce() {
            var prof = host.querySelector('.ow-prof'), says = ' ' + ((prof && prof.getAttribute('data-card-says')) || '') + ' ';
            var left = 0;
            drawn.forEach(function (row) {   /* by its own style: the page's rows set their display, which [hidden] loses to */
              var k = row.getAttribute('data-said'), once = !!(k && says.indexOf(' ' + k + ' ') >= 0);
              row.style.display = once ? 'none' : '';
              if (!once) left++;
            });
            vb.style.display = left < 3 ? 'none' : '';
            if (vb.previousSibling && vb.previousSibling.classList && vb.previousSibling.classList.contains('ow-cpage__h')) vb.previousSibling.style.display = left < 3 ? 'none' : '';
          }
          sayOnce();
          var profNow = host.querySelector('.ow-prof');
          if (profNow) profNow.addEventListener('ow:header-card', sayOnce);
        }

        var ORDER = {
          hotel: ['book', 'events', 'shop', 'inside', 'known', 'visit'],
          resort: ['book', 'events', 'shop', 'inside', 'known', 'visit'],
          casino: ['events', 'book', 'shop', 'inside', 'known', 'visit'],
          venue: ['events', 'book', 'shop', 'inside', 'known', 'visit'],
          club: ['events', 'book', 'shop', 'inside', 'known', 'visit'],
          museum: ['events', 'book', 'shop', 'known', 'inside', 'visit'],
          gallery: ['events', 'book', 'shop', 'known', 'inside', 'visit'],
          restaurant: ['book', 'events', 'shop', 'known', 'inside', 'visit'],
          bar: ['book', 'events', 'shop', 'known', 'inside', 'visit'],
          cafe: ['book', 'events', 'shop', 'known', 'inside', 'visit'],
          store: ['shop', 'events', 'book', 'inside', 'known', 'visit'],
          shop: ['shop', 'events', 'book', 'inside', 'known', 'visit'],
          retail: ['shop', 'events', 'book', 'inside', 'known', 'visit'],
          _: ['events', 'book', 'shop', 'inside', 'known', 'visit']
        };
        /* REPORT A PROBLEM (C-systems, 2026-10-11; systems/work/reported.py, one request queue; PROPOSED for his eye): only to
           someone the door accepts (a stay, a membership or a role here). The form opens in place (S2), the answer is the
           toast (S23), and their own reports here say what became of each. Never on the card, its banner or the header. */
        function drawReport() {
          data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/requests').then(function (r) {
            var d = (r && r.ok && r.data) || null;
            if (!d || !d.may_report) return;
            var body = sec('Report a problem', '', '');
            var open = mk('button', 'po-act', 'Report a problem'); open.type = 'button';
            var formHost = mk('div');
            body.appendChild(open); body.appendChild(formHost);
            var STATE = { 'new': 'Waiting for the people who fix things', accepted: 'Being fixed', merged: 'Already being fixed',
                          declined: 'Declined', fixed: 'Fixed', closed: 'Closed' };
            if ((d.mine || []).length) lines(body, d.mine.slice(0, 5).map(function (x) {
              return { k: x.what, v: (STATE[x.state] || x.state) + (x.state === 'declined' && x.words ? ': ' + x.words : '') + (x.state === 'fixed' && x.closed_note ? ': ' + x.closed_note : '') };
            }));
            open.addEventListener('click', function () {
              if (formHost.firstChild) { formHost.innerHTML = ''; return; }
              var wrap = mk('div', 'ow-bk');
              var where = doc.createElement('select'); where.className = 'ow-bk__in';
              (d.things || []).forEach(function (t) { var o = doc.createElement('option'); o.value = t.thing; o.textContent = t.name; where.appendChild(o); });
              var other = doc.createElement('option'); other.value = ''; other.textContent = 'Somewhere else here'; where.appendChild(other);
              var what = doc.createElement('textarea'); what.className = 'ow-bk__in'; what.rows = 3; what.maxLength = 500;
              var f1 = mk('label', 'ow-bk__f'); f1.appendChild(mk('span', '', 'Where')); f1.appendChild(where); wrap.appendChild(f1);
              var f2 = mk('label', 'ow-bk__f'); f2.appendChild(mk('span', '', 'What is wrong')); f2.appendChild(what); wrap.appendChild(f2);
              var row = mk('div', 'ow-bk__row'), send = mk('button', 'po-act ow-bk__go', 'Send it'); send.type = 'button';
              row.appendChild(send); wrap.appendChild(row);
              formHost.appendChild(wrap);
              send.addEventListener('click', function () {
                if (!what.value.trim()) { if (OW.toast) OW.toast('Say what is wrong.'); return; }
                send.disabled = true;
                data.post('/api/oneway/centers/' + encodeURIComponent(centerId) + '/requests', { what: what.value.trim(), thing: where.value || '' }).then(function (res) {
                  send.disabled = false;
                  if (!res.ok) { if (OW.toast) OW.toast(res.error || 'That was not sent.'); return; }
                  formHost.innerHTML = '';
                  if (OW.toast) OW.toast(((res.data || {}).request || {}).words || 'Reported.');
                });
              });
              try { what.focus(); } catch (_) {}
            });
          }).catch(function () {});
        }
        /* WHAT IT HAS DONE (C-systems, 2026-10-11; communities/operational.py, 660 row 541; PROPOSED for his eye): a
           community's gatherings of the last 90 days, each with how many came, the totals in words, and who decides and how
           one joins. Drawn only for a community, and only when it has held something; never on the card, its banner or the
           header. Meetup's past events with who came, Planning Center's group record. */
        function drawDone() {
          if (String((app.identity && app.identity.family) || '') !== 'community') return;   /* the read is a community's own */
          data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/community').then(function (r) {
            var d = (r && r.ok && r.data) || null;
            if (!d || d.family !== 'community' || !(d.activities || []).length) return;
            var db = sec('What it has done', '', '');
            lines(db, [{ k: '', v: d.activity.words }].concat(d.activities.slice(0, 5).map(function (a) {
              var when = '';
              try { when = new Date(a.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (_) {}
              return { k: when, v: a.title + ' \u00b7 ' + a.came + ' came' };
            })).concat(d.governance && d.governance.words ? [{ k: 'Who decides', v: d.governance.words }] : []));
          }).catch(function () {});
        }
        /* WHAT IS HERE (C-app, 2026-10-12; centers/ecosystem.py, 660 row 543; PROPOSED for his eye): a city, a district or a
           destination says what lives in it: its organisations, communities and places, each a door to it, how many people
           belong to them (counted, never named), what is on in it, what its bookable things hold and what it has done lately.
           Asked only of a place (the composed read names the family); drawn only when something is in it. Never on the card,
           its banner or the header. */
        function drawHere() {
          if (String((app.identity && app.identity.family) || '') !== 'place') return;
          data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/ecosystem').then(function (r) {
            var d = (r && r.ok && r.data) || null;
            if (!d || !(d.families || []).length) return;
            var hb = sec('What is here', '', '');
            lines(hb, [{ k: '', v: d.words }]);
            /* a few of each family, the rest counted: a city's page is not its directory */
            d.families.forEach(function (f) {
              var few = (f.shown || []).slice(0, 4);
              few.forEach(function (x) {
                hb.appendChild(thingRow(x.name, [x.kind, x.how].filter(Boolean).join(' \u00b7 '), '', function () {
                  try { doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: x.center_id, name: x.name } })); } catch (e) {}
                }));
              });
              var rest = Math.max(0, (f.count || 0) - few.length);
              if (rest) lines(hb, [{ k: '', v: 'and ' + rest + ' more' }]);
            });
            var tail = (d.events || []).slice(0, 3).map(function (e) {
              var when = '';
              try { when = new Date(e.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (_) {}
              return { k: when, v: e.title + (e.center_name ? ' \u00b7 ' + e.center_name : '') };
            });
            if (d.capacity && d.capacity.words) tail.push({ k: 'Holds', v: d.capacity.words });
            if (d.history && d.history.words) tail.push({ k: 'Lately', v: d.history.words });
            lines(hb, tail);
          }).catch(function () {});
        }
        /* WHERE IT IS, AND WHAT IS HELD HERE (C-systems, 2026-10-11; centers/chain.py, 660 rows 453 and 542; PROPOSED for his
           eye): the Centers it sits in up to its city, what is inside it, and the communities' events held here, one list
           with whose each is. Drawn only when the read has something; never on the card, its banner or the header. */
        function drawWhere() {
          data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/chain').then(function (r) {
            var d = (r && r.ok && r.data) || null;
            if (!d) return;
            var rowsW = [];
            if ((d.up || []).length || (d.place || []).length) {
              var path = (d.up || []).map(function (x) { return x.name; }).concat((d.place || []).slice(0, 1).map(function (p) { return p.name; }));
              if (path.length) rowsW.push({ k: (d.up || []).length ? (d.up[0].how.charAt(0).toUpperCase() + d.up[0].how.slice(1)) : 'In', v: path.join(' \u00b7 ') });
            }
            if ((d.inside || []).length) rowsW.push({ k: 'Inside', v: d.inside.map(function (x) { return x.name; }).join(', ') + (d.inside_more ? ' and ' + d.inside_more + ' more' : '') });
            /* A PLACE RECORDED ON AN OPEN RECORD (PLAN B8 slice 1, §7 item 57): its source said beside it, never as Oneway's */
            var said = (d.up || []).concat(d.inside || []).filter(function (x) { return x.stated; })[0];
            if (said) rowsW.push({ k: 'Source', v: said.stated.source + ', ' + said.stated.words + (said.stated.license ? ' (' + said.stated.license + ')' : '') });
            if (rowsW.length && ((d.up || []).length || (d.inside || []).length)) lines(sec('Where it is', '', ''), rowsW);
            if ((d.held || []).length) {
              var hb = sec('Held here', '', '');
              lines(hb, d.held.map(function (e) {
                var when = '';
                try { when = new Date(e.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (_) {}
                return { k: when, v: e.title + ' \u00b7 ' + e.by };
              }));
            }
          }).catch(function () {});
        }
        /* THE WAITLIST, FROM THE GUEST'S SIDE (register row 17, compare-os-restaurant-floor #4; as Yelp Waitlist and
           SevenRooms' guest waitlist; PROPOSED for his eye): a restaurant that runs its floor here says how many parties
           wait (centers/now.read); a signed-in person joins with their party's size, follows their place in line, and is
           told when the host says their table is ready (that notification brings them here). Read again every 30 s
           while the page is shown, and when a notification arrives. */
        var nowWait = null, WAIT_EVERY = 30000;
        function drawWait() {
          var wl = nowWait;
          if (!wl || !wl.takes) return;
          var body = sec('Waitlist', '', '');
          var box = mk('div', 'ow-cwait');
          body.appendChild(box);
          var url = '/api/oneway/me/waitlist/' + encodeURIComponent(centerId), size = 2, busy = false, said = '';
          var nth = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
          function paint(d) {
            box.innerHTML = '';
            d = d || {};
            if (d.waiting) {
              box.setAttribute('data-s', d.ready ? 'ready' : 'waiting');
              box.appendChild(mk('b', 'ow-cwait__t', esc(d.ready ? 'Your table is ready' : d.place === 1 ? 'You are next' : 'You are ' + nth(d.place) + ' in line')));
              box.appendChild(mk('span', 'ow-cwait__s', esc(d.ready ? 'Come to the host stand'
                : [d.ahead === 1 ? '1 party ahead' : d.ahead + ' parties ahead', 'party of ' + d.party_size,
                   'waiting ' + d.waited_min + ' min'].join(' \u00b7 '))));
              var lv = mk('button', 'ow-btn ow-btn--quiet ow-cwait__go', 'Leave the waitlist');
              lv.type = 'button';
              lv.addEventListener('click', function () { send('leave'); });
              box.appendChild(lv);
            } else {
              box.setAttribute('data-s', 'out');
              box.appendChild(mk('span', 'ow-cwait__s', esc(d.words || wl.words || '')));
              if (signedIn()) {
                var row = mk('div', 'ow-cwait__size');
                var less = mk('button', 'ow-cwait__n', '\u2212'), more = mk('button', 'ow-cwait__n', '+');
                less.type = more.type = 'button';
                less.setAttribute('aria-label', 'Fewer'); more.setAttribute('aria-label', 'More');
                var cnt = mk('span', 'ow-cwait__c', esc('Party of ' + size));
                less.addEventListener('click', function () { if (size > 1) { size--; cnt.textContent = 'Party of ' + size; } });
                more.addEventListener('click', function () { if (size < 60) { size++; cnt.textContent = 'Party of ' + size; } });
                row.appendChild(less); row.appendChild(cnt); row.appendChild(more);
                box.appendChild(row);
                var go = mk('button', 'ow-btn ow-cwait__go', 'Join the waitlist');
                go.type = 'button';
                go.addEventListener('click', function () { send('join'); });
                box.appendChild(go);
              }
            }
            if (said) box.appendChild(mk('span', 'ow-cwait__err', esc(said)));
          }
          function read() {
            if (!signedIn()) { paint({}); return; }
            data.get(url).then(function (r) { if (r && r.ok) paint(r.data); }).catch(function () {});
          }
          function send(what) {
            if (busy) return;
            busy = true; said = '';
            (what === 'join' ? data.post(url, { party_size: size }) : data.del(url)).then(function (r) {
              busy = false;
              if (r && r.ok) { paint(r.data); return; }
              said = (r && r.error) || (what === 'join' ? 'You could not join just now.' : 'That did not go through.');
              read();
            }).catch(function () { busy = false; said = 'That did not go through.'; read(); });
          }
          read();
          var tick = setInterval(function () { if (!box.isConnected) { clearInterval(tick); return; } read(); }, WAIT_EVERY);
          var onNote = function () { if (!box.isConnected) { doc.removeEventListener('ow:notifications-changed', onNote); return; } read(); };
          doc.addEventListener('ow:notifications-changed', onNote);
        }
        var DRAW = { events: drawEvents, book: drawBook, shop: drawShop, inside: drawInside, known: drawKnown, visit: drawVisit };
        var drawn = false;
        function draw() {
          if (drawn) return; drawn = true;
          (ORDER[kindWord] || ORDER._).forEach(function (k) { try { DRAW[k](); } catch (e) { console.warn('[app/center] section', k, e && e.message); } });
          try { drawDone(); } catch (e) { console.warn('[app/center] section done', e && e.message); }
          try { drawWait(); } catch (e) { console.warn('[app/center] section waitlist', e && e.message); }
          try { drawHere(); } catch (e) { console.warn('[app/center] section here', e && e.message); }
          try { drawWhere(); } catch (e) { console.warn('[app/center] section where', e && e.message); }
          try { drawReport(); } catch (e) { console.warn('[app/center] section report', e && e.message); }
          page.__owHas = page.childNodes.length > 0;
        }
        var nowP = data.get('/api/oneway/places/' + encodeURIComponent(centerId) + '/now')
          .then(function (r) { nowOpen = (r && r.ok && r.data && r.data.open) || null; nowWait = (r && r.ok && r.data && r.data.waitlist) || null; }).catch(function () {});
        /* the Shop and today take their place in the order, never last by accident */
        function whenRead() { Promise.all([shopP, nowP]).then(draw, draw); }
        data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/about')
          .then(function (r) {
            var art = (r && r.ok && r.data) || null;
            ((art && art.sections && art.sections.what || {}).facts || []).forEach(function (f) {
              if (f && f.key) facts[f.key] = f.value;
            });
            whenRead();
          }).catch(whenRead);
        /* the article never answering must not cost the page its events (a Shop answering later is drawn then) */
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
          /* the server's words when its feed carries nothing either: no post of its own, of the places inside it,
             about it or from a feed merged with it (founder/759: "so inactive centers dont have deadfeeds") */
          nothing(p, first.said || ('Nothing has been posted to ' + (head.name || 'this Center') + ' yet.'), 'No posts yet',
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
                           label: f.standing || f.role || '', icon: 'person',   /* "Steward": the backend's word (founder/748) */
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

        /* ── PHOTOS, AS GOOGLE BUSINESS PROFILE'S (register row 9) ─────────────────────────────────────────────────
           Every picture in this Center's posts that this person may see, newest first, in a square grid, with All ·
           From the Center · From people the way a business profile splits by owner and by visitors; a tap opens the
           post it is in. One read (`/api/oneway/social/places/{id}/photos`, the Place feed's own gate), a page at a
           time with More. A failed read says so; none says none. */
        { id: 'photos', label: 'Photos', render: function (p) {
            var wrap = mk('div', 'ow-cphotos'), by = mk('div', 'ow-feedswitch ow-cphotos__by'), grid = mk('div', 'ow-cphotos__grid');
            var foot = mk('div', 'ow-cphotos__foot');
            var all = [], cursor = '', want = '', busy = false;
            [['', 'All'], ['center', 'From the Center'], ['person', 'From people']].forEach(function (f) {
              var b = mk('button', '', esc(f[1])); b.type = 'button';     /* Home's own segmented control (.ow-feedswitch) */
              b.setAttribute('data-by', f[0]); b.setAttribute('aria-pressed', f[0] === want ? 'true' : 'false');
              b.addEventListener('click', function () {
                want = f[0];
                [].forEach.call(by.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
                paint();
              });
              by.appendChild(b);
            });
            function paint() {
              grid.innerHTML = '';
              var shown = all.filter(function (ph) { return !want || ph.by === want; });
              shown.forEach(function (ph) {
                var t = mk('button', 'ow-cphotos__ph'); t.type = 'button';
                t.setAttribute('aria-label', ph.alt || (ph.kind === 'video' ? 'A video' : 'A photo'));
                if (ph.kind === 'video') t.setAttribute('data-video', '1');
                var im = doc.createElement('img');
                im.src = assetUrl(ph.src); im.alt = ph.alt || ''; im.loading = 'lazy'; im.decoding = 'async';
                t.appendChild(im);
                t.addEventListener('click', function () {
                  if (ph.post_id && typeof global.openPost === 'function') global.openPost(ph.post_id);
                });
                grid.appendChild(t);
              });
              foot.innerHTML = '';
              if (!shown.length && !cursor) foot.appendChild(mk('p', 'ow-cphotos__none',
                want === 'center' ? 'No photos from the Center yet.' : want === 'person' ? 'No photos from people yet.' : 'No photos yet.'));
              if (cursor) {
                var more = mk('button', 'ow-btn ow-cphotos__more', 'More photos'); more.type = 'button';
                more.addEventListener('click', load);
                foot.appendChild(more);
              }
            }
            function load() {
              if (busy) return; busy = true;
              data.get('/api/oneway/social/places/' + encodeURIComponent(centerId) + '/photos'
                       + (cursor ? '?before=' + encodeURIComponent(cursor) : '')).then(function (r) {
                busy = false;
                if (!r || !r.ok || !r.data) {
                  foot.innerHTML = ''; foot.appendChild(mk('p', 'ow-cphotos__none', 'The photos could not be read just now.'));
                  return;
                }
                all = all.concat(r.data.photos || []);
                cursor = r.data.next_cursor || '';
                paint();
              });
            }
            wrap.appendChild(by); wrap.appendChild(grid); wrap.appendChild(foot);
            p.appendChild(wrap);
            load();
          } },

        /* ── NEARBY: WHAT IS WITHIN A MILE (660 row 325; as a map's place card lists what is close) ──────────────────
           The Centers on Oneway within a mile of this one, nearest first, each with how far and what is next there; a
           tap opens it. From the around read (location/around.py `within_a_mile`): only points the Centers set
           themselves are measured (a city's centre is no distance), public faces only. Said when there is none. */
        { id: 'nearby', label: 'Nearby', render: function (p) {
            var host = mk('div', 'ow-cnearby');
            p.appendChild(host);
            host.appendChild(mk('p', 'po-acts__wait', 'Reading what is near\u2026'));
            data.get('/api/oneway/location/around?center=' + encodeURIComponent(centerId)).then(function (r) {
              host.innerHTML = '';
              if (!r || !r.ok || !r.data) { host.appendChild(mk('p', 'ow-cphotos__none', 'What is near could not be read just now.')); return; }
              var d = r.data, rows = d.within_a_mile || [];
              if (!rows.length) {
                host.appendChild(mk('p', 'ow-cphotos__none', esc(d.within_a_mile_words || 'Nothing else on Oneway is within a mile of here yet.')));
                return;
              }
              var lang = String((global.navigator || {}).language || ''), miles = /^en-(US|GB)/i.test(lang) || lang === 'en';
              factList(host, rows.map(function (x) {
                var far = miles ? (x.distance_mi < 0.1 ? 'next door' : x.distance_mi.toFixed(1) + ' mi')
                                : (x.distance_km < 0.15 ? 'next door' : x.distance_km.toFixed(1) + ' km');
                var ev = x.next_event ? (x.next_event.on_now ? 'on now: ' : '') + x.next_event.title : '';
                return { id: 'nb-' + x.center_id, value: x.name, label: [far, ev].filter(Boolean).join(' \u00b7 '), icon: 'place',
                         center_id: x.center_id };
              }), 'Nothing else on Oneway is within a mile of here yet.', function (row) {
                doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: row.center_id } }));
              });
              if (d.within_a_mile_more) host.appendChild(mk('p', 'ow-cphotos__none', 'And ' + d.within_a_mile_more + ' more within a mile.'));
            });
          } },

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
            var _prose = null, _small = [], _drawn = {};    /* _drawn: label -> its value's cell, so the article below adds to it, never repeats it */
            /* WHERE A FACT IS FROM (founder/743): its source named beside it, a link to the page that says it */
            function citeOn(dd, cite) {
              if (!dd || !cite || !cite.url || !/^https:\/\//i.test(cite.url) || dd.querySelector('[data-cite]')) return;
              var cs = mk('span', 'ow-cabout__audit', ''), ca = doc.createElement('a');
              cs.setAttribute('data-cite', '1');
              ca.className = 'ow-cabout__link'; ca.href = cite.url; ca.target = '_blank'; ca.rel = 'noopener noreferrer';
              ca.textContent = cite.name || 'Source'; cs.appendChild(doc.createTextNode(' \u00b7 ')); cs.appendChild(ca); dd.appendChild(cs);
            }
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
                _drawn[String(f.label || '').trim().toLowerCase()] = dd;
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
              /* FROM WIKIPEDIA (founder/738, 381; centers/wikipedia.py): the linked article's opening, first, the way a
                 place card opens on its encyclopedia summary, with the article's link and its license (CC BY-SA) always
                 beside it; never the Center's own words, which follow */
              var wk = art.wikipedia;
              if (wk) {
                var wb = mk('div', 'ow-cabout__wiki');
                wb.appendChild(mk('div', 'ow-cinside__h', esc(wk.from || 'From Wikipedia')));
                if (wk.read === false) wb.appendChild(mk('p', 'ow-cabout__audit', esc(wk.words || '')));
                else {
                  if (wk.description) wb.appendChild(mk('p', 'ow-cabout__audit', esc(wk.description)));
                  if (wk.summary) wb.appendChild(mk('p', 'ow-prof__bio', esc(wk.summary)));
                }
                var cr = mk('p', 'ow-cabout__audit', ''), la = doc.createElement('a');
                la.className = 'ow-cabout__link'; la.href = wk.url; la.target = '_blank'; la.rel = 'noopener noreferrer';
                la.textContent = 'Read it on Wikipedia'; cr.appendChild(la);
                cr.appendChild(doc.createTextNode(' \u00b7 '));
                var ll = doc.createElement('a'); ll.className = 'ow-cabout__link'; ll.href = wk.license_url || 'https://creativecommons.org/licenses/by-sa/4.0/';
                ll.target = '_blank'; ll.rel = 'noopener noreferrer'; ll.textContent = wk.license || 'CC BY-SA 4.0'; cr.appendChild(ll);
                /* CC BY-SA asks that a change be said: a shortened opening says so, and an older reading its date */
                if (wk.read !== false && wk.shortened) cr.appendChild(doc.createTextNode(' \u00b7 Shortened'));
                if (wk.read !== false && wk.stale && wk.as_of) cr.appendChild(doc.createTextNode(' \u00b7 as read ' + String(wk.as_of).slice(0, 10)));
                wb.appendChild(cr);
                artHost.appendChild(wb);
              }
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
                  citeOn(dd, rw.cite);
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
                } else if (_drawn[String(f.label || '').trim().toLowerCase()]) {
                  citeOn(_drawn[String(f.label || '').trim().toLowerCase()], f.cites);   /* drawn above already: its source added there, never a second row */
                } else if (['kind','where','since','website','timezone','open_now','team','location','industry'].indexOf(f.key) < 0) {
                  factRows.push({ label: f.label, value: Array.isArray(f.value) ? f.value.join(' · ') : String(f.value), cite: f.cites || null });
                }
              });
              if (factRows.length) { section('Details'); table(factRows); }
              /* who runs it, and what it runs */
              /* A DEMONSTRATION SAYS SO, and says nothing more than the records
                 do (founder/561): ONEWAY made it; the business has not claimed
                 it. No "Run by ONEWAY" on a business ONEWAY does not run. */
              if (app.identity && app.identity.demo) {
                table([{ label: 'Made by', value: 'Oneway, as a demo environment — not a real business' }]);
              }
              if (ppl.demonstration) {
                table([{ label: 'Made by', value: 'Oneway, as a demonstration' }]);
                if (!ppl.demonstration.claimed) table([{ label: 'Claimed', value: 'Not yet claimed by ' + (head.name || 'the business') }]);
              }
              if ((ppl.operators || []).length) table([{ label: 'Run by', value: ppl.operators.map(function (o) { return o.name || o.email; }).join(' · ') }]);
              if ((runs.systems || []).length) table([{ label: 'Runs', value: runs.systems.map(function (x) { return x.name; }).join(' · ') }]);
              /* history — dated rows, newest first, as the article orders them */
              var hrows = (hist.items || []).filter(function (h) { return h && h.text; });
              if (hrows.length) { section('History'); table(hrows.map(function (h) { return { label: h.at || '', value: h.text }; })); }
              /* ADDED BY THE COMMUNITY (founder/725, T1), AND THEIR WEBSITE, WE THINK (PLAN B8 slice 5, founder/741: "display
                 the assumption ... let them edit it just like it's Wikipedia ... a small part on the bottom"): one small line,
                 last; anyone completing the map changes it while nobody runs the place. A link only: nothing reads the site. */
              var com = app.community;
              if (com && com.label) {
                var cw = mk('p', 'ow-cabout__audit', '');
                cw.setAttribute('data-community', '1');
                var paintW = function (w) {
                  cw.innerHTML = '';
                  cw.appendChild(doc.createTextNode(com.label + '. Their website, we think: '));
                  if (w && w.url && /^https?:\/\//i.test(w.url)) {
                    var wa = doc.createElement('a'); wa.className = 'ow-cabout__link'; wa.href = w.url; wa.target = '_blank';
                    wa.rel = 'noopener noreferrer nofollow'; wa.textContent = w.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
                    cw.appendChild(wa);
                  } else cw.appendChild(doc.createTextNode('not known yet'));
                  cw.appendChild(doc.createTextNode(' \u00b7 '));
                  var ch = mk('button', 'ow-cabout__door', esc(w && w.url ? 'Change' : 'Add it')); ch.type = 'button';
                  ch.setAttribute('data-community-website', 'change');
                  ch.addEventListener('click', function () { editW(w); });
                  cw.appendChild(ch);
                };
                var editW = function (w) {
                  cw.innerHTML = '';
                  var wi = doc.createElement('input'); wi.type = 'url'; wi.className = 'ow-bk__in'; wi.maxLength = 300;
                  wi.value = (w && w.url) || ''; wi.setAttribute('aria-label', 'Their website'); wi.setAttribute('data-community-website', 'input');
                  var sv = mk('button', 'po-act', 'Save'); sv.type = 'button'; sv.setAttribute('data-community-website', 'save');
                  var said = mk('span', '', '');
                  sv.addEventListener('click', function () {
                    sv.disabled = true;
                    data.post('/api/oneway/contributed/' + encodeURIComponent(centerId) + '/website', { url: wi.value.trim() }).then(function (r) {
                      sv.disabled = false;
                      if (!r.ok) { said.textContent = ' ' + (r.error || 'Not changed.'); return; }
                      com = ((r.data || {}).center) || com; app.community = com; paintW(com.website_assumed);
                    });
                  });
                  cw.appendChild(wi); cw.appendChild(sv); cw.appendChild(said);
                };
                paintW(com.website_assumed);
                artHost.appendChild(cw);
              }
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
            /* LINKED WITH (C-app, 2026-10-12; centers/network.py, 660 row 499; PROPOSED for his eye): the Centers it is linked
               to, in each link's own words, only links both sides agreed to; each a door. Read when About is opened, never on
               every Center page; absent when it is linked to nothing. */
            data.get('/api/oneway/centers/' + encodeURIComponent(centerId) + '/network').then(function (nr) {
              var nd = (nr && nr.ok && nr.data) || null;
              if (!nd || !(nd.centers || []).length || !p.isConnected) return;
              var lw = mk('div', 'ow-cinside');
              lw.setAttribute('data-linked', '1');
              lw.appendChild(mk('div', 'ow-cinside__h', nd.centers.length === 1 ? 'Linked with' : 'Linked with \u00b7 ' + nd.centers.length));
              var ll = mk('div');
              lw.appendChild(ll);
              p.appendChild(lw);
              factList(ll, nd.centers.map(function (c) {
                return { id: 'ln-' + c.center_id, value: c.name || c.center_id, label: c.words || '', icon: 'place', go: c.center_id || '' };
              }), null, function (rr, el) {
                if (rr.go) openCenterPopit(rr.go, el);
              });
              if (nd.centers_more) ll.appendChild(mk('div', 'ow-cinside__h', 'and ' + nd.centers_more + ' more'));
            }).catch(function () {});
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
      tabs = sectionedStrip(tabs, app && app.sections);
      /* MAIN LEADS (the OS's cold walk, 2026-10-17: on a Center whose site has 39 pages, Main was the last of 41 tabs, about
         5,400px along the row). The site's pages go before the Center's own tabs; unless the Center chose its strip's order
         itself (founder/681, arranged above; or its Sections), its Main comes first and the site's pages after it. */
      var _ord = app && app.website && app.website.categories && app.website.categories.order;
      /* the Center chose the order when it placed its strip (website.categories.order) or put another Section before
         Main in its Sections; a site's own pages (its "Home" among them) never go ahead of Main otherwise */
      var _secs = app && Array.isArray(app.sections) ? app.sections : [];
      var _secFirst = _secs.slice().sort(function (a, b) { return a.order - b.order; })[0];
      if (!(_ord && _ord.length) && !(_secFirst && _secFirst.kind !== 'main' && SECTION_TAB[_secFirst.kind])) {
        for (var _mi = 1; _mi < tabs.length; _mi++) { if (tabs[_mi] && tabs[_mi].id === 'main') { tabs.unshift(tabs.splice(_mi, 1)[0]); break; } }
      }
      profileShell(host, {
        kind: 'center', cardRef: String(centerId), name: head.name || ident.name || 'Center',
        /* WHAT THIS PLACE IS — never what the READER is to it. `viewer.line`
           ("no relationship yet — one act away") was joined onto the end, so a
           Center's identity read:
               "Resort & Casino · Atlantic City, New Jersey ·
                no relationship yet — one act away"
           Three different kinds of statement in one uppercase run-on: a
           category, an address, and a prompt aimed at the reader. The prompt is
           also redundant — Follow and Message sit directly beneath it and say
           the same thing in the form of something you can press. */
        /* Center addresses use a dot prefix; location and shortcuts
           belong in the information column, not the identity line. */
        open: opts.open || '',
        sub: (app.identity && app.identity.handle) ? '.' + String(app.identity.handle).replace(/^[$.]+/, '') : '',
        details: [{ value: [app.where && app.where.city,
          app.where && app.where.region === 'New Jersey' ? 'NJ' : app.where && app.where.region].filter(Boolean).join(', ') }],
        /* THE PLACE'S OWN SENTENCE, under its name — the same slot a person's
           bio takes, drawn by the same rule: present when it exists, nothing
           at all when it does not (founder/369). MEASURED on Caesars as a
           guest: the door carried "The Boardwalk's grand room, where the
           lights never quite go down." and the header showed nothing of it;
           it lived only on the About tab. Every real place page puts that
           line under the name. The About tab keeps the whole About and its
           provenance; this is the first thing a guest reads. */
        /* a sentence that only says the name again is not drawn (founder, 2026-10-12: "remove un nesacary subtitles") */
        bio: (function (b) { var n = String(head.name || ident.name || (app.identity && app.identity.name) || '').trim().toLowerCase(); return b.toLowerCase() === n ? '' : b; })(
             String((app.identity && app.identity.description) || ident.introduction || '').trim()),
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
        banner: ownCover(app.identity || {}), bannerStyle: (app.identity || {}).banner_style || 'fade',
        bannerShape: (app.identity || {}).banner_shape || 'rounded',
        bannerDepth: (app.identity || {}).banner_depth,
        logo: (app.identity && app.identity.picture) || (_brand && _brand.mark) || '', layout: (app.identity && app.identity.layout) || '',
        avatarShape: (app.identity && app.identity.shape) || 'rounded', hue: hue,
        avatarFit: (!(app.identity && app.identity.picture) && _brand && _brand.mark) ? 'contain' : '',
        /* ══ THE ONE LINK BAR — universal on every Center (442 addendum) ═══
           Its website, its platforms (recognised from the URL, drawn as the
           platform's own mark), then Events and Directions as icons. Nothing
           is drawn when there is nothing. */
        links: (function () {
          if (!OW.links) return null;
          var idn = app.identity || {};
          var raw = [];
          (idn.links || []).forEach(function (l) { raw.push(l); });
          var extra = [];
          if (_upN > 0) {
            extra.push({ key: 'events', name: 'Events', onPress: function () {
              if (host.__owShowTab) host.__owShowTab('today');   /* the Events tab's id */
            } });
          }
          var bar = OW.links.bar(raw, extra, { words: true });
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
            /* DIRECTIONS IS A ROW OF THE RIGHT-HAND BLOCK (founder, 2026-10-16: "Location: Directions: then THE LOGO OF THE
               CONNECTED APP ... Category: all directly on top and below each other ... on the RIGHT SIDE"). It names the map app
               it opens and wears that app's mark: Apple Maps where Apple Maps is the phone's own app (iPhone, iPad), Google
               Maps everywhere else, a desktop Mac included (maps:// there did nothing). */
            var ua = global.navigator.userAgent || '';
            var apple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (global.navigator.maxTouchPoints || 0) > 1);
            var MARK = apple
              ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#34c759"/><path d="M1 15 L23 9 V17 A6 6 0 0 1 17 23 H7 A6 6 0 0 1 1 17Z" fill="#f2f2f7"/><path d="M12 5.5 17 17.5 12 15.2 7 17.5Z" fill="#0a84ff"/></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 13.5 7.5 13.5s7.5-8.1 7.5-13.5A7.5 7.5 0 0 0 12 1.5z" fill="#ea4335"/><path d="M4.9 6.6 12 1.5A7.5 7.5 0 0 0 4.9 6.6z" fill="#4285f4"/><path d="M19.1 6.6A7.5 7.5 0 0 0 12 1.5L9 4.2z" fill="#fbbc04"/><path d="M12 22.5s3.6-3.9 5.7-7.8L7.8 10.4C9.1 14.6 12 22.5 12 22.5z" fill="#34a853"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>';
            var row = doc.createElement('span');
            row.className = 'ow-ocard__detail ow-prof__dir'; row.title = 'Directions';
            var go = doc.createElement('button');
            go.type = 'button'; go.className = 'ow-prof__dirgo';
            go.setAttribute('aria-label', 'Directions in ' + (apple ? 'Apple Maps' : 'Google Maps'));
            go.innerHTML = MARK + '<span>' + (apple ? 'Apple Maps' : 'Google Maps') + '</span>';
            go.addEventListener('click', function () {
              if (apple) { try { global.location.href = 'maps://?daddr=' + dest; return; } catch (_) {} }
              global.open(href, '_blank', 'noopener');
            });
            row.appendChild(go);
            var information = host.querySelector('.ow-prof__details');
            if (information) {
              information.insertBefore(row, information.querySelector(':scope > .ow-linkbar'));
              if (OW.profileInformationOrder) OW.profileInformationOrder(information);
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


  /* the real surface replaces its stub: wrap it again in what it reads while it builds */
  if (OW.lazyAfterLibrary) OW.lazyAfterLibrary();
})(window);
