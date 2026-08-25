// 살아 움직이는 날씨 배경 — 현재 날씨에 맞춘 캔버스 애니메이션
// (비/눈/뇌우/맑음 낮·밤/구름/안개, 저사양 배려: 파티클 소량 + 탭 숨김 시 정지)
import { useEffect, useRef } from 'react'

interface Props {
  /** themeClass 결과 (bg-rain 등) */
  theme: string
}

type Kind = 'rain' | 'snow' | 'thunder' | 'clear-day' | 'clear-night' | 'cloudy' | 'fog' | 'none'

function kindOf(theme: string): Kind {
  switch (theme) {
    case 'bg-rain':
      return 'rain'
    case 'bg-snow':
      return 'snow'
    case 'bg-thunder':
      return 'thunder'
    case 'bg-clear-day':
    case 'bg-partly-day':
      return 'clear-day'
    case 'bg-clear-night':
      return 'clear-night'
    case 'bg-cloudy':
      return 'cloudy'
    case 'bg-fog':
      return 'fog'
    default:
      return 'none'
  }
}

interface P {
  x: number
  y: number
  v: number
  s: number
  p: number
}

export default function WeatherFx({ theme }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const kind = kindOf(theme)
    const canvas = ref.current
    if (!canvas || kind === 'none') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    // 고밀도 화면에서 흐릿하지 않게 DPR 을 적용하되, 비용이 커지지 않게 2배까지만.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas!.width = Math.round(W * dpr)
      canvas!.height = Math.round(H * dpr)
      canvas!.style.width = W + 'px'
      canvas!.style.height = H + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const R = (a: number, b: number) => a + Math.random() * (b - a)
    const count = kind === 'rain' || kind === 'thunder' ? 130 : kind === 'snow' ? 110 : kind === 'clear-night' ? 110 : 7
    const ps: P[] = Array.from({ length: count }, () => ({
      x: R(0, 1),
      y: R(0, 1),
      v: R(0.5, 1),
      s: R(0.5, 1.5),
      p: R(0, Math.PI * 2),
    }))

    let flash = 0
    let nextFlash = performance.now() + R(3000, 8000)
    let raf = 0
    let last = performance.now()

    // 거의 정지된 연출(맑음·구름·안개)은 초당 12프레임이면 충분하다
    const slowKinds = kind === 'clear-day' || kind === 'cloudy' || kind === 'fog'
    const minFrameMs = slowKinds ? 80 : 0

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      if (now - last < minFrameMs) return
      const dt = Math.min(now - last, 50) / 16.7
      last = now
      ctx!.clearRect(0, 0, W, H)

      if (kind === 'rain' || kind === 'thunder') {
        ctx!.strokeStyle = 'rgba(175, 205, 255, 0.5)'
        ctx!.lineWidth = 1.2
        ctx!.beginPath()
        for (const q of ps) {
          const x = q.x * W
          const y = q.y * H
          const len = 9 + q.v * 9
          ctx!.moveTo(x, y)
          ctx!.lineTo(x - 2, y + len)
          q.y += ((q.v * 9 + 5) * dt) / H
          q.x -= (0.8 * dt) / W
          if (q.y > 1) {
            q.y = -0.05
            q.x = R(0, 1.05)
          }
        }
        ctx!.stroke()
        if (kind === 'thunder') {
          if (now > nextFlash) {
            flash = 0.55
            nextFlash = now + R(3500, 9000)
          }
          if (flash > 0.01) {
            ctx!.fillStyle = `rgba(220, 225, 255, ${flash})`
            ctx!.fillRect(0, 0, W, H)
            flash *= 0.82
          }
        }
      } else if (kind === 'snow') {
        ctx!.fillStyle = 'rgba(255, 255, 255, 0.85)'
        for (const q of ps) {
          q.p += 0.02 * dt
          const x = (q.x + Math.sin(q.p) * 0.012) * W
          const y = q.y * H
          ctx!.beginPath()
          ctx!.arc(x, y, 1 + q.s * 1.6, 0, Math.PI * 2)
          ctx!.fill()
          q.y += ((q.v * 1.1 + 0.55) * dt) / H
          if (q.y > 1) {
            q.y = -0.03
            q.x = R(0, 1)
          }
        }
      } else if (kind === 'clear-night') {
        for (const q of ps) {
          q.p += 0.03 * dt * q.v
          const tw = 0.25 + 0.55 * Math.abs(Math.sin(q.p))
          ctx!.fillStyle = `rgba(255, 255, 240, ${tw})`
          ctx!.beginPath()
          ctx!.arc(q.x * W, q.y * H * 0.7, q.s * 0.9, 0, Math.PI * 2)
          ctx!.fill()
        }
      } else if (kind === 'clear-day') {
        const cx = W * 0.86
        const cy = H * 0.1
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5)
        g.addColorStop(0, 'rgba(255, 215, 130, 0.32)')
        g.addColorStop(1, 'rgba(255, 215, 130, 0)')
        ctx!.fillStyle = g
        ctx!.fillRect(0, 0, W, H)
        ps[0].p += 0.004 * dt
        const breath = 0.05 + 0.03 * Math.sin(ps[0].p * 5)
        const g2 = ctx!.createRadialGradient(cx, cy, 0, cx, cy, W * 0.16)
        g2.addColorStop(0, `rgba(255, 235, 170, ${0.35 + breath})`)
        g2.addColorStop(1, 'rgba(255, 235, 170, 0)')
        ctx!.fillStyle = g2
        ctx!.fillRect(0, 0, W, H)
      } else if (kind === 'cloudy' || kind === 'fog') {
        const alpha = kind === 'fog' ? 0.1 : 0.07
        for (let i = 0; i < ps.length; i++) {
          const q = ps[i]
          q.x += ((0.00016 + 0.0001 * q.v) * dt * (i % 2 === 0 ? 1 : 0.6))
          if (q.x > 1.4) q.x = -0.4
          const x = q.x * W
          const y = (0.08 + (i / ps.length) * (kind === 'fog' ? 0.8 : 0.35)) * H
          const rw = W * (0.35 + q.s * 0.25)
          const g = ctx!.createRadialGradient(x, y, 0, x, y, rw)
          g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
          g.addColorStop(1, 'rgba(255, 255, 255, 0)')
          ctx!.fillStyle = g
          ctx!.beginPath()
          ctx!.ellipse(x, y, rw, rw * 0.32, 0, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, W, H)
    }
  }, [theme])

  if (kindOf(theme) === 'none') return null
  return <canvas ref={ref} className="weather-fx" aria-hidden />
}
