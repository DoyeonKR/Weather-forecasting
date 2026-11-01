// 알림 기본값 테스트 — 새로 켜면 조건 알림 전부 ON, 시간만 바꾸면 고른 값 유지
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
  define: { 'import.meta.env.PROD': 'false', 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"' },
})

/** 브라우저 흉내: 캐시·구독·서버 호출 기록 */
function setup({ existing = null, stored = {} } = {}) {
  const store = new Map(Object.entries(stored))
  const calls = []
  const sub = (endpoint) => ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(20) } }),
    unsubscribe: async () => true,
  })
  let current = existing ? sub(existing) : null
  const reg = {
    pushManager: {
      getSubscription: async () => current,
      subscribe: async () => (current = current ?? sub('https://push.example/new-endpoint')),
    },
  }
  const g = {
    navigator: { serviceWorker: { ready: Promise.resolve(reg), getRegistration: async () => reg }, userAgent: '', platform: '', maxTouchPoints: 0 },
    window: { setTimeout, matchMedia: () => ({ matches: false }) },
    Notification: { requestPermission: async () => 'granted', permission: 'granted' },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    caches: {
      open: async () => ({
        match: async (u) => (store.has(u) ? new Response(store.get(u)) : undefined),
        put: async (u, r) => void store.set(u, await r.text()),
        delete: async (u) => store.delete(u),
      }),
    },
    fetch: async (url, init) => {
      calls.push({ rpc: String(url).split('/').pop(), body: JSON.parse(init.body) })
      return new Response('true', { status: 200 })
    },
  }
  const mod = { exports: {} }
  const names = Object.keys(g)
  new Function('module', 'exports', 'require', ...names, built.outputFiles[0].text)(mod, mod.exports, require, ...names.map((n) => g[n]))
  return { push: mod.exports, calls, store }
}
const loc = { lat: 37.5, lon: 127, label: '서울' }

test('새로 켜면 비·미세먼지·폭염한파가 모두 켜지고, 고른 말투는 유지', async () => {
  const { push, calls } = setup({ stored: { 'https://eojeboda.local/push-alerts': JSON.stringify({ persona: 'bro', air: false, temp: false }) } })
  assert.equal(await push.enableNotify(loc), 'ok')
  assert.deepEqual(calls.find((c) => c.rpc === 'weather_push_set_rain').body.p_on, true)
  const prefs = calls.find((c) => c.rpc === 'weather_push_set_prefs').body
  assert.deepEqual([prefs.p_persona, prefs.p_alert_air, prefs.p_alert_temp], ['bro', true, true])
  assert.equal(await push.getRainAlert(), true)
  const a = await push.getPushAlerts()
  assert.deepEqual([a.air, a.temp], [true, true])
})

test('이미 켠 사람이 시간만 바꾸면 끈 항목이 다시 켜지지 않는다', async () => {
  const { push, calls } = setup({
    existing: 'https://push.example/old-endpoint',
    stored: { 'https://eojeboda.local/push-alerts': JSON.stringify({ persona: 'default', air: false, temp: true }) },
  })
  assert.equal(await push.enableNotify(loc, '2200', '0800'), 'ok')
  assert.equal(calls.find((c) => c.rpc === 'weather_push_set_rain'), undefined)
  const prefs = calls.find((c) => c.rpc === 'weather_push_set_prefs').body
  assert.deepEqual([prefs.p_alert_air, prefs.p_alert_temp], [false, true])
})
