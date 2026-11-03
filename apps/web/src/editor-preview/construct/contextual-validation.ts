import { omitUndefinedProperties } from "@cabane/engine";
import {
  type FloorEditorTool,
  type FloorSpec,
  type ManifestIssue,
  type SceneItemSpec,
  type HomeProject,
} from "@cabane/engine";

export type ConstructValidationIssueSource = "topology" | "project" | "dependency" | "navigation";

export type ConstructValidationTargetKind =
  | "wall"
  | "opening"
  | "niche"
  | "room"
  | "floor-zone"
  | "pool"
  | "outdoor-platform"
  | "ceiling"
  | "junction"
  | "scene-item";

export interface ConstructValidationTarget {
  kind: ConstructValidationTargetKind;
  id: string;
}

/**
 * The common issue shape consumed by the Construct inspector. Producers may
 * already identify a target or suggest a correction; otherwise this module
 * enriches stable architecture paths without coupling validation to the UI.
 */
export interface ConstructValidationDiagnostic extends ManifestIssue {
  target?: ConstructValidationTarget;
  suggestion?: string;
}

export interface ConstructContextualIssue extends ManifestIssue {
  source: ConstructValidationIssueSource;
  floorId?: string;
  target?: ConstructValidationTarget;
  suggestion: string;
}

export interface ConstructContextualValidationInput {
  project?: Pick<HomeProject, "floors" | "sceneItems">;
  floor: Pick<
    FloorSpec,
    | "footprint"
    | "footprintRegions"
    | "walls"
    | "wallJunctions"
    | "openings"
    | "rooms"
    | "ceilings"
    | "pools"
    | "outdoorPlatforms"
    | "groundZones"
  >;
  sceneItems?: readonly Pick<SceneItemSpec, "id" | "modelId" | "placement">[];
  topologyIssues?: readonly ConstructValidationDiagnostic[];
  projectIssues?: readonly ConstructValidationDiagnostic[];
  dependencyIssues?: readonly ConstructValidationDiagnostic[];
  /**
   * Navigation remains a separate derived system. Its diagnostics are passed
   * in through the shared shape so this aggregator never imports navigation.
   */
  navigationIssues?: readonly ConstructValidationDiagnostic[];
}

const collectionTargetKinds = {
  walls: "wall",
  openings: "opening",
  rooms: "room",
  pools: "pool",
  outdoorPlatforms: "outdoor-platform",
  ceilings: "ceiling",
  wallJunctions: "junction",
  sceneItems: "scene-item",
} as const;

type TargetCollectionName = keyof typeof collectionTargetKinds;

const defaultCorrections: Readonly<Record<string, string>> = {
  "terrain.exit-height":
    "Adjust the terrain height or connect this exit with a supported platform or stairs. For a lower-level entrance, add a floor below and place the entrance there. You can save with this warning.",
  "project.model-missing":
    "Update Cabane in HACS, restart Home Assistant, then reload your browser or Companion app. For a custom model, import it again in Arrange → My models.",
  "project.model-lighting-disabled":
    "You can save with this warning. Select the item in Arrange and open Lighting to repair its settings.",
  "project.model-lighting-approximation":
    "You can save with this warning. Select the item in Arrange and open Lighting to adjust its sources or sample counts.",
  "floor-zone.polygon": "Move a corner until the floor area is simple and has visible area.",
  "floor-zone.outside-room": "Move or delete the floor area so it stays inside its room.",
  "ground-zone.inside-footprint": "Move the outdoor area so it stays outside the building.",
  "project.outdoor-placement":
    "Move the outdoor item outside the building, keeping it on the ground.",
  "platform.room-overlap":
    "Move or reshape the platform so its interior stays outside rooms on this level.",
  "platform.polygon": "Move a corner until the platform has a simple, closed outline.",
  "platform.overlap": "Move or reshape the platforms so their interiors do not overlap.",
  "pool.polygon": "Move a corner until the outline no longer crosses itself, or undo the edit.",
  "pool.building-overlap":
    "Move the pool outdoors, leaving room for its 0.25 m rim beside house walls.",
  "pool.overlap": "Move or reshape a pool so their rims do not touch.",
  "topology.walls-required": "Draw at least three walls around a closed room.",
  "topology.wall-id": "Give every wall a unique, non-empty ID.",
  "topology.wall-length": "Move an endpoint or remove the zero-length wall.",
  "topology.wall-overlap": "Move, shorten, or remove one of the overlapping walls.",
  "topology.no-rooms": "Connect the wall endpoints to close a room.",
  "topology.incomplete-shell": "Complete or remove the open wall component.",
  "topology.hole": "Split the layout into supported room faces without an enclosed hole.",
  "topology.room-merge": "Choose the room identity to retain after the merge.",
  "topology.room-name": "Give the room a name before publishing.",
  "topology.opening-wall": "Move the opening onto an existing wall or remove it.",
  "topology.opening-containment": "Move or resize the opening so it fits inside its wall.",
  "topology.opening-split": "Move the opening fully onto one homogeneous wall section.",
  "room.polygon-invalid":
    "Undo the last structural move, or move the crossing corner until the room outline no longer crosses itself.",
  "wall-junction.opening-overlap":
    "Move or resize the opening away from this corner, or move the corner itself.",
  "editor.ceiling-support-missing": "Move the item into a room or restore its ceiling support.",
  "editor.ceiling-support-ambiguous": "Move the item away from the shared room boundary.",
};

