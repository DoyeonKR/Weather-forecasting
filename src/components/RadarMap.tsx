// 비구름 레이더 + 예측 — 과거 2시간은 RainViewer 실측 레이더(키 불필요),
// 미래 6시간은 Open-Meteo 강수 예보를 격자 오버레이로 렌더링.
// 타임라인 슬라이더: 기본은 현재, 드래그로 과거~미래 탐색.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { lccForward, lccInverse } from '../lib/lcc'
import { mapleForecastOverlays } from '../lib/kmaMaple'

interface RadarFrame {
  time: number
  path: string
}

interface RadarApi {
  host: string
  radar: { past: RadarFrame[]; nowcast: RadarFrame[] }
}

interface TimelineItem {
  time: number
  kind: 'radar' | 'forecast'
  /** kind 별 레이어 배열 내 인덱스 */
  layerIdx: number
}

interface Props {
  lat: number
  lon: number
}

const RADAR_OPACITY = 0.65
const GRID_N = 13 // 13x13 격자 (169좌표 — Open-Meteo 무료 한도 고려)
const GRID_STEP = 0.28 // ≈ 28km 간격 (전체 ±1.8° 커버)
const GRID_CACHE_TTL = 20 * 60 * 1000 // 20분 캐시로 호출량 절약
const FORECAST_HOURS = 6
const FORECAST_STEPS = FORECAST_HOURS * 4 // 15분 단위

/** mm/h → RGBA — 기상청 레이더 색상표 계열(하늘색→초록→노랑→주황→빨강→보라) */
function rgbaFor(mmPerHour: number): [number, number, number, number] {
  if (mmPerHour < 0.1) return [0, 0, 0, 0]
  if (mmPerHour < 1) return [0, 190, 255, 255]
  if (mmPerHour < 3) return [0, 210, 60, 255]
  if (mmPerHour < 6) return [250, 218, 0, 255]
  if (mmPerHour < 12) return [255, 144, 0, 255]
  if (mmPerHour < 25) return [255, 40, 40, 255]
  return [180, 14, 220, 255]
}

// ── 기상청(KMA) 실황 레이더 GIS 오버레이 ──────────────────
// radar.kma.go.kr GIS 뷰어의 com_gis CGI 를 재현: 임의 bbox 의 투명 레이더 PNG (인증 불필요)

const KMA_BOX_M = 700_000 // 위치 중심 700km 정사각 (남한 전역 커버)

function inKorea(lat: number, lon: number): boolean {
  return lat > 32.5 && lat < 40.5 && lon > 123 && lon < 132.5
}

