// 설정 패널 — 알림 온오프 + 색상 테마(포인트 컬러)
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  disableNotify,
  enableNotify,
  getNotifyState,
  getRainAlert,
  sendTestPush,
  setRainAlert,
  type NotifyState,
} from '../lib/push'
import type { Place } from '../lib/places'
import { ACCENTS, ACCENT_KEY } from '../lib/accent'
import { DEFAULT_ORDER, SECTION_LABEL, moveItem, type SectionKey } from '../lib/sections'
import type { CommutePrefs } from '../lib/commute'
import { feelLabel } from '../lib/feel'
import { trackEvent } from '../lib/track'

const AM_HOURS = [6, 7, 8, 9, 10]
const PM_HOURS = [16, 17, 18, 19, 20, 21]

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
  commute: CommutePrefs
  onSetCommute: (next: CommutePrefs) => void
  /** 내 체감 보정값(°C) */
  feelOffset: number
  onResetFeel: () => void
  /** 오늘 방문자 수 — 화면 위에는 10명 이상일 때만 보이니 운영자용으로 여기에도 */
  visitors: number | null
}

export default function Settings({
  loc,
  favorites,
  homeId,
  onSetHome,
  sectionOrder,
  onSetOrder,
  commute,
  onSetCommute,
  feelOffset,
  onResetFeel,
  visitors,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notify, setNotify] = useState<NotifyState | 'loading'>('loading')
  const [rain, setRain] = useState(false)
  const [busy, setBusy] = useState(false)
  // alert 은 패널을 닫은 한참 뒤에 맥락 없이 뜬다. 패널 안에 남는 문구로 알린다.
  const [notice, setNotice] = useState<string | null>(null)
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
    getRainAlert().then(setRain)
  }, [])

  async function testPush() {
    if (busy || notify !== 'on') return
    setBusy(true)
    setNotice(null)
    try {
      const r = await sendTestPush()
      setNotice(
        r === 'ok'
          ? '테스트 알림을 보냈어요. 몇 초 안에 도착하지 않으면 폰 알림 설정을 확인해주세요.'
          : r === 'too-soon'
            ? '방금 보냈어요. 1분 뒤에 다시 시도해주세요.'
            : r === 'no-sub'
              ? '이 기기의 알림 등록을 찾지 못했어요. 알림을 껐다가 다시 켜주세요.'
              : '테스트 알림을 보내지 못했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function toggleRain() {
    if (busy || notify !== 'on') return
    setBusy(true)
    setNotice(null)
    try {
      const next = !rain
      const r = await setRainAlert(next)
      if (r === 'ok') {
        setRain(next)
        trackEvent(next ? 'rain_alert_on' : 'rain_alert_off')
      } else if (r === 'no-sub') setNotice('날씨 알림을 먼저 켜주세요.')
      else setNotice('비 알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  // 진행 중에는 어떤 경로로도 닫지 않는다. 닫히면 결과 안내가 버려진다.
  const busyRef = useRef(false)
  busyRef.current = busy

  // 열리면 패널로 포커스를 옮기고, Escape 로 닫는다. 닫으면 원래 버튼으로 복귀.
  useEffect(() => {
    if (!open) return
    const opener = openerRef.current
    panelRef.current?.focus()
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !busyRef.current) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // 시트가 화면보다 길어 안쪽을 스크롤하면 뒤 페이지까지 같이 밀렸다
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      root.style.overflow = prevOverflow
      setNotice(null)
      opener?.focus()
    }
  }, [open])

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
    if (
      busy ||
      notify === 'loading' ||
      notify === 'unsupported' ||
      notify === 'needs-install' ||
      notify === 'blocked'
    )
      return
    setBusy(true)
    setNotice(null)
    try {
      if (notify === 'on') {
        const off = await disableNotify()
        // 못 껐으면 껐다고 표시하면 안 된다. 다음 날 아침에 또 알림이 온다.
        setNotify(off ? 'off' : await getNotifyState())
        if (off) {
          setRain(false)
          trackEvent('notify_off')
        }
        if (!off) setNotice('알림을 끄지 못했어요. 잠시 후 다시 시도해주세요.')
      } else {
        const r = await enableNotify(loc, nightTime, morningTime)
        setNotify(r === 'ok' ? 'on' : await getNotifyState())
        if (r === 'ok') trackEvent('notify_on')
        if (r === 'denied')
          setNotice('알림 권한이 필요해요. 브라우저 설정에서 알림을 허용해주세요.')
        else if (r === 'no-sw')
          setNotice('앱 준비가 아직 끝나지 않았어요. 새로고침한 뒤 다시 시도해주세요.')
        else if (r === 'save-failed')
          setNotice('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
        else if (r === 'save-unknown')
          setNotice('연결이 끊겨 저장 결과를 확인하지 못했어요. 연결된 뒤 한 번 더 확인해주세요.')
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
      setNotice(null)
      try {
        const r = await enableNotify(loc, nextNight, nextMorning)
        if (r === 'save-unknown') {
          // 서버에 닿았는지 모르는 상태다. 되돌리면 서버와 반대로 어긋날 수 있으니 그대로 둔다.
          setNotify(await getNotifyState())
          setNotice('연결이 끊겨 저장 결과를 확인하지 못했어요. 연결된 뒤 시간을 한 번 더 확인해주세요.')
        } else if (r !== 'ok') {
          if (kind === 'morning') setMorningTime(prev)
          else setNightTime(prev)
          try {
            localStorage.setItem(kind === 'morning' ? MORNING_KEY : NIGHT_KEY, prev)
          } catch {
            // 무시
          }
          // 저장이 실패하면서 구독까지 풀렸을 수 있다. 토글이 켜진 척하지 않도록 다시 읽는다.
          setNotify(await getNotifyState())
          setNotice('알림 시간을 저장하지 못했어요. 이전 시간으로 되돌렸습니다.')
        }
      } finally {
        setBusy(false)
      }
    }
  }

  return (
    <>
      <button ref={openerRef} type="button" className="gear" aria-label="설정" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open &&
        createPortal(
          <div
            className="settings-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) setOpen(false)
            }}
          >
          <div
            ref={panelRef}
            className="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="설정"
            tabIndex={-1}
          >
            <div className="settings-head">
              <h2 className="settings-title">설정</h2>
              <button
                type="button"
                className="promo-x"
                aria-label="닫기"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
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
                    {notify === 'blocked'
                      ? ' 브라우저에서 이 사이트의 알림을 차단해 뒀어요. 주소창 옆 자물쇠에서 알림을 허용으로 바꿔주세요.'
                      : ''}
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
                    busy ||
                    notify === 'loading' ||
                    notify === 'unsupported' ||
                    notify === 'needs-install' ||
                    notify === 'blocked'
                  }
                  aria-label={notify === 'on' ? '알림 끄기' : '알림 켜기'}
                >
                  <span className="notify-knob" />
                </button>
              </div>
              {notice && (
                <p className="muted small notify-desc notice" role="alert">
                  {notice}
                </p>
              )}
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
              {notify === 'on' && (
                <button type="button" className="order-reset test-push" onClick={testPush} disabled={busy}>
                  🔔 테스트 알림 보내기
                </button>
              )}
              <div className="notify-row rain-row">
                <div>
                  <h4 className="settings-sub-title">🌂 비 시작 알림</h4>
                  <p className="muted small notify-desc">
                    한 시간 안에 비가 시작될 것 같으면 알려드려요. 07~22시에만, 6시간에 한 번까지.
                    기상청 초단기예보 기준이라 국내에서만 동작해요.
                    {notify !== 'on' ? ' 위의 날씨 알림을 먼저 켜주세요.' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={`notify-toggle ${rain && notify === 'on' ? 'on' : ''}`}
                  onClick={toggleRain}
                  disabled={busy || notify !== 'on'}
                  aria-label={rain ? '비 시작 알림 끄기' : '비 시작 알림 켜기'}
                  aria-pressed={rain && notify === 'on'}
                >
                  <span className="notify-knob" />
                </button>
              </div>
            </div>

            <details className="settings-sec settings-group">
              <summary className="settings-sec-title">🚶 출퇴근 시간 <small>{commute.on ? `${commute.am}시 · ${commute.pm}시` : '꺼짐'}</small></summary>
              <div className="notify-row">
                <div>
                  <p className="muted small notify-desc">
                    "어제와 비교하면" 카드에 출근·퇴근 시각의 기온을 하루 전과 비교해 보여드려요.
                  </p>
                </div>
                <button
                  type="button"
                  className={`notify-toggle ${commute.on ? 'on' : ''}`}
                  onClick={() => onSetCommute({ ...commute, on: !commute.on })}
                  aria-label={commute.on ? '출퇴근 비교 끄기' : '출퇴근 비교 켜기'}
                  aria-pressed={commute.on}
                >
                  <span className="notify-knob" />
                </button>
              </div>
              {commute.on && (
                <>
                  <div className="night-row">
                    <span className="muted small">출근</span>
                    <div className="night-times">
                      {AM_HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`night-chip ${commute.am === h ? 'on' : ''}`}
                          onClick={() => onSetCommute({ ...commute, am: h })}
                        >
                          {h}시
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="night-row">
                    <span className="muted small">퇴근</span>
                    <div className="night-times">
                      {PM_HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`night-chip ${commute.pm === h ? 'on' : ''}`}
                          onClick={() => onSetCommute({ ...commute, pm: h })}
                        >
                          {h}시
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </details>

            <details className="settings-sec settings-group">
              <summary className="settings-sec-title">🧥 내 체감 보정 <small>{feelLabel(feelOffset) ? '보정 중' : '보정 없음'}</small></summary>
              <p className="muted small notify-desc">
                "어제 어땠어요?"에 답하면 옷차림 추천이 내 체감에 맞게 조금씩 옮겨가요. 이 기기에만 저장돼요.
                {' '}
                지금: {feelLabel(feelOffset) ?? '보정 없음'}
              </p>
              {Math.abs(feelOffset) >= 0.5 && (
                <button type="button" className="order-reset" onClick={onResetFeel}>
                  보정 초기화
                </button>
              )}
            </details>

            <details className="settings-sec settings-group">
              <summary className="settings-sec-title">🏠 처음 열 때 보여줄 지역</summary>
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
            </details>

            <details className="settings-sec settings-group">
              <summary className="settings-sec-title">🧩 화면 순서</summary>
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
            </details>

            <details className="settings-sec settings-group">
              <summary className="settings-sec-title">🎨 색상 테마</summary>
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
            </details>
            <p className="muted small settings-foot">
              오늘 방문 {visitors ?? '–'}명 · 화면 위에는 하루 10명이 넘을 때만 보여요
            </p>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
