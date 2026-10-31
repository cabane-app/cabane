/** Corner heights relative to the ground floor, following the unrotated 2D plan. */
export interface TerrainSettings {
  topLeftMeters: number;
  topRightMeters: number;
  bottomLeftMeters: number;
  bottomRightMeters: number;
}

export const FLAT_TERRAIN: TerrainSettings = {
  topLeftMeters: 0,
  topRightMeters: 0,
  bottomLeftMeters: 0,
  bottomRightMeters: 0,
};

export const hasCustomTerrain = (settings: TerrainSettings | undefined): boolean =>
  settings !== undefined && Object.values(settings).some((height) => height !== 0);

export function isTerrainSettings(value: unknown): value is TerrainSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length === 4 &&
    entries.every(
      ([key, height]) =>
        Object.hasOwn(FLAT_TERRAIN, key) &&
        typeof height === "number" &&
        Number.isFinite(height) &&
        Math.abs(height) <= 100,
    )
  );
}
