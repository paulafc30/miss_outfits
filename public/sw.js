// Service worker mínimo para que la app sea instalable como PWA.
// Estrategia simple: network-first y cae al cache si no hay red.
const CACHE = 'miss-outfits-v6'
const ASSETS = ['/', '/armario', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => null))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  // No interceptar peticiones a Supabase ni a microlink
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null)
        return res
      })
      .catch(() => caches.match(request).then((m) => m || caches.match('/')))
  )
})
