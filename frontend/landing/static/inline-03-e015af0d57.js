
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
