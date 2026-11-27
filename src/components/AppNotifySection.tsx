// 설정 > 날씨 알림 — 안드로이드 앱(APK) 안에서만. 웹뷰는 웹 푸시를 못 받아서 앱이 직접 알림을 만든다 (lib/appNotify).
// 웹(브라우저)에서는 Settings 의 웹 푸시 칸이 그대로 쓰인다. 같은 클래스 이름을 써서 모양은 같다.
import { useEffect, useRef, useState } from 'react'
import { Leaf, Moon, Sun, ThermometerHot, Umbrella } from '@phosphor-icons/react'
import {
  appNotifyDisable,
  appNotifyEnable,
  appNotifyInfo,
  appNotifyOpenSettings,
  appNotifyTest,
  appNotifyUpdate,
  appNotifyBatteryExemption,
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
  // 휴대폰 설정(알림 허용·배터리 최적화)에 갔다 돌아오면 다시 읽는다 — 누른 직후에는 아직 고르는 중이다
  useEffect(() => {
    if (!open || !supported) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') appNotifyInfo().then(setInfo)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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

  // 배터리 최적화 창은 앱 위에 뜨는 작은 창이라 돌아와도 visibilitychange 가 없다 → 누른 뒤 1분 동안 1초마다 확인
  const batteryPoll = useRef<number | null>(null)
  useEffect(() => () => {
    if (batteryPoll.current) window.clearInterval(batteryPoll.current)
  }, [])
  function exemptBattery() {
    void appNotifyBatteryExemption()
    if (batteryPoll.current) window.clearInterval(batteryPoll.current)
    let left = 60
    batteryPoll.current = window.setInterval(async () => {
      const i = await appNotifyInfo()
      if (i && !i.batteryOptimized) setInfo(i)
      if ((i && !i.batteryOptimized) || --left <= 0) {
        if (batteryPoll.current) window.clearInterval(batteryPoll.current)
        batteryPoll.current = null
      }
    }, 1000)
  }

  /** 조건 알림 하나 켜기·끄기 (켜져 있으면 앱이 한 시간쯤마다 확인하는 일을 다시 건다) */
  async function toggleAlert(kind: 'rain' | 'air' | 'temp') {
    if (!info) return
    setBusy(true)
    try {
      await appNotifyUpdate({ [kind]: !info[kind] })
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
          {/* 조건 알림 — 1.0.112+ 앱만 (그 전 앱은 info.rain 이 없다) */}
          {info?.rain !== undefined &&
            (
              [
                ['rain', Umbrella, '비 시작 알림', '한 시간 안에 비가 시작될 것 같으면 알려드려요. 07~21시에만, 6시간에 한 번까지.'],
                ['air', Leaf, '미세먼지 나쁨 알림', '지금 나쁨 이상이면 하루 한 번.'],
                ['temp', ThermometerHot, '폭염·한파 알림', '낮 최고 33° 이상이나 아침 최저 -5° 이하면 하루 한 번.'],
              ] as const
            ).map(([kind, Icon, title, desc]) => (
              <div className="notify-row rain-row" key={kind}>
                <div>
                  <h4 className="settings-sub-title"><Icon size={18} weight="duotone" aria-hidden /> {title}</h4>
                  <p className="muted small notify-desc">
                    {desc}
                    {on ? '' : ' 위의 날씨 알림을 먼저 켜주세요.'}
                  </p>
                </div>
                <button
                  type="button"
                  className={`notify-toggle ${on && info[kind] ? 'on' : ''}`}
                  onClick={() => toggleAlert(kind)}
                  disabled={busy || !on}
                  aria-label={info[kind] ? `${title} 끄기` : `${title} 켜기`}
                  role="switch"
                  aria-checked={on && !!info[kind]}
                >
                  <span className="notify-knob" />
                </button>
              </div>
            ))}
          {/* 제조사 절전이 알림을 늦출 수 있다 — 배터리 최적화 대상이면 한 번에 빼는 버튼 */}
          {on && info?.batteryOptimized && (
            <div className="notify-battery">
              <p className="muted small notify-desc">
                알림이 늦게 오거나 안 오면 이 앱을 배터리 최적화에서 빼 주세요.
                {info.maker === 'samsung'
                  ? ' 삼성 폰은 설정 > 배터리 > 백그라운드 사용 제한에서 이 앱이 「절전 앱」·「깊은 절전 앱」에 없는지도 확인해 주세요.'
                  : ''}
              </p>
              <button type="button" className="order-reset test-push" onClick={exemptBattery}>
                배터리 최적화에서 빼기
              </button>
            </div>
          )}
          <p className="muted small notify-desc">
            {info?.rain === undefined ? '비 시작·미세먼지·폭염 알림은 아직 크롬에서 연 사이트에서만 받을 수 있어요. ' : ''}
            크롬 사이트에서도 날씨 알림을 켜 두었다면 같은 알림이 두 번 올 수 있으니, 한쪽만 켜 두세요.
          </p>
        </>
      )}
    </>
  )
}
