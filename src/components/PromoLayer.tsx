// 접속 시 1회 노출되는 날씨 연동 추천 레이어 (쿠팡 파트너스)
import { useEffect, useState } from 'react'
import { PARTNERS_NOTICE, type PartnerItem } from '../lib/partners'

const SEEN_KEY = 'eojeboda:promo-seen'

interface Props {
  picks: PartnerItem[]
}

export default function PromoLayer({ picks }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (picks.length === 0) return
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return
    } catch {
      // 스토리지 불가 시에도 1회는 노출
    }
    const t = window.setTimeout(() => {
      setOpen(true)
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        // 무시
      }
    }, 1200)
    return () => window.clearTimeout(t)
    // 최초 로드 시 1회만 판단
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!open || picks.length === 0) return null
  const main = picks[0]

  return (
    <div className="promo-backdrop" role="dialog" aria-modal="true" aria-label="오늘의 준비물 추천">
      <div className="promo-card">
        <button type="button" className="promo-x" aria-label="닫기" onClick={() => setOpen(false)}>
          ✕
        </button>
        <div className="promo-emoji" aria-hidden>
          {main.emoji}
        </div>
        <h3 className="promo-title">오늘의 준비물</h3>
        <p className="promo-desc">무능한 날씨예측기가 오늘 날씨를 보고 골랐어요.</p>
        <div className="promo-actions">
          {picks.map((p) => (
            <a
              key={p.url}
              className="promo-cta"
              href={p.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              {p.emoji} {p.label}
            </a>
          ))}
          <button type="button" className="promo-later" onClick={() => setOpen(false)}>
            오늘은 괜찮아요
          </button>
        </div>
        <p className="promo-notice">{PARTNERS_NOTICE}</p>
      </div>
    </div>
  )
}
