// 말투별 대사 점검 — 길이, 자리표시자, 상황에 맞는 행동이 들어 있는지
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
const { SCRIPTS, personaScript } = load('src/lib/personaCopy.ts')
const { voice } = load('src/lib/voice.ts')
const { buildGlance } = load('src/lib/glance.ts')

const VARS = { when: '오늘', clothes: '니트·자켓', prob: 80, wind: 30, tmax: 14, tmin: 4, gap: 10, uv: 9 }
const day = (o = {}) => ({ tmax: 14, tmin: 6, precipSum: 0, precipProbMax: 10, code: 1, ...o })
const KINDS = ['snow', 'rain', 'hot', 'cold', 'air', 'wind', 'maybe', 'gap', 'uv', 'warm', 'mild', 'cool', 'freezing']

test('모든 말투가 모든 상황의 대사를 가지고, 길이가 알맞다', () => {
  for (const [persona, table] of Object.entries(SCRIPTS)) {
    assert.deepEqual(Object.keys(table).sort(), [...KINDS].sort(), persona)
    for (const kind of KINDS) {
      assert.ok(table[kind].length >= 2, `${persona}/${kind} 대사 수`)
      for (const line of table[kind]) {
        const filled = line.replace(/\{(\w+)\}/g, (_, k) => {
          assert.ok(k in VARS, `모르는 자리표시자 ${k}: ${line}`)
          return String(VARS[k])
        })
        assert.ok(filled.length >= 25 && filled.length <= 62, `길이 ${filled.length}: ${filled}`)
      }
    }
  }
})

test('대사는 왜 + 뭘 해라: 상황에 맞는 행동이 꼭 들어 있다', () => {
  const must = { rain: /우산/, air: /마스크|환기/, wind: /바람막이/, uv: /선크림/, gap: /겉옷|겹쳐/, maybe: /우산/ }
  for (const table of Object.values(SCRIPTS)) {
    for (const [kind, re] of Object.entries(must)) {
      for (const line of table[kind]) assert.match(line, re, `${kind}: ${line}`)
    }
  }
})

test('대사는 어미 변환을 거쳐도 그대로다 (이중 변환 방지)', () => {
  for (const [persona, table] of Object.entries(SCRIPTS)) {
    for (const kind of KINDS) {
      for (const line of table[kind]) assert.equal(voice(persona, line), line)
    }
  }
})

test('같은 날은 같은 대사, 날이 바뀌면 달라질 수 있다, 기본 말투는 대사 없음', () => {
  assert.equal(personaScript('grandma', 'rain', VARS, '2026-11-02'), personaScript('grandma', 'rain', VARS, '2026-11-02'))
  const seen = new Set(Array.from({ length: 30 }, (_, i) => personaScript('bro', 'rain', VARS, `2026-11-${i + 1}`)))
  assert.ok(seen.size >= 2)
  assert.equal(personaScript('default', 'rain', VARS, 'x'), null)
})

test('결론 고르기: 위험한 것 먼저, 겹치면 다음 것을 작은 줄로', () => {
  const g = buildGlance({ day: day({ precipProbMax: 80, precipSum: 3, code: 61, windMax: 35 }), airGrade: 3, persona: 'bro', seed: 'a' })
  assert.match(g.headline, /우산/)
  assert.match(g.note, /마스크|환기/)
})

test('바람 부는 날은 바람막이, 맑은 날은 옷 대사, 기본 말투는 그대로', () => {
  const windy = buildGlance({ day: day({ windMax: 30, gustMax: 50 }), airGrade: 0, persona: 'grandma', seed: 'a' })
  assert.match(windy.headline, /바람막이/)
  const calm = buildGlance({ day: day({ tmax: 14, tmin: 9 }), airGrade: 0, persona: 'community', seed: 'a' })
  assert.match(calm.headline, /니트·자켓/)
  assert.equal(calm.note, undefined)
  const plain = buildGlance({ day: day({ windMax: 30 }), airGrade: 0, seed: 'a' })
  assert.equal(plain.headline, '오늘은 니트·자켓 차림이면 돼요')
  assert.equal(plain.note, undefined)
})
