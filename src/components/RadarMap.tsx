// 실시간 비구름 레이더 — RainViewer 타일 (키 불필요) + Leaflet
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Frame {
  time: number
  path: string
}

interface RadarApi {
  host: string
  radar: { past: Frame[]; nowcast: Frame[] }
}

interface Props {
  lat: number
  lon: number
}

const RADAR_OPACITY = 0.65

export default function RadarMap({ lat, lon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.TileLayer[]>([])
  const framesRef = useRef<Frame[]>([])
  const idxRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(true)
  const [frameLabel, setFrameLabel] = useState('')
  const [error, setError] = useState(false)

  // 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 8,
      attributionControl: true,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(map)
    L.circleMarker([lat, lon], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#2f81f7',
      fillOpacity: 1,
    }).addTo(map)
    mapRef.current = map
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      map.remove()
      mapRef.current = null
      layersRef.current = []
    }
    // 최초 1회만 생성 (위치 변경 시 setView 는 아래 effect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    mapRef.current?.setView([lat, lon])
  }, [lat, lon])

  // 레이더 프레임 로드 + 애니메이션
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        if (!res.ok) throw new Error()
        const api: RadarApi = await res.json()
        if (cancelled || !mapRef.current) return
        // 과거 6프레임(1시간) + 예측 프레임
        const frames = [...api.radar.past.slice(-6), ...api.radar.nowcast]
        framesRef.current = frames
        layersRef.current = frames.map((f) =>
          L.tileLayer(`${api.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0,
            maxZoom: 12,
          }).addTo(mapRef.current!),
        )
        idxRef.current = frames.length - api.radar.nowcast.length // "지금" 프레임부터
        showFrame(idxRef.current)
        startTimer()
      } catch {
        if (!cancelled) setError(true)
      }
    }

    function showFrame(i: number) {
      layersRef.current.forEach((l, j) => l.setOpacity(j === i ? RADAR_OPACITY : 0))
      const f = framesRef.current[i]
      if (!f) return
      const d = new Date(f.time * 1000)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const isFuture = f.time * 1000 > Date.now()
      setFrameLabel(`${hh}:${mm}${isFuture ? ' (예측)' : ''}`)
    }

    function startTimer() {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = window.setInterval(() => {
        idxRef.current = (idxRef.current + 1) % framesRef.current.length
        showFrame(idxRef.current)
      }, 700)
    }

    load()
    return () => {
      cancelled = true
      if (timerRef.current) window.clearInterval(timerRef.current)
      layersRef.current.forEach((l) => l.remove())
      layersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 재생/일시정지
  useEffect(() => {
    if (playing) {
      if (framesRef.current.length && !timerRef.current) {
        timerRef.current = window.setInterval(() => {
          idxRef.current = (idxRef.current + 1) % framesRef.current.length
          const i = idxRef.current
          layersRef.current.forEach((l, j) => l.setOpacity(j === i ? RADAR_OPACITY : 0))
          const f = framesRef.current[i]
          if (f) {
            const d = new Date(f.time * 1000)
            setFrameLabel(
              `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${f.time * 1000 > Date.now() ? ' (예측)' : ''}`,
            )
          }
        }, 700)
      }
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [playing])

  return (
    <div className="radar-wrap">
      <div ref={containerRef} className="radar-map" />
      <div className="radar-controls">
        <button
          type="button"
          className="radar-btn"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? '일시정지' : '재생'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="radar-time">{error ? '레이더를 불러오지 못했어요' : frameLabel}</span>
        <span className="radar-credit">RainViewer</span>
      </div>
    </div>
  )
}
