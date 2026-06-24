'use client'

import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { type BookItem, bookDims, BOOK_GAP } from '../lib/bookUtils'
import { CameraSetup } from './bookScene/CameraSetup'
import { Stack } from './bookScene/Stack'

export type { BookItem }
export { bookDims, BOOK_GAP }

export function BookshelfScene({ books, onSelect, onScrollEl, selectedId, aboutProgressRef, onReady, isMobile }: {
  books: BookItem[]
  onSelect: (book: BookItem) => void
  onScrollEl?: (el: HTMLElement) => void
  selectedId?: string | null
  aboutProgressRef: React.MutableRefObject<number>
  onReady?: () => void
  isMobile?: boolean
}) {
  const targetYRef = useRef(0.5)
  const snapCameraRef = useRef(false)
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onCreated={({ gl, scene }) => { gl.setClearColor(0x000000, 0); scene.background = null; }}>
      <CameraSetup targetYRef={targetYRef} snapCameraRef={snapCameraRef} isMobile={isMobile} />
      <directionalLight position={[2, 3, 12]} intensity={2.2} color="#fff8f0" />
      <directionalLight position={[-5, 2, 5]} intensity={0.4} color="#e8eeff" />
      <directionalLight position={[1, -2, -4]} intensity={0.15} color="#c4a97a" />
      <ambientLight intensity={0.18} />
      <Suspense fallback={null}>
        <ScrollControls pages={books.length * 0.4 + 1.0} damping={0.005}>
          <Stack books={books} onSelect={onSelect} onScrollEl={onScrollEl} selectedId={selectedId} targetYRef={targetYRef} snapCameraRef={snapCameraRef} aboutProgressRef={aboutProgressRef} onBooksReady={onReady} isMobile={isMobile} />
        </ScrollControls>
      </Suspense>
    </Canvas>
  )
}
