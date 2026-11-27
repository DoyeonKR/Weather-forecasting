// 시간대별 카드 "비" 줄: 칸별 3시간 강수량 합, 다음 비 묶음
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'rainLane.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { columnPrecip, nextRain, mm } = mod.exports

test('칸마다 그 시각부터 3시간 합 (예전엔 한 시간치만)', () => {
  //          0    1    2    3    4    5    6    7    8
  const p = [0, 0.2, 0.3, 1.0, 1.5, 0.5, 0, null, 0]
  assert.deepEqual(columnPrecip(p, [0, 3, 6], 3), [0.5, 3, 0])
})

test('배열 끝을 넘는 칸은 있는 만큼만, 음수·null 은 무시', () => {
  assert.deepEqual(columnPrecip([0, -1, 2], [1], 3), [2])
})

test('다음 비: 처음 비 오는 칸과 이어지는 동안의 합', () => {
  assert.deepEqual(nextRain([0, 0, 0.05, 0, 1.2, 2.4, 0.3, 0, 5]), { k: 4, total: 3.9 })
  assert.equal(nextRain([0, 0.05, 0]), null)
})

test('강수량 표기', () => {
  assert.equal(mm(0.4), '0.4mm')
  assert.equal(mm(3.6), '4mm')
})

test('"비" 줄 안내: 지금 관측된 비가 가장 먼저 (예보 양 0이어도)', () => {
  const { laneNote } = mod.exports
  const pr = [0, 0, 0, 0, 0, 0, 0, 0, 0.6]
  const prob = [61, 44, 20, null, 0, 0, 0, 0, 30]
  assert.deepEqual(laneNote(pr, prob, { raining: true, rn1: 0.5 }, 6, 5), { kind: 'now', mm: 0.5 })
  assert.deepEqual(laneNote(pr, prob, { raining: true, rn1: 0 }, 6, 5), { kind: 'now', mm: null })
})

test('"비" 줄 안내: 확률은 높은데 양이 0이면 "비 올 수 있어요" (며칠 뒤 다음 비보다 먼저)', () => {
  const { laneNote } = mod.exports
  const pr = [0, 0, 0, 0, 0, 0, 0, 0, 0.6]
  assert.deepEqual(laneNote(pr, [61, 44, 20, 0, 0, 0, 0, 0, 30], { raining: false, rn1: 0 }, 6, 5), { kind: 'chance', prob: 61 })
  // 확률이 낮으면 다음 비
  assert.deepEqual(laneNote(pr, [30, 20, 0, 0, 0, 0, 0, 0, 30], null, 6, 5), { kind: 'next', k: 8, total: 0.6 })
  // 앞쪽 7번째 칸 이후의 높은 확률은 보지 않는다
  assert.deepEqual(laneNote(pr, [0, 0, 0, 0, 0, 0, 0, 80, 30], null, 6, 5), { kind: 'next', k: 8, total: 0.6 })
})

test('"비" 줄 안내: 곧 오는 비는 막대가 보이니 안내 없음, 아무것도 없으면 null', () => {
  const { laneNote } = mod.exports
  assert.equal(laneNote([0, 0, 1.2, 0, 0, 0], [70, 80, 90, 0, 0, 0], null, 6, 5), null)
  assert.equal(laneNote([0, 0, 0, 0, 0, 0], [10, 0, 0, 0, 0, 0], null, 6, 5), null)
})
