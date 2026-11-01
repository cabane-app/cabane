import { Euler, Matrix4, Vector3 } from "three";
import {
  modelLightSources,
  type CustomModelNormalization,
  type CustomModelLight,
  type CustomModelLightSource,
  type DeviceModelBounds,
  type ModelVector,
} from "@cabane/engine";

export type LightingSelection = { index: number; end?: boolean };
export const sourcePosition = (source: CustomModelLightSource, end = false): ModelVector =>
  source.kind === "point" ? source.position : end ? source.end : source.start;

export const sourceLabel = (sources: readonly CustomModelLightSource[], index: number) =>
  (sources[index].kind === "point" ? "Point " : "Strip ") +
  sources.slice(0, index + 1).filter((source) => source.kind === sources[index].kind).length;

export function withLightSources(
  light: CustomModelLight,
  sources: readonly CustomModelLightSource[],
): CustomModelLight {
  const { points: _points, strip: _strip, ...rest } = light;
  return { ...rest, position: sources[0] ? sourcePosition(sources[0]) : light.position, sources };
}

export function moveLightSource(
  light: CustomModelLight,
  selection: LightingSelection,
  position: ModelVector,
): CustomModelLight {
  return withLightSources(
    light,
    modelLightSources(light).map((source, index) => {
      if (index !== selection.index) return source;
      return source.kind === "point"
        ? { ...source, position }
        : { ...source, [selection.end ? "end" : "start"]: position };
    }),
  );
}

export const stripSamples = (start: ModelVector, end: ModelVector) =>
  Math.max(2, Math.ceil(Math.hypot(...start.map((n, i) => n - end[i])) / 0.6) + 1);

export function fittedLightStrip(
  bounds: DeviceModelBounds,
): CustomModelLightSource & { kind: "strip" } {
  const lengths = bounds.max.map((n, i) => n - bounds.min[i]);
  const axis = lengths.indexOf(Math.max(...lengths));
  const start = bounds.min.map((n, i) =>
    i === axis ? n + lengths[i] * 0.05 : (n + bounds.max[i]) / 2,
  ) as [number, number, number];
  const end = start.map((n, i) => (i === axis ? bounds.max[i] - lengths[i] * 0.05 : n)) as [
    number,
    number,
    number,
  ];
  return { kind: "strip", start, end, samples: stripSamples(start, end) };
}

export function lightingError(light: CustomModelLight | null): string | null {
  if (!light) return null;
  const sources = modelLightSources(light);
  if (
    !sources.every((source) =>
      (source.kind === "point" ? [source.position] : [source.start, source.end]).every((point) =>
        point.every(Number.isFinite),
      ),
    )
  )
    return "Enter finite coordinates for every light source.";
  if (![light.maxIntensity, light.distance].every((n) => Number.isFinite(n) && n >= 0))
    return "Brightness and range must be zero or greater.";
  for (const source of sources) {
    if (source.kind !== "strip") continue;
    if (!Number.isSafeInteger(source.samples) || source.samples < 2)
      return "Enter a whole number of at least two samples for each strip.";
    if (source.end.every((n, i) => n === source.start[i]))
      return "Place each strip end away from its start.";
  }
  return null;
}

export function renormalizeLighting(
  light: CustomModelLight,
  previous: CustomModelNormalization,
  next: CustomModelNormalization,
): CustomModelLight {
  const matrix = (normalization: CustomModelNormalization) =>
    new Matrix4()
      .makeTranslation(...normalization.offset)
      .multiply(new Matrix4().makeRotationFromEuler(new Euler(...normalization.rotation)))
      .multiply(
        new Matrix4().makeScale(normalization.scale, normalization.scale, normalization.scale),
      );
  const delta = matrix(next).multiply(matrix(previous).invert());
  const transform = (point: ModelVector) =>
    new Vector3(...point).applyMatrix4(delta).toArray() as [number, number, number];
  return {
    ...light,
    position: transform(light.position),
    distance: (light.distance * next.scale) / previous.scale,
    ...(light.points ? { points: light.points.map(transform) } : {}),
    ...(light.strip ? { strip: { ...light.strip, end: transform(light.strip.end) } } : {}),
    ...(light.sources
      ? {
          sources: light.sources.map((source) =>
            source.kind === "point"
              ? { ...source, position: transform(source.position) }
              : { ...source, start: transform(source.start), end: transform(source.end) },
          ),
        }
      : {}),
  };
}
