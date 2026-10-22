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
  if (OW.cards) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function url(v) { return OW.imageUrl ? OW.imageUrl(v) : String(v || ''); }
  function initials(n) {   /* OW.initials (oneway-popit.js) is the rule; where it is not loaded, the same rule: letters, never a sigil */
    if (OW.initials) return OW.initials(n);
    /* the first word's letter and the last word's, as OW.initials says it (it said only the first: "Ana Face" was "A" on
       every page without oneway-popit.js, the bar's face on the landing among them, founder/883) */
    var p = String(n || '').trim().split(/\s+/).map(function (w) { var m = w.match(/[\p{L}\p{N}]/u); return m ? m[0] : ''; }).filter(Boolean);
    return p.length ? (p[0] + (p.length > 1 ? p[p.length - 1] : '')).toUpperCase() : '';
  }
  function huePair(h) {
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
  var KEPT = {}, WAIT = null, QUEUE = [];
  var BATCH = 40;                       /* api/oneway/cards CARDS_PER_READ */

  function flush() {
    var refs = QUEUE.splice(0, QUEUE.length), jobs = [];
    WAIT = null;
    for (var i = 0; i < refs.length; i += BATCH) jobs.push(refs.slice(i, i + BATCH));
    jobs.forEach(function (group) {
      var want = group.map(function (g) { return g.ref; });
      var u = '/api/oneway/cards?refs=' + encodeURIComponent(want.join(','));
      if (group.some(function (g) { return g.include; })) u += '&include=events,people';
      fetch((OW.assetBase || '') + u, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { cards: {} }; })
        .catch(function () { return { cards: {} }; })
        .then(function (j) {
          var got = (j && j.cards) || {};
          group.forEach(function (g) {
            var c = got[g.ref] || null;
            if (c) KEPT[g.ref + (g.include ? '+' : '')] = c;
            g.done(c);
          });
        });
    });
  }

  function readOne(ref, include) {
    var k = ref + (include ? '+' : '');
    if (KEPT[k]) return Promise.resolve(KEPT[k]);
    return new Promise(function (resolve) {
      QUEUE.push({ ref: ref, include: !!include, done: resolve });
      if (!WAIT) WAIT = setTimeout(flush, 12);
    });
  }

  function forget() { KEPT = {}; }
  /* a write anywhere is news to a card: it is asked again the next time it is drawn (and mounted ones redraw below) */
  doc.addEventListener('ow:changed', forget);

  function read(refs, opts) {
    var inc = !!(opts && opts.include);
    var list = (refs || []).filter(Boolean);
    return Promise.all(list.map(function (r) { return readOne(r, inc); })).then(function (all) {
      var out = {};
      list.forEach(function (r, i) { if (all[i]) out[r] = all[i]; });
      return out;
    });
  }

  function deck(kind, n) {
    var u = '/api/oneway/cards/deck?kind=' + encodeURIComponent(kind || 'person') + '&n=' + (n || 4);
    return fetch((OW.assetBase || '') + u, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { cards: [] }; })
      .then(function (j) { return (j && j.cards) || []; })
      .catch(function () { return []; });
  }

  /* ── WHAT A FACE HOLDS, DECIDED ONCE (S21) ──────────────────────────────────────────────────────────────────────
     The picture when there is one; with none, a person is their outline (OW.faceMark, founder/495) and anything else
     its letters. Every face on the platform asks this, through face() (a card's whole face) or fill() (a surface's
     own holder, which keeps its class, its size and its place: the profile header's .ow-avatar is one), so the rule is
     kept in one place. `who`: {kind, name, picture}; `opts.letters`: 'i' to set the letters in an <i>, as a card's
     face and some holders do; `opts.img`: the picture's further attributes, as written. */
  function inside(who, opts) {
    who = who || {}; opts = opts || {};
    var src = who.picture ? url(who.picture) : '';
    if (src) return '<img src="' + esc(src) + '" alt=""' + (opts.img || '') + '>';
    /* no picture: the initials on its own colour, a person's as a Center's (founder/816: "all default profile pictures
       platform-wide should look like this"; founder/495's outline is retired) */
    /* a surface whose letters are not a name's initials (a destination's first letters) names them; the rule still
       decides when letters are what a face holds */
    var ini = esc(who.letters != null ? who.letters : initials(who.name));
    return opts.letters === 'i' ? '<i>' + ini + '</i>' : ini;
  }
  /* a surface's own holder, filled by the rule: nothing on the holder itself is touched */
  function fill(box, who, opts) {
    if (box) box.innerHTML = inside(who, opts);
    return box;
  }

  /* ── THE PARTS ────────────────────────────────────────────────────────────────────────────────────────────── */
  /* THE FACE. Always a circle (S14), whatever shape the read reports: the profile header draws every face round
     (pages.js), and a card is that header (spec K3, M12). `data-shape` still says what the account chose. */
  function face(card, cls) {
    var pic = card.picture || {};
    var kind = kindOf(card);
    var shape = /^(round|rounded|square)$/.test(pic.shape || '') ? pic.shape : 'round';
    var ini = initials(card.title);
    var inner = inside({ kind: kind, name: card.title, picture: pic.url },
                       { letters: 'i', img: ' loading="lazy" decoding="async" onerror="OW.faceFail&&OW.faceFail(this)"' });
    return '<span class="ow-ocard__face ' + (cls || '') + '" data-shape="' + esc(shape) + '" data-kind="' + kind + '" data-ini="' + esc(ini) + '">' + inner + '</span>';
  }

  /* HERE NOW, ON A SLIM CARD (founder/863: "show users online status in messaging and cards slim ones"): the green dot
     Messages draws, bottom-right of the face, when the read says this person is online (cards/service._here_now: only to
     someone they let see it). The face clips what it holds, so the dot sits beside it in a holder of the face's size. */
  function slimFace(card) {
    if (!card || card.presence !== 'online' || kindOf(card) !== 'person') return face(card);
    return '<span class="ow-ocard__faceon">' + face(card) + '<i class="ow-ocard__on" role="img" aria-label="Online"></i></span>';
  }

  /* THE COUNTS, right under the name and the handle (ASKS rows 10-11, PLAN §3.4 item 5): followers first and always, a
     0 included, then posts, then (a person) following. Never members, whatever a read carries. A part the read could
     not make (`unreadable: ['counts']`) is not drawn at all: no number is better than a silent 0 (founder/658).
     `counts(card)` is the list ({key, n, word}); the profile header draws its own row from it (pages.js), so the
     header and every card say the same numbers in the same order with the same words. */
  var COUNTS = { center: ['followers', 'posts'], person: ['followers', 'posts', 'following'] };
  var COUNT_WORDS = { followers: ['follower', 'followers'], posts: ['post', 'posts'], following: ['following', 'following'] };
  function number(n) { try { return Number(n).toLocaleString('en-US'); } catch (_) { return String(n); } }
  function counts(card) {
    if (!card || (card.unreadable || []).indexOf('counts') >= 0) return [];
    var c = card.counts || {}, out = [];
    COUNTS[kindOf(card)].forEach(function (k) {
      var n = c[k];
      if (typeof n !== 'number' || !isFinite(n)) return;
      out.push({ key: k, n: n, text: number(n), word: COUNT_WORDS[k][n === 1 ? 0 : 1] });
    });
    return out;
  }
  function countWords(k, n) { return COUNT_WORDS[k] ? COUNT_WORDS[k][n === 1 ? 0 : 1] : ''; }
  function countsHTML(card) {
    var out = counts(card).map(function (x) {
      return '<span class="ow-ocard__count" data-count="' + x.key + '"><b>' + esc(x.text) + '</b> ' + x.word + '</span>';
    }).join('');
    return out ? '<span class="ow-ocard__counts">' + out + '</span>' : '';
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
      return '<span class="ow-ocard__banner ow-banner"' + attrs + '><img src="' + esc(url(b.url)) + '" alt="" loading="lazy" decoding="async">' +
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
  function identityHTML(card, opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'ow-ocard', heading = opts.heading ? 'h1' : 'span';
    var site = opts.website === true ? websiteOf(card) : null;
    var line = opts.secondary === false ? '' : site ? site.label : (opts.line != null ? opts.line : handleLine(card));
    var said = site ? { title: card.title || '', line: line } : sayOnce(card.title || '', line, kindOf(card));
    var nameClass = prefix + '__name', subClass = prefix === 'ow-prof' ? 'ow-prof__handle' : prefix + '__sub';
    return (prefix === 'ow-ocard' && opts.note !== false ? noteHTML(card.note, opts.noteSize || 'card') : '') + '<' + heading + ' class="' + nameClass + '" dir="auto" title="' + esc(said.title) + '">' + esc(said.title) + '</' + heading + '>' +
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
  function placeOf(card) { return shortPlace(card.kind === 'person' ? card.place : card.line) || ''; }
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
  function aboutHTML(card) {
    var text = bioOf(card);
    var bio = text ? '<span class="ow-ocard__bio" dir="auto">' + esc(text) + '</span>' : '';
    var rows = informationHTML(card);
    var icons = linksHTML(card);
    var info = rows || icons ? '<span class="ow-ocard__info">' + rows + icons + '</span>' : '';
    return bio || info ? '<span class="ow-ocard__summary' + (bio ? '' : ' ow-ocard__summary--no-bio') + '" data-kind="' + kindOf(card) + '">' + bio + info + '</span>' : '';
  }

  /* THE HEAD: the banner, and over its foot the header's grid: the face, beside it (or under it) the name, the handle
     line and the counts; the actions go in after them (node()); the about row last. */
  function layoutOf(card) { return card.layout === 'above' ? 'above' : 'beside'; }
  function headHTML(card, full) {
    var lay = layoutOf(card);
    var top = '<span class="ow-ocard__top" data-layout="' + lay + '" data-kind="' + kindOf(card) + '">' + face(card) +
      '<span class="ow-ocard__id">' + identityHTML(card) + (full ? countsHTML(card) : '') + '</span>' +
      (full ? aboutHTML(card) : '') + '</span>';
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
      identityHTML(card, { line: handleOf(card), noteSize: 'sm' }) + '</span>' + compactAside(card);
    if (as === 'simple') {
      return '<span class="po-card__face" aria-hidden="true"></span>' + face(card) + '<span class="ow-ocard__id">' + identityHTML(card, { line: handleOf(card), noteSize: 'sm' }) + '</span>';
    }
    if (mode === 'standard') {
      var sctx = contextHTML(card, false);
      return headHTML(card, false) + (sctx ? '<span class="ow-ocard__context">' + sctx + '</span>' : '');
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
  function actionsNode(card, list) {
    var row = doc.createElement('div');
    row.className = 'ow-ocard__actions';
    (list || []).forEach(function (action) {
      if (!action || typeof action.onPress !== 'function') return;
      var icon = action.icon ? mark(action.icon) : '';
      if (!action.label && !icon) return;
      var button = doc.createElement('button');
      button.type = 'button';
      button.className = (action.kind === 'primary' ? 'ow-btn' : 'ow-btn ow-btn--outline') + (icon ? ' ow-ocard__overflow' : '');
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
        else global.location.href = '/oneway-app.html#event/' + encodeURIComponent(e.id);
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
    paint(n, card.hue);
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
    return n;
  }

  /* `into` fills an existing interactive host without nesting buttons or losing its listeners. */
  /* READ, DRAW, AND STAY TRUE: the platform's announcement of any change is a reason to ask again (S22) */
  function mount(host, kind, ref, opts) {
    opts = opts || {};
    var key = kind + ':' + ref;
    function draw() {
      return readOne(key, !!opts.include).then(function (card) {
        if (!card) { if (opts.onMissing) opts.onMissing(host); return null; }
        if (opts.into) {
          var mode = projection(opts), as = mode ? PROJECTIONS[mode] : (opts.as || 'row');
          host.innerHTML = html(card, opts);
          host.classList.add('ow-ocard', 'ow-ocard--' + as);
          host.setAttribute('data-projection', mode || (as === 'tile' || as === 'flag' ? 'expanded' : 'legacy'));
          host.setAttribute('data-kind', card.kind);
          host.setAttribute('data-v', card.v || '');
          host.setAttribute('aria-label', 'Open ' + card.title);
          markRoot(host, card, as);
          paint(host, card.hue);
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
    return svg || '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/></svg>';
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

  OW.cards = { lineMarks: lineMarks, detailIcon: detailIcon, read: read, deck: deck, html: html, face: face, fill: fill, inside: inside, node: node, mount: mount, forget: forget,
    identityHTML: identityHTML, noteHTML: noteHTML, informationHTML: informationHTML, countsHTML: countsHTML, counts: counts, countWords: countWords,
    linksHTML: linksHTML, linksInner: linksInner, directions: directions, handle: handleOf, handleLine: handleLine,
    sayOnce: sayOnce, shortPlace: shortPlace, mark: mark };
})(window);
