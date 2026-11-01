export type AgentActionDomain =
  "construct" | "floor" | "arrange" | "connection" | "lifecycle" | "history";

export type AgentActionDescriptor = {
  type: string;
  domain: AgentActionDomain;
  description: string;
  input: string;
};

const constructAction = (
  type: string,
  description: string,
  input: string,
): AgentActionDescriptor => ({
  type,
  domain: "construct",
  description,
  input: `floorId?: string; ${input}`,
});

const floorAction = (type: string, description: string, input: string): AgentActionDescriptor => ({
  type,
  domain: "floor",
  description,
  input,
});

const arrangeAction = (
  type: string,
  description: string,
  input: string,
): AgentActionDescriptor => ({
  type,
  domain: "arrange",
  description,
  input: `floorId?: string; ${input}`,
});

export const AGENT_READ_METHODS = [
  "inspect_workspace",
  "get_draft_diff",
  "validate_draft",
  "list_catalog",
  "list_binding_slots",
] as const;

export const AGENT_ACTIONS = [
  constructAction(
    "add-wall",
    "Add a wall to a floor plan.",
    "from: PlanPoint; to: PlanPoint; exteriorColor?: string; virtual?: boolean",
  ),
  constructAction(
    "move-wall-endpoint",
    "Move one endpoint of an existing wall.",
    'wallId: string; endpoint: "from" | "to"; point: PlanPoint',
  ),
  constructAction(
    "translate-wall",
    "Translate an existing wall by a plan delta.",
    "wallId: string; delta: PlanPoint",
  ),
  constructAction(
    "update-wall-metadata",
    "Update wall thickness, height, colors or niches.",
    "wallId: string; changes: WallMetadataPatch",
  ),
  constructAction(
    "delete-elements",
    "Delete durable construction elements.",
    "targets: FloorEditorSelectionTarget[]",
  ),
  constructAction(
    "add-opening",
    "Add a door, window, passage or niche to a wall.",
    'wallId: string; kind: "door" | "window" | "passage" | "niche"; offsetPlanUnits: number; side?: "left" | "right"; doorConfiguration?: DoorConfiguration',
  ),
  constructAction(
    "move-opening",
    "Move an opening to another wall offset.",
    "openingId: string; wallId: string; offsetPlanUnits: number",
  ),
  constructAction(
    "resize-opening",
    "Resize an existing opening.",
    "openingId: string; widthPlanUnits: number; offsetPlanUnits?: number",
  ),
  constructAction(
    "update-opening",
    "Replace the editable fields of an opening.",
    "opening: EditorWallAttachment",
  ),
  constructAction(
    "duplicate-opening",
    "Duplicate a door, window, passage or niche where it fits.",
    "openingId: string",
  ),
  constructAction(
    "reorient-opening",
    "Switch a supported opening hinge, wall face or slide direction.",
    'openingId: string; change: "hinge" | "side" | "slide"',
  ),
  constructAction(
    "update-room-metadata",
    "Update metadata for a room.",
    "roomId: string; changes: RoomMetadataPatch",
  ),
  constructAction(
    "resolve-room-merge",
    "Choose the saved room identity to retain after joining rooms.",
    "roomId: string; survivorId: string",
  ),
  constructAction(
    "paint-room-floor",
    "Paint a whole room, explicitly keeping or clearing existing finish zones.",
    "roomId: string; finish: FloorFinishSpec; clearZones: boolean",
  ),
  constructAction("add-hedge", "Add a hedge to the floor plan.", 'hedge: Omit<HedgeSpec, "id">'),
  constructAction(
    "update-hedge",
    "Update an existing hedge.",
    'id: string; changes: Partial<Omit<HedgeSpec, "id">>',
  ),
  constructAction("add-pool", "Add a pool polygon.", "polygon: Polygon"),
  constructAction(
    "update-pool",
    "Replace an existing pool polygon.",
    "poolId: string; polygon: Polygon",
  ),
  constructAction(
    "add-outdoor-platform",
    "Add an outdoor platform polygon.",
    "polygon: Polygon; finish: FloorFinishSpec; defaultEdge: OutdoorPlatformEdgeConfiguration",
  ),
  constructAction(
    "update-outdoor-platform",
    "Update an existing outdoor platform.",
    'id: string; changes: Partial<Omit<OutdoorPlatformSpec, "id">>',
  ),
  constructAction(
    "add-floor-zone",
    "Add a finish zone inside a room.",
    "roomId: string; polygon: Polygon; finish: FloorFinishSpec",
  ),
  constructAction(
    "add-ground-zone",
    "Add a ground finish zone.",
    "polygon: Polygon; finish: FloorFinishSpec",
  ),
  constructAction(
    "update-floor-zone",
    "Update an existing floor finish zone.",
    "zoneId: string; changes: FloorZonePatch",
  ),
  constructAction(
    "update-floor-settings",
    "Update floor coordinates and default heights.",
    "settings: FloorEditorFloorSettings",
  ),
  constructAction(
    "set-floor-name",
    "Rename the active floor in the construction editor.",
    "name: string",
  ),
  floorAction(
    "add-floor-above",
    "Add a floor above the active stack.",
    "id: string; sourceFloorId?: string",
  ),
  floorAction(
    "add-floor-below",
    "Add a floor below the active stack.",
    "id: string; sourceFloorId?: string",
  ),
  floorAction("rename-floor", "Rename a floor.", "name: string; floorId?: string"),
  floorAction(
    "set-floor-height",
    "Set the floor-to-floor height in metres.",
    "heightMeters: number; floorId?: string",
  ),
  floorAction("remove-floor", "Remove a floor when the engine allows it.", "floorId?: string"),
  floorAction(
    "update-home-settings",
    "Update roof, north or apartment floor settings.",
    "changes: {roof?: RoofSpec; northAngleDegrees?: number; apartmentFloor?: number}",
  ),
  floorAction(
    "set-walk-start",
    "Set or clear the walking start point.",
    "walkStart: {floorId: string; at: PlanPoint} | null",
  ),
  floorAction("add-stair", "Add stairs between floors.", "stair: StairSpec"),
  floorAction("update-stair", "Edit existing stairs.", "stair: StairSpec"),
  floorAction("delete-stair", "Delete stairs.", "stairId: string"),
  arrangeAction(
    "update-item-placements",
    "Move, rotate or elevate multiple items together.",
    "placements: Record<string, ItemPlacement>",
  ),
  arrangeAction("group-items", "Group items on the active floor.", "itemIds: string[]"),
  arrangeAction("ungroup-items", "Ungroup items on the active floor.", "itemIds: string[]"),
  arrangeAction("rename-group", "Rename a saved item group.", "groupId: string; name: string"),
  arrangeAction(
    "transform-group",
    "Move, rotate or elevate a saved group.",
    'groupId: string; placement: Extract<ItemPlacement, {kind: "absolute"}>',
  ),
  arrangeAction("duplicate-items", "Duplicate multiple items or groups.", "itemIds: string[]"),
  arrangeAction("delete-items", "Delete multiple items or groups.", "itemIds: string[]"),
  arrangeAction(
    "repair-item-placement",
    "Reset an invalid placement using the Issues repair action.",
    "itemId: string",
  ),
  arrangeAction(
    "add-item",
    "Add a catalog item, including custom project-local models.",
    "modelId: string; at?: PlanPoint; placement?: ItemPlacement",
  ),
  arrangeAction(
    "update-item",
    "Update a placed furnishing or device.",
    'itemId: string; patch: {placement?: ItemPlacement; size?: [number, number, number]; variant?: string; color?: string | null; lightState?: "always-off" | "always-on" | "night-only" | "connected"; entitySlots?: EntityBindingSlotSpec[]}',
  ),
  arrangeAction("duplicate-item", "Duplicate a placed furnishing or device.", "itemId: string"),
  arrangeAction("delete-item", "Delete a placed furnishing or device.", "itemId: string"),
  arrangeAction(
    "update-model-lighting",
    "Edit shared lighting for every copy of a model, disable it with null, or reset native defaults.",
    "modelId: string; light?: CustomModelLight | null; reset?: boolean",
  ),
  arrangeAction(
    "update-custom-model",
    "Edit an existing personal model and update all its copies using the model editor's normal save flow.",
    "modelId: string; changes: { name?: string; placement?: CustomModelPlacement; profile?: CustomModelProfile; normalization?: CustomModelNormalization; light?: CustomModelLight | null }",
  ),
  arrangeAction(
    "rename-custom-model",
    "Rename an existing personal model.",
    "modelId: string; name: string",
  ),
  arrangeAction("remove-custom-model", "Remove an unused personal model.", "modelId: string"),
  {
    type: "select-floor",
    domain: "lifecycle",
    description: "Select a floor before a floor-specific action.",
    input: "floorId: string",
  },
  {
    type: "apply-binding",
    domain: "connection",
    description: "Map or clear a Home Assistant entity slot after list_binding_slots.",
    input: "slotId: string; entityId: EntityId | null",
  },
  {
    type: "apply-room-mapping",
    domain: "connection",
    description: "Map or clear a Cabane room to a Home Assistant area.",
    input:
      "roomId: string; areaId: string | null; confirmClearedSlots?: boolean (required to confirm clearing dependent entity slots)",
  },
  {
    type: "discard-draft",
    domain: "lifecycle",
    description: "Restore the published project and bindings over the current draft.",
    input: "{}",
  },
  {
    type: "publish-draft",
    domain: "lifecycle",
    description: "Validate, save and publish the current draft.",
    input: "{}",
  },
  {
    type: "rename-room",
    domain: "lifecycle",
    description: "Rename a room on the selected floor.",
    input: "roomId: string; name: string; floorId?: string",
  },
  { type: "undo", domain: "history", description: "Undo the latest project edit.", input: "{}" },
  {
    type: "redo",
    domain: "history",
    description: "Redo the latest undone project edit.",
    input: "{}",
  },
] as const satisfies readonly AgentActionDescriptor[];

export const AGENT_CONSTRUCT_ACTIONS = new Set(
  AGENT_ACTIONS.filter((action) => action.domain === "construct").map((action) => action.type),
);
export const AGENT_FLOOR_ACTIONS = new Set(
  AGENT_ACTIONS.filter((action) => action.domain === "floor").map((action) => action.type),
);
export const AGENT_ARRANGE_ACTIONS = new Set(
  AGENT_ACTIONS.filter((action) => action.domain === "arrange").map((action) => action.type),
);

export const AGENT_CAPABILITIES = [
  "get_capabilities",
  ...AGENT_READ_METHODS,
  "execute_action",
  ...AGENT_ACTIONS.map((action) => action.type),
] as const;
