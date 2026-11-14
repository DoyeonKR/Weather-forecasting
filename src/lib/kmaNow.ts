// 기상청 초단기실황(관측값) — kma-ncst 프록시 경유. 실패 시 null (모델값으로 폴백)
import { fetchJsonTimeout } from './http'
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
    // 첫 화면이 이걸 기다린다 → 5초 안에 안 오면 실황 없이 그린다
    const d = await fetchJsonTimeout<Record<string, unknown>>(`${PROXY}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 5_000)
    if (d.error) return null
    // 값이 문자열로 와도 비교가 어긋나지 않게 일괄 숫자화한다
    const num = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
      return Number.isFinite(n) ? n : null
    }
    const t1h = num(d.t1h)
    if (t1h === null) return null
    return { t1h, rn1: num(d.rn1), pty: num(d.pty), wsd: num(d.wsd), reh: num(d.reh) }
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
