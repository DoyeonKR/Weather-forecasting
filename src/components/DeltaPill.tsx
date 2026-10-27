// 온도 차이 배지 — 글자 기호(▲▼↘) 대신 아이콘 + 숫자를 옅은 색 알약에 담는다.
// 따뜻해지면 주황, 쌀쌀해지면 파랑, 거의 같으면 회색 "비슷".
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'

export default function DeltaPill({
  delta,
  digits = 0,
  unit = '°',
  compact = false,
  sameText = '비슷',
}: {
  delta: number
  /** 소수 자릿수 (0이면 정수로 반올림) */
  digits?: number
  unit?: string
  /** 시간별 칸처럼 좁은 곳 */
  compact?: boolean
  sameText?: string
}) {
  const f = 10 ** digits
  const r = Math.round(delta * f) / f
  const same = Math.abs(r) < (digits ? 0.5 : 1)
  const mood = same ? 'same' : r > 0 ? 'warm' : 'cold'
  const Icon = r > 0 ? ArrowUp : ArrowDown
  const abs = Math.abs(r).toFixed(digits)
  return (
    <span
      className={`delta-pill ${mood} ${compact ? 'compact' : ''}`}
      aria-label={same ? sameText : `${abs}${unit === '°' ? '도' : unit} ${r > 0 ? '높음' : '낮음'}`}
    >
      {same ? (
        sameText
      ) : (
        <>
          <Icon size={compact ? 9 : 11} weight="bold" aria-hidden />
          {abs}
          {unit}
        </>
      )}
    </span>
  )
}
