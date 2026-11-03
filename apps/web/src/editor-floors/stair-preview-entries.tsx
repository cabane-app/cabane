import {
  deriveStairFlight,
  StraightStairModel,
  UShapedStairModel,
  LShapedStairModel,
  SpiralStairModel,
  type BuildingGeometry,
  type FloorSpec,
  type StairSpec,
  type StairStyle,
} from "@cabane/engine";
import type { ModelPreviewEntry } from "../editor-preview/furnish/catalog/model-preview-entry";

const coordinates = {
  origin: [0, 0] as const,
  metersPerPlanUnit: 1,
  scaleBasis: "inferred" as const,
};
const floor: FloorSpec = {
  id: "lower",
  name: "Preview",
  coordinates,
  floorToFloorHeightMeters: 3,
  defaultWallHeightMeters: 3,
  defaultCeilingHeightMeters: 3,
  footprint: [],
  rooms: [],
  walls: [],
  openings: [],
  wallJunctions: [],
};
const building: BuildingGeometry = {
  coordinates,
  floors: [floor, { ...floor, id: "upper" }],
  stairs: [],
  sceneItems: [],
};
const connection = {
  id: "preview",
  lowerFloorId: "lower",
  upperFloorId: "upper",
  at: [0, 0] as const,
  rotationYRadians: Math.PI,
};
const presets: { label: string; stair: StairSpec }[] = [
  {
    label: "Straight",
    stair: { ...connection, shape: "straight", widthMeters: 1, runMeters: 4.5 },
  },
  {
    label: "L-shaped",
    stair: {
      ...connection,
      shape: "l-shaped",
      widthMeters: 1,
      lowerRunMeters: 2.25,
      upperRunMeters: 2.25,
      turn: "right",
    },
  },
  {
    label: "U-shaped",
    stair: {
      ...connection,
      shape: "u-shaped",
      widthMeters: 1,
      lowerRunMeters: 2.25,
      upperRunMeters: 2.25,
      turn: "right",
    },
  },
  {
    label: "Spiral",
    stair: {
      ...connection,
      shape: "spiral",
      diameterMeters: 2,
      totalTurnDegrees: 360,
      direction: "clockwise",
    },
  },
];

/** Preview the same procedural geometry used by the building, without aperture guards. */
function previewEntry(label: string, stair: StairSpec, style: StairStyle) {
  stair = { ...stair, style };
  const flight = deriveStairFlight(building, stair)!;
  const points = [...flight.footprintWorld, ...flight.upperLanding];
  const entry: ModelPreviewEntry = {
    key: `stair-preview-v2:${stair.shape}:${style}`,
    kind: "procedural",
    definition: {
      bounds: {
        min: [
          Math.min(...points.map((p) => p[0])) - 0.1,
          -0.1,
          Math.min(...points.map((p) => p[1])) - 0.1,
        ],
        max: [
          Math.max(...points.map((p) => p[0])) + 0.1,
          4.1,
          Math.max(...points.map((p) => p[1])) + 0.1,
        ],
      },
      component: () =>
        stair.shape === "spiral" ? (
          <SpiralStairModel flight={flight} coordinates={coordinates} showUpperGuard={false} />
        ) : stair.shape === "u-shaped" ? (
          <UShapedStairModel flight={flight} coordinates={coordinates} showUpperGuard={false} />
        ) : stair.shape === "l-shaped" ? (
          <LShapedStairModel flight={flight} coordinates={coordinates} showUpperGuard={false} />
        ) : (
          <StraightStairModel flight={flight} showUpperGuard={false} />
        ),
    },
  };
  return { shape: stair.shape!, label, entry };
}
const previews = {
  open: presets.map(({ label, stair }) => previewEntry(label, stair, "open")),
  concrete: presets.map(({ label, stair }) => previewEntry(label, stair, "concrete")),
  stone: presets.map(({ label, stair }) => previewEntry(label, stair, "stone")),
};
export const stairPreviewEntriesForStyle = (style: StairStyle) => previews[style];
