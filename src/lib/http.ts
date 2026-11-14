// 시간 제한이 있는 JSON 요청 — 응답이 오지 않거나 본문을 받다 멈춘 요청이 첫 화면을 붙잡지 않게 한다.
// 시간 제한은 응답 머리가 아니라 본문을 다 읽을 때까지 건다 (약한 신호에서는 받다가 멈추는 일이 흔하다).
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

/** ms 안에 본문까지 받지 못하면 끊는다. outer 가 끊기면 같이 끊는다. 2xx 가 아니면 FetchFail('http') */
export async function fetchJsonTimeout<T>(url: string | URL, ms: number, outer?: AbortSignal): Promise<T> {
  const ctl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctl.abort()
  }, ms)
  const onOuter = () => ctl.abort()
  outer?.addEventListener('abort', onOuter)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new FetchFail('http', res.status)
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof FetchFail) throw e
    throw new FetchFail(timedOut || ctl.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuter)
  }
}

/** 선택 기능(미세먼지·특보)의 시간 초과는 "서비스 고장"이 아니다 — 잠시 쉬기(backoff)로 세지 않는다 */
export function isTimeout(e: unknown): boolean {
  // 브라우저에 따라 AbortSignal.timeout 이 AbortError 로 끝나기도 한다 (여기서 끊는 이유는 시간 초과뿐)
  const name = (e as { name?: string })?.name
  return name === 'TimeoutError' || name === 'AbortError' || (e instanceof FetchFail && e.reason === 'timeout')
}
