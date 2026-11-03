import { isPoolOutline } from "../../pools/pool-footprint";
import { unusedElementSerial } from "./editor-element-identity";
import type { FloorEditorDraft, FloorEditorAction } from "./draft-contract";

export function reducePoolEdit(
  draft: FloorEditorDraft,
  action: Extract<FloorEditorAction, { type: "add-pool" | "update-pool" | "configure-pool" }>,
): FloorEditorDraft {
  switch (action.type) {
    case "add-pool": {
      if (!isPoolOutline(action.polygon)) return draft;
      const serial = unusedElementSerial(draft, "pool");
      return {
        ...draft,
        pools: [
          ...(draft.pools ?? []),
          { id: `${draft.floorId}:pool-${serial}`, polygon: action.polygon, ...action.settings },
        ],
        selection: null,
        nextSerial: serial + 1,
      };
    }
    case "configure-pool": {
      const current = draft.pools?.find((pool) => pool.id === action.poolId);
      if (
        !current ||
        ((current.type ?? "in-ground") === action.poolType &&
          (current.heightMeters ?? 1.5) === action.heightMeters)
      )
        return draft;
      if (
        !["in-ground", "above-ground-wood"].includes(action.poolType) ||
        !Number.isFinite(action.heightMeters) ||
        action.heightMeters < 0.3 ||
        action.heightMeters > 5
      )
        return draft;
      return {
        ...draft,
        pools: (draft.pools ?? []).map((pool) =>
          pool.id === action.poolId
            ? { ...pool, type: action.poolType, heightMeters: action.heightMeters }
            : pool,
        ),
      };
    }
    case "update-pool": {
      const current = draft.pools?.find((pool) => pool.id === action.poolId);
      // Finite but invalid outlines remain editable/recoverable; publication validates them.
      if (
        !current ||
        action.polygon.length !== current.polygon.length ||
        !action.polygon.every((point) => point.length === 2 && point.every(Number.isFinite)) ||
        current.polygon.every(
          (point, index) =>
            Math.hypot(point[0] - action.polygon[index][0], point[1] - action.polygon[index][1]) <=
            1e-7,
        )
      )
        return draft;
      return {
        ...draft,
        pools: draft.pools!.map((pool) =>
          pool.id === action.poolId ? { ...pool, polygon: action.polygon } : pool,
        ),
      };
    }
  }
}
