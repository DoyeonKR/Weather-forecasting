// 설정 안내 팝업 — 앱에 들어올 때마다 한 번 띄워 설정에 있는 기능을 알린다.
// "다시 보지 않기"를 누른 기기에서는 더 띄우지 않는다.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, ChatCircleText, DeviceMobile, GearSix, House, MapPin, SlidersHorizontal, X } from '@phosphor-icons/react'
import { isNativeApp } from '../lib/nativeWidget'
import { trackEvent } from '../lib/track'
import { enableNotify, getNotifyState, type NotifyState } from '../lib/push'
import { FALLBACK_NOTIFY_PLACE, notifyPlaceName, type NotifyPlace } from '../lib/notifyPlace'
import { installHint, promptInstall, type InstallHint } from '../lib/install'
import { appNotifyEnable, appNotifyInfo, canAppNotify } from '../lib/appNotify'

/** 설정 화면과 같은 저장값 (Settings.tsx 의 NIGHT_KEY·MORNING_KEY) */
function savedTime(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}


const NEVER_KEY = 'eojeboda.settingsNudge.never'
const SESSION_KEY = 'eojeboda.settingsNudge.shown'

// 앱(APK) 안에서는 웹 푸시 대신 앱 알림(1.0.110+)·홈 화면 위젯을 소개한다
const WIDGET_FEATURE = { Icon: House, title: '홈 화면 위젯', desc: '앱을 열지 않아도 지금 기온·어제와 차이' }
const APP_NOTIFY_FEATURE = { Icon: Bell, title: '날씨 알림', desc: '아침 오늘 브리핑, 밤 내일 출근 준비' }

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

