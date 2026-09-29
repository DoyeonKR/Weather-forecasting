// 홈 화면에 설치하기 — 크롬 계열은 설치 버튼을 직접 띄울 수 있고, 아이폰은 사파리 공유 메뉴로만 된다.
// 알림은 아이폰에서 설치한 앱에서만 오므로 안내가 중요하다 (lib/push.ts 의 needs-install).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** 앱 시작 때 한 번. 브라우저가 이벤트를 보내는 시점은 설정을 열기 한참 전이다 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 미니 배너 대신 우리 버튼에서 띄운다
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function isIos(): boolean {
  try {
    return (
      /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )
  } catch {
    return false
  }
}

/** 지금 설치 버튼을 띄울 수 있는가 */
export function canPromptInstall(): boolean {
  return deferred !== null && !isStandalone()
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const ev = deferred
  // 한 번 쓰면 다시 못 쓰는 이벤트다
  deferred = null
  emit()
  try {
    await ev.prompt()
    return (await ev.userChoice).outcome
  } catch {
    return 'unavailable'
  }
}

/** 설정에 무엇을 보여줄지 */
export type InstallHint = 'installed' | 'button' | 'ios-steps' | 'none'

export function installHint(): InstallHint {
  if (isStandalone()) return 'installed'
  if (canPromptInstall()) return 'button'
  if (isIos()) return 'ios-steps'
  return 'none'
}
