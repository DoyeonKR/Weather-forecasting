// 이미 켜 둔 날씨 알림의 지역 맞추기 (syncNotifyPlace) — 브라우저 API 를 흉내 내서 서버로 무엇을 보내는지 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'push.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  define: { 'import.meta.env.DEV': 'false' },
})

const PREFS_URL = 'https://eojeboda.local/push-prefs'
const SUWON = { lat: 37.27, lon: 127.0, label: '수원시 매산로1가' }
const SEOUL = { p_lat: 37.5665, p_lon: 126.978, p_label: '서울 (기본 위치)' }

/** 가짜 브라우저: 구독 하나, 캐시, localStorage, fetch 기록 */
function fakeBrowser({ subscribed = true, permission = 'granted', prefs = null, ls = {}, noPush = false } = {}) {
  const store = new Map()
  if (prefs) store.set(PREFS_URL, JSON.stringify(prefs))
  const calls = []
  let sub = subscribed
    ? {
        endpoint: 'https://push.example/sub-1',
        toJSON: () => ({ endpoint: 'https://push.example/sub-1', keys: { p256dh: 'P256', auth: 'AUTH' } }),
        unsubscribe: async () => {
          sub = null
          return true
        },
      }
    : null
  // noPush: 안드로이드 앱 웹뷰 — 서비스워커는 있는데 pushManager 가 없다
  const reg = noPush ? {} : { pushManager: { getSubscription: async () => sub } }
  const g = {
    window: { setTimeout, PushManager: function () {} },
    navigator: { serviceWorker: { getRegistration: async () => reg, ready: Promise.resolve(reg) } },
    Notification: { permission },
    localStorage: {
      getItem: (k) => (k in ls ? ls[k] : null),
      setItem: (k, v) => (ls[k] = String(v)),
      removeItem: (k) => delete ls[k],
    },
    caches: {
      open: async () => ({
        match: async (u) => (store.has(u) ? { json: async () => JSON.parse(store.get(u)) } : undefined),
        put: async (u, res) => store.set(u, await res.text()),
        delete: async (u) => store.delete(u),
      }),
    },
    Response: class {
      constructor(body) {
        this.body = body
      }
      async text() {
        return this.body
      }
    },
    fetch: async (url, init) => {
      const name = String(url).split('/').pop()
      calls.push({ name, body: init?.body ? JSON.parse(init.body) : null })
      // 실제 서버처럼 지우기에 시간이 걸린다 — 그 사이에 지역 맞추기가 끼어드는지 보려고
      if (name === 'weather_push_remove') await new Promise((r) => setTimeout(r, 30))
      return { ok: true, status: 200, json: async () => true, text: async () => '' }
    },
  }
  g.window.PushManager = function () {}
  const mod = { exports: {} }
  const fn = new Function(
    'module', 'exports', 'require', 'window', 'navigator', 'Notification', 'localStorage', 'caches', 'Response', 'fetch',
    built.outputFiles[0].text,
  )
  fn(mod, mod.exports, require, g.window, g.navigator, g.Notification, g.localStorage, g.caches, g.Response, g.fetch)
  // 'PushManager' in window 확인용
  globalThis.window = g.window
  return { push: mod.exports, calls, prefs: () => (store.has(PREFS_URL) ? JSON.parse(store.get(PREFS_URL)) : null) }
}

test('서울(기본 위치)로 저장된 구독 → 기본 지역으로 다시 저장, 시간은 그대로', async () => {
  const b = fakeBrowser({ prefs: { p_endpoint: 'https://push.example/sub-1', ...SEOUL, p_night_time: '2200', p_morning_time: '0630' } })
  assert.equal(await b.push.syncNotifyPlace(SUWON), 'updated')
  const save = b.calls.filter((c) => c.name === 'weather_push_save')
  assert.equal(save.length, 1)
  assert.deepEqual(
    { lat: save[0].body.p_lat, lon: save[0].body.p_lon, label: save[0].body.p_label, night: save[0].body.p_night_time, morning: save[0].body.p_morning_time },
    { lat: 37.27, lon: 127.0, label: '수원시 매산로1가', night: '2200', morning: '0630' },
  )
  // 서비스워커가 구독을 다시 만들 때 쓰는 값도 새 지역으로
  assert.equal(b.prefs().p_lat, 37.27)
})

test('이미 같은 지역이면 서버에 보내지 않는다', async () => {
  const b = fakeBrowser({ prefs: { p_endpoint: 'https://push.example/sub-1', p_lat: 37.27, p_lon: 127.0, p_label: '수원시 매산로1가', p_night_time: '2130', p_morning_time: '0730' } })
  assert.equal(await b.push.syncNotifyPlace(SUWON), 'same')
  assert.equal(b.calls.length, 0)
})

test('저장된 설정이 없으면 설정 화면의 시간(localStorage)으로', async () => {
  const b = fakeBrowser({ ls: { 'eojeboda:nighttime': '2300' } })
  assert.equal(await b.push.syncNotifyPlace(SUWON), 'updated')
  const body = b.calls.find((c) => c.name === 'weather_push_save').body
  assert.equal(body.p_night_time, '2300')
  assert.equal(body.p_morning_time, '0730')
})

test('알림을 안 켰거나(구독 없음) 권한이 없거나 지역을 모르면 아무것도 보내지 않는다', async () => {
  const none = fakeBrowser({ subscribed: false })
  assert.equal(await none.push.syncNotifyPlace(SUWON), 'no-sub')
  assert.equal(none.calls.length, 0)
  const denied = fakeBrowser({ permission: 'default' })
  assert.equal(await denied.push.syncNotifyPlace(SUWON), 'skipped')
  assert.equal(denied.calls.length, 0)
  const unknown = fakeBrowser({ prefs: { p_endpoint: 'https://push.example/sub-1', ...SEOUL } })
  assert.equal(await unknown.push.syncNotifyPlace(null), 'skipped')
  assert.equal(unknown.calls.length, 0)
})

test('끄기 바로 뒤에 지역 맞추기가 와도 지운 구독을 되살리지 않는다', async () => {
  const b = fakeBrowser({ prefs: { p_endpoint: 'https://push.example/sub-1', ...SEOUL, p_night_time: '2130', p_morning_time: '0730' } })
  const off = b.push.disableNotify()
  const sync = b.push.syncNotifyPlace(SUWON)
  assert.equal(await off, true)
  assert.equal(await sync, 'no-sub')
  assert.deepEqual(b.calls.map((c) => c.name), ['weather_push_remove'])
})

test('안드로이드 앱(웹뷰, pushManager 없음)에서 말투 바꾸기: 실패가 아니라 기기에만 저장 (예전엔 TypeError → "저장 실패")', async () => {
  const ls = {}
  const b = fakeBrowser({ noPush: true, ls })
  assert.equal(await b.push.setPushAlerts({ persona: 'grandma', air: false, temp: false }), 'no-sub')
  assert.equal(ls['eojeboda.persona'], 'grandma')
  assert.equal(b.calls.length, 0)
  // 같은 이유로 지역 맞추기·테스트 알림도 터지지 않는다
  assert.equal(await b.push.syncNotifyPlace({ lat: 37.27, lon: 127, label: '수원시' }), 'no-sub')
  assert.equal(await b.push.sendTestPush(), 'no-sub')
})
