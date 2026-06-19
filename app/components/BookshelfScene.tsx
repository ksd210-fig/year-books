'use client'

import React, { Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, ScrollControls, useScroll, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Group } from 'three'

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
const DEFAULT_H = 0.55  // 두께 (고정)
const DEFAULT_D = 4.5

function bookDims(book: BookItem) {
  const w = book.mmW ? +(book.mmW * MM_SCALE).toFixed(3) : DEFAULT_W
  const d = book.mmH ? +(book.mmH * MM_SCALE).toFixed(3) : DEFAULT_D
  const h = book.mmD ? +(book.mmD * MM_SCALE).toFixed(3) : DEFAULT_H
  return { w, h, d }
}

const GAP = 1.3

const LOOK_AT = new THREE.Vector3(0, -0.2, 0)
function CameraSetup({ targetYRef }: { targetYRef: React.MutableRefObject<number> }) {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.y += (targetYRef.current - camera.position.y) * 0.06
    LOOK_AT.y += (targetYRef.current - LOOK_AT.y) * 0.06
    camera.lookAt(LOOK_AT)
  })
  return null
}

function ImageCoverMaterial({ src, attach, rotation }: { src: string; attach: string; rotation?: number }) {
  const tex = useTexture(src)
  const { gl } = useThree()
  tex.anisotropy = gl.capabilities.getMaxAnisotropy()
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  if (rotation) {
    tex.rotation = rotation
    tex.center.set(0.5, 0.5)
  }
  return <meshStandardMaterial attach={attach} map={tex} roughness={0.35} metalness={0.02} />
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

  // -X face (camera-facing): 책등 텍스트 (D×H canvas — aspect matches D/H geometry)
  const spineTex = useMemo(() => {
    const cvs = document.createElement('canvas')
    const ch = Math.round(2048 * H / D)
    cvs.width = 2048; cvs.height = ch
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = book.coverColor
    ctx.fillRect(0, 0, 1024, ch)
    ctx.fillStyle = book.textColor
    const fontSize = Math.max(20, Math.round(ch * 0.55))
    ctx.font = `italic 700 ${fontSize}px "EB Garamond", Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(book.titleKo, 1024, ch * 0.5)
    const t = new THREE.CanvasTexture(cvs)
    t.minFilter = THREE.LinearFilter
    return t
  }, [book.coverColor, book.textColor, book.titleKo, H, D])

  // +Y face: 앞표지 커버 (W×D canvas — aspect matches geometry)
  const coverTex = useMemo(() => {
    const cvs = document.createElement('canvas')
    const aspect = D / W
    cvs.width = 2048; cvs.height = Math.round(2048 * aspect)
    const ch = cvs.height
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = book.coverColor
    ctx.fillRect(0, 0, 2048, ch)
    ctx.strokeStyle = book.textColor
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 8
    ctx.strokeRect(60, 60, 1928, ch - 120)
    ctx.globalAlpha = 1
    ctx.fillStyle = book.textColor
    ctx.globalAlpha = 0.05
    ctx.font = `italic 700 ${Math.round(ch * 0.22)}px "EB Garamond", Georgia, serif`
    ctx.textAlign = 'center'
    ctx.fillText(String(book.year), 1024, ch * 0.48)
    ctx.globalAlpha = 1
    ctx.fillStyle = book.textColor
    ctx.font = `italic 700 ${Math.round(ch * 0.057)}px "EB Garamond", Georgia, serif`
    const title = book.titleKo
    if (ctx.measureText(title).width > 1760) {
      const words = title.split(' ')
      const mid = Math.ceil(words.length / 2)
      ctx.fillText(words.slice(0, mid).join(' '), 1024, ch * 0.565)
      ctx.fillText(words.slice(mid).join(' '), 1024, ch * 0.63)
    } else {
      ctx.fillText(title, 1024, ch * 0.6)
    }
    ctx.font = `${Math.round(ch * 0.031)}px "EB Garamond", Georgia, serif`
    ctx.globalAlpha = 0.5
    ctx.fillText(book.author, 1024, ch * 0.7)
    ctx.globalAlpha = 1
    const t = new THREE.CanvasTexture(cvs)
    t.minFilter = THREE.LinearFilter
    return t
  }, [book.coverColor, book.textColor, book.titleKo, book.author, book.year, W, D])

  const { useEffect } = require('react')
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
      // rotation.x = PI/2: +Y(커버)가 카메라 정면으로
      // rotation.y = 0.2: 책등 바인딩(-X)이 왼쪽에서 살짝 보임
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.07
      group.current.rotation.y += (Math.PI * 10 / 180 - group.current.rotation.y) * 0.07
      group.current.rotation.z += (Math.PI * 20 / 180 - group.current.rotation.z) * 0.07
      group.current.position.x += (-1.6 - group.current.position.x) * 0.07
      group.current.position.y += (0 - group.current.position.y) * 0.07
      group.current.position.z += (4.0 - group.current.position.z) * 0.07
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

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        if (selectedIndex !== null) return
        e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} key={`${W}-${H}-${D}`} />
        {/*
          Rotation (PI/2, PI/2, -PI/2) — extrinsic XYZ:
          +X (material-0): local +X → world -Z (카메라 반대쪽)  = 페이지 단면 (크림)
          -X (material-1): local -X → world +Z (카메라 정면)    = 책등 텍스트/이미지
          +Y (material-2): local +Y → world -Y (아래)           = 앞표지 (선택 시 정면)
          -Y (material-3): local -Y → world +Y (위)             = 뒷면 (위에서 보임)
          +Z (material-4): local +Z → world -X (왼쪽)           = 측면
          -Z (material-5): local -Z → world +X (오른쪽)         = 측면
        */}
        <meshStandardMaterial attach="material-0" color="#e8dfc8" roughness={0.95} />
        {book.spine
          ? <ImageCoverMaterial attach="material-1" src={book.spine} rotation={Math.PI / 2} />
          : <meshStandardMaterial attach="material-1" map={spineTex} roughness={0.4} />}
        {book.cover
          ? <ImageCoverMaterial attach="material-2" src={book.cover} />
          : <meshStandardMaterial attach="material-2" map={coverTex} roughness={0.35} metalness={0.02} />}
        {book.back
          ? <ImageCoverMaterial attach="material-3" src={book.back} rotation={Math.PI} />
          : <meshStandardMaterial attach="material-3" color={edge.clone().multiplyScalar(0.5)} roughness={0.7} />}
        <meshStandardMaterial attach="material-4" color={edge} roughness={0.6} />
        <meshStandardMaterial attach="material-5" color={edge.clone().multiplyScalar(0.5)} roughness={0.7} />
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

  const { useEffect } = require('react')
  useEffect(() => { onScrollEl?.(scroll.el) }, [scroll.el, onScrollEl])

  useFrame(() => {
    if (!group.current) return
    if (selectedId && selectedIndex !== null) {
      // 선택된 책의 월드 Y를 카메라 타겟으로 전달
      const bookWorldY = group.current.position.y + (-selectedIndex * GAP) * 0.9
      targetYRef.current = bookWorldY
      return
    }
    targetYRef.current = 1.5  // 기본 카메라 Y
    const travel = (books.length - 1) * GAP
    const targetY = scroll.offset * travel
    group.current.position.y += (targetY - group.current.position.y) * 0.2
  })

  return (
    <group ref={group} position={[0, 0, 0]} scale={0.9}>
      {books.map((book, i) => (
        <group
          key={book.id}
          position={[0, -i * GAP, 0]}
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
      camera={{ position: [0, 1.5, 15], fov: 28 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1c1714']} />
      <CameraSetup targetYRef={targetYRef} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 8]} intensity={2.2} castShadow />
      <directionalLight position={[-2, 2, 5]} intensity={0.5} color="#caa05a" />
      <directionalLight position={[0, 2, 6]} intensity={0.35} />
      <Suspense fallback={null}>
        <ScrollControls pages={books.length * 0.4} damping={0.005}>
          <Stack books={books} onSelect={onSelect} onScrollEl={onScrollEl} selectedId={selectedId} targetYRef={targetYRef} />
        </ScrollControls>
        <Environment preset="apartment" />
      </Suspense>
    </Canvas>
  )
}
