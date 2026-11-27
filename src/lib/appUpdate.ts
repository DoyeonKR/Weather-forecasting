// 안드로이드 앱(APK) 안에서 새 버전 알리기·설치 (네이티브 쪽: android/.../AppUpdate.java).
// 최신 버전은 GitHub Releases 의 "Latest" 릴리스 태그(android-v1.0.108)로 안다 — 앱 버전은 package.json 과 같다(build.gradle).
// · AppUpdate 플러그인이 있는 앱(1.0.108~): 앱이 직접 받아 설치 창을 띄운다
// · 플러그인이 없는 첫 앱(1.0.106): 앱 안에서 설치할 수 없으니 브라우저로 APK 를 받게 한다
// 웹(브라우저·홈 화면 웹앱)에서는 아무 일도 하지 않는다.
import { isNativeApp } from './nativeWidget'

// 개발 서버(npm run dev)에서만 VITE_RELEASES_API 로 바꿔 시험할 수 있다 — 배포본에서는 DEV 가 false 라 늘 GitHub
const RELEASES_API =
  (import.meta.env.DEV && import.meta.env.VITE_RELEASES_API) ||
  'https://api.github.com/repos/DoyeonKR/Weather-forecasting/releases/latest'
const APK_NAME = 'eojeboda-weather.apk'
/** AppUpdate 플러그인이 들어가기 전 마지막 앱 버전 — 플러그인이 없으면 이 버전으로 본다 */
export const LEGACY_APP_VERSION = '1.0.106'
const CACHE_KEY = 'eojeboda.update.latest'
const DISMISS_KEY = 'eojeboda.update.dismissed'
// 확인 결과를 얼마나 믿을까. 예전 6시간은 너무 길었다 — 하루에 두 번 릴리스하면(1.0.110 → 1.0.112, 5시간 간격)
// 먼저 확인해 둔 기기에는 새 카드가 몇 시간 동안 안 떴다(2026-11-27 제보).
// GitHub API 는 IP 당 시간 60번 — 한 기기가 10분에 한 번이면 시간 6번이라 넉넉하다.
const CACHE_MS = 10 * 60 * 1000
// "새 버전 없음"은 더 짧게 — 릴리스를 막 만들고 APK 를 붙이기 직전 몇 초에 물으면 없음으로 보이기 때문
const NONE_CACHE_MS = 2 * 60 * 1000

/** 저장해 둔 확인 결과를 아직 써도 되나 (새 버전 있음 10분, 없음 2분) */
export function cacheFresh(cached: { at: number; latest: Latest | null } | null, now: number): boolean {
  if (!cached || typeof cached.at !== 'number') return false
  const age = now - cached.at
  return age >= 0 && age < (cached.latest ? CACHE_MS : NONE_CACHE_MS)
}

/** "1.0.108" · "v1.0.108" · "android-v1.0.108" → [1, 0, 108]. 형식이 아니면 null */
export function parseVersion(v: string): number[] | null {
  const m = /(\d+)\.(\d+)\.(\d+)\s*$/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** a 가 b 보다 새 버전인가 (형식이 이상하면 false — 모르면 안 띄운다) */
export function isNewer(a: string, b: string): boolean {
  const x = parseVersion(a)
  const y = parseVersion(b)
  if (!x || !y) return false
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

export type Latest = { version: string; notes: string }

/** GitHub 릴리스 응답 → 안드로이드 릴리스이고 APK 가 붙어 있을 때만 */
export function latestFromRelease(r: unknown): Latest | null {
  if (!r || typeof r !== 'object') return null
  const o = r as { tag_name?: unknown; body?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown }
  if (typeof o.tag_name !== 'string' || !o.tag_name.startsWith('android-v') || o.draft || o.prerelease) return null
  const hasApk = Array.isArray(o.assets) && o.assets.some((a) => a && (a as { name?: unknown }).name === APK_NAME)
  const v = parseVersion(o.tag_name)
  if (!hasApk || !v) return null
  return { version: v.join('.'), notes: typeof o.body === 'string' ? firstLine(o.body) : '' }
}

/** 릴리스 노트 첫 줄 (배너 한 줄 설명) */
function firstLine(body: string): string {
  const line = body.split('\n').map((s) => s.replace(/^[-*#>\s]+/, '').trim()).find(Boolean) ?? ''
  return line.length > 40 ? `${line.slice(0, 39)}…` : line
}

/** 배너를 띄울까: 더 새 버전이 있고, 그 버전을 닫은 적이 없을 때 */
export function shouldOffer(installed: string, latest: Latest | null, dismissed: string | null): boolean {
  return !!latest && isNewer(latest.version, installed) && dismissed !== latest.version
}

// ── 앱 안에서만 ───────────────────────────────────────────────

interface AppUpdatePlugin {
  info(): Promise<{ versionName: string; versionCode: number; canInstall: boolean }>
  install(): Promise<{ status: InstallStatus }>
}
export type InstallStatus = 'installing' | 'need_permission' | 'up_to_date' | 'busy' | 'failed'

type CapWindow = { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }

// ⚠ 플러그인 객체(Proxy)를 Promise 로 넘기면 .then 을 네이티브 메서드로 부른다 — nativeWidget.ts 와 같은 이유로 상자에 담는다
let box: Promise<{ p: AppUpdatePlugin }> | null = null
function plugin(): Promise<{ p: AppUpdatePlugin }> {
  box ??= import('@capacitor/core').then(({ registerPlugin }) => ({ p: registerPlugin<AppUpdatePlugin>('AppUpdate') }))
  return box
}

/** 이 앱이 스스로 업데이트할 수 있나 (1.0.108 부터) */
export function canSelfUpdate(): boolean {
  try {
    return !!(window as unknown as CapWindow).Capacitor?.isPluginAvailable?.('AppUpdate')
  } catch {
    return false
  }
}

/** 설치된 앱 버전. 앱 밖이면 null */
export async function installedVersion(): Promise<string | null> {
  if (!isNativeApp()) return null
  if (!canSelfUpdate()) return LEGACY_APP_VERSION
  try {
    const b = await plugin()
    return (await b.p.info()).versionName || null
  } catch {
    return null
  }
}

function readJson<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

async function fetchLatest(): Promise<Latest | null> {
  const cached = readJson<{ at: number; latest: Latest | null }>(CACHE_KEY)
  if (cached && cacheFresh(cached, Date.now())) return cached.latest
  try {
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
    if (!res.ok) return cached?.latest ?? null
    const latest = latestFromRelease(await res.json())
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), latest }))
    } catch {
      // 저장 못 해도 이번에는 보여준다
    }
    return latest
  } catch {
    return cached?.latest ?? null
  }
}

/** 앱 안에서 새 버전이 있으면 그 정보를, 없으면 null */
export async function checkForUpdate(): Promise<Latest | null> {
  const installed = await installedVersion()
  if (!installed) return null
  const latest = await fetchLatest()
  let dismissed: string | null = null
  try {
    dismissed = localStorage.getItem(DISMISS_KEY)
  } catch {
    // 없던 것으로
  }
  return shouldOffer(installed, latest, dismissed) ? latest : null
}

/** "나중에" — 이 버전은 다시 띄우지 않는다 (더 새 버전이 나오면 다시) */
export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, version)
  } catch {
    // 이번 화면에서만 닫힌다
  }
}

/** 앱이 직접 받아 설치 창을 띄운다 (canSelfUpdate 일 때만) */
export async function installUpdate(): Promise<InstallStatus> {
  try {
    const b = await plugin()
    return (await b.p.install()).status
  } catch {
    return 'failed'
  }
}
