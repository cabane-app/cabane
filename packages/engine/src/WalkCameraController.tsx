import { omitUndefinedProperties } from "./defined-properties";
import { useWalkToolNavigation } from "./walk-tools/useWalkToolNavigation";
import type { WalkToolNavigation } from "./walk-tools";
import { passableOpeningIds, type OpeningPositions } from "./opening-pose";
import { prepareWalkColliders } from "./navigation/prepared-walk-colliders";
import { resolveWalkFall } from "./navigation/walk-fall";
import {
  WALK_JUMP_GRAVITY,
  WALK_JUMP_LAUNCH_SPEED,
  walkJumpVerticalRange,
} from "./navigation/walk-jump";
import {
  crossedWalkSupport,
  retainedWalkSupport,
  type WalkSupport,
} from "./navigation/walk-support";
import { createTerrainHeightQuery, createTerrainSupportQuery } from "./navigation/terrain-support";
import { hasCustomTerrain } from "./terrain/terrain-settings";
import {
  moveBuildingWalker,
  prepareBuildingWalk,
  type BuildingWalkPoint,
} from "./stairs/stair-navigation";
import type { BuildingGeometry } from "./stairs/types";
import type { StairModelRegistries } from "./stairs/stair-obstacles";
import { PerspectiveCamera } from "@react-three/drei";

import { useFrame, useThree } from "@react-three/fiber";

import { Box3, type Object3D, type PerspectiveCamera as ThreePerspectiveCamera } from "three";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";

import {
  clampPitch,
  distanceToOpening,
  integrateWalkVelocity,
  resolveCircleMovement,
  roomAtWorldPoint,
  shouldAutoOpenDoor,
  walkCollidersForVerticalRange,
  WALK_CRUISE_SPEED,
  WALK_EYE_HEIGHT,
  WALK_MAX_SPEED,
  type BoxWalkCollider,
  type StickVector,
  type WalkPose,
} from "./navigation";

import type { FloorSpec } from "./types";

