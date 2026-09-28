// 대기질 등급·요약 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'air.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { gradePm10, gradePm25, gradeOf, summarizeAir } = mod.exports

test('환경부 등급 경계', () => {
  assert.deepEqual([30, 31, 80, 81, 150, 151].map(gradePm10), [0, 1, 1, 2, 2, 3])
  assert.deepEqual([15, 16, 35, 36, 75, 76].map(gradePm25), [0, 1, 1, 2, 2, 3])
  assert.equal(gradeOf(20, 40), 2) // 나쁜 쪽을 따른다
})

test('지금·어제 같은 시각·앞으로 나빠지는 시각', () => {
  const pm10 = Array(72).fill(20)
  const pm25 = Array(72).fill(10)
  const nowIdx = 24 + 9
  pm10[nowIdx - 24] = 90 // 어제 9시는 나쁨
  pm25[nowIdx + 5] = 50 // 14시에 나쁨
  const s = summarizeAir(pm10, pm25, nowIdx, (i) => i % 24)
  assert.equal(s.grade, 0)
  assert.equal(s.gradeYest, 2)
  assert.deepEqual(s.worse, { hour: 14, grade: 2 })
})

test('값이 없으면 null', () => {
  assert.equal(summarizeAir([null], [null], 0, () => 0), null)
})
