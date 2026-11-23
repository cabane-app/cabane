import { createWorkspaceRepository } from "@cabane/engine";
import { ownerHomeProject, showcaseHomeProject } from "@cabane/home";
import { ownerProjectRegistries } from "../project-runtime";
import { migrateSingleHomeStorage, singleHomeUrl } from "./migrate-single-home-storage";

export async function initializeWorkspaces(
  factory: IDBFactory,
  storage: Storage,
  { skipLegacyMigration = false }: { skipLegacyMigration?: boolean } = {},
) {
  const repository = createWorkspaceRepository(factory, ownerProjectRegistries);
  let migrationError: string | undefined;
  let previousOrigin: string | null = null;
  try {
    if (!skipLegacyMigration && !(await repository.migrationDone()))
      previousOrigin = singleHomeUrl(storage);
  } catch (error) {
    migrationError =
      error instanceof Error ? error.message : "Saved connection data needs recovery.";
  }
  // Legacy connection profiles still belong to the original bundled home.
  const demo = previousOrigin ? ownerHomeProject : showcaseHomeProject;
  await repository.initialize(
    demo,
    previousOrigin,
    previousOrigin
      ? undefined
      : {
          "blank-v1": null,
          // The open-garden update could already have refreshed an untouched demo once.
          "larch-demo-open-garden-v2":
            "0588ea1ae5257ce7a356e9b5dfc7c8e4bb93f74ea6039cf81302514efe11303e",
        },
  );
  try {
    if (!skipLegacyMigration)
      await migrateSingleHomeStorage(repository, ownerHomeProject.home.id, storage);
  } catch (error) {
    migrationError =
      error instanceof Error ? error.message : "Saved connection data needs recovery.";
  }
  return { repository, migrationError };
}
