import {
  publishModelAssetReferences,
  referencedRecordAssets,
  createModelAssetRepository,
} from "../imported-models/asset-storage";
import { createBrowserUuid } from "../browser-uuid";
import {
  WORKSPACE_ONBOARDING_KEY,
  initialWorkspaceOnboarding,
  parseWorkspaceOnboarding,
  DeletedOnboardingWorkspaceError,
  type OnboardingPath,
  type WorkspaceOnboardingState,
} from "./workspace-onboarding-state";
import type { ProjectModelRegistries } from "../types";
import { normalizeHomeAssistantUrl } from "../home-assistant-auth";
import {
  MODEL_ASSET_STORE,
  PROJECT_STORE,
  WORKSPACE_STORE,
  STATE_STORE,
  projectTransaction,
} from "./project-database";
import {
  createSeedProjectRecord,
  parseHomeProjectRecord,
  serializeHomeProjectRecord,
} from "./project-record-codec";
import { WorkspaceConflictError, type HomeProjectRecord } from "./project-record-contract";
import type { HomeProject } from "./types";
import type { WorkspaceEntry, WorkspaceMetadata } from "./workspace-contract";
import { copyWorkspaceRecord } from "./workspace-identity";
import { createEmptyHomeProject } from "./empty-project";

const stores = [PROJECT_STORE, WORKSPACE_STORE, STATE_STORE, MODEL_ASSET_STORE];
const nameOf = (name: string) => {
  if (!name.trim()) throw new Error("Give your workspace a name.");
  return name.trim();
};