/** KST 10분 단위 프레임 시각들 (과거 minutes 분 전부터 현재까지) */
function kmaFrameTimes(count: number): { stamp: string; epoch: number }[] {
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

function kmaBox(lat: number, lon: number): {
  urlPart: string
  bounds: L.LatLngBoundsExpression
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
    `&IMG_XDIM=700&IMG_YDIM=700&X_DIST=${KMA_BOX_M}&Y_DIST=${KMA_BOX_M}` +
    `&UNIT_BAR=0&ECHO_OPACITY=1`
  const bounds: L.LatLngBoundsExpression = [
    [(sw.lat + se.lat) / 2, (nw.lon + sw.lon) / 2],
    [(nw.lat + ne.lat) / 2, (ne.lon + se.lon) / 2],
  ]
  return { urlPart, bounds, rectX0: x0, rectY1: y1 }
}

function kmaFrameUrl(stamp: string, urlPart: string): string {
  return (
    'https://radar.kma.go.kr/cgi-bin/com_gis/radar_comp_gis_realtime_hsp' +
    `?D_VER=HSP&D_TYPE=RN&COMP_MIX=2&IS_SMOOTH=1&FLICKER=0&ACC=0&HT=0&DATE=${stamp}&${urlPart}`
  )
}

function timeLabel(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface ForecastGrid {
  times: number[]
  grid: number[][]
}

function gridCacheKey(lat: number, lon: number): string {
  return `eojeboda:fgrid:${lat.toFixed(1)},${lon.toFixed(1)}`
}

function readGridCache(lat: number, lon: number, maxAgeMs: number): ForecastGrid | null {
  try {
    const raw = localStorage.getItem(gridCacheKey(lat, lon))
    if (!raw) return null
    const c = JSON.parse(raw)
    if (typeof c.at !== 'number' || Date.now() - c.at > maxAgeMs) return null
    return { times: c.times, grid: c.grid }
  } catch {
    return null
  }
}

function writeGridCache(lat: number, lon: number, g: ForecastGrid): void {
  try {
    localStorage.setItem(gridCacheKey(lat, lon), JSON.stringify({ at: Date.now(), ...g }))
  } catch {
    // 저장 공간 부족 등은 무시
  }
}

async function fetchForecastGrid(
  lat: number,
  lon: number,
): Promise<ForecastGrid> {
  const cached = readGridCache(lat, lon, GRID_CACHE_TTL)
  if (cached) return cached
  // grid[t][i] = i번째 격자점의 t시점 강수(mm/15분)
  const lats: number[] = []
  const lons: number[] = []
  const half = Math.floor(GRID_N / 2)
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      lats.push(+(lat + i * GRID_STEP).toFixed(3))
      lons.push(+(lon + j * GRID_STEP).toFixed(3))
    }
  }
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lats.join(','))
  url.searchParams.set('longitude', lons.join(','))
  url.searchParams.set('minutely_15', 'precipitation')
  url.searchParams.set('forecast_minutely_15', String(FORECAST_STEPS + 4))
  url.searchParams.set('timeformat', 'unixtime')
  url.searchParams.set('timezone', 'auto')
  const res = await fetch(url)
  if (!res.ok) {
    // 한도 초과 등 실패 시 오래된 캐시라도 사용 (최대 2시간)
    const stale = readGridCache(lat, lon, 2 * 60 * 60 * 1000)
    if (stale) return stale
    throw new Error('forecast grid fetch failed')
  }
  const data = await res.json()
  const list = Array.isArray(data) ? data : [data]
  const times: number[] = list[0]?.minutely_15?.time ?? []
  const grid = times.map((_, t) =>
    list.map((d: { minutely_15: { precipitation: number[] } }) => d.minutely_15.precipitation[t] ?? 0),
  )
  const result = { times, grid }
  writeGridCache(lat, lon, result)
  return result
}

/** 격자값(GRID_N×GRID_N)을 보간·블러로 레이더 느낌의 이미지로 렌더 */
function renderFrameImage(values: number[]): string | null {
  if (!values.some((v) => v >= 0.025)) return null // 비 없는 프레임은 오버레이 생략
  const small = document.createElement('canvas')
  small.width = GRID_N
  small.height = GRID_N
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(GRID_N, GRID_N)
  for (let i = 0; i < values.length; i++) {
    // 격자는 (위도 -half→+half, 경도 -half→+half) 순서 → 캔버스 y는 북쪽이 위
    const row = Math.floor(i / GRID_N)
    const col = i % GRID_N
    const y = GRID_N - 1 - row
    const [r, g, b, a] = rgbaFor((values[i] ?? 0) * 4) // mm/15분 → mm/h
    const o = (y * GRID_N + col) * 4
    img.data[o] = r
    img.data[o + 1] = g
    img.data[o + 2] = b
    img.data[o + 3] = a
  }
  sctx.putImageData(img, 0, 0)
  const big = document.createElement('canvas')
  big.width = 512
  big.height = 512
  const bctx = big.getContext('2d')!
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.filter = 'blur(2px)'
  bctx.drawImage(small, 0, 0, 512, 512) // 가장자리는 블러로 자연스럽게 페이드
  return big.toDataURL('image/png')
}

