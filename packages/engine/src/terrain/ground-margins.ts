/** Distances in world metres from the modeled site, along the unrotated plan axes. */
export interface GroundMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const GROUND_EDGES = ["left", "right", "top", "bottom"] as const;

export function isGroundMargins(value: unknown): value is GroundMargins {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const margins = value as Record<string, unknown>;
  return (
    Object.keys(margins).length === 4 &&
    GROUND_EDGES.every((edge) => {
      const distance = margins[edge];
      return typeof distance === "number" && Number.isFinite(distance) && distance >= 0;
    })
  );
}

/** Profile of the lawn and the supporting slab in world metres. */
export function groundEdgeProfile(width: number, depth: number, margins?: GroundMargins) {
  const clearance = margins
    ? Math.min(margins.left, margins.right, margins.top, margins.bottom)
    : Infinity;
  const inset = Math.min(0.05, clearance, width / 8, depth / 8);
  const radius = Math.min(0.42, clearance, width / 2, depth / 2);
  return { inset, radius, lawnRadius: Math.max(0, Math.min(0.36, radius - inset)) };
}
