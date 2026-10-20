/* LIVE ON EVERY CARD  (frontend/shared/oneway-live.js)

   ★ THE FOUNDER, 2026-10-20: "what about live activity on the app cause i acutally dont see that on the cards and its
     super important and better be built with all platforms that can support it".

   Every card on the page (OW.cards' .ow-ocard with its data-kind and data-ref, or anything carrying data-live-ref) is
   asked about in ONE read, GET /api/oneway/live?refs=... (api/oneway/live/service.py): a Center open now, closing soon,
   its event on now and how many are here (an anonymous count); an event live or starting; a person only as they chose
   to share. The answer is laid over the card's corner as a small pill, so nothing on the card moves when it arrives,
   changes or goes. Asked again every ttl_s while the page is in view, at once on any write (OW.changes), and when new
   cards are drawn. Where no platform answers (the published static copy of the landing), nothing is drawn and it
   stops asking.
   ★ ADDITIVE ONLY (the founder, 2026-10-20: "dont break cards ill be very angry"). The card is never written: no style,
     no attribute, nothing but the pill itself. The pill shows only in room the card already leaves empty (room()): laid
     over the card absolutely, wholly inside it, over no word, no picture and no control. A card with no such room (a
     static card, a round chip whose face fills it, a card whose own rules pull the pill into its flow) shows nothing,
     and is asked again on the next read and on a resize. So a card looks exactly as it did, or wears the pill in its
     empty corner.
   ES5, no :scope, no flex gap: the old engines (Safari 12) draw it too. The card renderers are not touched. */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || !doc.querySelectorAll) return;
  var OW = global.OW = global.OW || {};
  var SEL = '.ow-ocard[data-ref][data-kind],[data-live-ref]';
  var MAX = 40, ttl = 60000, timer = 0, busy = false, again = false, dead = false, misses = 0;

  function refOf(el) {
    var r = el.getAttribute('data-live-ref');
    if (r) return r;
    var k = el.getAttribute('data-kind'), id = el.getAttribute('data-ref') || '';
    if (!id) return '';
    if (k === 'center') return 'center:' + id;
    if (k === 'event') return 'event:' + id;
    if (k === 'person') return 'person:' + (id.charAt(0) === '@' ? id : '@' + id);
    return '';
  }

  function pillOf(el) {
    for (var i = 0; i < el.children.length; i++) if (el.children[i].className === 'ow-live') return el.children[i];
    return null;
  }

  function overlaps(a, b) {
    return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  }

  /* the pill's room: true only when it lies, absolutely, wholly inside the card and over nothing the card shows */
  function room(el, pill) {
    try {
      if (global.getComputedStyle(pill).position !== 'absolute') return false;   /* the card's own rules pulled it into the flow */
      var p = pill.getBoundingClientRect(), c = el.getBoundingClientRect();
      if (!(p.width > 0 && p.height > 0)) return false;
      if (p.left < c.left - 0.5 || p.top < c.top - 0.5 || p.right > c.right + 0.5 || p.bottom > c.bottom + 0.5) return false;
      var all = el.getElementsByTagName('*');
      for (var i = 0; i < all.length; i++) {
        var k = all[i];
        if (k === pill || pill.contains(k)) continue;
        var tag = String(k.tagName).toUpperCase();
        var pic = /^(IMG|PICTURE|VIDEO|CANVAS|SVG|IFRAME)$/.test(tag);
        var ctl = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(tag) || k.getAttribute('role') === 'button';
        if (!pic && !ctl) {
          var bg = global.getComputedStyle(k).backgroundImage;
          pic = !!bg && bg.indexOf('url(') >= 0;
        }
        if ((pic || ctl) && overlaps(p, k.getBoundingClientRect())) return false;
      }
      /* words: every visible line of text in the card, the pill's own aside */
      if (doc.createTreeWalker && doc.createRange) {
        var tw = doc.createTreeWalker(el, 4, null, false), t;
        while ((t = tw.nextNode())) {
          if (!/\S/.test(t.nodeValue) || pill.contains(t)) continue;
          var rg = doc.createRange(); rg.selectNodeContents(t);
          var rs = rg.getClientRects();
          for (var j = 0; j < rs.length; j++) if (rs[j].width > 0 && overlaps(p, rs[j])) return false;
        }
      }
      return true;
    } catch (e) { return false; }
  }

  function draw(el, live) {
    var pill = pillOf(el);
    var chip = live && live.chips && live.chips[0];
    if (!chip) { if (pill) { pill.removeAttribute('data-on'); } return; }
    /* a static card would have to be changed to carry a pill over it: it is left exactly as it is */
    try { if (global.getComputedStyle(el).position === 'static') { if (pill) el.removeChild(pill); return; } } catch (e) { return; }
    if (!pill) {
      pill = doc.createElement('span');
      pill.className = 'ow-live';
      pill.setAttribute('aria-live', 'polite');
      pill.appendChild(doc.createElement('i'));
      pill.appendChild(doc.createElement('b'));
      if (el.querySelector('.ow-ocard__overflow')) pill.setAttribute('data-beside', 'menu');
      el.appendChild(pill);
    }
    var words = live.line || chip.words;                          /* the first two things true now, e.g. "Live · Jazz · 2 here now" */
    if (pill.lastChild.textContent !== words) pill.lastChild.textContent = words;
    pill.setAttribute('title', words);
    pill.setAttribute('data-tone', chip.tone || 'quiet');
    pill.setAttribute('data-kind', chip.kind || '');
    /* measured while still invisible: no room on this card, no pill */
    if (!room(el, pill)) { el.removeChild(pill); return; }
    /* in on the next frame, so it fades rather than appears */
    if (!pill.getAttribute('data-on')) global.setTimeout(function () { if (pill.parentNode) pill.setAttribute('data-on', '1'); }, 30);
  }

  /* a resize can take a pill's room away (or give it): every pill is measured again, and the next read redraws */
  var resized = 0;
  global.addEventListener && global.addEventListener('resize', function () {
    global.clearTimeout(resized);
    resized = global.setTimeout(function () {
      var ps = doc.querySelectorAll('.ow-live');
      for (var i = 0; i < ps.length; i++) if (ps[i].parentNode && !room(ps[i].parentNode, ps[i])) ps[i].parentNode.removeChild(ps[i]);
      refresh();
    }, 250);
  });

  function ask(refs) {
    var path = '/api/oneway/live?refs=' + encodeURIComponent(refs.join(','));
    /* through the one data layer (oneway-data.js: its session, its base, its errors), never a fetch of our own */
    if (!OW.data || !OW.data.get) return Promise.resolve(null);
    return OW.data.get(path, { fresh: true }).then(function (r) { return (r && r.ok && r.data) ? r.data : null; });
  }

  function refresh() {
    if (dead) return;
    if (busy) { again = true; return; }
    var els = doc.querySelectorAll(SEL), byRef = {}, refs = [];
    for (var i = 0; i < els.length; i++) {
      var up = els[i].parentElement;
      if (up && up.closest && up.closest(SEL)) continue;          /* a card inside a card: the outer one carries the pill */
      var r = refOf(els[i]);
      if (!r) continue;
      if (!byRef[r]) { byRef[r] = []; refs.push(r); }
      byRef[r].push(els[i]);
    }
    if (!refs.length) return;
    busy = true;
    var batches = [];
    for (var j = 0; j < refs.length; j += MAX) batches.push(refs.slice(j, j + MAX));
    Promise.all(batches.map(function (b) { return ask(b).catch(function () { return null; }); })).then(function (answers) {
      var any = false;
      answers.forEach(function (a, n) {
        if (!a) return;
        any = true;
        if (a.ttl_s) ttl = Math.max(15, a.ttl_s) * 1000;
        var live = a.live || {};
        batches[n].forEach(function (ref) {
          (byRef[ref] || []).forEach(function (el) { draw(el, live[ref]); });
        });
      });
      /* a page with no platform behind it (the landing's published static copy) stops asking after three empty tries */
      if (any) misses = 0; else if (++misses >= 3) dead = true;
    }).then(function () {
      busy = false;
      if (again) { again = false; refresh(); }
    }, function () { busy = false; });
  }

  function soon(ms) { global.clearTimeout(timer); timer = global.setTimeout(tick, ms); }
  function tick() {
    if (doc.hidden) { soon(ttl); return; }
    refresh();
    soon(ttl);
  }

  /* add to OW.live, never replace it: frontend/app/popit-live.js keeps identity, myCenter, home and event there
     (d3f8c745 replaced the object and the App could not start: 'OW.live.identity is not a function') */
  OW.live = OW.live || {};
  OW.live.refresh = refresh;
  OW.live.drawn = function (el) { return pillOf(el); };

  function start() {
    soon(400);
    var t = 0;
    if (global.MutationObserver) {
      new global.MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var added = list[i].addedNodes;
          for (var k = 0; k < added.length; k++) {
            var n = added[k];
            if (n.nodeType === 1 && n.className !== 'ow-live' && (n.matches ? n.matches(SEL) || n.querySelector(SEL) : true)) {
              global.clearTimeout(t); t = global.setTimeout(refresh, 300); return;
            }
          }
        }
      }).observe(doc.body, { childList: true, subtree: true });
    }
    if (OW.changes && OW.changes.on) OW.changes.on(doc.body, refresh, { wait: 600 });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) soon(50); });
  }
  if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start);
})(window);
