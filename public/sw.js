// 무능한 날씨예측기 서비스워커 — 네트워크 우선 캐시 + 푸시 알림 수신
const CACHE = 'eojeboda-v2'

self.addEventListener('push', (e) => {
  let data = { title: '무능한 날씨예측기', body: '' }
  try {
    data = e.data.json()
  } catch {
    // 텍스트 페이로드 대비
    data.body = e.data ? e.data.text() : ''
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icon.svg',
      badge: 'icon.svg',
      data: { url: self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || self.registration.scope))
})

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
