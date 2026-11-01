import { resolveProjectModels } from "../imported-models/resolve-models";
import type { ProjectModelRegistries } from "../types";

import type { HomeProject } from "./types";

import { parseHomeProjectSchema, validateHomeProject } from "./validation";

import { isPlainRecord } from "./validation-types";

import {
  clone,
  createSeedProjectRecord,
  parseHomeProjectRecord,
  serializeHomeProjectRecord,
} from "./project-record-codec";
import {
  HomeProjectRecord,
  HomeProjectRepository,
  ProjectRecordStore,
  WorkspaceConflictError,
} from "./project-record-contract";
import { type WorkspaceBindings } from "./workspace-bindings";
import { itemBindingSlotIds } from "./item-binding-identities";

const removeMissingSceneItems = (
  project: HomeProject,
  registries: ProjectModelRegistries,
): { project: HomeProject; removedSlotIds: readonly string[]; removedCount: number } => {
  registries = resolveProjectModels(project, registries);
  const removedSlotIds: string[] = [];
  const sceneItems = project.sceneItems.filter((item) => {
    const registry = item.kind === "device" ? registries.deviceModels : registries.furnishingModels;
    if (Object.hasOwn(registry, item.modelId)) return true;
    removedSlotIds.push(...itemBindingSlotIds(item));
    return false;
  });
  return {
    project: sceneItems.length === project.sceneItems.length ? project : { ...project, sceneItems },
    removedSlotIds,
    removedCount: project.sceneItems.length - sceneItems.length,
  };
};

const removeBindingSlotReferences = (
  bindings: WorkspaceBindings,
  draftSlotIds: readonly string[],
  publishedSlotIds: readonly string[],
): WorkspaceBindings => {
  const removedFromDraft = new Set(draftSlotIds);
  const removedFromPublished = new Set(publishedSlotIds);
  return Object.fromEntries(
    Object.entries(bindings).map(([origin, state]) => [
      origin,
      {
        ...state,
        draft: {
          ...state.draft,
          entityIdsBySlotId: Object.fromEntries(
            Object.entries(state.draft.entityIdsBySlotId).filter(
              ([slotId]) => !removedFromDraft.has(slotId),
            ),
          ),
        },
        published: {
          ...state.published,
          entityIdsBySlotId: Object.fromEntries(
            Object.entries(state.published.entityIdsBySlotId).filter(
              ([slotId]) => !removedFromPublished.has(slotId),
            ),
          ),
        },
        manualSlotIds: state.manualSlotIds.filter((slotId) => !removedFromDraft.has(slotId)),
      },
    ]),
  );
};

const recoveryRevision = (raw: string): number => {
  let priorRevision = -1;
  try {
    const prior = JSON.parse(raw) as { revision?: unknown } | null;
    if (prior && Number.isSafeInteger(prior.revision) && (prior.revision as number) >= 0) {
      priorRevision = prior.revision as number;
    }
  } catch {
    // Unreadable JSON cannot supply its prior counter. A new high epoch avoids
    // reauthorizing ordinary stale tabs; randomness separates same-second resets.
  }
  const random = crypto.getRandomValues(new Uint32Array(1))[0] & 0xfffff;
  const epoch = Math.floor(Date.now() / 1000) * 2 ** 20 + random;
  const revision = Math.max(epoch, priorRevision + 1);
  if (!Number.isSafeInteger(revision))
    throw new Error("The workspace recovery revision is exhausted.");
  return revision;
};

