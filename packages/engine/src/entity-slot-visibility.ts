import type { EntityBindingSlotSpec, EntityStateSnapshot } from "./types";

/** HA represents boolean and numeric states as strings. */
function isEntityStatePresent(state: EntityStateSnapshot | undefined): boolean {
  if (!state?.available || state.stale) return false;
  const value = state.state.trim().toLowerCase();
  if (!value) return false;
  const number = Number(state.state.trim());
  if (!Number.isNaN(number)) return Number.isFinite(number) && number > 0;
  return ![
    "false",
    "off",
    "closed",
    "not_home",
    "absent",
    "clear",
    "idle",
    "standby",
    "unknown",
    "unavailable",
    "none",
    "null",
    "nan",
  ].includes(value);
}

export function showEntityStateInScene(
  slot: EntityBindingSlotSpec,
  state: EntityStateSnapshot | undefined,
): boolean {
  return (
    slot.presentation.showInScene === true ||
    (slot.presentation.showInScene === "if-present" && isEntityStatePresent(state))
  );
}
