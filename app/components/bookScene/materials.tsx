'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function useSharedPageEdgeMaterial(pageTex: THREE.Texture): THREE.MeshLambertMaterial {
  const material = useMemo(() => new THREE.MeshLambertMaterial({ map: pageTex }), [pageTex])
  useEffect(() => () => material.dispose(), [material])
  return material
}

// 종이 질감 normal map — 모든 커버가 공유하는 싱글톤
let _clothNormal: THREE.CanvasTexture | null = null
function getClothNormalMap(): THREE.CanvasTexture {
  if (_clothNormal) return _clothNormal
  const W = 512, H = 512
  const cvs = document.createElement('canvas')
  cvs.width = W; cvs.height = H
  const ctx = cvs.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const d = img.data
  function noise(x: number, y: number) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }
  function smoothNoise(x: number, y: number) {
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    return (
      noise(ix, iy)     * (1 - ux) * (1 - uy) +
      noise(ix+1, iy)   * ux       * (1 - uy) +
      noise(ix, iy+1)   * (1 - ux) * uy       +
      noise(ix+1, iy+1) * ux       * uy
    )
  }
  function h(px: number, py: number) {
    const x = px / W * 32, y = py / H * 32
    return smoothNoise(x, y) * 0.18 + smoothNoise(x * 2.5, y * 2.5) * 0.08
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let nx = (h(x - 1, y) - h(x + 1, y)) / 2
      let ny = (h(x, y - 1) - h(x, y + 1)) / 2
      let nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      nx /= len; ny /= len; nz /= len
      d[i]   = Math.round((nx * 0.5 + 0.5) * 255)
      d[i+1] = Math.round((ny * 0.5 + 0.5) * 255)
      d[i+2] = Math.round((nz * 0.5 + 0.5) * 255)
      d[i+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(cvs)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.anisotropy = 8
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  _clothNormal = tex
  return tex
}

export function useClothNormalMap() {
  return useMemo(() => getClothNormalMap(), [])
}

// Suspense 없이 비동기 로드 — fallback 텍스처를 즉시 표시하고 이미지 로드 후 교체
export function ImageCoverMaterial({
  src, attach, rotation, roughness = 0.42, envMapIntensity = 0.32, fallback, onLoad,
}: {
  src: string
  attach: string
  rotation?: number
  roughness?: number
  envMapIntensity?: number
  fallback?: THREE.Texture | null
  onLoad?: () => void
}) {
  const { gl } = useThree()
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const loadedRef = useRef<THREE.Texture | null>(null)
  const normalMap = useMemo(() => getClothNormalMap(), [])

  useEffect(() => {
    let cancelled = false
    new THREE.TextureLoader().load(src, (loaded) => {
      if (cancelled) { loaded.dispose(); return }
      loaded.anisotropy = gl.capabilities.getMaxAnisotropy()
      loaded.minFilter = THREE.LinearFilter
      loaded.needsUpdate = true
      if (rotation !== undefined) { loaded.rotation = rotation; loaded.center.set(0.5, 0.5) }
      const prev = loadedRef.current
      loadedRef.current = loaded
      setTex(loaded)
      onLoad?.()
      prev?.dispose()
    })
    return () => {
      cancelled = true
      loadedRef.current?.dispose()
      loadedRef.current = null
    }
  }, [src, gl, rotation, onLoad])

  const activeTex = tex ?? fallback ?? null
  return (
    <meshStandardMaterial
      attach={attach}
      map={activeTex}
      normalMap={normalMap}
      normalScale={[0.35, 0.35]}
      roughness={roughness}
      metalness={0}
      envMapIntensity={envMapIntensity}
    />
  )
}
