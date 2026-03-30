const CACHE_NAME = 'my-pwa-cache-v16';
const urlsToCache = [
    '/',
    '/index.html',
    '/script.js',
    '/tween.umd.js',
    '/js/three.module.js',
    '/js/TrackballControls.js',
    '/nets/tetrahedron-top.json',
    '/nets/cube-top.json',
    '/nets/octahedron-top.json',
    '/nets/dodecahedron-top.json',
    '/nets/icosahedron-top.json',
    '/nets/cubotahedron-top.json',
    '/nets/rhombicuboctahedron-top.json',
    '/nets/icosidodecahedron-top.json',
    '/nets/truncated-tetrahedron-top.json',
    '/nets/truncated-cube-top.json',
    '/nets/truncated-octahedron-top.json',
    '/nets/truncated-cuboctahedron-top.json',
    '/nets/truncated-dodecahedron-top.json',
    '/nets/truncated-icosahedron-top.json',
    '/nets/truncated-icosidodecahedron-top.json',
    '/nets/small-rhombicosidodecahedron-top.json',
    '/nets/snub-cube-top.json',
    '/nets/snub-dodecahedron-top.json',
    '/icons/192.png',
    '/icons/512.png',
    '/trophies/cube-top.png',
    '/trophies/tetrahedron-top.png',
    '/trophies/octahedron-top.png',
    '/trophies/dodecahedron-top.png',
    '/trophies/icosahedron-top.png',
    '/trophies/truncated-tetrahedron-top.png',
    '/trophies/truncated-cube-top.png',
    '/trophies/truncated-octahedron-top.png',
    '/trophies/truncated-dodecahedron-top.png',
    '/trophies/truncated-icosahedron-top.png',
    '/trophies/cuboctahedron-top.png',
    '/trophies/truncated-cuboctahedron-top.png',
    '/trophies/icosidodecahedron-top.png',
    '/trophies/rhombicuboctahedron-top.png',
    '/trophies/small-rhombicosidodecahedron-top.png',
    '/trophies/truncated-icosidodecahedron-top.png',
    '/trophies/snub-cube-top.png',
    '/trophies/snub-dodecahedron-top.png',
    '/trophies/rhombic-dodecahedron-net.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
