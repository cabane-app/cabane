import { ApartmentFloors } from "./building/ApartmentFloors";
import { createTerrainSurface } from "./terrain/terrain-surface";
import { TerrainSurfaceContext } from "./terrain/TerrainSurface";
import { DioramaGround } from "./architecture-scene/DioramaGround";
import { worldBoundsForFloorScene } from "./pools";
import type { HomeManifest } from "./types";
import { isOutdoorPlatformOutline } from "./outdoor-platforms/platform-geometry";
import { SceneRoomSelection } from "./building/RoomSelectionSurfaces";
import { StairPlan } from "./stairs/models/StairPlan";
import {
  StraightStairModel,
  UShapedStairModel,
  LShapedStairModel,
  SpiralStairModel,
} from "./stairs/models";
import { deriveStairFlight, deriveStairApertures } from "./stairs/flight-geometry";
import { stairFloorIds } from "./stairs/stair-connection";
import { StairSurfaceApertures } from "./stairs/surface-apertures";
import { memo, useMemo } from "react";
import { FloorScene, type FloorSceneProps } from "./building/FloorScene";
import { deriveFloorLevels } from "./building/floor-levels";
import { visibleFloorIds, type FloorView } from "./building/floor-visibility";
import { BuildingRoof } from "./roof";
export { ArchitecturalFloor, ArchitecturalWall } from "./building/FloorScene";

type ArchitectureSceneProps = Omit<
  FloorSceneProps,
  "sourceFloor" | "showGround" | "showCeiling" | "below" | "above" | "platformBelow"
