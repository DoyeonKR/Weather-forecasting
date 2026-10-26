// 위치 바 — 항상 보이는 동네 검색 + 현재 위치/즐겨찾기 칩
import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, Crosshair, MagnifyingGlass, MapPin, Star } from '@phosphor-icons/react'
import { searchPlaces, type Place } from '../lib/places'
import { useLongPressReorder } from '../lib/reorder'
import { trackEvent } from '../lib/track'

interface Props {
  favorites: Place[]
  /** 'current' 또는 장소 id */
  selectedId: string
  onSelect: (id: string) => void
  /** 검색 결과를 바로 보기 (즐겨찾기 추가 아님) */
  onView: (place: Place) => void
  onRemove: (id: string) => void
  /** 즐겨찾기 순서 이동 */
  onMove: (id: string, dir: -1 | 1) => void
  /** 전체 순서 교체 (드래그 정렬) */
  onReorder: (ids: string[]) => void
  /** 값이 바뀔 때마다 검색창을 열고 입력 커서를 둔다 (헤더의 지역 버튼) */
  openSearchSignal?: number
}

export default function PlaceBar({
  favorites,
  selectedId,
  onSelect,
  onView,
  onRemove,
  onMove,
  onReorder,
  openSearchSignal = 0,
}: Props) {
  const chipReorder = useLongPressReorder<string>({
    order: favorites.map((f) => f.id),
    onChange: onReorder,
    axis: 'x',
    attr: 'data-chip-id',
  })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const focusOnOpen = useRef(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!openSearchSignal) return
    focusOnOpen.current = true
    setSearchOpen(true)
  }, [openSearchSignal])

  // 검색창이 그려진 뒤에 커서를 둔다 (이미 열려 있었으면 바로)
  useEffect(() => {
    if (!searchOpen || !focusOnOpen.current) return
    focusOnOpen.current = false
    inputRef.current?.focus()
  }, [searchOpen, openSearchSignal])

  async function runSearch() {
    const q = query.trim()
    if (!q || busy) return
    const seq = ++searchSeq.current
    trackEvent('search')
    setBusy(true)
    setSearchError(false)
    setSearchedQuery(q)
    setResults([])
    try {
      const found = await searchPlaces(q)
      if (seq !== searchSeq.current) return
      setResults(found)
    } catch {
      if (seq !== searchSeq.current) return
      setResults([])
      setSearchError(true)
    } finally {
      if (seq === searchSeq.current) setBusy(false)
    }
  }

  function closeSearch() {
    searchSeq.current++
    setBusy(false)
    setSearchOpen(false)
    setSearchedQuery('')
    setResults([])
    setSearchError(false)
    toggleRef.current?.focus()
  }

  function pick(p: Place) {
    onView(p)
    setQuery('')
    closeSearch()
  }

  return (
    <div className="placebar">
      <div
        ref={chipReorder.setContainer}
        className={`chips ${chipReorder.active ? 'reorder-active' : ''}`}
        role="group"
        aria-label="위치 선택"
        {...chipReorder.handlers}
      >
        <button
          type="button"
          aria-pressed={selectedId === 'current'}
          className={`chip ${selectedId === 'current' ? 'on' : ''}`}
          onClick={() => onSelect('current')}
        >
          <Crosshair size={17} weight="bold" aria-hidden /> 현재 위치
        </button>
        {favorites.map((p) => (
          <span
            key={p.id}
            data-chip-id={p.id}
            className={`chip ${selectedId === p.id ? 'on' : ''} ${chipReorder.dragId === p.id ? 'dragging' : ''}`}
          >
            <button
              type="button"
              aria-pressed={selectedId === p.id}
              className="chip-name"
              data-reorder-pass
              onClick={() => onSelect(p.id)}
            >
              <Star size={15} weight="fill" aria-hidden /> {p.name}
            </button>
            {editMode && (
              <>
                <button type="button" className="chip-x" aria-label="앞으로 이동" onClick={() => onMove(p.id, -1)}>
                  ◀
                </button>
                <button type="button" className="chip-x" aria-label="뒤로 이동" onClick={() => onMove(p.id, 1)}>
                  ▶
                </button>
              </>
            )}
            {editMode && (
              <button
                type="button"
                className="chip-x"
                aria-label={`${p.name} 즐겨찾기 삭제`}
                onClick={() => {
                  if (confirm(`'${p.name}' 을(를) 즐겨찾기에서 지울까요?`)) onRemove(p.id)
                }}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {chipReorder.active && (
          <button type="button" className="chip ghost" data-reorder-exit onClick={chipReorder.exit}>
            완료
          </button>
        )}
        {favorites.length > 0 && !chipReorder.active && (
          <button type="button" className="chip ghost" onClick={() => setEditMode((e) => !e)}>
            {editMode ? '완료' : '편집'}
          </button>
        )}
        <button
          ref={toggleRef}
          type="button"
          className="chip ghost search-toggle"
          aria-expanded={searchOpen}
          aria-controls="place-search"
          onClick={() => {
            if (searchOpen) closeSearch()
            else {
              focusOnOpen.current = true
              setSearchOpen(true)
            }
          }}
        >
          <MagnifyingGlass size={16} weight="bold" aria-hidden /> {searchOpen ? '검색 닫기' : '지역 검색'}
        </button>
      </div>

      {searchOpen && (
        <div id="place-search" className="place-search" onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            closeSearch()
          }
        }}>
          <form className="search-row" role="search" aria-label="지역 검색" onSubmit={(e) => {
            e.preventDefault()
            runSearch()
          }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                searchSeq.current++
                setQuery(e.target.value)
                setBusy(false)
                setResults([])
                setSearchedQuery('')
                setSearchError(false)
              }}
              placeholder="동네 이름으로 찾아보세요"
              aria-label="동네 검색"
              aria-describedby="place-search-status"
              className="search-input"
              enterKeyHint="search"
              autoComplete="off"
            />
            <button type="submit" className="search-btn" disabled={busy || !query.trim()}>
              {busy ? <ArrowClockwise size={18} className="spin" aria-hidden /> : '검색'}
              {busy && <span className="sr-only">검색 중</span>}
            </button>
          </form>
          <div id="place-search-status" className="search-status" role="status">
            {busy ? '지역을 찾고 있어요…' : searchError ? (
              <span className="search-error">지역을 불러오지 못했어요. 연결을 확인하고 다시 검색해주세요.</span>
            ) : searchedQuery ? (
              results.length > 0 ? `${results.length}개 지역을 찾았어요. 보고 싶은 곳을 선택하세요.` : (
                <span>‘{searchedQuery}’ 검색 결과가 없어요. 시·구·동 이름으로 다시 찾아보세요.</span>
              )
            ) : '예: 판교, 부산 해운대 · 검색한 지역의 날씨를 바로 볼 수 있어요.'}
          </div>
          {results.length > 0 && (
            <ul className="search-results" aria-label="검색한 지역">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r)}>
                    <MapPin size={17} weight="duotone" aria-hidden />
                    <span>{r.name}</span>
                    <span className="search-result-action" aria-hidden>날씨 보기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
