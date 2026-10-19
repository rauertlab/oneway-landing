/* THE LANDING'S CARDS (frontend/landing/landing-cards.css says what they are): OW.lcard(card) is the one renderer's tile with
   what a social header carries and the tile does not (where it is, Follow and Message), for the landing's decks. An example
   card opens nothing (founder, 2026-10-17: "its alright if nothings clickable").
   THE CLEAN CARD (founder/835, 836, 2026-10-18: "a clean design for the cards", his screenshot of a Center card, and "want to
   do banners on cards correctly"). In this order: the account's banner across the card's top when it has a picture, the face
   over the banner's lower edge; the name, the handle small under it, a Center's categories; the counts in one row with
   hairlines between; the bio at the left with the platforms under it, a Center's details at the right, line by line, an
   icon each, its place last; Follow filled and Message outlined. The same anatomy in Pop-it and Simple mode; only the
   material differs (landing-cards.css). The renderer draws the face, the name, the handle, the counts, the bio and the
   platforms (OW.cards); this file only places them. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function glyphOf(label) { return OW.cards.detailIcon(label); }   /* the one rule (oneway-cards.js) */
  /* THE BANNER, ONLY A PICTURE (founder/824's "No picture, no banner", which 836 keeps): the account's own photograph,
     across the card's top. A card with none starts at its face. */
  function bannerUrl(c) {
    var b = c && c.banner, u = b && b.url ? String(b.url) : '';
    return /^(\/|https:\/\/)/.test(u) ? (OW.imageUrl ? OW.imageUrl(u) : u) : '';
  }
  OW.lcard = function (c) {
    var el = OW.cards.node(c, { as: 'tile', className: 'lc', onOpen: false });
    var kind = c.kind === 'person' ? 'person' : 'center';
    /* the renderer's hero is replaced by the card's own banner (drawn below), and nothing else of it stays */
    [].forEach.call(el.querySelectorAll('.ow-ocard__banner, .ow-banner, [class*="cover"]'), function (b) { b.remove(); });
    var hero = el.querySelector('.ow-ocard__hero');
    if (hero) { while (hero.firstChild) hero.parentNode.insertBefore(hero.firstChild, hero); hero.remove(); }
    el.setAttribute('data-layout', c.layout === 'above' ? 'above' : 'beside');
    /* the hue as an angle for this sheet's own tones; --h and --h2 stay the renderer's "r,g,b" pair, the one surface's light */
    var h = typeof c.hue === 'number' ? ((c.hue % 360) + 360) % 360 : 262;
    el.style.setProperty('--lc-h', h);
    /* Follow's words: dark on a light hue (cyan, green, amber), white on a deep one (blue to magenta) */
    el.setAttribute('data-ink', (h >= 215 && h <= 345) ? 'light' : 'dark');
    var top = el.querySelector('.ow-ocard__top');
    var id = el.querySelector('.ow-ocard__id');
    var summary = el.querySelector('.ow-ocard__summary');
    var bio = summary && summary.querySelector('.ow-ocard__bio');
    var links = summary && summary.querySelector('.ow-ocard__links');
    var counts = el.querySelector('.ow-ocard__counts');

    var pic = bannerUrl(c);
    el.setAttribute('data-banner', pic ? '1' : '0');
    /* the banner as the account chose it for its profile (founder/824): Fade melts into the card, Framed keeps its edge */
    el.setAttribute('data-banner-style', pic && c.banner && c.banner.style === 'fade' ? 'fade' : 'framed');
    if (pic) {
      var band = document.createElement('span'); band.className = 'lc-banner';
      band.innerHTML = '<img src="' + esc(pic) + '" alt="" loading="lazy" decoding="async">';
      el.insertBefore(band, el.firstChild);
    }
    /* a Center's categories under its handle, as Instagram sets a business's kind */
    if (kind === 'center' && c.category_label && id) {
      var cat = document.createElement('span');
      cat.className = 'lc-cat'; cat.textContent = (c.categories && c.categories.length ? c.categories : [c.category_label]).join(' · ');
      id.appendChild(cat);
    }
    /* THE COUNTS, ONE ROW UNDER THE HEAD, hairlines between: a person's posts, followers, following; a Center's posts,
       followers and events */
    var row = document.createElement('span'); row.className = 'lc-counts';
    if (counts) {
      if (kind === 'center' && c.counts && typeof c.counts.events === 'number') {
        var ev = document.createElement('span'); ev.className = 'ow-ocard__count'; ev.setAttribute('data-count', 'events');
        ev.innerHTML = '<b>' + Number(c.counts.events).toLocaleString('en-US') + '</b> ' + (c.counts.events === 1 ? 'event' : 'events');
        counts.appendChild(ev);
      }
      var order = { posts: 1, followers: 2, following: 3, events: 3 };
      [].slice.call(counts.children).sort(function (a, b) { return (order[a.getAttribute('data-count')] || 9) - (order[b.getAttribute('data-count')] || 9); })
        .forEach(function (n) {
          /* the number over its word: the word in its own span, so the two stand as one cell */
          var b = n.querySelector('b'), word = String(n.textContent || '').replace(b ? b.textContent : '', '').trim();
          n.innerHTML = (b ? b.outerHTML : '') + '<span>' + esc(word) + '</span>';
          row.appendChild(n);
        });
      counts.remove();
    }
    /* THE ABOUT ROW: the bio at the left, the platforms under it; a Center's details at the right, its place last */
    var about = document.createElement('span'); about.className = 'lc-about';
    var left = document.createElement('span'); left.className = 'lc-left';
    if (bio) left.appendChild(bio);
    if (!links && kind === 'center' && OW.cards.linksInner) {   /* a Center's platforms, here as on the compact card (founder/834) */
      var inner = OW.cards.linksInner(c, { centers: true });
      if (inner) { links = document.createElement('span'); links.className = 'ow-ocard__links ow-linkbar'; links.setAttribute('role', 'list'); links.innerHTML = inner; }
    }
    var place = OW.cards.shortPlace ? OW.cards.shortPlace(kind === 'person' ? (c.place || '') : (c.line || '')) : (kind === 'person' ? c.place : c.line);
    var facts = (c.details || []).filter(function (d) { return d && d.label && d.value; });
    /* THE INFORMATION, ALWAYS AT THE RIGHT, ONE CLEAN LIST (the founder, 2026-10-19: "i want the info to always be on right
       side weather its card or profile ... in that one clean list"): a Center's details line by line, then where it is, said
       as the Center row says it ("Location: Atlantic City, NJ"); a person's place the same way. Never a city on a line of
       its own under the bio. */
    if (place) facts = facts.filter(function (d) { return !/^(address|location|place)$/i.test(String(d.label)); })
      .concat([{ label: 'Location', value: place, place: true }]);
    if (facts.length) {
      var right = document.createElement('span'); right.className = 'lc-facts';
      right.innerHTML = facts.map(function (d) {
        return '<span class="lc-fact' + (d.place ? ' lc-fact--place' : '') + '" title="' + esc(d.label + ': ' + d.value) + '"><i class="lc-ic">' + glyphOf(d.place ? 'place' : d.label) +
          '</i><span><i>' + esc(d.label) + ':</i> <b dir="auto">' + esc(String(d.value).split('\n')[0]) + '</b></span></span>';
      }).join('');
      if (links) left.appendChild(OW.cards.lineMarks ? OW.cards.lineMarks(links) : links);
      about.appendChild(left); about.appendChild(right);
      about.setAttribute('data-cols', left.childNodes.length ? '2' : '1');
    } else {
      if (links) left.appendChild(OW.cards.lineMarks ? OW.cards.lineMarks(links) : links);
      about.appendChild(left);
      about.setAttribute('data-cols', '1');
    }
    if (summary) summary.remove();
    if (top) {
      top.parentNode.insertBefore(row, top.nextSibling);
      if (about.textContent.trim() || about.querySelector('a')) row.parentNode.insertBefore(about, row.nextSibling);
    }
    if (!row.childNodes.length) row.remove();
    var acts = document.createElement('span'); acts.className = 'lc-acts';
    acts.innerHTML = '<span class="lc-follow">Follow</span><span class="lc-msg">Message</span>';
    el.appendChild(acts);
    if (c.example) { el.setAttribute('data-example', '1'); el.removeAttribute('tabindex'); el.querySelectorAll('a').forEach(function (a) { a.removeAttribute('href'); a.setAttribute('tabindex', '-1'); }); }
    return el;
  };
})(window);