> & {
  selectedRoomId: string | null;
  activeFloorId?: string;
  floorView?: FloorView;
};
export const ArchitectureScene = memo(function ArchitectureScene({
  activeFloorId,
  floorView,
  selectedRoomId,
  ...props
}: ArchitectureSceneProps) {
  const { manifest, walkMode } = props;
  const active =
    activeFloorId ??
    manifest.floors.find((floor) => !floor.belowGround)?.id ??
    manifest.floors[0]?.id;
  const view = walkMode ? "walk" : (floorView ?? "cutaway");
  const visible = new Set(
    visibleFloorIds(
      manifest.floors.map((floor) => floor.id),
      active ?? "",
      view,
    ),
  );
  const terrain = useMemo(
    () =>
      manifest.home.apartmentFloor
        ? null
        : createTerrainSurface(manifest.home.terrain, manifest.floors),
    [manifest.home.terrain, manifest.home.apartmentFloor, manifest.floors],
  );
  if (view === "whole" && !terrain)
    manifest.floors
      .filter((floor) => floor.belowGround)
      .forEach((floor) => visible.delete(floor.id));
  const ground = manifest.floors.find(
    (floor) =>
      !floor.belowGround && (floor.elevationMeters === undefined || floor.elevationMeters === 0),
  );
  const apertureKey = JSON.stringify(deriveStairApertures(manifest));
  const terrainApertureKey = JSON.stringify(
    manifest.stairs
      .filter((stair) => stair.terrain)
      .flatMap((stair) => {
        const flight = deriveStairFlight(manifest, stair);
        return flight ? [flight.footprint] : [];
      }),
  );
  const apertureFloorsKey = JSON.stringify(
    manifest.floors.map(({ id, outdoorPlatforms }) => ({ id, outdoorPlatforms })),
  );
  const aperturesByFloor = useMemo(() => {
    const floors = JSON.parse(apertureFloorsKey) as Pick<
      HomeManifest["floors"][number],
      "id" | "outdoorPlatforms"
    >[];
    const apertures = JSON.parse(apertureKey) as ReturnType<typeof deriveStairApertures>;
    return new Map(
      floors.map((floor) => [
        floor.id,
        {
          terrain: JSON.parse(terrainApertureKey) as import("./types").Polygon[],
          floor: apertures
            .filter((a) => a.floorId === floor.id && a.surface === "floor")
            .map((a) => a.polygon),
          ceiling: [
            ...apertures
              .filter((a) => a.floorId === floor.id && a.surface === "ceiling")
              .map((a) => a.polygon),
            ...(floors[floors.indexOf(floor) + 1]?.outdoorPlatforms ?? [])
              .filter((platform) => isOutdoorPlatformOutline(platform.polygon))
              .map((platform) => platform.polygon),
          ],
        },
      ]),
    );
  }, [apertureKey, apertureFloorsKey, terrainApertureKey]);
  const floorManifests = useMemo(
    () =>
      new Map(
        manifest.floors.map((floor) => [
          floor.id,
          {
            ...manifest,
            sceneItems: manifest.sceneItems.filter((item) => item.floorId === floor.id),
          },
        ]),
      ),
    [manifest],
  );
  const levels = deriveFloorLevels(manifest.floors);
  const apartmentFloor = manifest.home.apartmentFloor ?? 0;
  const lowest = manifest.floors[0];
  const base = levels[0]?.elevationMeters ?? 0;
  const contextBounds = lowest ? worldBoundsForFloorScene(lowest) : null;
  const offset =
    props.interactionMode === "editor" && view !== "plan" && view !== "whole"
      ? -(levels.find((level) => level.floorId === active)?.elevationMeters ?? 0)
      : 0;
  // Unshadowed point lights stay on the viewed storey so fixtures below cannot
  // illuminate the floor above.
  return (
    <SceneRoomSelection.Provider value={selectedRoomId}>
      <TerrainSurfaceContext.Provider value={view === "plan" ? null : terrain}>
        <group name="architecture-scene" position={[0, offset, 0]}>
          {apartmentFloor > 0 && lowest && contextBounds && view !== "plan" && (
            <>
              <ApartmentFloors floor={lowest} count={apartmentFloor} base={base} />
              <group position={[0, base - apartmentFloor * lowest.floorToFloorHeightMeters, 0]}>
                <DioramaGround
                  centerX={contextBounds.centerX}
                  centerZ={contextBounds.centerZ}
                  size={Math.max(contextBounds.width, contextBounds.depth) + 7}
                  color={manifest.home.palette.ground}
                  floor={{ ...lowest, pools: [] }}
                />
              </group>
            </>
          )}
          {(view === "whole" || view === "walk") && <BuildingRoof manifest={manifest} />}
          {manifest.floors.map(
            (floor, index) =>
              visible.has(floor.id) && (
                <group
                  key={floor.id}
                  name={`building-floor-${floor.id}`}
                  position={[0, view === "plan" ? 0 : levels[index].elevationMeters, 0]}
                >
                  <StairSurfaceApertures.Provider value={aperturesByFloor.get(floor.id)!}>
                    <FloorScene
                      {...props}
                      sourceFloor={floor}
                      platformBelow={manifest.floors[index - 1]}
                      sceneLightingEnabled={floor.id === active}
                      below={
                        visible.has(manifest.floors[index - 1]?.id)
                          ? manifest.floors[index - 1]
                          : undefined
                      }
                      above={
                        visible.has(manifest.floors[index + 1]?.id)
                          ? manifest.floors[index + 1]
                          : undefined
                      }
                      showGround={apartmentFloor === 0 && floor === ground && view !== "plan"}
                      showCeiling={view === "walk" || (view === "cutaway" && floor.id !== active)}
                      manifest={floorManifests.get(floor.id)!}
                      interactionMode={floor.id === active ? props.interactionMode : "editor"}
                      onSelectRoom={floor.id === active ? props.onSelectRoom : undefined}
                      onWalkDeviceTargetChange={
                        floor.id === active ? props.onWalkDeviceTargetChange : undefined
                      }
                    />
                  </StairSurfaceApertures.Provider>
                </group>
              ),
          )}
          {manifest.stairs.map((stair) => {
            if (
              view === "plan"
                ? !stairFloorIds(stair).includes(active)
                : !visible.has(stair.terrain ? stair.terrain.floorId : stair.lowerFloorId)
            )
              return null;
            const flight = deriveStairFlight(manifest, stair);
            if (flight && view === "plan")
              return (
                <StairPlan key={stair.id} flight={flight} upper={stair.upperFloorId === active} />
              );
            if (flight?.shape === "spiral")
              return (
                <SpiralStairModel
                  key={stair.id}
                  flight={flight}
                  coordinates={manifest.coordinates}
                  showUpperGuard={Boolean(flight.upperFloorId && visible.has(flight.upperFloorId))}
                />
              );
            if (flight?.shape === "u-shaped")
              return (
                <UShapedStairModel
                  key={stair.id}
                  flight={flight}
                  coordinates={manifest.coordinates}
                  showUpperGuard={Boolean(flight.upperFloorId && visible.has(flight.upperFloorId))}
                />
              );
            if (flight?.shape === "l-shaped")
              return (
                <LShapedStairModel
                  key={stair.id}
                  flight={flight}
                  coordinates={manifest.coordinates}
                  showUpperGuard={Boolean(flight.upperFloorId && visible.has(flight.upperFloorId))}
                />
              );
            return flight ? (
              <StraightStairModel
                key={stair.id}
                flight={flight}
                plan={view === "plan"}
                showUpperGuard={Boolean(flight.upperFloorId && visible.has(flight.upperFloorId))}
              />
            ) : null;
          })}
        </group>
      </TerrainSurfaceContext.Provider>
    </SceneRoomSelection.Provider>
  );
});
