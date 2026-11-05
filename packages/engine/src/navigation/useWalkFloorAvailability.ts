import { useMemo } from "react";
import { safeBuildingSpawn } from "../stairs/stair-navigation";
import type { BuildingGeometry } from "../stairs/types";

/** Collision inputs only: room/device states and embedded wall images cannot
 * change a safe entry and must not turn crosshair updates into spawn searches. */
function availabilityKey(building: BuildingGeometry) {
  return JSON.stringify({
    coordinates: building.coordinates,
    home: building.home
      ? { terrain: building.home.terrain, apartmentFloor: building.home.apartmentFloor }
      : undefined,
    floors: building.floors.map((floor) => ({
      id: floor.id,
      floorToFloorHeightMeters: floor.floorToFloorHeightMeters,
      elevationMeters: "elevationMeters" in floor ? floor.elevationMeters : undefined,
      belowGround: floor.belowGround,
      coordinates: floor.coordinates,
      defaultWallHeightMeters: floor.defaultWallHeightMeters,
      defaultCeilingHeightMeters: floor.defaultCeilingHeightMeters,
      footprint: floor.footprint,
      footprintRegions: floor.footprintRegions,
      rooms: floor.rooms.map(({ id, polygon, isSolid }) => ({ id, polygon, isSolid })),
      solidRooms: floor.solidRooms?.map(({ id, polygon, isSolid }) => ({ id, polygon, isSolid })),
      walls: floor.walls.map(
        ({ id, from, to, classification, thicknessMeters, heightMeters, virtual }) => ({
          id,
          from,
          to,
          classification,
          thicknessMeters,
          heightMeters,
          virtual,
        }),
      ),
      wallJunctions: floor.wallJunctions,
      openings: floor.openings.map((opening) => ({
        id: opening.id,
        wallId: opening.wallId,
        kind: opening.kind,
        operation: "operation" in opening ? opening.operation : undefined,
        offsetFromWallStartPlanUnits: opening.offsetFromWallStartPlanUnits,
        widthPlanUnits: opening.widthPlanUnits,
        openingHeightMeters: opening.openingHeightMeters,
        sillHeightMeters: opening.sillHeightMeters,
      })),
      ceilings: floor.ceilings,
      hedges: floor.hedges,
      pools: floor.pools,
      outdoorPlatforms: floor.outdoorPlatforms?.map(
        ({ id, polygon, useAsRoom, defaultEdge, edges }) => ({
          id,
          polygon,
          useAsRoom,
          defaultEdge,
          edges,
        }),
      ),
      groundZones: floor.groundZones?.map(({ id, polygon }) => ({ id, polygon })),
    })),
    stairs: building.stairs,
    sceneItems: building.sceneItems.map(({ id, floorId, kind, modelId, size, placement }) => ({
      id,
      floorId,
      kind,
      modelId,
      size,
      placement,
    })),
  });
}

export function useWalkFloorAvailability(building: BuildingGeometry, active: boolean) {
  const key = active ? availabilityKey(building) : null;
  return useMemo(
    () =>
      key === null
        ? undefined
        : Object.fromEntries(
            building.floors
              .filter((floor) => !safeBuildingSpawn(building, floor.id))
              .map((floor) => [floor.id, "No clear walking entry"]),
          ),
    // The content key detects in-place geometry edits and preserves identical
    // physics across freshly composed manifests and unrelated UI rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}
