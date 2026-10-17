/* ME AND A PERSON: OW.live.myCenter, OW.live.profile, OW.live.people.
   Moved whole from frontend/app/popit-live.js by tools/boot_split.mjs (the boot split, PLAN §2 App boot row):
   oneway-app.html loads it with OW.need('me') when its screen first opens; index.html loads it by tag. */
(function (global) {
  'use strict';
  var OW = global.OW;
  var _u = OW._u;
  var brainAsk = _u.brainAsk,
      bumpStat = _u.bumpStat,
      data = _u.data,
      doc = _u.doc,
      esc = _u.esc,
      factList = _u.factList,
      imageUrl = _u.imageUrl,
      loading = _u.loading,
      mk = _u.mk,
      nothing = _u.nothing,
      openCenterPopit = _u.openCenterPopit,
      postPayload = _u.postPayload,
      profileShell = _u.profileShell,
      refused = _u.refused,
      signedIn = _u.signedIn,
      stateTile = _u.stateTile,
      toldOnce = _u.toldOnce,
      wearWordmark = _u.wearWordmark;

  function saveMyBanner(style, patch) {
    var sent = Object.assign({}, style, patch, { banner_customized: true });
    delete sent.accent_hue;
    return data.post('/api/oneway/people/me/style', { style: sent }, { method: 'PUT', queueable: true })
      .then(function (r) {
        if (!r.ok && !r.queued) throw new Error('Cover change refused');
        if ((r.data && r.data.refused || []).some(function (f) { return Object.prototype.hasOwnProperty.call(patch, f.field); }))
          throw new Error('Cover choice was not kept');
        Object.assign(style, patch, { banner_customized: true });
        data.invalidate('/api/oneway/people/me/style');
        data.invalidate('/api/oneway/cards');
        return r;
      });
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
  /* WORKPLACE IS NOT MAIN (founder/808: no two tabs with one icon; a cold judge, 2026-10-17: "the first two are near-identical
     person glyphs side by side"): the work a person does, a case with its handle */
  workplace: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/><path d="M9 7.5V6.2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.3"/>'
           + '<path d="M3.5 12.6h17"/>',
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
/* ONE EMPTY STATE ON A TAB (a cold judge, 2026-10-17): the Main tab is the canvas over the profile's own half, and both
   said they were empty, two globes stacked. The profile half's emptiness is marked, so it stands aside when the canvas
   above it has said it, with this door's Make a post among the canvas's (oneway-popit.css, canvas.js). An error is
   never marked, so it is never hidden. */
function emptyMarked(d) { if (d && d.setAttribute) d.setAttribute('data-empty', 'profile'); return d; }
function iconTab(id, label, render, n) {
  return { id: id, label: label, icon: TAB_ICON[id] || '', n: n || 0, render: render };
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
    var hero = mk('div', 'ow-prof__hero');       /* the same hero the full render makes, so nothing jumps */
    hero.appendChild(ban);
    root.appendChild(hero);
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
    hero.appendChild(id);
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
    var email = parts.join(':') || data.me();
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

  function renderWorkplaceProfile(host, email, d, opts) {
    opts = opts || {};
    host.className = 'ow-workplace-profile' + (opts.bare ? ' ow-workplace-profile--bare' : ''); host.innerHTML = '';
    host.setAttribute('data-full', '1');
    var person = d.person || {}, work = d.work_relationship || {}, personal = d.relationship || {};
    host.appendChild(mk('p', 'ow-workplace-profile__label', 'Workplace identity'));
    if (!opts.bare) {
      host.appendChild(mk('h1', '', esc(person.name || 'Someone')));
      host.appendChild(mk('p', 'ow-workplace-profile__username', esc(person.ref || '')));
    }
    var note = d.enabled === false
      ? 'Workplace identity is off. Turn it on in Workplace settings to keep your personal profile separate.'
      : 'Work connections and Center posts. Your personal profile stays separate.';
    host.appendChild(mk('p', 'ow-workplace-profile__note', note));
    var list = mk('div', 'ow-workplace-profile__connections');
    var stats = mk('div', 'ow-workplace-profile__stats');
    ['followers', 'following'].forEach(function (which) {
      if (!d.counts || !(which in d.counts)) return;
      var words = which === 'following' ? 'Following ' + d.counts[which] + ' at work' : d.counts[which] + ' work followers';
      var button = mk('button', 'po-act', esc(words));
      button.type = 'button';
      button.addEventListener('click', function () {
        list.innerHTML = ''; var cursor = '', seen = {};
        var title = mk('h2', '', which === 'followers' ? 'Work followers' : 'Following at work');
        list.appendChild(title);
        function page() {
          return data.get('/api/oneway/workplace/people/' + encodeURIComponent(email) + '/' + which
            + (cursor ? '?before=' + encodeURIComponent(cursor) : '')).then(function (r) {
            if (!r.ok || !r.data || r.data.readable === false) {
              list.appendChild(mk('p', '', 'Work connections could not be loaded.')); return;
            }
            if (r.data.hidden) { list.appendChild(mk('p', '', 'These work connections are not shared with you.')); return; }
            (r.data.people || []).forEach(function (p) {
              if (seen[p.ref]) return; seen[p.ref] = true;
              var row = mk('button', 'ow-set__row', esc(p.name || p.ref)); row.type = 'button';
              row.addEventListener('click', function () { if (p.ref && OW.go) OW.go('center', p.ref); });
              list.appendChild(row);
            });
            cursor = r.data.next_cursor || '';
            if (!Object.keys(seen).length && !cursor) list.appendChild(mk('p', '', 'No work connections yet.'));
            if (cursor) {
              var more = mk('button', 'po-act', 'Load more'); more.type = 'button';
              more.addEventListener('click', function () { more.remove(); page(); }); list.appendChild(more);
            }
          });
        }
        page();
      });
      stats.appendChild(button);
    });
    host.appendChild(stats);
    function reload() { data.invalidate('/api/'); return OW.live.workplaceProfile(host, email, opts); }
    if (data.me() && !work.is_me && 'following' in work) {
      var follow = mk('button', 'po-act', work.following ? 'Following at work' : 'Follow work profile');
      follow.type = 'button'; follow.setAttribute('aria-pressed', String(!!work.following));
      follow.addEventListener('click', function () {
        var path = '/api/oneway/workplace/follow/' + encodeURIComponent(email);
        OW.act(follow, { path: path, undoPath: path, body: {}, undoMethod: 'DELETE', invalidate: '/api/',
          labels: { on: 'Following at work', off: 'Follow work profile' }, after: reload });
      });
      host.appendChild(follow);
      if (work.following && personal.can_follow !== false && !personal.mutual) {
        var connect = mk('button', 'po-act', personal.following ? 'Following personally' : 'Follow personal profile');
        connect.type = 'button'; connect.setAttribute('aria-pressed', String(!!personal.following));
        connect.addEventListener('click', function () {
          var path = '/api/oneway/graph/follow/' + encodeURIComponent(email);
          OW.act(connect, { path: path, undoPath: path, body: {}, undoMethod: 'DELETE', invalidate: '/api/',
            labels: { on: 'Following personally', off: 'Follow personal profile' }, after: reload });
        });
        host.appendChild(connect);
        host.appendChild(mk('p', 'ow-workplace-profile__note',
          'Personal profiles are shared only when you both follow personally. Work follows do not unlock them.'));
      }
      if (personal.mutual) {
        var open = mk('button', 'po-act', 'Open personal profile'); open.type = 'button';
        open.addEventListener('click', function () { if (OW.go) OW.go('center', person.ref); }); host.appendChild(open);
      }
    }
    host.appendChild(list);
    host.appendChild(mk('h2', '', 'Center posts'));
    var river = mk('div'), footer = mk('div', 'ow-prof__more');
    host.appendChild(river); host.appendChild(footer);
    var posts = [], postIds = {};
    function paintPosts(page) {
      if ((page.unreadable || []).length) { footer.textContent = 'Workplace posts could not be fully loaded.'; return; }
      (page.posts || []).forEach(function (p) { if (!postIds[p.id]) { postIds[p.id] = true; posts.push(p); } });
      if (!posts.length) river.textContent = work.is_me
        ? 'Posts you publish to your workplace Centers appear here.' : 'Posts shared to their workplace Centers appear here.';
      else {
        var rows = OW.riverRows ? OW.riverRows(posts) : posts;
        OW.mountRiver(river, rows, { open: false }); OW.openCardsIn(river);
        if (OW.mountResponses) rows.forEach(function (row) { OW.mountResponses(river, row); });
      }
      footer.innerHTML = '';
      if (page.posts_cursor) {
        var more = mk('button', 'po-act', 'Load more posts'); more.type = 'button';
        more.addEventListener('click', function () {
          more.disabled = true;
          data.get('/api/oneway/people/' + encodeURIComponent(email) + '/workplace?before='
            + encodeURIComponent(page.posts_cursor)).then(function (r) {
              if (r.ok && r.data) paintPosts(r.data);
              else { more.disabled = false; if (OW.toast) OW.toast('Work posts could not be loaded.'); }
            });
        }); footer.appendChild(more);
      }
    }
    paintPosts(d);
    return posts.length;
  }

  OW.live.workplaceProfile = function (host, email, opts) {
    opts = opts || {};
    host.setAttribute('data-workplace-ref', email);
    host.setAttribute('data-workplace-bare', opts.bare ? '1' : '0');
    if (!host._workplaceWatch && OW.changes && OW.changes.on) {
      host._workplaceWatch = OW.changes.on(host, function () {
        if (host.classList.contains('ow-workplace-profile'))
          OW.live.workplaceProfile(host, host.getAttribute('data-workplace-ref'),
            { bare: host.getAttribute('data-workplace-bare') === '1' });
      });
    }
    loading(host, 2);
    return data.get('/api/oneway/people/' + encodeURIComponent(email) + '/workplace').then(function (r) {
      if (!r.ok || !r.data) { refused(host, r, 'This Workplace identity'); return 0; }
      return renderWorkplaceProfile(host, email, r.data, opts);
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
      if (_d.workplace_identity && _pr.ok) {
        return renderWorkplaceProfile(host, email, _d);
      }
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
            ? emptyMarked(nothing(host,
                'Nothing on your profile yet. What you make and share is what '
                + 'shows here — this is your side of Oneway, not a form to '
                + 'fill in.', 'Your profile is empty',
                [{ label: 'Make a post', go: 'lightbulb' }]))
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
                    404: 'this person is not on Oneway',
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
                (next ? data.post(path, {}, { queueable: true }) : data.del(path, { queueable: true })).then(function (rr) {
                  b.disabled = false;
                  if (rr.queued) {
                    /* WRITTEN DOWN, NOT YET SENT (PLAN G6): the button shows the state asked for now, and goes back, with the words,
                       only if the server refuses it later; a block redraws the header when the server has it. */
                    isOn = next;
                    b.textContent = isOn ? on : off;
                    b.setAttribute('aria-pressed', String(isOn));
                    b.setAttribute('data-act', isOn ? 'on' : 'off');
                    b.setAttribute('data-pending', '1');
                    OW.outbox.watch(rr.pending_id,
                      function () {
                        b.removeAttribute('data-pending');
                        data.invalidate('/api/oneway/graph');
                        if (kind === 'block') { data.invalidate('/api/oneway/messaging'); if (opts.reload) opts.reload(); }
                      },
                      function (words) {
                        isOn = !next;
                        b.removeAttribute('data-pending');
                        b.textContent = isOn ? on : off;
                        b.setAttribute('aria-pressed', String(isOn));
                        b.setAttribute('data-act', isOn ? 'on' : 'off');
                        if (OW.toast) OW.toast('That did not change. ' + words);
                      });
                    toldOnce();
                    return;
                  }
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
            OW.cards.fill(f, { kind: 'center', name: m.center_name, picture: m.picture }, { img: ' loading="lazy" decoding="async"', letters: 'i' });
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
        cardRef: person.handle ? '@' + String(person.handle).replace(/^@/, '') : '',
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
        banner: style.banner_url || '', bannerStyle: style.banner_style, bannerShape: style.banner_shape,
        bannerDepth: style.banner_depth, onBannerChange: mine ? function (patch) { return saveMyBanner(style, patch); } : null,
        logo: person.picture || style.avatar_url || '', layout: style.picture_position,
        /* the cut is the person's own — canonical `person.shape` first, the
           legacy style's answer only when the composed read has none (409) */
        avatarShape: person.shape || style.avatar_shape || 'round', hue: hue,
        email: email,
        /* THE NOTE, above their face, where the founder said it lives. `mine`
           is passed as well as the note itself because the person's OWN
           profile is where a note is SET — the field and the note occupy the
           same spot, so setting one is the same gesture as reading one. */
        note: person.note, noteMine: mine,
        /* FOOTSTEPS ON YOUR OWN PROFILE (C-parity, 2026-10-11; founder/731), as Snapchat shows its Footsteps: your
           percent of the world explored, only while you keep Footsteps on, and only to you (the door reads your own).
           Pressed, it opens Discovery, where the cells are drawn. */
        live: mine ? (function () {
          var fb = mk('button', 'po-act po-act--ghost ow-prof__footsteps', ''); fb.type = 'button';
          fb.setAttribute('data-footsteps', '1'); fb.style.display = 'none';
          fb.addEventListener('click', function () { try { global.location.hash = '#discovery'; } catch (e) {} });
          data.get('/api/oneway/me/footsteps', { fresh: true }).then(function (r) {
            var fd = r && r.ok && r.data;
            if (!fd || !fd.on) return;
            fb.textContent = 'Footsteps · ' + (fd.said || '');
            fb.style.display = '';
          }, function () {});
          return fb;
        })() : null,
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
                  ? emptyMarked(nothing(pane,
                      'Nothing on your profile yet. What you make and share '
                      + 'is what shows here.', 'Your profile is empty',
                      [{ label: 'Make a post', go: 'lightbulb' }]))
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

         A plan is a booking the reservation engine confirmed, read from the
         person's own index of their bookings (GET /api/oneway/me/reservations),
         so a booking at a place they neither follow nor belong to is found too;
         an event they said they are going to comes off their places. */
      /* WHO SEES YOUR TIER, AND YOUR SWITCH (founder/428: standing that travels, the person holding the switch; 660 row 539;
         C-app, 2026-10-12; PROPOSED for his eye). A card is private until its holder shares it. Before they do, they are
         shown exactly who would see it (consent without the list is not consent), and what: the tier and where it is
         from, never the balance or the number. A refusal is the toast (S23). */
      function shareLine(c) {
        var wrap = mk('div');
        wrap.setAttribute('data-share', c.center_id);
        var door = '/api/oneway/me/rewards/' + encodeURIComponent(c.center_id) + '/sharing';
        var names = function (xs) { return (xs || []).map(function (x) { return x.center || x.center_id; }).join(', '); };
        function draw(words, acts) {
          wrap.innerHTML = '';
          var row = mk('div', 'ow-cpage__row');
          row.appendChild(mk('span', 'ow-cpage__k', 'Your tier'));
          row.appendChild(mk('span', 'ow-cpage__v', esc(words)));
          wrap.appendChild(row);
          var bar = mk('div', 'ow-req__acts');
          acts.forEach(function (a) {
            var b = mk('button', a[2] ? 'po-act po-act--go' : 'po-act', esc(a[0])); b.type = 'button';
            b.addEventListener('click', a[1]);
            bar.appendChild(b);
          });
          wrap.appendChild(bar);
        }
        function said(r, fallback) { if (OW.toast) OW.toast((r && r.error) || fallback); }
        function put(on) {
          data.put(door, { shared: on }).then(function (r) {
            if (!r.ok) { said(r, 'That could not be changed just now.'); return showFor(!on); }
            showFor(!!(r.data || {}).shared, r.data);
          });
        }
        function showFor(shared, d) {
          if (!shared) return draw('Private: no other Center sees it', [['Share my tier', ask, false]]);
          var who = (d && (d.visible_to || d.would_be_visible_to)) || null;
          if (!who) return data.get(door).then(function (r) { showFor(true, (r && r.ok && r.data) || { would_be_visible_to: [] }); });
          draw(who.length ? 'Shared: ' + names(who) + ' see' + (who.length === 1 ? 's' : '') + ' it' : 'Shared: no Center recognises it yet',
               [['Make it private', function () { put(false); }, false]]);
        }
        function ask() {
          data.get(door).then(function (r) {
            if (!r.ok) return said(r, 'Who would see it could not be read just now.');
            var who = (r.data || {}).would_be_visible_to || [];
            draw(who.length ? 'If you share it, ' + names(who) + ' see' + (who.length === 1 ? 's' : '') + ' your tier: never your balance or your number'
                            : 'No other Center recognises it yet, so sharing it shows it to nobody for now',
                 [['Share it', function () { put(true); }, true], ['Cancel', function () { showFor(false); }, false]]);
          });
        }
        showFor(!!c.shared);
        return wrap;
      }
      function plansSection(pane, memberships, who) {
        /* WHAT YOU HAVE COMING: every booking this person holds at any Center, from the person-indexed read
           (GET /api/oneway/me/reservations: "a hotel they never joined included", the founder, 2026-10-03), and the events
           they said they are going to, from their places. This read bookings only through the places a person follows or
           belongs to, and said so: "a booking at a place they neither follow nor belong to is not found. That wants a
           person-indexed reservation write". That read exists, and nothing drew it (C-app, 2026-10-12).
           THE WALLET DOES NOT WAIT ON PLANS: a person with nothing coming still carries their cards. Each has its own
           slot, so the order holds whichever read answers first. */
        var page = mk('div', 'ow-cpage');
        var coming = mk('div'), carry = mk('div');
        page.appendChild(coming); page.appendChild(carry);
        var now = new Date();
        var going = [];
        (memberships || []).forEach(function (m) {
          (m.commitments || []).forEach(function (c) {
            if (!c || !c.start || (c.kind || '') !== 'rsvp') return;      /* a booking comes from the person's own read */
            if (String(c.status || '').toLowerCase() === 'cancelled') return;
            var d0 = new Date(c.start);
            if (isNaN(d0) || d0 < now) return;
            going.push({ center_id: m.center_id, center: m.center_name || m.center_id, kind: 'rsvp', start: c.start,
                         status: c.status || '' });
          });
        });
        data.get('/api/oneway/me/reservations').then(function (rr) {
          /* the server answers what is on now or coming, soonest first, each said in the Center's own time */
          var booked = ((rr && rr.ok && rr.data && rr.data.reservations) || []).map(function (r) {
            return { center_id: (r.center || {}).id || '', center: (r.center || {}).name || '', kind: 'reservation',
                     start: r.start, status: r.status || '', when: r.when_words || '', thing: (r.thing || {}).name || '' };
          });
          var soon = booked.concat(going)
            .sort(function (a2, b2) { return String(a2.start).localeCompare(String(b2.start)); });
          if (!soon.length) return;
          var h = mk('div', 'ow-cpage__h');
          h.appendChild(mk('span', 'ow-cpage__ht', 'What you have coming'));
          /* the whole of it is the Calendar (founder/520) */
          var allCal = mk('button', 'ow-cpage__all', 'Calendar'); allCal.type = 'button';
          allCal.addEventListener('click', function () {
            try { doc.dispatchEvent(new CustomEvent('ow:go-account', { detail: { to: 'calendar' } })); } catch (e) {}
          });
          h.appendChild(allCal);
          coming.appendChild(h);
          var body = mk('div', 'ow-cpage__b');
          coming.appendChild(body);
          var WORD = { reservation: 'Booked', booking: 'Booked', rsvp: 'Going' };
          soon.slice(0, 6).forEach(function (r) {
            var when = r.when || '';
            if (!when) {
              var d = new Date(r.start);
              try {
                when = new Intl.DateTimeFormat(undefined,
                  { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
              } catch (e) { when = r.start; }
              var days = Math.round((d - now) / 864e5);
              var soonWord = days <= 0 ? 'today' : (days === 1 ? 'tomorrow' : (days < 7 ? ('in ' + days + ' days') : ''));
              if (soonWord) when += ' \u00b7 ' + soonWord;
            }
            var one = mk('button', 'ow-cpage__ev'); one.type = 'button';
            one.setAttribute('data-coming', r.center_id || '');
            one.appendChild(mk('b', '', esc((WORD[r.kind] || 'Booked') + ' \u00b7 ' + r.center)));
            one.appendChild(mk('span', '', esc([r.thing, when, r.status && r.status !== 'confirmed' ? r.status : '']
              .filter(Boolean).join(' \u00b7 '))));
            if (r.center_id) {
              one.addEventListener('click', function () {
                try { doc.dispatchEvent(new CustomEvent('ow:enter-center',
                  { detail: { id: r.center_id, name: r.center } })); } catch (e) {}
              });
            }
            body.appendChild(one);
          });
        }).catch(function () {});
        pane.insertBefore(page, pane.firstChild);

        /* AND THE CARDS THEY CARRY — one read, drawn only when there is one
           (founder/422's wallet; a person with no card sees no heading). */
        data.get('/api/oneway/me/rewards').then(function (rr) {
          var cards = ((rr && rr.ok && rr.data && rr.data.memberships) || [])
            .filter(function (c) { return c && (c.center || c.center_id); });
          if (!cards.length) return;
          var wh = mk('div', 'ow-cpage__h');
          wh.appendChild(mk('span', 'ow-cpage__ht', 'What you carry'));
          carry.appendChild(wh);
          var wb = mk('div', 'ow-cpage__b');
          carry.appendChild(wb);
          cards.slice(0, 6).forEach(function (c) {
            var one = mk('button', 'ow-cpage__ev'); one.type = 'button';
            /* THE FIELDS THE WALLET READ WRITES (rewards/service.me): `center` and `tier_name`. This read `center_name`
               and `tier`, which it never wrote, so a card was titled by its Center's id and its tier by its key
               ("3380790d3b89", "gold"; measured 2026-10-12), and a mirrored card's "as reported by" never showed. */
            one.appendChild(mk('b', '', esc(c.center || c.center_id)));
            var bits = [];
            if (c.tier_name || c.tier) bits.push(String(c.tier_name || c.tier));
            if (c.member_no) bits.push(String(c.member_no));
            if (c.mirrored && c.book_of_record) bits.push('as reported by ' + c.book_of_record);
            one.appendChild(mk('span', '', esc(bits.join(' \u00b7 '))));
            if (c.center_id) one.addEventListener('click', function () {
              try { doc.dispatchEvent(new CustomEvent('ow:enter-center',
                { detail: { id: c.center_id, name: c.center || '' } })); } catch (e) {}
            });
            wb.appendChild(one);
            if (c.center_id) wb.appendChild(shareLine(c));
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
        { id: 'workplace', label: 'Workplace', icon: TAB_ICON.workplace, render: function (pane) {
            return OW.live.workplaceProfile(pane, email, { bare: true });
          } },
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
        cardRef: person.handle ? '@' + String(person.handle).replace(/^@/, '') : '',
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
        banner: style.banner_url || '', bannerStyle: style.banner_style, bannerShape: style.banner_shape,
        bannerDepth: style.banner_depth, onBannerChange: function (patch) { return saveMyBanner(style, patch); },
        logo: person.picture || style.avatar_url || '', layout: style.picture_position,
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
      });
      /* AFTER the shell, because the read is asynchronous and the node is
         already mounted — nothing waits on the network to appear. */
      osDoors(myActs, opts);
      return tabs.length;
    });
  };

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
                esc('What Oneway understands about your world')));
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


  /* the real surface replaces its stub: wrap it again in what it reads while it builds */
  if (OW.lazyAfterLibrary) OW.lazyAfterLibrary();
})(window);
