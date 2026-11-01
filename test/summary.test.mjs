// 메인 요약 8칸 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'summary.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { buildSummary } = mod.exports

const day = (o = {}) => ({ tmax: 14, tmin: 6, precipSum: 0, precipProbMax: 10, code: 1, ...o })
const glance = {
  headline: '',
  tiles: [
    { key: 'umbrella', label: '우산', value: '필요 없음', sub: '', tone: 'ok' },
    { key: 'outfit', label: '옷차림', value: '코트·패딩', sub: '', tone: 'info' },
    { key: 'air', label: '미세먼지', value: '나쁨', sub: '', tone: 'warn' },
  ],
}
const wx = (o = {}) => ({
  nowTemp: 2.1,
  yesterdaySameHour: 8.7,
  tomorrow: day({ tmax: 11.6 }),
  week: ['2026-10-29', '2026-10-30', '2026-10-31'].map((date) => ({ date, stats: day() })),
  sun: { rise: '2026-10-29T06:51', set: '2026-10-29T17:39', riseTomorrow: '2026-10-30T06:52' },
  utcOffsetSec: 9 * 3600,
  ...o,
})
const at = (s) => Date.parse(`${s}:00+09:00`)
const build = (o = {}) => {
  const list = buildSummary({ glance, forTomorrow: false, wx: wx(), raining: false, nowMs: at('2026-10-29T12:00'), deviceOffsetSec: 0, ...o })
  return Object.fromEntries(list.map((t) => [t.target, t]))
}

test('8칸이 섹션 8개와 하나씩 이어진다', () => {
  assert.deepEqual(Object.keys(build()), ['hourly', 'prep', 'air', 'compare', 'tomorrow', 'week', 'sun', 'radar'])
})

test('판정 3칸은 한 줄 결론과 같은 값, 어제·내일은 짧은 값', () => {
  const s = build()
  assert.equal(s.hourly.value, '필요 없음')
  assert.equal(s.prep.value, '코트·패딩')
  assert.deepEqual([s.air.value, s.air.tone], ['나쁨', 'warn'])
  assert.deepEqual([s.compare.value, s.compare.tone], ['7° 추워요', 'cold'])
  assert.equal(s.tomorrow.value, '12°')
  assert.equal(build({ wx: wx({ nowTemp: 8.5 }) }).compare.value, '비슷해요')
})

test('밤에는 우산·옷차림이 내일 기준임을 라벨로 밝힌다', () => {
  const s = build({ forTomorrow: true })
  assert.equal(s.hourly.label, '내일 우산')
  assert.equal(s.prep.label, '내일 옷차림')
  assert.equal(s.air.label, '미세먼지')
})

test('이번 주: 비 오는 날을 짧게, 없으면 비 없음', () => {
  assert.equal(build().week.value, '비 없음')
  const rainy = wx({ week: ['2026-10-29', '2026-10-30', '2026-10-31'].map((date, i) => ({ date, stats: day({ precipProbMax: i === 2 ? 80 : 10 }) })) })
  const s = build({ wx: rainy })
  assert.deepEqual([s.week.value, s.week.tone], ['토 비', 'rain'])
})

test('해: 다음 일출·일몰, 값이 없으면 지어내지 않는다', () => {
  assert.deepEqual([build().sun.label, build().sun.value], ['일몰', '17:39'])
  const night = build({ nowMs: at('2026-10-29T22:00') })
  assert.deepEqual([night.sun.label, night.sun.value], ['내일 일출', '06:52'])
  assert.equal(build({ wx: wx({ sun: undefined }) }).sun.value, '-')
})

test('레이더: 실황이 비면 비 와요', () => {
  assert.equal(build().radar.value, '지도 보기')
  assert.deepEqual([build({ raining: true }).radar.value, build({ raining: true }).radar.tone], ['비 와요', 'rain'])
})
