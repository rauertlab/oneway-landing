/* ONEWAY — APP · POSTS  (frontend/app/posts/posts.js)

   AN OPENED POST, AN OPENED DOCUMENT, AND THE ACT OF BEGINNING ONE. Lifted
   verbatim from `popit-live.js` on 2026-08-22; no behaviour edited in the move.

   ★ CANON: the core content object is the GALLERY — `GALLERY -> MEDIA -> FEED`,
   which replaced the traditional `Post -> Media`. A "post" here is therefore a
   projection of that object, never a second content model, and `OW.live.begin`
   is the App's single entry into the ONE creation pipeline (Lightbulb) rather
   than a create path of its own.

   WHY IT COULD LEAVE, measured both directions: it defines no helper anything
   else uses, and every reference to it from elsewhere goes through
   `OW.live.post` / `OW.live.openCanvas` / `OW.live.begin` — namespaced lookups
   resolved when a person clicks, not bindings captured at load. That is the
   distinction that decides whether a block can move: a local call would break,
   a lookup on `OW` cannot.

   LOAD ORDER: `oneway-popit.js` -> `popit-live.js` -> this. */
(function (global) {
  'use strict';
  var OW = global.OW;
  if (!OW || !OW._u) {
    console.warn('[app/posts] load oneway-popit.js and popit-live.js first');
    return;
  }
  var _u = OW._u;
  var data = _u.data;
  var doc = _u.doc;
  var esc = _u.esc;
  var imageUrl = _u.imageUrl;
  var loading = _u.loading;
  var mk = _u.mk;
  var nothing = _u.nothing;
  var refused = _u.refused;
  /* bound like the rest — `whenWords` was used unbound in the viewer hook
     and threw at the tap; the same class of fault this file records twice */
  var whenWords = _u.whenWords || (OW.when ? function (iso) { return OW.when(iso); } : function () { return ''; });

  (function () {
    var missing = ['data', 'doc', 'esc', 'imageUrl', 'loading', 'mk', 'nothing', 'refused'].filter(function (n) { return typeof _u[n] === 'undefined'; });
    if (missing.length) console.error('[app/posts] OW._u is missing: ' + missing.join(', '));
  })();

  /* ══ A POST ONLY ITS AUTHOR CAN SEE ═════════════════════════════════════
     Create's "An empty post" makes a canonical Post born a draft, and this is
     where it is finished: photos go in, and it is shared when its author
     presses Share it — never before (nothing auto-publishes). It was a Gallery
     with a page of its own until 2026-10-01; galleries are retired (founder,
     2026-08-26) and the App stands on the new backend alone (founder/641).

     THE SERVER'S ANSWER IS WHAT IS DRAWN AFTERWARDS. Both acts re-read the Post
     rather than patching the page, so what the person sees is what was stored.
     A Post holds a bounded number of photos (`MEDIA_MAX`, 12); one that did not
     fit is SAID, never dropped in silence (founder/657). */
  function draftBand(host, id, p, opts) {
    var band = mk('div', 'ow-post__draft');
    band.appendChild(mk('p', 'ow-post__ewhy', esc(
      p.state === 'scheduled' ? 'Scheduled. Only you can see it until it goes out.'
        : p.state === 'archived' ? 'Archived. Only you can see it.'
        : 'Only you can see this. It is private until you share it.')));
    var row = mk('div', 'ow-post__own');
    /* what the last act could not do, carried across the re-read */
    var why = mk('p', 'ow-post__ewhy', esc((opts && opts.notice) || ''));
    var add = mk('button', 'po-act', 'Add photos');
    add.type = 'button';
    var share = mk('button', 'po-act', 'Share it');
    share.type = 'button';
    function again(notice) {
      data.invalidate('/api/posts/');
      data.invalidate('/api/oneway/');
      var o = {};
      for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
      o.notice = notice || '';
      return OW.live.post(host, id, o);
    }
    function idle(text) {
      add.disabled = false; add.textContent = 'Add photos';
      why.textContent = text || '';
    }
    add.addEventListener('click', function () {
      if (!OW.live.pickMedia) { idle('Adding photos is not available on this page just now.'); return; }
      why.textContent = '';
      OW.live.pickMedia({ onProgress: function (i, n) {
        add.disabled = true;
        add.textContent = n > 1 ? 'Adding ' + i + ' of ' + n + '…' : 'Adding…';
      } }).then(function (res) {
        var said = res.refused.map(function (x) { return x.name + ': ' + (x.why || 'refused'); });
        if (!res.stored.length) { idle(said.join(' · ')); return; }
        var want = (p.media || []).concat(res.stored);
        return data.patch('/api/oneway/social/posts/' + encodeURIComponent(id),
                          { media: want }).then(function (r) {
          if (!r || !r.ok) {
            idle((r && r.error) || 'That did not save. Nothing has been changed.');
            return;
          }
          var kept = (((r.data || {}).post || {}).media || []).length;
          var left = want.length - kept;
          if (left > 0) said.push(left + (left === 1 ? ' photo' : ' photos')
                                  + ' did not fit — a post holds ' + kept + '.');
          return again(said.join(' · '));
        });
      });
    });
    share.addEventListener('click', function () {
      share.disabled = true; share.textContent = 'Sharing…'; why.textContent = '';
      data.put('/api/oneway/social/posts/' + encodeURIComponent(id) + '/state',
               { state: 'published' }).then(function (r) {
        if (!r || !r.ok) {
          share.disabled = false; share.textContent = 'Share it';
          why.textContent = (r && r.error) || 'That did not share. It is still private.';
          return;
        }
        if (OW.toast) OW.toast('Shared.', { tone: 'ok' });
        again('');
      });
    });
    row.appendChild(add); row.appendChild(share);
    band.appendChild(row); band.appendChild(why);
    return band;
  }

  OW.live.post = function (host, id, opts) {
    opts = opts || {};
    /* ── WATCH THE POST YOU ARE LOOKING AT ────────────────────────────────
       ★ FOUNDER: *"When two users are looking at the same Post… User B should
         see the change without refreshing."*

       MEASURED 2026-09-03, two browsers, two accounts. On HOME the realtime
       client was live with 20 topics — one per card. On the POST screen it
       reported `live: false, topics: 0, lanes: []`: this surface subscribed to
       nothing at all, so the one Post a person is actually reading was the one
       Post nobody was listening to.

       `watchTopics` names its own LANE, exactly as messaging does for a
       conversation, so Home's feed lane and this one cannot overwrite each
       other — that is what the named lanes are for. The stream is the union.

       The payload still carries no counts: an arriving event marks the number
       as changed and the canonical read stays the authority. */
    if (OW.realtime && OW.realtime.watchTopics) {
      OW.realtime.watchTopics('post', ['post:' + id]);
    }
    loading(host, 2);
    return Promise.all([
      data.get('/api/posts/' + encodeURIComponent(id)),
      data.get('/api/posts/' + encodeURIComponent(id) + '/comments')
        .catch(function () { return { ok: false }; })
    ]).then(function (rs) {
      var r = rs[0], cr = rs[1];
      if (!r.ok) { refused(host, r, 'This post'); return 0; }
      var p = (r.data || {}).post || {};
      /* NOT YET OUT IN THE WORLD — a draft, scheduled or archived Post. Only its
         author is ever answered one (`read_post` in oneway/social/routes.py),
         so this page is theirs alone; it draws what a person can do with work
         nobody else can see, and none of what other people do to a Post. */
      var unpublished = !!p.state && p.state !== 'published';
      /* WHOSE POST THIS IS — read once, off the canonical Post, and used to
         mark the creator's own comments in the thread below. */
      /* by @handle — the address is no longer sent about anybody but you (people/refs.py) */
      var authorRef = ((p.author && (p.author.ref || p.author.email)) || '').toLowerCase();
      host.className = ''; host.innerHTML = '';

      /* ── WHO, AND WHEN. The first thing a person looks for and the first
            thing the old sheet omitted. The author is TAPPABLE: "if I click
            somebody's icon, it doesn't even open to their profile" was the
            same complaint one layer out. */
      var who = mk('div', 'ow-post__who');
      var av = mk('button', 'ow-post__av');
      av.type = 'button';
      av.setAttribute('aria-label', 'Open ' + (p.author && p.author.name || 'this person'));
      var img = OW.imageUrl(p.author && p.author.image);
      if (img) { var im = doc.createElement('img'); im.src = img; im.alt = ''; av.appendChild(im); }
      /* founder/495 — the outline, not initials */
      else if (OW.faceMark) av.innerHTML = OW.faceMark();
      else av.appendChild(mk('i', '', esc(OW.initials((p.author && p.author.name) || ''))));
      var nm = mk('div', 'ow-post__nm');
      /* ── THE NAME IS TAPPABLE, NOT JUST THE PICTURE ────────────────────
         The avatar has opened the author since the founder's *"if I click
         somebody's icon, it doesn't even open to their profile"*. The NAME
         beside it never did — and a name is what people actually aim at.
         Measured 2026-09-04 walking the first hour: `.ow-post__av` navigated,
         `.ow-post__nm` had no control in it at all.

         A BUTTON, not a link: there is no URL for a person here, the App
         routes through `onPerson`. Styled by the name's own class so it looks
         like the text it already was. */
      var nmb = mk('button', 'ow-post__nmb');
      nmb.type = 'button';
      nmb.appendChild(mk('b', '', esc((p.author && p.author.name) || 'Someone')));
      nmb.setAttribute('aria-label', 'Open ' + ((p.author && p.author.name) || 'this person'));
      nm.appendChild(nmb);
      /* "in <somewhere>" ONLY WHEN SOMEWHERE IS SOMEONE ELSE'S. A post to a
         person's own Center carries `destination === center_id`, and printing
         it read "Walk Tester · just now · in Walk Tester" — the author named
         twice, once as the person and once as the room. Where a post lives is
         worth saying when it is a community; saying it of yourself is noise. */
      var elsewhere = p.destination_name
        && String(p.destination || '') !== String(p.center_id || '');
      nm.appendChild(mk('span', '', esc(OW.when(p.created_at))
        + (elsewhere ? (' · in ' + esc(p.destination_name)) : '')));    /* a name is text (lane B) */
      function openAuthor() {
        var em = (p.author || {}).ref || (p.author || {}).email || '';
        if (em && typeof opts.onPerson === 'function') opts.onPerson(em);
      }
      av.addEventListener('click', openAuthor);
      nmb.addEventListener('click', openAuthor);
      nm.addEventListener('click', openAuthor);
      who.appendChild(av); who.appendChild(nm);
      /* the author's note over the author's face — same rule as the feed row
         this post was probably opened from, so the person does not appear to
         lose their note by being looked at more closely. Pending
         `post.author.note` on GET /api/posts/{id}; a no-op until then. */
      if (p.author && p.author.note) OW.noteOn(av, p.author.note, 'sm');
      host.appendChild(who);

      /* ── THE WORDS. A title only when there is one — forcing "Untitled" onto
            a post that simply has no headline puts a placeholder where the
            person's own words belong. */
      if ((p.title || '').trim()) host.appendChild(mk('h2', 'ow-post__t', esc(p.title)));
      /* ── ONE RENDERER FOR THE WORDS ───────────────────────────────────
         The body is PARAGRAPHS, split on blank lines — so an edit that wrote
         `textContent` back would flatten somebody's paragraphs into one block
         and lose the shape they wrote. And a post with no body has no
         `.ow-post__body` element at all, so adding words to one had nowhere
         to paint. Both are the same mistake: two places that know how a body
         is drawn. This is the only one. */
      var bodySlot = mk('div', 'ow-post__body');
      function paintBody(text) {
        bodySlot.innerHTML = '';
        String(text || '').split(/\n{2,}/).forEach(function (para) {
          if (para.trim()) bodySlot.appendChild(mk('p', '', esc(para.trim())));
        });
        bodySlot.hidden = !String(text || '').trim();
      }
      paintBody(p.body);
      host.appendChild(bodySlot);

      /* ── ANYTHING ATTACHED. Media on the post, and any Gallery it carries. */
      (p.media || []).forEach(function (m) {
        var u = OW.imageUrl(m && (m.url || m));
        if (!u) return;
        var box = mk('div', 'ow-post__media');
        var isVideo = /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(u) || (m && m.kind === 'video');
        /* ★ FOUNDER/438: the same viewer a message opens into — full screen,
           the back arrow, the author's one face and name over it. A picture
           opens on tap; a video keeps its own controls and opens on a tap
           outside them (the frame), so play/pause never fights the viewer. */
        function view() {
          if (!OW.viewer) return;
          var au = p.author || {};
          OW.viewer.open({ url: m && (m.url || m), kind: isVideo ? 'video' : 'image',
            caption: p.body || p.title || '', when: whenWords ? whenWords(p.created_at) : '',
            who: { name: au.name || '', picture: au.image || au.picture || '',
                   shape: au.shape || 'round', hue: au.hue,
                   onPress: (au.ref || au.email) ? function () { doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { ref: au.ref || au.email } })); } : null } });
        }
        if (isVideo) {
          var v = doc.createElement('video');
          v.src = u; v.controls = true; v.playsInline = true; v.preload = 'metadata';
          box.addEventListener('click', function (e) { if (e.target !== v) view(); });
          var full = mk('button', 'ow-post__full', 'Open');
          full.type = 'button'; full.setAttribute('aria-label', 'Open full screen');
          full.addEventListener('click', function (e) { e.stopPropagation(); view(); });
          box.appendChild(full);
          /* MEDIA THAT IS NOT THERE LEAVES NOTHING BEHIND — the same rule the
             image below already followed, and the video did not. A 404 video
             rendered a dead player: a black rectangle with controls that do
             nothing, sitting in the middle of somebody's Post. Measured on the
             dev feed: 18 Posts point at `fixture-0.mp4` and `fixture-1.mp4`,
             which do not exist, and every one of them drew that box.

             An absent thing shows as absent. The Post keeps its words, its
             author and its responses — losing the whole card because a file is
             missing would be the opposite mistake. */
          v.addEventListener('error', function () { box.remove(); });
          box.appendChild(v);
        } else {
          var pic = doc.createElement('img');
          pic.src = u; pic.alt = ''; pic.loading = 'lazy';
          pic.addEventListener('error', function () { box.remove(); });
          pic.style.cursor = 'zoom-in';
          pic.addEventListener('click', view);
          box.appendChild(pic);
        }
        host.appendChild(box);
      });

      /* ── THE RESPONSES ARE THE CARD'S, NOT THIS PAGE'S ────────────────
         ★ FOUNDER, 2026-08-03: the responses are *"not as buttons, but as
           actual icons."*
         ★ FOUNDER/488: *"everything should have counts visible, no matter what
           feed it is viewed in."*
         ★ FOUNDER/490: *"visual syncronization."*
         ★ FOUNDER: *"A Like from a Post Popit must be the exact same Like as a
           Like from Home… There must be one canonical interaction state."*

         THIS PAGE WAS THE ONE PLACE THAT NEVER GOT THE MESSAGE. It built its
         own row from `offers` alone: two TEXT BUTTONS reading "Like" and
         "Dislike", counts only when non-zero, and no comment, repost, save or
         share at all. Measured 2026-09-22 at 290 — open any Post from the feed
         and six glyphs with six numbers became two words with none. That is
         not a styling difference; it is a different set of things a person can
         do with the same object, on the surface that object opens into.

         `OW.mountResponses` is the one implementation — the same function Home,
         the profile, a Center and a Popit all call. It wants the card's shape:
         a `[data-po-id]` element with a `[data-po-responses]` slot inside it.
         So the page states that shape and hands it over, rather than
         reimplementing what it draws. Everything follows from that: the icons,
         every act the server offers, every tally including zero, the double-tap
         like, the live painter, and any change made to the row tomorrow. */
      if (!unpublished) {
        var actWrap = mk('div', 'ow-post__actrow');
        actWrap.setAttribute('data-po-id', id || '');
        var actSlot = mk('span', 'po-acts');
        actSlot.setAttribute('data-po-responses', '');
        var actFoot = mk('span', 'po-card__foot');
        actFoot.appendChild(actSlot);
        actWrap.appendChild(actFoot);
        host.appendChild(actWrap);
        /* the canonical row shape `mountResponses` reads — the Post itself, with
           its interactions where a feed row carries them */
        try { OW.mountResponses(host, { post: p, interactions: p.interactions || null }); }
        catch (e) { try { console.warn('[app/posts] responses did not mount:', e && e.message); } catch (_) {} }
      }

      /* ══ THE AUTHOR'S OWN CONTROLS ══════════════════════════════════════
         ★ MEASURED BY B, 2026-09-12 (context/THREE_LANES.md §5, step 2): the
           Post Popit rendered NO edit and NO delete for the author. A person
           could write something on ONEWAY and then not change it or take it
           back, anywhere in the product.

         THE DOORS ARE B's AND THEY ARE CANONICAL (B1, 23c1ad9):
             PATCH /api/oneway/social/posts/{id}          edit in place
             PUT   /api/oneway/social/posts/{id}/state    {state:"deleted"}

         EDIT IS IN PLACE AND IT IS THE SAME POST — same id, same likes, same
         comments, same position in everybody's saved list. That is the
         service's own guarantee and it is why this is an edit rather than a
         delete-and-repost.

         AUTHORITY IS THE SERVER'S. This shows the controls to the person the
         payload says wrote it; it does not GRANT anything. Both routes resolve
         the actor from the session and refuse anybody else, so the worst a
         wrong guess here can do is offer a button that answers 403.

         ── AND THE PRODUCER ANSWERS IT NOW ───────────────────────────────
         This DERIVED ownership by comparing the author's address to the
         signed-in one — a reader deciding a question the producer should
         answer, which is this codebase's most repeated defect. I named it to B
         as a contract gap and `post.you` carries `may_edit` / `may_delete`
         since the same day, so the comparison is gone.

         IT IS THE WRITE DOORS' OWN RULE, NOT A COPY OF IT: the author, or an
         operator of the Place a Center's post speaks for; false on a deleted
         post; false for a stranger and for anonymous. An address comparison
         could never have known the second of those, so an operator posting as
         their Center could not edit their Center's own post — a defect I would
         have shipped and never seen, because I only ever tested as an author.

         NO MODAL, AND NO NATIVE CONFIRM (UI standing rules). Delete ARMS on
         the first press and commits on the second, with a way back — the
         same grammar as a destructive control anywhere else on a phone, and
         it cannot fire on a mis-tap. */
      /* ══ WHERE IT ALSO WENT, AND SENDING IT FURTHER (founder/503) ═══════
         The post carries each platform's own result (B 5f66099e), readable
         only by someone who runs the Center it belongs to. So this ASKS: a
         refusal means this person may not send it outward and nothing is
         drawn. Otherwise it shows where it went — each platform's own answer —
         and lets it go to the platforms it has not reached yet. */
      if ((p.you || {}).may_edit && OW.reach && id && !unpublished) {
        var reachBox = mk('div', 'ow-post__reach');
        host.appendChild(reachBox);
        var paintReach = function () {
          data.get('/api/oneway/social/posts/' + encodeURIComponent(id) + '/syndication', { fresh: true })
            .then(function (r) {
              if (!r || !r.ok) return;
              reachBox.innerHTML = '';
              var went = (r.data || {}).syndication || [];
              if (went.length) {
                reachBox.appendChild(mk('h3', 'ow-group', 'On other platforms'));
                OW.reach.track(reachBox, id, went);
              }
              return OW.reach.targets(p.center_id || p.destination || (data.meHome && data.meHome())).then(function (ts) {
                var left = (ts || []).filter(function (t) {
                  return !went.some(function (w) { return w.platform === t.key && (w.state === 'published' || w.state === 'queued'); });
                });
                if (!left.length) return;
                var picked = {};
                OW.reach.row(reachBox, left, picked, '',
                             (p.media || []).map(function (m) { return m && m.kind; }));
                var send = mk('button', 'po-act', 'Send');
                send.type = 'button';
                send.addEventListener('click', function () {
                  var ks = OW.reach.keys(picked);
                  if (!ks.length) { if (OW.toast) OW.toast('Choose a connected platform first.'); return; }
                  send.disabled = true;
                  data.post('/api/oneway/social/posts/' + encodeURIComponent(id) + '/syndicate',
                            { destinations: ks }).then(function (rr) {
                    send.disabled = false;
                    if (!rr || !rr.ok) { if (OW.toast) OW.toast((rr && rr.error) || 'That did not send.'); return; }
                    paintReach();
                  });
                });
                reachBox.appendChild(send);
              });
            });
        };
        paintReach();
        /* A POST JUST MADE HAS NO RESULTS YET — the job writes each one when
           its platform answers, and says so on the post's own topic. So this
           page listens and redraws when that happens. One lane for the page,
           so opening the next post replaces what this one watched. */
        var onSyn = function (e) {
          if (((e && e.detail) || {}).post !== id) return;
          if (!reachBox.isConnected) { doc.removeEventListener('ow:syndication', onSyn); return; }
          paintReach();
        };
        doc.addEventListener('ow:syndication', onSyn);
        if (OW.realtime) OW.realtime.watchTopics('post-page', ['post:' + id]);
      }

      if (unpublished) host.appendChild(draftBand(host, id, p, opts));

      var you = p.you || {};
      if (you.may_edit || you.may_delete) {
        var own = mk('div', 'ow-post__own');

        var editB = null, delB = null;
        if (you.may_edit) {
          editB = mk('button', 'po-act ow-post__edit', 'Edit');
          editB.type = 'button';
        }
        if (you.may_delete) {
          delB = mk('button', 'po-act ow-post__del', 'Delete');
          delB.type = 'button';
        }

        /* ── EDIT: an inline composer where the words are ──────────────── */
        if (editB) editB.addEventListener('click', function () {
          if (own.querySelector('.ow-post__editor')) return;   /* already open */
          editB.disabled = true;
          var ed = mk('div', 'ow-post__editor');
          var ta = doc.createElement('textarea');
          ta.className = 'ow-post__ta';
          ta.value = p.body || '';
          ta.setAttribute('aria-label', 'Edit this post');
          var row = mk('div', 'ow-post__erow');
          var save = mk('button', 'po-act ow-post__save', 'Save');
          save.type = 'button';
          var cancel = mk('button', 'po-act po-act--ghost', 'Cancel');
          cancel.type = 'button';
          var why = mk('p', 'ow-post__ewhy', '');
          var close = function () {
            if (ed.parentNode) ed.parentNode.removeChild(ed);
            editB.disabled = false;
          };
          cancel.addEventListener('click', close);
          save.addEventListener('click', function () {
            var next = ta.value;
            /* AN EMPTY EDIT IS NOT A DELETE. Deleting is a different act with
               a different control, and silently turning a cleared box into one
               is how somebody loses a Post they meant to rewrite. */
            if (!String(next).trim()) {
              why.textContent = 'A post needs some words. Use Delete to remove it.';
              return;
            }
            if (next === (p.body || '')) { close(); return; }
            save.disabled = true; cancel.disabled = true;
            why.textContent = 'Saving…';
            data.patch('/api/oneway/social/posts/' + encodeURIComponent(id),
                       { body: next }).then(function (r) {
              if (!r || !r.ok) {
                save.disabled = false; cancel.disabled = false;
                /* THE REASON, NOT A SHRUG. The route answers 400 with why. */
                why.textContent = (r && r.error)
                  || 'That did not save. Nothing has been changed.';
                return;
              }
              p.body = next;
              /* The rendered body is re-read from the canonical answer where
                 the route returns one, so an edit the server normalised is
                 what appears — never the raw box. */
              var srv = (r.data && r.data.post && r.data.post.body);
              if (typeof srv === 'string') p.body = srv;
              paintBody(p.body);
              data.invalidate('/api/posts/');
              data.invalidate('/api/oneway/social/');
              close();
            });
          });
          row.appendChild(save); row.appendChild(cancel);
          ed.appendChild(ta); ed.appendChild(row); ed.appendChild(why);
          own.appendChild(ed);
          ta.focus();
        });

        /* ── DELETE: armed, then committed, and reversible until it is not ─ */
        var armed = false, disarm = null;
        if (delB) delB.addEventListener('click', function () {
          if (!armed) {
            armed = true;
            delB.classList.add('is-armed');
            delB.textContent = 'Delete for good?';
            /* IT DISARMS ITSELF. A control left armed on a screen somebody
               walked away from is a control that deletes on the next stray
               tap. */
            disarm = global.setTimeout(function () {
              armed = false;
              delB.classList.remove('is-armed');
              delB.textContent = 'Delete';
            }, 6000);
            return;
          }
          if (disarm) global.clearTimeout(disarm);
          delB.disabled = true;
          delB.textContent = 'Deleting…';
          /* THE VERB IS DELETE. This went through PUT .../state {deleted} —
             which works, and is the wrong door for it: a state change is what
             an operator does to a post (draft, published, hidden), and a
             person deleting their own thing is not choosing a state. B built
             DELETE /api/oneway/social/posts/{id} (c4eebc3) for exactly this;
             `you.may_delete` is the permission it answers. */
          data.del('/api/oneway/social/posts/' + encodeURIComponent(id)).then(function (r) {
            if (!r || !r.ok) {
              delB.disabled = false; armed = false;
              delB.classList.remove('is-armed');
              delB.textContent = 'Delete';
              var m = mk('p', 'ow-post__ewhy',
                esc((r && r.error)
                || 'That could not be deleted. The post is still here.'));
              own.appendChild(m);
              return;
            }
            /* EVERY SURFACE THAT SHOWED IT HAS TO STOP. The post is gone from
               the feed, the profile and the Place, and a stale read would put
               it back on the next paint. */
            data.invalidate('/api/posts/');
            data.invalidate('/api/oneway/social/');
            data.invalidate('/api/oneway/social/feed');
            if (opts.onDeleted) { opts.onDeleted(id); return; }
            if (opts.onBack) { opts.onBack(); return; }
            /* NO CALLER TOLD US WHERE TO GO, so say what happened rather than
               leaving somebody looking at a Post that no longer exists. */
            host.className = ''; host.innerHTML = '';
            nothing(host, 'This post has been deleted.', 'Deleted');
          });
        });

        if (editB) own.appendChild(editB);
        if (delB) own.appendChild(delB);
        host.appendChild(own);
      }
      /* Sending, notes and the thread are for a Post other people can see. */
      if (unpublished) return 1;

      /* ── SEND THIS TO SOMEBODY — THE OTHER HALF OF A LOOP THAT ONLY HAD ONE
         `api/oneway/sharing/` serves two routes and, MEASURED 2026-09-02, had
         no caller. Messaging already RENDERS a shared Post — `attachment()`
         resolves `shared_content` to the canonical object and reports it
         unavailable when the original is gone — and NOTHING IN THE APP COULD
         CREATE ONE. A renderer for a thing no surface could make.

         SENDING IS NOT THE `share` COUNT. The rail's verbs are reactions: they
         record that a person shared, and are answered by
         `/api/objects/post/{id}/respond`. This actually delivers the Post into
         a conversation, and the two must not be one control — pressing a
         counter and sending something to a friend are different acts with
         different consequences.

         A SHARE IS A REFERENCE, NEVER A COPY. That is the whole design: an
         edit to the Post reaches every conversation it was sent to, and a
         deleted Post reports itself unavailable rather than leaving words its
         author removed sitting in somebody's inbox.

         AND THE RANKING ARRIVES WITH ITS REASONS, so this never presents an
         unexplained list. The route's own docstring says why: *"so a surface
         can say 'you talk here often' instead of presenting an unexplained
         list — and so the ranking can be argued with rather than trusted
         blindly."* `why` is rendered verbatim from the runtime. */
      (function () {
        var send = mk('button', 'po-act ow-send-to', 'Send to…');
        send.type = 'button';
        var panel = mk('div', 'ow-sendto');
        host.appendChild(send); host.appendChild(panel);

        /* ── ONE SEND SHEET, NOT TWO ────────────────────────────────────
           This was ~50 lines of destinations-fetch, ranking render and
           to-conversation POST, living only here. The camera needed exactly
           the same sheet, and a second copy is the one that drifts — a person
           would learn it on a Post and meet something different after taking a
           photograph. It is `OW.sendTo` now, verbatim, and both call it.

           IF THE HELPER IS NOT THERE the button says so rather than doing
           nothing: a dead control is the failure this file already documents
           by name. */
        send.addEventListener('click', function () {
          if (panel.firstChild) { panel.innerHTML = ''; return; }
          if (!OW.sendTo) {
            panel.appendChild(mk('p', 'po-acts__wait',
              esc('Sending is not available on this page just now.')));
            return;
          }
          OW.sendTo(panel, { subject_type: 'post', subject_id: id });
        });
      })();

      /* ── A COMMUNITY NOTE SITS BETWEEN THE POST AND THE THREAD ──────────
         `api/oneway/community_notes/` serves five routes and, MEASURED
         2026-09-02, had no caller anywhere in the App. A platform that could
         receive a note, count it, and decide it was worth showing — with
         nowhere to read one and no way to write one.

         IT GOES HERE, not in the comment thread, and that placement IS the
         feature. A note is not a reply: a reply is somebody's opinion among
         others, a shown note is what enough people found genuinely useful
         about the Post's CLAIM. Putting it inside the thread would make it one
         voice among many and it would scroll away; putting it above the thread
         and below the Post says it is about the thing above it.

         AND THE FOUR JUDGEMENTS STAY VISIBLY SEPARATE, because the contract
         keeps them separate and the whole design rests on it:
             what its AUTHOR claims   an assertion, attributed
             what the COMMUNITY said  counts, and this reader's own vote
             what a MODEL said        its own block, its own provenance
             what the PLATFORM shows  derived — and NOT a truth claim
         `status` says whether people found it useful, never whether it is
         true. Nothing here says "verified", and the suite asserts that nothing
         anywhere in the payload does either. */
      (function () {
        var notes = mk('section', 'ow-notes');
        host.appendChild(notes);
        data.get('/api/oneway/posts/' + encodeURIComponent(id) + '/notes')
          .then(function (nr) {
            /* NO NOTE IS NOT AN EMPTY NOTE. Most Posts have none and never
               will; a heading over nothing is the hollow projection the
               founder is eliminating. The section is removed outright. */
            var rows = (nr.ok && nr.data && nr.data.notes) || [];
            if (!rows.length) { notes.remove(); return; }

            notes.appendChild(mk('h3', 'ow-group', 'Readers added context'));
            rows.forEach(function (n) {
              var card = mk('article', 'ow-note');
              card.setAttribute('data-status', n.status || 'proposed');

              /* WHAT IT CLAIMS TO BE DOING — a kind of contribution, never a
                 truth value. The contract is explicit about that and the
                 wording here keeps it. */
              var KIND = { adds_context: 'Adds context', disputes: 'Disputes this',
                           corrects: 'Corrects this', confirms: 'Confirms this' };
              card.appendChild(mk('span', 'ow-note__kind',
                esc(KIND[n.claim_kind] || 'Adds context')));
              card.appendChild(mk('p', 'ow-note__b', esc(n.body || '')));

              (n.evidence || []).forEach(function (e) {
                if (!e || !e.url) return;
                var a = mk('a', 'ow-note__src', esc(e.title || e.url));
                a.href = e.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                card.appendChild(a);
              });

              /* WHAT A MODEL SAID — ITS OWN BLOCK, NEVER MERGED. A model's
                 assessment sitting inside the community's line would read as
                 the community agreeing with it. They are different judgements
                 and the payload keeps them apart, so this does too. */
              (n.ai || []).forEach(function (m) {
                var ai = mk('p', 'ow-note__ai');
                ai.appendChild(mk('b', '', esc(m.model || 'A model')));
                ai.appendChild(doc.createTextNode(' assessed this ' +
                  String(m.assessment || 'unknown').replace(/_/g, ' ')));
                card.appendChild(ai);
              });

              /* AND THE READER'S OWN JUDGEMENT. The community block carries
                 `you`, so the control shows what THIS person already said
                 rather than an unpressed pair beside a count they contributed
                 to. */
              var c = n.community || {};
              var row = mk('div', 'ow-note__vote');
              [['helpful', 'Helpful', c.helpful],
               ['unhelpful', 'Not helpful', c.unhelpful]].forEach(function (t) {
                var b = mk('button', 'ow-note__v'); b.type = 'button';
                b.setAttribute('aria-pressed', String(c.you === t[0]));
                b.appendChild(doc.createTextNode(t[1]));
                if (t[2]) b.appendChild(mk('b', '', String(t[2])));
                b.addEventListener('click', function () {
                  b.disabled = true;
                  data.post('/api/oneway/posts/' + encodeURIComponent(id)
                            + '/notes/' + encodeURIComponent(n.id) + '/evaluate',
                            { value: t[0] }).then(function (rr) {
                    b.disabled = false;
                    if (!rr.ok) { OW.say(b, 'That did not save'); return; }
                    /* THE SERVER'S COUNTS, RE-READ. A note's status is derived
                       from every reader, so a local increment would be this
                       surface inventing a number only it believes. */
                    data.invalidate('/api/oneway/posts/');
                    OW.live.post(host, id, opts);
                  });
                });
                row.appendChild(b);
              });
              card.appendChild(row);

              /* WHY IT IS ON SCREEN, said plainly. `status` is the platform's
                 derived answer and it is NOT a truth claim — so the sentence
                 says what people found, never what is true. */
              var WHY = { showing: 'Enough readers found this helpful.',
                          contested: 'Readers disagree about this — and that is the answer.',
                          proposed: 'Not enough readers have judged this yet.',
                          not_helpful: 'Readers did not find this helpful.' };
              if (WHY[n.status]) {
                card.appendChild(mk('p', 'ow-note__why', esc(WHY[n.status])));
              }
              notes.appendChild(card);
            });
          })
          .catch(function () { notes.remove(); });
      })();

      /* ── WHAT PEOPLE SAID. Real comments, and a way to add one — the whole
            reason a post is a place rather than a broadcast. */
      var list = (cr.ok && cr.data && cr.data.comments) || [];
      var pins = (cr.ok && cr.data && cr.data.pinned) || [];
      var mayPin = !!(cr.ok && cr.data && cr.data.may_pin);
      var pinMax = (cr.ok && cr.data && cr.data.pin_max) || 3;
      var head3 = mk('h3', 'ow-group', '');
      host.appendChild(head3);

      /* ── THE CREATOR'S THREE, ABOVE THE THREAD ──────────────────────────
         ★ FOUNDER, 2026-08-29: *"A Post may have: maximum 3 pinned comments…
           The ordering is explicitly creator-controlled."*

         Its own list, in the creator's order, and the server has already
         lifted these OUT of the paged thread — so a pinned comment appears
         once, at the top, and never again further down. */
      var pinHead = mk('div', 'ow-cmts__pinhead', 'Pinned');
      var pinned = mk('div', 'ow-cmts ow-cmts--pinned');
      host.appendChild(pinHead);
      host.appendChild(pinned);
      var thread = mk('div', 'ow-cmts');
      host.appendChild(thread);

      /* WHERE A REPLY IS AIMED, AND WHO CAN TAKE ONE.

         `aimId` is the TOP-LEVEL comment the composer is currently answering —
         '' means the composer writes a new comment. `branches` is the register
         every rendered comment publishes itself into, so a reply arriving from
         the live channel, or from this person's own send, can be handed to the
         subsection it belongs to instead of re-reading the whole surface. */
      var aimId = '', branches = {};

      function countWords(n) {
        /* COMMENTS, NOT "REPLIES". A comment on a Post and a reply to a
           comment are two different things and this heading names the first —
           calling them replies is what makes people expect a tree. */
        return n ? (n === 1 ? '1 comment' : n + ' comments') : 'Comments';
      }
      function shown() {
        return thread.querySelectorAll('.ow-cmt').length
             + pinned.querySelectorAll('.ow-cmt').length;
      }
      /* THE HEADING IS THE POST'S COUNT, NOT THE PAINTED ONE. `shown()` is
         how much of the thread is on screen; `total` is how many comments the
         Post has. They differ by exactly the amount that was invisible, and
         the heading is the one place a person would have caught it. */
      function retitle() {
        head3.textContent = countWords(Math.max(total || 0, shown()));
        paintRest();
      }

      /* ONE COMMENT, RENDERED, from the CANONICAL names.

         An earlier draft of this comment claimed the surface had been
         rendering every comment as "Someone" because it read `c.author_name`
         and `c.at`. That was wrong and is corrected here rather than left to
         become canon: `/api/posts/{id}/comments` emits a SUPERSET — the legacy
         `author_name`/`at` alongside the canonical `author`/`created_at` — so
         the old read worked exactly as it always had.

         The switch to `author.name` / `created_at` is therefore a preference,
         not a repair: the legacy aliases exist to keep un-migrated callers
         working, and new code that reaches for them makes them harder to
         retire. `deleted` is the one genuinely new branch — a removed comment
         keeps its place in the thread instead of vanishing and orphaning its
         replies. */
      /* ── ONE COMMENT, TIKTOK-SHAPED ────────────────────────────────────
         ★ FOUNDER, 2026-08-29: *"Oneway comments should follow the clean,
           compact interaction model of TikTok — not the visually heavy /
           thread-heavy presentation of Instagram or X… Avoid: deep indented
           nesting · giant threaded boxes · excessive borders · complicated
           conversation trees. The goal is fast consumption and interaction."*

             avatar  Sarah
                     This is incredible
                     ♥ 12     Reply

         So: a face, a name, the words, and TWO affordances. No card, no
         border, no box. The reply COUNT is a link that opens the branch in
         place — the backend supports replies to any depth and the presentation
         deliberately does not, because a tree is the thing being avoided.

         THE ROW IS THE SAME MARKUP WHETHER IT IS PINNED OR NOT. A pinned
         comment is the same comment in a different list, which is the same
         rule the Post itself follows: one object, many projections. */
      function draw(c) {
        var row = mk('div', 'ow-cmt');
        row.setAttribute('data-cid', c.id || '');
        row.setAttribute('data-seq', String(c.seq || 0));
        if (c.deleted) {
          row.setAttribute('data-gone', '1');
          row.appendChild(mk('p', 'ow-cmt__body', 'This was removed.'));
          return row;
        }
        var who = (c.author && (c.author.ref || c.author.email)) || c.author_email || '';
        var name = (c.author && c.author.name) || c.author_name || 'Someone';

        /* ── THE COMMENTER'S OWN FACE ────────────────────────────────────
           ★ FOUNDER/409: *"I want to start seeing their profile pictures
             everywhere. Make sure it supports the square and circle
             orientation."*
           The comment contract carries image · shape · hue on its author —
           the same three a Post's author carries — and this drew one letter
           on the platform's default violet for everybody. Now: their picture
           when they have one, their initials in THEIR hue when they do not,
           cut round (a person) or as a tile (a Center answering as itself). */
        var au = c.author || {};
        var av = mk('span', 'ow-cmt__av');
        var shape = String(au.shape || (au.kind === 'center' ? 'rounded' : 'round')).toLowerCase();
        if (/^(round|rounded|square)$/.test(shape)) av.setAttribute('data-shape', shape);
        if (typeof au.hue === 'number' && OW.hue && OW.hue.fromAngle) {
          var hp = OW.hue.fromAngle(au.hue);
          if (hp) { av.style.setProperty('--h', hp[0]); av.style.setProperty('--h2', hp[1] || hp[0]); }
        }
        /* NOT `aim`: a `var` of that name here shadowed the `aim()` that
           Reply calls, in this whole function — so every Reply threw "aim is
           not a function" and did nothing (founder/502 crawl). */
        var faceUrl = au.image ? (OW.imageUrl ? OW.imageUrl(au.image) : au.image) : '';
        if (faceUrl) {
          var ai = doc.createElement('img');
          ai.src = faceUrl; ai.alt = ''; ai.loading = 'lazy'; ai.decoding = 'async';
          av.appendChild(ai);
        } else {
          if (OW.faceMark) av.innerHTML = OW.faceMark();     /* founder/495 */
          else av.textContent = OW.initials ? OW.initials(name) : (name || '?').slice(0, 1).toUpperCase();
        }
        if (who) {
          av.setAttribute('data-po-who', who);
          av.setAttribute('title', name || who);
        } else if (au.center_id) {
          av.setAttribute('data-po-center', au.center_id);
          av.setAttribute('title', name || '');
        }
        /* A COMMENTER'S FACE IS A DOOR TO THEM. The face handler lives in the
           card's own click path, and a comment is not in a card — so this
           face was marked as a person and opened nothing (founder/502 crawl). */
        if (who || au.center_id) {
          av.setAttribute('role', 'button'); av.tabIndex = 0;
          av.setAttribute('aria-label', 'Open ' + (name || who || 'this Center'));
          var openFace = function (ev) {
            ev.stopPropagation();
            try {
              if (who) doc.dispatchEvent(new CustomEvent('ow:open-person', { detail: { ref: who } }));
              else doc.dispatchEvent(new CustomEvent('ow:enter-center', { detail: { id: au.center_id } }));
            } catch (_) {}
          };
          av.addEventListener('click', openFace);
          av.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openFace(ev); } });
        }
        row.appendChild(av);

        var body = mk('div', 'ow-cmt__b');
        var top = mk('div', 'ow-cmt__top');
        top.appendChild(mk('b', 'ow-cmt__nm', esc(name)));
        top.appendChild(mk('span', 'ow-cmt__when', esc(OW.when(c.created_at || c.at))));
        if (c.pinned) top.appendChild(mk('span', 'ow-cmt__pin', 'Pinned'));
        /* THE PERSON WHO MADE THIS, REPLYING, is the most interesting fact a
           thread can carry, and it costs one small chip to say. Read off the
           canonical Post's author rather than guessed. */
        if (who && authorRef && String(who).toLowerCase() === authorRef) {
          top.appendChild(mk('span', 'ow-cmt__creator', 'Creator'));
        }
        body.appendChild(top);
        body.appendChild(mk('p', 'ow-cmt__body', esc(c.body || '')));

        /* ── THE LIKE LIVES IN THE RIGHT GUTTER ────────────────────────────
           ★ FOUNDER, 2026-08-30: *"have tiktok level comments research what
             makes them so simple and good."*

           The heart was inline under the words, beside Reply. TikTok puts it
           in a fixed right-hand column — heart above count — and that is the
           property doing the work: the text column keeps a constant width, and
           the thumb finds the control in the SAME PLACE on every row without
           aiming. Inline, the target moves with the length of the comment and
           the column ends raggedly.

           The control itself is unchanged — same `data-po-respond`, same
           delegated path, same live count painter. Only where it sits. */
        var rail = mk('div', 'ow-cmt__rail');

        var acts = mk('div', 'ow-cmt__acts');
        /* THE HEART IS THE SAME CONTROL THE POST USES — same markup, same
           `data-po-respond`, so the same live-update path paints its count and
           the same red says "liked" here as everywhere else. */
        var like = doc.createElement('button');
        like.type = 'button';
        like.className = 'po-act ow-cmt__like';
        /* ── THE APP'S ONE CONTROL PATH, NOT A SECOND ONE ─────────────────
           ★ FOUNDER: *"no second renderer, no second interaction path."*

           `[data-po-respond]` + `data-obj` + `data-okind` is the shape every
           response control in the App wears, and `popit-live.js` delegates it:
           optimistic press, authoritative correction, the offline queue, and
           the live count painter in `oneway-realtime.js` (which repaints any
           `[data-obj]` when the server broadcasts a new count).

           An earlier version of this row carried its OWN click handler. It
           worked, and it was wrong twice over: the delegated handler fired as
           well, so two paths raced on one press; and the tally was painted by
           neither, because the bespoke one was the only thing that knew about
           it. One control, one path, one place a comment reaction is decided. */
        like.setAttribute('data-po-respond', 'like');
        like.setAttribute('data-okind', 'comment');
        like.setAttribute('data-obj', c.id || '');
        like.setAttribute('aria-label', 'Like this comment');
        like.setAttribute('aria-pressed',
                          (c.you && c.you.liked) ? 'true' : 'false');
        like.innerHTML = (OW.glyph ? OW.glyph('heart') : '&hearts;');
        var nLike = (c.actions && c.actions.like) || 0;
        /* ABSENT AT ZERO, exactly as the Popit's own tally is — a "0" beside
           every comment is noise about nothing having happened. */
        if (nLike) like.appendChild(mk('b', '', String(nLike)));
        rail.appendChild(like);

        /* ── REPLY AIMS AT THIS COMMENT. IT DOES NOT WRITE A NEW ONE. ────
           ★ FOUNDER, 2026-08-31: *"replys should open subsections and should
             be contained not like thier own posts."*

           This button used to type `@name ` into the composer and stop, and
           the composer posted with NO `reply_to` — so every "reply" on this
           surface became a NEW TOP-LEVEL COMMENT wearing an @-mention. That is
           the whole complaint, in the data rather than the styling: a reply
           really was its own post, sitting in the main column at full size,
           because nothing ever told the server it was a reply.

           `aim()` sets the target, shows what you are replying to above the
           field, and the composer sends `reply_to`. Aiming at a REPLY aims at
           its parent, so the thread stays two levels deep no matter how deep
           the conversation goes — which is the model, not a limitation. */
        var reply = mk('button', 'ow-cmt__reply', 'Reply');
        reply.type = 'button';
        reply.addEventListener('click', function (ev) {
          ev.stopPropagation();
          aim(c.id, name);
        });
        acts.appendChild(reply);

        /* ═══ THE SUBSECTION ═════════════════════════════════════════════
           ★ FOUNDER, 2026-08-31: *"replys should open subsections and should
             be contained not like thier own posts that u can click and must
             clearly show all comments and condense them."*

           FOUR THINGS, AND THE FIRST ONE IS WHY THE OTHER THREE WERE WRONG.

           1 · CONTAINED. The replies were drawn by `draw()` — the SAME markup
               a top-level comment gets, appended into the parent's text column
               with nothing around it. A reply had a 32px face, a name row, a
               timestamp, a like rail, its own Reply, its own Pin and Delete,
               and its own "View replies" (hidden by a CSS rule, which is what
               a structural problem looks like when it is patched in the paint
               layer). It was a post. Now a reply is `drawReply` — a different,
               smaller thing — inside ONE bounded region with ONE rail, and the
               region belongs to the comment above it.

           2 · NOT ITS OWN POST YOU CAN CLICK. A reply carries exactly two
               controls: the heart, and Reply. No pin — a reply cannot be
               pinned, the runtime only pins top-level comments, so the button
               was offering something that could not happen. No nested opener —
               the model is two levels, and aiming at a reply aims at its
               PARENT, which is how it stays two levels without forbidding
               anyone from answering anyone.

           3 · ALL OF THEM. The old call took the default page — TEN — and
               never read `next_cursor`, so a comment with thirty replies
               opened, showed ten, and gave no sign the other twenty existed.
               `loadAll` follows the cursor to the end, and the header states
               the number so what is on screen and what is claimed agree.

           4 · CONDENSED. Name and words run together on one flow, the way a
               chat line reads, and the gap between replies is 9px against the
               thread's 14px. A subsection of six replies is shorter than two
               of the old rows. */
        var sub = null, subCount = c.reply_count || 0, more = null;

        function subLabel() {
          return subCount === 1 ? '1 reply' : subCount + ' replies';
        }

        function paintMore() {
          if (!more) return;
          more.textContent = sub ? 'Hide replies' : subLabel();
          more.setAttribute('aria-expanded', sub ? 'true' : 'false');
          more.style.display = subCount ? '' : 'none';
        }

        /* EVERY PAGE, NOT THE FIRST ONE. `next_cursor` is followed until the
           server stops issuing one; the guard is a page ceiling rather than a
           row ceiling, so a runaway cursor cannot spin but an honest thread of
           any real size arrives whole. */
        function loadAll(into) {
          var seen = {}, guard = 0;
          function step(cursor) {
            if (guard++ > 40) return Promise.resolve();
            /* FRESH, ALWAYS. `data.get` holds a response for its TTL, and a
               branch is re-read for exactly one reason: something just
               changed. Measured on :3050 — a reply posted, the server recorded
               it (the branch went 5 -> 6), and this call returned the CACHED
               five. The reply was written, was correct, and was invisible: the
               "comments are gone" report arriving from the writing side, with
               nothing wrong anywhere except a stale read. */
            return data.get('/api/oneway/social/posts/' + encodeURIComponent(id)
                            + '/comments/' + encodeURIComponent(c.id) + '/replies'
                            + '?limit=50' + (cursor ? '&before='
                                             + encodeURIComponent(cursor) : ''),
                            { fresh: true })
              .then(function (r) {
                var d = (r && r.ok && r.data) || {};
                var rs = d.replies || [];
                rs.forEach(function (rc) {
                  if (!rc || !rc.id || seen[rc.id]) return;
                  seen[rc.id] = 1;
                  /* THE DOM IS THE OTHER HALF OF `seen`. `loadAll` runs again
                     after this person sends a reply, and a per-call set cannot
                     know what the previous call already drew — so the row that
                     is already on screen would arrive a second time. */
                  if (into.querySelector('[data-rid="' + rc.id + '"]')) return;
                  into.insertBefore(drawReply(rc, c.id, name), foot(into));
                });
                if (typeof d.count === 'number') { subCount = d.count; paintMore(); }
                return d.next_cursor ? step(d.next_cursor) : null;
              }).catch(function () { return null; });
          }
          return step('');
        }

        function foot(into) {
          return into.querySelector('.ow-sub__foot');
        }

        function openSub() {
          if (sub) return Promise.resolve(sub);
          sub = mk('div', 'ow-sub');
          /* THE ONE AFFORDANCE THE SUBSECTION OWNS. Answering the thread is
             the act a person wants after reading it, and putting it at the
             foot means the region has a beginning and an end rather than
             trailing off into the next comment. */
          var f = mk('button', 'ow-sub__foot', 'Reply to ' + esc(name));
          f.type = 'button';
          f.addEventListener('click', function (ev) {
            ev.stopPropagation(); aim(c.id, name);
          });
          sub.appendChild(f);
          body.appendChild(sub);
          paintMore();
          return loadAll(sub).then(function () {
            if (!sub.querySelector('.ow-rep')) {
              sub.insertBefore(mk('p', 'ow-sub__none', 'No replies yet.'), f);
            }
            return sub;
          });
        }

        function closeSub() {
          if (!sub) return;
          sub.remove(); sub = null; paintMore();
        }

        more = mk('button', 'ow-cmt__more', subLabel());
        more.type = 'button';
        more.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (sub) closeSub(); else openSub();
        });
        acts.appendChild(more);
        paintMore();

        /* THE BRANCH REGISTER. A reply arriving live has to reach the region
           it belongs to, and only this closure knows where that is — so each
           comment publishes the two operations the thread needs from outside:
           open me, and take one more row. Without it the live path had to
           either ignore replies (it did) or re-read the whole surface. */
        branches[c.id] = {
          open: openSub,
          /* TAKE ONE MORE. Called with a row when the caller has one (nothing
             does yet — the live channel carries ids, never comment TEXT, by
             design) and with nothing when it only knows that a reply landed.
             Both end the same way: the subsection is open and it is complete,
             which is the only state this surface is allowed to be in. */
          took: function (rc) {
            subCount += 1; paintMore();
            if (!sub) return openSub();
            var none = sub.querySelector('.ow-sub__none');
            if (none) none.remove();
            if (rc && rc.id) {
              if (!sub.querySelector('[data-rid="' + rc.id + '"]')) {
                sub.insertBefore(drawReply(rc, c.id, name), foot(sub));
              }
              return Promise.resolve(sub);
            }
            return loadAll(sub).then(function () { return sub; });
          }
        };

        /* CREATOR CONTROLS — pin, unpin, delete. Only for the Post's author,
           and the server says who that is rather than the App inferring it. */
        if (mayPin) {
          var pin = mk('button', 'ow-cmt__own', c.pinned ? 'Unpin' : 'Pin');
          pin.type = 'button';
          pin.addEventListener('click', function (ev) {
            ev.stopPropagation();
            pin.disabled = true;
            var p = c.pinned
              ? data.del('/api/oneway/social/posts/' + encodeURIComponent(id)
                         + '/comments/pinned/' + encodeURIComponent(c.id))
              : data.post('/api/oneway/social/posts/' + encodeURIComponent(id)
                          + '/comments/pinned', { comment_id: c.id });
            Promise.resolve(p).then(function (r) {
              if (!r || !r.ok) {
                OW.say(pin, (r && r.error)
                       || ('a post may pin ' + pinMax + ' comments'));
                pin.disabled = false;
                return;
              }
              reload();
            });
          });
          acts.appendChild(pin);
        }
        if (c.may_delete) {
          var del = mk('button', 'ow-cmt__own', 'Delete');
          del.type = 'button';
          del.addEventListener('click', function (ev) {
            ev.stopPropagation();
            del.disabled = true;
            data.del('/api/oneway/social/posts/' + encodeURIComponent(id)
                     + '/comments/' + encodeURIComponent(c.id))
              .then(function (r) {
                /* a refused delete says so; the thread re-read would only show
                   the comment still there with no reason (founder/502 sweep) */
                if (!r || !r.ok) {
                  del.disabled = false;
                  if (OW.toast) OW.toast('Your comment is still here. ' + ((r && r.error) || 'Try again.'));
                  return;
                }
                reload();
              });
          });
          acts.appendChild(del);
        }

        body.appendChild(acts);
        row.appendChild(body);
        /* THE THIRD COLUMN. The row is a 32px / 1fr / 40px grid, so the rail
           must exist even when nothing has been liked — otherwise the grid
           collapses and the text column changes width from row to row, which
           is the exact raggedness the gutter exists to prevent. */
        row.appendChild(rail);
        return row;
      }

      /* ═══ ONE REPLY — A LINE, NOT A ROW ═══════════════════════════════════
         ★ FOUNDER, 2026-08-31: *"…not like thier own posts that u can click…
           and condense them."*

         THE DIFFERENCE IS STRUCTURAL, NOT COSMETIC. `draw()` builds a
         three-column grid with a name row, a body paragraph, an action bar and
         a like rail — the shape of a thing that stands on its own. A reply does
         not stand on its own: it only means anything under the comment it
         answers, and the presentation says so.

             ·  SB  Sarah  the doors open at seven  2h  ♥ 3
                          Reply

         Name and words share one flow, because a reply is a line of talk. The
         time is a trailing token rather than a header field. The heart is the
         SAME control the post and the comment use — `data-po-respond`, the one
         delegated path — only smaller. There is no pin (the runtime pins
         top-level comments only, so offering it was offering nothing) and no
         nested opener (aiming at a reply aims at its parent).

         `data-rid` rather than `data-cid`: the live path and the seq-ordering
         walk `[data-cid]` to place TOP-LEVEL comments, and a reply carrying
         that attribute would be found by both and inserted into the main
         column — a reply promoted to a post by an attribute name. */
      function drawReply(rc, parentId, parentName) {
        var el = mk('div', 'ow-rep');
        el.setAttribute('data-rid', rc.id || '');
        if (rc.deleted) {
          el.setAttribute('data-gone', '1');
          el.appendChild(mk('p', 'ow-rep__t', 'This was removed.'));
          return el;
        }
        var rwho = (rc.author && (rc.author.ref || rc.author.email)) || rc.author_email || '';
        var rname = (rc.author && rc.author.name) || rc.author_name || 'Someone';

        var av = mk('span', 'ow-rep__av');
        av.textContent = (rname || '?').slice(0, 1).toUpperCase();
        if (rwho) {
          av.setAttribute('data-po-who', rwho);
          av.setAttribute('title', rwho);
        }
        el.appendChild(av);

        var t = mk('div', 'ow-rep__t');
        t.appendChild(mk('b', 'ow-rep__nm', esc(rname)));
        if (rwho && authorRef && String(rwho).toLowerCase() === authorRef) {
          t.appendChild(mk('span', 'ow-cmt__creator', 'Creator'));
        }
        /* ONE TEXT NODE, NOT A PARAGRAPH. A block element here would put the
           words on their own line and undo the condensation the founder asked
           for — the name and the sentence have to read as one line that wraps. */
        t.appendChild(doc.createTextNode(' ' + (rc.body || '')));
        /* TIME AND CONTROLS ARE ONE TRAILING RUN, kept together so a wrap
           never leaves "2h" alone on a line above "Reply". */
        var meta = mk('span', 'ow-rep__meta');
        meta.appendChild(mk('span', 'ow-rep__when',
                            esc(OW.when(rc.created_at || rc.at))));
        t.appendChild(meta);

        /* THE CONTROLS RIDE THE TEXT FLOW, THEY DO NOT GET A LINE.
           Measured on a 371px viewport before this change: a block action row
           cost 15px on every reply, and five replies paid it — 75px of chrome
           to show the word "Reply" five times. Inline after the time, they cost
           nothing when the last line has room and wrap only when it does not.
           This is the difference between a line of talk and a small post. */
        var acts = mk('span', 'ow-rep__acts');
        var rep = mk('button', 'ow-rep__reply', 'Reply');
        rep.type = 'button';
        /* AIMING AT A REPLY AIMS AT ITS PARENT. Two levels, always — and the
           person still gets to answer the person they meant, because the name
           goes into the field. This is TikTok's model exactly, and it is the
           reason a thread never re-indents. */
        rep.addEventListener('click', function (ev) {
          ev.stopPropagation();
          aim(parentId, rname, parentName);
        });
        acts.appendChild(rep);
        if (rc.may_delete) {
          var del = mk('button', 'ow-rep__reply', 'Delete');
          del.type = 'button';
          del.addEventListener('click', function (ev) {
            ev.stopPropagation();
            del.disabled = true;
            data.del('/api/oneway/social/posts/' + encodeURIComponent(id)
                     + '/comments/' + encodeURIComponent(rc.id))
              .then(function (r) {
                /* "This was removed." only when it was — a refused delete
                   drew it anyway, and the reply came back on reload */
                if (!r || !r.ok) {
                  del.disabled = false;
                  if (OW.toast) OW.toast('Your reply is still here. ' + ((r && r.error) || 'Try again.'));
                  return;
                }
                el.setAttribute('data-gone', '1');
                el.innerHTML = '';
                el.appendChild(mk('p', 'ow-rep__t', 'This was removed.'));
              });
          });
          acts.appendChild(del);
        }
        meta.appendChild(acts);
        el.appendChild(t);

        var like = doc.createElement('button');
        like.type = 'button';
        like.className = 'po-act ow-rep__like';
        like.setAttribute('data-po-respond', 'like');
        like.setAttribute('data-okind', 'comment');
        like.setAttribute('data-obj', rc.id || '');
        like.setAttribute('aria-label', 'Like this reply');
        like.setAttribute('aria-pressed', (rc.you && rc.you.liked) ? 'true' : 'false');
        like.innerHTML = (OW.glyph ? OW.glyph('heart') : '&hearts;');
        var n = (rc.actions && rc.actions.like) || 0;
        if (n) like.appendChild(mk('b', '', String(n)));
        el.appendChild(like);
        return el;
      }

      /* ── INSERTED WHERE THE SERVER SAYS, NOT WHERE IT ARRIVED ──────────
         ★ FOUNDER, 2026-08-29: *"The UI should never visibly reorder things
           unpredictably because events arrived in a different network order.
           The server's canonical ordering/event IDs must win."*

         So position is decided by `seq` — the number issued inside the same
         transaction that wrote the comment — and the row is placed BEFORE it
         is animated. Nothing is appended and then sorted, which is the move
         that makes a thread visibly rearrange itself under a reader. */
      function place(c) {
        if (!c || !c.id) return null;
        if (host.querySelector('[data-cid="' + c.id + '"]')) return null;
        var row = draw(c);
        var seq = c.seq || 0;
        var at = null;
        Array.prototype.some.call(thread.children, function (n) {
          if ((parseInt(n.getAttribute('data-seq'), 10) || 0) > seq) { at = n; return true; }
          return false;
        });
        thread.insertBefore(row, at);
        return row;
      }

      /* THE PINNED LIST IS NOT SORTED. Its order IS the creator's decision, so
         it is rendered in the order the server hands it over — sorting it by
         anything at all would discard the one thing being asked for. */
      function paintPins(rows) {
        pinned.innerHTML = '';
        (rows || []).forEach(function (c) {
          c.pinned = true;
          pinned.appendChild(draw(c));
        });
        pinHead.style.display = (rows && rows.length) ? '' : 'none';
      }

      /* ONE RE-READ AFTER A CURATION CHANGE. Pinning moves a comment between
         two lists, so nothing local can be patched into place honestly — the
         server decides which list it belongs to and this asks it. */
      function reload() {
        data.invalidate('/api/posts/' + id);
        return data.get('/api/posts/' + encodeURIComponent(id) + '/comments')
          .then(function (r) {
            if (!r || !r.ok || !r.data) return;
            pins = r.data.pinned || [];
            paintPins(pins);
            thread.innerHTML = '';
            /* THE REGISTER IS EMPTIED WITH THE COLUMN IT DESCRIBES. Every
               entry points at a subsection inside a row that is about to be
               destroyed, and a live reply landing on one of those would call
               `insertBefore` on a detached node — the reply would go nowhere
               and nothing would say so. */
            branches = {};
            if (aimId && !r.data.comments.some(function (c) { return c.id === aimId; })) aim('');
            (r.data.comments || []).forEach(function (c) { place(c); });
            /* THE PAGER STARTS OVER TOO — this re-read is page one. */
            cursor = r.data.next_cursor || '';
            if (typeof r.data.count === 'number') total = r.data.count;
            if (typeof r.data.top_count === 'number') topTotal = r.data.top_count;
            retitle();
          }).catch(function () {});
      }

      paintPins(pins);
      list.forEach(function (c) { place(c); });

      /* ═══ ALL OF THEM, AND THE COUNT PROVES IT ════════════════════════════
         ★ FOUNDER, 2026-08-31: *"must clearly show all comments."*

         The thread rendered ONE page — the endpoint's default twenty — and
         then stopped, with no control and no notice. On a Post with sixty
         comments, forty were unreachable from this surface, while the heading
         above them said "20 comments" and was believed.

         Two things fix that and they have to arrive together. The heading now
         reads the SERVER's `count`, so it states the truth about the Post
         rather than a tally of what happens to be painted. And the rest are
         behind a control that says how many are left, follows the cursor, and
         REMOVES ITSELF when the cursor runs out — so its absence is a claim
         that nothing is left, and its presence is a claim with a number on it.

         Not auto-loaded: a Post can hold tens of thousands of comments and
         reading all of them because a person opened it is the cost law broken
         on the surface where it would be felt first. */
      /* TWO NUMBERS, BECAUSE THEY ARE TWO POPULATIONS. `count` is every
         comment on the Post — replies included — and it is what the heading
         says, because that is what a person means by "how many comments".
         `top_count` is how many rows this list can ever hold, and it is the
         only number the pager may do arithmetic with: subtracting what is
         painted from `count` would offer to show replies as comments and then
         produce nothing. The server added `top_count` for exactly this. */
      var total = (cr.ok && cr.data && typeof cr.data.count === 'number')
        ? cr.data.count : list.length;
      var topTotal = (cr.ok && cr.data && typeof cr.data.top_count === 'number')
        ? cr.data.top_count : list.length;
      var cursor = (cr.ok && cr.data && cr.data.next_cursor) || '';
      var rest = mk('button', 'ow-cmts__rest', '');
      rest.type = 'button';
      host.appendChild(rest);

      function paintRest() {
        /* THE CURSOR DECIDES WHETHER THERE IS MORE; the count only decides
           what to CALL it. If the two ever disagree the cursor wins and the
           label drops the number rather than printing one that is wrong. */
        /* CLEARED AS WELL AS HIDDEN. It kept whatever it last said — after a
           page loaded it sat there reading "Reading…" behind display:none, so
           the one thing that could make it reappear would show a stale word. */
        if (!cursor) { rest.style.display = 'none'; rest.textContent = ''; return; }
        var left = topTotal - shown();
        rest.style.display = '';
        rest.textContent = left > 0
          ? ('Show ' + left + ' more comment' + (left === 1 ? '' : 's'))
          : 'Show more comments';
      }
      rest.addEventListener('click', function () {
        rest.disabled = true;
        rest.textContent = 'Reading…';
        data.get('/api/posts/' + encodeURIComponent(id) + '/comments?limit=30'
                 + '&before=' + encodeURIComponent(cursor))
          .then(function (r) {
            var d = (r && r.ok && r.data) || {};
            (d.comments || []).forEach(function (c) { place(c); });
            cursor = d.next_cursor || '';
            if (typeof d.count === 'number') total = d.count;
            if (typeof d.top_count === 'number') topTotal = d.top_count;
            rest.disabled = false;
            retitle();
          }).catch(function () { rest.disabled = false; paintRest(); });
      });
      /* AFTER the pager exists, because `retitle` repaints it — calling it
         before this point read `rest` while it was still undefined. */
      retitle();

      /* ── SOMEBODY IS TYPING ────────────────────────────────────────────
         The row holds its height whether or not anyone is — otherwise the
         composer hops every time a person starts and stops, which is layout
         jumping caused by the feature meant to feel alive. */
      var typing = mk('div', 'ow-typing');
      /* Announced when it CHANGES, once, rather than read as part of the
         thread every time the composer is reached. */
      typing.setAttribute('aria-live', 'polite');
      typing.setAttribute('aria-atomic', 'true');
      typing.innerHTML = '<span class="ow-typing__dots"><i></i><i></i><i></i></span>'
                       + '<span class="ow-typing__who"></span>';
      var who = typing.querySelector('.ow-typing__who');
      host.appendChild(typing);

      var TOPIC = 'post:' + id;

      function onTyping(e) {
        var d = e.detail || {};
        if (d.topic !== TOPIC) return;
        var names = (d.typing || []).map(function (t) { return t.name; });
        if (!names.length) {
          typing.removeAttribute('data-on');
          /* INVISIBLE IS NOT SILENT. The row fades with `opacity:0` so the
             composer does not hop — which is right — but opacity does NOT take
             text out of the accessibility tree. The old text stayed, so a
             screen reader went on announcing that somebody was typing, to
             exactly the people who cannot see that it has faded. Messaging
             already clears its own; this one only faded. */
          who.textContent = '';
          return;
        }
        who.textContent = names.length === 1
          ? names[0] + ' is typing'
          : (names.length === 2 ? names.join(' and ') + ' are typing'
                                : names.length + ' people are typing');
        typing.setAttribute('data-on', '1');
      }

      /* THE CONNECT FRAME ARRIVES BEFORE THIS THREAD EXISTS. Presence is sent
         once, when the stream opens; this handler is registered when the Post
         is opened, which is later. Without asking, a thread opened while
         somebody was mid-sentence showed nothing until they stopped and
         started again. */
      try {
        var nowTyping = OW.realtime && OW.realtime.typingFor
                      && OW.realtime.typingFor(TOPIC);
        if (nowTyping) onTyping({ detail: nowTyping });
      } catch (_e) {}

      function onComment(e) {
        var d = e.detail || {};
        if (d.post !== id) return;
        /* ── A REPLY GOES TO ITS SUBSECTION ─────────────────────────────────
           This returned early, so a reply arriving while someone had the
           thread open reached NOTHING: not the main column (correct — it is
           not a comment), and not the branch (wrong — it is a reply to a
           comment on screen). The count on the opener stayed stale and the
           person watching the thread saw no sign anybody had answered.

           If the parent is not rendered the event is genuinely not ours and
           the early return is right — the register answers that in one read. */
        if (d.reply_to) {
          var br = branches[d.reply_to];
          if (br && d.action !== 'removed') br.took(null);
          return;
        }
        if (d.action === 'removed') {
          var gone = thread.querySelector('[data-cid="' + d.comment + '"]');
          if (gone) {
            gone.setAttribute('data-gone', '1');
            gone.innerHTML = '';
            /* THE SAME CLASS THE FIRST RENDER USES. Without it this tombstone
               is unstyled — full-size ink where every other removed comment is
               small and italic — so the same fact looks like two different
               things depending on whether you were watching when it happened. */
            gone.appendChild(mk('p', 'ow-cmt__body', 'This was removed.'));
          }
          retitle();
          return;
        }
        /* THE EVENT SAYS WHAT CHANGED, NOT WHAT IT SAYS. Re-reading the one
           page is how the body arrives without putting comment TEXT on a
           shared channel — the event carries ids and counts only. */
        data.invalidate('/api/posts/' + id);
        data.get('/api/posts/' + encodeURIComponent(id) + '/comments')
          .then(function (r) {
            ((r.ok && r.data && r.data.comments) || []).forEach(function (c) {
              var row = place(c);
              if (row) {
                row.setAttribute('data-arrived', '1');
                global.setTimeout(function () {
                  row.removeAttribute('data-arrived');
                }, 420);
              }
            });
            retitle();
          }).catch(function () {});
      }

      doc.addEventListener('ow:typing', onTyping);
      doc.addEventListener('ow:comment', onComment);
      /* THE SURFACE CLEANS UP AFTER ITSELF. Opening five posts in a row must
         not leave five listeners answering for a thread nobody is reading. */
      if (host.__owOff) { try { host.__owOff(); } catch (e) {} }
      host.__owOff = function () {
        doc.removeEventListener('ow:typing', onTyping);
        doc.removeEventListener('ow:comment', onComment);
        if (OW.realtime) OW.realtime.stopTyping(TOPIC);
      };

      /* ═══ THE COMPOSER KNOWS WHAT IT IS ANSWERING ════════════════════════
         ★ FOUNDER, 2026-08-31: *"replys should open subsections."*

         A reply can only open a subsection if it IS a reply, and until now it
         was not: pressing Reply typed `@name ` into this field and the send
         posted `{body}` with no `reply_to`, so the server — correctly —
         recorded a new top-level comment. The @-mention was the only trace
         that anyone had meant it as an answer, and the thread grew sideways.

         The aim strip says out loud what the field will do, and it is the
         AFFORDANCE THAT CANCELS IT: a person who starts a reply and changes
         their mind needs one visible way back to writing a comment, or the
         surface has a mode with no exit. */
      var aimBar = mk('div', 'ow-cmt__aim');
      var aimTxt = mk('span', 'ow-cmt__aimwho', '');
      var aimX = mk('button', 'ow-cmt__aimx', 'Cancel');
      aimX.type = 'button';
      aimBar.appendChild(aimTxt);
      aimBar.appendChild(aimX);
      host.appendChild(aimBar);

      /* AIM. `cid` is always a TOP-LEVEL comment id — `drawReply` passes its
         parent's, never its own, which is what holds the thread at two levels
         while still letting anybody answer anybody. `mention` is who the
         person is actually talking to, which may be a reply's author, so the
         strip can be honest about both: answering Sarah, inside Ben's thread. */
      function aim(cid, mention, under) {
        aimId = cid || '';
        if (!aimId) {
          aimBar.removeAttribute('data-on');
          ta.placeholder = 'Say something';
          return;
        }
        aimTxt.textContent = under && under !== mention
          ? 'Replying to ' + mention + ' · in ' + under + "'s replies"
          : 'Replying to ' + mention;
        aimBar.setAttribute('data-on', '1');
        ta.placeholder = 'Reply to ' + mention;
        /* THE @ IS A COURTESY, NOT THE MECHANISM. It used to be the only thing
           carrying the intent; now the intent is in `reply_to` and this is
           just how the sentence starts, so a person may delete it and the
           reply still lands in the right subsection. */
        if (!/^@/.test(ta.value)) ta.value = '@' + mention + ' ' + ta.value;
        ta.focus();
        send.disabled = !ta.value.trim();
        var open = branches[aimId];
        if (open) open.open();
      }
      aimX.addEventListener('click', function () { ta.value = ''; aim(''); send.disabled = true; });

      var fld = mk('div', 'ow-fld');
      var ta = doc.createElement('textarea');
      ta.rows = 2; ta.placeholder = 'Say something';
      ta.setAttribute('aria-label', 'Write a comment');
      /* the Post page's Comment control lands here without rebuilding the page */
      ta.setAttribute('data-ow-comment-box', id || '');
      fld.appendChild(ta);
      var send = mk('button', 'ow-btn', 'Send');
      send.type = 'button'; send.disabled = true;
      ta.addEventListener('input', function () {
        send.disabled = !ta.value.trim();
        /* THE THROTTLE IS IN `OW.realtime`, so this can be per keystroke
           without being a request per keystroke. */
        if (ta.value.trim() && OW.realtime) OW.realtime.typing(TOPIC);
      });
      ta.addEventListener('blur', function () {
        if (OW.realtime) OW.realtime.stopTyping(TOPIC);
      });
      send.addEventListener('click', function () {
        var t = ta.value.trim(); if (!t) return;
        send.disabled = true;
        if (OW.realtime) OW.realtime.stopTyping(TOPIC);
        var to = aimId;
        data.post('/api/posts/' + encodeURIComponent(id) + '/comments',
                  to ? { body: t, reply_to: to } : { body: t })
          .then(function (res) {
          if (!res.ok) {
            OW.say(send, res.status === 422 ? 'that did not pass the screen'
                                            : (res.error || 'it did not send'));
            send.disabled = false; return;
          }
          ta.value = '';
          aim('');
          /* THE SERVER'S NEW COUNT, TAKEN FROM THE WRITE. Measured on :3050:
             post a comment and the heading stayed on the number it was
             rendered with — the thread grew and the sentence above it did not
             move, so the one place a person would check said the comment had
             not landed. `count` comes back on the write itself; nothing has to
             be re-read to know it. */
          if (typeof res.data === 'object' && res.data
              && typeof res.data.count === 'number') total = res.data.count;
          if (!to) topTotal += 1;
          retitle();
          data.invalidate('/api/posts/' + id);
          /* A REPLY GOES HOME TO ITS SUBSECTION, NOT TO THE MAIN COLUMN. The
             thread re-read below only ever returns TOP-LEVEL rows (the server
             filters replies out of `page`), so without this a person's own
             reply would send successfully and then appear nowhere — the exact
             "comments are gone" report, arrived at from the writing side. */
          if (to && branches[to]) {
            branches[to].took(null);
            send.disabled = false;
            return;
          }
          /* NOT A FULL RE-RENDER. This used to call `OW.live.post` again,
             which tore the whole surface down and rebuilt it — the scroll
             position jumped, the composer lost focus, and everything flashed,
             to show one new line. The person's own comment arrives through
             the same live path everybody else's does. */
          data.get('/api/posts/' + encodeURIComponent(id) + '/comments')
            .then(function (r) {
              ((r.ok && r.data && r.data.comments) || []).forEach(function (c) {
                var row = place(c);
                if (row) {
                  row.setAttribute('data-arrived', '1');
                  global.setTimeout(function () { row.removeAttribute('data-arrived'); }, 420);
                }
              });
              retitle();
            }).catch(function () {});
        });
      });
      host.appendChild(fld); host.appendChild(send);
      /* PRESSING "COMMENT" LANDS IN THE BOX. The card's Comment control opens
         the Post — one way into a conversation — and then left the person at
         the top of it with the field two screens down (measured 2026-09-14:
         focus stayed on <body>). Asked for by the caller, never assumed: a
         person who tapped the card itself came to read, not to type. */
      if (opts.focusComment) {
        try { ta.focus({ preventScroll: false }); ta.scrollIntoView({ block: 'center' }); }
        catch (_) { try { ta.focus(); } catch (__) {} }
      }
      return 1;
    });
  };

  /* ═══ THE CANVAS, REACHABLE AT LAST ════════════════════════════════════════
     `canvas-doc.html` is 2,700 lines — ink with pressure, pages, paper, a lasso,
     a recording timed to every stroke, PDF annotation, templates, export — and
     until this function existed **NOTHING OPENED IT**. Measured: three matches
     for "canvas-doc" across the whole repo and all three are COMMENTS.

     That is this platform's signature failure, and I walked straight into it:
     the engine gets built, the surface never gets connected, and the next
     session audits the gap instead of closing it. A feature nobody can reach is
     worth exactly what an unbuilt one is.

     IT OPENS IN AN OVERLAY, NOT A NAVIGATION. Sending a person to another page
     is the teleport the founder named on this very surface; the document editor
     already opens full-screen inside the App and this matches it. Same origin,
     so the editor reads the same session from the same storage — which is only
     true because the three readers were made one earlier today. */
  OW.live.openCanvas = function (id) {
    var prev = doc.getElementById('ow-canvas-host');
    if (prev) prev.remove();
    var host = mk('div');
    host.id = 'ow-canvas-host';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', 'Drawing and handwriting');
    host.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#07070f';
    var fr = doc.createElement('iframe');
    /* THE CANVAS SHARES THE APP'S ASSET VERSION. Loaded bare it was the one
       file in the App with no cache discipline, so an edited canvas kept
       serving the browser's stale copy — and the symptom was not a stale
       screen but SILENT DATA LOSS, because the old build was still saving one
       page of a seven-page document. The version is read off a script tag the
       page already carries rather than invented here, so there is one number
       for every asset instead of a second one to keep in step. */
    var v = '';
    try {
      var tag = doc.querySelector('script[src*="doc-editor.js"]');
      var m = tag && (tag.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
      if (m) v = m[1];
    } catch (_) {}
    var q = [];
    if (id) q.push('id=' + encodeURIComponent(id));
    if (v) q.push('v=' + encodeURIComponent(v));
    fr.src = '/canvas-doc.html' + (q.length ? ('?' + q.join('&')) : '');
    fr.style.cssText = 'width:100%;height:100%;border:0;display:block';
    fr.setAttribute('title', 'ONEWAY canvas');
    host.appendChild(fr);

    /* THE WAY OUT IS ALWAYS VISIBLE. An overlay with no exit is a trap, and the
       canvas's own rail has no idea it is inside anything. */
    var back = mk('button', '', 'Close');
    back.type = 'button';
    /* BOTTOM-LEFT, BECAUSE THE OTHER THREE CORNERS ARE TAKEN. Top-left put it
       squarely on the canvas's first tool — on a phone, Close and the pen were
       the same 42px of screen. The rail owns the top edge and the page bar owns
       bottom-right, so bottom-left is the only corner where this can live
       without covering a control. */
    back.style.cssText = 'position:absolute;left:12px;'
      + 'bottom:calc(12px + env(safe-area-inset-bottom));z-index:2;'
      + 'font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;'
      + 'padding:8px 14px;border:1px solid rgba(255,255,255,.18);'
      + 'border-radius:14px 11px 13px 12px;background:rgba(10,10,20,.72);'
      + '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)';
    /* BACK MUST CLOSE THE OVERLAY, NOT NAVIGATE UNDERNEATH IT.
       This surface deliberately does not change the hash — the founder's
       teleport correction was "do not send me to another page" — so with no
       history entry of its own, a browser Back went to whatever the App had
       before Lightbulb WHILE THE CANVAS STAYED ON SCREEN: a full-screen editor
       floating over the wrong page, and no way to tell which one you were on.

       So the overlay pushes ONE state on open and consumes exactly one popstate
       on close. The App session owns `go()`/`walkTo()`; the rule between us is
       that an open full-screen surface wins and the App never navigates beneath
       one. Anything more than that belongs in their file, not this function. */
    var pushed = false;
    try {
      global.history.pushState({ owCanvas: 1 }, '', global.location.href);
      pushed = true;
    } catch (_) {}
    function onPop() { close(true); }
    global.addEventListener('popstate', onPop);

    function close(fromBack) {
      doc.removeEventListener('keydown', onKey, true);
      global.removeEventListener('popstate', onPop);
      /* only unwind the entry we added, and only when the person did not
         arrive here BY unwinding it — otherwise Back would need pressing twice */
      if (pushed && !fromBack) { try { global.history.back(); } catch (_) {} }
      if (host.parentNode) host.remove();
      /* the drawing may have become a draft — Workspace and the resume list
         must re-read reality rather than show the world as it was */
      data.invalidate('/api/me');
      try {
        doc.dispatchEvent(new global.CustomEvent('ow:created', { detail: { type: 'canvas' } }));
      } catch (_) {}
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    /* WRAPPED, NOT PASSED DIRECTLY. `addEventListener('click', close)` hands
       the MouseEvent in as `fromBack`, which is truthy — so the Close button
       would have skipped unwinding its own history entry and left one Back
       press doing nothing. A one-argument function is not a listener. */
    back.addEventListener('click', function () { close(false); });
    doc.addEventListener('keydown', onKey, true);
    host.appendChild(back);
    doc.body.appendChild(host);
  };

  OW.live.begin = function (type, btn) {
    if (!type) return Promise.resolve(null);
    var label = (OW.live._createLabels || {})[type] || type;
    return data.post('/api/center/creations',
      { type: type, name: 'Untitled ' + String(label).toLowerCase() }).then(function (r) {
      if (!r.ok) {
        /* THE REFUSAL IS A DICT, NOT A STRING, AND IT RENDERED AS
           "[object Object]". The tier gate answers
           `{"detail":{"error":"plan_required","message":"Presentation is a
           ONEWAY OS+ capability…"}}`, and `data.post` hands `detail` straight
           through — so the one refusal a person is MOST likely to meet was the
           one this could not say. Read the message out of it, and fall back to
           a plain sentence rather than a stringified object. */
        var err = r.error;
        if (err && typeof err === 'object') {
          err = err.message || err.error || '';
        }
        var said = r.status === 403 ? 'you cannot create here'
                  : r.status === 402 ? (err || 'that needs ONEWAY OS+')
                  : (err || 'could not begin');
        OW.say(btn, said);
        /* the press may have come from a sheet that has already folded away —
           the bar says it where the person is looking (founder/502 sweep) */
        if (OW.toast) OW.toast(String(said).replace(/^./, function (c) { return c.toUpperCase(); }));
        return null;
      }
      var c = (r.data && r.data.creation) || {};
      data.invalidate('/api/me');          /* Workspace must re-read reality */

      /* WALK INTO IT, DO NOT FILE IT AWAY. This announced "draft in your
         Workspace" and left the person exactly where they were — the thing
         they had just asked for existed somewhere they were not.

         WHICH TYPES OPEN IS THE EDITOR'S OWN DECLARED SCOPE, not a list I
         invented: `doc-editor.js` queries `?type=document,note` for its
         library, so those are the two it is built for. Everything else still
         says where it went, honestly, because opening a thing into an editor
         that cannot hold it would be worse than filing it. */
      /* A PRESENTATION OPENS IN THE SAME EDITOR, because a deck IS a document
         with slide breaks in it — `doc-editor.js` now declares the three by
         querying `?type=document,note,presentation`, and the runtime always
         said so: the type was registered as "a person's slides … not a second
         builder". */
      var opens = (type === 'document' || type === 'note' || type === 'presentation');
      if (opens && c.id && typeof global.owDocEditorOpen === 'function') {
        OW.say(btn, 'opening');
        global.owDocEditorOpen(c.id);
      } else {
        /* say where it went — a person should never wonder where a thing landed */
        OW.say(btn, 'draft in your Workspace');
        if (OW.toast) OW.toast('Started ' + (String(label).toLowerCase() || 'a draft') + ' — it is a draft in your Workspace.', { tone: 'ok' });
      }
      doc.dispatchEvent(new CustomEvent('ow:created', {
        detail: { id: c.id, type: type, name: c.name } }));
      return c;
    });
  };


})(window);
