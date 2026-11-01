// 알림 말투 — 푸시(서버)와 상단 배너(앱)가 같은 문구를 쓴다. 다른 파일에 의존하지 않는다.
// 배너 한 줄에 들어가도록 18자 안팎으로 쓴다.
export type Persona = 'default' | 'grandma' | 'bro' | 'community'
export type PersonaLine = 'umbrella' | 'snow' | 'mask' | 'cold' | 'hot' | 'uv' | 'coat' | 'light'

export const PERSONAS: { id: Persona; label: string }[] = [
  { id: 'default', label: '기본' },
  { id: 'grandma', label: '욕쟁이 할머니' },
  { id: 'bro', label: '동네 형' },
  { id: 'community', label: '커뮤니티' },
]

const LINES: Record<Persona, Record<PersonaLine, string>> = {
  default: {
    umbrella: '우산 챙기세요!',
    snow: '눈 소식이 있어요, 길 조심하세요!',
    mask: '마스크 챙기세요!',
    cold: '많이 추워요, 단단히 입으세요!',
    hot: '폭염이에요, 물 자주 드세요!',
    uv: '자외선이 강해요, 선크림 챙기세요!',
    coat: '겉옷 챙기세요!',
    light: '얇은 옷이 좋아요!',
  },
  grandma: {
    umbrella: '우산 챙겨가라 이 육시랄 놈아!',
    snow: '눈 온다, 자빠지지 마라 이 화상아!',
    mask: '마스크 써라 이 썩을 놈아!',
    cold: '얼어 죽는다, 껴입어라 이놈아!',
    hot: '쪄 죽는다, 물 좀 마셔라 이놈아!',
    uv: '선크림 발라라, 다 탄다 이놈아!',
    coat: '겉옷 걸쳐라 이 염병할 놈아!',
    light: '얇게 입어라 이 미련한 놈아!',
  },
  bro: {
    umbrella: '야 우산 챙겨, 젖으면 답 없다',
    snow: '눈 온다, 미끄러지지 마라 진짜',
    mask: '공기 별로다, 마스크 쓰자',
    cold: '개춥다, 단디 입고 나가라',
    hot: '개덥다, 물 많이 마셔라',
    uv: '해 세다, 선크림 바르자',
    coat: '겉옷 하나 챙겨라',
    light: '오늘은 얇게 입어도 된다',
  },
  community: {
    umbrella: '우산 안 챙기면 ㄹㅇ 젖음 ㅋㅋ',
    snow: '눈 옴 ㄷㄷ 꽈당 주의',
    mask: '공기 실화냐 마스크 ㄱㄱ',
    cold: '개추움 ㄹㅇ 패딩 ㄱㄱ',
    hot: '더위 실화냐 물 ㄱㄱ',
    uv: '해 미쳤음 선크림 ㄱㄱ',
    coat: '겉옷 안 챙기면 후회각',
    light: '얇게 입어도 ㅇㅈ',
  },
}

export function isPersona(v: unknown): v is Persona {
  return v === 'default' || v === 'grandma' || v === 'bro' || v === 'community'
}

export function say(persona: unknown, line: PersonaLine): string {
  return LINES[isPersona(persona) ? persona : 'default'][line]
}
