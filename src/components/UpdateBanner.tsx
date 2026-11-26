// 안드로이드 앱 안에서만: 새 버전이 나오면 화면 아래에 작은 카드로 알린다 (lib/appUpdate.ts).
// 1.0.108 부터는 앱이 직접 받아 설치 창을 띄우고, 그 전 앱은 브라우저에서 APK 를 받게 한다.
import { useEffect, useState } from 'react'
import { ArrowCircleUp, X } from '@phosphor-icons/react'
import { canSelfUpdate, checkForUpdate, dismissUpdate, installUpdate, type InstallStatus, type Latest } from '../lib/appUpdate'
import { APK_URL } from '../lib/nativeWidget'
import { trackEvent } from '../lib/track'

const MESSAGE: Partial<Record<InstallStatus, string>> = {
  // 스토어 밖 앱은 Play 프로텍트가 매번 막는다 — 설치 창 뒤에서 안내가 보이도록 미리 적어 둔다
  installing: 'Play 프로텍트 경고가 나오면 「세부정보」를 펼쳐 「무시하고 설치」를 눌러 주세요.',
  need_permission: '「이 출처 허용」을 켜고 돌아와서 한 번 더 눌러 주세요.',
  up_to_date: '아직 새 파일이 준비되지 않았어요. 잠시 후 다시 해 주세요.',
  failed: '받지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.',
}

export default function UpdateBanner() {
  const [latest, setLatest] = useState<Latest | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [self] = useState(canSelfUpdate)

  useEffect(() => {
    let alive = true
    // 첫 화면을 그리는 데 방해되지 않게 조금 뒤에 묻는다
    const t = window.setTimeout(() => {
      checkForUpdate().then((l) => alive && setLatest(l))
    }, 2500)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [])

  if (!latest) return null

  const close = () => {
    dismissUpdate(latest.version)
    setLatest(null)
  }

  const update = async () => {
    trackEvent('apk_download', { from: 'update', self })
    if (!self) return // 링크가 브라우저로 연다
    setBusy(true)
    setMsg('')
    const status = await installUpdate()
    setBusy(false)
    setMsg(MESSAGE[status] ?? '')
  }

  return (
    <div className="update-card" role="status">
      <span className="update-icon" aria-hidden>
        <ArrowCircleUp size={26} weight="duotone" />
      </span>
      <div className="update-copy">
        <b>새 버전이 나왔어요</b>
        <small>{msg || `v${latest.version}${latest.notes ? ` · ${latest.notes}` : ''}`}</small>
      </div>
      {self ? (
        <button type="button" className="update-go" onClick={update} disabled={busy}>
          {busy ? '받는 중…' : '업데이트'}
        </button>
      ) : (
        <a className="update-go" href={APK_URL} onClick={update}>
          받기
        </a>
      )}
      <button type="button" className="update-close" onClick={close} aria-label="이 버전 알림 닫기">
        <X size={16} weight="bold" />
      </button>
    </div>
  )
}
