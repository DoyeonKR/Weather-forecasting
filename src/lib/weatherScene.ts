import { isSnowCode } from './compare'

export type SceneKind = 'clear-day' | 'clear-night' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'fog'
export interface WeatherScene {
  kind: SceneKind
  sky: 'morning-sky' | 'night-sky' | 'rain-sky' | 'snow-sky'
  windKmh: number
  windLevel: 0 | 1 | 2 | 3
  intensity: number
}
const safeSpeed = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(v, 250)) : 0

/** 기상청 강수형태를 우선하되, 단순한 '비' 관측 때문에 뇌우 예보를 잃지는 않는다. */
export function observedSceneCode(code: number, pty?: number | null): number {
  if (pty === 1 || pty === 5) return code >= 95 ? code : 61
  if ([2, 3, 6, 7].includes(pty ?? 0)) return 73
  return code
}

/** 현재 풍속/돌풍만 사용한다. 하루 최대 예보를 지금의 강풍으로 오인하지 않는다. */
export function buildWeatherScene(code: number, isDay: boolean, windKmh?: number | null, gustKmh?: number | null): WeatherScene {
  const wind = safeSpeed(windKmh), gust = safeSpeed(gustKmh)
  const windLevel = wind >= 50 || gust >= 70 ? 3 : wind >= 28 || gust >= 45 ? 2 : wind >= 10 || gust >= 25 ? 1 : 0
  const kind: SceneKind = code >= 95 ? 'thunder' : isSnowCode(code) ? 'snow'
    : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain'
    : code === 45 || code === 48 ? 'fog' : code === 3 ? 'cloudy'
    : code === 1 || code === 2 ? 'partly-cloudy' : isDay ? 'clear-day' : 'clear-night'
  const night = !isDay && (kind === 'clear-night' || kind === 'partly-cloudy')
  const sky = kind === 'snow' ? 'snow-sky' : ['rain', 'thunder', 'cloudy', 'fog'].includes(kind) ? 'rain-sky' : night ? 'night-sky' : 'morning-sky'
  const intensity = [65, 67, 75, 82, 86, 95, 96, 99].includes(code) ? 1.4 : [51, 53, 56, 71, 77].includes(code) ? .65 : 1
  return { kind, sky, windKmh: wind, windLevel, intensity }
}

/** 두 캔버스를 함께 켜도 모바일에서 입자가 과도하게 늘지 않게 제한한다. */
export function particleBudget(width: number, height: number, hero: boolean, intensity: number): number {
  return Math.min(hero ? 44 : 72, Math.max(12, Math.round(Math.max(0, width * height) / 16000 * intensity)))
}
const MOTION_KEY = 'eojeboda.weatherMotion'
export function loadWeatherMotion(): boolean {
  try { return localStorage.getItem(MOTION_KEY) !== 'off' } catch { return true }
}
export function saveWeatherMotion(enabled: boolean): void {
  try { localStorage.setItem(MOTION_KEY, enabled ? 'on' : 'off') } catch { /* 저장소 없이도 이번 화면은 동작 */ }
}
