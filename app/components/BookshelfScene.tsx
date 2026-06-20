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
    camera.position.x += (0 - camera.position.x) * 0.06
    camera.position.z += (14 - camera.position.z) * 0.06
    // lookAt은 카메라보다 2.6 아래를 고정 추적 → 항상 약 10.5° 내려다봄
    lookAtRef.current.y += ((targetYRef.current - 2.6) - lookAtRef.current.y) * 0.06
    camera.lookAt(lookAtRef.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 2.4, 14]} fov={30} />
}

function ImageCoverMaterial({
  src,
  attach,
  rotation,
  roughness = 0.42,
  envMapIntensity = 0.32,
}: {
  src: string
  attach: string
  rotation?: number
  roughness?: number
  envMapIntensity?: number
}) {
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

  return <meshStandardMaterial attach={attach} map={tex} roughness={roughness} metalness={0} envMapIntensity={envMapIntensity} />
}

function CoverStripMaterial({
  src,
  attach,
  edge,
  roughness = 0.44,
  envMapIntensity = 0.24,
  polygonOffset,
}: {
  src: string
  attach: string
  edge: 'left' | 'right'
  roughness?: number
  envMapIntensity?: number
  polygonOffset?: number
}) {
  const sourceTex = useTexture(src)
  const { gl } = useThree()

  const tex = useMemo(() => {
    const img = sourceTex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined
    const sourceW = img?.width ?? 1
    const sourceH = img?.height ?? 1
    const stripW = Math.max(8, Math.round(sourceW * 0.055))
    const pad = 3
    const cvs = document.createElement('canvas')
    cvs.width = stripW + pad * 2
    cvs.height = sourceH
    const ctx = cvs.getContext('2d')!
    const sx = edge === 'left' ? Math.max(0, Math.round(sourceW * 0.018)) : Math.max(0, sourceW - stripW - Math.round(sourceW * 0.018))

    ctx.drawImage(img as CanvasImageSource, sx, 0, stripW, sourceH, pad, 0, stripW, sourceH)
    ctx.drawImage(img as CanvasImageSource, sx, 0, 1, sourceH, 0, 0, pad, sourceH)
    ctx.drawImage(img as CanvasImageSource, sx + stripW - 1, 0, 1, sourceH, pad + stripW, 0, pad, sourceH)

    const stripTex = new THREE.CanvasTexture(cvs)
    stripTex.anisotropy = gl.capabilities.getMaxAnisotropy()
    stripTex.minFilter = THREE.LinearFilter
    stripTex.magFilter = THREE.LinearFilter
    stripTex.needsUpdate = true
    return stripTex
  }, [edge, gl, sourceTex])

  useEffect(() => () => tex.dispose(), [tex])

  return (
    <meshStandardMaterial
      attach={attach}
      map={tex}
      roughness={roughness}
      metalness={0}
      envMapIntensity={envMapIntensity}
      polygonOffset={polygonOffset !== undefined}
      polygonOffsetFactor={polygonOffset ?? 0}
      polygonOffsetUnits={polygonOffset ?? 0}
    />
  )
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
      group.current.rotation.z += (-Math.PI / 10 - group.current.rotation.z) * 0.07
      group.current.position.x += (-1.7 - group.current.position.x) * 0.07
      group.current.position.y += (0 - group.current.position.y) * 0.07
      group.current.position.z += (0 - group.current.position.z) * 0.07
    } else if (isAbove) {
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      group.current.position.x += (-1.7 - group.current.position.x) * 0.1
      group.current.position.y += (14 - group.current.position.y) * 0.08
      group.current.position.z += (0 - group.current.position.z) * 0.1
    } else if (isBelow) {
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      group.current.position.x += (-1.7 - group.current.position.x) * 0.1
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
  const boardSide = book.cover ? new THREE.Color('#d7d0c1') : coverSide.clone().lerp(edge, 0.18)
  const boardShadow = book.cover ? new THREE.Color('#8d8577') : edge.clone().multiplyScalar(0.62)
  const coverRadius = Math.min(0.008, H * 0.06)
  const pageRadius = Math.min(0.008, pageH * 0.08)
  const coverGeometry = useMemo(() => new RoundedBoxGeometry(coverW, H, coverD, 7, coverRadius), [coverW, H, coverD, coverRadius])
  const pageGeometry = useMemo(() => new RoundedBoxGeometry(pageW, pageH, pageD, 5, pageRadius), [pageW, pageH, pageD, pageRadius])


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
      {/* Page block — cover 안에 완전히 내포됨 */}
      <mesh castShadow receiveShadow position={[pageX, 0, 0]}>
        <primitive object={pageGeometry} attach="geometry" />
        <meshStandardMaterial color="#bfb8a3" roughness={0.99} metalness={0} envMapIntensity={0.04} />
      </mesh>

      {/* 단일 통합 커버 — material-0:fore-edge / 1:spine / 2:앞표지 / 3:뒤표지 / 4:head / 5:tail */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <primitive object={coverGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" color={pageEdge} map={getPageTex()} roughness={0.98} metalness={0} envMapIntensity={0.06} transparent opacity={0.9} />
        {book.spine
          ? <ImageCoverMaterial attach="material-1" src={book.spine} rotation={Math.PI / 2} roughness={0.4} envMapIntensity={0.32} />
          : <meshStandardMaterial attach="material-1" map={spineTex} roughness={0.46} metalness={0} envMapIntensity={0.28} />}
        {book.cover
          ? <ImageCoverMaterial attach="material-2" src={book.cover} roughness={0.38} envMapIntensity={0.36} />
          : <meshStandardMaterial attach="material-2" map={coverTex} roughness={0.38} metalness={0} envMapIntensity={0.34} />}
        {book.back
          ? <ImageCoverMaterial attach="material-3" src={book.back} rotation={Math.PI} roughness={0.44} envMapIntensity={0.28} />
          : <meshStandardMaterial attach="material-3" color={boardShadow.clone().multiplyScalar(0.7)} roughness={0.74} metalness={0} envMapIntensity={0.12} />}
        {book.cover
          ? <CoverStripMaterial attach="material-4" src={book.cover} edge="left" roughness={0.42} envMapIntensity={0.26} />
          : <meshStandardMaterial attach="material-4" color={boardSide} roughness={0.62} metalness={0} envMapIntensity={0.22} />}
        {book.back
          ? <CoverStripMaterial attach="material-5" src={book.back} edge="right" roughness={0.46} envMapIntensity={0.22} />
          : <meshStandardMaterial attach="material-5" color={boardShadow} roughness={0.68} metalness={0} envMapIntensity={0.16} />}
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
      const bookWorldY = group.current.position.y + yOffsets[selectedIndex] * 0.9  // scale=0.9 반영
      targetYRef.current = bookWorldY + 2.6  // 카메라 2.6 위 → lookAt이 책 Y에 정확히 맞음
      return
    }
    targetYRef.current = 2.4
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
  const targetYRef = useRef(2.4)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1c1714']} />
      <CameraSetup targetYRef={targetYRef} />
      {/* 넓은 주광: 커버에 부드러운 satin 하이라이트를 만든다 */}
      <directionalLight
        position={[4.5, 8, 6.5]}
        intensity={2.4}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00015}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={10}
        shadow-camera-bottom={-18}
      />
      {/* 정면 fill: spine 이미지를 카메라 방향에서 밝게 */}
      <directionalLight position={[0, 3, 12]} intensity={0.7} color="#fff8f2" />
      {/* 측면 보조광 */}
      <directionalLight position={[-5, 4, 5]} intensity={0.4} color="#d7e2ff" />
      {/* 아주 약한 림라이트: 어두운 배경에서 책 모서리만 분리 */}
      <directionalLight position={[-2, -3, -7]} intensity={0.28} color="#b99362" />
      <ambientLight intensity={0.26} />
      <Suspense fallback={null}>
        <ScrollControls pages={books.length * 0.4} damping={0.005}>
          <Stack books={books} onSelect={onSelect} onScrollEl={onScrollEl} selectedId={selectedId} targetYRef={targetYRef} />
        </ScrollControls>
        <Environment preset="apartment" environmentIntensity={0.52} />
      </Suspense>
    </Canvas>
  )
}