export const createHomeProjectRepository = (
  store: ProjectRecordStore,
  registries: ProjectModelRegistries,
): HomeProjectRepository => {
  // The queue also supports legacy/test stores without CAS. Those stores are
  // serialized only within this repository instance, not across tabs.
  let writeQueue: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = writeQueue.then(operation, operation);
    writeQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  const load = async (homeId: string): Promise<HomeProjectRecord | null> => {
    const raw = await store.read(homeId);
    if (raw === null) return null;
    const parsed = parseHomeProjectRecord(raw, registries);
    if (!parsed.valid) {
      throw new Error(
        `Stored project record is invalid: ${parsed.issues[0]?.message ?? "unknown error"}`,
      );
    }
    return clone(parsed.record);
  };

  const changed = () => new WorkspaceConflictError();

  const persist = async (homeId: string, previous: string | null, serialized: string) => {
    let wrote = false;
    try {
      if (store.compareAndSwap) {
        if (!(await store.compareAndSwap(homeId, previous, serialized))) throw changed();
        wrote = true;
      } else {
        wrote = true;
        await store.write(homeId, serialized);
      }
      if ((await store.read(homeId)) !== serialized) {
        throw new Error("Project record verification failed after storage write.");
      }
    } catch (error) {
      if (wrote) await rollback(store, homeId, serialized, previous);
      throw error;
    }
  };

  const replace = (
    record: HomeProjectRecord,
    expectedRevision?: number,
  ): Promise<HomeProjectRecord> => {
    const serialized = serializeHomeProjectRecord({
      ...record,
      revision: expectedRevision === undefined ? record.revision : expectedRevision + 1,
    });
    const parsed = parseHomeProjectRecord(serialized, registries);
    if (!parsed.valid) {
      return Promise.reject(
        new Error(`Project record is invalid: ${parsed.issues[0]?.message ?? "unknown error"}`),
      );
    }
    const homeId = parsed.record.homeId;

    return enqueue(async () => {
      const previous = await store.read(homeId);
      if (expectedRevision !== undefined) {
        const current = previous === null ? null : parseHomeProjectRecord(previous, registries);
        if (!current?.valid || current.record.revision !== expectedRevision) throw changed();
      }
      await persist(homeId, previous, serialized);
      return clone(parsed.record);
    });
  };

  const recoverRecord = (
    homeId: string,
    record: HomeProjectRecord,
    expectedRaw: string,
  ): Promise<HomeProjectRecord> =>
    enqueue(async () => {
      if (
        typeof expectedRaw !== "string" ||
        parseHomeProjectRecord(expectedRaw, registries).valid
      ) {
        throw new Error("Recovery requires an invalid saved project snapshot.");
      }
      if (record.homeId !== homeId)
        throw new Error("The recovery record belongs to a different home.");
      if ((await store.read(homeId)) !== expectedRaw) throw changed();
      const serialized = serializeHomeProjectRecord({
        ...record,
        revision: recoveryRevision(expectedRaw),
      });
      const parsed = parseHomeProjectRecord(serialized, registries);
      if (!parsed.valid) {
        throw new Error(
          `Project record is invalid: ${parsed.issues[0]?.message ?? "unknown error"}`,
        );
      }
      await persist(homeId, expectedRaw, serialized);
      return clone(parsed.record);
    });

  return {
    load,
    loadOrCreate: (seed, now = Date.now()) =>
      enqueue(async () => {
        const raw = await store.read(seed.home.id);
        if (raw === null) {
          const record = createSeedProjectRecord(seed, now);
          const serialized = serializeHomeProjectRecord(record);
          const parsed = parseHomeProjectRecord(serialized, registries);
          if (!parsed.valid)
            throw new Error(
              `Project record is invalid: ${parsed.issues[0]?.message ?? "unknown error"}`,
            );
          try {
            await persist(seed.home.id, null, serialized);
            return { status: "ready", record: clone(parsed.record), source: "seed" };
          } catch (error) {
            // Another tab may have initialized or edited the workspace while this
            // tab was preparing its seed. Its complete record always wins.
            const winner = await load(seed.home.id);
            if (winner) return { status: "ready", record: winner, source: "indexeddb" };
            throw error;
          }
        }
        const parsed = parseHomeProjectRecord(raw, registries);
        if (parsed.valid) {
          return { status: "ready", record: clone(parsed.record), source: "indexeddb" };
        }
        return {
          status: "recovery",
          record: createSeedProjectRecord(seed, now),
          raw,
          reason: parsed.issues[0]?.message ?? "The stored project record is invalid.",
          issues: parsed.issues,
        };
      }),
    replace,
    recover: (seed, expectedRaw, now = Date.now()) =>
      recoverRecord(seed.home.id, createSeedProjectRecord(seed, now), expectedRaw),
    recoverWithoutMissingSceneItems: (homeId, expectedRaw) => {
      let input: unknown;
      try {
        input = JSON.parse(expectedRaw);
      } catch {
        return Promise.reject(
          new Error("This recovery can only repair a structurally valid saved project."),
        );
      }
      if (!isPlainRecord(input)) {
        return Promise.reject(
          new Error("This recovery can only repair a structurally valid saved project."),
        );
      }
      const draft = parseHomeProjectSchema(input.draft);
      const published = parseHomeProjectSchema(input.published);
      if (!draft.valid || !published.valid) {
        return Promise.reject(
          new Error("This recovery can only repair a structurally valid saved project."),
        );
      }
      const repairedDraft = removeMissingSceneItems(draft.project, registries);
      const repairedPublished = removeMissingSceneItems(published.project, registries);
      if (repairedDraft.removedCount + repairedPublished.removedCount === 0) {
        return Promise.reject(new Error("No unavailable furnishing or device models were found."));
      }
      const bindings = "bindings" in input ? (input.bindings as WorkspaceBindings) : {};
      const record: HomeProjectRecord = {
        homeId: input.homeId as string,
        schemaVersion: 2,
        seedRevision: input.seedRevision as string,
        draft: repairedDraft.project,
        published: repairedPublished.project,
        draftUpdatedAt: input.draftUpdatedAt as number,
        publishedAt: input.publishedAt as number,
        revision: input.revision as number,
        bindings: removeBindingSlotReferences(
          bindings,
          repairedDraft.removedSlotIds,
          repairedPublished.removedSlotIds,
        ),
      };
      return recoverRecord(homeId, record, expectedRaw);
    },
    readRaw: (homeId) => store.read(homeId),
    validate: (project) => validateHomeProject(project, registries),
  };
};

const rollback = async (
  store: ProjectRecordStore,
  homeId: string,
  attempted: string,
  previous: string | null,
) => {
  try {
    if (store.compareAndSwap) {
      await store.compareAndSwap(homeId, attempted, previous);
    } else if ((await store.read(homeId)) === attempted) {
      // Best effort for non-CAS stores; this is not a cross-tab guarantee.
      if (previous === null) await store.delete?.(homeId);
      else await store.write(homeId, previous);
    }
  } catch {
    // Preserve the original verification/storage error. Recovery remains possible
    // through the caller's in-memory record and the raw export path.
  }
};
export {
  createSeedProjectRecord,
  parseHomeProjectRecord,
  serializeHomeProjectRecord,
} from "./project-record-codec";
export { WorkspaceConflictError } from "./project-record-contract";
export type {
  HomeProjectRecord,
  HomeProjectRecordParseResult,
  HomeProjectRepository,
  MemoryProjectRecordStore,
  ProjectLoadResult,
  ProjectRecordStore,
} from "./project-record-contract";
export {
  createIndexedDbProjectRecordStore,
  createMemoryProjectRecordStore,
} from "./project-record-stores";
