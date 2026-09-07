const CACHE_NAME = 'command-deck-v7';
const SHARE_CACHE_NAME = 'command-deck-share';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './shortcut-capture.png',
  './shortcut-board.png',
  './shortcut-signal.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Web Share Target: the OS/browser POSTs shared title/text/url/files here.
// Stash the payload in a dedicated cache (fully offline-capable, no network
// call) and redirect to a GET page the existing cache-first handler below
// already serves — index.html picks the payload back up on load.
async function handleShareTarget(request){
  const cache = await caches.open(SHARE_CACHE_NAME);
  let title = '', text = '', url = '', storedCount = 0;
  try {
    const formData = await request.formData();
    title = formData.get('title') || '';
    text = formData.get('text') || '';
    url = formData.get('url') || '';
    const files = formData.getAll('files').filter((f) => f instanceof File);
    for(const file of files){
      try {
        // Only set Content-Type when the shared file actually reported one —
        // fabricating a value here would defeat index.html's own empty-MIME-type
        // extension fallback for files whose picker/content-provider left it blank.
        const headers = { 'X-Filename': encodeURIComponent(file.name) };
        if(file.type) headers['Content-Type'] = file.type;
        await cache.put(`file-${storedCount}`, new Response(file, { headers }));
        storedCount++;
      } catch(e){
        // Skip just this file (e.g. storage quota mid-batch) — don't let one
        // bad file lose the rest of the share.
        console.error('Failed to stage a shared file', e);
      }
    }
  } catch(e){
    console.error('Share target handling failed', e);
  }
  try {
    // Written last, with the actual stored count — so it never claims more
    // files are available than what really made it into the cache.
    await cache.put('meta', new Response(JSON.stringify({ title, text, url, fileCount: storedCount })));
  } catch(e){
    console.error('Failed to stage share metadata', e);
  }
  return Response.redirect('./index.html?shared=1#capture', 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if(request.method === 'POST' && url.pathname.endsWith('/index.html')){
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET') return;

  // A GET navigation to index.html with a query string (e.g. the share-target
  // redirect's ?shared=1) should resolve to the single precached shell entry
  // rather than falling through to network and caching a second, duplicate
  // entry per query variant.
  if(request.mode === 'navigate' && url.origin === self.location.origin && url.pathname.endsWith('/index.html')){
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
