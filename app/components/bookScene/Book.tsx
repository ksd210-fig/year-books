'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three-stdlib'
import * as THREE from 'three'
import type { Group } from 'three'
import { type BookItem, bookDims } from '../../lib/bookUtils'
import { ImageCoverMaterial, CoverStripMaterial, useClothNormalMap } from './materials'

export function Book({
  book, index, onSelect, isSelected, selectedIndex, isLoaded,
}: {
  book: BookItem
  index: number
  onSelect: () => void
  isSelected: boolean
  selectedIndex: number | null
  isLoaded: boolean
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

  // 페이지 단면 텍스처 — drei 캐시로 모든 Book 인스턴스가 공유
  const pageTex = useTexture('/textures/Book Seamless Texture.jpg')
  useMemo(() => {
    pageTex.wrapS = THREE.RepeatWrapping
    pageTex.wrapT = THREE.RepeatWrapping
    pageTex.repeat.set(6, 6)
    pageTex.anisotropy = 8
    pageTex.minFilter = THREE.LinearMipmapLinearFilter
    pageTex.needsUpdate = true
  }, [pageTex])

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
    // 위쪽 그늘 (스파인 쪽)
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
  const pageEdge = new THREE.Color('#d8d0bd')
  const boardSide = book.cover ? new THREE.Color('#d7d0c1') : coverSide.clone().lerp(edge, 0.18)
  const boardShadow = book.cover ? new THREE.Color('#8d8577') : edge.clone().multiplyScalar(0.62)
  const clothNormal = useClothNormalMap()
  const coverRadius = Math.min(0.003, H * 0.025)
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
      onPointerOut={() => { setHovered(false); if (!isSelected) document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); if (!hasDragged.current) onSelect(); hasDragged.current = false }}
    >
      <mesh castShadow receiveShadow position={[pageX, 0, 0]}>
        <primitive object={pageGeometry} attach="geometry" />
        <meshStandardMaterial color="#ddd5c2" map={pageLineTex} roughness={0.92} metalness={0} envMapIntensity={0.06} />
      </mesh>
      <mesh castShadow receiveShadow>
        <primitive object={coverGeometry} attach="geometry" />
        <meshStandardMaterial attach="material-0" map={pageTex} roughness={0.96} metalness={0} envMapIntensity={0.05} />
        {book.spine && isLoaded
          ? <ImageCoverMaterial attach="material-1" src={book.spine} rotation={Math.PI / 2} roughness={0.4} envMapIntensity={0.32} />
          : <meshStandardMaterial attach="material-1" map={spineTex} normalMap={clothNormal} normalScale={[0.35, 0.35]} roughness={0.46} metalness={0} envMapIntensity={0.28} />}
        {book.cover && isLoaded
          ? <ImageCoverMaterial attach="material-2" src={book.cover} roughness={0.38} envMapIntensity={0.36} />
          : <meshStandardMaterial attach="material-2" map={coverTex} normalMap={clothNormal} normalScale={[0.35, 0.35]} roughness={0.38} metalness={0} envMapIntensity={0.34} />}
        {book.back && isLoaded
          ? <ImageCoverMaterial attach="material-3" src={book.back} rotation={Math.PI} roughness={0.44} envMapIntensity={0.28} />
          : <meshStandardMaterial attach="material-3" color={boardShadow.clone().multiplyScalar(0.7)} roughness={0.74} metalness={0} envMapIntensity={0.12} />}
        <meshStandardMaterial attach="material-4" map={pageTex} roughness={0.96} metalness={0} envMapIntensity={0.05} />
        <meshStandardMaterial attach="material-5" map={pageTex} roughness={0.96} metalness={0} envMapIntensity={0.05} />
      </mesh>
    </group>
  )
}
