import { useMemo, useState } from "react";
import {
  planSceneLights,
  type SceneLightEmission,
  type ExecutedSceneLight,
} from "./model-lighting/execution";

/** Native shadow maps block finite walls, openings and furniture in every direction. */
function PhysicalSceneLight({
  name,
  position,
  color,
  intensity,
  distance,
}: {
  name: string;
  position: readonly [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}) {
  return (
    <pointLight
      name={name}
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      decay={2}
      userData={{ cabaneSceneLight: true }}
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
  sources,
  stationary = false,
}: {
  sources: readonly SceneLightSource[];
  stationary?: boolean;
}) {
  const [slots, setSlots] = useState<readonly ExecutedSceneLight[]>([]);
  const execution = useMemo(() => planSceneLights(sources, stationary), [sources, stationary]);
  if (stationary)
    return execution.lights.map((source) => <PhysicalSceneLight key={source.name} {...source} />);
  const current = assignLightSlots(slots, execution.lights);
  if (current !== slots) setSlots(current);
  return current.map((source, index) => <PhysicalSceneLight key={index} {...source} />);
}
