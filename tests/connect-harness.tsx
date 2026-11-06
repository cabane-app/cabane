import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ownerHomeProject } from "./fixtures/previous-demo/project";
import {
  HomeAssistantRuntimeValueProvider,
  collectBindingSlots,
  createEmptyRuntimeBindingProfile,
  createHomeProjectLifecycle,
  createHomeProjectRepository,
  createIndexedDbProjectRecordStore,
  type HomeAssistantRuntimeValue,
  type HomeProjectRecord,
  type EntityId,
} from "@cabane/engine";
import { ConnectedProduct } from "../apps/web/src/ConnectedProduct";
import {
  composeOwnerProjectManifest,
  ownerProjectRegistries,
} from "../apps/web/src/project-runtime";
import "@cabane/engine/styles.css";
import "../apps/web/src/app-shell.css";

const origin = "https://connect-fixture.invalid";
const manifest = composeOwnerProjectManifest(ownerHomeProject);
const descriptors = collectBindingSlots(manifest);
const areas = manifest.floors[0].rooms.map((room, index) => ({
  area_id: `synthetic_area_${index}`,
  name: room.name,
  icon: null,
  picture: null,
}));
const entityRegistry = descriptors.map((descriptor, index) => ({
  entity_id: `${descriptor.spec.compatibleDomains[0]}.synthetic_${index}` as EntityId,
  area_id:
    areas[manifest.floors[0].rooms.findIndex((room) => descriptor.roomIds.includes(room.id))]
      ?.area_id ?? areas[0].area_id,
  device_id: `synthetic_device_${index}`,
  name: descriptor.spec.presentation.label,
  original_name: null,
  disabled_by: null,
  hidden_by: null,
  platform: "fixture",
}));
const entityStates = Object.fromEntries(
  entityRegistry.map((entry, index) => [
    entry.entity_id,
    {
      entityId: entry.entity_id,
      state: "off",
      available: true,
      attributes: {
        friendly_name: descriptors[index].spec.presentation.label,
        device_class: descriptors[index].spec.compatibleDeviceClasses?.[0],
      },
      lastChanged: "2026-09-02T00:00:00Z",
      lastUpdated: "2026-09-02T00:00:00Z",
    },
  ]),
);
const repository = createHomeProjectRepository(
  createIndexedDbProjectRecordStore(window.indexedDB),
  ownerProjectRegistries,
);
const lifecycle = createHomeProjectLifecycle(repository, ownerHomeProject);

function Fixture() {
  const [record, setRecord] = useState<HomeProjectRecord | null>(null);
  const [online, setOnline] = useState(true);
  const [url, setUrl] = useState<string | null>(origin);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  useEffect(() => {
    void lifecycle.load().then(async (result) => {
      let next = result.record;
      if (!next.bindings[origin]) {
        const empty = createEmptyRuntimeBindingProfile(next.homeId);
        const profile = {
          ...empty,
          roomAreaIds: Object.fromEntries(
            manifest.floors[0].rooms
              .slice(0, 3)
              .map((room, index) => [room.id, areas[index].area_id]),
          ),
          entityIdsBySlotId: Object.fromEntries(
            descriptors
              .slice(0, 2)
              .map((descriptor, index) => [descriptor.slotId, entityRegistry[index].entity_id]),
          ),
        };
        next = await repository.replace(
          {
            ...next,
            bindings: {
              [origin]: {
                draft: profile,
                published: empty,
                manualRoomIds: manifest.floors[0].rooms.map((room) => room.id),
                manualSlotIds: descriptors.map((slot) => slot.slotId),
              },
            },
          },
          next.revision,
        );
      }
      setRecord(next);
    });
  }, []);
  const runtime = {
    status: online ? "connected" : "disconnected",
    origin: url,
    configured: true,
    canMutate: false,
    error: null,
    areas: online ? areas : [],
    devices: entityRegistry.map((entry) => ({
      id: entry.device_id,
      area_id: entry.area_id,
      name: entry.name,
    })),
    entityRegistry: online ? entityRegistry : [],
    entityStates: online ? entityStates : {},
    refreshing: false,
    refreshError,
    connect: () => setOnline(true),
    retry: () => setOnline(true),
    disconnect: async () => setOnline(false),
    refresh: async () => {
      setRefreshError("Synthetic refresh failure. Previous choices retained.");
    },
    callService: async () => {
      throw new Error("Fixture service calls are forbidden.");
    },
    cameraClient: null,
  } as HomeAssistantRuntimeValue;
  if (!record) return <p>Loading synthetic workspace…</p>;
  return (
    <HomeAssistantRuntimeValueProvider value={runtime}>
      <ConnectedProduct
        record={record}
        lifecycle={lifecycle}
        homeAssistantUrl={url}
        onHomeAssistantUrlChange={setUrl}
        initialRequest={{ mode: "connect" }}
        migrateOrigin={async (current) => current}
      />
    </HomeAssistantRuntimeValueProvider>
  );
}
const router = createMemoryRouter([{ path: "*", element: <Fixture /> }]);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
