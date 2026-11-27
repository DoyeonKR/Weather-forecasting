// 날씨 알림 기준 지역 — 기본 지역을 따르고, 서울 기본 위치로 굳지 않는지
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'))
const built = esbuild.buildSync({ entryPoints: [path.join(here, '..', 'src', 'lib', 'notifyPlace.ts')], bundle: true, format: 'cjs', platform: 'node', write: false })
const mod = { exports: {} }
new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
const { notifyPlace, placeChanged, notifyPlaceName } = mod.exports

const busan = { id: 'p-busan', name: '부산 해운대구', lat: 35.16, lon: 129.16 }
const jeju = { id: 'p-jeju', name: '제주시', lat: 33.5, lon: 126.53 }
const suwon = { lat: 37.27, lon: 127.0, label: '수원시 매산로1가' }

test('기본 지역이 즐겨찾기면 그 즐겨찾기 (현재 위치·보고 있는 지역과 상관없이)', () => {
  assert.deepEqual(notifyPlace('p-jeju', [busan, jeju], suwon), { lat: 33.5, lon: 126.53, label: '제주시' })
})

test('기본 지역이 현재 위치면 실제로 받은 현재 위치', () => {
  assert.deepEqual(notifyPlace('current', [busan], suwon), suwon)
})

test('현재 위치를 모르면(권한 없음) 첫 즐겨찾기, 그것도 없으면 null (서울로 굳히지 않는다)', () => {
  assert.deepEqual(notifyPlace('current', [busan, jeju], null), { lat: 35.16, lon: 129.16, label: '부산 해운대구' })
  assert.equal(notifyPlace('current', [], null), null)
})

test('기본 지역 즐겨찾기를 지웠으면 현재 위치로', () => {
  assert.deepEqual(notifyPlace('p-gone', [busan], suwon), suwon)
})

test('서버에 서울(기본 위치)이 저장돼 있다가 실제 위치를 받으면 바뀐 것으로 본다', () => {
  const seoul = { p_lat: 37.5665, p_lon: 126.978, p_label: '서울 (기본 위치)' }
  assert.equal(placeChanged(seoul, suwon), true)
})

test('1km 안쪽 GPS 흔들림은 같은 곳, 이름이 바뀌면 다시 저장', () => {
  const saved = { p_lat: 37.27, p_lon: 127.0, p_label: '수원시 매산로1가' }
  assert.equal(placeChanged(saved, { lat: 37.274, lon: 127.004, label: '수원시 매산로1가' }), false)
  assert.equal(placeChanged(saved, { lat: 37.27, lon: 127.0, label: '수원시 매산로2가' }), true)
  assert.equal(placeChanged(null, suwon), true)
  assert.equal(placeChanged({}, suwon), true)
})

test('화면 이름: 기본 위치는 "서울"로', () => {
  assert.equal(notifyPlaceName(null), '서울')
  assert.equal(notifyPlaceName(suwon), '수원시 매산로1가')
})
