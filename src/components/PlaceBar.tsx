// 위치 바 — 항상 보이는 동네 검색 + 현재 위치/즐겨찾기 칩
import { useRef, useState } from 'react'
import { searchPlaces, type Place } from '../lib/places'
import { useLongPressReorder } from '../lib/reorder'

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
}

export default function PlaceBar({ favorites, selectedId, onSelect, onView, onRemove, onMove, onReorder }: Props) {
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
  const [editMode, setEditMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setSearchError(false)
    try {
      const found = await searchPlaces(q)
      setResults(found)
      setSearchError(found.length === 0)
    } catch {
      setResults([])
      setSearchError(true)
    } finally {
      setBusy(false)
    }
  }

  function pick(p: Place) {
    onView(p)
    setQuery('')
    setResults([])
    inputRef.current?.blur()
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
          📍 현재 위치
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
              ⭐ {p.name}
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
      </div>

      <div className="search-row">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
          placeholder="🔍 동네 검색 (예: 판교, 부산 해운대)"
          className="search-input"
          enterKeyHint="search"
        />
        <button type="button" className="search-btn" onClick={runSearch} disabled={busy}>
          {busy ? '…' : '검색'}
        </button>
      </div>
      {searchError && !busy && (
        <p className="muted small search-error">검색 결과를 가져오지 못했어요. 잠시 후 다시 시도해주세요.</p>
      )}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)}>
                📍 {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
