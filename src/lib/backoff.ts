// 선택 기능용 외부 호출이 실패하면 잠시 쉬었다가 다시 시도한다.
// (에어코리아·특보는 서비스 승인 전에는 매번 502 라서, 페이지를 열 때마다 헛요청·콘솔 오류가 쌓였다.
//  승인이 나면 쉬는 시간이 지난 뒤 저절로 다시 붙는다.)

const KEY = 'eojeboda.backoff.v1'
const DEFAULT_MS = 15 * 60 * 1000

function read(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/** 지금 이 호출을 건너뛰어야 하는가 */
export function isBackedOff(name: string, now = Date.now()): boolean {
  const until = read()[name]
  return typeof until === 'number' && until > now
}

export function markFailed(name: string, ms = DEFAULT_MS, now = Date.now()): void {
  try {
    const cur = read()
    cur[name] = now + ms
    localStorage.setItem(KEY, JSON.stringify(cur))
  } catch {
    // 저장이 막혀도 이번 화면에는 영향 없다
  }
}

export function markOk(name: string): void {
  try {
    const cur = read()
    if (!(name in cur)) return
    delete cur[name]
    localStorage.setItem(KEY, JSON.stringify(cur))
  } catch {
    // 무시
  }
}
