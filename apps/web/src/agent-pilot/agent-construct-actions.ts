import { editorWallAttachments, type HedgeSpec } from "@cabane/engine";
import type { ConstructEditorController } from "../editor-preview/construct/construct-controller-contract";
import {
  object,
  string,
  number,
  boolean,
  oneOf,
  color,
  point,
  polygon,
  finish,
  edge,
  roomPatch,
  wallPatch,
  hedge,
  platformPatch,
  doorConfiguration,
  opening,
  settings,
  targets,
} from "./agent-construct-inputs";

/** Decode wire input only. Geometry, defaults, identity and history belong to the UI controller. */
export function executeConstructAction(
  editor: ConstructEditorController,
  action: Record<string, unknown>,
): void {
  const id = (key: string) => string(action[key], key);
  const openingFor = (key: string) => {
    const openingId = id(key);
    const item = editorWallAttachments(editor.draft).find((item) => item.id === openingId);
    if (!item) throw new Error(`Opening ${openingId} was not found.`);
    return item;
  };
  switch (action.type) {
    case "add-wall":
      editor.addWallSegment(point(action.from, "from"), point(action.to, "to"), {
        ...(action.exteriorColor === undefined
          ? {}
          : { exteriorColor: color(action.exteriorColor, "exteriorColor") }),
        ...(action.virtual === undefined ? {} : { virtual: boolean(action.virtual, "virtual") }),
      });
      return;
    case "move-wall-endpoint":
      editor.updateWallEndpoint(
        id("wallId"),
        oneOf(action.endpoint, "endpoint", ["from", "to"]),
        point(action.point, "point"),
      );
      return;
    case "translate-wall":
      editor.translateWall(id("wallId"), point(action.delta, "delta"));
      return;
    case "update-wall-metadata":
      editor.updateWallMetadata(id("wallId"), wallPatch(action.changes));
      return;
    case "delete-elements":
      editor.deleteElements(targets(action.targets));
      return;
    case "add-opening": {
      const accepted = editor.placeOpening(
        oneOf(action.kind, "kind", ["door", "window", "passage", "niche"]),
        id("wallId"),
        number(action.offsetPlanUnits, "offsetPlanUnits", 0),
        action.side === undefined ? undefined : oneOf(action.side, "side", ["left", "right"]),
        action.doorConfiguration === undefined
          ? undefined
          : doorConfiguration(action.doorConfiguration),
      );
      if (!accepted) throw new Error("This opening does not fit on this wall.");
      return;
    }
    case "move-opening":
      editor.moveOpening(
        openingFor("openingId").id,
        id("wallId"),
        number(action.offsetPlanUnits, "offsetPlanUnits", 0),
      );
      return;
    case "resize-opening": {
      const item = openingFor("openingId");
      if (
        !editor.resizeOpening(
          item.id,
          action.offsetPlanUnits === undefined
            ? item.offsetPlanUnits
            : number(action.offsetPlanUnits, "offsetPlanUnits", 0),
          number(action.widthPlanUnits, "widthPlanUnits", Number.MIN_VALUE),
        )
      )
        throw new Error("This opening does not fit at that size.");
      return;
    }
    case "update-opening":
      if (!editor.updateOpening(opening(action.opening)))
        throw new Error("This opening does not fit here.");
      return;
    case "duplicate-opening":
      if (!editor.duplicateOpening(openingFor("openingId").id))
        throw new Error("There is no room to duplicate this opening.");
      return;
    case "reorient-opening":
      editor.reorientOpening(
        openingFor("openingId").id,
        oneOf(action.change, "change", ["hinge", "side", "slide"]),
      );
      return;
    case "update-room-metadata":
      editor.updateRoom(id("roomId"), roomPatch(action.changes));
      return;
    case "resolve-room-merge":
      editor.resolveRoomMerge(id("survivorId"), id("roomId"));
      return;
    case "paint-room-floor":
      editor.paintRoomFloor(
        id("roomId"),
        finish(action.finish),
        boolean(action.clearZones, "clearZones"),
      );
      return;
    case "add-hedge":
      editor.addHedge(hedge(action.hedge, false) as Omit<HedgeSpec, "id">);
      return;
    case "update-hedge":
      editor.updateHedge(id("id"), hedge(action.changes, true));
      return;
    case "add-pool":
      editor.addPool(polygon(action.polygon, "polygon"));
      return;
    case "update-pool":
      editor.updatePool(id("poolId"), polygon(action.polygon, "polygon"));
      return;
    case "add-outdoor-platform":
      editor.addPlatform(
        polygon(action.polygon, "polygon"),
        finish(action.finish),
        edge(action.defaultEdge),
      );
      return;
    case "update-outdoor-platform":
      editor.updatePlatform(id("id"), platformPatch(action.changes));
      return;
    case "add-floor-zone":
      editor.addFloorZone(id("roomId"), polygon(action.polygon, "polygon"), finish(action.finish));
      return;
    case "add-ground-zone":
      editor.addGroundZone(polygon(action.polygon, "polygon"), finish(action.finish));
      return;
    case "update-floor-zone": {
      const input = object(action.changes, "changes", ["polygon", "finish"]);
      editor.updateFloorZone(id("zoneId"), {
        ...(input.polygon === undefined
          ? {}
          : { polygon: polygon(input.polygon, "changes.polygon") }),
        ...(input.finish === undefined ? {} : { finish: finish(input.finish) }),
      });
      return;
    }
    case "update-floor-settings":
      editor.updateFloorSettings(settings(action.settings));
      return;
    case "set-floor-name":
      editor.setFloorName(id("name"));
      return;
    default:
      throw new Error(`Unsupported Construct action: ${String(action.type)}.`);
  }
}
