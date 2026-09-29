// 앱 안 브라우저(카카오톡·네이버·인스타그램 등의 WebView) 감지와 "기본 브라우저로 열기".
// 공유 카드를 카카오톡으로 보내면 받는 사람은 대부분 이 안에서 처음 연다.
// 이런 환경은 알림(서비스워커·푸시)·홈 화면 설치·파일 저장·위치 권한이 막히거나 불안정하다.

export interface InApp {
  /** 화면에 쓰는 이름 */
  name: string
  kakao: boolean
  android: boolean
  ios: boolean
}

const TABLE: [RegExp, string][] = [
  [/KAKAOTALK/i, '카카오톡'],
  [/NAVER\(inapp/i, '네이버'],
  [/Instagram/i, '인스타그램'],
  [/FB_IAB|FBAN|FBAV/i, '페이스북'],
  [/\bLine\//i, '라인'],
  [/DaumApps/i, '다음'],
  // 그 밖의 안드로이드 WebView (UA 에 "; wv)" 가 붙는다)
  [/; wv\)/, '앱'],
]

export function detectInApp(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): InApp | null {
  const hit = TABLE.find(([re]) => re.test(ua))
  if (!hit) return null
  return {
    name: hit[1],
    kakao: /KAKAOTALK/i.test(ua),
    android: /Android/i.test(ua),
    ios: /iP(hone|od|ad)/.test(ua),
  }
}

/**
 * 기본 브라우저로 여는 주소 (순수 함수 — 테스트 대상).
 *  · 카카오톡: 공식 스킴 kakaotalk://web/openExternal (안드로이드·iOS 모두)
 *  · 그 밖의 안드로이드: 크롬 인텐트. 크롬이 없으면 원래 주소로 되돌아온다.
 *  · 그 밖의 iOS: 코드로 여는 방법이 없다 → null (안내 문구로 대신한다)
 */
export function browserOpenUrl(info: InApp, url: string): string | null {
  if (info.kakao) return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
  if (info.android) {
    try {
      const u = new URL(url)
      const scheme = u.protocol.replace(':', '')
      return (
        `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
        `#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
      )
    } catch {
      return null
    }
  }
  return null
}

/** 열기를 시도했으면 true, 방법이 없으면 false (안내 문구를 보여줘야 한다) */
export function openInBrowser(info: InApp): boolean {
  const target = browserOpenUrl(info, location.href)
  if (!target) return false
  location.href = target
  return true
}
