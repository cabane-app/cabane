import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { deriveFloorLevels } from "../../building/floor-levels";
import { worldBoundsForFloorScene } from "../../pools/pool-footprint";
import type { HomeManifest } from "../../types";
import { usePreviewPlayback } from "./usePreviewPlayback";

export function WelcomeOrbitCamera({
  manifest,
  playing,
  onPause,
  advance,
}: {
  manifest: HomeManifest;
  playing: boolean;
  onPause: () => void;
  advance: (seconds: number) => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  usePreviewPlayback(playing, (seconds) => {
    advance(seconds);
    const orbit = controls.current;
    if (orbit) orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() - seconds * 0.145);
  });
  const { width, height } = useThree((state) => state.size);
  const frame = useMemo(() => {
    const floors = manifest.floors.filter((floor) => !floor.belowGround);
    const bounds = (floors.length ? floors : manifest.floors).map(worldBoundsForFloorScene);
    const minX = Math.min(...bounds.map((floor) => floor.minX));
    const maxX = Math.max(...bounds.map((floor) => floor.maxX));
    const minZ = Math.min(...bounds.map((floor) => floor.minZ));
    const maxZ = Math.max(...bounds.map((floor) => floor.maxZ));
    const top = deriveFloorLevels(manifest.floors).at(-1)?.elevationMeters ?? 0;
    const x = (minX + maxX) / 2;
    const z = (minZ + maxZ) / 2;
    const y = (top + 1.9) * 0.19;
    const span = Math.max(3, Math.hypot(maxX - minX, maxZ - minZ));
    return {
      position: [x + span * 0.52, y + span * 0.58, z + span * 0.85] as [number, number, number],
      target: [x, y, z] as [number, number, number],
      span,
      height: span * 0.69 + (top + 1.9) * 0.78,
    };
  }, [manifest.floors]);
  const zoom = Math.max(1, Math.min(width / (frame.span * 1.04), height / frame.height));
  return (
    <>
      <OrthographicCamera makeDefault position={frame.position} zoom={zoom} near={0.1} far={1000} />
      <OrbitControls
        target={frame.target}
        ref={controls}
        enableDamping={false}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.55}
        maxPolarAngle={1.25}
        onStart={onPause}
      />
    </>
  );
}
