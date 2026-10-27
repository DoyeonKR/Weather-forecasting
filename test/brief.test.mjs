// 상단 브리핑 띠 문구 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'brief.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { buildBriefs, clockKo } = mod.exports

const KST = 9 * 3600
/** 서울 현지 'YYYY-MM-DDTHH:MM' → epoch ms */
const at = (s) => Date.parse(`${s}:00+09:00`)
const wx = (o = {}) => ({
  nowTemp: 14,
  yesterdaySameHour: 15.2,
  today: { tmax: 19, tmin: 13 },
  tomorrow: { tmax: 15.6, tmin: 5.2 },
  sun: { rise: '2026-10-26T06:50', set: '2026-10-26T17:41', riseTomorrow: '2026-10-27T06:51', setTomorrow: '2026-10-27T17:40' },
  utcOffsetSec: KST,
  week: [{ date: '2026-10-26' }],
  ...o,
})
const byId = (cards) => Object.fromEntries(cards.map((c) => [c.id, c]))

test('밤: 지금 비교·내일 낮·지난 일몰(과거형)·내일 일출', () => {
  const c = byId(buildBriefs(wx(), at('2026-10-26T22:15'), 0))
  assert.equal(c.now.title, '어제보다 1.2° 쌀쌀해요')
  assert.equal(c.now.image, 'cooler')
  assert.match(c.now.sub, /지금 14\.0° · 어제 이맘때 15\.2°/)
  assert.equal(c.tomorrow.title, '내일 낮은 3.4° 쌀쌀해요')
  assert.equal(c.tomorrow.sub, '아침은 7.8° 더 추워요')
  assert.equal(c.sunset.title, '오늘 해는 오후 5:41에 졌어요')
  assert.equal(c.sunset.sub, '내일은 오후 5:40에 져요')
  assert.equal(c.sunrise.title, '내일 해는 오전 6:51에 떠요')
})

test('오후: 일몰까지 남은 시간', () => {
  const c = byId(buildBriefs(wx(), at('2026-10-26T15:30'), 0))
  assert.equal(c.sunset.title, '오늘 해는 오후 5:41에 져요')
  assert.equal(c.sunset.sub, '일몰까지 2시간 10분 남았어요')
})

test('새벽: 오늘 일출', () => {
  const c = byId(buildBriefs(wx(), at('2026-10-26T05:00'), 0))
  assert.equal(c.sunrise.title, '오늘 해는 오전 6:50에 떠요')
  assert.equal(c.sunrise.sub, '일출까지 1시간 50분 남았어요')
})

test('차이가 거의 없으면 "비슷해요", 따뜻하면 warmer', () => {
  const c = byId(buildBriefs(wx({ nowTemp: 15, tomorrow: { tmax: 21.5, tmin: 13 } }), at('2026-10-26T12:00'), 0))
  assert.equal(c.now.title, '어제 이맘때와 비슷해요')
  assert.equal(c.tomorrow.title, '내일 낮은 2.5° 따뜻해요')
  assert.equal(c.tomorrow.image, 'warmer')
  assert.equal(c.tomorrow.sub, '낮 최고 22° · 아침 최저 13°') // 아침 차이 3° 미만이면 내일 기온만
})

test('옛 캐시: 내일 일출·오프셋 없음 → 내일 일출 카드는 건너뛰고 기기 시간대로', () => {
  const old = wx({ sun: { rise: '2026-10-26T06:50', set: '2026-10-26T17:41' }, utcOffsetSec: undefined })
  const c = byId(buildBriefs(old, at('2026-10-26T22:15'), KST))
  assert.equal(c.sunrise, undefined)
  assert.match(c.sunset.sub, /해 진 지/)
})

test('자정을 넘긴 캐시(데이터의 오늘 ≠ 현지 오늘)면 날짜 카드는 빼고 지금 비교만', () => {
  const ids = buildBriefs(wx(), at('2026-10-27T00:20'), 0).map((c) => c.id)
  assert.deepEqual(ids, ['now'])
})

test('다른 시간대 지역은 그 지역 시각으로 (도쿄도 +9, 파리 +1)', () => {
  const paris = wx({ utcOffsetSec: 3600, sun: { rise: '2026-10-26T08:20', set: '2026-10-26T18:00', riseTomorrow: '2026-10-27T08:21' } })
  // 서울 22:15 = 파리 14:15
  const c = byId(buildBriefs(paris, at('2026-10-26T22:15'), KST))
  assert.equal(c.sunset.title, '오늘 해는 오후 6:00에 져요')
  assert.equal(c.sunset.sub, '일몰까지 3시간 45분 남았어요')
})

test('값이 없으면 지어내지 않는다', () => {
  assert.deepEqual(buildBriefs(wx({ nowTemp: NaN, sun: undefined, tomorrow: undefined }), at('2026-10-26T12:00'), 0), [])
  assert.equal(clockKo('2026-10-26T00:05'), '오전 12:05')
})
