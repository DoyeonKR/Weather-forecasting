// 첫 화면 한눈에 판정 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'glance.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { buildGlance } = mod.exports

const day = (o = {}) => ({ tmax: 14, tmin: 6, precipSum: 0, precipProbMax: 10, code: 1, ...o })
const tile = (g, k) => g.tiles.find((t) => t.key === k)

test('맑고 선선한 날: 우산 필요 없음(회색), 옷 결론', () => {
  const g = buildGlance({ day: day(), airGrade: 0 })
  assert.equal(g.headline, '오늘은 니트·자켓 차림이면 돼요')
  assert.deepEqual([tile(g, 'umbrella').value, tile(g, 'umbrella').tone], ['필요 없음', 'ok'])
  assert.equal(tile(g, 'umbrella').sub, '강수확률 10%')
  assert.equal(tile(g, 'outfit').sub, '낮 14° · 아침 6°')
  assert.deepEqual([tile(g, 'air').value, tile(g, 'air').tone], ['좋음', 'ok'])
})

test('비가 가장 먼저 — 미세먼지 나쁨보다 앞선다', () => {
  const g = buildGlance({ day: day({ precipProbMax: 70, precipSum: 4, code: 61 }), airGrade: 2 })
  assert.equal(g.headline, '오늘 비 소식, 우산 꼭 챙기세요')
  assert.equal(tile(g, 'umbrella').tone, 'rain')
  assert.deepEqual([tile(g, 'air').value, tile(g, 'air').sub, tile(g, 'air').tone], ['나쁨', '마스크 챙기기', 'warn'])
})

test('애매한 비는 작은 우산, 밤에는 내일 기준', () => {
  const g = buildGlance({ day: day({ tmax: 22, precipProbMax: 40 }), airGrade: 1, forTomorrow: true })
  assert.equal(g.headline, '내일은 가벼운 긴팔에 작은 우산 하나')
  assert.equal(tile(g, 'umbrella').value, '작은 우산')
  assert.equal(tile(g, 'air').sub, '지금 기준')
})

test('눈, 폭염, 영하는 강조', () => {
  assert.equal(buildGlance({ day: day({ code: 71, tmax: 1 }), airGrade: 0 }).headline, '오늘 눈 소식, 미끄럼 조심하세요')
  const hot = buildGlance({ day: day({ tmax: 34 }), airGrade: 0 })
  assert.equal(hot.headline, '오늘은 폭염, 한낮 외출을 줄이세요')
  assert.equal(tile(hot, 'outfit').tone, 'alert')
  assert.equal(buildGlance({ day: day({ tmax: -3 }), airGrade: 0 }).headline, '오늘은 영하권, 패딩 + 핫팩 단단히')
})

test('추위 타는 편이면 옷을 한 단계 따뜻하게, 미세먼지 모르면 정보 없음', () => {
  const g = buildGlance({ day: day({ tmax: 13 }), airGrade: null, feelOffset: -2 })
  assert.equal(tile(g, 'outfit').value, '코트·패딩')
  assert.equal(tile(g, 'air').value, '정보 없음')
})
