// 설정 > 날씨 알림 — 안드로이드 앱(APK) 안에서만. 웹뷰는 웹 푸시를 못 받아서 앱이 직접 알림을 만든다 (lib/appNotify).
// 웹(브라우저)에서는 Settings 의 웹 푸시 칸이 그대로 쓰인다. 같은 클래스 이름을 써서 모양은 같다.
import { useEffect, useState } from 'react'
import { Moon, Sun } from '@phosphor-icons/react'
import {
  appNotifyDisable,
  appNotifyEnable,
  appNotifyInfo,
  appNotifyOpenSettings,
  appNotifyTest,
  appNotifyUpdate,
  canAppNotify,
  type AppNotifyInfo,
} from '../lib/appNotify'
import { FALLBACK_NOTIFY_PLACE, notifyPlaceName, type NotifyPlace } from '../lib/notifyPlace'
import { trackEvent } from '../lib/track'

const MORNING_KEY = 'eojeboda:morningtime'
const NIGHT_KEY = 'eojeboda:nighttime'
const fmt = (v: string) => `${v.slice(0, 2)}:${v.slice(2)}`
const MORNING_TIMES = ['0600', '0630', '0700', '0730', '0800', '0830', '0900']
const NIGHT_TIMES = ['2100', '2130', '2200', '2230', '2300']

function savedTime(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export default function AppNotifySection({
  notifyPlace,
  persona,
  open,
}: {
  /** 알림 기준 지역 = 기본 지역 (lib/notifyPlace). null 이면 위치를 몰라 서울 기본 위치 */
  notifyPlace: NotifyPlace | null
  persona: string
  /** 설정 창이 열릴 때마다 앱 상태를 다시 읽는다 (휴대폰 설정에서 알림을 껐다 왔을 수 있다) */
  open: boolean
}) {
  const [supported] = useState(canAppNotify)
  const [info, setInfo] = useState<AppNotifyInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [needSettings, setNeedSettings] = useState(false)

  useEffect(() => {
    if (open && supported) appNotifyInfo().then(setInfo)
  }, [open, supported])

  const on = !!info?.enabled && !!info?.allowed
  const blocked = !!info?.enabled && info?.allowed === false
  const morning = info?.morning ?? savedTime(MORNING_KEY, '0730')
  const night = info?.night ?? savedTime(NIGHT_KEY, '2130')
  const place = notifyPlace ?? FALLBACK_NOTIFY_PLACE

  async function toggle() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    setNeedSettings(false)
    try {
      if (on) {
        await appNotifyDisable()
        trackEvent('notify_off')
      } else {
        const r = await appNotifyEnable({ lat: place.lat, lon: place.lon, label: place.label, persona, morning, night })
        if (r === 'on') trackEvent('notify_on', { source: 'app' })
        else if (r === 'denied') {
          setNotice('알림을 허용해야 받을 수 있어요. 허용 창이 다시 안 뜨면 아래 버튼으로 휴대폰 설정에서 켜 주세요.')
          setNeedSettings(true)
        } else if (r === 'blocked') {
          setNotice('휴대폰 설정에서 이 앱의 알림이 꺼져 있어요. 아래 버튼으로 켜 주세요.')
          setNeedSettings(true)
        } else setNotice('알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
      setInfo(await appNotifyInfo())
    } finally {
      setBusy(false)
    }
  }

  async function pick(kind: 'morning' | 'night', v: string) {
    try {
      localStorage.setItem(kind === 'morning' ? MORNING_KEY : NIGHT_KEY, v)
    } catch {
      // 앱에 저장되니 괜찮다
    }
    setBusy(true)
    try {
      // 꺼져 있으면 저장만, 켜져 있으면 알람을 새 시간으로 다시 건다
      await appNotifyUpdate(kind === 'morning' ? { morning: v } : { night: v })
      setInfo(await appNotifyInfo())
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setNotice(null)
    try {
      const r = await appNotifyTest()
      setNotice(
        r === 'sent'
          ? '테스트 알림을 보냈어요. 알림창을 확인해 보세요.'
          : r === 'blocked'
            ? '휴대폰 설정에서 이 앱의 알림이 꺼져 있어요.'
            : '테스트 알림을 보내지 못했어요.',
      )
      if (r === 'blocked') setNeedSettings(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="notify-row">
        <div>
          <p className="muted small notify-desc">
            아침엔 오늘 날씨 브리핑, 밤엔 내일이 오늘과 크게 다를 때 출근 준비물을 알려드려요.
            {` 알림은 기본 지역(${notifyPlaceName(notifyPlace)}) 기준이에요.`}
            {notifyPlace ? '' : ' 위치를 허용하거나 아래에서 기본 지역을 정하면 내 동네로 바뀌어요.'}
            {!supported ? ' 앱을 최신 버전으로 업데이트하면 켤 수 있어요.' : ''}
            {blocked ? ' 휴대폰 설정에서 이 앱의 알림이 꺼져 있어 지금은 오지 않아요.' : ''}
          </p>
        </div>
        <button
          type="button"
          className={`notify-toggle ${on ? 'on' : ''}`}
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={busy || !supported || (supported && info === null)}
          aria-label={on ? '알림 끄기' : '알림 켜기'}
        >
          <span className="notify-knob" />
        </button>
      </div>
      {notice && (
        <p className="muted small notify-desc notice" role="alert">
          {notice}
        </p>
      )}
      {(needSettings || blocked) && (
        <button type="button" className="order-reset test-push" onClick={() => appNotifyOpenSettings()}>
          휴대폰 알림 설정 열기
        </button>
      )}
      {supported && (
        <>
          <div className="night-row">
            <span className="muted small settings-time-label"><Sun size={16} weight="duotone" aria-hidden /> 아침 브리핑 시간</span>
            <div className="night-times">
              {MORNING_TIMES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`night-chip ${morning === v ? 'on' : ''}`}
                  aria-pressed={morning === v}
                  onClick={() => pick('morning', v)}
                  disabled={busy}
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="night-row">
            <span className="muted small settings-time-label"><Moon size={16} weight="duotone" aria-hidden /> 내일 준비 알림 시간</span>
            <div className="night-times">
              {NIGHT_TIMES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`night-chip ${night === v ? 'on' : ''}`}
                  aria-pressed={night === v}
                  onClick={() => pick('night', v)}
                  disabled={busy}
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          {on && (
            <button type="button" className="order-reset test-push" onClick={test} disabled={busy}>
              테스트 알림 보내기
            </button>
          )}
          <p className="muted small notify-desc">
            휴대폰이 절전 중이면 몇 분 늦게 올 수 있어요. 비 시작·미세먼지·폭염 알림은 아직 크롬에서 연 사이트에서만 받을 수 있어요.
          </p>
        </>
      )}
    </>
  )
}
