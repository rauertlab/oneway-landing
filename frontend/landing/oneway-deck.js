/* THE DECK AND THE CENTER CARD (frontend/landing/oneway-deck.js, with oneway-deck.css)

   The people on Oneway as their cards, one in front and the rest stacked behind it with their faces to press, and a
   Center as one card with what is coming up there, a few more as rows under it. Moved word for word from index.html on
   2026-10-11 so the homepage and the Ecosystem page draw them ONCE (CLAUDE.md §5, a concept built twice).
   ★ FOUNDER/493: "examples of profile cards then the clickable profile pictures that is fantastic. The card should show
     the bio, the links u can put on, THE REAL ICONS and designs".
   ★ 2026-10-10: "THESE ROTATING PROFILES SHOULD BE AUTOMATIC THEY SHOULDNT BE PRESET OR PREWRITTEN": every card is dealt
     by the platform (api/oneway/cards); nothing to show is shown as nothing.
     OW.deck.people(deckEl, facesEl, dealt)    dealt: OW.cards.deck('person', n)
     OW.deck.center(cardHost, rowsHost, dealt) dealt: OW.cards.deck('center', n)
     OW.deck.links(host, [[key, name], ...])    the links a profile or a Center can carry, as the link bar draws them
   A press opens over the page where the page carries the App's projection (index.html's project()), else in the App. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  if (OW.deck) return;
  function pair(h){ var p=(OW.hue&&OW.hue.fromAngle)?OW.hue.fromAngle(h):null; return p?{h1:p[0],h2:p[1]||p[0]}:null; }
  function inZone(iso, zone, opts){ var d=new Date(iso); if(isNaN(d)) return ''; try{ return new Intl.DateTimeFormat(undefined, zone?Object.assign({timeZone:zone},opts):opts).format(d); }catch(e){ return new Intl.DateTimeFormat(undefined,opts).format(d); } }
  function appHref(c){ return '/oneway-app.html'+(c.app||''); }
  function project(kind, id, from, href){
    if(typeof global.project==='function') global.project(kind, id, from, href); else if(href) global.location.href=href;
  }
  function open(c, from){ project(c.kind, c.id, from, appHref(c)); }
  function presentableCenters(cards){
    return (cards||[]).filter(function(c){
      return c && !c.demo && String(c.blurb||'').trim().length >= 20 &&
        (c.website || c.cover || (c.counts && c.counts.posts > 0) || (c.events||[]).length);
    });
  }

  /* ── 4 · THE DECK — each person as their card ── */
  function people(deck, faces, dealt){
  return Promise.resolve(dealt).then(function(list){
    if(!deck) return;
    var cards=[], buttons=[];
    list.forEach(function(c){
      var hp=(typeof c.hue==='number')?pair(c.hue):null;
      var el=OW.cards.node(c,{as:'tile',className:'pcard',onOpen:false});
      el.querySelectorAll('.ow-ocard__links a').forEach(function(a){ a.addEventListener('click',function(e){ e.stopPropagation(); }); });
      el.addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('a')) return; if(el.getAttribute('data-at')==='0') open(c, el); });
      el.addEventListener('keydown',function(e){ if(e.target===el && el.getAttribute('data-at')==='0' && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); open(c,el); } });
      deck.appendChild(el); cards.push(el);
      var b=document.createElement('button'); b.type='button'; b.setAttribute('aria-label',c.title);
      if(hp){ b.style.setProperty('--h',hp.h1); b.style.setProperty('--h2',hp.h2); }
      b.innerHTML=OW.cards.face(c); faces.appendChild(b); buttons.push(b);
    });
    if(!cards.length){ var w=deck.closest('.deck-wrap'); if(w) w.hidden=true; return; }   /* no data, no deck */
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
    lay(); auto();
    addEventListener('resize', function(){ lay(); }, {passive:true});
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(lay);
  });
  }

  /* ── 4b · CENTERS — the first with something coming up as one card (410), the rest as rows ── */
  function center(cardHost, rowsHost, dealt){
  return Promise.resolve(dealt).then(function(lead){
    lead=lead.slice(0,6);
    if(!lead.length){ var w=cardHost&&cardHost.parentNode; if(w) w.hidden=true; return; }
    return OW.cards.read(lead.map(function(c){ return 'center:'+c.id; }), {include:true}).then(function(map){
      var cs=lead.map(function(c){ return map['center:'+c.id]||c; });
      var withEv=cs.filter(function(c){ return (c.events||[]).length; });
      var a=withEv[0]||cs[0];
      if(a){
        var hue=(typeof a.hue==='number')?pair(a.hue):null;
        var card=OW.cards.node(a,{as:'flag', className:'flag-card', onOpen:false});
        if(hue){ card.style.setProperty('--h',hue.h1); card.style.setProperty('--h2',hue.h2); }
        /* the card's own press: the Center; a person who speaks for it: that person (a face with no @handle is no link) */
        card.addEventListener('click',function(e){
          if(e.target.closest&&e.target.closest('a:not(.ow-ocard__who)')) return;
          var w=e.target.closest&&e.target.closest('.ow-ocard__who');
          if(w){ e.preventDefault(); e.stopPropagation(); var id=w.getAttribute('data-id'); if(id) project('person', id, w, '/oneway-app.html#center/'+encodeURIComponent(id)); return; }
          open(a, card);
        });
        card.addEventListener('keydown',function(e){ if(e.target===card && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); open(a,card); } });
        var evs=a.events||[], zone=a.timezone||'';
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
      cs.filter(function(c){ return !a || c.id!==a.id; }).slice(0,3).forEach(function(c){
        var n=OW.cards.node(c,{as:'tile', className:'flag-card', onOpen:open}); rowsHost.appendChild(n);
      });
    });
  });
  }

  function links(host, keys){
    if(!host || !OW.links || !OW.links.bar) return null;
    var row=OW.links.bar([], (keys||[]).map(function(k){ return {key:k[0], name:k[1]}; }));
    if(row){ row.classList.add('ow-deck-links'); host.appendChild(row); }
    return row;
  }

  OW.deck = { people: people, center: center, links: links, presentableCenters: presentableCenters };
})(window);
