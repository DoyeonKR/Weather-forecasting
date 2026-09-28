// 운영자용 이용 통계 — 주소 끝에 #stats 를 붙이면 열린다.
// 날짜·기능별 "사람 수 (건수)"만 보여준다. 개별 기록은 서버가 내보내지 않는다.
import { useEffect, useMemo, useState } from 'react'
import { SB_ANON, SB_URL } from '../lib/track'

interface Row {
  day: string
  name: string
  events: number
  people: number
}

const LABEL: Record<string, string> = {
  visit: '방문',
  share: '공유 누름',
  share_done: '공유 완료',
  search: '지역 검색',
  place_select: '지역 전환',
  notify_on: '알림 켬',
  notify_off: '알림 끔',
  rain_alert_on: '비 알림 켬',
  rain_alert_off: '비 알림 끔',
  refresh: '새로고침',
  feel_vote: '체감 답변',
  hourly_scroll: '7일 그래프 넘김',
  commute_set: '출퇴근 설정',
}

export default function StatsPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)
  const [days, setDays] = useState(7)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(false)
    fetch(`${SB_URL}/rest/v1/rpc/weather_events_summary`, {
      method: 'POST',
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_days: days }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setRows(Array.isArray(d) ? d : []))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [days])

  const { dates, names, cell, totals } = useMemo(() => {
    const list = rows ?? []
    const dates = [...new Set(list.map((r) => r.day))].sort().reverse()
    const order = Object.keys(LABEL)
    const names = [...new Set(list.map((r) => r.name))].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const cell = new Map(list.map((r) => [`${r.day}|${r.name}`, r]))
    const totals = new Map<string, { events: number; people: number }>()
    for (const r of list) {
      const t = totals.get(r.name) ?? { events: 0, people: 0 }
      t.events += r.events
      t.people += r.people
      totals.set(r.name, t)
    }
    return { dates, names, cell, totals }
  }, [rows])

  const visitPeople = totals.get('visit')?.people ?? 0

  return (
    <div className="settings-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel stats-panel" role="dialog" aria-modal="true" aria-label="이용 통계">
        <div className="settings-head">
          <h2 className="settings-title">이용 통계</h2>
          <button type="button" className="promo-x" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="night-times">
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" className={`night-chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>
              최근 {d}일
            </button>
          ))}
        </div>
        {error && <p className="muted small">통계를 불러오지 못했어요.</p>}
        {!rows && !error && <p className="muted small">불러오는 중…</p>}
        {rows && (
          <>
            <p className="muted small">
              칸마다 사람 수(건수). 날짜별 사람 수를 더한 값이라 같은 사람이 여러 날 오면 여러 번 셉니다.
            </p>
            <div className="stats-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>기능</th>
                    <th>합계</th>
                    <th>방문 대비</th>
                    {dates.map((d) => (
                      <th key={d}>{d.slice(5)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {names.map((n) => {
                    const t = totals.get(n)!
                    return (
                      <tr key={n}>
                        <th>{LABEL[n] ?? n}</th>
                        <td>
                          {t.people} <small>({t.events})</small>
                        </td>
                        <td>{n === 'visit' || !visitPeople ? '' : `${Math.round((t.people / visitPeople) * 100)}%`}</td>
                        {dates.map((d) => {
                          const c = cell.get(`${d}|${n}`)
                          return <td key={d}>{c ? c.people : ''}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
