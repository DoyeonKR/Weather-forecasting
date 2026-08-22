// 시간대별 기온·강수 — 앞으로 24시간 기온 곡선(어제 같은 시간대 점선 겹침) + 강수량 막대
import { codeLabel } from '../lib/compare'
import type { WeatherData } from '../lib/weather'

interface Props {
  wx: WeatherData
}

const W = 340
const H = 172
const PAD_L = 6
const PAD_R = 6
const TOP = 30
const CHART_H = 92
const RAIN_TOP = TOP + CHART_H + 8
const RAIN_H = 18

export default function HourlyCard({ wx }: Props) {
  const { time, temp, precip } = wx.hourly
  const nowHour = new Date().getHours()
  const start = 24 + nowHour
  const N = 24
  const idx = Array.from({ length: N }, (_, i) => start + i).filter((i) => i < temp.length)
  if (idx.length < 6) return null
  const tToday = idx.map((i) => temp[i])
  const tYest = idx.map((i) => temp[i - 24])
  const pr = idx.map((i) => precip[i] ?? 0)
  const hours = idx.map((i) => new Date(time[i]).getHours())

  const all = [...tToday, ...tYest].filter((v) => typeof v === 'number' && !Number.isNaN(v))
  const lo = Math.floor(Math.min(...all)) - 1
  const hi = Math.ceil(Math.max(...all)) + 1
  const span = Math.max(hi - lo, 4)
  const innerW = W - PAD_L - PAD_R
  const x = (i: number) => PAD_L + (i / (idx.length - 1)) * innerW
  const y = (t: number) => TOP + (1 - (t - lo) / span) * CHART_H

  const line = (arr: number[]) =>
    arr.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(t).toFixed(1)}`).join(' ')
  // 오늘 곡선 아래 면적(그라데이션 채움)
  const area = `${line(tToday)} L${x(idx.length - 1).toFixed(1)} ${TOP + CHART_H} L${x(0).toFixed(1)} ${TOP + CHART_H} Z`

  const maxP = Math.max(...pr, 1)
  const barW = Math.max(innerW / idx.length - 2.5, 3)
  const tMin = Math.min(...tToday)
  const tMax = Math.max(...tToday)
  const iMin = tToday.indexOf(tMin)
  const iMax = tToday.indexOf(tMax)

  // 낮(6~18시) 배경 밴드
  const dayBands: { x1: number; x2: number }[] = []
  let bandStart = -1
  hours.forEach((h, i) => {
    const isDay = h >= 6 && h < 19
    if (isDay && bandStart < 0) bandStart = i
    if ((!isDay || i === hours.length - 1) && bandStart >= 0) {
      dayBands.push({ x1: x(bandStart) - innerW / idx.length / 2, x2: x(isDay ? i : i - 1) + innerW / idx.length / 2 })
      bandStart = -1
    }
  })

  const gridTemps: number[] = []
  for (let t = Math.ceil(lo / 5) * 5; t < hi; t += 5) gridTemps.push(t)

  return (
    <section className="card hourly-card">
      <div className="hourly-head">
        <h2 className="section-title">시간대별 기온·강수</h2>
        <div className="hourly-legend">
          <span>
            <i className="hl today" /> 오늘
          </span>
          <span>
            <i className="hl yest" /> 어제
          </span>
          <span>
            <i className="hl rain" /> 강수
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="hourly-svg" role="img" aria-label="앞으로 24시간 기온과 강수량">
        <defs>
          <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 낮 시간대 배경 밴드 */}
        {dayBands.map((b, i) => (
          <rect
            key={`d${i}`}
            x={Math.max(b.x1, 0)}
            y={TOP}
            width={Math.min(b.x2, W) - Math.max(b.x1, 0)}
            height={CHART_H}
            className="hourly-dayband"
          />
        ))}

        {/* 온도 격자선 */}
        {gridTemps.map((t) => (
          <g key={`g${t}`}>
            <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} className="hourly-grid" />
            <text x={PAD_L + 1} y={y(t) - 2} className="hourly-grid-label">
              {t}°
            </text>
          </g>
        ))}

        {/* 오늘 면적 + 곡선 */}
        <path d={area} fill="url(#hourlyFill)" />
        <path d={line(tYest)} className="hourly-line yest" />
        <path d={line(tToday)} className="hourly-line today" />

        {/* 강수 막대 */}
        {pr.map((p, i) =>
          p > 0 ? (
            <rect
              key={`p${i}`}
              x={x(i) - barW / 2}
              y={RAIN_TOP + (1 - Math.min(p / maxP, 1)) * RAIN_H}
              width={barW}
              height={Math.min(p / maxP, 1) * RAIN_H}
              rx={1.5}
              className="hourly-bar"
            />
          ) : null,
        )}

        {/* 지금 세로선 + 점 */}
        <line x1={x(0)} y1={TOP} x2={x(0)} y2={RAIN_TOP + RAIN_H} className="hourly-nowline" />
        <circle cx={x(0)} cy={y(tToday[0])} r={4} className="hourly-now" />

        {/* 최고/최저 라벨 */}
        <text x={x(iMax)} y={y(tMax) - 7} className="hourly-temp-label max" textAnchor="middle">
          ▲{Math.round(tMax)}°
        </text>
        <text x={x(iMin)} y={y(tMin) + 15} className="hourly-temp-label min" textAnchor="middle">
          ▼{Math.round(tMin)}°
        </text>

        {/* 시간 라벨 (3시간 간격) + 날씨 이모지 */}
        {idx.map((_i, k) => {
          if (k % 3 !== 0) return null
          return (
            <text key={`h${k}`} x={x(k)} y={H - 4} className="hourly-hour" textAnchor="middle">
              {k === 0 ? '지금' : `${hours[k]}시`}
            </text>
          )
        })}
      </svg>
      <div className="hourly-foot muted small">
        {(() => {
          const rainy = pr.findIndex((p, k) => p >= 0.5 && k > 0)
          if (rainy > 0) return `${hours[rainy]}시쯤 비가 올 수 있어요`
          const lb = codeLabel(wx.today.code)
          return `앞으로 24시간 ${lb.label} 흐름이에요`
        })()}
      </div>
    </section>
  )
}
