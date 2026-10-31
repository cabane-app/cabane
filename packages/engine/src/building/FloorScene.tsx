import { Fragment } from "react";
import { ItemEntityReadings } from "../ItemEntityReadings";
import { SolidRooms } from "../architecture-scene/SolidRooms";
import { ArchitecturalOutdoorPlatforms, floorSlabPolygons } from "../outdoor-platforms";
import { ArchitecturalHedges } from "../hedges";
export type FloorSceneProps = {
  sourceFloor: HomeManifest["floors"][number];
  below?: HomeManifest["floors"][number] | undefined;
  platformBelow?: HomeManifest["floors"][number];
  above?: HomeManifest["floors"][number] | undefined;
  showGround: boolean;
  showCeiling: boolean;
  manifest: HomeManifest;
  walkMode: boolean;
  wallFadeEnabled: boolean;
  reducedMotion: boolean;
  resolvedBindings: ResolvedHomeBindings;
  architectureModels: ArchitectureModelRegistry;
  deviceModels: DeviceModelRegistry;
  openingPositions: import("../opening-pose").OpeningPositions;
  onSelectRoom?: ((roomId: string) => void) | undefined;
  onInteract: (target: ExtensionInteractionTarget) => void;
  onWalkDeviceTargetChange?: ((target: ExtensionInteractionTarget | null) => void) | undefined;
  liveMediaByEntityId?: Readonly<Partial<Record<EntityId, DeviceLiveMedia>>>;
  interactionMode?: ("runtime" | "editor") | undefined;
  sceneLightingEnabled?: boolean;
};
import { type Object3D } from "three";

import { memo, useLayoutEffect, useMemo, useRef } from "react";

import { useSceneArchitectureFloor } from "../scene-architecture-inputs";

import { RoomSelectionSurfaces } from "./RoomSelectionSurfaces";

import { ArchitecturalPools, worldBoundsForFloorScene } from "../pools";

import { SceneOpeningRenderer } from "../SceneOpeningRenderer";

import { mergeDeviceModelRegistriesStableFirst, resolveDeviceModelDefinition } from "../devices";

import { roomIdForItem } from "../home-project";

import { LegacyDeviceItemRenderer, SceneItemRenderer } from "../SceneItemRenderer";

import { ArchitecturalWall, ArchitecturalWalls } from "../architecture-scene/ArchitecturalWalls";
import { PolygonSurface } from "../architecture-scene/ArchitecturePolygonSurface";
import { CeilingSurfaces } from "../architecture-scene/CeilingSurfaces";
import { DioramaGround } from "../architecture-scene/DioramaGround";
import {
  EMPTY_MEDIA,
  EMPTY_STATES,
  Furnishings,
  statesBySlotIdForRoom,
} from "../architecture-scene/RoomFurnishings";
import { WalkDeviceTargeting } from "../architecture-scene/WalkDeviceTargeting";
import type {
  ArchitectureModelRegistry,
  DeviceLiveMedia,
  DeviceModelRegistry,
  EntityId,
  ExtensionInteractionTarget,
  HomeManifest,
  ResolvedDeviceBinding,
  ResolvedHomeBindings,
} from "../types";

