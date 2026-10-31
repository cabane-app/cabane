import type { TerrainSurface } from "../terrain/terrain-surface";
import type { FloorSpec } from "../types";
import { deriveWalkColliders } from "./walk-colliders";
import type { BoxWalkCollider, WalkCollider } from "./walk-navigation-contract";

/** Own the architecture snapshot; door sets and furniture may change in place. */
export function prepareWalkColliders(
  floor: FloorSpec,
  elevation = 0,
  terrain: TerrainSurface = null,
) {
  const architecture = structuredClone(floor);
  let previousOpen: Set<string> | undefined;
  let previousFurniture: BoxWalkCollider[] = [];
  let colliders: WalkCollider[];
  return (openIds: ReadonlySet<string>, furniture: readonly BoxWalkCollider[]) => {
    let sameDoors = previousOpen?.size === openIds.size;
    if (sameDoors)
      for (const id of openIds) {
        if (!previousOpen!.has(id)) {
          sameDoors = false;
          break;
        }
      }
    const sameFurniture =
      previousFurniture.length === furniture.length &&
      furniture.every((box, i) => {
        const previous = previousFurniture[i];
        return (
          box.id === previous.id &&
          box.minX === previous.minX &&
          box.maxX === previous.maxX &&
          box.minZ === previous.minZ &&
          box.maxZ === previous.maxZ &&
          box.minY === previous.minY &&
          box.maxY === previous.maxY
        );
      });
    if (!sameDoors || !sameFurniture) {
      colliders = deriveWalkColliders(architecture, openIds, furniture, elevation, terrain);
      previousOpen = new Set(openIds);
      previousFurniture = furniture.map((box) => ({ ...box }));
    }
    return colliders;
  };
}
