import { deviceActivityManifest } from "./fixtures/device-activity";
import { createRoot } from "react-dom/client";
import { homeManifest, homeExtensions } from "./fixtures/bundled-home";
import { stableDeviceRegistry } from "@cabane/catalog/device";
import { stableArchitectureModelRegistry } from "@cabane/catalog/architecture";
import { CabaneDashboard } from "@cabane/engine";
import { HomeAssistantRuntimeSnapshotTestProvider } from "../packages/engine/src/HomeAssistantRuntime";
import { deriveDemoSessionDefinition } from "../packages/engine/src/onboarding/demo/demo-session-definition";
import "@cabane/engine/styles.css";

// Synthetic, memory-only evidence: never reads a household session or sends a command.
const manifest = new URLSearchParams(location.search).has("studio")
  ? deviceActivityManifest
  : homeManifest;
const definition = deriveDemoSessionDefinition(manifest);
const runtime = {
  ...definition.runtime,
  canMutate: false,
  entityStates: Object.fromEntries(
    Object.entries(definition.runtime.entityStates).map(([id, state]) => [
      id,
      {
        ...state,
        state: id.startsWith("vacuum.")
          ? "cleaning"
          : id.startsWith("switch.")
            ? "on"
            : id.startsWith("sensor.") && state.state === "idle"
              ? "running"
              : state.state,
      },
    ]),
  ),
};
const room = new URLSearchParams(location.search).get("room");
createRoot(document.getElementById("root")!).render(
  <HomeAssistantRuntimeSnapshotTestProvider snapshot={runtime}>
    <CabaneDashboard
      manifest={manifest}
      architectureModels={stableArchitectureModelRegistry}
      deviceModels={{ ...stableDeviceRegistry, ...homeExtensions.deviceModels }}
      bindingManager={{
        profile: definition.profile,
        loaded: true,
        hasStoredProfile: false,
        save: () => undefined,
      }}
      {...(room ? { focusRoomId: room } : {})}
      sessionPresentation={{ mode: "demo", label: "Simulated activity" }}
    />
  </HomeAssistantRuntimeSnapshotTestProvider>,
);
