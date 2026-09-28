// 기상청 기상특보 발효 현황 프록시 — 공공데이터포털 키는 서버에만 보관
// GET → { tmFc, items: [{ kind, areas: [{ name, subs: string[] }] }] }
// 원문(t6)은 "o 호우주의보 : 경기도(수원, 성남), 서울동남권" 같은 줄글이라 여기서 구조로 바꾼다.
// 주의: DATAGO_KMA_KEY 는 이미 URL 인코딩된 형태라 재인코딩 없이 붙인다
const KEY = Deno.env.get('DATAGO_KMA_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

interface Area {
  name: string
  subs: string[]
}

/** "경기도(수원, 성남), 서울동남권" → [{name:'경기도', subs:['수원','성남']}, {name:'서울동남권', subs:[]}] */
export function parseAreas(text: string): Area[] {
  const out: Area[] = []
  let depth = 0
  let buf = ''
  const push = () => {
    const s = buf.trim()
    buf = ''
    if (!s) return
    const m = s.match(/^([^(]+)\((.*)\)$/)
    if (m) out.push({ name: m[1].trim(), subs: m[2].split(',').map((x) => x.trim()).filter(Boolean) })
    else out.push({ name: s, subs: [] })
  }
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) push()
    else buf += ch
  }
  push()
  return out
}

/** t6 원문 → 특보 종류별 구역 */
export function parseStatus(t6: string): { kind: string; areas: Area[] }[] {
  const items: { kind: string; areas: Area[] }[] = []
  for (const raw of t6.split(/\r?\n/)) {
    const line = raw.replace(/^\s*o\s*/, '').trim()
    const m = line.match(/^([^:：]+)[:：](.+)$/)
    if (!m) continue
    const kind = m[1].trim()
    if (!/(주의보|경보)$/.test(kind)) continue
    items.push({ kind, areas: parseAreas(m[2].trim()) })
  }
  return items
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const api =
    'https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus' +
    `?serviceKey=${KEY}&pageNo=1&numOfRows=10&dataType=JSON`
  let data: unknown
  let snippet = ''
  try {
    const res = await fetch(api)
    const text = await res.text()
    snippet = text.slice(0, 200)
    try {
      data = JSON.parse(text)
    } catch {
      // 키가 이 서비스에 등록되지 않았으면 XML 오류가 온다
      const reason = text.match(/<returnAuthMsg>([^<]+)</)?.[1] ?? text.match(/<errMsg>([^<]+)</)?.[1] ?? 'non-json'
      return new Response(JSON.stringify({ error: reason, snippet }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream', detail: String(e).slice(0, 120) }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const d = data as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: unknown } } } }
  const code = d?.response?.header?.resultCode
  // 03 = NODATA: 발효 중인 특보가 없다 (정상)
  if (code === '03') {
    return new Response(JSON.stringify({ tmFc: null, items: [] }), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
    })
  }
  if (code !== '00') {
    return new Response(JSON.stringify({ error: d?.response?.header?.resultMsg ?? 'bad response', code, snippet }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const raw = d?.response?.body?.items?.item
  const first = (Array.isArray(raw) ? raw[0] : raw) as { t6?: string; tmFc?: number | string } | undefined
  const body = {
    tmFc: first?.tmFc ? String(first.tmFc) : null,
    items: parseStatus(first?.t6 ?? ''),
  }
  return new Response(JSON.stringify(body), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
  })
})
