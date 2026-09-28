// 람베르트 정각원추(LCC) 투영 테스트 — 레이더 오버레이 위치가 이 변환에 달려 있다
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'lcc.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { lccForward, lccInverse } = mod.exports

const POINTS = [
  [37.5665, 126.978], // 서울
  [35.1796, 129.0756], // 부산
  [33.4996, 126.5312], // 제주
  [37.4845, 130.9057], // 울릉도
  [38.2, 124.7], // 백령도 부근
]

test('정·역변환을 거치면 제자리로 (1cm 이내)', () => {
  for (const [lat, lon] of POINTS) {
    const { x, y } = lccForward(lat, lon)
    const back = lccInverse(x, y)
    assert.ok(Math.abs(back.lat - lat) < 1e-7, `lat ${lat} → ${back.lat}`)
    assert.ok(Math.abs(back.lon - lon) < 1e-7, `lon ${lon} → ${back.lon}`)
  }
})

test('중앙 경선(동경 126°) 위는 x = 0, 좌우 대칭', () => {
  assert.ok(Math.abs(lccForward(37, 126).x) < 1e-6)
  const e = lccForward(36, 128)
  const w = lccForward(36, 124)
  assert.ok(Math.abs(e.x + w.x) < 1e-6)
  assert.ok(Math.abs(e.y - w.y) < 1e-6)
})

test('북쪽일수록 y 가 크고, 한반도 부근 축척은 실제 거리와 몇 % 안쪽', () => {
  const a = lccForward(36.5, 127)
  const b = lccForward(37.5, 127)
  assert.ok(b.y > a.y)
  // 위도 1° ≈ 110.9km. 표준위선 30°·60° 사이라 축척이 1보다 조금 작다
  const d = Math.hypot(b.x - a.x, b.y - a.y) / 1000
  assert.ok(d > 100 && d < 112, `1° 간격 ${d.toFixed(1)}km`)
})
