// 위치 바 — 항상 보이는 동네 검색 + 현재 위치/즐겨찾기 칩
import { useRef, useState } from 'react'
import { searchPlaces, type Place } from '../lib/places'

interface Props {
  favorites: Place[]
  /** 'current' 또는 장소 id */
  selectedId: string
  onSelect: (id: string) => void
  /** 검색 결과를 바로 보기 (즐겨찾기 추가 아님) */
  onView: (place: Place) => void
  onRemove: (id: string) => void
}

export default function PlaceBar({ favorites, selectedId, onSelect, onView, onRemove }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    try {
      setResults(await searchPlaces(q))
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
      <div className="chips" role="tablist" aria-label="위치 선택">
        <button
          type="button"
          role="tab"
          aria-selected={selectedId === 'current'}
          className={`chip ${selectedId === 'current' ? 'on' : ''}`}
          onClick={() => onSelect('current')}
        >
          📍 현재 위치
        </button>
        {favorites.map((p) => (
          <span key={p.id} className={`chip ${selectedId === p.id ? 'on' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={selectedId === p.id}
              className="chip-name"
              onClick={() => onSelect(p.id)}
            >
              ⭐ {p.name}
            </button>
            {editMode && (
              <button
                type="button"
                className="chip-x"
                aria-label={`${p.name} 즐겨찾기 삭제`}
                onClick={() => onRemove(p.id)}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {favorites.length > 0 && (
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
