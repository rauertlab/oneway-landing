/* ONEWAY — THE LINK BAR  (frontend/shared/oneway-links.js)

   ★ FOUNDER/442, 2026-09-19: *"make like just one link bar genuinely one
     link bar that people could prominently put … it should know platforms and
     have accurate icons for each platform. It shouldn't be like just a random
     template. And yeah, events could be an icon in this category."*

   ONE BAR, ONE ROW OF ICONS. A Center's (or a person's) links — its website,
   its Instagram, its X, its TikTok, its Spotify — drawn as the platform's
   own mark, recognised from the URL and never from a label somebody typed.
   The bar also carries the two acts that are really links: Events (the
   Center's own calendar) and Directions (the person's own maps app).

   NO EMOJIS (S1), no images fetched from anyone: every mark is an inline
   SVG path, drawn in the Center's ink, so the bar belongs to the page it is
   on. A platform this file does not know gets the globe and its hostname as
   the title — never a broken square.

   THIS IS THE UNIVERSAL PART. Founder/442 addendum: *"those types of layouts
   should be universal, everything else should be unique."* Every Center
   wears this bar in the same place; what the bar links to is its own. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  if (OW.links) return;
  var doc = global.document;

  /* host -> platform. Order matters where one host is a prefix of another. */
  var PLATFORMS = [
    ['instagram.com',        'instagram',  'Instagram'],
    ['threads.net',          'threads',    'Threads'],
    ['x.com',                'x',          'X'],
    ['twitter.com',          'x',          'X'],
    ['tiktok.com',           'tiktok',     'TikTok'],
    ['youtube.com',          'youtube',    'YouTube'],
    ['youtu.be',             'youtube',    'YouTube'],
    ['facebook.com',         'facebook',   'Facebook'],
    ['fb.com',               'facebook',   'Facebook'],
    ['open.spotify.com',     'spotify',    'Spotify'],
    ['spotify.com',          'spotify',    'Spotify'],
    ['music.apple.com',      'applemusic', 'Apple Music'],
    ['soundcloud.com',       'soundcloud', 'SoundCloud'],
    ['linkedin.com',         'linkedin',   'LinkedIn'],
    ['snapchat.com',         'snapchat',   'Snapchat'],
    ['wa.me',                'whatsapp',   'WhatsApp'],
    ['whatsapp.com',         'whatsapp',   'WhatsApp'],
    ['t.me',                 'telegram',   'Telegram'],
    ['telegram.me',          'telegram',   'Telegram'],
    ['bsky.app',             'bluesky',    'Bluesky'],
    ['discord.gg',           'discord',    'Discord'],
    ['discord.com',          'discord',    'Discord'],
    ['twitch.tv',            'twitch',     'Twitch'],
    ['pinterest.com',        'pinterest',  'Pinterest'],
    ['reddit.com',           'reddit',     'Reddit'],
    ['github.com',           'github',     'GitHub'],
    ['linktr.ee',            'linktree',   'Linktree'],
    ['maps.google.com',      'maps',       'Google Maps'],
    ['goo.gl/maps',          'maps',       'Google Maps'],
    ['maps.apple.com',       'maps',       'Apple Maps'],
    ['opentable.com',        'opentable',  'OpenTable'],
    ['resy.com',             'resy',       'Resy'],
    ['yelp.com',             'yelp',       'Yelp'],
    ['tripadvisor.com',      'tripadvisor','Tripadvisor'],
    ['eventbrite.com',       'eventbrite', 'Eventbrite']
  ];

  /* ── THE MARKS ──────────────────────────────────────────────────────────
     ★ FOUNDER/447, 2026-09-20: *"fix all icons and make them all more
       detailed smh and i dont need big box buttons all around them so space
       them more evenly."*

     A platform's mark is the platform's own — the brand glyph as it draws
     itself, filled, 24×24 — taken from Simple Icons (CC0 1.0, v16.32.0),
     not re-drawn from memory as two strokes. Where no brand mark exists
     (a site, a phone, an address, our own Events and Directions, a table
     at OpenTable/Resy) the mark is ours and just as substantial: a filled
     shape with its detail cut out, never a hairline outline.

     `fill` marks are painted in currentColor; nothing here is an image. */
  /* THE TABLE ITSELF IS IN oneway-link-marks.js (web/perf, 2026-11-02, founder/1154): 12 of this file's 13 KB, in every boot, and no first
     screen needs it before it has painted. It is asked for when the page is idle, or by the first mark drawn before that: that mark has its
     box at once and its shape when the table lands. MARK_KEYS is what the table holds, so a key is known before it is here. */
  var MARK_KEYS = {}; 'bluesky mastodon instagram threads x tiktok youtube facebook spotify applemusic soundcloud linkedin snapchat whatsapp telegram discord twitch pinterest reddit github linktree maps yelp tripadvisor eventbrite web email phone events directions opentable resy'.split(' ').forEach(function (k) { MARK_KEYS[k] = 1; });
  var MARKS = null, marksAsked = false;
  function fillMarks() {
    MARKS = OW.__linkMarks || MARKS;
    if (!MARKS) return;
    try { [].forEach.call(doc.querySelectorAll('path[data-ow-mk]'), function (p) { p.setAttribute('d', MARKS[p.getAttribute('data-ow-mk')] || ''); p.removeAttribute('data-ow-mk'); }); } catch (e) {}
  }
  function askMarks() {
    if (marksAsked) return;
    marksAsked = true;
    try {
      var named = doc.querySelector('script[type="text/ow-lazy"][data-name="linkmarks"]'), s = doc.createElement('script');
      s.src = named ? named.getAttribute('src') : '/frontend/shared/oneway-link-marks.js';
      /* a mark built while the table travelled may have joined the page after it landed, hence the later passes */
      s.onload = function () { fillMarks(); setTimeout(fillMarks, 400); setTimeout(fillMarks, 2000); };
      s.onerror = function () { marksAsked = false; };
      doc.head.appendChild(s);
    } catch (e) { marksAsked = false; }
  }
  function markSvg(key) {
    if (!MARKS) { MARKS = OW.__linkMarks || null; if (!MARKS) askMarks(); }
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path ' + (MARKS ? '' : 'data-ow-mk="' + key + '" ')
         + 'd="' + (MARKS ? MARKS[key] : '') + '"' + (EVENODD[key] ? ' fill-rule="evenodd"' : '') + '/></svg>';
  }
  /* the marks that are cut from a filled shape rather than one outline */
  var EVENODD = { web: 1, events: 1, directions: 1, opentable: 1 };


  /* a reference link's KIND, and how a bare value becomes an address */
  var KIND_KEYS = { website: 'web', phone: 'phone', email: 'email', instagram: 'instagram',
                    facebook: 'facebook', x: 'x', youtube: 'youtube', reddit: 'reddit',
                    tiktok: 'tiktok', linkedin: 'linkedin', menu: 'web', booking: 'web',
                    tickets: 'eventbrite', directions: 'maps', support: 'web', press: 'web' };
  var KIND_HOME = { instagram: 'https://instagram.com/', x: 'https://x.com/', tiktok: 'https://www.tiktok.com/@',
                    youtube: 'https://youtube.com/@', facebook: 'https://facebook.com/', reddit: 'https://reddit.com/u/',
                    linkedin: 'https://linkedin.com/in/' };
  function fromKind(kind, value) {
    var k = String(kind || '').toLowerCase(), v = String(value || '').trim();
    if (!v) return '';
    if (k === 'phone') return /^tel:/i.test(v) ? v : 'tel:' + v.replace(/[^+\d]/g, '');
    if (k === 'email') return /^mailto:/i.test(v) ? v : 'mailto:' + v;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
    if (KIND_HOME[k]) return KIND_HOME[k] + v.replace(/^@/, '');
    return v;
  }
  function hostOf(url) {
    try { return new global.URL(url, 'https://x/').hostname.replace(/^www\./, '').toLowerCase(); }
    catch (e) { return ''; }
  }
  /* what platform this URL is — from its host, never from a label */
  function platformOf(url) {
    var u = String(url || '').trim();
    if (!u) return null;
    if (/^mailto:/i.test(u)) return { key: 'email', name: 'Email', href: u };
    if (/^tel:/i.test(u)) return { key: 'phone', name: 'Phone', href: u };
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    var host = hostOf(u), path = '';
    try { path = new global.URL(u).pathname; } catch (e) {}
    for (var i = 0; i < PLATFORMS.length; i++) {
      var h = PLATFORMS[i][0];
      if (h.indexOf('/') >= 0) {
        if ((host + path).indexOf(h) === 0) return { key: PLATFORMS[i][1], name: PLATFORMS[i][2], href: u };
      } else if (host === h || host.slice(-h.length - 1) === '.' + h) {
        return { key: PLATFORMS[i][1], name: PLATFORMS[i][2], href: u };
      }
    }
    return { key: 'web', name: host || 'Website', href: u };
  }
  /* ★ FOUNDER/476: *"white globe."* ONEWAY's own mark on a Post is the globe
     the loading mark draws — the sphere, its parallels foreshortened, its
     meridians as full-height ellipses (tools/make_icon.py) — stroked in
     currentColor like every other platform's glyph beside it, never in purple
     or a hue. Geometry from /oneway-globe.svg, scaled 100 → 24. */
  /* ══ THERE IS ONE GLOBE ═══════════════════════════════════════════════════
     ★ FOUNDER/499, 2026-09-23: *"don't have different versions of the globe.
       Use uh, the same one. Holy crap. Things like this should not have to be
       specified."*
     ★ FOUNDER/497: *"follow the visual direction of the platform directly."*

     THIS OVERTURNS MY OWN ANSWER IN 488 AND THE PARAGRAPH THAT DEFENDED IT.
     He said the globe looked *"overlayerd and muffled"* at mark size, and I
     replied by drawing a SECOND globe — a simplified rim, equator and one
     meridian — for small marks, leaving the platform's own globe for large
     ones, and wrote that this was "one drawing per size, rather than one
     drawing stretched". That is how a brand ends up with two marks. The mark
     IS the brand; the correct answer to "it smudges at 15px" is to make THE
     globe read at 15px.

     SO THIS IS THE PLATFORM'S OWN GEOMETRY, verbatim from `/oneway-globe.svg`
     — five parallels foreshortened as the sphere's chords, three meridians
     whose widths are the cosine of their longitude, and the rim. Generated by
     `tools/make_icon.py`, which remains the place the geometry is edited: the
     numbers below are that file's output and nothing else may invent new ones.

     WHAT MAKES IT READ SMALL is the same thing that makes the file read in a
     16px browser tab, and it is already in the file's own reasoning: weight,
     not detail. The rim carries the most, the centre meridian next, the
     parallels least — so at 15px the eye resolves a sphere with a bright edge
     rather than eight competing lines, and at 100px every line is there. The
     opacities are the file's; the stroke widths are the file's, scaled by the
     one ratio between its 100-unit box and whatever box this is drawn in.

     `vector-effect="non-scaling-stroke"` is deliberately NOT used: it would
     hold the stroke at one device pixel regardless of size, which is what
     makes a small mark look like a wireframe and a large one look hollow. The
     stroke scales with the mark, exactly as it does in the file. */
  var GLOBE = '<svg class="ow-globe" viewBox="0 0 100 100" fill="none"'
    + ' stroke="currentColor" stroke-linecap="round" aria-hidden="true">'
    + '<g stroke-width="2.6">'
    +   '<ellipse cx="50" cy="22.72" rx="34.52" ry="10.36" opacity=".74"/>'
    +   '<ellipse cx="50" cy="36.36" rx="41.83" ry="12.55" opacity=".74"/>'
    +   '<ellipse cx="50" cy="50" rx="44" ry="13.2" opacity=".74"/>'
    +   '<ellipse cx="50" cy="63.64" rx="41.83" ry="12.55" opacity=".74"/>'
    +   '<ellipse cx="50" cy="77.28" rx="34.52" ry="10.36" opacity=".74"/>'
    +   '<ellipse cx="50" cy="50" rx="44" ry="44" opacity=".72"/>'
    +   '<ellipse cx="50" cy="50" rx="35.6" ry="44" opacity=".72"/>'
    +   '<ellipse cx="50" cy="50" rx="13.6" ry="44" opacity=".9"/>'
    + '</g>'
    + '<circle cx="50" cy="50" r="44" stroke-width="3"/>'
    + '</svg>';

  /* THE ONE PLACE ANYTHING ASKS FOR THE STATIC MARK. A surface that needs the
     globe calls this rather than pasting geometry — which is the whole of 499.

     IT IS `OW.links.globe`, NOT `OW.globe`, AND THAT NAME WAS NOT FREE.
     `OW.globe(opts)` has existed in oneway-popit.js since long before this: it
     builds the ANIMATED LOADING mark and returns a DOM node. I took the name
     for a function returning an HTML string, and `loading()` — which every
     surface in the App calls on its first frame — began handing a string to
     `appendChild`. Measured immediately: Settings threw
     "parameter 1 is not of type 'Node'" and painted nothing at all.

     THE TWO ARE THE SAME GLOBE AND THAT IS THE POINT OF 499 — the loading mark
     draws `GLOBE_PARALLELS`/`GLOBE_LONGITUDES` in the same 0–100 box, from the
     same sphere, and animates it. One drawing, two states: still and turning.
     What was wrong was the NAME, not the geometry. */
  function globeMark() { return GLOBE; }

  /* ── EVERY PLATFORM'S BRAND COLOUR, FOR THE PEOPLE WHO WANT COLOUR ───────
     ★ FOUNDER/496: *"users should choose if they want the color logos or the
       black and white icons on their platforms and posts."*
     The marks are single silhouettes drawn in `currentColor`, which is what
     makes the monochrome set coherent. Colour is therefore one declaration per
     platform and nothing else changes — the same path, a different ink. These
     are the platforms' own published brand values, not sampled guesses. */
  var HUES = {
    instagram: '#E4405F', threads: '#000000', x: '#000000', tiktok: '#FE2C55',
    youtube: '#FF0000', facebook: '#1877F2', spotify: '#1DB954',
    applemusic: '#FA243C', soundcloud: '#FF5500', linkedin: '#0A66C2',
    snapchat: '#FFFC00', whatsapp: '#25D366', telegram: '#26A5E4',
    discord: '#5865F2', twitch: '#9146FF', pinterest: '#BD081C',
    bluesky: '#0285FF', mastodon: '#6364FF',
    reddit: '#FF4500', github: '#181717', linktree: '#43E55E',
    maps: '#34A853', yelp: '#FF1A1A', eventbrite: '#F05537',
    opentable: '#DA3743', resy: '#D02E4C'
  };
  function hueOf(key) { return HUES[key] || ''; }

  /* ── AN ICON FOR ALMOST ANY PLATFORM ─────────────────────────────────────
     ★ FOUNDER/496: *"it shouldn't just be a set array of icons. It should be
       able to detect the icon for almost any type of platform."*

     A HAND-KEPT LIST CAN ONLY EVER BE WRONG. There are 27 marks here and the
     internet has more; everything else fell through to one generic web glyph,
     so a person's own site, their Substack, their Bandcamp and their shop all
     wore the same anonymous mark. Adding marks does not fix that — it moves
     the boundary and leaves it in the same place.

     SO AN UNKNOWN HOST IS ASKED FOR ITS OWN ICON. Every site that has one
     serves it at `/favicon.ico`, which is the oldest and most universal
     convention on the web, and a site that does not serve one falls back to
     the generic mark exactly as before. Nothing regresses; almost everything
     improves.

     NO THIRD PARTY. The obvious shortcut is an icon service — one host that
     would then learn every link every person on ONEWAY has ever added. That is
     a privacy leak dressed as convenience, and it is the sort of thing that is
     invisible until it is a headline. The browser fetches the icon from the
     site the link already points at, which it is about to talk to anyway.

     THE VECTOR MARKS STILL WIN where we have them: a favicon is a 16px bitmap
     and Instagram's real mark is a path that is sharp at any size. This is the
     floor, not the replacement. */
  /* ── A NAME THAT CAN NEVER RESOLVE IS NEVER ASKED ──────────────────────
     RFC 2606 and 6761 reserve `.test`, `.example`, `.invalid` and
     `.localhost` (and the `example.com/.net/.org` second-level names) so that
     they will never exist on the public internet. Asking one for its icon is
     a request that is wrong before it is sent — measured in the founder/500
     audit as `net::ERR_NAME_NOT_RESOLVED` on a person's page, from a fixture
     link to `example.test`. The generic mark is the correct answer for these,
     decided here rather than discovered by a failed lookup. */
  var NEVER = /(^|\.)(test|example|invalid|localhost)$|(^|\.)example\.(com|net|org)$/i;
  function faviconOf(url) {
    try {
      var u = new global.URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
      if (!/^https?:$/.test(u.protocol)) return '';
      if (NEVER.test(u.hostname)) return '';
      /* NOT FETCHED (PLAN 5.0.0 B): asking a site for its icon hands it the viewer's address, and a copy of any host's icon made
         our server anyone's fetcher (the security review's H1). An unknown site wears the generic web mark. */
      return '';
    } catch (e) { return ''; }
  }

  function svg(key, url) {
    if (key === 'oneway') return GLOBE;
    /* ── `web` MEANS "WE DO NOT KNOW", AND THAT IS THE WHOLE CASE ──────────
       `platformOf` returns the key `web` for every host it does not recognise,
       and `MARKS.web` exists — so the known-mark branch below claimed it and
       the favicon path was unreachable for the one population it was written
       for. Measured: a Substack link added through the editor drew the generic
       web glyph, exactly as before this change. `web` is not a platform; it is
       the absence of one, and the absence is where a site's own icon belongs. */
    if (MARK_KEYS[key] && !(key === 'web' && url)) return markSvg(key);
    /* unknown platform: its own icon, and the generic mark underneath it so a
       site with no favicon looks exactly as it did before */
    var ico = url ? faviconOf(url) : '';
    var generic = markSvg('web');
    if (!ico) return generic;
    return '<span class="ow-mk__site">' + generic
         + '<img src="' + ico.replace(/"/g, '&quot;') + '" alt="" loading="lazy"'
         + ' decoding="async" onerror="this.remove()">'
         + '</span>';
  }
  /* THE BAR. `links`: strings or {url,label}; `extra`: [{key,name,onPress}]
     for the acts that are really links (Events, Directions). Returns a node,
     or null when there is nothing — an empty bar is a line on a page. */
  function bar(links, extra, opts) {
    opts = opts || {};
    var items = [];
    var seen = {};
    (links || []).forEach(function (l) {
      /* the reference store's shape is {kind, value, label} — a kind the
         platform names and a value that is a URL, a handle or a number;
         a bare handle is turned into the platform's own address */
      var url = typeof l === 'string' ? l : (l && (l.url || l.href || fromKind(l.kind, l.value)) || '');
      var p = platformOf(url);
      if (!p || seen[p.href]) return;
      seen[p.href] = 1;
      if (l && l.kind && KIND_KEYS[l.kind] && p.key === 'web') p.key = KIND_KEYS[l.kind];
      items.push({ key: p.key, name: (l && l.label && l.label !== p.name && !KIND_KEYS[l.kind] ? l.label : p.name), href: p.href });
    });
    (extra || []).forEach(function (x) { if (x && x.key) items.push(x); });
    if (!items.length) return null;
    var row = doc.createElement('div');
    /* ★ FOUNDER/471 §10–11: the Links tab is the same bar stood on end —
       `layout:'list'` draws each link as a row: the platform's own mark,
       recognised from the URL, the word the person gave it (or the
       platform's name), and the host quietly after. No plate, no line. */
    var list = opts.layout === 'list';
    row.className = 'ow-linkbar' + (list ? ' ow-linkbar--list' : '');
    row.setAttribute('role', 'list');
    items.forEach(function (it) {
      var el = doc.createElement(it.href ? 'a' : 'button');
      el.className = 'ow-linkbar__i' + (list ? ' ow-linkbar__i--row' : '');
      el.setAttribute('data-platform', it.key);
      /* the platform's own colour rides on the element, so the stylesheet's
         colour rule is ONE line for every platform rather than one per
         platform — and a platform added tomorrow is coloured without a CSS
         edit (founder/496) */
      if (HUES[it.key]) el.style.setProperty('--mk', HUES[it.key]);
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label', it.name);
      el.title = it.name;
      if (it.href) { el.href = it.href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      else { el.type = 'button'; }
      /* the URL travels with the key so an unknown platform can be asked for
         its own icon (founder/496) */
      el.innerHTML = svg(it.key, it.href || '');
      if (list) {
        /* the quiet half: on a platform, WHO they are there (the path — an
           @handle or a page); on a site, the host. Nothing when the word
           already says it. */
        var host = '', path = '';
        try { var u0 = new URL(it.href); host = u0.hostname.replace(/^www\./, ''); path = u0.pathname.replace(/\/+$/, ''); } catch (e) {}
        var wd = doc.createElement('span'); wd.className = 'ow-linkbar__w';
        var nm = doc.createElement('b'); nm.textContent = it.name; wd.appendChild(nm);
        var quiet = '';
        if (it.key !== 'web' && it.key !== 'phone' && it.key !== 'email') {
          quiet = path && path !== '/' ? path.replace(/^\//, '').replace(/^(?!@)([^\/]+)$/, '@$1') : '';
          if (quiet && it.name.toLowerCase() === quiet.replace(/^@/, '').toLowerCase()) quiet = '';
        } else if (host && host.toLowerCase() !== String(it.name).toLowerCase()) {
          quiet = host;
        }
        if (quiet) { var hs = doc.createElement('small'); hs.textContent = quiet; wd.appendChild(hs); }
        el.appendChild(wd);
      } else if (opts.words) {
        var w = doc.createElement('span'); w.textContent = it.name; el.appendChild(w);
      }
      if (it.onPress) el.addEventListener('click', function (e) { e.preventDefault(); it.onPress(e, el); });
      row.appendChild(el);
    });
    return row;
  }
  /* ── EVERYTHING THIS FILE OFFERS, EXPORTED IN ONE PLACE, AT THE END ─────
     `OW.links` is created HERE and nowhere earlier, because the top of this
     module guards with `if (OW.links) return;` — its "already loaded" check.
     I first attached `globe` to `OW.links` where the mark is defined, two
     hundred lines up; that both threw (the object did not exist yet) and, once
     I "fixed" it by creating the object early, made the guard fire on the
     first load and return before a single function was defined. Every link bar
     on the platform went blank and the editor labelled every link "Link".
     One object, built once, at the point the guard is designed for. */
  /* Posts and their composer share one destination rule. The actual address stays visible. */
  function postURL(value) {
    var raw = String(value || '').trim(), u;
    if (!raw || /\s/.test(raw)) return null;
    try { u = new URL(/^www\./i.test(raw) ? 'https://' + raw : raw); } catch (_) { return null; }
    var host = u.hostname.toLowerCase();
    return (u.protocol === 'https:' || u.protocol === 'http:') && host && !u.username && !u.password
      && !/(^|\.)xn--/.test(host) && !/^[\d.]+$/.test(host) && host.indexOf(':') < 0 ? u : null;
  }
  /* an X post's id from its address (x.com or twitter.com /<handle>/status/<id>), else '' */
  function xPostId(u) {
    var host = String((u && u.hostname) || '').toLowerCase().replace(/^(www|mobile)\./, '');
    var m = (host === 'x.com' || host === 'twitter.com') && /^\/(?:i\/web|[A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})(?:\/|$)/.exec(u.pathname || '');
    return m ? m[1] : '';
  }
  function postText(text) {
    text = String(text || '');
    var frag = doc.createDocumentFragment(), re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi, last = 0, m;
    /* the words between the links: a #tag is a press into Discovery's search for it (founder/1258; OW.tagParts, the card's own rule and its one listener) */
    var said = function (t) {
      (OW.tagParts ? OW.tagParts(t) : [{ text: t }]).forEach(function (p) {
        if (!p.tag) { frag.appendChild(doc.createTextNode(p.text)); return; }
        var a = doc.createElement('a'); a.className = 'ow-post__link ow-post__tag'; a.href = '#discovery/tag/' + encodeURIComponent(p.tag);
        a.textContent = p.text; a.setAttribute('data-po-tag', p.tag); frag.appendChild(a);
      });
    };
    while ((m = re.exec(text))) {
      if (m.index > last) said(text.slice(last, m.index));
      var raw = m[0].replace(/[).,!?;:'"]+$/, ''), u = postURL(raw);
      if (u) {
        var a = doc.createElement('a'), host = u.hostname.toLowerCase();
        a.href = u.href; a.textContent = raw; a.className = 'ow-post__link';
        /* AN X POST'S LINK IS MARKED WITH ITS ID AND DRAWN AS A LINK: X's terms forbid framing it (api/oneway/external/players.py). */
        var xp = xPostId(u);
        if (xp) a.setAttribute('data-x-post', xp);
        var ours = host === 'oneway.center' || /\.oneway\.center$/.test(host) || host === global.location.hostname;
        if (!ours) { a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc'; }
        frag.appendChild(a);
      } else frag.appendChild(doc.createTextNode(raw));
      if (m[0].length > raw.length) frag.appendChild(doc.createTextNode(m[0].slice(raw.length)));
      last = m.index + m[0].length;
    }
    if (last < text.length) said(text.slice(last));
    return frag;
  }
  /* the table, once the page has painted and is idle */
  (function () {
    var later = function () { (global.requestIdleCallback || function (f) { return setTimeout(f, 1); })(askMarks, { timeout: 2000 }); };
    try { if (doc.readyState === 'complete') later(); else global.addEventListener('load', later); } catch (e) {}
  })();
  /* ── SHARE TO X, BY X'S OWN OPEN DOOR (founder/1142: "X is a place to link to, no paid API; share and embeds only") ──
     X's web intent opens X's own composer with the words filled in, and the person presses Post there: no app, no sign-in,
     no fee (docs.x.com/x-for-websites/post-button/guides/web-intent, read 2026-11-01). It cannot load inside a frame, so
     the act is a link that opens a new tab. The words are the thing's own (its title, else its text) and its link, never
     written for it; cut to fit X's 280 as X counts them: every link 23 after a space, and a character outside X's light ranges
     (Chinese, Japanese, Korean, an emoji) two (twitter-text's weighting). The cut falls between whole characters, never inside
     one, and ends with an ellipsis. */
  var X_INTENT = 'https://x.com/intent/tweet', X_MAX = 280, X_LINK = 23;
  function xWeight(cp) {
    return (cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)) ? 1 : 2;
  }
  function xFit(t, room) {
    var ends = [], total = 0, i = 0;
    while (i < t.length) {
      var c = t.charCodeAt(i), cp = c, n = 1;
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < t.length) {
        var d = t.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { cp = (c - 0xD800) * 0x400 + (d - 0xDC00) + 0x10000; n = 2; }
      }
      i += n; total += xWeight(cp); ends.push([i, total]);
    }
    if (total <= room) return t;
    room -= xWeight(0x2026);                       /* the ellipsis that says it was cut */
    var keep = 0;
    for (var k = 0; k < ends.length && ends[k][1] <= room; k++) keep = ends[k][0];
    var cut = t.slice(0, keep), word = cut.replace(/\s+\S*$/, '');
    return (word || cut).replace(/\s+$/, '') + '…';
  }
  function xIntent(text, url) {
    var t = String(text || '').replace(/\s+/g, ' ').trim(), u = String(url || '').trim();
    var room = u ? X_MAX - X_LINK - 1 : X_MAX;
    t = xFit(t, room);
    var q = [];
    if (t) q.push('text=' + encodeURIComponent(t));
    if (u) q.push('url=' + encodeURIComponent(u));
    return X_INTENT + (q.length ? '?' + q.join('&') : '');
  }
  function xShare(text, url, cls) {
    var a = doc.createElement('a');
    a.className = cls || 'po-act';
    a.href = xIntent(text, url);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Share to X';
    a.setAttribute('data-share', 'x');
    return a;
  }
  OW.links = {
    xIntent: xIntent,
    xShare: xShare,
    xPostId: xPostId,
    postURL: postURL,
    postText: postText,
    fromKind: fromKind,
    platformOf: platformOf,
    icon: svg,
    bar: bar,
    globe: globeMark,
    hueOf: hueOf,
    faviconOf: faviconOf,
    PLATFORMS: PLATFORMS
  };
})(window);

/* ══ THE PLATFORMS' OWN PLAYERS, DRAWN LIGHT AND LOADED LATE (OW.embed) ══════════════════════════════════════════════════
   ★ FOUNDER/1139: a post brought in from YouTube or TikTok plays in the platform's own player inside Oneway, with its caption
   and its author; founder/675: never a bare link.

   ONE HELPER FOR EVERY PLATFORM. A post carries `embed` {provider, id, url, aspect, cover, author}; this draws a light card
   first (our own copy of the cover, the platform's mark, a play mark, and the line that says who the player connects you to)
   and makes the platform's player once it is in view and the scroll has settled, one player at a time, at most MAX_LIVE at
   once; one far off screen is taken down and its card drawn again. WHO IT CONNECTS YOU TO, SAID (his words, 2026-11-10, PLAN
   5.0.0 B; his choice that YouTube plays in the feed by itself): a player loads before a press only while "Play videos from other
   platforms by themselves" is on (autoOk: on by default, off by default where the browser's time zone is in Europe, until the
   person turns it on), and the first time one does, a one-time notice says so in plain words (tellOnce). Off, the card is our
   cover with "Playing this connects you to TikTok, which will see your internet address", and only a press makes the player. No per-platform code: what differs is DATA in `table`, the App's copy of api/oneway/external/players.py
   (test_players holds the two equal).

   THE FRAME (lane B's conditions, 2026-11-01): its address is ALWAYS the table's host and path with an id that passed the
   platform's pattern, here and on the server; a stored or pasted address never goes in a frame. Never one of our own hosts or
   this page's origin (SE1). Sandboxed with no top navigation and no forms; it starts by itself only muted, so a sound only ever starts
   on the person's press; a player is taken down the moment it leaves the screen, so nothing plays unseen (YouTube III.I.9), and none
   is made smaller than YouTube's 200 by 200 (its Required Minimum Functionality): a smaller card is the link card.
   A PLAYER THAT DOES NOT DRAW IS NEVER A BLANK FRAME: no word from it within READY_MS, or its own error message, and the card
   becomes the link card, "Watch on <platform>". */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  if (OW.embed) return;
  var doc = global.document;
  /* what a frame is built from, and the site the link card may open; how each player speaks is the loader's (oneway-embed.js) */
  var TABLE = {
    players: {
      youtube: { label: 'YouTube', verb: 'Watch', host: 'www.youtube-nocookie.com', path: '/embed/{id}', query: 'enablejsapi=1&playsinline=1&rel=0',
                 origin_param: 'origin', auto: 'autoplay=1&mute=1', id: '[A-Za-z0-9_-]{11}', aspect: 1.7778, site: 'youtube.com' },
      tiktok: { label: 'TikTok', verb: 'Watch', host: 'www.tiktok.com', path: '/player/v1/{id}', query: '', auto: 'autoplay=1&muted=1', id: '[0-9]{6,25}', aspect: 0.5625, site: 'tiktok.com' },
      instagram: { label: 'Instagram', verb: 'View', host: 'www.instagram.com', path: '/p/{id}/embed/captioned/', query: '', id: '[A-Za-z0-9_-]{5,40}', aspect: 0.8,
                   site: 'instagram.com' },
      threads: { label: 'Threads', verb: 'View', host: 'www.threads.com', path: '/t/{id}/embed', query: '', id: '[A-Za-z0-9_-]{5,40}', aspect: 0.8, site: 'threads.com' },
      /* X is never framed (X Developer Agreement, clause K): its post is the light card and "Watch on X", which opens x.com */
      x: { label: 'X', verb: 'View', frame: false, id: '[0-9]{1,25}', aspect: 1.0, site: 'x.com' }
    }
  };
  var OURS = /(^|\.)(oneway\.center|onewayos\.com)$/i;
  var IDS = {};
  Object.keys(TABLE.players).forEach(function (k) { IDS[k] = new RegExp('^(?:' + TABLE.players[k].id + ')$'); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function spec(p) { return Object.prototype.hasOwnProperty.call(TABLE.players, p) ? TABLE.players[p] : null; }
  function validId(p, id) { return !!spec(p) && typeof id === 'string' && /^[\x21-\x7e]+$/.test(id) && IDS[p].test(id); }
  /* THE PLAYER'S ADDRESS: the table's host and path, a validated id, and this page's own origin where the player asks for it;
     `auto`, where the platform has one, starts it MUTED, always: the one start every browser allows (the loader asks only for a player at
     least half on screen, and gives it sound by the platform's own message once it plays and the person wants sound, oneway-embed.js). */
  function src(p, id, origin, auto) {
    if (!validId(p, id) || spec(p).frame === false) return '';
    var s = spec(p), q = s.query.replace('{id}', id);
    if (auto && s.auto) q += (q ? '&' : '') + s.auto;
    if (s.origin_param && origin && /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(origin)) q += (q ? '&' : '') + s.origin_param + '=' + encodeURIComponent(origin);
    if (OURS.test(s.host) || s.host === (global.location || {}).host) return '';   /* SE1: never a host of ours, nor this page's own */
    return 'https://' + s.host + s.path.replace('{id}', id) + (q ? '?' + q : '');
  }
  /* the platform's own page for the post: https, on that platform's hosts, or the table's player page */
  function watch(e) {
    var s = spec(e && e.provider), u = String((e && e.url) || '');
    if (!s || !validId(e.provider, e.id)) return '';
    var h = '';
    try { var x = new global.URL(u); h = x.protocol === 'https:' && !x.username && !x.password ? x.hostname.toLowerCase() : ''; } catch (_) {}
    return (h && (h === s.site || h.slice(-s.site.length - 1) === '.' + s.site)) ? u : src(e.provider, e.id, '');
  }
  function clampAR(a, s) { return Math.min(1.91, Math.max(0.5625, +a || s.aspect)); }
  /* THE LINE ON THE CARD, before the press: the same words as platform/outside_origins.json's row for the player (test_no_outside) */
  function notice(s) { return 'Playing this connects you to ' + s.label + ', which will see your internet address.'; }
  /* "PLAY VIDEOS FROM OTHER PLATFORMS BY THEMSELVES" (Settings, Privacy, Other companies): the person's own choice, else on, but off
     where the browser's time zone is in Europe until the person turns it on (consent first there). Key: ow_players_auto, '1' or '0'. */
  var AUTO_KEY = 'ow_players_auto', TOLD_KEY = 'ow_players_told';
  var TOLD = 'Videos from YouTube, TikTok and Instagram play here, which connects you to them. They see your internet address.';
  function stored(k) { try { return global.localStorage.getItem(k); } catch (_) { return null; } }
  function europe() { try { return /^Europe\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (_) { return false; } }
  function autoOk() { var v = stored(AUTO_KEY); return v === '1' ? true : v === '0' ? false : !europe(); }
  /* the account's own choice (settings outside_players: by_region, on, off), kept here so it follows the person to every device (S22) */
  function mirrorAuto(v) {
    var was = autoOk();
    try { if (v === 'on' || v === 'off') global.localStorage.setItem(AUTO_KEY, v === 'on' ? '1' : '0'); else global.localStorage.removeItem(AUTO_KEY); } catch (_) {}
    if (autoOk() !== was) { try { doc.dispatchEvent(new global.CustomEvent('ow:players', { detail: { auto: autoOk() } })); } catch (_) {} }
  }
  function setAuto(on) {
    mirrorAuto(on ? 'on' : 'off');
    var D = OW.data, signed = !!(D && ((D.token && D.token()) || (D.cookieSession && D.cookieSession())));
    if (signed && D.post) D.post('/api/me/settings', { settings: { outside_players: on ? 'on' : 'off' } }, { method: 'PUT', queueable: true });
  }
  /* the first time a player loads before a press: said once, in plain words, never in the way (a toast, no modal) */
  function tellOnce() {
    if (stored(TOLD_KEY) === '1') return false;
    try { global.localStorage.setItem(TOLD_KEY, '1'); } catch (_) {}
    if (OW.toast) OW.toast(TOLD + ' You can turn this off in Settings, Privacy, Other companies.');
    return true;
  }
  function ownCover(c) { c = String(c || ''); return /^\/assets\/[^"'<>\s]+$/.test(c) && c.indexOf('..') < 0 ? c : ''; }

  /* ── THE LIGHT CARD: what is drawn before any player, and what stays when one does not draw ── */
  /* A CARD THAT FALLS BACK (the player was refused, or said nothing) IS NEVER A BLACK BOX (main, 2026-11-09): our own copy of its
     cover, who posted it there, and "Watch on TikTok" / "View on Instagram", the platform's own page. With no cover of ours it is drawn
     `data-bare`, a light ground carrying the same two (oneway-popit.css), never the near-black a frame sits on while it loads. */
  function face(e) {
    var s = spec(e && e.provider);
    if (!s || !validId(e.provider, e.id)) return '';
    var cover = ownCover(e.cover), label = esc(s.label), a = e.author || {};
    var who = a.handle ? '@' + String(a.handle).replace(/^@/, '') : (a.name || '');
    var says = s.frame === false ? '' : notice(s);
    return '<span class="ow-emb" data-ow-emb="' + esc(e.provider) + '" data-ow-emb-id="' + esc(e.id) + '"'
      + ' data-ow-emb-to="' + esc(watch(e)) + '"' + (cover ? '' : ' data-bare') + ' style="--ow-emb-ar:' + clampAR(e.aspect, s).toFixed(4) + '"'
      + (says ? ' role="button" tabindex="0" aria-label="' + esc('Play. ' + says) + '"' : '') + '>'
      + (cover ? '<img class="ow-emb__cover" src="' + esc(cover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '')
      + '<span class="ow-emb__play" aria-hidden="true">' + OW.glyph('play') + '</span>'
      + (e.aigc ? '<span class="ow-emb__ai">' + esc(e.aigc_words || 'AI-generated') + '</span>' : '')
      + (who ? '<span class="ow-emb__who">' + esc(String(who).slice(0, 80)) + '</span>' : '')
      + (says ? '<span class="ow-emb__note" aria-hidden="true">' + esc(says) + '</span>' : '')
      + '<span class="ow-emb__go" role="link" tabindex="0" data-ow-emb-go>' + esc(s.verb || 'Watch') + ' on ' + label + '</span>'
      + '</span>';
  }

  /* ── THE LOADER IS ITS OWN FILE, fetched the first time a card with a player is drawn (frontend/shared/oneway-embed.js, the App's
     lazy "embed"; the first screen's script budget, test_boot_budget). A page that cannot fetch it shows the link card, never a
     cover with a play mark that does nothing. */
  var waiting = [];
  function linkAll() {
    waiting.splice(0).forEach(function (r) {
      [].forEach.call(r.querySelectorAll ? r.querySelectorAll('.ow-emb') : [], function (el) { el.setAttribute('data-state', 'link'); });
    });
  }
  function watchIn(root) {
    if (OW.embed.__watch) return root && OW.embed.__watch(root);
    if (!root || waiting.push(root) > 1) return 0;
    if (!OW.need || !doc.querySelector('script[data-name="embed"]')) return linkAll();
    OW.need('embed').then(function () {
      if (!OW.embed.__watch) return linkAll();
      waiting.splice(0).forEach(function (r) { OW.embed.__watch(r); });
    }, linkAll);
  }

  /* "Watch on <platform>", and a card's one mark (founder/1307): the platform's own page in a new tab, and nothing under it (a card's
     own press) hears the press */
  function go(ev) {
    var c = ev.target.closest ? ev.target : null, g = c && (c.closest('[data-ow-emb-go]') || c.closest('[data-ow-orig]'));
    var to = g && (g.getAttribute('data-ow-orig') || g.parentNode.getAttribute('data-ow-emb-to'));
    /* A PRESS ON THE CARD ITSELF STARTS ITS PLAYER: the only way one is made (oneway-embed.js waits for __owTapped) */
    var card = !g && c && c.closest('.ow-emb[role="button"]');
    if (card && !(ev.key && ev.key !== 'Enter' && ev.key !== ' ') && !/^(live|link|loading)$/.test(card.getAttribute('data-state') || '')) {
      ev.preventDefault(); ev.stopPropagation();
      card.__owTapped = true; card.setAttribute('data-tapped', '');
      if (OW.embed.__play) OW.embed.__play(card); else watchIn(card);
      return;
    }
    if (!g || (ev.key && ev.key !== 'Enter' && ev.key !== ' ')) return;
    ev.preventDefault(); ev.stopPropagation();
    if (/^https:\/\//.test(to)) global.open(to, '_blank', 'noopener,noreferrer');
  }
  try { doc.addEventListener('click', go, true); doc.addEventListener('keydown', go, true); } catch (e) {}

  OW.embed = { table: TABLE, validId: validId, src: src, watch: watch, face: face, watch_in: watchIn, notice: notice,
               autoOk: autoOk, setAuto: setAuto, mirrorAuto: mirrorAuto, tellOnce: tellOnce, told: TOLD };
})(window);
