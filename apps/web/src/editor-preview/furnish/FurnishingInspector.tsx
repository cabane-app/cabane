import type {
  DeviceModelRegistry,
  EntityBindingSlotSpec,
  FloorSpec,
  FurnishingModelRegistry,
  ItemPlacement,
  SceneItemSpec,
  SceneItemSize,
  SceneModelEditorDescriptor,
} from "@cabane/engine";
import { FurnishingProperties } from "./FurnishingProperties";
import type { ItemConnectionContext } from "./ItemEntitySlots";
import { missingModelEditorDescriptor } from "./missing-model";
import { useMemo } from "react";
import type { CatalogEntry } from "./catalog/catalog";

export interface FurnishingInspectorProps {
  connections?: ItemConnectionContext | undefined;
  floor?: FloorSpec;
  onWindowFit?: (
    id: string,
    placement: ItemPlacement,
    size: SceneItemSize,
    definition: SceneModelEditorDescriptor,
  ) => void;
  items: readonly SceneItemSpec[];
  selectedId: string | null;
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  onPlacementChange: (id: string, placement: ItemPlacement) => void;
  onSizeChange: (id: string, size: SceneItemSize, definition: SceneModelEditorDescriptor) => void;
  onColorChange?: (
    id: string,
    color: string | null,
    definition: SceneModelEditorDescriptor,
  ) => void;
  onVariantChange?: (id: string, variant: string, definition: SceneModelEditorDescriptor) => void;
  onEntitySlotsChange?: ((id: string, slots: readonly EntityBindingSlotSpec[]) => void) | undefined;
  onLightStateChange?: (
    id: string,
    lightState: "always-off" | "always-on" | "night-only" | "connected",
  ) => void;
  onConnectLighting?: (() => void) | undefined;
  onEditLighting?: (() => void) | undefined;
  onClose: () => void;
}

export function FurnishingInspector({
  items,
  selectedId,
  furnishingModels,
  deviceModels,
  floor,
  onWindowFit,
  onPlacementChange,
  onSizeChange,
  onLightStateChange,
  onEntitySlotsChange,
  connections,
  onVariantChange,
  onColorChange,
  onClose,
  onEditLighting,
  onConnectLighting,
}: FurnishingInspectorProps) {
  const selected = items.find((item) => item.id === selectedId);
  const kind = selected?.kind;
  const modelId = selected?.modelId;
  const previewEntry = useMemo<CatalogEntry | undefined>(() => {
    if (!kind || !modelId) return undefined;
    if (kind === "device") {
      const definition = deviceModels[modelId];
      return definition ? { key: `device:${modelId}`, kind, modelId, definition } : undefined;
    }
    const definition = furnishingModels[modelId];
    return definition ? { key: `furnishing:${modelId}`, kind, modelId, definition } : undefined;
  }, [kind, modelId, furnishingModels, deviceModels]);
  const definition = selected
    ? (previewEntry?.definition ?? missingModelEditorDescriptor(selected))
    : undefined;
  return selected && definition ? (
    <FurnishingProperties
      selected={selected}
      definition={definition}
      previewEntry={previewEntry}
      floor={floor}
      onWindowFit={onWindowFit}
      onLightStateChange={onLightStateChange}
      onEntitySlotsChange={onEntitySlotsChange}
      connections={connections}
      onVariantChange={onVariantChange}
      onColorChange={onColorChange}
      onPlacementChange={onPlacementChange}
      onSizeChange={onSizeChange}
      onEditLighting={onEditLighting}
      onConnectLighting={onConnectLighting}
      onClose={onClose}
    />
  ) : null;
}
