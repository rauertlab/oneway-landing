/* ONEWAY — Brain Map (canonical living-map visual, reusable, no build step)
 * The Agent-Theater geometric core + tiered node graph, extracted so landing
 * pages, the OS, and showcases all share ONE Brain visual. Theme-synced.
 *
 * Hierarchy: Brain (core) → Center → Systems → Modules (never equal nodes).
 *
 *   var ctl = OW_BRAINMAP.mount(canvasEl, {
 *     hue: 210,                       // optional; else --ow-user-hue / --ow-brand-hue / 210
 *     tree: { label:'Seaside Hotel',  // the Center / hub label
 *             systems:[ { label:'Hotel Operations', kind:'system',
 *                         modules:[{label:'Housekeeping'}, ...] }, ... ] } });
 *   ctl.resize(); ctl.spawn('New System'); ctl.stop();
 *
 * Presets: OW_BRAINMAP.presetOneway() · OW_BRAINMAP.presetOS(orgName)
 */
(function(){
  'use strict';

  function readHue(explicit){
    if (explicit != null && !isNaN(explicit)) return parseInt(explicit, 10);
    var h = NaN;
    try { h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ow-user-hue'), 10); } catch(_){}
    if (isNaN(h)){ try { h = parseInt(getComputedStyle(document.body).getPropertyValue('--ow-brand-hue'), 10); } catch(_){} }
    return isNaN(h) ? 210 : h;
  }

  function mount(canvas, config){
    config = config || {};
    if (!canvas || !canvas.getContext) return null;
    if (canvas._owBrainCtl){ try { canvas._owBrainCtl.stop(); } catch(_){} }

    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [], links = [], agents = [], pendingSignals = [];
    var W = 0, H = 0, frame = 0, raf = 0, stopped = false;
    var pal = { h: readHue(config.hue) };

    function hsla(h, s, l, a){ return 'hsla(' + ((h%360+360)%360) + ',' + s + '%,' + l + '%,' + a + ')'; }

    function neighborsOf(n){
      var out = [];
      links.forEach(function(l){ if (l.a === n) out.push(l.b); else if (l.b === n) out.push(l.a); });
      return out;
    }
    function addNode(label, opts){
      opts = opts || {};
      var tier = opts.hub ? 0 : (opts.tier != null ? opts.tier : 1);
      var defaultR = opts.hub ? 19 : (tier >= 2 ? 7.5 : 11);
      var n = { label: label, hub: !!opts.hub, kind: opts.kind || 'system', tier: tier,
                parent: opts.parent || null, _kids: [], _ang: 0,
                x: null, y: null, dx: 0, dy: 0, bx: 0, by: 0, placed: false,
                r: (opts.r != null && !isNaN(opts.r)) ? opts.r : defaultR,
                highlight: !!opts.highlight, meta: opts.meta || null,
                born: Math.random()*6.28, pulse: 1 };
      nodes.push(n);
      if (!n.hub){
        var p = n.parent || nodes.filter(function(x){ return x.hub; })[0];
        if (p){ links.push({ a: p, b: n }); if (n.parent) n.parent._kids.push(n); }
      }
      layout();
      return n;
    }
    function spawnAgent(a, b, meta){
      if (!a || !b) return;
      agents.push({ a: a, b: b, t: 0, speed: (meta && meta.speed) || (0.009 + Math.random()*0.008),
                    trail: [], meta: meta || null });
    }
    function layout(){
      var cx = W/2, cy = H/2;
      var hub = nodes[0]; if (hub){ hub.bx = cx; hub.by = cy; }
      var t1 = nodes.filter(function(n){ return n.tier === 1; });
      var Rx = Math.max(168, W*0.33), Ry = Math.max(84, H*0.29);
      t1.forEach(function(n, i){
        var a = (i/Math.max(1,t1.length))*Math.PI*2 - Math.PI/2 + 0.45;
        n._ang = a; n.bx = cx + Math.cos(a)*Rx; n.by = cy + Math.sin(a)*Ry;
      });
      var Rx2 = Rx*1.74, Ry2 = Ry*1.74;
      t1.forEach(function(p){
        var kids = p._kids || [], m = kids.length;
        kids.forEach(function(k, j){
          var a = p._ang + (j - (m-1)/2) * 0.30;
          k.bx = cx + Math.cos(a)*Rx2; k.by = cy + Math.sin(a)*Ry2;
        });
      });
      if (W > 10) nodes.forEach(function(n){ if (!n.placed){ n.x = n.bx; n.y = n.by; n.placed = true; } });
    }
    function resize(){
      pal = { h: readHue(config.hue) };
      var r = canvas.getBoundingClientRect();
      W = Math.max(280, r.width || 600);
      H = Math.max(220, r.height || 340);
      canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      layout();
    }

    function gPoly(cx, cy, r, sides, rot, col, lw){
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (var i=0;i<=sides;i++){ var a=i*Math.PI*2/sides; if(i===0)ctx.moveTo(r*Math.cos(a),r*Math.sin(a)); else ctx.lineTo(r*Math.cos(a),r*Math.sin(a)); }
      ctx.stroke(); ctx.restore();
    }
    function drawCore(cx, cy, R, f){
      var t0 = f*0.021, H2 = pal.h, i;
      var r0=R, r1=R*0.70, r2=R*0.46, r3=R*0.26;
      var gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, R*2.4);
      gl.addColorStop(0, hsla(H2, 90, 56, (0.16+Math.sin(f*0.05)*0.03).toFixed(3))); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R*2.4, 0, Math.PI*2); ctx.fill();
      gPoly(cx, cy, r0, 8,  t0*0.32, hsla(H2,    78, 60, 0.16), 1);
      gPoly(cx, cy, r1, 6, -t0*0.55, hsla(H2+24, 78, 62, 0.22), 1.2);
      gPoly(cx, cy, r2, 3,  t0*1.05, hsla(H2-24, 80, 66, 0.30), 1.3);
      gPoly(cx, cy, r2, 3, -t0*1.05+Math.PI, hsla(H2+40, 82, 66, 0.30), 1.3);
      gPoly(cx, cy, r3, 4,  t0*1.7+Math.PI/4, hsla(H2+50, 85, 70, 0.26), 1.1);
      ctx.strokeStyle = hsla(H2, 80, 60, (0.20+Math.sin(f*0.05)*0.06).toFixed(3)); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI*2); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy);
      for (i=0;i<6;i++){ var a=-t0*0.55+i*Math.PI/3, vx=r1*Math.cos(a), vy=r1*Math.sin(a); ctx.fillStyle=hsla(H2+24,85,66,(0.45+Math.sin(f*0.1+i)*0.12).toFixed(3)); ctx.beginPath(); ctx.arc(vx, vy, 1.7, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t0*2.2);
      var sp=0.45+Math.sin(f*0.1)*0.35, r4=R*0.2;
      for (i=0;i<6;i++){ var ba=i*Math.PI/3, grad=ctx.createLinearGradient(0,0,r4*Math.cos(ba),r4*Math.sin(ba)); grad.addColorStop(0,hsla(H2+30,95,76,sp.toFixed(3))); grad.addColorStop(1,'transparent'); ctx.strokeStyle=grad; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r4*Math.cos(ba), r4*Math.sin(ba)); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = hsla(H2+30, 95, 82, (0.8+Math.sin(f*0.09)*0.2).toFixed(3)); ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, Math.PI*2); ctx.fill();
    }
    function drawMiniCore(cx, cy, R, f, kind, highlight){
      var t0 = f*0.045;
      var H2 = pal.h + (kind === 'automation' ? 42 : kind === 'ecosystem' ? -30 : kind === 'geo' ? 160 : kind === 'event' ? 88 : 0);
      var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R*2.3);
      gl.addColorStop(0, hsla(H2, 88, 60, 0.42)); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R*2.3, 0, Math.PI*2); ctx.fill();
      // Highlight glow ring for most-connected/ecosystem nodes
      if (highlight || kind === 'ecosystem'){
        var glowA = (0.18 + Math.sin(f*0.05)*0.10).toFixed(3);
        ctx.strokeStyle = hsla(H2, 95, 72, glowA);
        ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(cx, cy, R*2.1, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = hsla(H2, 95, 80, (parseFloat(glowA)*0.5).toFixed(3));
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.arc(cx, cy, R*2.5, 0, Math.PI*2); ctx.stroke();
      }
      gPoly(cx, cy, R,     6,  t0,     hsla(H2,    80, 66, 0.55), 1.1);
      gPoly(cx, cy, R*0.6, 3, -t0*1.3, hsla(H2+30, 86, 72, 0.5),  1);
      ctx.strokeStyle = hsla(H2, 80, 62, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = hsla(H2+20, 92, 80, 0.92); ctx.beginPath(); ctx.arc(cx, cy, 2.1, 0, Math.PI*2); ctx.fill();
    }

    function tick(){
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (canvas.offsetParent === null) return;
      if (Math.abs((canvas.clientWidth || 0) - W) > 2 || Math.abs((canvas.clientHeight || 0) - H) > 2){ resize(); }
      frame++;
      ctx.clearRect(0, 0, W, H);
      nodes.forEach(function(n){
        n.x += (n.bx - n.x)*0.08; n.y += (n.by - n.y)*0.08;
        var fx = n.hub ? 0 : Math.sin(frame*0.026 + n.born)*2.4;
        var fy = n.hub ? 0 : Math.cos(frame*0.03 + n.born)*2.4;
        n.dx = n.x + fx; n.dy = n.y + fy;
      });
      links.forEach(function(l){
        var g = ctx.createLinearGradient(l.a.dx, l.a.dy, l.b.dx, l.b.dy);
        g.addColorStop(0, hsla(pal.h, 85, 58, 0.04)); g.addColorStop(0.5, hsla(pal.h, 85, 58, 0.20)); g.addColorStop(1, hsla(pal.h, 85, 58, 0.04));
        ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(l.a.dx, l.a.dy); ctx.lineTo(l.b.dx, l.b.dy); ctx.stroke();
      });
      if (pendingSignals.length && agents.length < 10){
        var sig = pendingSignals.shift();
        if (sig && sig.a && sig.b) spawnAgent(sig.a, sig.b, sig.meta || {});
      }
      if (!config.truthful && frame % 130 === 0 && agents.length < 6 && nodes.length > 1){
        var src = nodes[Math.floor(Math.random()*nodes.length)]; var nb = neighborsOf(src);
        if (nb.length) spawnAgent(src, nb[Math.floor(Math.random()*nb.length)]);
      }
      agents.forEach(function(ag){
        ag.t += ag.speed;
        if (ag.t >= 1){ ag.b.pulse = 2.3; var nb = neighborsOf(ag.b); var nx = nb.length ? nb[Math.floor(Math.random()*nb.length)] : ag.a; ag.a = ag.b; ag.b = nx; ag.t = 0; ag.trail = []; return; }
        var x = ag.a.dx + (ag.b.dx - ag.a.dx)*ag.t, y = ag.a.dy + (ag.b.dy - ag.a.dy)*ag.t;
        ag.trail.push({ x: x, y: y }); if (ag.trail.length > 12) ag.trail.shift();
        var sigHue = pal.h + ((ag.meta && ag.meta.kind === 'conflict') ? -42 : (ag.meta && ag.meta.kind === 'publication') ? 58 : 34);
        ag.trail.forEach(function(p, i){ ctx.fillStyle = hsla(sigHue, 92, 72, ((i/ag.trail.length)*0.45).toFixed(3)); ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 + i*0.14, 0, Math.PI*2); ctx.fill(); });
        var gr = ctx.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, hsla(sigHue, 95, 74, 1)); gr.addColorStop(1, hsla(sigHue, 95, 74, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI*2); ctx.fill();
      });
      nodes.forEach(function(n){
        var pr = n.r * (n.pulse > 1 ? n.pulse : 1); n.pulse += (1 - n.pulse)*0.07;
        if (n.hub){
          drawCore(n.dx, n.dy, Math.min(W, H)*0.135, frame);
          ctx.font = "600 12px 'ONEWAY Sans', system-ui, sans-serif"; ctx.fillStyle = 'rgba(226,242,255,0.92)'; ctx.textAlign = 'center';
          ctx.fillText(n.label, n.dx, n.dy + Math.min(W, H)*0.135 + 18); return;
        }
        drawMiniCore(n.dx, n.dy, pr, frame, n.kind, n.highlight);
        if (n.label){
          ctx.font = (n.tier >= 2 ? '500 9.5px' : '500 10.5px') + ' \'ONEWAY Sans\', system-ui, sans-serif';
          ctx.fillStyle = 'rgba(214,238,255,0.82)'; ctx.textAlign = 'center';
          var lab = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label;
          ctx.fillText(lab, n.dx, n.dy + pr + 15);
        }
      });
    }

    // Build the tree from config
    var tree = config.tree || { label: 'Brain', systems: [] };
    var byId = {};
    var hub = addNode(tree.label || 'Brain', { hub: true });
    byId[(tree.meta && tree.meta.id) || 'hub'] = hub;
    (tree.systems || []).slice(0, 8).forEach(function(s){
      var sysNode = addNode(s.label || 'System', {
        tier: 1, kind: s.kind || 'system',
        r: s.r != null ? s.r : undefined,
        highlight: !!s.highlight, meta: s.meta || null
      });
      if (s.meta && s.meta.id) byId[s.meta.id] = sysNode;
      (s.modules || []).slice(0, 6).forEach(function(m){
        var modNode = addNode(m.label || 'Module', {
          tier: 2, parent: sysNode, kind: m.kind || 'system',
          r: m.r != null ? m.r : undefined,
          meta: m.meta || null
        });
        if (m.meta && m.meta.id) byId[m.meta.id] = modNode;
      });
    });
    resize();
    if (!config.truthful) neighborsOf(hub).slice(0, 3).forEach(function(t){ spawnAgent(hub, t); });
    (config.signals || []).slice(0, 24).forEach(function(sig){
      var a = byId[sig.source] || hub, b = byId[sig.target] || byId[sig.source];
      if (a && b && a !== b) pendingSignals.push({ a: a, b: b, meta: {
        kind: sig.family || sig.event_type || 'event',
        event_type: sig.event_type || '',
        summary: sig.summary || '',
        speed: 0.0065
      }});
      else if (a) a.pulse = 2.4;
    });

    var onResize = function(){ try { resize(); } catch(_){} };
    window.addEventListener('resize', onResize);

    // ── Interaction: nodes carrying `meta` are clickable (the map is operable). ──
    function _nodeAt(ev){
      var r = canvas.getBoundingClientRect();
      var mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var best = null, bestD = 1e9;
      nodes.forEach(function(n){
        if (!n.meta) return;
        var dx = mx - n.dx, dy = my - n.dy, d = dx*dx + dy*dy;
        var hit = (n.r + 10);
        if (d <= hit*hit && d < bestD){ best = n; bestD = d; }
      });
      return best;
    }
    var onClick = function(ev){
      var n = _nodeAt(ev);
      if (n && typeof config.onNode === 'function'){ try { config.onNode(n.meta, n); } catch(_){} }
    };
    var onMove = function(ev){
      canvas.style.cursor = _nodeAt(ev) ? 'pointer' : '';
    };
    var _interactive = false;
    if (typeof config.onNode === 'function'){
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('mousemove', onMove);
      _interactive = true;
    }

    /* ── THE LIVE API (BRAIN_GRAPH_RUNTIME.md §1) ──────────────────────
     * The graph is a pure observer at the END of the chain: no Signal, no
     * motion. These four methods are the ONLY way motion enters, and each
     * maps to a delta op the runtime emits — nothing here invents movement,
     * and a node that is not in the snapshot cannot be pulsed into existence
     * by a pulse alone (`byId` answers null and the caller does nothing).
     */
    /* THE INDEX ALREADY EXISTED. `byId` is built above while the tree is
       constructed (id → node, for the hub, systems and modules), and the first
       draft of this block added a SECOND lookup with the same name — which the
       existing `var byId = {}` then silently clobbered, so `ctl.byId` was an
       object rather than a function and every live op failed. Use the index
       that is already true rather than a scan that duplicates it. */
    function nodeById(id){
      if (!id) return null;
      return byId[String(id)] || null;
    }
    var ctl = {
      resize: resize,
      spawn: function(label, kind){ var n = addNode(label || 'System', { tier: 1, kind: kind || 'automation' }); n.x = W/2; n.y = H/2; n.placed = true; spawnAgent(hub, n); n.pulse = 2.6; return n; },
      byId: nodeById,
      /* `signal-pulse` — a Signal visibly travelling its ACTUAL path. Agents
       * are spawned hop by hop along the real edges the runtime reported, so
       * the animation is the propagation, never a decorative flourish. */
      pulsePath: function(path){
        var prev = null, moved = 0;
        (path || []).forEach(function(id){
          var n = nodeById(id);
          if (!n) return;                    // unknown node: no invented motion
          n.pulse = Math.max(n.pulse, 2.4);
          if (prev) { try { spawnAgent(prev, n); moved++; } catch(_){} }
          prev = n;
        });
        return moved;
      },
      /* `node-state` — health / activity changed. */
      setState: function(id, state){
        var n = nodeById(id); if (!n) return false;
        n.highlight = (state === 'active' || state === 'pressure');
        if (state === 'active') n.pulse = Math.max(n.pulse, 2.0);
        return true;
      },
      /* `node-revealed` — a thing the Center now understands. Revealed, never
       * created: the caller passes the canonical object id, and re-revealing
       * an id already present is a no-op rather than a duplicate. */
      reveal: function(id, label, kind){
        if (nodeById(id)) return null;
        var n = addNode(label || 'Node', { tier: 1, kind: kind || 'system', meta: { id: id } });
        byId[String(id)] = n;                       // the index stays true
        n.x = W/2; n.y = H/2; n.placed = true; n.pulse = 2.6;
        try { spawnAgent(hub, n); } catch(_){}
        return n;
      },
      /* `node-retired` — the object was archived; it leaves the live view. */
      retire: function(id){
        var n = nodeById(id); if (!n || n.hub) return false;
        delete byId[String(id)];
        nodes = nodes.filter(function(x){ return x !== n; });
        links = links.filter(function(l){ return l.a !== n && l.b !== n; });
        return true;
      },
      count: function(){ return nodes.length - 1; },
      stop: function(){ stopped = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
        if (_interactive){ try { canvas.removeEventListener('click', onClick); canvas.removeEventListener('mousemove', onMove); } catch(_){} } }
    };
    canvas._owBrainCtl = ctl;
    tick();
    return ctl;
  }

  /* ── Ambient backdrop ───────────────────────────────────────────────
   * The Brain as PAGE BACKGROUND, not a card: large faded geometric cores,
   * drifting signal lines, floating system/community nodes. Non-interactive,
   * slow, very low contrast. Theme- and hue-aware (auto-dims in light mode).
   *   OW_BRAINMAP.mountAmbient(canvasEl, { hue?, mode?:'dark'|'light', nodes? })
   * Pin the canvas behind content: position:fixed; inset:0; z-index:0; the
   * page's real content sits in a higher stacking context on top.
   */
  function mountAmbient(canvas, opts){
    opts = opts || {};
    if (!canvas || !canvas.getContext) return null;
    if (canvas._owAmbientCtl){ try { canvas._owAmbientCtl.stop(); } catch(_){} }
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, frame = 0, raf = 0, stopped = false;
    function hue(){ return readHue(opts.hue); }
    function isLight(){
      if (opts.mode === 'light') return true;
      if (opts.mode === 'dark') return false;
      try { var m = (document.body.getAttribute('data-mode') || '').toLowerCase();
            return (m === '' || m === 'light'); } catch(_){ return false; }
    }
    function hsla(h, s, l, a){ return 'hsla(' + ((h%360+360)%360) + ',' + s + '%,' + l + '%,' + a + ')'; }
    function gPoly(cx, cy, r, sides, rot, col, lw){
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (var i=0;i<=sides;i++){ var a=i*Math.PI*2/sides; if(i===0)ctx.moveTo(r*Math.cos(a),r*Math.sin(a)); else ctx.lineTo(r*Math.cos(a),r*Math.sin(a)); }
      ctx.stroke(); ctx.restore();
    }
    function fadedCore(cx, cy, R, f, m){
      var H2 = hue(), t0 = f*0.006;
      var gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, R*1.6);
      gl.addColorStop(0, hsla(H2, 80, 56, (0.06*m).toFixed(3)));
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R*1.6, 0, Math.PI*2); ctx.fill();
      gPoly(cx, cy, R,       8,  t0*0.32, hsla(H2,    72, 58, (0.05*m).toFixed(3)), 1);
      gPoly(cx, cy, R*0.70,  6, -t0*0.55, hsla(H2+24, 74, 60, (0.07*m).toFixed(3)), 1.1);
      gPoly(cx, cy, R*0.46,  3,  t0*1.05, hsla(H2-24, 78, 64, (0.08*m).toFixed(3)), 1.1);
      gPoly(cx, cy, R*0.46,  3, -t0*1.05+Math.PI, hsla(H2+40, 80, 64, (0.08*m).toFixed(3)), 1.1);
      gPoly(cx, cy, R*0.26,  4,  t0*1.7+Math.PI/4, hsla(H2+50, 82, 68, (0.07*m).toFixed(3)), 1);
      ctx.strokeStyle = hsla(H2, 76, 58, (0.07*m).toFixed(3)); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
    }
    var N = opts.nodes || 18, pts = [], sigs = [];
    function seed(){
      pts = [];
      for (var i=0;i<N;i++){
        pts.push({ x: Math.random(), y: Math.random(),
                   vx: (Math.random()-0.5)*0.00018, vy: (Math.random()-0.5)*0.00018,
                   r: 1 + Math.random()*2.4, born: Math.random()*6.28 });
      }
    }
    function resize(){
      var r = canvas.getBoundingClientRect();
      W = Math.max(320, r.width || window.innerWidth);
      H = Math.max(320, r.height || window.innerHeight);
      canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function px(p){ return { x: p.x*W, y: p.y*H }; }
    function tick(){
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (Math.abs((canvas.clientWidth || 0) - W) > 2 || Math.abs((canvas.clientHeight || 0) - H) > 2) resize();
      frame++;
      var light = isLight(), m = light ? 0.55 : 1, H2 = hue();
      ctx.clearRect(0, 0, W, H);
      // Two large faded cores anchor the composition (off to the sides).
      fadedCore(W*0.84, H*0.24, Math.min(W, H)*0.52, frame, m);
      fadedCore(W*0.10, H*0.88, Math.min(W, H)*0.34, -frame*0.7, m*0.8);
      // Drift + draw floating nodes and their faint links.
      pts.forEach(function(p){
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
      });
      for (var i=0;i<pts.length;i++){
        var a = px(pts[i]);
        for (var j=i+1;j<pts.length;j++){
          var b = px(pts[j]);
          var dx = a.x-b.x, dy = a.y-b.y, d = Math.sqrt(dx*dx+dy*dy);
          if (d < Math.min(W, H)*0.26){
            var la = (1 - d/(Math.min(W,H)*0.26)) * 0.10 * m;
            ctx.strokeStyle = hsla(H2, 70, 60, la.toFixed(3));
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      pts.forEach(function(p, i){
        var c = px(p), pulse = 0.5 + Math.sin(frame*0.03 + p.born)*0.5;
        var gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, p.r*6);
        gr.addColorStop(0, hsla(H2+20, 85, light?55:72, (0.28*m).toFixed(3)));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, p.r*6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = hsla(H2+20, 88, light?52:78, ((0.5+pulse*0.4)*m).toFixed(3));
        ctx.beginPath(); ctx.arc(c.x, c.y, p.r, 0, Math.PI*2); ctx.fill();
      });
      // Occasional signal travelling between two nodes.
      if (frame % 90 === 0 && pts.length > 1 && sigs.length < 4){
        var s = Math.floor(Math.random()*pts.length), e = Math.floor(Math.random()*pts.length);
        if (s !== e) sigs.push({ a: pts[s], b: pts[e], t: 0, sp: 0.006 + Math.random()*0.006 });
      }
      sigs = sigs.filter(function(sg){ return sg.t < 1; });
      sigs.forEach(function(sg){
        sg.t += sg.sp;
        var a = px(sg.a), b = px(sg.b);
        var x = a.x + (b.x-a.x)*sg.t, y = a.y + (b.y-a.y)*sg.t;
        var gr = ctx.createRadialGradient(x, y, 0, x, y, 9);
        gr.addColorStop(0, hsla(H2+34, 95, light?58:74, (0.7*m).toFixed(3)));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI*2); ctx.fill();
      });
    }
    seed(); resize();
    var onResize = function(){ try { resize(); } catch(_){} };
    window.addEventListener('resize', onResize);
    var ctl = { resize: resize, stop: function(){ stopped = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); } };
    canvas._owAmbientCtl = ctl;
    tick();
    return ctl;
  }

  function presetOneway(){
    return { label: 'Oneway', systems: [
      { label: 'Profiles' }, { label: 'Communities' }, { label: 'Centers' },
      { label: 'Messages' }, { label: 'Events' }, { label: 'Websites' }, { label: 'Identity' }
    ] };
  }
  function presetOS(orgName){
    return { label: orgName || 'Your Center', systems: [
      { label: 'Hotel Operations', modules: [ {label:'Housekeeping'},{label:'Maintenance'},{label:'Front Desk'},{label:'Guest Services'},{label:'Team'},{label:'Management'} ] },
      { label: 'Marketing', kind:'automation', modules: [ {label:'Social Autopilot'},{label:'Campaigns'},{label:'Content Calendar'},{label:'Ads'} ] },
      { label: 'Website', modules: [ {label:'Public site'},{label:'Guest widget'},{label:'Forms'} ] },
      { label: 'CRM' }, { label: 'Team Portal' }, { label: 'Support' }
    ] };
  }

  window.OW_BRAINMAP = { mount: mount, mountAmbient: mountAmbient, presetOneway: presetOneway, presetOS: presetOS, readHue: readHue };
})();
