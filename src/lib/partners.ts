// 쿠팡 파트너스 날씨 연동 추천 (파트너스 ID: AF2713725)
// 링크는 반드시 파트너스 대시보드 "링크 생성"으로 만든 공식 단축링크여야 수수료가 집계됨.
// 링크가 비어 있는 항목은 화면에 표시되지 않음.
import type { DayStats } from './compare'

export interface PartnerItem {
  emoji: string
  label: string
  url: string
}

const LINKS = {
  umbrella: 'https://link.coupang.com/a/ggKhagRleu', // 우산
  sunscreen: 'https://link.coupang.com/a/ggKiJhjVNk', // 선크림
  fan: 'https://link.coupang.com/a/ggKkznhCkS', // 휴대용 선풍기
  hotpack: 'https://link.coupang.com/a/ggKlv86k44', // 핫팩
  outer: 'https://link.coupang.com/a/ggKne0I1fg', // 경량 겉옷
}

/** 오늘 날씨 조건에 맞는 추천 상품 (최대 2개) */
export function partnerPicks(opts: {
  today: DayStats
  uvMax: number | null
}): PartnerItem[] {
  const { today, uvMax } = opts
  const picks: PartnerItem[] = []
  const rains = today.precipSum >= 0.5 || (today.precipProbMax ?? 0) >= 60
  // 강풍이면 팁에서 '우산 대신 우비' 라고 안내한다. 같은 화면에서 장우산을 권하면 앞뒤가 안 맞는다
  const strongWind = (today.gustMax ?? 0) >= 60 || (today.windMax ?? 0) >= 40
  if (rains && !strongWind && LINKS.umbrella)
    picks.push({ emoji: '☂️', label: '튼튼한 장우산 보러가기', url: LINKS.umbrella })
  if ((uvMax ?? 0) >= 6 && LINKS.sunscreen)
    picks.push({ emoji: '🧴', label: '선크림 보러가기', url: LINKS.sunscreen })
  if (today.tmax >= 30 && LINKS.fan)
    picks.push({ emoji: '🌀', label: '휴대용 선풍기 보러가기', url: LINKS.fan })
  if (today.tmin <= 3 && LINKS.hotpack)
    picks.push({ emoji: '🔥', label: '핫팩 보러가기', url: LINKS.hotpack })
  // 하한이 없으면 아침 영하 10도에도 '가벼운 겉옷' 을 권하게 된다. 그 온도는 핫팩 담당
  if (today.tmin <= 8 && today.tmin >= -3 && LINKS.outer)
    picks.push({ emoji: '🧥', label: '가벼운 겉옷 보러가기', url: LINKS.outer })
  return picks.slice(0, 2)
}

export const PARTNERS_NOTICE =
  '이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

/** 노출할 링크가 하나라도 등록되어 있는지 */
export function partnersActive(): boolean {
  return Object.values(LINKS).some((v) => v.length > 0)
}
