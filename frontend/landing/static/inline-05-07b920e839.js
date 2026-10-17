
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
  /* PLACEHOLDERS FOR NOW (founder, 2026-10-17: "we are gonna publish the placeholders for now its alright if nothings
     clickable"): the decks draw OW.landingExamples (frontend/landing/examples.js) through OW.lcard, a profile and a Center
     the same size; the platform's own deal (people, centers above) still feeds the drifting strip */
  if(OW.deck && OW.landingExamples && OW.lcard){
    OW.deck.people(document.getElementById('deck'), document.getElementById('deckFaces'), OW.landingExamples.people, {make:OW.lcard, fit:true});
    OW.deck.people(document.getElementById('cnDeck'), document.getElementById('cnFaces'), OW.landingExamples.centers, {make:OW.lcard, fit:true}); }

  /* ── 3 · THE ECOSYSTEM — Centers and people, interleaved, drifting ── */
  var run=document.getElementById('ecoRun'), strip=document.getElementById('ecoStrip');
  /* ON THE PUBLISHED COPY (oneway.center has no backend; founder/829: "have the same scrolling wheel of centers removing
     ones that would rasie eyebrows like freedom or russia or moscow"): the build names the file of Centers it read from
     this same deal, reviewed names only (tools/landing_static.py STRIP_*), and the strip's people are the landing's own
     examples. Nothing on it opens there: the copy has no Center page to open. */
  var published=window.owStrip;
  var dealing=published
    ? Promise.all([fetch(published).then(function(r){ return r.ok ? r.json() : {}; }).then(function(j){ return (j&&j.cards)||[]; }).catch(function(){ return []; }),
                   Promise.resolve((OW.landingExamples&&OW.landingExamples.people)||[])])
    : Promise.all([dealtCenters, people]);
  dealing.then(function(r){
    if(!strip) return;
    var cs=r[0].slice(), ps=r[1].slice();
    if(cs.length+ps.length<4) return;              /* nothing to show is shown as nothing (402) */
    /* two Centers, then a person; on the copy's longer row the people are spread along all of it */
    var every=published ? Math.max(2, Math.round(cs.length/Math.max(1, ps.length))) : 2;
    var mixed=[]; while(cs.length||ps.length){ for(var k=0;k<every&&cs.length;k++) mixed.push(cs.shift()); if(ps.length) mixed.push(ps.shift()); }
    function make(c, dup){
      var b=OW.cards.node(c,{as:'chip', className:'eco-it', onOpen:published ? false : open});
      if(published){ b.tabIndex=-1; b.removeAttribute('aria-label'); }
      if(dup){ b.tabIndex=-1; b.setAttribute('aria-hidden','true'); b.removeAttribute('aria-label'); }
      return b;
    }
    /* the track is the row twice, so the drift loops without a seam */
    mixed.forEach(function(c){ strip.appendChild(make(c,false)); });
    mixed.forEach(function(c){ strip.appendChild(make(c,true)); });
    run.hidden=false;
    /* the copy's row holds every reviewed Center, longer than the platform's deal of 12: it drifts at the platform's own
       pace (its 13 faces, 1,213 px, cross in 46 s: about 26 px a second), not faster */
    if(published){
      var pace=function(){ var w=strip.scrollWidth/2; if(w>0) strip.style.animationDuration=Math.max(46, Math.round(w/26))+'s'; };
      pace(); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(pace);
    }
  });

})();
