// 특보 구역 매칭 · 출퇴근 · 체감 보정 · 평년 표 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const libDir = path.join(here, '..', 'src', 'lib')
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  stdin: {
    contents:
      "export { areaMatches, matchWarnings, coreNames } from './warn'\n" +
      "export { commuteSlots } from './commute'\n" +
      "export { nextOffset, feelLabel } from './feel'\n" +
      "export { buildTable } from './normals'\n",
    resolveDir: libDir,
    loader: 'ts',
  },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { areaMatches, matchWarnings, coreNames, commuteSlots, nextOffset, feelLabel, buildTable } = mod.exports

test('동네 이름에서 행정 접미사를 뗀다', () => {
  assert.deepEqual(coreNames('서울특별시 마포구'), ['서울', '마포'])
  assert.deepEqual(coreNames('성남시 분당구 판교동'), ['성남', '분당', '판교'])
})

test('시·군 목록이 있으면 그 목록으로만 판단', () => {
  const gg = { name: '경기도', subs: ['수원', '성남', '가평'] }
  assert.equal(areaMatches(gg, '성남시 분당구 판교동'), true)
  assert.equal(areaMatches(gg, '경기도 고양시'), false)
  const gw = { name: '강원도', subs: ['강릉평지', '속초평지'] }
  assert.equal(areaMatches(gw, '강원특별자치도 강릉시'), true)
})

test('권역 이름만 있으면 같은 도시로 본다, 바다 구역은 뺀다', () => {
  assert.equal(areaMatches({ name: '서울동남권', subs: [] }, '서울 (기본 위치)'), true) // 구를 모르면 서울 전체
  assert.equal(areaMatches({ name: '제주도남부', subs: [] }, '제주특별자치도 서귀포시'), true)
  assert.equal(areaMatches({ name: '서해중부앞바다', subs: [] }, '인천광역시 중구'), false)
  assert.equal(areaMatches({ name: '부산', subs: [] }, '서울특별시 마포구'), false)
})

test('경보가 주의보보다 먼저', () => {
  const hits = matchWarnings(
    [
      { kind: '건조주의보', areas: [{ name: '서울서북권', subs: [] }] },
      { kind: '호우경보', areas: [{ name: '서울서북권', subs: [] }] },
      { kind: '풍랑주의보', areas: [{ name: '동해중부앞바다', subs: [] }] },
    ],
    '서울특별시 마포구',
  )
  assert.deepEqual(hits.map((h) => h.kind), ['호우경보', '건조주의보'])
})

test('출퇴근: 지난 시각은 내일 것, 하루 전 같은 시각과 짝', () => {
  const temp = Array.from({ length: 72 }, (_, i) => i) // 인덱스 = 값
  const wx = { hourly: { temp, precip: Array(72).fill(0), code: Array(72).fill(0), time: [] }, nowHourLocal: 12, nowCode: 0 }
  const s = commuteSlots(wx, { on: true, am: 8, pm: 18 })
  assert.deepEqual(
    s.map((x) => [x.kind, x.day, x.temp, x.prev]),
    [
      ['퇴근', '오늘', 42, 18],
      ['출근', '내일', 56, 32],
    ],
  )
})

test('체감 보정은 답할수록 따라가고 ±4 에서 멈춘다', () => {
  assert.equal(nextOffset(0, 'cold'), -1.5)
  assert.equal(nextOffset(-1.5, 'ok'), -1.1)
  let o = 0
  for (let i = 0; i < 20; i++) o = nextOffset(o, 'hot')
  assert.equal(o, 4)
  assert.equal(feelLabel(0.2), null)
  assert.match(feelLabel(-2), /추위/)
})

test('평년 표: 앞뒤 3일 창으로 평균', () => {
  const dates = ['2020-03-01', '2020-03-02', '2021-03-01']
  const t = buildTable(dates, [10, 12, 14], [0, 2, 4])
  assert.deepEqual(t['03-01'], [12, 2, 2])
})

test('서울은 구로 권역을 가른다', () => {
  assert.equal(areaMatches({ name: '서울서북권', subs: [] }, '서울특별시 마포구'), true)
  assert.equal(areaMatches({ name: '서울동남권', subs: [] }, '서울특별시 마포구'), false)
  assert.equal(areaMatches({ name: '서울동남권', subs: [] }, '서울특별시 송파구'), true)
  assert.equal(areaMatches({ name: '서울서북권', subs: [] }, '서울특별시 중구'), true)
})
