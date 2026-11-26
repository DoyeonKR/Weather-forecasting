// 앱 안 업데이트: 버전 비교 · 릴리스 응답 해석 · 배너 띄울지
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'appUpdate.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  external: ['@capacitor/core'],
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_RELEASES_API': 'undefined' },
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { parseVersion, isNewer, latestFromRelease, shouldOffer, LEGACY_APP_VERSION } = mod.exports

const release = (o = {}) => ({
  tag_name: 'android-v1.0.108',
  body: '- 위젯 디자인 새로\n- 글 잘림 수정',
  draft: false,
  prerelease: false,
  assets: [{ name: 'eojeboda-weather.apk' }],
  ...o,
})

test('버전 읽기: 태그·v 접두어·이상한 값', () => {
  assert.deepEqual(parseVersion('android-v1.0.108'), [1, 0, 108])
  assert.deepEqual(parseVersion('1.0.9'), [1, 0, 9])
  assert.equal(parseVersion('1.0'), null)
  assert.equal(parseVersion(''), null)
})

test('버전 비교는 숫자로 (문자열이면 1.0.9 > 1.0.108 이 된다)', () => {
  assert.equal(isNewer('1.0.108', '1.0.9'), true)
  assert.equal(isNewer('1.0.108', '1.0.108'), false)
  assert.equal(isNewer('1.0.107', '1.0.108'), false)
  assert.equal(isNewer('2.0.0', '1.9.999'), true)
  assert.equal(isNewer('엉망', '1.0.0'), false)
})

test('릴리스 해석: 안드로이드 태그 + APK 가 있을 때만', () => {
  assert.deepEqual(latestFromRelease(release()), { version: '1.0.108', notes: '위젯 디자인 새로' })
  assert.equal(latestFromRelease(release({ tag_name: 'v1.0.108' })), null) // 웹 릴리스
  assert.equal(latestFromRelease(release({ assets: [] })), null) // APK 를 아직 안 올렸다
  assert.equal(latestFromRelease(release({ draft: true })), null)
  assert.equal(latestFromRelease(null), null)
  assert.equal(latestFromRelease({ message: 'API rate limit exceeded' }), null)
})

test('긴 릴리스 노트 첫 줄은 줄인다', () => {
  const r = latestFromRelease(release({ body: '## ' + '가'.repeat(60) }))
  assert.equal(r.notes.length, 40)
  assert.ok(r.notes.endsWith('…'))
})

test('배너: 더 새 버전이고 닫은 적 없을 때만', () => {
  const latest = { version: '1.0.108', notes: '' }
  assert.equal(shouldOffer(LEGACY_APP_VERSION, latest, null), true) // 첫 앱(플러그인 없음)에도 알린다
  assert.equal(shouldOffer('1.0.108', latest, null), false)
  assert.equal(shouldOffer('1.0.106', latest, '1.0.108'), false) // 닫았다
  assert.equal(shouldOffer('1.0.106', { version: '1.0.109', notes: '' }, '1.0.108'), true) // 더 새 버전이면 다시
  assert.equal(shouldOffer('1.0.106', null, null), false)
})
