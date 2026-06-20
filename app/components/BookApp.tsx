'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { BOOKS } from '@/data/books'
import { bookDims, BOOK_GAP, type BookItem } from '../lib/bookUtils'
import { BookshelfScene } from './BookshelfScene'

const PALETTES = [
  { face: '#6E665B', edge: '#4e463b', text: '#DFC78E' },
  { face: '#0d121f', edge: '#060810', text: '#D0D1D4' },
  { face: '#E2E2E2', edge: '#b5b5b5', text: '#504F4F' },
  { face: '#4D1A28', edge: '#2d0a18', text: '#EBADCB' },
  { face: '#C1B676', edge: '#90854a', text: '#18185E' },
  { face: '#143199', edge: '#0c2070', text: '#dee6ff' },
  { face: '#93935F', edge: '#636338', text: '#333032' },
  { face: '#96DCED', edge: '#60b0c8', text: '#3D3D3D' },
  { face: '#442C25', edge: '#2c1c14', text: '#E48244' },
  { face: '#222222', edge: '#111111', text: '#FF4445' },
  { face: '#FFB55E', edge: '#c87c30', text: '#0B1743' },
  { face: '#303328', edge: '#1e2018', text: '#F9C350' },
  { face: '#2328A0', edge: '#161878', text: '#EF9E40' },
]

const BG = '#1c1714'
const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif"

function useDominantColor(src: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null)
  useEffect(() => {
    if (!src) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const cvs = document.createElement('canvas')
      cvs.width = 40; cvs.height = 60
      const ctx = cvs.getContext('2d')!
      ctx.drawImage(img, 0, 0, 40, 60)
      const data = ctx.getImageData(0, 0, 40, 60).data
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
      const f = 0.32
      setColor(`rgb(${Math.round(r / n * f)},${Math.round(g / n * f)},${Math.round(b / n * f)})`)
    }
    img.src = src
    return () => { cancelled = true }
  }, [src])
  return src ? color : null
}

const SCENE_BOOKS: BookItem[] = BOOKS.map((b, i) => {
  const p = PALETTES[i % PALETTES.length]
  return {
    id: b.id,
    titleKo: b.titleKo,
    author: b.author,
    coverColor: p.face,
    edgeColor: p.edge,
    textColor: p.text,
    year: b.year,
    cover: b.front ?? b.cover,
    back: b.back,
    spine: b.spine,
    mmW: b.mmW,
    mmH: b.mmH,
    mmD: b.mmD,
  }
})

const PAGES = BOOKS.length * 0.4

const SCENE_Y_OFFSETS = (() => {
  const dims = SCENE_BOOKS.map(b => bookDims(b).h)
  const offsets = [0]
  for (let i = 0; i < SCENE_BOOKS.length - 1; i++) {
    offsets.push(offsets[i] - dims[i] / 2 - dims[i + 1] / 2 - BOOK_GAP)
  }
  return offsets
})()

