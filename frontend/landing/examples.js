/* THE LANDING'S EXAMPLE PROFILES AND CENTERS (the founder, 2026-10-17: "condense the profile and center cards to be the same
   size, completely redo them with correct design and info and give multiple examples. i want to build highly populated
   centers and profiles in the next few days and push them to the landing pages but we are gonna publish the placeholders
   for now its alright if nothings clickable"). Placeholders until his own Centers and profiles replace them: invented
   people and places in the beta's city, drawn by the one card renderer (OW.cards) as the App draws a real card, each
   marked `example` so nothing on it opens, and the section says they are examples. No real person, account or business. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  var P = function (o) { o.kind = 'person'; o.example = true; o.private = false; o.id = o.handle; o.ref = o.handle; o.app = ''; o.href = ''; o.unreadable = []; return o; };
  var C = function (o) { o.kind = 'center'; o.example = true; o.demo = false; o.id = o.ref.replace(/^\$/, ''); o.app = ''; o.href = ''; o.unreadable = []; o.links = []; return o; };
  OW.landingExamples = {
    people: [
      P({ handle: '@maya.cole', title: 'Maya Cole', hue: 330, layout: 'beside', picture: null,
          line: 'Photographer in Brooklyn. Street portraits, rooftops and the light at golden hour.', place: 'Brooklyn, NY', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.tiktok.com/' }, { url: 'https://www.youtube.com/' }],
          banner: null, counts: { posts: 214, followers: 3820, following: 412 } }),
      P({ handle: '@jordanreyes', title: 'Jordan Reyes', hue: 24, layout: 'beside', picture: null,
          line: 'Chef. A Brooklyn pop-up every Friday this winter.', place: 'Williamsburg, Brooklyn', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }, { url: 'https://x.com/' }],
          banner: null, counts: { posts: 96, followers: 1240, following: 301 } }),
      P({ handle: '@priya.shah', title: 'Priya Shah', hue: 262, layout: 'beside', picture: null,
          line: 'Runs a book club in Astoria. Thursdays at 7, new members always welcome.', place: 'Queens, NY', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.linkedin.com/' }],
          banner: null, counts: { posts: 58, followers: 640, following: 288 } }),
      P({ handle: '@marcus.lee', title: 'Marcus Lee', hue: 190, layout: 'beside', picture: null,
          line: 'DJ and producer. Sets around the city most weekends.', place: 'Manhattan, NY', website: '',
          links: [{ url: 'https://www.tiktok.com/' }, { url: 'https://www.youtube.com/' }, { url: 'https://www.instagram.com/' }, { url: 'https://discord.com/' }],
          banner: null, counts: { posts: 331, followers: 9150, following: 187 } })
    ],
    centers: [
      C({ ref: '$rockawaysurf', title: 'Rockaway Surf Club', hue: 200, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'club', category_label: 'Surf club', categories: ['Surf club', 'Lessons'], line: 'Rockaway Beach, NY',
          blurb: 'Lessons at dawn, boards to rent and a bonfire most Fridays all summer.', website: '',
          details: [{ label: 'Hours', value: 'Daily from 6am' }, { label: 'Lessons', value: 'From $45' }, { label: 'Rentals', value: 'Boards, wetsuits' }], counts: { followers: 2480, posts: 142, events: 18 } }),
      C({ ref: '$sunrisebakery', title: 'Sunrise Bakery', hue: 38, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'bakery', category_label: 'Bakery', categories: ['Bakery', 'Coffee'], line: 'Astoria, NY',
          blurb: 'Bread from 6am, coffee all day and a long table for whoever comes in.', website: '',
          details: [{ label: 'Hours', value: '6am to 6pm' }, { label: 'Serves', value: 'Bread, pastry, coffee' }], counts: { followers: 1310, posts: 87, events: 6 } }),
      C({ ref: '$baystreetstudio', title: 'Bay Street Studio', hue: 285, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'studio', category_label: 'Dance studio', categories: ['Dance studio', 'Classes'], line: 'Long Island City, NY',
          blurb: 'Classes for every level, six days a week, and a showcase every season.', website: '',
          details: [{ label: 'Classes', value: '6 days a week' }, { label: 'Styles', value: 'Ballet, hip hop, jazz' }, { label: 'Ages', value: '4 and up' }, { label: 'First class', value: 'Free' }], counts: { followers: 870, posts: 64, events: 12 } }),
      C({ ref: '$harborlights', title: 'Harbor Lights Market', hue: 150, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'market', category_label: 'Farmers market', categories: ['Farmers market', 'Local food'], line: 'Red Hook, Brooklyn',
          blurb: 'Local farms by the water, with music and food trucks every week.', website: '',
          details: [{ label: 'Open', value: 'Sat, 8am to 1pm' }, { label: 'Season', value: 'May to November' }, { label: 'Vendors', value: '40 local farms' }, { label: 'Parking', value: 'Free, on site' }, { label: 'Pets', value: 'Welcome' }, { label: 'Pays', value: 'Cards, cash, SNAP' }], counts: { followers: 1960, posts: 110, events: 27 } })
    ]
  };
})(window);
