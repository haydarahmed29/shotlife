const CACHE_NAME = 'shotlife-v15';
const IMG_CACHE = 'shotlife-img-v15';
const IMG_CACHE_MAX = 200;
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}

// HTML, JS, manifest: network-first, simpan salinan untuk offline
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) ||
      (req.mode === 'navigate' ? await cache.match('/index.html') || await cache.match('/') : null);
    if (hit) return hit;
    throw err;
  }
}

// Gambar & font: cache-first (jarang berubah)
async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    cache.put(req, res.clone()).then(() => max && trimCache(name, max));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'raw.githubusercontent.com' || req.destination === 'image') {
    e.respondWith(cacheFirst(req, IMG_CACHE, IMG_CACHE_MAX));
    return;
  }
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(cacheFirst(req, CACHE_NAME));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
  // request lain (lynk.id, canva, drive) dibiarkan lewat browser biasa
});
