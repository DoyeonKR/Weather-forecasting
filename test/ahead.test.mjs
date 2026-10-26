// 오늘 남은 시간 기준 강수 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'ahead.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { todayAhead } = mod.exports

const today = { tmax: 19, tmin: 13, precipSum: 4, precipProbMax: 66, code: 61, windMax: 9, gustMax: 28 }
const arr = (fill, at = {}) => Array.from({ length: 72 }, (_, i) => (i in at ? at[i] : fill))

test('아침에 온 비는 밤에는 세지 않는다', () => {
  // 오늘 8시(인덱스 32)에 66%·4mm, 지금 22시
  const wx = { today, nowHourLocal: 22, hourly: { prob: arr(0, { 32: 66 }), precip: arr(0, { 32: 4 }) } }
  const a = todayAhead(wx)
  assert.equal(a.precipProbMax, 0)
  assert.equal(a.precipSum, 0)
  assert.equal(a.tmax, 19) // 다른 값은 그대로
})

test('남은 시간에 비가 있으면 그만큼만', () => {
  const wx = { today, nowHourLocal: 14, hourly: { prob: arr(10, { 40: 70, 41: 50 }), precip: arr(0, { 40: 1.2, 41: 0.4 }) } }
  const a = todayAhead(wx)
  assert.equal(a.precipProbMax, 70)
  assert.equal(a.precipSum, 1.6)
})

test('시간별 확률이 없는 옛 캐시는 하루 값 그대로', () => {
  const wx = { today, nowHourLocal: 22, hourly: { precip: arr(0) } }
  assert.equal(todayAhead(wx), today)
})
