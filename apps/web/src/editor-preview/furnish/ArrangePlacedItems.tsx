import { useId, useState } from "react";
import { roomIdForItem, roomsForFloor } from "@cabane/engine";
import type {
  DeviceModelRegistry,
  FloorSpec,
  FurnishingModelRegistry,
  SceneItemSpec,
} from "@cabane/engine";
import { EditorIcon } from "../../editor-chrome/EditorIcon";
import { itemSelectionUnits, toggleItemSelection } from "./item-groups";
import { groupPlacement } from "./group-transforms";
import "./arrange-placed-items.css";

/** Uses stored items, independent of visibility, picking and catalog availability. */
export function ArrangePlacedItems({
  floor,
  items,
  furnishingModels,
  deviceModels,
  selectedIds,
  disabled,
  onSelect,
  onSelectMany,
}: {
  floor: FloorSpec;
  items: readonly SceneItemSpec[];
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  selectedIds: readonly string[];
  disabled: boolean;
  onSelect: (id: string) => void;
  onSelectMany?: (ids: string[]) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rooms = roomsForFloor(floor);
  const floorItems = items.filter((item) => item.floorId === floor.id);
  const labelFor = (item: SceneItemSpec) =>
    (item.kind === "device" ? deviceModels : furnishingModels)[item.modelId]?.label ??
    "Missing model";
  const entries = itemSelectionUnits(floorItems).map((unit) => {
    const item = unit.items[0];
    let roomId: string | null = null;
    try {
      roomId = roomIdForItem(
        unit.name ? { ...item, placement: groupPlacement(unit.items, floor) } : item,
        floor,
        (item.kind === "device" ? deviceModels : furnishingModels)[item.modelId],
      );
    } catch {
      // Invalid supports must not prevent selecting an item to repair it.
    }
    return {
      ...unit,
      item,
      roomId,
      label: unit.name ?? labelFor(item),
    };
  });
  const words = query.trim().toLocaleLowerCase().split(/\s+/);
  const groups = [
    ...rooms.map((room) => ({ id: room.id, label: room.name })),
    { id: null, label: "Outside rooms" },
  ]
    .map((group) => ({
      ...group,
      entries: entries.filter(
        ({ roomId, label, items: members }) =>
          roomId === group.id &&
          words.every((word) =>
            `${label} ${group.label} ${members.map(labelFor).join(" ")}`
              .toLocaleLowerCase()
              .includes(word),
          ),
      ),
    }))
    .filter((group) => group.entries.length > 0);
  return (
    <details className="arrange-placed-items">
      <summary>Placed items · {floorItems.length}</summary>
      <div className="arrange-placed-items__heading">
        <p>{floor.name}</p>
        {onSelectMany && (
          <button
            type="button"
            className="arrange-placed-items__select"
            disabled={disabled}
            aria-pressed={selecting}
            onClick={() => setSelecting(!selecting)}
          >
            {selecting ? "Done selecting" : "Select items"}
          </button>
        )}
      </div>
      <label className="catalog-search">
        <EditorIcon name="search" />
        <input
          type="search"
          aria-label="Search placed items"
          placeholder="Search placed items…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="arrange-placed-items__groups" aria-label={`Placed items on ${floor.name}`}>
        {groups.map((group) => (
          <section key={group.id ?? "outside-rooms"}>
            <h3>{group.label}</h3>
            <ul aria-label={group.label}>
              {group.entries.map((entry) => {
                const { item, label } = entry;
                const selected = entry.items.every((member) => selectedIds.includes(member.id));
                const open = !collapsed.has(entry.id) || !!query.trim();
                const contentsId = `${listId}-${entry.id}`;
                const content = (
                  <>
                    <EditorIcon
                      name={entry.name ? "group" : item.kind === "device" ? "devices" : "furnish"}
                    />
                    <span>{label}</span>
                    {entry.name && (
                      <span className="arrange-placed-items__count">{entry.items.length}</span>
                    )}
                  </>
                );
                return (
                  <li key={entry.id}>
                    <div className="arrange-placed-items__row">
                      {entry.name && (
                        <button
                          type="button"
                          className="arrange-placed-items__disclosure"
                          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
                          aria-expanded={open}
                          aria-controls={contentsId}
                          onClick={() =>
                            setCollapsed((previous) => {
                              const next = new Set(previous);
                              if (open) next.add(entry.id);
                              else next.delete(entry.id);
                              return next;
                            })
                          }
                        >
                          <EditorIcon name="chevron" />
                        </button>
                      )}
                      {selecting && onSelectMany ? (
                        <label className="arrange-placed-items__check" data-selected={selected}>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            aria-label={`Select ${label}`}
                            onChange={() =>
                              onSelectMany(toggleItemSelection(floorItems, selectedIds, item.id))
                            }
                          />
                          {content}
                        </label>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          aria-pressed={selected}
                          aria-controls="editor-properties"
                          onClick={(event) => {
                            if ((event.metaKey || event.ctrlKey) && onSelectMany)
                              onSelectMany(toggleItemSelection(floorItems, selectedIds, item.id));
                            else onSelect(item.id);
                          }}
                        >
                          {content}
                        </button>
                      )}
                    </div>
                    {entry.name && (
                      <ul
                        id={contentsId}
                        className="arrange-placed-items__members"
                        aria-label={`${label} items`}
                        hidden={!open}
                      >
                        {entry.items.map((member) => (
                          <li key={member.id}>{labelFor(member)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {groups.length === 0 && (
        <p role="status">
          {floorItems.length ? "No matching placed items" : "No items on this floor yet"}
        </p>
      )}
    </details>
  );
}
