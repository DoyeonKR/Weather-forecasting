// 실패한 선택 호출을 잠시 쉬는 로직 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'backoff.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { isBackedOff, markFailed, markOk } = mod.exports

// 브라우저 저장소 흉내
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
}

test('실패하면 15분 쉬고, 지나면 다시 시도한다', () => {
  const t0 = 1_000_000
  assert.equal(isBackedOff('air-korea', t0), false)
  markFailed('air-korea', undefined, t0)
  assert.equal(isBackedOff('air-korea', t0 + 14 * 60_000), true)
  assert.equal(isBackedOff('air-korea', t0 + 15 * 60_000 + 1), false)
})

test('이름별로 따로, 성공하면 바로 풀린다', () => {
  const t0 = 2_000_000
  markFailed('kma-warn', 60_000, t0)
  assert.equal(isBackedOff('air-korea', t0 + 1), false)
  assert.equal(isBackedOff('kma-warn', t0 + 1), true)
  markOk('kma-warn')
  assert.equal(isBackedOff('kma-warn', t0 + 1), false)
})

test('저장소가 막혀 있어도 던지지 않는다', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
  assert.doesNotThrow(() => markFailed('x'))
  assert.equal(isBackedOff('x'), false)
  assert.doesNotThrow(() => markOk('x'))
})