export function WalkCameraController({
  floor,
  building,
  registries,
  elevation = 0,
  onFloorChange,
  poseRef,
  toolNavigationRef,
  movementInputRef,
  sprintInputRef,
  jumpRequestRef,
  lookInputRef,
  lookDeltaRef,
  invertYAxis = false,
  reducedMotion,
  openingPositions,
  onOpeningsChange,
  onRoomChange,
}: {
  floor: FloorSpec;
  building?: BuildingGeometry;
  registries?: StairModelRegistries;
  elevation?: number;
  onFloorChange?: (id: string) => void;

  poseRef: MutableRefObject<WalkPose>;
  toolNavigationRef?: MutableRefObject<WalkToolNavigation | null>;
  movementInputRef: MutableRefObject<StickVector>;
  sprintInputRef?: MutableRefObject<boolean>;
  jumpRequestRef?: MutableRefObject<boolean>;
  lookInputRef: MutableRefObject<StickVector>;
  lookDeltaRef: MutableRefObject<StickVector>;
  invertYAxis?: boolean;
  reducedMotion: boolean;
  openingPositions: OpeningPositions;
  onOpeningsChange: (next: ReadonlySet<string>) => void;
  onRoomChange: (roomId: string | null) => void;
}) {
  // Compare architecture content at React updates, not on every animation frame.
  // This also catches edits that reuse a FloorSpec object instead of its identity.
  const navigationKey = JSON.stringify(
    building
      ? {
          floors: building.floors,
          stairs: building.stairs,
          coordinates: building.coordinates,
          home: building.home,
        }
      : floor,
  );
  const buildingMode = Boolean(building);
  const navigation = useMemo(
    () =>
      buildingMode
        ? {
            building: prepareBuildingWalk(JSON.parse(navigationKey) as BuildingGeometry),
            floor: null,
          }
        : {
            building: undefined,
            floor: prepareWalkColliders(JSON.parse(navigationKey) as FloorSpec, elevation),
          },
    [navigationKey, buildingMode, elevation],
  );
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const walker = useRef<BuildingWalkPoint | null>(null);
  const previousFloorId = useRef(floor.id);
  const velocity = useRef<StickVector>({ x: 0, y: 0 });
  const lookVelocity = useRef<StickVector>({ x: 0, y: 0 });
  const jumpHeight = useRef(0);
  const jumpVelocity = useRef(0);
  const standingSupport = useRef<WalkSupport | null>(null);
  const bobPhase = useRef(0);
  const bobWeight = useRef(0);
  const furniture = useRef<BoxWalkCollider[]>([]);
  const lastRoomId = useRef<string | null>(null);
  const box = useMemo(() => new Box3(), []);
  const { scene, invalidate } = useThree();
  const supportsTerrain = useMemo(() => createTerrainSupportQuery(scene), [scene]);
  // Continuous movement already tests the player radius against walls and pool
  // colliders. Sample the center so terrain cutouts meet indoor door thresholds.
  const sampleTerrain = useMemo(() => createTerrainHeightQuery(scene, 0), [scene]);
  const terrainHeight =
    hasCustomTerrain(building?.home?.terrain) && !building?.home?.apartmentFloor
      ? sampleTerrain
      : undefined;

  useEffect(() => {
    scene.updateMatrixWorld(true);
    const next: BoxWalkCollider[] = [];
    scene.traverse((object: Object3D) => {
      if (object.userData.walkCollider !== true) return;
      box.setFromObject(object);
      if (
        !box.isEmpty() &&
        box.max.y > elevation + 0.05 &&
        box.min.y < elevation + WALK_EYE_HEIGHT + 1
      )
        next.push({
          kind: "box",
          id: object.uuid,
          minX: box.min.x,
          maxX: box.max.x,
          minZ: box.min.z,
          maxZ: box.max.z,
          minY: box.min.y,
          maxY: box.max.y,
          ...(object.userData.walkSupport === true ? { supportY: box.max.y } : {}),
        });
    });
    furniture.current = next;
  }, [box, scene, floor.id, elevation]);

  useWalkToolNavigation(
    omitUndefinedProperties({
      ...(building === undefined ? {} : { building: building }),
      floor,
      scene,
      box,
      ...(toolNavigationRef === undefined ? {} : { toolNavigationRef: toolNavigationRef }),
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
      ...(jumpRequestRef === undefined ? {} : { jumpRequestRef: jumpRequestRef }),
      lastRoomId,
      onFloorChange,
      onRoomChange,
      invalidate,
    }),
  );

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.rotation.order = "YXZ";
    cameraRef.current.position.set(
      poseRef.current.x,
      elevation + WALK_EYE_HEIGHT,
      poseRef.current.z,
    );
    cameraRef.current.rotation.set(poseRef.current.pitch, poseRef.current.yaw, 0);
    invalidate();
  }, [elevation, invalidate, poseRef]);

  const openIdsRef = useRef<ReadonlySet<string>>(new Set());

  useFrame((_, rawDelta) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const delta = Math.min(0.05, rawDelta);
    const pose = poseRef.current;
    pose.yaw -= lookDeltaRef.current.x * 0.0024;
    pose.pitch = clampPitch(pose.pitch - lookDeltaRef.current.y * (invertYAxis ? -0.002 : 0.002));
    lookDeltaRef.current = { x: 0, y: 0 };
    lookVelocity.current.x +=
      (lookInputRef.current.x * 2.4 - lookVelocity.current.x) * (1 - Math.exp(-18 * delta));
    lookVelocity.current.y +=
      (lookInputRef.current.y * 1.7 - lookVelocity.current.y) * (1 - Math.exp(-18 * delta));
    pose.yaw -= lookVelocity.current.x * delta;
    pose.pitch = clampPitch(pose.pitch - lookVelocity.current.y * delta * (invertYAxis ? -1 : 1));

    velocity.current = integrateWalkVelocity(
      velocity.current,
      movementInputRef.current,
      delta,
      WALK_CRUISE_SPEED * (sprintInputRef?.current ? 2 : 1),
    );
    const forwardX = -Math.sin(pose.yaw);
    const forwardZ = -Math.cos(pose.yaw);
    const rightX = Math.cos(pose.yaw);
    const rightZ = -Math.sin(pose.yaw);
    const movement = {
      x: (rightX * velocity.current.x - forwardX * velocity.current.y) * delta,
      z: (rightZ * velocity.current.x - forwardZ * velocity.current.y) * delta,
    };

    const current = walker.current;
    // Frame updates can outrun React’s floor selection commit at a landing.
    // Keep the physical walker authoritative until a different floor is selected.
    const floorSelectionChanged = previousFloorId.current !== floor.id;
    previousFloorId.current = floor.id;
    const start =
      current &&
      (!floorSelectionChanged || current.floorId === floor.id) &&
      current.x === pose.x &&
      current.z === pose.z
        ? current
        : { ...pose, floorId: floor.id, elevation };

    let nextOpen: Set<string> | null = null;
    for (const openingFloor of building?.floors ?? [floor]) {
      const openingElevation =
        navigation.building?.levels.find((level) => level.floorId === openingFloor.id)
          ?.elevationMeters ?? elevation;
      for (const opening of openingFloor.openings) {
        if (opening.kind !== "door") continue;
        const currentlyOpen = (nextOpen ?? openIdsRef.current).has(opening.id);
        const shouldOpen = shouldAutoOpenDoor(
          Math.hypot(
            distanceToOpening(pose, opening, openingFloor),
            start.elevation - openingElevation,
          ),
          currentlyOpen,
        );
        if (shouldOpen !== currentlyOpen) {
          nextOpen ??= new Set(openIdsRef.current);
          if (shouldOpen) nextOpen.add(opening.id);
          else nextOpen.delete(opening.id);
        }
      }
    }
    if (nextOpen) {
      openIdsRef.current = nextOpen;
      onOpeningsChange(nextOpen);
    }

    if (standingSupport.current)
      jumpHeight.current = Math.max(0, standingSupport.current.elevation - start.elevation);
    const previousFeetElevation = start.elevation + jumpHeight.current;

    // Consume every request, including airborne presses, so landing cannot queue a hop.
    if (jumpRequestRef?.current) {
      if (
        standingSupport.current !== null ||
        (jumpHeight.current === 0 && jumpVelocity.current === 0)
      ) {
        standingSupport.current = null;
        jumpVelocity.current = WALK_JUMP_LAUNCH_SPEED;
      }
      jumpRequestRef.current = false;
    }
    let airborne =
      standingSupport.current === null && (jumpVelocity.current !== 0 || jumpHeight.current > 0);
    if (airborne) {
      jumpHeight.current += jumpVelocity.current * delta - 0.5 * WALK_JUMP_GRAVITY * delta * delta;
      jumpVelocity.current -= WALK_JUMP_GRAVITY * delta;
    }

    // Collision consumes the same committed pose as the model. Proximity changes
    // become traversable when React applies them to both on the next render.
    const passable = passableOpeningIds(
      building?.floors ?? [floor],
      openingPositions,
      jumpHeight.current,
    );
    const verticalRange = walkJumpVerticalRange(start.elevation, jumpHeight.current, airborne);
    let next = building
      ? moveBuildingWalker(
          building,
          start,
          movement,
          passable,
          furniture.current,
          navigation.building,
          registries,
          {
            verticalRange,
            allowUnsupported: airborne,
            ...(terrainHeight ? { terrainHeight } : {}),
          },
        )
      : {
          ...resolveCircleMovement(
            pose,
            movement,
            walkCollidersForVerticalRange(
              navigation.floor!(passable, furniture.current),
              verticalRange,
            ),
          ),
          floorId: floor.id,
          elevation,
        };
    if (building && airborne) {
      const fall = resolveWalkFall(
        building,
        next,
        start.elevation + jumpHeight.current,
        supportsTerrain,
        terrainHeight,
      );
      if (fall.kind === "fall") {
        next = fall.point;
        jumpHeight.current = fall.jumpHeight;
      } else if (fall.kind === "blocked") {
        next = start;
      }
    }
    if (standingSupport.current) {
      const retained = retainedWalkSupport(furniture.current, next, standingSupport.current.id);
      if (retained) {
        standingSupport.current = retained;
        jumpHeight.current = Math.max(0, retained.elevation - next.elevation);
      } else {
        jumpHeight.current = Math.max(0, standingSupport.current.elevation - next.elevation);
        standingSupport.current = null;
      }
    } else if (airborne && jumpVelocity.current <= 0) {
      const feetElevation = next.elevation + jumpHeight.current;
      const support = crossedWalkSupport(
        furniture.current,
        next,
        previousFeetElevation,
        feetElevation,
      );
      if (support && support.elevation >= next.elevation) {
        standingSupport.current = support;
        jumpHeight.current = support.elevation - next.elevation;
        jumpVelocity.current = 0;
      } else if (jumpHeight.current <= 0) {
        jumpHeight.current = jumpVelocity.current = 0;
      }
    }
    airborne =
      standingSupport.current === null && (jumpVelocity.current !== 0 || jumpHeight.current > 0);
    walker.current = next;
    if (next.floorId !== start.floorId) onFloorChange?.(next.floorId);
    pose.x = next.x;
    pose.z = next.z;

    const speedRatio = Math.min(
      1,
      Math.hypot(velocity.current.x, velocity.current.y) / WALK_MAX_SPEED,
    );
    bobWeight.current +=
      ((reducedMotion ? 0 : speedRatio) - bobWeight.current) *
      (1 - Math.exp(-(speedRatio > 0.02 ? 10 : 14) * delta));
    bobPhase.current += speedRatio * Math.PI * 2 * 1.7 * delta;
    const bob = airborne ? 0 : Math.sin(bobPhase.current) * 0.015 * bobWeight.current;
    camera.position.set(
      pose.x,
      next.elevation + WALK_EYE_HEIGHT + jumpHeight.current + bob,
      pose.z,
    );
    camera.rotation.set(pose.pitch, pose.yaw, 0);

    const roomId = roomAtWorldPoint(pose, floor)?.id ?? null;
    if (roomId !== lastRoomId.current) {
      lastRoomId.current = roomId;
      onRoomChange(roomId);
    }
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={68} near={0.04} far={120} />;
}
