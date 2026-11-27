// 배포된 웹이 바뀌었는지 — 앱이 예전 코드를 계속 쓰던 것 (freshWeb)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'freshWeb.ts')], bundle: true, format: 'cjs', platform: 'node', write: false, define: { 'import.meta.env.PROD': 'false', 'import.meta.env.BASE_URL': '"/"' } })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { bundleOf, shouldReload } = mod.exports

const html = (h) => `<html><head><script type="module" crossorigin src="/Weather-forecasting/assets/index-${h}.js"></script></head></html>`

test('번들 이름 읽기', () => {
  assert.equal(bundleOf(html('CKBhTD32')), 'index-CKBhTD32.js')
  assert.equal(bundleOf('https://doyeonkr.github.io/Weather-forecasting/assets/index-Ab_9-x.js'), 'index-Ab_9-x.js')
  assert.equal(bundleOf('<script src="/src/main.tsx">'), null)
})

test('서버 번들이 바뀌었으면 새로 불러온다, 같으면 그대로', () => {
  const cur = 'index-OLD11111.js'
  assert.equal(shouldReload(cur, html('NEW22222'), null), true)
  assert.equal(shouldReload(cur, html('OLD11111'), null), false)
})

test('같은 새 번들로 이미 한 번 새로 불렀으면 다시 안 한다 (무한 새로 고침 방지), 더 새 번들이면 한다', () => {
  const cur = 'index-OLD11111.js'
  assert.equal(shouldReload(cur, html('NEW22222'), 'index-NEW22222.js'), false)
  assert.equal(shouldReload(cur, html('NEW33333'), 'index-NEW22222.js'), true)
})

test('모르면 새로 부르지 않는다 (개발 서버·HTML 이상)', () => {
  assert.equal(shouldReload(null, html('NEW22222'), null), false)
  assert.equal(shouldReload('index-OLD11111.js', '<html>오류</html>', null), false)
})

test('HTML 에 미리 받기 링크가 앞에 있어도 <script src> 의 번들을 본다', () => {
  const h = '<link rel="modulepreload" href="/Weather-forecasting/assets/index-PRELOAD1.js"><script type="module" crossorigin src="/Weather-forecasting/assets/index-MAIN2222.js"></script>'
  assert.equal(bundleOf(h), 'index-MAIN2222.js')
})
