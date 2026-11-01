import type { CustomModelLight } from "./contracts";
import { modelLightingExecution } from "../model-lighting/execution";
export { modelLightSources } from "../model-lighting/execution";

/** Bounded physical approximation for previews and compatibility metadata. */
export function importedLightSources(light: CustomModelLight) {
  return modelLightingExecution(light).lights.map(({ name: _name, intensity, ...source }) => ({
    ...source,
    maxIntensity: intensity,
  }));
}
