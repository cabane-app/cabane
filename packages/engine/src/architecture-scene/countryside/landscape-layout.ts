import type { TerrainSurface } from "../../terrain/terrain-surface";
import { GROUND_ELEVATION_METERS } from "../../ground-elevation";

/** The authored plot is a strict exclusion zone, including its pools and platforms. */
export function countrysideLayout(
  plotWidth: number,
  plotDepth: number,
  terrain: TerrainSurface,
  centerX: number,
  centerZ: number,
) {
  const halfX = plotWidth / 2 - 0.08,
    halfZ = plotDepth / 2 - 0.08;
  const half = Math.max(halfX, halfZ);
  const width = 6;
  function radii(angle: number) {
    const c = Math.abs(Math.cos(angle)),
      s = Math.abs(Math.sin(angle));
    const inner = 1 / Math.max(c / halfX, s / halfZ);
    const rounded =
      1 / Math.pow((c / (halfX + width)) ** 5 + (s / (halfZ + width)) ** 5, 0.2) +
      0.22 * Math.sin(angle * 11) +
      0.13 * Math.cos(angle * 17);
    return [inner, Math.max(inner + 3.5, rounded)];
  }
  function point(angle: number, t: number): [number, number] {
    const [inner, outer] = radii(angle),
      radius = inner + (outer - inner) * t;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }
  const pond = point(-0.15, 0.74);
  const pondDistance = (x: number, z: number) =>
    Math.hypot((x - pond[0]) / 1.35, (z - pond[1]) / 2.0);
  function fraction(x: number, z: number) {
    const [inner, outer] = radii(Math.atan2(z, x));
    return (Math.hypot(x, z) - inner) / (outer - inner);
  }
  function height(x: number, z: number) {
    const t = Math.max(0, Math.min(1, fraction(x, z)));
    const grade = terrain?.offsetAt(centerX + x, centerZ + z) ?? 0;
    const rolling =
      Math.sin(t * Math.PI * 0.5) * (0.18 + 0.23 * (Math.sin(x * 0.55) * Math.cos(z * 0.43) + 1));
    const bank = Math.max(0, Math.min(1, (pondDistance(x, z) - 0.9) / 0.32));
    const blend = bank * bank * (3 - 2 * bank);
    return GROUND_ELEVATION_METERS + 0.003 + grade + rolling * blend - (1 - blend) * 0.16;
  }
  function pathFraction(angle: number) {
    const [inner, outer] = radii(angle);
    const radius =
      1 /
      Math.pow(
        (Math.abs(Math.cos(angle)) / (halfX + width * 0.45)) ** 6 +
          (Math.abs(Math.sin(angle)) / (halfZ + width * 0.45)) ** 6,
        1 / 6,
      );
    return Math.max(
      0.18,
      Math.min(0.58, (radius - inner) / (outer - inner) + Math.sin(angle * 5 + 1) * 0.045),
    );
  }
  return {
    half,
    halfX,
    halfZ,
    width,
    point,
    height,
    fraction,
    radii,
    pond,
    pondDistance,
    pathFraction,
  };
}
export type CountrysideLayout = ReturnType<typeof countrysideLayout>;
