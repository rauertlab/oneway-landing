/* THE LANDING'S CARDS (frontend/landing/landing-cards.css says what they are): OW.lcard(card) is the one renderer's tile with
   what a social header carries and the tile does not (where it is, Follow and Message), for the landing's decks. An example
   card opens nothing (founder, 2026-10-17: "its alright if nothings clickable"). */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  OW.lcard = function (c) {
    var el = OW.cards.node(c, { as: 'tile', className: 'lc', onOpen: false });
    /* A CARD CARRIES NO BANNER, in any style (founder/816, and 2026-10-17 on his own profile's header, which is this card:
       "cards we agreed shouldnt look like this"); a profile's banner is drawn behind the card, never in it.
       api/test_profile_header.py holds it. */
    [].forEach.call(el.querySelectorAll('.ow-ocard__banner, .ow-banner, [class*="cover"]'), function (b) { b.remove(); });
    el.setAttribute('data-layout', c.layout === 'above' ? 'above' : 'beside');
    if (typeof c.hue === 'number') el.style.setProperty('--h', c.hue);
    /* Follow's words: dark on a light hue (cyan, green, amber), white on a deep one (blue to magenta) */
    var h = typeof c.hue === 'number' ? ((c.hue % 360) + 360) % 360 : 262;
    el.setAttribute('data-ink', (h >= 215 && h <= 345) ? 'light' : 'dark');
    var summary = el.querySelector('.ow-ocard__summary') || el;
    var bio = summary.querySelector('.ow-ocard__bio');
    /* a Center's category under its name, grey, as Instagram sets a business's category; the pin says only where */
    if (c.kind !== 'person' && c.category_label) {
      var sub = el.querySelector('.ow-ocard__sub') || el.querySelector('.ow-ocard__name'), cat = document.createElement('span');   /* no handle yet: under the name */
      cat.className = 'lc-cat'; cat.textContent = (c.categories && c.categories.length ? c.categories : [c.category_label]).join(' · ');
      if (sub && sub.parentNode) sub.parentNode.insertBefore(cat, sub.nextSibling);
    }
    var where = esc(c.kind === 'person' ? (c.place || '') : (c.line || ''));
    /* A CENTER'S BUSINESS, BESIDE ITS BIO (founder, 2026-10-17: "make sure these centers ... still have the room to display
       information, like about their business, not just their location. It should fit nicely into the right dead space
       that the bio leaves"): its own details, a word over its value, in a column at the bio's right */
    if (c.kind !== 'person' && (c.details || []).length) {
      var facts = document.createElement('span'); facts.className = 'lc-facts';
      /* every detail the Center has, never a fixed three (founder, 2026-10-17: "cards adapt to how many pieces of info business
         has not only displaying three"): one to three stand in the column beside the bio; four or more flow in two columns under it */
      var n = (c.details || []).length;
      el.setAttribute('data-facts', n > 3 ? 'many' : 'few');
      facts.innerHTML = (c.details || []).map(function (d) {
        return '<span class="lc-fact"><i>' + esc(d.label) + '</i><b>' + esc(d.value) + '</b></span>'; }).join('');
      if (bio) { var pair = document.createElement('span'); pair.className = 'lc-pair'; bio.parentNode.insertBefore(pair, bio); pair.appendChild(bio); pair.appendChild(facts); }
    }
    if (where) {
      var w = document.createElement('span'); w.className = 'lc-where'; w.innerHTML = PIN + '<span>' + where + '</span>';
      var after = bio && bio.parentNode && bio.parentNode.classList.contains('lc-pair') ? bio.parentNode : bio;   /* under the bio and its column */
      if (after && after.parentNode) after.parentNode.insertBefore(w, after.nextSibling); else summary.appendChild(w);
    }
    /* a Center's third figure (its events), so its row of numbers is as full as a person's */
    if (c.kind !== 'person' && c.counts && typeof c.counts.events === 'number') {
      var row = el.querySelector('.ow-ocard__counts');
      if (row) { var ev = document.createElement('span'); ev.className = 'ow-ocard__count'; ev.setAttribute('data-count', 'events');
        ev.innerHTML = '<b>' + Number(c.counts.events).toLocaleString('en-US') + '</b> ' + (c.counts.events === 1 ? 'event' : 'events'); row.appendChild(ev); }
    }
    var acts = document.createElement('span'); acts.className = 'lc-acts';
    acts.innerHTML = '<span class="lc-follow">Follow</span><span class="lc-msg">Message</span>';
    el.appendChild(acts);
    if (c.example) { el.setAttribute('data-example', '1'); el.removeAttribute('tabindex'); el.querySelectorAll('a').forEach(function (a) { a.removeAttribute('href'); a.setAttribute('tabindex', '-1'); }); }
    return el;
  };
})(window);
