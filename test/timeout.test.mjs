// 응답이 오지 않는 요청이 첫 화면을 붙잡지 않는지 — 시간 제한·재시도·실패 이유
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
const { fetchTimeout, FetchFail } = load('src/lib/http.ts')

const realFetch = globalThis.fetch
/** 끊길 때까지 영영 오지 않는 요청 (실제 브라우저처럼 abort 에는 반응한다) */
const hang = (_url, init) =>
  new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))

test('응답이 안 오면 정해진 시간에 끊고 timeout 으로 알린다', async () => {
  globalThis.fetch = hang
  try {
    const t0 = Date.now()
    await assert.rejects(fetchTimeout('https://x.test', 80), (e) => e instanceof FetchFail && e.reason === 'timeout')
    assert.ok(Date.now() - t0 < 1000)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('서버 오류는 http + 상태 코드, 연결 실패는 network', async () => {
  globalThis.fetch = async () => new Response('', { status: 429 })
  try {
    await assert.rejects(fetchTimeout('https://x.test', 1000), (e) => e.reason === 'http' && e.status === 429)
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    await assert.rejects(fetchTimeout('https://x.test', 1000), (e) => e.reason === 'network')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('날씨: 첫 시도가 막혀도 한 번 더 시도해서 받는다, 계속 막히면 실패로 끝난다', async () => {
  const { fetchWeather } = load('src/lib/weather.ts')
  // 첫 요청은 연결 실패, 두 번째는 400 — 두 번 시도했는지, 영영 기다리지 않는지
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    if (calls === 1) throw new TypeError('Failed to fetch')
    return new Response('', { status: 503 })
  }
  try {
    await assert.rejects(fetchWeather(37.5, 127), (e) => e instanceof Error && e.reason === 'http' && e.status === 503)
    assert.equal(calls, 2)
    // 주소가 잘못된 4xx 는 다시 해도 같으니 바로 실패
    calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response('', { status: 400 })
    }
    await assert.rejects(fetchWeather(37.5, 127))
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = realFetch
  }
})
