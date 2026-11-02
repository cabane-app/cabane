import { createElement } from "react";
import { resolveModelVariant } from "../model-variants";
import type { CustomModelLight } from "../imported-models/contracts";
import { importedLightSources } from "../imported-models/light-sources";
import type { HomeProject, SceneItemSpec } from "../home-project/types";
import type {
  DeviceModelDefinition,
  HomeDeviceModelProps,
  EntityBindingSlotSpec,
  ProjectModelRegistries,
  SceneModelEditorDescriptor,
} from "../types";

export const lightingModelId = (modelId: string) => `lighting:${modelId}`;
export const lightingEntitySlotId = (id: string) => `${id}-entity`;
export const primaryLightSlot = (item: SceneItemSpec) =>
  item.kind === "device"
    ? item.entitySlots.find(
        (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
      )
    : undefined;
export const lightingSlotForItem = (item: SceneItemSpec): EntityBindingSlotSpec | undefined =>
  primaryLightSlot(item) ??
  (item.lightSlotId
    ? {
        id: lightingEntitySlotId(item.lightSlotId),
        compatibleDomains: ["light"],
        required: false,
        autoMap: "manual",
        deviceRole: "primary",
        presentation: { label: "Lighting", dashboardRole: "primary" },
      }
    : undefined);

export function defaultModelLighting(
  definition: SceneModelEditorDescriptor | undefined,
): CustomModelLight | undefined {
  if (!definition) return undefined;
  if (definition.lighting) return definition.lighting;
  const device = definition as DeviceModelDefinition;
  if (!device.sceneLight) return undefined;
  const sources = device.sceneLights ?? [device.sceneLight];
  return {
    ...sources[0],
    maxIntensity: sources.reduce((sum, source) => sum + source.maxIntensity, 0),
    ...(sources.length > 1 ? { points: sources.slice(1).map((source) => source.position) } : {}),
  };
}

export function projectModelLighting(
  project: Pick<HomeProject, "customModels" | "modelLights">,
  modelId: string,
  native: ProjectModelRegistries,
): CustomModelLight | undefined {
  const custom = project.customModels?.find((model) => model.id === modelId);
  if (custom) return custom.light;
  if (Object.hasOwn(project.modelLights ?? {}, modelId))
    return project.modelLights![modelId] ?? undefined;
  return defaultModelLighting(native.deviceModels[modelId] ?? native.furnishingModels[modelId]);
}

/** Called after resolving personal geometry. Never mutates a shared catalog definition. */
export function resolveModelLighting(
  project: Pick<HomeProject, "customModels" | "modelLights">,
  registries: ProjectModelRegistries,
): ProjectModelRegistries {
  const furnishings = { ...registries.furnishingModels };
  const devices = { ...registries.deviceModels };
  const modelIds = new Set([...Object.keys(furnishings), ...Object.keys(devices)]);
  for (const modelId of modelIds) {
    const definition = devices[modelId] ?? furnishings[modelId];
    if ((definition as DeviceModelDefinition).lightingOnly) continue;
    const lighting = projectModelLighting(project, modelId, registries);
    const customized =
      modelId.startsWith("custom:") || Object.hasOwn(project.modelLights ?? {}, modelId);
    const disabled = customized && !lighting;
    const metadata = {
      ...(lighting ? { lighting } : {}),
      ...(customized ? { lightingCustomized: true } : {}),
      ...(disabled ? { lightingDisabled: true } : {}),
    };
    if (furnishings[modelId]) furnishings[modelId] = { ...furnishings[modelId], ...metadata };
    if (devices[modelId]) {
      const {
        sceneLight: _single,
        sceneLights: _multiple,
        lighting: _lighting,
        ...base
      } = devices[modelId];
      devices[modelId] = {
        ...base,
        ...metadata,
        ...(lighting ? { sceneLight: lighting, sceneLights: importedLightSources(lighting) } : {}),
      };
    }
    if (!lighting) continue;
    devices[lightingModelId(modelId)] = {
      ...definition,
      lightingOnly: true,
      label: `${definition.label} lighting`,
      component:
        devices[modelId]?.component ??
        ((props: HomeDeviceModelProps) =>
          createElement(furnishings[modelId].component, {
            size: definition.defaultSize,
            variant: resolveModelVariant(definition).id,
            entityStatesBySlotId: {},
            reducedMotion: props.reducedMotion,
            walkMode: props.walkMode,
            onInteract: props.onInteract,
          })),
      mountKind: "surface",
      supportedDomains: ["light"],
      interaction: { tapTolerancePixels: 8 },
      lighting,
      sceneLight: lighting,
      sceneLights: importedLightSources(lighting),
    };
  }
  return { furnishingModels: furnishings, deviceModels: devices };
}

export function modelLightingPointCount(
  project: HomeProject,
  floorId: string,
  registries: ProjectModelRegistries,
) {
  return project.sceneItems
    .filter((item) => item.floorId === floorId)
    .reduce((count, item) => {
      const light = projectModelLighting(project, item.modelId, registries);
      return (
        count +
        (light &&
        (item.modelId.startsWith("custom:") ||
          Object.hasOwn(project.modelLights ?? {}, item.modelId))
          ? importedLightSources(light).length
          : 0)
      );
    }, 0);
}
