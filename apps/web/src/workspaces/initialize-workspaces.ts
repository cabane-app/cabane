import { createWorkspaceRepository } from "@cabane/engine";
import { demoHomeProject, ownerHomeProject } from "@cabane/home";
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
  // Legacy connections belong to the original single-home seed.
  const seed = previousOrigin ? ownerHomeProject : demoHomeProject;
  await repository.initialize(
    { ...seed, home: { ...seed.home, name: "Demo home" } },
    previousOrigin,
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
