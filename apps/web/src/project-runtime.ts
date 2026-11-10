import { stableDeviceRegistry } from "@cabane/catalog/device";
import { stableFurnishingRegistry } from "@cabane/catalog/furnishing";
import {
  composeHomeManifest,
  createHomeProjectLifecycle,
  resetHomeProjectToSeed,
  createEmptyHomeProject,
  createWorkspaceRepository,
  createHomeProjectRepository,
  createIndexedDbProjectRecordStore,
  mergeDeviceModelRegistriesStableFirst,
  type HomeProject,
  type HomeManifest,
  type ResolvedHomeBindings,
  type ProjectModelRegistries,
} from "@cabane/engine";
import { homeExtensions } from "@cabane/home";

export const ownerDeviceModels = mergeDeviceModelRegistriesStableFirst(
  stableDeviceRegistry,
  homeExtensions.deviceModels,
);

export const ownerProjectRegistries: ProjectModelRegistries = {
  furnishingModels: Object.assign(
    Object.create(null) as Record<string, never>,
    stableFurnishingRegistry,
    homeExtensions.furnishingModels,
  ),
  deviceModels: ownerDeviceModels,
};

export const ownerProjectExtensions = {
  ...homeExtensions,
  ...ownerProjectRegistries,
};

export const composeOwnerProjectManifest = (project: HomeProject) =>
  composeHomeManifest(project, ownerProjectExtensions);

/** Editing uses typed slots only; it never resolves or contacts Home Assistant. */
export const editorBindingsForManifest = (manifest: HomeManifest): ResolvedHomeBindings => ({
  rooms: Object.fromEntries(
    manifest.floors
      .flatMap((floor) => floor.rooms)
      .map((room) => [
        room.id,
        {
          room,
          displayName: room.name,
          pictureUrl: null,
          sections: { primary: [], secondary: [], diagnostic: [] },
          devices: room.devices.map((slot) => ({ slot, entities: [], issues: [] })),
          issues: [],
        },
      ]),
  ),
  openings: {},
  issues: [],
});

export const createBrowserHomeProjectLifecycle = (factory: IDBFactory, homeId: string) => {
  const repository = createHomeProjectRepository(
    createIndexedDbProjectRecordStore(factory),
    ownerProjectRegistries,
  );
  const workspaces = createWorkspaceRepository(factory, ownerProjectRegistries);
  const blank = createEmptyHomeProject(homeId, "Home");
  const lifecycle = createHomeProjectLifecycle(repository, blank);
  return {
    ...lifecycle,
    resetToSeed: (record: import("@cabane/engine").HomeProjectRecord) =>
      resetHomeProjectToSeed(
        repository,
        record,
        createEmptyHomeProject(homeId, record.draft.home.name),
        0,
      ),
    load: async () => {
      const entry = await workspaces.read(homeId);
      if (!entry) throw new Error("This workspace no longer exists.");
      if (entry.record)
        return { status: "ready" as const, record: entry.record, source: "indexeddb" as const };
      const raw = await repository.readRaw(homeId);
      if (raw === null) throw new Error("This workspace is missing its saved home.");
      const fallback = createEmptyHomeProject(homeId, entry.metadata.name);
      const record = {
        homeId,
        schemaVersion: 2 as const,
        seedRevision: fallback.seedRevision,
        draft: fallback,
        published: structuredClone(fallback),
        draftUpdatedAt: Date.now(),
        publishedAt: 0,
        revision: 0,
        bindings: {},
      };
      return {
        status: "recovery" as const,
        record,
        raw,
        reason: entry.error ?? "This home needs recovery.",
        issues: [],
      };
    },
    recoverToSeed: async (record: import("@cabane/engine").HomeProjectRecord, raw: string) => {
      try {
        const seed = createEmptyHomeProject(homeId, record.draft.home.name);
        return { status: "saved" as const, record: await repository.recover(seed, raw, 0) };
      } catch (error) {
        return {
          status: "storage-error" as const,
          record,
          error: error instanceof Error ? error : new Error("Recovery failed."),
        };
      }
    },
  };
};
