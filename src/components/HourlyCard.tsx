// 시간대별 기온·강수 — 지금부터 3시간 간격으로 받아 둔 예보 끝(약 7일)까지.
// 한 화면에는 15시간쯤 보이고, 좌우로 밀면 뒷날이 이어진다.
// 각 시각은 "하루 전 같은 시각"과 비교한다: 점선이 하루 전, 두 선 사이 면의 색이
// 따뜻해졌는지(붉은색) 쌀쌀해졌는지(푸른색)를 보여주고, 칸마다 ▲▼ 차이를 적는다.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { codeLabel } from '../lib/compare'
import type { WeatherData } from '../lib/weather'
import { weatherIcon, weatherTone } from '../lib/weatherIcon'
import { trackEvent } from '../lib/track'

interface Props {
  wx: WeatherData
  embedded?: boolean
}

const STEP_H = 3
/** 한 칸 폭(px). 375 폭 카드에서 6칸이 보이도록 */
const COL = 52
const CHART_H = 96
const PAD_Y = 12
const RAIN_H = 16
/** 첫 화면 요약이 말하는 범위 (6칸) */
const FIRST_N = 6
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 강수량 표기 — 1mm 미만은 소수 한 자리 */
function mm(v: number) {
  return v < 1 ? `${v.toFixed(1)}mm` : `${Math.round(v)}mm`
}

function dayLabel(t: Date, today: Date): string {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
  const diff = Math.round((b - a) / 86_400_000)
  const md = `${t.getMonth() + 1}.${t.getDate()} ${WEEKDAYS[t.getDay()]}`
  if (diff === 0) return '오늘'
  if (diff === 1) return `내일 ${md}`
  if (diff === 2) return `모레 ${md}`
  return md
}

