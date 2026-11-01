import {
  pointInsidePolygon,
  remapWallOffsetToDerivedRun,
  resolveItemTransform,
  worldPointToPlan,
  type DerivedWallRun,
  type FloorSpec,
  type ManifestIssue,
  type SceneItemSpec,
} from "@cabane/engine";

type WallSpec = FloorSpec["walls"][number];

/**
 * Keeps wall-attached scene items renderable while a Construct edit removes
 * their support. The last known support is used only to preserve the resolved
 * world transform; the returned placement is absolute and no longer refers to
 * the deleted wall.
 */
export const detachSceneItemsFromMissingWalls = (
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
  rememberedWalls: ReadonlyMap<string, WallSpec>,
): readonly SceneItemSpec[] =>
  items.flatMap((item) => {
    const placement = item.placement;
    if (placement.kind !== "wall") return [item];
    const wall = floor.walls.find((wall) => wall.id === placement.wallId);
    if (wall) {
      const dx = wall.to[0] - wall.from[0];
      const dy = wall.to[1] - wall.from[1];
      const length = Math.hypot(dx, dy);
      const previous = rememberedWalls.get(placement.wallId);
      const oldDx = previous ? previous.to[0] - previous.from[0] : dx;
      const oldDy = previous ? previous.to[1] - previous.from[1] : dy;
      const oldLength = Math.hypot(oldDx, oldDy);
      const shortened = length < oldLength - 1e-8;
      let offset = placement.offsetFromWallStartPlanUnits;
      // Preserve the original anchor when trimming a collinear wall start.
      if (shortened && previous && length > 0 && oldLength > 0) {
        const shiftX = wall.from[0] - previous.from[0];
        const shiftY = wall.from[1] - previous.from[1];
        if (
          dx * oldDx + dy * oldDy > 0 &&
          Math.abs(dx * oldDy - dy * oldDx) < 1e-8 &&
          Math.abs(shiftX * oldDy - shiftY * oldDx) < 1e-8
        ) {
          offset -= (shiftX * oldDx + shiftY * oldDy) / oldLength;
        }
      }
      const halfWidth = shortened ? item.size[0] / floor.coordinates.metersPerPlanUnit / 2 : 0;
      if (offset - halfWidth < -1e-8 || offset + halfWidth > length + 1e-8) return [];
      return offset === placement.offsetFromWallStartPlanUnits
        ? [item]
        : [
            {
              ...item,
              placement: { ...placement, offsetFromWallStartPlanUnits: offset },
            },
          ];
    }

    const rememberedWall = rememberedWalls.get(placement.wallId);
    if (!rememberedWall) return [];
    const transform = resolveItemTransform(placement, {
      ...floor,
      walls: [
        ...floor.walls.filter((candidate) => candidate.id !== placement.wallId),
        rememberedWall,
      ],
    });
    const at = worldPointToPlan(
      {
        x: transform.position[0],
        z: transform.position[2],
      },
      floor.coordinates,
    );
    return [
      {
        ...item,
        placement: {
          kind: "absolute" as const,
          at,
          elevationMeters: transform.position[1],
          rotationYRadians: transform.rotationYRadians,
        },
      },
    ];
  });

/**
 * Rebinds wall items to the homogeneous wall run created by topology
 * normalization before applying the deletion fallback above. This preserves
 * both attachment semantics and the original wall-relative world position.
 */
export const reconcileSceneItemWallDependencies = (
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
  rememberedWalls: ReadonlyMap<string, WallSpec>,
  wallRuns: readonly DerivedWallRun[],
): readonly SceneItemSpec[] =>
  detachSceneItemsFromMissingWalls(
    items.map((item) => {
      const placement = item.placement;
      if (placement.kind !== "wall") return item;
      const remapped = remapWallOffsetToDerivedRun(
        wallRuns,
        placement.wallId,
        placement.offsetFromWallStartPlanUnits,
      );
      if (
        !remapped ||
        (remapped.wallId === placement.wallId &&
          remapped.offsetFromWallStartPlanUnits === placement.offsetFromWallStartPlanUnits)
      )
        return item;
      return {
        ...item,
        placement: {
          ...placement,
          wallId: remapped.wallId,
          offsetFromWallStartPlanUnits: remapped.offsetFromWallStartPlanUnits,
        },
      };
    }),
    floor,
    rememberedWalls,
  );

export interface SceneItemCeilingDependencyResult {
  items: readonly SceneItemSpec[];
  issues: readonly ManifestIssue[];
}

/**
 * Keeps ceiling-supported items attached to the room beneath their authored
 * plan point after Construct changes room topology. A retained room identity
 * is left untouched, so resolving the placement against the next floor makes
 * the item follow that room's newly derived ceiling height automatically.
 *
 * Split and merge edits can move the stable identity to a different face. In
 * that case the unique normalized room containing `placement.at` becomes the
 * new support. Unresolved and ambiguous supports are reported without
 * dropping or mutating the item, keeping the preview renderable and the issue
 * actionable.
 */
export const reconcileSceneItemCeilingDependencies = (
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
): SceneItemCeilingDependencyResult => {
  const issues: ManifestIssue[] = [];
  const reconciled = items.map((item, index) => {
    const placement = item.placement;
    if (placement.kind !== "ceiling") return item;

    const containingRooms = floor.rooms.filter((room) =>
      pointInsidePolygon(placement.at, room.polygon),
    );
    if (containingRooms.length === 0) {
      issues.push({
        code: "editor.ceiling-support-missing",
        severity: "warning",
        path: `sceneItems[${index}].placement`,
        message: `Ceiling item “${item.id}” is not inside a room after the floor-plan change. Move it into a room or restore its ceiling support.`,
      });
      return item;
    }
    if (containingRooms.length > 1) {
      issues.push({
        code: "editor.ceiling-support-ambiguous",
        severity: "warning",
        path: `sceneItems[${index}].placement`,
        message: `Ceiling item “${item.id}” belongs to more than one room after the floor-plan change. Move it away from the shared boundary.`,
      });
      return item;
    }

    const roomId = containingRooms[0].id;
    if (placement.roomId === roomId) return item;
    return {
      ...item,
      placement: {
        ...placement,
        roomId,
      },
    };
  });

  return { items: reconciled, issues };
};
