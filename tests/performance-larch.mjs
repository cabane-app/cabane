import {
  createHomeProjectRepository,
  createIndexedDbProjectRecordStore,
  createWorkspaceRepository,
  saveStoredAuthData,
} from "@cabane/engine";
import { ownerProjectRegistries } from "../apps/web/src/project-runtime";
import project from "../home/dev-workspaces/larch-observatory.project.json";
import { installPerformanceHomeAssistant } from "./performance-home-assistant.mjs";

const cathedralHall = {
  roomId: "ground-floor:room-1",
  areaId: "benchmark_cathedral_hall",
  name: "Cathedral hall",
};

// Use existing table, floor and wall lights in the same room as the Walk spawn.
// The source design uses night-only lights. Only these three use the synthetic
// HA state in this benchmark copy, with a mix of initially on and off.
const cathedralLights = [
  ["1154889c-5c31-4b2c-823f-f1252b56d7e2", "hearth_table_lamp", "on", true],
  ["bb298bf7-8dd3-4133-a86d-407e9e75716b", "floor_lamp", "off"],
  ["537af247-8a79-4ff3-9f86-2e920595a26f", "smoked_globe_wall_light", "on"],
];

async function prepareConnectedLights(workspaces) {
  const lights = cathedralLights.map(([id, name, initialState, dimmable = false]) => {
    const item = project.sceneItems.find((item) => item.id === id);
    const slot = item?.entitySlots?.find(
      (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
    );
    if (!slot || item.lightState !== "night-only")
      throw new Error(`Missing authored benchmark light ${name}.`);
    return {
      id,
      slotId: slot.id,
      entityId: `light.benchmark_${name}`,
      label: slot.presentation.label,
      initialState,
      dimmable,
    };
  });
  const { origin, accessToken, snapshot } = installPerformanceHomeAssistant(cathedralHall, lights);
  const connectedIds = new Set(lights.map((light) => light.id));
  await workspaces.initialize(
    {
      ...project,
      sceneItems: project.sceneItems.map((item) =>
        connectedIds.has(item.id) ? { ...item, lightState: "connected" } : item,
      ),
    },
    origin,
  );
  const entry = await workspaces.read(project.home.id);
  if (!entry?.record) throw new Error("Could not initialize the Larch benchmark workspace.");
  const profile = {
    schemaVersion: 1,
    homeId: project.home.id,
    roomAreaIds: { [cathedralHall.roomId]: cathedralHall.areaId },
    entityIdsBySlotId: Object.fromEntries(lights.map((light) => [light.slotId, light.entityId])),
  };
  const records = createHomeProjectRepository(
    createIndexedDbProjectRecordStore(window.indexedDB),
    ownerProjectRegistries,
  );
  await records.replace(
    {
      ...entry.record,
      bindings: {
        [origin]: {
          draft: profile,
          published: profile,
          manualRoomIds: [cathedralHall.roomId],
          manualSlotIds: lights.map((light) => light.slotId),
        },
      },
    },
    entry.record.revision,
  );
  saveStoredAuthData(
    window.localStorage,
    {
      hassUrl: origin,
      clientId: location.origin,
      expires: Date.now() + 3_600_000,
      expires_in: 3600,
      refresh_token: "",
      access_token: accessToken,
    },
    origin,
    location.origin,
  );
  window.localStorage.setItem(
    "cabane.walk.preferences.v1",
    JSON.stringify({ lightingMode: "night" }),
  );
  return { lights, roomId: cathedralHall.roomId, roomLabel: cathedralHall.name, snapshot };
}

export async function prepareLarch({ connected = false } = {}) {
  const workspaces = createWorkspaceRepository(window.indexedDB, ownerProjectRegistries);
  const connectedLights = connected ? await prepareConnectedLights(workspaces) : null;
  if (!connected) await workspaces.initialize(project);
  await workspaces.finishMigration();
  await workspaces.dismissOnboarding("welcome");
  await workspaces.dismissOnboarding("nudge");
  const path = `/workspaces/${encodeURIComponent(project.home.id)}`;
  history.replaceState(null, "", path);
  return {
    path,
    description: connected
      ? "Larch Observatory · simulated HA · night · Cathedral hall light controls."
      : "Larch Observatory · checked-in development workspace.",
    workload: {
      fixture: "larch-observatory",
      floors: project.floors.length,
      sceneItems: project.sceneItems.length,
      ...(connectedLights
        ? {
            lightingMode: "night",
            simulatedLights: connectedLights.lights.length,
            initiallyOn: connectedLights.lights.filter((light) => light.initialState === "on")
              .length,
          }
        : {}),
    },
    connectedLights,
  };
}
