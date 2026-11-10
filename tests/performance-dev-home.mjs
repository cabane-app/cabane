import {
  createWorkspaceRepository,
  createHomeProjectRepository,
  createIndexedDbProjectRecordStore,
  saveStoredAuthData,
} from "@cabane/engine";
import { ownerProjectRegistries } from "../apps/web/src/project-runtime";
import project from "../home/showcase/furnished.project.json";

// Only the dedicated benchmark server supplies this ephemeral loopback session.
// It is never part of a build, report, browser persistence, or normal app startup.
export async function readDevelopmentHome() {
  const response = await fetch("/__performance/dev-ha", { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function prepareDevelopmentHome() {
  const session = await readDevelopmentHome();
  const workspaces = createWorkspaceRepository(window.indexedDB, ownerProjectRegistries);
  // An explicit HA origin initializes an ordinary connected home, not onboarding's demo.
  await workspaces.initialize(project, session.origin);
  const entry = await workspaces.read(project.home.id);
  if (!entry?.record) throw new Error("Could not initialize the repo development home.");
  const records = createHomeProjectRepository(
    createIndexedDbProjectRecordStore(window.indexedDB),
    ownerProjectRegistries,
  );
  await records.replace(
    {
      ...entry.record,
      bindings: {
        [session.origin]: {
          draft: session.profile,
          published: session.profile,
          manualRoomIds: Object.keys(session.profile.roomAreaIds),
          manualSlotIds: Object.keys(session.profile.entityIdsBySlotId),
        },
      },
    },
    entry.record.revision,
  );
  saveStoredAuthData(
    window.localStorage,
    {
      hassUrl: session.origin,
      clientId: location.origin,
      expires: session.expiresAt,
      expires_in: 3600,
      refresh_token: "",
      access_token: session.accessToken,
    },
    session.origin,
    location.origin,
  );
  window.localStorage.setItem(
    "cabane.walk.preferences.v1",
    JSON.stringify({ lightingMode: "night" }),
  );
  const path = `/workspaces/${encodeURIComponent(project.home.id)}`;
  history.replaceState(null, "", path);
  return { path, workload: session.workload };
}
