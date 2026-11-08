import { resolveDeviceModelDefinition } from "../../devices";
import { lightingModelId, primaryLightSlot } from "../../model-lighting/settings";
import { resolveModelVariant } from "../../model-variants";
import type { DeviceModelRegistry, HomeManifest } from "../../types";

/** Light the welcome set from its authored fixtures, independently of the demo controls. */
export function welcomeLightingManifest(
  manifest: HomeManifest,
  deviceModels: DeviceModelRegistry,
): HomeManifest {
  return {
    ...manifest,
    sceneItems: manifest.sceneItems.map((item) => {
      // A device's lightState also feeds its primary visual state. Preserve
      // non-light devices such as fans even when they have a separate light.
      const fixture = item.kind === "device" ? primaryLightSlot(item) : item.lightSlotId;
      if (!fixture || item.lightState === "night-only") return item;
      const model = resolveDeviceModelDefinition(
        item.lightSlotId ? lightingModelId(item.modelId) : item.modelId,
        deviceModels,
        manifest.extensions.deviceModels,
      );
      if (
        !model ||
        model.lightingDisabled ||
        !(model.lighting || model.sceneLight) ||
        resolveModelVariant(model, item.variant).sceneLight === false
      ) {
        return item;
      }
      return { ...item, lightState: "night-only" };
    }),
  };
}
