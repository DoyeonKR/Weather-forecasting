// 메인 아래 요약 카드 문구 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'impact.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { hourlyImpact, compareImpact, tomorrowImpact, weekImpact, sunImpact } = mod.exports

const day = (o = {}) => ({ tmax: 14, tmin: 6, precipSum: 0, precipProbMax: 10, code: 1, ...o })
const hourly = (fn) => {
  const n = 72
  return {
    time: Array.from({ length: n }, (_, i) => `t${i}`),
    temp: Array.from({ length: n }, (_, i) => 10 + (i % 24 === 15 ? 5 : 0)),
    precip: Array.from({ length: n }, () => 0),
    code: Array.from({ length: n }, () => 1),
    prob: Array.from({ length: n }, (_, i) => fn(i)),
  }
}

test('12시간: 비가 있으면 언제부터, 없으면 기온 폭과 가장 따뜻한 시각', () => {
  const rain = hourlyImpact({ nowHourLocal: 9, hourly: hourly((i) => (i === 24 + 13 ? 70 : 0)) })
  assert.deepEqual(rain, { value: '13시부터 비', sub: '강수확률 70%', tone: 'rain' })
  const dry = hourlyImpact({ nowHourLocal: 9, hourly: hourly(() => 0) })
  assert.equal(dry.value, '10° ~ 15°')
  assert.match(dry.sub, /15시 가장 따뜻/)
})

test('어제 비교·내일', () => {
  assert.deepEqual(compareImpact(day({ tmax: 10 }), day({ tmax: 14.3 })), { value: '▼4.3°', sub: '낮 최고가 어제보다 낮아요', tone: 'cold' })
  assert.equal(compareImpact(day(), day({ tmax: 14.2 })).value, '비슷해요')
  const t = tomorrowImpact(day({ tmax: 18, code: 0 }), day({ tmax: 14 }), [])
  assert.deepEqual([t.value, t.sub, t.tone], ['18° 맑음', '오늘보다 4° 높아요', 'warm'])
  assert.equal(tomorrowImpact(day(), day(), ['강풍 주의']).tone, 'warn')
})

test('이번 주: 다음 비 오는 날', () => {
  const week = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].map((date, i) => ({ date, stats: day({ precipProbMax: i === 2 ? 80 : 10 }) }))
  assert.deepEqual(weekImpact(week), { value: '목요일 비', sub: '강수확률 80%', tone: 'rain' })
  const dry = weekImpact(week.map((d) => ({ ...d, stats: day() })))
  assert.deepEqual([dry.value, dry.sub], ['비 소식 없음', '이번 주 6° ~ 14°'])
})

test('해: 다음 일출·일몰', () => {
  const wx = { sun: { rise: '2026-10-27T06:51', set: '2026-10-27T17:39', riseTomorrow: '2026-10-28T06:52' }, utcOffsetSec: 9 * 3600, uvMaxToday: 4 }
  const at = (s) => Date.parse(`${s}:00+09:00`)
  assert.deepEqual(sunImpact(wx, at('2026-10-27T12:00'), 0), { value: '오후 5:39', sub: '일몰 · 자외선 4', tone: 'ok' })
  assert.equal(sunImpact(wx, at('2026-10-27T22:00'), 0).sub, '내일 일출')
  assert.equal(sunImpact({ ...wx, sun: undefined }, at('2026-10-27T12:00'), 0), null)
})
