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