export default function RadarMap({ lat, lon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const radarLayersRef = useRef<(L.TileLayer | L.ImageOverlay)[]>([])
  const forecastLayersRef = useRef<L.ImageOverlay[]>([])
  const markerRef = useRef<L.CircleMarker | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [nowIdx, setNowIdx] = useState(0)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)

  // 지도 초기화 (최초 1회)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 8,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(map)
    markerRef.current = L.circleMarker([lat, lon], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#2f81f7',
      fillOpacity: 1,
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      radarLayersRef.current = []
      forecastLayersRef.current = []
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 위치 변경 시 지도 이동
  useEffect(() => {
    mapRef.current?.setView([lat, lon])
    markerRef.current?.setLatLng([lat, lon])
  }, [lat, lon])

  // 프레임 로드: 레이더(과거) + 예보 격자(미래)
  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      const map = mapRef.current
      if (!map) return
      try {
        const useKma = inKorea(lat, lon)
        // 한국: 미래는 아래 기상청 공식 예측 카드가 담당 (연한 모델 예보 오버레이 제거)
        const gridPromise = useKma
          ? Promise.resolve(null)
          : fetchForecastGrid(lat, lon).catch(
              () =>
                // 일시 실패(레이트리밋 등) 시 1회 재시도
                new Promise<Awaited<ReturnType<typeof fetchForecastGrid>> | null>((resolve) => {
                  setTimeout(() => fetchForecastGrid(lat, lon).then(resolve).catch(() => resolve(null)), 2500)
                }),
            )

        let items: TimelineItem[]
        if (useKma) {
          // ── 과거: 기상청 실황 레이더 오버레이 (2시간, 10분 간격)
          const frames = kmaFrameTimes(13)
          const box = kmaBox(lat, lon)
          radarLayersRef.current = frames.map((f) =>
            L.imageOverlay(kmaFrameUrl(f.stamp, box.urlPart), box.bounds, {
              opacity: 0,
              interactive: false,
            }).addTo(mapRef.current!),
          )
          items = frames.map((f, i) => ({ time: f.epoch, kind: 'radar', layerIdx: i }))

          // ── 미래: 기상청 MAPLE 예측(+10분~+3시간)을 재투영해 오버레이
          const lastObs = items[items.length - 1].time
          const maple = await mapleForecastOverlays(box.rectX0, box.rectY1, KMA_BOX_M, 512).catch(
            () => [],
          )
          if (cancelled || !mapRef.current) return
          for (const mf of maple) {
            if (mf.time <= lastObs) continue // 실황과 겹치는 구간 제외
            const overlay = L.imageOverlay(mf.url, box.bounds, {
              opacity: 0,
              interactive: false,
            }).addTo(mapRef.current!)
            forecastLayersRef.current.push(overlay)
            items.push({
              time: mf.time,
              kind: 'forecast',
              layerIdx: forecastLayersRef.current.length - 1,
            })
          }
        } else {
          // ── 해외 위치: RainViewer 타일 폴백
          const api: RadarApi = await fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => {
            if (!r.ok) throw new Error()
            return r.json()
          })
          if (cancelled || !mapRef.current) return
          const past = [...api.radar.past.slice(-12), ...api.radar.nowcast]
          radarLayersRef.current = past.map((f) =>
            L.tileLayer(`${api.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
              opacity: 0,
              maxZoom: 12,
              maxNativeZoom: 7, // RainViewer 실데이터는 z7까지, 그 이상 줌은 확대 표시
            }).addTo(mapRef.current!),
          )
          items = past.map((f, i) => ({ time: f.time, kind: 'radar', layerIdx: i }))
        }

        const grid = await gridPromise
        if (cancelled || !mapRef.current) return
        // "현재" = 마지막 실황 프레임 (실황은 항상 타임라인 앞쪽에 연속 배치)
        const now = items.filter((it) => it.kind === 'radar').length - 1

        // ── 미래: 강수 예보를 보간 이미지 오버레이로 (6시간, 15분 간격)
        if (grid) {
          const lastRadarTime = items[items.length - 1]?.time ?? Date.now() / 1000
          const half = Math.floor(GRID_N / 2)
          const extent = half * GRID_STEP + GRID_STEP / 2
          const bounds: L.LatLngBoundsExpression = [
            [lat - extent, lon - extent],
            [lat + extent, lon + extent],
          ]
          grid.times.forEach((t, ti) => {
            if (t <= lastRadarTime) return
            if (items.filter((x) => x.kind === 'forecast').length >= FORECAST_STEPS) return
            const dataUrl = renderFrameImage(grid.grid[ti])
            // 비가 전혀 없는 프레임도 타임라인에는 포함(오버레이만 없음)
            let layerIdx = -1
            if (dataUrl) {
              const overlay = L.imageOverlay(dataUrl, bounds, {
                opacity: 0,
                interactive: false,
              }).addTo(mapRef.current!)
              forecastLayersRef.current.push(overlay)
              layerIdx = forecastLayersRef.current.length - 1
            }
            items.push({ time: t, kind: 'forecast', layerIdx })
          })
        }

        setTimeline(items)
        setNowIdx(now)
        setIdx(now)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    loadAll()
    return () => {
      cancelled = true
      radarLayersRef.current.forEach((l) => l.remove())
      forecastLayersRef.current.forEach((g) => g.remove())
      radarLayersRef.current = []
      forecastLayersRef.current = []
    }
    // 위치가 바뀌면 예보 격자도 다시 (레이더는 전역이지만 함께 재구성)
  }, [lat, lon])

  // 선택된 프레임 표시
  useEffect(() => {
    const item = timeline[idx]
    if (!item) return
    radarLayersRef.current.forEach((l, j) =>
      l.setOpacity(item.kind === 'radar' && j === item.layerIdx ? RADAR_OPACITY : 0),
    )
    forecastLayersRef.current.forEach((o, j) =>
      o.setOpacity(item.kind === 'forecast' && j === item.layerIdx ? RADAR_OPACITY : 0),
    )
  }, [idx, timeline])

  // 재생
  useEffect(() => {
    if (!playing || timeline.length === 0) return
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % timeline.length)
    }, 650)
    return () => window.clearInterval(t)
  }, [playing, timeline.length])

  const current = timeline[idx]
  const isFuture = current?.kind === 'forecast'

  return (
    <div className="radar-wrap">
      <div ref={containerRef} className="radar-map" />
      <button
        type="button"
        className="radar-locate"
        aria-label="현재 위치로 이동"
        title="현재 위치로 이동"
        onClick={() => mapRef.current?.setView([lat, lon], 8)}
      >
        ◎
      </button>
      <div className="radar-bar">
        {error ? (
          <span className="radar-time">레이더를 불러오지 못했어요</span>
        ) : (
          <>
            <div className="radar-bar-top">
              <button
                type="button"
                className="radar-btn"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? '일시정지' : '재생'}
                disabled={timeline.length === 0}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <span className={`radar-time ${isFuture ? 'future' : ''}`}>
                {current ? timeLabel(current.time) : '로딩 중…'}
                {current && (isFuture ? ' 예측' : idx === nowIdx ? ' 현재' : '')}
              </span>
              <button
                type="button"
                className="radar-now"
                onClick={() => {
                  setPlaying(false)
                  setIdx(nowIdx)
                }}
                disabled={timeline.length === 0 || idx === nowIdx}
              >
                지금
              </button>
            </div>
            <input
              type="range"
              className="radar-slider"
              min={0}
              max={Math.max(timeline.length - 1, 0)}
              value={idx}
              onChange={(e) => {
                setPlaying(false)
                setIdx(Number(e.target.value))
              }}
              disabled={timeline.length === 0}
              aria-label="레이더 시간 이동"
            />
            {timeline.length > 0 && (
              <div className="radar-ticks">
                <span>{timeLabel(timeline[0].time)}</span>
                <span className="radar-credit">
                  {inKorea(lat, lon) ? '실황·예측 기상청 레이더' : '실황 RainViewer · 예측 Open-Meteo'}
                </span>
                <span>{timeLabel(timeline[timeline.length - 1].time)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
