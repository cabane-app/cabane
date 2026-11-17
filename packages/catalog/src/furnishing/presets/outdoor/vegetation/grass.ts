import type { SceneItemSize } from "@cabane/engine";
import { branch, foliage, finish, type Point } from "./geometry";
export function grass(size: SceneItemSize) {
  const wood = [],
    leaves = [];
  for (let i = 0; i < 65; i++) {
    const a = i * 2.4,
      reach = 0.3 + (i % 7) * 0.065,
      height = 0.6 + (i % 5) * 0.13;
    const base: Point = [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12];
    const mid: Point = [Math.cos(a) * reach * 0.5, height, Math.sin(a) * reach * 0.5];
    const tip: Point = [Math.cos(a) * reach, height * 0.7, Math.sin(a) * reach];
    leaves.push(branch(base, mid, 0.022, 0.014), branch(mid, tip, 0.014, 0.001));
    if (i % 6 === 0) {
      const top: Point = [mid[0], height + 0.4, mid[2]];
      wood.push(branch(base, top, 0.008));
      wood.push(foliage(top, [0.055, 0.19, 0.055]));
    }
  }
  return finish(wood, leaves, size);
}
