import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "../../tests/test-server.mjs";

export const offCameraPrefix = "off-camera-";
const spacingMetres = 80;

/** Keep the floor, room camera, lighting and foreground items identical at every tier. */
export function offCameraApartment(base, copies) {
  assert.equal(base.floors.length, 1);
  const floor = base.floors[0];
  const furnishings = base.sceneItems.filter(
    (item) => item.kind === "furnishing" && item.placement.kind === "absolute",
  );
  const clusters = Array.from({ length: copies }, (_, index) =>
    furnishings.map((item) => ({
      ...item,
      id: `${offCameraPrefix}${index + 1}-${item.id}`,
      placement: {
        ...item.placement,
        at: [
          item.placement.at[0] +
            ((index + 1) * spacingMetres) / floor.coordinates.metersPerPlanUnit,
          item.placement.at[1],
        ],
      },
    })),
  );
  return { ...base, sceneItems: [...base.sceneItems, ...clusters.flat()] };
}

const request = (operation) =>
  new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });

export async function prepareOrbitSeeds(projects) {
  return withModules(async (load) => {
    const { createWorkspaceRepository } = await load("/packages/engine/src/index.ts");
    const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
    return Promise.all(
      projects.map(async (project) => {
        const factory = new IDBFactory();
        const repository = createWorkspaceRepository(factory, ownerProjectRegistries);
        await repository.initialize(project);
        await repository.finishMigration();
        await repository.dismissOnboarding("welcome");
        await repository.dismissOnboarding("nudge");
        const entry = await repository.read(project.home.id);
        assert.ok(entry?.record, `Synthetic workspace failed validation: ${entry?.error}`);

        // Export the current storage layout through the real repository, keeping
        // the measured panel cold. Open the snapshot as a regular published home.
        const database = await request(factory.open("cabane-projects-v2"));
        try {
          const stores = await Promise.all(
            [...database.objectStoreNames].map(async (name) => {
              const store = database.transaction(name).objectStore(name);
              const [keys, values] = await Promise.all([
                request(store.getAllKeys()),
                request(store.getAll()),
              ]);
              if (name === "workspace-state") {
                const onboarding = values[keys.indexOf("onboarding:v1")];
                onboarding.demoWorkspaceId = null;
              }
              return { name, keys, values };
            }),
          );
          return { version: database.version, id: project.home.id, stores };
        } finally {
          database.close();
        }
      }),
    );
  });
}

/** Serialized by Playwright. Only used in its fresh synthetic browser context. */
export function seedOrbitWorkspace({ version, id, stores }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("cabane-projects-v2", version);
    request.onupgradeneeded = () => {
      for (const { name, keys, values } of stores) {
        const store = request.result.createObjectStore(name);
        keys.forEach((key, index) => store.put(values[index], key));
      }
    };
    request.onsuccess = () => {
      request.result.close();
      localStorage.setItem("cabane:last-opened-workspace", id);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
