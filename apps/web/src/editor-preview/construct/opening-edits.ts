import {
  editorWallAttachments,
  availableOpeningOffsetRanges,
  nearestAvailableOpeningOffset,
} from "@cabane/engine";
import type {
  ConstructEditorAction,
  ConstructEditorController,
} from "./construct-controller-contract";

/** Shared ID-addressable opening edits and the selection adapters used by Properties. */
export function openingEdits(
  draft: ConstructEditorController["draft"],
  dispatch: (action: ConstructEditorAction) => void,
  reportError: (message: string | null) => void,
): Pick<
  ConstructEditorController,
  | "updateOpening"
  | "resizeOpening"
  | "updateSelectedOpening"
  | "replaceSelectedOpening"
  | "resizeSelectedOpening"
> {
  const updateOpening: ConstructEditorController["updateOpening"] = (opening) => {
    const existing = editorWallAttachments(draft).find((candidate) => candidate.id === opening.id);
    const wall = draft.walls.find((candidate) => candidate.id === opening.wallId);
    const fits = availableOpeningOffsetRanges({
      draft,
      wallId: opening.wallId,
      widthPlanUnits: opening.widthPlanUnits,
      sillHeightMeters: opening.sillHeightMeters,
      excludeOpeningId: opening.id,
    }).some(({ min, max }) => opening.offsetPlanUnits >= min && opening.offsetPlanUnits <= max);
    if (
      !existing ||
      existing.kind !== opening.kind ||
      !fits ||
      !wall ||
      opening.openingHeightMeters + opening.sillHeightMeters >
        (wall.heightMeters ?? draft.defaultWallHeightMeters) -
          (opening.kind === "niche" ? 0.002 : 0)
    ) {
      reportError(
        "This opening does not fit here. Choose a smaller size or another wall position.",
      );
      return false;
    }
    reportError(null);
    dispatch({ type: "update-opening", opening });
    return true;
  };
  const resizeOpening: ConstructEditorController["resizeOpening"] = (
    openingId,
    offsetPlanUnits,
    widthPlanUnits,
  ) => {
    const opening = editorWallAttachments(draft).find((candidate) => candidate.id === openingId);
    if (!opening) return false;
    const offset = nearestAvailableOpeningOffset(
      offsetPlanUnits,
      availableOpeningOffsetRanges({
        draft,
        wallId: opening.wallId,
        widthPlanUnits,
        sillHeightMeters: opening.sillHeightMeters,
        excludeOpeningId: opening.id,
      }),
    );
    return (
      offset !== undefined && updateOpening({ ...opening, widthPlanUnits, offsetPlanUnits: offset })
    );
  };
  return {
    updateOpening,
    resizeOpening,
    updateSelectedOpening: (patch) => {
      const selection = draft.selection;
      const opening =
        selection?.kind === "opening"
          ? editorWallAttachments(draft).find((candidate) => candidate.id === selection.id)
          : undefined;
      if (!opening) return;
      const updated = { ...opening, ...patch };
      const offsetPlanUnits = nearestAvailableOpeningOffset(
        updated.offsetPlanUnits,
        availableOpeningOffsetRanges({
          draft,
          wallId: updated.wallId,
          widthPlanUnits: updated.widthPlanUnits,
          sillHeightMeters: updated.sillHeightMeters,
          excludeOpeningId: updated.id,
        }),
      );
      updateOpening({ ...updated, offsetPlanUnits: offsetPlanUnits ?? updated.offsetPlanUnits });
    },
    replaceSelectedOpening: updateOpening,
    resizeSelectedOpening: (offsetPlanUnits, widthPlanUnits) => {
      if (draft.selection?.kind === "opening")
        resizeOpening(draft.selection.id, offsetPlanUnits, widthPlanUnits);
    },
  };
}
