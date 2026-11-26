// 날씨 아이콘 색 계열 (iconTone) — 시간대별·주간·출퇴근 아이콘 색
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'weatherIcon.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  external: ['@phosphor-icons/react', 'react'],
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, () => ({}))
const { iconTone } = mod.exports

test('맑음: 낮은 해, 밤은 달', () => {
  assert.equal(iconTone('맑음', true), 'sun')
  assert.equal(iconTone('맑음', false), 'night')
  assert.equal(iconTone('대체로 맑음', true), 'sun')
})

test('구름 조금은 낮엔 해+구름, 밤엔 달 / 흐림·구름 많음은 구름', () => {
  assert.equal(iconTone('구름 조금', true), 'partly')
  assert.equal(iconTone('구름 조금', false), 'night')
  assert.equal(iconTone('흐림', true), 'cloud')
  assert.equal(iconTone('흐림', false), 'cloud')
})

test('비·눈·뇌우·안개는 밤낮 상관없이 그 색', () => {
  assert.equal(iconTone('약한 비', false), 'rain')
  assert.equal(iconTone('소나기', true), 'rain')
  assert.equal(iconTone('눈', true), 'snow')
  assert.equal(iconTone('소낙눈', true), 'snow')
  assert.equal(iconTone('뇌우', false), 'storm')
  assert.equal(iconTone('안개', true), 'fog')
})
