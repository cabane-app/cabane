import type { FloorEditorAction, FloorEditorDraft } from "./draft-contract";
import { unusedElementSerial } from "./editor-element-identity";
import { samePoint } from "./topology-plan-math";

/** Physical and invisible walls share identity, selection and history semantics. */
export function addEditorWall(
  draft: FloorEditorDraft,
  action: Extract<FloorEditorAction, { type: "add-wall" }>,
): FloorEditorDraft {
  if (samePoint(action.from, action.to)) return draft;
  const serial = unusedElementSerial(draft, "wall");
  const id = `${draft.floorId}:wall-${serial}`;
  return {
    ...draft,
    walls: [
      ...draft.walls,
      {
        id,
        from: action.from,
        to: action.to,
        ...(action.exteriorColor ? { exteriorColor: action.exteriorColor } : {}),
        ...(action.virtual ? { virtual: true } : {}),
      },
    ],
    selection: { kind: "wall", id },
    nextSerial: serial + 1,
  };
}
