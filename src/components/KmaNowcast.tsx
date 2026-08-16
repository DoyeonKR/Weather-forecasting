// 기상청 초단기 예측(MAPLE) 뷰어 — 실황+예측 GIF 를 프레임 분해해
// 타임라인 스크럽 + 줌/팬이 되는 캔버스 뷰어로 제공 (Supabase Edge 프록시로 CORS 해결)
import { useCallback, useEffect, useRef, useState } from 'react'
import { parseGIF, decompressFrames } from 'gifuct-js'

const PROXY = 'https://tqegatiuembcvphxmujl.supabase.co/functions/v1/kma-proxy'
const MIN_ZOOM = 1
const MAX_ZOOM = 5

/** KST 기준 10분 단위 내림, back*10분 과거 */
function kstStamp(back: number): string {
  const kst = new Date(Date.now() + 9 * 3600_000)
  kst.setUTCMinutes(Math.floor(kst.getUTCMinutes() / 10) * 10 - back * 10, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}`
}

async function loadFrames(stamp: string): Promise<{ bitmaps: ImageBitmap[]; delays: number[] }> {
  const res = await fetch(`${PROXY}?t=${stamp}`)
  if (!res.ok) throw new Error(`proxy ${res.status}`)
  const buf = await res.arrayBuffer()
  const gif = parseGIF(buf)
  const frames = decompressFrames(gif, true)
  const W = gif.lsd.width
  const H = gif.lsd.height
  const compose = document.createElement('canvas')
  compose.width = W
  compose.height = H
  const ctx = compose.getContext('2d')!
  const patchCanvas = document.createElement('canvas')
  const pctx = patchCanvas.getContext('2d')!
  const bitmaps: ImageBitmap[] = []
  const delays: number[] = []
  let prevRect: { left: number; top: number; width: number; height: number } | null = null
  let prevDisposal = 0
  for (const f of frames) {
    if (prevDisposal === 2 && prevRect) {
      ctx.clearRect(prevRect.left, prevRect.top, prevRect.width, prevRect.height)
    }
    patchCanvas.width = f.dims.width
    patchCanvas.height = f.dims.height
    pctx.putImageData(new ImageData(f.patch, f.dims.width, f.dims.height), 0, 0)
    ctx.drawImage(patchCanvas, f.dims.left, f.dims.top)
    bitmaps.push(await createImageBitmap(compose))
    delays.push(Math.max(f.delay || 100, 80))
    prevRect = f.dims
    prevDisposal = f.disposalType
  }
  return { bitmaps, delays }
}

export default function KmaNowcast() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<ImageBitmap[]>([])
  const delaysRef = useRef<number[]>([])
  const viewRef = useRef({ zoom: 1, ox: 0, oy: 0 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistRef = useRef(0)
  const [count, setCount] = useState(0)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const draw = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current
    const bmp = framesRef.current[frameIdx]
    if (!canvas || !bmp) return
    const ctx = canvas.getContext('2d')!
    const v = viewRef.current
    const scale = (canvas.width / bmp.width) * v.zoom
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale, 0, 0, scale, v.ox, v.oy)
    ctx.drawImage(bmp, 0, 0)
  }, [])

  /** 팬 범위를 프레임 안으로 제한 */
  const clampView = useCallback(() => {
    const canvas = canvasRef.current
    const bmp = framesRef.current[0]
    if (!canvas || !bmp) return
    const v = viewRef.current
    const scale = (canvas.width / bmp.width) * v.zoom
    const contentW = bmp.width * scale
    const contentH = bmp.height * scale
    v.ox = Math.min(0, Math.max(canvas.width - contentW, v.ox))
    v.oy = Math.min(0, Math.max(canvas.height - contentH, v.oy))
    if (contentW <= canvas.width) v.ox = (canvas.width - contentW) / 2
    if (contentH <= canvas.height) v.oy = (canvas.height - contentH) / 2
  }, [])

  // GIF 로드 (최신 10분 프레임부터, 없으면 과거로 폴백)
  useEffect(() => {
    let cancelled = false
    async function load() {
      for (let back = 1; back <= 5; back++) {
        try {
          const { bitmaps, delays } = await loadFrames(kstStamp(back))
          if (cancelled) return
          framesRef.current = bitmaps
          delaysRef.current = delays
          setCount(bitmaps.length)
          setIdx(0)
          setStatus('ready')
          return
        } catch {
          // 다음(더 과거) 프레임 시도
        }
      }
      if (!cancelled) setStatus('error')
    }
    load()
    return () => {
      cancelled = true
      framesRef.current.forEach((b) => b.close())
      framesRef.current = []
    }
  }, [])

  // 캔버스 크기 설정 + 그리기
  useEffect(() => {
    const canvas = canvasRef.current
    const bmp = framesRef.current[0]
    if (!canvas || !bmp) return
    const cssW = canvas.parentElement?.clientWidth ?? 400
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssW * (bmp.height / bmp.width) * dpr)
    canvas.style.height = `${Math.round(cssW * (bmp.height / bmp.width))}px`
    clampView()
    draw(idx)
    // count 변경(로드 완료) 시 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useEffect(() => {
    draw(idx)
  }, [idx, draw])

  // 재생
  useEffect(() => {
    if (!playing || count === 0) return
    let alive = true
    let timer: number
    const tick = () => {
      if (!alive) return
      setIdx((i) => {
        const next = (i + 1) % count
        timer = window.setTimeout(tick, next === count - 1 ? 1200 : delaysRef.current[next] ?? 400)
        return next
      })
    }
    timer = window.setTimeout(tick, 400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [playing, count])

  function applyZoom(factor: number, cx?: number, cy?: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const v = viewRef.current
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor))
    const f = newZoom / v.zoom
    if (f === 1) return
    const px = cx ?? canvas.width / 2
    const py = cy ?? canvas.height / 2
    v.ox = px - (px - v.ox) * f
    v.oy = py - (py - v.oy) * f
    v.zoom = newZoom
    clampView()
    setZoomLevel(newZoom)
    draw(idx)
  }

  function canvasPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    }
  }

  return (
    <section className="card kma-card">
      <h2 className="section-title">기상청 초단기 예측 (실황+예측)</h2>
      {status === 'error' ? (
        <p className="muted small">기상청 예측 영상을 불러오지 못했어요.</p>
      ) : (
        <>
          <div className="kma-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="kma-canvas"
              style={{ touchAction: 'none', cursor: zoomLevel > 1 ? 'grab' : 'default' }}
              onPointerDown={(e) => {
                const canvas = canvasRef.current
                if (!canvas) return
                canvas.setPointerCapture(e.pointerId)
                pointersRef.current.set(e.pointerId, canvasPoint(e))
                if (pointersRef.current.size === 2) {
                  const [a, b] = [...pointersRef.current.values()]
                  pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y)
                }
              }}
              onPointerMove={(e) => {
                const pts = pointersRef.current
                if (!pts.has(e.pointerId)) return
                const p = canvasPoint(e)
                if (pts.size === 2) {
                  pts.set(e.pointerId, p)
                  const [a, b] = [...pts.values()]
                  const dist = Math.hypot(a.x - b.x, a.y - b.y)
                  if (pinchDistRef.current > 0) {
                    applyZoom(dist / pinchDistRef.current, (a.x + b.x) / 2, (a.y + b.y) / 2)
                  }
                  pinchDistRef.current = dist
                } else if (pts.size === 1) {
                  const prev = pts.get(e.pointerId)!
                  const v = viewRef.current
                  v.ox += p.x - prev.x
                  v.oy += p.y - prev.y
                  pts.set(e.pointerId, p)
                  clampView()
                  draw(idx)
                }
              }}
              onPointerUp={(e) => {
                pointersRef.current.delete(e.pointerId)
                pinchDistRef.current = 0
              }}
              onPointerCancel={(e) => {
                pointersRef.current.delete(e.pointerId)
                pinchDistRef.current = 0
              }}
              onWheel={(e) => {
                const p = canvasPoint(e)
                applyZoom(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y)
              }}
            />
            <div className="kma-zoom-btns">
              <button type="button" aria-label="확대" onClick={() => applyZoom(1.4)}>＋</button>
              <button type="button" aria-label="축소" onClick={() => applyZoom(0.7)}>－</button>
            </div>
            {status === 'loading' && (
              <div className="kma-loading">
                <div className="spinner" aria-label="불러오는 중" />
              </div>
            )}
          </div>
          <div className="radar-bar kma-bar">
            <div className="radar-bar-top">
              <button
                type="button"
                className="radar-btn"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? '일시정지' : '재생'}
                disabled={count === 0}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <span className="radar-time">
                {count === 0 ? '로딩 중…' : `${idx + 1} / ${count} 프레임`}
              </span>
            </div>
            <input
              type="range"
              className="radar-slider"
              min={0}
              max={Math.max(count - 1, 0)}
              value={idx}
              onChange={(e) => {
                setPlaying(false)
                setIdx(Number(e.target.value))
              }}
              disabled={count === 0}
              aria-label="예측 시간 이동"
            />
          </div>
          <p className="muted small kma-credit">
            기상청 기상레이더센터 제공 · 10분마다 갱신 · 프레임 상단에 시각 표시
          </p>
        </>
      )}
    </section>
  )
}
