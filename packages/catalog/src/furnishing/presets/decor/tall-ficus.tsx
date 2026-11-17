import { HouseplantFoliage, type HouseplantGrowth } from "./houseplant-foliage";
import { HouseplantPot } from "./houseplant-pot";
import type { Point } from "../outdoor/vegetation/geometry";

const growth: HouseplantGrowth = {
  min: [-0.457, 0.29, -0.273],
  max: [0.444, 1.643, 0.23],
  bark: "#72543a",
  stems: [
    [[0, 0.29, 0], [-0.035, 0.86, 0.01], 0.036, 0.022],
    [[-0.035, 0.86, 0.01], [0.045, 1.25, -0.01], 0.024, 0.014],
    [[0.045, 1.25, -0.01], [0.005, 1.55, 0], 0.015, 0.006],
  ],
  bladeProfile: [0.025, 0.44, 0.77, 0.94, 1, 0.95, 0.83, 0.52, 0.035],
  leaves: [],
};
// Rubber-plant leaves spiral around each tip; older blades hang beneath the new flush.
for (const [i, [x, y, z]] of [
  [-0.24, 0.81, 0.1],
  [0.27, 0.95, -0.1],
  [-0.13, 1.06, -0.19],
  [0.16, 1.12, 0.17],
  [-0.28, 1.21, 0.11],
  [0.24, 1.33, -0.12],
  [-0.14, 1.4, -0.17],
  [0.13, 1.47, 0.14],
  [-0.1, 1.54, 0.11],
  [0.05, 1.62, -0.09],
].entries()) {
  const height = Math.max(0.63, y - 0.23);
  const t =
    height < 0.86
      ? (height - 0.29) / 0.57
      : height < 1.25
        ? (height - 0.86) / 0.39
        : (height - 1.25) / 0.3;
  const [a, b] = growth.stems[height < 0.86 ? 0 : height < 1.25 ? 1 : 2];
  const base: Point = [a[0] + (b[0] - a[0]) * t, height, a[2] + (b[2] - a[2]) * t];
  const end: Point = [x, y, z];
  growth.stems.push([base, end, 0.012, 0.006]);
  for (const [j, turn] of [-1.29, 1.12, -0.58, 0.45].entries()) {
    const t = 0.38 + j * 0.2;
    const start: Point = [
      base[0] + (x - base[0]) * t,
      base[1] + (y - base[1]) * t,
      base[2] + (z - base[2]) * t,
    ];
    const angle = Math.atan2(z, x) + turn + 0.16 * Math.sin(i * 2.3);
    const length = 0.25 + 0.045 * Math.sin(i + j);
    const petiole: Point = [
      start[0] + Math.cos(angle) * 0.04,
      start[1] + 0.017,
      start[2] + Math.sin(angle) * 0.04,
    ];
    growth.stems.push([start, petiole, 0.0045, 0.0025]);
    growth.leaves.push({
      start: petiole,
      tip: [
        start[0] + Math.cos(angle) * length,
        start[1] - 0.13 + 0.063 * j,
        start[2] + Math.sin(angle) * length,
      ],
      width: 0.085 + 0.025 * Math.cos(i * 3 + j),
      arch: 0.039 + 0.018 * Math.sin(i + j),
      roll: 0.55 * Math.sin(i + j * 2) + 0.21,
      color: ["#496b3a", "#638449", "#547b43", "#719053"][(i + j) % 4],
    });
  }
  // A copper stipule sheath stands upright beside the youngest leaf at each shoot tip.
  growth.leaves.push({
    start: end,
    tip: [x * 1.14, y + 0.067, z * 1.14],
    width: 0.011,
    arch: 0.007,
    roll: 0.32,
    color: i % 2 ? "#a98360" : "#96a069",
  });
}
export function TallFicus() {
  return (
    <group name="grand-ficus-salon-custom">
      <HouseplantPot radius={0.19} height={0.34} color="#8b765b" outline="#524839" />
      <HouseplantFoliage growth={growth} />
    </group>
  );
}
