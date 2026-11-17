import type { SceneItemSize } from "@cabane/engine";
import { branch, foliage, finish, type Point } from "./geometry";

export function broadleaf(
  size: SceneItemSize,
  form: "oak" | "birch" | "maple" | "willow" | "eucalyptus",
) {
  const forked = form === "eucalyptus" || form === "birch";
  const wood = [branch([0, 0, 0], [0.08, 2.7, 0], 0.18)];
  if (forked) wood.push(branch([0, 0.12, 0], [-0.55, 3.2, 0.12], 0.13));
  const leaves = [];
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.39996;
    const reach = 0.55 + (i % 3) * 0.3;
    const y = 2.3 + (i % 5) * 0.27;
    const end: Point = [Math.cos(angle) * reach, y, Math.sin(angle) * reach];
    wood.push(branch([0.04, 1.3 + (i % 4) * 0.3, 0], end, 0.07));
    if (form === "eucalyptus" || form === "willow") {
      // Pendant sprays leave open space around the fork and boughs.
      for (let j = 0; j < 9; j++) {
        const a = angle + j * 0.7;
        const x = end[0] + Math.cos(a) * 0.32,
          z = end[2] + Math.sin(a) * 0.32;
        wood.push(branch(end, [x, y - 0.35, z], 0.012));
        for (let k = 0; k < 5; k++) {
          const leaf = foliage(
            [x + Math.sin(k * 2) * 0.09, y - 0.25 - k * 0.16, z],
            [0.055, form === "willow" ? 0.31 : 0.22, 0.025],
            0,
          );
          leaves.push(leaf);
        }
      }
    } else {
      const scale: Point =
        form === "birch"
          ? [0.46, 0.75, 0.43]
          : form === "oak"
            ? [0.85, 0.62, 0.8]
            : [0.65, 0.82, 0.65];
      leaves.push(foliage(end, scale));
      for (let j = 0; j < 3; j++)
        leaves.push(
          foliage(
            [
              end[0] + Math.cos(angle + j * 2) * 0.38,
              y + 0.22,
              end[2] + Math.sin(angle + j * 2) * 0.38,
            ],
            scale.map((v) => v * 0.65) as Point,
          ),
        );
    }
  }
  return finish(wood, leaves, size);
}
