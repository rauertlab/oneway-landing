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
  /* FOLLOWERS STAY AT 0 (founder, 2026-10-16: followers first and always, a 0 included; OW.cards.counts is the rule):
     only another count leaves the row when it reaches nothing. The markup is the card's, `<b>n</b> word`. */
  function bumpStat(fromBtn, key, delta, one, many) {
    var box = fromBtn && fromBtn.closest && fromBtn.closest('.ow-prof__id');
    if (!box) return;
    var el = box.querySelector('[data-stat="' + key + '"]');
    var n;
    if (el) {
      n = Math.max(0, (parseInt(String((el.querySelector('b') || {}).textContent || '').replace(/\D/g, ''), 10) || 0) + delta);
      if (!n && key !== 'followers') { el.parentNode && el.parentNode.removeChild(el); return; }
      el.innerHTML = '<b>' + n + '</b> ' + esc(n === 1 ? one : many);
      return;
    }
    if (delta <= 0) return;
    var row = box.querySelector('.ow-prof__stats');
    if (!row) return;
    var made = mk('span', 'ow-prof__stat', '<b>1</b> ' + esc(one));
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
      btn.textContent = t || 'Add a note';   /* the owner's own place for one, where it shows (founder/878) */
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
  /* A PERSON'S OWN LOGO IN PLACE OF THEIR NAME (founder/432, 435: "word marks should be able to display anyones custom
     logo in place of their name ... everywhere"). The people read serves `wordmark_image`, a transparent picture this
     platform holds (people/routes.py refuses one from elsewhere); measured 2026-10-17, no shipped surface drew it. The
     name stays the element's words for a reader (the picture's alt), and a picture that does not load gives it back. */
  function wearWordmarkImage(el, src, name) {
    var url = imageUrl(src);
    if (!el || !url) return el;
    var words = el.textContent;
    var im = doc.createElement('img');
    im.className = 'ow-prof__wm'; im.alt = name || words; im.decoding = 'async';
    im.onerror = function () { el.classList.remove('ow-prof__name--mark'); el.textContent = words; };
    im.src = url;
    el.textContent = ''; el.appendChild(im);
    el.classList.add('ow-prof__name--mark');
    return el;
  }

  /* the header's count row, from a list of {key, text, word}. ★ FOUNDER/472: a count of followers or following is a
     DOOR to the list, as it is on every platform a person has used. Pressing one opens the list over the page (a
     Center's followers: its People tab). `data-stat` names each one, so a press can correct it (bumpStat). */
  function drawStats(st, list, o, host) {
    st.innerHTML = '';
    (list || []).forEach(function (s) {
      var key = s.key || '';
      var opens = ((key === 'following' || key === 'followers') && o.email) || (o.kind === 'center' && key === 'followers');
      var one = mk(opens ? 'button' : 'span', 'ow-prof__stat', '<b>' + esc(s.text) + '</b> ' + esc(s.word));
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
    return st;
  }

  /* ── A TAB ROW WIDER THAN ITS SCREEN SAYS SO ────────────────────────────
     THE FADE IS EARNED BY MEASUREMENT, NOT ASSUMED BY A BREAKPOINT. Seven tabs need ~729px; a phone gives 375. The mask
     that says "there is more this way" must not sit over a row that already fits, so it is set from the row's own
     scrollWidth, the only thing that knows, and re-checked after the fonts settle, on resize and as the row scrolls.
     A FADE ALONE WAS NOT ENOUGH (a cold judge, 2026-10-17, on a Center at 390: "Nearby" cut at the edge "with no scroll
     cue"): 34px of fade over a half-shown word reads as clipping. So the row says it with a control as well: a "›" at its
     right end, over a wider fade, that scrolls it on, and a fade at its left once it has scrolled (`ow-tabs--less`), so
     either side that hides tabs says so. The tab that opens is brought wholly into view. The control is the row's
     sibling, never a tab (the row's children are its tabs). Held by api/test_tab_cue.py, on this function. */
  function tabCue(bar) {
    var next = doc.createElement('button');
    next.type = 'button'; next.className = 'ow-tabs__next'; next.hidden = true;
    next.setAttribute('aria-label', 'More tabs'); next.textContent = '\u203a';
    next.addEventListener('click', function () {
      var to = Math.min(bar.scrollLeft + Math.round(bar.clientWidth * 0.6), bar.scrollWidth - bar.clientWidth);
      try { bar.scrollTo({ left: to, behavior: 'smooth' }); } catch (e) { bar.scrollLeft = to; }
    });
    var watched = false;
    function measure() {
      if (!bar.isConnected) return;
      if (!next.parentNode && bar.parentNode) bar.parentNode.insertBefore(next, bar.nextSibling);
      /* THE ROW MOVES WHEN WHAT IS ABOVE IT DOES: a header that lands after the row (the profile's, from its card read) put
         the row 205px lower and left the control where the row had been. Measured again whenever the row's container
         changes size. */
      if (!watched && global.ResizeObserver && bar.parentNode) { watched = true; new global.ResizeObserver(function () { measure(); }).observe(bar.parentNode); }
      var over = bar.scrollWidth - bar.clientWidth, more = over > 2 && over - bar.scrollLeft > 2;
      bar.classList.toggle('ow-tabs--more', more);
      bar.classList.toggle('ow-tabs--less', over > 2 && bar.scrollLeft > 2);
      next.hidden = !more;
      if (more) {   /* over the row's right end, its height: the row and the control share a parent, so one frame of reference */
        next.style.top = bar.offsetTop + 'px'; next.style.height = bar.offsetHeight + 'px';
        next.style.left = (bar.offsetLeft + bar.offsetWidth - 40) + 'px';
      }
    }
    function reveal() {
      var on = bar.querySelector('[aria-selected="true"]');
      if (on && bar.scrollWidth > bar.clientWidth + 2) {
        var l = on.offsetLeft - bar.offsetLeft, r = l + on.offsetWidth;
        if (r > bar.scrollLeft + bar.clientWidth - 40) bar.scrollLeft = r - bar.clientWidth + 40;
        else if (l < bar.scrollLeft) bar.scrollLeft = Math.max(0, l - 12);
      }
      measure();
    }
    bar.__owCue = { measure: measure, reveal: reveal, next: next };
    measure();
    global.setTimeout(measure, 400);   /* a label measured before its webfont loads is the wrong width */
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(measure);
    global.addEventListener('resize', measure);
    bar.addEventListener('scroll', measure);
    return bar.__owCue;
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
      /* the card's own rule draws the name and the line under it (one line each; a name that only repeats the handle
         is said once, spec K5): the header and every card say them the same way */
      identity.innerHTML = OW.cards.identityHTML({ kind: o.kind, title: o.name },
        { prefix: 'ow-prof', heading: true, website: false, line: o.sub || '' });
      while (identity.firstChild) id.appendChild(identity.firstChild);
      wearWordmarkImage(wearWordmark(id.querySelector('.ow-prof__name'), o.wordmark), o.wordmarkImage, o.name);
    } else {
      id.appendChild(wearWordmarkImage(wearWordmark(mk('h1', 'ow-prof__name', esc(o.name || '')), o.wordmark), o.wordmarkImage, o.name));
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

    /* THE COUNTS ARE THE CARD'S (spec K6): followers first and always, then posts, then a person's following, never
       members, in OW.cards.counts' words. The caller hands the numbers it already read (`o.counts`) so the row is
       there at the first paint; profileShell then draws it again from the card read, the number every card shows. A
       caller with no numbers and no card gets the legacy rows it passed (`o.stats`). */
    var st = mk('div', 'ow-prof__stats');
    function statList() {
      if (o.counts && OW.cards && OW.cards.counts) return OW.cards.counts({ kind: o.kind, counts: o.counts });
      return (o.stats || []).map(function (s) {
        var key = s[2] || (/^follow/.test(String(s[1])) ? (String(s[1]).indexOf('following') === 0 ? 'following' : 'followers') : '');
        return { key: key, text: String(s[0]), word: String(s[1]) };
      });
    }
    drawStats(st, statList(), o, host);
    if (st.childNodes.length) id.appendChild(st);
    if (o.acts) id.appendChild(o.acts);
    hero.appendChild(id);
    if (coverTools) hero.appendChild(coverTools);
    /* THE INFORMATION, ON THE RIGHT OF THE ABOUT ROW: the card's own rows (OW.cards.informationHTML, drawn from the
       card read by profileShell: Location, Directions, Category), with the icons under them. A caller may hand rows
       it already holds ({label, value, href}); they are drawn in the card's markup, so the read's rows replace them
       without a jump. */
    if (o.kind === 'center') {
      var details = mk('aside', 'ow-prof__details');
      details.setAttribute('aria-label', 'Center information');
      (o.details || []).forEach(function (f) {
        if (!f || !f.value || !f.label) return;
        var row = mk('span', 'ow-ocard__detail');
        row.title = String(f.label);
        var href = f.href && /^(https?:\/\/|tel:|mailto:)/i.test(f.href) ? f.href : '';
        var v;
        if (href) { v = doc.createElement('a'); v.href = href; v.target = '_blank'; v.rel = 'noopener noreferrer'; }
        else { v = mk('span', ''); v.setAttribute('dir', 'auto'); }
        v.textContent = String(f.value);
        row.appendChild(v);
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
      if (bar.__owCue) bar.__owCue.reveal();   /* the tab that opens is wholly in view, never half under the edge */
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

    tabCue(bar);
    return root;
  }

  /* ── THE HEADER'S GRID AND ITS "ABOUT" ROW (founder, 2026-10-16: "CLEANLY PUT IT BY THE BIO JUST CUT ITS TEXT BOX, STOP
     PUTTING BAND AIDS" · "Location: Directions: ... Category: all directly on top and below each other ... on the RIGHT
     SIDE. social media icons go below" · "CATEGORYS ALL START IN STRAIGHT LINE"; founder/801: "the info condesne to the
     right, bio in line to the left, and social icons below"). The header is the card's anatomy (oneway-cards.js), laid
     out by ONE block of rules for both ("THE HEADER AND ITS CARD", oneway-popit.css):
         .ow-prof__id                 the grid (a card's .ow-ocard__top)
           .ow-avatar                 the face (.ow-ocard__face)
           .ow-prof__identity-stack   the name, the handle line, the counts (.ow-ocard__id)
           .ow-prof__acts             the actions (.ow-ocard__actions): across the header under 520px, beside the face
                                      from 520px (spec K7: one row at every width)
           .ow-prof__about            the bio on the left, the information on the right with the icons under it
                                      (.ow-ocard__summary), side by side at every width
     The information is a two-column list (names in one straight column, values in the next) in a fixed order. ── */
  var INFO_ORDER = ['Location', 'Directions', 'Category', 'Categories'];   /* one or several (founder/808) */
  function orderInformation(aside) {
    if (!aside) return;
    var rows = [].slice.call(aside.querySelectorAll(':scope > .ow-ocard__detail'));
    rows.sort(function (a, b) {
      var x = INFO_ORDER.indexOf(a.title), y = INFO_ORDER.indexOf(b.title);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    }).forEach(function (row) { aside.insertBefore(row, aside.querySelector(':scope > .ow-linkbar')); });
  }
  OW.profileInformationOrder = orderInformation;
  /* the about row, made when there is something to put in it, in its place in the grid (after the actions) */
  function aboutOf(root, make) {
    var id = root.querySelector('.ow-prof__id');
    if (!id) return null;
    var about = id.querySelector(':scope > .ow-prof__about');
    if (about || !make) return about;
    about = mk('div', 'ow-prof__about');
    var after = id.querySelector(':scope > .ow-prof__acts') || id.querySelector(':scope > .ow-prof__identity-stack');
    id.insertBefore(about, after ? after.nextSibling : null);
    return about;
  }
  function asideOf(root, make) {
    var aside = root.querySelector('.ow-prof__about > .ow-prof__details');
    if (aside || !make) return aside;
    var about = aboutOf(root, true);
    aside = mk('aside', 'ow-prof__details');
    aside.setAttribute('aria-label', root.getAttribute('data-kind') === 'center' ? 'Center information' : 'Links');
    about.appendChild(aside);
    return aside;
  }
  /* absent is absent: a row with nothing in it is not kept, and a header with no bio says so to its rules */
  function settleAbout(root) {
    var about = aboutOf(root, false);
    if (!about) return;
    var aside = about.querySelector(':scope > .ow-prof__details');
    var bar = aside && aside.querySelector(':scope > .ow-linkbar');
    if (bar && !bar.children.length) bar.remove();
    if (aside && !aside.children.length) aside.remove();
    if (!about.children.length) { about.remove(); return; }
    about.classList.toggle('ow-prof__about--no-bio', !about.querySelector(':scope > .ow-prof__bio'));
  }
  function aboutRow(root) {
    var id = root.querySelector('.ow-prof__id');
    if (!id || id.querySelector(':scope > .ow-prof__identity-stack')) return;
    /* the identity, beside the face (or under it): the name, the handle line, a descriptor, the counts */
    var identity = mk('div', 'ow-prof__identity-stack');
    var fields = id.querySelectorAll(':scope > .ow-prof__name, :scope > .ow-prof__handle, :scope > .ow-prof__descriptor, :scope > .ow-prof__stats');
    var av = id.querySelector(':scope > .ow-avatar');
    id.insertBefore(identity, av ? av.nextSibling : id.firstChild);
    fields.forEach(function (field) { identity.appendChild(field); });
    /* the actions, the grid's own row after the identity (never inside its narrow column: they wrapped there) */
    var acts = id.querySelector(':scope > .ow-prof__acts');
    if (acts) id.insertBefore(acts, identity.nextSibling);
    var bio = id.querySelector(':scope > .ow-prof__bio');
    var aside = root.querySelector('.ow-prof__details');
    var links = id.querySelector(':scope > .ow-linkbar');
    if (bio || aside || links) {
      var about = aboutOf(root, true);
      if (bio) about.appendChild(bio);
      if (aside) about.appendChild(aside);
      if (links) asideOf(root, true).appendChild(links);
    }
    settleAbout(root);
  }
  /* WHAT THE CARD READ SAYS, THE HEADER SAYS (spec K16: one read for the header and every card): the counts, a Center's
     information rows (Location, Directions from where()'s pin, Category) and the icons (the website first, no other
     host asked for anything) are drawn from OW.cards.read with the card's own parts. The header's own extras (a
     Center's Events icon, a door to its tab) stay after the icons. */
  function fromCard(root, card, o, host) {
    var id = root.querySelector('.ow-prof__id');
    var stack = id && id.querySelector(':scope > .ow-prof__identity-stack');
    if (!stack) return;
    var st = stack.querySelector(':scope > .ow-prof__stats');
    if (!st) { st = mk('div', 'ow-prof__stats'); stack.appendChild(st); }
    drawStats(st, OW.cards.counts(card), o, host);
    if (!st.childNodes.length) st.remove();
    if (card.kind === 'center' && OW.cards.informationHTML) {
      var rows = OW.cards.informationHTML(card);
      var aside = asideOf(root, !!rows);
      if (aside) {
        aside.querySelectorAll(':scope > .ow-ocard__detail, :scope > .ow-prof__detail, :scope > .ow-ocard__details')
          .forEach(function (row) { row.remove(); });
        var tmp = mk('div'); tmp.innerHTML = rows;
        var bar0 = aside.querySelector(':scope > .ow-linkbar');
        while (tmp.firstChild) aside.insertBefore(tmp.firstChild, bar0);
        orderInformation(aside);
      }
    }
    if (OW.cards.linksInner) {
      var icons = OW.cards.linksInner(card);
      var side = asideOf(root, !!icons);
      var bar = side && side.querySelector(':scope > .ow-linkbar');
      if (side && !bar && icons) {
        bar = mk('div', 'ow-linkbar ow-ocard__links'); bar.setAttribute('role', 'list');
        side.appendChild(bar);
      }
      if (bar) {
        bar.querySelectorAll(':scope > a.ow-linkbar__i').forEach(function (a) { a.remove(); });
        var t2 = mk('div'); t2.innerHTML = icons;
        var first = bar.firstChild;
        while (t2.firstChild) bar.insertBefore(t2.firstChild, first);
        bar.classList.add('ow-ocard__links');
      }
    }
    settleAbout(root);
  }
  /* THE HEADER'S ICONS, drawn by the card's renderer (OW.cards.linksInner: the website first, the platforms' own marks,
     no other host asked for its icon) from what a caller already read; the card read draws them again (fromCard) */
  function iconBar(cardLike) {
    var inner = OW.cards && OW.cards.linksInner ? OW.cards.linksInner(cardLike || {}) : '';
    if (!inner) return null;
    var bar = mk('div', 'ow-linkbar ow-ocard__links');
    bar.setAttribute('role', 'list');
    bar.innerHTML = inner;
    return bar;
  }
  _u.iconBar = iconBar;
  function profileShell(host, o) {
    profileShellLegacy(host, o);
    var root = host.querySelector('.ow-prof');
    if (root) aboutRow(root);
    if (root && o.cardRef && OW.cards && OW.cards.read && OW.cards.counts) {
      var key = (o.kind === 'center' ? 'center:' : 'person:') + o.cardRef;
      var refresh = function () {
        return OW.cards.read([key]).then(function (cards) {
          if (host.querySelector('.ow-prof') !== root || !cards[key]) return;
          fromCard(root, cards[key], o, host);
        });
      };
      refresh();
      /* a write anywhere: the card is asked again (S22), as OW.cards.mount does */
      if (OW.changes && OW.changes.on) OW.changes.on(root, function () { if (OW.cards.forget) OW.cards.forget(); refresh(); });
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
  /* ═══ THE PROFILE'S HEADER (founder/834, which supersedes founder/816's "profiles look just like the cards"; profileHeader
     below). Drawn from the card read every card shows, as a profile, never the card's markup; its acts are the profile's
     own buttons moved into it (Follow, Message, or the owner's own). NO BANNER OR COVER IS EVER IN IT: the account's banner
     is drawn as the account chose in Settings (founder/824, banner_style): Fade, across the whole top of the screen behind
     the header; Framed, its own picture above it (profile-header.css; red in api/test_profile_header.py and
     oneway/cards/test_profile_banner.py). Until the card read answers, the header's place is held and the shell's own header
     is never painted; a read that fails draws this header from what the shell was told (founder/878: ONE layout). */
  function angleOf(rgb) {
    var m = String(rgb || '').match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
    if (!m) return 262;
    var r = m[1] / 255, g = m[2] / 255, b = m[3] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 262;
    var hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(((hh * 60) + 360) % 360);
  }
  /* THE BANNER RUNS EDGE TO EDGE: from the top of the screen across its whole width (behind a wide screen's rail too),
     whatever margins the profile sits in; measured, and again when the window changes */
  function bleedBanner(root) {
    function fit() {
      if (!root.isConnected) { global.removeEventListener('resize', fit); return; }
      var col = root.closest('.ow-col') || doc.documentElement, cr = col.getBoundingClientRect(), pr = root.getBoundingClientRect();
      root.style.setProperty('--hdr-bleed-l', Math.round(-pr.left) + 'px');
      root.style.setProperty('--hdr-bleed-w', doc.documentElement.clientWidth + 'px');
      root.style.setProperty('--hdr-bleed-t', Math.round(cr.top - pr.top) + 'px');
      root.style.setProperty('--hdr-bleed-h', Math.round((cr.width >= 900 ? 300 : 230) + (pr.top - cr.top)) + 'px');
    }
    fit();
    global.addEventListener('resize', fit);
  }
  /* ── A PROFILE IS A PROFILE (founder/834, 2026-10-17: "I want to see profiles on the app being actually normal looking while
     the cards are nice representations of them. And also, they should have the exact same glow that the popits have once
     they are fixed unless on simple mode"; and "WHY ARE PROFILES WHEN CLICKED ON STILL JUST DISPLAYS OF THE CARD"). It
     supersedes founder/816's "profiles look just like the cards": the card stays the condensed form everywhere else, and the
     profile is drawn as Instagram and TikTok draw one. The picture and the counts on one row (a number over its word, each
     list a door); the name, the handle under it once (a name that is only the handle is said once), a Center's category;
     the bio; the place; a Center's details, a word over its value; the platforms; then the profile's own buttons, the
     first filled. A wide screen sets the picture larger at the left and everything else beside it.
     NO BOX (the founder, 2026-10-19: "The profiles need to look like social media profiles once clicked on and viewed ... the
     top headers of profiles shouldn't look like cards like this ... should be quick reflections and projections of them"):
     the header stands open on the page, in both modes, as Instagram's does; the card (OW.lcard) is the boxed, lit
     projection of it, and the banner the account's choice, Fade behind or Framed above (profile-header.css). Read from the
     same card read as the card (OW.cards.counts, handleLine, linksInner, no card markup): one truth, two forms. Held by
     api/test_profile_header.py and tools/probe/profile-header-shoot.cjs (red if the profile is the card's markup or wears
     a card's box). */
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  function profileHeader(c, o, ev) {
    var C = OW.cards, center = c.kind === 'center';
    var el = mk('section', 'ow-ph');
    el.setAttribute('data-kind', center ? 'center' : 'person');
    /* THE PICTURE ABOVE THE NAME OR BESIDE IT, the account's own choice (founder/878, 2026-10-21: "profile over name does not
       work over the new profile view"): TikTok's profile, the picture centred over the name, is this header too */
    el.setAttribute('data-layout', c.layout === 'above' ? 'above' : 'beside');
    el.setAttribute('aria-label', (c.title || 'This') + (center ? '' : '’s profile'));
    /* a person is round, as their picture is everywhere in the App (founder/471: a circle is the default); a Center keeps the
       cut its mark was given (a logo is often rounded or square) */
    var pic = (c.picture || {}), shape = center && /^(round|rounded|square)$/.test(pic.shape || '') ? pic.shape : 'round';
    var face = mk('div', 'ow-ph__face');
    face.setAttribute('data-shape', shape);
    if (pic.url) { var im = doc.createElement('img'); im.src = imageUrl(pic.url) || pic.url; im.alt = ''; im.decoding = 'async'; face.appendChild(im); }
    else face.appendChild(mk('span', 'ow-ph__ini', C.inside({ kind: center ? 'center' : 'person', name: c.title })));   /* the face rule, asked of the shared renderer (S21) */
    el.appendChild(face);
    /* the counts: followers always, a 0 included; a person's following; a Center's events (30+ past what is read) */
    var list = (C.counts ? C.counts(c) : []).slice();
    var have = function (k) { return list.some(function (x) { return x.key === k; }); };
    if (!have('posts')) list.unshift({ key: 'posts', n: 0, text: '0', word: 'posts' });
    if (!have('followers')) list.push({ key: 'followers', n: 0, text: '0', word: 'followers' });
    if (!center && !have('following')) list.push({ key: 'following', n: 0, text: '0', word: 'following' });
    var counts = mk('div', 'ow-ph__counts');
    list.forEach(function (x) {
      var door = x.key === 'followers' || x.key === 'following';
      var n = mk(door ? 'button' : 'span', 'ow-ph__count', '<b>' + esc(x.key === 'events' && ev && ev.more ? ev.n + '+' : x.text) + '</b><span>' + esc(x.word) + '</span>');
      n.setAttribute('data-count', x.key);
      if (door) {
        n.type = 'button';
        n.addEventListener('click', function () {   /* the counts stay doors to their lists (founder/472) */
          if (center) { var h = n.closest('.ow-prof') && n.closest('.ow-prof').parentNode; if (h && h.__owShowTab) h.__owShowTab('people'); }
          else if (OW.project && OW.project.open && o.email) OW.project.open('people', x.key + ':' + o.email, n);
        });
      }
      counts.appendChild(n);
    });
    el.appendChild(counts);
    /* who: the name, the handle under it once, a Center's category */
    var id = mk('div', 'ow-ph__id');
    var name = String(c.title || ''), line = C.handleLine ? C.handleLine(c) : (c.handle || '');
    var bare = function (t) { return String(t || '').toLowerCase().replace(/^[@.$＠]+/, '').split(' · ')[0]; };
    id.appendChild(mk('h1', 'ow-ph__name', esc(name)));
    if (line && bare(line) !== bare(name)) id.appendChild(mk('div', 'ow-ph__handle', esc(line)));
    var cats = center ? ((c.categories && c.categories.length) ? c.categories : (c.category_label ? [c.category_label] : [])) : [];
    if (cats.length) id.appendChild(mk('div', 'ow-ph__cat', esc(cats.join(' · '))));
    el.appendChild(id);
    /* about: the bio at the left; THE INFORMATION AT THE RIGHT, ONE CLEAN LIST, as the card draws it
       (the founder, 2026-10-19: "i want the info to always be on right side weather its card or profile ... in that one clean
       list"): a Center's details line by line, "Label: value" with its role's icon (OW.cards.detailIcon, the card's own
       rule), and where it is, said the short way ("Location: Atlantic City, NJ"); a person's place the same way */
    var about = mk('div', 'ow-ph__about');
    var left = mk('div', 'ow-ph__left');
    var bio = center ? (c.blurb || '') : (c.line || '');
    if (bio) { var b = mk('p', 'ow-ph__bio', esc(bio)); b.setAttribute('dir', 'auto'); left.appendChild(b); }
    /* THE PLATFORMS, A ROW OF THEIR OWN (the founder, 2026-10-19: "Social icons should be more prominent and should not be
       trapped by the bio or information"): their own marks, larger, under the information, before the buttons */
    var links = C.linksInner ? C.linksInner(c, { centers: true }) : '';
    var lb = null;
    if (links) { lb = mk('div', 'ow-ph__links ow-linkbar', links.replace(/ow-ocard__link-text/g, 'ow-ph__linktext')); lb.setAttribute('role', 'list'); }
    var short = function (v) { return C.shortPlace ? C.shortPlace(v) : v; };
    var isPlace = function (l) { return /^(address|location|place)$/i.test(String(l || '')); };
    var rows = (c.details || []).filter(function (d) { return d && d.label && d.value; }).map(function (d) {
      return { label: d.label, value: isPlace(d.label) ? short(d.value) : d.value, place: isPlace(d.label) };
    });
    var place = short(center ? (c.line || '') : (c.place || ''));
    if (place && !rows.some(function (r) { return r.place; })) rows.push({ label: 'Location', value: place, place: true });
    rows.sort(function (x, y) { return (x.place ? 1 : 0) - (y.place ? 1 : 0); });   /* where it is, last */
    if (left.childNodes.length) about.appendChild(left);
    /* DIRECTIONS, FROM THE CARD (sys-assets' walk, 2026-10-21: the header's own row raced the card's and whichever came last
       won): the card read carries the Center's point, and the renderer's one rule says which map app opens it */
    var dir = center && C.directions ? C.directions(c) : null;
    if (rows.length || dir) {
      var info = mk('ul', 'ow-ph__info');
      rows.forEach(function (r) {
        var li = mk('li', 'ow-ph__row' + (r.place ? ' ow-ph__row--place' : ''),
          '<i class="ow-ph__ic">' + (C.detailIcon ? C.detailIcon(r.place ? 'place' : r.label) : '') + '</i><span><i>' + esc(r.label) + ':</i> <b dir="auto">' + esc(r.value) + '</b></span>');
        li.title = r.label + ': ' + r.value;
        info.appendChild(li);
      });
      if (dir) {
        var dli = mk('li', 'ow-ph__row ow-ph__row--dir', '<i class="ow-ph__ic">' + dir.mark + '</i><span><i>Directions:</i> <a dir="auto" href="' +
          esc(dir.href) + '" target="_blank" rel="noopener noreferrer">' + esc(dir.app) + '</a></span>');
        dli.title = 'Directions in ' + dir.app;
        info.appendChild(dli);
      }
      about.appendChild(info);
    }
    about.setAttribute('data-cols', left.childNodes.length && (rows.length || dir) ? '2' : '1');
    el.appendChild(about);
    if (lb) el.appendChild(C.lineMarks ? C.lineMarks(lb) : lb);   /* one straight line, never a second row (the founder, 2026-10-19) */
    el.appendChild(mk('div', 'ow-ph__acts'));
    return el;
  }
  var HEADER_EVENTS_READ = 30;                              /* a Center's upcoming events counted; past it, "30+" */
  function profileShellCard(host, o) {
    profileShell(host, o);
    o = o || {};
    var root = host.querySelector('.ow-prof');
    var ref = o.cardRef ? (o.kind === 'center' ? 'center:' + o.cardRef : 'person:@' + String(o.cardRef).replace(/^@/, '')) : '';
    if (!root || !OW.cards) return;
    /* ONE PROFILE LAYOUT, FROM THE FIRST FRAME (founder/878, 2026-10-21: "the old profile view with the name over banner
       breifly popped up over it. both must be merged into ONE dominant profile layout. i like the new cards"). The shell's
       own header is only the carrier of the acts and the note this header takes in, and is never painted: until the header
       lands, its place is held at its height (profile-header.css, data-header="pending"), and where the card cannot be read
       the header is drawn from what the shell was told. */
    root.setAttribute('data-header', 'pending');
    var hero0 = root.querySelector('.ow-prof__hero');
    if (hero0 && !root.querySelector('.ow-ph')) hero0.parentNode.insertBefore(mk('div', 'ow-ph ow-ph--wait'), hero0.nextSibling);
    var events = o.kind === 'center' && o.cardRef
      ? data.get('/api/oneway/places/' + encodeURIComponent(o.cardRef) + '/events?limit=' + HEADER_EVENTS_READ).then(function (r) {
          var list = ((r && r.ok && r.data && r.data.events) || []).filter(function (e) {
            return e && ['draft', 'cancelled', 'ended'].indexOf(String(e.state || '').toLowerCase()) < 0; });
          return { n: list.length, more: !!(r && r.data && r.data.next_after) };
        }, function () { return null; })
      : Promise.resolve(null);
    var told = function () {
      var im = root.querySelector('.ow-prof__id img, .ow-prof__face img, .ow-prof__avatar img');
      return { kind: o.kind === 'center' ? 'center' : 'person', title: o.name || '', handle: o.sub || '', counts: {}, details: [],
               picture: { url: im ? (im.getAttribute('src') || '') : '' }, line: o.kind === 'center' ? '' : (o.bio || ''),
               blurb: o.kind === 'center' ? (o.bio || '') : '' };
    };
    var read = ref && OW.cards.read ? Promise.all([OW.cards.read([ref]), events]) : Promise.resolve([{}, null]);
    read.then(function (res) { land((res[0] || {})[ref] || told(), res[1]); }, function () { land(told(), null); });
    function land(card, ev) {
      if (!card || host.querySelector('.ow-prof') !== root) return;
      var c = JSON.parse(JSON.stringify(card));
      c.layout = root.getAttribute('data-layout') === 'above' ? 'above' : 'beside';
      c.counts = c.counts || {};
      if (o.kind === 'center' && ev) c.counts.events = ev.n;
      /* THE ACCOUNT'S OWN COLOUR. The card is drawn on a hue angle (--h); the App paints a page in the account's colour as a
         red, green and blue triple, and an account that never chose one has no angle on its card read. The card takes the
         angle of the colour the page already wears, so the header is the account's colour exactly. */
      if (typeof c.hue !== 'number') c.hue = angleOf(global.getComputedStyle(root).getPropertyValue('--h'));
      root.style.setProperty('--hdr-h', String(c.hue));     /* the banner, when it has no picture, wears the same colour */
      /* EACH THING ONCE: a detail named twice (two runs of hours) is one detail, its values one under the other; a place
         the details already give as an address is not said again under the bio */
      if (Array.isArray(c.details)) {
        var merged = [];
        c.details.forEach(function (d) {
          var same = merged.filter(function (m) { return m.label === d.label; })[0];
          if (same) same.value += '\n' + d.value; else merged.push({ label: d.label, value: d.value, href: d.href });
        });
        c.details = merged;
        if (merged.some(function (d) { return /^address$/i.test(d.label || ''); })) c.line = '';
      }
      var el = profileHeader(c, o, ev);
      /* every act the shell's header offered, in its order */
      var acts = el.querySelector('.ow-ph__acts');
      var mine = [].slice.call(root.querySelectorAll('.ow-prof__id .po-act, .ow-prof__id .ow-prof__acts > *')).filter(function (b, i, all) {
        return all.indexOf(b) === i && !all.some(function (x) { return x !== b && x.contains(b); });
      });
      /* ON ONE'S OWN PROFILE, Edit profile and Share profile lead, as on every platform */
      if (typeof o.onBannerChange === 'function') {
        var edit = mk('button', 'po-act', 'Edit profile'); edit.type = 'button';
        edit.addEventListener('click', function () { global.location.hash = '#settings/profile'; });
        var share = mk('button', 'po-act', 'Share profile'); share.type = 'button';
        share.addEventListener('click', function () {
          var at = global.location.origin + '/oneway-app.html' + (o.cardRef ? '#center/@' + encodeURIComponent(String(o.cardRef).replace(/^@/, '')) : '');
          if (global.navigator.share) global.navigator.share({ title: o.name || '', url: at }).catch(function () {});
          else if (global.navigator.clipboard) global.navigator.clipboard.writeText(at).then(function () { if (OW.toast) OW.toast('Your profile’s link is copied.', { tone: 'ok' }); });
        });
        mine.unshift(edit, share);
      }
      /* A CENTER HAS ITS "…" TOO (a cold judge: a person's header had one and a Center's did not), holding the acts that apply
         to a place: share it and copy its link. Block and Mute are a person's (a block needs two people; a mute hides a
         person's posts by their author), so a Center's menu does not offer them. */
      if (o.kind === 'center' && typeof o.onBannerChange !== 'function' && !mine.some(function (b) { return /^more$/i.test((b.textContent || '').trim()); })) {
        var cmore = mk('button', 'po-act', 'More'); cmore.type = 'button'; cmore.setAttribute('aria-expanded', 'false');
        var at0 = global.location.origin + '/c/' + encodeURIComponent(o.cardRef || '');   /* its public page: opens for anyone, signed in or not */
        cmore.addEventListener('click', function () {
          var open = acts.querySelector('.po-acts__more');
          if (open) { open.remove(); cmore.setAttribute('aria-expanded', 'false'); return; }
          var row = mk('div', 'po-acts__more');
          var sh = mk('button', 'po-act', 'Share'); sh.type = 'button';
          sh.addEventListener('click', function () {
            if (global.navigator.share) global.navigator.share({ title: c.title || '', url: at0 }).catch(function () {});
            else cp.click();
          });
          var cp = mk('button', 'po-act', 'Copy link'); cp.type = 'button';
          cp.addEventListener('click', function () {
            if (global.navigator.clipboard) global.navigator.clipboard.writeText(at0).then(function () { if (OW.toast) OW.toast('Its link is copied.', { tone: 'ok' }); },
              function () { if (OW.toast) OW.toast('The link could not be copied here.'); });
          });
          row.appendChild(sh); row.appendChild(cp);
          /* MUTE A PLACE (web 18:16Z; Instagram's parity): its posts stop reaching this person's Home and feeds, its own page
             still shows them; the state read from `between`, never assumed; signed-in visitors only */
          if (o.cardRef && data.me && data.me()) {
            var mu = mk('button', 'po-act', 'Mute'); mu.type = 'button'; mu.disabled = true;
            var mpath = '/api/oneway/graph/mute/' + encodeURIComponent(o.cardRef), muted = false;
            var said = function () { mu.textContent = muted ? 'Unmute' : 'Mute'; mu.setAttribute('aria-pressed', String(muted)); };
            data.get('/api/oneway/graph/between/' + encodeURIComponent(o.cardRef)).then(function (r) {
              muted = !!(r && r.ok && r.data && r.data.muted); said(); mu.disabled = false;
            }, function () { mu.disabled = false; said(); });
            mu.addEventListener('click', function () {
              var next = !muted; mu.disabled = true;
              (next ? data.post(mpath, {}) : data.del(mpath)).then(function (r) {
                mu.disabled = false;
                if (r && r.ok) { muted = next; said(); if (OW.toast) OW.toast(next ? 'Muted. Its posts stay off your feeds; its page still shows them.' : 'Unmuted.', { tone: 'ok' }); }
                else if (OW.toast) OW.toast('That did not change. ' + ((r && r.error) || ''));
              });
            });
            row.appendChild(mu);
          }
          acts.appendChild(row); cmore.setAttribute('aria-expanded', 'true');
        });
        mine.push(cmore);
      }
      mine.forEach(function (b) {
        acts.appendChild(b);
        if (/^more$/i.test((b.textContent || '').trim())) { b.classList.add('ow-ph__more'); b.setAttribute('aria-label', 'More'); }
        /* a third way onward on one's own profile (Create your Center) is a compact control beside the two, as Instagram's own
           header has one; its words are its label and its tip */
        else if (acts.children.length === 3) { var w3 = (b.textContent || '').trim(); b.classList.add('ow-ph__more', 'ow-ph__plus'); b.setAttribute('aria-label', w3); b.title = w3; acts.setAttribute('data-plus', '1'); }
      });
      if (acts.children.length) {
        acts.setAttribute('data-n', String(acts.children.length));
        if (acts.querySelector('.ow-ph__more')) acts.setAttribute('data-more', '1');
        acts.firstChild.classList.add('ow-ph__lead');       /* Follow, or Edit profile: the one filled button */
      } else acts.remove();
      if (o.live) el.querySelector('.ow-ph__about').appendChild(o.live);
      /* A MENU OPENED BY A MOVED BUTTON OPENS HERE. A person's More (me.js) opens its row in the shell's header, where its
         button used to stand and which is hidden now: the row is brought under the buttons it belongs to, and a second press
         closes it here rather than opening another there. */
      [].forEach.call(acts.querySelectorAll('.ow-ph__more'), function (b) {
        b.addEventListener('click', function (e) {
          var here = acts.querySelector(':scope > .po-acts__more');
          if (here && !here.__owOwn) { here.remove(); b.setAttribute('aria-expanded', 'false'); e.stopImmediatePropagation(); }
        }, true);
      });
      /* A PERSON'S NOTE, ABOVE THEIR NAME (founder/878, 2026-10-21: "notes are still not appearing above the name closley and
         cleanly"; it rode the face for 863 and stood after the name for 832). The note, its "Add a note" and its editor are
         written into the shell's header (OW.noteOn, noteComposer), which is never painted: each is brought into this
         header's identity, the bubble and "Add a note" directly above the name, the editor under it, now and whenever the
         composer writes it again. In the flow, so it covers no face and no banner and the header makes its own room. */
      var idBox = el.querySelector('.ow-ph__id');
      var noteNode = function (n) { return n.nodeType === 1 && (n.classList.contains('po-note') || n.classList.contains('ow-note-set') || n.classList.contains('ow-note-edit')); };
      var homeOf = function (n) {
        if (n.classList.contains('ow-note-edit')) { idBox.appendChild(n); return; }
        idBox.insertBefore(n, idBox.querySelector(':scope > .ow-ph__name'));
      };
      var placeNotes = function () {};
      var shell = root.querySelector('.ow-prof__id');
      if (shell && idBox) [].forEach.call(shell.querySelectorAll('.po-note, .ow-note-set, .ow-note-edit'), function (n) { homeOf(n); });
      if (shell && global.MutationObserver) new global.MutationObserver(function (list) {
        list.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList.contains('po-acts__more') && acts.isConnected) acts.appendChild(n);
          else if (idBox && noteNode(n)) { var old = idBox.querySelector(':scope > .' + n.classList[0]); if (old && old !== n) old.remove(); homeOf(n); }
        }); });
      }).observe(shell, { childList: true, subtree: true });
      /* your own note is still the press that changes it */
      el.addEventListener('click', function (e) {
        var hit = e.target.closest && e.target.closest('.ow-ph__id > .po-note'), set = idBox && idBox.querySelector(':scope > .ow-note-set');
        if (hit && set) set.click();
      });
      var hero = root.querySelector('.ow-prof__hero');
      var old = root.querySelector('.ow-ph'); if (old) old.remove();
      hero.parentNode.insertBefore(el, hero.nextSibling);
      root.setAttribute('data-header', 'profile');
      /* the filled button's words are the one primary's (--ow-on-h1, profile-header.css; founder/890): nothing measured here */
      /* what the header says, so the page under it says it once (center.js drawVisit): its details by their labels */
      root.setAttribute('data-card-says', (c.details || []).map(function (d) { return String(d.label || '').toLowerCase().replace(/\s+/g, '-'); }).join(' '));
      try { root.dispatchEvent(new global.CustomEvent('ow:header-card')); } catch (e) {}
      if (hero.getAttribute('data-picture')) { root.setAttribute('data-has-banner', '1'); bleedBanner(root); }
    }
  }

  _u.failSaid = failSaid;
  _u.failWords = failWords;
  _u.openEventScreen = openEventScreen;
  _u.profileShell = profileShellCard;           /* the shell, then its header as the landing's card (founder/816) */
  _u.refusalWords = refusalWords;
  _u.sentence = sentence;
  _u.wearWordmark = wearWordmark;
})(window);
