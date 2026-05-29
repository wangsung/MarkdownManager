import React, { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, CornerDownLeft } from 'lucide-react'

export default function SearchModal({ onClose, onSelectResult }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  // Auto-focus search input on open
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }

    // Escape key listener to close
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Perform search on query change (with debounce)
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
        }
      } catch (err) {
        console.error('검색 오류:', err)
      } finally {
        setIsLoading(false)
      }
    }, 150) // 150ms debounce for rapid typing

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  // Highlight search terms in the snippet
  const highlightMatch = (text, keyword) => {
    if (!keyword.trim()) return text
    const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'))
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === keyword.toLowerCase() ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  // Helper to escape regex special characters
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content search-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Search size={14} className="tree-item-icon file" />
            <span>문서 전체 텍스트 검색</span>
          </div>
          <button className="action-icon" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body search-modal-body">
          <div className="search-input-wrapper">
            <Search />
            <input
              ref={inputRef}
              type="text"
              className="form-control"
              placeholder="검색어를 입력하세요 (본문 내용 실시간 스캔)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Results List */}
          <div className="search-results-list">
            {isLoading && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                검색 중...
              </div>
            )}

            {!isLoading && results.length > 0 && (
              results.map((result, idx) => (
                <div 
                  key={`${result.path}-${result.line}-${idx}`}
                  className="search-result-item"
                  onClick={() => onSelectResult(result.path)}
                >
                  <div className="search-result-filepath">
                    <FileText size={11} className="tree-item-icon file" />
                    <span>{result.path.split('/').pop().slice(0, -3)}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {result.path} : Line {result.line}
                    </span>
                    <CornerDownLeft size={10} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="search-result-snippet">
                    {highlightMatch(result.lineContent, query)}
                  </div>
                </div>
              ))
            )}

            {!isLoading && query.trim() !== '' && results.length === 0 && (
              <div className="search-no-results">
                일치하는 검색 결과가 없습니다.
              </div>
            )}

            {query.trim() === '' && (
              <div className="search-no-results">
                모든 마크다운 문서 내의 단어와 문장을 실시간 검색합니다.<br />
                <span style={{ fontSize: '10px' }}>단축키: Ctrl + Shift + F</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '6px 12px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: 'auto' }}>
            {results.length}개의 매치 발견
          </span>
          <button className="btn" onClick={onClose} style={{ padding: '2px 8px' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
