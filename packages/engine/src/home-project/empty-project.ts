import { DEFAULT_TERRAIN_GRASS_COLOR } from "../terrain/terrain-settings";
import { DEFAULT_WALL_COLORS } from "../wall-colors";
import type { HomeProject } from "./types";

export function createEmptyHomeProject(id: string, name: string): HomeProject {
  return {
    schemaVersion: 2,
    seedRevision: "blank-v1",
    home: {
      id,
      name,
      locale: "en",
      palette: {
        accent: "#d48a54",
        secondary: "#758f83",
        exterior: DEFAULT_WALL_COLORS.exterior,
        interior: DEFAULT_WALL_COLORS.interior,
        ground: DEFAULT_TERRAIN_GRASS_COLOR,
      },
    },
    coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
    floors: [
      {
        id: "ground-floor",
        name: "Ground floor",
        floorToFloorHeightMeters: 2.8,
        coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
        defaultWallHeightMeters: 2.4,
        defaultCeilingHeightMeters: 2.4,
        footprint: [],
        rooms: [],
        walls: [],
        wallJunctions: [],
        openings: [],
        ceilings: [],
      },
    ],
    stairs: [],
    sceneItems: [],
    roomProfiles: {},
    openingProfiles: {},
    shortcuts: [],
    assumptions: [],
  };
}

/** An unapplied record has no rendered published home, only this empty shell. */
export function isEmptyPublishedHome(project: HomeProject): boolean {
  return (
    project.floors.length === 1 &&
    project.floors.every(
      (floor) =>
        floor.footprint.length === 0 &&
        floor.rooms.length === 0 &&
        floor.walls.length === 0 &&
        floor.openings.length === 0 &&
        !floor.ceilings?.length &&
        !floor.wallJunctions?.length,
    ) &&
    project.sceneItems.length === 0 &&
    project.stairs.length === 0 &&
    Object.keys(project.roomProfiles).length === 0 &&
    Object.keys(project.openingProfiles).length === 0 &&
    project.shortcuts.length === 0
  );
}
