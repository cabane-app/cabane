import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import type { ModelVector } from "@cabane/engine";

export type LightingView = "3D" | "Top" | "Front" | "Side" | "Fit" | "Focus";
export function LightingCamera({
  span,
  request,
  focus,
}: {
  span: number;
  request: { view: LightingView; key: number };
  focus: ModelVector;
}) {
  const controls = useRef<MapControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  // Source edits must not move the camera; only an explicit view request does.
  const focusRef = useRef(focus);
  focusRef.current = focus;
  useLayoutEffect(() => {
    if (!controls.current || !(camera instanceof PerspectiveCamera)) return;
    const target = request.view === "Focus" ? new Vector3(...focusRef.current) : new Vector3();
    const directions: Partial<Record<LightingView, [number, number, number]>> = {
      "3D": [1, 0.75, 1.2],
      Top: [0, 1, 0.0001],
      Front: [0, 0, 1],
      Side: [1, 0, 0],
    };
    const direction = directions[request.view]
      ? new Vector3(...directions[request.view]!)
      : camera.position.clone().sub(controls.current.target);
    const fov = (camera.fov * Math.PI) / 180;
    const distance = (span * 0.9) / Math.sin(fov / 2) / Math.min(1, size.width / size.height);
    camera.position
      .copy(target)
      .add(
        direction.normalize().multiplyScalar(request.view === "Focus" ? distance * 0.25 : distance),
      );
    camera.up.set(0, 1, 0);
    controls.current.target.copy(target);
    controls.current.update();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, request, span, size.width, size.height]);
  return (
    <MapControls
      ref={controls}
      makeDefault
      enablePan
      enableRotate
      enableZoom
      zoomToCursor
      screenSpacePanning
      minDistance={span / 1000}
      maxDistance={span * 100}
    />
  );
}
