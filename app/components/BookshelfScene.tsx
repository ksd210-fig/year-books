'use client'

import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, PerspectiveCamera, ScrollControls, useScroll, useTexture } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three-stdlib'
import * as THREE from 'three'
import type { Group, PerspectiveCamera as PerspectiveCameraType } from 'three'

// 페이지 단면 PNG 텍스처 — 모듈 레벨 싱글턴
let _pageTex: THREE.Texture | null = null
function getPageTex(): THREE.Texture {
  if (!_pageTex) {
    _pageTex = new THREE.TextureLoader().load('/textures/Book Seamless Texture.jpg')
    _pageTex.wrapS = THREE.RepeatWrapping
    _pageTex.wrapT = THREE.RepeatWrapping
    _pageTex.repeat.set(6, 6)
    _pageTex.anisotropy = 8
    _pageTex.minFilter = THREE.LinearMipmapLinearFilter
  }
  return _pageTex
}

export interface BookItem {
  id: string
  titleKo: string
  author: string
  coverColor: string
  edgeColor: string
  textColor: string
  year: string | number
  cover?: string
  mmW?: number  // physical width in mm
  mmH?: number  // physical height in mm
  mmD?: number  // physical thickness in mm
  back?: string  // back cover image path
  spine?: string // spine image path
}

// ── 책 형태 ──────────────────────────────────────────────────────
//
// 기본 자세: 책이 눕혀진 채 스택으로 쌓임
//   W = 좌우 (X) = 책 너비
//   H = 두께 (Y) — 얇음, 스택에서 각 책의 높이
//   D = 앞뒤 (Z) = 책 세로 높이 (커버 세로)
//
// Scale: 190mm (기준 책 높이) → D=4.5 Three.js units
// 따라서 scale = 4.5 / 190 ≈ 0.02368

const MM_SCALE = 4.5 / 190  // mm → Three.js units
const DEFAULT_W = 3.0
const DEFAULT_H = 0.55
const DEFAULT_D = 4.5

export function bookDims(book: BookItem) {
  const w = book.mmW ? +(book.mmW * MM_SCALE).toFixed(3) : DEFAULT_W
  const d = book.mmH ? +(book.mmH * MM_SCALE).toFixed(3) : DEFAULT_D
  const h = book.mmD ? +(book.mmD * MM_SCALE).toFixed(3) : DEFAULT_H
  return { w, h, d }
}

export const BOOK_GAP = 0.75  // 책 표면 간 일정 시각적 간격 (Three.js units)

function CameraSetup({ targetYRef }: { targetYRef: React.MutableRefObject<number> }) {
  const cameraRef = useRef<PerspectiveCameraType>(null)
  const lookAtRef = useRef(new THREE.Vector3(0, -0.2, 0))

  useFrame(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.y += (targetYRef.current - camera.position.y) * 0.06
    lookAtRef.current.y += (targetYRef.current - lookAtRef.current.y) * 0.06
    camera.lookAt(lookAtRef.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.5, 15]} fov={28} />
}

function ImageCoverMaterial({ src, attach, rotation }: { src: string; attach: string; rotation?: number }) {
  const sourceTex = useTexture(src)
  const { gl } = useThree()

  const tex = useMemo(() => {
    const configuredTex = sourceTex.clone()
    configuredTex.anisotropy = gl.capabilities.getMaxAnisotropy()
    configuredTex.minFilter = THREE.LinearFilter
    configuredTex.needsUpdate = true
    if (rotation) {
      configuredTex.rotation = rotation
      configuredTex.center.set(0.5, 0.5)
    }
    return configuredTex
  }, [gl, rotation, sourceTex])

  useEffect(() => () => tex.dispose(), [tex])

  return <meshStandardMaterial attach={attach} map={tex} roughness={0.5} metalness={0} />
}