export default function SettingsNudge({
  onOpenSettings,
  notifyPlace,
  persona,
  onNotifyChange,
}: {
  onOpenSettings: () => void
  /** 앱 알림을 여기서 켤 때 넘길 말투 */
  persona: string
  /** 알림 기준 지역 = 기본 지역 (lib/notifyPlace). null 이면 아직 위치를 몰라 서울 기본 위치 */
  notifyPlace: NotifyPlace | null
  /** 여기서 알림을 켜면 설정 화면도 새 상태를 읽게 */
  onNotifyChange: () => void
}) {
  const [open, setOpen] = useState(shouldShow)
  // 바로 할 수 있는 한 가지: 알림 켜기(꺼져 있으면) · 홈 화면 설치(안 했으면)
  const [notify, setNotify] = useState<NotifyState | 'loading'>('loading')
  const [install] = useState<InstallHint>(installHint)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    if (open) getNotifyState().then(setNotify)
  }, [open])
  // 앱(1.0.110+): 웹 푸시 대신 앱이 직접 띄우는 알림 — 꺼져 있으면 여기서 바로 켠다
  const [appNotify] = useState(canAppNotify)
  const [appOn, setAppOn] = useState<boolean | null>(null)
  useEffect(() => {
    if (open && appNotify) appNotifyInfo().then((i) => setAppOn(i ? i.enabled && i.allowed : null))
  }, [open, appNotify])
  const appQuick = appNotify && appOn === false
  // 몇 명에게 보였는지 알아야 버튼을 누른 비율을 셀 수 있다
  const [shown] = useState(open)
  useEffect(() => {
    if (shown) trackEvent('nudge_shown')
  }, [shown])
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
    trackEvent('nudge_never')
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
          {(appNotify
            ? [APP_NOTIFY_FEATURE, WIDGET_FEATURE, ...FEATURES.slice(1, 3)]
            : isNativeApp()
              ? [WIDGET_FEATURE, ...FEATURES.slice(1)]
              : FEATURES
          ).map(({ Icon, title, desc }) => (
            <li key={title}>
              <span className="nudge-icon"><Icon size={20} weight="duotone" aria-hidden /></span>
              <span className="nudge-copy">
                <b>{title}</b>
                <small>{desc}</small>
              </span>
            </li>
          ))}
        </ul>
        {notify === 'off' && (
          <div className="nudge-quick">
            <button
              type="button"
              className="nudge-go"
              disabled={busy}
              onClick={async () => {
                // 권한 창은 이 버튼을 눌렀을 때만 띄운다 (한 번 거절하면 되돌리기 어렵다)
                setBusy(true)
                const r = await enableNotify(
                  notifyPlace ?? FALLBACK_NOTIFY_PLACE,
                  savedTime('eojeboda:nighttime', '2130'),
                  savedTime('eojeboda:morningtime', '0730'),
                )
                setBusy(false)
                trackEvent('nudge_notify', { result: r })
                if (r === 'ok') {
                  trackEvent('notify_on', { source: 'popup' })
                  setNotify('on')
                  onNotifyChange()
                  setResult('알림을 켰어요! 아침·밤 브리핑과 비·미세먼지·폭염 알림이 와요.')
                } else if (r === 'denied') {
                  setNotify(await getNotifyState())
                  setResult('알림이 막혀 있어요. 폰 설정에서 이 앱의 알림을 허용해 주세요.')
                } else {
                  setResult('알림을 켜지 못했어요. 잠시 뒤 설정에서 다시 시도해 주세요.')
                }
              }}
            >
              <Bell size={20} weight="bold" aria-hidden /> {busy ? '켜는 중…' : '알림 바로 켜기'}
            </button>
            <p className="nudge-note">
              아침·밤 브리핑 + 비·미세먼지·폭염 알림 · {notifyPlaceName(notifyPlace)} 기준
              {notifyPlace ? '' : ' (위치를 허용하거나 기본 지역을 정하면 내 동네로 바뀌어요)'}
            </p>
          </div>
        )}
        {appQuick && (
          <div className="nudge-quick">
            <button
              type="button"
              className="nudge-go"
              disabled={busy}
              onClick={async () => {
                // 안드로이드 13+ 알림 허용 창은 이 버튼을 눌렀을 때만 (설정 화면과 같은 값으로 켠다)
                setBusy(true)
                const place = notifyPlace ?? FALLBACK_NOTIFY_PLACE
                const r = await appNotifyEnable({
                  lat: place.lat,
                  lon: place.lon,
                  label: place.label,
                  persona,
                  morning: savedTime('eojeboda:morningtime', '0730'),
                  night: savedTime('eojeboda:nighttime', '2130'),
                })
                setBusy(false)
                trackEvent('nudge_notify', { result: r, via: 'app' })
                if (r === 'on') {
                  trackEvent('notify_on', { source: 'popup-app' })
                  setAppOn(true)
                  onNotifyChange()
                  setResult('알림을 켰어요! 아침엔 오늘 브리핑, 밤엔 내일 출근 준비가 와요. 설정에서 시간을 바꿀 수 있어요.')
                } else if (r === 'denied' || r === 'blocked') {
                  setResult('알림이 막혀 있어요. 설정 > 날씨 알림에서 휴대폰 알림 설정을 열어 허용해 주세요.')
                } else {
                  setResult('알림을 켜지 못했어요. 잠시 뒤 설정에서 다시 시도해 주세요.')
                }
              }}
            >
              <Bell size={20} weight="bold" aria-hidden /> {busy ? '켜는 중…' : '알림 바로 켜기'}
            </button>
            <p className="nudge-note">
              아침·밤 브리핑 · {notifyPlaceName(notifyPlace)} 기준
              {notifyPlace ? '' : ' (위치를 허용하거나 기본 지역을 정하면 내 동네로 바뀌어요)'}
            </p>
          </div>
        )}
        {notify === 'needs-install' && (
          <p className="nudge-steps">
            <DeviceMobile size={18} weight="duotone" aria-hidden /> 아이폰은 <b>공유 버튼 → 홈 화면에 추가</b> 후 홈 화면 앱에서 알림을 켤 수 있어요.
          </p>
        )}
        {install === 'button' && (
          <button
            type="button"
            className="nudge-install"
            onClick={async () => {
              const r = await promptInstall()
              trackEvent('install_prompt', { result: r })
              if (r === 'accepted') setResult('설치했어요! 홈 화면에서 바로 열 수 있어요.')
            }}
          >
            <DeviceMobile size={18} weight="bold" aria-hidden /> 홈 화면에 설치
          </button>
        )}
        {result && <p className="nudge-result" role="status">{result}</p>}
        <button
          type="button"
          className={notify === 'off' || appQuick ? 'nudge-secondary' : 'nudge-go'}
          onClick={() => {
            trackEvent('nudge_go')
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
