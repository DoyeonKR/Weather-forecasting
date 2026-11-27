// 안드로이드 앱 알림 문구(res/raw/persona_lines.json)가 persona.ts 와 같은지 — 다르면 node scripts/export-persona-lines.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { OUT, personaLinesJson } from '../scripts/export-persona-lines.mjs'

test('앱 알림 말투 문구 = persona.ts', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), personaLinesJson(), 'persona.ts 를 바꿨으면 node scripts/export-persona-lines.mjs 로 다시 만드세요')
})
