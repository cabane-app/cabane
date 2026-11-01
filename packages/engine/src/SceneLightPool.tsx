import { physicalFloor } from "./architecture-geometry/physical-floor";
import { useMemo, useState } from "react";
import { findContainingRoom, planPointToWorld, worldPointToPlan } from "./geometry";
import type { FloorSpec } from "./types";
import type { SceneLightWallPlane } from "./scene-light-wall-mask";
import {
  planSceneLights,
  type SceneLightEmission,
  type ExecutedSceneLight,
} from "./model-lighting/execution";

// Restrict receivers behind the wall, never the hemisphere behind the bulb.
const lightWallPlane = (
  floor: FloorSpec,
  position: readonly [number, number, number],
  distance: number,
): SceneLightWallPlane | null => {
  const point = worldPointToPlan({ x: position[0], z: position[2] }, floor.coordinates);
  if (!findContainingRoom(point, floor.rooms)) return null;
  const threshold = Math.min(0.6, distance * 0.25);
  let nearest: SceneLightWallPlane | null = null;
  let nearestDistance = threshold;
  for (const wall of physicalFloor(floor).walls) {
    if (position[1] > (wall.heightMeters ?? floor.defaultWallHeightMeters)) continue;
    const [startX, startZ] = planPointToWorld(wall.from, floor.coordinates);
    const [endX, endZ] = planPointToWorld(wall.to, floor.coordinates);
    const dx = endX - startX;
    const dz = endZ - startZ;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared === 0) continue;
    const fraction = Math.max(
      0,
      Math.min(1, ((position[0] - startX) * dx + (position[2] - startZ) * dz) / lengthSquared),
    );
    const awayX = position[0] - (startX + fraction * dx);
    const awayZ = position[2] - (startZ + fraction * dz);
    const separation = Math.hypot(awayX, awayZ);
    if (separation < 0.01 || separation >= nearestDistance) continue;
    const wallPlanLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    const throughOpening = floor.openings.some(
      (opening) =>
        opening.wallId === wall.id &&
        fraction * wallPlanLength >= opening.offsetFromWallStartPlanUnits &&
        fraction * wallPlanLength <=
          opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits &&
        position[1] >= opening.sillHeightMeters &&
        position[1] <= opening.sillHeightMeters + opening.openingHeightMeters,
    );
    if (throughOpening) continue;
    nearestDistance = separation;
    const nx = awayX / separation,
      nz = awayZ / separation;
    const innerX = startX + fraction * dx + (nx * wall.thicknessMeters) / 2;
    const innerZ = startZ + fraction * dz + (nz * wall.thicknessMeters) / 2;
    nearest = [nx, 0, nz, -(nx * innerX + nz * innerZ)];
  }
  return nearest;
};

export function PhysicalSceneLight({
  floor,
  name,
  position,
  color,
  intensity,
  distance,
}: {
  floor: FloorSpec;
  name: string;
  position: readonly [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}) {
  const [x, y, z] = position;
  const plane = useMemo(
    () => lightWallPlane(floor, [x, y, z], distance),
    [floor, x, y, z, distance],
  );
  return (
    <pointLight
      name={name}
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      decay={2}
      castShadow={false}
      userData={{ cabaneLightWallPlane: plane }}
    />
  );
}

export type SceneLightSource = SceneLightEmission;

/** Keep active sources in their existing slots before borrowing slots from off lights. */
function assignLightSlots(
  previous: readonly ExecutedSceneLight[],
  sources: readonly ExecutedSceneLight[],
) {
  const byName = new Map(previous.map((source, index) => [source.name, index]));
  const next = previous.map((source) =>
    source.intensity === 0 ? source : { ...source, intensity: 0 },
  );
  const used = new Set<number>();
  const waiting: ExecutedSceneLight[] = [];
  for (const source of sources) {
    const slot = byName.get(source.name);
    if (slot === undefined) waiting.push(source);
    else {
      next[slot] = source;
      used.add(slot);
    }
  }
  let available = 0;
  for (const source of waiting) {
    while (used.has(available)) available++;
    next[available] = source;
    used.add(available++);
  }
  return next.length === previous.length &&
    next.every((source, index) => source === previous[index])
    ? previous
    : next;
}

/** Retain shader slots through toggles, within the shared execution budget. */
export function ActiveSceneLightPool({
  floor,
  sources,
}: {
  floor: FloorSpec;
  sources: readonly SceneLightSource[];
}) {
  const [slots, setSlots] = useState<readonly ExecutedSceneLight[]>([]);
  const execution = useMemo(() => planSceneLights(sources), [sources]);
  const current = assignLightSlots(slots, execution.lights);
  if (current !== slots) setSlots(current);
  return current.map((source, index) => (
    <PhysicalSceneLight key={index} floor={floor} {...source} />
  ));
}
