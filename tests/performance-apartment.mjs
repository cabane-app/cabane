import { createWorkspaceRepository } from "@cabane/engine";
import { ownerProjectRegistries } from "../apps/web/src/project-runtime";
import { createPerformanceApartment } from "./fixtures/performance-apartment";

export async function prepareApartment() {
  const project = createPerformanceApartment();
  const workspaces = createWorkspaceRepository(window.indexedDB, ownerProjectRegistries);
  await workspaces.initialize(project);
  await workspaces.dismissOnboarding("welcome");
  await workspaces.dismissOnboarding("nudge");
  const entry = await workspaces.read(project.home.id);
  if (!entry?.record) throw new Error("Could not initialize the synthetic apartment.");
  const path = `/workspaces/${encodeURIComponent(project.home.id)}`;
  history.replaceState(null, "", path);
  return {
    path,
    description: "Synthetic apartment · 12 small rooms · catalog furniture.",
    workload: {
      fixture: "synthetic-apartment-v1",
      rooms: 12,
      sceneItems: project.sceneItems.length,
    },
  };
}
