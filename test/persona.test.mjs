// 말투 문구와 상단 배너 경고 카드 테스트
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
const { say, PERSONAS } = load('supabase/functions/_shared/persona.ts')
const { alertBrief } = load('src/lib/brief.ts')

const day = (o = {}) => ({ tmax: 14, tmin: 6, precipSum: 0, precipProbMax: 10, code: 1, ...o })

test('말투마다 문구가 다르고, 모르는 값은 기본 말투', () => {
  assert.equal(say('default', 'umbrella'), '우산 챙기세요!')
  assert.equal(say('grandma', 'umbrella'), '우산 챙겨가라 이 육시랄 놈아!')
  assert.match(say('bro', 'umbrella'), /우산/)
  assert.equal(say('community', 'umbrella'), '우산 안 챙기면 ㄹㅇ 젖음 ㅋㅋ')
  assert.equal(PERSONAS.length, 4)
  assert.equal(say('이상한값', 'umbrella'), '우산 챙기세요!')
  assert.equal(say(undefined, 'mask'), '마스크 챙기세요!')
})

test('문구는 배너 한 줄에 들어가는 길이', () => {
  for (const { id } of PERSONAS) {
    for (const line of ['umbrella', 'snow', 'mask', 'cold', 'hot', 'uv', 'coat', 'light']) {
      assert.ok(say(id, line).length <= 20, `${id}/${line}: ${say(id, line)}`)
    }
  }
})

test('배너 카드: 급한 순서대로 하나만', () => {
  assert.equal(alertBrief(day(), false, 0, 'default'), null)
  const rain = alertBrief(day({ precipProbMax: 80, precipSum: 3, code: 61 }), false, 3, 'grandma')
  assert.deepEqual([rain.title, rain.sub], ['우산 챙겨가라 이 육시랄 놈아!', '오늘 강수확률 80%'])
  assert.equal(alertBrief(day({ code: 71, precipProbMax: 90 }), false, 0, 'default').title, say('default', 'snow'))
  assert.equal(alertBrief(day({ tmax: 34 }), false, 0, 'bro').title, say('bro', 'hot'))
  assert.equal(alertBrief(day({ tmin: -7 }), false, 0, 'default').sub, '오늘 아침 최저 -7°')
  assert.equal(alertBrief(day(), false, 2, 'default').sub, '지금 미세먼지 나쁨')
})

test('밤에는 내일 기준으로 말한다', () => {
  assert.equal(alertBrief(day({ precipProbMax: 70 }), true, null, 'default').sub, '내일 강수확률 70%')
})
