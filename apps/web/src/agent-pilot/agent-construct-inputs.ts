import {
  FLOOR_PATTERN_PRESET_IDS,
  type DoorConfiguration,
  type EditorWallAttachment,
  type FloorEditorFloorSettings,
  type FloorEditorSelectionTarget,
  type FloorFinishSpec,
  type FloorFinishZoneSpec,
  type HedgeSpec,
  type OutdoorPlatformEdgeConfiguration,
  type OutdoorPlatformSpec,
  type PlanPoint,
  type Polygon,
} from "@cabane/engine";
import type { ConstructEditorController } from "../editor-preview/construct/construct-controller-contract";

export function object(value: unknown, name: string, allowed: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object.`);
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result))
    if (!allowed.includes(key)) throw new Error(`${name}.${key} is not supported.`);
  return result;
}

export function string(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} must be a non-empty string.`);
  return value;
}

export function number(value: unknown, name: string, minimum = -Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    throw new Error(
      `${name} must be a finite number${minimum === -Infinity ? "" : ` >= ${minimum}`}.`,
    );
  return value;
}

export function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean.`);
  return value;
}

export function oneOf<const T extends string>(
  value: unknown,
  name: string,
  options: readonly T[],
): T {
  if (typeof value !== "string" || !options.includes(value as T))
    throw new Error(`${name} must be one of ${options.join(", ")}.`);
  return value as T;
}

export function color(value: unknown, name: string) {
  const result = string(value, name);
  if (!/^#[0-9a-f]{6}$/i.test(result)) throw new Error(`${name} must be a six-digit hex color.`);
  return result;
}

export function point(value: unknown, name: string): PlanPoint {
  if (!Array.isArray(value) || value.length !== 2)
    throw new Error(`${name} must contain two numbers.`);
  return [number(value[0], name), number(value[1], name)];
}

export function polygon(value: unknown, name: string): Polygon {
  if (!Array.isArray(value) || value.length < 3)
    throw new Error(`${name} needs at least three points.`);
  return [
    point(value[0], `${name}[0]`),
    point(value[1], `${name}[1]`),
    point(value[2], `${name}[2]`),
    ...value.slice(3).map((entry, index) => point(entry, `${name}[${index + 3}]`)),
  ];
}

export function finish(value: unknown): FloorFinishSpec {
  const input = object(value, "finish", ["kind", "color", "preset"]);
  if (input.kind === "solid") {
    if (input.preset !== undefined) throw new Error("Solid finishes do not have a preset.");
    return { kind: "solid", color: color(input.color, "finish.color") };
  }
  if (input.kind !== "preset") throw new Error("finish.kind must be solid or preset.");
  return {
    kind: "preset",
    preset: oneOf(input.preset, "finish.preset", FLOOR_PATTERN_PRESET_IDS),
    ...(input.color === undefined ? {} : { color: color(input.color, "finish.color") }),
  };
}

export function edge(value: unknown): OutdoorPlatformEdgeConfiguration {
  const input = object(value, "edge", ["kind", "heightMeters"]);
  const kind = oneOf(input.kind, "edge.kind", ["open", "railing", "low-wall"]);
  if (kind === "open") {
    if (input.heightMeters !== undefined) throw new Error("Open edges do not have a height.");
    return { kind };
  }
  return { kind, heightMeters: number(input.heightMeters, "edge.heightMeters", Number.MIN_VALUE) };
}

function floorZones(value: unknown): FloorFinishZoneSpec[] {
  if (!Array.isArray(value)) throw new Error("floorZones must be an array.");
  return value.map((entry) => {
    const input = object(entry, "floorZone", ["id", "polygon", "finish"]);
    return {
      id: string(input.id, "floorZone.id"),
      polygon: polygon(input.polygon, "floorZone.polygon"),
      finish: finish(input.finish),
    };
  });
}

export function roomPatch(value: unknown): Parameters<ConstructEditorController["updateRoom"]>[1] {
  const input = object(value, "changes", [
    "name",
    "accent",
    "floorFinish",
    "floorZones",
    "ceilingHeightMeters",
    "isSolid",
  ]);
  const result: Parameters<ConstructEditorController["updateRoom"]>[1] = {};
  if (input.name !== undefined) result.name = string(input.name, "changes.name");
  if (input.accent !== undefined) result.accent = color(input.accent, "changes.accent");
  if (input.floorFinish !== undefined) result.floorFinish = finish(input.floorFinish);
  if (input.floorZones !== undefined) result.floorZones = floorZones(input.floorZones);
  if (input.ceilingHeightMeters !== undefined)
    result.ceilingHeightMeters = number(
      input.ceilingHeightMeters,
      "changes.ceilingHeightMeters",
      Number.MIN_VALUE,
    );
  if (input.isSolid !== undefined) result.isSolid = boolean(input.isSolid, "changes.isSolid");
  return result;
}

function shelfFields(input: Record<string, unknown>) {
  if (input.shelfHeightsMeters !== undefined) {
    if (!Array.isArray(input.shelfHeightsMeters))
      throw new Error("shelfHeightsMeters must be an array.");
    input.shelfHeightsMeters.forEach((height) => number(height, "shelfHeightsMeters", 0));
  }
  if (input.shelfThicknessMeters !== undefined)
    number(input.shelfThicknessMeters, "shelfThicknessMeters", Number.MIN_VALUE);
}

export function wallPatch(
  value: unknown,
): Parameters<ConstructEditorController["updateWallMetadata"]>[1] {
  const input = object(value, "changes", [
    "thicknessMeters",
    "heightMeters",
    "exteriorColor",
    "edgeColor",
    "faceColors",
    "niches",
  ]);
  for (const key of ["thicknessMeters", "heightMeters"])
    if (input[key] !== undefined) number(input[key], `changes.${key}`, Number.MIN_VALUE);
  for (const key of ["exteriorColor", "edgeColor"])
    if (input[key] !== undefined) color(input[key], `changes.${key}`);
  if (input.faceColors !== undefined) {
    const colors = object(input.faceColors, "faceColors", ["left", "right"]);
    for (const key of ["left", "right"])
      if (colors[key] !== undefined) color(colors[key], `faceColors.${key}`);
  }
  if (input.niches !== undefined) {
    if (!Array.isArray(input.niches)) throw new Error("niches must be an array.");
    for (const entry of input.niches) {
      const niche = object(entry, "niche", [
        "id",
        "side",
        "offsetFromWallStartPlanUnits",
        "widthPlanUnits",
        "bottomMeters",
        "heightMeters",
        "depthMeters",
        "shelfHeightsMeters",
        "shelfThicknessMeters",
      ]);
      string(niche.id, "niche.id");
      oneOf(niche.side, "niche.side", ["left", "right"]);
      for (const key of ["offsetFromWallStartPlanUnits", "bottomMeters"])
        number(niche[key], `niche.${key}`, 0);
      for (const key of ["widthPlanUnits", "heightMeters", "depthMeters"])
        number(niche[key], `niche.${key}`, Number.MIN_VALUE);
      shelfFields(niche);
    }
  }
  return input as Parameters<ConstructEditorController["updateWallMetadata"]>[1];
}

export function hedge(value: unknown, partial: boolean): Partial<Omit<HedgeSpec, "id">> {
  const input = object(value, "hedge", ["from", "to", "style", "heightMeters", "widthMeters"]);
  for (const key of ["from", "to"])
    if (!partial || input[key] !== undefined) point(input[key], `hedge.${key}`);
  for (const key of ["heightMeters", "widthMeters"])
    if (!partial || input[key] !== undefined) number(input[key], `hedge.${key}`, Number.MIN_VALUE);
  if (!partial || input.style !== undefined)
    oneOf(input.style, "hedge.style", [
      "clipped",
      "rounded",
      "bushy",
      "mixed",
      "ivy-wall",
      "picket",
      "privacy",
      "post-rail",
      "metal-bars",
      "masonry",
    ]);
  return input as Partial<Omit<HedgeSpec, "id">>;
}

export function platformPatch(value: unknown): Partial<Omit<OutdoorPlatformSpec, "id">> {
  const input = object(value, "changes", [
    "polygon",
    "finish",
    "defaultEdge",
    "edges",
    "useAsRoom",
    "roomName",
  ]);
  if (input.polygon !== undefined) polygon(input.polygon, "changes.polygon");
  if (input.finish !== undefined) finish(input.finish);
  if (input.defaultEdge !== undefined) edge(input.defaultEdge);
  if (input.useAsRoom !== undefined) boolean(input.useAsRoom, "changes.useAsRoom");
  if (input.roomName !== undefined) string(input.roomName, "changes.roomName");
  if (input.edges !== undefined) {
    if (!Array.isArray(input.edges)) throw new Error("changes.edges must be an array.");
    for (const entry of input.edges) {
      const value = object(entry, "edge", ["id", "configuration"]);
      string(value.id, "edge.id");
      if (value.configuration !== undefined) edge(value.configuration);
    }
  }
  return input as Partial<Omit<OutdoorPlatformSpec, "id">>;
}

function doorDesign(input: Record<string, unknown>) {
  const operation = oneOf(input.operation, "operation", ["hinged", "sliding", "roll-up"]);
  oneOf(input.finish, "finish", ["wood", "white"]);
  if (operation === "roll-up") {
    oneOf(input.variant, "variant", ["slatted"]);
    if (
      input.leafCount !== undefined ||
      input.hingeSide !== undefined ||
      input.slideDirection !== undefined
    )
      throw new Error("Roll-up doors do not have leaves, hinges or a slide direction.");
  } else {
    oneOf(input.variant, "variant", [
      "panel",
      "panel-white-lever",
      "french",
      "full-glass",
      "steel-arched",
      "concealed",
      "flush-knob",
      "flush",
      "plank",
    ]);
    if (input.leafCount !== 1 && input.leafCount !== 2)
      throw new Error("leafCount must be 1 or 2.");
    if (operation === "hinged" && input.slideDirection !== undefined)
      throw new Error("Hinged doors do not have a slide direction.");
    if (operation === "sliding" && input.hingeSide !== undefined)
      throw new Error("Sliding doors do not have a hinge side.");
  }
  if (input.hingeSide !== undefined) oneOf(input.hingeSide, "hingeSide", ["start", "end"]);
  if (input.slideDirection !== undefined)
    oneOf(input.slideDirection, "slideDirection", ["start", "end"]);
  if (input.openingSide !== undefined) oneOf(input.openingSide, "openingSide", ["left", "right"]);
  if (input.frontSide !== undefined) oneOf(input.frontSide, "frontSide", ["left", "right"]);
  if (input.frontOverlayMeters !== undefined)
    number(input.frontOverlayMeters, "frontOverlayMeters", 0);
  if (input.color !== undefined) color(input.color, "color");
}

const doorFields = [
  "operation",
  "variant",
  "finish",
  "leafCount",
  "hingeSide",
  "slideDirection",
  "openingSide",
  "frontSide",
  "frontOverlayMeters",
  "color",
];

export function doorConfiguration(value: unknown): DoorConfiguration {
  const input = object(value, "doorConfiguration", [
    "kind",
    "widthMeters",
    "heightMeters",
    ...doorFields,
  ]);
  oneOf(input.kind, "doorConfiguration.kind", ["door"]);
  number(input.widthMeters, "doorConfiguration.widthMeters", Number.MIN_VALUE);
  number(input.heightMeters, "doorConfiguration.heightMeters", Number.MIN_VALUE);
  doorDesign(input);
  return input as DoorConfiguration;
}

export function opening(value: unknown): EditorWallAttachment {
  const base = [
    "kind",
    "id",
    "wallId",
    "offsetPlanUnits",
    "widthPlanUnits",
    "openingHeightMeters",
    "sillHeightMeters",
  ];
  const input = object(value, "opening", [
    ...base,
    ...doorFields,
    "panelCount",
    "glazing",
    "muntins",
    "archRiseMeters",
    "side",
    "depthMeters",
    "shelfHeightsMeters",
    "shelfThicknessMeters",
  ]);
  const kind = oneOf(input.kind, "opening.kind", ["door", "window", "passage", "niche"]);
  string(input.id, "opening.id");
  string(input.wallId, "opening.wallId");
  number(input.offsetPlanUnits, "opening.offsetPlanUnits", 0);
  number(input.widthPlanUnits, "opening.widthPlanUnits", Number.MIN_VALUE);
  number(input.openingHeightMeters, "opening.openingHeightMeters", Number.MIN_VALUE);
  number(input.sillHeightMeters, "opening.sillHeightMeters", 0);
  if (kind === "door") {
    object(input, "opening", [...base, ...doorFields]);
    doorDesign(input);
  } else if (kind === "window") {
    object(input, "opening", [
      ...base,
      "color",
      "operation",
      "variant",
      "panelCount",
      "glazing",
      "muntins",
      "hingeSide",
      "openingSide",
    ]);
    oneOf(input.operation, "opening.operation", ["fixed", "casement"]);
    oneOf(input.variant, "opening.variant", ["plain", "muntined", "steel-arched"]);
    oneOf(input.glazing, "opening.glazing", ["clear", "privacy"]);
    if (input.panelCount !== 1 && input.panelCount !== 2)
      throw new Error("panelCount must be 1 or 2.");
    if (input.color !== undefined) color(input.color, "opening.color");
    if (input.hingeSide !== undefined) oneOf(input.hingeSide, "hingeSide", ["start", "end"]);
    if (input.openingSide !== undefined) oneOf(input.openingSide, "openingSide", ["left", "right"]);
    if (input.muntins !== undefined) {
      const muntins = object(input.muntins, "muntins", ["columns", "rows"]);
      for (const key of ["columns", "rows"])
        if (!Number.isInteger(number(muntins[key], `muntins.${key}`, 1)))
          throw new Error(`muntins.${key} must be an integer.`);
    }
  } else if (kind === "passage") {
    object(input, "opening", [...base, "variant", "archRiseMeters"]);
    oneOf(input.variant, "opening.variant", ["rectangular", "arched"]);
    if (input.variant === "arched")
      number(input.archRiseMeters, "opening.archRiseMeters", Number.MIN_VALUE);
    else if (input.archRiseMeters !== undefined)
      throw new Error("Rectangular passages do not have an arch rise.");
  } else {
    object(input, "opening", [
      ...base,
      "side",
      "depthMeters",
      "shelfHeightsMeters",
      "shelfThicknessMeters",
    ]);
    oneOf(input.side, "opening.side", ["left", "right"]);
    number(input.depthMeters, "opening.depthMeters", Number.MIN_VALUE);
    shelfFields(input);
  }
  return input as EditorWallAttachment;
}

export function settings(value: unknown): FloorEditorFloorSettings {
  const input = object(value, "settings", [
    "coordinates",
    "defaultWallHeightMeters",
    "defaultCeilingHeightMeters",
  ]);
  const coordinates = object(input.coordinates, "coordinates", [
    "origin",
    "metersPerPlanUnit",
    "scaleBasis",
  ]);
  return {
    coordinates: {
      origin: point(coordinates.origin, "coordinates.origin"),
      metersPerPlanUnit: number(
        coordinates.metersPerPlanUnit,
        "coordinates.metersPerPlanUnit",
        Number.MIN_VALUE,
      ),
      scaleBasis: oneOf(coordinates.scaleBasis, "coordinates.scaleBasis", ["measured", "inferred"]),
    },
    defaultWallHeightMeters: number(
      input.defaultWallHeightMeters,
      "settings.defaultWallHeightMeters",
      Number.MIN_VALUE,
    ),
    defaultCeilingHeightMeters: number(
      input.defaultCeilingHeightMeters,
      "settings.defaultCeilingHeightMeters",
      Number.MIN_VALUE,
    ),
  };
}

export function targets(value: unknown): FloorEditorSelectionTarget[] {
  if (!Array.isArray(value) || !value.length) throw new Error("targets must be a non-empty array.");
  return value.map((entry) => {
    const input = object(entry, "target", ["kind", "id"]);
    return {
      kind: oneOf(input.kind, "target.kind", [
        "wall",
        "opening",
        "room",
        "hedge",
        "pool",
        "outdoor-platform",
        "floor-zone",
      ]),
      id: string(input.id, "target.id"),
    };
  });
}
