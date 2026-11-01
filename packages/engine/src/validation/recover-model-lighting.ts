import { validateModelLighting } from "../model-lighting/schema";
import type { HomeProjectIssue } from "../home-project/validation-types";
import type { ManifestIssue } from "../types";
import {
  isDeviceModelDefinition,
  isFurnishingModelDefinition,
  isObject,
  issue,
  type RawObject,
} from "./core";

/** Disable only broken optional illumination in the runtime projection, never saved data. */
export function recoverModelLighting(input: RawObject) {
  const issues: ManifestIssue[] = [];
  if (!isObject(input.extensions)) return { input, issues };
  let extensions = input.extensions;
  for (const key of ["deviceModels", "furnishingModels"] as const) {
    const registry = extensions[key];
    if (!isObject(registry)) continue;
    let recovered = registry;
    for (const [modelId, definition] of Object.entries(registry)) {
      if (!isObject(definition)) continue;
      const {
        sceneLight: _single,
        sceneLights: _multiple,
        lighting: _lighting,
        ...base
      } = definition;
      const validDefinition =
        key === "deviceModels" ? isDeviceModelDefinition : isFurnishingModelDefinition;
      // Structural model faults still need ordinary validation. They cannot be
      // repaired by suppressing illumination.
      if (!validDefinition(base)) continue;
      const lightingIssues: HomeProjectIssue[] = [];
      if (definition.lighting !== undefined)
        validateModelLighting(definition.lighting, "lighting", lightingIssues);
      if (validDefinition(definition) && !lightingIssues.length) continue;
      if (recovered === registry) recovered = { ...registry };
      recovered[modelId] = { ...base, lightingDisabled: true, lightingCustomized: true };
      issues.push(
        issue(
          "model.lighting-disabled",
          `extensions.${key}.${modelId}`,
          `Lighting for “${String(definition.label)}” is disabled because its light settings are invalid. The model remains visible and saved settings are unchanged. Open Lighting in Arrange to repair it.`,
          "warning",
        ),
      );
    }
    if (recovered !== registry) extensions = { ...extensions, [key]: recovered };
  }
  return { input: extensions === input.extensions ? input : { ...input, extensions }, issues };
}
