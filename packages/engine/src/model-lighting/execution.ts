import { Color } from "three";
import type {
  CustomModelLight,
  CustomModelLightSource,
  ModelVector,
} from "../imported-models/contracts";

/** Measured shader/resource budget, shared by previews and each mounted floor. */
export const SCENE_LIGHT_BUDGET = 64;

/** Compact emission: intensity belongs to the whole strip, not each requested sample. */
export interface SceneLightEmission {
  name: string;
  position: ModelVector;
  strip?: { end: ModelVector; samples: number };
  color: string;
  intensity: number;
  distance: number;
  /** Engine-owned native/dashboard sources prewarm spare slots before first activation. */
  prewarm?: boolean;
}

export type ExecutedSceneLight = Pick<
  SceneLightEmission,
  "name" | "position" | "color" | "intensity" | "distance"
>;

/** Read old declarations without rewriting portable source intent. */
export function modelLightSources(light: CustomModelLight): readonly CustomModelLightSource[] {
  return (
    light.sources ??
    (light.strip
      ? [{ kind: "strip", start: light.position, ...light.strip }]
      : [light.position, ...(light.points ?? [])].map((position) => ({ kind: "point", position })))
  );
}

export function modelLightEmissions(light: CustomModelLight, name = "model"): SceneLightEmission[] {
  if (light.illuminate === false || !(light.maxIntensity > 0)) return [];
  const sources = modelLightSources(light);
  return sources.map((source, index) => ({
    name: name + (index ? "-" + index : ""),
    position: source.kind === "point" ? source.position : source.start,
    ...(source.kind === "strip" ? { strip: { end: source.end, samples: source.samples } } : {}),
    color: light.color,
    intensity: light.maxIntensity / sources.length,
    distance: light.distance,
  }));
}

// Invalid in-progress numeric input must also remain allocation-safe in import previews.
const requestedSamples = (source: SceneLightEmission) =>
  source.strip
    ? Number.isSafeInteger(source.strip.samples) && source.strip.samples >= 2
      ? source.strip.samples
      : 2
    : 1;

const midpoint = (source: SceneLightEmission): ModelVector =>
  source.strip
    ? (source.position.map((n, axis) => n / 2 + source.strip!.end[axis] / 2) as [
        number,
        number,
        number,
      ])
    : source.position;

function spatialGroup(sources: readonly SceneLightEmission[]) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const source of sources) {
    const position = midpoint(source);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }
  const spans = max.map((n, axis) => n - min[axis]);
  const span = Math.max(...spans);
  return { sources, axis: spans.indexOf(span), span };
}

/** Median spatial partitions keep every logical source's contribution, including distant copies. */
function mergeEmissions(
  sources: readonly SceneLightEmission[],
  budget: number,
): ExecutedSceneLight[] {
  const groups = [spatialGroup(sources)];
  while (groups.length < budget) {
    let split = -1;
    for (let i = 0; i < groups.length; i++)
      if (groups[i].sources.length > 1 && (split < 0 || groups[i].span > groups[split].span))
        split = i;
    if (split < 0) break;
    const { sources, axis } = groups[split];
    const sorted = [...sources].sort((a, b) => midpoint(a)[axis] - midpoint(b)[axis]);
    const half = Math.floor(sorted.length / 2);
    groups.splice(split, 1, spatialGroup(sorted.slice(0, half)), spatialGroup(sorted.slice(half)));
  }
  return groups.map((group, index) => {
    let intensity = 0,
      distance = 0;
    const position = [0, 0, 0];
    const color = new Color(0, 0, 0);
    for (const source of group.sources) {
      const next = intensity + source.intensity;
      const weight = source.intensity / next;
      const point = midpoint(source);
      for (let axis = 0; axis < 3; axis++)
        position[axis] += (point[axis] - position[axis]) * weight;
      color.lerp(new Color(source.color), weight);
      intensity = next;
      // A zero distance is Three.js's unbounded range, not the smallest range.
      distance =
        source.distance === 0 || distance === Infinity
          ? Infinity
          : Math.max(distance, source.distance);
    }
    return {
      name: `lighting-cluster-${index}`,
      position: position as [number, number, number],
      color: `#${color.getHexString()}`,
      intensity,
      distance: distance === Infinity ? 0 : distance,
    };
  });
}

function expandEmissions(
  sources: readonly SceneLightEmission[],
  budget: number,
): ExecutedSceneLight[] {
  if (budget === 0 || sources.length === 0) return [];
  if (sources.length > budget) return mergeEmissions(sources, budget);
  // Give every logical source a slot, then fairly share spare strip samples.
  const counts = sources.map(() => 1);
  let remaining = budget - sources.length;
  while (remaining > 0) {
    let added = false;
    for (let i = 0; i < sources.length && remaining > 0; i++) {
      if (counts[i] >= requestedSamples(sources[i])) continue;
      counts[i]++;
      remaining--;
      added = true;
    }
    if (!added) break;
  }
  return sources.flatMap((source, sourceIndex) => {
    const count = counts[sourceIndex];
    return Array.from({ length: count }, (_, index) => ({
      name: source.name + (index ? `-sample-${index}` : ""),
      position: source.strip
        ? (source.position.map((n, axis) => {
            const t = count === 1 ? 0.5 : index / (count - 1);
            return n * (1 - t) + source.strip!.end[axis] * t;
          }) as [number, number, number])
        : source.position,
      color: source.color,
      intensity: source.intensity / count,
      distance: source.distance,
    }));
  });
}

/**
 * The sole expansion policy. Work follows authored declarations plus at most 64
 * physical emitters, never a requested sample count. No saved source is truncated.
 */
export function planSceneLights(input: readonly SceneLightEmission[]) {
  const sources = input.filter(
    (source) => Number.isFinite(source.intensity) && source.intensity > 0,
  );
  const requested = sources.reduce(
    (sum, source) => Math.min(Number.MAX_SAFE_INTEGER, sum + requestedSamples(source)),
    0,
  );
  const lights = expandEmissions(sources, SCENE_LIGHT_BUDGET);
  const approximated = requested > lights.length;
  // Native first-use interaction already promises uniform-only state changes.
  // Off declarations borrow only spare capacity; they never crowd out active sources.
  if (lights.length < SCENE_LIGHT_BUDGET) {
    const prewarm = input
      .filter((source) => source.prewarm && source.intensity === 0)
      .map((source) => ({ ...source, intensity: 1 }));
    lights.push(
      ...expandEmissions(prewarm, SCENE_LIGHT_BUDGET - lights.length).map((source) => ({
        ...source,
        intensity: 0,
      })),
    );
  }
  return { lights, requested, approximated };
}

export const modelLightingExecution = (light: CustomModelLight) =>
  planSceneLights(modelLightEmissions(light));
