/* oneway-cards.js — THE ONE RENDERER OF A CENTER AND OF A PERSON (S21).
 *
 * ★ FOUNDER, 2026-10-10: "infomration needs to be able to be projected and displayed anywhere as insentenous as
 *   psosible, espcially on the oneway platform itself ... please see what i am trying to diagonse it and make sure we
 *   get out of it".
 * ★ FOUNDER/790, 2026-10-16: "the profile and center cards geometrically have to BE THE SAME!!! and the size needs to
 *   close based of how much info they have ... i dont want any buttons that are just loose text use the canonical
 *   button surfaces".
 * ★ FOUNDER/801, 2026-10-17: "the cards need to have the exact header layouts with the info condesne to the right, bio
 *   in line to the left, and social icons below. the cards need to match the exact design of them and be perfect ...
 *   also make sure we still are supporting the top profile over the name tiktok layout for cards and profiles still".
 *
 * WHAT THIS IS. A card is read ONCE, from api/oneway/cards (every display field made at the source), and drawn HERE
 * and nowhere else:
 *
 *     OW.cards.read(['center:<id>', 'person:@handle'])  -> Promise<{ 'center:<id>': card, ... }>   one batched read
 *     OW.cards.deck('person', 4)                        -> Promise<[card]>                         the ecosystem's own
 *     OW.cards.html(card, { as: 'chip' | 'row' | 'tile' | 'flag' | 'simple' })                     a string
 *     OW.cards.node(card, { as, mode, actions, events, onOpen })                                    an element
 *     OW.cards.mount(host, 'person', '@handle', { as })                                             reads, draws, and
 *                                                                                                  draws again when
 *                                                                                                  the platform says
 *                                                                                                  it changed (S22)
 *
 * A CARD IS THE PROFILE HEADER, CONDENSED (founder/801; context/audits/cards-2026-10-17/spec.json, K1-K18). The App's
 * profile and Center page header (frontend/app/pages/pages.js profileShell) and a tile, a flag, an expanded or a full
 * card are ONE anatomy, laid out by ONE block of rules in oneway-popit.css ("THE HEADER AND ITS CARD"), and their
 * words come from the parts below, which the header calls too (identityHTML, countsHTML / counts, informationHTML,
 * linksHTML). In this order: the banner; the face over its foot; beside it (or under it, in the picture-above
 * layout TikTok uses) the name on one line, the handle line and the counts; the actions a surface authorised; then
 * the about row: the bio on the left, the information on the right (Location, Directions, Category in two straight
 * columns) with the social icons under it. A card differs from the header only in its box (the Popit material, 16px
 * of padding, a 24px corner), in its banner's inset and foot (26% of its own width instead of the screen's), and in
 * what it leaves out (tabs, the note, Edit cover, the Events tab icon).
 *   · Counts: followers first and always, then posts, then (a person) following. NEVER a members count (the founder,
 *     2026-10-16 15:16Z: "WHY ARE MEMBERS BACK DUDE LMAO. NO BANDAID FIXES."). A count that could not be read is not
 *     drawn.
 *   · The information list: Location (the place said once, the short way), Directions (the map app's mark and name,
 *     only when the place resolved to a point), Category; a person has none, only their icons. Every other stored fact
 *     lives on the Center's page, and the Brain answers for it (ASKS row 16: "Let the brain fill in the rest").
 *   · Buttons wear the ONE BUTTON LANGUAGE (S20): Primary (`ow-btn`) or Outlined (`ow-btn ow-btn--outline`), never
 *     words on nothing. The renderer draws the actions the surface authorised and decides nobody's rights; a surface
 *     that gives none gets a card that is itself the press.
 *
 * A SURFACE NEVER COMPOSES A CARD'S FIELDS and never builds its markup. If a card is wrong, the fix is in
 * api/oneway/cards (its data) or here (its look), and is on every surface the next time it draws.
 *
 * THE RULES KEPT HERE, ONCE: nothing glows; every face is a circle (S14: "why are they not circle"); a face with no
 * picture is a person's outline or a Center's monogram in its own hue (OW.faceMark); a face that fails to load
 * becomes that (OW.faceFail); the picture sits beside the name or above it, the account's own choice (`card.layout`).
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var OW = global.OW = global.OW || {};
  // Use the map's own category artwork in search rows and blank Information Centers.
  OW.placeFace = function (kind, needsInformation) {
    var el=doc.createElement('span');el.className='ow-place-face';el.setAttribute('aria-hidden','true');
    el.setAttribute('data-place-category',kind||'place');
    el.style.cssText='position:relative;display:inline-flex;flex:none;width:48px;height:48px;align-items:center;justify-content:center;box-sizing:border-box;line-height:0';
    if(OW.placeRow && OW.placeRow.mark)el.innerHTML=OW.placeRow.mark(kind,needsInformation?'missing':true);
    return el;
  };

  function informationFace(box, card) {
    if (!box || !card.information_center) return false;
    box.style.position = 'relative'; box.style.overflow = 'visible';
    if(OW.placeRow && OW.placeRow.paint){var look=OW.placeRow.paint(card.category);box.style.setProperty('--place-color',look.color);box.style.background='transparent';box.style.boxShadow='none';box.style.border='0';}
    var pic = card.picture || {};
    box.innerHTML = pic.url ? inside({picture:pic.url}, {img:' loading="lazy" decoding="async"'}) : '';
    var image = box.querySelector('img'); if (image) image.style.borderRadius = 'inherit';
    var mark = OW.placeFace(card.category || 'place',card.needs_information);
    if (pic.url) { mark.style.position='absolute'; mark.style.right='0'; mark.style.bottom='0'; mark.style.width='46%'; mark.style.height='46%'; }
    else { mark.style.width='100%'; mark.style.height='100%'; }
    box.appendChild(mark); return true;
  }

  if (OW.cards) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function url(v) { return OW.imageUrl ? OW.imageUrl(v) : String(v || ''); }
  function initials(n, center) {   /* OW.initials (oneway-popit.js) is the rule; where it is not loaded, the same rule: letters, never a sigil */
    /* a Center's letters as the OS menu draws them ('The Ocean Pier Hotel' OP, not T and its last word: one Center, one monogram, 11-04) */
    if (OW.face) return OW.face.inner({ name: n, kind: center ? 'center' : '' });     /* the one face's letters */
    /* the first word's letter and the last word's, as OW.initials says it (it said only the first: "Ana Face" was "A" on
       every page without oneway-popit.js, the bar's face on the landing among them, founder/883) */
    var p = String(n || '').trim().split(/\s+/).map(function (w) { var m = w.match(/[\p{L}\p{N}]/u); return m ? m[0] : ''; }).filter(Boolean);
    return p.length ? (p[0] + (p.length > 1 ? p[p.length - 1] : '')).toUpperCase() : '';
  }
  function huePair(h) {
    if(h && typeof h==='object' && h.h1)return h;
    if (typeof h !== 'number' || !OW.hue || !OW.hue.fromAngle) return null;
    var p = OW.hue.fromAngle(h);
    return p ? { h1: p[0], h2: p[1] || p[0] } : null;
  }
  function paint(node, h) {
    var p = huePair(h);
    if (p) { node.style.setProperty('--h', p.h1); node.style.setProperty('--h2', p.h2); }
  }
  function kindOf(card) { return card && card.kind === 'person' ? 'person' : 'center'; }
  var SAFE_HREF = /^(https?:\/\/|tel:|mailto:)/i;

  /* ── THE READ: one request for everything asked in the same beat, a card kept until the platform says it changed ── */
  var KEPT = {}, ASKED = {}, WAIT = null, QUEUE = [];
  var BATCH = 40;                       /* api/oneway/cards CARDS_PER_READ */
  var SHOW_BATCH = 6;                   /* api/oneway/cards/showcase.py SHOWCASE_PER_READ_MAX */

  /* A CARD READ GOES OUT AS THE PERSON (A-a9dffbd, founder/917): through OW.data, which sends a token session's header, so a native shell or a page with a BASE is not read as a
     stranger (no self, a stranger's note audience and presence). This module keeps its own copies, so it asks fresh. A page with no OW.data is read as before. Never throws. */
  function asked_(u, none) {
    if (OW.data && OW.data.get) return OW.data.get(u, { fresh: true }).then(function (v) { return v && v.ok && v.data ? v.data : none; });
    return fetch((OW.assetBase || '') + u, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : none; })
      .catch(function () { return none; });
  }
  function flush() {
    var refs = QUEUE.splice(0, QUEUE.length), jobs = [];
    WAIT = null;
    /* a read that asks for the smart part carries it for SHOW_BATCH cards (api/oneway/cards/showcase.py SHOWCASE_PER_READ_MAX): those go in
       reads of that many, so every card on a screen has it and each read stays as cheap as the server bounds it (founder/1087) */
    var plain = refs.filter(function (g) { return !g.include; }), asked = refs.filter(function (g) { return g.include; });
    for (var i = 0; i < plain.length; i += BATCH) jobs.push(plain.slice(i, i + BATCH));
    for (var k = 0; k < asked.length; k += SHOW_BATCH) jobs.push(asked.slice(k, k + SHOW_BATCH));
    jobs.forEach(function (group) {
      var want = group.map(function (g) { return g.ref; });
      var u = '/api/oneway/cards?refs=' + encodeURIComponent(want.join(','));
      /* include: true asks for events, people and the showcase (the one card a surface leads with); 'showcase' asks for that alone (THE card, founder/1087) */
      if (group.some(function (g) { return g.include === true; })) u += '&include=events,people,showcase';
      else if (group.some(function (g) { return g.include; })) u += '&include=showcase';
      asked_(u, { cards: {} })
        .then(function (j) {
          var got = (j && j.cards) || {};
          group.forEach(function (g) {
            var c = got[g.ref] || null;
            if (c) KEPT[g.ref + incKey(g.include)] = c;
            g.done(c);
          });
        });
    });
  }

  function incKey(include) { return include === true ? '+' : include ? '+' + include : ''; }
  function readOne(ref, include) {
    var k = ref + incKey(include);
    if (KEPT[k]) return Promise.resolve(KEPT[k]);
    /* A CARD ON ITS WAY IS ASKED FOR ONCE (2026-10-24): a read started early (Me's header card, at the dock's press) and the
       header that asks for the same card when it is drawn share one request, as do two asks in one beat */
    if (ASKED[k]) return ASKED[k];
    var p = new Promise(function (resolve) {
      QUEUE.push({ ref: ref, include: include === true ? true : (include || false), done: resolve });
      if (!WAIT) WAIT = setTimeout(flush, 12);
    });
    ASKED[k] = p;
    p.then(function () { if (ASKED[k] === p) delete ASKED[k]; });
    return p;
  }

  function forget() { KEPT = {}; ASKED = {}; }
  /* a write anywhere is news to a card: it is asked again the next time it is drawn (and mounted ones redraw below) */
  doc.addEventListener('ow:changed', forget);

  /* COUNTS STAY TRUE WHILE THEY ARE DRAWN (founder/960, 2026-10-24: "following and follower counts also have issues staying consistently
     updated throughout the platform"). A header or a card marks whose counts it shows (data-ow-card, "center:<id>" / "person:@handle"); when
     anything was written, here or on the person's other device (ow:changed), when the page comes back to the front, and once a minute while
     one is on screen (the follows and joins of OTHER people have no announcement to wait for), the cards ON SCREEN are asked again (and only
     those: the page's other kept cards are left alone) and the numbers are set to the server's. One read for every marked box in view or a
     screen from it, the same read the card itself uses (RW14, RW15). The follow press itself is still
     answered at once from the graph's own reply (oneway-data.js syncFollowCounts). */
  var COUNT_REFRESH_MS = 120000, COUNT_ONSCREEN_MAX = BATCH, countTimer = 0;
  function setCount(box, key, n) {
    if (typeof n !== 'number' || !isFinite(n)) return;
    [].forEach.call(box.querySelectorAll('[data-count="' + key + '"]'), function (el) {
      var b = el.querySelector('b'); if (!b) return;
      var said = number(n), word0 = COUNT_WORDS[key] ? COUNT_WORDS[key][n === 1 ? 0 : 1] : '';
      var sp0 = el.querySelector('span'), had = sp0 ? sp0.textContent : (b.nextSibling && b.nextSibling.nodeType === 3 ? b.nextSibling.textContent.trim() : word0);
      var M = OW.motion, same = M && M.countOf ? M.countOf(b) === n : b.textContent === said;      /* the number it is going to, if it is still counting */
      if (same && had === word0) return;     /* an unchanged number is not rewritten: a live region says only what changed */
      if (M && M.count) M.count(b, n, number); else b.textContent = said;
      var word = COUNT_WORDS[key] ? COUNT_WORDS[key][n === 1 ? 0 : 1] : '', sp = el.querySelector('span');
      if (sp) sp.textContent = word; else if (b.nextSibling && b.nextSibling.nodeType === 3) b.nextSibling.textContent = ' ' + word;
    });
  }
  /* in view or within a screen of it: a list of fifty is kept true where it is read, and the rest as it is scrolled to (the scroll
     draws nothing new: a box that was not asked now is asked at the next beat, the next notice, focus or tick) */
  function nearView(b) {
    if (!b.getBoundingClientRect) return true;
    var r = b.getBoundingClientRect(), vh = global.innerHeight || (doc.documentElement && doc.documentElement.clientHeight) || 0;
    return !vh || (r.bottom >= -vh && r.top <= 2 * vh);
  }
  /* only the cards being asked again are dropped from what was kept: a count refresh never empties the page's other cards */
  function forgetRefs(refs) {
    refs.forEach(function (r) { delete KEPT[r]; delete KEPT[r + '+']; delete ASKED[r]; delete ASKED[r + '+']; });
  }
  function refreshCounts(fresh) {
    var boxes = [].slice.call(doc.querySelectorAll('[data-ow-card]')).filter(nearView), refs = [];
    if (!boxes.length) return;
    boxes.forEach(function (b) { var r = b.getAttribute('data-ow-card'); if (r && refs.indexOf(r) < 0 && refs.length < COUNT_ONSCREEN_MAX) refs.push(r); });
    tuneSoon();
    if (fresh) forgetRefs(refs);
    read(refs).then(function (got) {
      boxes.forEach(function (b) {
        var card = got[b.getAttribute('data-ow-card')];
        if (!card || (card.unreadable || []).indexOf('counts') >= 0 || !b.isConnected) return;
        ['followers', 'following', 'posts'].forEach(function (k) { setCount(b, k, (card.counts || {})[k]); });
      });
    });
  }
  var countWait = 0, later = global.setTimeout ? global.setTimeout.bind(global) : null;
  function countsSoon(fresh) { if (!later) return; global.clearTimeout(countWait); countWait = later(function () { refreshCounts(fresh); }, 400); }
  /* THE NUMBERS REACH AN OPEN CARD BY THEMSELVES (the founder, 2026-10-30): the cards near the screen are watched on the stream they already share,
     `public-center:<id>` and `public-person:@handle`, and a follow anywhere arrives carrying the new numbers (realtime/counts.py), so one press on a
     popular account is one frame to each watcher, never one read each. A card watched stays watched while it is on the page; past CARD_TOPICS_MAX the
     oldest go, and the stream is reopened at most once every CARD_TUNE_GAP_MS as a list is scrolled. Signed out there is no stream: a card then keeps
     its numbers by the read below (focus, the minute tick). */
  var CARD_TOPICS_MAX = 16, CARD_TUNE_GAP_MS = 4000;     /* 16 beside WATCH_POSTS_MAX 100 and a person's own topics stays under the server's 120 */
  var cardsWatched = [], tuneWait = 0, tunedAt = 0;
  function cardTopic(ref) {
    if (ref.indexOf('center:') === 0) return 'public-center:' + ref.slice(7);
    if (ref.indexOf('person:@') === 0) return 'public-person:' + ref.slice(7);
    return '';
  }
  function tuneCards() {
    tuneWait = 0;
    if (!OW.realtime || !OW.realtime.watchTopics || !doc.querySelectorAll) return;
    var onPage = {}, near = [];
    [].forEach.call(doc.querySelectorAll('[data-ow-card]'), function (b) {
      var r = b.getAttribute('data-ow-card');
      if (!r || !cardTopic(r)) return;
      onPage[r] = 1;
      if (near.indexOf(r) < 0 && nearView(b)) near.push(r);
    });
    var next = near.slice();
    cardsWatched.forEach(function (r) { if (onPage[r] && next.indexOf(r) < 0) next.push(r); });
    next = next.slice(0, CARD_TOPICS_MAX);
    if (next.slice().sort().join() === cardsWatched.slice().sort().join()) return;
    cardsWatched = next;
    tunedAt = Date.now();
    OW.realtime.watchTopics('public-card-surfaces', next.map(cardTopic));
  }
  function tuneSoon() {
    if (tuneWait || !later) return;
    tuneWait = later(tuneCards, Math.max(300, CARD_TUNE_GAP_MS - (Date.now() - tunedAt)));
  }
  doc.addEventListener('ow:counts', function (e) {
    var d = (e && e.detail) || {}, ref = d.ref, c = d.counts;
    if (!ref || !c) return;
    forgetRefs([ref]);                 /* no kept card outlives the change (S22) */
    [].forEach.call(doc.querySelectorAll('[data-ow-card]'), function (b) {
      if (b.getAttribute('data-ow-card') !== ref) return;
      ['followers', 'following', 'posts'].forEach(function (k) { setCount(b, k, c[k]); });
    });
  });
  /* a dropped stream told nothing of what passed while it was down (a number is not replayed): the cards on screen ask once when it is back */
  var streamWasDown = false;
  doc.addEventListener('ow:realtime-down', function () { streamWasDown = true; });
  doc.addEventListener('ow:realtime-live', function () { if (streamWasDown) { streamWasDown = false; countsSoon(true); } });
  if (global.MutationObserver) {
    var watchDrawn = function () {
      new global.MutationObserver(function (list) {
        if (tuneWait) return;
        for (var i = 0; i < list.length; i++) {
          var added = list[i].addedNodes;
          for (var k = 0; k < added.length; k++) {
            var n = added[k];
            if (n.nodeType === 1 && (n.hasAttribute('data-ow-card') || n.querySelector('[data-ow-card]'))) { tuneSoon(); return; }
          }
        }
      }).observe(doc.body, { childList: true, subtree: true });
      if (doc.querySelector('[data-ow-card]')) tuneSoon();
    };
    if (doc.body) watchDrawn(); else doc.addEventListener('DOMContentLoaded', watchDrawn);
    global.addEventListener('scroll', function () { if (!tuneWait && doc.querySelector('[data-ow-card]')) tuneSoon(); }, { capture: true, passive: true });
  }
  doc.addEventListener('ow:changed', function () { countsSoon(false); });
  /* someone followed this person or their Center, or joined it (an operator is told of each follow of the Center, the person of each follow
     of them): that notification is the announcement the follow of ANOTHER person never had. No other notice (a comment, a message) moves a count */
  doc.addEventListener('ow:notification', function (e) {
    var k = e && e.detail && e.detail.kind;
    if (k === 'followed' || k === 'joined') countsSoon(true);
  });
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) countsSoon(true); });
  /* a renderer run with no window (a node sandbox that only draws) has no focus and no timer: it draws, it does not keep counts */
  if (global.addEventListener) global.addEventListener('focus', function () { countsSoon(true); });
  if (global.setInterval) countTimer = global.setInterval(function () { if (!doc.hidden) refreshCounts(true); }, COUNT_REFRESH_MS);

  function read(refs, opts) {
    var inc = opts && opts.include ? (opts.include === 'showcase' ? 'showcase' : true) : false;
    var list = (refs || []).filter(Boolean);
    var asked = Promise.all(list.map(function (r) { return readOne(r, inc); }));
    /* opts.now: sent at once, not on the beat (a dock's press, where the page's own work would hold the beat's timer back) */
    if (opts && opts.now && QUEUE.length) { if (WAIT) clearTimeout(WAIT); flush(); }
    return asked.then(function (all) {
      var out = {};
      list.forEach(function (r, i) { if (all[i]) out[r] = all[i]; });
      return out;
    });
  }

  function deck(kind, n) {
    var u = '/api/oneway/cards/deck?kind=' + encodeURIComponent(kind || 'person') + '&n=' + (n || 4);
    return asked_(u, { cards: [] }).then(function (j) { return (j && j.cards) || []; });
  }

  /* ── WHAT A FACE HOLDS, DECIDED ONCE (S21) ──────────────────────────────────────────────────────────────────────
     The picture when there is one; with none, a person is their outline (OW.faceMark, founder/495) and anything else
     its letters. Every face on the platform asks this, through face() (a card's whole face) or fill() (a surface's
     own holder, which keeps its class, its size and its place: the profile header's .ow-avatar is one), so the rule is
     kept in one place. `who`: {kind, name, picture}; `opts.letters`: 'i' to set the letters in an <i>, as a card's
     face and some holders do; `opts.img`: the picture's further attributes, as written. */
  /* THE ONE FACE (founder/1221, 2026-11-03: "i want one pfp everywhere"): what a holder holds is OW.face's answer
     (oneway-popit.js), the one module every surface asks: the picture whole, else the initials on its own colour (founder/816);
     a surface whose letters are not a name's initials (a destination's first letters) names them in `who.letters`. */
  function inside(who, opts) {
    if (OW.face) return OW.face.inner(who, opts);
    /* a page without oneway-popit.js (404, the landing: the bar loads this file alone, for its sign-in face) has no OW.face:
       the same answer by the same rule, the picture whole, else the letters, so a signed-in face never throws there */
    who = who || {}; opts = opts || {};
    var src = who.picture ? url(typeof who.picture === 'object' ? who.picture.url : who.picture) : '';
    if (src) return '<img class="ow-face__img" src="' + esc(src) + '" alt=""' + (opts.img || '') + '>';
    var ini = esc(who.letters != null ? who.letters : initials(who.name, who.kind === 'center'));
    return opts.letters === 'i' ? '<i>' + ini + '</i>' : ini;
  }
  /* a surface's own holder, filled by the rule: nothing on the holder itself is touched */
  function fill(box, who, opts) {
    if (box && who && who.information_center) { informationFace(box, Object.assign({},who,{picture:typeof who.picture==='string'?{url:who.picture}:who.picture})); return box; }
    if (box) {
      if (OW.face) OW.face.fill(box, who, opts);
      else { box.setAttribute('data-ini', initials(who && who.name, !!who && who.kind === 'center')); box.innerHTML = inside(who, opts); }
      box.setAttribute('data-kind',who && who.kind || 'person');
      var image=box.querySelector('img');
      if(image)image.addEventListener('error',function(){if(OW.faceFail)OW.faceFail(image);});
    }
    return box;
  }

  // Identity appears as a pair: reserve its room until the face is decoded or its fallback is ready.
  function identityReady(host, selector) {
    if (!host) return;
    var images=Array.prototype.slice.call(host.querySelectorAll(selector || 'img'));
    if (!images.length) return;
    var ticket={};host.__owIdentity=ticket;host.setAttribute('aria-busy','true');
    var before=host.style.visibility;host.style.visibility='hidden';
    Promise.all(images.map(function(img){
      img.loading='eager';img.decoding='async';
      return new Promise(function(resolve){
        var done=false;
        function finish(){if(done)return;done=true;img.removeEventListener('load',finish);img.removeEventListener('error',finish);
          if(!img.naturalWidth && img.parentNode && OW.faceFail)OW.faceFail(img);
          if(img.naturalWidth && img.decode)img.decode().catch(function(){}).then(resolve);else resolve();}
        img.addEventListener('load',finish);img.addEventListener('error',finish);
        if(img.complete)finish();
      });
    })).then(function(){if(host.__owIdentity!==ticket)return;host.style.visibility=before;host.removeAttribute('aria-busy');});
  }

  /* ── THE PARTS ────────────────────────────────────────────────────────────────────────────────────────────── */
  /* THE FACE. Always a circle (S14), whatever shape the read reports: the profile header draws every face round
     (pages.js), and a card is that header (spec K3, M12). `data-shape` still says what the account chose. */
  function face(card, cls) {
    var pic = card.picture || {};
    var kind = kindOf(card);
    var shape = /^(round|rounded|square)$/.test(pic.shape || '') ? pic.shape : 'round';
    var ini = initials(card.title, kind === 'center');
    var inner = inside({ kind: kind, name: card.title, picture: pic.url },
                       { letters: 'i', img: ' loading="lazy" decoding="async" onerror="OW.faceFail&&OW.faceFail(this)"' });
    return '<span class="ow-ocard__face ' + (cls || '') + '" data-shape="' + esc(shape) + '" data-kind="' + kind + '" data-ini="' + esc(ini) + '">' + inner + '</span>';
  }

  /* HERE NOW, ON A SLIM CARD (founder/863: "show users online status in messaging and cards slim ones"): the green dot
     Messages draws, bottom-right of the face, when the read says this person is online (cards/service._here_now: only to
     someone they let see it). The face clips what it holds, so the dot sits beside it in a holder of the face's size. */
  function slimFace(card) {
    if (!card || kindOf(card) !== 'person') return face(card);
    /* THE ONE DOT (founder/954): the read's answer is drawn at once, and the face is marked for frontend/shared/presence.js, the one
       reader and writer of every dot, which asks again on the screen's beat and takes it away once it is stale. A face with no
       handle (a workplace identity seen by no coworker) is not asked about. */
    var ref = String(card.handle || card.ref || '').replace(/^@?/, '@'), on = card.presence === 'online';
    var mark = ref.length > 1 ? ' data-dot="' + esc(ref) + '" data-dot-seed="' + (on ? 'online' : 'offline') + '"' : '';
    if (!on && !mark) return face(card);
    return '<span class="ow-ocard__faceon"' + mark + '>' + face(card) + (on ? '<i class="ow-ocard__on" role="img" aria-label="Online"></i>' : '') + '</span>';
  }

  /* THE COUNTS, right under the name and the handle (ASKS rows 10-11, PLAN §3.4 item 5): followers first and always, a
     0 included, then posts, then (a person) following. Never members, whatever a read carries. A part the read could
     not make (`unreadable: ['counts']`) is not drawn at all: no number is better than a silent 0 (founder/658).
     `counts(card)` is the list ({key, n, word}); the profile header draws its own row from it (pages.js), so the
     header and every card say the same numbers in the same order with the same words. */
  var COUNTS = { center: ['followers', 'posts'], person: ['followers', 'posts', 'following'] };
  var COUNT_WORDS = { followers: ['follower', 'followers'], posts: ['post', 'posts'], following: ['following', 'following'] };
  /* one formatter, made once: toLocaleString builds one a call, ~18 ms the first time at 4x CPU (the red team's D14) */
  var NUMBER = null;
  function number(n) { try { NUMBER = NUMBER || new Intl.NumberFormat('en-US'); return NUMBER.format(Number(n)); } catch (_) { return String(n); } }
  function counts(card) {
    if (!card || (card.unreadable || []).indexOf('counts') >= 0) return [];
    var c = card.counts || {}, out = [];
    COUNTS[kindOf(card)].forEach(function (k) {
      var n = c[k];
      if (typeof n !== 'number' || !isFinite(n)) return;
      out.push({ key: k, n: n, text: number(n)+(k==='posts' && c.posts_more?'+':''), word: COUNT_WORDS[k][n === 1 ? 0 : 1] });
    });
    return out;
  }
  function countWords(k, n) { return COUNT_WORDS[k] ? COUNT_WORDS[k][n === 1 ? 0 : 1] : ''; }
  /* the ref a card is read by (cards?refs=): its counts are asked again under it while they are drawn */
  function cardKey(card) {
    if (!card) return '';
    if (kindOf(card) === 'center') return 'center:' + (card.center_id || card.id || '');
    var h = card.handle || card.id || '';
    return h ? 'person:@' + String(h).replace(/^@/, '') : '';
  }
  function countsHTML(card) {
    var out = counts(card).map(function (x) {
      return '<span class="ow-ocard__count" data-count="' + x.key + '"><b>' + esc(x.text) + '</b> ' + x.word + '</span>';
    }).join('');
    /* whose counts these are, so a follow anywhere moves them at once (oneway-data.js syncFollowCounts, founder/917) */
    var of = [card.id, card.center_id, card.handle ? '@' + String(card.handle).replace(/^@/, '') : ''].filter(Boolean).join(' ');
    /* the viewer's own card (the card read says so, server-side): its following moves on their follows */
    return out ? '<span class="ow-ocard__counts" data-ow-of="' + esc(of) + '" data-ow-card="' + esc(cardKey(card)) + '" aria-live="polite" aria-atomic="true"' + (card.self ? ' data-ow-self="1"' : '') + '>' + out + '</span>' : '';
  }

  /* THE BANNER: the profile header's own (pages.js draws .ow-banner with the picture, the hue's whisper and the shade;
     a card draws the same element, so the same rules paint both). The read's own treatment and corners; with no banner
     of its own, the account's hue as an empty fade, the people store's default and the person header's. */
  function bannerOf(card) {
    var b = card.banner;
    if (!b && !card.workplace_identity) b = { hue1: card.hue, hue2: card.hue, style: 'fade', empty: true };
    return b || null;
  }
  /* AN EMPTY FADE IS NO BAND ON A CARD (founder, 2026-10-17: "clean infomation ful ... cards"): a fade with no picture
     paints nothing (the room's ground in the dark, white in the light), so on a card it was a 74px band of nothing
     above the face (the landing deck's front card, measured at 390). A card with one starts at its face, 16px in, as
     at its sides; a framed banner with no picture is the account's hue and stays. The header keeps its own (pages.js). */
  function emptyFade(b) { return !!b && !b.url && b.style !== 'framed'; }
  function treatmentOf(card) {
    var b = bannerOf(card);
    return !b || emptyFade(b) ? 'none' : b.style === 'framed' ? 'framed' : 'fade';
  }
  function banner(card) {
    var b = bannerOf(card);
    if (!b || emptyFade(b)) return '';
    var treatment = b.style === 'framed' ? 'framed' : 'fade';
    var corners = b.shape === 'square' ? 'square' : 'rounded';
    var attrs = ' data-banner-style="' + treatment + '" data-banner-shape="' + corners + '"';
    if (b.url) {
      return '<span class="ow-ocard__banner ow-banner"' + attrs + '><img src="' + esc(url(b.url)) + '" alt="" loading="lazy" decoding="async" onerror="OW.imgFail&&OW.imgFail(this)">' +
        '<span class="ow-banner__hue"></span><span class="ow-banner__shade"></span></span>';
    }
    /* an empty banner is the account's hue (framed) or the empty fade (white in a light room, the surface in a dark one) */
    var p = huePair(typeof b.hue1 === 'number' ? b.hue1 : card.hue);
    var style = p ? ' style="--ow-h1:' + p.h1 + ';--ow-h2:' + p.h2 + '"' : '';
    return '<span class="ow-ocard__banner ow-ocard__banner--hue ow-banner" data-empty="1"' + attrs + style + '><span class="ow-banner__shade"></span></span>';
  }

  function websiteOf(card) {
    var website = card.website || '';
    if (!website) (card.details || []).some(function (d) {
      if (String(d.label || '').toLowerCase() !== 'website') return false;
      website = d.href || d.value || ''; return true;
    });
    if (website) {
      try {
        var u = new URL(/^https?:\/\//i.test(website) ? website : 'https://' + website);
        if (u.protocol === 'https:' || u.protocol === 'http:') return {
          label: u.host + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')), href: u.href
        };
      } catch (_) {}
    }
    return null;
  }

  var PROJECTIONS = { full: 'tile', expanded: 'tile', standard: 'tile', mini: 'row', micro: 'row' };
  function projection(opts) {
    return opts && Object.prototype.hasOwnProperty.call(PROJECTIONS, opts.mode) ? opts.mode : '';
  }
  /* THE HANDLE: a Center's `.handle`, a person's `@handle`, as the profile header draws them */
  function handleOf(card) {
    var handle = card.handle || card.ref || '';
    return card.kind === 'center' && handle ? '.' + String(handle).replace(/^[$.]+/, '') : handle;
  }
  /* THE HANDLE LINE of a header and a card: the handle, and a person's pronouns after it (where every platform puts
     them, me.js's own rule), the same line on both */
  function handleLine(card) {
    var h = handleOf(card);
    var pr = card.kind === 'person' ? String(card.pronouns || '').trim() : '';
    return [h, pr].filter(Boolean).join(' · ');
  }
  /* A NAME THAT ONLY REPEATS THE HANDLE IS SAID ONCE (spec K5): 'ada.ops' over '@ada.ops' read as a stutter. The name
     becomes the handle as it is written (with its @ or its dot) and the line under it keeps only what is left (a
     person's pronouns). One rule, here, for the header and every card. */
  function bare(s) { return String(s || '').trim().replace(/^[@.$]+/, '').toLowerCase(); }
  /* a person only (api/oneway/cards titles a person whose name is their handle by the handle, case aside); a Center's
     name is its name, whatever its handle says ("ONEWAY" over ".oneway") */
  function sayOnce(title, line, kind) {
    var parts = String(line || '').split(' · ');
    if (kind === 'person' && parts[0] && bare(parts[0]) && bare(parts[0]) === bare(title)) {
      title = parts.shift();
      line = parts.join(' · ');
    }
    return { title: String(title || ''), line: String(line || '') };
  }
  /* THE NAME AND THE HANDLE LINE. The name on ONE line, its whole self in its title (ASKS row 161: "the text always
     needs to be universal it cannot be dropping down"); the handle line under it, the same tag whatever it is.
     `opts.prefix` 'ow-prof' draws the header's classes (an h1 for the name with `opts.heading`); `opts.line` is the
     header's own line when it has one (me.js adds pronouns); `opts.secondary === false` draws the name alone (a micro
     row); `opts.website === true` keeps the old website line for a caller that still asks for it (none on a card). */
  function nameHTML(card, cls, heading, px) {
    var title=String(card.title || '');
    return '<'+(heading?'h1':'span')+' class="'+esc(cls)+'" dir="auto" title="'+esc(title)+'">'+wordmarkHTML(card,{px:px})+'</'+(heading?'h1':'span')+'>';
  }
  /* ══ THE WORDMARK SLOT: ONE RENDERER FOR A NAME DRAWN AS A WORDMARK (PLAN 5.0.0, CUSTOM WORDMARKS; his words ~21:30Z 2026-11-09: "it better
     be put in the name of the place perfectly and still be searchable") ═════════════════════════════════════════════════════════════
     A person's or a Center's own logo stands exactly where its name stands: sized by the slot's height (the name's line, 1.15em), its width
     its own, never stretched or cut; the typed name stays the name (the slot's accessible name, its hidden words for search and copy, and
     what is drawn when the picture fails or the slot is under `min` px). The server measured the logo on a light and a dark ground
     (oneway/people/wordmark_logo.py): on a dark look its version for dark grounds is worn, and where it does not read and its owner chose
     the soft backing, it stands on one. The header, every card and the Profiles 4 hero draw it through here:
       OW.wordmark.html(who, opts) -> markup     who: a card ({title, wordmark_image, wordmark_logo}) or {name, wordmark_image, wordmark_logo}
       OW.wordmark.draw(el, who, opts) -> el     fills el (its tag, class and place kept); a who with no logo leaves el as it is
       OW.wordmark.has(who) -> bool
     opts: { px: the slot's type size, when known (draw reads the element's), min: under it the typed name (14), ground: 'auto' (the look's)
             | 'light' | 'dark' | 'image' (over a picture: its version for dark grounds where it has one, else the backing unless it reads on
             both), align: 'start' | 'center' } */
  /* served: under /assets/ and never climbing out of it ('..' anywhere is refused, as the server's own check, wordmark_logo.py) */
  var WM_MIN_PX = 14, WM_SERVED = /^\/assets\/(?!.*\.\.)[A-Za-z0-9._\/-]+$/;
  function wmLogo(who) {
    who = who || {};
    var m = who.wordmark_logo && typeof who.wordmark_logo === 'object' ? who.wordmark_logo : {}, u = String(who.wordmark_image || m.url || '');
    /* ONLY A PICTURE THIS PLATFORM SERVES (the security review's P2, 2026-11-10): the server keeps a logo only under /assets/ (oneway/people/
       wordmark_logo.py), so anything else is not a logo, whatever its scheme */
    if (!WM_SERVED.test(u)) return null;
    return { url: url(u), m: m };
  }
  function wordmarkHTML(who, opts) {
    who = who || {}; opts = opts || {};
    var name = String(who.title != null ? who.title : (who.name || '')), L = wmLogo(who), min = opts.min || WM_MIN_PX;
    if (!L || (opts.px && opts.px < min)) return esc(name);
    var m = L.m, d = m.dark && WM_SERVED.test(String(m.dark.url || '')) ? m.dark : null;
    /* where it does not read and its owner chose the backing: on light, when it does not read on light; on dark, when it has no version
       for dark grounds and does not read on dark (a picture ground is dark's) */
    var back = [];
    if (m.backing && m.reads_light === false) back.push('light');
    if (m.backing && !d && m.reads_dark === false) back.push('dark');
    var g = opts.ground && opts.ground !== 'auto' ? opts.ground : '';
    if (g === 'image' && !d && !(m.reads_light && m.reads_dark)) back.push('image');
    var img = function (src, w, h, cls) {
      return '<img class="ow-wml__i' + (cls ? ' ' + cls : '') + '" src="' + esc(src) + '" alt=""' + (w > 0 && h > 0 ? ' width="' + (+w) + '" height="' + (+h) + '"' : '') +
        ' decoding="async" draggable="false">';
    };
    return '<span class="ow-wml" role="img" aria-label="' + esc(name) + '"' + (g ? ' data-ground="' + esc(g) + '"' : '') +
      (back.length ? ' data-back="' + back.join(' ') + '"' : '') + (opts.align ? ' data-align="' + esc(opts.align) + '"' : '') + '>' +
      img(L.url, m.w, m.h, d ? 'ow-wml__i--light' : '') + (d ? img(url(d.url), d.w, d.h, 'ow-wml__i--dark') : '') +
      '<span class="ow-wml__t">' + esc(name) + '</span></span>';
  }
  /* A LOGO THAT FAILS GIVES THE NAME BACK, heard by ONE listener on the document (the security review's P2, 2026-11-10: no inline handler
     in what the slot draws, so a Content-Security-Policy without 'unsafe-inline' holds it): an image's error does not bubble, so it is
     heard as it falls (capture) */
  if (doc && doc.addEventListener && !global.__owWmlFail) {
    global.__owWmlFail = true;
    doc.addEventListener('error', function (e) {
      var t = e && e.target;
      if (!t || !t.classList || !t.classList.contains('ow-wml__i')) return;
      var s = t.closest && t.closest('.ow-wml');
      if (s) s.setAttribute('data-failed', '');
    }, true);
  }
  function wordmarkDraw(el, who, opts) {
    if (!el || !wmLogo(who)) return el;
    opts = Object.assign({}, opts || {});
    if (!opts.px) { try { opts.px = parseFloat(global.getComputedStyle(el).fontSize) || 0; } catch (_) {} }
    var name = String((who || {}).title != null ? who.title : ((who || {}).name || ''));
    el.innerHTML = wordmarkHTML(who, opts);
    if (name && !el.getAttribute('title')) el.setAttribute('title', name);
    return el;
  }
  function identityHTML(card, opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'ow-ocard', heading = opts.heading ? 'h1' : 'span';
    var site = opts.website === true ? websiteOf(card) : null;
    var line = opts.secondary === false ? '' : site ? site.label : (opts.line != null ? opts.line : handleLine(card));
    var said = site ? { title: card.title || '', line: line } : sayOnce(card.title || '', line, kindOf(card));
    if(card.wordmark_image)said={title:card.title || '',line:line};
    var nameClass = prefix + '__name', subClass = prefix === 'ow-prof' ? 'ow-prof__handle' : prefix + '__sub';
    /* the slot's size, for the logo's minimum: a header's name, a card's, a micro row's */
    var px = prefix === 'ow-prof' ? 22 : opts.secondary === false ? 12 : 16;      /* a micro row draws its name alone, small: its typed name */
    return (prefix === 'ow-ocard' && opts.note !== false ? noteHTML(card.note, opts.noteSize || 'card') : '') + nameHTML(Object.assign({},card,{title:said.title}),nameClass,opts.heading,px) +
      (said.line ? (site ? '<a class="' + subClass + '" href="' + esc(site.href) + '" target="_blank" rel="noopener noreferrer">' :
        '<span class="' + subClass + '" title="' + esc(said.line) + '" dir="auto">') + esc(said.line) + (site ? '</a>' : '</span>') : '');
  }
  /* A PERSON'S NOTE, ABOVE THEIR NAME, WHEREVER THEY APPEAR (founder/878, 2026-10-21: "notes are still not appearing above the
     name closley and cleanly"; "the change is it appears everywhere but must look good doing so"). Instagram's Notes: a small
     speech bubble directly over the name, touching it, its tail toward the face; the theme's own ground with a crisp edge,
     so it reads on every hue. In the flow above the name, so it never covers a face, a name or a banner and is never
     clipped. Sized for where it is: `profile` two lines, `card` one, `sm` a short line on a small card or a row. The card
     read carries it only as its person's audience allows (api/oneway/cards, people.store.note); nothing is drawn without
     one. THE ONE RENDERER: the material's OW.noteHTML and OW.noteOn draw through this (oneway-popit.js). */
  function noteHTML(note, size) {
    var t = typeof note === 'string' ? note : (note && note.text);
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var sz = size === 'profile' ? 'profile' : (size === 'sm' || size === 'micro') ? 'sm' : 'card';
    return '<span class="po-note ow-note" data-size="' + sz + '" role="note" title="' + esc(t) + '">' +
      '<span class="po-note__t" dir="auto">' + esc(t) + '</span><i class="po-note__tie" aria-hidden="true"></i></span>';
  }
  /* A PLACE IS WRITTEN THE SHORT WAY (founder, 2026-10-16: "location should always be the quickest abbreviations like
     Atlantic City, NJ, rather than New Jersey"): a US state or territory becomes its postal code and a trailing
     "United States" goes. The record keeps the full words; only what is drawn is shortened, everywhere this renderer draws. */
  var STATE = { 'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT',
    'delaware':'DE','district of columbia':'DC','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL',
    'indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
    'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE',
    'nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
    'north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI',
    'south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA',
    'washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY','puerto rico':'PR' };
  function shortPlace(line) {
    if (!line) return line;
    var parts = String(line).split(/\s*[,·]\s*/).filter(Boolean);
    if (parts.length > 1 && /^(united states( of america)?|usa|us)$/i.test(parts[parts.length - 1])) parts.pop();
    /* only the parts AFTER the first: "New York" alone is a city, "Atlantic City, New Jersey" ends in a state */
    parts = parts.map(function (p, i) { var k = i > 0 && STATE[p.toLowerCase()]; return k || p; });
    return parts.join(', ');
  }
  function placeOf(card) { return card.address || shortPlace(card.kind === 'person' ? card.place : card.line) || ''; }
  /* THE COMPACT CARD (founder/834: "these should be the compact cards that are forced to be in this order, and this is what
     should appear on search ... the right hand of the side is the most useful area, and I don't want them really being pushed
     down more ... this gray text area here is where you could have the line by line by line business information that we
     designed on the other card. To the left of that would be the um, social media platforms. I wouldn't put the bio on here
     ... I would do the username ... right under the add of ops ... but small"). In this order: the picture; the name with
     the handle small under it; then, at the right, the platforms' marks (a Center's too, here) and the business's details
     line by line (the card read's rows: Hours, Serves, Address ...), else its one line (the place, else the category). No
     bio, no role or plan line. One height whatever it holds (oneway-popit.css; red in oneway/cards/test_profile_banner.py). */
  function compactAside(card) {
    var marks = linkItems(card, { centers: true }).filter(function (it) { return it.known; });
    var links = marks.length ? '<span class="ow-ocard__links ow-linkbar" role="list">' + marks.map(function (it) {
      var hue = OW.links.hueOf ? OW.links.hueOf(it.key) : '';
      return '<a class="ow-linkbar__i" role="listitem" href="' + esc(it.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) +
        '" title="' + esc(it.name) + '" data-platform="' + esc(it.key) + '"' + (hue && hue !== '#000000' ? ' style="--mk:' + esc(hue) + '"' : '') + '>' + OW.links.icon(it.key) + '</a>';
    }).join('') + '</span>' : '';
    var rows = (card.details || []).filter(function (d) { return d && d.label && d.value; });
    if (!rows.length) {             /* none: its one line, named as a detail is, so its value stands where theirs do */
      var where = placeOf(card);
      if (where) rows = [{ label: 'Place', value: where }]; else if (card.category_label) rows = [{ label: 'Category', value: card.category_label }];
    }
    /* the values of each column of three start in one line: its labels' width, its own */
    var colW = [0, 1].map(function (c) { return Math.max.apply(null, [0].concat(rows.slice(c * 3, c * 3 + 3).map(function (d) { return String(d.label).length; }))); });
    var facts = rows.length ? rows.map(function (d, i) {
      var v = String(d.value).split('\n')[0];
      return '<span class="ow-ocard__fact" style="--lw:' + (colW[i < 3 ? 0 : 1] * 0.6).toFixed(1) + 'em" title="' + esc(d.label + ': ' + d.value) + '"><i>' +
        esc(d.label) + '</i> <b dir="auto">' + esc(v) + '</b></span>';
    }).join('') : '';
    var lines = rows.length || (facts ? 1 : 0);
    return links || facts ? '<span class="ow-ocard__aside">' + links + (facts ? '<span class="ow-ocard__facts" style="--rows:' + Math.min(3, lines) + '">' +
      facts + '</span>' : '') + '</span>' : '';
  }
  /* the compact projections' one line: the place, else the category (mini); the category, the place and a status (standard) */
  function contextHTML(card, mini) {
    var location = placeOf(card);
    var status = typeof card.status === 'string' ? card.status : '';
    var fields = mini ? [location || card.category_label] : [card.category_label, location, status];
    return fields.filter(Boolean).map(function (value) {
      return '<span class="ow-ocard__context-item" dir="auto">' + esc(value) + '</span>';
    }).join('');
  }

  /* DIRECTIONS, decided once (founder/442 "clicking take me there does nothing"; ASKS row 162 "Directions: then THE LOGO
     OF THE CONNECTED APP"): only when the card read carries the point its place resolved to (api/oneway/cards,
     centers.service.where()'s pin), never a name a maps app has to guess at. The phone's own map app: Apple Maps on an
     iPhone or an iPad, Google Maps everywhere else, a desktop Mac included (maps:// there did nothing). The App's
     Center page header draws this same row (pages.js), so the header and every card go to one point. */
  var MAP_MARK = {
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#34c759"/><path d="M1 15 L23 9 V17 A6 6 0 0 1 17 23 H7 A6 6 0 0 1 1 17Z" fill="#f2f2f7"/><path d="M12 5.5 17 17.5 12 15.2 7 17.5Z" fill="#0a84ff"/></svg>',
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 13.5 7.5 13.5s7.5-8.1 7.5-13.5A7.5 7.5 0 0 0 12 1.5z" fill="#ea4335"/><path d="M4.9 6.6 12 1.5A7.5 7.5 0 0 0 4.9 6.6z" fill="#4285f4"/><path d="M19.1 6.6A7.5 7.5 0 0 0 12 1.5L9 4.2z" fill="#fbbc04"/><path d="M12 22.5s3.6-3.9 5.7-7.8L7.8 10.4C9.1 14.6 12 22.5 12 22.5z" fill="#34a853"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>'
  };
  function appleDevice() {
    var nav = global.navigator || {}, ua = nav.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);
  }
  function directions(card) {
    var p = card && card.directions;
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || !isFinite(p.lat) || !isFinite(p.lng)) return null;
    var dest = encodeURIComponent(p.lat + ',' + p.lng);
    if (appleDevice()) return { app: 'Apple Maps', mark: MAP_MARK.apple, destination: p.lat + ',' + p.lng,
      href: 'https://maps.apple.com/?daddr=' + dest };
    return { app: 'Google Maps', mark: MAP_MARK.google, destination: p.lat + ',' + p.lng,
      href: 'https://www.google.com/maps/dir/?api=1&destination=' + dest };
  }

  /* THE INFORMATION LIST, the profile header's own (ASKS row 162: "Location: Directions: ... Catagory: all directly on
     top and below each other"; pages.js INFO_ORDER): a Center's Location, Directions (when the read carries its point)
     and its Categories (all it is, api/oneway/cards `categories`), and nothing else: a business carries no icons
     (founder/808). A person has no rows: only their icons (the header's rule since the 442 addendum; spec K9). Each
     row's label is its title, drawn by the stylesheet, so the header and a card draw one list.
     `opts.directions === false` leaves Directions out; `opts.category === false` the Category. */
  function categoriesOf(card) {
    var out = [], seen = {};
    var list = Array.isArray(card && card.categories) && card.categories.length ? card.categories : [card && card.category_label];
    list.forEach(function (c) {
      var t = String(c || '').trim(), k = t.toLowerCase();
      if (t && !seen[k]) { seen[k] = 1; out.push(t); }
    });
    return out;
  }
  function infoRows(card, opts) {
    opts = opts || {};
    var rows = [];
    if (!card || card.kind === 'person') return rows;
    var place = placeOf(card);
    if (place) rows.push({ label: 'Location', value: place });
    var dir = opts.directions === false ? null : directions(card);
    if (dir) rows.push({ label: 'Directions', value: dir.app, href: dir.href, mark: dir.mark, aria: 'Directions in ' + dir.app });
    /* ITS CATEGORIES, WHERE A PERSON HAS ICONS (founder/808: "users get icons businesses get catagories"): every kind
       the business is, its own first, said once; "Category" for one and "Categories" for several */
    var cats = categoriesOf(card);
    if (cats.length && opts.category !== false) rows.push({ label: cats.length > 1 ? 'Categories' : 'Category', value: cats.join(', ') });
    return rows;
  }
  function informationHTML(card, opts) {
    if (!card) return '';
    return infoRows(card, opts).map(function (item) {
      var href = SAFE_HREF.test(item.href || '') ? item.href : '';
      var value = (item.mark || '') + (item.mark ? '<span>' + esc(item.value) + '</span>' : esc(item.value));
      return '<span class="ow-ocard__detail" title="' + esc(item.label) + '">' +
        (href ? '<a' + (item.mark ? ' class="ow-ocard__go"' : '') + ' href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(item.aria || (item.label + ': ' + item.value)) + '">' + value + '</a>'
              : '<span dir="auto" aria-label="' + esc(item.label + ': ' + item.value) + '">' + value + '</span>') + '</span>';
    }).join('');
  }

  /* THE LINK ICONS: the platforms' own marks, drawn as the header's link bar draws them (.ow-linkbar, oneway-links.js:
     the same element, the same 32px targets and 18px marks, the platform's colour riding on --mk so the person's
     colour-or-mono choice reaches both). The website first for both kinds, then the stored links. A link no mark is
     known for keeps its words, in an outlined pill.
     A CARD ASKS NO OTHER HOST FOR ANYTHING. OW.links.icon(key, url) draws a host it does not know as <img
     src=<host>/favicon.ico>, so a card drawing a Center's website made every visitor's browser ask that Center's own
     domain for its icon as the page loaded, signed out included (measured 2026-10-16, cards-2026-10-16/measure-1). So
     the card never hands icon() an address: a known platform is its vector mark, any other host the generic web mark,
     and nothing is fetched. The header draws its icons with this too (pages.js), so it asks no other host either. */
  /* NO ICON TWICE, AND AS MANY AS THEY HAVE (founder/808: "dont allow users to have multiple of the same icons on
     profile but give them infinte icons to add"; "users get icons businesses get catagories"). A person's icons only:
     a Center carries its categories in this place (infoRows), never icons. Each platform is drawn once, the first link
     to it (the writer refuses a second, api/oneway/people/store.links_problem; a row written before that rule is drawn
     once here too), and nothing is cut by count. A host no platform is known for is its own platform: the first such
     site wears the web mark, and any other site its own words in an outlined pill, so two identical marks never stand
     side by side. */
  function linkItems(card, opts) {
    var list = [], seen = {}, out = [], webMark = false;
    if (!card || (kindOf(card) === 'center' && !(opts && opts.centers))) return out;   /* the compact card's own (founder/834) */
    var site = websiteOf(card);
    if (site) list.push({ url: site.href });
    (card.links || []).forEach(function (l) { if (l) list.push(l); });
    list.forEach(function (l) {
      var href = String(l.url || '');
      if (!SAFE_HREF.test(href)) return;
      var pf = OW.links && OW.links.platformOf ? OW.links.platformOf(href) : null;
      var host = href.replace(/^[a-z]+:(\/\/)?(www\.)?/i, '').split(/[\/?#]/)[0].toLowerCase();
      var key = pf && pf.key && pf.key !== 'web' ? pf.key : 'site:' + host;
      if (seen[key]) return;
      seen[key] = 1;
      var known = !!(pf && OW.links.icon);
      if (known && pf.key === 'web') { if (webMark) known = false; else webMark = true; }
      out.push({ href: pf ? pf.href : href, key: pf ? pf.key : '', name: l.label || (known ? (pf && pf.name) : host) || href, known: known });
    });
    return out;
  }
  function linksInner(card, opts) {
    return linkItems(card, opts).map(function (it) {
      if (it.known) {
        var hue = OW.links.hueOf ? OW.links.hueOf(it.key) : '';
        return '<a class="ow-linkbar__i" role="listitem" href="' + esc(it.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) + '" title="' + esc(it.name) + '"' +
          ' data-platform="' + esc(it.key) + '"' + (hue && hue !== '#000000' ? ' style="--mk:' + esc(hue) + '"' : '') + '>' + OW.links.icon(it.key) + '</a>';
      }
      return '<a class="ow-linkbar__i ow-ocard__link-text" role="listitem" href="' + esc(it.href) + '" target="_blank" rel="noopener noreferrer">' + esc(it.name) + '</a>';
    }).join('');
  }
  function linksHTML(card) {
    var inner = linksInner(card);
    return inner ? '<span class="ow-ocard__links ow-linkbar" role="list">' + inner + '</span>' : '';
  }

  /* THE ABOUT ROW (founder/801: "the info condesne to the right, bio in line to the left, and social icons below"):
     the bio on the left (the whole of what the read carries; the read cuts it once, at a word), the information on
     the right with the icons under it, side by side at every width (the stylesheet). Nothing in it is a prompt: a
     missing fact is absent. With no bio, the information alone (spec K12); with nothing, no row. */
  function bioOf(card) { return card.kind === 'person' ? (card.line || '') : (card.blurb || ''); }
  /* WHETHER A SUGGESTION SURFACE MAY DRAW IT (founder/1110): the read's own answer (api/oneway/cards/showcase.py worth_suggesting), when the read asked for the smart part */
  function worthSuggesting(card) { return !!card && card.suggest !== false; }
  function aboutHTML(card) {
    var text = bioOf(card);
    var bio = text ? '<span class="ow-ocard__bio" dir="auto">' + esc(text) + '</span>' : '';
    var rows = informationHTML(card);
    var icons = linksHTML(card);
    var info = rows || icons ? '<span class="ow-ocard__info">' + rows + icons + '</span>' : '';
    return bio || info ? '<span class="ow-ocard__summary' + (bio ? '' : ' ow-ocard__summary--no-bio') + '" data-kind="' + kindOf(card) + '">' + bio + info + '</span>' : '';
  }

  /* WHAT A PERSON'S CARD SAYS BELOW THEIR NAME (founder/1052: "automaitcally change the info on bottom depending on ... where the user conributes most"):
     the server decides the blocks and their order (api/oneway/cards/showcase.py), or the person did; this only draws them. No block, nothing drawn,
     so the card is as tall as what it has to say. */
  function showcaseHTML(card, only) {
    var s = only || (card && card.showcase), order = (s && s.order) || [];
    if (!order.length) return '';
    return '<span class="ow-show">' + order.map(function (b) {
      if (b === 'video' || b === 'photo') {
        return '<span class="ow-show__grid" data-n="' + (s[b] || []).length + '">' + (s[b] || []).map(function (m) {
          return '<span class="ow-show__cell"' + (m.kind === 'video' ? ' data-video="1"' : '') + '><img src="' + esc(url(m.thumb)) + '" alt="" loading="lazy" decoding="async" onerror="OW.imgFail&&OW.imgFail(this)"></span>';
        }).join('') + '</span>';
      }
      if (b === 'text') return (s.text || []).map(function (t) { return '<span class="ow-show__text" dir="auto">' + esc((t.from ? t.from + ': ' : '') + t.text) + '</span>'; }).join('');
      if (b === 'event' && s.event) {
        var at = s.event.starts_at ? new Date(s.event.starts_at) : null;
        return '<span class="ow-show__event"><b dir="auto">' + esc(s.event.title) + (s.event.at ? ' at ' + esc(s.event.at) : '') + '</b>' +
          (at && !isNaN(at) ? '<span>' + esc(at.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })) + '</span>' : '') + '</span>';
      }
      if (b === 'bio') return '<span class="ow-show__bio" dir="auto">' + esc(s.bio) + '</span>';
      if (b === 'mutuals' && s.mutuals) {
        var fs = s.mutuals.faces || [], n = +s.mutuals.count || fs.length, more = n - 1;
        return '<span class="ow-show__mutual"><span class="ow-show__faces" aria-hidden="true">' + fs.map(function (f) {
          return '<span class="ow-show__face">' + inside({ name: f.title, picture: f.picture }, { img: ' loading="lazy"' }) + '</span>';
        }).join('') + '</span><span dir="auto">Followed by ' + esc((fs[0] || {}).title || 'someone you follow') + (more > 0 ? ' and ' + more + ' more you follow' : '') + '</span></span>';
      }
      /* WHAT IS INSIDE IT AND HOW MANY (founder/1110), the way mutual friends are said: their faces, the first one's name, how many more */
      if (b === 'inside' && s.inside) {
        var ins = s.inside.faces || [], others = (+s.inside.count || ins.length) - 1;
        return '<span class="ow-show__mutual" data-of="inside"><span class="ow-show__faces" aria-hidden="true">' + ins.map(function (f) {
          return '<span class="ow-show__face">' + inside({ name: f.title, picture: f.picture, letters: initials(f.title).slice(0, 1) }, { img: ' loading="lazy"' }) + '</span>';
        }).join('') + '</span><span dir="auto">' + esc((ins[0] || {}).title || 'A place') + (s.inside.more ? ' and more here' : others > 0 ? ' and ' + others + ' more here' : ' is here') + '</span></span>';
      }
      if (b === 'links') return '<span class="ow-show__links">' + linksHTML(card) + '</span>';
      if (b === 'follows_you' && s.follows_you) return '<span class="ow-show__rel">Follows you</span>';
      if (b === 'private' && s.private) return '<span class="ow-show__rel">Private account</span>';
      if (b === 'joined' && s.joined) {
        var j = new Date(String(s.joined).slice(0, 7) + '-15T12:00:00Z');
        return isNaN(j) ? '' : '<span class="ow-show__since">Joined Oneway in ' + esc(j.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</span>';
      }
      return '';
    }).join('') + '</span>';
  }

  /* WHAT THE CARD SAYS UNDER ITS INFORMATION (founder/1087: "The card should always find some amount of information to display to the
     user based off whether they have mutual friends, posts, or information as shown here. Like TikTok does"; 1052). The server chose the
     blocks (api/oneway/cards/showcase.py order_of: their choice; follows you, mutual friends with their faces; where they contribute most;
     the bio and platforms; when they joined, only when nothing else is said). On the card the bio and the platforms are the about row's
     already (OW.lcard), so they are not said twice. A read that carried no showcase still never leaves a card mute: a private account
     says so, and a card with no words at all says when it began. Never invented: every block is a thing the account has. */
  function hasAbout(card) {
    return !!(bioOf(card) || (card.details || []).length || card.line || card.place || (card.links || []).length || card.website);
  }
  /* NEVER A WORD CUT IN HALF (founder/1110): a clamped text ends on a whole word and its dots, at whatever width the card is drawn. CSS's clamp cuts at a letter ("the boardw..."),
     so each clamped box is measured once it has a size and again when its width changes; the box itself never moves. */
  function fitWords(box) {
    var el = box.matches('.lc-fact > span') ? (box.querySelector(':scope > b') || box) : box;
    if (el.__full == null) el.__full = el.textContent;
    el.textContent = el.__full;
    if (box.scrollHeight <= box.clientHeight + 1) return;
    var words = el.__full.split(/\s+/), lo = 1, hi = words.length - 1, mid;
    while (lo < hi) {
      mid = Math.ceil((lo + hi) / 2);
      el.textContent = words.slice(0, mid).join(' ') + '\u2026';
      if (box.scrollHeight <= box.clientHeight + 1) lo = mid; else hi = mid - 1;
    }
    el.textContent = words.slice(0, lo).join(' ').replace(/[\s,;:.\u2013\u2014-]+$/, '') + '\u2026';
  }
  var FIT_BOXES = '.ow-show__text, .ow-ocard__bio, .ow-show__mutual > span:last-child, .lc-fact > span, .ow-show__event > b';
  var fitter = global.ResizeObserver ? new global.ResizeObserver(function (list) {
    list.forEach(function (e) { if (!e.target.isConnected) fitter.unobserve(e.target); else if (e.contentRect.width > 0) fitWords(e.target); });
  }) : null;
  function fitCard(el) {
    if (!fitter) return;
    var boxes = [].slice.call(el.querySelectorAll(FIT_BOXES));
    boxes.forEach(function (box) { fitter.observe(box); });
    /* a font that arrives after the first measure breaks the lines anew, with no change of size for the observer to see */
    if (doc.fonts && doc.fonts.status !== 'loaded') doc.fonts.ready.then(function () { boxes.forEach(function (box) { if (box.isConnected && box.clientWidth) fitWords(box); }); });
  }
  /* NO CARD IS A TOWER (founder/1110: "see how these cards are not smart and get to large"; Instagram's and TikTok's suggested cards say one social line and one strip): what
     the server chose, in its order, up to what a card holds: two quiet lines (who you know, what is inside), one event, and ONE post block, a strip of pictures or one post's words. */
  function smartFits(order) {
    var lines = 0, post = 0, ev = 0;
    return order.filter(function (b) {
      if (b === 'bio' || b === 'links') return false;
      if (b === 'event') return !ev++;
      if (b === 'video' || b === 'photo' || b === 'text') return !post++;
      if (b === 'inside' && ev && post) return false;   /* an event and a post already: it stops there, not a third block */
      return lines++ < 2;
    });
  }
  function smartHTML(card) {
    var s = card && card.showcase;
    var order = smartFits((s && s.order) || []);
    var said = s ? Object.assign({}, s, { order: order, text: (s.text || []).slice(0, 1) }) : { order: [] };
    if (!order.length && card && card.private) said = { order: ['private'], private: true };
    else if (!order.length && card && !hasAbout(card) && card.since) said = { order: ['joined'], joined: card.since };
    var h = showcaseHTML(card, said);
    return h ? h.replace('<span class="ow-show">', '<span class="ow-show" data-on="card">') : '';
  }

  /* THE CARD (founder/1087: "I want those cards to be appearing in the app and on the OS"; founder/1075: "cards should look the same as
     landing page cards"). One drawing: the landing's card (OW.lcard, frontend/landing/landing-cards.js) made alive (OW.liveCard,
     oneway-livecard.js), with no banner (the banner is the profile's, founder/1087) and its smart part (smartHTML). Every App and OS
     surface that shows a person or a Center as a card calls this, or mounts it: OW.cards.mount(host, kind, ref, { as: 'card' }).
     opts: onOpen(card) replaces opening its page; onFollow(on, card) after a follow lands; actions: false leaves Follow and Message to the
     surface. Until the drawing has loaded (first use), a host that fills when it has. */
  var DRAWN = null;
  function cardReady() {
    if (OW.liveCard && OW.lcard) return Promise.resolve();
    if (OW.need) return OW.need(['lcard', 'livecard']);
    /* a page with no OW.need (the OS: os.js keeps its loader to itself) declares the two the same way, <script type="text/ow-lazy">,
       and they are fetched here, in order, once */
    if (DRAWN) return DRAWN;
    DRAWN = ['lcard', 'livecard'].reduce(function (p, name) {
      return p.then(function () {
        var t = doc.querySelector('script[type="text/ow-lazy"][data-name="' + name + '"]');
        if (!t) throw new Error(name + ' is not declared on this page');
        return new Promise(function (ok, no) {
          var x = doc.createElement('script'); x.src = t.getAttribute('src');
          x.onload = function () { ok(); }; x.onerror = function () { no(new Error(name + ' did not load')); };
          doc.head.appendChild(x);
        });
      });
    }, Promise.resolve());
    DRAWN.catch(function () { DRAWN = null; });
    return DRAWN;
  }
  function theCard(card, opts) {
    if (OW.liveCard && OW.lcard) return OW.liveCard(card, opts || {});
    var host = doc.createElement('div');
    host.className = 'ow-lchost';
    host.setAttribute('aria-busy', 'true');
    cardReady().then(function () {
      host.removeAttribute('aria-busy');
      host.appendChild(OW.liveCard(card, opts || {}));
    }, function () {
      host.removeAttribute('aria-busy');
      host.appendChild(node(card, { mode: 'standard' }));
    });
    return host;
  }

  /* THE HEAD: the banner, and over its foot the header's grid: the face, beside it (or under it) the name, the handle
     line and the counts; the actions go in after them (node()); the about row last. */
  function layoutOf(card) { return card.layout === 'above' ? 'above' : 'beside'; }
  function headHTML(card, full, details) {
    var lay = layoutOf(card);
    var top = '<span class="ow-ocard__top" data-layout="' + lay + '" data-kind="' + kindOf(card) + '">' + face(card) +
      /* THE COUNTS ARE ON EVERY CARD THAT HAS THEM (the founder, 2026-10-30: "why are following follwer counts ... not showing everywhere"); they were on full cards alone */
      '<span class="ow-ocard__id">' + identityHTML(card) + countsHTML(card) + '</span>' +
      (full || details ? aboutHTML(card) : '') + '</span>';
    var bn = banner(card);
    return bn ? '<span class="ow-ocard__hero"' + (bannerOf(card).url ? ' data-picture="1"' : '') + '>' + bn + top + '</span>' : top;
  }

  function html(card, opts) {
    opts = opts || {};
    var mode = projection(opts);
    var as = mode ? PROJECTIONS[mode] : (opts.as || 'row');
    if (!card) return '';
    /* THE COMPACT PROJECTIONS draw the same parts for both kinds (founder/797: "condensed versions of the cards") */
    if (as === 'chip') return face(card) + '<b class="ow-ocard__name" title="' + esc(card.title || '') + '">' + esc(card.title) + '</b>';
    if (mode === 'micro') return slimFace(card) + '<span class="ow-ocard__id">' + identityHTML(card, { secondary: false, noteSize: 'sm' }) + '</span>';
    if (mode === 'mini' || as === 'row') return slimFace(card) + '<span class="ow-ocard__id">' +
      identityHTML(card, { line: handleOf(card), noteSize: 'sm' }) + countsHTML(card) + '</span>' + compactAside(card);
    if (as === 'simple') {
      return '<span class="po-card__face" aria-hidden="true"></span>' + face(card) + '<span class="ow-ocard__id">' + identityHTML(card, { line: handleOf(card), noteSize: 'sm' }) + '</span>';
    }
    if (mode === 'standard') {
      var sctx = contextHTML(card, false);
      return headHTML(card, false, !!opts.details) + (sctx ? '<span class="ow-ocard__context">' + sctx + '</span>' : '') + showcaseHTML(card);
    }
    /* a tile, a flag, an expanded or a full card: the header's anatomy (the actions are put in by node()) */
    return headHTML(card, true);
  }

  function open(card, node) {
    var kind = kindOf(card);
    if (OW.project && OW.project.open && card.id) { OW.project.open(kind, card.id, node); return; }
    if (card.href) global.location.href = card.href;
  }

  /* THE ACTIONS A SURFACE AUTHORISED (PLAN §3.4: caller-authorised actions). Each is {label or icon, onPress, kind:
     'primary' | 'outline', disabled, confirm, ariaLabel}: Primary is the one thing to do (Follow before you follow, Request access),
     everything else Outlined (Unfollow, Message, More, Open), so no button is words on nothing (founder/790, S20). The
     renderer never decides who may act: the owner's missing Unfollow and an operator's warning are the surface's;
     `confirm` is that warning, said in place on the button itself, and the second press acts (no modal). */
  var CONFIRM_MS = 5000;
  /* AN ACTION WEARING A MARK, NOT A WORD: the overflow (More), the 36px square every platform gives it (Instagram's,
     X's), named for a reader. {icon: 'more', ariaLabel: 'More', onPress}. One mark, here: the profile header draws its
     More with OW.cards.mark('more') (me.js), so the header's row and a card's are the same buttons. */
  var MARKS = {
    more: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5.5" cy="12" r="1.7"/>' +
      '<circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg>'
  };
  function mark(name) { return Object.prototype.hasOwnProperty.call(MARKS, name) ? MARKS[name] : ''; }
  /* THE MENU A MORE OPENS (the half-baked audit, 2026-11-01, unit 5; the founder that day: "we keep doing things like making
     them half-baked and then leaving them"): one menu for every More, so a post, a comment and a card offer their choices the
     same way. The row is drawn IN PLACE after `after` (no modal, S-rules), a second press of the More folds it away, and a
     choice may turn the row into its next step (a report's reasons, a note's words) or into the sentence that says what
     happened, with its undo beside it. The renderer decides nothing about who may do what: the caller passes the choices.
       OW.cards.menu(more, after, items, {label})   the row, or null when the press folded it away
         items: [{label, onPress(row, button)}]
       OW.cards.menuStep(row, question, choices)    the row becomes a question and its choices [{label, onPress(row, button)}]
       OW.cards.menuSay(row, words, undo)           the row becomes what happened; `undo` {label, onPress} when it can be taken back */
  function menuButton(cls, item, row) {
    var b = doc.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = item.label;
    b.addEventListener('click', function (ev) { ev.stopPropagation(); item.onPress(row, b); });
    return b;
  }
  function menu(more, after, items, opts) {
    opts = opts || {};
    var open = more && more.__owMenu;
    if (open && open.parentNode) {
      open.parentNode.removeChild(open);
      more.__owMenu = null; more.setAttribute('aria-expanded', 'false');
      return null;
    }
    var row = doc.createElement('div');
    row.className = 'po-acts__more ow-menu';
    row.setAttribute('role', 'group');
    if (opts.label) row.setAttribute('aria-label', opts.label);
    row.addEventListener('click', function (ev) { ev.stopPropagation(); });
    (items || []).forEach(function (it) {
      if (it && it.label && typeof it.onPress === 'function') row.appendChild(menuButton('po-act', it, row));
    });
    if (!row.childNodes.length) return null;
    var at = after || more;
    at.parentNode.insertBefore(row, at.nextSibling);
    more.__owMenu = row; more.setAttribute('aria-expanded', 'true');
    return row;
  }
  function menuStep(row, question, choices) {
    row.innerHTML = '';
    var box = doc.createElement('div'); box.className = 'ow-report';
    var q = doc.createElement('p'); q.className = 'ow-report__q'; q.textContent = question;
    var list = doc.createElement('div'); list.className = 'ow-report__list';
    box.appendChild(q); box.appendChild(list); row.appendChild(box);
    (choices || []).forEach(function (c) {
      if (c && c.label && typeof c.onPress === 'function') list.appendChild(menuButton('ow-report__r', c, row));
    });
    return list;
  }
  function menuSay(row, words, undo) {
    row.innerHTML = '';
    var p = doc.createElement('p'); p.className = 'ow-report__ok'; p.setAttribute('role', 'status'); p.textContent = words;
    row.appendChild(p);
    if (undo && undo.label && typeof undo.onPress === 'function') row.appendChild(menuButton('po-act', undo, row));
  }
  function actionsNode(card, list) {
    var row = doc.createElement('div');
    row.className = 'ow-ocard__actions';
    (list || []).forEach(function (action) {
      if (!action || typeof action.onPress !== 'function') return;
      var icon = action.icon ? mark(action.icon) : '';
      if (!action.label && !icon) return;
      var button = doc.createElement('button');
      button.type = 'button';
      /* IN THE APP AND THE OS (html[data-mode]) the card's buttons are the one family (founder/1148-1150): primary, secondary, a glyph
         the round; elsewhere (the landing, the embed) they keep the shared .ow-btn until that surface moves */
      button.className = doc.documentElement.hasAttribute('data-mode')
        ? 'po-act ' + (icon ? 'po-act--round ow-ocard__overflow' : action.kind === 'primary' ? 'po-act--primary' : 'po-act--secondary')
        : (action.kind === 'primary' ? 'ow-btn' : 'ow-btn ow-btn--outline') + (icon ? ' ow-ocard__overflow' : '');
      button.setAttribute('data-kind', action.kind === 'primary' ? 'primary' : 'outline');
      var rest = function () { if (icon) button.innerHTML = icon; else button.textContent = action.label; };
      rest();
      if (action.ariaLabel || icon) button.setAttribute('aria-label', action.ariaLabel || action.label || action.icon);
      if (action.disabled) button.disabled = true;
      var armed = 0;
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        if (action.confirm && !armed) {
          armed = setTimeout(function () { armed = 0; rest(); button.removeAttribute('data-confirming'); }, CONFIRM_MS);
          button.textContent = action.confirm; button.setAttribute('data-confirming', '1');
          return;
        }
        if (armed) { clearTimeout(armed); armed = 0; rest(); button.removeAttribute('data-confirming'); }
        action.onPress(card, button);
      });
      row.appendChild(button);
    });
    return row.childNodes.length ? row : null;
  }

  /* THE EVENTS, a part of the card itself when a surface asks (founder/410: "make the card larger and have events be an
     actual subcategory of the card and center itself"): the shared event glance (OW.glance), each hour named where the
     event is (the read's timezone), the caption in the card's own type. The card grows for them. */
  function inZone(iso, zone, o) {
    var d = new Date(iso); if (isNaN(d)) return '';
    try { return new Intl.DateTimeFormat(undefined, zone ? Object.assign({ timeZone: zone }, o) : o).format(d); }
    catch (e) { return new Intl.DateTimeFormat(undefined, o).format(d); }
  }
  function eventsNode(card, opts) {
    var evs = card.events || [];
    if (!evs.length || !OW.glance) return null;
    var box = doc.createElement('div'); box.className = 'ow-ocard__events';
    var head = doc.createElement('div'); head.className = 'ow-ocard__events-h';
    head.innerHTML = 'Events<span>' + evs.length + '</span>';
    box.appendChild(head);
    var zone = card.timezone || '', hue = huePair(card.hue);
    evs.forEach(function (e) {
      var iso = e.starts_at || '';
      var when = iso ? { mon: inZone(iso, zone, { month: 'short' }), day: +inZone(iso, zone, { day: 'numeric' }) } : null;
      var hour = iso ? inZone(iso, zone, { hour: 'numeric', minute: '2-digit' }) : '';
      var venue = (e.mode === 'digital' || e.mode === 'online') ? 'Online' : (e.place || '');
      var n = OW.glance({ id: 'card-ev-' + e.id, label: e.title, when: when, icon: 'event', hue: hue,
        signal: [hour, venue].filter(Boolean).join(' · ') }, { open: false });
      n.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (typeof opts.onEvent === 'function') opts.onEvent(e, n, card);
        else if (OW.project && OW.project.open) OW.project.open('event', e.id, n);
        else global.location.href = '/app#event/' + encodeURIComponent(e.id);
      });
      box.appendChild(n);
    });
    return box;
  }

  /* the attributes the header's rules read on a full card's root, as pages.js sets them on the header's */
  function markRoot(n, card, as) {
    if (as !== 'tile' && as !== 'flag') return;
    n.setAttribute('data-layout', layoutOf(card));
    n.setAttribute('data-banner-style', treatmentOf(card));
  }

  function node(card, opts) {
    opts = opts || {};
    var mode = projection(opts);
    var as = mode ? PROJECTIONS[mode] : (opts.as || 'row');
    var full = as === 'tile' || as === 'flag';
    var tag = full || mode === 'mini' ? 'article' : 'button';
    var n = doc.createElement(tag);
    if (tag === 'button') n.type = 'button';
    n.className = 'ow-ocard ow-ocard--' + as + (full ? ' ow-popit' : '') + (opts.className ? ' ' + opts.className : '');
    n.setAttribute('data-kind', card.kind);
    n.setAttribute('data-projection', mode || (full ? 'expanded' : as === 'chip' ? 'legacy-chip' : as === 'row' ? 'mini' : 'suggestion'));
    n.setAttribute('data-ref', card.id || '');
    n.setAttribute('data-v', card.v || '');
    n.setAttribute('aria-label', 'Open ' + card.title);
    markRoot(n, card, as);
    if (tag === 'article') n.tabIndex = 0;
    n.innerHTML = html(card, opts);
    if (card.information_center) [].forEach.call(n.querySelectorAll('.ow-ocard__face'), function (box) { informationFace(box,card); });
    if (mode !== 'micro' && opts.actions && opts.actions.length) {
      var acts = actionsNode(card, opts.actions);
      if (acts) {
        if (tag === 'button') { throw new Error('Actions require a tile, a flag, or an expanded, standard, full or mini projection'); }
        /* the actions are the header's: in its grid, after the name, the handle and the counts and before the about row
           (spec K7); a mini row ends with them */
        var grid = mode === 'mini' || !n.querySelector ? null : n.querySelector('.ow-ocard__top');
        var about = grid && grid.querySelector(':scope > .ow-ocard__summary');
        if (grid) grid.insertBefore(acts, about || null); else n.appendChild(acts);
      }
    }
    if (full && opts.events) {
      var evs = eventsNode(card, opts);
      if (evs) n.appendChild(evs);
    }
    paint(n, card.information_center && OW.placeRow ? {h1:OW.placeRow.paint(card.category).rgb,h2:OW.placeRow.paint(card.category).rgb}:card.hue);
    if (opts.onOpen !== false) {
      /* A CARD WITH NO ACTIONS IS ITSELF THE PRESS: it opens the profile, a link inside it its own link */
      var go = function (e) {
        var control = e && e.target && e.target.closest ? e.target.closest('a,button') : null;
        if (control && control !== n) return;
        (opts.onOpen || open)(card, n);
      };
      n.addEventListener('click', go);
      if (tag === 'article') n.addEventListener('keydown', function (e) { if (e.target === n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(e); } });
    }
    identityReady(n.querySelector('.ow-ocard__top') || n,'.ow-ocard__face img');
    countsSoon(false);
    return n;
  }

  /* `into` fills an existing interactive host without nesting buttons or losing its listeners. */
  /* READ, DRAW, AND STAY TRUE: the platform's announcement of any change is a reason to ask again (S22) */
  function mount(host, kind, ref, opts) {
    opts = opts || {};
    var key = kind + ':' + ref;
    function draw() {
      var asCard = opts.as === 'card';
      return readOne(key, asCard ? 'showcase' : !!opts.include).then(function (card) {
        if (!card) { if (opts.onMissing) opts.onMissing(host); return null; }
        if (asCard) {
          var was = host.firstChild;
          if (was && was.getAttribute && was.getAttribute('data-v') === (card.v || '') && was.getAttribute('data-live-ref')) { if (opts.onCard) opts.onCard(card, was); return card; }
          var c = theCard(card, opts);
          if (c.setAttribute) c.setAttribute('data-v', card.v || '');
          host.innerHTML = '';
          host.appendChild(c);
          if (opts.onCard) opts.onCard(card, c);
          return card;
        }
        if (opts.into) {
          var mode = projection(opts), as = mode ? PROJECTIONS[mode] : (opts.as || 'row');
          host.innerHTML = html(card, opts);
          host.classList.add('ow-ocard', 'ow-ocard--' + as);
          host.setAttribute('data-projection', mode || (as === 'tile' || as === 'flag' ? 'expanded' : 'legacy'));
          host.setAttribute('data-kind', card.kind);
          host.setAttribute('data-v', card.v || '');
          host.setAttribute('aria-label', 'Open ' + card.title);
          markRoot(host, card, as);
          paint(host, card.information_center && OW.placeRow ? {h1:OW.placeRow.paint(card.category).rgb,h2:OW.placeRow.paint(card.category).rgb}:card.hue);
          identityReady(host.querySelector('.ow-ocard__top') || host,'.ow-ocard__face img');
          if (opts.onCard) opts.onCard(card, host);
          return card;
        }
        var n = node(card, opts);
        if (host.firstChild && host.firstChild.getAttribute && host.firstChild.getAttribute('data-v') === n.getAttribute('data-v')) {
          if (opts.onCard) opts.onCard(card, host.firstChild);
          return card;
        }
        host.innerHTML = '';
        host.appendChild(n);
        if (opts.onCard) opts.onCard(card, n);
        return card;
      });
    }
    var first = draw();
    if (OW.changes && OW.changes.on) OW.changes.on(host, function () { forget(); draw(); });
    return first;
  }

  /* A DETAIL'S ICON NAMES ITS ROLE, ONE RULE FOR THE CARD AND THE PROFILE (founder/835's screenshot: "the details on the right
     line by line with an icon each"; the founder, 2026-10-19: the info "always on right side weather its card or profile ...
     in that one clean list"). The shared set's glyph (OW.glyph); a label no role is known for gets a quiet dot, never an
     icon that says something it does not. */
  var ROLE = [
    [/^(open|hours|times?|classes|schedule|daily)$/i, 'clock'],
    [/^(season|dates?|events?|showcase|when)$/i, 'event'],
    [/^(vendors|members|ages|capacity|staff|team|seats|guests)$/i, 'people'],
    [/^(price|prices|lessons|from|fees?|rates?|cost|first class|tickets?|entry)$/i, 'tag'],
    [/^(rentals|shop|menu|serves|sells|offers?|styles?)$/i, 'cart'],
    [/^(parking)$/i, 'parking'],
    [/^(pays|payment|payments)$/i, 'card'],
    [/^(address|place|location|where)$/i, 'place'],
    [/^(website|site|web)$/i, 'globe'],
    [/^(phone|call)$/i, 'phone'],
    [/^(email|mail)$/i, 'mail']
  ];
  function detailIcon(label) {
    var name = '';
    ROLE.some(function (r) { if (r[0].test(String(label || '').trim())) { name = r[1]; return true; } return false; });
    var svg = name && OW.glyph ? OW.glyph(name) : '';
    return svg || '' + OW.glyph('dot-outline') + '';
  }

  /* THE PLATFORMS, ONE STRAIGHT LINE (the founder, 2026-10-19: "cards do not stop at 4 icons then go down to next row but should
     be straight clean line on profile and card"): a row of marks never wraps. This says what the row's sheet needs to draw it:
     how many marks it holds (`data-n`, the sheet steps the size down past what fits), whether they run past its edge
     (`data-overflow`), and where its sideways scroll stands (`data-at`: start, middle, end), so the edge fades only where there
     is more to see. One helper for the card and the profile; idempotent. */
  function lineMarks(row) {
    if (!row || row.__owLine) return row;
    row.__owLine = 1;
    row.setAttribute('data-n', String(row.children.length));
    var said = function () {
      var over = row.scrollWidth > row.clientWidth + 1;
      row.setAttribute('data-overflow', over ? '1' : '0');
      var x = row.scrollLeft, end = row.scrollWidth - row.clientWidth - 1;
      row.setAttribute('data-at', !over ? 'all' : x <= 1 ? 'start' : x >= end ? 'end' : 'middle');
    };
    row.addEventListener('scroll', said, { passive: true });
    if (global.ResizeObserver) new global.ResizeObserver(said).observe(row);
    else global.requestAnimationFrame && global.requestAnimationFrame(said);
    return row;
  }

  /* THE ONE EVENT CARD (founder/981, unit 7: "the photo, the local time, a from price or Free, the venue, the ticket or
     RSVP act, sold out and N dates"). Its words and its markup are made once, with the event, at the source
     (api/oneway/cards/event_card.py, carried as `card` on each event a read returns), and every surface places that
     card: the written site and the embed as it is, the App and the OS here. Its look is
     frontend/shared/oneway-event-card.css. A surface never draws an event itself (api/oneway/cards/test_event_card.py).
       OW.cards.event(card, { onOpen(card, node), onAct(card, node, act) })   an element; null when there is no card
       OW.cards.events(cards, opts)                                         the list (.ow-ecards); null when empty
     The title opens the event and the act acts; with no handler each is the link it is (the event's page, its tickets).
     A sold-out act does nothing, and a tickets link always goes where the Center sells them. */
  function eventCard(card, opts) {
    opts = opts || {};
    var box = doc.createElement('div');
    box.innerHTML = (card && card.html) || '';
    var n = box.firstElementChild;
    if (!n) return null;
    var im = n.querySelector('.ow-ecard__media img');
    if (im && OW.imageUrl && card.photo) { var src = OW.imageUrl(card.photo); if (src) im.src = src; }
    if (im) im.addEventListener('error', function () {
      var m = im.parentNode; if (m && m.parentNode) m.parentNode.removeChild(m);
      n.classList.add('ow-ecard--text');
    });
    n.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a,[data-act]') : null;
      if (!a || !n.contains(a)) return;
      var isAct = a.classList.contains('ow-ecard__act');
      if (isAct && (a.hasAttribute('aria-disabled') || (card.act || {}).away)) return;
      var fn = isAct ? (opts.onAct || opts.onOpen) : opts.onOpen;
      if (typeof fn !== 'function') return;
      ev.preventDefault();
      fn(card, n, isAct ? card.act : null);
    });
    return n;
  }
  function eventCards(cards, opts) {
    var list = doc.createElement('div'); list.className = 'ow-ecards';
    (cards || []).forEach(function (c) { var n = c && eventCard(c, opts); if (n) list.appendChild(n); });
    return list.childNodes.length ? list : null;
  }

  /* ═══ TRENDING, THE SERVER'S ONE COUNT (founder/1209 Q19: near me, my city, everywhere; founder/1261: "posts get marked as trending ... they get a
     blue X in trending label on the post card but has to look good") ═════════════════════════════════════════════════════════════
     A post's card says "#N in Trending" when the server's board has it (api/oneway/map/trending.py, GET /api/oneway/map/sheet/trending?posts=): the
     same number for everyone, on any page, whether or not Discovery was opened on this device, and only for a post inside the board's time window.
     Cards ask together (one read for a page of them, TREND_ASK_MAX ids a read) and an answer is kept TREND_KEEP_MS on this device. A card draws an
     empty slot until the answer lands; nothing is ever drawn for a post the board does not rank. `tags` and `count` are the search's own reading
     of the posts already on the screen; neither is a rank. */
  var TREND_DOOR = '/api/oneway/map/sheet/trending', TREND_ASK_MAX = 30, TREND_WAIT_MS = 120, TREND_KEEP_MS = 300000;
  var trendKept = {}, trendAsk = {}, trendTimer = 0;
  function trendTags(item) {
    item = item || {};
    var t = item.hashtags || item.tags || [];
    if (typeof t === 'string') t = t.split(/[\s,]+/);
    if (!Array.isArray(t)) t = [];
    var text = [item.title, item.text, item.body, item.caption, item.description].filter(Boolean).join('\n');
    var found = (text.match(/(?:^|[\s(])#\p{L}[\p{L}\p{N}_-]{1,39}/gu) || []).map(function (w) { return w.replace(/^[\s(]*#/, ''); });
    var seen = {};
    return t.concat(found).map(function (x) { return String(x).replace(/^#/, '').toLowerCase(); }).filter(function (x) { return x && !seen[x] && (seen[x] = 1); });
  }
  function trendCount(items) {
    var n = {};
    (items || []).forEach(function (p) { trendTags(p).forEach(function (t) { n[t] = (n[t] || 0) + 1; }); });
    return Object.keys(n).map(function (t) { return { tag: t, count: n[t] }; })
      .sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
  }
  function trendId(item) { return String((item && (item.post_id || item.id)) || ''); }
  function trendHTML(r) {
    var where = r.reach === 'all' ? 'everywhere' : (r.where ? 'in ' + r.where : 'in this area');
    var said = r.by === 'post' ? 'Number ' + r.rank + ' of the posts trending ' + where : 'Number ' + r.rank + ' in Trending ' + where + ': #' + r.tag + ', ' + r.count + ' posts';
    return '<span class="ow-trend" data-rank="' + r.rank + '" data-by="' + esc(r.by || '') + '" data-reach="' + esc(r.reach || '') + '" data-tag="' + esc(r.tag || '') + '" title="' + esc(said) + '">' +
      '' + OW.glyph('trend-up') + '<span>#' + r.rank + ' in Trending</span></span>';
  }
  function trendFresh(id) { var k = trendKept[id]; return k && Date.now() - k.at < TREND_KEEP_MS ? k : null; }
  function trendFill(id) {
    var k = trendKept[id];
    document.querySelectorAll('[data-ow-trend-slot="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach(function (s) {
      var up = s.parentNode;
      if (k && k.r) { s.outerHTML = trendHTML(k.r); if (up && up.hidden && up.classList.contains('ow-post__trend')) up.hidden = false; } else s.remove();
    });
  }
  function trendRead() {
    var ids = Object.keys(trendAsk).slice(0, TREND_ASK_MAX);
    ids.forEach(function (id) { delete trendAsk[id]; });
    trendTimer = Object.keys(trendAsk).length ? setTimeout(trendRead, TREND_WAIT_MS) : 0;
    if (!ids.length) return;
    if (!OW.data || !OW.data.get) return;
    OW.data.get(TREND_DOOR + '?posts=' + encodeURIComponent(ids.join(',')))
      .then(function (r) {
        if (!r || !r.ok || !r.data) return;   /* unread stays unsaid: never a rank that was not read, and a later card may ask again */
        var ranks = r.data.ranks || {}, at = Date.now();
        ids.forEach(function (id) { trendKept[id] = { at: at, r: ranks[id] || null }; trendFill(id); });
      }, function () {});
  }
  function trendOf(item) { var k = trendFresh(trendId(item)); return k ? k.r : null; }
  function trendChip(item) {
    var id = trendId(item); if (!id) return '';
    var k = trendFresh(id);
    if (k) return k.r ? trendHTML(k.r) : '';
    trendAsk[id] = 1; if (!trendTimer) trendTimer = setTimeout(trendRead, TREND_WAIT_MS);
    return '<span class="ow-trend-slot" data-ow-trend-slot="' + esc(id) + '" hidden></span>';
  }
  OW.trending = { tags: trendTags, count: trendCount, of: trendOf, chip: trendChip };

  OW.wordmark = { html: wordmarkHTML, draw: wordmarkDraw, has: function (who) { return !!wmLogo(who); }, MIN_PX: WM_MIN_PX };
  OW.cards = { card: theCard, smart: smartHTML, worthSuggesting: worthSuggesting, fit: fitCard, ready: cardReady, informationFace: informationFace, event: eventCard, events: eventCards, number: number, lineMarks: lineMarks, detailIcon: detailIcon, read: read, deck: deck, html: html, face: face, fill: fill, inside: inside, node: node, mount: mount, forget: forget,
    identityReady: identityReady, nameHTML:nameHTML, identityHTML: identityHTML, noteHTML: noteHTML, informationHTML: informationHTML, countsHTML: countsHTML, cardKey: cardKey, refreshCounts: refreshCounts, setCount: setCount, counts: counts, countWords: countWords,
    linksHTML: linksHTML, linksInner: linksInner, directions: directions, handle: handleOf, handleLine: handleLine,
    sayOnce: sayOnce, shortPlace: shortPlace, mark: mark, menu: menu, menuStep: menuStep, menuSay: menuSay };
})(window);
