import { deriveFloorLevels } from "../building/floor-levels";
import {
  openingWorldPlacement,
  planPointToWorld,
  pointInsidePolygon,
  worldPointToPlan,
} from "../geometry";
import { WALK_MAX_STEP_METERS, WALK_PLAYER_RADIUS } from "../navigation/walk-navigation-contract";
import { floorSlabPolygons, floorSupportPolygons } from "../outdoor-platforms/platform-geometry";
import { deriveStairFlight } from "../stairs/flight-geometry";
import { projectStairPath } from "../stairs/path-projection";
import { stairLandingSupported } from "../stairs/stair-clearance";
import type { BuildingGeometry } from "../stairs/types";
import type { ManifestIssue, PlanPoint } from "../types";
import { pointOnPolygonBoundary } from "../validation/geometry";
import { createTerrainSurface } from "./terrain-surface";

const contains = (polygon: readonly PlanPoint[], point: PlanPoint) =>
  pointInsidePolygon(point, polygon) || pointOnPolygonBoundary(point, polygon);

/** A local height advisory, independent of door state, furniture and global room connectivity. */
export function validateTerrainExits(building: BuildingGeometry): ManifestIssue[] {
  if (building.home?.apartmentFloor) return [];
  const ground = building.floors.find((floor) => !floor.belowGround);
  if (!ground || ground.footprint.length < 3) return [];
  const surface = createTerrainSurface(
    building.home?.terrain,
    building.floors.filter((floor) => floor.footprint.length >= 3),
  );
  if (!surface) return [];
  const levels = deriveFloorLevels(building.floors);
  const supports = building.floors.map((floor, index) => ({
    floor,
    elevation: levels[index].elevationMeters,
    polygons: floorSupportPolygons(floor),
  }));
  const flights = building.stairs
    .map((stair) => deriveStairFlight(building, stair))
    .filter((flight) => flight !== null);
  const connectedFlights = flights.filter((flight) =>
    [
      { floorId: flight.lowerFloorId, polygon: flight.lowerLanding },
      { floorId: flight.upperFloorId, polygon: flight.upperLanding },
    ].every(({ floorId, polygon }) => {
      const floor = supports.find((support) => support.floor.id === floorId);
      return floor && stairLandingSupported(polygon, floor.polygons, building.coordinates);
    }),
  );
  const supportedOutside = (point: PlanPoint, floorId: string, elevation: number) => {
    const plan = worldPointToPlan({ x: point[0], z: point[1] }, building.coordinates);
    if (
      supports.some(
        (support) =>
          Math.abs(support.elevation - elevation) <= WALK_MAX_STEP_METERS &&
          support.polygons.some((polygon) => contains(polygon, plan)),
      )
    )
      return true;
    if (
      connectedFlights.some((flight) => {
        if (flight.lowerFloorId !== floorId && flight.upperFloorId !== floorId) return false;
        if (!contains(flight.footprint, plan)) return false;
        const localElevation = elevation - flight.baseElevationMeters;
        const projected = projectStairPath(flight, { x: point[0], z: point[1] }, localElevation);
        return (
          projected &&
          projected.distance <= flight.widthMeters / 2 - WALK_PLAYER_RADIUS &&
          Math.abs(projected.elevation - localElevation) <= WALK_MAX_STEP_METERS
        );
      })
    )
      return true;
    // These holes have no rendered terrain, even if their interpolated grade matches.
    if (
      surface.cutouts.some((polygon) => contains(polygon, plan)) ||
      (ground.pools ?? []).some((pool) => contains(pool.polygon, plan)) ||
      flights.some((flight) => contains(flight.footprint, plan))
    )
      return false;
    // Walk removes the decorative ground skin's -5 cm offset before comparing levels.
    return Math.abs(surface.offsetAt(point[0], point[1]) - elevation) <= WALK_MAX_STEP_METERS;
  };

  const issues: ManifestIssue[] = [];
  building.floors.forEach((floor, floorIndex) => {
    const elevation = levels[floorIndex].elevationMeters;
    const blocked = (
      from: PlanPoint,
      to: PlanPoint,
      clearance: number,
      inside: (point: PlanPoint) => boolean,
    ) => {
      const dx = to[0] - from[0],
        dz = to[1] - from[1],
        length = Math.hypot(dx, dz);
      if (length < WALK_PLAYER_RADIUS * 2) return false;
      const ux = dx / length,
        uz = dz / length;
      const usable = length - WALK_PLAYER_RADIUS * 2;
      const samples = Math.max(1, Math.ceil(usable / WALK_PLAYER_RADIUS));
      let exterior = false;
      for (let i = 0; i <= samples; i++) {
        const distance = WALK_PLAYER_RADIUS + (usable * i) / samples;
        const center: PlanPoint = [from[0] + ux * distance, from[1] + uz * distance];
        const a: PlanPoint = [center[0] - uz * clearance, center[1] + ux * clearance];
        const b: PlanPoint = [center[0] + uz * clearance, center[1] - ux * clearance];
        const aInside = inside(a),
          bInside = inside(b);
        if (aInside === bInside) continue;
        exterior = true;
        let inner = aInside ? a : b,
          outer = aInside ? b : a;
        // Test the support boundary itself. A landing farther from the wall
        // must not hide a gap, nor should a steep grade farther out invent one.
        for (let step = 0; step < 16; step++) {
          const middle: PlanPoint = [(inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2];
          if (inside(middle)) inner = middle;
          else outer = middle;
        }
        if (supportedOutside(outer, floor.id, elevation)) return false;
      }
      return exterior;
    };
    const warn = (path: string) =>
      issues.push({
        code: "terrain.exit-height",
        severity: "warning",
        path,
        message: `This exit on “${floor.name}” has no near-level connection to the ground.`,
      });
    const slabs = floorSlabPolygons(floor);
    const insideFloor = (point: PlanPoint) => {
      const plan = worldPointToPlan({ x: point[0], z: point[1] }, floor.coordinates);
      return slabs.some((polygon) => contains(polygon, plan));
    };
    floor.openings.forEach((opening, index) => {
      if (opening.kind === "window" || opening.sillHeightMeters > WALK_MAX_STEP_METERS) return;
      const wall = floor.walls.find((wall) => wall.id === opening.wallId);
      if (!wall || wall.virtual || wall.classification !== "exterior") return;
      const { start, end } = openingWorldPlacement(wall, opening, floor.coordinates);
      if (blocked(start, end, wall.thicknessMeters / 2 + 0.02, insideFloor))
        warn(`floors[${floorIndex}].openings[${index}]`);
    });
    floor.outdoorPlatforms?.forEach((platform, index) => {
      platform.edges.forEach((edge, edgeIndex) => {
        if ((edge.configuration ?? platform.defaultEdge).kind !== "open") return;
        const from = platform.polygon[edgeIndex],
          to = platform.polygon[(edgeIndex + 1) % platform.polygon.length];
        if (!from || !to) return;
        const insidePlatform = (point: PlanPoint) =>
          contains(
            platform.polygon,
            worldPointToPlan({ x: point[0], z: point[1] }, floor.coordinates),
          );
        if (
          blocked(
            planPointToWorld(from, floor.coordinates),
            planPointToWorld(to, floor.coordinates),
            0.02,
            insidePlatform,
          )
        )
          warn(`floors[${floorIndex}].outdoorPlatforms[${index}].edges[${edgeIndex}]`);
      });
    });
  });
  return issues;
}
