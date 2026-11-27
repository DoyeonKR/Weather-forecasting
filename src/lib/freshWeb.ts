// 배포된 웹이 바뀌었으면 새로 불러온다 — 특히 안드로이드 앱 안.
// 앱은 뒤로 보냈다 다시 열어도 페이지를 새로 받지 않아, 배포한 고침이 몇 시간씩 안 들어갔다
// (말투를 바꿔도 안 되던 것이 고친 뒤에도 그대로였던 이유, 2026-11-27). GitHub Pages 의 HTML 은 max-age=600 이라
// 첫 로드도 10분 동안은 예전 것일 수 있다 (서비스워커가 HTML 은 늘 서버에 확인하도록 public/sw.js 도 고침).
//
// 방법: 지금 떠 있는 번들(assets/index-XXXX.js)과 서버 index.html 이 가리키는 번들 이름을 비교한다.

const BUNDLE = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/
// HTML 에서는 <script src> 의 것만 — 미리 받기(<link rel="modulepreload">)가 앞에 붙어도 헷갈리지 않게
const SCRIPT_BUNDLE = /<script[^>]*\ssrc="[^"]*\/assets\/(index-[A-Za-z0-9_-]+\.js)"/
const TRIED_KEY = 'eojeboda.freshWeb.tried'
/** 이만큼 넘게 뒤에 있다가 돌아오면 확인한다 (잠깐 다른 앱 갔다 온 것은 그냥 둔다) */
const AWAY_MS = 30_000

/** HTML 이나 주소에서 번들 파일 이름 (index-XXXX.js) */
export function bundleOf(text: string): string | null {
  const m = SCRIPT_BUNDLE.exec(text) ?? BUNDLE.exec(text)
  return m ? m[1] : null
}

/**
 * 새로 불러올까: 떠 있는 번들과 서버 번들이 다르고, 이번 세션에 그 번들로 이미 새로 불러 본 적이 없을 때.
 * (CDN 이 잠깐 엇갈려 새로 불러도 예전 것이 오면 무한히 새로 고치지 않게)
 */
export function shouldReload(current: string | null, latestHtml: string, triedFor: string | null): boolean {
  const latest = bundleOf(latestHtml)
  return !!current && !!latest && current !== latest && triedFor !== latest
}

function currentBundle(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return s ? bundleOf(s.src) : null
}

async function check(): Promise<void> {
  try {
    const res = await fetch(import.meta.env.BASE_URL, { cache: 'no-cache' })
    if (!res.ok) return
    const html = await res.text()
    let tried: string | null = null
    try {
      tried = sessionStorage.getItem(TRIED_KEY)
    } catch {
      // 기록을 못 남기면 한 번만 시도하는 보장이 없다 → 새로 고치지 않는다
      return
    }
    if (!shouldReload(currentBundle(), html, tried)) return
    sessionStorage.setItem(TRIED_KEY, bundleOf(html) ?? '')
    location.reload()
  } catch {
    // 오프라인 등 — 다음에
  }
}

/** 배포본에서만: 열고 조금 뒤 한 번, 그리고 30초 넘게 뒤에 있다가 돌아올 때마다 확인 */
export function watchFreshWeb(): void {
  if (!import.meta.env.PROD) return
  window.setTimeout(check, 5_000)
  let hiddenAt = 0
  let checking = false
  const back = () => {
    if (checking || document.visibilityState !== 'visible' || !hiddenAt || Date.now() - hiddenAt <= AWAY_MS) return
    hiddenAt = 0
    checking = true
    void check().finally(() => {
      checking = false
    })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else back()
  })
  // 안드로이드 웹뷰는 뒤에 오래 있으면 페이지를 얼렸다가(freeze) 돌아올 때 resume 을 낸다 — 같은 확인을 한 번 더 건다
  document.addEventListener('resume', back)
}
