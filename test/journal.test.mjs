import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const built = esbuild.buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/journal.ts', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { artworkName, skyAssetName, moveDetailSection, DETAIL_KEYS } = mod.exports

test('낮·밤·흐림·비·눈·안개를 실제 SVG 에셋으로 연결한다', () => {
  const cases = [
    ['sun', '맑음', true, 'sun'], ['sun', '맑음', false, 'moon'],
    ['sun', '대체로 맑음', true, 'partly-cloudy'], ['cloud', '흐림', true, 'cloud'],
    ['rain', '비', true, 'rain'], ['snow', '눈', false, 'snow'],
    ['storm', '뇌우', true, 'storm'], ['cloud', '안개', true, 'fog'],
  ]
  for (const [tone, label, day, expected] of cases) {
    const name = artworkName(tone, label, day)
    assert.equal(name, expected)
    assert.ok(existsSync(new URL(`../public/icons/journal/${name}.svg`, import.meta.url)))
  }
  for (const name of ['up', 'down', 'same']) {
    assert.ok(existsSync(new URL(`../public/icons/journal/trend-${name}.svg`, import.meta.url)))
  }
})

test('궂은 날은 밤이어도 비·눈 사진을 우선하고, 모든 사진이 존재한다', () => {
  for (const [tone, day, expected] of [
    ['sun', true, 'morning-sky'], ['cloud', false, 'night-sky'],
    ['rain', false, 'rain-sky'], ['storm', true, 'rain-sky'], ['snow', false, 'snow-sky'],
  ]) {
    const name = skyAssetName(tone, day)
    assert.equal(name, expected)
    assert.ok(existsSync(new URL(`../public/images/weather-journal/${name}.webp`, import.meta.url)))
  }
})

test('상세 순서를 바꿔도 고정 섹션·기존 키·원본 배열을 보존한다', () => {
  const saved = ['hero', 'hourly', 'air', 'prep', 'compare', 'tomorrow', 'week', 'sun', 'radar', 'places']
  const before = [...saved]
  const moved = moveDetailSection(saved, 0, 4)
  assert.deepEqual(saved, before)
  assert.deepEqual(moved.filter(k => DETAIL_KEYS.includes(k)), ['prep', 'compare', 'sun', 'places', 'air'])
  saved.forEach((key, i) => { if (!DETAIL_KEYS.includes(key)) assert.equal(moved[i], key) })
  assert.equal(new Set(moved).size, saved.length)
  assert.deepEqual(moveDetailSection(saved, 0, -1), saved)
  assert.deepEqual(moveDetailSection(saved, 4, 5), saved)
})
