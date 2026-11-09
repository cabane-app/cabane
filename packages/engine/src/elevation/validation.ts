import { WALK_EYE_HEIGHT } from "../navigation/walk-navigation-contract";
import { WALK_HEAD_MARGIN } from "../opening-pose";
import { ceilingHeightAt } from "./ceilings";
import { floorZoneWithinRoom, isFloorZoneOutline } from "../floor-finishes/finish-geometry";
import { platformPolygonsOverlap } from "../outdoor-platforms/platform-geometry";
import type { FloorSpec, ManifestIssue } from "../types";
import { elevationAreas, transitionBands, transitionOutline } from "./surfaces";

export function validateElevationAreas(floor: FloorSpec): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const areas = elevationAreas(floor);
  const add = (id: string, message: string) =>
    issues.push({
      code: "elevation.geometry",
      path: `elevation.${id}`,
      message,
      severity: "fatal",
    });
  for (const area of areas) {
    const settings = area.elevation;
    if (
      !Number.isFinite(settings.offsetMeters) ||
      settings.edges.length !== area.polygon.length ||
      !isFloorZoneOutline(area.polygon)
    ) {
      add(
        area.id,
        "Use a simple footprint, a finite elevation and one transition setting per edge.",
      );
      continue;
    }
    const room = floor.rooms.find((room) => room.id === area.roomId);
    if (room && !floorZoneWithinRoom(area.polygon, room.polygon))
      add(area.id, "Keep the elevation area inside its room.");
    if (
      settings.ceilingHeightMeters !== undefined &&
      (!Number.isFinite(settings.ceilingHeightMeters) ||
        settings.ceilingHeightMeters < WALK_EYE_HEIGHT + WALK_HEAD_MARGIN)
    )
      add(area.id, "Provide at least 1.70 m of headroom.");
    if (
      room &&
      area.polygon.some(
        (point) =>
          ceilingHeightAt(floor, room.id, point) - settings.offsetMeters <
          WALK_EYE_HEIGHT + WALK_HEAD_MARGIN,
      )
    )
      add(
        area.id,
        "The area leaves less than 1.70 m of headroom. Lower the floor or raise its ceiling.",
      );
    const bands = transitionBands(area, floor.coordinates.metersPerPlanUnit);
    for (let i = 0; i < bands.length; i++) {
      if (
        platformPolygonsOverlap(bands[i].polygon, area.polygon) ||
        bands.slice(i + 1).some((band) => platformPolygonsOverlap(bands[i].polygon, band.polygon))
      )
        add(area.id, "The transition folds over itself. Reduce its width.");
    }
    const outer = transitionOutline(area, floor.coordinates.metersPerPlanUnit);
    if (!isFloorZoneOutline(outer) || !floorZoneWithinRoom(area.polygon, outer))
      add(area.id, "Transition widths create a crossing boundary. Reduce their widths.");
    for (const band of transitionBands(area, floor.coordinates.metersPerPlanUnit)) {
      if (!isFloorZoneOutline(band.polygon)) {
        add(area.id, "Transition has no usable area.");
        continue;
      }
      if (room && !floorZoneWithinRoom(band.polygon, room.polygon))
        add(area.id, "Keep indoor transitions inside the room.");
      for (const other of areas) {
        if (other.id === area.id) continue;
        if (
          platformPolygonsOverlap(band.polygon, other.polygon) ||
          transitionBands(other, floor.coordinates.metersPerPlanUnit).some((b) =>
            platformPolygonsOverlap(band.polygon, b.polygon),
          )
        )
          add(area.id, "Transitions cannot overlap another elevation area or transition.");
      }
      if ((floor.pools ?? []).some((pool) => platformPolygonsOverlap(band.polygon, pool.polygon)))
        add(area.id, "Transitions cannot cross pools.");
      if (
        (floor.outdoorPlatforms ?? []).some(
          (platform) =>
            platform.id !== area.id && platformPolygonsOverlap(band.polygon, platform.polygon),
        )
      )
        add(area.id, "Transitions cannot cross another platform.");
      if (!room && floor.rooms.some((room) => platformPolygonsOverlap(band.polygon, room.polygon)))
        add(area.id, "Outdoor transitions cannot cross rooms.");
    }
    for (const other of areas)
      if (area.id < other.id && platformPolygonsOverlap(area.polygon, other.polygon))
        add(area.id, "Elevation areas may share edges but cannot overlap or nest.");
  }
  return issues;
}
