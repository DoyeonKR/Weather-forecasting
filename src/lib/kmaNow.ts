// 기상청 초단기실황(관측값) — kma-ncst 프록시 경유. 실패 시 null (모델값으로 폴백)
export interface KmaNow {
  t1h: number | null
  rn1: number | null
  pty: number | null
  wsd: number | null
  reh: number | null
}

const PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/kma-ncst'

export function inKoreaBounds(lat: number, lon: number): boolean {
  return lat > 32.5 && lat < 40.5 && lon > 123 && lon < 132.5
}

export async function fetchKmaNow(lat: number, lon: number): Promise<KmaNow | null> {
  try {
    const res = await fetch(`${PROXY}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
    if (!res.ok) return null
    const d = await res.json()
    if (d.error || typeof d.t1h !== 'number') return null
    return { t1h: d.t1h, rn1: d.rn1, pty: d.pty, wsd: d.wsd, reh: d.reh }
  } catch {
    return null
  }
}

/** 강수형태(PTY) 관측값 → 라벨. 0(없음)이나 미상은 null (모델 라벨 유지) */
export function ptyLabel(pty: number | null): { label: string; emoji: string } | null {
  switch (pty) {
    case 1:
      return { label: '비', emoji: '🌧️' }
    case 2:
      return { label: '비/눈', emoji: '🌨️' }
    case 3:
      return { label: '눈', emoji: '🌨️' }
    case 5:
      return { label: '약한 비', emoji: '🌦️' }
    case 6:
      return { label: '진눈깨비', emoji: '🌨️' }
    case 7:
      return { label: '약한 눈', emoji: '🌨️' }
    default:
      return null
  }
}
