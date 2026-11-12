import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  collectSceneWalkColliders,
  observeSceneWalkColliders,
  deriveWalkColliders,
  deriveStairFlight,
  isWalkPointClear,
  planPointToWorld,
  roomAtWorldPoint,
  localSurfaceAt,
  worldPointToPlan,
  walkCollidersForVerticalRange,
  type SceneFeatureProps,
  type WalkCollider,
} from "@cabane/engine";
import { createPetRoaming } from "./roaming";
import type { PetModel } from "./model";

/** Reuse the same walls and loaded furniture as the player's navigation. */
export function usePetNavigation(
  { floor, elevation, openingPositions, building }: SceneFeatureProps,
  model: PetModel,
) {
  const scene = useThree((state) => state.scene);
  const [roaming, setRoaming] = useState<ReturnType<typeof createPetRoaming> | null>(null);
  const retained = useRef(new Map<string, ReturnType<typeof createPetRoaming>>());
  useEffect(() => {
    let previous = retained.current.get(floor.id) ?? null;
    const rebuild = () => {
      const radius = model.radius ?? 0.3;
      const height = model.height ?? 0.7;
      const points = floor.rooms
        .filter((room) => !room.isSolid)
        .flatMap((room) => room.polygon.map((point) => planPointToWorld(point, floor.coordinates)));
      if (!points.length) {
        setRoaming(null);
        return;
      }
      const holes: WalkCollider[] = building.stairs.flatMap((stair) => {
        const flight = stair.upperFloorId === floor.id ? deriveStairFlight(building, stair) : null;
        if (!flight) return [];
        const outline = flight.footprint.map((point) =>
          planPointToWorld(point, building.coordinates),
        );
        return [
          {
            kind: "box",
            id: stair.id,
            minX: Math.min(...outline.map((p) => p[0])),
            maxX: Math.max(...outline.map((p) => p[0])),
            minZ: Math.min(...outline.map((p) => p[1])),
            maxZ: Math.max(...outline.map((p) => p[1])),
          },
        ];
      });
      const open = new Set(
        Object.keys(openingPositions).filter((id) => openingPositions[id] >= 0.95),
      );
      const colliders = [
        ...walkCollidersForVerticalRange(
          deriveWalkColliders(
            floor,
            open,
            collectSceneWalkColliders(scene, elevation, height),
            elevation,
          ),
          { minY: elevation + 0.05, maxY: elevation + height },
        ),
        ...holes,
      ];
      const isWalkable = (point: { x: number; z: number }) => {
        const room = roomAtWorldPoint(point, floor);
        return (
          !!room &&
          !room.isSolid &&
          [
            [0, 0],
            [radius, 0],
            [-radius, 0],
            [0, radius],
            [0, -radius],
          ].every(([dx, dz]) => {
            const support = localSurfaceAt(
              floor,
              worldPointToPlan({ x: point.x + dx, z: point.z + dz }, floor.coordinates),
            );
            return !support.sloped && Math.abs(support.elevation) < 1e-5;
          }) &&
          isWalkPointClear(point, colliders, radius)
        );
      };
      const next = createPetRoaming({
        bounds: {
          minX: Math.min(...points.map((p) => p[0])),
          maxX: Math.max(...points.map((p) => p[0])),
          minZ: Math.min(...points.map((p) => p[1])),
          maxZ: Math.max(...points.map((p) => p[1])),
        },
        isWalkable,
        speed: model.speed ?? 0.28,
        ...(previous?.position ? { spawn: previous.position, initialYaw: previous.yaw } : {}),
      });
      previous = next;
      retained.current.set(floor.id, next);
      setRoaming(next);
    };
    rebuild();
    return observeSceneWalkColliders(scene, rebuild);
  }, [scene, floor, elevation, openingPositions, building, model]);
  return roaming;
}
