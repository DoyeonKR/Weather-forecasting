// 무능한 날씨예측기 서비스워커 — 네트워크 우선 캐시 + 푸시 알림 수신
const CACHE = 'eojeboda-v4'

self.addEventListener('push', (e) => {
  const data = { title: '무능한 날씨예측기', body: '' }
  try {
    // 제목이 빠진 페이로드에서도 기본값이 유지되도록 병합한다
    Object.assign(data, e.data.json())
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
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope
  e.waitUntil(
    // 이미 열린 창이 있으면 새 창 대신 그 창을 띄운다
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})

// 푸시 서비스가 구독을 갱신하면 endpoint 가 바뀐다.
// 앱이 열려 있지 않아도 여기서 다시 등록해야 알림이 끊기지 않는다.
const SB_URL = 'https://tqegatiuembcvphxmujl.supabase.co'
const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWdhdGl1ZW1iY3ZwaHhtdWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODgwMjMsImV4cCI6MjA5ODQ2NDAyM30.gEWhDmgJ5BVaobNobOP8LPZDeU_uIfYD4wE_ea1Rgmc'
const VAPID_PUBLIC =
  'BPoiXRatsIBxTbpFwTPoZ87skWs4-qKJsX3VVbZn1OS-8QigkrTI7FfZeN5Uq-SDWJaykFUdPXey0GfBdDrMU5g'
const PREFS_CACHE = 'eojeboda-push'
const PREFS_URL = 'https://eojeboda.local/push-prefs'

async function readPrefs() {
  try {
    const c = await caches.open(PREFS_CACHE)
    const hit = await c.match(PREFS_URL)
    return hit ? await hit.json() : null
  } catch {
    return null
  }
}

function vapidKey(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function resubscribe(oldSub) {
  const prefs = await readPrefs()
  // 지역·시간을 모르면 임의로 정해서 등록하지 않는다. 앱을 다시 열면 복구된다.
  if (!prefs) return
  // oldSubscription 을 주지 않는 브라우저가 있어 원래 키를 준비해 둔다
  const key = (oldSub && oldSub.options && oldSub.options.applicationServerKey) || vapidKey(VAPID_PUBLIC)
  const sub = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys) return
  const headers = {
    apikey: SB_ANON,
    Authorization: 'Bearer ' + SB_ANON,
    'Content-Type': 'application/json',
  }
  const next = Object.assign({}, prefs, {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
  })
  const res = await fetch(SB_URL + '/rest/v1/rpc/weather_push_save', {
    method: 'POST',
    headers,
    body: JSON.stringify(next),
  })
  if (!res.ok) return
  // 옛 endpoint 로 남은 행은 지운다 (그대로 두면 하루에 두 번 온다)
  if (oldSub && oldSub.endpoint && oldSub.endpoint !== j.endpoint) {
    await fetch(SB_URL + '/rest/v1/rpc/weather_push_remove', {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_endpoint: oldSub.endpoint }),
    }).catch(() => {})
  }
  const c = await caches.open(PREFS_CACHE)
  await c.put(PREFS_URL, new Response(JSON.stringify(next)))
}

self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(resubscribe(e.oldSubscription).catch(() => {}))
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== PREFS_CACHE).map((k) => caches.delete(k))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // 앱 자산만 캐시 (외부 API·타일은 항상 네트워크)
  if (url.origin !== self.location.origin) return
  // 해시가 박힌 자산은 내용이 바뀌면 이름도 바뀌므로 캐시를 먼저 쓴다 (첫 렌더가 빨라짐)
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok && res.type === 'basic' && !res.redirected) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }
  e.respondWith(
    fetch(request)
      .then((res) => {
        // 성공한 동일 출처 응답만 캐시에 넣는다 (404·리디렉션·공용 와이파이 로그인 페이지 방지)
        if (res.ok && res.type === 'basic' && !res.redirected) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error())),
  )
})
