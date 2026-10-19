
/* the wordmark's flight from the hero into the bar is the one top bar's (frontend/shared/oneway-bar.js, data-owbar-hero) */

/* ── FULL-PAGE 3D PARTICLE FIELD ─────────────────────────── */
(function () {
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, CX, CY;

  const DEPTH  = 1600;   // far clip
  const FOV    = 900;    // perspective focal length
  /* Touch devices (any orientation) never run the always-on canvas — innerWidth
     alone misses an iPhone held sideways. */
  /* CANON: touch, not width. A narrow desktop window keeps its full galaxy. */
  const isMob  = window.owSafeFloor ? window.owSafeFloor()
               : (window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const PCOUNT = isMob ? 70 : 120;     // flight particles — fewer than the App's field: the spiral is the sky here
  const SCOUNT = isMob ? 5 : 9;        // wireframe shapes
  let _mobSkip = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.remove(); return; }
  /* OLD AND SLOW MACHINES (the founder, 2026-10-19: "on chromebooks ... on old phones the animation glitches"). Measured
     on a Chromebook's 1366 x 768 with the CPU slowed 6x: every frame of this sky was a 78 ms task, and the wordmark's
     flight, which shares those frames, stepped. On the calm path (oneway-bar.js: old engine, 2 GB or two cores or less)
     the sky is drawn once and held still, again only when the window changes size; on four cores or fewer, or 4 GB or
     less, it moves at a third of the frames and holds while the page scrolls. */
  const calm = !!window.owCalm || document.documentElement.classList.contains('ow-calm');
  const light = calm || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let calmDue = true, lastDraw = 0, lastScroll = -1e9;
  if (light) window.addEventListener('scroll', function () { lastScroll = performance.now(); }, { passive: true });
  /* PHONES: no always-on canvas at all. The signature Center-light constellation
     (.wn buttons) and CSS gradients carry the hero; the ambient starfield is a
     desktop luxury. This removes the single biggest GPU-memory consumer on
     iOS Safari — the real cause of scroll crashes. */
  if (isMob) { canvas.remove(); return; }

  function resize() {
    /* NEVER SIZE THE CANVAS TO ZERO. A 0×0 canvas draws nothing and stays that
       way, which looks exactly like the starfield having died. Falls back the
       same way the gate does, so a load with no viewport yet still paints. */
    W = canvas.width  = (window.innerWidth  || document.documentElement.clientWidth  || 1280);
    H = canvas.height = (window.innerHeight || document.documentElement.clientHeight || 800);
    CX = W / 2; CY = H / 2;
    if (calm && !calmDue) { calmDue = true; rafId = requestAnimationFrame(frame); }   // a resized canvas is blank: draw the still sky again
  }
  window.addEventListener('resize', resize, { passive: true });
  /* A TAB THAT LOADED HIDDEN HAS NO VIEWPORT, AND NO RESIZE EVENT ANNOUNCES
     THAT IT GOT ONE. Open the landing page in a background tab — cmd-click, or
     a restored session — and the browser reports width 0 and throttles the
     animation frame. That is how the starfield was being lost: the old gate
     read 0 as "phone" and removed the canvas outright, so switching to the tab
     showed a page that had permanently given up its depth. The gate no longer
     does that; this makes sure the canvas is re-measured the moment the tab is
     actually looked at, instead of keeping the fallback size it guessed at
     while nobody could see it. Measured 2026-08-24: hidden tab reports
     innerWidth 0, clientWidth 0, visualViewport 0×0. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { resize(); }
  }, { passive: true });
  resize();

  /* ── colour palette ───────────────────────────────────────────────────
     THREE ACCENTS THAT FOLLOW THE PERSON. These were fixed, so the starfield
     stayed cyan/violet/amber no matter what colour someone had chosen for the
     rest of the platform — the most visible surface ONEWAY has, and the only
     one that did not know them.

     The triad is kept as a RELATIONSHIP rather than three colours: the user's
     hue, +71°, +211°. At the default of 187° those resolve to the exact
     palette that has always been here, so nothing changes for somebody who has
     never picked a hue — and the whole galaxy rotates coherently for somebody
     who has, instead of one accent clashing with the other two.

     MUTATED IN PLACE, ON PURPOSE. Every particle, shape and bokeh holds a
     REFERENCE to one of these arrays, so rewriting their contents recolours
     ~230 objects on the next frame with no rebuild and no dropped animation. */
  const WHITE  = [255,255,255];
  const CYAN   = [6,182,212];
  const PURPLE = [167,139,250];
  const AMBER  = [245,158,11];
  /* One triad, shared by all five galaxies — see oneway-galaxy.js. */
  if (window.OW && window.OW.galaxy) { window.OW.galaxy.follow({ CYAN, PURPLE, AMBER }); }
  function followLandingPalette() {
    [CYAN, PURPLE, AMBER].forEach(function (color, i) {
      var value = getComputedStyle(document.documentElement).getPropertyValue('--land-hue-' + i);
      if (value) color.splice(0, 3, ...value.split(',').map(Number));
    });
  }
  followLandingPalette();
  addEventListener('ow:hue', followLandingPalette);
  function rndCol() {
    const r = Math.random();
    if (r < 0.10) return CYAN;
    if (r < 0.18) return PURPLE;
    if (r < 0.24) return AMBER;
    return WHITE;
  }

  /* ── perspective projection ── */
  function project(x, y, z) {
    if (z <= -FOV + 1) return null;
    const s = FOV / (FOV + z);
    return { sx: CX + x * s, sy: CY + y * s, s };
  }

  /* ── 3-axis rotation ── */
  function rot3(vx, vy, vz, rx, ry, rz) {
    // X
    let y1 = vy * Math.cos(rx) - vz * Math.sin(rx);
    let z1 = vy * Math.sin(rx) + vz * Math.cos(rx);
    // Y
    let x2 = vx * Math.cos(ry) + z1 * Math.sin(ry);
    let z2 = -vx * Math.sin(ry) + z1 * Math.cos(ry);
    // Z
    let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
    return [x3, y3, z2];
  }

  /* ── NOTHING VANISHES ON THE SCREEN (the founder, 2026-10-10: "particles in background galaxies must not disappear if not travlimng fully of screen first they cannot just vanish in the middle of the screen").
     A star or a wireframe flies at you and outward, and is let go only once it is wholly off the screen; its line
     of flight is drawn so that happens before it is NEAR_S (a star: never blown up, the cursor ruling below) or
     SHAPE_S (a wireframe) times nearer, and one just made fades in. The network's signals never end either (below). ── */
  const NEAR_S = 2.4, NEAR_Z = FOV / NEAR_S - FOV, SHAPE_S = 4, SHAPE_Z = FOV / SHAPE_S - FOV;
  const OFF = 60, BORN = 120, SHAPE_BORN = 40;
  const offScreen = (sx, sy) => sx < -OFF || sx > W + OFF || sy < -OFF || sy > H + OFF;
  const boxOff = pts => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx); y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy); }
    return x1 < -OFF || x0 > W + OFF || y1 < -OFF || y0 > H + OFF;
  };
  /* its point nearest the centre (rx, ry: how far its corners and the parallax reach), at scale s, is off the screen */
  const leaves = (x, y, rx, ry, s) => Math.max(0, Math.abs(x) - rx) * s > W / 2 + OFF || Math.max(0, Math.abs(y) - ry) * s > H / 2 + OFF;
  function outbound(xs, ys, rx, ry, s) {
    let x = 0, y = 0;
    for (let k = 0; k < 24; k++) {
      x = (Math.random() - 0.5) * xs; y = (Math.random() - 0.5) * ys;
      if (leaves(x, y, rx, ry, s)) return [x, y];
    }
    return [(x < 0 ? -1 : 1) * ((W / 2 + OFF + 1) / s + rx), y];
  }

  /* ── particles ── */
  function mkParticle(initial) {
    const col = rndCol();
    const isAccent = col !== WHITE;
    const [x, y] = outbound(W * 3.5, H * 3.5, 0, 0, NEAR_S);
    return {
      x, y,
      z:   initial ? Math.random() * DEPTH : DEPTH,
      vz:  -(0.25 + Math.random() * 0.55),
      col,
      alpha: isAccent ? (0.45 + Math.random() * 0.45) : (0.12 + Math.random() * 0.55),
      r:   isAccent ? (0.8 + Math.random() * 2.2) : (0.35 + Math.random() * 1.4),
    };
  }
  const particles = Array.from({ length: PCOUNT }, (_, i) => mkParticle(true));

  /* ── THE SPIRAL — the landing page's own galaxy ──────────────────────────
     ★ FOUNDER/385–386 (2026-09-14): *"That galaxy background is a huge part
       of one way and the one on the landing page should look distinct from
       the one on the app and OS."*

     Five surfaces ran one starfield — a random field flown through. The App
     and the OS keep that: their sky is a place you are IN. The landing page
     is where a person first SEES ONEWAY, so its sky is a galaxy you are
     looking AT: two logarithmic arms wound around a bright core, tilted like
     a disc, turning once every few minutes, with the flight particles and
     wireframes kept underneath at a fraction of their old density so the
     structure reads. Its stars sit on the arms (with the scatter a real arm
     has), the core is a warm-white radial glow, and the arms take the same
     triad the rest of the world takes — CYAN · PURPLE · AMBER — rotated with
     the person's hue by oneway-galaxy.js like everything else.

     Not a picture of a galaxy: it is drawn, every frame, from a few numbers,
     so a different viewport is a different galaxy of the same family. */
  /* ★ FOUNDER/388: *"make the galaxy only appear every 1 in x chances"* — the
     spiral is a rare sky. One load in SPIRAL_ODDS carries it; the others keep
     the field. `?galaxy=1` forces it (so it can be looked at on purpose),
     `?galaxy=0` withholds it. Decided per load, remembered by nobody: a rare
     thing that a person cannot make appear is what makes seeing it an event. */
  const SPIRAL_ODDS = 4;
  const SHOW_SPIRAL = /[?&]galaxy=1\b/.test(location.search) ? true
                    : /[?&]galaxy=0\b/.test(location.search) ? false
                    : (Math.random() < 1 / SPIRAL_ODDS);
  const SPIRAL_N = 980;                       /* stars on the arms */
  const SPIRAL = {
    arms: 2, wind: 0.24,                      /* log-spiral tightness (b in r = a·e^(bθ)) */
    turns: 2.6,                               /* how far each arm winds */
    tilt: 0.42,                               /* the disc seen at an angle (y squash) */
    lean: -0.26,                              /* the disc's rotation on screen (radians) */
    speed: 0.000105,                          /* radians per ms — one revolution ≈ 10 min */
    cx: 0.62, cy: 0.46,                       /* where it sits — right of the type, behind it */
    scale: 0.62                               /* radius as a fraction of min(W,H) */
  };
  const spiralStars = Array.from({ length: SPIRAL_N }, (_, i) => {
    const arm = i % SPIRAL.arms;
    const t = Math.pow(Math.random(), 0.72) * SPIRAL.turns * Math.PI * 2;   /* denser toward the core */
    const r = 0.055 + 0.08 * Math.exp(SPIRAL.wind * t);                     /* log spiral, normalised */
    const scatter = (Math.random() - 0.5) * (0.05 + 0.09 * (r));            /* arms are bands, not lines */
    const jitter = (Math.random() - 0.5) * 0.55;                             /* along the arm */
    const col = Math.random() < 0.34 ? [CYAN, PURPLE, AMBER][arm % 3 === 0 ? (Math.random() < .5 ? 0 : 1) : 2] : WHITE;
    return { arm, t: t + jitter, r: r + scatter, col,
             a: 0.32 + Math.random() * 0.62,
             s: 0.55 + Math.random() * (col === WHITE ? 1.5 : 2.2),
             tw: Math.random() * Math.PI * 2 };
  });
  /* the arms' DUST — a few dozen large, faint discs along each arm, so the
     arm reads as a band of light between the stars, the way a real one does */
  const spiralDust = Array.from({ length: 84 }, (_, i) => {
    const arm = i % SPIRAL.arms;
    const t = (i / 84) * SPIRAL.turns * Math.PI * 2 * 0.92;
    return { arm, t, r: 0.055 + 0.08 * Math.exp(SPIRAL.wind * t) + (Math.random() - .5) * .03,
             col: [CYAN, PURPLE, AMBER][(arm + Math.floor(i / 28)) % 3],
             s: 26 + Math.random() * 40, a: 0.05 + Math.random() * 0.05 };
  });
  let spiralTurn = 0, spiralLast = 0;
  function drawSpiral(now) {
    if (!spiralLast) spiralLast = now;
    spiralTurn += (now - spiralLast) * SPIRAL.speed; spiralLast = now;
    const R = Math.min(W, H) * SPIRAL.scale;
    const ox = W * SPIRAL.cx + (mx - 0.5) * 24, oy = H * SPIRAL.cy + (my - 0.5) * 16;
    const cl = Math.cos(SPIRAL.lean), sl = Math.sin(SPIRAL.lean);
    /* the core: a warm-white glow with a violet edge — the one bright thing */
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 0.4);
    g.addColorStop(0,    'rgba(255,248,236,0.30)');
    g.addColorStop(0.14, 'rgba(255,236,214,0.16)');
    /* the core's edge is the PERSON'S hue: the CYAN slot is the one
       oneway-galaxy.js rotates to whoever is signed in (founder/388: "make
       users hue when signed in able to change hue of this galaxy") */
    g.addColorStop(0.45, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0.10)`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(ox - R, oy - R, R * 2, R * 2);
    /* the dust, under the stars */
    for (let i = 0; i < spiralDust.length; i++) {
      const d = spiralDust[i];
      const th = d.t + spiralTurn + (d.arm * Math.PI * 2 / SPIRAL.arms);
      let x = Math.cos(th) * d.r * R, y = Math.sin(th) * d.r * R * SPIRAL.tilt;
      const rx = x * cl - y * sl, ry = x * sl + y * cl;
      const fade = Math.max(0, 1 - d.r * 0.7);
      const dg = ctx.createRadialGradient(ox + rx, oy + ry, 0, ox + rx, oy + ry, d.s);
      dg.addColorStop(0, `rgba(${d.col[0]},${d.col[1]},${d.col[2]},${(d.a * fade).toFixed(3)})`);
      dg.addColorStop(1, `rgba(${d.col[0]},${d.col[1]},${d.col[2]},0)`);
      ctx.fillStyle = dg; ctx.fillRect(ox + rx - d.s, oy + ry - d.s, d.s * 2, d.s * 2);
    }
    /* the arms: stars, tilted and leaned, twinkling on their own clock */
    for (let i = 0; i < spiralStars.length; i++) {
      const st = spiralStars[i];
      const th = st.t + spiralTurn + (st.arm * Math.PI * 2 / SPIRAL.arms);
      let x = Math.cos(th) * st.r * R, y = Math.sin(th) * st.r * R * SPIRAL.tilt;
      const rx = x * cl - y * sl, ry = x * sl + y * cl;
      const fade = Math.max(0, 1 - st.r * 0.75);                 /* the outer arm thins */
      /* a star too faint to see is never drawn; one that is drawn twinkles and never blinks out (2026-10-10: the
         cut was on the twinkling alpha, so the outer arm's faintest stars went out and came back mid-screen) */
      if (st.a * fade < 0.02) continue;
      const tw = 0.72 + 0.28 * Math.sin(now * 0.0011 + st.tw);
      const alpha = st.a * fade * tw;
      const [cr, cg, cb] = st.col;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(ox + rx, oy + ry, st.s, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ── shapes (wireframe triangles / quads) ── */
  function mkShape() {
    const cols = [CYAN, PURPLE, AMBER];
    const col  = cols[Math.floor(Math.random() * cols.length)];
    const sides = Math.random() > 0.45 ? 3 : 4;
    const size  = 28 + Math.random() * 88;
    const verts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      verts.push([Math.cos(a) * size, Math.sin(a) * size, (Math.random() - 0.5) * size * 0.6]);
    }
    const reach = size * 1.05, [x, y] = outbound(W * 3, H * 2.5, reach + 27, reach + 17, FOV / (FOV / SHAPE_S + reach));
    return {
      x, y,
      z: 120 + Math.random() * 1400,
      vz: -(0.06 + Math.random() * 0.16),
      rx: Math.random() * Math.PI * 2, drx: (Math.random() - 0.5) * 0.006,
      ry: Math.random() * Math.PI * 2, dry: (Math.random() - 0.5) * 0.007,
      rz: Math.random() * Math.PI * 2, drz: (Math.random() - 0.5) * 0.005,
      verts, col,
      alpha: 0.18 + Math.random() * 0.28,
    };
  }
  const shapes = Array.from({ length: SCOUNT }, mkShape);

  /* ── ambient nebula blobs ── */
  const blobs = [
    { x: 0.22, y: 0.28, vx:  0.00014, vy:  0.0001,  size: 0.55, col: CYAN   },
    { x: 0.78, y: 0.68, vx: -0.00011, vy:  0.00013, size: 0.50, col: PURPLE },
    { x: 0.50, y: 0.88, vx:  0.0001,  vy: -0.0001,  size: 0.46, col: AMBER  },
  ];

  /* ── distant world: slow anchor points, faint links + occasional travelling signals.
     Suggests a whole network living beneath the surface. Everything very low opacity. ── */
  const WP_N = (window.owIsNarrow ? window.owIsNarrow(768) : window.innerWidth < 768) ? 9 : 15;
  const wpts = Array.from({ length: WP_N }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00006, vy: (Math.random() - 0.5) * 0.00006,
    tw: Math.random() * Math.PI * 2,      // twinkle phase
    col: rndCol(),
  }));
  /* A SIGNAL NEVER ENDS ON THE SCREEN (the founder, 2026-10-10, above): it sets out from an anchor along a link,
     fading in, and on arriving goes on to the next anchor (a linked one when there is one, never straight back
     while another is near), at one pace whatever the hop's length; it is always travelling, and never vanishes. */
  const signals = [];
  function nextAnchor(at, from) {
    let near = -1, nd = 0.16, any = -1, ad = Infinity;
    for (let b = 0; b < wpts.length; b++) {
      if (b === at || b === from) continue;
      const d = Math.hypot(wpts[at].x - wpts[b].x, wpts[at].y - wpts[b].y);
      if (d < nd) { near = b; nd = d; }
      if (d < ad) { any = b; ad = d; }
    }
    return near >= 0 ? near : (any >= 0 ? any : from);
  }
  function spawnSignal() {
    const a = Math.floor(Math.random() * wpts.length);
    let best = -1, bd = 0.16;
    for (let b = 0; b < wpts.length; b++) {
      if (b === a) continue;
      const d = Math.hypot(wpts[a].x - wpts[b].x, wpts[a].y - wpts[b].y);
      if (d < bd) { best = b; bd = d; }
    }
    if (best >= 0) signals.push({ a, b: best, t: 0, v: 0.0005 + Math.random() * 0.0005, age: 0, col: wpts[a].col });
  }

  /* ── NO DOT FOLLOWS THE CURSOR (the founder, 2026-10-09: "there are these dots that move with the cursor that feel
     like they are awfully to blown up and close to the screen. i still wanna keep the moving galaxy effect but simply
     remove the pale white dots that follow the cursor"). The foreground bokeh, seven large soft glows (three in four
     of them white) swung up to ~800 px by the cursor, is gone; the flying stars and the network's anchors no longer
     take the cursor, and a star leaves by an edge before it comes close (above). The galaxy still moves: the spiral
     turns, the stars fly in, the nebula drifts, the network drifts and signals. Only the wireframes and the nebula
     keep a slight parallax, and neither is a dot. ── */

  /* ── mouse ── */
  let mx = 0.5, my = 0.5;
  window.addEventListener('mousemove', e => {
    mx = e.clientX / W; my = e.clientY / H;
  }, { passive: true });

  /* ── SCROLL CRASH GUARD ────────────────────────────────────────────────
     The iOS half of this is handled ABOVE and absolutely: touch devices never
     reach here — `if (isMob) { canvas.remove(); return; }` deletes the canvas
     outright, which is the permanent mobile safe floor. So only desktop runs
     the loop, and on desktop this canvas is NOT hero decoration: it is
     position:fixed, inset:0 — it is the world's atmosphere for the WHOLE page.
     Gating it on the hero's visibility therefore switched the atmosphere off
     the moment you scrolled past the first viewport (measured: 72 frames/600ms
     in the hero → 0 frames and a cleared canvas below it), which is exactly the
     "background stunts as you scroll" everyone was seeing. The atmosphere now
     lives for the whole page; `document.hidden` in frame() still parks it in a
     background tab, and phones remain untouched. */
  let heroVisible = true, rafId = 0;
  /* diagnostic kill-switch: ?fx=off removes the canvas entirely (crash bisection) */
  if (/[?&]fx=off\b/.test(location.search)) { canvas.remove(); return; }

  /* ── frame ── */
  function frame() {
    if (!heroVisible) return;                                        /* stopped — resumed by the observer */
    if (document.hidden) { rafId = requestAnimationFrame(frame); return; }   /* crash guard: no work in background */
    if (isMob) { _mobSkip = !_mobSkip; if (_mobSkip) { rafId = requestAnimationFrame(frame); return; } }  /* 30fps on phones */
    if (calm) { if (!calmDue) return; calmDue = false; }                 /* calm: this one frame, then the sky holds */
    else if (light) {
      const now = performance.now();
      if (now - lastDraw < 48 || now - lastScroll < 220) { rafId = requestAnimationFrame(frame); return; }
      lastDraw = now;
    }
    ctx.clearRect(0, 0, W, H);

    const pmx = (mx - 0.5) * 90;
    const pmy = (my - 0.5) * 55;

    /* nebula blobs (subtle ambient glow) — three full-viewport radial
       gradients per frame: fine on desktop GPUs, tab-killing on phones */
    if (!isMob) blobs.forEach((b, i) => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 0 || b.x > 1) b.vx *= -1;
      if (b.y < 0 || b.y > 1) b.vy *= -1;
      const bx = (b.x + (mx - 0.5) * 0.04 * (i % 2 ? 1 : -1)) * W;
      const by = (b.y + (my - 0.5) * 0.03 * (i % 2 ? -1 :  1)) * H;
      const br = Math.max(W, H) * b.size;
      const g  = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      const [r,g2,bl] = b.col;
      g.addColorStop(0,    `rgba(${r},${g2},${bl},0.13)`);
      g.addColorStop(0.38, `rgba(${r},${g2},${bl},0.055)`);
      g.addColorStop(1,    `rgba(${r},${g2},${bl},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });

    /* the spiral — the landing page's own galaxy, under the depth layers,
       on the loads that carry it */
    if (SHOW_SPIRAL) drawSpiral(performance.now());

    /* wireframe shapes */
    for (let i = 0; i < shapes.length; i++) {
      const sh = shapes[i];
      sh.rx += sh.drx; sh.ry += sh.dry; sh.rz += sh.drz;
      sh.z  += sh.vz;

      const pts = sh.verts.map(v => {
        const [rx, ry, rz] = rot3(v[0], v[1], v[2], sh.rx, sh.ry, sh.rz);
        return project(sh.x + rx + pmx * 0.6, sh.y + ry + pmy * 0.6, sh.z + rz);
      });
      /* let go only once every corner is off the screen: its line of flight makes that so before SHAPE_Z */
      if (pts.some(p => !p) || (sh.z < SHAPE_Z && boxOff(pts))) { Object.assign(sh, mkShape()); sh.z = DEPTH; continue; }

      const s0    = pts[0].s;
      const alpha = sh.alpha * Math.min(1, s0 * 1.4) * Math.min(1, (DEPTH - sh.z) / SHAPE_BORN);
      if (alpha < 0.015) continue;

      const [r, g2, bl] = sh.col;
      ctx.beginPath();
      ctx.moveTo(pts[0].sx, pts[0].sy);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].sx, pts[j].sy);
      ctx.closePath();
      ctx.strokeStyle = `rgba(${r},${g2},${bl},${alpha.toFixed(3)})`;
      ctx.lineWidth   = Math.max(0.25, s0 * 1.1);
      ctx.stroke();
    }

    /* star particles */
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.z += p.vz;
      const proj = project(p.x, p.y, p.z);
      /* let go only once it is off the screen: its line of flight makes that so before NEAR_Z, and one a window
         made larger keeps on the screen past it flies on until it leaves */
      if (!proj || (p.z < NEAR_Z && offScreen(proj.sx, proj.sy))) { Object.assign(particles[i], mkParticle(false)); continue; }
      const { sx, sy, s } = proj;
      if (offScreen(sx, sy)) continue;

      const size  = p.r * s * 2.2;
      const alpha = p.alpha * Math.min(1, s * 2) * Math.min(1, (DEPTH - p.z) / BORN);
      if (alpha < 0.01 || size < 0.15) continue;

      const [r, g2, bl] = p.col;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.2, size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g2},${bl},${alpha.toFixed(3)})`;
      ctx.fill();
    }

    /* distant world — faint constellation links between drifting anchor points */
    for (let i = 0; i < wpts.length; i++) {
      const p = wpts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
    }
    const LINK = 0.17;
    for (let i = 0; i < wpts.length; i++) {
      for (let j = i + 1; j < wpts.length; j++) {
        const d = Math.hypot(wpts[i].x - wpts[j].x, wpts[i].y - wpts[j].y);
        if (d > LINK) continue;
        const a = (1 - d / LINK) * 0.05;   // barely there
        const ix = wpts[i].x * W, iy = wpts[i].y * H;
        const jx = wpts[j].x * W, jy = wpts[j].y * H;
        ctx.strokeStyle = `rgba(150,170,255,${a.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(jx, jy); ctx.stroke();
      }
    }
    /* twinkle the anchor points */
    for (let i = 0; i < wpts.length; i++) {
      const p = wpts[i]; p.tw += 0.018;
      const px = p.x * W, py = p.y * H;
      const tw = 0.11 + Math.sin(p.tw) * 0.06;
      const [r, g2, bl] = p.col;
      ctx.fillStyle = `rgba(${r},${g2},${bl},${Math.max(0, tw).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    /* occasional travelling signal between two nearby anchors */
    if (Math.random() < 0.011 && signals.length < 3) spawnSignal();
    for (let s = 0; s < signals.length; s++) {
      const sg = signals[s];
      let A = wpts[sg.a], B = wpts[sg.b];
      sg.t += sg.v / Math.max(0.03, Math.hypot(A.x - B.x, A.y - B.y)); sg.age++;
      if (sg.t >= 1) { const n = nextAnchor(sg.b, sg.a); sg.a = sg.b; sg.b = n; sg.t = 0; A = wpts[sg.a]; B = wpts[sg.b]; }
      const ax = A.x * W, ay = A.y * H;
      const bx = B.x * W, by = B.y * H;
      const x = ax + (bx - ax) * sg.t, y = ay + (by - ay) * sg.t;
      const [r, g2, bl] = sg.col, f = Math.min(1, sg.age / 90);
      if (!isMob) {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 7);
        gr.addColorStop(0, `rgba(${r},${g2},${bl},${(0.45 * f).toFixed(3)})`); gr.addColorStop(1, `rgba(${r},${g2},${bl},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${r},${g2},${bl},${(0.75 * f).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
}());

/* ── HERO ATMOSPHERE — OFF. It surfaced faint Center names behind the hero
   ("Harlem", "Williamsburg", "Coney Island" drifting through the sky).
   ★ FOUNDER/391, 2026-09-14: *"start adding the centers in that spear in the
     back. That looks horrible and tacky, and there's no point in doing it
     whatsoever."* Removed rather than dimmed; the sky is the galaxy. ── */


/* ── SCROLL REVEAL — fail-open. The observer gives the nice stagger, but content
   must NEVER stay hidden if an observer stalls (one stall = a "blank page" report).
   A deterministic rect sweep on scroll/resize/load guarantees visibility. ── */
const obs = window.IntersectionObserver ? new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
  });
}, { threshold: 0.1 }) : null;
let rvPending = Array.from(document.querySelectorAll('.rv, .rv-r, .rv-l, .flow-div'));
rvPending.forEach(el => { if (obs) obs.observe(el); else el.classList.add('in'); });
let rvTick = false;
function rvSweep(){
  rvTick = false;
  if (!rvPending.length) return;
  /* prune as we go — the sweep gets cheaper with every reveal, and stops
     costing anything once the page is fully revealed (mobile scroll perf) */
  rvPending = rvPending.filter(el => {
    if (el.classList.contains('in')) return false;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.94 && r.bottom > 0) { el.classList.add('in'); return false; }
    return true;
  });
}
function rvQueue(){ if (!rvTick && rvPending.length) { rvTick = true; requestAnimationFrame(rvSweep); } }
addEventListener('scroll', rvQueue, { passive: true });
addEventListener('resize', rvQueue, { passive: true });
addEventListener('load', rvSweep);
setTimeout(rvSweep, 300); setTimeout(rvSweep, 1200);