export function createWorkspaceRepository(factory: IDBFactory, registries: ProjectModelRegistries) {
  const parse = (raw: unknown): HomeProjectRecord => {
    if (typeof raw !== "string") throw new Error("This workspace is missing its home record.");
    const result = parseHomeProjectRecord(raw, registries);
    if (!result.valid) throw new Error(result.issues[0]?.message ?? "This home needs recovery.");
    return result.record;
  };
  const entry = (id: string, input: unknown, raw: unknown): WorkspaceEntry => {
    const value = input && typeof input === "object" ? (input as Partial<WorkspaceMetadata>) : null;
    const validMetadata =
      value?.id === id &&
      typeof value.name === "string" &&
      Boolean(value.name.trim()) &&
      typeof value.hasPublished === "boolean" &&
      typeof value.createdAt === "number" &&
      Number.isFinite(value.createdAt) &&
      (value.homeAssistantUrl === null ||
        (typeof value.homeAssistantUrl === "string" &&
          normalizeHomeAssistantUrl(value.homeAssistantUrl) === value.homeAssistantUrl));
    const metadata: WorkspaceMetadata = validMetadata
      ? (value as WorkspaceMetadata)
      : {
          id,
          name:
            typeof value?.name === "string" && value.name.trim()
              ? value.name
              : "Home needing recovery",
          homeAssistantUrl: null,
          hasPublished: false,
          createdAt: 0,
        };
    if (!validMetadata)
      return {
        metadata,
        error:
          "The saved workspace settings are damaged. Export recovery data or delete this entry.",
      };
    try {
      const record = parse(raw);
      if (record.homeId !== id)
        throw new Error(
          "The saved home belongs to a different workspace. Export recovery data or delete this entry.",
        );
      return { metadata, record };
    } catch (error) {
      return {
        metadata,
        error: error instanceof Error ? error.message : "This home needs recovery.",
      };
    }
  };
  const list = () =>
    projectTransaction<WorkspaceEntry[]>(factory, "readonly", stores, (tx, request, done) => {
      const metadataStore = tx.objectStore(WORKSPACE_STORE);
      request(metadataStore.getAllKeys(), (keys) => {
        const entries: WorkspaceEntry[] = [];
        if (!keys.length) {
          done([]);
          return;
        }
        for (const key of keys)
          request(metadataStore.get(key), (metadata) => {
            request(tx.objectStore(PROJECT_STORE).get(key), (raw) => {
              entries.push(
                entry(typeof key === "string" ? key : JSON.stringify(key), metadata, raw),
              );
              if (entries.length === keys.length)
                done(
                  entries.sort(
                    (a, b) =>
                      a.metadata.createdAt - b.metadata.createdAt ||
                      a.metadata.id.localeCompare(b.metadata.id),
                  ),
                );
            });
          });
      });
    });
  const read = (id: string) =>
    projectTransaction<WorkspaceEntry | null>(factory, "readonly", stores, (tx, request, done) => {
      const metadataStore = tx.objectStore(WORKSPACE_STORE);
      request(metadataStore.getKey(id), (key) => {
        if (key === undefined) {
          done(null);
          return;
        }
        request(metadataStore.get(id), (metadata) =>
          request(tx.objectStore(PROJECT_STORE).get(id), (raw) => done(entry(id, metadata, raw))),
        );
      });
    });
  const initialize = (seed: HomeProject) =>
    projectTransaction<void>(factory, "readwrite", stores, (tx, request, done) => {
      const state = tx.objectStore(STATE_STORE);
      request(state.get("initialized"), (initialized) => {
        if (initialized) {
          request(state.get(WORKSPACE_ONBOARDING_KEY), (existing) => {
            if (existing === undefined)
              state.put(initialWorkspaceOnboarding(null), WORKSPACE_ONBOARDING_KEY);
            done();
          });
          return;
        }
        const records = tx.objectStore(PROJECT_STORE);
        const metadata = tx.objectStore(WORKSPACE_STORE);
        request(records.getAllKeys(), (keys) => {
          state.put(
            initialWorkspaceOnboarding(keys.length ? null : seed.home.id),
            WORKSPACE_ONBOARDING_KEY,
          );
          if (!keys.length) {
            const record = createSeedProjectRecord(seed);
            records.put(serializeHomeProjectRecord(record), record.homeId);
            metadata.put(
              {
                id: record.homeId,
                name: record.draft.home.name,
                homeAssistantUrl: null,
                hasPublished: true,
                createdAt: Date.now(),
              },
              record.homeId,
            );
          } else {
            for (const key of keys)
              request(records.get(key), (raw) => {
                let record: HomeProjectRecord | undefined;
                try {
                  record = parse(raw);
                } catch {
                  /* Keep a recoverable library entry. */
                }
                const id = typeof key === "string" ? key : JSON.stringify(key);
                metadata.put(
                  {
                    id,
                    name: record?.draft.home.name ?? "Home needing recovery",
                    homeAssistantUrl: null,
                    hasPublished: record ? record.publishedAt !== 0 : false,
                    createdAt: record?.publishedAt || Date.now(),
                  },
                  id,
                );
              });
          }
          state.put(true, "initialized");
          done();
        });
      });
    });
  const create = async (
    source: HomeProjectRecord,
    options: { name: string; homeAssistantUrl?: string | null },
    sourceRevision?: { id: string; revision: number },
  ) => {
    const name = nameOf(options.name);
    const record = copyWorkspaceRecord(source, createBrowserUuid(), name);
    parse(serializeHomeProjectRecord(record));
    const url = options.homeAssistantUrl
      ? normalizeHomeAssistantUrl(options.homeAssistantUrl)
      : null;
    if (options.homeAssistantUrl && !url) throw new Error("Enter a valid Home Assistant URL.");
    await createModelAssetRepository(factory).verify(referencedRecordAssets(record));
    const metadata: WorkspaceMetadata = {
      id: record.homeId,
      name,
      homeAssistantUrl: url,
      hasPublished: record.publishedAt !== 0,
      createdAt: Date.now(),
    };
    return projectTransaction<WorkspaceEntry>(factory, "readwrite", stores, (tx, request, done) => {
      const records = tx.objectStore(PROJECT_STORE);
      const insert = () =>
        publishModelAssetReferences(tx, request, referencedRecordAssets(record), () => {
          request(records.add(serializeHomeProjectRecord(record), record.homeId), () => {
            request(tx.objectStore(WORKSPACE_STORE).add(metadata, record.homeId), () =>
              done({ metadata, record }),
            );
          });
        });
      if (sourceRevision)
        request(records.get(sourceRevision.id), (raw) => {
          if (parse(raw).revision !== sourceRevision.revision) throw new WorkspaceConflictError();
          insert();
        });
      else insert();
    });
  };
  const mutate = (
    id: string,
    revision: number,
    update: (metadata: WorkspaceMetadata, record: HomeProjectRecord) => void,
    personalOnly = false,
  ) =>
    projectTransaction<WorkspaceEntry>(factory, "readwrite", stores, (tx, request, done) => {
      const metadataStore = tx.objectStore(WORKSPACE_STORE);
      const records = tx.objectStore(PROJECT_STORE);
      request(
        metadataStore.get(id) as IDBRequest<WorkspaceMetadata | undefined>,
        (metadata: WorkspaceMetadata | undefined) => {
          if (!metadata) throw new WorkspaceConflictError();
          request(records.get(id), (raw) => {
            const record = parse(raw);
            if (record.revision !== revision) throw new WorkspaceConflictError();
            const commit = () => {
              update(metadata, record);
              record.revision++;
              const serialized = serializeHomeProjectRecord(record);
              parse(serialized);
              publishModelAssetReferences(tx, request, referencedRecordAssets(record), () =>
                request(records.put(serialized, id), () =>
                  request(metadataStore.put(metadata, id), () => done({ metadata, record })),
                ),
              );
            };
            if (personalOnly)
              request(tx.objectStore(STATE_STORE).get(WORKSPACE_ONBOARDING_KEY), (value) => {
                if (parseWorkspaceOnboarding(value)?.demoWorkspaceId === id)
                  throw new Error("Connect a personal copy of the demo instead.");
                commit();
              });
            else commit();
          });
        },
      );
    });
  const readOnboarding = () =>
    projectTransaction<WorkspaceOnboardingState | null>(
      factory,
      "readonly",
      STATE_STORE,
      (tx, request, done) =>
        request(tx.objectStore(STATE_STORE).get(WORKSPACE_ONBOARDING_KEY), (value) =>
          done(parseWorkspaceOnboarding(value)),
        ),
    );
  const dismissOnboarding = (kind: "welcome" | "nudge") =>
    projectTransaction<void>(factory, "readwrite", STATE_STORE, (tx, request, done) => {
      const state = tx.objectStore(STATE_STORE);
      request(state.get(WORKSPACE_ONBOARDING_KEY), (value) => {
        const progress = parseWorkspaceOnboarding(value);
        if (!progress)
          throw new Error("Getting-started preferences are unavailable. Your homes are unchanged.");
        if (kind === "welcome") progress.welcomeDismissed = true;
        else progress.nudgeDismissed = true;
        request(state.put(progress, WORKSPACE_ONBOARDING_KEY), () => done());
      });
    });
  const startOnboarding = (path: OnboardingPath, options?: { replaceDeletedId?: string }) =>
    projectTransaction<WorkspaceEntry>(factory, "readwrite", stores, (tx, request, done) => {
      const state = tx.objectStore(STATE_STORE),
        records = tx.objectStore(PROJECT_STORE),
        metadata = tx.objectStore(WORKSPACE_STORE);
      request(state.get(WORKSPACE_ONBOARDING_KEY), (value) => {
        const progress = parseWorkspaceOnboarding(value);
        if (!progress)
          throw new Error(
            "Getting-started preferences are unavailable. Open Workspaces to create a home.",
          );
        const insert = (source: HomeProjectRecord) => {
          const record = copyWorkspaceRecord(source, createBrowserUuid(), "My home");
          record.bindings = {};
          parse(serializeHomeProjectRecord(record));
          const settings: WorkspaceMetadata = {
            id: record.homeId,
            name: "My home",
            homeAssistantUrl: null,
            hasPublished: record.publishedAt !== 0,
            createdAt: Date.now(),
          };
          progress.destinations[path] = record.homeId;
          progress.welcomeDismissed = true;
          progress.nudgeDismissed = true;
          request(records.add(serializeHomeProjectRecord(record), record.homeId), () =>
            request(metadata.add(settings, record.homeId), () =>
              request(state.put(progress, WORKSPACE_ONBOARDING_KEY), () =>
                done({ metadata: settings, record }),
              ),
            ),
          );
        };
        const createDestination = () => {
          if (path === "build") {
            const blank = createSeedProjectRecord(createEmptyHomeProject("new", "My home"));
            blank.publishedAt = 0;
            insert(blank);
          } else {
            if (!progress.demoWorkspaceId)
              throw new Error(
                "The demo is no longer available. Create a home from Workspaces instead.",
              );
            request(metadata.get(progress.demoWorkspaceId), (settings) => {
              if (!settings)
                throw new Error("The demo was deleted. Create a home from Workspaces instead.");
              request(records.get(progress.demoWorkspaceId!), (raw) =>
                insert(createSeedProjectRecord(parse(raw).published)),
              );
            });
          }
        };
        const destination = progress.destinations[path];
        if (!destination) {
          createDestination();
          return;
        }
        request(metadata.get(destination), (settings) => {
          if (!settings) {
            if (options?.replaceDeletedId !== destination)
              throw new DeletedOnboardingWorkspaceError(destination);
            createDestination();
            return;
          }
          request(records.get(destination), (raw) => {
            const saved = entry(destination, settings, raw);
            if (!saved.record)
              throw new Error(saved.error ?? "This home needs recovery in Workspaces.");
            done(saved);
          });
        });
      });
    });
  return {
    list,
    read,
    initialize,
    create,
    readOnboarding,
    dismissOnboarding,
    startOnboarding,
    restoreExact: async (
      source: HomeProjectRecord,
      settings: WorkspaceMetadata,
      expectedRevision?: number,
    ) => {
      if (settings.id !== source.homeId || settings.hasPublished !== (source.publishedAt !== 0)) {
        return Promise.reject(
          new Error("The workspace backup identity or published status is inconsistent."),
        );
      }
      const normalized = settings.homeAssistantUrl
        ? normalizeHomeAssistantUrl(settings.homeAssistantUrl)
        : null;
      if (settings.homeAssistantUrl && normalized !== settings.homeAssistantUrl) {
        return Promise.reject(new Error("The workspace backup has an invalid Home Assistant URL."));
      }
      const saved = parse(serializeHomeProjectRecord(source));
      await createModelAssetRepository(factory).verify(referencedRecordAssets(saved));
      return projectTransaction<WorkspaceEntry>(
        factory,
        "readwrite",
        stores,
        (tx, request, done) => {
          const records = tx.objectStore(PROJECT_STORE),
            metadataStore = tx.objectStore(WORKSPACE_STORE);
          request(records.get(source.homeId), (raw) => {
            if (raw === undefined && expectedRevision !== undefined)
              throw new WorkspaceConflictError();
            if (raw !== undefined && expectedRevision === undefined)
              throw new WorkspaceConflictError();
            const current = raw === undefined ? null : parse(raw);
            if (current && current.revision !== expectedRevision)
              throw new WorkspaceConflictError();
            request(tx.objectStore(STATE_STORE).get(WORKSPACE_ONBOARDING_KEY), (state) => {
              if (parseWorkspaceOnboarding(state)?.demoWorkspaceId === source.homeId) {
                throw new Error("The demo cannot be replaced by a Home Assistant workspace.");
              }
              const record = {
                ...saved,
                revision: Math.max(saved.revision, (current?.revision ?? -1) + 1),
              };
              const metadata = { ...settings };
              publishModelAssetReferences(tx, request, referencedRecordAssets(record), () =>
                request(records.put(serializeHomeProjectRecord(record), source.homeId), () =>
                  request(metadataStore.put(metadata, source.homeId), () =>
                    done({ record, metadata }),
                  ),
                ),
              );
            });
          });
        },
      );
    },
    createBlank: (name: string) => {
      const record = createSeedProjectRecord(createEmptyHomeProject("new", nameOf(name)));
      record.publishedAt = 0;
      return create(record, { name });
    },
    duplicate: async (id: string, revision: number, name: string) => {
      const source = await read(id);
      if (!source?.record) throw new Error(source?.error ?? "Workspace no longer exists.");
      return create(
        source.record,
        { name, homeAssistantUrl: source.metadata.homeAssistantUrl },
        { id, revision },
      );
    },
    rename: (id: string, revision: number, name: string) =>
      mutate(id, revision, (metadata, record) => {
        metadata.name = nameOf(name);
        record.draft.home.name = metadata.name;
        record.published.home.name = metadata.name;
      }),
    setConnection: (id: string, revision: number, url: string | null) =>
      mutate(
        id,
        revision,
        (metadata) => {
          const normalized = normalizeHomeAssistantUrl(url);
          if (url && !normalized) throw new Error("Enter a valid Home Assistant URL.");
          metadata.homeAssistantUrl = normalized;
        },
        true,
      ),
    delete: (id: string, expectedRaw: string | null) =>
      projectTransaction<void>(factory, "readwrite", stores, (tx, request, done) => {
        const records = tx.objectStore(PROJECT_STORE);
        request(records.get(id), (raw) => {
          if ((raw ?? null) !== expectedRaw) throw new WorkspaceConflictError();
          request(records.delete(id), () =>
            request(tx.objectStore(WORKSPACE_STORE).delete(id), () => done()),
          );
        });
      }),
    readRaw: (id: string) =>
      projectTransaction<string | null>(factory, "readonly", PROJECT_STORE, (tx, request, done) =>
        request(tx.objectStore(PROJECT_STORE).get(id), (raw) =>
          done(typeof raw === "string" ? raw : null),
        ),
      ),
  };
}

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
