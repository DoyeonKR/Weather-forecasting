// 알림 말투 문구를 안드로이드 앱(res/raw/persona_lines.json)으로 내보낸다 — 앱 알림이 웹·서버와 같은 문구를 쓰게.
// 정본은 supabase/functions/_shared/persona.ts. 문구를 바꿨으면: node scripts/export-persona-lines.mjs
// (test/persona-lines.test.mjs 가 둘이 어긋나면 실패한다)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const OUT = path.join(root, 'android/app/src/main/res/raw/persona_lines.json')
const LINES = ['umbrella', 'snow', 'mask', 'cold', 'hot', 'uv', 'coat', 'light']

export function personaLinesJson() {
  const esbuild = require(path.join(root, 'node_modules', 'esbuild'))
  const built = esbuild.buildSync({
    entryPoints: [path.join(root, 'supabase/functions/_shared/persona.ts')],
    bundle: true, format: 'cjs', platform: 'node', write: false,
  })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require)
  const { PERSONAS, say } = mod.exports
  const out = {}
  for (const { id } of PERSONAS) out[id] = Object.fromEntries(LINES.map((l) => [l, say(id, l)]))
  return JSON.stringify(out, null, 2) + '\n'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(OUT, personaLinesJson())
  console.log('wrote', path.relative(root, OUT))
}
