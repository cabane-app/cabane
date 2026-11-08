import { CatmullRomCurve3, Vector3 } from "three";
import type { TerrainSurface } from "../../terrain/terrain-surface";
import { GROUND_ELEVATION_METERS } from "../../ground-elevation";

export type LandscapePoint = [number, number];
const curve = (points: LandscapePoint[], samples = 160): LandscapePoint[] =>
  new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)))
    .getPoints(samples)
    .map(({ x, z }) => [x, z]);

/** Keep the authored architecture clear, while reclaiming the empty lawn margin. */
export function countrysideLayout(
  plotWidth: number,
  plotDepth: number,
  terrain: TerrainSurface,
  centerX: number,
  centerZ: number,
) {
  const halfX = Math.max(1, plotWidth / 2 - 2.08),
    halfZ = Math.max(1, plotDepth / 2 - 2.08);
  const half = Math.max(halfX, halfZ),
    width = 9;
  const pond: LandscapePoint = [halfX + 6.2, -halfZ * 0.72];
  const pondAngle = Math.atan2(pond[1], pond[0]);
  function radii(angle: number) {
    const c = Math.abs(Math.cos(angle)),
      s = Math.abs(Math.sin(angle));
    const inner = 1 / Math.max(c / halfX, s / halfZ);
    const rounded =
      1 / Math.pow((c / (halfX + width)) ** 5 + (s / (halfZ + width)) ** 5, 0.2) +
      0.5 * Math.sin(angle * 7 + 1) +
      0.25 * Math.cos(angle * 13) +
      2 *
        Math.exp(
          -Math.pow(Math.atan2(Math.sin(angle - pondAngle), Math.cos(angle - pondAngle)) / 0.55, 2),
        );
    return [inner, Math.max(inner + 5, rounded)];
  }
  function point(angle: number, t: number): LandscapePoint {
    const [inner, outer] = radii(angle),
      radius = inner + (outer - inner) * t;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }
  const pondRadii: LandscapePoint = [3.2, 3.9];
  const pondDistance = (x: number, z: number) =>
    Math.hypot((x - pond[0]) / pondRadii[0], (z - pond[1]) / pondRadii[1]);
  function fraction(x: number, z: number) {
    const [inner, outer] = radii(Math.atan2(z, x));
    return (Math.hypot(x, z) - inner) / (outer - inner);
  }
  function height(x: number, z: number) {
    const t = Math.max(0, Math.min(1, fraction(x, z)));
    const grade = terrain?.offsetAt(centerX + x, centerZ + z) ?? 0;
    const rolling =
      Math.sin((t * Math.PI) / 2) * (0.32 + 0.32 * (Math.sin(x * 0.43) * Math.cos(z * 0.32) + 1));
    const bank = Math.max(0, Math.min(1, (pondDistance(x, z) - 0.88) / 0.35));
    const blend = bank * bank * (3 - 2 * bank);
    return GROUND_ELEVATION_METERS + 0.003 + grade + rolling * blend - (1 - blend) * 0.22;
  }
  const contain = ([x, z]: LandscapePoint): LandscapePoint => {
    const t = fraction(x, z);
    return point(Math.atan2(z, x), Math.max(0.1, Math.min(0.88, t)));
  };
  const trail = curve([
    [-halfX * 0.75, halfZ + 1.7],
    [0, halfZ + 3.0],
    [halfX + 2.8, halfZ + 2.5],
    [halfX + 5.6, halfZ * 0.6],
    [halfX + 2.7, halfZ * 0.22],
    [halfX + 5.1, -halfZ * 0.12],
    [halfX + 2.2, -halfZ * 0.43],
    [halfX + 1.8, -halfZ * 0.66],
    [halfX + 3.2, -halfZ - 3.7],
    [halfX * 0.3, -halfZ - 4.0],
  ]).map((p): LandscapePoint => {
    const [initialX, z] = contain(p);
    let x = initialX;
    const dz = Math.abs(z - pond[1]) / (pondRadii[1] + 0.7);
    if (dz < 1 && pondDistance(x, z) < 1.2)
      x = Math.min(x, pond[0] - (pondRadii[0] + 0.75) * Math.sqrt(1 - dz * dz));
    return contain([x, z]);
  });
  const walls = [
    curve([
      [-halfX - 2.8, halfZ + 2.4],
      [-halfX - 2.1, halfZ * 0.35],
      [-halfX - 3.5, -halfZ * 0.25],
      [-halfX - 2.6, -halfZ - 3.5],
    ]),
    curve([
      [-halfX - 1.9, halfZ + 5.2],
      [0, halfZ + 5.8],
      [halfX + 3.3, halfZ + 5.1],
      [halfX + 5.1, halfZ * 0.5 + 1.2],
    ]),
    curve([
      [halfX + 5.2, halfZ * 0.5 - 1.2],
      [halfX + 6.3, halfZ * 0.2],
      [halfX + 7.4, -halfZ * 0.15],
    ]),
  ].map((line) => line.map(contain));
  function pathDistance(x: number, z: number) {
    let distance = Infinity;
    for (let i = 1; i < trail.length; i++) {
      const [ax, az] = trail[i - 1],
        [bx, bz] = trail[i];
      const dx = bx - ax,
        dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return distance;
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
    pondRadii,
    pondDistance,
    trail,
    walls,
    pathDistance,
  };
}
export type CountrysideLayout = ReturnType<typeof countrysideLayout>;
