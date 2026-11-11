/* THE PLACE ROW — what the world's map knows, as one small line (founder, 2026-10-18).
   ★ FOUNDER: "Make places look more distinct than centers, make their boxes smaller, and make them appear as single lines, even in
     pop-it mode. But give them icons and make them look more unique, and don't let people search for locations called one way."

   A PLACE is not a Center: it is a name the geocoder gave (a city, a county, a park, a street) with nobody behind it on Oneway. So
   its row is a different kind of thing from a Center's lit, glowing 58px row: small (40px), flat, one line (the name, then
   where it is, quietly), with an icon for what KIND of place it is, in a quiet colour of its own group, and the kind said in a word
   at the right. A place that has a Center on Oneway is not drawn at all: it is folded into that Center's row (discovery.js
   findRow's fold), so pressing it takes you there.

   Worn by Discovery's results for kind 'place', in both modes (Popit and Simple). `OW.placeRow.fill(button, {title, sub, type})`
   where `type` is the geocoder's own kind (OpenStreetMap's: city, county, park, beach, aerodrome ...). Rules: oneway-placerow.css. */
(function (global) {
  'use strict';
  var OW = global.OW;
  if (!OW || OW.placeRow) return;

  /* THE ADDRESS OF A PLACE THE MAP KNOWS (the founder, 2026-10-30: "Nemo should not open up different than the gap in Oceanside"): a Center's own address,
     #center/<this>, so the one Center page opens it whatever pressed it. `map:<ref>/<lat>/<lng>/<name>`, its two free parts encoded so the slashes are the token's. */
  OW.placeAddress = {
    of: function (p) {
      return 'map:' + encodeURIComponent(String(p.provider_ref || '').replace(/^map:/, '')) + '/' + p.lat + '/' + p.lng + '/' + encodeURIComponent(p.title || p.name || '');
    },
    read: function (token) {
      var m = /^map:([^/]+)\/(-?[\d.]+)\/(-?[\d.]+)(?:\/(.*))?$/.exec(String(token || ''));
      if (!m) return null;
      try { return { provider_ref: 'map:' + decodeURIComponent(m[1]), lat: Number(m[2]), lng: Number(m[3]), name: decodeURIComponent(m[4] || '') }; } catch (_) { return null; }
    },
    open: function (p) { (OW.go ? OW.go('#center/' + encodeURIComponent(OW.placeAddress.of(p))) : (global.location.hash = '#center/' + encodeURIComponent(OW.placeAddress.of(p)))); }
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* the icons: 24-unit outline marks, drawn in the row's own colour */
  var PATHS = {
    grocery:'M2 3h3l2 12h12l3-9H6M9 20h.01M18 20h.01',
    clothes:'M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z',
    bank:'M3 9l9-6 9 6zM5 10v9M10 10v9M14 10v9M19 10v9M3 21h18',
    fuel:'M4 21V4h9v17M3 21h11M6 6h5v5H6zM13 12h2a2 2 0 012 2v3a2 2 0 004 0V8l-3-3M18 5v4h3',
    parking:'M6 21V3h7a6 6 0 010 12H6M6 6h7a3 3 0 010 6H6',
    car:'M3 16V11l3-6h12l3 6v5H3zM3 11h18M6 16v4M18 16v4M6 13h1M17 13h1',
    fitness:'M2 9v6M5 6v12M5 12h14M19 6v12M22 9v6',
    hair:'M4 3l16 18M20 3L4 21M5 17a3 3 0 110 6 3 3 0 010-6M19 17a3 3 0 110 6 3 3 0 010-6',
    pet:'M8 14c-5 6 1 8 4 6 3 2 9 0 4-6-2-3-6-3-8 0M6 6a2 3 0 110 6 2 3 0 010-6M18 6a2 3 0 110 6 2 3 0 010-6M10 2a2 3 0 110 6 2 3 0 010-6M14 2a2 3 0 110 6 2 3 0 010-6',
    electronics:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
    hardware:'M14 3a6 6 0 00-6 8L2 17l5 5 6-6a6 6 0 008-8l-4 4-5-5z',
    furniture:'M6 12V4h12v8M4 12h16v5H4zM6 17v5M18 17v5',
    post:'M2 5h20v14H2zM2 5l10 8L22 5',
    cinema:'M3 3h18v18H3zM3 8h18M3 16h18M8 3v18M16 3v18M11 10l3 2-3 2z',
    bakery:'M5 10a4 4 0 010-8h14a4 4 0 010 8v11H5zM9 7l-1 5M14 7l-1 5',
    train:'M5 17V5a3 3 0 013-3h8a3 3 0 013 3v12H5zM5 10h14M12 2v8M8 14h.01M16 14h.01M8 17l-3 5M16 17l3 5M7 20h10',
    bus:'M4 18V5a2 2 0 012-2h12a2 2 0 012 2v13H4zM4 11h16M7 18v3M17 18v3M7 14h.01M17 14h.01M1 7v5M23 7v5',
    laundry:'M4 2h16v20H4zM4 7h16M7 4h.01M10 4h.01M17 14a5 5 0 11-10 0 5 5 0 0110 0M8 14c3-3 5 3 8 0',
    bed: 'M3 20V7M3 14h18v6M3 17h18M7 10h4v4H7zM13 10h5a3 3 0 013 3v1h-8z',
    cup: 'M5 7h12v7a5 5 0 01-5 5h-2a5 5 0 01-5-5zM17 8h2a3 3 0 010 6h-2M4 22h15',
    food: 'M5 3v7M2 3v4a3 3 0 006 0V3M5 10v11M18 3v18M18 3c-5 3-5 10 0 10',
    book: 'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1M12 5c3-2 6-2 10-1v15c-4-1-7-1-10 1z',
    shop: 'M3 10h18l-2-6H5zM4 10v11h16V10M9 21v-7h6v7',
    shield: 'M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM9 11l2 2 4-5',
    health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    waste: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    church: 'M12 2v6M9 5h6M4 21V11l8-5 8 5v10H4M10 21v-6h4v6',
    pin: 'M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10zM12 8.8a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z',
    city: 'M4 20V9l5-3v14M9 20V4l7 3v13M16 20v-8l4 2v6M3 20h18',
    region: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
    tree: 'M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5',
    wave: 'M3 10c2.5-3 4.5-3 6 0s3.5 3 6 0 3.5-3 6 0M3 16c2.5-3 4.5-3 6 0s3.5 3 6 0 3.5-3 6 0',
    mountain: 'M3 19l6-10 4 6 3-4 5 8zM9 9l1.6 2.6',
    plane: 'M21 15l-8-4V5a1.5 1.5 0 00-3 0v6l-8 4v2l8-1.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-3.5l8 1.5z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    road: 'M7 3L4 21M17 3l3 18M12 4v3M12 10v4M12 17v3',
    island: 'M3 18c3-1 5-1 7 0s5 1 8 0M12 15V8M12 8c-2-2-4-2-6-1M12 8c2-2 4-2 6-1M12 9c-1-3-1-5 0-6 1 1 1 3 0 6'
  };
  /* OpenStreetMap's own kinds, in groups: the icon, the word, and the group's quiet colour (CSS: data-g) */
  var KINDS = {
    hotel: ['bed','Hotel','mark'], motel: ['bed','Motel','mark'], hostel: ['bed','Hostel','mark'], guest_house: ['bed','Guest house','mark'],
    restaurant: ['food','Restaurant','mark'], fast_food: ['food','Food','mark'], food_court: ['food','Food court','mark'], cafe: ['cup','Cafe','mark'], bar: ['cup','Bar','mark'], pub: ['cup','Pub','mark'],
    school: ['book','School','mark'], university: ['book','University','mark'], college: ['book','College','mark'], library: ['book','Library','mark'],
    shop: ['shop','Shop','mark'], supermarket: ['shop','Supermarket','mark'], shopping_mall: ['shop','Shopping mall','mark'], convenience: ['shop','Shop','mark'],
    police: ['shield','Police station','health'], fire_station: ['shield','Fire station','health'], emergency_department: ['health','Emergency department','health'],
    hospital: ['health','Hospital','health'], clinic: ['health','Clinic','health'], healthcare: ['health','Healthcare','health'], doctors: ['health','Doctor','health'], dentist: ['health','Dentist','health'],
    landfill: ['waste','Landfill','waste'], dump: ['waste','Dump','waste'], waste_transfer_station: ['waste','Waste transfer station','waste'], recycling_centre: ['waste','Recycling center','waste'],
    religious: ['church','Place of worship','mark'], place_of_worship: ['church','Place of worship','mark'], church: ['church','Church','mark'],
    city: ['city', 'City', 'settle'], town: ['city', 'Town', 'settle'], village: ['city', 'Village', 'settle'], hamlet: ['city', 'Hamlet', 'settle'],
    suburb: ['city', 'Neighbourhood', 'settle'], neighbourhood: ['city', 'Neighbourhood', 'settle'], quarter: ['city', 'Neighbourhood', 'settle'],
    borough: ['city', 'Borough', 'settle'], municipality: ['city', 'Municipality', 'settle'], locality: ['city', 'Place', 'settle'],
    county: ['region', 'County', 'region'], state: ['region', 'State', 'region'], region: ['region', 'Region', 'region'],
    province: ['region', 'Province', 'region'], country: ['region', 'Country', 'region'], administrative: ['region', 'Area', 'region'],
    island: ['island', 'Island', 'nature'], archipelago: ['island', 'Islands', 'nature'],
    park: ['tree', 'Park', 'nature'], nature_reserve: ['tree', 'Reserve', 'nature'], national_park: ['tree', 'Park', 'nature'], forest: ['tree', 'Forest', 'nature'],
    wood: ['tree', 'Woods', 'nature'], garden: ['tree', 'Garden', 'nature'], protected_area: ['tree', 'Reserve', 'nature'], playground: ['tree', 'Park', 'nature'],
    beach: ['wave', 'Beach', 'water'], coastline: ['wave', 'Coast', 'water'], bay: ['wave', 'Bay', 'water'], river: ['wave', 'River', 'water'], lake: ['wave', 'Lake', 'water'],
    water: ['wave', 'Water', 'water'], stream: ['wave', 'Stream', 'water'], reservoir: ['wave', 'Reservoir', 'water'], pier: ['wave', 'Pier', 'water'], marina: ['wave', 'Marina', 'water'],
    peak: ['mountain', 'Peak', 'peak'], mountain: ['mountain', 'Mountain', 'peak'], volcano: ['mountain', 'Volcano', 'peak'], hill: ['mountain', 'Hill', 'peak'], ridge: ['mountain', 'Ridge', 'peak'],
    aerodrome: ['plane', 'Airport', 'transit'], airport: ['plane', 'Airport', 'transit'], station: ['plane', 'Station', 'transit'], bus_station: ['plane', 'Station', 'transit'],
    ferry_terminal: ['plane', 'Ferry', 'transit'], railway: ['plane', 'Rail', 'transit'], halt: ['plane', 'Stop', 'transit'], bus_stop: ['plane', 'Stop', 'transit'],
    attraction: ['star', 'Landmark', 'mark'], monument: ['star', 'Monument', 'mark'], memorial: ['star', 'Memorial', 'mark'], castle: ['star', 'Castle', 'mark'],
    museum: ['star', 'Museum', 'mark'], viewpoint: ['star', 'Viewpoint', 'mark'], artwork: ['star', 'Artwork', 'mark'], ruins: ['star', 'Ruins', 'mark'],
    theatre: ['star', 'Theatre', 'mark'], stadium: ['star', 'Stadium', 'mark'], zoo: ['star', 'Zoo', 'mark'], theme_park: ['star', 'Theme park', 'mark'],
    road: ['road', 'Street', 'road'], residential: ['road', 'Street', 'road'], street: ['road', 'Street', 'road'], highway: ['road', 'Road', 'road'],
    motorway: ['road', 'Road', 'road'], trunk: ['road', 'Road', 'road'], primary: ['road', 'Road', 'road'], secondary: ['road', 'Road', 'road'], tertiary: ['road', 'Road', 'road'],
    service: ['road', 'Road', 'road'], path: ['road', 'Path', 'road'], footway: ['road', 'Path', 'road'], pedestrian: ['road', 'Street', 'road'], cycleway: ['road', 'Path', 'road']
  };
  var FALLBACK = ['pin', 'Place', 'pin'];
  /* Source taxonomies use both OSM names and retail category names. Normalize exact aliases;
     never guess a business from a substring of its name. */
  [
    ['grocery','Grocery store','grocery,grocery_store,supermarket,food_store,greengrocer,convenience,convenience_store,wholesale_store'],
    ['clothes','Clothing store','clothes,clothing,clothing_store,fashion,shoe_store,shoes,department_store'],
    ['bank','Bank','bank,financial_service,financial_services,credit_union,atm'],
    ['fuel','Fuel station','fuel,gas_station,petrol_station,fuel_station'],
    ['parking','Parking','parking,parking_garage,car_park,parking_lot'],
    ['car','Automotive','car,car_dealer,car_dealership,car_repair,auto_repair,car_wash,car_rental,automotive'],
    ['fitness','Fitness','gym,fitness,fitness_centre,fitness_center,sports_centre,sports_center,sports_store,sports_shop'],
    ['hair','Salon','hairdresser,hair_salon,barber,barber_shop,beauty,beauty_salon,nail_salon,spa'],
    ['pet','Pets','pet,pet_store,pet_shop,animal_shelter'],
    ['electronics','Electronics','electronics,electronics_store,computer,computer_store,mobile_phone,phone_store'],
    ['hardware','Hardware','hardware,hardware_store,doityourself,home_improvement,building_supply,tool_store'],
    ['furniture','Furniture','furniture,furniture_store,home_goods,home_goods_store'],
    ['post','Post office','post_office,post,mail,shipping_service'],
    ['cinema','Cinema','cinema,movie_theater,movie_theatre'],
    ['bakery','Bakery','bakery,bakery_store,pastry_shop'],
    ['train','Rail station','station,train_station,railway_station,railway,halt,subway_station'],
    ['bus','Bus stop','bus_station,bus_stop,bus_terminal'],
    ['laundry','Laundry','laundry,laundromat,dry_cleaner,dry_cleaning'],
    ['health','Pharmacy','pharmacy,drugstore,drug_store'],
    ['health','Veterinary care','veterinary,veterinarian,animal_hospital'],
    ['bed','Lodging','lodging,resort,inn,bed_and_breakfast'],
    ['food','Restaurant','food_and_drink,dining,fast_food_restaurant,food_and_beverage'],
    ['cup','Cafe','coffee_shop,coffee,tea_room'],
    ['tree','Park','public_park,recreation_ground,dog_park,botanical_garden'],
    ['waste','Waste and recycling','recycling,recycling_center,waste_disposal,waste_management'],
    ['shop','Shop','retail,retail_store,general_store,commercial,shopping,store,florist,flower_shop,gift_shop,jewelry,jewellery,bookshop,books,toys,toy_store']
  ].forEach(function(group){group[2].split(',').forEach(function(key){KINDS[key]=[group[0],KINDS[key]?KINDS[key][1]:group[1],group[0]];});});
  KINDS.convenience_store=['grocery','Convenience store','shop'];
  KINDS.wholesale_store=['shop','Wholesale store','shop'];
  KINDS.department_store=['shop','Department store','shop'];
  KINDS.food_and_drink=['food','Food and drink','mark'];
  KINDS.food_and_beverage=['food','Food and drink','mark'];
  KINDS.chemist=['health','Pharmacy','health'];
  function kindOf(type) { var key=String(type || '').trim().toLowerCase().replace(/[\s-]+/g,'_');return Object.prototype.hasOwnProperty.call(KINDS,key)?KINDS[key]:FALLBACK; }
  function glyph(name) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + PATHS[name] + '"/></svg>';
  }

  /* the row's inside: icon, name and where it is on ONE line, the kind in a word at the right */
  function html(p) {
    var k = kindOf(p.type);
    return '<span class="ow-prow__g" data-g="' + k[2] + '" aria-hidden="true">' + mark(p.type,p.information_center?(p.needs_information?'missing':true):false) + '</span>' +
      '<span class="ow-prow__t"><b dir="auto">' + esc(p.title) + '</b>' + (p.sub ? '<span dir="auto">' + esc(p.sub) + '</span>' : '') + '</span>' +
      '<i class="ow-prow__k">' + esc(k[1]) + '</i>';
  }

  /* `host` is the row's own button (its listeners stay); `p`: {title, sub, type} */
  function fill(host, p) {
    host.classList.add('ow-prow');
    host.classList.toggle('ow-prow--information',!!p.information_center);
    host.setAttribute('data-kind', 'place');
    host.setAttribute('data-pk', String(p.type || ''));
    host.innerHTML = html(p);
    return host;
  }

  // One category presentation: map symbols, search faces and full profiles scale this vector unchanged.
  function paint(type) {
    var k=kindOf(type), colors={health:'#b34354',tree:'#2c9c5e',waste:'#85643f',church:'#bc4894',bed:'#bc4894',food:'#bd7c5a',cup:'#bd7c5a',book:'#76767f',shop:'#397b94',shield:'#397b94',wave:'#2c9c5e',mountain:'#2c9c5e',plane:'#284db8',city:'#797979',region:'#7465a8'};
    // Charcoal faces and category accents sampled from the map's own dark sprite sheet.
    var fills={tree:'#202623',wave:'#202623',mountain:'#202623',food:'#282422',cup:'#282422',book:'#242425',shop:'#212426',shield:'#212426',church:'#282126',bed:'#282126',plane:'#202228'};
    var family={grocery:'shop',clothes:'shop',bank:'shop',fuel:'shop',parking:'plane',car:'plane',fitness:'tree',hair:'church',pet:'tree',electronics:'shop',hardware:'waste',furniture:'shop',post:'shop',cinema:'church',bakery:'food',train:'plane',bus:'plane',laundry:'shop'}[k[0]]||k[0];
    var color=type==='fire_station'?'#b34354':(colors[family]||'#647589');
    var rgb=[1,3,5].map(function(i){return parseInt(color.slice(i,i+2),16);}).join(',');
    var values=rgb.split(',').map(function(v){return +v/255;}),hi=Math.max.apply(Math,values),lo=Math.min.apply(Math,values),delta=hi-lo,angle=0;
    if(delta){angle=hi===values[0]?((values[1]-values[2])/delta)%6:hi===values[1]?(values[2]-values[0])/delta+2:(values[0]-values[1])/delta+4;angle=(angle*60+360)%360;}
    return {color:color,fill:fills[family]||'#242629',rgb:rgb,angle:angle,label:k[1],family:family,vivid:type==='fire_station'?VIVID.health:(VIVID[family]||VIVID.place)};
  }
  /* A PLACE'S MARK IS A POPIT IN ITS CATEGORY'S OWN COLOUR (the founder, 2026-11-10: "when will i see it with no issues and accurate colorful popits"):
     a full, bright disc in the category's colour (a pharmacy red, a park green, food orange, shopping blue, each its own), the glyph in white on
     it, the Popit's top light; never a charcoal disc with a thin ring and a small glyph (that was the map's own dark sprite sheet), never a
     ring round it (S13). One presentation: the map's places, Discovery's rows, a place's card, search and messages draw this one vector. */
  /* each at least as bright as its category's colour above (paint().color), so a mark is never darker than its kind (the guard reads it in pixels) */
  var VIVID={health:'#e5484d',tree:'#30a46c',wave:'#0ea5c6',mountain:'#3fa35a',food:'#ef7426',cup:'#e0782a',shop:'#2186eb',shield:'#4a72ea',
    church:'#d6409f',bed:'#b062d9',plane:'#5468e0',waste:'#ad7a45',book:'#8c62dd',city:'#12a594',region:'#7d63e0',place:'#6478d8'};
  /* the same on the day map and the night map (glass is kept for its callers): the bright disc reads on both, no pale or dark variant; its hazard
     (founder/906, 1011) and its I stay, white, on the disc's edge */
  function mark(type,information,glass) {
    var look=paint(type), path=PATHS[kindOf(type)[0]], fill=look.vivid;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-pm="'+fill+'">'
      +'<circle cx="24" cy="24" r="22" fill="'+fill+'"/>'
      +'<path d="M8.5 19a16 13 0 0 1 31 0c-4.5-4.2-9.7-6-15.5-6s-11 1.8-15.5 6z" fill="#fff" opacity=".24"/>'
      +'<svg x="11" y="11" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>'
      +(information==='missing'?'<path d="M41 32.5 48 45.5H34Z" fill="#fff" stroke-linejoin="round"/><path d="M41 36.5v4.2m0 2.2v.2" stroke="'+fill+'" stroke-width="2" stroke-linecap="round"/>':information?'<circle cx="41" cy="41" r="6.5" fill="#fff"/><text x="41" y="45" text-anchor="middle" font-family="serif" font-size="12" font-weight="700" fill="'+fill+'">i</text>':'')+'</svg>';
  }
  OW.placeRow = { fill: fill, html: html, kind: kindOf, kinds: KINDS, icon: function(type){return glyph(kindOf(type)[0]);}, paint:paint, mark:mark };
})(window);
