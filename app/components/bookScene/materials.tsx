'use client'

import { useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

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
  // 간단한 pseudo-random noise (종이 섬유 느낌)
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

export function ImageCoverMaterial({
  src, attach, rotation, roughness = 0.42, envMapIntensity = 0.32,
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
    const t = sourceTex.clone()
    t.anisotropy = gl.capabilities.getMaxAnisotropy()
    t.minFilter = THREE.LinearFilter
    t.needsUpdate = true
    if (rotation) { t.rotation = rotation; t.center.set(0.5, 0.5) }
    return t
  }, [gl, rotation, sourceTex])

  useEffect(() => () => tex.dispose(), [tex])

  const normalMap = useMemo(() => getClothNormalMap(), [])
  return <meshStandardMaterial attach={attach} map={tex} normalMap={normalMap} normalScale={[0.35, 0.35]} roughness={roughness} metalness={0} envMapIntensity={envMapIntensity} />
}

export function CoverStripMaterial({
  src, attach, edge, roughness = 0.44, envMapIntensity = 0.24, polygonOffset,
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
    const sx = edge === 'left'
      ? Math.max(0, Math.round(sourceW * 0.018))
      : Math.max(0, sourceW - stripW - Math.round(sourceW * 0.018))
    ctx.drawImage(img as CanvasImageSource, sx, 0, stripW, sourceH, pad, 0, stripW, sourceH)
    ctx.drawImage(img as CanvasImageSource, sx, 0, 1, sourceH, 0, 0, pad, sourceH)
    ctx.drawImage(img as CanvasImageSource, sx + stripW - 1, 0, 1, sourceH, pad + stripW, 0, pad, sourceH)
    const t = new THREE.CanvasTexture(cvs)
    t.anisotropy = gl.capabilities.getMaxAnisotropy()
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [edge, gl, sourceTex])

  useEffect(() => () => tex.dispose(), [tex])

  return (
    <meshStandardMaterial
      attach={attach} map={tex} roughness={roughness} metalness={0} envMapIntensity={envMapIntensity}
      polygonOffset={polygonOffset !== undefined} polygonOffsetFactor={polygonOffset ?? 0} polygonOffsetUnits={polygonOffset ?? 0}
    />
  )
}
