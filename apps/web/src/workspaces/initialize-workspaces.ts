import { createWorkspaceRepository } from "@cabane/engine";
import { demoHomeProject } from "@cabane/home";
import { ownerProjectRegistries } from "../project-runtime";

export async function initializeWorkspaces(factory: IDBFactory) {
  const repository = createWorkspaceRepository(factory, ownerProjectRegistries);
  await repository.initialize({
    ...demoHomeProject,
    home: { ...demoHomeProject.home, name: "Demo home" },
  });
  return repository;
}
