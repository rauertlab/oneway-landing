
  /* OPEN OVER THIS PAGE. The App's surface for the thing unfolds from the row
     that was pressed and the page steps back behind it (founder/401). Only if
     that surface is not loaded here does the press go to the App. */
  function project(kind, id, from, fallbackHref){
    if(window.OW && OW.project){
      OW.project.open(kind, id, from).then(function(ok){ if(!ok && fallbackHref) location.href=fallbackHref; });
    } else if(fallbackHref){ location.href=fallbackHref; }
  }
  