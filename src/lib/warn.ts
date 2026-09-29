// 기상특보 — kma-warn 프록시가 기상청 발효 현황을 구역별로 나눠 주면,
// 지금 보는 지역 이름과 맞는 것만 골라 배너로 띄운다.
// ⚠ 특보 구역(예: 서울동남권, 경기도(수원, 성남))과 동네 이름은 1:1 대응표가 없다.
//   시·군 이름이 구역 목록에 있으면 확실히, 광역시·서울처럼 권역만 있으면 "그 도시 어딘가"로 본다.

import { isBackedOff, markFailed, markOk } from './backoff'

export interface WarnArea {
  name: string
  subs: string[]
}

export interface WarnItem {
  kind: string
  areas: WarnArea[]
}

export interface WarnHit {
  kind: string
  area: string
}

const PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/kma-warn'

const PROVINCES: string[][] = [
  ['서울'],
  ['부산'],
  ['대구'],
  ['인천'],
  ['광주'],
  ['대전'],
  ['울산'],
  ['세종'],
  ['경기'],
  ['강원'],
  ['충청북도', '충북'],
  ['충청남도', '충남'],
  ['전라북도', '전북'],
  ['전라남도', '전남'],
  ['경상북도', '경북'],
  ['경상남도', '경남'],
  ['제주'],
]

/** 기상청 서울 특보구역(4개 권역)과 자치구 — 권역만 발표되는 서울을 구 단위로 가른다 */
const SEOUL_ZONE: Record<string, string> = {
  강남: '서울동남권', 서초: '서울동남권', 송파: '서울동남권', 강동: '서울동남권',
  성동: '서울동북권', 광진: '서울동북권', 동대문: '서울동북권', 중랑: '서울동북권',
  성북: '서울동북권', 강북: '서울동북권', 도봉: '서울동북권', 노원: '서울동북권',
  양천: '서울서남권', 강서: '서울서남권', 구로: '서울서남권', 금천: '서울서남권',
  영등포: '서울서남권', 동작: '서울서남권', 관악: '서울서남권',
  종로: '서울서북권', 중: '서울서북권', 용산: '서울서북권', 은평: '서울서북권',
  서대문: '서울서북권', 마포: '서울서북권',
}

/** 라벨에서 서울 자치구의 권역 (서울이 아니거나 구를 모르면 null) */
export function seoulZone(label: string): string | null {
  if (!/서울/.test(label)) return null
  const gu = label.match(/([가-힣]+)구(?![가-힣])/)?.[1]
  return gu ? (SEOUL_ZONE[gu] ?? null) : null
}

/** "서울특별시 마포구" → ['서울','마포'] 처럼 행정 접미사를 뗀 이름들 */
export function coreNames(label: string): string[] {
  return label
    .replace(/\(.*?\)/g, ' ')
    .split(/[\s,]+/)
    .map((t) => t.replace(/(특별자치시|특별자치도|특별시|광역시|자치도|도|시|군|구|읍|면|동)$/, ''))
    .filter((t) => t.length >= 2)
}

function stripArea(s: string): string {
  return s.replace(/(평지|산지|북부|남부|동부|서부|중부|내륙|해안|동해안|서해안|남해안)$/, '')
}

/** 한 구역이 이 지역에 해당하는지 (순수 함수 — 테스트 대상) */
export function areaMatches(area: WarnArea, label: string): boolean {
  if (/바다/.test(area.name)) return false
  const cores = coreNames(label)
  if (area.subs.length > 0) {
    // 시·군 목록이 있으면 그 목록으로만 판단한다 (도 이름만 같다고 도 전체로 보지 않는다)
    return area.subs.some((sub) => {
      const s = stripArea(sub)
      return cores.some((c) => s === c || s.startsWith(c) || (s.length >= 2 && c.startsWith(s)))
    })
  }
  // 서울 권역은 구를 알면 정확히 가른다 (모르면 아래에서 서울 전체로 본다)
  if (/^서울.+권$/.test(area.name)) {
    const zone = seoulZone(label)
    if (zone) return zone === area.name
  }
  // "서울동남권", "제주도남부", "울릉도.독도" 처럼 목록 없이 권역 이름만 있는 경우
  if (cores.some((c) => area.name.startsWith(c))) return true
  const prov = PROVINCES.find((ps) => ps.some((p) => cores.some((c) => c.startsWith(p) || p.startsWith(c))))
  return !!prov && prov.some((p) => area.name.startsWith(p))
}

export function matchWarnings(items: WarnItem[], label: string): WarnHit[] {
  const hits: WarnHit[] = []
  for (const it of items) {
    const a = it.areas.find((ar) => areaMatches(ar, label))
    if (a) hits.push({ kind: it.kind, area: a.subs.length ? `${a.name}(${a.subs.find((s) => areaMatches({ name: a.name, subs: [s] }, label)) ?? ''})` : a.name })
  }
  // 경보를 주의보보다 앞에
  return hits.sort((x, y) => Number(y.kind.endsWith('경보')) - Number(x.kind.endsWith('경보')))
}

/** 발효 중인 특보 목록. 서비스가 막혀 있거나 실패하면 null (배너를 숨긴다) */
export async function fetchWarnings(): Promise<WarnItem[] | null> {
  // 서비스 승인 전에는 매번 502 — 잠시 쉬었다가 다시 시도한다 (lib/backoff)
  if (isBackedOff('kma-warn')) return null
  try {
    const res = await fetch(PROXY)
    if (!res.ok) {
      markFailed('kma-warn')
      return null
    }
    const d = await res.json()
    if (!Array.isArray(d?.items)) return null
    markOk('kma-warn')
    return d.items as WarnItem[]
  } catch {
    markFailed('kma-warn')
    return null
  }
}
