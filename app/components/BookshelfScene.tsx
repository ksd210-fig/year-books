'use client'

import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { type BookItem, bookDims, BOOK_GAP } from '../lib/bookUtils'
import { CameraSetup } from './bookScene/CameraSetup'
import { Stack } from './bookScene/Stack'

export type { BookItem }
export { bookDims, BOOK_GAP }

export function BookshelfScene({ books, onSelect, onScrollEl, selectedId, aboutProgressRef, onReady }: {
  books: BookItem[]
  onSelect: (book: BookItem) => void
  onScrollEl?: (el: HTMLElement) => void
  selectedId?: string | null
  aboutProgressRef: React.MutableRefObject<number>
  onReady?: () => void
}) {
  const targetYRef = useRef(0.5)
  const snapCameraRef = useRef(false)
  return (
    <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#1c1714']} />
      <CameraSetup targetYRef={targetYRef} snapCameraRef={snapCameraRef} />
      <directionalLight
        position={[2, 3, 12]} intensity={2.2} color="#fff8f0" castShadow
        shadow-mapSize={[1024, 1024]} shadow-bias={0.001}
        shadow-camera-near={0.5} shadow-camera-far={55}
        shadow-camera-left={-9} shadow-camera-right={9}
        shadow-camera-top={12} shadow-camera-bottom={-30}
      />
      <directionalLight position={[-5, 2, 5]} intensity={0.4} color="#e8eeff" />
      <directionalLight position={[1, -2, -4]} intensity={0.15} color="#c4a97a" />
      <ambientLight intensity={0.12} />
      <Suspense fallback={null}>
        <ScrollControls pages={books.length * 0.4 + 1.0} damping={0.005}>
          <Stack books={books} onSelect={onSelect} onScrollEl={onScrollEl} selectedId={selectedId} targetYRef={targetYRef} snapCameraRef={snapCameraRef} aboutProgressRef={aboutProgressRef} onBooksReady={onReady} />
        </ScrollControls>
      </Suspense>
    </Canvas>
  )
}
