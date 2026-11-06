/* Browser draft-persistence concepts were reviewed against ai_room_planner
 * (MIT); record formats and validation are original to Cabane. */
import type { FloorCoordinates, FloorSpec } from "../types";
import {
  createFloorEditorDraft,
  FLOOR_EDITOR_DRAFT_VERSION,
  type FloorEditorDraft,
} from "../home-editor/construct/editor-state";
import { validateLayoutFloorSpec } from "../home-editor/construct/layout-validation";
import { isObject, isPolygon } from "../validation/core";
import { ceilingSchema } from "./schema-ceiling";
import type { HomeProjectIssue } from "./validation-types";

export const FLOOR_LAYOUT_ACTIVE_STORAGE_PREFIX = "cabane:floor-layout:v1:active";
export const FLOOR_LAYOUT_DRAFT_STORAGE_PREFIX = "cabane:floor-layout:v1:draft";
export const LEGACY_FLOOR_LAYOUT_ACTIVE_STORAGE_PREFIX = "smart-home-3d:floor-layout:v1:active";
export const LEGACY_FLOOR_LAYOUT_DRAFT_STORAGE_PREFIX = "smart-home-3d:floor-layout:v1:draft";

export const activeFloorLayoutStorageKey = (homeId: string) =>
  `${FLOOR_LAYOUT_ACTIVE_STORAGE_PREFIX}:${homeId}`;
export const draftFloorLayoutStorageKey = (homeId: string) =>
  `${FLOOR_LAYOUT_DRAFT_STORAGE_PREFIX}:${homeId}`;
export const legacyActiveFloorLayoutStorageKey = (homeId: string) =>
  `${LEGACY_FLOOR_LAYOUT_ACTIVE_STORAGE_PREFIX}:${homeId}`;
export const legacyDraftFloorLayoutStorageKey = (homeId: string) =>
  `${LEGACY_FLOOR_LAYOUT_DRAFT_STORAGE_PREFIX}:${homeId}`;

const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
};

export const exportFloorSpec = (floor: FloorSpec) =>
  `${JSON.stringify(sortJson(floor), null, 2)}\n`;

export const importFloorSpec = (json: string) => {
  try {
    return validateLayoutFloorSpec(JSON.parse(json));
  } catch {
    return {
      valid: false as const,
      issues: [
        {
          code: "layout.json",
          path: "$",
          message: "The selected floor plan is not valid JSON.",
          severity: "fatal" as const,
        },
      ],
    };
  }
};

export type ActiveFloorLayoutLoadResult =
  | { status: "missing" }
  | { status: "valid"; floor: FloorSpec; raw: string }
  | { status: "corrupt"; raw: string; reason: string };

export const loadActiveFloorLayout = (
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
  homeId: string,
): ActiveFloorLayoutLoadResult => {
  let raw: string | null;
  let legacy = false;
  try {
    raw = storage.getItem(activeFloorLayoutStorageKey(homeId));
    if (raw === null) {
      raw = storage.getItem(legacyActiveFloorLayoutStorageKey(homeId));
      legacy = raw !== null;
    }
  } catch (error) {
    return {
      status: "corrupt",
      raw: "",
      reason: error instanceof Error ? error.message : "Browser storage is unavailable.",
    };
  }
  if (raw === null) return { status: "missing" };
  const result = importFloorSpec(raw);
  if (result.valid && result.floor) {
    if (legacy)
      storage.setItem?.(activeFloorLayoutStorageKey(homeId), exportFloorSpec(result.floor));
    return { status: "valid", floor: result.floor, raw };
  }
  return {
    status: "corrupt",
    raw,
    reason: result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n"),
  };
};

export const saveActiveFloorLayout = (
  storage: Pick<Storage, "getItem" | "setItem">,
  homeId: string,
  floor: FloorSpec,
) => {
  const validated = validateLayoutFloorSpec(floor);
  if (!validated.valid || !validated.floor)
    throw new Error(validated.issues.map((entry) => entry.message).join(" "));
  const json = exportFloorSpec(validated.floor);
  storage.setItem(activeFloorLayoutStorageKey(homeId), json);
  const reread = storage.getItem(activeFloorLayoutStorageKey(homeId));
  if (reread === null) throw new Error("The browser did not retain the floor plan.");
  const verification = importFloorSpec(reread);
  if (!verification.valid || !verification.floor)
    throw new Error("The saved floor plan failed verification.");
  return verification.floor;
};

