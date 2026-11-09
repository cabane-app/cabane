import type { ElevationSettings, Polygon } from "@cabane/engine";

export function areaElevation(
  id: string,
  polygon: Polygon,
  value?: ElevationSettings,
): ElevationSettings {
  return (
    value ?? {
      offsetMeters: 0,
      edges: polygon.map((_, i) => ({ id: `${id}:elevation-edge-${i + 1}` })),
    }
  );
}
export function withEdgeTransition(
  value: ElevationSettings,
  index: number | null,
  transition: ElevationSettings["edges"][number]["transition"],
): ElevationSettings {
  return {
    ...value,
    edges: value.edges.map((edge, i) =>
      index === null || index === i ? { id: edge.id, ...(transition ? { transition } : {}) } : edge,
    ),
  };
}
