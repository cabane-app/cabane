import {
  addBottomFloor,
  addTopFloor,
  floorRemovalDisabledReason,
  parseHomeProjectSchema,
  pointOnFloorSupport,
  removeFloor,
  renameFloor,
  setFloorHeight,
  type EditorWorkspaceSnapshot,
  type HomeProject,
  type StairSpec,
} from "@cabane/engine";

export type EditorProjectAction =
  | { type: "add-floor-above" | "add-floor-below"; id: string; sourceFloorId?: string }
  | { type: "rename-floor"; floorId: string; name: string; heightMeters?: number }
  | { type: "set-floor-height"; floorId: string; heightMeters: number }
  | { type: "remove-floor"; floorId: string }
  | {
      type: "update-home-settings";
      changes: Partial<
        Pick<HomeProject["home"], "roof" | "northAngleDegrees" | "apartmentFloor" | "terrain">
      >;
    }
  | { type: "set-walk-start"; walkStart: HomeProject["home"]["walkStart"] | null }
  | { type: "add-stair" | "update-stair"; stair: StairSpec }
  | { type: "delete-stair"; stairId: string };

/** Durable project edits shared by editor controls and external command adapters. */
export function editProject(snapshot: EditorWorkspaceSnapshot, action: EditorProjectAction) {
  let next = snapshot;
  switch (action.type) {
    case "add-floor-above":
    case "add-floor-below": {
      if (snapshot.project.floors.some((floor) => floor.id === action.id))
        throw new Error(`Floor ${action.id} already exists.`);
      const options = action.sourceFloorId ? { sourceFloorId: action.sourceFloorId } : undefined;
      next = (action.type === "add-floor-above" ? addTopFloor : addBottomFloor)(
        snapshot,
        action.id,
        options,
      );
      break;
    }
    case "rename-floor":
    case "set-floor-height":
    case "remove-floor": {
      if (!snapshot.project.floors.some((floor) => floor.id === action.floorId))
        throw new Error(`Floor ${action.floorId} was not found.`);
      if (action.type === "remove-floor") {
        const reason = floorRemovalDisabledReason(snapshot.project.floors, action.floorId);
        if (reason) throw new Error(reason);
        next = removeFloor(snapshot, action.floorId);
      } else {
        if (action.type === "rename-floor") {
          if (!action.name.trim()) throw new Error("Floor name is required.");
          next = renameFloor(snapshot, action.floorId, action.name.trim());
        }
        if (action.heightMeters !== undefined) {
          if (!Number.isFinite(action.heightMeters) || action.heightMeters <= 0)
            throw new Error("Floor height must be a positive finite number.");
          next = setFloorHeight(next, action.floorId, action.heightMeters);
        }
      }
      break;
    }
    case "update-home-settings":
      next = {
        ...snapshot,
        project: { ...snapshot.project, home: { ...snapshot.project.home, ...action.changes } },
      };
      break;
    case "set-walk-start": {
      const { walkStart: _previous, ...home } = snapshot.project.home;
      next = {
        ...snapshot,
        project: {
          ...snapshot.project,
          home: { ...home, ...(action.walkStart ? { walkStart: action.walkStart } : {}) },
        },
      };
      break;
    }
    case "add-stair":
    case "update-stair":
    case "delete-stair": {
      const id = action.type === "delete-stair" ? action.stairId : action.stair.id;
      const exists = snapshot.project.stairs.some((stair) => stair.id === id);
      if (action.type === "add-stair" ? exists : !exists)
        throw new Error(`Stair ${id} ${exists ? "already exists" : "was not found"}.`);
      const stairs =
        action.type === "delete-stair"
          ? snapshot.project.stairs.filter((stair) => stair.id !== id)
          : action.type === "add-stair"
            ? [...snapshot.project.stairs, action.stair]
            : snapshot.project.stairs.map((stair) => (stair.id === id ? action.stair : stair));
      next = { ...snapshot, project: { ...snapshot.project, stairs } };
      break;
    }
  }
  const schema = parseHomeProjectSchema(next.project);
  if (!schema.valid) throw new Error(schema.issues.map((issue) => issue.message).join(" "));
  if (action.type === "set-walk-start" && action.walkStart) {
    const floor = next.project.floors.find((floor) => floor.id === action.walkStart!.floorId);
    if (!floor || !pointOnFloorSupport(action.walkStart.at, floor))
      throw new Error("Choose a walking start point inside a floor.");
  }
  return next;
}
