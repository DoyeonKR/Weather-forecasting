// 앱 안 브라우저 감지·"기본 브라우저로 열기" 주소 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'inapp.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { detectInApp, browserOpenUrl } = mod.exports

const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510630',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.3',
  naverAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.5.0)',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  genericWv:
    'Mozilla/5.0 (Linux; Android 12; Pixel 6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
}

test('앱 안 브라우저를 알아본다, 일반 브라우저는 아니다', () => {
  assert.equal(detectInApp(UA.kakaoAndroid).name, '카카오톡')
  assert.equal(detectInApp(UA.kakaoIos).name, '카카오톡')
  assert.equal(detectInApp(UA.naverAndroid).name, '네이버')
  assert.equal(detectInApp(UA.instagramIos).name, '인스타그램')
  assert.equal(detectInApp(UA.genericWv).name, '앱')
  assert.equal(detectInApp(UA.chromeAndroid), null)
  assert.equal(detectInApp(UA.safariIos), null)
})

test('카카오톡은 어디서나 공식 스킴으로, 안드로이드는 크롬 인텐트로', () => {
  const url = 'https://doyeonkr.github.io/Weather-forecasting/?ref=share'
  const k = browserOpenUrl(detectInApp(UA.kakaoIos), url)
  assert.equal(k, 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url))
  const n = browserOpenUrl(detectInApp(UA.naverAndroid), url)
  assert.match(n, /^intent:\/\/doyeonkr\.github\.io\/Weather-forecasting\/\?ref=share#Intent;scheme=https;package=com\.android\.chrome;/)
  assert.match(n, /S\.browser_fallback_url=https%3A%2F%2Fdoyeonkr\.github\.io/)
})

test('열 방법이 없는 환경(아이폰의 인스타그램 등)은 null → 메뉴 안내', () => {
  assert.equal(browserOpenUrl(detectInApp(UA.instagramIos), 'https://x.test/'), null)
})
