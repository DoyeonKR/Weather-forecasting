// 앱 전체 말투 — 존댓말 문장의 어미를 고른 말투로 바꾼다. 순수 함수(테스트 가능).
// 숫자·낱말은 건드리지 않고 문장 끝 어미만 바꾼다. 어미가 없는 값("좋음", "12°")은 그대로다.
import type { Persona } from '../../supabase/functions/_shared/persona.ts'

const BOUNDARY = '(?=$|[\\s.,!?…()\\]"”\'’:;])'
const WORD = new RegExp(`[가-힣]+${BOUNDARY}`, 'g')
/** "요"로 끝나지만 어미가 아닌 낱말 */
const NOT_ENDING = /(필요|중요|주요|수요|개요|소요|강요|월요|화요|목요|금요|토요|일요)$/
/** 짧은 칸(판정 값 등)이 넘치지 않게, 이보다 짧은 글에는 꼬리말을 붙이지 않는다 */
const TAIL_MIN = 12

const GRANDMA_TAILS = ['이놈아', '이 화상아', '이 썩을 놈아', '이 육시랄 놈아', '이 염병할 놈아']
const BRO_TAILS = ['진짜다', '알겠냐', '형 말 들어', '명심해라']
const COMMUNITY_TAILS = ['ㅋㅋ', 'ㄹㅇ', 'ㅇㅈ?', 'ㄷㄷ']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 마지막 글자의 받침을 바꾼다 (합 → 한). 받침 번호: ㄴ 4, ㅁ 16 */
function withFinal(ch: string, jong: number): string {
  const c = ch.charCodeAt(0) - 0xac00
  return String.fromCharCode(0xac00 + c - (c % 28) + jong)
}

/** 습니다 앞이 형용사·있다류면 "~다", 동사면 "~는다" (젖습니다 → 젖는다, 많습니다 → 많다) */
const ADJECTIVE = /(있|없|좋|많|적|작|낮|높|같|맞|맑|넓|좁|짧|깊|얕|괜찮|않|겠|았|었|했|됐)$/

/** ㅂ니다·습니다 → 평서형 (합니다 → 한다, 있습니다 → 있다, 입니다 → 이다). 커뮤니티는 명사형 */
function plain(word: string, persona: Persona): string | null {
  const community = persona === 'community'
  if (word.endsWith('입니다')) return `${word.slice(0, -3)}${community ? '임' : '이다'}`
  if (word.endsWith('습니다')) {
    const stem = word.slice(0, -3)
    if (community) return `${stem}음`
    return `${stem}${ADJECTIVE.test(stem) ? '다' : '는다'}`
  }
  if (word.endsWith('니다') && word.length >= 3) {
    const stem = word.slice(0, -2)
    const last = stem[stem.length - 1]
    // 받침 ㅂ: 합 → 한다 / 함
    if ((last.charCodeAt(0) - 0xac00) % 28 === 17) {
      return `${stem.slice(0, -1)}${withFinal(last, community ? 16 : 4)}${community ? '' : '다'}`
    }
  }
  return null
}

/** 커뮤니티 음슴체: 어미를 명사형으로 (추워 → 추움, 있어 → 있음) */
const NOMINAL: Record<string, string> = { 해: '함', 져: '짐', 돼: '됨', 와: '옴', 워: '움', 떠: '뜸', 빠: '쁨', 가: '감', 봐: '봄', 줘: '줌', 어: '음', 아: '음' }

function convert(word: string, persona: Persona): string | null {
  if (NOT_ENDING.test(word)) return null
  const asPlain = plain(word, persona)
  if (asPlain) return asPlain

  if (word.endsWith('아니에요')) {
    const stem = word.slice(0, -4)
    return stem + (persona === 'grandma' ? '아녀' : persona === 'bro' ? '아니야' : '아님')
  }
  if (word.endsWith('주세요')) {
    const stem = word.slice(0, -3)
    return stem + (persona === 'grandma' ? '줘라' : persona === 'bro' ? '줘' : '주셈')
  }
  if (word.endsWith('세요')) {
    const stem = word.slice(0, -2)
    if (persona === 'community') return `${stem}셈`
    const bare = stem.endsWith('으') ? stem.slice(0, -1) : stem
    return persona === 'bro' ? `${bare}자` : `${stem}라`
  }
  // 받침 뒤 이에요(폭염이에요 → 폭염이야), 받침 없으면 예요(비예요 → 비야)
  if (word.endsWith('이에요')) return word.slice(0, -3) + (persona === 'grandma' ? '이여' : persona === 'bro' ? '이야' : '임')
  if (word.endsWith('예요')) return word.slice(0, -2) + (persona === 'grandma' ? '여' : persona === 'bro' ? '야' : '임')
  if (!word.endsWith('요') || word.length < 2) return null

  const bare = word.slice(0, -1)
  const last = bare[bare.length - 1]
  if (persona === 'community') {
    const n = NOMINAL[last]
    return n ? bare.slice(0, -1) + n : bare
  }
  if (persona === 'grandma' && last === '해') return `${bare.slice(0, -1)}혀`
  return bare
}

/** 글 한 덩이를 말투로. 기본 말투는 그대로 돌려준다 */
export function voice(persona: Persona, text: string): string {
  if (persona === 'default' || !/[가-힣]/.test(text)) return text
  let changed = false
  const out = text.replace(WORD, (w) => {
    const c = convert(w, persona)
    if (c === null) return w
    changed = true
    return c
  })
  if (!changed) return text
  // 문장 끝 꼬리말 — 긴 문장에만, 같은 글은 늘 같은 꼬리말
  if (out.trim().length < TAIL_MIN) return out
  const end = out.match(/[.!]?\s*$/)?.[0] ?? ''
  const body = out.slice(0, out.length - end.length)
  if (/[?…]$/.test(body)) return out
  if (persona === 'grandma') return `${body} ${GRANDMA_TAILS[hash(text) % GRANDMA_TAILS.length]}!${end.slice(end.trimEnd().length)}`
  const tails = persona === 'bro' ? BRO_TAILS : COMMUNITY_TAILS
  return `${body} ${tails[hash(text) % tails.length]}`
}
