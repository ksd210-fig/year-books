'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PerspectiveCamera as PerspectiveCameraType } from 'three'

export function CameraSetup({ targetYRef, snapCameraRef, isMobile }: {
  targetYRef: React.MutableRefObject<number>
  snapCameraRef: React.MutableRefObject<boolean>
  isMobile?: boolean
}) {
  const cameraRef = useRef<PerspectiveCameraType>(null)
  const lookAtRef = useRef(new THREE.Vector3(0, -0.3, 0))
  const fov = isMobile ? 48 : 30
  const camZ = isMobile ? 16 : 14

  useFrame(() => {
    const camera = cameraRef.current
    if (!camera) return
    if (snapCameraRef.current) {
      camera.position.set(0, targetYRef.current, camZ)
      lookAtRef.current.set(0, targetYRef.current - 0.8, 0)
      camera.lookAt(lookAtRef.current)
      snapCameraRef.current = false
      return
    }
    camera.position.y += (targetYRef.current - camera.position.y) * 0.06
    camera.position.x += (0 - camera.position.x) * 0.06
    camera.position.z += (camZ - camera.position.z) * 0.06
    lookAtRef.current.y += ((targetYRef.current - 0.8) - lookAtRef.current.y) * 0.06
    camera.lookAt(lookAtRef.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0.5, camZ]} fov={fov} />
}
