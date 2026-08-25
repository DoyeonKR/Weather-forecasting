// 설정 패널 — 알림 온오프 + 색상 테마(포인트 컬러)
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { disableNotify, enableNotify, getNotifyState, type NotifyState } from '../lib/push'
import type { Place } from '../lib/places'
import { ACCENTS, ACCENT_KEY } from '../lib/accent'
import { DEFAULT_ORDER, SECTION_LABEL, moveItem, type SectionKey } from '../lib/sections'

const NIGHT_KEY = 'eojeboda:nighttime'
const MORNING_KEY = 'eojeboda:morningtime'
const fmt = (v: string) => `${v.slice(0, 2)}:${v.slice(2)}`
const MORNING_TIMES = ['0600', '0630', '0700', '0730', '0800', '0830', '0900']
const NIGHT_TIMES = ['2100', '2130', '2200', '2230', '2300']

interface Props {
  loc: { lat: number; lon: number; label: string }
  favorites: Place[]
  /** 처음 열 때 보여줄 지역 (current 또는 장소 id) */
  homeId: string
  onSetHome: (id: string) => void
  sectionOrder: SectionKey[]
  onSetOrder: (next: SectionKey[]) => void
}

export default function Settings({ loc, favorites, homeId, onSetHome, sectionOrder, onSetOrder }: Props) {
  const [open, setOpen] = useState(false)
  const [notify, setNotify] = useState<NotifyState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [accent, setAccent] = useState<string>(() => {
    try {
      return localStorage.getItem(ACCENT_KEY) ?? 'blue'
    } catch {
      return 'blue'
    }
  })
  const [nightTime, setNightTime] = useState<string>(() => {
    try {
      return localStorage.getItem(NIGHT_KEY) ?? '2130'
    } catch {
      return '2130'
    }
  })
  const [morningTime, setMorningTime] = useState<string>(() => {
    try {
      return localStorage.getItem(MORNING_KEY) ?? '0730'
    } catch {
      return '0730'
    }
  })

  useEffect(() => {
    getNotifyState().then(setNotify)
  }, [])

  function pickAccent(id: string) {
    setAccent(id)
    try {
      localStorage.setItem(ACCENT_KEY, id)
    } catch {
      // 무시
    }
    if (id === 'blue') delete document.documentElement.dataset.accent
    else document.documentElement.dataset.accent = id
  }

  async function toggleNotify() {
    if (busy || notify === 'loading' || notify === 'unsupported' || notify === 'needs-install') return
    setBusy(true)
    try {
      if (notify === 'on') {
        await disableNotify()
        setNotify('off')
      } else {
        const ok = await enableNotify(loc, nightTime, morningTime)
        setNotify(ok ? 'on' : 'off')
        if (!ok) alert('알림 권한이 필요해요. 브라우저 설정에서 알림을 허용해주세요.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function pickTime(kind: 'morning' | 'night', v: string) {
    const prev = kind === 'morning' ? morningTime : nightTime
    const nextMorning = kind === 'morning' ? v : morningTime
    const nextNight = kind === 'night' ? v : nightTime
    if (kind === 'morning') setMorningTime(v)
    else setNightTime(v)
    try {
      localStorage.setItem(kind === 'morning' ? MORNING_KEY : NIGHT_KEY, v)
    } catch {
      // 무시
    }
    // 이미 켜져 있으면 새 시간으로 재등록. 실패하면 화면도 원래 시간으로 되돌린다.
    if (notify === 'on' && !busy) {
      setBusy(true)
      try {
        const ok = await enableNotify(loc, nextNight, nextMorning)
        if (!ok) {
          if (kind === 'morning') setMorningTime(prev)
          else setNightTime(prev)
          try {
            localStorage.setItem(kind === 'morning' ? MORNING_KEY : NIGHT_KEY, prev)
          } catch {
            // 무시
          }
          alert('알림 시간을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
        }
      } finally {
        setBusy(false)
      }
    }
  }

  return (
    <>
      <button type="button" className="gear" aria-label="설정" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open &&
        createPortal(
          <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="설정">
          <div className="settings-panel">
            <div className="settings-head">
              <h2 className="settings-title">설정</h2>
              <button type="button" className="promo-x" aria-label="닫기" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div className="settings-sec">
              <div className="notify-row">
                <div>
                  <h3 className="settings-sec-title">🔔 날씨 알림</h3>
                  <p className="muted small notify-desc">
                    아침엔 오늘 날씨 브리핑, 밤엔 내일이 오늘과 크게 다를 때 출근 준비물을
                    알려드려요. 시간은 아래에서 선택하세요.
                    {notify === 'on' ? ` 지금은 ${loc.label} 기준으로 받는 중.` : ''}
                    {notify === 'unsupported' ? ' 이 브라우저에서는 지원되지 않아요.' : ''}
                    {notify === 'needs-install'
                      ? ' 아이폰은 공유 버튼에서 홈 화면에 추가한 뒤 알림을 켤 수 있어요.'
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={`notify-toggle ${notify === 'on' ? 'on' : ''}`}
                  onClick={toggleNotify}
                  disabled={
                    busy || notify === 'loading' || notify === 'unsupported' || notify === 'needs-install'
                  }
                  aria-label={notify === 'on' ? '알림 끄기' : '알림 켜기'}
                >
                  <span className="notify-knob" />
                </button>
              </div>
              <div className="night-row">
                <span className="muted small">☀️ 아침 브리핑 시간</span>
                <div className="night-times">
                  {MORNING_TIMES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`night-chip ${morningTime === v ? 'on' : ''}`}
                      onClick={() => pickTime('morning', v)}
                      disabled={busy}
                    >
                      {fmt(v)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="night-row">
                <span className="muted small">🌙 내일 준비 알림 시간</span>
                <div className="night-times">
                  {NIGHT_TIMES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`night-chip ${nightTime === v ? 'on' : ''}`}
                      onClick={() => pickTime('night', v)}
                      disabled={busy}
                    >
                      {fmt(v)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-sec">
              <h3 className="settings-sec-title">🏠 처음 열 때 보여줄 지역</h3>
              <p className="muted small notify-desc">앱을 켜면 이 지역 날씨부터 보여드려요.</p>
              <div className="night-times">
                <button
                  type="button"
                  className={`night-chip ${homeId === 'current' ? 'on' : ''}`}
                  onClick={() => onSetHome('current')}
                >
                  📍 현재 위치
                </button>
                {favorites.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`night-chip ${homeId === f.id ? 'on' : ''}`}
                    onClick={() => onSetHome(f.id)}
                  >
                    ⭐ {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-sec">
              <h3 className="settings-sec-title">🧩 화면 순서</h3>
              <p className="muted small notify-desc">
                메인 화면 카드 순서예요. 화면에서 카드를 길게 눌러 끌어도 바꿀 수 있어요.
              </p>
              <ul className="order-list">
                {sectionOrder.map((k, i) => (
                  <li key={k}>
                    <span className="order-name">{SECTION_LABEL[k]}</span>
                    <span className="order-btns">
                      <button type="button" aria-label="위로" disabled={i === 0} onClick={() => onSetOrder(moveItem(sectionOrder, i, i - 1))}>▲</button>
                      <button type="button" aria-label="아래로" disabled={i === sectionOrder.length - 1} onClick={() => onSetOrder(moveItem(sectionOrder, i, i + 1))}>▼</button>
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" className="order-reset" onClick={() => onSetOrder([...DEFAULT_ORDER])}>기본 순서로</button>
            </div>

            <div className="settings-sec">
              <h3 className="settings-sec-title">🎨 색상 테마</h3>
              <p className="muted small notify-desc">버튼과 강조색이 바뀌어요.</p>
              <div className="accent-row">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`accent-dot ${accent === a.id ? 'on' : ''}`}
                    style={{ background: a.color }}
                    onClick={() => pickAccent(a.id)}
                    aria-label={`${a.name} 테마`}
                    title={a.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
