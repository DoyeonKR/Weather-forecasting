// 공유 시트 — 기기 공유 창을 못 쓰는 환경(앱 안 브라우저·일부 데스크톱)에서
// 파일을 몰래 내려받는 대신 그림을 화면에 보여준다. 길게 눌러 저장하거나 버튼으로 저장·복사한다.
import { useEffect, useMemo, useState } from 'react'
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
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  const [msg, setMsg] = useState<string | null>(null)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="settings-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel share-sheet" role="dialog" aria-modal="true" aria-label="공유하기">
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
