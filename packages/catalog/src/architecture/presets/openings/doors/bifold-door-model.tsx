import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import {
  JoineryMaterial,
  openingWorldPlacement,
  resolveOpeningOrientation,
  type DoorSpec,
} from "@cabane/engine";
import type { OpeningModelProps } from "../opening-model-props";
import { DoorFrame } from "./door-frame";
import { DOOR_FRAME_EXTRA_DEPTH_METERS } from "./door-frame-dimensions";

/** Equal panels counter-rotate around their meeting hinge; the free tip stays on its guide. */
function FoldingPair({
  span,
  height,
  direction,
  side,
  color,
  finish,
  position,
  reducedMotion,
}: {
  span: number;
  height: number;
  direction: -1 | 1;
  side: -1 | 1;
  color: string;
  finish: "wood" | "white";
  position: number;
  reducedMotion: boolean;
}) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    invalidate();
  }, [invalidate, position, reducedMotion, direction, side]);
  useFrame((_, delta) => {
    if (!outer.current || !inner.current) return;
    const target = -direction * side * Math.PI * 0.48 * position;
    outer.current.rotation.y +=
      (target - outer.current.rotation.y) * (reducedMotion ? 1 : 1 - Math.exp(-9 * delta));
    inner.current.rotation.y = -2 * outer.current.rotation.y;
    if (Math.abs(target - outer.current.rotation.y) > 0.002) invalidate();
  });
  const half = span / 2;
  const panel = (index: number) => (
    <group position={[(direction * half) / 2, 0, (index === 0 ? -side : side) * 0.02]}>
      <mesh name={`bifold-panel-${index}`} castShadow receiveShadow>
        <boxGeometry args={[half - 0.006, height, 0.04]} />
        <JoineryMaterial color={color} finish={finish === "white" ? "paint" : "wood"} />
      </mesh>
      {index === 0 && (
        <mesh position={[direction * half * 0.3, 0, side * 0.037]}>
          <sphereGeometry args={[0.016, 12, 8]} />
          <JoineryMaterial color="#565551" finish="metal" />
        </mesh>
      )}
    </group>
  );
  return (
    <group ref={outer} name="bifold-outer-motion">
      {panel(0)}
      <group position={[direction * half, 0, -side * 0.04]}>
        <group ref={inner} name="bifold-inner-motion">
          {panel(1)}
        </group>
      </group>
    </group>
  );
}

export function BifoldDoorModel({
  wall,
  opening,
  floor,
  position,
  reducedMotion,
}: OpeningModelProps<DoorSpec>) {
  const placement = openingWorldPlacement(wall, opening, floor.coordinates);
  const orientation = resolveOpeningOrientation(opening);
  const count = opening.leafCount ?? 1;
  const inset = 0.04;
  const span = (placement.widthMeters - 2 * inset - (count === 2 ? 0.006 : 0)) / count;
  const depth = wall.thicknessMeters + DOOR_FRAME_EXTRA_DEPTH_METERS;
  const color = opening.color ?? (opening.finish === "white" ? "#f1f0eb" : "#b89a73");
  return (
    <group
      name="opening-model-bifold"
      position={[placement.start[0], opening.sillHeightMeters, placement.start[1]]}
      rotation={[0, placement.rotationY, 0]}
    >
      <DoorFrame
        width={placement.widthMeters}
        height={opening.openingHeightMeters}
        depth={depth}
        finish={opening.finish}
        color={color}
      />
      {orientation.leaves.map((leaf, index) => (
        <group
          key={index}
          position={[
            leaf.hingeAtEnd ? placement.widthMeters - inset : inset,
            opening.openingHeightMeters / 2,
            (orientation.sideSign * depth) / 2,
          ]}
        >
          <FoldingPair
            span={span}
            height={opening.openingHeightMeters - 0.04}
            direction={leaf.extentSign}
            side={orientation.sideSign}
            color={color}
            finish={opening.finish}
            position={position}
            reducedMotion={reducedMotion}
          />
        </group>
      ))}
    </group>
  );
}
