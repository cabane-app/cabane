import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ERR_INVALID_AUTH } from "home-assistant-js-websocket";
import { stableDeviceRegistry } from "../packages/catalog/src/device/index";
import { stableArchitectureModelRegistry } from "../packages/catalog/src/architecture/index";
import { CabaneDashboard } from "../packages/engine/src/CabaneDashboard";
import {
  modelingNudgeStorageKey,
  onboardingStorageKey,
  CabaneAppExperience,
} from "../packages/engine/src/CabaneApp";
import {
  createEmptyRuntimeBindingProfile,
  saveRuntimeBindingProfile,
} from "../packages/engine/src/runtime-binding-profile";
import { neutralDemoManifest } from "../packages/engine/src/demo";
import { HomeAssistantRuntimeTestProvider } from "../packages/engine/src/HomeAssistantRuntime";
import { HOME_ASSISTANT_TOKEN_STORAGE_KEY } from "../packages/engine/src/home-assistant-auth";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  fixtureAreas,
  fixtureDevices,
  fixtureEntityRegistry,
  fixtureRawStates,
  rawEntity,
} from "./fixtures/home-assistant.mjs";
import { homeManifest } from "./fixtures/previous-demo/project";
import "../packages/engine/src/styles.css";

const scenario = new URL(window.location.href).searchParams.get("scenario") ?? "connected";
const firstRunScenario = ["first-run-mapping", "post-onboarding", "home-editor"].includes(scenario);
const manifest = firstRunScenario ? homeManifest : connectedManifestFixture(neutralDemoManifest);
const listeners = new Map<string, Set<(connection: unknown, data?: unknown) => void>>();
const registry = structuredClone(fixtureEntityRegistry);
const states = structuredClone(fixtureRawStates);

if (scenario === "unavailable") {
  states["sensor.demo_temperature"].state = "unavailable";
  states["binary_sensor.demo_window"].state = "unknown";
}
if (scenario === "incompatible") {
  registry.find((entry) => entry.entity_id === "climate.demo")!.area_id = "outside";
}
if (scenario === "presence") {
  registry.push(
    {
      entity_id: "person.alex",
      area_id: null,
      device_id: null,
      platform: "person",
      disabled_by: null,
      hidden_by: null,
      name: null,
      original_name: "Alex",
    },
    {
      entity_id: "person.sam",
      area_id: null,
      device_id: null,
      platform: "person",
      disabled_by: null,
      hidden_by: null,
      name: null,
      original_name: "Sam",
    },
  );
  states["person.alex"] = rawEntity("person.alex", "home", {
    friendly_name: "Alex",
    latitude: 48.8,
    longitude: 2.3,
    source: "device_tracker.alex_phone",
  });
  states["person.sam"] = rawEntity("person.sam", "home", {
    friendly_name: "Sam",
    latitude: 48.8,
    longitude: 2.3,
    source: "device_tracker.sam_phone",
  });
}

const connection = {
  close: () => undefined,
  addEventListener(type: string, callback: (connection: unknown, data?: unknown) => void) {
    const callbacks = listeners.get(type) ?? new Set();
    callbacks.add(callback);
    listeners.set(type, callbacks);
  },
  removeEventListener(type: string, callback: (connection: unknown, data?: unknown) => void) {
    listeners.get(type)?.delete(callback);
  },
  async sendMessagePromise(message: { type: string }) {
    if (message.type === "config/area_registry/list") return structuredClone(fixtureAreas);
    if (message.type === "config/device_registry/list") return structuredClone(fixtureDevices);
    if (message.type === "config/entity_registry/list") return structuredClone(registry);
    throw new Error(`Unexpected fixture message: ${message.type}`);
  },
  async subscribeEvents() {
    return () => undefined;
  },
};

const authData = {
  hassUrl: "http://fixture-ha.local:8123",
  clientId: window.location.origin,
  expires: Date.now() + 60_000,
  refresh_token: "test-only-refresh",
  access_token: "test-only-access",
  expires_in: 1800,
};
window.localStorage.setItem(HOME_ASSISTANT_TOKEN_STORAGE_KEY, JSON.stringify(authData));
if (firstRunScenario) {
  const onboardingKey = onboardingStorageKey(manifest.home.id);
  if (["post-onboarding", "home-editor"].includes(scenario))
    window.localStorage.setItem(onboardingKey, "complete");
  else window.localStorage.removeItem(onboardingKey);
  window.localStorage.removeItem(modelingNudgeStorageKey(manifest.home.id));
  saveRuntimeBindingProfile(
    window.localStorage,
    "http://fixture-ha.local:8123",
    createEmptyRuntimeBindingProfile(manifest.home.id),
  );
} else {
  saveRuntimeBindingProfile(
    window.localStorage,
    "http://fixture-ha.local:8123",
    connectedProfileFixture(),
  );
}

const client = {
  async getAuth() {
    if (scenario === "expired-auth") throw ERR_INVALID_AUTH;
    return { data: authData, revoke: async () => undefined };
  },
  async createConnection() {
    if (scenario === "reconnecting") {
      window.setTimeout(() => {
        for (const callback of listeners.get("disconnected") ?? []) callback(connection);
      }, 180);
    }
    return connection;
  },
  subscribeEntities(_connection: unknown, callback: (states: typeof fixtureRawStates) => void) {
    callback(states);
    return () => undefined;
  },
  async callService() {
    return undefined;
  },
};

const root = document.getElementById("root");
if (!root) throw new Error("The fixture harness root is missing.");

createRoot(root).render(
  <StrictMode>
    <HomeAssistantRuntimeTestProvider
      homeAssistantUrl="http://fixture-ha.local:8123"
      client={client as never}
    >
      {firstRunScenario ? (
        <CabaneAppExperience
          manifest={manifest}
          architectureModels={stableArchitectureModelRegistry}
          deviceModels={stableDeviceRegistry}
          homeAssistantUrl="http://fixture-ha.local:8123"
          onHomeAssistantUrlChange={() => undefined}
          onExportBrowserData={() => undefined}
        />
      ) : (
        <CabaneDashboard
          manifest={manifest}
          architectureModels={stableArchitectureModelRegistry}
          deviceModels={stableDeviceRegistry}
        />
      )}
    </HomeAssistantRuntimeTestProvider>
  </StrictMode>,
);