function Book({
  book, index, onSelect, isSelected, selectedIndex,
}: {
  book: BookItem
  index: number
  onSelect: () => void
  isSelected: boolean
  selectedIndex: number | null
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const { w: W, h: H, d: D } = bookDims(book)
  const boardT = Math.min(0.055, Math.max(0.032, H * 0.11))
  const pageH = Math.max(0.04, H - boardT * 2)
  const coverW = W + 0.035
  const coverD = D + 0.045
  const pageW = W - 0.08
  const pageD = D - 0.055
  const spineT = boardT
  const hingeX = -coverW / 2 + spineT + 0.022
  const pageX = 0.04

  // 드래그 회전 상태
  const dragOffset = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const hasDragged = useRef(false)

  // -X face (camera-facing): 책등 텍스트 — 512px로 충분 (스택에서 작게 보임)
  const spineTex = useMemo(() => {
    const CW = 512
    const cvs = document.createElement('canvas')
    const ch = Math.round(CW * H / D)
    cvs.width = CW; cvs.height = ch
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = book.coverColor
    ctx.fillRect(0, 0, CW, ch)
    ctx.fillStyle = book.textColor
    const fontSize = Math.max(8, Math.round(ch * 0.55))
    ctx.font = `italic 700 ${fontSize}px "EB Garamond", Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(book.titleKo, CW / 2, ch * 0.5)
    const t = new THREE.CanvasTexture(cvs)
    t.minFilter = THREE.LinearFilter
    return t
  }, [book.coverColor, book.textColor, book.titleKo, H, D])

  // +Y face: 앞표지 커버 — 512px (선택 시 실제 이미지로 대체되므로 폴백 품질은 낮아도 됨)
  const coverTex = useMemo(() => {
    const CW = 512
    const cvs = document.createElement('canvas')
    const aspect = D / W
    cvs.width = CW; cvs.height = Math.round(CW * aspect)
    const ch = cvs.height
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = book.coverColor
    ctx.fillRect(0, 0, CW, ch)
    ctx.strokeStyle = book.textColor
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 2
    ctx.strokeRect(15, 15, CW - 30, ch - 30)
    ctx.globalAlpha = 1
    ctx.fillStyle = book.textColor
    ctx.globalAlpha = 0.05
    ctx.font = `italic 700 ${Math.round(ch * 0.22)}px "EB Garamond", Georgia, serif`
    ctx.textAlign = 'center'
    ctx.fillText(String(book.year), CW / 2, ch * 0.48)
    ctx.globalAlpha = 1
    ctx.fillStyle = book.textColor
    ctx.font = `italic 700 ${Math.round(ch * 0.057)}px "EB Garamond", Georgia, serif`
    const title = book.titleKo
    if (ctx.measureText(title).width > CW * 0.86) {
      const words = title.split(' ')
      const mid = Math.ceil(words.length / 2)
      ctx.fillText(words.slice(0, mid).join(' '), CW / 2, ch * 0.565)
      ctx.fillText(words.slice(mid).join(' '), CW / 2, ch * 0.63)
    } else {
      ctx.fillText(title, CW / 2, ch * 0.6)
    }
    ctx.font = `${Math.round(ch * 0.031)}px "EB Garamond", Georgia, serif`
    ctx.globalAlpha = 0.5
    ctx.fillText(book.author, CW / 2, ch * 0.7)
    ctx.globalAlpha = 1
    const t = new THREE.CanvasTexture(cvs)
    t.minFilter = THREE.LinearFilter
    return t
  }, [book.coverColor, book.textColor, book.titleKo, book.author, book.year, W, D])

  // 선택 해제 시 드래그 오프셋 초기화, 선택 시 커서 변경
  useEffect(() => {
    if (isSelected) {
      document.body.style.cursor = 'grab'
    } else {
      dragOffset.current = { x: 0, y: 0 }
      isDragging.current = false
    }
    return () => { if (isSelected) document.body.style.cursor = 'auto' }
  }, [isSelected])

  // 선택 상태일 때 전역 포인터 이벤트로 드래그 추적
  useEffect(() => {
    if (!isSelected) return
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged.current = true
      dragOffset.current.x += dy * 0.008
      dragOffset.current.y += dx * 0.008
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = 'grab'
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isSelected])

  useEffect(() => {
    if (!group.current) return
    group.current.rotation.x = Math.PI / 2
    group.current.rotation.y = Math.PI / 2
    group.current.rotation.z = -Math.PI / 2
  }, [])

  useFrame((state) => {
    if (!group.current) return

    const isAbove = selectedIndex !== null && index < selectedIndex
    const isBelow = selectedIndex !== null && index > selectedIndex

    if (isSelected) {
      const lerpF = isDragging.current ? 0.3 : 0.07
      const targetRx = Math.PI * 75 / 180 + dragOffset.current.x
      const targetRy = Math.PI * 10 / 180 + dragOffset.current.y
      group.current.rotation.x += (targetRx - group.current.rotation.x) * lerpF
      group.current.rotation.y += (targetRy - group.current.rotation.y) * lerpF
      group.current.rotation.z += (-Math.PI / 9 - group.current.rotation.z) * 0.07
      group.current.position.x += (-2.0 - group.current.position.x) * 0.07
      group.current.position.y += (0 - group.current.position.y) * 0.07
      group.current.position.z += (1.5 - group.current.position.z) * 0.07
    } else if (isAbove) {
      group.current.rotation.x += (0 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (0 - group.current.rotation.y) * 0.1
      group.current.position.x += (0 - group.current.position.x) * 0.1
      group.current.position.y += (14 - group.current.position.y) * 0.08
      group.current.position.z += (0 - group.current.position.z) * 0.1
    } else if (isBelow) {
      group.current.rotation.x += (0 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (0 - group.current.rotation.y) * 0.1
      group.current.position.x += (0 - group.current.position.x) * 0.1
      group.current.position.y += (-14 - group.current.position.y) * 0.08
      group.current.position.z += (0 - group.current.position.z) * 0.1
    } else {
      // 기본: rotation.x = PI/2, rotation.y = PI/2, rotation.z = PI/2
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      group.current.position.x += (0 - group.current.position.x) * 0.1
      const targetZ = hovered ? 0.5 : 0
      group.current.position.z += (targetZ - group.current.position.z) * 0.1
      group.current.position.y += (0 - group.current.position.y) * 0.1
      group.current.position.y += Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.0004
    }
  })

  const edge = new THREE.Color(book.edgeColor)
  const coverSide = new THREE.Color(book.coverColor)
  const pageEdge = new THREE.Color('#d8d0bd')
  const pageShadow = new THREE.Color('#a99f8f')
  const boardSide = book.cover ? new THREE.Color('#d7d0c1') : coverSide.clone().lerp(edge, 0.18)
  const boardShadow = book.cover ? new THREE.Color('#8d8577') : edge.clone().multiplyScalar(0.62)
  const hingeColor = book.cover ? boardShadow.clone().multiplyScalar(0.82) : edge.clone().multiplyScalar(0.55)
  const coverGeometry = useMemo(() => new RoundedBoxGeometry(coverW, boardT, coverD, 4, 0.028), [coverW, boardT, coverD])
  const pageGeometry = useMemo(() => new RoundedBoxGeometry(pageW, pageH, pageD, 3, 0.012), [pageW, pageH, pageD])
  const spineRadius = Math.min(0.018, spineT * 0.45)
  const spineGeometry = useMemo(() => new RoundedBoxGeometry(spineT, H, coverD, 4, spineRadius), [spineT, H, coverD, spineRadius])


  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        if (!isSelected) return
        e.stopPropagation()
        isDragging.current = true
        hasDragged.current = false
        lastMouse.current = { x: e.clientX, y: e.clientY }
        document.body.style.cursor = 'grabbing'
      }}
      onPointerOver={(e) => {
        if (selectedIndex !== null) return
        e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        if (!isSelected) document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!hasDragged.current) onSelect()
        hasDragged.current = false
      }}
    >
      <mesh castShadow receiveShadow position={[pageX, 0, 0]}>
        <primitive object={pageGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" color={pageShadow} map={getPageTex()} roughness={0.96} metalness={0} />
        <meshStandardMaterial attach="material-1" color={boardShadow} roughness={0.9} metalness={0} />
        <meshStandardMaterial attach="material-2" color={pageEdge} roughness={0.98} metalness={0} />
        <meshStandardMaterial attach="material-3" color={pageEdge.clone().multiplyScalar(0.9)} roughness={0.98} metalness={0} />
        <meshStandardMaterial attach="material-4" color={pageEdge} map={getPageTex()} roughness={0.96} metalness={0} />
        <meshStandardMaterial attach="material-5" color={pageEdge} map={getPageTex()} roughness={0.96} metalness={0} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, pageH / 2 + boardT / 2, 0]}>
        <primitive object={coverGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" color={boardShadow} roughness={0.62} metalness={0} />
        <meshStandardMaterial attach="material-1" color={boardSide} roughness={0.58} metalness={0} />
        {book.cover
          ? <ImageCoverMaterial attach="material-2" src={book.cover} />
          : <meshStandardMaterial attach="material-2" map={coverTex} roughness={0.42} metalness={0.01} />}
        <meshStandardMaterial attach="material-3" color={boardShadow.clone().multiplyScalar(0.82)} roughness={0.7} metalness={0} />
        <meshStandardMaterial attach="material-4" color={boardSide} roughness={0.6} metalness={0} />
        <meshStandardMaterial attach="material-5" color={boardShadow} roughness={0.66} metalness={0} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, -pageH / 2 - boardT / 2, 0]}>
        <primitive object={coverGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" color={boardShadow} roughness={0.68} metalness={0} />
        <meshStandardMaterial attach="material-1" color={boardSide.clone().multiplyScalar(0.92)} roughness={0.66} metalness={0} />
        <meshStandardMaterial attach="material-2" color={boardShadow.clone().multiplyScalar(0.82)} roughness={0.76} metalness={0} />
        {book.back
          ? <ImageCoverMaterial attach="material-3" src={book.back} rotation={Math.PI} />
          : <meshStandardMaterial attach="material-3" color={boardShadow.clone().multiplyScalar(0.7)} roughness={0.72} metalness={0} />}
        <meshStandardMaterial attach="material-4" color={boardSide.clone().multiplyScalar(0.95)} roughness={0.66} metalness={0} />
        <meshStandardMaterial attach="material-5" color={boardShadow.clone().multiplyScalar(0.9)} roughness={0.72} metalness={0} />
      </mesh>

      <mesh castShadow receiveShadow position={[-coverW / 2 + spineT / 2, 0, 0]}>
        <primitive object={spineGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" color={boardSide} roughness={0.64} metalness={0} />
        {book.spine
          ? <ImageCoverMaterial attach="material-1" src={book.spine} rotation={Math.PI / 2} />
          : <meshStandardMaterial attach="material-1" map={spineTex} roughness={0.52} metalness={0} />}
        <meshStandardMaterial attach="material-2" color={boardSide.clone().multiplyScalar(1.03)} roughness={0.58} metalness={0} />
        <meshStandardMaterial attach="material-3" color={boardShadow.clone().multiplyScalar(0.9)} roughness={0.66} metalness={0} />
        <meshStandardMaterial attach="material-4" color={boardSide.clone().multiplyScalar(0.95)} roughness={0.68} metalness={0} />
        <meshStandardMaterial attach="material-5" color={boardShadow} roughness={0.74} metalness={0} />
      </mesh>

      <mesh position={[hingeX, pageH / 2 + boardT + 0.005, 0]}>
        <boxGeometry args={[0.009, 0.004, D - 0.1]} />
        <meshStandardMaterial color={hingeColor} roughness={0.85} metalness={0} transparent opacity={0.28} />
      </mesh>

      <mesh position={[hingeX, -pageH / 2 - boardT - 0.005, 0]}>
        <boxGeometry args={[0.009, 0.004, D - 0.1]} />
        <meshStandardMaterial color={hingeColor.clone().multiplyScalar(0.8)} roughness={0.9} metalness={0} transparent opacity={0.18} />
      </mesh>

      <mesh position={[pageX + pageW / 2 + 0.004, 0, 0]}>
        <boxGeometry args={[0.012, pageH * 0.92, pageD * 0.96]} />
        <meshStandardMaterial color="#eee5d4" map={getPageTex()} roughness={0.98} metalness={0} />
      </mesh>
    </group>
  )
}

function Stack({ books, onSelect, onScrollEl, selectedId, targetYRef }: {
  books: BookItem[]
  onSelect: (book: BookItem) => void
  onScrollEl?: (el: HTMLElement) => void
  selectedId?: string | null
  targetYRef: React.MutableRefObject<number>
}) {
  const group = useRef<Group>(null)
  const scroll = useScroll()
  const selectedIndex = selectedId ? books.findIndex(b => b.id === selectedId) : null

  // 각 책의 실제 두께를 반영한 누적 Y 오프셋
  // 시각적 공백 = (book[i] 아래면) - (book[i+1] 위면) = BOOK_GAP 으로 일정하게 유지
  // → yOffsets[i+1] = yOffsets[i] - H[i]/2 - H[i+1]/2 - BOOK_GAP
  const yOffsets = useMemo(() => {
    const dims = books.map(b => bookDims(b).h)
    const offsets: number[] = [0]
    for (let i = 0; i < books.length - 1; i++) {
      offsets.push(offsets[i] - dims[i] / 2 - dims[i + 1] / 2 - BOOK_GAP)
    }
    return offsets
  }, [books])

  useEffect(() => { onScrollEl?.(scroll.el) }, [scroll.el, onScrollEl])

  useFrame(() => {
    if (!group.current) return
    if (selectedId && selectedIndex !== null) {
      const bookWorldY = group.current.position.y + yOffsets[selectedIndex] * 0.9
      targetYRef.current = bookWorldY
      return
    }
    targetYRef.current = 1.5
    const travel = -yOffsets[books.length - 1]
    const targetY = scroll.offset * travel
    group.current.position.y += (targetY - group.current.position.y) * 0.2
  })

  return (
    <group ref={group} position={[0, 0, 0]} scale={0.9}>
      {books.map((book, i) => (
        <Suspense key={book.id} fallback={null}>
          <group
            position={[0, yOffsets[i], 0]}
            rotation={[0, (i % 2 === 0 ? 1 : -1) * 0.02, 0]}
          >
            <Book
              book={book}
              index={i}
              onSelect={() => onSelect(book)}
              isSelected={selectedId === book.id}
              selectedIndex={selectedIndex}
            />
          </group>
        </Suspense>
      ))}
    </group>
  )
}

export function BookshelfScene({ books, onSelect, onScrollEl, selectedId }: {
  books: BookItem[]
  onSelect: (book: BookItem) => void
  onScrollEl?: (el: HTMLElement) => void
  selectedId?: string | null
}) {
  const targetYRef = useRef(1.5)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1c1714']} />
      <CameraSetup targetYRef={targetYRef} />
      {/* 주광: 우상단에서 내려오는 강한 따뜻한 빛 */}
      <directionalLight position={[4, 10, 7]} intensity={2.8} color="#fff5e8" castShadow />
      {/* 보조광: 좌측 차가운 빛 — 그림자 영역 완전한 암흑 방지 */}
      <directionalLight position={[-4, 3, 6]} intensity={0.4} color="#c8d8f0" />
      {/* 림라이트: 후면에서 책 테두리 분리 */}
      <directionalLight position={[0, -2, -8]} intensity={0.6} color="#4a3820" />
      {/* 환경광: 낮게 유지해 명암 대비 살림 */}
      <ambientLight intensity={0.25} />
      <Suspense fallback={null}>
        <ScrollControls pages={books.length * 0.4} damping={0.005}>
          <Stack books={books} onSelect={onSelect} onScrollEl={onScrollEl} selectedId={selectedId} targetYRef={targetYRef} />
        </ScrollControls>
        <Environment preset="apartment" />
      </Suspense>
    </Canvas>
  )
}
