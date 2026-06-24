'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three-stdlib'
import * as THREE from 'three'
import type { Group } from 'three'
import { type BookItem, bookDims } from '../../lib/bookUtils'
import { ImageCoverMaterial, useClothNormalMap, useSharedPageEdgeMaterial } from './materials'

export function Book({
  book, index, onSelect, isSelected, selectedIndex, onCoverLoad, isMobile,
}: {
  book: BookItem
  index: number
  onSelect: () => void
  isSelected: boolean
  selectedIndex: number | null
  onCoverLoad?: () => void
  isMobile?: boolean
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const { w: W, h: H, d: D } = bookDims(book)
  const boardT = Math.min(0.055, Math.max(0.032, H * 0.11))
  const pageH = Math.max(0.04, H - boardT * 2)
  const coverW = W + 0.018
  const coverD = D + 0.022
  const pageW = W - 0.08
  const pageD = D - 0.055
  const pageX = 0.04

  const dragOffset = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const hasDragged = useRef(false)

  // 페이지 바깥면 텍스처 — drei 캐시로 모든 Book 인스턴스가 공유
  const pageTex = useTexture('/textures/Book Seamless Texture.webp')
  useMemo(() => {
    pageTex.wrapS = THREE.RepeatWrapping
    pageTex.wrapT = THREE.RepeatWrapping
    pageTex.repeat.set(6, 6)
    pageTex.anisotropy = 8
    pageTex.minFilter = THREE.LinearMipmapLinearFilter
    pageTex.needsUpdate = true
  }, [pageTex])
  const sharedPageEdgeMat = useSharedPageEdgeMaterial(pageTex)

  // 페이지 단면 — 수평 선이 보이는 절단면 텍스처
  const pageLineTex = useMemo(() => {
    const W = 512, H = 512
    const cvs = document.createElement('canvas')
    cvs.width = W; cvs.height = H
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = '#e8ddd0'
    ctx.fillRect(0, 0, W, H)
    const lineCount = 220
    for (let i = 0; i < lineCount; i++) {
      const y = Math.round((i / lineCount) * H)
      const alpha = i % 5 === 0 ? 0.13 : 0.055
      ctx.strokeStyle = `rgba(100, 80, 55, ${alpha})`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, y); ctx.lineTo(W, y)
      ctx.stroke()
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.18)
    grad.addColorStop(0, 'rgba(60, 40, 20, 0.14)')
    grad.addColorStop(1, 'rgba(60, 40, 20, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H * 0.18)
    const t = new THREE.CanvasTexture(cvs)
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, Math.round(D / W * 4))
    t.anisotropy = 8
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    return t
  }, [D])

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

  const backFallbackTex = useMemo(() => {
    const c = new THREE.Color(book.edgeColor).multiplyScalar(0.62)
    const cvs = document.createElement('canvas')
    cvs.width = 4; cvs.height = 4
    const ctx = cvs.getContext('2d')!
    ctx.fillStyle = `#${c.getHexString()}`
    ctx.fillRect(0, 0, 4, 4)
    const t = new THREE.CanvasTexture(cvs)
    t.needsUpdate = true
    return t
  }, [book.edgeColor])

  useEffect(() => {
    if (!book.cover) onCoverLoad?.()
  }, [book.cover, onCoverLoad])

  useEffect(() => {
    if (isSelected) {
      document.body.style.cursor = 'grab'
    } else {
      dragOffset.current = { x: 0, y: 0 }
      isDragging.current = false
    }
    return () => { if (isSelected) document.body.style.cursor = 'auto' }
  }, [isSelected])

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
      if (isDragging.current) { isDragging.current = false; document.body.style.cursor = 'grab' }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [isSelected])

  useFrame((state) => {
    if (!group.current) return
    const isAbove = selectedIndex !== null && index < selectedIndex
    const isBelow = selectedIndex !== null && index > selectedIndex

    // 부모 그룹이 invisible이면 전환 중이 아닌 한 skip (draw call 없는 책은 연산도 생략)
    if (!isSelected && !isAbove && !isBelow && group.current.parent?.visible === false) return

    if (isSelected) {
      const lerpF = isDragging.current ? 0.3 : 0.07
      const targetRx = Math.PI * 75 / 180 + dragOffset.current.x
      const targetRy = Math.PI * 10 / 180 + dragOffset.current.y
      group.current.rotation.x += (targetRx - group.current.rotation.x) * lerpF
      group.current.rotation.y += (targetRy - group.current.rotation.y) * lerpF
      group.current.rotation.z += (-Math.PI / 10 - group.current.rotation.z) * 0.07
      // 모바일: 중앙 유지 (상세 패널이 하단에서 올라옴), 데스크탑: 왼쪽으로 이동
      const targetX = isMobile ? 0 : -1.7
      const targetBookY = isMobile ? 5.8 : 0
      group.current.position.x += (targetX - group.current.position.x) * 0.07
      group.current.position.y += (targetBookY - group.current.position.y) * 0.07
      group.current.position.z += (0 - group.current.position.z) * 0.07
    } else if (isAbove) {
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      // 모바일: 화면 위로, 데스크탑: 왼쪽 위로
      group.current.position.x += ((isMobile ? 0 : -1.7) - group.current.position.x) * 0.1
      group.current.position.y += (14 - group.current.position.y) * 0.08
      group.current.position.z += (0 - group.current.position.z) * 0.1
    } else if (isBelow) {
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      // 모바일: 화면 아래로, 데스크탑: 왼쪽 아래로
      group.current.position.x += ((isMobile ? 0 : -1.7) - group.current.position.x) * 0.1
      group.current.position.y += (-14 - group.current.position.y) * 0.08
      group.current.position.z += (0 - group.current.position.z) * 0.1
    } else {
      group.current.rotation.x += (Math.PI / 2 - group.current.rotation.x) * 0.1
      group.current.rotation.y += (Math.PI / 2 - group.current.rotation.y) * 0.1
      group.current.rotation.z += (-Math.PI / 2 - group.current.rotation.z) * 0.1
      group.current.position.x += (0 - group.current.position.x) * 0.1
      group.current.position.z += ((hovered ? 0.5 : 0) - group.current.position.z) * 0.1
      group.current.position.y += (0 - group.current.position.y) * 0.1
      group.current.position.y += Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.0004
    }
  })

  const edge = new THREE.Color(book.edgeColor)
  const coverSide = new THREE.Color(book.coverColor)
  const clothNormal = useClothNormalMap()
  const pageRadius = Math.min(0.008, pageH * 0.08)
  const coverGeometry = useMemo(() => new RoundedBoxGeometry(coverW, H, coverD, 2, 0), [coverW, H, coverD])
  const pageGeometry = useMemo(() => new RoundedBoxGeometry(pageW, pageH, pageD, 5, pageRadius), [pageW, pageH, pageD, pageRadius])

  return (
    <group
      ref={group}
      rotation={[Math.PI / 2, Math.PI / 2, -Math.PI / 2]}
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
      onPointerOut={() => { setHovered(false); if (!isSelected) document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); if (!hasDragged.current) onSelect(); hasDragged.current = false }}
    >
      <mesh position={[pageX, 0, 0]}>
        <primitive object={pageGeometry} attach="geometry" />
        <meshLambertMaterial color="#ddd5c2" map={pageLineTex} />
      </mesh>
      <mesh>
        <primitive object={coverGeometry} attach="geometry" />
        <primitive object={sharedPageEdgeMat} attach="material-0" />
        {book.spine
          ? <ImageCoverMaterial attach="material-1" src={book.spine} rotation={Math.PI / 2} roughness={0.4} envMapIntensity={0.32} fallback={spineTex} />
          : <meshStandardMaterial attach="material-1" map={spineTex} normalMap={clothNormal} normalScale={[0.35, 0.35]} roughness={0.46} metalness={0} envMapIntensity={0.28} />}
        {book.cover
          ? <ImageCoverMaterial attach="material-2" src={book.cover} roughness={0.38} envMapIntensity={0.36} fallback={coverTex} onLoad={onCoverLoad} />
          : <meshStandardMaterial attach="material-2" map={coverTex} normalMap={clothNormal} normalScale={[0.35, 0.35]} roughness={0.38} metalness={0} envMapIntensity={0.34} />}
        {book.back
          ? <ImageCoverMaterial attach="material-3" src={book.back} rotation={Math.PI} roughness={0.44} envMapIntensity={0.28} fallback={backFallbackTex} />
          : <meshStandardMaterial attach="material-3" color={edge.clone().multiplyScalar(0.62)} roughness={0.74} metalness={0} envMapIntensity={0.12} />}
        <primitive object={sharedPageEdgeMat} attach="material-4" />
        <primitive object={sharedPageEdgeMat} attach="material-5" />
      </mesh>
    </group>
  )
}
