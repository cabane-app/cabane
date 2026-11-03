import {
  ROOM_TYPES,
  type DeviceModelDefinition,
  type DeviceModelRegistry,
  type FurnishingModelDefinition,
  type FurnishingModelRegistry,
  type RoomType,
} from "@cabane/engine";

export type CatalogEntry =
  | { key: string; kind: "furnishing"; modelId: string; definition: FurnishingModelDefinition }
  | { key: string; kind: "device"; modelId: string; definition: DeviceModelDefinition };
export type CatalogRoom = RoomType | "all" | "devices" | "lights" | "my-models";

export function catalogEntries(
  furnishings: FurnishingModelRegistry,
  devices: DeviceModelRegistry,
): CatalogEntry[] {
  const entries: CatalogEntry[] = [
    ...Object.entries(furnishings)
      .filter(([, definition]) => !definition.legacyOnly)
      .map(([modelId, definition]) => ({
        key: `furnishing:${modelId}`,
        kind: "furnishing" as const,
        modelId,
        definition,
      })),
    ...Object.entries(devices)
      .filter(([, definition]) => !definition.lightingOnly)
      .map(([modelId, definition]) => ({
        key: `device:${modelId}`,
        kind: "device" as const,
        modelId,
        definition,
      })),
  ];
  return entries.sort(
    (a, b) =>
      a.definition.label.localeCompare(b.definition.label, "en") ||
      a.key.localeCompare(b.key, "en"),
  );
}

export function filterCatalog(entries: readonly CatalogEntry[], room: CatalogRoom, query: string) {
  const words = query.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (room === "my-models" && !entry.modelId.startsWith("custom:")) return false;
    if (room === "devices" && entry.kind !== "device") return false;
    if (
      room === "lights" &&
      (entry.kind !== "device" || !entry.definition.supportedDomains.includes("light"))
    )
      return false;
    if (
      room !== "all" &&
      room !== "devices" &&
      room !== "lights" &&
      room !== "my-models" &&
      entry.definition.defaultRoomType !== room
    )
      return false;
    const roomLabel =
      ROOM_TYPES.find((type) => type.id === entry.definition.defaultRoomType)?.label ?? "";
    const haystack = [
      entry.modelId,
      entry.definition.label,
      entry.definition.category,
      ...(entry.definition.variants?.map((variant) => variant.label) ?? []),
      entry.kind === "furnishing" ? "Furniture furnishing" : "Device",
      roomLabel,
    ]
      .join(" ")
      .toLocaleLowerCase("en");
    return words.every((word) => haystack.includes(word));
  });
}
