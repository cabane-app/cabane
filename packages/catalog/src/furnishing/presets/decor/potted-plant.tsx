import { HouseplantFoliage, type HouseplantGrowth } from "./houseplant-foliage";
import { HouseplantPot } from "./houseplant-pot";
import type { Point } from "../outdoor/vegetation/geometry";

const growth: HouseplantGrowth = {
  min: [-0.3075, 0.31, -0.215],
  max: [0.3075, 1.105, 0.215],
  bark: "#778958",
  stems: [],
  leaves: [],
};
// Aspidistra petioles rise independently from the soil; older outer blades arch outward.
for (const [i, [x, y, z]] of [
  [-0.32, 0.67, 0.03],
  [0.28, 0.73, 0.12],
  [-0.19, 0.79, -0.18],
  [0.19, 0.88, -0.16],
  [-0.12, 0.9, 0.19],
  [-0.08, 1.08, -0.12],
  [0.14, 1.0, 0.08],
  [0.04, 0.73, 0.22],
  [0.02, 0.98, -0.2],
].entries()) {
  const start: Point = [x * 0.33, 0.42 + (y - 0.62) * 0.62, z * 0.33];
  growth.stems.push([[x * 0.13, 0.31, z * 0.13], start, 0.009, 0.005]);
  growth.leaves.push({
    start,
    tip: [x, y, z],
    width: 0.052 + 0.008 * (i % 3),
    arch: 0.085,
    color: ["#66885c", "#789767", "#608259"][i % 3],
  });
}

export function PottedPlant({
  potColor = "#c6785e",
  potOutlineColor = "#75493c",
}: {
  potColor?: string;
  potOutlineColor?: string;
}) {
  return (
    <group name="potted-plant">
      <HouseplantPot radius={0.22} height={0.36} color={potColor} outline={potOutlineColor} />
      <HouseplantFoliage growth={growth} />
    </group>
  );
}
