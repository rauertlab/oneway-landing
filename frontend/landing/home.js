/* THE HOME PAGE'S OWN MOTION (founder/1058, founder/1069), 2026-10-31. Optional, every part: with no script the page reads whole,
   "more" in the headline, every paragraph shown, the globe still the platform's mark.
   1 · the globe under the wordmark turns, carrying people and Information Centers drawn exactly as Discovery draws them;
   2 · the headline's word turns and lights the sprites it names; 3 · on a phone, the later paragraphs wait behind one press (they
   stay in the HTML, for search); 4 · the strip of the platform's own Centers is drawn when it comes into view; 5 · the decks of
   example profiles and Centers, the page's cards before 1058 (founder/1081: "DO NOT REMOVE ALL OF THE PREVIOUS CHARACTER"). */
(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('ow-calm');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ── 1 · THE GLOBE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
     THE PLATFORM'S OWN GLOBE, TURNING (founder/1082: "make globe more like ours"): the mark's drawing (api/oneway/kernel/mark.py,
     oneway-globe.svg): five parallels, the limb, and meridians every 36 degrees from 18, each line a wide dim halo under a bright
     core, in the page's colour (--land-globe: the tab globe's, the person's hue else the look's lead; index.html paint()). The
     parallels are the mark's ellipses; a meridian is the mark's half-ellipse from pole to pole, 44·sin(longitude) wide, so at rest
     (every 36 degrees of turn) the globe is the mark line for line, and turning, each meridian slides in from one edge of the limb
     and into the other. The sprites ride an orthographic globe seen from a little above (its parallels are 0.3 as tall as wide,
     so the camera sits 17.46 degrees over the equator), so a sprite rides its parallel and leaves over the far edge.
     A PERSON is the map's person sprite (oneway-popit.css .ow-map__pin, data-face="mark", their initials on their hue as
     OW.hue.fromAngle makes it: the three functions below are oneway-popit.js's, copied and held to it by tools/home_script.py).
     AN INFORMATION CENTER is drawn by the map's own call: Discovery's pin face at PLAIN_PIN_PX, filled by OW.cards.informationFace.
     SPACED, NEVER CROWDED (founder/1082: "make the objects on globe more spaced out"): the sprites sit on three rings (34, -2 and
     -46 degrees; five, six and six, each ring turned from the next), so no two visible sprites come closer than 24 of the mark's
     100 units at any turn (tools/probe/landing-home-walk.cjs measures it in rendered pixels). The people are the examples the
     page's screens show; the places are public landmarks' kinds. */
  var MONTHS = [['Azure', 203, '009DFF'], ['Magenta', 332, 'FF0077'], ['Violet', 274, '9000FF'], ['Pink', 302, 'FF00F6'],
                ['Green', 115, '15FF00'], ['Lemon', 54, 'FFE500'], ['Amber', 45, 'FFBF00'], ['Lime', 75, 'BFFF00'],
                ['Aqua', 172, '00FFDD'], ['Orange', 27, 'FF7300'], ['Red', 0, 'FF0000'], ['Blue', 228, '0033FF']];
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function strong(d) {
    d = ((Math.round(d) % 360) + 360) % 360;
    for (var i = 0; i < MONTHS.length; i++) if (MONTHS[i][1] === d) {
      var n = parseInt(MONTHS[i][2], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return hsl2rgb(d, 100, 50);
  }
  function fromAngle(deg) { var d = parseInt(deg, 10); return [strong(d).join(','), strong(d - 64).join(',')]; }
  var PLAIN_PIN_PX = 26, PERSON_PX = 28;     /* discovery.js: an Information Center's size, and a person's with nothing yet (sizeFor) */
  /* THE GLOBE CARRIES NINE, NOT SEVENTEEN (founder/1364 §4: "the icons are crowded inside it"). Two rings, four at 30
     degrees from 0 and five at -16 from 40: no two sprites come within 34 of the mark's 100 units in space, where the
     old three rings of five, six and six allowed 24. The rest of the cast stands OFF the sphere, in FIELD below.
     Each sprite also carries `r`, the part it can play in an activity (section 1b). */
  function ring(lat, n, from) { var out = []; for (var i = 0; i < n; i++) out.push([lat, from + i * 360 / n]); return out; }
  var SPOTS = ring(30, 4, 0).concat(ring(-16, 5, 40));
  var SPRITES = [
    { p: 'MC', hue: 332, w: 'people communities', r: 'person' }, { c: 'park', w: 'places cities', r: 'open any' },
    { p: 'JR', hue: 27, w: 'people events', r: 'person' }, { c: 'museum', w: 'places cities', r: 'open any' },
    { p: 'PN', hue: 203, w: 'people communities', r: 'person' }, { c: 'city', w: 'cities places', r: 'open any' },
    { p: 'SO', hue: 150, w: 'people marketplaces', r: 'person' }, { c: 'library', w: 'places communities', r: 'open any' },
    { c: 'beach', w: 'places', r: 'open any' }
  ];
  SPRITES.forEach(function (s, i) { s.lat = SPOTS[i][0]; s.lng = SPOTS[i][1]; });
  var TILT = Math.asin(0.3), CT = Math.cos(TILT), ST = Math.sin(TILT), RAD = Math.PI / 180;
  function project(lat, lng, turn) {           /* {x, y} in the mark's 100-unit box, z > 0 facing us */
    var f = lat * RAD, l = (lng + turn) * RAD, cf = Math.cos(f), sf = Math.sin(f);
    var x = cf * Math.sin(l), y0 = sf, z0 = cf * Math.cos(l);
    return { x: 50 + 44 * x, y: 50 - 44 * (y0 * CT - z0 * ST), z: y0 * ST + z0 * CT };
  }
  /* the meridians on the near side at this turn: the mark's ten, every 36 degrees from 18, as [half-width, side] */
  function meridians(turn) {
    var out = [];
    for (var k = 0; k < 10; k++) {
      var l = (18 + 36 * k + turn) * RAD;
      if (Math.cos(l) > 1e-6) out.push(44 * Math.sin(l));
    }
    return out;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  /* THE NEON A NODE WEARS (founder/1364 §1 "MAKE THE COLOURS MUCH BRIGHTER ... Profiles, Centers, connections and moving
     icons just as vibrant"; §5 "Some nodes carry a subtle neon ring identifying their type"). The HUE is never invented
     here: a person's is their own (OW.hue.fromAngle's table), a Center's is the one its category already has on the map
     (OW.placeRow.paint's angle). Only the strength is this page's: the same hue at full saturation, so the mark the one
     renderer drew reads at 30 px on black. No yellow (his line, 2026-11-08: "i would hesitate with things like yellows"):
     every person's hue below, and every category hue the map holds, falls outside 40-75 degrees. */
  function ringRGB(s) {
    if (s.p) return strong(s.hue).join(',');
    var look = window.OW && OW.placeRow && OW.placeRow.paint ? OW.placeRow.paint(s.c) : null;
    return look ? hsl2rgb(look.angle, 95, 60).join(',') : '124,45,255';
  }
  function sprite(s) {
    var el = document.createElement('span');
    el.className = 'gl-pin ow-map__pin' + (s.p ? ' is-person' : ' is-plain');
    el.setAttribute('data-w', s.w);
    el.style.setProperty('--ring', ringRGB(s));
    el.style.setProperty('--face', (s.p ? PERSON_PX : PLAIN_PIN_PX) + 'px');
    if (s.p) {
      var c = fromAngle(s.hue);
      el.innerHTML = '<i style="--pin:rgb(' + c[0] + ');--ch1:' + c[0] + ';--ch2:' + c[1] + ';--face:' + PERSON_PX + 'px" data-kind="person" data-shape="round" data-face="mark">'
        + '<span class="ow-map__mono">' + s.p + '</span></i>';
    } else {
      /* an Information Center's pin as discovery.js draws it: the face in the place's colour, then the map's own call,
         OW.cards.informationFace, clears it and fills it with the place's mark */
      var look = window.OW && OW.placeRow && OW.placeRow.paint ? OW.placeRow.paint(s.c) : null;
      var rgb = look ? 'rgb(' + look.rgb + ');--ch1:' + look.rgb + ';--ch2:' + look.rgb : 'rgb(124,45,255)';
      el.innerHTML = '<i style="--pin:' + rgb + ';--face:' + PLAIN_PIN_PX + 'px" data-kind="center" data-shape="rounded" data-face="mono"></i>';
      var face = el.firstChild;
      if (window.OW && OW.cards && OW.cards.informationFace) {
        OW.cards.informationFace(face, { information_center: true, category: s.c, picture: { url: '' } });
        face.setAttribute('data-information-center', '1');
      }
    }
    return el;
  }
  var globes = $$('[data-globe]').map(function (g) {
    var pins = $('.gl-pins', g), svg = $('svg', g);
    if (!pins || !svg) return null;
    /* the mark's meridians at rest give way to ones that turn: five slots, each a halo under a core */
    var mers = [];
    var halo = $('.gl-halo', svg), core = $('.gl-core', svg);
    $$('.gl-mer', svg).forEach(function (e) { e.parentNode.removeChild(e); });
    var lines = halo && core ? markLines(core) : null;
    for (var i = 0; i < 5 && halo && core; i++) {
      var h = document.createElementNS(SVGNS, 'path'), c = document.createElementNS(SVGNS, 'path');
      halo.appendChild(h); core.appendChild(c); mers.push([h, c]);
    }
    var items = SPRITES.map(function (s) { var el = sprite(s); pins.appendChild(el); return { s: s, el: el }; });
    var gl = { g: g, mers: mers, items: items, all: g.hasAttribute('data-all'), seen: true, word: 'more', box: 0, lines: lines, svgAtRest: false };
    /* TURNING, THE GLOBE IS DRAWN ON ONE CANVAS (his brief of 2026-11-09, QA: "test all animations for smoothness"; the
       founder, 2026-11-08: "it must run at 120fps"). Rewriting five SVG paths every frame made the browser lay out and
       repaint the whole mark sixty to a hundred and twenty times a second: measured 2026-11-09 at 390 under a 4x slower CPU,
       64 fps with them and 89 without. The canvas draws the SAME lines from the SVG's own geometry (markLines below): the
       halo as ONE layer at the mark's .26, as the SVG's group opacity composites it, so where two halos cross they do not
       brighten; the cores each at their own opacity, as the SVG's are; the limb on top. The SVG stays in the page, at rest:
       it is the mark with no script, under reduced motion, and the picture section 6 copies. */
    if (!still && lines && g.querySelector('.gl-mark')) {
      var cv = document.createElement('canvas'), cx2 = cv.getContext && cv.getContext('2d');
      if (cx2) {
        cv.className = 'gl-cv'; cv.setAttribute('aria-hidden', 'true');
        $('.gl-mark', g).appendChild(cv);
        gl.cv = cv; gl.ctx = cx2; gl.col = getComputedStyle(g).color;
      }
    }
    return gl;
  }).filter(Boolean);
  /* the mark's parallels and limb, read from the SVG the server sent (index.html, the mark's own drawing), once */
  function markLines(core) {
    var out = [];
    [].slice.call(core.children).forEach(function (e) {
      var n = function (a) { return parseFloat(e.getAttribute(a)) || 0; }, o = e.hasAttribute('opacity') ? n('opacity') : 1;
      if (e.tagName.toLowerCase() === 'ellipse') out.push({ x: n('cx'), y: n('cy'), rx: n('rx'), ry: n('ry'), o: o });
      else if (e.tagName.toLowerCase() === 'circle') out.push({ x: n('cx'), y: n('cy'), rx: n('r'), ry: n('r'), o: o });
    });
    return out;
  }
  var TAU = Math.PI * 2;
  function sizeGlobe(gl) {
    var box = gl.g.clientWidth || 0;
    if (!box) return;
    gl.box = box;
    if (!gl.ctx) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(box * dpr);
    if (gl.cv.width !== px) { gl.cv.width = px; gl.cv.height = px; }
    gl.px = px / 100;
  }
  function merPath(c, s) {                     /* a meridian as the SVG draws it: pole to pole on the side it faces */
    var rx = Math.abs(s);
    c.moveTo(50, 6);
    if (rx < .05) c.lineTo(50, 94); else c.ellipse(50, 50, rx, 44, 0, -Math.PI / 2, Math.PI / 2, s < 0);
  }
  function merCore(rx) { return 0.9 - 0.18 * Math.max(0, Math.min(1, (rx - 13.6) / 22)); }
  function paintGlobe(gl, near) {
    var c = gl.ctx, L = gl.lines, i;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, gl.cv.width, gl.cv.height);
    c.setTransform(gl.px, 0, 0, gl.px, 0, 0);
    c.strokeStyle = gl.col;
    c.save();
    c.beginPath(); c.arc(50, 50, 44, 0, TAU); c.clip();
    /* the halo: every line wide, laid down whole, then the layer taken to .26 at once */
    c.lineWidth = 7; c.lineCap = 'butt'; c.beginPath();
    for (i = 0; i < L.length; i++) { c.moveTo(L[i].x + L[i].rx, L[i].y); c.ellipse(L[i].x, L[i].y, L[i].rx, L[i].ry, 0, 0, TAU); }
    for (i = 0; i < near.length; i++) merPath(c, near[i]);
    c.stroke();
    c.globalCompositeOperation = 'destination-in'; c.globalAlpha = .26; c.fillRect(0, 0, 100, 100);
    c.globalCompositeOperation = 'source-over';
    /* the cores, each at its own strength */
    c.lineWidth = 2.6; c.lineCap = 'round';
    for (i = 0; i < L.length; i++) { c.globalAlpha = L[i].o; c.beginPath(); c.moveTo(L[i].x + L[i].rx, L[i].y); c.ellipse(L[i].x, L[i].y, L[i].rx, L[i].ry, 0, 0, TAU); c.stroke(); }
    for (i = 0; i < near.length; i++) { c.globalAlpha = merCore(Math.abs(near[i])); c.beginPath(); merPath(c, near[i]); c.stroke(); }
    c.restore();
    /* the limb, over everything and unclipped (.gl-limb) */
    c.globalAlpha = 1; c.lineWidth = 3; c.beginPath(); c.arc(50, 50, 44, 0, TAU); c.stroke();
    if (!gl.shown) { gl.shown = true; gl.g.classList.add('gl--cv'); }
  }
  globes.forEach(function (gl) {
    sizeGlobe(gl);
    if ('ResizeObserver' in window) new ResizeObserver(function () { sizeGlobe(gl); }).observe(gl.g);
  });
  addEventListener('ow:hue', function () { globes.forEach(function (gl) { if (gl.ctx) gl.col = getComputedStyle(gl.g).color; }); });
  function light(gl, word) {
    gl.word = word;
    gl.items.forEach(function (it) {
      var on = gl.all || word === 'more' || (' ' + it.s.w + ' ').indexOf(' ' + word + ' ') >= 0;
      if (on && word !== 'more' && !gl.all) it.el.setAttribute('data-lit', ''); else it.el.removeAttribute('data-lit');
      if (on) it.el.removeAttribute('data-dim'); else it.el.setAttribute('data-dim', '');
    });
  }
  function draw(gl, turn) {
    if (!gl.box) sizeGlobe(gl);
    var box = gl.box || 1, k = box / 100;      /* the box is measured on resize, never read in a frame (it forced a layout each one) */
    var near = meridians(turn);
    if (gl.ctx && gl.px && gl.svgAtRest) paintGlobe(gl, near);
    else {
      gl.mers.forEach(function (pair, i) {
        var s = near[i], rx = s == null ? 0 : Math.abs(s);
        /* a half-ellipse from the north pole to the south, on the side its longitude faces; at 0 wide it is the straight axis */
        var d = s == null ? '' : 'M50 6A' + rx.toFixed(2) + ' 44 0 0 ' + (s >= 0 ? 1 : 0) + ' 50 94';
        pair[0].setAttribute('d', d); pair[1].setAttribute('d', d);
        /* the mark's core: its innermost meridian at .9, the others at .72 (kernel/mark.py), eased between as it turns */
        pair[1].setAttribute('opacity', merCore(rx).toFixed(3));
      });
      gl.svgAtRest = true;                     /* the SVG is drawn once, at rest; turning is the canvas's */
    }
    gl.items.forEach(function (it) {
      var q = project(it.s.lat, it.s.lng, turn);
      var a = Math.max(0, Math.min(1, (q.z - 0.08) / 0.22));
      if (it.el.hasAttribute('data-dim')) a *= 0.5;
      var o = a.toFixed(3), was = it.o; if (was !== o) { it.el.style.opacity = o; it.o = o; }
      it.cx = q.x * k; it.cy = q.y * k;      /* where it stands in the globe's box: the network reads this, never a rect (no thrash) */
      /* a sprite out of sight behind the globe is not moved (it never overlaps another, so it keeps one stacking order) */
      if (o !== '0.000' || was !== o) it.el.style.transform = 'translate3d(' + (it.cx - 9).toFixed(1) + 'px,' + (it.cy - 9).toFixed(1) + 'px,0)';
    });
  }
  /* ── 1b · THE NETWORK, IN STRAIGHT LINES (his brief of 2026-11-09, item 1; founder/1364 and his walk of 2026-11-08 before it) ──
     His words, in order. "Replace the predominantly circular/orbital connection aesthetic with a more distinctive, linear
     network. Use straight horizontal, vertical and branching connection paths." The Profiles and Centers beside the globe now
     stand on a grid, columns and rows that line up, and every connection runs along it: straight across a row, straight down a
     column, or round one or two soft corners through the lanes between them, never over another node. A share or an event
     BRANCHES: one trunk, then a branch to each person it reaches. A connection between the two sides runs level into the globe
     at its rim and comes out of the other side, so what crosses the page passes through Oneway.
     "Moving light pulses that represent information and transactions": each act sends a pulse, a short bright head with the
     platform's icon for that act riding it (OW.glyph, the Phosphor set, founder/886), and lights the line behind it.
     "Illuminated status indicators that communicate upcoming, pending, active and completed activity": the one receiving
     wears a small badge in the act's colour, the way an app marks an avatar: a clock while the connection forms (upcoming),
     an hourglass breathing while it waits (pending), the act's own icon while the pulse travels (active), a check when it
     lands (completed). The line is drawn the same way: a dim line is a connection not yet used, a lit line one in use,
     an arrow at its end where it lands (S39: arrows, not dots). No line on the landing is dashed or dotted (founder/1378, below).
     "Multiple independent interactions happening simultaneously ... Avoid making every animation wait for the previous one":
     up to four at once (three on a phone), each on its own clock, started at staggered moments, so they are always at
     different stages. "Vary animation speeds, timing, direction and intensity": each has its own pace, its own waits, its own
     depth, and runs either way along its line. "Allow connections to illuminate, activate, change state and fade naturally ...
     occasional new connections forming and existing ones disappearing": a used line draws itself in, lights, then withdraws
     from where it began; under them a few quiet lines of the network come and go on their own.
     His walk (2026-11-08): "make the dots ... more like the Little Big Planet type of lines that we have on the rest of the
     landing page, not ... little circular dots that are super spaced out": every line is the globe's own, a wide dim halo
     under a bright core, and no row of dots is drawn anywhere. "It should be 120 frames per second": the whole network is ONE
     canvas drawn once a frame, the nodes are placed once at layout, and only the riding icons move, by transform.
     "Maintain visual restraint. Animations must not compete with the headline": the band ends above .hero-h1 (as before), the
     halos stay dim and no filter or blur is used. "Where appropriate, subtly synchronize the network animation with the
     changing categories": each turn of the headline's word leans the next acts toward it (events: tickets and event posts,
     businesses: payments, orders, reservations) and dims the nodes it does not name. Under reduced motion it is drawn once,
     with one connection forming, one under way and one completed, and stands still. */
  var NET = (function () {
    var hero = $('#hero'), h1 = $('.hero-h1'), nav = $('#mainNav'), mark = $('.hero-mark'), heroGl = null;
    globes.forEach(function (gl) { if (gl.g.id === 'heroGlobe') heroGl = gl; });
    var cv = document.createElement('canvas');
    if (!hero || !h1 || !heroGl || !cv.getContext) return null;
    var ctx = cv.getContext('2d');
    if (!ctx) return null;

    /* WHAT MOVES: his scenarios (people sharing through Profiles; discovering businesses and Centers; reservations and
       purchases; messages and social interactions; events and local discoveries), one act each, each its own neon and never
       a yellow (his line of 2026-11-08). `fan` acts branch to up to that many. `w` is the headline words it answers to. */
    var ACTS = [
      { k: 'share',    c: '255,92,225', ic: 'image',           from: 'person', to: 'person', fan: 3, w: 'people communities' },
      { k: 'discover', c: '178,77,255', ic: 'map-pin',         from: 'person', to: 'open',           w: 'places cities' },
      { k: 'reserve',  c: '0,229,255',  ic: 'calendar-check',  from: 'person', to: 'stay',           w: 'places businesses' },
      { k: 'pay',      c: '0,255,133',  ic: 'currency-dollar', from: 'person', to: 'store',          w: 'businesses marketplaces' },
      { k: 'order',    c: '255,86,20',  ic: 'shopping-bag',    from: 'person', to: 'food',           w: 'businesses marketplaces' },
      { k: 'message',  c: '0,150,255',  ic: 'chat-circle',     from: 'person', to: 'person',         w: 'people cities' },
      { k: 'like',     c: '255,45,149', ic: 'heart',           from: 'person', to: 'any',            w: 'people' },
      { k: 'book',     c: '255,138,26', ic: 'ticket',          from: 'person', to: 'venue',          w: 'events' },
      { k: 'event',    c: '124,255,92', ic: 'calendar-star',   from: 'venue',  to: 'person', fan: 3, w: 'events communities' }
    ];
    ACTS.forEach(function (a) { a.rgb = 'rgb(' + a.c + ')'; });
    /* THE CAST, ON A GRID. `k` is its cell on the widest layout (column from the outer edge, row from the top, three by
       three a side), `t` on a tablet's two columns, `m` its row on a phone's one column of four; null leaves it out there.
       The cells are staggered so a row or a column usually has a clear run, and the cell nearest the globe in a row it
       spans is often left open, so a connection can run level into it. `d` is depth: size and brightness. */
    var FIELD = [
      { p: 'AV', hue: 302, w: 'people communities',      r: 'person',          side: -1, k: [1, 0], t: [0, 0], m: 0,    d: 1 },
      { c: 'restaurant',   w: 'places businesses',       r: 'food stay open',  side: -1, k: [2, 0], t: [1, 1], m: 1,    d: .84 },
      { c: 'shop',         w: 'businesses marketplaces', r: 'store open',      side: -1, k: [0, 1], t: [0, 2], m: 3,    d: .92 },
      { p: 'KD', hue: 345, w: 'people events',           r: 'person',          side: -1, k: [2, 1], t: [1, 2], m: 2,    d: .78 },
      { p: 'JL', hue: 214, w: 'people cities',           r: 'person',          side: -1, k: [1, 2], t: null,   m: null, d: .9 },
      { c: 'cafe',         w: 'businesses places',       r: 'food store open', side: -1, k: [0, 2], t: null,   m: null, d: .7 },
      { c: 'stadium',      w: 'events places',           r: 'venue open',      side: 1,  k: [0, 0], t: [0, 0], m: 0,    d: .94 },
      { p: 'RS', hue: 228, w: 'people cities',           r: 'person',          side: 1,  k: [2, 0], t: [0, 1], m: 2,    d: .8 },
      { p: 'LP', hue: 270, w: 'people communities',      r: 'person',          side: 1,  k: [0, 1], t: null,   m: null, d: .74 },
      { c: 'hotel',        w: 'places businesses',       r: 'stay open',       side: 1,  k: [1, 1], t: [1, 1], m: 1,    d: 1 },
      { p: 'TM', hue: 172, w: 'people marketplaces',     r: 'person',          side: 1,  k: [0, 2], t: [1, 2], m: 3,    d: .86 },
      { c: 'cinema',       w: 'events places',           r: 'venue open',      side: 1,  k: [2, 2], t: null,   m: null, d: .9 }
    ];
    /* the headline's words, and the acts each leans toward */
    var WORDS = { people: ['message', 'like', 'share'], places: ['discover', 'reserve'], communities: ['share', 'event'],
                  cities: ['discover', 'message'], events: ['book', 'event'], businesses: ['pay', 'order', 'reserve'],
                  marketplaces: ['pay', 'order'] };

    var layer = document.createElement('div');
    layer.className = 'gl-net'; layer.setAttribute('aria-hidden', 'true');
    cv.className = 'gl-net__cv'; layer.appendChild(cv);
    hero.insertBefore(layer, hero.firstChild);
    /* every element made once: the nodes with their badges, then a pool of riding icons */
    var nodes = FIELD.map(function (s, i) {
      var el = sprite(s);
      el.classList.add('gl-node');
      layer.appendChild(el);
      var badge = document.createElement('span');
      badge.className = 'gl-badge'; layer.appendChild(badge);
      return { i: i, s: s, el: el, face: el.firstChild, badge: badge, st: '', stAct: '', x: 0, y: 0, px: 30, on: false, busy: 0, hit: 0, lit: 1 };
    });
    var chips = [];
    for (var ci = 0; ci < 12; ci++) {
      var fly = document.createElement('span');
      fly.className = 'gl-fly'; layer.appendChild(fly);
      chips.push({ el: fly, icon: '', used: false, op: '', tx: '' });
    }
    function glyphFor(name) { return window.OW && OW.glyph ? OW.glyph(name, { w: 'f', sel: false }) : ''; }

    /* ── THE BAND AND THE GRID, measured from the page itself (offsets, never a transformed rect: the wordmark flies) ── */
    var W = 1, H = 1, GX = 0, GY = 0, GR = 1, MK = null, mode = 'wide', pad = 10, dpr = 1, SLOTS = 4;
    var CH_X = { '-1': [], '1': [] }, CH_Y = [], HUB_Y = [], BRIDGE_Y = [], REST_PAIRS = [], cache = {}, lineRGB = '120,160,255', lineCol = 'rgb(120,160,255)';
    function offs(el) { var x = 0, y = 0; while (el && el !== hero) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; }
    /* how far a node may reach at its own height: the globe's CIRCLE, not its box, and never under the wordmark (founder/1345) */
    function edgeAt(side, cy) {
      var dy = cy - GY, hw = Math.abs(dy) < GR + 8 ? Math.sqrt(Math.max(0, (GR + 8) * (GR + 8) - dy * dy)) : 0;
      var e = side < 0 ? GX - hw - 8 : GX + hw + 8;
      if (MK && cy > MK[2] - 8 && cy < MK[3] + 8) e = side < 0 ? Math.min(e, MK[0] - 8) : Math.max(e, MK[1] + 8);
      return e;
    }
    function measure() {
      W = Math.max(1, hero.clientWidth);
      var top = Math.max((nav ? nav.offsetHeight : 0) + 6, 6), ho = offs(h1);
      H = Math.max(60, ho[1] - 14 - top);
      layer.style.top = top + 'px'; layer.style.height = H + 'px';
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var go = offs(heroGl.g);
      GR = heroGl.g.offsetWidth / 2; GX = go[0] + GR; GY = go[1] - top + GR;
      if (mark && mark.offsetWidth) { var mo = offs(mark); MK = [mo[0], mo[0] + mark.offsetWidth, mo[1] - top, mo[1] - top + mark.offsetHeight]; }
      else MK = null;
      var g = getComputedStyle(document.documentElement).getPropertyValue('--land-globe').trim();
      if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(g)) lineRGB = g;
      lineCol = 'rgb(' + lineRGB + ')';
      var room = Math.min(GX - GR, W - GX - GR) - pad - 14;
      mode = room >= 360 ? 'wide' : room >= 190 ? 'mid' : 'narrow';
      SLOTS = mode === 'wide' ? 4 : 3;
      var cols = mode === 'wide' ? 3 : mode === 'mid' ? 2 : 1, rows = mode === 'narrow' ? 4 : 3;
      var pitch = cols > 1 ? Math.min(mode === 'wide' ? 158 : 150, room / (cols + .35)) : room;
      var L0 = pad + 14 + Math.max(0, (room - cols * pitch) / 2);
      var colX = [], rowY = [];
      for (var j = 0; j < cols; j++) colX.push(mode === 'narrow' ? Math.max(pad + 22, (GX - GR) * .46) : L0 + (j + .5) * pitch);
      for (var r = 0; r < rows; r++) rowY.push((r + .5) * H / rows);
      nodes.forEach(function (n) {
        var s = n.s, cell = mode === 'wide' ? s.k : mode === 'mid' ? s.t : (s.m == null ? null : [0, s.m]);
        n.on = false; n.busy = 0;
        if (cell) {
          var base = (s.p ? PERSON_PX : PLAIN_PIN_PX) * 1.3;
          var px = Math.round(base * (mode === 'narrow' ? .92 + .14 * s.d : .8 + .3 * s.d));
          var x = colX[cell[0]], y = Math.min(H - px / 2 - 2, Math.max(px / 2 + 2, rowY[cell[1]]));
          if (s.side > 0) x = W - x;
          var edge = edgeAt(s.side, y);
          if (s.side < 0 ? x + px / 2 <= edge : x - px / 2 >= edge) {
            n.on = true; n.x = x; n.y = y; n.px = px;
            n.face.style.setProperty('--face', px + 'px'); n.el.style.setProperty('--face', px + 'px');
            n.el.style.transform = 'translate3d(' + (x - 9).toFixed(1) + 'px,' + (y - 9).toFixed(1) + 'px,0)';
            n.el.style.zIndex = String(10 + Math.round(s.d * 40));
            n.lit = .76 + .24 * s.d;
            n.el.style.opacity = (n.el.hasAttribute('data-dim') ? n.lit * .78 : n.lit).toFixed(3);
            n.badge.style.left = (x + px * .36).toFixed(1) + 'px'; n.badge.style.top = (y - px * .36).toFixed(1) + 'px';
          }
        }
        n.el.style.display = n.on ? '' : 'none';
        setBadge(n, '', null);
      });
      /* the lanes between the columns and the rows, where a turning connection runs */
      CH_X = { '-1': [], '1': [] }; CH_Y = []; HUB_Y = []; BRIDGE_Y = [];
      for (j = 0; j + 1 < cols; j++) { var mx = (colX[j] + colX[j + 1]) / 2; CH_X['-1'].push(mx); CH_X['1'].push(W - mx); }
      if (cols > 1) { var outer = colX[0] - (colX[1] - colX[0]) / 2; if (outer > pad + 4) { CH_X['-1'].push(outer); CH_X['1'].push(W - outer); } }
      for (r = 0; r + 1 < rows; r++) CH_Y.push((rowY[r] + rowY[r + 1]) / 2);
      /* a level run into the globe is only taken where it meets the rim squarely, and never beside the wordmark */
      rowY.concat(CH_Y, [GY]).forEach(function (y) {
        var inMark = MK && y > MK[2] - 10 && y < MK[3] + 10;
        if (!inMark && Math.abs(y - GY) < GR * .8 && !HUB_Y.some(function (h) { return Math.abs(h - y) < 18; })) HUB_Y.push(y);
        if (!inMark && Math.abs(y - GY) > GR + 8 && y > 6 && y < H - 6) BRIDGE_Y.push(y);
      });
      cache = {};
      /* the quiet network underneath: neighbours with a clean, short run between them */
      REST_PAIRS = [];
      var on = nodes.filter(function (n) { return n.on; }), near = (mode === 'narrow' ? 2.2 : 2.6) * Math.max(80, pitch);
      for (var a = 0; a < on.length; a++) for (var b = a + 1; b < on.length; b++) {
        var A = on[a], B = on[b];
        if (A.s.side !== B.s.side || Math.abs(A.x - B.x) + Math.abs(A.y - B.y) > near) continue;
        if (route(A, B)) REST_PAIRS.push([A, B]);
      }
      reset();
    }

    /* ── ROUTES: straight across, straight down, or round soft corners through the lanes; never over a node, the globe or
       the wordmark. A run between the two sides goes level into the globe at its rim and leaves from the other rim. ── */
    function blocked(x0, y0, x1, y1, a, b, gap) {
      if (Math.min(x0, x1) < 3 || Math.max(x0, x1) > W - 3 || Math.min(y0, y1) < 3 || Math.max(y0, y1) > H - 3) return true;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.on || n === a || n === b) continue;
        var cx = Math.max(Math.min(x0, x1), Math.min(Math.max(x0, x1), n.x)), cy = Math.max(Math.min(y0, y1), Math.min(Math.max(y0, y1), n.y));
        if (Math.hypot(n.x - cx, n.y - cy) < n.px / 2 + 8) return true;
      }
      if (MK && Math.max(x0, x1) > MK[0] - 8 && Math.min(x0, x1) < MK[1] + 8 && Math.max(y0, y1) > MK[2] - 8 && Math.min(y0, y1) < MK[3] + 8) return true;
      if (!gap) {
        var qx = Math.max(Math.min(x0, x1), Math.min(Math.max(x0, x1), GX)), qy = Math.max(Math.min(y0, y1), Math.min(Math.max(y0, y1), GY));
        if (Math.hypot(GX - qx, GY - qy) < GR + 6) return true;
      }
      return false;
    }
    function route(a, b) {
      var key = a.i + '>' + b.i;
      if (key in cache) return cache[key];
      var best = null, score = 1e9;
      function take(pts, gapAt) {
        for (var i = 0; i + 3 < pts.length; i += 2) if (blocked(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], a, b, gapAt >= 0 && Math.abs(i - gapAt) <= 2)) return;
        var len = 0;
        for (i = 2; i < pts.length; i += 2) len += Math.abs(pts[i] - pts[i - 2]) + Math.abs(pts[i + 1] - pts[i - 1]);
        var sc = len + (pts.length / 2 - 2) * 70;
        if (sc < score) { score = sc; best = { pts: pts, gapAt: gapAt }; }
      }
      var ax = a.x, ay = a.y, bx = b.x, by = b.y;
      if (a.s.side === b.s.side) {
        if (Math.abs(ay - by) < .5 || Math.abs(ax - bx) < .5) take([ax, ay, bx, by], -1);
        else {
          take([ax, ay, bx, ay, bx, by], -1);
          take([ax, ay, ax, by, bx, by], -1);
          CH_X[a.s.side].forEach(function (x) { if ((x - ax) * (x - bx) < 0) take([ax, ay, x, ay, x, by, bx, by], -1); });
          CH_Y.forEach(function (y) { if ((y - ay) * (y - by) < 0) take([ax, ay, ax, y, bx, y, bx, by], -1); });
        }
      } else {
        var L = a.s.side < 0 ? a : b, R = L === a ? b : a;
        HUB_Y.forEach(function (y) {
          var dy = y - GY, hw = Math.sqrt(Math.max(0, GR * GR - dy * dy)), l = GX - hw - 3, r = GX + hw + 3;
          var pts = (Math.abs(L.y - y) < .5 ? [L.x, y] : [L.x, L.y, L.x, y]).concat([l, y, r, y]).concat(Math.abs(R.y - y) < .5 ? [R.x, y] : [R.x, y, R.x, R.y]);
          var gapAt = Math.abs(L.y - y) < .5 ? 2 : 4;   /* the run from rim to rim, which is never drawn */
          if (L !== a) { var rev = []; for (var i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]); pts = rev; gapAt = pts.length - 4 - gapAt; }
          take(pts, gapAt);
        });
        BRIDGE_Y.forEach(function (y) { take(Math.abs(ay - y) < .5 && Math.abs(by - y) < .5 ? [ax, ay, bx, by] : [ax, ay, ax, y, bx, y, bx, by], -1); });
      }
      return (cache[key] = best ? build(best.pts, best.gapAt) : null);
    }
    /* the run as a dense line with soft corners, and its length at every point, so a pulse moves at an even pace */
    function build(pts, gapAt) {
      var X = [pts[0]], Y = [pts[1]], n = pts.length / 2, R = 12, at = [0];
      for (var i = 1; i < n - 1; i++) {
        var px = pts[2 * i - 2], py = pts[2 * i - 1], cx = pts[2 * i], cy = pts[2 * i + 1], nx = pts[2 * i + 2], ny = pts[2 * i + 3];
        var l1 = Math.hypot(cx - px, cy - py) || 1, l2 = Math.hypot(nx - cx, ny - cy) || 1;
        var d1x = (cx - px) / l1, d1y = (cy - py) / l1, d2x = (nx - cx) / l2, d2y = (ny - cy) / l2;
        if (Math.abs(d1x * d2y - d1y * d2x) < 1e-3) { X.push(cx); Y.push(cy); at.push(X.length - 1); continue; }
        var r = Math.min(R, l1 / 2, l2 / 2), sx = cx - d1x * r, sy = cy - d1y * r, ex = cx + d2x * r, ey = cy + d2y * r;
        for (var k = 0; k <= 6; k++) { var t = k / 6, m = 1 - t; X.push(m * m * sx + 2 * m * t * cx + t * t * ex); Y.push(m * m * sy + 2 * m * t * cy + t * t * ey); }
        at.push(X.length - 4);
      }
      X.push(pts[2 * n - 2]); Y.push(pts[2 * n - 1]); at.push(X.length - 1);
      var S = new Float32Array(X.length);
      for (i = 1; i < X.length; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
      var P = { x: new Float32Array(X), y: new Float32Array(Y), s: S, len: S[S.length - 1], g0: 0, g1: 0 };
      if (gapAt >= 0) { P.g0 = S[at[gapAt / 2]]; P.g1 = S[at[gapAt / 2 + 1]]; }
      var e = X.length - 1, dx = X[e] - X[e - 1], dy = Y[e] - Y[e - 1], dl = Math.hypot(dx, dy) || 1;
      P.dx = dx / dl; P.dy = dy / dl;
      return P;
    }
    var atX = 0, atY = 0;
    function at(P, s) {
      var S = P.s, lo = 1, hi = S.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (S[mid] < s) lo = mid + 1; else hi = mid; }
      var f = (s - S[lo - 1]) / ((S[lo] - S[lo - 1]) || 1);
      atX = P.x[lo - 1] + (P.x[lo] - P.x[lo - 1]) * f; atY = P.y[lo - 1] + (P.y[lo] - P.y[lo - 1]) * f;
    }
    function seg(P, s0, s1) {                             /* the run between two lengths, added to the canvas's path */
      if (s1 - s0 < .4) return;
      var S = P.s, X = P.x, Y = P.y, i = 1, n = S.length;
      while (i < n - 1 && S[i] < s0) i++;
      var f = (s0 - S[i - 1]) / ((S[i] - S[i - 1]) || 1);
      ctx.moveTo(X[i - 1] + (X[i] - X[i - 1]) * f, Y[i - 1] + (Y[i] - Y[i - 1]) * f);
      while (i < n - 1 && S[i] < s1) { ctx.lineTo(X[i], Y[i]); i++; }
      f = (s1 - S[i - 1]) / ((S[i] - S[i - 1]) || 1);
      ctx.lineTo(X[i - 1] + (X[i] - X[i - 1]) * f, Y[i - 1] + (Y[i] - Y[i - 1]) * f);
    }
    function span(P, s0, s1) { if (P.g1 > P.g0) { seg(P, s0, Math.min(s1, P.g0)); seg(P, Math.max(s0, P.g1), s1); } else seg(P, s0, s1); }
    function stroke(rgb, alpha, width) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = rgb; ctx.lineWidth = width;
      ctx.stroke(); ctx.beginPath();
    }
    /* a dashed stretch: each piece on its own, its pattern laid from the start of the line, so the dashes never crawl */
    function dashed(P, s0, s1, rgb, alpha, width, dash) {
      ctx.setLineDash(dash);
      var parts = P.g1 > P.g0 ? [[s0, Math.min(s1, P.g0)], [Math.max(s0, P.g1), s1]] : [[s0, s1]];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i][1] - parts[i][0] < .4) continue;
        ctx.lineDashOffset = parts[i][0];
        seg(P, parts[i][0], parts[i][1]); stroke(rgb, alpha, width);
      }
      ctx.setLineDash(NO_DASH);
    }
    /* NOT YET USED IS DIM, NEVER DASHED (founder/1378: "make the dots ... more like the Little Big Planet type of lines that we have on the
       rest of the landing page, not ... little circular dots that are super spaced out"): a 1.4 px core broken 7 on 6 read as a row of
       beads at 390; the line not yet used is now the globe's own drawing, whole, at a third of a lit one's strength */
    var NO_DASH = [], DASH = NO_DASH;

    /* ── THE BADGE: what the node it sits on is about to receive, is waiting for, is receiving, or has received ── */
    var BADGE_IC = { up: 'clock', pend: 'hourglass-medium', done: 'check' };
    function setBadge(n, st, act) {
      var ic = st === 'run' ? act.ic : BADGE_IC[st] || '', key = st + (act ? act.k : '');
      if (n.st === key) return;
      n.st = key;
      if (!st) { n.badge.removeAttribute('data-st'); return; }
      n.badge.style.setProperty('--c', act.c);
      if (n.stAct !== ic) { n.badge.innerHTML = glyphFor(ic); n.stAct = ic; }
      n.badge.setAttribute('data-st', st);
    }
    function hit(n, act, now, sending) {
      n.el.style.setProperty('--hit', act.c);
      n.el.setAttribute('data-hit', sending ? 'send' : 'take');
      n.hit = now + (sending ? 520 : 900);
    }

    /* ── CHOOSING WHAT HAPPENS NEXT: never the same act twice running, never the same pair, leaning to the headline's word ── */
    var bag = [], lastAct = '', lastPair = '', want = null, wantN = 0, word = 'more';
    function nextAct() {
      if (want && wantN > 0) {
        wantN--;
        var w = want.filter(function (k) { return k !== lastAct; });
        var k = (w.length ? w : want)[(Math.random() * (w.length || want.length)) | 0];
        for (var i = 0; i < ACTS.length; i++) if (ACTS[i].k === k) return ACTS[i];
      }
      if (!bag.length) {
        bag = ACTS.slice();
        for (i = bag.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
        if (bag[bag.length - 1].k === lastAct && bag.length > 1) bag.unshift(bag.pop());
      }
      return bag.pop();
    }
    function plays(n, role) { return role === 'any' || (' ' + n.s.r + ' ').indexOf(' ' + role + ' ') >= 0; }
    function named(n) { return word === 'more' || (' ' + n.s.w + ' ').indexOf(' ' + word + ' ') >= 0; }
    function shuffle(list) { for (var i = list.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = list[i]; list[i] = list[j]; list[j] = t; } return list; }
    function free(role, but) {
      return shuffle(nodes.filter(function (n) { return n.on && !n.busy && n !== but && plays(n, role); }))
        .sort(function (p, q) { return (named(q) ? 1 : 0) - (named(p) ? 1 : 0); });
    }
    /* a branching act: one trunk from the sender along a lane, then a branch to each one it reaches */
    function fan(a, act) {
      var to = free(act.to, a).filter(function (n) { return n.s.side === a.s.side; }), best = null;
      function tryTrunk(make) {
        var got = [];
        to.forEach(function (b) {
          if (got.length >= act.fan) return;
          var pts = make(b);
          if (!pts) return;
          for (var i = 0; i + 3 < pts.length; i += 2) if (blocked(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], a, b, false)) return;
          got.push({ n: b, P: build(pts, -1) });
        });
        if (got.length >= 2 && (!best || got.length > best.length)) best = got;
      }
      CH_X[a.s.side].forEach(function (x) {
        tryTrunk(function (b) { return (x - a.x) * (x - b.x) < 0 ? (Math.abs(b.y - a.y) < .5 ? [a.x, a.y, b.x, b.y] : [a.x, a.y, x, a.y, x, b.y, b.x, b.y]) : null; });
      });
      CH_Y.forEach(function (y) {
        tryTrunk(function (b) { return (y - a.y) * (y - b.y) < 0 ? (Math.abs(b.x - a.x) < .5 ? [a.x, a.y, b.x, b.y] : [a.x, a.y, a.x, y, b.x, y, b.x, b.y]) : null; });
      });
      return best;
    }
    var flows = [], rests = [], nextAt = 0, restAt = 0, last = 0, frozen = false;
    function rand(a, b) { return a + Math.random() * (b - a); }
    function launch(now, ago) {
      var act = nextAct(), a = null, branches = null;
      var from = free(act.from, null);
      for (var fi = 0; fi < from.length && !branches; fi++) {
        a = from[fi];
        if (act.fan && Math.random() < .8) { branches = fan(a, act); if (branches) break; }
        var to = free(act.to, a), tries = 0;
        for (var ti = 0; ti < to.length && tries < 8; ti++) {
          var b = to[ti], P = route(a, b);
          if (!P || P.len < (mode === 'narrow' ? 54 : 96)) continue;
          tries++;
          if (a.i + '>' + b.i === lastPair && to.length > 1) continue;
          branches = [{ n: b, P: P }];
          break;
        }
      }
      if (!branches) { bag.unshift(act); return null; }
      lastAct = act.k; lastPair = a.i + '>' + branches[0].n.i;
      var f = { act: act, a: a, br: [], born: now - (ago || 0), up: rand(420, 1200), pend: rand(220, 820),
                v: mode === 'narrow' ? rand(105, 210) : rand(140, 330), hold: rand(260, 640), out: rand(820, 1500),
                I: .74 + .26 * Math.min(1, (a.s.d + branches[0].n.s.d) / 2) * rand(.86, 1), sent: false, end: 0, st: '' };
      a.busy = 1;
      branches.forEach(function (x) {
        x.n.busy = 1;
        var c = null;
        for (var i = 0; i < chips.length; i++) if (!chips[i].used) { c = chips[i]; break; }
        if (c) {
          c.used = true;
          if (c.icon !== act.ic) { c.el.innerHTML = glyphFor(act.ic); c.icon = act.ic; }
          c.el.style.setProperty('--c', act.c);
        }
        f.br.push({ n: x.n, P: x.P, sa: a.px / 2 + 4, sb: Math.max(a.px / 2 + 8, x.P.len - x.n.px / 2 - 6), chip: c, got: false, st: '' });
      });
      var longest = 0;
      f.br.forEach(function (x) { longest = Math.max(longest, x.sb - x.sa); });
      f.run = Math.max(700, Math.min(3400, longest / f.v * 1000));
      f.v = longest / f.run * 1000;
      f.end = f.up + f.pend + f.run + f.hold + f.out;
      flows.push(f);
      return f;
    }
    function finish(f) {
      f.a.busy = 0;
      f.br.forEach(function (x) {
        x.n.busy = 0; setBadge(x.n, '', null);
        if (x.chip) { x.chip.used = false; chipAt(x.chip, -1, 0, 0); }
      });
    }
    function chipAt(c, op, x, y) {
      var o = op < 0 ? '0' : op.toFixed(2);
      if (c.op !== o) { c.el.style.opacity = o; c.op = o; }
      if (op > 0) c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
    function reset() {
      flows.forEach(finish); flows = []; rests = [];
      chips.forEach(function (c) { c.used = false; chipAt(c, -1, 0, 0); });
      nextAt = 0; restAt = 0; last = 0;
    }

    /* ── ONE FRAME: every line on one canvas, the icons by transform, the badges only when their state changes ── */
    function ease(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
    function step(now) {
      if (last && now - last > 250) {                     /* a hidden tab or a scrolled-away hero: pick up where it left off */
        var gap = now - last - 16;
        flows.forEach(function (f) { f.born += gap; }); rests.forEach(function (r) { r.born += gap; });
        nextAt += gap; restAt += gap;
      }
      last = now;
      if (!frozen) {
        if (!flows.length && !nextAt) {                   /* the first frame opens on a network already at work */
          launch(now, rand(2600, 3400)); launch(now, rand(900, 1500)); launch(now, rand(0, 400));
          nextAt = now + rand(300, 700);
        }
        if (flows.length < SLOTS && now >= nextAt) nextAt = now + (launch(now) ? rand(320, 1150) * (mode === 'narrow' ? 1.25 : 1) : 260);
        if (!rests.length && !restAt) for (var q = 0; q < 3; q++) addRest(now, 1400);
        if (rests.length < (mode === 'wide' ? 5 : mode === 'mid' ? 4 : 3) && now >= restAt) { addRest(now, 0); restAt = now + rand(900, 2200); }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      /* the quiet network: hairlines in the page's own globe colour, a faint halo under each, drawing in and withdrawing */
      for (var ri = rests.length - 1; ri >= 0; ri--) {
        var R = rests[ri], e = now - R.born, P = R.P;
        if (e > R.life + 900) { rests.splice(ri, 1); continue; }
        var grow = ease(e / 900), gone = ease((e - R.life) / 900);
        span(P, R.sa + (R.sb - R.sa) * gone, R.sa + (R.sb - R.sa) * grow); stroke(lineCol, .06, 5);
        span(P, R.sa + (R.sb - R.sa) * gone, R.sa + (R.sb - R.sa) * grow); stroke(lineCol, .26, 1);
      }
      for (var fi = flows.length - 1; fi >= 0; fi--) {
        var f = flows[fi], t = now - f.born;
        if (t >= f.end) { finish(f); flows.splice(fi, 1); continue; }
        var A = f.act, I = f.I, tRun = t - f.up - f.pend, tOut = tRun - f.run - f.hold;
        var st = t < f.up ? 'up' : t < f.up + f.pend ? 'pend' : 'run';
        if (st === 'run' && !f.sent) { f.sent = true; hit(f.a, A, now, true); }
        for (var bi = 0; bi < f.br.length; bi++) {
          var B = f.br[bi], Q = B.P, sa = B.sa, sb = B.sb, L = sb - sa;
          var head = st === 'run' ? Math.min(sb, sa + Math.max(0, tRun) * f.v / 1000) : sa;
          var arrived = st === 'run' && head >= sb - .5;
          if (arrived && !B.got) { B.got = true; hit(B.n, A, now, false); }
          setBadge(B.n, tOut > f.out * .55 ? '' : arrived ? 'done' : st, A);
          var from = tOut > 0 ? sa + L * ease(tOut / f.out) : sa;   /* a used line withdraws from where it began */
          var fade = tOut > 0 ? 1 - ease(tOut / f.out) * .55 : 1;
          /* the line itself: dim and whole while it is not yet in use (it draws itself in while upcoming), lit where a pulse has been */
          var formed = st === 'up' ? ease(t / Math.min(f.up, 520)) : 1;
          var breathe = st === 'pend' ? .12 * Math.sin(now / 140) : 0;
          if (head < sb) {
            span(Q, Math.max(from, head), sa + L * formed); stroke(A.rgb, I * .07, 6);
            dashed(Q, Math.max(from, head), sa + L * formed, A.rgb, I * (.42 + breathe), 1.4, DASH);
          }
          if (head > from) {
            span(Q, from, head); stroke(A.rgb, I * .15 * fade, 8);
            span(Q, from, head); stroke(A.rgb, I * .92 * fade, 2.2);
          }
          if (st === 'run' && !arrived) {                     /* the pulse: a short bright head, white at its tip */
            span(Q, Math.max(sa, head - 34), head); stroke(A.rgb, I, 3.2);
            span(Q, Math.max(sa, head - 10), head); stroke('#fff', .75 * I, 1.4);
          }
          if (st === 'run') {                                 /* the arrow where it lands */
            at(Q, sb);
            var ux = Q.dx, uy = Q.dy, ah = arrived ? fade : .4;
            ctx.moveTo(atX - ux * 6 - uy * 4.6, atY - uy * 6 + ux * 4.6); ctx.lineTo(atX, atY); ctx.lineTo(atX - ux * 6 + uy * 4.6, atY - uy * 6 - ux * 4.6);
            stroke(A.rgb, I * ah, 1.9);
          }
          if (B.chip) {
            var inside = Q.g1 > Q.g0 && head > Q.g0 - 4 && head < Q.g1 + 4;
            var op = st !== 'run' || arrived || inside ? -1 : Math.min(1, (head - sa) / 18);
            if (op > 0) { at(Q, head); chipAt(B.chip, op, atX, atY); } else chipAt(B.chip, -1, 0, 0);
          }
        }
      }
      ctx.globalAlpha = 1; ctx.setLineDash(NO_DASH);
      for (var ni = 0; ni < nodes.length; ni++) { var n = nodes[ni]; if (n.hit && now > n.hit) { n.hit = 0; n.el.removeAttribute('data-hit'); } }
    }
    function addRest(now, ago) {
      if (!REST_PAIRS.length) return;
      for (var tries = 0; tries < 6; tries++) {
        var p = REST_PAIRS[(Math.random() * REST_PAIRS.length) | 0], P = route(p[0], p[1]);
        if (!P || rests.some(function (r) { return r.P === P; })) continue;
        rests.push({ P: P, sa: p[0].px / 2 + 4, sb: P.len - p[1].px / 2 - 4, born: now - ago, life: rand(3200, 8200) });
        return;
      }
    }

    function light(w) {
      word = w;
      want = WORDS[w] || null; wantN = want ? 2 : 0;
      if (want && flows.length < SLOTS) nextAt = Math.min(nextAt, last + 160);   /* the word's own act comes in soon, not at once */
      nodes.forEach(function (n) {
        var on = w === 'more' || (' ' + n.s.w + ' ').indexOf(' ' + w + ' ') >= 0;
        if (on && w !== 'more') n.el.setAttribute('data-lit', ''); else n.el.removeAttribute('data-lit');
        if (on) n.el.removeAttribute('data-dim'); else n.el.setAttribute('data-dim', '');
        n.el.style.opacity = ((on ? 1 : .78) * (n.lit || 1)).toFixed(3);
      });
    }
    /* reduced motion: one connection forming, one under way, one completed, and the quiet lines, drawn once and held */
    function freeze() {
      frozen = true; reset();
      var T = 100000, f;
      if ((f = launch(T))) f.born = T - f.up * .9;
      if ((f = launch(T))) f.born = T - (f.up + f.pend + f.run * .55);
      if ((f = launch(T))) f.born = T - (f.up + f.pend + f.run + f.hold * .5);
      for (var q = 0; q < 3; q++) addRest(T, 1400);
      step(T);
    }
    measure();
    return { measure: measure, step: step, light: light, freeze: freeze };
  })();

  var TURN0 = 0, PERIOD = 90000, t0 = performance.now();   /* at rest (and still, under reduced motion) the globe is the mark exactly */
  globes.forEach(function (gl) { light(gl, 'more'); draw(gl, TURN0); });
  if (NET) { NET.measure(); if (still) NET.freeze(); }
  if (globes.length && !still) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { globes.forEach(function (gl) { if (gl.g === e.target) gl.seen = e.isIntersecting; }); }); });
      globes.forEach(function (gl) { gl.seen = false; io.observe(gl.g); });
    }
    /* 120 FPS, OR WHATEVER THE SCREEN CAN DO (the founder, 2026-11-08: "it must run at 120fps / 120Hz - as smooth as
       possible", of this animation). It was gated at `now - last < 33`, a hard 33 ms between frames - about 30 fps, half of
       a 60 Hz screen and a QUARTER of his. Taking the gate off is safe because nothing here counts frames: `turn` is
       (now - t0) / PERIOD and the network is handed `now`, so both are time-based and the motion runs at exactly the same
       speed - only the number of steps it is drawn in changes. requestAnimationFrame already paces to the display, so a
       120 Hz screen gets 120 and a 60 Hz screen gets 60. The work stays bounded the way it already was: a globe draws only
       while it is on screen (gl.seen) and the network steps only while the hero is. */
    (function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      var turn = TURN0 - ((now - t0) / PERIOD) * 360;
      globes.forEach(function (gl) { if (gl.seen) draw(gl, turn); });
      if (NET && heroSeen()) NET.step(now);      /* the network rides the globe's one frame (founder/1364 §7) */
    })(t0);
  }
  function heroSeen() { for (var i = 0; i < globes.length; i++) if (globes[i].g.id === 'heroGlobe') return globes[i].seen; return false; }
  var sizing = 0;
  /* THE BAND FOLLOWS THE HERO'S OWN BOX, not only the window: the wordmark's picture and the font land after this script
     runs and move the headline, and a network measured before them can run a line under the wordmark (seen on a phone) */
  if (NET && 'ResizeObserver' in window && $('.hero-inner')) {
    var boxW = 0, boxH = 0;
    new ResizeObserver(function (es) {
      var r = es[0].contentRect;
      if (Math.abs(r.width - boxW) < 1 && Math.abs(r.height - boxH) < 1) return;
      boxW = r.width; boxH = r.height;
      clearTimeout(sizing);
      sizing = setTimeout(function () { NET.measure(); if (still) NET.freeze(); }, 120);
    }).observe($('.hero-inner'));
  }
  addEventListener('resize', function () {
    globes.forEach(function (gl) { draw(gl, TURN0 - ((performance.now() - t0) / PERIOD) * 360 * (still ? 0 : 1)); });
    if (!NET) return;
    clearTimeout(sizing);                        /* the band is re-measured once the window settles, never per resize event */
    sizing = setTimeout(function () { NET.measure(); if (still) NET.freeze(); }, 120);
  }, { passive: true });

  /* ── 2 · THE ROTATING WORD: "more" is what the server sends; the others are drawn here, and each lights its own sprites ── */
  (function () {
    var word = $('#heroWord'), hero = globes.filter(function (gl) { return gl.g.id === 'heroGlobe'; })[0];
    if (!word || still) return;
    word.setAttribute('aria-hidden', 'true');
    var sentence = word.closest('h1');
    if (sentence) sentence.setAttribute('aria-label', 'Meet Oneway. The social media that connects more.');
    var words = ['more', 'people', 'places', 'communities', 'cities', 'events', 'businesses', 'marketplaces'];
    /* ITS COLOURS MUST BE BRIGHT AND READABLE AT EVERY POINT (founder/1364 §1: "DO NOT USE DIM PURPLE FOR THE ROTATING
       HEADLINE"). One neon per word, from his palette and no yellow in it: electric blue, hot pink, neon green, bright
       purple, cyan, orange, magenta, lime. The colour is set while the word is swapped out, so no step of the swap shows
       a word half in one colour; home.css holds the first one for the server's "more." and for reduced motion. */
    var WORD_C = ['#4FC8FF', '#FF3D9A', '#00F0A0', '#B36BFF', '#22D9FF', '#FF8A3D', '#FF5CE1', '#7CFF5C'];
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % words.length;
      word.classList.add('sw');
      setTimeout(function () {
        word.textContent = words[i] + '.';
        word.style.color = WORD_C[i];
        word.classList.remove('sw');
        if (hero) light(hero, words[i]);
        if (NET) NET.light(words[i]);
      }, 260);
    }, 2400);
  })();

  /* ── 3 · ON A PHONE, THE LATER PARAGRAPHS WAIT BEHIND ONE PRESS. They stay in the HTML (a search engine and find-in-page read
     them: hidden="until-found"); on a computer every word shows. ── */
  var phone = matchMedia('(max-width: 1023px)');
  $$('.hm-more').forEach(function (more) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'hm-more-btn'; btn.textContent = 'Read more';
    btn.setAttribute('aria-expanded', 'false');
    var open = function () { more.hidden = false; more.removeAttribute('hidden'); btn.remove(); };
    btn.addEventListener('click', open);
    more.addEventListener('beforematch', open);
    var opened = false;
    btn.addEventListener('click', function () { opened = true; });
    more.addEventListener('beforematch', function () { opened = true; });
    function fit() {
      if (opened) return;
      if (phone.matches) { more.setAttribute('hidden', 'until-found'); if (!btn.isConnected) more.parentNode.insertBefore(btn, more.nextSibling); }
      else { more.removeAttribute('hidden'); if (btn.isConnected) btn.remove(); }
    }
    fit();
    if (phone.addEventListener) phone.addEventListener('change', fit);
  });

  /* ── 4 · THE STRIP: the platform's own Centers (founder/791, 829), dealt by OW.cards and drawn when it comes into view; on the
     published copy the build names the file of reviewed Centers (window.owStrip; tools/landing_static.py STRIP_*) ── */
  var run = $('#ecoRun'), strip = $('#ecoStrip');
  if (run && strip && 'IntersectionObserver' in window) {
    var asked = false;
    var watch = new IntersectionObserver(function (es) {
      if (asked || !es.some(function (e) { return e.isIntersecting; })) return;
      asked = true; watch.disconnect();
      if (window.OW && OW.cards) { deal(); return; }   /* the page loads the renderer for its decks (5); else it comes now */
      var s = document.createElement('script'); s.src = run.getAttribute('data-cards-js'); s.onload = deal; document.body.appendChild(s);
    }, { rootMargin: '400px 0px' });
    watch.observe(run.parentNode);
  }
  function deal() {
    if (!window.OW || !OW.cards) return;
    var published = window.owStrip;
    var dealing = published
      ? fetch(published).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return (j && j.cards) || []; }).catch(function () { return []; })
      : OW.cards.deck('center', 12);
    dealing.then(function (cs) {
      cs = (cs || []).slice();
      if (cs.length < 4) return;                    /* nothing to show is shown as nothing (402) */
      function make(c, dup) {
        var b = OW.cards.node(c, { as: 'chip', className: 'eco-it', onOpen: published ? false : function (x) { location.href = '/app' + (x.app || ''); } });
        if (published || dup) { b.tabIndex = -1; b.removeAttribute('aria-label'); }
        if (dup) b.setAttribute('aria-hidden', 'true');
        return b;
      }
      cs.forEach(function (c) { strip.appendChild(make(c, false)); });
      cs.forEach(function (c) { strip.appendChild(make(c, true)); });
      run.hidden = false;
      var w = strip.scrollWidth / 2; if (w > 0) strip.style.animationDuration = Math.max(46, Math.round(w / 26)) + 's';
    });
  }

  /* ── 5 · THE DECKS, as the page drew them before founder/1058's rewrites (021290968^1; founder/1081): the founder's example
     profiles and Centers (frontend/landing/examples.js, his placeholders of 2026-10-17: "we are gonna publish the placeholders for
     now its alright if nothings clickable"), each drawn by the one card renderer through OW.lcard and stacked by OW.deck with
     their faces to press. Nothing on them opens, and the page says they are examples. With no script the decks take no room. */
  if (window.OW && OW.deck && OW.landingExamples && OW.lcard) {
    var pd = $('#deck'), cd = $('#cnDeck');
    if (pd) OW.deck.people(pd, $('#deckFaces'), OW.landingExamples.people, { make: OW.lcard, fit: true });
    if (cd) OW.deck.people(cd, $('#cnFaces'), OW.landingExamples.centers, { make: OW.lcard, fit: true });
  }

  /* ── 6 · THE SECTIONS THAT WERE WORDS ONLY, DRAWN IN THE PAGE'S OWN MATERIAL (founder/1082: "the whole landing page still has a
     lot of issues though try to perfect it"; founder/1081: keep the previous character, no screenshots). Each scene is made of
     what the page already draws and adds no word of its own: the example cards (examples.js through OW.lcard), the map's sprites
     (section 1), the place marks (OW.placeRow.mark), the platforms' own marks (the wheel's), the globe's lines, in the page's hue.
     Every one is aria-hidden: his words beside it say what it shows. Under reduced motion each stands still. */
  function node(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function face(s, px) {                       /* a map sprite standing on its own (section 1's drawing) */
    var el = sprite(s); el.classList.add('sc-pin'); el.style.opacity = '1';
    if (px) { el.firstChild.style.setProperty('--face', px + 'px'); el.style.setProperty('--face', px + 'px'); }   /* the pin's own glow is sized from this too */
    return el;
  }
  function wheelMark(name) {                   /* a platform's own mark, as the wheel draws it */
    var a = $$('#connected .owpl-i').filter(function (x) { return (x.getAttribute('aria-label') || '').split(',')[0] === name; })[0];
    var mk = a && $('.owpl-mk', a);
    if (!mk) return null;
    var chip = node('span', 'sc-mark'); chip.appendChild(mk.cloneNode(true));
    if (a.hasAttribute('data-ink')) chip.setAttribute('data-ink', '');
    return chip;
  }
  var EX = window.OW && OW.landingExamples;
  var SCENES = {
    /* THE FEED: the example profiles and Centers, one after another, rising as a feed does */
    feed: function (box) {
      if (!EX || !OW.lcard) return false;
      var list = [EX.people[0], EX.centers[1], EX.people[1], EX.centers[0], EX.people[2], EX.centers[2], EX.people[3], EX.centers[3]].filter(Boolean);
      var track = node('div', 'sc-feed-track');
      list.concat(list).forEach(function (c, i) { var n = OW.lcard(c); n.classList.add('sc-card'); n.tabIndex = -1; if (i >= list.length) n.setAttribute('data-copy', ''); track.appendChild(n); });
      box.appendChild(track);
    },
    /* CONNECTING YOUR EVERYDAY: where a place is found and booked (the wheel's platforms) leading into its Center */
    everyday: function (box) {
      if (!EX || !OW.lcard || !EX.centers[1]) return false;
      var row = node('div', 'sc-from');
      ['Google Maps', 'Google Calendar', 'Instagram'].forEach(function (n) { var m = wheelMark(n); if (m) row.appendChild(m); });
      var lines = document.createElementNS(SVGNS, 'svg'); lines.setAttribute('viewBox', '0 0 300 60'); lines.setAttribute('class', 'sc-join'); lines.setAttribute('preserveAspectRatio', 'none');
      /* the globe's own line (founder/1378: the Little Big Planet lines, never a row of dots): a wide dim halo under a whole core */
      var J = 'M60 0C60 40 150 20 150 60M150 0V60M240 0C240 40 150 20 150 60';
      lines.innerHTML = '<g class="sc-join__h"><path id="scJoin" d="' + J + '"/></g><use href="#scJoin" class="sc-join__c"/>';   /* one path, drawn twice */
      var card = OW.lcard(EX.centers[1]); card.classList.add('sc-card'); card.tabIndex = -1;
      box.appendChild(row); box.appendChild(lines); box.appendChild(card);
    },
    /* WAYPASS: two people on their own paths through the same coffee shop, there at the same moment (founder/1111) */
    waypass: function (box) {
      var svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 400 240'); svg.setAttribute('class', 'sc-paths');
      var A = 'M24 206C120 196 150 120 200 120S290 40 376 30', B = 'M24 34C110 44 150 120 200 120S286 196 376 210';
      svg.innerHTML = '<g class="sc-halo"><path d="' + A + '"/><path d="' + B + '"/></g><g class="sc-core"><path d="' + A + '"/><path d="' + B + '"/></g>';
      var stage = node('div', 'sc-stage'); stage.appendChild(svg); box.appendChild(stage);
      var cafe = face({ c: 'cafe', w: '' }); cafe.classList.add('sc-at'); stage.appendChild(cafe);
      /* the two reach the shop together: the same place at the same moment, which is what a pass now is (founder/1111; for his eye) */
      [['MC', 330, A, 0], ['JR', 24, B, 0]].forEach(function (p) {
        var el = face({ p: p[0], hue: p[1], w: '' }); el.classList.add('sc-walk');
        el.style.offsetPath = 'path("' + p[2] + '")'; el.style.animationDelay = p[3] + 's';
        stage.appendChild(el);
      });
      /* scaled to the column once the scene is shown, and again whenever the column changes width */
      var fit = function () { if (box.clientWidth) stage.style.transform = 'scale(' + (box.clientWidth / 400).toFixed(4) + ')'; };
      if ('ResizeObserver' in window) new ResizeObserver(fit).observe(box); else addEventListener('resize', fit, { passive: true });
      requestAnimationFrame(fit);
    },
    /* MARKETPLACE & OPPORTUNITIES: the kinds of places things are found at, lighting one after another */
    opportunities: function (box) {
      if (!(window.OW && OW.placeRow && OW.placeRow.mark)) return false;
      var kinds = ['shop', 'clothes', 'bakery', 'restaurant', 'cafe', 'cinema', 'fitness', 'hair', 'hotel'];   /* nine with marks of their own */
      var tiles = kinds.map(function (k) {
        var t = node('span', 'sc-tile'), look = OW.placeRow.paint ? OW.placeRow.paint(k) : null;
        if (look) t.style.setProperty('--place-color', look.color);
        var m = node('span', 'ow-place-face'); m.setAttribute('data-place-category', k); m.innerHTML = OW.placeRow.mark(k, true);
        t.appendChild(m); box.appendChild(t); return t;
      });
      if (still) return;
      var i = 0;
      setInterval(function () { if (document.hidden) return; tiles.forEach(function (t, j) { if (j === i % tiles.length) t.setAttribute('data-on', ''); else t.removeAttribute('data-on'); }); i += 4; }, 1300);
    },
    /* COMPATIBILITY & CROSS PROJECTION: the platform's globe at rest, the platforms' own marks around it */
    connected: function (box) {
      var mark = $('#heroGlobe .gl-mark svg');
      var g = node('div', 'sc-globe'), ring = node('div', 'sc-ring');
      if (mark) { var m = mark.cloneNode(true); $$('[id]', m).forEach(function (e) { e.id = 'sc' + e.id; }); $$('[clip-path]', m).forEach(function (e) { e.setAttribute('clip-path', 'url(#scheroGc)'); }); g.appendChild(m); }
      var names = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Bluesky', 'Threads', 'Mastodon', 'Pinterest', 'Reddit', 'Discord', 'Telegram'];
      var marks = names.map(wheelMark).filter(Boolean);
      marks.forEach(function (c, i) { var a = i / marks.length * 360; c.style.setProperty('--a', a + 'deg'); ring.appendChild(c); });
      box.appendChild(ring); box.appendChild(g);
    },
    /* PRIVACY, SAFETY & SECURITY: a person in their own space, the rest of the world outside it */
    privacy: function (box) {
      box.appendChild(node('span', 'sc-space'));
      box.appendChild(node('span', 'sc-space sc-space--2'));
      var you = face({ p: 'MC', hue: 330, w: '' }, 56); you.classList.add('sc-you'); box.appendChild(you);
      var orbit = node('div', 'sc-out');
      [{ p: 'JR', hue: 24 }, { c: 'shop' }, { p: 'PN', hue: 200 }, { c: 'cinema' }, { p: 'LP', hue: 270 }, { c: 'restaurant' }].forEach(function (s, i, all) {
        /* at the globe's own sizes they were faint specks on a 420 px scene (2026-10-31): a third larger, at full strength */
        s.w = ''; var el = face(s, s.p ? 38 : 36); el.style.setProperty('--a', (i / all.length * 360) + 'deg'); orbit.appendChild(el);
      });
      box.appendChild(orbit);
    }
  };
  $$('.hm-scene[data-scene]').forEach(function (box) {
    var make = SCENES[box.getAttribute('data-scene')];
    if (make && make(box) !== false) box.classList.add('is-drawn');
  });

  /* ── 7 · YOUR CORNER OF THE INTERNET (his brief of 2026-11-09, items 4 and 5: "visual storytelling ... realistic product
     interfaces wherever possible rather than generic illustrations"; "the Profile isn't simply a collection of links. It's a
     customizable layout that can be independently shared"). One picture beside each of his sentences, every piece the
     platform's own: the profile card (OW.lcard, the canonical card), the App's post card (OW.card), the one event card
     (OW.cards.event, the server's markup), the cards' chips and rows (OW.cards.node), the map's sprites (section 1), the
     platforms' own marks (the wheel's), the QR drawer's code (examples.js corner). Nothing opens: each is a picture, and his
     words beside it say what it shows. Every motion is opacity and transform (the compositor's), each scene's clock runs only
     while it is on screen, and under reduced motion each stands still on its most telling frame. */
  var CN = EX && EX.corner;
  function quiet(el) {                          /* a picture of the interface: nothing in it takes a press or the focus */
    el.removeAttribute('tabindex'); el.setAttribute('inert', '');
    $$('a,button,[tabindex]', el).forEach(function (a) { a.removeAttribute('href'); a.setAttribute('tabindex', '-1'); });
    return el;
  }
  function every(box, ms, fn) {                 /* a scene's clock, running only while the scene is on screen */
    if (still) return;
    var on = false, t = 0;
    var go = function () { clearInterval(t); if (on) t = setInterval(function () { if (!document.hidden) fn(); }, ms); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; go(); }).observe(box);
    else { on = true; go(); }
  }
  function chip(c, i) { var n = quiet(OW.cards.node(c, { as: 'chip', onOpen: false })); n.style.setProperty('--i', i); return n; }
  function glyph(name) { return window.OW && OW.glyph ? OW.glyph(name, { w: 'f', sel: false }) : ''; }
  var CORNER = {
    /* the Profile: the canonical card in three of the arrangements a person chooses (their hue, the face beside or above),
       turning from one to the next; under it its own link and its QR code */
    profile: function (box) {
      if (!EX || !OW.lcard || !EX.people[3]) return false;
      var M = EX.people[3], looks = [{ hue: M.hue, layout: 'beside' }, { hue: 300, layout: 'above' }, { hue: 24, layout: 'beside' }];
      var stack = node('div', 'cn-stack');
      var cards = looks.map(function (lk, i) {
        var n = quiet(OW.lcard(Object.assign({}, M, lk))); n.classList.add('sc-card');
        if (i === 0) n.setAttribute('data-on', ''); stack.appendChild(n); return n;
      });
      box.appendChild(stack);
      var share = node('div', 'cn-share');
      var link = node('span', 'cn-link'); link.innerHTML = glyph('link') + '<span>oneway.center/' + M.handle + '</span>';
      share.appendChild(link);
      if (CN && CN.qr) { var qr = node('span', 'cn-qr'); qr.innerHTML = CN.qr; share.appendChild(qr); }
      box.appendChild(share);
      var i = 0;
      every(box, 3400, function () { cards[i].removeAttribute('data-on'); i = (i + 1) % cards.length; cards[i].setAttribute('data-on', ''); });
    },
    /* a moment shared: the App's own post card, out to the person's other networks above it, reaching new people below */
    post: function (box) {
      var J = EX && EX.people[1];
      if (!J || !OW.card || !OW.cards) return false;
      var to = node('div', 'cn-to');
      ['Instagram', 'TikTok', 'X', 'Facebook', 'Threads'].forEach(function (n, i) { var m = wheelMark(n); if (m) { m.style.setProperty('--i', i); to.appendChild(m); } });
      var who = { name: J.title, handle: J.handle, hue: J.hue };
      var post = quiet(OW.card({ post: { id: 'cn-post', body: J.line, author: who, media: [], audience: 'public' }, actor: who }));
      post.classList.add('cn-post');
      var reach = node('div', 'cn-reach');
      [EX.people[0], EX.people[2], EX.people[3], EX.centers[2]].forEach(function (c, i) { if (c) reach.appendChild(chip(c, i)); });
      box.appendChild(to); box.appendChild(post); box.appendChild(reach);
    },
    /* arriving: the place's Center rises as you get there, its greeting comes in, and two people passing swap Profiles */
    arrive: function (box) {
      var B = EX && EX.centers[1];
      if (!B || !OW.lcard || !OW.cards) return false;
      var card = quiet(OW.lcard(B)); card.classList.add('sc-card', 'cn-rise');
      var greet = node('div', 'cn-greet');
      /* who greets: the renderer's own face of the Center and its name (the row projection needs the App's sheet) */
      var head = node('div', 'cn-from'); head.innerHTML = OW.cards.face ? OW.cards.face(B) : '';
      var nm = node('b'); nm.textContent = B.title; head.appendChild(nm); greet.appendChild(head);
      var said = node('p', 'cn-said'); said.textContent = B.blurb; greet.appendChild(said);
      var pass = node('div', 'cn-pass');
      var a = face({ p: 'MC', hue: 332, w: '' }, 44), b = face({ p: 'JR', hue: 27, w: '' }, 44);
      var lane = node('div', 'cn-lane');
      /* the lane is drawn as the hero draws a link not yet used (section 1b): a wide dim halo under a whole dim core, in the
         globe's colour, the same drawn line and never a border */
      var line = document.createElementNS(SVGNS, 'svg'); line.setAttribute('class', 'cn-line'); line.setAttribute('viewBox', '0 0 100 8');
      line.setAttribute('preserveAspectRatio', 'none');
      line.innerHTML = '<line class="cn-line__h" x1="0" y1="4" x2="100" y2="4"/><line class="cn-line__c" x1="0" y1="4" x2="100" y2="4"/>';
      lane.appendChild(chip(EX.people[0], 0)); lane.appendChild(chip(EX.people[1], 1)); lane.appendChild(line);
      pass.appendChild(a); pass.appendChild(lane); pass.appendChild(b);
      box.appendChild(card); box.appendChild(greet); box.appendChild(pass);
      /* EACH ONE'S MINI CARD CROSSES THE WHOLE LANE TO THE OTHER, one above the line and one below it, so they pass and never meet (main's
         grade, 2026-11-09: "at 390 the end sprites overlap the swapping chips' names mid-swap"). The run is the lane less a chip, in pixels,
         set on the animation itself and remade when the lane changes width: a custom property inside @keyframes is resolved once, when the
         animation starts, so the cards ran the 200 px fallback across a 186 px lane at 390 and stopped on the faces at its ends. Transform
         only; held for the time it has run, so a resize never restarts the swap. Reduced motion: they stand at their ends. */
      var cards = [lane.children[0], lane.children[1]], swaps = [], still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
      var run = function () {
        if (!cards[0].animate || (still && still.matches)) return;
        var r = Math.max(0, lane.clientWidth - cards[0].offsetWidth), t = swaps.length ? swaps[0].currentTime : 0, E = 'cubic-bezier(.45,0,.55,1)';
        if (lane._run === r) return;
        lane._run = r;
        swaps.forEach(function (a) { a.cancel(); });
        swaps = cards.map(function (el, i) {
          var to = 'translateX(' + (i ? -r : r) + 'px)';
          return el.animate([{ transform: 'none', offset: 0 }, { transform: 'none', offset: .12, easing: E }, { transform: to, offset: .88 }, { transform: to, offset: 1 }],
            { duration: 5200, iterations: Infinity, direction: 'alternate' });
        });
        if (t) swaps.forEach(function (a) { a.currentTime = t; });
      };
      if ('ResizeObserver' in window) new ResizeObserver(run).observe(lane); else requestAnimationFrame(run);
    },
    /* a hotel's Center, its booking on its own website, and an event with its time, its place and RSVP */
    book: function (box) {
      if (!CN || !CN.hotel || !OW.lcard || !OW.cards || !OW.cards.event) return false;
      var hotel = quiet(OW.lcard(CN.hotel)); hotel.classList.add('sc-card', 'cn-hotel');
      var row = $$('.lc-fact', hotel).filter(function (f) { return /^Booking/.test(f.getAttribute('title') || ''); })[0];
      if (row) row.classList.add('cn-hot');
      var out = node('span', 'cn-web'); out.innerHTML = glyph('arrow-up-right') + glyph('globe');
      var list = node('div', 'ow-ecards cn-event'), ev = OW.cards.event(CN.event);
      if (ev) list.appendChild(quiet(ev));
      box.appendChild(hotel); box.appendChild(out); box.appendChild(list);
    }
  };
  $$('.cn-vis[data-corner]').forEach(function (box) {
    var make = CORNER[box.getAttribute('data-corner')];
    if (make && make(box) !== false) box.classList.add('is-drawn');
  });
})();
