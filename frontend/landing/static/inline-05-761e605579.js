
/* ═══ THE LIVE PARTS — every face, name and count is a read ══════════════
   ★ FOUNDER/534: "the card needs to be redesigned to show demo real users
     with actual stats and a demo online status. playing x on x going back to
     the live status we talked about" — the live activity status of
     recovered/1973 (*"people could see their friends' live activity status
     and what they're doing on other platforms … like how Discord could sync
     with Xbox"*). The PEOPLE are real accounts and their name, face, bio,
     links and counts are read from the platform every time the page opens.
     SUPERSEDED 2026-10-10 by his "THESE ROTATING PROFILES SHOULD BE AUTOMATIC THEY SHOULDNT BE PRESET OR
     PREWRITTEN": the demo status, the four prewritten people and the snapshot are gone; the deck deals real public
     profiles (below). A live status returns when the platform truly receives one (test_live_activity). */
(function(){
  if(!window.OW||!OW.cards) return;
  /* WHERE A CARD OPENS WHEN THE PROJECTION IS NOT LOADED: the App, at the card's own address (S21: the card says it) */
  function appHref(c){ return '/oneway-app.html'+(c.app||''); }
  function open(c, from){ project(c.kind, c.id, from, appHref(c)); }

  /* THE PEOPLE AND THE CENTERS ARE THE ECOSYSTEM'S OWN (the founder, 2026-10-10: "THESE ROTATING PROFILES SHOULD BE
     AUTOMATIC THEY SHOULDNT BE PRESET OR PREWRITTEN", "FROM THE ECOSYSTEM THE WHOLE POINT"). Dealt by the platform
     from the profiles their owners put on the open web and the Centers its discovery leads with; each is a CARD, made
     once at the source (api/oneway/cards): this page decides nothing about a name, a place or a face. */
  var PEOPLE_DEAL=4, CENTERS_LEAD=12;
  var people=OW.cards.deck('person', PEOPLE_DEAL);
  /* ONE DEAL OF CENTERS, TWO USES. The Center card below shows a Center's whole story, so it takes only the ones that
     have one (presentableCenters: a real blurb and a picture, a site, posts or events). The strip is a row of faces and
     names, and every Center the platform deals belongs in it. Since ec550099 the strip had been handed the card's
     filtered list too: on :3050 that left 2 Centers and 1 person, under the strip's 4, so it hid itself (founder/791:
     "where did the scrolling online users go?"). */
  var dealtCenters=OW.cards.deck('center', CENTERS_LEAD);
  var centers=dealtCenters.then(OW.deck.presentableCenters);

  /* ── 4 · THE DECK and 4b · CENTERS: frontend/landing/oneway-deck.js draws them, the same for the Ecosystem page ── */
  if(OW.deck){ OW.deck.people(document.getElementById('deck'), document.getElementById('deckFaces'), people);
    OW.deck.center(document.getElementById('cnCard'), document.getElementById('cnRows'), centers); }

  /* ── 3 · THE ECOSYSTEM — Centers and people, interleaved, drifting ── */
  var run=document.getElementById('ecoRun'), strip=document.getElementById('ecoStrip');
  Promise.all([dealtCenters, people]).then(function(r){
    if(!strip) return;
    var cs=r[0].slice(), ps=r[1].slice();
    if(cs.length+ps.length<4) return;              /* nothing to show is shown as nothing (402) */
    var mixed=[]; while(cs.length||ps.length){ if(cs.length) mixed.push(cs.shift()); if(cs.length) mixed.push(cs.shift()); if(ps.length) mixed.push(ps.shift()); }
    function make(c, dup){
      var b=OW.cards.node(c,{as:'chip', className:'eco-it', onOpen:open});
      if(dup){ b.tabIndex=-1; b.setAttribute('aria-hidden','true'); b.removeAttribute('aria-label'); }
      return b;
    }
    /* the track is the row twice, so the drift loops without a seam */
    mixed.forEach(function(c){ strip.appendChild(make(c,false)); });
    mixed.forEach(function(c){ strip.appendChild(make(c,true)); });
    run.hidden=false;
  });

})();
