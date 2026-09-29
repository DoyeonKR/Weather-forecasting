// 화면 한 조각이 오류로 죽어도 앱 전체가 하얗게 되지 않게 막는다.
//  · SectionBoundary — 카드 하나만 "표시하지 못했어요"로 바꾸고 나머지는 그대로
//  · RootBoundary — 시작 단계에서 죽으면(예: 옛 형식으로 저장된 캐시) 캐시를 지우고 다시 불러오게 한다
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: (reset: () => void) => ReactNode
  /** 오류 로그에 남길 이름 */
  name: string
}

interface State {
  failed: boolean
}

class Boundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // 사용자에게는 보이지 않지만 개발자 도구에서 원인을 볼 수 있게
    console.error(`[${this.props.name}] 화면 오류`, error)
  }

  reset = () => this.setState({ failed: false })

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children
  }
}

export function SectionBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Boundary
      name={name}
      fallback={(reset) => (
        <section className="card section-failed" role="alert">
          <p>이 카드를 표시하지 못했어요.</p>
          <button type="button" className="retry ghost" onClick={reset}>
            다시 그리기
          </button>
        </section>
      )}
    >
      {children}
    </Boundary>
  )
}

/** 앱이 저장해 둔 화면 캐시 — 형식이 바뀐 뒤 옛 값이 오류를 부르면 지운다 */
const CACHE_KEYS = ['eojeboda.lastWeather.v1', 'eojeboda.backoff.v1']

export function RootBoundary({ children }: { children: ReactNode }) {
  return (
    <Boundary
      name="root"
      fallback={() => (
        <div className="shell center bg-loading" role="alert">
          <p>화면을 그리는 중 문제가 생겼어요.</p>
          <button
            type="button"
            className="retry"
            onClick={() => {
              try {
                for (const k of CACHE_KEYS) localStorage.removeItem(k)
              } catch {
                // 저장소가 막혀 있으면 그대로 새로고침
              }
              location.reload()
            }}
          >
            다시 불러오기
          </button>
        </div>
      )}
    >
      {children}
    </Boundary>
  )
}
