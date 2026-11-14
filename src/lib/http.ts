// 시간 제한이 있는 fetch — 응답이 오지 않는 요청이 첫 화면을 붙잡지 않게 한다.
// 실패 이유(시간 초과·서버 오류·네트워크)를 구분해서 던진다.

export type FailReason = 'timeout' | 'http' | 'network'

export class FetchFail extends Error {
  reason: FailReason
  status: number | null

  constructor(reason: FailReason, status: number | null = null) {
    super(reason === 'http' ? `HTTP ${status}` : reason)
    this.reason = reason
    this.status = status
  }
}

/** ms 안에 응답 헤더가 오지 않으면 끊는다. 2xx 가 아니면 FetchFail('http') */
export async function fetchTimeout(url: string | URL, ms: number, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal })
    if (!res.ok) throw new FetchFail('http', res.status)
    return res
  } catch (e) {
    if (e instanceof FetchFail) throw e
    throw new FetchFail(ctl.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }
}
