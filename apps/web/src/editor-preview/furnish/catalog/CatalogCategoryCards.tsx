import { ROOM_TYPES } from "@cabane/engine";
import { useMemo } from "react";
import { EditorIcon, type EditorIconName } from "../../../editor-chrome/EditorIcon";
import type { CatalogEntry, CatalogRoom } from "./catalog";

const icons: Record<CatalogRoom, EditorIconName> = {
  all: "grid",
  devices: "devices",
  "my-models": "cube",
  "living-room": "furnish",
  kitchen: "kitchen",
  bedroom: "bed",
  bathroom: "bath",
  "dining-room": "dining",
  office: "monitor",
  entryway: "door",
  hallway: "hallway",
  laundry: "laundry",
  outdoor: "outdoor",
};
export const catalogFilters = [
  { id: "all" as const, label: "All items" },
  ...ROOM_TYPES,
  { id: "devices" as const, label: "Devices" },
  { id: "my-models" as const, label: "My models" },
];

export function CatalogCategoryCards({
  entries,
  onChoose,
}: {
  entries: readonly CatalogEntry[];
  onChoose: (room: CatalogRoom) => void;
}) {
  const counts = useMemo(() => {
    const result: Partial<Record<CatalogRoom, number>> = { all: entries.length };
    for (const entry of entries) {
      const room = entry.definition.defaultRoomType;
      if (room) result[room] = (result[room] ?? 0) + 1;
      if (entry.kind === "device") result.devices = (result.devices ?? 0) + 1;
      if (entry.modelId.startsWith("custom:")) result["my-models"] = (result["my-models"] ?? 0) + 1;
    }
    return result;
  }, [entries]);
  return (
    <nav className="catalog-categories" aria-label="Catalog categories">
      <div className="catalog-collections">
        {catalogFilters
          .filter((filter) => ["all", "devices", "my-models"].includes(filter.id))
          .map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-label={filter.label}
              onClick={() => onChoose(filter.id)}
            >
              <EditorIcon name={icons[filter.id]} />
              <span>{filter.label}</span>
            </button>
          ))}
      </div>
      <h3>Browse by room</h3>
      <div className="catalog-category-grid">
        {ROOM_TYPES.map((room) => (
          <button
            key={room.id}
            type="button"
            aria-label={room.label}
            onClick={() => onChoose(room.id)}
          >
            <EditorIcon name={icons[room.id]} />
            <strong>{room.label}</strong>
            <small>
              {counts[room.id] ?? 0} {(counts[room.id] ?? 0) === 1 ? "item" : "items"}
            </small>
          </button>
        ))}
      </div>
    </nav>
  );
}
