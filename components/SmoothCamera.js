import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { OrthographicCamera } from "@react-three/drei/native";
import { useFrame, useThree } from "@react-three/fiber/native";

const SmoothCamera = forwardRef(({ initialZoom = 150 }, ref) => {
  const { camera } = useThree();
  const targetZoom = useRef(initialZoom);

  // Expose les méthodes de zoom
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      targetZoom.current = Math.min(targetZoom.current + 20, 300);
    },
    zoomOut: () => {
      targetZoom.current = Math.max(targetZoom.current - 20, 50);
    },
    resetZoom: () => {
      targetZoom.current = initialZoom;
    },
  }));

  // Animation smooth vers targetZoom
  useFrame(() => {
    camera.zoom += (targetZoom.current - camera.zoom) * 0.1;
    camera.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      makeDefault
      position={[0, 0, 3]}
      zoom={initialZoom}
      near={0.1}
      far={200}
    />
  );
});

export default SmoothCamera;
