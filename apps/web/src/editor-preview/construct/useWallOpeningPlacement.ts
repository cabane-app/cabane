import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  availableOpeningOffsetRanges,
  nearestAvailableOpeningOffset,
  nicheDepthLimit,
  type FloorEditorDraft,
  type DoorConfiguration,
} from "@cabane/engine";
import { openingToolDimensions } from "./opening-placement-preview";
import type { ConstructEditorAction } from "./construct-controller-contract";

export function useWallOpeningPlacement(
  draft: FloorEditorDraft,
  doorConfiguration: DoorConfiguration,
  dispatch: Dispatch<ConstructEditorAction>,
  setOpeningError: Dispatch<SetStateAction<string | null>>,
) {
  const addOpening = useCallback(
    (kind: "door" | "window" | "passage" | "niche") => {
      const selection = draft.selection;
      if (selection?.kind !== "wall") return;
      const wall = draft.walls.find((candidate) => candidate.id === selection.id);
      if (!wall) return;
      const {
        widthPlanUnits: width,
        sillHeightMeters,
        openingHeightMeters,
      } = openingToolDimensions(kind, doorConfiguration, draft.coordinates.metersPerPlanUnit);
      const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
      const offsetPlanUnits = nearestAvailableOpeningOffset(
        Math.max(0, (length - width) / 2),
        availableOpeningOffsetRanges({
          draft,
          wallId: wall.id,
          widthPlanUnits: width,
          sillHeightMeters,
          kind,
        }),
      );
      if (
        offsetPlanUnits === undefined ||
        (kind === "niche" && nicheDepthLimit(draft, wall.id) < 0.01) ||
        openingHeightMeters + sillHeightMeters >
          (wall.heightMeters ?? draft.defaultWallHeightMeters) - (kind === "niche" ? 0.002 : 0)
      ) {
        setOpeningError("This opening does not fit on this wall.");
        return;
      }
      dispatch({
        type: "add-opening",
        wallId: wall.id,
        kind,
        doorConfiguration,
        offsetPlanUnits,
      });
    },
    [draft, doorConfiguration, dispatch, setOpeningError],
  );
  const placeOpening = useCallback(
    (
      kind: "door" | "window" | "passage" | "niche",
      wallId: string,
      offsetPlanUnits: number,
      side?: "left" | "right",
      configuration = doorConfiguration,
    ) => {
      const { widthPlanUnits, sillHeightMeters, openingHeightMeters } = openingToolDimensions(
        kind,
        configuration,
        draft.coordinates.metersPerPlanUnit,
      );
      const valid = availableOpeningOffsetRanges({
        draft,
        wallId,
        widthPlanUnits,
        sillHeightMeters,
        kind,
      }).some((range) => offsetPlanUnits >= range.min && offsetPlanUnits <= range.max);
      const wall = draft.walls.find((wall) => wall.id === wallId);
      if (
        !valid ||
        (kind === "niche" && nicheDepthLimit(draft, wallId) < 0.01) ||
        openingHeightMeters + sillHeightMeters >
          (wall?.heightMeters ?? draft.defaultWallHeightMeters) - (kind === "niche" ? 0.002 : 0)
      ) {
        setOpeningError("This opening does not fit on this wall.");
        return false;
      }
      setOpeningError(null);
      // Placement is single-shot: return to Select while preserving the new
      // opening selection created by the semantic add action.
      dispatch({ type: "set-tool", tool: "select" });
      dispatch({
        type: "add-opening",
        wallId,
        kind,
        offsetPlanUnits,
        doorConfiguration: configuration,
        ...(side ? { side } : {}),
      });
      return true;
    },
    [draft, doorConfiguration, dispatch, setOpeningError],
  );
  return { addOpening, placeOpening };
}
