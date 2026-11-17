import type { SceneItemSize } from "@cabane/engine";
import { branch, finish, type Point } from "./geometry";

export function palm(size: SceneItemSize, fan: boolean) {
  const wood = [branch([0, 0, 0], [0.22, 3.4, 0], 0.2, 0.13)];
  const leaves = [];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4,
      y = 3.45 + (i % 3) * 0.12;
    const tip: Point = [0.22 + Math.cos(a) * 1.65, y - 0.3, Math.sin(a) * 1.65];
    const mid: Point = [0.22 + Math.cos(a) * 0.9, y + 0.25, Math.sin(a) * 0.9];
    leaves.push(branch([0.22, 3.35, 0], mid, 0.035), branch(mid, tip, 0.025));
    for (let j = 0; j < 12; j++) {
      if (fan) {
        const spread = a + (j - 5.5) * 0.13;
        leaves.push(
          branch(
            mid,
            [mid[0] + Math.cos(spread) * 0.85, mid[1] - 0.3, mid[2] + Math.sin(spread) * 0.85],
            0.075,
            0.008,
          ),
        );
      } else {
        const t = (j + 1) / 13;
        const p: Point = [
          0.22 + Math.cos(a) * 1.65 * t,
          y + Math.sin(t * Math.PI) * 0.25 - t * 0.3,
          Math.sin(a) * 1.65 * t,
        ];
        for (const side of [-1, 1])
          leaves.push(
            branch(
              p,
              [
                p[0] + Math.cos(a + side * 1.1) * 0.5,
                p[1] - 0.23,
                p[2] + Math.sin(a + side * 1.1) * 0.5,
              ],
              0.048,
              0.003,
            ),
          );
      }
    }
  }
  return finish(wood, leaves, size);
}
