// 실용 멘트·추천 상품 판단 테스트
// TS 를 그대로 돌릴 러너가 없어서, vite 가 이미 들고 있는 esbuild 로 묶어서 불러온다.
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
    contents: "export { funTips } from './compare'\nexport { partnerPicks } from './partners'\n",
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
const { funTips, partnerPicks } = mod.exports

/** 기본값을 채운 하루치 통계 */
const day = (o) => ({
  tmax: 0,
  tmin: 0,
  precipSum: 0,
  precipProbMax: 0,
  code: 0,
  windMax: 0,
  gustMax: 0,
  ...o,
})
const titles = (tips) => tips.map((t) => t.title).join('|')
const bodies = (tips) => tips.map((t) => t.body).join(' ')

test('멘트는 최대 3개', () => {
  const tips = funTips({
    today: day({ tmax: 36, tmin: 27, precipProbMax: 70, code: 80, windMax: 45, gustMax: 58 }),
    yesterday: day({ tmax: 30, tmin: 24 }),
    uvMax: 9,
  })
  assert.ok(tips.length > 0 && tips.length <= 3, '개수: ' + tips.length)
})

test('강풍이 켜져도 혹한 안내는 밀리지 않는다', () => {
  const tips = funTips({
    today: day({ tmax: -6, tmin: -14, windMax: 42, gustMax: 58 }),
    yesterday: day({ tmax: 4, precipSum: 2 }),
    uvMax: null,
  })
  assert.match(titles(tips), /혹한/)
})

test('강풍이 켜져도 폭염 안내는 밀리지 않는다', () => {
  const tips = funTips({
    today: day({ tmax: 36, tmin: 27, precipProbMax: 70, code: 80, windMax: 45, gustMax: 58 }),
    yesterday: day({ tmax: 30, tmin: 24 }),
    uvMax: 9,
  })
  assert.match(titles(tips), /위험한 더위/)
})

test('어제 대비 급변 멘트가 절대 옷차림을 지시하지 않는다', () => {
  // 낮 9도인데 어제보다 8도 올라간 2월형 날씨
  const tips = funTips({
    today: day({ tmax: 9, tmin: 1 }),
    yesterday: day({ tmax: 1, tmin: -7 }),
    uvMax: null,
  })
  assert.doesNotMatch(bodies(tips), /한여름 모드/)
  // 낮 22도인데 어제보다 8도 떨어진 여름형 날씨
  const cool = funTips({
    today: day({ tmax: 22, tmin: 14 }),
    yesterday: day({ tmax: 30, tmin: 20 }),
    uvMax: null,
  })
  assert.doesNotMatch(bodies(cool), /한 단계 두껍게/)
})

test('강풍일 때 우비를 권하면서 우산을 같이 권하지 않는다', () => {
  const today = day({
    tmax: 6,
    tmin: 2,
    precipSum: 12,
    precipProbMax: 90,
    code: 65,
    windMax: 35,
    gustMax: 65,
  })
  const tips = funTips({ today, yesterday: day({ tmax: 8, tmin: 3 }), uvMax: null })
  assert.doesNotMatch(titles(tips), /우산 필수|우산 챙기기|접이식 우산|튼튼한 장우산/)
  const picks = partnerPicks({ today, uvMax: null })
  assert.ok(!picks.some((p) => p.label.includes('장우산')), '강풍인데 장우산 링크')
})

test('비가 안 오면 강풍 멘트에서 우비를 빼고 말한다', () => {
  const tips = funTips({
    today: day({ tmax: -6, tmin: -14, windMax: 42, gustMax: 58 }),
    yesterday: day({ tmax: 4 }),
    uvMax: null,
  })
  assert.doesNotMatch(bodies(tips), /우비/)
})

test('어제 눈이 왔고 오늘 영하면 빨래를 권하지 않는다', () => {
  const tips = funTips({
    today: day({ tmax: -2, tmin: -9 }),
    yesterday: day({ tmax: 0, tmin: -6, precipSum: 5, code: 73 }),
    uvMax: null,
  })
  assert.doesNotMatch(titles(tips), /빨래 찬스/)
  assert.doesNotMatch(bodies(tips), /어제 내리던 비/)
})

test('어는 비에는 빙판 경고가 나온다', () => {
  const tips = funTips({
    today: day({ tmax: 1, tmin: -3, precipSum: 3, precipProbMax: 85, code: 66 }),
    yesterday: day({ tmax: 5, tmin: 0 }),
    uvMax: null,
  })
  assert.match(titles(tips), /빙판/)
})

test('낮에 녹고 밤에 어는 눈도 빙판 경고 대상', () => {
  const tips = funTips({
    today: day({ tmax: 3, tmin: -5, precipSum: 4, precipProbMax: 80, code: 73 }),
    yesterday: day({ tmax: 6, tmin: 1 }),
    uvMax: null,
  })
  assert.match(titles(tips), /빙판길 주의/)
})

test('혹한에 가벼운 겉옷을 권하지 않는다', () => {
  const picks = partnerPicks({ today: day({ tmax: -6, tmin: -14 }), uvMax: null })
  assert.ok(!picks.some((p) => p.label.includes('가벼운 겉옷')), '영하 14도에 경량 아우터')
})

test('평범한 날에도 멘트가 하나는 나온다', () => {
  const tips = funTips({
    today: day({ tmax: 19, tmin: 8, precipProbMax: 10 }),
    yesterday: day({ tmax: 17, tmin: 7 }),
    uvMax: 5,
  })
  assert.ok(tips.length >= 1)
})
