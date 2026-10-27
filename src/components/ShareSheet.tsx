// 공유 시트 — 기기 공유 창을 못 쓰는 환경(앱 안 브라우저·일부 데스크톱)에서
// 파일을 몰래 내려받는 대신 그림을 화면에 보여준다. 길게 눌러 저장하거나 버튼으로 저장·복사한다.
import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { SHARE_URL } from '../lib/share'

/** 클립보드 API 가 없거나 막힌 곳(WebView)에서도 복사되게 예전 방식으로 한 번 더 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 아래 방식으로
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function ShareSheet({
  blob,
  text,
  onClose,
}: {
  blob: Blob | null
  text: string
  onClose: () => void
}) {
  // 주소를 만들고 지우는 일을 같은 효과 안에서 한다. useMemo 로 만들고 효과에서 지우면
  // StrictMode(개발)가 효과를 한 번 더 돌릴 때 이미 지운 주소를 <img> 가 계속 쓴다.
  const [url, setUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  // 열리면 시트로 포커스를 옮기고(스크린리더가 대화상자를 읽게), 닫히면 원래 자리(공유 버튼)로 돌려준다
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      const items = Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea, [tabindex="0"]') ?? [])
        .filter((el) => el.offsetParent !== null)
      if (!items.length) return
      if (e.shiftKey && (document.activeElement === items[0] || document.activeElement === panel)) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
        e.preventDefault()
        items[0].focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      root.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="settings-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} tabIndex={-1} className="settings-panel share-sheet" role="dialog" aria-modal="true" aria-label="공유하기">
        <div className="settings-head">
          <h2 className="settings-title">공유하기</h2>
          <button type="button" className="promo-x" aria-label="닫기" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        {url ? (
          <>
            <img className="share-img" src={url} alt="어제와 비교한 오늘 날씨 카드" />
            <p className="muted small">이미지를 길게 누르면 저장하거나 공유할 수 있어요.</p>
          </>
        ) : (
          <p className="muted small">그림을 만들지 못했어요. 아래 문구를 복사해서 보내주세요.</p>
        )}
        <div className="share-actions">
          {url && (
            <a className="order-reset" href={url} download="eojeboda-today.png">
              이미지 저장
            </a>
          )}
          <button
            type="button"
            className="order-reset"
            onClick={async () => {
              const ok = await copyText(`${text}\n${SHARE_URL}`)
              setMsg(ok ? '복사했어요' : '복사하지 못했어요. 아래 글을 길게 눌러 복사해 주세요')
              setManual(!ok)
            }}
          >
            문구·링크 복사
          </button>
        </div>
        {msg && (
          <p className="muted small" role="status">
            {msg}
          </p>
        )}
        {/* 복사가 막힌 환경에서는 글을 직접 골라 복사할 수 있게 보여준다 */}
        {manual && (
          <textarea
            className="share-text"
            readOnly
            rows={3}
            value={`${text}\n${SHARE_URL}`}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="공유할 문구"
          />
        )}
      </div>
    </div>
  )
}
