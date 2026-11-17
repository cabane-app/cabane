import {
  collectBindingSlots,
  normalizeBindingOrigin,
  validateRuntimeBindingProfile,
} from "../runtime-binding-profile";
import type { HomeBindingManifest, RuntimeBindingProfile } from "../types";
import type { HomeProjectIssue } from "./validation";
import { isPlainRecord } from "./validation-types";
import { retainRoomDashboards } from "../room-dashboards/room-dashboard";

export interface WorkspaceBindingState {
  draft: RuntimeBindingProfile;
  published: RuntimeBindingProfile;
  manualRoomIds: readonly string[];
  manualSlotIds: readonly string[];
}

/** Browser-private Home Assistant mappings, keyed by their canonical origin. */
export type WorkspaceBindings = Readonly<Record<string, WorkspaceBindingState>>;

const PROFILE_KEYS = new Set([
  "roomDashboards",
  "weatherSource",
  "schemaVersion",
  "homeId",
  "roomAreaIds",
  "entityIdsBySlotId",
  "actionEntityIdsByShortcutId",
]);
const STATE_KEYS = new Set(["draft", "published", "manualRoomIds", "manualSlotIds"]);

const clone = <T>(value: T): T => structuredClone(value);

const issue = (code: string, path: string, message: string): HomeProjectIssue => ({
  code,
  path,
  message,
  severity: "error",
});

const normalizeOrigin = (origin: string): string => {
  if (typeof origin !== "string") throw new TypeError("A Home Assistant origin must be a string.");
  const parsed = new URL(origin);
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new TypeError("A Home Assistant origin must be an http(s) origin without credentials.");
  }
  return normalizeBindingOrigin(origin);
};

/** Validates and canonicalizes an origin used as a private bindings key. */
export const normalizeWorkspaceBindingOrigin = (origin: string): string => normalizeOrigin(origin);

const profileIssues = (
  input: unknown,
  manifest: HomeBindingManifest,
  path: string,
): HomeProjectIssue[] => {
  const issues: HomeProjectIssue[] = [];
  if (!isPlainRecord(input)) {
    return [
      issue(
        "workspace-bindings.profile-type",
        path,
        "A binding profile must be a plain JSON object.",
      ),
    ];
  }
  for (const key of Object.keys(input)) {
    if (!PROFILE_KEYS.has(key)) {
      issues.push(
        issue(
          "workspace-bindings.profile-key",
          `${path}.${key}`,
          `Property “${key}” is not allowed in a private binding profile.`,
        ),
      );
    }
  }
  const result = validateRuntimeBindingProfile(input, manifest);
  for (const entry of result.issues) {
    issues.push(issue(`workspace-bindings.${entry.code}`, `${path}.${entry.path}`, entry.message));
  }
  return issues;
};

const manualIdsIssues = (
  input: unknown,
  path: string,
  knownIds: ReadonlySet<string>,
  label: "room" | "slot",
): HomeProjectIssue[] => {
  if (!Array.isArray(input)) {
    return [
      issue("workspace-bindings.manual-type", path, `Manual ${label} overrides must be an array.`),
    ];
  }
  const issues: HomeProjectIssue[] = [];
  const seen = new Set<string>();
  input.forEach((id, index) => {
    const itemPath = `${path}.${index}`;
    if (typeof id !== "string" || !id) {
      issues.push(
        issue(
          "workspace-bindings.manual-id",
          itemPath,
          `Manual ${label} IDs must be non-empty strings.`,
        ),
      );
      return;
    }
    if (!knownIds.has(id)) {
      issues.push(
        issue("workspace-bindings.manual-unknown-id", itemPath, `Unknown ${label} ID “${id}”.`),
      );
    }
    if (seen.has(id)) {
      issues.push(
        issue(
          "workspace-bindings.manual-duplicate",
          itemPath,
          `Manual ${label} ID “${id}” is duplicated.`,
        ),
      );
    }
    seen.add(id);
  });
  return issues;
};

/**
 * Validates only durable profile structure. It intentionally does not require
 * current Home Assistant registry targets, which may be unavailable offline.
 */
export const validateWorkspaceBindings = (
  bindings: WorkspaceBindings,
  draft: HomeBindingManifest,
  published: HomeBindingManifest,
): readonly HomeProjectIssue[] => {
  const issues: HomeProjectIssue[] = [];
  if (!isPlainRecord(bindings)) {
    return [issue("workspace-bindings.type", "bindings", "Bindings must be a plain JSON object.")];
  }
  const canonicalOrigins = new Map<string, string>();
  const draftRoomIds = new Set(
    draft.floors.flatMap((floor) => floor.rooms).map((room) => room.id) ?? [],
  );
  const draftSlotIds = new Set(collectBindingSlots(draft).map((slot) => slot.slotId));

  for (const [origin, state] of Object.entries(bindings)) {
    const statePath = `bindings.${origin}`;
    let canonicalOrigin: string | undefined;
    try {
      canonicalOrigin = normalizeOrigin(origin);
      if (canonicalOrigin !== origin) {
        issues.push(
          issue(
            "workspace-bindings.origin-normalization",
            statePath,
            `Origin keys must use canonical form “${canonicalOrigin}”.`,
          ),
        );
      }
      const duplicate = canonicalOrigins.get(canonicalOrigin);
      if (duplicate) {
        issues.push(
          issue(
            "workspace-bindings.origin-duplicate",
            statePath,
            `Origin “${origin}” duplicates canonical origin “${duplicate}”.`,
          ),
        );
      } else {
        canonicalOrigins.set(canonicalOrigin, origin);
      }
    } catch {
      issues.push(
        issue(
          "workspace-bindings.origin",
          statePath,
          "Bindings keys must be valid canonical http(s) origins.",
        ),
      );
    }

    if (!isPlainRecord(state)) {
      issues.push(
        issue(
          "workspace-bindings.state-type",
          statePath,
          "A binding envelope must be a plain JSON object.",
        ),
      );
      continue;
    }
    for (const key of Object.keys(state)) {
      if (!STATE_KEYS.has(key)) {
        issues.push(
          issue(
            "workspace-bindings.state-key",
            `${statePath}.${key}`,
            `Property “${key}” is not part of a binding envelope.`,
          ),
        );
      }
    }
    issues.push(...profileIssues(state.draft, draft, `${statePath}.draft`));
    issues.push(...profileIssues(state.published, published, `${statePath}.published`));
    issues.push(
      ...manualIdsIssues(state.manualRoomIds, `${statePath}.manualRoomIds`, draftRoomIds, "room"),
    );
    issues.push(
      ...manualIdsIssues(state.manualSlotIds, `${statePath}.manualSlotIds`, draftSlotIds, "slot"),
    );
  }
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
};

