import { DEFAULT_TERRAIN_GRASS_COLOR } from "./terrain/terrain-settings";
import { DEFAULT_WALL_COLORS } from "./wall-colors";
import { defineHomeManifest } from "./validation";

export const neutralDemoManifest = defineHomeManifest({
  schemaVersion: 1,
  home: {
    id: "neutral-demo",
    name: "Cabane",
    locale: "en",
    palette: {
      accent: "#e6764e",
      secondary: "#7ca39a",
      exterior: DEFAULT_WALL_COLORS.exterior,
      interior: DEFAULT_WALL_COLORS.interior,
      ground: DEFAULT_TERRAIN_GRASS_COLOR,
    },
  },
  floors: [
    {
      id: "demo-floor",
      name: "Demo floor",
      coordinates: {
        origin: [0, 0],
        metersPerPlanUnit: 1,
        scaleBasis: "measured",
      },
      defaultWallHeightMeters: 2.55,
      defaultCeilingHeightMeters: 2.55,
      footprint: [
        [0, 0],
        [4.8, 0],
        [4.8, 3.6],
        [0, 3.6],
      ],
      rooms: [
        {
          id: "demo-room",
          name: "Demo room",
          polygon: [
            [0.12, 0.12],
            [4.68, 0.12],
            [4.68, 3.48],
            [0.12, 3.48],
          ],
          accent: "#f2c7a7",
          dashboardSlots: [],
          devices: [],
        },
      ],
      walls: [
        {
          id: "north-wall",
          from: [0, 0],
          to: [4.8, 0],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "east-wall",
          from: [4.8, 0],
          to: [4.8, 3.6],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "south-wall",
          from: [4.8, 3.6],
          to: [0, 3.6],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "west-wall",
          from: [0, 3.6],
          to: [0, 0],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
      ],
      wallJunctions: [
        { id: "north-west-junction", at: [0, 0], wallIds: ["north-wall", "west-wall"] },
        { id: "north-east-junction", at: [4.8, 0], wallIds: ["north-wall", "east-wall"] },
        { id: "south-east-junction", at: [4.8, 3.6], wallIds: ["east-wall", "south-wall"] },
        { id: "south-west-junction", at: [0, 3.6], wallIds: ["south-wall", "west-wall"] },
      ],
      openings: [
        {
          id: "demo-door",
          wallId: "south-wall",
          kind: "door",
          offsetFromWallStartPlanUnits: 0.7,
          widthPlanUnits: 0.92,
          openingHeightMeters: 2.12,
          sillHeightMeters: 0,
          operation: "hinged",
          variant: "panel",
          finish: "wood",
          leafCount: 1,
        },
        {
          id: "demo-window",
          wallId: "north-wall",
          kind: "window",
          offsetFromWallStartPlanUnits: 1.45,
          widthPlanUnits: 1.9,
          openingHeightMeters: 1.25,
          sillHeightMeters: 0.82,
          operation: "casement",
          variant: "plain",
          panelCount: 1,
          glazing: "clear",
        },
      ],
      ceilings: [
        {
          id: "demo-ceiling",
          kind: "flat",
          roomIds: ["demo-room"],
          heightMeters: 2.55,
        },
      ],
    },
  ],
  sceneItems: [],
  shortcuts: [
    { id: "home", action: "home-view", context: "both", order: 0 },
    { id: "construct", action: "construct-mode", context: "overview", order: 1 },
    { id: "arrange", action: "arrange-mode", context: "overview", order: 2 },
    { id: "connect", action: "connect-mode", context: "overview", order: 3 },
    { id: "walk", action: "walk-mode", context: "both", order: 4 },
    { id: "light", action: "lighting-mode", context: "both", order: 5 },
    { id: "fade", action: "wall-fade", context: "both", order: 6 },
    { id: "all-lights", action: "all-lights", context: "both", order: 7 },
  ],
  extensions: {
    furnishingModels: {},
    roomFurnishings: {},
    deviceModels: {},
    openingModels: {},
  },
  assumptions: [
    {
      id: "demo-scale",
      subjectId: "demo-floor",
      summary: "The neutral demonstration room uses measured metre coordinates.",
      basis: "measured",
    },
  ],
});
