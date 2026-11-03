import {
  defineDeviceModel,
  type FurnishingModelDefinition,
  type HomeDeviceModelComponent,
} from "@cabane/engine";
import { electricalPanelDefinition } from "../../furnishing/definitions/electrical-panel";
import { externalAcUnitDefinition } from "../../furnishing/definitions/external-ac-unit";
import { frenchWallMailboxDefinition } from "../../furnishing/definitions/french-wall-mailbox";
import { kitchenHoodDefinition } from "../../furnishing/definitions/kitchen-hood";
import { usMailboxDefinition } from "../../furnishing/definitions/us-mailbox";
import {
  ElectricalPanelModel,
  ExternalAcUnitModel,
  FrenchWallMailboxModel,
  KitchenHoodModel,
  UsMailboxModel,
} from "../presets/utility";

/** Reuse the original geometry descriptors while keeping saved furnishings readable. */
function connectableUtility(
  furnishing: FurnishingModelDefinition,
  component: HomeDeviceModelComponent,
) {
  const { legacyOnly: _legacyOnly, component: _component, ...descriptor } = furnishing;
  return defineDeviceModel({
    ...descriptor,
    component,
    supportedDomains: ["switch", "input_boolean", "binary_sensor"],
    mountKind: furnishing.preferredPlacement === "wall" ? "wall" : "surface",
    interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  });
}

export const utilityDeviceDefinitions = {
  "french-wall-mailbox": connectableUtility(frenchWallMailboxDefinition, FrenchWallMailboxModel),
  "us-mailbox": connectableUtility(usMailboxDefinition, UsMailboxModel),
  "electrical-panel": connectableUtility(electricalPanelDefinition, ElectricalPanelModel),
  "kitchen-hood": connectableUtility(kitchenHoodDefinition, KitchenHoodModel),
  "external-ac-unit": connectableUtility(externalAcUnitDefinition, ExternalAcUnitModel),
};
