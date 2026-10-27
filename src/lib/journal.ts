import { moveItem, type SectionKey } from './sections'

export const DETAIL_KEYS: readonly SectionKey[] = ['air', 'prep', 'compare', 'sun', 'places']

export function artworkName(tone: string, label: string, isDay: boolean): string {
  if (label.includes('안개')) return 'fog'
  if (tone !== 'sun') return tone
  if (!isDay) return 'moon'
  return label.includes('조금') || label.includes('대체로') ? 'partly-cloudy' : 'sun'
}

export function skyAssetName(tone: string, isDay: boolean): string {
  if (tone === 'snow') return 'snow-sky'
  if (tone === 'rain' || tone === 'storm') return 'rain-sky'
  return isDay ? 'morning-sky' : 'night-sky'
}

/** 상세만 이동한다. 기존에 저장된 전체 순서와 고정 섹션 키는 잃지 않는다. */
export function moveDetailSection(order: SectionKey[], from: number, to: number): SectionKey[] {
  const details = moveItem(order.filter((key) => DETAIL_KEYS.includes(key)), from, to)
  let index = 0
  return order.map((key) => DETAIL_KEYS.includes(key) ? details[index++] : key)
}
