import { ToonMaterial } from "@cabane/engine";
import { MilledSurface, type Face } from "./milled-surface";
import type { KitchenVector3 } from "./kitchen-finish";

/** Nested rectangular profiles, clockwise seen from behind. Each step has its own face normal. */
export function RecessedPanel({
  rings,
  position,
  color,
  rotation = [0, 0, 0],
}: {
  readonly rings: readonly KitchenVector3[];
  readonly position: KitchenVector3;
  readonly rotation?: KitchenVector3;
  readonly color: string;
}) {
  const faces: Face[] = [];
  const corners = rings.map(
    ([w, h, z]) =>
      [
        [-w / 2, -h / 2, z],
        [w / 2, -h / 2, z],
        [w / 2, h / 2, z],
        [-w / 2, h / 2, z],
      ] as const,
  );
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1]!,
      b = corners[i]!;
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      faces.push([a[j]!, a[k]!, b[k]!, b[j]!]);
    }
  }
  faces.push(corners[corners.length - 1]!);
  return (
    <mesh position={position} rotation={[...rotation]} castShadow receiveShadow>
      <MilledSurface faces={faces} />
      <ToonMaterial color={color} />
    </mesh>
  );
}
