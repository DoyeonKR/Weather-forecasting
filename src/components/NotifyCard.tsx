// 알림 설정 카드 — 매일 아침·밤 날씨 푸시 온오프
import { useEffect, useState } from 'react'
import { disableNotify, enableNotify, getNotifyState, type NotifyState } from '../lib/push'

interface Props {
  loc: { lat: number; lon: number; label: string }
}

export default function NotifyCard({ loc }: Props) {
  const [state, setState] = useState<NotifyState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getNotifyState().then(setState)
  }, [])

  if (state === 'loading' || state === 'unsupported') return null

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      if (state === 'on') {
        await disableNotify()
        setState('off')
      } else {
        const ok = await enableNotify(loc)
        setState(ok ? 'on' : 'off')
        if (!ok) alert('알림 권한이 필요해요. 브라우저 설정에서 알림을 허용해주세요.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card notify-card">
      <div className="notify-row">
        <div>
          <h2 className="section-title notify-title">🔔 날씨 알림</h2>
          <p className="muted small notify-desc">
            매일 아침 7:30 오늘 브리핑, 밤 9:30 내일이 크게 달라질 때 알려드려요.
            {state === 'on' ? ` 지금은 ${loc.label} 기준으로 받는 중.` : ''}
          </p>
        </div>
        <button
          type="button"
          className={`notify-toggle ${state === 'on' ? 'on' : ''}`}
          onClick={toggle}
          disabled={busy}
          aria-label={state === 'on' ? '알림 끄기' : '알림 켜기'}
        >
          <span className="notify-knob" />
        </button>
      </div>
    </section>
  )
}
