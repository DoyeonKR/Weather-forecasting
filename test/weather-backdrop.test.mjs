import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const built = esbuild.buildSync({
  entryPoints: [fileURLToPath(new URL('../src/components/WeatherBackdrop.tsx', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/Weather-forecasting/') },
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const WeatherBackdrop = mod.exports.default

test('메인 하늘 사진과 날씨 효과를 별도 레이어로 만들고 낮·밤·강수 사진을 유지한다', () => {
  for (const [kind, sky] of [['clear-day', 'morning-sky'], ['clear-night', 'night-sky'], ['rain', 'rain-sky'], ['snow', 'snow-sky']]) {
    const html = renderToStaticMarkup(createElement(WeatherBackdrop, {
      scene: { kind, sky, windLevel: 1, windKmh: 15, intensity: 1 }, paused: false,
    }))
    const photo = html.match(/<figure[^>]*>([\s\S]*?)<\/figure>/)?.[1]
    assert.ok(photo)
    assert.ok(photo.includes(`/Weather-forecasting/images/weather-journal/${sky}.webp`))
    assert.ok(!photo.includes('weather-atmosphere'), '효과를 사진 안에 넣어 덮개에 가리지 않는다')
    assert.match(html, /<\/figure><div[^>]*atmosphere-hero/)
    assert.match(html, /class="hero-photo is-still" data-animated="false" data-wind="1"/)
  }
})
