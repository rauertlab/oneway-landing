/* THE ACCOUNT PAGES: settings, appearance, understanding, activity, places, memories, calendar, notifications.
   Moved whole from frontend/app/popit-live.js by tools/boot_split.mjs (the boot split, PLAN §2 App boot row):
   oneway-app.html loads it with OW.need('account') when its screen first opens; index.html loads it by tag. */
(function (global) {
  'use strict';
  var OW = global.OW;
  var _u = OW._u;
  var brainAsk = _u.brainAsk,
      data = _u.data,
      doc = _u.doc,
      esc = _u.esc,
      factList = _u.factList,
      imageUrl = _u.imageUrl,
      leaving = _u.leaving,
      loading = _u.loading,
      mk = _u.mk,
      nothing = _u.nothing,
      openCenterPopit = _u.openCenterPopit,
      openEventScreen = _u.openEventScreen,
      postPayload = _u.postPayload,
      refused = _u.refused,
      sentence = _u.sentence,
      setIcon = _u.setIcon,
      toldOnce = _u.toldOnce,
      whenWords = _u.whenWords;


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
          /* WHAT THE SERVER DID NOT KEEP IS SAID, in its own words (founder/660): a 25th
             widget was dropped while the screen showed it chosen */
          var notKept = ((r.data && r.data.refused) || []).map(function (x) { return x && x.words; }).filter(Boolean);
          if (notKept.length && OW.toast) OW.toast(spoken(notKept.join(' · ')));
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
          + 'Oneway does not read your location.'));
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
          opportunities: ['What people ask for', 'Platform moderators see requests Oneway does not meet yet, never who asked.'],
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
      ['activity_status', 'Show when you are active', 'Let other people see that you are online in Oneway.']
    ]],
    ['Notifications', [
      ['push_notifs', 'Push notifications', 'Mentions, messages, community activity.'],
      ['mention_notifs', 'When someone mentions you', 'Notify you when someone mentions you.'],
      ['email_digest', 'Weekly email summary', 'Receive a weekly summary by email. Off stops the summary emails.']
    ]],
    ['Preferences', [
      ['personalized', 'Personalised discovery',
       'Use the people and places you are connected to when choosing Discovery recommendations.'],
      ['reduce_motion', 'Reduce motion',
       'Reduce interface animations without changing what you can do.']
    ]]
  ];

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
          var fld = mk('div', 'ow-you__f');
          var fieldLabel = mk('label', 'ow-you__lbl', esc(label));
          fieldLabel.htmlFor = 'ow-you-' + key; fld.appendChild(fieldLabel);
          var el = doc.createElement(kind === 'area' ? 'textarea' : 'input');
          el.id = 'ow-you-' + key;
          el.className = 'ow-you__in';
          el.setAttribute('data-you', key);
          if (kind === 'area') { el.rows = 3; }
          else { el.type = (kind === 'date' ? 'date' : (kind === 'url' ? 'url' : 'text')); }
          el.maxLength = f[4];
          if (f[3]) el.placeholder = f[3];
          el.value = f[5];
          var said = mk('span', 'ow-you__say', '');
          said.setAttribute('role', 'status');
          var save = mk('button', 'ow-setting-save', 'Save'); save.type = 'button'; save.disabled = true;
          save.setAttribute('aria-label', 'Save ' + label.toLowerCase());
          var was = el.value, busy = false;
          function paintSave() { save.disabled = busy || el.value.trim() === was; save.textContent = busy ? 'Saving...' : 'Save'; }
          function commit() {
            var v = el.value.trim();
            if (busy || v === was) return;
            busy = true; el.readOnly = true; paintSave();
            said.textContent = 'Saving…';
            said.setAttribute('data-s', 'busy');
            var body = {}; body[key] = v;
            data.patch('/api/oneway/people/me', body, { queueable: true }).then(function (rr) {
              if (rr && rr.queued) {
                /* WRITTEN DOWN, NOT YET SENT (PLAN G6): the field keeps what was typed, says where it is, and every surface that
                   draws this person redraws; it says "Saved" when the server has it, and says why if the server refuses it. */
                var prev = was;
                was = v;
                said.textContent = 'Saved on this device';
                said.setAttribute('data-s', 'ok');
                try { doc.dispatchEvent(new CustomEvent('ow:profile-changed', { detail: { email: me.email } })); } catch (e) {}
                OW.outbox.watch(rr.pending_id,
                  function () { said.textContent = v ? 'Saved' : 'Cleared'; },
                  function (words) { was = prev; said.textContent = words; said.setAttribute('data-s', 'bad'); paintSave(); });
                return;
              }
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
            }).catch(function () {
              said.textContent = 'Not saved';
              if (OW.toast) OW.toast(label + ' did not save. Try again.');
            }).finally(function () { busy = false; el.readOnly = false; paintSave(); });
          }
          save.addEventListener('click', commit);
          el.addEventListener('input', function () {
            said.textContent = el.value.trim() === was ? '' : 'Unsaved changes';
            said.removeAttribute('data-s');
            paintSave();
          });
          fld.appendChild(el);
          fld.appendChild(save);
          fld.appendChild(said);
          if (key === 'birthday') {
            fld.appendChild(mk('span', 'ow-you__why',
              'Only you see this. It never leaves Oneway with your profile.'));
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
        /* ══ WHAT YOUR PROFILE IS MISSING (founder/737; PROPOSED, for his eye) ═══════════════════════════════════
           A profile filled in is the one the platform shows first, and the platform helps a person fill it in. What
           counts is the one score's (standing), read through GET /api/oneway/people/me/missing now, so what was just
           filled in is gone from it: heaviest first, each a press that goes to where it is filled in, a field on this
           page or Appearance for the picture and the banner. Read again whenever a field here saves (S22). Nothing is
           drawn when nothing is missing or the profile is private; without a username, it says to choose one. */
        var miss = mk('div', 'ow-you__miss');
        miss.hidden = true;
        miss.style.margin = '4px 0 16px';
        var FIELD_OF = { name: 'display_name', bio: 'bio', place: 'location', link: 'website' };
        function goTo(m) {
          var f = m.page === 'profile' && FIELD_OF[m.id] && grid.querySelector('[data-you="' + FIELD_OF[m.id] + '"]');
          if (f) { try { f.scrollIntoView({ block: 'center' }); } catch (_) {} f.focus(); return; }
          /* another Settings page opens as its own row does (the row's press: openPage), from the page already open */
          var go = m.page && doc.querySelector('.ow-set__row[data-set="' + m.page + '"]');
          if (go) { go.click(); return; }
          if (m.page) global.location.hash = '#settings/' + m.page;
        }
        function drawMissing() {
          data.get('/api/oneway/people/me/missing').then(function (r) {
            var j = (r && r.ok && r.data) || null;
            var items = (j && j.measured && j.missing) || [];
            var ask = j && !j.measured && j.page ? [{ id: j.page, label: 'Choose a username', page: j.page }] : [];
            miss.innerHTML = '';
            if (!items.length && !ask.length) { miss.hidden = true; return; }
            miss.appendChild(mk('span', 'ow-you__why', esc(items.length
              ? 'Profiles that are filled in are shown first. Yours is missing:' : (j.why || ''))));
            var acts = mk('div', 'ow-swatches ow-choice');
            (items.length ? items : ask).forEach(function (m) {
              var b = mk('button', 'po-act', esc(m.label)); b.type = 'button';
              b.setAttribute('data-missing', m.id);
              b.addEventListener('click', function () { goTo(m); });
              acts.appendChild(b);
            });
            miss.appendChild(acts);
            miss.hidden = false;
          });
        }
        function onChanged() {                  /* read again after a save here; a page closed since stops listening */
          if (!miss.isConnected) { doc.removeEventListener('ow:profile-changed', onChanged); return; }
          drawMissing();
        }
        doc.addEventListener('ow:profile-changed', onChanged);
        row.appendChild(miss);
        drawMissing();
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
      /* ── THE LOOK MENU, THE OS'S OWN (founder/863, 2026-10-21: "brought to app in place of current lackluster option. exact
         menu"). The theme (Light, Dark, Match device) and, for each theme, its cards and its background, each a tile that shows the
         room it makes: frontend/shared/oneway-lookmenu.js, the one component the OS's Appearance draws too, written through the
         App's own writers (OW.theme, OW.simple, OW.world, kept on the account by OW.look.save). It replaces the Theme segments and
         the Light mode and Dark mode rows that stood here. */
      (function () {
        var T = global.OW && global.OW.theme, S = global.OW && global.OW.simple, W = global.OW && global.OW.world;
        var row = mk('div', 'ow-cust__row ow-cust__row--stack ow-lm-host');
        /* its name for Settings' Appearance page, which gathers its rows by this label (move: ['Theme']); the tiles say it themselves */
        row.appendChild(mk('span', 'ow-cust__lbl ow-lm-lbl', 'Theme'));
        if (!(global.OW && OW.lookMenu) || !T || !S || !W) {
          row.appendChild(mk('span', 'po-acts__wait', 'The theme menu did not load. Reload the page.'));
          box.appendChild(row); n++;
          return;
        }
        var inner = mk('div', 'ow-lm-in'); row.appendChild(inner);
        var lm = OW.lookMenu.mount(inner, {
          read: function () { return { theme: T.get() || '', simple: function (t) { return !!(S.of && S.of(t)); }, world: function (t) { return W.of ? W.of(t) : (t === 'light' ? 'plain' : 'galaxy'); } }; },
          theme: function (v) { T.set(v || null); },
          cards: function (t, simple) { S.setFor(t, simple); if (global.OW && OW.look) OW.look.save(); },
          world: function (t, w) { W.setFor(t, w); if (global.OW && OW.look) OW.look.save(); }
        });
        /* the account's look can arrive after this page is drawn (a fresh device): drawn again when it does */
        try { document.addEventListener('ow:look', function () { if (row.isConnected) lm.paint(); }); } catch (e) {}
        /* Match device follows the device while the App is open, not only at boot (the rule the Theme row kept) */
        try {
          var mq = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)');
          if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!T.get()) T.set(null); });
        } catch (e) {}
        box.appendChild(row);
        n++;
      })();

      /* WHICH SUBSCRIPTION IS YOURS, named so it cannot be mistaken for the
         other one (founder, 2026-08-02). ONEWAY+ is a PERSON's subscription;
         Oneway Business OS is a CENTER's operating tier, bought per Center and
         shown in the OS. Its name is the server's (`center_tier_label`, from
         capabilities/tiers), never spelled here; without it the sentence is
         left out rather than guessed. Status only — it reports what the
         runtime knows and promises nothing the runtime does not enforce. */
      if (pl.ok && pl.data) {
        var plus = mk('div', 'ow-cust__row');
        plus.appendChild(mk('span', 'ow-cust__lbl', 'Your subscription'));
        var card = mk('div', 'ow-switch');
        card.setAttribute('aria-pressed', String(!!pl.data.plus));
        card.style.cursor = 'default';
        var feats = (pl.data.features || []).map(function (f) { return esc(f); });
        card.innerHTML = '<span class="ow-switch__b"><b>'
          + (pl.data.plus ? 'Oneway+' : 'Oneway+ — not subscribed') + '</b>'
          + '<span>' + (pl.data.plus
              ? feats.join(' · ')
              : 'Your personal subscription and the features included with it.'
                + (pl.data.center_tier_label ? ' Different from '
                  + esc(pl.data.center_tier_label) + ', which a Center buys to operate.' : ''))
          + '</span></span>';
        plus.appendChild(card);
        box.appendChild(plus);
        n++;
      }

      function save(key, val, row) {
        var patch = {}; patch[key] = val;
        return data.post('/api/me/settings', { settings: patch },
          { method: 'PUT', queueable: key.indexOf('workplace_') !== 0 })
          .then(function (res) {
            if (res.queued) {
              /* WRITTEN DOWN, NOT YET SENT (PLAN G6): the switch keeps the state the person chose, takes effect on this screen
                 now, says it is waiting, and goes back only if the server refuses it later. */
              row.disabled = false;
              row.setAttribute('data-pending', '1');
              if (key === 'reduce_motion') doc.documentElement.setAttribute('data-motion', val ? 'reduced' : 'full');
              if (OW.applyPrefs) OW.applyPrefs(Object.assign({}, cur || {}, patch));
              OW.outbox.watch(res.pending_id,
                function () { row.removeAttribute('data-pending'); },
                function (words) {
                  row.removeAttribute('data-pending');
                  row.setAttribute('aria-pressed', String(!val));
                  if (OW.applyPrefs) OW.applyPrefs(Object.assign({}, cur || {}));
                  if (OW.toast) OW.toast('That setting did not change. ' + words);
                });
              toldOnce();
              return;
            }
            if (!res.ok) {
              /* put it back and say so — never leave a switch showing a state
                 the server refused */
              row.setAttribute('aria-pressed', String(!val));
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
        /* a switch only for a setting that is on or off: one with a value of its own (quiet hours) has its own control in the OS */
        var rows = grp[1].filter(function (s) { return s[0] in cur && typeof cur[s[0]] === 'boolean'; });
        if (!rows.length) return;          /* a setting the runtime lacks is absent */
        var sec = mk('div', 'ow-cust__row');
        sec.appendChild(mk('span', 'ow-cust__lbl', esc(grp[0])));
        rows.forEach(function (s) {
          var key = s[0];
          var row = mk('button', 'ow-switch');
          row.type = 'button';
          row.setAttribute('data-setting-key', key);
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
            while_using: 'Only while I am using Oneway',
            always: 'In the background too, even when Oneway is closed'
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
                  esc('We could not load your ' + slug + ' accounts. Reopen this page to try again.')));
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
                OW.cards.fill(av, { kind: 'person', name: em });   /* founder/495 */
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

  /* `opts.look` is Settings' one Appearance page: it already draws theme, plain background and simple mode, so this
     panel leaves out its own Theme, World and Layout rows there and draws only the person's own look. */
  function appearance(host, style, email, opts) {
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
      return data.post('/api/oneway/people/me/style', { style: body }, { method: 'PUT', queueable: true })
        .then(function (r) {
          if (r.queued) {
            /* WRITTEN DOWN, NOT YET SENT (PLAN G6): the choice already shows on this screen; it is saved to the account when the
               network is back, and the person is told if the server refuses it. */
            OW.outbox.watch(r.pending_id, null, function (words) {
              if (OW.toast) OW.toast('That did not save to your account — it shows only on this device. ' + words);
            });
            toldOnce();
            data.invalidate('/api/oneway/people/');
            return r;
          }
          /* the server is the authority on what it kept — and it now reports
             what it refused, so a dropped field is visible instead of silent */
          if (r.ok && r.data && r.data.style) {
            Object.keys(r.data.style).forEach(function (k) { style[k] = r.data.style[k]; });
          }
          /* and what it refused is said, in the server's own words — it reported them and
             nothing read them, so a 13th banner vanished in silence (founder/660) */
          var notKept = ((r.ok && r.data && r.data.refused) || []).map(function (x) { return x && x.words; }).filter(Boolean);
          if (notKept.length && OW.toast) OW.toast(spoken(notKept.join(' · ')));
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
    function choiceRow(label, options, read, write, description) {
      var row = mk('div', 'ow-cust__row');
      row.appendChild(mk('span', 'ow-cust__lbl', label));
      var group = mk('div', 'ow-swatches ow-choice');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', label);
      var progress = mk('span', 'ow-setting-progress', '');
      progress.setAttribute('role', 'status');
      function paintChoices() {
        Array.prototype.forEach.call(group.children, function (button) {
          var selected = button.getAttribute('data-choice') === String(read());
          button.setAttribute('aria-pressed', String(selected));
          if (selected) button.setAttribute('data-act', 'on');
          else button.removeAttribute('data-act');
        });
      }
      options.forEach(function (o) {
        var b = mk('button', 'po-act', o.label);
        b.type = 'button';
        b.setAttribute('data-choice', o.value);
        b.setAttribute('aria-pressed', String(read() === o.value));
        b.addEventListener('click', function () {
          if (read() === o.value || group.getAttribute('aria-busy') === 'true') return;
          var result;
          try { result = write(o.value); }
          catch (_) { if (OW.toast) OW.toast('That setting did not change. Try again.'); paintChoices(); return; }
          if (!result || typeof result.then !== 'function') { paintChoices(); progress.textContent = label + ': ' + o.label + ' applied'; return; }
          group.setAttribute('aria-busy', 'true');
          Array.prototype.forEach.call(group.children, function (x) { x.disabled = true; });
          progress.textContent = 'Saving ' + label.toLowerCase() + '...';
          Promise.resolve(result).then(function (answer) {
            if (answer === false || (answer && answer.ok === false)) throw new Error('Not saved');
            progress.textContent = answer && answer.queued ? 'Saved on this device; waiting to sync' : label + ': ' + o.label + ' saved';
          }).catch(function () {
            progress.textContent = 'Not saved';
            if (OW.toast) OW.toast('That setting did not change. Try again.');
          }).finally(function () {
            group.removeAttribute('aria-busy');
            Array.prototype.forEach.call(group.children, function (x) { x.disabled = false; });
            paintChoices();
          });
        });
        if (read() === o.value) b.setAttribute('data-act', 'on');
        group.appendChild(b);
      });
      row.appendChild(group);
      row.appendChild(progress);
      if (description) row.appendChild(mk('p', 'ow-door__why', esc(description)));
      box.appendChild(row);
    }

    /* LIGHT · DARK · DEVICE. "Device" is a real third answer — it means follow
       the phone — and clearing the stored choice is how it is expressed, which
       is why it cannot be a two-way switch. */
    if (!(opts && opts.look)) {
      /* THE LOOK MENU, THE OS'S OWN (founder/863): the theme, and each theme's cards and background, as tiles that show the room
         each makes (frontend/shared/oneway-lookmenu.js), written through the App's own writers. It replaces the Theme choice and
         the Light mode and Dark mode rows that stood here. */
      (function () {
        var T = global.OW && global.OW.theme, S = global.OW && global.OW.simple, W = global.OW && global.OW.world;
        var row = mk('div', 'ow-cust__row ow-cust__row--stack ow-lm-host');
        if (!(global.OW && OW.lookMenu) || !T || !S || !W) { row.appendChild(mk('span', 'po-acts__wait', 'The theme menu did not load. Reload the page.')); box.appendChild(row); return; }
        var lm = OW.lookMenu.mount(row, {
          read: function () { return { theme: T.get() || '', simple: function (t) { return !!(S.of && S.of(t)); }, world: function (t) { return W.of ? W.of(t) : (t === 'light' ? 'plain' : 'galaxy'); } }; },
          theme: function (v) { T.set(v || null); },
          cards: function (t, simple) { S.setFor(t, simple); if (global.OW && OW.look) OW.look.save(); },
          world: function (t, w) { W.setFor(t, w); if (global.OW && OW.look) OW.look.save(); }
        });
        try { document.addEventListener('ow:look', function () { if (row.isConnected) lm.paint(); }); } catch (e) {}
        box.appendChild(row);
      })();
    }

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
      row.appendChild(mk('span', 'ow-cust__lbl', 'Name font'));
      row.appendChild(mk('p', 'ow-door__why', 'Changes how your name appears on your profile and posts.'));
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
      var colourNames = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Mint', 'Teal', 'Sky blue', 'Blue', 'Violet', 'Magenta', 'Rose'];
      b.setAttribute('aria-label', colourNames[Math.round(angle / 30) % colourNames.length]);
      b.title = b.getAttribute('aria-label');
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

    /* THE APP ICON, SEEN WHERE THE COLOUR IS CHOSEN (founder/800: "the user's hue galaxy in the background ... Seen,
       seen on the app"). The icon the home screen wears is the globe on this colour's galaxy, and in dark mode the
       globe alone in this colour (tools/apple_icons.py draws both for the Apple app; the shell sets them, and iOS
       turns to the dark one by itself). Drawn here from the same light the page wears, so a colour picked above is
       the icon seen at once. */
    var rowIcon = mk('div', 'ow-cust__row');
    rowIcon.appendChild(mk('span', 'ow-cust__lbl', 'App icon'));
    var icons = mk('div', 'ow-appicon');
    [['main', 'Light'], ['dark', 'Dark']].forEach(function (look) {
      var fig = mk('span', 'ow-appicon__f');
      var tile = mk('span', 'ow-appicon__i');
      tile.setAttribute('data-look', look[0]);
      tile.innerHTML = (OW.links && OW.links.globe) ? OW.links.globe() : '';
      fig.appendChild(tile);
      fig.appendChild(mk('span', 'ow-appicon__cap', look[1]));
      icons.appendChild(fig);
    });
    function paintIcons() {
      var cs = getComputedStyle(document.documentElement);
      var h1 = cs.getPropertyValue('--ow-h1').trim(), h2 = cs.getPropertyValue('--ow-h2').trim();
      if (h1) icons.style.setProperty('--ai1', h1);
      if (h2) icons.style.setProperty('--ai2', h2);
    }
    paintIcons();
    window.addEventListener('ow:hue', function () { setTimeout(paintIcons, 480); });
    Array.prototype.forEach.call(sw.children, function (b) {
      b.addEventListener('click', function () { setTimeout(paintIcons, 480); });
    });
    pick.addEventListener('input', function () { setTimeout(paintIcons, 60); });
    rowIcon.appendChild(icons);
    box.appendChild(rowIcon);

    /* ── THE PROFILE PICTURE — theirs, uploaded, placed in its circle (founder/831) ─────────────────────────────
       Settings' "Add a profile picture" (GET /api/oneway/people/me/missing, page "appearance") pointed here and
       there was nothing here to add one with. The picture opens in the editor in the circle every face on Oneway is
       drawn in, leaves at 1080 by 1080, goes through the one media writer (POST /api/oneway/media) and becomes the
       face through the one person door (PATCH /api/oneway/people/me, which holds it to the person's own upload and
       320 by 320 at least). Every face of theirs on the page is drawn again at once. */
    (function pictureRow() {
      var row = mk('div', 'ow-cust__row');
      row.setAttribute('data-row', 'picture');
      row.appendChild(mk('span', 'ow-cust__lbl', 'Profile picture'));
      var line = mk('div', 'ow-cust__face');
      line.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap';
      var face = mk('span', 'ow-dest__face');
      face.setAttribute('data-shape', 'round');
      line.appendChild(face);
      var pup = mk('label', 'ow-upload', '<span></span>');
      pup.style.alignSelf = 'center';
      var pin = doc.createElement('input');
      pin.type = 'file'; pin.accept = 'image/*';
      pup.appendChild(pin);
      line.appendChild(pup);
      var drop = mk('button', 'po-act', 'Remove');
      drop.type = 'button';
      line.appendChild(drop);
      var said = mk('span', 'ow-setting-progress', '');
      said.setAttribute('role', 'status');
      row.appendChild(line);
      row.appendChild(said);
      row.appendChild(mk('p', 'ow-door__why',
        'Shown in a circle everywhere on Oneway. You place it in the circle before it is saved.'));
      function paintFace() {
        var pic = style.personPicture || '';
        if (OW.cards && OW.cards.fill) OW.cards.fill(face, { kind: 'person', name: style.personName || '', picture: pic });
        pup.firstChild.textContent = pic ? 'Change picture' : 'Upload a picture';
        drop.hidden = !pic;
        drop.textContent = 'Remove';
        drop.removeAttribute('data-armed');
      }
      function everywhere(url) {
        style.personPicture = url;
        paintFace();
        data.invalidate('/api/oneway/people/');
        ['/api/oneway/cards', '/api/oneway/home', '/api/oneway/social/'].forEach(function (p) { data.invalidate(p); });
        try { doc.dispatchEvent(new CustomEvent('ow:profile-changed', { detail: { email: email, picture: url } })); } catch (_) {}
      }
      function wear(dataUrl) {
        return data.post('/api/oneway/media', { data: dataUrl, origin: 'uploaded' }).then(function (u) {
          var item = u && u.ok && u.data && u.data.media;
          if (!item || !item.url) return { ok: false, error: (u && u.error) || 'That picture did not upload. Try again.' };
          return data.patch('/api/oneway/people/me', { picture: item.url }).then(function (r) {
            if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'That picture did not save to your profile. Try again.' };
            return { ok: true, url: item.url };
          });
        });
      }
      pin.addEventListener('change', function () {
        var f = pin.files && pin.files[0]; pin.value = ''; if (!f) return;
        said.textContent = '';
        if (typeof OW.editMedia !== 'function') {
          /* a page without the editor sends the picture as it is; the person door still holds it to 320 by 320 */
          var fr = new FileReader();
          said.textContent = 'Uploading\u2026';
          fr.onload = function () {
            wear(String(fr.result || '')).then(function (r) {
              if (!r.ok) { said.textContent = r.error; return; }
              everywhere(r.url); said.textContent = 'Saved. This is your face everywhere on Oneway now.';
            });
          };
          fr.readAsDataURL(f);
          return;
        }
        OW.editMedia(f, { frame: 'profile', kinds: ['image'], save: function (res) { return wear(res.dataUrl); } })
          .then(function (res) {
            if (!res || !res.saved || !res.saved.url) return;
            everywhere(res.saved.url);
            said.textContent = 'Saved. This is your face everywhere on Oneway now.';
          });
      });
      /* TAKEN BACK IN TWO PRESSES, as a Center's picture is in the OS: the first says what the second will do */
      drop.addEventListener('click', function () {
        if (!drop.hasAttribute('data-armed')) {
          drop.setAttribute('data-armed', '1'); drop.textContent = 'Tap again to remove it';
          clearTimeout(drop.__t); drop.__t = setTimeout(paintFace, 4000);
          return;
        }
        clearTimeout(drop.__t);
        drop.disabled = true; drop.textContent = 'Removing…';
        data.patch('/api/oneway/people/me', { picture: '' }).then(function (r) {
          drop.disabled = false;
          if (!r || !r.ok) { paintFace(); said.textContent = (r && r.error) || 'That did not change. Try again.'; return; }
          everywhere('');
          said.textContent = 'Removed. Your initials show in your colour.';
        });
      });
      paintFace();
      box.appendChild(row);
    })();

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
    function tookBanner(url) {
      /* THE SERVER KEEPS TWELVE AND SAYS SO (founder/660): this trimmed to 12 here, so a 13th banner
         let the oldest go before the server saw it, and its words never reached the toast */
      style.banner_urls = [url].concat(style.banner_urls || []);
      style.banner_url = url; style.banner_customized = true;
      /* drawn at once, then drawn again from what the server kept, so the row never shows a 13th */
      paintPicks(); save({ banner_url: url, banner_customized: true }).then(function () { paintPicks(); });
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
    }
    function postBanner(dataUrl) {
      return data.post('/api/me/profile-banner', { data: dataUrl, kind: 'banner' }).then(function (r) {
        if (!r.ok || !(r.data || {}).url) return { ok: false, error: (r && r.error) || 'That banner did not upload. Try again.' };
        return { ok: true, url: r.data.url };
      });
    }
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      /* THE EDITOR OPENS AT THE UPLOAD (founder/831): the picture is placed in the banner's own 3:1 frame and sent at
         1500 by 500, the size it is shown at; Done uploads it with the editor still open, so a refusal is said there
         and the crop is kept. */
      if (typeof OW.editMedia === 'function') {
        OW.editMedia(f, { frame: 'banner', kinds: ['image'], save: function (res) { return postBanner(res.dataUrl); } })
          .then(function (res) { if (res && res.saved && res.saved.url) tookBanner(res.saved.url); });
        return;
      }
      up.setAttribute('data-busy', '1');
      up.firstChild.textContent = 'Uploading…';
      var fr = new FileReader();
      fr.onload = function () {
        postBanner(fr.result).then(function (r) {
          up.removeAttribute('data-busy');
          if (!r.ok) { up.firstChild.textContent = 'That did not upload'; return; }
          up.firstChild.textContent = 'Upload a banner';
          tookBanner(r.url);
        });
      };
      fr.readAsDataURL(f);
    });
    up.appendChild(inp);
    row2.appendChild(up);
    row2.appendChild(mk('p', 'ow-door__why',
      'Choose the image behind your profile. Changing it keeps your previous banners available here.'));
    box.appendChild(row2);

    choiceRow('Website picture shape', [
      { label: 'Circle', value: 'round' },
      { label: 'Rounded', value: 'rounded' },
      { label: 'Square', value: 'square' }
    ], function () { return style.personShape || 'round'; }, function (value) {
      return data.patch('/api/oneway/people/me', { shape: value }).then(function (r) {
        if (!r.ok) {
          if (OW.toast) OW.toast('That picture shape did not save to your account. Try again.');
          return;
        }
        style.personShape = value;
        ['/api/oneway/people/', '/api/oneway/cards', '/api/oneway/home', '/api/oneway/social/']
          .forEach(function (path) { data.invalidate(path); });
      });
    }, 'Your picture stays round on Oneway. This shape is for your own website.');

    choiceRow('Banner style', [
      { label: 'Fade', value: 'fade' },
      { label: 'Framed', value: 'framed' }
    ], function () { return style.banner_style || 'fade'; }, function (value) {
      var previous = style.banner_style || 'fade';
      style.banner_style = value;
      return save({ banner_style: value }).then(function (r) {
        if (!r.ok && !r.queued) style.banner_style = previous;
        var profile = doc.querySelector('.ow-prof[data-kind="person"]');
        if (profile) profile.setAttribute('data-banner-style', style.banner_style);
        data.invalidate('/api/oneway/cards');
        return r;
      }, function (err) { style.banner_style = previous; throw err; });
    }, 'Fade extends behind the top wordmark and icons. Framed keeps the banner in an outlined rectangle below them.');

    choiceRow('Banner corners', [
      { label: 'Rounded', value: 'rounded' },
      { label: 'Square', value: 'square' }
    ], function () { return style.banner_shape || 'rounded'; }, function (value) {
      var previous = style.banner_shape || 'rounded';
      style.banner_shape = value;
      return save({ banner_shape: value }).then(function (r) {
        if (!r.ok && !r.queued) style.banner_shape = previous;
        var profile = doc.querySelector('.ow-prof[data-kind="person"]');
        if (profile) profile.setAttribute('data-banner-shape', style.banner_shape);
        data.invalidate('/api/oneway/cards');
        return r;
      }, function (err) { style.banner_shape = previous; throw err; });
    }, 'Changes the corners of a framed banner. Fade banners remain edge to edge.');

    /* WHERE THE PICTURE SITS (S21; the founder, 2026-10-10: "people should choose if they want their profile on top of
       their name like tiktok or to the left of it like instagram"). One switch; the card every surface draws reads it
       (api/oneway/cards, `layout`). Shape is an independent choice above in this same Appearance setting. */
    var row3 = mk('div', 'ow-cust__row ow-cust__row--display-toggle');
    row3.appendChild(mk('span', 'ow-cust__lbl', 'Picture above your name'));
    var pos = mk('button', 'ow-switch');
    pos.type = 'button';
    function paintPos(above) {
      pos.setAttribute('aria-pressed', above ? 'true' : 'false');
      pos.innerHTML = '<span class="ow-switch__b"><b>Picture above your name</b><span>'
        + 'On places your profile picture above your name. Off places it beside your name.'
        + '</span></span><span class="ow-switch__k" aria-hidden="true"></span>';
    }
    paintPos(style.picture_position === 'above');
    pos.addEventListener('click', function () {
      var next = style.picture_position === 'above' ? 'beside' : 'above';
      style.picture_position = next; paintPos(next === 'above');
      save({ picture_position: next });
    });
    row3.appendChild(pos);
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
  /* the server's words are fragments made to be joined; a toast reads as a sentence, capital and stop */
  function spoken(t) { t = sentence(t); return t.charAt(0).toUpperCase() + t.slice(1); }

  function ownStyle() {
    return Promise.all([
      data.get('/api/oneway/people/me/style'),
      data.get('/api/oneway/people/me')
    ]).then(function (rs) {
      var style = (rs[0].ok && rs[0].data && rs[0].data.style) || {};
      var shape = rs[1].ok && rs[1].data && rs[1].data.shape;
      Object.defineProperty(style, 'personShape', {
        value: /^(round|rounded|square)$/.test(shape || '') ? shape : 'round', writable: true
      });
      /* THE FACE, beside the style and not in it (not enumerable, so save() never sends it through the style door) */
      var pic = rs[1].ok && rs[1].data && rs[1].data.picture;
      Object.defineProperty(style, 'personPicture', { value: (pic && (pic.url || pic)) || '', writable: true });
      Object.defineProperty(style, 'personName', { value: (rs[1].ok && rs[1].data && rs[1].data.display_name) || '', writable: true });
      return style;
    }).catch(function () { return {}; });
  }

  /* ── THE BELL'S LIST: ITS SECTIONS, ITS FOLDING, ITS ROW (founder/866, 871) ─────────────────────────────────── */
  /* EVERY MARK IS THE APP'S OWN (founder, 2026-10-21: "icons that match the icons on side bar"): the settings and side
     bar's outline set (OW.setIcon) first, then the feed's (OW.glyph: the like, the comment, the call), the same 24-unit
     grid and stroke as the dock. Never a set of its own. */
  function iconOf(name) {
    var a = OW.setIcon ? OW.setIcon(name) : '';
    if (a && /<(path|circle|rect)/.test(a)) return a;
    return (OW.glyph && OW.glyph(name)) || '';
  }
  /* the App's own rows (nobody did them): what kind of thing it is */
  function noteMark(kind) {
    var k = String(kind || '');
    if (/^(signed_in|account_|copyright|supervision)/.test(k)) return iconOf('shield');
    if (/^places_near/.test(k)) return iconOf('pin');
    if (/^(daily_limit|alerts_paused|shift_soon|work_due|follow_up_due|license_|warranty_|time_corrected)/.test(k)) return iconOf('clock');
    if (/^(event_|book|waitlist|lease_|host_guest)/.test(k)) return iconOf('calendar');
    if (/^(payments_|pickup_|drawing_won)/.test(k)) return iconOf('cart');
    if (/^(stock_|asset_|data_ready)/.test(k)) return iconOf('inbox');
    if (/^(work_|vendor_job|tech_on_way|assigned|decision_|room_check|sent_back)/.test(k)) return iconOf('check');
    if (/^(messaged|message_request)/.test(k)) return iconOf('chat');
    return iconOf('bell');
  }
  /* a person's row: what they did, as a small mark on their face (Facebook's and LinkedIn's way) */
  function noteBadge(kind) {
    var k = String(kind || '');
    if (/^(liked|disliked)$/.test(k)) return iconOf(OW.likes && OW.likes.glyph ? OW.likes.glyph() : 'heart');
    if (k === 'commented') return iconOf('talk');
    if (/^(messaged|message_request)$/.test(k)) return iconOf('chat');
    if (k === 'followed') return iconOf('person');
    if (/^(calling|call_waiting)$/.test(k)) return iconOf('phone');
    if (k === 'mentioned') return iconOf('at');
    if (k === 'reposted') return iconOf('repost');
    if (k === 'saved') return iconOf('bookmark');
    if (/^(joined|invited|join_)/.test(k)) return iconOf('people');
    return '';
  }
  /* New is what is unread; then by when, the way Instagram's Activity reads */
  function sectionOf(n) {
    if (!(n.read || n.seen)) return 'New';
    var t = Date.parse(n.created_at || n.at || '');
    if (!isFinite(t)) return 'Earlier';
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    if (t >= d0.getTime()) return 'Today';
    if (t >= d0.getTime() - 6 * 86400000) return 'This week';
    return 'Earlier';
  }
  function shortWhen(iso) {
    var t = Date.parse(iso || '');
    if (!isFinite(t)) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 7 * 86400) return Math.floor(s / 86400) + 'd';
    return Math.floor(s / (7 * 86400)) + 'w';
  }
  /* THE SAME THING DONE BY SEVERAL PEOPLE IS ONE ROW ("Bo and 3 others liked your post"), within one section, as
     Instagram folds likes; one person doing the same thing again is one row too ("· 3 times"), and one person's messages
     in one conversation are one row ("· 7 messages", the newest said). Never across sections, which would move somebody's
     history. A follow stays its own row (each offers Follow back); a call or anything that needs an answer is never folded. */
  var FOLDS = /^(liked|disliked|reposted|saved|commented|joined|mentioned)$/;
  function foldOthers(rows) {
    var out = [], at = {};
    rows.forEach(function (n) {
      var who = String((n.actor && (n.actor.ref || n.actor.name)) || '');
      var key = FOLDS.test(n.kind || '') ? sectionOf(n) + '|' + n.kind + '|' + (n.subject || '')
        : (n.kind === 'messaged' ? sectionOf(n) + '|messaged|' + (n.subject || '') + '|' + who : '');
      if (key && at[key]) {
        var f = at[key];
        if (f._who.indexOf(who) < 0) { f._who.push(who); f._others = f._who.length - 1; }
        else f._n = (f._n || 1) + 1;
        if (!(n.read || n.seen)) f.read = false;
        return;
      }
      var c = Object.assign({}, n, { _who: [who], _others: 0, _n: 1 });
      if (key) at[key] = c;
      out.push(c);
    });
    return out;
  }
  var CALL_RINGS_MS = 60000;      /* Answer only while a call can still be ringing (messaging/calls.py RING_SECONDS is 45) */
  var LIST_SETTLE_MS = 350;       /* the list is read again this long after the last notice of a burst */
  function noteRow(n, list) {
    var b = mk('div', 'ow-note');
    b.setAttribute('role', 'button'); b.tabIndex = 0;
    b.setAttribute('data-kind', String(n.kind || ''));
    var unread = !(n.read || n.seen);
    if (unread) b.setAttribute('data-unread', 'true');
    if (typeof n.seq === 'number') b.setAttribute('data-seq', String(n.seq));
    var a = n.actor || {};
    var person = /^@/.test(String(a.ref || ''));
    var name = String(a.name || '').trim();
    /* THE FACE: the person's own (picture, initials, their colour) or the App's mark in the reader's hue */
    var fw = mk('span', 'ow-note__fw');
    var face = mk('span', 'ow-note__face');
    face.setAttribute('aria-hidden', 'true');
    fw.appendChild(face);
    if (person) {
      face.setAttribute('data-person', '1');
      OW.cards.fill(face, { kind: 'person', name: name || a.ref || '?', picture: a.picture || '' }, { letters: 'i' });
      if (typeof a.hue === 'number' && OW.hue && OW.hue.fromAngle) {
        var hp = OW.hue.fromAngle(a.hue); face.style.setProperty('--h', hp[0]); face.style.setProperty('--h2', hp[1] || hp[0]);
      }
      var badge = noteBadge(n.kind);
      if (badge) {
        var bg = mk('span', 'ow-note__badge', badge);
        bg.setAttribute('data-k', String(n.kind || '')); bg.setAttribute('aria-hidden', 'true');
        fw.appendChild(bg);
      }
    } else {
      face.setAttribute('data-mark', '1');
      face.innerHTML = noteMark(n.kind);
    }
    b.appendChild(fw);
    /* THE WORDS: the name in bold, what they did (the server's own sentence), what they said, and when */
    var t = mk('span', 'ow-note__t');
    var line = String(n.line || n.text || n.body || n.title || n.kind || 'Something happened');
    var rest = line;
    if (person && name && line.indexOf(name) === 0) {
      t.appendChild(mk('b', 'ow-note__who', esc(name)));
      rest = line.slice(name.length);
      if (n._others) {
        var o = mk('span', 'ow-note__others', esc(' and ' + n._others + (n._others === 1 ? ' other' : ' others')));
        o.title = n._who.slice(1, 6).join(', ');
        t.appendChild(o);
      }
    }
    t.appendChild(doc.createTextNode(rest + (n._n > 1 && !n._others ? ' · ' + n._n + (n.kind === 'messaged' ? ' messages' : ' times') : '')));
    if (n.preview) t.appendChild(mk('span', 'ow-note__p', esc(': ' + String(n.preview).slice(0, 90))));
    var w = shortWhen(n.created_at || n.at || '');
    if (w) t.appendChild(mk('span', 'ow-note__w', esc(' ' + w)));
    b.appendChild(t);
    /* WHAT IT IS ABOUT, AT ITS END */
    var to = n.link || n.href || '';
    if (n.thumb) {
      var th = mk('span', 'ow-note__thumb');
      var im = doc.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      im.src = imageUrl ? imageUrl(n.thumb) : n.thumb;
      im.addEventListener('error', function () { th.remove(); }, { once: true });
      th.appendChild(im); b.appendChild(th);
    } else if (n.kind === 'followed' && person && n.you_follow === false) {
      var fb = mk('button', 'ow-note__act', 'Follow back'); fb.type = 'button';
      fb.addEventListener('click', function (ev) {
        ev.stopPropagation(); fb.disabled = true;
        data.post('/api/oneway/graph/follow/' + encodeURIComponent(a.ref), {}).then(function (r) {
          if (r && r.ok) { fb.textContent = 'Following'; fb.setAttribute('data-done', '1'); }
          else { fb.disabled = false; if (OW.toast) OW.toast((r && r.error) || 'That did not go through. Try again.'); }
        });
      });
      b.appendChild(fb);
    } else if (/^(calling|call_waiting)$/.test(n.kind || '') && to && Date.now() - Date.parse(n.created_at || '') < CALL_RINGS_MS) {
      var an = mk('button', 'ow-note__act', 'Answer'); an.type = 'button'; an.setAttribute('data-go', '1');
      an.addEventListener('click', function (ev) { ev.stopPropagation(); open(); });
      b.appendChild(an);
    }
    /* ONE CLICK, ONE READ (2026-09-21): the row drops its tint at once, every older one with it, and the bell re-reads its
       count; the domain stays the authority. A row that goes nowhere is no door (Rule 12). */
    function open() {
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
      if (to) { try { global.location.hash = to.replace(/^#/, '#'); } catch (e) {} }
    }
    if (to) {
      b.addEventListener('click', open);
      b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
    } else { b.setAttribute('aria-disabled', 'true'); b.tabIndex = -1; }
    return b;
  }

  OW.live.notifications = function (host, opts) {
    /* THE LIST CHANGES WHILE IT IS OPEN (S22; walk handpay-call, 2026-10-11): a notice that arrives while a person looks
       at their notifications is in the list at once (the bell already heard `ow:notifications-changed`; the list did not,
       so a slot attendant looking at it saw a hand-pay, or anyone a new follower, only after a reload). Read again,
       quietly: no loading flash. */
    if (!host.__owLiveList) {
      host.__owLiveList = true;
      /* A BURST IS ONE READ (founder/882: twenty notices arriving together read the list twenty times, each with every face and
         post picture, and the screen lagged behind them): the list is read again once the notices stop for a moment */
      var later = 0;
      var again = function () {
        if (!host.isConnected) { doc.removeEventListener('ow:notifications-changed', again); return; }
        global.clearTimeout(later);
        later = global.setTimeout(function () { if (host.isConnected) OW.live.notifications(host, { quiet: true }); }, LIST_SETTLE_MS);
      };
      doc.addEventListener('ow:notifications-changed', again);
    }
    if (!(opts && opts.quiet)) {
      host.className = '';
      host.innerHTML = '';
      loading(host, 3);
    }
    return data.get('/api/me/notifications', { fresh: true }).then(function (r) {
      host.innerHTML = '';
      if (!r.ok) { refused(host, r, 'Your notifications'); return 0; }
      var d = r.data || {};
      /* ══ THE BELL'S LIST, AS PEOPLE ALREADY KNOW IT (founder/866, 871: "no grey boxes needs to be more visual and
         standard") ══════════════════════════════════════════════════════════════════════════════════════════════
         Measured on the live list (the founder's screenshot, 2026-10-21): every row the same dark grey-purple box, every
         face an empty grey circle (the row started as a placeholder and was filled only when a picture loaded, so a
         person without one, and anyone whose read failed, stayed a blank), the App's own rows (a new sign-in, places near
         you, time today) with no mark, unread a small dot, and the read's two halves (needs_you, social) pasted one after
         the other, so the list was not even newest first. It is Instagram's Activity and iOS's list now:
           * one list, newest first, in New (unread), Today, This week and Earlier;
           * a person's row wears their real face (the read carries it, from the one face reader) or their initials in
             their colour; the App's own rows wear a mark in the person's hue (a shield, a pin, a clock, a calendar...);
           * the name in bold, what they did, what they said, and the time, inline;
           * at its end, what it is about: the post's picture, Follow back for a follow, Answer for a call;
           * unread is the row tinted in the person's hue, never a dot;
           * the same thing done by several people is one row: "Bo and 3 others liked your post".
         Simple draws clear rounded rows, Popit draws them as Popits in the hue (oneway-popit.css, NOTIFICATIONS 871). */
      var rows = (d.notifications || []).slice();
      if (!rows.length) rows = (d.needs_you || []).concat(d.social || []);
      rows.sort(function (a, b) { return (b.seq || 0) - (a.seq || 0); });
      if (!rows.length) {
        nothing(host, 'Likes, comments, follows and messages show up here.', 'Nothing yet');
        return 0;
      }
      var folded = foldOthers(rows);
      var list = mk('div', 'ow-notes ow-notes--std');
      var sec = '';
      folded.forEach(function (n) {
        var s = sectionOf(n);
        if (s !== sec) { sec = s; list.appendChild(mk('h3', 'ow-notes__h', esc(s))); }
        list.appendChild(noteRow(n, list));
      });
      host.appendChild(list);
      return rows.length;
    });
  };

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

      /* THE SECOND PAINT DOES NOT TOUCH WHAT IS ALREADY THERE (B, 2026-10-10: "clicking calendar in settings does
         nothing"). The list paints at once and paints again when the reads answer, and the second paint threw
         every row away. A press that began on a row of the first never became a click: the browser forgets the
         click's target the moment that node is removed, even if it is put straight back (measured: the row was
         the same node, in the document, and the press still did nothing). So the menu, the list, the sections,
         the rows, the search box and Log out are made once; a later paint writes values into them, sets what a
         row does (`el.__ow`), drops the rows that are no longer wanted and adds the new ones, and moves nothing
         that is already in its place. */
      var menu = carry.menu, page = carry.pageEl, list = carry.list, q = carry.q;
      var first = !(menu && page && list && q && menu.parentNode === host && page.parentNode === host);
      if (first) {
        host.className = ''; host.innerHTML = '';
        host.classList.add('ow-set');
        menu = mk('div', 'ow-set__menu');
        page = mk('div', 'ow-set__page'); page.hidden = true;
        host.appendChild(menu); host.appendChild(page);

        /* ── THE LIST ─────────────────────────────────────────────────────── */
        menu.appendChild(mk('h1', 'ow-set__h', 'Settings and privacy'));
        var sb = mk('label', 'ow-set__search');
        sb.innerHTML = setIcon('search');
        q = doc.createElement('input');
        q.type = 'search'; q.placeholder = 'Search settings';
        q.setAttribute('aria-label', 'Search settings');
        sb.appendChild(q); menu.appendChild(sb);
        list = mk('div', 'ow-set__list'); menu.appendChild(list);
        carry.menu = menu; carry.pageEl = page; carry.list = list; carry.q = q;
        carry.secs = {}; carry.rows = {}; carry.outSec = null; carry.none = null;
      }
      var kept = carry.rows;
      /* make `parent` hold exactly `want`, in that order, without removing or moving a node that is already placed */
      function settle(parent, want) {
        var keep = new global.Set(want);
        Array.prototype.slice.call(parent.childNodes).forEach(function (c) { if (!keep.has(c)) parent.removeChild(c); });
        var ref = parent.firstChild;
        want.forEach(function (n) { if (n === ref) ref = ref.nextSibling; else parent.insertBefore(n, ref); });
      }

      var GROUPS = [
        /* ── ONE APPEARANCE PAGE, FIRST (the founder, 2026-10-10: "both appearance and your banner color and
           popits should be combined into one Clean condensed layout appearance settings tab and be one of the
           more prominent things in settings"). Theme, plain background, simple mode, the logos, hearts or thumbs,
           and the person's own look (name face, colour, banner, avatar, what the profile shows) are one page.
           It was two rows under "Content and display": this one, and "Your colour, banner and Popits" that left
           Settings for another screen. */
        ['Display', [
          { id: 'appearance', label: 'Appearance', icon: 'moon',
            value: (doc.documentElement.getAttribute('data-theme') === 'light' ? 'Light' : 'Dark'),
            keys: 'dark light mode theme galaxy background plain colour color logos icons black white mono simple '
              + 'appearance look hue banner popits widgets avatar shape name font wordmark hearts thumbs likes dislikes customize style',
            move: ['Theme'],                  /* the look menu (founder/863): the theme and each theme's cards and background, one row */
            extra: function (body) { marksRow(body); likesRow(body); lookRows(body); } }
        ]],
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
          /* YOUR DATA, IN ONE PLACE (founder, 2026-10-20: "data delatipn can be where the download is"): the copy
             to download and the deletion beside it open the same page. */
          { id: 'data', label: 'Download your data', icon: 'understanding',
            keys: 'download data copy export my data zip gdpr archive', open: pageData },
          { id: 'delete', label: 'Delete your account', icon: 'trash', danger: true,
            keys: 'delete account remove close deactivate erase leave oneway gdpr', open: pageData }
        ]],
        /* ── HOW YOU USE ONEWAY (founder/520) ────────────────────────────
           Your activity, Understanding and the Calendar are pages with no
           door: the gear that once opened them moved to the top bar as
           Settings (495), and Settings never listed them — reachable only by
           typing an address. Instagram keeps these in its menu under "How you
           use Instagram"; here they are a section of the same list, each row
           going to its page rather than opening a panel. */
        ['How you use Oneway', [
          { id: 'go-calendar', label: 'Calendar', icon: 'calendar', go: 'calendar',
            keys: 'calendar plans bookings reservations stays events going schedule' },
          { id: 'go-activity', label: 'Your activity', icon: 'activity', go: 'activity',
            keys: 'activity history what i did posts follows log' },
          { id: 'go-understanding', label: 'What Oneway knows about you', icon: 'understanding', go: 'understanding',
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
          /* SIGN IN A TV OR A WATCH (founder/807, 810): the device shows a code, this is where it is said yes to */
          { id: 'device', label: 'Sign in a TV or Watch', icon: 'device',
            keys: 'apple tv watch television sign in code device link pair', open: pageDevice },
          /* SIGN IN WITH ONEWAY (founder/581): the sites a person carried their
             identity to. The consent screen promises "You can remove <site>
             any time in Settings" — this row is that promise kept. */
          { id: 'sites', label: 'Sites you signed in to', icon: 'access',
            keys: 'sign in with oneway apps websites sites third party connected access remove revoke',
            open: pageSites }
        ]],
        ['Workplace', [
          { id: 'workplace', label: 'Workplace identity', icon: 'person',
            keys: 'workplace identity coworker staff public center directory followers personal profile friends',
            move: ['Workplace'], extra: function (body) {
              var more = mk('details', 'ow-workplace-details');
              more.appendChild(mk('summary', '', 'Who can see what'));
              more.appendChild(mk('p', '', 'Coworkers are people with staff or operating roles at the same Center. '
                + 'Ordinary community members are not treated as coworkers.'));
              more.appendChild(mk('p', '', 'Workplace identity has separate work followers and following. '
                + 'Posts you publish to Centers you work at appear on that work profile automatically, '
                + 'while personal posts stay separate. Work follows do not unlock your personal profile; '
                + 'you must both choose to follow personally.'));
              more.appendChild(mk('p', '', 'When Workplace identity is on, signed-out App visitors also get the minimal '
                + 'identity and your personal web profile is not published. Other signed-in people follow your normal privacy rules. '
                + 'Copies already held elsewhere cannot be removed by this setting.'));
              more.appendChild(mk('p', '', 'Turn Workplace identity off to use your normal profile everywhere. '
                + 'Your workplace cannot change this choice for you. Public listing still requires the Center to choose to list you.'));
              more.appendChild(mk('p', '', 'Turning public listing off does not hide posts you publish to that Center. '
                + 'Each post keeps its own audience.'));
              body.appendChild(more);
            } }
        ]],
        ['Privacy', [
          { id: 'privacy', label: 'Privacy', icon: 'lock',
            keys: 'private profile comments counts likes active typing seen', move: ['Privacy'] },
          { id: 'where', label: 'Location sharing', icon: 'pin',
            keys: 'location map share where gps precise approximate background', move: ['Where you are'] },
          /* founder/845: live activity, what you are playing, listening to, watching or streaming (oneway/presence) */
          { id: 'presence', label: 'Live activity', icon: 'activity', fresh: true,
            keys: 'live activity presence status online playing listening watching streaming busy spotify music games calendar',
            open: pagePresence },
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
        /* ── SUPERVISION (PLAN R10; people/supervision.py) ──────────────────
           A teen and a parent, linked by the teen's invitation and the parent's
           answer. Instagram keeps this as its Family Center; here it is a row. */
        ['For families', [
          { id: 'supervision', label: 'Supervision', icon: 'person', fresh: true,
            keys: 'supervision parent parents teen family guardian child kids limits time screen minutes quiet hours sleep invite',
            open: pageSupervision }
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
      var rowEls = [], wantSecs = [], nowRows = {};
      var rowNotes = {
        appearance: 'Theme, colours, profile pictures and banners',
        connected: 'Connect other accounts and import posts',
        'go-activity': 'Review your posts and account activity',
        sites: 'Review and remove access to your Oneway identity',
        where: 'Choose whether and with whom to share your location',
        presence: 'What you play, hear and watch',
        discovery: 'Recommendations and who can find you',
        accessibility: 'Motion, contrast and text size'
      };
      GROUPS.forEach(function (g) {
        var rows = g[1].filter(function (r) { return !r.move || !full || has(r.move); });
        if (!rows.length) return;
        var sec = carry.secs[g[0]];
        if (!sec) {
          sec = mk('section', 'ow-set__sec');
          sec.appendChild(mk('h2', 'ow-set__sh', esc(g[0])));
          carry.secs[g[0]] = sec;
        }
        var want = [sec.firstChild];
        rows.forEach(function (r) {
          var tag = r.href ? 'a' : 'button';
          var el = kept[r.id] && kept[r.id].tagName.toLowerCase() === tag ? kept[r.id] : null;
          if (!el) {
            el = mk(tag, 'ow-set__row');
            el.setAttribute('data-set', r.id);
            el.innerHTML = '<span class="ow-set__ic">' + setIcon(r.icon) + '</span>'
              + '<span class="ow-set__lb">' + esc(r.label) + '</span>'
              + '<span class="ow-set__v"></span>'
              + '<span class="ow-set__cv">' + setIcon('chevron') + '</span>';
            if (!r.href) {
              el.type = 'button';
              el.addEventListener('click', function () { if (el.__ow) el.__ow(); });
            }
          }
          el.classList.toggle('ow-set__row--out', !!r.danger);
          el.querySelector('.ow-set__lb').innerHTML = esc(r.label)
            + (rowNotes[r.id] ? '<small>' + esc(rowNotes[r.id]) + '</small>' : '');
          if (r.href) el.href = r.href;
          el.querySelector('.ow-set__v').textContent = r.value || '';
          el.hidden = false;
          el.__ow = r.href ? null : (r.go ? function () {
            try { doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: r.go } })); } catch (e) {}
          } : function () { openPage(r); });
          nowRows[r.id] = el;
          want.push(el);
          rowEls.push({ el: el, sec: sec, text: (r.label + ' ' + (r.keys || '') + ' ' + g[0]).toLowerCase() });
        });
        settle(sec, want);
        wantSecs.push(sec);
      });
      carry.rows = nowRows;
      carry.rowEls = rowEls;
      /* every row shows its current value (the list's own rule): how many
         people wait, and how many are blocked or muted (founder/539) */
      if (full) {
        data.get('/api/oneway/messaging/requests', { fresh: true }).then(function (r) {
          var n2 = r.ok ? (((r.data || {}).requests) || []).length : 0; if (n2) setValue('requests', String(n2));
        });
        data.get('/api/oneway/people/me/supervision', { fresh: true }).then(function (r) {
          var d = (r.ok && r.data) || {}, t = d.as_teen, p = d.as_parent || {};
          var n4 = (p.invitations || []).length, n5 = (p.teens || []).length;
          if (n4) setValue('supervision', n4 + ' waiting');
          else if (n5) setValue('supervision', n5 === 1 ? '1 teen' : n5 + ' teens');
          else if (t) setValue('supervision', (t.parents || []).some(function (x) { return x.state === 'active'; }) ? 'On' : 'Off');
        });
        [['blocked', 'blocked'], ['muted', 'muted']].forEach(function (t) {
          data.get('/api/oneway/graph/me/' + t[1] + '?limit=50', { fresh: true }).then(function (r) {
            var d = (r.ok && r.data) || {}; var n3 = (d.people || []).length;
            if (d.readable !== false && n3) setValue(t[0], n3 + (d.next_cursor ? '+' : ''));
          });
        });
      }

      /* LOG OUT — last, alone, and it asks once by asking twice (no modal) */
      var outSec = carry.outSec;
      if (!outSec) {
      outSec = mk('section', 'ow-set__sec');
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
        /* THE COOKIE'S MARK GOES TOO (lane B, 2026-10-09). The session is the HttpOnly cookie the
           sign-out ends; left behind, `ow_session_cookie` told the App, the stream and the hue that this
           browser still held one, and they kept calling with a session that no longer existed. And the
           page leaves whatever the network did: a sign-out that could not be sent still signs out here. */
        function gone() {
          try {
            ['ow_session_token', 'ow_tokens', 'ow_session', 'ow_session_cookie', 'ow_session_at', 'ow_token_at']
              .forEach(function (k) { global.localStorage.removeItem(k); });
          } catch (_) {}
          leaving('/login.html');
        }
        data.post('/api/auth/signout', {}).then(gone, gone);
      });
      outSec.appendChild(outBtn);
      carry.outSec = outSec;
      }

      /* SEARCH — every row answers to its words, its section, and the words
         a person would type for it ("2fa", "dark", "gps") */
      var none = carry.none;
      if (!none) { none = mk('p', 'ow-set__none', 'Nothing in settings matches that.'); none.hidden = true; carry.none = none; }
      settle(list, wantSecs.concat([outSec, none]));
      if (first) q.addEventListener('input', function () {
        var t = q.value.trim().toLowerCase();
        var shown = 0;
        carry.rowEls.forEach(function (x) {
          var hit = !t || t.split(/\s+/).every(function (w) { return x.text.indexOf(w) >= 0; });
          x.el.hidden = !hit; if (hit) shown++;
        });
        Array.prototype.forEach.call(list.querySelectorAll('.ow-set__sec'), function (sec) {
          if (sec === carry.outSec) { sec.hidden = !!t; return; }
          sec.hidden = !Array.prototype.some.call(sec.querySelectorAll('.ow-set__row'), function (r) { return !r.hidden; });
        });
        carry.none.hidden = !(t && !shown);
      });
      /* a paint after something was typed in the search applies it to the rows it just wrote */
      if (q.value) { try { q.dispatchEvent(new global.Event('input')); } catch (_) {} }

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
        var body = r.fresh ? null : built[r.id];       /* a page that changes elsewhere (a parent's answer) is read each time */
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
        host.classList.add('ow-set--open');
        Array.prototype.forEach.call(list.querySelectorAll('[data-set]'), function (el) {
          if (el.getAttribute('data-set') === r.id) el.setAttribute('aria-current', 'page');
          else el.removeAttribute('aria-current');
        });
        menu.hidden = false; page.hidden = false;
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
        host.classList.remove('ow-set--open');
        Array.prototype.forEach.call(list.querySelectorAll('[aria-current]'), function (el) { el.removeAttribute('aria-current'); });
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
        /* a live-activity source's return (oneway/presence/routes.py): the server's own sentence */
        else if (q.said && OW.toast) OW.toast(q.said, /^Not connected/.test(q.said) ? undefined : { tone: 'ok' });
        if (q.connected || q.failed || q.said) {
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
        /* S23: a refusal is said once as the toast, never written under the field that caused it */
        if (bad) { n.textContent = ''; if (OW.toast && text) OW.toast(text); return; }
        n.textContent = text || ''; n.setAttribute('data-bad', '0');
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
          'This is the address you sign in with. It is also how Oneway knows you everywhere '
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

      /* ── YOUR DATA: A COPY TO DOWNLOAD, AND DELETING THE ACCOUNT BESIDE IT ────────────
         people/exports.py and identity/departure.py. The copy is a zip made in the background; the person is
         told when it is ready and its link ends after the hours the server says. Deleting gives 30 days to
         change your mind: every session ends at once and the profile leaves view; signing in and Keep my
         account undoes it. The password is the gate (and the code, if the server says two-step is on); the
         delete button asks once by asking twice, the rule Log out keeps — no modal. */
      function pageData(body) {
        var when = function (iso) { try { return new Date(iso).toLocaleString(); } catch (_) { return iso || ''; } };
        body.appendChild(mk('p', 'ow-set__big', 'Download your data'));
        body.appendChild(mk('p', 'ow-set__lede',
          'A copy of your profile, posts, messages, follows, Centers and the links to your photos and videos, '
          + 'as one file. It is made in the background and you are told when it is ready.'));
        var pw1 = field('Your password', 'password', { autocomplete: 'current-password' });
        body.appendChild(pw1.el);
        var code1 = field('A code from your authenticator app', 'text',
          { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '12' });
        code1.el.style.display = 'none';
        body.appendChild(code1.el);
        var ask = btn('Make my copy'); body.appendChild(ask);
        var copies = mk('div', 'ow-set__copies'); body.appendChild(copies);
        var del = mk('div', 'ow-set__deletion'); body.appendChild(del);
        function draw(d) {
          copies.innerHTML = '';
          (d.exports || []).forEach(function (x) {
            var row = mk('p', 'ow-set__lede');
            if (x.state === 'ready') {
              var a = doc.createElement('a'); a.href = x.download; a.setAttribute('download', 'oneway-my-data.zip');
              a.textContent = 'Download your copy'; row.appendChild(a);
              row.appendChild(doc.createTextNode(' · until ' + when(x.expires_at)));
            } else if (x.state === 'making') {
              row.textContent = 'Your copy is being made. You will be told when it is ready.';
            } else {
              row.textContent = x.why || 'This copy could not be made. Ask again.';
            }
            copies.appendChild(row);
          });
          drawDeletion(d);
        }
        function load() {
          data.get('/api/oneway/me/data-export', { fresh: true }).then(function (r) { if (r.ok) draw(r.data || {}); });
        }
        ask.addEventListener('click', function () {
          if (!pw1.input.value) { say(body, 'Enter your password.', true); return; }
          ask.disabled = true; say(body, 'Asking…');
          data.post('/api/oneway/me/data-export', { password: pw1.input.value, code: code1.input.value }).then(function (r) {
            ask.disabled = false;
            if (!r.ok) {
              if (r.body && r.body.needs_2fa) code1.el.style.display = '';
              say(body, r.error || 'Your copy was not asked for.', true); return;
            }
            pw1.input.value = ''; say(body, 'Your copy is being made.');
            load();
          });
        });

        function drawDeletion(d) {
          del.innerHTML = '';
          del.appendChild(mk('p', 'ow-set__big', 'Delete your account'));
          if (d.deletion && d.deletion.purge_at) {
            del.appendChild(mk('p', 'ow-set__lede', 'Your account will be deleted on ' + when(d.deletion.purge_at)
              + '. Until then your profile is out of view, and you can keep your account.'));
            var keep = btn('Keep my account'); del.appendChild(keep);
            keep.addEventListener('click', function () {
              keep.disabled = true;
              data.post('/api/oneway/me/deletion/cancel', {}).then(function (r) {
                keep.disabled = false;
                if (!r.ok) { say(body, r.error || 'That did not change.', true); return; }
                if (OW.toast) OW.toast('Your account stays.', { tone: 'ok' });
                load();
              });
            });
            return;
          }
          var days = d.grace_days || 30;
          del.appendChild(mk('p', 'ow-set__lede',
            'You have ' + days + ' days to change your mind: every session ends now and your profile leaves view, '
            + 'and signing in before then lets you keep your account. After that your profile, your posts, your likes '
            + 'and the people you follow are removed, every site you signed in to with Oneway loses access, and you '
            + 'leave every Center you belong to. Comments you left in other people\'s conversations stay, shown as '
            + '"Deleted account". Your email address cannot be used for a new account.'));
          var pw = field('Your password', 'password', { autocomplete: 'current-password' });
          del.appendChild(pw.el);
          var code = field('A code from your authenticator app', 'text',
            { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '12' });
          code.el.style.display = 'none';     /* .ow-set__f is display:flex, which [hidden] loses to */
          del.appendChild(code.el);
          var go = btn('Delete your account', 'ow-set__danger'); del.appendChild(go);
          var armed = 0;
          go.addEventListener('click', function () {
            if (!pw.input.value) { say(body, 'Enter your password.', true); return; }
            if (!armed) {
              armed = global.setTimeout(function () { armed = 0; go.textContent = 'Delete your account'; }, 4000);
              go.textContent = 'Tap again to delete it in ' + days + ' days';
              return;
            }
            global.clearTimeout(armed); armed = 0;
            go.disabled = true; go.textContent = 'Deleting…'; say(body, '');
            data.post('/api/oneway/me/deletion', { password: pw.input.value, code: code.input.value, confirm: 'delete' })
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
                body.appendChild(mk('p', 'ow-set__big', 'Your account will be deleted on ' + when((r.data || {}).purge_at) + '.'));
                body.appendChild(mk('p', 'ow-set__lede', 'Sign in before then to keep it.'));
                global.setTimeout(function () { global.location.href = '/login.html'; }, 2600);
              });
          });
        }
        load();
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
          body.appendChild(mk('p', 'ow-set__step', '1 · Add Oneway to your authenticator app'));
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

      /* SIGN IN A TV OR A WATCH (founder/807, 810; identity/devices.py). The device shows a short code; it is typed
         here, the device is named, and saying yes gives that device a session of its own (listed under Where you are
         signed in, ended by Sign out everywhere). A code that matches nothing is said once, as the toast (S23). */
      function pageDevice(body) {
        body.appendChild(mk('p', 'ow-set__lede', 'Open Oneway on the TV or the Watch and type the code it shows.'));
        var f = field('Code', 'text', { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
                                        maxlength: '9', placeholder: 'BCDF-GHJK' });
        body.appendChild(f.el);
        var go = btn('Continue'); body.appendChild(go);
        function shown(v) { var c = String(v || '').toUpperCase().replace(/[^A-Z]/g, ''); return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4, 8) : c; }
        f.input.addEventListener('input', function () { f.input.value = shown(f.input.value); });
        go.addEventListener('click', function () {
          var code = shown(f.input.value);
          if (code.length < 9) { say(body, 'The code has eight letters.', true); return; }
          data.get('/api/oneway/identity/devices/code/' + encodeURIComponent(code), { fresh: true }).then(function (r) {
            if (!r.ok) { say(body, r.error || 'That code is not one a device is showing now.', true); return; }
            body.innerHTML = '';
            var dev = (r.data && r.data.device) || 'the device';
            var asked = r.data && r.data.asked_at ? (OW.when ? OW.when(r.data.asked_at) : r.data.asked_at) : '';
            body.appendChild(mk('p', 'ow-set__lede', 'Sign ' + esc(dev) + ' in to your account? It will be listed under Where you are signed in, and you can sign it out there.'));
            if (asked) body.appendChild(mk('p', 'ow-set__lede', esc(dev) + ' asked for this code ' + esc(asked) + '. If you did not just open Oneway on it, choose Not now.'));
            var yes = btn('Sign in ' + dev); body.appendChild(yes);
            var no = btn('Not now', 'ow-btn--quiet'); body.appendChild(no);
            no.addEventListener('click', function () { body.innerHTML = ''; pageDevice(body); });
            yes.addEventListener('click', function () {
              data.post('/api/oneway/identity/devices/approve', { code: code }).then(function (rr) {
                if (!rr.ok) { say(body, rr.error || 'That did not work.', true); return; }
                body.innerHTML = '';
                body.appendChild(mk('p', 'ow-set__lede', esc(dev) + ' is signed in.'));
                if (OW.toast) OW.toast(dev + ' is signed in.', { tone: 'ok' });
              });
            });
          });
        });
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
          passkeysBlock(body);
          securityLogBlock(body);
        });
      }

      /* ── WHAT HAPPENED TO YOUR ACCOUNT (the security log's App half; security_log/routes.py): sign-ins, refused
         sign-ins, two-step, the password, passkeys, signing out everywhere, newest first, in the words the server
         composes (S10), each with when and the address it came from. A page at a time; never a code or a token. */
      function securityLogBlock(body) {
        var box = mk('div', 'ow-set__seclog', '');
        box.appendChild(mk('p', 'ow-set__lede', 'What happened to your account'));
        var list = mk('div', '', ''), note = mk('p', 'ow-set__say', '');
        box.appendChild(list); box.appendChild(note);
        body.appendChild(box);
        var more = null;
        function page(before) {
          data.get('/api/oneway/identity/security-log?limit=10' + (before ? '&before=' + encodeURIComponent(before) : ''), { fresh: true }).then(function (r) {
            if (more) { more.remove(); more = null; }
            if (!r.ok || !r.data) { note.textContent = 'Your account\u2019s history could not be read just now.'; return; }
            var rows = r.data.entries || [];
            if (!rows.length && !before) { note.textContent = 'Nothing has happened to your account yet.'; return; }
            rows.forEach(function (e) {
              var row = mk('div', 'ow-set__sess');
              row.setAttribute('data-seclog', String(e.seq || ''));
              row.innerHTML = '<span class="ow-set__ic">' + setIcon('key') + '</span>'
                + '<span class="ow-set__lb">' + esc(e.words || 'Something changed on your account') + (e.ip ? ' <span class="ow-set__from">from ' + esc(e.ip) + '</span>' : '') + '</span>'
                + '<span class="ow-set__v">' + esc(OW.when ? OW.when(e.at) : (e.at || '')) + '</span>';
              list.appendChild(row);
            });
            if (r.data.more && r.data.before) {
              more = btn('Show earlier', 'ow-btn--quiet'); box.appendChild(more);
              more.addEventListener('click', function () { more.disabled = true; page(r.data.before); });
            }
          });
        }
        page(0);
      }

      /* ── PASSKEYS (C-parity, 2026-10-11; register row 10): sign in with this device's own lock, as Google and Apple
         offer. Listed by the device that made each; Add asks the browser to make one (navigator.credentials.create)
         and the server checks its answer (identity/passkeys.py); Remove ends it at once. */
      function passkeysBlock(body) {
        var box = mk('div', 'ow-set__passkeys', '');
        box.appendChild(mk('p', 'ow-set__lede', 'Passkeys'));
        var list = mk('div', '', ''), note = mk('p', 'ow-set__say', '');
        box.appendChild(list); box.appendChild(note);
        body.appendChild(box);
        function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return global.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
        function bytes(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); var raw = global.atob(s + '==='.slice((s.length + 3) % 4)), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
        function paint(d) {
          list.innerHTML = '';
          (d.passkeys || []).forEach(function (k) {
            var row = mk('div', 'ow-set__sess');
            row.setAttribute('data-passkey', k.id);
            row.innerHTML = '<span class="ow-set__ic">' + setIcon('device') + '</span>'
              + '<span class="ow-set__lb">' + esc(k.device || 'A passkey') + '</span>'
              + '<span class="ow-set__v">' + esc(k.last_used ? 'Used ' + (OW.when ? OW.when(new Date(k.last_used * 1000).toISOString()) : '') : 'Not used yet') + '</span>';
            var rm = btn('Remove', 'ow-btn--quiet'); rm.setAttribute('aria-label', 'Remove the passkey made on ' + (k.device || 'a device'));
            rm.style.cssText = 'width:auto;flex:none;padding:0 14px;margin-left:8px';
            rm.addEventListener('click', function () {
              data.del('/api/oneway/identity/passkeys/' + encodeURIComponent(k.id)).then(function (rr) {
                if (!rr || !rr.ok) { note.textContent = (rr && rr.error) || 'That did not remove it.'; return; }
                paint(rr.data || {});
              });
            });
            row.appendChild(rm);
            list.appendChild(row);
          });
          if (!(d.passkeys || []).length) list.appendChild(mk('p', 'ow-set__say', 'No passkeys yet. A passkey signs you in with this device’s own lock, no password.'));
        }
        data.get('/api/oneway/identity/passkeys', { fresh: true }).then(function (r) { if (r && r.ok) paint(r.data || {}); });
        if (!(global.PublicKeyCredential && global.navigator.credentials)) { note.textContent = 'This browser cannot make passkeys.'; return; }
        var add = btn('Add a passkey', 'ow-btn--quiet'); add.setAttribute('data-passkey-add', '1');
        box.appendChild(add);
        add.addEventListener('click', function () {
          add.disabled = true; note.textContent = '';
          data.post('/api/oneway/identity/passkeys/register/options', {}).then(function (r) {
            if (!r || !r.ok) throw new Error((r && r.error) || 'Passkeys could not be started.');
            var pk = (r.data || {}).publicKey;
            pk.challenge = bytes(pk.challenge); pk.user.id = bytes(pk.user.id);
            pk.excludeCredentials = (pk.excludeCredentials || []).map(function (c) { return { type: c.type, id: bytes(c.id) }; });
            return global.navigator.credentials.create({ publicKey: pk });
          }).then(function (cred) {
            if (!cred) throw new Error('No passkey was made.');
            return data.post('/api/oneway/identity/passkeys/register', { id: cred.id, rawId: b64(cred.rawId), type: cred.type,
              response: { clientDataJSON: b64(cred.response.clientDataJSON), attestationObject: b64(cred.response.attestationObject) } });
          }).then(function (rr) {
            add.disabled = false;
            if (!rr || !rr.ok) { note.textContent = (rr && rr.error) || 'That passkey was not kept.'; return; }
            note.textContent = 'Passkey added. Next time, sign in with it.';
            paint(rr.data || {});
          }).catch(function (err) { add.disabled = false; note.textContent = (err && err.message) || 'No passkey was made.'; });
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
            body.appendChild(mk('p', 'ow-set__lede', 'You have not used Sign in with Oneway on any site.'));
            return;
          }
          body.appendChild(mk('p', 'ow-set__lede', 'These sites know you through Oneway. Removing one ends its access.'));
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
      /* ── SUPERVISION (PLAN R10; GET /api/oneway/people/me/supervision) ──────────────────────────────────────────────
         What each side sees, in rows on the page (S20: no modals). A TEEN: their time today and the week (people/usage),
         their parents, an invitation to one by @username or address, their asks, what a parent set, and ending it. A
         PARENT: each invitation and each teen's ask with the decision's own buttons (the one door, /me/decisions, the card
         Workspace draws: OW._u.decisionActs), and each teen's protections, who they talk to (names only, never what is
         said), quieter hours and a shorter day, and ending it. A refusal is the toast, in the door's words (S23). */
      function pageSupervision(body) {
        var who = function (x) { return (x.name || 'Someone') + (x.handle ? ' (@' + x.handle + ')' : ''); };
        var ref = function (x) { return x.handle ? '@' + x.handle : ''; };
        var ASKS = { private_profile: 'to make their profile public' };
        function sec(title) {
          var el = mk('section', 'ow-sup');          /* not .ow-set__sec: a page hides a moved section's heading, and these are its own */
          el.appendChild(mk('h2', 'ow-set__sh', esc(title)));
          body.appendChild(el);
          return el;
        }
        function line(into, text, cls) { var p = mk('p', cls || 'ow-set__lede', esc(text)); into.appendChild(p); return p; }
        /* ending it asks once by asking twice, as Log out does (no modal) */
        function endBtn(into, x, words) {
          if (!ref(x)) return;
          var b = btn(words, 'ow-btn--quiet'); var armed = 0;      /* the quieter act, as turning two-step off is */
          b.addEventListener('click', function () {
            if (!armed) { armed = global.setTimeout(function () { armed = 0; b.textContent = words; }, 3200); b.textContent = 'Tap again to end it'; return; }
            global.clearTimeout(armed); armed = 0; b.disabled = true;
            data.post('/api/oneway/people/me/supervision/end', { 'with': ref(x) }).then(function (r) {
              b.disabled = false;
              if (!r.ok) { say(body, r.error || 'That could not be ended just now.', true); return; }
              if (OW.toast) OW.toast('Supervision ended. They are told.', { tone: 'ok' });
              draw();
            });
          });
          into.appendChild(b);
        }
        function card(into, text, dec) {
          var c = mk('div', 'ow-req');
          c.appendChild(mk('span', 'ow-req__who', esc(text)));
          if (dec) c.appendChild(_u.decisionActs(dec, c, function () { global.setTimeout(draw, 700); }));
          else line(c, 'It waits for you in Workspace too.', 'ow-set__say');
          into.appendChild(c);
        }
        function teenSide(t, decisions) {
          line(body, 'Your account is in teen mode' + (t.age ? ' (' + t.age + ')' : '') + '. A parent who supervises you sees '
            + 'your protections, what you ask to change and who you talk to, by name only, never what is said. They can set '
            + 'quieter hours and a shorter day, never looser ones.');
          var tm = sec('Your time');
          var said = line(tm, 'Reading your time…');
          data.get('/api/oneway/me/usage', { fresh: true }).then(function (r) {
            var d = (r.ok && r.data) || {}, td = d.today || {}, wk = d.week || {};
            if (!r.ok || td.metered === false) { said.textContent = 'Your time could not be read just now.'; return; }
            said.textContent = (td.words || '') + '.';
            if (wk.words) line(tm, 'This week: ' + wk.words + '.');
            if (td.reached && !td.kept_going) {
              var go = btn('Keep going'); tm.appendChild(go);
              go.addEventListener('click', function () {
                go.disabled = true;
                data.post('/api/oneway/me/usage/keep-going', {}).then(function (x) {
                  go.disabled = false;
                  if (!x.ok) { say(body, x.error || 'That could not be saved just now.', true); return; }
                  if (OW.usage) OW.usage.said(x.data || {});
                  draw();
                });
              });
            }
          });
          var ps = sec('Your parents');
          var parents = t.parents || [];
          if (!parents.length) line(ps, 'No one supervises your account.');
          parents.forEach(function (x) {
            var row = mk('div', 'ow-req');
            row.appendChild(mk('span', 'ow-req__who', esc(who(x) + (x.state === 'active' ? ' supervises you' : ', invited. It waits on their answer'))));
            ps.appendChild(row);
            endBtn(ps, x, x.state === 'active' ? 'End supervision with ' + (x.name || 'them') : 'Take back the invitation');
          });
          var inv = field('Invite a parent: their @username or email', 'text', { autocomplete: 'off', maxlength: '320' });
          ps.appendChild(inv.el);
          var send = btn('Invite'); ps.appendChild(send);
          send.addEventListener('click', function () {
            var v = inv.input.value.trim();
            if (!v) { say(body, 'Write their @username or email first.', true); return; }
            send.disabled = true;
            data.post('/api/oneway/people/me/supervision/invite', { parent: v }).then(function (r) {
              send.disabled = false;
              if (!r.ok) { say(body, r.error || 'That invitation could not be sent.', true); return; }
              if (OW.toast) OW.toast('Invited. It waits for their answer.', { tone: 'ok' });
              draw();
            });
          });
          var lim = t.limits || {};
          if ((lim.sleep || []).length === 2 || lim.daily_minutes) {
            var ls = sec('What your parent set');
            if ((lim.sleep || []).length === 2) line(ls, 'Quiet hours from ' + lim.sleep[0] + ' to ' + lim.sleep[1] + '.');
            if (lim.daily_minutes) line(ls, 'A day of ' + lim.daily_minutes + ' minutes.');
          }
          (t.asks || []).forEach(function (a, i) {
            if (!i) sec('What you asked');
            line(body.lastChild, 'You asked ' + (ASKS[a.setting] || 'to change ' + String(a.setting || '').replace(/_/g, ' '))
              .replace('their profile', 'your profile') + '. Your parent decides.');
          });
        }
        function parentSide(p, decisions) {
          var byId = {};
          decisions.forEach(function (x) { byId[x.id] = x; });
          if ((p.invitations || []).length) {
            var iv = sec('Waiting on your answer');
            p.invitations.forEach(function (x) { card(iv, who(x) + ' asked you to supervise their account.', byId[x.decision]); });
          }
          (p.teens || []).forEach(function (t) {
            var ts = sec(who(t) + (t.age ? ' \u00b7 ' + t.age : ''));
            var pr = t.protections || {};
            line(ts, (pr.private_profile_to_start ? 'Their profile started private. ' : '')
              + (pr.messages_from ? 'Messages from: ' + String(pr.messages_from).replace(/_/g, ' ') + '. ' : '')
              + ((pr.quiet_hours || []).length === 2 ? 'Quiet hours ' + pr.quiet_hours[0] + ' to ' + pr.quiet_hours[1] + '. ' : '')
              + (pr.daily_minutes ? 'A day of ' + pr.daily_minutes + ' minutes.' : ''));
            (t.asks || []).forEach(function (a) {
              card(ts, (t.name || 'They') + ' asked ' + (ASKS[a.setting] || 'to change ' + String(a.setting || '').replace(/_/g, ' ')) + '.', byId[a.decision]);
            });
            var tw = t.talks_with || {};
            var names = (tw.people || []).map(function (x) { return x.name || (x.handle ? '@' + x.handle : ''); }).filter(Boolean);
            line(ts, names.length || tw.group_conversations
              ? 'Talks with ' + (names.length ? names.join(', ') : 'no one directly')
                + (tw.group_conversations ? ', and in ' + tw.group_conversations + ' group ' + (tw.group_conversations === 1 ? 'conversation' : 'conversations') : '')
                + (tw.more ? ', of their newest conversations' : '') + '. Never what is said.'
              : 'No conversations yet.');
            var q = pr.quiet_hours || [];
            var a1 = field('Quiet hours start', 'time', { value: q[0] || '' });
            var a2 = field('Quiet hours end', 'time', { value: q[1] || '' });
            var a3 = field('Minutes a day', 'number', { value: String(pr.daily_minutes || ''), min: '1', inputmode: 'numeric' });
            [a1, a2, a3].forEach(function (f) { ts.appendChild(f.el); });
            var save = btn('Save'); ts.appendChild(save);
            save.addEventListener('click', function () {
              save.disabled = true;
              data.put('/api/oneway/people/me/supervision/limits', {
                teen: ref(t), sleep_start: a1.input.value || null, sleep_end: a2.input.value || null,
                daily_minutes: a3.input.value ? parseInt(a3.input.value, 10) : null
              }).then(function (r) {
                save.disabled = false;
                if (!r.ok) { say(body, r.error || 'That could not be saved.', true); return; }
                if (OW.toast) OW.toast('Saved. They are told.', { tone: 'ok' });
                draw();
              });
            });
            endBtn(ts, t, 'End supervision');
          });
        }
        function draw() {
          body.innerHTML = '';
          body.appendChild(mk('p', 'ow-set__lede', 'Loading…'));
          Promise.all([
            data.get('/api/oneway/people/me/supervision', { fresh: true }),
            data.get('/api/oneway/me/decisions', { fresh: true }).catch(function () { return { ok: false }; })
          ]).then(function (res) {
            var r = res[0], dc = res[1] || {};
            body.innerHTML = '';
            if (!r.ok) { body.appendChild(mk('p', 'ow-set__lede', esc(r.error || 'Supervision could not be read just now.'))); return; }
            var d = r.data || {}, p = d.as_parent || {};
            var decisions = (((dc.ok && dc.data) || {}).items || []).filter(function (x) { return x && /^(supervision|teen_ask):/.test(x.id || ''); });
            if (d.as_teen) teenSide(d.as_teen, decisions);
            if ((p.invitations || []).length || (p.teens || []).length) parentSide(p, decisions);
            else if (!d.as_teen) body.appendChild(mk('p', 'ow-set__lede', 'Supervision links a teen\u2019s account with a parent\u2019s. '
              + 'A teen invites you from their own Settings, and the invitation waits here for your answer. '
              + 'You then see their protections and who they talk to, by name only, and can set quieter hours and a shorter day.'));
          });
        }
        draw();
      }

      /* LIVE ACTIVITY (founder/845: "live activtiy … like using discord or listening to x on spotfiy with real album art").
         What a person is playing, listening to, watching or streaming, and when they are busy, from the platforms they
         connect (oneway/presence). EVERY SOURCE IS OFF UNTIL ITS PERSON TURNS IT ON, and each has its own audience. The
         sources, how each connects, whether this server is set up for it, and the audiences' words all come from
         GET /api/oneway/me/presence: this page names no platform of its own, so a source added on the server appears here
         the day it ships. Every press is answered by the server and the page is drawn again from its answer. */
      function pagePresence(body) {
        var BASE = '/api/oneway/me/presence', shown = {};
        var SKIP = { manual: 1, device_agent: 1 };            /* typed and this-device sources are reported, not switched here */
        function sec(title, into) {
          var el = mk('section', 'ow-sup');
          el.appendChild(mk('h2', 'ow-set__sh', esc(title)));
          (into || body).appendChild(el);
          return el;
        }
        function line(into, text, cls) { var p = mk('p', cls || 'ow-set__lede', esc(text)); into.appendChild(p); return p; }
        function act(method, url, payload) {
          return data.post(url, payload || {}, { method: method }).then(function (r) {
            if (!r.ok) { say(body, r.error || 'That could not be done just now.', true); return null; }
            if (OW.presence && OW.presence.forget) OW.presence.forget();
            return r.data || {};
          });
        }
        /* APPLE'S MUSICKIT, loaded only when the person presses Connect Apple Music (the App's policy allows Apple's script host
           and no other page's does: platform/static_site.py) */
        var mkLoading = null;
        function musicKit() {
          if (global.MusicKit && global.MusicKit.configure) return Promise.resolve(global.MusicKit);
          if (mkLoading) return mkLoading;
          mkLoading = new Promise(function (resolve, reject) {
            doc.addEventListener('musickitloaded', function () { resolve(global.MusicKit); }, { once: true });
            var sc = doc.createElement('script');
            sc.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
            sc.async = true;
            sc.setAttribute('data-web-components', '');
            sc.onerror = function () { mkLoading = null; reject(new Error('MusicKit did not load')); };
            doc.head.appendChild(sc);
          });
          return mkLoading;
        }
        function reload() {
          return data.get(BASE, { fresh: true }).then(function (r) {
            if (!r.ok) { body.innerHTML = ''; line(body, 'Your live activity could not be read just now.'); return; }
            paint(r.data || {});
          });
        }
        /* who sees it: the server's own words for each audience */
        function audiences(into, label, current, options, write) {
          var group = mk('div', 'ow-swatches ow-choice ow-pres-aud');
          group.setAttribute('role', 'group'); group.setAttribute('aria-label', label);
          options.forEach(function (o) {
            var b = mk('button', 'po-act', esc(o.label)); b.type = 'button';
            b.setAttribute('aria-pressed', String(o.value === current));
            if (o.value === current) b.setAttribute('data-act', 'on');
            b.addEventListener('click', function () {
              if (o.value === current || group.getAttribute('aria-busy') === 'true') return;
              group.setAttribute('aria-busy', 'true');
              Array.prototype.forEach.call(group.children, function (x) { x.disabled = true; });
              write(o.value).then(reload);
            });
            group.appendChild(b);
          });
          into.appendChild(mk('span', 'ow-pres-audl', esc(label)));
          into.appendChild(group);
        }
        function source(into, s, auds) {
          var card = mk('div', 'ow-pres-src');
          card.setAttribute('data-source', s.id);
          var state = s.connected ? (s.account ? 'Connected as ' + s.account : (s.connector === 'oneway' ? s.how : 'Connected')) : s.how;
          var sw = mk('button', 'ow-switch'); sw.type = 'button';
          sw.setAttribute('aria-pressed', String(!!s.enabled));
          sw.innerHTML = '<span class="ow-switch__b"><b>' + esc(s.name) + '</b><span>' + esc(state) + '</span></span>'
            + '<span class="ow-switch__k" aria-hidden="true"></span>';
          if (!s.connected) { sw.disabled = true; sw.title = 'Connect ' + s.name + ' first'; }
          sw.addEventListener('click', function () {
            if (sw.disabled) return;
            sw.disabled = true;
            act('PUT', BASE + '/sources/' + encodeURIComponent(s.id), { enabled: !s.enabled }).then(reload);
          });
          card.appendChild(sw);
          if (s.connected && s.enabled) {
            audiences(card, 'Who sees ' + s.name, s.audience, auds, function (v) {
              return act('PUT', BASE + '/sources/' + encodeURIComponent(s.id), { audience: v });
            });
          }
          var acts = mk('div', 'ow-pres-acts');
          if (s.connector === 'oauth' && !s.connected) {
            var go = btn('Connect ' + s.name);
            go.disabled = !s.set_up;
            go.addEventListener('click', function () {
              go.disabled = true;
              act('POST', BASE + '/sources/' + encodeURIComponent(s.id) + '/connect').then(function (d) {
                go.disabled = false;
                if (d && d.go) global.location.href = d.go;
              });
            });
            acts.appendChild(go);
          }
          if (s.connector === 'username' && !s.connected) {
            var f = field('Name on ' + s.name, 'text', { autocomplete: 'off', maxlength: '120', spellcheck: 'false' });
            f.input.disabled = !s.set_up;
            acts.appendChild(f.el);
            var save = btn('Connect'); save.disabled = !s.set_up;
            save.addEventListener('click', function () {
              var v = f.input.value.trim();
              if (!v) { say(body, 'Write your ' + s.name + ' username first.', true); return; }
              save.disabled = true;
              act('PUT', BASE + '/sources/' + encodeURIComponent(s.id) + '/account', { account: v }).then(function (d) {
                save.disabled = false;
                if (d) reload();
              });
            });
            acts.appendChild(save);
          }
          /* A TOKEN THE PLATFORM MADE FOR THE PERSON (Hardcover): pasted once, checked there, kept in the vault, never shown again */
          if (s.connector === 'token' && !s.connected) {
            var tf = field('Token from ' + s.name, 'password', { autocomplete: 'off', maxlength: '4000', spellcheck: 'false' });
            acts.appendChild(tf.el);
            var keep = btn('Connect');
            keep.addEventListener('click', function () {
              var v = tf.input.value.trim();
              if (!v) { say(body, 'Paste the token from ' + s.name + ' first.', true); return; }
              keep.disabled = true;
              act('PUT', BASE + '/sources/' + encodeURIComponent(s.id) + '/token', { token: v }).then(function (d) {
                keep.disabled = false; tf.input.value = '';
                if (d) reload();
              });
            });
            acts.appendChild(keep);
          }
          /* APPLE MUSIC: a developer token signed by our server for this request, MusicKit's own sign-in at Apple, and the token
             Apple gives back sent once to the vault */
          if (s.connector === 'musickit' && !s.connected) {
            var am = btn('Connect ' + s.name);
            am.addEventListener('click', function () {
              am.disabled = true;
              data.get(BASE + '/sources/' + encodeURIComponent(s.id) + '/developer-token', { fresh: true }).then(function (r) {
                if (!r.ok || !r.data || !r.data.token) throw new Error((r && r.error) || 'Apple Music could not be reached just now.');
                return musicKit().then(function (MK) {
                  return Promise.resolve(MK.configure({ developerToken: r.data.token, app: { name: 'Oneway', build: '1' } }))
                    .then(function (inst) { return (inst || MK.getInstance()).authorize(); });
                });
              }).then(function (userToken) {
                if (!userToken) throw new Error('Apple Music was not given access.');
                return act('PUT', BASE + '/sources/' + encodeURIComponent(s.id) + '/token', { token: userToken });
              }).then(function (d) {
                am.disabled = false;
                if (d) reload();
              }).catch(function (e) {
                am.disabled = false;
                say(body, (e && e.message) || 'Apple Music did not connect. Try again.', true);
              });
            });
            acts.appendChild(am);
          }
          if (s.connector === 'webhook') {
            var mint = btn(s.connected ? 'Make a new address' : 'Make my ' + s.name + ' address', s.connected ? 'ow-btn--quiet' : '');
            mint.addEventListener('click', function () {
              mint.disabled = true;
              act('POST', BASE + '/sources/' + encodeURIComponent(s.id) + '/hook').then(function (d) {
                mint.disabled = false;
                if (d && d.hook) { shown[s.id] = { hook: d.hook, said: d.said || '' }; paint(d); }
              });
            });
            acts.appendChild(mint);
          }
          if (s.connected && s.connector !== 'oneway') {
            var off = btn('Disconnect', 'ow-btn--quiet'), armed = 0;     /* asks once by asking twice, as Log out does */
            off.addEventListener('click', function () {
              if (!armed) { armed = global.setTimeout(function () { armed = 0; off.textContent = 'Disconnect'; }, 3200); off.textContent = 'Tap again to disconnect'; return; }
              global.clearTimeout(armed); armed = 0; off.disabled = true;
              act('DELETE', BASE + '/sources/' + encodeURIComponent(s.id) + '/connection').then(function () { delete shown[s.id]; reload(); });
            });
            acts.appendChild(off);
          }
          if (acts.children.length) card.appendChild(acts);
          /* A PRIVATE ADDRESS IS SHOWN ONCE, right after it is made: the server keeps only its hash */
          if (shown[s.id]) {
            var box = mk('div', 'ow-pres-hook');
            var input = doc.createElement('input'); input.type = 'text'; input.readOnly = true; input.value = shown[s.id].hook;
            input.setAttribute('aria-label', 'Your ' + s.name + ' address');
            input.addEventListener('focus', function () { input.select(); });
            box.appendChild(input);
            var copy = btn('Copy', 'ow-btn--quiet');
            copy.addEventListener('click', function () {
              try { global.navigator.clipboard.writeText(shown[s.id].hook).then(function () { if (OW.toast) OW.toast('Copied.', { tone: 'ok' }); }); }
              catch (_) { input.select(); }
            });
            box.appendChild(copy);
            if (shown[s.id].said) line(box, shown[s.id].said, 'ow-set__say');
            card.appendChild(box);
          }
          into.appendChild(card);
        }
        function paint(d) {
          body.innerHTML = '';
          var auds = d.audiences || [];
          line(body, 'Share what you are playing, listening to, watching or streaming, and when you are busy. Every source '
            + 'is off until you turn it on, and each one is seen only by the people you choose.');
          var now = sec('What people see now');
          var acts = d.activities || [];
          if (!acts.length) line(now, 'Nothing right now.', 'ow-set__say');
          acts.forEach(function (a) {
            var row = mk('div', 'ow-pres-row ow-pres-now');
            row.innerHTML = OW.presence ? OW.presence.activityLine(a) : esc(a.title);
            now.appendChild(row);
          });
          var on = sec('Online status');
          audiences(on, 'Who sees when you are online', d.status_audience, auds, function (v) {
            return act('PUT', BASE, { status: d.chosen || '', status_audience: v });
          });
          var list = (d.sources || []).filter(function (s) { return s.connectable && !SKIP[s.connector]; });
          var groups = [['Connected', list.filter(function (s) { return s.connected && s.connector !== 'oneway'; })],
                        ['On Oneway', list.filter(function (s) { return s.connector === 'oneway'; })],
                        ['Connect a source', list.filter(function (s) { return !s.connected && s.set_up; })]];
          groups.forEach(function (g) {
            if (!g[1].length) return;
            var el = sec(g[0]);
            g[1].forEach(function (s) { source(el, s, auds); });
          });
          /* A SOURCE THIS SERVER HAS NO KEYS FOR is named, never offered: a button that cannot work is not drawn */
          var later = list.filter(function (s) { return !s.connected && !s.set_up; });
          if (later.length) line(sec('Not set up on this server yet'), later.map(function (s) { return s.name; }).join(', ') + '.', 'ow-set__say');
          /* A PLATFORM WITH NO OFFICIAL WAY IN is named with the server's reason, never faked */
          var none = (d.sources || []).filter(function (s) { return s.connector === 'none' && s.why; });
          if (none.length) {
            var nx = sec('Not possible yet');
            none.forEach(function (s) { line(nx, s.name + ': ' + s.why + '.', 'ow-set__say'); });
          }
          setValue('presence', list.filter(function (s) { return s.enabled; }).length
            ? list.filter(function (s) { return s.enabled; }).length + ' on' : 'Off');
        }
        body.innerHTML = '';
        line(body, 'Loading…');
        reload();
      }

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
            ? on + ' connected.'
            : 'Nothing is sent unless you pick it on a post.'));
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
        /* drawn as the theme menu draws (S32): each tile shows the same platforms' marks as they will look on links and posts */
        var marksPic = function (mono) {
          return ['instagram', 'tiktok', 'youtube'].map(function (k) {
            var ic = OW.links && OW.links.icon ? OW.links.icon(k) : '';
            var hue = !mono && OW.links && OW.links.hueOf ? OW.links.hueOf(k) : '';
            return '<span style="display:grid;color:' + (hue || 'currentColor') + '">' + ic + '</span>';
          }).join('');
        };
        if (OW.lookMenu && OW.lookMenu.choice && OW.marks) {
          OW.lookMenu.choice(sec, { title: 'Platform logos', get: function () { return OW.marks.get(); }, set: function (v) { OW.marks.set(v); },
            options: [{ value: 'color', label: 'Colour', note: 'Each in its own colour', picture: marksPic(false) },
                      { value: 'mono', label: 'Black and white', note: 'All in your ink', picture: marksPic(true) }] });
          body.appendChild(sec);
        } else {
          sec.appendChild(mk('span', 'ow-cust__lbl', 'Platform logos'));
          var row = mk('button', 'ow-switch'); row.type = 'button';
          var on = !(OW.marks && OW.marks.get() === 'mono');
          row.setAttribute('aria-pressed', String(on));
          row.innerHTML = '<span class="ow-switch__b"><b>Colour logos</b></span><span class="ow-switch__k" aria-hidden="true"></span>';
          row.addEventListener('click', function () {
            var next = row.getAttribute('aria-pressed') !== 'true';
            row.setAttribute('aria-pressed', String(next));
            if (OW.marks) OW.marks.set(next ? 'color' : 'mono');
          });
          sec.appendChild(row);
          body.appendChild(sec);
        }
      }

      /* ── LIKES AND DISLIKES (the founder, 2026-10-09: "give users the option in settings and appeance to choose
         between likes and dislikes (facebook) and instagram likes and dislikes maximize it"). The App's own choice
         row, each option drawn with the marks it gives; pressing one redraws every like on screen (OW.likes). */
      function likesRow(body) {
        if (!OW.likes) return;
        /* drawn as the theme menu draws (S32; founder/863 of that menu: "want to see more like it"): each tile is the pair of
           marks it gives, lit as on a Post, with no sentence about it */
        var sec = mk('div', 'ow-cust__row'); body.appendChild(sec);
        var lit = function (g, hue) { return '<span class="ow-ap__gl" style="color:' + hue + '">' + OW.glyph(g) + '</span><b>12</b><span class="ow-ap__gl">' + OW.glyph('thumbdown') + '</span><b>1</b>'; };
        if (OW.lookMenu && OW.lookMenu.choice) {
          OW.lookMenu.choice(sec, { title: 'Likes', get: function () { return OW.likes.get(); }, set: function (v) { OW.likes.set(v); },
            options: [{ value: 'instagram', label: 'Hearts', note: 'A heart to like', picture: lit('heart', '#ff3b5c') },
                      { value: 'facebook', label: 'Thumbs', note: 'A thumb up to like', picture: lit('thumbup', '#2d88ff') }] });
          return;
        }
        sec.appendChild(mk('span', 'ow-cust__lbl', 'Likes and dislikes'));
        var row = mk('div', 'ow-choice ow-likepick');
        row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Likes and dislikes');
        /* the keys stay what the App stored ('instagram', 'facebook'); no other app's name is said to a person */
        [['instagram', 'Hearts', 'heart'], ['facebook', 'Thumbs', 'thumbup']].forEach(function (o) {
          var b = mk('button', 'po-act'); b.type = 'button';
          var on = OW.likes.get() === o[0];
          b.setAttribute('aria-pressed', String(on)); b.setAttribute('data-act', on ? 'on' : 'off');
          b.innerHTML = '<span class="ow-likepick__g">' + OW.glyph(o[2]) + OW.glyph('thumbdown') + '</span><b>' + esc(o[1]) + '</b>';
          b.addEventListener('click', function () {
            OW.likes.set(o[0]);
            Array.prototype.forEach.call(row.children, function (x) {
              var y = x === b; x.setAttribute('aria-pressed', String(y)); x.setAttribute('data-act', y ? 'on' : 'off');
            });
          });
          row.appendChild(b);
        });
        sec.appendChild(row);
      }

      /* THE PERSON'S OWN LOOK: name font, colour, banner and picture.
         The theme, plain background and simple mode rows come from the old sections above, so the panel is asked
         not to draw its own copies of them. */
      function lookRows(body) {
        var wrap = mk('div', 'ow-look');
        body.appendChild(wrap);
        ownStyle().then(function (style) {
          appearance(wrap, style, email, { look: true });
        });
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
      appearance(wrap, style, email || data.me() || '');
      return 1;
    });
  };

  /* THE OLD PAGE IS THE RECORD TAB of the new one (home.js OW.live.activityFeed): what you did here, and who can see it */
  OW.live.activityRecord = function (host) { return activityCentre(host); };
  OW.live.activity = function (host) {
    if (typeof OW.live.activityFeed === 'function') return OW.live.activityFeed(host);
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
    /* ── A CALENDAR, NOT CARDS WITH DATES (the founder, 2026-10-10: "a users calaendar on the app should have the
       option of displaying like apple and google clandar not cards with dates on them bad news" and "being able
       to interact with the web"). Month, week and day views with the hours drawn, today marked, items placed at
       their hour; the list is kept as one view (Agenda). Each item can be added to Google Calendar (a link) or to
       Apple and any other calendar (an .ics file), and the whole coming calendar exports as one .ics.

       THE TIME IS STILL THE PLACE'S: the hour is read off the commitment's own local time and never converted.
       An exported time is written the same way, floating (no zone), so it lands on the clock the place keeps.
       NOT HERE YET: a subscribable feed (webcal) — that is a token in an address and goes to B first. */
    var HOUR = 48;                                  /* px an hour in the day and week grids */
    /* the categories' names and colours (what they are for is with catOf, below the return: function declarations
       are hoisted, these values are not, so they live up here) */
    var CAT_ORDER = ['event', 'stay', 'dining', 'booking', 'plan'];
    var CAT_LABEL = { event: 'Events', stay: 'Stays', dining: 'Dining', booking: 'Bookings', plan: 'Plans' };
    var CAT_COLOR = { event: '#7c5cff', stay: '#13a899', dining: '#f08a2c', booking: '#3b82f6', plan: '#d9467f' };
    var CAT_SPARE = ['#8a6df0', '#2fa7c9', '#c9a227', '#7fb23a', '#d9467f'];
    var VIEWS = [['agenda', 'Agenda'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']];
    var view = 'month';
    try {
      var saved = global.localStorage.getItem('ow_cal_view');
      if (saved && VIEWS.some(function (v) { return v[0] === saved; })) view = saved;
    } catch (e) {}
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
                   place: x.place || x.center || '',
                   sub: [x.place || x.center || '', nights > 0 ? nights + (nights === 1 ? ' night' : ' nights') : '', who]
                          .filter(Boolean).join(' \u00b7 '),
                   kind: kind, cat: catOf(x), status: x.status || '', center: x.center_id || '', id: x.id,
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
      paint(items);
      return items.length;
    });

    function paint(all) {
      var items = all, coming = [], hidden = hiddenCats();
      var now = new Date();
      var today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
      var todayKey = key(today);
      var cur = { y: today.y, m: today.m, d: today.d };          /* the day the views are on */
      var wrap = mk('div', 'ow-cal ow-cal2');
      var head = mk('div', 'ow-cal__head');
      head.appendChild(mk('h1', 'ow-cal__h', 'Calendar'));
      var cnt = mk('span', 'ow-cal__n', '');
      head.appendChild(cnt);
      wrap.appendChild(head);

      /* the view switcher, the way Settings' Theme row is one */
      var seg = mk('div', 'ow-seg ow-cal2__views'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Calendar view');
      var segBtns = {};
      VIEWS.forEach(function (v) {
        var b = mk('button', 'ow-seg__b', esc(v[1])); b.type = 'button'; b.setAttribute('data-view', v[0]);
        b.addEventListener('click', function () { setView(v[0]); });
        segBtns[v[0]] = b; seg.appendChild(b);
      });
      wrap.appendChild(seg);

      /* the categories: a chip each, on or off, in the colour its items are drawn in */
      var present = {};
      all.forEach(function (x) { present[x.cat] = (present[x.cat] || 0) + 1; });
      var order = CAT_ORDER.filter(function (c) { return present[c]; })
        .concat(Object.keys(present).filter(function (c) { return CAT_ORDER.indexOf(c) < 0; }));
      var chipEls = {};
      if (order.length > 1) {
        var cats = mk('div', 'ow-cal2__cats'); cats.setAttribute('role', 'group'); cats.setAttribute('aria-label', 'Categories');
        order.forEach(function (c) {
          var b = mk('button', 'ow-cal2__cat'); b.type = 'button';
          b.innerHTML = '<i></i><span>' + esc(catLabel(c)) + '</span><em>' + present[c] + '</em>';
          tint(b, c);
          b.addEventListener('click', function () {
            if (hidden[c]) delete hidden[c]; else hidden[c] = 1;
            saveHidden(hidden); draw();
          });
          chipEls[c] = b; cats.appendChild(b);
        });
        wrap.appendChild(cats);
      }

      /* where the view is: previous, the span's name, next, and Today */
      var nav = mk('div', 'ow-cal2__nav');
      var prev = mk('button', 'ow-cal2__step', setIcon('back')); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous');
      var next = mk('button', 'ow-cal2__step ow-cal2__step--next', setIcon('back')); next.type = 'button'; next.setAttribute('aria-label', 'Next');
      var title = mk('h2', 'ow-cal2__title');
      var tod = mk('button', 'ow-btn ow-btn--quiet ow-cal2__today', 'Today'); tod.type = 'button';
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      tod.addEventListener('click', function () { cur = { y: today.y, m: today.m, d: today.d }; draw(); });
      nav.appendChild(title); nav.appendChild(prev); nav.appendChild(next); nav.appendChild(tod);
      wrap.appendChild(nav);

      var body = mk('div', 'ow-cal2__body');
      wrap.appendChild(body);

      /* take the coming calendar out as one file */
      var out = mk('div', 'ow-cal2__out');
      var exp = mk('button', 'ow-btn ow-btn--quiet', 'Export to a calendar app (.ics)'); exp.type = 'button';
      exp.addEventListener('click', function () {
        var list = coming.length ? coming : items;
        download('oneway-calendar.ics', ics(list));
      });
      out.appendChild(exp);
      wrap.appendChild(out);
      host.appendChild(wrap);
      draw();

      function setView(v) {
        view = v;
        try { global.localStorage.setItem('ow_cal_view', v); } catch (e) {}
        draw();
      }
      function step(n) {
        var dt = new Date(cur.y, cur.m - 1, cur.d);
        if (view === 'month') dt = new Date(cur.y, cur.m - 1 + n, 1);
        else if (view === 'week') dt = new Date(cur.y, cur.m - 1, cur.d + 7 * n);
        else dt = new Date(cur.y, cur.m - 1, cur.d + n);
        cur = { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
        if (view === 'month' && cur.y === today.y && cur.m === today.m) cur.d = today.d;
        draw();
      }

      function refresh() {
        items = all.filter(function (x) { return !hidden[x.cat]; });
        coming = items.filter(function (x) { return x.key >= todayKey || (x.until && x.until.key >= todayKey); });
        cnt.textContent = coming.length ? coming.length + ' coming up' : 'Nothing coming up';
        Object.keys(chipEls).forEach(function (c) {
          chipEls[c].setAttribute('aria-pressed', String(!hidden[c]));
        });
      }

      function draw() {
        refresh();
        VIEWS.forEach(function (v) {
          var isOn = v[0] === view;
          segBtns[v[0]].setAttribute('aria-pressed', String(isOn));
          segBtns[v[0]].setAttribute('data-act', isOn ? 'on' : 'off');
        });
        body.innerHTML = '';
        body.setAttribute('data-view', view);
        nav.hidden = view === 'agenda';
        title.textContent = spanTitle();
        if (view === 'month') paintMonth();
        else if (view === 'week') paintWeek();
        else if (view === 'day') paintDay();
        else paintAgenda();
      }

      function spanTitle() {
        var dt = new Date(cur.y, cur.m - 1, cur.d);
        if (view === 'month') return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (view === 'day') return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        var s = weekStart(cur), e = addDays(s, 6);
        var a = new Date(s.y, s.m - 1, s.d), b = new Date(e.y, e.m - 1, e.d);
        var same = a.getMonth() === b.getMonth();
        return a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' \u2013 '
          + (same ? String(b.getDate()) : b.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
          + ', ' + b.getFullYear();
      }

      /* what is on a day: its own, and a stay's every day from check-in to check-out */
      function on(k) {
        return items.filter(function (x) { return x.key === k || (x.until && x.until.key !== x.key && k > x.key && k <= x.until.key); });
      }
      function span(x) { return !!(x.until && x.until.key !== x.key); }
      function addDays(p, n) { var dt = new Date(p.y, p.m - 1, p.d + n); return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }; }
      function weekStart(p) { var dt = new Date(p.y, p.m - 1, p.d); return addDays(p, -dt.getDay()); }
      function dow(p) { return new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, { weekday: 'short' }); }

      /* ── MONTH: the grid, dots for what is on a day, and the chosen day's own list under it ── */
      function paintMonth() {
        var first = { y: cur.y, m: cur.m, d: 1 };
        var lead = new Date(first.y, first.m - 1, 1).getDay();
        var start = addDays(first, -lead);
        var grid = mk('div', 'ow-cal2__month'); grid.setAttribute('role', 'grid');
        for (var i = 0; i < 7; i++) {
          grid.appendChild(mk('span', 'ow-cal2__dow', esc(dow(addDays(start, i)).slice(0, 3))));
        }
        var weeks = Math.ceil((lead + new Date(cur.y, cur.m, 0).getDate()) / 7);
        for (var c = 0; c < weeks * 7; c++) {
          (function (p) {
            var k = key(p), list = on(k);
            var b = mk('button', 'ow-cal2__cell'); b.type = 'button';
            b.setAttribute('data-key', k);
            if (k === todayKey) b.setAttribute('data-today', '1');
            if (p.m !== cur.m) b.setAttribute('data-out', '1');
            if (k === key(cur)) { b.setAttribute('data-sel', '1'); b.setAttribute('aria-pressed', 'true'); }
            b.setAttribute('aria-label', new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              + (list.length ? ', ' + list.length + (list.length === 1 ? ' item' : ' items') : ''));
            var dots = '';
            list.slice(0, 3).forEach(function (x) { dots += '<i data-cat="' + esc(x.cat) + '" style="--cat:' + catColor(x.cat) + '"></i>'; });
            b.innerHTML = '<span class="ow-cal2__num">' + p.d + '</span><span class="ow-cal2__dots">' + dots
              + (list.length > 3 ? '<em>+' + (list.length - 3) + '</em>' : '') + '</span>';
            b.setAttribute('data-n', String(list.length));
            b.addEventListener('click', function () { cur = { y: p.y, m: p.m, d: p.d }; draw(); });
            grid.appendChild(b);
          })(addDays(start, c));
        }
        body.appendChild(grid);
        paintDayList(body, cur);
      }

      /* the list under the month, and the Day view's all-day strip share one row */
      function paintDayList(into, p) {
        var k = key(p), list = on(k);
        var sec = mk('div', 'ow-cal2__list');
        sec.appendChild(mk('h3', 'ow-cal__day', esc(dayWord(p))));
        if (!list.length) sec.appendChild(mk('p', 'ow-cal2__none', 'Nothing planned.'));
        list.forEach(function (x) { sec.appendChild(itemRow(x)); });
        into.appendChild(sec);
      }

      /* ── DAY AND WEEK: the hours drawn, an item at its hour, a stay across the top ── */
      function paintDay() { paintHours([cur]); }
      function paintWeek() {
        var s = weekStart(cur), days = [];
        for (var i = 0; i < 7; i++) days.push(addDays(s, i));
        paintHours(days);
      }
      function paintHours(days) {
        var multi = days.length > 1;
        var box = mk('div', 'ow-cal2__hours'); box.setAttribute('data-cols', String(days.length)); box.style.setProperty('--cols', String(days.length));
        var heads = mk('div', 'ow-cal2__dh');
        heads.appendChild(mk('span', 'ow-cal2__gut'));
        days.forEach(function (p) {
          var b = mk('button', 'ow-cal2__dhb'); b.type = 'button';
          if (key(p) === todayKey) b.setAttribute('data-today', '1');
          if (key(p) === key(cur)) b.setAttribute('data-sel', '1');
          b.innerHTML = '<span>' + esc(dow(p)) + '</span><b>' + p.d + '</b>';
          if (multi) b.addEventListener('click', function () { cur = { y: p.y, m: p.m, d: p.d }; setView('day'); });
          heads.appendChild(b);
        });
        box.appendChild(heads);
        /* all-day and multi-day: a stay is a bar, not an hour */
        var strip = mk('div', 'ow-cal2__allday'), any = false;
        strip.appendChild(mk('span', 'ow-cal2__gut', 'all day'));
        days.forEach(function (p) {
          var cell = mk('div', 'ow-cal2__adc');
          on(key(p)).filter(function (x) { return span(x) || x.at.h == null; }).forEach(function (x) {
            any = true;
            var chip = itemButton(x, 'ow-cal2__chip');
            chip.innerHTML = '<span>' + esc(x.title) + '</span>';
            cell.appendChild(chip);
          });
          strip.appendChild(cell);
        });
        if (any) box.appendChild(strip);
        /* the hours */
        var scroll = mk('div', 'ow-cal2__scroll');
        var gutter = mk('div', 'ow-cal2__hlabels');
        for (var h = 0; h < 24; h++) {
          var lb = mk('span', 'ow-cal2__hl', esc(h === 0 ? '' : (((h + 11) % 12) + 1) + (h < 12 ? ' AM' : ' PM')));
          lb.style.top = (h * HOUR) + 'px';
          gutter.appendChild(lb);
        }
        gutter.style.height = (24 * HOUR) + 'px';
        var cols = mk('div', 'ow-cal2__cols');
        cols.style.height = (24 * HOUR) + 'px';
        var earliest = 24;
        days.forEach(function (p, ci) {
          var col = mk('div', 'ow-cal2__col'); col.setAttribute('data-key', key(p));
          col.style.left = (ci * 100 / days.length) + '%'; col.style.width = (100 / days.length) + '%';
          var timed = on(key(p)).filter(function (x) { return !span(x) && x.at.h != null && x.key === key(p); })
            .map(function (x) {
              var s = x.at.h * 60 + x.at.mi, e = s + 60;
              if (x.until && x.until.key === x.key && x.until.h != null) e = Math.max(s + 30, x.until.h * 60 + x.until.mi);
              e = Math.min(e, 24 * 60);
              return { x: x, s: s, e: e, lane: 0, n: 1 };
            });
          lanes(timed);
          timed.forEach(function (t) {
            earliest = Math.min(earliest, Math.floor(t.s / 60));
            var b = itemButton(t.x, 'ow-cal2__blk');
            b.style.top = (t.s * HOUR / 60) + 'px';
            b.style.height = Math.max(30, (t.e - t.s) * HOUR / 60 - 2) + 'px';
            b.style.left = (t.lane * 100 / t.n) + '%'; b.style.width = (100 / t.n) + '%';
            b.setAttribute('data-start', String(t.s));
            b.innerHTML = '<b>' + esc(t.x.title) + '</b>' + (multi ? '' : '<span>' + esc(clock(t.x.at)) + '</span>');
            col.appendChild(b);
          });
          if (key(p) === todayKey) {
            var nl = mk('i', 'ow-cal2__now');
            nl.style.top = ((now.getHours() * 60 + now.getMinutes()) * HOUR / 60) + 'px';
            col.appendChild(nl);
          }
          cols.appendChild(col);
        });
        var gridWrap = mk('div', 'ow-cal2__sc');
        gridWrap.appendChild(gutter); gridWrap.appendChild(cols);
        scroll.appendChild(gridWrap);
        box.appendChild(scroll);
        body.appendChild(box);
        /* open on the first hour anything happens (an hour above it), else the morning */
        var top = (earliest === 24 ? 8 : Math.max(0, earliest - 1)) * HOUR;
        scroll.scrollTop = top;
        global.setTimeout(function () { scroll.scrollTop = top; }, 0);
        if (!multi) {
          var sel = mk('div', 'ow-cal2__dayitems');
          var list = on(key(cur));
          if (list.length) { sel.appendChild(mk('h3', 'ow-cal__day', esc(dayWord(cur)))); list.forEach(function (x) { sel.appendChild(itemRow(x)); }); }
          body.appendChild(sel);
        }
      }

      /* two items at one hour sit side by side: lanes within each run of overlaps */
      function lanes(list) {
        var cluster = [], end = -1;
        function flush() {
          var n = 0; cluster.forEach(function (c) { n = Math.max(n, c.lane + 1); });
          cluster.forEach(function (c) { c.n = n; }); cluster = []; end = -1;
        }
        list.sort(function (a, b) { return a.s - b.s || a.e - b.e; }).forEach(function (t) {
          if (cluster.length && t.s >= end) flush();
          var used = cluster.filter(function (c) { return c.e > t.s; }).map(function (c) { return c.lane; });
          var l = 0; while (used.indexOf(l) >= 0) l++;
          t.lane = l; cluster.push(t); end = Math.max(end, t.e);
        });
        flush();
      }

      /* ── AGENDA: what the page was — the days in order, with what is earlier behind a button ── */
      function paintAgenda() {
        var past = items.filter(function (x) { return coming.indexOf(x) < 0; });
        if (coming.length) {
          var lastKey = '';
          coming.forEach(function (x) {
            if (x.key !== lastKey) { lastKey = x.key; body.appendChild(mk('h3', 'ow-cal__day', esc(dayWord(x.at)))); }
            body.appendChild(itemRow(x));
          });
        } else body.appendChild(mk('p', 'ow-set__lede', 'What you book and the events you are going to appear here.'));
        if (past.length) {
          var more = mk('button', 'ow-btn ow-btn--quiet', 'Earlier \u00b7 ' + past.length); more.type = 'button';
          more.addEventListener('click', function () {
            more.remove();
            var old = mk('div', 'ow-cal__past');
            old.appendChild(mk('h2', 'ow-cal__earlier', 'Earlier'));
            var lk = '';
            past.slice().reverse().forEach(function (x) {
              if (x.key !== lk) { lk = x.key; old.appendChild(mk('h3', 'ow-cal__day', esc(dayWord(x.at)))); }
              old.appendChild(itemRow(x));
            });
            body.appendChild(old);
          });
          body.appendChild(more);
        }
      }

      /* ── ONE ITEM ──────────────────────────────────────────────────────────────── */
      function open(x) {
        /* an event opens itself; a booking opens the place it is at */
        try {
          if (x.event) global.location.hash = '#event/' + encodeURIComponent(x.event);
          else if (x.center) global.location.hash = '#center/' + encodeURIComponent(x.center);
        } catch (e) {}
      }
      function itemButton(x, cls) {
        var b = mk('button', cls); b.type = 'button';
        b.setAttribute('aria-label', x.title + ', ' + clock(x.at) + (x.sub ? ', ' + x.sub : ''));
        tint(b, x.cat);
        if (x.event || x.center) b.addEventListener('click', function () { open(x); }); else b.disabled = true;
        return b;
      }
      function itemRow(x) {
        var wrapRow = mk('div', 'ow-cal2__item');
        var b = mk('button', 'ow-cal__row'); b.type = 'button';
        tint(b, x.cat);
        b.innerHTML = '<span class="ow-cal__time"><b>' + esc(clock(x.at)) + '</b>'
          + '<span>' + esc(x.kind) + '</span></span>'
          + '<span class="ow-cal__b"><span class="ow-cal__t">' + esc(x.title) + '</span>'
          + (x.sub ? '<span class="ow-cal__s">' + esc(x.sub) + '</span>' : '')
          + (x.until && x.until.key !== x.key ? '<span class="ow-cal__s">Until ' + esc(dayWord(x.until)) + ', ' + esc(clock(x.until)) + '</span>' : '')
          + '</span>'
          + (x.status ? '<span class="ow-cal__st" data-status="' + esc(x.status) + '">' + esc(x.status.charAt(0).toUpperCase() + x.status.slice(1)) + '</span>' : '');
        if (x.event || x.center) b.addEventListener('click', function () { open(x); }); else b.disabled = true;
        wrapRow.appendChild(b);
        var add = mk('div', 'ow-cal2__add');
        var tg = mk('button', 'ow-cal2__addt', 'Add to calendar'); tg.type = 'button'; tg.setAttribute('aria-expanded', 'false');
        var opts = mk('span', 'ow-cal2__addo'); opts.hidden = true;
        var g = mk('a', 'ow-cal2__addb', 'Google Calendar');
        g.href = googleUrl(x); g.target = '_blank'; g.rel = 'noopener noreferrer';
        g.setAttribute('data-add', 'google');
        opts.appendChild(g);
        var ap = mk('button', 'ow-cal2__addb', 'Apple Calendar'); ap.type = 'button'; ap.setAttribute('data-add', 'ics');
        ap.addEventListener('click', function () { download(slug(x.title) + '.ics', ics([x])); });
        opts.appendChild(ap);
        tg.addEventListener('click', function () {
          var show = opts.hidden; opts.hidden = !show; tg.setAttribute('aria-expanded', String(show));
        });
        add.appendChild(tg); add.appendChild(opts);
        wrapRow.appendChild(add);
        return wrapRow;
      }

      function dayWord(p) {
        var tomorrowKey = key(addDays(today, 1));
        if (p.key === undefined) p = { y: p.y, m: p.m, d: p.d, key: key(p) };
        if (p.key === todayKey) return 'Today';
        if (p.key === tomorrowKey) return 'Tomorrow';
        var dt = new Date(p.y, p.m - 1, p.d);
        var o = { weekday: 'short', day: 'numeric', month: 'short' };
        if (p.y !== today.y) o.year = 'numeric';
        return dt.toLocaleDateString(undefined, o);
      }
    }

    /* ── GOING TO A CALENDAR: an .ics (Apple, Outlook, anything) and Google's own "add" link ───────────── */
    function stamp(p, dateOnly) {
      var s = p.y + ('0' + p.m).slice(-2) + ('0' + p.d).slice(-2);
      return dateOnly ? s : s + 'T' + ('0' + (p.h || 0)).slice(-2) + ('0' + (p.mi || 0)).slice(-2) + '00';
    }
    function endOf(x) {
      /* the end as the commitment states it; else an hour after the start; a day with no hour is that day */
      if (x.at.h == null) return { p: addOne(x.until || x.at), dateOnly: true };
      if (x.until && x.until.h != null) return { p: x.until, dateOnly: false };
      var m = x.at.h * 60 + x.at.mi + 60;
      return { p: { y: x.at.y, m: x.at.m, d: x.at.d, h: Math.min(23, Math.floor(m / 60)), mi: m >= 1440 ? 59 : m % 60 }, dateOnly: false };
    }
    function addOne(p) { var dt = new Date(p.y, p.m - 1, p.d + 1); return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }; }
    function googleUrl(x) {
      var e = endOf(x), dateOnly = x.at.h == null;
      var q = 'action=TEMPLATE&text=' + encodeURIComponent(x.title)
        + '&dates=' + stamp(x.at, dateOnly) + '/' + stamp(e.p, dateOnly)
        + (x.place ? '&location=' + encodeURIComponent(x.place) : '')
        + '&details=' + encodeURIComponent(x.sub ? x.sub : 'From Oneway');
      return 'https://calendar.google.com/calendar/render?' + q;
    }
    function esc2(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function fold(line) {
      var out = [], s = line;
      while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); }
      out.push(s);
      return out.join('\r\n');
    }
    function ics(list) {
      var n = new Date();
      var utc = n.getUTCFullYear() + ('0' + (n.getUTCMonth() + 1)).slice(-2) + ('0' + n.getUTCDate()).slice(-2) + 'T'
        + ('0' + n.getUTCHours()).slice(-2) + ('0' + n.getUTCMinutes()).slice(-2) + ('0' + n.getUTCSeconds()).slice(-2) + 'Z';
      var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oneway//Calendar//EN', 'CALSCALE:GREGORIAN'];
      list.forEach(function (x) {
        var e = endOf(x), dateOnly = x.at.h == null;
        L.push('BEGIN:VEVENT');
        L.push('UID:' + String(x.id || x.title + x.at.sort).replace(/[^A-Za-z0-9_.-]/g, '') + '@oneway.center');
        L.push('DTSTAMP:' + utc);
        L.push(dateOnly ? 'DTSTART;VALUE=DATE:' + stamp(x.at, true) : 'DTSTART:' + stamp(x.at, false));
        L.push(dateOnly ? 'DTEND;VALUE=DATE:' + stamp(e.p, true) : 'DTEND:' + stamp(e.p, false));
        L.push('SUMMARY:' + esc2(x.title));
        if (x.place) L.push('LOCATION:' + esc2(x.place));
        if (x.sub) L.push('DESCRIPTION:' + esc2(x.sub));
        L.push('END:VEVENT');
      });
      L.push('END:VCALENDAR');
      return L.map(fold).join('\r\n') + '\r\n';
    }
    function slug(t) { return String(t || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event'; }
    function download(name, text) {
      try {
        var blob = new global.Blob([text], { type: 'text/calendar;charset=utf-8' });
        var url = global.URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = url; a.download = name; a.style.display = 'none';
        doc.body.appendChild(a); a.click();
        global.setTimeout(function () { a.remove(); global.URL.revokeObjectURL(url); }, 4000);
      } catch (e) { if (OW.toast) OW.toast('That did not download. Try again.'); }
    }

    /* ── CATEGORIES (the founder, 2026-10-10: "google calendar apple calendar but simpler to use and more optional
       categories"). What a commitment is — an event, a stay, a table, a booking, a plan — each with its own colour, each
       switched on or off by the person, and remembered on this device. The chips appear only when there is more than
       one kind to choose between, so a person with one kind of thing sees no controls at all. */
    function catOf(x) {
      var tk = String((x.thing && x.thing.kind) || '').toLowerCase();
      if (x.kind === 'event') return 'event';
      if (x.kind === 'reservation') {
        if (tk === 'room' || tk === 'suite' || tk === 'stay') return 'stay';
        if (/^(table|dining|restaurant|meal|seat)/.test(tk)) return 'dining';
        return 'booking';
      }
      return String(x.kind || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    function catLabel(c) { return CAT_LABEL[c] || (c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ')); }
    function catColor(c) {
      if (CAT_COLOR[c]) return CAT_COLOR[c];
      var h = 0; for (var i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0;
      return CAT_SPARE[h % CAT_SPARE.length];
    }
    function tint(el, c) { el.setAttribute('data-cat', c); el.style.setProperty('--cat', catColor(c)); return el; }
    function hiddenCats() {
      var o = {};
      try { (JSON.parse(global.localStorage.getItem('ow_cal_hidden') || '[]') || []).forEach(function (c) { o[c] = 1; }); } catch (e) {}
      return o;
    }
    function saveHidden(o) { try { global.localStorage.setItem('ow_cal_hidden', JSON.stringify(Object.keys(o).filter(function (c) { return o[c]; }))); } catch (e) {} }

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

  /* ═══ UNDERSTANDING, AS A SCREEN (the founder, 2026-10-10: "understanding also bad"; founder/714: a screen that is a menu of
     cards "will not be satisfactory ... and they dont even match the popit styling") ═══════════════════════════════════
     It was the Brain's counts and every node it held drawn as the same dark bar, eleven of them, with the Ask box floating
     over the middle. It is one composition now, of what Oneway actually holds, in the App's own material:
       the Brain's sentence is the headline, its observations under it;
       three numbers (places, things made, friends) and the rhythm;
       the places as a shelf of tiles, the people as faces, what was made as the App's real post cards;
       what is strongest, then the Ask.
     NOTHING IS INVENTED: each part is drawn only from what the two reads say, and a part with nothing to say is absent
     rather than a heading over an empty row. The reads are unchanged (me/brain, brain/narrative, brain/intelligence). */
  function understandingPage(host) {
    host.className = ''; host.innerHTML = '';
    var wrap = mk('div', 'ow-und');
    host.appendChild(wrap);
    /* kept true while open (the page it replaces is gone with the old wrapper, and so is the old watcher) */
    OW.onChanged(wrap, function () { understandingPage(host); }, { wait: 1500 });
    loading(wrap, 3);
    return Promise.all([
      data.get('/api/oneway/people/me/brain'),
      data.get('/api/oneway/people/me/brain/narrative').catch(function () { return { ok: false }; }),
      data.get('/api/oneway/people/me/brain/intelligence').catch(function () { return { ok: false }; })
    ]).then(function (res) {
      wrap.innerHTML = '';
      wrap.className = 'ow-und';                  /* the loading helper takes the class off what it is handed */
      var r = res[0], nar = (res[1] && res[1].ok && res[1].data) || {}, intel = (res[2] && res[2].ok && res[2].data) || {};
      if (!r.ok) { refused(wrap, r, 'Your understanding'); return 0; }
      var d = r.data || {}, t = d.totals || {}, nodes = d.nodes || [];
      var by = function (type) { return nodes.filter(function (n) { return n.type === type; }); };
      var places = by('Destination'), people = by('Person'), made = by('Creation'), growth = by('Growth')[0];
      var rest = nodes.filter(function (n) { return ['Destination', 'Person', 'Creation', 'Growth'].indexOf(n.type) < 0; });
      var voice = String(nar.summary || '').trim(), obs = nar.observations || [];

      /* a colour for a name, the same every time, so a tile is recognisable */
      function tile(name) {
        var h = 0, s2 = String(name || '');
        for (var i = 0; i < s2.length; i++) h = (h * 31 + s2.charCodeAt(i)) >>> 0;
        var pair = OW.hue.fromAngle((h % 12) * 30);
        return 'linear-gradient(150deg,rgb(' + pair[0] + '),rgb(' + pair[1] + '))';
      }
      function open(n, el) {
        if (!n || !n.id || !n.opens) return;              /* a summary stays shut */
        if (n.opens === 'destination') openCenterPopit(n.id, el);
        else if (n.opens === 'user') {
          try { doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { ref: n.id, email: n.id } })); } catch (e) {}
        } else if (n.opens === 'post') {
          data.get('/api/posts/' + encodeURIComponent(n.id)).then(function (res) {
            var po = res.ok && res.data && (res.data.post || res.data);
            if (po && (po.body || po.title)) OW.open(postPayload(po), el);
            else OW.say(el, 'that post is no longer here');
          });
        }
      }
      function section(title, sub) {
        var sec = mk('section', 'ow-und__sec');
        var h = mk('h2', 'ow-und__h', esc(title));
        if (sub) h.appendChild(mk('span', '', esc(sub)));
        sec.appendChild(h);
        wrap.appendChild(sec);
        return sec;
      }

      /* the Brain's own sentence first: understanding before counting (INTELLIGENCE.md) */
      if (voice) wrap.appendChild(mk('h1', 'ow-und__voice', esc(voice)));
      if (obs.length) {
        var ol = mk('div', 'ow-und__obs');
        obs.slice(0, 6).forEach(function (o) { if (o && o.text) ol.appendChild(mk('p', 'ow-und__ob', esc(o.text))); });
        wrap.appendChild(ol);
      }
      var anything = nodes.length || t.destinations || t.creations || t.friends;
      if (!anything) {
        /* THE HONEST EMPTY: nothing has happened yet, and nothing is "learning" (founder/542) */
        nothing(wrap, 'This fills in as you join places, share what you make and people follow you back. It only shows what actually happened.', 'Nothing yet');
        brainAsk(wrap);
        return 1;
      }

      /* the numbers, and the rhythm */
      var stats = mk('div', 'ow-und__stats');
      [[t.destinations || 0, 'places you belong to'],
       [String(t.creations || 0) + (t.creations_more ? '+' : ''), 'things you have made'],
       [t.friends || 0, 'friends who follow you back']].forEach(function (x) {
        var b = mk('div', 'ow-und__stat');
        b.appendChild(mk('b', '', esc(String(x[0]))));
        b.appendChild(mk('span', '', esc(x[1])));
        stats.appendChild(b);
      });
      wrap.appendChild(stats);
      if (growth) {
        var rh = mk('div', 'ow-und__rhythm');
        rh.appendChild(mk('b', '', esc(t.streak ? String(t.streak) + (t.streak === 1 ? '-day streak' : '-day streak') : 'No streak yet')));
        rh.appendChild(mk('span', '', esc(growth.meta ? String(growth.meta).replace(/^\d+-day streak\s*[·•]\s*/, '') : '')));
        wrap.appendChild(rh);
      }

      if (places.length) {
        var sp = section('Places', String(t.destinations || places.length));
        var shelf = mk('div', 'ow-und__shelf');
        places.forEach(function (n) {
          var b = mk('button', 'ow-und__place'); b.type = 'button';
          b.style.background = tile(n.name);
          b.innerHTML = '<b>' + esc(n.name) + '</b><span>' + esc(n.meta || '') + '</span>';
          b.addEventListener('click', function () { open(n, b); });
          shelf.appendChild(b);
        });
        sp.appendChild(shelf);
      }
      if (people.length) {
        var sf = section('People', String(t.friends || people.length));
        var row = mk('div', 'ow-und__shelf');
        people.forEach(function (n) {
          var b = mk('button', 'ow-und__face'); b.type = 'button';
          b.innerHTML = '<i style="background:' + tile(n.name) + '">' + esc(String(n.name || '?').charAt(0).toUpperCase()) + '</i><span>' + esc(n.name) + '</span>';
          b.addEventListener('click', function () { open(n, b); });
          row.appendChild(b);
        });
        sf.appendChild(row);
      }
      if (made.length) {
        var sm = section('What you have made', String(t.creations || made.length) + (t.creations_more ? '+' : ''));
        var river = mk('div', 'ow-und__river');
        sm.appendChild(river);
        var firstThree = made.slice(0, 3);
        Promise.all(firstThree.map(function (n) {
          return data.get('/api/posts/' + encodeURIComponent(n.id)).then(function (res) {
            return res.ok && res.data ? (res.data.post || res.data) : null;
          }).catch(function () { return null; });
        })).then(function (posts) {
          var have = posts.filter(function (x) { return x && (x.body || x.title || (x.media || []).length); });
          if (have.length) {
            var rows2 = OW.riverRows(have);
            OW.mountRiver(river, rows2, { open: false });
            rows2.forEach(function (it) { try { OW.mountResponses(river, it); } catch (e) {} });
            Array.prototype.forEach.call(river.querySelectorAll('.po-card'), function (card, i) {
              card.addEventListener('click', function (e) {
                if (e.target.closest && e.target.closest('.po-act, [data-po-respond], [data-po-save], [data-po-who], [data-po-center]')) return;
                var po = have[i];
                if (po) OW.open(postPayload(po), card);
              });
            });
          } else {
            firstThree.forEach(function (n) {           /* the read failed: the words it has, as a tile */
              var b = mk('button', 'ow-und__made'); b.type = 'button';
              b.innerHTML = '<b>' + esc(n.name) + '</b><span>' + esc(n.meta || '') + '</span>';
              b.addEventListener('click', function () { open(n, b); });
              river.appendChild(b);
            });
          }
        });
      }

      /* what is strongest, as the page already read it: a name once, its strongest reading kept */
      var seen = {}, strong = [];
      (intel.spotlights || []).forEach(function (x) {
        var nm = (x && x.name) || '';
        if (!nm) return;
        if (seen[nm] && (seen[nm].strength || 0) >= (x.strength || 0)) return;
        if (seen[nm]) strong = strong.filter(function (y) { return y.name !== nm; });
        seen[nm] = x; strong.push(x);
      });
      if (strong.length) {
        var ss = section('Strongest in your world');
        var words = { rising: 'more this week', falling: 'quieter this week', 'new': 'new this week' };
        var chips = mk('div', 'ow-und__chips');
        strong.slice(0, 8).forEach(function (x) {
          var b = mk('button', 'ow-und__chip'); b.type = 'button';
          b.innerHTML = '<b>' + esc(x.name) + '</b><span>' + esc([x.evidence || '', words[x.moving] || ''].filter(Boolean).join(' · ')) + '</span>';
          b.addEventListener('click', function () { open({ id: x.id || '', opens: x.opens || '' }, b); });
          chips.appendChild(b);
        });
        ss.appendChild(chips);
      }

      /* anything else the Brain holds (a collection, a summary) keeps its row: nothing falls off the page */
      if (rest.length) {
        var so = section('Also');
        var lst = mk('div');
        factList(lst, rest.slice(0, 12).map(function (n, i) {
          return { id: n.id || ('ub-r-' + i), value: n.name || n.type, label: [n.type, n.meta].filter(Boolean).join(' · '),
                   icon: 'spark', opens: n.opens || '', nodeId: n.id || '' };
        }), '', function (row2, el) { open({ id: row2.nodeId, opens: row2.opens }, el); });
        so.appendChild(lst);
      }
      var sa = section('Ask your Brain');
      brainAsk(sa);
      return nodes.length;
    });
  }

  OW.live.understanding = function (host) {
    /* `brainPane` already makes both reads and already decides what happens
       when the narrative fails. Calling it is the whole implementation — an
       earlier version restated the fetches here and referred to a
       `brainRender` that never existed, which rendered an empty surface and
       threw only when something asked it to. */
    return understandingPage(host);
  };


})(window);
