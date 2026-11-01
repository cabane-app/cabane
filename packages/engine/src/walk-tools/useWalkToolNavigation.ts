import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import type { Scene, PerspectiveCamera } from "three";
import {
  clampPitch,
  roomAtWorldPoint,
  WALK_EYE_HEIGHT,
  type WalkPose,
  type StickVector,
} from "../navigation";
import { resolveWalkLanding } from "../navigation/walk-landing";
import { collectSceneWalkColliders } from "../navigation/scene-walk-colliders";
import type { WalkSupport } from "../navigation/walk-support";
import { createTerrainSupportQuery } from "../navigation/terrain-support";
import type { BuildingGeometry } from "../stairs/types";
import type { BuildingWalkPoint } from "../stairs/stair-navigation";
import type { FloorSpec } from "../types";
import type { WalkToolNavigation } from "./types";

/** Connect generic tool relocation to the controller's authoritative movement state. */
export function useWalkToolNavigation({
  building,
  floor,
  scene,
  toolNavigationRef,
  poseRef,
  cameraRef,
  walker,
  velocity,
  lookVelocity,
  lookDeltaRef,
  jumpHeight,
  jumpVelocity,
  standingSupport,
  bobWeight,
  jumpRequestRef,
  lastRoomId,
  onFloorChange,
  onRoomChange,
  invalidate,
}: {
  building?: BuildingGeometry;
  floor: FloorSpec;
  scene: Scene;
  toolNavigationRef?: MutableRefObject<WalkToolNavigation | null>;
  poseRef: MutableRefObject<WalkPose>;
  cameraRef: RefObject<PerspectiveCamera | null>;
  walker: MutableRefObject<BuildingWalkPoint | null>;
  velocity: MutableRefObject<StickVector>;
  lookVelocity: MutableRefObject<StickVector>;
  lookDeltaRef: MutableRefObject<StickVector>;
  jumpHeight: MutableRefObject<number>;
  jumpVelocity: MutableRefObject<number>;
  standingSupport: MutableRefObject<WalkSupport | null>;
  bobWeight: MutableRefObject<number>;
  jumpRequestRef?: MutableRefObject<boolean>;
  lastRoomId: MutableRefObject<string | null>;
  onFloorChange?: (id: string) => void;
  onRoomChange: (id: string | null) => void;
  invalidate: () => void;
}) {
  useLayoutEffect(() => {
    if (!toolNavigationRef) return;
    const geometry = building ?? {
      coordinates: floor.coordinates,
      floors: [floor],
      stairs: [],
      sceneItems: [],
    };
    const supportsTerrain = createTerrainSupportQuery(scene);
    const resolveLanding: WalkToolNavigation["resolveLanding"] = (position) =>
      resolveWalkLanding(
        geometry,
        position,
        (targetElevation) =>
          collectSceneWalkColliders(scene, targetElevation, WALK_EYE_HEIGHT + 0.2),
        supportsTerrain,
      );
    const navigation: WalkToolNavigation = {
      resolveLanding,
      teleport: (landing, facing) => {
        const camera = cameraRef.current;
        if (!camera || ![facing.yaw, facing.pitch].every(Number.isFinite)) return false;
        const checked = resolveLanding({ x: landing.x, y: landing.elevation, z: landing.z });
        if (
          !checked ||
          checked.floorId !== landing.floorId ||
          Math.abs(checked.elevation - landing.elevation) > 0.01
        )
          return false;
        poseRef.current = {
          x: checked.x,
          z: checked.z,
          yaw: facing.yaw,
          pitch: clampPitch(facing.pitch),
        };
        walker.current = checked;
        velocity.current = { x: 0, y: 0 };
        lookVelocity.current = { x: 0, y: 0 };
        lookDeltaRef.current = { x: 0, y: 0 };
        jumpHeight.current = jumpVelocity.current = bobWeight.current = 0;
        standingSupport.current = null;
        if (jumpRequestRef) jumpRequestRef.current = false;
        camera.position.set(checked.x, checked.elevation + WALK_EYE_HEIGHT, checked.z);
        camera.rotation.set(poseRef.current.pitch, poseRef.current.yaw, 0);
        if (checked.floorId !== floor.id) onFloorChange?.(checked.floorId);
        const destinationFloor = geometry.floors.find(
          (candidate) => candidate.id === checked.floorId,
        )!;
        lastRoomId.current = roomAtWorldPoint(checked, destinationFloor)?.id ?? null;
        onRoomChange(lastRoomId.current);
        invalidate();
        return true;
      },
    };
    toolNavigationRef.current = navigation;
    return () => {
      if (toolNavigationRef.current === navigation) toolNavigationRef.current = null;
    };
  }, [
    building,
    floor,
    scene,
    toolNavigationRef,
    poseRef,
    cameraRef,
    walker,
    velocity,
    lookVelocity,
    lookDeltaRef,
    jumpHeight,
    jumpVelocity,
    standingSupport,
    bobWeight,
    jumpRequestRef,
    lastRoomId,
    onFloorChange,
    onRoomChange,
    invalidate,
  ]);
}
