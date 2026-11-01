import {
  pointInsidePolygon,
  pointStrictlyOutsideFloorFootprint,
  resolveItemTransform,
  safeSpawnPoseForRoom,
  type DeviceModelRegistry,
  type FloorSpec,
  type FurnishingModelRegistry,
  type ItemPlacement,
  type PlanPoint,
  type SceneItemSpec,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { selectionBoxGeometry } from "../editor-state";
import {
  placementCandidate as supportCandidate,
  type PlacementCandidate,
} from "./placement-candidate";
import { windowPlacements } from "./window-placement";
import type { SceneItemSize } from "@cabane/engine";

const footprint = (
  item: Pick<SceneItemSpec, "placement" | "size">,
  definition: SceneModelEditorDescriptor,
  floor: FloorSpec,
) => {
  const transform = resolveItemTransform(item.placement, floor);
  const box = selectionBoxGeometry(item, definition, 0.035);
  const cos = Math.cos(transform.rotationYRadians),
    sin = Math.sin(transform.rotationYRadians);
  return {
    x: transform.position[0] + box.center[0] * cos + box.center[2] * sin,
    z: transform.position[2] - box.center[0] * sin + box.center[2] * cos,
    width: Math.abs(cos) * box.size[0] + Math.abs(sin) * box.size[2],
    depth: Math.abs(sin) * box.size[0] + Math.abs(cos) * box.size[2],
  };
};

// Choose only the starting support. Once added, the item uses the ordinary
// selection, movement, rotation, properties, and history paths.
export function catalogStartPlacement(
  entry: { modelId: string; definition: SceneModelEditorDescriptor },
  floor: FloorSpec,
  preferredAt: PlanPoint,
  scene?: {
    items: readonly SceneItemSpec[];
    furnishingModels: FurnishingModelRegistry;
    deviceModels: DeviceModelRegistry;
  },
  isVisible?: (position: readonly number[]) => boolean,
): PlacementCandidate & { size?: SceneItemSize } {
  const visible = (placement: ItemPlacement, size = entry.definition.defaultSize) => {
    if (!isVisible) return true;
    const transform = resolveItemTransform(placement, floor);
    const box = selectionBoxGeometry({ size }, entry.definition, 0.035);
    const cos = Math.cos(transform.rotationYRadians),
      sin = Math.sin(transform.rotationYRadians);
    return isVisible([
      transform.position[0] + box.center[0] * cos + box.center[2] * sin,
      transform.position[1] + box.center[1],
      transform.position[2] - box.center[0] * sin + box.center[2] * cos,
    ]);
  };
  const placementCandidate: typeof supportCandidate = (...args) => {
    const candidate = supportCandidate(...args);
    return candidate.placement && !visible(candidate.placement)
      ? {
          placement: null,
          error: "No suitable support in the current view. Pan or zoom out and try again.",
        }
      : candidate;
  };
  if (entry.definition.windowFit) {
    const windows = windowPlacements(entry.definition, floor, preferredAt).filter((candidate) =>
      visible(candidate.placement, candidate.size),
    );
    const available = windows.find(
      (candidate) =>
        !scene?.items.some(
          (item) =>
            item.modelId === entry.modelId &&
            item.placement.kind === "wall" &&
            candidate.placement.kind === "wall" &&
            item.placement.wallId === candidate.placement.wallId &&
            item.placement.face === candidate.placement.face &&
            Math.abs(
              item.placement.offsetFromWallStartPlanUnits -
                candidate.placement.offsetFromWallStartPlanUnits,
            ) < 0.01,
        ),
    );
    const candidate = available ?? windows[0];
    return candidate
      ? { placement: candidate.placement, size: candidate.size, error: null }
      : {
          placement: null,
          error:
            "No suitable window in the current view. Pan to a window with space above it or zoom out.",
        };
  }
  const { origin, metersPerPlanUnit: scale } = floor.coordinates;
  const occupied =
    scene?.items.flatMap((item) => {
      const definition = (item.kind === "device" ? scene.deviceModels : scene.furnishingModels)[
        item.modelId
      ];
      return definition ? [footprint(item, definition, floor)] : [];
    }) ?? [];
  const obstacles = occupied.map((box, index) => ({
    kind: "box" as const,
    id: String(index),
    minX: box.x - box.width / 2,
    maxX: box.x + box.width / 2,
    minZ: box.z - box.depth / 2,
    maxZ: box.z + box.depth / 2,
  }));
  const { min, max } = entry.definition.bounds;
  const radius =
    Math.hypot(
      Math.max(Math.abs(min[0]), Math.abs(max[0])),
      Math.max(Math.abs(min[2]), Math.abs(max[2])),
    ) + 0.035;
  const clear = (placement: ItemPlacement) => {
    const box = footprint(
      { placement, size: entry.definition.defaultSize },
      entry.definition,
      floor,
    );
    return occupied.every(
      (other) =>
        Math.abs(box.x - other.x) >= (box.width + other.width) / 2 ||
        Math.abs(box.z - other.z) >= (box.depth + other.depth) / 2,
    );
  };
  if (entry.definition.placementEnvironment === "outdoor") {
    const footprintPoints = (floor.footprintRegions ?? [floor.footprint]).flat();
    const xs = footprintPoints.map((point) => point[0]);
    const zs = footprintPoints.map((point) => point[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    const margin = (radius + 0.45) / scale;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const candidates: PlanPoint[] = (floor.outdoorPlatforms ?? []).flatMap((platform) => {
      const points: PlanPoint[] = [];
      if (pointInsidePolygon(preferredAt, platform.polygon)) points.push(preferredAt);
      const center: PlanPoint = [
        platform.polygon.reduce((n, p) => n + p[0], 0) / platform.polygon.length,
        platform.polygon.reduce((n, p) => n + p[1], 0) / platform.polygon.length,
      ];
      if (pointInsidePolygon(center, platform.polygon)) points.push(center);
      return points;
    });
    if (pointStrictlyOutsideFloorFootprint(preferredAt, floor)) {
      candidates.push(preferredAt);
    }
    candidates.push(
      [clamp(preferredAt[0], minX, maxX), minZ - margin],
      [maxX + margin, clamp(preferredAt[1], minZ, maxZ)],
      [clamp(preferredAt[0], minX, maxX), maxZ + margin],
      [minX - margin, clamp(preferredAt[1], minZ, maxZ)],
    );
    for (let step = 0; step <= 4; step += 1) {
      const progress = step / 4;
      candidates.push(
        [minX + (maxX - minX) * progress, minZ - margin],
        [maxX + margin, minZ + (maxZ - minZ) * progress],
        [maxX - (maxX - minX) * progress, maxZ + margin],
        [minX - margin, maxZ - (maxZ - minZ) * progress],
      );
    }
    const ordered = candidates
      .filter(
        (point, index) =>
          candidates.findIndex(
            (candidate) => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < 1e-7,
          ) === index,
      )
      .sort(
        (left, right) =>
          Math.hypot(left[0] - preferredAt[0], left[1] - preferredAt[1]) -
          Math.hypot(right[0] - preferredAt[0], right[1] - preferredAt[1]),
      );
    let fallback: PlacementCandidate | null = null;
    for (const at of ordered) {
      const candidate = placementCandidate(entry, floor, {
        at,
        kind: "absolute",
        raw: true,
      });
      if (!candidate.placement) continue;
      fallback ??= candidate;
      if (clear(candidate.placement)) return candidate;
    }
    return (
      fallback ?? {
        placement: null,
        error: "No clear outdoor ground is available for this item.",
      }
    );
  }
  const rooms = floor.rooms
    .flatMap((room) => {
      const pose = safeSpawnPoseForRoom(room, floor, [], 0);
      if (!pose) return [];
      const at: PlanPoint = [pose.x / scale + origin[0], pose.z / scale + origin[1]];
      return [{ room, at, distance: Math.hypot(at[0] - preferredAt[0], at[1] - preferredAt[1]) }];
    })
    .sort(
      (a, b) =>
        Number(pointInsidePolygon(preferredAt, b.room.polygon)) -
          Number(pointInsidePolygon(preferredAt, a.room.polygon)) || a.distance - b.distance,
    );
  const kind = entry.definition.preferredPlacement;
  let fallback: PlacementCandidate | null = null;
  for (const { room, at: center } of rooms) {
    const points: PlanPoint[] = [];
    // Search around the camera target before trying room-wide fallbacks.
    for (const distance of [0, 0.5, 1, 1.5, 2]) {
      for (let step = 0; step < (distance ? 8 : 1); step += 1) {
        const at: PlanPoint = [
          preferredAt[0] + (Math.cos((step * Math.PI) / 4) * distance) / scale,
          preferredAt[1] + (Math.sin((step * Math.PI) / 4) * distance) / scale,
        ];
        if (pointInsidePolygon(at, room.polygon)) points.push(at);
      }
    }
    points.push(center);
    if (occupied.length) {
      // Reuse the engine's bounded search for a clear interior point. This
      // only chooses a convenient start; it does not restrict later dragging.
      const pose = safeSpawnPoseForRoom(room, floor, obstacles, radius);
      if (pose) points.push([pose.x / scale + origin[0], pose.z / scale + origin[1]]);
    }
    for (const at of points) {
      if (kind !== "wall") {
        const candidate = placementCandidate(entry, floor, { at, kind, raw: true });
        if (candidate.placement) {
          fallback ??= candidate;
          if (clear(candidate.placement)) return candidate;
        }
        continue;
      }
      // Project the room's interior point onto each wall, nearest first. The
      // existing support checks reject exterior faces and walls too short/low.
      const candidates = floor.walls
        .flatMap((wall) => {
          const candidate = placementCandidate(entry, floor, {
            at,
            kind,
            wallId: wall.id,
            raw: true,
          });
          if (!candidate.placement) return [];
          const { position } = resolveItemTransform(candidate.placement, floor);
          return [
            {
              candidate,
              distance: Math.hypot(
                position[0] - (at[0] - origin[0]) * scale,
                position[2] - (at[1] - origin[1]) * scale,
              ),
            },
          ];
        })
        .sort((a, b) => a.distance - b.distance);
      for (const { candidate } of candidates) {
        fallback ??= candidate;
        if (clear(candidate.placement!)) return candidate;
      }
    }
  }
  return (
    fallback ?? {
      placement: null,
      error: "No suitable room or support in the current view. Pan or zoom out and try again.",
    }
  );
}