const collectionFor = (
  name: TargetCollectionName,
  input: ConstructContextualValidationInput,
): readonly { id: string }[] =>
  name === "sceneItems" ? (input.sceneItems ?? []) : (input.floor[name] ?? []);

const pathReference = (
  path: string,
): { collection: TargetCollectionName; reference: string } | undefined => {
  const collectionNames =
    "walls|wallJunctions|openings|rooms|ceilings|pools|outdoorPlatforms|sceneItems";
  const dottedOrBracketed = path.match(
    new RegExp(
      `(?:^|\\.)(?<collection>${collectionNames})(?:\\[(?<bracket>[^\\]]+)\\]|\\.(?<dotted>[^.\\[]+))`,
    ),
  );
  if (dottedOrBracketed?.groups) {
    return {
      collection: dottedOrBracketed.groups.collection as TargetCollectionName,
      reference: (dottedOrBracketed.groups.bracket ?? dottedOrBracketed.groups.dotted).replace(
        /^["']|["']$/g,
        "",
      ),
    };
  }
  const pointer = path.match(
    new RegExp(`(?:^|/)(?<collection>${collectionNames})/(?<reference>[^/]+)`),
  );
  return pointer?.groups
    ? {
        collection: pointer.groups.collection as TargetCollectionName,
        reference: pointer.groups.reference,
      }
    : undefined;
};

export const constructValidationTargetForPath = (
  path: string,
  input: Pick<ConstructContextualValidationInput, "floor" | "sceneItems">,
): ConstructValidationTarget | undefined => {
  const nicheReference = path.match(/(?:^|\.)walls\[(\d+)\]\.niches\[(\d+)\]/);
  if (nicheReference) {
    const niche = input.floor.walls[Number(nicheReference[1])]?.niches?.[Number(nicheReference[2])];
    if (niche) return { kind: "niche", id: niche.id };
  }
  const zoneReference = path.match(/(?:^|\.)rooms\[(\d+)\]\.floorZones\[(\d+)\]/);
  if (zoneReference) {
    const room = input.floor.rooms[Number(zoneReference[1])];
    const zone = room?.floorZones?.[Number(zoneReference[2])];
    if (zone) return { kind: "floor-zone", id: zone.id };
  }
  const groundZoneReference = path.match(/(?:^|\.)groundZones\[(\d+)\]/);
  if (groundZoneReference) {
    const zone = input.floor.groundZones?.[Number(groundZoneReference[1])];
    if (zone) return { kind: "floor-zone", id: zone.id };
  }
  const reference = pathReference(path);
  if (!reference) return undefined;
  const collection = collectionFor(reference.collection, input);
  const numericIndex = /^(?:0|[1-9]\d*)$/.test(reference.reference)
    ? Number(reference.reference)
    : undefined;
  const item =
    numericIndex === undefined
      ? collection.find((candidate) => candidate.id === reference.reference)
      : collection[numericIndex];
  if (!item) return undefined;
  return { kind: collectionTargetKinds[reference.collection], id: item.id };
};

const severityRank: Readonly<Record<ManifestIssue["severity"], number>> = {
  fatal: 0,
  error: 1,
  warning: 2,
};

const sourceRank: Readonly<Record<ConstructValidationIssueSource, number>> = {
  topology: 0,
  project: 1,
  dependency: 2,
  navigation: 3,
};

const issueKey = (issue: ConstructContextualIssue) =>
  [issue.code, issue.path, issue.message, issue.target?.kind ?? "", issue.target?.id ?? ""].join(
    "\u0000",
  );

const contextualize = (
  issue: ConstructValidationDiagnostic,
  source: ConstructValidationIssueSource,
  input: ConstructContextualValidationInput,
): ConstructContextualIssue => {
  const projectItemIndex = source === "project" ? issue.path.match(/^sceneItems\[(\d+)\]/) : null;
  const projectFloorIndex = source === "project" ? issue.path.match(/^floors\[(\d+)\]/) : null;
  const item = projectItemIndex && input.project?.sceneItems[Number(projectItemIndex[1])];
  const floor = item
    ? input.project?.floors.find((floor) => floor.id === item.floorId)
    : projectFloorIndex
      ? input.project?.floors[Number(projectFloorIndex[1])]
      : undefined;
  const target =
    issue.target ??
    constructValidationTargetForPath(issue.path, {
      floor: floor ?? input.floor,
      sceneItems:
        (projectItemIndex && input.project ? input.project.sceneItems : input.sceneItems) ?? [],
    });
  const floorContext = floor ? { floorId: floor.id } : {};
  // Topology uses stable room IDs; schema validation uses array indices and a
  // generic string error. Normalize that one condition before deduplicating.
  if (
    target?.kind === "room" &&
    (issue.code === "topology.room-name" ||
      issue.code === "room.name" ||
      (issue.code === "project.string" && /(?:\.name|\/name)$/.test(issue.path)))
  ) {
    return {
      ...issue,
      code: "room.name",
      path: `rooms[${JSON.stringify(target.id)}].name`,
      message: "This room needs a name.",
      source,
      ...floorContext,
      target,
      suggestion:
        "Click “Name room” on the plan, or enter a name in the room panel before applying.",
    };
  }
  return omitUndefinedProperties({
    ...issue,
    source,
    ...floorContext,
    target,
    suggestion:
      issue.suggestion ??
      defaultCorrections[issue.code] ??
      (target?.kind === "scene-item"
        ? "Select the item in Arrange to adjust it, reset its placement to the floor, or remove it. You can undo repairs."
        : undefined) ??
      (issue.code.startsWith("stair.") && issue.severity === "warning"
        ? "You can keep this layout and save with warnings."
        : undefined) ??
      "Review the highlighted context and correct this issue before publishing.",
  });
};

const wallCompletionIssueCodes = new Set([
  "topology.walls-required",
  "topology.no-rooms",
  "topology.incomplete-shell",
  "topology.room-name",
  "room.name",
]);

/** An untouched floor is an invitation to draw, not an editing error. */
export const isPristineConstructionFloor = (floor: FloorSpec) =>
  !floor.walls.length &&
  !floor.rooms.length &&
  !floor.footprint.length &&
  !floor.openings.length &&
  !floor.ceilings?.length &&
  !floor.wallJunctions?.length &&
  !floor.pools?.length &&
  !floor.outdoorPlatforms?.length &&
  !floor.groundZones?.length &&
  !floor.hedges?.length;

/** Presentation only: Apply must always use the complete, unfiltered list. */
export const visibleConstructIssues = (
  issues: readonly ConstructContextualIssue[],
  tool: FloorEditorTool | null,
  context?: { floor: FloorSpec; floorIndex: number; hasItems: boolean },
): readonly ConstructContextualIssue[] => {
  const visible = issues.filter((issue) => {
    if (
      tool !== null &&
      context &&
      isPristineConstructionFloor(context.floor) &&
      !context.hasItems
    ) {
      if (issue.code === "topology.walls-required" && issue.source === "topology") return false;
      if (
        issue.code === "project.floor-empty" &&
        issue.path === `floors[${context.floorIndex}].footprint`
      )
        return false;
    }
    return (
      (tool !== "wall" && tool !== "virtual-wall") || !wallCompletionIssueCodes.has(issue.code)
    );
  });
  return visible.length === issues.length ? issues : visible;
};

/**
 * Produces one deterministic, actionable issue list for the current Construct
 * draft. Equivalent room-name issues and exact duplicates from independent
 * validators collapse to the most severe occurrence. Fatal/error issues sort
 * before warnings, then by stable source/path/code order for a non-jumping inspector.
 */
export const collectConstructContextualIssues = (
  input: ConstructContextualValidationInput,
): readonly ConstructContextualIssue[] => {
  const candidates: ConstructContextualIssue[] = [
    ...(input.topologyIssues ?? []).map((issue) => contextualize(issue, "topology", input)),
    ...(input.projectIssues ?? []).map((issue) => contextualize(issue, "project", input)),
    ...(input.dependencyIssues ?? []).map((issue) => contextualize(issue, "dependency", input)),
    ...(input.navigationIssues ?? []).map((issue) => contextualize(issue, "navigation", input)),
  ];
  const unique = new Map<string, ConstructContextualIssue>();
  for (const candidate of candidates) {
    const key = issueKey(candidate);
    const current = unique.get(key);
    if (!current || severityRank[candidate.severity] < severityRank[current.severity]) {
      unique.set(key, candidate);
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      sourceRank[left.source] - sourceRank[right.source] ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
};
