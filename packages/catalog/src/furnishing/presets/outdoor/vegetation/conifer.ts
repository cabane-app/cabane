import { ConeGeometry } from "three";
import type { SceneItemSize } from "@cabane/engine";
import { branch, foliage, finish, type Point } from "./geometry";

export function conifer(size: SceneItemSize, slender: boolean) {
  const wood = [branch([0, 0, 0], [0, 4.5, 0], slender ? 0.12 : 0.23)];
  const leaves = [];
  if (slender) {
    for (let i = 0; i < 7; i++)
      leaves.push(new ConeGeometry(0.55 - i * 0.065, 1.65, 10).translate(0, 1 + i * 0.5, 0));
  } else {
    for (let i = 0; i < 19; i++) {
      const a = i * 2.4,
        reach = 1.3 - (i % 5) * 0.16;
      const end: Point = [Math.cos(a) * reach, 2.4 + (i % 5) * 0.43, Math.sin(a) * reach];
      wood.push(branch([0, end[1] - 0.5, 0], end, 0.075));
      leaves.push(foliage(end, [0.8, 0.35, 0.65]));
    }
  }
  return finish(wood, leaves, size);
}
