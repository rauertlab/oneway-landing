/* oneway-site.js — A CENTER'S SITE, PROJECTED OVER THE GALAXY.
 *
 * ★ FOUNDER/437, 2026-09-19: *"we should be able to project to centers pages
 *   like this over our galaxy seamlessly same fonts and presentation and we
 *   should be able to create read and write sites like this (lightbulb led)"*
 * ★ FOUNDER/433: *"center catagories facing users could be just like website
 *   pages ones that arent feeds"*
 * ★ FOUNDER/434: *"should be able to be taken exactly from not a vague
 *   recreation"*
 *
 * TWO SITES, ONE SURFACE. The composed Center read (`/api/oneway/centers/{id}/app`)
 * carries up to two:
 *   `site`     — the site Lightbulb WROTE from the Center's record, as a SPEC:
 *                pages → sections (ten kinds) → content, and a `presentation`
 *                (the fonts, the colours, the logo — the style's, or READ from
 *                the company's own website). Drawn here NATIVELY, in the App's
 *                DOM, wearing those tokens as CSS variables and the company's
 *                own faces as @font-face — so it is seamless with the galaxy
 *                and is the same site the page door renders.
 *   `website`  — the company's existing site, TAKEN EXACTLY: its own pages in
 *                a frame (its origin) or the mirror (our door, sandboxed).
 *                Never redrawn, never "recreated".
 *
 * WHAT THIS EXPORTS: OW.site.tabsFor(app, centerId) — the site's pages as
 * tabs in the Center's shell (they lead: opening a Center lands on its own
 * home); OW.site.page(el, spec, pg) — one written page, natively;
 * OW.site.mirror(el, website, page) — one of the company's own pages, exactly.
 * The vocabulary is FROZEN to what the backend composes: hero · line · text ·
 * cards · chips · hours · links · timeline · tiers · figures. A kind this file
 * does not know is drawn as its title and its text — never dropped silently.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var OW = global.OW = global.OW || {};
  if (OW.site) return;

  /* ── THE SITE'S OWN MATERIAL — tokens, not the App's ─────────────────────
     Every colour and face is a variable set on the page's root from the
     spec's presentation. Nothing here is a design decision of its own: the
     style catalogue and the probe decide, this draws. */
  var CSS = [
    '.ow-site{--ow-s-bg:#fff;--ow-s-ink:#111;--ow-s-accent:#3a7bd5;--ow-s-heading:#111;--ow-s-fh:\'ONEWAY Sans\',sans-serif;--ow-s-fb:\'ONEWAY Sans\',sans-serif;',
    '  background:var(--ow-s-bg);color:var(--ow-s-ink);font-family:var(--ow-s-fb);line-height:1.55;margin:0 -18px;padding:8px 24px 40px;border-radius:0}',
    '.ow-site h1,.ow-site h2,.ow-site h3{font-family:var(--ow-s-fh);color:var(--ow-s-heading);margin:0}',
    '.ow-site .ows-hero{padding:56px 0 28px;text-align:center}',
    /* the modern hero: their photograph full-bleed, the line on it, one act */
    '.ow-site .ows-hero--photo{margin:0 -24px;padding:0;background-size:cover;background-position:center;min-height:var(--ow-s-hero-vh,62vh);display:flex;align-items:flex-end;text-align:left;position:relative;border-radius:0}',
    '.ow-site .ows-hero--photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.08) 30%,rgba(0,0,0,.42) 60%,rgba(0,0,0,.8) 100%)}',
    '.ow-site .ows-hero--photo .ows-hero__in{position:relative;z-index:1;padding:0 24px 40px;width:100%}',
    '.ow-site .ows-hero--photo h1,.ow-site .ows-hero--photo p{color:#fff;text-shadow:0 2px 24px rgba(0,0,0,.45)}.ow-site .ows-hero--photo p{margin:0;max-width:38em}',
    '.ow-site .ows-act{display:inline-block;margin-top:18px;padding:13px 26px;border:0;border-radius:var(--ow-s-btn-r,999px);background:var(--ow-s-btn-fill,var(--ow-s-accent));color:var(--ow-s-btn-ink,#fff);font:inherit;font-weight:700;letter-spacing:.1em;text-transform:var(--ow-s-btn-tt,uppercase);font-size:12px;cursor:pointer}',
    '.ow-site .ows-cards--pillars .ows-card img{aspect-ratio:16/10}.ow-site .ows-cards--pillars .ows-card h3{font-size:22px;font-weight:500}',
    '.ow-site .ows-sub{font-size:26px;margin:36px 0 10px}',
    '.ow-site .ows-cards--pillars{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}',
    '.ow-site button.ows-card{text-align:left;font:inherit;color:inherit;cursor:pointer;background:transparent;width:100%}.ow-site button.ows-card:hover{border-color:var(--ow-s-accent)}',
    '.ow-site .ows-hero h1{font-size:var(--ow-s-h1,clamp(34px,6vw,64px));font-weight:var(--ow-s-h1-w,500);text-transform:var(--ow-s-h1-tt,none);letter-spacing:var(--ow-s-h1-ls,-0.01em);line-height:1.04;margin-bottom:12px}',
    '.ow-site section h2{font-size:var(--ow-s-h2,28px);font-weight:400}',
    '.ow-site .ows-hero p{font-size:18px;max-width:40em;margin:0 auto;opacity:.86}',
    '.ow-site .ows-hero img{width:100%;max-height:420px;object-fit:cover;border-radius:12px;margin:28px 0 0;display:block}',
    '.ow-site .ows-brand{display:flex;align-items:center;gap:12px;padding:6px 0 0}',
    '.ow-site .ows-brand img{height:var(--ow-s-logo-h,48px);max-width:min(60vw,360px);width:auto;object-fit:contain;display:block}',
    '.ow-site .ows-brand .ows-wordmark{font-family:var(--ow-s-fh);font-weight:600;font-size:calc(var(--ow-s-logo-h,48px) * .5);letter-spacing:.04em;text-transform:uppercase}',
    '.ow-site section{padding:26px 0 6px}',
    '.ow-site section h2{font-size:28px;margin-bottom:12px}',
    '.ow-site .ows-line{font-size:18px;margin:0}',
    '.ow-site .ows-text p{margin:0 0 14px;font-size:17px}',
    '.ow-site .ows-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}',
    '.ow-site .ows-card{border:1px solid color-mix(in srgb,var(--ow-s-ink) 14%,transparent);border-radius:12px;padding:16px}',
    '.ow-site .ows-card h3{font-size:20px;margin-bottom:4px}',
    '.ow-site .ows-meta{opacity:.7;font-size:13.5px}',
    '.ow-site .ows-from{margin-top:8px;color:var(--ow-s-accent);font-weight:700}',
    '.ow-site .ows-chips span{display:inline-block;border:1px solid var(--ow-s-accent);color:var(--ow-s-accent);border-radius:999px;padding:5px 12px;margin:0 8px 8px 0;font-size:14px}',
    '.ow-site table.ows-hours{border-collapse:collapse}.ow-site table.ows-hours td{padding:5px 22px 5px 0}',
    '.ow-site .ows-links a,.ow-site .ows-links span{display:inline-block;margin:0 16px 8px 0;color:var(--ow-s-accent);text-decoration:none;font-size:17px}',
    '.ow-site .ows-links a:hover{text-decoration:underline}',
    '.ow-site .ows-timeline p{margin:0 0 8px}.ow-site .ows-timeline b{margin-right:8px}',
    '.ow-site .ows-tier{padding:12px 0;border-top:1px solid color-mix(in srgb,var(--ow-s-ink) 12%,transparent)}',
    '.ow-site .ows-tier b{font-family:var(--ow-s-fh);font-size:18px}',
    '.ow-site .ows-figures{display:flex;gap:36px;flex-wrap:wrap}',
    /* photos — theirs, at their CDN, laid as a grid; a caption only when they wrote one */
    /* their photos as they are — never cropped to a shape of ours */
    '.ow-site .ows-gallery{columns:2 180px;column-gap:10px}',
    '.ow-site .ows-gallery figure{margin:0 0 10px;break-inside:avoid}.ow-site .ows-gallery img{width:100%;height:auto;border-radius:10px;display:block;background:color-mix(in srgb,currentColor 8%,transparent)}',
    '.ow-site .ows-gallery figcaption{font-size:12.5px;opacity:.7;padding:4px 2px}',
    '.ow-site .ows-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;margin:0 0 10px;display:block}',
    '.ow-site .ows-figures b{display:block;font-family:var(--ow-s-fh);font-size:44px;color:var(--ow-s-accent);line-height:1}',
    '.ow-site .ows-foot{margin-top:36px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--ow-s-ink) 12%,transparent);font-size:12.5px;opacity:.62}',
    /* ── OVER THE WORLD, THE WORLD'S APPEARANCE ──────────────────────────
       ★ FOUNDER/441: *"the black background cannot remain over the galaxy
         and should comply with our appearance settings."*
       Projected inside the App, a page keeps its FACES, its accent, its logo
       and its photos — and paints no background of its own: the galaxy (or
       the light, or the simple) is the ground, and the ink is the App's.
       The standalone page form keeps the site's own colours. */
    '.ow-site.ow-site--world{background:transparent;color:inherit;--ow-s-ink:currentColor;--ow-s-heading:currentColor}',
    '.ow-site.ow-site--world h1,.ow-site.ow-site--world h2,.ow-site.ow-site--world h3{color:inherit}',
    '.ow-site.ow-site--world .ows-card{border-color:color-mix(in srgb,currentColor 16%,transparent)}',
    '.ow-site.ow-site--world .ows-tier,.ow-site.ow-site--world .ows-foot{border-color:color-mix(in srgb,currentColor 14%,transparent)}',
    /* the company's own page, exactly — a frame the App does not draw into */
    '.ow-mirror{margin:0 -18px}',
    /* a worn website uses the profile's whole width, as the mirror does */
    '.ow-surface .ow-proj{margin:0 -18px}',
    '.ow-mirror .ow-proj{margin:0}',
    '.ow-mirror__head{display:flex;align-items:flex-start;gap:8px}.ow-mirror__head .ow-mirror__nav{flex:1;min-width:0}',
    '.ow-mirror__edit{flex:none;margin:0 18px 10px auto;background:none;border:1px solid currentColor;border-radius:999px;color:inherit;font:inherit;font-size:13px;padding:5px 14px;cursor:pointer;opacity:.85;white-space:nowrap}',
    '.ow-mirror__edit[hidden]{display:none}',
    '.ow-site-edit{position:fixed;left:12px;right:12px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:70;padding:10px 12px 12px;border-radius:18px;',
    '  background:var(--surface,#fff);color:var(--ow-ink,#111);border:1px solid var(--border,rgba(0,0,0,.12));box-shadow:0 10px 32px rgba(0,0,0,.22);font-size:14px}',
    '.ow-site-edit__say{font-weight:600;margin:0 2px 6px}',
    '.ow-site-edit__acts{display:flex;flex-wrap:wrap;gap:6px}.ow-site-edit__end{justify-content:flex-end;margin-top:8px}',
    '.ow-site-edit__list{max-height:38vh;overflow:auto;margin:2px 0 8px}',
    '.ow-site-edit__row{display:flex;align-items:center;gap:6px;padding:4px 2px}.ow-site-edit__row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ow-site-edit__row.is-off span{opacity:.62}',
    '.ow-site-edit button{background:none;border:1px solid currentColor;border-radius:999px;padding:6px 12px;color:inherit;font:inherit;cursor:pointer}',
    '.ow-site-edit button.is-main{background:currentColor}.ow-site-edit button.is-main{color:var(--surface,#fff);background:var(--ow-ink,#111);border-color:var(--ow-ink,#111)}',
    '.ow-site-edit__ask{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ow-site-edit__ask[hidden]{display:none}.ow-site-edit__ask [hidden]{display:none}',
    '.ow-site-edit__ask input{flex:1;min-width:0;border:1px solid var(--border,rgba(0,0,0,.2));border-radius:10px;padding:7px 10px;font:inherit;background:transparent;color:inherit}',
    '.ow-mirror__nav{display:flex;gap:2px;overflow-x:auto;padding:0 18px 10px}',
    '.ow-mirror__nav button{background:none;border:0;border-bottom:2px solid transparent;color:inherit;font:inherit;font-size:13.5px;padding:6px 10px;white-space:nowrap;cursor:pointer;opacity:.7}',
    '.ow-mirror__nav button[aria-selected="true"]{opacity:1;border-bottom-color:currentColor}',
    '.ow-mirror iframe{display:block;width:100%;min-height:72vh;border:0;background:#fff}',
    '.ow-mirror__why{padding:6px 18px 0;font-size:12.5px;opacity:.62}'
  ].join('\n');
  function ensureCss() {
    if (doc.getElementById('ow-site-css')) return;
    var s = doc.createElement('style'); s.id = 'ow-site-css'; s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* THE CENTER'S STRIP, ASKED TO OPEN A CATEGORY. profileShell publishes
     `__owShowTab` on the element it was GIVEN, which is the parent of
     `.ow-prof` — `closest('.ow-prof').__owShowTab` was always undefined, so a
     written site's "see all" act and a link between two categories did
     nothing. The first ancestor that has it is asked. */
  function showTab(el, id) {
    for (var n = el; n; n = n.parentElement) {
      if (typeof n.__owShowTab === 'function') { n.__owShowTab(id); return true; }
    }
    return false;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mk(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* a served path or https — the same rule OW.imageUrl applies everywhere */
  function img(v) { return OW.imageUrl ? OW.imageUrl(v) : ''; }
  /* the company's own font files come through the Center's own door — a
     same-origin path, which OW.imageUrl already admits */
  function fontUrl(u) {
    u = String(u || '');
    return (/^\/api\/oneway\/centers\/[^\/]+\/website\/asset\?u=/.test(u) || /^https:\/\//i.test(u)) ? u : '';
  }

  /* ── THE FACE FIRST, ITS OWN FALLBACKS AFTER ─────────────────────────────
     The backend's rule, applied identically here: the face the page USES
     leads; the stack the probe read is only its fallbacks. */
  var GENERIC = { serif: 1, 'sans-serif': 1, monospace: 1, 'system-ui': 1, cursive: 1, fantasy: 1,
                  'ui-serif': 1, 'ui-sans-serif': 1, 'ui-monospace': 1 };
  function stack(face, rest, fallback) {
    face = String(face || fallback || '').replace(/["']/g, '');
    var out = face ? ["'" + face + "'"] : [];
    String(rest || '').split(',').forEach(function (x) {
      x = x.trim().replace(/^["']|["']$/g, '');
      if (!x || x === face) return;
      out.push(GENERIC[x.toLowerCase()] ? x : "'" + x + "'");
    });
    if (!out.length) out.push(fallback || 'inherit');
    return out.join(', ');
  }

  /* ── THE COMPANY'S OWN FACES, DECLARED ONCE PER CENTER ───────────────────
     @font-face for every face the probe recorded, each file through the
     Center's relay door; a public font service's stylesheet when the style
     uses one. Injected once; a second Center gets its own block. */
  function fonts(cid, pres) {
    var id = 'ow-site-fonts-' + String(cid || '').replace(/[^\w-]/g, '_');
    if (doc.getElementById(id)) return;
    var f = (pres && pres.fonts) || {};
    var rules = '';
    (f.faces || []).forEach(function (face) {
      var src = (face.src || []).map(function (x) {
        var u = fontUrl(x.url);
        return u ? ("url('" + u.replace(/'/g, '%27') + "')" + (x.format ? " format('" + String(x.format).replace(/[^\w-]/g, '') + "')" : '')) : '';
      }).filter(Boolean).join(',');
      if (!src) return;
      rules += "@font-face{font-family:'" + String(face.family || '').replace(/["']/g, '') + "';src:" + src
             + ';font-weight:' + String(face.weight || 'normal').replace(/[^\w ]/g, '')
             + ';font-style:' + String(face.style || 'normal').replace(/[^\w]/g, '') + ';font-display:swap}';
    });
    (f.font_links || []).forEach(function (u) {
      if (/^https:\/\/(fonts\.googleapis\.com|fonts\.bunny\.net|api\.fontshare\.com)\//i.test(u)) {
        var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = u; l.setAttribute('data-ow-site', id);
        doc.head.appendChild(l);
      }
    });
    var s = doc.createElement('style'); s.id = id; s.textContent = rules;
    doc.head.appendChild(s);
  }

  /* relative luminance of a CSS colour, for the one decision made here: an
     accent that would vanish on the world's ground gives way to the hue the
     world already took (never to a colour of this file's choosing) */
  function lum(css) {
    var m = String(css || '').match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/), r, g, b;
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    else { m = String(css || '').match(/^#([0-9a-f]{6})$/i); if (!m) return -1; r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); if (x < 0 || y < 0) return 21; var hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); }
  function groundOf(el) {
    var n = el;
    while (n && n !== doc.documentElement) {
      var bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(\d+,\s*\d+,\s*\d+,\s*0\)/.test(bg)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(doc.body).backgroundColor || 'rgb(0,0,0)';
  }

  /* the presentation as CSS variables on the page's root */
  function tokens(el, pres, over) {
    var f = (pres && pres.fonts) || {}, c = (pres && pres.colors) || {};
    /* ── THE BRAND ENGINE'S TOKENS (founder/452, 453) — the logo at its
       size, the headline and button as the site treats them, the type
       scale from the measured sites. Absent, the defaults below stand. */
    var b = (pres && pres.brand) || {}, hl = b.headline || {}, bt = b.button || {}, lg = b.logo || {}, ty = b.type || {};
    el.style.setProperty('--ow-s-logo-h', (lg.height || 48) + 'px');
    el.style.setProperty('--ow-s-h1', ty.h1 || 'clamp(36px, 6vw, 64px)');
    el.style.setProperty('--ow-s-h2', ty.h2 || 'clamp(26px, 3.2vw, 34px)');
    el.style.setProperty('--ow-s-h1-w', String(hl.weight || 500));
    el.style.setProperty('--ow-s-h1-tt', hl.uppercase ? 'uppercase' : 'none');
    el.style.setProperty('--ow-s-h1-ls', hl.tracking || '-0.01em');
    el.style.setProperty('--ow-s-btn-r', bt.radius || '999px');
    el.style.setProperty('--ow-s-btn-tt', (bt.uppercase === false) ? 'none' : 'uppercase');
    el.style.setProperty('--ow-s-btn-fill', bt.fill || 'var(--ow-s-accent)');
    el.style.setProperty('--ow-s-btn-ink', bt.ink || '#fff');
    el.style.setProperty('--ow-s-hero-vh', (ty.hero_vh ? Math.min(ty.hero_vh, 70) : 62) + 'vh');
    var col = function (v, d) { v = String(v || '').trim(); return /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\))$/i.test(v) ? v : d; };
    var accent = col(c.accent, '#3a7bd5');
    if (over) {
      el.classList.add('ow-site--world');
      /* the accent stays the site's unless it cannot be seen on this ground */
      var ground = groundOf(el.parentElement || doc.body);
      if (contrast(accent, ground) < 3) accent = 'rgb(var(--ow-h1, 90,160,255))';
      el.style.setProperty('--ow-s-accent', accent);
    } else {
      el.style.setProperty('--ow-s-bg', col(c.background, '#fff'));
      el.style.setProperty('--ow-s-ink', col(c.text, '#111'));
      el.style.setProperty('--ow-s-accent', accent);
      el.style.setProperty('--ow-s-heading', col(c.heading, col(c.text, '#111')));
    }
    /* ★ 445: where a face cannot load, the next face is OURS — never a generic serif */
    /* S16 — a company's own face first when the spec carries one; OURS is ONEWAY Sans and nothing else */
    el.style.setProperty('--ow-s-fh', stack(f.heading, f.heading_stack, "'ONEWAY Sans'") + ", 'ONEWAY Sans', sans-serif");
    el.style.setProperty('--ow-s-fb', stack(f.body, f.body_stack, "'ONEWAY Sans'") + ", 'ONEWAY Sans', sans-serif");
  }

  /* ── THE TEN KINDS ───────────────────────────────────────────────────────── */
  function meta(i) {
    return [i.when, i.where, i.kind, i.text].filter(function (x) { return x != null && String(x) !== ''; }).map(String).join(' · ');
  }
  function section(s, pres) {
    var k = s.kind, el;
    if (k === 'hero') {
      /* THE MODERN HERO (founder/451): a full-bleed photograph, one line,
         one act — the photo theirs, the line theirs */
      var photo = img(s.photo) || img(pres && pres.picture);
      el = mk('div', 'ows-hero' + (photo ? ' ows-hero--photo' : ''));
      if (photo) el.style.backgroundImage = 'url("' + photo.replace(/"/g, '%22') + '")';
      var inner = mk('div', 'ows-hero__in');
      inner.appendChild(mk('h1', '', esc(s.title)));
      if (s.text) inner.appendChild(mk('p', '', esc(s.text)));
      if (s.act && s.act.label) {
        var act = mk('button', 'ows-act', esc(s.act.label)); act.type = 'button';
        act.addEventListener('click', function () { showTab(el, 'site:' + (s.act.goes || 'stay')); });
        inner.appendChild(act);
      }
      el.appendChild(inner);
      return el;
    }
    if (k === 'line' && s.heading) {
      el = mk('h2', 'ows-sub', esc(s.title)); if (s.anchor) el.id = 'ows-' + s.anchor;
      return el;
    }
    el = mk('section');
    el.appendChild(mk('h2', '', esc(s.title)));
    if (!s.title && k !== 'gallery') el.removeChild(el.firstChild);
    var items = s.items || [];
    if (k === 'gallery') {
      var G = mk('div', 'ows-gallery');
      items.forEach(function (i) {
        var u = img(i.src); if (!u) return;
        var fg = doc.createElement('figure'); var im2 = doc.createElement('img'); im2.src = u; im2.alt = i.alt || ''; im2.loading = 'lazy'; fg.appendChild(im2);
        if (i.caption) fg.appendChild(mk('figcaption', '', esc(i.caption)));
        G.appendChild(fg);
      });
      if (!s.title) el.removeChild(el.firstChild);
      el.appendChild(G);
    } else if (k === 'line') {
      el.appendChild(mk('p', 'ows-line', esc(s.text)));
    } else if (k === 'text') {
      var t = mk('div', 'ows-text');
      String(s.text || '').split(/\n\n+/).forEach(function (para) { if (para.trim()) t.appendChild(mk('p', '', esc(para.trim()))); });
      el.appendChild(t);
    } else if (k === 'cards') {
      var g = mk('div', 'ows-cards' + (s.pillars ? ' ows-cards--pillars' : ''));
      items.forEach(function (i) {
        var c = mk(i.goes ? 'button' : 'div', 'ows-card' + (i.goes ? ' ows-card--goes' : ''));
        if (i.goes) {
          c.type = 'button';
          c.addEventListener('click', function () {
            var to = String(i.goes);
            if (to.charAt(0) === '#') { var t = doc.getElementById('ows-' + to.slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
            showTab(c, 'site:' + to);
          });
        }
        var cu = img(i.src); if (cu) { var ci = doc.createElement('img'); ci.src = cu; ci.alt = ''; ci.loading = 'lazy'; c.appendChild(ci); }
        c.appendChild(mk('h3', '', esc(i.title)));
        var m = meta(i); if (m) c.appendChild(mk('div', 'ows-meta', esc(m)));
        if (i.from != null && i.from !== '') c.appendChild(mk('div', 'ows-from', 'from $' + esc(i.from)));
        if (i.sleeps) c.appendChild(mk('div', 'ows-meta', 'sleeps ' + esc(i.sleeps)));
        g.appendChild(c);
      });
      el.appendChild(g);
    } else if (k === 'chips') {
      el.appendChild(mk('div', 'ows-chips', items.map(function (i) { return '<span>' + esc(i.label) + '</span>'; }).join('')));
    } else if (k === 'hours') {
      el.appendChild(mk('table', 'ows-hours', items.map(function (i) { return '<tr><td>' + esc(i.day) + '</td><td>' + esc(i.spans) + '</td></tr>'; }).join('')));
    } else if (k === 'links') {
      var L = mk('div', 'ows-links');
      items.forEach(function (i) {
        var v = String(i.value || ''), href = '';
        if (/^https?:\/\//i.test(v)) href = v;
        else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) href = 'mailto:' + v;
        else if (/^\+?[\d\s().-]{7,}$/.test(v)) href = 'tel:' + v.replace(/[^\d+]/g, '');
        if (href) {
          var a = doc.createElement('a'); a.href = href; a.textContent = v.replace(/^https?:\/\//i, '');
          if (href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
          L.appendChild(a);
        } else L.appendChild(mk('span', '', esc(v)));
      });
      el.appendChild(L);
    } else if (k === 'timeline') {
      el.appendChild(mk('div', 'ows-timeline', items.map(function (i) { return '<p><b>' + esc(i.when) + '</b>' + esc(i.what) + '</p>'; }).join('')));
    } else if (k === 'tiers') {
      items.forEach(function (i) {
        el.appendChild(mk('div', 'ows-tier', '<b>' + esc(i.name) + '</b>' + (i.at ? ' — from ' + esc(i.at) : '')
          + '<br><span class="ows-meta">' + esc((i.benefits || []).join(' · ')) + '</span>'));
      });
    } else if (k === 'figures') {
      el.appendChild(mk('div', 'ows-figures', items.map(function (i) { return '<div><b>' + esc(i.value) + '</b>' + esc(i.label) + '</div>'; }).join('')));
    } else {
      /* a kind this file does not know yet: its title and its text, never nothing */
      if (s.text) el.appendChild(mk('p', 'ows-line', esc(s.text)));
    }
    return el;
  }

  /* ── THE DESIGN SYSTEM, loaded once (founder/456) ─────────────────────── */
  function ensureSystem(href) {
    href = href || '/frontend/shared/oneway-site.css';
    if (doc.querySelector('link[data-ow-site-system]')) return;
    var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-ow-site-system', '1');
    doc.head.appendChild(l);
  }

  /* ── ONE WRITTEN PAGE — the same components the page form draws ────────── */
  function page(el, spec, pg, cid, opts) {
    ensureCss();
    opts = opts || {};
    if (pg && pg.html) {
      /* THE ASSEMBLER'S HTML (server-rendered, escaped, no scripts): the App
         injects it inside the design system with the brand's tokens; over
         the world it paints no ground of its own (441). */
      ensureSystem(spec && spec.css);
      fonts(cid || spec.center_id || spec.name, (spec && spec.presentation) || {});
      var root0 = mk('div', 'ows' + (opts.over !== false ? ' ows--world' : ''));
      var vars = spec && spec.vars ? String(spec.vars).replace(/[<>"]/g, '') : '';
      if (opts.over !== false && vars) {
        /* OVER THE WORLD the App's ink is the ink and the App's theme is the
           ground (441): the brand's ground, panel, ink and heading tokens
           stay on the page form only. MEASURED 2026-09-20 (founder/459,
           "everything below that is horrible"): the brand's black ink at 62%
           arrived on the App's dark pane — invisible — because an inline
           token outranks the world rule. The four are dropped here. */
        vars = vars.split(';').filter(function (d) { return !/^\s*--ows-(bg|panel|fg|heading)\s*:/.test(d); }).join(';');
      }
      if (vars) root0.setAttribute('style', vars);
      root0.innerHTML = String(pg.html).replace(/<script[\s\S]*?<\/script>/gi, '');
      /* a card that names a pillar opens that tab; an anchor scrolls */
      Array.prototype.forEach.call(root0.querySelectorAll('a.ows-card, a.ows-act, .ows-nav__links a'), function (a) {
        var href = a.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          var id = href.slice(1);
          var t = root0.querySelector('#' + CSS.escape(id));
          if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
          showTab(el, 'site:' + id);
        });
      });
      el.innerHTML = '';
      el.appendChild(root0);
      return root0;
    }
    var pres = (spec && spec.presentation) || {};
    fonts(cid || spec.center_id || spec.name, pres);
    var root = mk('div', 'ow-site');
    el.innerHTML = '';
    el.appendChild(root);                       /* in the tree first, so the ground can be read */
    tokens(root, pres, opts.over !== false);    /* inside ONEWAY the world is the ground (441) */
    /* the company's own logo leads every page, as on its own site — at its
       size; a logo the engine refused (too small) gives way to the name as
       a wordmark, and the request is on the spec */
    var logo = img(pres.logo);
    var brandRow = mk('div', 'ows-brand');
    if (logo) { var li = doc.createElement('img'); li.src = logo; li.alt = spec.name || ''; brandRow.appendChild(li); }
    else brandRow.appendChild(mk('span', 'ows-wordmark', esc(spec.name || '')));
    root.appendChild(brandRow);
    (pg.sections || []).forEach(function (s) { root.appendChild(section(s, pres)); });
    /* ★ FOUNDER/445: no subtext on a real profile — provenance lives in the
       spec and the receipt, never on the page */
    return root;
  }

  /* ── ONE OF THE COMPANY'S OWN PAGES, EXACTLY ─────────────────────────────
     `website.mode`: frame — its own origin in a plain frame (the browser
     isolates it; a sandbox here would break the company's own site);
     mirror — our door, in the sandbox the door names, never allow-same-origin. */
  function mirror(el, site, pageIdx) {
    ensureCss();
    var wrap = mk('div', 'ow-mirror');
    var pages = site.pages || [];
    /* `single`: this mirror is ONE page of the site standing as a category of
       the Center (founder/681); `own` is that page */
    var single = !!site.single, own = pages[pageIdx || 0] || {};
    var fr = doc.createElement('iframe');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    fr.setAttribute('loading', 'lazy');
    fr.title = (site.title || 'Website');
    var why = mk('div', 'ow-mirror__why');
    var SANDBOX = String(site.sandbox || 'allow-scripts allow-forms allow-popups').replace(/allow-same-origin/g, '');
    /* EACH PAGE BY ITS OWN MODE (the read decides per page):
         frame  — its own origin, live, no sandbox (a sandbox would cut the
                  site off from its own cookies and calls)
         mirror — our door, the owner's copy, always in the sandbox
         link   — a page that forbids framing on a site not proven this
                  Center's own: opened at its own address, in a new tab */
    function open(i) {
      var p = pages[i] || pages[0] || { opens: site.url, mode: site.mode };
      var u = String(p.opens || '');
      var mode = p.mode || site.mode;
      Array.prototype.forEach.call(nav.children, function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      if (single) back(p);
      /* THE PAGE AS THE PROFILE WEARS IT (founder/646, 647), when a copy of it
         was taken: drawn under the Center's top, on the App's ground — no
         frame, no white box. A page without a copy keeps the frame below. */
      var door = pickDoor(p);
      if (door) {
        fr.style.display = 'none'; why.textContent = '';
        proj.style.display = '';
        shown = i; wide = door === p.projection_wide;
        var mine = (openSeq += 1);
        /* always FRESH: the answer carries the owner's latest edits and
           whether THIS viewer may edit — a remembered answer showed the page
           without a saved edit, and offered the last viewer's editor */
        var got = (OW.data && OW.data.get) ? OW.data.get(door, { fresh: true })
          : global.fetch(door, { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
        got.then(function (r) {
          if (mine !== openSeq) return;                      // another page was asked for since
          var bundle = r && r.ok && r.data && r.data.bundle;
          if (!bundle) { proj.style.display = 'none'; frame(p, u, mode); return; }
          if (editing) stop(true);
          cur = { data: r.data, door: door, edits: (r.data.edits || []).slice(), saved: (r.data.edits || []).slice(),
                  onPage: function (href) {
                    var path = '';
                    try { path = new URL(href).pathname || '/'; } catch (eP) {}
                    /* a link to a page that is a category of its own opens THAT
                       category in the Center's strip (founder/681) */
                    if (single && site.categories && site.categories[path] && path !== own.path) {
                      if (showTab(el, site.categories[path])) return;
                    }
                    for (var j = 0; j < pages.length; j++) { if (pages[j].path === path) { open(j); return; } }
                    global.open(href, '_blank', 'noopener,noreferrer');
                  } };
          fit();
          redraw();
          editBtn.hidden = !r.data.may_edit;
        }).catch(function () { if (mine === openSeq) { proj.style.display = 'none'; frame(p, u, mode); } });
        return;
      }
      wide = false; fit();
      editBtn.hidden = true;
      proj.style.display = 'none';
      frame(p, u, mode);
    }
    var openSeq = 0, shown = -1, wide = false;
    var proj = mk('div', 'ow-mirror__proj');
    proj.style.display = 'none';
    /* PHONE OR DESKTOP (founder/663: *"a website that displays the same on
       mobile should also display the same way on the one way app on mobile
       compared to how it displays on desktop"*). The copy a browser of this
       width would have been given: the phone's below 768 px of room, the
       desktop's from there (an iPad is served the desktop site too). Room is
       the App's page beside the rail, not the profile's 640 px column — a
       desktop site squeezed into a phone-width column is neither. */
    var WIDE_AT = 768;
    function room() {
      var col = el.closest && el.closest('.ow-col');
      var w = col ? col.getBoundingClientRect().width : 0;
      return w || global.innerWidth || 0;
    }
    function pickDoor(p) {
      var rx = /^\/api\/oneway\/centers\/[^\/]+\/website\/projection\?/;
      var narrow = rx.test(String(p.projection || '')) ? p.projection : '';
      var broad = rx.test(String(p.projection_wide || '')) ? p.projection_wide : '';
      return (broad && room() >= WIDE_AT) ? broad : (narrow || broad);
    }
    /* a desktop copy spans the App's whole page beside the rail */
    function fit() {
      proj.style.removeProperty('width'); proj.style.removeProperty('margin-left');
      proj.classList.toggle('is-wide', wide);
      if (!wide) return;
      var col = el.closest && el.closest('.ow-col');
      if (!col) return;
      var cr = col.getBoundingClientRect(), pr = proj.getBoundingClientRect();
      if (cr.width <= pr.width + 1) return;
      proj.style.setProperty('width', Math.round(cr.width) + 'px');
      proj.style.setProperty('margin-left', Math.round(cr.left - pr.left) + 'px');
    }
    var lastRoom = 0, rq = null;
    function onResize() {
      if (!wrap.isConnected) { global.removeEventListener('resize', onResize); return; }
      if (rq) global.clearTimeout(rq);
      rq = global.setTimeout(function () {
        var w = room();
        /* crossing the line between a phone's room and a desktop's: the other copy */
        if (shown >= 0 && lastRoom && ((w >= WIDE_AT) !== (lastRoom >= WIDE_AT)) && pages[shown] && pages[shown].projection_wide) { lastRoom = w; open(shown); return; }
        lastRoom = w; fit();
      }, 120);
    }
    lastRoom = room();
    global.addEventListener('resize', onResize);

    /* ── THE OWNER'S EDITOR (founder/646: "display and edit any kind of
       website"; 647: our own editor, "if it isn't months and mediocre") ──
       Offered only when the copy door says THIS viewer operates the Center.
       Tap anything on the page: its words change in place, a photograph or a
       link takes a new https address, anything can be hidden, and "Select
       around it" widens the choice to the block that holds it. Nothing is
       saved until Save; Cancel puts the page back. The bar sits above the
       dock, inline, never a window over the page (S2). */
    var cur = null, editing = false, sel = null, bar = null;
    var editBtn = mk('button', 'ow-mirror__edit', 'Edit'); editBtn.type = 'button'; editBtn.hidden = true;
    editBtn.addEventListener('click', function () { start(); });
    function redraw() {
      if (!cur) return null;
      var h = project(proj, cur.data.bundle, { adapt: true, edits: cur.edits, onPage: cur.onPage, motion: !editing });
      if (editing) arm(h);
      return h;
    }
    function keyOf(n) { return n && n.getAttribute ? n.getAttribute('data-owx-k') : null; }
    function unitOf(t) {
      for (var n = t; n && n.nodeType === 1; n = n.parentElement) {
        if (!keyOf(n)) continue;
        if (n.tagName === 'IMG' || n.tagName === 'A') return n;
        for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return n;
      }
      return null;
    }
    function record(op, n, value) {
      var k = keyOf(n);
      if (!k) return;
      var was = n.getAttribute('data-owx-orig') || wordsOf(n);
      if (!n.hasAttribute('data-owx-orig')) n.setAttribute('data-owx-orig', was);
      cur.edits = cur.edits.filter(function (e) { return !(e.k === k && e.op === op); });
      cur.edits.push({ op: op, k: k, tag: n.tagName.toLowerCase(), was: was, value: value });
      paintBar();
    }
    function finishText() {
      if (!sel || sel.getAttribute('contenteditable') !== 'true') return;
      sel.setAttribute('contenteditable', 'false');
      if (sel.innerHTML !== sel.__owxBefore) record('text', sel, sel.innerHTML);
    }
    function select(n) {
      if (sel) { finishText(); sel.removeAttribute('data-owx-sel'); }
      sel = n || null;
      if (sel) { if (!sel.hasAttribute('data-owx-orig')) sel.setAttribute('data-owx-orig', wordsOf(sel)); sel.setAttribute('data-owx-sel', ''); }
      paintBar();
    }
    function arm(h) {
      var r = h.shadowRoot, st = doc.createElement('style');
      st.textContent = '[data-owx-sel]{outline:2px solid #4f7cff!important;outline-offset:2px!important}[contenteditable="true"]{cursor:text!important;outline-style:dashed!important}';
      r.appendChild(st);
      r.addEventListener('click', function (e) {
        if (!editing) return;
        if (sel && sel.getAttribute('contenteditable') === 'true' && sel.contains(e.target)) return;   // typing
        e.preventDefault(); e.stopPropagation();
        select(unitOf(e.target));
      }, true);
      r.addEventListener('submit', function (e) { if (editing) { e.preventDefault(); e.stopPropagation(); } }, true);
    }
    function paintBar() {
      if (!editing) { if (bar) { bar.remove(); bar = null; } return; }
      if (!bar) {
        bar = mk('div', 'ow-site-edit'); doc.body.appendChild(bar);
        bar.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button'); if (b) act(b.getAttribute('data-a'), b); });
      }
      if (cats) { bar.innerHTML = catsHtml(); return; }
      var kind = !sel ? '' : sel.tagName === 'IMG' ? 'Photo' : sel.tagName === 'A' ? 'Link' : /^H[1-6]$/.test(sel.tagName) ? 'Heading' : (sel.querySelector('img,[data-owx-k] [data-owx-k]') ? 'Block' : 'Words');
      var link = sel && (sel.tagName === 'A' ? sel : sel.closest('a'));
      var h = '<div class="ow-site-edit__say">' + (sel ? esc(kind) + (cur.edits.length ? ' · ' + cur.edits.length + ' change' + (cur.edits.length === 1 ? '' : 's') : '') : 'Tap anything on the page to change it') + '</div><div class="ow-site-edit__acts">';
      if (sel && sel.tagName !== 'IMG' && !sel.querySelector('img')) h += '<button type="button" data-a="text">Change words</button>';
      if (sel && sel.tagName === 'IMG') h += '<button type="button" data-a="photo">Change photo</button>';
      if (link) h += '<button type="button" data-a="link">Change link</button>';
      if (sel) h += '<button type="button" data-a="hide">Hide</button><button type="button" data-a="up">Select around it</button>';
      /* which of the site's pages are categories of this Center (founder/681) */
      if (!sel) h += '<button type="button" data-a="cats">Categories</button>';
      h += '</div><div class="ow-site-edit__ask" hidden><button type="button" data-a="pick" class="ow-site-edit__pick">Choose a photo</button>' +
           '<input type="file" accept="image/*" hidden class="ow-site-edit__file">' +
           '<input type="url" inputmode="url" placeholder="https://" aria-label="Address"><button type="button" data-a="apply">Use it</button></div>' +
           '<div class="ow-site-edit__acts ow-site-edit__end">' + (cur.edits.length > cur.saved.length || cur.edits.length ? '<button type="button" data-a="undo">Undo</button>' : '') +
           '<button type="button" data-a="cancel">Cancel</button><button type="button" data-a="save" class="is-main">Save</button></div>';
      bar.innerHTML = h;
    }
    /* ── THE CENTER CHOOSES ITS SITE'S CATEGORIES (founder/681) ─────────────
       *"the centers choose how the site displays on their center"*. In the
       same bar, for the same person (an operator): every page of the site,
       the chosen ones first in their order — Earlier moves one up, Remove
       takes it out, Add puts one in — or the whole site kept as one Website
       tab. Saved through the Center's own door; the strip is drawn again. */
    var cats = null;
    function catsDoor() { return String(cur.door).replace(/\/projection\?.*$/, '/categories'); }
    function loadCats() {
      var got = (OW.data && OW.data.get) ? OW.data.get(catsDoor(), { fresh: true })
        : global.fetch(catsDoor(), { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      got.then(function (r) {
        if (!r || !r.ok || !r.data || !r.data.pages) { if (OW.toast) OW.toast('The categories could not be read.'); return; }
        cats = { display: r.data.display || 'categories', paths: (r.data.paths || []).slice(), pages: r.data.pages,
                 most: (r.data.limits || {}).by_choice || 12, reset: false, own: {}, order: [] };
        /* the strip as it is drawn now: the site's categories and the Center's
           own, in order — so a page can be placed BETWEEN the Center's own */
        var prof = el.closest && el.closest('.ow-prof');
        var btns = prof ? prof.querySelectorAll('.ow-tabs [data-t]') : [];
        for (var bi = 0; bi < btns.length; bi++) {
          var id = btns[bi].dataset.t || '';
          if (!id) continue;
          if (id.indexOf('web:') === 0) { if (cats.paths.indexOf(id.slice(4)) >= 0) cats.order.push(id); continue; }
          if (id === 'website') continue;
          var first = btns[bi].childNodes[0];
          cats.own[id] = String((first && first.nodeType === 3 ? first.nodeValue : btns[bi].textContent) || id).replace(/\s+/g, ' ').trim();
          cats.order.push(id);
        }
        cats.paths.forEach(function (path) { if (cats.order.indexOf('web:' + path) < 0) cats.order.push('web:' + path); });
        paintBar();
      }).catch(function () { if (OW.toast) OW.toast('The categories could not be read.'); });
    }
    function catsHtml() {
      var label = {}; cats.pages.forEach(function (p) { label[p.path] = p.label || p.path; });
      var on = cats.paths.filter(function (path) { return label[path] != null; });
      var off = cats.pages.filter(function (p) { return on.indexOf(p.path) < 0 && p.mode !== 'link'; });
      var tab = cats.display === 'tab';
      var h = '<div class="ow-site-edit__say">' + (tab ? 'Your site is one Website tab' : 'Your Center\u2019s categories \u00b7 ' + on.length + ' of ' + cats.most + ' from your site') + '</div>';
      if (!tab) {
        h += '<div class="ow-site-edit__list">';
        /* the whole strip, in order: a page of the site can be moved before or
           after People, Main and the rest; the Center's own stay, and move */
        cats.order.forEach(function (id, i) {
          var site = id.indexOf('web:') === 0, path = site ? id.slice(4) : '';
          if (site && label[path] == null) return;
          h += '<div class="ow-site-edit__row"><span>' + esc(site ? label[path] : (cats.own[id] || id)) + '</span>' +
               (i ? '<button type="button" data-a="cat-up" data-p="' + esc(id) + '">Earlier</button>' : '') +
               (site ? '<button type="button" data-a="cat-off" data-p="' + esc(id) + '">Remove</button>' : '') + '</div>';
        });
        off.forEach(function (p) {
          h += '<div class="ow-site-edit__row is-off"><span>' + esc(p.label || p.path) + '</span>' +
               '<button type="button" data-a="cat-on" data-p="' + esc(p.path) + '">Add</button></div>';
        });
        h += '</div>';
      }
      h += '<div class="ow-site-edit__acts"><button type="button" data-a="cat-tab">' + (tab ? 'Show its pages as categories' : 'Keep it as one Website tab') + '</button>' +
           (tab ? '' : '<button type="button" data-a="cat-reset">Use the site\u2019s own sections</button>') + '</div>' +
           '<div class="ow-site-edit__acts ow-site-edit__end"><button type="button" data-a="cat-cancel">Cancel</button><button type="button" data-a="cat-save" class="is-main">Save</button></div>';
      return h;
    }
    function catsAct(a, b) {
      /* a row names a category of the strip (data-p: "web:" + path, or one of
         the Center's own ids); Add names a page of the site by its path */
      var id = b ? b.getAttribute('data-p') : '', i = cats.order.indexOf(id);
      if (a === 'cat-cancel') { cats = null; paintBar(); return; }
      if (a === 'cat-tab') cats.display = cats.display === 'tab' ? 'categories' : 'tab';
      if (a === 'cat-reset') { cats.reset = true; cats.paths = []; saveCats(); return; }
      if (a === 'cat-off' && i >= 0 && id.indexOf('web:') === 0) {
        if (cats.paths.length < 2) { if (OW.toast) OW.toast('A Center with its site shown keeps at least one page.'); return; }
        cats.order.splice(i, 1); cats.reset = false;
      }
      if (a === 'cat-up' && i > 0) { cats.order.splice(i - 1, 0, cats.order.splice(i, 1)[0]); cats.reset = false; }
      if (a === 'cat-on' && id && cats.order.indexOf('web:' + id) < 0) {
        if (cats.paths.length >= cats.most) { if (OW.toast) OW.toast('At most ' + cats.most + ' pages are categories. Remove one first.'); return; }
        /* a new page joins after the last page of the site already there */
        var last = -1;
        cats.order.forEach(function (x, j) { if (x.indexOf('web:') === 0) last = j; });
        cats.order.splice(last + 1, 0, 'web:' + id); cats.reset = false;
      }
      /* the site's pages, in the strip's order, are the paths the Center chose */
      cats.paths = cats.order.filter(function (x) { return x.indexOf('web:') === 0; }).map(function (x) { return x.slice(4); });
      if (a === 'cat-save') { saveCats(); return; }
      paintBar();
    }
    function saveCats() {
      var body = cats.reset ? { display: cats.display, reset: true } : { display: cats.display, paths: cats.paths, order: cats.order };
      var req = (OW.data && OW.data.put) ? OW.data.put(catsDoor(), body)
        : global.fetch(catsDoor(), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      req.then(function (r) {
        if (!r || !r.ok) { if (OW.toast) OW.toast('Not saved' + (r && r.data && r.data.detail ? ': ' + r.data.detail : '') + '.'); return; }
        /* the strip is built when the Center's page is: drawn again, whole */
        global.location.reload();
      }).catch(function () { if (OW.toast) OW.toast('Not saved.'); });
    }
    function ask(kind) {
      var a = bar.querySelector('.ow-site-edit__ask'); a.hidden = false; a.setAttribute('data-kind', kind);
      a.querySelector('.ow-site-edit__pick').hidden = kind !== 'src';
      var i = a.querySelector('input[type="url"]'); i.value = '';
      if (kind !== 'src') i.focus();
      var f = a.querySelector('.ow-site-edit__file');
      f.onchange = function () { if (f.files && f.files[0]) upload(f.files[0]); };
    }
    /* A PHOTOGRAPH FROM THE PHONE: it goes through the App's one media door
       (POST /api/oneway/media — the writer reads its bytes, never its claimed
       type) and the page takes the address that door gives back */
    function upload(file) {
      var target = sel;
      if (!target || target.tagName !== 'IMG') return;
      var pick = bar && bar.querySelector('.ow-site-edit__pick');
      if (pick) { pick.textContent = 'Adding…'; pick.disabled = true; }
      var rd = new global.FileReader();
      rd.onload = function () {
        var post = (OW.data && OW.data.post) ? OW.data.post('/api/oneway/media', { data: rd.result, origin: 'uploaded' })
          : global.fetch('/api/oneway/media', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: rd.result, origin: 'uploaded' }) })
              .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
        post.then(function (r) {
          var item = r && r.ok && r.data && r.data.media;
          if (!item || !item.url) { if (OW.toast) OW.toast('That photo could not be added' + (r && r.data && r.data.detail ? ': ' + r.data.detail : '') + '.'); if (pick) { pick.textContent = 'Choose a photo'; pick.disabled = false; } return; }
          target.setAttribute('src', item.url); target.removeAttribute('srcset');
          record('src', target, item.url);
        }).catch(function () { if (OW.toast) OW.toast('That photo could not be added.'); });
      };
      rd.readAsDataURL(file);
    }
    function act(a, b) {
      if (!cur) return;
      if (a === 'cats') { loadCats(); return; }
      if (cats && /^cat-/.test(a || '')) { catsAct(a, b); return; }
      if (a === 'text' && sel) { sel.__owxBefore = sel.innerHTML; sel.setAttribute('contenteditable', 'true'); sel.focus(); return; }
      if (a === 'photo') { ask('src'); return; }
      if (a === 'link') { ask('href'); return; }
      if (a === 'pick') { var fi = bar.querySelector('.ow-site-edit__file'); if (fi) fi.click(); return; }
      if (a === 'apply' && sel) {
        var box = bar.querySelector('.ow-site-edit__ask'), inp = box.querySelector('input[type="url"]'), v = inp.value.trim(), kind = box.getAttribute('data-kind');
        if (!/^https:\/\//i.test(v) && !(kind === 'href' && /^(mailto:|tel:)/i.test(v))) { inp.setCustomValidity('An https address'); inp.reportValidity(); return; }
        inp.setCustomValidity('');
        var target = kind === 'href' ? (sel.tagName === 'A' ? sel : sel.closest('a')) : sel;
        if (!target) return;
        if (kind === 'src') { target.setAttribute('src', v); target.removeAttribute('srcset'); } else target.setAttribute('href', v);
        record(kind, target, v); return;
      }
      if (a === 'hide' && sel) { var n = sel; select(null); record('hide', n, ''); n.style.setProperty('display', 'none', 'important'); return; }
      if (a === 'up' && sel) { for (var up = sel.parentElement; up; up = up.parentElement) { if (keyOf(up)) { select(up); return; } } return; }
      if (a === 'undo') { finishText(); cur.edits.pop(); sel = null; redraw(); paintBar(); return; }
      if (a === 'cancel') { cur.edits = cur.saved.slice(); stop(); return; }
      if (a === 'save') { finishText(); save(); }
    }
    function save() {
      var url = String(cur.door).replace(/\?.*$/, '') + '/edits';
      var body = { path: cur.data.path, host: cur.data.host || '', edits: cur.edits };
      var finish = function (ok, why) {
        if (ok) { cur.saved = cur.edits.slice(); stop(); if (OW.toast) OW.toast('Saved. Your website shows it now.', { tone: 'ok' }); }
        else if (OW.toast) OW.toast('Not saved' + (why ? ': ' + why : '') + '.');
      };
      var req = (OW.data && OW.data.put) ? OW.data.put(url, body)
        : global.fetch(url, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      req.then(function (r) { finish(r && r.ok, r && r.data && r.data.detail); }).catch(function () { finish(false); });
    }
    function start() { if (!cur) return; editing = true; sel = null; redraw(); paintBar(); editBtn.hidden = true; }
    function stop(quiet) { editing = false; sel = null; cats = null; paintBar(); if (!quiet) redraw(); editBtn.hidden = !(cur && cur.data && cur.data.may_edit); }
    function frame(p, u, mode) {
      /* ON A PHONE, THE LIVE PAGE WHEN THE SITE MAY BE FRAMED (2026-10-01,
         register row 9). The captured copy is frozen as a desktop browser drew
         it — "no-touch", inline widths of 740–1024 px — so at 375–450 px it was
         cut off on the right (status-2026-10-01/app-fourqueens-embed-cropped-
         375.jpg). The company's live page is the exact page and carries its
         own phone layout, so a narrow screen frames that, in frame mode (no
         sandbox, as frame mode always is). Desktop keeps the copy. A site whose
         headers forbid framing stays a mirror — a phone-width capture is the
         website owner's next step for those (agreed with the OS chat). */
      var narrow = Math.min(global.innerWidth || 9999, el.clientWidth || global.innerWidth || 9999) <= 600;
      if (narrow && site.mode === 'frame' && mode === 'mirror' && p.path && site.url) {
        try {
          var live = new URL(p.path, site.url);
          if (live.protocol === 'https:') { u = live.href; mode = 'frame'; }
        } catch (eLive) {}
      }
      if (mode === 'link') {
        fr.style.display = 'none';
        why.innerHTML = esc('This page forbids being shown inside another site. ') + '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc('Open ' + (p.label || 'it') + ' on ' + String(site.url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')) + '</a>';
        return;
      }
      if (!/^(https:\/\/|\/api\/oneway\/centers\/)/.test(u)) { fr.style.display = 'none'; why.textContent = 'This page cannot be shown here.'; return; }
      if (mode === 'mirror') fr.setAttribute('sandbox', SANDBOX); else fr.removeAttribute('sandbox');
      fr.style.display = '';
      fr.src = u;
      why.textContent = '';   /* ★ 445: no subtext under a company's own page */
    }
    var nav = mk('div', 'ow-mirror__nav');
    if (pages.length > 1 && !single) {
      pages.forEach(function (p, i) {
        var b = mk('button', '', esc(p.label || p.path)); b.type = 'button';
        b.addEventListener('click', function () { open(i); });
        nav.appendChild(b);
      });
      wrap.appendChild(nav);
    }
    /* A CATEGORY OF ITS OWN (founder/681) has no page row: the Center's strip
       is its row. A link inside it to a page of the site that is NOT a
       category opens here, and then the row appears with one way back — the
       category's own page — so nobody is left on a page with no return. */
    function back(p) {
      nav.innerHTML = '';
      if (!p || p.path === own.path) { if (nav.parentNode) nav.parentNode.removeChild(nav); return; }
      [own, p].forEach(function (q, k) {
        var b = mk('button', '', esc(q.label || q.path)); b.type = 'button';
        b.setAttribute('aria-selected', k === 1 ? 'true' : 'false');
        if (k === 0) b.addEventListener('click', function () { open(pageIdx || 0); });
        nav.appendChild(b);
      });
      if (!nav.parentNode) head.insertBefore(nav, head.firstChild);
    }
    /* Edit stays in reach: beside the page row, never at the end of a row
       that scrolls sideways through forty pages */
    var head = mk('div', 'ow-mirror__head');
    if (pages.length > 1 && !single) { wrap.removeChild(nav); head.appendChild(nav); }
    head.appendChild(editBtn);
    wrap.insertBefore(head, wrap.firstChild);
    wrap.appendChild(proj);
    wrap.appendChild(fr);
    wrap.appendChild(why);
    el.innerHTML = '';
    el.appendChild(wrap);
    open(pageIdx || 0);
    return wrap;
  }

  /* ── A WEBSITE, WORN BY THE PROFILE ──────────────────────────────────────
     ★ FOUNDER/646: *"a social media profile can perfectly display and edit
       any kind of website"* · ★ FOUNDER/647: *"we must also be able to ADAPT
       to sites"* — *"the hard part is making it all look good with the center
       top and transparent and changing app backgrounds"*.

     NOT A FRAME. `mirror` puts the company's page in an iframe: a white box
     under the Center's top, desktop-wide on a phone. `project` draws the page
     itself — its own markup, its own rules, its own faces — inside a SHADOW
     ROOT under the Center's top, so nothing of the site reaches the App and
     nothing of the App reaches the site. The bundle comes from
     tools/project_page.cjs: its `@media` width rules are already `@container
     owx` rules and its `vw` is `cqw`, so the site answers the width of THIS
     host — a profile column, never the window.

     TWO WAYS TO WEAR IT:
       exact  — the page as the company drew it: its own ground, its own ink.
                What the fidelity score measures against the live site.
       adapt  — the page on the App's ground (founder/647): the site's own
                header gives way to the Center's top, overlays (cookie bars,
                chat bubbles, pop-ups) are not carried, the page's ground goes
                transparent so the App's changing background is the ground, and
                words that would vanish on that ground take the App's ink.
                Bands of their own colour, photographs and buttons stay theirs.

     NOTHING RUNS. The bundle carries no script (the capture removed them and
     the server sanitizes); `clean` removes anything executable again here,
     because this markup lives in the App's own document. Links never move
     the App: a page of the same site goes to `opts.onPage`, anything else
     opens in its own tab. */
  var PROJ_ADAPT = [
    '[data-owx-role="header"]{display:none!important}',
    /* overlays a visitor would close are not carried; the site's own pinned
       panels are (placed where the visitor saw them, by the renderer) */
    '[data-owx-overlay="1"]{display:none!important}',
    /* ONLY what is pinned to the SCREEN. A `position: sticky` element is part of
       the page (a pinned section, a column that follows the scroll): the rule
       used to take every sticky element below the first screen for a bottom
       bar and hid it — four of Stripe's and five of Apple AirPods' were not
       drawn on the adapted page at all. A bar that sticks to the screen's
       BOTTOM is the site's own chrome over the App's dock, and is not carried. */
    '[data-owx-pos="fixed"][data-owx-fixed="cover"]:not([data-owx-overlay="0"]),[data-owx-pos="fixed"][data-owx-fixed="middle"]:not([data-owx-overlay="0"]),[data-owx-pos="fixed"][data-owx-fixed="bottom"]:not([data-owx-overlay="0"]),[data-owx-stick="bottom"]{display:none!important}',
    '[data-owx-fixed="top"]{position:relative!important;top:auto!important}',
    /* a pinned box that holds most of the page IS the page: it stays layered
       where the visitor saw it (over the slideshow under it, on Russ &
       Daughters), grown to its content; the profile grows to hold it */
    '[data-owx-fixed="page"]{height:auto!important;max-height:none!important;overflow:visible!important}'
  ].join('\n');
  /* ON THE APP'S GROUND: the page's own ground gives way and words that would
     vanish take the App's ink. NOT used when the site is DARK and the App is
     light (founder/687: "the highest and cleanest visual quality"): repainted
     onto lavender, Linear's black page lost its look and a third of its words
     fell below readable contrast. A dark site keeps its own ground there —
     its header still gives way to the Center's, its overlays are still not
     carried — and its words stay exactly as it drew them. */
  var PROJ_GROUND = [
    '.owx-html,.owx-body{background:transparent!important;background-image:none!important}',
    '[data-owx-bg="ground"]{background-color:transparent!important}',
    '[data-owx-ink]{color:var(--owx-app-ink)!important}',
    '[data-owx-ink] a:not([class]){color:inherit!important}',
    'svg[data-owx-ink] [data-owx-f]{fill:var(--owx-app-ink)!important}',
    'svg[data-owx-ink] [data-owx-s]{stroke:var(--owx-app-ink)!important}'
  ].join('\n');
  /* A block the site PINS WHILE ITS TRACK PASSES (position: sticky) stays
     pinned. The first rule used to take it too — two attribute tests beat the
     one in the rule that was meant to keep it — so every pinned stage left
     the flow and lay at the top of its track: Apple's AirPods scene scrolled
     away with the page instead of holding the screen (founder/663). */
  var PROJ_EXACT = [
    '[data-owx-fixed]:not([data-owx-fixed="hidden"]):not([data-owx-pos="sticky"]){position:absolute!important}',
    '[data-owx-pos="sticky"]{position:sticky!important}'
  ].join('\n');
  var KILL_TAGS = /^(SCRIPT|NOSCRIPT|TEMPLATE|OBJECT|EMBED|APPLET|BASE|META|LINK|FRAME|FRAMESET|PORTAL)$/;
  /* TWO WAYS PAST THIS, CLOSED (lane B, 2026-10-03; tests/test_site_clean.cjs). A browser drops tabs and
     newlines anywhere in a URL and control characters at its ends, so "java&#9;script:" is a javascript:
     link the test below did not see: the value is read as the browser reads it. And an SVG animation
     writes an attribute while the page runs: <animate attributeName="href" values="javascript:..."> made a
     link this pass had already cleared. An animation of a link or of a handler goes; its values are read
     as URLs. */
  var URL_ATTRS = /^(href|src|action|xlink:href|poster|data|background|ping|cite|longdesc|values|to|from|by)$/;
  var ANIM_TAGS = /^(ANIMATE|SET|ANIMATETRANSFORM|ANIMATEMOTION)$/;
  function asUrl(v) { return v.replace(/[\u0000- \u007f-\u009f]+/g, ''); }
  function clean(root) {
    var all = root.querySelectorAll('*');
    for (var i = all.length - 1; i >= 0; i--) {
      var n = all[i];
      if (KILL_TAGS.test(n.tagName.toUpperCase())) { n.remove(); continue; }
      if (ANIM_TAGS.test(n.tagName.toUpperCase()) && /href$|^on/i.test(n.getAttribute('attributeName') || '')) { n.remove(); continue; }
      if (n.tagName === 'IFRAME') {
        var s = n.getAttribute('src') || '';
        if (!/^https:\/\//i.test(s)) { n.remove(); continue; }
        n.setAttribute('sandbox', 'allow-scripts allow-popups allow-presentation');
        n.setAttribute('referrerpolicy', 'no-referrer'); n.setAttribute('loading', 'lazy');
      }
      for (var j = n.attributes.length - 1; j >= 0; j--) {
        var a = n.attributes[j], k = a.name.toLowerCase(), v = String(a.value || '');
        if (k.indexOf('on') === 0 || k === 'srcdoc' || k === 'formaction') { n.removeAttribute(a.name); continue; }
        if (URL_ATTRS.test(k) && /^(javascript|vbscript|data:text)/i.test(asUrl(v))) { n.removeAttribute(a.name); continue; }
        if ((k === 'style' || k === 'data-owx-rvs') && /expression\(|javascript:|-moz-binding|behavior\s*:/i.test(v)) n.removeAttribute(a.name);
        if (k === 'data-owx-stream' && !/^https:\/\/[^\s"'<>]+$/i.test(v)) n.removeAttribute(a.name);
      }
    }
  }
  function cssClean(t) { return String(t || '').replace(/expression\(|javascript:|-moz-binding|behavior\s*:|@import[^;]*;/gi, ''); }
  /* the person's ground and ink, read from the App as it is drawn right now */
  function appGround() {
    var c = '', el = doc.body;
    while (el && !c) { var b = global.getComputedStyle(el).backgroundColor; if (b && !/rgba\([^)]*,\s*0\)$/.test(b) && b !== 'transparent') c = b; el = el.parentElement; }
    return c || 'rgb(255, 255, 255)';
  }
  function siteKeyOf(b) {
    var u = String(b.final_url || b.requested || 'site'), h = 0;
    for (var i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) | 0;
    return 'owx-faces-' + (h >>> 0).toString(36);
  }
  /* words that sit straight on the App's ground and would not be read there
     take the App's ink; words on a band, a card, a photograph or a button keep
     theirs. WHICH words sit on the ground was measured when the page was taken
     (`data-owx-on="ground"`, from the browser's own paint order — a parent
     walk cannot see a white card drawn as a sibling layer, and on Stripe it
     turned card titles white on white). A bundle without those marks falls
     back to the parent walk. */
  function rgbArr(c) { var m = String(c || '').match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/); return m ? [+m[1], +m[2], +m[3]] : null; }
  function nudge(col, toward, ground, need) {
    var a = rgbArr(col), b = rgbArr(toward) || (lum(ground) > 0.4 ? [0, 0, 0] : [255, 255, 255]);
    if (!a) return toward;
    /* toward the App's ink when that reads and raises contrast; otherwise
       toward black or white, whichever is further from the backdrop — on
       Stripe's purple button the App's dark ink LOWERED contrast and the
       white words went dark */
    var bw = contrast('rgb(0,0,0)', ground) >= contrast('rgb(255,255,255)', ground) ? [0, 0, 0] : [255, 255, 255];
    if (contrast('rgb(' + b.join(',') + ')', ground) < need || contrast('rgb(' + b.join(',') + ')', ground) <= contrast(col, ground)) b = bw;
    for (var t = 0.05; t <= 1.0001; t += 0.05) {
      var c = 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }).join(',') + ')';
      if (contrast(c, ground) >= need) return c;
    }
    return 'rgb(' + b.join(',') + ')';
  }
  /* EVERY WORD READS, ON WHATEVER IS REALLY BEHIND IT (founder/650, 654).
     For each word on the first screens' worth of the page, the backdrop is
     found in the ADAPTED render — the nearest ancestor that still paints, its
     translucency laid over what is under it, the App's own ground when
     nothing paints. Then:
       · the aim is the contrast the word had on the live site (data-owx-cr),
         never below WCAG 2.2 AA (4.5:1, or 3:1 for large words and icons);
       · a word on one of the site's own surfaces that the adapter did not
         touch keeps the site's design, even below AA (their choice, not ours);
       · a word the capture saw on a card drawn as a SIBLING layer (paint order
         a parent walk cannot see — Stripe's cards) is trusted to that card.
     The fix is the smallest move of the word's own colour toward the App's
     ink (or black/white) that meets the aim, so a grey secondary line stays a
     secondary line. */
  function inkPass(root, ground, ink) {
    var gl = lum(ground), out = 0;
    if (gl < 0) return 0;
    var G = rgbArr(ground) || [255, 255, 255];
    var cache = new Map();
    function backdropOf(el) {          // [r,g,b] behind el, or null when it is a picture
      /* the word's own box first: a button's label sits on the button's paint */
      var layers = [], n = /^(svg|img)$/i.test(el.tagName) ? el.parentElement : el, picture = false;
      while (n && !(n.classList && n.classList.contains('owx-html'))) {
        if (cache.has(n)) { var hit = cache.get(n); if (hit === null) return null; layers.push(hit); return finish(layers, true); }
        var cs = global.getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient\(/.test(cs.backgroundImage)) { picture = true; break; }
        var m = String(cs.backgroundColor).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
        if (m) { var a = m[4] == null ? 1 : +m[4]; if (a > 0.02) { layers.push([+m[1], +m[2], +m[3], a]); if (a >= 0.98) break; } }
        n = n.parentElement;
      }
      if (picture) return null;
      return finish(layers, false);
    }
    function finish(layers, cached) {
      var base = G.slice(0, 3);
      if (cached) { base = layers.pop().slice(0, 3); }
      for (var i = layers.length - 1; i >= 0; i--) { var L = layers[i]; base = [0, 1, 2].map(function (k) { return L[k] * L[3] + base[k] * (1 - L[3]); }); }
      return base;
    }
    function cssOf(v) { return 'rgb(' + v.map(Math.round).join(',') + ')'; }
    var els = root.querySelectorAll('.owx-body *'), n = 0;
    for (var i = 0; i < els.length && n < 6000; i++) {
      var el = els[i], tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'script' || tag === 'style') continue;
      var svg = tag === 'svg';
      if (svg && !el.hasAttribute('data-owx-mono')) {
        /* a many-coloured mark (Stripe's amazon: black word, orange smile):
           only its NEUTRAL ink that would vanish on what is really behind it
           moves; its brand colours stay its own */
        if (el.getAttribute('data-owx-on') === 'band' && !el.closest('[data-owx-bg="ground"]')) continue;
        var sb = backdropOf(el);
        if (sb === null) continue;
        var sbCss = cssOf(sb), moved = 0, shapes = el.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse, text, use');
        for (var q = 0; q < shapes.length && q < 200; q++) {
          var scs = global.getComputedStyle(shapes[q]);
          ['fill', 'stroke'].forEach(function (prop) {
            var v = scs[prop];
            if (!v || v === 'none' || /url\(/.test(v)) return;
            var c3 = rgbArr(v);
            if (!c3) return;
            var mx = Math.max(c3[0], c3[1], c3[2]), mn = Math.min(c3[0], c3[1], c3[2]);
            if ((mx ? (mx - mn) / mx : 0) >= 0.2 || contrast(v, sbCss) >= 3) return;
            shapes[q].style.setProperty(prop, nudge(v, ink, sbCss, 3.1), 'important'); moved++;
          });
        }
        if (moved) out++;
        continue;
      }
      if (!svg) {
        var has = false;
        for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && c.nodeValue.trim()) { has = true; break; } }
        if (!has) continue;
      }
      if (el.closest('svg') && !svg) continue;
      n++;
      var on = el.getAttribute('data-owx-on') || '';
      if (on === 'picture') continue;                                           // over a photograph: theirs
      if (on === 'band' && !el.closest('[data-owx-bg="ground"]')) continue;   // their surface, untouched
      var cs = svg ? null : global.getComputedStyle(el);
      if (!svg && (cs.visibility === 'hidden' || cs.display === 'none')) continue;
      /* the real layers behind, composited over the App's ground — a word the
         capture saw on the page's ground can still sit under a see-through
         button or panel (Stripe's "Sign up with Google") */
      var back = backdropOf(el);
      if (back === null) continue;                                              // on a picture
      var backCss = cssOf(back);
      var col = svg ? el.getAttribute('data-owx-mono') : cs.color;
      var cm = String(col).match(/rgba?\([^)]*,\s*([\d.]+)\)$/);
      if (cm && +cm[1] < 1 && !svg) { var fa = rgbArr(col), bb = rgbArr(backCss), al = +cm[1]; col = cssOf([0, 1, 2].map(function (k) { return fa[k] * al + bb[k] * (1 - al); })); }
      var size = svg ? 0 : parseFloat(cs.fontSize), large = svg || size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
      var floor = large ? 3 : 4.5, was = parseFloat(el.getAttribute('data-owx-cr')) || 0;
      /* the live contrast less a hair (it was rounded at capture, and a
         browser's anti-aliasing moves the last decimal): 5.098 against a
         recorded 5.10 is the same word, not a word to repaint */
      var need = Math.max(floor + 0.1, Math.min(was - 0.2, 12));
      if (contrast(col, backCss) >= need) continue;
      var fixed = nudge(col, ink, backCss, need);
      if (svg) { el.style.setProperty('--owx-app-ink', fixed); el.setAttribute('data-owx-ink', ''); }
      else el.style.setProperty('color', fixed, 'important');
      out++;
    }
    return out;
  }
  /* PICTURES ON THE APP'S GROUND (founder/647: "transparent and changing
     app backgrounds"). Two rules, measured, never guessed:
       · a one-colour logo image (dark ink on transparency, measured at capture
         as data-owx-tone) that would vanish on this ground is flipped —
         invert and turn the hue back, so amazon's black word reads white and
         its orange smile stays orange;
       · on a dark ground, a picture a script once drew BEHIND words
         (data-owx-was="canvas" — Stripe's gradient) is dimmed so the words
         over it read, the way a designer would scrim it. */
  function tonePass(root, ground) {
    var gl = lum(ground), n = 0;
    if (gl < 0) return 0;
    var dark = gl < 0.2;
    var imgs = root.querySelectorAll('img[data-owx-tone]');
    for (var i = 0; i < imgs.length; i++) {
      var t = imgs[i].getAttribute('data-owx-tone');
      if ((dark && t === 'dark') || (!dark && gl > 0.6 && t === 'light')) {
        imgs[i].style.setProperty('filter', 'invert(1) hue-rotate(180deg)', 'important'); n++;
      }
    }
    if (dark) {
      var pics = root.querySelectorAll('img[data-owx-was="canvas"][data-owx-behind]');
      for (var j = 0; j < pics.length; j++) { pics[j].style.setProperty('filter', 'brightness(.55) saturate(1.1)', 'important'); n++; }
    }
    return n;
  }
  /* THE OWNER'S EDITS, applied over the copy (founder/646 "display and
     edit"). Each names its element by the capture's key and by what it said;
     after a re-copy a key can move, so a mismatch is found again by its old
     words, and an edit that fits nothing is counted, never forced. */
  function wordsOf(n) { return String((n && (n.tagName === 'IMG' ? n.getAttribute('src') : n.textContent)) || '').replace(/\s+/g, ' ').trim().slice(0, 200); }
  function applyEdits(root, edits) {
    var done = 0, missed = 0;
    /* every target is found on the copy AS TAKEN, before any edit changes it,
       so two edits to one element (its words, then hiding it) both land */
    var targets = (edits || []).map(function (e) {
      var n = root.querySelector('[data-owx-k="' + String(e.k).replace(/[^0-9]/g, '') + '"]');
      if (n && e.was && wordsOf(n) !== e.was) {
        n = null;
        var same = root.querySelectorAll(e.tag || '*');
        for (var i = 0; i < same.length && i < 5000; i++) { if (wordsOf(same[i]) === e.was) { n = same[i]; break; } }
      }
      if (n && !n.hasAttribute('data-owx-orig')) n.setAttribute('data-owx-orig', wordsOf(n));
      return n;
    });
    (edits || []).forEach(function (e, ix) {
      var n = targets[ix];
      if (!n) { missed++; return; }
      if (e.op === 'hide') n.style.setProperty('display', 'none', 'important');
      else if (e.op === 'text') {
        var t = doc.createElement('template'); t.innerHTML = String(e.value || '');
        clean(t.content); n.innerHTML = ''; n.appendChild(t.content);
      } else if (e.op === 'src' && /^(https:\/\/|\/(api\/oneway|assets)\/)/i.test(e.value || '')) {
        n.setAttribute('src', e.value); n.removeAttribute('srcset');
        var pic = n.closest && n.closest('picture'); if (pic) pic.querySelectorAll('source').forEach(function (x) { x.remove(); });
      } else if (e.op === 'href' && /^(https:\/\/|mailto:|tel:)/i.test(e.value || '')) n.setAttribute('href', e.value);
      n.setAttribute('data-owx-edited', e.op);
      done++;
    });
    return { applied: done, not_applied: missed };
  }
  /* ── WHAT MOVES WHEN A VISITOR REACHES IT ────────────────────────────────
     ★ FOUNDER/663: *"make sure the websites can support complex animations
       and scrolling animations that typical websites do"*.

     The copy is drawn with every element AS IT WAS SEEN (the capture walks the
     page the way a visitor scrolls it), so a page whose motion never runs
     still reads in full. An element the site brought into view as the visitor
     reached it carries how it looked BEFORE: its class then (data-owx-rvc) and
     its style then (data-owx-rvs). Below the screen it is put back to that
     before; when it scrolls into view it is given what it was seen as again.
     Where the site's own CSS has a transition or an animation for that change,
     the site's own motion plays it — its timing, its easing, its stagger;
     where the site moved it by script (nothing in its CSS answers the change),
     the same change is played with a short ease.

     Never armed for a reader who asked for reduced motion, while the owner
     edits (every word must be there to tap), or in a design test that measures
     the page standing still. */
  function entrances(root) {
    var out = [], els = root.querySelectorAll('[data-owx-rv]');
    if (!els.length) return out;
    var probe = doc.createElement('span');
    var decl = function (s) {
      probe.setAttribute('style', String(s || ''));
      var o = {};
      for (var i = 0; i < probe.style.length; i++) { var p = probe.style[i]; o[p] = [probe.style.getPropertyValue(p), probe.style.getPropertyPriority(p)]; }
      return o;
    };
    var words = function (s) { return String(s || '').split(/\s+/).filter(Boolean); };
    for (var i = 0; i < els.length; i++) {
      var el = els[i], rec = { el: el, add: [], rm: [], props: [] };
      if (el.hasAttribute('data-owx-rvc')) {
        var was = words(el.getAttribute('data-owx-rvc')), now = words(el.getAttribute('class'));
        rec.add = was.filter(function (c) { return now.indexOf(c) < 0; });
        rec.rm = now.filter(function (c) { return was.indexOf(c) < 0; });
      }
      if (el.hasAttribute('data-owx-rvs')) {
        var a = decl(el.getAttribute('data-owx-rvs')), s = decl(el.getAttribute('style')), keys = {};
        Object.keys(a).concat(Object.keys(s)).forEach(function (k) { keys[k] = 1; });
        Object.keys(keys).forEach(function (k) {
          var av = a[k] || ['', ''], sv = s[k] || ['', ''];
          if (av[0] !== sv[0] || av[1] !== sv[1]) rec.props.push([k, av, sv]);
        });
      }
      if (rec.add.length || rec.rm.length || rec.props.length) out.push(rec);
    }
    return out;
  }
  var STILL = ['opacity', 'transform', 'filter', 'clipPath', 'translate', 'scale', 'rotate', 'visibility'];
  function stillOf(el) {
    var cs = global.getComputedStyle(el), o = {};
    STILL.forEach(function (p) { o[p] = cs[p]; });
    return o;
  }
  /* true: as it was BEFORE the visitor reached it · false: as it was seen */
  function beforeOf(rec, on) {
    var el = rec.el;
    rec.add.forEach(function (c) { el.classList.toggle(c, on); });
    rec.rm.forEach(function (c) { el.classList.toggle(c, !on); });
    rec.props.forEach(function (p) { var v = on ? p[1] : p[2]; if (v[0] === '') el.style.removeProperty(p[0]); else el.style.setProperty(p[0], v[0], v[1]); });
  }
  function armEntrances(recs, host, root) {
    if (!recs.length || !global.IntersectionObserver) return null;
    try { if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return null; } catch (eM) {}
    var vh = global.innerHeight || 800, armed = new Map(), wait = [];
    recs.forEach(function (rec) {
      var r = rec.el.getBoundingClientRect();
      if (r.top < vh || (!r.width && !r.height)) return;           // already in view, or nothing to see
      wait.push(rec);
    });
    if (!wait.length) return null;
    /* put back to BEFORE without playing that backwards: no transition runs
       while it is set, inside it or on it, and the page is read once */
    var hush = doc.createElement('style');
    hush.textContent = '[data-owx-hush],[data-owx-hush] *{transition:none!important;animation-play-state:paused!important}';
    root.appendChild(hush);
    wait.forEach(function (rec) { rec.el.setAttribute('data-owx-hush', ''); beforeOf(rec, true); });
    wait.forEach(function (rec) {
      var r = rec.el.getBoundingClientRect();
      if (!r.width && !r.height) { beforeOf(rec, false); return; } // its before had no box: it could never arrive
      armed.set(rec.el, rec);
    });
    wait.forEach(function (rec) { rec.el.removeAttribute('data-owx-hush'); });
    hush.remove();
    if (!armed.size) return null;
    function play(rec, i) {
      var el = rec.el, from = stillOf(el), pre = null, subtree = [];
      try { pre = el.getAnimations({ subtree: true }); } catch (eA) {}
      var kids = el.querySelectorAll('*');
      for (var k = 0; k < kids.length && k < 60; k++) subtree.push([kids[k], stillOf(kids[k])]);
      beforeOf(rec, false);
      global.getComputedStyle(el).opacity;                          // the change is read now
      if (pre) {
        try {
          var mine = el.getAnimations({ subtree: true }).some(function (a) { return pre.indexOf(a) < 0; });
          if (mine) return;                                         // the site's own motion plays it
        } catch (eB) {}
      }
      if (!el.animate) return;
      var ease = { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' };
      var go = function (n, a, b, d) {
        var k0 = {}, k1 = {}, any = false;
        STILL.forEach(function (p) { if (a[p] !== b[p]) { k0[p] = a[p]; k1[p] = b[p]; any = true; } });
        if (any) { try { n.animate([k0, k1], { duration: ease.duration, easing: ease.easing, fill: ease.fill, delay: d }); } catch (eC) {} }
        return any;
      };
      if (go(el, from, stillOf(el), Math.min(i, 8) * 70)) return;
      /* a section given its class fades its children: those that changed move */
      var j = 0;
      subtree.forEach(function (pair) { if (go(pair[0], pair[1], stillOf(pair[0]), Math.min(i + j, 10) * 70)) j++; });
    }
    var io = new global.IntersectionObserver(function (entries) {
      if (!host.isConnected) { io.disconnect(); return; }
      var n = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var rec = armed.get(en.target);
        if (!rec) return;
        io.unobserve(en.target); armed.delete(en.target);
        play(rec, n++);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    armed.forEach(function (rec, el) { io.observe(el); });
    return {
      armed: armed.size,
      /* everything as it was seen, now, and nothing armed any more */
      still: function () { io.disconnect(); armed.forEach(function (rec) { beforeOf(rec, false); }); armed.clear(); }
    };
  }
  /* ── THINGS A PERSON CAN PRESS (founder/687) ─────────────────────────────
     A copy carries no script, so an FAQ's questions did not open and a row of
     tabs did not turn. The capture pressed each one on the live page and wrote
     down which attributes changed (`b.press`, cleaned by the server): a
     disclosure toggles between its two recorded states; a tab sets the whole
     group to the state that tab showed. Only these attributes are ever
     written, a style is applied property by property (so nothing the adapter
     set on the element is lost), and a class token by token. */
  var PRESS_OK = { 'class': 1, 'style': 1, 'hidden': 1, 'aria-expanded': 1, 'aria-hidden': 1, 'aria-selected': 1, 'open': 1, 'data-state': 1, 'inert': 1 };
  var BAD_STYLE = /expression\(|javascript:|-moz-binding|behavior\s*:/i;
  function pressTable(b) {
    var t = b && b.press, out = null;
    if (!t || typeof t !== 'object') return null;
    Object.keys(t).slice(0, 200).forEach(function (k) {
      var rec = t[k];
      if (!/^\d{1,7}$/.test(k) || !rec || (rec.kind !== 'toggle' && rec.kind !== 'set') || !rec.ch || !rec.ch.length) return;
      var rows = rec.ch.filter(function (c) {
        return c && c.length === 4 && /^\d{1,7}$/.test(String(c[0])) && PRESS_OK[c[1]] &&
               !(c[1] === 'style' && (BAD_STYLE.test(String(c[2] || '')) || BAD_STYLE.test(String(c[3] || ''))));
      });
      if (rows.length === rec.ch.length) { (out = out || {})[k] = { kind: rec.kind, ch: rows }; }
    });
    return out;
  }
  function styleProps(probe, v) {
    probe.setAttribute('style', String(v == null ? '' : v));
    var o = {};
    for (var i = 0; i < probe.style.length; i++) { var p = probe.style[i]; o[p] = [probe.style.getPropertyValue(p), probe.style.getPropertyPriority(p)]; }
    return o;
  }
  function toks(v) { return String(v == null ? '' : v).split(/\s+/).filter(Boolean); }
  /* everything any press in the table can write to one attribute of one
     element: what a tab must clear before it sets its own state */
  function pressVocabulary(table, probe) {
    var voc = {};
    Object.keys(table).forEach(function (k) {
      table[k].ch.forEach(function (c) {
        var key = c[0] + '|' + c[1], set = voc[key] || (voc[key] = {});
        [c[2], c[3]].forEach(function (v) {
          if (c[1] === 'class') toks(v).forEach(function (t) { set[t] = 1; });
          else if (c[1] === 'style') Object.keys(styleProps(probe, v)).forEach(function (pn) { set[pn] = 1; });
        });
      });
    });
    return voc;
  }
  function pressApply(root, rec, on, voc, probe) {
    rec.ch.forEach(function (c) {
      var el = root.querySelector('[data-owx-k="' + c[0] + '"]');
      if (!el) return;
      var to = on ? c[3] : c[2], known = voc[c[0] + '|' + c[1]] || {};
      if (c[1] === 'class') {
        var want = {}; toks(to).forEach(function (t) { want[t] = 1; });
        Object.keys(known).forEach(function (t) { if (!want[t]) el.classList.remove(t); });
        Object.keys(want).forEach(function (t) { el.classList.add(t); });
      } else if (c[1] === 'style') {
        var target = styleProps(probe, to);
        Object.keys(known).forEach(function (pn) { if (!target[pn]) el.style.removeProperty(pn); });
        Object.keys(target).forEach(function (pn) { el.style.setProperty(pn, target[pn][0], target[pn][1]); });
      } else if (to == null) el.removeAttribute(c[1]);
      else el.setAttribute(c[1], String(to));
    });
  }
  /* ── A PINNED BLOCK PLAYS FROM THE VISITOR'S OWN SCROLLING (founder/663) ──
     "scrolling animations that typical websites do." A site pins a block to
     the screen while a tall track passes and fades captions in and out by the
     scroll position, with script — and a copy carries no script, so at rest
     those captions were transparent for good (two on Apple's AirPods page
     could never be read). The capture walked each such track finely and wrote
     down what every moved element was at each step (`b.scenes`, cleaned by the
     server): its class, its style, its resolved transform, by how far the
     track had passed — 0 when its top reaches the bottom of the screen, 1 when
     its bottom leaves the top. Here the same progress is read from where the
     track IS on the visitor's screen and the recorded state is applied:
     opacity and transform move between two recorded states the way the site's
     script moved them between two frames; a class and every other property
     take the last state passed. Property by property and token by token, so
     nothing the adapter set is lost. A reader who asked for reduced motion
     gets the captions' turns without the sliding. Never while a page is drawn
     standing still (the editor, a design test). */
  var MATRIX = /^matrix(3d)?\(([-0-9eE., ]+)\)$/;
  function sceneTable(b) {
    var list = b && b.scenes, out = [];
    if (!list || !list.length) return out;
    for (var i = 0; i < list.length && out.length < 8; i++) {
      var sc = list[i];
      if (!sc || !/^\d{1,7}$/.test(String(sc.t)) || !sc.els || typeof sc.els !== 'object') continue;
      var keys = Object.keys(sc.els), vk = (sc.vids && typeof sc.vids === 'object') ? Object.keys(sc.vids) : [];
      var ok = keys.length + vk.length > 0 && keys.length <= 80 && vk.length <= 4;
      for (var q = 0; ok && q < vk.length; q++) {
        var vr = sc.vids[vk[q]], vt = vr && vr.tl;
        if (!/^\d{1,7}$/.test(vk[q]) || !vr || typeof vr.d !== 'number' || !(vr.d > 0) || !vt || vt.length < 2 || vt.length > 40) { ok = false; break; }
        for (var w = 0; w < vt.length; w++) if (!vt[w] || vt[w].length !== 2 || typeof vt[w][0] !== 'number' || typeof vt[w][1] !== 'number' || !isFinite(vt[w][0]) || !(vt[w][1] >= 0)) { ok = false; break; }
      }
      for (var j = 0; ok && j < keys.length; j++) {
        var rows = sc.els[keys[j]];
        if (!/^\d{1,7}$/.test(keys[j]) || !rows || rows.length < 2 || rows.length > 40) { ok = false; break; }
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          if (!row || row.length !== 4 || typeof row[0] !== 'number' || !isFinite(row[0]) ||
              (row[1] != null && typeof row[1] !== 'string') ||
              (row[2] != null && (typeof row[2] !== 'string' || BAD_STYLE.test(row[2]))) ||
              (row[3] != null && !MATRIX.test(String(row[3])))) { ok = false; break; }
        }
      }
      if (ok) out.push({ t: String(sc.t), els: sc.els, vids: vk.length ? sc.vids : null });   // a scene is played whole or not at all
    }
    return out;
  }
  function armScenes(list, host, root) {
    if (!list.length) return null;
    var probe = doc.createElement('span'), live = [], reduce = false;
    try { reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (eM) {}
    var mat = function (m) { return (m.length === 16 ? 'matrix3d(' : 'matrix(') + m.map(function (v) { return Math.round(v * 1000) / 1000; }).join(', ') + ')'; };
    list.forEach(function (sc) {
      var track = root.querySelector('[data-owx-k="' + sc.t + '"]');
      if (!track) return;
      var els = [];
      Object.keys(sc.els).forEach(function (k) {
        var el = root.querySelector('[data-owx-k="' + k + '"]');
        if (!el) return;
        var tokens = {}, props = {};
        var st = sc.els[k].slice().sort(function (x, y) { return x[0] - y[0]; }).map(function (r) {
          var cl = {}; toks(r[1]).forEach(function (t) { cl[t] = 1; tokens[t] = 1; });
          var pr = styleProps(probe, r[2]); Object.keys(pr).forEach(function (pn) { props[pn] = 1; });
          var o = pr.opacity ? parseFloat(pr.opacity[0]) : NaN, mm = r[3] ? MATRIX.exec(String(r[3])) : null;
          var m = mm ? mm[2].split(',').map(Number) : null;
          if (m && (m.some(isNaN) || (m.length !== 6 && m.length !== 16))) m = null;
          return { p: r[0], cl: cl, pr: pr, o: isNaN(o) ? null : o, m: m };
        });
        var e = { el: el, st: st, tokens: Object.keys(tokens), props: Object.keys(props).filter(function (pn) { return pn !== 'opacity' && pn !== 'transform'; }),
                  hasO: !!props.opacity, hasT: !!props.transform, at: -1, o: null, t: null };
        if (reduce && e.hasT) {
          /* reduced motion: it stands where it stood when it was most there */
          var best = st.reduce(function (a, x) { return (x.o == null ? 1 : x.o) > (a.o == null ? 1 : a.o) ? x : a; }, st[0]);
          if (best.m) el.style.setProperty('transform', mat(best.m)); else if (best.pr.transform) el.style.setProperty('transform', best.pr.transform[0], best.pr.transform[1]); else el.style.removeProperty('transform');
        }
        els.push(e);
      });
      /* A VIDEO THE SITE SCRUBS BY THE SCROLL (Apple turns an AirPod round that
         way): it never plays — the moment it shows is set from the track's
         progress, as the site's script set it. Only where the copy has the
         video's own file; without one its picture stands. Loaded in full only
         when its track is near the screen. */
      var vids = [];
      Object.keys(sc.vids || {}).forEach(function (k) {
        var v = root.querySelector('video[data-owx-k="' + k + '"]');
        if (!v || !/^https:\/\//i.test(v.getAttribute('src') || '')) return;
        v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.removeAttribute('autoplay'); v.removeAttribute('loop');
        try { v.pause(); } catch (eP) {}
        var rec = { v: v, tl: sc.vids[k].tl.slice().sort(function (x, y) { return x[0] - y[0]; }), want: null, near: false };
        v.addEventListener('seeked', function () { seek(rec); });
        v.addEventListener('loadedmetadata', function () { seek(rec); });
        vids.push(rec);
      });
      if (els.length || vids.length) live.push({ track: track, els: els, vids: vids });
    });
    if (!live.length) return null;
    /* one seek at a time: a video asked for a new moment while it is still
       finding the last one stutters; the newest wish waits for `seeked` */
    function seek(rec) {
      var v = rec.v;
      if (rec.want == null || v.seeking || v.readyState < 1) return;
      var d = isFinite(v.duration) && v.duration > 0 ? v.duration : 0, t = d ? Math.min(rec.want, Math.max(0, d - 0.04)) : rec.want;
      if (Math.abs(v.currentTime - t) < 0.03) return;
      try { v.currentTime = t; } catch (eS) {}
    }
    function scrubAt(rec, p) {
      var tl = rec.tl, i = 0;
      while (i < tl.length - 1 && tl[i + 1][0] <= p) i++;
      var a = tl[i], b = tl[i + 1], f = (b && p > a[0] && b[0] > a[0]) ? (p - a[0]) / (b[0] - a[0]) : 0;
      rec.want = b ? a[1] + (b[1] - a[1]) * f : a[1];
      if (!rec.near && p > -0.15 && p < 1.15) { rec.near = true; rec.v.preload = 'auto'; try { if (rec.v.readyState < 1) rec.v.load(); } catch (eL) {} }
      if (!reduce) seek(rec);
    }
    function applyAt(e, p) {
      var st = e.st, i = 0;
      while (i < st.length - 1 && st[i + 1].p <= p) i++;
      var a = st[i], b = st[i + 1], f = (b && p > a.p && b.p > a.p) ? (p - a.p) / (b.p - a.p) : 0;
      if (e.at !== i) {
        e.at = i;
        e.tokens.forEach(function (t) { e.el.classList.toggle(t, !!a.cl[t]); });
        e.props.forEach(function (pn) { if (a.pr[pn]) e.el.style.setProperty(pn, a.pr[pn][0], a.pr[pn][1]); else e.el.style.removeProperty(pn); });
      }
      if (e.hasO) {
        var o = (b && a.o != null && b.o != null) ? a.o + (b.o - a.o) * f : a.o;
        var os = o == null ? '' : String(Math.round(o * 1000) / 1000);
        if (os !== e.o) { e.o = os; if (os === '') e.el.style.removeProperty('opacity'); else e.el.style.setProperty('opacity', os, a.pr.opacity ? a.pr.opacity[1] : ''); }
      }
      if (e.hasT && !reduce) {
        var m = (b && a.m && b.m && a.m.length === b.m.length) ? a.m.map(function (v, j) { return v + (b.m[j] - v) * f; }) : a.m;
        var ts = m ? mat(m) : (a.pr.transform ? a.pr.transform[0] : '');
        if (ts !== e.t) { e.t = ts; if (ts === '') e.el.style.removeProperty('transform'); else e.el.style.setProperty('transform', ts, a.pr.transform ? a.pr.transform[1] : ''); }
      }
    }
    /* the screen the visitor scrolls: the App's own scrolling box when the
       profile sits in one, else the window */
    var box = null;
    function view() {
      if (box && !box.isConnected) box = null;
      if (!box) {
        for (var n = host.parentElement; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
          var oy = global.getComputedStyle(n).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) { box = n; break; }
        }
      }
      if (box) { var br = box.getBoundingClientRect(); return { top: br.top, h: box.clientHeight || br.height }; }
      return { top: 0, h: global.innerHeight || 800 };
    }
    var raf = 0, dead = false;
    function frame() {
      raf = 0;
      if (dead) return;
      if (!host.isConnected) { stop(); return; }
      var v = view();
      live.forEach(function (s) {
        var r = s.track.getBoundingClientRect();
        if (!r.height) return;
        var p = (v.top + v.h - r.top) / (r.height + v.h);
        s.els.forEach(function (e) { applyAt(e, p); });
        s.vids.forEach(function (rec) { scrubAt(rec, p); });
      });
    }
    function onScroll() { if (!raf && !dead) raf = global.requestAnimationFrame(frame); }
    function stop() { dead = true; doc.removeEventListener('scroll', onScroll, true); global.removeEventListener('resize', onScroll); }
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    global.addEventListener('resize', onScroll, { passive: true });
    frame();
    global.setTimeout(onScroll, 500); global.setTimeout(onScroll, 1500);
    return { scenes: live.length, elements: live.reduce(function (a, s) { return a + s.els.length; }, 0),
             videos: live.reduce(function (a, s) { return a + s.vids.length; }, 0), frame: frame, stop: stop };
  }
  /* ── WHAT MOVES BY ITSELF, MOVES (founder/663, 712) ────────────────────────
     A row of slides that advances every few seconds, a product demo that
     plays: on the site a timer does it, and a copy carries no timer, so the
     thing stood frozen at whatever moment the page was read. The capture
     listened to each such thing for one whole turn (`b.clocks`, cleaned by the
     server): for every element it writes, its class and style by the time
     within the turn. Here the turn is played: each change is made at its time,
     token by token and property by property, and the site's own CSS carries
     the motion between two states (its transition, its easing). It runs only
     while the thing is on the visitor's screen, starts from the state a
     visitor arriving sees, and is never armed for a reader who asked for
     reduced motion, while the owner edits, or in a test that measures the
     page standing still: then the first state stands. */
  function clockTable(b) {
    var list = b && b.clocks, out = [];
    if (!list || !list.length) return out;
    for (var i = 0; i < list.length && out.length < 6; i++) {
      var ck = list[i];
      if (!ck || !/^\d{1,7}$/.test(String(ck.r)) || typeof ck.p !== 'number' || !(ck.p >= 600 && ck.p <= 60000) || !ck.els || typeof ck.els !== 'object') continue;
      var keys = Object.keys(ck.els), ok = keys.length > 0 && keys.length <= 60;
      for (var j = 0; ok && j < keys.length; j++) {
        var rows = ck.els[keys[j]];
        if (!/^\d{1,7}$/.test(keys[j]) || !rows || rows.length < 2 || rows.length > 40) { ok = false; break; }
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          if (!row || (row.length !== 3 && row.length !== 4) || typeof row[0] !== 'number' || !(row[0] >= 0 && row[0] <= ck.p) ||
              (row.length === 4 && !(typeof row[3] === 'number' && row[3] >= 0 && row[3] <= 4000)) ||
              (row[1] != null && typeof row[1] !== 'string') ||
              (row[2] != null && (typeof row[2] !== 'string' || BAD_STYLE.test(row[2])))) { ok = false; break; }
        }
      }
      if (ok) out.push(ck);                                    // a turn is played whole or not at all
    }
    return out;
  }
  function armClocks(list, host, root) {
    if (!list.length || !global.IntersectionObserver) return null;
    try { if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return null; } catch (eM) {}
    var probe = doc.createElement('span'), live = [];
    list.forEach(function (ck) {
      var box = root.querySelector('[data-owx-k="' + ck.r + '"]');
      if (!box) return;
      var els = [], times = {};
      Object.keys(ck.els).forEach(function (k) {
        var el = root.querySelector('[data-owx-k="' + k + '"]');
        if (!el) return;
        var tokens = {}, props = {};
        var st = ck.els[k].slice().sort(function (x, y) { return x[0] - y[0]; }).map(function (r) {
          var cl = {}; toks(r[1]).forEach(function (t) { cl[t] = 1; tokens[t] = 1; });
          var pr = styleProps(probe, r[2]); Object.keys(pr).forEach(function (pn) { props[pn] = 1; });
          times[r[0]] = 1;
          return { t: r[0], cl: cl, pr: pr, d: r[3] || 0 };
        });
        els.push({ el: el, st: st, tokens: Object.keys(tokens), props: Object.keys(props), at: -1 });
      });
      if (!els.length) return;
      var ts = Object.keys(times).map(Number).sort(function (x, y) { return x - y; });
      if (ts[0] !== 0) ts.unshift(0);
      live.push({ box: box, els: els, times: ts, period: ck.p, i: 0, timer: 0, on: false });
    });
    if (!live.length) return null;
    function show(c) {
      var t = c.times[c.i];
      c.els.forEach(function (e) {
        var k = 0;
        while (k < e.st.length - 1 && e.st[k + 1].t <= t) k++;
        if (e.at === k) return;
        var first = e.at === -1, a = e.st[k];
        e.at = k;
        /* where the site moved it with a script (the record says how long the
           move took and nothing in its CSS answers the change), the same move
           is played over the same time; where its own transition answers, that plays */
        var from = (!first && a.d >= 80 && e.el.animate) ? stillOf(e.el) : null, pre = null;
        if (from) { try { pre = e.el.getAnimations(); } catch (eA) { pre = []; } }
        e.tokens.forEach(function (tk) { e.el.classList.toggle(tk, !!a.cl[tk]); });
        e.props.forEach(function (pn) { if (a.pr[pn]) e.el.style.setProperty(pn, a.pr[pn][0], a.pr[pn][1]); else e.el.style.removeProperty(pn); });
        if (!from) return;
        global.getComputedStyle(e.el).opacity;                        // the change is read now
        var own = false;
        try { own = e.el.getAnimations().some(function (an) { return pre.indexOf(an) < 0; }); } catch (eB) {}
        if (own) return;
        var to = stillOf(e.el), k0 = {}, k1 = {}, any = false;
        STILL.forEach(function (p) { if (from[p] !== to[p]) { k0[p] = from[p]; k1[p] = to[p]; any = true; } });
        if (any) { try { e.el.animate([k0, k1], { duration: a.d, easing: 'ease' }); } catch (eC) {} }
      });
    }
    function next(c) {
      c.timer = 0;
      if (!c.on) return;
      if (!host.isConnected) { stop(); return; }
      c.i = (c.i + 1) % c.times.length;
      show(c);
      wait(c);
    }
    function wait(c) {
      var now = c.times[c.i], then = c.i + 1 < c.times.length ? c.times[c.i + 1] : c.period;
      c.timer = global.setTimeout(function () { next(c); }, Math.max(80, then - now));
    }
    var io = new global.IntersectionObserver(function (entries) {
      if (!host.isConnected) { stop(); return; }
      entries.forEach(function (en) {
        for (var i = 0; i < live.length; i++) {
          var c = live[i];
          if (c.box !== en.target) continue;
          if (en.isIntersecting && !c.on) { c.on = true; show(c); wait(c); }
          else if (!en.isIntersecting && c.on) { c.on = false; if (c.timer) { global.clearTimeout(c.timer); c.timer = 0; } }
        }
      });
    }, { threshold: 0.15 });
    function stop() { io.disconnect(); live.forEach(function (c) { c.on = false; if (c.timer) { global.clearTimeout(c.timer); c.timer = 0; } }); }
    live.forEach(function (c) { io.observe(c.box); });
    return { clocks: live.length, elements: live.reduce(function (a, c) { return a + c.els.length; }, 0), stop: stop };
  }
  function project(el, b, opts) {
    opts = opts || {};
    ensureCss();
    var adapt = opts.adapt !== false;
    /* `ow-proj--still`: drawn standing still (design tests, the editor) — the
       copy's own scroll animations key off it (tools/project_page.cjs) */
    var host = mk('div', 'ow-proj' + (adapt ? ' ow-proj--adapt' : '') + (opts.motion === false ? ' ow-proj--still' : ''));
    if (b.font_faces && !doc.getElementById(siteKeyOf(b))) {
      /* a carried face is waited for, never given up on: a site's own
         `font-display: optional` drew 87% of Google's words in Arial (copies
         taken before the capture said so themselves) */
      var st = doc.createElement('style'); st.id = siteKeyOf(b); st.textContent = cssClean(b.font_faces).replace(/font-display:\s*optional/gi, 'font-display:block');
      doc.head.appendChild(st);
    }
    var root = host.attachShadow({ mode: 'open' });
    /* a dark site on a light App keeps its own ground (see PROJ_GROUND) */
    var siteGround = b.ground || 'rgb(255, 255, 255)';
    var own = adapt && opts.ground !== 'app' && lum(siteGround) >= 0 && lum(siteGround) < 0.2 && lum(appGround()) > 0.55;
    if (own) host.className += ' ow-proj--own';
    var ground = (adapt && !own) ? appGround() : siteGround;
    var appInk = global.getComputedStyle(el).color || global.getComputedStyle(doc.body).color;
    /* ONE LAYER OF OURS, DECLARED FIRST. A browser's own defaults (body's 8 px
       margin, html's 16 px) must lose to every rule the site wrote — including
       a site's own `@layer reset` (measured on Stripe: an unlayered 8 px margin
       beat its layered reset and shifted the page). Normal declarations in the
       first layer lose to everything; !important ones in the first layer win
       over everything — which is exactly what the adapter's overrides need.
       The host CLIPS rather than hides (founder/663): `overflow: hidden` made
       it a scroll box of its own, so every `position: sticky` in the page
       stuck to a box that never scrolls and every scroll-driven animation
       read a scroll that never moved. A clip draws the same edge and leaves
       the App's own page as the scroller. */
    var base = '@layer owx;' +
      ':host{all:initial;display:block;position:relative;overflow:hidden;overflow:clip;container-type:inline-size;container-name:owx;' +
      '--owx-rem:' + (Number(b.root_px) || 16) + 'px;--owx-app-ink:' + appInk + '}' +
      '@layer owx{.owx-html{display:block;font-size:16px;line-height:normal;color:CanvasText;background:' + ((adapt && !own) ? 'transparent' : esc(siteGround)) + '}' +
      '.owx-body{display:block;margin:8px}}';
    var tpl = doc.createElement('template');
    /* THE TWO WRAPPERS ARE ELEMENTS NO SITE HAS A RULE FOR. They were divs, and
       a site's reset aimed at every div (`div{font-family:inherit}`, Linear's)
       hit the one standing in for its <html> — the page lost its face. */
    tpl.innerHTML = '<owx-html class="owx-html"><owx-body class="owx-body"></owx-body></owx-html>';
    var htmlEl = tpl.content.firstChild, bodyEl = htmlEl.firstChild;
    if (b.html_class) htmlEl.className += ' ' + String(b.html_class).slice(0, 400);
    if (b.body_class) bodyEl.className += ' ' + String(b.body_class).slice(0, 400);
    /* the page's own <html>/<body> attributes (a theme is often one:
       data-theme="dark"), worn by the wrappers its rules now point at */
    [[htmlEl, b.html_attrs], [bodyEl, b.body_attrs]].forEach(function (pair) {
      var a = pair[1] || {};
      Object.keys(a).slice(0, 40).forEach(function (k) {
        if (!/^(data-[\w-]+|dir|lang|style|id|role|aria-[\w-]+|theme|color-scheme)$/i.test(k)) return;
        var v = String(a[k] == null ? '' : a[k]).slice(0, 2000);
        if (k === 'style' && /expression\(|javascript:|-moz-binding|behavior\s*:/i.test(v)) return;
        pair[0].setAttribute(k, v);
      });
    });
    var frag = doc.createElement('template');
    frag.innerHTML = String(b.html || '');
    clean(frag.content);
    bodyEl.appendChild(frag.content);
    var s1 = doc.createElement('style'); s1.textContent = base;
    var s2 = doc.createElement('style'); s2.textContent = cssClean(b.css);
    var s3 = doc.createElement('style'); s3.textContent = '@layer owx{' + (adapt ? PROJ_ADAPT + (own ? '' : '\n' + PROJ_GROUND) : PROJ_EXACT) + '}';
    root.appendChild(s1); root.appendChild(s2); root.appendChild(s3); root.appendChild(htmlEl);
    /* read before anything of ours writes a style: the entrances' "as seen" is the copy as served */
    var moves = opts.motion === false ? [] : entrances(root);
    /* a press the site answered with script is answered here from the record;
       it comes before the link handler, and never while a page is drawn
       standing still (the editor selects what is tapped; a test measures) */
    var presses = opts.motion === false ? null : pressTable(b);
    if (presses) {
      var pprobe = doc.createElement('span'), pvoc = pressVocabulary(presses, pprobe);
      host.__owxPress = Object.keys(presses).length;
      root.addEventListener('click', function (e) {
        for (var n = e.target; n && n !== root; n = n.parentNode) {
          if (n.nodeType !== 1) continue;
          var k = n.getAttribute('data-owx-k'), rec = k && presses[k];
          if (!rec) continue;
          e.preventDefault(); e.stopImmediatePropagation();
          var on = rec.kind === 'set' ? true : !n.__owxOn;
          n.__owxOn = on;
          pressApply(root, rec, on, pvoc, pprobe);
          /* what a press reveals is read on the App's ground like the rest */
          if (adapt && !own) { try { inkPass(root, ground, appInk); } catch (eI) {} }
          return;
        }
      });
    }
    /* links and forms never move the App */
    var site = '';
    try { site = new URL(b.final_url || b.requested).hostname.replace(/^www\./, ''); } catch (eU) {}
    root.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#') return;
      e.preventDefault();
      var same = false;
      try { same = new URL(href).hostname.replace(/^www\./, '') === site; } catch (eH) {}
      if (same && typeof opts.onPage === 'function') { opts.onPage(href); return; }
      if (/^(https?:|mailto:|tel:|sms:)/i.test(href)) global.open(href, '_blank', 'noopener,noreferrer');
    });
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, act = f.getAttribute('action') || '';
      if (!/^https:\/\//i.test(act) || String(f.method || 'get').toLowerCase() !== 'get') return;
      try { var u = new URL(act); new global.FormData(f).forEach(function (v, k) { u.searchParams.append(k, v); }); global.open(u.href, '_blank', 'noopener,noreferrer'); } catch (eF) {}
    });
    el.innerHTML = '';
    el.appendChild(host);
    /* A PAGE THAT IS THE SCREEN stays the screen. Google's landing page is
       `html, body { height: 100% }` with its footer pushed to the bottom; in a
       profile, 100% of nothing is nothing and the footer floated up 49 px. When
       the page asked for it and is shorter than a screen, its root is given
       exactly one screen — a definite height its own percentages can use. */
    if (b.root_full && bodyEl.scrollHeight <= (global.innerHeight || 0)) {
      var vh = (global.innerHeight || 0) + 'px';
      htmlEl.style.setProperty('height', vh); bodyEl.style.setProperty('height', vh);
    }
    /* ── VIDEO PLAYS (founder/687) ────────────────────────────────────────
       A video the site fed from a stream carries the stream's own address
       (data-owx-stream, an HLS playlist): where the browser plays one by
       itself — Safari always, Chrome since 2025 — the copy's video plays the
       company's own stream, at its own quality, with the captured frame as
       its poster until it starts. Elsewhere the poster stands. Every video
       that was playing for the visitor plays only while it is on screen, and
       muted (a browser refuses anything else without a press). */
    var vids = root.querySelectorAll('video');
    if (vids.length) {
      var canHls = '';
      try { canHls = doc.createElement('video').canPlayType('application/vnd.apple.mpegurl'); } catch (eV) {}
      var playing = [];
      for (var vi = 0; vi < vids.length && vi < 12; vi++) {
        var v = vids[vi], stream = v.getAttribute('data-owx-stream') || '';
        /* no `crossorigin`: the stream is only shown, never read, and with it a
           stream's own server would have to name the App as an allowed origin */
        if (stream && /^https:\/\//i.test(stream) && canHls && !v.getAttribute('src')) { v.removeAttribute('crossorigin'); v.setAttribute('src', stream); }
        if (!v.hasAttribute('autoplay') || !(v.getAttribute('src') || v.querySelector('source'))) continue;
        v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', '');
        v.removeAttribute('autoplay');                 // played by sight, below
        if (opts.motion === false) continue;           // a page drawn standing still
        playing.push(v);
      }
      if (playing.length && global.IntersectionObserver) {
        var vio = new global.IntersectionObserver(function (entries) {
          if (!host.isConnected) { vio.disconnect(); return; }
          entries.forEach(function (en) {
            var t = en.target;
            if (en.isIntersecting) { var pr = t.play && t.play(); if (pr && pr.catch) pr.catch(function () {}); }
            else if (t.pause) t.pause();
          });
        }, { threshold: 0.1 });
        playing.forEach(function (x) { vio.observe(x); });
      }
    }
    /* a row the site had scrolled sideways shows the same cards it showed */
    var scrolled = root.querySelectorAll('[data-owx-sx],[data-owx-sy]');
    for (var si = 0; si < scrolled.length; si++) {
      scrolled[si].scrollLeft = +scrolled[si].getAttribute('data-owx-sx') || 0;
      scrolled[si].scrollTop = +scrolled[si].getAttribute('data-owx-sy') || 0;
    }
    /* EXACT: a bar pinned to the visitor's screen sits where the visitor saw
       it at arrival (Google's footer, Nike's app banner), not at the page's end */
    {
      var pins = [];
      var pinned = root.querySelectorAll(adapt ? '[data-owx-fixbox][data-owx-overlay="0"]:not([data-owx-role="header"]),[data-owx-fixbox][data-owx-fixed="page"]' : '[data-owx-fixbox]');
      for (var pi = 0; pi < pinned.length; pi++) {
        var fb = String(pinned[pi].getAttribute('data-owx-fixbox')).split(',').map(Number);
        if (fb.length !== 4 || fb.some(isNaN)) continue;
        var st = pinned[pi].style;
        pins.push([pinned[pi], fb[1]]);
        st.setProperty('position', 'absolute', 'important');
        st.setProperty('left', fb[0] + 'px', 'important'); st.setProperty('top', fb[1] + 'px', 'important');
        /* a box that spanned the visitor's whole screen spans the copy's whole
           width — a desktop copy beside the App's rail is 1184 px, not the 1280
           it was taken at (Russ & Daughters' panel ran off the right edge), and
           a phone's copy may be drawn at 375 */
        var full = fb[0] <= 1 && Math.abs(fb[2] - (Number(b.width) || fb[2])) <= 2;
        st.setProperty('width', full ? '100%' : fb[2] + 'px', 'important');
        st.setProperty('right', 'auto', 'important'); st.setProperty('bottom', 'auto', 'important');
        st.setProperty('transform', 'none', 'important');
      }
      /* something placed out of the flow does not make the profile taller:
         the profile grows to hold the lowest of them */
      var low = 0, top0 = bodyEl.getBoundingClientRect().top;
      for (var pj = 0; pj < pinned.length; pj++) {
        /* only a pinned box that IS the page grows it (Russ & Daughters); a
           bar pinned to the screen never stretched the page it floated over —
           counting Google's bottom bar pushed its footer down 48 px */
        if (pinned[pj].getAttribute('data-owx-fixed') !== 'page') continue;
        var pr = pinned[pj].getBoundingClientRect();
        if (pr.height > 0) low = Math.max(low, pr.bottom - top0);
      }
      if (low > bodyEl.getBoundingClientRect().height) bodyEl.style.setProperty('min-height', Math.ceil(low) + 'px');
    }
    host.__owx = { inked: 0, ground: ground, motion: null };
    host.__owx.edits = applyEdits(root, opts.edits || []);
    host.__owx.own = own;
    if (adapt && !own) host.__owx.inked = inkPass(root, ground, appInk);
    if (adapt && !own) host.__owx.toned = tonePass(root, ground);
    /* ONE GAP UNDER THE CENTER'S TABS, whatever the site reserved. A site
       pads its first section to clear its own header; with that header gone
       the padding is an empty band (Linear's was ~200 px). The first thing
       that paints — words, a picture, a band of colour — starts 16 px under
       the tabs on every site. */
    if (adapt) {
      host.__owx.trimmed = 0;
      var trim = function () {
        if (!host.isConnected) return;
        var hr0 = host.getBoundingClientRect(), first = Infinity, all = bodyEl.querySelectorAll('*');
        for (var fi = 0; fi < all.length && fi < 4000; fi++) {
          var fn = all[fi], fr = fn.getBoundingClientRect();
          if (fr.width < 2 || fr.height < 2 || fr.top - hr0.top >= first) continue;
          /* only what a person can SEE: Linear's "skip to content" link is a
             full-width line at the very top with opacity 0, and the gap was
             measured to it — the headline began 170 px lower than it should */
          try { if (fn.checkVisibility && !fn.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue; } catch (eC) {}
          var paints = /^(IMG|SVG|VIDEO|PICTURE|CANVAS|INPUT|BUTTON|IFRAME|SELECT|TEXTAREA)$/i.test(fn.tagName) || fn.getAttribute('data-owx-bg') === 'band';
          if (!paints) { var fcs = global.getComputedStyle(fn); paints = !!(fcs.backgroundImage && fcs.backgroundImage !== 'none'); }
          if (!paints) for (var fc = fn.firstChild; fc; fc = fc.nextSibling) { if (fc.nodeType === 3 && fc.nodeValue.trim()) { paints = true; break; } }
          if (paints && global.getComputedStyle(fn).visibility !== 'hidden') first = fr.top - hr0.top;
        }
        if (first === Infinity) return;
        /* from where things ARE: the page settles after it is drawn (faces,
           pictures, a script-free layout finding its heights), so the gap is
           measured again and the pull adjusted, never set once and trusted */
        /* 16 px under the tabs on the App's ground; a page that keeps its own
           dark ground is a panel with an edge, and its first line gets air */
        var want = Math.max(0, host.__owx.trimmed + (first - (own ? 56 : 16)));
        if (Math.abs(want - host.__owx.trimmed) < 2) return;
        host.__owx.trimmed = Math.round(want);
        bodyEl.style.setProperty('margin-top', (-host.__owx.trimmed) + 'px', 'important');
        /* what was pinned to the visitor's screen UNDER the site's header (a
           breadcrumb bar, The Hoxton's) rises with the page: left where it was
           captured, it lay across the first lines of the page */
        for (var pk = 0; pk < pins.length; pk++) pins[pk][0].style.setProperty('top', Math.max(0, pins[pk][1] - host.__owx.trimmed) + 'px', 'important');
      };
      trim();
      global.requestAnimationFrame(function () { global.requestAnimationFrame(trim); });
      global.setTimeout(trim, 400); global.setTimeout(trim, 1200); global.setTimeout(trim, 2500);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(trim);
      var tq = null;
      root.addEventListener('load', function () { if (tq) global.clearTimeout(tq); tq = global.setTimeout(trim, 60); }, true);
    }
    /* last: everything of ours has been measured and painted on the page as seen */
    if (moves.length) host.__owx.motion = armEntrances(moves, host, root);
    if (opts.motion !== false) host.__owx.scenes = armScenes(sceneTable(b), host, root);
    if (opts.motion !== false) host.__owx.clocks = armClocks(clockTable(b), host, root);
    return host;
  }

  /* ── THE SITE'S PAGES AS THE CENTER'S CATEGORIES ─────────────────────────
     Written pages first (native, seamless), then the company's own site: one
     "Website" tab with its own page row when a written site exists, else its
     pages themselves as tabs — 433's categories either way. */
  /* ── THE SITE'S PAGES AMONG THE CENTER'S MAIN CATEGORIES ─────────────────
     ★ FOUNDER/681: *"the centers choose how the site displays on their center
       but it should be part of the main catagories and sometimes the website
       home would just be home and the why book with us would be in the same
       catagories in people or feed"*.
     One tab per page the Center's read names as a category (`website.
     categories.paths`: the Center's own choice, or the site's top sections
     until it chooses — never the site's whole menu, founder/561), each drawn
     as that page alone. Null when the Center keeps its site as one "Website"
     tab, or the read does not say: the caller draws that tab as before. */
  function categoryTabs(web) {
    var c = web && web.categories;
    if (!web || !web.url || !(web.mode === 'frame' || web.mode === 'mirror') || !c || c.display !== 'categories') return null;
    var can = (web.pages || []).filter(function (p) { return p && p.opens && p.mode !== 'link'; });
    var at = {}; can.forEach(function (p, i) { at[p.path] = i; });
    var paths = (c.paths || []).filter(function (path) { return at[path] != null; });
    if (!paths.length) return null;
    var ids = {}; paths.forEach(function (path) { ids[path] = 'web:' + path; });
    return paths.map(function (path) {
      var p = can[at[path]];
      return { id: ids[path], label: path === c.home ? 'Home' : (p.label || path), has: true,
               render: function (pane) {
                 mirror(pane, { url: web.url, mode: web.mode, sandbox: web.sandbox, title: web.title, why: web.why,
                                pages: can, single: true, categories: ids }, at[path]);
               } };
    });
  }
  /* THE STRIP IN THE CENTER'S OWN ORDER (founder/681: "the why book with us
     would be in the same catagories in people or feed"). `order` names every
     category the Center placed, the site's ("web:" + path) and its own by
     their tab ids; a tab it never placed (Events, the day one first exists)
     keeps its natural place after them. No order: the tabs as composed. */
  function arrange(tabs, web) {
    var o = web && web.categories && web.categories.order;
    if (!o || !o.length || !tabs || !tabs.length) return tabs;
    var at = {}; o.forEach(function (id, i) { if (at[id] == null) at[id] = i; });
    /* a Center that keeps its site as ONE Website tab has it where the first
       of its site's pages was placed */
    if (at.website == null) { for (var w = 0; w < o.length; w++) { if (String(o[w]).indexOf('web:') === 0) { at.website = w; break; } } }
    /* the composer's list may hold an empty place for a tab that does not
       exist today (it filters them afterwards): those keep their place */
    return tabs.map(function (t, i) { return [t, t && at[t.id] != null ? at[t.id] : 100000 + i]; })
      .sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  function tabsFor(app, cid) {
    var out = [];
    var site = app && app.site, web = app && app.website;
    if (site && (site.pages || []).length) {
      site.pages.forEach(function (pg) {
        out.push({ id: 'site:' + pg.id, label: pg.label || pg.id, has: (pg.sections || []).length > 0,
                   render: function (pane) { page(pane, site, pg, cid); } });
      });
    } else if (app && (app.pages || []).length) {
      /* no site published yet: the Center's own pages are still its
         categories (founder/440), drawn in the App's own material */
      var bare = { name: (app.identity && app.identity.name) || '', presentation: {} };
      app.pages.forEach(function (pg) {
        out.push({ id: 'page:' + pg.id, label: pg.label || pg.id, has: (pg.sections || []).length > 0,
                   render: function (pane) { page(pane, bare, pg, cid); } });
      });
    }
    var cats = categoryTabs(web);
    if (cats) out = out.concat(cats);
    else if (web && web.url && (web.mode === 'frame' || web.mode === 'mirror')) {
      /* ONE "Website" TAB when the Center keeps it so — the site's pages ride
         in the mirror's own page row (founder/561) */
      out.push({ id: 'website', label: 'Website', has: true,
                 render: function (pane) { mirror(pane, web, 0); } });
    }
    return out;
  }

  OW.site = { tabsFor: tabsFor, categoryTabs: categoryTabs, arrange: arrange, page: page, mirror: mirror, project: project, fonts: fonts, tokens: tokens, stack: stack };
})(window);
