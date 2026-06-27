'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { BOOKS } from '@/data/books'
import { computeYOffsets, type BookItem } from '../lib/bookUtils'
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

const _dominantColorCache = new Map<string, string>()

function useDominantColor(src: string | undefined): string | null {
  const [computedColor, setComputedColor] = useState<{ src: string, color: string } | null>(null)
  useEffect(() => {
    if (!src) return
    if (_dominantColorCache.has(src)) return
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
      const result = `rgb(${Math.round(r / n * f)},${Math.round(g / n * f)},${Math.round(b / n * f)})`
      _dominantColorCache.set(src, result)
      setComputedColor({ src, color: result })
    }
    img.src = src
    return () => { cancelled = true }
  }, [src])
  if (!src) return null
  return _dominantColorCache.get(src) ?? (computedColor?.src === src ? computedColor.color : null)
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

const DESKTOP_SCROLL_PAGE_FACTOR = 0.4
const MOBILE_SCROLL_PAGE_FACTOR = 0.08
const EXTRA_PAGES = 1.0

const SCENE_Y_OFFSETS = computeYOffsets(SCENE_BOOKS)

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function BookApp({ initialId }: { initialId?: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null)
  const [hoveredAnchor, setHoveredAnchor] = useState<number | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const isMobile = useIsMobile()

  // 이미지 로드가 너무 느릴 경우 강제로 씬 표시
  useEffect(() => {
    const t = setTimeout(() => setSceneReady(true), isMobile ? 8500 : 5500)
    return () => clearTimeout(t)
  }, [isMobile])
  const scrollElRef = useRef<HTMLElement | null>(null)
  const [scrollElVersion, setScrollElVersion] = useState(0)
  const aboutProgressRef = useRef(0)
  const aboutPanelRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollMetricsRef = useRef({ bookScrollFraction: 0, totalPages: 1 })

  // 3D scroll.offset 기반으로 업데이트된 aboutProgressRef를 rAF로 DOM에 직접 반영
  useEffect(() => {
    let rafId: number
    function loop() {
      const p = aboutProgressRef.current
      if (aboutPanelRef.current) {
        aboutPanelRef.current.style.transform = `translateY(${(1 - p) * 100}%)`
        aboutPanelRef.current.style.pointerEvents = p > 0.05 ? 'auto' : 'none'
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.opacity = String(Math.max(0, 1 - p * 4))
        sidebarRef.current.style.pointerEvents = p > 0 ? 'none' : 'auto'
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // About 패널 모바일 touch → scroll.el 포워딩 (푸터에서 위로 스크롤 복귀)
  useEffect(() => {
    const panel = aboutPanelRef.current
    if (!panel) return
    let startY = 0
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length) startY = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return
      const el = scrollElRef.current
      if (!el) return
      e.preventDefault()
      const delta = startY - e.touches[0].clientY
      startY = e.touches[0].clientY
      if (delta < 0) {
        const { bookScrollFraction, totalPages } = scrollMetricsRef.current
        const targetTop = Math.max(0, bookScrollFraction * 0.84 * (totalPages - 1) * window.innerHeight)
        el.scrollTo({ top: targetTop, behavior: 'smooth' })
      } else {
        el.scrollTop += delta
      }
    }
    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  const selectedIdx = selectedId ? BOOKS.findIndex(b => b.id === selectedId) : -1
  const selectedBook = selectedIdx >= 0 ? BOOKS[selectedIdx] : null
  const selectedPalette = selectedIdx >= 0 ? PALETTES[selectedIdx % PALETTES.length] : null
  const selectedCoverSrc = selectedIdx >= 0 ? SCENE_BOOKS[selectedIdx].cover : undefined
  const dominantColor = useDominantColor(selectedCoverSrc)
  const scrollPageFactor = isMobile ? MOBILE_SCROLL_PAGE_FACTOR : DESKTOP_SCROLL_PAGE_FACTOR
  const bookPages = BOOKS.length * scrollPageFactor
  const totalPages = bookPages + EXTRA_PAGES
  const bookScrollFraction = bookPages / totalPages
  useEffect(() => {
    scrollMetricsRef.current = { bookScrollFraction, totalPages }
  }, [bookScrollFraction, totalPages])

  // URL ↔ state sync
  const hasInitialized = useRef(false)
  const isPopState = useRef(false)
  const prevSelectedId = useRef<string | null>(initialId ?? null)
  useEffect(() => {
    if (!hasInitialized.current) return
    if (isPopState.current) { isPopState.current = false; return }

    if (selectedId) {
      const newPath = `/book/${selectedId}`
      if (window.location.pathname !== newPath) {
        // 이미 상세 보는 중에 다른 책으로 이동 → replace (뒤로가기가 목록으로 가도록)
        const wasInDetail = window.location.pathname.startsWith('/book/')
        if (wasInDetail) {
          window.history.replaceState({ book: selectedId }, '', newPath)
        } else {
          window.history.pushState({ book: selectedId }, '', newPath)
        }
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

  const scrollToBook = useCallback((index: number, instant = false) => {
    const el = scrollElRef.current
    if (!el) return
    const last = SCENE_Y_OFFSETS[SCENE_Y_OFFSETS.length - 1]
    const scrollFraction = index === 0 ? 0 : SCENE_Y_OFFSETS[index] / last
    el.scrollTo({ top: scrollFraction * bookScrollFraction * (totalPages - 1) * window.innerHeight, behavior: instant ? 'instant' : 'smooth' })
  }, [bookScrollFraction, totalPages])

  // 상세 닫힐 때 스크롤 위치를 마지막 책 위치로 즉시 맞춤 (애니메이션 없이)
  useEffect(() => {
    if (selectedId === null && prevSelectedId.current !== null) {
      const idx = BOOKS.findIndex(b => b.id === prevSelectedId.current)
      if (idx >= 0) scrollToBook(idx, true)
    }
    prevSelectedId.current = selectedId
  }, [scrollToBook, selectedId])

  // 상세 열렸을 때 drei scroll.el을 잠궈 책 배경이 스크롤되지 않게 함
  // scrollEl state에 의존해 scroll.el 등록 후에도 effect가 재실행됨 (null race 방지)
  useEffect(() => {
    if (!selectedId || !scrollElVersion) return
    const el = scrollElRef.current
    if (!el) return
    const origOverflow = el.style.overflow
    const origTouchAction = el.style.touchAction
    const origOverscrollBehavior = el.style.overscrollBehavior
    el.style.overflow = 'hidden'
    el.style.touchAction = 'none'
    el.style.overscrollBehavior = 'none'
    return () => {
      el.style.overflow = origOverflow
      el.style.touchAction = origTouchAction
      el.style.overscrollBehavior = origOverscrollBehavior
    }
  }, [selectedId, scrollElVersion])

  // 패널 touchmove가 document/drei 리스너로 버블링되어 스크롤을 끊는 것을 막음
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const stop = (e: TouchEvent) => e.stopPropagation()
    panel.addEventListener('touchmove', stop, { passive: true })
    return () => panel.removeEventListener('touchmove', stop)
  }, [])

  function handleSelect(book: BookItem) {
    setSelectedId(prev => prev === book.id ? null : book.id)
  }

  const handleScrollEl = useCallback((el: HTMLElement) => {
    scrollElRef.current = el
    setScrollElVersion(version => version + 1)
  }, [])

  const isMobileSelected = isMobile && !!selectedId

  return (
    <div className="year-books-shell" style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: BG }}>

      {/* ── 3D 책장 씬 ── */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: isMobile ? 20 : 0,
        right: isMobile ? 20 : 0,
        zIndex: isMobileSelected ? 40 : 0,
        pointerEvents: isMobileSelected ? 'none' : 'auto',
        opacity: sceneReady ? 1 : 0,
        transform: sceneReady ? 'translateY(0)' : 'translateY(-48px)',
        transition: 'opacity 1.0s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <BookshelfScene books={SCENE_BOOKS} onSelect={handleSelect} onScrollEl={handleScrollEl} selectedId={selectedId} aboutProgressRef={aboutProgressRef} onReady={() => setSceneReady(true)} isMobile={isMobile} scrollPageFactor={scrollPageFactor} />
      </div>

      {/* ── 모바일 선택 시 전체 배경 오버레이 (패널 배경색으로 화면 통일) ── */}
      {isMobile && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 35,
          background: dominantColor ?? (selectedPalette ? `${selectedPalette.face}e8` : '#1c1714e8'),
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          opacity: selectedBook ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      )}

      {/* ── 사이드바 호버 딤 오버레이 ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        background: 'rgba(20,14,10,0.72)',
        opacity: hoveredAnchor !== null ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#c8b89a',
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontWeight: 600,
        fontSize: '1rem',
        opacity: sceneReady ? 0 : 1,
        pointerEvents: sceneReady ? 'none' : 'auto',
        transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        Fig.1 Books
      </div>

      {/* ── 헤더 ── */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, zIndex: 50,
          padding: '0 calc(42.5px + 1.75vw)',
          marginTop: 'calc(9px + 1vw)',
          pointerEvents: 'none',
          opacity: sceneReady ? 1 : 0,
          transform: sceneReady ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDelay: '0.1s',
        }}
      >
        <div style={{
          fontFamily: SERIF, fontWeight: 600, fontSize: '1.1rem',
          color: '#c8b89a',
          letterSpacing: '0.32px', lineHeight: 1.4,
        }}>
          Fig.1 Books
        </div>
      </header>

      {/* ── 사이드바 북 인덱스 (왼쪽) ── */}
      {/* 입장 애니메이션은 wrapper div, about-panel 페이드는 aside ref로 분리 */}
      <div style={{
        position: 'fixed',
        left: 24, top: '50%',
        zIndex: 50,
        transform: sceneReady ? 'translateY(-50%)' : 'translateY(calc(-50% + 12px))',
        transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: '0.15s',
      }}>
      <aside ref={sidebarRef} className="year-index" style={{
        display: 'var(--year-index-display)', flexDirection: 'column',
        gap: 3, alignItems: 'flex-start',
      }}>
        {BOOKS.map((book, i) => {
          const isActive = selectedIdx >= 0 && i === selectedIdx
          const isHovered = hoveredAnchor === i
          const staggerDelay = sceneReady ? `${0.85 + i * 0.05}s` : '0s'
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
                opacity: sceneReady ? 1 : 0,
                transform: sceneReady ? 'translateX(0)' : 'translateX(-8px)',
                transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: staggerDelay,
              }}
            >
              <div style={{
                height: isActive ? 4 : 3,
                width: (isActive || isHovered) ? 28 : 18,
                background: isActive ? '#c8b89a' : (isHovered ? '#ffffff' : '#3a2c1c'),
                transition: 'all 0.2s ease',
                borderRadius: 1,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600,
                fontSize: '0.85rem',
                color: isActive ? '#c8b89a' : '#ffffff',
                whiteSpace: 'nowrap',
                opacity: (isActive || isHovered) ? 1 : 0.35,
                transition: 'opacity 0.2s ease, color 0.2s ease',
                pointerEvents: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}>
                {book.year}
              </span>
            </button>
          )
        })}
      </aside>
      </div>

      {/* ── 상세 슬라이드 패널 (오른쪽) ── */}
      <div
        ref={panelRef}
        className="book-detail-panel"
        data-selected={selectedBook ? 'true' : 'false'}
        style={{
        position: 'fixed',
        right: 'var(--book-detail-right)', top: 'var(--book-detail-top)', bottom: 'var(--book-detail-bottom)', left: 'var(--book-detail-left)',
        width: 'var(--book-detail-width)',
        height: 'var(--book-detail-height)',
        zIndex: isMobileSelected ? 55 : 40,
        transform: selectedBook ? 'var(--book-detail-open-transform)' : 'var(--book-detail-closed-transform)',
        transition: 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: selectedBook ? 'auto' : 'none',
        background: dominantColor ?? (selectedPalette ? `${selectedPalette.face}f5` : '#1c1714f5'),
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: `1px solid ${selectedPalette?.text ?? '#c8b89a'}1a`,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as 'auto',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
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
            <button
              onClick={() => setSelectedId(null)}
              style={{
                alignSelf: 'flex-end',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'currentColor', opacity: 0.5,
                fontSize: 22, lineHeight: 1, padding: '0 0 16px 16px',
                fontFamily: SERIF,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
            >×</button>
            <div style={{ fontSize: 'calc(17px + 0.5vw)', fontStyle: 'italic', fontWeight: 700, lineHeight: 1.22, marginBottom: 14 }}>
              {selectedBook.titleKo}
            </div>
            {selectedBook.titleEn && (
              <div style={{ fontSize: 12, opacity: 0.4, letterSpacing: '0.03em', marginBottom: 20 }}>
                {selectedBook.titleEn}
              </div>
            )}
            <div style={{ fontSize: 14, fontStyle: 'italic', opacity: 0.75, marginBottom: 4 }}>
              {selectedBook.author}
            </div>
            <div style={{ fontSize: 11, opacity: 0.35, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
              {selectedBook.publisher}
            </div>
            <div style={{ width: 28, height: 1, background: 'currentColor', opacity: 0.2, marginBottom: 20 }} />
            <div style={{ fontSize: 14, lineHeight: 1.9, opacity: 0.78, marginBottom: 32 }}>
              {selectedBook.description}
            </div>
            {selectedBook.buyLink && (
              <a
                href={selectedBook.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid currentColor',
                  padding: '0 0 0 20px',
                  color: 'currentColor', textDecoration: 'none',
                  fontSize: 14, fontFamily: SERIF, fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer', marginBottom: 40,
                }}
              >
                <span>구매하기</span>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'stretch', padding: '18px 16px',
                  borderLeft: '1px solid currentColor', marginLeft: 20,
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

      {/* ── 모바일 패널 하단 스크롤 힌트 그라데이션 ── */}
      {isMobileSelected && selectedBook && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: 52,
          zIndex: 56,
          background: `linear-gradient(to bottom, transparent, ${dominantColor ?? (selectedPalette ? selectedPalette.face : '#1c1714')})`,
          pointerEvents: 'none',
        }} />
      )}

      {/* ── About 패널 (스크롤 맨 아래에서 올라옴) ── */}
      <div
        ref={aboutPanelRef}
        onWheel={(e) => {
          e.preventDefault()
          const el = scrollElRef.current
          if (!el) return
          if (e.deltaY < 0) {
            const targetTop = Math.max(0, bookScrollFraction * 0.84 * (totalPages - 1) * window.innerHeight)
            el.scrollTo({ top: targetTop, behavior: 'smooth' })
          } else {
            el.scrollTop += e.deltaY
          }
        }}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: '100dvh',
          transform: 'translateY(100%)',
          zIndex: 35,
          background: '#f5f1ea',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isMobile
            ? '0 28px'
            : '0 max(48px, 8vw)',
          pointerEvents: 'none',
          touchAction: 'none',
        }}>
        <p style={{
          fontFamily: SERIF, fontSize: 'clamp(0.82rem, 1.3vw, 0.93rem)',
          lineHeight: 1.9, color: '#1c1714', opacity: 0.52,
          maxWidth: 560, margin: '0 0 36px',
        }}>
          Year Book은 국내에서 출판된, 제목이 특정 연도인 책들을 한데 모아 책 목록 자체가 하나의 연표처럼 보이도록 구성한 프로젝트입니다. 우리는 특정한 해에 일어난 사건들이 오늘날의 세계를 어떻게 만들어왔는지를 탐구하는 책들을 선별했습니다.
        </p>
        <a
          href="https://www.fig1.kr/project"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: SERIF, fontSize: '0.82rem', fontWeight: 700,
            letterSpacing: '0.08em', color: '#1c1714',
            textDecoration: 'none', opacity: 0.65,
            borderBottom: '1px solid rgba(28,23,20,0.3)',
            paddingBottom: 4, width: 'fit-content',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
        >
          Fig.1 프로젝트 보기
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.27308 8.6948L6.64773 3.31482L6.63707 7.34714H8.38423V0.305237H1.34766L1.337 2.04174H5.37464L0 7.42171L1.27308 8.6948Z" fill="currentColor" />
          </svg>
        </a>
      </div>
    </div>
  )
}
