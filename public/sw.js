// 어제보다 서비스워커 — 네트워크 우선, 실패 시 캐시 (앱 셸 오프라인 대비)
const CACHE = 'eojeboda-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // 앱 자산만 캐시 (외부 API·타일은 항상 네트워크)
  if (url.origin !== self.location.origin) return
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy))
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error())),
  )
})