export default function HourlyCard({ wx, embedded = false }: Props) {
  const { time, temp, precip, code } = wx.hourly
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // 끝에 닿았는지(오른쪽 흐림·버튼 숨김), 한 번이라도 밀어 봤는지(안내 숨김)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
      if (el.scrollLeft > 8) {
        setScrolled((was) => {
          if (!was) trackEvent('hourly_scroll')
          return true
        })
      }
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [wx])

  // 마우스로도 끌어서 넘길 수 있게 (터치는 브라우저 기본 가로 스크롤)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 3) d.moved = true
    e.currentTarget.scrollLeft = d.left - dx
  }
  const endDrag = () => {
    drag.current = null
  }

  // 기기 시간이 아니라 해당 지역 현지 시각 기준 (다른 시간대 즐겨찾기 대응)
  const start = 24 + wx.nowHourLocal
  const idx: number[] = []
  for (let i = start; i < temp.length; i += STEP_H) {
    if (typeof temp[i] === 'number' && typeof temp[i - 24] === 'number') idx.push(i)
  }
  if (idx.length < FIRST_N) return null

  const n = idx.length
  const tNow = idx.map((i) => temp[i])
  const tPrev = idx.map((i) => temp[i - 24])
  const pr = idx.map((i) => precip[i] ?? 0)
  const anyRain = pr.some((p) => p > 0)
  const dates = idx.map((i) => new Date(time[i]))
  const hours = dates.map((d) => d.getHours())
  const labels = idx.map((i) => codeLabel(code?.[i] ?? wx.nowCode).label)
  const firstDay = dates[0]
  /** 새 날이 시작되는 칸 (첫 칸 포함) */
  const dayStarts = idx.map((_, k) => k === 0 || dates[k].getDate() !== dates[k - 1].getDate())

  const all = [...tNow, ...tPrev]
  const lo = Math.floor(Math.min(...all)) - 1
  const hi = Math.ceil(Math.max(...all)) + 1
  const span = Math.max(hi - lo, 4)
  const totalW = n * COL
  const x = (k: number) => (k + 0.5) * COL
  const y = (t: number) => PAD_Y + (1 - (t - lo) / span) * CHART_H

  const line = (arr: number[]) =>
    arr.map((t, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)} ${y(t).toFixed(1)}`).join(' ')

  // 두 선 사이 면 — 구간마다 따뜻해졌으면 붉게, 쌀쌀해졌으면 푸르게
  const bands = tNow.slice(0, -1).map((_, k) => {
    const warmer = tNow[k] + tNow[k + 1] - (tPrev[k] + tPrev[k + 1])
    const d =
      `M${x(k)} ${y(tNow[k])} L${x(k + 1)} ${y(tNow[k + 1])} ` +
      `L${x(k + 1)} ${y(tPrev[k + 1])} L${x(k)} ${y(tPrev[k])} Z`
    return { d, cls: Math.abs(warmer) < 1 ? 'same' : warmer > 0 ? 'warm' : 'cold' }
  })

  const maxP = Math.max(...pr, 1)
  const rainTop = PAD_Y * 2 + CHART_H
  // 비가 없으면 강수 막대 자리를 비워 두지 않는다
  const svgH = rainTop + (anyRain ? RAIN_H : 0)
  // 날짜별로 칸을 묶는다 — 묶음 안에서 날짜 표시가 왼쪽에 붙어(sticky) 밀어도 지금 보는 날이 보인다
  const groups: number[][] = []
  dayStarts.forEach((s, k) => (s ? groups.push([k]) : groups[groups.length - 1].push(k)))

  // 첫 화면 요약 — 하루 전체 코드가 아니라 처음 6칸(15시간)에서 가장 많이 나온 날씨
  const firstSpanH = (FIRST_N - 1) * STEP_H
  const summary = (() => {
    const rainy = pr.slice(0, FIRST_N).findIndex((p, k) => p >= 0.5 && k > 0)
    if (rainy > 0) return `${hours[rainy]}시쯤 비가 올 수 있어요`
    const counts = new Map<string, number>()
    for (const l of labels.slice(0, FIRST_N)) counts.set(l, (counts.get(l) ?? 0) + 1)
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return `앞으로 ${firstSpanH}시간 ${main.startsWith('대체로') ? main : `대체로 ${main}`}`
  })()
  const days = dayStarts.filter(Boolean).length

  return (
    <section className={`${embedded ? 'hourly-embedded' : 'card'} hourly-card`}>
      <div className="hourly-head">
        <h2 className="section-title">시간대별 기온·강수</h2>
        {!atEnd && (
          <button
            type="button"
            className="hs-more"
            onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth * 0.9, behavior: 'smooth' })}
          >
            {scrolled ? '다음' : `${days}일치 보기`} <CaretRight size={13} weight="bold" aria-hidden />
          </button>
        )}
      </div>
      <div className="hs-legend" aria-hidden>
        <span>
          <i className="hl today" /> 예보
        </span>
        <span>
          <i className="hl yest" /> 하루 전
        </span>
        <span>
          <i className="hl band warm" /> 더 따뜻
        </span>
        <span>
          <i className="hl band cold" /> 더 쌀쌀
        </span>
      </div>

      <div
        ref={scrollRef}
        className={`hourly-scroll ${atEnd ? 'at-end' : ''}`}
        tabIndex={0}
        role="region"
        aria-label={`시간대별 기온과 강수, ${days}일치. 옆으로 밀어서 더 보기`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="hs-inner" style={{ width: totalW }}>
          <div className="hs-cols" aria-hidden>
            {groups.map((g) => (
              <div className="hs-group" key={idx[g[0]]}>
                <span className="hs-day">{dayLabel(dates[g[0]], firstDay)}</span>
                <div className="hs-group-cols">
                  {g.map((k) => {
                    const Icon = weatherIcon(labels[k], hours[k] >= 6 && hours[k] < 19)
                    const d = Math.round(tNow[k] - tPrev[k])
                    return (
                      <div className="hs-col" key={idx[k]} style={{ width: COL }}>
                        <span className="hs-hour">{k === 0 ? '지금' : `${hours[k]}시`}</span>
                        <Icon size={22} weight="duotone" className={`wi-${weatherTone(labels[k])}`} />
                        <strong className="hs-temp">{Math.round(tNow[k])}°</strong>
                        <span className={`hs-delta ${d > 0 ? 'warm' : d < 0 ? 'cold' : 'same'}`}>
                          {d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '='}
                        </span>
                        {anyRain && <small className="hs-rain">{pr[k] > 0 ? mm(pr[k]) : '\u00a0'}</small>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`} className="hs-svg" aria-hidden>
            {/* 날짜 경계 */}
            {dayStarts.map((s, k) =>
              s && k > 0 ? <line key={`dv${k}`} x1={k * COL} y1={0} x2={k * COL} y2={svgH} className="hs-daysep" /> : null,
            )}
            {bands.map((b, k) => (
              <path key={`b${k}`} d={b.d} className={`hs-band ${b.cls}`} />
            ))}
            <path d={line(tPrev)} className="hs-line prev" />
            <path d={line(tNow)} className="hs-line now" />
            {tNow.map((t, k) => (
              <circle key={`c${k}`} cx={x(k)} cy={y(t)} r={k === 0 ? 4.5 : 2.6} className={k === 0 ? 'hs-dot first' : 'hs-dot'} />
            ))}
            {pr.map((p, k) =>
              p > 0 ? (
                <rect
                  key={`p${k}`}
                  x={x(k) - 10}
                  y={rainTop + (1 - Math.min(p / maxP, 1)) * RAIN_H}
                  width={20}
                  height={Math.max(Math.min(p / maxP, 1) * RAIN_H, 2)}
                  rx={2}
                  className="hs-rainbar"
                />
              ) : null,
            )}
          </svg>
        </div>
      </div>

      <div className="hourly-foot muted small">{summary}</div>
    </section>
  )
}
