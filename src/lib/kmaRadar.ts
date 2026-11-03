// 기상청(KMA) 실황 레이더 GIS 이미지 주소 계산. 지도 라이브러리 없이 쓸 수 있어
// 첫 화면에서 최신 프레임을 미리 받아 둘 때도 이 파일만 가져온다.
// radar.kma.go.kr GIS 뷰어의 com_gis CGI 를 재현: 임의 bbox 의 투명 레이더 PNG (인증 불필요)
import { lccForward, lccInverse } from './lcc'

export const KMA_BOX_M = 700_000 // 위치 중심 700km 정사각 (남한 전역 커버)

export function inKorea(lat: number, lon: number): boolean {
  return lat > 32.5 && lat < 40.5 && lon > 123 && lon < 132.5
}

/** KST 10분 단위 프레임 시각들 (과거 minutes 분 전부터 현재까지) */
export function kmaFrameTimes(count: number): { stamp: string; epoch: number }[] {
  const now = Date.now()
  const kstNow = new Date(now + 9 * 3600_000)
  kstNow.setUTCMinutes(Math.floor((kstNow.getUTCMinutes() - 6) / 10) * 10, 0, 0)
  const frames: { stamp: string; epoch: number }[] = []
  const p = (n: number) => String(n).padStart(2, '0')
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(kstNow.getTime() - i * 10 * 60_000)
    frames.push({
      stamp: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`,
      epoch: (d.getTime() - 9 * 3600_000) / 1000,
    })
  }
  return frames
}

export function kmaBox(lat: number, lon: number): {
  urlPart: string
  bounds: [[number, number], [number, number]]
  rectX0: number
  rectY1: number
} {
  const c = lccForward(lat, lon)
  const half = KMA_BOX_M / 2
  const x0 = c.x - half, x1 = c.x + half, y0 = c.y - half, y1 = c.y + half
  const nw = lccInverse(x0, y1)
  const ne = lccInverse(x1, y1)
  const sw = lccInverse(x0, y0)
  const se = lccInverse(x1, y0)
  // 기상청 뷰어와 동일하게 우하단을 20% 연장해 요청
  const rlLon = se.lon + (se.lon - nw.lon) * 0.2
  const rlLat = se.lat + (se.lat - nw.lat) * 0.2
  const urlPart =
    `LU_LON=${nw.lon.toFixed(5)}&LU_LAT=${nw.lat.toFixed(5)}` +
    `&RL_LON=${rlLon.toFixed(5)}&RL_LAT=${rlLat.toFixed(5)}` +
    `&IMG_XDIM=420&IMG_YDIM=420&X_DIST=${KMA_BOX_M}&Y_DIST=${KMA_BOX_M}` +
    `&UNIT_BAR=0&ECHO_OPACITY=1`
  const bounds: [[number, number], [number, number]] = [
    [(sw.lat + se.lat) / 2, (nw.lon + sw.lon) / 2],
    [(nw.lat + ne.lat) / 2, (ne.lon + se.lon) / 2],
  ]
  return { urlPart, bounds, rectX0: x0, rectY1: y1 }
}

export function kmaFrameUrl(stamp: string, urlPart: string): string {
  return (
    'https://radar.kma.go.kr/cgi-bin/com_gis/radar_comp_gis_realtime_hsp' +
    `?D_VER=HSP&D_TYPE=RN&COMP_MIX=2&IS_SMOOTH=1&FLICKER=0&ACC=0&HT=0&DATE=${stamp}&${urlPart}`
  )
}

// 받아 둔 이미지를 쥐고 있어야 지도가 같은 주소를 부를 때 다시 받지 않는다
let warmed: HTMLImageElement | null = null

/** 지금 볼 최신 프레임 한 장을 미리 받아 둔다 (국내만) */
export function warmLatestFrame(lat: number, lon: number): void {
  if (!inKorea(lat, lon)) return
  const [latest] = kmaFrameTimes(1)
  warmed = new Image()
  warmed.src = kmaFrameUrl(latest.stamp, kmaBox(lat, lon).urlPart)
}
