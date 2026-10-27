// 상단 날씨 브리핑 띠 — 뉴스레터처럼 짧은 카드가 한 장씩 돈다. 스크롤해도 화면 위에 붙어 있다.
// .shell 에는 overflow: hidden 이 있어 안쪽 sticky 는 믿을 수 없다 → .shell 바깥에서 position: fixed,
// 본문은 .shell.has-brief 가 배너 높이 + 안전 영역만큼 내려간다 (App.css).
//
// 자동 전환을 멈추는 경우
//  · prefers-reduced-motion — 자동으로 넘기지 않는다(이전·다음으로만)
//  · 탭이 숨겨졌을 때, 마우스를 올렸거나 키보드 포커스가 배너 안에 있을 때 (WCAG 2.2.2)
// 자동으로 넘어가는 동안에는 낭독하지 않는다(aria-live off). 손으로 넘기면 polite 로 읽는다.
import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { buildBriefs } from '../lib/brief'
import type { WeatherData } from '../lib/weather'

const INTERVAL = 6000
const IMG_BASE = `${import.meta.env.BASE_URL}images/weather-brief/`

// 예전(v1.0.74)의 멈춤 버튼이 남긴 기록 — 버튼이 없어졌으니 남아 있으면 영영 멈춰 있게 된다. 한 번 지운다.
try {
  localStorage.removeItem('eojeboda.brief.paused')
} catch {
  // 저장소가 막혀 있으면 원래 없었던 것
}

function prefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function BriefBanner({ wx, resetKey }: { wx: WeatherData; resetKey: string }) {
  const [idx, setIdx] = useState(0)
  const [compact, setCompact] = useState(() => window.scrollY > 100)
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 100)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // "일몰까지 2시간 10분"이 멈춰 있지 않게 1분마다 다시 만든다 (탭이 보일 때만)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [reduced] = useState(prefersReduced)
  const [tabHidden, setTabHidden] = useState(() => document.visibilityState === 'hidden')
  const [holding, setHolding] = useState(false)
  const [manual, setManual] = useState(false)
  const touchX = useRef<number | null>(null)

  // 지역이 바뀌면 첫 장부터 — 다른 지역 문구가 섞여 보이지 않게
  useEffect(() => {
    setIdx(0)
    setManual(false)
  }, [resetKey])

  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (tabHidden) return
    setNowMs(Date.now())
    const t = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [tabHidden])

  const cards = buildBriefs(wx, nowMs, -new Date(nowMs).getTimezoneOffset() * 60)
  const n = cards.length
  const cur = n ? idx % n : 0
  const auto = n > 1 && !reduced && !tabHidden && !holding

  useEffect(() => {
    if (!auto) return
    const t = window.setTimeout(() => setIdx((i) => (i + 1) % n), INTERVAL)
    return () => window.clearTimeout(t)
  }, [auto, cur, n])

  if (n === 0) return null

  const go = (d: number) => {
    setManual(true)
    setIdx((i) => (((i % n) + d) % n + n) % n)
  }
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const x0 = touchX.current
    touchX.current = null
    const x1 = e.changedTouches[0]?.clientX
    if (x0 === null || x1 === undefined) return
    if (Math.abs(x1 - x0) > 40) go(x1 < x0 ? 1 : -1)
  }

  return (
    <div className={`brief-bar ${compact ? 'compact' : ''}`}>
      <section
        className="brief"
        role="region"
        aria-roledescription="carousel"
        aria-label="날씨 브리핑"
        onMouseEnter={() => setHolding(true)}
        onMouseLeave={() => setHolding(false)}
        onFocus={() => setHolding(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false)
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="brief-slides" aria-live={auto || !manual ? 'off' : 'polite'}>
          {cards.map((c, i) => (
            <div
              key={c.id}
              className={`brief-slide ${i === cur ? 'on' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${n}`}
              aria-hidden={i !== cur}
              style={{ backgroundImage: `url(${IMG_BASE}${c.image}.webp)` }}
            >
              <p className="brief-title">{c.title}</p>
              <p className="brief-sub">{c.sub}</p>
            </div>
          ))}
        </div>
        {n > 1 && (
          <div className="brief-ctrl">
            <button type="button" onClick={() => go(-1)} aria-label="이전 브리핑">
              <CaretLeft size={14} weight="bold" aria-hidden />
            </button>
            <span className="brief-count" aria-hidden>
              {cur + 1}/{n}
            </span>
            <button type="button" onClick={() => go(1)} aria-label="다음 브리핑">
              <CaretRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
