export const FLOOR_PATTERN_PRESET_IDS = [
  "light-oak",
  "light-oak-horizontal",
  "oak-herringbone",
  "travertine",
  "terracotta-tile",
  "terrazzo",
  "dark-walnut",
  "limestone",
  "square-tile",
  "subway-tile",
  "checkerboard-tile",
  "encaustic-tile",
  "black-white-patchwork",
  "blue-quatrefoil-tile",
  "sand",
  "gravel",
  "light-dirt",
  "dark-dirt",
  "pine-bark",
  "tomettes",
  "stepping-stones",
  "pebbles",
] as const;

export type FloorPatternPresetId = (typeof FLOOR_PATTERN_PRESET_IDS)[number];

export type FloorFinishSpec =
  | { kind: "solid"; color: string }
  | { kind: "preset"; preset: FloorPatternPresetId; color?: string }
  | { kind: "grass" };
