import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const built = esbuild.buildSync({
  stdin: { contents: "export * from './weatherScene'; export { fetchWeather } from './weather'", resolveDir: fileURLToPath(new URL('../src/lib', import.meta.url)), loader: 'ts' },
  bundle: true, format: 'cjs', platform: 'node', write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { buildWeatherScene, observedSceneCode, particleBudget, loadWeatherMotion, saveWeatherMotion, fetchWeather } = mod.exports

test('맑은 낮·밤, 구름, 비, 눈, 안개, 뇌우를 구분하고 실제 사진을 연결한다', () => {
  for (const [code, day, kind] of [[0, true, 'clear-day'], [0, false, 'clear-night'], [2, true, 'partly-cloudy'], [3, false, 'cloudy'], [45, true, 'fog'], [61, true, 'rain'], [73, false, 'snow'], [85, true, 'snow'], [95, false, 'thunder']]) {
    const scene = buildWeatherScene(code, day)
    assert.equal(scene.kind, kind)
    assert.ok(existsSync(new URL(`../public/images/weather-journal/${scene.sky}.webp`, import.meta.url)))
  }
  assert.equal(buildWeatherScene(2, false).sky, 'night-sky')
})

test('바람은 강수와 별개로 네 단계이며 현재 돌풍도 반영한다', () => {
  assert.equal(buildWeatherScene(0, true, 0).windLevel, 0)
  assert.equal(buildWeatherScene(0, true, 10).windLevel, 1)
  assert.equal(buildWeatherScene(61, true, 28).windLevel, 2)
  assert.equal(buildWeatherScene(73, true, 50).windLevel, 3)
  assert.equal(buildWeatherScene(0, true, 3, 45).windLevel, 2)
  assert.equal(buildWeatherScene(0, true, 3, 70).windLevel, 3)
  assert.equal(buildWeatherScene(0, true, null, NaN).windLevel, 0)
  assert.equal(buildWeatherScene(0, true, -5).windKmh, 0)
  assert.equal(buildWeatherScene(0, true, 1000).windKmh, 250)
})

test('실황 비·눈을 반영하되 비 관측이 뇌우를 덮어쓰지 않는다', () => {
  assert.equal(observedSceneCode(0, 1), 61)
  assert.equal(observedSceneCode(95, 1), 95)
  assert.equal(observedSceneCode(0, 7), 73)
  assert.equal(observedSceneCode(2, null), 2)
  assert.equal(observedSceneCode(3, 0), 3)
})

test('약한 비·눈은 입자를 줄이고, 작은 화면과 4K 화면의 입자 수를 제한한다', () => {
  assert.ok(buildWeatherScene(51, true).intensity < buildWeatherScene(65, true).intensity)
  assert.ok(particleBudget(390, 700, true, 1.4) < 44)
  assert.equal(particleBudget(3840, 2160, true, 1.4), 44)
  assert.equal(particleBudget(3840, 2160, false, 1.4), 72)
  assert.equal(particleBudget(0, 0, false, 1), 12)
})

test('배경 효과 선택을 저장하고 저장소가 차단되어도 안전하다', () => {
  const previous = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  try {
    assert.equal(loadWeatherMotion(), true)
    saveWeatherMotion(false); assert.equal(loadWeatherMotion(), false)
    saveWeatherMotion(true); assert.equal(loadWeatherMotion(), true)
    globalThis.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    assert.equal(loadWeatherMotion(), true)
    assert.doesNotThrow(() => saveWeatherMotion(false))
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})

test('현재 풍속·돌풍을 km/h로 요청하고 예보 결과에 보존한다', async () => {
  const previous = globalThis.fetch
  let url
  const values = value => Array(9).fill(value)
  globalThis.fetch = async input => {
    url = new URL(input)
    return { ok: true, json: async () => ({
      current: { time: '2026-10-28T12:00', temperature_2m: 14, apparent_temperature: 12, relative_humidity_2m: 50, weather_code: 3, is_day: 1, wind_speed_10m: 28, wind_gusts_10m: 46 },
      hourly: { time: [], temperature_2m: Array(48).fill(12), precipitation: [], weather_code: [] },
      daily: { time: values('2026-10-28'), temperature_2m_max: values(15), temperature_2m_min: values(7), precipitation_sum: values(0), precipitation_probability_max: values(0), weather_code: values(3), uv_index_max: values(2), wind_speed_10m_max: values(40), wind_gusts_10m_max: values(60) },
    }) }
  }
  try {
    const wx = await fetchWeather(37.5, 127)
    assert.equal(wx.nowWind, 28); assert.equal(wx.nowGust, 46)
    assert.equal(url.searchParams.get('wind_speed_unit'), 'kmh')
    assert.ok(url.searchParams.get('current').includes('wind_gusts_10m'))
    assert.equal(buildWeatherScene(wx.nowCode, wx.nowIsDay, wx.nowWind, wx.nowGust).windLevel, 2)
  } finally { globalThis.fetch = previous }
})
