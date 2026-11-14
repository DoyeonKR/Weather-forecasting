// 응답이 오지 않는 요청이 첫 화면을 붙잡지 않는지 — 시간 제한(본문 포함)·두 길·실패 이유
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const load = (file) => {
  const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', file)], bundle: true, format: 'cjs', platform: 'node', write: false })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
  return mod.exports
}
const { fetchJsonTimeout, FetchFail, isTimeout } = load('src/lib/http.ts')
const { fetchForecast } = load('src/lib/weather.ts')

const realFetch = globalThis.fetch
const abortErr = () => new DOMException('aborted', 'AbortError')
/** 응답 머리가 영영 오지 않는다 (실제 브라우저처럼 끊기면 반응) */
const hangHeaders = (_u, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(abortErr())))
/** 머리는 왔는데 본문이 멈춘다 — 약한 신호에서 흔한 경우 */
const hangBody = async (_u, init) =>
  new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"current":'))
        init?.signal?.addEventListener('abort', () => c.error(abortErr()))
      },
    }),
    { status: 200 },
  )
const OK = { current: { time: '2026-11-14T10:00' }, hourly: { time: [] }, daily: { time: [] } }
const ok = async () => new Response(JSON.stringify(OK), { status: 200 })
const isProxy = (u) => String(u).includes('weather-forecast')
const URL0 = new URL('https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127')
const withFetch = async (fn, body) => {
  globalThis.fetch = fn
  try {
    await body()
  } finally {
    globalThis.fetch = realFetch
  }
}

test('응답 머리가 안 와도, 본문이 멈춰도 정해진 시간에 timeout 으로 끝난다', async () => {
  for (const stub of [hangHeaders, hangBody]) {
    await withFetch(stub, async () => {
      const t0 = Date.now()
      await assert.rejects(fetchJsonTimeout('https://x.test', 120), (e) => e instanceof FetchFail && e.reason === 'timeout')
      assert.ok(Date.now() - t0 < 1500)
    })
  }
})

test('서버 오류는 http + 상태 코드, 연결 실패는 network, 시간 초과만 isTimeout', async () => {
  await withFetch(async () => new Response('', { status: 429 }), async () => {
    await assert.rejects(fetchJsonTimeout('https://x.test', 1000), (e) => e.reason === 'http' && e.status === 429 && !isTimeout(e))
  })
  await withFetch(async () => {
    throw new TypeError('Failed to fetch')
  }, async () => {
    await assert.rejects(fetchJsonTimeout('https://x.test', 1000), (e) => e.reason === 'network' && !isTimeout(e))
  })
  assert.ok(isTimeout(new DOMException('t', 'TimeoutError')))
})

test('바로 가는 길이 빠르면 우회 길은 열지 않는다', async () => {
  let proxyCalls = 0
  await withFetch(async (u, i) => (isProxy(u) ? (proxyCalls++, ok()) : ok(u, i)), async () => {
    const notes = []
    await fetchForecast(URL0, (n) => notes.push(n))
    assert.equal(proxyCalls, 0)
    assert.deepEqual(notes, [{ via: 'direct', firstFail: null, status: null }])
  })
})

test('바로 가는 길의 본문이 멈추면 3.5초 뒤 우회 길로 받는다', async () => {
  await withFetch(async (u, i) => (isProxy(u) ? ok() : hangBody(u, i)), async () => {
    const t0 = Date.now()
    const notes = []
    const d = await fetchForecast(URL0, (n) => notes.push(n))
    assert.ok(d.current)
    assert.equal(notes[0].via, 'proxy')
    const ms = Date.now() - t0
    assert.ok(ms >= 3000 && ms < 6000, `${ms}ms`)
  })
})

test('바로 가는 길이 429 로 바로 실패하면 기다리지 않고 우회 길로, 이유를 남긴다', async () => {
  await withFetch(async (u) => (isProxy(u) ? ok() : new Response('', { status: 429 })), async () => {
    const t0 = Date.now()
    const notes = []
    await fetchForecast(URL0, (n) => notes.push(n))
    assert.ok(Date.now() - t0 < 1000)
    assert.deepEqual(notes, [{ via: 'proxy', firstFail: 'http', status: 429 }])
  })
})

test('두 길이 다 실패하면 실패로 끝난다 (영영 기다리지 않는다)', async () => {
  await withFetch(async (u) => new Response('', { status: isProxy(u) ? 502 : 503 }), async () => {
    // weather.ts 는 따로 묶여서 FetchFail 클래스가 다른 사본이다 → 내용으로 본다
    await assert.rejects(fetchForecast(URL0), (e) => e.reason === 'http' && e.status === 503)
  })
})
