// 비구름 레이더 + 예측 — 과거 2시간은 RainViewer 실측 레이더(키 불필요),
// 미래 6시간은 Open-Meteo 강수 예보를 격자 오버레이로 렌더링.
// 타임라인 슬라이더: 기본은 현재, 드래그로 과거~미래 탐색.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
const GRID_N = 17 // 17x17 격자
const GRID_STEP = 0.25 // ≈ 25km 간격 (전체 ±2.1° 커버)
const FORECAST_HOURS = 6
const FORECAST_STEPS = FORECAST_HOURS * 4 // 15분 단위

/** mm/h → RGBA (레이더 팔레트 느낌) */
function rgbaFor(mmPerHour: number): [number, number, number, number] {
  if (mmPerHour < 0.1) return [0, 0, 0, 0]
  if (mmPerHour < 0.5) return [116, 187, 250, 150]
  if (mmPerHour < 1.5) return [56, 146, 245, 185]
  if (mmPerHour < 4) return [23, 98, 242, 215]
  if (mmPerHour < 10) return [109, 61, 240, 230]
  return [192, 38, 211, 240]
}

function timeLabel(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function fetchForecastGrid(
  lat: number,
  lon: number,
): Promise<{ times: number[]; grid: number[][] }> {
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
  if (!res.ok) throw new Error('forecast grid fetch failed')
  const data = await res.json()
  const list = Array.isArray(data) ? data : [data]
  const times: number[] = list[0]?.minutely_15?.time ?? []
  const grid = times.map((_, t) =>
    list.map((d: { minutely_15: { precipitation: number[] } }) => d.minutely_15.precipitation[t] ?? 0),
  )
  return { times, grid }
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
  bctx.filter = 'blur(4px)'
  bctx.drawImage(small, 0, 0, 512, 512) // 가장자리는 블러로 자연스럽게 페이드
  return big.toDataURL('image/png')
}

export default function RadarMap({ lat, lon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const radarLayersRef = useRef<L.TileLayer[]>([])
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
        const radarPromise = fetch('https://api.rainviewer.com/public/weather-maps.json').then(
          (r) => {
            if (!r.ok) throw new Error()
            return r.json() as Promise<RadarApi>
          },
        )
        const gridPromise = fetchForecastGrid(lat, lon).catch(() => null)
        const api = await radarPromise
        const grid = await gridPromise
        if (cancelled || !mapRef.current) return

        // ── 과거: 레이더 타일 (2시간, 10분 간격)
        const past = [...api.radar.past.slice(-12), ...api.radar.nowcast]
        radarLayersRef.current = past.map((f) =>
          L.tileLayer(`${api.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0,
            maxZoom: 12,
            // RainViewer 실데이터는 z7까지 — 그 이상 줌은 z7 타일 확대(줌인 시 사라짐 방지)
            maxNativeZoom: 7,
          }).addTo(mapRef.current!),
        )
        const items: TimelineItem[] = past.map((f, i) => ({
          time: f.time,
          kind: 'radar',
          layerIdx: i,
        }))
        const now = items.length - 1

        // ── 미래: 강수 예보를 보간 이미지 오버레이로 (6시간, 15분 간격)
        if (grid) {
          const lastRadarTime = past[past.length - 1]?.time ?? Date.now() / 1000
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
      o.setOpacity(item.kind === 'forecast' && j === item.layerIdx ? 0.8 : 0),
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
                <span className="radar-credit">실측 RainViewer · 예측 Open-Meteo</span>
                <span>{timeLabel(timeline[timeline.length - 1].time)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
