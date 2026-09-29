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
      "export { buildTable } from './normals'\n" +
      "export { summarizeRain } from './rainSoon'\n" +
      "export { placeLabel } from './places'\n",
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
const { areaMatches, matchWarnings, coreNames, commuteSlots, nextOffset, feelLabel, buildTable, summarizeRain, placeLabel } = mod.exports

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

// ── 레이더 위 "곧 비가 올까?" 문장
const T0 = 1_000_000_000
const slots = (n) => Array.from({ length: n }, (_, i) => T0 + i * 900)

test('비 없음: 앞으로 3시간 소식 없음', () => {
  const r = summarizeRain(slots(16), Array(16).fill(0), T0 + 300, false)
  assert.equal(r.raining, false)
  assert.match(r.text, /3시간 비 소식이 없어요/)
  assert.equal(r.jumpTo, null)
})

test('곧 시작: 분 단위로 말하고 그 시각으로 넘길 수 있다', () => {
  const p = Array(16).fill(0)
  p[3] = 0.6 // 2.4mm/h → 보통 비
  const r = summarizeRain(slots(16), p, T0 + 300, false)
  assert.equal(r.raining, false)
  assert.match(r.text, /약 40분 뒤.*비가 시작/)
  assert.equal(r.jumpTo, T0 + 3 * 900)
})

test('내리는 중: 세기와 그치는 때', () => {
  const p = Array(16).fill(0)
  p[1] = 0.2 // 0.8mm/h → 약한 비
  p[2] = 0.2
  const r = summarizeRain(slots(16), p, T0 + 900 + 60, false)
  assert.equal(r.raining, true)
  assert.match(r.text, /약한 비가 내리고 있어요.*약 30분 뒤/)
})

test('계속 내리면 이어진다고 말하고 넘길 시각은 없다', () => {
  const r = summarizeRain(slots(16), Array(16).fill(0.5), T0 + 60, false)
  assert.equal(r.raining, true)
  assert.match(r.text, /이어질 것 같아요/)
  assert.equal(r.jumpTo, null)
})

test('기상청 실황이 있으면 지금 여부는 실황이 이긴다', () => {
  const dry = Array(16).fill(0)
  assert.equal(summarizeRain(slots(16), dry, T0 + 60, false, true).raining, true)
  const wet = Array(16).fill(0.5)
  const r = summarizeRain(slots(16), wet, T0 + 60, false, false)
  assert.equal(r.raining, false) // 실황은 안 온다 → 예보의 다음 칸에서 시작을 찾는다
  assert.match(r.text, /비가 시작/)
})

test('영하 근처면 눈, 자료가 없으면 null', () => {
  const p = Array(16).fill(0)
  p[4] = 0.3
  assert.match(summarizeRain(slots(16), p, T0 + 60, true).text, /눈이 시작/)
  assert.equal(summarizeRain([], [], T0, false), null)
})

test('장소 이름: 도로·역이 아니라 시·구·동으로', () => {
  assert.equal(placeLabel({ country_code: 'kr', city: '성남시', borough: '분당구', suburb: '판교', quarter: '백현동' }, 'x'), '성남시 분당구 판교')
  assert.equal(placeLabel({ country_code: 'kr', city: '부산광역시', borough: '해운대구' }, 'x'), '부산광역시 해운대구')
  assert.equal(placeLabel({ country_code: 'kr', state: '제주특별자치도' }, 'x'), '제주특별자치도')
  // 시·군과 읍·면이 같이 오면 시·군까지 (읍·면은 이름이 겹치기 쉬워 "판교면"만으론 어디인지 모른다)
  assert.equal(placeLabel({ country_code: 'kr', county: '서천군', town: '판교면' }, 'x'), '서천군 판교면')
})

test('장소 이름: 해외는 나라부터, 같은 이름 반복 없음', () => {
  assert.equal(placeLabel({ country_code: 'jp', country: '일본', city: '도쿄도' }, 'x'), '일본 도쿄도')
  assert.equal(placeLabel({ country_code: 'us', country: '미국', state: '텍사스', town: 'Paris', county: 'Lamar County' }, 'x'), '미국 텍사스 Paris')
  assert.equal(placeLabel({ country_code: 'fr', country: '프랑스', state: '일드프랑스', city: '파리', suburb: '파리' }, 'x'), '프랑스 일드프랑스 파리')
  assert.equal(placeLabel(undefined, '판교, 분당구, 성남시, 경기도, 13525, 대한민국'), '성남시 분당구 판교')
})
