// 설정 패널 — 알림 온오프 + 색상 테마(포인트 컬러)
import { useEffect, useState } from 'react'
import { disableNotify, enableNotify, getNotifyState, type NotifyState } from '../lib/push'

const ACCENT_KEY = 'eojeboda:accent'

export const ACCENTS = [
  { id: 'blue', name: '파랑', color: '#2f81f7' },
  { id: 'mint', name: '민트', color: '#10b981' },
  { id: 'purple', name: '퍼플', color: '#8b5cf6' },
  { id: 'orange', name: '오렌지', color: '#f97316' },
  { id: 'pink', name: '핑크', color: '#ec4899' },
] as const

export function applySavedAccent(): void {
  try {
    const saved = localStorage.getItem(ACCENT_KEY)
    if (saved && saved !== 'blue') document.documentElement.dataset.accent = saved
  } catch {
    // 무시
  }
}

interface Props {
  loc: { lat: number; lon: number; label: string }
}

export default function Settings({ loc }: Props) {
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
    if (busy || notify === 'loading' || notify === 'unsupported') return
    setBusy(true)
    try {
      if (notify === 'on') {
        await disableNotify()
        setNotify('off')
      } else {
        const ok = await enableNotify(loc)
        setNotify(ok ? 'on' : 'off')
        if (!ok) alert('알림 권한이 필요해요. 브라우저 설정에서 알림을 허용해주세요.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="gear" aria-label="설정" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && (
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
                    매일 아침 7:30 오늘 브리핑, 밤 9:30 내일이 크게 달라질 때 알려드려요.
                    {notify === 'on' ? ` 지금은 ${loc.label} 기준으로 받는 중.` : ''}
                    {notify === 'unsupported' ? ' 이 브라우저에서는 지원되지 않아요.' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={`notify-toggle ${notify === 'on' ? 'on' : ''}`}
                  onClick={toggleNotify}
                  disabled={busy || notify === 'loading' || notify === 'unsupported'}
                  aria-label={notify === 'on' ? '알림 끄기' : '알림 켜기'}
                >
                  <span className="notify-knob" />
                </button>
              </div>
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
        </div>
      )}
    </>
  )
}
