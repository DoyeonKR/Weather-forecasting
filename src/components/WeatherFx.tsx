// 사진·CSS 구름·작은 캔버스 입자를 겹친다. 소리/전체 화면 섬광은 사용하지 않는다.
import { useEffect, useRef, useState } from 'react'
import { particleBudget, type WeatherScene } from '../lib/weatherScene'

interface Props { scene: WeatherScene; paused: boolean; scope?: 'page' | 'hero'; onAnimatedChange?: (animated: boolean) => void }
interface Particle { x: number; y: number; speed: number; size: number; phase: number }

export default function WeatherFx({ scene, paused, scope = 'page', onAnimatedChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animated, setAnimated] = useState(false)
  const { kind, windLevel, intensity, sky } = scene

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !ctx) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = scope === 'page' || typeof IntersectionObserver === 'undefined', running = false, raf = 0, last = 0, width = 1, height = 1
    let particles: Particle[] = []
    let seed = scope === 'hero' ? 317 : 773
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    const makeParticle = (): Particle => ({ x: random(), y: random(), speed: .4 + random(), size: .6 + random(), phase: random() * Math.PI * 2 })
    const gusts = Array.from({ length: scope === 'hero' ? 8 : 12 }, makeParticle)
    let nextBolt = performance.now() + 4500, boltAt = -10000, boltX = .7
    let meteorAt = -10000, nextMeteor = performance.now() + 15000
    const wet = kind === 'rain' || kind === 'thunder', snow = kind === 'snow'
    const starry = kind === 'clear-night' || (kind === 'partly-cloudy' && sky === 'night-sky')
    const frameMs = wet || snow || windLevel > 0 ? 1000 / 24 : 1000 / 12

    function draw(now: number, dt: number) {
      ctx!.clearRect(0, 0, width, height)
      if (media.matches) return
      if (wet) {
        ctx!.strokeStyle = scope === 'hero' ? 'rgba(215,235,255,.6)' : 'rgba(200,225,250,.5)'
        ctx!.lineWidth = 1; ctx!.beginPath()
        for (const p of particles) {
          const x = p.x * width, y = p.y * height
          ctx!.moveTo(x, y); ctx!.lineTo(x + 3 + windLevel * 6, y + 13 + p.size * 9)
          p.y += (220 + p.speed * 200) * dt / height
          p.x += (25 + windLevel * 75) * dt / width
          if (p.y > 1.08 || p.x > 1.1) { p.y = -.08; p.x = random() * 1.15 - .1 }
        }
        ctx!.stroke()
      } else if (snow) {
        for (const p of particles) {
          p.phase += dt * .9
          ctx!.fillStyle = `rgba(255,255,255,${.5 + p.speed * .3})`
          ctx!.beginPath(); ctx!.arc(p.x * width + Math.sin(p.phase) * 12, p.y * height, p.size * 1.8, 0, Math.PI * 2); ctx!.fill()
          p.y += (15 + p.speed * 20) * dt / height; p.x += (8 + windLevel * 35) * dt / width
          if (p.y > 1.04 || p.x > 1.1) { p.y = -.04; p.x = random() }
        }
      } else if (starry || kind === 'clear-day') {
        for (const p of particles) {
          p.phase += dt * (.25 + p.speed * .3)
          const alpha = starry ? .22 + Math.sin(p.phase) ** 2 * .5 : .07 + Math.sin(p.phase) ** 2 * .16
          ctx!.fillStyle = starry ? `rgba(240,245,255,${alpha})` : `rgba(255,240,190,${alpha})`
          ctx!.beginPath(); ctx!.arc(p.x * width, p.y * height * (starry ? .68 : 1), p.size * (starry ? .85 : 1.5), 0, Math.PI * 2); ctx!.fill()
        }
      }
      // 바람은 비·눈과 독립적으로 겹친다. 강풍에는 빠른 곡선과 작은 잎을 더한다.
      if (windLevel > 0) {
        ctx!.lineWidth = windLevel >= 2 ? 1.2 : .8
        for (let i = 0; i < gusts.length; i++) {
          const p = gusts[i]
          p.x += (45 + windLevel * 65) * p.speed * dt / width; p.phase += dt
          if (p.x > 1.4) { p.x = -.4; p.y = random() }
          const x = p.x * width, y = p.y * height + Math.sin(p.phase) * 7, length = (28 + windLevel * 20) * p.size
          ctx!.strokeStyle = `rgba(220,240,250,${windLevel >= 2 ? .28 : .12})`
          ctx!.beginPath(); ctx!.moveTo(x, y); ctx!.quadraticCurveTo(x + length * .5, y - 8, x + length, y - 2); ctx!.stroke()
          if (windLevel >= 2 && !wet && !snow && i % 3 === 0) {
            ctx!.save(); ctx!.translate(x, y); ctx!.rotate(p.phase * 2)
            ctx!.fillStyle = i % 2 ? 'rgba(225,200,145,.55)' : 'rgba(175,208,183,.5)'
            ctx!.beginPath(); ctx!.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx!.fill(); ctx!.restore()
          }
        }
      }
      if (kind === 'thunder' && running) {
        if (now >= nextBolt) { boltAt = now; boltX = .45 + random() * .4; nextBolt = now + 11000 + random() * 8000 }
        const fade = Math.max(0, 1 - (now - boltAt) / 900)
        if (fade > 0) {
          // 좁은 번개와 국소 빛만. 전체 화면을 하얗게 반짝이지 않는다.
          const x = width * boltX, y = height * .04
          ctx!.strokeStyle = `rgba(220,220,255,${fade * .6})`; ctx!.lineWidth = 1.8
          ctx!.shadowColor = 'rgba(180,185,255,.5)'; ctx!.shadowBlur = 12
          ctx!.beginPath(); ctx!.moveTo(x, y); ctx!.lineTo(x - 18, y + 25); ctx!.lineTo(x + 2, y + 23); ctx!.lineTo(x - 26, y + 68); ctx!.stroke(); ctx!.shadowBlur = 0
          const light = ctx!.createRadialGradient(x, y + 30, 0, x, y + 30, Math.min(width, 260))
          light.addColorStop(0, `rgba(190,185,255,${fade * .09})`); light.addColorStop(1, 'rgba(190,185,255,0)')
          ctx!.fillStyle = light; ctx!.fillRect(0, 0, width, height * .5)
        }
      }
      if (starry && running) {
        if (now >= nextMeteor) { meteorAt = now; nextMeteor = now + 18000 + random() * 12000 }
        const progress = (now - meteorAt) / 1300
        if (progress >= 0 && progress <= 1) {
          const x = width * (.8 - progress * .3), y = height * (.08 + progress * .12)
          ctx!.strokeStyle = `rgba(235,245,255,${Math.sin(progress * Math.PI) * .5})`; ctx!.lineWidth = 1
          ctx!.beginPath(); ctx!.moveTo(x + 35, y - 14); ctx!.lineTo(x, y); ctx!.stroke()
        }
      }
    }
    function frame(now: number) {
      if (!running) return
      if (now - last >= frameMs) { const dt = Math.min((now - last) / 1000, .075); last = now; draw(now, dt) }
      raf = requestAnimationFrame(frame)
    }
    function sync() {
      const next = !paused && !media.matches && !document.hidden && visible
      setAnimated(next)
      onAnimatedChange?.(next)
      if (next === running) return
      running = next; cancelAnimationFrame(raf)
      if (running) { last = performance.now(); nextBolt = last + 4500; raf = requestAnimationFrame(frame) }
      else if (media.matches) ctx!.clearRect(0, 0, width, height)
    }
    function resize() {
      const box = wrap!.getBoundingClientRect()
      width = Math.max(1, box.width); height = Math.max(1, box.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1_800_000 / (width * height)))
      canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = Array.from({ length: particleBudget(width, height, scope === 'hero', intensity) }, makeParticle)
      draw(performance.now(), 0)
    }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    if (resizeObserver) resizeObserver.observe(wrap)
    else window.addEventListener('resize', resize)
    const intersectionObserver = scope === 'hero' && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }) : null
    intersectionObserver?.observe(wrap)
    document.addEventListener('visibilitychange', sync)
    if (media.addEventListener) media.addEventListener('change', sync)
    else media.addListener(sync)
    resize(); sync()
    return () => {
      running = false; cancelAnimationFrame(raf)
      resizeObserver?.disconnect(); intersectionObserver?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', sync)
      if (media.removeEventListener) media.removeEventListener('change', sync)
      else media.removeListener(sync)
    }
  }, [kind, windLevel, intensity, sky, scope, paused, onAnimatedChange])

  return (
    <div ref={wrapRef} className={`weather-atmosphere atmosphere-${scope} scene-${kind} sky-${sky} wind-${windLevel} ${animated ? 'is-animated' : 'is-still'}`} data-kind={kind} data-wind={windLevel} data-animated={animated} aria-hidden="true">
      {scope === 'page' && <img className="atmosphere-photo" src={`${import.meta.env.BASE_URL}images/weather-journal/${sky}.webp`} alt="" decoding="async" />}
      <div className="atmosphere-glow" />
      <div className="atmosphere-cloud cloud-one" /><div className="atmosphere-cloud cloud-two" /><div className="atmosphere-cloud cloud-three" />
      {kind === 'fog' && <><div className="atmosphere-mist mist-one" /><div className="atmosphere-mist mist-two" /></>}
      <canvas ref={canvasRef} className="atmosphere-particles" />
    </div>
  )
}
