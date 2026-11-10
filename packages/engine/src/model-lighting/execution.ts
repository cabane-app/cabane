import { Color } from "three";
import type {
  CustomModelLight,
  CustomModelLightSource,
  ModelVector,
} from "../imported-models/contracts";

/** Shared shader and atlas budget for each floor and preview. */
export const SCENE_LIGHT_BUDGET = 64;

/** Default physical spacing used by the lighting editor and adaptive catalog strips. */
export const DEFAULT_STRIP_MAX_SPACING_METERS = 0.6;

/** Compact emission: intensity belongs to the whole strip, not each requested sample. */
export interface SceneLightEmission {
  name: string;
  position: ModelVector;
  strip?: { end: ModelVector; samples: number; maxSpacingMeters?: number };
  color: string;
  intensity: number;
  distance: number;
}

type ModelScale = readonly [number, number, number];

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

const scaleModelVector = (point: ModelVector, scale: ModelScale | undefined): ModelVector =>
  scale
    ? (point.map((coordinate, axis) => coordinate * scale[axis]) as [number, number, number])
    : point;

export function modelLightEmissions(
  light: CustomModelLight,
  name = "model",
  scale?: ModelScale,
): SceneLightEmission[] {
  if (light.illuminate === false || !(light.maxIntensity > 0)) return [];
  const sources = modelLightSources(light);
  return sources.map((source, index) => ({
    name: name + (index ? "-" + index : ""),
    position: scaleModelVector(source.kind === "point" ? source.position : source.start, scale),
    ...(source.kind === "strip"
      ? {
          strip: {
            end: scaleModelVector(source.end, scale),
            samples: source.samples,
            ...(source.maxSpacingMeters !== undefined
              ? { maxSpacingMeters: source.maxSpacingMeters }
              : {}),
          },
        }
      : {}),
    color: light.color,
    intensity: light.maxIntensity / sources.length,
    distance: light.distance,
  }));
}

// Invalid in-progress numeric input must also remain allocation-safe in import previews.
const requestedSamples = (source: SceneLightEmission) =>
  source.strip ? Math.max(2, explicitStripSamples(source), adaptiveStripSamples(source)) : 1;

const explicitStripSamples = (source: SceneLightEmission) =>
  source.strip && Number.isSafeInteger(source.strip.samples) && source.strip.samples >= 2
    ? source.strip.samples
    : 2;

const adaptiveStripSamples = (source: SceneLightEmission) => {
  const spacing = source.strip?.maxSpacingMeters;
  if (!source.strip || typeof spacing !== "number" || !Number.isFinite(spacing) || spacing <= 0)
    return 0;
  const length = Math.hypot(
    ...source.position.map((coordinate, axis) => coordinate - source.strip!.end[axis]),
  );
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(length / spacing) + 1);
};

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
    let anchor = group.sources[0];
    const color = new Color(0, 0, 0);
    for (const source of group.sources) {
      if (source.intensity > anchor.intensity) anchor = source;
      if (source.intensity === 0) continue;
      const next = intensity + source.intensity;
      color.lerp(new Color(source.color), source.intensity / next);
      intensity = next;
      distance =
        source.distance === 0 || distance === Infinity
          ? Infinity
          : Math.max(distance, source.distance);
    }
    return {
      name: `lighting-cluster-${index}`,
      // Use an actual source location so the cluster cannot create a light
      // inside an intervening wall or a third room.
      position: midpoint(anchor),
      color: intensity > 0 ? `#${color.getHexString()}` : anchor.color,
      intensity,
      distance: intensity === 0 ? anchor.distance : distance === Infinity ? 0 : distance,
    };
  });
}

function expandEmissions(
  sources: readonly SceneLightEmission[],
  budget: number,
): ExecutedSceneLight[] {
  if (!sources.length) return [];
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
 * Work follows authored declarations and the physical emitter budget, even
 * for very large requested strip sample counts.
 */
export function planSceneLights(input: readonly SceneLightEmission[], stationary = false) {
  const sources = input.filter(
    (source) =>
      Number.isFinite(source.intensity) &&
      (stationary ? source.intensity >= 0 : source.intensity > 0),
  );
  const requested = sources.reduce(
    (sum, source) => Math.min(Number.MAX_SAFE_INTEGER, sum + requestedSamples(source)),
    0,
  );
  const lights = expandEmissions(sources, SCENE_LIGHT_BUDGET);
  return { lights, requested, approximated: requested > lights.length };
}

export const modelLightingExecution = (light: CustomModelLight, scale?: ModelScale) =>
  planSceneLights(modelLightEmissions(light, "model", scale));
