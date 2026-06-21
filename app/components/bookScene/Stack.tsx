'use client'

import { Suspense, useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import type { Group } from 'three'
import { type BookItem, bookDims, BOOK_GAP } from '../../lib/bookUtils'
import { Book } from './Book'

export function Stack({ books, onSelect, onScrollEl, selectedId, targetYRef, snapCameraRef, aboutProgressRef, onBooksReady }: {
  books: BookItem[]
  onSelect: (book: BookItem) => void
  onScrollEl?: (el: HTMLElement) => void
  selectedId?: string | null
  targetYRef: React.MutableRefObject<number>
  snapCameraRef: React.MutableRefObject<boolean>
  aboutProgressRef: React.MutableRefObject<number>
  onBooksReady?: () => void
}) {
  const group = useRef<Group>(null)
  const scroll = useScroll()
  const coverLoadCountRef = useRef(0)
  const booksReadyFiredRef = useRef(false)
  const selectedIndex = selectedId ? books.findIndex(b => b.id === selectedId) : null
  const wasSelectedRef = useRef(false)

  const yOffsets = useMemo(() => {
    const dims = books.map(b => bookDims(b).h)
    const offsets: number[] = [0]
    for (let i = 0; i < books.length - 1; i++) {
      offsets.push(offsets[i] - dims[i] / 2 - dims[i + 1] / 2 - BOOK_GAP)
    }
    return offsets
  }, [books])

  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => {
    const centerLocal = 0.5 / 0.9
    const initial = new Set<number>()
    yOffsets.forEach((y, i) => { if (Math.abs(y - centerLocal) < 16) initial.add(i) })
    return initial
  })
  const lastOffsetRef = useRef(-1)

  // 처음 화면에 보이는 책 중 최대 3권이 커버 이미지를 로드하면 onBooksReady 발화
  const readyThreshold = Math.min(3, books.length)
  const handleCoverLoad = useCallback(() => {
    if (booksReadyFiredRef.current) return
    coverLoadCountRef.current++
    if (coverLoadCountRef.current >= readyThreshold) {
      booksReadyFiredRef.current = true
      onBooksReady?.()
    }
  }, [onBooksReady, readyThreshold])

  useEffect(() => { onScrollEl?.(scroll.el) }, [scroll.el, onScrollEl])

  useEffect(() => {
    if (selectedIndex !== null) {
      setLoadedSet(prev => prev.has(selectedIndex) ? prev : new Set([...prev, selectedIndex]))
    }
  }, [selectedIndex])

  useFrame(() => {
    if (!group.current) return
    if (selectedId && selectedIndex !== null) {
      wasSelectedRef.current = true
      aboutProgressRef.current = 0
      const bookWorldY = group.current.position.y + yOffsets[selectedIndex] * 0.9
      targetYRef.current = bookWorldY + 0.5
      return
    }
    targetYRef.current = 0.5
    const travel = -yOffsets[books.length - 1]
    const bookScrollFraction = books.length * 0.4 / (books.length * 0.4 + 1.0)

    // about 패널: 마지막 책이 센터에 도달하기 직전(92%)부터 시작, scroll.offset 기반으로 동기화
    const aboutThreshold = bookScrollFraction * 0.92
    aboutProgressRef.current = Math.max(0, Math.min(1, (scroll.offset - aboutThreshold) / (1 - aboutThreshold)))

    // 마지막 책이 센터를 지난 뒤(normalizedOffset > 1) 4× 가속으로 빠르게 퇴장
    const normalizedOffset = scroll.offset / bookScrollFraction
    const accel = normalizedOffset > 1 ? (normalizedOffset - 1) * 4 : 0
    const targetY = Math.min(normalizedOffset, 1) * travel + accel * travel
    if (wasSelectedRef.current) {
      group.current.position.y = targetY
      snapCameraRef.current = true
      wasSelectedRef.current = false
    } else {
      group.current.position.y += (targetY - group.current.position.y) * 0.2
    }

    if (Math.abs(scroll.offset - lastOffsetRef.current) < 0.02) return
    lastOffsetRef.current = scroll.offset

    const centerLocal = (0.5 - group.current.position.y) / 0.9
    const toLoad: number[] = []
    yOffsets.forEach((y, i) => { if (Math.abs(y - centerLocal) < 18) toLoad.push(i) })
    setLoadedSet(prev => {
      const hasNew = toLoad.some(i => !prev.has(i))
      if (!hasNew) return prev
      return new Set([...prev, ...toLoad])
    })
  })

  return (
    <group ref={group} position={[0, 0, 0]} scale={0.9}>
      {books.map((book, i) => (
        <group key={book.id} position={[0, yOffsets[i], 0]} rotation={[0, (i % 2 === 0 ? 1 : -1) * 0.02, 0]}>
          {loadedSet.has(i) && (
            <Suspense fallback={null}>
              <Book
                book={book} index={i}
                onSelect={() => onSelect(book)}
                isSelected={selectedId === book.id}
                selectedIndex={selectedIndex}
                onCoverLoad={handleCoverLoad}
              />
            </Suspense>
          )}
        </group>
      ))}
    </group>
  )
}