const isDraftSlopedCeiling = (value: unknown) => {
  if (!isObject(value) || value.kind !== "sloped") return false;
  const issues: HomeProjectIssue[] = [];
  ceilingSchema(value, "$", issues);
  return issues.length === 0;
};

export const isFloorEditorDraft = (value: unknown): value is FloorEditorDraft => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const coordinates = record.coordinates;
  return (
    record.version === FLOOR_EDITOR_DRAFT_VERSION &&
    (record.slopedCeilings === undefined ||
      (Array.isArray(record.slopedCeilings) &&
        record.slopedCeilings.every(isDraftSlopedCeiling))) &&
    (record.pools === undefined ||
      (Array.isArray(record.pools) &&
        record.pools.every(
          (pool) => isObject(pool) && typeof pool.id === "string" && isPolygon(pool.polygon),
        ))) &&
    (record.groundZones === undefined ||
      (Array.isArray(record.groundZones) &&
        record.groundZones.every(
          (zone) =>
            isObject(zone) &&
            typeof zone.id === "string" &&
            isPolygon(zone.polygon) &&
            isObject(zone.finish),
        ))) &&
    typeof record.floorId === "string" &&
    Array.isArray(record.walls) &&
    Array.isArray(record.openings) &&
    Array.isArray(record.rooms) &&
    Boolean(
      coordinates &&
      typeof coordinates === "object" &&
      !Array.isArray(coordinates) &&
      Array.isArray((coordinates as Record<string, unknown>).origin) &&
      ((coordinates as Record<string, unknown>).origin as unknown[]).length === 2 &&
      ((coordinates as Record<string, unknown>).origin as unknown[]).every(
        (entry) => typeof entry === "number" && Number.isFinite(entry),
      ) &&
      typeof (coordinates as Record<string, unknown>).metersPerPlanUnit === "number" &&
      Number.isFinite((coordinates as Record<string, unknown>).metersPerPlanUnit) &&
      ((coordinates as Record<string, unknown>).metersPerPlanUnit as number) > 0 &&
      ["measured", "inferred"].includes(
        String((coordinates as Record<string, unknown>).scaleBasis),
      ),
    )
  );
};

const cloneCoordinates = (coordinates: FloorCoordinates): FloorCoordinates => ({
  origin: [...coordinates.origin],
  metersPerPlanUnit: coordinates.metersPerPlanUnit,
  scaleBasis: coordinates.scaleBasis,
});

export const parseFloorLayoutDraft = (
  raw: string,
  floorId: string,
  fallbackCoordinates?: FloorCoordinates,
) => {
  try {
    const value: unknown = JSON.parse(raw);
    if (isFloorEditorDraft(value)) return value.floorId === floorId ? value : null;
    if (!fallbackCoordinates || !value || typeof value !== "object" || Array.isArray(value))
      return null;
    const legacy = value as Record<string, unknown>;
    if (
      legacy.version !== FLOOR_EDITOR_DRAFT_VERSION ||
      legacy.floorId !== floorId ||
      !Array.isArray(legacy.walls) ||
      !Array.isArray(legacy.openings) ||
      !Array.isArray(legacy.rooms)
    )
      return null;
    const migrated = { ...legacy, coordinates: cloneCoordinates(fallbackCoordinates) };
    return isFloorEditorDraft(migrated) ? migrated : null;
  } catch {
    return null;
  }
};

export const saveFloorLayoutDraft = (
  storage: Pick<Storage, "setItem">,
  homeId: string,
  draft: FloorEditorDraft,
) => storage.setItem(draftFloorLayoutStorageKey(homeId), JSON.stringify(draft));

export const loadFloorLayoutDraft = (
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
  homeId: string,
  fallback: FloorSpec,
) => {
  try {
    const key = draftFloorLayoutStorageKey(homeId);
    const current = storage.getItem(key);
    const raw = current ?? storage.getItem(legacyDraftFloorLayoutStorageKey(homeId));
    if (!raw) return createFloorEditorDraft(fallback);
    const draft = parseFloorLayoutDraft(raw, fallback.id, fallback.coordinates);
    if (!draft) return createFloorEditorDraft(fallback);
    if (current === null) storage.setItem?.(key, JSON.stringify(draft));
    return draft;
  } catch {
    return createFloorEditorDraft(fallback);
  }
};

export const clearFloorLayoutStorage = (storage: Pick<Storage, "removeItem">, homeId: string) => {
  storage.removeItem(activeFloorLayoutStorageKey(homeId));
  storage.removeItem(draftFloorLayoutStorageKey(homeId));
};

export const downloadTextFile = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
