'use client'

/**
 * Three.js로 만든 3D 책 컴포넌트
 *
 * 핵심 개념:
 *  - Scene      : 3D 세계. 메쉬·카메라·빛을 담는 컨테이너
 *  - Mesh       : Geometry(형태) + Material(재질)로 만든 3D 오브젝트
 *  - Camera     : 씬을 바라보는 시점. PerspectiveCamera = 원근감 있는 카메라
 *  - Renderer   : GPU에게 씬을 그리라고 지시. <canvas>에 결과물 출력
 *  - Texture    : 이미지나 canvas를 3D 면에 붙이는 것
 *  - ResizeObserver: 컨테이너 크기 변화를 감지해 캔버스를 실시간 업데이트
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  title: string
  author: string
  faceColor: string
  edgeColor: string
  textColor: string
  isHovered: boolean
  isDimmed: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export default function ThreeBook({
  title, author, faceColor, edgeColor, textColor,
  isHovered, isDimmed, onClick, onMouseEnter, onMouseLeave,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const targetRotXRef = useRef(0.38)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ① Renderer
    //    alpha: false + setClearColor → 배경을 책 색상으로 채움
    //    → 3D 책이 캔버스 중앙에 있더라도 전체 밴드가 책 색상으로 보임
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color(faceColor), 1)
    container.appendChild(renderer.domElement)

    // ② Scene
    const scene = new THREE.Scene()

    // ③ Camera — 낮은 각도로 배치하면 책이 더 입체적으로 보임
    //    카메라가 수평에 가까울수록 앞면(두께)이 잘 보이고 원근감이 강해짐
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 1.4, 2.8)
    camera.lookAt(0, 0, 0)

    // ④ Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1)
    keyLight.position.set(2, 5, 3)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
    fillLight.position.set(-2, 2, -1)
    scene.add(fillLight)

    // ⑤ Geometry: 책 = 납작한 직육면체 (XZ 평면에 누워있음, Y = 두께)
    const geo = new THREE.BoxGeometry(5.8, 0.18, 3.2)

    // ⑥ Canvas Texture: 2D canvas에 텍스트 → Three.js 텍스처
    const makeCoverTexture = () => {
      const cvs = document.createElement('canvas')
      cvs.width = 1024
      cvs.height = 512
      const ctx = cvs.getContext('2d')!
      ctx.fillStyle = faceColor
      ctx.fillRect(0, 0, 1024, 512)
      // 왼쪽 가장자리 책등 그림자
      const grad = ctx.createLinearGradient(0, 0, 180, 0)
      grad.addColorStop(0, 'rgba(0,0,0,0.35)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1024, 512)
      // 제목 — 캔버스 중앙에 배치 (perspective로 잘리지 않게)
      ctx.fillStyle = textColor
      ctx.font = 'italic 600 52px "EB Garamond", Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillText(title, 512, 210)
      // 저자
      ctx.font = '36px "EB Garamond", Georgia, serif'
      ctx.globalAlpha = 0.72
      ctx.fillText(author, 512, 268)
      ctx.globalAlpha = 1
      ctx.textAlign = 'left'
      return new THREE.CanvasTexture(cvs)
    }

    let mesh: THREE.Mesh | null = null
    let coverTex: THREE.CanvasTexture | null = null

    // 폰트 로딩 후 텍스처 및 메쉬 생성
    document.fonts.ready.then(() => {
      coverTex = makeCoverTexture()
      const edgeC = new THREE.Color(edgeColor)
      // ⑦ Materials: BoxGeometry 6면 — +X, -X, +Y(표지), -Y, +Z, -Z
      const mats = [
        new THREE.MeshStandardMaterial({ color: edgeC }),
        new THREE.MeshStandardMaterial({ color: edgeC.clone().multiplyScalar(0.65) }), // 책등
        new THREE.MeshStandardMaterial({ map: coverTex }),                              // 앞표지
        new THREE.MeshStandardMaterial({ color: edgeC.clone().multiplyScalar(0.5) }),
        new THREE.MeshStandardMaterial({ color: edgeC }),
        new THREE.MeshStandardMaterial({ color: edgeC }),
      ]
      // ⑧ Mesh = Geometry + Material
      mesh = new THREE.Mesh(geo, mats)
      scene.add(mesh)

      // ⑨ Animation loop
      //    기본 기울기 0.5 (약 29°) → 카메라 각도와 합쳐서 두께가 잘 보임
      //    호버 시 0.1 (약 6°) → 책이 카메라 쪽으로 세워지는 느낌
      let currentRotX = 0.5
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate)
        currentRotX += (targetRotXRef.current - currentRotX) * 0.07
        mesh!.rotation.x = currentRotX
        renderer.render(scene, camera)
      }
      animate()
    })

    // ⑩ ResizeObserver: 컨테이너 크기가 확정되거나 변경될 때 renderer·camera 업데이트
    //    useEffect 실행 시점에 clientWidth가 아직 0일 수 있어서
    //    "크기가 확정된 순간"을 ResizeObserver로 잡음
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width === 0 || height === 0) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameRef.current)
      renderer.dispose()
      geo.dispose()
      coverTex?.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [faceColor, edgeColor, textColor, title, author])

  useEffect(() => {
    targetRotXRef.current = isHovered ? 0.08 : 0.5
  }, [isHovered])

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '100%',
        height: '28vh',
        cursor: 'pointer',
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 0.4s ease',
        marginBottom: 14,
      }}
    />
  )
}
