/* WHAT ME, A PERSON, A CENTER AND THE ACCOUNT PAGES SHARE: the profile shell, the note composer, the fact list.
   Moved whole from frontend/app/popit-live.js by tools/boot_split.mjs (the boot split, PLAN §2 App boot row):
   oneway-app.html loads it with OW.need('pages') when its screen first opens; index.html loads it by tag. */
(function (global) {
  'use strict';
  var OW = global.OW;
  var _u = OW._u;
  var data = _u.data,
      doc = _u.doc,
      esc = _u.esc,
      imageUrl = _u.imageUrl,
      mk = _u.mk,
      nothing = _u.nothing,
      stateTile = _u.stateTile,
      toldOnce = _u.toldOnce;


  /* ── A COUNT BESIDE A BUTTON MUST MOVE WHEN THE BUTTON DOES ────────────
     Pressing Follow flipped the label to "Following" and left "1 follower"
     sitting next to it — correct on the server, wrong on the screen, until the
     person reloaded. Found by walking the product; every suite was green,
     because the server was right and nothing asked what the screen said.

     ONE STEP, NOT A GUESS AT A TOTAL. `/api/me/follow` answers `following` and
     `friends` and carries no count, so there is no authoritative number to
     take. Adjusting by one is exactly what just happened, and the next read
     replaces it with the server's own figure.

     IT CREATES THE STAT WHEN THERE WAS NONE. A person with no followers has no
     followers line at all, so following them had nothing to update — the count
     would have appeared only on reload, which is the same defect wearing a
     zero. */
  function bumpStat(fromBtn, key, delta, one, many) {
    var box = fromBtn && fromBtn.closest && fromBtn.closest('.ow-prof__id');
    if (!box) return;
    var el = box.querySelector('[data-stat="' + key + '"]');
    var n;
    if (el) {
      n = Math.max(0, (parseInt((el.querySelector('b') || {}).textContent, 10) || 0) + delta);
      if (!n) { el.parentNode && el.parentNode.removeChild(el); return; }
      el.innerHTML = '<b>' + n + '</b>' + (n === 1 ? one : many);
      return;
    }
    if (delta <= 0) return;
    var row = box.querySelector('.ow-prof__stats');
    if (!row) return;
    var made = mk('span', 'ow-prof__stat', '<b>1</b>' + one);
    made.setAttribute('data-stat', key);
    row.insertBefore(made, row.firstChild);
  }

  /* ══ THE PLATFORM'S OWN SENTENCE, WHEREVER IT REFUSES ═══════════════════
     ★ FOUNDER/402: the refusal appears where the interaction is, and it says
     the actual reason.

     A door refuses in one of three shapes and a surface that only reads one
     of them prints nothing useful for the other two:

       {detail: "not available — 1 conflicting reservation(s)"}   a sentence
       {detail: {error, rule, message, refusals:[{rule, message}]}} a RULE
       {detail: [{loc, msg}]}                                      validation

     AND ALMOST NOTHING IN THE APP EVER SHOWED ONE. Eight surfaces read
     `r.data.detail` on a refusal — the booking, the cancel, the post editor,
     the delete, the profile field, adding someone to a conversation — and on
     a failure this layer sets no `data` at all. Every one of them was reading
     a field that is never there, so every refusal in the App fell through to
     its own generic sentence and the door's actual reason was discarded on
     the way in. Two surfaces read `r.error`, which is the real contract, and
     one of those had a comment saying so.

     So the flattening happens HERE, once, where every read and every write
     already funnels: `error` is a string a surface can put on the screen
     whatever shape arrived, and `body` keeps the raw answer for a caller that
     needs the rule name to act on it.

     All the refusals are said, never just the first: a stay can break two
     rules at once, and fixing one only to be refused again reads as a broken
     form rather than a house rule. */
  /* WHAT A PERSON READS WHEN A REQUEST IS REFUSED: the shared door's words (frontend/shared/oneway-data.js), so the App
     and the OS say the same thing for the same refusal */
  var failSaid = data.failSaid, failWords = data.failWords, refusalWords = data.refusalWords, sentence = data.sentence;

  /* 4.2 — PROFILE (My Center). Rewritten against the real payload, which
     turned out to carry more than the first pass used:
       · user.style.accent_hue — THE VIEWED PERSON'S OWN HUE. Feed actors are
         all issued the platform default, but a profile knows its person's hue,
         so their widgets can wear it.
       · rings — the Gallery rings EXPERIENCE.md describes, each with a cover
         and a real media count.

     TWO RULES REAL DATA FORCED, both about not lying with numbers:
       · A ZERO IS NOT EXPRESSION. "Followers 0" is a scoreboard reading nil,
         and putting it on someone's profile says something about them that
         they did not choose to say. Counts appear only when there is something
         to count.
       · A COUNT BELONGS TO THE THING IT COUNTS. The first pass labelled the
         total number of galleries onto ONE gallery ("5 public" beside a
         gallery holding 3 items), which is simply false. */
  /* 4.2a — THE PROFILE SHELL. The familiar shape (founder, 2026-07-30: "think
     twitter/reddit profiles layout with bars people can click on replacing the
     entire lower subsection of the page") — banner, avatar over it, identity,
     then a row of BARS whose selection replaces everything below.

     Familiar chrome, ONEWAY underneath: each panel's contents are still Popits,
     and the CSS this builds against (§15) was written for exactly this markup.

     A panel is rendered ON DEMAND and then kept. Rendering all of them up front
     would fetch reality nobody asked to see, which is the cost law; re-rendering
     on every visit would throw away a scroll position a person just set. */
  /* 4.2a-bis — SETTING YOUR OWN NOTE.

     Founder, 2026-08-17: a note is *"a thing that appears above a profile
     picture basically everywhere where they would display it."* A note nobody
     can write is a rendering exercise, so this is the field — and it lives in
     the note's OWN position, above the person's own face, rather than buried in
     Settings. You change it where you see it.

     WHAT IT REFUSES TO DO. It does not offer a length it cannot keep: the
     runtime caps at 60 characters and CUTS rather than refusing, so a client
     that let a person type 200 would silently lose 140 of their words and show
     them a note they did not write. The counter is the truth of that cap, read
     FROM the runtime (`max_chars`) rather than hardcoded here — two numbers for
     one rule is how they drift apart.

     CLEARING IS NOT AN EMPTY NOTE. Sending "" would be a note that says
     nothing; `DELETE` is the absence the badge field is built on, and it is the
     same distinction the runtime draws between `nobody` and a blank string. */
  function noteComposer(idRow, avatarEl, existing) {
    var caps = { max_chars: 60 };
    var btn = mk('button', 'ow-note-set');
    btn.type = 'button';
    var relabel = function (note) {
      var t = note && note.text ? String(note.text) : '';
      btn.textContent = t || 'Leave a note';
      /* when a note EXISTS the badge is already drawn by `OW.noteOn`, so the
         button must not draw a second copy of the same words on top of it —
         it becomes the affordance to CHANGE the one that is showing */
      btn.style.display = note && note.text ? 'none' : '';
    };
    relabel(existing);

    /* the note badge is the click target once one exists — tapping your own
       note edits it, which is the gesture people already expect */
    var badge = null;
    var openEditor = function () {
      if (idRow.querySelector('.ow-note-edit')) return;
      badge = idRow.querySelector('.po-note');
      if (badge) badge.style.visibility = 'hidden';
      btn.style.display = 'none';

      var box = mk('div', 'ow-note-edit');
      var inp = doc.createElement('input');
      inp.type = 'text'; inp.placeholder = 'Say something';
      inp.maxLength = caps.max_chars;
      inp.value = (existing && existing.text) || '';
      var count = mk('small', '', String(caps.max_chars - inp.value.length));
      var save = mk('button', '', 'Set');
      var clear = mk('button', '', 'Clear');
      clear.setAttribute('data-act', 'clear');
      save.type = clear.type = 'button';
      box.appendChild(inp); box.appendChild(count);
      box.appendChild(save); box.appendChild(clear);
      idRow.appendChild(box);
      inp.focus(); inp.select();

      inp.addEventListener('input', function () {
        /* clamped at zero: `maxLength` stops a person typing past the cap, but
           a value set any other way can, and "-20" characters remaining is a
           number that means nothing to anybody */
        count.textContent = String(Math.max(0, caps.max_chars - inp.value.length));
      });

      var close = function () {
        box.remove();
        if (badge) badge.style.visibility = '';
        relabel(existing);
      };
      var redraw = function (note) {
        existing = note;
        if (badge) { badge.remove(); badge = null; }
        if (note && note.text) OW.noteOn(avatarEl, note);
        close();
        /* THE NOTE IS ON OTHER SURFACES TOO, AND THEY ARE CACHED. Skipping
           this is the "a write nobody reads" defect one layer up: the note is
           saved, the runtime is right, and the person's own feed keeps showing
           yesterday's badge until a reload. Every read that carries a note is
           dropped, so the next paint of any of them is true. */
        ['/api/oneway/people/', '/api/oneway/social/feed', '/api/conversations', '/api/oneway/map',
         '/api/oneway/people/me/note'].forEach(function (k) { data.invalidate(k); });
      };

      save.addEventListener('click', function () {
        var text = inp.value.trim();
        if (!text) { close(); return; }
        save.disabled = true;
        data.post('/api/oneway/people/me/note', { text: text }, { method: 'PUT', queueable: true })
          .then(function (r) {
            if (r && r.queued) {
              /* WRITTEN DOWN, NOT YET SENT (PLAN G6): the note shows at once, and goes back to what it was only if refused later */
              var before = existing;
              redraw({ text: text });
              OW.outbox.watch(r.pending_id, null, function (words) {
                existing = before; relabel(before);
                if (OW.toast) OW.toast('Your note did not save. ' + words);
              });
              toldOnce();
              return;
            }
            /* A NOTE THAT DID NOT SAVE IS NOT DRAWN AS IF IT DID — this fell
               back to what was typed on any failure, so the badge showed a
               note nobody else could see (founder/502 sweep). The editor stays
               open with the words in it, and the reason is said. */
            if (!r || !r.ok) {
              save.disabled = false;
              if (OW.toast) OW.toast('Your note did not save. ' + ((r && r.error) || 'Try again.'));
              return;
            }
            /* the RUNTIME's version of the note is what everyone else will
               see — it collapsed the whitespace and cut it to the cap — so the
               badge is redrawn from the response, never from what was typed */
            redraw((r.data && r.data.note) || { text: text });
          })
          .catch(function () { save.disabled = false; });
      });
      clear.addEventListener('click', function () {
        clear.disabled = true;
        data.post('/api/oneway/people/me/note', null, { method: 'DELETE', queueable: true })
          .then(function (r) {
            if (r && r.queued) {
              var before = existing;
              redraw(null);
              OW.outbox.watch(r.pending_id, null, function (words) {
                existing = before;
                if (before && before.text && OW.noteOn) OW.noteOn(avatarEl, before);
                relabel(before);
                if (OW.toast) OW.toast('Your note is still up. ' + words);
              });
              toldOnce();
              return;
            }
            if (!r || !r.ok) {
              clear.disabled = false;
              if (OW.toast) OW.toast('Your note is still up. ' + ((r && r.error) || 'Try again.'));
              return;
            }
            redraw(null);
          })
          .catch(function () { clear.disabled = false; });
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); save.click(); }
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
    };

    btn.addEventListener('click', openEditor);
    idRow.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.po-note')) openEditor();
    });
    idRow.appendChild(btn);

    /* the cap comes from the runtime, and the composer works before it answers
       — an editor that waits on a GET to become usable is a slower editor for
       no gain, since 60 is only ever tightened, never loosened */
    data.get('/api/oneway/people/me/note').then(function (r) {
      if (r && r.ok && r.data && r.data.max_chars) {
        caps.max_chars = r.data.max_chars;
        var live = idRow.querySelector('.ow-note-edit input');
        if (live) live.maxLength = caps.max_chars;
      }
    }).catch(function () {});
  }

  /* ── A NAME, SET IN THE FACE ITS OWNER CHOSE ──────────────────────────
     ★ FOUNDER, 2026-09-10: *"i want to also supoort custom wordmarks on
       peoples profiles and posts like apple music now does."*

     THE WORDS COME FROM THE NAME, ALWAYS. A wordmark is a treatment, not a
     second name and not an image — so this takes the name the surface was
     already going to render and only changes the FACE. There is nothing a
     person can put here that is not their own name.

     THE STACK COMES FROM THE SERVER, RESOLVED. `person.wordmark` arrives as
     {key, label, stack, weight}, so no surface joins a key against a
     catalogue — a failed join would set somebody's name in the wrong face,
     and every surface would have to do it.

     SILENT WHEN THERE IS NOTHING TO SAY. No wordmark, or the default one, and
     the element is left exactly as it was: the platform's own face, which is
     what a person who has chosen nothing should see. */
  function wearWordmark(el, wm) {
    if (!el || !wm || !wm.stack) return el;
    if (wm.key && wm.key !== 'default') {
      el.classList.add('ow-wm');
      el.style.setProperty('--wm', wm.stack);
      if (wm.weight) el.style.setProperty('--wm-w', String(wm.weight));
    }
    return el;
  }

  function profileShellLegacy(host, o) {
    o = o || {};
    host.className = ''; host.innerHTML = '';
    var root = mk('div', 'ow-prof');
    root.setAttribute('data-projection', 'full');
    root.setAttribute('data-kind', o.kind === 'center' ? 'center' : 'person');
    root.setAttribute('data-banner-style', o.bannerStyle === 'fade' || o.bannerStyle === 'framed'
      ? o.bannerStyle : 'framed');
    root.setAttribute('data-banner-shape', o.bannerShape === 'square' ? 'square' : 'rounded');
    var bannerDepth = Number.isInteger(+o.bannerDepth) && +o.bannerDepth >= 104 && +o.bannerDepth <= 192 ? +o.bannerDepth : 144;
    root.style.setProperty('--ow-banner-height', bannerDepth + 'px');
    root.style.setProperty('--ow-banner-mobile-height', Math.round(bannerDepth * .75) + 'px');
    root.style.setProperty('--ow-banner-fade-space', Math.round(48 + (bannerDepth - 104) * .4) + 'px');
    root.style.setProperty('--ow-banner-mobile-fade-space', Math.max(42, Math.round(36 + (bannerDepth - 104) * .3)) + 'px');
    /* WHERE THE PICTURE SITS IS THE ACCOUNT'S CHOICE (a person's Appearance switch, a Center's in the OS): above the
       name, centred in the header as on TikTok's profiles, or beside it. `beside` until they choose. */
    root.setAttribute('data-layout', o.layout === 'above' ? 'above' : 'beside');
    /* NO hue.scope HERE, deliberately. Both callers already set the SURFACE
       hue via hue.context — this whole page IS that identity's world. Scoping
       it again pinned --ow-h1 onto this subtree, so when a person picked a new
       colour the tween moved the document and the profile underneath it did
       not: the choice appeared to do nothing until reload. One identity, one
       place that decides its light. (A REFERENCED identity inside the page —
       a Center on a shelf — is still scoped per widget; that is the other
       layer and it stays.) */

    /* the banner: their picture if they have one, their own light if not —
       never a stock image chosen for them (Law 15 reaches appearance too) */
    var ban = mk('div', 'ow-banner');
    var bannerSrc = imageUrl(o.banner);
    if (bannerSrc) {
      var im = doc.createElement('img');
      im.src = bannerSrc; im.alt = ''; im.loading = 'eager'; im.decoding = 'async';
      ban.appendChild(im);
      ban.appendChild(mk('span', 'ow-banner__hue'));
    }
    if (!bannerSrc) ban.setAttribute('data-empty', '1');
    ban.appendChild(mk('span', 'ow-banner__shade'));
    /* THE BANNER IS THE BACKDROP OF THE WHOLE HEADER, as on TikTok's profiles (looked at, 2026-10-10): a picture that
       runs edge to edge behind the picture, the name, the counts and the bio, which sit ON it, and fades into the page
       below. A short band above a header was a different thing. */
    var hero = mk('div', 'ow-prof__hero');
    if (bannerSrc) hero.setAttribute('data-picture', '1');
    hero.appendChild(ban);
    if (typeof o.onBannerChange === 'function') {
      var editCover = mk('button', 'ow-prof__banner-edit', 'Edit cover');
      editCover.type = 'button';
      editCover.setAttribute('aria-expanded', 'false');
      var coverTools = mk('div', 'ow-prof__banner-tools');
      coverTools.hidden = true;
      function bannerChoice(label, key, value) {
        var button = mk('button', 'ow-prof__banner-choice', label);
        button.type = 'button';
        button.setAttribute('aria-pressed', root.getAttribute('data-banner-' + key) === value ? 'true' : 'false');
        button.addEventListener('click', function () {
          var old = root.getAttribute('data-banner-' + key);
          if (old === value) return;
          root.setAttribute('data-banner-' + key, value);
          refreshBannerTools();
          Promise.resolve(o.onBannerChange(key === 'style' ? { banner_style: value } : { banner_shape: value }))
            .catch(function () { root.setAttribute('data-banner-' + key, old); refreshBannerTools(); if (OW.toast) OW.toast('The cover change did not save.'); });
        });
        return button;
      }
      var styleRow = mk('div', 'ow-prof__banner-choices');
      styleRow.appendChild(bannerChoice('Fade', 'style', 'fade'));
      styleRow.appendChild(bannerChoice('Framed', 'style', 'framed'));
      coverTools.appendChild(styleRow);
      var framedTools = mk('div', 'ow-prof__banner-framed');
      var cornerRow = mk('div', 'ow-prof__banner-choices');
      cornerRow.appendChild(bannerChoice('Rounded', 'shape', 'rounded'));
      cornerRow.appendChild(bannerChoice('Square', 'shape', 'square'));
      framedTools.appendChild(cornerRow);
      var depthLabel = mk('label', 'ow-prof__banner-depth', 'Height');
      var depth = doc.createElement('input');
      depth.type = 'range'; depth.min = '104'; depth.max = '192'; depth.step = '4'; depth.value = String(bannerDepth);
      depth.setAttribute('aria-label', 'Cover height');
      depth.addEventListener('input', function () {
        var n = +depth.value;
        root.style.setProperty('--ow-banner-height', n + 'px');
        root.style.setProperty('--ow-banner-mobile-height', Math.round(n * .75) + 'px');
        root.style.setProperty('--ow-banner-fade-space', Math.round(48 + (n - 104) * .4) + 'px');
        root.style.setProperty('--ow-banner-mobile-fade-space', Math.max(42, Math.round(36 + (n - 104) * .3)) + 'px');
      });
      depth.addEventListener('change', function () {
        var old = bannerDepth, next = +depth.value;
        Promise.resolve(o.onBannerChange({ banner_depth: next })).then(function () { bannerDepth = next; })
          .catch(function () {
            depth.value = String(old);
            root.style.setProperty('--ow-banner-height', old + 'px');
            root.style.setProperty('--ow-banner-mobile-height', Math.round(old * .75) + 'px');
            root.style.setProperty('--ow-banner-fade-space', Math.round(48 + (old - 104) * .4) + 'px');
            root.style.setProperty('--ow-banner-mobile-fade-space', Math.max(42, Math.round(36 + (old - 104) * .3)) + 'px');
            if (OW.toast) OW.toast('The cover height did not save.');
          });
      });
      depthLabel.appendChild(depth);
      coverTools.appendChild(framedTools);
      coverTools.appendChild(depthLabel);
      function refreshBannerTools() {
        coverTools.querySelectorAll('.ow-prof__banner-choice').forEach(function (button) {
          var label = button.textContent;
          var key = label === 'Fade' || label === 'Framed' ? 'style' : 'shape';
          button.setAttribute('aria-pressed', root.getAttribute('data-banner-' + key) === label.toLowerCase() ? 'true' : 'false');
        });
        framedTools.hidden = root.getAttribute('data-banner-style') !== 'framed';
      }
      refreshBannerTools();
      editCover.addEventListener('click', function () {
        coverTools.hidden = !coverTools.hidden;
        editCover.setAttribute('aria-expanded', coverTools.hidden ? 'false' : 'true');
      });
      hero.appendChild(editCover);
    }
    root.appendChild(hero);

    var id = mk('div', 'ow-prof__id');
    var av = mk('div', 'ow-avatar');
    av.setAttribute('data-shape', 'round');
    if (o.avatarFit) av.setAttribute('data-fit', o.avatarFit);   /* 'contain': a mark, shown whole */
    /* A LOGO IS NOT ALWAYS A FILE. Some Centers store a single glyph as their
       mark, which is a real choice they made — running it through the URL
       validator refuses it and falls back to initials, quietly replacing their
       identity with ours. So: a URL renders as an image, a short glyph renders
       as itself, and only genuine absence falls back to initials. */
    var rawLogo = String(o.logo == null ? '' : o.logo).trim();
    var logoSrc = imageUrl(rawLogo);
    function noPicture() {
      if (OW.cards) OW.cards.fill(av, { kind: o.kind, name: o.name || '' });
    }
    if (logoSrc) {
      var lg = doc.createElement('img'); lg.src = logoSrc; lg.alt = '';
      /* a picture that does not load is the face that has none: measured at 390
         (2026-10-09), a Center whose picture answers 404 drew the browser's
         broken-image glyph in its own header */
      lg.onerror = function () { av.innerHTML = ''; noPicture(); };
      av.appendChild(lg);
    } else if (rawLogo && rawLogo.length <= 8 && !/[\/:.]/.test(rawLogo)) {
      av.textContent = rawLogo;                       /* their mark, as given */
    } else {
      noPicture();
    }
    id.appendChild(av);
    /* THE NOTE SITS ON THE FACE (founder, 2026-08-17: *"a note is like a thing
       that appears above a profile picture basically everywhere where they
       would display it"*). `OW.noteOn` is the same implementation the feed card
       uses through `OW.noteHTML` — one note, two entry points, never a second
       design that drifts from the first. On the person's own profile the note
       and the field that writes it occupy the SAME position, because reading
       your note and changing it should not be two different places. */
    if (o.note) OW.noteOn(av, o.note);
    if (o.noteMine) noteComposer(id, av, o.note);
    if (OW.cards && OW.cards.identityHTML) {
      var identity = mk('div');
      identity.innerHTML = OW.cards.identityHTML({ kind: o.kind, title: o.name, handle: o.sub },
        { prefix: 'ow-prof', heading: true, website: false });
      while (identity.firstChild) id.appendChild(identity.firstChild);
      wearWordmark(id.querySelector('.ow-prof__name'), o.wordmark);
    } else {
      id.appendChild(wearWordmark(mk('h1', 'ow-prof__name', esc(o.name || '')), o.wordmark));
      if (o.sub) id.appendChild(mk('p', 'ow-prof__handle', esc(o.sub)));
    }
    if (o.descriptor) id.appendChild(mk('p', 'ow-prof__descriptor', esc(o.descriptor)));

    /* ── WHAT A PERSON SAYS ABOUT THEMSELVES ──────────────────────────────
       ★ FOUNDER, 2026-09-06: *"PROFILE SHOULD BE PERFECT AND SO SHOULD USER
         DEPTH OF GOOGLE ACCOUNT AND FACEBOOK."*

       A canonical profile held a name and a note. Four things a person could
       be, against the eleven claims Google returns for the same human — and
       this shell had nowhere to put a bio even if one existed.

       IT SITS UNDER THE NAME AND ABOVE THE STATS, deliberately: their own
       sentence outranks a count of their followers. A person who has written
       nothing gets NOTHING here — no placeholder, no "no bio yet" — because an
       empty profile is a legitimate thing to be and a page must not nag. */
    if (o.bio) id.appendChild(mk('p', 'ow-prof__bio', esc(o.bio)));
    /* THE ONE LINK BAR (founder/442) — under the sentence, above the counts */
    if (o.links && o.kind !== 'center') id.appendChild(o.links);

    /* THE SMALL FACTS — where they are, where else they are. Each is drawn
       only when it is KNOWN; absent stays absent rather than becoming a row
       with a dash in it. A website is the one fact that is also a door, so it
       is the only one that is a link, and the scheme is checked before it
       becomes an href: a profile field is text a stranger typed, and
       `javascript:` is a URL. */
    var facts = (o.facts || []).filter(function (f) { return f && f.value; });
    if (facts.length) {
      var fr = mk('div', 'ow-prof__facts');
      facts.forEach(function (f) {
        var href = f.href && /^(https?:\/\/|tel:|mailto:)/i.test(f.href) ? f.href : '';
        var one;
        if (href) {
          one = doc.createElement('a');
          one.className = 'ow-prof__fact ow-prof__fact--link';
          one.href = href; one.target = '_blank'; one.rel = 'noopener noreferrer';
        } else {
          one = mk('span', 'ow-prof__fact');
        }
        one.innerHTML = '<span>' + esc(f.value) + '</span>';
        fr.appendChild(one);
      });
      id.appendChild(fr);
    }
    /* WHAT IS HAPPENING HERE — a live line the CALLER composes, because only the
       caller knows what "live" means for its kind. A Center says what is coming
       up; a person has no equivalent and passes nothing, which is why this is a
       node rather than a string field: absent is the common case and it must
       cost nothing. */
    if (o.live) id.appendChild(o.live);

    /* A ZERO IS NOT EXPRESSION — the same rule the widgets follow. Counts are
       passed in already filtered; nothing here invents one. */
    if ((o.stats || []).length) {
      var st = mk('div', 'ow-prof__stats');
      o.stats.forEach(function (s) {
        /* ★ FOUNDER/472: a count of followers or following is a DOOR to the
           list, as it is on every platform a person has used — it was plain
           text here. Pressing one opens the list over the page. */
        var key = s[2] || (/^follow/.test(String(s[1])) ? (String(s[1]).indexOf('following') === 0 ? 'following' : 'followers') : '');
        var opens = ((key === 'following' || key === 'followers') && o.email) ||
          (o.kind === 'center' && (key === 'members' || key === 'followers'));
        var one = mk(opens ? 'button' : 'span', 'ow-prof__stat',
          '<b>' + esc(s[0]) + '</b>' + esc(s[1]));
        /* AN OPTIONAL THIRD ELEMENT NAMES THE STAT, so an action can correct it
           without re-rendering the whole profile. Rendering is unchanged when
           it is absent. */
        if (key) one.setAttribute('data-stat', key);
        if (opens) {
          one.type = 'button';
          one.addEventListener('click', function () {
            if (o.kind === 'center') {
              if (host.__owShowTab) host.__owShowTab('people');
            } else if (OW.project && OW.project.open) OW.project.open('people', key + ':' + o.email, one);
          });
        }
        st.appendChild(one);
      });
      id.appendChild(st);
    }
    if (o.acts) id.appendChild(o.acts);
    hero.appendChild(id);
    if (coverTools) hero.appendChild(coverTools);
    if (o.kind === 'center') {
      var details = mk('aside', 'ow-prof__details');
      details.setAttribute('aria-label', 'Center information');
      (o.details || []).forEach(function (f) {
        if (!f || !f.value) return;
        var row = mk('div', 'ow-prof__detail');
        if (f.label) row.appendChild(mk('span', 'ow-prof__detail-label', esc(f.label)));
        var href = f.href && /^(https?:\/\/|tel:|mailto:)/i.test(f.href) ? f.href : '';
        if (href) {
          var link = doc.createElement('a');
          link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = String(f.value); row.appendChild(link);
        } else row.appendChild(mk('span', '', esc(f.value)));
        details.appendChild(row);
      });
      if (o.links) details.appendChild(o.links);
      hero.appendChild(details);
    }

    /* the bars */
    /* PUBLIC FIRST, THEN THE PERSON'S OWN — a STABLE partition, so each group
       keeps the order its caller declared. Without this the boundary is not a
       boundary: `Memories` is public and was declared after three owner-only
       tabs, so a single separator would have landed mid-row with public tabs on
       both sides of it, which is worse than no separator at all. */
    /* A HIDDEN TAB STILL EXISTS, IT JUST HAS NO CHIP. `Understanding` moved
       into the person's Menu and is opened from there; its renderer must stay
       reachable by id, so it is filtered out of the STRIP rather than deleted
       from the list. Filtering here — the one place the strip is built — is
       what makes the flag real; set on a tab and honoured nowhere, it would
       have been a no-op that read as a change. */
    var tabs = (o.tabs || []).filter(Boolean);
    /* ── THE STRIP IS WHAT THIS PERSON IS; THE GEAR IS HOW THEY RUN IT ─────
       ★ FOUNDER, 2026-08-26: *"make a settings gear in the upper right, no
         yours on the profile categories."*

       The strip carried both — Profile, World, Posts, Story, Memories AND
       Understanding, Appearance, Your activity, Settings — separated by a
       little "yours" divider that existed to explain why two unlike things
       were in one row. The divider was the tell: a row that needs a label
       explaining its own contents is two rows. Administration moves behind a
       gear, which is where every platform puts it and where a person already
       looks, and the strip goes back to being views of a person. */
    var strip = tabs.filter(function (t) { return !t.hidden && !t.own; });
    var bar = mk('div', 'ow-tabs'); bar.setAttribute('role', 'tablist');
    var panel = mk('div', 'ow-panel');
    var built = {}, active = null;

    /* ── A PANE THAT WAS RIGHT WHEN IT WAS BUILT ─────────────────────────────
       Panes are rendered once and kept — deliberately, so returning to a tab
       does not re-fetch reality nobody asked for and does not throw away a
       scroll position the person just set.

       **But a kept pane is a SNAPSHOT, and something can make it false.**
       Choose your widgets under Appearance, tap Profile, and the old set is
       still there: the pane was correct when it was built and the world moved
       underneath it. The person changed the one setting whose entire purpose is
       to change that pane, and the surface showed them their previous answer.

       So a caller can say the snapshot is stale. Only the ACTIVE pane is rebuilt
       immediately; the rest are dropped and rebuilt when next opened, because
       re-rendering a tab nobody is looking at spends a fetch on nothing. */
    function forget() {
      var was = active;
      built = {}; active = null;
      var t = (tabs.filter(function (x) { return x.id === was; })[0]) || strip[0];
      if (t) show(t);
    }
    doc.addEventListener('ow:profile-changed', forget);

    /* ── A SECTION CAN SEND YOU TO THE TAB THAT HOLDS THE REST ───────────
       ★ FOUNDER/429: things must *"feel like real pages"*. A real page shows
       three of what it has and links to all of them; that link needs a way to
       say "open the Events tab" from inside another pane. Published on the
       host rather than passed down, because the panes are built by callers
       that do not know the strip exists. */
    host.__owShowTab = function (id) {
      var t = tabs.filter(function (x) { return x.id === id; })[0];
      if (t) show(t);
    };

    function show(t) {
      /* the tab you are on takes you to the top of what it shows — never a
         press that does nothing (founder/502) */
      if (active === t.id) {
        try { bar.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {}
        return;
      }
      active = t.id;
      Array.prototype.forEach.call(bar.children, function (b) {
        b.setAttribute('aria-selected', b.dataset.t === t.id ? 'true' : 'false');
      });
      panel.innerHTML = '';
      var pane = built[t.id];
      if (!pane) {
        pane = built[t.id] = mk('div');
        panel.appendChild(pane);
        try { t.render(pane); } catch (e) {
          pane.classList.add('po-grid');
          stateTile(pane, 'refused', 'Not shown', 'This did not render.', '4x1');
        }
        return;
      }
      panel.appendChild(pane);
    }

    /* ── TWO JOBS, NOT NINE PEERS ────────────────────────────────────────
       Founder, 2026-08-17: *"right now on a person's profile this is not
       cutting it and is not intuitive."*

       My Center carried NINE tabs in one flat strip — Profile · World ·
       Galleries · Story · Understanding · Appearance · Your activity ·
       Memories · Settings — needing ~940px on a screen that gives 375. But the
       width was the symptom. **The strip mixed two different jobs and gave the
       person no way to tell them apart:** five of those tabs are what the WORLD
       SEES on your profile, and four are controls only YOU ever touch. A
       visitor's view and an owner's console, interleaved, in one undifferentiated
       row.

       That is why "what does my profile actually look like to someone else" had
       no answer on the screen whose entire job is to answer it.

       So a tab may declare `own: true`, and the strip SEPARATES at the boundary
       rather than reordering into a second control. One row still, one gesture
       still — the fade that earns its way in by measurement still works because
       it measures the same element — but the eye is told where the person's own
       side begins. Nothing is hidden and nothing moves out of reach; the only
       change is that the row stops pretending Settings and Galleries are the
       same kind of thing. */
    strip.forEach(function (t) {
      /* ICONS CARRY THE STRIP; the word is the accessible name and the
         tooltip. A tab that has no icon keeps its word, so nothing that has
         not been drawn yet silently disappears. */
      var b = mk('button', 'ow-tab', t.icon
        ? ('<svg viewBox="0 0 24 24" aria-hidden="true">' + t.icon + '</svg>'
           + (t.n ? '<span class="ow-tab__n">' + esc(t.n) + '</span>' : ''))
        : (esc(t.label) + (t.n ? '<span class="ow-tab__n">' + esc(t.n) + '</span>' : '')));
      b.type = 'button'; b.dataset.t = t.id; b.setAttribute('role', 'tab');
      if (t.icon) { b.setAttribute('aria-label', t.label); b.setAttribute('title', t.label);
                    b.setAttribute('data-icon', 'true'); }
      if (t.own) b.setAttribute('data-own', 'true');
      b.addEventListener('click', function () { show(t); });
      bar.appendChild(b);
    });
    /* THE GEAR, UPPER RIGHT. Only when this surface actually has a menu —
       somebody else's profile has no settings to open, and a gear that opens
       nothing is worse than no gear. */
    /* NO DIAL ON THE PROFILE (the founder, 2026-10-09: "on a persons profile the compass with appeance STILL EXISTS
       Instead of being moved into the new settings menu like it was supposed to"). Settings is the gear beside the
       bell (founder/495), and the dial's Appearance is a row there now (settingsMenu, Content and display). */
    root.appendChild(bar);
    root.appendChild(panel);
    host.appendChild(root);
    /* ── OPEN ON A TAB THAT HAS SOMETHING IN IT ──────────────────────────
       ★ FOUNDER, 2026-09-09: *"Profiles and Centers still need professional
         design refinement"* and *"improve hierarchy, progressive disclosure,
         navigation, defaults, grouping"* — without removing capability.

       This opened `tabs[0]` unconditionally. For a Center that is always Main,
       and Main is the arranged canvas, which almost nobody has arranged. So the
       ordinary visit landed on the one empty tab and spent half the screen
       explaining the emptiness — measured on Harbour Lights: 0 posts, 0
       upcoming, a real Story and eight fields of About, and the first thing a
       visitor saw was a globe and "Main is unarranged".

       A DEFAULT IS NOT A REORDERING. The strip keeps its order, Main stays
       first and one tap away; only the tab that OPENS changes.

       AND IT ONLY SKIPS A TAB THAT SAYS IT IS EMPTY. `n === 0` or
       `has === false` is a tab declaring, from data it already holds, that
       there is nothing behind it. A tab that declares NOTHING is unknown, and
       unknown is never skipped — guessing a tab is empty and passing over it is
       how this surface would start lying about Centers that do have something. */
    var opening = tabs.filter(function (t) {
      if (t.hidden) return false;
      if (t.has === false) return false;
      if (typeof t.n === 'number' && t.n === 0 && t.has !== true) return false;
      return true;
    })[0] || tabs[0];
    /* A CALLER MAY NAME THE TAB THAT OPENS. ★ FOUNDER/459: a Center button
       on Home takes you to the Center's FEED — its Main, arrangement on top,
       posts under — whatever else the Center carries (a written site opens
       on its own Home when you arrive from elsewhere). The strip's order is
       untouched; only the tab that opens is the one asked for. */
    if (o.open) {
      var asked = tabs.filter(function (t) { return t.id === o.open && !t.hidden; })[0];
      if (asked) opening = asked;
    }
    if (tabs.length) show(opening);

    /* THE FADE IS EARNED BY MEASUREMENT, NOT ASSUMED BY A BREAKPOINT. Seven
       tabs need ~729px; a phone gives 375, so the last label was sliced through
       its letters at the screen edge and read as broken layout rather than as
       "there is more this way". The mask that fixes it must not sit over a row
       that already fits, so the class is set from the element's own scrollWidth
       — the only thing that actually knows. Re-checked on resize and on
       rotation, because a row that fits in landscape does not in portrait. */
    function fade() {
      if (!bar.isConnected) return;
      bar.classList.toggle('ow-tabs--more', bar.scrollWidth > bar.clientWidth + 2);
    }
    fade();
    /* after fonts settle: a label measured before its webfont loads is the
       wrong width, and this row is entirely text */
    global.setTimeout(fade, 400);
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(fade);
    global.addEventListener('resize', fade);
    bar.addEventListener('scroll', function () {
      /* once they have scrolled to the end there is nothing more to promise */
      bar.classList.toggle('ow-tabs--more',
        bar.scrollWidth - bar.clientWidth - bar.scrollLeft > 2);
    });
    return root;
  }

  /* ── THE HEADER'S "ABOUT" ROW (founder, 2026-10-16: "CLEANLY PUT IT BY THE BIO JUST CUT ITS TEXT BOX, STOP PUTTING BAND
     AIDS" · "Location: Directions: ... Category: all directly on top and below each other ... on the RIGHT SIDE. social
     media icons go below" · "CATEGORYS ALL START IN STRAIGHT LINE"). One real row in the document, not a block pinned
     over the page: the bio on the left, the information on the right, side by side while they fit and the information
     under the bio when they do not, at any width a browser gives (a Chromebook, a phone, a desktop). The information is
     a two-column list (names in one straight column, values in the next) in a fixed order, with the social icons under
     it. A person's icons sit in the same place. ── */
  var INFO_ORDER = ['Location', 'Directions', 'Category'];
  function orderInformation(aside) {
    if (!aside) return;
    var rows = [].slice.call(aside.querySelectorAll(':scope > .ow-ocard__detail'));
    rows.sort(function (a, b) {
      var x = INFO_ORDER.indexOf(a.title), y = INFO_ORDER.indexOf(b.title);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    }).forEach(function (row) { aside.insertBefore(row, aside.querySelector(':scope > .ow-linkbar')); });
  }
  OW.profileInformationOrder = orderInformation;
  function aboutRow(root) {
    var id = root.querySelector('.ow-prof__id');
    if (!id || id.querySelector(':scope > .ow-prof__about')) return;
    var about = mk('div', 'ow-prof__about');
    var bio = id.querySelector(':scope > .ow-prof__bio');
    var anchor = bio || id.querySelector(':scope > .ow-prof__stats') || id.querySelector(':scope > .ow-prof__acts');
    if (anchor) id.insertBefore(about, anchor); else id.appendChild(about);
    if (bio) about.appendChild(bio);
    var aside = root.querySelector('.ow-prof__details');
    if (aside) { about.appendChild(aside); return; }
    var links = id.querySelector(':scope > .ow-linkbar');
    if (links) { var side = mk('aside', 'ow-prof__details'); side.setAttribute('aria-label', 'Links'); side.appendChild(links); about.appendChild(side); }
  }
  function profileShell(host, o) {
    profileShellLegacy(host, o);
    var root = host.querySelector('.ow-prof');
    if (root) aboutRow(root);
    if (o.kind === 'center' && o.cardRef && OW.cards && OW.cards.informationHTML) {
      var key = 'center:' + o.cardRef;
      function refreshInformation() {
        return OW.cards.read([key]).then(function (cards) {
          if (host.querySelector('.ow-prof') !== root || !cards[key]) return;
          var aside = root.querySelector('.ow-prof__details');
          if (!aside) return;
          var html = OW.cards.informationHTML(cards[key], { website: true, compact: true });
          aside.querySelectorAll(':scope > .ow-ocard__detail:not(.ow-prof__dir), :scope > .ow-prof__detail, :scope > .ow-ocard__details')
            .forEach(function (row) { row.remove(); });
          if (!html) return;
          var tmp = mk('div'); tmp.innerHTML = html;
          while (tmp.firstChild) aside.insertBefore(tmp.firstChild, aside.firstChild);
          orderInformation(aside);
        });
      }
      refreshInformation();
      if (OW.changes && OW.changes.on) OW.changes.on(root, refreshInformation);
    }
  }

  /* ═══ OPENING AN EVENT ══════════════════════════════════════════════════
     AN EVENT OPENS AS AN EVENT: the App's own event screen (`openEvent` in
     oneway-app.html, `OW.live.event`), read from the events domain on the new
     backend. Until 2026-10-01 a crossing, a memory and a Center's calendar row
     opened through main.py's public Popit (`/api/public/center/{id}/popit/
     {object}`), which knows only the legacy calendar. MEASURED that day on an
     isolated copy: an event made through the new backend answered 404 "this
     Center does not show that publicly", so every event the platform makes
     today opened to that sentence. The event screen also opens the legacy
     events the events domain carries; one known only to the legacy store says
     so on the screen itself. */
  function openEventScreen(eventId) {
    if (!eventId) return false;
    try {
      doc.dispatchEvent(new CustomEvent('ow:open-event', { detail: { id: String(eventId) } }));
    } catch (e) { return false; }
    return true;
  }

  function factList(host, rows, emptySentence, onPick) {
    rows = (rows || []).filter(function (r) { return r && r.value; });
    if (!rows.length) {
      return nothing(host, emptySentence || 'Nothing here yet.', 'Quiet');
    }
    host.classList.add('po-list');
    var frag = doc.createDocumentFragment();
    rows.forEach(function (r, i) {
      var n = OW.glance({
        id: r.id || ('fact-' + i),
        label: r.value,
        signal: [r.label, r.audit].filter(Boolean).join(' · '),
        icon: r.icon || '', hue: r.hue || null,
        face: r.face || null,
        /* a row that knows its date shows it ON the mark — see OW.glance */
        when: r.when || null
      }, { open: r.open !== false && !!r.open });
      /* THE ROW CARRIES ITS OWN IDENTITY. Binding a handler by POSITION and
         reading back into the source array is only correct while the two stay
         the same length — and this function drops rows with no value, so one
         unnamed Center would have made every click after it open a different
         place than the one under the finger. Nothing here counts. */
      /* the row is handed back WITH its element — an opening Popit unfolds from
         the thing that was pressed, and a caller with only the data has nothing
         to give the FLIP as an origin */
      if (onPick) n.addEventListener('click', function () { onPick(r, n); });
      frag.appendChild(n);
    });
    host.appendChild(frag);
    return rows.length;
  }

  /* ASKING YOUR OWN BRAIN. Conversation is the Brain's PRIMARY expression
     (BRAIN_LAWS) and a person could not address theirs at all. The answer is
     printed exactly as the runtime returns it — including "not enough
     information yet", which is the truthful answer and must never be dressed
     up into something that sounds like understanding. */
  function brainAsk(pane) {
    var box = mk('div', 'ow-composer');
    var ta = doc.createElement('textarea');
    ta.rows = 1;
    ta.placeholder = 'Ask your Brain about your world';
    ta.setAttribute('aria-label', 'Ask your Brain');
    var go = mk('button', 'ow-send',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 8 6 8z"/></svg>');
    go.type = 'button'; go.disabled = true;
    go.setAttribute('aria-label', 'Ask');
    var out = mk('div');
    ta.addEventListener('input', function () { go.disabled = !ta.value.trim(); });
    function ask() {
      var q = ta.value.trim();
      if (!q) return;
      go.disabled = true; out.innerHTML = '';
      out.appendChild(mk('p', 'ow-note show', 'Thinking…'));
      data.post('/api/oneway/people/me/brain/ask', { question: q }).then(function (r) {
        out.innerHTML = '';
        var d = (r && r.data) || {};
        if (!r.ok || !d.answer) {
          out.appendChild(mk('p', 'ow-note show ow-note--bad',
            esc((d.error || (r && r.error)) || 'no answer came back')));
        } else {
          /* the answer's own paragraphs, kept — escaped first, then its line
             breaks drawn as breaks (a list of places read as one run-on line) */
          out.appendChild(mk('p', 'ow-note show', esc(d.answer).replace(/\n+/g, '<br>')));
        }
        go.disabled = !ta.value.trim();
      });
    }
    go.addEventListener('click', ask);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
    });
    box.appendChild(ta); box.appendChild(go);
    pane.appendChild(box);
    pane.appendChild(out);
  }

  _u.brainAsk = brainAsk;
  _u.bumpStat = bumpStat;
  _u.factList = factList;
  _u.failSaid = failSaid;
  _u.failWords = failWords;
  _u.openEventScreen = openEventScreen;
  _u.profileShell = profileShell;
  _u.refusalWords = refusalWords;
  _u.sentence = sentence;
  _u.wearWordmark = wearWordmark;
})(window);
