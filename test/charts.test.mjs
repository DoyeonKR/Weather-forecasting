import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const built = require('esbuild').buildSync({
  stdin: {
    contents: "export { PrecipCompare, WindCompare, TempRangeBars } from './CompareGraphic'; export { default as HourlyCard } from './HourlyCard'; export { AirCard } from './Extras'; export { temperatureBands } from '../lib/chartBands'",
    resolveDir: fileURLToPath(new URL('../src/components', import.meta.url)), loader: 'tsx',
  },
  bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/Weather-forecasting/') },
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { PrecipCompare, WindCompare, TempRangeBars, HourlyCard, AirCard, temperatureBands } = mod.exports
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))
const stats = { tmin: 5, tmax: 15, precipSum: 0, precipProbMax: 0, code: 0, windMax: null, gustMax: null }

test('강수량 0은 작은 막대도 그리지 않고 실제 강수만 그린다', () => {
  const dry = render(PrecipCompare, { today: stats, yesterday: stats })
  assert.ok(!dry.includes('class="precip-bar'))
  const wet = render(PrecipCompare, { today: { ...stats, precipSum: 2 }, yesterday: stats })
  assert.ok(wet.includes('class="precip-bar today"'))
  assert.ok(!wet.includes('class="precip-bar yesterday"'))
})

test('풍속 자료 없음과 0km/h를 구별하고 빈 막대를 그리지 않는다', () => {
  const html = render(WindCompare, { today: stats, yesterday: { ...stats, windMax: 0, gustMax: 0 } })
  assert.ok(html.includes('자료 없음'))
  assert.ok(html.includes('0km/h · 돌풍 0'))
  assert.ok(!html.includes('class="precip-bar'))
})

test('시간별 강수 컬러 그라데이션은 인스턴스별 ID를 써 서로 충돌하지 않는다', () => {
  const time = Array.from({ length: 72 }, (_, i) => new Date(Date.UTC(2026, 10, 1, i)).toISOString().slice(0, 16))
  const wx = { nowCode: 0, nowHourLocal: 0, hourly: {
    time, temp: time.map((_, i) => i < 24 ? 10 : i < 36 ? 8 : 12),
    precip: time.map((_, i) => i === 27 ? 2 : 0), code: time.map(() => 0),
  } }
  const html = renderToStaticMarkup(createElement(Fragment, null,
    createElement(HourlyCard, { wx }), createElement(HourlyCard, { wx })))
  const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map(m => m[1])
  assert.equal(ids.length, 2)
  assert.equal(new Set(ids).size, 2)
  for (const id of ids) assert.ok(html.includes(`fill:url(#${id})`))
  assert.ok(html.includes('class="hs-axis"'))
  assert.ok(html.includes('강수량'))
  assert.ok(html.includes('hs-line-halo'))
  assert.ok(html.includes('코랄 실선'))
})

test('기온·강수·풍속 범례는 각 지표의 실제 컬러와 연결한다', () => {
  for (const [Component, kind] of [[TempRangeBars, 'temp'], [PrecipCompare, 'rain'], [WindCompare, 'wind']]) {
    const html = render(Component, { today: stats, yesterday: stats })
    assert.ok(html.includes(`chart-legend--${kind}`))
  }
})

test('기온 선이 교차하면 두 면을 정확히 나눠 빨강·파랑을 반대로 칠하지 않는다', () => {
  const bands = temperatureBands([8, 12], [10, 10], i => i * 100, t => 100 - t)
  assert.deepEqual(bands.map(b => b.cls), ['cold', 'warm'])
  assert.ok(bands[0].d.includes('L50 90'))
  assert.ok(bands[1].d.startsWith('M50 90'))
  assert.deepEqual(temperatureBands([12, 8], [10, 10], i => i, t => t).map(b => b.cls), ['warm', 'cold'])
  assert.deepEqual(temperatureBands([10, 10], [10, 10], i => i, t => t).map(b => b.cls), ['same'])
  assert.equal(temperatureBands([NaN, 12], [10, 10], i => i, t => t).length, 0)
})

test('미세먼지 등급 막대에 등급 이름과 다음 날 예보를 명시한다', () => {
  const html = render(AirCard, { air: {
    pm10: 50, pm25: 20, grade: 1, gradeYest: null, pm25Yest: null, worse: null,
    outlook: [{ hour: 2, grade: 2, nextDay: true }],
  } })
  assert.ok(html.includes('air-gauge-labels'))
  assert.ok(html.includes('등급별 구간'))
  assert.ok(html.includes('내일 2시'))
})
