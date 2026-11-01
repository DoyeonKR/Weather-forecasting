// 설정 안내 팝업 — 앱에 들어올 때마다 한 번 띄워 설정에 있는 기능을 알린다.
// "다시 보지 않기"를 누른 기기에서는 더 띄우지 않는다.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, ChatCircleText, GearSix, MapPin, SlidersHorizontal, X } from '@phosphor-icons/react'

const NEVER_KEY = 'eojeboda.settingsNudge.never'
const SESSION_KEY = 'eojeboda.settingsNudge.shown'

const FEATURES = [
  { Icon: Bell, title: '푸시 알림', desc: '아침·밤 브리핑, 비·미세먼지 알림' },
  { Icon: MapPin, title: '지역 설정', desc: '처음 열 때 보여줄 우리 동네' },
  { Icon: ChatCircleText, title: '앱 말투', desc: '욕쟁이 할머니, 동네 형, 커뮤니티' },
  { Icon: SlidersHorizontal, title: '내 맞춤 설정', desc: '출퇴근 시간, 체감 보정, 화면 스타일' },
]

function shouldShow(): boolean {
  try {
    if (localStorage.getItem(NEVER_KEY) === '1') return false
    if (sessionStorage.getItem(SESSION_KEY) === '1') return false
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    // 저장소가 막혀 있으면 "다시 보지 않기"를 지킬 수 없다 → 띄우지 않는다
    return false
  }
}

export default function SettingsNudge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(shouldShow)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  const never = () => {
    try {
      localStorage.setItem(NEVER_KEY, '1')
    } catch {
      // 저장이 막혀 있으면 이번만 닫힌다
    }
    setOpen(false)
  }

  return createPortal(
    <div
      className="nudge-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div ref={panelRef} className="nudge" role="dialog" aria-modal="true" aria-labelledby="nudge-title" tabIndex={-1}>
        <button type="button" className="nudge-close" onClick={() => setOpen(false)} aria-label="닫기">
          <X size={18} weight="bold" aria-hidden />
        </button>
        <span className="nudge-badge">
          <GearSix size={30} weight="duotone" aria-hidden />
        </span>
        <h2 id="nudge-title" className="nudge-title">설정, 꼭 한 번 봐주세요!</h2>
        <p className="nudge-lead">내 입맛대로 바꾸는 기능이 설정에 다 있어요</p>
        <ul className="nudge-list">
          {FEATURES.map(({ Icon, title, desc }) => (
            <li key={title}>
              <span className="nudge-icon"><Icon size={20} weight="duotone" aria-hidden /></span>
              <span className="nudge-copy">
                <b>{title}</b>
                <small>{desc}</small>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="nudge-go"
          onClick={() => {
            setOpen(false)
            onOpenSettings()
          }}
        >
          <GearSix size={20} weight="bold" aria-hidden /> 설정 바로가기
        </button>
        <button type="button" className="nudge-never" onClick={never}>다시 보지 않기</button>
      </div>
    </div>,
    document.body,
  )
}
