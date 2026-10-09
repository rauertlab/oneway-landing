
/* ═══ THE LIVE PARTS — every face, name and count is a read ══════════════
   ★ FOUNDER/534: "the card needs to be redesigned to show demo real users
     with actual stats and a demo online status. playing x on x going back to
     the live status we talked about" — the live activity status of
     recovered/1973 (*"people could see their friends' live activity status
     and what they're doing on other platforms … like how Discord could sync
     with Xbox"*). The PEOPLE are real accounts and their name, face, bio,
     links and counts are read from the platform every time the page opens.
     The STATUS is the demo he asked for — ONEWAY does not receive activity
     from Xbox, Spotify or Twitch yet — and it lives here, in DEMO, and
     nowhere in any account. If a person cannot be read, the last read of
     them (SNAPSHOT, 2026-09-25) stands in, so the card never reads as an
     error on a page served without the API. */
(function(){
  if(!window.OW) return;
  var NOT={cancelled:1,draft:1,ended:1};
  function pair(h){ var p=(OW.hue&&OW.hue.fromAngle)?OW.hue.fromAngle(h):null; return p?{h1:p[0],h2:p[1]||p[0]}:null; }
  function inZone(iso, zone, opts){ var d=new Date(iso); if(isNaN(d)) return ''; try{ return new Intl.DateTimeFormat(undefined, zone?Object.assign({timeZone:zone},opts):opts).format(d); }catch(e){ return new Intl.DateTimeFormat(undefined,opts).format(d); } }
  function J(u,h){ return fetch(u,{headers:Object.assign({accept:'application/json'},h||{})}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function initials(n){ return OW.initials?OW.initials(n):String(n||'').slice(0,2).toUpperCase(); }
  function faceInner(pic, name){ var src=pic?(OW.imageUrl?OW.imageUrl(pic):pic):''; return src?'<img src="'+esc(src)+'" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement(\'i\'),{textContent:'+esc(JSON.stringify(initials(name)))+'}))">':'<i>'+esc(initials(name))+'</i>'; }
  /* A PERSON IS NAMED BY @handle (people/refs.py, 2026-10-02), and a visitor is not answered about anybody by
     address (S5, 2026-10-09): every read and link here goes by the handle. */
  function personHref(ref){ return '/oneway-app.html#center/@'+encodeURIComponent(String(ref||'').replace(/^@/,'')); }
  function pid(p){ return (p&&(p.ref||(p.handle?'@'+p.handle:'')))||''; }

  var CONTROLLER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 7h9a5 5 0 0 1 4.9 6l-.6 3.2a2.4 2.4 0 0 1-4.2 1L15 15.5H9L7.4 17.2a2.4 2.4 0 0 1-4.2-1L2.6 13A5 5 0 0 1 7.5 7z"/><path d="M7.5 10v3M6 11.5h3"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="12.8" r=".6" fill="currentColor"/></svg>';
  /* the demo statuses — "playing x on x" (534). started = seconds ago. */
  var DEMO=[];
  /* the last read of each person, 2026-09-25 — used only when the platform cannot be reached */
  var SNAPSHOT={};
  var people=Promise.all(DEMO.map(function(d){ var h='@'+d.email.split('@')[0]; return J('/api/oneway/people/'+encodeURIComponent(h)+'/profile').then(function(x){ return (x&&x.person&&x.person.ref)?x:SNAPSHOT[d.email]; }); }));
  var discovery=J('/api/oneway/centers/discovery').then(function(j){
    var rows=((j&&j.buttons)||[]).filter(function(x){ return x&&x.name&&x.center_id; });
    var lead=rows.filter(function(x){ return x.reserve; }); if(!lead.length) lead=rows;
    return lead.slice(0,8);
  });

  /* ── 3 · THE ECOSYSTEM — Centers and people, interleaved, drifting ── */
  var run=document.getElementById('ecoRun'), strip=document.getElementById('ecoStrip');
  Promise.all([discovery, people]).then(function(r){
    if(!strip) return;
    var cs=r[0].map(function(x){ return {kind:'center', id:x.center_id, name:x.name, pic:x.picture||'', hue:x.hue}; });
    var ps=r[1].filter(Boolean).map(function(d){ var p=d.person; return {kind:'person', id:pid(p), name:p.name||p.handle||pid(p), pic:p.picture||'', hue:p.hue}; });
    if(cs.length+ps.length<4) return;              /* nothing to show is shown as nothing (402) */
    var mixed=[]; while(cs.length||ps.length){ if(cs.length) mixed.push(cs.shift()); if(cs.length) mixed.push(cs.shift()); if(ps.length) mixed.push(ps.shift()); }
    function make(it, dup){
      var b=document.createElement('button'); b.type='button'; b.className='eco-it'; b.setAttribute('data-kind',it.kind);
      if(dup){ b.tabIndex=-1; b.setAttribute('aria-hidden','true'); } else b.setAttribute('aria-label','Open '+it.name);
      var hp=(typeof it.hue==='number')?pair(it.hue):null;
      b.innerHTML='<span class="f">'+faceInner(it.pic, it.name)+'</span><b>'+esc(it.name)+'</b>';
      if(hp){ var f=b.firstChild; f.style.setProperty('--h',hp.h1); f.style.setProperty('--h2',hp.h2); }
      b.addEventListener('click',function(){ if(it.kind==='center') project('center', it.id, b, '/oneway-app.html#/c/'+encodeURIComponent(it.id)); else project('person', it.id, b, personHref(it.id)); });
      return b;
    }
    /* the track is the row twice, so the drift loops without a seam */
    mixed.forEach(function(it){ strip.appendChild(make(it,false)); });
    mixed.forEach(function(it){ strip.appendChild(make(it,true)); });
    run.hidden=false;
  });

  /* ── 4 · THE DECK — each person as they are, what they are doing now ── */
  var deck=document.getElementById('deck'), faces=document.getElementById('deckFaces');
  var centerFace=J('/api/oneway/centers/bfe9764db5f4/app').then(function(a){ var id=(a&&a.identity)||{}; return {pic:id.picture||'', name:id.name||'Four Queens'}; });
  function clock(s){ s=Math.max(0,Math.floor(s)); var h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(x).padStart(2,'0'); }
  function ago(s){ var m=Math.max(1,Math.round(s/60)); return m<60?m+' min':Math.floor(m/60)+'h '+(m%60)+'m'; }
  Promise.all([people, centerFace]).then(function(r){
    if(!deck) return;
    var list=r[0], cf=r[1], born=Date.now()/1000, cards=[], buttons=[];
    list.forEach(function(d, i){
      if(!d||!d.person) return;
      var p=d.person, s=DEMO[i], c=d.counts||{}, posts=(c.posts!=null)?c.posts:(Array.isArray(d.posts)?d.posts.length:(d.posts||0));
      var hp=(typeof p.hue==='number')?pair(p.hue):null;
      var el=document.createElement('article'); el.className='pcard'; el.tabIndex=0; el.setAttribute('aria-label',(p.name||p.handle)+', online');
      if(hp){ el.style.setProperty('--h',hp.h1); el.style.setProperty('--h2',hp.h2); }
      var mark=s.mark.svg?'<span class="pc-mark" style="background:'+s.mark.bg+'">'+s.mark.svg+'</span>'
        : s.mark.platform?'<span class="pc-mark" style="color:'+esc((OW.links&&OW.links.hueOf&&OW.links.hueOf(s.mark.platform))||'#fff')+'">'+((OW.links&&OW.links.icon)?OW.links.icon(s.mark.platform,''):'')+'</span>'
        : '<span class="pc-mark">'+faceInner(cf.pic, cf.name)+'</span>';
      var urls=(p.links||[]).map(function(l){ return l&&(l.url||l.href); }).filter(Boolean); if(p.website) urls.unshift(p.website);
      var links=''; if(OW.links&&OW.links.platformOf){ urls.slice(0,5).forEach(function(u){ var pf=OW.links.platformOf(u); if(!pf) return;
        var hue=OW.links.hueOf?OW.links.hueOf(pf.key):''; links+='<a href="'+esc(pf.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(pf.name)+'" title="'+esc(pf.name)+'"'+(hue&&hue!=='#000000'?' style="color:'+esc(hue)+'"':'')+'>'+OW.links.icon(pf.key,pf.href)+'</a>'; }); }
      el.innerHTML=
        '<div class="pc-top"><span class="pc-face" data-shape="'+esc(p.shape||'round')+'"><span class="in">'+faceInner(p.picture||'', p.name||p.handle)+'</span></span>'+
          '<div class="pc-id"><span class="pc-name">'+esc(p.name||p.handle)+'</span><span class="pc-handle">@'+esc(p.handle||pid(p).replace(/^@/,''))+'</span></div>'+
          '<span class="pc-on">Online</span></div>'+
        '<div class="pc-live">'+mark+'<div><div class="pc-live-t">'+esc(s.verb)+' <b>'+esc(s.what)+'</b>'+(s.on?' on <b>'+esc(s.on)+'</b>':'')+'</div><div class="pc-live-s" data-t></div></div></div>'+
        (p.bio?'<p class="pc-bio">'+esc(p.bio)+'</p>':'')+
        (links?'<div class="pc-links">'+links+'</div>':'')+
        '<div class="pc-sp"></div><div class="pc-stats"><span><b>'+(posts||0)+'</b>posts</span><span><b>'+(c.followers||0)+'</b>followers</span><span><b>'+(c.following||0)+'</b>following</span></div>';
      el.querySelectorAll('.pc-links a').forEach(function(a){ a.addEventListener('click',function(e){ e.stopPropagation(); }); });
      el.addEventListener('click',function(){ if(el.getAttribute('data-at')==='0') project('person', pid(p), el, personHref(pid(p))); });
      el._tick=function(now){ var t=el.querySelector('[data-t]'); if(!t) return; var secs=s.started+(now-born); t.textContent=s.tail==='here'?'Here for '+ago(secs):clock(secs)+' elapsed'; };
      deck.appendChild(el); cards.push(el);
      var b=document.createElement('button'); b.type='button'; b.setAttribute('aria-label',p.name||p.handle);
      if(hp){ b.style.setProperty('--h',hp.h1); b.style.setProperty('--h2',hp.h2); }
      b.innerHTML=faceInner(p.picture||'', p.name||p.handle); faces.appendChild(b); buttons.push(b);
    });
    if(!cards.length) return;
    var front=0, timer=null, still=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function lay(){
      cards.forEach(function(el,i){ var at=(i-front+cards.length)%cards.length; el.setAttribute('data-at', at>3?'out':String(at)); el.setAttribute('aria-hidden', at===0?'false':'true'); });
      buttons.forEach(function(b,i){ b.classList.toggle('on', i===front); b.setAttribute('aria-pressed', String(i===front)); });
      /* one height for every card, the tallest, so a card behind never shows below the one in front */
      cards.forEach(function(el){ el.style.height='auto'; });
      var h=0; cards.forEach(function(el){ h=Math.max(h, el.offsetHeight); });
      if(h){ cards.forEach(function(el){ el.style.height=h+'px'; }); deck.style.setProperty('--deck-h', h+'px'); }
    }
    function go(i){ front=(i+cards.length)%cards.length; lay(); }
    function auto(){ clearInterval(timer); if(!still) timer=setInterval(function(){ go(front+1); }, 5200); }
    buttons.forEach(function(b,i){ b.addEventListener('click',function(){ go(i); auto(); }); });
    deck.addEventListener('mouseenter',function(){ clearInterval(timer); }); deck.addEventListener('mouseleave',auto);
    function tick(){ var now=Date.now()/1000; cards.forEach(function(el){ el._tick(now); }); }
    tick(); setInterval(tick, 1000);
    lay(); auto();
    addEventListener('resize', function(){ lay(); }, {passive:true});
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(lay);
  });

  /* ── 4b · CENTERS — the first with something coming up as one card (410),
     the rest as rows, each wearing its own picture */
  var cardHost=document.getElementById('cnCard'), rowsHost=document.getElementById('cnRows');
  discovery.then(function(lead){
    lead=lead.slice(0,6);
    if(!lead.length){ var w=cardHost&&cardHost.parentNode; if(w) w.hidden=true; return; }
    return Promise.all(lead.map(function(x){ return J('/api/oneway/centers/'+encodeURIComponent(x.center_id)+'/app'); })).then(function(apps){
      apps=apps.filter(function(a){ return a&&a.exists!==false&&!a.hidden; });
      var withEv=apps.filter(function(a){ return ((a.events||{}).items||[]).some(function(e){ return e&&e.title&&!NOT[String(e.state||'').toLowerCase()]&&e.starts_at; }); });
      var a=withEv[0]||apps[0];
      if(a){
        var CID=a.center_id||'', id=a.identity||{}, h=a.header||{}, zone=(a.where&&a.where.time&&a.where.time.timezone)||'';
        var hue=(typeof id.hue==='number')?pair(id.hue):(typeof h.hue==='number'?pair(h.hue):null);
        var card=document.createElement('div'); card.className='flag-card';
        if(hue){ card.style.setProperty('--h',hue.h1); card.style.setProperty('--h2',hue.h2); }
        var evs=((a.events||{}).items||[]).filter(function(e){ return e&&e.title&&!NOT[String(e.state||'').toLowerCase()]&&!(e.legacy&&!e.starts_at); })
          .sort(function(x,y){ return String(x.starts_at||'~').localeCompare(String(y.starts_at||'~')); }).slice(0,3);
        var where=[h.category||id.kind, h.location||(a.where&&a.where.label)].filter(Boolean).join(' · ');
        card.innerHTML='<button type="button" class="flag-id" aria-label="Open '+esc(id.name||'this Center')+'"><span class="flag-face" data-shape="'+esc(id.shape||'rounded')+'">'+faceInner(id.picture||'', id.name||'')+'</span>'+
          '<span><span class="flag-name">'+esc(id.name||h.name||'A Center')+'</span>'+(where?'<span class="flag-sig" style="display:block">'+esc(where)+'</span>':'')+'</span></button>'+
          (id.description?'<p class="flag-bio">'+esc(id.description)+'</p>':'');
        card.querySelector('.flag-id').addEventListener('click',function(){ project('center', CID, card, '/oneway-app.html#/c/'+encodeURIComponent(CID)); });
        /* a face names its person by `ref` (@handle) since 2026-10-02, and filtering on `email` dropped every face
           (measured 2026-10-09: 0 on every Center). A person with no username is shown by name and is not a link. */
        var fcs=((a.people||{}).faces||[]).filter(function(f){ return f&&(f.ref||f.email||f.name); }).slice(0,4);
        if(fcs.length){ var pl=document.createElement('div'); pl.className='flag-people';
          fcs.forEach(function(f){ var to=f.ref||f.email||''; var b=document.createElement(to?'button':'span'); if(to) b.type='button';
            b.innerHTML='<span class="fp" data-shape="'+esc(f.shape||'round')+'">'+faceInner(f.picture||'', f.name||f.ref||'')+'</span>'+esc(f.name||String(f.ref||f.email||'').replace(/^@/,'').split('@')[0]);
            if(to) b.addEventListener('click',function(e){ e.stopPropagation(); project('person', to, b, personHref(to)); }); pl.appendChild(b); });
          card.appendChild(pl); }
        if(evs.length){
          var sub=document.createElement('div'); sub.className='flag-sub'; sub.innerHTML='<b>Events</b><span>'+evs.length+'</span>'; card.appendChild(sub);
          var list=document.createElement('div'); list.className='flag-evs'; card.appendChild(list);
          evs.forEach(function(e){
            var iso=e.starts_at||''; var mk=iso?{mon:inZone(iso,zone,{month:'short'}), day:+inZone(iso,zone,{day:'numeric'})}:null;
            var hour=iso?inZone(iso,zone,{hour:'numeric',minute:'2-digit'}):''; var venue=(e.mode==='digital'||e.mode==='online')?'Online':(e.place||'');
            var n=OW.glance({ id:'cn-ev-'+e.id, label:e.title, when:mk, icon:'event', hue:hue, signal:[hour, venue].filter(Boolean).join(' · ') },{open:false});
            n.addEventListener('click',function(ev){ ev.stopPropagation(); project('event', e.id, n, '/oneway-app.html#event/'+encodeURIComponent(e.id)); });
            list.appendChild(n);
          });
        }
        cardHost.appendChild(card);
      }
      lead.filter(function(x){ return !a || x.center_id!==a.center_id; }).slice(0,3).forEach(function(x){
        var n=OW.glance({ id:'cn-'+x.center_id, label:x.name, face:{ image:x.picture||'', name:x.name, shape:x.shape||'rounded' },
          signal:[x.kind].filter(Boolean).join(' · '), hue:(typeof x.hue==='number')?pair(x.hue):null },{open:false});
        n.addEventListener('click',function(){ project('center', x.center_id, n, '/oneway-app.html#/c/'+encodeURIComponent(x.center_id)); });
        rowsHost.appendChild(n);
      });
    });
  });
})();
