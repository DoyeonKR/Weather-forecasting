// 앱 전체 말투 변환 테스트
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'voice.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { voice } = mod.exports

test('기본 말투는 글자 하나도 바꾸지 않는다', () => {
  for (const s of ['어제보다 1.1° 쌀쌀해요', '우산 챙기세요!', '코트나 패딩을 꺼낼 때가 됐습니다.']) assert.equal(voice('default', s), s)
})

test('어미가 없는 값·요로 끝나는 낱말은 그대로', () => {
  for (const p of ['grandma', 'bro', 'community']) {
    for (const s of ['좋음', '12°', '필요', '우산 필요', '토요일', '강수 0%', '이번 주', '코트·패딩']) assert.equal(voice(p, s), s)
  }
})

test('동네 형: 반말', () => {
  assert.equal(voice('bro', '쌀쌀해요'), '쌀쌀해')
  assert.equal(voice('bro', '우산 챙기세요'), '우산 챙기자')
  assert.equal(voice('bro', '단단히 입으세요'), '단단히 입자')
  assert.equal(voice('bro', '설정 봐주세요!'), '설정 봐줘!')
  assert.equal(voice('bro', '폭염이에요'), '폭염이야')
  assert.equal(voice('bro', '날이 맑습니다.'), '날이 맑다.')
  assert.equal(voice('bro', '꺼낼 때가 됩니다.'), '꺼낼 때가 된다.')
  assert.equal(voice('bro', '좋은 날입니다.'), '좋은 날이다.')
  assert.equal(voice('bro', '충분히 젖습니다'), '충분히 젖는다')
  assert.equal(voice('bro', '비가 많습니다'), '비가 많다')
  assert.equal(voice('bro', '비예요'), '비야')
})

test('커뮤니티: 음슴체', () => {
  assert.equal(voice('community', '추워요'), '추움')
  assert.equal(voice('community', '있어요'), '있음')
  assert.equal(voice('community', '나빠요'), '나쁨')
  assert.equal(voice('community', '비슷해요'), '비슷함')
  assert.equal(voice('community', '챙기세요'), '챙기셈')
  assert.equal(voice('community', '봐주세요'), '봐주셈')
  assert.equal(voice('community', '폭염이에요'), '폭염임')
  assert.equal(voice('community', '비가 아니에요'), '비가 아님')
  assert.equal(voice('community', '같은 시각입니다.'), '같은 시각임.')
  assert.equal(voice('community', '꼭 확인합니다'), '꼭 확인함')
  assert.equal(voice('community', '충분히 젖습니다'), '충분히 젖음')
  assert.match(voice('community', '비가 확실해요(확률 90%)'), /^비가 확실함\(확률 90%\) (ㅋㅋ|ㄹㅇ|ㅇㅈ\?|ㄷㄷ)$/)
})

test('욕쟁이 할머니: 긴 문장에만 꼬리말, 숫자는 그대로', () => {
  assert.equal(voice('grandma', '비슷해요'), '비슷혀')
  const s = voice('grandma', '어제보다 6.6° 쌀쌀해요')
  assert.match(s, /^어제보다 6\.6° 쌀쌀혀 (이놈아|이 화상아|이 썩을 놈아|이 육시랄 놈아|이 염병할 놈아)!$/)
  assert.equal(voice('grandma', '어제보다 6.6° 쌀쌀해요'), s) // 다시 그려도 같은 꼬리말
})

test('한 번 바꾼 글을 다시 넣어도 더 망가지지 않는다', () => {
  for (const p of ['bro', 'community']) {
    const once = voice(p, '내일 비 소식, 우산 꼭 챙기세요')
    assert.equal(voice(p, once), once)
  }
})

test('물음표 문장에는 꼬리말을 붙이지 않는다', () => {
  assert.equal(voice('grandma', '어제 날씨, 입은 옷에 비해 어땠어요?'), '어제 날씨, 입은 옷에 비해 어땠어?')
})