/**
 * Removes draft-only references to deleted binding slots across every origin.
 * Published mappings remain intact until the draft is published.
 */
export const removeWorkspaceSlotReferences = (
  bindings: WorkspaceBindings,
  slotIds: readonly string[],
): WorkspaceBindings => {
  const removed = new Set(slotIds);
  if (removed.size === 0) return bindings;

  let changed = false;
  const entries = Object.entries(bindings).map(([origin, state]) => {
    const entityIdsBySlotId = Object.fromEntries(
      Object.entries(state.draft.entityIdsBySlotId).filter(([slotId]) => !removed.has(slotId)),
    );
    const manualSlotIds = state.manualSlotIds.filter((slotId) => !removed.has(slotId));
    if (
      Object.keys(entityIdsBySlotId).length === Object.keys(state.draft.entityIdsBySlotId).length &&
      manualSlotIds.length === state.manualSlotIds.length
    )
      return [origin, state] as const;

    changed = true;
    return [
      origin,
      {
        ...state,
        draft: { ...state.draft, entityIdsBySlotId },
        manualSlotIds,
      } satisfies WorkspaceBindingState,
    ] as const;
  });
  return changed ? Object.fromEntries(entries) : bindings;
};

/**
 * Drops only draft references to rooms and slots removed by an already-valid
 * project edit. Published profiles stay intact so the published project keeps
 * its own private mapping snapshot.
 */
export const reconcileWorkspaceBindings = (
  bindings: WorkspaceBindings,
  manifest: HomeBindingManifest,
): WorkspaceBindings => {
  const roomIds = new Set(
    manifest.floors.flatMap((floor) => floor.rooms).map((room) => room.id) ?? [],
  );
  const slotIds = new Set(collectBindingSlots(manifest).map((slot) => slot.slotId));
  return Object.fromEntries(
    Object.entries(bindings).map(([origin, state]) => {
      const retainedRooms = Object.fromEntries(
        Object.entries(state.draft.roomAreaIds).filter(([id]) => roomIds.has(id)),
      );
      const retainedSlots = Object.fromEntries(
        Object.entries(state.draft.entityIdsBySlotId).filter(([id]) => slotIds.has(id)),
      );
      return [
        origin,
        {
          draft: {
            ...(state.draft.weatherSource !== undefined
              ? { weatherSource: state.draft.weatherSource }
              : {}),
            schemaVersion: state.draft.schemaVersion,
            homeId: state.draft.homeId,
            ...retainRoomDashboards(state.draft.roomDashboards, roomIds),
            roomAreaIds: retainedRooms,
            entityIdsBySlotId: retainedSlots,
            ...(state.draft.actionEntityIdsByShortcutId
              ? {
                  actionEntityIdsByShortcutId: Object.fromEntries(
                    Object.entries(state.draft.actionEntityIdsByShortcutId).filter(
                      ([id, entityId]) =>
                        manifest.actionBar?.items.some(
                          (item) =>
                            item.id === id &&
                            (item.target.kind === "scene" || item.target.kind === "script") &&
                            entityId.startsWith(`${item.target.kind}.`),
                        ),
                    ),
                  ),
                }
              : {}),
          },
          published: clone(state.published),
          manualRoomIds: state.manualRoomIds.filter((id) => roomIds.has(id)),
          manualSlotIds: state.manualSlotIds.filter((id) => slotIds.has(id)),
        } satisfies WorkspaceBindingState,
      ];
    }),
  );
};

/**
 * Moves a legacy per-origin profile into a private workspace envelope. Existing
 * workspace state wins, preventing a stale legacy profile from republishing
 * or replacing a newer draft.
 */
export const migrateWorkspaceBindingProfile = (
  bindings: WorkspaceBindings,
  origin: string,
  profile: RuntimeBindingProfile,
  draft: HomeBindingManifest,
  published: HomeBindingManifest,
): WorkspaceBindings => {
  const canonicalOrigin = normalizeOrigin(origin);
  const existingIssues = validateWorkspaceBindings(bindings, draft, published);
  if (existingIssues.length > 0) {
    throw new TypeError(existingIssues[0].message);
  }
  const profileForDraft = profileIssues(profile, draft, "profile");
  const profileForPublished = profileIssues(profile, published, "profile");
  if (profileForDraft.length > 0 || profileForPublished.length > 0) {
    throw new TypeError((profileForDraft[0] ?? profileForPublished[0]).message);
  }
  if (bindings[canonicalOrigin]) return clone(bindings);
  return {
    ...clone(bindings),
    [canonicalOrigin]: {
      draft: clone(profile),
      published: clone(profile),
      manualRoomIds: [],
      manualSlotIds: [],
    },
  };
};
