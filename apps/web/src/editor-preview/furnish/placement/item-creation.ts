import { resolveModelVariant } from "@cabane/engine";
import type { EntityBindingSlotSpec, ItemPlacement, SceneItemSpec } from "@cabane/engine";
import type { CatalogEntry } from "../catalog/catalog";
import { createSceneItemId } from "../scene-item-identity";

export function createCatalogItem(
  entry: CatalogEntry,
  placement: ItemPlacement,
  items: readonly SceneItemSpec[],
  occupiedIds: readonly string[],
  floorId: string,
): SceneItemSpec {
  const id = createSceneItemId([
    ...occupiedIds,
    ...items.map((item) => item.id),
    ...items.flatMap((item) => (item.entitySlots ?? []).map((slot) => slot.id)),
  ]);
  const lightSlotId =
    entry.definition.lighting &&
    (entry.kind === "furnishing" || !entry.definition.supportedDomains.includes("light"))
      ? createSceneItemId([
          ...occupiedIds,
          id,
          ...items.flatMap((item) =>
            item.lightSlotId ? [item.lightSlotId, `${item.lightSlotId}-entity`] : [],
          ),
        ])
      : undefined;
  const common = {
    ...(lightSlotId ? { lightSlotId } : {}),
    variant: resolveModelVariant(entry.definition).id,
    id,
    floorId,
    modelId: entry.modelId,
    placement,
    size: entry.definition.defaultSize,
  };
  if (entry.kind === "furnishing") return { ...common, kind: "furnishing" };
  const domain = entry.definition.supportedDomains[0];
  if (!domain) throw new Error(`${entry.definition.label} has no supported device domain.`);
  const slotId = createSceneItemId([
    ...occupiedIds,
    ...(lightSlotId ? [lightSlotId, `${lightSlotId}-entity`] : []),
    id,
    ...items.map((item) => item.id),
    ...items.flatMap((item) => (item.entitySlots ?? []).map((slot) => slot.id)),
  ]);
  const classes = entry.definition.supportedDeviceClasses?.[domain];
  // A slot has one class constraint for all its domains. Include alternatives
  // only when that same constraint applies (e.g. an appliance switch or sensor).
  const compatibleDomains = entry.definition.supportedDomains.filter((candidate) => {
    const candidateClasses = entry.definition.supportedDeviceClasses?.[candidate];
    return (
      (classes?.length ?? 0) === (candidateClasses?.length ?? 0) &&
      (classes ?? []).every((value) => candidateClasses?.includes(value))
    );
  });
  const primary: EntityBindingSlotSpec = {
    id: slotId,
    compatibleDomains,
    ...(classes ? { compatibleDeviceClasses: classes } : {}),
    required: true,
    autoMap: "manual",
    deviceRole: "primary",
    presentation: { label: entry.definition.label, dashboardRole: "primary" },
  };
  return { ...common, kind: "device", entitySlots: [primary] };
}