export default function BookApp({ initialId }: { initialId?: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null)
  const [hoveredAnchor, setHoveredAnchor] = useState<number | null>(null)
  const scrollElRef = useRef<HTMLElement | null>(null)

  const selectedIdx = selectedId ? BOOKS.findIndex(b => b.id === selectedId) : -1
  const selectedBook = selectedIdx >= 0 ? BOOKS[selectedIdx] : null
  const selectedPalette = selectedIdx >= 0 ? PALETTES[selectedIdx % PALETTES.length] : null
  const selectedCoverSrc = selectedIdx >= 0 ? SCENE_BOOKS[selectedIdx].cover : undefined
  const dominantColor = useDominantColor(selectedCoverSrc)

  // URL ↔ state sync
  const hasInitialized = useRef(false)
  const isPopState = useRef(false)

  useEffect(() => {
    if (!hasInitialized.current) return
    if (isPopState.current) { isPopState.current = false; return }

    if (selectedId) {
      const newPath = `/book/${selectedId}`
      if (window.location.pathname !== newPath) {
        window.history.pushState({ book: selectedId }, '', newPath)
      }
    } else {
      window.history.replaceState(null, '', '/')
    }
  }, [selectedId])

  useEffect(() => {
    hasInitialized.current = true

    const onPopState = (e: PopStateEvent) => {
      isPopState.current = true
      setSelectedId(e.state?.book ?? null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function handleSelect(book: BookItem) {
    setSelectedId(prev => prev === book.id ? null : book.id)
  }

  const handleScrollEl = useCallback((el: HTMLElement) => {
    scrollElRef.current = el
  }, [])

  function scrollToBook(index: number) {
    const el = scrollElRef.current
    if (!el) return
    const last = SCENE_Y_OFFSETS[SCENE_Y_OFFSETS.length - 1]
    const scrollFraction = index === 0 ? 0 : SCENE_Y_OFFSETS[index] / last
    el.scrollTo({ top: scrollFraction * (PAGES - 1) * window.innerHeight, behavior: 'smooth' })
  }

  return (
    <div className="year-books-shell" style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: BG }}>

      {/* ── 3D 책장 씬 ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <BookshelfScene books={SCENE_BOOKS} onSelect={handleSelect} onScrollEl={handleScrollEl} selectedId={selectedId} />
      </div>

      {/* ── 사이드바 호버 딤 오버레이 ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        background: 'rgba(20,14,10,0.72)',
        opacity: hoveredAnchor !== null ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
      }} />

      {/* ── 헤더 ── */}
      <header
        onClick={() => setSelectedId(null)}
        style={{
          position: 'fixed', top: 0, left: 0, zIndex: 50,
          padding: '0 calc(42.5px + 1.75vw)',
          marginTop: 'calc(9px + 1vw)',
          cursor: selectedId ? 'pointer' : 'default',
          pointerEvents: 'auto',
        }}
      >
        <div style={{
          fontFamily: SERIF, fontWeight: 600, fontSize: '1.1rem',
          color: '#c8b89a',
          letterSpacing: '0.32px', lineHeight: 1.4,
          transition: 'color 0.4s',
        }}>
          Fig.1 Books
        </div>
        {selectedId && (
          <div style={{
            fontFamily: SERIF, fontWeight: 600, fontStyle: 'italic',
            fontSize: '1rem',
            color: '#ffffff',
            letterSpacing: '0.32px', lineHeight: 1.3,
            transition: 'color 0.4s',
          }}>
            ← 목록으로
          </div>
        )}
      </header>

      {/* ── 사이드바 북 인덱스 (왼쪽) ── */}
      <aside className="year-index" style={{
        position: 'fixed',
        left: 24, top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'var(--year-index-display)', flexDirection: 'column',
        gap: 3, alignItems: 'flex-start',
        pointerEvents: 'auto',
      }}>
        {BOOKS.map((book, i) => {
          const isHovered = hoveredAnchor === i
          return (
            <button
              key={book.id}
              onClick={() => {
                if (selectedId) {
                  setSelectedId(BOOKS[i].id)
                } else {
                  scrollToBook(i)
                }
              }}
              onMouseEnter={() => setHoveredAnchor(i)}
              onMouseLeave={() => setHoveredAnchor(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, height: 12,
                padding: 0, position: 'relative',
              }}
            >
              <div style={{
                height: 3,
                width: isHovered ? 28 : 18,
                background: isHovered ? '#ffffff' : '#3a2c1c',
                transition: 'all 0.2s ease',
                borderRadius: 1,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600,
                fontSize: '0.85rem',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                opacity: isHovered ? 1 : 0.35,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                pointerEvents: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}>
                {book.year}
              </span>
            </button>
          )
        })}
      </aside>

      {/* ── 상세 슬라이드 패널 (오른쪽) ── */}
      <div className="book-detail-panel" data-selected={selectedBook ? 'true' : 'false'} style={{
        position: 'fixed',
        right: 'var(--book-detail-right)', top: 'var(--book-detail-top)', bottom: 'var(--book-detail-bottom)', left: 'var(--book-detail-left)',
        width: 'var(--book-detail-width)',
        height: 'var(--book-detail-height)',
        zIndex: 40,
        transform: selectedBook ? 'var(--book-detail-open-transform)' : 'var(--book-detail-closed-transform)',
        transition: 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: selectedBook ? 'auto' : 'none',
        background: dominantColor ?? (selectedPalette ? `${selectedPalette.face}f0` : '#1c1714f0'),
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: `1px solid ${selectedPalette?.text ?? '#c8b89a'}1a`,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'var(--book-detail-justify)',
        padding: 'var(--book-detail-padding)',
        color: dominantColor ? '#e8dfc8' : (selectedPalette?.text ?? '#c8b89a'),
        fontFamily: SERIF,
        WebkitFontSmoothing: 'antialiased',
      }}>
        {selectedBook && selectedPalette && (
          <>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', opacity: 0.45, marginBottom: 20, textTransform: 'uppercase' }}>
              {selectedBook.year}
            </div>
            <div style={{
              fontSize: 'calc(18px + 0.6vw)', fontStyle: 'italic', fontWeight: 700,
              lineHeight: 1.25, marginBottom: 12,
            }}>
              {selectedBook.titleKo}
            </div>
            {selectedBook.titleEn && (
              <div style={{ fontSize: 13, opacity: 0.45, marginBottom: 16 }}>
                {selectedBook.titleEn}
              </div>
            )}
            <div style={{ fontSize: 16, fontStyle: 'italic', opacity: 0.8, marginBottom: 24 }}>
              {selectedBook.author}
            </div>
            <div style={{ width: 36, height: 1, background: 'currentColor', opacity: 0.25, marginBottom: 24 }} />
            <div style={{ fontSize: 15, lineHeight: 1.78, opacity: 0.82, marginBottom: 24 }}>
              {selectedBook.description}
            </div>
            <div style={{ fontSize: 12, opacity: 0.38, letterSpacing: '0.05em', marginBottom: 28 }}>
              {selectedBook.publisher}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32 }}>
              {selectedBook.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 10px',
                  border: '1px solid currentColor',
                  opacity: 0.45, letterSpacing: '0.04em',
                }}>{tag}</span>
              ))}
            </div>
            {selectedBook.buyLink && (
              <a
                href={selectedBook.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid currentColor',
                  padding: '0 0 0 16px',
                  color: 'currentColor', textDecoration: 'none',
                  fontSize: 15, fontFamily: SERIF, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>알라딘에서 구매하기</span>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'stretch', padding: '16px 14px',
                  borderLeft: '1px solid currentColor', marginLeft: 16,
                }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.27308 8.6948L6.64773 3.31482L6.63707 7.34714H8.38423V0.305237H1.34766L1.337 2.04174H5.37464L0 7.42171L1.27308 8.6948Z" fill="currentColor" />
                  </svg>
                </div>
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
