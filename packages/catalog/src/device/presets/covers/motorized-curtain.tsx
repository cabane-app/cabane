import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { coverPosition, Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";

/** Fabric reaches 5 cm short of each track end. */
const HALF = 0.95;
/** Width of a fully opened panel at its stack. A single panel stacks all the fabric on one side. */
const SPLIT_STACK = 0.24;
const SINGLE_STACK = 0.4;
/** Full open/close travel. Track motors run at a steady speed and ease only near the stop. */
const FULL_TRAVEL_SECONDS = 10;
const EASE_ZONE = 0.04;

type Layout = { anchor: number; dir: 1 | -1; length: number; stack: number; color: string };

function layoutFor(variant: string | undefined): Layout[] {
  // Stack side as seen from the room, facing the window (the model's front is +Z).
  if (variant === "stack-left")
    return [{ anchor: -HALF, dir: 1, length: 2 * HALF, stack: SINGLE_STACK, color: "#d8c8ad" }];
  if (variant === "stack-right")
    return [{ anchor: HALF, dir: -1, length: 2 * HALF, stack: SINGLE_STACK, color: "#d8c8ad" }];
  return [
    { anchor: -HALF, dir: 1, length: 0.94, stack: SPLIT_STACK, color: "#d8c8ad" },
    { anchor: HALF, dir: -1, length: 0.94, stack: SPLIT_STACK, color: "#dfcfb6" },
  ];
}

/** A panel drawn closed from its stack edge; X scale gathers it, so the pleats bunch at the stack. */
function CurtainPanel({
  layout,
  pleats,
  color,
}: {
  layout: Layout;
  pleats: number;
  color?: string | undefined;
}) {
  const { dir, length } = layout;
  return (
    <>
      <mesh position={[(dir * length) / 2, 1.14, 0.125]} castShadow receiveShadow>
        <boxGeometry args={[length, 2.28, 0.064]} />
        <ToonMaterial color={color ?? layout.color} />
        <Outlines color="#81745f" thickness={0.004} />
      </mesh>
      {Array.from({ length: pleats }, (_, index) => (
        <mesh key={index} position={[(dir * (index + 1) * length) / (pleats + 1), 1.14, 0.158]}>
          <boxGeometry args={[0.012, 2.22, 0.004]} />
          <ToonMaterial color={color ?? "#b6a78f"} />
        </mesh>
      ))}
    </>
  );
}

function gatherPanels(groups: Array<Group | null>, layouts: Layout[], openness: number) {
  layouts.forEach(({ length, stack }, index) => {
    const group = groups[index];
    if (group) group.scale.x = 1 - openness * (1 - stack / length);
  });
}

export function MotorizedCurtainModel({
  state,
  visualState,
  color,
  variant,
  reducedMotion,
}: HomeDeviceModelProps) {
  const reported =
    visualState === "disconnected" || visualState === "unavailable" ? null : coverPosition(state);
  const panels = layoutFor(variant);
  const panelGroups = useRef<Array<Group | null>>([]);
  const current = useRef((reported ?? 35) / 100);
  const target = useRef(current.current);
  const invalidate = useThree((three) => three.invalidate);
  const layouts = useRef(panels);
  layouts.current = panels;
  useLayoutEffect(() => {
    // Keep the last known position while the cover is moving without a reported position.
    if (reported !== null) target.current = reported / 100;
    if (reducedMotion) current.current = target.current;
    gatherPanels(panelGroups.current, layouts.current, current.current);
    invalidate();
  }, [reported, reducedMotion, variant, invalidate]);
  useFrame((_, delta) => {
    const difference = target.current - current.current;
    if (difference === 0) return;
    const speed = Math.min(1, Math.max(0.15, Math.abs(difference) / EASE_ZONE));
    const step = (speed * Math.min(delta, 0.1)) / FULL_TRAVEL_SECONDS;
    current.current =
      Math.abs(difference) <= step + 0.0005
        ? target.current
        : current.current + Math.sign(difference) * step;
    gatherPanels(panelGroups.current, layouts.current, current.current);
    invalidate();
  });
  const motorX = variant === "stack-left" ? -0.91 : 0.91;
  const pleats = panels.length === 1 ? 4 : 2;
  return (
    <group name="catalog-motorized-curtain">
      <mesh position={[0, 2.36, 0.1]} castShadow>
        <boxGeometry args={[2, 0.08, 0.112]} />
        <ToonMaterial color="#dedbd3" />
        <Outlines color="#666c68" thickness={0.004} />
      </mesh>
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, 2.36, 0.02]}>
          <boxGeometry args={[0.08, 0.08, 0.04]} />
          <ToonMaterial color="#aeb4af" />
        </mesh>
      ))}
      {panels.map((layout, index) => (
        <group
          key={layout.anchor}
          name="motorized-curtain-panel"
          position={[layout.anchor, 0, 0]}
          ref={(group) => {
            panelGroups.current[index] = group;
          }}
        >
          <CurtainPanel layout={layout} pleats={pleats} color={color} />
        </group>
      ))}
      <mesh position={[motorX, 2.29, 0.123]}>
        <boxGeometry args={[0.12, 0.14, 0.074]} />
        <ToonMaterial color="#707873" />
      </mesh>
      <StatusBeacon visualState={visualState} position={[motorX, 2.3, 0.153]} scale={0.28} />
    </group>
  );
}