export const FloorScene = memo(function FloorScene({
  sourceFloor,
  showGround,
  showCeiling,
  below,
  above,
  platformBelow,
  manifest,
  walkMode,
  wallFadeEnabled,
  reducedMotion,
  resolvedBindings,
  architectureModels,
  deviceModels,
  openingPositions,
  onSelectRoom,
  onInteract,
  onWalkDeviceTargetChange,
  liveMediaByEntityId = EMPTY_MEDIA,
  interactionMode = "runtime",
  sceneLightingEnabled = true,
}: FloorSceneProps) {
  const floor = useSceneArchitectureFloor(sourceFloor);
  const visualRoot = useRef<Object3D>(null);
  useLayoutEffect(() => {
    if (interactionMode !== "editor" || !visualRoot.current) return;
    const originals = new Map<Object3D, Object3D["raycast"]>();
    // R3F raycasts each registered event object, not just the scene root.
    // Guard every descendant, including handlers owned by catalog components.
    visualRoot.current.traverse((object) => {
      // Retain the method for restoration on its original object; it is never called detached.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      originals.set(object, object.raycast);
      object.raycast = () => false;
    });
    return () =>
      originals.forEach((raycast, object) => {
        object.raycast = raycast;
      });
  });
  const bounds = worldBoundsForFloorScene(floor);
  const groundSize = Math.max(bounds.width, bounds.depth) + 7;
  const DoorModel = architectureModels.door;
  const WindowModel = architectureModels.window;
  const PassageModel = architectureModels.passage;
  const resolvedDeviceById = useMemo(
    () =>
      Object.fromEntries(
        Object.values(resolvedBindings.rooms).flatMap((room) =>
          room.devices.map((device) => [device.slot.id, device]),
        ),
      ) as Readonly<Record<string, ResolvedDeviceBinding>>,
    [resolvedBindings],
  );
  const roomStates = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(resolvedBindings.rooms).map((id) => [
          id,
          statesBySlotIdForRoom(id, resolvedBindings),
        ]),
      ),
    [resolvedBindings],
  );
  const declarativeDeviceModels = useMemo(
    () => mergeDeviceModelRegistriesStableFirst(deviceModels, manifest.extensions.deviceModels),
    [deviceModels, manifest.extensions.deviceModels],
  );
  return (
    <group
      ref={visualRoot}
      name="floor-scene"
      userData={{ editorVisualOnly: interactionMode === "editor" }}
    >
      {onWalkDeviceTargetChange && (
        <WalkDeviceTargeting active={walkMode} onTargetChange={onWalkDeviceTargetChange} />
      )}
      {showGround && (
        <DioramaGround
          floor={floor}
          centerX={bounds.centerX}
          centerZ={bounds.centerZ}
          size={groundSize}
          color={manifest.home.palette.ground}
        />
      )}
      <ArchitecturalOutdoorPlatforms floor={floor} below={platformBelow} />
      <SolidRooms floor={floor} color={manifest.home.palette.interior} />
      <ArchitecturalHedges floor={floor} />
      <ArchitecturalPools floor={floor} reducedMotion={reducedMotion} />
      {floorSlabPolygons(floor).map((polygon, index) => (
        <PolygonSurface
          key={`floor-footprint-${index}`}
          polygon={polygon}
          floor={floor}
          color="#d7d1c5"
          elevation={-0.004}
          name={`floor-footprint-${index}`}
        />
      ))}
      <RoomSelectionSurfaces
        sourceFloor={sourceFloor}
        floor={floor}
        manifest={manifest}
        resolvedBindings={resolvedBindings}
        deviceModels={deviceModels}
        reducedMotion={reducedMotion}
        walkMode={walkMode}
        sceneLightingEnabled={sceneLightingEnabled}
        onSelectRoom={onSelectRoom}
      />
      <ArchitecturalWalls
        onSelectRoom={!walkMode && interactionMode === "runtime" ? onSelectRoom : undefined}
        baseElevationMeters={showGround ? undefined : 0}
        below={below}
        above={above}
        floor={floor}
        interiorColor={manifest.home.palette.interior}
        exteriorColor={manifest.home.palette.exterior}
        fade={!walkMode && wallFadeEnabled}
        reducedMotion={reducedMotion}
      />
      {sourceFloor.openings.map((opening) => {
        const wall = floor.walls.find((candidate) => candidate.id === opening.wallId);
        if (!wall) return null;
        const CustomModel = opening.visualModel
          ? Object.hasOwn(manifest.extensions.openingModels, opening.visualModel)
            ? manifest.extensions.openingModels[opening.visualModel]
            : undefined
          : undefined;
        if (CustomModel) {
          return (
            <SceneOpeningRenderer
              model={CustomModel}
              key={opening.id}
              wall={wall}
              opening={opening}
              floor={sourceFloor}
              position={openingPositions[opening.id] ?? 0}
              reducedMotion={reducedMotion}
            />
          );
        }
        return opening.kind === "door" ? (
          <SceneOpeningRenderer
            model={DoorModel}
            walkMode={walkMode}
            onInteract={interactionMode === "runtime" ? onInteract : undefined}
            key={opening.id}
            wall={wall}
            opening={opening}
            floor={floor}
            position={openingPositions[opening.id] ?? 0}
            reducedMotion={reducedMotion}
          />
        ) : opening.kind === "window" ? (
          <SceneOpeningRenderer
            model={WindowModel}
            key={opening.id}
            wall={wall}
            opening={opening}
            floor={floor}
            position={openingPositions[opening.id] ?? 0}
            reducedMotion={reducedMotion}
          />
        ) : (
          <SceneOpeningRenderer
            model={PassageModel}
            key={opening.id}
            wall={wall}
            opening={opening}
            floor={floor}
            position={1}
            reducedMotion={reducedMotion}
          />
        );
      })}
      {showCeiling && <CeilingSurfaces floor={floor} />}
      {manifest.sceneItems.length > 0 ? (
        manifest.sceneItems
          .filter((item) => item.floorId === floor.id)
          .map((item) => {
            const definition = (
              item.kind === "device"
                ? declarativeDeviceModels
                : manifest.extensions.furnishingModels
            )[item.modelId];
            const states =
              roomStates[roomIdForItem(item, floor, definition) ?? `outside-rooms:${floor.id}`] ??
              EMPTY_STATES;
            return (
              <Fragment key={item.id}>
                <SceneItemRenderer
                  item={item}
                  floor={floor}
                  furnishingModels={manifest.extensions.furnishingModels}
                  deviceModels={declarativeDeviceModels}
                  resolvedDevice={resolvedDeviceById[item.id]}
                  entityStatesBySlotId={states}
                  reducedMotion={reducedMotion}
                  walkMode={walkMode}
                  onInteract={onInteract}
                  liveMediaByEntityId={liveMediaByEntityId}
                  outlineColor={manifest.home.palette.accent}
                />
                {!walkMode && interactionMode !== "editor" && (
                  <ItemEntityReadings item={item} floor={floor} states={states} />
                )}
              </Fragment>
            );
          })
      ) : (
        <>
          {sourceFloor.rooms.map((room) => (
            <Furnishings
              key={`furnishings-${room.id}`}
              floor={floor}
              room={room}
              extensions={manifest.extensions}
              resolvedBindings={resolvedBindings}
              walkMode={walkMode}
              reducedMotion={reducedMotion}
              onInteract={onInteract}
            />
          ))}
          {sourceFloor.rooms.flatMap((room) =>
            room.devices.flatMap((binding) => {
              const resolvedDevice = resolvedBindings.rooms[room.id]?.devices.find(
                (device) => device.slot.id === binding.id,
              );
              const definition = resolveDeviceModelDefinition(
                binding.model,
                deviceModels,
                manifest.extensions.deviceModels,
              );
              if (!resolvedDevice) return [];
              return [
                <LegacyDeviceItemRenderer
                  key={`device-${binding.id}`}
                  resolvedDevice={resolvedDevice}
                  floor={floor}
                  definition={definition}
                  reducedMotion={reducedMotion}
                  walkMode={walkMode}
                  onInteract={onInteract}
                  liveMediaByEntityId={liveMediaByEntityId}
                  outlineColor={manifest.home.palette.accent}
                />,
              ];
            }),
          )}
        </>
      )}
    </group>
  );
});

export { PolygonSurface as ArchitecturalFloor, ArchitecturalWall };
